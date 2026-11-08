/* kinder/take.js - v16 take-away within 5, with pictures. Some pictures fly away. He counts what is left and taps the number.
   The question never says or shows how many are left. Tap-to-count may say each number as he taps.
   Level 1 starts from 2 or 3. Level 2 goes up to 5. Level 3 (harder top) sometimes leaves none. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  K.planTake = function (level) {
    const lv = level || 1, out = [];
    for (let i = 0; i < 10; i++) {
      let a, b;
      if (lv >= 3) { a = 2 + Math.floor(K.rng() * 4); b = K.rng() < 0.25 ? a : 1 + Math.floor(K.rng() * Math.max(1, a - 1)); }
      else if (lv >= 2) { a = 3 + Math.floor(K.rng() * 3); b = 1 + Math.floor(K.rng() * (a - 1)); }
      else { a = 2 + Math.floor(K.rng() * 2); b = 1; }
      out.push({ a, b, take: true, tier: 1 });
    }
    return out;
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.take = {
    id: 'take', code: 12, title: 'Take away', icon: '\uD83C\uDF88', hintNoun: 'number',
    intro: 'Take away! Watch some pictures fly away, then count what is left. Tap the green button to start.',
    load: async () => ({ adding: await K.loadAdding() }),
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { return K.planTake(env.level).map(f => K.addItem(env.adding, f)); },
    redo(env, item) { return K.addItem(env.adding, { a: item.a, b: item.b, take: true, tier: 1 }); },
    draw(item, ctl) {
      const c = K.tapCounter(item, ctl, item.words, [{ n: item.a, key: 'a', label: item.many }]);
      const ch = K.numberChoices(item, ctl, c, { a: item.a, b: item.b, take: true }, item.together);
      item._take = c;
      return [h('div', { class: 'k-groups k-take k-focus', tabindex: '-1', role: 'group', 'aria-label': item.many + '. Some will fly away.', 'data-take': '' }, c.boxes[0]),
        h('div', { class: 'k-countrow' }, c.out, c.again), ch.box];
    },
    afterDraw(item, root, ctl) {
      if (!item._take) return;
      const c = item._take, all = c.all();
      all.forEach(b => { b.disabled = true; });
      Promise.resolve(ctl.firstPrompt).then(() => {
        const away = K.shuffle(all).slice(0, item.b);
        c.remove(away);
        c.all().forEach(b => { b.disabled = false; });
        root.setAttribute('data-flew', String(item.b ? 1 : 0));
      });
    }
  };
})();
