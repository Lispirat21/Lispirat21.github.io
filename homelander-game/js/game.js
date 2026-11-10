// Ядро: рендерер, цикл, камера, спавн, сюжетный движок, меню/пауза/результаты
HL.Game = (function () {
  const T = THREE, U = HL.U, M = HL.Models, S = HL.Settings, A = HL.Audio, In = HL.Input, $ = HL.$;
  const AC = HL.Actors;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

  const g = {
    state: 'loading', time: 0, actors: [], projectiles: [], rings: [],
    approval: 70, camYaw: 0, camPitch: 0.2, controlsEnabled: true, cinematic: false,
    aim: { point: V(), normal: null, actor: null, dir: V(0, 0, 1) }, waypoint: null, hitStop: 0, diffMul: 1,
  };
  let renderer = null, scene = null, camera = null, mission = null, rain = null, musicMood = undefined;
  let last = performance.now(), wasLocked = false, camPos = V(), camLook = V(), deathT = -1, camDistCur = 7;
  const ui = HL.UI.create(g); g.ui = ui;

  // ================= рендерер =================
  function makeRenderer() {
    let cv = $('c');
    if (renderer) {
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
      const n = document.createElement('canvas'); n.id = 'c'; cv.replaceWith(n); cv = n;
    }
    renderer = new T.WebGLRenderer({ canvas: cv, antialias: !!S.data.antialias, powerPreference: 'high-performance' });
    g.renderer = renderer;
    renderer.shadowMap.enabled = S.data.shadows > 0;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    sizeRenderer();
  }
  function sizeRenderer() {
    const pr = Math.min(devicePixelRatio || 1, S.data.maxPixelRatio) * S.data.renderScale;
    renderer.setPixelRatio(Math.max(0.35, pr));
    renderer.setSize(innerWidth, innerHeight);
    if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
    HL.Menu.layout();
  }
  addEventListener('resize', () => renderer && sizeRenderer());

  function configSun() {
    if (!g.world) return;
    const sun = g.world.sun, s = S.data.shadows;
    sun.castShadow = s > 0;
    if (s > 0) {
      const sz = S.shadowSize, ext = [0, 45, 70, 95][s];
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.shadow.mapSize.set(sz, sz);
      Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 420 });
      sun.shadow.camera.updateProjectionMatrix();
    }
  }
  g.applySettings = function (k) {
    const all = k === 'all' || k === 'preset';
    if (all || k === 'antialias' || k === 'shadows') { makeRenderer(); configSun(); }
    if (all || k === 'renderScale') sizeRenderer();
    if (all || k === 'outlines') M.setOutlines(S.data.outlines);
    if ((all || k === 'drawDist') && scene && scene.fog) { scene.fog.near = S.drawDistance * 0.35; scene.fog.far = S.drawDistance; camera.far = S.drawDistance + 900; camera.updateProjectionMatrix(); }
    if (all || k === 'music' || k === 'sfx') A.applyVolumes();
    if (all || k === 'controls') applyControls();
    if (all || k === 'uiScale') applyUiScale();
  };
  function applyUiScale() { document.documentElement.style.setProperty('--ui', String(S.data.uiScale || 1)); }
  function applyControls() {
    document.body.classList.toggle('touch', S.useTouch);
    $('touch').classList.toggle('hidden', !(S.useTouch && g.state === 'play'));
  }

  // ================= спавн =================
  g.spawn = function (kind, x, z, o = {}) {
    const D = M.DEFS;
    let a;
    switch (kind) {
      case 'civ': a = new AC.Civilian(g, o); break;
      case 'victim': a = new AC.Victim(g, o); break;
      case 'hughie': a = new AC.Civilian(g, Object.assign({ def: D.hughie, hp: 1e9 }, o)); a.faction = 'ally'; break;
      case 'thug': a = new AC.Gunman(g, D.thug, Object.assign({ weapon: 'pistol', hp: 55, showHp: true }, o)); break;
      case 'agent': a = new AC.Gunman(g, D.agent, Object.assign({ weapon: 'rifle', hp: 80, showHp: true }, o)); break;
      case 'frenchie': a = new AC.Grenadier(g, D.frenchie, o); a.name = 'Френчи'; break;
      case 'mm': a = new AC.Gunman(g, D.mm, Object.assign({ weapon: 'heavy', hp: 620, showHp: true, prefDist: 20, speed: 3.5 }, o)); a.knockMul = 0.5; break;
      case 'kimiko': a = new AC.Brawler(g, D.kimiko, o); a.keepBody = true; break;
      case 'ryan': a = new AC.Ryan(g, o); break;
      case 'starlight': a = new AC.Starlight(g, o); break;
      case 'soldierboy': a = new AC.SoldierBoy(g, o); break;
      case 'butcherBoss': a = new AC.ButcherBoss(g, o); break;
      case 'butcher': a = new AC.Actor(g, D.butcher, Object.assign({ faction: 'ally', hp: 1e9 }, o)); break;
      case 'atrain': a = new AC.Runner(g, o.path, o); break;
      case 'van': case 'police': case 'ambulance': case 'car': case 'taxi':
        a = new AC.Vehicle(g, kind, Object.assign({ hp: kind === 'van' ? 900 : kind === 'ambulance' ? 1e9 : 140, faction: 'vehicle' }, o));
        if (kind === 'ambulance') a.invuln = true;
        break;
      case 'marker': a = new AC.Actor(g, null, { faction: 'prop', hp: 1e9 }); a.invuln = true; a.noPhysics = true; break;
    }
    a.group = o.group || null;
    a.place(x, o.y || 0, z);
    if (o.yaw != null) a.yaw = o.yaw;
    a.sync();
    g.actors.push(a);
    return a;
  };
  g.spawnGroup = function (group, kind, center, n, o = {}) {
    const out = [];
    let roofs = null;
    if (o.roof) roofs = g.world.lots.filter((b) => b.y1 < 40).sort((a, b) => U.dist2D({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 }, center) - U.dist2D({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }, center));
    for (let i = 0; i < n; i++) {
      let x, z, y = 0;
      if (roofs && roofs.length) { const b = roofs[i % Math.min(3, roofs.length)]; x = U.rand(b.x0 + 2, b.x1 - 2); z = U.rand(b.z0 + 2, b.z1 - 2); y = b.y1; }
      else {
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * (o.spread || 10);
          x = center.x + Math.cos(a) * r; z = center.z + Math.sin(a) * r;
          if (!g.world.query(x, z, 1.5).some((b) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1)) break;
        }
      }
      out.push(g.spawn(kind, x, z, Object.assign({}, o, { group, y, static: !!roofs })));
    }
    return out;
  };
  g.groupCount = (name) => g.actors.reduce((n, a) => n + (a.group === name && a.alive ? 1 : 0), 0);
  g.groupNearest = function (name) {
    let best = null, bd = 1e9;
    for (const a of g.actors) if (a.group === name && a.alive) { const d = a.pos.distanceTo(g.player.pos); if (d < bd) { bd = d; best = a; } }
    return best ? best.center : null;
  };
  g.spawnCrowd = function (mult = 1) {
    const n = Math.round(S.crowdCount * mult);
    const c = g.player.pos;
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const p = g.world.randomSidewalk();
      if (p.distanceTo(c) > 150 || p.distanceTo(c) < 6) continue;
      g.spawn('civ', p.x + U.rand(-1, 1), p.z + U.rand(-1, 1)); k++;
    }
  };
  g.spawnTraffic = function () {
    const n = S.trafficCount;
    for (let i = 0; i < n; i++) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const line = U.randi(-3, 3) * 70, dir = Math.random() < 0.5 ? 1 : -1;
      const yaw = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
      const R = V(-Math.cos(yaw), 0, Math.sin(yaw));
      const along = U.rand(-270, 270);
      const p = axis === 'x' ? V(along, 0, line) : V(line, 0, along);
      p.addScaledVector(R, 3.5);
      if (p.distanceTo(g.player.pos) < 12) continue;
      g.spawn(Math.random() < 0.1 ? 'police' : Math.random() < 0.4 ? 'taxi' : 'car', p.x, p.z, { yaw, lane: { axis }, hp: 140 });
    }
  };
  g.spawnProj = function (type, from, vel, o) { g.projectiles.push(new AC.Proj(g, type, from, vel, o)); };
  g.hurtPlayer = function (dmg, from, o) { g.player.hurt(dmg, from, o); };
  g.alarm = function (pos, r) { for (const a of g.actors) if (a.faction === 'civ' && a.alive && a.scare && a.pos.distanceTo(pos) < r) a.scare(pos, U.rand(5, 9)); };
  g.explode = function (pos, r, dmg, src, scale = 1) {
    g.fx.explosion(pos, scale); A.explosion(scale);
    const d = pos.distanceTo(camera.position); g.fx.addShake(U.clamp(1.2 - d / 80, 0, 1) * scale);
    for (const a of g.actors) {
      if (!a.alive || a === src || a.pickable) continue;
      const dd = a.center.distanceTo(pos);
      if (dd < r) {
        const k = 1 - dd / r;
        a.damage(dmg * (0.4 + 0.6 * k), src, a.faction === 'vehicle' ? null : a.center.sub(pos).normalize().multiplyScalar(14 * k + 6).setY(8 * k + 4));
      }
    }
    for (const b of g.world.query(pos.x, pos.z, r)) {
      if (b.kind !== 'building' || b.dead) continue;
      const cx = U.clamp(pos.x, b.x0, b.x1), cz = U.clamp(pos.z, b.z0, b.z1), cy = U.clamp(pos.y, 0, b.y1);
      const dd = Math.hypot(pos.x - cx, pos.y - cy, pos.z - cz);
      if (dd < r) g.world.damageBuilding(b, dmg * 2.5 * (1 - dd / r * 0.6), V(cx, cy, cz));
    }
    if (src !== g.player && g.player.center.distanceTo(pos) < r) g.hurtPlayer(dmg * (1 - g.player.center.distanceTo(pos) / r * 0.6), pos, { knock: 16, down: dmg >= 100 });
    g.alarm(pos, 45);
  };
  g.onDeath = function (a, src) {
    const byPlayer = src === g.player || (src && src.faction === 'vehicle' && src.lastHurtBy === g.player);
    if (a.faction === 'civ' && !a.pickable) {
      if (byPlayer || src === g.player) {
        g.player.stats.civ++;
        g.changeApproval(-6, 'Погиб гражданин');
        ui.float(a.center, '−6% ГРАЖДАНИН', '#ff5050'); A.boo();
      }
      g.alarm(a.pos, 30);
    } else if (a.faction === 'enemy') {
      if (src === g.player) { g.player.stats.kills++; g.player.rage = Math.min(100, g.player.rage + 7); }
      if (!a.boss) ui.float(a.center, a.name && a.name !== 'Наёмник' && a.name !== 'Грабитель' ? a.name.toUpperCase() + ' ПОВЕРЖЕН' : '✖', '#ffd24a');
    }
  };
  g.changeApproval = function (d, reason) {
    if (mission && mission.def.noApproval) return;
    g.approval = U.clamp(g.approval + d, 0, 100);
    if (g.approval <= 0 && g.state === 'play') g.fail('Рейтинг одобрения упал до нуля. Vought расторгла с вами контракт.');
  };
  g.setTimer = (s) => { if (mission) mission.timer = s; ui.timer(s); };
  g.music = function (mood) {
    if (mood === musicMood) return; musicMood = mood;
    if (mood) A.gameMusic(mood); else A.stopMusic();
  };
  g.cinema = function (pos, look) {
    if (pos) { g.camOverride = { pos: pos.clone(), look: look.clone() }; g.cinematic = true; g.controlsEnabled = false; }
    else { g.camOverride = null; g.cinematic = false; g.controlsEnabled = true; }
  };
  g.addRing = function (p) { const r = M.buildRing(); r.position.copy(p); scene.add(r); g.rings.push(r); return r; };
  g.removeRing = function (r) { scene.remove(r); const i = g.rings.indexOf(r); if (i >= 0) g.rings.splice(i, 1); };
  g.highlightRing = function (list, i) {
    list.forEach((r, k) => {
      const on = k === i, nx = k === i + 1;
      r.visible = k >= i;
      r.children.forEach((m) => m.material.color.setHex(on ? 0xffd23a : nx ? 0x8a7a50 : 0x555555));
      r.scale.setScalar(on ? 1 : 0.8);
    });
  };

  // ================= прицел =================
  const ray = new T.Raycaster();
  function computeAim() {
    const P = g.player;
    const o = camera.position.clone(), d = V(); camera.getWorldDirection(d);
    o.addScaledVector(d, Math.max(0, o.distanceTo(P.center) - 0.5));
    const wh = g.world.raycast(o, d, 320);
    let tBest = wh ? wh.t : 320, actor = null;
    for (const a of g.actors) {
      if (!a.alive || a.carried || a.faction === 'prop' || a.faction === 'ally') continue;
      const r = a.faction === 'vehicle' ? 1.8 : 0.62 * (a.c ? a.c.root.scale.y : 1);
      const pts = a.faction === 'vehicle' ? [a.center] : [a.pos.clone().setY(a.pos.y + 0.6), a.pos.clone().setY(a.pos.y + 1.45)];
      for (const c of pts) {
        const oc = c.sub(o); const tc = oc.dot(d); if (tc < 0 || tc > tBest) continue;
        const d2 = oc.lengthSq() - tc * tc; if (d2 > r * r) continue;
        const t = tc - Math.sqrt(r * r - d2);
        if (t < tBest) { tBest = t; actor = a; }
      }
    }
    // автонаведение на сенсорном управлении
    if (!actor && S.useTouch) {
      let best = null, ba = 0.1;
      for (const a of g.actors) {
        if (!a.alive || a.faction !== 'enemy' && a.faction !== 'vehicle') continue;
        if (a.faction === 'vehicle' && !a.group) continue;
        const to = a.center.sub(o); const L = to.length(); if (L > 140) continue;
        const ang = Math.acos(U.clamp(to.divideScalar(L).dot(d), -1, 1));
        if (ang < ba && g.world.los(o, a.center)) { ba = ang; best = a; }
      }
      if (best) { actor = best; tBest = best.center.distanceTo(o); g.aim.point.copy(best.center); }
    }
    const A2 = g.aim;
    if (!(actor && S.useTouch && A2.point && actor.center.distanceTo(A2.point) < 0.01)) A2.point.copy(o).addScaledVector(d, tBest);
    A2.actor = actor; A2.normal = actor ? null : wh && wh.t <= tBest + 0.01 ? wh.normal : null; A2.box = A2.normal && wh ? wh.box : null;
    A2.dir = A2.point.clone().sub(P.center).normalize();
  }

  // ================= камера =================
  function updateCamera(dt) {
    const P = g.player;
    if (g.camOverride) {
      if (g.camOverride.snap) { camPos.copy(g.camOverride.pos); camLook.copy(g.camOverride.look); g.camOverride.snap = false; }
      const cr = g.camOverride.rate || 3; camPos.lerp(g.camOverride.pos, 1 - Math.exp(-cr * dt)); camLook.lerp(g.camOverride.look, 1 - Math.exp(-cr * dt));
      camera.position.copy(camPos); camera.lookAt(camLook);
      return;
    }
    const yaw = g.camYaw, pitch = g.camPitch;
    const dir = V(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const R = V(-Math.cos(yaw), 0, Math.sin(yaw));
    const tgt = P.pos.clone().add(V(0, P.flying && P.vel.length() > 7 ? 1.4 : 1.75, 0)).addScaledVector(R, -0.85);
    const speed = P.vel.length();
    const want = S.data.camDist + (P.flying ? Math.min(5, speed * 0.05) : 0);
    // столкновение камеры с домами
    const back = dir.clone().negate();
    const hit = g.world.raycast(tgt, back, want);
    let dist = hit ? Math.max(1.2, hit.t - 0.5) : want;
    camDistCur = dist < camDistCur ? dist : U.damp(camDistCur, dist, 4, dt);
    const pos = tgt.clone().addScaledVector(back, camDistCur);
    if (pos.y < 0.4) pos.y = 0.4;
    const sh = g.fx.shake;
    if (sh > 0) pos.add(V((Math.random() - 0.5) * sh * 0.5, (Math.random() - 0.5) * sh * 0.5, (Math.random() - 0.5) * sh * 0.5));
    camera.position.copy(pos); camPos.copy(pos);
    camLook.copy(tgt).addScaledVector(dir, 30);
    camera.lookAt(camLook);
    const fov = S.data.fov + (P.flying ? Math.min(14, Math.max(0, speed - 25) * 0.3) : 0);
    if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = U.damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
  }

  // ================= дождь =================
  function makeRain() {
    const N = [400, 900, 1500, 2400][S.data.particles];
    const geo = new T.BufferGeometry(); const p = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = U.rand(-40, 40), y = U.rand(0, 40), z = U.rand(-40, 40); p.set([x, y, z, x + 0.15, y - 1.1, z], i * 6); }
    geo.setAttribute('position', new T.BufferAttribute(p, 3));
    const m = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x9ab0d0, transparent: true, opacity: 0.45 }));
    m.frustumCulled = false; scene.add(m);
    return { m, p, N };
  }
  function updateRain(dt) {
    const r = rain, c = camera.position;
    for (let i = 0; i < r.N; i++) {
      const k = i * 6;
      r.p[k + 1] -= 38 * dt; r.p[k + 4] -= 38 * dt;
      if (r.p[k + 4] < c.y - 20) { const x = c.x + U.rand(-40, 40), y = c.y + U.rand(10, 30), z = c.z + U.rand(-40, 40); r.p.set([x, y, z, x + 0.15, y - 1.1, z], k); }
    }
    r.m.geometry.attributes.position.needsUpdate = true;
  }

  // ================= миссии =================
  function clearWorld() {
    if (!scene) return;
    for (const a of g.actors) a.remove();
    for (const p of g.projectiles) p.kill();
    g.actors = []; g.projectiles = []; g.rings = [];
    if (g.world) g.world.dispose();
    g.world = null; scene = null; rain = null; g.player = null; g.fx = null;
    g.onPose = g.onDrop = g.onPickup = g.onHear = g.missionUpdate = null;
  }
  function startMission(def, idx) {
    A.init();
    clearWorld();
    ui.reset();
    In.reset();
    scene = new T.Scene(); g.scene = scene;
    camera = new T.PerspectiveCamera(S.data.fov, innerWidth / innerHeight, 0.1, S.drawDistance + 900); g.camera = camera;
    g.time = 0; g.approval = 70; g.waypoint = null; g.hitStop = 0; deathT = -1; g.ending = null;
    g.world = HL.World.build(scene, { time: def.time });
    g.fx = HL.FX.create(scene); g.world.fx = g.fx;
    g.world.onDamage = function (b, f) { if (!b.dead) ui.hint('ЗДАНИЕ: ' + Math.ceil(f * 100) + '%', 0.6); };
    g.world.onCollapse = function (b, base) {
      // обрушение: давит всех рядом
      g.fx.addShake(1.2); A.explosion(1.2);
      for (const a of g.actors) {
        if (!a.alive || a.pickable || a.carried || a === g.player) continue;
        if (a.pos.x > b.x0 - 4 && a.pos.x < b.x1 + 4 && a.pos.z > b.z0 - 4 && a.pos.z < b.z1 + 4) a.damage(a.boss ? 120 : 500, g.player, a.pos.clone().sub(base).setY(0).normalize().multiplyScalar(14).setY(8));
      }
      g.alarm(base, 70);
      g.player.stats.bld = (g.player.stats.bld || 0) + 1;
      ui.float(V((b.x0 + b.x1) / 2, Math.min(b.h0, 25), (b.z0 + b.z1) / 2), 'ЗДАНИЕ РУХНУЛО', '#ff9a40');
      g.changeApproval(-3, 'Разрушено здание');
    };
    g.player = new HL.Player(g);
    const st = def.start;
    g.player.place(st[0], st[1], st[2], st[3]);
    g.camYaw = st[3]; g.camPitch = 0.18;
    g.cinema(null);
    if (def.rain) rain = makeRain();
    mission = { def, idx, si: -1, v: {}, timer: null, t0: 0 };
    def.setup && def.setup(g, mission.v);
    musicMood = undefined; g.music(def.music || 'calm');
    ui.location(def.location, 4);
    ui.objective(def.title, '');
    ui.showHud(true);
    $('menu').classList.add('hidden');
    hideScreens();
    g.state = 'play';
    applyControls();
    M.setOutlines(S.data.outlines);
    configSun();
    camDistCur = S.data.camDist;
    In.enabled = true;
    if (!S.useTouch) ui.hint('Щёлкните по экрану, чтобы управлять камерой мышью', 3.5);
    ui.fade(true); setTimeout(() => ui.fade(false), 60);
    nextStep();
    updateCamera(0.016);
  }
  function nextStep() {
    const m = mission; if (!m) return;
    const cur = m.def.steps[m.si];
    if (cur && cur.exit) cur.exit(g, m.v);
    m.si++;
    const s = m.def.steps[m.si];
    if (!s) { complete(); return; }
    if (s.text) ui.objective(m.def.title, s.text);
    if (s.enter) s.enter.call(s, g, m.v);
    if (m.si > 0) A.objective();
  }
  function missionUpdate(dt) {
    const m = mission; if (!m || g.state !== 'play') return;
    if (m.timer != null) {
      m.timer -= dt; ui.timer(m.timer);
      if (m.timer <= 0) { g.fail('Время вышло.'); return; }
    }
    g.missionUpdate && g.missionUpdate(dt);
    const s = m.def.steps[m.si]; if (!s) return;
    let done = false;
    if (s.update) done = s.update.call(s, g, dt, m.v);
    if (g.state !== 'play') return;
    g.waypoint = s.wp ? s.wp.call(s, g, m.v) : null;
    if (done) nextStep();
  }
  g.fail = function (reason) {
    if (g.state !== 'play') return;
    g.state = 'result';
    A.fail(); A.setLaser(false); A.setWind(0); g.music(null);
    endPlayUI();
    ui.result({
      win: false, title: 'МИССИЯ ПРОВАЛЕНА', sub: reason,
      stats: statRows(),
      buttons: [
        { text: 'Попробовать снова', fn: () => restart() },
        { text: 'В главное меню', fn: () => toMenu(), dim: true },
      ],
    });
  };
  function statRows() {
    const st = g.player.stats;
    return [['РЕЙТИНГ', Math.round(g.approval) + '%'], ['ВРАГОВ', st.kills], ['ЖЕРТВ СРЕДИ ГРАЖДАН', st.civ], ['ЗДАНИЙ РАЗРУШЕНО', st.bld || 0], ['ВРЕМЯ', U.fmtTime(g.time)]];
  }
  function complete() {
    const m = mission;
    g.state = 'result';
    A.success(); A.setLaser(false); A.setWind(0); g.music(null);
    endPlayUI();
    const ap = Math.round(g.approval);
    if (!m.def.free && m.idx != null) HL.Progress.complete(m.idx, { approval: ap });
    const L = HL.Missions.LIST;
    if (m.def.id === 'final') {
      HL.Progress.data.ending = g.ending; HL.Progress.save();
      ui.result({
        win: true, title: g.ending === 'mercy' ? 'КОНЕЦ: МИЛОСЕРДИЕ' : 'КОНЕЦ: БОГ', sub: HL.Missions.endingText(g.ending, ap), stats: statRows(),
        buttons: [{ text: 'Свободный полёт', fn: () => startMission(HL.Missions.FREE, null) }, { text: 'Переиграть финал', fn: () => restart() }, { text: 'В главное меню', fn: () => toMenu(), dim: true }],
      });
      return;
    }
    const btns = [];
    if (m.idx + 1 < L.length) btns.push({ text: 'Дальше: ' + L[m.idx + 1].title, fn: () => startMission(L[m.idx + 1], m.idx + 1) });
    btns.push({ text: 'Переиграть', fn: () => restart() });
    btns.push({ text: 'В главное меню', fn: () => toMenu(), dim: true });
    ui.result({ win: true, title: 'МИССИЯ ВЫПОЛНЕНА', sub: m.def.title, stats: statRows(), buttons: btns });
  }
  g.onPlayerDeath = function () { deathT = 1.8; A.stinger(); ui.caption('ДАЖЕ БОГИ ПАДАЮТ.', 0.5); };
  function restart() { const m = mission; startMission(m.def, m.idx); }
  function endPlayUI() {
    In.enabled = false; In.unlock(); ui.showHud(false); applyControls();
    $('touch').classList.add('hidden'); g.fx && g.fx.setBeam(0, null); g.fx && g.fx.setBeam(1, null);
    ui.clearDialog(); ui.boss(null);
  }
  function hideScreens() { ['pause', 'result', 'choice'].forEach((id) => $(id).classList.add('hidden')); HL.UI.closePanel(); }

  // ================= пауза / меню =================
  function pause() {
    if (g.state !== 'play') return;
    g.state = 'paused'; In.enabled = false; In.unlock();
    A.setLaser(false); A.setWind(0);
    $('pause').classList.remove('hidden'); $('touch').classList.add('hidden');
  }
  function resume() {
    if (g.state !== 'paused') return;
    $('pause').classList.add('hidden'); g.state = 'play'; In.enabled = true; applyControls();
    if (!S.useTouch) In.lock();
  }
  document.querySelectorAll('#pause [data-p]').forEach((b) => b.addEventListener('click', () => {
    A.click();
    const p = b.dataset.p;
    if (p === 'resume') resume();
    else if (p === 'restart') { $('pause').classList.add('hidden'); restart(); }
    else if (p === 'settings') HL.UI.openSettings();
    else if (p === 'controls') HL.UI.openControls();
    else if (p === 'menu') { $('pause').classList.add('hidden'); toMenu(); }
  }));
  $('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); A.click(); pause(); });
  document.addEventListener('pointerlockchange', () => {
    const locked = In.locked;
    if (!locked && wasLocked && g.state === 'play' && !g.cinematic && !document.hidden) pause();
    wasLocked = locked;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('keydown', (e) => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && g.state === 'paused' && !HL.UI.panelOpen) { e.preventDefault(); resume(); }
    else if (e.code === 'Escape' && HL.UI.panelOpen) HL.UI.closePanel();
  });

  function toMenu() {
    endPlayUI(); hideScreens();
    clearWorld(); mission = null;
    g.state = 'menu';
    $('menu').classList.remove('hidden');
    refreshMenu();
    musicMood = undefined; A.menuMusic();
  }
  function refreshMenu() {
    const P = HL.Progress.data, L = HL.Missions.LIST;
    const i = Math.min(P.unlocked - 1, L.length - 1);
    const b = $('btnContinue');
    const started = P.unlocked > 1 || Object.keys(P.done).length;
    b.disabled = !started;
    b.textContent = started ? 'Продолжить: ' + L[i].title : 'Продолжить';
  }
  document.querySelectorAll('#menuMain [data-act]').forEach((b) => b.addEventListener('click', () => {
    A.init(); A.click();
    const L = HL.Missions.LIST, P = HL.Progress.data;
    switch (b.dataset.act) {
      case 'continue': { const i = Math.min(P.unlocked - 1, L.length - 1); startMission(L[i], i); break; }
      case 'new': startMission(L[0], 0); break;
      case 'missions': HL.UI.openMissions((i) => startMission(L[i], i)); break;
      case 'free': startMission(HL.Missions.FREE, null); break;
      case 'dossier': HL.UI.openDossier(); break;
      case 'settings': HL.UI.openSettings(); break;
      case 'about': HL.UI.openAbout(); break;
      case 'exit': location.href = '../'; break;
    }
  }));
  document.querySelectorAll('#menuMain .mbtn').forEach((b) => b.addEventListener('mouseenter', () => A.ready && A.click()));

  // ================= основной шаг симуляции =================
  function step(dt) {
    g.time += dt;
    const P = g.player;
    if (In.hit('pause')) { pause(); return; }
    if (In.hit('skip')) ui.skipLine();
    if (g.controlsEnabled && !g.cinematic) {
      const l = In.look();
      g.camYaw -= l.dx; g.camPitch = U.clamp(g.camPitch + l.dy, -1.25, 1.4);
      const w = In.wheel(); if (w) { S.data.camDist = U.clamp(S.data.camDist + w * 0.8, 3.5, 14); }
    } else In.look();
    computeAim();
    P.update(dt);
    for (const a of g.actors) if (!a.removed) a.update(dt);
    if (g.actors.some((a) => a.removed)) g.actors = g.actors.filter((a) => !a.removed);
    for (const p of g.projectiles) if (p.alive) p.update(dt);
    if (g.projectiles.some((p) => !p.alive)) g.projectiles = g.projectiles.filter((p) => p.alive);
    for (const r of g.rings) { r.lookAt(camera.position.x, r.position.y, camera.position.z); r.rotation.z += dt; }
    // прохожие, ушедшие далеко, возвращаются поближе
    if (Math.floor(g.time) !== Math.floor(g.time - dt)) {
      for (const a of g.actors) {
        if (a.faction !== 'civ' || !a.alive || a.pickable || a.group || a.stay || a.mood) continue;
        if (a.pos.distanceTo(P.pos) > 210) {
          for (let k = 0; k < 6; k++) { const p = g.world.randomSidewalk(); const d = p.distanceTo(P.pos); if (d > 70 && d < 160) { a.place(p.x, 0, p.z); a.target = null; break; } }
        }
      }
    }
    g.world.update(dt, g.time, g.camOverride ? g.camOverride.pos : P.pos);
    g.fx.update(dt, camera);
    if (rain) updateRain(dt);
    if (deathT > 0) { deathT -= dt; if (deathT <= 0) g.fail('Даже боги падают. Хоумлендер повержен.'); }
    missionUpdate(dt);
  }

  // ================= главный цикл =================
  function frame(now) {
    requestAnimationFrame(frame);
    let rdt = Math.min(0.05, (now - last) / 1000); last = now;
    if (rdt <= 0) rdt = 0.001;
    if (g.state === 'menu' || g.state === 'loading') {
      HL.Menu.update(rdt); HL.Menu.render(renderer);
    } else if (scene) {
      let dt = rdt;
      if (g.hitStop > 0) { g.hitStop -= rdt; dt *= 0.2; }
      if (g.state === 'play') step(dt);
      else if (g.state === 'result' && g.player) { // мир живёт на фоне результатов
        for (const a of g.actors) if (!a.removed) a.update(dt * 0.5);
        g.fx.update(dt * 0.5, camera); g.player.update(dt * 0.5);
      }
      if (g.player) updateCamera(rdt);
      ui.update(g.state === 'play' ? dt : 0, rdt);
      renderer.render(scene, camera);
    }
    In.endFrame();
  }

  // ================= загрузка =================
  function boot() {
    const lb = $('lbar'), lt = $('ltxt');
    const stepL = (p, t) => { lb.style.width = p + '%'; lt.textContent = t; };
    stepL(15, 'Рендер…');
    In.init($('c'));
    makeRenderer();
    M.setOutlines(S.data.outlines);
    applyUiScale();
    stepL(45, 'Хоумлендер…');
    HL.Menu.build();
    sizeRenderer();
    stepL(80, 'Город…');
    requestAnimationFrame(frame);
    // прогреем шейдеры меню
    HL.Menu.update(0.016); HL.Menu.render(renderer);
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    fonts.then(() => {
      stepL(100, 'Готово');
      setTimeout(() => {
        $('loading').classList.add('hidden'); $('menu').classList.remove('hidden');
        g.state = 'menu'; refreshMenu(); applyControls();
        $('menuTap').classList.remove('hidden');
        const evs = ['pointerdown', 'touchend', 'click', 'keydown'];
        const unlockAudio = () => {
          A.unlock();
          if (g.state === 'menu') A.menuMusic();
          $('menuTap').classList.add('hidden');
          evs.forEach((e) => removeEventListener(e, unlockAudio, true));
        };
        evs.forEach((e) => addEventListener(e, unlockAudio, true));
      }, 250);
    });
  }
  // для отладки/тестов
  g._start = (i) => startMission(i === 'free' ? HL.Missions.FREE : HL.Missions.LIST[i], i === 'free' ? null : i);
  g._next = () => nextStep();
  g._m = () => mission;
  g._step = (n, dt = 0.05) => { for (let i = 0; i < n && g.state === 'play'; i++) { step(dt); ui.update(dt, dt); if (g.player) updateCamera(dt); camera.updateMatrixWorld(); } }; // отладка: прокрутка без рендера
  g._toMenu = () => toMenu();
  Object.defineProperty(g, 'mission', { get: () => mission });

  addEventListener('load', boot);
  return g;
})();
