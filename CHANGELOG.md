# Changelog

## Spelling week of Nov 16 (published 2026-11-13)
- Added spelling week of Nov 16: Unit 2 Lesson 3 compound words


## v16 (local, not published)
- **This week (Nov 9–13): they, you, do.** Sight words keeps every earlier week in review. The three new words are in Record sounds. There is no site clip for them yet, so the browser voice says them until a grown-up records them.
- **Rhyme.** Hear a word, tap the picture that rhymes. Level 1 is 3 pictures. Level 2 is 4 pictures, and a wrong one may start with the same sound.
- **Build a word, level 5: cot, cop, fog, fox.** c was already in cat, cap and can. x is new (fox). The same level adds an easy word switch: dog, then log, then fog, changing the first letter. Level 6 is harder: more families, sometimes the last letter, and 4 letter choices. Letter sounds and Build a word stay hidden until every letter sound is recorded.
- **Which has more? goes to 20,** with more, fewer, and equal (the same). The top level keeps the two groups only 1 apart. Bigger groups use ten frames so they fit on a phone.
- **Add it up** is still in his week (within 10, with pictures). Its new top level mixes adding within 10 and take-away within 5.
- **Take away,** a new game: pictures fly away, he counts what is left, within 5. The top level sometimes leaves none.
- **Shapes.** Level 1 sorts circle, square, triangle and rectangle. Level 2 matches a ball, a can, a box and a party hat to sphere, cylinder, cube and cone. Level 3 turns the flat shapes and sometimes shows the solid first.
- **Push or pull.** A drawn picture (door, wagon, swing, tug-of-war, cart, drawer) and two big buttons. Level 2 takes the arrow away.
- **Look and tap** top level: two words at once, such as "the big red one." **Count to 30** top level: a mixed review from 1 to 30. **Sight words** top level: every week mixed in. **Letter sounds** top level: 4 pictures.
- **Longer rounds, faster levels.** Every kindergarten round is 10 questions. The next level opens after **2 good rounds in a row** (80% or more right on the first try) **or 5 right answers in a row inside one round**, whichever comes first. Change those three numbers in `K.UNLOCK` at the top of `js/kinder/levels.js`. Counting, adding, comparing and take-away still never say the answer before he picks. Backup files stay at version 7. Older backups still load.

## v15.1 (local, not published)
- **Back up to Grok Bot:** address box stays (parents type it; this browser only; never in the repo or backup file). Relabelled "Email address of your Grok Bot inbox (where backups go)" with help text that it is not your own email. When `navigator.canShare({files})` works, Back up shares a **`.zip`** (JSON inside) with title/text `Family Learning backup <date>` and shows the saved address with Copy (share cannot set the recipient). Otherwise it downloads that `.zip` and opens a pre-filled mailto, with on-screen steps: 1 file saved as X in Downloads, 2 email opens, 3 attach that file, 4 press Send. Plain **Save progress** stays `.json`. **Load progress** accepts `.zip` or `.json`. Zip is built in the browser (`CompressionStream` deflate-raw when available, else store) with no CDN.
- **Ideas and changes** on the parent page: Dad/Mom/Other, a short note, Send opens mailto to the same saved Grok Bot address with subject `Family Learning idea: <first words>` (body includes who, parent page, site version v15.1). Share sheet offered when available. Nothing is sent automatically.
- Synced spelling menu label for Unit 2 Lesson 2 (`2026-11-02`) to **Nov 2–13** (same week id and words).

## Spelling label Nov 2–13 (published 2026-11-06)
- Menu label for Unit 2 Lesson 2 (id `2026-11-02`) changed from "Week of Nov 2" to "Nov 2–13" so the same word list covers the repeat week of Nov 9. Week id unchanged so saved scores stay. Words unchanged.

