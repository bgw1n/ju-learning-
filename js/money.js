/* money.js - the Family "Money & Economics" course: the lesson list and the unlock rules.
   Lessons come from data/money/lessons.json: [{ id, unit, unitTitle, title, status }].
   status is about the CONTENT: 'coming-soon' (not written yet) or 'ready'. Whether a lesson is open or locked
   is worked out here from what the Family profile has finished (storage.profile('family').getLessonState()). */
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

  JU.money = { load, resolve, resolved };
})();
