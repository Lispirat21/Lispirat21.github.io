// Сюжет: 7 миссий + свободный полёт
HL.Missions = (function () {
  const T = THREE, U = HL.U;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

  // ---------- шаблоны шагов ----------
  const talk = (lines, o = {}) => Object.assign({
    enter(g, v) { v._t = false; g.ui.say(lines, () => { v._t = true; }); },
    update(g, dt, v) { return v._t; },
  }, o);
  const wait = (sec, o = {}) => Object.assign({ enter(g, v) { v._w = sec; }, update(g, dt, v) { v._w -= dt; return v._w <= 0; } }, o);
  const goto = (pos, r, text, o = {}) => Object.assign({
    text, wp: () => pos,
    update(g) { const P = g.player.pos; return Math.hypot(P.x - pos.x, P.z - pos.z) < r && Math.abs(P.y - pos.y) < Math.max(6, r); },
  }, o);
  const killGroup = (group, label, o = {}) => Object.assign({
    text: label,
    enter(g, v) { v._n0 = g.groupCount(group); },
    update(g, dt, v) {
      const n = g.groupCount(group);
      g.ui.el.oText.textContent = `${label}: ${v._n0 - n}/${v._n0}`;
      return n === 0;
    },
    wp: (g) => g.groupNearest(group),
  }, o);
  const run = (fn) => ({ enter: (g, v) => fn(g, v), update: () => true });

  function ringsStep(points, label) {
    return {
      text: label,
      enter(g, v) { v.rings = points.map((p) => g.addRing(p)); v.ri = 0; g.highlightRing(v.rings, 0); },
      update(g, dt, v) {
        const r = v.rings[v.ri];
        if (g.player.passed(r.position, 5.2)) {
          g.removeRing(r); HL.Audio.objective(); v.ri++;
          if (v.ri >= v.rings.length) return true;
          g.highlightRing(v.rings, v.ri);
        }
        g.ui.el.oText.textContent = `${label}: ${v.ri}/${v.rings.length}`;
        return false;
      },
      wp: (g, v) => v.rings && v.rings[v.ri] && v.rings[v.ri].position,
      exit(g, v) { (v.rings || []).forEach((r) => g.removeRing(r)); },
    };
  }

  // ---------- сцена после гонки: «Самый быстрый клоун в мире» ----------
  function afterRace() {
    const A = () => HL.Audio;
    return {
      text: 'Победа!',
      enter(g, v) {
        const P = g.player, at = v.at;
        const base = V(0, 0, -150);
        v.base = base;
        // Эй-Трейн стоит на площади, Хоумлендер приземляется перед ним
        at.done = true; at.running = false; at.noPhysics = true;
        at.place(base.x + 1.3, 0, base.z); at.yaw = -Math.PI / 2;
        v.atAnim = 'idle'; v.atYaw = -Math.PI / 2;
        at.think = function (dt) { this.vel.set(0, 0, 0); this.anim = v.atAnim; this.animOpt = {}; this.yaw = U.dampAng(this.yaw, v.atYaw, 7, dt); };
        for (const a of g.actors) if (a.faction === 'civ' && a.pos.distanceTo(base) < 14) a.place(a.pos.x + 20, 0, a.pos.z + 20);
        P.flying = false; P.vel.set(0, 0, 0); P.place(base.x - 1.3, 0, base.z, Math.PI / 2);
        P.scriptFace = Math.PI / 2;
        g.controlsEnabled = false; g.cinematic = true; HL.Input.unlock();
        v.T = 0; v.ev = 0; v.grabT = -1; v.done = false; v.shot = 'wide';
        g.ui.say([['at', '…Да ну на фиг. Как?!'], ['hl', 'Я — Хоумлендер.'], ['at', 'Ладно, ладно. Слушай… Пацаны прячутся в порту. Я тебе ничего не говорил.']], () => { v.ev = 1; v.T = 0; });
      },
      update(g, dt, v) {
        const P = g.player, at = v.at;
        v.T += dt;
        const T = v.T;
        if (v.ev === 1) {
          g.ui.say([['hl', 'Самый быстрый клоун в мире.', 2.6]]); v.ev = 2;
        } else if (v.ev === 2 && T > 2.8) {
          // уходит пешком
          P.scriptFace = null; P.scriptMove = v.base.clone().add(V(-11, 0, 0)); P.scriptSpeed = 1.7; v.ev = 3; v.shot = 'walk';
        } else if (v.ev === 3 && T > 5.4) {
          v.atYaw = Math.PI / 2; // отвернулся
          g.ui.say([['at', '*себе под нос, отвернувшись* …Иди нахер.', 2.3]]); v.ev = 4;
        } else if (v.ev === 4 && T > 7.6) {
          P.scriptMove = null; P.vel.set(0, 0, 0); P.scriptFace = Math.PI / 2; v.ev = 5; v.shot = 'hl';
        } else if (v.ev === 5 && T > 8.3) {
          g.ui.say([['hl', 'Ты что мне сейчас сказал?', 2.0]]); A().heartbeat(0.5); v.ev = 6;
        } else if (v.ev === 6 && T > 10.0) {
          // быстро и уверенно идёт к нему
          v.atYaw = -Math.PI / 2; v.atAnim = 'scared';
          P.scriptMove = at.pos.clone().add(V(-0.85, 0, -0.38)); P.scriptSpeed = 3.6; P.scriptGlow = true; v.ev = 7; v.shot = 'walk';
        } else if (v.ev === 7 && (P.pos.distanceTo(P.scriptMove) < 0.2 || T > 16)) {
          // хватает за шею
          P.scriptMove = null; P.vel.set(0, 0, 0); P.scriptFace = Math.PI / 2; P.scriptPose = 'grab';
          at.pos.y = 0.22; v.atAnim = 'choked';
          g.fx.addShake(0.7); A().punch(); A().stinger();
          g.ui.caption('ТЫ ЧТО МНЕ СЕЙЧАС СКАЗАЛ?', 0.42);
          g.ui.say([['hl', 'ТЫ ЧТО МНЕ СЕЙЧАС СКАЗАЛ?!', 2.6]]);
          v.ev = 8; v.grabT = T; v.shot = 'close';
        } else if (v.ev === 8 && T > v.grabT + 2.8) {
          g.ui.say([['at', 'Блин… прости! Прости, прости!', 2.3]]); v.ev = 9;
        } else if (v.ev === 9 && T > v.grabT + 5.2) {
          g.ui.caption('ПОВТОРИ. ПОВТОРИ!', 0.5); g.fx.addShake(0.6); A().heartbeat(0.7);
          g.ui.say([['hl', 'ПОВТОРИ. ПОВТОРИ!', 2.4]]); v.ev = 10;
        } else if (v.ev === 10 && T > v.grabT + 7.8) {
          // отпускает
          P.scriptPose = null; P.scriptGlow = false; at.pos.y = 0; v.atAnim = 'sit'; A().whiff(); v.ev = 11;
        } else if (v.ev === 11 && T > v.grabT + 8.8) {
          // улетает
          P.flying = true; P.scriptFace = null; P.scriptVel = V(-14, 34, -8); A().whoosh(); v.ev = 12; v.shot = 'fly';
        } else if (v.ev === 12 && T > v.grabT + 11.5) { v.done = true; }

        // камера
        const mid = P.pos.clone().add(at.pos).multiplyScalar(0.5);
        let pos, look;
        if (v.shot === 'close') { pos = mid.clone().add(V(0.6, 1.95, 3.1)); look = mid.clone().add(V(0, 1.75, 0)); }
        else if (v.shot === 'hl') { pos = P.pos.clone().add(V(2.6, 1.8, 2.4)); look = P.pos.clone().add(V(0, 1.7, 0)); }
        else if (v.shot === 'fly') { pos = at.pos.clone().add(V(2.5, 1.6, 5)); look = P.pos.clone().add(V(0, 1, 0)); }
        else if (v.shot === 'walk') { pos = mid.clone().add(V(0, 2.4, 10)); look = mid.clone().add(V(0, 1.4, 0)); }
        else { pos = mid.clone().add(V(0.5, 2.1, 6.5)); look = mid.clone().add(V(0, 1.5, 0)); }
        g.camOverride = { pos, look };
        return v.done;
      },
      exit(g, v) {
        const P = g.player;
        P.scriptMove = null; P.scriptFace = null; P.scriptPose = null; P.scriptVel = null; P.scriptGlow = false;
        g.cinema(null);
      },
    };
  }

  const HL_CARD = ['ХОУМЛЕНДЕР', [['СИЛА', 'MAX'], ['ПОЛЁТ', 'ДА'], ['ЛАЗЕР ИЗ ГЛАЗ', 'ДА'], ['УРОВЕНЬ', '99']]];

  // =====================================================================
  const LIST = [
    // ---------------- 1 ----------------
    {
      id: 'day1', title: 'Обычный день', desc: 'Москва, полдень. Vought открывает филиал — улыбайтесь в камеры.',
      time: 'day', location: 'МОСКВА · 12:04', start: [0, 0, -40, Math.PI], music: 'calm',
      setup(g) { g.spawnCrowd(); g.spawnTraffic(); },
      steps: [
        {
          enter(g, v) {
            g.ui.caption('ОБЫЧНЫЙ ДЕНЬ. САМЫЙ СИЛЬНЫЙ ГЕРОЙ ПЛАНЕТЫ.');
            setTimeout(() => g.ui.statcard(HL_CARD[0], HL_CARD[1], 'Лицо Vought International.'), 1600);
            v._t = false;
            g.ui.say([['ash', 'Хоумлендер, ты в эфире через пять минут. Vought открывает офис в Москве — пожалуйста, улыбайся.'], ['hl', 'Я всегда улыбаюсь, Эшли.'], ['ash', 'Вот именно это меня и пугает.']], () => (v._t = true));
          },
          update: (g, dt, v) => v._t, text: 'Слушайте Эшли',
        },
        goto(V(0, 0, -150), 9, 'Пройдите к площади у красной стены'),
        {
          text: 'Взлетите: Пробел в прыжке или F (кнопка ПОЛЁТ)',
          enter(g) { g.ui.hint(HL.Settings.useTouch ? '▲ — прыжок, ещё раз ▲ в воздухе — полёт' : 'Пробел — прыжок, Пробел в воздухе — полёт', 4); },
          update: (g) => g.player.flying && g.player.pos.y > 12,
        },
        ringsStep([V(0, 30, -120), V(40, 40, -60), V(70, 34, 10), V(30, 26, 60)], 'Пролетите через кольца'),
        {
          enter(g, v) {
            HL.Audio.alarm();
            g.ui.say([['news', 'Срочно: вооружённое ограбление банка на проспекте! Есть заложники!'], ['ash', 'Это же идеально! Камеры уже едут. Только… без жертв, ладно?'], ['hl', 'Без жертв. Конечно.']], () => (v._t = true));
            v._t = false;
            const c = V(70, 0, 100);
            g.spawnGroup('rob', 'thug', c, 6, { spread: 14, weapon: 'pistol', hp: 55 });
            g.spawn('police', c.x - 12, c.z + 25, { yaw: 0.3 });
            g.spawn('police', c.x + 10, c.z - 22, { yaw: 2.5 });
            g.alarm(c, 40);
          },
          update: (g, dt, v) => v._t || g.groupCount('rob') < 6,
          text: 'Ограбление банка!', wp: (g) => g.groupNearest('rob'),
        },
        killGroup('rob', 'Остановите грабителей', { enter(g, v) { v._n0 = 6; g.ui.hint('ЛКМ — лазер · ПКМ — удар. Не задевайте прохожих!', 4); g.music('combat'); } }),
        {
          text: 'Попозируйте для прессы у площади: H (кнопка ПОЗА)',
          enter(g, v) {
            g.music('calm');
            v.spot = V(0, 0, -158);
            for (let i = 0; i < 14; i++) { const a = g.spawn('civ', v.spot.x + U.rand(-14, 14), v.spot.z + U.rand(6, 16), { mood: 'watch' }); }
            g.ui.say([['ash', 'Камеры у площади! Встань перед людьми — руки в боки, как ты умеешь.']]);
            v.posed = false;
            g.onPose = (n) => { if (g.player.pos.distanceTo(v.spot) < 16 && n >= 3) v.posed = true; };
          },
          update: (g, dt, v) => v.posed, wp: (g, v) => v.spot,
          exit(g) { g.onPose = null; },
        },
        talk([['crowd', 'ХОУМ-ЛЕН-ДЕР! ХОУМ-ЛЕН-ДЕР!'], ['ash', 'Рейтинг растёт! Ты лучший.'], ['scam', '*звонок* Здравствуйте, служба безопасности банка «Воут-Кредит». Продавец Уильям.'],
          ['scam', 'По вашей карте подозрительная операция. Назовите код из СМС, и мы её отменим.'], ['hl', 'Я — Хоумлендер. Со мной не бывает подозрительных операций.'], ['scam', 'Конечно-конечно, сэр. Код, пожалуйста.'],
          ['hl', '…4711. Довольны?'], ['scam', 'О, ещё как, дружок. Ещё как.']], { text: 'Входящий звонок…' }),
      ],
    },
    // ---------------- 2 ----------------
    {
      id: 'fire', title: 'Горячая точка', desc: 'Пожар в жилом доме. Прямой эфир. Спасите всех — на камеру.',
      time: 'dusk', location: 'МОСКВА · 18:40', start: [-35, 0, 40, Math.PI * 0.75], music: 'combat',
      setup(g, v) {
        g.spawnCrowd(); g.spawnTraffic();
        // три горящих дома рядом с точкой
        const c = V(-140, 0, 120);
        const lots = g.world.lots.filter((b) => b.y1 >= 14).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - c.x, (a.z0 + a.z1) / 2 - c.z) - Math.hypot((b.x0 + b.x1) / 2 - c.x, (b.z0 + b.z1) / 2 - c.z));
        v.burning = lots.slice(0, 3);
        v.victims = [];
        v.burning.forEach((b, i) => {
          for (let k = 0; k < 2; k++) {
            const x = U.lerp(b.x0 + 2, b.x1 - 2, k ? 0.75 : 0.25), z = U.lerp(b.z0 + 2, b.z1 - 2, 0.5 + (k - 0.5) * 0.4);
            const a = g.spawn('victim', x, z, { y: b.y1 }); v.victims.push(a);
          }
        });
        const amb = V(-105, 0, 70);
        v.amb = amb;
        g.spawn('ambulance', amb.x, amb.z, { yaw: Math.PI / 2 });
        for (let i = 0; i < 8; i++) g.spawn('civ', amb.x + U.rand(-10, 10), amb.z + U.rand(5, 12), { mood: 'watch' });
        v.rescued = 0;
        g.onDrop = (a) => {
          if (a.pickable && a.pos.distanceTo(v.amb) < 12 && !a.rescued) {
            a.rescued = true; a.pickable = false; v.rescued++;
            HL.Audio.objective(); HL.Audio.cheer();
            g.changeApproval(4, 'Спасён'); g.ui.float(a.center, '+4% СПАСЁН', '#7cff7c');
          }
        };
        g.missionUpdate = (dt) => {
          for (const b of v.burning) {
            if (Math.random() < dt * 14) {
              const side = (Math.random() * 4) | 0; const y = U.rand(2, b.y1);
              const p = side === 0 ? V(b.x0 - 0.3, y, U.rand(b.z0, b.z1)) : side === 1 ? V(b.x1 + 0.3, y, U.rand(b.z0, b.z1)) : side === 2 ? V(U.rand(b.x0, b.x1), y, b.z0 - 0.3) : V(U.rand(b.x0, b.x1), y, b.z1 + 0.3);
              g.fx.fire(p, 2);
            }
            if (Math.random() < dt * 4) g.fx.smoke(V(U.rand(b.x0, b.x1), b.y1 + 2, U.rand(b.z0, b.z1)), 2);
          }
        };
      },
      steps: [
        {
          enter(g, v) {
            g.ui.caption('ГОРИТ ЖИЛОЙ ДОМ. ВСЯ СТРАНА СМОТРИТ.');
            v._t = false;
            g.ui.say([['ash', 'Пожар! Шесть человек на крышах. Прямой эфир на всех каналах!'], ['ash', 'Хватай их по одному и неси к скорой. И, ради бога, не урони никого в кадре.'], ['hl', 'Спасать людей… Как мило.']], () => (v._t = true));
          },
          update: (g, dt, v) => v._t, text: 'Летите к пожару',
          wp: (g, v) => V(-140, 20, 120),
        },
        {
          text: 'Спасите людей (E — взять, отнесите к скорой)',
          enter(g, v) { g.setTimer(200); g.ui.hint(HL.Settings.useTouch ? 'Подлетите к человеку и нажмите ВЗЯТЬ' : 'Подлетите к человеку и нажмите E', 4); },
          update(g, dt, v) {
            g.ui.el.oText.textContent = `Спасите людей: ${v.rescued}/6` + (g.player.carry ? ' — несите к скорой!' : '');
            return v.rescued >= 6;
          },
          wp(g, v) {
            if (g.player.carry) return V(v.amb.x, 3, v.amb.z);
            let best = null, bd = 1e9; for (const a of v.victims) if (a.pickable && !a.rescued) { const d = a.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; best = a; } }
            return best ? best.center : null;
          },
          exit(g) { g.setTimer(null); },
        },
        talk([['crowd', 'УРА!!!'], ['ash', 'Плюс девять пунктов! Ты бог!'], ['hl', 'Я знаю.'], ['ash', 'Эм… Хоумлендер? Тут из банка звонят. С твоего счёта только что ушло… всё.'], ['hl', 'Что?']], { text: 'Эфир' }),
      ],
    },
    // ---------------- 3 ----------------
    {
      id: 'scam', title: 'Продавец Уильям', desc: 'Кто-то обокрал самого Хоумлендера по телефону. Найдите звонящего.',
      time: 'night', location: 'МОСКВА · 23:15', start: [0, 0, 0, Math.PI], music: 'calm',
      setup(g, v) {
        g.spawnCrowd(); g.spawnTraffic();
        const pick = (x, z) => g.world.lots.filter((b) => b.y1 > 12).sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - x, (a.z0 + a.z1) / 2 - z) - Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z))[0];
        const spots = [pick(-175, -35), pick(175, 35), pick(-35, 175)];
        const trueIdx = (Math.random() * 3) | 0;
        v.sources = spots.map((b, i) => {
          const a = g.spawn('marker', (b.x0 + b.x1) / 2, b.z1 + 1, { y: Math.min(b.y1 - 3, 10) });
          a.hearable = true; a.hearIcon = '☎'; a.isTrue = i === trueIdx; a.box = b; return a;
        });
        v.fakes = [
          [['sys', '…бабушка по телефону: «Да, внучок, сейчас продиктую код из СМС!»'], ['hl', 'Не он. Хотя бабушку жалко.']],
          [['sys', '…«Ваша пицца будет через тридцать минут».'], ['hl', 'Не то.']],
        ];
      },
      steps: [
        talk([['hl', 'Кто-то обокрал меня. МЕНЯ.'], ['ash', 'Звонок шёл откуда-то из центра. Может, твой суперслух…?'], ['hl', 'Тишина. Мне нужна тишина.']], { text: 'Найдите мошенника' }),
        {
          text: 'Включите суперслух: Q (кнопка СЛУХ)',
          update: (g) => g.player.hearT > 0,
        },
        {
          text: 'Найдите звонящий телефон (☎): подлетите к источникам',
          enter(g, v) { g.ui.hint('Сигналы видны во время суперслуха. Подлетите ближе к ☎', 4); v.fi = 0; v.busy = false; },
          update(g, dt, v) {
            if (v.busy) return false;
            for (const s of v.sources) {
              if (!s.alive) continue;
              if (s.pos.distanceTo(g.player.pos) < 16) {
                if (s.isTrue) { v.trueSrc = s; return true; }
                s.remove(); s.alive = false; v.busy = true; HL.Audio.phone();
                g.ui.say(v.fakes[v.fi++ % 2], () => { v.busy = false; });
              }
            }
            return false;
          },
          wp(g, v) {
            if (g.player.hearT <= 0) return null;
            let best = null, bd = 1e9; for (const s of v.sources) if (s.alive) { const d = s.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; best = s; } }
            return best && best.pos;
          },
        },
        {
          enter(g, v) {
            HL.Audio.phone();
            v._t = false;
            g.ui.say([['scam', '…да-да, продавец Уильям слушает. Назовите код из… Чёрт! Он здесь!'], ['hl', 'Нашёл.']], () => (v._t = true));
            v.trueSrc = v.trueSrc || v.sources.find((s) => s.isTrue);
            const b = v.trueSrc.box;
            // фургон стартует на дороге рядом
            const sx = Math.round(((b.x0 + b.x1) / 2) / 70) * 70, sz = Math.round(((b.z0 + b.z1) / 2) / 70) * 70;
            const loop = [V(-140, 0, -140), V(140, 0, -140), V(140, 0, 140), V(-140, 0, 140)];
            const van = g.spawn('van', sx, sz, { hp: 950, speed: 24, group: 'van', showHp: true });
            van.path = loop.map((p) => p.clone()); van.pi = 0;
            let bd = 1e9; loop.forEach((p, i) => { const d = p.distanceTo(van.pos); if (d < bd) { bd = d; van.pi = i; } });
            van.keepBody = true; v.van = van;
            v.trueSrc.remove();
          },
          update: (g, dt, v) => v._t, text: 'Это он!', wp: (g, v) => v.van && v.van.center,
        },
        {
          text: 'Остановите чёрный фургон (лазер)',
          enter(g) { g.setTimer(80); g.music('combat'); g.ui.hint('Жгите фургон лазером, пока не уехал!', 3); },
          update: (g, dt, v) => !v.van.alive,
          wp: (g, v) => v.van.center,
          exit(g) { g.setTimer(null); },
        },
        {
          text: 'Подойдите к фургону',
          update: (g, dt, v) => g.player.pos.distanceTo(v.van.pos) < 8,
          wp: (g, v) => v.van.pos,
        },
        {
          enter(g, v) {
            g.music(null);
            const van = v.van;
            const side = V(Math.cos(van.yaw), 0, -Math.sin(van.yaw));
            const bp = van.pos.clone().addScaledVector(side, 2.6);
            const but = g.spawn('butcher', bp.x, bp.z, { faction: 'ally', hp: 1e9 }); but.invuln = true; but.face(g.player.pos); v.but = but;
            but.think = function (dt) { this.anim = 'idle'; this.face(g.player.pos, dt, 4); this.stop(dt); };
            g.player.vel.set(0, 0, 0);
            g.cinema(bp.clone().add(V(Math.sin(but.yaw) * 4.2, 1.8, Math.cos(but.yaw) * 4.2)), bp.clone().add(V(0, 1.6, 0)));
            g.ui.caption('ИЗ НЕЁ ВЫХОДИТ…', 0.45);
            HL.Audio.stinger();
            setTimeout(() => g.ui.statcard('ПРОДАВЕЦ УИЛЬЯМ', [['НАСТОЯЩЕЕ ИМЯ', 'БИЛЛИ'], ['НАГЛОСТЬ', 'MAX'], ['СУПЕРСИЛА', 'НЕТ'], ['УРОВЕНЬ', '??']], 'Билли Бутчер. Лидер Пацанов.', 5), 1500);
            v._t = false;
            setTimeout(() => g.ui.say([['but', 'Ну привет, дорогуша. Деньги понравились? Мне — очень.'], ['hl', 'Бутчер.'], ['but', 'Продавец Уильям, к вашим услугам. Приятно было поболтать.'],
              ['but', 'А теперь — улыбочку!']], () => {
              g.ui.flash(2.4); HL.Audio.explosion(0.6); g.fx.smoke(but.center, 20);
              but.remove();
              setTimeout(() => g.ui.say([['hl', '…'], ['hl', 'Я тебя найду, Билли. И тогда никакой код тебе не поможет.']], () => (v._t = true)), 900);
            }), 1800);
          },
          update: (g, dt, v) => v._t, text: '…',
          exit(g) { g.cinema(null); },
        },
      ],
    },
    // ---------------- 4 ----------------
    {
      id: 'race', title: 'Гонка с Эй-Трейном', desc: 'Самый быстрый человек на планете бросает вызов. Пролетите все кольца первым.',
      time: 'day', location: 'МОСКВА · 10:30', start: [0, 0, 20, Math.PI], music: 'combat', noApproval: false,
      setup(g, v) {
        g.spawnCrowd();
        const path = [V(0, 0, -70), V(140, 0, -70), V(140, 0, 70), V(70, 0, 70), V(70, 0, 210), V(-140, 0, 210), V(-140, 0, 0), V(-210, 0, 0), V(-210, 0, -140), V(0, 0, -140), V(0, 0, -175)];
        v.path = path;
        const at = g.spawn('atrain', 4, 20, { path: path.map((p) => p.clone()), speed: 58 }); at.yaw = Math.PI; v.at = at;
        v.ringPts = path.map((p, i) => V(p.x, i === path.length - 1 ? 40 : 14 + (i % 3) * 10, p.z));
      },
      steps: [
        {
          enter(g, v) {
            g.ui.statcard('ЭЙ-ТРЕЙН', [['СКОРОСТЬ', 'MAX'], ['СКРОМНОСТЬ', 'НЕТ'], ['УРОВЕНЬ', '75']], null, 4);
            v._t = false;
            g.ui.say([['at', 'Слышал, тебя развели по телефону, старик. Ха-ха! Может, хоть гонку выиграешь?'], ['hl', 'Тебе стоит знать своё место, Эй-Трейн.'], ['at', 'Через все кольца. Кто последний — тот лох. Shift тебе в помощь.']], () => (v._t = true));
          },
          update: (g, dt, v) => v._t, text: 'Приготовьтесь к гонке',
        },
        {
          text: 'Старт через…',
          enter(g, v) { v.cd = 3.99; g.controlsEnabled = false; v.last = 4; },
          update(g, dt, v) {
            v.cd -= dt; const n = Math.ceil(v.cd);
            if (n !== v.last) { v.last = n; if (n > 0) { g.ui.caption(String(n), 0.9); HL.Audio.beep(); } }
            if (v.cd <= 0) { g.controlsEnabled = true; g.ui.caption('МАРШ!', 0.8); HL.Audio.go(); v.at.running = true; return true; }
            return false;
          },
        },
        {
          text: 'Пролетите через кольца',
          enter(g, v) { v.rings = v.ringPts.map((p) => g.addRing(p)); v.ri = 0; g.highlightRing(v.rings, 0); g.ui.hint('Shift (⚡) — суперскорость!', 3); },
          update(g, dt, v) {
            const r = v.rings[v.ri];
            if (g.player.passed(r.position, 5.5)) {
              g.removeRing(r); HL.Audio.objective(); v.ri++;
              if (v.ri >= v.rings.length) return true;
              g.highlightRing(v.rings, v.ri);
            }
            const atI = Math.min(v.at.i, v.path.length);
            g.ui.el.oText.textContent = `Кольца: ${v.ri}/${v.rings.length} · Эй-Трейн: ${atI}/${v.path.length}` + (atI > v.ri ? ' — ОН ВПЕРЕДИ!' : '');
            if (v.at.done) g.fail('Эй-Трейн пришёл первым. «Кто последний — тот лох».');
            return false;
          },
          wp: (g, v) => v.rings && v.rings[v.ri] && v.rings[v.ri].position,
          exit(g, v) { (v.rings || []).forEach((r) => g.removeRing(r)); v.at.running = false; },
        },
        afterRace(),
      ],
    },
    // ---------------- 5 ----------------
    {
      id: 'raid', title: 'Логово Пацанов', desc: 'Ночной порт. Наёмники с оружием против суперов, Френчи, М.М., Кимико… и Старлайт.',
      time: 'night', location: 'ПОРТ · 23:50', start: [140, 0, 0, Math.PI / 2], music: 'combat',
      setup(g, v) {
        g.spawnCrowd(0.4);
        v.port = V(245, 0, 0);
      },
      steps: [
        talk([['hl', 'Би-и-илли. Выходи поиграть.'], ['but', '*по рации* Парни, гость пожаловал. Огонь из всего, что есть. Пули с Компаундом — в первую очередь.']], { text: 'Летите в порт', wp: () => V(245, 10, 0) }),
        {
          text: 'Зачистите порт',
          enter(g, v) {
            const p = v.port;
            g.spawnGroup('w1', 'agent', p, 4, { spread: 26, weapon: 'rifle', hp: 80 });
            g.spawnGroup('w1', 'agent', p, 2, { spread: 20, weapon: 'antisupe', hp: 80 });
            g.spawnGroup('w1', 'agent', V(232, 0, 0), 2, { weapon: 'rifle', hp: 80, roof: true });
            g.ui.hint('Фиолетовые пули — анти-супер патроны. Они больнее!', 4);
            v._n = g.groupCount('w1');
          },
          update(g, dt, v) { const n = g.groupCount('w1'); g.ui.el.oText.textContent = `Зачистите порт: ${v._n - n}/${v._n}`; return n === 0; },
          wp: (g) => g.groupNearest('w1'),
        },
        {
          text: 'Френчи и М.М.',
          enter(g, v) {
            const fr = g.spawn('frenchie', 250, -30, { group: 'w2' }), mm = g.spawn('mm', 255, 30, { group: 'w2' });
            g.spawnGroup('w2', 'agent', v.port, 3, { spread: 22, weapon: 'rifle', hp: 80 });
            g.ui.statcard('ФРЕНЧИ И М.М.', [['ГРАНАТЫ', 'ДА'], ['ПУЛЕМЁТ', 'ДА'], ['ДИСЦИПЛИНА', 'MAX'], ['УРОВЕНЬ', '35']], null, 3.5);
            g.ui.say([['fr', 'Mon dieu, он реально здесь…'], ['mm', 'Френчи, гранаты! Работаем!']]);
            v._n = g.groupCount('w2');
          },
          update(g, dt, v) { const n = g.groupCount('w2'); g.ui.el.oText.textContent = `Победите Френчи, М.М. и наёмников: ${v._n - n}/${v._n}`; return n === 0; },
          wp: (g) => g.groupNearest('w2'),
        },
        {
          text: 'Кимико',
          enter(g, v) {
            const k = g.spawn('kimiko', 245, 20, { group: 'w3' });
            g.ui.statcard('КИМИКО', [['РЕГЕНЕРАЦИЯ', 'ДА'], ['БЛИЖНИЙ БОЙ', 'MAX'], ['УРОВЕНЬ', '70']], null, 3.5);
            g.ui.say([['ki', '*молча вытирает кровь с губы и бросается вперёд*']]);
            v.k = k;
          },
          update(g, dt, v) { g.ui.boss('Кимико', v.k.hp / v.k.maxHp); return !v.k.alive; },
          wp: (g, v) => v.k.alive && v.k.center,
          exit(g) { g.ui.boss(null); },
        },
        {
          text: 'Старлайт',
          enter(g, v) {
            g.music('boss');
            const s = g.spawn('starlight', 255, 0, { group: 'w4' }); s.keepBody = true; v.s = s;
            g.ui.caption('СТАРЛАЙТ.');
            g.ui.statcard('СТАРЛАЙТ', [['СВЕТ', 'MAX'], ['ОСЛЕПЛЕНИЕ', 'ДА'], ['ПОЛЁТ', 'НЕТ'], ['УРОВЕНЬ', '80']], 'Не смотрите на неё во время вспышки!', 4);
            g.ui.say([['sl', 'Хватит! Я не дам тебе их тронуть!'], ['hl', 'Старлайт. Ты всегда была моей любимой разочаровывающей сотрудницей.']]);
          },
          update(g, dt, v) { g.ui.boss('Старлайт', v.s.hp / v.s.maxHp); return !v.s.alive; },
          wp: (g, v) => v.s.alive && v.s.center,
          exit(g) { g.ui.boss(null); g.music('calm'); },
        },
        {
          text: 'Найдите Хьюи (суперслух — Q)',
          enter(g, v) {
            g.ui.say([['sl', '…беги, Хьюи…'], ['hl', 'Хьюи? Я слышу твоё сердце, Хьюи. Оно так быстро стучит.']]);
            const c = g.world.special.container5 || V(270, 0, 10);
            const h = g.spawn('hughie', c.x - 2.6, c.z, { mood: 'scared' }); h.invuln = true; h.hearable = true; h.hearIcon = '💓'; v.h = h;
          },
          update(g, dt, v) { return g.player.pos.distanceTo(v.h.pos) < 5; },
          wp: (g, v) => (g.player.hearT > 0 ? v.h.center : null),
        },
        talk([['hu', 'Н-не убивай! Пожалуйста! Я… я всё скажу!'], ['hu', 'Бутчер хочет разбудить Солдатика! Его тело держат в лаборатории под красной стеной!'],
          ['hl', 'Солдатик мёртв уже сорок лет.'], ['hu', 'Н-не совсем…']], { text: 'Допрос' }),
      ],
    },
    // ---------------- 6 ----------------
    {
      id: 'soldier', title: 'Солдатик', desc: 'Легенда вернулась. Его взрыв из груди подавляет силы — прячьтесь за зданиями.',
      time: 'dawn', location: 'ПЛОЩАДЬ · 06:10', start: [0, 0, -100, Math.PI], music: 'boss',
      setup(g, v) { g.spawnCrowd(0.6); },
      steps: [
        {
          enter(g, v) {
            const sb = g.spawn('soldierboy', 0, -192, {}); sb.keepBody = true; sb.yaw = 0; v.sb = sb;
            sb._think = sb.think; sb.think = function (dt) { this.anim = 'walk'; this.moveSpeed = 1.6; this.moveToward(V(0, 0, -170), 1.6, dt); this.face(g.player.pos, dt, 3); };
            g.cinema(V(6, 3.4, -160), V(0, 1.7, -186));
            g.ui.caption('ЛЕГЕНДА ВЕРНУЛАСЬ.', 0.5);
            HL.Audio.stinger();
            setTimeout(() => g.ui.statcard('СОЛДАТИК', [['СИЛА', 'MAX'], ['ЩИТ', 'ДА'], ['ВЗРЫВ ИЗ ГРУДИ', 'ДА'], ['УРОВЕНЬ', '98']], 'Взрыв подавляет силы. Прячьтесь за зданиями!', 5), 1300);
            v._t = false;
            setTimeout(() => g.ui.say([['sb', 'Вот это да. Сопляк в плаще. Это ты теперь лицо Vought?'], ['hl', 'Я — Хоумлендер.'], ['sb', 'А я — тот, кого они пытались похоронить. Не вышло.']], () => (v._t = true)), 1500);
          },
          update: (g, dt, v) => v._t, text: '…',
          exit(g, v) { g.cinema(null); v.sb.think = v.sb._think; },
        },
        {
          text: 'Победите Солдатика',
          enter(g) { g.ui.hint('После взрыва Солдатик уязвим — бейте его тогда!', 4); },
          update(g, dt, v) { g.ui.boss('Солдатик', v.sb.hp / v.sb.maxHp); return !v.sb.alive; },
          wp: (g, v) => null,
          exit(g) { g.ui.boss(null); g.music(null); },
        },
        talk([['sb', 'Кх… Погоди. Эти глаза…'], ['sb', 'Ты… ты мой сын?'], ['hl', '…'], ['but', '*по рации* Спасибо за помощь, приятель. Его кровь — всё, что мне было нужно.'],
          ['but', 'Темп-V. Сутки силы, как у вас, уродов. Встретимся у твоей драгоценной башни.']], { text: 'Правда' }),
      ],
    },
    // ---------------- 7 ----------------
    {
      id: 'final', title: 'Финал: Бутчер', desc: 'Ночь, дождь, башня Vought. Бутчер на Темп-V. Только один уйдёт отсюда.',
      time: 'night', rain: true, location: 'БАШНЯ VOUGHT · 00:00', start: [40, 0, 70, -Math.PI / 2], music: 'boss',
      setup(g, v) { g.spawnCrowd(0.4); },
      steps: [
        {
          enter(g, v) {
            const b = g.spawn('butcherBoss', 120, 70, {}); b.yaw = -Math.PI / 2; v.b = b; v.summon = [false, false];
            b._think = b.think; b.think = function (dt) { this.anim = 'idle'; this.animOpt = { lash: false }; this.stop(dt); this.face(g.player.pos, dt, 3); };
            g.cinema(V(110, 3, 76), V(120, 2, 70));
            g.ui.caption('ТЕМП-V. ОДНИ СУТКИ.', 0.45);
            HL.Audio.stinger();
            setTimeout(() => g.ui.statcard('БИЛЛИ БУТЧЕР', [['СИЛА', 'ТЕМП-V'], ['ЩУПАЛЬЦА', 'ДА'], ['НЕНАВИСТЬ', 'MAX'], ['УРОВЕНЬ', '99']], 'Щупальца, прыжки и… машины.', 5), 1200);
            v._t = false;
            setTimeout(() => g.ui.say([['but', 'Ну что, дорогуша. Теперь мы на равных.'], ['hl', 'Ты всего лишь человек, Билли.'], ['but', 'Сегодня — нет.']], () => (v._t = true)), 1500);
          },
          update: (g, dt, v) => v._t, text: '…',
          exit(g, v) { g.cinema(null); v.b.think = v.b._think; },
        },
        {
          text: 'Победите Бутчера',
          update(g, dt, v) {
            const b = v.b, f = b.hp / b.maxHp;
            g.ui.boss('Билли Бутчер (Темп-V)', f);
            if (f < 0.66 && !v.summon[0]) { v.summon[0] = true; g.spawnGroup('adds', 'agent', b.pos, 4, { spread: 20, weapon: 'antisupe', hp: 80 }); g.ui.say([['but', 'Парни! Огонь по нему!']]); }
            if (f < 0.33 && !v.summon[1]) { v.summon[1] = true; g.spawnGroup('adds', 'agent', b.pos, 4, { spread: 20, weapon: 'rifle', hp: 80 }); g.ui.say([['but', 'Я тебя не отпущу, слышишь?! Никогда!']]); }
            return !b.alive;
          },
          exit(g) { g.ui.boss(null); g.music(null); },
        },
        talk([['but', 'Кх-х… Ну давай. Чего ждёшь?'], ['hl', '…'], ['ash', '*в наушнике* Хоумлендер, на тебя смотрят все камеры страны. Решай.']], { text: 'Решение' }),
        {
          text: 'Сделайте выбор',
          enter(g, v) {
            v.done = false;
            g.controlsEnabled = false; HL.Input.unlock();
            g.ui.choice('Что сделает Хоумлендер?', [
              { text: 'Пощадить', sub: 'Толпа увидит милосердие бога', fn: () => { v.ending = 'mercy'; v.done = true; } },
              { text: 'Покончить с этим', sub: 'Билли больше никогда не позвонит', fn: () => { v.ending = 'kill'; v.done = true; } },
            ]);
          },
          update: (g, dt, v) => v.done,
          exit(g, v) { g.ending = v.ending; },
        },
      ],
    },
  ];

  // ---------- концовки ----------
  function endingText(kind, approval) {
    if (kind === 'mercy') {
      return approval >= 60
        ? 'Хоумлендер опустил руку и улыбнулся в камеры. «Даже он заслуживает второго шанса». Рейтинг одобрения взлетел до небес. Где-то в тюремной камере Билли Бутчер смеялся: Темп-V ещё не закончился…'
        : 'Хоумлендер ушёл, не обернувшись. Люди не поверили в его милосердие — слишком многое они видели раньше. Бутчер исчез этой же ночью.';
    }
    return approval >= 60
      ? 'Вспышка красного света. Тишина. Vought уже пишет пресс-релиз: «Террорист нейтрализован». Толпа аплодирует… но никто не смотрит Хоумлендеру в глаза.'
      : 'Вспышка красного света. Камеры всё засняли. Акции Vought рухнули, а Хоумлендер впервые понял: бога можно бояться — и при этом ненавидеть.';
  }

  // ---------- свободный полёт ----------
  const FREE = {
    id: 'free', title: 'Свободный полёт', desc: 'Город ваш. Останавливайте преступления, позируйте, летайте.', time: 'day', location: 'МОСКВА · СВОБОДНЫЙ ПОЛЁТ', start: [0, 0, -40, Math.PI], music: 'calm', free: true,
    setup(g, v) { g.spawnCrowd(); g.spawnTraffic(); v.next = 20; v.count = 0; },
    steps: [{
      text: 'Летайте по городу. Скоро где-то случится преступление…',
      update(g, dt, v) {
        v.next -= dt;
        const n = g.groupCount('crime');
        if (v.active && n === 0) { v.active = false; v.count++; g.changeApproval(3, 'Преступление остановлено'); HL.Audio.success(); v.next = 25; g.music('calm'); }
        if (!v.active && v.next <= 0) {
          let p; for (let k = 0; k < 20; k++) { p = g.world.randomSidewalk(); if (p.distanceTo(g.player.pos) > 90) break; }
          g.spawnGroup('crime', U.pick(['thug', 'thug', 'agent']), p, U.randi(3, 6), { spread: 12, weapon: U.pick(['pistol', 'rifle']), hp: 60 });
          g.alarm(p, 40); HL.Audio.alarm(); g.ui.hint('Преступление в городе! Следуйте за маркером', 3); v.active = true; g.music('combat');
        }
        g.ui.el.oText.textContent = v.active ? `Остановите преступников: осталось ${n} · Остановлено: ${v.count}` : `Город спокоен… Остановлено преступлений: ${v.count}`;
        return false;
      },
      wp: (g, v) => (v.active ? g.groupNearest('crime') : null),
    }],
  };

  return { LIST, FREE, endingText };
})();
