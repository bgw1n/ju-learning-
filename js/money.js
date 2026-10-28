/* money.js - the Family "Money & Economics" course: the lesson list and the unlock rules.
   Lessons come from data/money/lessons.json: [{ id, unit, unitTitle, title, status, icon? }].
   status is about the CONTENT: 'coming-soon' (not written yet) or 'ready'. Whether a lesson is open or locked
   is worked out here from what the Family profile has finished (storage.profile('family').getLessonState()).

   A lesson that is 'ready' has a content file, data/money/lesson-<id>.json (see README, "Money & Economics"):
     { id, title, sticker, screens: [ intro | story | ask ... ], talk: [ { q, note } ], solo: { julianna: {...}, dorian: {...} } }
   js/money/family.js plays the family lesson, js/money/solo.js plays a child's follow-on, js/money/art.js draws the pictures.
   A child's solo activity opens once the Family has finished that lesson. */
(function () {
  let cache = null;
  async function load() {
    if (!cache) {
      const res = await fetch('data/money/lessons.json');
      if (!res.ok) throw new Error('could not load the lessons');
      cache = await res.json();
    }
    return cache;
  }

  /* Pure. lessons: the list, in order. state: { complete: {id: ISO}, override: {id: 'open'|'locked'} }.
     Returns one { ...lesson, state: 'locked'|'open'|'complete', complete: bool, override: null|'open'|'locked' } per lesson.
     Rules: lesson 1 is open, and lesson N opens when lesson N-1 is marked complete.
            A grown-up can force a lesson 'open' early or 'locked' again; locked wins. */
  function resolve(lessons, state) {
    const complete = (state && state.complete) || {}, override = (state && state.override) || {};
    return lessons.map((l, i) => {
      const prev = lessons[i - 1];
      const natural = !prev || !!complete[String(prev.id)];
      const ov = override[String(l.id)] || null;
      const done = !!complete[String(l.id)];
      let st;
      if (ov === 'locked') st = 'locked';
      else if (done) st = 'complete';
      else if (ov === 'open' || natural) st = 'open';
      else st = 'locked';
      return Object.assign({}, l, { state: st, complete: done, override: ov });
    });
  }

  async function resolved() {
    return resolve(await load(), await JU.storage.profile('family').getLessonState());
  }

  const lessonCache = {};
  /* The content file for one 'ready' lesson. Rejects when there is none. */
  async function loadLesson(n) {
    n = Number(n);
    if (!lessonCache[n]) {
      const res = await fetch('data/money/lesson-' + n + '.json');
      if (!res.ok) throw new Error('could not load lesson ' + n);
      lessonCache[n] = await res.json();
    }
    return lessonCache[n];
  }

  /* The 'ready' lessons with this child's follow-on state: [{ id, title, open (the Family finished it), done (the child finished the activity) }].
     profileId: 'julianna' | 'dorian'. */
  async function soloList(profileId) {
    const list = await resolved();
    const m = await JU.storage.profile(profileId).getMoney();
    return list.filter(l => l.status === 'ready').map(l => ({ id: l.id, title: l.title, unit: l.unit, icon: l.icon || '\u2B50', open: l.complete, done: !!m.done[String(l.id)] }));
  }

  /* Log an "Ask a grown-up" press for this profile. kind: 'lesson' (family lesson), 'solo', or 'kinder' (Dorian's kindergarten track:
     lesson 1 = Letter sounds, 2 = Build a word); screen is 1-based. extra: more fields to keep, such as { item: 'm' }. */
  function flag(profileId, kind, lesson, screen, extra) {
    return JU.storage.profile(profileId).addFlag(Object.assign({}, extra || {}, { kind, lesson: Number(lesson), screen: Number(screen) }));
  }

  JU.money = { load, resolve, resolved, loadLesson, soloList, flag };
})();
