/* Review: a gentle look back at words missed in earlier weeks (up to 6 words).
   It reuses the Unscramble and Listen-and-Type mechanics. The card is hidden when there is nothing to review.
   - A word is a candidate if she missed it in an earlier week (or missed it in an earlier Review).
   - A word fades out of Review after two correct Review answers in a row since her last miss.
   - Each word gets 1 step; the 2 most-missed words get a 2nd step later, in the other mechanic (so 6 to 8 steps at most).
   Results are saved as type 'review' under the current week. */
(function () {
  const h = JU.ui.h;
  const MAX_WORDS = 6;

  /* weeks: all loaded week objects; current: the week being played; results: every saved record */
  function pick(current, weeks, results) {
    const earlier = weeks.filter(w => w.id < current.id);
    const earlierIds = new Set(earlier.map(w => w.id));
    const info = {};                                   // word -> { week, w } (newest earlier week that has it)
    earlier.forEach(wk => wk.words.forEach(w => { info[w.word] = { week: wk, w }; }));
    current.words.forEach(w => { delete info[w.word]; });   // this week's own words are practiced in this week's games
    const per = {};
    results.forEach(r => {
      if (!info[r.word]) return;
      const isReview = r.type === 'review';
      if (!isReview && !earlierIds.has(r.week)) return;
      (per[r.word] = per[r.word] || []).push(r);
    });
    const cands = [];
    Object.keys(per).forEach(word => {
      const recs = per[word].sort((a, b) => a.ts < b.ts ? -1 : 1);
      const misses = recs.filter(r => !r.correct);
      if (!misses.length) return;
      const lastMiss = misses[misses.length - 1].ts;
      const goodAfter = recs.filter(r => r.type === 'review' && r.correct && r.ts > lastMiss).length;
      if (goodAfter >= 2) return;
      cands.push({ word, misses: misses.length, lastMiss, info: info[word] });
    });
    cands.sort((a, b) => b.misses - a.misses || (a.lastMiss < b.lastMiss ? 1 : -1) || (a.word < b.word ? -1 : 1));
    const chosen = JU.ui.shuffle(cands.slice(0, MAX_WORDS));
    const first = chosen.map((c, i) => ({ w: c.info.w, week: c.info.week, mech: i % 2 === 0 ? 'unscramble' : 'listen' }));
    const top2 = cands.slice(0, 2).filter(c => c.misses >= 2).map(c => c.word);
    const second = first.filter(it => top2.indexOf(it.w.word) !== -1)
      .map(it => ({ w: it.w, week: it.week, mech: it.mech === 'unscramble' ? 'listen' : 'unscramble' }));
    return first.concat(second);
  }

  const def = {
    id: 'review', title: 'Review', emoji: '\uD83C\uDF31', sticker: '\uD83C\uDF1F',
    blurb: 'A few tricky words from before. No rush.',
    noRounds: true, noSticker: true,
    async items(ctx) {
      const weeks = await JU.weeks.loadAll(ctx.subject);
      return pick(ctx.week, weeks, await JU.storage.getResults());
    },
    empty(ctx) {
      ctx.stage.replaceChildren(h('div', { class: 'card center' },
        h('h2', null, 'Nothing to review right now'),
        h('p', { class: 'lead' }, 'You are all caught up. Pick a game to play!'),
        h('a', { class: 'btn primary', href: 'child.html' }, 'Back to games')));
    },
    intro(ctx) {
      return new Promise(resolve => {
        const go = h('button', { class: 'btn primary big', type: 'button', onclick: () => resolve() }, 'Let\u2019s look again');
        ctx.stage.replaceChildren(h('div', { class: 'card center' },
          h('h2', null, 'A little review'),
          h('p', { class: 'lead' }, 'Here are a few words from earlier weeks. Take your time. You can hear any word as many times as you like.'),
          go));
        go.focus();
      });
    },
    playWord(ctx, item) {
      const mech = JU.games.spelling[item.mech];
      const sub = Object.create(ctx);      // same stage and recorder, but the word's own week (for its colors)
      sub.week = item.week;
      return mech.playWord(sub, item.w);
    },
    async finish(ctx) {
      const tricky = ctx.results.filter(r => !r.correct);
      const seen = new Set();
      const chips = [];
      tricky.forEach(r => {
        if (seen.has(r.word)) return; seen.add(r.word);
        const it = ctx.words.find(x => x.w.word === r.word);
        if (it) chips.push(h('span', { class: 'chip' }, JU.ui.coloredWord(it.week, it.w, { split: true })));
      });
      ctx.stage.replaceChildren(h('div', { class: 'card center finish' },
        h('div', { class: 'sticker-pop', 'aria-hidden': 'true' }, '\uD83C\uDF1F'),
        h('h2', null, 'Nice review!'),
        h('p', { class: 'lead' }, 'Looking back at words helps them stick.'),
        chips.length ? h('div', { class: 'tricky' }, h('p', null, 'These ones will come back another day:'), h('div', { class: 'chips' }, chips))
          : h('p', { class: 'lead' }, 'You spelled every one. Wow!'),
        h('div', { class: 'row' },
          h('a', { class: 'btn primary', href: 'child.html' }, 'Back to games'))));
      ctx.stage.querySelector('a.btn').focus();
    }
  };
  JU.registerGame('spelling', def);
  JU.review = { pick };
})();
