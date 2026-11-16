"""End-to-end check. Needs: python3 -m http.server 8765 (run in the repo root) and playwright
(pip install playwright; uses system Chrome). Run: python3 tests/e2e.py
Screenshots of the older spelling checks go to /workspace/ju-learning-previews/
(override with PREVIEWS). Math Fact Flash Card shots go to /opt/cursor/artifacts/.

Spelling clues and words are read from data/weeks.json and every week file, so the
suite follows whichever week the site opens on. PINs are read from js/config.js.
"""
import json, os, re, shutil, subprocess, sys, tempfile, time, zipfile
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'http://localhost:8765/')
OUT = os.environ.get('PREVIEWS', '/workspace/ju-learning-previews')
os.makedirs(OUT, exist_ok=True)
OUT2 = os.path.join(OUT, 'v2')
os.makedirs(OUT2, exist_ok=True)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
foreign_requests = []

def pins_from_config():
    text = open(os.path.join(ROOT, 'js', 'config.js')).read()
    block = re.search(r'pins:\s*\{([^}]+)\}', text)
    if not block:
        raise SystemExit('could not read pins from js/config.js')
    return dict(re.findall(r"(julianna|dorian|family|parent):\s*'(\d+)'", block.group(1)))

def load_spelling_weeks():
    idx = json.load(open(os.path.join(ROOT, 'data', 'weeks.json')))
    weeks = []
    for entry in idx['weeks']:
        if entry.get('subject', 'spelling') != 'spelling':
            continue
        weeks.append(json.load(open(os.path.join(ROOT, 'data', entry['file']))))
    weeks.sort(key=lambda w: w['id'])
    return weeks

WEEKS = load_spelling_weeks()
NEWEST_ID = WEEKS[-1]['id']
OCT = next(w for w in WEEKS if w['id'] == '2026-10-26')
OCT_WORDS = [w['word'] for w in OCT['words']]
WORDS = {}
BY_CLUE = {}
for wk in WEEKS:
    for w in wk['words']:
        WORDS[w['word']] = w
        BY_CLUE[w['clue'].strip()] = w['word']
PINS = pins_from_config()
fails = []
def check(cond, label):
    print(('PASS ' if cond else 'FAIL ') + label)
    if not cond: fails.append(label)

SPY = """
window.__spoken = [];
window.__speechMark = 0;
const orig = window.speechSynthesis;
window.speechSynthesis.speak = function(u){ window.__spoken.push(u.text); setTimeout(()=>{ u.onend && u.onend(); }, 5); };
"""

def last_spoken(page):
    return page.evaluate("window.__spoken[window.__spoken.length-1]")

def login(page, pin, who='julianna', keyboard=False):
    page.goto(BASE + 'index.html')
    if who == 'parent':
        page.click('#grownup')
    else:
        page.click('button[data-who="%s"]' % who)
    page.wait_for_selector('#pin-view:not([hidden])')
    if keyboard:
        page.keyboard.type(pin)
    else:
        for d in pin: page.click('#pin-view .pad[data-k="%s"]' % d)

def stick_week(page, week_id, newest=None):
    page.evaluate("""([id, newest]) => localStorage.setItem('ju_week', JSON.stringify({id: id, newest: newest}))""", [week_id, newest or NEWEST_ID])

def pull_word(page, extra=1):
    """Wait until extra new spoken utterances exist and the latest one is a single word."""
    page.wait_for_function("""(extra) => {
      const s = window.__spoken || [];
      const n = window.__speechMark || 0;
      if (s.length < n + extra) return false;
      const t = s[s.length - 1];
      return !!(t && String(t).indexOf(' ') === -1);
    }""", arg=extra, timeout=12000)
    word = page.evaluate("() => window.__spoken[window.__spoken.length - 1]")
    page.evaluate("() => { window.__speechMark = (window.__spoken || []).length; }")
    return word

def mark_speech(page):
    page.evaluate("() => { window.__speechMark = (window.__spoken || []).length; }")

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

ART = os.environ.get('ARTIFACTS', '/opt/cursor/artifacts')
os.makedirs(ART, exist_ok=True)

def save_shot(page, name, selector=None):
    """Write a screenshot, retrying if the artifact folder is briefly busy."""
    dest = os.path.join(ART, name)
    fd, tmp = tempfile.mkstemp(suffix='.png')
    os.close(fd)
    try:
        if selector:
            page.locator(selector).first.screenshot(path=tmp)
        else:
            page.screenshot(path=tmp)
        data = open(tmp, 'rb').read()
    finally:
        try: os.remove(tmp)
        except OSError: pass
    last = None
    for attempt in range(6):
        try:
            with open(dest, 'wb') as f:
                f.write(data)
            return
        except OSError as e:
            last = e
            time.sleep(0.4 * (attempt + 1))
    raise last

def flash_fact(page):
    return page.evaluate("""() => {
      const f = document.getElementById('flash-fact');
      if (!f) return null;
      const a = Number(f.dataset.a), b = Number(f.dataset.b), op = f.dataset.op;
      const answer = op === '+' ? a + b : a - b;
      const opch = op === '+' ? '+' : '\\u2212';
      return {
        a: a, b: b, op: op, key: f.dataset.key, answer: answer,
        text: (f.textContent || '').replace(/\\s+/g, ''),
        expect: String(a) + opch + String(b),
        keys: Object.keys(f.dataset),
        shakes: document.getElementById('flash-card').dataset.shakes,
        score: document.getElementById('flash-score').textContent.trim(),
        typed: document.getElementById('flash-typed').textContent.trim()
      };
    }""")

def flash_press(page, digits):
    for ch in str(digits):
        page.keyboard.press(ch)

def flash_pad(page, digits):
    for ch in str(digits):
        page.click('.flash-pad .pad[data-k="%s"]' % ch)

def flash_wait_key(page, key):
    page.wait_for_function("(k) => document.getElementById('flash-fact') && document.getElementById('flash-fact').dataset.key === k", arg=key)

def install_flash_seq(page):
    page.evaluate("""() => {
      const seq = [
        {a:9, op:'+', b:9, answer:18, key:'9+9'},
        {a:7, op:'+', b:7, answer:14, key:'7+7'},
        {a:6, op:'+', b:4, answer:10, key:'6+4'},
        {a:8, op:'+', b:5, answer:13, key:'8+5'},
        {a:14, op:'-', b:7, answer:7, key:'14-7'},
        {a:10, op:'-', b:4, answer:6, key:'10-4'},
        {a:13, op:'-', b:6, answer:7, key:'13-6'},
        {a:5, op:'+', b:5, answer:10, key:'5+5'}
      ];
      let i = 0;
      JU.mathFacts.next = function (state) {
        const f = seq[Math.min(i, seq.length - 1)];
        i++;
        const addN = ((state && state.addN) || 0) + (f.op === '+' ? 1 : 0);
        const subN = ((state && state.subN) || 0) + (f.op === '-' ? 1 : 0);
        return { fact: f, addN: addN, subN: subN, prev: f.key };
      };
    }""")

def open_flash(page):
    login(page, PINS['julianna'])
    page.wait_for_url('**/child.html')
    page.goto(BASE + 'game.html?s=math&g=flash')
    page.wait_for_selector('#flash-start')

def answer_current(page, how='pad'):
    fact = flash_fact(page)
    if how == 'pad':
        flash_pad(page, fact['answer'])
    else:
        flash_press(page, fact['answer'])
    return fact

KINDER_FAKE = r"""
window.__JU_LETTERS_OPEN = true;
window.__spoken = [];
window.__speechMark = 0;
window.speechSynthesis.speak = function(u){ window.__spoken.push(u.text); setTimeout(function(){ u.onend && u.onend(); }, 5); };
function FakeAudio() {
  var listeners = {};
  return { preload: '', src: '', playbackRate: 1, currentTime: 0, volume: 1,
    addEventListener: function(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: function() {},
    pause: function() {},
    play: function() { setTimeout(function(){ (listeners.ended || []).forEach(function(fn){ fn(); }); }, 5); return Promise.resolve(); } };
}
window.Audio = FakeAudio;
"""

def kinder_heard_has_number(page, n):
    return page.evaluate("""(n) => {
      const word = JU.kinder.numberWord(n);
      const heard = (JU.speech.heard || []).slice(window.__heardMark || 0).join('\\n').toLowerCase();
      const tokens = heard.match(/[a-z]+(?:-[a-z]+)?/g) || [];
      const digit = new RegExp('(?:^|\\\\D)' + n + '(?:\\\\D|$)').test(heard);
      return tokens.indexOf(word) >= 0 || heard.indexOf('[num-' + n + ']') >= 0 || digit;
    }""", n)

def kinder_open(page, act, level=None):
    page.evaluate("""(pair) => {
      if (!pair) { localStorage.removeItem('ju_dorian_kinder_v1'); return; }
      const raw = localStorage.getItem('ju_dorian_kinder_v1');
      const k = raw ? JSON.parse(raw) : { answers: [], rounds: [], stars: [], levels: {} };
      k.answers = k.answers || []; k.rounds = k.rounds || []; k.stars = k.stars || []; k.levels = k.levels || {};
      k.levels[pair[0]] = pair[1];
      localStorage.setItem('ju_dorian_kinder_v1', JSON.stringify(k));
    }""", [act, level] if level else None)
    page.goto(BASE + 'kinder.html?a=' + act)
    try:
        page.wait_for_selector('[data-start]', timeout=20000)
    except Exception:
        check(False, act + ' loads: ' + page.inner_text('#kinder')[:180])
        return False
    oops = page.locator('text=Oops!').count()
    check(oops == 0, act + ' level %s loads' % (level or 1))
    return oops == 0

def mark_heard(page):
    """Only the words spoken for this question count. Earlier rounds stay in the log."""
    page.evaluate("window.__heardMark = (window.JU && JU.speech && JU.speech.heard || []).length")

