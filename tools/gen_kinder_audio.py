#!/usr/bin/env python3
"""Generate Dorian's kindergarten audio clips (letter sounds + three-letter words) with Piper TTS.

  python3 tools/gen_kinder_audio.py            # rebuild every clip from tools/kinder_audio_recipes.json (needs piper-tts, onnx, numpy, scipy; ffmpeg)
  python3 tools/gen_kinder_audio.py --search   # pick the best candidate for every clip again and rewrite the recipes
                                                #   (also needs torch, transformers, librosa, praat-parselmouth, phonemizer; downloads two small speech-recognition models)
  python3 tools/gen_kinder_audio.py --only m t cat     # rebuild only these clips (letters or words)

Voice: Piper en_US-kristin-medium (trained on LibriVox recordings, public domain). Model files go in --models (default /workspace/ju-audio/models):
  https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/kristin/medium  (en_US-kristin-medium.onnx and .onnx.json)

How the clips are made (see README, "Recorded sounds"):
  * Words: said inside a carrier sentence ("Say the word, cat.") and cut out after the pause, so the word has natural, clear speech around it.
  * Sounds: phoneme strings (IPA) go straight into the model, so nothing is ever read as a letter name. Sustained sounds (sss, mmm, nnn, lll, rrr),
    clipped stops (t, p, k, b, d) and short vowels use the "direct" method; f, h, g, j are cut from the start of a real word ("fun", "hat", "gum", "jam");
    v and z are the model's f and s noise with a voice buzz added (the model devoices them), see dsp_voiced().
  * Every random choice is seeded (the two RandomNormalLike nodes in the ONNX graph get a fixed seed), so the same recipe gives the same clip on the same machine.
Output: audio/kinder/sound-<letter>.mp3, audio/kinder/word-<word>.mp3, audio/kinder/manifest.json
"""
import argparse, json, os, subprocess, sys, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
VOICE = 'en_US-kristin-medium'
CARRIER_PREFIX = 'Say the word,'

# ---------------------------------------------------------------- what to make
def load_json(p):
    with open(p, encoding='utf-8') as f: return json.load(f)

def targets():
    letters = load_json(os.path.join(SITE, 'data/kinder/letters.json'))
    cvc = load_json(os.path.join(SITE, 'data/kinder/cvc.json'))
    return list(letters['letters'].keys()), [w['word'] for w in cvc['words']]