## v15 (local, not published)
- **New sight words for the week of Nov 2: are, that, of.** They are in Sight words with look-alike cards (are/at/am, that/the/at, of/it/is), short sentences ("We are big.", "I like that dog.", "I see a lot of cats."), 4 new Find it twice sentences, and Record sounds. Site clips are in the Piper kristin voice.
- **Build a word:** new words dot, mop, pot (with o) and bed, fed, red (a new level with e and f), with clips and pictures. dog was already there. Each round ends with one **"one or many?"** picture question (dog / dogs, bed / beds, ...).
- **New game: Which has more?** Two picture boxes, blue and orange. He taps to count each box, then taps the blue box, the orange box, or "the same" (a balance). Star levels: up to 5, then up to 10 with "which has fewer?", then up to 15. Nothing says or shows how many before he answers.
- **New game: Look and tap.** "Tap the big one", "Tap the little one", "One or many? Find: dogs." Level 2 adds colors ("Tap the red one"). These prompts use the browser voice.
- **Count: ten and some more.** At 11 to 20, some "how many" questions show a full ten frame plus a second frame with the rest. A right answer says "Ten and 2 more makes 12."
- **Warm-up letters are O, T or D** (still only once all the letter sounds are recorded).
- **Ready cue instead of "Listen first":** while the voice talks, the answer cards are dimmed with a small speaker (tap it to hear the question again). When the voice finishes, the cards light up with a little bounce, a soft chime and a "Go!" badge. Taps before that are ignored silently, and there is no countdown.

## v14 (local, not published)
- **Sight words are harder:** 4 word cards instead of 3, and the wrong cards look like the right word (me/my, it/is, at/am, see/she). Only Dorian's 16 confirmed words are used. New **Find it twice**: a picture and a short sentence read aloud; he taps the word every time it shows (each one found gets a check mark). Sentences are in `data/sight/twice.json`.
- **Count to 30:** two new levels (21-25, 26-30, with recorded number clips), pictures scattered instead of in rows, a check mark on each tapped picture. The total is still never said or shown before he answers.
- **Add it up within 10, with + and = signs** (the voice says "plus" and "equals" after he answers). The last two levels are **how many are left**: some pictures fly away, he counts the rest. No minus sign.
- **Slower pacing:** Sight words, counting and adding have 6 questions a round. **3 good rounds in a row** (at least 80% right first try) earn a **big star**, and a star opens the next level. A grown-up can open the next level on the parent page (Levels and stars). Tapping before the question has been said gently says "Listen first" and does not count.
- **Daily warm-up** (sun button, first on his home): 5 mixed questions (a letter sound once the letters are recorded, sight words, counting). It gets a check mark once done today and never counts toward a star.
- **Star path** on his home: one row per game, a star for each level passed, a glowing circle where he is (with dots for good rounds in a row), locks after.
- His saved progress keeps working: the first v14 visit to each game starts at the level the old rules had already opened. **Backup file version 7** adds his levels and stars; versions 1 to 6 still load and never lower a level.

## v13.3
- **Dorian's sight words: the 13 he already knows are in.** I, am, the, like, is, me, at, make, my, we, it, with, in (from his weekly planner) are a "Learned already" week before Oct 26, so they are asked and reviewed in Sight words alongside she, see, look (still this week's focus). "I" always shows as a capital. They came out of the unconfirmed wrong-choice list, which now only has to, a, have, he, for. Each has a site clip (the clips for "am" and "the" did not pass the speech check, so recording them yourself matters most).
- **Build a word: sat, mat, pat and sap** are new three-letter words (tap was already there), with site clips.
- **Record sounds** lists all 16 sight words and the 22 three-letter words (64 sounds in all). Recordings you already made keep working.
- **Count to 20 and Add it up: he counts, the game does not.** The question never says or shows how many ("Count the apples. How many in all?"). Each tap marks a picture with its number and the voice says the running count; tapping a marked picture takes it back out, and "Count again" starts over. Then he taps the number. A wrong number gently says "Let's count again" and clears the count; after two, the voice counts with him and says the answer. After a right answer the voice says the number ("Yes! Two and one more makes three."). Still no plus or equals signs.
- On a phone, four-letter sight words (make, with, like, look) now stay on one line on their cards.

