/* auth.js - casual PIN gate (NOT real security; see README). Role is kept in sessionStorage. */
(function () {
  const KEY = 'ju_role';
  JU.auth = {
    role() { return sessionStorage.getItem(KEY); },
    login(pin) {
      let role = null;
      if (pin === JU.config.childPin) role = 'child';
      else if (pin === JU.config.parentPin) role = 'parent';
      if (role) sessionStorage.setItem(KEY, role);
      return role;
    },
    /* True when pin is the parent PIN. Does not log anyone in or change the role (used by the hint "Grown-up unlock"). */
    verifyParent(pin) { return typeof pin === 'string' && pin === JU.config.parentPin; },
    logout() { sessionStorage.removeItem(KEY); location.replace('index.html'); },
    /* Call in <head>. allowed = ['child','parent'] etc. Hides the page until the check passes. */
    require(allowed) {
      document.documentElement.style.visibility = 'hidden';
      if (allowed.indexOf(JU.auth.role()) === -1) { location.replace('index.html'); return false; }
      document.documentElement.style.visibility = '';
      return true;
    }
  };
})();
