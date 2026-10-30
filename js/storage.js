/* storage.js - the ONLY place that reads or writes saved data.
   Today it uses this browser's localStorage. To share results between devices later,
   replace the bodies of these functions with calls to a backend (every function is async
   on purpose, so callers will not need to change).

   Result record shape (one per word, per game/test play):
   { id, ts (ISO), session, week, subject, type ('unscramble'|'hangman'|'match'|'listen'|'clap'|'test'),
     proctored (bool), word, typed (first answer), typedAll (every answer, in order),
     correct (bool, right on the first try, or for hangman with 2 or fewer missed letters),
     tries (number of answers submitted), hinted (true when the spoken hint was used on that word; then correct is false) }

   PROFILES (v6): every profile has its own copy of this storage, so scores never mix.
     JU.storage                    is Julianna's (her keys are the same as before v6: ju_results_v1, ju_stickers_v1, ju_hints_v1)
     JU.storage.profile('dorian')  keys ju_dorian_results_v1, ju_dorian_stickers_v1, ju_dorian_hints_v1
     JU.storage.profile('family')  keys ju_family_results_v1, ju_family_stickers_v1, ju_family_hints_v1, plus ju_family_lessons_v1
   Family lesson state (key ju_family_lessons_v1): { complete: { "<lessonId>": "<ISO time>" }, override: { "<lessonId>": "open" | "locked" } }.
   Voice settings and the last backup date are about this device, so they are shared by all profiles.

   v8 adds, for every profile: flags (key ju_<profile>_flags_v1, Julianna's ju_flags_v1) and money solo results (ju_<profile>_money_v1, Julianna's ju_money_v1).

   v9 adds the kindergarten track results (key ju_<profile>_kinder_v1; only Dorian uses it): answers and finished rounds. Its stickers use week id 'kinder', its hint log entries subject 'kinder'.

   Last backup date (key ju_lastbackup_v1): one ISO time, set when Save progress downloads a backup. Used only to show the backup reminder.

   Hint log record shape (separate from results, key ju_hints_v1; part of the Save progress backup):
   { id, ts (ISO), session, week, subject, game, word,
     kind ('hint' = the spoken hint was used | 'grownup' = a grown-up unlocked the hint with the PIN | 'rapid' = quick wrong answers flagged),
     earned (bool, only for 'hint': true when she earned it with 2 real tries), how ('earned'|'grownup', only for 'hint') } */
