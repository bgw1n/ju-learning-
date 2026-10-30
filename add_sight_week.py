#!/usr/bin/env python3
"""Add one week of sight words for Dorian (the Sight words game).

Usage:
  python3 add_sight_week.py WEEK_START word1 word2 word3 ... [--sentence word="A sentence with the word." ...] [--pic word=EMOJI ...]
                            [--wrong word=the,to,my ...] [--label "Week of Oct 30"] [--source "Savvas ..."] [--no-audio] [--site DIR]

WEEK_START  the Monday date, YYYY-MM-DD (it names the file: data/sight/week-YYYY-MM-DD.json). A word can also be written word=Sentence, like
            python3 add_sight_week.py 2026-11-02 can="I can run." go="We go home."
--sentence  a short sentence that uses the word (once, as a whole word). It is read aloud and used for "find the missing word".
--pic       one emoji that fits the sentence (for the missing-word question)
--wrong     2 or more words that do NOT fit in the gap of that sentence (default: the, to, my). They are the wrong cards for the missing-word question.
Writes data/sight/week-WEEK_START.json, adds or replaces one line in data/sight/weeks.json, takes the words out of data/sight/settings.json's
"distractors" (they are real words now), and (unless --no-audio) makes the recorded clips with tools/gen_round2_audio.py. Safe to run again:
the same week is replaced, never duplicated, and sentences, pictures and wrong words already in an existing week file are kept. Refuses a word that
is already in another week. Prints warnings for anything the game needs but is missing."""
import argparse, datetime, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_WRONG = ["the", "to", "my"]
VENV_PY = "/workspace/ju-audio/venv/bin/python"


def die(msg):
    sys.exit("add_sight_week.py: " + msg)