def kinder_play(page, hear=False, before=None):
    mark_heard(page)
    page.click('[data-start]')
    n = 0
    saw_go = False
    while n < 14:
        page.wait_for_selector('.k-ready, [data-done-title]', timeout=20000)
        if page.locator('[data-done-title]').count():
            break
        if not saw_go:
            saw_go = page.locator('.k-ready [data-go]').count() == 1
            if before:
                before()
        btn = page.locator('[data-right="1"]')
        btn.click()
        if hear:
            page.wait_for_function("""() => {
              const b = document.querySelector('[data-right="1"]');
              return b && b.getAttribute('data-heard') === '1';
            }""")
            btn.click()
        page.wait_for_selector('[data-next]:not([disabled])', timeout=10000)
        page.click('[data-next]:not([disabled])')
        n += 1
    return n, saw_go

def kinder_nov16(br):
    """Dorian's week of Nov 16: new games, 10-question rounds, fast level-up, answers hidden until he taps."""
    ctx = br.new_context(viewport={'width': 1024, 'height': 768})
    ctx.add_init_script(KINDER_FAKE)
    page = ctx.new_page()
    page.emulate_media(reduced_motion='reduce')
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    login(page, PINS['dorian'], who='dorian')
    page.wait_for_url('**/dorian.html')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_selector('#kid-pick:not([hidden]) [data-open="reading"]')
    check(page.locator('#kid-pick [data-act="warmup"]').is_visible(), 'home: warm-up is one big button')
    for name in ['reading', 'math', 'move', 'stars']:
        word = page.locator('[data-open="%s"] .kid-word' % name).inner_text().strip()
        check(page.locator('[data-open="%s"]' % name).is_visible() and word == word[:1].upper() + word[1:] and ' ' not in word, 'home group is one word: ' + word)
    check(page.locator('#kid-hello').is_visible() and page.locator('#hear').is_visible() and page.locator('#bye').is_visible(), 'home keeps the greeting, hear-again, and bye')
    check(not page.locator('#kid-kinder [data-act="hundred"]').is_visible(), 'home does not list every game')
    check(page.locator('#kid-starpath').is_hidden(), 'home does not show the star list')
    save_shot(page, 'kinder_home_icons.png', 'main.kid-home')

    page.click('[data-open="reading"]')
    page.wait_for_url('**g=reading**')
    page.wait_for_selector('.kid-game[data-game="sight"]:not([hidden])')
    for act in ['letters', 'build', 'sight', 'rhyme', 'rsort', 'who', 'look']:
        check(page.locator('.kid-game[data-game="%s"]' % act).is_visible(), 'reading shelf shows ' + act)
        check(page.locator('[data-mini-path="%s"] .k-stop' % act).count() >= 1, 'reading stars sit with ' + act)
    for act in ['hundred', 'count', 'push']:
        check(not page.locator('.kid-game[data-game="%s"]' % act).is_visible(), 'reading shelf hides ' + act)
    check(page.locator('#kid-starpath').is_hidden(), 'reading shelf is not the long star list')
    save_shot(page, 'kinder_reading_icons.png', 'main.kid-home')
    page.click('[data-say="Home"]')
    page.wait_for_selector('#kid-pick:not([hidden])')

    page.goto(BASE + 'dorian.html?g=math')
    page.wait_for_selector('.kid-game[data-game="hundred"]:not([hidden])')
    for act in ['count', 'add', 'more', 'take', 'shapes', 'sort', 'graph', 'cal', 'hundred']:
        check(page.locator('.kid-game[data-game="%s"]' % act).is_visible(), 'math shelf shows ' + act)
        check(page.locator('[data-mini-path="%s"] .k-stop' % act).count() >= 1, 'math stars sit with ' + act)
    check(not page.locator('.kid-game[data-game="sight"]').is_visible(), 'math shelf hides reading games')
    save_shot(page, 'kinder_math_icons.png', 'main.kid-home')

    page.goto(BASE + 'dorian.html?g=move')
    page.wait_for_selector('.kid-game[data-game="push"]:not([hidden])')
    check(page.locator('.kid-game:not([hidden])').count() == 1, 'move shelf is only push or pull')

    page.goto(BASE + 'dorian.html?g=stars')
    page.wait_for_selector('#kid-starpath:not([hidden]) [data-path="hundred"]')
    for act in ['rsort', 'who', 'sort', 'graph', 'cal', 'hundred', 'push', 'take', 'sight']:
        check(page.locator('#kid-starpath [data-path="%s"]' % act).count() == 1, 'stars view keeps ' + act)
    check(not page.locator('.kid-game[data-game="hundred"]').is_visible(), 'stars view is the path, not the game tiles')
    save_shot(page, 'kinder_stars_icons.png', 'main.kid-home')
    page.set_viewport_size({'width': 1024, 'height': 768})

    # Pure plans: 10 questions, unlock numbers, build -ug levels, sight focus.
    page.goto(BASE + 'kinder.html?a=build')
    page.wait_for_selector('[data-start]')
    planned = page.evaluate("""async () => {
      const cvc = await (await fetch('data/kinder/cvc.json')).json();
      const letters = await (await fetch('data/kinder/letters.json')).json();
      const plan = lv => JU.kinderGames.build.plan({ cvc, letters, answers: [], level: lv });
      const brief = items => items.filter(i => i.kind === 'switch').map(i => ({ id: i.id, n: i.tiles.length, pos: i.pos }));
      let l6last = false;
      for (let i = 0; i < 40 && !l6last; i++) l6last = brief(plan(6)).some(s => s.pos === 2);
      const games = {};
      ['rsort', 'who', 'sort', 'graph', 'cal', 'hundred'].forEach(id => {
        games[id] = [1, 2, 3].map(lv => {
          try { return JU.kinderGames[id].plan({ level: lv, answers: [] }).length; }
          catch (e) { return String(e && e.message || e); }
        });
      });
      const sight = await JU.kinder.loadSight();
      return {
        games,
        unlock: JU.kinder.UNLOCK,
        l5: { n: plan(5).length, sw: brief(plan(5)) },
        l6: { n: plan(6).length, sw: brief(plan(6)) },
        l6last,
        l7: { n: plan(7).length, sw: brief(plan(7)) },
        l8: { n: plan(8).length, sw: brief(plan(8)) },
        focus: sight.focusWeek,
        focusWords: sight.words.filter(w => w.focus).map(w => w.word),
        they: sight.words.some(w => w.word === 'they')
      };
    }""")
    check(planned['unlock'] == {'goodShare': 0.8, 'roundsInARow': 2, 'rightInARow': 5}, 'K.UNLOCK is still 2 good rounds or 5 in a row')
    for gid, lengths in planned['games'].items():
        check(lengths == [10, 10, 10], gid + ' plans 10 questions at every level: ' + str(lengths))
    check(planned['focus'] == '2026-11-16' and planned['focusWords'] == ['one', 'two', 'three'] and planned['they'], 'sight focus is one, two, three and earlier weeks stay')
    check(planned['l5']['n'] == 10 and [s['id'] for s in planned['l5']['sw']] == ['dog-log', 'log-fog', 'dog-fog'] and all(s['n'] == 3 for s in planned['l5']['sw']), 'build level 5 word switch is unchanged')
    check(planned['l6']['n'] == 10 and len(planned['l6']['sw']) == 5 and all(s['n'] == 4 for s in planned['l6']['sw']) and planned['l6last'] and not any(s['id'].endswith('ug') for s in planned['l6']['sw']), 'build level 6 stays the harder switch, not -ug')
    check(planned['l7']['n'] == 10 and [s['id'] for s in planned['l7']['sw']] == ['bug-hug', 'hug-rug', 'bug-rug'] and all(s['n'] == 3 and s['pos'] == 0 for s in planned['l7']['sw']), 'build level 7 is bug, hug, rug')
    check(planned['l8']['n'] == 10 and len(planned['l8']['sw']) == 5 and all(s['n'] == 4 for s in planned['l8']['sw']) and any(s['pos'] == 2 for s in planned['l8']['sw']), 'build level 8 is the harder -ug top')

    def shot(name):
        page.evaluate('window.scrollTo(0, 0)')
        save_shot(page, name, '.k-screen')

    def level_up(act, hear=False, first=None):
        if not kinder_open(page, act):
            return
        def before():
            if first:
                first()
        n, saw_go = kinder_play(page, hear=hear, before=before)
        check(n == 10, act + ' round is 10 questions (%s)' % n)
        check(saw_go, act + ' shows the Go cue')
        page.wait_for_selector('[data-opened="1"]')
        check(page.locator('[data-by]').get_attribute('data-by') == 'run', act + ' levels up from 5 right in a row')
        saved = page.evaluate("""(a) => {
          const k = JSON.parse(localStorage.getItem('ju_dorian_kinder_v1'));
          const round = k.rounds.filter(r => r.activity === a).pop();
          return { level: k.levels[a], items: round.items, clean: round.clean };
        }""", act)
        check(saved['level'] == 2 and saved['items'] == 10 and saved['clean'] == 10, act + ' saved level 2 after a perfect round: ' + str(saved))

    def rhyme_ok():
        word = page.locator('[data-rsort]').get_attribute('data-rsort')
        check(word in ['bug', 'hug', 'rug', 'mug', 'tug', 'sun', 'run', 'bun', 'fun'], 'rhyme sort picture is an -ug or -un word')
        check(page.locator('[data-pick]').count() == 2, 'rhyme sort has two picture bins')
        shot('kinder_rhyme_sort.png')

    def who_ok():
        check(page.locator('[data-who="easy"]').count() == 1 and page.locator('[data-top]').count() == 0, 'who is it starts with one character')
        shot('kinder_who_character.png')

    def sort_ok():
        check(page.locator('[data-sort="size"]').count() == 1, 'sort starts with size')
        labels = page.locator('.k-sortbin').evaluate_all('els => els.map(e => e.getAttribute("aria-label"))')
        pick = page.locator('[data-right="1"]').get_attribute('data-pick')
        said = page.evaluate("""(name) => {
          const heard = (JU.speech.heard || []).slice(window.__heardMark || 0).join('\\n').toLowerCase();
          const tokens = heard.match(/[a-z]+(?:-[a-z]+)?/g) || [];
          return tokens.indexOf(name) >= 0;
        }""", pick)
        check(labels == ['a bin', 'a bin', 'a bin'] and not said, 'sort does not say or label the size before the tap')
        shot('kinder_sort_size.png')

    def graph_ok():
        n = int(page.locator('[data-right="1"]').get_attribute('data-n'))
        pics = page.locator('[data-ask-row] .k-obj').count()
        board = page.locator('[data-graph-board]').inner_text()
        check(page.locator('[data-graph="howmany"]').count() == 1 and pics == n, 'picture graph row matches the number card')
        check(page.locator('[data-count-out]').inner_text().strip() == '0' and not re.search(r'\d', board), 'picture graph shows no count before the tap')
        check(not kinder_heard_has_number(page, n), 'picture graph does not say the count before the tap')
        shot('kinder_picture_graph.png')

    def cal_ok():
        ans = page.locator('[data-hear-card][data-right="1"]').get_attribute('data-day')
        said = page.evaluate("""(day) => {
          const heard = (JU.speech.heard || []).slice(window.__heardMark || 0).join('\\n').toLowerCase();
          const tokens = heard.match(/[a-z]+(?:-[a-z]+)?/g) || [];
          return tokens.indexOf(day) >= 0 || heard.indexOf('[word-' + day + ']') >= 0;
        }""", ans)
        strip = page.locator('.k-week').inner_text()
        check(page.locator('[data-mark-today="1"]').count() == 1 and ans.capitalize() not in strip and not said, 'calendar asks without saying yesterday or tomorrow')
        shot('kinder_calendar.png')

    def miss_ok():
        n = int(page.locator('[data-right="1"]').get_attribute('data-n'))
        seq = page.locator('.k-seq').inner_text()
        shown = [int(x) for x in re.findall(r'\d+', seq)]
        check('?' in seq and n not in shown and page.locator('[data-miss="easy"]').count() == 1, 'missing number stays blank (%s shown %s)' % (n, shown))
        check(not kinder_heard_has_number(page, n), 'missing number is not spoken before the tap')
        shot('kinder_missing_number.png')

    level_up('rsort', first=rhyme_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-rhyme-sort="hard"]')
    check(page.locator('[data-top="1"]').count() >= 1, 'rhyme sort has a harder top')

    level_up('who', first=who_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-who="hard"]')
    check(page.locator('[data-top="1"]').count() >= 1, 'who is it has a harder top')
    shot('kinder_top_level.png')

    level_up('sort', first=sort_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-sort="shape"]')
    shape = page.locator('[data-right="1"]').get_attribute('data-pick')
    shape_said = page.evaluate("""(name) => {
      const heard = (JU.speech.heard || []).slice(window.__heardMark || 0).join('\\n').toLowerCase();
      const tokens = heard.match(/[a-z]+(?:-[a-z]+)?/g) || [];
      return tokens.indexOf(name) >= 0;
    }""", shape)
    check(not shape_said, 'shape sort does not say the shape before the tap')
    shot('kinder_sort_shape.png')
    kinder_open(page, 'sort', 3)
    page.click('[data-start]')
    page.wait_for_selector('.k-ready [data-top="1"]')
    check(page.locator('[data-sort]').count() == 1, 'sort top level mixes size and shape')

    level_up('graph', first=graph_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-graph="more"]')
    counts = page.evaluate("""() => [...document.querySelectorAll('[data-graph-board] .k-grow')].map(r => r.querySelectorAll('.k-gpic, .k-obj').length)""")
    board = page.locator('[data-graph-board]').inner_text()
    check(len(counts) == 2 and len(set(counts)) == 2 and not re.search(r'\d', board), 'which has more shows pictures only')
    check(all(not kinder_heard_has_number(page, c) for c in counts), 'which has more does not say a count')
    kinder_open(page, 'graph', 3)
    page.click('[data-start]')
    page.wait_for_selector('.k-ready [data-top="1"]')
    check(page.locator('[data-graph-board] .k-grow').count() == 3, 'picture graph top has three close rows')

    level_up('cal', hear=True, first=cal_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-cal="hard"]')
    ans = page.locator('[data-hear-card][data-right="1"]').get_attribute('data-day')
    said = page.evaluate("""(day) => {
      const heard = (JU.speech.heard || []).slice(window.__heardMark || 0).join('\\n').toLowerCase();
      const tokens = heard.match(/[a-z]+(?:-[a-z]+)?/g) || [];
      return tokens.indexOf(day) >= 0 || heard.indexOf('[word-' + day + ']') >= 0;
    }""", ans)
    check(page.locator('[data-top="1"]').count() >= 1 and page.locator('[data-mark-today="0"]').count() == 1 and not said, 'calendar top does not mark today or say the answer')

    level_up('hundred', first=miss_ok)
    mark_heard(page)
    page.click('[data-again]')
    page.wait_for_selector('.k-ready [data-miss="hard"]')
    n = int(page.locator('[data-right="1"]').get_attribute('data-n'))
    shown = [int(x) for x in re.findall(r'\d+', page.locator('.k-seq').inner_text())]
    check(page.locator('[data-top="1"]').count() >= 1 and n not in shown and not kinder_heard_has_number(page, n), 'missing number top stays blank and quiet')

    # Add it up is already his adding game. One question: the total is not said or written before he taps.
    kinder_open(page, 'add')
    mark_heard(page)
    page.click('[data-start]')
    page.wait_for_selector('.k-ready [data-right="1"]')
    total = int(page.locator('[data-right="1"]').get_attribute('data-n'))
    groups = page.locator('.k-groups').inner_text()
    check(page.locator('.k-ready [data-go]').count() == 1, 'add it up shows the Go cue')
    check(not re.search(r'\d', groups) and page.locator('[data-count-out]').inner_text().strip() == '0', 'add it up shows pictures, not the total')
    if page.locator('[data-q]').count():
        check(page.locator('[data-q]').inner_text().strip() == '?', 'add it up keeps the equals box blank')
    check(not kinder_heard_has_number(page, total), 'add it up does not say the total')

    # Build a word, level 7: the -ug switch is the second question.
    kinder_open(page, 'build', 7)
    page.click('[data-start]')
    page.wait_for_selector('.k-ready')
    if page.locator('[data-switch]').count() == 0:
        word = page.locator('.k-wordpic').get_attribute('aria-label')
        for ch in word:
            page.locator('.k-tile[data-tile="%s"]:not([disabled])' % ch).first.click()
        page.wait_for_selector('[data-next]:not([disabled])')
        page.click('[data-next]:not([disabled])')
        page.wait_for_selector('.k-ready [data-switch]')
    check(page.locator('[data-switch]').get_attribute('data-switch') == 'bug-hug', 'build a word asks bug to hug')
    check(page.locator('.k-ready [data-go]').count() == 1, 'build a word shows the Go cue')
    shot('kinder_build_ug_switch.png')

    # Record sounds lists the new sight words and the new build words. Earlier weeks stay.
    login(page, PINS['parent'], who='parent')
    page.wait_for_url('**/parent.html')
    page.goto(BASE + 'parent.html?p=dorian')
    page.wait_for_selector('#view-dorian:not([hidden]) [data-rec-group="sight"]')
    for key in ['sight', 'words', 'week16']:
        page.locator('[data-rec-group="%s"]' % key).evaluate('el => { el.open = true; }')
    page.wait_for_selector('[data-rec-item="sight-one"]')
    for cid in ['sight-one', 'sight-two', 'sight-three', 'sight-they', 'word-hug', 'word-rug', 'word-mug', 'word-gum', 'word-tug', 'word-bug', 'word-run', 'word-bun', 'word-fun', 'word-hum', 'word-sunday', 'word-tuesday']:
        check(page.locator('[data-rec-item="%s"]' % cid).count() == 1, 'record sounds lists ' + cid)
    check(page.locator('#kinder-preview-hundred').count() == 1 and page.locator('#kinder-preview-rsort').count() == 1, 'parent page can preview the new games')

    # A version 5 backup still loads, and a version 7 backup never lowers a level. The file we write is still version 7.
    page.evaluate("""async () => {
      localStorage.removeItem('ju_dorian_kinder_v1');
      const v5 = { app: 'ju-learning', version: 5, results: [], profiles: { dorian: { kinder: {
        answers: [{ id: 'v5-count', ts: '2026-01-01T00:00:00.000Z', session: 's', activity: 'count', item: '3', correct: true }],
        rounds: [] } } } };
      await JU.storage.importAll(v5);
      await JU.storage.importAll(v5);
      const mid = JSON.parse(localStorage.getItem('ju_dorian_kinder_v1'));
      mid.levels = Object.assign({}, mid.levels, { build: 5 });
      localStorage.setItem('ju_dorian_kinder_v1', JSON.stringify(mid));
      const v7 = { app: 'ju-learning', version: 7, results: [], profiles: { dorian: { kinder: {
        answers: [
          { id: 'v5-count', ts: '2026-01-01T00:00:00.000Z', session: 's', activity: 'count', item: '3', correct: true },
          { id: 'v7-new', ts: '2026-02-01T00:00:00.000Z', session: 's2', activity: 'hundred', item: 'miss-48', correct: true },
          { id: 'nope', ts: '2026-02-02T00:00:00.000Z', session: 's3', activity: 'not-a-game', item: 'x', correct: true }
        ],
        rounds: [],
        levels: { build: 2, letters: 3, hundred: 2 }
      } } } };
      await JU.storage.importAll(v7);
      window.__backup = JSON.parse(localStorage.getItem('ju_dorian_kinder_v1'));
      window.__exported = await JU.storage.exportAll({ recordings: false });
    }""")
    backup = page.evaluate("window.__backup")
    exported = page.evaluate("window.__exported")
    ids = [a.get('id') for a in backup.get('answers', [])]
    check(ids.count('v5-count') == 1 and 'v7-new' in ids and 'nope' not in ids, 'v5 and v7 backups restore without duplicating or keeping unknown games')
    check(backup['levels'].get('build') == 5 and backup['levels'].get('letters') == 3 and backup['levels'].get('hundred') == 2, 'a backup never lowers a level: ' + str(backup.get('levels')))
    check(exported.get('version') == 7 and exported.get('profiles', {}).get('dorian', {}).get('kinder', {}).get('levels', {}).get('build') == 5, 'new backups stay version 7')
    check(not errs, 'kindergarten week: no page errors: ' + '; '.join(errs[:3]))
    ctx.close()

