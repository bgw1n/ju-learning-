/* kinder/build.js - Build a word. He hears the word and sees its picture, then taps the sounds in order from a tray of letter tiles into three boxes.
   Each tile plays its recorded sound when tapped; the whole word (a recorded clip) is played when the last box is filled.
   v16: level 5 adds cot, cop, fog, fox and an easy word-family switch (dog -> log -> fog, change the first letter).
   Level 6 is the harder top: more families, sometimes the last letter, and 4 letter choices.
   Which words are open is worked out in js/kinder.js (planWords, wordItem). */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const EASY = [
    { from: 'dog', to: 'log', e: '\uD83D\uDC36', toE: '\uD83E\uDEB5', pos: 0 },
    { from: 'log', to: 'fog', e: '\uD83E\uDEB5', toE: '\uD83C\uDF2B\uFE0F', pos: 0 },
    { from: 'dog', to: 'fog', e: '\uD83D\uDC36', toE: '\uD83C\uDF2B\uFE0F', pos: 0 }
  ];
  const HARD = EASY.concat([
    { from: 'cat', to: 'hat', e: '\uD83D\uDC31', toE: '\uD83C\uDFA9', pos: 0 },
    { from: 'hat', to: 'bat', e: '\uD83C\uDFA9', toE: '\uD83E\uDD87', pos: 0 },
    { from: 'pot', to: 'cot', e: '\uD83C\uDF72', toE: '\uD83D\uDECC', pos: 0 },
    { from: 'cot', to: 'dot', e: '\uD83D\uDECC', toE: '\u26AB', pos: 0 },
    { from: 'cop', to: 'mop', e: '\uD83D\uDC6E', toE: '\uD83E\uDDF9', pos: 0 },
    { from: 'cat', to: 'can', e: '\uD83D\uDC31', toE: '\uD83E\uDD6B', pos: 2 },
    { from: 'can', to: 'cap', e: '\uD83E\uDD6B', toE: '\uD83E\uDDE2', pos: 2 },
    { from: 'dog', to: 'dot', e: '\uD83D\uDC36', toE: '\u26AB', pos: 2 }
  ]);
  K.switchItem = function (step, nChoices, letters) {
    const from = step.from, to = step.to, pos = step.pos, right = to.charAt(pos);
    const pool = 'bcdfghlmnprst'.split('').filter(l => l !== right && l !== from.charAt(pos) && letters.letters[l]);
    const tiles = K.shuffle([right].concat(K.shuffle(pool).slice(0, Math.max(0, (nChoices || 3) - 1))));
    const place = pos === 0 ? 'first' : 'last';
    const W = w => '{{w:' + w + '|' + w + '}}';
    const say = letters.letters[right] ? letters.letters[right].say : right;
    return { kind: 'switch', id: from + '-' + to, from, to, e: step.e, toE: step.toE, pos, tiles, rightLetter: right, tier: 5,
      text: 'This says ' + W(from) + '. Change the ' + place + ' sound to make ' + W(to) + '.',
      hint: W(to) + '. The ' + place + ' sound is ' + K.snd(right, say) + '.',
      miss: 'Let\u2019s try again. Change the ' + place + ' sound to make ' + W(to) + '.',
      done: W(to) + '! You made ' + W(to) + '!' };
  };

  function drawSwitch(item, ctl) {
    let answered = false, wrongs = 0;
    const pic = h('span', { 'aria-hidden': 'true' }, item.e);
    const slots = item.from.split('').map((l, i) => h('span', { class: 'k-slot filled' + (i === item.pos ? ' k-change' : ''), 'data-slot': i, 'aria-label': i === item.pos ? 'the letter to change' : 'letter ' + l }, l));
    const tiles = item.tiles.map(l => {
      const b = h('button', { class: 'k-tile', type: 'button', 'data-tile': l, 'data-right': l === item.rightLetter ? '1' : null, 'aria-label': 'letter ' + l,
        onclick: async () => {
          if (answered || b.disabled) return;
          if (l === item.rightLetter) {
            answered = true;
            slots[item.pos].textContent = l;
            pic.textContent = item.toE;
            tiles.forEach(t => { if (t !== b) t.disabled = true; });
            b.disabled = true;
            ctl.say(item.done);
            await ctl.finish({ wrongs, extra: { kind: 'switch', from: item.from, to: item.to }, message: item.done });
          } else {
            wrongs++;
            b.classList.add('nope');
            ctl.miss(item.from + '-' + l, item.miss);
          }
        } }, l);
      return b;
    });
    return [
      h('div', { class: 'k-bigpic k-wordpic', role: 'img', 'aria-label': item.from, 'data-switch': item.id }, pic),
      h('div', { class: 'k-slots', role: 'group', 'aria-label': 'The word, with one letter to change' }, slots),
      h('div', { class: 'k-tray k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Letters' }, tiles)];
  }

  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.build = {
    id: 'build', code: 2, title: 'Build a word', icon: '\uD83E\uDDF1',
    intro: 'Build a word! I will say a word. Tap the sounds in order to build it. Tap the green button to start.',
    plan(env) {
      const p = K.planWords(env.cvc, env.answers, env.level);
      env.tier = p.tier;
      let built = p.words.map(w => K.wordItem(env.cvc, env.letters, w, env.answers));
      const level = env.level || 1;
      if (p.tier >= 5) {
        const tierWords = env.cvc.words.filter(w => w.tier === p.tier);
        const have = {};
        built.forEach(it => { if (it.tier === p.tier) have[it.word] = true; });
        for (let i = 0; i < built.length && Object.keys(have).length < Math.min(4, tierWords.length); i++) {
          if (built[i].tier === p.tier) continue;
          const w = tierWords.find(x => !have[x.word]);
          if (!w) break;
          built[i] = K.wordItem(env.cvc, env.letters, w, env.answers);
          have[w.word] = true;
        }
        built.sort((a, b) => (b.tier === p.tier) - (a.tier === p.tier));
      }
      const nSwitch = level >= 6 ? 5 : level >= 5 ? 3 : 0;
      const nChoices = level >= 6 ? 4 : 3;
      const bank = level >= 6 ? K.shuffle(HARD) : EASY.slice();
      const switches = [];
      for (let i = 0; i < nSwitch; i++) switches.push(K.switchItem(bank[i % bank.length], nChoices, env.letters));
      const pluralOn = env.cvc.rules.pluralRound && window.__JU_BUILD_PLURAL !== false && K.lookItem;
      const plural = pluralOn ? Object.assign(K.lookItem('plural'), { activity: 'look', other: 'look' }) : null;
      const nTail = switches.length + (plural ? 1 : 0);
      const head = built.slice(0, Math.max(1, built.length - nTail));
      let items = switches.length && head.length ? [head[0], switches[0]].concat(head.slice(1), switches.slice(1)) : head.concat(switches);
      if (plural) items.push(plural);
      return items;
    },
    /* a missed word comes back once with a fresh tray */
    redo(env, item) {
      if (item.other) return Object.assign(K.lookItem('plural'), { activity: 'look', other: 'look' });
      if (item.kind === 'switch') {
        const bank = (env.level || 1) >= 6 ? HARD : EASY;
        const step = bank.find(s => s.from === item.from && s.to === item.to) || bank[0];
        return K.switchItem(step, item.tiles.length, env.letters);
      }
      return K.wordItem(env.cvc, env.letters, env.cvc.words.find(w => w.word === item.word), env.answers);
    },
    draw(item, ctl) {
      if (item.other) return JU.kinderGames[item.other].draw(item, ctl);
      if (item.kind === 'switch') return drawSwitch(item, ctl);
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
