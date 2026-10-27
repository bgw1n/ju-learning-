/* storage.js - the ONLY place that reads or writes saved data.
   Today it uses this browser's localStorage. To share results between devices later,
   replace the bodies of these functions with calls to a backend (every function is async
   on purpose, so callers will not need to change).

   Result record shape (one per word, per game/test play):
   { id, ts (ISO), session, week, subject, type ('unscramble'|'hangman'|'match'|'listen'|'clap'|'test'),
     proctored (bool), word, typed (first answer), typedAll (every answer, in order),
     correct (bool, right on the first try, or for hangman with 2 or fewer missed letters),
     tries (number of answers submitted) } */
(function () {
  const RESULTS_KEY = 'ju_results_v1';
  const STICKERS_KEY = 'ju_stickers_v1';

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
    async clearStickers() { localStorage.removeItem(STICKERS_KEY); }
  };
})();
