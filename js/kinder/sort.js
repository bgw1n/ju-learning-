/* kinder/sort.js - v18 sort. Level 1: small, medium, or big. Level 2: circle, square, or triangle.
   Level 3 (harder top) mixes the two. He taps the bin that matches. The prompt does not say which one is right.
   Size and shape names are spoken only after he taps the right bin. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const SIZES = [{ id: 'small', name: 'small', cls: 'k-s1' }, { id: 'medium', name: 'medium', cls: 'k-s2' }, { id: 'big', name: 'big', cls: 'k-s3' }];
  const THINGS = ['\uD83D\uDC3B', '\u2B50', '\uD83C\uDF4E', '\u26BD', '\uD83D\uDC31'];
  const SHAPES = [
    { id: 'circle', name: 'circle', bin: '\u26AA', thing: '\u26BD', thingName: 'ball' },
    { id: 'square', name: 'square', bin: '\u2B1C', thing: '\uD83D\uDCE6', thingName: 'box' },
    { id: 'triangle', name: 'triangle', bin: '\uD83D\uDD3A', thing: '\uD83C\uDF55', thingName: 'pizza' }
  ];
  const say = w => '{{w:' + w + '|' + w + '}}';
  K.sortItem = function (mode) {
    if (mode === 'shape') {
      const s = SHAPES[Math.floor(K.rng() * SHAPES.length)];
      const opts = K.shuffle(SHAPES.map(x => ({ id: x.id, face: x.bin, name: x.name, right: x.id === s.id })));
      const text = 'Tap the shape that matches.';
      K.hidesWord(text, s.name);
      return { id: 'shape-' + s.id, mode, opts, face: s.thing, faceName: s.thingName, text,
        hint: 'A ball is a circle. A box is a square. A pizza slice is a triangle.',
        miss: 'Look again. Tap the shape that matches.', rightMsg: 'Yes! It is a ' + say(s.name) + '.' };
    }
    const s = SIZES[Math.floor(K.rng() * SIZES.length)];
    const thing = THINGS[Math.floor(K.rng() * THINGS.length)];
    const opts = K.shuffle(SIZES.map(x => ({ id: x.id, cls: x.cls, name: x.name, right: x.id === s.id })));
    const text = 'Tap the size that matches.';
    K.hidesWord(text, s.name);
    return { id: 'size-' + s.id, mode: 'size', opts, face: thing, cls: s.cls, text,
      hint: 'Look at how big it is. The dots are small, medium, and big.',
      miss: 'Look again. Tap the size that matches.', rightMsg: 'Yes! It is ' + say(s.name) + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.sort = {
    id: 'sort', code: 15, title: 'Sort', icon: '\uD83D\uDCE6', hintNoun: 'bin',
    intro: 'Sort! Look at the picture. Tap the bin that matches. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const lv = env.level || 1, out = [];
      for (let i = 0; i < 10; i++) {
        const mode = lv >= 3 ? (i % 2 ? 'shape' : 'size') : lv >= 2 ? 'shape' : 'size';
        out.push(Object.assign(K.sortItem(mode), { top: lv >= 3 }));
      }
      return out;
    },
    redo(env, item) { return Object.assign(K.sortItem(item.mode), { top: !!item.top }); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const shown = item.mode === 'shape'
        ? h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': item.faceName }, item.face)
        : h('div', { class: 'k-sizestage', role: 'img', 'aria-label': 'a picture to sort' }, h('span', { class: 'k-lpic ' + item.cls, 'aria-hidden': 'true' }, item.face));
      const btns = item.opts.map(o => {
        const face = item.mode === 'shape'
          ? h('span', { class: 'k-lpic', 'aria-hidden': 'true' }, o.face)
          : h('span', { class: 'k-lpic ' + o.cls, 'aria-hidden': 'true' }, '\u26AB');
        const b = h('button', { class: 'opt k-opt k-sortbin', type: 'button', 'data-pick': o.id, 'data-right': o.right ? '1' : null, 'aria-label': 'a bin',
          onclick: async () => {
            if (answered || b.disabled) return;
            if (o.right) { answered = true; btns.forEach(x => { x.disabled = true; }); b.classList.add('right'); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { mode: item.mode }, message: item.rightMsg }); }
            else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('sort ' + o.id, item.miss); }
          } }, face);
        return b;
      });
      return [shown, h('div', { class: 'k-bins k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Bins', 'data-sort': item.mode, 'data-top': item.top ? '1' : null }, btns)];
    }
  };
})();
