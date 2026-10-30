#!/usr/bin/env python3
"""Build Money lessons 5 to 8 (Unit 2, "Using money") from data/money/family-numbers.json.

  python3 tools/build_money_unit2.py            # write data/money/lesson-5.json .. lesson-8.json and mark lessons 5-8 ready in lessons.json
  python3 tools/build_money_unit2.py --check    # write nothing; exit 1 when the lesson files are not what the numbers file would build

Every family-specific number (50 tokens a week, 10 a day, the treasure, the 10-token special treat, the example split of the week, and the store examples)
lives in data/money/family-numbers.json. Change a number there and run this script: the questions, the right answers and the explanations all follow.
The script stops with a message when the numbers cannot make a sensible lesson (for example a split that does not add up to the week).
The lesson files have the same shape as lessons 1 to 4 (see README, "Money & Economics")."""
import argparse, copy, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
DATA = os.path.join(SITE, 'data', 'money')
ICONS = {5: '\U0001F3F7\uFE0F', 6: '\U0001F3AF', 7: '\U0001F49D', 8: '\U0001F4CB'}


def die(msg): sys.exit('build_money_unit2.py: ' + msg)
def need(cond, msg):
    if not cond: die(msg)

# ---------------------------------------------------------------- small builders
def row(items, alt): return {'kind': 'row', 'items': items, 'alt': alt}
def chip(t): return {'t': t}
def pic(e, label): return {'e': e, 'label': label}
def bal(frm, spend, to, alt): return {'kind': 'balance', 'from': frm, 'spend': spend, 'to': to, 'alt': alt}
def piles(ps, alt): return {'kind': 'piles', 'piles': ps, 'alt': alt}
def pile(n, label=None, glyph='coin'):
    d = {'n': n, 'glyph': glyph}
    if label: d['label'] = label
    return d
def intro(title, text, art): return {'kind': 'intro', 'title': title, 'text': text, 'art': art}
def story(text, art=None):
    s = {'kind': 'story', 'text': text}
    if art: s['art'] = art
    return s
def best(label, why, e=None):
    o = {'label': label, 'why': why, 'best': True}
    if e: o['e'] = e
    return o
def other(label, why, e=None):
    o = {'label': label, 'why': why}
    if e: o['e'] = e
    return o
def ask(prompt, options, art=None):
    need(sum(1 for o in options if o.get('best')) == 1, 'an ask screen needs exactly one strong answer: ' + prompt)
    s = {'kind': 'ask', 'prompt': prompt, 'options': options}
    if art: s['art'] = art
    return s
def opt(label, right=False, **kw):
    o = {'label': label}
    o.update(kw)
    if right: o['right'] = True
    return o
def choose(id, prompt, options, hint, why, art=None, say=None):
    need(sum(1 for o in options if o.get('right')) == 1, 'a choose item needs exactly one right answer: ' + id)
    it = {'type': 'choose', 'id': id, 'prompt': prompt, 'options': options, 'hint': hint, 'why': why}
    if art: it['art'] = art
    if say: it['say'] = say
    return it
def count(id, n, prompt, done): return {'type': 'count', 'id': id, 'n': n, 'prompt': prompt, 'doneText': done}

def shuffle_right(options, i):
    """Put the right answer in a different place for each question (position i % 3), so it is not always first."""
    right = [o for o in options if o.get('right') or o.get('best')]
    rest = [o for o in options if not (o.get('right') or o.get('best'))]
    pos = i % len(options)
    return rest[:pos] + right + rest[pos:]

# ---------------------------------------------------------------- the numbers
def load_numbers():
    n = json.load(open(os.path.join(DATA, 'family-numbers.json'), encoding='utf-8'))
    c, p, s = n['confirmed'], n['placeholders'], n['storeExamples']
    N = {'tpd': c['tokensPerDollar'], 'week': c['weeklyTokens'], 'week_d': c['weeklyDollars'], 'daily': c['tokensPerDay'],
         'treasure': c['treasureTokens'], 'treasure_d': c['treasureDollars'], 'treat': c['specialTreatTokens'],
         'gives': c['familyGivesYet'], 'wait': c['waitADayRule'], 'split': p['weeklySplit'], 'store': s, 'b0': s['startBalanceDollars']}
    need(N['treasure'] == N['treasure_d'] * N['tpd'], 'treasureTokens must be treasureDollars times tokensPerDollar')
    need(N['week'] == N['week_d'] * N['tpd'], 'weeklyTokens must be weeklyDollars times tokensPerDollar')
    need(sum(N['split'].values()) == N['week'], 'weeklySplit must add up to weeklyTokens')
    need(N['split']['treats'] >= N['treat'] and N['split']['treats'] % N['treat'] == 0, 'the treats part must hold a whole number of special treats')
    for k in ('snack', 'book', 'pencilCase'):
        need(k in s and s[k]['dollars'] > 0, 'storeExamples needs a ' + k)
    S = lambda k: s[k]['dollars']
    N['S'] = S
    d = N['daily']
    N['days'] = math.ceil(N['treasure'] / d)
    N['days_after'] = math.ceil((N['treasure'] + N['treat']) / d)
    N['weeks'] = math.ceil(N['treasure'] / N['week'])
    need(N['days_after'] > N['days'], 'spending on a special treat must move the goal later')
    need(N['treat'] <= 20 and N['week'] <= 100, 'Dorian\u2019s piles must stay at 20 or under')
    return N

def dollars(n): return '%d dollar%s' % (n, '' if n == 1 else 's')
def tokens(n): return '%d token%s' % (n, '' if n == 1 else 's')
def money(n): return '$%d' % n

