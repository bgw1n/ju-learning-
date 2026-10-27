/* storage.js - the ONLY place that reads or writes saved data.
   Today it uses this browser's localStorage. To share results between devices later,
   replace the bodies of these functions with calls to a backend (every function is async
   on purpose, so callers will not need to change).

   Result record shape (one per word, per game/test play):
   { id, ts (ISO), session, week, subject, type ('unscramble'|'hangman'|'match'|'listen'|'clap'|'test'),
     proctored (bool), word, typed (first answer), typedAll (every answer, in order),
     correct (bool, right on the first try, or for hangman with 2 or fewer missed letters),
     tries (number of answers submitted), hinted (true when the spoken hint was used on that word; then correct is false) }

   Hint log record shape (separate from results, key ju_hints_v1; part of the Save progress backup):
   { id, ts (ISO), session, week, subject, game, word,
     kind ('hint' = the spoken hint was used | 'grownup' = a grown-up unlocked the hint with the PIN | 'rapid' = quick wrong answers flagged),
     earned (bool, only for 'hint': true when she earned it with 2 real tries), how ('earned'|'grownup', only for 'hint') } */
(function () {
  const RESULTS_KEY = 'ju_results_v1';
  const STICKERS_KEY = 'ju_stickers_v1';
  const VOICE_KEY = 'ju_voice_v1';
  const HINTS_KEY = 'ju_hints_v1';

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  JU.storage = {
    kind: 'localStorage',
    async getResults() { return read(RESULTS_KEY, []); },
    async addResult(rec) {
      const all = read(RESULTS_KEY, []);
      all.push(rec);
      write(RESULTS_KEY, all);
      return rec;
    },
    /* Merge a list of result records (from a backup file) without duplicating.
       Same id, or the same session + game + word + time, counts as a duplicate. Returns { added, skipped }. */
    async importResults(list) {
      const all = read(RESULTS_KEY, []);
      const key = r => [r.session, r.type, r.word, r.ts].join('|');
      const ids = new Set(all.map(r => r.id)), keys = new Set(all.map(key));
      let added = 0, skipped = 0;
      (Array.isArray(list) ? list : []).forEach(r => {
        const ok = r && typeof r.word === 'string' && typeof r.week === 'string' && typeof r.type === 'string' && typeof r.ts === 'string';
        if (!ok) { skipped++; return; }
        if ((r.id && ids.has(r.id)) || keys.has(key(r))) { skipped++; return; }
        const rec = Object.assign({}, r, { id: r.id || (JU.ui.uid()), subject: r.subject || 'spelling', correct: !!r.correct, proctored: !!r.proctored });
        all.push(rec); ids.add(rec.id); keys.add(key(rec)); added++;
      });
      all.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
      write(RESULTS_KEY, all);
      return { added, skipped };
    },
    /* Merge stickers from a backup, keeping the earliest time for each. */
    async importStickers(obj) {
      const all = read(STICKERS_KEY, {});
      if (obj && typeof obj === 'object') for (const wk in obj) {
        if (!obj[wk] || typeof obj[wk] !== 'object') continue;
        all[wk] = all[wk] || {};
        for (const k in obj[wk]) if (!all[wk][k] || String(obj[wk][k]) < all[wk][k]) all[wk][k] = String(obj[wk][k]);
      }
      write(STICKERS_KEY, all);
    },
    async clearResults() { localStorage.removeItem(RESULTS_KEY); },
    /* stickers: { "<weekId>": { "<subject>:<gameId>": "<ISO time earned>" } } */
    async getStickers() { return read(STICKERS_KEY, {}); },
    async earnSticker(weekId, gameKey) {
      const all = read(STICKERS_KEY, {});
      all[weekId] = all[weekId] || {};
      const isNew = !all[weekId][gameKey];
      if (isNew) all[weekId][gameKey] = new Date().toISOString();
      write(STICKERS_KEY, all);
      return isNew;
    },
    /* Voice settings for this device only: { voice: <voiceURI or ''>, rate: 0.6-1.1 }. Not part of scores or backups. */
    async getVoicePrefs() { return read(VOICE_KEY, null); },
    async setVoicePrefs(p) { write(VOICE_KEY, p); return p; },
    /* ---- hint log ---- */
    async getHints() { return read(HINTS_KEY, []); },
    async addHint(rec) {
      const all = read(HINTS_KEY, []);
      all.push(rec);
      write(HINTS_KEY, all);
      return rec;
    },
    /* Merge hint records from a backup without duplicating (same id, or same session + game + word + kind + time). Returns { added, skipped }. */
    async importHints(list) {
      const all = read(HINTS_KEY, []);
      const key = r => [r.session, r.game, r.word, r.kind, r.ts].join('|');
      const ids = new Set(all.map(r => r.id)), keys = new Set(all.map(key));
      let added = 0, skipped = 0;
      (Array.isArray(list) ? list : []).forEach(r => {
        const ok = r && typeof r.word === 'string' && typeof r.week === 'string' && typeof r.game === 'string' && typeof r.ts === 'string' && ['hint', 'grownup', 'rapid'].indexOf(r.kind) !== -1;
        if (!ok) { skipped++; return; }
        if ((r.id && ids.has(r.id)) || keys.has(key(r))) { skipped++; return; }
        const rec = Object.assign({}, r, { id: r.id || JU.ui.uid(), subject: r.subject || 'spelling' });
        all.push(rec); ids.add(rec.id); keys.add(key(rec)); added++;
      });
      all.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
      write(HINTS_KEY, all);
      return { added, skipped };
    },
    async clearHints() { localStorage.removeItem(HINTS_KEY); },
    async clearStickers() { localStorage.removeItem(STICKERS_KEY); }
  };
})();
