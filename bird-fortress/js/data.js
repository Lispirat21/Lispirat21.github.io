'use strict';
// ============ Игровые данные: птицы, герои, враги, постройки, инструменты ============

const RES_INFO = {
  wood:  { name: 'Дерево',  icon: '🪵' },
  stone: { name: 'Камень',  icon: '🪨' },
  iron:  { name: 'Железо',  icon: '🔩' },
  coal:  { name: 'Уголь',   icon: "<svg class=\"rico\" viewBox=\"0 0 24 24\"><path d=\"M3 15 6 7l6-3 7 3 2 8-5 5H8z\" fill=\"#2b2d33\" stroke=\"#b8bec8\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><path d=\"M6 7l6-3 7 3-6 3z\" fill=\"#5a5e68\"/><path d=\"M12 10l7-3 2 8-7 1z\" fill=\"#3c3f47\"/><path d=\"M3 15l3-8 6 3 2 6-6 4z\" fill=\"#1c1d21\"/><path d=\"M9 6.5l2.5-1M15 6l2 .8M5.5 11l1-2\" stroke=\"#c8ccd6\" stroke-width=\"1.1\" stroke-linecap=\"round\"/></svg>" },
  food:  { name: 'Еда',     icon: '🍖' },
  coins: { name: 'Монеты',  icon: '🪙' },
};

// Птицы. dmg/rate/range — множители для пушки, за которой сидит птица.
const BIRDS = {
  sparrow:    { name: 'Луговой воробей', price: 25,  food: 2,  hp: 20, dmg: 0.8, rate: 1.2,  range: 1.0,  size: 0.75, market: false, desc: 'Дешёвый и шустрый стрелок.' },
  tit:        { name: 'Большая синица',  price: 35,  food: 2,  hp: 20, dmg: 0.75,rate: 1.45, range: 1.0,  size: 0.7,  market: false, desc: 'Очень быстро перезаряжает пушку.' },
  bullfinch:  { name: 'Снегирь',         price: 50,  food: 3,  hp: 25, dmg: 0.9, rate: 1.0,  range: 1.05, size: 0.8,  market: false, special: 'slow',   desc: 'Ледяные ядра замедляют врагов.' },
  guinea:     { name: 'Цесарка',         price: 60,  food: 4,  hp: 35, dmg: 1.0, rate: 1.3,  range: 1.0,  size: 1.0,  market: false, desc: 'Надёжный стрелок с быстрой стрельбой.' },
  woodpecker: { name: 'Дятел',           price: 75,  food: 3,  hp: 25, dmg: 1.0, rate: 1.1,  range: 1.05, size: 0.8,  market: true,  special: 'crit',   desc: '25% шанс критического удара ×2.5.' },
  loon:       { name: 'Гагара',          price: 90,  food: 5,  hp: 40, dmg: 1.1, rate: 1.0,  range: 1.45, size: 1.05, market: true,  desc: 'Зоркая птица: сильно увеличивает дальность.' },
  turkey:     { name: 'Индюк',           price: 120, food: 8,  hp: 70, dmg: 1.8, rate: 0.75, range: 1.0,  size: 1.35, market: true,  special: 'splash', desc: 'Тяжёлые ядра с большим взрывом.' },
  owl:        { name: 'Филин',           price: 150, food: 6,  hp: 45, dmg: 1.2, rate: 1.0,  range: 1.25, size: 1.0,  market: true,  special: 'night',  desc: 'Ночью урон ×1.7.' },
  parrot:     { name: 'Ара',             price: 200, food: 6,  hp: 40, dmg: 1.1, rate: 1.1,  range: 1.1,  size: 0.95, market: true,  special: 'double', desc: 'Стреляет двумя ядрами сразу.' },
  eagle:      { name: 'Беркут',          price: 300, food: 10, hp: 80, dmg: 2.4, rate: 1.1,  range: 1.3,  size: 1.2,  market: true,  desc: 'Король неба. Огромный урон.' },
};
const BIRD_ORDER = ['sparrow', 'tit', 'bullfinch', 'guinea', 'woodpecker', 'loon', 'turkey', 'owl', 'parrot', 'eagle'];

