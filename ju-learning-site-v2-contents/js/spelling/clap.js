/* Clap the Beats: count the syllables by clapping, then cut the word into its beats. */
(function () {
  const h = JU.ui.h;
  const MAX_WRONG = 2;   // after this many misses in a step, we show the answer kindly

  let audio = null;
  function clapSound() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = 520;
      g.gain.setValueAtTime(0.25, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.13);
    } catch (e) { }
  }

  const EXAMPLE = { word: 'pencil', syllables: ['pen', 'cil'] };
  const EX_COLORS = ['#1663d6', '#e06c00'];

  async function intro(ctx) {
    const exBeats = h('div', { class: 'ex-beats', 'aria-live': 'polite' });
    const partEls = EXAMPLE.syllables.map((s, i) => h('span', { class: 'ex-part', style: { color: EX_COLORS[i] } }, s));
    const demoBtn = h('button', { class: 'btn', type: 'button' }, '\u25B6 Watch the example');
    let running = false;
    demoBtn.addEventListener('click', async () => {
      if (running) return; running = true;
      exBeats.textContent = '';
      for (let i = 0; i < partEls.length; i++) {
        partEls.forEach((p, k) => p.classList.toggle('lit', k === i));
        exBeats.textContent += '\uD83D\uDC4F ';
        clapSound();
        await JU.speech.say(EXAMPLE.syllables[i], { rate: 0.7 });
        await JU.ui.sleep(250);
      }
      partEls.forEach(p => p.classList.remove('lit'));
      exBeats.textContent += ' = 2 beats!';
      running = false;
    });
    await new Promise(resolve => {
      const go = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'I\u2019m ready!');
      ctx.stage.replaceChildren(h('div', { class: 'card game clap-intro' },
        h('h2', null, 'Clap the Beats'),
        h('p', { class: 'lead' }, 'Every word is made of beats. Each beat is one part of the word you say. These parts are called syllables.'),
        h('ol', { class: 'steps' },
          h('li', null, 'Listen to the word.'),
          h('li', null, 'Say it slowly and clap once for every beat.'),
          h('li', null, 'Tap the clap button once for each beat, then press Check.'),
          h('li', null, 'Then tap between the letters to cut the word into its beats.')),
        h('div', { class: 'example' },
          h('p', { class: 'ex-title' }, 'Example:'),
          h('div', { class: 'bigword' }, partEls[0], h('span', { class: 'cword-gap', 'aria-hidden': 'true' }, '\u2022'), partEls[1]),
          h('p', null, 'pen \uD83D\uDC4F  cil \uD83D\uDC4F  \u2192 2 claps. We cut it between the n and the c.'),
          exBeats, demoBtn),
        h('div', { class: 'row' }, go)));
      go.focus();
    });
  }

  JU.registerGame('spelling', {
    id: 'clap', title: 'Clap the Beats', emoji: '\uD83D\uDC4F', sticker: '\uD83D\uDC1D',
    blurb: 'Clap and cut each word into its beats.',
    intro,
    playWord(ctx, w) {
      return new Promise(resolve => {
        const want = w.syllables.length;
        const wantCuts = []; { let n = 0; w.syllables.slice(0, -1).forEach(s => { n += s.length; wantCuts.push(n); }); }
        const wantSplit = w.syllables.join('-');
        const typedAll = []; let claps = 0, wrong = 0, wrongTotal = 0, step = 1;
        const cuts = new Set();
        const body = h('div');
        const msg = h('p', { class: 'msg', 'aria-live': 'polite' });
        const footer = h('div', { class: 'row' });

        function finish() {
          ctx.record({ word: w.word, typed: typedAll[0], typedAll, correct: wrongTotal === 0, tries: typedAll.length });
          const next = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Next word \u2192');
          footer.replaceChildren(next); next.focus();
        }

        function step1() {
          step = 1; wrong = 0;
          const count = h('div', { class: 'clap-count', 'aria-live': 'polite', 'aria-label': 'claps so far' });
          const draw = () => { count.textContent = claps ? '\uD83D\uDC4F '.repeat(claps).trim() : 'No claps yet'; };
          const clapBtn = h('button', { class: 'btn clapbtn', type: 'button', onclick: () => { claps++; clapSound(); draw(); } }, '\uD83D\uDC4F Clap');
          const reset = h('button', { class: 'btn', type: 'button', onclick: () => { claps = 0; draw(); msg.textContent = 'Start again. Say the word slowly.'; } }, 'Start over');
          let revealed = false;
          const check = h('button', { class: 'btn primary big', type: 'button', onclick: () => {
            if (revealed) return step2();
            typedAll.push('claps:' + claps);
            if (claps === want) { msg.textContent = 'Yes! ' + want + (want === 1 ? ' beat.' : ' beats.'); return step2(); }
            wrong++; wrongTotal++;
            if (wrong >= MAX_WRONG) {
              claps = want; draw();
              msg.textContent = 'This word has ' + want + (want === 1 ? ' beat' : ' beats') + '. Say it with me!';
              JU.speech.say(w.word, { rate: 0.6 });
              clapBtn.disabled = reset.disabled = true;
              check.textContent = 'Keep going \u2192';
              revealed = true;
              return;
            }
            claps = 0; draw();
            msg.textContent = 'Good try! Say the word slowly, and listen for each beat.';
          } }, 'Check');
          body.replaceChildren(
            h('h2', null, 'How many beats do you hear?'),
            h('div', { class: 'bigword plain' }, w.word),
            h('div', { class: 'row center' }, ctx.speakButton(w.word, 'Hear the word')),
            h('div', { class: 'row' }, clapBtn, reset), count);
          footer.replaceChildren(check);
          draw();
          if (!msg.textContent) msg.textContent = 'Clap once for each beat, then press Check.';
        }

        function step2() {
          step = 2; wrong = 0; cuts.clear();
          const letters = [...w.word];
          const row = h('div', { class: 'cutrow', role: 'group', 'aria-label': 'Tap between letters to cut the word' });
          letters.forEach((ch, i) => {
            row.appendChild(h('span', { class: 'cutletter' }, ch));
            if (i < letters.length - 1) {
              const gap = h('button', { class: 'gap', type: 'button', 'aria-pressed': 'false', 'aria-label': 'cut after ' + ch }, '');
              gap.addEventListener('click', () => {
                const pos = i + 1;
                if (cuts.has(pos)) cuts.delete(pos); else cuts.add(pos);
                gap.classList.toggle('on', cuts.has(pos)); gap.setAttribute('aria-pressed', String(cuts.has(pos)));
              });
              row.appendChild(gap);
            }
          });
          const check = h('button', { class: 'btn primary big', type: 'button' }, 'Check');
          check.addEventListener('click', () => {
            const mine = [...cuts].sort((a, b) => a - b);
            const str = []; { let prev = 0; mine.concat([letters.length]).forEach(c => { str.push(w.word.slice(prev, c)); prev = c; }); }
            typedAll.push('split:' + str.join('-'));
            if (mine.join(',') === wantCuts.join(',')) { return showDone(); }
            wrong++; wrongTotal++;
            if (wrong >= MAX_WRONG) { msg.textContent = 'Here is how it splits. Say each beat out loud.'; return showDone(); }
            msg.textContent = 'Almost! Say it slowly and tap where one beat ends.';
          });
          body.replaceChildren(
            h('h2', null, 'Now cut it into beats'),
            h('p', { class: 'note' }, want === 1 ? 'This word is one beat. Do not cut anything, just press Check.' : 'Tap the space between letters where one beat ends.'),
            row, h('div', { class: 'row center' }, ctx.speakButton(w.word, 'Hear the word')));
          footer.replaceChildren(check);
          msg.textContent = '';
        }

        function showDone() {
          body.replaceChildren(
            h('h2', null, wrongTotal === 0 ? 'You clapped and cut it!' : 'Here are the beats'),
            h('div', { class: 'bigword' }, JU.ui.coloredWord(ctx.week, w, { split: true })),
            h('p', { class: 'lead' }, w.syllables.join(' \u2022 ') + '  (' + want + (want === 1 ? ' beat)' : ' beats)')));
          if (wrongTotal === 0) msg.textContent = 'Great job!';
          finish();
        }

        ctx.clear();
        ctx.stage.appendChild(h('div', { class: 'card game' }, ctx.roundTag(), body, msg, footer));
        step1();
        JU.speech.say(w.word);
      });
    }
  });
})();