# ---------------------------------------------------------------- lesson 5
def lesson5(N):
    S, st, tr, d, W, tpd = N['S'], N['store'], N['treat'], N['daily'], N['week'], N['tpd']
    sn = S('snack'); b0 = N['b0']
    screens = [
        intro('Lesson 5: Prices and trade-offs', 'A price tells us what something costs, and what we give up to get it. Let us learn about prices. Press Start when you are ready.',
              row(['\U0001F3F7\uFE0F', '\U0001F6D2'], 'A price tag and a shopping cart')),
        story('At a store, things have a price tag. For example, a store might sell a %s for %s. We can pay with cash from our hand, or with a card swipe.' % (st['snack']['label'], dollars(sn)),
              row([pic(st['snack']['emoji'], 'a store snack'), chip(money(sn))], 'A store snack that costs %s' % dollars(sn))),
        story('With cash, %s leaves our hand and the store has it.' % dollars(sn), {'kind': 'flow', 'amount': sn, 'alt': 'Cash goes from our hand to the store'}),
        story('With a swipe, nothing is in our hand, but %s still leaves. The account goes from %s down to %s. A swipe is real money leaving.' % (dollars(sn), dollars(b0), dollars(b0 - sn)),
              bal(b0, sn, b0 - sn, 'Swipe %s: the account goes from %s to %s' % (dollars(sn), dollars(b0), dollars(b0 - sn)))),
        story('In our family, we use tokens. A special treat costs %s. We earn about %s a day, so a special treat costs about one day of earning.' % (tokens(tr), tokens(d)),
              row([pic('\U0001F366', 'a special treat'), chip(tokens(tr))], 'A special treat costs %s' % tokens(tr))),
        ask('A special treat costs %s. We earn about %s a day. How many days of earning is a special treat?' % (tokens(tr), tokens(d)), shuffle_right([
            best('About 1 day', 'Yes. %s a day, and the treat is %s, so it is about one day of earning.' % (tokens(d), tokens(tr)), '\U0001F4C5'),
            other('About 5 days', 'That is too many. One day of earning is about %s, which is the price of the treat.' % tokens(d), '\U0001F40C'),
            other('It is free', 'A treat is not free. It costs %s, which we earned.' % tokens(tr), '\U0001F193')], 1)),
        story('We can only spend each token once. Say we have %s. We can get a special treat now, or save those %s toward the treasure. We cannot do both with the same tokens. Picking one and giving up the other is a trade-off.' % (tokens(tr), tokens(tr)),
              row([pic('\U0001F366', 'treat now'), chip('or'), pic('\U0001F381', 'save for the treasure')], 'A treat now, or tokens saved for the treasure')),
        ask('We have %s. A special treat costs %s. What is true?' % (tokens(tr), tokens(tr)), shuffle_right([
            best('We can get the treat, or save the tokens. Not both.', 'Yes. The same %s cannot go two places. What we skip is what we gave up.' % tokens(tr), '\u2696\uFE0F'),
            other('We can get the treat and still save the same tokens.', 'Once the tokens pay for the treat, they are gone. They cannot be saved too.', '\U0001F6CD\uFE0F'),
            other('Tokens never run out.', 'Tokens do run out. We earn about %s a week.' % tokens(W), '\u267E\uFE0F')], 0)),
        ask('Is a special treat worth %s to you?' % tokens(tr), shuffle_right([
            best('It depends on what else those tokens could do. Think about the trade-off.', 'Yes. A price is worth paying when what we get matters more to us than what we give up.', '\U0001F914'),
            other('Always buy every treat.', 'If we buy every treat, the tokens run out and the treasure gets further away.', '\U0001F6D2'),
            other('Never get a treat.', 'Treats can be a fine choice. The idea is to think, not to never buy.', '\u274C')], 2)),
    ]
    talk = [
        {'q': 'When did we last have a special treat? Was it worth %s?' % tokens(tr), 'note': 'In our family a special treat costs %s, about one day of earning. There are no family token prices for toys or games.' % tokens(tr)},
        {'q': 'When we picked one thing, what did we give up? Is that always true when we spend?', 'note': 'Yes: spending on one thing means less for another. That is the trade-off.'},
        {'q': 'At a store, a swipe takes real money out of an account. How is paying with a card like paying with cash?', 'note': 'In both, money leaves and the store gets it. The store prices in the lesson are examples.'},
        {'q': 'If a child pressed Ask a grown-up in this lesson, what was the question?', 'note': 'Common ones: "Do we really pay for this?" (yes, even a swipe) and what other things could cost tokens (you decide; right now only special treats do).'}]
    J = [
        choose('p1', 'You have %s. A special treat costs %s. How many special treats could you get?' % (tokens(2 * tr), tokens(tr)), shuffle_right([
            opt('2', True), opt('1'), opt('%d' % (2 * tr))], 1),
            'How many %ss make %d?' % (tr, 2 * tr), 'Right. %d and %d make %d, so 2 treats.' % (tr, tr, 2 * tr)),
        choose('p2', 'You have %s and you get a special treat for %s. How many tokens are left?' % (tokens(25), tokens(tr)), shuffle_right([
            opt(tokens(25 - tr), True), opt(tokens(25 + tr)), opt(tokens(25))], 2),
            'Spending takes tokens away.', 'Right. 25 take away %d is %d.' % (tr, 25 - tr)),
        choose('p3', 'You earn about %s a week. You get 2 special treats this week. How many tokens are left to save for the treasure?' % tokens(W), shuffle_right([
            opt(tokens(W - 2 * tr), True), opt(tokens(W)), opt(tokens(2 * tr))], 0),
            'Two treats cost %d and %d.' % (tr, tr), 'Right. %d take away %d is %d. Those %d tokens are what the treats cost the treasure.' % (W, 2 * tr, W - 2 * tr, 2 * tr)),
        choose('p4', 'At a store, a sign says %s. If the store took tokens, about how many would that be? (5 tokens is about 1 dollar.)' % dollars(3), shuffle_right([
            opt(tokens(15), True), opt(tokens(3)), opt(tokens(8))], 1),
            'Multiply the dollars by 5.', 'Right. 3 times 5 is 15. This is a store example, not a family price.'),
        choose('p5', 'At a store, a card balance is %s. Someone swipes %s for a snack. What is the new balance?' % (dollars(b0), dollars(sn)), shuffle_right([
            opt(money(b0 - sn), True), opt(money(b0 + sn)), opt(money(sn))], 2), 'A swipe takes money away.', 'Right. %d take away %d is %d. A swipe is real money leaving.' % (b0, sn, b0 - sn),
            art=bal(b0, sn, None, 'A balance of %s and a swipe of %s' % (dollars(b0), dollars(sn)))),
        choose('p6', 'Two things at a store are close in price, and one is much better made. What is a good way to choose?', shuffle_right([
            opt('Compare what you get for the price, then decide.', True), opt('Always pick the cheaper one.'), opt('Always pick the more expensive one.')], 0),
            'Is the price the only thing to look at?', 'Right. When prices are close, look at what you get.')]
    D = [
        choose('d1', 'We have %d tokens. Tap the one we can buy.' % tr, [
            opt('a special treat', True, e='\U0001F366', pile={'n': tr, 'glyph': 'token'}), opt('a bike', e='\U0001F6B2', pile={'n': 15, 'glyph': 'token'}), opt('a big castle', e='\U0001F3F0', pile={'n': 20, 'glyph': 'token'})],
            'Our pile is %d tokens. Which price is %d or smaller?' % (tr, tr), 'Yes! A special treat costs %d tokens, and we have %d.' % (tr, tr),
            art=piles([pile(tr, 'we have', 'token')], '%d tokens' % tr), say='We have %d tokens. Tap the one we can buy.' % tr),
        choose('d2', 'We have 15 tokens. The special treat takes %d. Tap what is left.' % tr, shuffle_right([
            opt('a pile left', True, pile={'n': 15 - tr, 'glyph': 'token'}), opt('the same pile', pile={'n': 15, 'glyph': 'token'}), opt('a bigger pile', pile={'n': 18, 'glyph': 'token'})], 1),
            'When we buy, we have fewer tokens.', 'Yes! We paid %d tokens, so %d are left.' % (tr, 15 - tr),
            art=piles([pile(15, 'before', 'token')], 'Fifteen tokens before the treat'), say='We have 15 tokens. The special treat takes %d. Tap what is left.' % tr),
        count('d3', tr, 'A special treat costs %d tokens. Tap each token to count.' % tr, '%d tokens! That is the price of a special treat.' % tr),
        choose('d4', 'At the store, we swipe a card. What happens to the money?', shuffle_right([
            opt('it goes to the store', True, e='\U0001F3EA'), opt('nothing happens', e='\U0001F6AB'), opt('the card makes more', e='\u2728')], 2),
            'Who gets paid when we buy something?', 'Yes! A swipe is real money. It goes to the store.')]
    return {'id': 5, 'title': 'Prices and trade-offs', 'sticker': '\U0001F3F7\uFE0F', 'screens': screens, 'talk': talk,
            'solo': {'julianna': {'title': 'Julianna\u2019s turn: prices and picks', 'sticker': '\U0001F3F7\uFE0F',
                                  'intro': 'Let us think about prices and what we give up. Press Start when you are ready.',
                                  'art': row([pic('\U0001F366', 'treat'), pic('\U0001F381', 'treasure'), {'svg': 'token'}], 'A treat, a treasure and a token'), 'items': J},
                     'dorian': {'title': 'Dorian\u2019s turn: what can we buy?', 'sticker': '\U0001F3F7\uFE0F',
                                'intro': 'Hi Dorian! Let us look at prices. Press the big green button to start.',
                                'art': row(['\U0001F3F7\uFE0F', '\U0001F366'], 'A price tag and a treat'), 'items': D}}}

