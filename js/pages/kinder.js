/* kinder.html?a=letters | build - Dorian's kindergarten activities. A grown-up can preview (nothing is saved). */
(async function () {
  const h = JU.ui.h;
  const q = new URLSearchParams(location.search);
  const activity = q.get('a') === 'build' ? 'build' : 'letters';
  const preview = JU.auth.role() === 'parent';
  const mount = document.getElementById('kinder');
  if (preview) document.getElementById('parent-bar').hidden = false;
  try {
    document.title = JU.kinderGames[activity].title;
    await JU.kinderPlay(activity, 'dorian', mount, { preview, home: preview ? 'parent.html?p=dorian' : 'dorian.html' });
  } catch (e) {
    console.error(e);
    mount.replaceChildren(h('div', { class: 'card center' }, h('h2', null, 'Oops!'), h('p', null, 'Something went wrong. Please tell a grown-up.')));
  }
})();
