/* hints.js - the "Hear the word" hint in the puzzle games (Unscramble, Grow the Flower, Word Match, Clap the Beats) is earned.
   Listen and Type, the Test and Review are not gated: hearing the word is their whole point.

   Rules (one gate per word, made by ctx.hintGate(word) in runner.js):
   - The hint starts locked. Each wrong answer is "real" (counts) or "rapid" (does not count):
       rapid = it came within RAPID_MS of the word appearing or of her previous answer, or it repeats a wrong answer she already gave on this word.
   - (Clap's beat count allows the same wrong number twice; only timing counts there.)
   - After NEED real wrong answers the hint unlocks for THAT word only (the Slower button is the same hint).
     Rapid answers never unlock it; the button then says "Ask a grown-up for a hint".
   - At most CAP hints per game session. After that it stays locked (a grown-up can still unlock).
   - "Grown-up unlock" asks for the parent PIN (JU.auth.verifyParent) and unlocks the hint for that word.
   - Every hint use, grown-up unlock and rapid-miss flag is logged through JU.storage (separate from scores, in the backup file).
   - A word where the hint was used is recorded as not correct (see runner.js), so it is not treated as mastered.
   Money & Economics solo activities (js/money/solo.js) reuse this same gate with a small ctx of their own:
   { game: { id, hintGate: true }, week: { id }, subject: 'money', session, speakButton, hintNoun: 'question', store: <that child's storage> }, and a
   "word" { word: <question id>, say: <spoken clue> }.
   ctx.kid (Dorian, v10): the lock and the hint are picture buttons with no words on them; pressing the lock says "Ask a grown-up for a hint."
   gate.miss() returns true when that wrong answer opened the hint, so the page can say api.KID_READY. */