const HEROES = {
  defender: { stamina: 100, name: 'Лесной защитник', hp: 125, speed: 6.0, dmg: 18, atkRate: 1.7, gather: 1.0,  buildMul: 1.0,  coinMul: 1.0,
              perk: 'Пушки бьют на 15% сильнее. Восстанавливает здоровье быстрее.', desc: 'Сбалансированный боец. Щит за спиной и зелёный плащ.' },
  builder:  { stamina: 85, name: 'Сильный строитель', hp: 155, speed: 5.3, dmg: 15, atkRate: 1.4, gather: 1.35, buildMul: 0.75, coinMul: 1.0,
              perk: 'Постройки и улучшения дешевле на 25%. Добыча +35%.', desc: 'Крепкий мастер в каске. Строит быстро и дёшево.' },
  hunter:   { stamina: 140, name: 'Быстрый охотник', hp: 95, speed: 7.5, dmg: 24, atkRate: 2.3, gather: 1.0,  buildMul: 1.0,  coinMul: 1.5,
              perk: 'Самый быстрый. +50% монет за победу над зверями.', desc: 'Ловкий следопыт с колчаном и шляпой с пером.' },
};
const HERO_ORDER = ['defender', 'builder', 'hunter'];

const ENEMIES = {
  wolf:    { name: 'Волк',          hp: 45,  speed: 4.3, dmg: 7,  rate: 1.0, coins: 5,  food: 0, radius: 0.6, size: 1.0,  wave: 1 },
  fox:     { name: 'Лиса',          hp: 28,  speed: 5.2, dmg: 5,  rate: 1.2, coins: 4,  food: 0, radius: 0.5, size: 0.8,  wave: 1 },
  boar:    { name: 'Кабан',         hp: 80,  speed: 3.7, dmg: 13, rate: 0.9, coins: 6,  food: 4, radius: 0.7, size: 1.0,  wave: 2 },
  bear:    { name: 'Медведь',       hp: 210, speed: 2.7, dmg: 26, rate: 0.7, coins: 15, food: 6, radius: 1.0, size: 1.5,  wave: 4 },
  lynx:    { name: 'Рысь',          hp: 60,  speed: 5.6, dmg: 10, rate: 1.3, coins: 8,  food: 0, radius: 0.55,size: 0.95, wave: 6 },
  raccoon:   { name: 'Енот-воришка',  hp: 35,  speed: 5.4, dmg: 5,  rate: 1.4, coins: 6,  food: 0, radius: 0.5, size: 0.8,  wave: 3 },
  wolverine: { name: 'Росомаха',      hp: 140, speed: 4.0, dmg: 18, rate: 1.1, coins: 12, food: 0, radius: 0.7, size: 1.0,  wave: 7 },
  elk:       { name: 'Бешеный лось',  hp: 260, speed: 3.6, dmg: 32, rate: 0.6, coins: 18, food: 8, radius: 1.0, size: 1.6,  wave: 9 },
  // боссы: приходят каждую 5-ю волну по очереди
  monster:   { name: 'Лесное чудище',   hp: 900,  speed: 2.1, dmg: 55, rate: 0.6, coins: 70,  food: 0,  radius: 1.6, size: 2.4, wave: 5,  boss: true },
  alpha:     { name: 'Вожак стаи',      hp: 1300, speed: 4.2, dmg: 45, rate: 1.1, coins: 110, food: 0,  radius: 1.3, size: 2.0, wave: 10, boss: true, desc: 'Призывает волков' },
  bearking:  { name: 'Медведь-великан', hp: 2600, speed: 2.2, dmg: 120,rate: 0.5, coins: 160, food: 20, radius: 2.0, size: 3.2, wave: 15, boss: true, desc: 'Ломает стены с одного удара' },
  treant:    { name: 'Древень',         hp: 3800, speed: 1.6, dmg: 80, rate: 0.6, coins: 220, food: 0,  radius: 2.0, size: 3.6, wave: 20, boss: true, desc: 'Восстанавливает здоровье' },
};

