/* kinder/add.js - Add it up (v12; v14: within 10, with + and = signs, then "how many are left").
   Two groups of pictures with a + between them and "= ?" after them: "Count the apples. How many in all?" No numbers are said or shown before he answers.
   He taps each picture (the voice says the running count, each tapped picture gets a check mark), then taps the number. The voice says "plus" and "equals".
   v14 take-away: he sees one group, some pictures fly away (no minus sign), and he counts the ones that are left.
   Which facts come up is worked out in js/kinder/round2.js (planAdd, addItem). */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.add = {
    id: 'add', code: 5, title: 'Add it up', icon: '\uD83E\uDDEE', hintNoun: 'number',
    intro: 'Add it up! We will put groups together and count them. Tap the green button to start.',
    load: async () => ({ adding: await K.loadAdding() }),
    rules: env => env.adding.rules,
    plan(env) { return K.planAdd(env.adding, env.answers, env.level).facts.map(f => K.addItem(env.adding, f)); },
    /* a missed fact comes back with other pictures and other choices */
    redo(env, item) { return K.addItem(env.adding, env.adding.facts.find(f => K.factId(f) === item.id)); },
    draw(item, ctl) {
      if (item.take) {
        const c = K.tapCounter(item, ctl, item.words, [{ n: item.a, key: 'a', label: item.many }]);
        const ch = K.numberChoices(item, ctl, c, { a: item.a, b: item.b, take: true }, item.together);
        item._take = c;
        return [h('div', { class: 'k-groups k-take k-focus', tabindex: '-1', role: 'group', 'aria-label': item.many + '. Some will fly away.', 'data-take': '' }, c.boxes[0]),
          h('div', { class: 'k-countrow' }, c.out, c.again), ch.box];
      }
      const c = K.tapCounter(item, ctl, item.words, [{ n: item.a, key: 'a', label: item.many + ', first group' }, { n: item.b, key: 'b', label: item.many + ', second group' }]);
      const ch = K.numberChoices(item, ctl, c, { a: item.a, b: item.b }, item.together);
      return [
        h('div', { class: 'k-groups k-focus', tabindex: '-1', role: 'group', 'aria-label': item.many + ' in groups' },
          c.boxes[0], h('span', { class: 'k-and k-sign', 'aria-hidden': 'true', 'data-and': '' }, item.signs ? '+' : 'and'), c.boxes[1],
          item.signs ? h('span', { class: 'k-eqq', 'aria-hidden': 'true' }, h('span', { class: 'k-sign k-eq', 'data-eq': '' }, '='), h('span', { class: 'k-sign k-q', 'data-q': '' }, '?')) : null),
        h('div', { class: 'k-countrow' }, c.out, c.again), ch.box];
    },
    /* take-away: after a short look, the last b pictures fly away. Until then he cannot count (the pictures wait). */
    afterDraw(item, root, ctl) {
      if (!item.take || !item._take) return;
      const c = item._take, all = c.all();
      all.forEach(b => { b.disabled = true; });
      /* they fly away once the voice has said "Watch! Some ... fly away" (no clock: it follows the voice) */
      Promise.resolve(ctl.firstPrompt).then(() => {
        const away = K.shuffle(all).slice(0, item.b);
        c.remove(away);
        c.all().forEach(b => { b.disabled = false; });
        root.setAttribute('data-flew', String(item.b ? 1 : 0));
      });
    }
  };
})();
