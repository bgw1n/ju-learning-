/* Family home: the 16 Money & Economics lessons as cards. Only unlocked lessons can be opened; a lesson with content opens its page
   (lesson.html?n=N), one still 'coming-soon' shows a note. */
(async function () {
  const h = JU.ui.h;
  JU.ui.header({ title: '', brand: 'Family Learning Place' });
  const lessons = await JU.money.resolved();
  const units = [];
  lessons.forEach(l => {
    let u = units.find(x => x.unit === l.unit);
    if (!u) units.push(u = { unit: l.unit, title: l.unitTitle, lessons: [] });
    u.lessons.push(l);
  });
  const dlg = document.getElementById('lesson-dialog');
  const LABEL = { locked: 'Locked', open: 'Open', complete: 'Done' };
  document.getElementById('units').replaceChildren(...units.map(u =>
    h('section', { class: 'unit', 'aria-labelledby': 'unit-' + u.unit },
      h('h2', { id: 'unit-' + u.unit }, 'Unit ' + u.unit + ': ' + u.title),
      h('ol', { class: 'lesson-grid' }, u.lessons.map(l => {
        const locked = l.state === 'locked';
        const body = [
          h('span', { class: 'lnum', 'aria-hidden': 'true' }, locked ? '\uD83D\uDD12' : l.complete ? '\u2705' : String(l.id)),
          h('span', { class: 'ltitle' }, 'Lesson ' + l.id + ': ' + l.title),
          h('span', { class: 'lstate' }, LABEL[l.state] + (l.state === 'open' && l.status === 'coming-soon' ? ' \u2022 coming soon' : ''))];
        if (locked) return h('li', null, h('div', { class: 'lcard locked', 'data-lesson': l.id, 'data-state': 'locked', role: 'group', 'aria-label': 'Lesson ' + l.id + ': ' + l.title + ', locked' }, body));
        if (l.status === 'ready') return h('li', null, h('a', { class: 'lcard ' + l.state, href: 'lesson.html?n=' + l.id, 'data-lesson': l.id, 'data-state': l.state }, body));
        return h('li', null, h('button', { type: 'button', class: 'lcard ' + l.state, 'data-lesson': l.id, 'data-state': l.state, onclick: () => {
          document.getElementById('lesson-dialog-title').textContent = 'Lesson ' + l.id + ': ' + l.title;
          dlg.showModal();
        } }, body));
      })))));
})();
