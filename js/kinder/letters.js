/* kinder/letters.js - Letter sounds. A recorded sound (for example "mmm", from audio/kinder/) plays and he taps the one of three pictures that starts with it.
   Which letters are in play, and which come back more often, is worked out in js/kinder.js (planLetters, letterItem). */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.letters = {
    id: 'letters', code: 1, title: 'Letter sounds', icon: '\uD83D\uDD24',
    intro: 'Letter sounds! I will say a sound. Tap the picture that starts with it. Tap the green button to start.',
    plan(env) {
      const p = K.planLetters(env.letters, env.answers);
      env.active = p.active;
      return p.letters.map(l => withSound(K.letterItem(env.letters, l, p.active), env));
    },
    /* a missed letter comes back with another picture and other choices */
    redo(env, item) { return withSound(K.letterItem(env.letters, item.letter, env.active), env); },
    draw(item, ctl) {
      let answered = false, wrongs = [];
      const buttons = item.options.map((o, i) => h('button', { class: 'opt solo-opt k-opt', type: 'button', 'data-opt': i, 'data-word': o.pic.word, 'aria-label': o.pic.word,
        onclick: async () => {
          if (answered || buttons[i].disabled) return;
          if (o.right) {
            answered = true;
            buttons.forEach((b, bi) => { b.classList.toggle('right', bi === i); if (bi !== i) b.disabled = true; });
            ctl.say(item.right);
            await ctl.finish({ wrongs: wrongs.length, extra: { wrong: wrongs }, message: item.right });
          } else {
            wrongs.push(o.letter);
            buttons[i].disabled = true; buttons[i].classList.add('tried');
            ctl.miss(o.pic.word + ' ' + o.letter, 'Listen again. ' + item.snd + '.');
          }
        } }, h('span', { class: 'opt-e', 'aria-hidden': 'true' }, o.pic.e)));
      return [h('div', { class: 'opts solo-opts kid-opts k-opts k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Pictures' }, buttons)];
    }
  };
  function withSound(item, env) { item.sound = item.snd; return item; }      // the sound button plays just the recorded sound (js/kinder.js snd)
})();