(function () {
  const h = JU.ui.h;
  const NEED = 2, RAPID_MS = 3000, CAP = 3, PIN_TRIES = 3, PIN_LOCK_MS = 30000;
  const api = { NEED, RAPID_MS, CAP, skew: 0 };
  /* what the voice says for Dorian (ctx.kid): the lock picture, and when a hint opens */
  api.KID_LOCKED = 'Ask a grown-up for a hint.';
  api.KID_CAPPED = 'That was three hints. Ask a grown-up for more.';
  api.KID_READY = 'A hint is ready. Tap the light bulb.';
  /* the clock the rules use (skew lets the tests move time forward) */
  api.now = () => Date.now() + api.skew;

  const LOCK = '\uD83D\uDD12', SPEAKER = '\uD83D\uDD0A', TURTLE = '\uD83D\uDC22';

  /* ctx: the game context from runner.js. w: the word object. label: text on the speaker button. */
  api.gate = function (ctx, w, label) {
    label = label || 'Hear the word';
    if (!ctx.game || !ctx.game.hintGate || !JU.speech.supported) {
      return { el: ctx.speakButton(w.word, label), miss() { }, close() { }, used: () => false, gated: false, word: w.word };
    }
    ctx.hintCount = ctx.hintCount || 0;
    ctx.pinFails = ctx.pinFails || 0;
    const st = { wrongs: [], earned: 0, flagged: false, unlocked: false, how: null, used: false, closed: false, capped: false, pin: false, pinMsg: '' };
    let last = api.now();
    const box = h('div', { class: 'hintbox' });

    function log(kind, extra) {
      const rec = Object.assign({ id: JU.ui.uid(), ts: new Date().toISOString(), session: ctx.session, week: ctx.week.id,
        subject: ctx.subject, game: ctx.game.id, word: w.word, kind }, extra || {});
      (ctx.store || JU.storage).addHint(rec).catch(e => console.error(e));     // ctx.store: another profile's storage (Dorian's solo activities)
    }

    function press(factor) {
      if (!st.unlocked || st.closed) return;
      if (!st.used) {
        st.used = true; ctx.hintCount++;
        log('hint', { earned: st.how === 'earned', how: st.how });
      }
      JU.speech.say(w.say || w.word, { factor });     // w.say: a spoken clue that is not the answer (Money solo activities)
    }

    function pinForm() {
      const input = h('input', { class: 'pinbox', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', 'aria-label': 'Grown-up PIN' });
      const msg = h('p', { class: 'note hint-pinmsg', role: 'status', 'aria-live': 'polite' }, st.pinMsg);
      const go = () => {
        if (ctx.pinFailUntil && Date.now() < ctx.pinFailUntil) { st.pinMsg = 'Too many tries. Please wait a little and ask again.'; msg.textContent = st.pinMsg; input.value = ''; return; }
        if (JU.auth.verifyParent(input.value.trim())) {
          ctx.pinFails = 0; st.pin = false; st.pinMsg = ''; st.unlocked = true; st.how = 'grownup';
          log('grownup'); render();
          const b = box.querySelector('[data-hint-hear]'); if (b) b.focus();
        } else {
          ctx.pinFails++;
          if (ctx.pinFails >= PIN_TRIES) { ctx.pinFails = 0; ctx.pinFailUntil = Date.now() + PIN_LOCK_MS; st.pinMsg = 'That PIN did not work. Please wait a little before trying again.'; }
          else st.pinMsg = 'That PIN did not work.';
          msg.textContent = st.pinMsg; input.value = ''; input.focus();
        }
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { st.pin = false; render(); } });
      return h('div', { class: 'pinform', role: 'group', 'aria-label': 'Grown-up unlock' },
        h('label', { class: 'pinlabel' }, 'Grown-up PIN ', input),
        h('div', { class: 'row center' },
          h('button', { class: 'btn small primary', type: 'button', 'data-hint-pin-go': '', onclick: go }, 'Unlock'),
          h('button', { class: 'btn small', type: 'button', onclick: () => { st.pin = false; st.pinMsg = ''; render(); } }, 'Cancel')),
        msg);
    }

    function render() {
      if (st.closed) { box.replaceChildren(); box.hidden = true; return; }
      if (st.unlocked && ctx.kid) {
        /* Dorian's version: pictures only. The voice says what is happening (see api.KID_READY), so there is no text to read. */
        box.dataset.state = 'open';
        box.replaceChildren(h('span', { class: 'speakers kid-speakers' },
          h('button', { class: 'btn round big hint-icon', type: 'button', 'data-hint-hear': '', 'aria-label': label, onclick: () => press(1) },
            h('span', { 'aria-hidden': 'true' }, '\uD83D\uDCA1')),
          h('button', { class: 'btn round big hint-icon', type: 'button', 'aria-label': 'Say it slower', onclick: () => press(0.7) },
            h('span', { 'aria-hidden': 'true' }, TURTLE))));
        return;
      }
      if (st.unlocked) {
        box.dataset.state = 'open';
        box.replaceChildren(h('span', { class: 'speakers' },
          h('button', { class: 'btn round', type: 'button', 'data-hint-hear': '', onclick: () => press(1) },
            h('span', { 'aria-hidden': 'true' }, SPEAKER), ' ', label),
          h('button', { class: 'btn small', type: 'button', 'aria-label': 'Say it slower', onclick: () => press(0.7) },
            h('span', { 'aria-hidden': 'true' }, TURTLE), ' Slower')),
          h('p', { class: 'note' }, 'Hint unlocked for this ' + (ctx.hintNoun || 'word') + ' only.'));
        return;
      }
      box.dataset.state = 'locked';
      if (ctx.kid) {
        /* a lock picture, no words; pressing it says what to do */
        const spoken = st.capped ? api.KID_CAPPED : api.KID_LOCKED;
        const kids = [h('button', { class: 'btn round big locked hint-icon', type: 'button', 'aria-label': spoken, 'data-hint-lock': '',
          onclick: () => { try { JU.speech.say(spoken); } catch (e) { /* no voice */ } } }, h('span', { 'aria-hidden': 'true' }, LOCK))];
        if (st.pin) kids.push(pinForm());
        else kids.push(h('button', { class: 'btn small ghost', type: 'button', 'data-hint-grownup': '', onclick: () => { st.pin = true; render(); const i = box.querySelector('input'); if (i) i.focus(); } }, 'Grown-up unlock'));
        box.replaceChildren(...kids);
        return;
      }
      let text = 'Hint unlocks after ' + NEED + ' tries';
      if (st.capped) text = 'That was ' + CAP + ' hints. Ask a grown-up for more';
      else if (st.flagged) text = 'Ask a grown-up for a hint';
      const kids = [h('button', { class: 'btn round locked', type: 'button', 'aria-disabled': 'true', 'data-hint-lock': '' },
        h('span', { 'aria-hidden': 'true' }, LOCK), ' ', text)];
      if (st.pin) kids.push(pinForm());
      else kids.push(h('button', { class: 'btn small ghost', type: 'button', 'data-hint-grownup': '', onclick: () => { st.pin = true; render(); const i = box.querySelector('input'); if (i) i.focus(); } }, 'Grown-up unlock'));
      box.replaceChildren(...kids);
    }

    const gate = {
      el: box, gated: true, word: w.word,
      used: () => st.used,
      /* call on every wrong answer; guess is any string that identifies it */
      miss(guess, opts) {
        if (st.closed) return false;
        const wasUnlocked = st.unlocked;
        const t = api.now(), key = String(guess);
        /* opts.repeatOk: repeating the same wrong answer is a natural mistake here (clapping the same wrong number), so only timing counts */
        const repeat = !(opts && opts.repeatOk) && st.wrongs.some(x => x.guess === key);
        const rapid = repeat || (t - last) < RAPID_MS;
        last = t;
        st.wrongs.push({ guess: key, rapid });
        if (rapid) { if (!st.flagged) { st.flagged = true; log('rapid'); } }
        else st.earned++;
        if (!st.unlocked && !st.capped && st.earned >= NEED) {
          if (ctx.hintCount >= CAP) st.capped = true; else { st.unlocked = true; st.how = 'earned'; }
        }
        const was = st.unlocked && !wasUnlocked;
        render();
        return was;       // true when this wrong answer is the one that opened the hint
      },
      close() { st.closed = true; render(); }
    };
    ctx.currentGate = gate;
    render();
    return gate;
  };

  JU.hints = api;
})();
