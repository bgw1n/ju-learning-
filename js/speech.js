/* speech.js - reads words aloud with the best English voice this device has (no new services, no network of our own).
   Picks a natural-sounding voice, speaks slowly, and lets a grown-up choose a different voice and speed
   (saved on this device through js/storage.js). */
(function () {
  const supported = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const DEFAULT_RATE = 0.85, MIN_RATE = 0.6, MAX_RATE = 1.1;
  const synth = supported ? window.speechSynthesis : null;

  /* ---- voice ranking ---- */
  const NATURAL = /natural|neural|online|enhanced|premium|siri/i;
  const NICE = /google us english|google uk english|samantha|ava\b|allison|aria|jenny|guy\b|zira|susan|karen|moira|tessa|serena|daniel/i;
  const BAD = /espeak|compact|novelty|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|trinoids|whisper|wobble|zarvox|superstar|fred\b|junior|ralph|kathy|grandma|grandpa|rocko|shelley|flo\b|eddy|reed|sandy/i;

  function score(v) {
    const name = v.name || '';
    let s = 0;
    if (!/^en([-_]|$)/i.test(v.lang || '')) return -1000;
    if (/^en[-_]US/i.test(v.lang)) s += 30; else if (/^en[-_](GB|AU|CA)/i.test(v.lang)) s += 10;
    if (NATURAL.test(name)) s += 100;
    if (NICE.test(name)) s += 60;
    if (BAD.test(name)) s -= 300;
    if (v.localService) s += 2;
    return s;
  }
  function englishVoices() {
    const all = supported ? synth.getVoices() : [];
    return all.filter(v => /^en([-_]|$)/i.test(v.lang || ''))
      .map((v, i) => ({ v, s: score(v), i }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map(x => x.v);
  }
  function isGood(v) { return !!v && score(v) >= 90; }
  const voiceId = v => v.voiceURI || (v.name + '|' + v.lang);

  /* ---- saved preferences ---- */
  let prefs = { voice: '', rate: DEFAULT_RATE };
  const prefsLoaded = (JU.storage && JU.storage.getVoicePrefs ? JU.storage.getVoicePrefs() : Promise.resolve(null))
    .then(p => { if (p) prefs = Object.assign(prefs, p); }).catch(() => { });
  function clampRate(r) { r = Number(r); return isFinite(r) ? Math.min(MAX_RATE, Math.max(MIN_RATE, r)) : DEFAULT_RATE; }

  function chosenVoice(preferLocal) {
    const list = englishVoices();
    if (preferLocal) return list.find(v => v.localService && score(v) > -100) || list[0] || null;
    if (prefs.voice) {
      const saved = list.find(v => voiceId(v) === prefs.voice);
      if (saved) return saved;
    }
    return list.find(v => score(v) > -100) || list[0] || null;
  }

  /* ---- waiting for the browser to list its voices (Chrome loads them a moment after the page) ---- */
  let waited = false;
  function ready() {
    if (!supported || waited || synth.getVoices().length) return Promise.all([prefsLoaded]);
    return new Promise(resolve => {
      const done = () => { waited = true; synth.removeEventListener && synth.removeEventListener('voiceschanged', done); resolve(); };
      if (synth.addEventListener) synth.addEventListener('voiceschanged', done);
      setTimeout(done, 1200);
    }).then(() => prefsLoaded);
  }
  if (supported && synth.addEventListener) synth.addEventListener('voiceschanged', () => { waited = true; });

  /* ---- speaking ---- */
  let token = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const api = { supported, lastUsed: null };

  function speakOnce(text, opts, myToken, retried) {
    return new Promise(resolve => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = Math.min(1.2, Math.max(0.4, clampRate(prefs.rate) * (opts.factor || 1)));
        u.pitch = 1; u.volume = 1;
        const v = chosenVoice(retried);
        if (v) { try { u.voice = v; } catch (e) { } }
        api.lastUsed = { text, voice: v ? v.name : null, rate: u.rate };
        let finished = false;
        const finish = () => { if (!finished) { finished = true; resolve(); } };
        u.onend = finish;
        u.onerror = ev => {
          /* a network voice can fail offline: try once more with a voice built into the device */
          if (!retried && v && v.localService === false && ev && ev.error !== 'canceled' && ev.error !== 'interrupted' && myToken === token) {
            finished = true; speakOnce(text, opts, myToken, true).then(resolve); return;
          }
          finish();
        };
        setTimeout(finish, 15000);
        synth.speak(u);
      } catch (e) { resolve(); }
    });
  }

  /* Says the text out loud. opts.factor multiplies the saved speed (0.7 = slower). Resolves when finished. */
  api.say = async function (text, opts) {
    opts = opts || {};
    if (!supported) return;
    const my = ++token;
    try { synth.cancel(); } catch (e) { }
    await ready();
    if (my !== token) return;
    await speakOnce(text, opts, my, false);
  };
  /* Dictation: the word, a short pause, the sentence (if there is one), a short pause, the word again. */
  api.dictate = async function (word, sentence, opts) {
    opts = opts || {};
    if (!supported) return;
    const my = ++token;
    try { synth.cancel(); } catch (e) { }
    await ready();
    if (my !== token) return;
    await speakOnce(word, opts, my, false);
    if (my !== token) return;
    if (sentence) {
      await sleep(550); if (my !== token) return;
      await speakOnce(sentence, opts, my, false);
      if (my !== token) return;
    }
    await sleep(550); if (my !== token) return;
    await speakOnce(word, opts, my, false);
  };
  /* Spells the word out one letter at a time, with a short pause between letters. */
  api.spell = function (word, opts) {
    const letters = String(word).toUpperCase().replace(/[^A-Z]/g, '').split('');
    return api.say(letters.join(', '), Object.assign({ factor: 0.8 }, opts || {}));
  };
  api.stop = function () { token++; if (supported) try { synth.cancel(); } catch (e) { } };

  /* ---- for the grown-up settings ---- */
  api.ready = ready;
  api.voices = englishVoices;
  api.voiceId = voiceId;
  api.isGood = isGood;
  api.selectedVoice = function () { return chosenVoice(false); };
  api.hasGoodVoice = function () { return englishVoices().some(isGood); };
  api.getPrefs = function () { return { voice: prefs.voice, rate: clampRate(prefs.rate) }; };
  api.setPrefs = async function (p) {
    prefs = { voice: p.voice != null ? p.voice : prefs.voice, rate: clampRate(p.rate != null ? p.rate : prefs.rate) };
    if (JU.storage && JU.storage.setVoicePrefs) await JU.storage.setVoicePrefs(prefs);
  };
  api.MIN_RATE = MIN_RATE; api.MAX_RATE = MAX_RATE; api.DEFAULT_RATE = DEFAULT_RATE;
  api.onVoicesChanged = function (fn) { if (supported && synth.addEventListener) synth.addEventListener('voiceschanged', fn); };

  JU.speech = api;
})();