# default method per letter: (method, params)
SOUND_SPEC = {
    's': dict(method='direct', ph=['s', 'ː'], kind='cont', ls=2.2), 'm': dict(method='direct', ph=['m', 'ː'], kind='cont', ls=2.2),
    'n': dict(method='direct', ph=['n', 'ː'], kind='cont', ls=2.2), 'l': dict(method='direct', ph=['l', 'ː'], kind='cont', ls=2.2),
    'r': dict(method='direct', ph=['ɹ', 'ː'], kind='cont', ls=2.2, variants=[dict(), dict(ph=['ɹ'], ls=2.4), dict(ph=['ɹ', 'ɹ', 'ɹ'], ls=1.6), dict(ph=['ɚ', 'ː'], ls=2.0), dict(ph=['ɹ', 'ː', 'ː'], ls=1.8)]),
    'p': dict(method='direct', ph=['p', 'ʌ'], kind='ustop', ls=1.0), 't': dict(method='direct', ph=['t', 'ʌ'], kind='ustop', ls=1.0),
    'k': dict(method='direct', ph=['k', 'ʌ'], kind='ustop', ls=1.0), 'c': dict(method='direct', ph=['k', 'ʌ'], kind='ustop', ls=1.0),
    'b': dict(method='direct', ph=['b', 'ʌ'], kind='vstop', ls=1.0), 'd': dict(method='direct', ph=['d', 'ʌ'], kind='vstop', ls=1.0),
    'w': dict(method='direct', ph=['w', 'ʌ'], kind='glide', ls=1.2), 'y': dict(method='direct', ph=['j', 'ʌ'], kind='glide', ls=1.2),
    'x': dict(method='direct', ph=['k', 's'], kind='cs', ls=1.2), 'qu': dict(method='direct', ph=['k', 'w', 'ʌ'], kind='glide', ls=1.2),
    'a': dict(method='direct', ph=['a'], kind='vowel', ls=1.8), 'i': dict(method='direct', ph=['ɪ'], kind='vowel', ls=1.8),
    'u': dict(method='direct', ph=['ʌ'], kind='vowel', ls=1.8),
    # e and o: several ways of asking the model (with or without a leading h, other lengths); the formant check below picks the one that really is the vowel
    'e': dict(method='direct', ph=['e'], kind='vowel', ls=1.8, variants=[dict(pre=['h']), dict(pre=[]), dict(pre=['h'], ls=1.2), dict(pre=[], ls=1.2), dict(pre=['h'], ph=['ɛ']), dict(pre=[], ph=['ɛ'], ls=1.4)]),
    'o': dict(method='direct', ph=['ɑ'], kind='vowel', ls=1.2, variants=[dict(pre=['h'], ph=['ɒ']), dict(pre=[]), dict(pre=['h']), dict(pre=[], ph=['ɒ']), dict(pre=['h'], ph=['ɒ'], ls=1.8), dict(pre=[], ph=['ɑ'], ls=1.8)]),
    'f': dict(method='word_initial', words=['fun', 'fan', 'fig'], kind='fric', ls=1.8),
    'h': dict(method='word_initial', words=['hat', 'hug', 'hit'], kind='breath', ls=1.25),
    'g': dict(method='word_initial', words=['gum', 'got', 'gap'], kind='vstop', ls=1.25),
    'j': dict(method='word_initial', words=['jam', 'job', 'jug'], kind='affr', ls=1.25),
    'z': dict(method='dsp_voiced', source='s', kind='cont', variants=[dict(bar=0.9, depth=0.8), dict(bar=0.4, depth=0.8), dict(bar=0.15, depth=0.9), dict(bar=0.6, depth=0.6, f0=190), dict(bar=0.25, depth=0.7, f0=225), dict(bar=0.1, depth=0.5)]),
    'v': dict(method='dsp_voiced', source='f', kind='cont', variants=[dict(bar=0.9, depth=0.8), dict(bar=0.4, depth=0.8), dict(bar=0.15, depth=0.9), dict(bar=0.6, depth=0.6, f0=190), dict(bar=0.25, depth=0.7, f0=225), dict(bar=0.1, depth=0.5)]),
}
VOWEL_REF = {'a': (860, 2050), 'e': (610, 2330), 'i': (430, 2480), 'o': (850, 1220), 'u': (760, 1400)}   # Peterson & Barney (1952), adult female F1/F2 in Hz
EXPECT = {'s': {'s'}, 'f': {'f'}, 'z': {'z'}, 'v': {'v'}, 'm': {'m'}, 'n': {'n'}, 'l': {'l'}, 'r': {'ɹ', 'r'}, 'p': {'p', 'ph'}, 't': {'t', 'th'}, 'k': {'k', 'kh'}, 'c': {'k', 'kh'},
          'b': {'b'}, 'd': {'d'}, 'g': {'ɡ'}, 'h': {'h', 'ħ', 'x', 'ɦ'}, 'j': {'dʒ', 'tʃ', 'ʒ'}, 'w': {'w'}, 'y': {'j'}, 'x': {'k', 's'}, 'qu': {'k', 'w'},
          'a': {'a', 'æ'}, 'e': {'ɛ', 'e'}, 'i': {'ɪ', 'i'}, 'o': {'ɑ', 'ɒ', 'o'}, 'u': {'ʌ', 'ɐ', 'a'}}
SEARCH_SEEDS = 10

# ---------------------------------------------------------------- the voice (seeded)
_proto = {}
def voice(models, seed):
    import onnx, onnxruntime
    from onnx import helper
    from piper import PiperVoice
    from piper.config import PiperConfig
    from piper.patch_voice_with_alignment import add_alignment_output
    path = os.path.join(models, VOICE + '.onnx')
    if 'm' not in _proto:
        m = onnx.load(path); add_alignment_output(m); _proto['m'] = m
    m = _proto['m']
    k = 0
    for node in m.graph.node:
        if node.op_type == 'RandomNormalLike':
            for a in [a for a in node.attribute if a.name == 'seed']: node.attribute.remove(a)
            node.attribute.append(helper.make_attribute('seed', float(seed * 7 + k + 1))); k += 1
    cfg = load_json(path + '.json')
    so = onnxruntime.SessionOptions(); so.intra_op_num_threads = 2
    sess = onnxruntime.InferenceSession(m.SerializeToString(), sess_options=so, providers=['CPUExecutionProvider'])
    import piper.voice as pv
    return PiperVoice(config=PiperConfig.from_dict(cfg), session=sess, espeak_data_dir=pv.ESPEAK_DATA_DIR, download_dir=__import__('pathlib').Path('.'))

