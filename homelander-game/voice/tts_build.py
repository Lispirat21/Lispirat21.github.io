# Синтез озвучки всех реплик (RHVoice + обработка ffmpeg). Запуск: python3 voice/tts_build.py [id ...]
# Живые записи важнее синтеза: файлы с пометкой в voice/audio/.human не перезаписываются.
import json, os, re, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.join(HERE, 'audio'); os.makedirs(AUD, exist_ok=True)
HUMAN = set(open(os.path.join(AUD, '.human')).read().split()) if os.path.exists(os.path.join(AUD, '.human')) else set()

# голос, скорость %, высота %, сдвиг тона (rubberband), обработка
VOICES = {
    'hl':    dict(v='aleksandr-hq', rate=92,  pitch=96,  shift=0.94, fx='warm'),
    'but':   dict(v='yuriy',        rate=96,  pitch=88,  shift=0.90, fx='grit'),
    'sb':    dict(v='mikhail',      rate=88,  pitch=85,  shift=0.88, fx='old'),
    'ash':   dict(v='anna',         rate=118, pitch=106, shift=1.00, fx='clean'),
    'mv':    dict(v='tatiana',      rate=96,  pitch=94,  shift=0.97, fx='warm'),
    'at':    dict(v='artemiy',      rate=122, pitch=104, shift=1.02, fx='clean'),
    'hu':    dict(v='evgeniy-rus',  rate=110, pitch=108, shift=1.04, fx='clean'),
    'scam':  dict(v='yuriy',        rate=104, pitch=96,  shift=0.95, fx='phone'),
    'hj':    dict(v='vitaliy',      rate=112, pitch=100, shift=0.98, fx='clean'),
    'news':  dict(v='aleksandr',    rate=104, pitch=100, shift=1.00, fx='tv'),
    'kid':   dict(v='arina',        rate=96,  pitch=135, shift=1.25, fx='clean'),
    'sl':    dict(v='irina',        rate=104, pitch=104, shift=1.00, fx='clean'),
    'mil':   dict(v='pavel',        rate=106, pitch=92,  shift=0.95, fx='radio'),
    'fr':    dict(v='artemiy',      rate=104, pitch=96,  shift=0.97, fx='clean'),
    'mm':    dict(v='mikhail',      rate=96,  pitch=90,  shift=0.92, fx='clean'),
    'prot':  dict(v='vitaliy',      rate=112, pitch=106, shift=1.0,  fx='clean'),
    'rep':   dict(v='elena',        rate=104, pitch=100, shift=1.0,  fx='clean'),
}
CROWD = ['aleksandr', 'pavel', 'anna', 'mikhail', 'elena', 'vitaliy']
FX = {
    'clean': 'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80',
    'warm':  'highpass=f=60,equalizer=f=140:t=q:w=1:g=3,equalizer=f=3500:t=q:w=1:g=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=80',
    'grit':  'highpass=f=70,equalizer=f=220:t=q:w=1:g=4,volume=2.2,asoftclip=type=tanh,volume=0.55,lowpass=f=7500,acompressor=threshold=-18dB:ratio=3',
    'old':   'highpass=f=70,equalizer=f=180:t=q:w=1:g=4,volume=1.8,asoftclip=type=atan,volume=0.6,lowpass=f=6000,acompressor=threshold=-18dB:ratio=3',
    'phone': 'highpass=f=320,lowpass=f=3300,volume=1.6,asoftclip,acompressor=threshold=-20dB:ratio=4',
    'radio': 'highpass=f=450,lowpass=f=2800,volume=2.6,asoftclip=type=hard,volume=0.5,acompressor=threshold=-20dB:ratio=4',
    'tv':    'highpass=f=160,lowpass=f=7000,acompressor=threshold=-18dB:ratio=3',
}
REPL = [(r'\bVought\b', 'Воут'), (r'\bVNN\b', 'Ви-эн-эн'), (r'\bСМС\b', 'эс-эм-эс'), (r'4711', 'сорок семь одиннадцать'), (r'\bShift\b', 'шифт'),
        (r'Mon dieu', 'Мон дьё'), (r'Темп-V', 'Темп-Ви'), (r'\bV\b', 'Ви'), (r'Эй-Трейн', 'Эй Трейн'), (r'М\.М\.', 'Эм-Эм')]

