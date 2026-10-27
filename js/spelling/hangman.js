/* Hangman, gently: every letter you find helps a flower grow. Nobody gets hurt, nothing is lost. */
(function () {
  const h = JU.ui.h;
  const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const HELP_AFTER = 5; // after this many missed letters, one letter is revealed as a helper

  function flowerSVG() {
    const ns = 'http://www.w3.org/2000/svg';
    const wrap = document.createElement('div');
    wrap.className = 'garden';
    wrap.innerHTML =
      '<svg viewBox="0 0 200 220" role="img" aria-label="A flower that grows as you find letters">' +
      '<ellipse cx="100" cy="206" rx="70" ry="9" fill="#d9cdb4"/>' +
      '<path d="M70 168 h60 l-8 36 h-44 z" fill="#c9784a"/><rect x="64" y="160" width="72" height="12" rx="5" fill="#b8683c"/>' +
      '<rect class="stem" x="97" y="160" width="6" height="0" fill="#3f9c5a"/>' +
      '<g class="leaf l1" opacity="0"><path d="M100 140 q-34 -6 -40 -34 q32 2 40 34z" fill="#58b872"/></g>' +
      '<g class="leaf l2" opacity="0"><path d="M100 118 q34 -6 40 -34 q-32 2 -40 34z" fill="#58b872"/></g>' +
      '<g class="bloom" opacity="0">' +
      ['0', '60', '120', '180', '240', '300'].map(a => '<ellipse cx="100" cy="46" rx="14" ry="24" fill="#f4a6c0" transform="rotate(' + a + ' 100 70)"/>').join('') +
      '<circle cx="100" cy="70" r="15" fill="#ffd25e"/></g>' +
      '<g class="bud" opacity="0"><ellipse cx="100" cy="84" rx="9" ry="13" fill="#f4a6c0"/></g>' +
      '</svg>';
    return wrap;
  }
  function growFlower(root, frac, complete) {
    const stem = root.querySelector('.stem');
    const H = Math.round(14 + 81 * frac);
    stem.setAttribute('height', H); stem.setAttribute('y', 160 - H);
    root.querySelector('.l1').setAttribute('opacity', frac >= 0.34 ? 1 : 0);
    root.querySelector('.l2').setAttribute('opacity', frac >= 0.67 ? 1 : 0);
    root.querySelector('.bud').setAttribute('opacity', frac >= 0.9 && !complete ? 1 : 0);
    root.querySelector('.bloom').setAttribute('opacity', complete ? 1 : 0);
  }

  JU.registerGame('spelling', {
    id: 'hangman', title: 'Grow the Flower', emoji: '\uD83C\uDF3B', sticker: '\uD83C\uDF3B',
    blurb: 'Guess the letters and help a flower grow.',
    hintGate: true,
    playWord(ctx, w) {
      return new Promise(resolve => {
        const word = w.word;
        const cols = JU.weeks.letterColors(ctx.week, w);
        const guessed = []; let misses = 0, done = false;
        const garden = flowerSVG();
        const blanks = h('div', { class: 'blanks', 'aria-label': 'The word so far' });
        const msg = h('p', { class: 'msg', 'aria-live': 'polite' }, 'Pick a letter. Every letter you find helps the flower grow!');
        const keys = {};
        const kb = h('div', { class: 'keys', role: 'group', 'aria-label': 'Letters' }, ABC.map(ch => {
          const b = h('button', { class: 'key', type: 'button', 'aria-label': ch, onclick: () => guess(ch) }, ch);
          keys[ch] = b; return b;
        }));
        const footer = h('div', { class: 'row' });
        const hint = ctx.hintGate(w, 'Hear the word');

        function shown(i) { return guessed.indexOf(word[i]) !== -1; }
        function draw() {
          blanks.replaceChildren(...[...word].map((ch, i) => h('span', { class: 'blank' + (shown(i) ? ' on' : ''), style: shown(i) && cols[i] ? { color: cols[i] } : null }, shown(i) ? ch : '\u00A0')));
          const found = [...word].filter((c, i) => shown(i)).length;
          growFlower(garden, found / word.length, found === word.length);
        }
        function complete() { return [...word].every((c, i) => shown(i)); }
        function end() {
          done = true;
          Object.values(keys).forEach(k => k.disabled = true);
          const correct = misses <= 2;
          ctx.record({ word, typed: guessed.join(''), typedAll: guessed.slice(), correct, tries: guessed.length });
          msg.textContent = 'The flower bloomed! You spelled ' + word + '.';
          const next = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Next word \u2192');
          footer.replaceChildren(next); next.focus();
        }
        function guess(ch) {
          if (done || guessed.indexOf(ch) !== -1) return;
          guessed.push(ch);
          const hit = word.indexOf(ch) !== -1;
          keys[ch].classList.add(hit ? 'hit' : 'miss'); keys[ch].disabled = true;
          if (hit) msg.textContent = 'Yes! There is a "' + ch + '" in the word.';
          else {
            misses++; hint.miss(ch);
            msg.textContent = 'No "' + ch + '" this time. Try another letter!';
            if (misses % HELP_AFTER === 0) {
              const i = [...word].findIndex((c, k) => !shown(k));
              if (i >= 0) { const hc = word[i]; guessed.push(hc); keys[hc].classList.add('hit'); keys[hc].disabled = true; msg.textContent = 'Here is a helper letter: "' + hc + '"!'; }
            }
          }
          draw();
          if (complete()) end();
        }
        ctx.onKey(e => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (done) return;
          if (/^[a-zA-Z]$/.test(e.key)) guess(e.key.toLowerCase());
        });

        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' },
          ctx.roundTag(),
          h('h2', null, 'Help the flower grow'),
          h('div', { class: 'hang-layout' },
            garden,
            h('div', { class: 'hang-main' },
              h('p', { class: 'clue' }, h('strong', null, 'Clue: '), w.clue),
              h('div', { class: 'row center' }, hint.el),
              blanks, msg, kb, footer))));
        draw();
      });
    }
  });
})();