def _run(v, phs, ls, ns=0.667, nw=0.8):
    """Phoneme strings straight into the model. Returns (audio, sample rate, start sample of every phoneme id)."""
    from piper import SynthesisConfig
    ids = v.phonemes_to_ids(list(phs))
    a, samp = v.phoneme_ids_to_audio(ids, SynthesisConfig(length_scale=ls, noise_scale=ns, noise_w_scale=nw, normalize_audio=False), include_alignments=True)
    return a.astype(np.float32), v.config.sample_rate, np.concatenate([[0], np.cumsum(samp)])

def env_db(a, sr, hop=0.005):
    n = int(sr * hop); k = len(a) // n
    return 20 * np.log10(np.sqrt((a[:k * n].reshape(k, n) ** 2).mean(1) + 1e-12) + 1e-9), n

def band_env(a, sr, lo, hi, hop=0.004):
    from scipy.signal import butter, sosfiltfilt
    sos = butter(4, [lo / (sr / 2), min(hi, sr / 2 - 1) / (sr / 2)], btype='band', output='sos'); b = sosfiltfilt(sos, a)
    n = int(sr * hop); k = len(b) // n
    return 20 * np.log10(np.sqrt((b[:k * n].reshape(k, n) ** 2).mean(1)) + 1e-9), n

def first_activity(a, sr, after, thr=-50):
    e, n = env_db(a, sr); pk = e.max()
    return next(i for i in np.where(e > pk + thr)[0] if i * n >= after) * n, (np.where(e > pk + thr)[0][-1] + 1) * n

# carrier sentence: the prefix phonemes, a pause (comma), then the target
def carrier_phonemes(v, target):
    base = v.phonemize(CARRIER_PREFIX)[0]
    if base and base[-1] != ' ': base = base + [' ']
    return base, base + list(target) + ['.']

def render_carrier(v, target_ph, ls, thr=-45):
    """Say target phonemes after the carrier phrase; return (audio, sr, start, end) of the target. The model's alignment tells where the pause
    after the carrier begins; the target starts at the first sound after that."""
    base, full = carrier_phonemes(v, target_ph)
    a, sr, pos = _run(v, full, ls)
    gap_start = int(pos[2 * len(base)])               # id layout is [BOS, 0, p1, 0, p2, ...]; the last carrier phoneme is the space after the comma
    e, n = env_db(a, sr, 0.005); pk = e.max(); act = np.where(e > pk + thr)[0]
    start = next(i for i in act if i * n >= gap_start) * n
    return a, sr, start, (act[-1] + 1) * n

def render_word(v, word, ls):
    return render_carrier(v, v.phonemize(word)[0], ls)

# ---------------------------------------------------------------- clip shaping
def fade(a, sr, fin=0.01, fout=0.05):
    a = a.copy(); n1 = int(fin * sr); n2 = int(fout * sr)
    if n1: a[:n1] *= np.linspace(0, 1, n1)
    if n2: a[-n2:] *= np.linspace(1, 0, n2)
    return a

def shape(kind, c, sr, letter=None):
    e, n = env_db(c, sr); pk = e.max(); idx = np.where(e > pk - 38)[0]
    c = c[max(0, idx[0] * n - int(0.008 * sr)):]
    if kind == 'cont': return fade(c[:int(0.85 * sr)], sr, 0.02, 0.08)
    if kind == 'ustop': return fade(c[:int(0.10 * sr)], sr, 0.002, 0.03)
    if kind == 'vstop': return fade(c[:int(0.13 * sr)], sr, 0.002, 0.04)
    if kind == 'breath': return fade(c[:int(0.20 * sr)], sr, 0.01, 0.06)
    if kind == 'glide': return fade(c[:int(0.34 * sr if letter == 'qu' else 0.30 * sr)], sr, 0.005, 0.07)
    if kind == 'cs': return fade(c[:int(0.45 * sr)], sr, 0.003, 0.05)
    if kind == 'vowel': return fade(c[int(0.03 * sr):int(0.03 * sr) + int(0.55 * sr)], sr, 0.03, 0.12)
    if kind in ('fric', 'affr'): return fade(c, sr, 0.01, 0.05)
    raise ValueError(kind)

