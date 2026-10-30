#!/usr/bin/env python3
"""Generate Dorian's round 2 audio clips (sight words, their sentences, number words) with Piper TTS, into audio/round2/.

  python3 tools/gen_round2_audio.py                  # (re)build every clip from tools/round2_audio_recipes.json; clips with no recipe yet are searched first
  python3 tools/gen_round2_audio.py --search         # pick the best of several seeds for EVERY clip again
  python3 tools/gen_round2_audio.py --only sight-she num-7 sent-see-full     # only these clips

Run it with the same Python environment as gen_kinder_audio.py (piper-tts, onnx, numpy, scipy, ffmpeg; torch + transformers + librosa for the search).
The voice and its seeding are the same as for the letter sounds (see gen_kinder_audio.py): Piper en_US-kristin-medium (public domain), fixed seeds.

What is made (the list comes from the site's own data, so a new week only needs data/sight/week-*.json):
  sight-<word>      each focus word of every week in data/sight/weeks.json, said in the carrier "Say the word, ..." and cut out (like the 3-letter words)
  sent-<word>-full  that word's sentence; sent-<word>-pre and sent-<word>-post: the part before and after the word (the game plays pre, "blank", post)
  num-0 .. num-20, num-none   the number words (about 0.12 s of silence is added at the end so counting has a steady beat)
  misc-blank        the word "blank"
Every clip is checked by two speech recognizers when the search libraries are available (the text must come back exactly). Listening is still up to a person.
Output: audio/round2/<id>.mp3 and audio/round2/manifest.json (a clip that is not asked for any more is left alone)."""
import argparse, json, os, re, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gen_kinder_audio as g

NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
DIGITS = {str(i): w for i, w in enumerate(NUMBER_WORDS)}
SEEDS = 6
PAD_NUM = 0.12          # seconds of silence after a number word

def sight_weeks():
    idx = g.load_json(os.path.join(SITE, 'data/sight/weeks.json'))
    return [g.load_json(os.path.join(SITE, 'data/sight', w['file'])) for w in idx['weeks']]

def targets():
    """[(clip id, kind, spoken text, method)]"""
    out = []
    for wk in sight_weeks():
        for w in wk['words']:
            word = w['word']
            out.append(('sight-' + word.lower(), 'sight', word.lower(), 'word'))
            if w.get('sentence'):
                out.append(('sent-%s-full' % word.lower(), 'sentence', w['sentence'], 'sentence'))
                if w.get('pre'): out.append(('sent-%s-pre' % word.lower(), 'sentence', w['pre'], 'sentence'))
                if w.get('post'): out.append(('sent-%s-post' % word.lower(), 'sentence', w['post'], 'sentence'))
    out.append(('misc-blank', 'misc', 'blank', 'word'))
    for i, w in enumerate(NUMBER_WORDS): out.append(('num-%d' % i, 'number', w, 'word'))
    out.append(('num-none', 'number', 'none', 'word'))
    return out

def norm(t):
    t = re.sub(r'[^a-z0-9 ]', ' ', t.lower())
    return ' '.join(DIGITS.get(x, x) for x in t.split())

def make_sentence(models, text, ls, seed):
    v = g.voice(models, seed)
    ph = []
    for s in v.phonemize(text): ph += s
    a, sr, _ = g._run(v, ph, ls)
    e, n = g.env_db(a, sr, 0.005); act = np.where(e > e.max() - 42)[0]
    c = a[max(0, act[0] * n - int(0.03 * sr)):min(len(a), (act[-1] + 1) * n + int(0.08 * sr))]
    return g.fade(c, sr, 0.01, 0.05), sr

def make(models, cid, text, method, ls, seed):
    if method == 'sentence': return make_sentence(models, text, ls, seed)
    return g.make_word(models, text, ls, seed)

def score(J, text, c, sr):
    asr = J.words(c, sr); want = norm(text)
    ok = sum(1 for t in asr.values() if norm(t) == want)
    return ok, {m: t.strip() for m, t in asr.items()}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', default='/workspace/ju-audio/models'); ap.add_argument('--out', default=os.path.join(SITE, 'audio/round2'))
    ap.add_argument('--recipes', default=os.path.join(HERE, 'round2_audio_recipes.json')); ap.add_argument('--work', default='/workspace/ju-audio/work2')
    ap.add_argument('--search', action='store_true'); ap.add_argument('--only', nargs='*'); ap.add_argument('--seeds', type=int, default=SEEDS)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True); os.makedirs(a.work, exist_ok=True)
    rec = g.load_json(a.recipes) if os.path.exists(a.recipes) else {'voice': g.VOICE, 'clips': {}}
    only = set(a.only or [])
    todo = [t for t in targets() if not only or t[0] in only]
    need_search = [t for t in todo if a.search or t[0] not in rec['clips']]
    J = None
    if need_search:
        try: J = g.Judge()
        except Exception as ex: print('no speech recognizers (%s): seed 0 is used for new clips' % ex)
    for cid, kind, text, method in need_search:
        ls = 1.2 if method == 'sentence' else 1.25
        best = None
        for seed in range(a.seeds if J else 1):
            try: c, sr = make(a.models, cid, text, method, ls, seed)
            except Exception as ex: print('  skip', cid, seed, ex); continue
            sc, info = score(J, text, c, sr) if J else (0, {})
            print(f'{cid} seed {seed} ok {sc} {info}', flush=True)
            if best is None or sc > best[0]: best = (sc, seed, info)
            if sc == 2: break
        rec['clips'][cid] = {'text': text, 'ls': ls, 'seed': best[1], 'asr_ok': best[0], 'asr': best[2]}
    with open(a.recipes, 'w', encoding='utf-8') as f: json.dump(rec, f, ensure_ascii=False, indent=1)
    mp = os.path.join(a.out, 'manifest.json')
    clips = g.load_json(mp).get('clips', {}) if os.path.exists(mp) else {}
    for cid, kind, text, method in todo:
        r = rec['clips'][cid]
        c, sr = make(a.models, cid, text, method, r['ls'], r['seed']); c = g.normalize(c, sr)
        if kind == 'number': c = np.concatenate([c, np.zeros(int(PAD_NUM * sr), np.float32)])
        wav = os.path.join(a.work, cid + '.wav'); mp3 = os.path.join(a.out, cid + '.mp3')
        g.write_wav(wav, c, sr); g.to_mp3(wav, mp3)
        clips[cid] = {'file': cid + '.mp3', 'kind': kind, 'text': text, 'dur': g.duration(mp3), 'bytes': os.path.getsize(mp3)}
        print('wrote', cid, clips[cid]['dur'], 's', clips[cid]['bytes'], 'bytes')
    man = {'version': 1, 'voice': g.VOICE, 'license': 'Piper voice en_US-kristin-medium: public domain (LibriVox recordings). Generated with Piper TTS.', 'clips': dict(sorted(clips.items()))}
    with open(mp, 'w', encoding='utf-8') as f: json.dump(man, f, ensure_ascii=False, indent=1)
    print('clips', len(clips), 'total bytes', sum(c['bytes'] for c in clips.values()))

if __name__ == '__main__':
    main()
