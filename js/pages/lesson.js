/* lesson.html?n=1 - one family lesson. A locked lesson (or one with no content yet) goes back to the Family home. */
(async function () {
  const h = JU.ui.h;
  const n = parseInt(new URLSearchParams(location.search).get('n'), 10);
  JU.ui.header({ title: '', backHref: 'family.html', backLabel: 'All lessons' });
  const mount = document.getElementById('lesson');
  try {
    const lessons = await JU.money.resolved();
    const l = lessons.find(x => x.id === n);
    if (!l || l.state === 'locked' || l.status !== 'ready') { location.replace('family.html'); return; }
    document.title = 'Lesson ' + n + ': ' + l.title;
    await JU.money.playFamily(n, mount);
  } catch (e) {
    console.error(e);
    mount.replaceChildren(h('div', { class: 'card center' }, h('h2', null, 'Oops!'), h('p', null, 'Something went wrong. Please tell a grown-up.'),
      h('a', { class: 'btn primary', href: 'family.html' }, 'Back to the lessons')));
  }
})();
