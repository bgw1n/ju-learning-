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
    const [idx, settings] = await Promise.all([fetchJson('data/sight/weeks.json'), fetchJson('data/sight/settings.json')]);
    const weeks = await Promise.all(idx.weeks.map(w => fetchJson('data/sight/' + w.file)));
    return K.sightData(weeks, settings);
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
      distractors: settings.distractors.filter(d => confirmed.indexOf(d.toLowerCase()) === -1) };
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
  const showWord = w => (w === 'i' ? 'I' : w);
  const G = (word, fb) => '{{g:' + word.toLowerCase() + '|' + (fb || showWord(word)) + '}}';
  /* The wrong cards for finding `word`: other words (the confirmed ones first, then the unconfirmed Unit 1 words), never a look-alike of the right word or of each other. */
  K.sightWrong = function (data, word, n) {
    const others = data.words.map(w => w.word).filter(w => w !== word), extra = data.distractors;
    const out = [];
    [K.shuffle(others), K.shuffle(extra)].forEach(list => list.forEach(w => {
      if (out.length >= n) return;
      if (K.lookAlike(word, w) || out.some(o => K.lookAlike(o, w))) return;
      out.push(w);
    }));
    return out;
  };
  /* The round: 4 words (a small pool repeats with another kind of question), the focus words weigh more. Two of the four become "find the missing word"
     once gapAfterKnown words are known. Returns { stats, known, gapOpen, items: [{ w, type: 'hunt' | 'gap' }] }. */
  K.planSight = function (data, answers) {
    const r = data.rules, stats = K.sightStats(answers, data);
    const known = data.words.filter(w => stats[w.word] && stats[w.word].known).length;
    const gapOpen = known >= r.gapAfterKnown;
    const weightOf = w => K.weight(stats[w.word]) + (w.focus ? r.focusBonus : 0);
    const picked = fill(K.pickWeighted(data.words, weightOf, r.roundItems), data.words, weightOf, r.roundItems);
    return { stats, known, gapOpen, items: picked.map((w, i) => ({ w, type: gapOpen && w.sentence && i % 2 === 1 ? 'gap' : 'hunt' })) };
  };
  K.sightItem = function (data, w, type) {
    const word = w.word, shown = w.shown, full = w.sentence ? '{{t:' + word + '-full|' + w.sentence + '}}' : G(word);
    if (type === 'gap' && w.sentence) {
      const pre = w.pre ? '{{t:' + word + '-pre|' + w.pre + '}} ' : '', post = w.post ? ' {{t:' + word + '-post|' + w.post + '}}' : '';
      const gapSay = pre + '{{m:blank|blank}}' + post;
      const wrong = sample((w.wrong || []).filter(x => x.toLowerCase() !== word), 2);
      const options = K.shuffle([{ word: shown, right: true }].concat(wrong.map(x => ({ word: showWord(x), right: false }))));
      return { id: word, word, type: 'gap', pic: w.pic || '', blank: [w.pre, '___', w.post].filter(Boolean).join(' '), options, comeback: false,
        text: 'Find the missing word. ' + gapSay, hint: full, miss: 'Listen again. ' + gapSay, right: 'Yes! ' + full, sound: gapSay };
    }
    const wrong = K.sightWrong(data, word, 2);
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
  K.planCount = function (cd, answers) {
    const stats = K.countStats(answers, cd), tier = K.countTier(cd, stats), max = cd.tiers[tier - 1].to;
    const active = []; for (let n = 1; n <= max; n++) active.push(n);
    const picks = K.pickWeighted(active, n => K.weight(stats[String(n)]), cd.rules.roundItems);
    const KINDS = ['along', 'howmany', 'next', 'howmany'];
    return { stats, tier, max, items: picks.map((n, i) => ({ n, kind: KINDS[i % 4] === 'next' && n < 2 ? 'howmany' : KINDS[i % 4] })) };
  };
  /* Near numbers for the wrong choices (never the right one, never more than 20 or less than 1) */
  function nearNumbers(n, k, lo, hi, prefer) {
    const cand = [n - 2, n - 1, n + 1, n + 2].filter(x => x >= lo && x <= hi && x !== n && (!prefer || prefer(x)));
    const out = sample(cand, k);
    for (let d = 3; out.length < k && d < 8; d++) [n - d, n + d].forEach(x => { if (out.length < k && x >= lo && x <= hi && x !== n && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  K.nearNumbers = nearNumbers;
  K.countItem = function (cd, n, kind) {
    const o = pickOne(cd.objects), W = cd.words, N = i => num(i, W), many = n === 1 ? o.one : o.many;
    const base = { id: String(n), n, kind, e: o.e, one: o.one, many: o.many, words: W };
    if (kind === 'along') {
      return Object.assign(base, { text: 'Let\u2019s count the ' + o.many + '! Tap each one.', hint: 'Tap each one while I count. ' + K.countOut(1, Math.min(n, 5), W),
        right: 'Yes! ' + N(n) + ' ' + many + '!', miss: 'Tap each one.' });
    }
    if (kind === 'next') {
      const from = Math.max(1, n - 3), seq = []; for (let i = from; i < n; i++) seq.push(i);
      const options = K.shuffle([n].concat(nearNumbers(n, 2, 1, 20, x => x !== n - 1 || n < 3)).map(x => ({ n: x, right: x === n })));
      const say = seq.map(N).join(', ');
      return Object.assign(base, { seq, options, text: 'What comes next? ' + say + ', and then?', hint: K.countOut(Math.max(1, n - 5), n - 1, W) + ' What comes next?',
        right: 'Yes! After ' + N(n - 1) + ' comes ' + N(n) + '.', miss: 'Listen again. ' + say + ', and then?' });
    }
    const options = K.shuffle([n].concat(nearNumbers(n, 2, 1, 20)).map(x => ({ n: x, right: x === n })));
    return Object.assign(base, { options, dots: !!cd.rules.dotsOnChoices, text: 'How many ' + o.many + '? Tap them to count, then tap the number.', hint: 'Let\u2019s count. ' + K.countOut(1, n, W),
      right: 'Yes! There ' + (n === 1 ? 'is ' : 'are ') + N(n) + ' ' + many + '.', miss: 'Listen again. How many ' + o.many + '?' });
  };
  K.countSummary = function (answers, cd) {
    const stats = K.countStats(answers, cd), tier = K.countTier(cd, stats), max = cd.tiers[tier - 1].to;
    const strip = []; for (let n = 1; n <= 20; n++) { const s = stats[String(n)]; strip.push({ n, status: s && s.known ? 'known' : s ? 'learning' : 'new', seen: s ? s.seen : 0, misses: s ? s.misses : 0, hints: s ? s.hints : 0, cleanSessions: s ? s.cleanSessions : 0, open: n <= max }); }
    const along = (answers || []).filter(a => a.activity === 'count' && a.kind === 'along').length;
    return { strip, tier, tiers: cd.tiers.length, known: strip.filter(x => x.status === 'known').length, along };
  };

  /* ================= Add it up ================= */
  K.loadAdding = () => fetchJson('data/kinder/adding.json');
  const factId = f => f.a + '-' + f.b;
  K.factId = factId;
  K.addStats = (answers, ad) => K.itemStats(answers, 'add', ad.rules.knownSessions);
  K.addTier = function (ad, stats) {
    return openTierBy(t => ad.facts.filter(f => f.tier === t && stats[factId(f)] && stats[factId(f)].known).length, ad.tiers.length, ad.rules.factsToOpenNext);
  };
  K.planAdd = function (ad, answers) {
    const stats = K.addStats(answers, ad), tier = K.addTier(ad, stats);
    const open = ad.facts.filter(f => f.tier <= tier), weightOf = f => K.weight(stats[factId(f)]);
    return { stats, tier, open, facts: fill(K.pickWeighted(open, weightOf, ad.rules.roundItems), open, weightOf, ad.rules.roundItems) };
  };
  K.addItem = function (ad, f) {
    const o = pickOne(ad.objects), W = ad.words, N = i => num(i, W), total = f.a + f.b;
    const options = K.shuffle([total].concat(nearNumbers(total, 2, 0, 6)).map(x => ({ n: x, right: x === total })));
    const more = f.b === 0 ? '{{n:none|none}} more' : N(f.b) + ' more';
    const first = N(f.a) + ' and ' + more;
    const counted = K.countOut(1, f.a, W) + (f.b ? ' And more: ' + K.countOut(f.a + 1, total, W) : ' Nothing more.');
    return { id: factId(f), a: f.a, b: f.b, total, words: W, e: o.e, one: o.one, many: o.many, tier: f.tier, options, signs: !!ad.rules.showSigns,
      text: first + '. How many in all?', hint: 'Let\u2019s count. ' + counted, miss: 'Listen again. ' + first + '. How many in all?',
      right: 'Yes! ' + first + ' makes ' + N(total) + '.' };
  };
  K.addSummary = function (answers, ad) {
    const stats = K.addStats(answers, ad), tier = K.addTier(ad, stats);
    const rows = ad.facts.map(f => { const s = stats[factId(f)];
      return { id: factId(f), a: f.a, b: f.b, tier: f.tier, open: f.tier <= tier, seen: s ? s.seen : 0, cleanSessions: s ? s.cleanSessions : 0, misses: s ? s.misses : 0, hints: s ? s.hints : 0, status: s && s.known ? 'known' : s ? 'learning' : 'new' }; });
    return { rows, tier, tiers: ad.tiers.length, known: rows.filter(r => r.status === 'known').length };
  };
})();