def kv(items, what):
    out = {}
    for it in items or []:
        if "=" not in it:
            die("%s must look like word=value, got %r" % (what, it))
        k, v = it.split("=", 1)
        out[k.strip().lower()] = v.strip()
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("week")
    ap.add_argument("words", nargs="+")
    ap.add_argument("--sentence", action="append")
    ap.add_argument("--pic", action="append")
    ap.add_argument("--wrong", action="append")
    ap.add_argument("--label")
    ap.add_argument("--source", default="Weekly sight words (from Dorian's teacher, through Son's Tutor Bot)")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--site", default=HERE, help="site folder (default: this script's folder)")
    a = ap.parse_args()

    try:
        d = datetime.date.fromisoformat(a.week)
    except ValueError:
        die("WEEK_START must look like 2026-11-02")
    warnings = []
    if d.weekday() != 0:
        warnings.append("%s is not a Monday (the existing weeks use the Monday date)" % a.week)

    sentences, pics, wrongs = kv(a.sentence, "--sentence"), kv(a.pic, "--pic"), kv(a.wrong, "--wrong")
    words = []
    for w in a.words:
        if "=" in w:
            w, s = w.split("=", 1)
            sentences[w.strip().lower()] = s.strip()
        w = w.strip().lower()
        if not re.fullmatch(r"[a-z]+", w):
            die("word %r must be letters only" % w)
        if w not in words:
            words.append(w)
    for k in list(sentences) + list(pics) + list(wrongs):
        if k not in words:
            die("%r is not one of the week's words" % k)

    sdir = os.path.join(a.site, "data", "sight")
    os.makedirs(sdir, exist_ok=True)
    idx_path = os.path.join(sdir, "weeks.json")
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {"weeks": []}
    for e in idx["weeks"]:
        if e["id"] == a.week:
            continue
        other = json.load(open(os.path.join(sdir, e["file"])))
        clash = [w for w in words if w in [x["word"].lower() for x in other["words"]]]
        if clash:
            die("%s is already in the week of %s" % (", ".join(clash), e["id"]))

    fname = "week-%s.json" % a.week
    path = os.path.join(sdir, fname)
    old = {}
    if os.path.exists(path):
        try:
            old = {x["word"]: x for x in json.load(open(path)).get("words", [])}
        except (ValueError, KeyError):
            old = {}

    out_words = []
    for w in words:
        o = old.get(w, {})
        s = sentences.get(w) or o.get("sentence", "")
        entry = {"word": w}
        if s:
            toks = re.findall(r"[A-Za-z']+", s)
            hits = [i for i, t in enumerate(toks) if t.lower() == w]
            if len(hits) != 1:
                die("the sentence for %r must use the word exactly once as a whole word: %r" % (w, s))
            if re.search(r"[^A-Za-z' .,!?]", s):
                die("the sentence for %r may only have letters, spaces and . , ! ? : %r" % (w, s))
            # split around the word: what is said before the gap and after it
            m = re.search(r"(?<![A-Za-z'])" + re.escape(w) + r"(?![A-Za-z'])", s, re.I)
            pre, post = s[:m.start()].strip(), s[m.end():].strip()
            post = re.sub(r"^[,]\s*", "", post)
            entry.update({"sentence": s, "pre": pre, "post": post})
            pic = pics.get(w) or o.get("pic")
            if not pic:
                warnings.append("no picture for %r (--pic %s=EMOJI): used a pencil" % (w, w))
                pic = "\u270f\ufe0f"
            entry["pic"] = pic
            wr = [x.strip().lower() for x in wrongs[w].split(",")] if w in wrongs else (o.get("wrong") or [x for x in DEFAULT_WRONG if x != w])
            wr = [x for x in wr if x and x != w]
            if len(wr) < 2:
                die("--wrong for %r needs 2 or more words that do not fit the gap" % w)
            entry["wrong"] = wr
            if w not in wrongs and not o.get("wrong"):
                warnings.append("wrong words for %r are the default %s: check that none of them fits in %r" % (w, "/".join(wr), s))
        else:
            warnings.append("no sentence for %r: it only gets the 'tap the word' question (add --sentence %s=\"...\" for the missing-word question)" % (w, w))
        out_words.append(entry)

    label = a.label or "Week of %s %d" % (d.strftime("%b"), d.day)
    week = {"id": a.week, "label": label, "source": a.source, "words": out_words}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(week, f, indent=1, ensure_ascii=False)
        f.write("\n")
    rest = [e for e in idx["weeks"] if e["id"] != a.week]
    idx["weeks"] = sorted(rest + [{"id": a.week, "label": label, "file": fname}], key=lambda e: e["id"])
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(idx, f, indent=1, ensure_ascii=False)
        f.write("\n")

    st_path = os.path.join(sdir, "settings.json")
    if os.path.exists(st_path):
        st = json.load(open(st_path))
        keep = [x for x in st.get("distractors", []) if x.lower() not in words]
        if len(keep) != len(st.get("distractors", [])):
            st["distractors"] = keep
            with open(st_path, "w", encoding="utf-8") as f:
                json.dump(st, f, indent=1, ensure_ascii=False)
                f.write("\n")
            print("took the new word(s) out of the wrong-choice list in data/sight/settings.json")

    for w in warnings:
        print("warning: " + w, file=sys.stderr)
    print("wrote %s (%d words) and updated %s" % (os.path.relpath(path, a.site), len(out_words), os.path.relpath(idx_path, a.site)))

    gen = os.path.join(a.site, "tools", "gen_round2_audio.py")
    if a.no_audio:
        print("audio skipped: run  %s %s  to make the clips" % (VENV_PY, os.path.relpath(gen, a.site)))
    elif os.path.exists(VENV_PY) and os.path.exists(gen):
        r = subprocess.run([VENV_PY, gen], cwd=a.site)
        if r.returncode:
            die("the audio step failed (the data files are written; run the audio step again)")
    else:
        print("audio: run  python3 tools/gen_round2_audio.py  in the audio environment (see the top of that file) to make the clips")


if __name__ == "__main__":
    main()
