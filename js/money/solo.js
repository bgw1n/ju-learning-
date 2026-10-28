/* money/solo.js - plays one child's solo follow-on (solo.html?n=1) from the "solo" part of data/money/lesson-<n>.json.
   JU.money.playSolo(n, profileId, mount, { preview }) - profileId 'julianna' or 'dorian'.
   Item types (see README): choose (tap one of the pictures or answers), sort (two big buttons, then optionally "why?"), count (tap each token).
   Rules: a wrong tap is gentle (the option greys out, try another); the right tap explains why. Results are saved under that child's own
   profile (storage.profile(id).addMoneyAnswer). The earned hint reuses js/hints.js: locked until 2 real wrong answers, quick or repeated
   wrong taps do not count, 3 hints per session, "Grown-up unlock" with the parent PIN. Questions with only two answers have no hint
   (there is only one wrong answer to tap). A grown-up preview (preview: true) saves nothing. */
(function () {
  const h = JU.ui.h;

  /* a sort item becomes its own question, plus a "why?" question when it has reasons */
  function expand(items) {
    const out = [];
    items.forEach(it => {
      if (it.type !== 'sort') { out.push(it); return; }
      const art = it.thing ? { kind: 'row', items: [it.thing], alt: it.alt } : it.art;
      out.push({ type: 'choose', kind: 'sort', id: it.id, prompt: it.prompt, art, say: it.say, noHint: true, why: it.why,
        options: it.groups.map((g, gi) => Object.assign({}, g, { right: gi === it.answer })) });
      if (it.reasons) out.push({ type: 'choose', kind: 'sort', id: it.id + '-why', prompt: it.reasonPrompt || 'Why?', context: it.prompt, options: it.reasons, hint: it.hint, why: it.reasonWhy || it.why });
    });
    return out;
  }

  JU.money.playSolo = async function (n, profileId, mount, opts) {
    opts = opts || {};
    const preview = !!opts.preview;
    const data = await JU.money.loadLesson(n);
    const cfg = data.solo && data.solo[profileId];
    if (!cfg) throw new Error('no solo activity for ' + profileId);
    const kid = profileId === 'dorian';
    const store = JU.storage.profile(profileId);
    const items = expand(cfg.items);
    const session = JU.ui.uid();
    const noStore = { addHint: async () => { } };
    const ctx = { game: { id: 'money-' + n, hintGate: true }, week: { id: 'money-L' + n }, subject: 'money', session, hintNoun: 'question',
      store: preview ? noStore : store, speakButton: () => h('span'), hintCount: 0 };
    const home = opts.home || (kid ? 'dorian.html' : 'child.html');
    let idx = -1;   // -1: intro, 0..items.length-1: questions, items.length: done

    const say = t => JU.moneyUI.say(t);
    const nextLabel = last => kid ? h('span', { 'aria-hidden': 'true' }, last ? '\u2B50' : '\u27A1\uFE0F') : (last ? 'Finish' : 'Next \u2192');
    const nextBtn = (last, onclick, disabled) => h('button', { class: 'btn primary ' + (kid ? 'kid-next' : 'big'), type: 'button', 'data-next': '', disabled: disabled || null,
      'aria-label': last ? 'Finish' : 'Next', onclick }, nextLabel(last));

    function frame(number, kind, kids, q) {
      const ask = JU.moneyUI.askButton({ profile: profileId, kind: 'solo', lesson: n, screen: number, save: !preview, kid });
      const root = h('section', { class: 'solo-screen card' + (kid ? ' kidcard' : ''), 'data-screen': number, 'data-kind': kind, 'data-q': q || null, 'aria-label': 'Screen ' + number }, kids, ask.note);
      return { ask, root };
    }
    function bottom(ask, next, back) {
      return h('div', { class: 'lesson-nav solo-nav' }, back || h('span'), ask.el, next || h('span'));
    }
    function optionBody(o) {
      return [o.e ? h('span', { class: 'opt-e', 'aria-hidden': 'true' }, o.e) : null,
        o.svg ? h('span', { class: 'opt-e', 'aria-hidden': 'true' }, JU.moneyArt.glyph(o.svg, kid ? 84 : 56)) : null,
        o.pile ? JU.moneyArt.pile(o.pile.n, o.pile.glyph, kid ? 30 : 26) : null,
        o.label && !o.pile ? h('span', { class: 'opt-label' }, o.label) : null];
    }
    function go(i) { JU.moneyUI.stop(); idx = i; draw(); }

    async function record(it, wrongs, gate) {
      const hinted = !!(gate && gate.used());
      const rec = { session, lesson: n, q: it.id, kind: it.kind || it.type, correct: wrongs === 0 && !hinted, tries: wrongs + 1, hinted };
      if (!preview) await store.addMoneyAnswer(rec);
      return rec;
    }

    function drawIntro() {
      const text = cfg.intro;
      const start = h('button', { class: 'btn primary ' + (kid ? 'kid-next' : 'big'), type: 'button', 'data-next': '', 'aria-label': 'Start', onclick: () => go(0) }, kid ? h('span', { 'aria-hidden': 'true' }, '\u25B6\uFE0F') : 'Start \u2192');
      const f = frame(1, 'intro', [
        JU.moneyArt.render(cfg.art),
        h('h1', { class: 'lesson-title', tabindex: '-1' }, cfg.title),
        h('p', { class: 'lesson-text intro-text' }, text),
        preview ? h('p', { class: 'note preview-note' }, 'Grown-up preview: nothing you tap here is saved.') : null,
        h('div', { class: 'speakrow' }, JU.moneyUI.speakRow(() => text, { kid }))]);
      f.root.insertBefore(bottom(f.ask, start), f.ask.note);
      mount.replaceChildren(f.root);
      f.root.querySelector('.lesson-title').focus({ preventScroll: true });
      say(text);
    }

    function drawItem() {
      const it = items[idx], number = idx + 2, last = idx === items.length - 1;
      const labels = it.options ? it.options.map(o => o.label).filter(Boolean) : [];
      const text = it.say || (it.prompt + (kid && labels.length ? ' ' + labels.join('. ') + '.' : ''));
      const feedback = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite', 'data-feedback': '' });
      let wrongs = 0, answered = false, gate = null;
      const next = nextBtn(last, () => go(idx + 1), true);
      next.setAttribute('aria-label', 'Next (answer first)');
      const unlockNext = () => { next.disabled = false; next.setAttribute('aria-label', last ? 'Finish' : 'Next'); };
      let body;

      if (it.type === 'count') {
        let counted = 0;
        const tokens = [];
        for (let i = 0; i < it.n; i++) {
          const b = h('button', { class: 'token-btn', type: 'button', 'data-token': i, 'aria-label': 'token ' + (i + 1), onclick: async () => {
            if (b.classList.contains('counted') || answered) return;
            b.classList.add('counted'); b.setAttribute('aria-pressed', 'true'); counted++;
            countOut.textContent = String(counted);
            if (counted === it.n) {
              answered = true;
              feedback.textContent = it.doneText || ('You counted ' + it.n + '!');
              await record(it, 0, null);
              unlockNext(); say(String(counted) + '. ' + feedback.textContent);
            } else say(String(counted));
          } }, JU.moneyArt.token(kid ? 78 : 56));
          tokens.push(b);
        }
        const countOut = h('div', { class: 'count-out', 'aria-live': 'polite', 'data-count-out': '' }, '0');
        body = [h('div', { class: 'token-grid' }, tokens), countOut];
      } else {
        const buttons = it.options.map((o, oi) => h('button', { class: 'opt solo-opt' + (it.options.length === 2 ? ' two' : ''), type: 'button', 'data-opt': oi, 'aria-label': o.label || ('pile ' + (oi + 1)),
          onclick: async () => {
            if (answered || buttons[oi].disabled) return;
            if (o.right) {
              answered = true;
              buttons.forEach((b, bi) => { b.classList.toggle('right', bi === oi); if (bi !== oi) b.disabled = true; });
              const msg = it.why || 'That is right!';
              feedback.textContent = msg;
              await record(it, wrongs, gate);
              if (gate) gate.close();
              unlockNext(); say(msg);
            } else {
              wrongs++;
              buttons[oi].disabled = true; buttons[oi].classList.add('tried');
              const msg = 'Not that one. Try another.';
              feedback.textContent = msg;
              if (gate) gate.miss(o.label || ('pile ' + (oi + 1)));
              say(msg);
            }
          } }, optionBody(o)));
        const hintBox = [];
        if (!it.noHint && it.options.length >= 3 && JU.speech.supported) {
          gate = JU.hints.gate(ctx, { word: it.id, say: it.hint || 'Think about it one more time.' }, 'Hear a hint');
          if (gate.gated) {
            hintBox.push(gate.el);
            if (kid) gate.el.addEventListener('click', e => { if (e.target.closest('[data-hint-lock]')) say('Try two times, and a hint will open. Or ask a grown-up.'); });
          } else gate = null;
        }
        body = [h('div', { class: 'opts solo-opts' + (kid ? ' kid-opts' : '') }, buttons), ...hintBox];
      }

      const f = frame(number, it.type === 'count' ? 'count' : 'choose', [
        JU.moneyArt.render(it.art),
        it.context ? h('p', { class: 'solo-context' }, it.context) : null,
        h('h2', { class: 'lesson-text', tabindex: '-1' }, it.prompt),
        h('div', { class: 'speakrow' }, JU.moneyUI.speakRow(() => text, { kid })),
        ...body, feedback], it.id);
      f.root.insertBefore(bottom(f.ask, next), f.ask.note);
      mount.replaceChildren(f.root);
      f.root.querySelector('.lesson-text').focus({ preventScroll: true });
      say(text);
    }

    async function drawDone() {
      JU.moneyUI.stop();
      let isNew = false;
      if (!preview) { await store.setSoloDone(n); isNew = await store.earnSticker('money', 'solo-' + n); }
      const number = items.length + 2;
      const f = frame(number, 'done', null);
      const msg = 'You finished! ' + (preview ? 'This was a preview, so nothing was saved.' : isNew ? 'You earned a new sticker!' : 'Your sticker is already in your collection. Great practice!');
      f.root.classList.add('done');
      f.root.prepend(
        h('div', { class: 'sticker-pop', 'aria-hidden': 'true', 'data-sticker': '' }, cfg.sticker || data.sticker || '\u2B50'),
        h('h2', { class: 'lesson-title', tabindex: '-1', 'data-done-title': '' }, 'You finished!'),
        h('p', { class: 'lead' }, msg.replace('You finished! ', '')),
        h('div', { class: 'row center' }, h('a', { class: 'btn primary ' + (kid ? 'kid-next' : 'big'), href: home, 'data-home': '', 'aria-label': 'Go back' }, kid ? h('span', { 'aria-hidden': 'true' }, '\uD83C\uDFE0') : 'Back')),
        h('div', { class: 'lesson-nav solo-nav' }, h('span'), f.ask.el, h('span')));
      mount.replaceChildren(f.root);
      f.root.querySelector('.lesson-title').focus({ preventScroll: true });
      say(msg);
    }

    function draw() {
      window.scrollTo(0, 0);
      if (idx < 0) drawIntro();
      else if (idx < items.length) drawItem();
      else drawDone();
    }
    draw();
  };
})();
