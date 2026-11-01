/* kinder/build.js - Build a word. He hears the word and sees its picture, then taps the sounds in order from a tray of letter tiles into three boxes.
   Each tile plays its recorded sound when tapped; the whole word (a recorded clip) is played when the last box is filled. Which words are open is worked out in js/kinder.js (planWords, wordItem). */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.build = {
    id: 'build', code: 2, title: 'Build a word', icon: '\uD83E\uDDF1',
    intro: 'Build a word! I will say a word. Tap the sounds in order to build it. Tap the green button to start.',
    plan(env) {
      const p = K.planWords(env.cvc, env.answers, env.level);
      env.tier = p.tier;
      const items = p.words.map(w => K.wordItem(env.cvc, env.letters, w, env.answers));
      /* v15: each round ends with one short "one or many?" picture question (dog / dogs), saved under Look and tap */
      if (env.cvc.rules.pluralRound && window.__JU_BUILD_PLURAL !== false && K.lookItem) items.push(Object.assign(K.lookItem('plural'), { activity: 'look', other: 'look' }));
      return items;
    },
    /* a missed word comes back once with a fresh tray */
    redo(env, item) { if (item.other) return Object.assign(K.lookItem('plural'), { activity: 'look', other: 'look' }); return K.wordItem(env.cvc, env.letters, env.cvc.words.find(w => w.word === item.word), env.answers); },
    draw(item, ctl) {
      if (item.other) return JU.kinderGames[item.other].draw(item, ctl);
      let next = 0, answered = false, wrongs = 0;
      const per = item.need.map(() => 0);
      const slots = item.need.map((l, i) => h('span', { class: 'k-slot', 'data-slot': i, 'aria-label': 'box ' + (i + 1) + ' of ' + item.need.length }));
      const tiles = item.tiles.map(l => {
        const b = h('button', { class: 'k-tile', type: 'button', 'data-tile': l, 'aria-label': 'letter ' + l,
          onclick: async () => {
            if (answered || b.disabled) return;
            if (l === item.need[next]) {
              slots[next].textContent = l; slots[next].classList.add('filled');
              b.disabled = true; b.classList.add('placed'); b.setAttribute('aria-hidden', 'true');
              tiles.forEach(t => t.classList.remove('nope'));
              const sound = item.sounds[next];
              next++;
              if (next === item.need.length) {
                answered = true;
                ctl.say(item.done);
                await ctl.finish({ wrongs, extra: { letters: item.need.map((x, i) => ({ l: x, wrong: per[i] })) }, message: item.done });
              } else ctl.say(sound);
            } else {
              wrongs++; per[next]++;
              b.classList.add('nope');
              ctl.miss(next + ':' + l, 'Let\u2019s try again. ' + item.wrd + '.');
            }
          } }, l);
        return b;
      });
      return [
        h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': item.word }, h('span', { 'aria-hidden': 'true' }, item.e)),
        h('div', { class: 'k-slots', role: 'group', 'aria-label': 'Boxes for the word' }, slots),
        h('div', { class: 'k-tray k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Letter tiles' }, tiles)];
    }
  };
})();