def flash_cards(br):
    ctx = br.new_context(viewport={'width': 1024, 'height': 768})
    ctx.add_init_script(SPY)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('page:' + str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    open_flash(page)
    pool = page.evaluate("""() => {
      const all = JU.mathFacts.all();
      const bad = all.filter(f => !JU.mathFacts.valid(f));
      let state = { prev: '', addN: 0, subN: 0 };
      let repeats = 0, badDraw = 0, add = 0, sub = 0, prev = '';
      for (let i = 0; i < 240; i++) {
        const n = JU.mathFacts.next(state);
        state = { prev: n.prev, addN: n.addN, subN: n.subN };
        const f = n.fact;
        if (f.key === prev) repeats++;
        prev = f.key;
        if (!JU.mathFacts.valid(f) || f.a < 2 || f.b < 2 || f.answer < 2 || f.answer > 18) badDraw++;
        if (f.op === '+') add++; else sub++;
      }
      const half = Math.abs(add - sub);
      return { n: all.length, bad: bad.length, repeats: repeats, badDraw: badDraw, add: add, sub: sub, half: half };
    }""")
    check(pool['n'] > 40 and pool['bad'] == 0 and pool['badDraw'] == 0 and pool['repeats'] == 0, 'flash: every fact is in range, no 0/1, no negative, no immediate repeat ' + str(pool))
    check(pool['add'] > 80 and pool['sub'] > 80 and pool['half'] < 8, 'flash: about half addition and half subtraction ' + str(pool))

    page.evaluate('window.__JU_FLASH_MS = 60000')
    install_flash_seq(page)
    page.click('#flash-start')
    page.wait_for_selector('#flash-fact')
    fact = flash_fact(page)
    check(fact['key'] == '9+9' and fact['text'] == fact['expect'] and 'answer' not in fact['keys'] and '=' not in fact['text'] and fact['typed'] == '', 'flash: problem only, answer not shown')
    box = page.locator('.flash-pad .pad[data-k="5"]').bounding_box()
    check(box and box['width'] >= 60 and box['height'] >= 60, 'flash: number pad tap target is large (%s)' % (box,))

    flash_press(page, '1')
    mid = flash_fact(page)
    check(mid['key'] == '9+9' and mid['typed'] == '1' and mid['score'] == '0', 'flash: a short answer waits')
    page.keyboard.press('Backspace')
    check(flash_fact(page)['typed'] == '', 'flash: Backspace clears a digit')
    flash_press(page, '99')
    wrong = flash_fact(page)
    check(wrong['key'] == '9+9' and wrong['typed'] == '' and wrong['score'] == '0' and int(wrong['shakes']) >= 1, 'flash: wrong answer shakes, clears, and does not score')
    check('Try again' in page.inner_text('#flash-note'), 'flash: a miss stays on the same card')

    flash_pad(page, '18')
    flash_wait_key(page, '7+7')
    check(flash_fact(page)['score'] == '1', 'flash: a correct pad answer advances')
    flash_press(page, '14')
    flash_wait_key(page, '6+4')
    check(flash_fact(page)['score'] == '2', 'flash: a correct keyboard answer advances')
    flash_press(page, '10')
    flash_wait_key(page, '9+9')
    check(flash_fact(page)['score'] == '3', 'flash: a missed fact comes back later in the round')
    before_shakes = int(flash_fact(page)['shakes'])
    flash_press(page, '1')
    page.keyboard.press('Enter')
    held = flash_fact(page)
    check(held['key'] == '9+9' and held['typed'] == '' and held['score'] == '3' and int(held['shakes']) > before_shakes, 'flash: Enter on a short wrong answer shakes and stays')

    # timer ends a round even when nothing else is typed
    page.goto(BASE + 'game.html?s=math&g=flash')
    page.wait_for_selector('#flash-start')
    page.evaluate('window.__JU_FLASH_MS = 1200')
    page.click('#flash-start')
    page.wait_for_selector('#flash-end', timeout=8000)
    check('You got 0 right' in page.inner_text('#flash-end-score'), 'flash: timer ends the round')
    check(page.locator('#flash-new-best:not([hidden])').count() == 0, 'flash: a zero score is not a new best')

    page.goto(BASE + 'game.html?s=math&g=flash')
    page.wait_for_selector('#flash-start')
    page.evaluate('window.__JU_FLASH_MS = 4000')
    page.click('#flash-start')
    page.wait_for_selector('#flash-fact')
    answer_current(page, 'pad')
    page.wait_for_selector('#flash-end', timeout=8000)
    check('You got 1 right' in page.inner_text('#flash-end-score'), 'flash: score counts only right answers')
    check(page.locator('#flash-new-best:not([hidden])').inner_text() == 'New best!', 'flash: first score says new best')
    check('Your best: 1' in page.inner_text('#flash-end-best'), 'flash: end screen shows the best')

    page.goto(BASE + 'game.html?s=math&g=flash')
    page.wait_for_selector('#flash-best-line')
    check('Your best: 1' in page.inner_text('#flash-best-line'), 'flash: best score persists on the start screen')
    page.evaluate('window.__JU_FLASH_MS = 900')
    page.click('#flash-start')
    page.wait_for_selector('#flash-end', timeout=8000)
    check('You got 0 right' in page.inner_text('#flash-end-score'), 'flash: a later round can score zero')
    check(page.locator('#flash-new-best:not([hidden])').count() == 0, 'flash: tying or missing the best does not say new best')
    check('Your best: 1' in page.inner_text('#flash-end-best'), 'flash: best stays when the round is lower')

    page.goto(BASE + 'game.html?s=math&g=flash')
    page.wait_for_selector('#flash-start')
    page.evaluate('window.__JU_FLASH_MS = 5000')
    page.click('#flash-start')
    page.wait_for_selector('#flash-fact')
    missed = flash_fact(page)
    wrong_digits = '9' if str(missed['answer']) != '9' else '8'
    if len(str(missed['answer'])) == 1:
        flash_press(page, wrong_digits)
    else:
        flash_press(page, wrong_digits * len(str(missed['answer'])))
    page.wait_for_function("() => Number(document.getElementById('flash-card').dataset.shakes) >= 1")
    flash_press(page, missed['answer'])
    page.wait_for_function("() => document.getElementById('flash-score').textContent.trim() === '1'")
    second = flash_fact(page)
    flash_press(page, second['answer'])
    page.wait_for_selector('#flash-end', timeout=8000)
    check('You got 2 right' in page.inner_text('#flash-end-score'), 'flash: beating the best counts both right answers')
    check(page.locator('#flash-new-best:not([hidden])').count() == 1, 'flash: beating the best says new best')

    page.reload()
    page.wait_for_selector('#flash-best-line')
    check('Your best: 2' in page.inner_text('#flash-best-line'), 'flash: best survives a reload')

    page.evaluate("sessionStorage.clear()")
    login(page, PINS['parent'], who='parent')
    page.wait_for_url('**/parent.html')
    page.wait_for_selector('#math-rounds tbody tr')
    best = page.get_attribute('#math-julianna', 'data-best')
    rounds = page.get_attribute('#math-julianna', 'data-rounds')
    check(best == '2' and int(rounds) >= 3, 'parent: best score and rounds are shown (%s, %s rounds)' % (best, rounds))
    check('2' in page.inner_text('#math-rounds'), 'parent: a recent round lists how many were correct')
    tricky = page.inner_text('#math-tricky')
    check(str(missed['a']) in tricky and str(missed['b']) in tricky, 'parent: trickiest facts include a missed fact')

    with page.expect_download() as dl:
        page.click('#save-progress')
    bpath = dl.value.path()
    bj = json.load(open(bpath))
    check(bj.get('version') == 7 and isinstance(bj.get('math'), dict) and len(bj['math'].get('rounds') or []) == int(rounds), 'backup: version 7 includes the flash-card rounds')
    saved_rounds = bj['math']['rounds']
    page.evaluate("localStorage.removeItem('ju_math_v1')")
    page.set_input_files('#load-file', bpath)
    page.wait_for_function("() => (document.getElementById('backup-msg').textContent || '').indexOf('Math flash cards') !== -1")
    back = page.evaluate("() => JSON.parse(localStorage.getItem('ju_math_v1')).rounds.length")
    check(back == len(saved_rounds), 'backup: loading the file puts the rounds back')

    compat = page.evaluate("""async () => {
      const before = (await JU.storage.getMath()).rounds.length;
      const v5 = await JU.storage.importAll({
        app: 'ju-learning', version: 5, exportedAt: '2026-01-01T00:00:00.000Z',
        results: [{ id: 'v5-flash-compat', ts: '2026-01-01T00:00:00.000Z', session: 'V5', week: '2026-10-26', subject: 'spelling', type: 'test', word: 'total', typed: 'total', typedAll: ['total'], correct: true, tries: 1 }],
        stickers: {}, hints: [], flags: [], money: { done: {}, answers: [] }
      });
      const mid = (await JU.storage.getMath()).rounds.length;
      const v7 = await JU.storage.importAll({
        app: 'ju-learning', version: 7, exportedAt: '2026-01-02T00:00:00.000Z',
        results: [{ id: 'v7-flash-compat', ts: '2026-01-02T00:00:00.000Z', session: 'V7', week: '2026-10-26', subject: 'spelling', type: 'test', word: 'equal', typed: 'equal', typedAll: ['equal'], correct: true, tries: 1 }],
        stickers: {}, hints: [], flags: [], money: { done: {}, answers: [] }, profiles: {}
      });
      const after = (await JU.storage.getMath()).rounds.length;
      return { before: before, mid: mid, after: after, v5added: v5.added, v5math: v5.math, v7added: v7.added, v7math: v7.math };
    }""")
    check(compat['v5math'] is None and compat['v7math'] is None and compat['before'] == compat['mid'] == compat['after'] and compat['v5added'] == 1 and compat['v7added'] == 1,
          'backup: a v5 or v7 file with no math section still loads and keeps the rounds ' + str(compat))
    check(not errors, 'flash: no console/page errors: ' + '; '.join(errors[:3]))
    ctx.close()

    # tablet screenshots: start, a card, a wrong answer, a new best, and the grown-up section
    for orient, vp in (('landscape', {'width': 1024, 'height': 768}), ('portrait', {'width': 768, 'height': 1024})):
        c = br.new_context(viewport=vp)
        c.add_init_script(SPY)
        pg = c.new_page()
        open_flash(pg)
        save_shot(pg, 'flash_start_%s.png' % orient)
        pg.evaluate('window.__JU_FLASH_MS = 60000')
        install_flash_seq(pg)
        pg.click('#flash-start')
        pg.wait_for_selector('#flash-fact')
        save_shot(pg, 'flash_card_%s.png' % orient)
        flash_press(pg, '99')
        pg.wait_for_function("() => Number(document.getElementById('flash-card').dataset.shakes) >= 1")
        save_shot(pg, 'flash_wrong_%s.png' % orient)
        box = pg.locator('.flash-pad .pad[data-k="5"]').bounding_box()
        check(box and box['width'] >= 60 and box['height'] >= 60, 'flash: %s pad stays a large tap target (%s)' % (orient, box))
        pg.goto(BASE + 'game.html?s=math&g=flash')
        pg.wait_for_selector('#flash-start')
        pg.evaluate('window.__JU_FLASH_MS = 2500')
        pg.click('#flash-start')
        pg.wait_for_selector('#flash-fact')
        answer_current(pg, 'pad')
        pg.wait_for_selector('#flash-end', timeout=8000)
        check('New best!' in pg.inner_text('#flash-end'), 'flash: %s end screen has a new best' % orient)
        save_shot(pg, 'flash_new_best_%s.png' % orient)
        pg.evaluate('sessionStorage.clear()')
        login(pg, PINS['parent'], who='parent')
        pg.wait_for_url('**/parent.html')
        pg.wait_for_selector('#math-rounds tbody tr')
        pg.locator('#math-julianna').scroll_into_view_if_needed()
        save_shot(pg, 'flash_parent_%s.png' % orient)
        c.close()
    check(True, 'flash: screenshots saved under ' + ART)

def passage_tokens(text):
    text = text.replace('\r\n', '\n').strip()
    out = []
    for block in re.split(r'\n\s*\n', text):
        out.extend([w for w in block.split() if w])
    return out

def norm_tok(token):
    return re.sub(r'^[^a-z0-9]+|[^a-z0-9]+$', '', token.lower())

def rs_overflow(page, label):
    over = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(over <= 1, label + ' fits without sideways scrolling (%s px)' % over)

def reading_speed(br):
    pack = json.load(open(os.path.join(ROOT, 'data', 'reading', 'passages.json')))
    passages = pack['passages']
    check(len(passages) == 5 and pack['benchmarks'] == {'start': 57, 'school': 99, 'goal': 112}, 'reading: 5 passages and the 57 / 99 / 112 benchmarks')
    spelling = set()
    for week in WEEKS:
        for item in week['words']:
            spelling.add(item['word'].lower())
    used = set()
    for p in passages:
        toks = passage_tokens(p['text'])
        check(150 <= len(toks) <= 250, 'reading: %s is %s words' % (p['id'], len(toks)))
        check(len(p.get('questions') or []) == 3, 'reading: %s has 3 questions' % p['id'])
        for q in p['questions']:
            check(q.get('answer') in (0, 1, 2) and len(q.get('choices') or []) == 3, 'reading: %s question is 3 choices' % p['id'])
        for tok in toks:
            w = norm_tok(tok)
            if w in spelling:
                used.add(w)
    check(len(used) >= 12, 'reading: passages use spelling words where they fit (%s)' % len(used))

    ctx = br.new_context(viewport={'width': 1024, 'height': 768}, accept_downloads=True)
    ctx.add_init_script(SPY)
    page = ctx.new_page()
    errors = []
    foreign = []
    page.on('pageerror', lambda e: errors.append('page:' + str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: foreign.append(r.url) if not re.match(r'^(http://localhost:|data:|blob:)', r.url) else None)

    login(page, PINS['julianna'])
    page.wait_for_url('**/child.html')
    check(page.locator('#reading-speed-card').count() == 1, 'reading: tile is on Julianna\'s page')
    sib = page.evaluate("""() => {
      const r = document.getElementById('reading-speed-card');
      return r && r.previousElementSibling ? r.previousElementSibling.id : '';
    }""")
    check(sib == 'math-flash-card', 'reading: tile sits next to Math Fact Flash Cards')
    check('Reading Speed' in page.inner_text('#reading-speed-card'), 'reading: tile is titled Reading Speed')

    page.goto(BASE + 'game.html?s=reading&g=speed')
    page.wait_for_selector('#rs-picker')
    logic = page.evaluate("""() => {
      const base = 60000 / 60;
      return {
        plain: JU.reading.delayMs('island', 60),
        comma: JU.reading.delayMs('shore,', 60),
        end: JU.reading.delayMs('arrived.', 60),
        longw: JU.reading.delayMs('leftover', 60),
        focus: JU.reading.focusParts('island').focus,
        full: JU.reading.score(107, 3, 60000),
        stars: [JU.reading.stars(57), JU.reading.stars(88), JU.reading.stars(99), JU.reading.stars(0)]
      };
    }""")
    check(logic['plain'] == 1000 and logic['comma'] == 1450 and logic['end'] == 1800 and logic['longw'] == 1350, 'reading: extra pause at a comma, a sentence end, and a long word')
    check(logic['focus'] == 'l' and logic['full']['wpm'] == 104 and logic['full']['accuracy'] == 97, 'reading: focus letter and full-minute score')
    check(logic['stars'] == [1, 2, 3, 0], 'reading: stars at 57, 88, 99, and a zero')

    info = page.evaluate("""async () => {
      const pack = await JU.reading.load();
      const cards = [...document.querySelectorAll('.rs-pcard')].map(c => ({
        id: c.dataset.id, words: Number(c.dataset.words), best: c.dataset.best, text: c.textContent
      }));
      return { cards: cards, byId: Object.fromEntries(pack.passages.map(p => [p.id, p.wordCount])), legend: document.querySelector('.rs-legend').textContent };
    }""")
    check(len(info['cards']) == 5, 'reading: picker shows 5 passages')
    for card in info['cards']:
        check(card['words'] == info['byId'].get(card['id']) and 'Not played yet' in card['text'] and card['best'] == '', 'reading: %s shows its word count and no score yet' % card['id'])
    check('Start 57' in info['legend'] and 'School 99' in info['legend'] and 'Goal 112' in info['legend'], 'reading: legend marks 57, 99, and 112')

    page.click('#rs-open-progress')
    page.wait_for_selector('#rs-chart')
    empty = page.evaluate("""() => ({
      refs: [...document.querySelectorAll('[data-ref]')].map(el => el.dataset.ref + ':' + el.dataset.wpm + ':' + (el.getAttribute('stroke-dasharray') || '')),
      points: document.querySelectorAll('.rs-point').length,
      empty: (document.getElementById('rs-chart-empty') || {}).textContent || ''
    })""")
    check(empty['refs'] == ['start:57:6 5', 'school:99:6 5', 'goal:112:6 5'] and empty['points'] == 0 and 'read-aloud' in empty['empty'], 'reading: empty chart still draws the three dashed lines')
    page.click('#rs-to-passages')
    page.wait_for_selector('#rs-picker')

    page.evaluate('window.__JU_RS_FLASH_FACTOR = 30')
    page.click('.rs-pcard[data-id="wolf-island"]')
    page.wait_for_selector('#rs-word')
    flash = page.evaluate("""() => {
      const word = document.getElementById('rs-word');
      const token = JU.reading.current().tokens[Number(word.dataset.i)];
      const parts = JU.reading.focusParts(token);
      const slider = document.getElementById('rs-wpm');
      return {
        i: word.dataset.i, focus: document.getElementById('rs-focus').textContent, expect: parts.focus,
        min: slider.min, max: slider.max, step: slider.step, value: slider.value
      };
    }""")
    check(flash['i'] == '0' and flash['focus'] == flash['expect'] and flash['focus'] != '', 'reading: first word shows its focus letter in the fixed spot')
    check(flash['min'] == '40' and flash['max'] == '200' and flash['step'] == '5' and flash['value'] == '60', 'reading: speed slider is 40 to 200, step 5, starting at 60')
    page.click('#rs-pause')
    page.wait_for_function("() => document.getElementById('rs-flash').dataset.paused === '1'")
    held = page.get_attribute('#rs-word', 'data-i')
    page.wait_for_timeout(400)
    check(page.get_attribute('#rs-word', 'data-i') == held and page.locator('#rs-bar-fill').count() == 1, 'reading: pause holds the word and the progress bar stays')
    page.click('#rs-back')
    check(page.get_attribute('#rs-word', 'data-i') == '0', 'reading: back a phrase stays on the first word')
    page.evaluate('JU.reading.flash.jump(18)')
    page.wait_for_function("() => document.getElementById('rs-word').dataset.i === '18'")
    page.click('#rs-back')
    page.wait_for_function("() => Number(document.getElementById('rs-word').dataset.i) < 18")
    check(page.get_attribute('#rs-flash', 'data-paused') == '1', 'reading: back a phrase moves earlier and stays paused')
    page.evaluate("""() => {
      const s = document.getElementById('rs-wpm');
      s.value = '75';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    check(page.inner_text('#rs-speed-num') == '75', 'reading: the slider shows 75')
    page.click('#rs-to-passages')
    page.wait_for_selector('#rs-picker')
    page.evaluate('window.__JU_RS_FLASH_FACTOR = 0')
    page.click('.rs-pcard[data-id="wolf-island"]')
    page.wait_for_selector('#rs-flash-done', timeout=45000)
    check('Smooth!' in page.inner_text('#rs-flash-done') and page.locator('#rs-nudge:not([hidden])').count() == 0, 'reading: one smooth flash does not suggest a faster speed yet')
    page.click('#rs-flash-again')
    page.wait_for_selector('#rs-flash-done', timeout=45000)
    check('80' in page.inner_text('#rs-nudge') and page.locator('#rs-nudge:not([hidden])').count() == 1, 'reading: two smooth flashes suggest 5 wpm faster')
    page.evaluate('window.__JU_RS_FLASH_FACTOR = 30')
    page.click('#rs-flash-again')
    page.wait_for_selector('#rs-flash')
    check('80' in page.inner_text('#rs-nudge'), 'reading: the suggestion is waiting on the next flash')
    page.evaluate('window.__JU_RS_Q_MS = 0')
    page.click('#rs-to-read')
    page.wait_for_selector('#rs-read')
    page.wait_for_function("() => Number(document.getElementById('rs-time').dataset.elapsed) > 200")
    e1 = int(page.get_attribute('#rs-time', 'data-elapsed'))
    page.click('.rs-tok[data-i="4"]')
    page.wait_for_timeout(400)
    e2 = int(page.get_attribute('#rs-time', 'data-elapsed'))
    check(e2 > e1 + 200 and page.locator('.rs-tok[data-i="4"].is-miss').count() == 1, 'reading: a missed word turns red and the timer keeps going')
    page.click('.rs-tok[data-i="4"]')
    check(page.locator('.rs-tok[data-i="4"].is-miss').count() == 0, 'reading: tapping a red word undoes it')
    page.click('.rs-tok[data-i="6"]')
    page.click('#rs-done')
    page.wait_for_function("() => document.getElementById('rs-time').dataset.stopped === '1'")
    frozen = page.get_attribute('#rs-time', 'data-elapsed')
    score_ms = int(page.get_attribute('#rs-time', 'data-score-ms'))
    page.wait_for_timeout(350)
    check(page.get_attribute('#rs-time', 'data-elapsed') == frozen and page.get_attribute('#rs-time', 'data-early') == '1', 'reading: Done stops the clock early')
    check(page.locator('#rs-results').count() == 0 and 'Tap the last word' in page.inner_text('#rs-prompt') and 'Time' not in page.inner_text('#rs-prompt'), 'reading: the score waits until the last word is tapped')
    page.click('.rs-tok[data-i="20"]')
    page.wait_for_selector('#rs-results')
    ui = page.evaluate("""() => {
      const r = document.getElementById('rs-results');
      return { wpm: Number(r.dataset.wpm), accuracy: Number(r.dataset.accuracy), words: Number(r.dataset.words), misses: Number(r.dataset.misses), elapsed: Number(r.dataset.elapsed), early: r.dataset.early };
    }""")
    exp = page.evaluate("(ms) => JU.reading.score(21, 1, ms)", score_ms)
    check(ui['words'] == 21 and ui['misses'] == 1 and ui['early'] == '1' and ui['wpm'] == exp['wpm'] and ui['accuracy'] == exp['accuracy'] and ui['elapsed'] == exp['elapsed'], 'reading: early finish scales to one minute (%s vs %s)' % (ui, exp))
    check(page.locator('#rs-new-best:not([hidden])').count() == 1 and '%' in page.inner_text('#rs-accuracy'), 'reading: accuracy and a new best show up')
    check('Question 1 of 3' in page.inner_text('#rs-q-kicker'), 'reading: comprehension starts at question 1')
    check(page.locator('.rs-choice[data-answer]').count() == 0, 'reading: answer keys are not in the page')
    answers = page.evaluate("() => JU.reading.current().questions.map(q => q.answer)")
    picks = [answers[0], 0 if answers[1] != 0 else 1, answers[2]]
    for n, pick in enumerate(picks):
        page.click('#rs-q .rs-choice[data-i="%d"]' % pick)
        if n < 2:
            page.wait_for_function("(k) => { const el = document.getElementById('rs-q-kicker'); return !!(el && el.textContent.indexOf('Question ' + k) !== -1); }", arg=str(n + 2))
    page.wait_for_function("() => { const el = document.getElementById('rs-comp'); return !!(el && !el.hidden && el.textContent.indexOf('2/3') !== -1); }")
    check(page.get_attribute('#rs-results', 'data-comp') == '2/3', 'reading: comprehension scores 2 of 3')
    page.click('#rs-see-progress')
    page.wait_for_selector('#rs-chart .rs-point')
    chart = page.evaluate("""() => ({
      goal: document.querySelector('[data-ref="goal"]').dataset.wpm,
      fresh: document.getElementById('rs-chart-new').hidden,
      points: document.querySelectorAll('.rs-point').length
    })""")
    check(chart['goal'] == '112' and chart['fresh'] is False and chart['points'] >= 1, 'reading: progress chart has the goal line and a new best')

    page.evaluate('sessionStorage.clear()')
    login(page, PINS['parent'], who='parent')
    page.wait_for_url('**/parent.html')
    page.wait_for_selector('#reading-julianna[data-latest]')
    parent = page.evaluate("""async () => {
      const d = await JU.storage.getReading();
      const rounds = d.rounds.slice().sort((a, b) => a.ts < b.ts ? 1 : -1);
      const last = rounds[0];
      const best = d.rounds.reduce((m, r) => Math.max(m, r.wpm), 0);
      const box = document.getElementById('reading-julianna');
      return {
        latest: box.dataset.latest, best: box.dataset.best, togo: box.dataset.togo,
        accuracy: box.dataset.accuracy, comp: box.dataset.comp, flash: box.dataset.flash,
        rounds: box.dataset.rounds, miss: box.dataset.miss,
        expectLatest: String(last.wpm), expectBest: String(best), expectTo: String(Math.max(0, 112 - last.wpm)),
        expectAcc: String(last.accuracy), expectComp: last.compCorrect + '/' + last.compTotal,
        expectFlash: String(d.flashWpm), expectRounds: String(d.rounds.length),
        expectMiss: last.missWords[0] || '',
        table: document.getElementById('reading-misses').textContent
      };
    }""")
    check(parent['latest'] == parent['expectLatest'] and parent['best'] == parent['expectBest'] and parent['togo'] == parent['expectTo'], 'reading: parent card shows latest, best, and how many to go')
    check(parent['accuracy'] == parent['expectAcc'] and parent['comp'] == '2/3' and parent['flash'] == '75' and parent['rounds'] == '1', 'reading: parent card shows accuracy, comprehension, and flash speed')
    check(parent['miss'] and parent['miss'] in parent['table'], 'reading: parent card lists a missed word')

    with page.expect_download() as dl:
        page.click('#save-progress')
    bpath = dl.value.path()
    bj = json.load(open(bpath))
    check(bj.get('version') == 7 and isinstance(bj.get('reading'), dict) and len(bj['reading'].get('rounds') or []) == 1 and bj['reading'].get('flashWpm') == 75, 'backup: version 7 includes the reading round and flash speed')
    check(bj['reading']['rounds'][0].get('compCorrect') == 2, 'backup: the reading round keeps the comprehension score')
    page.evaluate("localStorage.removeItem('ju_reading_v1')")
    page.set_input_files('#load-file', bpath)
    page.wait_for_function("() => (document.getElementById('backup-msg').textContent || '').indexOf('Reading speed') !== -1")
    restored = page.evaluate("""async () => {
      const d = await JU.storage.getReading();
      const last = d.rounds.slice().sort((a, b) => a.ts < b.ts ? 1 : -1)[0];
      return { n: d.rounds.length, flash: d.flashWpm, comp: last.compCorrect, wpm: last.wpm };
    }""")
    check(restored['n'] == 1 and restored['flash'] == 75 and restored['comp'] == 2 and restored['wpm'] == ui['wpm'], 'backup: loading the file puts the reading round back')

    compat = page.evaluate("""async () => {
      const before = await JU.storage.getReading();
      const v5 = await JU.storage.importAll({
        app: 'ju-learning', version: 5, exportedAt: '2026-01-01T00:00:00.000Z',
        results: [{ id: 'v5-reading-compat', ts: '2026-01-01T00:00:00.000Z', session: 'V5', week: '2026-10-26', subject: 'spelling', type: 'test', word: 'minutes', typed: 'minutes', typedAll: ['minutes'], correct: true, tries: 1 }],
        stickers: {}, hints: [], flags: [], money: { done: {}, answers: [] }
      });
      const mid = await JU.storage.getReading();
      const v7 = await JU.storage.importAll({
        app: 'ju-learning', version: 7, exportedAt: '2026-01-02T00:00:00.000Z',
        results: [{ id: 'v7-reading-compat', ts: '2026-01-02T00:00:00.000Z', session: 'V7', week: '2026-10-26', subject: 'spelling', type: 'test', word: 'decided', typed: 'decided', typedAll: ['decided'], correct: true, tries: 1 }],
        stickers: {}, hints: [], flags: [], money: { done: {}, answers: [] }, profiles: {}
      });
      const after = await JU.storage.getReading();
      return {
        n: [before.rounds.length, mid.rounds.length, after.rounds.length],
        flash: [before.flashWpm, mid.flashWpm, after.flashWpm],
        v5reading: v5.reading, v7reading: v7.reading, v5added: v5.added, v7added: v7.added
      };
    }""")
    check(compat['v5reading'] is None and compat['v7reading'] is None and compat['n'] == [1, 1, 1] and compat['flash'] == [75, 75, 75] and compat['v5added'] == 1 and compat['v7added'] == 1,
          'backup: a v5 or v7 file with no reading section still loads and keeps the rounds')

    page.evaluate('sessionStorage.clear()')
    login(page, PINS['julianna'])
    page.wait_for_url('**/child.html')
    page.goto(BASE + 'game.html?s=reading&g=speed')
    page.wait_for_selector('#rs-picker')
    page.evaluate('window.__JU_RS_READ_MS = 700; window.__JU_RS_FLASH_FACTOR = 30')
    page.click('.rs-pcard[data-id="wolf-island"]')
    page.wait_for_selector('#rs-to-read')
    page.click('#rs-to-read')
    page.wait_for_function("() => document.getElementById('rs-time') && document.getElementById('rs-time').dataset.stopped === '1'", timeout=8000)
    check(page.locator('#rs-results').count() == 0 and 'Time' in page.inner_text('#rs-prompt'), 'reading: a finished minute asks for the last word before it scores')
    page.click('.rs-tok[data-i="10"]')
    page.wait_for_selector('#rs-results')
    minute = page.evaluate("""() => {
      const r = document.getElementById('rs-results');
      return { wpm: r.dataset.wpm, accuracy: r.dataset.accuracy, words: r.dataset.words, misses: r.dataset.misses, elapsed: r.dataset.elapsed, early: r.dataset.early };
    }""")
    check(minute == {'wpm': '11', 'accuracy': '100', 'words': '11', 'misses': '0', 'elapsed': '60000', 'early': '0'}, 'reading: a full minute is not scaled up (%s)' % minute)
    check(not errors, 'reading: no console/page errors: ' + '; '.join(errors[:4]))
    check(not foreign, 'reading: no network requests leave this site: ' + ', '.join(foreign[:3]))
    ctx.close()

    seed = {
        'rounds': [
            {'id': 'seed-1', 'ts': '2026-10-01T15:00:00.000Z', 'passageId': 'wolf-island', 'passageTitle': 'Wolf Island', 'wpm': 57, 'accuracy': 90, 'wordsRead': 60, 'misses': 3, 'seconds': 60, 'early': False, 'missWords': ['habitat', 'leftover', 'burrows'], 'compCorrect': 2, 'compTotal': 3},
            {'id': 'seed-2', 'ts': '2026-10-08T15:00:00.000Z', 'passageId': 'marsh-home', 'passageTitle': 'A Home in the Marsh', 'wpm': 68, 'accuracy': 91, 'wordsRead': 70, 'misses': 2, 'seconds': 60, 'early': False, 'missWords': ['habitat', 'leftover'], 'compCorrect': 3, 'compTotal': 3},
            {'id': 'seed-3', 'ts': '2026-10-15T15:00:00.000Z', 'passageId': 'tide-pool', 'passageTitle': 'Life in the Tide Pool', 'wpm': 79, 'accuracy': 92, 'wordsRead': 80, 'misses': 2, 'seconds': 60, 'early': False, 'missWords': ['habitat', 'burrows'], 'compCorrect': 2, 'compTotal': 3},
            {'id': 'seed-4', 'ts': '2026-10-22T15:00:00.000Z', 'passageId': 'marsh-home', 'passageTitle': 'A Home in the Marsh', 'wpm': 88, 'accuracy': 94, 'wordsRead': 90, 'misses': 2, 'seconds': 60, 'early': False, 'missWords': ['habitat', 'leftover'], 'compCorrect': 3, 'compTotal': 3},
            {'id': 'seed-5', 'ts': '2026-10-29T15:00:00.000Z', 'passageId': 'tide-pool', 'passageTitle': 'Life in the Tide Pool', 'wpm': 94, 'accuracy': 95, 'wordsRead': 96, 'misses': 0, 'seconds': 60, 'early': False, 'missWords': [], 'compCorrect': 3, 'compTotal': 3},
            {'id': 'seed-6', 'ts': '2026-11-05T15:00:00.000Z', 'passageId': 'wolf-island', 'passageTitle': 'Wolf Island', 'wpm': 96, 'accuracy': 96, 'wordsRead': 100, 'misses': 0, 'seconds': 60, 'early': False, 'missWords': [], 'compCorrect': 2, 'compTotal': 3},
            {'id': 'seed-7', 'ts': '2026-11-12T15:00:00.000Z', 'passageId': 'food-chain', 'passageTitle': 'Food Chain Friends', 'wpm': 99, 'accuracy': 97, 'wordsRead': 102, 'misses': 0, 'seconds': 60, 'early': False, 'missWords': [], 'compCorrect': 3, 'compTotal': 3}
        ],
        'flashWpm': 60, 'smoothStreak': 2, 'smoothAt': 60
    }
    for tag, vp in (('phone', {'width': 390, 'height': 844}), ('tablet', {'width': 1024, 'height': 768})):
        c = br.new_context(viewport=vp)
        c.add_init_script(SPY)
        pg = c.new_page()
        pg.goto(BASE + 'index.html')
        pg.evaluate("(seed) => localStorage.setItem('ju_reading_v1', JSON.stringify(seed))", seed)
        login(pg, PINS['julianna'])
        pg.wait_for_url('**/child.html')
        pg.goto(BASE + 'game.html?s=reading&g=speed')
        pg.wait_for_selector('#rs-picker')
        pg.evaluate('window.__JU_RS_FLASH_FACTOR = 40; window.__JU_RS_Q_MS = 0')
        pg.click('.rs-pcard[data-id="wolf-island"]')
        pg.wait_for_selector('#rs-word')
        jumped = pg.evaluate("""() => {
          const tokens = JU.reading.current().tokens;
          const n = JU.reading.normWord;
          let i = -1;
          for (let k = 21; k < tokens.length; k++) if (n(tokens[k]) === 'island') { i = k; break; }
          JU.reading.flash.jump(i);
          return { i: i, focus: document.getElementById('rs-focus').textContent, nudge: document.getElementById('rs-nudge').textContent, paused: document.getElementById('rs-flash').dataset.paused };
        }""")
        check(jumped['focus'] == 'l' and '65' in jumped['nudge'] and jumped['paused'] == '0', 'reading: %s flash is on island with a 65 nudge' % tag)
        pg.evaluate('window.scrollTo(0,0)')
        rs_overflow(pg, 'reading %s flash' % tag)
        save_shot(pg, 'rs-flash-%s.png' % tag)
        pg.click('#rs-to-read')
        pg.wait_for_selector('#rs-passage')
        ids = pg.evaluate("""() => {
          const tokens = JU.reading.current().tokens;
          const n = JU.reading.normWord;
          function find(word) { for (let i = 0; i < tokens.length; i++) if (n(tokens[i]) === word) return i; return -1; }
          return { arrived: find('arrived'), sniffed: find('sniffed'), nested: find('nested'), helped: find('helped') };
        }""")
        pg.click('.rs-tok[data-i="%d"]' % ids['arrived'])
        pg.wait_for_selector('.rs-tok.is-miss')
        pg.evaluate('window.scrollTo(0,0)')
        rs_overflow(pg, 'reading %s read-aloud' % tag)
        save_shot(pg, 'rs-read-%s.png' % tag)
        pg.click('.rs-tok[data-i="%d"]' % ids['sniffed'])
        pg.click('.rs-tok[data-i="%d"]' % ids['nested'])
        pg.evaluate('window.__JU_RS_READ_MS = 1')
        pg.wait_for_function("() => document.getElementById('rs-time').dataset.stopped === '1'")
        pg.click('.rs-tok[data-i="%d"]' % ids['helped'])
        pg.wait_for_selector('#rs-results')
        got = pg.evaluate("""() => {
          const r = document.getElementById('rs-results');
          return { wpm: r.dataset.wpm, acc: r.dataset.accuracy, words: r.dataset.words, misses: r.dataset.misses, early: r.dataset.early, q: document.getElementById('rs-q-kicker').textContent };
        }""")
        check(got == {'wpm': '104', 'acc': '97', 'words': '107', 'misses': '3', 'early': '0', 'q': 'Question 1 of 3'}, 'reading: %s results are 104 wpm (%s)' % (tag, got))
        check('New best!' in pg.inner_text('#rs-new-best'), 'reading: %s results say new best' % tag)
        pg.evaluate("() => document.getElementById('rs-score').scrollIntoView({block:'start'})")
        rs_overflow(pg, 'reading %s results' % tag)
        save_shot(pg, 'rs-results-%s.png' % tag)
        pg.evaluate("() => document.getElementById('rs-q').scrollIntoView({block:'start'})")
        save_shot(pg, 'rs-question-%s.png' % tag)
        for n in range(3):
            ans = pg.evaluate("(n) => JU.reading.current().questions[n].answer", n)
            pg.click('#rs-q .rs-choice[data-i="%d"]' % ans)
            if n < 2:
                pg.wait_for_function("(k) => { const el = document.getElementById('rs-q-kicker'); return !!(el && el.textContent.indexOf('Question ' + k) !== -1); }", arg=str(n + 2))
        pg.wait_for_function("() => (document.getElementById('rs-comp') || {}).textContent.indexOf('3/3') !== -1")
        pg.click('#rs-see-progress')
        pg.wait_for_selector('#rs-chart-new:not([hidden])')
        pg.evaluate('window.scrollTo(0,0)')
        rs_overflow(pg, 'reading %s progress' % tag)
        save_shot(pg, 'rs-progress-%s.png' % tag)
        pg.click('#rs-to-passages')
        pg.wait_for_selector('#rs-picker')
        pick = pg.evaluate("""() => ({
          togo: document.getElementById('rs-to-go').textContent,
          latest: document.getElementById('rs-latest').textContent,
          wolf: document.querySelector('.rs-pcard[data-id="wolf-island"]').dataset.best,
          featured: document.querySelector('.rs-pcard[data-id="wolf-island"]').classList.contains('is-featured'),
          forest: document.querySelector('.rs-pcard[data-id="forest-neighbors"]').textContent
        })""")
        check(pick['togo'] == '8 to go to 112' and '104' in pick['latest'] and pick['wolf'] == '104' and pick['featured'] and 'Not played yet' in pick['forest'], 'reading: %s picker shows 104 and 8 to go' % tag)
        pg.evaluate('window.scrollTo(0,0)')
        rs_overflow(pg, 'reading %s picker' % tag)
        save_shot(pg, 'rs-picker-%s.png' % tag)
        pg.evaluate('sessionStorage.clear()')
        login(pg, PINS['parent'], who='parent')
        pg.wait_for_url('**/parent.html')
        pg.wait_for_selector('#reading-julianna[data-latest="104"]')
        card = pg.evaluate("""() => {
          const b = document.getElementById('reading-julianna');
          return { latest: b.dataset.latest, best: b.dataset.best, togo: b.dataset.togo, accuracy: b.dataset.accuracy, comp: b.dataset.comp, flash: b.dataset.flash, miss: b.dataset.miss, rounds: b.dataset.rounds };
        }""")
        check(card == {'latest': '104', 'best': '104', 'togo': '8', 'accuracy': '97', 'comp': '3/3', 'flash': '60', 'miss': 'habitat', 'rounds': '8'}, 'reading: %s parent card matches the 104 read (%s)' % (tag, card))
        pg.evaluate("() => document.getElementById('reading-julianna').scrollIntoView({block:'start'})")
        rs_overflow(pg, 'reading %s parent' % tag)
        save_shot(pg, 'rs-parent-%s.png' % tag, '#reading-julianna')
        c.close()
    check(True, 'reading: screenshots saved under ' + ART)

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
    check('playing' in page.inner_text('#who-h'), 'landing heading')
    page.screenshot(path=f'{OUT}/01-landing.png')
    login(page, '1111')
    page.wait_for_selector('#msg:not(:empty)')
    check('not the right' in page.inner_text('#msg'), 'wrong PIN gives gentle message')
    check(page.url.endswith('index.html'), 'wrong PIN stays on landing')
    login(page, PINS['julianna'], keyboard=True)
    page.wait_for_url('**/child.html')
    check(True, 'child PIN via keyboard opens child.html')
    check(page.evaluate("sessionStorage.getItem('ju_role')") == 'julianna', 'role stored in sessionStorage')
    page.goto(BASE + 'parent.html')
    check(page.url.endswith('index.html'), 'child cannot open parent page')
    login(page, PINS['julianna'])
    page.wait_for_url('**/child.html')
    page.wait_for_selector('.gcard')
    check(page.locator('.gcard').count() == 8, 'child home shows 5 games + test + math flash cards + reading speed')
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
        if page.locator('button:has-text("Next word")').count():
            page.click('button:has-text("Next word")')
            if i == 5: pause_through(page)
            continue
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
        word = pull_word(page, 1)
        check(word in WORDS, f'listen: spoke a week word ({word})') if i < 1 else None
        if i == 0:
            page.fill('.typebox', 'WRONG')
            check(page.input_value('.typebox') == 'wrong', 'listen: typed capitals become lowercase')
            page.keyboard.press('Enter')
            check('Good try' in page.inner_text('.msg'), 'listen: first miss gentle')
            page.click('button:has-text("sentence")')
            page.wait_for_function("() => { const t = (window.__spoken || [])[(window.__spoken || []).length - 1]; return !!(t && t.indexOf(' ') !== -1); }")
            check(' ' in last_spoken(page), 'listen: sentence button speaks a sentence')
            mark_speech(page)
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
        word = pull_word(page, 3)
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
    login(page, PINS['parent'], who='parent')
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
    check(page.locator('.gcard').count() == 8, 'parent can open games home')


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
          and [e['id'] for e in idx] == ['2026-10-26', '2026-11-02', '2026-11-16'], 'add_week.py is idempotent (same files, no duplicate weeks.json line)')
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
    expected = []
    for dirpath, _, files in os.walk(os.path.join(sitecopy, 'data')):
        for fn in files:
            expected.append(os.path.relpath(os.path.join(dirpath, fn), sitecopy).replace(os.sep, '/'))
    expected.append('js/storage.js')
    expected = sorted(set(expected))
    check(names == expected, 'update zip: data/ + named file, paths preserved, nothing else ' + str(names))
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
    stick_week(p3, '2026-11-02')
    login(p3, PINS['julianna']); p3.wait_for_url('**/child.html'); p3.wait_for_selector('.gcard')
    p3.wait_for_timeout(300)
    check(p3.locator('.gcard.review').count() == 0 and p3.locator('.gcard').count() == 8, 'review: hidden when there is no history')
    p3.goto(BASE + 'game.html?s=spelling&g=review')
    p3.wait_for_selector('#stage .card')
    check('Nothing to review' in p3.inner_text('#stage'), 'review: direct link with no history shows a calm message')

    # seed history: week Oct 26 (3 sessions), week Nov 2 (test + review)
    def rec(week, typ, word, correct, typed, sess, ts, typed_all=None):
        return {'id': sess + '-' + word + '-' + typ, 'ts': ts, 'session': sess, 'week': week, 'subject': 'spelling', 'type': typ, 'proctored': False,
                'word': word, 'typed': typed, 'typedAll': typed_all if typed_all is not None else [typed], 'correct': correct, 'tries': 1}
    w1 = list(OCT_WORDS); w2 = list(NEW)
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
    stick_week(p3, '2026-10-26')
    p3.goto(BASE + 'child.html'); p3.wait_for_selector('.gcard'); p3.wait_for_timeout(300)
    check(p3.locator('.gcard.review').count() == 0, 'review: hidden for the first week (nothing earlier)')
    stick_week(p3, '2026-11-02')

    # --- dashboard: trend, keeps missing ---
    p3.evaluate("sessionStorage.clear()")
    login(p3, PINS['parent'], who='parent'); p3.wait_for_url('**/parent.html')
    p3.wait_for_selector('#trend svg')
    check(p3.locator('#trend svg').count() == 3, 'trend: three inline SVG charts (test score, words missed, games finished)')
    for key in ['test', 'missed', 'games']:
        check(p3.locator(f'#trend figure[data-chart="{key}"] rect.bar').count() == 2, f'trend: {key} chart has one bar per week')
    nums = p3.eval_on_selector_all('#trend-nums tbody tr', "trs=>trs.map(r=>[...r.children].map(c=>c.textContent.trim()))")
    check(nums == [['Oct 26', '75%', '4', '2'], ['Nov 2', '83%', '2', '0'], ['Nov 16', '\u2013', '\u2013', '\u2013']], f'trend: numbers per week are right {nums}')
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
    check(dl.value.suggested_filename.startswith('family-learning-progress-') and dl.value.suggested_filename.endswith('.json'), 'backup: sensible file name')
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
    check(p3.locator('.gcard').count() == 9 and p3.locator('.sbox').count() == 5, 'review: card appears with history (9 cards, still 5 sticker boxes)')
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
            p3.wait_for_selector('button:has-text("Next word")'); mark_speech(p3); p3.click('button:has-text("Next word")')
        else:
            word = pull_word(p3, 1)
            p3.fill('.typebox', word if steps != 2 else 'wrongg'); p3.keyboard.press('Enter')
            if steps == 2:
                check('Good try' in p3.inner_text('.msg'), 'review: a miss is answered gently')
                p3.fill('.typebox', word); p3.keyboard.press('Enter')
            p3.wait_for_selector('button:has-text("Next word")'); mark_speech(p3); p3.click('button:has-text("Next word")')
        if steps > 12: break
    check(steps == len(pick), f'review: played every step ({steps})')
    check('Nice review' in p3.inner_text('.finish') and p3.locator('.sticker-pop').count() == 1, 'review: calm finish with a star')
    stage_txt = p3.inner_text('#stage').lower()
    check('progress' not in stage_txt and 'timer' not in stage_txt and 'brain' not in stage_txt, 'review: no progress bar, timer or brain break on the page')
    rv = p3.evaluate("JSON.parse(localStorage.getItem('ju_results_v1')).filter(r => r.type === 'review' && r.session !== 'S5' && r.session !== 'S6' && r.session !== 'S7')")
    check(len(rv) == steps and all(r['week'] == '2026-11-02' for r in rv), 'review: results saved as type review under the current week')
    check(p3.evaluate("Object.keys(JSON.parse(localStorage.getItem('ju_stickers_v1'))).length") == 1 and
          'spelling:review' not in p3.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('ju_stickers_v1')))"), 'review: does not add a sticker box')
    # misses made in review count for the keeps-missing list; a clean second play of a word fades it
    p3.evaluate("sessionStorage.clear()")
    login(p3, PINS['parent'], who='parent'); p3.wait_for_url('**/parent.html'); p3.wait_for_selector('#keeps tbody tr')
    typos = p3.inner_text('#typos')
    check('wrongg' in typos, 'dashboard: review misspelling appears with the other misspellings')
    # Review order is shuffled. Two right Review answers in a row after the last miss take a word off this list.
    famous_good = p3.evaluate("""() => {
      const all = JSON.parse(localStorage.getItem('ju_results_v1')).filter(r => r.word === 'famous');
      const lastMiss = all.filter(r => !r.correct).map(r => r.ts).sort().pop();
      return all.filter(r => r.type === 'review' && r.correct && r.ts > lastMiss).length;
    }""")
    keeps_txt = p3.inner_text('#keeps').replace('\u2022', '')
    if famous_good >= 2:
        check('famous' not in keeps_txt, 'dashboard: two right reviews in a row take famous off the keeps list')
    else:
        check('famous' in keeps_txt, 'dashboard: keeps-missing still lists famous')
    ctx3.close()
    check(not errors3, 'v2: no console/page errors: ' + '; '.join(errors3[:3]))
    check(not foreign_requests, 'no network requests leave this site: ' + ', '.join(foreign_requests[:3]))
    shutil.rmtree(tmp, ignore_errors=True)

    flash_cards(br)
    reading_speed(br)
    kinder_nov16(br)

    check(not errors, 'no console/page errors: ' + '; '.join(errors[:3]))
    br.close()
print('FAILS:', fails)
sys.exit(1 if fails else 0)
