/* auth.js - casual PIN gate (NOT real security; see README). Role is kept in sessionStorage.
   Roles: 'julianna', 'dorian', 'family', 'parent'. */
(function () {
  const KEY = 'ju_role';
  const HOME = { julianna: 'child.html', dorian: 'dorian.html', family: 'family.html', parent: 'parent.html' };
  JU.auth = {
    HOME,
    ROLES: ['julianna', 'dorian', 'family', 'parent'],
    /* The saved role. A session started before v6 stored 'child'; that is Julianna. */
    role() {
      const r = sessionStorage.getItem(KEY);
      return r === 'child' ? 'julianna' : r;
    },
    /* Log in as one profile: login('julianna', '0518'). Returns the role, or null when the PIN is wrong. */
    login(who, pin) {
      const want = JU.config.pins[who];
      if (!want || typeof pin !== 'string' || pin !== want) return null;
      sessionStorage.setItem(KEY, who);
      return who;
    },
    homeFor(role) { return HOME[role] || 'index.html'; },
    /* True when pin is the parent PIN. Does not log anyone in or change the role (used by the hint "Grown-up unlock"). */
    verifyParent(pin) { return typeof pin === 'string' && pin === JU.config.pins.parent; },
    logout() { sessionStorage.removeItem(KEY); location.replace('index.html'); },
    /* Call in <head>. allowed = ['julianna','parent'] etc. Hides the page until the check passes;
       anyone not logged in, or in the wrong role, goes back to the landing page. */
    require(allowed) {
      document.documentElement.style.visibility = 'hidden';
      if (allowed.indexOf(JU.auth.role()) === -1) { location.replace('index.html'); return false; }
      document.documentElement.style.visibility = '';
      return true;
    }
  };
})();
