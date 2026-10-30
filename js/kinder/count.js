/* kinder/count.js - Count to 20 (v12). Three kinds of question: count along (tap each picture while the voice counts), how many (count them, tap the
   number, with a row of dots beside each number when data/kinder/counting.json says so) and what comes next (a short run of numbers, tap the next one).
   Numbers are recorded clips (audio/round2/num-N.mp3). Which numbers come up is worked out in js/kinder/round2.js (planCount, countItem). */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  /* a row of dots in groups of five (so five is easy to see) */
  function dots(n) {
    const wrap = h('span', { class: 'k-dots', 'aria-hidden': 'true', 'data-dots': n });
    for (let i = 0; i < n; i += 5) { const g = h('span', { class: 'k-dotgroup' }); for (let j = i; j < Math.min(n, i + 5); j++) g.appendChild(h('span', { class: 'k-dot' })); wrap.appendChild(g); }
    return wrap;
  }
  /* the pictures, each tappable: a tap counts it out loud (the voice says 1, 2, 3 ...); onAll runs when every picture has been counted */
  function objects(item, ctl, words, onAll) {
    let counted = 0;
    const out = h('div', { class: 'count-out k-count-out', 'aria-live': 'polite', 'data-count-out': '' }, '0');
    const btns = [];
    for (let i = 0; i < item.n; i++) {
      const b = h('button', { class: 'k-obj', type: 'button', 'data-obj': i, 'aria-label': item.one + ' ' + (i + 1), onclick: () => {
        if (b.classList.contains('counted')) return;
        b.classList.add('counted'); b.setAttribute('aria-pressed', 'true'); counted++;
        out.textContent = String(counted);
        ctl.say(K.num(counted, words));
        if (counted === item.n && onAll) onAll();
      } }, h('span', { 'aria-hidden': 'true' }, item.e));
      btns.push(b);
    }
    return { grid: h('div', { class: 'k-objs k-focus', tabindex: '-1', role: 'group', 'aria-label': item.n + ' ' + (item.n === 1 ? item.one : item.many) }, btns), out, btns };
  }

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.count = {
    id: 'count', code: 4, title: 'Count to 20', icon: '\uD83D\uDD22', hintNoun: 'number',
    intro: 'Count to twenty! We will count pictures together. Tap the green button to start.',
    load: async () => ({ counting: await K.loadCounting() }),
    rules: env => env.counting.rules,
    plan(env) {
      const p = K.planCount(env.counting, env.answers);
      return p.items.map(it => { const x = K.countItem(env.counting, it.n, it.kind); if (it.kind === 'along') x.noHint = true; return x; });
    },
    /* a missed number comes back with different pictures and other choices */
    redo(env, item) { return K.countItem(env.counting, item.n, item.kind === 'along' ? 'howmany' : item.kind); },
    draw(item, ctl) {
      const W = item.words;
      let answered = false, wrongs = 0;
      if (item.kind === 'along') {
        const o = objects(item, ctl, W, async () => {
          answered = true;
          ctl.say(item.right);
          await ctl.finish({ wrongs: 0, extra: { kind: 'along', n: item.n }, message: item.right });
        });
        return [o.grid, o.out];
      }
      const buttons = item.options.map((o, i) => h('button', { class: 'opt solo-opt k-opt k-numopt', type: 'button', 'data-opt': i, 'data-n': o.n, 'aria-label': String(o.n),
        onclick: async () => {
          if (answered || buttons[i].disabled) return;
          if (o.right) {
            answered = true;
            buttons.forEach((b, bi) => { b.classList.toggle('right', bi === i); if (bi !== i) b.disabled = true; });
            if (seqEnd) { seqEnd.textContent = String(item.n); seqEnd.classList.add('filled'); }
            ctl.say(item.right);
            await ctl.finish({ wrongs, extra: { kind: item.kind, n: item.n }, message: item.right });
          } else {
            wrongs++;
            buttons[i].disabled = true; buttons[i].classList.add('tried');
            ctl.miss(item.kind + ' ' + o.n, item.miss);
          }
        } }, h('span', { class: 'k-num', 'aria-hidden': 'true' }, String(o.n)), item.dots ? dots(o.n) : null));
      let seqEnd = null;
      const opts = h('div', { class: 'opts solo-opts kid-opts k-opts k-numopts', role: 'group', 'aria-label': 'Numbers' }, buttons);
      if (item.kind === 'next') {
        seqEnd = h('span', { class: 'k-seqtile k-seqq', 'data-seq-q': '', 'aria-label': 'the next number' }, '?');
        const tiles = item.seq.map(n => h('span', { class: 'k-seqtile', 'data-seq': n }, String(n)));
        return [h('div', { class: 'k-seq k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Numbers in order, then a question mark' }, tiles.concat([seqEnd])), opts];
      }
      const o = objects(item, ctl, W, null);
      return [o.grid, o.out, opts];
    }
  };
})();
