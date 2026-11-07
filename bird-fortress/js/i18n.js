'use strict';
// ============ Языки: интерфейс, сообщения и движок перевода ============
// Порядок: en, ru, es, pt, fr, de, zh, ja, hi, ar
const LANGS = [
  { id: 'en', name: 'English',   flag: '🇬🇧' },
  { id: 'ru', name: 'Русский',   flag: '🇷🇺' },
  { id: 'es', name: 'Español',   flag: '🇪🇸' },
  { id: 'pt', name: 'Português', flag: '🇧🇷' },
  { id: 'fr', name: 'Français',  flag: '🇫🇷' },
  { id: 'de', name: 'Deutsch',   flag: '🇩🇪' },
  { id: 'zh', name: '中文',       flag: '🇨🇳' },
  { id: 'ja', name: '日本語',     flag: '🇯🇵' },
  { id: 'hi', name: 'हिन्दी',      flag: '🇮🇳' },
  { id: 'ar', name: 'العربية',    flag: '🇸🇦' },
];
const TR_UI = {
  // ----- название и главное меню -----
  title:     ["Bird Wars", "Птичьи Войны", "Guerra de Aves", "Guerra dos Pássaros", "La Guerre des Oiseaux", "Vogelkriege", "鸟之战争", "バードウォーズ", "पक्षी युद्ध", "حرب الطيور"],
  title_html:["Bird<br>Wars", "Птичьи<br>Войны", "Guerra<br>de Aves", "Guerra dos<br>Pássaros", "La Guerre<br>des Oiseaux", "Vogel<br>kriege", "鸟之<br>战争", "バード<br>ウォーズ", "पक्षी<br>युद्ध", "حرب<br>الطيور"],
  subtitle:  ["Build a fortress and protect the birds from beasts!", "Построй крепость и защити птиц от зверей!", "¡Construye una fortaleza y protege a las aves!", "Construa uma fortaleza e proteja os pássaros!", "Bâtis une forteresse et protège les oiseaux !", "Baue eine Festung und schütze die Vögel!", "建造堡垒，保护鸟儿免受野兽侵害！", "砦を築き、鳥たちを獣から守れ！", "क़िला बनाओ और पक्षियों को जानवरों से बचाओ!", "ابنِ حصنًا واحمِ الطيور من الوحوش!"],
  loading:   ["Loading…", "Загрузка…", "Cargando…", "Carregando…", "Chargement…", "Lädt…", "加载中…", "読み込み中…", "लोड हो रहा है…", "جارٍ التحميل…"],
  load_trees:["Planting trees…", "Сажаем деревья…", "Plantando árboles…", "Plantando árvores…", "On plante les arbres…", "Bäume werden gepflanzt…", "正在种树…", "木を植えています…", "पेड़ लगाए जा रहे हैं…", "نزرع الأشجار…"],
  load_birds:["The birds are arriving…", "Птицы прилетают…", "Llegan las aves…", "Os pássaros estão chegando…", "Les oiseaux arrivent…", "Die Vögel kommen…", "鸟儿飞来了…", "鳥たちがやってくる…", "पक्षी आ रहे हैं…", "الطيور تصل…"],
  load_done: ["Ready!", "Готово!", "¡Listo!", "Pronto!", "Prêt !", "Fertig!", "准备就绪！", "準備完了！", "तैयार!", "جاهز!"],
  load_world:["Loading the world…", "Загружаем мир…", "Cargando el mundo…", "Carregando o mundo…", "Chargement du monde…", "Welt wird geladen…", "正在加载世界…", "世界を読み込み中…", "दुनिया लोड हो रही है…", "تحميل العالم…"],
  load_gen:  ["Creating the world “{name}”…", "Создаём мир «{name}»…", "Creando el mundo «{name}»…", "Criando o mundo «{name}»…", "Création du monde « {name} »…", "Erschaffe die Welt „{name}“…", "正在创建世界“{name}”…", "世界「{name}」を作成中…", "दुनिया “{name}” बन रही है…", "إنشاء العالم «{name}»…"],
  webgl_err: ["WebGL failed to start: ", "Ошибка запуска WebGL: ", "Error al iniciar WebGL: ", "Erro ao iniciar WebGL: ", "Échec du démarrage WebGL : ", "WebGL-Startfehler: ", "WebGL启动失败：", "WebGLの起動に失敗：", "WebGL शुरू नहीं हुआ: ", "فشل تشغيل WebGL: "],
  play:      ["▶ PLAY", "▶ ИГРАТЬ", "▶ JUGAR", "▶ JOGAR", "▶ JOUER", "▶ SPIELEN", "▶ 开始", "▶ プレイ", "▶ खेलें", "▶ العب"],
  settings_b:["⚙ SETTINGS", "⚙ НАСТРОЙКИ", "⚙ AJUSTES", "⚙ CONFIGURAÇÕES", "⚙ RÉGLAGES", "⚙ EINSTELLUNGEN", "⚙ 设置", "⚙ 設定", "⚙ सेटिंग्स", "⚙ الإعدادات"],
  exit:      ["✖ EXIT GAME", "✖ ВЫЙТИ ИЗ ИГРЫ", "✖ SALIR", "✖ SAIR", "✖ QUITTER", "✖ BEENDEN", "✖ 退出游戏", "✖ ゲーム終了", "✖ खेल से बाहर", "✖ خروج"],
  newgame:   ["🌱 NEW GAME", "🌱 НОВАЯ ИГРА", "🌱 NUEVA PARTIDA", "🌱 NOVO JOGO", "🌱 NOUVELLE PARTIE", "🌱 NEUES SPIEL", "🌱 新游戏", "🌱 ニューゲーム", "🌱 नया खेल", "🌱 لعبة جديدة"],
  newgame_confirm: ["⚠️ AGAIN — START OVER<small>your current save will be replaced</small>", "⚠️ ЕЩЁ РАЗ — НАЧАТЬ ЗАНОВО<small>текущее сохранение будет заменено</small>", "⚠️ OTRA VEZ — EMPEZAR<small>se reemplazará tu partida</small>", "⚠️ DE NOVO — RECOMEÇAR<small>o save atual será substituído</small>", "⚠️ ENCORE — RECOMMENCER<small>la sauvegarde sera remplacée</small>", "⚠️ NOCHMAL — NEU STARTEN<small>Spielstand wird ersetzt</small>", "⚠️ 再点一次重新开始<small>当前存档将被覆盖</small>", "⚠️ もう一度で最初から<small>現在のセーブは上書きされます</small>", "⚠️ फिर दबाएँ — नया शुरू<small>मौजूदा सेव बदल जाएगा</small>", "⚠️ مرة أخرى للبدء من جديد<small>سيُستبدل الحفظ الحالي</small>"],
  continue:  ["💾 CONTINUE", "💾 ПРОДОЛЖИТЬ", "💾 CONTINUAR", "💾 CONTINUAR", "💾 CONTINUER", "💾 FORTSETZEN", "💾 继续", "💾 つづきから", "💾 जारी रखें", "💾 متابعة"],
  back:      ["◀ BACK", "◀ НАЗАД", "◀ ATRÁS", "◀ VOLTAR", "◀ RETOUR", "◀ ZURÜCK", "◀ 返回", "◀ もどる", "◀ वापस", "◀ رجوع"],
  no_save:   ["no save", "нет сохранения", "sin partida", "sem save", "aucune sauvegarde", "kein Spielstand", "无存档", "セーブなし", "कोई सेव नहीं", "لا يوجد حفظ"],
  save_info: ["{hero} · {diff} · wave {wave}", "{hero} · {diff} · волна {wave}", "{hero} · {diff} · oleada {wave}", "{hero} · {diff} · onda {wave}", "{hero} · {diff} · vague {wave}", "{hero} · {diff} · Welle {wave}", "{hero} · {diff} · 第{wave}波", "{hero} · {diff} · ウェーブ{wave}", "{hero} · {diff} · लहर {wave}", "{hero} · {diff} · الموجة {wave}"],
  ver:       ["v1.1 · controls: sticks on phone or WASD + mouse", "v1.1 · управление: стики на телефоне или WASD + мышь", "v1.1 · controles: sticks en móvil o WASD + ratón", "v1.1 · controles: sticks no celular ou WASD + mouse", "v1.1 · contrôles : sticks sur mobile ou WASD + souris", "v1.1 · Steuerung: Sticks am Handy oder WASD + Maus", "v1.1 · 操作：手机摇杆或 WASD + 鼠标", "v1.1 · 操作：スマホはスティック、PCはWASD+マウス", "v1.1 · नियंत्रण: फ़ोन पर स्टिक या WASD + माउस", "v1.1 · التحكم: عصي على الهاتف أو WASD + الفأرة"],
  lang_pick: ["🌍 Choose your language", "🌍 Выберите язык", "🌍 Elige tu idioma", "🌍 Escolha seu idioma", "🌍 Choisissez votre langue", "🌍 Sprache wählen", "🌍 选择语言", "🌍 言語を選択", "🌍 भाषा चुनें", "🌍 اختر لغتك"],

  // ----- настройки -----
  s_title:   ["⚙ Settings", "⚙ Настройки", "⚙ Ajustes", "⚙ Configurações", "⚙ Réglages", "⚙ Einstellungen", "⚙ 设置", "⚙ 設定", "⚙ सेटिंग्स", "⚙ الإعدادات"],
  s_lang:    ["Language", "Язык", "Idioma", "Idioma", "Langue", "Sprache", "语言", "言語", "भाषा", "اللغة"],
  s_graphics:["Graphics", "Графика", "Gráficos", "Gráficos", "Graphismes", "Grafik", "画质", "グラフィック", "ग्राफ़िक्स", "الرسومات"],
  q_low:     ["Low", "Низкая", "Baja", "Baixa", "Basse", "Niedrig", "低", "低", "कम", "منخفضة"],
  q_medium:  ["Medium", "Средняя", "Media", "Média", "Moyenne", "Mittel", "中", "中", "मध्यम", "متوسطة"],
  q_high:    ["High", "Высокая", "Alta", "Alta", "Haute", "Hoch", "高", "高", "उच्च", "عالية"],
  q_ultra:   ["Ultra", "Ультра", "Ultra", "Ultra", "Ultra", "Ultra", "极高", "ウルトラ", "अल्ट्रा", "فائقة"],
  s_res:     ["Resolution", "Разрешение", "Resolución", "Resolução", "Résolution", "Auflösung", "分辨率", "解像度", "रिज़ॉल्यूशन", "الدقة"],
  res_auto:  ["Auto (screen)", "Авто (экран)", "Auto (pantalla)", "Auto (tela)", "Auto (écran)", "Auto (Bildschirm)", "自动（屏幕）", "自動（画面）", "ऑटो (स्क्रीन)", "تلقائي (الشاشة)"],
  s_view:    ["Camera view", "Вид камеры", "Vista de cámara", "Visão da câmera", "Vue caméra", "Kameraansicht", "视角", "カメラ視点", "कैमरा दृश्य", "منظور الكاميرا"],
  view_third:["🎥 3rd person", "🎥 От 3-го лица", "🎥 3.ª persona", "🎥 3ª pessoa", "🎥 3e personne", "🎥 3. Person", "🎥 第三人称", "🎥 三人称", "🎥 तीसरा व्यक्ति", "🎥 الشخص الثالث"],
  view_first:["👁 1st person", "👁 От 1-го лица", "👁 1.ª persona", "👁 1ª pessoa", "👁 1re personne", "👁 1. Person", "👁 第一人称", "👁 一人称", "👁 पहला व्यक्ति", "👁 الشخص الأول"],
  s_ui:      ["Interface size", "Размер интерфейса", "Tamaño de interfaz", "Tamanho da interface", "Taille de l'interface", "UI-Größe", "界面大小", "UIサイズ", "इंटरफ़ेस आकार", "حجم الواجهة"],
  s_music:   ["Music", "Музыка", "Música", "Música", "Musique", "Musik", "音乐", "音楽", "संगीत", "الموسيقى"],
  s_musicVol:["Music volume", "Громкость музыки", "Volumen de música", "Volume da música", "Volume musique", "Musiklautstärke", "音乐音量", "音楽の音量", "संगीत की आवाज़", "مستوى الموسيقى"],
  s_sfx:     ["Sounds", "Звуки", "Sonidos", "Sons", "Sons", "Geräusche", "音效", "効果音", "ध्वनियाँ", "الأصوات"],
  s_sfxVol:  ["Sound volume", "Громкость звуков", "Volumen de sonidos", "Volume dos sons", "Volume des sons", "Effektlautstärke", "音效音量", "効果音の音量", "ध्वनि की आवाज़", "مستوى الأصوات"],
  s_auto:    ["Auto gather & attack", "Авто-добыча и атака", "Recolectar y atacar auto", "Coletar e atacar auto", "Récolte et attaque auto", "Auto-Sammeln & Angriff", "自动采集与攻击", "自動採集と攻撃", "ऑटो संग्रह और हमला", "جمع وهجوم تلقائي"],
  s_camDist: ["Camera distance", "Дальность камеры", "Distancia de cámara", "Distância da câmera", "Distance caméra", "Kameraabstand", "镜头距离", "カメラ距離", "कैमरा दूरी", "بُعد الكاميرا"],
  s_sens:    ["Camera sensitivity", "Чувствительность камеры", "Sensibilidad de cámara", "Sensibilidade da câmera", "Sensibilité caméra", "Kameraempfindlichkeit", "镜头灵敏度", "カメラ感度", "कैमरा संवेदनशीलता", "حساسية الكاميرا"],
  s_full:    ["Fullscreen", "Полный экран", "Pantalla completa", "Tela cheia", "Plein écran", "Vollbild", "全屏", "全画面", "पूर्ण स्क्रीन", "ملء الشاشة"],
  s_fullBtn: ["⛶ On/off", "⛶ Вкл/выкл", "⛶ Sí/no", "⛶ Liga/desliga", "⛶ Oui/non", "⛶ An/aus", "⛶ 开/关", "⛶ オン/オフ", "⛶ चालू/बंद", "⛶ تشغيل/إيقاف"],
  full_na:   ["Fullscreen is not supported by this browser", "Полный экран не поддерживается этим браузером", "Este navegador no admite pantalla completa", "Este navegador não suporta tela cheia", "Plein écran non pris en charge", "Vollbild wird nicht unterstützt", "此浏览器不支持全屏", "このブラウザは全画面非対応", "यह ब्राउज़र पूर्ण स्क्रीन नहीं करता", "المتصفح لا يدعم ملء الشاشة"],

  // ----- выбор героя -----
  sel_title: ["Choose your hero", "Выберите героя", "Elige tu héroe", "Escolha seu herói", "Choisissez votre héros", "Wähle deinen Helden", "选择英雄", "ヒーローを選ぼう", "अपना नायक चुनें", "اختر بطلك"],
  drag_hint: ["👆 Swipe the screen to rotate the hero", "👆 Проведите пальцем по экрану, чтобы вращать героя", "👆 Desliza para girar al héroe", "👆 Deslize para girar o herói", "👆 Glissez pour tourner le héros", "👆 Wischen, um den Helden zu drehen", "👆 滑动屏幕旋转英雄", "👆 スワイプでヒーローを回転", "👆 नायक घुमाने के लिए स्वाइप करें", "👆 اسحب لتدوير البطل"],
  start:     ["START GAME", "НАЧАТЬ ИГРУ", "EMPEZAR", "COMEÇAR", "COMMENCER", "SPIEL STARTEN", "开始游戏", "ゲーム開始", "खेल शुरू करें", "ابدأ اللعب"],
  st_hp:     ["Health", "Здоровье", "Salud", "Vida", "Santé", "Leben", "生命", "体力", "स्वास्थ्य", "الصحة"],
  st_speed:  ["Speed", "Скорость", "Velocidad", "Velocidade", "Vitesse", "Tempo", "速度", "速さ", "गति", "السرعة"],
  st_attack: ["Attack", "Атака", "Ataque", "Ataque", "Attaque", "Angriff", "攻击", "攻撃", "हमला", "الهجوم"],
  st_gather: ["Gathering", "Добыча", "Recolección", "Coleta", "Récolte", "Sammeln", "采集", "採集", "संग्रह", "الجمع"],
  st_build:  ["Building", "Стройка", "Construcción", "Construção", "Construction", "Bauen", "建造", "建築", "निर्माण", "البناء"],
  difficulty:["Difficulty:", "Сложность:", "Dificultad:", "Dificuldade:", "Difficulté :", "Schwierigkeit:", "难度：", "難易度：", "कठिनाई:", "الصعوبة:"],
  prep:      [" Time to prepare for a wave: {t}.", " Подготовка к волне: {t}.", " Preparación por oleada: {t}.", " Preparo por onda: {t}.", " Préparation par vague : {t}.", " Vorbereitung je Welle: {t}.", " 每波准备时间：{t}。", " 準備時間：{t}。", " हर लहर की तैयारी: {t}।", " وقت التحضير للموجة: {t}."],
  world:     ["World:", "Мир:", "Mundo:", "Mundo:", "Monde :", "Welt:", "世界：", "ワールド：", "दुनिया:", "العالم:"],
  seed_ph:   ["world seed", "сид мира", "semilla", "semente", "graine", "Seed", "世界种子", "シード", "सीड", "البذرة"],
  welcome:   ["Welcome! World: {biome} (seed {seed}). Chop trees and protect the birds 🐦", "Добро пожаловать! Мир: {biome} (сид {seed}). Рубите деревья и защищайте птиц 🐦", "¡Bienvenido! Mundo: {biome} (semilla {seed}). Tala árboles y protege a las aves 🐦", "Bem-vindo! Mundo: {biome} (semente {seed}). Corte árvores e proteja os pássaros 🐦", "Bienvenue ! Monde : {biome} (graine {seed}). Coupez du bois et protégez les oiseaux 🐦", "Willkommen! Welt: {biome} (Seed {seed}). Fälle Bäume und schütze die Vögel 🐦", "欢迎！世界：{biome}（种子 {seed}）。砍树并保护鸟儿 🐦", "ようこそ！ワールド：{biome}（シード {seed}）。木を切り鳥を守ろう 🐦", "स्वागत है! दुनिया: {biome} (सीड {seed})। पेड़ काटें और पक्षियों को बचाएँ 🐦", "أهلًا! العالم: {biome} (البذرة {seed}). اقطع الأشجار واحمِ الطيور 🐦"],

  // ----- HUD -----
  base_lbl:  ["🪺 GREAT NEST — base health", "🪺 ВЕЛИКОЕ ГНЕЗДО — здоровье базы", "🪺 GRAN NIDO — salud de la base", "🪺 GRANDE NINHO — vida da base", "🪺 GRAND NID — santé de la base", "🪺 GROSSES NEST — Basis-Leben", "🪺 伟大之巢 — 基地生命", "🪺 大いなる巣 — 基地の体力", "🪺 महान घोंसला — बेस स्वास्थ्य", "🪺 العش العظيم — صحة القاعدة"],
  wave_now:  ["⏩ Wave now", "⏩ Волна сейчас", "⏩ Oleada ya", "⏩ Onda agora", "⏩ Vague maintenant", "⏩ Welle jetzt", "⏩ 立即开波", "⏩ 今すぐウェーブ", "⏩ अभी लहर", "⏩ الموجة الآن"],
  wave_early:["Beasts come early! +25% reward", "Звери идут раньше! +25% награды", "¡Las bestias llegan antes! +25% de premio", "As feras vêm antes! +25% de prêmio", "Les bêtes arrivent plus tôt ! +25 %", "Tiere kommen früher! +25 % Belohnung", "野兽提前来袭！奖励+25%", "獣が早く来る！報酬+25%", "जानवर जल्दी आए! +25% इनाम", "الوحوش تأتي مبكرًا! +25% مكافأة"],
  move:      ["MOVE", "ДВИЖЕНИЕ", "MOVER", "MOVER", "DÉPLACER", "BEWEGEN", "移动", "移動", "चलें", "تحرك"],
  camera:    ["CAMERA", "КАМЕРА", "CÁMARA", "CÂMERA", "CAMÉRA", "KAMERA", "镜头", "カメラ", "कैमरा", "الكاميرا"],
  place:     ["✔ Place", "✔ Поставить", "✔ Colocar", "✔ Colocar", "✔ Poser", "✔ Setzen", "✔ 放置", "✔ 設置", "✔ रखें", "✔ ضع"],
  tb_axe:    ["Axe", "Топор", "Hacha", "Machado", "Hache", "Axt", "斧头", "斧", "कुल्हाड़ी", "فأس"],
  tb_pick:   ["Pickaxe", "Кирка", "Pico", "Picareta", "Pioche", "Hacke", "镐", "ツルハシ", "कुदाल", "معول"],
  tb_build:  ["Build", "Стройка", "Construir", "Construir", "Bâtir", "Bauen", "建造", "建築", "निर्माण", "بناء"],
  tb_inv:    ["Inventory", "Инвентарь", "Inventario", "Inventário", "Inventaire", "Inventar", "背包", "持ち物", "सामान", "الحقيبة"],
  tb_birds:  ["Birds", "Птицы", "Aves", "Pássaros", "Oiseaux", "Vögel", "鸟类", "鳥", "पक्षी", "الطيور"],
  wave_in:   ["Wave {n} in {t}", "Волна {n} через {t}", "Oleada {n} en {t}", "Onda {n} em {t}", "Vague {n} dans {t}", "Welle {n} in {t}", "第{n}波 {t} 后", "ウェーブ{n}まで {t}", "लहर {n}: {t} में", "الموجة {n} بعد {t}"],
  wave_on:   ["⚔️ Wave {n} · beasts: {k}", "⚔️ Волна {n} · зверей: {k}", "⚔️ Oleada {n} · bestias: {k}", "⚔️ Onda {n} · feras: {k}", "⚔️ Vague {n} · bêtes : {k}", "⚔️ Welle {n} · Tiere: {k}", "⚔️ 第{n}波 · 野兽：{k}", "⚔️ ウェーブ{n} · 獣：{k}", "⚔️ लहर {n} · जानवर: {k}", "⚔️ الموجة {n} · وحوش: {k}"],
  wounded:   ["wounded…", "ранен…", "herido…", "ferido…", "blessé…", "verwundet…", "受伤…", "負傷…", "घायल…", "مصاب…"],
  day:       ["Day {n}", "День {n}", "Día {n}", "Dia {n}", "Jour {n}", "Tag {n}", "第{n}天", "{n}日目", "दिन {n}", "اليوم {n}"],
  night_in:  ["🌙 night in {t}", "🌙 ночь через {t}", "🌙 noche en {t}", "🌙 noite em {t}", "🌙 nuit dans {t}", "🌙 Nacht in {t}", "🌙 {t} 后入夜", "🌙 夜まで {t}", "🌙 रात {t} में", "🌙 الليل بعد {t}"],
  morning_in:["☀️ morning in {t}", "☀️ утро через {t}", "☀️ mañana en {t}", "☀️ manhã em {t}", "☀️ matin dans {t}", "☀️ Morgen in {t}", "☀️ {t} 后天亮", "☀️ 朝まで {t}", "☀️ सुबह {t} में", "☀️ الصباح بعد {t}"],
  quest:     ["Quest:", "Задание:", "Misión:", "Missão:", "Quête :", "Aufgabe:", "任务：", "クエスト：", "काम:", "المهمة:"],
  quest_free:["Protect the birds as long as you can!", "Защищайте птиц как можно дольше!", "¡Protege a las aves todo lo que puedas!", "Proteja os pássaros o máximo possível!", "Protégez les oiseaux le plus longtemps possible !", "Schütze die Vögel so lange du kannst!", "尽可能久地保护鸟儿！", "できるだけ長く鳥を守れ！", "जितना हो सके पक्षियों को बचाएँ!", "احمِ الطيور أطول وقت ممكن!"],
  bird_count:["🐦 Birds: {n}/{cap} · at cannons: {c}", "🐦 Птиц: {n}/{cap} · у пушек: {c}", "🐦 Aves: {n}/{cap} · en cañones: {c}", "🐦 Pássaros: {n}/{cap} · nos canhões: {c}", "🐦 Oiseaux : {n}/{cap} · aux canons : {c}", "🐦 Vögel: {n}/{cap} · an Kanonen: {c}", "🐦 鸟：{n}/{cap} · 炮位：{c}", "🐦 鳥：{n}/{cap} · 砲手：{c}", "🐦 पक्षी: {n}/{cap} · तोपों पर: {c}", "🐦 الطيور: {n}/{cap} · عند المدافع: {c}"],
  on_wall:   [" (on wall)", " (на стену)", " (en muro)", " (no muro)", " (sur mur)", " (auf Mauer)", "（城墙上）", "（壁の上）", " (दीवार पर)", " (على السور)"],
  free:      ["free", "бесплатно", "gratis", "grátis", "gratuit", "gratis", "免费", "無料", "मुफ़्त", "مجانًا"],
  lvl:       ["{name} (lv {l})", "{name} (ур. {l})", "{name} (nv {l})", "{name} (nv {l})", "{name} (nv {l})", "{name} (St. {l})", "{name}（{l}级）", "{name}（Lv{l}）", "{name} (स्तर {l})", "{name} (مستوى {l})"],
  view_fp:   ["👁 First-person view", "👁 Вид от первого лица", "👁 Vista en 1.ª persona", "👁 Visão em 1ª pessoa", "👁 Vue à la 1re personne", "👁 Ich-Perspektive", "👁 第一人称视角", "👁 一人称視点", "👁 पहले व्यक्ति का दृश्य", "👁 منظور الشخص الأول"],
  view_tp:   ["🎥 Third-person view", "🎥 Вид от третьего лица", "🎥 Vista en 3.ª persona", "🎥 Visão em 3ª pessoa", "🎥 Vue à la 3e personne", "🎥 Verfolgerperspektive", "🎥 第三人称视角", "🎥 三人称視点", "🎥 तीसरे व्यक्ति का दृश्य", "🎥 منظور الشخص الثالث"],
  no_stamina:["Too tired to run — catch your breath", "Нет сил бежать — восстановите выносливость", "Sin fuerzas para correr — descansa", "Sem fôlego para correr — descanse", "Trop fatigué pour courir — reposez-vous", "Zu erschöpft zum Laufen — kurz ausruhen", "体力不足，先休息一下", "走る体力がない — 休もう", "दौड़ने की ताक़त नहीं — आराम करें", "متعب جدًا للركض — استرح"],
  hint_place_touch: ["Aim with the camera and tap “Place”", "Наведите камерой и нажмите «Поставить»", "Apunta con la cámara y pulsa «Colocar»", "Mire com a câmera e toque «Colocar»", "Visez avec la caméra et touchez « Poser »", "Mit der Kamera zielen und „Setzen“ tippen", "用镜头瞄准后点“放置”", "カメラで狙って「設置」", "कैमरे से निशाना लगाएँ और “रखें” दबाएँ", "صوّب بالكاميرا ثم اضغط «ضع»"],
  hint_place_pc:    ["Pick a spot: LMB / Enter — place, R — rotate", "Выберите место: ЛКМ / Enter — поставить, R — повернуть", "Elige sitio: clic / Enter — colocar, R — girar", "Escolha o local: clique / Enter — colocar, R — girar", "Choisissez : clic / Entrée — poser, R — tourner", "Ort wählen: LMT / Enter — setzen, R — drehen", "选位置：左键/回车放置，R旋转", "場所を選択：左クリック/Enterで設置、Rで回転", "जगह चुनें: क्लिक / Enter — रखें, R — घुमाएँ", "اختر المكان: نقرة/Enter للوضع، R للتدوير"],
  move_closer:      ["Move closer to a building", "Подойдите ближе к постройке", "Acércate a un edificio", "Chegue mais perto de uma construção", "Approchez-vous d'un bâtiment", "Geh näher an ein Gebäude", "靠近建筑", "建物に近づこう", "किसी इमारत के पास जाएँ", "اقترب من مبنى"],
  rotate_txt:       ["Turn your phone <b>sideways</b> — it's easier to play", "Поверните телефон <b>горизонтально</b> — так удобнее играть", "Gira el teléfono <b>en horizontal</b> — es más cómodo", "Vire o celular <b>na horizontal</b> — é mais confortável", "Tournez le téléphone <b>à l'horizontale</b> — c'est plus pratique", "Dreh das Handy <b>quer</b> — so spielt es sich besser", "请<b>横屏</b>游玩，体验更佳", "スマホを<b>横向き</b>にすると遊びやすい", "फ़ोन को <b>आड़ा</b> करें — खेलना आसान होगा", "أدر الهاتف <b>أفقيًا</b> — اللعب أسهل"],
  rotate_ok:        ["Play like this", "Играть так", "Jugar así", "Jogar assim", "Jouer ainsi", "So spielen", "就这样玩", "このまま遊ぶ", "ऐसे ही खेलें", "العب هكذا"],

  // ----- пауза / конец -----
  pause:     ["Pause", "Пауза", "Pausa", "Pausa", "Pause", "Pause", "暂停", "ポーズ", "विराम", "إيقاف مؤقت"],
  resume:    ["▶ RESUME", "▶ ПРОДОЛЖИТЬ", "▶ CONTINUAR", "▶ CONTINUAR", "▶ REPRENDRE", "▶ WEITER", "▶ 继续", "▶ 再開", "▶ जारी रखें", "▶ متابعة"],
  save_b:    ["💾 SAVE", "💾 СОХРАНИТЬ", "💾 GUARDAR", "💾 SALVAR", "💾 SAUVEGARDER", "💾 SPEICHERN", "💾 保存", "💾 セーブ", "💾 सेव करें", "💾 حفظ"],
  mainmenu:  ["🏠 MAIN MENU", "🏠 ГЛАВНОЕ МЕНЮ", "🏠 MENÚ PRINCIPAL", "🏠 MENU PRINCIPAL", "🏠 MENU PRINCIPAL", "🏠 HAUPTMENÜ", "🏠 主菜单", "🏠 メインメニュー", "🏠 मुख्य मेनू", "🏠 القائمة الرئيسية"],
  over_title:["🪺 Base destroyed!", "🪺 База разрушена!", "🪺 ¡Base destruida!", "🪺 Base destruída!", "🪺 Base détruite !", "🪺 Basis zerstört!", "🪺 基地被摧毁！", "🪺 基地が壊された！", "🪺 बेस नष्ट हो गया!", "🪺 دُمّرت القاعدة!"],
  over_note: ["Save deleted — a new run starts from scratch.", "Сохранение удалено — новое прохождение начнётся с начала.", "Partida borrada: empezarás desde cero.", "Save apagado — recomece do zero.", "Sauvegarde supprimée — recommencez à zéro.", "Spielstand gelöscht — Neustart von vorn.", "存档已删除，新的一局将从头开始。", "セーブは削除されました。最初からやり直しです。", "सेव हट गया — नया खेल शुरू से होगा।", "حُذف الحفظ — ستبدأ من جديد."],
  r_waves:   ["Waves repelled", "Волн отбито", "Oleadas superadas", "Ondas repelidas", "Vagues repoussées", "Abgewehrte Wellen", "击退波数", "撃退したウェーブ", "रोकी गई लहरें", "موجات صُدّت"],
  r_time:    ["Play time", "Время игры", "Tiempo de juego", "Tempo de jogo", "Temps de jeu", "Spielzeit", "游戏时间", "プレイ時間", "खेल का समय", "مدة اللعب"],
  r_days:    ["Days survived", "Дней прожито", "Días vividos", "Dias vividos", "Jours survécus", "Überlebte Tage", "存活天数", "生き延びた日数", "बचे दिन", "أيام النجاة"],
  r_kills:   ["Beasts defeated", "Побеждено зверей", "Bestias vencidas", "Feras vencidas", "Bêtes vaincues", "Besiegte Tiere", "击败野兽", "倒した獣", "हराए जानवर", "وحوش مهزومة"],
  r_bosses:  ["Bosses defeated", "Побеждено боссов", "Jefes vencidos", "Chefes vencidos", "Boss vaincus", "Besiegte Bosse", "击败首领", "倒したボス", "हराए बॉस", "زعماء مهزومون"],
  r_built:   ["Built", "Построено", "Construido", "Construído", "Construit", "Gebaut", "建造数", "建てた数", "बनाया", "بُني"],
  r_wood:    ["Wood gathered", "Добыто дерева", "Madera reunida", "Madeira coletada", "Bois récolté", "Holz gesammelt", "采集木材", "集めた木材", "लकड़ी जमा", "خشب مجموع"],
  r_stone:   ["Stone mined", "Добыто камня", "Piedra extraída", "Pedra extraída", "Pierre extraite", "Stein abgebaut", "开采石头", "掘った石", "पत्थर खोदा", "حجر مستخرج"],
  r_coal:    ["Coal mined", "Добыто угля", "Carbón extraído", "Carvão extraído", "Charbon extrait", "Kohle abgebaut", "开采煤炭", "掘った石炭", "कोयला खोदा", "فحم مستخرج"],
  r_iron:    ["Iron mined", "Добыто железа", "Hierro extraído", "Ferro extraído", "Fer extrait", "Eisen abgebaut", "开采铁", "掘った鉄", "लोहा खोदा", "حديد مستخرج"],
  r_food:    ["Food gathered", "Собрано еды", "Comida reunida", "Comida coletada", "Nourriture récoltée", "Nahrung gesammelt", "收集食物", "集めた食料", "भोजन जमा", "طعام مجموع"],
  r_coins:   ["Coins earned", "Заработано монет", "Monedas ganadas", "Moedas ganhas", "Pièces gagnées", "Verdiente Münzen", "赚取金币", "稼いだコイン", "कमाए सिक्के", "عملات مكتسبة"],
  r_birds:   ["Birds bought", "Куплено птиц", "Aves compradas", "Pássaros comprados", "Oiseaux achetés", "Gekaufte Vögel", "购买鸟类", "買った鳥", "ख़रीदे पक्षी", "طيور مشتراة"],
  seed:      ["seed", "сид", "semilla", "semente", "graine", "Seed", "种子", "シード", "सीड", "البذرة"],
  bye_title: ["Thanks for playing!", "Спасибо за игру!", "¡Gracias por jugar!", "Obrigado por jogar!", "Merci d'avoir joué !", "Danke fürs Spielen!", "感谢游玩！", "遊んでくれてありがとう！", "खेलने के लिए धन्यवाद!", "شكرًا للعب!"],
  bye_txt:   ["Progress saved. You can close the tab.", "Прогресс сохранён. Можно закрыть вкладку.", "Progreso guardado. Puedes cerrar la pestaña.", "Progresso salvo. Pode fechar a aba.", "Progression sauvegardée. Vous pouvez fermer l'onglet.", "Fortschritt gespeichert. Tab kann geschlossen werden.", "进度已保存，可以关闭页面。", "進行状況を保存しました。タブを閉じても大丈夫。", "प्रगति सेव हो गई। टैब बंद कर सकते हैं।", "تم الحفظ. يمكنك إغلاق الصفحة."],
  bye_back:  ["◀ TO MENU", "◀ В МЕНЮ", "◀ AL MENÚ", "◀ AO MENU", "◀ AU MENU", "◀ ZUM MENÜ", "◀ 返回菜单", "◀ メニューへ", "◀ मेनू पर", "◀ إلى القائمة"],

  // ----- окна -----
  m_build:   ["🔨 Building", "🔨 Строительство", "🔨 Construcción", "🔨 Construção", "🔨 Construction", "🔨 Bauen", "🔨 建造", "🔨 建築", "🔨 निर्माण", "🔨 البناء"],
  need_tech: ["🔒 Requires “{name}”", "🔒 Нужна технология «{name}»", "🔒 Requiere «{name}»", "🔒 Requer «{name}»", "🔒 Nécessite « {name} »", "🔒 Benötigt „{name}“", "🔒 需要“{name}”", "🔒 「{name}」が必要", "🔒 “{name}” चाहिए", "🔒 يتطلب «{name}»"],
  built_one: ["✔ Already built", "✔ Уже построено", "✔ Ya construido", "✔ Já construído", "✔ Déjà construit", "✔ Bereits gebaut", "✔ 已建造", "✔ 建設済み", "✔ पहले से बना", "✔ مبني بالفعل"],
  limit_hit: ["Limit of {n} reached", "Достигнут лимит {n} шт.", "Límite de {n} alcanzado", "Limite de {n} atingido", "Limite de {n} atteinte", "Limit von {n} erreicht", "已达上限 {n}", "上限{n}に到達", "{n} की सीमा पूरी", "بلغت الحد {n}"],
  b_build:   ["Build", "Строить", "Construir", "Construir", "Bâtir", "Bauen", "建造", "建てる", "बनाएँ", "ابنِ"],
  b_choose:  ["Choose", "Выбрать", "Elegir", "Escolher", "Choisir", "Wählen", "选择", "選ぶ", "चुनें", "اختر"],
  levels_n:  ["Levels: {s}", "Уровни: {s}", "Niveles: {s}", "Níveis: {s}", "Niveaux : {s}", "Stufen: {s}", "等级：{s}", "レベル：{s}", "स्तर: {s}", "المستويات: {s}"],
  built_cnt: ["Built: {n}/{m}", "Построено: {n}/{m}", "Construido: {n}/{m}", "Construído: {n}/{m}", "Construit : {n}/{m}", "Gebaut: {n}/{m}", "已建：{n}/{m}", "建設数：{n}/{m}", "बने: {n}/{m}", "مبني: {n}/{m}"],
  cannon_on_wall: ["💣 Cannon on the wall: ", "💣 Пушка на стене: ", "💣 Cañón en el muro: ", "💣 Canhão no muro: ", "💣 Canon sur le mur : ", "💣 Kanone auf der Mauer: ", "💣 城墙上的大炮：", "💣 壁の大砲：", "💣 दीवार पर तोप: ", "💣 مدفع على السور: "],
  durability:["Durability: {a} / {b}", "Прочность: {a} / {b}", "Resistencia: {a} / {b}", "Resistência: {a} / {b}", "Solidité : {a} / {b}", "Haltbarkeit: {a} / {b}", "耐久：{a} / {b}", "耐久：{a} / {b}", "मज़बूती: {a} / {b}", "المتانة: {a} / {b}"],
  cannon_stats: ["Damage {d} · Rate {r}/s · Range {g} · Blast {s}", "Урон {d} · Скорость {r}/с · Дальность {g} · Взрыв {s}", "Daño {d} · Cadencia {r}/s · Alcance {g} · Explosión {s}", "Dano {d} · Cadência {r}/s · Alcance {g} · Explosão {s}", "Dégâts {d} · Cadence {r}/s · Portée {g} · Explosion {s}", "Schaden {d} · Rate {r}/s · Reichweite {g} · Explosion {s}", "伤害 {d} · 射速 {r}/秒 · 射程 {g} · 爆炸 {s}", "ダメージ{d} · 速度{r}/秒 · 射程{g} · 爆発{s}", "नुकसान {d} · गति {r}/से · दूरी {g} · धमाका {s}", "الضرر {d} · المعدل {r}/ث · المدى {g} · الانفجار {s}"],
  cannon_auto:  [" · fires on its own (a bird boosts it)", " · стреляет сама (птица усиливает)", " · dispara sola (un ave la mejora)", " · atira sozinho (pássaro reforça)", " · tire seul (un oiseau le renforce)", " · feuert selbst (Vogel verstärkt)", " · 自动开火（鸟可强化）", " · 自動射撃（鳥で強化）", " · खुद चलती है (पक्षी ताक़त बढ़ाता)", " · تطلق وحدها (الطائر يقويها)"],
  cannon_need:  [" · needs a bird gunner", " · нужна птица-стрелок", " · necesita un ave tiradora", " · precisa de um pássaro atirador", " · nécessite un oiseau tireur", " · braucht einen Vogelschützen", " · 需要鸟炮手", " · 鳥の砲手が必要", " · पक्षी निशानेबाज़ चाहिए", " · يحتاج طائرًا راميًا"],
  farm_info: ["Produces 1 🍖 every 10 s.", "Производит 1 🍖 каждые 10 сек.", "Produce 1 🍖 cada 10 s.", "Produz 1 🍖 a cada 10 s.", "Produit 1 🍖 toutes les 10 s.", "Erzeugt 1 🍖 alle 10 s.", "每10秒生产1 🍖。", "10秒ごとに🍖1。", "हर 10 से. में 1 🍖।", "تنتج 1 🍖 كل 10 ث."],
  turret_info: ["{name}: damage {d} · rate {r}/s · range {g}{s}. Levels: crossbow → machine gun → rockets.", "{name}: урон {d} · скорость {r}/с · дальность {g}{s}. Уровни: арбалет → пулемёт → ракетница.", "{name}: daño {d} · cadencia {r}/s · alcance {g}{s}. Niveles: ballesta → ametralladora → cohetes.", "{name}: dano {d} · cadência {r}/s · alcance {g}{s}. Níveis: besta → metralhadora → foguetes.", "{name} : dégâts {d} · cadence {r}/s · portée {g}{s}. Niveaux : arbalète → mitrailleuse → roquettes.", "{name}: Schaden {d} · Rate {r}/s · Reichweite {g}{s}. Stufen: Armbrust → MG → Raketen.", "{name}：伤害 {d} · 射速 {r}/秒 · 射程 {g}{s}。等级：弩→机枪→火箭。", "{name}：ダメージ{d} · 速度{r}/秒 · 射程{g}{s}。弩→機関銃→ロケット。", "{name}: नुकसान {d} · गति {r}/से · दूरी {g}{s}। स्तर: क्रॉसबो → मशीनगन → रॉकेट।", "{name}: الضرر {d} · المعدل {r}/ث · المدى {g}{s}. المستويات: قوس ← رشاش ← صواريخ."],
  blast:     [" · blast {s}", " · взрыв {s}", " · explosión {s}", " · explosão {s}", " · explosion {s}", " · Explosion {s}", " · 爆炸 {s}", " · 爆発{s}", " · धमाका {s}", " · انفجار {s}"],
  mine_info: ["Mines: {a} every {x}s, {b} every {y}s, {c} every {z}s.", "Добывает: {a} раз в {x}с, {b} раз в {y}с, {c} раз в {z}с.", "Extrae: {a} cada {x}s, {b} cada {y}s, {c} cada {z}s.", "Extrai: {a} a cada {x}s, {b} a cada {y}s, {c} a cada {z}s.", "Extrait : {a} toutes les {x}s, {b} toutes les {y}s, {c} toutes les {z}s.", "Fördert: {a} alle {x}s, {b} alle {y}s, {c} alle {z}s.", "产出：{a} 每{x}秒，{b} 每{y}秒，{c} 每{z}秒。", "採掘：{a} {x}秒毎、{b} {y}秒毎、{c} {z}秒毎。", "खोदती है: {a} हर {x}से, {b} हर {y}से, {c} हर {z}से।", "يستخرج: {a} كل {x}ث، {b} كل {y}ث، {c} كل {z}ث."],
  gate_info: ["Levels: wooden → iron-bound → stone → fortress → steel.", "Уровни: деревянные → окованные → каменные → крепостные → стальные.", "Niveles: madera → herrada → piedra → fortaleza → acero.", "Níveis: madeira → reforçado → pedra → fortaleza → aço.", "Niveaux : bois → ferrée → pierre → forteresse → acier.", "Stufen: Holz → beschlagen → Stein → Festung → Stahl.", "等级：木→铁箍→石→要塞→钢。", "木→鉄張り→石→要塞→鋼。", "स्तर: लकड़ी → लोहा जड़ा → पत्थर → क़िला → इस्पात।", "المستويات: خشب ← مصفح ← حجر ← قلعة ← فولاذ."],
  cap_info:  ["Resource capacity: {n}", "Вместимость ресурсов: {n}", "Capacidad: {n}", "Capacidade: {n}", "Capacité : {n}", "Kapazität: {n}", "资源容量：{n}", "資源上限：{n}", "भंडारण क्षमता: {n}", "سعة الموارد: {n}"],
  bird_slots:["Bird slots: +{n} (total {t})", "Места для птиц: +{n} (всего {t})", "Plazas de aves: +{n} (total {t})", "Vagas: +{n} (total {t})", "Places : +{n} (total {t})", "Vogelplätze: +{n} (gesamt {t})", "鸟位：+{n}（共{t}）", "鳥枠：+{n}（計{t}）", "पक्षी जगह: +{n} (कुल {t})", "أماكن الطيور: +{n} (المجموع {t})"],
  upgrade_to:["⬆ Upgrade to “{name}” — {cost}", "⬆ Улучшить до «{name}» — {cost}", "⬆ Mejorar a «{name}» — {cost}", "⬆ Melhorar para «{name}» — {cost}", "⬆ Améliorer en « {name} » — {cost}", "⬆ Ausbauen zu „{name}“ — {cost}", "⬆ 升级为“{name}” — {cost}", "⬆ 「{name}」に強化 — {cost}", "⬆ “{name}” तक बढ़ाएँ — {cost}", "⬆ طوّر إلى «{name}» — {cost}"],
  max_level: ["★ Max level", "★ Максимальный уровень", "★ Nivel máximo", "★ Nível máximo", "★ Niveau max", "★ Maximalstufe", "★ 已满级", "★ 最大レベル", "★ अधिकतम स्तर", "★ أعلى مستوى"],
  repair:    ["🔧 Repair — {cost}", "🔧 Починить — {cost}", "🔧 Reparar — {cost}", "🔧 Consertar — {cost}", "🔧 Réparer — {cost}", "🔧 Reparieren — {cost}", "🔧 修理 — {cost}", "🔧 修理 — {cost}", "🔧 मरम्मत — {cost}", "🔧 إصلاح — {cost}"],
  demolish:  ["🗑 Demolish", "🗑 Снести", "🗑 Demoler", "🗑 Demolir", "🗑 Démolir", "🗑 Abreißen", "🗑 拆除", "🗑 解体", "🗑 गिराएँ", "🗑 هدم"],
  demolish_ok:["Sure? (50% refunded)", "Точно снести? (вернётся 50%)", "¿Seguro? (se devuelve 50%)", "Certeza? (50% de volta)", "Sûr ? (50 % rendus)", "Sicher? (50 % zurück)", "确定？（返还50%）", "本当に？（50%返却）", "पक्का? (50% वापस)", "متأكد؟ (يُسترد 50%)"],
  market_btn:["🐦 Bird market & my birds", "🐦 Птичий рынок и мои птицы", "🐦 Mercado y mis aves", "🐦 Mercado e meus pássaros", "🐦 Marché et mes oiseaux", "🐦 Vogelmarkt & meine Vögel", "🐦 鸟市和我的鸟", "🐦 鳥市場と自分の鳥", "🐦 पक्षी बाज़ार और मेरे पक्षी", "🐦 سوق الطيور وطيوري"],
  eat_btn:   ["🍖 Eat (+35 ❤️ for 3 food)", "🍖 Съесть (+35 ❤️ за 3 еды)", "🍖 Comer (+35 ❤️ por 3 comida)", "🍖 Comer (+35 ❤️ por 3 comida)", "🍖 Manger (+35 ❤️ pour 3)", "🍖 Essen (+35 ❤️ für 3)", "🍖 进食（3食物 +35 ❤️）", "🍖 食べる（食料3で❤️+35）", "🍖 खाएँ (3 भोजन से +35 ❤️)", "🍖 كُل (+35 ❤️ مقابل 3 طعام)"],
  gunner:    ["🐦 Gunner", "🐦 Стрелок", "🐦 Tirador", "🐦 Atirador", "🐦 Tireur", "🐦 Schütze", "🐦 炮手", "🐦 砲手", "🐦 निशानेबाज़", "🐦 الرامي"],
  take_off:  ["Remove from cannon", "Снять с пушки", "Quitar del cañón", "Tirar do canhão", "Retirer du canon", "Von Kanone nehmen", "撤下炮位", "砲から降ろす", "तोप से हटाएँ", "أزله من المدفع"],
  no_gunner: ["Nobody is manning this cannon. Seat a bird:", "За пушкой никого нет. Посадите птицу:", "Nadie maneja el cañón. Pon un ave:", "Ninguém no canhão. Coloque um pássaro:", "Personne au canon. Placez un oiseau :", "Niemand an der Kanone. Setze einen Vogel:", "没有鸟操作大炮，派一只鸟：", "砲手がいない。鳥を座らせよう：", "तोप पर कोई नहीं। पक्षी बिठाएँ:", "لا أحد عند المدفع. ضع طائرًا:"],
  buy_bird:  ["🛒 Buy a bird", "🛒 Купить птицу", "🛒 Comprar ave", "🛒 Comprar pássaro", "🛒 Acheter un oiseau", "🛒 Vogel kaufen", "🛒 购买鸟", "🛒 鳥を買う", "🛒 पक्षी ख़रीदें", "🛒 اشترِ طائرًا"],
  replace:   ["Replace", "Заменить", "Cambiar", "Trocar", "Remplacer", "Ersetzen", "替换", "交代", "बदलें", "استبدال"],
  seat:      ["Seat", "Посадить", "Colocar", "Colocar", "Placer", "Einsetzen", "就位", "座らせる", "बिठाएँ", "أجلِس"],
  bird_stats:["Damage ×{d} · Rate ×{r} · Range ×{g}", "Урон ×{d} · Скор. ×{r} · Дальн. ×{g}", "Daño ×{d} · Cad. ×{r} · Alc. ×{g}", "Dano ×{d} · Cad. ×{r} · Alc. ×{g}", "Dégâts ×{d} · Cad. ×{r} · Port. ×{g}", "Schaden ×{d} · Rate ×{r} · Reichw. ×{g}", "伤害×{d} · 射速×{r} · 射程×{g}", "攻撃×{d} · 速度×{r} · 射程×{g}", "नुकसान ×{d} · गति ×{r} · दूरी ×{g}", "الضرر ×{d} · المعدل ×{r} · المدى ×{g}"],
  ws_need:   ["⚒️ Build a “Workshop” (Build → Production) to craft tools and research technologies.", "⚒️ Постройте «Мастерскую» (Стройка → Производство), чтобы создавать инструменты и изучать технологии.", "⚒️ Construye un «Taller» (Construir → Producción) para herramientas y tecnologías.", "⚒️ Construa uma «Oficina» (Construir → Produção) para ferramentas e tecnologias.", "⚒️ Construisez un « Atelier » (Bâtir → Production) pour outils et technologies.", "⚒️ Baue eine „Werkstatt“ (Bauen → Produktion) für Werkzeuge und Technologien.", "⚒️ 建造“工坊”（建造→生产）来制作工具和研究科技。", "⚒️ 「工房」（建築→生産）を建てて道具と技術を手に入れよう。", "⚒️ औज़ार और तकनीक के लिए “कार्यशाला” बनाएँ (निर्माण → उत्पादन)।", "⚒️ ابنِ «ورشة» (بناء ← إنتاج) لصنع الأدوات والتقنيات."],
  gear_title:["🔦 Gear — light in the dark", "🔦 Снаряжение — свет в темноте", "🔦 Equipo — luz en la oscuridad", "🔦 Equipamento — luz no escuro", "🔦 Équipement — lumière dans le noir", "🔦 Ausrüstung — Licht im Dunkeln", "🔦 装备 — 黑暗中的光", "🔦 装備 — 暗闇の灯り", "🔦 सामान — अंधेरे में रोशनी", "🔦 العتاد — ضوء في الظلام"],
  take_off2: ["Take off", "Снять", "Quitar", "Tirar", "Retirer", "Ablegen", "卸下", "外す", "उतारें", "اخلع"],
  put_on:    ["Put on", "Надеть", "Equipar", "Equipar", "Équiper", "Anlegen", "装备", "装備", "पहनें", "ارتدِ"],
  buy:       ["Buy", "Купить", "Comprar", "Comprar", "Acheter", "Kaufen", "购买", "買う", "ख़रीदें", "اشترِ"],
  tools:     ["🛠 Tools", "🛠 Инструменты", "🛠 Herramientas", "🛠 Ferramentas", "🛠 Outils", "🛠 Werkzeuge", "🛠 工具", "🛠 道具", "🛠 औज़ार", "🛠 الأدوات"],
  none:      ["none", "нет", "ninguno", "nenhum", "aucun", "keine", "无", "なし", "कोई नहीं", "لا شيء"],
  now:       ["Current: {name}", "Сейчас: {name}", "Actual: {name}", "Atual: {name}", "Actuel : {name}", "Aktuell: {name}", "当前：{name}", "現在：{name}", "अभी: {name}", "الحالي: {name}"],
  power:     ["Gathering power: {n}", "Сила добычи: {n}", "Poder de recolección: {n}", "Poder de coleta: {n}", "Puissance de récolte : {n}", "Sammelkraft: {n}", "采集力：{n}", "採集力：{n}", "संग्रह शक्ति: {n}", "قوة الجمع: {n}"],
  pick_need: ["Needed to mine stone, coal and iron", "Нужна для добычи камня, угля и железа", "Necesario para piedra, carbón y hierro", "Necessária para pedra, carvão e ferro", "Nécessaire pour pierre, charbon et fer", "Nötig für Stein, Kohle und Eisen", "开采石头、煤和铁需要它", "石・石炭・鉄の採掘に必要", "पत्थर, कोयला और लोहे के लिए ज़रूरी", "لازم لاستخراج الحجر والفحم والحديد"],
  craft:     ["Craft", "Создать", "Fabricar", "Fabricar", "Fabriquer", "Herstellen", "制作", "作る", "बनाएँ", "اصنع"],
  best_tool: ["★ Best tool", "★ Лучший инструмент", "★ Mejor herramienta", "★ Melhor ferramenta", "★ Meilleur outil", "★ Bestes Werkzeug", "★ 最佳工具", "★ 最高の道具", "★ सबसे अच्छा औज़ार", "★ أفضل أداة"],
  techs:     ["📜 Technologies", "📜 Технологии", "📜 Tecnologías", "📜 Tecnologias", "📜 Technologies", "📜 Technologien", "📜 科技", "📜 技術", "📜 तकनीकें", "📜 التقنيات"],
  first_req: ["🔒 First: {name}", "🔒 Сначала: {name}", "🔒 Primero: {name}", "🔒 Primeiro: {name}", "🔒 D'abord : {name}", "🔒 Zuerst: {name}", "🔒 先研究：{name}", "🔒 先に：{name}", "🔒 पहले: {name}", "🔒 أولًا: {name}"],
  research:  ["Research", "Изучить", "Investigar", "Pesquisar", "Rechercher", "Erforschen", "研究", "研究", "सीखें", "ابحث"],
  m_inv:     ["🎒 Inventory", "🎒 Инвентарь", "🎒 Inventario", "🎒 Inventário", "🎒 Inventaire", "🎒 Inventar", "🎒 背包", "🎒 持ち物", "🎒 सामान", "🎒 الحقيبة"],
  tab_res:   ["Resources", "Ресурсы", "Recursos", "Recursos", "Ressources", "Rohstoffe", "资源", "資源", "संसाधन", "الموارد"],
  tab_work:  ["Workshop", "Мастерская", "Taller", "Oficina", "Atelier", "Werkstatt", "工坊", "工房", "कार्यशाला", "الورشة"],
  tab_hero:  ["Hero", "Герой", "Héroe", "Herói", "Héros", "Held", "英雄", "ヒーロー", "नायक", "البطل"],
  where:     ["Where to gather: 🪵 — trees around the base; 🪨 — grey rocks and the quarry (the arrow shows the way); coal and 🔩 — in the quarry and near the cave; 🍖 — berry bushes, farms and boars. Storehouses raise capacity.", "Где добывать: 🪵 — деревья вокруг базы; 🪨 — серые камни и карьер (путь показывает стрелка); уголь и 🔩 — в карьере и у пещеры; 🍖 — ягодные кусты, ферма и кабаны. Склад увеличивает вместимость.", "Dónde recolectar: 🪵 — árboles; 🪨 — rocas y la cantera (sigue la flecha); carbón y 🔩 — cantera y cueva; 🍖 — bayas, granjas y jabalíes. Los almacenes amplían la capacidad.", "Onde coletar: 🪵 — árvores; 🪨 — rochas e a pedreira (siga a seta); carvão e 🔩 — pedreira e caverna; 🍖 — frutas, fazendas e javalis. Armazéns aumentam a capacidade.", "Où récolter : 🪵 — arbres ; 🪨 — rochers et carrière (suivez la flèche) ; charbon et 🔩 — carrière et grotte ; 🍖 — baies, fermes et sangliers. Les entrepôts augmentent la capacité.", "Wo sammeln: 🪵 — Bäume; 🪨 — Felsen und Steinbruch (Pfeil folgen); Kohle und 🔩 — Steinbruch und Höhle; 🍖 — Beeren, Höfe und Wildschweine. Lager erhöhen die Kapazität.", "采集地点：🪵 基地周围的树；🪨 灰色岩石和采石场（看箭头）；煤和🔩 采石场与洞穴；🍖 浆果丛、农场和野猪。仓库可提升容量。", "採集場所：🪵 基地周りの木；🪨 岩と採石場（矢印へ）；石炭と🔩 採石場と洞窟；🍖 ベリー・畑・イノシシ。倉庫で上限アップ。", "कहाँ से लें: 🪵 — पेड़; 🪨 — चट्टानें और खदान (तीर देखें); कोयला और 🔩 — खदान और गुफा; 🍖 — बेर, खेत और सूअर। गोदाम क्षमता बढ़ाते हैं।", "أماكن الجمع: 🪵 الأشجار؛ 🪨 الصخور والمحجر (اتبع السهم)؛ الفحم و🔩 المحجر والكهف؛ 🍖 التوت والمزارع والخنازير. المخازن تزيد السعة."],
  hero_line: ["❤️ {hp}/{max} · 🏃 speed {s} · ⚔️ damage {d}", "❤️ {hp}/{max} · 🏃 скорость {s} · ⚔️ урон {d}", "❤️ {hp}/{max} · 🏃 velocidad {s} · ⚔️ daño {d}", "❤️ {hp}/{max} · 🏃 velocidade {s} · ⚔️ dano {d}", "❤️ {hp}/{max} · 🏃 vitesse {s} · ⚔️ dégâts {d}", "❤️ {hp}/{max} · 🏃 Tempo {s} · ⚔️ Schaden {d}", "❤️ {hp}/{max} · 🏃 速度 {s} · ⚔️ 伤害 {d}", "❤️ {hp}/{max} · 🏃 速さ{s} · ⚔️ 攻撃{d}", "❤️ {hp}/{max} · 🏃 गति {s} · ⚔️ नुकसान {d}", "❤️ {hp}/{max} · 🏃 السرعة {s} · ⚔️ الضرر {d}"],
  tools_line:["Tools: {a}, {b}", "Инструменты: {a}, {b}", "Herramientas: {a}, {b}", "Ferramentas: {a}, {b}", "Outils : {a}, {b}", "Werkzeuge: {a}, {b}", "工具：{a}，{b}", "道具：{a}、{b}", "औज़ार: {a}, {b}", "الأدوات: {a}، {b}"],
  no_pick:   ["no pickaxe", "кирки нет", "sin pico", "sem picareta", "pas de pioche", "keine Spitzhacke", "没有镐", "ツルハシなし", "कुदाल नहीं", "لا معول"],
  tech_line: ["Technologies: {a}", "Технологии: {a}", "Tecnologías: {a}", "Tecnologias: {a}", "Technologies : {a}", "Technologien: {a}", "科技：{a}", "技術：{a}", "तकनीकें: {a}", "التقنيات: {a}"],
  world_line:["World: {b} · seed {s} (enter it in a new game to get the same map)", "Мир: {b} · сид {s} (введите его при новой игре, чтобы получить такую же карту)", "Mundo: {b} · semilla {s} (úsala en una nueva partida para el mismo mapa)", "Mundo: {b} · semente {s} (use num novo jogo para o mesmo mapa)", "Monde : {b} · graine {s} (saisissez-la pour la même carte)", "Welt: {b} · Seed {s} (im neuen Spiel eingeben für dieselbe Karte)", "世界：{b} · 种子 {s}（新游戏中输入可得到相同地图）", "ワールド：{b} · シード {s}（新規ゲームで入力すると同じマップ）", "दुनिया: {b} · सीड {s} (नए खेल में डालें तो वही नक्शा)", "العالم: {b} · البذرة {s} (أدخلها في لعبة جديدة لنفس الخريطة)"],
  stats_line:["Stats: wave {w}, day {d}, beasts defeated {k}, built {b}", "Статистика: волна {w}, день {d}, побеждено зверей {k}, построено {b}", "Estadísticas: oleada {w}, día {d}, bestias {k}, construido {b}", "Estatísticas: onda {w}, dia {d}, feras {k}, construído {b}", "Stats : vague {w}, jour {d}, bêtes {k}, construit {b}", "Statistik: Welle {w}, Tag {d}, Tiere {k}, gebaut {b}", "统计：第{w}波，第{d}天，击败野兽{k}，建造{b}", "統計：ウェーブ{w}、{d}日目、獣{k}、建設{b}", "आँकड़े: लहर {w}, दिन {d}, जानवर {k}, बने {b}", "إحصاءات: الموجة {w}، اليوم {d}، وحوش {k}، مبانٍ {b}"],
  m_birds:   ["🐦 Birds", "🐦 Птицы", "🐦 Aves", "🐦 Pássaros", "🐦 Oiseaux", "🐦 Vögel", "🐦 鸟类", "🐦 鳥", "🐦 पक्षी", "🐦 الطيور"],
  tab_mine:  ["My birds", "Мои птицы", "Mis aves", "Meus pássaros", "Mes oiseaux", "Meine Vögel", "我的鸟", "自分の鳥", "मेरे पक्षी", "طيوري"],
  tab_shop:  ["Bird market", "Птичий рынок", "Mercado", "Mercado", "Marché", "Vogelmarkt", "鸟市", "鳥市場", "पक्षी बाज़ार", "سوق الطيور"],
  birds_info:["Birds: {n} / {cap} slots. Free cannons: {f}", "Птиц: {n} / {cap} мест. Свободных пушек: {f}", "Aves: {n} / {cap}. Cañones libres: {f}", "Pássaros: {n} / {cap}. Canhões livres: {f}", "Oiseaux : {n} / {cap}. Canons libres : {f}", "Vögel: {n} / {cap}. Freie Kanonen: {f}", "鸟：{n}/{cap}。空闲大炮：{f}", "鳥：{n}/{cap}。空き大砲：{f}", "पक्षी: {n} / {cap}। ख़ाली तोपें: {f}", "الطيور: {n} / {cap}. مدافع شاغرة: {f}"],
  no_birds:  ["You have no birds! Buy some at the market.", "У вас нет птиц! Купите их на рынке.", "¡No tienes aves! Cómpralas en el mercado.", "Você não tem pássaros! Compre no mercado.", "Aucun oiseau ! Achetez-en au marché.", "Keine Vögel! Kaufe welche auf dem Markt.", "你没有鸟！去鸟市买吧。", "鳥がいない！市場で買おう。", "आपके पास पक्षी नहीं! बाज़ार से ख़रीदें।", "ليس لديك طيور! اشترِ من السوق."],
  st_cannon: ["💣 at cannon", "💣 у пушки", "💣 en cañón", "💣 no canhão", "💣 au canon", "💣 an Kanone", "💣 在炮位", "💣 砲手", "💣 तोप पर", "💣 عند المدفع"],
  st_hide:   ["🏠 hiding", "🏠 прячется", "🏠 escondida", "🏠 escondido", "🏠 cachée", "🏠 versteckt", "🏠 躲藏中", "🏠 隠れ中", "🏠 छिपा", "🏠 مختبئ"],
  st_walk:   ["🌿 strolling", "🌿 гуляет", "🌿 paseando", "🌿 passeando", "🌿 se promène", "🌿 spaziert", "🌿 散步中", "🌿 散歩中", "🌿 टहल रहा", "🌿 يتجول"],
  remove:    ["Remove", "Снять", "Quitar", "Tirar", "Retirer", "Abziehen", "撤下", "外す", "हटाएँ", "أزل"],
  to_cannon: ["To cannon", "За пушку", "Al cañón", "Ao canhão", "Au canon", "Zur Kanone", "上炮位", "砲へ", "तोप पर", "إلى المدفع"],
  release:   ["Release (+{n}🪙)", "Отпустить (+{n}🪙)", "Liberar (+{n}🪙)", "Soltar (+{n}🪙)", "Libérer (+{n}🪙)", "Freilassen (+{n}🪙)", "放生（+{n}🪙）", "放す（+{n}🪙）", "छोड़ें (+{n}🪙)", "أطلق (+{n}🪙)"],
  shop_info: ["Bought birds man free cannons on the walls. Slots: {n}/{cap}.", "Купленные птицы садятся за свободные пушки на стенах. Мест: {n}/{cap}.", "Las aves compradas manejan cañones libres. Plazas: {n}/{cap}.", "Pássaros comprados ocupam canhões livres. Vagas: {n}/{cap}.", "Les oiseaux achetés servent les canons libres. Places : {n}/{cap}.", "Gekaufte Vögel besetzen freie Kanonen. Plätze: {n}/{cap}.", "购买的鸟会操作空闲大炮。鸟位：{n}/{cap}。", "買った鳥は空いた大砲に座る。枠：{n}/{cap}。", "ख़रीदे पक्षी ख़ाली तोपें सँभालते हैं। जगह: {n}/{cap}।", "الطيور المشتراة تدير المدافع الشاغرة. الأماكن: {n}/{cap}."],
  shop_rare: [" Rare birds unlock with the “Bird Market”.", " Редкие птицы — после постройки «Птичьего рынка».", " Las aves raras requieren el «Mercado de aves».", " Pássaros raros exigem o «Mercado de pássaros».", " Oiseaux rares avec le « Marché aux oiseaux ».", " Seltene Vögel mit dem „Vogelmarkt“.", " 稀有鸟需建造“鸟市”。", " 珍しい鳥は「鳥市場」で解放。", " दुर्लभ पक्षी “पक्षी बाज़ार” से खुलते हैं।", " الطيور النادرة تتطلب «سوق الطيور»."],
  need_market:["🔒 Requires the Bird Market", "🔒 Нужен Птичий рынок", "🔒 Requiere el Mercado de aves", "🔒 Requer o Mercado de pássaros", "🔒 Nécessite le Marché aux oiseaux", "🔒 Benötigt den Vogelmarkt", "🔒 需要鸟市", "🔒 鳥市場が必要", "🔒 पक्षी बाज़ार चाहिए", "🔒 يتطلب سوق الطيور"],

  // ----- сообщения игры -----
  no_pick_yet:    ["No pickaxe yet — craft one in the workshop", "Кирки пока нет — сделайте её в мастерской", "Aún no hay pico — fabrícalo en el taller", "Ainda sem picareta — faça na oficina", "Pas encore de pioche — fabriquez-la à l'atelier", "Noch keine Spitzhacke — in der Werkstatt bauen", "还没有镐，去工坊制作", "ツルハシがない — 工房で作ろう", "अभी कुदाल नहीं — कार्यशाला में बनाएँ", "لا معول بعد — اصنعه في الورشة"],
  destroyed:      ["{name} destroyed!", "{name}: разрушено!", "¡{name} destruido!", "{name} destruído!", "{name} détruit !", "{name} zerstört!", "{name}被摧毁！", "{name}が壊された！", "{name} नष्ट!", "دُمّر {name}!"],
  not_enough:     ["Not enough resources: ", "Не хватает ресурсов: ", "Faltan recursos: ", "Recursos insuficientes: ", "Ressources insuffisantes : ", "Nicht genug Rohstoffe: ", "资源不足：", "資源が足りない：", "संसाधन कम हैं: ", "موارد غير كافية: "],
  storage_full:   ["Storage full!", "Склад полон!", "¡Almacén lleno!", "Armazém cheio!", "Entrepôt plein !", "Lager voll!", "仓库已满！", "倉庫がいっぱい！", "गोदाम भरा!", "المخزن ممتلئ!"],
  takes_cannon:   ["{name} takes the cannon!", "{name} садится за пушку!", "¡{name} toma el cañón!", "{name} assume o canhão!", "{name} prend le canon !", "{name} übernimmt die Kanone!", "{name}登上炮位！", "{name}が砲につく！", "{name} तोप सँभालता है!", "{name} يتولى المدفع!"],
  need_market_t:  ["You need the “Bird Market” for this bird", "Нужен «Птичий рынок» для этой птицы", "Necesitas el «Mercado de aves»", "Precisa do «Mercado de pássaros»", "Il faut le « Marché aux oiseaux »", "Dafür brauchst du den „Vogelmarkt“", "需要“鸟市”才能购买", "この鳥には「鳥市場」が必要", "इस पक्षी के लिए “पक्षी बाज़ार” चाहिए", "تحتاج «سوق الطيور» لهذا الطائر"],
  no_slots:       ["No room! Build a birdhouse or an aviary", "Нет мест! Постройте скворечник или птичник", "¡Sin sitio! Construye una casita o pajarera", "Sem vagas! Construa casinha ou viveiro", "Plus de place ! Construisez un nichoir ou une volière", "Kein Platz! Baue ein Vogelhaus oder eine Voliere", "没有空位！建造鸟屋或鸟舍", "空きがない！巣箱か鳥小屋を建てよう", "जगह नहीं! पक्षी घर या पक्षीशाला बनाएँ", "لا مكان! ابنِ بيت طيور أو قفصًا"],
  bought:         ["Bought: {name}!", "Куплено: {name}!", "Comprado: {name}!", "Comprado: {name}!", "Acheté : {name} !", "Gekauft: {name}!", "已购买：{name}！", "購入：{name}！", "ख़रीदा: {name}!", "تم الشراء: {name}!"],
  birds_hide:     ["Birds are hiding from the beasts!", "Птицы прячутся от врагов!", "¡Las aves se esconden!", "Os pássaros se escondem!", "Les oiseaux se cachent !", "Die Vögel verstecken sich!", "鸟儿躲起来了！", "鳥たちが隠れた！", "पक्षी छिप रहे हैं!", "الطيور تختبئ!"],
  bird_died:      ["A bird was lost: {name}!", "Погибла птица: {name}!", "¡Ave perdida: {name}!", "Pássaro perdido: {name}!", "Oiseau perdu : {name} !", "Vogel verloren: {name}!", "失去了一只鸟：{name}！", "鳥がやられた：{name}！", "पक्षी खो गया: {name}!", "فُقد طائر: {name}!"],
  wave_start:     ["🐺 Wave {n}! The beasts attack!", "🐺 Волна {n}! Звери нападают!", "🐺 ¡Oleada {n}! ¡Atacan las bestias!", "🐺 Onda {n}! As feras atacam!", "🐺 Vague {n} ! Les bêtes attaquent !", "🐺 Welle {n}! Die Tiere greifen an!", "🐺 第{n}波！野兽来袭！", "🐺 ウェーブ{n}！獣の襲撃！", "🐺 लहर {n}! जानवरों का हमला!", "🐺 الموجة {n}! الوحوش تهاجم!"],
  wave_banner:    ["WAVE {n}", "ВОЛНА {n}", "OLEADA {n}", "ONDA {n}", "VAGUE {n}", "WELLE {n}", "第{n}波", "ウェーブ{n}", "लहर {n}", "الموجة {n}"],
  boss_appears:   ["⚠️ BOSS: {name}!{desc}", "⚠️ БОСС: {name}!{desc}", "⚠️ JEFE: {name}!{desc}", "⚠️ CHEFE: {name}!{desc}", "⚠️ BOSS : {name} !{desc}", "⚠️ BOSS: {name}!{desc}", "⚠️ 首领：{name}！{desc}", "⚠️ ボス：{name}！{desc}", "⚠️ बॉस: {name}!{desc}", "⚠️ زعيم: {name}!{desc}"],
  boss_banner:    ["BOSS!", "БОСС!", "¡JEFE!", "CHEFE!", "BOSS !", "BOSS!", "首领！", "ボス！", "बॉस!", "زعيم!"],
  wave_done:      ["✅ Wave {n} repelled! +{c} 🪙", "✅ Волна {n} отбита! +{c} 🪙", "✅ ¡Oleada {n} superada! +{c} 🪙", "✅ Onda {n} repelida! +{c} 🪙", "✅ Vague {n} repoussée ! +{c} 🪙", "✅ Welle {n} abgewehrt! +{c} 🪙", "✅ 第{n}波已击退！+{c} 🪙", "✅ ウェーブ{n}撃退！+{c} 🪙", "✅ लहर {n} रोकी! +{c} 🪙", "✅ صُدّت الموجة {n}! +{c} 🪙"],
  howl:           ["Awoo!", "Ау-у-у!", "¡Auuu!", "Auuu!", "Aouuu !", "Auuu!", "嗷呜！", "アオーン！", "आऊ-ऊ!", "عووو!"],
  flees:          ["Runs away!", "Убегает!", "¡Huye!", "Foge!", "S'enfuit !", "Flieht!", "逃跑了！", "逃げた！", "भागा!", "يهرب!"],
  boss_down:      ["🏆 Boss defeated: {name}!", "🏆 Босс повержен: {name}!", "🏆 Jefe vencido: {name}!", "🏆 Chefe derrotado: {name}!", "🏆 Boss vaincu : {name} !", "🏆 Boss besiegt: {name}!", "🏆 击败首领：{name}！", "🏆 ボス撃破：{name}！", "🏆 बॉस हारा: {name}!", "🏆 هُزم الزعيم: {name}!"],
  crit:           ["CRIT!", "КРИТ!", "¡CRÍTICO!", "CRÍTICO!", "CRITIQUE !", "KRIT!", "暴击！", "会心！", "क्रिट!", "حرجة!"],
  you_down:       ["You're wounded! Back to base in 5 s…", "Вы ранены! Возвращение на базу через 5 сек…", "¡Herido! Vuelves a la base en 5 s…", "Ferido! Volta à base em 5 s…", "Blessé ! Retour à la base dans 5 s…", "Verwundet! Zurück zur Basis in 5 s…", "你受伤了！5秒后返回基地…", "負傷！5秒後に基地へ…", "आप घायल! 5 से. में बेस पर…", "أُصبت! العودة للقاعدة خلال 5 ث…"],
  need_pick:      ["You need a pickaxe! Build a workshop and craft one.", "Нужна кирка! Постройте мастерскую и сделайте её.", "¡Necesitas un pico! Construye un taller.", "Precisa de picareta! Construa uma oficina.", "Il faut une pioche ! Construisez un atelier.", "Du brauchst eine Spitzhacke! Baue eine Werkstatt.", "需要镐！建造工坊并制作。", "ツルハシが必要！工房で作ろう。", "कुदाल चाहिए! कार्यशाला बनाएँ।", "تحتاج معولًا! ابنِ ورشة."],
  need_pick2:     ["Iron needs an improved pickaxe", "Для железа нужна улучшенная кирка", "El hierro requiere un pico mejorado", "Ferro exige picareta melhorada", "Le fer exige une pioche améliorée", "Eisen braucht eine bessere Spitzhacke", "铁需要改良镐", "鉄には改良ツルハシが必要", "लोहे के लिए बेहतर कुदाल चाहिए", "الحديد يحتاج معولًا محسّنًا"],
  back_in_action: ["Back in action!", "Вы снова в строю!", "¡De vuelta en acción!", "De volta à ação!", "De retour !", "Wieder im Einsatz!", "重新出发！", "復活！", "फिर से तैयार!", "عُدت للمعركة!"],
  exhausted:      ["Out of breath! Rest a little", "Выдохся! Отдохните немного", "¡Sin aliento! Descansa", "Sem fôlego! Descanse", "À bout de souffle ! Reposez-vous", "Außer Atem! Kurz ausruhen", "喘不过气了！休息一下", "息切れ！少し休もう", "साँस फूल गई! आराम करें", "انقطع نفسك! استرح قليلًا"],
  need_food:      ["You need 3 🍖", "Нужно 3 🍖", "Necesitas 3 🍖", "Precisa de 3 🍖", "Il faut 3 🍖", "Du brauchst 3 🍖", "需要3 🍖", "🍖が3必要", "3 🍖 चाहिए", "تحتاج 3 🍖"],
  hp_full:        ["Health is already full", "Здоровье уже полное", "La salud ya está llena", "A vida já está cheia", "Santé déjà pleine", "Leben ist schon voll", "生命已满", "体力は満タン", "स्वास्थ्य पहले से पूरा", "الصحة ممتلئة"],
  need_tech_t:    ["Requires the “{name}” technology", "Нужна технология «{name}»", "Requiere la tecnología «{name}»", "Requer a tecnologia «{name}»", "Nécessite la technologie « {name} »", "Benötigt die Technologie „{name}“", "需要科技“{name}”", "技術「{name}」が必要", "“{name}” तकनीक चाहिए", "يتطلب تقنية «{name}»"],
  need_tech_ws:   ["Requires the “{name}” technology (workshop)", "Нужна технология «{name}» (мастерская)", "Requiere «{name}» (taller)", "Requer «{name}» (oficina)", "Nécessite « {name} » (atelier)", "Benötigt „{name}“ (Werkstatt)", "需要科技“{name}”（工坊）", "技術「{name}」が必要（工房）", "“{name}” तकनीक चाहिए (कार्यशाला)", "يتطلب «{name}» (الورشة)"],
  upgraded:       ["Upgraded: {name}", "Улучшено: {name}", "Mejorado: {name}", "Melhorado: {name}", "Amélioré : {name}", "Verbessert: {name}", "已升级：{name}", "強化：{name}", "बढ़ाया: {name}", "تم التطوير: {name}"],
  repaired:       ["Repaired!", "Отремонтировано!", "¡Reparado!", "Consertado!", "Réparé !", "Repariert!", "已修复！", "修理完了！", "मरम्मत हो गई!", "تم الإصلاح!"],
  build_ws_first: ["Build a workshop first", "Сначала постройте мастерскую", "Primero construye un taller", "Construa uma oficina primeiro", "Construisez d'abord un atelier", "Baue zuerst eine Werkstatt", "先建造工坊", "まず工房を建てよう", "पहले कार्यशाला बनाएँ", "ابنِ ورشة أولًا"],
  crafted:        ["Crafted: {name}!", "Создано: {name}!", "¡Fabricado: {name}!", "Fabricado: {name}!", "Fabriqué : {name} !", "Hergestellt: {name}!", "已制作：{name}！", "作成：{name}！", "बनाया: {name}!", "تم الصنع: {name}!"],
  research_first: ["Research “{name}” first", "Сначала изучите «{name}»", "Primero investiga «{name}»", "Pesquise «{name}» primeiro", "Recherchez d'abord « {name} »", "Erforsche zuerst „{name}“", "先研究“{name}”", "先に「{name}」を研究", "पहले “{name}” सीखें", "ابحث «{name}» أولًا"],
  researched:     ["Researched: {name}!", "Изучено: {name}!", "¡Investigado: {name}!", "Pesquisado: {name}!", "Recherché : {name} !", "Erforscht: {name}!", "已研究：{name}！", "研究完了：{name}！", "सीख लिया: {name}!", "تم البحث: {name}!"],
  limit_t:        ["Limit: {name} — max {n}", "Лимит: {name} — максимум {n} шт.", "Límite: {name} — máx. {n}", "Limite: {name} — máx. {n}", "Limite : {name} — max {n}", "Limit: {name} — max. {n}", "上限：{name}最多{n}个", "上限：{name}は最大{n}", "सीमा: {name} — अधिकतम {n}", "الحد: {name} — بحد أقصى {n}"],
  limit_done:     ["Max built: {name} {n}/{n}", "Построено максимум: {name} {n}/{n}", "Máximo construido: {name} {n}/{n}", "Máximo construído: {name} {n}/{n}", "Maximum construit : {name} {n}/{n}", "Maximum gebaut: {name} {n}/{n}", "已达上限：{name} {n}/{n}", "最大数建設：{name} {n}/{n}", "अधिकतम बने: {name} {n}/{n}", "بُني الحد الأقصى: {name} {n}/{n}"],
  occupied:       ["Space occupied", "Место занято", "Espacio ocupado", "Espaço ocupado", "Place occupée", "Platz belegt", "位置被占用", "場所がふさがっている", "जगह भरी है", "المكان مشغول"],
  blocked_by:     ["Blocked by a {name}", "Мешает: {name}", "Lo bloquea: {name}", "Bloqueado por: {name}", "Bloqué par : {name}", "Blockiert durch: {name}", "被挡住：{name}", "じゃま：{name}", "रुकावट: {name}", "يعيقه: {name}"],
  in_water:       ["Can't build in water", "Нельзя строить в воде", "No se puede construir en el agua", "Não dá para construir na água", "Impossible de bâtir dans l'eau", "Nicht im Wasser bauen", "不能建在水中", "水の中には建てられない", "पानी में नहीं बना सकते", "لا يمكن البناء في الماء"],
  too_steep:      ["Too steep", "Слишком круто", "Demasiado empinado", "Muito íngreme", "Trop en pente", "Zu steil", "太陡了", "急すぎる", "बहुत ढलान", "شديد الانحدار"],
  too_far:        ["Too far", "Слишком далеко", "Demasiado lejos", "Muito longe", "Trop loin", "Zu weit", "太远了", "遠すぎる", "बहुत दूर", "بعيد جدًا"],
  step_away:      ["Step away", "Отойдите", "Aléjate", "Afaste-se", "Reculez", "Geh zurück", "请走开", "離れて", "हटें", "ابتعد"],
  quarry_only:    ["Quarry only (follow the arrow)", "Только в карьере (по стрелке)", "Solo en la cantera (sigue la flecha)", "Só na pedreira (siga a seta)", "Seulement dans la carrière (flèche)", "Nur im Steinbruch (Pfeil)", "只能在采石场（看箭头）", "採石場のみ（矢印へ）", "सिर्फ़ खदान में (तीर देखें)", "في المحجر فقط (اتبع السهم)"],
  standing_here:  ["You're standing there", "Вы стоите на месте", "Estás encima", "Você está em cima", "Vous êtes dessus", "Du stehst dort", "你站在这里", "そこに立っている", "आप वहाँ खड़े हैं", "أنت تقف هنا"],
  cant_build:     ["You can't build here", "Здесь нельзя строить", "No se puede construir aquí", "Não dá para construir aqui", "Impossible de bâtir ici", "Hier kann man nicht bauen", "此处无法建造", "ここには建てられない", "यहाँ नहीं बना सकते", "لا يمكن البناء هنا"],
  buy_for_cannon: ["Buy a bird to man the cannon (🐦)", "Купите птицу, чтобы она села за пушку (🐦)", "Compra un ave para el cañón (🐦)", "Compre um pássaro para o canhão (🐦)", "Achetez un oiseau pour le canon (🐦)", "Kaufe einen Vogel für die Kanone (🐦)", "购买鸟来操作大炮（🐦）", "大砲用に鳥を買おう（🐦）", "तोप के लिए पक्षी ख़रीदें (🐦)", "اشترِ طائرًا للمدفع (🐦)"],
  quest_done:     ["🏆 Quest complete: {q} (+{r} 🪙)", "🏆 Задание выполнено: {q} (+{r} 🪙)", "🏆 Misión cumplida: {q} (+{r} 🪙)", "🏆 Missão cumprida: {q} (+{r} 🪙)", "🏆 Quête réussie : {q} (+{r} 🪙)", "🏆 Aufgabe erledigt: {q} (+{r} 🪙)", "🏆 完成任务：{q}（+{r} 🪙）", "🏆 クエスト達成：{q}（+{r} 🪙）", "🏆 काम पूरा: {q} (+{r} 🪙)", "🏆 أُنجزت المهمة: {q} (+{r} 🪙)"],
  new_day:        ["☀️ Day {n}", "☀️ День {n}", "☀️ Día {n}", "☀️ Dia {n}", "☀️ Jour {n}", "☀️ Tag {n}", "☀️ 第{n}天", "☀️ {n}日目", "☀️ दिन {n}", "☀️ اليوم {n}"],
  saved:          ["💾 Game saved", "💾 Игра сохранена", "💾 Partida guardada", "💾 Jogo salvo", "💾 Partie sauvegardée", "💾 Spiel gespeichert", "💾 已保存", "💾 セーブしました", "💾 खेल सेव हुआ", "💾 تم الحفظ"],
  save_fail:      ["Couldn't save", "Не удалось сохранить", "No se pudo guardar", "Não foi possível salvar", "Échec de la sauvegarde", "Speichern fehlgeschlagen", "保存失败", "セーブできませんでした", "सेव नहीं हुआ", "تعذّر الحفظ"],
  gear_bought:    ["Bought: {name}!", "Куплено: {name}!", "¡Comprado: {name}!", "Comprado: {name}!", "Acheté : {name} !", "Gekauft: {name}!", "已购买：{name}！", "購入：{name}！", "ख़रीदा: {name}!", "تم الشراء: {name}!"],
};

