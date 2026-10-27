(function () {
  const dots = document.querySelectorAll('#dots span');
  const dotsWrap = document.getElementById('dots');
  const msg = document.getElementById('msg');
  const pad = document.querySelector('.keypad');
  document.getElementById('name').textContent = JU.config.childName;
  document.title = 'Welcome, ' + JU.config.childName + '!';
  let pin = '';

  function draw() {
    dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
    dotsWrap.setAttribute('aria-label', pin.length + ' of 4 numbers typed');
  }
  function press(k) {
    if (/^\d$/.test(k)) { if (pin.length < 4) pin += k; msg.textContent = ''; draw(); if (pin.length === 4) setTimeout(submit, 150); }
    else if (k === 'back') { pin = pin.slice(0, -1); msg.textContent = ''; draw(); }
    else if (k === 'go') submit();
  }
  function submit() {
    if (pin.length !== 4) { msg.textContent = 'Type all 4 numbers, then press Go.'; return; }
    const role = JU.auth.login(pin);
    if (role === 'child') location.href = 'child.html';
    else if (role === 'parent') location.href = 'parent.html';
    else {
      pin = ''; draw();
      msg.textContent = 'Hmm, that is not the right number. Let\u2019s try again!';
      pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
    }
  }
  pad.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) press(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; press('go'); }
  });
})();
