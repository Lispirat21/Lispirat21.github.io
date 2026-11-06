'use strict';
// ============ Мир: рельеф, лес, вода, горы, карьер, пещера, день/ночь ============
const World = (() => {
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const perm = new Uint8Array(512);
  function shufflePerm(seed) { const r = mulberry32(seed); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
  shufflePerm(1337);
  const hash = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += vnoise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Биомы ----------
  const BIOMES = [
    { id: 'summer', name: 'Летний лес', grass: [0x5e9f38, 0x86b84a], trees: { pine: [0x2f6e34, 0x3a8040, 0x46924a], oak: [0x4f9a3a, 0x5aa844, 0x468a34, 0x62b04a], birch: [0x8ac850, 0x9ad458] }, mix: [0.55, 0.85], count: 430, dens: 0.42, flowers: 1, bush: 0x3f7f32, snow: 42 },
    { id: 'autumn', name: 'Осенний лес', grass: [0x8a9a3a, 0xb4a648], trees: { pine: [0x2a5e30, 0x356e38, 0x407a40], oak: [0xd8742a, 0xe8a030, 0xc0482a, 0xf0b840], birch: [0xf0c838, 0xe8d860] }, mix: [0.3, 0.75], count: 420, dens: 0.42, flowers: 0.5, bush: 0xa86a2a, snow: 42 },
    { id: 'taiga', name: 'Тайга', grass: [0x4a7a3a, 0x648c4a], trees: { pine: [0x1f5a34, 0x2a6a3a, 0x356f42], oak: [0x3f7a34, 0x4a8a3a, 0x3a6e30, 0x52923f], birch: [0x7ab048, 0x86bc50], snowy: true }, mix: [0.85, 0.9], count: 540, dens: 0.38, flowers: 0.3, bush: 0x2f6a30, snow: 26 },
    { id: 'bloom', name: 'Цветущий луг', grass: [0x74b844, 0xa0d05a], trees: { pine: [0x2f6e34, 0x3a8040, 0x46924a], oak: [0xf0a8c8, 0xf8c0d8, 0xe890b8, 0xffd0e0], birch: [0x9ad458, 0xb0e060] }, mix: [0.25, 0.7], count: 300, dens: 0.5, flowers: 2.4, bush: 0x4c9a3a, snow: 42 },
  ];
  const WATER_Y = -0.9;
  const MINE = { x: 112, z: -72 }, LAKE = { x: -88, z: 72, r: 24 }, CAVE = { x: -112, z: -118 };
  const W = { seed: 1, biome: BIOMES[0], hScale: 14, hFreq: 0.012, mtn: 60, rA: 0, rC: 1, rS: 0, rOff: 72, rAmp: 18, rFreq: 0.025, river: true, bridge: null, mdx: -0.84, mdz: 0.54 };
  const riverCoord = (x, z) => ({ u: x * W.rC + z * W.rS, v: -x * W.rS + z * W.rC });
  const riverU = v => W.rOff + Math.sin(v * W.rFreq) * W.rAmp;
  function riverSigned(x, z) { const c = riverCoord(x, z); return c.u - riverU(c.v); }

  // Сид: число или любая строка
  function seedFrom(str) {
    const t = String(str == null ? '' : str).trim();
    if (/^-?\d+$/.test(t)) return (parseInt(t, 10) >>> 0) || 1;
    let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) || 1;
  }
  function biomeOf(seed) { return BIOMES[Math.floor(mulberry32(seed ^ 0x9e3779b9)() * BIOMES.length)]; }
  function setupSeed(seed) {
    W.seed = seed; shufflePerm(seed);
    const r = mulberry32(seed ^ 0x9e3779b9);
    W.biome = BIOMES[Math.floor(r() * BIOMES.length)];
    W.hScale = 8 + r() * 14; W.hFreq = 0.008 + r() * 0.009; W.mtn = 40 + r() * 45;
    W.rA = r() * Math.PI; W.rC = Math.cos(W.rA); W.rS = Math.sin(W.rA);
    W.rOff = (r() < 0.5 ? -1 : 1) * (58 + r() * 25); W.rAmp = 8 + r() * 18; W.rFreq = 0.015 + r() * 0.02; W.river = r() < 0.88;
    const far = (x, z, d) => !W.river || Math.abs(riverSigned(x, z)) > d;
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, R = 112 + r() * 18; MINE.x = Math.cos(a) * R; MINE.z = Math.sin(a) * R; if (far(MINE.x, MINE.z, 34)) break; }
    const ml = Math.hypot(MINE.x, MINE.z); W.mdx = -MINE.x / ml; W.mdz = -MINE.z / ml;
    for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, R = 75 + r() * 40; LAKE.x = Math.cos(a) * R; LAKE.z = Math.sin(a) * R; LAKE.r = 16 + r() * 14; if (far(LAKE.x, LAKE.z, LAKE.r + 18) && Math.hypot(LAKE.x - MINE.x, LAKE.z - MINE.z) > LAKE.r + 50) break; }
    for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, R = 158; CAVE.x = Math.cos(a) * R; CAVE.z = Math.sin(a) * R; if (Math.hypot(CAVE.x - MINE.x, CAVE.z - MINE.z) > 90 && Math.hypot(CAVE.x - LAKE.x, CAVE.z - LAKE.z) > 60 && far(CAVE.x, CAVE.z, 25)) break; }
    // мост — там, где дорога от базы к карьеру пересекает реку
    W.bridge = null;
    if (W.river) {
      let prev = riverSigned(0, 0);
      for (let i = 1; i <= 200; i++) {
        const t = i / 200, x = MINE.x * t, z = MINE.z * t, s = riverSigned(x, z);
        if (Math.sign(s) !== Math.sign(prev)) { W.bridge = { x, z, ax: -W.mdx, az: -W.mdz, w: 3.4, len: 32 }; break; }
        prev = s;
      }
    }
  }
  function mineCarve(x, z) {
    const dx = x - MINE.x, dz = z - MINE.z, md = Math.hypot(dx, dz);
    const pit = 1 - smooth(14, 20, md);
    const proj = dx * W.mdx + dz * W.mdz, perp = Math.abs(dx * -W.mdz + dz * W.mdx);
    const canyon = (proj > 0 && proj < 42) ? (1 - smooth(4, 7.5, perp)) * (1 - smooth(36, 42, proj)) : 0;
    return { md, carve: Math.max(pit, canyon) };
  }
  function heightAt(x, z) {
    const d = Math.hypot(x, z);
    let h = (fbm(x * W.hFreq + 10, z * W.hFreq - 5) - 0.5) * W.hScale + (fbm(x * 0.05, z * 0.05) - 0.5) * 2.5;
    h *= smooth(28, 62, d);
    const m = smooth(150, 215, d); h += m * m * W.mtn * (0.55 + 0.9 * fbm(x * 0.02, z * 0.02));
    const mc = mineCarve(x, z);
    const hill = 19 * Math.exp(-(mc.md * mc.md) / (2 * 25 * 25));
    h = lerp(h + hill, 0.4, mc.carve);
    const cd = Math.hypot(x - CAVE.x, z - CAVE.z); h += 14 * Math.exp(-(cd * cd) / (2 * 14 * 14));
    if (W.river) { const rd = Math.abs(riverSigned(x, z)); h = lerp(-2.4, h, smooth(3.5, 11, rd)); }
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z); h = lerp(-2.7, h, smooth(LAKE.r - 9, LAKE.r + 4, ld));
    return h;
  }
  function onBridge(x, z) {
    const b = W.bridge; if (!b) return false;
    const dx = x - b.x, dz = z - b.z, along = dx * b.ax + dz * b.az, perp = Math.abs(-dx * b.az + dz * b.ax);
    return Math.abs(along) < b.len / 2 && perp < b.w / 2;
  }
  function groundAt(x, z) { const h = heightAt(x, z); if (onBridge(x, z)) return Math.max(h, 0.35); return h; }
  function inWater(x, z) { return !onBridge(x, z) && heightAt(x, z) < WATER_Y - 0.25; }
  function inMine(x, z) { return Math.hypot(x - MINE.x, z - MINE.z) < 19; }

  let scene, sun, hemi, sunMesh, moonMesh, stars, clouds = [], water, grassMesh, flowerMesh, flock = [];
  let root = null, owned = [], quality = 'medium';
  const nodes = []; const nodeMeshes = {};
  const grid = new Map(); const CELL = 8;
  const key = (cx, cz) => cx * 10007 + cz;
  function gridAdd(n) { const k = key(Math.floor(n.x / CELL), Math.floor(n.z / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n); }
  function nodesNear(x, z, r, out = []) {
    out.length = 0;
    const c0x = Math.floor((x - r) / CELL), c1x = Math.floor((x + r) / CELL), c0z = Math.floor((z - r) / CELL), c1z = Math.floor((z + r) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) { const a = grid.get(key(cx, cz)); if (a) for (const n of a) out.push(n); }
    return out;
  }
  const own = g => { owned.push(g); return g; };
  const addR = o => { root.add(o); return o; };

  function build(scn, q) {
    scene = scn; quality = q;
    buildSky();
    generate(20240611);
  }
  // Полностью пересоздаёт мир по сиду
  function generate(seed) {
    if (root) { scene.remove(root); owned.forEach(g => g.dispose()); owned = []; }
    nodes.length = 0; grid.clear();
    root = new THREE.Group(); scene.add(root);
    setupSeed(seed);
    const BI = W.biome;
    // ----- Рельеф -----
    const SIZE = 460, SEG = 150;
    const tg = own(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position; const cols = new Float32Array(pos.count * 3);
    const cGrass1 = new THREE.Color(BI.grass[0]), cGrass2 = new THREE.Color(BI.grass[1]), cDirt = new THREE.Color(0xc9a36a), cSand = new THREE.Color(0xd8c48a),
      cRock = new THREE.Color(0x8a8780), cSnow = new THREE.Color(0xf4f6fa), cMud = new THREE.Color(0x7a6a50), cPit = new THREE.Color(0x857868), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
      const d = Math.hypot(x, z);
      const slope = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
      tmp.copy(cGrass1).lerp(cGrass2, fbm(x * 0.03, z * 0.03));
      tmp.lerp(cDirt, 1 - smooth(20, 27, d));
      const mc = mineCarve(x, z); if (mc.carve > 0.2) tmp.lerp(cPit, mc.carve);
      if (h < -0.35) tmp.copy(cSand); if (h < -1.3) tmp.copy(cMud);
      if (slope > 2.2 || h > 12) tmp.lerp(cRock, Math.min(1, Math.max((slope - 2.2) / 2, (h - 12) / 6)));
      if (h > BI.snow) tmp.lerp(cSnow, Math.min(1, (h - BI.snow) / 8));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    terrain.receiveShadow = true; addR(terrain);

    // ----- Вода -----
    if (!water) water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a8ac8, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.2 }));
    water.position.y = WATER_Y; addR(water);

    // ----- Мост -----
    if (W.bridge) {
      const B = W.bridge, bridge = new THREE.Group(); bridge.position.set(B.x, 0.3, B.z); bridge.rotation.y = Math.atan2(B.az, B.ax) * -1;
      Models.box(B.len, 0.2, B.w, Models.texMat(Models.T.planks()), 0, 0, 0, bridge);
      for (let i = -7; i <= 7; i += 2) [-1, 1].forEach(s => Models.cyl(0.15, 0.15, 3.2, 0x6e4622, i * 2, -0.8, s * B.w / 2, bridge, 6));
      [-1, 1].forEach(s => Models.box(B.len, 0.12, 0.12, 0x6e4622, 0, 0.8, s * B.w / 2, bridge));
      addR(bridge);
    }

    // ----- Горы вдали -----
    const mParts = [];
    const rr = mulberry32(seed + 99);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + rr() * 0.1, R = 270 + rr() * 70, hgt = 50 + rr() * 60 + W.mtn * 0.6, rad = 35 + rr() * 30;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      mParts.push([new THREE.ConeGeometry(rad, hgt, 7), 0x6a7480, Models.mtx(x, hgt / 2 - 8, z, 1, 1, 1, rr() * 3)]);
      mParts.push([new THREE.ConeGeometry(rad * 0.36, hgt * 0.36, 7), 0xf2f4f8, Models.mtx(x, hgt - 8 - hgt * 0.18 + 0.5, z, 1, 1, 1, rr() * 3)]);
    }
    addR(new THREE.Mesh(own(Models.merge(mParts)), own(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }))));

    // ----- Ресурсы (деревья, камни, руда, ягоды) -----
    const rnd = mulberry32(seed + 42);
    const occupied = (x, z, r) => { for (const n of nodesNear(x, z, r + 3)) if (Math.hypot(n.x - x, n.z - z) < r + n.r) return true; return false; };
    function addNode(kind, sub, x, z, scale) {
      const n = { kind, sub, x, z, y: groundAt(x, z), scale, r: (kind === 'tree' ? 0.45 : 0.95) * scale, hp: NODE_INFO[kind].hp, maxHp: NODE_INFO[kind].hp, alive: true, regrow: 0, rot: rnd() * 6.28, idx: nodes.length, acc: 0, shake: 0, grow: 1 };
      nodes.push(n); gridAdd(n); return n;
    }
    const nearBridge = (x, z) => W.bridge && Math.hypot(x - W.bridge.x, z - W.bridge.z) < W.bridge.len / 2 + 4;
    const valid = (x, z, minD) => {
      const d = Math.hypot(x, z); if (d < minD || d > 172) return false;
      const h = heightAt(x, z); if (h < WATER_Y + 0.4 || h > 18) return false;
      const sl = Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h); if (sl > 1.4) return false;
      if (nearBridge(x, z)) return false;
      return true;
    };
    let tries = 0, trees = 0;
    while (trees < BI.count && tries < 10000) {
      tries++;
      const x = (rnd() - 0.5) * 360, z = (rnd() - 0.5) * 360;
      if (!valid(x, z, 33)) continue;
      if (mineCarve(x, z).md < 32) continue;
      const dens = fbm(x * 0.022 + 3, z * 0.022 + 7);
      if (dens < BI.dens && Math.hypot(x, z) > 60) continue;
      const s = 0.8 + rnd() * 0.6;
      if (occupied(x, z, 1.6 * s)) continue;
      const r = rnd(); addNode('tree', r < BI.mix[0] ? 'pine' : (r < BI.mix[1] ? 'oak' : 'birch'), x, z, s); trees++;
    }
    const scatter = (kind, count, fx) => { let c = 0, t = 0; while (c < count && t < 3000) { t++; const p = fx(); if (!p) continue; const [x, z, s] = p; if (occupied(x, z, 1.2 * s)) continue; addNode(kind, kind, x, z, s); c++; } };
    scatter('stone', 34, () => { const a = rnd() * 6.28, R = 34 + rnd() * 120, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 32) ? [x, z, 0.8 + rnd() * 0.5] : null; });
    const inPit = () => { const a = rnd() * 6.28, R = 3 + rnd() * 12; return [MINE.x + Math.cos(a) * R, MINE.z + Math.sin(a) * R, 0.8 + rnd() * 0.4]; };
    scatter('stone', 14, inPit); scatter('coal', 12, inPit); scatter('iron', 10, inPit);
    scatter('coal', 6, () => { const a = rnd() * 6.28, R = 135 + rnd() * 25, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 120) ? [x, z, 0.9] : null; });
    const cl = Math.hypot(CAVE.x, CAVE.z), cix = -CAVE.x / cl, ciz = -CAVE.z / cl;
    scatter('iron', 5, () => { const a = rnd() * 6.28, R = 2 + rnd() * 8; const x = CAVE.x + cix * 14 + Math.cos(a) * R, z = CAVE.z + ciz * 14 + Math.sin(a) * R; return heightAt(x, z) > WATER_Y + 0.4 ? [x, z, 0.9] : null; });
    scatter('berry', 30, () => { const a = rnd() * 6.28, R = 30 + rnd() * 90, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 29) ? [x, z, 0.9 + rnd() * 0.3] : null; });

    const tg2 = Models.treeGeos(BI.trees), rg = Models.rockGeos();
    const vMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    const geos = { pine: tg2.pine, oak: tg2.oak, birch: tg2.birch, stone: rg.stone, coal: rg.coal, iron: rg.iron, berry: rg.berry };
    for (const sub in geos) {
      own(geos[sub]);
      const list = nodes.filter(n => n.sub === sub);
      const im = new THREE.InstancedMesh(geos[sub], vMat, Math.max(1, list.length));
      im.castShadow = true; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((n, i) => { n.im = im; n.ii = i; const c = new THREE.Color(1, 1, 1); c.offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12); im.setColorAt(i, c); updateNodeMatrix(n); });
      im.count = list.length; addR(im); nodeMeshes[sub] = im;
      if (!list.length) im.visible = false;
    }

    // ----- Трава, цветы, кусты, камешки -----
    const g1 = new THREE.Color(BI.grass[0]).multiplyScalar(0.95), g2 = new THREE.Color(BI.grass[1]);
    const blade = own(Models.merge([
      [new THREE.ConeGeometry(0.06, 0.55, 3), g1.getHex(), Models.mtx(0, 0.27, 0)],
      [new THREE.ConeGeometry(0.05, 0.45, 3), g2.getHex(), Models.mtx(0.08, 0.22, 0.03, 1, 1, 1, 0, 0, -0.3)],
      [new THREE.ConeGeometry(0.05, 0.4, 3), g1.clone().multiplyScalar(0.85).getHex(), Models.mtx(-0.07, 0.2, -0.02, 1, 1, 1, 0, 0.2, 0.3)],
    ]));
    const GRASS_MAX = 16000;
    const vMat2 = own(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    grassMesh = new THREE.InstancedMesh(blade, vMat2, GRASS_MAX); grassMesh.receiveShadow = true;
    const gm = new THREE.Matrix4(); let gi = 0, gt = 0;
    while (gi < GRASS_MAX && gt < GRASS_MAX * 4) {
      gt++; const a = rnd() * 6.28, R = 18 + Math.pow(rnd(), 0.8) * 130, x = Math.cos(a) * R, z = Math.sin(a) * R;
      const h = heightAt(x, z); if (h < WATER_Y + 0.3 || h > 14 || mineCarve(x, z).carve > 0.1) continue;
      if (Math.hypot(x, z) < 26 && rnd() < 0.85) continue;
      const s = 0.7 + rnd() * 0.9; gm.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s, s));
      grassMesh.setMatrixAt(gi++, gm);
    }
    grassMesh.userData.max = gi; addR(grassMesh);
    const flower = own(Models.merge([[new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), 0x3a7a2a, Models.mtx(0, 0.2, 0)], [new THREE.IcosahedronGeometry(0.1, 0), 0xffffff, Models.mtx(0, 0.42, 0)]]));
    const FL = Math.round(1500 * BI.flowers);
    flowerMesh = new THREE.InstancedMesh(flower, vMat, FL); flowerMesh.userData.max = FL;
    const fcols = BI.id === 'autumn' ? [0xf0a030, 0xe06030, 0xf8e040, 0xffffff, 0xc07040] : [0xf8e040, 0xffffff, 0xc070e0, 0xf06080, 0x60a0f0];
    for (let i = 0; i < FL; i++) {
      let x, z, h, t = 0; do { const a = rnd() * 6.28, R = 22 + rnd() * 120; x = Math.cos(a) * R; z = Math.sin(a) * R; h = heightAt(x, z); t++; } while ((h < WATER_Y + 0.4 || h > 12) && t < 20);
      gm.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + rnd() * 0.6));
      flowerMesh.setMatrixAt(i, gm); flowerMesh.setColorAt(i, new THREE.Color(fcols[i % 5]));
    }
    addR(flowerMesh);
    const bushG = own(Models.merge([[new THREE.IcosahedronGeometry(0.7, 0), BI.bush, Models.mtx(0, 0.45, 0, 1.3, 0.8, 1.2)], [new THREE.IcosahedronGeometry(0.5, 0), new THREE.Color(BI.bush).multiplyScalar(1.15).getHex(), Models.mtx(0.5, 0.35, 0.2)]]));
    const bushes = new THREE.InstancedMesh(bushG, vMat2, 260); bushes.castShadow = true; bushes.receiveShadow = true;
    for (let i = 0; i < 260; i++) {
      let x, z, t = 0; do { const a = rnd() * 6.28, R = 32 + rnd() * 140; x = Math.cos(a) * R; z = Math.sin(a) * R; t++; } while (!valid(x, z, 30) && t < 20);
      gm.compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.8));
      bushes.setMatrixAt(i, gm);
    }
    addR(bushes);
    const pebG = own(Models.merge([[new THREE.DodecahedronGeometry(0.35, 0), 0x8a8a86, Models.mtx(0, 0.1, 0, 1, 0.6, 1)]]));
    const peb = new THREE.InstancedMesh(pebG, vMat2, 300);
    for (let i = 0; i < 300; i++) { const a = rnd() * 6.28, R = 25 + rnd() * 150, x = Math.cos(a) * R, z = Math.sin(a) * R; gm.compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.5 + rnd())); peb.setMatrixAt(i, gm); }
    addR(peb);

    buildMine(); buildCave(); buildNests(rnd);
    applyQuality(quality);
  }

  function updateNodeMatrix(n) {
    const m = new THREE.Matrix4();
    if (!n.alive) m.makeScale(0, 0, 0);
    else {
      const s = n.scale * n.grow;
      const tilt = n.shake > 0 ? Math.sin(n.shake * 50) * n.shake * 0.25 : 0;
      m.compose(new THREE.Vector3(n.x, n.y - 0.05, n.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, n.rot, tilt * 0.6)), new THREE.Vector3(s, s, s));
    }
    n.im.setMatrixAt(n.ii, m); n.im.instanceMatrix.needsUpdate = true;
  }

  function buildMine() {
    const g = new THREE.Group();
    // вход в шахту в стене карьера
    const mdx = W.mdx, mdz = W.mdz;
    const ex = MINE.x - mdx * 17, ez = MINE.z - mdz * 17;
    const ent = new THREE.Group(); ent.position.set(ex, heightAt(ex, ez), ez); ent.rotation.y = Math.atan2(mdx, mdz);
    Models.box(4.2, 4.4, 2.5, 0x080808, 0, 1.6, -0.6, ent);
    [-1, 1].forEach(s => Models.box(0.4, 4, 0.4, 0x6e4622, s * 2.1, 2, 0.6, ent));
    Models.box(5, 0.45, 0.5, 0x6e4622, 0, 4.1, 0.6, ent);
    const sign = Models.box(2.2, 0.6, 0.08, 0xc89a5e, 0, 4.7, 0.7, ent); void sign;
    // рельсы и вагонетка
    [-0.5, 0.5].forEach(s => Models.box(0.08, 0.06, 9, 0x5a5a62, s, 0.05, 4.5, ent));
    for (let i = 0; i < 9; i++) Models.box(1.4, 0.06, 0.2, 0x6e4622, 0, 0.02, 0.5 + i, ent);
    const cart = Models.group(ent, 0, 0, 5); Models.box(1.2, 0.7, 1.4, 0x5a5a62, 0, 0.55, 0, cart);
    for (let i = 0; i < 4; i++) Models.sph(0.35, 0.3, 0.35, i % 2 ? 0x151515 : 0xc87a40, -0.25 + (i % 2) * 0.5, 0.95, -0.3 + Math.floor(i / 2) * 0.6, cart, true);
    // фонари
    [-1, 1].forEach(s => { const l = Models.box(0.25, 0.35, 0.25, Models.mat(0xffc040, { emissive: 0xffa020, emissiveIntensity: 1.5 }), s * 2.1, 3.3, 1.0, ent, false); void l; });
    g.add(ent);
    // деревянные подпорки у каньона
    for (let i = 0; i < 4; i++) {
      const px = MINE.x + mdx * (20 + i * 5), pz = MINE.z + mdz * (20 + i * 5);
      const post = new THREE.Group(); post.position.set(px, heightAt(px, pz), pz); post.rotation.y = Math.atan2(mdx, mdz);
      [-1, 1].forEach(s => Models.box(0.35, 3.5, 0.35, 0x6e4622, s * 4.2, 1.75, 0, post)); Models.box(9, 0.35, 0.35, 0x6e4622, 0, 3.5, 0, post);
      g.add(post);
    }
    // указатель у базы
    const spx = -W.mdx * 30 + W.mdz * 6, spz = -W.mdz * 30 - W.mdx * 6; const sp = new THREE.Group(); sp.position.set(spx, heightAt(spx, spz), spz); sp.rotation.y = Math.atan2(-W.mdx, -W.mdz) - Math.PI / 2;
    Models.cyl(0.1, 0.1, 2.2, 0x6e4622, 0, 1.1, 0, sp, 6);
    const arrow = Models.box(1.6, 0.4, 0.08, 0xc89a5e, 0.5, 1.9, 0, sp); arrow.rotation.y = 0.4;
    g.add(sp);
    addR(g);
  }
  function buildCave() {
    const cl = Math.hypot(CAVE.x, CAVE.z), ix = -CAVE.x / cl, iz = -CAVE.z / cl;
    const g = new THREE.Group(); const cx = CAVE.x + ix * 9, cz = CAVE.z + iz * 9; const h = heightAt(cx, cz);
    g.position.set(cx, h, cz); g.rotation.y = Math.atan2(ix, iz);
    Models.sph(6, 5, 2.5, 0x070707, 0, 1.6, -0.6, g, false, false);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8); const r = Models.sph(2 + (i % 3) * 0.5, 2, 2, 0x7a7670, Math.cos(a) * 3.6, Math.sin(a) * 3.6 + 0.3, 0.3, g, true); r.rotation.set(i, i * 2, 0); }
    // светящиеся кристаллы
    for (let i = 0; i < 5; i++) { const c = Models.cone(0.25, 1, Models.mat(0x60d0ff, { emissive: 0x2080ff, emissiveIntensity: 1.2 }), -2 + i, 0.4, -0.2, g, 5, false); c.rotation.z = (i - 2) * 0.2; }
    addR(g);
  }
  function buildNests(rnd) {
    for (let i = 0; i < 7; i++) {
      const a = rnd() * 6.28, R = 40 + rnd() * 70, x = Math.cos(a) * R, z = Math.sin(a) * R; const h = heightAt(x, z);
      if (h < WATER_Y + 0.5) continue;
      const g = new THREE.Group(); g.position.set(x, h, z);
      if (i % 2) {
        Models.cyl(0.6, 0.8, 0.8, 0x6e4a2a, 0, 0.4, 0, g, 8);
        const n = Models.torus(0.55, 0.22, 0x8a6236, 0, 0.9, 0, g, 10); n.rotation.x = Math.PI / 2;
        for (let e = 0; e < 3; e++) Models.sph(0.22, 0.28, 0.22, 0xcfe6f0, -0.15 + e * 0.15, 0.95, (e % 2) * 0.12, g, true);
      } else {
        Models.cyl(0.08, 0.1, 2.2, 0x6e4622, 0, 1.1, 0, g, 6); Models.box(0.8, 0.8, 0.8, 0xd8a868, 0, 2.5, 0, g);
        const r = Models.cone(0.75, 0.55, 0x3a7ac0, 0, 3.15, 0, g, 4); r.rotation.y = Math.PI / 4;
        Models.cyl(0.13, 0.13, 0.05, 0x111111, 0, 2.6, 0.41, g, 8, false).rotation.x = Math.PI / 2;
      }
      addR(g);
    }
  }

  // ----- Небо, солнце, звёзды, облака -----
  function buildSky() {
    hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a6a2a, 0.6); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 220;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false }));
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
    scene.add(sunMesh); scene.add(moonMesh);
    const sp = []; const r = mulberry32(5);
    for (let i = 0; i < 900; i++) { const u = r() * 2 - 1, th = r() * 6.28, rr = Math.sqrt(1 - u * u); if (u < 0.05) continue; sp.push(Math.cos(th) * rr * 420, u * 420, Math.sin(th) * rr * 420); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(stars);
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 14; i++) {
      const parts = []; const n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) parts.push([new THREE.IcosahedronGeometry(5 + r() * 4, 0), 0xffffff, Models.mtx(j * 6 - n * 3, r() * 2, r() * 4, 1, 0.6, 1)]);
      const c = new THREE.Mesh(Models.merge(parts), cm); c.position.set((r() - 0.5) * 500, 70 + r() * 25, (r() - 0.5) * 500); c.userData.v = 1 + r() * 2;
      clouds.push(c); scene.add(c);
    }
    // стая диких птиц
    for (let i = 0; i < 7; i++) {
      const b = Models.makeBird(i % 3 === 0 ? 'eagle' : 'sparrow'); b.scale.multiplyScalar(i % 3 === 0 ? 1.2 : 0.9);
      b.userData.fl = { r: 25 + r() * 40, h: 16 + r() * 12, sp: 0.15 + r() * 0.15, ph: r() * 6.28, cx: (r() - 0.5) * 140, cz: (r() - 0.5) * 140 };
      b.traverse(o => o.castShadow = false); flock.push(b); scene.add(b);
    }
  }

  const SKY = { day: new THREE.Color(0x8fd0f4), dusk: new THREE.Color(0xf0a070), night: new THREE.Color(0x0c1630) };
  const tmpC = new THREE.Color();
  let daylight = 1;
  // t: 0..1 (0 — рассвет, 0.25 — полдень, 0.5 — закат, 0.75 — полночь)
  function updateSky(t, center, dt, time) {
    const a = t * Math.PI * 2, el = Math.sin(a);
    daylight = smooth(-0.12, 0.3, el);
    const dusk = Math.max(0, 1 - Math.abs(el) * 4) * (el > -0.3 ? 1 : 0);
    tmpC.copy(SKY.night).lerp(SKY.day, daylight).lerp(SKY.dusk, dusk * 0.55);
    scene.background = tmpC.clone(); if (scene.fog) scene.fog.color.copy(tmpC);
    const sdir = new THREE.Vector3(Math.cos(a) * 0.8, el, 0.45).normalize();
    const mdir = sdir.clone().multiplyScalar(-1); mdir.y = Math.abs(mdir.y) + 0.2; mdir.normalize();
    const useSun = el > -0.05;
    const L = useSun ? sdir : mdir;
    sun.position.copy(center).addScaledVector(L, 120); sun.target.position.copy(center);
    sun.intensity = useSun ? 0.3 + 0.95 * daylight : 0.35;
    sun.color.setHex(useSun ? (dusk > 0.3 ? 0xffc890 : 0xfff2d8) : 0x8aa8ff);
    hemi.intensity = 0.38 + 0.32 * daylight;
    hemi.color.setHex(daylight > 0.3 ? 0xcfe8ff : 0x6a80c0);
    sunMesh.position.copy(center).addScaledVector(sdir, 380); sunMesh.visible = el > -0.1;
    moonMesh.position.copy(center).addScaledVector(mdir, 380); moonMesh.visible = el < 0.1;
    stars.material.opacity = Math.max(0, 1 - daylight * 2.5);
    stars.position.copy(center);
    clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > center.x + 280) c.position.x = center.x - 280; c.material.color.setScalar(0.35 + 0.65 * daylight); });
    water.material.color.setHex(daylight > 0.3 ? 0x3a8ac8 : 0x1a3a68);
    water.position.y = WATER_Y + Math.sin(time * 0.8) * 0.04;
    flock.forEach((b, i) => {
      const f = b.userData.fl, ang = time * f.sp + f.ph;
      b.position.set(f.cx + Math.cos(ang) * f.r, f.h + Math.sin(time * 0.7 + i) * 2, f.cz + Math.sin(ang) * f.r);
      b.rotation.y = -ang; Models.animBird(b, (Math.sin(time * 0.5 + i) > -0.2) ? 'fly' : 'glide', time, i);
    });
    return daylight;
  }

  function applyQuality(q) {
    quality = q;
    if (!grassMesh) return;
    const frac = { low: 0, medium: 0.3, high: 0.65, ultra: 1 }[q] ?? 0.3;
    grassMesh.count = Math.floor(grassMesh.userData.max * frac);
    grassMesh.visible = frac > 0;
    flowerMesh.count = Math.floor(flowerMesh.userData.max * Math.max(0.2, frac));
    sun.castShadow = q !== 'low';
    const ms = { low: 512, medium: 1024, high: 2048, ultra: 4096 }[q] || 1024;
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  }

  return { build, generate, seedFrom, biomeOf, heightAt, groundAt, inWater, inMine, nodes, nodesNear, updateNodeMatrix, updateSky, applyQuality, WATER_Y, MINE, LAKE, CAVE, BIOMES, get seed() { return W.seed; }, get biome() { return W.biome; }, get daylight() { return daylight; }, get sun() { return sun; } };
})();
