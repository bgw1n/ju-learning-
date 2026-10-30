/* kinder/add.js - Add it up (v12): adding within 5, with pictures and the voice. Two groups of pictures, "Count the apples. How many in all?"
   v13.3: no numbers are said first. He taps each picture (the voice says the running count), then taps the number. The screen shows the word "and" between the groups
   (no plus or equals signs unless data/kinder/adding.json has showSigns true); the voice says "makes". Which facts come up is worked out in js/kinder/round2.js. */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.add = {
    id: 'add', code: 5, title: 'Add it up', icon: '\uD83E\uDDEE', hintNoun: 'number',
    intro: 'Add it up! We will put groups together and count them. Tap the green button to start.',
    load: async () => ({ adding: await K.loadAdding() }),
    rules: env => env.adding.rules,
    plan(env) { return K.planAdd(env.adding, env.answers).facts.map(f => K.addItem(env.adding, f)); },
    /* a missed fact comes back with other pictures and other choices */
    redo(env, item) { return K.addItem(env.adding, env.adding.facts.find(f => K.factId(f) === item.id)); },
    draw(item, ctl) {
      const c = K.tapCounter(item, ctl, item.words, [{ n: item.a, key: 'a', label: item.many + ', first group' }, { n: item.b, key: 'b', label: item.many + ', second group' }]);
      const ch = K.numberChoices(item, ctl, c, { a: item.a, b: item.b }, item.together);
      return [
        h('div', { class: 'k-groups k-focus', tabindex: '-1', role: 'group', 'aria-label': item.many + ' in groups' },
          c.boxes[0], h('span', { class: 'k-and', 'aria-hidden': 'true', 'data-and': '' }, item.signs ? '+' : 'and'), c.boxes[1]),
        h('div', { class: 'k-countrow' }, c.out, c.again), ch.box];
    }
  };
})();
