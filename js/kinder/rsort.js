/* kinder/rsort.js - v18 rhyme sort. He hears a word and taps the picture family it rhymes with: -ug or -un.
   Level 1: bug, hug, rug, mug, tug against sun, run, bun, fun. The bins show other pictures from that family, not the same picture.
   Level 2 (harder top): a word may start like the other family (bug and bun). gum is not an -ug word, so it is not here.
   The word uses a parent recording, then a Piper clip, then the browser voice. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const WORDS = [
    { w: 'bug', e: '\uD83D\uDC1B', fam: 'ug' }, { w: 'hug', e: '\uD83E\uDD17', fam: 'ug' }, { w: 'rug', e: '\uD83D\uDFE3', fam: 'ug' },
    { w: 'mug', e: '\u2615', fam: 'ug' }, { w: 'tug', e: '\uD83E\uDEA2', fam: 'ug' },
    { w: 'sun', e: '\u2600\uFE0F', fam: 'un' }, { w: 'run', e: '\uD83C\uDFC3', fam: 'un' }, { w: 'bun', e: '\uD83C\uDF5E', fam: 'un' }, { w: 'fun', e: '\uD83D\uDE04', fam: 'un' }
  ];
  const W = w => '{{w:' + w + '|' + w + '}}';
  const SAME = { bug: 'bun', bun: 'bug', rug: 'run', run: 'rug' };
  function pics(fam, except) { return WORDS.filter(x => x.fam === fam && x.w !== except).slice(0, 2); }
  K.rsortItem = function (hard) {
    const pool = hard ? WORDS.filter(x => SAME[x.w] || x.w === 'fun' || x.w === 'hug' || x.w === 'mug' || x.w === 'tug' || x.w === 'sun') : WORDS;
    const target = pool[Math.floor(K.rng() * pool.length)];
    const bins = ['ug', 'un'].map(fam => ({ fam, right: fam === target.fam, pics: pics(fam, target.w) }));
    return { id: target.w, w: target.w, e: target.e, fam: target.fam, hard: !!hard, bins: K.shuffle(bins),
      text: 'Where does this word go? ' + W(target.w) + '. Tap the pictures it rhymes with.',
      hint: 'Listen to the end of the word. Bug, hug, and rug end the same. Sun, run, and bun end the same.',
      miss: 'Listen again. ' + W(target.w) + '. Tap the family it rhymes with.',
      rightMsg: 'Yes! ' + W(target.w) + ' goes with the ' + (target.fam === 'ug' ? 'bug' : 'sun') + ' pictures.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.rsort = {
    id: 'rsort', code: 13, title: 'Rhyme sort', icon: '\uD83E\uDD8B', hintNoun: 'family',
    intro: 'Rhyme sort! I will say a word. Tap the pictures that rhyme with it. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { const hard = (env.level || 1) >= 2; const out = []; for (let i = 0; i < 10; i++) out.push(K.rsortItem(hard)); return out; },
    redo(env, item) { return K.rsortItem(!!item.hard); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const bins = item.bins.map(fam => {
        const b = h('button', { class: 'opt k-opt k-bin', type: 'button', 'data-pick': fam.fam, 'data-right': fam.right ? '1' : null, 'aria-label': fam.fam === 'ug' ? 'the bug family' : 'the sun family',
          onclick: async () => {
            if (answered || b.disabled) return;
            if (fam.right) { answered = true; bins.forEach(x => { x.disabled = true; }); b.classList.add('right'); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { fam: item.fam }, message: item.rightMsg }); }
            else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('rsort ' + fam.fam, item.miss); }
          } }, h('span', { class: 'k-binpics', 'aria-hidden': 'true' }, fam.pics.map(p => p.e).join(' ')));
        return b;
      });
      return [
        h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': item.w, 'data-rsort': item.w, 'data-top': item.hard ? '1' : null }, item.e),
        h('div', { class: 'k-bins k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Two rhyme families', 'data-rhyme-sort': item.hard ? 'hard' : 'easy' }, bins)];
    }
  };
})();
