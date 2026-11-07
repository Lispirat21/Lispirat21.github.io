'use strict';
// ============ Игровые данные: птицы, герои, враги, постройки, инструменты ============

const RES_INFO = {
  wood:  { name: 'Дерево',  icon: '🪵' },
  stone: { name: 'Камень',  icon: '🪨' },
  iron:  { name: 'Железо',  icon: '🔩' },
  coal:  { name: 'Уголь',   icon: "<svg class=\"rico\" viewBox=\"0 0 24 24\"><path d=\"M3 15 6 7l6-3 7 3 2 8-5 5H8z\" fill=\"#2b2d33\" stroke=\"#b8bec8\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><path d=\"M6 7l6-3 7 3-6 3z\" fill=\"#5a5e68\"/><path d=\"M12 10l7-3 2 8-7 1z\" fill=\"#3c3f47\"/><path d=\"M3 15l3-8 6 3 2 6-6 4z\" fill=\"#1c1d21\"/><path d=\"M9 6.5l2.5-1M15 6l2 .8M5.5 11l1-2\" stroke=\"#c8ccd6\" stroke-width=\"1.1\" stroke-linecap=\"round\"/></svg>" },
  food:  { name: 'Еда',     icon: '🍖' },
  coins: { name: 'Монеты',  icon: '🪙' },
  ruby:  { name: 'Рубины',  icon: "<svg class=\"rico\" viewBox=\"0 0 24 24\"><path d=\"M7 3h10l5 6-10 12L2 9z\" fill=\"#e0204a\" stroke=\"#7a0018\" stroke-width=\"1.3\" stroke-linejoin=\"round\"/><path d=\"M2 9h20M7 3l5 6 5-6M12 9v12\" stroke=\"#ff8aa0\" stroke-width=\"1\" fill=\"none\"/><path d=\"M7 3l-5 6h5z\" fill=\"#ff6a88\"/></svg>" },
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
  hummingbird:{ name: 'Колибри',         price: 140, food: 2,  hp: 18, dmg: 0.5, rate: 2.4,  range: 0.95, size: 0.55, market: true,  desc: 'Крошечная, но стреляет как пулемёт.' },
  flamingo:   { name: 'Фламинго',        price: 180, food: 5,  hp: 40, dmg: 1.2, rate: 0.95, range: 1.7,  size: 1.1,  market: true,  desc: 'Видит дальше всех птиц.' },
  peacock:    { name: 'Павлин',          price: 260, food: 7,  hp: 55, dmg: 1.3, rate: 1.0,  range: 1.15, size: 1.15, market: true,  special: 'stun', desc: 'Ядра оглушают зверей (25% шанс).' },
  phoenix:    { name: 'Феникс',          price: 500, food: 12, hp: 90, dmg: 2.0, rate: 1.2,  range: 1.35, size: 1.15, market: true,  special: 'burn', desc: 'Огненные ядра поджигают врагов.' },
  eagle:      { name: 'Беркут',          price: 300, food: 10, hp: 80, dmg: 2.4, rate: 1.1,  range: 1.3,  size: 1.2,  market: true,  desc: 'Король неба. Огромный урон.' },
};
const BIRD_ORDER = ['sparrow', 'tit', 'bullfinch', 'guinea', 'woodpecker', 'loon', 'hummingbird', 'turkey', 'owl', 'flamingo', 'parrot', 'peacock', 'eagle', 'phoenix'];

