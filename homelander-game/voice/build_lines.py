# Собирает все реплики из кода игры и раскладывает их по персонажам для озвучки
import re, os, json, sys
# Запуск: python3 voice/build_lines.py (из папки homelander-game). Номера реплик постоянные: уже выданные id не меняются.
GAME = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__))); JS = os.path.join(GAME, 'js'); OUT = os.path.join(GAME, 'voice')
SPK = {'hl': 'Хоумлендер', 'ash': 'Эшли (Vought)', 'but': 'Бутчер', 'sb': 'Солдатик', 'sl': 'Старлайт', 'at': 'Эй-Трейн', 'hu': 'Хьюи',
       'ki': 'Кимико', 'fr': 'Френчи', 'mm': 'М.М.', 'noir': 'Чёрный Нуар', 'scam': 'Неизвестный номер (Бутчер по телефону)', 'news': 'Ведущий новостей',
       'ry': 'Райан', 'mil': 'Командир', 'mv': 'Королева Мейв', 'hj': 'Угонщик', 'prot': 'Протестующий', 'kid': 'Девочка', 'rep': 'Репортёр', 'crowd': 'Толпа'}
TONE = {
 'hl': 'Голос «идеального героя» с улыбкой, под которой холод и угроза. Говорит медленно и уверенно, на публику — тепло и пафосно, наедине — тихо и страшно. Срывы — в крик и рык.',
 'ash': 'Пиар-менеджер Vought: нервная, быстрая, всё время на грани паники, но пытается звучать бодро.',
 'but': 'Грубый, усталый, с хрипотцой и издёвкой. Любит слово «дорогуша». Ненависть сквозит в каждом слове.',
 'sb': 'Старый вояка: низкий, прокуренный, насмешливый голос. Говорит лениво, но с угрозой.',
 'sl': 'Молодая, искренняя, смелая, но в голосе слышен страх.',
 'at': 'Быстро, дерзко, с понтами; когда страшно — сразу сдувается и лепечет.',
 'hu': 'Нервный, мягкий, голос подрагивает; на Темп-V — пытается звучать смелее.',
 'ki': 'Кимико не говорит — для её строк достаточно дыхания и коротких звуков.',
 'fr': 'Француз: эмоционально, с акцентом, вставляет французские слова.',
 'mm': 'Спокойный, твёрдый командирский голос.',
 'scam': 'Это Бутчер, притворяющийся телефонным «продавцом»: сначала вежливо, потом прокалывается.',
 'news': 'Дикторский голос экстренных новостей.',
 'ry': 'Подросток 16 лет: неуверенный, ломающийся голос.',
 'mil': 'Военный по рации: сухо, коротко, с помехами (можно добавить эффект рации).',
 'mv': 'Сильная, уставшая, с достоинством; в бою — злая и насмешливая.',
 'hj': 'Нервный агрессивный угонщик, кричит.',
 'prot': 'Отчаянный протестующий, кричит из толпы.',
 'kid': 'Маленькая девочка, тихо и испуганно.',
 'rep': 'Репортёр.',
 'crowd': 'Толпа: можно записать несколько голосов вместе или наложить дорожки.',
}
ORDER = ['day1', 'fire', 'flight37', 'scam', 'race', 'raid', 'soldier', 'rally', 'maeve', 'trio', 'final', 'free']
FILE_MISSION = {'flight.js': 'flight37', 'rally.js': 'rally', 'maeve.js': 'maeve', 'trio.js': 'trio', 'finale.js': 'final'}
titles = {}
for f in os.listdir(JS):
    if f.endswith('.js') and f != 'three.min.js':
        for m in re.finditer(r"id: '([a-z0-9]+)', title: '([^']+)'", open(os.path.join(JS, f), encoding='utf8').read()): titles[m.group(1)] = m.group(2)
pat = re.compile(r"\[\s*'(" + '|'.join(SPK) + r")'\s*,\s*'((?:[^'\\]|\\.)*)'")
items = []
for f in sorted(os.listdir(JS)):
    if not f.endswith('.js') or f == 'three.min.js': continue
    src = open(os.path.join(JS, f), encoding='utf8').read()
    ids = [(m.start(), m.group(1)) for m in re.finditer(r"id: '([a-z0-9]+)'", src)]
    for m in pat.finditer(src):
        who, text = m.group(1), m.group(2).replace("\\'", "'")
        if f in FILE_MISSION: mis = FILE_MISSION[f]
        else:
            prev = [i for p, i in ids if p < m.start()]
            mis = prev[-1] if prev else 'final'
        items.append((ORDER.index(mis) if mis in ORDER else 99, f, m.start(), who, text, mis))
items.sort()
prev = {}
try:
    for l in json.load(open(os.path.join(OUT, 'lines.json'), encoding='utf8')): prev[(l['who'], l['say'])] = l['id']
except Exception: pass
used = {}
for (w, _), i in prev.items(): used[w] = max(used.get(w, 0), int(i.split('_')[-1]))
lines, seen, count = [], set(), {}
for _, f, pos, who, text, mis in items:
    notes = re.findall(r'\*([^*]+)\*', text)
    clean = re.sub(r'\*[^*]+\*', '', text).strip()
    if not clean or clean in ('…', '...'):  # чистая ремарка — не озвучивается
        continue
    key = (who, clean)
    if key in seen: continue
    seen.add(key)
    count[who] = count.get(who, 0) + 1
    if key in prev: lid = prev[key]
    else: used[who] = used.get(who, 0) + 1; lid = f"{who}_{used[who]:03d}"
    audio = os.path.exists(os.path.join(OUT, 'audio', lid + '.mp3'))
    lines.append({'id': lid, 'who': who, 'speaker': SPK[who], 'mission': titles.get(mis, mis), 'text': text, 'say': clean, 'note': '; '.join(n.strip() for n in notes), 'audio': audio})
json.dump(lines, open(os.path.join(OUT, 'lines.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
# по персонажу — отдельный файл
SD = os.path.join(OUT, 'scripts'); os.makedirs(SD, exist_ok=True)
for f in os.listdir(SD): os.remove(os.path.join(SD, f))
order = sorted(count, key=lambda w: -count[w])
for n, who in enumerate(order, 1):
    ls = [l for l in lines if l['who'] == who]
    out = [f"ОЗВУЧКА: {SPK[who].upper()}", f"Реплик: {len(ls)}", '', 'Как играть: ' + TONE.get(who, ''), '',
           'Каждую реплику — в отдельный файл с именем из строки «Файл». Формат: mp3, ogg или wav.', '=' * 60, '']
    cur = None
    for l in ls:
        if l['mission'] != cur: cur = l['mission']; out += ['', f'--- Миссия: {cur} ---', '']
        out.append(f"[{l['id']}]  Файл: {l['id']}.mp3")
        if l['note']: out.append(f"  Ремарка: ({l['note']})")
        out.append(f"  «{l['say']}»"); out.append('')
    fn = f"{n:02d}_{SPK[who].split(' (')[0].replace(' ', '_').replace('.', '')}.txt"
    open(os.path.join(SD, fn), 'w', encoding='utf8').write('\n'.join(out))
    print(fn, len(ls))
print('всего', len(lines), '· с записью:', sum(1 for l in lines if l['audio']))
