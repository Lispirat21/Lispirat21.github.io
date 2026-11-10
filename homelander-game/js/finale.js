// Финал: армия у Белого дома, разбитая камера прямого эфира, Таймс-сквер и взлёт сквозь крышу
HL.Finale = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const WH = V(0, 10, -254);     // Белый дом (центр)
  const ROOF = V(0, 21.8, -250); // точка на крыше
  const TSQ = V(0, 0, 104);      // «Таймс-сквер»: проспект x = 0 между перекрёстками

  // камера: snap — мгновенная склейка, rate — плавность
  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  // урон, разрешённый внутри кат-сцены
  function cineHit(g, fn) { g.cineHit = true; try { fn(); } finally { g.cineHit = false; } }

  // ---------- модели ----------
  function buildTank() {
    const grp = new T.Group();
    const olive = M.toon(0x4b5320), olive2 = M.toon(0x3d4419), dark = M.toon(0x1e1f1a), wheel = M.toon(0x2c2d27);
    const add = (parent, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    add(grp, M.box(3.4, 1.0, 6.6), olive, 0, 1.15, 0);
    add(grp, M.box(3.0, 0.55, 1.3), olive2, 0, 0.95, 3.5);
    add(grp, M.box(3.0, 0.4, 1.0), olive2, 0, 1.0, -3.4);
    for (const s of [-1, 1]) {
      add(grp, M.box(0.9, 1.0, 7.0), dark, s * 1.75, 0.55, 0);
      for (let i = -3; i <= 3; i++) { const w = add(grp, M.cyl(0.4, 0.4, 0.32, 10), wheel, s * 2.0, 0.48, i * 0.95); w.rotation.z = Math.PI / 2; }
      add(grp, M.box(0.25, 0.3, 6.4), olive2, s * 1.55, 1.75, 0); // ящики на надгусеничных полках
    }
    const tur = new T.Group(); tur.position.set(0, 1.65, -0.4); grp.add(tur);
    add(tur, M.box(2.5, 0.85, 3.0), olive, 0, 0.42, 0);
    add(tur, M.box(2.1, 0.5, 0.9), olive2, 0, 0.3, 1.8);
    const barrel = add(tur, M.cyl(0.13, 0.16, 4.6, 8), olive2, 0, 0.45, 3.9); barrel.rotation.x = Math.PI / 2;
    const muzzle = add(tur, M.cyl(0.21, 0.21, 0.55, 8), dark, 0, 0.45, 6.2); muzzle.rotation.x = Math.PI / 2;
    add(tur, M.cyl(0.42, 0.42, 0.16, 10), olive2, 0.55, 0.92, -0.4);
    const mg = add(tur, M.cyl(0.04, 0.04, 1.0, 6), dark, 0.55, 1.15, 0.0); mg.rotation.x = Math.PI / 2;
    add(tur, M.cyl(0.02, 0.02, 2.6, 4), dark, -0.95, 1.7, -1.1);
    const star = add(tur, M.box(0.02, 0.5, 0.5), M.toon(0xe8e8e0), 1.26, 0.45, 0.2); star.rotation.x = Math.PI / 4;
    grp.userData.tur = tur;
    return grp;
  }
  function searchlight(from, to) {
    const grp = new T.Group();
    const base = new T.Mesh(M.box(1.2, 1.0, 1.2), M.toon(0x2a2c26)); base.position.copy(from).setY(0.5); grp.add(base);
    const geo = new T.ConeGeometry(3.2, 90, 18, 1, true); geo.translate(0, -45, 0);
    const cone = new T.Mesh(geo, new T.ShaderMaterial({
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
      vertexShader: 'varying float vV; void main(){ vV = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vV; void main(){ gl_FragColor = vec4(vec3(1.0,0.95,0.78) * 0.16 * pow(vV, 2.2), 1.0); }', // луч гаснет к дальнему концу
    }));
    cone.position.copy(from).setY(1.1);
    grp.add(cone);
    grp.userData = { cone, from: from.clone().setY(1.1), to: to.clone(), ph: Math.random() * 6 };
    return grp;
  }
  // разбитая камера прямого эфира, лежит на полу
  function makeLiveCam(g, O) {
    const grp = new T.Group();
    const body = M.toon(0x1e1e22), dark = M.toon(0x111111);
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
    add(M.box(0.34, 0.4, 0.75), body, 0, 0, 0);
    add(M.box(0.12, 0.1, 0.5), body, 0, 0.26, -0.05); // ручка
    const lens = add(M.cyl(0.12, 0.14, 0.26, 14), dark, 0, 0, 0.5); lens.rotation.x = Math.PI / 2;
    const glass = new T.Mesh(new T.CircleGeometry(0.11, 14), new T.MeshBasicMaterial({ color: 0x223355 })); glass.position.set(0, 0, 0.635); grp.add(glass);
    // трещины на стекле
    const crack = new T.LineBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.4, pts = [V(0.01, -0.01, 0.637), V(Math.cos(a) * 0.05, Math.sin(a) * 0.05 + 0.01, 0.637), V(Math.cos(a + 0.3) * 0.105, Math.sin(a + 0.3) * 0.105, 0.637)];
      grp.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), crack));
    }
    const red = new T.Mesh(M.sph(0.035), new T.MeshBasicMaterial({ color: 0xff2020 })); red.position.set(0.12, 0.17, 0.3); grp.add(red);
    const logo = add(M.box(0.36, 0.12, 0.2), M.toon(0xc22a33), 0, 0.08, -0.2); logo.scale.set(1.02, 1, 1);
    // упавший штатив
    for (let i = 0; i < 3; i++) { const l = add(M.cyl(0.025, 0.025, 1.5, 6), M.toon(0x333333), -0.35 - i * 0.12, -0.15, -0.55 - i * 0.18); l.rotation.set(Math.PI / 2, 0, 0.3 * (i - 1)); }
    const pos = V(O.center.x - 3.2, 0.21, O.center.z + 5.0);
    const look = V(O.center.x - 0.6, 1.2, O.center.z + 2.4);
    grp.position.copy(pos); grp.lookAt(look.x, pos.y + 0.6, look.z);
    grp.rotation.z = 0.32; // лежит на боку
    g.scene.add(grp);
    const dir = look.clone().sub(pos).setY(0).normalize();
    return { grp, red, pos: pos.clone().addScaledVector(dir, 0.65).setY(0.3), dir };
  }

  // ---------- экранные эффекты ----------
  function recOverlay(on) {
    let el = document.getElementById('recov');
    if (!on) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'recov';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;background:repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 2px,transparent 2px 4px),radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.75));font-family:monospace;color:#fff';
    el.innerHTML = '<style>@keyframes recb{50%{opacity:0}}</style>' +
      '<div style="position:absolute;left:5%;top:6%;font:700 clamp(16px,3vw,28px)/1 monospace;color:#ff3030;animation:recb 1s steps(1) infinite">● REC</div>' +
      '<div style="position:absolute;right:5%;top:6%;font:700 clamp(13px,2.4vw,22px)/1 monospace;background:#c4161c;padding:5px 9px">LIVE · VNN</div>' +
      '<div style="position:absolute;left:5%;bottom:7%;font:clamp(12px,2vw,18px)/1.3 monospace">ОВАЛЬНЫЙ КАБИНЕТ · ПРЯМОЙ ЭФИР<br>21:47:13:08 · СИГНАЛ ПОВРЕЖДЁН</div>' +
      '<div style="position:absolute;right:5%;bottom:7%;font:clamp(12px,2vw,18px)/1 monospace;color:#ffdd55">▮▮▮▯ 38%</div>' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;opacity:.55">' +
      '<polyline points="62,0 58,18 66,30 61,44 70,58" fill="none" stroke="#fff" stroke-width=".25"/>' +
      '<polyline points="58,18 47,24 40,22" fill="none" stroke="#fff" stroke-width=".2"/>' +
      '<polyline points="66,30 78,34 88,31 100,36" fill="none" stroke="#fff" stroke-width=".2"/>' +
      '<path d="M4 4h8M4 4v8M96 4h-8M96 4v8M4 96h8M4 96v-8M96 96h-8M96 96v-8" stroke="#fff" stroke-width=".5" fill="none"/></svg>';
    document.body.appendChild(el);
  }
  function canvasTex(w, h, draw) { const t = M.canvasTex(w, h, draw); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; }
  function offlineTex(seed) {
    return canvasTex(512, 288, (x, w, h) => {
      x.fillStyle = '#0b0c10'; x.fillRect(0, 0, w, h);
      let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      for (let i = 0; i < 2600; i++) { const c = (rnd() * 140) | 0; x.fillStyle = `rgb(${c},${c},${c})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2); }
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(0, rnd() * h, w, 3 + rnd() * 8); }
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, h * 0.36, w, h * 0.3);
      x.fillStyle = '#ffffff'; x.font = 'bold 54px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('CAMERA OFFLINE', w / 2, h * 0.47);
      x.fillStyle = '#ff4040'; x.font = 'bold 22px monospace'; x.fillText('НЕТ СИГНАЛА · NO SIGNAL', w / 2, h * 0.6);
    });
  }
  function adTex(text, bg, fg, sub) {
    return canvasTex(512, 256, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
      x.fillStyle = fg; x.font = 'bold 84px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, w / 2, h * 0.45);
      if (sub) { x.font = 'bold 28px Arial, sans-serif'; x.fillText(sub, w / 2, h * 0.78); }
    });
  }
  let _ticker = null;
  function tickerTex() {
    return _ticker || (_ticker = canvasTex(1024, 64, (x, w, h) => {
      x.fillStyle = '#c4161c'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.font = 'bold 36px Arial, sans-serif'; x.textBaseline = 'middle';
      x.fillText('● В ЭФИРЕ: ОВАЛЬНЫЙ КАБИНЕТ · ХОУМЛЕНДЕР · СРОЧНО · ● В ЭФИРЕ', 16, h / 2 + 2);
    }));
  }

  // ---------- армия у Белого дома ----------
  function makeArmy(g) {
    const o = { units: [], objs: [] };
    const tanks = [[-38, -205], [-19, -207], [19, -207], [38, -205], [-60, -222], [60, -222], [0, -199]];
    for (const [x, z] of tanks) {
      const t = buildTank(); t.position.set(x, 0, z); t.rotation.y = Math.atan2(WH.x - x, WH.z - z);
      g.scene.add(t); o.objs.push(t);
    }
    for (let row = 0; row < 3; row++) for (let i = 0; i < 13; i++) {
      const x = -36 + i * 6 + (row % 2) * 3 + U.rand(-0.6, 0.6), z = -213 - row * 2.6 + U.rand(-0.4, 0.4);
      const a = g.spawn('agent', x, z, { showHp: false, hp: 1e6 });
      a.faction = 'army'; a.flinch = 0; a.invuln = true;
      a.face(WH, 0);
      a.think = function (dt) {
        this.stop(dt); this.face(WH, dt, 6);
        if (this.flinch > 0) { this.flinch -= dt; this.anim = 'scared'; this.animOpt = {}; }
        else { this.anim = 'shoot'; this.animOpt = {}; }
      };
      o.units.push(a);
    }
    for (const [fx, fz, tx] of [[-48, -203, -14], [48, -203, 14], [-72, -214, -28], [72, -214, 28], [-24, -200, 4], [24, -200, -4]]) {
      const s = searchlight(V(fx, 0, fz), V(tx, 14, -246)); g.scene.add(s); o.objs.push(s);
    }
    o.update = (t) => {
      for (const s of o.objs) {
        const u = s.userData; if (!u.cone) continue;
        const to = u.to.clone().add(V(Math.sin(t * 0.6 + u.ph) * 9, Math.sin(t * 0.4 + u.ph) * 5 + 4, 0));
        const d = to.sub(u.from).normalize();
        u.cone.quaternion.setFromUnitVectors(V(0, -1, 0), d);
      }
    };
    o.remove = () => { for (const a of o.units) a.remove(); for (const m of o.objs) g.scene.remove(m); };
    return o;
  }

  // Кат-сцена: Хоумлендер стреляет в Райана, лазер прожигает крышу, армия снаружи вздрагивает
  const armyStep = {
    text: 'Тем временем…',
    enter(g, v) {
      const P = g.player, O = v.O, r = v.r;
      v.ar = { T: 0, ev: 0 };
      v.army = makeArmy(g);
      g.cinema(P.center, r.center);
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.scriptVel = null;
      P.place(O.center.x - 3, 0, O.center.z + 0.5, Math.PI / 2);
      r.noPhysics = true; r.pos.set(O.center.x + 1.5, 4.6, O.center.z - 1);
      r.think = function (dt) { this.anim = 'hover'; this.animOpt = {}; this.vel.set(0, 0, 0); this.face(P.pos, dt, 6); };
      if (v.b && v.b.alive) v.b.think = function (dt) { this.anim = 'idle'; this.animOpt = { lash: false }; this.stop(dt); this.face(P.pos, dt, 3); };
      A().heartbeat(0.6);
    },
    update(g, dt, v) {
      const s = v.ar, P = g.player, O = v.O, r = v.r;
      s.T += dt;
      v.army.update(g.time);
      if (s.ev === 0) { // внутри: лазер по Райану, тот уворачивается
        P.scriptFace = Math.atan2(r.pos.x - P.pos.x, r.pos.z - P.pos.z); P.scriptHead = -0.55; P.scriptGlow = s.T > 0.4;
        const look = P.center.lerp(r.center, 0.5);
        const cp = P.center.add(V(-2.6, 0.1, 5.2)); O.clampInside(cp);
        if (s.T < dt * 1.5) cut(g, cp, look); else cam(g, cp, look, 3);
        if (s.T > 0.8) {
          if (!s.dodge) { s.dodge = true; A().setLaser(true); A().whoosh(); }
          r.pos.z = Math.min(O.center.z + 3.5, r.pos.z + dt * 9);
          const tgt = V(O.center.x + 1.5, O.H, O.center.z - 0.6);
          g.fx.setBeam(0, P.eyePos(0), tgt); g.fx.setBeam(1, P.eyePos(1), tgt);
          g.fx.sparks(tgt, 0xffb0a0, 3); g.fx.burst(tgt, 1, { color: [0xf1e7c6, 0xb8b0a0], speed: 6, size: 0.25, life: 0.8, g: -18 });
          g.fx.addShake(0.15 * dt * 10);
        }
        if (s.T > 1.9) {
          s.ev = 1; s.T = 0;
          g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false); P.scriptGlow = false;
          cut(g, V(34, 5.5, -186), V(0, 12, -246));
          g.ui.caption('ТЕМ ВРЕМЕНЕМ У БЕЛОГО ДОМА', 0.45);
          g.ui.say([['mil', '*рация* Всем постам: Белый дом окружён. Без приказа не входить.', 2.8]]);
          A().beep();
        }
      } else if (s.ev === 1) { // снаружи: армия ждёт
        const k = Math.min(1, s.T / 3.2);
        cam(g, V(34 - k * 12, 5.5 - k * 2, -186 - k * 8), V(0, 12 + k * 2, -246), 2);
        if (s.T > 3.3) {
          s.ev = 2; s.T = 0;
          // лазер вырывается из крыши в небо
          g.fx.explosion(ROOF, 1.1); A().explosion(0.7); A().setLaser(true); g.fx.addShake(0.5); g.ui.flash(0.2);
          for (let i = 0; i < 30; i++) g.fx.burst(ROOF, 1, { color: [0xf1e7c6, 0xffffff, 0xb8b0a0], speed: 16, size: 0.45, life: 1.6, g: -20, up: true });
          for (const a of v.army.units) a.flinch = 0.8 + Math.random() * 0.5;
          g.ui.say([['sys', '*солдаты вздрагивают*', 1.4], ['mil', 'Держать позиции! Без приказа не стрелять!', 2.4]]);
        }
      } else if (s.ev === 2) {
        if (s.T < 1.7) {
          const sw = Math.sin(s.T * 7) * 3;
          g.fx.setBeam(0, ROOF.clone().add(V(-0.3, 0, 0)), ROOF.clone().add(V(sw - 4, 380, 10)), 4.5);
          g.fx.setBeam(1, ROOF.clone().add(V(0.3, 0, 0)), ROOF.clone().add(V(sw - 3.4, 380, 10)), 4.5);
          g.fx.flashLight(ROOF.clone().add(V(0, 3, 6)), 0xff2a1a, 6, 0.08, 90);
          if (Math.random() < 0.6) g.fx.burst(ROOF, 1, { color: [0xff5030, 0xffd0a0], speed: 8, size: 0.3, life: 0.5 });
        } else if (!s.off) { s.off = true; g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false); }
        if (Math.random() < 0.3) g.fx.smoke(ROOF, 1);
        cam(g, V(15, 2.4, -201), V(0, 26 + Math.min(1, s.T / 1.2) * 20, -250), 3);
        if (s.T > 4.6) s.ev = 3;
      }
      return s.ev === 3;
    },
    exit(g, v) {
      const P = g.player;
      if (v.army) { v.army.remove(); v.army = null; }
      g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false);
      P.scriptFace = null; P.scriptGlow = false; P.scriptHead = null;
      v.r.pos.y = 3;
      g.camYaw = Math.atan2(v.r.pos.x - P.pos.x, v.r.pos.z - P.pos.z); g.camPitch = 0.1;
      g.cinema(null);
    },
  };

  // ---------- Таймс-сквер ----------
  function makeTimesSquare(g, rtTex) {
    const grp = new T.Group(); g.scene.add(grp);
    const frameM = M.toon(0x15161a), poleM = M.toon(0x2a2b30);
    const live = [];
    const mk = (x, y, z, ry, w, h, mat, ticker) => {
      const s = new T.Group(); s.position.set(x, y, z); s.rotation.y = ry; grp.add(s);
      const f = new T.Mesh(M.box(w + 0.7, h + 0.7, 0.5), frameM); f.position.z = -0.3; s.add(f);
      for (const px of [-w * 0.35, w * 0.35]) { const p = new T.Mesh(M.box(0.4, y, 0.4), poleM); p.position.set(px, -y / 2, -0.5); s.add(p); }
      const p = new T.Mesh(new T.PlaneGeometry(w, h), mat); s.add(p);
      if (ticker) { const t = new T.Mesh(new T.PlaneGeometry(w, w / 16), new T.MeshBasicMaterial({ map: tickerTex(), fog: false })); t.position.y = -h / 2 - w / 32 - 0.1; t.position.z = 0.02; s.add(t); }
      return p;
    };
    const liveMat = () => new T.MeshBasicMaterial({ map: rtTex, fog: false });
    for (const z of [80, 104]) { live.push(mk(-8.6, 12, TSQ.z + z - 104, Math.PI / 2, 12, 6.75, liveMat(), true)); live.push(mk(8.6, 14, TSQ.z + z - 92, -Math.PI / 2, 12, 6.75, liveMat(), true)); }
    live.push(mk(0, 17, TSQ.z + 42, Math.PI, 20, 11.25, liveMat(), true)); // гигантский экран в конце улицы
    // реклама
    const ads = [adTex('VOUGHT', ['#0d2a7a', '#1b62d6'], '#ffffff', 'ЗАЩИЩАЯ АМЕРИКУ'), adTex('THE SEVEN', ['#2a0d0d', '#8a1a1a'], '#ffd24a', 'ВСЕ СЕМЕРО. ОДНА СЕМЬЯ'),
      adTex('SEVEN ON 7', ['#141414', '#3a3a3a'], '#ffe14a', 'НОВОСТИ 24/7'), adTex('VOUGHT+', ['#3a0a4a', '#a01a8a'], '#ffffff', 'СМОТРИ ПЕРВЫМ')];
    mk(-8.6, 22, TSQ.z - 14, Math.PI / 2, 10, 5, new T.MeshBasicMaterial({ map: ads[0], fog: false }));
    mk(8.6, 23, TSQ.z + 2, -Math.PI / 2, 10, 5, new T.MeshBasicMaterial({ map: ads[1], fog: false }));
    mk(-8.6, 21, TSQ.z + 12, Math.PI / 2, 9, 4.5, new T.MeshBasicMaterial({ map: ads[2], fog: false }));
    mk(8.6, 22, TSQ.z + 26, -Math.PI / 2, 9, 4.5, new T.MeshBasicMaterial({ map: ads[3], fog: false }));
    // толпа смотрит на экраны
    const crowd = [];
    for (let i = 0; i < 28; i++) {
      const a = g.spawn('civ', U.rand(-5.5, 5.5), TSQ.z + U.rand(-18, 10), { mood: 'watch' });
      a.invuln = true; a.lookAt = V(a.pos.x < 0 ? -8.6 : 8.6, 12, a.pos.z + U.rand(-4, 8));
      if (Math.random() < 0.45) a.lookAt = V(0, 17, TSQ.z + 42);
      a.think = function (dt) {
        this.stop(dt); this.face(this.lookAt, dt, 4);
        this.anim = this.panic ? 'scared' : this.cheer ? 'cheer' : 'idle'; this.animOpt = {};
      };
      crowd.push(a);
    }
    const off = [offlineTex(1), offlineTex(2), offlineTex(3)];
    let state = 'live', ft = 0, fi = 0;
    return {
      live, crowd,
      flash() { state = 'flash'; ft = 0; for (const p of live) { p.material.map = null; p.material.color.setHex(0xffffff); p.material.needsUpdate = true; } },
      update(dt) {
        if (state === 'flash') { ft += dt; if (ft > 0.18) { state = 'off'; for (const p of live) { p.material.color.setHex(0xffffff); p.material.map = off[0]; p.material.needsUpdate = true; } } }
        else if (state === 'off') { ft += dt; if (ft > 0.07) { ft = 0; fi = (fi + 1) % 3; for (const p of live) p.material.map = off[fi]; } }
      },
      remove() { g.scene.remove(grp); for (const a of crowd) a.remove(); for (const t of off) t.dispose(); },
    };
  }

  // ---------- концовка ----------
  // kill: поднимает Бутчера за горло, держит, бросает об стену → камера → лазеры в объектив → CAMERA OFFLINE → взлёт сквозь крышу
  // mercy: оглядывается, камеру не трогает, улетает сквозь потолок — Таймс-сквер видит это в прямом эфире → взлёт над Белым домом
  function startTS(g, v) {
    v.rt = new T.WebGLRenderTarget(512, 288);
    v.pov = new T.PerspectiveCamera(62, 16 / 9, 0.05, 400);
    v.ts = makeTimesSquare(g, v.rt.texture);
  }
  function renderPOV(g, v, look) {
    const L = v.liveCam; v.pov.position.copy(L.pos); v.pov.lookAt(look);
    const R = g.renderer; if (R) { const prev = R.getRenderTarget(); R.setRenderTarget(v.rt); R.render(g.scene, v.pov); R.setRenderTarget(prev); }
  }
  const tsCam = (g, k) => cam(g, V(0.6 - k * 0.6, 2.0 + k * 1.5, TSQ.z - 26 + k * 12), V(0, 12 + k * 2, TSQ.z + 30), 2.5);
  function go(e, ph) { e.ph = ph; e.T = 0; }

  const endingStep = {
    text: 'Финал',
    enter(g, v) {
      const P = g.player, O = v.O, c = O.center;
      g.ui.boss(null); g.music(null);
      if (!v.liveCam) v.liveCam = makeLiveCam(g, O);
      for (const a of g.actors) if (a.alive && a.faction === 'enemy' && a !== v.b) cineHit(g, () => a.damage(1e6, P));
      const b = v.b;
      if (b) { b.c.tentacles.forEach((t) => (t.root.visible = false)); g.fx.setBeam(5, null); }
      if (b && b.alive) b.think = function (dt) { this.anim = 'knocked'; this.animOpt = { lash: false }; this.stop(dt); };
      P.downT = 0; P.c.cur.pitch = 0; P.flying = false; P.scriptVel = null; P.scriptPose = null; P.noClip = false;
      g.cinema(P.center, c);
      const kill = v.ending === 'kill';
      v.en = { T: 0, ph: kill ? 'k_walk' : 'look', kill };
      if (kill && b) {
        P.place(c.x + 3.4, 0, c.z + 0.3, -Math.PI / 2);
        b.noPhysics = true; b.vel.set(0, 0, 0); b.pos.set(c.x + 0.5, 0, c.z + 0.3); b.yaw = Math.PI / 2;
        b.c.cur.pitch = -1.52;
        b.puppet = (dt) => M.animate(b.c, dt, 'knocked', 0);
        cut(g, V(c.x + 2.2, 1.5, c.z + 5.5), V(c.x + 1.2, 0.8, c.z + 0.3));
      } else {
        P.place(c.x + 0.5, 0, c.z + 0.5, 0);
        cut(g, P.center.add(V(5, 1.2, 4)), P.center);
      }
      A().heartbeat(0.5);
    },
    update(g, dt, v) {
      const e = v.en, P = g.player, O = v.O, L = v.liveCam, b = v.b, c = O.center;
      e.T += dt;
      const stand = L.pos.clone().addScaledVector(L.dir, 1.55).setY(0);
      const faceTo = (p) => Math.atan2(p.x - P.pos.x, p.z - P.pos.z);
      switch (e.ph) {
        // ===== покончить с Бутчером =====
        case 'k_walk': {
          P.scriptMove = V(c.x + 1.45, 0, c.z + 0.3); P.scriptSpeed = 1.8;
          cam(g, V(c.x + 2.2, 1.5, c.z + 5.5), V(c.x + 1.2, 0.8, c.z + 0.3), 2);
          if (e.T > 1.9) { P.scriptMove = null; P.scriptFace = -Math.PI / 2; go(e, 'k_lift'); A().punch(); e.from = b.pos.clone(); }
          break;
        }
        case 'k_lift': {
          P.scriptFace = -Math.PI / 2; P.scriptPose = 'grab';
          const k = Math.min(1, e.T / 0.9), hand = V(P.pos.x - 0.8, 0.62, P.pos.z);
          b.pos.lerpVectors(e.from, hand, k * k * (3 - 2 * k)); b.yaw = Math.PI / 2;
          const mode = k < 0.45 ? 'knocked' : 'choked';
          b.puppet = (d) => M.animate(b.c, d, mode, 0);
          cam(g, V(c.x + 1.0, 1.7, c.z + 4.2), V(c.x + 0.9, 1.5, c.z + 0.3), 3);
          if (e.T > 0.9) {
            go(e, 'k_hold'); e.hb = 0;
            g.ui.say([['hl', 'Тихо, Билли. Тихо… Ты так долго этого ждал.', 2.6], ['but', '*хрипит* …иди… ты… к чёрту…', 2.2]]);
          }
          break;
        }
        case 'k_hold': { // держит за горло ~5 секунд
          P.scriptFace = -Math.PI / 2; P.scriptPose = 'grab'; P.scriptHead = -0.08;
          b.pos.set(P.pos.x - 0.8, 0.62 + Math.sin(e.T * 9) * 0.025, P.pos.z);
          b.puppet = (d) => M.animate(b.c, d, 'choked', 0);
          const a = 0.5 - e.T * 0.16, mid = V(P.pos.x - 0.4, 1.85, P.pos.z);
          cam(g, mid.clone().add(V(Math.sin(a) * 2.6, 0.1, Math.cos(a) * 2.6)), mid, 2.5);
          e.hb -= dt; if (e.hb <= 0) { e.hb = 1.1 - e.T * 0.1; A().heartbeat(0.4 + e.T * 0.08); }
          if (e.T > 5) {
            go(e, 'k_throw'); P.scriptPose = 'punch';
            e.tv = V(-27, 2.5, 0); A().whoosh(); g.fx.addShake(0.4);
            b.spin = 0;
          }
          break;
        }
        case 'k_throw': { // бросок об стену
          if (e.T > 0.3) P.scriptPose = null;
          e.tv.y -= 12 * dt; b.pos.addScaledVector(e.tv, dt); b.spin += dt * 10;
          b.puppet = (d) => M.animate(b.c, d, 'tumble', 0, { spin: b.spin * 0.6 });
          cam(g, V(c.x - 2, 2.2, c.z + 7.5), b.center, 6);
          const q = b.pos.clone(); q.y = 0;
          if (O.clampInside(q) || e.T > 1.4) {
            b.pos.x = q.x; b.pos.z = q.z;
            const n = V(c.x, 0, c.z).sub(q).normalize(), wallPt = b.center.addScaledVector(n, -0.6);
            A().slam(); A().punch(); g.fx.addShake(1.3); g.ui.flash(0.2); g.hitStop = 0.12;
            g.fx.dust(wallPt, 14); g.fx.burst(wallPt, 26, { color: [0xf1e7c6, 0xd8ccb0, 0xffffff], speed: 10, size: 0.35, life: 1.2, g: -18 });
            for (let k = 0; k < 6; k++) g.fx.scorch(wallPt.clone().add(V(0, U.rand(-0.8, 0.8), U.rand(-0.8, 0.8))), n);
            go(e, 'k_slide');
          }
          break;
        }
        case 'k_slide': {
          b.pos.y = Math.max(0, b.pos.y - dt * 4);
          b.puppet = (d) => M.animate(b.c, d, 'knocked', 0);
          cam(g, V(c.x - 4, 1.6, c.z + 5), b.center, 3);
          if (e.T > 0.8) { b.puppet = null; b.noPhysics = false; b.vel.set(0, 0, 0); b.alive = false; b.keepBody = true; go(e, 'k_after'); }
          break;
        }
        case 'k_after': { // смотрит на тело: тот больше не встаёт
          P.scriptFace = faceTo(b.pos); P.scriptHead = 0.3;
          cam(g, P.center.add(V(1.4, 0.4, 2.2)), b.center, 2.5);
          if (e.T > 0.3 && !e.said) { e.said = true; g.ui.say([['sys', '*Бутчер больше не встаёт*', 2]]); }
          if (e.T > 2.6) go(e, 'walk');
          break;
        }
        // ===== общий кусок: оглядывается =====
        case 'look': {
          P.scriptFace = e.T * 0.9; P.scriptHead = 0.25;
          const a = e.T * 0.45 + 0.6;
          cam(g, P.center.add(V(Math.sin(a) * 5.5, 1.0, Math.cos(a) * 5.5)), P.center.add(V(0, 0.2, 0)), 3);
          if (e.T > 4.2) { P.scriptFace = null; go(e, 'm_glance'); }
          break;
        }
        // ===== милосердие =====
        case 'm_glance': { // смотрит на камеру… и отворачивается
          P.scriptFace = e.T < 1.5 ? faceTo(L.pos) : faceTo(L.pos) + Math.PI; P.scriptHead = e.T < 1.5 ? 0.35 : -0.2;
          cam(g, L.pos.clone().addScaledVector(L.dir, -1.2).add(V(1.6, 1.1, 0.8)), P.center.lerp(L.pos, 0.3), 3);
          if (e.T > 0.4 && !e.said) { e.said = true; g.ui.say([['hl', '…Пусть смотрят.', 1.8]]); }
          if (e.T > 2.6) {
            go(e, 'm_ts'); startTS(g, v);
            cut(g, V(0.6, 2.0, TSQ.z - 26), V(0, 12, TSQ.z + 20));
            g.ui.caption('ТАЙМС-СКВЕР, НЬЮ-ЙОРК', 0.45);
          }
          break;
        }
        case 'm_ts': { // на всех экранах: Хоумлендер пробивает потолок и улетает
          tsCam(g, Math.min(1, e.T / 5));
          if (e.T > 2.6) { P.noClip = true; P.flying = true; P.scriptPose = null; P.scriptVel = V(0, e.T < 3.2 ? 4 : 45, 0); }
          if (P.pos.y > O.H - 2.2 && !e.ceil) {
            e.ceil = true; const cp = V(P.pos.x, O.H - 0.2, P.pos.z);
            for (let k = 0; k < 40; k++) g.fx.burst(cp, 1, { color: [0xf1e7c6, 0xffffff, 0xd8ccb0], speed: 9, size: 0.4, life: 1.8, g: -20 });
            g.fx.dust(cp, 10); A().explosion(0.5);
            for (const a of v.ts.crowd) a.cheer = true;
            setTimeout(() => A().cheer(), 200);
          }
          renderPOV(g, v, V(P.pos.x, Math.min(P.center.y, O.H + 1), P.pos.z));
          if (e.T > 6.2) go(e, 'roof');
          break;
        }
        // ===== к камере и лазеры в объектив (только kill) =====
        case 'walk': {
          P.scriptHead = 0.35; P.scriptMove = stand; P.scriptSpeed = 1.6; P.scriptFace = null;
          cam(g, L.pos.clone().addScaledVector(L.dir, -1.2).add(V(1.6, 1.1, 0.8)), P.center.lerp(L.pos, 0.35), 3);
          if (P.pos.distanceTo(stand) < 0.2 || e.T > 4) { P.scriptMove = null; P.scriptFace = faceTo(L.pos); recOverlay(true); A().beep(); go(e, 'pov'); }
          break;
        }
        case 'pov': { // вид из разбитой камеры: смотрит прямо в объектив
          P.scriptHead = 0.5; P.scriptGlow = e.T > 1.0;
          if (e.T > 1.0 && !e.ch) { e.ch = true; A().charge(2.4); }
          const tgt = P.center.add(V(0, 0.55, 0));
          if (e.T < dt * 1.5) cut(g, L.pos, tgt); else cam(g, L.pos, tgt, 6);
          if (e.T > 2.0) {
            recOverlay(false); startTS(g, v); go(e, 'ts_live');
            cut(g, V(0.6, 2.0, TSQ.z - 26), V(0, 12, TSQ.z + 20));
            g.ui.caption('ТАЙМС-СКВЕР, НЬЮ-ЙОРК', 0.45); A().boo();
          }
          break;
        }
        case 'ts_live': {
          tsCam(g, Math.min(1, e.T / 4));
          renderPOV(g, v, P.center.add(V(0, 0.55, 0)));
          if (e.T > 2.3) { // крупно: лазеры бьют прямо в камеру
            go(e, 'laser'); A().setLaser(true);
            const side = V(-L.dir.z, 0, L.dir.x);
            e.shotPos = P.center.lerp(L.pos, 0.5).addScaledVector(side, 3.6).add(V(0, 0.3, 0));
            cut(g, e.shotPos, P.center.lerp(L.pos, 0.5));
          }
          break;
        }
        case 'laser': {
          const tgt = L.pos.clone().add(V(0, 0.02, 0));
          g.fx.setBeam(0, P.eyePos(0), tgt, 2.8); g.fx.setBeam(1, P.eyePos(1), tgt, 2.8);
          g.fx.sparks(tgt, 0xffb0a0, 4); g.fx.flashLight(tgt, 0xff2a1a, 5, 0.06, 12);
          cam(g, e.shotPos, P.center.lerp(L.pos, 0.5), 4);
          if (e.T > 0.9 && !e.boom) {
            e.boom = true; g.fx.burst(tgt, 20, { color: [0xffffff, 0xffd080, 0xff6020], speed: 9, size: 0.18, life: 0.5 }); g.fx.flashLight(tgt, 0xffa040, 6, 0.3, 15); A().explosion(0.4); L.red.visible = false; L.grp.rotation.x += 0.4; g.fx.addShake(0.4);
          }
          if (e.T > 1.4) {
            g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false); P.scriptGlow = false;
            go(e, 'ts_off'); v.ts.flash(); HL.Audio.static && HL.Audio.static();
            for (const a of v.ts.crowd) a.panic = true;
            setTimeout(() => A().boo(), 250);
            cut(g, V(0.4, 2.6, TSQ.z - 20), V(0, 13, TSQ.z + 30));
          }
          break;
        }
        case 'ts_off': {
          tsCam(g, 0.5 + Math.min(0.5, e.T / 5));
          if (e.T > 2.8) go(e, 'roof');
          break;
        }
        // ===== взлёт сквозь крышу Белого дома =====
        case 'roof': {
          if (e.T < dt * 1.5) {
            if (v.ts) { v.ts.remove(); v.ts = null; } if (v.rt) { v.rt.dispose(); v.rt = null; }
            P.noClip = false; P.scriptFace = null; P.scriptHead = null; P.scriptPose = null;
            P.place(ROOF.x, 12, ROOF.z, 0); P.flying = true; P.scriptVel = V(0, 0, 0);
            cut(g, V(26, 3.5, -194), V(0, 20, -250)); A().heartbeat(0.7);
          }
          P.flying = true;
          if (e.T < 0.9) { P.scriptVel = V(0, 0, 0); P.pos.y = 12; g.fx.addShake(0.08); }
          if (e.T > 0.9 && !e.burst) {
            e.burst = true; P.pos.y = ROOF.y - 0.5;
            g.fx.explosion(ROOF, 2.4); A().explosion(2); A().slam(); g.fx.addShake(1.4); g.ui.flash(0.3);
            for (let i = 0; i < 60; i++) g.fx.burst(ROOF, 1, { color: [0xf4f2ec, 0xd8d4c8, 0xb8bcc4, 0x8a8e98], speed: 24, size: 0.7, life: 2.2, g: -22, drag: 0.3, up: true });
            P.scriptVel = V(0, 42, 0);
          }
          if (e.T > 1.7 && !e.sboom) {
            e.sboom = true; P.scriptVel = V(0, 420, 0);
            HL.Audio.sonic ? HL.Audio.sonic() : A().explosion(2);
            g.fx.ring(P.pos.clone(), 0xffffff, 60, 0.9); g.fx.ring(P.pos.clone().setY(P.pos.y - 3), 0xdde8ff, 40, 0.7);
            g.fx.burst(P.center, 40, { color: [0xffffff, 0xe0ecff], speed: 30, size: 0.6, life: 0.7, g: 0, drag: 2 });
            g.ui.flash(0.5); g.fx.addShake(1.5);
          }
          const look = e.T < 1.7 ? V(0, 22 + Math.max(0, e.T - 0.9) * 8, -250) : V(0, 60 + Math.min(1, (e.T - 1.7) * 2) * 200, -250);
          cam(g, V(26, 3.5, -194), look, e.T < 1.7 ? 4 : 2.5);
          if (Math.random() < 0.4) g.fx.smoke(ROOF, 1);
          if (e.T > 4.4) return true;
          break;
        }
      }
      if (v.ts) v.ts.update(dt);
      return false;
    },
    exit(g, v) {
      recOverlay(false);
      if (v.ts) { v.ts.remove(); v.ts = null; }
      if (v.rt) { v.rt.dispose(); v.rt = null; }
      if (v.b) v.b.puppet = null;
      g.fx.setBeam(0, null); g.fx.setBeam(1, null); A().setLaser(false);
      const P = g.player; P.scriptVel = V(); P.scriptHead = null; P.scriptGlow = false; P.noClip = false;
    },
  };

  return { armyStep, endingStep, makeLiveCam, cineHit, recOverlay };
})();