def vowel_onset(a, sr, start, thr=-12):
    e, n = band_env(a, sr, 250, 2500); i0 = start // n; pk = e[i0:].max()
    return next(i for i in range(i0, len(e)) if e[i] > pk + thr) * n

def extend_noise(c, sr, target=0.55, seed=1):
    """A voiceless fricative is noise, so it can be made longer without sounding odd: overlap-add pieces of the real cut at random places
    (square-root Hann windows keep the loudness steady). Used only when the word-initial cut is shorter than the target."""
    if len(c) >= target * sr: return c
    rng = np.random.default_rng(seed)
    body = c[int(0.01 * sr):len(c) - int(0.02 * sr)] if len(c) > 0.1 * sr else c
    W = min(len(body), int(0.12 * sr)); hop = W // 2; N = int(target * sr)
    win = np.sqrt(np.hanning(W)); out = np.zeros(N + W)
    for k in range(0, N, hop):
        st = rng.integers(0, max(1, len(body) - W + 1)); out[k:k + W] += body[st:st + W] * win
    out = out[:N]
    out *= np.sqrt(np.mean(body ** 2)) / (np.sqrt(np.mean(out ** 2)) + 1e-9)
    return fade(out.astype(np.float32), sr, 0.03, 0.08)

def dsp_voiced(src, sr, f0=205.0, seed=1, bar=0.9, depth=0.8, lp=380.0):
    """Voiced fricative from a voiceless one: the same noise, switched on and off at the voice pitch, plus a low voice buzz underneath."""
    from scipy.signal import butter, sosfiltfilt, lfilter
    rng = np.random.default_rng(seed)
    n = len(src); t = np.arange(n) / sr
    f = f0 * (1 + 0.012 * np.sin(2 * np.pi * 4.2 * t) + 0.004 * rng.standard_normal(n).cumsum() / np.sqrt(n))   # a little natural wobble
    ph = 2 * np.pi * np.cumsum(f) / sr
    glottal = np.maximum(0, np.sin(ph)) ** 1.5                       # one soft pulse per cycle
    mod = (1 - depth) + depth * glottal / glottal.max()
    pulses = (np.diff(np.floor(ph / (2 * np.pi)), prepend=0) > 0).astype(np.float64)
    sos = butter(4, lp / (sr / 2), output='sos'); buzz = sosfiltfilt(sos, lfilter([1, -0.97], [1], pulses))
    buzz = buzz / (np.abs(buzz).max() + 1e-9)
    rms = np.sqrt(np.mean(src ** 2))
    out = src * mod + bar * rms * 1.6 * buzz * np.hanning(n) ** 0.5
    return out.astype(np.float32)

# ---------------------------------------------------------------- the clips
def make_sound(models, letter, spec, seed, cache):
    spec = dict(spec)
    vs = spec.pop('variants', None)
    if vs: spec.update(vs[seed % len(vs)])
    m = spec['method']
    if m == 'direct':
        v = voice(models, seed)
        pre = spec.get('pre', [])
        a, sr, s, e = render_carrier(v, pre + spec['ph'], spec['ls'])
        c = a[s:e]
        if pre: c = c[int(0.11 * sr):]          # drop the h that was only there to start the vowel softly
        return shape(spec['kind'], c, sr, letter), sr, {}
    if m == 'word_initial':
        v = voice(models, seed)
        word = spec['words'][seed % len(spec['words'])]
        a, sr, s, e = render_word(v, word, spec['ls'])
        v0 = vowel_onset(a, sr, s)
        pre = int(0.01 * sr)
        if spec['kind'] in ('fric', 'breath'): c = a[max(0, s - pre):max(v0 - int(0.005 * sr), s + int(0.03 * sr))]
        elif spec['kind'] == 'affr': c = a[max(0, s - pre):v0 + int(0.05 * sr)]
        else: c = a[max(0, s - pre):v0 + int(0.045 * sr)]
        extra = {'word': word, 'full': a[max(0, s - int(0.02 * sr)):e + int(0.04 * sr)], 'raw': c}
        c = shape(spec['kind'], c, sr, letter)
        if letter == 'f': c = fade(extend_noise(c, sr, 0.55, seed), sr, 0.03, 0.08)
        return c, sr, extra
    if m == 'dsp_voiced':
        src, sr = cache[spec['source']]
        return fade(dsp_voiced(src, sr, seed=seed, f0=spec.get('f0', 205.0), bar=spec.get('bar', 0.9), depth=spec.get('depth', 0.8)), sr, 0.03, 0.08), sr, {}
    raise ValueError(m)

