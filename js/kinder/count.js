/* kinder/count.js - Count to 20 (v12; v13.3: he taps to count, the voice says the running count, then he taps the number; the total is never said first). Three kinds of question: count along (tap each picture while the voice counts), how many (count them, tap the
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
  /* v13.3: tap to count. groups: [{ n, key, label }]. Each tap marks the picture with its number and the voice says the running count
     (one, two, three ...). Tapping a marked picture takes it back out (the numbers close up, nothing is said). "Count again" clears them all.
     Nothing here says or shows how many there are before he counts them: labels name the pictures, never the number. */
  K.tapCounter = function (item, ctl, words, groups) {
    let order = [];
    const out = h('div', { class: 'count-out k-count-out', 'aria-live': 'polite', 'data-count-out': '' }, '0');
    const all = [];
    const paint = () => {
      all.forEach(b => { const k = order.indexOf(b); b.classList.toggle('counted', k >= 0); b.setAttribute('aria-pressed', k >= 0 ? 'true' : 'false');
        b.querySelector('.k-badge').textContent = k >= 0 ? String(k + 1) : ''; });
      out.textContent = String(order.length);
    };
    const boxes = groups.map(g => {
      if (!g.n) return h('div', { class: 'k-group k-none', 'data-group': g.key, role: 'img', 'aria-label': 'none' });
      const btns = [];
      for (let i = 0; i < g.n; i++) {
        const b = h('button', { class: 'k-obj', type: 'button', 'data-obj': g.key + i, 'aria-label': item.one, 'aria-pressed': 'false', onclick: () => {
          const k = order.indexOf(b);
          if (k >= 0) { order.splice(k, 1); paint(); return; }
          order.push(b); paint(); ctl.say(K.num(order.length, words));
        } }, h('span', { 'aria-hidden': 'true' }, item.e), h('span', { class: 'k-badge', 'aria-hidden': 'true' }, ''));
        btns.push(b); all.push(b);
      }
      return h('div', { class: 'k-group k-objs', 'data-group': g.key, role: 'group', 'aria-label': g.label }, btns);
    });
    const reset = () => { order = []; paint(); };
    const again = h('button', { class: 'btn ghost k-again', type: 'button', 'data-count-again': '', 'aria-label': 'Count again', onclick: () => { reset(); ctl.say('Let\u2019s count again.'); } }, h('span', { 'aria-hidden': 'true' }, '\u21ba'), ' Count again');
    return { boxes, out, again, reset, count: () => order.length };
  };
  /* the number choices; a wrong tap clears the count so he can count again; after two wrong taps the voice counts with him and says the answer */
  K.numberChoices = function (item, ctl, counter, extra, together) {
    let answered = false, wrongs = 0;
    const buttons = item.options.map((o, i) => h('button', { class: 'opt solo-opt k-opt k-numopt', type: 'button', 'data-opt': i, 'data-n': o.n, 'aria-label': String(o.n),
      onclick: async () => {
        if (answered || buttons[i].disabled) return;
        if (o.right) {
          answered = true;
          buttons.forEach((b, bi) => { b.classList.toggle('right', bi === i); if (bi !== i) b.disabled = true; });
          ctl.say(item.right);
          await ctl.finish({ wrongs, extra, message: item.right });
        } else {
          wrongs++;
          buttons[i].disabled = true; buttons[i].classList.add('tried');
          if (counter) counter.reset();
          ctl.miss(item.kind ? item.kind + ' ' + o.n : item.id + ' ' + o.n, wrongs >= 2 ? together : item.miss);
        }
      } }, h('span', { class: 'k-num', 'aria-hidden': 'true' }, String(o.n)), item.dots ? dots(o.n) : null));
    return { buttons, box: h('div', { class: 'opts solo-opts kid-opts k-opts k-numopts', role: 'group', 'aria-label': 'Numbers' }, buttons) };
  };

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
      if (item.kind === 'next') {
        let seqEnd = null;
        const ch = K.numberChoices(item, ctl, null, { kind: item.kind, n: item.n }, item.miss);
        ch.buttons.forEach(b => b.addEventListener('click', () => { if (b.classList.contains('right') && seqEnd) { seqEnd.textContent = String(item.n); seqEnd.classList.add('filled'); } }));
        seqEnd = h('span', { class: 'k-seqtile k-seqq', 'data-seq-q': '', 'aria-label': 'the next number' }, '?');
        const tiles = item.seq.map(n => h('span', { class: 'k-seqtile', 'data-seq': n }, String(n)));
        return [h('div', { class: 'k-seq k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Numbers in order, then a question mark' }, tiles.concat([seqEnd])), ch.box];
      }
      const c = K.tapCounter(item, ctl, W, [{ n: item.n, key: 'a', label: item.many }]);
      const ch = K.numberChoices(item, ctl, c, { kind: item.kind, n: item.n }, item.together);
      return [h('div', { class: 'k-focus', tabindex: '-1', 'data-kind': item.kind }, c.boxes), h('div', { class: 'k-countrow' }, c.out, c.again), ch.box];
    }
  };
})();
