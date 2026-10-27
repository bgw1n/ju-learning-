/* Listen and Type: hear the word, type it. */
(function () {
  const h = JU.ui.h;
  const MAX_TRIES = 3;

  JU.registerGame('spelling', {
    id: 'listen', title: 'Listen and Type', emoji: '\uD83C\uDFA7', sticker: '\uD83C\uDF08',
    blurb: 'Listen to the word, then type it.',
    playWord(ctx, w) {
      return new Promise(resolve => {
        let tries = 0; const typedAll = []; let locked = false, reveal = false;
        const input = h('input', { class: 'typebox', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Type the word you hear', maxlength: '20' });
        input.addEventListener('input', () => {
          const lower = input.value.toLowerCase().replace(/[^a-z]/g, '');
          if (lower !== input.value) input.value = lower;   // always lowercase, so letter case never gives anything away
        });
        const msg = h('p', { class: 'msg', 'aria-live': 'polite' }, 'Press the speaker, listen, and type the word.');
        const checkBtn = h('button', { class: 'btn primary big', type: 'button', onclick: () => submit() }, 'Check');
        const revealBox = h('div', { class: 'reveal' });
        const footer = h('div', { class: 'row' }, checkBtn);
        const sentenceBtn = JU.speech.supported
          ? h('button', { class: 'btn', type: 'button', onclick: () => JU.speech.say(w.sentence) }, h('span', { 'aria-hidden': 'true' }, '\uD83D\uDCAC'), ' Use it in a sentence')
          : null;
        const fallback = JU.speech.supported ? null : h('p', { class: 'note' }, 'Clue: ' + w.clue + ' (Sound is not available here. A grown-up can read the word.)');

        function submit() {
          if (locked) return;
          const typed = input.value.trim();
          if (!typed) { msg.textContent = 'Type the word you hear, then press Check.'; input.focus(); return; }
          tries++; typedAll.push(typed);
          if (reveal) {
            if (typed === w.word) return done(false);
            msg.textContent = 'Look at the word above and copy it letter by letter.'; input.value = ''; input.focus(); return;
          }
          if (typed === w.word) return done(tries === 1);
          if (tries >= MAX_TRIES) {
            reveal = true;
            revealBox.replaceChildren(h('p', null, 'Here is the word. Say it, then type it to practice:'),
              h('div', { class: 'bigword' }, JU.ui.coloredWord(ctx.week, w, { split: true })));
            msg.textContent = 'Now you type it.'; input.value = ''; input.focus(); return;
          }
          msg.textContent = tries === 1 ? 'Good try! Listen again and give it another go.' : 'Nice effort! Listen once more. The word starts with "' + w.word[0] + '".';
          input.focus(); input.select();
        }
        function done(correct) {
          locked = true; input.disabled = true;
          ctx.record({ word: w.word, typed: typedAll[0], typedAll, correct, tries });
          revealBox.replaceChildren(h('div', { class: 'bigword' }, JU.ui.coloredWord(ctx.week, w, { split: true })));
          msg.textContent = correct ? 'You got it! Great listening!' : 'You typed it! Practice makes it stick.';
          const next = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Next word \u2192');
          footer.replaceChildren(next); next.focus();
        }
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' },
          ctx.roundTag(), h('h2', null, 'Listen, then type the word'),
          h('div', { class: 'row center' }, ctx.speakButton(w.word, 'Hear the word'), sentenceBtn),
          fallback, revealBox, input, msg, footer));
        input.focus();
        JU.speech.say(w.word);
      });
    }
  });
})();
