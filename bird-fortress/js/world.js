'use strict';
// ============ Мир: рельеф, лес, вода, горы, карьер, пещера, день/ночь ============
const World = (() => {
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const perm = new Uint8Array(512);
  { const r = mulberry32(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
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

  const WATER_Y = -0.9;
  const MINE = { x: 112, z: -72 };
  const LAKE = { x: -88, z: 72, r: 24 };
  const CAVE = { x: -112, z: -118 };
  const BRIDGE = { z: -24, w: 3.4 };
  const riverX = z => 72 + Math.sin(z * 0.025) * 18;
  const mineLen = Math.hypot(MINE.x, MINE.z), mdx = -MINE.x / mineLen, mdz = -MINE.z / mineLen;

  function mineCarve(x, z) {
    const dx = x - MINE.x, dz = z - MINE.z, md = Math.hypot(dx, dz);
    const pit = 1 - smooth(14, 20, md);
    const proj = dx * mdx + dz * mdz, perp = Math.abs(dx * -mdz + dz * mdx);
    const canyon = (proj > 0 && proj < 42) ? (1 - smooth(4, 7.5, perp)) * (1 - smooth(36, 42, proj)) : 0;
    return { md, carve: Math.max(pit, canyon) };
  }
  function heightAt(x, z) {
    const d = Math.hypot(x, z);
    let h = (fbm(x * 0.012 + 10, z * 0.012 - 5) - 0.5) * 14 + (fbm(x * 0.05, z * 0.05) - 0.5) * 2.5;
    h *= smooth(28, 62, d);
    const m = smooth(150, 215, d); h += m * m * 60 * (0.55 + 0.9 * fbm(x * 0.02, z * 0.02));
    // карьер
    const mc = mineCarve(x, z);
    const hill = 19 * Math.exp(-(mc.md * mc.md) / (2 * 25 * 25));
    h = lerp(h + hill, 0.4, mc.carve);
    // пещера: холм
    const cd = Math.hypot(x - CAVE.x, z - CAVE.z); h += 14 * Math.exp(-(cd * cd) / (2 * 14 * 14));
    // река
    const rd = Math.abs(x - riverX(z)); h = lerp(-2.4, h, smooth(3.5, 11, rd));
    // озеро
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z); h = lerp(-2.7, h, smooth(LAKE.r - 9, LAKE.r + 4, ld));
    return h;
  }
  function onBridge(x, z) { const rx = riverX(BRIDGE.z); return Math.abs(z - BRIDGE.z) < BRIDGE.w / 2 && Math.abs(x - rx) < 13; }
  function groundAt(x, z) { const h = heightAt(x, z); if (onBridge(x, z)) return Math.max(h, 0.35); return h; }
  function inWater(x, z) { return !onBridge(x, z) && heightAt(x, z) < WATER_Y - 0.25; }
  function inMine(x, z) { return Math.hypot(x - MINE.x, z - MINE.z) < 19; }

  let scene, sun, hemi, sunMesh, moonMesh, stars, clouds = [], water, grassMesh, flowerMesh, flock = [];
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

  function build(scn, quality) {
    scene = scn;
    // ----- Рельеф -----
    const SIZE = 460, SEG = 150;
    const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position; const cols = new Float32Array(pos.count * 3);
    const cGrass1 = new THREE.Color(0x5e9f38), cGrass2 = new THREE.Color(0x86b84a), cDirt = new THREE.Color(0xc9a36a), cSand = new THREE.Color(0xd8c48a),
      cRock = new THREE.Color(0x8a8780), cSnow = new THREE.Color(0xf4f6fa), cMud = new THREE.Color(0x7a6a50), cPit = new THREE.Color(0x857868), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
      const d = Math.hypot(x, z);
      const slope = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
      tmp.copy(cGrass1).lerp(cGrass2, fbm(x * 0.03, z * 0.03));
      tmp.lerp(cDirt, 1 - smooth(20, 27, d)); // утоптанная площадка базы
      const mc = mineCarve(x, z); if (mc.carve > 0.2) tmp.lerp(cPit, mc.carve);
      if (h < -0.35) tmp.copy(cSand); if (h < -1.3) tmp.copy(cMud);
      if (slope > 2.2 || h > 12) tmp.lerp(cRock, Math.min(1, Math.max((slope - 2.2) / 2, (h - 12) / 6)));
      if (h > 42) tmp.lerp(cSnow, Math.min(1, (h - 42) / 8));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
    terrain.receiveShadow = true; scene.add(terrain);

    // ----- Вода -----
    water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a8ac8, transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.2 }));
    water.position.y = WATER_Y; scene.add(water);

    // ----- Мост -----
    const bx = riverX(BRIDGE.z);
    const bridge = new THREE.Group(); bridge.position.set(bx, 0.3, BRIDGE.z);
    Models.box(26, 0.2, BRIDGE.w, Models.texMat(Models.T.planks()), 0, 0, 0, bridge);
    for (let i = -6; i <= 6; i += 2) [-1, 1].forEach(s => Models.cyl(0.15, 0.15, 3.2, 0x6e4622, i * 2, -0.8, s * BRIDGE.w / 2, bridge, 6));
    [-1, 1].forEach(s => Models.box(26, 0.12, 0.12, 0x6e4622, 0, 0.8, s * BRIDGE.w / 2, bridge));
    scene.add(bridge);

    // ----- Горы вдали -----
    const mParts = [];
    const rr = mulberry32(99);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + rr() * 0.1, R = 270 + rr() * 70, hgt = 60 + rr() * 80, rad = 35 + rr() * 30;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      mParts.push([new THREE.ConeGeometry(rad, hgt, 7), 0x6a7480, Models.mtx(x, hgt / 2 - 8, z, 1, 1, 1, rr() * 3)]);
      mParts.push([new THREE.ConeGeometry(rad * 0.36, hgt * 0.36, 7), 0xf2f4f8, Models.mtx(x, hgt - 8 - hgt * 0.18 + 0.5, z, 1, 1, 1, rr() * 3)]);
    }
    const mountains = new THREE.Mesh(Models.merge(mParts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    scene.add(mountains);

    // ----- Ресурсы (деревья, камни, руда, ягоды) -----
    const rnd = mulberry32(42);
    const occupied = (x, z, r) => { for (const n of nodesNear(x, z, r + 3)) if (Math.hypot(n.x - x, n.z - z) < r + n.r) return true; return false; };
    function addNode(kind, sub, x, z, scale) {
      const n = { kind, sub, x, z, y: groundAt(x, z), scale, r: (kind === 'tree' ? 0.45 : 0.95) * scale, hp: NODE_INFO[kind].hp, maxHp: NODE_INFO[kind].hp, alive: true, regrow: 0, rot: rnd() * 6.28, idx: nodes.length, acc: 0, shake: 0, grow: 1 };
      nodes.push(n); gridAdd(n); return n;
    }
    const valid = (x, z, minD) => {
      const d = Math.hypot(x, z); if (d < minD || d > 172) return false;
      const h = heightAt(x, z); if (h < WATER_Y + 0.4 || h > 18) return false;
      const sl = Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h); if (sl > 1.4) return false;
      if (Math.abs(BRIDGE.z - z) < 5 && Math.abs(x - riverX(z)) < 20) return false;
      return true;
    };
    let tries = 0, trees = 0;
    while (trees < 430 && tries < 9000) {
      tries++;
      const x = (rnd() - 0.5) * 360, z = (rnd() - 0.5) * 360;
      if (!valid(x, z, 33)) continue;
      if (mineCarve(x, z).md < 32) continue;
      const dens = fbm(x * 0.022 + 3, z * 0.022 + 7);
      if (dens < 0.42 && Math.hypot(x, z) > 60) continue;
      const s = 0.8 + rnd() * 0.6;
      if (occupied(x, z, 1.6 * s)) continue;
      const r = rnd(); addNode('tree', r < 0.55 ? 'pine' : (r < 0.85 ? 'oak' : 'birch'), x, z, s); trees++;
    }
    const scatter = (kind, count, fx) => { let c = 0, t = 0; while (c < count && t < 3000) { t++; const p = fx(); if (!p) continue; const [x, z, s] = p; if (occupied(x, z, 1.2 * s)) continue; addNode(kind, kind, x, z, s); c++; } };
    // камни по миру
    scatter('stone', 34, () => { const a = rnd() * 6.28, R = 34 + rnd() * 120, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 32) ? [x, z, 0.8 + rnd() * 0.5] : null; });
    // карьер: камень, уголь, железо
    const inPit = () => { const a = rnd() * 6.28, R = 3 + rnd() * 12; return [MINE.x + Math.cos(a) * R, MINE.z + Math.sin(a) * R, 0.8 + rnd() * 0.4]; };
    scatter('stone', 14, inPit); scatter('coal', 12, inPit); scatter('iron', 10, inPit);
    // уголь у гор и железо у пещеры
    scatter('coal', 6, () => { const a = rnd() * 6.28, R = 135 + rnd() * 25, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 120) ? [x, z, 0.9] : null; });
    scatter('iron', 5, () => { const a = rnd() * 6.28, R = 4 + rnd() * 9; const x = CAVE.x + 12 + Math.cos(a) * R, z = CAVE.z + 12 + Math.sin(a) * R; return heightAt(x, z) > WATER_Y + 0.4 ? [x, z, 0.9] : null; });
    // ягоды
    scatter('berry', 30, () => { const a = rnd() * 6.28, R = 30 + rnd() * 90, x = Math.cos(a) * R, z = Math.sin(a) * R; return valid(x, z, 29) ? [x, z, 0.9 + rnd() * 0.3] : null; });

    // Инстансинг
    const tg2 = Models.treeGeos(), rg = Models.rockGeos();
    const vMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    const geos = { pine: tg2.pine, oak: tg2.oak, birch: tg2.birch, stone: rg.stone, coal: rg.coal, iron: rg.iron, berry: rg.berry };
    for (const sub in geos) {
      const list = nodes.filter(n => n.sub === sub);
      const im = new THREE.InstancedMesh(geos[sub], vMat, Math.max(1, list.length));
      im.castShadow = true; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((n, i) => { n.im = im; n.ii = i; const c = new THREE.Color(1, 1, 1); c.offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12); im.setColorAt(i, c); updateNodeMatrix(n); });
      im.count = list.length; scene.add(im); nodeMeshes[sub] = im;
    }

    // ----- Трава, цветы и кусты (декор) -----
    const blade = Models.merge([
      [new THREE.ConeGeometry(0.06, 0.55, 3), 0x5a9a34, Models.mtx(0, 0.27, 0)],
      [new THREE.ConeGeometry(0.05, 0.45, 3), 0x72b040, Models.mtx(0.08, 0.22, 0.03, 1, 1, 1, 0, 0, -0.3)],
      [new THREE.ConeGeometry(0.05, 0.4, 3), 0x4a8a2c, Models.mtx(-0.07, 0.2, -0.02, 1, 1, 1, 0, 0.2, 0.3)],
    ]);
    const GRASS_MAX = 16000;
    const vMat2 = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    grassMesh = new THREE.InstancedMesh(blade, vMat2, GRASS_MAX); grassMesh.receiveShadow = true;
    const gm = new THREE.Matrix4(); let gi = 0, gt = 0;
    while (gi < GRASS_MAX && gt < GRASS_MAX * 4) {
      gt++; const a = rnd() * 6.28, R = 18 + Math.pow(rnd(), 0.8) * 130, x = Math.cos(a) * R, z = Math.sin(a) * R;
      const h = heightAt(x, z); if (h < WATER_Y + 0.3 || h > 14 || mineCarve(x, z).carve > 0.1) continue;
      if (Math.hypot(x, z) < 26 && rnd() < 0.85) continue;
      const s = 0.7 + rnd() * 0.9; gm.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(s, s, s));
      grassMesh.setMatrixAt(gi++, gm);
    }
    grassMesh.userData.max = gi; scene.add(grassMesh);
    const flower = Models.merge([[new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), 0x3a7a2a, Models.mtx(0, 0.2, 0)], [new THREE.IcosahedronGeometry(0.1, 0), 0xffffff, Models.mtx(0, 0.42, 0)]]);
    flowerMesh = new THREE.InstancedMesh(flower, vMat, 1500);
    const fcols = [0xf8e040, 0xffffff, 0xc070e0, 0xf06080, 0x60a0f0];
    for (let i = 0; i < 1500; i++) {
      let x, z, h, t = 0; do { const a = rnd() * 6.28, R = 22 + rnd() * 120; x = Math.cos(a) * R; z = Math.sin(a) * R; h = heightAt(x, z); t++; } while ((h < WATER_Y + 0.4 || h > 12) && t < 20);
      gm.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + rnd() * 0.6));
      flowerMesh.setMatrixAt(i, gm); flowerMesh.setColorAt(i, new THREE.Color(fcols[i % 5]));
    }
    scene.add(flowerMesh);
    const bushG = Models.merge([[new THREE.IcosahedronGeometry(0.7, 0), 0x3f7f32, Models.mtx(0, 0.45, 0, 1.3, 0.8, 1.2)], [new THREE.IcosahedronGeometry(0.5, 0), 0x4c8f3a, Models.mtx(0.5, 0.35, 0.2)]]);
    const bushes = new THREE.InstancedMesh(bushG, vMat2, 260); bushes.castShadow = true; bushes.receiveShadow = true;
    for (let i = 0; i < 260; i++) {
      let x, z, t = 0; do { const a = rnd() * 6.28, R = 32 + rnd() * 140; x = Math.cos(a) * R; z = Math.sin(a) * R; t++; } while (!valid(x, z, 30) && t < 20);
      gm.compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 6, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + rnd() * 0.8));
      bushes.setMatrixAt(i, gm);
    }
    scene.add(bushes);
    // камешки
    const pebG = Models.merge([[new THREE.DodecahedronGeometry(0.35, 0), 0x8a8a86, Models.mtx(0, 0.1, 0, 1, 0.6, 1)]]);
    const peb = new THREE.InstancedMesh(pebG, vMat2, 300);
    for (let i = 0; i < 300; i++) { const a = rnd() * 6.28, R = 25 + rnd() * 150, x = Math.cos(a) * R, z = Math.sin(a) * R; gm.compose(new THREE.Vector3(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.5 + rnd())); peb.setMatrixAt(i, gm); }
    scene.add(peb);

    buildMine(); buildCave(); buildNests(rnd);
    buildSky();
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
    const a = Math.atan2(-mdz, -mdx); // направление от центра к дальней стене
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
    const sp = new THREE.Group(); sp.position.set(30, heightAt(30, -16), -16);
    Models.cyl(0.1, 0.1, 2.2, 0x6e4622, 0, 1.1, 0, sp, 6);
    const arrow = Models.box(1.6, 0.4, 0.08, 0xc89a5e, 0.5, 1.9, 0, sp); arrow.rotation.y = 0.4;
    g.add(sp);
    scene.add(g);
    void a;
  }
  function buildCave() {
    const g = new THREE.Group(); const cx = CAVE.x + 9, cz = CAVE.z + 9; const h = heightAt(cx, cz);
    g.position.set(cx, h, cz); g.rotation.y = Math.atan2(1, 1);
    Models.sph(6, 5, 2.5, 0x070707, 0, 1.6, -0.6, g, false, false);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (i / 8); const r = Models.sph(2 + (i % 3) * 0.5, 2, 2, 0x7a7670, Math.cos(a) * 3.6, Math.sin(a) * 3.6 + 0.3, 0.3, g, true); r.rotation.set(i, i * 2, 0); }
    // светящиеся кристаллы
    for (let i = 0; i < 5; i++) { const c = Models.cone(0.25, 1, Models.mat(0x60d0ff, { emissive: 0x2080ff, emissiveIntensity: 1.2 }), -2 + i, 0.4, -0.2, g, 5, false); c.rotation.z = (i - 2) * 0.2; }
    scene.add(g);
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
      scene.add(g);
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
    if (!grassMesh) return;
    const frac = { low: 0, medium: 0.3, high: 0.65, ultra: 1 }[q] ?? 0.3;
    grassMesh.count = Math.floor(grassMesh.userData.max * frac);
    grassMesh.visible = frac > 0;
    flowerMesh.count = Math.floor(1500 * Math.max(0.2, frac));
    sun.castShadow = q !== 'low';
    const ms = { low: 512, medium: 1024, high: 2048, ultra: 4096 }[q] || 1024;
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  }

  return { build, heightAt, groundAt, inWater, inMine, nodes, nodesNear, updateNodeMatrix, updateSky, applyQuality, WATER_Y, MINE, LAKE, CAVE, riverX, get daylight() { return daylight; }, get sun() { return sun; } };
})();
