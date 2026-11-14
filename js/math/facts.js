/* math/facts.js - the fact list for Math Fact Flash Cards.
   Every fact stays inside the 3rd-grade finger-counting range the grown-up approved:
     sums at most 18, minuends at most 18, no negative answers,
     and no 0 or 1 (so +0, -0, +1 and -1 never appear, and the answer is never 0 or 1).
   About half the draws are addition and half are subtraction.
   Doubles, half-doubles, make-10s, near-doubles, from-10 facts and subtracting 2-9
   are weighted so they come up much more often than the other facts in range.
   The same fact is never drawn twice in a row. */
(function () {
  function fact(a, op, b) {
    const answer = op === '+' ? a + b : a - b;
    return { a: a, op: op, b: b, answer: answer, key: a + op + b };
  }
  function valid(f) {
    if (!f || (f.op !== '+' && f.op !== '-')) return false;
    if (!Number.isInteger(f.a) || !Number.isInteger(f.b) || !Number.isInteger(f.answer)) return false;
    if (f.a < 2 || f.b < 2 || f.answer < 2) return false;
    if (f.op === '+') return f.a + f.b === f.answer && f.answer <= 18;
    return f.a - f.b === f.answer && f.a <= 18;
  }

  const ADD = [], SUB = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const f = fact(a, '+', b);
      if (valid(f)) ADD.push(f);
    }
  }
  for (let b = 2; b <= 9; b++) {
    for (let a = b + 2; a <= 18; a++) {
      const f = fact(a, '-', b);
      if (valid(f)) SUB.push(f);
    }
  }

  /* Higher numbers are the finger-counting families. Everything else in range stays in the pile at weight 1. */
  function weight(f) {
    let w = 1;
    if (f.op === '+') {
      if (f.a === f.b) w += 5;                       // doubles: 7+7
      if (f.a + f.b === 10) w += 5;                  // make-10: 6+4, 3+7
      if (Math.abs(f.a - f.b) === 1) w += 5;         // near-doubles: 6+7
    } else {
      w += 2;                                        // subtracting 2-9
      if (f.a === 10) w += 6;                        // from-10: 10-n
      if (f.a === f.b * 2) w += 6;                   // half-doubles: 14-7
      if (Math.abs(f.answer - f.b) === 1) w += 5;    // near-doubles: 13-6
    }
    return w;
  }
  function weighted(list) {
    let total = 0;
    const ws = list.map(f => { const w = weight(f); total += w; return w; });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= ws[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /* state: { prev: key of the fact just shown, addN, subN }. Returns the next fact and the new counts. */
  function next(state) {
    state = state || {};
    const prev = state.prev || '';
    const addN = state.addN || 0, subN = state.subN || 0;
    const gap = addN - subN;
    let op;
    if (gap >= 2) op = '-';
    else if (gap <= -2) op = '+';
    else if (gap > 0) op = Math.random() < 0.75 ? '-' : '+';
    else if (gap < 0) op = Math.random() < 0.75 ? '+' : '-';
    else op = Math.random() < 0.5 ? '+' : '-';
    const pile = op === '+' ? ADD : SUB;
    const filtered = pile.filter(f => f.key !== prev);
    const f = weighted(filtered.length ? filtered : pile);
    return { fact: f, addN: addN + (f.op === '+' ? 1 : 0), subN: subN + (f.op === '-' ? 1 : 0), prev: f.key };
  }

  JU.mathFacts = {
    ROUND_MS: 60000,
    all() { return ADD.concat(SUB); },
    valid: valid,
    weight: weight,
    next: next
  };
})();
