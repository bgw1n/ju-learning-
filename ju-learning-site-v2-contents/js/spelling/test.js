/* Online Test: hear each word, type it. No hints and no right/wrong feedback until the end. */
(function () {
  const h = JU.ui.h;

  JU.registerGame('spelling', {
    id: 'test', title: 'Spelling Test', emoji: '\u270F\uFE0F', sticker: '\uD83C\uDFC5',
    noSticker: true,
    blurb: 'Listen and type each word. A grown-up sits with you.',
    intro(ctx) {
      return new Promise(resolve => {
        const go = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Start the test');
        ctx.stage.replaceChildren(h('div', { class: 'card center' },
          h('h2', null, ctx.proctored ? 'Grown-up: test time' : 'Spelling Test'),
          h('p', { class: 'lead' }, 'You will hear ' + ctx.words.length + ' words, one at a time. Type each word and press Next. You can press the speaker to hear a word again.'),
          h('p', { class: 'lead' }, 'Just do your best. There is no timer.'),
          go));
        go.focus();
      });
    },
    playWord(ctx, w) {
      return new Promise(resolve => {
        let sent = false;
        const input = h('input', { class: 'typebox', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Type the word you hear', maxlength: '20' });
        input.addEventListener('input', () => {
          const lower = input.value.toLowerCase().replace(/[^a-z]/g, '');
          if (lower !== input.value) input.value = lower;
        });
        function submit(unsure) {
          if (sent) return;
          const typed = unsure ? '' : input.value.trim();
          if (!unsure && !typed) { input.focus(); return; }
          sent = true;
          ctx.record({ word: w.word, typed, typedAll: [typed], correct: typed === w.word, tries: 1 });
          resolve();
        }
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(false); } });
        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' },
          ctx.roundTag(), h('h2', null, 'Listen and type the word'),
          h('div', { class: 'row center' }, ctx.speakButton(w.word, 'Hear it again', { sentence: w.sentence })),
          input,
          h('div', { class: 'row' },
            h('button', { class: 'btn', type: 'button', onclick: () => submit(true) }, 'I\u2019m not sure'),
            h('button', { class: 'btn primary big', type: 'button', onclick: () => submit(false) }, 'Next \u2192'))));
        input.focus();
        JU.speech.dictate(w.word, w.sentence);
      });
    },
    async finish(ctx) {
      const right = ctx.results.filter(r => r.correct);
      const missed = ctx.results.filter(r => !r.correct);
      const total = ctx.results.length;
      ctx.stage.replaceChildren(h('div', { class: 'card center finish' },
        h('div', { class: 'sticker-pop', 'aria-hidden': 'true' }, '\uD83C\uDFC5'),
        h('h2', null, 'You finished the test!'),
        h('p', { class: 'lead' }, 'You spelled ' + right.length + ' out of ' + total + ' words right. Thank you for working so hard!'),
        missed.length ? h('div', { class: 'tricky' },
          h('p', null, 'Words to practice next:'),
          h('div', { class: 'chips' }, missed.map(r => {
            const w = ctx.week.words.find(x => x.word === r.word);
            return h('span', { class: 'chip' }, JU.ui.coloredWord(ctx.week, w, { split: true }));
          }))) : h('p', { class: 'lead' }, 'Every word was right. Wow!'),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: ctx.proctored ? 'parent.html' : 'child.html' }, ctx.proctored ? 'Back to grown-up page' : 'Back to games'))));
      ctx.stage.querySelector('a.btn').focus();
    }
  });
})();
