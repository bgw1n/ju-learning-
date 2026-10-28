# Family Learning Place (Julianna's Learning Place)

A small, plain HTML/CSS/JS website for the family: spelling games and an online spelling test for Julianna (3rd grade), a place for Dorian (age 5, kindergarten: letter sounds and build-a-word games), and a shared Family "Money & Economics" course (16 lessons, locked in order; Unit 1, lessons 1-4, is playable, with a follow-on activity for each child).
No build step, no frameworks, no network calls except loading this site's own files (Lexend font is bundled).
Spelling is the only finished subject. The code is laid out so a `math` section can be added later.

## What is in it

| Page | What it does |
| --- | --- |
| `index.html` | "Who's playing?": three big picture buttons (Julianna, Dorian, Family) and a small "Grown-up" entry. Picking one shows that person's PIN keypad (on-screen buttons or keyboard; Escape or Back goes back). |
| `child.html` | Julianna's games home: sticker boxes, five games, and the test. |
| `child.html` | (also) a "Family Money" section: Julianna's follow-on for each family lesson, locked until the Family finishes that lesson. |
| `dorian.html` | Dorian's home: spoken greeting, the rocket, big picture buttons for Letter sounds and Build a word, and one for each finished family lesson (his follow-on). Tap only. |
| `kinder.html?a=letters` / `?a=build` | Dorian's kindergarten games (v9). Dorian logs in to play; a grown-up can open them to preview (nothing is saved). |
| `family.html` | Family home: "Family Money & Economics", the 16 lessons as cards (only unlocked ones can be opened; lessons 1-4 open `lesson.html`, the rest say coming soon). |
| `lesson.html?n=<1-4>` | One family lesson: a voiced story with pictures, "what would you do?" taps, a calm "Grown-up talk" screen and a "We finished!" button. Family login. |
| `solo.html?n=<1-4>` | A child's own follow-on to that lesson (Julianna or Dorian, from their own login; opens once the Family finished the lesson). A grown-up can preview with `&p=julianna` or `&p=dorian` (saves nothing). |
| `game.html?s=spelling&g=<id>` | Runs one game: `unscramble`, `hangman` (Grow the Flower), `match`, `listen`, `clap`, `review`, or `test`. |
| `parent.html` | Grown-up page. A switch at the top picks Julianna, Dorian or Family. Everyone: Save/Load progress, Back up to Grok Bot, Voice settings. Julianna: (week-by-week trend, words she keeps missing, scores, most-missed words, misspellings, practice list, proctor mode, CSV export, clear results, her money activities card, "Ask a grown-up" flags). Dorian: progress cards, his money activities card, flags. Family: progress, the lesson unlock panel and flags. A small **Jump to** row sits right under the profile switch and changes with the profile (v10). |

Every game covers all 12 words in two short rounds of 6. Stickers: finishing a game earns its sticker for that week.
Letters are always lowercase on screen (tiles, keys, typed text), so letter case never gives an answer away.

## Logging in (casual gate, NOT real security)

Four roles, one PIN each (4 digits). On the landing page you pick a person first, then type that person's PIN; a PIN only opens its own profile.

| Role | Who | PIN | Opens |
| --- | --- | --- | --- |
| `julianna` | Julianna | `0518` | `child.html` (and the game pages) |
| `dorian` | Dorian | `1357` | `dorian.html` |
| `family` | Family (money lessons) | `2468` | `family.html` |
| `parent` | Grown-up | `1821` | `parent.html`; the grown-up can also open every other page (to preview them) |

- The PINs live in **`js/config.js`** (`JU.config.pins`; change them there). The people on the landing page are listed in `JU.config.profiles`.
- **PINs are a casual gate, not security.** They are in the page source of a public site, so **anyone who looks can read them**. They only keep people from wandering in by accident. Do not put anything sensitive here.
- The logged-in role is kept in `sessionStorage` (`ju_role`), so closing the tab logs out. `js/auth.js` has `JU.auth.require([...roles])`: a protected page sends you back to `index.html` when nobody is logged in or the role is not allowed (for example Dorian cannot open `child.html`, `parent.html` or `family.html`). An old `child` session counts as Julianna.
- The landing keypad has no lockout (wrong guesses just clear the dots). The "Grown-up unlock" box in the spelling hints still pauses for 30 seconds after three wrong PINs, as before.

## Add a new week (each Friday)

Use the script. It takes the same clues JSON as the worksheet builder (`/workspace/spelling/week4_clues.json`), so the games and the printed packet always match:

```
python3 add_week.py 2026-11-02 word1 word2 ... word12 \
    --clues /workspace/spelling/week5_clues.json --subtitle "Savvas MyView Literacy Spelling, Grade 3, Unit 2 Lesson 2"
```

- First argument is the **Monday** date (`YYYY-MM-DD`). It writes `data/week-2026-11-02.json` and adds one line to `data/weeks.json`.
- Optional: `--title`, `--label "Week of Nov 2"`, `--site DIR`.
- The clues file needs `clue`, `riddle`, `syl` (`"to-tal"`) and optionally `patterns`, `syllable_colors`, `bonus`. For the games, add one more optional key, `"sentence": {"word": "A sentence using the word, not at the start."}` (read aloud in Listen and Type). Without it the script uses a plain placeholder and warns you. Sentences already in an existing week file are kept.
- It is **idempotent**: running it again for the same date replaces that week's file and line, never duplicating. It refuses (and changes nothing) if a word has no clue or the syllables do not join back to the word.
- The child home shows a week picker once there is more than one week and opens the newest week that has started.

### Getting the update onto GitHub

