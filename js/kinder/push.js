/* kinder/push.js - v16 push or pull. A picture of an action, then a big Push button and a big Pull button.
   Level 1 draws a small arrow so the direction is easy to see. Level 2 (harder top) has no arrow, and swings, tug-of-war and drawers come up more.
   Pictures are drawn here (SVG). The question does not say which one it is. */
(function () {
  const h = JU.ui.h, svg = JU.ui.svg, K = JU.kinder;
  const SCENES = [
    { id: 'door', answer: 'push', label: 'a door', tricky: false },
    { id: 'wagon', answer: 'pull', label: 'a wagon', tricky: false },
    { id: 'swing', answer: 'push', label: 'a swing', tricky: true },
    { id: 'tug', answer: 'pull', label: 'tug of war', tricky: true },
    { id: 'cart', answer: 'push', label: 'a cart', tricky: false },
    { id: 'drawer', answer: 'pull', label: 'a drawer', tricky: true }
  ];
  function person(x, y, arms) {
    return svg('g', { transform: 'translate(' + x + ' ' + y + ')', stroke: '#24425f', 'stroke-width': 5, fill: '#f6d7b0', 'stroke-linecap': 'round' },
      svg('circle', { cx: 0, cy: 0, r: 12, fill: '#f6d7b0' }),
      svg('line', { x1: 0, y1: 14, x2: 0, y2: 48 }),
      svg('line', { x1: -16, y1: 28, x2: 18, y2: 22 + (arms || 0) }),
      svg('line', { x1: 0, y1: 48, x2: -14, y2: 74 }),
      svg('line', { x1: 0, y1: 48, x2: 14, y2: 74 }));
  }
  function arrow(x1, y1, x2, y2) {
    const dir = x2 >= x1 ? 1 : -1, hx = x2 - dir * 16;
    return svg('g', { stroke: '#e85d4c', 'stroke-width': 7, fill: '#e85d4c', 'stroke-linecap': 'round' },
      svg('line', { x1: x1, y1: y1, x2: x2, y2: y2 }),
      svg('polygon', { points: x2 + ',' + y2 + ' ' + hx + ',' + (y2 - 10) + ' ' + hx + ',' + (y2 + 10) }));
  }
  function scene(id, withArrow) {
    const kids = [svg('rect', { x: 0, y: 0, width: 320, height: 180, rx: 18, fill: '#f4f8fc' })];
    if (id === 'door') {
      kids.push(svg('rect', { x: 180, y: 24, width: 90, height: 140, rx: 6, fill: '#c9864a', stroke: '#6b4423', 'stroke-width': 4 }));
      kids.push(svg('circle', { cx: 196, cy: 100, r: 6, fill: '#f6d36b' }));
      kids.push(person(90, 50, -6));
      if (withArrow) kids.push(arrow(120, 40, 168, 40));
    } else if (id === 'wagon') {
      kids.push(svg('rect', { x: 150, y: 78, width: 110, height: 46, rx: 8, fill: '#e85d4c' }));
      kids.push(svg('circle', { cx: 175, cy: 132, r: 14, fill: '#333' }), svg('circle', { cx: 240, cy: 132, r: 14, fill: '#333' }));
      kids.push(svg('line', { x1: 150, y1: 90, x2: 110, y2: 70, stroke: '#6b4423', 'stroke-width': 5 }));
      kids.push(person(70, 40, 8));
      if (withArrow) kids.push(arrow(150, 36, 100, 36));
    } else if (id === 'swing') {
      kids.push(svg('line', { x1: 40, y1: 16, x2: 280, y2: 16, stroke: '#6b4423', 'stroke-width': 8 }));
      kids.push(svg('line', { x1: 150, y1: 16, x2: 130, y2: 100, stroke: '#888', 'stroke-width': 3 }), svg('line', { x1: 190, y1: 16, x2: 200, y2: 100, stroke: '#888', 'stroke-width': 3 }));
      kids.push(svg('rect', { x: 120, y: 98, width: 86, height: 12, rx: 4, fill: '#3d8bfd' }));
      kids.push(person(70, 48, -8));
      if (withArrow) kids.push(arrow(100, 70, 140, 70));
    } else if (id === 'tug') {
      kids.push(svg('line', { x1: 90, y1: 90, x2: 230, y2: 90, stroke: '#c9864a', 'stroke-width': 8 }));
      kids.push(person(60, 40, 6));
      kids.push(svg('g', { transform: 'translate(320 0) scale(-1 1)' }, person(60, 40, 6)));
      if (withArrow) kids.push(arrow(200, 40, 150, 40));
    } else if (id === 'cart') {
      kids.push(svg('rect', { x: 150, y: 60, width: 100, height: 70, rx: 8, fill: '#7d8ea3' }));
      kids.push(svg('circle', { cx: 175, cy: 140, r: 12, fill: '#333' }), svg('circle', { cx: 230, cy: 140, r: 12, fill: '#333' }));
      kids.push(svg('line', { x1: 150, y1: 70, x2: 130, y2: 40, stroke: '#555', 'stroke-width': 5 }));
      kids.push(person(80, 48, -4));
      if (withArrow) kids.push(arrow(110, 36, 160, 36));
    } else {
      kids.push(svg('rect', { x: 170, y: 30, width: 110, height: 130, rx: 6, fill: '#d7e3f0', stroke: '#3a6e8f', 'stroke-width': 4 }));
      kids.push(svg('rect', { x: 150, y: 70, width: 90, height: 36, rx: 4, fill: '#f6d36b', stroke: '#333', 'stroke-width': 3 }));
      kids.push(svg('circle', { cx: 168, cy: 88, r: 5, fill: '#333' }));
      kids.push(person(80, 48, 10));
      if (withArrow) kids.push(arrow(160, 40, 110, 40));
    }
    return svg.apply(null, ['svg', { viewBox: '0 0 320 180', class: 'k-scene', 'aria-hidden': 'true' }].concat(kids));
  }
  K.pushItem = function (sceneId, withArrow) {
    const s = SCENES.find(x => x.id === sceneId) || SCENES[0];
    return { id: s.id, answer: s.answer, arrow: !!withArrow, text: 'Look at the picture. Is this a push or a pull?',
      hint: s.answer === 'push' ? 'Push means your hands move it away from you.' : 'Pull means your hands bring it toward you.',
      miss: 'Look again. Is this a push or a pull?', rightMsg: 'Yes! That is a ' + s.answer + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.push = {
    id: 'push', code: 11, title: 'Push or pull', icon: '\uD83D\uDEAA', hintNoun: 'answer',
    intro: 'Push or pull! Look at the picture, then tap Push or Pull. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const lv = env.level || 1, out = [];
      for (let i = 0; i < 10; i++) {
        let pool = SCENES;
        if (lv >= 2 && K.rng() < 0.7) pool = SCENES.filter(s => s.tricky);
        const s = pool[Math.floor(K.rng() * pool.length)];
        out.push(K.pushItem(s.id, lv < 2));
      }
      return out;
    },
    redo(env, item) { return K.pushItem(item.id, (env.level || 1) < 2); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const picks = [['push', 'Push'], ['pull', 'Pull']].map(([v, label]) => {
        const b = h('button', { class: 'opt k-opt k-pushbtn', type: 'button', 'data-pick': v, 'data-right': v === item.answer ? '1' : null, 'aria-label': label, onclick: async () => {
          if (answered || b.disabled) return;
          if (v === item.answer) { answered = true; b.classList.add('right'); picks.forEach(x => { if (x !== b) x.disabled = true; }); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { scene: item.id }, message: item.rightMsg }); }
          else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('push ' + v, item.miss); }
        } }, h('span', { 'aria-hidden': 'true' }, v === 'push' ? '\u27A1\uFE0F ' : '\u2B05\uFE0F '), label);
        return b;
      });
      return [h('div', { class: 'k-scene-wrap', 'data-scene': item.id, role: 'img', 'aria-label': 'a picture' }, scene(item.id, item.arrow)),
        h('div', { class: 'k-picks k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Push or pull' }, picks)];
    }
  };
})();