const HEROES = {
  defender: { stamina: 100, name: 'Лесной защитник', hp: 125, speed: 6.0, dmg: 18, atkRate: 1.7, gather: 1.0,  buildMul: 1.0,  coinMul: 1.0,
              perk: 'Пушки бьют на 15% сильнее. Восстанавливает здоровье быстрее.', desc: 'Сбалансированный боец. Щит за спиной и зелёный плащ.' },
  builder:  { stamina: 85, name: 'Сильный строитель', hp: 155, speed: 5.3, dmg: 15, atkRate: 1.4, gather: 1.35, buildMul: 0.75, coinMul: 1.0,
              perk: 'Постройки и улучшения дешевле на 25%. Добыча +35%.', desc: 'Крепкий мастер в каске. Строит быстро и дёшево.' },
  hunter:   { stamina: 140, name: 'Быстрый охотник', hp: 95, speed: 7.5, dmg: 24, atkRate: 2.3, gather: 1.0,  buildMul: 1.0,  coinMul: 1.5,
              perk: 'Самый быстрый. +50% монет за победу над зверями.', desc: 'Ловкий следопыт с колчаном и шляпой с пером.' },
};
// Платные классы (покупаются за Золотых птиц — особую валюту, которая сохраняется между прохождениями)
HEROES.knight   = { price: 3,  weapon: 'sword',  stamina: 110, name: '', hp: 210, speed: 5.4, dmg: 32, atkRate: 1.4, gather: 0.9,  buildMul: 1.0, coinMul: 1.0, armor: 0.7 };
HEROES.ranger   = { price: 5,  weapon: 'bow',    stamina: 120, name: '', hp: 100, speed: 6.8, dmg: 22, atkRate: 1.6, gather: 1.0,  buildMul: 1.0, coinMul: 1.2, bowRange: 15 };
HEROES.engineer = { price: 7,  weapon: 'wrench', stamina: 100, name: '', hp: 125, speed: 5.8, dmg: 16, atkRate: 1.6, gather: 1.1,  buildMul: 0.9, coinMul: 1.0 };
HEROES.druid    = { price: 10, weapon: 'staff',  stamina: 110, name: '', hp: 115, speed: 6.0, dmg: 18, atkRate: 1.7, gather: 1.0,  buildMul: 1.0, coinMul: 1.0 };
const HERO_ORDER = ['defender', 'builder', 'hunter', 'knight', 'ranger', 'engineer', 'druid'];
const GOAL_DAYS = 50;

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
  werewolf:  { name: 'Оборотень',     hp: 330, speed: 5.9, dmg: 32, rate: 1.3, coins: 22, food: 0,  radius: 0.8, size: 1.3, wave: 21 },
  direboar:  { name: 'Бронекабан',    hp: 520, speed: 4.3, dmg: 46, rate: 0.9, coins: 26, food: 10, radius: 1.0, size: 1.4, wave: 22 },
  troll:     { name: 'Лесной тролль', hp: 950, speed: 2.5, dmg: 75, rate: 0.6, coins: 38, food: 0,  radius: 1.4, size: 2.2, wave: 23 },
  treant:    { name: 'Древень',         hp: 3800, speed: 1.6, dmg: 80, rate: 0.6, coins: 220, food: 0,  radius: 2.0, size: 3.6, wave: 20, boss: true, desc: 'Восстанавливает здоровье' },
};

