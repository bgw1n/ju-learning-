# Julianna's Learning Place

A small, plain HTML/CSS/JS website with spelling games and an online spelling test for a 3rd grader.
No build step, no frameworks, no network calls except loading this site's own files (Lexend font is bundled).
Spelling only for now. The code is laid out so a `math` section can be added later.

## What is in it

| Page | What it does |
| --- | --- |
| `index.html` | "Welcome, Julianna!" with a PIN keypad (on-screen buttons or keyboard). |
| `child.html` | Games home: sticker boxes, five games, and the test. |
| `game.html?s=spelling&g=<id>` | Runs one game: `unscramble`, `hangman` (Grow the Flower), `match`, `listen`, `clap`, or `test`. |
| `parent.html` | Grown-up dashboard (scores, most-missed words, misspellings, practice list, proctor mode, CSV export, clear results). |

Every game covers all 12 words in two short rounds of 6. Stickers: finishing a game earns its sticker for that week.
Letters are always lowercase on screen (tiles, keys, typed text), so letter case never gives an answer away.

## Logging in (casual gate, NOT real security)

- Child PIN `0518` opens the games. Parent PIN `1821` opens the grown-up page.
- The PINs live in **`js/config.js`** (change them there).
- This is only a gate to keep people from wandering in by accident. The PINs are in the page source of a public site, so **anyone who looks can read them**. Do not put anything sensitive here.
- The logged-in role is kept in `sessionStorage`, so closing the tab logs out. Protected pages send you back to `index.html` when nobody is logged in.

## Add a new week

1. Copy `data/week-2026-10-26.json` to a new file, for example `data/week-2026-11-02.json`, and edit it:
   - `id` (use the Monday date, `YYYY-MM-DD`), `label`, `title`, `source`
   - `syllableColors`: two colors that alternate by syllable (same scheme as the printed sheets, blue `#1663d6` and orange `#e06c00`)
   - `patterns` (optional): `[{ "label": "...", "letters": "ough", "color": "#..." }]`, used only if `syllableColors` is empty
   - `words`: for each word, `word` (all lowercase), `clue`, `riddle`, `sentence` (must contain the word, not at the start so no capital gives it away), and `syllables` as an array (`["to","tal"]`; the parts must join back to the word)
2. Add **one line** to `data/weeks.json`:
   ```json
   { "id": "2026-11-02", "subject": "spelling", "label": "Week of Nov 2", "file": "week-2026-11-02.json" }
   ```
3. Commit and push. The child home shows a week picker once there is more than one week, and by default opens the newest week that has started.

Twelve words per week is what the games are tuned for (two rounds of six), but other counts work.

## Where results are saved

All reads and writes go through **`js/storage.js`** (one small module, all functions async). Today it uses this browser's `localStorage`:

- `ju_results_v1`: one record per word per game/test play: `ts`, `session`, `week`, `subject`, `type`, `proctored`, `word`, `typed`, `typedAll`, `correct`, `tries`.
- `ju_stickers_v1`: stickers earned per week.

Results exist **only in that laptop's browser**. They do not sync, and clearing site data erases them. Use **Export results (CSV)** on the grown-up page to keep a copy. To share results across devices later, replace the function bodies in `storage.js` with calls to a backend; nothing else needs to change.

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
- Animations are turned off for people who prefer reduced motion. There are no timers and no progress bars.

## Tests

`tests/e2e.py` drives the site with Playwright and system Chrome (start `python3 -m http.server 8765` in this folder first): logs in with both PINs, completes every game and the test, and checks the dashboard, CSV export, and clear.
