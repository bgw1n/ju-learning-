/* kinder/sight.js - Sight words (v12). The voice says a word ("look") and he taps it among 3 big word cards. Once 3 words are known, half of the
   questions become "find the missing word": a picture and a short sentence read aloud with a gap ("I ... at the dog"), and he taps the word that fits.
   Which words come up, and the wrong cards, are worked out in js/kinder/round2.js (planSight, sightItem). The words come from data/sight/. */
(function () {
  const h = JU.ui.h, K = JU.kinder;

  /* v14 "Find it twice": the picture and the sentence as big word tiles. He taps the word every time it shows; a found one gets a check mark.
     A tap on another word is a gentle "Listen again" (and counts as a miss); the item is done when every one is found. */
  function drawTwice(item, ctl) {
    let found = 0, wrongs = 0, done = false;
    const tiles = item.tiles.map(t => {
      const b = h('button', { class: 'k-wtile' + (t.right ? '' : ''), type: 'button', 'data-word-tile': t.bare, 'data-tile': t.i, 'aria-label': t.bare === 'i' ? 'I' : t.bare, 'aria-pressed': 'false',
        onclick: async () => {
          if (done || b.classList.contains('found') || b.disabled) return;
          if (t.right) {
            found++; b.classList.add('found'); b.setAttribute('aria-pressed', 'true'); b.querySelector('.k-wcheck').textContent = '\u2713';
            if (found >= item.need) { done = true; ctl.say(item.right); await ctl.finish({ wrongs, extra: { type: 'twice' }, message: item.right }); }
            else ctl.say(item.more);
          } else {
            wrongs++; b.classList.add('tried'); b.disabled = true;
            ctl.miss('twice ' + t.bare, item.miss);
          }
        } }, h('span', { 'aria-hidden': 'true' }, t.shown), h('span', { class: 'k-wcheck', 'aria-hidden': 'true' }, ''));
      return b;
    });
    return [h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': 'a picture for the sentence' }, h('span', { 'aria-hidden': 'true' }, item.pic)),
      h('div', { class: 'k-twice k-focus', tabindex: '-1', role: 'group', 'aria-label': 'The sentence', 'data-twice': item.word }, tiles)];
  }

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.sight = {
    id: 'sight', code: 3, title: 'Sight words', icon: '\uD83D\uDC40', hintNoun: 'word',
    intro: 'Sight words! I will say a word. Look closely, some words look alike! Tap the word you hear. Tap the green button to start.',
    load: async () => ({ sight: await K.loadSight() }),
    rules: env => env.sight.rules,
    plan(env) {
      const p = K.planSight(env.sight, env.answers, env.level);
      return p.items.map(it => it.type === 'twice' ? K.twiceItem(env.sight, it.twice) : K.sightItem(env.sight, it.w, it.type));
    },
    /* a missed word comes back once, as another "find the word" question about the same word, with other wrong cards */
    redo(env, item) {
      return K.sightItem(env.sight, env.sight.words.find(x => x.word === item.word), 'hunt');
    },
    draw(item, ctl) {
      if (item.type === 'twice') return drawTwice(item, ctl);
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
      const opts = h('div', { class: 'opts solo-opts kid-opts k-opts k-focus' + (item.options.length >= 4 ? ' k-opts4' : ''), tabindex: '-1', role: 'group', 'aria-label': 'Words' }, buttons);
      if (item.type === 'gap') {
        return [h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': 'a picture for the sentence' }, h('span', { 'aria-hidden': 'true' }, item.pic)),
          h('p', { class: 'k-sentence', 'data-sentence': '', 'aria-label': item.blank.replace('___', 'blank') }, item.blank), opts];
      }
      return [opts];
    }
  };
})();
