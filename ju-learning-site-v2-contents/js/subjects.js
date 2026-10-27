/* subjects.js - the list of subjects shown on the games home.
   To add math later: push a { id:'math', ... } entry here, add data/weeks.json entries with
   "subject":"math", and add js/math/*.js files that call JU.registerGame('math', {...}). */
(function () {
  JU.subjects = [
    {
      id: 'spelling', title: 'Spelling', emoji: '\uD83D\uDCDD',
      /* order of the games on the home page; each id must be registered via JU.registerGame */
      games: ['unscramble', 'hangman', 'match', 'listen', 'clap'],
      test: 'test'
    }
  ];
})();
