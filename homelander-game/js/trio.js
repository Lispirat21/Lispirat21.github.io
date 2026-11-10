// Миссия «Трое против одного»: Бутчер находит Солдатика, к ним приходит Хьюи на Темп-V.
// Бой: Солдатик → Бутчер (жёлтые лазеры) → все трое. Финал — кат-сцена в особняке.
HL.Trio = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const MEET = V(70, 0, 112);    // ночная улица: здесь Бутчер находит Солдатика
  const ARENA = V(70, 0, 150);   // перекрёсток для боя
  const HOUSE = V(0, 0, -360);   // особняк для финальной кат-сцены (за лужайкой Белого дома, в пределах мира)

  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  const hide = (a) => { if (a && !a.removed) a.remove(); };
  // кадр «через плечо»: камера за плечом from, смотрит в лицо to
  function ots(from, to, side = 1) {
    const d = to.pos.clone().sub(from.pos).setY(0).normalize(), r = V(-d.z, 0, d.x).multiplyScalar(side);
    return { pos: from.center.addScaledVector(d, -1.5).addScaledVector(r, 0.75).add(V(0, 0.45, 0)), look: to.center.add(V(0, 0.4, 0)) };
  }
  // реплики по одной: перед каждой — свой кадр
  function chain(g, v, lines, shots, done) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) { done && done(); return; }
      if (shots && shots[i]) v.shot = typeof shots[i] === 'function' ? shots[i]() : shots[i];
      g.ui.say([lines[i]], next); i++;
    };
    next();
  }
  const idle = (look) => function (dt) { this.anim = 'idle'; this.animOpt = { lash: false }; this.vel.set(0, this.noPhysics ? 0 : this.vel.y, 0); if (look) this.face(look(), dt, 5); };

  // ---------- 1. Ночь. Бутчер находит Солдатика ----------
  const meetStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      P.place(-160, 0, -120, 0); // Хоумлендер далеко отсюда
      g.cinema(V(MEET.x + 4.5, 2.4, MEET.z - 9.5), MEET); g.camOverride.snap = true;
      const sb = g.spawn('soldierboy', MEET.x, MEET.z, {}); v.sb = sb; sb.invuln = true; sb.yaw = Math.PI / 2;
      sb.think = function (dt) { this.anim = 'sit'; this.animOpt = {}; this.vel.set(0, 0, 0); this.yaw = U.dampAng(this.yaw, Math.PI * 0.75, 2, dt); };
      const b = g.spawn('butcherBoss', MEET.x - 16, MEET.z - 14, { noTent: true, eyes: true }); v.b = b; b.invuln = true;
      b.think = function (dt) { const tgt = V(MEET.x - 1.9, 0, MEET.z - 2.1); const d = this.moveToward(tgt, 2.2, dt, 6); this.face(d > 0.3 ? tgt : v.sb.pos, dt, 6); this.anim = d > 0.3 ? 'walk' : 'idle'; this.moveSpeed = 2.2; this.animOpt = { lash: false }; };
      v.ev = 0; v.T = 0; v.done = false;
      v.shot = { pos: V(MEET.x + 4.5, 2.4, MEET.z - 9.5), look: V(MEET.x - 4, 1.2, MEET.z - 5) };
      g.ui.caption('НЬЮ-ЙОРК. 02:14 НОЧИ.', 0.45);
      A().heartbeat(0.4);
    },
    update(g, dt, v) {
      v.T += dt;
      const sb = v.sb, b = v.b;
      if (v.ev === 0 && v.T > 5.2) {
        v.ev = 1;
        chain(g, v, [
          ['but', 'Неплохо держишься для деда, которого сорок лет держали в морозилке.', 3],
          ['sb', 'Ты ещё кто такой?', 1.8],
          ['but', 'Билли Бутчер. Человек, который ненавидит Хоумлендера сильнее, чем ты.', 3],
          ['sb', 'Сомневаюсь, приятель. У меня список. Те, кто сдал меня русским. Мои старые «друзья». Все до единого.', 4],
          ['but', 'Я помогу найти каждого. Слово даю.', 2.4],
          ['sb', '…Но?', 1.4],
          ['but', 'Но сначала — Хоумлендер. Твой сынок.', 2.6],
          ['sb', '*усмехается* Сначала пацан в плаще. Потом — мои.', 2.8],
        ], Array.from({ length: 8 }, (_, i) => () => (i % 2 ? ots(b, sb, 1) : ots(sb, b, -1))), () => { v.ev = 2; v.T = 0; });
      }
      if (v.ev === 2) { // прибегает Хьюи на Темп-V
        if (!v.hu) {
          const hu = g.spawn('hughieV', MEET.x + 40, MEET.z - 4, {}); v.hu = hu; hu.invuln = true; hu.noPhysics = true;
          hu.think = function (dt) { const tgt = V(MEET.x - 0.4, 0, MEET.z - 3.4); const d = this.moveToward(tgt, 36, dt, 12); this.anim = d > 0.6 ? 'run' : 'idle'; this.moveSpeed = 30; this.face(d > 0.6 ? tgt : v.b.pos, dt, 10); if (d > 0.6) this.trail(); this.pos.y = 0; };
          A().whoosh(); g.fx.addShake(0.2);
          v.shot = { pos: V(MEET.x + 4, 1.6, MEET.z - 9), look: V(MEET.x + 6, 1.1, MEET.z - 3) };
        }
        if (v.T > 1.6) {
          v.ev = 3;
          chain(g, v, [
            ['hu', 'Билли! Я… я тоже принял Темп-V. Я быстрый. Очень быстрый.', 3],
            ['but', 'Ну ты и дурак, Хьюи. …Добро пожаловать в команду.', 3],
          ], [() => ots(b, v.hu, 1), () => ots(v.hu, b, -1)], () => { v.ev = 4; v.T = 0; });
        }
      }
      if (v.ev === 4) { // все трое в кадре
        sb.think = idle(() => v.b.pos);
        v.shot = { pos: V(MEET.x + 3.5, 0.7, MEET.z - 7.5), look: V(MEET.x - 1, 1.6, MEET.z - 2) };
        if (v.T < 0.05) { g.ui.caption('КОМАНДА СОБРАНА.', 0.5); A().stinger(); }
        if (v.T > 3.2) return true;
      }
      if (v.shot) cam(g, v.shot.pos, v.shot.look, v.ev === 0 ? 1.5 : 5);
      return false;
    },
    exit(g, v) { hide(v.sb); hide(v.b); hide(v.hu); v.sb = v.b = v.hu = null; g.cinema(null); },
  };

  // ---------- 2. Хоумлендер летит на перекрёсток ----------
  const flyStep = {
    text: 'Солдатик в Мидтауне',
    enter(g, v) {
      const P = g.player; P.place(ARENA.x - 70, 25, ARENA.z - 60, Math.PI * 0.25); P.flying = true;
      g.camYaw = Math.atan2(ARENA.x - P.pos.x, ARENA.z - P.pos.z); g.camPitch = 0.15;
      g.ui.say([['news', 'Срочно: Солдатик замечен в Мидтауне!', 2.4], ['hl', 'Папочка вернулся. Как трогательно.', 2.4]]);
      g.music('combat');
    },
    update(g) { const P = g.player.pos; return Math.hypot(P.x - ARENA.x, P.z - ARENA.z) < 30; },
    wp: () => ARENA.clone().setY(2),
  };

  // общий «отход» босса: прыгает высоко и исчезает
  function retreat(g, a, line, done) {
    a.invuln = true; a.noPhysics = true; a.stopEyes && a.stopEyes(); g.fx.setBeam(4, null);
    if (a.chestGlow) a.chestGlow.visible = false;
    const dir = a.pos.clone().sub(g.player.pos).setY(0).normalize();
    let t = 0;
    a.think = function (dt) {
      t += dt; this.vel.copy(dir).multiplyScalar(14).setY(26); this.anim = 'jump';
      if (t > 1.3) { done(this.hp); hide(this); }
    };
    A().whoosh(); g.fx.dust(a.pos, 16); g.ui.say([line]);
  }

  // ---------- 3. Солдатик, второй раунд ----------
  const sbStep = {
    text: 'Солдатик. Второй раунд',
    enter(g, v) {
      const sb = g.spawn('soldierboy', ARENA.x + 8, ARENA.z + 14, {}); v.sb = sb; sb.keepBody = true;
      g.fx.dust(sb.pos, 20); A().slam(); g.fx.addShake(0.5);
      g.ui.statcard('СОЛДАТИК', [['СИЛА', 'MAX'], ['ЩИТ', 'ДА'], ['ВЗРЫВ ИЗ ГРУДИ', 'ДА'], ['ЗЛОСТЬ', 'MAX']], 'Второй раунд', 3);
      g.ui.say([['sb', 'Второй раунд, сынок. На этот раз без поддавков.', 2.6], ['hl', 'Ты мне не отец.', 1.8]]);
      g.music('boss'); v.out = false;
    },
    update(g, dt, v) {
      const sb = v.sb;
      if (!v.out) {
        g.ui.boss('Солдатик', sb.hp / sb.maxHp);
        if (sb.hp < sb.maxHp * 0.55) { v.out = true; g.ui.boss(null); retreat(g, sb, ['sb', 'Билли! Твоя очередь — он твой!', 2.2], (hp) => { v.sbHp = hp; v.sbGone = true; }); }
      }
      return !!v.sbGone;
    },
    exit(g) { g.ui.boss(null); },
  };

  // ---------- 4. Бутчер с жёлтыми лазерами ----------
  const butStep = {
    text: 'Бутчер на Темп-V',
    enter(g, v) {
      const b = g.spawn('butcherBoss', ARENA.x - 10, ARENA.z - 8, { noTent: true, eyes: true }); v.b = b; b.keepBody = true;
      b.setSt('leap', 1.3); b.leapFrom.copy(b.pos).add(V(-20, 0, -10)); b.leapTo.copy(b.pos);
      g.ui.statcard('БИЛЛИ БУТЧЕР', [['СИЛА', 'ТЕМП-V'], ['ЛАЗЕРЫ', 'ЖЁЛТЫЕ'], ['НЕНАВИСТЬ', 'MAX'], ['УРОВЕНЬ', '90']], 'Глаза светятся жёлтым', 3);
      g.ui.say([['but', 'Привет, дорогуша. Смотри-ка — у меня тоже глазки светятся.', 2.8]]);
      v.out = false;
    },
    update(g, dt, v) {
      const b = v.b;
      if (!v.out) {
        g.ui.boss('Бутчер (Темп-V)', b.hp / b.maxHp);
        if (b.hp < b.maxHp * 0.55) { v.out = true; g.ui.boss(null); retreat(g, b, ['but', 'Хьюи! Солдат! Все вместе — сейчас!', 2.2], (hp) => { v.bHp = hp; v.bGone = true; }); }
      }
      return !!v.bGone;
    },
    exit(g) { g.ui.boss(null); },
  };

  // ---------- 5. Трое против одного (умереть нельзя) ----------
  const trioStep = {
    text: 'Трое против одного',
    enter(g, v) {
      g.noDeath = true;
      const sb = g.spawn('soldierboy', ARENA.x + 12, ARENA.z + 6, {}); sb.hp = v.sbHp || sb.maxHp * 0.55;
      const b = g.spawn('butcherBoss', ARENA.x - 12, ARENA.z + 4, { noTent: true, eyes: true }); b.hp = v.bHp || b.maxHp * 0.55;
      const hu = g.spawn('hughieV', ARENA.x, ARENA.z - 14, {});
      for (const a of [sb, b, hu]) { a.minHp = a.maxHp * 0.12; a.keepBody = true; g.fx.dust(a.pos, 14); }
      v.sb = sb; v.b = b; v.hu = hu; v.T = 0;
      A().stinger(); g.fx.addShake(0.5);
      g.ui.say([['hu', 'Привет, Хоумлендер! Сюрприз!', 1.8], ['sb', 'Все вместе, ребята! Держим его!', 2.2]]);
      g.ui.hint('Их трое. Держитесь!', 3);
    },
    update(g, dt, v) {
      v.T += dt;
      const P = g.player, all = [v.sb, v.b, v.hu];
      g.ui.boss('Солдатик · Бутчер · Хьюи', all.reduce((s, a) => s + a.hp / a.maxHp, 0) / 3);
      const worn = all.filter((a) => a.hp <= a.minHp + 1).length;
      return P.hp < P.maxHp * 0.35 || v.T > 50 || worn >= 1;
    },
    exit(g) { g.ui.boss(null); },
  };

  // ---------- 6. Особняк: прижали к полу, Солдатик выжигает V… но Хоумлендер вырывается ----------
  const houseStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, Hs = v.house, c = Hs.center;
      g.noDeath = true; g.music(null); A().setLaser(false);
      for (const a of g.actors) if (a.alive && a.faction === 'enemy' && ![v.sb, v.b, v.hu].includes(a)) hide(a);
      g.fx.setBeam(2, null); g.fx.setBeam(3, null); g.fx.setBeam(4, null);
      v.b.stopEyes && v.b.stopEyes(); if (v.sb.chestGlow) v.sb.chestGlow.visible = false;
      g.cinema(c.clone().add(V(-6, 2.4, -4.5)), c);
      // в особняке анимацией героев управляет сама кат-сцена
      for (const a of [v.sb, v.b, v.hu]) { a.noPhysics = true; a.vel.set(0, 0, 0); a.downT = 0; a.airborne = false; a.anim = 'idle'; a.animOpt = {}; a.think = function () { this.vel.set(0, 0, 0); }; }
      // стартовые позиции: Хоумлендер влетает сквозь окно
      v.win = c.clone().add(V(1.5, 2.2, Hs.RD / 2 - 0.4));
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.noClip = false; P.scriptMove = null; P.scriptFace = Math.PI;
      P.place(v.win.x, v.win.y - 1, v.win.z, Math.PI); P.scriptVel = V(-1, -3, -13); P.scriptPose = 'tumble'; P.scriptOpt = { spin: 0 };
      v.sb.pos.set(c.x + 9, 0, c.z + Hs.RD / 2 + 4); v.b.pos.set(c.x - Hs.RW / 2 - 2, 0, c.z - 3.5); v.hu.pos.set(c.x - Hs.RW / 2 - 6, 0, c.z - 3.5);
      v.h = { ph: 'crash', T: 0, spin: 0 };
      cut(g, c.clone().add(V(-5.5, 2.6, -4.5)), v.win.clone().lerp(c, 0.4));
      g.fx.burst(v.win, 40, { color: [0xcfe8ff, 0xffffff, 0x9ac8ff], speed: 12, size: 0.18, life: 1, g: -20 });
      A().explosion(0.5); A().clang(); g.fx.addShake(0.8);
      g.ui.say([['sys', '*Солдатик швыряет Хоумлендера сквозь окно особняка*', 2.2]]);
    },
    update(g, dt, v) {
      const h = v.h, P = g.player, Hs = v.house, c = Hs.center, sb = v.sb, b = v.b, hu = v.hu;
      h.T += dt;
      const go = (ph) => { h.ph = ph; h.T = 0; };
      const fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
      switch (h.ph) {
        case 'crash': { // влетел, кувыркается, падает
          h.spin -= dt * 9; P.scriptOpt = { spin: h.spin };
          if (P.pos.y <= 0.05 || h.T > 1.0) { P.scriptVel = V(0, 0, 0); P.pos.y = 0; P.scriptPose = 'knocked'; P.scriptOpt = null; g.fx.dust(P.pos, 10); A().slam(); }
          if (h.T > 0.5) { // Солдатик запрыгивает следом, Бутчер и Хьюи — через дверь
            const k = Math.min(1, (h.T - 0.5) / 0.7);
            sb.pos.lerpVectors(V(v.win.x, 0, v.win.z + 1.5), V(c.x + 2.6, 0, c.z + 1.5), k); sb.pos.y = Math.sin(k * Math.PI) * 1.2; sb.anim = k < 1 ? 'jump' : 'idle';
            if (k < 0.1) { g.fx.burst(v.win, 12, { color: [0xcfe8ff, 0xffffff], speed: 8, size: 0.15, life: 0.8, g: -20 }); }
          }
          if (h.T > 0.9) {
            b.pos.lerp(V(c.x - 3.8, 0, c.z - 1.6), 1 - Math.exp(-3 * dt)); b.anim = 'run'; b.moveSpeed = 6; b.face(P.pos, dt, 6);
            hu.pos.lerp(V(c.x - 1.2, 0, c.z - 3.4), 1 - Math.exp(-8 * dt)); hu.anim = 'run'; hu.moveSpeed = 30; hu.trail();
          }
          cam(g, c.clone().add(V(-5.5, 2.6, -4.5)), P.center.lerp(c, 0.3), 3);
          if (h.T > 2.2) { go('getup'); P.scriptPose = null; P.place(P.pos.x, 0, P.pos.z, Math.PI); }
          break;
        }
        case 'getup': { // встаёт — Солдатик заходит сзади
          P.scriptFace = -Math.PI / 2; b.anim = 'idle'; hu.anim = 'idle';
          const back = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)).multiplyScalar(-0.75);
          sb.pos.lerp(P.pos.clone().add(back), 1 - Math.exp(-6 * dt)); sb.face(P.pos, dt, 10); sb.anim = 'walk'; sb.moveSpeed = 3;
          cam(g, P.center.add(V(0.5, 0.4, 4.2)), P.center.add(V(-0.3, 0.1, 0)), 3);
          if (h.T > 1.2) { go('suplex'); P.scriptFace = -Math.PI / 2; P.place(P.pos.x, 0, P.pos.z, -Math.PI / 2); h.pivot = sb.pos.clone(); h.fw = V(-1, 0, 0); A().whoosh(); g.ui.say([['sb', 'Иди-ка сюда, сынок!', 1.4]]); }
          break;
        }
        case 'suplex': { // бросок на прогиб
          const k = Math.min(1, h.T / 0.9), th = k * Math.PI;
          sb.anim = k < 0.5 ? 'grab' : 'charge'; sb.face(sb.pos.clone().add(h.fw), dt, 20);
          P.scriptVel = V(0, 0, 0); P.scriptPose = 'tumble'; P.scriptOpt = { spin: th * 1.05 };
          P.pos.copy(h.pivot).addScaledVector(h.fw, 0.75 * Math.cos(th)).add(V(0, 1.7 * Math.sin(th), 0));
          cam(g, h.pivot.clone().add(V(0.6, 1.4, 5.2)), h.pivot.clone().add(V(0, 1.2, 0)), 6);
          if (k >= 1) {
            A().slam(); A().punch(); g.fx.addShake(1.4); g.ui.flash(0.25); g.hitStop = 0.12;
            g.fx.dust(P.pos, 20); g.fx.burst(P.pos.clone().setY(0.2), 22, { color: [0x7a5232, 0x5a3a22, 0xd8ccb0], speed: 9, size: 0.3, life: 1, g: -20, up: true });
            for (let i = 0; i < 5; i++) g.fx.scorch(P.pos.clone().add(V(U.rand(-0.9, 0.9), 0.08, U.rand(-0.9, 0.9))), V(0, 1, 0));
            go('pin');
          }
          break;
        }
        case 'pin': { // прижимают лицом к полу
          if (h.T < dt * 1.5) {
            g.ui.flash(0.15);
            P.place(c.x, 0, c.z + 0.5, Math.PI / 2); P.scriptPose = 'prone'; P.scriptOpt = { struggle: 0.3 }; P.scriptVel = V(0, 0, 0);
            const f = V(1, 0, 0), l = V(0, 0, -1);
            sb.pos.copy(P.pos).addScaledVector(f, 0.55).setY(0.28); sb.yaw = Math.PI / 2;
            b.pos.copy(P.pos).addScaledVector(f, 0.9).addScaledVector(l, 1.05); hu.pos.copy(P.pos).addScaledVector(f, 0.9).addScaledVector(l, -1.05);
            b.face(P.pos.clone().addScaledVector(f, 0.9), 0); hu.face(P.pos.clone().addScaledVector(f, 0.9), 0);
            sb.think = function () { this.anim = 'sit'; this.animOpt = {}; this.vel.set(0, 0, 0); };
            b.think = hu.think = function () { this.anim = 'charge'; this.animOpt = { lash: false }; this.vel.set(0, 0, 0); };
            cut(g, c.clone().add(V(3.2, 2.6, 4.2)), P.center.add(V(0.6, -0.6, 0)));
            g.ui.say([['but', 'Держи его, Хьюи! ДЕРЖИ!', 1.8]]);
          }
          if (h.T > 1.4) {
            go('charge'); h.hb = 0;
            sb.chestGlow.visible = true; A().charge(6.5);
            chain(g, v, [
              ['sb', 'Не дёргайся, сынок. Это даже не больно… почти.', 2.2],
              ['hl', 'Слезь… С МЕНЯ!', 1.4],
              ['hu', 'Он слишком сильный, Билли!', 1.4],
              ['sb', 'Ещё чуть-чуть… и вся твоя V сгорит к чертям!', 1.8],
            ], null, null);
          }
          break;
        }
        case 'charge': { // Солдатик заряжает грудь, Хоумлендер вырывается
          const k = Math.min(1, h.T / 7.2);
          sb.chestGlow.scale.setScalar(0.5 + k * 4.5);
          const chest = V(); sb.chestGlow.getWorldPosition(chest);
          g.fx.flashLight(chest, 0xffa040, 1 + k * 6, 0.06, 10 + k * 10);
          if (Math.random() < 0.3 + k) g.fx.burst(chest, 1, { color: [0xffd080, 0xffa040], speed: 3, size: 0.2, life: 0.4, g: 0 });
          P.scriptOpt = { struggle: 0.3 + k * 1.4 }; P.scriptGlow = k > 0.35;
          P.pos.x = c.x + Math.sin(g.time * 23) * 0.05 * k; g.fx.addShake(0.05 + k * 0.2 * dt * 10);
          h.hb -= dt; if (h.hb <= 0) { h.hb = 0.9 - k * 0.6; A().heartbeat(0.4 + k * 0.5); }
          // кадры: лицо у пола → общий → Солдатик
          const shot = Math.floor(h.T / 2.4) % 3;
          if (shot === 0) cam(g, P.center.add(V(3.6, -0.55, 0)), P.center.add(V(0.8, -0.85, 0)), 4);
          else if (shot === 1) cam(g, c.clone().add(V(3.6, 3.2, 4.6)), P.center.add(V(0.5, -0.4, 0)), 3);
          else cam(g, chest.clone().add(V(1.6, 0.6, 1.4)), chest, 4);
          if (k >= 1) { // РЫК
            go('roar'); A().roar(); A().stinger(); g.ui.flash(0.6); g.fx.addShake(1.5); g.hitStop = 0.15;
            sb.chestGlow.visible = false; P.scriptGlow = true;
            g.fx.ring(P.pos.clone().setY(0.4), 0xffffff, 14, 0.5); g.fx.ring(P.pos.clone().setY(1.2), 0xff6040, 10, 0.4);
            g.fx.burst(P.center, 40, { color: [0xffffff, 0xff6040, 0xffd0a0], speed: 18, size: 0.35, life: 0.6 });
            for (const a of [sb, b, hu]) {
              const out = a.pos.clone().sub(P.pos).setY(0); if (out.lengthSq() < 0.01) out.set(1, 0, 0); out.normalize();
              a.noPhysics = false; a.think = idle(() => P.pos); a.vel.copy(out.multiplyScalar(17)).setY(9); a.airborne = true; a.spin = 9; a.downT = 3.5;
            }
            g.ui.say([['hl', 'Р-Р-Р-А-А-А-А!', 1.4]]);
          }
          break;
        }
        case 'roar': { // вырывается вверх сквозь потолок
          P.scriptPose = null; P.scriptOpt = null;
          if (h.T > 0.25) { P.noClip = true; P.flying = true; P.scriptVel = V(0, h.T < 0.45 ? 14 : 55, 0); }
          if (P.pos.y > Hs.H - 2.2 && !h.ceil) {
            h.ceil = true; const cp = V(P.pos.x, Hs.H - 0.2, P.pos.z);
            const hole = new T.Mesh(new T.CircleGeometry(1.3, 9), new T.MeshBasicMaterial({ color: 0x05060c, side: T.DoubleSide })); hole.rotation.x = Math.PI / 2; hole.position.set(cp.x, Hs.H - 0.03, cp.z); g.scene.add(hole);
            const hole2 = hole.clone(); hole2.position.y = Hs.H + 2.0; hole2.scale.setScalar(1.6); g.scene.add(hole2);
            for (let i = 0; i < 40; i++) g.fx.burst(cp, 1, { color: [0xf2ead8, 0xd8ccb0, 0x7a5232], speed: 11, size: 0.45, life: 1.6, g: -20 });
            g.fx.dust(cp, 12); A().explosion(1); g.fx.addShake(1);
          }
          cam(g, c.clone().add(V(3.5, 0.6, 3.5)), P.center, 5);
          if (h.T > 1.3) { go('sky'); cut(g, c.clone().add(V(26, 3, 30)), c.clone().add(V(0, 10, 0))); }
          break;
        }
        case 'sky': { // снаружи: уходит в облака
          P.noClip = true; P.flying = true; P.scriptVel = V(0, 60 + h.T * 60, 0); P.scriptPose = null;
          if (h.T < 0.05) { const roof = c.clone().add(V(0, Hs.H + 1, 0)); g.fx.explosion(roof, 1.2); for (let i = 0; i < 30; i++) g.fx.burst(roof, 1, { color: [0x5a3a32, 0xd8ccb0], speed: 16, size: 0.5, life: 2, g: -20, up: true }); }
          if (P.pos.y > 110 && !h.boom) { h.boom = true; HL.Audio.sonic ? HL.Audio.sonic() : A().explosion(1.5); g.fx.ring(P.pos.clone(), 0xffffff, 40, 0.8); }
          cam(g, c.clone().add(V(26, 3, 30)), V(c.x, Math.min(P.pos.y, 150), c.z), 3);
          if (h.T > 4.2) {
            go('after');
            P.scriptVel = V(0, 0, 0); P.place(c.x, 300, c.z, 0); P.scriptGlow = false;
            for (const a of [sb, b, hu]) { a.downT = 0; a.airborne = false; a.noPhysics = false; a.think = idle(() => c); }
            sb.pos.set(c.x + 3.5, 0, c.z + 2); b.pos.set(c.x - 3.2, 0, c.z + 1); hu.pos.set(c.x - 1, 0, c.z - 3);
            cut(g, c.clone().add(V(-6, 2.2, 4.5)), c.clone().add(V(0, 1.6, 0)));
            chain(g, v, [
              ['sb', '…Чёрт. Ещё секунда — и всё.', 2.2],
              ['but', 'Упустили. Мать твою, упустили!', 2],
              ['hu', 'Что теперь, Билли?', 1.6],
              ['but', 'Теперь он сам придёт за нами. Встретим его. В Белом доме.', 3],
            ], null, () => { h.done = true; });
          }
          break;
        }
        case 'after': {
          cam(g, c.clone().add(V(-6, 2.2, 4.5)), c.clone().add(V(0, 1.4, 0)), 1.5);
          const ceilHole = V(c.x, Hs.H, c.z + 0.5);
          if (Math.random() < 0.2) g.fx.burst(ceilHole, 1, { color: [0xf2ead8, 0xd8ccb0], speed: 1, size: 0.15, life: 1.5, g: -10 });
          if (h.done) return true;
          break;
        }
      }
      return false;
    },
    exit(g, v) {
      const P = g.player; P.scriptPose = null; P.scriptOpt = null; P.scriptVel = V(); P.scriptGlow = false; P.noClip = false;
      g.noDeath = false;
    },
  };

  const mission = {
    id: 'trio', title: 'Трое против одного', desc: 'Ночью Бутчер находит Солдатика и предлагает сделку. К ним присоединяется Хьюи на Темп-V.',
    time: 'night', location: 'НЬЮ-ЙОРК · 02:14', start: [-160, 0, -120, 0], music: null,
    setup(g, v) {
      v.house = g.world.buildHouse(HOUSE.x, HOUSE.z);
      // реквизит на ночной улице: ящик, бочка с огнём, фонарь
      const crate = new T.Mesh(M.box(0.9, 0.42, 0.7), M.toon(0x6a4a2a)); crate.position.set(MEET.x, 0.21, MEET.z); crate.castShadow = true; g.scene.add(crate);
      const barrel = new T.Mesh(M.cyl(0.4, 0.4, 1, 12), M.toon(0x3a3d44)); barrel.position.set(MEET.x + 1.5, 0.5, MEET.z + 1.1); barrel.castShadow = true; g.scene.add(barrel);
      const fl = new T.PointLight(0xffa050, 2.2, 16, 1.4); fl.position.set(MEET.x + 1.5, 1.8, MEET.z + 1.1); g.scene.add(fl);
      v.fire = V(MEET.x + 1.5, 1.05, MEET.z + 1.1);
      g.missionUpdate = () => { if (Math.random() < 0.6) g.fx.burst(v.fire.clone().add(V(U.rand(-0.2, 0.2), 0, U.rand(-0.2, 0.2))), 1, { color: [0xffd040, 0xff8020, 0xff4010], speed: 1, size: 0.3, life: 0.6, g: 4, drag: 0.8, grow: -0.6, up: true }); fl.intensity = 2 + Math.random() * 0.5; };
    },
    steps: [meetStep, flyStep, sbStep, butStep, trioStep, houseStep],
  };

  return { mission };
})();
