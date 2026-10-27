# Weekly Spelling Games

A small, plain HTML/CSS/JS website with weekly spelling games and an online spelling test for an elementary-school child, plus a grown-up page for proctoring tests and seeing where a child struggles over time.

It was built for a 3rd grader with focus and dyslexia needs, so the design is calm: a readable bundled font (Lexend), lowercase letters only, no timers, no progress bars, and sticker boxes as rewards. There is no build step, no framework, and no backend. The only requests the site makes are for its own files.

Spelling comes first. The code is laid out so a `math` section can be added later.

## Quick start

1. Fork or copy this repo and turn on GitHub Pages (Settings > Pages > Deploy from a branch > `main` / root). The `.nojekyll` file makes Pages serve the files as they are, and all links are relative, so it works at `https://<user>.github.io/<repo>/`.
2. Open `js/config.js` and set the child's name and the two PINs (see below).
3. Add your first week of words (see "Add a week").

To try it locally, run `python3 -m http.server` in the repo folder and open http://localhost:8000. The site loads JSON with `fetch`, so opening `index.html` straight from disk will not work.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Welcome screen with a PIN keypad (on-screen buttons or keyboard). |
| `child.html` | Games home: sticker boxes, the games, and the test. |
| `game.html?s=spelling&g=<id>` | Runs one game: `unscramble`, `hangman` (Grow the Flower), `match`, `listen`, `clap`, `review`, or `test`. |
| `parent.html` | Grown-up page: week-by-week trends, words that keep getting missed, scores, misspellings, practice list, proctor mode, hint log, voice settings, CSV export, and backup/restore. |

Every game covers all of the week's words in short rounds. Finishing a game earns its sticker for that week.

## Settings and PINs

Edit `js/config.js`:

```js
JU.config = {
  childName: 'Your Child',
  childPin: '0000',   // opens the games
  parentPin: '0000'   // opens the grown-up page
};
```

The PINs are a casual gate, not security. They are in the page source of a public site, so anyone who looks can read them. Do not protect anything sensitive with them. Choose your own PINs and do not reuse a PIN you use anywhere else. The logged-in role is kept in `sessionStorage`, so closing the tab logs out.

## Add a week

`add_week.py` writes one week's data from a clues JSON file and registers it in `data/weeks.json`:

```
python3 add_week.py 2026-11-02 word1 word2 ... word12 \
    --clues clues.json --subtitle "Curriculum name, Grade 3, Unit 2 Lesson 2"
```

- The first argument is the Monday date (`YYYY-MM-DD`). It creates `data/week-2026-11-02.json` and adds one line to `data/weeks.json`.
- Optional flags: `--title`, `--label "Week of Nov 2"`, `--site DIR`.
- Running it again for the same date replaces that week, never duplicates it. It refuses and changes nothing if a word has no clue or the syllables do not join back to the word.
- The child home shows a week picker once there is more than one week, and opens the newest week that has started.

The clues file maps each word to what the games need:

```json
{
  "clue":   { "total": "All of it added up" },
  "riddle": { "total": "Add everything up and you get the ___." },
  "syl":    { "total": "to-tal" },
  "sentence": { "total": "The total of two plus three is five." },
  "patterns": {},
  "syllable_colors": [],
  "bonus": ""
}
```

`clue`, `riddle`, and `syl` are required for every word. `sentence` is optional but recommended: it is read aloud in Listen and Type and in the Online Test, and should not start with the word. Without it the script uses a plain placeholder and warns you.

## Where results are saved

All reads and writes go through `js/storage.js`, one small module with async functions. Today it uses the browser's `localStorage`:

- `ju_results_v1` holds one record per word per game or test play.
- `ju_stickers_v1` holds stickers earned per week.
- `ju_hints_v1` holds the hint log.
- `ju_voice_v1` holds the voice settings (separate from scores).
- `ju_lastbackup_v1` holds the date of the last backup, for the reminder. It is not part of the backup file, and Clear results keeps it.

Results exist only in that browser on that device. They do not sync, and clearing site data erases them. On the grown-up page:

- **Save progress** downloads one JSON backup file with every result, sticker, and hint.
- **Load progress** merges such a file back in. Results already present are skipped, so loading the same file twice, or an older backup, never creates duplicates. A file that is not a backup is refused.
- **Export results (CSV)** is for spreadsheets, not for restoring.

Save a backup now and then, for example once a week. The site reminds you (see **Backup reminder** below). To share results across devices later, replace the function bodies in `storage.js` with calls to a backend; nothing else needs to change.

## Features

- **Grown-up page:** inline SVG trend charts (latest test score, different words missed, games finished) per week, a table behind them, words missed in two or more weeks, most-missed words with the last misspelling typed, a practice list, and a proctor mode for the Online Test.
- **Review game:** appears on the child home only when there are words missed in an earlier week. It replays the most-missed words using the Unscramble and Listen-and-Type mechanics, and a word fades out after two right answers in a row.
- **Earned hints:** in the puzzle games (Unscramble, Grow the Flower, Word Match, Clap the Beats) the spoken "Hear the word" hint is locked until the child has two real wrong answers on that word. Very fast or repeated wrong answers do not count, so the hint cannot be gamed. A grown-up can unlock one hint with the parent PIN, and there is a cap of three hints per game session. Words that needed a hint count as missed and stay in the practice list. Every hint is logged and shown on the grown-up page.
- **Voice:** "Hear the word" uses the browser's built-in text-to-speech. `js/speech.js` ranks the English voices on the device and prefers natural-sounding ones, speaking at 0.85x by default. The grown-up page has a voice picker, speed slider, and a Test voice button. If a device only has a basic robotic voice, the page shows a short tip for getting a better one.
- **Backup reminder:** when there are saved results and a school week has ended since the last backup (a week counts as over from Saturday), or the last backup is more than 7 days old, or no backup has ever been made, the grown-up page shows a calm banner, "Time to save a backup", with a **Save backup now** button (the same download as Save progress) and the date of the last backup. The banner hides once a backup is saved. The child home shows only a quiet line at the bottom, "Ask a grown-up to save progress", with no button. There are no timers, no network calls, and nothing is shown when there are no results. The browser requires a click to download a file, so the site can remind but cannot save a backup by itself.
- **Accessibility:** no timers, no progress bars, animations off for people who prefer reduced motion, and letter case never gives an answer away.

What counts as correct: Unscramble, Listen and Type, Word Match, and Clap the Beats count as correct when right on the first try. Grow the Flower counts as correct with two or fewer missed letters. The test counts one try per word.

## Adding math later

1. Add `{ id: 'math', title: 'Math', ... games: [...] }` to `js/subjects.js`.
2. Add `"subject": "math"` entries to `data/weeks.json` and the week files.
3. Write games in `js/math/*.js` with `JU.registerGame('math', { id, title, emoji, sticker, blurb, playWord(ctx, item) })` and load them in `child.html`, `game.html`, and `parent.html`.
4. Add a subject picker to `js/pages/child.js` (it currently uses the first subject).

## Repo layout

```
index.html child.html game.html parent.html   pages
css/style.css                                 styles
fonts/                                        bundled Lexend font
data/weeks.json, data/week-*.json             weekly word data
js/                                           config, auth, storage, backup, speech, hints, runner, ui, subjects, weeks
js/pages/                                     page scripts
js/spelling/                                  one file per game
add_week.py                                   adds a week from a clues file
make_update_zip.sh                            optional: zips changed files for manual upload
```

See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.