## v13.2
- **Julianna opens the newest spelling week as soon as it is published.** New words go up on Friday and she starts them that evening, so the site no longer waits for the week's Monday. If she picks an older week in the menu, it stays picked until the next week is published, then she lands on the newest one again. Older weeks are still in the menu. Backup reminders are unchanged.

## v13.1
- **Fix: recording a word no longer loses your place.** On Record sounds, every Record, Stop or Save redrew the whole list, which closed the "three-letter words" and "sight words" groups again. The page shrank under you and the Stop button disappeared. Now the list is drawn once and only the row you tapped changes, the groups stay open, the page stays where it is, and the row being recorded keeps its Stop button on screen. It still stops by itself after 4 seconds.

## v13
- **Record sounds in your own voice.** On the grown-up page (Dorian view) a new **Record sounds** page lists the 26 letter sounds, the 18 three-letter words and the confirmed sight words, with Record, Redo, Play, Delete, Play all and progress for each group. Either grown-up can record.
- **What plays:** a grown-up's recording first, then the site's recorded clip, then the browser voice. "Slower" plays recordings at 0.75 speed.
- **Letter sounds and Build a word stay hidden** on Dorian's home until all 26 letter sounds are recorded (a grown-up can still preview them).
- Recordings stay in this browser only (IndexedDB), never on GitHub. **Backup file version 6** can include them; versions 1 to 5 still load, loading never duplicates, and a newer take replaces an older one.

## v12
- **Dorian's round 2: Sight words, Count to twenty and Add it up.** Three new picture buttons on his home page. Sight words use this week's words (she, see, look); the other words from the Savvas Unit 1 list are only ever wrong choices, never tested, until a grown-up confirms them with `add_sight_week.py`. Counting goes from 1 to 20 in three steps. Adding stays within 5 and uses the words "and" and "makes" (no + or = signs).
- **34 new recorded clips** in `audio/round2/` (the words, three short sentences, the numbers 0 to 20, "none" and "blank"), made with the same voice as v11.
- **Grown-up page:** sight word table, a 1 to 20 strip, the adding facts in words, Preview links and flags for the new games.
- **Money lessons 5 to 8** (Prices and trade-offs, Saving for a goal, Giving, Spending wisely): a family lesson plus Julianna's and Dorian's own follow-ons, each locked until the one before is finished. They use the family's real numbers: about 50 tokens a week (about $10), roughly 10 a day, 100 tokens for a treasure (about 2 weeks), and a special treat at 10 tokens. Dollar prices appear only as store examples. Lesson 7 (Giving) is a gentle idea for later with no family amount. There is no wait-a-day rule yet. Only the example weekly plan in Lesson 8 (30 for the treasure, 20 for treats) is a placeholder. All the numbers are in `data/money/family-numbers.json`; after changing one, run `python3 tools/build_money_unit2.py`.
- Backup files stay at version 5. Not checked by ear yet: listen to `sight-see` first.

## Spelling week of Nov 2
- Added a new spelling week (12 words, r-controlled vowel patterns or / ore-oar / ar) with `add_week.py`. No code changes.

## v11
- **Dorian's letter sounds and words are recordings now.** The browser voice read "mmm" as "em em em" and "tuh" as a word, so the 26 letter sounds and the 18 three-letter words are bundled audio clips in `audio/kinder/` (about 287 KB in all, no network needed beyond this site's own files). Made offline with Piper TTS, voice en_US-kristin-medium (public domain). Hear it again and the ear button play the clip, the turtle plays it at 75% speed, and Build a word's tiles and finished word play clips too. Instructions and sentences stay on the browser voice. If a clip is missing, fails to load or the browser blocks it, the browser voice says the fallback words instead.
- `make_update_zip.sh` now always includes `audio/`. The generator and a listening page builder are in `tools/`.
- Not checked by ear yet: every sound needs a listen, most of all v, z, g, h, e and o.

