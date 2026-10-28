/* solo.html?n=1 - a child's own follow-on to a family lesson. Julianna and Dorian use their own login; it opens once the Family has
   finished that lesson. A grown-up can preview it (?p=julianna or ?p=dorian): nothing is saved and the lock does not apply. */
(async function () {
  const h = JU.ui.h;
  const q = new URLSearchParams(location.search);
  const n = parseInt(q.get('n'), 10);
  const role = JU.auth.role();
  const preview = role === 'parent';
  const profile = preview ? (q.get('p') === 'dorian' ? 'dorian' : 'julianna') : role;
  const kid = profile === 'dorian';
  const mount = document.getElementById('solo');
  if (kid) document.body.classList.add('kid');
  if (preview) {
    document.getElementById('parent-bar').hidden = false;
    document.getElementById('parent-back').href = 'parent.html?p=' + profile;
  } else if (!kid) JU.ui.header({ title: '', backHref: 'child.html', backLabel: 'Back to games' });
  try {
    const list = await JU.money.soloList(profile);
    const l = list.find(x => x.id === n);
    const back = preview ? 'parent.html?p=' + profile : (kid ? 'dorian.html' : 'child.html');
    if (!l || (!l.open && !preview)) { location.replace(back); return; }
    document.title = 'Lesson ' + n + ': ' + l.title;
    await JU.money.playSolo(n, profile, mount, { preview, home: back });
  } catch (e) {
    console.error(e);
    mount.replaceChildren(h('div', { class: 'card center' }, h('h2', null, 'Oops!'), h('p', null, 'Something went wrong. Please tell a grown-up.')));
  }
})();
