/* runner.js - game registry and the shared "play every word" loop.
   A game is: { id, title, emoji, sticker, blurb, intro?(ctx), playWord(ctx, word) -> Promise, finish?(ctx) }.
   playWord draws into ctx.stage and resolves when that word is finished. It should call ctx.record(...) once. */
(function () {
  JU.games = {};
  JU.registerGame = function (subject, def) {
    (JU.games[subject] = JU.games[subject] || {})[def.id] = def;
  };
  const h = JU.ui.h;

  async function run(subject, gameId, opts) {
    opts = opts || {};
    const stage = document.getElementById('stage');
    const g = JU.games[subject] && JU.games[subject][gameId];
    if (!g) { stage.replaceChildren(h('p', { class: 'big' }, 'Hmm, we could not find that game.')); return; }
    const week = await JU.weeks.current(subject);
    let words = [];
    const session = JU.ui.uid();
    const results = [];
    let cleanups = [];

    const ctx = {
      stage, week, words, game: g, session, results, subject,
      proctored: !!opts.proctored,
      round: 1,
      async record(r) {
        const rec = Object.assign({
          id: JU.ui.uid(), ts: new Date().toISOString(), session, week: week.id, subject,
          type: g.id, proctored: !!opts.proctored
        }, r);
        /* a word where the spoken hint was used does not count as right (so it is not treated as mastered) */
        const gt = ctx.currentGate && ctx.currentGate.word === rec.word ? ctx.currentGate : null;
        if (gt) { if (gt.used()) { rec.correct = false; rec.hinted = true; } gt.close(); }
        results.push(rec);
        await JU.storage.addResult(rec);
        return rec;
      },
      clear() { stage.replaceChildren(); },
      /* keyboard listener that is removed automatically when the word ends */
      onKey(fn) {
        /* keys typed into a text box (like the grown-up PIN) are not game keys */
        const handler = e => { const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return; fn(e); };
        document.addEventListener('keydown', handler);
        cleanups.push(() => document.removeEventListener('keydown', handler));
      },
      /* A calm full-stage message with one button. Resolves when pressed. */
      pause(title, text, button) {
        return new Promise(resolve => {
          const btn = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, button || 'Keep going');
          stage.replaceChildren(h('div', { class: 'card center pause' },
            h('h2', null, title), text ? h('p', { class: 'lead' }, text) : null, btn));
          btn.focus();
        });
      },
      /* tag shown above each word so she knows which round she is in */
      roundTag() { return g.noRounds ? h('span') : h('div', { class: 'round-tag' }, 'Round ' + ctx.round); },
      /* the earned "Hear the word" hint for the puzzle games: { el, miss(guess), ... }. See js/hints.js. */
      hintGate(w, label) { return JU.hints.gate(ctx, w, label); },
      /* a speaker button for the current word or any text */
      speakButton(text, label, extra) {
        if (!JU.speech.supported) return h('span', { class: 'note' }, 'Sound is not available on this browser. Ask a grown-up to read it to you.');
        const sentence = extra && extra.sentence;
        const speak = factor => sentence ? JU.speech.dictate(text, sentence, { factor }) : JU.speech.say(text, { factor });
        return h('span', { class: 'speakers' },
          h('button', { class: 'btn round', type: 'button', onclick: () => speak(1) },
            h('span', { 'aria-hidden': 'true' }, '\uD83D\uDD0A'), ' ', label || 'Hear it'),
          h('button', { class: 'btn small', type: 'button', 'aria-label': 'Say it slower', onclick: () => speak(0.7) },
            h('span', { 'aria-hidden': 'true' }, '\uD83D\uDC22'), ' Slower'));
      }
    };

    try {
      /* a game may choose its own items (the Review game does); otherwise it is this week's words */
      words = g.items ? await g.items(ctx) : JU.ui.shuffle(week.words);
      ctx.words = words;
      if (!words.length) { if (g.empty) g.empty(ctx); return; }
      if (g.intro) await g.intro(ctx);
      for (let i = 0; i < words.length; i++) {
        ctx.round = i < 6 ? 1 : 2;
        ctx.index = i;
        await g.playWord(ctx, words[i]);
        cleanups.forEach(f => f()); cleanups = [];
        JU.speech.stop();
        if (i === 5 && words.length > 6 && !g.noRounds) {
          await ctx.pause('Nice work!', 'Round 1 is done. Ready for the last ' + (words.length - 6) + ' words?', 'Start round 2');
        }
      }
      if (g.finish) await g.finish(ctx); else await defaultFinish(ctx);
    } catch (e) {
      console.error(e);
      stage.replaceChildren(h('div', { class: 'card center' }, h('h2', null, 'Oops!'),
        h('p', null, 'Something went wrong. Please tell a grown-up.'),
        h('a', { class: 'btn primary', href: 'child.html' }, 'Back to games')));
    }
  }

  async function defaultFinish(ctx) {
    const g = ctx.game;
    let isNew = false;
    if (!g.noSticker) isNew = await JU.storage.earnSticker(ctx.week.id, ctx.subject + ':' + g.id);
    const tricky = ctx.results.filter(r => !r.correct).map(r => ctx.week.words.find(w => w.word === r.word)).filter(Boolean);
    ctx.stage.replaceChildren(h('div', { class: 'card center finish' },
      h('div', { class: 'sticker-pop', 'aria-hidden': 'true' }, g.sticker || '\u2B50'),
      h('h2', null, 'You finished ' + g.title + '!'),
      h('p', { class: 'lead' }, isNew ? 'You earned a new sticker! \uD83C\uDF89' : 'Your sticker is already in your collection. Great practice!'),
      tricky.length ? h('div', { class: 'tricky' },
        h('p', null, 'Words to look at one more time:'),
        h('div', { class: 'chips' }, tricky.map(w => h('span', { class: 'chip' }, JU.ui.coloredWord(ctx.week, w, { split: true }))))) : h('p', { class: 'lead' }, 'You spelled every word like a star!'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Play again'),
        h('a', { class: 'btn primary', href: ctx.proctored ? 'parent.html' : 'child.html' }, ctx.proctored ? 'Back to grown-up page' : 'Back to games'))));
    const first = ctx.stage.querySelector('a.btn.primary'); if (first) first.focus();
  }

  JU.runGame = run;
})();
