/* Dorian's home: a spoken greeting, big pictures, tap-only. No reading needed.
   Once the Family has finished a money lesson, a big picture button for Dorian's follow-on appears (solo.html?n=N). */
(async function () {
  const h = JU.ui.h;
  let greeting = 'Hi Dorian! I am so happy you are here. Tap a picture to play!';
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
  nameButtons(document.getElementById('kid-kinder'));

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
      box.replaceChildren(...keys.map(k => { const m = /^(letters|build)-(\d+)$/.exec(k); return m ? h('span', { class: 'k-mini-sticker', 'data-sticker-key': k, 'aria-hidden': 'true' }, JU.kinderSticker(m[1], Number(m[2]))) : null; }));
      box.hidden = false;
    }
  } catch (e) { /* the home still works without the sticker row */ }
  speak();       // some browsers wait for a tap before they will talk; the big speaker button always works
})();