// Стены по уровням
const WALL_LEVELS = [
  { name: 'Деревянная стена',          hp: 260,  h: 2.3, cost: { wood: 10 } },
  { name: 'Укреплённая деревянная',    hp: 400,  h: 2.5, cost: { wood: 20 } },
  { name: 'Каменная стена',            hp: 700,  h: 2.8, cost: { stone: 20, wood: 5 },  req: 'stone' },
  { name: 'Усиленная каменная',        hp: 1100, h: 3.0, cost: { stone: 35, wood: 10 }, req: 'stone' },
  { name: 'Мощная крепостная стена',   hp: 1700, h: 3.4, cost: { stone: 40, iron: 15 }, req: 'metal' },
];
const CANNON_LEVELS = [
  { name: 'Простая пушка',            dmg: 14, rate: 0.6, range: 17, splash: 2.0, cost: { wood: 20, coins: 20 } },
  { name: 'Усиленная пушка',          dmg: 20, rate: 0.8, range: 19, splash: 2.2, cost: { wood: 30, coins: 30 } },
  { name: 'Бронзовая двуствольная',   dmg: 28, rate: 1.0, range: 21, splash: 2.5, cost: { stone: 25, iron: 5, coins: 60 }, req: 'stone' },
  { name: 'Автоматическая пушка',     dmg: 22, rate: 2.6, range: 23, splash: 1.6, cost: { iron: 15, coal: 10, coins: 100 }, req: 'mech' },
  { name: 'Тяжёлый автомат',          dmg: 34, rate: 3.2, range: 26, splash: 2.0, cost: { iron: 30, coal: 20, coins: 200 }, req: 'mech' },
];

