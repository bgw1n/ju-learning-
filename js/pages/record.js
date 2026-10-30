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
      const btn = card.querySelector('[data-rec-play="' + id + '"]'); if (btn) btn.focus();
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

  async function render() {
    const have = await R.list();
    let done = 0, total = 0;
    const can = R.supported && R.canRecord();
    groupsBox.replaceChildren(...groups.map(g => {
      const n = g.items.filter(it => have[it.id]).length; done += n; total += g.items.length;
      return h('details', { class: 'rec-group', 'data-rec-group': g.key, open: g.key === 'letters' || null },
        h('summary', null, h('strong', null, g.title), ' ', h('span', { class: 'rec-count', 'data-rec-count': g.key }, n + ' of ' + g.items.length + ' done')),
        g.tip ? h('p', { class: 'note' }, g.tip) : null,
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small ghost', 'data-rec-playall': g.key, disabled: n ? null : '', onclick: () => playAll(g) }, 'Play all in this group')),
        h('ul', { class: 'rec-list' }, g.items.map(it => {
          const r = have[it.id], rec = busy && busy.id === it.id;
          return h('li', { class: 'rec-item' + (r ? ' done' : '') + (rec ? ' recording' : ''), 'data-rec-item': it.id, 'data-state': rec ? 'recording' : r ? 'done' : 'todo' },
            h('span', { class: 'rec-label' }, it.pic ? h('span', { 'aria-hidden': 'true' }, it.pic + ' ') : null, it.label),
            h('span', { class: 'rec-tip' }, it.tip || ''),
            h('span', { class: 'rec-status' }, rec ? '\u23fa Recording\u2026' : r ? '\u2705 ' + fmtTime(r.ts) : 'Not yet'),
            h('span', { class: 'rec-btns' },
              h('button', { type: 'button', class: 'btn small' + (rec ? ' danger' : ''), 'data-rec-record': it.id, disabled: (!can || (busy && !rec)) ? '' : null, 'aria-label': (rec ? 'Stop recording ' : r ? 'Redo ' : 'Record ') + it.label, onclick: () => rec ? stopRec() : startRec(it) }, rec ? 'Stop' : r ? 'Redo' : 'Record'),
              h('button', { type: 'button', class: 'btn small ghost', 'data-rec-play': it.id, disabled: r && !busy ? null : '', 'aria-label': 'Play ' + it.label, onclick: () => play(it.id) }, 'Play'),
              h('button', { type: 'button', class: 'btn small ghost', 'data-rec-delete': it.id, disabled: r && !busy ? null : '', 'aria-label': 'Delete ' + it.label, onclick: async () => { if (!confirm('Delete your recording of "' + it.label + '"?')) return; await R.remove(it.id); msg.textContent = 'Deleted "' + it.label + '".'; render(); } }, 'Delete')));
        })));
    }));
    const lp = await R.letterProgress();
    const realReady = lp.missing.length === 0;
    gate.dataset.ready = realReady ? 'yes' : 'no';
    gate.textContent = realReady
      ? '\u2705 All ' + lp.total + ' letter sounds are recorded, so Letter sounds and Build a word are on Dorian\u2019s home.'
      : 'Letter sounds and Build a word are hidden from Dorian until all ' + lp.total + ' letter sounds are recorded (' + lp.done + ' of ' + lp.total + ' done). Sight words, Count to 20 and Add it up are on his home now.';
    const bytes = await R.totalBytes();
    totalEl.textContent = 'Overall: ' + done + ' of ' + total + ' recorded' + (bytes ? ', using about ' + (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB') + ' in this browser' : '') + '. Anything not recorded uses the computer voice.';
    totalEl.dataset.done = done; totalEl.dataset.total = total;
  }
  JU.recordPage = { refresh: render, stop: stopRec };
  try { groups = await R.catalog(); } catch (e) { groups = []; problem('The list of sounds could not load. Please reload the page.'); }
  await render();
})();
