/* Word Match: match a word to its clue, or to how it splits into syllables. */
(function () {
  const h = JU.ui.h;

  /* wrong ways to split a word: cut at other places */
  function wrongSplits(w, n) {
    const word = w.word, right = w.syllables.join('-');
    const pref = [], rest = [];
    for (let i = 1; i <= word.length - 1; i++) (i >= 2 && i <= word.length - 2 ? pref : rest).push(i);
    const opts = [];
    JU.ui.shuffle(pref).concat(JU.ui.shuffle(rest)).forEach(i => {
      const s = word.slice(0, i) + '-' + word.slice(i);
      if (s !== right && opts.indexOf(s) === -1) opts.push(s);
    });
    return opts.slice(0, n);
  }
  function splitWord(s) { return { word: s.replace(/-/g, ''), syllables: s.split('-') }; }

  JU.registerGame('spelling', {
    id: 'match', title: 'Word Match', emoji: '\uD83D\uDD17', sticker: '\uD83D\uDC1E',
    blurb: 'Match each word to its clue or its syllables.',
    playWord(ctx, w) {
      return new Promise(resolve => {
        const kind = ctx.index % 2 === 0 ? 'clue' : 'split';
        let tries = 0; const typedAll = []; let locked = false;
        let options, right, prompt, show;
        if (kind === 'clue') {
          const others = JU.ui.shuffle(ctx.week.words.filter(x => x.word !== w.word)).slice(0, 2);
          options = JU.ui.shuffle([w, ...others]).map(x => ({ text: x.clue, el: null }));
          right = w.clue;
          prompt = 'Which clue goes with this word?';
          show = h('div', { class: 'bigword' }, JU.ui.coloredWord(ctx.week, w));
        } else {
          options = JU.ui.shuffle([w.syllables.join('-'), ...wrongSplits(w, 2)]).map(t => ({ text: t, el: null }));
          right = w.syllables.join('-');
          prompt = 'Which one shows the syllables?';
          show = h('div', { class: 'bigword plain' }, w.word);
        }
        const msg = h('p', { class: 'msg', 'aria-live': 'polite' }, 'Tap the one you think matches.');
        const list = h('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' }, options.map((o, i) => {
          const content = kind === 'clue' ? o.text : JU.ui.coloredWord(ctx.week, splitWord(o.text), { split: true });
          o.el = h('button', { class: 'choice' + (kind === 'split' ? ' wordy' : ''), type: 'button', onclick: () => pick(o) },
            h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)), content);
          return o.el;
        }));
        const footer = h('div', { class: 'row' });
        function pick(o) {
          if (locked) return;
          tries++; typedAll.push(o.text);
          if (o.text === right) {
            locked = true;
            o.el.classList.add('right');
            list.querySelectorAll('button').forEach(b => b.disabled = true);
            ctx.record({ word: w.word, typed: typedAll[0], typedAll, correct: tries === 1, tries });
            msg.textContent = 'Yes! That is the match.';
            const next = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Next word \u2192');
            footer.replaceChildren(next); next.focus();
          } else {
            o.el.classList.add('tried'); o.el.disabled = true;
            msg.textContent = 'Not that one. Try another!';
          }
        }
        ctx.onKey(e => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (/^[1-3]$/.test(e.key) && !locked) { const o = options[Number(e.key) - 1]; if (o && !o.el.disabled) pick(o); }
          else if (e.key === 'Enter' && locked && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { const b = footer.querySelector('button'); if (b) b.click(); }
        });
        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' },
          ctx.roundTag(), h('h2', null, prompt), show,
          kind === 'clue' ? h('div', { class: 'row center' }, ctx.speakButton(w.word, 'Hear the word')) : null,
          list, msg, footer));
      });
    }
  });
})();
