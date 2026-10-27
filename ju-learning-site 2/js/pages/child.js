(async function () {
  const h = JU.ui.h;
  JU.ui.header({ title: '' });
  document.getElementById('hello').textContent = 'Hi, ' + JU.config.childName + '!';

  const subject = JU.subjects[0];               // only spelling for now; a subject picker can go here later
  const weeks = await JU.weeks.list(subject.id);
  const entry = await JU.weeks.currentEntry(subject.id);
  const week = await JU.weeks.load(entry);
  const stickers = (await JU.storage.getStickers())[week.id] || {};

  /* week picker */
  const pick = document.getElementById('week-pick');
  if (weeks.length > 1) {
    const sel = h('select', { id: 'week-select', class: 'select', 'aria-label': 'Pick a week' },
      weeks.slice().reverse().map(w => h('option', { value: w.id, selected: w.id === entry.id }, w.label)));
    sel.addEventListener('change', () => { JU.weeks.choose(sel.value); location.reload(); });
    pick.appendChild(h('label', { for: 'week-select' }, 'Week: '));
    pick.appendChild(sel);
  } else {
    pick.appendChild(h('p', { class: 'lead' }, week.label + ' \u2022 ' + (week.title || 'Spelling')));
  }

  /* sticker boxes */
  const defs = subject.games.map(id => JU.games[subject.id][id]);
  document.getElementById('stickers').replaceChildren(...defs.map(g => {
    const got = !!stickers[subject.id + ':' + g.id];
    return h('div', { class: 'sbox' + (got ? ' got' : ''), 'aria-label': g.title + (got ? ': sticker earned' : ': no sticker yet') },
      h('div', { class: 'sface', 'aria-hidden': 'true' }, got ? g.sticker : ''),
      h('div', { class: 'scap' }, g.title));
  }));

  /* game cards */
  const grid = document.getElementById('games');
  defs.forEach(g => {
    const got = !!stickers[subject.id + ':' + g.id];
    grid.appendChild(h('a', { class: 'gcard', href: 'game.html?s=' + subject.id + '&g=' + g.id },
      h('span', { class: 'gemoji', 'aria-hidden': 'true' }, g.emoji),
      h('span', { class: 'gtitle' }, g.title),
      h('span', { class: 'gblurb' }, g.blurb),
      got ? h('span', { class: 'gdone' }, '\u2713 Sticker earned') : null));
  });
  const t = JU.games[subject.id][subject.test];
  const testCard = (h('a', { class: 'gcard test', href: 'game.html?s=' + subject.id + '&g=' + t.id },
    h('span', { class: 'gemoji', 'aria-hidden': 'true' }, t.emoji),
    h('span', { class: 'gtitle' }, t.title),
    h('span', { class: 'gblurb' }, t.blurb)));
  grid.appendChild(testCard);

  /* Review card: only shown when she has missed words in earlier weeks */
  const rv = JU.games[subject.id].review;
  if (rv) {
    const items = JU.review.pick(week, await JU.weeks.loadAll(subject.id), await JU.storage.getResults());
    if (items.length) {
      grid.insertBefore(h('a', { class: 'gcard review', href: 'game.html?s=' + subject.id + '&g=review' },
        h('span', { class: 'gemoji', 'aria-hidden': 'true' }, rv.emoji),
        h('span', { class: 'gtitle' }, rv.title),
        h('span', { class: 'gblurb' }, rv.blurb)), testCard);
    }
  }
})();
