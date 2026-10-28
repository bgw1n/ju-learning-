/* money/art.js - the pictures for the Money & Economics lessons. Emoji and small inline SVG drawings only (no files, no network).
   An art spec comes from a lesson's data file and is turned into a <figure>:
     { kind: 'row' (default), items: [item, ...], alt }
        item: an emoji string, { e, label } (emoji with a caption), { svg: 'coin' | 'token' | 'cash' }, or { t: '$5' } (big text)
     { kind: 'tokens', n, alt }                       n paper tokens
     { kind: 'piles', piles: [{ n, glyph: 'coin'|'token', label }], alt }
     { kind: 'flow', amount, alt }                    cash leaves our hand and the store has it (the money slides over, unless reduced motion)
     { kind: 'balance', from, spend, to (null shows a ?), alt }   an account before and after one swipe
   Also: JU.moneyArt.glyph(name), JU.moneyArt.pile(n, glyph), JU.moneyArt.item(item). */
(function () {
  const h = JU.ui.h, S = JU.ui.svg;

  /* ---- drawings ---- */
  function coin(size) {
    size = size || 56;
    return S('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'glyph glyph-coin' },
      S('circle', { cx: 32, cy: 32, r: 29, fill: '#f6c945', stroke: '#b98a00', 'stroke-width': 4 }),
      S('circle', { cx: 32, cy: 32, r: 21, fill: 'none', stroke: '#d9a400', 'stroke-width': 3 }),
      S('text', { x: 32, y: 42, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: '#9a7000', 'font-family': 'Lexend, sans-serif' }, '$'));
  }
  function token(size) {
    size = size || 56;
    return S('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'glyph glyph-token' },
      S('rect', { x: 6, y: 14, width: 52, height: 36, rx: 7, fill: '#fff4c9', stroke: '#c79a1e', 'stroke-width': 3.5 }),
      S('rect', { x: 12, y: 20, width: 40, height: 24, rx: 4, fill: 'none', stroke: '#e3b94a', 'stroke-width': 2, 'stroke-dasharray': '4 3' }),
      S('polygon', { points: '32,22 35.5,29 43,30 37.5,35 39,42.5 32,38.8 25,42.5 26.5,35 21,30 28.5,29', fill: '#e09a00' }));
  }
  function cash(size) {
    size = size || 72;
    return S('svg', { viewBox: '0 0 80 48', width: size, height: size * 0.6, 'aria-hidden': 'true', focusable: 'false', class: 'glyph glyph-cash' },
      S('rect', { x: 3, y: 4, width: 74, height: 40, rx: 6, fill: '#cfe9cf', stroke: '#4f9a5a', 'stroke-width': 3.5 }),
      S('circle', { cx: 40, cy: 24, r: 12, fill: 'none', stroke: '#4f9a5a', 'stroke-width': 3 }),
      S('text', { x: 40, y: 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: '#2f7a3a', 'font-family': 'Lexend, sans-serif' }, '$'),
      S('circle', { cx: 12, cy: 14, r: 2.6, fill: '#4f9a5a' }), S('circle', { cx: 68, cy: 34, r: 2.6, fill: '#4f9a5a' }));
  }
  const GLYPHS = { coin, token, cash };
  function glyph(name, size) { return (GLYPHS[name] || coin)(size); }

  /* one item of a row */
  function item(it) {
    if (typeof it === 'string') return h('span', { class: 'art-item', 'aria-hidden': 'true' }, it);
    if (it.svg) return h('span', { class: 'art-item', 'aria-hidden': 'true' }, glyph(it.svg, it.size));
    if (it.t != null) return h('span', { class: 'art-item art-text', 'aria-hidden': 'true' }, it.t);
    return h('span', { class: 'art-item' + (it.dim ? ' dim' : ''), 'aria-hidden': 'true' }, h('span', { class: 'art-e' }, it.e), it.label ? h('span', { class: 'art-cap' }, it.label) : null);
  }
  /* n small drawings in a tidy grid (for piles and counting) */
  function pile(n, g, size) {
    const wrap = h('span', { class: 'pile', 'aria-hidden': 'true', 'data-count': n });
    for (let i = 0; i < n; i++) wrap.appendChild(glyph(g || 'coin', size || 34));
    return wrap;
  }
  const money = n => '$' + n;

  function render(spec) {
    if (!spec) return null;
    const kind = spec.kind || 'row';
    const fig = h('figure', { class: 'art art-' + kind, role: spec.alt ? 'img' : null, 'aria-label': spec.alt || null, 'aria-hidden': spec.alt ? null : 'true' });
    if (kind === 'row') {
      (spec.items || []).forEach(it => fig.appendChild(item(it)));
    } else if (kind === 'tokens') {
      fig.appendChild(pile(spec.n, 'token', 44));
    } else if (kind === 'piles') {
      (spec.piles || []).forEach(p => fig.appendChild(h('span', { class: 'art-item pile-box', 'aria-hidden': 'true' }, pile(p.n, p.glyph, 30), p.label ? h('span', { class: 'art-cap' }, p.label) : null)));
    } else if (kind === 'flow') {
      /* before: the cash is in our hand. After: it is in the store's hand. The cash slides across; with reduced motion it just sits at the end. */
      fig.appendChild(h('span', { class: 'flow-box', 'aria-hidden': 'true' }, h('span', { class: 'art-e' }, '\u270B'), h('span', { class: 'art-cap' }, 'Our hand: empty now')));
      fig.appendChild(h('span', { class: 'flow-track', 'aria-hidden': 'true' },
        h('span', { class: 'flow-cash' }, cash(86), h('span', { class: 'art-cap' }, money(spec.amount))), h('span', { class: 'art-e flow-arrow' }, '\u27A1\uFE0F')));
      fig.appendChild(h('span', { class: 'flow-box', 'aria-hidden': 'true' }, h('span', { class: 'art-e' }, '\uD83C\uDFEA'), h('span', { class: 'art-cap' }, 'The store has ' + money(spec.amount))));
    } else if (kind === 'balance') {
      const to = spec.to == null ? '?' : money(spec.to);
      fig.appendChild(h('span', { class: 'bal-box', 'aria-hidden': 'true' }, h('span', { class: 'art-cap' }, 'Our account'), h('span', { class: 'bal-n' }, money(spec.from)), h('span', { class: 'art-cap' }, 'before')));
      fig.appendChild(h('span', { class: 'bal-swipe', 'aria-hidden': 'true' },
        h('span', { class: 'art-e' }, '\uD83D\uDCB3'), h('span', { class: 'art-cap' }, 'swipe ' + money(spec.spend)),
        h('span', { class: 'bal-pay' }, h('span', { class: 'bal-fly' }, coin(34)), h('span', { class: 'bal-store' }, '\uD83C\uDFEA'))));
      fig.appendChild(h('span', { class: 'bal-box after', 'aria-hidden': 'true' }, h('span', { class: 'art-cap' }, 'Our account'), h('span', { class: 'bal-n' }, to), h('span', { class: 'art-cap' }, 'after')));
    }
    return fig;
  }

  JU.moneyArt = { render, glyph, item, pile, coin, token, cash };
})();
