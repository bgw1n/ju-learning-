/* Site settings. Change the PINs here.
   NOTE: this is a casual gate, not real security. Anyone who views the page source can read these. */
window.JU = window.JU || {};
JU.config = {
  childName: 'Julianna',
  childPin: '0518',   // Julianna's games (kept so older code still works)
  parentPin: '1821',  // the grown-up page
  /* One PIN per profile. Roles: julianna, dorian, family, parent. */
  pins: {
    julianna: '0518',
    dorian: '1357',
    family: '2468',
    parent: '1821'
  },
  /* The people shown on the "Who's playing?" screen, in order. */
  profiles: [
    { id: 'julianna', name: 'Julianna', emoji: '\uD83C\uDF1F', home: 'child.html' },
    { id: 'dorian', name: 'Dorian', emoji: '\uD83D\uDE80', home: 'dorian.html' },
    { id: 'family', name: 'Family', emoji: '\uD83C\uDFE0', home: 'family.html' }
  ]
};
