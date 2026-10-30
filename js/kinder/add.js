/* kinder/add.js - Add it up (v12): adding within 5, with pictures and the voice. Two groups of pictures, "two and one more. How many in all?"
   He can tap the pictures to count them (the voice counts out loud), then taps the number. The screen shows the word "and" between the groups
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
      let answered = false, wrongs = 0, counted = 0;
      const out = h('div', { class: 'count-out k-count-out', 'aria-live': 'polite', 'data-count-out': '' }, '0');
      const group = (n, which) => {
        if (n === 0) return h('div', { class: 'k-group k-none', 'data-group': which, role: 'img', 'aria-label': 'none' });
        const btns = [];
        for (let i = 0; i < n; i++) {
          const b = h('button', { class: 'k-obj', type: 'button', 'data-obj': which + i, 'aria-label': item.one + ' (' + which + ')', onclick: () => {
            if (b.classList.contains('counted')) return;
            b.classList.add('counted'); b.setAttribute('aria-pressed', 'true'); counted++;
            out.textContent = String(counted);
            ctl.say(K.num(counted, item.words));
          } }, h('span', { 'aria-hidden': 'true' }, item.e));
          btns.push(b);
        }
        return h('div', { class: 'k-group', 'data-group': which, role: 'group', 'aria-label': n + ' ' + (n === 1 ? item.one : item.many) }, btns);
      };
      const buttons = item.options.map((o, i) => h('button', { class: 'opt solo-opt k-opt k-numopt', type: 'button', 'data-opt': i, 'data-n': o.n, 'aria-label': String(o.n),
        onclick: async () => {
          if (answered || buttons[i].disabled) return;
          if (o.right) {
            answered = true;
            buttons.forEach((b, bi) => { b.classList.toggle('right', bi === i); if (bi !== i) b.disabled = true; });
            ctl.say(item.right);
            await ctl.finish({ wrongs, extra: { a: item.a, b: item.b }, message: item.right });
          } else {
            wrongs++;
            buttons[i].disabled = true; buttons[i].classList.add('tried');
            ctl.miss(item.id + ' ' + o.n, item.miss);
          }
        } }, h('span', { class: 'k-num', 'aria-hidden': 'true' }, String(o.n))));
      return [
        h('div', { class: 'k-groups k-focus', tabindex: '-1', role: 'group', 'aria-label': item.b === 0 ? item.a + ' ' + item.many + ' and none more' : item.a + ' ' + item.many + ' and ' + item.b + ' more' },
          group(item.a, 'a'), h('span', { class: 'k-and', 'aria-hidden': 'true', 'data-and': '' }, item.signs ? '+' : 'and'), group(item.b, 'b')),
        out,
        h('div', { class: 'opts solo-opts kid-opts k-opts k-numopts', role: 'group', 'aria-label': 'Numbers' }, buttons)];
    }
  };
})();
