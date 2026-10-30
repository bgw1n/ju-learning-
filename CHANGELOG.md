# Changelog

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
