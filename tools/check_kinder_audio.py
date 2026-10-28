#!/usr/bin/env python3
"""Objective checks on audio/kinder/*.mp3 (no ears): length, loudness, clipping, and (with --asr) speech recognition of the words.
   python3 tools/check_kinder_audio.py [--asr]      --asr needs torch, transformers, librosa (uses /workspace/ju-audio/venv)"""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE); AUD = os.path.join(SITE, 'audio/kinder')
man = json.load(open(os.path.join(AUD, 'manifest.json')))
rows = []
for cid, c in man['clips'].items():
    p = os.path.join(AUD, c['file'])
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = float(re.search(r'mean_volume: (-?[\d.]+)', out).group(1)); peak = float(re.search(r'max_volume: (-?[\d.]+)', out).group(1))
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)
    rows.append((cid, round(dur, 3), mean, peak, os.path.getsize(p)))
print('%-12s %6s %8s %8s %7s' % ('clip', 'sec', 'mean dB', 'peak dB', 'bytes'))
for r in rows: print('%-12s %6.3f %8.1f %8.1f %7d' % r)
print('clips', len(rows), 'total bytes', sum(r[4] for r in rows), 'longest', max(r[1] for r in rows), 'shortest', min(r[1] for r in rows))
print('clipping (peak >= -0.3 dB):', [r[0] for r in rows if r[3] >= -0.3] or 'none')
print('peak range %.1f..%.1f dB, mean range %.1f..%.1f dB' % (min(r[3] for r in rows), max(r[3] for r in rows), min(r[2] for r in rows), max(r[2] for r in rows)))
print('quiet (mean < -30 dB):', [r[0] for r in rows if r[2] < -30] or 'none')
if '--asr' in sys.argv:
    sys.path.insert(0, HERE); import gen_kinder_audio as g, numpy as np, tempfile, wave
    J = g.Judge(); ok = 0; bad = []
    for cid, c in man['clips'].items():
        if c['kind'] != 'word': continue
        w = tempfile.mktemp(suffix='.wav'); subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(AUD, c['file']), '-ac', '1', w], check=True)
        with wave.open(w) as f: a = np.frombuffer(f.readframes(f.getnframes()), '<i2').astype(np.float32) / 32768; sr = f.getframerate()
        txt = J.words(a, sr); good = all(re.sub(r'[^a-z]', '', t.lower()) == c['name'] for t in txt.values())
        ok += good; print(cid, 'OK ' if good else 'DIFF', [t.strip() for t in txt.values()], ' '.join(J.phonemes(a, sr)))
        if not good: bad.append(cid)
    print('words understood by both recognizers: %d / 18' % ok, bad)