// Стены по уровням
const WALL_LEVELS = [
  { name: 'Деревянная стена',          hp: 260,  h: 2.3, cost: { wood: 10 } },
  { name: 'Укреплённая деревянная',    hp: 400,  h: 2.5, cost: { wood: 20 } },
  { name: 'Каменная стена',            hp: 700,  h: 2.8, cost: { stone: 20, wood: 5 },  req: 'stone' },
  { name: 'Усиленная каменная',        hp: 1100, h: 3.0, cost: { stone: 35, wood: 10 }, req: 'stone' },
  { name: 'Мощная крепостная стена',   hp: 1700, h: 3.4, cost: { stone: 40, iron: 15 }, req: 'metal' },
  { name: 'Железная стена с прожекторами', hp: 2700, h: 3.6, cost: { iron: 40, coal: 15, stone: 20 }, req: 'mech' },
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
  fence:      { max: 40, name: 'Забор',              cat: 'walls',   cost: { wood: 4 },              hp: 90,   size: [4, 0.5], icon: '🚧', desc: 'Дешёвое ограждение.' },
  wall:       { max: 60, name: 'Стена',              cat: 'walls',   cost: { wood: 10 },             hp: 220,  size: [4, 1],   icon: '🧱', desc: 'Улучшается до 5 уровня. На стену можно поставить пушку.' },
  tower:      { max: 6, name: 'Деревянная вышка',   cat: 'towers',  cost: { wood: 25 },             hp: 300,  size: [2.6, 2.6], icon: '🗼', desc: 'Сама стреляет стрелами по врагам.', dmg: 8, rate: 1.1, range: 18 },
  stonetower: { max: 4, name: 'Каменная башня',     cat: 'towers',  cost: { stone: 30, wood: 10 },  hp: 900,  size: [3, 3],   icon: '🏰', desc: 'Прочная башня с дальним обстрелом.', dmg: 15, rate: 1.2, range: 23, req: 'stone' },
  gate:       { max: 6, name: 'Ворота',             cat: 'gates',   cost: { wood: 15 },             hp: 320,  size: [4, 1],   icon: '🚪', desc: 'Вы проходите, враги — нет. Улучшаются до 5 уровня.' },
  stonegate:  { max: 4, name: 'Каменные ворота',    cat: 'gates',   cost: { stone: 25, wood: 8 },   hp: 950,  size: [4, 1.4], icon: '⛩️', desc: 'Очень прочные ворота.', req: 'stone' },
  birdhouse:  { max: 8, name: 'Скворечник',         cat: 'houses',  cost: { wood: 12 },             hp: 120,  size: [1.6, 1.6], icon: '🏠', desc: '+3 места для птиц. Птицы прячутся тут.', cap: 3 },
  aviary:     { max: 4, name: 'Птичник',            cat: 'houses',  cost: { wood: 30, stone: 10 },  hp: 350,  size: [3.4, 3.4], icon: '🏡', desc: '+6 мест для птиц.', cap: 6 },
  lantern:    { max: 20, name: 'Фонарь',             cat: 'light',   cost: { wood: 6 },              hp: 80,   size: [0.8, 0.8], icon: '🏮', desc: 'Освещает базу ночью. Птицы любят на нём сидеть.' },
  torch:      { max: 10, name: 'Большой фонарь',     cat: 'light',   cost: { wood: 10, coal: 2 },    hp: 150,  size: [1.2, 1.2], icon: '🔥', desc: 'Яркий угольный фонарь: светит дальше и сильнее.' },
  market:     { max: 1, name: 'Птичий рынок',       cat: 'houses',  cost: { wood: 35, coins: 20 },  hp: 300,  size: [3.6, 2.6], icon: '🎪', desc: 'Открывает редких птиц для покупки.', unique: true },
  cannon:     { max: 12, name: 'Пушка',              cat: 'defense', cost: { wood: 20, coins: 20 },  hp: 260,  size: [2.4, 2.4], icon: '💣', desc: 'Ставится на стену или на вышку. За пушку садится птица.' },
  spikes:     { max: 20, name: 'Шипы',               cat: 'defense', cost: { wood: 8 },              hp: 120,  size: [2, 2],   icon: '📍', desc: 'Ранят зверей, которые по ним проходят.' },
  ballista:   { max: 4, name: 'Авто-турель',      cat: 'defense', cost: { wood: 20, iron: 12, coal: 5 }, hp: 400, size: [2.4, 2.4], icon: '🏹', desc: 'Автоматический механизм: арбалет → пулемёт → ракетница. Улучшается до 3 уровня.', dmg: 45, rate: 0.7, range: 26, req: 'mech' },
  storage:    { max: 4, name: 'Склад',              cat: 'prod',    cost: { wood: 30 },             hp: 300,  size: [3.4, 2.6], icon: '📦', desc: '+150 к вместимости ресурсов.' },
  workshop:   { max: 1, name: 'Мастерская',         cat: 'prod',    cost: { wood: 40 },             hp: 350,  size: [3.6, 3],   icon: '⚒️', desc: 'Инструменты и технологии.', unique: true },
  farm:       { max: 4, name: 'Ферма',              cat: 'prod',    cost: { wood: 25 },             hp: 200,  size: [4, 4],   icon: '🌾', desc: 'Производит еду.' },
  mineshaft:  { max: 3, name: 'Своя шахта',         cat: 'prod',    cost: { wood: 50, stone: 30 },  hp: 500,  size: [3.4, 3.4], icon: '🕳️', desc: 'Ставится где угодно. Сама добывает камень, уголь и железо. Улучшается до 3 уровня.', req: 'stone' },
  minelift:   { max: 2, name: 'Шахтный подъёмник',  cat: 'prod',    cost: { wood: 40, stone: 20 },  hp: 400,  size: [3, 3],   icon: '⛏️', desc: 'Ставится в карьере. Сам добывает камень и уголь, после улучшений — железо и рубины.', req: 'stone' },
  core:       { max: 1, name: 'Великое гнездо',     cat: 'none',    cost: {},                       hp: 1200, size: [5, 5],   icon: '🪺', desc: 'Сердце базы. Если его разрушат — игра окончена.' },
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
  { name: 'Рубиновый топор',  power: 6,   cost: { ruby: 6, iron: 6, coal: 6 }, req: 'metal' },
  { name: 'Бензопила',        power: 10,  cost: { ruby: 20, iron: 40, coal: 30, coins: 500 }, req: 'mech' },
];
const PICKS = [
  { name: 'Кирка',            power: 1,   cost: { wood: 20 } },
  { name: 'Улучшенная кирка', power: 1.8, cost: { wood: 10, stone: 20 } },
  { name: 'Железная кирка',   power: 3,   cost: { iron: 12, coal: 8 }, req: 'metal' },
  { name: 'Рубиновая кирка',  power: 5,   cost: { ruby: 6, iron: 6, coal: 6 }, req: 'metal' },
  { name: 'Отбойный молоток', power: 9,   cost: { ruby: 20, iron: 40, coal: 30, coins: 500 }, req: 'mech' },
];
// Мечи: mul — множитель урона героя по врагам
const SWORDS = [
  { name: 'Деревянный меч', mul: 1.2, cost: { wood: 15 } },
  { name: 'Каменный меч',   mul: 1.6, cost: { wood: 10, stone: 15 } },
  { name: 'Железный меч',   mul: 2.2, cost: { wood: 5, iron: 12, coal: 6 }, req: 'metal' },
  { name: 'Рубиновый меч',  mul: 3.4, cost: { ruby: 8, iron: 6, coal: 6 }, req: 'metal' },
];

