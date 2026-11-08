/* kinder/look.js - v15 "Look and tap": short picture questions about words that describe things.
   'size'   three of the same picture, small, middle and big: "Tap the big one." / "Tap the little one."
   'plural' one or many: one picture and a group of the same picture: "Find: dogs." / "Find: dog." (listen for the s)
   'color'  (level 2) four colored pictures: "Tap the red one."
   Saved as activity 'look', item "size-big", "plural-dogs", "color-red". Build a word also ends each round with one 'one or many?' question. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const pick = a => a[Math.floor(K.rng() * a.length)];
  const SIZE_PICS = ['\uD83D\uDC36', '\uD83D\uDC31', '\uD83C\uDF4E', '\uD83D\uDE97', '\uD83C\uDF88', '\uD83D\uDC1F', '\u2B50', '\uD83D\uDC38'];
  K.PLURALS = [{ one: 'dog', many: 'dogs', e: '\uD83D\uDC36' }, { one: 'bed', many: 'beds', e: '\uD83D\uDECF\uFE0F' }, { one: 'cat', many: 'cats', e: '\uD83D\uDC31' },
    { one: 'bug', many: 'bugs', e: '\uD83D\uDC1B' }, { one: 'pig', many: 'pigs', e: '\uD83D\uDC37' }, { one: 'pot', many: 'pots', e: '\uD83C\uDF72' }, { one: 'cap', many: 'caps', e: '\uD83E\uDDE2' }];
  const COLORS = [{ c: 'red', e: '\u2764\uFE0F' }, { c: 'blue', e: '\uD83D\uDC99' }, { c: 'green', e: '\uD83D\uDC9A' }, { c: 'yellow', e: '\uD83D\uDC9B' }, { c: 'purple', e: '\uD83D\uDC9C' }, { c: 'orange', e: '\uD83E\uDDE1' }];
  K.lookItem = function (kind) {
    if (kind === 'size') {
      const e = pick(SIZE_PICS), want = K.rng() < 0.5 ? 'big' : 'little';
      const opts = K.shuffle([{ v: 'little', size: 'k-s1' }, { v: 'middle', size: 'k-s2' }, { v: 'big', size: 'k-s3' }]).map(o => Object.assign(o, { e, right: o.v === want }));
      return { id: 'size-' + want, kind, opts, text: 'Tap the ' + want + ' one.', hint: want === 'big' ? 'Big means the largest one.' : 'Little means the smallest one.',
        miss: 'Listen again. Tap the ' + want + ' one.', rightMsg: 'Yes! That is the ' + want + ' one.' };
    }
    if (kind === 'plural') {
      const p = pick(K.PLURALS), many = K.rng() < 0.5, w = many ? p.many : p.one, n = 3 + Math.floor(K.rng() * 2);
      const opts = K.shuffle([{ v: 'one', count: 1, e: p.e, right: !many }, { v: 'many', count: n, e: p.e, right: many }]);
      return { id: 'plural-' + w, kind, opts, text: 'One or many? Find: ' + w + '.', hint: 'Listen to the end of the word. ' + p.many + ' with an s means more than one. ' + p.one + ' means just one.',
        miss: 'Listen again. Find: ' + w + '.', rightMsg: many ? 'Yes! ' + p.many + ', many.' : 'Yes! ' + p.one + ', just one.' };
    }
    if (kind === 'both') {
      const cols = K.shuffle(COLORS).slice(0, 2), sizes = ['little', 'big'];
      const wantSize = K.rng() < 0.5 ? 'big' : 'little', wantCol = cols[0];
      const opts = [];
      sizes.forEach(size => cols.forEach(col => opts.push({ v: size + '-' + col.c, e: col.e, size: size === 'big' ? 'k-s3' : 'k-s1', right: size === wantSize && col === wantCol })));
      const word = wantSize + ' ' + wantCol.c;
      return { id: 'both-' + wantSize + '-' + wantCol.c, kind: 'both', opts: K.shuffle(opts), text: 'Tap the ' + word + ' one.',
        hint: 'Find the one that is ' + word + '.', miss: 'Listen again. Tap the ' + word + ' one.', rightMsg: 'Yes! That is the ' + word + ' one.' };
    }
    const cols = K.shuffle(COLORS).slice(0, 4), want = pick(cols);
    return { id: 'color-' + want.c, kind: 'color', opts: cols.map(c => ({ v: c.c, e: c.e, right: c === want })), text: 'Tap the ' + want.c + ' one.',
      hint: 'Look for the color ' + want.c + '.', miss: 'Listen again. Tap the ' + want.c + ' one.', rightMsg: 'Yes! That one is ' + want.c + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.look = {
    id: 'look', code: 8, title: 'Look and tap', icon: '\uD83D\uDD0E', hintNoun: 'picture',
    intro: 'Look and tap! Listen, then tap the picture that matches. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) {
      const lv = env.level || 1;
      const kinds = lv >= 3 ? ['both', 'both', 'both', 'both', 'color', 'size', 'both', 'plural', 'both', 'color']
        : lv >= 2 ? ['size', 'plural', 'color', 'size', 'plural', 'color', 'size', 'color', 'plural', 'size']
        : ['size', 'plural', 'size', 'plural', 'size', 'plural', 'size', 'plural', 'size', 'plural'];
      return kinds.map(K.lookItem);
    },
    redo(env, item) { return K.lookItem(item.kind); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const btns = item.opts.map(o => {
        const pics = []; for (let i = 0; i < (o.count || 1); i++) pics.push(h('span', { class: 'k-lpic ' + (o.size || ''), 'aria-hidden': 'true' }, o.e));
        const b = h('button', { class: 'opt k-opt k-lookopt' + (item.kind === 'plural' ? ' k-plural' : ''), type: 'button', 'data-pick': o.v, 'data-right': o.right ? '1' : null, 'aria-label': item.kind === 'plural' ? (o.count > 1 ? 'many' : 'one') : item.kind === 'size' ? 'a picture' : 'a heart', onclick: async () => {
          if (answered || b.disabled) return;
          if (o.right) { answered = true; b.classList.add('right'); btns.forEach(x => { if (x !== b) x.disabled = true; }); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { kind: item.kind }, message: item.rightMsg }); }
          else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('look ' + o.v, item.miss); }
        } }, pics);
        return b;
      });
      return [h('div', { class: 'k-looks k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Pictures', 'data-look': item.kind }, btns)];
    }
  };
})();
