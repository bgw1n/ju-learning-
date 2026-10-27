# Julianna's Learning Place

A small, plain HTML/CSS/JS website with spelling games and an online spelling test for a 3rd grader.
No build step, no frameworks, no network calls except loading this site's own files (Lexend font is bundled).
Spelling only for now. The code is laid out so a `math` section can be added later.

## What is in it

| Page | What it does |
| --- | --- |
| `index.html` | "Welcome, Julianna!" with a PIN keypad (on-screen buttons or keyboard). |
| `child.html` | Games home: sticker boxes, five games, and the test. |
| `game.html?s=spelling&g=<id>` | Runs one game: `unscramble`, `hangman` (Grow the Flower), `match`, `listen`, `clap`, `review`, or `test`. |
| `parent.html` | Grown-up dashboard (week-by-week trend, words she keeps missing, scores, most-missed words, misspellings, practice list, proctor mode, CSV export, Save/Load progress, clear results). |

Every game covers all 12 words in two short rounds of 6. Stickers: finishing a game earns its sticker for that week.
Letters are always lowercase on screen (tiles, keys, typed text), so letter case never gives an answer away.

## Logging in (casual gate, NOT real security)

- Child PIN `0518` opens the games. Parent PIN `1821` opens the grown-up page.
- The PINs live in **`js/config.js`** (change them there).
- This is only a gate to keep people from wandering in by accident. The PINs are in the page source of a public site, so **anyone who looks can read them**. Do not put anything sensitive here.
- The logged-in role is kept in `sessionStorage`, so closing the tab logs out. Protected pages send you back to `index.html` when nobody is logged in.

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

All reads and writes go through **`js/storage.js`** (one small module, all functions async). Today it uses this browser's `localStorage`:

- `ju_results_v1`: one record per word per game/test play: `ts`, `session`, `week`, `subject`, `type`, `proctored`, `word`, `typed`, `typedAll`, `correct`, `tries`.
- `ju_stickers_v1`: stickers earned per week.

Results exist **only in that laptop's browser**. They do not sync, and clearing site data erases them. On the grown-up page:

- **Save progress (backup file)** downloads one JSON file (`julianna-progress-YYYY-MM-DD.json`) with every result and sticker.
- **Load progress...** reads such a file and **merges** it: a result already here (same id, or same session, game, word and time) is skipped, so loading the same file twice, or an older backup, never duplicates. A file that is not a backup is refused and nothing changes. Use this to restore after clearing site data or to bring another laptop's results over.
- **Export results (CSV)** is for spreadsheets, not for restoring.

Save a backup now and then (for example each Friday). To share results live across devices later, replace the function bodies in `storage.js` with calls to a backend; nothing else needs to change.

### Grown-up dashboard extras

- **Week by week:** three small inline SVG charts (latest finished test score, different words missed, games finished) for every week in `data/weeks.json`, plus a "See the numbers" table. A game or test counts as finished when every word was answered. Review practice is left out.
- **Words she keeps missing:** words missed in 2 or more different weeks (a miss in Review counts as a miss in that week), with the last misspelling she typed. A word leaves the list after two right answers in a row in Review.

### Review game (child side)

`js/spelling/review.js`. On the child home a green dashed **Review** card appears only when she has words missed in an earlier week (so it is hidden for the first week and when there is no history). It plays up to 6 of those words, most missed first, using the Unscramble and Listen-and-Type mechanics; the 2 most-missed words (missed 2+ times) get a second step in the other mechanic, so it is at most 8 short steps. Words fade out after two right Review answers in a row. Same calm rules: Lexend, lowercase only, no timer, no progress bar, no round break, no new sticker box (it ends with a star). Results are saved as type `review` under the current week.

What "correct" means: Unscramble, Listen and Type, Word Match, and Clap the Beats count as correct when right on the first try. Grow the Flower counts as correct with 2 or fewer missed letters. The test counts one try per word.

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

`tests/e2e.py` drives the site with Playwright and system Chrome (start `python3 -m http.server 8765` in this folder first; screenshots go to `/workspace/ju-learning-previews/`, with the newer ones in `v2/`). It logs in with both PINs, completes every game and the test, and checks the dashboard, CSV export, and clear. It also tests `add_week.py` (schema, idempotent, refusals), `make_update_zip.sh` (with and without `zip`), the trend charts, the keeps-missing list, backup and restore (no duplicates), the Review game (hidden without history, picks, fades), and that no request leaves the site.

## Earned hints (v4)

In Unscramble, Grow the Flower, Word Match (the clue question) and Clap the Beats the spoken "Hear the word" hint is locked at first (lock icon, "Hint unlocks after 2 tries"). Code: `js/hints.js`, used through `ctx.hintGate()` in `js/runner.js`; games opt in with `hintGate: true`. Listen and Type, the Test and Review are unchanged.

- It unlocks for that word only after 2 real wrong answers. Wrong answers that come within 3 seconds of the word appearing or of her previous answer, or that repeat an earlier wrong answer on that word, are "rapid" and do not count; the button then says "Ask a grown-up for a hint". (Clap's beat count may repeat the same wrong number; only timing counts there.)
- Hear the word and Slower are one hint for that word (replays are free). At most 3 hints per game session; after that it stays locked.
- **Grown-up unlock** asks for the parent PIN (`JU.auth.verifyParent`, PIN from `js/config.js`) and unlocks the hint for that word, even past the cap. Three wrong PINs pause the box for 30 seconds.
- Unscramble and Clap no longer say the word on their own when they start (that gave the answer away), and Clap's "show the answer" step no longer speaks the word.
- Every hint use, grown-up unlock and rapid-miss flag is logged in `ju_hints_v1` (`storage.getHints/addHint/importHints/clearHints`), separate from scores. The backup file is now version 2 and has a `hints` list; older backups without it still load. Clear results also clears the log.
- A word where the hint was used is saved with `hinted: true` and `correct: false`, so it counts as missed: it stays in Practice these next and the word tables, and is not treated as mastered.
- The grown-up page has a **Hints** section (hints used, earned, grown-up unlocks, rapid-miss flags, a plain readout, tables by game and by word per week).

## Changelog

- **v4 (Oct 27, 2026):** earned spoken hints in the puzzle games with rapid-miss blocking, 3-hint cap per session and a PIN "Grown-up unlock"; hint log (in backup and restore); Hints section on the grown-up page; hinted words count as missed.
- **v3 (Oct 27, 2026):** clearer, natural-sounding voice picked automatically, slower default speed, voice picker, speed slider and Test voice button on the grown-up page, "Slower" button on games, dictation order word-sentence-word in the test.
