/* kinder/graph.js - v18 picture graph. Rows of pictures, no numbers written on the rows.
   Level 1: how many in one row. He may tap the pictures to count (each tap says the next number), then tap a number card.
   Level 2: which row has more. He taps the row. Nothing says or shows a count before he picks.
   Level 3 (harder top): three rows, the amounts are only 1 apart, how many and which-has-more mixed. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const ROWS = [
    { e: '\u2B50', many: 'stars' }, { e: '\uD83C\uDF4E', many: 'apples' }, { e: '\uD83D\uDC1F', many: 'fish' },
    { e: '\uD83C\uDF88', many: 'balloons' }, { e: '\uD83C\uDF3C', many: 'flowers' }, { e: '\uD83D\uDC9B', many: 'hearts' }
  ];
  function pickRows(k, lo, hi, close) {
    const kinds = K.shuffle(ROWS).slice(0, k);
    let nums;
    if (close) {
      const start = lo + Math.floor(K.rng() * (hi - lo - (k - 1) + 1));
      nums = kinds.map((_, i) => start + i);
    } else {
      nums = [];
      while (nums.length < k) { const n = lo + Math.floor(K.rng() * (hi - lo + 1)); if (nums.indexOf(n) < 0) nums.push(n); }
    }
    return kinds.map((r, i) => Object.assign({ n: nums[i], key: 'r' + i }, r));
  }
  K.graphItem = function (mode, hard) {
    const k = hard ? 3 : 2;
    const rows = pickRows(k, hard ? 3 : 1, hard ? 6 : 5, !!hard);
    if (mode === 'more') {
      let best = 0;
      rows.forEach((r, i) => { if (r.n > rows[best].n) best = i; });
      if (rows.filter(r => r.n === rows[best].n).length > 1) rows[best].n += 1;
      rows.forEach((r, i) => { r.right = i === best; });
      const text = 'Which row has more? Tap that row.';
      rows.forEach(r => K.hidesNumber(text, r.n));
      const win = rows[best];
      return { id: 'more-' + rows.map(r => r.n).join('-'), mode, hard: !!hard, rows, text,
        hint: 'Count the pictures in each row. The row with the most pictures has more.',
        miss: 'Look again. Which row has more?',
        rightMsg: 'Yes! The ' + win.many + ' have more. There are ' + K.numWord(win.n) + '.' };
    }
    const ask = rows[Math.floor(K.rng() * rows.length)];
    const text = 'How many ' + ask.many + '? Tap each picture to count, then tap the number.';
    K.hidesNumber(text, ask.n);
    const opts = K.shuffle([ask.n].concat(K.nearNumbers(ask.n, 2, 1, 10)).map(n => ({ n, right: n === ask.n })));
    return { id: 'how-' + ask.many + '-' + ask.n, mode: 'howmany', hard: !!hard, rows, ask: ask.key, n: ask.n, e: ask.e, one: ask.many, many: ask.many, options: opts, dots: false, text,
      hint: 'Tap each picture in that row. The last number you hear is how many.',
      miss: 'Let\u2019s count again. Tap each picture, then tap the number.',
      together: 'Let\u2019s count again. Tap each picture.',
      right: 'Yes! There are ' + K.numWord(ask.n) + ' ' + ask.many + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.graph = {
    id: 'graph', code: 16, title: 'Picture graph', icon: '\uD83D\uDCCA', hintNoun: 'row',
    intro: 'Picture graph! Look at the rows of pictures. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const lv = env.level || 1, out = [];
      for (let i = 0; i < 10; i++) {
        const mode = lv >= 3 ? (i % 2 ? 'more' : 'howmany') : lv >= 2 ? 'more' : 'howmany';
        out.push(K.graphItem(mode, lv >= 3));
      }
      return out;
    },
    redo(env, item) { return K.graphItem(item.mode, !!item.hard); },
    draw(item, ctl) {
      if (item.mode === 'howmany') {
        const asked = item.rows.find(r => r.key === item.ask);
        const words = [];
        for (let i = 0; i <= 10; i++) words.push(K.numberWord(i));
        const counter = K.tapCounter(item, ctl, words, [{ n: asked.n, key: 'a', label: asked.many }]);
        counter.boxes[0].classList.add('k-grow');
        counter.boxes[0].setAttribute('data-ask-row', '');
        const ch = K.numberChoices(item, ctl, counter, { kind: 'graph', n: item.n }, item.together);
        const others = item.rows.filter(r => r.key !== item.ask).map(r => {
          const pics = [];
          for (let i = 0; i < r.n; i++) pics.push(h('span', { class: 'k-gpic', 'aria-hidden': 'true' }, r.e));
          return h('div', { class: 'k-grow k-grow-still', 'data-row': r.key, role: 'img', 'aria-label': r.many }, pics);
        });
        return [h('div', { class: 'k-graph k-focus', tabindex: '-1', 'data-graph': 'howmany', 'data-graph-board': '', 'data-top': item.hard ? '1' : null }, others, counter.boxes), h('div', { class: 'k-countrow' }, counter.out, counter.again), ch.box];
      }
      let answered = false, wrongs = 0;
      const btns = item.rows.map(r => {
        const pics = [];
        for (let i = 0; i < r.n; i++) pics.push(h('span', { class: 'k-gpic', 'aria-hidden': 'true' }, r.e));
        const b = h('button', { class: 'k-grow', type: 'button', 'data-pick': r.key, 'data-right': r.right ? '1' : null, 'aria-label': r.many,
          onclick: async () => {
            if (answered || b.disabled) return;
            if (r.right) { answered = true; btns.forEach(x => { x.disabled = true; }); b.classList.add('right'); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { mode: 'more' }, message: item.rightMsg }); }
            else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('graph ' + r.key, item.miss); }
          } }, pics);
        return b;
      });
      return [h('div', { class: 'k-graph k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Rows of pictures', 'data-graph': 'more', 'data-graph-board': '', 'data-top': item.hard ? '1' : null }, btns)];
    }
  };
})();
