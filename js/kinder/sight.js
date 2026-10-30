/* kinder/sight.js - Sight words (v12). The voice says a word ("look") and he taps it among 3 big word cards. Once 3 words are known, half of the
   questions become "find the missing word": a picture and a short sentence read aloud with a gap ("I ... at the dog"), and he taps the word that fits.
   Which words come up, and the wrong cards, are worked out in js/kinder/round2.js (planSight, sightItem). The words come from data/sight/. */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.sight = {
    id: 'sight', code: 3, title: 'Sight words', icon: '\uD83D\uDC40', hintNoun: 'word',
    intro: 'Sight words! I will say a word. Tap the word you hear. Tap the green button to start.',
    load: async () => ({ sight: await K.loadSight() }),
    rules: env => env.sight.rules,
    plan(env) {
      const p = K.planSight(env.sight, env.answers);
      return p.items.map(it => K.sightItem(env.sight, it.w, it.type));
    },
    /* a missed word comes back once, as another "find the word" question about the same word, with other wrong cards */
    redo(env, item) {
      return K.sightItem(env.sight, env.sight.words.find(x => x.word === item.word), 'hunt');
    },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const buttons = item.options.map((o, i) => h('button', { class: 'opt solo-opt k-opt k-wordcard', type: 'button', 'data-opt': i, 'data-word': o.word, 'aria-label': o.word,
        onclick: async () => {
          if (answered || buttons[i].disabled) return;
          if (o.right) {
            answered = true;
            buttons.forEach((b, bi) => { b.classList.toggle('right', bi === i); if (bi !== i) b.disabled = true; });
            ctl.say(item.right);
            await ctl.finish({ wrongs, extra: { type: item.type }, message: item.right });
          } else {
            wrongs++;
            buttons[i].disabled = true; buttons[i].classList.add('tried');
            ctl.miss(item.type + ' ' + o.word, item.miss);
          }
        } }, h('span', { class: 'k-word', 'aria-hidden': 'true' }, o.word)));
      const opts = h('div', { class: 'opts solo-opts kid-opts k-opts k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Words' }, buttons);
      if (item.type === 'gap') {
        return [h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': 'a picture for the sentence' }, h('span', { 'aria-hidden': 'true' }, item.pic)),
          h('p', { class: 'k-sentence', 'data-sentence': '', 'aria-label': item.blank.replace('___', 'blank') }, item.blank), opts];
      }
      return [opts];
    }
  };
})();
