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
      h('button', { class: 'btn small', type: 'button', 'data-slower': '', 'aria-label': 'Say it slower', onclick: () => say(getText(), { factor: 0.7 }) },
        h('span', { 'aria-hidden': 'true' }, TURTLE), ' Slower'));
  }

  const ASKED = 'Thank you for asking! I saved a note for a grown-up. Please ask a grown-up about this now.';
  /* "Ask a grown-up": logs one flag per screen visit (profile, lesson, screen, time) and shows a friendly note.
     o: { profile, kind: 'lesson'|'solo', lesson, screen (1-based), save (false for a grown-up preview), kid }
     Returns { el, note } - put el in the nav row and note near the bottom. */
  function askButton(o) {
    let logged = false;
    const note = h('p', { class: 'ask-note', role: 'status', 'aria-live': 'polite', 'data-ask-note': '' });
    const el = h('button', { class: 'btn ask' + (o.kid ? ' big' : ''), type: 'button', 'data-ask': '', 'aria-label': 'Ask a grown-up', onclick: async () => {
      if (!logged && o.save !== false) {
        logged = true;
        try { await JU.money.flag(o.profile, o.kind, o.lesson, o.screen); } catch (e) { console.error(e); }
      }
      note.textContent = o.save === false ? 'Please ask a grown-up about this now. (Preview: no note was saved.)' : ASKED;
      if (o.kid) say(ASKED);
    } }, h('span', { 'aria-hidden': 'true' }, HAND), ' Ask a grown-up');
    return { el, note };
  }

  /* a token or coin pile that a screen reader can describe */
  JU.moneyUI = { say, stop, speakRow, askButton };
})();
