/* kinder/play.js - plays one round after another of a kindergarten activity (kinder.html?a=letters | build).
   JU.kinderPlay(activity, profileId, mount, { preview, home }).
   The runner does everything the two activities share: a start screen, 4 items per round (plus one comeback for each item he missed, at most 2),
   the screen frame (Hear it again, a gentle voice, Ask a grown-up, a big Next picture), saving each answer under Dorian's own profile, the earned hint
   (js/hints.js, the same gate as the money activities and Julianna's games), and the sticker at the end of a round.
   An activity (js/kinder/letters.js, build.js, and in v12 sight.js, count.js, add.js) registers itself in JU.kinderGames with:
     { id, code (1 to 5, used by the flags), title, icon, intro (spoken on the start screen), plan(env) -> items, redo(env, item) -> item, draw(item, ctl) -> [nodes],
       and for the round 2 games: load() -> its own data (put on env), rules(env) -> { roundItems, maxRoundItems }, hintNoun }
   An item is { id, text (spoken), hint (spoken once the hint opens), right, sound?, ... }.
   env = { letters, cvc, answers (all saved answers plus this visit's), session, + whatever the activity's load() returned }
   ctl = { gate (the earned hint, or null), say(text), miss(guess, spoken), finish({ wrongs, extra }) }
   Rules: no timers and no progress bars; no score on his screen; a wrong tap is "Let's try again" or "Listen again", never "wrong".
   A grown-up preview (preview: true) saves nothing. */