def prep(text):
    t = re.sub(r'\*[^*]+\*', '', text)
    for a, b in REPL: t = re.sub(a, b, t)
    shout = bool(re.search(r'[А-ЯЁ]{3,}', t)) or t.count('!') >= 2
    t = re.sub(r'[А-ЯЁ]{2,}(?:-[А-ЯЁ]{2,})*', lambda m: m.group(0).lower(), t)   # капс — читаем как слово, а не по буквам
    t = t.replace('—', ',').replace('…', '... ').replace('«', '').replace('»', '')
    t = re.sub(r'\s+', ' ', t).strip(' ,.')
    if t and t[-1] not in '.!?': t += '.'
    return t, shout

def run(cmd, **kw): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)

def synth(text, voice, rate, pitch, vol, out):
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf8') as f: f.write(text); tp = f.name
    run(['RHVoice-test', '-p', voice, '-r', str(rate), '-t', str(pitch), '-v', str(vol), '-i', tp, '-o', out]); os.remove(tp)

def finish(raw, out, chain, shift=1.0, extra=''):
    flt = []
    if abs(shift - 1) > 0.005: flt.append(f'rubberband=pitch={shift}:formant=preserved')
    flt.append(chain)
    if extra: flt.append(extra)
    flt += ['silenceremove=start_periods=1:start_threshold=-48dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-48dB', 'areverse',  # тишину режем только по краям
            'apad=pad_dur=0.12', 'loudnorm=I=-16:TP=-1.5:LRA=9']
    run(['ffmpeg', '-y', '-i', raw, '-af', ','.join(flt), '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '4', out])

def build(line, tmp):
    lid, who = line['id'], line['who']
    out = os.path.join(AUD, lid + '.mp3')
    if lid in HUMAN: return 'human'
    text, shout = prep(line['say'])
    if who == 'crowd':  # толпа: несколько голосов вразнобой + зал
        parts = []
        for i, v in enumerate(CROWD):
            p = os.path.join(tmp, f'c{i}.wav'); synth(text, v, 108 + i * 3, 95 + (i % 3) * 6, 130, p); parts.append(p)
        mix = os.path.join(tmp, 'mix.wav')
        ins = sum([['-i', p] for p in parts], [])
        delays = ''.join(f'[{i}]adelay={i * 37}|{i * 37}[d{i}];' for i in range(len(parts)))
        run(['ffmpeg', '-y'] + ins + ['-filter_complex', delays + ''.join(f'[d{i}]' for i in range(len(parts))) + f'amix=inputs={len(parts)}:normalize=0,volume=0.5', mix])
        finish(mix, out, 'highpass=f=120,aecho=0.8:0.7:60|120:0.35|0.25,acompressor=threshold=-20dB:ratio=4')
        return 'ok'
    cfg = VOICES[who]
    raw = os.path.join(tmp, 'raw.wav')
    if lid == 'hl_040':  # рык Хоумлендера
        synth('ррр... а а а а а а а', cfg['v'], 70, 70, 140, raw)
        finish(raw, out, FX['grit'], 0.72, 'aecho=0.8:0.6:40|90:0.4|0.3,volume=1.4')
        return 'ok'
    rate, pitch, vol = cfg['rate'], cfg['pitch'], 100
    extra = ''
    if shout: rate += 10; pitch += 8; vol = 140; extra = 'volume=1.6,asoftclip'
    synth(text, cfg['v'], rate, pitch, vol, raw)
    finish(raw, out, FX[cfg['fx']], cfg['shift'], extra)
    return 'ok'

def main():
    lines = json.load(open(os.path.join(HERE, 'lines.json'), encoding='utf8'))
    only = set(sys.argv[1:])
    tmp = tempfile.mkdtemp()
    n = 0
    for l in lines:
        if only and l['id'] not in only and l['who'] not in only: continue
        try: r = build(l, tmp); n += 1; print(l['id'], r, flush=True)
        except subprocess.CalledProcessError as e: print(l['id'], 'ОШИБКА', e, flush=True)
    shutil.rmtree(tmp)
    print('готово:', n)

if __name__ == '__main__':
    main()
