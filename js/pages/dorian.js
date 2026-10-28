/* Dorian's home: a spoken greeting, big pictures, tap-only. No reading needed.
   Once the Family has finished a money lesson, a big picture button for Dorian's follow-on appears (solo.html?n=N). */
(async function () {
  const h = JU.ui.h;
  let greeting = 'Hi Dorian! I am so happy you are here. Your games are coming soon!';
  if (JU.auth.role() === 'parent') document.getElementById('parent-bar').hidden = false;
  const hear = document.getElementById('hear');
  function speak() { try { return JU.speech.say(greeting); } catch (e) { /* no voice on this device: the pictures still work */ } }
  hear.addEventListener('click', speak);
  document.querySelector('.kid-stage').addEventListener('click', speak);
  document.getElementById('bye').addEventListener('click', () => JU.auth.logout());

  /* money activities that the Family has finished: one big picture button each (locked ones are not shown to him) */
  try {
    const open = (await JU.money.soloList('dorian')).filter(l => l.open);
    if (open.length) {
      const box = document.getElementById('kid-money');
      box.replaceChildren(...open.map(l => h('a', { class: 'kid-btn kid-lesson' + (l.done ? ' done' : ''), href: 'solo.html?n=' + l.id, 'data-lesson': l.id, 'aria-label': 'Money game ' + l.id + ': ' + l.title + (l.done ? ', finished' : '') },
        h('span', { class: 'kid-pic', 'aria-hidden': 'true' }, l.done ? '\u2705' : l.icon))));
      box.hidden = false;
      document.querySelector('.kid-soon').textContent = 'Tap a picture to play!';
      greeting = 'Hi Dorian! I am so happy you are here. Tap a picture to play!';
    }
  } catch (e) { /* the home still works without the money games */ }
  speak();       // some browsers wait for a tap before they will talk; the big speaker button always works
})();