# ---------------------------------------------------------------- lesson 6
def lesson6(N):
    S, d, tr, W = N['S'], N['daily'], N['treat'], N['week']
    goal, days, after, weeks = N['treasure'], N['days'], N['days_after'], N['weeks']
    sn, b0 = S('snack'), N['b0']
    run = [d * i for i in range(1, days + 1)]
    need(run[-1] >= goal and run[-2] < goal and days >= 4, 'the daily amount must reach the treasure on the last day only')
    screens = [
        intro('Lesson 6: Saving for a goal', 'A goal is something we want that costs more than we have today. Let us plan how long it takes to reach one. Press Start when you are ready.', row(['\U0001F3AF', '\U0001F381'], 'A goal and a treasure')),
        story('Our goal is a treasure. A treasure takes %d tokens, which is about %s.' % (goal, dollars(N['treasure_d'])), row([pic('\U0001F381', 'a treasure'), chip('%d tokens' % goal)], 'A treasure costs %d tokens' % goal)),
        story('We earn about %d tokens a day. After day 1 we have %d. After day 2 we have %d. After day 3 we have %d. We add %d each day.' % (d, run[0], run[1], run[2], d),
              row([chip('day 1: %d' % run[0]), chip('day 2: %d' % run[1]), chip('day 3: %d' % run[2])], 'Tokens after one, two and three days')),
        story('We keep going: %s. After day %d we have %d tokens. That is enough! So the treasure takes about %d days, which is about %d weeks of earning %d tokens a week.' % (', '.join('day %d is %d' % (i + 1, run[i]) for i in range(3, days)), days, run[-1], days, weeks, W),
              row([chip('day %d: %d' % (days - 1, run[-2])), chip('day %d: %d' % (days, run[-1]))], 'Day %d has %d tokens and day %d has %d tokens' % (days - 1, run[-2], days, run[-1]))),
        ask('We earn %d tokens a day. About how many days to reach %d tokens?' % (d, goal), shuffle_right([
            best('%d days' % days, 'Yes. After %d days we have %d tokens. After %d days we only have %d.' % (days, run[-1], days - 1, run[-2]), '\U0001F4C5'),
            other('%d days' % (days // 2), 'That is too few. After %d days we would have only %d tokens.' % (days // 2, d * (days // 2)), '\u23E9'),
            other('%d days' % (days * 3), 'That is more days than we need. At %d a day we get there in %d.' % (d, days), '\U0001F40C')], 1)),
        story('Now say we get a special treat for %s on day 2. Those tokens are gone, so we have to earn them back. We need %d plus %d, which is %d tokens in all. At %d a day, that takes %d days, not %d. The treasure moves one day later.' % (tokens(tr), goal, tr, goal + tr, d, after, days),
              row([chip('goal %d' % goal), '\u27A1\uFE0F', chip('goal %d' % (goal + tr))], 'A special treat moves the goal from %d tokens to %d tokens' % (goal, goal + tr))),
        ask('We get a special treat for %s on day 2. We earn %d a day. How many days to reach %d tokens now?' % (tokens(tr), d, goal), shuffle_right([
            best('%d days' % after, 'Yes. We need %d tokens in all, and %d days gets us to %d.' % (goal + tr, after, d * after), '\U0001F4C6'),
            other('%d days, the same as before' % days, 'The treat took %d tokens away. We have to earn those back, so it takes a day longer.' % tr, '\U0001F937'),
            other('%d days' % (days - 2), 'Spending does not make the goal closer. It makes it later.', '\u23EA')], 2)),
        story('At a store, a card swipe does the same thing. If someone saving for something swipes %s for a snack, that is real money leaving, and the goal moves later.' % dollars(sn),
              bal(b0, sn, b0 - sn, 'Swipe %s: the account goes from %s to %s' % (dollars(sn), dollars(b0), dollars(b0 - sn)))),
        ask('We would like a special treat today, and we are also saving for the treasure. What helps us decide?', shuffle_right([
            best('Think about which one matters more to us right now.', 'Yes. Both are fine choices. A treat now moves the treasure about a day later, and we get to decide.', '\U0001F914'),
            other('Always spend tokens as soon as we get them.', 'Then the treasure never gets closer. Thinking first helps us choose.', '\U0001F3C3'),
            other('Never have a treat.', 'A treat is a fine choice sometimes. It just moves the treasure a little later.', '\u274C')], 0)),
    ]
    talk = [
        {'q': 'What is one real goal we could put on the fridge? About how many days would it take?', 'note': 'Cost in tokens divided by %d tokens a day, rounded up. The treasure (%d tokens) is about %d days, or about %d weeks.' % (d, goal, days, weeks)},
        {'q': 'If we get a special treat on the way, how far does the goal move?', 'note': 'A special treat is %s, about one day of earning, so the goal moves about one day.' % tokens(tr)},
        {'q': 'If a child pressed Ask a grown-up in this lesson, what was the question?', 'note': 'Common ones: "Can I still have treats?" (yes, it moves the goal a little) and a goal your family has not set (say how it works for you).'}]
    J = [
        choose('s1', 'The treasure is %d tokens. You earn %d tokens a day. How many days?' % (goal, d), shuffle_right([opt('%d days' % days, True), opt('%d days' % (days // 2)), opt('%d days' % (days * 2))], 1),
            'How many %ds make %d?' % (d, goal), 'Right. %d tokens a day for %d days is %d tokens.' % (d, days, d * days)),
        choose('s2', 'You earn about %d tokens a week. How many weeks to reach %d tokens?' % (W, goal), shuffle_right([opt('%d weeks' % weeks, True), opt('%d weeks' % (weeks + 3)), opt('%d weeks' % (weeks * 5))], 2),
            'How many %ds make %d?' % (W, goal), 'Right. %d and %d make %d, so about %d weeks.' % (W, W, 2 * W, weeks)),
        choose('s3', 'You earn %d tokens a day. After 4 days, how many tokens do you have?' % d, shuffle_right([opt('%d tokens' % (4 * d), True), opt('%d tokens' % (3 * d)), opt('%d tokens' % (4 + d))], 0),
            'Add %d four times.' % d, 'Right. %d plus %d plus %d plus %d is %d.' % (d, d, d, d, 4 * d)),
        choose('s4', 'After 4 days you have %d tokens. You get a special treat for %s. How many tokens do you have now?' % (4 * d, tokens(tr)), shuffle_right([opt('%d tokens' % (4 * d - tr), True), opt('%d tokens' % (4 * d + tr)), opt('%d tokens' % tr)], 1),
            'Spending takes tokens away.', 'Right. %d take away %d is %d.' % (4 * d, tr, 4 * d - tr)),
        choose('s5', 'You get a special treat for %s. You earn %d tokens a day. How does it change the day you reach the treasure?' % (tokens(tr), d), shuffle_right([
            opt('It moves the treasure about %d day%s later.' % (math.ceil(tr / d), '' if math.ceil(tr / d) == 1 else 's'), True), opt('It does not change the day.'), opt('It makes the treasure come sooner.')], 2),
            'How many days does it take to earn %d tokens back?' % tr, 'Right. %d tokens at %d a day is about %d day of earning, so the treasure is that much later.' % (tr, d, math.ceil(tr / d))),
        choose('s6', 'Which is the wiser way to think about a treat now or the treasure sooner?', shuffle_right([
            opt('Decide which one matters more to you. Both can be good choices.', True), opt('Always spend right away.'), opt('Never have a treat.')], 0),
            'Is there one right answer for everyone, or does it depend on what you want?', 'Right. It is a trade-off, and you get to decide what matters more.')]
    D = [
        count('t1', 10, 'We earn about 10 tokens a day. Tap each token while we count to ten.', 'Ten tokens! That is about one day of earning.'),
        choose('t2', 'We have 5 tokens. We earn 1 more token. Tap how many we have now.', shuffle_right([opt('more tokens', True, pile={'n': 6, 'glyph': 'token'}), opt('the same', pile={'n': 5, 'glyph': 'token'}), opt('fewer', pile={'n': 3, 'glyph': 'token'})], 0),
            'Earning means we get more.', 'Yes! 5 and 1 more is 6 tokens.', art=piles([pile(5, 'we have', 'token')], 'Five tokens'), say='We have 5 tokens. We earn 1 more token. Tap how many we have now.'),
        choose('t3', 'Another day. We have 10 tokens and earn 10 more. Tap the bigger pile.', shuffle_right([opt('the biggest pile', True, pile={'n': 20, 'glyph': 'token'}), opt('the same pile', pile={'n': 10, 'glyph': 'token'}), opt('a small pile', pile={'n': 5, 'glyph': 'token'})], 1),
            'Earning makes our pile bigger.', 'Yes! More days of earning make a bigger pile.', art=piles([pile(10, 'we have', 'token')], 'Ten tokens'), say='We have 10 tokens and earn 10 more. Tap the bigger pile.'),
        choose('t4', 'Tap what we are saving for.', shuffle_right([opt('a treasure', True, e='\U0001F381'), opt('a sock', e='\U0001F9E6'), opt('a rock', e='\U0001FAA8')], 2),
            'Which one is the goal we want?', 'The treasure! We save a little each day until we have enough.')]
    return {'id': 6, 'title': 'Saving for a goal', 'sticker': '\U0001F3AF', 'screens': screens, 'talk': talk,
            'solo': {'julianna': {'title': 'Julianna\u2019s turn: days to a goal', 'sticker': '\U0001F3AF', 'intro': 'Let us plan for a goal. Work out the days, and see how a treat moves the date. Press Start when you are ready.',
                                  'art': row(['\U0001F3AF', '\U0001F4C5'], 'A goal and a calendar'), 'items': J},
                     'dorian': {'title': 'Dorian\u2019s turn: saving tokens', 'sticker': '\U0001F3AF', 'intro': 'Hi Dorian! Let us save tokens for a treasure. Press the big green button to start.',
                                'art': row(['\U0001F381', {'svg': 'token'}], 'A treasure and a token'), 'items': D}}}

# ---------------------------------------------------------------- lesson 7
def lesson7(N):
    need(not N['gives'], 'Lesson 7 is written for a family that does not give yet (familyGivesYet false); rewrite it if that changes')
    screens = [
        intro('Lesson 7: Giving, an idea for later', 'Some people choose to give. Our family does not do this yet, so this is just to learn what giving means. Press Start when you are ready.', row(['\U0001F49D', '\U0001F91D'], 'A gift and a helping hand')),
        story('Giving means letting some of our money go to help someone else. When money is given, it leaves, just like a swipe. It is gone from us, and someone else has it.', row(['\u270B', '\u27A1\uFE0F', '\U0001F49D'], 'Money leaves a hand and goes to help someone')),
        story('People give in different ways: a gift for a friend, a donation to help others, or time and help. Time and help do not cost any money at all.',
              row([pic('\U0001F381', 'a gift'), pic('\U0001F49D', 'a donation'), pic('\U0001F550', 'time and help')], 'A gift, a donation, and time and help')),
        story('Here is a pretend example. Someone has 20 dollars on a card and gives 5 dollars. Their account goes down to 15 dollars, just like a swipe. Someone else gets 5 dollars of help.', bal(20, 5, 15, 'Pretend: give 5 dollars by card, the account goes from 20 dollars to 15 dollars')),
        ask('In the pretend example, someone has 20 dollars and gives 5 dollars. How much do they have left?', shuffle_right([
            best('15 dollars', 'Yes. 20 take away 5 is 15. Giving is money leaving, like a swipe.', '\U0001F4B5'),
            other('25 dollars', 'Giving takes money away, so there is less, not more. 20 take away 5 is 15.', '\u2795'),
            other('5 dollars', '5 dollars is what was given. What is left is 20 take away 5, which is 15.', '\U0001F937')], 1)),
        ask('Does everyone have to give?', shuffle_right([
            best('No. Giving is a choice. Each family decides if and when.', 'Yes. There is no rule. Our family might talk about it later, and that is fine.', '\U0001F60A'),
            other('Yes, every day.', 'No one has to give. It is a choice a family makes, when it is ready.', '\U0001F4C5'),
            other('Only grown-ups can think about it.', 'Kids can learn what giving means too. That is all we are doing today.', '\U0001F9D2')], 0)),
        story('Giving does not always mean money. Time and help are gifts too: helping a neighbor, sharing a toy, or making a card for someone.', row([pic('\U0001F91D', 'helping'), pic('\U0001F9F8', 'sharing'), pic('\U0001F48C', 'a card')], 'Helping, sharing and making a card')),
        ask('Which gift costs no money?', shuffle_right([
            best('Helping a neighbor carry groceries.', 'Yes. Time and help are real gifts, and they cost no money.', '\U0001F91D'),
            other('Buying a toy.', 'Buying a toy costs money. A gift of help costs only our time.', '\U0001F9F8'),
            other('Swiping a card.', 'A swipe costs real money, so it is not a free gift.', '\U0001F4B3')], 2)),
    ]
    talk = [
        {'q': 'What did you learn giving means?', 'note': 'Money leaving to help someone, like a swipe; or time and help, which cost nothing. Your family does not give money yet, and there is nothing to decide today.'},
        {'q': 'Can you think of a time someone helped you, with no money at all?', 'note': 'A gentle way to talk about time and help.'},
        {'q': 'If a child pressed Ask a grown-up in this lesson, what was the question?', 'note': 'Common ones: "Do we give?" (not yet; maybe a topic for later) and who gets the money. You decide what to say about your own family\u2019s values.'}]
    J = [
        choose('g1', 'Pretend: someone has 20 dollars and gives 5 dollars. How much is left?', shuffle_right([opt('$15', True), opt('$25'), opt('$5')], 0),
            'Giving takes money away.', 'Right. 20 take away 5 is 15.'),
        choose('g2', 'Pretend: a card balance is 20 dollars, and someone gives 5 dollars by card. What is the new balance?', shuffle_right([opt('$15', True), opt('$25'), opt('$20')], 1),
            'Giving by card is like a swipe.', 'Right. The balance goes down to 15 dollars, just like a swipe.', art=bal(20, 5, None, 'A balance of 20 dollars and a gift of 5 dollars')),
        choose('g3', 'Who is helped when someone gives?', shuffle_right([opt('Someone else, who now has more help.', True), opt('Nobody.'), opt('Only the giver.')], 2),
            'Where does the money go?', 'Right. The giver has less, and someone else has more help.'),
        choose('g4', 'Which gift costs no money but still helps?', shuffle_right([opt('Helping a neighbor.', True), opt('Buying a new toy.'), opt('Swiping a card.')], 1),
            'A gift can be time and help.', 'Right. Time and help are real gifts. They cost no money.'),
        choose('g5', 'Does every family have to give money?', shuffle_right([opt('No. It is a choice each family makes, when it is ready.', True), opt('Yes, always.'), opt('Only on birthdays.')], 0),
            'Is giving a rule or a choice?', 'Right. It is a choice. Our family might think about it later.')]
    D = [
        choose('v1', 'Our friend has no crayons. We share ours. Tap who is helped.', shuffle_right([opt('our friend', True, e='\U0001F9D2'), opt('a rock', e='\U0001FAA8'), opt('a cloud', e='\u2601\uFE0F')], 1),
            'Who gets to use our crayons?', 'Yes! Our friend is helped when we share.'),
        count('v2', 5, 'Let us count 5 tokens. Tap each one.', 'Five! Great counting.'),
        choose('v3', 'Tap a gift that costs no money.', shuffle_right([opt('helping', True, e='\U0001F91D'), opt('a toy store', e='\U0001F3EA'), opt('a card to swipe', e='\U0001F4B3')], 2),
            'You can give with your hands and your time.', 'Yes! Helping is a gift that costs no money.')]
    return {'id': 7, 'title': 'Giving', 'sticker': '\U0001F49D', 'screens': screens, 'talk': talk,
            'solo': {'julianna': {'title': 'Julianna\u2019s turn: what giving means', 'sticker': '\U0001F49D', 'intro': 'Let us learn what giving means. This is just an idea for later. Press Start when you are ready.',
                                  'art': row(['\U0001F49D', '\U0001F91D'], 'A gift and a helping hand'), 'items': J},
                     'dorian': {'title': 'Dorian\u2019s turn: helping', 'sticker': '\U0001F49D', 'intro': 'Hi Dorian! Let us learn about helping. Press the big green button to start.',
                                'art': row(['\U0001F91D', '\U0001F9F8'], 'A helping hand and a toy'), 'items': D}}}

# ---------------------------------------------------------------- lesson 8
def lesson8(N):
    S, W, tr, sp = N['S'], N['week'], N['treat'], N['split']
    sn, bk, pc, b0 = S('snack'), S('book'), S('pencilCase'), N['b0']
    b1, b2 = b0 - sn, b0 - sn - pc
    need(b2 > 0 and bk + pc > b2 and bk <= b2, 'Lesson 8: the store swipes must leave a balance where the book fits alone but not with the pencil case')
    ntreats = sp['treats'] // tr
    screens = [
        intro('Lesson 8: Spending wisely', 'Spending wisely means making a plan before we spend. Let us make one. Press Start when you are ready.', row(['\U0001F4CB', '\U0001F9E0'], 'A plan and a thinking face')),
        story('A week of schoolwork and chores earns about %d tokens, which is about %s. A plan says where the tokens will go before we spend them.' % (W, dollars(N['week_d'])),
              row([{'svg': 'token'}, chip('%d a week' % W), pic('\U0001F4CB', 'a plan')], 'About %d tokens a week, and a plan' % W)),
        story('Here is one example plan for %d tokens: %d saved for the treasure, and %d for special treats. That is %d special treats at %d tokens each. It adds up to %d.' % (W, sp['treasure'], sp['treats'], ntreats, tr, W),
              row([chip('treasure %d' % sp['treasure']), chip('treats %d' % sp['treats'])], 'An example plan: treasure %d, treats %d' % (sp['treasure'], sp['treats']))),
        story('Now a store story. At a store, a balance is %s. Someone swipes %s for a %s. Now the balance is %s.' % (dollars(b0), dollars(sn), N['store']['snack']['label'], dollars(b1)), bal(b0, sn, b1, 'Swipe %s: the balance goes from %s to %s' % (dollars(sn), dollars(b0), dollars(b1)))),
        story('Next they swipe %s for a %s for school. Now the balance is %s. Each swipe makes the balance smaller, so we check the balance before every swipe.' % (dollars(pc), N['store']['pencilCase']['label'], dollars(b2)), bal(b1, pc, b2, 'Swipe %s: the balance goes from %s to %s' % (dollars(pc), dollars(b1), dollars(b2)))),
        ask('The balance is %s. At the store, a %s is %s and another %s is %s. Can both be bought?' % (dollars(b2), N['store']['book']['label'], dollars(bk), N['store']['pencilCase']['label'], dollars(pc)), shuffle_right([
            best('No. %d plus %d is more than %d. Pick one that fits.' % (bk, pc, b2), 'Yes, that is the careful answer. %d plus %d is %d, and there is only %d. Choose one.' % (bk, pc, bk + pc, b2), '\U0001F9EE'),
            other('Yes, swipes are free.', 'A swipe is not free. It takes real money, and only %s is left.' % dollars(b2), '\U0001F193'),
            other('Yes, just swipe and see.', 'Checking first is wiser than swiping and hoping. Check the balance before a swipe.', '\U0001F633')], 0)),
        ask('Which is the wiser purchase this week?', shuffle_right([
            best('Something we need for school.', 'Needs come first. A thing we need is a wiser purchase than another want.', '\u270F\uFE0F'),
            other('Another treat, right after one.', 'That is a want, and it takes tokens away from the treasure.', '\U0001F366'),
            other('Whatever is shiniest in the shop.', 'Shiny things are tempting. A plan helps us pick on purpose.', '\u2728')], 1)),
        story('If a plan runs out before the week ends, that is a good thing to talk about. It teaches us to keep some tokens for later and to plan smaller next time.', row(['\U0001F4C5', '\U0001F4A1'], 'A calendar and an idea')),
        ask('Our plan has %d tokens for treats. On Tuesday we use all %d. It is only Tuesday. What is the best next step?' % (sp['treats'], sp['treats']), shuffle_right([
            best('Wait for next week\u2019s tokens, and plan fewer treats next time.', 'Yes. We stick to the plan and learn from it. The treasure tokens stay safe.', '\U0001F4C5'),
            other('Take the tokens from the treasure.', 'Then the treasure moves later. It is better to wait for next week.', '\U0001F381'),
            other('Spend tokens we have not earned yet.', 'We can only spend tokens we have. Next week brings more.', '\U0001F4B8')], 2)),
    ]
    talk = [
        {'q': 'Look at one real store receipt together. What was bought, and how much was it?', 'note': 'The balance goes down with every swipe. Check it before swiping. Store prices are in dollars, not family tokens.'},
        {'q': 'How would we like to plan the %d tokens a week?' % W, 'note': 'The plan in the lesson (%d for the treasure, %d for treats) is only an example. Change it to fit your family.' % (sp['treasure'], sp['treats'])},
        {'q': 'What do we do when the treat tokens run out early?', 'note': 'Wait for next week, and plan smaller next time. It is not a failure.'},
        {'q': 'If a child pressed Ask a grown-up in this lesson, what was the question?', 'note': 'Common ones: a plan that runs out before the week ends (a good talk point) and "what if I want more treats?" (talk about the trade-off with the treasure).'}]
    J = [
        choose('w1', 'You earn %d tokens this week. You save %d for the treasure. How many tokens are left for treats?' % (W, sp['treasure']), shuffle_right([
            opt('%d tokens' % sp['treats'], True), opt('%d tokens' % W), opt('%d tokens' % (W + sp['treasure']))], 1),
            'Take away %d from %d.' % (sp['treasure'], W), 'Right. %d take away %d is %d.' % (W, sp['treasure'], sp['treats'])),
        choose('w2', 'At a store, a balance is %s. Someone swipes %s, then %s. What is the balance now?' % (dollars(b0), dollars(sn), dollars(pc)), shuffle_right([opt(money(b2), True), opt(money(b1)), opt(money(b0))], 2),
            'Take away the first swipe, then the second.', 'Right. %d take away %d is %d, and then take away %d is %d.' % (b0, sn, b1, pc, b2), art=bal(b0, sn + pc, None, 'A balance of %s and swipes of %d and %d dollars' % (dollars(b0), sn, pc))),
        choose('w3', 'Your plan has %d tokens for treats. A special treat costs %d. How many special treats fit?' % (sp['treats'], tr), shuffle_right([opt('%d' % ntreats, True), opt('%d' % (ntreats + 3)), opt('%d' % sp['treats'])], 0),
            'How many %ds make %d?' % (tr, sp['treats']), 'Right. %d special treats at %d tokens is %d.' % (ntreats, tr, ntreats * tr)),
        choose('w4', 'Your plan has %d tokens for treats. You have %d special treats this week at %d tokens each. What happened?' % (sp['treats'], ntreats + 1, tr), shuffle_right([
            opt('The last treat broke the plan: %d is more than %d.' % ((ntreats + 1) * tr, sp['treats']), True), opt('Nothing, it fits.'), opt('You saved more.')], 1),
            'Add up the treats. Is it more than %d?' % sp['treats'], 'Right. %d treats cost %d tokens, more than the %d for treats, so the extra came from the treasure.' % (ntreats + 1, (ntreats + 1) * tr, sp['treats'])),
        choose('w5', 'What should you check before every swipe at a store?', shuffle_right([opt('The balance.', True), opt('The color of the card.'), opt('How shiny the item is.')], 2),
            'How do you know how much you have?', 'Right. Checking the balance tells you if you can afford it.'),
        choose('w6', 'It is Tuesday and your treat tokens are all gone. What is the wiser plan?', shuffle_right([
            opt('Wait for next week\u2019s tokens and plan fewer treats.', True), opt('Use the treasure tokens.'), opt('Spend tokens you have not earned.')], 0),
            'Which tokens should stay safe?', 'Right. The treasure tokens stay safe, and you learn to plan.')]
    D = [
        choose('x1', 'We have 10 coins. Tap the thing we NEED for school.', shuffle_right([opt('a pencil', True, e='\u270F\uFE0F', pile={'n': 2, 'glyph': 'coin'}), opt('a big castle', e='\U0001F3F0', pile={'n': 20, 'glyph': 'coin'}), opt('candy', e='\U0001F36C', pile={'n': 3, 'glyph': 'coin'})], 0),
            'Which one do we need to do schoolwork?', 'Yes! Needs come first. A pencil is a need.', art=piles([pile(10, 'we have')], 'Ten coins'), say='We have 10 coins. Tap the thing we need for school.'),
        choose('x2', 'We buy the pencil for 2 coins. Tap what is left.', shuffle_right([opt('what is left', True, pile={'n': 8, 'glyph': 'coin'}), opt('the same pile', pile={'n': 10, 'glyph': 'coin'}), opt('a tiny pile', pile={'n': 2, 'glyph': 'coin'})], 1),
            'We paid 2 coins, so we have fewer.', 'Yes! 10 coins take away 2 coins is 8 coins.', art=piles([pile(10, 'before')], 'Ten coins before the pencil'), say='We buy the pencil for 2 coins. Tap what is left.'),
        choose('x3', 'We have %d tokens. Tap what we can get with %d tokens.' % (tr, tr), shuffle_right([opt('a special treat', True, e='\U0001F366', pile={'n': tr, 'glyph': 'token'}), opt('a bike', e='\U0001F6B2', pile={'n': 15, 'glyph': 'token'}), opt('a castle', e='\U0001F3F0', pile={'n': 20, 'glyph': 'token'})], 2),
            'Which price is %d or smaller?' % tr, 'Yes! A special treat is %d tokens.' % tr, art=piles([pile(tr, 'we have', 'token')], '%d tokens' % tr), say='We have %d tokens. Tap what we can get with %d tokens.' % (tr, tr)),
        count('x4', 8, 'Tap each coin to count the 8 we have left.', 'Eight! Great counting!')]
    return {'id': 8, 'title': 'Spending wisely (budgeting)', 'sticker': '\U0001F4CB', 'screens': screens, 'talk': talk,
            'solo': {'julianna': {'title': 'Julianna\u2019s turn: plan a week', 'sticker': '\U0001F4CB', 'intro': 'Let us plan a week of tokens, and follow a store balance. Press Start when you are ready.',
                                  'art': row(['\U0001F4CB', '\U0001F4B3'], 'A plan and a card'), 'items': J},
                     'dorian': {'title': 'Dorian\u2019s turn: needs first', 'sticker': '\U0001F4CB', 'intro': 'Hi Dorian! Let us choose wisely. Press the big green button to start.',
                                'art': row(['\u270F\uFE0F', {'svg': 'coin'}], 'A pencil and a coin'), 'items': D}}}

BUILDERS = {5: lesson5, 6: lesson6, 7: lesson7, 8: lesson8}

def build(N=None):
    N = N or load_numbers()
    out = {}
    for n, fn in BUILDERS.items():
        les = fn(N)
        les = {'_generated': 'Built by tools/build_money_unit2.py from data/money/family-numbers.json. Edit that file and run the script; do not edit this file by hand.', **les}
        out[n] = les
    return out

def write_json(path, obj):
    return json.dumps(obj, indent=1, ensure_ascii=False) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    lessons = build()
    ok = True
    for n, les in lessons.items():
        p = os.path.join(DATA, 'lesson-%d.json' % n)
        text = write_json(p, les)
        if a.check:
            if not os.path.exists(p) or open(p, encoding='utf-8').read() != text:
                print('out of date: ' + os.path.relpath(p, SITE)); ok = False
        else:
            open(p, 'w', encoding='utf-8').write(text)
    lp = os.path.join(DATA, 'lessons.json')
    lj = json.load(open(lp, encoding='utf-8'))
    changed = False
    for l in lj:
        if l['id'] in lessons:
            want = lessons[l['id']]['title']
            if l.get('status') != 'ready' or l.get('icon') != ICONS[l['id']] or l['title'] != want:
                l['status'], l['icon'], l['title'] = 'ready', ICONS[l['id']], want; changed = True
    if a.check:
        if changed: print('out of date: data/money/lessons.json'); ok = False
        sys.exit(0 if ok else 1)
    if changed:
        open(lp, 'w', encoding='utf-8').write(json.dumps(lj, indent=1, ensure_ascii=False) + '\n')
    print('wrote lessons 5 to 8' + (' and updated lessons.json' if changed else ''))

if __name__ == '__main__':
    main()
