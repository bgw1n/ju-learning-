(async function () {
  const h = JU.ui.h;
  JU.ui.header({ title: 'Grown-up page', showDashLink: false });

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
    const count = Object.values(st).reduce((a, w) => a + Object.keys(w).length, 0);
    document.getElementById('stickernote').textContent = 'Stickers earned so far: ' + count;
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
    const log = (await JU.storage.getHints()).filter(r => sel === 'all' || r.week === sel);
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
  async function saveBackup() {
    const data = { app: 'ju-learning', version: 2, exportedAt: new Date().toISOString(),
      results: await JU.storage.getResults(), stickers: await JU.storage.getStickers(), hints: await JU.storage.getHints() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'julianna-progress-' + JU.ui.localDate(data.exportedAt) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    await JU.storage.setLastBackup(data.exportedAt);
    backupMsg.textContent = 'Saved a backup with ' + data.results.length + ' results. Keep the file somewhere safe.';
    await JU.backup.showBanner(banner, saveBackup);
  }
  document.getElementById('save-progress').addEventListener('click', saveBackup);
  JU.backup.showBanner(banner, saveBackup);
  const loadFile = document.getElementById('load-file');
  document.getElementById('load-progress').addEventListener('click', () => loadFile.click());
  loadFile.addEventListener('change', async () => {
    const f = loadFile.files[0]; loadFile.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== 'ju-learning' || !Array.isArray(data.results)) throw new Error('not a backup');
      const r = await JU.storage.importResults(data.results);
      await JU.storage.importStickers(data.stickers);
      /* older backups (version 1) have no hint log */
      const hr = Array.isArray(data.hints) ? await JU.storage.importHints(data.hints) : null;
      backupMsg.textContent = 'Loaded: ' + r.added + ' new results added, ' + r.skipped + ' already here or skipped.' + (hr ? ' Hint log: ' + hr.added + ' added.' : '');
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

  await render();
})();