def make_word(models, word, ls, seed):
    v = voice(models, seed)
    a, sr, s, e = render_word(v, word, ls)
    c = a[max(0, s - int(0.02 * sr)):min(len(a), e + int(0.04 * sr))]
    return fade(c, sr, 0.008, 0.04), sr

def normalize(c, sr, target_rms_db=-20.0, peak_db=-1.5):
    e, n = env_db(c, sr, 0.01); act = e > e.max() - 30
    # RMS of the active part only
    k = len(c) // n
    frames = (c[:k * n].reshape(k, n) ** 2).mean(1)
    rms = np.sqrt(frames[act].mean()) if act.any() else np.sqrt(np.mean(c ** 2))
    g = min(10 ** (target_rms_db / 20) / (rms + 1e-9), 10 ** (peak_db / 20) / (np.abs(c).max() + 1e-9))
    return (c * g).astype(np.float32)

def write_wav(path, a, sr):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype('<i2').tobytes())

def to_mp3(wav, mp3):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '96k', mp3], check=True)

def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout
    return round(float(out.strip()), 3)

# ---------------------------------------------------------------- search (optional heavy dependencies)
class Judge:
    def __init__(self):
        import torch, librosa, parselmouth
        from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC, pipeline
        from huggingface_hub import hf_hub_download
        self.torch, self.librosa, self.pm = torch, librosa, parselmouth
        n = 'facebook/wav2vec2-lv-60-espeak-cv-ft'
        vocab = load_json(hf_hub_download(n, 'vocab.json')); self.inv = {v: k for k, v in vocab.items()}
        self.fe = Wav2Vec2FeatureExtractor.from_pretrained(n); self.ph = Wav2Vec2ForCTC.from_pretrained(n).eval()
        self.asr = {m: pipeline('automatic-speech-recognition', model=m) for m in ('openai/whisper-small.en', 'openai/whisper-base.en')}
    def _prep(self, a, sr, pad):
        a = self.librosa.resample(np.asarray(a, dtype=np.float32), orig_sr=sr, target_sr=16000)
        a = np.concatenate([np.zeros(int(pad * 16000), np.float32), a, np.zeros(int(pad * 16000), np.float32)])
        return a / (np.abs(a).max() + 1e-9) * 0.9
    def phonemes(self, a, sr):
        inp = self.fe(self._prep(a, sr, 0.25), sampling_rate=16000, return_tensors='pt')
        with self.torch.no_grad(): ids = self.torch.argmax(self.ph(inp.input_values).logits, -1)[0].tolist()
        out, prev = [], None
        for i in ids:
            if i != prev and self.inv[i] not in ('<pad>', '<s>', '</s>', '<unk>'): out.append(self.inv[i])
            prev = i
        return out
    def words(self, a, sr):
        x = self._prep(a, sr, 0.5); return {m: p({'raw': x, 'sampling_rate': 16000})['text'] for m, p in self.asr.items()}
    def formants(self, c, sr):
        s = self.pm.Sound(c.astype(np.float64), sr)
        f = s.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5500, window_length=0.03)
        t0 = len(c) / sr
        pts = [(f.get_value_at_time(1, t), f.get_value_at_time(2, t)) for t in np.arange(t0 * 0.15, t0 * 0.85, 0.01)]
        pts = [p for p in pts if p[0] == p[0] and p[1] == p[1]]
        if not pts: return None
        a1 = np.array([p[0] for p in pts]); a2 = np.array([p[1] for p in pts])
        return float(np.median(a1)), float(np.median(a2)), float(a1.std()), float(a2.std())
    def voicing(self, c, sr):
        p = self.pm.Sound(c.astype(np.float64), sr).to_pitch(time_step=0.01, pitch_floor=100, pitch_ceiling=500)
        return float((p.selected_array['frequency'] > 0).mean())
    def lowfrac(self, c, sr):
        x = np.abs(np.fft.rfft(c * np.hanning(len(c)))) ** 2; f = np.fft.rfftfreq(len(c), 1 / sr)
        return float(x[f < 500].sum() / x.sum())
    def centroid(self, c, sr):
        x = np.abs(np.fft.rfft(c * np.hanning(len(c)))) ** 2; f = np.fft.rfftfreq(len(c), 1 / sr)
        return float((f * x).sum() / x.sum())

