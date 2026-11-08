/* kinder/levels.js - levels and stars for Dorian's games (data/kinder/levels.json).
   A ROUND is GOOD when at least UNLOCK.goodShare of its items were right on the first try with no hint.
   The next level opens when EITHER of these happens first (see K.UNLOCK, the only place to change them):
     - UNLOCK.roundsInARow good rounds in a row at the same level, or
     - UNLOCK.rightInARow right answers in a row inside one round.
   A star opens the next level. A grown-up can also open the next level (parent page).
   Saved under his kindergarten key: levels { activity: n } and stars [ { id, ts, activity, level, by } ] (js/storage.js).
   The first v14 visit to a game seeds its level from his saved answers with the old rule, so nothing he already opened closes again.
   Pure except loading, so tests can call it (JU.kinder.*). */
(function () {
  const K = JU.kinder;
  /* v16: change these three numbers to retune EVERY kindergarten game. */
  K.UNLOCK = { goodShare: 0.8, roundsInARow: 2, rightInARow: 5 };
  let cache = null;
  K.loadLevels = () => cache || (cache = fetch('data/kinder/levels.json').then(r => { if (!r.ok) throw new Error('could not load levels'); return r.json(); }).then(j => {
    j.goodShare = K.UNLOCK.goodShare; j.roundsForStar = K.UNLOCK.roundsInARow; j.rightInARow = K.UNLOCK.rightInARow; return j;
  }));
  K.LEVELED = ['letters', 'build', 'sight', 'count', 'add', 'more', 'look', 'rhyme', 'shapes', 'push', 'take'];

  K.roundGood = (round, lv) => !!round && Number(round.items) > 0 && Number(round.clean) / Number(round.items) >= lv.goodShare - 1e-9;

  /* good rounds in a row at this level since his last star in this game (newest last). Rounds saved before v14 have no level and do not count. */
  K.streak = function (kinder, activity, level, lv) {
    const stars = (kinder.stars || []).filter(s => s.activity === activity);
    const since = stars.length ? stars[stars.length - 1].ts : '';
    const rs = (kinder.rounds || []).filter(r => r.activity === activity && r.level === level && !r.warmup && r.ts > since);
    let n = 0;
    for (let i = rs.length - 1; i >= 0; i--) { if (K.roundGood(rs[i], lv)) n++; else break; }
    return n;
  };

  /* the level the old (v12/v13) rules would have opened, from his saved answers */
  K.legacyLevel = function (activity, env) {
    const a = env.answers || [];
    if (activity === 'build') return K.openTier(env.cvc, K.wordStats(a, env.cvc));
    if (activity === 'count' && env.counting) return K.countTier(env.counting, K.countStats(a, env.counting));
    if (activity === 'add' && env.adding) return K.addTier(env.adding, K.addStats(a, env.adding));
    if (activity === 'sight' && env.sight) { const st = K.sightStats(a, env.sight); return env.sight.words.filter(w => st[w.word] && st[w.word].known).length >= env.sight.rules.gapAfterKnown ? 2 : 1; }
    return 1;
  };
  K.maxLevel = (activity, lv) => (lv.games[activity] && lv.games[activity].levels) || 1;
  K.levelOf = (kinder, activity) => (kinder.levels && kinder.levels[activity]) || 1;

  /* the star path for his home page and the parent page: one entry per game */
  K.starPath = function (kinder, lv) {
    return K.LEVELED.map(a => {
      const level = K.levelOf(kinder, a), max = K.maxLevel(a, lv);
      return { activity: a, title: lv.games[a].title, level, max, stars: (kinder.stars || []).filter(s => s.activity === a).length, extra: Math.min(5, (kinder.stars || []).filter(s => s.activity === a && s.level >= max).length),
        streak: K.streak(kinder, a, level, lv), need: lv.roundsForStar, started: (kinder.rounds || []).some(r => r.activity === a) || !!(kinder.levels && kinder.levels[a]) };
    });
  };
})();
