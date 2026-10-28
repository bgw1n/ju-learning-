/* speech.js - reads words aloud with the best English voice this device has (no new services, no network of our own).
   Picks a natural-sounding voice, speaks slowly, and lets a grown-up choose a different voice and speed
   (saved on this device through js/storage.js).

   v11: recorded clips. Dorian's letter sounds and three-letter words are real audio files in audio/kinder/ (the voice reads "mmm" as a
   word or as letters, so a recording is the only way to get the true sound). A spoken text may hold markers:
       {{s:m|mmm}}   the clip for the sound of the letter m (audio/kinder/sound-m.mp3); "mmm" is what the voice says if the clip is missing
       {{w:cat|cat}} the clip for the word cat (audio/kinder/word-cat.mp3)
   JU.speech.say(text) plays the clips with HTMLAudio and speaks the rest of the sentence with the browser voice, in order. If a clip is not in
   audio/kinder/manifest.json, cannot load, or the browser refuses to play it, the fallback text is spoken instead.
   JU.speech.plain(text) turns markers into their fallback text, for anything shown on screen. Slower (factor under 0.8) plays clips at 0.75. */
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


  /* ---- recorded clips (v11) ---- */
  const CLIP_DIR = 'audio/kinder/';
  const MARK = /\{\{([sw]):([a-z]+)\|([^}]*)\}\}/g;
  let manifest = null, manifestP = null;
  const clipLog = [];
  let current = null;                                            // { audio, done } of the clip that is playing
  function loadManifest() {
    if (manifestP) return manifestP;
    manifestP = (typeof fetch === 'function' ? fetch(CLIP_DIR + 'manifest.json') : Promise.reject(new Error('no fetch')))
      .then(r => r.ok ? r.json() : null).then(m => { manifest = (m && m.clips) || {}; return manifest; }).catch(() => { manifest = {}; return manifest; });
    return manifestP;
  }
  const clipId = (kind, name) => (kind === 's' ? 'sound-' : 'word-') + name;
  function hasMarkers(text) { MARK.lastIndex = 0; const r = MARK.test(String(text)); MARK.lastIndex = 0; return r; }
  /* the text with every marker replaced by its fallback words (what is shown on screen) */
  function plain(text) { return String(text == null ? '' : text).replace(MARK, (m, k, name, fb) => fb); }
  /* [{ text } | { clip: 'sound-m', fallback: 'mmm' }] in order */
  function parts(text) {
    const out = []; let last = 0, m; const s = String(text);
    MARK.lastIndex = 0;
    while ((m = MARK.exec(s))) {
      if (m.index > last) out.push({ text: s.slice(last, m.index) });
      out.push({ clip: clipId(m[1], m[2]), fallback: m[3] });
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push({ text: s.slice(last) });
    MARK.lastIndex = 0;
    return out;
  }
  const canAudio = typeof Audio !== 'undefined';
  /* plays one clip; resolves true when it played to the end, false when it could not (missing, failed, blocked) */
  function playClip(id, rate) {
    return loadManifest().then(man => new Promise(resolve => {
      const entry = man[id];
      if (!canAudio || !entry) { clipLog.push({ id, rate, ok: false, why: entry ? 'no audio' : 'not in manifest' }); resolve(false); return; }
      let settled = false, timer = null;
      const audio = new Audio();
      const finish = (ok, why) => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (current && current.audio === audio) current = null;
        clipLog.push({ id, rate, ok, why: why || '' }); api.lastClip = { id, rate, ok };
        resolve(ok);
      };
      audio.preload = 'auto';
      audio.addEventListener('ended', () => finish(true));
      audio.addEventListener('error', () => finish(false, 'error'));
      current = { audio, cancel: () => { try { audio.pause(); } catch (e) { } finish(false, 'cancelled'); } };
      audio.src = CLIP_DIR + entry.file;
      audio.playbackRate = rate;
      timer = setTimeout(() => { try { audio.pause(); } catch (e) { } finish(false, 'timeout'); }, Math.max(2500, ((entry.dur || 1) / rate) * 1000 + 3000));
      let p; try { p = audio.play(); } catch (e) { finish(false, 'blocked'); return; }
      if (p && p.catch) p.catch(() => finish(false, 'blocked'));
    }));
  }
  function stopClip() { if (current) { const c = current; current = null; c.cancel(); } }

  /* ---- speaking ---- */
  let token = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* api.heard: one entry per say() call, in order, as plain text: a recorded clip shows as [sound-m] or [word-cat]; a clip that could not play is
     replaced by the words spoken instead. Kept for tests and for the grown-up to check what was said (capped at 2000). */
  const heard = [];
  const api = { supported, lastUsed: null, lastClip: null, clipLog, heard, canClips: canAudio };
  function note(text) { heard.push(text); if (heard.length > 2000) heard.shift(); return heard.length - 1; }

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
    if (hasMarkers(text)) return sayParts(text, opts);
    if (!supported) return;
    note(String(text));
    const my = ++token;
    stopClip();
    try { synth.cancel(); } catch (e) { }
    await ready();
    if (my !== token) return;
    await speakOnce(text, opts, my, false);
  };
  /* a text with clip markers: each clip is played from the site's own files, the words between are spoken; a clip that cannot play is spoken as its fallback text */
  async function sayParts(text, opts) {
    const my = ++token;
    stopClip();
    if (supported) { try { synth.cancel(); } catch (e) { } }
    const rate = opts.clipRate || ((opts.factor || 1) < 0.8 ? 0.75 : 1);
    const list = parts(text);
    const entry = list.map(p => p.clip ? '[' + p.clip + ']' : p.text).join('');
    const at = note(entry);
    if (supported) await ready();
    for (const p of list) {
      if (my !== token) return;
      if (p.clip) {
        const ok = await playClip(p.clip, rate);
        if (my !== token) return;
        if (!ok && heard[at] != null) heard[at] = heard[at].replace('[' + p.clip + ']', p.fallback);
        if (!ok && supported && p.fallback) await speakOnce(p.fallback, opts, my, false);
      } else if (supported && /[A-Za-z0-9]/.test(p.text)) await speakOnce(p.text.replace(/^[\s.,;:!?]+/, '').trim(), opts, my, false);
    }
  }
  /* Warm the browser cache for the clips a screen is about to use (the site's own files only). */
  api.preload = function (text) {
    if (!canAudio) return Promise.resolve();
    return loadManifest().then(man => {
      parts(text).forEach(p => { if (p.clip && man[p.clip] && !api._warm[p.clip]) { api._warm[p.clip] = 1; const a = new Audio(); a.preload = 'auto'; a.src = CLIP_DIR + man[p.clip].file; } });
    });
  };
  api._warm = {};
  api.plain = plain;
  api.hasMarkers = hasMarkers;
  api.clipsReady = () => loadManifest().then(m => Object.keys(m).length > 0);
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
  api.stop = function () { token++; stopClip(); if (supported) try { synth.cancel(); } catch (e) { } };

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
