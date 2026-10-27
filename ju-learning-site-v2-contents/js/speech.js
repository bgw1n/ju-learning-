/* speech.js - reads words aloud with the browser's built-in voice (no network needed). */
(function () {
  const supported = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  function pickVoice() {
    const voices = supported ? speechSynthesis.getVoices() : [];
    return voices.find(v => /^en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
  }
  JU.speech = {
    supported,
    /* Says the text out loud. Resolves when finished (or after a safety timeout). */
    say(text, opts) {
      opts = opts || {};
      if (!supported) return Promise.resolve();
      return new Promise(resolve => {
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'en-US';
          u.rate = opts.rate || 0.8;
          const v = pickVoice();
          if (v) u.voice = v;
          const finish = () => resolve();
          u.onend = finish; u.onerror = finish;
          setTimeout(finish, 8000);
          speechSynthesis.speak(u);
        } catch (e) { resolve(); }
      });
    },
    stop() { if (supported) try { speechSynthesis.cancel(); } catch (e) { } }
  };
})();
