/* record.js - v13: the "Record sounds" card on the parent page (behind the parent PIN, like the rest of the page).
   A grown-up records each of Dorian's sounds with the browser microphone (MediaRecorder). The list comes from JU.recordings.catalog():
   letter sounds, three-letter words and confirmed sight words. Saved in this browser only (js/recordings.js); see README "Record sounds". */
(async function () {
  const card = document.getElementById('record-sounds');
  if (!card || !window.JU || !JU.recordings) return;
  const h = JU.ui.h, R = JU.recordings;
  const groupsBox = card.querySelector('[data-record-groups]'), msg = card.querySelector('[data-record-msg]');
  const gate = card.querySelector('[data-record-gate]'), totalEl = card.querySelector('[data-record-total]'), warn = card.querySelector('[data-record-warn]');
  const MAX_MS = 4000;
  const MIMES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac'];
  let groups = [], busy = null;                         // busy: { id, rec, stream, timer } while recording

  function problem(text) { warn.textContent = text; warn.hidden = !text; }
  if (!R.supported) problem('This browser cannot keep recordings (no IndexedDB, or private browsing). Dorian\u2019s games will use the computer voice.');
  else if (!R.canRecord()) problem(window.isSecureContext === false ? 'The microphone only works on the real website (https). Open the site from its web address, not from a file.' : 'This browser cannot record sound. On an iPhone or iPad, you need iOS 14.3 or newer in Safari. Chrome, Edge and Firefox work too.');

  const pickMime = () => (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MIMES.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) : '') || '';
  const fmtTime = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  async function startRec(item) {
    if (busy) { stopRec(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) {
      msg.textContent = e && e.name === 'NotAllowedError'
        ? 'The microphone is blocked. Allow it for this site (on an iPhone: Settings > Safari > Microphone), then try again.'
        : 'No microphone was found, or it is busy in another app.';
      return;
    }
    const mime = pickMime();
    let rec; try { rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 48000 }, mime ? { mimeType: mime } : {})); }
    catch (e) { try { rec = new MediaRecorder(stream); } catch (e2) { stream.getTracks().forEach(t => t.stop()); msg.textContent = 'This browser could not start recording.'; return; } }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const id = busy && busy.id; clearTimeout(busy && busy.timer); busy = null;
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
      if (!blob.size) { msg.textContent = 'Nothing was recorded. Please try again.'; render(); return; }
      try {
        const r = await R.put(id, blob);
        msg.textContent = 'Saved "' + labelOf(id) + '".' + (r.peak != null && r.peak < 0.08 ? ' It is a bit quiet: try again a little closer to the microphone.' : '');
        R.persist();
      } catch (e) { msg.textContent = 'Could not save that recording (the browser storage may be full or turned off).'; }
      await render();
      const btn = card.querySelector('[data-rec-play="' + id + '"]'); if (btn) btn.focus({ preventScroll: true });
    };
    busy = { id: item.id, rec, stream, timer: setTimeout(stopRec, MAX_MS) };
    rec.start();
    msg.textContent = 'Recording "' + item.label + '"\u2026 say it now. Tap Stop when done (it stops by itself after 4 seconds).';
    render();
  }
  function stopRec() { if (busy && busy.rec.state !== 'inactive') { try { busy.rec.stop(); } catch (e) { } } }
  const labelOf = id => { for (const g of groups) for (const it of g.items) if (it.id === id) return it.label; return id; };

  async function play(id) { try { JU.speech.stop(); } catch (e) { } return R.play(id, 1); }
  async function playAll(g) {
    const have = await R.list();
    for (const it of g.items) if (have[it.id]) { await play(it.id); await new Promise(r => setTimeout(r, 250)); }
  }

  // v13.1: build the list once, then update rows in place. (v13 rebuilt every group on each state change, which
  // re-collapsed the word and sight-word groups, so the page jumped up and the Stop button vanished.)
  const rows = {}, counts = {};
  let built = false;
  function build() {
    const can = R.supported && R.canRecord();
    groupsBox.replaceChildren(...groups.map(g => h('details', { class: 'rec-group', 'data-rec-group': g.key, open: g.key === 'letters' || null },
      (h('summary', null, h('strong', null, g.title), ' ', counts[g.key] = h('span', { class: 'rec-count', 'data-rec-count': g.key }, ''))),
      g.tip ? h('p', { class: 'note' }, g.tip) : null,
      h('div', { class: 'row' }, counts[g.key + ':all'] = h('button', { type: 'button', class: 'btn small ghost', 'data-rec-playall': g.key, onclick: () => playAll(g) }, 'Play all in this group')),
      h('ul', { class: 'rec-list' }, g.items.map(it => {
        const row = {};
        row.li = h('li', { class: 'rec-item', 'data-rec-item': it.id, 'data-state': 'todo' },
          h('span', { class: 'rec-label' }, it.pic ? h('span', { 'aria-hidden': 'true' }, it.pic + ' ') : null, it.label),
          h('span', { class: 'rec-tip' }, it.tip || ''),
          row.status = h('span', { class: 'rec-status' }, 'Not yet'),
          h('span', { class: 'rec-btns' },
            row.rec = h('button', { type: 'button', class: 'btn small', 'data-rec-record': it.id, onclick: e => { e.preventDefault(); (busy && busy.id === it.id) ? stopRec() : startRec(it); } }, 'Record'),
            row.play = h('button', { type: 'button', class: 'btn small ghost', 'data-rec-play': it.id, onclick: e => { e.preventDefault(); play(it.id); } }, 'Play'),
            row.del = h('button', { type: 'button', class: 'btn small ghost', 'data-rec-delete': it.id, onclick: async e => { e.preventDefault(); if (!confirm('Delete your recording of "' + it.label + '"?')) return; await R.remove(it.id); msg.textContent = 'Deleted "' + it.label + '".'; render(); } }, 'Delete')));
        rows[it.id] = row;
        return row.li;
      })))));
    built = true;
  }
  async function render() {
    const have = await R.list();
    if (!built) build();
    const sx = window.scrollX, sy = window.scrollY;
    let done = 0, total = 0;
    const can = R.supported && R.canRecord();
    for (const g of groups) {
      const n = g.items.filter(it => have[it.id]).length; done += n; total += g.items.length;
      counts[g.key].textContent = n + ' of ' + g.items.length + ' done';
      counts[g.key + ':all'].disabled = !n;
      for (const it of g.items) {
        const row = rows[it.id], r = have[it.id], rec = !!(busy && busy.id === it.id);
        row.li.className = 'rec-item' + (r ? ' done' : '') + (rec ? ' recording' : '');
        row.li.dataset.state = rec ? 'recording' : r ? 'done' : 'todo';
        row.status.textContent = rec ? '\u23fa Recording\u2026' : r ? '\u2705 ' + fmtTime(r.ts) : 'Not yet';
        row.rec.className = 'btn small' + (rec ? ' danger' : '');
        row.rec.textContent = rec ? 'Stop' : r ? 'Redo' : 'Record';
        row.rec.setAttribute('aria-label', (rec ? 'Stop recording ' : r ? 'Redo ' : 'Record ') + it.label);
        row.rec.disabled = !can || !!(busy && !rec);
        row.play.disabled = !(r && !busy); row.play.setAttribute('aria-label', 'Play ' + it.label);
        row.del.disabled = !(r && !busy); row.del.setAttribute('aria-label', 'Delete ' + it.label);
      }
    }
    const lp = await R.letterProgress();
    const realReady = lp.missing.length === 0;
    gate.dataset.ready = realReady ? 'yes' : 'no';
    gate.textContent = realReady
      ? '\u2705 All ' + lp.total + ' letter sounds are recorded, so Letter sounds and Build a word are on Dorian\u2019s home.'
      : 'Letter sounds and Build a word are hidden from Dorian until all ' + lp.total + ' letter sounds are recorded (' + lp.done + ' of ' + lp.total + ' done). Sight words, Count to 20 and Add it up are on his home now.';
    const bytes = await R.totalBytes();
    totalEl.textContent = 'Overall: ' + done + ' of ' + total + ' recorded' + (bytes ? ', using about ' + (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB') + ' in this browser' : '') + '. Anything not recorded uses the computer voice.';
    totalEl.dataset.done = done; totalEl.dataset.total = total;
    if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
    if (busy && rows[busy.id]) { const b = rows[busy.id].rec, rc = b.getBoundingClientRect(); if (rc.top < 0 || rc.bottom > window.innerHeight) b.scrollIntoView({ block: 'nearest' }); }
  }
  JU.recordPage = { refresh: render, stop: stopRec };
  try { groups = await R.catalog(); } catch (e) { groups = []; problem('The list of sounds could not load. Please reload the page.'); }
  await render();
})();
