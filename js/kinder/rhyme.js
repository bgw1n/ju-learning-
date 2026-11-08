/* kinder/rhyme.js - v16 rhyme round. He hears a word and taps the picture that rhymes with it.
   Level 1: 3 pictures, an easy CVC rhyme. Level 2 (harder top): 4 pictures, and a wrong picture may start with the same sound.
   The spoken word uses a parent recording, then a Piper clip, then the browser voice. The sentence around it is the browser voice. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const WORDS = [
    { w: 'cat', e: '\uD83D\uDC31', fam: 'at' }, { w: 'hat', e: '\uD83C\uDFA9', fam: 'at' }, { w: 'bat', e: '\uD83E\uDD87', fam: 'at' }, { w: 'mat', e: '\uD83E\uDDD8', fam: 'at' }, { w: 'rat', e: '\uD83D\uDC00', fam: 'at' },
    { w: 'dog', e: '\uD83D\uDC36', fam: 'og' }, { w: 'log', e: '\uD83E\uDEB5', fam: 'og' }, { w: 'fog', e: '\uD83C\uDF2B\uFE0F', fam: 'og' },
    { w: 'can', e: '\uD83E\uDD6B', fam: 'an' }, { w: 'man', e: '\uD83D\uDC68', fam: 'an' }, { w: 'pan', e: '\uD83C\uDF73', fam: 'an' },
    { w: 'pot', e: '\uD83C\uDF72', fam: 'ot' }, { w: 'cot', e: '\uD83D\uDECC', fam: 'ot' }, { w: 'dot', e: '\u26AB', fam: 'ot' }, { w: 'hot', e: '\uD83D\uDD25', fam: 'ot' },
    { w: 'mop', e: '\uD83E\uDDF9', fam: 'op' }, { w: 'cop', e: '\uD83D\uDC6E', fam: 'op' }, { w: 'hop', e: '\uD83D\uDC30', fam: 'op' }, { w: 'top', e: '\uD83E\uDE80', fam: 'op' },
    { w: 'bed', e: '\uD83D\uDECF\uFE0F', fam: 'ed' }, { w: 'red', e: '\uD83D\uDD34', fam: 'ed' },
    { w: 'bug', e: '\uD83D\uDC1B', fam: 'ug' }, { w: 'mug', e: '\u2615', fam: 'ug' }, { w: 'rug', e: '\uD83D\uDFE3', fam: 'ug' },
    { w: 'fox', e: '\uD83E\uDD8A', fam: 'ox' }, { w: 'box', e: '\uD83D\uDCE6', fam: 'ox' },
    { w: 'pig', e: '\uD83D\uDC37', fam: 'ig' }, { w: 'wig', e: '\uD83D\uDC87', fam: 'ig' },
    { w: 'sun', e: '\u2600\uFE0F', fam: 'un' }, { w: 'run', e: '\uD83C\uDFC3', fam: 'un' }, { w: 'bun', e: '\uD83C\uDF5E', fam: 'un' },
    { w: 'cap', e: '\uD83E\uDDE2', fam: 'ap' }, { w: 'map', e: '\uD83D\uDDFA\uFE0F', fam: 'ap' }, { w: 'tap', e: '\uD83D\uDEB0', fam: 'ap' },
    { w: 'pin', e: '\uD83D\uDCCC', fam: 'in' }, { w: 'fin', e: '\uD83D\uDC1F', fam: 'in' }, { w: 'bin', e: '\uD83D\uDDD1\uFE0F', fam: 'in' }
  ];
  const W = w => '{{w:' + w + '|' + w + '}}';
  K.rhymeItem = function (hard) {
    const fams = {};
    WORDS.forEach(w => { (fams[w.fam] = fams[w.fam] || []).push(w); });
    const keys = Object.keys(fams).filter(k => fams[k].length >= 2);
    const fam = fams[keys[Math.floor(K.rng() * keys.length)]];
    const pair = K.shuffle(fam);
    const target = pair[0], answer = pair[1];
    const n = hard ? 4 : 3;
    const others = WORDS.filter(w => w.fam !== target.fam);
    const foils = [];
    if (hard) {
      const same = others.filter(w => w.w.charAt(0) === target.w.charAt(0) || w.w.charAt(0) === answer.w.charAt(0));
      if (same.length) foils.push(same[Math.floor(K.rng() * same.length)]);
    }
    let guard = 0;
    while (foils.length < n - 1 && guard++ < 40) {
      const w = others[Math.floor(K.rng() * others.length)];
      if (!foils.some(f => f.w === w.w)) foils.push(w);
    }
    const opts = K.shuffle([Object.assign({ right: true }, answer)].concat(foils.map(f => Object.assign({ right: false }, f))));
    return { id: target.w + '-' + answer.w, opts, text: 'Which picture rhymes with ' + W(target.w) + '?',
      hint: 'Listen to the ending. ' + W(answer.w) + ' rhymes with ' + W(target.w) + '.',
      miss: 'Listen again. Which picture rhymes with ' + W(target.w) + '?',
      rightMsg: 'Yes! ' + W(answer.w) + ' rhymes with ' + W(target.w) + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.rhyme = {
    id: 'rhyme', code: 9, title: 'Rhyme', icon: '\uD83C\uDFB5', hintNoun: 'picture',
    intro: 'Rhyme time! I will say a word. Tap the picture that rhymes with it. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { const hard = (env.level || 1) >= 2; const out = []; for (let i = 0; i < 10; i++) out.push(K.rhymeItem(hard)); return out; },
    redo(env, item) { return K.rhymeItem((env.level || 1) >= 2); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const btns = item.opts.map(o => {
        const b = h('button', { class: 'opt k-opt k-rhyme', type: 'button', 'data-pick': o.w, 'data-right': o.right ? '1' : null, 'aria-label': o.w, onclick: async () => {
          if (answered || b.disabled) return;
          if (o.right) { answered = true; b.classList.add('right'); btns.forEach(x => { if (x !== b) x.disabled = true; }); ctl.say(item.rightMsg); await ctl.finish({ wrongs, message: item.rightMsg }); }
          else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('rhyme ' + o.w, item.miss); }
        } }, h('span', { class: 'k-lpic', 'aria-hidden': 'true' }, o.e));
        return b;
      });
      return [h('div', { class: 'k-looks k-rhymes k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Pictures' }, btns)];
    }
  };
})();
