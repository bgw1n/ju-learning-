/* ui.js - small helpers shared by every page. */
(function () {
  function h(tag, attrs) {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    const add = kid => {
      if (kid == null || kid === false) return;
      if (Array.isArray(kid)) kid.forEach(add);
      else el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* A word drawn with its color-coding. opts.split = true puts a small gap between syllables. */
  function coloredWord(week, w, opts) {
    opts = opts || {};
    const cols = JU.weeks.letterColors(week, w);
    const wrap = h('span', { class: 'cword', 'aria-label': w.word });
    let i = 0;
    const parts = opts.split && w.syllables ? w.syllables : [w.word];
    parts.forEach((part, pi) => {
      const group = h('span', { class: 'cword-part', 'aria-hidden': 'true' });
      for (const ch of part) {
        group.appendChild(h('span', { style: cols[i] ? { color: cols[i] } : null }, ch));
        i++;
      }
      wrap.appendChild(group);
      if (pi < parts.length - 1) wrap.appendChild(h('span', { class: 'cword-gap', 'aria-hidden': 'true' }, '\u2022'));
    });
    return wrap;
  }

  function localDate(iso) {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* Top bar. opts: { title, backHref, backLabel } */
  function header(opts) {
    const role = JU.auth.role();
    const bar = h('div', { class: 'topbar' },
      opts.backHref ? h('a', { class: 'btn small ghost', href: opts.backHref }, '\u2190 ' + (opts.backLabel || 'Back')) : h('span', { class: 'brand' }, 'Julianna\u2019s Learning Place'),
      h('span', { class: 'topbar-title' }, opts.title || ''),
      h('span', { class: 'topbar-right' },
        role === 'parent' && opts.showDashLink !== false ? h('a', { class: 'btn small ghost', href: 'parent.html' }, 'Grown-up page') : null,
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => JU.auth.logout() }, 'Log out')));
    const mount = document.getElementById('site-header');
    if (mount) mount.replaceChildren(bar);
  }

  JU.ui = { h, shuffle, uid, sleep, reduced, coloredWord, localDate, header };
})();
