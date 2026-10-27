/* Unscramble: tap the letter tiles (or type them) to build the word. */
(function () {
  const h = JU.ui.h;
  const MAX_TRIES = 3;

  function scrambled(letters) {
    let s = letters;
    for (let n = 0; n < 10; n++) {
      s = JU.ui.shuffle(letters);
      if (s.map(x => x.ch).join('') !== letters.map(x => x.ch).join('')) break;
    }
    return s;
  }

  JU.registerGame('spelling', {
    id: 'unscramble', title: 'Unscramble', emoji: '\uD83E\uDDE9', sticker: '\uD83E\uDD8B',
    blurb: 'Tap the letters to build each word.',
    playWord(ctx, w) {
      return new Promise(resolve => {
        const cols = JU.weeks.letterColors(ctx.week, w);
        const base = [...w.word].map((ch, i) => ({ ch, color: cols[i] }));
        let tries = 0; const typedAll = []; let locked = false;
        const placed = [];            // tile objects in the answer row
        const tiles = scrambled(base).map(t => {
          const o = { ch: t.ch, color: t.color, used: false };
          o.el = h('button', { class: 'tile', type: 'button', style: o.color ? { color: o.color, borderColor: o.color } : null, 'aria-label': 'letter ' + o.ch }, o.ch);
          o.el.addEventListener('click', ev => toggle(o, ev.detail === 0));
          return o;
        });
        const slots = base.map(() => h('div', { class: 'slot' }));
        const bank = h('div', { class: 'bank', role: 'group', 'aria-label': 'Letters to use' }, tiles.map(t => t.el));
        const answer = h('div', { class: 'answer', role: 'group', 'aria-label': 'Your word' }, slots);
        const msg = h('p', { class: 'msg', 'aria-live': 'polite' }, 'Tap the letters in order. You can do it!');
        const check = h('button', { class: 'btn primary big', type: 'button', disabled: true, onclick: () => submit() }, 'Check my word');
        const undo = h('button', { class: 'btn', type: 'button', onclick: () => backspace() }, '\u232B Undo');
        const hear = ctx.speakButton(w.word, 'Hear the word');
        const controls = h('div', { class: 'row' }, undo, check);

        function layout() {
          slots.forEach((s, i) => s.replaceChildren(placed[i] ? placed[i].el : ''));
          tiles.forEach(t => { t.el.classList.toggle('used', t.used); });
          bank.replaceChildren(...tiles.filter(t => !t.used).map(t => t.el));
          check.disabled = locked || placed.length !== base.length;
          undo.disabled = locked || !placed.length;
        }
        function toggle(o, focus) {
          if (locked) return;
          if (o.used) { const i = placed.indexOf(o); placed.splice(i, 1); o.used = false; }
          else if (placed.length < base.length) { placed.push(o); o.used = true; }
          layout(); if (focus) o.el.focus();
        }
        function backspace() {
          if (locked || !placed.length) return;
          const o = placed.pop(); o.used = false; layout();
        }
        function finishWord(correct, typed) {
          locked = true; layout();
          answer.classList.add('done');
          ctx.record({ word: w.word, typed: typedAll[0], typedAll, correct, tries });
          const next = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Next word \u2192');
          msg.textContent = correct ? 'You built it! Great spelling!' : 'Here is the word. Look at the colors and say it out loud.';
          controls.replaceChildren(next);
          next.focus();
        }
        function submit() {
          if (locked || placed.length !== base.length) return;
          const typed = placed.map(t => t.ch).join('');
          tries++; typedAll.push(typed);
          if (typed === w.word) return finishWord(tries === 1, typed);
          if (tries >= MAX_TRIES) {
            // show the right answer, gently
            placed.length = 0; tiles.forEach(t => t.used = false);
            [...w.word].forEach(ch => { const t = tiles.find(x => !x.used && x.ch === ch); t.used = true; placed.push(t); });
            return finishWord(false, typed);
          }
          msg.textContent = 'Almost! Look at the colors and try again.';
          placed.length = 0; tiles.forEach(t => t.used = false); layout();
        }
        ctx.onKey(e => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
          if (locked) { if (e.key === 'Enter' && !onButton) { const b = controls.querySelector('button'); if (b) b.click(); } return; }
          if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
          else if (e.key === 'Enter') { if (onButton) return; e.preventDefault(); if (!check.disabled) submit(); }
          else if (/^[a-zA-Z]$/.test(e.key)) {
            const t = tiles.find(x => !x.used && x.ch === e.key.toLowerCase());
            if (t) toggle(t);
          }
        });

        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' },
          ctx.roundTag(),
          h('h2', null, 'Unscramble the word'),
          h('p', { class: 'clue' }, h('strong', null, 'Clue: '), w.clue),
          h('div', { class: 'row center' }, hear),
          answer, msg, bank, controls));
        layout();
        JU.speech.say(w.word);
      });
    }
  });
})();