const NODE_INFO = {
  tree:  { hp: 8,  res: 'wood',  ratio: 1,   tool: 'axe',  minPick: -1, regrow: 150, name: 'Дерево' },
  stone: { hp: 10, res: 'stone', ratio: 1,   tool: 'pick', minPick: 0,  regrow: 180, name: 'Камень' },
  coal:  { hp: 9,  res: 'coal',  ratio: 1,   tool: 'pick', minPick: 0,  regrow: 220, name: 'Уголь' },
  iron:  { hp: 12, res: 'iron',  ratio: 0.6, tool: 'pick', minPick: 1,  regrow: 260, name: 'Железная руда' },
  ruby:  { hp: 18, res: 'ruby',  ratio: 0.3, tool: 'pick', minPick: 2,  regrow: 420, name: 'Рубиновая руда' },
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
  easy:       { core: 1.35, tokens: 1, prep: 240, name: 'Лёгкая',     icon: '🌱', hp: 0.65, dmg: 0.55, count: 0.7, timer: 1.4, reward: 1.25, start: 1.5, desc: 'Звери слабые и приходят реже. Для знакомства с игрой.' },
  normal:     { core: 1, tokens: 1.5, prep: 180, name: 'Средняя',    icon: '🌳', hp: 1,    dmg: 1,    count: 1,   timer: 1,   reward: 1,    start: 1,   desc: 'Обычный баланс.' },
  hard:       { core: 0.75, tokens: 2, prep: 130, name: 'Сложная',    icon: '🔥', hp: 1.4,  dmg: 1.4,  count: 1.35,timer: 0.8, reward: 0.9,  start: 0.8, desc: 'Больше сильных зверей, меньше времени на подготовку.' },
  impossible: { core: 0.5, tokens: 3, prep: 90, name: 'Невозможная',icon: '💀', hp: 2.1,  dmg: 2,    count: 1.8, timer: 0.6, reward: 0.75, start: 0.6, desc: 'Огромные стаи, очень мало времени. Только для мастеров.' },
};
const DIFF_ORDER = ['easy', 'normal', 'hard', 'impossible'];

