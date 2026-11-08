/* kinder/shapes.js - v16 shapes. Level 1: sort a flat shape (circle, square, triangle, rectangle) by tapping the matching shape.
   Level 2: match a real thing to its solid (ball = sphere, can = cylinder, box or dice = cube, party hat = cone).
   Level 3 (harder top): the flat shape may be turned, and sometimes the solid is shown first and he taps the real thing.
   Drawn with SVG and a few emoji. No words to read. */
(function () {
  const h = JU.ui.h, svg = JU.ui.svg, K = JU.kinder;
  const FLAT = ['circle', 'square', 'triangle', 'rectangle'];
  const SOLIDS = [
    { id: 'sphere', name: 'sphere', thing: 'ball', e: '\u26BD' },
    { id: 'cylinder', name: 'cylinder', thing: 'can', e: '\uD83E\uDD6B' },
    { id: 'cube', name: 'cube', thing: 'box', e: '\uD83D\uDCE6' },
    { id: 'cone', name: 'cone', thing: 'party hat', e: '\uD83C\uDF89' }
  ];
  const FILLS = ['#e85d4c', '#3d8bfd', '#3f9c5a', '#f0a202', '#9b59b6'];
  const fill = () => FILLS[Math.floor(K.rng() * FILLS.length)];

  function flatShape(name, color, turn) {
    const g = svg('g', turn ? { transform: 'rotate(' + turn + ' 50 50)' } : null,
      name === 'circle' ? svg('circle', { cx: 50, cy: 50, r: 34, fill: color }) :
      name === 'square' ? svg('rect', { x: 18, y: 18, width: 64, height: 64, rx: 4, fill: color }) :
      name === 'triangle' ? svg('polygon', { points: '50,12 90,86 10,86', fill: color }) :
      svg('rect', { x: 8, y: 30, width: 84, height: 40, rx: 4, fill: color }));
    return svg('svg', { viewBox: '0 0 100 100', class: 'k-svg', 'aria-hidden': 'true' }, g);
  }
  function solidShape(id, color) {
    let body;
    if (id === 'sphere') body = [svg('circle', { cx: 50, cy: 52, r: 32, fill: color }), svg('ellipse', { cx: 40, cy: 40, rx: 12, ry: 8, fill: '#fff', opacity: '0.55' })];
    else if (id === 'cylinder') body = [svg('rect', { x: 26, y: 28, width: 48, height: 44, fill: color }), svg('ellipse', { cx: 50, cy: 28, rx: 24, ry: 10, fill: color, stroke: '#333', 'stroke-width': 2 }), svg('ellipse', { cx: 50, cy: 72, rx: 24, ry: 10, fill: color, stroke: '#333', 'stroke-width': 2 })];
    else if (id === 'cube') body = [svg('polygon', { points: '22,40 58,40 58,78 22,78', fill: color }), svg('polygon', { points: '22,40 40,24 76,24 58,40', fill: '#fff', opacity: '0.35' }), svg('polygon', { points: '58,40 76,24 76,62 58,78', fill: '#000', opacity: '0.18' }), svg('polygon', { points: '22,40 58,40 76,24 40,24', fill: 'none', stroke: '#333', 'stroke-width': 2 }), svg('polygon', { points: '22,40 22,78 58,78 58,40', fill: 'none', stroke: '#333', 'stroke-width': 2 }), svg('polygon', { points: '58,40 76,24 76,62 58,78', fill: 'none', stroke: '#333', 'stroke-width': 2 })];
    else body = [svg('polygon', { points: '50,14 22,72 78,72', fill: color }), svg('ellipse', { cx: 50, cy: 72, rx: 28, ry: 10, fill: color, stroke: '#333', 'stroke-width': 2 }), svg('polygon', { points: '50,14 22,72 78,72', fill: 'none', stroke: '#333', 'stroke-width': 2 })];
    return svg.apply(null, ['svg', { viewBox: '0 0 100 100', class: 'k-svg', 'aria-hidden': 'true' }].concat(body));
  }
  function hat() {
    return svg('svg', { viewBox: '0 0 100 100', class: 'k-svg', 'aria-hidden': 'true' },
      svg('polygon', { points: '50,16 24,78 76,78', fill: '#f2c14e' }),
      svg('polygon', { points: '50,34 36,62 64,62', fill: '#e85d4c' }),
      svg('ellipse', { cx: 50, cy: 78, rx: 30, ry: 8, fill: '#f2c14e', stroke: '#333', 'stroke-width': 2 }),
      svg('circle', { cx: 50, cy: 16, r: 7, fill: '#e85d4c' }));
  }

  K.shapeItem = function (mode) {
    if (mode === 'flat' || mode === 'flat-turn') {
      const want = FLAT[Math.floor(K.rng() * FLAT.length)];
      const turn = mode === 'flat-turn' ? [20, -25, 70, 160][Math.floor(K.rng() * 4)] : 0;
      const opts = K.shuffle(FLAT.map(name => ({ v: name, right: name === want })));
      return { id: 'flat-' + want, mode, want, turn, opts, text: 'Tap the same shape.', hint: 'Look at the sides. A circle is round. A triangle has three sides.',
        miss: 'Look again. Tap the same shape.', rightMsg: 'Yes! That is a ' + want + '.' };
    }
    if (mode === 'solid-rev') {
      const s = SOLIDS[Math.floor(K.rng() * SOLIDS.length)];
      const opts = K.shuffle(SOLIDS.map(x => ({ v: x.id, e: x.e, hat: x.id === 'cone', right: x.id === s.id, thing: x.thing })));
      return { id: 'rev-' + s.id, mode, solid: s.id, opts, text: 'Which real thing is this shape?', hint: 'A ball is round like a sphere. A can is a cylinder. A box is a cube. A party hat is a cone.',
        miss: 'Look again. Which real thing matches?', rightMsg: 'Yes! A ' + s.thing + ' is a ' + s.name + '.' };
    }
    const s = SOLIDS[Math.floor(K.rng() * SOLIDS.length)];
    const opts = K.shuffle(SOLIDS.map(x => ({ v: x.id, right: x.id === s.id })));
    return { id: 'solid-' + s.id, mode: 'solid', thing: s, opts, text: 'Tap the shape of the ' + s.thing + '.', hint: 'A ball is a sphere. A can is a cylinder. A box is a cube. A party hat is a cone.',
      miss: 'Look again. Tap the shape of the ' + s.thing + '.', rightMsg: 'Yes! A ' + s.thing + ' is a ' + s.name + '.' };
  };

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.shapes = {
    id: 'shapes', code: 10, title: 'Shapes', icon: '\uD83D\uDD3A', hintNoun: 'shape',
    intro: 'Shapes! Look, then tap the matching shape. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const lv = env.level || 1, out = [];
      for (let i = 0; i < 10; i++) {
        const mode = lv >= 3 ? (i % 2 === 0 ? 'flat-turn' : 'solid-rev') : lv >= 2 ? 'solid' : 'flat';
        out.push(K.shapeItem(mode));
      }
      return out;
    },
    redo(env, item) { return K.shapeItem(item.mode); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      let shown;
      if (item.mode === 'solid') shown = h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': item.thing.thing }, item.thing.e);
      else if (item.mode === 'solid-rev') shown = h('div', { class: 'k-shape-shown', 'aria-hidden': 'true' }, solidShape(item.solid, fill()));
      else shown = h('div', { class: 'k-shape-shown', 'aria-hidden': 'true' }, flatShape(item.want, fill(), item.turn));
      const btns = item.opts.map(o => {
        let face;
        if (item.mode === 'flat' || item.mode === 'flat-turn') face = flatShape(o.v, 'none');
        else if (item.mode === 'solid-rev') face = o.hat ? hat() : h('span', { class: 'k-lpic', 'aria-hidden': 'true' }, o.e);
        else face = solidShape(o.v, fill());
        if ((item.mode === 'flat' || item.mode === 'flat-turn') && face.querySelector) {
          const p = face.querySelector('circle, rect, polygon');
          if (p) { p.setAttribute('fill', '#fff'); p.setAttribute('stroke', '#24425f'); p.setAttribute('stroke-width', '6'); }
        }
        const b = h('button', { class: 'opt k-opt k-shapebtn', type: 'button', 'data-pick': o.v, 'data-right': o.right ? '1' : null, 'aria-label': item.mode === 'solid-rev' ? (o.thing || o.v) : 'a shape', onclick: async () => {
          if (answered || b.disabled) return;
          if (o.right) { answered = true; b.classList.add('right'); btns.forEach(x => { if (x !== b) x.disabled = true; }); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { mode: item.mode }, message: item.rightMsg }); }
          else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('shape ' + o.v, item.miss); }
        } }, face);
        return b;
      });
      return [shown, h('div', { class: 'k-shapebox k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Shapes', 'data-shape': item.mode }, btns)];
    }
  };
})();
