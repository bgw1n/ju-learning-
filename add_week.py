#!/usr/bin/env python3
"""Add one week of spelling words to the site.

Usage:
  python3 add_week.py WEEK_START word1 word2 ... --clues clues.json --subtitle "Savvas ... Unit 2 Lesson 2"
                      [--title "Spelling Words"] [--label "Week of Nov 2"] [--site DIR]

WEEK_START   the Monday date, YYYY-MM-DD (also names the file: data/week-YYYY-MM-DD.json)
words        the week's words (lowercased automatically)
--clues      the SAME JSON as the worksheet builder (/workspace/spelling/week4_clues.json): keys
             clue, riddle, syl ("to-tal"), patterns, syllable_colors, bonus (others are ignored).
             Optional extra key for the games: "sentence": {"word": "A sentence that uses the word, not at the start."}
--subtitle   goes into the week's "source" line
Writes data/week-WEEK_START.json and adds/updates one line in data/weeks.json. Safe to run again:
the same week is replaced, never duplicated, and sentences already in an existing week file are kept
when the clues file has none. Prints warnings for anything the games need but are missing."""
import argparse, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_COLORS = ["#1663d6", "#e06c00"]


def die(msg):
    sys.exit("add_week.py: " + msg)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("week")
    ap.add_argument("words", nargs="+")
    ap.add_argument("--clues", required=True)
    ap.add_argument("--subtitle", required=True)
    ap.add_argument("--title", default="Spelling Words")
    ap.add_argument("--label")
    ap.add_argument("--site", default=HERE, help="site folder (default: this script's folder)")
    a = ap.parse_args()

    try:
        d = datetime.date.fromisoformat(a.week)
    except ValueError:
        die("WEEK_START must look like 2026-11-02")
    warnings = []
    if d.weekday() != 0:
        warnings.append("%s is not a Monday (the existing weeks use the Monday date)" % a.week)

    clues = json.load(open(a.clues))
    words = []
    for w in a.words:
        w = w.strip().lower()
        if not re.fullmatch(r"[a-z]+", w):
            die("word %r must be letters only" % w)
        if w not in words:
            words.append(w)

    data_dir = os.path.join(a.site, "data")
    os.makedirs(data_dir, exist_ok=True)
    fname = "week-%s.json" % a.week
    path = os.path.join(data_dir, fname)
    old = {}
    if os.path.exists(path):
        try:
            old = {x["word"]: x for x in json.load(open(path)).get("words", [])}
        except (ValueError, KeyError):
            old = {}

    def pick(key):
        return {k.lower(): v for k, v in clues.get(key, {}).items()}
    clue, riddle, syl, sent = pick("clue"), pick("riddle"), pick("syl"), pick("sentence")

    out_words = []
    for w in words:
        if w not in clue:
            die("no clue for %r in %s" % (w, a.clues))
        parts = syl.get(w, w).split("-")
        if "".join(parts) != w:
            die("syllables %r do not join back to %r" % (syl.get(w), w))
        s = sent.get(w) or old.get(w, {}).get("sentence")
        if s and (w not in re.findall(r"[a-z]+", s.lower())):
            die("sentence for %r must contain the word: %r" % (w, s))
        if s and re.match(r"\s*" + re.escape(w) + r"\b", s, re.I):
            warnings.append("sentence for %r starts with the word (a capital letter would give it away): %r" % (w, s))
        if not s:
            s = "Can you spell the word %s?" % w
            warnings.append("no sentence for %r: used a plain placeholder. Add a \"sentence\" key to the clues file." % w)
        if w not in riddle:
            warnings.append("no riddle for %r" % w)
        out_words.append({"word": w, "clue": clue[w], "riddle": riddle.get(w, ""), "sentence": s, "syllables": parts})

    label = a.label or "Week of %s %d" % (d.strftime("%b"), d.day)
    colors = clues.get("syllable_colors") or ([] if clues.get("patterns") else DEFAULT_COLORS)
    week = {
        "id": a.week, "subject": "spelling", "title": a.title, "label": label, "source": a.subtitle,
        "syllableColors": colors, "patterns": clues.get("patterns", []),
        "bonus": clues.get("bonus", ""), "words": out_words,
    }
    with open(path, "w") as f:
        json.dump(week, f, indent=1)
        f.write("\n")

    idx_path = os.path.join(data_dir, "weeks.json")
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {"weeks": []}
    entry = {"id": a.week, "subject": "spelling", "label": label, "file": fname}
    rest = [e for e in idx["weeks"] if not (e.get("id") == a.week and e.get("subject") == "spelling")]
    idx["weeks"] = sorted(rest + [entry], key=lambda e: (e.get("subject", ""), e["id"]))
    with open(idx_path, "w") as f:
        json.dump(idx, f, indent=1)
        f.write("\n")

    for w in warnings:
        print("warning: " + w, file=sys.stderr)
    print("wrote %s (%d words) and updated %s" % (os.path.relpath(path, a.site), len(out_words), os.path.relpath(idx_path, a.site)))


if __name__ == "__main__":
    main()
