/* money/family.js - plays one family lesson (lesson.html?n=1) from data/money/lesson-<n>.json.
   Screens: the lesson's own screens (intro, story, ask) in order, then a calm "Grown-up talk" screen with the
   "We finished!" button, then a done screen with the Family sticker. Every screen has Hear it again, Back/Next
   and Ask a grown-up (which logs a flag under the Family profile). No timers, no progress bar. */
(function () {
  const h = JU.ui.h;
  const KIND_LABEL = { intro: 'start', story: 'story', ask: 'question', talk: 'grown-up talk', done: 'finished' };

  JU.money.playFamily = async function (n, mount) {
    const data = await JU.money.loadLesson(n);
    const fam = JU.storage.profile('family');
    const screens = data.screens.concat([{ kind: 'talk' }]);
    let idx = 0;

    function spokenFor(sc) {
      if (sc.say) return sc.say;
      if (sc.kind === 'intro') return sc.title + '. ' + sc.text;
      if (sc.kind === 'story') return sc.text;
      if (sc.kind === 'ask') return sc.prompt + ' ' + sc.options.map((o, i) => (i ? 'Or: ' : '') + o.label).join(' ');
      if (sc.kind === 'talk') return 'Grown-up talk. ' + data.talk.map(t => t.q).join(' ');
      return '';
    }

    function frame(sc, number, kids, extra) {
      const ask = JU.moneyUI.askButton({ profile: 'family', kind: 'lesson', lesson: n, screen: number });
      return { ask, root: h('section', { class: 'lesson-screen card', 'data-screen': number, 'data-kind': sc.kind, 'aria-label': 'Screen ' + number + ' (' + (KIND_LABEL[sc.kind] || sc.kind) + ')' }, kids, ask.note) };
    }
    function nav(number, ask, nextBtn) {
      return h('div', { class: 'lesson-nav' },
        number > 1 ? h('button', { class: 'btn', type: 'button', 'data-back': '', onclick: () => go(idx - 1) }, '\u2190 Back') : h('span'),
        ask.el, nextBtn);
    }

    function go(i) { JU.moneyUI.stop(); idx = i; draw(); }

    function draw() {
      const sc = screens[idx], number = idx + 1;
      let root, firstFocus, text = spokenFor(sc);
      if (sc.kind === 'talk') {
        const f = frame(sc, number, null);
        const finish = h('button', { class: 'btn primary big', type: 'button', 'data-finish': '', onclick: finishLesson }, 'We finished!');
        root = f.root;
        root.classList.add('calm');
        root.prepend(
          h('h2', { class: 'lesson-title' }, 'Grown-up talk'),
          h('p', { class: 'note' }, 'Take a calm minute together. There are no wrong answers. Talk about each question, then press We finished!'),
          h('ol', { class: 'talk-list' }, data.talk.map(t => h('li', null, h('span', { class: 'talk-q' }, t.q), t.note ? h('span', { class: 'talk-note' }, 'For the grown-up: ' + t.note) : null))),
          h('div', { class: 'speakrow' }, JU.moneyUI.speakRow(() => text)),
          h('div', { class: 'row center' }, finish),
          nav(number, f.ask, h('span')));
        firstFocus = root.querySelector('.lesson-title');
      } else if (sc.kind === 'ask') {
        const feedback = h('p', { class: 'feedback', role: 'status', 'aria-live': 'polite', 'data-feedback': '' });
        const next = h('button', { class: 'btn primary big', type: 'button', 'data-next': '', disabled: true, 'aria-label': 'Next (tap an answer first)', onclick: () => go(idx + 1) }, 'Next \u2192');
        const bestIdx = sc.options.findIndex(o => o.best);
        const buttons = sc.options.map((o, oi) => h('button', { class: 'opt', type: 'button', 'data-opt': oi, onclick: () => {
          buttons.forEach((b, bi) => { b.classList.toggle('picked', bi === oi); b.classList.toggle('best', bi === bestIdx); b.setAttribute('aria-pressed', bi === oi ? 'true' : 'false'); });
          buttons.forEach((b, bi) => { const tag = b.querySelector('.opt-tag'); if (tag) tag.hidden = bi !== bestIdx; });
          feedback.textContent = o.why;
          next.disabled = false; next.setAttribute('aria-label', 'Next');
          JU.moneyUI.say(o.why);
          JU.moneyUI.reveal(feedback, next);      // v10: on a laptop the explanation and Next are in view without scrolling
        } }, o.e ? h('span', { class: 'opt-e', 'aria-hidden': 'true' }, o.e) : null, h('span', { class: 'opt-label' }, o.label),
          h('span', { class: 'opt-tag', hidden: true }, '\u2B50 a strong answer')));
        const f = frame(sc, number, [
          JU.moneyArt.render(sc.art),
          h('p', { class: 'lesson-eyebrow' }, 'What would you do?'),
          h('h2', { class: 'lesson-text', tabindex: '-1' }, sc.prompt),
          h('div', { class: 'speakrow' }, JU.moneyUI.speakRow(() => text)),
          h('div', { class: 'opts' }, buttons), feedback]);
        root = f.root;
        root.insertBefore(nav(number, f.ask, next), f.ask.note);
        firstFocus = root.querySelector('.lesson-text');
      } else {
        const intro = sc.kind === 'intro';
        const next = h('button', { class: 'btn primary big', type: 'button', 'data-next': '', onclick: () => go(idx + 1) }, intro ? 'Start \u2192' : 'Next \u2192');
        const f = frame(sc, number, [
          JU.moneyArt.render(sc.art),
          intro ? h('h1', { class: 'lesson-title', tabindex: '-1' }, sc.title) : null,
          h('p', { class: 'lesson-text' + (intro ? ' intro-text' : ''), tabindex: intro ? null : '-1' }, sc.text),
          h('div', { class: 'speakrow' }, JU.moneyUI.speakRow(() => text))]);
        root = f.root;
        root.insertBefore(nav(number, f.ask, next), f.ask.note);
        firstFocus = root.querySelector('.lesson-title, .lesson-text');
      }
      mount.replaceChildren(root);
      if (firstFocus) firstFocus.focus({ preventScroll: true });
      if (sc.kind !== 'talk' && text) JU.moneyUI.say(text);
      window.scrollTo(0, 0);
    }

    async function finishLesson() {
      JU.moneyUI.stop();
      const st = await fam.getLessonState();
      const first = !st.complete[String(n)];
      if (first) await fam.setLessonComplete(n, true);
      const sticker = await fam.earnSticker('money', 'family:lesson-' + n);
      const all = await JU.money.resolved();
      const nextL = all.find(l => l.id === n + 1);
      const nextOpen = nextL && nextL.state !== 'locked' && nextL.status === 'ready';
      const number = screens.length + 1;
      const f = frame({ kind: 'done' }, number, null);
      const root = f.root;
      root.classList.add('done');
      const msg = (first ? 'Lesson ' + n + ' is finished!' : 'Lesson ' + n + ' is finished again. Nice review!') + (sticker ? ' You earned a Family sticker.' : ' Your Family sticker is already in the collection.');
      const more = nextOpen ? 'Lesson ' + (n + 1) + ' is open now.' : nextL ? 'Lesson ' + (n + 1) + ' is still being written. It will be here soon.' : '';
      const kids = 'Now each child can do their own follow-on activity from their own login.';
      root.prepend(
        h('div', { class: 'sticker-pop', 'aria-hidden': 'true', 'data-sticker': '' }, data.sticker || '\u2B50'),
        h('h2', { class: 'lesson-title', tabindex: '-1', 'data-done-title': '' }, 'We finished!'),
        h('p', { class: 'lead' }, msg),
        h('p', { class: 'lead' }, kids),
        more ? h('p', { class: 'lead' }, more) : null,
        h('div', { class: 'row center' }, h('a', { class: 'btn primary big', href: 'family.html', 'data-back-lessons': '' }, 'Back to the lessons')),
        h('div', { class: 'lesson-nav' }, h('span'), f.ask.el, h('span')));
      mount.replaceChildren(root);
      root.querySelector('.lesson-title').focus({ preventScroll: true });
      JU.moneyUI.say(msg + ' ' + kids);
      window.scrollTo(0, 0);
    }

    draw();
  };
})();
