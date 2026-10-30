/* kinder.js - Dorian's kindergarten track, round 1: Letter sounds and Build a word. (Round 2, v12: Sight words, Count to 20, Add it up: js/kinder/round2.js.)
   Data: data/kinder/letters.json and data/kinder/cvc.json (see README, "Kindergarten track").
   This file holds the logic only (no screens): loading the data, working out what he knows from his saved answers,
   which letters and words are in play, and how the next round is picked. The screens are js/kinder/*.js.

   SAVED ANSWERS (Dorian's own key, ju_dorian_kinder_v1; storage.profile('dorian').getKinder()):
     { answers: [ { id, ts, session, round, activity: 'letters' | 'build' | 'sight' | 'count' | 'add' (v12), item (the letter, or the word; round 2: the sight word, the number, or the fact "a-b"),
                    correct (right on the first try, no hint), tries (wrong taps + 1), hinted,
                    wrong: [ letters he tapped by mistake ]  (letters) | letters: [ { l, wrong } ] (build, one per letter box) } ],
       rounds:  [ { id, ts, session, activity, items, clean } ] }       // one record per finished round
   A SESSION is one visit to an activity page (it can hold several rounds). A ROUND is 4 items plus one comeback for each
   item he missed (at most 2 comebacks), so 4 to 6 items.

   LETTERS: a letter is KNOWN when it was right on the first try, with no hint, in 3 different sessions (every time it came up in
   that session). He starts with s a t m p n. At most 6 letters are "still learning" at once; each time one becomes known, the next letter
   of the extended list (in order) joins. Letters he missed lately come back more often (weights below).
   WORDS: three-letter words open in tiers (data/kinder/cvc.json). Tier 1 is always open; the next tier opens when 4 words of the
   tier before it are known (built right on the first try, no hint, in 2 different sessions).
   Everything here is pure except the data loading, so tests can call it directly (JU.kinder.*). */
