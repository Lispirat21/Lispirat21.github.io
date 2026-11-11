// Миссия «Королева Мейв» (3 сезон): рукопашный бой на крыше башни Vought и на улице.
HL.MaeveFight = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const C = V(105, 164, 35);          // крыша башни Vought
  const LAND = V(140, 0, 35);         // улица, куда они падают
  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  function chain(g, v, lines, shots, done) {
    let i = 0;
    const next = () => { if (i >= lines.length) { done && done(); return; } if (shots && shots[i]) v.shot = shots[i](); g.ui.say([lines[i]], next); i++; };
    next();
  }
  const ots = (from, to, side = 1) => {
    const d = to.pos.clone().sub(from.pos).setY(0).normalize(), r = V(-d.z, 0, d.x).multiplyScalar(side);
    return { pos: from.center.addScaledVector(d, -2.2).addScaledVector(r, 1.1).add(V(0, 0.5, 0)), look: to.center.add(V(0, 0.35, 0)) };
  };
  const setMaeveAI = (mv, on) => { mv.think = on ? HL.Actors.Maeve.prototype.think : function (dt) { this.vel.x = 0; this.vel.z = 0; }; if (on) mv.setSt('approach', 0); };

  // будка выхода на крышу
  function buildRoof(g) {
    const grp = new T.Group(); g.scene.add(grp);
    const b = new T.Mesh(M.box(6, 4, 5), M.toon(0x2a3a58)); b.position.set(C.x - 9, C.y + 2, C.z); b.castShadow = true; grp.add(b);
    const d = new T.Mesh(M.box(0.1, 2.4, 1.3), M.toon(0x9aa0aa)); d.position.set(C.x - 5.95, C.y + 1.2, C.z); grp.add(d);
    const bx = g.world.addBox(C.x - 12, C.z - 2.5, C.x - 6, C.z + 2.5, C.y + 4, 'roofhut'); bx.y0 = C.y;
    for (const [x, z] of [[8, 8], [-4, -9], [9, -7]]) { const ac = new T.Mesh(M.box(2.4, 1.4, 2.4), M.toon(0x8a8e96)); ac.position.set(C.x + x, C.y + 0.7, C.z + z); ac.castShadow = true; grp.add(ac); }
    return grp;
  }
  // вертолёт новостей со прожектором
  function makeHeli(g, pos) {
    const grp = new T.Group(); grp.position.copy(pos); g.scene.add(grp);
    const body = new T.Mesh(M.sph(1.6), M.toon(0x1c3a8a)); body.scale.set(1.5, 1, 1); grp.add(body);
    const tail = new T.Mesh(M.box(5, 0.4, 0.4), M.toon(0x1c3a8a)); tail.position.set(-4, 0.3, 0); grp.add(tail);
    const rotor = new T.Mesh(M.box(9, 0.08, 0.4), M.toon(0x222222)); rotor.position.y = 1.8; grp.add(rotor);
    const logo = M.canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#fff'; x.font = 'bold 44px Arial Black'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VNN', w / 2, h / 2); });
    for (const sd of [-1, 1]) { const l = new T.Mesh(new T.PlaneGeometry(2, 0.5), new T.MeshBasicMaterial({ map: logo, transparent: true })); l.position.set(0.3, 0.2, sd * 1.62); l.rotation.y = sd > 0 ? 0 : Math.PI; grp.add(l); }
    const geo = new T.ConeGeometry(3, 30, 16, 1, true); geo.translate(0, -15, 0);
    const cone = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); grp.add(cone);
    const lamp = new T.PointLight(0xfff2d0, 2.5, 45, 1.2); g.scene.add(lamp);
    return {
      grp, update(dt, target) {
        rotor.rotation.y += dt * 30; grp.position.y += Math.sin(g.time * 1.3) * 0.01;
        const d = target.clone().sub(grp.position).normalize(); cone.quaternion.setFromUnitVectors(V(0, -1, 0), d.applyQuaternion(grp.quaternion.clone().invert()));
        lamp.position.copy(target).add(V(0, 6, 0));
      },
      remove() { g.scene.remove(grp); g.scene.remove(lamp); },
    };
  }

  // ---------- 1. Крыша. Мейв приходит остановить его ----------
  const introStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, mv = v.mv;
      P.place(C.x + 11, C.y, C.z + 1, Math.PI / 2); P.scriptPose = 'akimbo'; P.scriptFace = Math.PI / 2;
      mv.pos.set(C.x - 5.4, C.y, C.z); setMaeveAI(mv, false);
      mv.think = function (dt) { const tgt = V(C.x + 2, C.y, C.z); const d = this.moveToward(tgt, 2.2, dt, 6); this.anim = d > 0.3 ? 'walk' : 'idle'; this.moveSpeed = 2.2; this.face(d > 0.3 ? tgt : P.pos, dt, 6); this.animOpt = {}; };
      g.cinema(P.center, C); v.e = { ev: 0, T: 0 };
      cut(g, V(C.x + 24, C.y + 4, C.z + 14), P.center.add(V(0, 0.5, 0)));
      g.ui.caption('БАШНЯ VOUGHT. ЗАКАТ.', 0.42);
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, mv = v.mv; e.T += dt;
      if (e.ev === 0) {
        const k = Math.min(1, e.T / 4);
        cam(g, V(C.x + 24 - k * 8, C.y + 4 - k * 2, C.z + 14 - k * 9), P.center.add(V(0, 0.5, 0)), 1.5);
        if (e.T > 4) {
          e.ev = 1;
          chain(g, v, [
            ['mv', 'Джон. Хватит.', 1.6],
            ['hl', 'Мейв. Пришла читать мне мораль?', 2.2],
            ['mv', 'Я пришла тебя остановить. Ты убиваешь людей. Больше никто не будет молчать.', 3.2],
            ['hl', '*смеётся* Ты? Меня? Ты всегда была просто красивой картинкой на коробке хлопьев.', 3.4],
            ['mv', 'Тогда тебе нечего бояться.', 2],
          ], [() => ots(P, mv, 1), () => { P.scriptPose = null; P.scriptFace = Math.atan2(mv.pos.x - P.pos.x, mv.pos.z - P.pos.z); return ots(mv, P, -1); }, () => ots(P, mv, 1), () => ots(mv, P, -1), () => ({ pos: mv.center.add(V(2.4, 0.2, 1.2)), look: mv.center.add(V(0, 0.4, 0)) })],
          () => { e.ev = 2; e.T = 0; });
        }
      } else if (e.ev === 1) { if (v.shot) cam(g, v.shot.pos, v.shot.look, 4); }
      else if (e.ev === 2) {
        if (e.T < dt * 1.5) { g.ui.statcard('КОРОЛЕВА МЕЙВ', [['СИЛА', 'ВЫСОКАЯ'], ['РУКОПАШНАЯ', 'ЛЕГЕНДА'], ['НАРУЧИ', 'ДЕРЖАТ ЛАЗЕР'], ['УРОВЕНЬ', '80']], 'Лазер почти не берёт — бейте кулаками', 3.4); A().stinger(); mv.anim = 'charge'; }
        cam(g, mv.center.add(V(2.4, 0.2, 1.2)), mv.center.add(V(0, 0.4, 0)), 3);
        if (e.T > 2.2) return true;
      }
      return false;
    },
    exit(g, v) {
      const P = g.player; P.scriptPose = null; P.scriptFace = null;
      setMaeveAI(v.mv, true); v.mv.minHp = v.mv.maxHp * 0.65;
      g.camYaw = Math.atan2(v.mv.pos.x - P.pos.x, v.mv.pos.z - P.pos.z); g.camPitch = 0.15;
      g.cinema(null); g.music('boss');
      g.ui.hint('Мейв закрывается наручами от лазера. Деритесь врукопашную!', 4);
    },
  };

  const keepOnRoof = (a) => { if (a.pos.y > C.y - 8) { a.pos.x = U.clamp(a.pos.x, C.x - 12, C.x + 12); a.pos.z = U.clamp(a.pos.z, C.z - 12, C.z + 12); } };
  const fight = (until, text) => ({
    text,
    update(g, dt, v) {
      const mv = v.mv; if (v.onRoof) keepOnRoof(mv);
      g.ui.boss('Королева Мейв', mv.hp / mv.maxHp);
      return mv.hp <= mv.maxHp * until + 1;
    },
    wp: (g, v) => v.mv.center,
    exit(g) { g.ui.boss(null); },
  });

  // ---------- кулак в кулак (замедление) ----------
  const clashStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, mv = v.mv;
      setMaeveAI(mv, false); g.cinema(P.center, mv.center);
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.scriptVel = null;
      P.place(C.x + 6, C.y, C.z, -Math.PI / 2); mv.pos.set(C.x - 4, C.y, C.z); mv.vel.set(0, 0, 0);
      v.e = { ev: 0, T: 0 };
      cut(g, V(C.x + 1, C.y + 1.3, C.z + 7), V(C.x + 1, C.y + 1.4, C.z));
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, mv = v.mv; e.T += dt;
      const mid = V(C.x + 1, C.y + 1.55, C.z);
      if (e.ev === 0) { // разбег навстречу
        const k = Math.min(1, e.T / 0.9);
        P.pos.x = C.x + 6 - k * 4.2; mv.pos.x = C.x - 4 + k * 4.1; P.scriptFace = -Math.PI / 2; mv.yaw = Math.PI / 2;
        P.scriptPose = 'run'; mv.anim = 'run'; mv.moveSpeed = 12;
        cam(g, V(C.x + 1, C.y + 1.3, C.z + 7 - k * 2), mid, 4);
        if (k >= 1) { e.ev = 1; e.T = 0; g.slowmo = true; P.scriptPose = 'punch'; P.scriptOpt = { p: 0.2 }; mv.anim = 'punch'; mv.animOpt = { p: 0.2 }; A().whoosh(); }
      } else if (e.ev === 1) { // кулаки летят навстречу — замедленно
        const k = Math.min(1, e.T / 0.12);
        P.scriptOpt = { p: 0.2 + k * 0.5 }; mv.animOpt = { p: 0.2 + k * 0.5 };
        cam(g, mid.clone().add(V(0.4, 0.15, 2.4 - k * 0.8)), mid, 4);
        if (k >= 1) { // удар!
          e.ev = 2; e.T = 0; g.slowmo = false;
          A().slam(); A().punch(); A().explosion(0.8); g.fx.addShake(1.5); g.ui.flash(0.5); g.hitStop = 0.25;
          g.fx.ring(mid, 0xffffff, 16, 0.6); g.fx.ring(mid.clone().setY(C.y + 0.2), 0xffe0a0, 22, 0.8);
          g.fx.burst(mid, 40, { color: [0xffffff, 0xffe0a0], speed: 20, size: 0.25, life: 0.5 });
          for (let i = 0; i < 10; i++) g.fx.scorch(V(C.x + 1 + U.rand(-3, 3), C.y + 0.02, C.z + U.rand(-3, 3)), V(0, 1, 0));
          g.fx.dust(V(C.x + 1, C.y, C.z), 26);
        }
      } else if (e.ev === 2) { // отлетают друг от друга
        const k = Math.min(1, e.T / 0.6);
        P.pos.x = C.x + 1.8 + k * 3.2; mv.pos.x = C.x + 0.1 - k * 3.2; P.scriptPose = 'akimbo';
        mv.anim = 'charge'; if (Math.random() < 0.5) { g.fx.dust(P.pos, 1); g.fx.dust(mv.pos, 1); }
        cam(g, V(C.x + 1, C.y + 2.4, C.z + 9), V(C.x + 1, C.y + 1.2, C.z), 3);
        if (e.T > 0.9) {
          e.ev = 3; P.scriptPose = null;
          chain(g, v, [['mv', '*вытирает кровь с губы* И это всё, на что ты способен?', 2.6], ['hl', 'Я только разогреваюсь.', 1.8]],
            [() => ({ pos: mv.center.add(V(1.6, 0.25, 1.4)), look: mv.center.add(V(0, 0.45, 0)) }), () => ({ pos: P.center.add(V(-1.6, 0.25, 1.4)), look: P.center.add(V(0, 0.5, 0)) })], () => { e.done = true; });
        }
      } else if (e.ev === 3) {
        mv.anim = 'idle'; if (v.shot) cam(g, v.shot.pos, v.shot.look, 4);
        if (e.done) return true;
      }
      return false;
    },
    exit(g, v) { g.slowmo = false; const P = g.player; P.scriptPose = null; P.scriptOpt = null; P.scriptFace = null; setMaeveAI(v.mv, true); v.mv.minHp = v.mv.maxHp * 0.32; g.cinema(null); g.camYaw = -Math.PI / 2; g.camPitch = 0.12; },
  };

  // ---------- таран с крыши: падают вместе ----------
  const tackleStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, mv = v.mv;
      setMaeveAI(mv, false); g.cinema(P.center, mv.center);
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.scriptVel = V(0, 0, 0); P.noClip = true;
      P.place(C.x + 9, C.y, C.z, -Math.PI / 2); mv.pos.set(C.x - 4, C.y, C.z); mv.noPhysics = true;
      v.e = { ev: 0, T: 0 };
      cut(g, V(C.x + 3, C.y + 2, C.z + 10), V(C.x + 4, C.y + 1, C.z));
      g.ui.say([['mv', 'А-А-А-А!', 1.2]]);
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, mv = v.mv; e.T += dt;
      if (e.ev === 0) { // разбегается и врезается в него
        const k = Math.min(1, e.T / 0.8);
        mv.pos.x = C.x - 4 + k * 12.2; mv.yaw = Math.PI / 2; mv.anim = 'run'; mv.moveSpeed = 14; if (Math.random() < 0.6) g.fx.dust(mv.pos, 1);
        P.scriptFace = -Math.PI / 2;
        cam(g, V(C.x + 4, C.y + 2, C.z + 10), mv.center.lerp(P.center, 0.5), 4);
        if (k >= 1) { e.ev = 1; e.T = 0; A().punch(); A().slam(); g.fx.addShake(1); g.ui.flash(0.25); e.p0 = P.pos.clone(); }
      } else if (e.ev === 1) { // вместе летят с крыши вниз
        const k = Math.min(1, e.T / 3.4), s = k * k;
        const pos = V(U.lerp(e.p0.x, LAND.x, Math.min(1, k * 1.6)), U.lerp(C.y + 1, 1.2, s), C.z);
        P.pos.copy(pos); P.scriptPose = 'tumble'; P.scriptOpt = { spin: e.T * 3 };
        mv.pos.copy(pos).add(V(-0.7, 0.4, 0.3)); mv.anim = 'punch'; mv.animOpt = { p: (e.T * 2.5) % 1 }; mv.yaw = Math.PI / 2;
        if (Math.floor(e.T * 2.5) !== Math.floor((e.T - dt) * 2.5)) { A().punch(); g.fx.burst(P.center, 6, { color: [0xffffff, 0xffe0a0], speed: 8, size: 0.15, life: 0.25 }); }
        if (e.T < dt * 1.5) chain(g, v, [['hl', 'Ты сумасшедшая!', 1.4], ['mv', 'Ты даже не представляешь.', 1.8]], null, null);
        // камера падает вместе с ними
        cam(g, pos.clone().add(V(-5, 3.5, 7)), pos, 6);
        if (k >= 1) { // удар об асфальт и машину
          e.ev = 2; e.T = 0;
          g.fx.explosion(LAND.clone().setY(1), 1.6); A().explosion(1.4); A().slam(); g.fx.addShake(1.6); g.ui.flash(0.4); g.hitStop = 0.2;
          g.fx.dust(LAND, 40); g.fx.ring(LAND.clone().setY(0.3), 0xffffff, 18, 0.6);
          for (let i = 0; i < 10; i++) g.fx.scorch(LAND.clone().add(V(U.rand(-3, 3), 0.05, U.rand(-3, 3))), V(0, 1, 0));
          if (v.car) { v.car.obj.rotation.x = 0.3; v.car.obj.scale.set(1.1, 0.45, 1.1); }
          P.scriptPose = null; P.noClip = false; P.place(LAND.x + 1.5, 0, LAND.z + 0.5, -Math.PI / 2); P.downT = 1.4; P.spin = 0; P.c.cur.pitch = 0;
          mv.noPhysics = false; mv.pos.set(LAND.x - 2.5, 0, LAND.z - 0.6); mv.downT = 1.6; mv.airborne = false;
        }
      } else if (e.ev === 2) {
        cam(g, LAND.clone().add(V(-8, 3.5, 9)), LAND.clone().add(V(0, 0.8, 0)), 2.5);
        if (e.T > 2.2) return true;
      }
      return false;
    },
    exit(g, v) { const P = g.player; P.scriptPose = null; P.scriptOpt = null; P.scriptFace = null; P.scriptVel = null; P.noClip = false; v.onRoof = false; setMaeveAI(v.mv, true); v.mv.noPhysics = false; v.mv.minHp = v.mv.maxHp * 0.05; g.cinema(null); g.camYaw = -Math.PI / 2; g.camPitch = 0.15; g.ui.hint('Добейте её на улице!', 2.5); },
  };

  // ---------- финал: камеры смотрят ----------
  const endStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, mv = v.mv;
      setMaeveAI(mv, false); g.music(null);
      mv.think = function (dt) { this.stop(dt); this.anim = 'charge'; this.animOpt = {}; this.face(g.player.pos, dt, 4); };
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.scriptVel = null;
      const at = mv.pos.clone().setY(0); mv.pos.copy(at); mv.vel.set(0, 0, 0);
      P.place(at.x + 1.7, 0, at.z, -Math.PI / 2); P.scriptFace = -Math.PI / 2;
      g.cinema(P.center, mv.center);
      v.heli = makeHeli(g, at.clone().add(V(8, 22, -10)));
      // люди с телефонами
      v.watch = [];
      for (let i = 0; i < 12; i++) {
        const a = g.spawn('civ', at.x + U.rand(-14, 14), at.z + (Math.random() < 0.5 ? -1 : 1) * U.rand(7, 11), { stay: true });
        const ph = M.glowSprite(0xbfe0ff, 0.35); ph.position.set(0, -0.5, 0.1); a.c.elbowR.add(ph);
        a.think = function (dt) { this.stop(dt); this.anim = 'wave'; this.animOpt = {}; this.face(at, dt, 4); };
        v.watch.push(a);
      }
      v.e = { ev: 0, T: 0, at };
      cut(g, at.clone().add(V(-2.4, 1.2, 3.2)), P.center.add(V(0, 0.5, 0)));
      g.ui.say([['sys', '*Мейв стоит на коленях, вся в крови*', 2]]);
      A().setWind(30);
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, mv = v.mv, at = e.at; e.T += dt;
      v.heli.update(dt, P.pos);
      if (e.ev === 0) { // заносит кулак
        P.scriptPose = 'punch'; P.scriptOpt = { p: 0.12 };
        cam(g, at.clone().add(V(-2.6, 0.9, 2.8)), P.center.add(V(0, 0.6, 0)), 3);
        if (e.T > 1.6) { e.ev = 1; e.T = 0; g.slowmo = true;
          chain(g, v, [['mv', 'Давай. Пусть все увидят, кто ты на самом деле.', 3]], [() => ({ pos: mv.center.add(V(-1.8, 0.4, 1.2)), look: mv.center.add(V(0.3, 0.5, 0)) })], () => { e.ev = 2; e.T = 0; g.slowmo = false; }); }
      } else if (e.ev === 1) { if (v.shot) cam(g, v.shot.pos, v.shot.look, 3); }
      else if (e.ev === 2) { // замечает вертолёт и камеры
        P.scriptHead = -0.45; P.scriptFace = Math.atan2(v.heli.grp.position.x - P.pos.x, v.heli.grp.position.z - P.pos.z);
        cam(g, P.center.add(V(-1.5, -0.4, 2.2)), v.heli.grp.position, 3);
        if (e.T > 2.2) { e.ev = 3; e.T = 0; P.scriptPose = null; P.scriptHead = 0.1;
          chain(g, v, [['hl', '*опускает кулак и улыбается в камеру* …Не сегодня.', 2.4]], [() => ({ pos: P.center.add(V(0.2, 0.3, 2.4)).applyAxisAngle(V(0, 1, 0), 0), look: P.center.add(V(0, 0.6, 0)) })], () => { e.ev = 4; e.T = 0; }); }
      } else if (e.ev === 3) { if (v.shot) cam(g, v.shot.pos, v.shot.look, 3); }
      else if (e.ev === 4) { // улетает
        P.flying = true; P.scriptVel = V(0, e.T < 0.3 ? 4 : 70, 0); P.scriptFace = null; P.scriptHead = null;
        if (e.T < dt * 1.5) { A().whoosh(); g.fx.dust(P.pos, 16); g.fx.ring(P.pos.clone().setY(0.3), 0xffffff, 8, 0.4); }
        mv.think = function (dt) { this.stop(dt); this.anim = 'knocked'; this.animOpt = {}; };
        cam(g, at.clone().add(V(-5, 1.6, 6)), P.center.lerp(at, 0.5), 2);
        if (e.T > 2.6) { g.ui.caption('МЕЙВ ВЫЖИЛА. НО В СЕМЁРКУ ОНА БОЛЬШЕ НЕ ВЕРНУЛАСЬ.', 0.38); e.ev = 5; e.T = 0; }
      } else if (e.ev === 5) { cam(g, at.clone().add(V(-5, 1.6, 6)), at, 1); if (e.T > 3.5) return true; }
      return false;
    },
    exit(g, v) { g.slowmo = false; A().setWind(0); const P = g.player; P.scriptPose = null; P.scriptOpt = null; P.scriptHead = null; P.scriptVel = V(); },
  };

  const mission = {
    id: 'maeve', title: 'Королева Мейв', desc: 'Мейв решила, что больше не будет молчать. Рукопашная на крыше башни Vought.',
    time: 'dusk', location: 'БАШНЯ VOUGHT · КРЫША · 19:05', start: [C.x + 11, C.y, C.z + 1, Math.PI / 2], music: null,
    setup(g, v) {
      buildRoof(g); v.onRoof = true;
      v.mv = g.spawn('maeve', C.x - 5.4, C.z, { y: C.y }); v.mv.minHp = v.mv.maxHp * 0.65;
      v.car = g.spawn('car', LAND.x, LAND.z + 0.5, { yaw: 0.3 }); v.car.invuln = true;
      g.missionUpdate = () => { if (v.onRoof && v.mv) keepOnRoof(v.mv); };
    },
    steps: [introStep, fight(0.66, 'Победите Мейв'), clashStep, fight(0.33, 'Победите Мейв'), tackleStep, fight(0.05, 'Добейте Мейв'), endStep],
  };
  return { mission };
})();
