"""End-to-end check. Needs: python3 -m http.server 8765 (run in the repo root) and playwright
(pip install playwright; uses system Chrome). Run: python3 tests/e2e.py
Screenshots go to /workspace/ju-learning-previews/ (override with PREVIEWS env var)."""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8765/')
OUT = os.environ.get('PREVIEWS', '/workspace/ju-learning-previews')
os.makedirs(OUT, exist_ok=True)
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

    check(not errors, 'no console/page errors: ' + '; '.join(errors[:3]))
    br.close()
print('FAILS:', fails)
sys.exit(1 if fails else 0)
