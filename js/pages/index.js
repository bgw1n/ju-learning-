/* Landing page: "Who's playing?" then that person's PIN. */
(function () {
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    kids.forEach(k => el.appendChild(k.nodeType ? k : document.createTextNode(k)));
    return el;
  };
  const whoView = document.getElementById('who-view');
  const pinView = document.getElementById('pin-view');
  const dots = document.querySelectorAll('#dots span');
  const dotsWrap = document.getElementById('dots');
  const msg = document.getElementById('msg');
  const pad = document.querySelector('.keypad');
  let who = null;          // 'julianna' | 'dorian' | 'family' | 'parent' while the keypad is showing
  let pin = '';

  /* ---- step 1: three big picture buttons ---- */
  const grid = document.getElementById('who-grid');
  JU.config.profiles.forEach(p => {
    grid.appendChild(h('button', { type: 'button', class: 'who-btn who-' + p.id, 'data-who': p.id, 'aria-label': p.name },
      h('span', { class: 'who-pic', 'aria-hidden': 'true' }, p.emoji),
      h('span', { class: 'who-name' }, p.name)));
  });
  grid.addEventListener('click', e => { const b = e.target.closest('button[data-who]'); if (b) openPin(b.dataset.who); });
  document.getElementById('grownup').addEventListener('click', () => openPin('parent'));

  function draw() {
    dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
    dotsWrap.setAttribute('aria-label', pin.length + ' of 4 numbers typed');
  }
  function openPin(id) {
    who = id; pin = ''; msg.textContent = ''; draw();
    const p = JU.config.profiles.find(x => x.id === id);
    const h1 = document.getElementById('pin-h');
    if (p) {
      h1.replaceChildren('Welcome, ', h('span', { id: 'name' }, p.name), '!');
      document.getElementById('pin-emoji').textContent = p.emoji;
      document.getElementById('pin-lead').textContent = 'Type your secret number to start.';
      document.title = 'Welcome, ' + p.name + '!';
    } else {
      h1.replaceChildren('Grown-up page');
      document.getElementById('pin-emoji').textContent = '\uD83D\uDD11';
      document.getElementById('pin-lead').textContent = 'Type the grown-up number.';
      document.title = 'Grown-up page';
    }
    whoView.hidden = true; pinView.hidden = false;
    h1.focus();
  }
  function backToWho() {
    who = null; pin = ''; draw(); msg.textContent = '';
    pinView.hidden = true; whoView.hidden = false;
    document.title = 'Who\u2019s playing?';
    document.getElementById('who-h').focus();
  }
  document.getElementById('pin-back').addEventListener('click', backToWho);

  /* ---- step 2: the keypad ---- */
  function press(k) {
    if (!who) return;
    if (/^\d$/.test(k)) { if (pin.length < 4) pin += k; msg.textContent = ''; draw(); if (pin.length === 4) setTimeout(submit, 150); }
    else if (k === 'back') { pin = pin.slice(0, -1); msg.textContent = ''; draw(); }
    else if (k === 'go') submit();
  }
  function submit() {
    if (!who) return;
    if (pin.length !== 4) { msg.textContent = 'Type all 4 numbers, then press Go.'; return; }
    const role = JU.auth.login(who, pin);
    if (role) location.href = JU.auth.homeFor(role);
    else {
      pin = ''; draw();
      msg.textContent = 'Hmm, that is not the right number. Let\u2019s try again!';
      pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
    }
  }
  pad.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) press(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || !who) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Escape') backToWho();
    else if (e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; press('go'); }
  });
})();
