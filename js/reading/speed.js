/* reading/speed.js - Reading Speed.
   Pick a passage, flash one word at a time (red focus letter), then a one-minute read-aloud.
   Each one waits for Ready, then a 3, 2, 1, Go! countdown. Words and the 60-second clock stay still until Go.
   The grown-up taps missed words. The timer never stops for those taps.
   When the minute ends, or she finishes early, the grown-up taps the last word she read.
   Score = words up to that word, minus the red ones. An early finish scales to one minute.
   Then three comprehension questions. Scores stay on this device. */
(function () {
  const h = JU.ui.h;
  let currentPassage = null;
  JU.reading.current = function () { return currentPassage; };

  function countMs() {
    const n = window.__JU_RS_COUNT_MS;
    return (typeof n === 'number' && n >= 0) ? n : 1000;
  }
  /* A tiny beep on each count. Optional: if the browser blocks sound, the numbers still show. */
  function countBeep(go) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = JU._countAudio || (JU._countAudio = new Ctx());
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = go ? 880 : 620;
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.09);
    } catch (e) { /* the countdown still works without a beep */ }
  }
  function countBox() {
    return h('div', { class: 'rs-count', id: 'rs-count', hidden: true, 'data-step': '' },
      h('div', { class: 'rs-count-num', id: 'rs-count-num' }, '3'));
  }

  function latestRound(rounds) {
    let best = null;
    (rounds || []).forEach(r => { if (!best || r.ts > best.ts) best = r; });
    return best;
  }
  function bestWpm(rounds) {
    return (rounds || []).reduce((m, r) => Math.max(m, r.wpm || 0), 0);
  }
  function bestFor(rounds, id) {
    let n = null;
    (rounds || []).forEach(r => { if (r.passageId === id && (n == null || r.wpm > n)) n = r.wpm; });
    return n;
  }
  function meterPct(wpm) {
    return Math.max(0, Math.min(100, (Number(wpm) - 50) / 80 * 100));
  }

  JU.registerGame('reading', {
    id: 'speed',
    title: 'Reading Speed',
    emoji: '\uD83D\uDCD6',
    blurb: 'One word at a time, then a one-minute read-aloud.',
    ownRound: true,
    async play(ctx) {
      const stage = ctx.stage;
      const main = document.querySelector('main.page');
      if (main) main.classList.add('wide', 'rs-main');
      let pack = null;
      try { pack = await JU.reading.load(); }
      catch (e) {
        stage.replaceChildren(h('div', { class: 'card center' },
          h('h2', null, 'Hmm.'),
          h('p', { class: 'lead' }, 'The passages did not load. Please tell a grown-up.'),
          h('a', { class: 'btn primary', href: 'child.html' }, 'Back to games')));
        return;
      }
      const bench = pack.benchmarks;
      let saved = { rounds: [], flashWpm: 60, smoothStreak: 0, smoothAt: 60 };
      try { saved = await JU.storage.getReading(); } catch (e) { /* keep defaults */ }

      function remember(partial) {
        saved = Object.assign({}, saved, partial);
        return JU.storage.setReadingPrefs({
          flashWpm: saved.flashWpm,
          smoothStreak: saved.smoothStreak,
          smoothAt: saved.smoothAt
        }).then(m => { saved = m; return m; }).catch(() => saved);
      }

      function showPicker() {
        currentPassage = null;
        JU.reading.flash = null;
        const rounds = saved.rounds || [];
        const last = latestRound(rounds);
        const best = bestWpm(rounds);
        const goal = bench.goal;
        const toGo = last ? Math.max(0, goal - last.wpm) : null;
        const ticks = [
          { cls: 'mk-start', wpm: bench.start },
          { cls: 'mk-school', wpm: bench.school },
          { cls: 'mk-goal', wpm: bench.goal }
        ];
        const meter = h('div', { class: 'rs-meter', id: 'rs-meter' },
          h('div', { class: 'rs-meter-fill', style: { width: (last ? meterPct(last.wpm) : 0) + '%' } }));
        ticks.forEach(t => meter.appendChild(h('span', { class: 'rs-tick ' + t.cls, style: { left: meterPct(t.wpm) + '%' } })));
        if (last) meter.appendChild(h('span', { class: 'rs-tick mk-latest', style: { left: meterPct(last.wpm) + '%' } }));
        const legendBits = [
          ['mk-start', 'Start ' + bench.start],
          ['mk-school', 'School ' + bench.school]
        ];
        if (last) legendBits.push(['mk-latest', 'Latest ' + last.wpm]);
        legendBits.push(['mk-goal', 'Goal ' + bench.goal]);
        const openProgress = h('button', { class: 'btn', type: 'button', id: 'rs-open-progress' }, 'My progress');
        openProgress.addEventListener('click', () => showProgress(false));
        const cards = pack.passages.map(p => {
          const mine = bestFor(rounds, p.id);
          const featured = last && last.passageId === p.id;
          const btn = h('button', {
            class: 'rs-pcard' + (featured ? ' is-featured' : '') + (mine == null ? ' is-new' : ''),
            type: 'button',
            'data-id': p.id,
            'data-words': String(p.wordCount),
            'data-best': mine == null ? '' : String(mine)
          },
            h('div', { class: 'rs-pemoji', 'aria-hidden': 'true' }, p.emoji),
            h('div', { class: 'rs-ptitle' }, p.title),
            h('div', { class: 'rs-pmeta' }, p.wordCount + ' words'),
            h('div', { class: 'rs-pblurb' }, p.blurb),
            mine == null
              ? h('div', { class: 'rs-pbest is-empty' }, 'Not played yet')
              : h('div', { class: 'rs-pbest' }, 'Best: ' + mine + ' wpm', h('span', { class: 'rs-pstars' }, JU.reading.starText(JU.reading.stars(mine)))));
          btn.addEventListener('click', () => showFlash(p));
          return btn;
        });
        stage.replaceChildren(h('div', { class: 'rs-screen', id: 'rs-picker' },
          h('section', { class: 'rs-goal', id: 'rs-goal' },
            h('div', { class: 'rs-goal-left' },
              h('div', { class: 'rs-kicker' }, (JU.config.childName || 'Reader') + '\u2019s reading'),
              h('div', { class: 'rs-goal-title' }, 'Pick a passage'),
              h('div', { class: 'rs-goal-sub' }, pack.unit)),
            h('div', { class: 'rs-goal-stat' },
              last
                ? h('div', { class: 'rs-goal-num', id: 'rs-latest' }, String(last.wpm), h('span', null, ' wpm latest'))
                : h('div', { class: 'rs-goal-num', id: 'rs-latest' }, String(goal), h('span', null, ' wpm goal')),
              h('div', { class: 'rs-to-go', id: 'rs-to-go' }, last ? (toGo === 0 ? 'Goal reached!' : toGo + ' to go to ' + goal) : 'Goal ' + goal)),
            h('div', { class: 'rs-meter-wrap' },
              h('div', { class: 'rs-meter-label' }, 'Words correct per minute'),
              meter,
              h('div', { class: 'rs-legend' }, legendBits.map(b => h('span', null, h('i', { class: b[0] }), ' ' + b[1]))))),
          h('div', { class: 'rs-passages', id: 'rs-passages' }, cards),
          h('p', { class: 'rs-pick-note' }, 'Tap a card to practice. Flash first, then a one-minute read-aloud.'),
          h('div', { class: 'row center' }, openProgress)));
      }

      function showFlash(passage) {
        currentPassage = passage;
        const tokens = passage.tokens;
        let index = 0;
        let dirty = false;
        let alive = true;
        let timer = 0;
        let wpm = JU.reading.snapWpm(saved.flashWpm, 60);
        let streak = saved.smoothStreak || 0;
        let smoothAt = JU.reading.snapWpm(saved.smoothAt, wpm);

        const wordEl = h('p', { class: 'rs-word', id: 'rs-word' });
        const stateEl = h('p', { class: 'rs-state', id: 'rs-state' });
        const posEl = h('span', { id: 'rs-pos' });
        const pctEl = h('span', { id: 'rs-pct' });
        const fillEl = h('span', { id: 'rs-bar-fill' });
        const card = h('section', { class: 'rs-word-card', id: 'rs-word-card', role: 'button', tabindex: '0', 'aria-label': 'Current word. Tap to pause or resume.' },
          wordEl, stateEl,
          h('div', { class: 'rs-progress' },
            h('div', { class: 'rs-progress-meta' }, posEl, pctEl),
            h('div', { class: 'rs-bar', id: 'rs-bar' }, fillEl)));
        const backBtn = h('button', { class: 'btn', type: 'button', id: 'rs-back' }, '\u27F2 Back a phrase');
        const pauseBtn = h('button', { class: 'btn primary', type: 'button', id: 'rs-pause' }, 'Pause');
        const readyBtn = h('button', { class: 'btn primary rs-ready', type: 'button', id: 'rs-ready' }, 'Ready');
        const countEl = countBox();
        const nudge = h('div', { class: 'rs-nudge', id: 'rs-nudge', hidden: true });
        const speedNum = h('span', { id: 'rs-speed-num' }, String(wpm));
        const slider = h('input', { type: 'range', id: 'rs-wpm', min: '40', max: '200', step: '5', value: String(wpm), 'aria-label': 'Speed in words per minute, 40 to 200' });
        const toRead = h('button', { class: 'btn', type: 'button', id: 'rs-to-read' }, 'Start read-aloud');
        const toPassages = h('button', { class: 'btn', type: 'button', id: 'rs-to-passages' }, 'Passages');
        const root = h('div', { class: 'rs-screen rs-flash', id: 'rs-flash', 'data-paused': '0', 'data-phase': 'ready', 'data-counting': '0' },
          h('div', { class: 'rs-flash-top' },
            h('div', { class: 'rs-hud-bit' }, h('span', { class: 'rs-hud-l' }, 'Passage'), h('span', { class: 'rs-hud-v rs-hud-title' }, passage.title)),
            h('div', { class: 'rs-flash-name' },
              h('div', { class: 'rs-kicker' }, 'One word at a time \u00b7 eyes on the red letter'),
              h('h2', null, 'Flash practice')),
            h('div', { class: 'rs-hud-bit' }, h('span', { class: 'rs-hud-l' }, 'Speed'), h('span', { class: 'rs-hud-v', id: 'rs-speed-hud' }, wpm + ' wpm'))),
          card,
          h('section', { class: 'rs-controls' },
            h('div', { class: 'rs-ctrl' }, backBtn, toPassages),
            h('div', { class: 'rs-speed' },
              h('div', { class: 'rs-speed-title' }, 'Speed: ', speedNum, ' wpm'),
              h('div', { class: 'rs-speed-row' },
                h('label', { for: 'rs-wpm' }, '40'),
                slider,
                h('label', { class: 'end' }, '200'))),
            h('div', { class: 'rs-ctrl rs-ctrl-end' }, pauseBtn, readyBtn, nudge, toRead)),
          countEl);

        let gate = 'ready';
        let countTimer = 0;
        function waitMs() {
          const factor = (typeof window.__JU_RS_FLASH_FACTOR === 'number') ? window.__JU_RS_FLASH_FACTOR : 1;
          return Math.max(0, Math.round(JU.reading.delayMs(tokens[index] || '', wpm) * factor));
        }
        function paintSpeed() {
          speedNum.textContent = String(wpm);
          const hud = root.querySelector('#rs-speed-hud');
          if (hud) hud.textContent = wpm + ' wpm';
          const span = 160;
          const pct = Math.round((wpm - 40) / span * 100);
          slider.style.background = 'linear-gradient(to right, var(--teal) 0 ' + pct + '%, var(--sand) ' + pct + '% 100%)';
          const suggest = (streak >= 2 && wpm === smoothAt && wpm < 200) ? ('\u2B50 Level up? Try ' + (wpm + 5) + '!') : '';
          nudge.textContent = suggest;
          nudge.hidden = !suggest;
        }
        function paint() {
          const token = tokens[index] || '';
          const parts = JU.reading.focusParts(token);
          wordEl.dataset.i = String(index);
          wordEl.replaceChildren(
            h('span', { class: 'rs-before' }, parts.before),
            h('span', { class: 'rs-focus', id: 'rs-focus' }, parts.focus),
            h('span', { class: 'rs-after' }, parts.after));
          const n = index + 1, total = tokens.length;
          const pct = total ? Math.round(100 * n / total) : 0;
          posEl.textContent = 'Word ' + n + ' of ' + total;
          pctEl.textContent = pct + '% through';
          fillEl.style.width = pct + '%';
          stateEl.textContent = gate === 'pause' ? 'Paused' : (gate === 'ready' ? 'Tap Ready' : '');
          pauseBtn.hidden = gate === 'ready' || gate === 'count';
          readyBtn.hidden = gate !== 'ready';
          pauseBtn.textContent = gate === 'pause' ? '\u25B6 Resume' : '\u275A\u275A Pause';
          root.dataset.paused = gate === 'pause' ? '1' : '0';
          root.dataset.phase = gate;
          root.dataset.counting = gate === 'count' ? '1' : '0';
          paintSpeed();
        }
        function arm() {
          clearTimeout(timer);
          if (!alive || gate !== 'run') return;
          timer = setTimeout(() => {
            if (!alive || gate !== 'run') return;
            if (index >= tokens.length - 1) { finishRun(); return; }
            index += 1;
            paint();
            arm();
          }, waitMs());
        }
        function showCount(steps, onDone) {
          clearTimeout(countTimer);
          gate = 'count';
          paint();
          let i = 0;
          function step() {
            if (!alive || !root.isConnected || gate !== 'count') return;
            if (i >= steps.length) {
              countEl.hidden = true;
              onDone();
              return;
            }
            const label = steps[i];
            countEl.hidden = false;
            countEl.dataset.step = label;
            countEl.querySelector('.rs-count-num').textContent = label;
            countBeep(label === 'Go!');
            i += 1;
            countTimer = setTimeout(step, countMs());
          }
          step();
        }
        function beginRun() {
          if (!alive) return;
          gate = 'run';
          paint();
          arm();
        }
        function togglePause() {
          if (!alive || gate === 'ready' || gate === 'count') return;
          if (gate === 'run') {
            gate = 'pause';
            dirty = true;
            clearTimeout(timer);
            paint();
            return;
          }
          showCount(['3', '2', '1'], beginRun);
        }
        function finishRun() {
          if (!alive) return;
          alive = false;
          clearTimeout(timer);
          clearTimeout(countTimer);
          JU.reading.flash = null;
          const clean = !dirty;
          if (clean) {
            if (wpm !== smoothAt) streak = 1;
            else streak += 1;
          } else streak = 0;
          smoothAt = wpm;
          dirty = false;
          remember({ flashWpm: wpm, smoothStreak: streak, smoothAt: smoothAt });
          const suggest = (streak >= 2 && wpm < 200) ? ('\u2B50 Level up? Try ' + (wpm + 5) + '!') : '';
          const again = h('button', { class: 'btn', type: 'button', id: 'rs-flash-again' }, 'Flash again');
          const read = h('button', { class: 'btn primary', type: 'button', id: 'rs-to-read' }, 'Start read-aloud');
          const back = h('button', { class: 'btn', type: 'button', id: 'rs-to-passages' }, 'Passages');
          again.addEventListener('click', () => showFlash(passage));
          read.addEventListener('click', () => showRead(passage));
          back.addEventListener('click', () => showPicker());
          stage.replaceChildren(h('div', { class: 'card center rs-flash-done', id: 'rs-flash-done' },
            h('div', { class: 'rs-bigstar', 'aria-hidden': 'true' }, streak >= 2 ? '\u2B50' : '\uD83D\uDCD6'),
            h('h2', null, clean ? 'Smooth!' : 'Nice practice!'),
            h('p', { class: 'lead' }, 'You flashed every word of ' + passage.title + '.'),
            suggest ? h('div', { class: 'rs-nudge', id: 'rs-nudge' }, suggest) : h('div', { class: 'rs-nudge', id: 'rs-nudge', hidden: true }),
            h('p', { class: 'note' }, 'Next is the one-minute read-aloud. A grown-up keeps score.'),
            h('div', { class: 'row' }, read, again, back)));
          read.focus();
        }
        card.addEventListener('click', () => { if (gate === 'run' || gate === 'pause') togglePause(); });
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePause(); }
        });
        pauseBtn.addEventListener('click', e => { e.stopPropagation(); togglePause(); });
        readyBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (!alive || gate !== 'ready') return;
          showCount(['3', '2', '1', 'Go!'], beginRun);
        });
        backBtn.addEventListener('click', () => {
          if (!alive || gate === 'ready' || gate === 'count') return;
          dirty = true;
          index = JU.reading.phraseBack(tokens, index);
          paint();
          if (gate === 'run') arm();
        });
        slider.addEventListener('input', () => {
          wpm = JU.reading.snapWpm(slider.value, wpm);
          slider.value = String(wpm);
          paintSpeed();
          remember({ flashWpm: wpm, smoothStreak: streak, smoothAt: smoothAt });
          if (gate === 'run') arm();
        });
        toRead.addEventListener('click', () => { alive = false; clearTimeout(timer); clearTimeout(countTimer); JU.reading.flash = null; showRead(passage); });
        toPassages.addEventListener('click', () => { alive = false; clearTimeout(timer); clearTimeout(countTimer); JU.reading.flash = null; showPicker(); });

        JU.reading.flash = {
          jump(i) {
            if (!alive || gate === 'count') return;
            index = Math.max(0, Math.min(tokens.length - 1, i | 0));
            paint();
            if (gate === 'run') arm();
          },
          index() { return index; }
        };
        stage.replaceChildren(root);
        paint();
      }

      function showRead(passage) {
        currentPassage = passage;
        JU.reading.flash = null;
        const tokens = passage.tokens;
        const misses = new Set();
        let phase = 'wait';
        let chosen = false;
        let scoreMs = JU.reading.READ_MS;
        let early = false;
        let t0 = 0;
        let tickTimer = 0;
        let countTimer = 0;
        let live = true;
        function limit() {
          const n = window.__JU_RS_READ_MS;
          return (typeof n === 'number' && n > 0) ? n : JU.reading.READ_MS;
        }
        const timeEl = h('span', { class: 'rs-hud-v rs-time', id: 'rs-time' }, '1:00');
        const prompt = h('div', { class: 'rs-end-prompt', id: 'rs-prompt' }, 'Tap Ready. She starts after Go.');
        const hint = h('p', { class: 'rs-end-hint', id: 'rs-end-hint' }, 'The timer does not stop when you tap a word. Tap again to undo a red word. Score = words read up to the last word, minus the red ones.');
        const done = h('button', { class: 'btn primary', type: 'button', id: 'rs-done', hidden: true }, 'Done');
        const ready = h('button', { class: 'btn primary rs-ready', type: 'button', id: 'rs-ready' }, 'Ready');
        const countEl = countBox();
        const passageEl = h('div', { class: 'rs-passage', id: 'rs-passage' });
        passage.paras.forEach(para => {
          const p = h('p', null);
          para.words.forEach((word, k) => {
            const i = para.start + k;
            const b = h('button', { class: 'rs-tok', type: 'button', 'data-i': String(i) }, word);
            p.appendChild(b);
            if (k < para.words.length - 1) p.appendChild(document.createTextNode(' '));
          });
          passageEl.appendChild(p);
        });
        function paintTime(leftMs) {
          const s = Math.ceil(Math.max(0, leftMs) / 1000);
          const m = Math.floor(s / 60), r = s % 60;
          timeEl.textContent = m + ':' + (r < 10 ? '0' : '') + r;
          timeEl.classList.toggle('low', s <= 10 && phase === 'mark');
          timeEl.setAttribute('aria-label', s + ' seconds left');
        }
        function showCount(steps, onDone) {
          clearTimeout(countTimer);
          phase = 'count';
          root.dataset.phase = 'count';
          root.dataset.counting = '1';
          ready.hidden = true;
          prompt.textContent = 'Get ready.';
          let i = 0;
          function step() {
            if (!live || !root.isConnected || phase !== 'count') return;
            if (i >= steps.length) {
              countEl.hidden = true;
              root.dataset.counting = '0';
              onDone();
              return;
            }
            const label = steps[i];
            countEl.hidden = false;
            countEl.dataset.step = label;
            countEl.querySelector('.rs-count-num').textContent = label;
            countBeep(label === 'Go!');
            i += 1;
            countTimer = setTimeout(step, countMs());
          }
          step();
        }
        function startClock() {
          if (!live || phase === 'mark') return;
          phase = 'mark';
          root.dataset.phase = 'mark';
          root.dataset.running = '1';
          root.dataset.counting = '0';
          t0 = Date.now();
          done.hidden = false;
          ready.hidden = true;
          prompt.textContent = 'She keeps reading. Tap a missed word.';
          tickTimer = setInterval(tick, 100);
        }
        function tick() {
          if (phase !== 'mark') return;
          const ms = Date.now() - t0;
          const left = Math.max(0, limit() - ms);
          timeEl.dataset.elapsed = String(ms);
          timeEl.dataset.stopped = '0';
          timeEl.dataset.early = '0';
          paintTime(left);
          if (left <= 0) finishClock(false);
        }
        function finishClock(byButton) {
          if (phase !== 'mark') return;
          clearInterval(tickTimer);
          const ms = Date.now() - t0;
          const lim = limit();
          const completed = !byButton || ms >= lim;
          phase = 'last';
          early = !completed;
          scoreMs = completed ? JU.reading.READ_MS : Math.max(1, ms);
          timeEl.dataset.stopped = '1';
          timeEl.dataset.elapsed = String(ms);
          timeEl.dataset.scoreMs = String(scoreMs);
          timeEl.dataset.early = early ? '1' : '0';
          paintTime(completed ? 0 : Math.max(0, lim - ms));
          done.hidden = true;
          prompt.textContent = completed ? 'Time\u2019s up! Tap the last word she read' : 'Tap the last word she read';
          hint.textContent = 'The gold word will be the last one she reached. The timer has stopped, so tapping does not change her time.';
        }
        function chooseLast(i) {
          if (phase !== 'last' || chosen) return;
          chosen = true;
          const wordsRead = i + 1;
          const missIdx = [...misses].filter(n => n <= i).sort((a, b) => a - b);
          const missWords = missIdx.map(n => JU.reading.normWord(tokens[n])).filter(Boolean);
          const sc = JU.reading.score(wordsRead, missIdx.length, scoreMs);
          const prevBest = bestWpm(saved.rounds);
          const isNew = sc.wpm > prevBest && sc.wpm > 0;
          const row = {
            passageId: passage.id,
            passageTitle: passage.title,
            wpm: sc.wpm,
            accuracy: sc.accuracy,
            wordsRead: sc.wordsRead,
            misses: sc.misses,
            seconds: Math.max(1, Math.round(scoreMs / 1000)),
            early: early,
            missWords: missWords,
            compCorrect: 0,
            compTotal: 0
          };
          JU.storage.addReadingRound(row).then(savedRow => {
            saved = Object.assign({}, saved, { rounds: (saved.rounds || []).concat([savedRow]) });
            showResults(passage, sc, early, scoreMs, isNew, savedRow.id);
          }).catch(() => showResults(passage, sc, early, scoreMs, isNew, ''));
        }
        passageEl.addEventListener('click', e => {
          const btn = e.target.closest('.rs-tok');
          if (!btn) return;
          const i = Number(btn.dataset.i);
          if (phase === 'mark') {
            if (misses.has(i)) { misses.delete(i); btn.classList.remove('is-miss'); btn.setAttribute('aria-pressed', 'false'); }
            else { misses.add(i); btn.classList.add('is-miss'); btn.setAttribute('aria-pressed', 'true'); }
          } else if (phase === 'last') {
            btn.classList.add('is-last');
            chooseLast(i);
          }
        });
        done.addEventListener('click', () => finishClock(true));
        const root = h('div', { class: 'rs-screen rs-read', id: 'rs-read', 'data-passage': passage.id, 'data-running': '0', 'data-counting': '0', 'data-phase': 'wait' },
          h('div', { class: 'rs-read-hud' },
            h('div', null,
              h('div', { class: 'rs-kicker' }, 'Read-aloud check'),
              h('div', { class: 'rs-goal-title' }, passage.title)),
            h('div', { class: 'rs-grownup' }, 'Grown-up: tap missed words. Tap again to undo.'),
            h('div', { class: 'rs-timer-bit' }, h('span', { class: 'rs-hud-l' }, 'Time left'), timeEl)),
          h('div', { class: 'rs-read-layout' },
            passageEl,
            h('aside', { class: 'rs-end', id: 'rs-end' },
              h('div', { class: 'rs-end-kicker' }, 'When she stops'),
              h('h3', null, 'Next step'),
              prompt,
              ready,
              done,
              hint)),
          countEl);
        ready.addEventListener('click', () => {
          if (!live || phase !== 'wait') return;
          showCount(['3', '2', '1', 'Go!'], startClock);
        });
        stage.replaceChildren(root);
        paintTime(limit());
        timeEl.dataset.elapsed = '0';
        timeEl.dataset.stopped = '0';
        timeEl.dataset.early = '0';
      }

      function showResults(passage, sc, early, scoreMs, isNew, roundId) {
        const questions = passage.questions || [];
        let qi = 0, compOk = 0, locked = false, live = true;
        const wpmEl = h('div', { class: 'rs-stat-n', id: 'rs-wpm-num' }, String(sc.wpm));
        const accEl = h('div', { class: 'rs-stat-n', id: 'rs-accuracy' }, sc.accuracy + '%');
        const newEl = h('div', { class: 'rs-new-best', id: 'rs-new-best', hidden: !isNew }, isNew ? 'New best!' : '');
        const starsEl = h('div', { class: 'rs-stars', id: 'rs-stars' }, JU.reading.starText(JU.reading.stars(sc.wpm)));
        const compEl = h('p', { class: 'rs-comp', id: 'rs-comp', hidden: true });
        const again = h('button', { class: 'btn primary', type: 'button', id: 'rs-again' }, 'Play again');
        const back = h('button', { class: 'btn', type: 'button', id: 'rs-to-passages' }, 'Back to passages');
        const see = h('button', { class: 'btn', type: 'button', id: 'rs-see-progress' }, 'See progress');
        const qBox = h('section', { class: 'rs-q', id: 'rs-q' });
        const scoreCard = h('section', { class: 'rs-score', id: 'rs-score' },
          h('div', { class: 'rs-bigstar', 'aria-hidden': 'true' }, isNew ? '\uD83C\uDF1F' : '\uD83D\uDCD6'),
          h('h2', null, 'Nice reading!'),
          h('p', { class: 'rs-score-lead', id: 'rs-score-lead' }, passage.title + ' \u00b7 ' + sc.wordsRead + ' words in ' + JU.reading.clock(scoreMs) + ', minus ' + sc.misses + (sc.misses === 1 ? ' miss' : ' misses')),
          h('div', { class: 'rs-score-row' },
            h('div', { class: 'rs-stat' }, wpmEl, h('div', { class: 'rs-stat-l' }, 'words correct per minute')),
            h('div', { class: 'rs-stat' }, accEl, h('div', { class: 'rs-stat-l' }, 'accuracy'))),
          newEl, starsEl, compEl,
          h('div', { class: 'rs-score-actions' }, again, back, see));
        const root = h('div', { class: 'rs-screen rs-results', id: 'rs-results' }, scoreCard, qBox);
        root.dataset.wpm = String(sc.wpm);
        root.dataset.accuracy = String(sc.accuracy);
        root.dataset.words = String(sc.wordsRead);
        root.dataset.misses = String(sc.misses);
        root.dataset.elapsed = String(sc.elapsed);
        root.dataset.early = early ? '1' : '0';
        root.dataset.comp = '';

        function renderQ() {
          locked = false;
          const q = questions[qi];
          if (!q) { finishQuiz(); return; }
          const letters = ['A', 'B', 'C', 'D'];
          const kicker = h('div', { class: 'rs-q-kicker', id: 'rs-q-kicker' }, 'Question ' + (qi + 1) + ' of ' + questions.length);
          const promptEl = h('p', { class: 'rs-q-prompt', id: 'rs-q-prompt' }, q.prompt);
          const note = h('p', { class: 'rs-q-note', id: 'rs-q-note' }, 'Three short questions, so speed does not crowd out meaning.');
          const choices = q.choices.map((text, i) => {
            const b = h('button', { class: 'rs-choice', type: 'button', 'data-i': String(i) },
              h('span', { class: 'rs-letter' }, letters[i] || String(i + 1)),
              h('span', null, text));
            b.addEventListener('click', () => pick(i, b, note));
            return b;
          });
          qBox.replaceChildren(kicker, h('h3', null, 'Quick check'), promptEl, ...choices, note);
        }
        function pick(i, btn, note) {
          if (locked) return;
          const q = questions[qi];
          if (!q) return;
          locked = true;
          const ok = i === q.answer;
          if (ok) compOk += 1;
          btn.classList.add(ok ? 'is-right' : 'is-try');
          note.textContent = ok ? 'Yes! That is in the story.' : 'Good try. The story says something else.';
          const wait = (typeof window.__JU_RS_Q_MS === 'number') ? window.__JU_RS_Q_MS : 800;
          setTimeout(() => {
            if (!live) return;
            qi += 1;
            if (qi >= questions.length) finishQuiz();
            else renderQ();
          }, wait);
        }
        function finishQuiz() {
          if (!live) return;
          const total = questions.length;
          compEl.hidden = false;
          compEl.textContent = 'Comprehension ' + compOk + '/' + total;
          root.dataset.comp = compOk + '/' + total;
          qBox.replaceChildren(h('div', { class: 'rs-q-kicker' }, 'All done'),
            h('h3', null, 'You thought about the story'),
            h('p', { class: 'rs-q-prompt' }, compOk + ' of ' + total + ' questions.'),
            h('p', { class: 'rs-q-note' }, 'Speed and meaning both count.'));
          if (roundId) {
            JU.storage.patchReadingRound(roundId, { compCorrect: compOk, compTotal: total }).then(m => {
              if (m) saved = m;
            }).catch(() => {});
          }
        }
        again.addEventListener('click', () => { live = false; showFlash(passage); });
        back.addEventListener('click', () => { live = false; showPicker(); });
        see.addEventListener('click', () => { live = false; showProgress(isNew); });
        stage.replaceChildren(root);
        if (questions.length) renderQ();
        else finishQuiz();
      }

      function showProgress(justNew) {
        JU.reading.flash = null;
        const rounds = (saved.rounds || []).slice().sort((a, b) => a.ts < b.ts ? -1 : 1);
        const last = rounds.length ? rounds[rounds.length - 1] : null;
        const best = bestWpm(rounds);
        const fresh = !!(last && last.wpm > 0 && last.wpm === best && rounds.slice(0, -1).every(r => r.wpm < last.wpm));
        const showNew = fresh || (!!justNew && last && last.wpm > 0 && last.wpm >= best);
        const back = h('button', { class: 'btn', type: 'button', id: 'rs-to-passages' }, 'Back to passages');
        back.addEventListener('click', () => showPicker());
        const name = JU.config.childName || 'Reader';
        stage.replaceChildren(h('div', { class: 'rs-screen rs-progress', id: 'rs-progress' },
          h('section', { class: 'rs-chart-card' },
            h('h2', null, name + '\u2019s words per minute'),
            h('p', { class: 'rs-chart-sub' }, 'Words correct per minute on the read-aloud. Dashed lines mark her start, her school score, and the ' + bench.goal + ' goal.'),
            h('div', { class: 'rs-legend', id: 'rs-chart-legend' },
              h('span', null, h('i', { class: 'mk-start' }), ' Start ' + bench.start),
              h('span', null, h('i', { class: 'mk-school' }), ' School ' + bench.school),
              h('span', null, h('i', { class: 'mk-goal' }), ' Goal ' + bench.goal)),
            showNew ? h('div', { class: 'rs-new-best', id: 'rs-chart-new' }, 'New best!') : h('div', { class: 'rs-new-best', id: 'rs-chart-new', hidden: true }, ''),
            h('div', { class: 'rs-stars', id: 'rs-chart-stars' }, best > 0 ? JU.reading.starText(JU.reading.stars(best)) : ''),
            buildChart(rounds, bench),
            rounds.length ? null : h('p', { class: 'rs-chart-empty', id: 'rs-chart-empty' }, 'Your dots will show up after a read-aloud.')),
          h('div', { class: 'row center' }, back)));
      }

      showPicker();
    }
  });

  function buildChart(rounds, bench) {
    const S = JU.ui.svg;
    const vals = rounds.map(r => r.wpm).concat([bench.start, bench.school, bench.goal]);
    let lo = 40, hi = 130;
    vals.forEach(v => {
      if (v < lo) lo = Math.floor(v / 10) * 10;
      if (v > hi) hi = Math.ceil(v / 10) * 10;
    });
    if (hi <= lo) hi = lo + 10;
    const W = 640, H = 360, left = 64, right = 16, top = 28, bottom = 46;
    const plotW = W - left - right, plotH = H - top - bottom, base = top + plotH;
    const yOf = wpm => base - ((wpm - lo) / (hi - lo)) * plotH;
    const xOf = i => rounds.length <= 1 ? left + plotW / 2 : left + (plotW * i / (rounds.length - 1));
    const kids = [];
    const ticks = [];
    for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += 20) ticks.push(t);
    if (ticks.indexOf(lo) < 0) ticks.unshift(lo);
    ticks.forEach(t => {
      const y = yOf(t);
      kids.push(S('line', { x1: left, y1: y, x2: W - right, y2: y, stroke: '#efe9da', 'stroke-width': 1 }));
      kids.push(S('text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'rs-ax' }, String(t)));
    });
    kids.push(S('line', { x1: left, y1: base, x2: W - right, y2: base, stroke: '#d9d3c4', 'stroke-width': 2 }));
    kids.push(S('line', { x1: left, y1: top, x2: left, y2: base, stroke: '#d9d3c4', 'stroke-width': 2 }));
    [
      ['start', bench.start, '#5b6b78'],
      ['school', bench.school, '#1663d6'],
      ['goal', bench.goal, '#e06c00']
    ].forEach(ref => {
      const y = yOf(ref[1]);
      kids.push(S('line', {
        x1: left, y1: y, x2: W - right, y2: y,
        stroke: ref[2], 'stroke-width': ref[0] === 'goal' ? 2.25 : 1.75,
        'stroke-dasharray': '6 5',
        'data-ref': ref[0],
        'data-wpm': String(ref[1])
      }));
    });
    if (rounds.length) {
      const pts = rounds.map((r, i) => [xOf(i), yOf(r.wpm)]);
      if (pts.length >= 2) {
        const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
        const area = line + ' L' + pts[pts.length - 1][0] + ',' + base + ' L' + pts[0][0] + ',' + base + ' Z';
        kids.push(S('path', { d: area, fill: 'rgba(43,138,138,0.16)' }));
        kids.push(S('path', { d: line, fill: 'none', stroke: '#2b8a8a', 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
      rounds.forEach((r, i) => {
        const x = xOf(i), y = yOf(r.wpm);
        const last = i === rounds.length - 1;
        kids.push(S('circle', { class: 'rs-point', cx: x, cy: y, r: last ? 7 : 5.5, fill: last ? '#2b8a8a' : '#fff', stroke: '#2b8a8a', 'stroke-width': 3, 'data-wpm': String(r.wpm), 'data-i': String(i) }));
        if (last) kids.push(S('text', { x: x, y: y - 12, 'text-anchor': 'middle', class: 'rs-val' }, String(r.wpm)));
        const d = new Date(r.ts);
        const label = isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (rounds.length <= 8 || i === 0 || i === rounds.length - 1 || i % 2 === 0) {
          kids.push(S('text', { x: x, y: H - 16, 'text-anchor': 'middle', class: 'rs-ax' }, label));
        }
      });
    }
    const desc = 'Start ' + bench.start + ', school ' + bench.school + ', goal ' + bench.goal + '. ' +
      (rounds.length ? rounds.map(r => r.wpm + ' wpm').join(', ') : 'No scores yet.');
    return S('svg', { class: 'rs-chart', id: 'rs-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Line chart of words per minute over time. ' + desc }, ...kids);
  }
})();
