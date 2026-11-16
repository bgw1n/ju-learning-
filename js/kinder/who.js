/* kinder/who.js - v18 "Who is the story about?" A short story is spoken over a picture scene.
   He taps the character (the person or animal the story is about), not the thing or the place.
   Level 1: one character. Level 2 (harder top): two characters, and the story says which one it is about.
   Stories use the browser voice. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const EASY = [
    { say: 'The cat sat on the mat.', who: ['\uD83D\uDC31', 'cat'], foils: [['\uD83E\uDDFA', 'mat'], ['\uD83C\uDFE0', 'house']] },
    { say: 'The dog ran in the park.', who: ['\uD83D\uDC36', 'dog'], foils: [['\u26BD', 'ball'], ['\uD83C\uDF33', 'tree']] },
    { say: 'A boy kicked the ball.', who: ['\uD83D\uDC66', 'boy'], foils: [['\u26BD', 'ball'], ['\uD83C\uDF33', 'park']] },
    { say: 'The bird sang in the tree.', who: ['\uD83D\uDC26', 'bird'], foils: [['\uD83E\uDEBA', 'nest'], ['\uD83C\uDF33', 'tree']] },
    { say: 'The pig played in the mud.', who: ['\uD83D\uDC37', 'pig'], foils: [['\uD83D\uDFEB', 'mud'], ['\uD83C\uDFE1', 'barn']] },
    { say: 'A girl read a book.', who: ['\uD83D\uDC67', 'girl'], foils: [['\uD83D\uDCD6', 'book'], ['\uD83C\uDFE0', 'house']] },
    { say: 'The fish swam in the water.', who: ['\uD83D\uDC1F', 'fish'], foils: [['\uD83D\uDCA7', 'water'], ['\u26F5', 'boat']] },
    { say: 'The bear ate some honey.', who: ['\uD83D\uDC3B', 'bear'], foils: [['\uD83C\uDF6F', 'honey'], ['\uD83C\uDF32', 'forest']] },
    { say: 'The frog jumped on a log.', who: ['\uD83D\uDC38', 'frog'], foils: [['\uD83E\uDEB5', 'log'], ['\uD83C\uDF0A', 'pond']] },
    { say: 'A king held a crown.', who: ['\uD83E\uDD34', 'king'], foils: [['\uD83D\uDC51', 'crown'], ['\uD83C\uDFF0', 'castle']] }
  ];
  const HARD = [
    { say: 'The fox saw the hen. The fox was hungry.', who: ['\uD83E\uDD8A', 'fox'], foils: [['\uD83D\uDC14', 'hen'], ['\uD83C\uDF3E', 'farm']] },
    { say: 'The duck followed the bug. The duck said hello.', who: ['\uD83E\uDD86', 'duck'], foils: [['\uD83D\uDC1B', 'bug'], ['\uD83C\uDFDE\uFE0F', 'pond']] },
    { say: 'A girl hugged the dog. The girl was happy.', who: ['\uD83D\uDC67', 'girl'], foils: [['\uD83D\uDC36', 'dog'], ['\uD83C\uDFE0', 'house']] },
    { say: 'The lion looked at the mouse. The lion was big.', who: ['\uD83E\uDD81', 'lion'], foils: [['\uD83D\uDC2D', 'mouse'], ['\uD83C\uDF33', 'tree']] },
    { say: 'The mom read to the baby. The mom smiled.', who: ['\uD83D\uDC69', 'mom'], foils: [['\uD83D\uDC76', 'baby'], ['\uD83D\uDCD6', 'book']] },
    { say: 'The horse saw the bird. The horse ran.', who: ['\uD83D\uDC34', 'horse'], foils: [['\uD83D\uDC26', 'bird'], ['\uD83C\uDFE1', 'barn']] },
    { say: 'A boy watched the cat. The boy laughed.', who: ['\uD83D\uDC66', 'boy'], foils: [['\uD83D\uDC31', 'cat'], ['\uD83C\uDFE0', 'house']] },
    { say: 'The owl saw the mouse. The owl hooted.', who: ['\uD83E\uDD89', 'owl'], foils: [['\uD83D\uDC2D', 'mouse'], ['\uD83C\uDF19', 'moon']] }
  ];
  K.whoItem = function (hard) {
    const bank = hard ? HARD : EASY;
    const s = bank[Math.floor(K.rng() * bank.length)];
    const opts = K.shuffle([{ e: s.who[0], name: s.who[1], right: true, kind: 'character' }].concat(s.foils.map((f, i) => ({ e: f[0], name: f[1], right: false, kind: i === 0 && hard ? 'character' : 'other' }))));
    const ask = s.say + ' Who is this story about? Tap the character.';
    return { id: s.who[1] + (hard ? '-hard' : ''), hard: !!hard, say: s.say, opts,
      text: ask, hint: 'The character is the person or the animal the story is about. A place or a thing is not the character.',
      miss: 'Listen again. ' + s.say + ' Tap the one the story is about.',
      rightMsg: 'Yes! The story is about the ' + s.who[1] + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.who = {
    id: 'who', code: 14, title: 'Who is it?', icon: '\uD83D\uDC3B', hintNoun: 'character',
    intro: 'Who is it? I will tell a little story. Tap the person or animal the story is about. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { const hard = (env.level || 1) >= 2; const out = []; for (let i = 0; i < 10; i++) out.push(K.whoItem(hard)); return out; },
    redo(env, item) { return K.whoItem(!!item.hard); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const btns = item.opts.map(o => {
        const b = h('button', { class: 'opt k-opt k-who', type: 'button', 'data-pick': o.name, 'data-right': o.right ? '1' : null, 'aria-label': o.name,
          onclick: async () => {
            if (answered || b.disabled) return;
            if (o.right) { answered = true; btns.forEach(x => { x.disabled = true; }); b.classList.add('right'); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { who: o.name }, message: item.rightMsg }); }
            else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('who ' + o.name, item.miss); }
          } }, h('span', { class: 'k-lpic', 'aria-hidden': 'true' }, o.e));
        return b;
      });
      return [h('div', { class: 'k-scene-row k-focus', tabindex: '-1', role: 'group', 'aria-label': 'The picture for the story', 'data-who': item.hard ? 'hard' : 'easy', 'data-top': item.hard ? '1' : null }, btns)];
    }
  };
})();
