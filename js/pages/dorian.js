/* Dorian's home: a spoken greeting, a few big pictures, tap-only. No reading needed.
   Reading, Math and Move each open a picture shelf. Stars (the level path) live on that shelf, under the picture, and all together behind the Stars button.
   Once the Family has finished a money lesson, a big picture button for Dorian's follow-on appears (solo.html?n=N). */
(async function () {
  const h = JU.ui.h;
  const SHELF = {
    reading: ['letters', 'build', 'sight', 'rhyme', 'rsort', 'who', 'look'],
    math: ['count', 'add', 'more', 'take', 'shapes', 'sort', 'graph', 'cal', 'hundred'],
    move: ['push']
  };
  const GROUP_SAY = { reading: 'Reading', math: 'Math', move: 'Move', stars: 'Stars' };
  const q = new URLSearchParams(location.search).get('g');
  const group = SHELF[q] ? q : (q === 'stars' ? 'stars' : '');
  let greeting = group ? GROUP_SAY[group] : 'Hi Dorian! I am so happy you are here. Tap a picture to play!';
  if (JU.auth.role() === 'parent') document.getElementById('parent-bar').hidden = false;
  const hear = document.getElementById('hear');
  function speak() { try { return JU.speech.say(greeting); } catch (e) { /* no voice on this device: the pictures still work */ } }
  hear.addEventListener('click', speak);
  const stage = document.querySelector('.kid-stage');
  stage.addEventListener('click', speak);
  stage.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); speak(); } });
  document.getElementById('bye').addEventListener('click', () => JU.auth.logout());

  /* Each activity button says its name when he focuses it and when he taps it; the page opens once the name has been said (or after 2.5 seconds at most). */
  let spoken = null;
  function sayName(text) {
    let p; try { p = JU.speech.say(text); } catch (e) { p = Promise.resolve(); }
    spoken = { text, p, t: Date.now() };
    return p;
  }
  function nameButtons(root) {
    root.querySelectorAll('[data-say]').forEach(a => {
      a.addEventListener('focus', () => sayName(a.dataset.say));
      a.addEventListener('click', async e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault();
        const again = spoken && spoken.text === a.dataset.say && Date.now() - spoken.t < 1500;     // the focus already started saying it
        await Promise.race([again ? spoken.p : sayName(a.dataset.say), new Promise(r => setTimeout(r, 2500))]);
        location.href = a.getAttribute('href');
      });
    });
  }
  /* v13: Letter sounds and Build a word show only once every letter sound is recorded in a grown-up's voice (parent page, Record sounds) */
  try {
    const lp = await JU.recordings.letterProgress();
    document.querySelectorAll('#kid-kinder [data-act="letters"], #kid-kinder [data-act="build"]').forEach(a => { a.dataset.locked = lp.ready ? '0' : '1'; });
  } catch (e) { document.querySelectorAll('#kid-kinder [data-act="letters"], #kid-kinder [data-act="build"]').forEach(a => { a.dataset.locked = '1'; }); }
  nameButtons(document.getElementById('kid-pick'));
  nameButtons(document.getElementById('kid-shelf'));

  /* v14: the daily warm-up gets a check mark once he has done it today (it still works as a button) */
  let kin = null;
  try {
    kin = await JU.storage.profile('dorian').getKinder();
    const today = new Date().toDateString();
    const doneToday = kin.rounds.some(r => r.activity === 'warmup' && new Date(r.ts).toDateString() === today);
    const w = document.querySelector('#kid-warmup [data-act="warmup"]');
    w.dataset.state = doneToday ? 'done' : 'open';
    if (doneToday) { w.classList.add('done'); w.appendChild(h('span', { class: 'kid-check', 'aria-hidden': 'true', 'data-check': '' }, '\u2705')); w.dataset.say = 'Warm-up. You did it today! Tap to play again.'; }
  } catch (e) { /* the home still works without it */ }

  /* v14: the star path. One row per game: its picture, then one stop per level (a star once earned, a glowing circle for where he is, with dots
     for his good rounds in a row, a lock for what comes later). Pictures only; tapping a row says how he is doing.
     v18: the rows are not on the home. A short copy sits under that game's picture. The full list is behind the Stars button. */
  try {
    const lv = await JU.kinder.loadLevels();
    const ICON = { letters: '\uD83D\uDD24', build: '\uD83E\uDDF1', sight: '\uD83D\uDC40', count: '\uD83D\uDD22', add: '\uD83E\uDDEE', more: '\u2696\uFE0F', look: '\uD83D\uDD0E', rhyme: '\uD83C\uDFB5', shapes: '\uD83D\uDD3A', push: '\uD83D\uDEAA', take: '\uD83C\uDF88', rsort: '\uD83E\uDD8B', who: '\uD83D\uDC3B', sort: '\uD83D\uDCE6', graph: '\uD83D\uDCCA', cal: '\uD83D\uDCC5', hundred: '\uD83D\uDCAF' };
    const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const shown = a => { const b = document.querySelector('#kid-kinder [data-act="' + a + '"]'); return b && b.dataset.locked !== '1'; };
    const rows = JU.kinder.starPath(kin || { rounds: [], stars: [], levels: {} }, lv).filter(r => shown(r.activity));
    const stopsFor = r => {
      const stops = [];
      for (let i = 1; i <= r.max + r.extra; i++) {
        const earned = i < r.level || i > r.max, here = i === r.level && i <= r.max;      // (past the last level, each new star is one more star on the path)
        stops.push(h('span', { class: 'k-stop ' + (earned ? 'earned' : here ? 'here' : 'later'), 'data-stop': i, 'aria-hidden': 'true' },
          earned ? '\u2B50' : here ? h('span', { class: 'k-streak' }, ...Array.from({ length: r.need }, (_, j) => h('span', { class: 'k-sdot' + (j < r.streak ? ' on' : '') }))) : '\uD83D\uDD12'));
      }
      return stops;
    };
    rows.forEach(r => {
      const mini = document.querySelector('[data-mini-path="' + r.activity + '"]');
      if (mini) mini.replaceChildren(...stopsFor(r));
    });
    if (rows.length) {
      const box = document.getElementById('kid-starpath');
      box.replaceChildren(...rows.map(r => {
        const said = r.title + '. You have ' + NUMW[Math.min(r.stars, 10)] + (r.stars === 1 ? ' star' : ' stars') + '!' + (r.streak ? ' Keep going!' : '');
        return h('button', { class: 'k-pathrow', type: 'button', 'data-path': r.activity, 'data-stars': r.stars, 'data-level': r.level, 'aria-label': said, onclick: () => { try { JU.speech.say(said); } catch (e) { } } },
          h('span', { class: 'k-pathicon', 'aria-hidden': 'true' }, ICON[r.activity]), h('span', { class: 'k-stops' }, stopsFor(r)));
      }));
    }
  } catch (e) { /* the shelf still works without the star path */ }

  /* money activities that the Family has finished: one big picture button each (locked ones are not shown to him) */
  try {
    const open = (await JU.money.soloList('dorian')).filter(l => l.open);
    if (open.length) {
      const box = document.getElementById('kid-money');
      /* a finished one keeps its picture and gets a check mark, and stays a button: tapping it plays it again as practice (nothing new is saved, see js/money/solo.js) */
      box.replaceChildren(...open.map(l => h('a', { class: 'kid-btn kid-lesson' + (l.done ? ' done' : ''), href: 'solo.html?n=' + l.id, 'data-lesson': l.id, 'data-state': l.done ? 'done' : 'open',
        'data-say': 'Money game ' + l.id + ': ' + l.title + (l.done ? '. You finished it. Tap to play again!' : ''),
        'aria-label': 'Money game ' + l.id + ': ' + l.title + (l.done ? ', finished. Tap to play again' : '') },
        h('span', { class: 'kid-pic', 'aria-hidden': 'true' }, l.icon),
        l.done ? h('span', { class: 'kid-check', 'aria-hidden': 'true', 'data-check': '' }, '\u2705') : null)));
      box.hidden = false;
      nameButtons(box);
    }
  } catch (e) { /* the home still works without the money games */ }
  /* the stickers he has earned in the kindergarten games: pictures only, no counts */
  try {
    const st = (await JU.storage.profile('dorian').getStickers()).kinder || {};
    const keys = Object.keys(st).sort((a, b) => st[a] < st[b] ? -1 : 1).slice(-12);
    if (keys.length) {
      const box = document.getElementById('kid-stickers');
      box.replaceChildren(...keys.map(k => { const m = /^(letters|build|sight|count|add|warmup|more|look|rhyme|shapes|push|take|rsort|who|sort|graph|cal|hundred)-(\d+)$/.exec(k); return m ? h('span', { class: 'k-mini-sticker', 'data-sticker-key': k, 'aria-hidden': 'true' }, JU.kinderSticker(m[1], Number(m[2]))) : null; }));
    }
  } catch (e) { /* the shelf still works without the sticker row */ }

  /* Which picture screen is open. The home is only the big buttons. */
  const home = !group;
  document.getElementById('kid-hello').hidden = !home;
  document.getElementById('kid-stage').hidden = !home;
  document.getElementById('kid-pick').hidden = !home;
  document.getElementById('kid-shelf').hidden = home;
  const moneyBox = document.getElementById('kid-money');
  if (!home) moneyBox.hidden = true;
  const kinder = document.getElementById('kid-kinder');
  const path = document.getElementById('kid-starpath');
  const stick = document.getElementById('kid-stickers');
  if (group === 'stars') {
    kinder.hidden = true;
    path.hidden = path.childElementCount === 0;
    stick.hidden = stick.childElementCount === 0;
  } else if (group) {
    kinder.hidden = false;
    path.hidden = true;
    stick.hidden = true;
    document.querySelectorAll('.kid-game').forEach(g => {
      const a = g.querySelector('[data-act]');
      g.hidden = a.dataset.locked === '1' || SHELF[group].indexOf(a.dataset.act) < 0;
    });
  }
  speak();       // some browsers wait for a tap before they will talk; the big speaker button always works
})();