(function () {
  const cache = {};
  async function fetchJson(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then(res => { if (!res.ok) throw new Error('could not load ' + path); return res.json(); });
    }
    return cache[path];
  }
  const api = {
    rng: Math.random,                       // tests replace this to get a fixed order
    loadLetters: () => fetchJson('data/kinder/letters.json'),
    loadWords: () => fetchJson('data/kinder/cvc.json'),
    ACTIVITIES: { letters: { code: 1, title: 'Letter sounds' }, build: { code: 2, title: 'Build a word' },
      sight: { code: 3, title: 'Sight words' }, count: { code: 4, title: 'Count to 20' }, add: { code: 5, title: 'Add it up' } },       // (v12: round 2)
    STICKERS: ['\uD83D\uDC36', '\uD83D\uDC31', '\uD83E\uDD84', '\uD83D\uDC22', '\uD83D\uDC20', '\uD83E\uDD8B', '\uD83D\uDC1D', '\uD83E\uDD81', '\uD83D\uDC27', '\uD83D\uDC3C', '\uD83E\uDD89', '\uD83D\uDC19']
  };
  const byTs = (a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0;

  /* ---------- what he knows, from his saved answers ---------- */
  /* Per item (a letter or a word) for one activity:
     { item, seen, firstTry (answers right first time), misses (answers not right first time), wrongTaps, hints,
       recent (last 3 answers, true = right first time, newest last), cleanSessions, sessions, known } */
  function itemStats(answers, activity, knownSessions, skip) {
    const out = {};
    (answers || []).filter(a => a && a.activity === activity && typeof a.item === 'string' && !(skip && skip(a))).sort(byTs).forEach(a => {
      const s = out[a.item] = out[a.item] || { item: a.item, seen: 0, firstTry: 0, misses: 0, wrongTaps: 0, hints: 0, recent: [], bySession: {} };
      s.seen++;
      if (a.correct) s.firstTry++; else s.misses++;
      s.wrongTaps += Math.max(0, (Number(a.tries) || 1) - 1);
      if (a.hinted) s.hints++;
      s.recent.push(!!a.correct); if (s.recent.length > 3) s.recent.shift();
      s.bySession[a.session] = s.bySession[a.session] === false ? false : !!a.correct;     // clean only if EVERY time it came up in that session was right
    });
    for (const k in out) {
      const s = out[k];
      s.sessions = Object.keys(s.bySession).length;
      s.cleanSessions = Object.values(s.bySession).filter(Boolean).length;
      s.known = s.cleanSessions >= knownSessions;
      delete s.bySession;
    }
    return out;
  }
  api.itemStats = itemStats;              // (round 2: sight words, counting and adding use it too)
  api.letterStats = (answers, data) => itemStats(answers, 'letters', data.rules.knownSessions);
  api.wordStats = (answers, cvc) => itemStats(answers, 'build', cvc.rules.knownSessions);

  /* The letters in play, in order: the start letters, then extended letters while fewer than maxLearning letters are still learning.
     A letter that is already known always stays in. */
  api.activeLetters = function (data, stats) {
    const known = l => !!(stats[l] && stats[l].known);
    const out = data.start.slice();
    let learning = out.filter(l => !known(l)).length;
    data.extended.forEach(l => {
      if (known(l)) { out.push(l); return; }
      if (learning < data.rules.maxLearning) { out.push(l); learning++; }
    });
    return out;
  };

  /* ---------- picking (weighted, no repeats) ---------- */
  /* weight: known 1, otherwise 2; +3 when the latest answer was a miss, +1 when the one before it was */
  api.weight = function (stat) {
    const r = stat ? stat.recent : [];
    let w = stat && stat.known ? 1 : 2;
    if (r.length && !r[r.length - 1]) w += 3;
    if (r.length > 1 && !r[r.length - 2]) w += 1;
    return w;
  };
  api.pickWeighted = function (items, weightOf, n) {
    const pool = items.slice(), out = [];
    while (out.length < n && pool.length) {
      const ws = pool.map(weightOf), total = ws.reduce((a, b) => a + b, 0);
      let r = api.rng() * total, i = 0;
      while (i < pool.length - 1 && r >= ws[i]) { r -= ws[i]; i++; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  api.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(api.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const pick = arr => arr[Math.floor(api.rng() * arr.length)];

  /* ---------- recorded sounds (v11) ----------
     snd('m', 'mmm') -> "{{s:m|mmm}}": plays audio/kinder/sound-m.mp3, and says "mmm" with the browser voice only if that clip is missing (see js/speech.js).
     wrd('cat') -> "{{w:cat|cat}}" for the three-letter words. Text meant for the screen goes through JU.speech.plain(). */
  api.snd = (letter, say) => '{{s:' + letter + '|' + say + '}}';
  api.wrd = word => '{{w:' + word + '|' + word + '}}';

  /* ---------- Letter sounds ---------- */
  /* Which letters the next round draws from, and the first picks. Returns { active, letters: [4 letters] }. */
  api.planLetters = function (data, answers) {
    const stats = api.letterStats(answers, data), active = api.activeLetters(data, stats);
    return { active, stats, letters: api.pickWeighted(active, l => api.weight(stats[l]), data.rules.roundItems) };
  };
  /* One question: the sound, and three pictures (one starts with the sound). */
  api.letterItem = function (data, letter, active) {
    const L = data.letters[letter], pos = L.position || 'start';
    const target = pick(L.pics);
    const confusable = l => l === letter || (L.sameSound || []).indexOf(l) !== -1 || (data.letters[l].sameSound || []).indexOf(letter) !== -1;
    const others = api.shuffle(active.filter(l => !confusable(l)));
    const options = [{ letter, pic: target, right: true }];
    const seen = { [target.word]: true };
    for (const l of others) {
      if (options.length >= 3) break;
      const ps = data.letters[l].pics.filter(p => !seen[p.word] && !(pos === 'end' ? p.word.slice(-1) === letter : p.word.indexOf(letter) === 0));
      if (!ps.length) continue;
      const p = pick(ps); seen[p.word] = true; options.push({ letter: l, pic: p, right: false });
    }
    const example = pick(L.pics.filter(p => p.word !== target.word));
    const SND = api.snd(letter, L.say);
    const prompt = pos === 'end' ? 'Which picture ends with ' + SND + '?' : 'Which picture starts with ' + SND + '?';
    const options3 = api.shuffle(options);
    return { id: letter, letter, say: L.say, snd: SND, position: pos, prompt, target, example, options: options3,
      text: SND + '. ' + prompt + ' ' + options3.map(o => o.pic.word).join('. ') + '.',
      hint: SND + '. ' + example.word + ' ' + (pos === 'end' ? 'ends' : 'starts') + ' with ' + SND + '. ' + prompt,
      right: pos === 'end' ? 'Yes! ' + target.word + ' ends with ' + SND + '.' : 'Yes! ' + target.word + ' starts with ' + SND + '.' };
  };

  /* ---------- Build a word ---------- */
  api.tierLetters = function (cvc, tier) {
    const set = [];
    cvc.tiers.slice(0, tier).forEach(t => (t.letters || t.add || []).forEach(l => { if (set.indexOf(l) === -1) set.push(l); }));
    return set;
  };
  /* Open tiers: tier 1 always; tier N+1 once `wordsToOpenNext` words of tier N are known. Returns the highest open tier number. */
  api.openTier = function (cvc, stats) {
    let t = 1;
    while (t < cvc.tiers.length) {
      const known = cvc.words.filter(w => w.tier === t && stats[w.word] && stats[w.word].known).length;
      if (known >= cvc.rules.wordsToOpenNext) t++; else break;
    }
    return t;
  };
  api.planWords = function (cvc, answers) {
    const stats = api.wordStats(answers, cvc), tier = api.openTier(cvc, stats);
    const open = cvc.words.filter(w => w.tier <= tier);
    return { tier, open, stats, words: api.pickWeighted(open, w => api.weight(stats[w.word]), cvc.rules.roundItems) };
  };
  const CONFUSED = { b: 'd', d: 'b', p: 'q', q: 'p' };
  /* One word to build: the picture, the tiles (3 letters, plus 1 extra once he has built `trayExtraAfter` words right first time), the spoken sounds. */
  api.wordItem = function (cvc, letters, w, answers) {
    const need = w.word.split('');
    const rightBefore = (answers || []).filter(a => a.activity === 'build' && a.correct).length;
    let tiles = need.slice();
    if (rightBefore >= cvc.rules.trayExtraAfter) {
      const pool = api.tierLetters(cvc, w.tier).filter(l => need.indexOf(l) === -1 && !need.some(n => CONFUSED[n] === l));
      if (pool.length) tiles.push(pick(pool));
    }
    let order = api.shuffle(tiles), tries = 0;
    while (order.slice(0, 3).join('') === w.word && tries++ < 8) order = api.shuffle(tiles);
    const sounds = need.map(l => api.snd(l, letters.letters[l].say)), WORD = api.wrd(w.word);
    return { id: w.word, word: w.word, wrd: WORD, e: w.e, tier: w.tier, need, tiles: order, sounds,
      text: 'Let\u2019s build ' + WORD + '. Tap the sounds in order.',
      hint: sounds.join('. ') + '. ' + WORD + '.',
      done: WORD + '. You built ' + WORD + '!' };
  };

  /* ---------- for the grown-up page ---------- */
  api.summary = function (store, letters, cvc) {
    const answers = store.answers || [], rounds = store.rounds || [], hints = store.hints || [];
    const ls = api.letterStats(answers, letters), ws = api.wordStats(answers, cvc);
    const active = api.activeLetters(letters, ls);
    const shown = active.concat(Object.keys(ls).filter(l => active.indexOf(l) === -1));
    const letterRows = shown.map(l => ({ letter: l, say: letters.letters[l] ? letters.letters[l].say : '', seen: ls[l] ? ls[l].seen : 0, cleanSessions: ls[l] ? ls[l].cleanSessions : 0,
      misses: ls[l] ? ls[l].misses : 0, hints: ls[l] ? ls[l].hints : 0, status: ls[l] && ls[l].known ? 'known' : ls[l] ? 'learning' : 'new' }));
    const builds = answers.filter(a => a.activity === 'build');
    const slips = {};
    builds.forEach(a => (a.letters || []).forEach(x => { if (x.wrong) slips[x.l] = (slips[x.l] || 0) + x.wrong; }));
    const wordRows = Object.keys(ws).sort().map(k => ({ word: k, built: ws[k].seen, firstTry: ws[k].firstTry, cleanSessions: ws[k].cleanSessions, hints: ws[k].hints, known: ws[k].known }));
    const kh = hints.filter(r => r.subject === 'kinder');
    return {
      sessions: new Set(answers.map(a => a.session)).size, rounds: rounds.length,
      letterRows, known: letterRows.filter(r => r.status === 'known').length, learning: letterRows.filter(r => r.status === 'learning').length, notMet: letterRows.filter(r => r.status === 'new').length,
      wordRows, wordsBuilt: builds.length, wordsDifferent: wordRows.length, tier: api.openTier(cvc, ws), slips,
      hintsUsed: kh.filter(r => r.kind === 'hint').length, grownupUnlocks: kh.filter(r => r.kind === 'grownup').length, rapid: kh.filter(r => r.kind === 'rapid').length,
      answers: answers.length
    };
  };

  JU.kinder = api;
})();
