(async function () {
  const h = JU.ui.h;
  JU.ui.header({ title: 'Grown-up page', showDashLink: false });

  const subjectId = 'spelling';
  const weeks = await JU.weeks.loadAll(subjectId);
  const wordMap = {};     // word -> { week, w }
  weeks.forEach(wk => wk.words.forEach(w => { wordMap[w.word] = { week: wk, w }; }));
  const gameTitle = id => (JU.games[subjectId] && JU.games[subjectId][id] ? JU.games[subjectId][id].title : id);
  const SPELLED = ['unscramble', 'listen', 'test'];     // games where she types or builds the actual spelling

  const filter = document.getElementById('week-filter');
  filter.appendChild(h('option', { value: 'all' }, 'All weeks'));
  weeks.slice().reverse().forEach(w => filter.appendChild(h('option', { value: w.id }, w.label)));
  filter.addEventListener('change', render);

  const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '\u2013';
  function fillTable(table, head, rows, emptyText) {
    table.replaceChildren(
      h('thead', null, h('tr', null, head.map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.length ? rows.map(r => h('tr', null, r.map(c => h('td', null, c)))) : h('tr', null, h('td', { colspan: head.length, class: 'note' }, emptyText || 'Nothing yet.'))));
  }
  function wordCell(word) {
    const m = wordMap[word];
    return m ? JU.ui.coloredWord(m.week, m.w, { split: true }) : word;
  }
  const fmtDay = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  const fmtTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function render() {
    const all = await JU.storage.getResults();
    const sel = filter.value;
    const rs = sel === 'all' ? all : all.filter(r => r.week === sel);
    document.getElementById('empty').hidden = all.length > 0;

    const right = rs.filter(r => r.correct).length;
    const sessions = new Set(rs.map(r => r.session)).size;
    document.getElementById('summary').replaceChildren(
      statCard('Words practiced', rs.length), statCard('Right on the first try', pct(right, rs.length)),
      statCard('Games and tests played', sessions),
      statCard('Tests taken', new Set(rs.filter(r => r.type === 'test').map(r => r.session)).size));

    /* per-word accuracy, most missed first */
    const per = {};
    const weekWords = sel === 'all' ? Object.keys(wordMap) : weeks.filter(w => w.id === sel).flatMap(w => w.words.map(x => x.word));
    weekWords.forEach(w => { per[w] = { word: w, n: 0, ok: 0, typos: {} }; });
    rs.forEach(r => {
      const p = per[r.word] = per[r.word] || { word: r.word, n: 0, ok: 0, typos: {} };
      p.n++; if (r.correct) p.ok++;
    });
    const typoRows = {};   // "word|typed|type" -> count
    rs.forEach(r => {
      if (SPELLED.indexOf(r.type) === -1) return;
      (r.typedAll || [r.typed]).forEach(t => {
        if (t && t !== r.word) {
          per[r.word].typos[t] = (per[r.word].typos[t] || 0) + 1;
          const k = [r.word, t, r.type].join('|');
          typoRows[k] = typoRows[k] || { word: r.word, typed: t, type: r.type, n: 0, last: r.ts };
          typoRows[k].n++; if (r.ts > typoRows[k].last) typoRows[k].last = r.ts;
        }
      });
    });
    const plist = Object.values(per).sort((a, b) =>
      (b.n - b.ok) - (a.n - a.ok) || (a.n ? a.ok / a.n : 2) - (b.n ? b.ok / b.n : 2) || (a.word < b.word ? -1 : 1));
    fillTable(document.getElementById('words'),
      ['Word', 'Times practiced', 'Right first time', 'Missed', 'Accuracy', 'Typed instead'],
      plist.map(p => [wordCell(p.word), p.n, p.ok, p.n - p.ok, pct(p.ok, p.n), Object.keys(p.typos).join(', ') || '\u2013']),
      'No words yet.');

    /* misspellings */
    fillTable(document.getElementById('typos'), ['Word', 'She typed', 'Where', 'Times', 'Last time'],
      Object.values(typoRows).sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1))
        .map(t => [wordCell(t.word), h('span', { class: 'typed' }, t.typed), gameTitle(t.type), t.n, fmtTime(t.last)]),
      'No misspellings recorded.');

    /* practice next */
    const need = plist.filter(p => p.n - p.ok > 0).sort((a, b) => (b.n - b.ok) / b.n - (a.n - a.ok) / a.n || (b.n - b.ok) - (a.n - a.ok)).slice(0, 6);
    const pr = document.getElementById('practice');
    if (!need.length) {
      pr.replaceChildren(h('p', { class: 'lead' }, rs.length ? 'No tricky words right now. Great work!' : 'Play a game or take the test to see which words to practice.'));
    } else {
      pr.replaceChildren(h('p', null, 'Pick two or three each day: say it, clap the beats, then write it in two colors.'),
        h('div', { class: 'practice-grid' }, need.map(p => {
          const m = wordMap[p.word];
          return h('div', { class: 'pcard' },
            h('div', { class: 'bigword' }, wordCell(p.word)),
            m ? h('div', { class: 'note' }, m.w.clue) : null,
            h('div', { class: 'note' }, 'Missed ' + (p.n - p.ok) + ' of ' + p.n + (Object.keys(p.typos).length ? ' \u2022 typed: ' + Object.keys(p.typos).join(', ') : '')));
        })));
    }

    /* by day */
    const days = {};
    rs.forEach(r => {
      const d = JU.ui.localDate(r.ts);
      const x = days[d] = days[d] || { d, g: 0, gok: 0, t: 0, tok: 0, tests: new Set(), games: new Set() };
      if (r.type === 'test') { x.t++; if (r.correct) x.tok++; x.tests.add(r.session); }
      else { x.g++; if (r.correct) x.gok++; x.games.add(r.session); }
    });
    fillTable(document.getElementById('byday'), ['Day', 'Games played', 'Game score', 'Tests', 'Test score'],
      Object.values(days).sort((a, b) => a.d < b.d ? 1 : -1).map(x => [fmtDay(x.d), x.games.size, x.g ? x.gok + ' of ' + x.g + ' (' + pct(x.gok, x.g) + ')' : '\u2013', x.tests.size, x.t ? x.tok + ' of ' + x.t + ' (' + pct(x.tok, x.t) + ')' : '\u2013']));

    /* by game */
    const gm = {};
    rs.forEach(r => { const x = gm[r.type] = gm[r.type] || { type: r.type, n: 0, ok: 0, s: new Set() }; x.n++; if (r.correct) x.ok++; x.s.add(r.session); });
    fillTable(document.getElementById('bygame'), ['Game', 'Times played', 'Words', 'Right first time', 'Score'],
      Object.values(gm).sort((a, b) => b.n - a.n).map(x => [gameTitle(x.type), x.s.size, x.n, x.ok, pct(x.ok, x.n)]));

    /* test sessions */
    const ts = {};
    rs.filter(r => r.type === 'test').forEach(r => {
      const x = ts[r.session] = ts[r.session] || { ts: r.ts, week: r.week, n: 0, ok: 0, proctored: r.proctored };
      x.n++; if (r.correct) x.ok++; if (r.ts < x.ts) x.ts = r.ts;
    });
    const weekLabel = id => { const w = weeks.find(x => x.id === id); return w ? w.label : id; };
    fillTable(document.getElementById('tests'), ['When', 'Week', 'Score', 'Run by'],
      Object.values(ts).sort((a, b) => a.ts < b.ts ? 1 : -1).map(x => [fmtTime(x.ts), weekLabel(x.week), x.ok + ' of ' + x.n + ' (' + pct(x.ok, x.n) + ')', x.proctored ? 'Grown-up (proctored)' : 'Julianna on her own']),
      'No tests taken yet.');

    const st = await JU.storage.getStickers();
    const count = Object.values(st).reduce((a, w) => a + Object.keys(w).length, 0);
    document.getElementById('stickernote').textContent = 'Stickers earned so far: ' + count;
  }
  function statCard(label, value) { return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(value)), h('div', { class: 'stat-l' }, label)); }

  /* export */
  document.getElementById('export').addEventListener('click', async () => {
    const all = await JU.storage.getResults();
    const cols = ['ts', 'date', 'week', 'subject', 'type', 'word', 'typed', 'correct', 'tries', 'all_typed', 'proctored', 'session'];
    const esc = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const lines = [cols.join(',')].concat(all.map(r => [r.ts, JU.ui.localDate(r.ts), r.week, r.subject, r.type, r.word, r.typed, r.correct ? 'yes' : 'no', r.tries, (r.typedAll || []).join('|'), r.proctored ? 'yes' : 'no', r.session].map(esc).join(',')));
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'julianna-results-' + JU.ui.localDate(new Date().toISOString()) + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* clear, with confirm */
  const dlg = document.getElementById('confirm');
  document.getElementById('clear').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('close', async () => { if (dlg.returnValue === 'ok') { await JU.storage.clearResults(); await render(); } dlg.returnValue = ''; });
  document.getElementById('reset-stickers').addEventListener('click', async () => {
    if (window.confirm('Reset all of Julianna\u2019s stickers?')) { await JU.storage.clearStickers(); await render(); }
  });

  await render();
})();
