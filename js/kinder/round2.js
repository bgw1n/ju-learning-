/* kinder/round2.js - the logic of Dorian's kindergarten round 2 (v12): Sight words, Count to 20, Add it up.
   It adds to JU.kinder (js/kinder.js). No screens here (the screens are js/kinder/sight.js, count.js and add.js) and nothing is saved here.
   Data: data/sight/weeks.json (+ week files, + settings.json), data/kinder/counting.json, data/kinder/adding.json (see README, "Kindergarten round 2").
   Saved answers use the round 1 shape (see js/kinder.js) with activity 'sight' (item = the word), 'count' (item = the number as text; kind 'along' | 'howmany' | 'next';
   'along' is practice and is never counted) and 'add' (item = "a-b", for example "2-1": two and one more).
   Everything here is pure except the data loading, so tests can call it directly (JU.kinder.*). */
(function () {
  const K = JU.kinder;
  const cache = {};
  const fetchJson = path => cache[path] || (cache[path] = fetch(path).then(res => { if (!res.ok) throw new Error('could not load ' + path); return res.json(); }));

  /* ---------- shared pieces ---------- */
  /* round up to n picks: the weighted distinct picks first, then (when the pool is small) more picks that never repeat the one just before */
  function fill(picked, pool, weightOf, n) {
    const out = picked.slice();
    while (out.length < n && pool.length) {
      const last = out[out.length - 1];
      const rest = pool.length > 1 ? pool.filter(x => x !== last) : pool;
      out.push(K.pickWeighted(rest, weightOf, 1)[0]);
    }
    return out;
  }
  const pickOne = arr => arr[Math.floor(K.rng() * arr.length)];
  const sample = (arr, n) => K.shuffle(arr).slice(0, n);
  /* the n-th tier that is open: tier 1 always, tier t+1 once need[t-1] items of tier t are known */
  function openTierBy(count, tiers, need) {
    let t = 1;
    while (t < tiers) { if (count(t) >= need[t - 1]) t++; else break; }
    return t;
  }

  /* a spoken number: a recorded clip with the number word as its fallback */
  const num = (n, words) => '{{n:' + (n === 0 && words[0] === 'none' ? 'none' : n) + '|' + words[n] + '}}';
  K.num = num;
  /* "one. two. three." as clips (a hint or a count-along) */
  K.countOut = (from, to, words) => { const a = []; for (let i = from; i <= to; i++) a.push(num(i, words) + '.'); return a.join(' '); };

  /* ================= Sight words ================= */
  K.loadSight = async function () {
    const [idx, settings, twice] = await Promise.all([fetchJson('data/sight/weeks.json'), fetchJson('data/sight/settings.json'), fetchJson('data/sight/twice.json').catch(() => null)]);
    const weeks = await Promise.all(idx.weeks.map(w => fetchJson('data/sight/' + w.file)));
    const d = K.sightData(weeks, settings);
    d.twice = twice ? twice.sentences : [];
    return d;
  };
  /* Pure. weeks: the week files (any order). The newest week is this week's focus. */
  K.sightData = function (weeks, settings) {
    const sorted = weeks.slice().sort((a, b) => a.id < b.id ? -1 : 1);
    const words = [];
    sorted.forEach(wk => wk.words.forEach(w => {
      if (words.some(x => x.word === w.word.toLowerCase())) return;
      words.push(Object.assign({}, w, { word: w.word.toLowerCase(), shown: w.word.toLowerCase() === 'i' ? 'I' : w.word, week: wk.id, weekLabel: wk.label }));
    }));
    const focusId = sorted.length ? sorted[sorted.length - 1].id : null;
    words.forEach(w => { w.focus = w.week === focusId; });
    const confirmed = words.map(w => w.word);
    return { rules: settings.rules, words, focusWeek: focusId, weeks: sorted,
      distractors: settings.rules.confirmedOnly ? [] : settings.distractors.filter(d => confirmed.indexOf(d.toLowerCase()) === -1) };     // v14: confirmedOnly = only his own words
  };
  K.sightStats = (answers, data) => K.itemStats(answers, 'sight', data.rules.knownSessions);

  /* two words that could be mixed up at a glance: the same first letter, the same last two letters, or one letter apart */
  K.lookAlike = function (a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a === b || a[0] === b[0]) return true;
    if (a.length > 1 && b.length > 1 && a.slice(-2) === b.slice(-2)) return true;
    if (a.length === b.length) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; if (d <= 1) return true; }
    return false;
  };
  const r0 = data => data.rules || {};
  const showWord = w => (w === 'i' ? 'I' : w);
  const G = (word, fb) => '{{g:' + word.toLowerCase() + '|' + (fb || showWord(word)) + '}}';
  /* v14: words that are easy to mix up with each word (all from his confirmed list). The wrong cards come from here first. */
  K.LOOKS = { me: ['my', 'we', 'make'], my: ['me', 'make', 'am'], it: ['is', 'in', 'at'], is: ['it', 'in', 'i'], in: ['is', 'it', 'i'], at: ['am', 'it', 'the'],
    am: ['at', 'make', 'me'], see: ['she', 'we', 'me'], she: ['see', 'the', 'we'], the: ['she', 'see', 'with'], i: ['is', 'it', 'in'], like: ['look', 'make', 'me'],
    look: ['like', 'see', 'we'], make: ['me', 'my', 'like'], we: ['me', 'with', 'see'], with: ['we', 'it', 'the'],
    are: ['at', 'am', 'the'], that: ['the', 'at', 'with'], of: ['it', 'is', 'in'] };       // (v15: the week of Nov 2)
  /* The wrong cards for finding `word` (v14): LOOK-ALIKES first (me/my, it/is, at/am, see/she ...), then other words that share a letter pattern, then any other word.
     Only words in play (confirmed) are used; `skip` lists words that must not be cards (for a sentence: words that would also fit). */
  K.sightWrong = function (data, word, n, skip) {
    if (!data.rules.lookAlikeWrong) {           // (a settings file from before v14: wrong cards that do NOT look alike, as in v12)
      const others = data.words.map(w => w.word).filter(w => w !== word), extra = data.distractors, old = [];
      [K.shuffle(others), K.shuffle(extra)].forEach(list => list.forEach(w => { if (old.length >= n || K.lookAlike(word, w) || old.some(o => K.lookAlike(o, w))) return; old.push(w); }));
      return old;
    }
    const pool = data.words.map(w => w.word).concat(data.distractors).filter(w => w !== word && !(skip && skip.indexOf(w) >= 0));
    const out = [];
    const add = list => list.forEach(w => { if (out.length < n && pool.indexOf(w) >= 0 && out.indexOf(w) < 0) out.push(w); });
    add(K.shuffle(K.LOOKS[word] || []));
    add(K.shuffle(pool.filter(w => K.lookAlike(word, w))));
    add(K.shuffle(pool));
    return out;
  };
  K.sightChoices = data => Math.max(2, Number(data.rules.choices) || 3);
  /* The round: 4 words (a small pool repeats with another kind of question), the focus words weigh more. Two of the four become "find the missing word"
     once gapAfterKnown words are known. Returns { stats, known, gapOpen, items: [{ w, type: 'hunt' | 'gap' }] }. */
  /* v14 levels: 1 = word cards + one Find it twice; 2 = + find the missing word; 3 = + a second Find it twice. With no level given (old callers), the v12 rule decides the gaps. */
  K.planSight = function (data, answers, level) {
    const r = data.rules, stats = K.sightStats(answers, data);
    const known = data.words.filter(w => stats[w.word] && stats[w.word].known).length;
    const gapOpen = level == null || !r.gapByLevel || !r.starLevels ? known >= r.gapAfterKnown : level >= 2;
    const weightOf = w => K.weight(stats[w.word]) + (w.focus ? r.focusBonus : 0);
    const picked = fill(K.pickWeighted(data.words, weightOf, r.roundItems), data.words, weightOf, r.roundItems);
    const items = picked.map((w, i) => ({ w, type: gapOpen && w.sentence && i % 2 === 1 ? 'gap' : 'hunt' }));
    /* Find it twice: slot 4 (and slot 6 at level 3), once data/sight/twice.json is loaded */
    const nTwice = level == null || !r.twicePerRound || !data.twice || !data.twice.length ? 0 : Math.min(items.length, (r.twicePerRound || 1) + (level >= 3 ? 1 : 0));
    const slots = [3, 5, 1].filter(i => i < items.length).slice(0, nTwice);
    slots.forEach(i => { const t = K.pickTwice(data, stats); if (t) items[i] = { w: data.words.find(x => x.word === t.word), type: 'twice', twice: t }; });
    return { stats, known, gapOpen, level: level == null ? null : level, items };
  };
  /* a "Find it twice" sentence and its target word (weighted by how well he knows the word) */
  K.pickTwice = function (data, stats) {
    const opts = [];
    (data.twice || []).forEach(s => s.targets.forEach(t => { if (data.words.some(w => w.word === t)) opts.push({ word: t, s }); }));
    if (!opts.length) return null;
    return K.pickWeighted(opts, o => K.weight(stats && stats[o.word]), 1)[0];
  };
  /* The words of the sentence as tiles; the ones that are the target are marked */
  K.twiceItem = function (data, t) {
    const word = t.word, s = t.s;
    const tiles = (s.text.match(/[A-Za-z']+[.,!?]?/g) || []).map((raw, i) => { const bare = raw.replace(/[.,!?]$/, ''); return { i, shown: raw, bare: bare.toLowerCase(), right: bare.toLowerCase() === word }; });
    const sentence = s.text;
    return { id: word, word, type: 'twice', pic: s.pic, sentence, tiles, need: tiles.filter(x => x.right).length,
      text: 'Find it twice! Listen: ' + sentence + ' Tap the word ' + G(word) + ' every time you see it.',
      hint: G(word) + '. ' + sentence + ' Tap ' + G(word) + ', and look for it again.',
      miss: 'Listen again. Find the word ' + G(word) + '.', more: 'Yes! Now find ' + G(word) + ' one more time.',
      right: 'Yes! You found ' + G(word) + ' every time.', sound: G(word) };
  };
  K.sightItem = function (data, w, type) {
    const word = w.word, shown = w.shown, full = w.sentence ? '{{t:' + word + '-full|' + w.sentence + '}}' : G(word);
    if (type === 'gap' && w.sentence) {
      const pre = w.pre ? '{{t:' + word + '-pre|' + w.pre + '}} ' : '', post = w.post ? ' {{t:' + word + '-post|' + w.post + '}}' : '';
      const gapSay = pre + '{{m:blank|blank}}' + post;
      /* v14: 3 wrong cards (4 in all): the week file's wrong words that are his own words, then look-alikes; never a word that would also fit the sentence (w.fits) */
      if (!r0(data).lookAlikeWrong) {
        const wrong = sample((w.wrong || []).filter(x => x.toLowerCase() !== word), 2);
        const options = K.shuffle([{ word: shown, right: true }].concat(wrong.map(x => ({ word: showWord(x), right: false }))));
        return { id: word, word, type: 'gap', pic: w.pic || '', blank: [w.pre, '___', w.post].filter(Boolean).join(' '), options, comeback: false,
          text: 'Find the missing word. ' + gapSay, hint: full, miss: 'Listen again. ' + gapSay, right: 'Yes! ' + full, sound: gapSay };
      }
      const n = K.sightChoices(data) - 1, fits = (w.fits || []).map(x => x.toLowerCase());
      const mine = data.words.map(x => x.word).concat(data.distractors);
      const wrong = sample((w.wrong || []).map(x => x.toLowerCase()).filter(x => x !== word && mine.indexOf(x) >= 0 && fits.indexOf(x) < 0), Math.min(1, n));
      K.sightWrong(data, word, n, fits.concat(wrong)).forEach(x => { if (wrong.length < n) wrong.push(x); });
      const options = K.shuffle([{ word: shown, right: true }].concat(wrong.map(x => ({ word: showWord(x), right: false }))));
      return { id: word, word, type: 'gap', pic: w.pic || '', blank: [w.pre, '___', w.post].filter(Boolean).join(' '), options, comeback: false,
        text: 'Find the missing word. ' + gapSay, hint: full, miss: 'Listen again. ' + gapSay, right: 'Yes! ' + full, sound: gapSay };
    }
    const wrong = K.sightWrong(data, word, K.sightChoices(data) - 1);
    const options = K.shuffle([{ word: shown, right: true }].concat(wrong.map(x => ({ word: showWord(x), right: false }))));
    return { id: word, word, type: 'hunt', pic: '', options,
      text: 'Find the word ' + G(word) + '.', hint: G(word) + '. ' + full, miss: 'Listen again. Find the word ' + G(word) + '.', right: 'Yes! That says ' + G(word) + '.', sound: G(word) };
  };
  K.sightSummary = function (answers, data, hints) {
    const stats = K.sightStats(answers, data);
    const rows = data.words.map(w => { const s = stats[w.word];
      return { word: w.shown, week: w.weekLabel, focus: w.focus, seen: s ? s.seen : 0, cleanSessions: s ? s.cleanSessions : 0, misses: s ? s.misses : 0, hints: s ? s.hints : 0, status: s && s.known ? 'known' : s ? 'learning' : 'new' }; });
    return { rows, focus: rows.filter(r => r.focus), known: rows.filter(r => r.status === 'known').length };
  };

  /* ================= Count to 20 ================= */
  K.loadCounting = () => fetchJson('data/kinder/counting.json');
  K.countStats = (answers, cd) => K.itemStats(answers, 'count', cd.rules.knownSessions, a => a.kind === 'along');
  K.countTier = function (cd, stats) {
    return openTierBy(t => { const T = cd.tiers[t - 1]; let c = 0; for (let n = T.from; n <= T.to; n++) if (stats[String(n)] && stats[String(n)].known) c++; return c; }, cd.tiers.length, cd.rules.numbersToOpenNext);
  };
  /* The round: 4 numbers from the open tiers (weighted), asked as counting along, how many, what comes next, how many. A number below 2 cannot be a "next". */
  K.planCount = function (cd, answers, level) {
    const stats = K.countStats(answers, cd), tier = level == null || !cd.rules.starLevels ? K.countTier(cd, stats) : Math.max(1, Math.min(cd.tiers.length, level)), max = cd.tiers[tier - 1].to;
    const active = []; for (let n = 1; n <= max; n++) active.push(n);
    const picks = K.pickWeighted(active, n => K.weight(stats[String(n)]), cd.rules.roundItems);
    /* v14: past the first level, at least two of the numbers come from the newest tier (the numbers he has not seen yet) */
    if (tier > 1 && picks.length > 2) { const T = cd.tiers[tier - 1]; let have = picks.filter(n => n >= T.from).length;
      for (let i = picks.length - 1; i >= 0 && have < 2; i--) if (picks[i] < T.from) { let x, g = 0; do { x = T.from + Math.floor(K.rng() * (T.to - T.from + 1)); } while (picks.indexOf(x) >= 0 && g++ < 20); picks[i] = x; have++; } }
    const KINDS = ['along', 'howmany', 'next', 'howmany', 'howmany', 'next'];
    const items = picks.map((n, i) => ({ n, kind: KINDS[i % KINDS.length] === 'next' && n < 2 ? 'howmany' : KINDS[i % KINDS.length] }));
    /* v15: ten and some more. A "how many" with 11 to 20 pictures is often shown as a full ten frame and the rest (with rules.tenFrames) */
    if (cd.rules.tenFrames) items.forEach((x, i) => { if (x.kind === 'howmany' && x.n >= 11 && x.n <= 20 && (i === 4 || K.rng() < 0.5)) x.kind = 'tenframe'; });
    return { stats, tier, max, items };
  };
  /* Near numbers for the wrong choices (never the right one, never more than 20 or less than 1) */
  function nearNumbers(n, k, lo, hi, prefer) {
    const cand = [n - 2, n - 1, n + 1, n + 2].filter(x => x >= lo && x <= hi && x !== n && (!prefer || prefer(x)));
    const out = sample(cand, k);
    for (let d = 3; out.length < k && d < 8; d++) [n - d, n + d].forEach(x => { if (out.length < k && x >= lo && x <= hi && x !== n && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  K.nearNumbers = nearNumbers;
  K.COUNT_MAX = cd => cd.tiers[cd.tiers.length - 1].to;
  K.countItem = function (cd, n, kind) {
    const o = pickOne(cd.objects), W = cd.words, N = i => num(i, W), many = n === 1 ? o.one : o.many;
    const base = { id: String(n), n, kind, e: o.e, one: o.one, many: o.many, words: W };
    if (kind === 'next') {
      const from = Math.max(1, n - 3), seq = []; for (let i = from; i < n; i++) seq.push(i);
      const options = K.shuffle([n].concat(nearNumbers(n, 2, 1, K.COUNT_MAX(cd), x => x !== n - 1 || n < 3)).map(x => ({ n: x, right: x === n })));
      const say = seq.map(N).join(', ');
      return Object.assign(base, { seq, options, text: 'What comes next? ' + say + ', and then?', hint: K.countOut(Math.max(1, n - 5), n - 1, W) + ' What comes next?',
        right: 'Yes! After ' + N(n - 1) + ' comes ' + N(n) + '.', miss: 'Listen again. ' + say + ', and then?' });
    }
    if (kind === 'tenframe') {
      const options = K.shuffle([n].concat(nearNumbers(n, 2, 1, K.COUNT_MAX(cd))).map(x => ({ n: x, right: x === n })));
      return Object.assign(base, { options, dots: false, frame: true, text: 'Here is a full ten frame, and some more ' + o.many + '. Count them all, then tap the number.',
        hint: 'A full ten frame is ten. Keep counting the rest: eleven, twelve, and on.',
        right: 'Yes! Ten and ' + N(n - 10) + ' more makes ' + N(n) + '.', miss: 'Let\u2019s count again. A full frame is ten. Keep counting.',
        together: 'Let\u2019s count together. ' + K.countOut(1, n, W) + ' Ten and ' + N(n - 10) + ' more is ' + N(n) + '. Tap ' + N(n) + '.' });
    }
    /* v13.3: 'along' and 'how many' both: tap to count (the voice says the running count), then tap the number. Nothing says the number first. */
    const options = K.shuffle([n].concat(nearNumbers(n, 2, 1, K.COUNT_MAX(cd))).map(x => ({ n: x, right: x === n })));
    return Object.assign(base, { options, dots: !!cd.rules.dotsOnChoices, scatter: !!cd.rules.scatter, text: 'Count the ' + o.many + '. Tap each one, then tap the number.',
      hint: 'Tap each one, and I will count with you. The last number you hear is how many.',
      right: 'Yes! There ' + (n === 1 ? 'is ' : 'are ') + N(n) + ' ' + many + '.', miss: 'Let\u2019s count again. Tap each one.',
      together: 'Let\u2019s count together. ' + K.countOut(1, n, W) + ' There ' + (n === 1 ? 'is ' : 'are ') + N(n) + '. Tap ' + N(n) + '.' });
  };
  K.countSummary = function (answers, cd, level) {
    const stats = K.countStats(answers, cd), tier = level == null || !cd.rules.starLevels ? K.countTier(cd, stats) : Math.max(1, Math.min(cd.tiers.length, level)), max = cd.tiers[tier - 1].to;
    const strip = []; for (let n = 1; n <= K.COUNT_MAX(cd); n++) { const s = stats[String(n)]; strip.push({ n, status: s && s.known ? 'known' : s ? 'learning' : 'new', seen: s ? s.seen : 0, misses: s ? s.misses : 0, hints: s ? s.hints : 0, cleanSessions: s ? s.cleanSessions : 0, open: n <= max }); }
    const along = (answers || []).filter(a => a.activity === 'count' && a.kind === 'along').length;
    return { strip, tier, tiers: cd.tiers.length, known: strip.filter(x => x.status === 'known').length, along };
  };

  /* ================= Add it up ================= */
  K.loadAdding = () => fetchJson('data/kinder/adding.json');
  const factId = f => (f.take ? 't' : '') + f.a + '-' + f.b;          // v14: take-away facts are "t5-2" (five, two fly away)
  K.factId = factId;
  K.addStats = (answers, ad) => K.itemStats(answers, 'add', ad.rules.knownSessions);
  K.addTier = function (ad, stats) {
    return openTierBy(t => ad.facts.filter(f => f.tier === t && stats[factId(f)] && stats[factId(f)].known).length, ad.tiers.length, ad.rules.factsToOpenNext);
  };
  K.planAdd = function (ad, answers, level) {
    const stats = K.addStats(answers, ad), tier = level == null || !ad.rules.starLevels ? K.addTier(ad, stats) : Math.max(1, Math.min(ad.tiers.length, level));
    const open = ad.facts.filter(f => f.tier <= tier), weightOf = f => K.weight(stats[factId(f)]) + (f.tier === tier && tier > 1 ? 3 : 0);     // v14: the newest tier comes up more
    return { stats, tier, open, facts: fill(K.pickWeighted(open, weightOf, ad.rules.roundItems), open, weightOf, ad.rules.roundItems) };
  };
  K.addItem = function (ad, f) {
    const o = pickOne(ad.objects), W = ad.words, N = i => num(i, W);
    const hi = W.length;            // (one past the biggest total, so a wrong choice can be one more)
    if (f.take) {
      /* v14: how many are left. He sees f.a pictures, f.b of them fly away, he counts the rest. No minus sign; nothing says a number before he answers. */
      const left = f.a - f.b;
      const options = K.shuffle([left].concat(nearNumbers(left, 2, 0, f.a))).map(x => ({ n: x, right: x === left }));
      const ask = 'Watch! Some ' + o.many + ' fly away. Count the ' + o.many + ' that are left.';
      return { id: factId(f), a: f.a, b: f.b, take: true, total: left, words: W, e: o.e, one: o.one, many: o.many, tier: f.tier, options, signs: false,
        text: ask, hint: 'Tap each one that is still here, and I will count with you.', miss: 'Let’s count again. Count the ' + o.many + ' that are left.',
        together: 'Let’s count together. ' + (left ? K.countOut(1, left, W) + ' ' : '') + N(left) + ' are left. Tap ' + N(left) + '.',
        right: 'Yes! ' + N(f.a) + ', and ' + N(f.b) + ' flew away. ' + N(left) + ' ' + (left === 1 ? 'is' : 'are') + ' left.' };
    }
    const total = f.a + f.b;
    const options = K.shuffle([total].concat(nearNumbers(total, 2, 0, hi)).map(x => ({ n: x, right: x === total })));
    const first = ad.rules.showSigns ? N(f.a) + ' plus ' + (f.b === 0 ? '{{n:0|zero}}' : N(f.b)) : N(f.a) + ' and ' + (f.b === 0 ? '{{n:none|none}} more' : N(f.b) + ' more');     // v14: with the signs on, the voice says "plus"
    const makes = ad.rules.showSigns ? ' equals ' : ' makes ';
    /* v13.3: the question and the hint say no numbers (not the groups, not the total); the numbers are said only after he answers */
    const ask = 'Count the ' + o.many + '. How many in all?';
    return { id: factId(f), a: f.a, b: f.b, total, words: W, e: o.e, one: o.one, many: o.many, tier: f.tier, options, signs: !!ad.rules.showSigns,
      text: ask, hint: 'Tap each one, and I will count with you. Count this group, then keep counting the other group.', miss: 'Let\u2019s count again. ' + ask,
      together: 'Let\u2019s count together. ' + K.countOut(1, total, W) + ' ' + first + makes + N(total) + '. Tap ' + N(total) + '.',
      right: 'Yes! ' + first + makes + N(total) + '.' };
  };
  K.addSummary = function (answers, ad, level) {
    const stats = K.addStats(answers, ad), tier = level == null || !ad.rules.starLevels ? K.addTier(ad, stats) : Math.max(1, Math.min(ad.tiers.length, level));
    const rows = ad.facts.map(f => { const s = stats[factId(f)];
      return { id: factId(f), a: f.a, b: f.b, take: !!f.take, tier: f.tier, open: f.tier <= tier, seen: s ? s.seen : 0, cleanSessions: s ? s.cleanSessions : 0, misses: s ? s.misses : 0, hints: s ? s.hints : 0, status: s && s.known ? 'known' : s ? 'learning' : 'new' }; });
    return { rows, tier, tiers: ad.tiers.length, known: rows.filter(r => r.status === 'known').length };
  };
})();