// Постройки. size = [ширина по X, глубина по Z] при повороте 0
const BOSS_ORDER = ['monster', 'alpha', 'bearking', 'treant'];
const BUILD = {
  fence:      { name: 'Забор',              cat: 'walls',   cost: { wood: 4 },              hp: 90,   size: [4, 0.5], icon: '🚧', desc: 'Дешёвое ограждение.' },
  wall:       { name: 'Стена',              cat: 'walls',   cost: { wood: 10 },             hp: 220,  size: [4, 1],   icon: '🧱', desc: 'Улучшается до 5 уровня. На стену можно поставить пушку.' },
  tower:      { name: 'Деревянная вышка',   cat: 'towers',  cost: { wood: 25 },             hp: 300,  size: [2.6, 2.6], icon: '🗼', desc: 'Сама стреляет стрелами по врагам.', dmg: 8, rate: 1.1, range: 18 },
  stonetower: { name: 'Каменная башня',     cat: 'towers',  cost: { stone: 30, wood: 10 },  hp: 900,  size: [3, 3],   icon: '🏰', desc: 'Прочная башня с дальним обстрелом.', dmg: 15, rate: 1.2, range: 23, req: 'stone' },
  gate:       { name: 'Ворота',             cat: 'gates',   cost: { wood: 15 },             hp: 320,  size: [4, 1],   icon: '🚪', desc: 'Вы проходите, враги — нет.' },
  stonegate:  { name: 'Каменные ворота',    cat: 'gates',   cost: { stone: 25, wood: 8 },   hp: 950,  size: [4, 1.4], icon: '⛩️', desc: 'Очень прочные ворота.', req: 'stone' },
  birdhouse:  { name: 'Скворечник',         cat: 'houses',  cost: { wood: 12 },             hp: 120,  size: [1.6, 1.6], icon: '🏠', desc: '+3 места для птиц. Птицы прячутся тут.', cap: 3 },
  aviary:     { name: 'Птичник',            cat: 'houses',  cost: { wood: 30, stone: 10 },  hp: 350,  size: [3.4, 3.4], icon: '🏡', desc: '+6 мест для птиц.', cap: 6 },
  lantern:    { name: 'Фонарь',             cat: 'light',   cost: { wood: 6 },              hp: 80,   size: [0.8, 0.8], icon: '🏮', desc: 'Освещает базу ночью. Птицы любят на нём сидеть.' },
  torch:      { name: 'Большой фонарь',     cat: 'light',   cost: { wood: 10, coal: 2 },    hp: 150,  size: [1.2, 1.2], icon: '🔥', desc: 'Яркий угольный фонарь: светит дальше и сильнее.' },
  market:     { name: 'Птичий рынок',       cat: 'houses',  cost: { wood: 35, coins: 20 },  hp: 300,  size: [3.6, 2.6], icon: '🎪', desc: 'Открывает редких птиц для покупки.', unique: true },
  cannon:     { name: 'Пушка',              cat: 'defense', cost: { wood: 20, coins: 20 },  hp: 260,  size: [2.4, 2.4], icon: '💣', desc: 'Ставится на стену или на вышку. За пушку садится птица.' },
  spikes:     { name: 'Шипы',               cat: 'defense', cost: { wood: 8 },              hp: 120,  size: [2, 2],   icon: '📍', desc: 'Ранят зверей, которые по ним проходят.' },
  ballista:   { name: 'Авто-баллиста',      cat: 'defense', cost: { wood: 20, iron: 12, coal: 5 }, hp: 400, size: [2.4, 2.4], icon: '🏹', desc: 'Автоматический механизм. Мощные болты.', dmg: 45, rate: 0.7, range: 26, req: 'mech' },
  storage:    { name: 'Склад',              cat: 'prod',    cost: { wood: 30 },             hp: 300,  size: [3.4, 2.6], icon: '📦', desc: '+150 к вместимости ресурсов.' },
  workshop:   { name: 'Мастерская',         cat: 'prod',    cost: { wood: 40 },             hp: 350,  size: [3.6, 3],   icon: '⚒️', desc: 'Инструменты и технологии.', unique: true },
  farm:       { name: 'Ферма',              cat: 'prod',    cost: { wood: 25 },             hp: 200,  size: [4, 4],   icon: '🌾', desc: 'Производит еду.' },
  minelift:   { name: 'Шахтный подъёмник',  cat: 'prod',    cost: { wood: 40, stone: 20 },  hp: 400,  size: [3, 3],   icon: '⛏️', desc: 'Ставится в карьере. Сам добывает камень, уголь и железо.', req: 'stone' },
  core:       { name: 'Великое гнездо',     cat: 'none',    cost: {},                       hp: 1200, size: [5, 5],   icon: '🪺', desc: 'Сердце базы. Если его разрушат — игра окончена.' },
};
const BUILD_CATS = [
  ['walls', 'Стены'], ['towers', 'Башни'], ['gates', 'Ворота'], ['houses', 'Домики'], ['light', 'Освещение'], ['defense', 'Оборона'], ['prod', 'Производство'],
];

const TECH = {
  stone: { name: 'Каменное дело', cost: { wood: 40, stone: 15 },            desc: 'Каменные стены (ур.3–4), башни, ворота, подъёмник, пушки ур.3.' },
  metal: { name: 'Металлургия',   cost: { stone: 40, iron: 10, coal: 10 },  desc: 'Стены ур.5, железные инструменты.', need: 'stone' },
  mech:  { name: 'Механизмы',     cost: { iron: 25, coal: 15, coins: 100 }, desc: 'Автоматические пушки (ур.4–5) и авто-баллиста.', need: 'metal' },
};

