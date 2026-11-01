/* kinder/more.js - v15 "Which has more?": two picture groups (a blue box and an orange box). He taps each picture to count it (each box keeps its own
   count, the voice says the running count), then taps the blue box's button, the orange box's button, or "the same" (a balance).
   The question is "Which has more?" (from level 2 also "Which has fewer?"). Nothing says or shows how many before he answers.
   Levels (star levels, data/kinder/levels.json): 1 = groups of 1 to 5, 2 = up to 10 and "fewer", 3 = up to 15. Saved as activity 'more', item "a-b-more|fewer". */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const OBJ = [{ e: '\uD83C\uDF4E', many: 'apples' }, { e: '\u2B50', many: 'stars' }, { e: '\uD83D\uDC1F', many: 'fish' }, { e: '\uD83C\uDF88', many: 'balloons' }, { e: '\uD83D\uDC1E', many: 'ladybugs' }, { e: '\uD83C\uDF3C', many: 'flowers' }];
  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
  const N = n => '{{n:' + n + '|' + NUMW[n] + '}}';
  const MAXES = [5, 10, 15];
  K.moreMax = level => MAXES[Math.max(1, Math.min(MAXES.length, level || 1)) - 1];
  /* one question. q: 'more' | 'fewer'. When a === b the answer is "the same". */
  K.moreItem = function (a, b, q) {
    const o = OBJ[Math.floor(K.rng() * OBJ.length)];
    const right = a === b ? 'same' : (q === 'more') === (a > b) ? 'left' : 'right';
    const ask = q === 'more' ? 'Which has more?' : 'Which has fewer?';
    const word = a === b ? 'They are the same.' : q === 'more' ? N(Math.max(a, b)) + ' is more than ' + N(Math.min(a, b)) + '.' : N(Math.min(a, b)) + ' is fewer than ' + N(Math.max(a, b)) + '.';
    return { id: a + '-' + b + '-' + q, a, b, q, e: o.e, one: o.many, many: o.many, right,
      text: 'Count the ' + o.many + ' in each box. ' + ask + ' The blue box, the orange box, or the same?',
      hint: 'Count one box, then the other. The bigger number has more. If they match, tap the same.',
      miss: 'Let\u2019s count again. ' + ask, rightMsg: 'Yes! ' + N(a) + ' and ' + N(b) + '. ' + word };
  };
  K.planMore = function (answers, level) {
    const max = K.moreMax(level), out = [];
    for (let i = 0; i < 6; i++) {
      const lo = level >= 2 ? 2 : 1;
      let a = lo + Math.floor(K.rng() * (max - lo + 1)), b = lo + Math.floor(K.rng() * (max - lo + 1));
      if (i === 2 || i === 5 && K.rng() < 0.5) b = a;                 // a "same" question in most rounds
      else if (a === b) b = a === max ? a - 1 : a + 1;
      const q = level >= 2 && i % 2 === 1 ? 'fewer' : 'more';
      out.push(K.moreItem(a, b, q));
    }
    return out;
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.more = {
    id: 'more', code: 7, title: 'Which has more?', icon: '\u2696\uFE0F', hintNoun: 'answer',
    intro: 'Which has more? Count the pictures in each box, then tap the box with more. Tap the green button to start.',
    rules: () => ({ roundItems: 6, maxRoundItems: 8 }),
    plan(env) { return K.planMore(env.answers, env.level); },
    redo(env, item) { return K.moreItem(item.b, item.a, item.q); },          // the same numbers, swapped sides
    draw(item, ctl) {
      const counters = [['left', item.a, 'blue'], ['right', item.b, 'orange']].map(([side, n, col]) => {
        const c = K.tapCounter(item, ctl, NUMW, [{ n, key: side, label: item.many + ', ' + col + ' box' }]);
        return { side, c, el: h('div', { class: 'k-side k-side-' + col, 'data-side-box': side }, c.boxes[0], h('div', { class: 'k-countrow' }, c.out)) };
      });
      let answered = false, wrongs = 0;
      const picks = [['left', 'k-pick-blue', item.e, 'the blue box'], ['same', 'k-pick-same', '\u2696\uFE0F', 'the same'], ['right', 'k-pick-orange', item.e, 'the orange box']].map(([v, cls, pic, label]) => {
        const b = h('button', { class: 'opt k-opt k-pickbtn ' + cls, type: 'button', 'data-pick': v, 'aria-label': label, onclick: async () => {
          if (answered || b.disabled) return;
          if (v === item.right) {
            answered = true; b.classList.add('right'); picks.forEach(x => { if (x !== b) x.disabled = true; });
            ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { q: item.q }, message: item.rightMsg });
          } else {
            wrongs++; b.disabled = true; b.classList.add('tried');
            counters.forEach(x => x.c.reset());
            ctl.miss('more ' + v, item.miss);
          }
        } }, h('span', { 'aria-hidden': 'true' }, pic));
        return b;
      });
      return [h('div', { class: 'k-sides k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Two boxes of ' + item.many }, counters.map(x => x.el)),
        h('div', { class: 'k-picks', role: 'group', 'aria-label': 'Which one' }, picks)];
    }
  };
})();