```
./make_update_zip.sh --prefix ju-learning-site        # zips data/ only; writes ../ju-learning-update-YYYY-MM-DD.zip
./make_update_zip.sh --prefix ju-learning-site js/pages/parent.js css/style.css   # data/ plus files you changed
./make_update_zip.sh --newer-than data/week-2026-10-26.json                      # data/ plus every file edited since then
```

It always includes `data/`, preserves folder paths, and uses `zip` if installed (otherwise Python's `zipfile`). `--prefix ju-learning-site` matches the live site, which sits in a `ju-learning-site/` folder inside the repo. Unzip it, then on the repo page use **Add file > Upload files** and drag in the folder(s); GitHub overwrites the files with the same path. Pages updates itself in a minute or two.

## Where results are saved

All reads and writes go through **`js/storage.js`** (one small module, all functions async). Today it uses this browser's `localStorage`. Each profile has its own namespaced keys, so scores never mix:

| Profile | Keys |
| --- | --- |
| Julianna (unchanged since v1, so her old data just works) | `ju_results_v1`, `ju_stickers_v1`, `ju_hints_v1` |
| Dorian | `ju_dorian_results_v1`, `ju_dorian_stickers_v1`, `ju_dorian_hints_v1` (+ the v8 keys below) |
| Family | `ju_family_results_v1`, `ju_family_stickers_v1`, `ju_family_hints_v1`, and **`ju_family_lessons_v1`** (lesson progress, below) |
| This device (shared) | `ju_voice_v1` (voice), `ju_lastbackup_v1` (last backup date), `ju_backup_email_v1` (the address typed for Back up to Grok Bot; never in the backup file) |

**v9 adds one more key per profile**, `ju_<profile>_kinder_v1` (Julianna's would be `ju_kinder_v1`; only Dorian uses it), for the kindergarten games. Its stickers are saved under week id `kinder`, and its hint log entries have subject `kinder`.

**v8 adds two keys per profile**: `ju_<profile>_flags_v1` ("Ask a grown-up" flags) and `ju_<profile>_money_v1` (the child's Money activity results). Julianna's are `ju_flags_v1` and `ju_money_v1`; the Family has flags only (its lesson progress is `ju_family_lessons_v1`).

In code: `JU.storage` is Julianna's; `JU.storage.profile('dorian')` and `JU.storage.profile('family')` have the same functions on their own keys.

- Results record (`ju_results_v1` and the same shape for the others): `ts`, `session`, `week`, `subject`, `type`, `proctored`, `word`, `typed`, `typedAll`, `correct`, `tries` (and `hinted` when the spoken hint was used).
- `ju_stickers_v1`: stickers earned per week.
- `ju_family_lessons_v1`: `{ "complete": { "<lessonId>": "<ISO time>" }, "override": { "<lessonId>": "open" | "locked" } }`.

Results exist **only in that laptop's browser**. They do not sync, and clearing site data erases them. On the grown-up page:

- **Save progress (backup file)** downloads one JSON file (`family-learning-progress-YYYY-MM-DD.json`) with everyone's data (backup format version 5, below).
- **Load progress...** reads such a file and **merges** it into the right profiles: a result already here (same id, or same session, game, word and time) is skipped, so loading the same file twice, or an older backup, never duplicates. Version 1 and 2 files (Julianna only) load into Julianna. A file that is not a backup is refused and nothing changes. Use this to restore after clearing site data or to bring another laptop's results over.
- **Export results (CSV)** is for Julianna's results and is for spreadsheets, not for restoring.
- **Back up to Grok Bot** (v7, replaces v6's Backup by email) is one click: it downloads the same backup file as Save progress (and records today as the last backup date), then opens your email app with a `mailto:` message already filled in. Subject: `Family Learning backup YYYY-MM-DD`. The body starts with short instructions (attach the file just downloaded, named exactly like `family-learning-progress-YYYY-MM-DD.json`, from Downloads, press Send, "The bot saves it. You do not need to wait for a reply.") and then a blank line and the plain-text counts summary (per-child counts and the last backup date, no scores or words). A web page cannot attach a file, so attaching it is the one manual step; nothing is sent until you press Send. The receiving address is typed once on the grown-up page and kept only in this browser's `localStorage` (`ju_backup_email_v1`). It is never in the repo, any site file, or the backup file. Once saved, the page shows "Sending to: ..." with a small **Change address** link and hides the box. With no address saved the button is disabled and says "Type the backup address once first." A typed address must look like one email address. The **Save backup now** button in the reminder banner is still a plain download.

`ju_lastbackup_v1` holds the date of the last backup (this device only; not in the backup file, kept by Clear results). It drives the backup reminder, which counts everyone's data (Julianna's, Dorian's and the Family's finished lessons).

### Backup file format, version 5

```
{ "app": "ju-learning", "version": 5, "exportedAt": "<ISO time>",
  "results": [...], "stickers": {...}, "hints": [...],          // Julianna, exactly as in versions 1 and 2
  "flags": [...], "money": { "done": {...}, "answers": [...] },  // Julianna's flags and money results (new in 4)
  "profiles": {
    "dorian": { "results": [...], "stickers": {...}, "hints": [...], "flags": [...], "money": { "done": {...}, "answers": [...] },
                "kinder": { "answers": [...], "rounds": [...] } },          // Dorian's kindergarten games (new in 5)
    "family": { "results": [...], "stickers": {...}, "hints": [...], "flags": [...],
                "lessons": { "complete": {...}, "override": {...} } } } }
```

Version 1 has no `hints`; versions 1 and 2 have no `profiles`; versions 1 to 3 have no `flags` or `money`; versions 1 to 4 have no `kinder`. All of them still load (Julianna's part goes to Julianna; a missing part is simply skipped). Loading merges and never duplicates: a flag with the same id (or the same kind, lesson, screen and time), or an answer with the same id (or the same session, lesson, question and time), is skipped. Code: `JU.storage.exportAll()` and `importAll(data)`.

Save a backup now and then (for example each Friday). The site reminds you (see Backup reminder below). To share results live across devices later, replace the function bodies in `storage.js` with calls to a backend; nothing else needs to change.

### Grown-up dashboard extras

- **Week by week:** three small inline SVG charts (latest finished test score, different words missed, games finished) for every week in `data/weeks.json`, plus a "See the numbers" table. A game or test counts as finished when every word was answered. Review practice is left out.
- **Words she keeps missing:** words missed in 2 or more different weeks (a miss in Review counts as a miss in that week), with the last misspelling she typed. A word leaves the list after two right answers in a row in Review.

### Review game (child side)

`js/spelling/review.js`. On the child home a green dashed **Review** card appears only when she has words missed in an earlier week (so it is hidden for the first week and when there is no history). It plays up to 6 of those words, most missed first, using the Unscramble and Listen-and-Type mechanics; the 2 most-missed words (missed 2+ times) get a second step in the other mechanic, so it is at most 8 short steps. Words fade out after two right Review answers in a row. Same calm rules: Lexend, lowercase only, no timer, no progress bar, no round break, no new sticker box (it ends with a star). Results are saved as type `review` under the current week.

What "correct" means: Unscramble, Listen and Type, Word Match, and Clap the Beats count as correct when right on the first try. Grow the Flower counts as correct with 2 or fewer missed letters. The test counts one try per word.

## Family Money & Economics (v6)

`family.html` lists the 16 lessons from **`data/money/lessons.json`**: `[{ "id": 1, "unit": 1, "unitTitle": "What money is", "title": "Why money? (vs swapping)", "status": "coming-soon" }, ...]`. `status` is about the lesson's content (`coming-soon` now; `ready` once a lesson is written). Units: 1 What money is (lessons 1-4), 2 Using money (5-8), 3 The economy (9-12), 4 Growing money (13-16).

**Unlock rules** (`js/money.js`, `JU.money.resolve`): lesson 1 is open; lesson N opens when lesson N-1 is marked complete (stored under the Family profile in `ju_family_lessons_v1`). Locked lessons show a lock and cannot be opened. On the grown-up page (Family view > unlock panel) a grown-up can **Unlock** a lesson early, **Re-lock** it, and **Mark complete / not complete**. Locking wins over everything else; marking a lesson not complete re-locks the next one unless a grown-up opened it early. Nothing here uses dates.

**Add or change a lesson:** edit `data/money/lessons.json` (keep `id` as 1, 2, 3... in unlock order, give each a `unit`, `unitTitle`, `title`, an optional `icon` emoji, and `status`). Cards are grouped by `unit`. A lesson with `"status": "ready"` opens `lesson.html?n=<id>` and needs a content file, `data/money/lesson-<id>.json` (below). Lessons still `coming-soon` show a note instead. Nothing else needs code: the family page, the unlock panel, the children's homes and the grown-up page's money cards all read these files.

## Money & Economics lessons, solo follow-ons, flags and progress (v8)

**Code:** `js/money.js` (lesson list, unlock rules, `loadLesson`, `soloList`, `flag`), `js/money/art.js` (emoji and inline SVG pictures), `js/money/common.js` (Hear it again, Ask a grown-up), `js/money/family.js` (plays a family lesson), `js/money/solo.js` (plays a child's follow-on). Pages: `lesson.html`, `solo.html`, with `js/pages/lesson.js` and `js/pages/solo.js`. Everything is local files: no network, no timers, no progress bars; motion is turned off for people who prefer reduced motion.

**A family lesson** (Family login, about 5-10 minutes): an intro screen with a Start button, then the lesson's story and question screens in order (one idea per screen; Next, Back, Hear it again and Slower, and an Ask a grown-up button on every screen), then a calm "Grown-up talk" screen with the prompts and a **We finished!** button. Pressing it marks the lesson complete for the Family (which opens the next lesson through the existing unlock logic) and earns a Family sticker (`ju_family_stickers_v1`, week `money`, key `family:lesson-N`). Replaying a finished lesson keeps its first finish time. A "what would you do?" question never says wrong: every answer gets a reason, and the strongest one gets a star. A locked lesson, or one with no content yet, goes back to the Family home.

**A solo follow-on** (`solo.html?n=N`, from the child's own login): opens once the Family has finished lesson N (a grown-up preview with `&p=julianna|dorian` ignores the lock and saves nothing). Short (3-5 minutes). Julianna's has more reasoning (sort trades into "works" or "gets stuck" and tap the reason; sort 8 pictures into needs and wants; pick fair token amounts and work out days to 100 tokens; follow a $10 balance through three swipes). Dorian's is voice-led and picture-first: the voice reads everything, every button is big, there is no typing or reading, and counts stay at 10 or 20. A wrong tap is gentle ("Not that one. Try another.") and greys that option out; the right tap explains why. Finishing saves a sticker for that child (`money`, `solo-N`).

**Earned hints** reuse `js/hints.js` unchanged in its rules: locked until 2 real wrong answers on that question, wrong taps that are quick (within 3 seconds of the question appearing or the last tap) or repeated do not count (the button then says to ask a grown-up), at most 3 hints per session, and **Grown-up unlock** with the parent PIN. The hint is a spoken clue that does not give the answer. A question with only two answers (the needs/wants and works/stuck sorts) has no hint, since there is only one wrong answer to tap. Hint log entries are saved in that child's own hint log with `subject: "money"`, `game: "money-N"`, and are shown in the money card on the grown-up page, not in Julianna's spelling Hints section. A hinted question is saved as not right on the first try.

**Ask a grown-up flags:** pressing the button logs `{ id, ts, profile, kind ('lesson' = family lesson | 'solo'), lesson, screen (1-based) }` once per screen visit (profile `family`, `julianna` or `dorian`) and shows a friendly note (Dorian's is spoken). The grown-up page lists each profile's flags, newest first (when, where, lesson, screen) with a **Clear flags** button (it asks first). Flags are part of the backup and restore, and a count appears in each profile's cards and in the backup email summary.

**Progress:** a child's results are `{ id, ts, session, lesson, q, kind ('choose'|'sort'|'count'), correct (right on the first try with no hint), tries, hinted }` in `ju_<profile>_money_v1` with `done: { "<lessonId>": "<ISO time>" }`. The grown-up page shows, per child, a Money & Economics card: activities finished (x of y), answers saved, right on the first try, hints used, and a per-lesson table (right first try, hints, grown-up unlocks, quick-guess flags, and a Preview link). Dorian's summary cards count his money activities too.

### Lesson data format (`data/money/lesson-<id>.json`)

```
{ "id": 1, "title": "...", "sticker": "<emoji>",
  "screens": [
    { "kind": "intro", "title": "Lesson 1: ...", "text": "...", "art": <art> },
    { "kind": "story", "text": "...", "art": <art> },
    { "kind": "ask", "prompt": "...", "art": <art>, "options": [ { "label": "...", "why": "...", "e": "<emoji>", "best": true }, ... ] } ],
  "talk": [ { "q": "a grown-up talk prompt", "note": "optional: a hint for the grown-up" } ],
  "solo": { "julianna": <solo>, "dorian": <solo> } }
```

- 6-9 screens, about 2-3 `ask` screens (exactly one option has `best: true`; every option has a `why`, shown and spoken after a tap), and 2-3 `talk` prompts. Keep sentences short and plain, no brand names.
- `<art>` is `{ "kind": "row", "items": [ "<emoji>", { "e": "<emoji>", "label": "caption" }, { "svg": "coin" | "token" | "cash" }, { "t": "$5" } ], "alt": "describes the picture" }`, or `{ "kind": "tokens", "n": 5 }`, `{ "kind": "piles", "piles": [ { "n": 8, "glyph": "coin" } ] }`, `{ "kind": "flow", "amount": 5 }` (cash from our hand to the store), or `{ "kind": "balance", "from": 20, "spend": 5, "to": 15 }` (`"to": null` shows a ?).
- `<solo>` is `{ "title", "intro" (spoken and shown), "sticker", "art", "items": [...] }`. Item types: **`choose`** `{ "type": "choose", "id", "prompt", "art", "options": [ { "label", "e" | "svg" | "pile": { "n", "glyph" }, "right": true } ], "hint": "spoken clue", "why": "shown and spoken after the right tap", "say": "optional text to read instead" }`; **`sort`** `{ "type": "sort", "id", "prompt", "thing": "<emoji or {e, label}>", "groups": [ {label, e}, {label, e} ], "answer": 0 | 1, "why", "reasons": [ { "label", "right" } ] (optional: then a "Why?" question with a hint), "hint", "reasonWhy" }`; **`count`** `{ "type": "count", "id", "n", "prompt", "doneText" }` (tap each token while the voice counts). Give each `id` once per file. Options are shown in the order written, so vary where the right one sits.
- The voice reads a question's `prompt`; for Dorian it also reads the answer labels.

**To add a lesson (for later units):** write `data/money/lesson-5.json` in the same format, set that lesson's `status` to `ready` in `lessons.json` (and an `icon`), add a lesson to `tests/e2e.py`'s lesson list, and run the tests. No page or script changes are needed.

## Dorian's home (v6)

`dorian.html` is Dorian's home: "Hi, Dorian!" with a spoken greeting (`JU.speech.say`, the same voice as the rest of the site, chosen under Voice settings), a big speaker button to hear it again (some browsers wait for a tap before they will speak), and a wave button to log out. No reading, typing, timers or progress bars. From v8, a big picture button appears for each money lesson the Family has finished (his follow-on, `solo.html?n=N`). Since v10 a finished one keeps its own picture with a check mark on top and stays a button: tapping it plays the activity again as **practice** (see v10 below). Since v9 the two kindergarten games are here (big picture buttons for Letter sounds and Build a word; each says its name when it gets focus and when it is tapped, and the page opens once the name has been said). A row of the stickers he has earned in those games shows at the bottom, as pictures only (no numbers).

## Kindergarten track, round 1 (v9): Letter sounds and Build a word

For Dorian (5, kindergarten, reads three-letter words). Everything is voice-led, picture-first and tap-only: big buttons, no typing, no timers, no progress bars, no scores on his screen, no shaming (the voice says "Listen again" or "Let's try again", never "wrong"). Reduced motion is respected. Every screen has a big speaker button (**Hear it again**, at the site voice's slow default x0.9), a turtle (slower), a small **Ask a grown-up** button and a home button. There are no outside requests and no downloaded files: pictures are emoji.

**Code:** `js/kinder.js` (logic and data loading, pure so tests can call it), `js/kinder/play.js` (the shared runner: start screen, rounds, saving, hints, stickers), `js/kinder/letters.js` and `js/kinder/build.js` (the two activities), `kinder.html` + `js/pages/kinder.js`. **Data:** `data/kinder/letters.json`, `data/kinder/cvc.json`.

**A visit and its rounds.** A *session* is one visit to an activity page. A *round* is 4 items, plus one comeback for each item he missed (at most 2, so 4 to 6 items), then a sticker. After a round he can play one more round (still the same session) or go home. Each finished round saves a sticker picture under `ju_dorian_stickers_v1` (week `kinder`, key `letters-3` or `build-2`; the picture is worked out from that key by `JU.kinderSticker`). A missed item comes back two screens later (or at the end of a short round), with another picture and other choices for a letter, or a fresh tray for a word.

**Earned hints** use exactly the existing rules (`js/hints.js`): locked until 2 real wrong taps on that item; wrong taps that come within 3 seconds of the item appearing or of the previous tap, or that repeat an earlier wrong tap, are "rapid" and do not count (they are logged as quick-guess flags); at most 3 earned hints per visit; **Grown-up unlock** with the parent PIN (the PIN box only appears when a grown-up presses that small button; nothing else on his pages is a typing field). The hint is logged in `ju_dorian_hints_v1` with subject `kinder` and game `kinder-letters` or `kinder-build`. When a hint opens the voice says "A hint is ready. Tap the light bulb." (v10: the hint is a light bulb picture button, see below) A hinted item counts as not right on the first try. Letter hint: names another picture that starts with the sound. Word hint: sounds the word out slowly ("kuh. ah. tuh. cat.").

**Ask a grown-up** reuses the money flags (`JU.moneyUI.askButton`, `JU.money.flag`): one flag per screen visit, saved in `ju_dorian_flags_v1` as `{ kind: 'kinder', lesson: 1 (Letter sounds) | 2 (Build a word), screen (1 = the start screen), item (the letter or word on screen), round }`. They are listed with the other flags on the grown-up page.

### Letter sounds (`data/kinder/letters.json`)

The voice says a sound ("mmm"), asks "Which picture starts with mmm?" and names the three pictures; he taps one. Wrong taps grey the picture out (voice: "Listen again. mmm."), the right tap says "Yes! mouse starts with mmm." A small ear button says just the sound.

```
{ "rules": { "knownSessions": 3, "maxLearning": 6, "roundItems": 4, "maxRoundItems": 6 },
  "start": ["s","a","t","m","p","n"],
  "extended": ["b","d","g","h","c","k","r","f","l","j","w","v","z","x","qu","y","e","i","o","u"],
  "letters": { "m": { "say": "mmm", "pics": [ { "e": "<emoji>", "word": "mouse" }, ... ] },
               "c": { "say": "kuh", "sameSound": ["k"], "pics": [...] },
               "x": { "say": "ks", "position": "end", "pics": [...] } } }
```

- **Add a letter:** add `{ "say", "pics": [2+ entries] }` under `letters` and put its id in `extended` (the order is the order letters open; the start set is always in). Every picture's word must start with the letter (or end with it when `"position": "end"`, as for `x`). Give letters that sound the same (`c`/`k`) a `sameSound` list both ways, so they never appear as wrong choices for each other. The tests check all of this.
- **Change how a sound is spoken:** edit its `say` (it is plain text for the voice; for example `"mmm"`, `"tuh"`). Voices differ, so check new ones by ear.
- **Progression (all in `JU.kinder`, documented at the top of `js/kinder.js`):** a letter is *known* when it was right on the first try, with no hint, in `knownSessions` (3) different sessions (every time it came up in a session counts; a session where he missed it once is not clean, even if the comeback was right). At most `maxLearning` (6) letters are "still learning" at once; every time one becomes known, the next letter of `extended` joins. Letters he missed recently come back more often: the draw is weighted (known 1, new or learning 2, +3 if the latest answer was a miss, +1 if the one before was).
- Each question: the target picture is picked from the letter's `pics`; the two wrong pictures come from other letters in play (never a look-alike sound, never a picture that also fits).

### Build a word (`data/kinder/cvc.json`)

He hears "Let's build cat. Tap the sounds in order." and sees the picture, three empty boxes and a tray of letter tiles. Tapping the right next tile drops it in the next box and the tile says its sound; a wrong tile gets "Let's try again. cat." When the third box is filled the voice says the whole word ("cat. You built cat!").

```
{ "rules": { "knownSessions": 2, "wordsToOpenNext": 4, "trayExtraAfter": 5, "roundItems": 4, "maxRoundItems": 6 },
  "tiers": [ { "letters": ["s","a","t","m","p","n"] }, { "add": ["i","c","r"] }, { "add": ["o","g","d","u","b"] } ],
  "words": [ { "word": "map", "e": "<emoji>", "tier": 1 }, ... ] }
```

- **Add a word:** append `{ "word", "e", "tier" }`. Three different letters, only letters that tier has (tier 1 = s a t m p n; tier 2 adds i c r; tier 3 adds o g d u b), every letter present in `letters.json` (its tile says that sound), and a picture that clearly shows the word. **Add a tier:** add an `{ "add": [...] }` entry to `tiers` and use its number in `tier`.
- **Progression:** tier 1 is always open (map, man, pan, nap, tap). Tier N+1 opens when `wordsToOpenNext` (4) words of tier N are known (a word is known after it was built right on the first try, with no hint, in `knownSessions` (2) different sessions). The tray has just the 3 tiles until he has built `trayExtraAfter` (5) words right first time, then 4 (one extra letter from the tier's letters that is not in the word and not a b/d look-alike). The tiles are never already in order. Missed words are weighted like missed letters. Build-a-word uses its own word tiers, so it does not wait for the letter-sounds list: he already reads three-letter words, and every tile speaks its sound.

### Saved results

`ju_dorian_kinder_v1`: `{ "answers": [...], "rounds": [...] }` (record shapes in the header of `js/kinder.js`). One answer per item shown: `{ id, ts, session, round, activity ('letters'|'build'), item, correct (right first time, no hint), tries (wrong taps + 1), hinted, wrong (letters tapped by mistake) | letters: [ { l, wrong } ] (one entry per box of a word) }`; one round record per finished round: `{ id, ts, session, activity, items, clean }`. Merging a backup skips an answer with the same id (or the same session, activity, item and time) and a round with the same id (or session, activity and time), so loading a file twice never duplicates. **Clear kindergarten results** (grown-up page, Dorian view) clears his kindergarten answers, rounds, stickers and kindergarten hints only; his flags, money results, Julianna's and the Family's data stay, and Julianna's **Clear results** never touches his.

### Grown-up page

Dorian view, **Kindergarten** card: sessions, rounds finished, letters he knows / still learning / not met yet, words built, hints used (earned plus grown-up unlocks), a table of letters (the sound the voice says, status, clean sessions out of 3, times seen, missed first time, hints), a table of words built, the letters he tapped by mistake while building, the open word tier, **Preview** links for both games (nothing is saved while a grown-up plays), and the Clear button. His Ask a grown-up flags are in the usual flags card ("Kindergarten", Letter sounds or Build a word, with the letter or word).

### Voice: sounds worth checking by ear

The sounds are plain text sent to the browser's voice, so they differ by voice. Worth listening to once with the voice you chose: `ah` (a), `aw` (o), `eh`, `ih`, `uh` (the short vowels; `a` and `o` are the likeliest to sound alike), `ks` (x), `kwuh` (qu), and the stretched `sss`, `mmm`, `nnn`, `rrr`, `fff`, `lll`, `vvv`, `zzz` (some voices spell them out). Fix any of them in `data/kinder/letters.json` (`say`).

### Not built yet (round 2)

Sight words from the weekly list from Son's Tutor Bot, counting to 20, and adding within 5.

## v10: phone layout, Dorian's spoken pages, practice replays, jump links

**Phone layout (390px wide).** No page may scroll sideways, at 390x844 or 1280x800. The causes were grid columns that were `1fr` (which can grow past the screen when the content is wide: now `minmax(0, 1fr)` everywhere), the Back up to Grok Bot address box (`min-width: 18rem`, now fills the row and stacks under 600px), and the practice cards. Under 600px the page is a little tighter (smaller font and padding), the token and practice grids shrink, the **Family unlock table becomes one stacked block per lesson** (each cell is labelled with `data-label`; the Unlock and Mark complete buttons stay), and every other wide table (the kindergarten tables, the spelling tables, the flag tables) scrolls inside its own box (`.tablewrap`). Julianna's game cards use `minmax(0, 1fr)` so none is cut off at the right.

**After a tap question on a laptop** (family lessons, both children's follow-ons and Dorian's kindergarten games): once the explanation is shown and Next is enabled, `JU.moneyUI.reveal(feedback, next)` (in `js/money/common.js`) scrolls just enough that both are in view, smoothly, or instantly when the person prefers reduced motion. It does nothing when they are already visible, and on a very short screen it puts the explanation at the top.

**Dorian's pages: what he is told in text is also spoken, and words are replaced by pictures.** Wrong taps ("Not that one. Try another." in the money games, "Listen again. mmm." and "Let's try again. cat." in the kindergarten games) are shown and spoken, as are the explanation after a right tap, the counts, the Ask a grown-up note (also in a grown-up preview) and the finish message. The money intro now speaks the title he sees before the intro text. The earned hint (`js/hints.js`, `ctx.kid`) has no words on it: the locked hint is a **lock picture button** (pressing it says "Ask a grown-up for a hint."; once 3 hints are used it says "That was three hints. Ask a grown-up for more."), and an opened hint is a **light bulb** button plus the turtle, with no "Hint unlocked" note. When the wrong tap opens the hint, the voice adds "A hint is ready. Tap the light bulb." (`gate.miss()` now returns true for that tap). The small "Grown-up unlock" button and the PIN box stay as text because they are for the grown-up. Julianna's hint display is unchanged.

**Replay is practice.** On Dorian's home a finished money game keeps its own picture, with a check mark on top, and is still a button (`data-state="done"`, `aria-label` "... finished. Tap to play again"; it says so when tapped). Opening an activity that is already finished starts it in **practice**: a practice picture (a plain note for Julianna) and, for Dorian, the voice says "You did this one already. Let us practice again!". In practice nothing new is saved: no answers, no hint log, no second finish time and no second sticker, so the first time's numbers on the grown-up page are never counted twice. "Ask a grown-up" still saves a flag. The end says "Great practice! Your sticker is still in your collection." This applies to Julianna's follow-ons as well (same code, `js/money/solo.js`).

**Grown-up page.** A **Jump to:** row sits right under the Julianna / Dorian / Family switch, near the top of the page, and shows the links for the profile picked (Julianna: Spelling, Money, Hints, Flags. Dorian: Kindergarten, Money, Flags. Family: Lessons, Flags). A link scrolls its section to the top (smoothly, or instantly for reduced motion) and moves keyboard focus to the section heading; `parent.html?p=dorian#money-dorian` also opens at that section. The "very quick or repeated wrong taps" message (money cards and the kindergarten card) is now calm ("In one session, 3 questions had very quick or repeated wrong taps. That is common when a child is excited or tired, and those taps do not unlock a hint. If it keeps happening, a friendly chat may help.") and only shows when **one session** had at least 3 such flags (`RAPID_SESSION_MIN` in `js/pages/parent.js`), so a short burst or flags spread over several visits never trigger it. Julianna's spelling Hints readout is unchanged. The backup email body ends its instructions with "The bot saves it. You do not need to wait for a reply." The backup file stays at version 5.

## Adding math later

1. Add `{ id: 'math', title: 'Math', ... games: [...] }` to `js/subjects.js`.
2. Add `"subject": "math"` entries to `data/weeks.json` and week files.
3. Write games in `js/math/*.js` using `JU.registerGame('math', { id, title, emoji, sticker, blurb, playWord(ctx, item) })` and load them in `child.html`, `game.html`, and `parent.html`.
4. Add a subject picker to `js/pages/child.js` (it currently uses the first subject).

## GitHub Pages

Settings > Pages > "Deploy from a branch" > `main` / root. The `.nojekyll` file tells Pages to serve the files as they are. All links are relative, so it works at `https://<user>.github.io/ju-learning/`.
The site must be served over http(s) (it loads JSON with `fetch`), so opening `index.html` straight from disk will not work. To try it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

## Browser notes

- "Hear the word" uses the browser's built-in voice (`speechSynthesis`), which Chrome on Chromebooks and laptops has. If a browser has no voice, the games still work and show a note.
- Voice (v3): `js/speech.js` waits for the browser's voice list, ranks English voices (Natural/Online/Neural, Google US English, Samantha, Aria... first; eSpeak, compact and novelty voices last), and speaks at 0.85x. The grown-up page has **Voice settings** (voice, speed 0.6-1.1, Test voice), saved on the device via `js/storage.js` (`ju_voice_v1`, separate from scores). The test says the word, the sentence, then the word again; games that speak have a **Slower** button. If only a basic voice exists, the grown-up page shows a short tip.
- Animations are turned off for people who prefer reduced motion. There are no timers and no progress bars.

## Tests

`tests/e2e.py` drives the site with Playwright and system Chrome (start `python3 -m http.server 8765` in this folder first; screenshots go to `/workspace/ju-learning-previews/`, with the newer ones in `v2/`). It logs in with both PINs, completes every game and the test, and checks the dashboard, CSV export, and clear. The v10 section checks, at 390x844 and 1280x800, that `document.scrollWidth <= window.innerWidth` on the main pages (landing, PIN keypad, Julianna's home and games, Dorian's home, Family home, every family lesson and solo screen including answered and hint-open states, the kindergarten games, and all three parent views with and without a saved address), that answered lesson screens show the explanation and Next without scrolling (smooth and reduced motion), that Dorian's text is spoken (a stubbed `speechSynthesis` records every utterance), the replay-is-practice rules, the Jump to links and the calm note. It also tests `add_week.py` (schema, idempotent, refusals), `make_update_zip.sh` (with and without `zip`), the trend charts, the keeps-missing list, backup and restore (no duplicates), the Review game (hidden without history, picks, fades), and that no request leaves the site. The v9 section covers the kindergarten track: the letter and word data (shape, pictures, sounds, tiers), the mastery, unlock and weighting logic called straight in the page, both games played end to end with right and wrong taps, comebacks, earned hints (locked, rapid taps blocked, 3 per visit, grown-up unlock), flags, per-letter and per-word results, stickers, isolation from Julianna and the Family, the parent card, preview (saves nothing), Julianna's Clear results leaving Dorian alone, Clear kindergarten results, backup version 5 (round trip, no duplicates, version 1 to 4 files), a phone-sized screen, reduced motion, no typing on his pages, no outside requests and no email address in any site file. The v8 section covers Money & Economics Unit 1: lesson data shape and content rules (no brands, family facts), each family lesson 1-4 played end to end (hear it again and Ask a grown-up on every screen, reasoning after each tap, grown-up talk, We finished!, sticker, the next lesson unlocking, locked lessons refusing direct links), solo activities locked until the lesson is finished, results saved per child, the earned-hint rules (locked, quick taps not counted, 3 per session, grown-up unlock), Dorian's pages (voice-led, big buttons, no typing), flags logged and listed with Clear flags, backup version 4 round trip with no duplicates and old version 1-3 files, the plural wording in the backup email and messages, reduced motion, and no outside requests. The v6 section covers the landing page and the three logins plus the grown-up entry, wrong-profile PINs, role redirects, separate storage per profile, the profile switch, the lesson lock/unlock rules, backup version 3 (round trip, no duplicates, old version 1 and 2 files into Julianna), the v7 one-click Back up to Grok Bot flow (download, last-backup date, the `mailto:` subject and body, address handling, change-address link, disabled without an address, and that no email address appears in any site file), reduced motion, and no outside requests. Python needs Playwright (`/workspace/pwenv/bin/python tests/e2e.py` has it).

## Earned hints (v4)

In Unscramble, Grow the Flower, Word Match (the clue question) and Clap the Beats the spoken "Hear the word" hint is locked at first (lock icon, "Hint unlocks after 2 tries"). Code: `js/hints.js`, used through `ctx.hintGate()` in `js/runner.js`; games opt in with `hintGate: true`. Listen and Type, the Test and Review are unchanged.

- It unlocks for that word only after 2 real wrong answers. Wrong answers that come within 3 seconds of the word appearing or of her previous answer, or that repeat an earlier wrong answer on that word, are "rapid" and do not count; the button then says "Ask a grown-up for a hint". (Clap's beat count may repeat the same wrong number; only timing counts there.)
- Hear the word and Slower are one hint for that word (replays are free). At most 3 hints per game session; after that it stays locked.
- **Grown-up unlock** asks for the parent PIN (`JU.auth.verifyParent`, PIN from `js/config.js`) and unlocks the hint for that word, even past the cap. Three wrong PINs pause the box for 30 seconds.
- Unscramble and Clap no longer say the word on their own when they start (that gave the answer away), and Clap's "show the answer" step no longer speaks the word.
- Every hint use, grown-up unlock and rapid-miss flag is logged in `ju_hints_v1` (`storage.getHints/addHint/importHints/clearHints`), separate from scores. The backup file is now version 2 and has a `hints` list; older backups without it still load. Clear results also clears the log.
- A word where the hint was used is saved with `hinted: true` and `correct: false`, so it counts as missed: it stays in Practice these next and the word tables, and is not treated as mastered.
- The grown-up page has a **Hints** section (hints used, earned, grown-up unlocks, rapid-miss flags, a plain readout, tables by game and by word per week).

## Backup reminder (v5)
When there are saved results and a school week has ended since the last backup (a week counts as over from Saturday), or the last backup is over 7 days old, or no backup was ever made, the grown-up page shows a "Time to save a backup" banner with a big **Save backup now** button (the same download as Save progress) and the date of the last backup. It hides once a backup is saved. The child home shows only a quiet line at the bottom, "Ask a grown-up to save progress", with no button. No timers, no network, nothing shown when there are no results. Logic is in `js/backup.js`. A browser needs a click to download a file, so the site can remind but cannot save by itself.

## Changelog

- **v10 (Oct 28, 2026):** phone layout fixes (no sideways scrolling at 390px; the address box fits; the Family unlock table stacks on a phone and the other wide tables scroll inside their own box; Julianna's game cards are not cut off); on a laptop the explanation and Next are scrolled into view after a tap question; Dorian's pages speak every message they show and use a lock picture and a light bulb picture for the hint; finished money games keep their check mark and can be played again as practice (nothing new saved, no double-counted answers, finish or sticker); a Jump to row under the parent page's profile switch; the "very quick or repeated wrong taps" note is calmer and needs 3 in one session; the backup email now says "The bot saves it. You do not need to wait for a reply." Backup file stays at version 5.
- **v9 (Oct 28, 2026):** Dorian's kindergarten track, round 1. **Letter sounds** (the voice says a sound, he taps the picture that starts with it; s a t m p n first, then b d g h c k r f l j w v z x qu y e i o u as letters become known) and **Build a word** (hear the word, see its picture, tap the sounds into three boxes; tiles speak their sounds; picture words in three tiers). Rounds of 4 to 6 items with comebacks for misses and a picture sticker per round; earned hints and Ask a grown-up flags reuse the existing rules; results saved under Dorian's own key. Dorian's home has big picture buttons for both games and shows his stickers. Grown-up page: a Kindergarten card, preview links and Clear kindergarten results. Backup file version 5 adds Dorian's kindergarten results (versions 1-4 still load). The 'coming soon' text on Dorian's home is gone.
- **v8 (Oct 28, 2026):** Money & Economics Unit 1 (lessons 1-4) is playable. Family lessons on the Family login (`lesson.html`): a voiced story with pictures, "what would you do?" taps with a reason after each one, a calm Grown-up talk screen, and a We finished! button that marks the lesson complete (opening the next), with a Family sticker. An Ask a grown-up button on every screen logs a flag. Solo follow-ons from each child's own login (`solo.html`; Julianna's on her home, Dorian's as big picture buttons on his), locked until the Family finishes the lesson, saved under each child's own profile, with the existing earned-hint rules (Dorian's is voice-led, picture-first, tap-only). Content lives in `data/money/lesson-N.json`, so later units are added by adding data files. Grown-up page: real Ask a grown-up flag lists with Clear flags, a Money & Economics card per child, Dorian's cards count his activities. Backup file version 4 adds flags and money results (versions 1-3 still load). Wording: the backup email now says "The bot saves it and lets the family know it arrived", and counts use the singular where they should ("1 sticker", "1 hint log entry", "1 game", "1 answer", "1 word").

- **v7 (Oct 28, 2026):** one-click **Back up to Grok Bot** on the grown-up page replaces Backup by email: it downloads the usual backup file (and sets the last-backup date), then opens an email pre-filled with a subject, short attach-and-send instructions with the exact file name, and the counts summary. The address is typed once, kept only in that browser (never in the repo, site files or backup file), shown as "Sending to: ..." with a Change address link, and the button is disabled until one is saved. The reminder banner mentions it. Save progress and Save backup now are unchanged.
- **v6 (Oct 28, 2026):** a second child and a family course. Landing page "Who's playing?" with Julianna, Dorian and Family (plus a small Grown-up entry), one PIN each; roles `julianna`, `dorian`, `family`, `parent` with role-checked pages; per-profile storage (Julianna's keys unchanged); backup file version 3 with all profiles (older files still load into Julianna); Dorian's placeholder home (spoken greeting, tap only); Family Money & Economics page with 16 locked-in-order lessons from `data/money/lessons.json` (lesson content coming); grown-up page profile switch, lesson unlock panel, "Ask a grown-up" flags placeholders and Backup by email. Julianna's spelling games, hints, reminder and results are unchanged.
- **v5 (Oct 27, 2026):** backup reminder: a "Time to save a backup" banner with a Save backup now button on the grown-up page (when there are results and the week has ended since the last backup, the last backup is over 7 days old, or none was ever made), and one quiet line, "Ask a grown-up to save progress", on the child home. The last-backup date is stored in `ju_lastbackup_v1` (not in the backup file).
- **v4 (Oct 27, 2026):** earned spoken hints in the puzzle games with rapid-miss blocking, 3-hint cap per session and a PIN "Grown-up unlock"; hint log (in backup and restore); Hints section on the grown-up page; hinted words count as missed.
- **v3 (Oct 27, 2026):** clearer, natural-sounding voice picked automatically, slower default speed, voice picker, speed slider and Test voice button on the grown-up page, "Slower" button on games, dictation order word-sentence-word in the test.