def score_sound(J, letter, spec, c, sr, extra=None):
    """Higher is better. Returns (score, info). Objective checks only: a human ear must still confirm."""
    extra = extra or {}
    if 'raw' in extra: ph = J.phonemes(extra['raw'], sr)             # judge the real cut (before it is lengthened); pure noise is hard for the recognizer
    else: ph = J.phonemes(c, sr)
    exp = EXPECT[letter]; info = {'rec': ' '.join(ph)}
    need = [{'k'}, {'w'}] if letter == 'qu' else ([{'k'}, {'s'}] if letter == 'x' else [exp])
    hit = sum(1 for n in need if any(p in n for p in ph)); sc = 3.0 * hit / len(need)
    kind = spec['kind']
    if 'full' in extra:                                              # the word the cut came from must be understood
        import re
        txt = J.words(extra['full'], sr); info['word'] = {extra['word']: [t.strip() for t in txt.values()]}
        sc += 1.5 * sum(1 for t in txt.values() if re.sub(r'[^a-z]', '', t.lower()) == extra['word'])
    if kind == 'vowel':
        f = J.formants(c, sr)
        if not f: return -9, info
        d = float(np.hypot(np.log(f[0] / VOWEL_REF[letter][0]), np.log(f[1] / VOWEL_REF[letter][1])))
        info.update(F1=round(f[0]), F2=round(f[1]), dist=round(d, 3)); sc += 3.0 - 12 * d - 0.004 * (f[2] + f[3]) / 10
    elif letter in ('m', 'n', 'l', 'r'):
        v = J.voicing(c, sr); info['voicing'] = round(v, 2); sc += v
    elif letter in ('s',):
        cen = J.centroid(c, sr); info['centroid'] = round(cen); sc += 1.0 if cen > 6000 else -1.0
    elif letter in ('f', 'h'):
        v = J.voicing(c, sr); info['voicing'] = round(v, 2); sc += 1.0 if v < 0.3 else -1.0
    elif letter in ('z', 'v'):
        v = J.voicing(c, sr); lf = J.lowfrac(c, sr); info.update(voicing=round(v, 2), low=round(lf, 3)); sc += (1.0 if v > 0.7 else 0) + (1.0 if lf > 0.05 else 0)
    elif kind in ('ustop',):
        v = J.voicing(c, sr); info['voicing'] = round(v, 2); sc += 1.0 if v < 0.6 else -0.5
    return sc, info

VOWEL_SET = {'a': {'a', 'æ', 'aː'}, 'e': {'ɛ', 'e', 'eː'}, 'i': {'ɪ', 'i', 'ᵻ'}, 'o': {'ɑ', 'ɒ', 'o', 'ɔ', 'ɑː'}, 'u': {'ʌ', 'ɐ', 'a', 'ɑ', 'aː'}}
FINAL_SET = {'p': {'p', 'ph'}, 't': {'t', 'th'}, 'n': {'n'}, 'g': {'ɡ'}, 's': {'s'}, 'b': {'b'}, 'd': {'d'}, 'm': {'m'}}

