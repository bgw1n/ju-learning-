/* kinder/cal.js - v18 yesterday, today, and tomorrow. A week strip of pictures, today marked on level 1.
   The voice says which day today is, then asks for yesterday or tomorrow. It does not say the answer.
   The choices are picture and word cards. The first tap reads the day aloud. The second tap on that card is the answer.
   Level 2 (harder top): four cards, and today is not marked on the strip. */
(function () {
  const h = JU.ui.h, K = JU.kinder;
  const DAYS = [
    { id: 'sunday', name: 'Sunday', e: '\u2600\uFE0F' },
    { id: 'monday', name: 'Monday', e: '\uD83C\uDF19' },
    { id: 'tuesday', name: 'Tuesday', e: '\u2B50' },
    { id: 'wednesday', name: 'Wednesday', e: '\uD83C\uDF08' },
    { id: 'thursday', name: 'Thursday', e: '\uD83C\uDF4E' },
    { id: 'friday', name: 'Friday', e: '\uD83C\uDF88' },
    { id: 'saturday', name: 'Saturday', e: '\u26BD' }
  ];
  const say = d => '{{w:' + d.id + '|' + d.name + '}}';
  const at = i => DAYS[(i + 7) % 7];
  K.calItem = function (hard) {
    const today = Math.floor(K.rng() * 7);
    const q = K.rng() < 0.5 ? 'yesterday' : 'tomorrow';
    const ans = at(today + (q === 'yesterday' ? -1 : 1));
    const other = at(today + (q === 'yesterday' ? 1 : -1));
    const far = at(today + 3);
    const want = hard ? [ans, other, DAYS[today], far] : [ans, other, DAYS[today]];
    const seen = {}, opts = [];
    want.forEach(d => { if (!seen[d.id]) { seen[d.id] = 1; opts.push({ id: d.id, name: d.name, e: d.e, right: d.id === ans.id }); } });
    const text = 'Today is ' + say(DAYS[today]) + '. ' + (q === 'yesterday' ? 'What was yesterday?' : 'What is tomorrow?');
    K.hidesWord(text, ans.name);
    return { id: DAYS[today].id + '-' + q, hard: !!hard, today, q, ans: ans.id, mark: !hard, opts: K.shuffle(opts), text,
      hint: q === 'yesterday' ? 'Yesterday is the day before today. Look at the days in a line.' : 'Tomorrow is the day after today. Look at the days in a line.',
      miss: 'Listen again. Today is ' + say(DAYS[today]) + '. ' + (q === 'yesterday' ? 'What was yesterday?' : 'What is tomorrow?'),
      rightMsg: 'Yes! ' + (q === 'yesterday' ? 'Yesterday was ' : 'Tomorrow is ') + say(ans) + '.' };
  };
  JU.kinderGames = JU.kinderGames || {};
  JU.kinderGames.cal = {
    id: 'cal', code: 17, title: 'Yesterday and tomorrow', icon: '\uD83D\uDCC5', hintNoun: 'day',
    intro: 'Days of the week! I will say what day today is. Tap the day I ask for. Tap a card to hear it, then tap it again to choose it. Tap the green button to start.',
    rules: () => ({ roundItems: 10, maxRoundItems: 12 }),
    plan(env) { const hard = (env.level || 1) >= 2; const out = []; for (let i = 0; i < 10; i++) out.push(K.calItem(hard)); return out; },
    redo(env, item) { return K.calItem(!!item.hard); },
    draw(item, ctl) {
      let answered = false, wrongs = 0;
      const strip = DAYS.map((d, i) => h('span', { class: 'k-day' + (item.mark && i === item.today ? ' k-today' : ''), 'data-day': d.id, 'aria-label': item.mark && i === item.today ? 'today' : 'a day' }, d.e));
      const cards = item.opts.map(o => {
        const b = h('button', { class: 'opt k-opt k-daycard', type: 'button', 'data-pick': o.id, 'data-day': o.id, 'data-hear-card': '1', 'data-right': o.right ? '1' : null, 'aria-label': o.name,
          onclick: async () => {
            if (answered || b.disabled) return;
            if (b.getAttribute('data-heard') !== '1') { b.setAttribute('data-heard', '1'); ctl.say(say(DAYS.find(d => d.id === o.id))); return; }
            if (o.right) { answered = true; cards.forEach(x => { x.disabled = true; }); b.classList.add('right'); ctl.say(item.rightMsg); await ctl.finish({ wrongs, extra: { q: item.q }, message: item.rightMsg }); }
            else { wrongs++; b.disabled = true; b.classList.add('tried'); ctl.miss('day ' + o.id, item.miss); }
          } }, h('span', { class: 'k-lpic', 'aria-hidden': 'true' }, o.e), h('span', { class: 'k-dayname' }, o.name));
        return b;
      });
      return [
        h('div', { class: 'k-week', role: 'img', 'aria-label': 'A week of days', 'data-cal': item.hard ? 'hard' : 'easy', 'data-top': item.hard ? '1' : null, 'data-mark-today': item.mark ? '1' : '0' }, strip),
        h('div', { class: 'k-daycards k-focus', tabindex: '-1', role: 'group', 'aria-label': 'Days' }, cards)];
    }
  };
})();
