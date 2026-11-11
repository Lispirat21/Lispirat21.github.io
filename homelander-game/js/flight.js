// Миссия «Рейс 37» (1 сезон): угон самолёта, бой в салоне, лазер по кабине пилотов и выбор — спасти или улететь.
HL.Flight = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const PL = V(-240, 150, 330);   // центр самолёта (над полем за городом)
  const FY = PL.y - 1.4;          // пол салона
  const DOOR = V(PL.x - 12, FY, PL.z + 2.95);

  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  const hide = (a) => { if (a && !a.removed) a.remove(); };
  function chain(g, v, lines, shots, done) {
    let i = 0;
    const next = () => { if (i >= lines.length) { done && done(); return; } if (shots && shots[i]) v.shot = shots[i](); g.ui.say([lines[i]], next); i++; };
    next();
  }

  // ---------- самолёт: снаружи и салон внутри ----------
  function buildPlane(g) {
    const grp = new T.Group(); grp.position.copy(PL); g.scene.add(grp);
    const white = M.toon(0xf4f4f0), blue = M.toon(0x1f3f8f), red = M.toon(0xc22a33), grey = M.toon(0x9aa0aa), dark = M.toon(0x1a1e28);
    const mk = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = grp) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; };
    // фюзеляж
    mk(new T.CylinderGeometry(3, 3, 42, 24, 1, true), white, 0, 0, 0, 0, 0, Math.PI / 2);
    const nose = mk(new T.SphereGeometry(3, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), white, 21, 0, 0, 0, 0, -Math.PI / 2); nose.scale.set(1, 1.8, 1);
    mk(new T.ConeGeometry(3, 9, 24, 1, true), white, -25.5, 0.6, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.9);
    mk(M.box(6, 7, 0.45), white, -26.5, 4.6, 0, 0, 0, 0.35);                 // киль
    mk(M.box(5, 6.4, 0.5), blue, -26.6, 4.9, 0, 0, 0, 0.35);
    mk(M.box(4, 0.35, 13), white, -26, 1.2, 0);                              // стабилизатор
    mk(M.box(10, 0.5, 36), grey, -2, -1.5, 0, 0, 0.0, 0);                    // крылья
    for (const z of [-8, 8]) { mk(M.cyl(1, 1, 4.4, 14), grey, -0.5, -2.8, z, 0, 0, Math.PI / 2); mk(M.cyl(0.7, 0.7, 0.2, 14), dark, 1.8, -2.8, z, 0, 0, Math.PI / 2); }
    for (const z of [-3.02, 3.02]) { mk(M.box(40, 0.4, 0.06), blue, 0, -0.5, z); mk(M.box(40, 0.18, 0.06), red, 0, -0.95, z); }
    // логотип авиакомпании
    const logo = M.canvasTex(512, 96, (x, w, h) => { x.fillStyle = '#1f3f8f'; x.font = 'bold 64px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VOUGHT AIR · 37', w / 2, h / 2 + 4); });
    for (const sd of [-1, 1]) { const l = new T.Mesh(new T.PlaneGeometry(13, 2.4), new T.MeshBasicMaterial({ map: logo, transparent: true })); l.position.set(-4, 1.5, sd * 3.05); l.rotation.y = sd > 0 ? 0 : Math.PI; grp.add(l); }
    // иллюминаторы снаружи
    const winGeo = M.box(0.32, 0.42, 0.08), wm = new T.MeshBasicMaterial({ color: 0x2a3a58 });
    const wins = new T.InstancedMesh(winGeo, wm, 60); let wi = 0; const mtx = new T.Matrix4();
    for (let x = -18; x <= 16; x += 1.25) for (const z of [-2.99, 2.99]) { if (wi >= 60) break; mtx.makeTranslation(x, 0.45, z); wins.setMatrixAt(wi++, mtx); }
    wins.count = wi; grp.add(wins);
    mk(M.box(1.6, 0.7, 2.6), dark, 23.6, 0.9, 0, 0, 0, -0.5); // окна кабины
    // дверь (будет сорвана)
    const door = mk(M.box(1.2, 2.1, 0.12), M.toon(0xe6e6e0), DOOR.x - PL.x, -0.35, 3.0);
    const hole = new T.Mesh(new T.PlaneGeometry(1.2, 2.1), new T.MeshBasicMaterial({ color: 0x0c0c12 })); hole.position.set(DOOR.x - PL.x, -0.35, 3.01); hole.visible = false; grp.add(hole);

    // ===== салон =====
    const inner = new T.Mesh(new T.CylinderGeometry(2.85, 2.85, 40, 24, 1, true), M.toonX(0xefe6d6, { side: T.BackSide })); inner.rotation.z = Math.PI / 2; grp.add(inner);
    mk(M.box(40, 0.1, 5.4), M.toon(0x2a3a6a), 0, -1.45, 0);
    mk(M.box(40, 0.05, 0.9), M.toon(0x8a2a2a), 0, -1.39, 0); // ковровая дорожка
    for (const z of [-2.15, 2.15]) mk(M.box(34, 0.62, 0.9), M.toon(0xe0d8c8), -1, 0.95, z); // багажные полки
    const seatM = M.toon(0x2c4a8a), seats = new T.InstancedMesh(M.box(0.55, 0.45, 0.56), seatM, 120), backs = new T.InstancedMesh(M.box(0.14, 0.85, 0.56), seatM, 120);
    let si = 0; v_seats = [];
    for (let x = -17; x <= 12; x += 1.3) for (const z of [-2.05, -1.42, 1.42, 2.05]) {
      mtx.makeTranslation(x, -1.17, z); seats.setMatrixAt(si, mtx); mtx.makeTranslation(x - 0.3, -0.72, z); backs.setMatrixAt(si, mtx); si++; v_seats.push(V(PL.x + x, FY, PL.z + z));
    }
    seats.count = backs.count = si; grp.add(seats); grp.add(backs);
    const iw = new T.InstancedMesh(M.box(0.36, 0.5, 0.05), new T.MeshBasicMaterial({ color: 0xffd8a8 }), 60); wi = 0;
    for (let x = -18; x <= 16; x += 1.25) for (const z of [-2.8, 2.8]) { if (wi >= 60) break; mtx.makeTranslation(x, 0.3, z); iw.setMatrixAt(wi++, mtx); }
    iw.count = wi; grp.add(iw);
    // перегородка кабины пилотов и приборная панель
    for (const [z0, z1] of [[-2.8, -0.65], [0.65, 2.8]]) mk(M.box(0.2, 3.4, z1 - z0), M.toon(0xd8d0c0), 15, 0.2, (z0 + z1) / 2);
    mk(M.box(0.2, 1.0, 1.3), M.toon(0xd8d0c0), 15, 1.4, 0);
    const panel = mk(M.box(0.7, 1.1, 3.6), dark, 18.8, -0.7, 0);
    const scrM = new T.MeshBasicMaterial({ color: 0x40e0a0 });
    const screens = [];
    for (const z of [-1.2, -0.4, 0.4, 1.2]) { const sc = mk(M.box(0.05, 0.4, 0.55), scrM.clone(), 18.43, -0.5, z); screens.push(sc); }
    for (const z of [-0.8, 0.8]) { mk(M.box(0.6, 0.5, 0.6), M.toon(0x3a3a3a), 17.2, -1.15, z); mk(M.box(0.14, 0.9, 0.6), M.toon(0x3a3a3a), 16.85, -0.7, z); }
    // свет
    const l1 = new T.PointLight(0xfff0d8, 1.1, 26, 1.4); l1.position.set(-6, 1.2, 0); grp.add(l1);
    const l2 = new T.PointLight(0xfff0d8, 1.0, 22, 1.4); l2.position.set(9, 1.2, 0); grp.add(l2);
    const alarm = new T.PointLight(0xff2020, 0, 20, 1.4); alarm.position.set(12, 1.5, 0); grp.add(alarm);
    // коллайдеры салона (только пока самолёт неподвижен)
    const W = g.world, boxes = [];
    const box = (x0, z0, x1, z1, y0, y1, kind) => { const b = W.addBox(x0, z0, x1, z1, y1, kind); b.y0 = y0; b.y1 = y1; boxes.push(b); return b; };
    box(PL.x - 20, PL.z - 2.8, PL.x + 20, PL.z + 2.8, FY - 1.2, FY, 'planefloor');
    box(PL.x - 20, PL.z + 2.45, PL.x + 20, PL.z + 3.2, FY, FY + 3.6, 'planewall');
    box(PL.x - 20, PL.z - 3.2, PL.x + 20, PL.z - 2.45, FY, FY + 3.6, 'planewall');
    box(PL.x - 20.5, PL.z - 3, PL.x - 19.4, PL.z + 3, FY, FY + 3.6, 'planewall');
    box(PL.x + 19.2, PL.z - 3, PL.x + 20.5, PL.z + 3, FY, FY + 3.6, 'planewall');
    box(PL.x - 20, PL.z - 3, PL.x + 20, PL.z + 3, FY + 3.05, FY + 4, 'ceiling');
    box(PL.x + 14.9, PL.z - 2.8, PL.x + 15.1, PL.z - 0.65, FY, FY + 3.4, 'planewall');
    box(PL.x + 14.9, PL.z + 0.65, PL.x + 15.1, PL.z + 2.8, FY, FY + 3.4, 'planewall');
    const seatsList = v_seats; v_seats = null;
    return {
      grp, door, hole, panel, screens, alarm, seats: seatsList,
      nose: () => grp.localToWorld(V(24, -1.5, 0)),
      world: (x, y, z) => grp.localToWorld(V(x, y, z)),
      unlock() { for (const b of boxes) W.removeBox(b); },
    };
  }
  let v_seats = null;

  // облака, проносящиеся мимо самолёта
  function makeClouds(g) {
    const grp = new T.Group(); g.scene.add(grp);
    const cm = M.toon(0xffe8d8), list = [];
    for (let i = 0; i < 16; i++) {
      const cg = new T.Group();
      for (let k = 0; k < 4; k++) { const s = new T.Mesh(M.sph(1), cm); s.scale.set(7 + Math.random() * 6, 3 + Math.random() * 2.5, 5 + Math.random() * 4); s.position.set((k - 1.5) * 7, Math.random() * 2, Math.random() * 5); cg.add(s); }
      cg.position.set(PL.x + U.rand(-160, 160), PL.y + U.rand(-45, 30), PL.z + U.rand(-70, 70));
      if (Math.abs(cg.position.z - PL.z) < 14 && Math.abs(cg.position.y - PL.y) < 10) cg.position.y -= 22;
      grp.add(cg); list.push(cg);
    }
    return { grp, update(dt, speed, center) { for (const c of list) { c.position.x -= speed * dt; if (c.position.x < center.x - 170) c.position.x += 340; } } };
  }

  // ---------- шаги миссии ----------
  const introStep = {
    text: '…',
    enter(g, v) {
      const P = g.player, pl = v.plane;
      v.e = { ev: 0, T: 0 };
      P.place(PL.x - 30, PL.y - 40, PL.z + 18, Math.PI / 2); P.flying = true; P.scriptVel = V(0, 0, 0);
      g.cinema(PL.clone().add(V(-34, 9, 40)), PL);
      cut(g, PL.clone().add(V(-38, 10, 44)), PL.clone().add(V(4, 0, 0)));
      g.ui.caption('РЕЙС 37. ВЫСОТА 12 000 МЕТРОВ.', 0.42);
      A().setWind(60);
      // угонщики и пассажиры
      const pass = pl.seats.filter((_, i) => i % 3 !== 1).slice(0, 26);
      v.pass = pass.map((p, i) => {
        const def = i === 7 ? Object.assign(M.randomCivDef(), { scale: 0.62 }) : undefined;
        const a = g.spawn('civ', p.x, p.z, { y: p.y + 0.05, def, stay: true }); a.yaw = Math.PI / 2; a.kid = i === 7;
        a.think = function (dt) { this.stop(dt); this.anim = this.panic ? 'scared' : this.cheering ? 'cheer' : 'sit'; this.animOpt = {}; this.yaw = Math.PI / 2; };
        return a;
      });
      v.kid = v.pass[7];
      const hjPos = [[-6, 0], [-1, 0.2], [3, -0.2], [7.5, 0], [11, 0.1]];
      v.hj = hjPos.map(([x, z]) => { const a = g.spawn('thug', PL.x + x, PL.z + z, { y: FY + 0.05, weapon: 'pistol', hp: 110, group: 'hj', static: true }); a.aggro = false; return a; });
      v.leader = g.spawn('thug', PL.x + 16.8, PL.z, { y: FY + 0.05, weapon: 'pistol', hp: 60 }); v.leader.invuln = true; v.leader.name = 'Главарь';
      v.leader.think = function (dt) { this.stop(dt); this.anim = 'shoot'; this.animOpt = {}; this.yaw = -Math.PI / 2; };
      for (const a of v.hj) a.think0 = a.think, a.think = function (dt) { this.stop(dt); this.anim = 'shoot'; this.animOpt = {}; this.yaw = -Math.PI / 2; };
      // Мейв в руках у Хоумлендера
      v.mv = g.spawn('maeve', PL.x - 30, PL.z + 18, { ally: true, y: PL.y - 40 }); v.mv.noPhysics = true;
      v.mv.think = function () { this.vel.set(0, 0, 0); this.anim = 'carried'; this.animOpt = {}; };
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, pl = v.plane;
      e.T += dt;
      v.clouds.update(dt, 55, PL);
      if (Math.random() < dt * 30) g.fx.burst(PL.clone().add(V(U.rand(-10, 20), U.rand(-3, 3), U.rand(-4, 4) + (Math.random() < 0.5 ? 4.5 : -4.5))), 1, { color: [0xffffff], speed: 1, size: 0.12, life: 0.4, g: 0, drag: 0, dir: V(-40, 0, 0), spread: 0.1 });
      if (e.ev === 0) {
        cam(g, PL.clone().add(V(-38 + e.T * 4, 10 - e.T, 44 - e.T * 2)), PL.clone().add(V(4, 0, 0)), 1.5);
        if (e.T > 4) { e.ev = 1; e.T = 0; cut(g, V(PL.x - 15, FY + 1.7, PL.z), V(PL.x + 6, FY + 1.2, PL.z));
          for (const a of v.pass) a.panic = true;
          chain(g, v, [['hj', 'Всем сидеть! Кто встанет — пристрелю!', 2.4], ['kid', 'Мама… мне страшно…', 1.8], ['hj', 'Заткнись! Никто вас не спасёт!', 2.2]], null, () => { e.ev = 2; e.T = 0; }); }
      } else if (e.ev === 1) {
        cam(g, V(PL.x - 15 + e.T * 0.6, FY + 1.7, PL.z), V(PL.x + 6, FY + 1.2, PL.z), 2);
      } else if (e.ev === 2) { // Хоумлендер несёт Мейв к самолёту
        const k = Math.min(1, e.T / 4.2), s = k * k * (3 - 2 * k);
        const from = PL.clone().add(V(-34, -28, 16)), to = V(DOOR.x + 0.5, FY + 0.6, DOOR.z + 3.2);
        P.pos.lerpVectors(from, to, s); P.flying = true; P.scriptVel = V(0, 0, 0); P.scriptFace = Math.PI / 2 - 0.4 * (1 - s);
        P.scriptPose = 'carry'; P.scriptOpt = { fly: true };
        const f = V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
        v.mv.pos.copy(P.pos).addScaledVector(f, 0.55).add(V(0, 0.75, 0)); v.mv.yaw = P.yaw + Math.PI / 2;
        if (e.T < dt * 1.5) chain(g, v, [['ash', '*по рации* Хоумлендер, угонщики на борту. Мейв с тобой. Только без жертв, ради бога.', 3.4], ['mv', 'Готов?', 1.2], ['hl', 'Я всегда готов.', 1.6]], null, null);
        cam(g, P.center.add(V(-9 + s * 3, 3 - s * 1.5, 7 - s * 2)), P.center.lerp(PL, 0.3), 3);
        if (e.T > 6.4) { e.ev = 3; e.T = 0; A().setLaser(true); }
      } else if (e.ev === 3) { // лазеры по двери
        P.scriptFace = Math.PI; // лицом к двери (дверь на борту со стороны +z, Хоумлендер снаружи)
        const dw = pl.door.getWorldPosition(V());
        const corner = dw.clone().add(V(Math.sin(e.T * 9) * 0.55, Math.cos(e.T * 7) * 0.95, 0.1));
        P.scriptGlow = true; g.fx.setBeam(0, P.eyePos(0), corner); g.fx.setBeam(1, P.eyePos(1), corner); g.fx.sparks(corner, 0xffd0a0, 3);
        cam(g, P.center.add(V(3.5, 1.2, 3.5)), dw.clone().lerp(P.center, 0.5), 3);
        if (e.T > 1.6) { // срывает дверь
          e.ev = 4; e.T = 0; A().setLaser(false); g.fx.setBeam(0, null); g.fx.setBeam(1, null); P.scriptGlow = false;
          v.doorFly = { m: pl.door, vel: V(-25, 4, 6), spin: V(3, 5, 2) };
          pl.door.parent.remove(pl.door); g.scene.add(pl.door); pl.door.position.copy(dw); pl.hole.visible = true;
          A().explosion(0.6); A().whoosh(); g.fx.addShake(0.6); g.fx.burst(dw, 30, { color: [0xffffff, 0xd8d8d0], speed: 14, size: 0.25, life: 0.8, g: -6 });
        }
      } else if (e.ev === 4) {
        const d = v.doorFly; d.m.position.addScaledVector(d.vel, dt); d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt;
        cam(g, P.center.add(V(-4, 1.5, 4.5)), d.m.position, 3);
        if (e.T > 1.2) return true;
      }
      if (e.ev < 2 && v.shot) {}
      return false;
    },
    exit(g, v) {
      const P = g.player;
      P.scriptPose = null; P.scriptOpt = null; P.scriptFace = null; P.scriptVel = null; P.flying = false;
      P.place(DOOR.x + 0.4, FY + 0.1, PL.z + 1.0, Math.PI / 2);
      v.mv.noPhysics = false; v.mv.pos.set(DOOR.x - 0.8, FY + 0.1, PL.z + 0.8); v.mv.think = HL.Actors.Maeve.prototype.think;
      for (const a of v.hj) { a.think = a.think0; a.aggro = true; a.static = false; a.prefDist = 6; }
      if (v.doorFly) { g.scene.remove(v.doorFly.m); }
      g.camYaw = Math.PI / 2; g.camPitch = 0.08;
      g.cinema(null); A().setWind(0); g.music('combat');
      g.ui.say([['hj', 'Это Хоумлендер!! Стреляйте!', 1.8], ['mv', 'Я беру левых!', 1.4]]);
      g.ui.hint('Осторожно с лазером — в салоне пассажиры!', 4);
    },
  };

  const fightStep = {
    text: 'Обезвредьте угонщиков',
    update(g, dt, v) {
      v.clouds.update(dt, 55, PL);
      const n = g.groupCount('hj');
      g.ui.el.oText.textContent = `Обезвредьте угонщиков: осталось ${n} · берегите пассажиров`;
      return n === 0;
    },
    wp: (g) => g.groupNearest('hj'),
  };

  // лазер в главаря → прожигает панель управления
  const cockpitStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      v.e = { ev: 0, T: 0 }; g.music(null);
      P.place(PL.x + 12.6, FY + 0.05, PL.z, Math.PI / 2); P.scriptFace = Math.PI / 2; P.scriptVel = null;
      v.mv.think = function (dt) { this.stop(dt); this.anim = 'idle'; this.animOpt = {}; this.face(g.player.pos, dt, 4); }; v.mv.pos.set(PL.x + 10.6, FY + 0.05, PL.z - 0.8);
      g.cinema(P.center, v.leader.center);
      cut(g, V(PL.x + 10.4, FY + 1.9, PL.z + 1.0), v.leader.center.add(V(0, 0.3, 0)));
      chain(g, v, [['hj', 'Ещё шаг — и я пущу пилоту пулю в голову! Слышишь?!', 2.6], ['hl', 'Ты не успеешь.', 1.6]],
        [() => ({ pos: V(PL.x + 10.4, FY + 1.9, PL.z + 1.0), look: v.leader.center.add(V(0, 0.3, 0)) }), () => ({ pos: V(PL.x + 15.2, FY + 1.6, PL.z - 1.2), look: P.center.add(V(0, 0.55, 0)) })],
        () => { v.e.ev = 1; v.e.T = 0; });
      v.pilots = [-0.8, 0.8].map((z) => { const a = g.spawn('civ', PL.x + 17.2, PL.z + z, { y: FY + 0.05, stay: true }); a.think = function (dt) { this.stop(dt); this.anim = 'sit'; this.yaw = Math.PI / 2; }; return a; });
    },
    update(g, dt, v) {
      const e = v.e, P = g.player, pl = v.plane;
      e.T += dt; v.clouds.update(dt, 55, PL);
      if (e.ev === 0 && v.shot) cam(g, v.shot.pos, v.shot.look, 5);
      if (e.ev === 1) { // глаза загораются, медленный выстрел
        P.scriptGlow = true;
        if (e.T < dt * 1.5) { g.slowmo = true; A().charge(0.6); }
        const tgt = v.leader.center.add(V(0, 0.55, 0));
        const k = Math.min(1, e.T / 0.35), panelP = pl.panel.getWorldPosition(V()).add(V(-0.3, 0.2, 0));
        const end = k < 1 ? P.eyePos(0).lerp(tgt, k) : panelP;
        g.fx.setBeam(0, P.eyePos(0), end, 1.4); g.fx.setBeam(1, P.eyePos(1), end, 1.4); A().setLaser(true);
        cam(g, V(PL.x + 11.0, FY + 1.85, PL.z + 0.6), tgt.clone().lerp(P.center, 0.25), 4);
        if (k >= 1 && !e.hit) { // луч прошёл сквозь главаря — прямо в приборы
          e.hit = true; g.slowmo = false;
          HL.Finale.cineHit(g, () => { v.leader.invuln = false; v.leader.damage(1e6, P); });
          g.fx.burst(tgt, 10, { color: [0xb01818, 0x7a0e0e], speed: 6, size: 0.15, life: 0.5, g: -16 });
        }
        if (e.hit) { g.fx.sparks(panelP, 0xffd0a0, 4); if (Math.random() < 0.3) g.fx.fire(panelP, 1); }
        if (e.T > 1.6) { // взрыв приборной панели
          e.ev = 2; e.T = 0; g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false); P.scriptGlow = false;
          g.fx.explosion(panelP, 0.7); A().explosion(0.8); g.fx.addShake(1.0); g.ui.flash(0.3);
          for (const s of pl.screens) s.material.color.setHex(0x220000);
          for (const a of v.pilots) cineKill(g, a);
          for (const a of v.pass) a.panic = true;
        }
      } else if (e.ev === 2) { // тревога, самолёт клюёт носом
        pl.alarm.intensity = (Math.floor(g.time * 4) % 2) * 3;
        g.camRoll = Math.min(0.22, e.T * 0.08) * Math.sin(g.time * 0.7 + 1);
        g.fx.addShake(0.05); if (Math.random() < dt * 6) g.fx.smoke(pl.panel.getWorldPosition(V()), 1);
        if (e.T < dt * 1.5) { A().alarm(); chain(g, v, [['sys', '*ВНИМАНИЕ. ПОТЕРЯ УПРАВЛЕНИЯ. СНИЖЕНИЕ.*', 2.2], ['mv', 'Ты что наделал?! Ты сжёг управление!', 2.2], ['hl', '…', 1]], null, () => { e.ev = 3; e.T = 0; }); }
        if (Math.floor(e.T * 0.8) !== Math.floor((e.T - dt) * 0.8)) A().alarm();
        cam(g, V(PL.x + 11.5, FY + 1.6, PL.z + 1.6), P.center.add(V(0, 0.5, 0)), 3);
      } else if (e.ev === 3) {
        pl.alarm.intensity = (Math.floor(g.time * 4) % 2) * 3;
        g.camRoll = 0.15 * Math.sin(g.time * 0.7 + 1);
        if (!e.asked) {
          e.asked = true; HL.Input.unlock();
          g.ui.choice('Самолёт падает. Что сделает Хоумлендер?', [
            { text: 'Спасти самолёт', sub: 'Удержать его на руках и посадить. Это почти невозможно', fn: () => { v.choice = 'save'; e.done = true; } },
            { text: 'Улететь', sub: 'Свидетелей не останется', fn: () => { v.choice = 'leave'; e.done = true; } },
          ]);
        }
        if (e.done) return true;
      }
      return false;
    },
    exit(g, v) { g.slowmo = false; },
  };
  function cineKill(g, a) { HL.Finale.cineHit(g, () => { a.invuln = false; a.damage(1e6, null); }); } // пилоты гибнут от взрыва, не от Хоумлендера

  // ---------- развязка: улететь или спасти ----------
  const outcomeStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      v.o = { ph: v.choice === 'leave' ? 'l_kid' : 's_go', T: 0 };
      if (v.choice === 'leave') {
        P.place(PL.x + 2, FY + 0.05, PL.z, -Math.PI / 2);
        const kid = v.kid; kid.panic = false; kid.think = function (dt) { this.stop(dt); this.anim = 'idle'; this.animOpt = {}; this.face(g.player.pos, dt, 6); };
        kid.pos.set(PL.x - 0.4, FY + 0.05, PL.z + 0.1);
        P.scriptFace = -Math.PI / 2;
        v.mv.pos.set(PL.x + 3.6, FY + 0.05, PL.z - 0.9);
        cut(g, kid.center.add(V(1.2, 0.2, 0.9)), P.center.add(V(0, 0.5, 0)));
        chain(g, v, [
          ['kid', 'Ты же… ты же нас спасёшь? Ты ведь Хоумлендер.', 2.8],
          ['mv', 'Джон… Мы не можем их просто бросить.', 2.4],
          ['hl', 'Мы не можем их спасти. А если вернёмся без них — никто не должен узнать почему.', 3.6],
          ['mv', '…', 1.2],
        ], [() => ({ pos: P.center.add(V(-1.4, 0.15, 0.7)), look: v.kid.center.add(V(0, 0.25, 0)) }), () => ({ pos: v.mv.center.add(V(-1.6, 0.3, 1.2)), look: v.mv.center.add(V(0, 0.4, 0)) }), () => ({ pos: v.kid.center.add(V(1.0, 0.25, 0.6)), look: P.center.add(V(0, 0.55, 0)) }), () => ({ pos: v.mv.center.add(V(-1.6, 0.3, 1.2)), look: v.mv.center.add(V(0, 0.4, 0)) })],
          () => { v.o.ph = 'l_out'; v.o.T = 0; });
      } else {
        g.ui.say([['hl', 'Держитесь крепче.', 1.6], ['mv', 'Джон?!', 1]]);
        cut(g, V(PL.x + 10, FY + 1.6, PL.z + 1.5), P.center.add(V(0, 0.5, 0)));
      }
    },
    update(g, dt, v) {
      const o = v.o, P = g.player, pl = v.plane;
      o.T += dt;
      const fallingSky = () => { v.clouds.update(dt, 55, pl.grp.position); if (Math.random() < dt * 20) g.fx.burst(pl.world(U.rand(-15, 15), U.rand(-2, 2), Math.random() < 0.5 ? 4 : -4), 1, { color: [0xffffff], speed: 1, size: 0.12, life: 0.4, g: 0, drag: 0, dir: V(-40, 0, 0), spread: 0.1 }); };
      switch (o.ph) {
        case 'l_kid': {
          pl.alarm.intensity = (Math.floor(g.time * 4) % 2) * 3; g.camRoll = 0.12 * Math.sin(g.time * 0.7);
          if (v.shot) cam(g, v.shot.pos, v.shot.look, 5);
          break;
        }
        case 'l_out': { // улетает с Мейв, самолёт уходит вниз
          if (o.T < dt * 1.5) {
            g.camRoll = 0; pl.alarm.intensity = 0;
            for (const a of [...v.pass, ...(v.pilots || [])]) hide(a);
            pl.unlock();
            P.flying = true; P.scriptVel = V(0, 0, 0); P.scriptPose = 'carry'; P.scriptOpt = { fly: true };
            v.mv.noPhysics = true; v.mv.think = function () { this.vel.set(0, 0, 0); this.anim = 'carried'; this.animOpt = {}; };
            o.hover = PL.clone().add(V(-10, 12, 26));
            P.place(o.hover.x, o.hover.y, o.hover.z, 0); P.scriptFace = Math.atan2(PL.x - o.hover.x, PL.z - o.hover.z);
            cut(g, o.hover.clone().add(V(-6, 3, 8)), PL);
            A().setWind(40);
          }
          const f = V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
          v.mv.pos.copy(P.pos).addScaledVector(f, 0.55).add(V(0, 0.75, 0)); v.mv.yaw = P.yaw + Math.PI / 2;
          // самолёт клюёт носом и уходит вниз сквозь облака
          const k = Math.min(1, o.T / 6);
          pl.grp.rotation.z = -0.5 * k; pl.grp.position.set(PL.x + o.T * 22, PL.y - o.T * o.T * 4.2, PL.z);
          fallingSky();
          cam(g, P.center.add(V(-3.5, 1.6, 3.8)), pl.grp.position.clone().lerp(P.center, 0.15), 2);
          if (o.T > 1 && !o.said) { o.said = true; g.ui.say([['sys', '*Мейв отворачивается*', 1.8]]); }
          if (pl.grp.position.y < 12 && !o.boom) {
            o.boom = true; const bp = pl.grp.position.clone(); bp.y = 3;
            g.fx.explosion(bp, 4); g.fx.explosion(bp.clone().add(V(8, 0, 2)), 3); A().explosion(1.2); pl.grp.visible = false; g.ui.flash(0.15);
            for (let i = 0; i < 12; i++) g.fx.fire(bp.clone().add(V(U.rand(-10, 10), 0, U.rand(-5, 5))), 3);
          }
          if (o.boom) { if (Math.random() < 0.5) g.fx.smoke(pl.grp.position.clone().setY(4), 2); }
          if (o.T > 9) { g.ui.caption('РЕЙС 37. ВЫЖИВШИХ НЕТ.', 0.5); o.ph = 'l_end'; o.T = 0; }
          break;
        }
        case 'l_end': { if (o.T > 3) return true; cam(g, P.center.add(V(-3.5, 1.6, 3.8)), V(PL.x + 120, 0, PL.z), 1); break; }
        // ===== спасение =====
        case 's_go': {
          g.camRoll = 0.1 * Math.sin(g.time * 0.7);
          if (o.T > 1.6) {
            g.camRoll = 0; pl.alarm.intensity = 0;
            for (const a of (v.pilots || [])) hide(a);
            pl.unlock();
            v.mv.pos.set(PL.x + 1, FY + 0.05, PL.z); v.mv.think = function () { this.vel.set(0, 0, 0); this.anim = 'idle'; this.animOpt = {}; };
            v.ride = [...v.pass, v.mv];
            for (const a of v.ride) { a.noPhysics = true; a.base = a.pos.clone().sub(PL); }
            o.ph = 's_hold'; o.T = 0; o.alt = PL.y; o.lift = 0; o.pitch = -0.22; o.x = PL.x;
            P.flying = true; P.scriptVel = V(0, 0, 0); P.scriptPose = 'carry'; P.scriptOpt = { fly: true };
            g.camOverride = null; g.cinematic = false; g.controlsEnabled = false;
            cut(g, PL.clone().add(V(10, -6, 36)), PL);
            g.ui.tag('УДЕРЖИВАЙТЕ САМОЛЁТ!', '#ffd24a', 2.5);
            g.ui.hint('Жмите и держите ВВЕРХ (пробел) или УСКОРЕНИЕ, чтобы толкать самолёт вверх', 6);
            A().stinger(); g.music('boss');
          }
          break;
        }
        case 's_hold': { // мини-игра: удержать самолёт
          const In = HL.Input, push = In.held('up') || In.held('boost') || In.held('use') || In.held('laser');
          o.lift = U.clamp(o.lift + (push ? 1.6 : -1.1) * dt, 0, 1);
          const vs = 9 - 15 * o.lift; // м/с вниз
          o.alt = Math.min(PL.y + 10, o.alt - vs * dt);
          o.pitch = U.damp(o.pitch, -0.22 + 0.3 * o.lift, 2, dt);
          o.x += 14 * dt;
          pl.grp.position.set(o.x, o.alt, PL.z); pl.grp.rotation.z = o.pitch;
          for (const a of v.ride) { const w = pl.grp.localToWorld(a.base.clone()); a.pos.copy(w); }
          const nose = pl.nose(); P.pos.copy(nose).add(V(0.5, -2.6, 0)); P.scriptFace = Math.PI / 2;
          if (push && Math.random() < 0.4) g.fx.burst(nose.clone().add(V(0, -1.2, 0)), 1, { color: [0xffffff, 0xffe0a0], speed: 4, size: 0.2, life: 0.3, g: 0 });
          g.fx.addShake(0.03 + (1 - o.lift) * 0.04);
          fallingSky();
          const left = Math.max(0, 24 - o.T);
          g.ui.boss('Высота рейса 37', U.clamp(o.alt / PL.y, 0, 1));
          g.ui.el.oText.textContent = `Удерживайте самолёт: ${Math.ceil(left)} с до посадочной полосы · высота ${Math.round(o.alt)} м`;
          cam(g, pl.grp.position.clone().add(V(4, -4, 34)), pl.grp.position.clone().add(V(10, -2, 0)), 3);
          if (o.alt < 14 && o.T < 24) { // разбился
            g.ui.boss(null); const bp = pl.grp.position.clone().setY(3);
            g.fx.explosion(bp, 4); A().explosion(1.2); pl.grp.visible = false;
            for (const a of v.ride) hide(a);
            g.fail('Рейс 37 разбился. Хоумлендер не удержал самолёт.'); return false;
          }
          if (o.T >= 24) { o.ph = 's_land'; o.T = 0; o.y0 = o.alt; g.ui.boss(null); g.controlsEnabled = false; g.cinematic = true; g.music(null); }
          break;
        }
        case 's_land': { // плавная посадка на поле
          const k = Math.min(1, o.T / 4), s = k * k * (3 - 2 * k);
          const y = U.lerp(o.y0, 3.1, s); o.x += (14 - 12 * s) * dt; o.pitch = U.damp(o.pitch, 0.04, 2, dt);
          pl.grp.position.set(o.x, y, PL.z); pl.grp.rotation.z = o.pitch;
          for (const a of v.ride) a.pos.copy(pl.grp.localToWorld(a.base.clone()));
          const nose = pl.nose(); P.pos.copy(nose).add(V(0.5, -2.6, 0)); if (P.pos.y < 0) P.pos.y = 0;
          if (k > 0.85) { for (let i = 0; i < 3; i++) g.fx.dust(pl.grp.position.clone().add(V(U.rand(-15, 15), -2.8, U.rand(-3, 3))), 1); g.fx.addShake(0.08); }
          cam(g, pl.grp.position.clone().add(V(-24, 3, 26)), pl.grp.position, 2);
          if (o.T > 5) {
            o.ph = 's_end'; o.T = 0; A().cheer(); g.changeApproval(15, 'Рейс 37 спасён');
            P.scriptPose = null; P.flying = false; P.place(pl.grp.position.x + 26, 0, PL.z + 4, -Math.PI / 2);
            for (const a of v.pass) { a.noPhysics = false; a.pos.set(pl.grp.position.x + U.rand(-10, 18), 0, PL.z + U.rand(6, 12)); a.cheering = true; a.panic = false; a.think = function (dt) { this.stop(dt); this.anim = 'cheer'; this.face(g.player.pos, dt, 4); }; }
            v.mv.noPhysics = false; v.mv.pos.set(P.pos.x - 2.2, 0, P.pos.z + 1.4); v.mv.think = function (dt) { this.stop(dt); this.anim = 'idle'; this.animOpt = {}; this.face(g.player.pos, dt, 4); };
            chain(g, v, [['crowd', 'ХОУМЛЕНДЕР! ХОУМЛЕНДЕР!', 2], ['mv', 'Ты… правда это сделал.', 2], ['ash', '*по рации* Боже мой… это в прямом эфире на всех каналах. Ты герой, Хоумлендер!', 3], ['hl', 'Это моя работа, мэм.', 2]], null, () => { o.done = true; });
          }
          break;
        }
        case 's_end': {
          cam(g, P.center.add(V(-3.2, 0.5, 4)), P.center.add(V(0, 0.4, 0)), 2);
          P.scriptFace = -Math.PI / 2;
          if (o.done) return true;
          break;
        }
      }
      return false;
    },
    exit(g, v) { g.camRoll = 0; A().setWind(0); const P = g.player; P.scriptPose = null; P.scriptOpt = null; P.scriptVel = null; P.scriptFace = null; g.ui.boss(null); },
  };

  const mission = {
    id: 'flight37', title: 'Рейс 37', desc: 'Захват самолёта. Хоумлендер и Мейв летят на помощь. Но всё идёт не по плану.',
    time: 'dusk', location: 'РЕЙС 37 · НАД НЬЮ-ЙОРКОМ · 19:40', start: [PL.x - 30, PL.y - 40, PL.z + 18, Math.PI / 2], music: null,
    setup(g, v) { v.plane = buildPlane(g); v.clouds = makeClouds(g); },
    steps: [introStep, fightStep, cockpitStep, outcomeStep],
  };
  return { mission };
})();
