"""End-to-end check. Needs: python3 -m http.server 8765 (run in the repo root) and playwright
(pip install playwright; uses system Chrome). Run: python3 tests/e2e.py
Screenshots go to /workspace/ju-learning-previews/ (override with PREVIEWS env var)."""
import json, os, re, shutil, subprocess, sys, tempfile, zipfile
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8765/')
OUT = os.environ.get('PREVIEWS', '/workspace/ju-learning-previews')
os.makedirs(OUT, exist_ok=True)
OUT2 = os.path.join(OUT, 'v2')
os.makedirs(OUT2, exist_ok=True)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
foreign_requests = []
week = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'week-2026-10-26.json')))
WORDS = {w['word']: w for w in week['words']}
BY_CLUE = {w['clue']: w['word'] for w in week['words']}
fails = []
def check(cond, label):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: fails.append(label)

SPY = """
window.__spoken = [];
const orig = window.speechSynthesis;
window.speechSynthesis.speak = function(u){ window.__spoken.push(u.text); setTimeout(()=>{ u.onend && u.onend(); }, 5); };
"""

def last_spoken(page):
    return page.evaluate("window.__spoken[window.__spoken.length-1]")

def login(page, pin, keyboard=False):
    page.goto(BASE + 'index.html')
    if keyboard:
        page.keyboard.type(pin)
    else:
        for d in pin: page.click(f'.pad[data-k="{d}"]')

def next_btn(page):
    page.locator('button:has-text("Next")').first.click()

def finish_checks(page, name):
    page.wait_for_selector('.finish', timeout=5000)
    t = page.inner_text('.finish')
    check('finished' in t.lower(), f'{name}: finish screen')

def all_lower(page, sel):
    texts = page.eval_on_selector_all(sel, "els => els.map(e => e.textContent.trim())")
    return all(t == t.lower() for t in texts), texts

def no_case_leak(page, word, label):
    txt = page.inner_text('#stage')
    bad = re.findall(r'\b(%s|%s|%s)\b' % (word.upper(), word.capitalize(), word.title()), txt)
    check(not bad, f'{label}: no capitalised/uppercase copy of {word} on screen')

