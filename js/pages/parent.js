(async function () {
  const h = JU.ui.h;
  JU.ui.header({ title: 'Grown-up page', showDashLink: false, brand: 'Family Learning Place' });

  const subjectId = 'spelling';
  const weeks = await JU.weeks.loadAll(subjectId);
  const wordMap = {};     // word -> { week, w }
  weeks.forEach(wk => wk.words.forEach(w => { wordMap[w.word] = { week: wk, w }; }));
  const gameTitle = id => (JU.games[subjectId] && JU.games[subjectId][id] ? JU.games[subjectId][id].title : id);
  const SPELLED = ['unscramble', 'listen', 'test', 'review'];     // games where she types or builds the actual spelling

  const filter = document.getElementById('week-filter');
  filter.appendChild(h('option', { value: 'all' }, 'All weeks'));
  weeks.slice().reverse().forEach(w => filter.appendChild(h('option', { value: w.id }, w.label)));
  filter.addEventListener('change', render);

  const P = JU.ui.plural;
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

    renderTrend(all);
    await renderHints(sel);
    renderKeeps(all);

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
    const count = Object.keys(st).filter(wk => wk !== 'money').reduce((a, wk) => a + Object.keys(st[wk]).length, 0);     // spelling stickers; money stickers are in the money card
    document.getElementById('stickernote').textContent = 'Stickers earned so far: ' + count;
    await renderMath();
  }
  function factLabel(key) {
    const m = /^(\d+)([+\-])(\d+)$/.exec(key || '');
    return m ? m[1] + ' ' + (m[2] === '+' ? '+' : '\u2212') + ' ' + m[3] : key;
  }
  async function renderMath() {
    const box = document.getElementById('math-julianna');
    if (!box) return;
    const data = await JU.storage.getMath();
    const rounds = data.rounds.slice().sort((a, b) => a.ts < b.ts ? 1 : -1);
    const best = data.rounds.reduce((m, r) => Math.max(m, r.score), 0);
    box.dataset.best = String(best);
    box.dataset.rounds = String(data.rounds.length);
    document.getElementById('math-summary').replaceChildren(
      statCard('Best score', data.rounds.length ? best : '\u2013'),
      statCard('Rounds played', data.rounds.length));
    fillTable(document.getElementById('math-rounds'), ['When', 'Number correct'],
      rounds.slice(0, 12).map(r => [fmtTime(r.ts), String(r.score)]),
      'No rounds yet. When Julianna plays Math Fact Flash Cards, they will show up here.');
    const tally = {};
    data.rounds.forEach(r => { const ms = r.misses || {}; for (const k in ms) tally[k] = (tally[k] || 0) + Number(ms[k] || 0); });
    const tricky = Object.keys(tally).map(k => ({ k, n: tally[k] })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || (a.k < b.k ? -1 : 1));
    fillTable(document.getElementById('math-tricky'), ['Fact', 'Times missed'],
      tricky.slice(0, 12).map(x => [factLabel(x.k), String(x.n)]),
      'No missed facts yet.');
  }
  /* ---------- week by week trend ---------- */
  function weekStats(all) {
    return weeks.map(wk => {
      const rs = all.filter(r => r.week === wk.id && r.type !== 'review');
      const sessions = {};
      rs.forEach(r => { const x = sessions[r.session] = sessions[r.session] || { n: 0, ok: 0, ts: r.ts, test: r.type === 'test' }; x.n++; if (r.correct) x.ok++; if (r.ts > x.ts) x.ts = r.ts; });
      const done = Object.values(sessions).filter(x => x.n >= wk.words.length);   // finished: every word was answered
      const tests = done.filter(x => x.test).sort((a, b) => a.ts < b.ts ? -1 : 1);
      const lastTest = tests[tests.length - 1];
      return {
        id: wk.id, label: wk.label.replace(/^Week of /, ''),
        test: lastTest ? Math.round(100 * lastTest.ok / lastTest.n) : null,
        missed: new Set(rs.filter(r => !r.correct).map(r => r.word)).size,
        games: done.filter(x => !x.test).length,
        any: rs.length > 0
      };
    });
  }
  function chart(title, data, key, opts) {
    const S = JU.ui.svg, W = 120 + data.length * 90, H = 190, left = 40, top = 22, bottom = 40, ph = H - top - bottom;
    const max = opts.max || Math.max(1, ...data.map(d => d[key] == null ? 0 : d[key]));
    const bw = 44, step = (W - left - 10) / data.length;
    const kids = [S('line', { x1: left, y1: top + ph, x2: W - 10, y2: top + ph, stroke: '#d9d3c4', 'stroke-width': 2 }),
      S('text', { x: left - 8, y: top + 5, 'text-anchor': 'end', class: 'ax' }, String(max)),
      S('text', { x: left - 8, y: top + ph + 4, 'text-anchor': 'end', class: 'ax' }, '0')];
    data.forEach((d, i) => {
      const cx = left + step * i + step / 2, v = d[key];
      if (v != null && d.any) {
        const bh = Math.round(ph * v / max);
        kids.push(S('rect', { class: 'bar ' + opts.cls, x: cx - bw / 2, y: top + ph - bh, width: bw, height: Math.max(bh, 2), rx: 6 }));
        kids.push(S('text', { x: cx, y: top + ph - bh - 5, 'text-anchor': 'middle', class: 'val' }, v + (opts.unit || '')));
      } else kids.push(S('text', { x: cx, y: top + ph - 6, 'text-anchor': 'middle', class: 'ax' }, '\u2013'));
      kids.push(S('text', { x: cx, y: H - 14, 'text-anchor': 'middle', class: 'ax' }, d.label));
    });
    const desc = data.map(d => d.label + ': ' + (d[key] == null ? 'none' : d[key] + (opts.unit || ''))).join('; ');
    return h('figure', { class: 'chart', 'data-chart': key },
      h('figcaption', null, title),
      S('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': title + '. ' + desc }, ...kids));
  }
  function renderTrend(all) {
    const st = weekStats(all);
    document.getElementById('trend').replaceChildren(
      chart('Test score (latest finished test)', st, 'test', { max: 100, unit: '%', cls: 'b-test' }),
      chart('Different words missed', st, 'missed', { cls: 'b-miss' }),
      chart('Games finished', st, 'games', { cls: 'b-games' }));
    fillTable(document.getElementById('trend-nums'), ['Week', 'Test score', 'Words missed', 'Games finished'],
      st.map(x => [x.label, x.test == null ? '\u2013' : x.test + '%', x.any ? x.missed : '\u2013', x.any ? x.games : '\u2013']));
  }

  /* ---------- words she keeps missing (all weeks) ---------- */
  function keepsMissing(all) {
    const per = {};
    all.forEach(r => {
      if (r.correct) return;
      const p = per[r.word] = per[r.word] || { word: r.word, weeks: new Set(), last: null, lastTs: '', typo: '' };
      p.weeks.add(r.week);
      const typed = SPELLED.indexOf(r.type) !== -1 ? ((r.typedAll || [r.typed]).filter(t => t && t !== r.word).pop() || '') : '';
      if (typed && r.ts >= p.lastTs) { p.lastTs = r.ts; p.typo = typed; }
    });
    return Object.values(per).filter(p => p.weeks.size >= 2).map(p => {
      const recs = all.filter(r => r.word === p.word);
      const lastMiss = recs.filter(r => !r.correct).reduce((m, r) => r.ts > m ? r.ts : m, '');
      const goodAfter = recs.filter(r => r.type === 'review' && r.correct && r.ts > lastMiss).length;
      return { word: p.word, n: p.weeks.size, typo: p.typo, goodAfter };
    }).filter(p => p.goodAfter < 2).sort((a, b) => b.n - a.n || (a.word < b.word ? -1 : 1));
  }
  function renderKeeps(all) {
    fillTable(document.getElementById('keeps'), ['Word', 'Weeks missed', 'Last thing she typed'],
      keepsMissing(all).map(p => [wordCell(p.word), p.n, p.typo ? h('span', { class: 'typed' }, p.typo) : '\u2013']),
      'No repeat misses yet. Nice!');
  }

  /* ---------- hints (earned spoken hint in the puzzle games) ---------- */
  async function renderHints(sel) {
    const log = (await JU.storage.getHints()).filter(r => r.subject !== 'money' && (sel === 'all' || r.week === sel));     // money hints are shown in the money card
    const uses = log.filter(r => r.kind === 'hint'), ups = log.filter(r => r.kind === 'grownup'), rapid = log.filter(r => r.kind === 'rapid');
    const earned = uses.filter(r => r.earned).length, byGrown = uses.length - earned;
    document.getElementById('hints-summary').replaceChildren(
      statCard('Hints used', uses.length), statCard('Earned with 2 tries', earned),
      statCard('Grown-up unlocks', ups.length), statCard('Rapid-miss flags', rapid.length));
    const ro = document.getElementById('hints-readout');
    if (!log.length) { ro.className = 'hints-readout calm'; ro.textContent = 'No hints used yet. She has not needed one, or has not played a puzzle game.'; }
    else {
      const bits = [];
      bits.push(uses.length ? 'She used ' + uses.length + (uses.length === 1 ? ' hint' : ' hints') + ' (' + earned + ' earned' + (byGrown ? ', ' + byGrown + ' with a grown-up' : '') + ').' : 'No hints were used.');
      if (ups.length) bits.push('A grown-up unlocked ' + ups.length + (ups.length === 1 ? ' hint.' : ' hints.'));
      bits.push(rapid.length ? rapid.length + (rapid.length === 1 ? ' word had' : ' words had') + ' very quick or repeated wrong answers. Those do not unlock a hint, so it may mean she was guessing. Worth a chat if you see it often.' : 'No rapid-miss flags, so she seems to be really trying.');
      ro.className = 'hints-readout' + (rapid.length ? '' : ' calm'); ro.textContent = bits.join(' ');
    }
    const gm = {};
    log.forEach(r => { const x = gm[r.game] = gm[r.game] || { game: r.game, hints: 0, grown: 0, rapid: 0 }; if (r.kind === 'hint') x.hints++; else if (r.kind === 'grownup') x.grown++; else x.rapid++; });
    fillTable(document.getElementById('hints-games'), ['Game', 'Hints used', 'Grown-up unlocks', 'Rapid-miss flags'],
      Object.values(gm).sort((a, b) => b.hints - a.hints || (a.game < b.game ? -1 : 1)).map(x => [gameTitle(x.game), x.hints, x.grown, x.rapid]), 'No hints used yet.');
    const wm = {};
    log.forEach(r => { const k = r.week + '|' + r.word; const x = wm[k] = wm[k] || { week: r.week, word: r.word, hints: 0, grown: 0, rapid: 0, games: new Set() }; if (r.kind === 'hint') x.hints++; else if (r.kind === 'grownup') x.grown++; else x.rapid++; x.games.add(gameTitle(r.game)); });
    const wl = id => { const w = weeks.find(x => x.id === id); return w ? w.label : id; };
    fillTable(document.getElementById('hints-words'), ['Week', 'Word', 'Where', 'Hints used', 'Grown-up unlocks', 'Rapid-miss flags'],
      Object.values(wm).sort((a, b) => b.hints - a.hints || b.rapid - a.rapid || (a.week < b.week ? 1 : -1) || (a.word < b.word ? -1 : 1))
        .map(x => [wl(x.week), wordCell(x.word), [...x.games].join(', '), x.hints, x.grown, x.rapid]), 'No hints used yet.');
  }

  function statCard(label, value) { return h('div', { class: 'stat' }, h('div', { class: 'stat-n' }, String(value)), h('div', { class: 'stat-l' }, label)); }

  /* save / load progress (a JSON backup file) */
  const backupMsg = document.getElementById('backup-msg');
  const banner = document.getElementById('backup-banner');
  async function makeBackup() {
    const incRec = document.getElementById('backup-recordings');
    const data = await JU.storage.exportAll({ recordings: !incRec || incRec.checked });
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const fileName = 'family-learning-progress-' + JU.ui.localDate(data.exportedAt) + '.json';
    await JU.storage.setLastBackup(data.exportedAt);
    const dn = data.profiles.dorian.results.length, fl = Object.keys(data.profiles.family.lessons.complete).length;
    const nrec = (data.recordings || []).length, mb = blob.size / 1048576;
    const size = mb >= 0.1 ? mb.toFixed(1) + ' MB' : Math.max(1, Math.round(blob.size / 1024)) + ' KB';
    backupMsg.textContent = 'Saved a backup with ' + P(data.results.length, 'result') + ' for Julianna, ' + dn + ' for Dorian and ' + P(fl, 'finished family lesson') + (nrec ? ', plus ' + P(nrec, 'sound recording') + ' (' + size + ')' : '') + '. Keep the file somewhere safe.';
    await JU.backup.showBanner(banner, saveBackup);
    return { blob, fileName, date: JU.ui.localDate(data.exportedAt), recordings: nrec, size, exportedAt: data.exportedAt };
  }
  function downloadBlob(blob, fileName) {
    const a = h('a', { href: URL.createObjectURL(blob), download: fileName });
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function saveBackup() {
    const saved = await makeBackup();
    downloadBlob(saved.blob, saved.fileName);
    return saved;
  }
  /* Email/share path: wrap the same JSON in a .zip so inbox readers that truncate JSON attachments still keep the full file. */
  async function makeBackupZip() {
    const saved = await makeBackup();
    const jsonName = saved.fileName;
    const zipName = jsonName.replace(/\.json$/i, '.zip');
    const bytes = new Uint8Array(await saved.blob.arrayBuffer());
    const zipBlob = await JU.zip.pack([{ name: jsonName, data: bytes }]);
    const mb = zipBlob.size / 1048576;
    const size = mb >= 0.1 ? mb.toFixed(1) + ' MB' : Math.max(1, Math.round(zipBlob.size / 1024)) + ' KB';
    return Object.assign({}, saved, { blob: zipBlob, fileName: zipName, jsonName, size, zip: true });
  }
  async function readBackupFile(f) {
    const buf = await f.arrayBuffer();
    const name = (f.name || '').toLowerCase();
    if (name.endsWith('.zip') || JU.zip.isZip(buf)) return JU.zip.readJsonFromZip(buf);
    return JSON.parse(new TextDecoder().decode(buf));
  }
  document.getElementById('save-progress').addEventListener('click', saveBackup);
  JU.backup.showBanner(banner, saveBackup);
  const loadFile = document.getElementById('load-file');
  document.getElementById('load-progress').addEventListener('click', () => loadFile.click());
  loadFile.addEventListener('change', async () => {
    const f = loadFile.files[0]; loadFile.value = '';
    if (!f) return;
    try {
      const data = await readBackupFile(f);
      if (!JU.storage.isBackup(data)) throw new Error('not a backup');
      const r = await JU.storage.importAll(data);
      const others = Object.keys(r.profiles).map(k => (k === 'dorian' ? 'Dorian' : 'Family') + ': ' + r.profiles[k].added + ' new').join(', ');
      const extra = (r.flags ? r.flags.added : 0) + (r.money ? r.money.added : 0) + Object.values(r.profiles).reduce((a, x) => a + (x.flags ? x.flags.added : 0) + (x.money ? x.money.added : 0), 0);
      const kin = Object.values(r.profiles).reduce((a, x) => a + (x.kinder ? x.kinder.added : 0), 0);
      backupMsg.textContent = 'Loaded: ' + P(r.added, 'new result') + ' added, ' + r.skipped + ' already here or skipped.' + (r.hints ? ' Hint log: ' + r.hints.added + ' added.' : '') + (others ? ' ' + others + '.' : '') + (extra ? ' Also added: ' + P(extra, 'flag or money activity record', 'flags and money activity records') + '.' : '') + (kin ? ' Kindergarten: ' + P(kin, 'record') + ' added.' : '') + (r.math && r.math.added ? ' Math flash cards: ' + P(r.math.added, 'round') + ' added.' : '') + (r.recordings && (r.recordings.added || r.recordings.replaced) ? ' Sound recordings: ' + r.recordings.added + ' added' + (r.recordings.replaced ? ', ' + r.recordings.replaced + ' replaced by newer ones' : '') + '.' : '');
      if (r.recordings && JU.recordPage) await JU.recordPage.refresh();
      await renderOthers();
      await render();
      await JU.backup.showBanner(banner, saveBackup);
    } catch (e) {
      backupMsg.textContent = 'That file is not a progress backup, so nothing was changed.';
    }
  });

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
  dlg.addEventListener('close', async () => { if (dlg.returnValue === 'ok') { await JU.storage.clearResults(); await JU.storage.clearHints(); await render(); await JU.backup.showBanner(banner, saveBackup); } dlg.returnValue = ''; });
  document.getElementById('reset-stickers').addEventListener('click', async () => {
    if (window.confirm('Reset all of Julianna\u2019s stickers?')) { await JU.storage.clearStickers(); await render(); }
  });

  /* voice settings */
  (async function voiceSettings() {
    const sel = document.getElementById('voice-select'), rate = document.getElementById('voice-rate');
    const out = document.getElementById('voice-rate-out'), note = document.getElementById('voice-note');
    const msg = document.getElementById('voice-msg'), testBtn = document.getElementById('voice-test');
    if (!JU.speech.supported) {
      sel.disabled = rate.disabled = testBtn.disabled = true;
      note.hidden = false; note.textContent = 'This browser cannot read aloud. Try Chrome or Edge.';
      return;
    }
    await JU.speech.ready();
    const prefs = JU.speech.getPrefs();
    rate.value = prefs.rate; out.textContent = Number(prefs.rate).toFixed(2) + 'x';
    function fillVoices() {
      const list = JU.speech.voices();
      const cur = JU.speech.getPrefs().voice;
      sel.replaceChildren(h('option', { value: '' }, 'Automatic (best one available)'),
        ...list.map(v => h('option', { value: JU.speech.voiceId(v) }, v.name + ' (' + v.lang + ')' + (JU.speech.isGood(v) ? ' \u2605' : ''))));
      sel.value = cur && list.some(v => JU.speech.voiceId(v) === cur) ? cur : '';
      note.hidden = JU.speech.hasGoodVoice();
      note.textContent = 'This device only has a basic voice. For a clearer one, use Chrome or Edge, which often offer Natural or Google voices. On a Chromebook: Settings > Accessibility > Text-to-Speech voices.';
      if (!list.length) note.textContent = 'No English voice was found. ' + note.textContent;
    }
    fillVoices();
    JU.speech.onVoicesChanged(fillVoices);
    sel.addEventListener('change', async () => { await JU.speech.setPrefs({ voice: sel.value }); msg.textContent = 'Saved.'; });
    rate.addEventListener('input', () => { out.textContent = Number(rate.value).toFixed(2) + 'x'; });
    rate.addEventListener('change', async () => { await JU.speech.setPrefs({ rate: Number(rate.value) }); msg.textContent = 'Saved.'; });
    testBtn.addEventListener('click', () => {
      msg.textContent = '';
      JU.speech.dictate('total', 'The total of two plus three is five.');
    });
  })();


  /* ---------- profile switch (Julianna / Dorian / Family) ---------- */
  const VIEWS = ['julianna', 'dorian', 'family'];
  function showView(id) {
    if (VIEWS.indexOf(id) === -1) id = 'julianna';
    VIEWS.forEach(v => {
      document.getElementById('view-' + v).hidden = v !== id;
      document.getElementById('sw-' + v).setAttribute('aria-pressed', v === id ? 'true' : 'false');
      document.getElementById('jump-' + v).hidden = v !== id;       // the Jump to row sits right under the switch
    });
    try { history.replaceState(null, '', id === 'julianna' ? location.pathname : '?p=' + id); } catch (e) { /* not important */ }
  }
  VIEWS.forEach(v => document.getElementById('sw-' + v).addEventListener('click', () => showView(v)));
  /* "Jump to" links: scroll smoothly (instantly for people who prefer reduced motion) and put keyboard focus on the section */
  document.querySelectorAll('.jumpto a[data-jump]').forEach(a => a.addEventListener('click', e => {
    const target = document.getElementById(a.dataset.jump);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: JU.ui.reduced() ? 'auto' : 'smooth', block: 'start' });
    const hd = target.querySelector('h2') || target;
    if (!hd.hasAttribute('tabindex')) hd.setAttribute('tabindex', '-1');
    hd.focus({ preventScroll: true });
  }));
  const startHash = location.hash.slice(1);          // (showView rewrites the address, so remember a #section link first)
  showView(new URLSearchParams(location.search).get('p'));

  /* ---------- Dorian and Family views ---------- */
  const NAMES = { julianna: 'Julianna', dorian: 'Dorian', family: 'The Family' };
  async function renderOthers() {
    const c = await JU.storage.counts();
    document.getElementById('dorian-summary').replaceChildren(
      statCard('Money activities finished', c.dorian.money.done), statCard('Answers saved', c.dorian.results + c.dorian.money.answers + c.dorian.kinder.answers),
      statCard('Stickers', c.dorian.stickers), statCard('Ask a grown-up flags', c.dorian.flags));
    document.getElementById('dorian-empty').hidden = c.dorian.results > 0 || c.dorian.stickers > 0 || c.dorian.money.answers > 0 || c.dorian.money.done > 0 || c.dorian.kinder.answers > 0;
    document.getElementById('family-summary').replaceChildren(statCard('Lessons finished', c.family.lessonsDone + ' of ' + (await JU.money.load()).length), statCard('Games played', c.family.games), statCard('Stickers', c.family.stickers), statCard('Ask a grown-up flags', c.family.flags));
    await renderLessons();
    for (const who of ['julianna', 'dorian', 'family']) await renderFlags(who);
    for (const who of ['julianna', 'dorian']) await renderMoney(who);
    await renderKinder();
  }

  /* "very quick or repeated wrong taps": only worth mentioning when one session had at least RAPID_SESSION_MIN such questions,
     so a short burst (one or two quick taps) never triggers it. Returns { session, n } for the biggest such session, or null. */
  const RAPID_SESSION_MIN = 3;
  function burstSession(rapidLog) {
    const by = {};
    rapidLog.forEach(r => { by[r.session] = (by[r.session] || 0) + 1; });
    const best = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
    return best && by[best] >= RAPID_SESSION_MIN ? { session: best, n: by[best] } : null;
  }
  const rapidNote = n => 'In one session, ' + n + ' questions had very quick or repeated wrong taps. That is common when a child is excited or tired, and those taps do not unlock a hint. If it keeps happening, a friendly chat may help.';

  const kinderTitle = code => (Object.values(JU.kinder.ACTIVITIES).find(a => a.code === Number(code)) || { title: 'Game ' + code }).title;

  /* ---------- Ask a grown-up flags (per profile) ---------- */
  async function renderFlags(who) {
    const box = document.getElementById('flags-' + who);
    const flags = (await JU.storage.profile(who).getFlags()).slice().sort((a, b) => a.ts < b.ts ? 1 : -1);     // newest first
    const lessons = await JU.money.load();
    const title = id => { const l = lessons.find(x => x.id === Number(id)); return 'Lesson ' + id + (l ? ': ' + l.title : ''); };
    const list = box.querySelector('[data-flags-list]'), empty = box.querySelector('[data-flags-empty]'), clr = box.querySelector('[data-flags-clear]');
    empty.hidden = flags.length > 0; clr.hidden = flags.length === 0;
    if (!flags.length) { list.replaceChildren(); return; }
    list.replaceChildren(h('p', { class: 'note', 'data-flags-count': '' }, P(flags.length, 'flag') + ' (newest first). Each one is a place where ' + (who === 'family' ? 'the family' : NAMES[who]) + ' pressed Ask a grown-up.'),
      h('div', { class: 'tablewrap' }, h('table', { class: 'flags-table' },
        h('thead', null, h('tr', null, ['When', 'Where', 'Lesson or game', 'Screen'].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', null, flags.map(f => h('tr', { 'data-flag': f.id }, h('td', null, fmtTime(f.ts)), h('td', null, f.kind === 'kinder' ? 'Kindergarten' : f.kind === 'solo' ? 'Own activity' : 'Family lesson'), h('td', null, f.kind === 'kinder' ? kinderTitle(f.lesson) + (f.item ? ' (' + f.item + ')' : '') : title(f.lesson)), h('td', null, 'Screen ' + f.screen)))))));
  }
  ['julianna', 'dorian', 'family'].forEach(who => {
    document.getElementById('flags-' + who).querySelector('[data-flags-clear]').addEventListener('click', async () => {
      if (!window.confirm('Clear all the Ask a grown-up flags for ' + NAMES[who].replace('The ', '') + '?')) return;
      await JU.storage.profile(who).clearFlags();
      await renderFlags(who);
    });
  });

  /* ---------- Kindergarten (Dorian): letters he knows, words built, hints ---------- */
  async function renderKinder() {
    const box = document.getElementById('kinder-dorian');
    const store = JU.storage.profile('dorian');
    const [letters, cvc, k, hints, sight, counting, adding] = await Promise.all([JU.kinder.loadLetters(), JU.kinder.loadWords(), store.getKinder(), store.getHints(), JU.kinder.loadSight(), JU.kinder.loadCounting(), JU.kinder.loadAdding()]);
    const sm = JU.kinder.summary({ answers: k.answers, rounds: k.rounds, hints }, letters, cvc);
    const lv = await JU.kinder.loadLevels();
    const env = { answers: k.answers, cvc, sight, counting, adding };
    /* v14: a game he has not opened since v14 shows the level its first v14 visit will start at (the old rule) */
    const levelOf = a => {
      const max = JU.kinder.maxLevel(a, lv);
      const raw = (k.levels && k.levels[a]) || Math.max(1, Math.min(max, JU.kinder.legacyLevel(a, env)));
      return Math.max(1, Math.min(max, raw));
    };
    const sg = JU.kinder.sightSummary(k.answers, sight), ct = JU.kinder.countSummary(k.answers, counting, levelOf('count')), ad = JU.kinder.addSummary(k.answers, adding, levelOf('add'));
    const path = JU.kinder.starPath(Object.assign({}, k, { levels: Object.assign({}, ...JU.kinder.LEVELED.map(a => ({ [a]: levelOf(a) }))) }), lv);
    box.querySelector('[data-kinder-levels-note]').textContent = 'Each round is 10 questions. A round is good when at least ' + Math.round(lv.goodShare * 100) + '% of it was right on the first try with no hint. The next level opens after ' + lv.roundsForStar + ' good rounds in a row, or after ' + (lv.rightInARow || 5) + ' right answers in a row inside one round, whichever comes first. Warm-up rounds do not count. If he is stuck or bored, you can open the next level yourself.';
    fillTable(box.querySelector('[data-kinder-levels]'), ['Game', 'Level', 'Stars', 'Good rounds in a row (of ' + lv.roundsForStar + ')', ''],
      path.map(r => [h('strong', null, r.title), h('span', { 'data-level-of': r.activity }, r.level + ' of ' + r.max + ((lv.games[r.activity].labels || [])[r.level - 1] ? ' (' + lv.games[r.activity].labels[r.level - 1] + ')' : '')), h('span', { 'data-stars-of': r.activity }, String(r.stars)), r.streak,
        r.level < r.max ? h('button', { class: 'btn small', type: 'button', 'data-unlock': r.activity, onclick: async () => {
          if (!window.confirm('Open level ' + (r.level + 1) + ' of ' + r.title + ' for Dorian now?')) return;
          await store.setKinderLevel(r.activity, r.level + 1);
          await renderKinder();
          box.querySelector('[data-kinder-levels-msg]').textContent = r.title + ': level ' + (r.level + 1) + ' is open.';
        } }, 'Open level ' + (r.level + 1)) : 'Top level']), 'No games yet.');
    box.querySelector('[data-kinder-empty]').hidden = k.answers.length > 0;
    box.querySelector('[data-kinder-summary]').replaceChildren(
      statCard('Sessions', sm.sessions), statCard('Rounds finished', sm.rounds), statCard('Letters he knows', sm.known), statCard('Letters still learning', sm.learning), statCard('Letters not met yet', sm.notMet),
      statCard('Words built', sm.wordsBuilt), statCard('Sight words he knows', sg.known), statCard('Numbers he knows', ct.known), statCard('Adding facts he knows', ad.known), statCard('Hints used', sm.hintsUsed + sm.grownupUnlocks));
    const word = { known: 'Knows it', learning: 'Still learning', 'new': 'Not met yet' };
    fillTable(box.querySelector('[data-kinder-letters]'), ['Letter', 'Sound the voice says', 'Status', 'Clean sessions (of ' + letters.rules.knownSessions + ')', 'Times seen', 'Missed first time', 'Hints'],
      sm.letterRows.map(r => [h('strong', null, r.letter), r.say, h('span', { class: 'k-status ' + r.status, 'data-letter': r.letter, 'data-status': r.status }, word[r.status]), r.cleanSessions, r.seen, r.misses, r.hints]), 'No letters yet.');
    fillTable(box.querySelector('[data-kinder-words]'), ['Word', 'Times built', 'Right first time', 'Clean sessions (of ' + cvc.rules.knownSessions + ')', 'Hints', 'Status'],
      sm.wordRows.map(r => [h('strong', null, r.word), r.built, r.firstTry, r.cleanSessions, r.hints, r.known ? 'Knows it' : 'Still learning']), 'No words built yet.');
    const kword = { known: 'Knows it', learning: 'Still learning', 'new': 'Not met yet' };
    box.querySelector('[data-kinder-sight-note]').textContent = 'This week\u2019s words (' + (sight.weeks.length ? sight.weeks[sight.weeks.length - 1].label : 'none yet') + '): ' + (sg.focus.map(r => r.word).join(', ') || 'none') + '. ' + (sight.rules.confirmedOnly ? 'Only his confirmed words are used, also as the wrong cards (4 cards, look-alikes such as me/my, it/is, at/am, see/she).' : 'The other Unit 1 words (never tested) only show up as wrong choices.') + ' A word is known after it was right first time, with no hint, in ' + sight.rules.knownSessions + ' different visits.';
    fillTable(box.querySelector('[data-kinder-sight]'), ['Word', 'Week', 'Status', 'Clean visits (of ' + sight.rules.knownSessions + ')', 'Times seen', 'Missed first time', 'Hints'],
      sg.rows.map(r => [h('strong', null, r.word), r.week + (r.focus ? ' (this week)' : ''), h('span', { class: 'k-status ' + r.status, 'data-sight-word': r.word, 'data-status': r.status }, kword[r.status]), r.cleanSessions, r.seen, r.misses, r.hints]), 'No sight words yet.');
    box.querySelector('[data-kinder-count-note]').textContent = 'Open tier: ' + ct.tier + ' of ' + ct.tiers + ' (numbers up to ' + counting.tiers[ct.tier - 1].to + '). Green = knows it, orange = still learning, grey = not yet. Counting along is practice and is not scored' + (ct.along ? ' (' + P(ct.along, 'time') + ' so far)' : '') + '.';
    box.querySelector('[data-kinder-count]').replaceChildren(...ct.strip.map(x => h('li', { class: 'k-strip-n ' + x.status + (x.open ? '' : ' closed'), 'data-count-n': x.n, 'data-status': x.status, title: x.n + ': ' + kword[x.status] + (x.open ? '' : ' (not open yet)') + ', seen ' + x.seen + ', missed ' + x.misses }, String(x.n))));
    box.querySelector('[data-kinder-add-note]').textContent = 'Open tier: ' + ad.tier + ' of ' + ad.tiers + (adding.rules.showSigns ? '. The screen shows the picture groups with + and = signs (no numbers until he answers), and the voice says "plus" and "equals". Two tiers are "how many are left": some pictures fly away (no minus sign). The last tier mixes adding within 10 and take-away within 5.' : '. Shown as words, "2 and 1 more", with no plus or equals signs.');
    fillTable(box.querySelector('[data-kinder-add]'), ['Fact', 'Status', 'Clean visits (of ' + adding.rules.knownSessions + ')', 'Times seen', 'Missed first time', 'Hints'],
      ad.rows.map(r => [h('strong', null, r.take ? r.a + ', ' + r.b + ' fly away' : adding.rules.showSigns ? r.a + ' + ' + r.b : r.a + ' and ' + (r.b === 0 ? 'none' : r.b) + ' more') , h('span', { class: 'k-status ' + r.status, 'data-fact': r.id, 'data-status': r.status }, r.open ? kword[r.status] : 'Not open yet'), r.cleanSessions, r.seen, r.misses, r.hints]), 'No facts yet.');
    const kburst = burstSession(hints.filter(r => r.subject === 'kinder' && r.kind === 'rapid'));
    const slipped = Object.keys(sm.slips).sort((a, b) => sm.slips[b] - sm.slips[a]);
    box.querySelector('[data-kinder-note]').textContent = (slipped.length ? 'Letters he tapped by mistake while building: ' + slipped.map(l => l + ' (' + sm.slips[l] + ')').join(', ') + '. ' : '')
      + (kburst ? rapidNote(kburst.n) + ' ' : '')
      + (sm.rounds || sm.answers ? 'Open word tier: ' + sm.tier + ' of ' + cvc.tiers.length + '.' : '');
  }
  document.getElementById('kinder-clear').addEventListener('click', async () => {
    if (!window.confirm('Clear Dorian\u2019s kindergarten results, stickers and hints? His flags, money activities and everyone else\u2019s results are not touched.')) return;
    await JU.storage.profile('dorian').clearKinder();
    document.querySelector('[data-kinder-clear-msg]').textContent = 'Cleared Dorian\u2019s kindergarten results.';
    await renderOthers();
  });

  /* ---------- Money & Economics: a child's own follow-on activities ---------- */
  async function renderMoney(who) {
    const box = document.getElementById('money-' + who);
    const store = JU.storage.profile(who), m = await store.getMoney();
    const lessons = (await JU.money.load()).filter(l => l.status === 'ready');
    const hints = (await store.getHints()).filter(r => r.subject === 'money');
    const ok = m.answers.filter(a => a.correct).length;
    box.querySelector('[data-money-summary]').replaceChildren(
      statCard('Activities finished', Object.keys(m.done).length + ' of ' + lessons.length), statCard('Answers saved', m.answers.length),
      statCard('Right on the first try', pct(ok, m.answers.length)), statCard('Hints used', hints.filter(r => r.kind === 'hint').length));
    const rows = lessons.map(l => {
      const as = m.answers.filter(a => a.lesson === l.id), hs = hints.filter(r => r.game === 'money-' + l.id);
      return [h('span', null, 'Lesson ' + l.id + ': ' + l.title + ' ', h('a', { class: 'small-link', href: 'solo.html?n=' + l.id + '&p=' + who, 'aria-label': 'Preview lesson ' + l.id + ' (nothing is saved)' }, 'Preview')), m.done[String(l.id)] ? 'Finished ' + fmtTime(m.done[String(l.id)]) : 'Not yet',
        as.length ? as.filter(a => a.correct).length + ' of ' + as.length + ' (' + pct(as.filter(a => a.correct).length, as.length) + ')' : '\u2013',
        hs.filter(r => r.kind === 'hint').length, hs.filter(r => r.kind === 'grownup').length, hs.filter(r => r.kind === 'rapid').length];
    });
    fillTable(box.querySelector('[data-money-table]'), ['Lesson', 'Own activity', 'Right on the first try', 'Hints used', 'Grown-up unlocks', 'Quick-guess flags'], rows, 'No lessons yet.');
    const note = box.querySelector('[data-money-note]');
    const guesses = hints.filter(r => r.kind === 'rapid').length;
    const burst = burstSession(hints.filter(r => r.kind === 'rapid'));
    note.textContent = burst ? rapidNote(burst.n) : '';
  }

  /* Family lesson unlock panel */
  const fam = JU.storage.profile('family');
  async function renderLessons() {
    const lessons = await JU.money.load();
    const state = await fam.getLessonState();
    const rows = JU.money.resolve(lessons, state);
    const natural = i => i === 0 || !!state.complete[String(lessons[i - 1].id)];
    const word = { locked: 'Locked', open: 'Open', complete: 'Complete' };
    document.getElementById('lessons-table').replaceChildren(
      h('thead', null, h('tr', null, ['#', 'Lesson', 'Now', 'Open or lock', 'Done?'].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.map((l, i) => {
        const locked = l.state === 'locked';
        return h('tr', { 'data-lesson': l.id, 'data-state': l.state },
          h('td', { 'data-label': 'Lesson' }, String(l.id)),
          h('td', null, h('span', { class: 'note' }, 'Unit ' + l.unit + ' \u2022 '), l.title),
          h('td', { class: 'l-state', 'data-label': 'Now' }, word[l.state] + (l.override === 'open' && l.state !== 'complete' ? ' (opened early)' : '') + (l.override === 'locked' ? ' (locked by a grown-up)' : '')),
          h('td', null, h('button', { type: 'button', class: 'btn small l-lock', 'aria-label': (locked ? 'Unlock lesson ' : 'Re-lock lesson ') + l.id + ': ' + l.title,
            onclick: async () => {
              if (locked) await fam.setLessonOverride(l.id, natural(i) ? null : 'open');
              else await fam.setLessonOverride(l.id, natural(i) ? 'locked' : null);
              await renderOthers();
            } }, locked ? 'Unlock' : 'Re-lock')),
          h('td', null, h('button', { type: 'button', class: 'btn small l-done', 'aria-label': (l.complete ? 'Mark not complete: lesson ' : 'Mark complete: lesson ') + l.id + ': ' + l.title,
            onclick: async () => { await fam.setLessonComplete(l.id, !l.complete); await renderOthers(); await JU.backup.showBanner(banner, saveBackup); } }, l.complete ? 'Mark not complete' : 'Mark complete')));
      })));
  }

  /* ---------- Back up to Grok Bot / Ideas ----------
     Address is typed once and kept only in this browser (localStorage). Never in a site file or the backup file.
     When the device can share a file (navigator.canShare with files), Back up attaches the .json in the share sheet.
     Otherwise it downloads the file and opens a pre-filled mailto:; the grown-up attaches the file and presses Send. */
  const EMAIL_KEY = 'ju_backup_email_v1';          // this browser only
  const EMAIL_RE = /^[^\s@,;?&<>"]+@[^\s@,;?&<>"]+\.[^\s@,;?&<>"]+$/;
  const SITE_VER = 'v17';
  const emailBox = document.getElementById('backup-email'), emailMsg = document.getElementById('email-msg');
  const emailSaved = document.getElementById('email-saved'), emailEdit = document.getElementById('email-edit');
  const emailBtn = document.getElementById('email-backup'), emailSteps = document.getElementById('email-steps');
  const emailCopy = document.getElementById('email-copy');
  const NEED_ADDR = 'Type the backup address once first.';
  function getAddr() { try { const v = JSON.parse(localStorage.getItem(EMAIL_KEY)); return typeof v === 'string' && EMAIL_RE.test(v) ? v : ''; } catch (e) { return ''; } }
  function showEmail(editing) {
    const addr = getAddr();
    emailSaved.hidden = !addr || editing; emailEdit.hidden = !!addr && !editing;
    document.getElementById('email-sending').textContent = addr ? 'Sending to: ' + addr : '';
    emailBtn.disabled = !addr;
    if (!addr) emailMsg.textContent = NEED_ADDR;
    if (addr && editing) emailBox.value = addr;
  }
  function saveAddr() {
    const v = emailBox.value.trim();
    if (!EMAIL_RE.test(v)) { emailMsg.textContent = 'That does not look like an email address. Please check it.'; emailBox.focus(); return; }
    localStorage.setItem(EMAIL_KEY, JSON.stringify(v));
    emailBox.value = '';
    emailMsg.textContent = '';
    showEmail(false);
  }
  async function copyAddr() {
    const addr = getAddr(); if (!addr) return;
    try { await navigator.clipboard.writeText(addr); emailMsg.textContent = 'Copied: ' + addr; }
    catch (e) { emailMsg.textContent = 'Copy failed. Select the address above and copy it yourself.'; }
  }
  document.getElementById('email-save').addEventListener('click', saveAddr);
  emailBox.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveAddr(); } });
  document.getElementById('email-change').addEventListener('click', () => { showEmail(true); emailBox.focus(); emailBox.select(); });
  emailCopy.addEventListener('click', copyAddr);
  showEmail(false);
  async function summaryText() {
    const c = await JU.storage.counts(), last = await JU.storage.getLastBackup(), total = (await JU.money.load()).length;
    const day = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const games = n => n === 1 ? '1 game' : n + ' games';
    const moneyBit = m => m.done ? ', ' + P(m.done, 'money activity', 'money activities') + ' finished' : '';
    const flagBits = [['Julianna', c.julianna.flags], ['Dorian', c.dorian.flags], ['Family', c.family.flags]].filter(x => x[1]).map(x => P(x[1], 'flag') + ' for ' + x[0]);
    return ['Learning progress summary (' + day(new Date().toISOString()) + ')',
      '',
      'Julianna: ' + P(c.julianna.results, 'word') + ' practiced, ' + (c.julianna.games === 1 ? '1 game or test' : c.julianna.games + ' games and tests') + ', ' + P(c.julianna.stickers, 'sticker') + ', ' + P(c.julianna.hints, 'hint log entry', 'hint log entries') + moneyBit(c.julianna.money) + (c.julianna.math && c.julianna.math.rounds ? ', ' + P(c.julianna.math.rounds, 'flash-card round') + ' (best ' + c.julianna.math.best + ')' : ''),
      'Dorian: ' + P(c.dorian.results + c.dorian.money.answers + c.dorian.kinder.answers, 'answer') + ' saved, ' + games(c.dorian.games) + ', ' + P(c.dorian.stickers, 'sticker') + moneyBit(c.dorian.money) + (c.dorian.kinder.rounds ? ', ' + P(c.dorian.kinder.rounds, 'kindergarten round') + ' finished' : ''),
      'Family: ' + c.family.lessonsDone + ' of ' + total + ' money lessons finished',
      flagBits.length ? 'Ask a grown-up flags waiting: ' + flagBits.join(', ') : null,
      '',
      'Last backup file saved: ' + (last ? day(last) : 'never'),
      '',
      'This is only a summary of counts. The real backup is the attached file.'].filter(x => x !== null).join('\n');
  }
  function backupSubject(date) { return 'Family Learning backup ' + date; }
  function backupMailBody(saved) {
    return ['This is the weekly backup for the family learning site.',
      'Please attach the file named ' + saved.fileName + ', from your Downloads folder, then press Send.',
      (saved.zip ? 'The attachment is a zip that holds the progress JSON (so large backups with recordings are not truncated).' : null),
      'Nothing else is needed. The bot saves it. You do not need to wait for a reply.',
      saved.recordings ? 'The file includes ' + saved.recordings + ' sound recording(s), so it is about ' + saved.size + '.' : null].filter(x => x !== null).join('\n');
  }
  function showMailSteps(fileName) {
    emailSteps.hidden = false;
    emailSteps.innerHTML = '';
    [['1', 'The file was saved as <strong>' + fileName + '</strong> in your Downloads folder.'],
     ['2', 'Your email app should open with the message filled in (to the Grok Bot inbox above).'],
     ['3', 'Attach that file (drag it in from Downloads).'],
     ['4', 'Press Send. Nothing is sent until you do.']].forEach(([n, html]) => {
      const li = document.createElement('li'); li.innerHTML = '<span class="email-step-n">' + n + '</span> ' + html; emailSteps.appendChild(li);
    });
  }
  function canShareFile(file) {
    try { return !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { return false; }
  }
  emailBtn.addEventListener('click', async () => {
    const addr = getAddr();
    if (!addr) { showEmail(false); return; }
    emailBtn.disabled = true; emailSteps.hidden = true; emailMsg.textContent = '';
    try {
      const saved = await makeBackupZip();
      const file = new File([saved.blob], saved.fileName, { type: 'application/zip' });
      const subject = backupSubject(saved.date);
      const shareText = 'Family learning backup for ' + saved.date + ' (zip with the JSON inside). Please send this file to ' + addr + '.';
      if (canShareFile(file)) {
        emailMsg.textContent = 'Send the backup file to: ' + addr + ' (Copy address first if your share sheet cannot pick a recipient).';
        try {
          await navigator.share({ files: [file], title: subject, text: shareText });
          emailMsg.textContent = 'Share sheet opened. Send the file to ' + addr + '. Nothing is sent until you choose a recipient and confirm.';
        } catch (e) {
          if (e && e.name === 'AbortError') { emailMsg.textContent = 'Share was cancelled. Nothing was sent.'; return; }
          downloadBlob(saved.blob, saved.fileName);
          const body = backupMailBody(saved) + '\n\n' + await summaryText();
          const url = 'mailto:' + encodeURIComponent(addr).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          emailBtn.dataset.mailto = url;
          const a = h('a', { href: url }); document.body.appendChild(a); a.click(); a.remove();
          showMailSteps(saved.fileName);
          emailMsg.textContent = 'Could not share the file here, so it was saved as ' + saved.fileName + ' and your email app should open. Attach that file and press Send.';
        }
      } else {
        downloadBlob(saved.blob, saved.fileName);
        const body = backupMailBody(saved) + '\n\n' + await summaryText();
        const url = 'mailto:' + encodeURIComponent(addr).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        emailBtn.dataset.mailto = url;
        const a = h('a', { href: url }); document.body.appendChild(a); a.click(); a.remove();
        showMailSteps(saved.fileName);
        emailMsg.textContent = 'The backup file was saved as ' + saved.fileName + '. Follow the steps below. Nothing is sent until you press Send.';
      }
    } finally { emailBtn.disabled = !getAddr(); }
  });

  /* Ideas and changes: mailto / share to the same saved Grok Bot address. Nothing automatic. */
  const ideaText = document.getElementById('idea-text'), ideaMsg = document.getElementById('idea-msg');
  const ideaSend = document.getElementById('idea-send'), ideaShare = document.getElementById('idea-share');
  function ideaWho() { const el = document.querySelector('input[name="idea-who"]:checked'); return el ? el.value : 'Other'; }
  function ideaFirstWords(t) {
    const words = t.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean).slice(0, 8).join(' ');
    return words || 'note';
  }
  function ideaSubject(t) { return 'Family Learning idea: ' + ideaFirstWords(t); }
  function ideaBody(t) {
    return ['From: ' + ideaWho(),
      'Page: parent (Ideas and changes)',
      'Site: Family Learning ' + SITE_VER,
      '',
      t.trim()].join('\n');
  }
  function openMailto(addr, subject, body) {
    const url = 'mailto:' + encodeURIComponent(addr).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    ideaSend.dataset.mailto = url;
    const a = h('a', { href: url }); document.body.appendChild(a); a.click(); a.remove();
    return url;
  }
  function refreshIdeaShare() {
    const can = !!(navigator.share);
    ideaShare.hidden = !can;
  }
  refreshIdeaShare();
  ideaSend.addEventListener('click', () => {
    const addr = getAddr(), note = ideaText.value.trim();
    if (!addr) { ideaMsg.textContent = 'Save the Grok Bot inbox address in Back up to Grok Bot above first.'; document.getElementById('email-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); showEmail(false); return; }
    if (!note) { ideaMsg.textContent = 'Type a short note first.'; ideaText.focus(); return; }
    openMailto(addr, ideaSubject(note), ideaBody(note));
    ideaMsg.textContent = 'Your email app should open to ' + addr + '. Press Send when you are ready. Nothing is sent until you do.';
  });
  ideaShare.addEventListener('click', async () => {
    const addr = getAddr(), note = ideaText.value.trim();
    if (!addr) { ideaMsg.textContent = 'Save the Grok Bot inbox address in Back up to Grok Bot above first.'; return; }
    if (!note) { ideaMsg.textContent = 'Type a short note first.'; ideaText.focus(); return; }
    const subject = ideaSubject(note), body = ideaBody(note);
    try {
      await navigator.share({ title: subject, text: body + '\n\n(Send to: ' + addr + ')' });
      ideaMsg.textContent = 'Share sheet opened. Send it to ' + addr + '. Nothing is sent until you confirm.';
    } catch (e) {
      if (e && e.name === 'AbortError') { ideaMsg.textContent = 'Share was cancelled. Nothing was sent.'; return; }
      openMailto(addr, subject, body);
      ideaMsg.textContent = 'Share was not available, so your email app should open instead.';
    }
  });

  await renderOthers();
  await render();
  const startTarget = startHash && document.getElementById(startHash);
  if (startTarget && startTarget.offsetParent) startTarget.scrollIntoView({ behavior: 'auto', block: 'start' });      // a link such as parent.html?p=dorian#money-dorian
})();