// Уровни ворот
const GATE_LEVELS = [
  { name: 'Деревянные ворота',       hp: 320,  cost: { wood: 15 } },
  { name: 'Окованные ворота',        hp: 560,  cost: { wood: 25, iron: 2 } },
  { name: 'Каменные ворота',         hp: 950,  cost: { stone: 25, wood: 8 },  req: 'stone' },
  { name: 'Крепостные ворота',       hp: 1450, cost: { stone: 40, iron: 8 },  req: 'stone' },
  { name: 'Стальные ворота-решётка', hp: 2200, cost: { stone: 40, iron: 20, coal: 10 }, req: 'metal' },
];
// Уровни авто-турели
const BALLISTA_LEVELS = [
  { name: 'Авто-арбалет',   kind: 'bolt',   dmg: 45, rate: 0.7, range: 26, splash: 0,   hp: 400, cost: { wood: 20, iron: 12, coal: 5 } },
  { name: 'Пулемёт',        kind: 'bullet', dmg: 9,  rate: 7,   range: 24, splash: 0,   hp: 650, cost: { iron: 22, coal: 12, coins: 150 } },
  { name: 'Ракетница',      kind: 'rocket', dmg: 75, rate: 0.8, range: 32, splash: 3.6, hp: 900, cost: { iron: 35, coal: 25, coins: 300 } },
];
// Уровни своей шахты: секунды на 1 единицу ресурса
// Шахтный подъёмник (карьерный добытчик): 0 — не добывает этот ресурс
const LIFT_LEVELS = [
  { name: 'Подъёмник',            hp: 400,  stone: 6, coal: 14, iron: 0,  ruby: 0,  cost: { wood: 40, stone: 20 } },
  { name: 'Усиленный подъёмник',  hp: 650,  stone: 4, coal: 10, iron: 20, ruby: 0,  cost: { wood: 40, stone: 50, iron: 10 } },
  { name: 'Рубиновый подъёмник',  hp: 1000, stone: 3, coal: 6,  iron: 12, ruby: 60, cost: { stone: 60, iron: 40, coal: 25, coins: 200 }, req: 'metal' },
];
const SHAFT_LEVELS = [
  { name: 'Шахта',              hp: 500,  stone: 9, coal: 20, iron: 34, cost: { wood: 50, stone: 30 } },
  { name: 'Глубокая шахта',     hp: 750,  stone: 6, coal: 13, iron: 22, cost: { wood: 40, stone: 50, iron: 10 } },
  { name: 'Механическая шахта', hp: 1100, stone: 4, coal: 8,  iron: 14, cost: { stone: 60, iron: 30, coal: 20, coins: 150 }, req: 'mech' },
];
// Снаряжение героя: свет в темноте
const GEAR = {
  lamp:   { name: 'Ручная лампа',          icon: '🪔', cost: { wood: 10, coal: 3, coins: 30 },   desc: 'Слабо светит вокруг героя в темноте.' },
  helmet: { name: 'Каска с прожектором',   icon: '⛑️', cost: { iron: 8, coal: 6, coins: 120 },  desc: 'Мощный луч света туда, куда смотрит герой.' },
};
// Броня героя: уменьшает получаемый урон
const ARMOR = {
  leather: { icon: '🦺', red: 0.2, cost: { wood: 10, food: 12, coins: 40 } },
  iron:    { icon: '🛡️', red: 0.4, cost: { iron: 20, coal: 10, coins: 120 }, req: 'metal' },
  ruby:    { icon: '💎', red: 0.6, cost: { ruby: 15, iron: 15, coins: 300 }, req: 'metal' },
};
