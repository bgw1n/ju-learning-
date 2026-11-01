/* kinder/warmup.js - v14: the daily warm-up. A short mixed round (5 questions): a letter sound (only once every letter sound is recorded,
   the same rule as the Letter sounds button), sight words and counting, taken from his own games at his own levels, so old things stay fresh.
   Each answer is saved under its own game (activity letters / sight / count, with warmup: true), so it helps those games too; the round itself is
   saved as activity 'warmup' and never counts toward a star. Dorian's home shows it first, with a check mark once it is done today. */
(function () {
  const K = JU.kinder, G = () => JU.kinderGames;
  const tag = (game, it) => Object.assign(it, { activity: game, warmupOf: game });
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.warmup = {
    id: 'warmup', code: 6, title: 'Warm-up', icon: '\u2600\uFE0F', hintNoun: 'answer',
    intro: 'Good morning! Time to warm up. A letter, some words, and some counting. Tap the green button to start.',
    async load() {
      const [sight, counting, lv] = await Promise.all([K.loadSight(), K.loadCounting(), K.loadLevels()]);
      let lettersReady = false;
      try { lettersReady = (await JU.recordings.letterProgress()).ready; } catch (e) { }
      return { sight, counting, lettersReady, levels: (await JU.storage.profile('dorian').getKinder()).levels || {} };
    },
    rules: () => ({ roundItems: 5, maxRoundItems: 6 }),
    plan(env) {
      const lvl = a => env.levels[a] || 1, out = [];
      const sub = (a, extra) => Object.assign({}, env, { level: lvl(a) }, extra || {});
      if (env.lettersReady) { const se = sub('letters'), l = G().letters.plan(se); env.active = se.active; if (l.length) out.push(tag('letters', l[0])); }
      /* sight words: plain "find the word" questions (4 look-alike cards) */
      const sp = K.planSight(env.sight, env.answers, 1).items.filter(i => i.type !== 'twice');
      sp.slice(0, out.length ? 2 : 3).forEach(i => out.push(tag('sight', K.sightItem(env.sight, i.w, 'hunt'))));
      /* counting: two "how many" questions, the numbers he already has open */
      const cp = K.planCount(env.counting, env.answers, lvl('count')).items;
      const nums = K.shuffle(cp.map(i => i.n)).slice(0, 2);
      nums.forEach(n => out.push(tag('count', K.countItem(env.counting, n, 'howmany'))));
      return K.shuffle(out).slice(0, 5);
    },
    redo(env, item) {
      if (item.warmupOf === 'letters') return tag('letters', G().letters.redo(env, item));
      if (item.warmupOf === 'sight') return tag('sight', G().sight.redo(env, item));
      return tag('count', G().count.redo(env, item));
    },
    draw(item, ctl) { return G()[item.warmupOf].draw(item, ctl); },
    afterDraw(item, root, ctl) { const g = G()[item.warmupOf]; if (g.afterDraw) g.afterDraw(item, root, ctl); }
  };
})();
