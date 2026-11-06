'use strict';
// ============ Игровая логика ============
const G = window.G = {};
(function () {
  let renderer, scene, camera, selScene, selCam, selHero = null, selPedestal;
  let S = null;                       // сохраняемое состояние
  const B = [], byId = {};            // постройки
  const E = [];                       // враги
  const BD = [];                      // птицы
  const PR = [], PART = [], deadNodes = [];
  let P = null;                       // игрок
  let nextId = 1, birdSeq = 1;
  let build = null;                   // режим строительства
  let time = 0, menuBird = null;
  const lightPool = []; let lightT = 0;
  const cam = { yaw: 0.7, pitch: 0.88, dist: 12, pos: new THREE.Vector3() };
  const input = G.input = { mx: 0, mz: 0, run: false, action: false, camX: 0, camY: 0 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tv = V(0, 0, 0), tv2 = V(0, 0, 0);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  G.state = 'loading';
  G.paused = false;

  // ---------------- Инициализация ----------------
  G.init = function (canvas) {
    const q = G.settings.quality;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x8fd0f4, 60, 240);
    camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1000);
    World.build(scene, q);
    lightPool.length = 0;
    const NL = { low: 2, medium: 4, high: 6, ultra: 8 }[q] || 4;
    for (let i = 0; i < NL; i++) { const l = new THREE.PointLight(0xffb060, 0, 20, 1.2); l.castShadow = false; scene.add(l); lightPool.push(l); }
    menuBird = Models.makeBird('parrot'); menuBird.scale.setScalar(1.6); scene.add(menuBird);
    // сцена выбора героя
    selScene = new THREE.Scene(); selScene.background = new THREE.Color(0x1d3a24);
    selScene.fog = new THREE.Fog(0x1d3a24, 8, 22);
    selScene.add(new THREE.HemisphereLight(0xdff0ff, 0x2a3a1a, 0.8));
    const dl = new THREE.DirectionalLight(0xfff0d8, 1.3); dl.position.set(3, 6, 4); dl.castShadow = true; selScene.add(dl);
    selPedestal = new THREE.Group(); selScene.add(selPedestal);
    const ped = Models.cyl(1.4, 1.6, 0.4, 0x6a8a4a, 0, -0.2, 0, selScene, 16); ped.receiveShadow = true;
    Models.torus(1.45, 0.08, 0xd8b040, 0, 0, 0, selScene, 24).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const b = Models.makeBird(['sparrow', 'guinea', 'loon', 'turkey'][i]); const a = -0.9 + i * 0.6; b.position.set(Math.sin(a) * 3.2 + 1.2, 0, -2.6 + Math.abs(a) * 0.5); b.rotation.y = -a * 0.6; selScene.add(b); b.userData.ph = i; selScene.userData.birds = (selScene.userData.birds || []).concat(b); }
    selCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100); selCam.position.set(0, 1.6, 5.4); selCam.lookAt(0, 1.0, 0);
    G.resize();
  };
  G.resize = function () {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    const res = G.settings.resolution;
    let pr;
    if (res && res !== 'auto') pr = parseInt(res, 10) / h;
    else pr = Math.min(window.devicePixelRatio || 1, { low: 0.75, medium: 1, high: 1.5, ultra: 2 }[G.settings.quality] || 1);
    renderer.setPixelRatio(clamp(pr, 0.4, 3));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    selCam.aspect = w / h; selCam.updateProjectionMatrix();
    selCam.position.set(w < h ? 0 : -1.3, 1.5, w < h ? 7 : 5.2); selCam.lookAt(w < h ? 0 : -1.3, w < h ? 0.4 : 1.0, 0);
  };
  G.applyQuality = function () {
    const q = G.settings.quality;
    World.applyQuality(q);
    const far = { low: 150, medium: 220, high: 280, ultra: 340 }[q] || 220;
    scene.fog.far = far; scene.fog.near = far * 0.3; camera.far = far + 650; camera.updateProjectionMatrix();
    G.resize();
  };

  // ---------------- Состояние ----------------
  function newState(hero, diff) {
    const D = DIFFICULTY[diff] || DIFFICULTY.normal, st = D.start;
    return {
      v: 1, hero, diff: diff || 'normal', res: { wood: Math.round(30 * st), stone: 0, iron: 0, coal: 0, food: Math.round(10 * st), coins: Math.round(60 * st) },
      tools: { axe: 0, pick: -1 }, tech: { stone: false, metal: false, mech: false },
      wave: 1, waveTimer: Math.round(110 * D.timer), waveActive: false, dayTime: 0.02, day: 1, quest: 0,
      player: { x: 0, z: 6, hp: HEROES[hero].hp }, stats: { wood: 0, stone: 0, iron: 0, kills: 0, built: 0, boughtBirds: 0 },
    };
  }
  G.hero = () => S && HEROES[S.hero];
  const DF = () => DIFFICULTY[S && S.diff] || DIFFICULTY.normal;
  G.diff = DF;
  G.countB = t => B.filter(b => b.t === t).length;
  G.maxLevel = t => B.reduce((m, b) => b.t === t ? Math.max(m, b.lvl) : m, 0);
  G.cap = () => 150 + 150 * G.countB('storage');
  G.birdCap = () => 4 + B.reduce((s, b) => s + (BUILD[b.t].cap || 0), 0);
  G.S = () => S;
  G.birds = () => BD; G.buildings = () => B; G.enemies = () => E;

  function clearWorld() {
    B.slice().forEach(b => removeBuilding(b, true)); B.length = 0;
    E.forEach(e => scene.remove(e.mesh)); E.length = 0;
    BD.forEach(b => scene.remove(b.mesh)); BD.length = 0;
    PR.forEach(p => scene.remove(p.mesh)); PR.length = 0;
    PART.forEach(p => scene.remove(p.mesh)); PART.length = 0;
    deadNodes.length = 0;
    World.nodes.forEach(n => { n.alive = true; n.hp = n.maxHp; n.grow = 1; n.shake = 0; n.acc = 0; World.updateNodeMatrix(n); });
    if (P) scene.remove(P.mesh);
    if (build) G.cancelBuild();
    nextId = 1;
  }

  G.newGame = function (hero, diff) {
    clearWorld();
    S = newState(hero, diff);
    // стартовая база: кольцо из частокола, ворота, гнездо, скворечники, пушка
    addBuilding('core', 0, 0, 0);
    for (let i = -8; i <= 8; i += 4) {
      addBuilding('wall', i, -10, 2);
      if (i === 0) addBuilding('gate', 0, 10, 0); else addBuilding('wall', i, 10, 0);
      addBuilding('wall', 10, i, 1); addBuilding('wall', -10, i, 3);
    }
    addBuilding('birdhouse', -6, -6, 0); addBuilding('birdhouse', 6, -6, 0);
    addBuilding('lantern', -4, 5, 0); addBuilding('lantern', 4, 5, 0);
    const nw = B.find(b => b.t === 'wall' && b.x === 0 && b.z === -10);
    const c1 = addBuilding('cannon', nw.x, nw.z, nw.rot, 1, null, nw.id);
    const ew = B.find(b => b.t === 'wall' && b.x === 10 && b.z === 0);
    addBird('guinea', null, c1);
    addBird('sparrow'); addBird('loon'); addBird('tit');
    void ew;
    spawnPlayer();
    cam.yaw = 0.0; cam.pitch = 0.88;
    G.state = 'play';
    G.save();
  };

  function spawnPlayer() {
    const h = HEROES[S.hero];
    const mesh = Models.makeHero(S.hero); mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(mesh);
    P = { mesh, pos: V(S.player.x, 0, S.player.z), yaw: Math.PI, hp: S.player.hp, maxHp: h.hp, swing: 0, swingTarget: null, hitDone: false, atkCd: 0, dead: 0, lastHurt: -10, tool: null, toolTier: -2, moving: 0, hintT: 0, animT: 0 };
    P.pos.y = World.groundAt(P.pos.x, P.pos.z);
    setTool('axe');
  }
  function setTool(kind) {
    if (kind === 'pick' && S.tools.pick < 0) kind = 'axe';
    const tier = kind === 'axe' ? S.tools.axe : S.tools.pick;
    if (P.tool === kind && P.toolTier === tier) return;
    const hand = P.mesh.userData.parts.hand;
    while (hand.children.length) hand.remove(hand.children[0]);
    hand.add(Models.makeTool(kind, tier));
    P.tool = kind; P.toolTier = tier;
  }
  G.selectTool = k => { if (k === 'pick' && S.tools.pick < 0) { UI.toast('Кирки пока нет — сделайте её в мастерской', 'warn'); return; } setTool(k); };
  G.playerTool = () => P ? P.tool : 'axe';

  // ---------------- Постройки ----------------
  const PASS_PLAYER = { gate: 1, stonegate: 1, spikes: 1, farm: 1 };
  const PASS_ENEMY = { spikes: 1, farm: 1 };
  const WALLISH = { wall: 1, fence: 1, gate: 1, stonegate: 1 };
  function footprint(t, rot) { const s = BUILD[t].size; return rot % 2 ? [s[1], s[0]] : [s[0], s[1]]; }
  function maxHpOf(b) {
    if (b.t === 'wall') return WALL_LEVELS[b.lvl - 1].hp;
    if (b.t === 'cannon') return BUILD.cannon.hp + (b.lvl - 1) * 110;
    return BUILD[b.t].hp;
  }
  function baseY(t, x, z, rot) {
    const [w, d] = footprint(t, rot); let m = Infinity, M = -Infinity;
    [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([dx, dz]) => { const h = World.groundAt(x + dx, z + dz); m = Math.min(m, h); M = Math.max(M, h); });
    return { min: m, max: M };
  }
  function wallTopY(w) {
    const H = WALL_LEVELS[w.lvl - 1].h; return w.y + [H - 0.25, H - 0.2, H + 0.15, H, H][w.lvl - 1];
  }
  function addBuilding(t, x, z, rot, lvl = 1, hp = null, onWall = null, id = null) {
    const b = { id: id || nextId++, t, x, z, rot, lvl, onWall, cannonId: null, cd: Math.random(), yaw: rot * Math.PI / 2, gunner: null, prodT: 0, prod2: 0, prod3: 0, hitT: 0, spin: 0 };
    if (id && id >= nextId) nextId = id + 1;
    b.maxHp = maxHpOf(b); b.hp = hp == null ? b.maxHp : Math.min(hp, b.maxHp);
    b.y = baseY(t, x, z, rot).min;
    const [w, d] = footprint(t, rot); b.minx = x - w / 2; b.maxx = x + w / 2; b.minz = z - d / 2; b.maxz = z + d / 2;
    B.push(b); byId[b.id] = b;
    if (onWall && byId[onWall]) byId[onWall].cannonId = b.id;
    buildMesh(b);
    return b;
  }
  function buildMesh(b) {
    if (b.mesh) scene.remove(b.mesh);
    let m;
    if (b.t === 'cannon') {
      m = Models.makeCannon(b.lvl, !!b.onWall);
      if (b.onWall) Models.box(2, 0.18, 2, 0x8a5a2a, 0, -0.05, 0, m);
    } else m = Models.makeBuilding(b.t, b.lvl);
    let y = b.y;
    if (b.onWall) { const w = byId[b.onWall]; y = wallTopY(w); b.x = w.x; b.z = w.z; }
    m.position.set(b.x, y, b.z); m.rotation.y = b.rot * Math.PI / 2;
    scene.add(m); b.mesh = m;
    if (m.userData.turret) m.userData.turret.rotation.y = b.yaw - m.rotation.y;
  }
  function removeBuilding(b, silent) {
    scene.remove(b.mesh);
    const i = B.indexOf(b); if (i >= 0) B.splice(i, 1);
    delete byId[b.id];
    if (b.cannonId && byId[b.cannonId]) removeBuilding(byId[b.cannonId], silent);
    if (b.onWall && byId[b.onWall]) byId[b.onWall].cannonId = null;
    if (b.gunner) { const bird = b.gunner; bird.cannon = null; b.gunner = null; if (!silent) { bird.state = 'walk'; bird.dest = null; flyTo(bird, randomGroundPoint(), 'walk'); } }
    BD.forEach(bd => { if (bd.perchB === b) { bd.perchB = null; if (bd.state === 'perch') { bd.state = 'walk'; bd.dest = null; } } });
  }
  function destroyBuilding(b) {
    const c = b.t === 'wall' && b.lvl >= 3 ? 0x8a8a86 : 0xa8743e;
    spawnParticles(V(b.x, b.mesh.position.y + 1.2, b.z), c, 26, 6, 0.35, 1.4);
    spawnParticles(V(b.x, b.mesh.position.y + 0.5, b.z), 0xbfae90, 12, 2.5, 0.6, 1.2);
    Sound.play('crumble');
    UI.toast(`${BUILD[b.t].name} разрушен${b.t === 'wall' ? 'а' : ''}!`, 'bad');
    if (b.t === 'core') { removeBuilding(b); gameOver(); return; }
    removeBuilding(b);
  }
  function damageBuilding(b, dmg) {
    b.hp -= dmg; b.hitT = 0.18;
    if (Math.random() < 0.5) spawnParticles(V(b.x + rand(-1, 1), b.mesh.position.y + rand(0.5, 2), b.z + rand(-1, 1)), b.t === 'wall' && b.lvl >= 3 ? 0x9a9a96 : 0xb8844e, 3, 3, 0.18, 0.6);
    if (b.hp <= 0) destroyBuilding(b);
  }
  G.buildingLabel = b => {
    if (b.t === 'wall') return `${WALL_LEVELS[b.lvl - 1].name} (ур. ${b.lvl})`;
    if (b.t === 'cannon') return `${CANNON_LEVELS[b.lvl - 1].name} (ур. ${b.lvl})`;
    return BUILD[b.t].name;
  };

  // ---------------- Ресурсы ----------------
  const costMul = () => HEROES[S.hero].buildMul;
  G.scaleCost = function (cost) { const o = {}; for (const k in cost) o[k] = k === 'coins' ? cost[k] : Math.ceil(cost[k] * costMul()); return o; };
  G.canAfford = cost => { for (const k in cost) if ((S.res[k] || 0) < cost[k]) return false; return true; };
  G.missing = cost => Object.keys(cost).filter(k => (S.res[k] || 0) < cost[k]).map(k => `${RES_INFO[k].icon}${cost[k] - (S.res[k] || 0)}`).join(' ');
  function pay(cost) { for (const k in cost) S.res[k] -= cost[k]; }
  function tryPay(cost) {
    if (!G.canAfford(cost)) { UI.toast('Не хватает ресурсов: ' + G.missing(cost), 'warn'); Sound.play('error'); return false; }
    pay(cost); return true;
  }
  function addRes(k, n, at) {
    if (n <= 0) return;
    const cap = k === 'coins' ? Infinity : G.cap();
    const before = S.res[k];
    S.res[k] = Math.min(cap, S.res[k] + n);
    const got = S.res[k] - before;
    if (got <= 0) { if (at) UI.floatText(at, 'Склад полон!', '#ff8a6a'); return; }
    if (S.stats[k] !== undefined) S.stats[k] += got;
    if (at) UI.floatText(at, `+${Math.round(got * 10) / 10 === Math.round(got) ? Math.round(got) : got.toFixed(1)} ${RES_INFO[k].icon}`, k === 'coins' ? '#ffe066' : '#ffffff');
  }
  G.addRes = addRes;

  // ---------------- Птицы ----------------
  function randomGroundPoint() {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(3.6, 8.5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!B.some(b => !b.onWall && b.t !== 'farm' && x > b.minx - 0.3 && x < b.maxx + 0.3 && z > b.minz - 0.3 && z < b.maxz + 0.3)) return V(x, World.groundAt(x, z), z);
    }
    return V(rand(-3, 3), 0, 6);
  }
  function addBird(sp, hp, cannon) {
    const mesh = Models.makeBird(sp); scene.add(mesh);
    const p = randomGroundPoint();
    const b = { id: birdSeq++, sp, mesh, pos: p.clone(), yaw: Math.random() * 6, state: 'walk', dest: null, timer: rand(1, 4), hp: hp == null ? BIRDS[sp].hp : hp, maxHp: BIRDS[sp].hp, cannon: null, hidden: false, ph: Math.random() * 10, fly: null, perchB: null, flap: 0, alarm: false };
    mesh.position.copy(p);
    BD.push(b);
    if (cannon) assignBird(b, cannon);
    return b;
  }
  function assignBird(bird, c) {
    if (c.gunner) c.gunner.cannon = null;
    if (bird.cannon) bird.cannon.gunner = null;
    bird.cannon = c; c.gunner = bird; bird.hidden = false; bird.mesh.visible = true; bird.state = 'gunner'; bird.perchB = null;
  }
  G.assignBird = (bird, c) => { assignBird(bird, c); Sound.play('chirp'); UI.toast(`${BIRDS[bird.sp].name} садится за пушку!`, 'good'); };
  G.unassignBird = bird => { if (bird.cannon) { bird.cannon.gunner = null; bird.cannon = null; } bird.state = 'walk'; flyTo(bird, randomGroundPoint(), 'walk'); };
  G.freeCannons = () => B.filter(b => b.t === 'cannon' && !b.gunner);
  function autoAssign() {
    const free = BD.filter(b => !b.cannon);
    G.freeCannons().forEach(c => { const bird = free.shift(); if (bird) G.assignBird(bird, c); });
  }
  G.buyBird = function (sp) {
    const d = BIRDS[sp];
    if (d.market && G.countB('market') === 0) { UI.toast('Нужен «Птичий рынок» для этой птицы', 'warn'); Sound.play('error'); return false; }
    if (BD.length >= G.birdCap()) { UI.toast('Нет мест! Постройте скворечник или птичник', 'warn'); Sound.play('error'); return false; }
    if (!tryPay({ coins: d.price, food: d.food })) return false;
    const b = addBird(sp); S.stats.boughtBirds++;
    Sound.play('coin'); Sound.play('chirp');
    UI.toast(`Куплен(а): ${d.name}!`, 'good');
    const c = G.freeCannons()[0]; if (c) G.assignBird(b, c);
    return true;
  };
  G.releaseBird = function (bird) {
    if (bird.cannon) { bird.cannon.gunner = null; }
    scene.remove(bird.mesh); BD.splice(BD.indexOf(bird), 1);
    addRes('coins', Math.floor(BIRDS[bird.sp].price * 0.4)); Sound.play('chirp');
  };
  function flyTo(b, dest, next, perchB) {
    const from = b.mesh.position.clone();
    const dist = from.distanceTo(dest);
    b.fly = { from, to: dest.clone(), u: 0, dur: Math.max(0.6, dist / 7), arc: Math.min(6, 1 + dist * 0.25), next };
    b.state = 'fly'; b.perchB = perchB || null; b.hidden = false; b.mesh.visible = true;
  }
  function perchSpots() {
    const spots = [];
    B.forEach(b => {
      if (b.t === 'wall' && !b.cannonId) {
        const y = wallTopY(b), a = b.rot * Math.PI / 2, ax = Math.cos(a), az = -Math.sin(a);
        [-1.3, 1.3].forEach(o => spots.push({ p: V(b.x + ax * o, y + (b.lvl <= 2 ? 0.25 : 0), b.z + az * o), b, yaw: a + Math.PI }));
      } else if (b.mesh.userData.perch) b.mesh.userData.perch.forEach(pp => spots.push({ p: b.mesh.localToWorld(pp.clone()), b, yaw: Math.random() * 6 }));
      else if (b.t === 'tower') spots.push({ p: V(b.x + 0.9, b.y + 3.7, b.z + 0.9), b, yaw: 0 });
      else if (b.t === 'cannon' && !b.onWall) spots.push({ p: V(b.x + 0.95, b.y + 2.6, b.z - 0.95), b, yaw: 0 });
    });
    return spots.filter(s => !BD.some(o => o.perchB === s.b && o.perchP && o.perchP.distanceTo(s.p) < 0.6));
  }
  function shelters() { return B.filter(b => b.t === 'birdhouse' || b.t === 'aviary' || b.t === 'core'); }
  let dangerPrev = false;
  function updateBirds(dt) {
    const danger = E.some(e => !e.dying && e.pos.length() < 34);
    if (danger && !dangerPrev) { Sound.play('chirp'); if (BD.some(b => !b.cannon)) UI.toast('Птицы прячутся от врагов!', 'warn'); }
    dangerPrev = danger;
    const night = World.daylight < 0.12 && !S.waveActive;
    for (const b of BD) {
      const m = b.mesh; b.ph += dt;
      if (b.flap > 0) b.flap -= dt;
      if (b.cannon) {
        const tur = b.cannon.mesh.userData.turret;
        if (b.state === 'fly' && b.fly) { flyStep(b, dt, tur.localToWorld(V(0, 0.28, -0.9))); continue; }
        if (b.state !== 'gunner') { flyTo(b, tur.localToWorld(V(0, 0.28, -0.9)), 'gunner'); continue; }
        tur.localToWorld(tv.set(0, 0.28, -0.9)); m.position.copy(tv);
        m.rotation.y = b.cannon.yaw;
        Models.animBird(m, b.flap > 0 ? 'fly' : 'idle', b.ph);
        continue;
      }
      if (b.state === 'fly') { flyStep(b, dt); continue; }
      if (b.hidden) {
        if (!danger && !night) {
          const sh = b.shelter && byId[b.shelter.id] ? b.shelter : shelters()[0];
          if (sh) m.position.copy(sh.mesh.localToWorld((sh.mesh.userData.perch || [V(0, 2, 0)])[0].clone()));
          b.hidden = false; m.visible = true; flyTo(b, randomGroundPoint(), 'walk');
        }
        continue;
      }
      if (danger || night) {
        const shs = shelters(); if (!shs.length) continue;
        let best = shs[0], bd = Infinity; shs.forEach(s => { const d = Math.hypot(s.x - m.position.x, s.z - m.position.z); if (d < bd) { bd = d; best = s; } });
        b.shelter = best;
        flyTo(b, best.mesh.localToWorld((best.mesh.userData.perch || [V(0, 2, 0)])[0].clone()), 'enter');
        continue;
      }
      b.timer -= dt;
      if (b.state === 'perch') {
        if (!b.perchB || !byId[b.perchB.id]) { b.state = 'walk'; b.dest = null; m.position.y = World.groundAt(m.position.x, m.position.z); continue; }
        Models.animBird(m, 'idle', b.ph);
        if (b.timer <= 0) { b.perchB = null; b.perchP = null; flyTo(b, randomGroundPoint(), 'walk'); }
        continue;
      }
      // по земле
      if (b.state === 'peck') { Models.animBird(m, 'peck', b.ph); if (b.timer <= 0) { b.state = 'walk'; b.dest = null; } continue; }
      if (!b.dest) { b.dest = randomGroundPoint(); b.timer = rand(3, 7); }
      const dx = b.dest.x - m.position.x, dz = b.dest.z - m.position.z, d = Math.hypot(dx, dz);
      if (d < 0.3 || b.timer <= 0) {
        b.dest = null;
        const r = Math.random();
        if (r < 0.35) { const sp = perchSpots(); if (sp.length) { const s = sp[Math.floor(Math.random() * sp.length)]; flyTo(b, s.p, 'perch', s.b); b.perchP = s.p; b.perchYaw = s.yaw; continue; } }
        if (r < 0.7) { b.state = 'peck'; b.timer = rand(1.5, 4); }
        continue;
      }
      const sp = 1.4 * BIRDS[b.sp].size;
      m.position.x += dx / d * sp * dt; m.position.z += dz / d * sp * dt;
      m.position.y = World.groundAt(m.position.x, m.position.z);
      m.rotation.y = Math.atan2(dx, dz);
      Models.animBird(m, 'walk', b.ph);
    }
    // птицы на земле могут пострадать — проверяется в логике врагов
  }
  function flyStep(b, dt, liveTarget) {
    const f = b.fly, m = b.mesh;
    if (liveTarget) f.to.copy(liveTarget);
    f.u = Math.min(1, f.u + dt / f.dur);
    const u = f.u, e = u * u * (3 - 2 * u);
    const x = f.from.x + (f.to.x - f.from.x) * e, z = f.from.z + (f.to.z - f.from.z) * e;
    const y = f.from.y + (f.to.y - f.from.y) * e + Math.sin(u * Math.PI) * f.arc;
    const dx = x - m.position.x, dz = z - m.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) m.rotation.y = Math.atan2(dx, dz);
    m.position.set(x, y, z);
    Models.animBird(m, 'fly', b.ph);
    if (u >= 1) {
      b.fly = null;
      if (f.next === 'enter') { b.hidden = true; m.visible = false; b.state = 'hidden'; }
      else if (f.next === 'perch') { b.state = 'perch'; b.timer = rand(6, 16); m.rotation.y = b.perchYaw || 0; }
      else if (f.next === 'gunner') b.state = 'gunner';
      else { b.state = 'walk'; b.dest = null; }
    }
  }
  function hurtBird(b, dmg) {
    b.hp -= dmg;
    spawnParticles(b.mesh.position.clone().add(V(0, 0.5, 0)), 0xffffff, 5, 2.5, 0.12, 0.8);
    if (b.hp <= 0) {
      UI.toast(`Погибла птица: ${BIRDS[b.sp].name}!`, 'bad');
      spawnParticles(b.mesh.position.clone().add(V(0, 0.5, 0)), 0xeeeeee, 14, 3, 0.15, 1.5);
      if (b.cannon) b.cannon.gunner = null;
      scene.remove(b.mesh); BD.splice(BD.indexOf(b), 1);
    } else if (b.state !== 'fly' && !b.cannon) {
      const sh = shelters()[0]; if (sh) { b.shelter = sh; flyTo(b, sh.mesh.localToWorld((sh.mesh.userData.perch || [V(0, 2, 0)])[0].clone()), 'enter'); }
    }
  }

  // ---------------- Враги и волны ----------------
  function waveList(n) {
    const types = Object.keys(ENEMIES).filter(t => t !== 'monster' && ENEMIES[t].wave <= n);
    const count = Math.max(1, Math.round((2 + Math.floor(n * 1.7)) * DF().count));
    const list = [];
    for (let i = 0; i < count; i++) list.push(types[Math.floor(Math.random() * types.length)]);
    if (n % 5 === 0) for (let i = 0; i < n / 5; i++) list.push('monster');
    return list;
  }
  function startWave() {
    S.waveActive = true; S.spawnList = waveList(S.wave); S.spawnCd = 0; S.waveDir = Math.random() * Math.PI * 2;
    Sound.play('horn'); Sound.setMode('battle');
    UI.toast(`🐺 Волна ${S.wave}! Звери нападают!`, 'bad', 3500);
    UI.banner(`ВОЛНА ${S.wave}`);
  }
  G.startWaveNow = function () { if (S && !S.waveActive) { S.waveTimer = 0; S.earlyBonus = true; } };
  function spawnEnemy(type, pos) {
    const d = ENEMIES[type], n = S.wave;
    const mesh = Models.makeEnemy(type); scene.add(mesh);
    const hpMul = (1 + (n - 1) * 0.14) * DF().hp;
    const e = { type, d, mesh, pos: pos.clone(), vel: V(0, 0, 0), yaw: 0, hp: d.hp * hpMul, maxHp: d.hp * hpMul, dmg: d.dmg * (1 + (n - 1) * 0.06) * DF().dmg, atkCd: 0, target: null, tkind: null, retarget: 0, slow: 0, dying: 0, mode: 'walk', t: Math.random() * 10, hitT: 0, flee: false, stuck: 0 };
    mesh.position.copy(pos);
    E.push(e);
    if (type === 'monster') { UI.toast('⚠️ Появилось Лесное чудище!', 'bad', 4000); Sound.play('growl', 1.6); }
    return e;
  }
  function updateWaves(dt) {
    if (!S.waveActive) {
      S.waveTimer -= dt;
      if (S.waveTimer <= 0) startWave();
      return;
    }
    if (S.spawnList.length) {
      S.spawnCd -= dt;
      if (S.spawnCd <= 0) {
        const type = S.spawnList.shift();
        const dir = S.waveDir + (S.wave >= 4 && S.spawnList.length % 2 ? Math.PI * 0.7 : 0) + rand(-0.5, 0.5);
        let x = Math.cos(dir) * 78, z = Math.sin(dir) * 78;
        spawnEnemy(type, V(x, World.groundAt(x, z), z));
        S.spawnCd = Math.max(0.35, 1.2 - S.wave * 0.05);
      }
    } else if (!E.some(e => !e.dying && !e.flee)) {
      S.waveActive = false;
      const bonus = Math.round((15 + S.wave * 6) * (S.earlyBonus ? 1.25 : 1) * DF().reward);
      addRes('coins', bonus);
      UI.toast(`✅ Волна ${S.wave} отбита! +${bonus} 🪙`, 'good', 3500);
      Sound.play('win'); Sound.setMode('calm');
      S.wave++; S.earlyBonus = false;
      S.waveTimer = Math.max(60, 120 - S.wave * 3) * DF().timer;
      G.save();
    }
  }
  function pickTarget(e) {
    const core = B.find(b => b.t === 'core');
    const t = e.type; const ep = e.pos;
    const near = (list, r, f) => { let best = null, bd = r; list.forEach(o => { if (f && !f(o)) return; const p = o.mesh.position; const d = Math.hypot(p.x - ep.x, p.z - ep.z); if (d < bd) { bd = d; best = o; } }); return best; };
    const groundBird = b => !b.hidden && !b.cannon && b.state !== 'perch' && b.mesh.position.y - World.groundAt(b.mesh.position.x, b.mesh.position.z) < 1;
    const playerNear = P && !P.dead && Math.hypot(P.pos.x - ep.x, P.pos.z - ep.z);
    if (t === 'monster') return ['b', core];
    if (t === 'bear' || t === 'boar') { const b = near(B.filter(x => !x.onWall), 60); if (playerNear && playerNear < 6) return ['p', P]; return b ? ['b', b] : ['b', core]; }
    if (t === 'fox' || t === 'lynx') { const bd = near(BD, 45, groundBird); if (bd) return ['bird', bd]; if (playerNear && playerNear < 10) return ['p', P]; return ['b', core]; }
    if (playerNear && playerNear < 14) return ['p', P];
    const bd = near(BD, 30, groundBird); if (bd) return ['bird', bd];
    return ['b', core];
  }
  function collideBuildings(pos, r, enemy) {
    let hit = null;
    for (const b of B) {
      if (b.onWall) continue;
      if (enemy ? PASS_ENEMY[b.t] : PASS_PLAYER[b.t]) continue;
      if (pos.x < b.minx - r || pos.x > b.maxx + r || pos.z < b.minz - r || pos.z > b.maxz + r) continue;
      const cx = clamp(pos.x, b.minx, b.maxx), cz = clamp(pos.z, b.minz, b.maxz);
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        const l = pos.x - b.minx, rr = b.maxx - pos.x, t = pos.z - b.minz, bt = b.maxz - pos.z, m = Math.min(l, rr, t, bt);
        if (m === l) pos.x = b.minx - r; else if (m === rr) pos.x = b.maxx + r; else if (m === t) pos.z = b.minz - r; else pos.z = b.maxz + r;
      } else { const d = Math.sqrt(d2); pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
      hit = b;
    }
    return hit;
  }
  function updateEnemies(dt) {
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i], m = e.mesh;
      e.t += dt;
      if (e.dying > 0) {
        e.dying -= dt;
        m.rotation.z = Math.min(Math.PI / 2, m.rotation.z + dt * 5);
        if (e.dying < 0.8) m.position.y -= dt * 1.2;
        if (e.dying <= 0) { scene.remove(m); E.splice(i, 1); }
        continue;
      }
      if (e.hitT > 0) { e.hitT -= dt; m.scale.setScalar((e.type === 'monster' ? 1.1 : 1) * (1 + e.hitT)); }
      if (e.slow > 0) e.slow -= dt;
      e.atkCd -= dt;
      // бегство (лиса при малом здоровье)
      if (!e.flee && e.type === 'fox' && e.hp < e.maxHp * 0.3) { e.flee = true; UI.floatText(e.pos.clone().add(V(0, 1.5, 0)), 'Убегает!', '#ffd080'); }
      let tx, tz, reach = 0;
      if (e.flee) {
        const l = e.pos.length() || 1; tx = e.pos.x / l * 120; tz = e.pos.z / l * 120;
        if (l > 95) { scene.remove(m); E.splice(i, 1); continue; }
      } else {
        e.retarget -= dt;
        const tgtGone = !e.target || (e.tkind === 'b' && !byId[e.target.id]) || (e.tkind === 'bird' && (BD.indexOf(e.target) < 0 || e.target.hidden || e.target.state === 'perch')) || (e.tkind === 'p' && P.dead);
        if (e.retarget <= 0 || tgtGone) { const r = pickTarget(e); e.tkind = r[0]; e.target = r[1]; e.retarget = 0.8 + Math.random() * 0.4; }
        if (!e.target) continue;
        if (e.tkind === 'p') { tx = P.pos.x; tz = P.pos.z; reach = e.d.radius + 0.7; }
        else if (e.tkind === 'bird') { tx = e.target.mesh.position.x; tz = e.target.mesh.position.z; reach = e.d.radius + 0.5; }
        else { const b = e.target; tx = clamp(e.pos.x, b.minx, b.maxx); tz = clamp(e.pos.z, b.minz, b.maxz); reach = e.d.radius + 0.25; }
      }
      const dx = tx - e.pos.x, dz = tz - e.pos.z, dist = Math.hypot(dx, dz);
      let attackB = null;
      if (!e.flee && dist <= reach) {
        e.mode = 'attack';
        if (e.tkind === 'b') attackB = e.target;
        else if (e.atkCd <= 0) {
          e.atkCd = 1 / e.d.rate;
          if (e.tkind === 'p') hurtPlayer(e.dmg);
          else hurtBird(e.target, e.dmg);
          Sound.play('growl', 0.6);
        }
      } else {
        e.mode = 'walk';
        const spd = e.d.speed * (e.slow > 0 ? 0.5 : 1) * (World.inWater(e.pos.x, e.pos.z) ? 0.6 : 1) * (e.flee ? 1.3 : 1);
        const nx = e.pos.x + dx / dist * spd * dt, nz = e.pos.z + dz / dist * spd * dt;
        tv.set(nx, 0, nz);
        // разведение с соседями
        for (const o of E) { if (o === e || o.dying) continue; const ox = tv.x - o.pos.x, oz = tv.z - o.pos.z, od = Math.hypot(ox, oz), rr = e.d.radius + o.d.radius; if (od < rr && od > 0.001) { tv.x += ox / od * (rr - od) * 0.5; tv.z += oz / od * (rr - od) * 0.5; } }
        const hit = collideBuildings(tv, e.d.radius, true);
        e.pos.x = tv.x; e.pos.z = tv.z;
        if (hit && !e.flee) { attackB = hit; e.mode = 'attack'; }
        e.yaw = Math.atan2(dx, dz);
      }
      if (attackB) {
        e.yaw = Math.atan2(attackB.x - e.pos.x, attackB.z - e.pos.z);
        if (e.atkCd <= 0) { e.atkCd = 1 / e.d.rate; damageBuilding(attackB, e.dmg); Sound.play('hit', 0.5); }
      }
      // шипы
      for (const b of B) if (b.t === 'spikes' && e.pos.x > b.minx && e.pos.x < b.maxx && e.pos.z > b.minz && e.pos.z < b.maxz) { hurtEnemy(e, 14 * dt, true); b.hp -= 2 * dt; if (b.hp <= 0) { destroyBuilding(b); break; } }
      e.pos.y = Math.max(World.groundAt(e.pos.x, e.pos.z), World.WATER_Y - 0.6);
      m.position.copy(e.pos);
      let dy = e.yaw - m.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      m.rotation.y += dy * Math.min(1, dt * 8);
      Models.animEnemy(m, e.mode, e.t, e.d.speed);
    }
  }
  function hurtEnemy(e, dmg, quiet) {
    if (e.dying > 0) return;
    e.hp -= dmg; if (!quiet) e.hitT = 0.15;
    if (e.hp <= 0) {
      e.dying = 1.6; e.mesh.scale.setScalar(e.type === 'monster' ? 1.1 : 1);
      const c = Math.max(1, Math.round(e.d.coins * HEROES[S.hero].coinMul * (1 + S.wave * 0.03) * DF().reward));
      addRes('coins', c, e.pos.clone().add(V(0, 1.6, 0)));
      if (e.d.food) addRes('food', e.d.food, e.pos.clone().add(V(0, 2.3, 0)));
      S.stats.kills++;
      Sound.play('coin'); Sound.play('growl', 0.8);
      spawnParticles(e.pos.clone().add(V(0, 0.6, 0)), 0xffe066, 8, 3, 0.15, 0.9);
    }
  }

  // ---------------- Пушки и снаряды ----------------
  const projGeo = { ball: new THREE.SphereGeometry(0.2, 8, 6), arrow: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), bolt: new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5) };
  const projMat = { ball: Models.mat(0x1a1a1a, { metalness: 0.5 }), slow: Models.mat(0x80d0ff, { emissive: 0x3080ff, emissiveIntensity: 0.8 }), arrow: Models.mat(0x6a4a2a), bolt: Models.mat(0xd8b040, { metalness: 0.6 }) };
  function nearestEnemy(x, z, range) {
    let best = null, bd = range;
    for (const e of E) { if (e.dying || e.flee) continue; const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function fire(from, e, o) {
    const kind = o.kind;
    const mesh = new THREE.Mesh(projGeo[kind], o.slow ? projMat.slow : projMat[kind]); mesh.castShadow = false;
    scene.add(mesh);
    const speed = kind === 'ball' ? 22 : 40;
    const to = e.pos.clone(); const dist = from.distanceTo(to); const tFlight = dist / speed;
    to.x += Math.sin(e.yaw) * e.d.speed * tFlight * (e.mode === 'walk' ? 0.8 : 0); to.z += Math.cos(e.yaw) * e.d.speed * tFlight * (e.mode === 'walk' ? 0.8 : 0);
    to.y += 0.5;
    PR.push({ mesh, from: from.clone(), to, u: 0, dur: Math.max(0.1, tFlight), arc: kind === 'ball' ? dist * 0.12 : dist * 0.03, target: e, ...o });
    mesh.position.copy(from);
  }
  function updateDefense(dt) {
    const hero = HEROES[S.hero];
    const night = World.daylight < 0.25;
    for (const b of B) {
      if (b.hitT > 0) b.hitT -= dt;
      const isCannon = b.t === 'cannon', isTower = b.t === 'tower' || b.t === 'stonetower' || b.t === 'ballista';
      if (!isCannon && !isTower) continue;
      const tur = b.mesh.userData.turret; if (!tur) continue;
      let dmg, rate, range, splash = 0, kind;
      let bird = null;
      if (isCannon) {
        const L = CANNON_LEVELS[b.lvl - 1]; bird = b.gunner;
        if (bird && bird.state !== 'gunner') bird = null;
        if (!bird && b.lvl < 4) continue; // без птицы стреляют только автоматические пушки
        const bs = bird ? BIRDS[bird.sp] : { dmg: 1, rate: 0.6, range: 1 };
        dmg = L.dmg * bs.dmg * (S.hero === 'defender' ? 1.15 : 1) * (bird && bs.special === 'night' && night ? 1.7 : 1);
        rate = L.rate * bs.rate; range = L.range * bs.range; splash = L.splash * (bird && bs.special === 'splash' ? 1.5 : 1); kind = 'ball';
      } else { const D = BUILD[b.t]; dmg = D.dmg; rate = D.rate; range = D.range; kind = b.t === 'ballista' ? 'bolt' : 'arrow'; }
      const mp = b.mesh.position; const e = nearestEnemy(mp.x, mp.z, range);
      if (b.mesh.userData.spin && isCannon) b.mesh.userData.spin.rotation.z += dt * (e ? 14 : 1);
      if (!e) continue;
      const want = Math.atan2(e.pos.x - mp.x, e.pos.z - mp.z);
      let dy = want - b.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      b.yaw += clamp(dy, -dt * 5, dt * 5);
      tur.rotation.y = b.yaw - b.mesh.rotation.y;
      b.cd -= dt;
      if (b.cd <= 0 && Math.abs(dy) < 0.25) {
        b.cd = 1 / rate;
        const muzzle = isCannon ? tur.localToWorld(V(0, 0.75, 1.3)) : b.mesh.localToWorld(b.mesh.userData.muzzle.clone().setY(b.mesh.userData.muzzle.y));
        if (!isCannon) { tur.localToWorld(tv2.set(0, 0, 0.7)); muzzle.copy(tv2); }
        const bs = bird ? BIRDS[bird.sp] : {};
        let fd = dmg, crit = false;
        if (bs.special === 'crit' && Math.random() < 0.25) { fd *= 2.5; crit = true; }
        fire(muzzle, e, { kind, dmg: fd, splash, slow: bs.special === 'slow', crit });
        if (bs.special === 'double') setTimeout(() => { if (!e.dying && G.state === 'play') fire(muzzle, e, { kind, dmg: fd * 0.8, splash, crit: false }); }, 140);
        if (isCannon) {
          Sound.play('boom', 0.6);
          spawnParticles(muzzle, 0xdddddd, 5, 2, 0.3, 0.6, -0.5);
          spawnParticles(muzzle, 0xffa030, 3, 3, 0.18, 0.25, 0);
          if (bird) bird.flap = 0.35;
        } else Sound.play('arrow');
      }
    }
    // снаряды
    for (let i = PR.length - 1; i >= 0; i--) {
      const p = PR[i];
      p.u += dt / p.dur;
      const u = Math.min(1, p.u);
      const prev = p.mesh.position.clone();
      p.mesh.position.lerpVectors(p.from, p.to, u); p.mesh.position.y += Math.sin(u * Math.PI) * p.arc;
      if (p.kind !== 'ball') { tv.subVectors(p.mesh.position, prev).normalize(); p.mesh.quaternion.setFromUnitVectors(V(0, 1, 0), tv); }
      if (u >= 1) {
        scene.remove(p.mesh); PR.splice(i, 1);
        if (p.splash > 0) {
          for (const e of E) { if (e.dying) continue; if (Math.hypot(e.pos.x - p.to.x, e.pos.z - p.to.z) < p.splash + e.d.radius) { hurtEnemy(e, p.dmg); if (p.slow) e.slow = 2.5; } }
          spawnParticles(p.to, p.slow ? 0x9adfff : 0xffa040, 8, 4, 0.22, 0.45);
          spawnParticles(p.to, 0x8a7a6a, 6, 2.5, 0.3, 0.8);
          Sound.play('boom', 0.35);
        } else {
          const e = p.target && !p.target.dying && p.target.pos.distanceTo(p.to) < 2.5 ? p.target : nearestEnemy(p.to.x, p.to.z, 1.6);
          if (e) hurtEnemy(e, p.dmg);
        }
        if (p.crit) UI.floatText(p.to.clone().add(V(0, 1.5, 0)), 'КРИТ!', '#ff5050');
      }
    }
  }

  // ---------------- Частицы ----------------
  const partGeo = new THREE.BoxGeometry(1, 1, 1);
  function spawnParticles(pos, color, n, speed, size, life, grav = 1) {
    if (PART.length > 260) return;
    const mt = Models.mat(color);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(partGeo, mt); m.position.copy(pos); m.scale.setScalar(size * rand(0.6, 1.2));
      m.rotation.set(rand(0, 6), rand(0, 6), 0);
      scene.add(m);
      PART.push({ mesh: m, v: V(rand(-1, 1) * speed, rand(0.4, 1.2) * speed, rand(-1, 1) * speed), life, max: life, grav, s: m.scale.x });
    }
  }
  function updateParticles(dt) {
    for (let i = PART.length - 1; i >= 0; i--) {
      const p = PART[i]; p.life -= dt;
      if (p.life <= 0) { scene.remove(p.mesh); PART.splice(i, 1); continue; }
      p.v.y -= 12 * p.grav * dt; p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += dt * 5; p.mesh.scale.setScalar(p.s * (p.life / p.max));
    }
  }
  G.spawnParticles = spawnParticles;

  // ---------------- Игрок ----------------
  function hurtPlayer(dmg) {
    if (P.dead) return;
    P.hp -= dmg; P.lastHurt = time;
    Sound.play('hurt'); UI.flash();
    if (P.hp <= 0) {
      P.hp = 0; P.dead = 5; P.mesh.rotation.x = -Math.PI / 2;
      UI.toast('Вы ранены! Возвращение на базу через 5 сек…', 'bad', 4500);
    }
  }
  function nodeOK(n) {
    const info = NODE_INFO[n.kind];
    if (info.tool === 'pick' && S.tools.pick < info.minPick) {
      if (time - P.hintT > 3) { P.hintT = time; UI.toast(S.tools.pick < 0 ? 'Нужна кирка! Постройте мастерскую и сделайте её.' : 'Для железа нужна улучшенная кирка', 'warn'); }
      return false;
    }
    return true;
  }
  const nearTmp = [];
  function findActTarget() {
    let best = null, bd = Infinity;
    for (const e of E) { if (e.dying) continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) - e.d.radius; if (d < 1.6 && d < bd) { bd = d; best = { e }; } }
    if (best) return best;
    for (const n of World.nodesNear(P.pos.x, P.pos.z, 4, nearTmp)) {
      if (!n.alive || n.grow < 1) continue;
      const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z) - n.r;
      if (d < 1.25 && d < bd) { bd = d; best = { n }; }
    }
    return best;
  }
  function playerAct() {
    if (P.swing > 0 || P.atkCd > 0 || P.dead) return;
    const t = findActTarget(); if (!t) return;
    if (t.n && !nodeOK(t.n)) return;
    if (t.n) setTool(NODE_INFO[t.n.kind].tool === 'pick' ? 'pick' : 'axe'); else setTool('axe');
    P.swing = 0.0001; P.swingTarget = t; P.hitDone = false;
    const tx = t.e ? t.e.pos.x : t.n.x, tz = t.e ? t.e.pos.z : t.n.z;
    P.yaw = Math.atan2(tx - P.pos.x, tz - P.pos.z);
  }
  function applyHit(t) {
    const hero = HEROES[S.hero];
    if (t.e) {
      if (t.e.dying) return;
      hurtEnemy(t.e, hero.dmg * (0.9 + S.tools.axe * 0.35));
      Sound.play('hit'); spawnParticles(t.e.pos.clone().add(V(0, 0.7, 0)), 0xffffff, 4, 2.5, 0.14, 0.4);
      return;
    }
    const n = t.n; if (!n.alive) return;
    const info = NODE_INFO[n.kind];
    const pos = V(n.x, n.y + 1.6, n.z);
    if (n.kind === 'berry') {
      addRes('food', info.ratio, pos); Sound.play('pickup');
      killNode(n); return;
    }
    const power = (info.tool === 'axe' ? AXES[S.tools.axe].power : PICKS[S.tools.pick].power) * hero.gather;
    const dmg = Math.min(n.hp, power);
    n.hp -= dmg; n.acc += dmg * info.ratio;
    const whole = Math.floor(n.acc); if (whole > 0) { n.acc -= whole; addRes(info.res, whole, pos); }
    n.shake = 0.3;
    Sound.play(n.kind === 'tree' ? 'chop' : 'mine');
    spawnParticles(V(n.x, n.y + (n.kind === 'tree' ? 1.0 : 0.7), n.z), n.kind === 'tree' ? 0xc89a5e : (n.kind === 'coal' ? 0x222222 : n.kind === 'iron' ? 0xc87a40 : 0x9a9a96), 5, 3, 0.14, 0.6);
    if (n.hp <= 0.001) {
      if (n.acc > 0.3) addRes(info.res, 1, pos);
      if (n.kind === 'tree') fellTree(n);
      killNode(n);
    }
  }
  function killNode(n) {
    n.alive = false; n.regrow = NODE_INFO[n.kind].regrow; n.acc = 0; World.updateNodeMatrix(n); deadNodes.push(n);
  }
  const falling = [];
  function fellTree(n) {
    const m = new THREE.Mesh(n.im.geometry, n.im.material); m.castShadow = true;
    m.position.set(n.x, n.y, n.z); m.scale.setScalar(n.scale); m.rotation.y = n.rot;
    const piv = new THREE.Group(); piv.position.set(n.x, n.y, n.z); m.position.set(0, 0, 0); piv.add(m);
    piv.rotation.y = Math.atan2(n.x - P.pos.x, n.z - P.pos.z);
    m.rotation.y = n.rot - piv.rotation.y;
    scene.add(piv); falling.push({ g: piv, t: 0 });
  }
  function updateNodes(dt) {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i]; f.t += dt;
      f.g.rotation.x = Math.min(Math.PI / 2, f.t * f.t * 2.2);
      if (f.t > 1.4) f.g.position.y -= dt * 2;
      if (f.t > 2.4) { scene.remove(f.g); falling.splice(i, 1); }
    }
    for (let i = deadNodes.length - 1; i >= 0; i--) {
      const n = deadNodes[i]; n.regrow -= dt;
      if (n.regrow <= 0) {
        const blocked = B.some(b => !b.onWall && n.x > b.minx - n.r && n.x < b.maxx + n.r && n.z > b.minz - n.r && n.z < b.maxz + n.r) || Math.hypot(P.pos.x - n.x, P.pos.z - n.z) < 3;
        if (blocked) { n.regrow = 20; continue; }
        n.alive = true; n.hp = n.maxHp; n.grow = 0.05; deadNodes.splice(i, 1); World.updateNodeMatrix(n);
      }
    }
    // анимации встряски/роста — только у ближних
    for (const n of World.nodesNear(P.pos.x, P.pos.z, 40, nearTmp)) {
      if (!n.alive) continue;
      if (n.shake > 0) { n.shake = Math.max(0, n.shake - dt); World.updateNodeMatrix(n); }
      if (n.grow < 1) { n.grow = Math.min(1, n.grow + dt * 0.5); World.updateNodeMatrix(n); }
    }
  }
  function updatePlayer(dt) {
    const hero = HEROES[S.hero], m = P.mesh;
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead <= 0) { P.dead = 0; P.hp = P.maxHp; P.pos.set(0, 0, 5); m.rotation.x = 0; UI.toast('Вы снова в строю!', 'good'); }
      m.position.set(P.pos.x, World.groundAt(P.pos.x, P.pos.z) + 0.3, P.pos.z);
      return;
    }
    // регенерация
    if (time - P.lastHurt > 5) P.hp = Math.min(P.maxHp, P.hp + dt * (S.hero === 'defender' ? 4 : 2));
    // движение относительно камеры
    let ix = input.mx, iz = input.mz; const mag = Math.min(1, Math.hypot(ix, iz));
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix; const ml = Math.hypot(mx, mz);
    const running = input.run || mag > 0.92;
    P.moving = 0;
    if (ml > 0.08) {
      mx /= ml; mz /= ml;
      let spd = hero.speed * (running ? 1.35 : 1) * Math.max(0.35, mag);
      if (World.inWater(P.pos.x, P.pos.z)) spd *= 0.55;
      if (P.swing > 0) spd *= 0.6;
      P.pos.x += mx * spd * dt; P.pos.z += mz * spd * dt;
      if (P.swing <= 0) P.yaw = Math.atan2(mx, mz);
      P.moving = running ? 2 : 1;
    }
    // столкновения: постройки, деревья/камни, граница мира
    collideBuildings(P.pos, 0.45, false);
    for (const n of World.nodesNear(P.pos.x, P.pos.z, 3, nearTmp)) {
      if (!n.alive || n.kind === 'berry') continue;
      const dx = P.pos.x - n.x, dz = P.pos.z - n.z, d = Math.hypot(dx, dz), rr = n.r + 0.4;
      if (d < rr && d > 0.001) { P.pos.x = n.x + dx / d * rr; P.pos.z = n.z + dz / d * rr; }
    }
    const dc = Math.hypot(P.pos.x, P.pos.z); if (dc > 168) { P.pos.x *= 168 / dc; P.pos.z *= 168 / dc; }
    P.pos.y = Math.max(World.groundAt(P.pos.x, P.pos.z), World.WATER_Y - 1.1);
    // действие
    P.atkCd -= dt;
    if (input.action || G.settings.autoAct) playerAct();
    if (P.swing > 0) {
      P.swing += dt / (1 / hero.atkRate * 0.85);
      if (!P.hitDone && P.swing > 0.55) { P.hitDone = true; applyHit(P.swingTarget); }
      if (P.swing >= 1) { P.swing = 0; P.atkCd = 0.08; }
    }
    // позиция и анимация
    m.position.copy(P.pos);
    let dy = P.yaw - m.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    m.rotation.y += dy * Math.min(1, dt * 14);
    P.animT += dt;
    Models.animHero(m, P.moving === 2 ? 'run' : (P.moving ? 'walk' : 'idle'), P.animT, hero.speed / 6, P.swing);
  }
  G.eat = function () {
    if (S.res.food < 3) { UI.toast('Нужно 3 🍖', 'warn'); Sound.play('error'); return; }
    if (P.hp >= P.maxHp) { UI.toast('Здоровье уже полное', 'info'); return; }
    S.res.food -= 3; P.hp = Math.min(P.maxHp, P.hp + 35); Sound.play('pickup'); UI.toast('+35 ❤️', 'good');
  };

  // ---------------- Взаимодействие ----------------
  G.interactTarget = function () {
    if (!P || P.dead) return null;
    let best = null, bd = 2.4;
    for (const b of B) {
      if (b.onWall) continue;
      const cx = clamp(P.pos.x, b.minx, b.maxx), cz = clamp(P.pos.z, b.minz, b.maxz);
      const d = Math.hypot(P.pos.x - cx, P.pos.z - cz);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  };
  G.upgradeCost = function (b) {
    if (b.t === 'wall' && b.lvl < 5) { const L = WALL_LEVELS[b.lvl]; return { cost: G.scaleCost(L.cost), req: L.req, name: L.name }; }
    if (b.t === 'cannon' && b.lvl < 5) { const L = CANNON_LEVELS[b.lvl]; return { cost: G.scaleCost(L.cost), req: L.req, name: L.name }; }
    return null;
  };
  G.upgrade = function (b) {
    const u = G.upgradeCost(b); if (!u) return false;
    if (u.req && !S.tech[u.req]) { UI.toast(`Нужна технология «${TECH[u.req].name}»`, 'warn'); Sound.play('error'); return false; }
    if (!tryPay(u.cost)) return false;
    const frac = b.hp / b.maxHp; void frac;
    b.lvl++; b.maxHp = maxHpOf(b); b.hp = b.maxHp;
    buildMesh(b);
    if (b.cannonId && byId[b.cannonId]) buildMesh(byId[b.cannonId]);
    Sound.play('upgrade'); spawnParticles(V(b.x, b.mesh.position.y + 2, b.z), 0xffe066, 16, 4, 0.18, 1);
    UI.toast(`Улучшено: ${G.buildingLabel(b)}`, 'good');
    return true;
  };
  G.repairCost = function (b) {
    if (b.hp >= b.maxHp) return null;
    const miss = 1 - b.hp / b.maxHp;
    if (b.t === 'core') return { wood: Math.ceil(miss * 80) };
    const base = b.t === 'wall' ? WALL_LEVELS[b.lvl - 1].cost : b.t === 'cannon' ? CANNON_LEVELS[b.lvl - 1].cost : BUILD[b.t].cost;
    const o = {}; for (const k in base) if (k !== 'coins') o[k] = Math.max(1, Math.ceil(base[k] * miss * 0.6 * costMul()));
    if (!Object.keys(o).length) o.wood = Math.ceil(miss * 10);
    return o;
  };
  G.repair = function (b) {
    const c = G.repairCost(b); if (!c) return;
    if (!tryPay(c)) return;
    b.hp = b.maxHp; Sound.play('build'); spawnParticles(V(b.x, b.mesh.position.y + 1.5, b.z), 0x80ff80, 10, 3, 0.15, 0.8);
    UI.toast('Отремонтировано!', 'good');
  };
  G.demolish = function (b) {
    if (b.t === 'core') return;
    const c = BUILD[b.t].cost;
    for (const k in c) addRes(k, Math.floor(c[k] * 0.5));
    if (b.cannonId && byId[b.cannonId]) { const cc = BUILD.cannon.cost; for (const k in cc) addRes(k, Math.floor(cc[k] * 0.5)); }
    spawnParticles(V(b.x, b.mesh.position.y + 1, b.z), 0xbfae90, 14, 3, 0.4, 1);
    removeBuilding(b); Sound.play('crumble');
  };
  G.byId = id => byId[id];

  // ---------------- Мастерская ----------------
  G.hasWorkshop = () => G.countB('workshop') > 0;
  G.craftTool = function (kind) {
    if (!G.hasWorkshop()) { UI.toast('Сначала постройте мастерскую', 'warn'); return false; }
    const list = kind === 'axe' ? AXES : PICKS; const cur = S.tools[kind]; const next = list[cur + 1];
    if (!next) return false;
    if (next.req && !S.tech[next.req]) { UI.toast(`Нужна технология «${TECH[next.req].name}»`, 'warn'); Sound.play('error'); return false; }
    if (!tryPay(next.cost)) return false;
    S.tools[kind]++; P.toolTier = -9; setTool(kind);
    Sound.play('upgrade'); UI.toast(`Создано: ${next.name}!`, 'good');
    return true;
  };
  G.research = function (id) {
    if (!G.hasWorkshop()) { UI.toast('Сначала постройте мастерскую', 'warn'); return false; }
    const t = TECH[id]; if (S.tech[id]) return false;
    if (t.need && !S.tech[t.need]) { UI.toast(`Сначала изучите «${TECH[t.need].name}»`, 'warn'); Sound.play('error'); return false; }
    if (!tryPay(t.cost)) return false;
    S.tech[id] = true; Sound.play('win'); UI.toast(`Изучено: ${t.name}!`, 'good', 3000);
    return true;
  };

  // ---------------- Строительство ----------------
  const ghostOK = new THREE.MeshStandardMaterial({ color: 0x40ff60, transparent: true, opacity: 0.45, depthWrite: false });
  const ghostBad = new THREE.MeshStandardMaterial({ color: 0xff4040, transparent: true, opacity: 0.45, depthWrite: false });
  function makeGhost(t, onWall) {
    const g = t === 'cannon' ? Models.makeCannon(1, onWall) : Models.makeBuilding(t, 1);
    g.traverse(o => { if (o.isMesh) { o.material = ghostOK; o.castShadow = false; o.receiveShadow = false; } });
    scene.add(g); return g;
  }
  G.enterBuild = function (t) {
    const d = BUILD[t];
    if (d.req && !S.tech[d.req]) { UI.toast(`Нужна технология «${TECH[d.req].name}» (мастерская)`, 'warn'); Sound.play('error'); return false; }
    if (d.unique && G.countB(t) > 0) { UI.toast('Такая постройка уже есть', 'warn'); return false; }
    if (build) G.cancelBuild();
    build = { t, rot: 0, ghost: makeGhost(t, false), ghostWall: t === 'cannon' ? makeGhost(t, true) : null, x: 0, z: 0, valid: false, reason: '', onWall: null };
    return true;
  };
  G.cancelBuild = function () { if (!build) return; scene.remove(build.ghost); if (build.ghostWall) scene.remove(build.ghostWall); build = null; };
  G.rotateBuild = () => { if (build) { build.rot = (build.rot + 1) % 4; Sound.play('click'); } };
  G.building = () => build;
  function updateBuild() {
    if (!build) return;
    const t = build.t, d = BUILD[t];
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const dist = 2.2 + Math.max(d.size[0], d.size[1]) / 2;
    let px = P.pos.x + fx * dist, pz = P.pos.z + fz * dist;
    let x = Math.round(px / 2) * 2, z = Math.round(pz / 2) * 2;
    build.onWall = null;
    if (t === 'cannon') {
      let bw = null, bd = 3.2;
      B.forEach(b => { if (b.t === 'wall' && !b.cannonId) { const dd = Math.hypot(b.x - px, b.z - pz); if (dd < bd) { bd = dd; bw = b; } } });
      if (bw) { build.onWall = bw; x = bw.x; z = bw.z; }
    }
    let rot = build.onWall ? build.onWall.rot : build.rot;
    // стены, заборы и ворота «прилипают» к соседним — можно ставить вплотную и закрывать проломы
    if (WALLISH[t]) {
      let best = null, bdist = 3.4;
      const free = (cx, cz) => !B.some(o => WALLISH[o.t] && Math.hypot(o.x - cx, o.z - cz) < 1.2);
      const tryC = (cx, cz, r) => { const dd2 = Math.hypot(cx - px, cz - pz); if (dd2 < bdist && free(cx, cz)) { bdist = dd2; best = [cx, cz, r]; } };
      for (const o of B) {
        if (!WALLISH[o.t]) continue;
        const a = o.rot * Math.PI / 2, ax = Math.cos(a), az = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
        tryC(o.x + ax * 4, o.z + az * 4, o.rot); tryC(o.x - ax * 4, o.z - az * 4, o.rot);
        for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) tryC(o.x + ax * 2 * s1 + nx * 2 * s2, o.z + az * 2 * s1 + nz * 2 * s2, (o.rot + 1) % 4);
      }
      if (best) { x = Math.round(best[0] * 100) / 100; z = Math.round(best[1] * 100) / 100; rot = best[2]; }
    }
    build.prot = rot;
    let valid = true, reason = '';
    const [w, dd] = footprint(t, rot);
    if (!build.onWall) {
      const minx = x - w / 2, maxx = x + w / 2, minz = z - dd / 2, maxz = z + dd / 2, sh = 0.3;
      for (const b of B) { if (b.onWall) continue; const s2 = WALLISH[t] && WALLISH[b.t] ? 0.75 : sh; if (minx + s2 < b.maxx && maxx - s2 > b.minx && minz + s2 < b.maxz && maxz - s2 > b.minz) { valid = false; reason = 'Место занято'; break; } }
      if (valid) for (const n of World.nodesNear(x, z, 6, nearTmp)) { if (!n.alive) continue; const cx = clamp(n.x, minx, maxx), cz = clamp(n.z, minz, maxz); if (Math.hypot(n.x - cx, n.z - cz) < n.r * 0.8) { valid = false; reason = 'Мешает ' + NODE_INFO[n.kind].name.toLowerCase(); break; } }
      const by = baseY(t, x, z, rot);
      if (valid && by.min < World.WATER_Y + 0.1) { valid = false; reason = 'Нельзя строить в воде'; }
      if (valid && by.max - by.min > 1.6) { valid = false; reason = 'Слишком круто'; }
      if (valid && Math.hypot(x, z) > 160) { valid = false; reason = 'Слишком далеко'; }
      if (valid && Math.hypot(P.pos.x - x, P.pos.z - z) < 0.5) { valid = false; reason = 'Отойдите'; }
      if (valid && t === 'minelift' && !World.inMine(x, z)) { valid = false; reason = 'Только в карьере (восток)'; }
      if (valid && P.pos.x > minx - 0.35 && P.pos.x < maxx + 0.35 && P.pos.z > minz - 0.35 && P.pos.z < maxz + 0.35 && !PASS_PLAYER[t]) { valid = false; reason = 'Вы стоите на месте'; }
    }
    build.x = x; build.z = z; build.valid = valid; build.reason = reason;
    const g = build.onWall ? build.ghostWall : build.ghost;
    build.ghost.visible = !build.onWall; if (build.ghostWall) build.ghostWall.visible = !!build.onWall;
    g.position.set(x, build.onWall ? wallTopY(build.onWall) : baseY(t, x, z, rot).min, z);
    g.rotation.y = rot * Math.PI / 2;
    const mt = valid ? ghostOK : ghostBad;
    g.traverse(o => { if (o.isMesh) o.material = mt; });
  }
  G.placeBuild = function () {
    if (!build) return;
    if (!build.valid) { UI.toast(build.reason || 'Здесь нельзя строить', 'warn'); Sound.play('error'); return; }
    const t = build.t, cost = G.scaleCost(BUILD[t].cost);
    if (!tryPay(cost)) return;
    let b;
    if (build.onWall) b = addBuilding('cannon', build.x, build.z, build.onWall.rot, 1, null, build.onWall.id);
    else b = addBuilding(t, build.x, build.z, build.prot != null ? build.prot : build.rot);
    S.stats.built++;
    Sound.play('build');
    spawnParticles(V(b.x, b.mesh.position.y + 0.3, b.z), 0xc8b090, 14, 3, 0.35, 0.9);
    if (t === 'cannon') { const bird = BD.find(x => !x.cannon); if (bird) G.assignBird(bird, b); else UI.toast('Купите птицу, чтобы она села за пушку (🐦)', 'info', 3500); }
    if (BUILD[t].unique) G.cancelBuild();
  };

  // ---------------- Производство ----------------
  function updateLights(dt) {
    const night = Math.max(0, Math.min(1, 1 - World.daylight * 2.2));
    for (const b of B) { const f = b.mesh.userData.fire; if (f) { f.scale.set(1 + Math.sin(time * 13 + b.id) * 0.08, 1 + Math.sin(time * 9 + b.id * 2) * 0.15, 1); } }
    lightT -= dt;
    if (lightT <= 0) {
      lightT = 0.3;
      const lamps = B.filter(b => b.mesh.userData.lightPos).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
      lightPool.forEach((l, i) => { const b = lamps[i]; l.userData.b = b || null; if (b) l.position.copy(b.mesh.localToWorld(b.mesh.userData.lightPos.clone())); });
    }
    lightPool.forEach(l => {
      const b = l.userData.b;
      if (!b || !B.includes(b) || night <= 0) { l.intensity = 0; return; }
      const pw = b.mesh.userData.lightPower;
      l.intensity = night * 0.75 * pw * (b.mesh.userData.fire ? 0.9 + Math.sin(time * 17 + b.id) * 0.1 : 1);
      l.distance = 11 + pw * 5; l.decay = 1.6; l.color.setHex(b.mesh.userData.fire ? 0xff9a40 : 0xffc070);
    });
  }
  function updateProduction(dt) {
    for (const b of B) {
      if (b.t === 'farm') { b.prodT += dt; if (b.prodT >= 10) { b.prodT = 0; addRes('food', 1, Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 25 ? V(b.x, b.y + 1.5, b.z) : null); } }
      if (b.t === 'minelift') {
        b.prodT += dt; b.prod2 += dt; b.prod3 += dt;
        const near = Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 25;
        if (b.prodT >= 6) { b.prodT = 0; addRes('stone', 1, near ? V(b.x, b.y + 2, b.z) : null); }
        if (b.prod2 >= 14) { b.prod2 = 0; addRes('coal', 1, near ? V(b.x, b.y + 2.6, b.z) : null); }
        if (b.prod3 >= 24) { b.prod3 = 0; addRes('iron', 1, near ? V(b.x, b.y + 3.2, b.z) : null); }
        if (b.mesh.userData.spin) b.mesh.userData.spin.rotation.z += dt * 2;
      }
      if (b.t === 'core' && b.mesh.userData.flag) b.mesh.userData.flag.rotation.y = Math.sin(time * 2) * 0.3;
    }
  }

  // ---------------- Задания ----------------
  let questT = 0;
  function updateQuests(dt) {
    questT -= dt; if (questT > 0) return; questT = 1;
    const q = QUESTS[S.quest];
    if (q && q.check(S)) {
      S.quest++; addRes('coins', q.reward);
      UI.toast(`🏆 Задание выполнено: ${q.text} (+${q.reward} 🪙)`, 'good', 4000); Sound.play('win');
    }
  }
  G.questText = () => { const q = QUESTS[S.quest]; return q ? q.text : 'Защищайте птиц как можно дольше!'; };
  G.questTarget = () => { const i = S.quest; if (i === 5 || i === 10) return World.MINE; return null; };

  // ---------------- Камера ----------------
  G.camRotate = (dx, dy) => { cam.yaw -= dx; cam.pitch = clamp(cam.pitch + dy, 0.3, 1.3); };
  G.camZoom = d => { cam.dist = clamp(cam.dist + d, 6, 24); };
  function updateCamera(dt) {
    cam.yaw -= input.camX * dt * 2.6;
    cam.pitch = clamp(cam.pitch + input.camY * dt * 1.6, 0.3, 1.3);
    const tgt = tv.set(P.mesh.position.x, P.mesh.position.y + 1.4, P.mesh.position.z);
    const dist = cam.dist * (G.settings.camDist || 100) / 100;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const des = tv2.set(tgt.x + Math.sin(cam.yaw) * cp * dist, tgt.y + sp * dist, tgt.z + Math.cos(cam.yaw) * cp * dist);
    const gy = World.groundAt(des.x, des.z) + 1; if (des.y < gy) des.y = gy;
    camera.position.lerp(des, 1 - Math.exp(-dt * 12));
    camera.lookAt(tgt);
  }
  G.camYaw = () => cam.yaw;

  // ---------------- Главный цикл ----------------
  let skyT = 0;
  G.frame = function (dt) {
    time += dt;
    if (G.state === 'menu' || G.state === 'loading' || G.state === 'bye') {
      // атмосферный пролёт камеры над лесом
      const a = time * 0.04;
      const c = V(-40, 0, 30);
      camera.position.set(c.x + Math.cos(a) * 38, 14 + Math.sin(time * 0.1) * 3, c.z + Math.sin(a) * 38);
      camera.lookAt(c.x, 4, c.z);
      // летящая птица перед камерой
      const fwd = V(0, 0, -1).applyQuaternion(camera.quaternion), right = V(1, 0, 0).applyQuaternion(camera.quaternion), up = V(0, 1, 0).applyQuaternion(camera.quaternion);
      const bt = time * 0.45;
      const bp = camera.position.clone().addScaledVector(fwd, 9 + Math.sin(bt * 0.7) * 1.5).addScaledVector(right, Math.sin(bt) * 4.2).addScaledVector(up, -0.6 + Math.sin(bt * 2) * 0.9);
      const prev = menuBird.position.clone(); menuBird.position.copy(bp); menuBird.visible = true;
      const dir = bp.clone().sub(prev); if (dir.lengthSq() > 1e-6) menuBird.lookAt(bp.clone().add(dir)); menuBird.rotateY(0);
      menuBird.rotation.z += Math.cos(bt) * 0.25;
      Models.animBird(menuBird, Math.sin(time * 0.8) > -0.3 ? 'fly' : 'glide', time);
      skyT = 0.18 + Math.sin(time * 0.01) * 0.04;
      World.updateSky(skyT, camera.position.clone().setY(0), dt, time);
      renderer.render(scene, camera);
      return;
    }
    menuBird.visible = false;
    if (G.state === 'select') {
      if (selHero) { selHero.rotation.y = G.selRot; Models.animHero(selHero, 'idle', time, 1, 0); }
      (selScene.userData.birds || []).forEach(b => Models.animBird(b, Math.sin(time + b.userData.ph * 2) > 0.6 ? 'peck' : 'idle', time, b.userData.ph));
      renderer.render(selScene, selCam);
      return;
    }
    if (G.state === 'play' || G.state === 'over') {
      if (G.state === 'play' && !G.paused) update(dt);
      updateCamera(dt);
      renderer.render(scene, camera);
      if (G.state === 'play') UI.hud(dt);
    }
  };
  function update(dt) {
    S.dayTime += dt / 300; if (S.dayTime >= 1) { S.dayTime -= 1; S.day++; UI.toast(`☀️ День ${S.day}`, 'info'); }
    const dl = World.updateSky(S.dayTime, V(P.pos.x, 0, P.pos.z), dt, time);
    Sound.setNight(dl < 0.2);
    updatePlayer(dt);
    updateBuild();
    updateNodes(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateDefense(dt);
    updateBirds(dt);
    updateProduction(dt);
    updateLights(dt);
    updateParticles(dt);
    updateQuests(dt);
    autosaveT -= dt; if (autosaveT <= 0) { autosaveT = 45; if (!S.waveActive) G.save(true); }
  }
  let autosaveT = 45;
  G._add = (...a) => addBuilding(...a); G._spawn = (t, x, z) => spawnEnemy(t, V(x, World.groundAt(x, z), z));
  G.debugStep = function (dt, n) { for (let i = 0; i < n; i++) { time += dt; update(dt); } };

  // Для HUD: полоски здоровья в мире
  G.worldBars = function () {
    const out = [];
    for (const e of E) if (!e.dying && e.hp < e.maxHp) out.push({ p: tv.set(e.pos.x, e.pos.y + 1.4 * e.d.size + 0.4, e.pos.z).clone(), f: e.hp / e.maxHp, c: '#ff5050' });
    for (const b of B) if (b.hp < b.maxHp && b.t !== 'core' && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 40) out.push({ p: V(b.x, b.mesh.position.y + (b.t === 'wall' ? 3.6 : 3), b.z), f: b.hp / b.maxHp, c: '#ffc040' });
    return out.slice(0, 40);
  };
  G.project = function (v) {
    tv.copy(v).project(camera);
    if (tv.z > 1) return null;
    return { x: (tv.x * 0.5 + 0.5) * window.innerWidth, y: (-tv.y * 0.5 + 0.5) * window.innerHeight };
  };
  G.player = () => P;
  G.core = () => B.find(b => b.t === 'core');
  G.enemiesLeft = () => E.filter(e => !e.dying && !e.flee).length + (S.spawnList ? S.spawnList.length : 0);

  // ---------------- Конец игры ----------------
  function gameOver() {
    G.state = 'over'; Sound.play('lose'); Sound.setMode('calm');
    UI.gameOver({ wave: S.wave, kills: S.stats.kills, day: S.day });
  }

  // ---------------- Выбор героя ----------------
  G.selRot = 0;
  G.showHero = function (type) {
    if (selHero) selScene.remove(selHero);
    selHero = Models.makeHero(type); selScene.add(selHero);
    const hand = selHero.userData.parts.hand; hand.add(Models.makeTool(type === 'builder' ? 'hammer' : 'axe', type === 'hunter' ? 1 : 0));
  };


  // ---------------- Портреты птиц (рендер в текстуру) ----------------
  const portraits = {};
  G.makePortraits = function () {
    const size = 128, rt = new THREE.WebGLRenderTarget(size, size);
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xdff0c8);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8aa86a, 1.0));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(2, 3, 4); sc.add(dl);
    const cm = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const px = new Uint8Array(size * size * 4);
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const cx = cv.getContext('2d');
    const prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    BIRD_ORDER.forEach(sp => {
      const b = Models.makeBird(sp); b.scale.setScalar(1); b.rotation.y = 0.6; sc.add(b);
      Models.animBird(b, 'idle', 0);
      const box = new THREE.Box3().setFromObject(b), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      const d = Math.max(s.x, s.y, s.z) * 2.1;
      cm.position.set(c.x + d * 0.25, c.y + d * 0.15, c.z + d); cm.lookAt(c);
      renderer.setRenderTarget(rt); renderer.render(sc, cm);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      const img = cx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      cx.putImageData(img, 0, 0); portraits[sp] = cv.toDataURL();
      sc.remove(b);
    });
    renderer.setRenderTarget(null); renderer.shadowMap.enabled = prevShadow; rt.dispose();
  };
  G.portrait = sp => portraits[sp] || '';

  // ---------------- Сохранение ----------------
  const SAVE_KEY = 'birdfortress_save_v1';
  G.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  G.save = function (auto) {
    if (!S || G.state === 'over') return;
    S.player = { x: P.pos.x, z: P.pos.z, hp: P.hp };
    const data = Object.assign({}, S, {
      waveActive: false, spawnList: null, waveTimer: S.waveActive ? 30 : S.waveTimer,
      buildings: B.map(b => ({ id: b.id, t: b.t, x: b.x, z: b.z, r: b.rot, l: b.lvl, hp: Math.round(b.hp), w: b.onWall || 0 })),
      birds: BD.map(b => ({ sp: b.sp, hp: b.hp, c: b.cannon ? b.cannon.id : 0 })),
      nodes: World.nodes.filter(n => !n.alive).map(n => [n.idx, Math.round(n.regrow)]),
      cam: { yaw: cam.yaw, pitch: cam.pitch }, savedAt: Date.now(),
    });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); if (!auto) UI.toast('💾 Игра сохранена', 'info'); else UI.saveIcon(); } catch (e) { UI.toast('Не удалось сохранить', 'bad'); }
  };
  G.load = function () {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data) return false;
    clearWorld();
    S = data; const blds = data.buildings, birds = data.birds, nodes = data.nodes;
    delete S.buildings; delete S.birds; delete S.nodes;
    if (!S.diff) S.diff = 'normal';
    S.res = Object.assign({ wood: 0, stone: 0, iron: 0, coal: 0, food: 0, coins: 0 }, S.res);
    S.waveActive = false;
    blds.filter(b => !b.w).forEach(b => addBuilding(b.t, b.x, b.z, b.r, b.l, b.hp, null, b.id));
    blds.filter(b => b.w).forEach(b => { if (byId[b.w]) addBuilding(b.t, b.x, b.z, b.r, b.l, b.hp, b.w, b.id); });
    if (!B.some(b => b.t === 'core')) addBuilding('core', 0, 0, 0);
    birds.forEach(b => addBird(b.sp, b.hp, b.c && byId[b.c] ? byId[b.c] : null));
    nodes.forEach(([i, r]) => { const n = World.nodes[i]; if (n) { n.alive = false; n.regrow = r; World.updateNodeMatrix(n); deadNodes.push(n); } });
    spawnPlayer();
    if (data.cam) { cam.yaw = data.cam.yaw; cam.pitch = data.cam.pitch; }
    G.state = 'play'; Sound.setMode('calm');
    return true;
  };
  G.deleteSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } };
  G.saveInfo = function () {
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!d) return null; return { hero: d.hero, wave: d.wave, day: d.day, at: d.savedAt, diff: d.diff || 'normal' }; } catch (e) { return null; }
  };
})();
