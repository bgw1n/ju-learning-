/* recordings.js - v13: Dorian's sounds in a grown-up's own voice.
   Recordings are made on the parent page (Record sounds) and kept ONLY in this browser, in IndexedDB (database 'ju-recordings', store 'clips').
   They are never site files and never go in the repo. They travel between devices only inside a backup file (backup version 6, "recordings").
   Each recording uses the clip name the games already use (sound-m, word-cat, sight-she), so js/speech.js plays it first:
     the grown-up's recording -> the site's recorded clip -> the browser voice.
   A record: { id, blob, type, ts (ISO), dur (s), start (s), end (s), gain (0-1) }. start/end/gain are worked out when it is saved, to skip silence
   and even out loudness; the original recording is kept as it is. */
(function () {
  window.JU = window.JU || {};
  const DB = 'ju-recordings', STORE = 'clips';
  const hasIDB = typeof indexedDB !== 'undefined';
  let dbp = null;
  function db() {
    if (!hasIDB) return Promise.reject(new Error('no IndexedDB'));
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE); let out;
      Promise.resolve(fn(s, v => { out = v; })).catch(rej);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let cache = null;                                      // id -> record (loaded once per page)
  async function all() {
    if (cache) return cache;
    try { const rows = await tx('readonly', (s, set) => req(s.getAll()).then(set)); cache = {}; (rows || []).forEach(r => { cache[r.id] = r; }); }
    catch (e) { cache = {}; }
    return cache;
  }
  const api = { supported: hasIDB, canRecord: () => typeof MediaRecorder !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false };
  api.list = async () => Object.assign({}, await all());
  api.get = async id => (await all())[id] || null;
  api.has = async id => !!(await all())[id];

  /* silence trim, from the decoded audio; if the browser cannot decode it, it plays whole */
  async function analyseBlob(blob) {
    const out = { dur: 0, start: 0, end: 0, gain: 1 };
    try {
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!AC || !blob.arrayBuffer) return out;
      const ab = await blob.arrayBuffer();
      const ctx = new AC(1, 44100, 44100);
      const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      const d = buf.getChannelData(0), sr = buf.sampleRate, n = d.length;
      out.dur = n / sr; out.end = out.dur;
      let peak = 0; for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
      if (peak < 0.003) return out;                     // silence: keep it whole
      const thr = Math.max(0.02 * peak, 0.004), win = Math.floor(sr * 0.01);
      const loud = i => { for (let j = i; j < Math.min(n, i + win); j++) if (Math.abs(d[j]) >= thr) return true; return false; };
      let s = 0; while (s < n && !loud(s)) s += win;
      let e = n; while (e > s && !loud(Math.max(0, e - win))) e -= win;
      out.start = Math.max(0, s / sr - 0.06); out.end = Math.min(out.dur, e / sr + 0.12);
      out.gain = 1;                                     // an <audio> element cannot go above 1; quiet takes are flagged instead
      out.peak = Math.round(peak * 1000) / 1000;
    } catch (e) { /* keep defaults */ }
    return out;
  }
  api.analyse = analyseBlob;
  api.put = async function (id, blob, meta) {
    const a = Object.assign(await analyseBlob(blob), meta || {});
    const rec = { id, blob, type: blob.type || 'audio/webm', ts: (meta && meta.ts) || new Date().toISOString(), dur: a.dur, start: a.start, end: a.end, gain: a.gain, peak: a.peak == null ? null : a.peak };
    await tx('readwrite', s => req(s.put(rec)));
    (await all())[id] = rec; api._changed();
    return rec;
  };
  api.remove = async function (id) { await tx('readwrite', s => req(s.delete(id))); delete (await all())[id]; api._changed(); };
  api.clear = async function () { await tx('readwrite', s => req(s.clear())); cache = {}; api._changed(); };
  api._listeners = []; api.onChange = fn => api._listeners.push(fn); api._changed = () => api._listeners.forEach(f => { try { f(); } catch (e) { } });
  api.persist = async () => { try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; } };

  /* ---- the list of things to record (built from the game data, so new letters / words / sight weeks appear by themselves) ---- */
  const fetchJson = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  api.catalog = async function () {
    const [tips, letters, cvc, sidx] = await Promise.all([fetchJson('data/recordings/tips.json'), fetchJson('data/kinder/letters.json'), fetchJson('data/kinder/cvc.json'), fetchJson('data/sight/weeks.json').catch(() => ({ weeks: [] }))]);
    const weeks = await Promise.all((sidx.weeks || []).map(w => fetchJson('data/sight/' + w.file).catch(() => null)));
    const order = (letters.start || []).concat(letters.extended || []).filter(l => letters.letters[l]);
    const alpha = order.slice().sort();
    const sight = []; weeks.forEach(w => (w && w.words || []).forEach(x => { if (sight.indexOf(x.word) < 0) sight.push(x.word); }));
    const groups = [
      { key: 'letters', title: 'Letter sounds', tip: tips.letterTip, items: alpha.map(l => ({ id: 'sound-' + l, label: l, tip: (tips.letters || {})[l] || '' })) },
      { key: 'words', title: 'Three-letter words', tip: tips.wordTip, items: cvc.words.map(w => ({ id: 'word-' + w.word, label: w.word, pic: w.e, tip: '' })) },
      { key: 'sight', title: 'Sight words', tip: tips.sightTip, items: sight.map(w => ({ id: 'sight-' + w, label: w === 'i' ? 'I' : w, tip: '' })) }
    ];
    (tips.extra || []).forEach(g => { if (g && g.items && g.items.length) groups.push(g); });
    return groups;
  };
  /* { done, total, missing: [ids] } for the letter sounds: Letter sounds and Build a word open on Dorian's home only when all are recorded */
  api.letterProgress = async function () {
    const letters = await fetchJson('data/kinder/letters.json');
    const ids = Object.keys(letters.letters).map(l => 'sound-' + l), have = await all();
    const missing = ids.filter(id => !have[id]);
    const testOpen = window.__JU_LETTERS_OPEN === true;           // automated tests only (tests/e2e.py sets it before the page loads)
    return { done: ids.length - missing.length, total: ids.length, missing, ready: missing.length === 0 || testOpen };
  };

  /* ---- playback, used by js/speech.js: resolves true (played to the end), false (none / failed), cancel through the returned handle ---- */
  api.play = function (id, rate, onHandle) {
    return all().then(have => new Promise(resolve => {
      const r = have[id];
      if (!r || typeof Audio === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) { resolve(null); return; }
      const url = URL.createObjectURL(r.blob), audio = new Audio();
      let settled = false, timer = null, stopAt = null;
      const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); clearInterval(stopAt); try { audio.pause(); } catch (e) { } setTimeout(() => URL.revokeObjectURL(url), 1000); resolve(ok); };
      audio.addEventListener('ended', () => finish(true));
      audio.addEventListener('error', () => finish(false));
      if (onHandle) onHandle({ audio, cancel: () => finish(false) });
      audio.src = url; audio.playbackRate = rate || 1; audio.volume = Math.min(1, Math.max(0.05, r.gain || 1));
      const start = r.start || 0, end = r.end && r.end > start ? r.end : 0;
      const go = () => {
        try { if (start) audio.currentTime = start; } catch (e) { }
        if (end) stopAt = setInterval(() => { if (audio.currentTime >= end) finish(true); }, 25);
        let p; try { p = audio.play(); } catch (e) { finish(false); return; }
        if (p && p.catch) p.catch(() => finish(false));
      };
      if (start && audio.readyState < 1) audio.addEventListener('loadedmetadata', go, { once: true }); else go();
      timer = setTimeout(() => finish(false), Math.max(3000, (((end || r.dur || 4) - start) / (rate || 1)) * 1000 + 3000));
    }));
  };

  /* ---- backups (version 6): base64 text inside the JSON file ---- */
  function b64(blob) { return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1] || ''); f.onerror = () => rej(f.error); f.readAsDataURL(blob); }); }
  function unb64(s, type) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: type || 'audio/webm' }); }
  api.exportAll = async function () {
    const have = await all();
    return Promise.all(Object.values(have).sort((a, b) => a.id < b.id ? -1 : 1).map(async r => ({ id: r.id, type: r.type, ts: r.ts, dur: r.dur, start: r.start, end: r.end, gain: r.gain, data: await b64(r.blob) })));
  };
  const ID_RE = /^[a-z0-9]+-[a-z0-9-]+$/;
  /* adds what is new; when both have the same clip the newer one (ts) wins. Returns { added, replaced, skipped } */
  api.importAll = async function (list) {
    const out = { added: 0, replaced: 0, skipped: 0 };
    if (!Array.isArray(list) || !hasIDB) return out;
    const have = await all();
    for (const x of list) {
      if (!x || typeof x.id !== 'string' || !ID_RE.test(x.id) || typeof x.data !== 'string' || !x.data || isNaN(new Date(x.ts))) { out.skipped++; continue; }
      const cur = have[x.id];
      if (cur && new Date(cur.ts) >= new Date(x.ts)) { out.skipped++; continue; }
      let blob; try { blob = unb64(x.data, x.type); } catch (e) { out.skipped++; continue; }
      const rec = { id: x.id, blob, type: String(x.type || blob.type), ts: x.ts, dur: +x.dur || 0, start: +x.start || 0, end: +x.end || 0, gain: +x.gain || 1 };
      await tx('readwrite', s => req(s.put(rec))); have[x.id] = rec;
      cur ? out.replaced++ : out.added++;
    }
    if (out.added || out.replaced) api._changed();
    return out;
  };
  api.totalBytes = async () => Object.values(await all()).reduce((a, r) => a + (r.blob ? r.blob.size : 0), 0);
  JU.recordings = api;
})();
