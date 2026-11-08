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
  const lightPool = []; let lightT = 0, gearPoint = null, gearSpot = null;
  const cam = { fp: -0.15, yaw: 0.7, pitch: 0.88, dist: 12, pos: new THREE.Vector3() };
  const input = G.input = { mx: 0, mz: 0, run: false, action: false, camX: 0, camY: 0 };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tv = V(0, 0, 0), tv2 = V(0, 0, 0);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  G.state = 'loading';
  G.paused = false;

  // ---------------- Инициализация ----------------
  G.initRenderer = function (canvas) {
    const q = G.settings.quality;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    // мягкие тени дорогие для телефона: на «ПК»/ультра — PCFSoft, иначе обычный PCF (почти не отличим)
    renderer.shadowMap.type = (q === 'pc' || q === 'ultra') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // тени обновляем через кадр (см. G.frame)
  };
  G.init = function (canvas) { if (!renderer) G.initRenderer(canvas); G.initWorld(); };
  G.initWorld = function () {
    const q = G.settings.quality;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x8fd0f4, 60, 240);
    camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1000);
    World.build(scene, q);
    lightPool.length = 0;
    gearPoint = new THREE.PointLight(0xffd090, 0, 14, 1.5); scene.add(gearPoint);
    gearSpot = new THREE.SpotLight(0xfff4d8, 0, 50, 0.42, 0.55, 1.2); scene.add(gearSpot); scene.add(gearSpot.target);
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
    else pr = Math.min(window.devicePixelRatio || 1, { low: 0.75, medium: 1, high: 1.5, ultra: 2, pc: 2 }[G.settings.quality] || 1) * dynScale;
    renderer.setPixelRatio(clamp(pr, 0.4, 3));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    selCam.aspect = w / h; selCam.updateProjectionMatrix();
    selCam.position.set(w < h ? 0 : -1.3, 1.5, w < h ? 7 : 5.2); selCam.lookAt(w < h ? 0 : -1.3, w < h ? 0.4 : 1.0, 0);
  };
  G.applyQuality = function () {
    const q = G.settings.quality;
    const hi = q === 'pc';
    if (Models.detail !== hi) { Models.setDetail(hi); rebuildCreatures(); }
    World.applyQuality(q);
    const far = { low: 150, medium: 220, high: 280, ultra: 340, pc: 420 }[q] || 220;
    scene.fog.far = far; scene.fog.near = far * 0.3; camera.far = far + 650; camera.updateProjectionMatrix();
    G.resize();
  };

  // Пересоздать модели птиц, зверей и героя (при переключении на графику «ПК» и обратно)
  function rebuildCreatures() {
    if (!scene) return;
    const swap = (old, fresh) => { fresh.position.copy(old.position); fresh.rotation.copy(old.rotation); fresh.visible = old.visible; if (old.userData.baseScale) fresh.scale.setScalar(old.scale.x); scene.remove(old); scene.add(fresh); return fresh; };
    BD.forEach(b => { b.mesh = swap(b.mesh, Models.makeBird(b.sp)); });
    E.forEach(e => { e.mesh = swap(e.mesh, Models.makeEnemy(e.type)); });
    if (menuBird) { const m = Models.makeBird('parrot'); m.scale.setScalar(1.6); menuBird = swap(menuBird, m); menuBird.scale.setScalar(1.6); }
    if (P && S) {
      const fresh = Models.makeHero(S.hero); fresh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      P.mesh = swap(P.mesh, fresh); P.tool = null; P.toolTier = -9; setTool('axe');
      if (S.gear) { Models.setGear(P.mesh, S.gear.eq); Models.setArmor(P.mesh, S.gear.armor); }
    }
  }

  // ---------------- Состояние ----------------
  function newState(hero, diff) {
    const D = DIFFICULTY[diff] || DIFFICULTY.normal, st = D.start;
    return {
      v: 1, hero, diff: diff || 'normal', res: { wood: Math.round(30 * st), stone: 0, iron: 0, coal: 0, ruby: 0, food: Math.round(10 * st), coins: Math.round(60 * st) },
      tools: { axe: 0, pick: -1, sword: -1 }, tech: { stone: false, metal: false, mech: false },
      wave: 1, waveTimer: Math.round(D.prep * 1.25), waveActive: false, dayTime: 0.02, day: 1, quest: 0,
      player: { x: 0, z: 6, hp: HEROES[hero].hp }, stats: { wood: 0, stone: 0, iron: 0, coal: 0, food: 0, coins: 0, kills: 0, bosses: 0, built: 0, boughtBirds: 0, time: 0 },
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
    if (cut) { scene.remove(cut.heli); cut = null; UI.cutscene(false); }
    puppets.forEach((_, k) => removePuppet(k));
    World.nodes.forEach(n => { n.alive = true; n.hp = n.maxHp; n.grow = 1; n.shake = 0; n.acc = 0; World.updateNodeMatrix(n); });
    if (P) scene.remove(P.mesh);
    if (build) G.cancelBuild();
    nextId = 1;
  }

  G.newGame = function (hero, diff, seed, biomeId, slot) {
    clearWorld();
    seed = seed || 20240611;
    if (slot) G.slot = slot;
    const wantBiome = biomeId || World.biomeOf(seed).id;
    if (World.seed !== seed || World.biomeId !== wantBiome) World.generate(seed, wantBiome);
    S = newState(hero, diff); S.seed = seed;
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
    P = { mesh, pos: V(S.player.x, 0, S.player.z), yaw: Math.PI, hp: S.player.hp, maxHp: h.hp, st: h.stamina, maxSt: h.stamina, stRest: 0, tired: false, swing: 0, swingTarget: null, hitDone: false, atkCd: 0, dead: 0, lastHurt: -10, tool: null, toolTier: -2, moving: 0, hintT: 0, animT: 0 };
    P.pos.y = World.groundAt(P.pos.x, P.pos.z);
    setTool('axe');
    if (!S.gear) S.gear = { own: {}, eq: null };
    if (S.hero === 'knight' && !S.gear.own.a_iron) { S.gear.own.a_iron = true; S.gear.armor = 'iron'; }
    Models.setGear(mesh, S.gear.eq); Models.setArmor(mesh, S.gear.armor);
  }
  // Меч: уровень из мастерской; у рыцаря железный меч есть с самого начала
  G.swordTier = () => Math.max(S.tools.sword == null ? -1 : S.tools.sword, S.hero === 'knight' ? 2 : -1);
  // kind: axe | pick | weapon (меч, иначе оружие героя) | hw (только оружие героя, напр. лук)
  function toolModel(kind) {
    if (kind === 'axe') return ['axe', S.tools.axe];
    if (kind === 'pick') return ['pick', S.tools.pick];
    const w = HEROES[S.hero].weapon;
    if (kind === 'weapon') { const st = G.swordTier(); if (st >= 0) return ['sword', st]; }
    return w && w !== 'sword' ? [w, 0] : ['axe', S.tools.axe];
  }
  function setTool(kind) {
    if (kind === 'pick' && S.tools.pick < 0) kind = 'axe';
    const [model, tier] = toolModel(kind);
    if (P.tool === kind && P.toolModel === model && P.toolTier === tier) return;
    const hand = P.mesh.userData.parts.hand;
    while (hand.children.length) hand.remove(hand.children[0]);
    hand.add(Models.makeTool(model, tier));
    P.tool = kind; P.toolTier = tier; P.toolModel = model;
  }
  G.selectTool = k => {
    if (k === 'pick' && S.tools.pick < 0) { UI.toast(tr('no_pick_yet'), 'warn'); return; }
    if (k === 'weapon' && G.swordTier() < 0) { UI.toast(tr('no_sword'), 'warn'); return; }
    setTool(k);
  };
  G.playerTool = () => P ? (P.tool === 'hw' ? 'weapon' : P.tool) : 'axe';

  // ---------------- Постройки ----------------
  const PASS_PLAYER = { gate: 1, stonegate: 1, spikes: 1, farm: 1 };
  const PASS_ENEMY = { spikes: 1, farm: 1 };
  const WALLISH = { wall: 1, fence: 1, gate: 1, stonegate: 1 };
  function footprint(t, rot) { const s = BUILD[t].size; return rot % 2 ? [s[1], s[0]] : [s[0], s[1]]; }
  const LEVELS = { wall: WALL_LEVELS, cannon: CANNON_LEVELS, gate: GATE_LEVELS, ballista: BALLISTA_LEVELS, mineshaft: SHAFT_LEVELS, minelift: LIFT_LEVELS };
  G.LEVELS = LEVELS;
  function maxHpOf(b) {
    if (b.t === 'core') return Math.round(BUILD.core.hp * (DF().core || 1));
    if (b.t === 'wall' || b.t === 'gate' || b.t === 'ballista' || b.t === 'mineshaft' || b.t === 'minelift') return LEVELS[b.t][b.lvl - 1].hp;
    if (b.t === 'cannon') return BUILD.cannon.hp + (b.lvl - 1) * 110;
    return BUILD[b.t].hp;
  }
  function baseY(t, x, z, rot) {
    const [w, d] = footprint(t, rot); let m = Infinity, M = -Infinity;
    [[0, 0], [-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(([dx, dz]) => { const h = World.groundAt(x + dx, z + dz); m = Math.min(m, h); M = Math.max(M, h); });
    return { min: m, max: M };
  }
  function wallTopY(w) {
    const H = WALL_LEVELS[w.lvl - 1].h; return w.y + [H - 0.25, H - 0.2, H + 0.15, H, H, H + 0.05][w.lvl - 1];
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
    UI.toast(tr('destroyed', { name: BUILD[b.t].name }), 'bad');
    if (b.t === 'core') { removeBuilding(b); gameOver(); return; }
    removeBuilding(b);
  }
  function damageBuilding(b, dmg) {
    b.hp -= dmg; b.hitT = 0.18;
    if (Math.random() < 0.5) spawnParticles(V(b.x + rand(-1, 1), b.mesh.position.y + rand(0.5, 2), b.z + rand(-1, 1)), b.t === 'wall' && b.lvl >= 3 ? 0x9a9a96 : 0xb8844e, 3, 3, 0.18, 0.6);
    if (b.hp <= 0) destroyBuilding(b);
  }
  G.buildingLabel = b => {
    if (b.t === 'wall') return tr('lvl', { name: WALL_LEVELS[b.lvl - 1].name, l: b.lvl });
    if (LEVELS[b.t]) return tr('lvl', { name: LEVELS[b.t][b.lvl - 1].name, l: b.lvl });
    return BUILD[b.t].name;
  };

  // ---------------- Ресурсы ----------------
  const costMul = () => HEROES[S.hero].buildMul;
  G.scaleCost = function (cost) { const o = {}; for (const k in cost) o[k] = k === 'coins' ? cost[k] : Math.ceil(cost[k] * costMul()); return o; };
  G.canAfford = cost => { for (const k in cost) if ((S.res[k] || 0) < cost[k]) return false; return true; };
  G.missing = cost => Object.keys(cost).filter(k => (S.res[k] || 0) < cost[k]).map(k => `${RES_INFO[k].icon}${cost[k] - (S.res[k] || 0)}`).join(' ');
  function pay(cost) { for (const k in cost) S.res[k] -= cost[k]; }
  G.pay = c => pay(c);
  function tryPay(cost) {
    if (!G.canAfford(cost)) { UI.toast(tr('not_enough') + G.missing(cost), 'warn'); Sound.play('error'); return false; }
    pay(cost); return true;
  }
  function addRes(k, n, at) {
    if (n <= 0) return;
    const cap = k === 'coins' ? Infinity : G.cap();
    const before = S.res[k];
    S.res[k] = Math.max(before, Math.min(cap, before + n)); // не срезаем запас сверх лимита (промокод)
    const got = S.res[k] - before;
    if (got <= 0) { if (at) UI.floatText(at, tr('storage_full'), '#ff8a6a'); return; }
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
  G.assignBird = (bird, c) => { assignBird(bird, c); Sound.play('chirp'); UI.toast(tr('takes_cannon', { name: BIRDS[bird.sp].name }), 'good'); };
  G.unassignBird = bird => { if (bird.cannon) { bird.cannon.gunner = null; bird.cannon = null; } bird.state = 'walk'; flyTo(bird, randomGroundPoint(), 'walk'); };
  G.freeCannons = () => B.filter(b => b.t === 'cannon' && !b.gunner);
  function autoAssign() {
    const free = BD.filter(b => !b.cannon);
    G.freeCannons().forEach(c => { const bird = free.shift(); if (bird) G.assignBird(bird, c); });
  }
  G.buyBird = function (sp) {
    const d = BIRDS[sp];
    if (d.market && G.countB('market') === 0) { UI.toast(tr('need_market_t'), 'warn'); Sound.play('error'); return false; }
    if (BD.length >= G.birdCap()) { UI.toast(tr('no_slots'), 'warn'); Sound.play('error'); return false; }
    if (!tryPay({ coins: d.price, food: d.food })) return false;
    const b = addBird(sp); S.stats.boughtBirds++;
    Sound.play('coin'); Sound.play('chirp');
    UI.toast(tr('bought', { name: d.name }), 'good');
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
    if (danger && !dangerPrev) { Sound.play('chirp'); if (BD.some(b => !b.cannon)) UI.toast(tr('birds_hide'), 'warn'); }
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
      UI.toast(tr('bird_died', { name: BIRDS[b.sp].name }), 'bad');
      spawnParticles(b.mesh.position.clone().add(V(0, 0.5, 0)), 0xeeeeee, 14, 3, 0.15, 1.5);
      if (b.cannon) b.cannon.gunner = null;
      scene.remove(b.mesh); BD.splice(BD.indexOf(b), 1);
    } else if (b.state !== 'fly' && !b.cannon) {
      const sh = shelters()[0]; if (sh) { b.shelter = sh; flyTo(b, sh.mesh.localToWorld((sh.mesh.userData.perch || [V(0, 2, 0)])[0].clone()), 'enter'); }
    }
  }

  // ---------------- Враги и волны ----------------
  let enemySeq = 1;
  function waveList(n) {
    const types = Object.keys(ENEMIES).filter(t => !ENEMIES[t].boss && ENEMIES[t].wave <= n);
    const count = Math.max(1, Math.round((2 + Math.floor(n * 1.7)) * DF().count * (1 + 0.6 * (G.mpN() - 1))));
    const list = [];
    for (let i = 0; i < count; i++) list.push(types[Math.floor(Math.random() * types.length)]);
    if (n % 5 === 0) { const k = n / 5 - 1, boss = BOSS_ORDER[k % BOSS_ORDER.length]; for (let i = 0; i <= Math.floor(k / BOSS_ORDER.length); i++) list.push(boss); }
    return list;
  }
  function startWave() {
    S.waveActive = true; S.spawnList = waveList(S.wave); S.spawnCd = 0; S.waveDir = Math.random() * Math.PI * 2;
    Sound.play('horn'); Sound.setMode('battle');
    UI.toast(tr('wave_start', { n: S.wave }), 'bad', 3500);
    UI.banner(tr('wave_banner', { n: S.wave }));
  }
  G.startWaveNow = function () { if (S && !S.waveActive) { S.waveTimer = 0; S.earlyBonus = true; } };
  function spawnEnemy(type, pos) {
    const d = ENEMIES[type], n = S.wave;
    const mesh = Models.makeEnemy(type); scene.add(mesh);
    const mpk = G.mpN() - 1; const hpMul = (1 + (n - 1) * 0.14) * DF().hp * (1 + 0.35 * mpk);
    const e = { id: enemySeq++, type, d, mesh, pos: pos.clone(), vel: V(0, 0, 0), yaw: 0, hp: d.hp * hpMul, maxHp: d.hp * hpMul, dmg: d.dmg * (1 + (n - 1) * 0.06) * DF().dmg * (1 + 0.15 * mpk), atkCd: 0, target: null, tkind: null, retarget: 0, slow: 0, dying: 0, mode: 'walk', t: Math.random() * 10, hitT: 0, flee: false, stuck: 0 };
    mesh.position.copy(pos);
    E.push(e);
    if (d.boss) { UI.toast(tr('boss_appears', { name: d.name, desc: d.desc ? ' ' + d.desc + '.' : '' }), 'bad', 4500); UI.banner(tr('boss_banner')); Sound.play('growl', 1.6); e.summonT = 6; }
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
      UI.toast(tr('wave_done', { n: S.wave, c: bonus }), 'good', 3500);
      Sound.play('win'); Sound.setMode('calm');
      S.wave++; S.earlyBonus = false;
      // каждая пройденная волна — ещё +1 день: быстрые волны быстрее ведут к 50-му дню
      S.day++; UI.toast('📅 +1 день за волну! День ' + S.day, 'info', 3000);
      if (S.day >= GOAL_DAYS && !S.won) { startCutscene(); return; }
      S.waveTimer = Math.round(DF().prep * Math.max(0.75, 1 - (S.wave - 1) * 0.01));
      G.save();
    }
  }
  function pickTarget(e) {
    const core = B.find(b => b.t === 'core');
    const t = e.type; const ep = e.pos;
    const near = (list, r, f) => { let best = null, bd = r; list.forEach(o => { if (f && !f(o)) return; const p = o.mesh.position; const d = Math.hypot(p.x - ep.x, p.z - ep.z); if (d < bd) { bd = d; best = o; } }); return best; };
    const groundBird = b => !b.hidden && !b.cannon && b.state !== 'perch' && b.mesh.position.y - World.groundAt(b.mesh.position.x, b.mesh.position.z) < 1;
    let PT = null, playerNear = 0; mpTargets().forEach(o => { if (o.dead) return; const d = Math.hypot(o.pos.x - ep.x, o.pos.z - ep.z); if (!PT || d < playerNear) { PT = o; playerNear = d; } });
    if (t === 'monster' || t === 'treant') return ['b', core];
    if (t === 'alpha') { if (playerNear && playerNear < 18) return ['p', PT]; return ['b', core]; }
    if (t === 'bear' || t === 'boar' || t === 'wolverine' || t === 'elk' || t === 'bearking') { const b = near(B.filter(x => !x.onWall), 60); if (playerNear && playerNear < 6) return ['p', PT]; return b ? ['b', b] : ['b', core]; }
    if (t === 'fox' || t === 'lynx' || t === 'raccoon') { const bd = near(BD, 45, groundBird); if (bd) return ['bird', bd]; if (playerNear && playerNear < 10) return ['p', PT]; return ['b', core]; }
    if (playerNear && playerNear < 14) return ['p', PT];
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
      if (e.hitT > 0) { e.hitT -= dt; m.scale.setScalar(m.userData.baseScale * (1 + e.hitT)); }
      if (e.slow > 0) e.slow -= dt;
      if (e.burn) { e.burn.t -= dt; hurtEnemy(e, e.burn.dps * dt, true); if (Math.random() < 0.3) spawnParticles(e.pos.clone().add(V(0, 0.8 * e.d.size, 0)), Math.random() < 0.5 ? 0xff7a20 : 0xffd040, 1, 1, 0.18, 0.4, -0.5); if (e.burn.t <= 0) e.burn = null; if (e.dying > 0) continue; }
      if (e.stun > 0) { e.stun -= dt; m.rotation.z = Math.sin(e.t * 20) * 0.05; Models.animEnemy(m, 'idle', e.t, e.d.speed); continue; }
      e.atkCd -= dt;
      if (e.type === 'alpha') { e.summonT -= dt; if (e.summonT <= 0 && E.length < 70) { e.summonT = 12; for (let k = 0; k < 2; k++) spawnEnemy('wolf', V(e.pos.x + rand(-3, 3), 0, e.pos.z + rand(-3, 3))); UI.floatText(e.pos.clone().add(V(0, 3, 0)), tr('howl'), '#ff8080'); Sound.play('growl', 1.2); } }
      if (e.type === 'treant' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);
      // бегство (лиса при малом здоровье)
      if (!e.flee && e.type === 'fox' && e.hp < e.maxHp * 0.3) { e.flee = true; UI.floatText(e.pos.clone().add(V(0, 1.5, 0)), tr('flees'), '#ffd080'); }
      let tx, tz, reach = 0;
      if (e.flee) {
        const l = e.pos.length() || 1; tx = e.pos.x / l * 120; tz = e.pos.z / l * 120;
        if (l > 95) { scene.remove(m); E.splice(i, 1); continue; }
      } else {
        e.retarget -= dt;
        const tgtGone = !e.target || (e.tkind === 'b' && !byId[e.target.id]) || (e.tkind === 'bird' && (BD.indexOf(e.target) < 0 || e.target.hidden || e.target.state === 'perch')) || (e.tkind === 'p' && e.target.dead);
        if (e.retarget <= 0 || tgtGone) { const r = pickTarget(e); e.tkind = r[0]; e.target = r[1]; e.retarget = 0.8 + Math.random() * 0.4; }
        if (!e.target) continue;
        if (e.tkind === 'p') { tx = e.target.pos.x; tz = e.target.pos.z; reach = e.d.radius + 0.7; }
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
          if (e.tkind === 'p') { if (e.target === P) hurtPlayer(e.dmg); else Net.send(e.target.pid, { ev: 'hurt', dmg: e.dmg }); }
          else hurtBird(e.target, e.dmg);
          Sound.play('growl', 0.6);
        }
      } else {
        e.mode = 'walk';
        const spd = e.d.speed * (e.type === 'elk' && dist > 8 ? 1.6 : 1) * (e.slow > 0 ? 0.5 : 1) * (World.inWater(e.pos.x, e.pos.z) ? 0.6 : 1) * (e.flee ? 1.3 : 1);
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
    if (Net.isClient) { Net.toHost({ c: 'hitEnemy', id: e.id, dmg }); if (!quiet) e.hitT = 0.15; return; }
    e.hp -= dmg; if (!quiet) e.hitT = 0.15;
    if (e.hp <= 0) {
      e.dying = 1.6; e.mesh.scale.setScalar(e.mesh.userData.baseScale);
      if (e.d.boss) { S.stats.bosses++; UI.toast(tr('boss_down', { name: e.d.name }), 'good', 4000); }
      const c = Math.max(1, Math.round(e.d.coins * HEROES[S.hero].coinMul * (1 + S.wave * 0.03) * DF().reward));
      addRes('coins', c, e.pos.clone().add(V(0, 1.6, 0)));
      if (e.d.food) addRes('food', e.d.food, e.pos.clone().add(V(0, 2.3, 0)));
      S.stats.kills++;
      Sound.play('coin'); Sound.play('growl', 0.8);
      spawnParticles(e.pos.clone().add(V(0, 0.6, 0)), 0xffe066, 8, 3, 0.15, 0.9);
    }
  }

  // ---------------- Пушки и снаряды ----------------
  const projGeo = { bullet: new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4), rocket: new THREE.ConeGeometry(0.12, 0.6, 6), ball: new THREE.SphereGeometry(0.2, 8, 6), arrow: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), bolt: new THREE.CylinderGeometry(0.06, 0.06, 1.6, 5) };
  const projMat = { bullet: Models.mat(0xffe070, { emissive: 0xffc030, emissiveIntensity: 2 }), rocket: Models.mat(0x3e9a3a, { emissive: 0x206a10, emissiveIntensity: 0.4 }), rocketRed: Models.mat(0xe03030, { emissive: 0xa01010, emissiveIntensity: 0.6 }), fire: Models.mat(0xff7a20, { emissive: 0xff5010, emissiveIntensity: 1.6 }), ball: Models.mat(0x1a1a1a, { metalness: 0.5 }), slow: Models.mat(0x80d0ff, { emissive: 0x3080ff, emissiveIntensity: 0.8 }), arrow: Models.mat(0x6a4a2a), bolt: Models.mat(0xd8b040, { metalness: 0.6 }) };
  function nearestEnemy(x, z, range) {
    let best = null, bd = range;
    for (const e of E) { if (e.dying || e.flee) continue; const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function fire(from, e, o) {
    const kind = o.kind;
    const mesh = new THREE.Mesh(projGeo[kind], o.slow ? projMat.slow : o.burn ? projMat.fire : o.red ? projMat.rocketRed : projMat[kind]); mesh.castShadow = false;
    scene.add(mesh);
    const speed = kind === 'ball' ? 22 : kind === 'bullet' ? 75 : kind === 'rocket' ? 24 : 40;
    const to = e.pos.clone(); const dist = from.distanceTo(to); const tFlight = dist / speed;
    to.x += Math.sin(e.yaw) * e.d.speed * tFlight * (e.mode === 'walk' ? 0.8 : 0); to.z += Math.cos(e.yaw) * e.d.speed * tFlight * (e.mode === 'walk' ? 0.8 : 0);
    to.y += 0.5;
    if (Net.isHost && !o.visual) fxQueue.push([kind, +from.x.toFixed(1), +from.y.toFixed(1), +from.z.toFixed(1), +to.x.toFixed(1), +to.y.toFixed(1), +to.z.toFixed(1), o.splash || 0, o.slow ? 1 : o.burn ? 2 : 0]);
    PR.push({ mesh, from: from.clone(), to, u: 0, dur: Math.max(0.1, tFlight), arc: kind === 'ball' ? dist * 0.12 : kind === 'rocket' ? dist * 0.15 : kind === 'bullet' ? 0 : dist * 0.03, target: e, ...o });
    mesh.position.copy(from);
  }
  function applyFx(e, p) {
    if (p.slow) e.slow = 2.5;
    if (p.stun && Math.random() < 0.25 && !e.d.boss) { e.stun = 1.2; UI.floatText(e.pos.clone().add(V(0, 1.8, 0)), '💫', '#fff'); }
    if (p.burn) e.burn = { dps: p.dmg * 0.35, t: 3 };
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
        dmg = L.dmg * bs.dmg * (S.hero === 'defender' ? 1.15 : S.hero === 'engineer' ? 1.25 : 1) * (S.hero === 'druid' && bird ? 1.25 : 1) * (bird && bs.special === 'night' && night ? 1.7 : 1);
        rate = L.rate * bs.rate; range = L.range * bs.range; splash = L.splash * (bird && bs.special === 'splash' ? 1.5 : 1); kind = L.kind || 'ball';
      } else if (b.t === 'ballista') { const L = BALLISTA_LEVELS[b.lvl - 1]; dmg = L.dmg * (S.hero === 'engineer' ? 1.25 : 1); rate = L.rate; range = L.range; splash = L.splash; kind = L.kind; }
      else { const D = BUILD[b.t]; dmg = D.dmg * (S.hero === 'engineer' ? 1.25 : 1); rate = D.rate; range = D.range; kind = 'arrow'; }
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
        if (!isCannon) { const ml = b.mesh.userData.muzzleL; tur.localToWorld(ml ? tv2.copy(ml) : tv2.set(0, 0, 0.7)); muzzle.copy(tv2); if (kind === 'bullet') { muzzle.x += rand(-0.15, 0.15); } }
        const bs = bird ? BIRDS[bird.sp] : {};
        let fd = dmg, crit = false;
        if (bs.special === 'crit' && Math.random() < 0.25) { fd *= 2.5; crit = true; }
        fire(muzzle, e, { kind, red: isCannon && kind === 'rocket', dmg: fd, splash, slow: bs.special === 'slow', crit, stun: bs.special === 'stun', burn: bs.special === 'burn' });
        if (bs.special === 'double') setTimeout(() => { if (!e.dying && G.state === 'play') fire(muzzle, e, { kind, dmg: fd * 0.8, splash, crit: false }); }, 140);
        if (isCannon && kind === 'rocket') { Sound.play('rocket'); spawnParticles(muzzle, 0xcccccc, 6, 1.5, 0.3, 0.7, -0.3); if (bird) bird.flap = 0.35; }
        else if (isCannon) {
          Sound.play('boom', 0.6);
          spawnParticles(muzzle, 0xdddddd, 5, 2, 0.3, 0.6, -0.5);
          spawnParticles(muzzle, 0xffa030, 3, 3, 0.18, 0.25, 0);
          if (bird) bird.flap = 0.35;
        } else if (kind === 'bullet') { Sound.play('gun'); if (Math.random() < 0.5) spawnParticles(muzzle, 0xffe070, 1, 1.5, 0.12, 0.08, 0); }
        else if (kind === 'rocket') { Sound.play('rocket'); spawnParticles(muzzle, 0xcccccc, 6, 1.5, 0.3, 0.7, -0.3); }
        else Sound.play('arrow');
      }
    }
    updateProjectiles(dt);
  }
  function updateProjectiles(dt) {
    for (let i = PR.length - 1; i >= 0; i--) {
      const p = PR[i];
      p.u += dt / p.dur;
      const u = Math.min(1, p.u);
      const prev = p.mesh.position.clone();
      p.mesh.position.lerpVectors(p.from, p.to, u); p.mesh.position.y += Math.sin(u * Math.PI) * p.arc;
      if (p.kind !== 'ball') { tv.subVectors(p.mesh.position, prev).normalize(); p.mesh.quaternion.setFromUnitVectors(V(0, 1, 0), tv); }
      if (p.kind === 'rocket' && Math.random() < 0.7) spawnParticles(p.mesh.position, Math.random() < 0.4 ? 0xffa030 : 0xbbbbbb, 1, 0.6, 0.25, 0.6, -0.2);
      if (p.burn && Math.random() < 0.4) spawnParticles(p.mesh.position, 0xff8a20, 1, 0.5, 0.15, 0.3, -0.3);
      if (u >= 1) {
        scene.remove(p.mesh); PR.splice(i, 1);
        if (p.splash > 0) {
          if (!p.visual) for (const e of E) { if (e.dying) continue; if (Math.hypot(e.pos.x - p.to.x, e.pos.z - p.to.z) < p.splash + e.d.radius) { hurtEnemy(e, p.dmg); applyFx(e, p); } }
          spawnParticles(p.to, p.slow ? 0x9adfff : 0xffa040, p.kind === 'rocket' ? 18 : 8, p.kind === 'rocket' ? 6 : 4, 0.26, 0.5);
          if (p.kind === 'rocket') spawnParticles(p.to, p.red ? 0xffe040 : 0x60d040, 8, 5, 0.2, 0.5);
          spawnParticles(p.to, 0x8a7a6a, 6, 2.5, 0.3, 0.8);
          Sound.play('boom', 0.35);
        } else {
          const e = p.visual ? null : p.target && !p.target.dying && p.target.pos.distanceTo(p.to) < 2.5 ? p.target : nearestEnemy(p.to.x, p.to.z, 1.6);
          if (e) { hurtEnemy(e, p.dmg); applyFx(e, p); }
        }
        if (p.crit) UI.floatText(p.to.clone().add(V(0, 1.5, 0)), tr('crit'), '#ff5050');
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
    const ar = S.gear && S.gear.armor && ARMOR[S.gear.armor];
    P.hp -= dmg * (HEROES[S.hero].armor || 1) * (ar ? 1 - ar.red : 1); P.lastHurt = time;
    Sound.play('hurt'); UI.flash();
    if (P.hp <= 0) {
      P.hp = 0; P.dead = 5; P.mesh.rotation.x = -Math.PI / 2;
      UI.toast(tr('you_down'), 'bad', 4500);
    }
  }
  function nodeOK(n) {
    const info = NODE_INFO[n.kind];
    if (info.tool === 'pick' && S.tools.pick < info.minPick) {
      if (time - P.hintT > 3) { P.hintT = time; UI.toast(S.tools.pick < 0 ? tr('need_pick') : tr(info.minPick >= 2 ? 'need_pick3' : 'need_pick2'), 'warn'); }
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
    if (t.n) setTool(NODE_INFO[t.n.kind].tool === 'pick' ? 'pick' : 'axe'); else setTool('weapon');
    P.swing = 0.0001; P.swingTarget = t; P.hitDone = false;
    const tx = t.e ? t.e.pos.x : t.n.x, tz = t.e ? t.e.pos.z : t.n.z;
    P.yaw = Math.atan2(tx - P.pos.x, tz - P.pos.z);
  }
  function applyHit(t) {
    const hero = HEROES[S.hero];
    if (t.e) {
      if (t.e.dying) return;
      const st = G.swordTier();
      hurtEnemy(t.e, hero.dmg * (st >= 0 ? SWORDS[st].mul : 0.9 + S.tools.axe * 0.35));
      Sound.play('hit'); spawnParticles(t.e.pos.clone().add(V(0, 0.7, 0)), 0xffffff, 4, 2.5, 0.14, 0.4);
      return;
    }
    const n = t.n; if (!n.alive) return;
    const info = NODE_INFO[n.kind];
    const pos = V(n.x, n.y + 1.6, n.z);
    if (n.kind === 'berry') {
      Sound.play('pickup');
      if (Net.isClient) { Net.toHost({ c: 'hitNode', i: n.idx, p: 1 }); return; }
      addRes('food', info.ratio, pos); killNode(n); return;
    }
    const power = (info.tool === 'axe' ? AXES[S.tools.axe].power : PICKS[S.tools.pick].power) * hero.gather;
    if (Net.isClient) { // ресурсы общие — добычу засчитывает хост
      Net.toHost({ c: 'hitNode', i: n.idx, p: power }); n.shake = 0.3; World.updateNodeMatrix(n);
      Sound.play(n.kind === 'tree' ? 'chop' : 'mine');
      spawnParticles(V(n.x, n.y + (n.kind === 'tree' ? 1.0 : 0.7), n.z), n.kind === 'tree' ? 0xc89a5e : 0x9a9a96, 5, 3, 0.14, 0.6);
      return;
    }
    hostHitNode(n, power, pos);
  }
  function hostHitNode(n, power, pos) {
    const info = NODE_INFO[n.kind]; if (!n.alive) return;
    if (n.kind === 'berry') { addRes('food', info.ratio, pos); killNode(n); return; }
    const dmg = Math.min(n.hp, power);
    n.hp -= dmg; n.acc += dmg * info.ratio;
    const whole = Math.floor(n.acc); if (whole > 0) { n.acc -= whole; addRes(info.res, whole, pos); }
    n.shake = 0.3;
    Sound.play(n.kind === 'tree' ? 'chop' : 'mine');
    spawnParticles(V(n.x, n.y + (n.kind === 'tree' ? 1.0 : 0.7), n.z), n.kind === 'tree' ? 0xc89a5e : (n.kind === 'coal' ? 0x222222 : n.kind === 'iron' ? 0xc87a40 : n.kind === 'ruby' ? 0xe0204a : 0x9a9a96), 5, 3, 0.14, 0.6);
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
      if (P.dead <= 0) { P.dead = 0; P.hp = P.maxHp; P.pos.set(0, 0, 5); m.rotation.x = 0; UI.toast(tr('back_in_action'), 'good'); }
      m.position.set(P.pos.x, World.groundAt(P.pos.x, P.pos.z) + 0.3, P.pos.z);
      return;
    }
    // регенерация
    if (time - P.lastHurt > 5) P.hp = Math.min(P.maxHp, P.hp + dt * (S.hero === 'defender' ? 4 : 2));
    // движение относительно камеры
    let ix = input.mx, iz = input.mz; const mag = Math.min(1, Math.hypot(ix, iz));
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix; const ml = Math.hypot(mx, mz);
    const wantRun = input.run && mag > 0.1 && !P.tired;
    if (wantRun) { P.st -= 20 * dt; P.stRest = 0.8; if (P.st <= 0) { P.st = 0; P.tired = true; input.run = false; UI.toast(tr('exhausted'), 'warn'); } }
    else { P.stRest -= dt; if (P.stRest <= 0) P.st = Math.min(P.maxSt, P.st + 20 * dt); if (P.tired && P.st > P.maxSt * 0.3) P.tired = false; }
    const running = wantRun && P.st > 0;
    P.moving = 0;
    if (ml > 0.08) {
      mx /= ml; mz /= ml;
      let spd = hero.speed * (running ? 1.65 : 1) * Math.max(0.35, mag);
      if (World.inWater(P.pos.x, P.pos.z)) spd *= 0.55;
      if (P.swing > 0) spd *= 0.6;
      P.pos.x += mx * spd * dt; P.pos.z += mz * spd * dt;
      if (P.swing <= 0 && !isFP()) P.yaw = Math.atan2(mx, mz);
      P.moving = running ? 2 : 1;
    }
    if (isFP() && P.swing <= 0) P.yaw = cam.yaw + Math.PI;
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
    if (hero.bowRange) {
      P.bowCd = (P.bowCd || 0) - dt;
      if (P.bowCd <= 0 && P.swing <= 0) {
        const e = nearestEnemy(P.pos.x, P.pos.z, hero.bowRange);
        if (e) {
          P.bowCd = 1 / hero.atkRate; setTool('hw');
          P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
          fire(V(P.pos.x, P.pos.y + 1.5, P.pos.z), e, { kind: 'arrow', dmg: hero.dmg, splash: 0 });
          Sound.play('arrow');
        }
      }
    }
    if (input.action || G.settings.autoAct) playerAct();
    if (P.swing > 0) {
      P.swing += dt / (1 / hero.atkRate * 0.85);
      if (!P.hitDone && P.swing > 0.5) { P.hitDone = true; applyHit(P.swingTarget); }
      if (P.swing >= 1) { P.swing = 0; P.atkCd = 0.08; }
    }
    // позиция и анимация
    m.position.copy(P.pos);
    let dy = P.yaw - m.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    m.rotation.y += dy * Math.min(1, dt * 14);
    P.animT += dt;
    Models.animHero(m, P.moving === 2 ? 'run' : (P.moving ? 'walk' : 'idle'), P.animT, hero.speed / 6, P.swing);
  }
  G.buyGear = function (id) {
    if (!S.gear) S.gear = { own: {}, eq: null };
    if (S.gear.own[id]) return G.equipGear(id);
    if (Net.isClient) { if (!G.canAfford(GEAR[id].cost)) { UI.toast(tr('not_enough') + G.missing(GEAR[id].cost), 'warn'); return false; } Net.toHost({ c: 'spend', cost: GEAR[id].cost }); }
    else if (!tryPay(GEAR[id].cost)) return false;
    S.gear.own[id] = true; Sound.play('upgrade'); UI.toast(tr('gear_bought', { name: GEAR[id].name }), 'good');
    return G.equipGear(id);
  };
  G.equipGear = function (id) {
    S.gear.eq = S.gear.eq === id ? null : id;
    Models.setGear(P.mesh, S.gear.eq); Sound.play('click');
    return true;
  };
  // Броня: покупка один раз, носится одна
  G.buyArmor = function (id) {
    if (!S.gear) S.gear = { own: {}, eq: null };
    const a = ARMOR[id]; if (!a) return false;
    if (!S.gear.own['a_' + id]) {
      if (a.req && !S.tech[a.req]) { UI.toast(tr('need_tech_t', { name: TECH[a.req].name }), 'warn'); Sound.play('error'); return false; }
      if (Net.isClient) { if (!G.canAfford(a.cost)) { UI.toast(tr('not_enough') + G.missing(a.cost), 'warn'); return false; } Net.toHost({ c: 'spend', cost: a.cost }); }
      else if (!tryPay(a.cost)) return false;
      S.gear.own['a_' + id] = true; Sound.play('upgrade'); UI.toast(tr('gear_bought', { name: a.name }), 'good');
    } else Sound.play('click');
    S.gear.armor = S.gear.armor === id ? null : id;
    Models.setArmor(P.mesh, S.gear.armor);
    return true;
  };
  // Тестовый промокод: по 1000 каждого ресурса (сверх лимита склада)
  G.promo = function (code) {
    const cc = (code || '').trim().toUpperCase();
    if (cc === 'DAY49') { // тест концовки: +49 дней
      if (Net.isClient) { UI.toast('Промокод вводит хост', 'warn'); return false; }
      S.day += 49; UI.toast('📅 +49 дней! День ' + S.day, 'good'); Sound.play('upgrade');
      if (S.day >= GOAL_DAYS && !S.won) { UI.closeModal && UI.closeModal(); startCutscene(); }
      return true;
    }
    if (cc !== 'BIRD1000') { UI.toast('Неверный промокод', 'warn'); Sound.play('error'); return false; }
    if (Net.isClient) { UI.toast('Промокод вводит хост', 'warn'); return false; }
    for (const k in RES_INFO) S.res[k] = (S.res[k] || 0) + 1000;
    Sound.play('upgrade'); UI.toast('🎁 +1000 всех ресурсов!', 'good'); return true;
  };
  G.eat = function () {
    if (S.res.food < 3) { UI.toast(tr('need_food'), 'warn'); Sound.play('error'); return; }
    if (P.hp >= P.maxHp) { UI.toast(tr('hp_full'), 'info'); return; }
    if (Net.isClient) Net.toHost({ c: 'spend', cost: { food: 3 } });
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
    const T = LEVELS[b.t]; if (T && b.lvl < T.length) { const L = T[b.lvl]; return { cost: G.scaleCost(L.cost), req: L.req, name: L.name }; }
    return null;
  };
  G.upgrade = function (b) {
    const u = G.upgradeCost(b); if (!u) return false;
    if (u.req && !S.tech[u.req]) { UI.toast(tr('need_tech_t', { name: TECH[u.req].name }), 'warn'); Sound.play('error'); return false; }
    if (!tryPay(u.cost)) return false;
    const frac = b.hp / b.maxHp; void frac;
    b.lvl++; b.maxHp = maxHpOf(b); b.hp = b.maxHp;
    buildMesh(b);
    if (b.cannonId && byId[b.cannonId]) buildMesh(byId[b.cannonId]);
    Sound.play('upgrade'); spawnParticles(V(b.x, b.mesh.position.y + 2, b.z), 0xffe066, 16, 4, 0.18, 1);
    UI.toast(tr('upgraded', { name: G.buildingLabel(b) }), 'good');
    return true;
  };
  G.repairCost = function (b) {
    if (b.hp >= b.maxHp) return null;
    const miss = 1 - b.hp / b.maxHp;
    if (b.t === 'core') return { wood: Math.ceil(miss * 80) };
    const base = LEVELS[b.t] ? LEVELS[b.t][b.lvl - 1].cost : BUILD[b.t].cost;
    const o = {}; for (const k in base) if (k !== 'coins') o[k] = Math.max(1, Math.ceil(base[k] * miss * 0.6 * costMul()));
    if (!Object.keys(o).length) o.wood = Math.ceil(miss * 10);
    return o;
  };
  G.repair = function (b) {
    const c = G.repairCost(b); if (!c) return;
    if (!tryPay(c)) return;
    b.hp = b.maxHp; Sound.play('build'); spawnParticles(V(b.x, b.mesh.position.y + 1.5, b.z), 0x80ff80, 10, 3, 0.15, 0.8);
    UI.toast(tr('repaired'), 'good');
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
    if (!G.hasWorkshop()) { UI.toast(tr('build_ws_first'), 'warn'); return false; }
    const list = { axe: AXES, pick: PICKS, sword: SWORDS }[kind]; if (!list) return false;
    const cur = kind === 'sword' ? G.swordTier() : S.tools[kind]; const next = list[cur + 1];
    if (!next) return false;
    if (next.req && !S.tech[next.req]) { UI.toast(tr('need_tech_t', { name: TECH[next.req].name }), 'warn'); Sound.play('error'); return false; }
    if (!tryPay(next.cost)) return false;
    S.tools[kind] = cur + 1; P.toolTier = -9; setTool(kind === 'sword' ? 'weapon' : kind);
    Sound.play('upgrade'); UI.toast(tr('crafted', { name: next.name }), 'good');
    return true;
  };
  G.research = function (id) {
    if (!G.hasWorkshop()) { UI.toast(tr('build_ws_first'), 'warn'); return false; }
    const tt = TECH[id]; if (S.tech[id]) return false;
    if (tt.need && !S.tech[tt.need]) { UI.toast(tr('research_first', { name: TECH[tt.need].name }), 'warn'); Sound.play('error'); return false; }
    if (!tryPay(tt.cost)) return false;
    S.tech[id] = true; Sound.play('win'); UI.toast(tr('researched', { name: tt.name }), 'good', 3000);
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
    if (d.req && !S.tech[d.req]) { UI.toast(tr('need_tech_ws', { name: TECH[d.req].name }), 'warn'); Sound.play('error'); return false; }
    if (G.countB(t) >= G.maxOf(t)) { UI.toast(tr('limit_t', { name: d.name, n: G.maxOf(t) }), 'warn'); Sound.play('error'); return false; }
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
      for (const b of B) { if (b.onWall) continue; const s2 = WALLISH[t] && WALLISH[b.t] ? 0.75 : sh; if (minx + s2 < b.maxx && maxx - s2 > b.minx && minz + s2 < b.maxz && maxz - s2 > b.minz) { valid = false; reason = tr('occupied'); break; } }
      if (valid) for (const n of World.nodesNear(x, z, 6, nearTmp)) { if (!n.alive) continue; const cx = clamp(n.x, minx, maxx), cz = clamp(n.z, minz, maxz); if (Math.hypot(n.x - cx, n.z - cz) < n.r * 0.8) { valid = false; reason = tr('blocked_by', { name: NODE_INFO[n.kind].name }); break; } }
      const by = baseY(t, x, z, rot);
      if (valid && by.min < World.WATER_Y + 0.1) { valid = false; reason = tr('in_water'); }
      if (valid && by.max - by.min > 1.6) { valid = false; reason = tr('too_steep'); }
      if (valid && Math.hypot(x, z) > 160) { valid = false; reason = tr('too_far'); }
      if (valid && Math.hypot(P.pos.x - x, P.pos.z - z) < 0.5) { valid = false; reason = tr('step_away'); }
      if (valid && t === 'minelift' && !World.inMine(x, z)) { valid = false; reason = tr('quarry_only'); }
      if (valid && P.pos.x > minx - 0.35 && P.pos.x < maxx + 0.35 && P.pos.z > minz - 0.35 && P.pos.z < maxz + 0.35 && !PASS_PLAYER[t]) { valid = false; reason = tr('standing_here'); }
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
    if (!build.valid) { UI.toast(build.reason || tr('cant_build'), 'warn'); Sound.play('error'); return; }
    const t = build.t, cost = G.scaleCost(BUILD[t].cost);
    if (G.countB(t) >= G.maxOf(t)) { UI.toast(tr('limit_t', { name: BUILD[t].name, n: G.maxOf(t) }), 'warn'); Sound.play('error'); G.cancelBuild(); return; }
    const rot = build.onWall ? build.onWall.rot : (build.prot != null ? build.prot : build.rot);
    if (Net.isClient) { // строит хост, гость видит результат в следующем обновлении
      if (!G.canAfford(cost)) { UI.toast(tr('not_enough') + G.missing(cost), 'warn'); Sound.play('error'); return; }
      Net.toHost({ c: 'place', t, x: build.x, z: build.z, r: rot, w: build.onWall ? build.onWall.id : 0 });
      Sound.play('build'); spawnParticles(V(build.x, P.pos.y + 0.3, build.z), 0xc8b090, 14, 3, 0.35, 0.9);
      if (BUILD[t].max === 1) G.cancelBuild();
      return;
    }
    doPlace(t, build.x, build.z, rot, build.onWall ? build.onWall.id : 0);
  };
  function doPlace(t, x, z, rot, wallId) {
    const cost = G.scaleCost(BUILD[t].cost);
    if (G.countB(t) >= G.maxOf(t)) return;
    if (wallId && (!byId[wallId] || byId[wallId].cannonId)) return;
    if (!tryPay(cost)) return;
    let b;
    if (wallId) b = addBuilding('cannon', x, z, byId[wallId].rot, 1, null, wallId);
    else b = addBuilding(t, x, z, rot);
    S.stats.built++;
    Sound.play('build');
    spawnParticles(V(b.x, b.mesh.position.y + 0.3, b.z), 0xc8b090, 14, 3, 0.35, 0.9);
    if (t === 'cannon') { const bird = BD.find(x => !x.cannon); if (bird) G.assignBird(bird, b); else UI.toast(tr('buy_for_cannon'), 'info', 3500); }
    if (build && build.t === t && G.countB(t) >= G.maxOf(t)) { G.cancelBuild(); if (BUILD[t].max > 1) UI.toast(tr('limit_done', { name: BUILD[t].name, n: G.maxOf(t) }), 'info'); }
  }

  // ---------------- Производство ----------------
  function updateLights(dt) {
    const night = Math.max(0, Math.min(1, 1 - World.daylight * 2.2));
    const eq = S.gear && S.gear.eq;
    gearPoint.intensity = eq === 'lamp' && !P.dead ? night * 1.25 : (eq === 'helmet' && !P.dead ? night * 0.35 : 0);
    gearPoint.position.set(P.pos.x, P.mesh.position.y + 1.7, P.pos.z);
    if (eq === 'helmet' && !P.dead && night > 0) {
      gearSpot.intensity = night * 3.2;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), pitch = isFP() ? cam.fp : -0.35;
      gearSpot.position.set(P.pos.x, P.mesh.position.y + 2.0, P.pos.z);
      gearSpot.target.position.set(P.pos.x + fx * 20 * Math.cos(pitch), P.mesh.position.y + 2.0 + Math.sin(pitch) * 20, P.pos.z + fz * 20 * Math.cos(pitch));
    } else gearSpot.intensity = 0;
    for (const b of B) { const f = b.mesh.userData.fire; if (f) { f.scale.set(1 + Math.sin(time * 13 + b.id) * 0.08, 1 + Math.sin(time * 9 + b.id * 2) * 0.15, 1); } }
    lightT -= dt;
    if (lightT <= 0) {
      lightT = 0.3;
      const lamps = B.filter(b => b.mesh.userData.lightPos).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
      lightPool.forEach((l, i) => { const b = lamps[i]; l.userData.b = b || null; if (b) l.position.copy(b.mesh.localToWorld(b.mesh.userData.lightPos.clone())); });
    }
    for (const b of B) {
      const bm = b.mesh.userData.beams; if (!bm) continue;
      b.mesh.userData.beamMat.opacity = night * 0.16;
      bm.forEach(hd => { hd.rotation.y = Math.sin(time * 0.35 + hd.userData.phase) * 0.55; hd.visible = true; });
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
      if (b.t === 'mineshaft') {
        const L = SHAFT_LEVELS[b.lvl - 1], near = Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 25;
        b.prodT += dt; b.prod2 += dt; b.prod3 += dt;
        if (b.prodT >= L.stone) { b.prodT = 0; addRes('stone', 1, near ? V(b.x, b.y + 2.5, b.z) : null); }
        if (b.prod2 >= L.coal) { b.prod2 = 0; addRes('coal', 1, near ? V(b.x, b.y + 3.1, b.z) : null); }
        if (b.prod3 >= L.iron) { b.prod3 = 0; addRes('iron', 1, near ? V(b.x, b.y + 3.7, b.z) : null); }
        if (b.mesh.userData.spin) b.mesh.userData.spin.rotation.z += dt * 2;
        if (b.mesh.userData.gear) b.mesh.userData.gear.rotation.y += dt * 3;
      }
      if (b.t === 'minelift') {
        const L = LIFT_LEVELS[(b.lvl || 1) - 1];
        b.prodT += dt; b.prod2 += dt; b.prod3 += dt; b.prod4 = (b.prod4 || 0) + dt;
        const near = Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 25;
        if (b.prodT >= L.stone) { b.prodT = 0; addRes('stone', 1, near ? V(b.x, b.y + 2, b.z) : null); }
        if (b.prod2 >= L.coal) { b.prod2 = 0; addRes('coal', 1, near ? V(b.x, b.y + 2.6, b.z) : null); }
        if (L.iron && b.prod3 >= L.iron) { b.prod3 = 0; addRes('iron', 1, near ? V(b.x, b.y + 3.2, b.z) : null); }
        if (L.ruby && b.prod4 >= L.ruby) { b.prod4 = 0; addRes('ruby', 1, near ? V(b.x, b.y + 3.8, b.z) : null); }
        if (b.mesh.userData.spin) b.mesh.userData.spin.rotation.z += dt * 2;
      }
      if (S.hero === 'engineer' && b.hp < b.maxHp && Math.hypot(P.pos.x - b.x, P.pos.z - b.z) < 15) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.015 * dt);
      if (S.hero === 'druid' && b.t === 'core' && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + 2 * dt);
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
      UI.toast(tr('quest_done', { q: q.text, r: q.reward }), 'good', 4000); Sound.play('win');
    }
  }
  G.questText = () => { const q = QUESTS[S.quest]; return q ? q.text : tr('quest_free'); };
  G.questTarget = () => { const i = S.quest; if (i === 5 || i === 10) return World.MINE; return null; };

  // ---------------- Камера ----------------
  const isFP = () => G.settings.view === 'first';
  G.isFP = isFP;
  G.camRotate = (dx, dy) => { cam.yaw -= dx; if (isFP()) cam.fp = clamp(cam.fp - dy * 1.2, -1.35, 1.2); else cam.pitch = clamp(cam.pitch + dy, 0.3, 1.3); };
  // Вид от первого лица: руки с инструментом прикреплены к камере
  let vm = null, vmKey = '';
  function updateViewModel(dt) {
    const fp = isFP();
    if (!vm) { vm = new THREE.Group(); camera.add(vm); scene.add(camera); }
    vm.visible = fp && !P.dead;
    if (!fp) return;
    const key = S.hero + P.toolModel + P.toolTier;
    if (key !== vmKey) {
      vmKey = key; while (vm.children.length) vm.remove(vm.children[0]);
      const look = { defender: [0x3d7a3a, 0xf1c7a0], builder: [0xe8b890, 0xe8b890], hunter: [0x8a5a32, 0xf3cfa8], knight: [0x9aa0aa, 0xf0c4a0], ranger: [0x2f5a3a, 0xe8c09a], engineer: [0x3a5a8a, 0xd8a888], druid: [0x5a3a8a, 0xf0d0b0] }[S.hero] || [0x3d7a3a, 0xf1c7a0];
      // Та же рука, что у героя от 3-го лица: плечо → рука → кисть с инструментом.
      // rig развёрнут на 180°, чтобы «вперёд» героя совпадало со взглядом камеры.
      const rig = new THREE.Group(); rig.rotation.y = Math.PI; vm.add(rig); vm.userData.rig = rig;
      const arm = new THREE.Group(); rig.add(arm); vm.userData.arm = arm;
      Models.box(0.16, 0.36, 0.18, look[0], 0, -0.16, 0, arm, false);
      Models.box(0.14, 0.26, 0.16, S.hero === 'builder' ? look[1] : look[0], 0, -0.44, 0, arm, false);
      Models.sph(0.15, 0.15, 0.15, look[1], 0, -0.6, 0, arm, true, false);
      const hand = Models.group(arm, 0, -0.62, 0.02); hand.rotation.set(-0.75, 0, -0.35);
      hand.add(Models.makeTool(P.toolModel || 'axe', P.toolTier));
      arm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    }
    const rig = vm.userData.rig, arm = vm.userData.arm, sw = P.swing;
    const bob = P.moving ? Math.sin(P.animT * 10) * 0.025 : Math.sin(P.animT * 2) * 0.006;
    // Удар копирует анимацию героя от 3-го лица (Models.animHero): замах инструментом над головой
    // до 40% взмаха, затем резкий удар вниз. Базовый наклон держит руку с инструментом в кадре.
    let ax = 0, twist = 0;
    if (sw > 0) {
      const s1 = sw < 0.4 ? sw / 0.4 : 1 - (sw - 0.4) / 0.6;
      ax = sw < 0.4 ? -2.6 * s1 : -2.6 + 3.2 * Math.min(1, (sw - 0.4) / 0.25);
      twist = sw < 0.4 ? -0.3 * s1 : 0.3 * (1 - s1);
    }
    const BASE = -1.15;
    rig.position.set(0.46 + bob * 0.5, -0.6 + Math.abs(bob), -0.62);
    rig.rotation.set(0, Math.PI + twist * 0.6, 0);
    arm.rotation.set(BASE + ax * 0.6, 0, 0.22);
    // лёгкая отдача камеры в момент удара
    const kick = sw > 0.5 && sw < 0.7 ? Math.sin((sw - 0.5) / 0.2 * Math.PI) * 0.02 : 0;
    vm.userData.kick = kick;
  }
  G.camZoom = d => { cam.dist = clamp(cam.dist + d, 6, 24); };
  function updateCamera(dt) {
    cam.yaw -= input.camX * dt * 2.6;
    updateViewModel(dt);
    if (isFP()) {
      cam.fp = clamp(cam.fp - input.camY * dt * 1.6, -1.35, 1.2);
      P.mesh.visible = !!P.dead;
      const bob = P.moving && !P.dead ? Math.abs(Math.sin(P.animT * 10)) * 0.06 : 0;
      camera.position.set(P.pos.x, P.mesh.position.y + (P.dead ? 0.5 : 1.62) + bob, P.pos.z);
      camera.rotation.set(cam.fp - (vm && vm.userData.kick || 0), cam.yaw, 0, 'YXZ');
      if (camera.near !== 0.08) { camera.near = 0.08; camera.updateProjectionMatrix(); }
      return;
    }
    P.mesh.visible = true;
    if (camera.near !== 0.3) { camera.near = 0.3; camera.updateProjectionMatrix(); }
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
  G.worldInfo = () => ({ seed: World.seed, biome: World.biome.name });

  // ---------------- Главный цикл ----------------
  let skyT = 0;
  // Авто-разрешение: если кадр стабильно дольше ~22 мс, немного снижаем чёткость; если запас — возвращаем
  let dynScale = 1, perfAcc = 0, perfN = 0, shadowTick = 0;
  function autoPerf(dt) {
    if (G.settings.resolution && G.settings.resolution !== 'auto') return;
    perfAcc += dt; perfN++;
    if (perfAcc < 2) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    const prev = dynScale;
    if (avg > 0.022 && dynScale > 0.7) dynScale = Math.max(0.7, dynScale - 0.1);
    else if (avg < 0.0175 && dynScale < 1) dynScale = Math.min(1, dynScale + 0.05);
    if (dynScale !== prev) G.resize();
  }
  // После победы: плавные пролёты над базой с разных ракурсов (сменяются каждые ~9 с)
  let flyT = 0, flyFade = false;
  const FLY = [
    t => [Math.cos(t * 0.12) * 42, 26 + Math.sin(t * 0.3) * 3, Math.sin(t * 0.12) * 42, 0, 2, 0],         // высокий облёт
    t => [-55 + t * 3.2, 9, 30, 0, 3, 0],                                                                   // низкий пролёт сбоку
    t => [Math.cos(t * 0.08 + 2) * 18, 48 - t * 1.2, Math.sin(t * 0.08 + 2) * 18, 0, 0, 0],                  // спуск сверху
    t => [Math.cos(-t * 0.15 + 4) * 26, 12, Math.sin(-t * 0.15 + 4) * 26, 0, 4, 0],                        // близкий облёт стен
  ];
  function winFlyby(dt) {
    flyT += dt; flyFade = true; document.body.classList.add('cutscene'); // прячем HUD — видна только база
    const seg = Math.floor(flyT / 9) % FLY.length, t = flyT % 9;
    const [x, y, z, lx, ly, lz] = FLY[seg](t);
    const target = V(x, Math.max(y, World.groundAt(x, z) + 4), z);
    if (t < dt * 1.5) camera.position.copy(target); else camera.position.lerp(target, 1 - Math.exp(-dt * 3));
    camera.lookAt(lx, ly, lz);
    if (vm) vm.visible = false;
    // плавная смена ракурса: затемнение на стыках
    const f = Math.min(t, 9 - t); document.getElementById('flash').style.cssText = f < 0.6 ? `opacity:${(1 - f / 0.6) * 0.85};background:#000` : '';
  }
  G.frame = function (dt) {
    time += dt;
    autoPerf(dt);
    // тени: каждый 2-й кадр (на «ПК» — каждый)
    if (renderer) { shadowTick++; if (G.settings.quality === 'pc' || shadowTick % 2 === 0) renderer.shadowMap.needsUpdate = true; }
    if (G.state === 'menu' || G.state === 'loading' || G.state === 'bye') {
      if (flyFade) { flyFade = false; flyT = 0; document.body.classList.remove('cutscene'); document.getElementById('flash').style.cssText = ''; }
      if (vm) vm.visible = false;
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
      Models.animBird(menuBird, 'fly', time);
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
    if (G.state === 'cutscene') {
      if (!G.paused || Net.active) updateCutscene(dt);
      renderer.render(scene, camera);
      return;
    }
    if (G.state === 'play' || G.state === 'over') {
      if (G.state === 'play' && (!G.paused || Net.active)) { const k = !Net.isClient && S.speed === 2 ? 2 : 1; for (let i = 0; i < k; i++) update(dt); } // x2: два шага симуляции
      if (G.state === 'over' && S && S.won) winFlyby(dt); else updateCamera(dt);
      renderer.render(scene, camera);
      if (G.state === 'play') UI.hud(dt);
    }
  };
  // На «Невозможной» — вечная ночь (дни всё равно считаются), светает только в финале
  const eternalNight = () => S && S.diff === 'impossible';
  G.eternalNight = eternalNight;
  const skyTime = () => eternalNight() ? 0.75 : S.dayTime;
  function update(dt) {
    if (Net.isClient) { clientUpdate(dt); return; }
    S.stats.time = (S.stats.time || 0) + dt;
    S.dayTime += dt / 300; if (S.dayTime >= 1) { S.dayTime -= 1; S.day++; UI.toast(tr('new_day', { n: S.day }), 'info'); if (S.day >= GOAL_DAYS && !S.won) { startCutscene(); return; } }
    const dl = World.updateSky(skyTime(), V(P.pos.x, 0, P.pos.z), dt, time);
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
    updatePuppets(dt);
    if (Net.isHost) hostTick(dt);
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
  G.boss = () => E.find(e => e.d.boss && !e.dying) || null;
  G.dayClock = () => { const t = S.dayTime, night = t >= 0.5; return { night, left: Math.ceil(((night ? 1 : 0.5) - t) * 300) }; };
  G.enemiesLeft = () => Net.isClient ? (S._left || 0) : E.filter(e => !e.dying && !e.flee).length + (S.spawnList ? S.spawnList.length : 0);

  // ---------------- Конец игры ----------------
  // ---------------- Золотые птицы (сохраняются между прохождениями) ----------------
  const META_KEY = 'birdwars_meta_v1';
  G.meta = { gb: 0, unlocked: [], wins: 0 };
  try { Object.assign(G.meta, JSON.parse(localStorage.getItem(META_KEY)) || {}); } catch (e) { }
  const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(G.meta)); } catch (e) { } };
  G.heroUnlocked = id => !HEROES[id].price || G.meta.unlocked.includes(id);
  G.buyHero = function (id) {
    const h = HEROES[id]; if (G.heroUnlocked(id)) return true;
    if (G.meta.gb < h.price) { UI.toast(tr('hero_noGB'), 'warn'); Sound.play('error'); return false; }
    G.meta.gb -= h.price; G.meta.unlocked.push(id); saveMeta();
    Sound.play('win'); UI.toast(tr('hero_bought', { name: h.name }), 'good'); return true;
  };
  function awardGB(n) { n = Math.max(1, Math.round(n)); G.meta.gb += n; saveMeta(); return n; }
  function runStats() { return Object.assign({ wave: S.wave, day: S.day, hero: S.hero, diff: S.diff, seed: S.seed, biome: World.biome.name }, S.stats); }

  function gameOver() {
    G.state = 'over'; Sound.play('lose'); Sound.setMode('calm');
    if (Net.isHost) Net.broadcast({ ev: 'end', win: false });
    if (!Net.isClient) G.deleteSave(G.slot); // поражение: прохождение начинается заново
    const gb = awardGB(Math.floor(S.day / 3) * (DF().tokens || 1));
    UI.gameOver(Object.assign(runStats(), { gb, gbTotal: G.meta.gb }));
  }
  function victory() {
    G.state = 'over'; Sound.play('win'); Sound.setMode('calm');
    if (!Net.isClient) G.deleteSave(G.slot);
    G.meta.wins = (G.meta.wins || 0) + 1;
    const gb = awardGB(10 * (DF().tokens || 1));
    UI.gameOver(Object.assign(runStats(), { gb, gbTotal: G.meta.gb, win: true }));
  }

  // ---------------- Финал: вертолёт забирает героя и улетает в закат ----------------
  let cut = null;
  function startCutscene() {
    S.won = true;
    if (Net.isHost) Net.broadcast({ ev: 'cutscene' });
    G.cancelBuild();
    S.waveActive = false; S.spawnList = [];
    E.forEach(e => { if (!e.dying) { e.dying = 1.6; } });
    G.state = 'cutscene'; Sound.setMode('calm');
    UI.cutscene(true);
    UI.toast(tr('heli_coming'), 'good', 5000);
    const heli = Models.makeHelicopter(); scene.add(heli);
    // площадка посадки — рядом с героем, на ровной земле базы
    const land = V(P.pos.x + 4, 0, P.pos.z + 1); land.y = World.groundAt(land.x, land.z);
    // солнце садится с этой стороны (0.47 дня), туда вертолёт и улетит
    const night = eternalNight(), skyTo = night ? 1.06 : 0.492;
    const a = (night ? 0.06 : 0.492) * Math.PI * 2, sunDir = V(Math.cos(a) * 0.8, 0, 0.45).normalize();
    const start = land.clone().addScaledVector(sunDir, -110); start.y = land.y + 40;
    heli.position.copy(start);
    if (night) setTimeout(() => UI.toast(tr('dawn_comes'), 'good', 4000), 6000);
    cut = { t: 0, heli, land, start, sunDir, skyTo, day0: skyTime(), rotorT: 0, heroGone: false, camPos: camera.position.clone() };
  }
  function updateCutscene(dt) {
    const c = cut; if (!c) return;
    c.t += dt; time += dt; const t = c.t, h = c.heli, ease = x => x * x * (3 - 2 * x);
    // небо плавно переходит в закат
    const sky = (c.day0 + (c.skyTo - c.day0) * Math.min(1, t / 10)) % 1;
    World.updateSky(sky, V(c.land.x, 0, c.land.z), dt, time);
    updateParticles(dt); updateEnemies(dt); updateBirds(dt); updateLights(dt);
    // винты
    h.userData.rotor.rotation.y += dt * 28; h.userData.tailRotor.rotation.x += dt * 34;
    c.rotorT -= dt; if (c.rotorT <= 0) { c.rotorT = 0.11; Sound.play('rotor', Math.max(0.15, 1 - h.position.distanceTo(camera.position) / 120)); }
    const hover = V(c.land.x, c.land.y + 12, c.land.z);
    const look = (from, to) => { const d = to.clone().sub(from); if (d.lengthSq() > 1e-4) h.rotation.y = Math.atan2(d.x, d.z); };
    let target;
    if (t < 7) { const u = ease(t / 7); target = c.start.clone().lerp(hover, u); look(h.position, hover); h.rotation.z = Math.sin(t) * 0.05; }
    else if (t < 10) { target = hover.clone().lerp(c.land, ease((t - 7) / 3)); }
    else if (t < 13) { target = c.land.clone(); }
    else if (t < 16) { target = c.land.clone().lerp(hover.clone().setY(c.land.y + 16), ease((t - 13) / 3)); }
    else { const u = (t - 16) / 9; target = V(c.land.x, c.land.y + 16, c.land.z).addScaledVector(c.sunDir, u * u * 260); target.y += u * 8; h.rotation.y += ((Math.atan2(c.sunDir.x, c.sunDir.z)) - h.rotation.y) * Math.min(1, dt * 1.5); h.rotation.x = 0.18; }
    h.position.copy(target);
    // герой идёт к вертолёту и садится в него
    if (t >= 10 && t < 12.6) {
      const door = c.land.clone().add(V(-1.9, 0, -0.4));
      const d = door.clone().sub(P.pos); d.y = 0; const dist = d.length();
      if (dist > 0.15) { P.pos.addScaledVector(d.normalize(), Math.min(dist, dt * 3.2)); P.yaw = Math.atan2(d.x, d.z); }
      P.pos.y = World.groundAt(P.pos.x, P.pos.z);
      P.mesh.position.copy(P.pos); P.mesh.rotation.y = P.yaw; P.animT += dt;
      Models.animHero(P.mesh, dist > 0.15 ? 'walk' : 'idle', P.animT, 1, 0);
    } else if (t >= 12.6 && !c.heroGone) { c.heroGone = true; P.mesh.visible = false; Sound.play('pickup'); }
    else if (t < 10) { P.animT += dt; Models.animHero(P.mesh, 'idle', P.animT, 1, 0); P.mesh.rotation.y += ((Math.atan2(h.position.x - P.pos.x, h.position.z - P.pos.z)) - P.mesh.rotation.y) * Math.min(1, dt * 3); }
    // камера: сначала за героем, потом с земли смотрим, как вертолёт уходит в закат
    let cp, lk;
    if (t < 13) { cp = V(P.pos.x - c.sunDir.x * 9 + 6, P.pos.y + 6, P.pos.z - c.sunDir.z * 9 + 6); lk = h.position.clone().lerp(P.pos.clone().add(V(0, 1.5, 0)), t < 7 ? 0.3 : 0.6); }
    else { cp = V(c.land.x - c.sunDir.x * 14, c.land.y + 3.5, c.land.z - c.sunDir.z * 14); lk = h.position.clone(); }
    camera.position.lerp(cp, 1 - Math.exp(-dt * 2.5)); camera.lookAt(lk);
    if (vm) vm.visible = false;
    if (t > 25.5) { scene.remove(h); cut = null; UI.cutscene(false); victory(); }
  }
  G.cutscene = () => cut;
  G._cutStep = (dt, n) => { for (let i = 0; i < n && cut; i++) updateCutscene(dt); };

  // ---------------- Выбор героя ----------------
  G.selRot = 0;
  G.showHero = function (type) {
    if (selHero) selScene.remove(selHero);
    selHero = Models.makeHero(type); selScene.add(selHero);
    const hand = selHero.userData.parts.hand; hand.add(Models.makeTool(HEROES[type].weapon || (type === 'builder' ? 'hammer' : 'axe'), type === 'hunter' ? 1 : type === 'knight' ? 2 : 0));
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
  // Птицы для экрана загрузки: смотрят прямо на игрока, прозрачный фон, без кружков
  G.makeLoadBirds = function (list) {
    const size = 256, rt = new THREE.WebGLRenderTarget(size, size);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6a8a4a, 1.05));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(1.5, 3, 4); sc.add(dl);
    const cm = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    const px = new Uint8Array(size * size * 4);
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const cx = cv.getContext('2d');
    const prevShadow = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
    const prevClear = renderer.getClearColor(new THREE.Color()).getHex(), prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    const out = {};
    list.forEach(sp => {
      const b = Models.makeBird(sp); b.scale.setScalar(1); b.rotation.y = 0; sc.add(b);
      Models.animBird(b, 'idle', 0);
      const box = new THREE.Box3().setFromObject(b), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const d = Math.max(sz.x, sz.y) * 2.25;
      cm.position.set(c.x, c.y + d * 0.12, c.z + d); cm.lookAt(c);
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cm);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
      const img = cx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      cx.clearRect(0, 0, size, size); cx.putImageData(img, 0, 0); out[sp] = cv.toDataURL('image/png');
      sc.remove(b);
    });
    renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevAlpha); renderer.shadowMap.enabled = prevShadow; rt.dispose();
    return out;
  };


  // =====================================================================
  // ---------------- Совместная игра (хост + до 2 гостей) ----------------
  // Хост считает весь мир (звери, волны, пушки, птицы, ресурсы) и 10 раз в секунду
  // рассылает его состояние. Гости ходят сами, а всё остальное отправляют хосту командами.
  // =====================================================================
  const puppets = new Map();           // другие игроки: pid → { pid, hero, mesh, pos, tgt, yaw, anim, swing, dead }
  let mpCount = 1;                     // игроков в игре (на гостях — из снимка хоста)
  const fxQueue = [];                  // выстрелы для отрисовки у гостей
  let lobby = [];                      // [{ pid, id, hero }]
  let tickN = 0, snapT = 0, meT = 0, fullFor = new Set(), lastBl = '', lastDead = '', pidSeq = 1;
  G.mpN = () => Net.isClient ? mpCount : (Net.isHost ? 1 + Net.conns.size : 1);
  G.maxOf = t => { const m = BUILD[t].max || 99; return m === 1 ? 1 : m * G.mpN() * (S && S.limX ? 2 : 1); };
  // Расширение базы: очень дорого, удваивает лимиты всех построек (кроме уникальных)
  G.LIMX_COST = { wood: 600, stone: 600, iron: 400, coal: 300, ruby: 50, coins: 3000 };
  G.buyLimits = function () {
    if (S.limX) return false;
    if (!tryPay(G.LIMX_COST)) return false;
    S.limX = 1; Sound.play('upgrade'); UI.toast('🏗️ Лимиты построек удвоены!', 'good'); return true;
  };
  G.lobby = () => lobby;
  function mpTargets() { const list = P ? [P] : []; puppets.forEach(p => list.push(p)); return list; }

  function makePuppet(pid, hero) {
    const mesh = Models.makeHero(hero); mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    mesh.userData.parts.hand.add(Models.makeTool(HEROES[hero].weapon || 'axe', hero === 'knight' ? 2 : 0));
    scene.add(mesh);
    const pp = { pid, hero, mesh, pos: V(2 * pid, 0, 6), tgt: V(2 * pid, 0, 6), yaw: 0, anim: 0, swing: 0, dead: false, animT: Math.random() * 5, hp: HEROES[hero].hp };
    puppets.set(pid, pp); return pp;
  }
  function setPupArmor(pp, ar) { ar = ARMOR[ar] ? ar : 0; if (pp.ar === ar) return; pp.ar = ar; Models.setArmor(pp.mesh, ar); }
  function removePuppet(pid) { const pp = puppets.get(pid); if (pp) { scene.remove(pp.mesh); puppets.delete(pid); } }
  function updatePuppets(dt) {
    puppets.forEach(pp => {
      pp.pos.lerp(pp.tgt, 1 - Math.exp(-dt * 10)); pp.pos.y = World.groundAt(pp.pos.x, pp.pos.z);
      const m = pp.mesh; m.position.copy(pp.pos); m.visible = G.state !== 'cutscene';
      let dy = pp.yaw - m.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; m.rotation.y += dy * Math.min(1, dt * 12);
      m.rotation.x = pp.dead ? -Math.PI / 2 : 0;
      pp.animT += dt; Models.animHero(m, ['idle', 'walk', 'run'][pp.anim] || 'idle', pp.animT, HEROES[pp.hero].speed / 6, pp.swing);
    });
  }
  const myState = () => ({ c: 'me', x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), y: +P.yaw.toFixed(2), a: P.moving || 0, s: +P.swing.toFixed(2), d: P.dead ? 1 : 0, h: S.hero, ar: (S.gear && S.gear.armor) || 0 });

  // ---------- хост: снимок мира ----------
  const birdCode = b => b.hidden ? 3 : b.state === 'fly' ? 1 : b.state === 'gunner' ? 2 : b.state === 'walk' ? 0 : 4;
  function snapshot(full) {
    const r1 = v => Math.round(v * 10) / 10;
    const s = { ev: 'snap', n: G.mpN(), res: S.res, tools: S.tools, tech: S.tech, lx: S.limX || 0, wave: S.wave, wt: Math.round(S.waveTimer), wa: S.waveActive, dt: +S.dayTime.toFixed(4), day: S.day, q: S.quest, left: G.enemiesLeft(), diff: S.diff };
    const bl = B.map(b => [b.id, b.t, b.x, b.z, b.rot, b.lvl, b.onWall || 0]); const blKey = bl.map(a => a[0] + ':' + a[5]).join(',');
    if (full || blKey !== lastBl) s.bl = bl;
    s.bh = B.map(b => [b.id, Math.round(b.hp), +b.yaw.toFixed(2)]);
    s.en = E.map(e => [e.id, e.type, r1(e.pos.x), r1(e.pos.z), +e.yaw.toFixed(2), Math.round(e.hp / e.maxHp * 100), e.mode === 'attack' ? 1 : 0, e.dying > 0 ? 1 : 0]);
    s.bd = BD.map(b => { const m = b.mesh.position; return [b.id, b.sp, r1(m.x), +m.y.toFixed(2), r1(m.z), +b.mesh.rotation.y.toFixed(2), birdCode(b), b.cannon ? b.cannon.id : 0, Math.round(b.hp)]; });
    const dead = World.nodes.filter(n => !n.alive).map(n => n.idx); const dKey = dead.length + ':' + dead.reduce((a, v) => a + v, 0);
    if (full || dKey !== lastDead) s.dead = dead;
    s.pl = [[0, S.hero, r1(P.pos.x), r1(P.pos.z), +P.yaw.toFixed(2), P.moving || 0, +P.swing.toFixed(2), P.dead ? 1 : 0, (S.gear && S.gear.armor) || 0]];
    puppets.forEach(pp => s.pl.push([pp.pid, pp.hero, r1(pp.tgt.x), r1(pp.tgt.z), pp.yaw, pp.anim, pp.swing, pp.dead ? 1 : 0, pp.ar || 0]));
    s.fx = fxQueue.splice(0);
    return { s, blKey, dKey };
  }
  function hostTick(dt) {
    snapT -= dt; if (snapT > 0) return; snapT = 0.1;
    if (!Net.conns.size) { fxQueue.length = 0; return; }
    const { s, blKey, dKey } = snapshot(false);
    const sFull = fullFor.size ? snapshot(true).s : null;
    tickN++;
    lobby.forEach(l => { const c = Net.conns.get(l.id); if (!c) return; if (c.relay && tickN % 2 && !fullFor.has(l.id)) return; Net.send(l.id, fullFor.has(l.id) ? sFull : s); });
    fullFor.clear(); lastBl = blKey; lastDead = dKey;
  }
  // ---------- хост: команды гостей ----------
  const REMOTE = ['upgrade', 'repair', 'demolish', 'buyBird', 'assignBird', 'unassignBird', 'releaseBird', 'craftTool', 'research', 'startWaveNow', 'buyLimits'];
  const enc = a => a && typeof a === 'object' ? (a.sp && a.mesh ? { bd: a.id } : (a.t && a.mesh ? { b: a.id } : a)) : a;
  const dec = a => a && typeof a === 'object' ? (a.bd !== undefined ? BD.find(b => b.id === a.bd) : a.b !== undefined ? byId[a.b] : a) : a;
  const hostFns = {};
  REMOTE.forEach(name => {
    const f = G[name]; hostFns[name] = f;
    G[name] = (...args) => { if (Net.isClient) { Net.toHost({ c: 'call', f: name, a: args.map(enc) }); Sound.play('click'); return true; } return f(...args); };
  });
  function onHostData(id, m) {
    const L = lobby.find(l => l.id === id);
    if (m.c === 'hello') {
      if (lobby.length >= 3 && !L) { Net.send(id, { ev: 'full' }); return; }
      const me = L || { pid: pidSeq++, id, hero: m.hero }; me.hero = m.hero; if (!L) lobby.push(me);
      Net.send(id, { ev: 'welcome', pid: me.pid, code: Net.code });
      Net.broadcast({ ev: 'lobby', players: lobby.map(l => ({ pid: l.pid, hero: l.hero })) });
      UI.lobbyUpdate && UI.lobbyUpdate();
      if (G.state === 'play' && S) { startGuest(me); }
      return;
    }
    if (!L || G.state !== 'play') return;
    if (m.c === 'me') {
      let pp = puppets.get(L.pid) || makePuppet(L.pid, m.h || L.hero);
      pp.tgt.set(m.x, 0, m.z); pp.yaw = m.y; pp.anim = m.a; pp.swing = m.s; pp.dead = !!m.d; setPupArmor(pp, m.ar);
    } else if (m.c === 'hitNode') { const n = World.nodes[m.i]; if (n && n.alive) hostHitNode(n, Math.min(6, +m.p || 1), V(n.x, n.y + 1.6, n.z)); }
    else if (m.c === 'hitEnemy') { const e = E.find(x => x.id === m.id); if (e) hurtEnemy(e, Math.min(400, +m.dmg || 0)); }
    else if (m.c === 'place') { if (BUILD[m.t]) doPlace(m.t, +m.x, +m.z, (m.r | 0) % 4, m.w | 0); }
    else if (m.c === 'spend') { const c = m.cost || {}; if (G.canAfford(c)) pay(c); }
    else if (m.c === 'call' && hostFns[m.f]) { const args = (m.a || []).map(dec); if (args.some(a => a === undefined)) return; hostFns[m.f](...args); }
  }
  function startGuest(l) {
    fullFor.add(l.id);
    Net.send(l.id, { ev: 'start', seed: S.seed, biome: World.biomeId, diff: S.diff, pid: l.pid });
    if (!puppets.has(l.pid)) makePuppet(l.pid, l.hero);
    UI.toast(tr('mp_joined', { name: HEROES[l.hero].name }), 'good');
  }
  // Хост: открыть лобби (из меню перед игрой или из паузы во время игры)
  G.mpHost = function (hero) {
    lobby = [{ pid: 0, id: 'host', hero }]; pidSeq = 1; puppets.forEach((_, k) => removePuppet(k));
    return Net.host({
      onOpen: code => UI.lobbyUpdate && UI.lobbyUpdate(code),
      onConn: () => { },
      onData: onHostData,
      onClose: id => { const L = lobby.find(l => l.id === id); lobby = lobby.filter(l => l.id !== id); if (L) { removePuppet(L.pid); UI.toast(tr('mp_left', { name: HEROES[L.hero].name }), 'warn'); } Net.broadcast({ ev: 'lobby', players: lobby.map(l => ({ pid: l.pid, hero: l.hero })) }); UI.lobbyUpdate && UI.lobbyUpdate(); },
      onError: e => UI.toast(e && e.type === 'server' ? tr('mp_server') : tr('mp_error') + ' (' + (e.type || e.message || e) + ')', 'bad', 6000),
    });
  };
  G.mpStartHosted = function () { lobby.forEach(l => { if (l.pid !== 0) startGuest(l); }); };
  G.mpLeave = function () { if (Net.isHost) Net.broadcast({ ev: 'hostLeft' }); Net.close(); lobby = []; puppets.forEach((_, k) => removePuppet(k)); mpCount = 1; };

  // ---------- гость ----------
  let guestHero = 'defender', guestPid = 1;
  G.mpJoin = function (code, hero) {
    guestHero = hero; lobby = [];
    return Net.join(code, {
      onOpen: () => { Net.toHost({ c: 'hello', hero }); UI.lobbyStatus && UI.lobbyStatus('ok'); },
      onStatus: st => UI.lobbyStatus && UI.lobbyStatus(st),
      onData: (_, m) => onGuestData(m),
      onClose: () => { if (Net.isClient) { UI.toast(tr('mp_host_gone'), 'bad', 5000); G.mpLeave(); UI.toMenu(); } },
      onError: e => { const msg = e && e.type === 'server' ? tr('mp_server') : e && (e.type === 'peer-unavailable' || e.type === 'timeout') ? tr('mp_notfound') : tr('mp_error') + ' (' + (e.type || e.message || e) + ')'; UI.toast(msg, 'bad', 6000); G.mpLeave(); UI.lobbyStatus && UI.lobbyStatus('fail', msg); },
    });
  };
  function onGuestData(m) {
    if (m.ev === 'welcome') { guestPid = m.pid; UI.lobbyUpdate && UI.lobbyUpdate(m.code); }
    else if (m.ev === 'lobby') { lobby = m.players; UI.lobbyUpdate && UI.lobbyUpdate(); }
    else if (m.ev === 'full') { UI.toast(tr('mp_full'), 'warn', 4000); G.mpLeave(); UI.lobbyUpdate && UI.lobbyUpdate(); }
    else if (m.ev === 'hostLeft') { UI.toast(tr('mp_host_gone'), 'bad', 5000); G.mpLeave(); UI.toMenu(); }
    else if (m.ev === 'start') { startClient(m); }
    else if (m.ev === 'snap') { if (S && G.state === 'play') applySnap(m); }
    else if (m.ev === 'hurt') { if (P && G.state === 'play') hurtPlayer(m.dmg); }
    else if (m.ev === 'cutscene') { if (G.state === 'play') startCutscene(); }
    else if (m.ev === 'end') { if (!m.win && G.state === 'play') gameOver(); }
  }
  function startClient(m) {
    clearWorld();
    World.generate(m.seed, m.biome);
    S = newState(guestHero, m.diff); S.seed = m.seed; S.player = { x: 2 * m.pid, z: 6, hp: HEROES[guestHero].hp };
    spawnPlayer(); guestPid = m.pid;
    G.state = 'play'; Sound.setMode('calm');
    UI.enterGameMP();
  }
  function applyBuildingList(bl) {
    const seen = new Set(bl.map(a => a[0]));
    B.slice().forEach(b => { if (!seen.has(b.id)) { if (b.hp < b.maxHp * 0.3) spawnParticles(V(b.x, b.mesh.position.y + 1, b.z), 0xa8743e, 16, 5, 0.3, 1.2); removeBuilding(b, true); } });
    bl.slice().sort((a, b) => (a[6] ? 1 : 0) - (b[6] ? 1 : 0)).forEach(([id, t, x, z, r, l, w]) => {
      const b = byId[id];
      if (!b) { addBuilding(t, x, z, r, l, null, w || null, id); return; }
      if (b.lvl !== l) { b.lvl = l; b.maxHp = maxHpOf(b); buildMesh(b); if (b.cannonId && byId[b.cannonId]) buildMesh(byId[b.cannonId]); }
    });
  }
  function applySnap(s) {
    Object.assign(S.res, s.res); S.tools = s.tools; S.tech = s.tech; S.limX = s.lx; S.wave = s.wave; S.waveTimer = s.wt; S.day = s.day; S.quest = s.q; S._left = s.left; mpCount = s.n;
    if (s.wa !== S.waveActive) Sound.setMode(s.wa ? 'battle' : 'calm');
    S.waveActive = s.wa; S.dayTime = s.dt;
    if (s.bl) applyBuildingList(s.bl);
    s.bh.forEach(([id, hp, yaw]) => { const b = byId[id]; if (!b) return; b.hp = hp; b.yaw = yaw; const tur = b.mesh.userData.turret; if (tur) tur.rotation.y = yaw - b.mesh.rotation.y; });
    // звери
    const seenE = new Set();
    s.en.forEach(([id, type, x, z, yaw, hpP, atk, dying]) => {
      seenE.add(id); let e = E.find(o => o.id === id);
      if (!e) { const mesh = Models.makeEnemy(type); scene.add(mesh); e = { id, type, d: ENEMIES[type], mesh, pos: V(x, World.groundAt(x, z), z), tgt: V(x, 0, z), yaw, hp: hpP, maxHp: 100, dying: 0, mode: 'walk', t: Math.random() * 9, hitT: 0 }; mesh.position.copy(e.pos); E.push(e); }
      e.tgt.set(x, 0, z); e.yaw = yaw; e.hp = hpP; e.mode = atk ? 'attack' : 'walk';
      if (dying && !e.dying) { e.dying = 1.6; Sound.play('growl', 0.6); }
    });
    E.slice().forEach(e => { if (!seenE.has(e.id) && !e.dying) { scene.remove(e.mesh); E.splice(E.indexOf(e), 1); } });
    // птицы
    const seenB = new Set();
    s.bd.forEach(([id, sp, x, y, z, ry, st, cid, hp]) => {
      seenB.add(id); let b = BD.find(o => o.id === id);
      if (!b) { const mesh = Models.makeBird(sp); scene.add(mesh); mesh.position.set(x, y, z); b = { id, sp, mesh, hp, maxHp: BIRDS[sp].hp, cannon: null, hidden: false, state: 'walk', ph: Math.random() * 10, tgt: V(x, y, z), ry }; BD.push(b); }
      b.tgt.set(x, y, z); b.ry = ry; b.hp = hp; b.st = st; b.hidden = st === 3; b.state = ['walk', 'fly', 'gunner', 'hidden', 'perch'][st];
      const c = cid ? byId[cid] : null; if (b.cannon && b.cannon !== c) b.cannon.gunner = null; b.cannon = c; if (c) c.gunner = b;
    });
    BD.slice().forEach(b => { if (!seenB.has(b.id)) { if (b.cannon) b.cannon.gunner = null; scene.remove(b.mesh); BD.splice(BD.indexOf(b), 1); } });
    // ресурсы на карте
    if (s.dead) { const dead = new Set(s.dead); World.nodes.forEach(n => { const a = !dead.has(n.idx); if (a !== n.alive) { if (!a && n.kind === 'tree' && Math.hypot(n.x - P.pos.x, n.z - P.pos.z) < 30) fellTree(n); n.alive = a; n.grow = a ? 0.05 : 1; World.updateNodeMatrix(n); } }); }
    // другие игроки
    const seenP = new Set();
    s.pl.forEach(([pid, hero, x, z, yaw, anim, sw, dead, ar]) => {
      if (pid === guestPid) return; seenP.add(pid);
      const pp = puppets.get(pid) || makePuppet(pid, hero); pp.tgt.set(x, 0, z); pp.yaw = yaw; pp.anim = anim; pp.swing = sw; pp.dead = !!dead; setPupArmor(pp, ar);
    });
    puppets.forEach((_, pid) => { if (!seenP.has(pid)) removePuppet(pid); });
    // выстрелы — только картинка
    const KINDS = { ball: 1, arrow: 1, bolt: 1, bullet: 1, rocket: 1 };
    s.fx.forEach(([kind, fx, fy, fz, tx, ty, tz, splash, eff]) => {
      if (!KINDS[kind]) return;
      const fake = { pos: V(tx, ty - 0.5, tz), yaw: 0, d: { speed: 0 }, mode: 'idle', dying: 0 };
      fire(V(fx, fy, fz), fake, { kind, dmg: 0, splash, slow: eff === 1, burn: eff === 2, visual: true });
      if (kind === 'ball') Sound.play('boom', 0.4); else if (kind === 'bullet') Sound.play('gun', 0.6); else if (kind === 'rocket') Sound.play('rocket', 0.6); else Sound.play('arrow', 0.6);
    });
  }
  // Лёгкое обновление на госте: свой герой, интерполяция чужих объектов, эффекты
  function clientUpdate(dt) {
    S.stats.time = (S.stats.time || 0) + dt;
    S.dayTime += dt / 300; if (S.dayTime >= 1) S.dayTime -= 1;
    const dl = World.updateSky(skyTime(), V(P.pos.x, 0, P.pos.z), dt, time);
    Sound.setNight(dl < 0.2);
    updatePlayer(dt); updateBuild();
    for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.t += dt; f.g.rotation.x = Math.min(Math.PI / 2, f.t * f.t * 2.2); if (f.t > 1.4) f.g.position.y -= dt * 2; if (f.t > 2.4) { scene.remove(f.g); falling.splice(i, 1); } }
    for (const n of World.nodesNear(P.pos.x, P.pos.z, 40, nearTmp)) { if (!n.alive) continue; if (n.shake > 0) { n.shake = Math.max(0, n.shake - dt); World.updateNodeMatrix(n); } if (n.grow < 1) { n.grow = Math.min(1, n.grow + dt * 0.5); World.updateNodeMatrix(n); } }
    const k = 1 - Math.exp(-dt * 10);
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i], m = e.mesh; e.t += dt;
      if (e.dying > 0) { e.dying -= dt; m.rotation.z = Math.min(Math.PI / 2, m.rotation.z + dt * 5); if (e.dying < 0.8) m.position.y -= dt * 1.2; if (e.dying <= 0) { scene.remove(m); E.splice(i, 1); } continue; }
      if (e.hitT > 0) { e.hitT -= dt; m.scale.setScalar(m.userData.baseScale * (1 + e.hitT)); }
      e.pos.lerp(e.tgt, k); e.pos.y = Math.max(World.groundAt(e.pos.x, e.pos.z), World.WATER_Y - 0.6); m.position.copy(e.pos);
      let dy = e.yaw - m.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; m.rotation.y += dy * Math.min(1, dt * 8);
      Models.animEnemy(m, e.pos.distanceToSquared(e.tgt) > 0.01 || e.mode === 'attack' ? e.mode : 'idle', e.t, e.d.speed);
    }
    for (const b of BD) {
      const m = b.mesh; b.ph += dt; m.visible = !b.hidden;
      m.position.lerp(b.tgt, b.st === 2 ? 1 : k); m.rotation.y = b.ry;
      Models.animBird(m, b.st === 1 ? 'fly' : b.st === 0 ? 'walk' : b.st === 4 ? 'peck' : 'idle', b.ph);
    }
    updatePuppets(dt);
    updateProjectiles(dt); updateLights(dt); updateParticles(dt);
    meT -= dt; if (meT <= 0) { meT = 0.1; Net.toHost(myState()); }
  }
  G.mpPid = () => guestPid;

  // ---------------- Сохранение: 3 слота ----------------
  const SLOT_KEY = n => 'birdwars_slot_' + n;
  G.slot = 1;
  // перенос старого единственного сохранения в слот 1
  try { const old = localStorage.getItem('birdfortress_save_v1'); if (old && !localStorage.getItem(SLOT_KEY(1))) { localStorage.setItem(SLOT_KEY(1), old); } if (old) localStorage.removeItem('birdfortress_save_v1'); } catch (e) { }
  const readSlot = n => { try { return JSON.parse(localStorage.getItem(SLOT_KEY(n))); } catch (e) { return null; } };
  G.hasSave = n => n ? !!readSlot(n) : [1, 2, 3].some(k => readSlot(k));
  G.saveCount = () => [1, 2, 3].filter(k => readSlot(k)).length;
  G.save = function (auto) {
    if (!S || G.state === 'over' || G.state === 'cutscene' || Net.isClient) return;
    S.player = { x: P.pos.x, z: P.pos.z, hp: P.hp };
    const data = Object.assign({}, S, {
      waveActive: false, spawnList: null, waveTimer: S.waveActive ? 30 : S.waveTimer, biomeId: World.biomeId,
      buildings: B.map(b => ({ id: b.id, t: b.t, x: b.x, z: b.z, r: b.rot, l: b.lvl, hp: Math.round(b.hp), w: b.onWall || 0 })),
      birds: BD.map(b => ({ sp: b.sp, hp: b.hp, c: b.cannon ? b.cannon.id : 0 })),
      nodes: World.nodes.filter(n => !n.alive).map(n => [n.idx, Math.round(n.regrow)]),
      cam: { yaw: cam.yaw, pitch: cam.pitch }, savedAt: Date.now(),
    });
    try { localStorage.setItem(SLOT_KEY(G.slot), JSON.stringify(data)); if (!auto) UI.toast(tr('saved'), 'info'); else UI.saveIcon(); } catch (e) { UI.toast(tr('save_fail'), 'bad'); }
  };
  G.load = function (slot) {
    const n = slot || G.slot; const data = readSlot(n);
    if (!data) return false;
    G.slot = n;
    clearWorld();
    if (!data.seed) data.seed = 20240611;
    if (!data.biomeId) data.biomeId = World.biomeOf(data.seed, 4).id; // старые сохранения
    if (World.seed !== data.seed || World.biomeId !== data.biomeId) World.generate(data.seed, data.biomeId);
    S = data; const blds = data.buildings, birds = data.birds, nodes = data.nodes;
    delete S.buildings; delete S.birds; delete S.nodes;
    if (!S.diff) S.diff = 'normal';
    S.stats = Object.assign({ wood: 0, stone: 0, iron: 0, coal: 0, food: 0, coins: 0, kills: 0, bosses: 0, built: 0, boughtBirds: 0, time: 0 }, S.stats);
    S.res = Object.assign({ wood: 0, stone: 0, iron: 0, coal: 0, ruby: 0, food: 0, coins: 0 }, S.res);
    S.tools = Object.assign({ axe: 0, pick: -1, sword: -1 }, S.tools);
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
  G.deleteSave = n => { try { localStorage.removeItem(SLOT_KEY(n || G.slot)); } catch (e) { } };
  G.saveInfo = function (n) {
    const d = readSlot(n || G.slot); if (!d) return null;
    const bio = World.biomeById(d.biomeId || World.biomeOf(d.seed || 20240611, 4).id);
    return { hero: d.hero, wave: d.wave, day: d.day, at: d.savedAt, diff: d.diff || 'normal', biome: bio ? bio.name : '' };
  };
})();