## v10
- **Phone layout (390px wide).** No page scrolls sideways any more: grid columns are `minmax(0, 1fr)`, the Back up to Grok Bot address box fits its row, the Family unlock table becomes one stacked block per lesson on a phone, the other wide tables scroll inside their own box, and Julianna's game cards are no longer cut off. Checked at 390x844 and 1280x800 on the main pages.
- **Laptop lessons:** after a tap question the explanation and the Next button are scrolled into view (smoothly, or instantly for reduced motion). Same for the children's follow-ons and Dorian's kindergarten games.
- **Dorian's pages speak what they show.** Wrong taps, explanations, counts, the Ask a grown-up note and finish messages are shown and spoken; the money intro speaks its title. The hint lock is a lock picture (says "Ask a grown-up for a hint."), an open hint is a light bulb, and the hear, slower and ask buttons are pictures. The voice says "A hint is ready. Tap the light bulb."
- **Replay is practice.** On Dorian's home a finished money game keeps its picture with a check mark and stays tappable. Replaying a finished activity (Dorian's or Julianna's) saves nothing new: no extra answers, hint log, finish time or sticker. Ask a grown-up still saves a flag.
- **Grown-up page:** a Jump to row under the profile switch (Julianna: Spelling, Money, Hints, Flags; Dorian: Kindergarten, Money, Flags; Family: Lessons, Flags). The "very quick or repeated wrong taps" note is calmer and shows only when one session had 3 or more.
- The backup email now says "The bot saves it. You do not need to wait for a reply." Backup file stays at version 5.

## v9
- **Dorian's kindergarten track, round 1.** Two games on his own login (`kinder.html?a=letters`, `?a=build`), voice-led, picture-first and tap-only, with a spoken start screen, Hear it again, a slower button and Ask a grown-up on every screen. No typing, timers, progress bars or scores on his screen; a wrong tap gets a gentle "Listen again" or "Let's try again".
- **Letter sounds:** the voice says a sound and he taps the picture (of three) that starts with it. Starts with s a t m p n; a letter is known after it was right on the first try in 3 sessions, and then the next letter of b d g h c k r f l j w v z x qu y e i o u joins (never more than 6 still learning). Letters he missed come back more often. Data: `data/kinder/letters.json`.
- **Build a word:** he hears a three-letter word, sees its picture and taps the sounds in order into three boxes; each tile says its sound and the whole word is spoken at the end. Picture words in three tiers (s a t m p n; then i c r; then o g d u b); a tier opens when 4 words of the one before are known. Data: `data/kinder/cvc.json`.
- Rounds of 4 to 6 items (a missed item comes back once, at most 2 comebacks) end with a picture sticker saved under Dorian's profile, and his home shows his stickers as pictures. Earned hints use the existing rules; Ask a grown-up reuses the money flags.
- Dorian's home has big picture buttons for both games (each says its name), and the "coming soon" text is gone.
- **Grown-up page:** a Kindergarten card on the Dorian view (sessions, rounds, letters known / still learning, words built, hints used, letter and word tables), preview links that save nothing, and **Clear kindergarten results** (his kindergarten data only). Flags list the kindergarten flags.
- **Backup file version 5** adds Dorian's kindergarten results; versions 1-4 still load, and merging never duplicates.