(function () {
  const h = JU.ui.h;
  const K = JU.kinder;
  const SPEED = 0.9, SLOW = 0.65;             // on top of the saved voice speed (which is already slow)
  const SPEAKER = '\uD83D\uDD0A', TURTLE = '\uD83D\uDC22', EAR = '\uD83D\uDC42', HOME = '\uD83C\uDFE0', PLAY = '\u25B6\uFE0F', NEXT = '\u27A1\uFE0F', AGAIN = '\uD83D\uDD01';
  const say = (t, f) => JU.moneyUI.say(t, { factor: f || SPEED });
  const games = JU.kinderGames = JU.kinderGames || {};

  /* the sticker picture for round n of an activity (the same every time, so it can be shown again later) */
  const STICKER_START = { letters: 0, build: 6, sight: 3, count: 9, add: 1 };
  JU.kinderSticker = (activity, n) => K.STICKERS[(n - 1 + (STICKER_START[activity] || 0)) % K.STICKERS.length];

  JU.kinderPlay = async function (activity, profileId, mount, opts) {
    opts = opts || {};
    const preview = !!opts.preview, game = games[activity];
    if (!game) throw new Error('unknown activity ' + activity);
    const [letters, cvc] = await Promise.all([K.loadLetters(), K.loadWords()]);
    const store = JU.storage.profile(profileId);
    const saved = await store.getKinder();
    const answers = saved.answers.slice();
    let roundsDone = saved.rounds.filter(r => r.activity === activity).length;
    const session = JU.ui.uid();
    const own = game.load ? await game.load() : {};
    const env = Object.assign({ letters, cvc, answers, session }, own);
    const rules = game.rules ? game.rules(env) : (activity === 'letters' ? letters : cvc).rules;
    const noStore = { addHint: async () => { } };
    const ctx = { game: { id: 'kinder-' + activity, hintGate: true }, week: { id: 'kinder' }, subject: 'kinder', session, hintNoun: game.hintNoun || (activity === 'letters' ? 'picture' : 'word'), kid: true,
      store: preview ? noStore : store, speakButton: () => h('span'), hintCount: 0 };
    const home = opts.home || 'dorian.html';
    let queue = [], idx = 0, round = { no: roundsDone + 1, id: JU.ui.uid(), played: 0, clean: 0, comebacks: 0 };     // (a new round is planned when the start button is tapped)

    const speakRow = (getText, sound) => {
      if (!JU.speech.supported && !JU.speech.canClips) return h('p', { class: 'note', 'data-no-voice': '' }, 'Sound is not available on this browser. Ask a grown-up to help.');
      return h('span', { class: 'speakers kid-speakers k-speakers' },
        h('button', { class: 'btn round big k-hear', type: 'button', 'data-hear': '', 'aria-label': 'Hear it again', onclick: () => say(getText()) }, h('span', { 'aria-hidden': 'true' }, SPEAKER)),
        sound ? h('button', { class: 'btn round big k-ear', type: 'button', 'data-sound': '', 'aria-label': 'Hear just the sound', onclick: () => say(sound) }, h('span', { 'aria-hidden': 'true' }, EAR)) : null,
        h('button', { class: 'btn round big k-slow', type: 'button', 'data-slower': '', 'aria-label': 'Say it slower', onclick: () => say(getText(), SLOW) }, h('span', { 'aria-hidden': 'true' }, TURTLE)));
    };
    const picBtn = (cls, label, pic, onclick, attrs) => h('button', Object.assign({ class: cls, type: 'button', 'aria-label': label, onclick }, attrs || {}), h('span', { 'aria-hidden': 'true' }, pic));

    function frame(number, item, kids, ask) {
      const root = h('section', { class: 'solo-screen card kidcard k-screen', 'data-screen': number, 'data-activity': activity, 'data-item': item || null, 'aria-label': game.title + ', screen ' + number }, kids, ask.note);
      return root;
    }
    function askFor(number, item) {
      return JU.moneyUI.askButton({ profile: profileId, kind: 'kinder', lesson: game.code, screen: number, extra: item ? { item, round: round ? round.no : 0 } : { round: round ? round.no : 0 }, save: !preview, kid: true });
    }
    const homeLink = () => h('a', { class: 'btn round big k-home', href: home, 'data-home-link': '', 'aria-label': 'Go home' }, h('span', { 'aria-hidden': 'true' }, HOME));

    /* ---- start of a round ---- */
    function newRound() {
      queue = game.plan(env);
      idx = 0;
      queue.forEach(it => JU.speech.preload([it.text, it.hint, it.right, it.done, (it.sounds || []).join(' ')].join(' ')));      // warm the cache with this round's recorded clips
      round = { no: roundsDone + 1, id: JU.ui.uid(), played: 0, clean: 0, comebacks: 0 };
    }

    function drawStart() {
      const text = game.intro;
      const ask = askFor(1, null);
      const start = h('button', { class: 'btn primary kid-next k-start', type: 'button', 'data-next': '', 'data-start': '', 'aria-label': 'Start', onclick: () => { newRound(); go(0); } }, h('span', { 'aria-hidden': 'true' }, PLAY));
      const root = frame(1, null, [
        homeLink(),
        h('div', { class: 'k-bigpic', 'aria-hidden': 'true' }, game.icon),
        h('h1', { class: 'lesson-title', tabindex: '-1' }, game.title),
        preview ? h('p', { class: 'note preview-note' }, 'Grown-up preview: nothing you tap here is saved.') : null,
        h('div', { class: 'speakrow' }, speakRow(() => text)),
        h('div', { class: 'lesson-nav solo-nav' }, ask.el, start)], ask);
      mount.replaceChildren(root);
      root.querySelector('.lesson-title').focus({ preventScroll: true });
      say(text);
    }

    function go(i) { JU.moneyUI.stop(); idx = i; draw(); }

    /* ---- one item ---- */
    function drawItem() {
      const item = queue[idx], number = idx + 2;
      const ask = askFor(number, item.id);
      const feedback = h('p', { class: 'feedback k-feedback', role: 'status', 'aria-live': 'polite', 'data-feedback': '' });
      const next = h('button', { class: 'btn primary kid-next k-next', type: 'button', 'data-next': '', disabled: true, 'aria-label': 'Next (answer first)',
        onclick: () => { if (idx + 1 < queue.length) go(idx + 1); else go(queue.length); } }, h('span', { 'aria-hidden': 'true' }, NEXT));
      let gate = null, announced = false, finished = false;
      if (JU.speech.supported && !item.noHint) {         // (counting along has no wrong answer, so no hint)
        gate = JU.hints.gate(ctx, { word: item.id, say: item.hint }, 'Hear a hint');
        if (!gate.gated) gate = null;
      }
      const ctl = {
        gate, say,
        /* a gentle wrong tap: the gate counts it (or not, when it is quick or a repeat), and the voice says what to do */
        miss(guess, spoken) {
          if (finished) return;
          const opened = gate ? gate.miss(guess) : false;
          let msg = spoken;
          if (opened && !announced) { announced = true; msg += ' ' + JU.hints.KID_READY; }       // the lock turns into a light bulb: he hears it, he does not have to read it
          feedback.textContent = JU.speech.plain(spoken);
          say(msg);
        },
        async finish(o) {
          if (finished) return;
          finished = true;
          o = o || {};
          const hinted = !!(gate && gate.used());
          const wrongs = o.wrongs || 0;
          const rec = Object.assign({ session, round: round.no, activity, item: item.id, correct: wrongs === 0 && !hinted, tries: wrongs + 1, hinted }, o.extra || {});
          if (!preview) { const r = await store.addKinderAnswer(rec); answers.push(r); } else answers.push(Object.assign({ ts: new Date().toISOString(), id: JU.ui.uid() }, rec));
          round.played++; if (rec.correct) round.clean++;
          /* a missed item comes back once, two screens later (at most 2 comebacks, so a round is 4 to 6 items) */
          if (!rec.correct && !item.comeback && round.comebacks < (rules.maxRoundItems - rules.roundItems) && queue.length < rules.maxRoundItems) {
            round.comebacks++;
            const again = Object.assign(game.redo(env, item), { comeback: true });
            queue.splice(Math.min(idx + 3, queue.length), 0, again);
          }
          if (gate) gate.close();
          feedback.textContent = JU.speech.plain(o.message || '');
          next.disabled = false; next.setAttribute('aria-label', 'Next');
          const last = idx === queue.length - 1;
          if (last) next.setAttribute('aria-label', 'Finish');
          JU.moneyUI.reveal(feedback, next);
        }
      };
      const nodes = game.draw(item, ctl);
      const root = frame(number, item.id, [
        homeLink(),
        h('div', { class: 'speakrow' }, speakRow(() => item.text, item.sound)),
        ...nodes, gate ? gate.el : null, feedback,
        h('div', { class: 'lesson-nav solo-nav' }, ask.el, next)], ask);
      root.setAttribute('data-comeback', item.comeback ? '1' : '0');
      mount.replaceChildren(root);
      const f = root.querySelector('.k-focus'); if (f) f.focus({ preventScroll: true });
      say(item.text);
    }

    /* ---- end of a round: save the round, give the sticker ---- */
    let doneSaved = false;
    async function drawDone() {
      JU.moneyUI.stop();
      const number = queue.length + 2;
      let isNew = false;
      const pic = JU.kinderSticker(activity, round.no);
      if (!preview && !doneSaved) {
        doneSaved = true;
        await store.addKinderRound({ session, activity, items: round.played, clean: round.clean });
        isNew = await store.earnSticker('kinder', activity + '-' + round.no);
        roundsDone++;
      }
      const msg = 'You did it! ' + (preview ? 'This was a preview, so nothing was saved.' : 'You earned a sticker!');
      const ask = askFor(number, null);
      const again = h('button', { class: 'btn primary kid-next k-again', type: 'button', 'data-again': '', 'aria-label': 'Play one more round', onclick: () => { doneSaved = false; newRound(); go(0); } }, h('span', { 'aria-hidden': 'true' }, AGAIN));
      const root = frame(number, null, [
        h('div', { class: 'sticker-pop k-sticker', 'aria-hidden': 'true', 'data-sticker': pic }, pic),
        h('h2', { class: 'lesson-title', tabindex: '-1', 'data-done-title': '' }, 'You did it!'),
        preview ? h('p', { class: 'note preview-note' }, 'Grown-up preview: nothing was saved.') : null,
        h('div', { class: 'row center k-donebtns' }, again, h('a', { class: 'btn primary kid-next k-gohome', href: home, 'data-home': '', 'aria-label': 'Go home' }, h('span', { 'aria-hidden': 'true' }, HOME))),
        h('div', { class: 'speakrow' }, speakRow(() => msg)),
        h('div', { class: 'lesson-nav solo-nav' }, ask.el, h('span'))], ask);
      root.classList.add('done');
      mount.replaceChildren(root);
      root.querySelector('.lesson-title').focus({ preventScroll: true });
      say(msg);
    }

    function draw() {
      window.scrollTo(0, 0);
      if (idx < queue.length) drawItem(); else drawDone();
    }
    drawStart();
  };
})();
