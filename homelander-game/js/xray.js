// Миссия «Рентген»: зал Семёрки в башне Vought → поиск бомб внутри зданий рентгеновским зрением.
HL.Xray = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const FL = 151;                       // пол зала Семёрки (верх башни Vought)
  const TC = V(105, FL, 35);            // центр зала
  const MID = V(0, 0, 60);              // Мидтаун — район, где спрятаны бомбы
  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  function chain(g, v, lines, shots, done) {
    let i = 0;
    const next = () => { if (i >= lines.length) { done && done(); return; } if (shots && shots[i]) v.shot = shots[i](); g.ui.say([lines[i]], next); i++; };
    next();
  }

  // ---------- зал Семёрки ----------
  function buildHall(g) {
    const grp = new T.Group(); g.scene.add(grp);
    const mk = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    const wall = M.toonX(0x1c2234, { side: T.DoubleSide }), trim = M.toon(0xc8a050), glass = new T.MeshBasicMaterial({ color: 0x9ac0ff, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false });
    mk(M.box(24, 0.2, 24), M.toon(0x2a2e38), TC.x, FL - 0.1, TC.z);                      // пол
    mk(M.box(24, 0.2, 24), M.toon(0x14182a), TC.x, FL + 6.1, TC.z);                      // потолок
    mk(M.box(0.3, 6.2, 24), wall, TC.x + 12, FL + 3, TC.z);                              // задняя стена
    for (const sd of [-1, 1]) mk(M.box(24, 6.2, 0.3), wall, TC.x, FL + 3, TC.z + sd * 12); // боковые
    // панорамное окно на город (на запад)
    for (const z of [-12, -6, 0, 6, 12]) mk(M.box(0.25, 6.2, 0.25), M.toon(0x2a2e38), TC.x - 12, FL + 3, TC.z + z);
    mk(M.box(0.3, 0.3, 24), M.toon(0x2a2e38), TC.x - 12, FL + 0.15, TC.z); mk(M.box(0.3, 0.3, 24), M.toon(0x2a2e38), TC.x - 12, FL + 6, TC.z);
    const gl = new T.Mesh(new T.PlaneGeometry(24, 6), glass); gl.rotation.y = Math.PI / 2; gl.position.set(TC.x - 12.05, FL + 3, TC.z); grp.add(gl);
    // стол Семёрки
    mk(M.box(10, 0.14, 2.6), M.toon(0x0e0e12), TC.x, FL + 0.82, TC.z);
    mk(M.box(10.1, 0.04, 2.7), trim, TC.x, FL + 0.9, TC.z);
    for (const x of [-4, 4]) mk(M.box(0.6, 0.8, 1.6), M.toon(0x1a1a20), TC.x + x, FL + 0.4, TC.z);
    const logo = M.canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#0e0e12'; x.fillRect(0, 0, w, h); x.fillStyle = '#d8b04a'; x.font = 'bold 300px Impact, Arial Black'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7', w / 2, h / 2 + 20); x.strokeStyle = '#d8b04a'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, 220, 0, Math.PI * 2); x.stroke(); });
    const lg = new T.Mesh(new T.CircleGeometry(0.9, 32), new T.MeshBasicMaterial({ map: logo })); lg.rotation.x = -Math.PI / 2; lg.position.set(TC.x, FL + 0.93, TC.z); grp.add(lg);
    // стулья: 3 по бокам + кресло во главе
    const chairM = M.toon(0x2a1a14);
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const x = TC.x - 3 + i * 3; mk(M.box(0.8, 0.12, 0.8), chairM, x, FL + 0.48, TC.z + sd * 1.9); mk(M.box(0.8, 1.0, 0.12), chairM, x, FL + 1.0, TC.z + sd * 2.3); }
    mk(M.box(0.9, 0.14, 0.9), M.toon(0x8a1a1a), TC.x + 6.4, FL + 0.48, TC.z); mk(M.box(0.14, 1.6, 0.9), M.toon(0x8a1a1a), TC.x + 6.9, FL + 1.25, TC.z);
    // логотип на стене
    const wl = M.canvasTex(1024, 256, (x, w, h) => { x.fillStyle = '#d8b04a'; x.font = 'bold 150px Impact, Arial Black'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THE SEVEN', w / 2, h / 2 + 10); });
    const wlm = new T.Mesh(new T.PlaneGeometry(9, 2.25), new T.MeshBasicMaterial({ map: wl, transparent: true })); wlm.rotation.y = -Math.PI / 2; wlm.position.set(TC.x + 11.8, FL + 4, TC.z); grp.add(wlm);
    const l1 = new T.PointLight(0xffe8c0, 1.4, 22, 1.4); l1.position.set(TC.x, FL + 5, TC.z); grp.add(l1);
    const l2 = new T.PointLight(0xffd8a0, 0.8, 14, 1.4); l2.position.set(TC.x + 8, FL + 4, TC.z); grp.add(l2);
    return grp;
  }

  // ---------- бомбы внутри зданий ----------
  function makeBomb(g, pos) {
    const grp = new T.Group(); grp.position.copy(pos);
    const body = new T.Mesh(M.box(0.9, 0.55, 0.55), M.toon(0x2a2a2a)); grp.add(body);
    for (const x of [-0.25, 0, 0.25]) { const c = new T.Mesh(M.cyl(0.09, 0.09, 0.6, 8), M.toon(0xb03020)); c.rotation.x = Math.PI / 2; c.position.set(x, 0.32, 0); grp.add(c); }
    const scr = new T.Mesh(M.box(0.3, 0.14, 0.05), new T.MeshBasicMaterial({ color: 0xff2020 })); scr.position.set(0, 0.05, 0.29); grp.add(scr);
    grp.userData.blink = scr;
    g.scene.add(grp); g.xrayItems.push(grp);
    return grp;
  }
  function pickBuildings(g) {
    const lots = g.world.lots.filter((b) => b.kind === 'building' && b.y1 >= 18 && Math.hypot((b.x0 + b.x1) / 2 - MID.x, (b.z0 + b.z1) / 2 - MID.z) < 130);
    const out = [];
    for (const b of lots.sort(() => Math.random() - 0.5)) {
      const c = V((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      if (out.every((o) => o.c.distanceTo(c) > 55)) out.push({ b, c });
      if (out.length === 3) break;
    }
    return out;
  }
  const boxDist = (b, p) => Math.hypot(p.x - U.clamp(p.x, b.x0, b.x1), p.z - U.clamp(p.z, b.z0, b.z1));

  // ---------- 1. Зал Семёрки: сидит за столом, встаёт, смотрит в окно ----------
  const hallStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      P.noClip = true; P.flying = true; P.scriptVel = V(0, 0, 0);
      P.place(TC.x + 6.3, FL, TC.z, -Math.PI / 2); P.scriptFace = -Math.PI / 2; P.scriptPose = 'sit';
      g.cinema(V(TC.x - 6, FL + 2.2, TC.z + 6), P.center);
      cut(g, V(TC.x - 8, FL + 2.6, TC.z + 7), V(TC.x + 4, FL + 1, TC.z));
      g.ui.caption('БАШНЯ VOUGHT. ЗАЛ СЕМЁРКИ.', 0.42);
      v.e = { ev: 0, T: 0 };
      A().heartbeat(0.35);
    },
    update(g, dt, v) {
      const e = v.e, P = g.player; e.T += dt;
      P.scriptVel = V(0, 0, 0); P.pos.y = FL;
      if (e.ev === 0) { // общий план: один во главе пустого стола
        const k = Math.min(1, e.T / 4);
        cam(g, V(TC.x - 8 + k * 6, FL + 2.6 - k * 0.6, TC.z + 7 - k * 3.4), V(TC.x + 5, FL + 1.1, TC.z), 1.5);
        if (e.T > 4.2) { e.ev = 1; e.T = 0; cut(g, P.center.add(V(-2.2, 0.35, 1.0)), P.center.add(V(0, 0.45, 0))); }
      } else if (e.ev === 1) { // крупно — встаёт
        cam(g, P.center.add(V(-2.2, 0.35, 1.0)), P.center.add(V(0, 0.45, 0)), 3);
        if (e.T > 1.6 && P.scriptPose) { P.scriptPose = null; A().whoosh(); }
        if (e.T > 2.4) { e.ev = 2; e.T = 0; P.scriptMove = V(TC.x - 10.2, FL, TC.z); P.scriptSpeed = 2.6; P.flying = false; }
      } else if (e.ev === 2) { // идёт к окну
        P.pos.y = FL; P.vel.y = 0;
        cam(g, V(P.pos.x + 1.5, FL + 1.8, TC.z + 5.5), P.center, 3);
        if (P.pos.x < TC.x - 9.9 || e.T > 7) {
          e.ev = 3; e.T = 0; P.scriptMove = null; P.scriptPose = 'akimbo'; P.scriptFace = -Math.PI / 2;
          cut(g, P.center.add(V(3.2, 0.6, 0.8)), V(TC.x - 60, FL - 25, TC.z - 8));
          chain(g, v, [
            ['hl', 'Посмотри на них. Миллионы. И каждый думает, что он в безопасности.', 3.2],
            ['ash', '*по рации* Хоумлендер! «Фронт освобождения» заложил бомбы в трёх зданиях Мидтауна. Мы не знаем, в каких!', 3.6],
            ['hl', 'Мне не нужно знать. Я их увижу.', 2.2],
          ], [() => ({ pos: P.center.add(V(3.2, 0.6, 0.8)), look: V(TC.x - 60, FL - 25, TC.z - 8) }), () => ({ pos: P.center.add(V(-1.6, 0.4, 2.0)), look: P.center.add(V(0, 0.5, 0)) }), () => ({ pos: P.center.add(V(-1.2, 0.5, 0.25)), look: P.center.add(V(0, 0.55, 0)) })],
            () => { e.ev = 4; e.T = 0; });
        }
      } else if (e.ev === 3) {
        P.pos.y = FL; P.vel.y = 0;
        if (v.shot) cam(g, v.shot.pos, v.shot.look, 4);
      } else if (e.ev === 4) { // глаза — рентген, и он уходит в окно
        if (e.T < dt * 1.5) { M.setGlow(P.c, true, 0x6ab8ff); P.scriptGlow = false; A().charge(0.6); g.ui.flash(0.15); }
        cam(g, P.center.add(V(-1.0, 0.45, 0.2)), P.center.add(V(0, 0.55, 0)), 5);
        if (e.T > 1.2) {
          e.ev = 5; e.T = 0; P.scriptPose = null; P.flying = true; A().whoosh(); A().clang();
          g.fx.burst(V(TC.x - 12, FL + 2, TC.z), 40, { color: [0xcfe8ff, 0xffffff], speed: 12, size: 0.16, life: 1, g: -18 });
          cut(g, V(TC.x - 26, FL + 4, TC.z + 14), V(TC.x - 12, FL + 2, TC.z));
        }
      } else if (e.ev === 5) { // сквозь стекло — в город
        P.scriptVel = V(-30, -3, 0); P.scriptFace = -Math.PI / 2;
        cam(g, V(TC.x - 26, FL + 4, TC.z + 14), P.center, 3);
        if (e.T > 1.8) return true;
      }
      return false;
    },
    exit(g, v) {
      const P = g.player; P.scriptVel = null; P.scriptPose = null; P.scriptFace = null; P.scriptMove = null; P.noClip = false; P.flying = true;
      P.place(TC.x - 40, 120, TC.z, -Math.PI / 2 - 0.6); M.setGlow(P.c, false);
      g.camYaw = P.yaw; g.camPitch = 0.3; g.cinema(null); g.music('combat');
      g.ui.hint('X — рентген: бомбы внутри зданий светятся жёлтым. Подлетите к стене и нажмите E', 6);
    },
  };

  // ---------- 2. Найти и вырвать бомбы ----------
  const bombStep = {
    text: 'Найдите 3 бомбы рентгеном',
    enter(g, v) {
      v.bombs = pickBuildings(g).map(({ b, c }, i) => {
        const pos = V(c.x + U.rand(-3, 3), Math.min(b.y1 - 4, U.rand(8, 16)), c.z + U.rand(-3, 3));
        const m = makeBomb(g, pos);
        g.spawnGroup('guard', 'thug', V(c.x, 0, c.z + (b.z1 - b.z0) / 2 + 6), 3, { spread: 7, weapon: 'pistol', hp: 60 });
        g.spawn(['pyro', 'volt', 'hawk'][i], c.x + 8, c.z + (b.z1 - b.z0) / 2 + 9, { group: 'guard', quiet: i > 0 });
        return { b, c, pos, m, found: false, done: false };
      });
      v.left = 3; g.setTimer(240);
      g.onXray = () => { v.scanT = 0; };
    },
    update(g, dt, v) {
      const P = g.player;
      for (const bm of v.bombs) if (!bm.done) bm.m.userData.blink.visible = Math.floor(g.time * 3) % 2 === 0;
      if (v.rip) return ripUpdate(g, dt, v);
      // обнаружение рентгеном
      if (P.xrayT > 0) for (const bm of v.bombs) if (!bm.found && !bm.done && bm.pos.distanceTo(P.pos) < 95) {
        bm.found = true; A().alarm(); g.ui.tag('БОМБА ОБНАРУЖЕНА!', '#ffd23a', 1.6); g.ui.hint('Подлетите к стене этого здания и нажмите E', 3);
      }
      // рядом со стеной — можно вырвать
      const near = v.bombs.find((bm) => bm.found && !bm.done && boxDist(bm.b, P.pos) < 4.5 && Math.abs(P.center.y - bm.pos.y) < 9);
      g.useLock = !!near;
      if (near) { g.ui.hint('E — пробить стену и вырвать бомбу', 0.3); if (HL.Input.hit('use')) startRip(g, v, near); }
      g.ui.el.oText.textContent = `Найдите и обезвредьте бомбы: осталось ${v.left} · X — рентген`;
      return v.left === 0 && !v.rip;
    },
    wp: (g, v) => {
      const bm = v.bombs && v.bombs.find((b) => b.found && !b.done);
      return bm ? bm.pos : (v.bombs && v.bombs.some((b) => !b.done) ? MID.clone().setY(30) : null);
    },
    exit(g, v) { g.useLock = false; g.onXray = null; g.setTimer(null); },
  };
  function startRip(g, v, bm) {
    const P = g.player;
    const wall = V(U.clamp(P.pos.x, bm.b.x0, bm.b.x1), U.clamp(P.center.y, 1, bm.b.y1 - 1), U.clamp(P.pos.z, bm.b.z0, bm.b.z1));
    v.rip = { bm, T: 0, wall, from: bm.pos.clone() };
    g.cinema(P.center, wall); g.useLock = false;
    P.flying = true; P.scriptVel = V(0, 0, 0); P.scriptFace = Math.atan2(wall.x - P.pos.x, wall.z - P.pos.z); P.scriptPose = 'punch'; P.scriptOpt = { p: 0.2 };
  }
  function ripUpdate(g, dt, v) {
    const r = v.rip, P = g.player, bm = r.bm; r.T += dt;
    const side = V(-(r.wall.z - P.pos.z), 0, r.wall.x - P.pos.x).normalize();
    if (r.T < 0.35) { P.scriptOpt = { p: 0.2 + r.T * 1.5 }; cam(g, P.center.addScaledVector(side, 3).add(V(0, 0.6, 0)), r.wall, 6); }
    else if (!r.smash) { // пробивает стену
      r.smash = true; A().slam(); A().punch(); g.fx.addShake(0.8); g.hitStop = 0.08;
      g.fx.burst(r.wall, 40, { color: [0x9a9590, 0x6a6560, 0xd0c8b8], speed: 13, size: 0.4, life: 1.2, g: -20 }); g.fx.dust(r.wall, 10);
    } else if (r.T < 1.2) { // бомба вылетает к нему в руки
      const k = Math.min(1, (r.T - 0.35) / 0.7);
      bm.m.position.lerpVectors(r.from, P.center.add(V(0, 0.4, 0)).addScaledVector(V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), 0.7), k * k);
      P.scriptPose = 'carry'; P.scriptOpt = { over: false };
      cam(g, P.center.addScaledVector(side, 3.4).add(V(0, 0.5, 0)), P.center.lerp(r.wall, 0.4), 4);
    } else if (r.T < 2.4) { // взмывает вверх с бомбой
      P.scriptVel = V(0, 45, 0); P.scriptPose = 'carry'; P.scriptOpt = { over: true, fly: true };
      bm.m.position.copy(P.center).add(V(0, 1.4, 0));
      cam(g, P.center.addScaledVector(side, 9).add(V(0, -6, 0)), P.center, 3);
    } else if (!r.thrown) { // бросает её в небо
      r.thrown = true; P.scriptVel = V(0, 0, 0); P.scriptPose = 'throw'; P.scriptOpt = { p: 0.8 }; A().whoosh();
      r.bv = V(0, 70, 0); r.bp = bm.m.position.clone();
    } else {
      r.bp.addScaledVector(r.bv, dt); bm.m.position.copy(r.bp);
      cam(g, P.center.addScaledVector(side, 9).add(V(0, -6, 0)), r.bp.clone().lerp(P.center, 0.4), 3);
      if (r.T > 3.1 && !r.boom) {
        r.boom = true; g.fx.explosion(r.bp, 3.2); A().explosion(1.6); g.ui.flash(0.35); g.fx.addShake(0.6);
        g.scene.remove(bm.m); bm.done = true; v.left--; g.ui.tag(`БОМБА ОБЕЗВРЕЖЕНА · ${3 - v.left}/3`, '#7cff7c', 1.6); g.changeApproval(4, 'Бомба обезврежена');
      }
      if (r.T > 4.2) {
        v.rip = null; P.scriptPose = null; P.scriptOpt = null; P.scriptVel = null; P.scriptFace = null;
        g.camYaw = P.yaw; g.camPitch = 0.2; g.cinema(null);
      }
    }
    return false;
  }

  // ---------- 3. Финал ----------
  const endStep = {
    text: '…',
    enter(g, v) {
      const P = g.player; P.flying = true; P.scriptVel = V(0, 0, 0); P.scriptPose = 'akimbo';
      g.cinema(P.center, MID); g.music('calm');
      v.e = { T: 0 };
      chain(g, v, [
        ['ash', '*по рации* Все три?! Ни одной жертвы… Как ты их нашёл?!', 2.8],
        ['hl', 'Я вижу всё, Эшли. Абсолютно всё.', 2.4],
      ], null, () => { v.e.done = true; });
      M.setGlow(P.c, true, 0x6ab8ff);
    },
    update(g, dt, v) {
      const P = g.player; v.e.T += dt; P.scriptVel = V(0, 0, 0);
      const a = v.e.T * 0.25;
      cam(g, P.center.add(V(Math.sin(a) * 6, 0.8, Math.cos(a) * 6)), P.center.add(V(0, 0.4, 0)), 2);
      return !!v.e.done && v.e.T > 1;
    },
    exit(g) { const P = g.player; P.scriptPose = null; P.scriptVel = null; M.setGlow(P.c, false); g.cinema(null); },
  };

  const mission = {
    id: 'xray', title: 'Рентген', desc: 'Террористы спрятали бомбы в трёх зданиях Мидтауна. Хоумлендер видит сквозь стены.',
    time: 'dusk', location: 'БАШНЯ VOUGHT · ЗАЛ СЕМЁРКИ · 19:20', start: [TC.x + 6.3, FL, TC.z, -Math.PI / 2], music: null,
    setup(g, v) { buildHall(g); },
    steps: [hallStep, bombStep, endStep],
  };
  return { mission };
})();