def pause_through(page):
    # after word 6 there's a round break
    page.wait_for_selector('.pause', timeout=5000)
    page.click('.pause button')

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1280, 'height': 720}, accept_downloads=True)
    ctx.add_init_script(SPY)
    page = ctx.new_page()
    page.on('request', lambda r: foreign_requests.append(r.url) if not re.match(r'^(http://localhost:|data:|blob:)', r.url) else None)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    # --- gate ---
    for path in ['child.html', 'game.html?g=unscramble', 'parent.html']:
        page.goto(BASE + path)
        check(page.url.endswith('index.html'), f'{path} redirects to index when logged out')
    page.goto(BASE + 'index.html')
    check('Welcome, Julianna!' in page.inner_text('h1'), 'landing heading')
    page.screenshot(path=f'{OUT}/01-landing.png')
    login(page, '1111')
    page.wait_for_selector('#msg:not(:empty)')
    check('not the right' in page.inner_text('#msg'), 'wrong PIN gives gentle message')
    check(page.url.endswith('index.html'), 'wrong PIN stays on landing')
    login(page, '0518', keyboard=True)
    page.wait_for_url('**/child.html')
    check(True, 'child PIN via keyboard opens child.html')
    check(page.evaluate("sessionStorage.getItem('ju_role')") == 'child', 'role stored in sessionStorage')
    page.goto(BASE + 'parent.html')
    check(page.url.endswith('index.html'), 'child cannot open parent page')
    login(page, '0518')
    page.wait_for_url('**/child.html')
    page.wait_for_selector('.gcard')
    check(page.locator('.gcard').count() == 6, 'child home shows 5 games + test')
    check(page.locator('.sbox').count() == 5, 'five sticker boxes')
    check(page.locator('.sbox.got').count() == 0, 'no stickers yet')
    page.screenshot(path=f'{OUT}/02-child-home.png')

    def start(g):
        page.goto(BASE + f'game.html?s=spelling&g={g}')

    # --- unscramble ---
    start('unscramble')
    shot = False
    for i in range(12):
        page.wait_for_selector('.tile')
        clue = page.inner_text('.clue').replace('Clue: ', '').strip()
        word = BY_CLUE[clue]
        ok, texts = all_lower(page, '.tile')
        no_case_leak(page, word, 'unscramble') if i < 3 else None
        check(ok, f'unscramble {word}: tiles lowercase') if i < 2 else None
        if i == 0:
            # deliberate wrong answer first: put tiles in scrambled order (unless it happens to be right)
            tiles = page.locator('.bank .tile')
            n = tiles.count()
            for _ in range(n): page.locator('.bank .tile').first.click()
            page.click('button:has-text("Check my word")')
            msg = page.inner_text('.msg')
            if 'Almost' in msg: check(True, 'unscramble wrong answer gets gentle message')
        if i == 1 and not shot:
            # type via keyboard half way for screenshot
            for ch in word[:2]: page.keyboard.type(ch)
            page.screenshot(path=f'{OUT}/03-game-unscramble.png'); shot = True
            for _ in range(2): page.keyboard.press('Backspace')
        for ch in word: page.keyboard.type(ch)
        page.click('button:has-text("Check my word")')
        page.wait_for_selector('button:has-text("Next word")')
        if i == 5: pass
        page.click('button:has-text("Next word")')
        if i == 5: pause_through(page)
    finish_checks(page, 'unscramble')

    # --- hangman ---
    start('hangman')
    shot = False
    for i in range(12):
        page.wait_for_selector('.key')
        clue = page.inner_text('.clue').replace('Clue: ', '').strip()
        word = BY_CLUE[clue]
        ok, _ = all_lower(page, '.key')
        no_case_leak(page, word, 'hangman') if i < 3 else None
        if i == 0: check(ok, 'hangman keys lowercase')
        if i == 0:
            wrong = [c for c in 'zqxjv' if c not in word][0]
            page.click(f'.key[aria-label="{wrong}"]')
            check('this time' in page.inner_text('.msg'), 'hangman miss is gentle')
        for ch in dict.fromkeys(word):
            page.keyboard.type(ch)
            if i == 1 and not shot and ch == word[2]:
                page.wait_for_timeout(700)
                page.screenshot(path=f'{OUT}/04-game-hangman.png'); shot = True
        page.wait_for_selector('button:has-text("Next word")')
        if i == 2:
            page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/04b-game-hangman-bloom.png')
        page.click('button:has-text("Next word")')
        if i == 5: pause_through(page)
    finish_checks(page, 'hangman')

    # --- match ---
    start('match')
    for i in range(12):
        page.wait_for_selector('.choice')
        prompt = page.inner_text('h2')
        word = ''.join(page.inner_text('.bigword').split()).replace('\u2022', '')
        if 'clue' in prompt:
            right = WORDS[word]['clue']
            idx = [c.strip() for c in page.eval_on_selector_all('.choice', "els=>els.map(e=>e.textContent.replace(/^\\d/, '').trim())")].index(right)
        else:
            right = '-'.join(WORDS[word]['syllables'])
            texts = page.eval_on_selector_all('.choice', "els=>els.map(e=>e.textContent.replace(/^\\d/, '').trim())")
            idx = [t.replace('\u2022', '-') for t in texts].index(right)
        if i == 0:
            wrong_idx = (idx + 1) % 3
            page.locator('.choice').nth(wrong_idx).click()
            check('Try another' in page.inner_text('.msg'), 'match wrong gets gentle message')
        if i == 1: page.screenshot(path=f'{OUT}/05-game-match.png')
        page.locator('.choice').nth(idx).click()
        page.wait_for_selector('button:has-text("Next word")')
        page.click('button:has-text("Next word")')
        if i == 5: pause_through(page)
    finish_checks(page, 'match')

    # --- listen ---
    start('listen')
    for i in range(12):
        page.wait_for_selector('.typebox')
        word = None
        # the first spoken text for this word is the word itself
        spoken = page.evaluate("window.__spoken.slice().reverse().find(t => t.indexOf(' ')===-1)")
        word = spoken
        check(word in WORDS, f'listen: spoke a week word ({word})') if i < 1 else None
        if i == 0:
            page.fill('.typebox', 'WRONG')
            check(page.input_value('.typebox') == 'wrong', 'listen: typed capitals become lowercase')
            page.keyboard.press('Enter')
            check('Good try' in page.inner_text('.msg'), 'listen: first miss gentle')
            page.click('button:has-text("sentence")')
            check(' ' in last_spoken(page), 'listen: sentence button speaks a sentence')
            page.screenshot(path=f'{OUT}/06-game-listen.png')
        page.fill('.typebox', word)
        page.keyboard.press('Enter')
        page.wait_for_selector('button:has-text("Next word")')
        page.click('button:has-text("Next word")')
        if i == 5: pause_through(page)
    finish_checks(page, 'listen')

    # --- clap ---
    start('clap')
    page.wait_for_selector('.clap-intro')
    check('Example' in page.inner_text('.clap-intro'), 'clap: intro with example')
    page.click('button:has-text("Watch the example")')
    page.wait_for_function("document.querySelector('.ex-beats').textContent.includes('2 beats')", timeout=8000)
    page.screenshot(path=f'{OUT}/07-game-clap-intro.png')
    page.click('button:has-text("ready")')
    for i in range(12):
        page.wait_for_selector('.clapbtn')
        word = page.inner_text('.bigword').strip()
        syl = WORDS[word]['syllables']
        no_case_leak(page, word, 'clap') if i < 3 else None
        if i == 0:
            for _ in range(len(syl) + 1): page.click('.clapbtn')
            page.click('button:has-text("Check")')
            check('Good try' in page.inner_text('.msg'), 'clap: wrong count is gentle')
        for _ in range(len(syl)): page.click('.clapbtn')
        if i == 1: page.screenshot(path=f'{OUT}/08-game-clap-count.png')
        page.click('button:has-text("Check")')
        page.wait_for_selector('.cutrow')
        pos = 0
        for s in syl[:-1]:
            pos += len(s)
            page.locator('.gap').nth(pos - 1).click()
        if i == 1: page.screenshot(path=f'{OUT}/09-game-clap-cut.png')
        page.click('button:has-text("Check")')
        page.wait_for_selector('button:has-text("Next word")')
        page.click('button:has-text("Next word")')
        if i == 5: pause_through(page)
    finish_checks(page, 'clap')

    page.goto(BASE + 'child.html'); page.wait_for_selector('.gcard')
    check(page.locator('.sbox.got').count() == 5, 'five stickers filled after finishing all games')
    page.screenshot(path=f'{OUT}/10-child-home-stickers.png')

    # --- test (child) ---
    start('test')
    page.click('button:has-text("Start the test")')
    wrong_words = []
    for i in range(12):
        page.wait_for_selector('.typebox')
        word = page.evaluate("window.__spoken[window.__spoken.length-1]")
        check('right' not in page.inner_text('.card').lower() and 'wrong' not in page.inner_text('.card').lower(), 'test: no feedback shown') if i == 0 else None
        if i == 0: page.screenshot(path=f'{OUT}/11-test.png')
        if i in (3, 7):
            typed = {'famous': 'famus', 'equal': 'equil'}.get(word, word[:-1] + 'z'); wrong_words.append((word, typed))
            page.fill('.typebox', typed)
        elif i == 10:
            wrong_words.append((word, ''))
            page.click('button:has-text("not sure")')
            if i == 5: pause_through(page)
            continue
        else:
            page.fill('.typebox', word)
        page.keyboard.press('Enter')
        if i == 5: pause_through(page)
    page.wait_for_selector('.finish')
    summ = page.inner_text('.finish')
    check('9 out of 12' in summ, 'test summary shows 9 out of 12 (' + summ.split('\n')[2] + ')')
    page.screenshot(path=f'{OUT}/12-test-summary.png')

    # --- parent dashboard ---
    ctx2 = br.new_context(viewport={'width': 1280, 'height': 720}, accept_downloads=True)
    ctx2.add_init_script(SPY)
    page2 = ctx2.new_page()
    # same browser profile storage is per-context, so reuse first context for parent
    page.evaluate("sessionStorage.clear()")
    login(page, '1821')
    page.wait_for_url('**/parent.html')
    check(True, 'parent PIN opens dashboard')
    page.wait_for_selector('#words tbody tr')
    rows = page.eval_on_selector_all('#words tbody tr', "trs=>trs.map(r=>[...r.children].map(c=>c.textContent.trim()))")
    top = rows[0][0].replace('\u2022', '')
    miss_counts = [int(r[3]) for r in rows]
    check(miss_counts == sorted(miss_counts, reverse=True) and miss_counts[0] > 0, 'dashboard: words sorted by most missed ('+top+')')
    typos = page.inner_text('#typos')
    check(all(t in typos for _, t in wrong_words if t), 'dashboard: exact misspellings shown')
    check(page.locator('#practice .pcard').count() >= 3, 'dashboard: practice list')
    check('2026' not in page.inner_text('#tests') or '9 of 12' in page.inner_text('#tests'), 'dashboard: test score 9 of 12')
    check('9 of 12' in page.inner_text('#tests'), 'dashboard: test table')
    check('this laptop' in page.inner_text('.storage-note'), 'dashboard: local-only note')
    check(page.locator('#bygame tbody tr').count() >= 6, 'dashboard: by-game rows')
    page.screenshot(path=f'{OUT}/13-dashboard.png')
    page.screenshot(path=f'{OUT}/13-dashboard-full.png', full_page=True)
    n_results = page.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length")
    check(n_results == 12 * 6, f'localStorage has {n_results} records (expected 72)')
    rec = page.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).find(r=>r.type==='test')")
    check(all(k in rec for k in ['ts','week','type','word','typed','correct','tries']), 'record has required fields')
    with page.expect_download() as dl:
        page.click('#export')
    path = dl.value.path()
    lines = open(path).read().strip().split('\n')
    check(len(lines) == 73 and lines[0].startswith('ts,date,week'), 'CSV has header + 72 rows')
    # proctor mode
    page.click('#proctor')
    page.wait_for_url('**/game.html?s=spelling&g=test&proctor=1')
    page.click('button:has-text("Start the test")')
    page.wait_for_selector('.typebox')
    page.goto(BASE + 'parent.html')
    # clear with confirm: cancel first
    page.click('#clear'); page.click('#confirm-cancel')
    check(page.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length") == 72, 'clear cancel keeps results')
    page.click('#clear'); page.click('#confirm-ok')
    page.wait_for_selector('#empty:not([hidden])')
    check(page.evaluate("localStorage.getItem('ju_results_v1')") is None, 'clear removes results')
    # parent can view games
    page.goto(BASE + 'child.html'); page.wait_for_selector('.gcard')
    check(page.locator('.gcard').count() == 6, 'parent can open games home')


    # =====================================================================
    # v2: weekly flow (add_week.py), trend chart, keeps-missing, backup/restore, review game
    # =====================================================================
    tmp = tempfile.mkdtemp(prefix='ju-site-')
    shutil.copytree(os.path.join(ROOT, 'data'), os.path.join(tmp, 'data'))
    NEW = {  # word: (clue, riddle, syllables, sentence)
        'basic': ('Simple and plain', 'Not fancy, just ___.', 'ba-sic', 'I like a basic cheese pizza.'),
        'begin': ('To start', 'Ready, set, ___!', 'be-gin', 'We will begin the game now.'),
        'cover': ('Put on top', 'A lid is a ___ for a pot.', 'cov-er', 'Please cover the bowl with a lid.'),
        'dozen': ('Twelve of something', 'A ___ eggs is 12.', 'doz-en', 'We bought a dozen eggs.'),
        'happen': ('To take place', 'What will ___ next?', 'hap-pen', 'Tell me what will happen next.'),
        'lemon': ('A sour yellow fruit', 'Yellow and sour, make ___ juice.', 'lem-on', 'She squeezed a lemon into the water.'),
        'level': ('Flat, not tilted', 'A flat table is ___.', 'lev-el', 'The floor is level here.'),
        'music': ('Songs and tunes', 'You can hum it or play it.', 'mu-sic', 'We listen to music in the car.'),
        'never': ('Not ever', 'I will ___ give up!', 'nev-er', 'I will never give up.'),
        'open': ('Not closed', 'Door: closed or ___.', 'o-pen', 'Please open the door.'),
        'paper': ('You write on it', 'Pencil and ___.', 'pa-per', 'I drew on a sheet of paper.'),
        'robot': ('A machine that moves', 'Beep boop! I am a ___.', 'ro-bot', 'The robot can wave its arm.'),
    }
    clues_new = {'clue': {w: v[0] for w, v in NEW.items()}, 'riddle': {w: v[1] for w, v in NEW.items()},
                 'syl': {w: v[2] for w, v in NEW.items()}, 'sentence': {w: v[3] for w, v in NEW.items()},
                 'patterns': [], 'heart': [], 'syllable_colors': ['#1663d6', '#e06c00'], 'bonus': 'Never open the paper robot.',
                 'brain_breaks': False, 'progress': False, 'wrong': {}}
    cpath = os.path.join(tmp, 'clues.json'); json.dump(clues_new, open(cpath, 'w'))
    cmd = [sys.executable, os.path.join(ROOT, 'add_week.py'), '2026-11-02', *NEW.keys(), '--clues', cpath,
           '--subtitle', 'Test lesson', '--site', tmp]
    r1 = subprocess.run(cmd, capture_output=True, text=True)
    check(r1.returncode == 0, 'add_week.py runs (' + r1.stderr.strip()[:80] + ')')
    wk_file = os.path.join(tmp, 'data', 'week-2026-11-02.json')
    snap1 = open(wk_file).read(); idx1 = open(os.path.join(tmp, 'data', 'weeks.json')).read()
    r2 = subprocess.run(cmd, capture_output=True, text=True)
    idx = json.load(open(os.path.join(tmp, 'data', 'weeks.json')))['weeks']
    check(r2.returncode == 0 and open(wk_file).read() == snap1 and open(os.path.join(tmp, 'data', 'weeks.json')).read() == idx1
          and [e['id'] for e in idx] == ['2026-10-26', '2026-11-02'], 'add_week.py is idempotent (same files, no duplicate weeks.json line)')
    wkj = json.load(open(wk_file))
    schema_ok = (set(wkj) >= {'id', 'subject', 'title', 'label', 'source', 'syllableColors', 'patterns', 'bonus', 'words'} and len(wkj['words']) == 12
                 and wkj['label'] == 'Week of Nov 2' and wkj['source'] == 'Test lesson'
                 and all(set(w) == {'word', 'clue', 'riddle', 'sentence', 'syllables'} and ''.join(w['syllables']) == w['word']
                         and w['word'] in re.findall(r'[a-z]+', w['sentence'].lower()) and w['word'] == w['word'].lower() for w in wkj['words']))
    check(schema_ok, 'add_week.py output matches the site schema (same keys as week-2026-10-26.json)')
    old_keys = set(json.load(open(os.path.join(ROOT, 'data', 'week-2026-10-26.json'))))
    check(set(wkj) == old_keys, 'week file has the same top-level keys as the existing week')
    bad = subprocess.run(cmd[:3] + ['zzz', '--clues', cpath, '--subtitle', 'x', '--site', tmp], capture_output=True, text=True)
    check(bad.returncode != 0 and 'no clue' in bad.stderr, 'add_week.py refuses a word with no clue')
    check(json.load(open(os.path.join(tmp, 'data', 'weeks.json')))['weeks'] == idx, 'a refused run changes nothing')
    # update zip (with and without the zip program)
    sitecopy = os.path.join(tmp, 'site'); os.makedirs(sitecopy)
    shutil.copytree(os.path.join(tmp, 'data'), os.path.join(sitecopy, 'data'))
    os.makedirs(os.path.join(sitecopy, 'js')); shutil.copy(os.path.join(ROOT, 'js', 'storage.js'), os.path.join(sitecopy, 'js'))
    os.makedirs(os.path.join(sitecopy, 'tests')); open(os.path.join(sitecopy, 'tests', 'x.py'), 'w').write('x')
    shutil.copy(os.path.join(ROOT, 'make_update_zip.sh'), sitecopy)
    z1 = os.path.join(tmp, 'u1.zip')
    subprocess.run(['bash', os.path.join(sitecopy, 'make_update_zip.sh'), '-o', z1, 'js/storage.js'], check=True, capture_output=True)
    names = sorted(zipfile.ZipFile(z1).namelist())
    check(names == ['data/week-2026-10-26.json', 'data/week-2026-11-02.json', 'data/weeks.json', 'js/storage.js'], 'update zip: data/ + named file, paths preserved, nothing else')
    nozip = os.path.join(tmp, 'nozip'); os.makedirs(nozip)
    for c in ['bash', 'find', 'sed', 'sort', 'mktemp', 'rm', 'date', 'dirname', 'python3', 'cat']:
        src = shutil.which(c)
        if src: os.symlink(src, os.path.join(nozip, c))
    z2 = os.path.join(tmp, 'u2.zip')
    rz = subprocess.run([os.path.join(nozip, 'bash'), os.path.join(sitecopy, 'make_update_zip.sh'), '-o', z2, '--prefix', 'ju-learning-site', 'js/storage.js'],
                        capture_output=True, text=True, env={'PATH': nozip})
    check(rz.returncode == 0 and sorted(zipfile.ZipFile(z2).namelist()) == ['ju-learning-site/' + n for n in names], 'update zip works without the zip program (python fallback) and --prefix')

    # --- a fresh browser context: week fixtures served by route, no history yet ---
    ctx3 = br.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
    ctx3.add_init_script(SPY)
    ctx3.route('**/data/weeks.json', lambda route: route.fulfill(path=os.path.join(tmp, 'data', 'weeks.json'), content_type='application/json'))
    ctx3.route('**/data/week-2026-11-02.json', lambda route: route.fulfill(path=wk_file, content_type='application/json'))
    p3 = ctx3.new_page()
    p3.on('request', lambda r: foreign_requests.append(r.url) if not re.match(r'^(http://localhost:|data:|blob:)', r.url) else None)
    errors3 = []
    p3.on('pageerror', lambda e: errors3.append(str(e)))
    p3.on('console', lambda m: errors3.append(m.text) if m.type == 'error' else None)

    p3.goto(BASE + 'index.html')
    p3.evaluate("localStorage.setItem('ju_week', '2026-11-02')")
    login(p3, '0518'); p3.wait_for_url('**/child.html'); p3.wait_for_selector('.gcard')
    p3.wait_for_timeout(300)
    check(p3.locator('.gcard.review').count() == 0 and p3.locator('.gcard').count() == 6, 'review: hidden when there is no history')
    p3.goto(BASE + 'game.html?s=spelling&g=review')
    p3.wait_for_selector('#stage .card')
    check('Nothing to review' in p3.inner_text('#stage'), 'review: direct link with no history shows a calm message')

    # seed history: week Oct 26 (3 sessions), week Nov 2 (test + review)
    def rec(week, typ, word, correct, typed, sess, ts, typed_all=None):
        return {'id': sess + '-' + word + '-' + typ, 'ts': ts, 'session': sess, 'week': week, 'subject': 'spelling', 'type': typ, 'proctored': False,
                'word': word, 'typed': typed, 'typedAll': typed_all if typed_all is not None else [typed], 'correct': correct, 'tries': 1}
    w1 = list(WORDS); w2 = list(NEW)
    seed = []
    miss1 = {'famous': 'famus', 'equal': 'equil', 'half': ''}
    for i, w in enumerate(w1):
        seed.append(rec('2026-10-26', 'test', w, w not in miss1, miss1.get(w, w), 'S1', '2026-10-27T13:%02d:00.000Z' % i))
    for i, w in enumerate(w1):
        seed.append(rec('2026-10-26', 'unscramble', w, w != 'digit', 'digt' if w == 'digit' else w, 'S2', '2026-10-27T14:%02d:00.000Z' % i,
                        ['digt', 'digit'] if w == 'digit' else [w]))
    for i, w in enumerate(w1):
        seed.append(rec('2026-10-26', 'listen', w, w != 'famous', 'famus' if w == 'famous' else w, 'S3', '2026-10-27T15:%02d:00.000Z' % i,
                        ['famus', 'famous'] if w == 'famous' else [w]))
    miss2 = {'lemon', 'robot'}
    for i, w in enumerate(w2):
        seed.append(rec('2026-11-02', 'test', w, w not in miss2, 'lemmon' if w == 'lemon' else ('' if w == 'robot' else w), 'S4', '2026-11-03T13:%02d:00.000Z' % i))
    seed.append(rec('2026-11-02', 'review', 'famous', False, 'fameous', 'S5', '2026-11-03T14:00:00.000Z'))
    seed.append(rec('2026-11-02', 'review', 'half', False, 'haf', 'S5', '2026-11-03T14:01:00.000Z'))
    seed.append(rec('2026-11-02', 'review', 'half', True, 'half', 'S6', '2026-11-03T15:00:00.000Z'))
    seed.append(rec('2026-11-02', 'review', 'half', True, 'half', 'S7', '2026-11-03T16:00:00.000Z'))
    p3.evaluate("(s) => localStorage.setItem('ju_results_v1', JSON.stringify(s))", seed)
    p3.evaluate("localStorage.setItem('ju_stickers_v1', JSON.stringify({'2026-10-26': {'spelling:unscramble': '2026-10-27T14:20:00.000Z'}}))")

    # week 1 selected: no earlier week, so no review card even with history
    p3.evaluate("localStorage.setItem('ju_week', '2026-10-26')")
    p3.goto(BASE + 'child.html'); p3.wait_for_selector('.gcard'); p3.wait_for_timeout(300)
    check(p3.locator('.gcard.review').count() == 0, 'review: hidden for the first week (nothing earlier)')
    p3.evaluate("localStorage.setItem('ju_week', '2026-11-02')")

    # --- dashboard: trend, keeps missing ---
    p3.evaluate("sessionStorage.clear()")
    login(p3, '1821'); p3.wait_for_url('**/parent.html')
    p3.wait_for_selector('#trend svg')
    check(p3.locator('#trend svg').count() == 3, 'trend: three inline SVG charts (test score, words missed, games finished)')
    for key in ['test', 'missed', 'games']:
        check(p3.locator(f'#trend figure[data-chart="{key}"] rect.bar').count() == 2, f'trend: {key} chart has one bar per week')
    nums = p3.eval_on_selector_all('#trend-nums tbody tr', "trs=>trs.map(r=>[...r.children].map(c=>c.textContent.trim()))")
    check(nums == [['Oct 26', '75%', '4', '2'], ['Nov 2', '83%', '2', '0']], f'trend: numbers per week are right {nums}')
    check('75%' in p3.inner_text('#trend figure[data-chart="test"]') and '83%' in p3.inner_text('#trend figure[data-chart="test"]'), 'trend: value labels drawn on the chart')
    check('Review practice is not counted' in p3.inner_text('#trend-card'), 'trend: says review is not counted')
    p3.locator('#trend-card').scroll_into_view_if_needed()
    p3.locator('#trend-card').screenshot(path=f'{OUT2}/01-dashboard-trend.png')
    p3.screenshot(path=f'{OUT2}/01b-dashboard-top.png')
    keeps = p3.eval_on_selector_all('#keeps tbody tr', "trs=>trs.map(r=>[...r.children].map(c=>c.textContent.trim().replace(/\\u2022/g,'')))")
    check(keeps == [['famous', '2', 'fameous']], f'keeps-missing: only the word missed in 2 weeks, with its last typo (faded word hidden) {keeps}')
    p3.locator('#keeps').scroll_into_view_if_needed()
    p3.locator('#keeps').locator('xpath=ancestor::section').screenshot(path=f'{OUT2}/01c-keeps-missing.png')
    check('Review' in p3.inner_text('#bygame'), 'dashboard: Review shows up under games')
    check('this laptop' in p3.inner_text('.storage-note') and 'backup' in p3.inner_text('.storage-note'), 'dashboard: note says scores live on this laptop and mentions backups')

    # --- backup / restore ---
    with p3.expect_download() as dl:
        p3.click('#save-progress')
    bpath = dl.value.path()
    bj = json.load(open(bpath))
    check(bj['app'] == 'ju-learning' and len(bj['results']) == len(seed) and '2026-10-26' in bj['stickers'], f'backup: JSON has all {len(seed)} results and stickers')
    check(dl.value.suggested_filename.startswith('julianna-progress-') and dl.value.suggested_filename.endswith('.json'), 'backup: sensible file name')
    p3.click('#clear'); p3.click('#confirm-ok'); p3.wait_for_selector('#empty:not([hidden])')
    p3.click('#reset-stickers') if p3.locator('#reset-stickers').count() else None
    check(p3.evaluate("localStorage.getItem('ju_results_v1')") is None, 'backup: results cleared before restore')
    p3.set_input_files('#load-file', bpath)
    p3.wait_for_function(f"document.getElementById('backup-msg').textContent.includes('{len(seed)} new')")
    check(p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length") == len(seed), 'restore: every result is back')
    check(p3.evaluate("Object.keys(JSON.parse(localStorage.getItem('ju_stickers_v1'))['2026-10-26']).length") >= 1, 'restore: stickers merged back')
    p3.wait_for_selector('#keeps tbody tr')
    check(p3.locator('#trend svg').count() == 3 and 'famous' in p3.inner_text('#keeps').replace('\u2022', ''), 'restore: dashboard redraws from restored data')
    p3.set_input_files('#load-file', bpath)
    p3.wait_for_function("document.getElementById('backup-msg').textContent.includes('0 new')")
    check(p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length") == len(seed), 'restore twice: merged without duplicating')
    # a partial overlap: a backup with the same results under NEW ids but the same session/word/time, plus one new record
    extra = dict(seed[0]); extra['id'] = 'other-id'
    fresh = rec('2026-11-02', 'listen', 'music', True, 'music', 'S9', '2026-11-04T10:00:00.000Z')
    mixed = os.path.join(tmp, 'mixed.json')
    json.dump({'app': 'ju-learning', 'version': 1, 'results': [extra, fresh, seed[1]], 'stickers': {}}, open(mixed, 'w'))
    p3.set_input_files('#load-file', mixed)
    p3.wait_for_function("document.getElementById('backup-msg').textContent.includes('1 new')")
    check(p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length") == len(seed) + 1, 'restore: only the genuinely new record was added')
    junk = os.path.join(tmp, 'junk.json'); open(junk, 'w').write('{"hello": 1}')
    p3.set_input_files('#load-file', junk)
    p3.wait_for_function("document.getElementById('backup-msg').textContent.includes('not a progress backup')")
    check(p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).length") == len(seed) + 1, 'restore: a wrong file changes nothing')
    p3.evaluate("() => { const a = JSON.parse(localStorage.getItem('ju_results_v1')); localStorage.setItem('ju_results_v1', JSON.stringify(a.filter(x => x.session !== 'S9'))); }")

    # --- review game ---
    p3.goto(BASE + 'child.html'); p3.wait_for_selector('.gcard')
    p3.wait_for_selector('.gcard.review')
    check(p3.locator('.gcard').count() == 7 and p3.locator('.sbox').count() == 5, 'review: card appears with history (7 cards, still 5 sticker boxes)')
    p3.screenshot(path=f'{OUT2}/02a-child-home-review.png')
    pick = p3.evaluate("""async () => { const wk = await JU.weeks.loadAll('spelling'); const rs = await JU.storage.getResults();
        return JU.review.pick(wk[1], wk, rs).map(i => i.w.word + ':' + i.mech); }""")
    words_in = [x.split(':')[0] for x in pick]
    check(set(words_in) == {'famous', 'digit', 'equal'} and 3 <= len(pick) <= 8 and words_in.count('famous') == 2 and len(set(words_in)) <= 6,
          f'review: picks earlier misses (not faded "half", not this week\'s words), 1-2 steps each {pick}')
    check(not set(words_in) & set(NEW), 'review: no current-week words')
    p3.click('.gcard.review')
    p3.wait_for_selector('.card.center')
    check('A little review' in p3.inner_text('#stage'), 'review: calm intro')
    p3.click('button:has-text("look again")')
    steps = 0; shot = False
    while True:
        p3.wait_for_selector('.tile, .typebox, .finish')
        if p3.locator('.finish').count(): break
        steps += 1
        check(p3.locator('.round-tag').count() == 0 and p3.locator('.pause').count() == 0, 'review: no round tag or pause') if steps == 1 else None
        if p3.locator('.tile').count():
            clue = p3.inner_text('.clue').replace('Clue: ', '').strip()
            word = BY_CLUE[clue]
            ok, _ = all_lower(p3, '.tile'); check(ok, 'review: unscramble tiles lowercase') if steps <= 2 else None
            no_case_leak(p3, word, 'review') if steps <= 2 else None
            if not shot:
                for ch in word[:2]: p3.keyboard.type(ch)
                p3.screenshot(path=f'{OUT2}/02-review-game.png'); shot = True
                for _ in range(2): p3.keyboard.press('Backspace')
            for ch in word: p3.keyboard.type(ch)
            p3.click('button:has-text("Check my word")')
            p3.wait_for_selector('button:has-text("Next word")'); p3.click('button:has-text("Next word")')
        else:
            word = p3.evaluate("window.__spoken.slice().reverse().find(t => t.indexOf(' ')===-1)")
            p3.fill('.typebox', word if steps != 2 else 'wrongg'); p3.keyboard.press('Enter')
            if steps == 2:
                check('Good try' in p3.inner_text('.msg'), 'review: a miss is answered gently')
                p3.fill('.typebox', word); p3.keyboard.press('Enter')
            p3.wait_for_selector('button:has-text("Next word")'); p3.click('button:has-text("Next word")')
        if steps > 12: break
    check(steps == len(pick), f'review: played every step ({steps})')
    check('Nice review' in p3.inner_text('.finish') and p3.locator('.sticker-pop').count() == 1, 'review: calm finish with a star')
    check(not re.search(r'progress|timer|brain', p3.content().lower().replace('progressive', '')), 'review: no progress bar, timer or brain break on the page')
    rv = p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).filter(r => r.type === 'review' && r.session !== 'S5' && r.session !== 'S6' && r.session !== 'S7')")
    check(len(rv) == steps and all(r['week'] == '2026-11-02' for r in rv), 'review: results saved as type review under the current week')
    check(p3.evaluate("Object.keys(JSON.parse(localStorage.getItem('ju_stickers_v1'))).length") == 1 and
          'spelling:review' not in p3.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('ju_stickers_v1')))"), 'review: does not add a sticker box')
    # misses made in review count for the keeps-missing list; a clean second play of a word fades it
    p3.evaluate("sessionStorage.clear()")
    login(p3, '1821'); p3.wait_for_url('**/parent.html'); p3.wait_for_selector('#keeps tbody tr')
    typos = p3.inner_text('#typos')
    check('wrongg' in typos, 'dashboard: review misspelling appears with the other misspellings')
    check('famous' in p3.inner_text('#keeps').replace('\u2022', ''), 'dashboard: keeps-missing still lists famous')
    ctx3.close()
    check(not errors3, 'v2: no console/page errors: ' + '; '.join(errors3[:3]))
    check(not foreign_requests, 'no network requests leave this site: ' + ', '.join(foreign_requests[:3]))
    shutil.rmtree(tmp, ignore_errors=True)

    check(not errors, 'no console/page errors: ' + '; '.join(errors[:3]))
    br.close()
print('FAILS:', fails)
sys.exit(1 if fails else 0)
