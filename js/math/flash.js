/* math/flash.js - Math Fact Flash Cards.
   One fact at a time, big numbers, a big number pad (keyboard digits, Backspace and Enter work too).
   A correct answer moves on by itself as soon as the typed digits match. No submit button.
   A wrong answer (enough digits, or Enter) shakes the card, clears, and stays until she gets it right.
   That fact is put back in line to show up again later in the same round. Wrong answers do not score.
   One minute. Score is how many facts she got right. Her best is remembered on this device. */
(function () {
  const h = JU.ui.h;
  const MINUS = '\u2212';

  function showFact(f) {
    return h('p', { class: 'flash-fact', id: 'flash-fact', 'data-a': String(f.a), 'data-op': f.op, 'data-b': String(f.b), 'data-key': f.key },
      h('span', { class: 'flash-n' }, String(f.a)),
      h('span', { class: 'flash-op', 'aria-hidden': 'true' }, f.op === '+' ? '+' : MINUS),
      h('span', { class: 'flash-n' }, String(f.b)));
  }

  JU.registerGame('math', {
    id: 'flash',
    title: 'Math Fact Flash Cards',
    emoji: '\u26A1',
    blurb: 'One minute. Big adding and taking-away facts. Type the answer!',
    ownRound: true,
    async play(ctx) {
      const stage = ctx.stage;
      let best = 0, hadRounds = false;
      try {
        const saved = await JU.storage.getMath();
        hadRounds = saved.rounds.length > 0;
        best = saved.rounds.reduce((m, r) => Math.max(m, r.score), 0);
      } catch (e) { best = 0; hadRounds = false; }

      function home() {
        const start = h('button', { class: 'btn primary big', type: 'button', id: 'flash-start' }, 'Start');
        stage.replaceChildren(h('div', { class: 'card center flash-home', id: 'flash-home' },
          h('div', { class: 'flash-hello', 'aria-hidden': 'true' }, '\u26A1'),
          h('h2', null, 'Math Fact Flash Cards'),
          h('p', { class: 'lead' }, 'One minute. One fact at a time. Type the answer on the number pad.'),
          h('p', { class: 'lead', id: 'flash-best-line' }, hadRounds || best ? 'Your best: ' + best : 'Your best will show up after you play.'),
          start));
        start.addEventListener('click', () => round());
        start.focus();
      }

      function round() {
        const limit = (typeof window.__JU_FLASH_MS === 'number' && window.__JU_FLASH_MS > 0) ? window.__JU_FLASH_MS : JU.mathFacts.ROUND_MS;
        const t0 = Date.now();
        let score = 0;
        let misses = {};          // key -> how many wrong tries this round
        let comeback = [];        // { key, fact, due } shown again after a couple of other facts
        let shown = 0;
        let current = null;
        let typed = '';
        let alive = true;
        let state = { prev: '', addN: 0, subN: 0 };
        let timer = 0;
        const card = h('div', { class: 'flash-card', id: 'flash-card', 'data-shakes': '0' });
        const typedEl = h('p', { class: 'flash-typed', id: 'flash-typed', 'aria-label': 'Your answer' });
        const note = h('p', { class: 'flash-note', id: 'flash-note' });
        const scoreEl = h('span', { class: 'flash-score', id: 'flash-score' }, '0');
        const timeEl = h('span', { class: 'flash-time', id: 'flash-time' }, '1:00');
        const pad = h('div', { class: 'flash-pad', role: 'group', 'aria-label': 'Number pad' });
        '123456789'.split('').forEach(d => pad.appendChild(keyBtn(d, d)));
        pad.appendChild(keyBtn('back', '\u232B', 'Delete'));
        pad.appendChild(keyBtn('0', '0'));
        pad.appendChild(h('span', { class: 'flash-pad-gap', 'aria-hidden': 'true' }));

        function keyBtn(k, label, aria) {
          const b = h('button', { class: 'pad', type: 'button', 'data-k': k, 'aria-label': aria || label }, label);
          b.addEventListener('click', () => press(k));
          return b;
        }
        function left() { return Math.max(0, limit - (Date.now() - t0)); }
        function paintTime() {
          const s = Math.ceil(left() / 1000);
          const m = Math.floor(s / 60), r = s % 60;
          timeEl.textContent = m + ':' + (r < 10 ? '0' : '') + r;
          timeEl.classList.toggle('low', s <= 10 && s > 0);
          timeEl.setAttribute('aria-label', s + ' seconds left');
        }
        function paintTyped() { typedEl.textContent = typed; }
        function paintScore() { scoreEl.textContent = String(score); scoreEl.setAttribute('aria-label', 'Score ' + score); }

        function fresh() {
          const n = JU.mathFacts.next(state);
          state = { prev: n.prev, addN: n.addN, subN: n.subN };
          return n.fact;
        }
        function pickNext(prevKey) {
          const i = comeback.findIndex(c => c.due <= shown + 1 && c.key !== prevKey);
          if (i >= 0) {
            const c = comeback.splice(i, 1)[0];
            state.prev = c.key;
            return c.fact;
          }
          let f = fresh();
          let guard = 0;
          while (f.key === prevKey && guard < 8) { f = fresh(); guard++; }
          return f;
        }
        function renderFact(f) {
          current = f;
          shown++;
          typed = '';
          card.classList.remove('shake');
          note.textContent = '';
          card.replaceChildren(showFact(f), typedEl, note);
          paintTyped();
        }
        function wrong() {
          if (!current) return;
          misses[current.key] = (misses[current.key] || 0) + 1;
          if (!comeback.some(c => c.key === current.key)) comeback.push({ key: current.key, fact: current, due: shown + 3 });
          typed = '';
          paintTyped();
          note.textContent = 'Try again!';
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          card.dataset.shakes = String(Number(card.dataset.shakes || '0') + 1);
        }
        function right() {
          if (left() <= 0) { finish(); return; }
          score++;
          paintScore();
          const prev = current.key;
          renderFact(pickNext(prev));
        }
        function judge(fromEnter) {
          if (!alive || !current) return;
          const want = String(current.answer);
          if (typed === want) right();
          else if (fromEnter || typed.length >= want.length) wrong();
        }
        function press(k) {
          if (!alive) return;
          if (left() <= 0) { finish(); return; }
          if (k === 'back') { typed = typed.slice(0, -1); paintTyped(); note.textContent = ''; return; }
          if (k === 'enter') { if (typed) judge(true); return; }
          if (!/^\d$/.test(k)) return;
          if (typed.length >= 2) return;
          typed += k;
          paintTyped();
          note.textContent = '';
          judge(false);
        }
        function onKey(e) {
          if (!alive) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const tag = e.target && e.target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA') return;
          if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
          else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
          else if (e.key === 'Enter') { e.preventDefault(); press('enter'); }
        }
        function tick() {
          if (!alive) return;
          paintTime();
          if (left() <= 0) finish();
        }
        async function finish() {
          if (!alive) return;
          alive = false;
          document.removeEventListener('keydown', onKey);
          clearInterval(timer);
          let rounds = [];
          try {
            const saved = await JU.storage.addMathRound({ score: score, misses: misses });
            rounds = saved.rounds;
          } catch (e) { rounds = []; }
          const newBest = score > best && score > 0;
          if (score > best) best = score;
          const again = h('button', { class: 'btn primary big', type: 'button', id: 'flash-again' }, 'Play again');
          stage.replaceChildren(h('div', { class: 'card center flash-end', id: 'flash-end' },
            h('div', { class: 'flash-hello', 'aria-hidden': 'true' }, newBest ? '\uD83C\uDF1F' : '\u23F1'),
            h('h2', null, 'Time!'),
            h('p', { class: 'lead', id: 'flash-end-score' }, 'You got ' + score + ' right.'),
            newBest ? h('p', { class: 'flash-new-best', id: 'flash-new-best' }, 'New best!') : h('p', { class: 'flash-new-best', id: 'flash-new-best', hidden: true }, ''),
            h('p', { class: 'lead', id: 'flash-end-best' }, 'Your best: ' + (rounds.length ? best : score)),
            h('div', { class: 'row' }, again, h('a', { class: 'btn', href: 'child.html' }, 'Back to games'))));
          again.addEventListener('click', () => round());
          again.focus();
        }

        document.addEventListener('keydown', onKey);
        stage.replaceChildren(h('div', { class: 'flash-round', id: 'flash-round' },
          h('div', { class: 'flash-hud' },
            h('span', { class: 'flash-hud-bit' }, h('span', { class: 'flash-hud-l' }, 'Score'), scoreEl),
            h('span', { class: 'flash-hud-bit' }, h('span', { class: 'flash-hud-l' }, 'Time'), timeEl)),
          h('div', { class: 'flash-body' }, card, pad)));
        renderFact(pickNext(''));
        paintScore();
        paintTime();
        timer = setInterval(tick, 200);
      }

      home();
    }
  });
})();
