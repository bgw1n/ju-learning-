/* kinder.html?a=letters | build | sight | count | add - Dorian's kindergarten activities. A grown-up can preview (nothing is saved). */
(async function () {
  const h = JU.ui.h;
  const q = new URLSearchParams(location.search);
  const activity = ['build', 'sight', 'count', 'add'].indexOf(q.get('a')) >= 0 ? q.get('a') : 'letters';
  const preview = JU.auth.role() === 'parent';
  const mount = document.getElementById('kinder');
  if (preview) document.getElementById('parent-bar').hidden = false;
  /* v13: Letter sounds and Build a word wait until a grown-up has recorded every letter sound (parent page, Record sounds). A grown-up can still preview them. */
  if (!preview && (activity === 'letters' || activity === 'build')) {
    let ready = false; try { ready = (await JU.recordings.letterProgress()).ready; } catch (e) { }
    if (!ready) { location.replace('dorian.html'); return; }
  }
  try {
    document.title = JU.kinderGames[activity].title;
    await JU.kinderPlay(activity, 'dorian', mount, { preview, home: preview ? 'parent.html?p=dorian' : 'dorian.html' });
  } catch (e) {
    console.error(e);
    mount.replaceChildren(h('div', { class: 'card center' }, h('h2', null, 'Oops!'), h('p', null, 'Something went wrong. Please tell a grown-up.')));
  }
})();
