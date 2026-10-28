#!/usr/bin/env python3
"""Build a folder (and zip) a grown-up can open to listen to every recorded sound and word: sound-test.html with play buttons, clips/ next to it.
   python3 tools/make_sound_samples.py [OUT_DIR]      (default /workspace/ju-learning-previews/v11/sound-samples)
Self-contained: relative paths only, no network. Also copies a few clips with plain names (m.mp3, t.mp3, cat.mp3 ...) to the top of the folder."""
import html, json, os, shutil, sys, zipfile
HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
out = sys.argv[1] if len(sys.argv) > 1 else '/workspace/ju-learning-previews/v11/sound-samples'
aud = os.path.join(SITE, 'audio/kinder')
man = json.load(open(os.path.join(aud, 'manifest.json'), encoding='utf-8'))
letters = json.load(open(os.path.join(SITE, 'data/kinder/letters.json'), encoding='utf-8'))
cvc = json.load(open(os.path.join(SITE, 'data/kinder/cvc.json'), encoding='utf-8'))
NOTES = {}
nf = os.path.join(HERE, 'kinder_audio_ear_notes.json')
if os.path.exists(nf): NOTES = json.load(open(nf, encoding='utf-8'))
shutil.rmtree(out, ignore_errors=True); os.makedirs(os.path.join(out, 'clips'))
for c in man['clips'].values(): shutil.copy(os.path.join(aud, c['file']), os.path.join(out, 'clips', c['file']))
for name in ['m', 's', 't', 'b', 'a', 'u']:
    shutil.copy(os.path.join(aud, f'sound-{name}.mp3'), os.path.join(out, f'{name}-sound.mp3'))
for w in ['cat', 'dog', 'pig']:
    shutil.copy(os.path.join(aud, f'word-{w}.mp3'), os.path.join(out, f'{w}-word.mp3'))
def rows(items):
    r = []
    for cid, label, extra, note in items:
        c = man['clips'][cid]
        r.append(f'<tr><td class="l">{html.escape(label)}</td><td>{html.escape(extra)}</td><td><button data-c="{cid}" data-r="1">&#9654; Play</button> <button data-c="{cid}" data-r="0.75">&#128034; Slower</button></td>'
                 f'<td>{c["dur"]:.2f}s</td><td class="n">{html.escape(note)}</td></tr>')
    return '\n'.join(r)
LH = {'s': 'sss', 'm': 'mmm'}
srows = rows([('sound-' + l, l, f'"{d["say"]}" (old computer-voice text) - e.g. {d["pics"][0]["word"]}', NOTES.get(l, '')) for l, d in letters['letters'].items()])
wrows = rows([('word-' + w['word'], w['word'], w['e'], NOTES.get(w['word'], '')) for w in cvc['words']])
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dorian's sounds - listening test</title>
<style>body{{font-family:system-ui,sans-serif;max-width:900px;margin:1.5rem auto;padding:0 1rem;color:#222}}h1{{font-size:1.5rem}}table{{border-collapse:collapse;width:100%;margin:.5rem 0 2rem}}
td,th{{border-bottom:1px solid #ddd;padding:.45rem .5rem;text-align:left;vertical-align:middle}}td.l{{font-size:1.6rem;font-weight:700;width:3.5rem}}td.n{{font-size:.85rem;color:#a55}}
button{{font-size:1rem;padding:.45rem .8rem;border-radius:.5rem;border:1px solid #888;background:#f4f4ff;cursor:pointer}}button:active{{background:#cde}}.big{{font-size:1.1rem;padding:.6rem 1rem}}.note{{background:#fff8e1;padding:.7rem 1rem;border-radius:.5rem}}</style></head><body>
<h1>Dorian's letter sounds and words - listening test</h1>
<p class="note">These are the recorded clips the site would play instead of the computer voice. Please listen and tell Grok Bot which ones sound wrong (for example "b sounds like d", "r is hard to hear", "the u sound is too long").
Stops (b, d, g, k, p, t) are kept very short on purpose, with as little "uh" as possible. The "Slower" button plays the same clip at 75% speed, like the turtle button on the site.</p>
<p><button class="big" id="all">&#9654; Play all letter sounds in a row</button> <button class="big" id="stop">Stop</button></p>
<h2>Letter sounds</h2><table><tr><th>Letter</th><th>Used for</th><th>Listen</th><th>Length</th><th>Needs an ear?</th></tr>
{srows}
</table>
<h2>Three-letter words (Build a word)</h2><table><tr><th>Word</th><th>Picture</th><th>Listen</th><th>Length</th><th>Needs an ear?</th></tr>
{wrows}
</table>
<p>Each button plays <code>clips/&lt;name&gt;.mp3</code> from this folder. Nothing is sent anywhere.</p>
<script>
let cur=null;
function play(id,rate){{ if(cur){{cur.pause();cur=null;}} const a=new Audio('clips/'+id+'.mp3'); a.playbackRate=rate; cur=a; a.play(); return new Promise(r=>{{a.onended=r;a.onerror=r;}}); }}
document.querySelectorAll('button[data-c]').forEach(b=>b.onclick=()=>play(b.dataset.c,parseFloat(b.dataset.r)));
let stopped=false;
document.getElementById('stop').onclick=()=>{{stopped=true;if(cur)cur.pause();}};
document.getElementById('all').onclick=async()=>{{stopped=false;for(const b of document.querySelectorAll('button[data-c^="sound-"][data-r="1"]')){{if(stopped)break;await play(b.dataset.c,1);await new Promise(r=>setTimeout(r,600));}}}};
</script></body></html>'''
open(os.path.join(out, 'sound-test.html'), 'w', encoding='utf-8').write(page)
z = out.rstrip('/') + '.zip'
if os.path.exists(z): os.remove(z)
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dp, _, fs in os.walk(out):
        for f in fs: zf.write(os.path.join(dp, f), os.path.join('sound-samples', os.path.relpath(os.path.join(dp, f), out)))
print('wrote', out, 'and', z)
