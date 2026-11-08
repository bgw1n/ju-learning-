/* kinder/more.js - v15 "Which has more?": two picture groups (a blue box and an orange box). He taps each picture to count it (each box keeps its own
   count, the voice says the running count), then taps the blue box's button, the orange box's button, or "the same" (a balance).
   The question is "Which has more?" (from level 2 also "Which has fewer?"). Nothing says or shows how many before he answers.
   Levels (star levels, data/kinder/levels.json): 1 = groups of 1 to 5, 2 = up to 10 and "fewer", 3 = up to 15. Saved as activity 'more', item "a-b-more|fewer". */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const OBJ = [{ e: '\uD83C\uDF4E', many: 'apples' }, { e: '\u2B50', many: 'stars' }, { e: '\uD83D\uDC1F', many: 'fish' }, { e: '\uD83C\uDF88', many: 'balloons' }, { e: '\uD83D\uDC1E', many: 'ladybugs' }, { e: '\uD83C\uDF3C', many: 'flowers' }];
  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const N = n => '{{n:' + n + '|' + NUMW[n] + '}}';
  const MAXES = [5, 10, 15, 20, 20];
  K.moreMax = level => MAXES[Math.max(1, Math.min(MAXES.length, level || 1)) - 1];
  /* one question. q: 'more' | 'fewer' | 'equal'. When a === b the answer is "the same" (equal). Nothing here says the two counts. */
  K.moreItem = function (a, b, q) {
    const o = OBJ[Math.floor(K.rng() * OBJ.length)];
    const asking = q === 'equal' ? 'more' : q;
    const right = a === b ? 'same' : (asking === 'more') === (a > b) ? 'left' : 'right';
    const ask = q === 'fewer' ? 'Which has fewer?' : q === 'equal' ? 'Are they the same? Are they equal?' : 'Which has more?';
    const word = a === b ? 'They are equal. They are the same.' : asking === 'more' ? N(Math.max(a, b)) + ' is more than ' + N(Math.min(a, b)) + '.' : N(Math.min(a, b)) + ' is fewer than ' + N(Math.max(a, b)) + '.';
    return { id: a + '-' + b + '-' + (q === 'equal' ? 'equal' : asking), a, b, q: q === 'equal' ? 'equal' : asking, e: o.e, one: o.many, many: o.many, right,
      text: 'Count the ' + o.many + ' in each box. ' + ask + ' The blue box, the orange box, or the same?',
      hint: q === 'fewer' ? 'Count one box, then the other. The smaller number has fewer. If they match, tap the same.' : 'Count one box, then the other. The bigger number has more. If they match, they are equal. Tap the same.',
      miss: 'Let\u2019s count again. ' + ask, rightMsg: 'Yes! ' + N(a) + ' and ' + N(b) + '. ' + word };
  };
  K.planMore = function (answers, level) {
    const lv = level || 1, max = K.moreMax(lv), out = [];
    for (let i = 0; i < 10; i++) {
      let a, b, q;
      if (lv >= 5) {
        a = 10 + Math.floor(K.rng() * 11);
        const delta = i % 3 === 2 ? 0 : (K.rng() < 0.5 ? -1 : 1);
        b = Math.max(1, Math.min(20, a + delta));
        q = a === b ? 'equal' : (i % 2 === 0 ? 'more' : 'fewer');
      } else if (lv >= 4) {
        q = ['more', 'fewer', 'equal'][i % 3];
        const lo = 6;
        a = lo + Math.floor(K.rng() * (max - lo + 1));
        if (q === 'equal') b = a;
        else { b = lo + Math.floor(K.rng() * (max - lo + 1)); if (a === b) b = a === max ? a - 1 : a + 1; }
      } else {
        const lo = lv >= 2 ? 2 : 1;
        a = lo + Math.floor(K.rng() * (max - lo + 1));
        b = lo + Math.floor(K.rng() * (max - lo + 1));
        if (i % 5 === 2) b = a;
        else if (a === b) b = a === max ? a - 1 : a + 1;
        q = lv >= 2 && i % 2 === 1 ? 'fewer' : 'more';
      }
      out.push(K.moreItem(a, b, q));
    }
    return out;
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.more = {
    id: 'more', code: 7, title: 'Which has more?', icon: '\u2696\uFE0F', hintNoun: 'answer',
    intro: 'Which has more? Count the pictures in each box, then tap the box with more. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { return K.planMore(env.answers, env.level); },
    redo(env, item) { return K.moreItem(item.b, item.a, item.q); },          // the same numbers, swapped sides
    draw(item, ctl) {
      const big = item.a > 5 || item.b > 5;
      const counters = [['left', item.a, 'blue'], ['right', item.b, 'orange']].map(([side, n, col]) => {
        const groups = n > 10
          ? [{ n: 10, key: side + 'a', label: item.many + ', ' + col + ' box' }, { n: n - 10, key: side + 'b', label: item.many + ', ' + col + ' box' }]
          : [{ n, key: side, label: item.many + ', ' + col + ' box' }];
        const c = K.tapCounter(item, ctl, NUMW, groups, { frame: n > 5 });
        return { side, c, el: h('div', { class: 'k-side k-side-' + col + (n > 10 ? ' k-side-tall' : ''), 'data-side-box': side }, c.boxes, h('div', { class: 'k-countrow' }, c.out)) };
      });
      let answered = false, wrongs = 0;
      const picks = [['left', 'k-pick-blue', item.e, 'the blue box'], ['same', 'k-pick-same', '\u2696\uFE0F', 'the same'], ['right', 'k-pick-orange', item.e, 'the orange box']].map(([v, cls, pic, label]) => {
        const b = h('button', { class: 'opt k-opt k-pickbtn ' + cls, type: 'button', 'data-pick': v, 'data-right': v === item.right ? '1' : null, 'aria-label': label, onclick: async () => {
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
      return [h('div', { class: 'k-sides k-focus' + (big ? ' k-has-frames' : ''), tabindex: '-1', role: 'group', 'aria-label': 'Two boxes of ' + item.many }, counters.map(x => x.el)),
        h('div', { class: 'k-picks', role: 'group', 'aria-label': 'Which one' }, picks)];
    }
  };
})();
