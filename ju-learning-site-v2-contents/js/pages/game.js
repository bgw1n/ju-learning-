/* game.html?s=spelling&g=unscramble   (add &proctor=1 for a grown-up-run test) */
(function () {
  const q = new URLSearchParams(location.search);
  const subject = q.get('s') || 'spelling';
  const gameId = q.get('g') || 'unscramble';
  const proctored = q.get('proctor') === '1' && JU.auth.role() === 'parent';
  const g = JU.games[subject] && JU.games[subject][gameId];
  JU.ui.header({
    title: g ? g.title : 'Game',
    backHref: proctored ? 'parent.html' : 'child.html',
    backLabel: proctored ? 'Grown-up page' : 'Games',
    showDashLink: false
  });
  document.title = (g ? g.title : 'Play') + ' - ' + JU.config.childName + '\u2019s Learning Place';
  JU.runGame(subject, gameId, { proctored });
})();
