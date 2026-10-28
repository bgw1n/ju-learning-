# Changelog

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
