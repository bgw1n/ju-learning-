/* reading/passages.js - passages, timing, and scoring for Reading Speed.
   Passages live in data/reading/passages.json so a tutor can add one each week.
   The focus letter is the optimal recognition point: a bit left of center,
   the letter a reader lands on when a word flashes in one spot.
   Benchmarks: she started at 57 wpm, school measured 99, and the goal is 112. */
(function () {
  const BENCH = { start: 57, school: 99, goal: 112 };
  let cache = null;

  function snapWpm(n, fallback) {
    let w = Math.round(Number(n));
    if (!isFinite(w)) return fallback;
    w = Math.round(w / 5) * 5;
    if (w < 40) return 40;
    if (w > 200) return 200;
    return w;
  }

  /* Letters only, so "island," and "island." share a focus letter. */
  function lettersOf(token) {
    const m = /^([^A-Za-z]*)([A-Za-z']*)(.*)$/.exec(String(token || ''));
    return m ? { lead: m[1], letters: m[2], tail: m[3] } : { lead: '', letters: '', tail: String(token || '') };
  }
  function orpIndex(len) {
    if (len <= 1) return 0;
    if (len <= 5) return 1;
    if (len <= 9) return 2;
    if (len <= 13) return 3;
    return 4;
  }
  function focusParts(token) {
    const p = lettersOf(token);
    if (!p.letters) return { before: String(token || ''), focus: '', after: '' };
    const i = Math.min(orpIndex(p.letters.length), p.letters.length - 1);
    return {
      before: p.lead + p.letters.slice(0, i),
      focus: p.letters.charAt(i),
      after: p.letters.slice(i + 1) + p.tail
    };
  }

  function prepare(raw) {
    const text = String(raw && raw.text || '').replace(/\r\n/g, '\n').trim();
    const tokens = [];
    const paras = [];
    text.split(/\n\s*\n/).forEach(block => {
      const words = block.trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      paras.push({ start: tokens.length, words: words });
      words.forEach(w => tokens.push(w));
    });
    const questions = (Array.isArray(raw && raw.questions) ? raw.questions : []).map(q => ({
      prompt: String(q && q.prompt || ''),
      choices: (Array.isArray(q && q.choices) ? q.choices : []).map(c => String(c)),
      answer: Math.max(0, Math.floor(Number(q && q.answer) || 0))
    })).filter(q => q.prompt && q.choices.length >= 2);
    return {
      id: String(raw && raw.id || ''),
      title: String(raw && raw.title || 'Passage'),
      emoji: String(raw && raw.emoji || '\uD83D\uDCD6'),
      blurb: String(raw && raw.blurb || ''),
      text: text,
      tokens: tokens,
      paras: paras,
      wordCount: tokens.length,
      questions: questions
    };
  }

  function normWord(token) {
    return String(token || '').toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  }

  /* Extra pause at a comma, a sentence end, and a long word (8+ letters). */
  function delayMs(token, wpm) {
    let rate = Number(wpm);
    if (!isFinite(rate) || rate <= 0) rate = 60;
    const base = 60000 / rate;
    let extra = 0;
    const letters = (String(token || '').match(/[A-Za-z]/g) || []).length;
    if (/[.!?]["']?$/.test(token)) extra += base * 0.8;
    else if (/[,;:]["']?$/.test(token)) extra += base * 0.45;
    if (letters >= 8) extra += base * 0.35;
    return Math.round(base + extra);
  }

  function isBoundary(token) { return /[.!?,;:]["']?$/.test(token || ''); }
  function boundaryBefore(tokens, index) {
    let s = index;
    while (s > 0 && !isBoundary(tokens[s - 1])) s--;
    return s;
  }
  /* Jump to the start of this phrase, or the phrase before it when we are already near that start. */
  function phraseBack(tokens, index) {
    if (!tokens || !tokens.length || index <= 0) return 0;
    const start = boundaryBefore(tokens, index);
    if (index - start >= 4) return start;
    if (start <= 0) return 0;
    return boundaryBefore(tokens, start - 1);
  }

  /* wordsRead includes the last word. misses are red words inside that span.
     elapsedMs is the real time for an early finish, or 60000 when the minute ran out.
     wpm scales correct words up to a full minute. */
  function score(wordsRead, misses, elapsedMs) {
    wordsRead = Math.max(0, Math.floor(Number(wordsRead) || 0));
    misses = Math.max(0, Math.floor(Number(misses) || 0));
    if (misses > wordsRead) misses = wordsRead;
    const correct = wordsRead - misses;
    const elapsed = Math.max(1, Math.floor(Number(elapsedMs) || 0));
    const wpm = Math.round(correct * 60000 / elapsed);
    const accuracy = wordsRead ? Math.round(100 * correct / wordsRead) : 0;
    return { wpm: wpm, accuracy: accuracy, correct: correct, wordsRead: wordsRead, misses: misses, elapsed: elapsed };
  }

  /* 3 stars at the school score (99), 2 stars from 80 up, 1 star for any slower read. */
  function stars(wpm) {
    if (!(Number(wpm) > 0)) return 0;
    if (wpm >= BENCH.school) return 3;
    if (wpm >= 80) return 2;
    return 1;
  }
  function starText(n) { return n > 0 ? '\u2B50'.repeat(n) : ''; }

  function clock(ms) {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function benchmarksOf(data) {
    const b = data && data.benchmarks || {};
    return {
      start: isFinite(Number(b.start)) ? Number(b.start) : BENCH.start,
      school: isFinite(Number(b.school)) ? Number(b.school) : BENCH.school,
      goal: isFinite(Number(b.goal)) ? Number(b.goal) : BENCH.goal
    };
  }

  async function load() {
    if (cache) return cache;
    const r = await fetch('data/reading/passages.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load reading passages');
    const data = await r.json();
    const passages = (Array.isArray(data.passages) ? data.passages : []).map(prepare).filter(p => p.id && p.tokens.length);
    cache = { unit: String(data.unit || 'Reading'), note: String(data.note || ''), benchmarks: benchmarksOf(data), passages: passages };
    return cache;
  }

  JU.reading = {
    BENCH: BENCH,
    WPM_MIN: 40,
    WPM_MAX: 200,
    WPM_STEP: 5,
    WPM_START: 60,
    READ_MS: 60000,
    snapWpm: snapWpm,
    orpIndex: orpIndex,
    focusParts: focusParts,
    normWord: normWord,
    delayMs: delayMs,
    phraseBack: phraseBack,
    score: score,
    stars: stars,
    starText: starText,
    clock: clock,
    load: load,
    current: function () { return null; },
    flash: null
  };
})();