(function () {
  const VOICE_KEY = 'ju_voice_v1';
  const BACKUP_KEY = 'ju_lastbackup_v1';
  const PROFILES = ['julianna', 'dorian', 'family'];

  function read(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  function moneyClean(v) {
    const m = { done: {}, answers: [] };
    if (isObj(v)) {
      if (isObj(v.done)) for (const k in v.done) if (typeof v.done[k] === 'string') m.done[k] = v.done[k];
      if (Array.isArray(v.answers)) m.answers = v.answers.filter(r => r && typeof r === 'object');
    }
    return m;
  }

  const KINDER_ACTIVITIES = ['letters', 'build', 'sight', 'count', 'add'];       // (v12: round 2 adds sight, count and add; the backup version stays 5)
  function kinderClean(v) {
    const k = { answers: [], rounds: [] };
    if (isObj(v)) {
      if (Array.isArray(v.answers)) k.answers = v.answers.filter(r => r && typeof r === 'object');
      if (Array.isArray(v.rounds)) k.rounds = v.rounds.filter(r => r && typeof r === 'object');
    }
    return k;
  }

  /* The storage for one profile. Julianna's keys keep their old names, so her saved data still loads. */
  function make(id) {
    const mid = id === 'julianna' ? '' : id + '_';
    const RESULTS_KEY = 'ju_' + mid + 'results_v1';
    const STICKERS_KEY = 'ju_' + mid + 'stickers_v1';
    const HINTS_KEY = 'ju_' + mid + 'hints_v1';
    const LESSONS_KEY = 'ju_family_lessons_v1';
    const FLAGS_KEY = 'ju_' + mid + 'flags_v1';
    const MONEY_KEY = 'ju_' + mid + 'money_v1';
    const KINDER_KEY = 'ju_' + mid + 'kinder_v1';

    const api = {
      kind: 'localStorage',
      id,
      keys: { results: RESULTS_KEY, stickers: STICKERS_KEY, hints: HINTS_KEY, flags: FLAGS_KEY, money: MONEY_KEY, kinder: KINDER_KEY },
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
        if (added) { all.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); write(RESULTS_KEY, all); }
        return { added, skipped };
      },
      /* Merge stickers from a backup, keeping the earliest time for each. */
      async importStickers(obj) {
        const all = read(STICKERS_KEY, {});
        let changed = false;
        if (obj && typeof obj === 'object') for (const wk in obj) {
          if (!obj[wk] || typeof obj[wk] !== 'object') continue;
          all[wk] = all[wk] || {};
          for (const k in obj[wk]) if (!all[wk][k] || String(obj[wk][k]) < all[wk][k]) { all[wk][k] = String(obj[wk][k]); changed = true; }
        }
        if (changed) write(STICKERS_KEY, all);
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
        if (added) { all.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); write(HINTS_KEY, all); }
        return { added, skipped };
      },
      async clearHints() { localStorage.removeItem(HINTS_KEY); },
      async clearStickers() { localStorage.removeItem(STICKERS_KEY); },

      /* ---- "Ask a grown-up" flags (v8). Record: { id, ts, profile, kind ('lesson' | 'solo' | 'kinder'), lesson (number; for 'kinder' 1 = Letter sounds, 2 = Build a word), screen (number, 1-based), item? (v9: the letter or word on screen) } ---- */
      async getFlags() { return read(FLAGS_KEY, []); },
      async addFlag(rec) {
        const all = read(FLAGS_KEY, []);
        const r = Object.assign({ id: JU.ui.uid(), ts: new Date().toISOString(), profile: id }, rec);
        all.push(r);
        write(FLAGS_KEY, all);
        return r;
      },
      /* Merge flags from a backup without duplicating (same id, or same kind + lesson + screen + time). Returns { added, skipped }. */
      async importFlags(list) {
        const all = read(FLAGS_KEY, []);
        const key = r => [r.kind, r.lesson, r.screen, r.ts].join('|');
        const ids = new Set(all.map(r => r.id)), keys = new Set(all.map(key));
        let added = 0, skipped = 0;
        (Array.isArray(list) ? list : []).forEach(r => {
          const ok = r && typeof r.ts === 'string' && (r.kind === 'lesson' || r.kind === 'solo' || r.kind === 'kinder') && isFinite(Number(r.lesson));
          if (!ok) { skipped++; return; }
          if ((r.id && ids.has(r.id)) || keys.has(key(r))) { skipped++; return; }
          const rec = Object.assign({}, r, { id: r.id || JU.ui.uid(), profile: id, lesson: Number(r.lesson) });
          all.push(rec); ids.add(rec.id); keys.add(key(rec)); added++;
        });
        if (added) { all.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); write(FLAGS_KEY, all); }
        return { added, skipped };
      },
      async clearFlags() { localStorage.removeItem(FLAGS_KEY); },

      /* ---- Money & Economics solo activities (v8), kept apart from the spelling results ----
         { done: { "<lessonId>": "<ISO time finished>" }, answers: [ { id, ts, session, lesson, q, kind ('choose'|'sort'|'count'), correct (right on the first try, no hint), tries, hinted } ] } */
      async getMoney() { return moneyClean(read(MONEY_KEY, null)); },
      async addMoneyAnswer(rec) {
        const m = moneyClean(read(MONEY_KEY, null));
        const r = Object.assign({ id: JU.ui.uid(), ts: new Date().toISOString() }, rec);
        m.answers.push(r);
        write(MONEY_KEY, m);
        return r;
      },
      async setSoloDone(lessonId) {
        const m = moneyClean(read(MONEY_KEY, null));
        if (!m.done[String(lessonId)]) m.done[String(lessonId)] = new Date().toISOString();
        write(MONEY_KEY, m);
        return m;
      },
      /* Merge from a backup without duplicating (same id, or same session + lesson + question + time; the earliest finish time is kept). Returns { added, skipped }. */
      async importMoney(obj) {
        const m = moneyClean(read(MONEY_KEY, null)), inc = moneyClean(obj);
        const key = r => [r.session, r.lesson, r.q, r.ts].join('|');
        const ids = new Set(m.answers.map(r => r.id)), keys = new Set(m.answers.map(key));
        let added = 0, skipped = 0, changed = false;
        (isObj(obj) && Array.isArray(obj.answers) ? obj.answers : []).forEach(r => {
          const ok = r && typeof r.ts === 'string' && typeof r.q === 'string' && isFinite(Number(r.lesson));
          if (!ok) { skipped++; return; }
          if ((r.id && ids.has(r.id)) || keys.has(key(r))) { skipped++; return; }
          const rec = Object.assign({}, r, { id: r.id || JU.ui.uid(), lesson: Number(r.lesson), correct: !!r.correct });
          m.answers.push(rec); ids.add(rec.id); keys.add(key(rec)); added++; changed = true;
        });
        for (const k in inc.done) if (!m.done[k] || inc.done[k] < m.done[k]) { if (!m.done[k]) added++; m.done[k] = inc.done[k]; changed = true; }
        if (changed) { m.answers.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); write(MONEY_KEY, m); }
        return { added, skipped };
      },
      async clearMoney() { localStorage.removeItem(MONEY_KEY); },

      /* ---- Kindergarten track (v9), kept apart from every other result. See js/kinder.js for the record shapes. ----
         { answers: [ { id, ts, session, round, activity ('letters'|'build'|'sight'|'count'|'add'), item, correct, tries, hinted, wrong | letters } ],
           rounds:  [ { id, ts, session, activity, items, clean } ] } */
      async getKinder() { return kinderClean(read(KINDER_KEY, null)); },
      async addKinderAnswer(rec) {
        const k = kinderClean(read(KINDER_KEY, null));
        const r = Object.assign({ id: JU.ui.uid(), ts: new Date().toISOString() }, rec);
        k.answers.push(r);
        write(KINDER_KEY, k);
        return r;
      },
      async addKinderRound(rec) {
        const k = kinderClean(read(KINDER_KEY, null));
        const r = Object.assign({ id: JU.ui.uid(), ts: new Date().toISOString() }, rec);
        k.rounds.push(r);
        write(KINDER_KEY, k);
        return r;
      },
      /* Merge from a backup without duplicating: an answer with the same id, or the same session + activity + item + time; a round with the same id, or the same session + activity + time. Returns { added, skipped }. */
      async importKinder(obj) {
        const k = kinderClean(read(KINDER_KEY, null));
        const akey = r => [r.session, r.activity, r.item, r.ts].join('|'), rkey = r => [r.session, r.activity, r.ts].join('|');
        const aids = new Set(k.answers.map(r => r.id)), akeys = new Set(k.answers.map(akey));
        const rids = new Set(k.rounds.map(r => r.id)), rkeys = new Set(k.rounds.map(rkey));
        let added = 0, skipped = 0;
        const src = isObj(obj) ? obj : {};
        (Array.isArray(src.answers) ? src.answers : []).forEach(r => {
          const ok = r && typeof r.ts === 'string' && typeof r.item === 'string' && KINDER_ACTIVITIES.indexOf(r.activity) >= 0;
          if (!ok) { skipped++; return; }
          if ((r.id && aids.has(r.id)) || akeys.has(akey(r))) { skipped++; return; }
          const rec = Object.assign({}, r, { id: r.id || JU.ui.uid(), correct: !!r.correct });
          k.answers.push(rec); aids.add(rec.id); akeys.add(akey(rec)); added++;
        });
        (Array.isArray(src.rounds) ? src.rounds : []).forEach(r => {
          const ok = r && typeof r.ts === 'string' && KINDER_ACTIVITIES.indexOf(r.activity) >= 0;
          if (!ok) { skipped++; return; }
          if ((r.id && rids.has(r.id)) || rkeys.has(rkey(r))) { skipped++; return; }
          const rec = Object.assign({}, r, { id: r.id || JU.ui.uid() });
          k.rounds.push(rec); rids.add(rec.id); rkeys.add(rkey(rec)); added++;
        });
        if (added) { k.answers.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); k.rounds.sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0); write(KINDER_KEY, k); }
        return { added, skipped };
      },
      /* Clears this profile's kindergarten answers and rounds, plus its kindergarten stickers and kindergarten hint log. Nothing else. */
      async clearKinder() {
        localStorage.removeItem(KINDER_KEY);
        const st = read(STICKERS_KEY, {});
        if (st.kinder) { delete st.kinder; write(STICKERS_KEY, st); }
        const hs = read(HINTS_KEY, []);
        const keep = hs.filter(r => r.subject !== 'kinder');
        if (keep.length !== hs.length) write(HINTS_KEY, keep);
      }
    };

    if (id === 'family') {
      /* ---- family lessons (Money & Economics): which lessons are done, and grown-up unlock/lock overrides ---- */
      const clean = v => {
        const s = { complete: {}, override: {} };
        if (isObj(v)) {
          if (isObj(v.complete)) for (const k in v.complete) if (typeof v.complete[k] === 'string') s.complete[k] = v.complete[k];
          if (isObj(v.override)) for (const k in v.override) if (v.override[k] === 'open' || v.override[k] === 'locked') s.override[k] = v.override[k];
        }
        return s;
      };
      api.keys.lessons = LESSONS_KEY;
      api.getLessonState = async () => clean(read(LESSONS_KEY, null));
      api.setLessonComplete = async (lessonId, done) => {
        const s = clean(read(LESSONS_KEY, null));
        if (done) s.complete[String(lessonId)] = new Date().toISOString(); else delete s.complete[String(lessonId)];
        write(LESSONS_KEY, s);
        return s;
      };
      /* mode: 'open' (grown-up unlocked it early), 'locked' (grown-up locked it again), or null (back to the normal order) */
      api.setLessonOverride = async (lessonId, mode) => {
        const s = clean(read(LESSONS_KEY, null));
        if (mode === 'open' || mode === 'locked') s.override[String(lessonId)] = mode; else delete s.override[String(lessonId)];
        write(LESSONS_KEY, s);
        return s;
      };
      /* Merge lesson state from a backup: completions keep the earliest time; an override here wins over a backed-up one. */
      api.importLessonState = async obj => {
        const s = clean(read(LESSONS_KEY, null)), inc = clean(obj);
        let added = 0, changed = false;
        for (const k in inc.complete) if (!s.complete[k] || inc.complete[k] < s.complete[k]) { if (!s.complete[k]) added++; s.complete[k] = inc.complete[k]; changed = true; }
        for (const k in inc.override) if (!s.override[k]) { s.override[k] = inc.override[k]; added++; changed = true; }
        if (changed) write(LESSONS_KEY, s);
        return { added };
      };
      api.clearLessonState = async () => { localStorage.removeItem(LESSONS_KEY); };
    }
    return api;
  }

  const stores = {};
  PROFILES.forEach(p => { stores[p] = make(p); });

  JU.storage = Object.assign(stores.julianna, {
    PROFILES,
    /* The storage for 'julianna' | 'dorian' | 'family'. */
    profile(id) {
      if (!stores[id]) throw new Error('unknown profile: ' + id);
      return stores[id];
    },
    /* Voice settings for this device only: { voice: <voiceURI or ''>, rate: 0.6-1.1 }. Not part of scores or backups. */
    async getVoicePrefs() { return read(VOICE_KEY, null); },
    async setVoicePrefs(p) { write(VOICE_KEY, p); return p; },
    /* ---- last backup date (this device only; NOT in the backup file, and kept when results are cleared) ---- */
    async getLastBackup() { const v = read(BACKUP_KEY, null); return typeof v === 'string' && !isNaN(new Date(v)) ? v : null; },
    async setLastBackup(iso) { write(BACKUP_KEY, iso || new Date().toISOString()); return iso; },

    /* ---- the backup file (version 6; versions 1 to 5 still load) ----
       Version 6 adds "recordings": the grown-up's own recordings of Dorian's sounds (js/recordings.js), each
       { id, type, ts, dur, start, end, gain, data (base64) }. It is left out when the page has no recordings module or opts.recordings is false.
       Version 5 adds "kinder" (Dorian's kindergarten answers and rounds) under profiles.dorian.
       Version 4 adds "flags" (Ask a grown-up) for every profile and "money" (solo activity results) for Julianna and Dorian.
       Julianna's data stays at the top level exactly as in versions 1 and 2, so an older file loads into her
       and a version 3 file is still readable by old code. Everyone else is under "profiles":
       { app:'ju-learning', version:5, exportedAt, results, stickers, hints, flags, money,
         profiles: { dorian: { results, stickers, hints, flags, money, kinder }, family: { results, stickers, hints, lessons } } } */
    async exportAll(opts) {
      opts = opts || {};
      const out = { app: 'ju-learning', version: 6, exportedAt: new Date().toISOString(),
        results: await stores.julianna.getResults(), stickers: await stores.julianna.getStickers(), hints: await stores.julianna.getHints(),
        flags: await stores.julianna.getFlags(), money: await stores.julianna.getMoney(),
        profiles: {} };
      for (const p of ['dorian', 'family']) {
        out.profiles[p] = { results: await stores[p].getResults(), stickers: await stores[p].getStickers(), hints: await stores[p].getHints(), flags: await stores[p].getFlags() };
      }
      out.profiles.dorian.money = await stores.dorian.getMoney();
      out.profiles.dorian.kinder = await stores.dorian.getKinder();
      out.profiles.family.lessons = await stores.family.getLessonState();
      if (opts.recordings !== false && window.JU.recordings && JU.recordings.supported) { try { out.recordings = await JU.recordings.exportAll(); } catch (e) { out.recordings = []; } }
      return out;
    },
    /* True when a parsed file looks like one of our backups (version 1 to 6). */
    isBackup(data) {
      return isObj(data) && data.app === 'ju-learning' && (Array.isArray(data.results) || isObj(data.profiles));
    },
    /* Merge a backup into the right profiles without duplicating anything.
       Returns { added, skipped, hints: {added}|null, flags: {added}|null, money: {added}|null, profiles: { dorian: {added, skipped, ...}, family: {...} } }. */
    async importAll(data) {
      if (!JU.storage.isBackup(data)) throw new Error('not a backup');
      const r = await stores.julianna.importResults(data.results);
      await stores.julianna.importStickers(data.stickers);
      const hints = Array.isArray(data.hints) ? await stores.julianna.importHints(data.hints) : null;   // version 1 has no hint log
      const flags = Array.isArray(data.flags) ? await stores.julianna.importFlags(data.flags) : null;   // versions 1 to 3 have no flags
      const money = isObj(data.money) ? await stores.julianna.importMoney(data.money) : null;
      const profiles = {};
      for (const p of ['dorian', 'family']) {
        const blk = isObj(data.profiles) && isObj(data.profiles[p]) ? data.profiles[p] : null;
        if (!blk) continue;
        const pr = await stores[p].importResults(blk.results);
        await stores[p].importStickers(blk.stickers);
        const ph = Array.isArray(blk.hints) ? await stores[p].importHints(blk.hints) : null;
        let lessons = null;
        if (p === 'family' && blk.lessons) lessons = await stores.family.importLessonState(blk.lessons);
        const pf = Array.isArray(blk.flags) ? await stores[p].importFlags(blk.flags) : null;
        const pm = p === 'dorian' && isObj(blk.money) ? await stores.dorian.importMoney(blk.money) : null;
        const pk = p === 'dorian' && isObj(blk.kinder) ? await stores.dorian.importKinder(blk.kinder) : null;     // versions 1 to 4 have no kinder part
        profiles[p] = { added: pr.added, skipped: pr.skipped, hints: ph, lessons, flags: pf, money: pm, kinder: pk };
      }
      let recordings = null;                                                     // versions 1 to 5 have no recordings
      if (Array.isArray(data.recordings) && window.JU.recordings) { try { recordings = await JU.recordings.importAll(data.recordings); } catch (e) { recordings = null; } }
      return { added: r.added, skipped: r.skipped, hints, flags, money, profiles, recordings };
    },
    /* Plain counts for the progress summary: { julianna: {results, games, hints, stickers, flags, money: {done, answers}}, dorian: {...}, family: {..., lessonsDone} } */
    async counts() {
      const out = {};
      for (const p of PROFILES) {
        const rs = await stores[p].getResults(), st = await stores[p].getStickers();
        out[p] = { results: rs.length, games: new Set(rs.map(x => x.session)).size,
          stickers: Object.values(st).reduce((a, w) => a + Object.keys(w || {}).length, 0), hints: (await stores[p].getHints()).length,
          flags: (await stores[p].getFlags()).length };
        const m = await stores[p].getMoney();
        out[p].money = { done: Object.keys(m.done).length, answers: m.answers.length };
        const k = await stores[p].getKinder();
        out[p].kinder = { answers: k.answers.length, rounds: k.rounds.length, sessions: new Set(k.answers.map(a => a.session)).size };
      }
      out.family.lessonsDone = Object.keys((await stores.family.getLessonState()).complete).length;
      return out;
    }
  });
})();