const AXES = [
  { name: 'Деревянный топор', power: 1 },
  { name: 'Каменный топор',   power: 2,   cost: { wood: 15, stone: 10 } },
  { name: 'Железный топор',   power: 3.5, cost: { wood: 15, iron: 10, coal: 5 }, req: 'metal' },
];
const PICKS = [
  { name: 'Кирка',            power: 1,   cost: { wood: 20 } },
  { name: 'Улучшенная кирка', power: 1.8, cost: { wood: 10, stone: 20 } },
  { name: 'Железная кирка',   power: 3,   cost: { iron: 12, coal: 8 }, req: 'metal' },
];

const NODE_INFO = {
  tree:  { hp: 8,  res: 'wood',  ratio: 1,   tool: 'axe',  minPick: -1, regrow: 150, name: 'Дерево' },
  stone: { hp: 10, res: 'stone', ratio: 1,   tool: 'pick', minPick: 0,  regrow: 180, name: 'Камень' },
  coal:  { hp: 9,  res: 'coal',  ratio: 1,   tool: 'pick', minPick: 0,  regrow: 220, name: 'Уголь' },
  iron:  { hp: 12, res: 'iron',  ratio: 0.6, tool: 'pick', minPick: 1,  regrow: 260, name: 'Железная руда' },
  berry: { hp: 1,  res: 'food',  ratio: 4,   tool: 'hand', minPick: -1, regrow: 70,  name: 'Ягодный куст' },
};

const QUESTS = [
  { text: 'Нарубите 10 дерева', check: s => s.stats.wood >= 10, reward: 15 },
  { text: 'Постройте новую стену или забор', check: s => s.stats.built >= 1, reward: 15 },
  { text: 'Отбейте первую волну зверей', check: s => s.wave >= 2, reward: 25 },
  { text: 'Постройте мастерскую', check: s => G.countB('workshop') > 0, reward: 20 },
  { text: 'Сделайте кирку в мастерской', check: s => s.tools.pick >= 0, reward: 15 },
  { text: 'Добудьте 10 камня (карьер на востоке)', check: s => s.stats.stone >= 10, reward: 25 },
  { text: 'Изучите «Каменное дело»', check: s => s.tech.stone, reward: 30 },
  { text: 'Улучшите стену до 3 уровня', check: s => G.maxLevel('wall') >= 3, reward: 30 },
  { text: 'Купите новую птицу', check: s => s.stats.boughtBirds >= 1, reward: 20 },
  { text: 'Улучшите пушку до 2 уровня', check: s => G.maxLevel('cannon') >= 2, reward: 30 },
  { text: 'Добудьте 5 железа в карьере', check: s => s.stats.iron >= 5, reward: 35 },
  { text: 'Изучите «Металлургию»', check: s => s.tech.metal, reward: 40 },
  { text: 'Изучите «Механизмы»', check: s => s.tech.mech, reward: 50 },
  { text: 'Продержитесь 10 волн', check: s => s.wave >= 11, reward: 100 },
];

// Уровни сложности
const DIFFICULTY = {
  easy:       { prep: 240, name: 'Лёгкая',     icon: '🌱', hp: 0.65, dmg: 0.55, count: 0.7, timer: 1.4, reward: 1.25, start: 1.5, desc: 'Звери слабые и приходят реже. Для знакомства с игрой.' },
  normal:     { prep: 180, name: 'Средняя',    icon: '🌳', hp: 1,    dmg: 1,    count: 1,   timer: 1,   reward: 1,    start: 1,   desc: 'Обычный баланс.' },
  hard:       { prep: 130, name: 'Сложная',    icon: '🔥', hp: 1.4,  dmg: 1.4,  count: 1.35,timer: 0.8, reward: 0.9,  start: 0.8, desc: 'Больше сильных зверей, меньше времени на подготовку.' },
  impossible: { prep: 90, name: 'Невозможная',icon: '💀', hp: 2.1,  dmg: 2,    count: 1.8, timer: 0.6, reward: 0.75, start: 0.6, desc: 'Огромные стаи, очень мало времени. Только для мастеров.' },
};
const DIFF_ORDER = ['easy', 'normal', 'hard', 'impossible'];
