/* money/common.js - small pieces shared by the family lesson and the solo activities:
   the "hear it again" speaker row and the "Ask a grown-up" button. */
(function () {
  const h = JU.ui.h;
  const SPEAKER = '\uD83D\uDD0A', TURTLE = '\uD83D\uDC22', HAND = '\uD83D\uDE4B';

  /* Say something with the site's voice (the slower default; a grown-up can change it on the grown-up page). Never throws. */
  function say(text, opts) {
    try { return JU.speech.say(text, opts); } catch (e) { return Promise.resolve(); }
  }
  function stop() { try { JU.speech.stop(); } catch (e) { /* no voice on this device */ } }

  /* "Hear it again" + "Slower". getText() returns what to read now. Without a voice on the device, a short note instead. */
  function speakRow(getText, opts) {
    opts = opts || {};
    if (!JU.speech.supported) return h('p', { class: 'note', 'data-no-voice': '' }, 'Sound is not available on this browser. Ask a grown-up to read it to you.');
    return h('span', { class: 'speakers' + (opts.kid ? ' kid-speakers' : '') },
      h('button', { class: 'btn round' + (opts.kid ? ' big' : ''), type: 'button', 'data-hear': '', 'aria-label': 'Hear it again', onclick: () => say(getText(), { factor: 1 }) },
        h('span', { 'aria-hidden': 'true' }, SPEAKER), ' ', opts.kid ? '' : 'Hear it again'),
      h('button', { class: opts.kid ? 'btn round big' : 'btn small', type: 'button', 'data-slower': '', 'aria-label': 'Say it slower', onclick: () => say(getText(), { factor: 0.7 }) },
        h('span', { 'aria-hidden': 'true' }, TURTLE), opts.kid ? '' : ' Slower'));       // (Dorian: a turtle picture only)
  }

  const ASKED = 'Thank you for asking! I saved a note for a grown-up. Please ask a grown-up about this now.';
  /* "Ask a grown-up": logs one flag per screen visit (profile, lesson, screen, time) and shows a friendly note.
     o: { profile, kind: 'lesson'|'solo'|'kinder', lesson, screen (1-based), extra (optional more fields for the flag), save (false for a grown-up preview), kid }
     Returns { el, note } - put el in the nav row and note near the bottom. */
  function askButton(o) {
    let logged = false;
    const note = h('p', { class: 'ask-note', role: 'status', 'aria-live': 'polite', 'data-ask-note': '' });
    const el = h('button', { class: 'btn ask' + (o.kid ? ' big' : ''), type: 'button', 'data-ask': '', 'aria-label': 'Ask a grown-up', onclick: async () => {
      if (!logged && o.save !== false) {
        logged = true;
        try { await JU.money.flag(o.profile, o.kind, o.lesson, o.screen, o.extra); } catch (e) { console.error(e); }
      }
      note.textContent = o.save === false ? 'Please ask a grown-up about this now. (Preview: no note was saved.)' : ASKED;
      if (o.kid) say(o.save === false ? 'Please ask a grown-up about this now.' : ASKED);
    } }, h('span', { 'aria-hidden': 'true' }, HAND), o.kid ? '' : ' Ask a grown-up');       // Dorian: a hand picture only (the label is for screen readers)
    return { el, note };
  }

  /* After an answer: make sure the explanation (first) and the Next button (last) can both be seen without scrolling.
     Does nothing when they already are; otherwise scrolls just enough, smoothly (instantly for people who prefer reduced motion).
     If both do not fit on a short screen, the explanation is put at the top. */
  function reveal(first, last) {
    try {
      const a = first.getBoundingClientRect(), b = (last || first).getBoundingClientRect(), vh = window.innerHeight, pad = 12;
      if (a.top >= 0 && b.bottom <= vh) return;
      const dy = (b.bottom - a.top + 2 * pad > vh) ? a.top - pad : b.bottom + pad - vh;
      window.scrollBy({ top: dy, left: 0, behavior: JU.ui.reduced() ? 'auto' : 'smooth' });
    } catch (e) { /* the page still works without the nudge */ }
  }

  JU.moneyUI = { say, stop, speakRow, askButton, reveal };
})();