def score_word(J, word, c, sr):
    """Both speech recognizers must hear the word; the phoneme recognizer should also hear the right vowel and last sound."""
    import re
    txt = J.words(c, sr); info = {'asr': txt}
    ok = sum(1 for t in txt.values() if re.sub(r'[^a-z]', '', t.lower()) == word)
    ph = J.phonemes(c, sr); info['rec'] = ' '.join(ph)
    sc = ok * 3.0
    if any(p in VOWEL_SET[word[1]] for p in ph): sc += 1.5
    if ph and ph[0] in EXPECT.get(word[0], {word[0]}): sc += 0.5
    if ph and ph[-1] in FINAL_SET.get(word[2], {word[2]}): sc += 0.5
    return sc, info

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', default='/workspace/ju-audio/models'); ap.add_argument('--out', default=os.path.join(SITE, 'audio/kinder'))
    ap.add_argument('--recipes', default=os.path.join(HERE, 'kinder_audio_recipes.json')); ap.add_argument('--work', default='/workspace/ju-audio/work')
    ap.add_argument('--search', action='store_true'); ap.add_argument('--only', nargs='*'); ap.add_argument('--seeds', type=int, default=SEARCH_SEEDS)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True); os.makedirs(args.work, exist_ok=True)
    letters, words = targets()
    recipes = load_json(args.recipes) if os.path.exists(args.recipes) else {'voice': VOICE, 'sounds': {}, 'words': {}}
    only = set(args.only or [])
    order = [l for l in letters if l not in ('z', 'v')] + [l for l in letters if l in ('z', 'v')]    # z and v are made from s and f
    J = Judge() if args.search else None
    cache, report = {}, {}
    for L in order:
        spec = dict(SOUND_SPEC[L])
        if args.search and (not only or L in only):
            best = None
            for seed in range(args.seeds):
                try: c, sr, extra = make_sound(args.models, L, spec, seed, cache)
                except Exception as ex: print('  skip', L, seed, ex); continue
                sc, info = score_sound(J, L, spec, normalize(c, sr), sr, extra)
                print(f'{L} seed {seed} score {sc:.2f} {info}', flush=True)
                if best is None or sc > best[0]: best = (sc, seed, info)
            recipes['sounds'][L] = dict(spec, seed=best[1], score=round(best[0], 2), check=best[2])
        r = recipes['sounds'].get(L)
        if not r: continue
        c, sr, _ = make_sound(args.models, L, r, r['seed'], cache); cache[L] = (c, sr)
        if not only or L in only: report[('sound', L)] = (c, sr)
    for W in words:
        if only and W not in only: continue
        ls = 1.25
        if args.search:
            best = None
            for seed in range(args.seeds):
                try: c, sr = make_word(args.models, W, ls, seed)
                except Exception as ex: print('  skip', W, seed, ex); continue
                sc, info = score_word(J, W, c, sr)
                print(f'{W} seed {seed} score {sc:.2f} {info}', flush=True)
                if best is None or sc > best[0]: best = (sc, seed, info)
            recipes['words'][W] = dict(ls=ls, seed=best[1], score=round(best[0], 2), check=best[2])
        r = recipes['words'].get(W)
        if not r: continue
        report[('word', W)] = make_word(args.models, W, r['ls'], r['seed'])
    if args.search:
        with open(args.recipes, 'w', encoding='utf-8') as f: json.dump(recipes, f, ensure_ascii=False, indent=1)
    manifest_path = os.path.join(args.out, 'manifest.json')
    manifest = load_json(manifest_path) if os.path.exists(manifest_path) else {}
    clips = manifest.get('clips', {})
    for (kind, name), (c, sr) in report.items():
        cid = f'{kind}-{name}'; c = normalize(c, sr)
        wav = os.path.join(args.work, cid + '.wav'); mp3 = os.path.join(args.out, cid + '.mp3')
        write_wav(wav, c, sr); to_mp3(wav, mp3)
        clips[cid] = {'file': cid + '.mp3', 'kind': kind, 'name': name, 'dur': duration(mp3), 'bytes': os.path.getsize(mp3)}
        print('wrote', cid, clips[cid]['dur'], 's', clips[cid]['bytes'], 'bytes')
    manifest = {'version': 1, 'voice': VOICE, 'license': 'Piper voice en_US-kristin-medium: public domain (LibriVox recordings). Generated with Piper TTS.',
                'clips': dict(sorted(clips.items()))}
    with open(manifest_path, 'w', encoding='utf-8') as f: json.dump(manifest, f, ensure_ascii=False, indent=1)
    print('total bytes', sum(c['bytes'] for c in clips.values()))

if __name__ == '__main__':
    main()