// ----- движок -----
const LANG_IDX = { en: 0, ru: 1, es: 2, pt: 3, fr: 4, de: 5, zh: 6, ja: 7, hi: 8, ar: 9 };
let LANG = 'en';
function tr(key, vars) {
  const row = TR_UI[key] || TR_DATA[key];
  let s = row ? (row[LANG_IDX[LANG]] || row[0]) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
// Переводит названия и описания в игровых таблицах
function applyDataLang() {
  for (const k in RES_INFO) RES_INFO[k].name = tr('r.' + k);
  for (const k in BIRDS) { BIRDS[k].name = tr('b.' + k); BIRDS[k].desc = tr('bd.' + k); }
  for (const k in HEROES) { HEROES[k].name = tr('h.' + k); HEROES[k].desc = tr('hd.' + k); HEROES[k].perk = tr('hp.' + k); }
  for (const k in ENEMIES) { ENEMIES[k].name = tr('e.' + k); if (TR_DATA['ed.' + k]) ENEMIES[k].desc = tr('ed.' + k); }
  for (const k in BUILD) { BUILD[k].name = tr('B.' + k); BUILD[k].desc = tr('Bd.' + k); }
  BUILD_CATS.forEach(c => c[1] = tr('cat.' + c[0]));
  WALL_LEVELS.forEach((l, i) => l.name = tr('wl' + (i + 1)));
  CANNON_LEVELS.forEach((l, i) => l.name = tr('cl' + (i + 1)));
  GATE_LEVELS.forEach((l, i) => l.name = tr('gl' + (i + 1)));
  BALLISTA_LEVELS.forEach((l, i) => l.name = tr('bl' + (i + 1)));
  SHAFT_LEVELS.forEach((l, i) => l.name = tr('sl' + (i + 1)));
  for (const k in TECH) { TECH[k].name = tr('t.' + k); TECH[k].desc = tr('td.' + k); }
  AXES.forEach((a, i) => a.name = tr('ax' + i));
  PICKS.forEach((a, i) => a.name = tr('pk' + i));
  for (const k in NODE_INFO) NODE_INFO[k].name = tr('n.' + k);
  for (const k in GEAR) { GEAR[k].name = tr('g.' + k); GEAR[k].desc = tr('gd.' + k); }
  if (typeof ARMOR !== 'undefined') for (const k in ARMOR) { ARMOR[k].name = tr('a.' + k); ARMOR[k].desc = tr('ad.' + k); }
  for (const k in DIFFICULTY) { DIFFICULTY[k].name = tr('d.' + k); DIFFICULTY[k].desc = tr('dd.' + k); }
  QUESTS.forEach((q, i) => q.text = tr('q' + i));
  if (typeof World !== 'undefined' && World.BIOMES) World.BIOMES.forEach(b => b.name = tr('bio.' + b.id));
}
function setLang(id) {
  LANG = LANG_IDX[id] !== undefined ? id : 'en';
  document.documentElement.lang = LANG;
  applyDataLang();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = tr(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = tr(el.dataset.i18nTitle); });
  document.title = tr('title');
}
