/* weeks.js - loads data/weeks.json and each week's JSON file. */
(function () {
  const CHOSEN_KEY = 'ju_week';
  let listCache = null;

  async function getJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load ' + path);
    return r.json();
  }

  JU.weeks = {
    async list(subject) {
      if (!listCache) listCache = (await getJSON('data/weeks.json')).weeks;
      const l = subject ? listCache.filter(w => w.subject === subject) : listCache.slice();
      return l.sort((a, b) => a.id < b.id ? -1 : 1);
    },
    async load(entry) {
      const wk = await getJSON('data/' + entry.file);
      wk.id = wk.id || entry.id;
      wk.subject = wk.subject || entry.subject;
      wk.label = wk.label || entry.label;
      return wk;
    },
    async loadAll(subject) {
      const l = await this.list(subject);
      return Promise.all(l.map(e => this.load(e)));
    },
    chosenId() { return localStorage.getItem(CHOSEN_KEY); },
    choose(id) { localStorage.setItem(CHOSEN_KEY, id); },
    /* The week the child picked; otherwise the newest week that has started; otherwise the first. */
    async currentEntry(subject) {
      const l = await this.list(subject);
      if (!l.length) throw new Error('No weeks found');
      const chosen = this.chosenId();
      const hit = l.find(w => w.id === chosen);
      if (hit) return hit;
      const today = JU.ui.localDate(new Date().toISOString());
      const started = l.filter(w => w.id <= today);
      return started.length ? started[started.length - 1] : l[0];
    },
    async current(subject) { return this.load(await this.currentEntry(subject)); },

    /* One color (or null) per letter, same scheme as the printed sheets:
       syllables alternate the two syllable colors; otherwise pattern letters get the pattern color. */
    letterColors(week, w) {
      const word = w.word;
      const out = new Array(word.length).fill(null);
      if (week.syllableColors && week.syllableColors.length && w.syllables) {
        let i = 0;
        w.syllables.forEach((part, k) => {
          for (let j = 0; j < part.length; j++) out[i++] = week.syllableColors[k % week.syllableColors.length];
        });
        return out;
      }
      (week.patterns || []).forEach(p => {
        const at = word.indexOf(p.letters);
        if (at >= 0) for (let j = 0; j < p.letters.length; j++) if (!out[at + j]) out[at + j] = p.color;
      });
      return out;
    }
  };
})();
