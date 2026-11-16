/* kinder/hundred.js - v18 missing number, counting toward 100. A short run with one blank, then number cards.
   The blank stays blank, and the voice never says the missing number before he taps a card.
   Level 1: the blank is in the middle, numbers up to 50. Level 2 (harder top): up to 100, and the blank may be first or last. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  function cellsFor(n, where) {
    if (where === 'start') return [null, n + 1, n + 2];
    if (where === 'end') return [n - 2, n - 1, null];
    return [n - 1, null, n + 1];
  }
  K.missItem = function (n, where, hard) {
    const cells = cellsFor(n, where || 'mid');
    const shown = cells.filter(x => x != null);
    const cand = [];
    [n - 3, n - 2, n + 2, n + 3, n - 4, n + 4].forEach(x => { if (x >= 1 && x <= 100 && x !== n && shown.indexOf(x) < 0 && cand.indexOf(x) < 0) cand.push(x); });
    const options = K.shuffle([n].concat(K.shuffle(cand).slice(0, 2))).map(x => ({ n: x, right: x === n }));
    const said = cells.map(x => x == null ? 'a blank' : K.numWord(x)).join(', ');
    const text = said + '. What number is missing?';
    K.hidesNumber(text, n);
    return { id: 'miss-' + n, n, where: where || 'mid', cells, options, hard: !!hard, text,
      hint: 'Say the numbers you can see. The missing number is the one that belongs in the blank.',
      miss: 'Look again. What number is missing?',
      right: 'Yes! The missing number is ' + K.numWord(n) + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.hundred = {
    id: 'hundred', code: 18, title: 'Missing number', icon: '\uD83D\uDCAF', hintNoun: 'number',
    intro: 'Missing number! A number is hiding. Tap the card that belongs in the blank. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const hard = (env.level || 1) >= 2, out = [], wheres = ['start', 'mid', 'end'];
      for (let i = 0; i < 10; i++) {
        const where = hard ? wheres[i % 3] : 'mid';
        const n = where === 'start' ? 51 + Math.floor(K.rng() * 47) : where === 'end' ? 53 + Math.floor(K.rng() * 46) : hard ? 55 + Math.floor(K.rng() * 44) : 12 + Math.floor(K.rng() * 37);
        out.push(K.missItem(n, where, hard));
      }
      return out;
    },
    redo(env, item) { return K.missItem(item.n, item.where, !!item.hard); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const tiles = item.cells.map(n => n == null
        ? h('span', { class: 'k-seqtile k-seqq', 'data-seq-q': '', 'aria-label': 'the missing number' }, '?')
        : h('span', { class: 'k-seqtile', 'data-seq': n }, String(n)));
      const buttons = item.options.map(o => h('button', { class: 'opt solo-opt k-opt k-numopt', type: 'button', 'data-opt': o.n, 'data-n': o.n, 'data-right': o.right ? '1' : null, 'aria-label': String(o.n),
        onclick: async () => {
          if (answered || buttons.some(b => b.disabled && b.classList.contains('right'))) return;
          const b = buttons.find(x => x.getAttribute('data-n') === String(o.n));
          if (o.right) {
            answered = true; buttons.forEach(x => { x.disabled = true; }); b.classList.add('right');
            const blank = tiles.find(t => t.getAttribute('data-seq-q') != null);
            if (blank) { blank.textContent = String(item.n); blank.classList.add('filled'); }
            ctl.say(item.right); await ctl.finish({ wrongs, extra: { kind: 'miss', n: item.n }, message: item.right });
          } else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('miss ' + o.n, item.miss); }
        } }, h('span', { class: 'k-num', 'aria-hidden': 'true' }, String(o.n))));
      return [
        h('div', { class: 'k-seq k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Numbers with one missing', 'data-miss': item.hard ? 'hard' : 'easy', 'data-top': item.hard ? '1' : null }, tiles),
        h('div', { class: 'opts solo-opts kid-opts k-opts k-numopts', role: 'group', 'aria-label': 'Numbers' }, buttons)];
    }
  };
})();
