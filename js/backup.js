/* backup.js - the backup reminder. No network, no timers: it only looks at the date of the last backup
   (storage.getLastBackup) and the saved results when a page loads, and decides whether to remind a grown-up.
   Shows when there are saved results and any of these is true:
     - 'never': no backup has ever been saved on this device
     - 'week':  a school week has ended since the last backup (a week starts on its Monday in data/weeks.json
                and counts as over from Saturday 00:00, local time)
     - 'old':   the last backup is more than 7 days old
   Parent page: a banner with a Save backup now button. Child page: one gentle line, no button. */
(function () {
  const DAY = 86400000;

  function weekEnd(id) {                      // "YYYY-MM-DD" (a Monday) -> that Saturday 00:00, local time
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3] + 5) : null;
  }

  /* Pure decision. results: array; last: ISO string or null; weekIds: week ids; now: Date.
     Returns { show, reason: 'never'|'week'|'old'|null, last }. */
  function decide(results, last, weekIds, now) {
    const out = { show: false, reason: null, last: last || null };
    if (!results || !results.length) return out;
    const lastT = last ? new Date(last).getTime() : NaN;
    if (isNaN(lastT)) { out.reason = 'never'; out.show = true; return out; }
    const ended = (weekIds || []).map(weekEnd).filter(d => d && d.getTime() <= now.getTime()).map(d => d.getTime());
    const latestEnd = ended.length ? Math.max.apply(null, ended) : null;
    if (latestEnd != null && lastT < latestEnd) { out.reason = 'week'; out.show = true; }
    else if (now.getTime() - lastT > 7 * DAY) { out.reason = 'old'; out.show = true; }
    return out;
  }

  function fmt(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function status() {
    let ids = [];
    try { ids = (await JU.weeks.list(JU.subjects[0].id)).map(w => w.id); } catch (e) { /* no week list: the other rules still work */ }
    /* anything saved by any profile counts: Julianna's results, Dorian's, the Family's, and finished family lessons */
    const c = await JU.storage.counts();
    const some = c.julianna.results + c.dorian.results + c.family.results + c.family.lessonsDone + c.julianna.money.answers + c.dorian.money.answers + c.julianna.money.done + c.dorian.money.done;
    return decide(some ? [{}] : [], await JU.storage.getLastBackup(), ids, new Date());
  }

  const WHY = {
    never: 'Results are saved on this laptop, but no backup file has been made yet.',
    week: 'The week is over, so it is a good time to keep a copy of this week\u2019s results.',
    old: 'It has been more than a week since the last backup.'
  };

  /* Parent page banner. el is the hidden <section id="backup-banner">; save() downloads the backup (the same one as Save progress). */
  async function showBanner(el, save) {
    const s = await status();
    if (!s.show) { el.hidden = true; el.replaceChildren(); return s; }
    const h = JU.ui.h;
    const btn = h('button', { id: 'backup-now', class: 'btn primary big', type: 'button' }, 'Save backup now');
    btn.addEventListener('click', async () => { btn.disabled = true; await save(); });
    el.replaceChildren(
      h('h2', { id: 'backup-banner-h' }, 'Time to save a backup'),
      h('p', { class: 'lead', id: 'backup-why' }, WHY[s.reason]),
      h('div', { class: 'row' }, btn),
      h('p', { class: 'note', id: 'backup-last' }, s.last ? 'Last backup: ' + fmt(s.last) : 'No backup has been saved on this device yet.'),
      h('p', { class: 'note', id: 'backup-or' }, 'Or use Back up to Grok Bot below to save the file and email it in one click.'));
    el.hidden = false;
    return s;
  }

  /* Child page: one quiet line, no button. */
  async function showHint(el) {
    const s = await status();
    el.hidden = !s.show;
    return s;
  }

  JU.backup = { decide, status, showBanner, showHint, weekEnd };
})();