## v8
- **Money & Economics Unit 1, lessons 1-4, are playable.** Family lessons (`lesson.html?n=N`, Family login): a voiced story with pictures, two or three "what would you do?" taps with a reason after each tap, a calm Grown-up talk screen, and a **We finished!** button that marks the lesson complete (opening the next) and awards a Family sticker.
- **Hear it again** and **Ask a grown-up** on every screen. Ask saves a flag (profile, lesson, screen, time). The grown-up page lists flags for each profile, with **Clear flags**.
- **Solo follow-ons** (`solo.html?n=N`) from each child's own login, locked until the Family finishes that lesson, saved under the child's own profile and counted on the progress cards. Julianna's use the existing earned-hint rules. Dorian's are voice-led, picture-first and tap-only, with counts to 10 or 20.
- Lesson content lives in `data/money/lesson-N.json`, drawn by one shared renderer. `lessons.json` marks lessons 1-4 `ready`.
- **Backup file version 4** adds flags and money results. Version 1-3 files still load; merging never duplicates.
- Grown-up page wording uses the singular where it should ("1 sticker", "1 hint log entry", "1 game", "1 answer", "1 word"). The backup email now says "The bot saves it and lets the family know it arrived."

## v7
- One-click **Back up to Grok Bot** on the grown-up page replaces Backup by email. One click downloads the usual backup file (and records the last-backup date, like Save progress) and opens an email already filled in: a subject, short instructions to attach the file just downloaded (named exactly), and a plain-text summary of counts. The page cannot attach the file itself.
- The receiving address is typed once and kept only in that browser (`localStorage`); it is not in the repo, the site files, or the backup file. Shown as "Sending to: ..." with a Change address link; the button is disabled until a valid address is saved.
- The backup reminder banner mentions the new button. Save progress and Save backup now are plain downloads, as before.

## v6
- Second child and a family course. The landing page is now "Who's playing?" with three picture buttons (Julianna, Dorian, Family) and a small Grown-up entry, each with its own PIN (set them in `js/config.js`; they are a casual gate, not security).
- Roles `julianna`, `dorian`, `family` and `parent`; protected pages send anyone not logged in, or in the wrong role, back to the landing page.
- Each profile saves to its own browser storage keys. The first child's keys are unchanged, so existing data still loads.
- Backup file version 3 holds every profile. Version 1 and 2 files still load into the first child, and merging never duplicates.
- Placeholder home for the younger child (spoken greeting, tap only) and a Family "Money & Economics" page with 16 lessons from `data/money/lessons.json`, locked in order (a lesson opens when the one before it is marked complete). Lesson content is coming.
- Grown-up page: profile switch, lesson unlock panel, "Ask a grown-up" flags placeholders, and Backup by email (a `mailto:` summary, no attachment; the address stays in that browser only).
- Spelling games, hints, the test, review, and the backup reminder are unchanged.

## v5
- Backup reminder. The date of the last backup is remembered on the device (`ju_lastbackup_v1`, not part of the backup file).
- The grown-up page shows a "Time to save a backup" banner with a **Save backup now** button when there are saved results and a school week has ended since the last backup, the last backup is more than 7 days old, or no backup has been made yet. It shows the date of the last backup and hides once a backup is saved.
- The child home shows only a quiet line, "Ask a grown-up to save progress", with no button.
- Scoring, the backup file format, and the games are unchanged.

## v4
- Earned spoken hints in the puzzle games: locked until two real wrong answers on a word. Rapid or repeated wrong answers do not unlock, there is a cap of three hints per game session, and a parent PIN "Grown-up unlock" gives one extra hint.
- Hint log saved locally and included in backup and restore (backup file version 2; older backups still load).
- Hints section on the grown-up page.
- Words where a hint was used count as missed.
- Unscramble and Clap no longer say the word aloud when a word starts.

## v3
- Clearer, natural-sounding voice picked automatically, slower default speed.
- Voice picker, speed slider, and Test voice button on the grown-up page.
- "Slower" button on games that speak.
- The test reads the word, then the sentence, then the word again.

## v2
- Weekly flow: `add_week.py`, week picker, and a Review game for missed words.
- Week-by-week trend charts and a "words she keeps missing" list on the grown-up page.
- Backup and restore of progress.

## v1
- First version: spelling games, online test, PIN login, and grown-up dashboard.
