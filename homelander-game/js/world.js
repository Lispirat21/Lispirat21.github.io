// Город: кварталы, здания (склеенная геометрия), Белый дом, башня Vought, порт, парки
HL.World = (function () {
  const T = THREE, U = HL.U, M = HL.Models;
  const PITCH = 70, ROAD = 14, HALF = 280; // дороги по x,z = 0, ±70, ±140, ±210, ±280

  const PALETTES = [
    { wall: '#e0705c', glass: '#3c6fd2' },
    { wall: '#d4523e', glass: '#3a66c4' },
    { wall: '#ead8b4', glass: '#4878c8' },
    { wall: '#b9bdc6', glass: '#3e5f9a' },
    { wall: '#e6ad4c', glass: '#3f6cc0' },
    { wall: '#f0e6d8', glass: '#4a82d0' },
  ];

  function facadeTex(p, night, seed) {
    const r = U.seeded(seed);
    const N = 8, S = 64;
    const mk = (emissive) => M.canvasTex(N * S, N * S, (x) => {
      x.fillStyle = emissive ? '#000' : p.wall; x.fillRect(0, 0, N * S, N * S);
      const rr = U.seeded(seed + 99);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const ox = i * S, oy = j * S;
        const lit = night && rr() < 0.35;
        if (!emissive) {
          x.fillStyle = '#fbfbf6'; x.fillRect(ox + 12, oy + 8, 40, 46);
          const g = x.createLinearGradient(0, oy + 12, 0, oy + 50);
          g.addColorStop(0, night ? '#1a2440' : '#7fa6ec'); g.addColorStop(1, night ? '#0d1428' : p.glass);
          x.fillStyle = g; x.fillRect(ox + 16, oy + 12, 32, 38);
          x.fillStyle = '#fbfbf6'; x.fillRect(ox + 31, oy + 12, 2, 38);
          if (r() < 0.3) { x.fillStyle = '#e8e8e2'; for (let k = 0; k < 6; k++) x.fillRect(ox + 12 + k * 7.5, oy + 40, 3, 16); x.fillRect(ox + 10, oy + 38, 44, 3); }
        } else if (lit) {
          x.fillStyle = rr() < 0.5 ? '#ffd88a' : '#ffeab8'; x.fillRect(ox + 16, oy + 12, 32, 38);
        }
      }
    });
    const map = mk(false);
    map.anisotropy = 4;
    const emap = night ? mk(true) : null;
    return { map, emap };
  }

  // Геометрия-сборщик: много коробок в один буфер
  function Builder() { return { pos: [], nor: [], uv: [], col: [], idx: [] }; }
  function quad(b, p, n, uw, vh, color) {
    const i = b.pos.length / 3;
    for (const q of p) b.pos.push(q[0], q[1], q[2]);
    for (let k = 0; k < 4; k++) b.nor.push(n[0], n[1], n[2]);
    b.uv.push(0, 0, uw, 0, uw, vh, 0, vh);
    if (color) for (let k = 0; k < 4; k++) b.col.push(color.r, color.g, color.b);
    b.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  function boxSides(b, x0, y0, z0, x1, y1, z1, tw, th, color, top) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, uw = w / tw, ud = d / tw, vh = h / th;
    quad(b, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], uw, vh, color);
    quad(b, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], uw, vh, color);
    quad(b, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], ud, vh, color);
    quad(b, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], ud, vh, color);
    if (top) quad(top, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], w / 8, d / 8, color);
  }
  function toGeo(b) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
    if (b.col.length) g.setAttribute('color', new T.Float32BufferAttribute(b.col, 3));
    g.setIndex(b.idx);
    g.computeBoundingSphere();
    return g;
  }

  function usFlagTex() {
    const t = HL.Models.canvasTex(192, 100, (x, w, h) => {
      for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#c22a33'; x.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
      x.fillStyle = '#2a3a7a'; x.fillRect(0, 0, w * 0.42, h * (7 / 13));
      x.fillStyle = '#fff'; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) x.fillRect(6 + c * 13, 5 + r * 10, 3, 3);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  function build(scene, opts = {}) {
    const time = opts.time || 'day';
    const night = time === 'night';
    const S = HL.Settings;
    const rnd = U.seeded(1337);
    const W = {
      boxes: [], grid: new Map(), cell: 40, time, night, group: new T.Group(), parks: [], sidewalkPts: [], lots: [], special: {},
      clouds: [], updaters: [], HALF, PITCH, ROAD,
    };
    scene.add(W.group);
    const add = (o) => { W.group.add(o); return o; };

    // ---------- небо и свет ----------
    const SKY = {
      day: { top: 0x3f7fd8, bot: 0xb9d6f2, fog: 0xb5d1ee, hemiS: 0xcfe4ff, hemiG: 0x6a6050, sun: 0xffffff, sunI: 1.15, hemiI: 0.75 },
      dusk: { top: 0x3a3f7a, bot: 0xf2a070, fog: 0xd99a7a, hemiS: 0xffc8a0, hemiG: 0x4a3a40, sun: 0xffb070, sunI: 1.0, hemiI: 0.6 },
      dawn: { top: 0x5a7ab8, bot: 0xf0c8a0, fog: 0xd8c0aa, hemiS: 0xffe0c0, hemiG: 0x5a5050, sun: 0xffd0a0, sunI: 1.0, hemiI: 0.65 },
      night: { top: 0x04060f, bot: 0x18203a, fog: 0x141a2e, hemiS: 0x4a5a90, hemiG: 0x15131a, sun: 0x8aa0ff, sunI: 0.35, hemiI: 0.42 },
    }[time];
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color(SKY.top) }, bot: { value: new T.Color(SKY.bot) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.08,0.0,1.0); gl_FragColor = vec4(mix(bot, top, pow(h,0.7)),1.0); }',
    });
    const sky = new T.Mesh(new T.SphereGeometry(1400, 24, 12), skyMat); sky.renderOrder = -1;
    W.sky = add(sky);
    scene.fog = new T.Fog(SKY.fog, S.drawDistance * 0.35, S.drawDistance);
    scene.background = new T.Color(SKY.fog);
    const hemi = new T.HemisphereLight(SKY.hemiS, SKY.hemiG, SKY.hemiI); add(hemi);
    const sun = new T.DirectionalLight(SKY.sun, SKY.sunI);
    sun.position.set(80, 160, 60);
    add(sun); add(sun.target);
    W.sun = sun; W.sunOffset = new T.Vector3(70, 140, 50);
    if (S.data.shadows > 0) {
      sun.castShadow = true;
      const sz = S.shadowSize, ext = [0, 45, 70, 95][S.data.shadows];
      sun.shadow.mapSize.set(sz, sz);
      Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 420 });
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    }
    if (night) {
      const g = new T.BufferGeometry(); const p = [];
      for (let i = 0; i < 900; i++) { const a = rnd() * Math.PI * 2, e = 0.08 + rnd() * 1.4; p.push(Math.cos(a) * Math.cos(e) * 1300, Math.sin(e) * 1300, Math.sin(a) * Math.cos(e) * 1300); }
      g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      W.stars = add(new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
      const moon = M.glowSprite(0xdde6ff, 160); moon.position.set(-500, 600, -800); add(moon);
    } else {
      // облака
      const cm = M.toon(time === 'day' ? 0xffffff : 0xffd8c8);
      for (let i = 0; i < 16; i++) {
        const cg = new T.Group();
        for (let k = 0; k < 5; k++) {
          const s = new T.Mesh(M.sph(1), cm); s.scale.set(10 + rnd() * 10, 5 + rnd() * 4, 8 + rnd() * 6); s.position.set((k - 2) * 11 + rnd() * 5, rnd() * 4, rnd() * 8); cg.add(s);
        }
        cg.position.set((rnd() - 0.5) * 1200, 170 + rnd() * 80, (rnd() - 0.5) * 1200);
        add(cg); W.clouds.push(cg);
      }
    }

    // ---------- земля и дороги ----------
    const ground = new T.Mesh(new T.PlaneGeometry(2600, 2600), M.toon(night ? 0x2a2c33 : 0x5d6068));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);
    const grass = new T.Mesh(new T.RingGeometry(HALF + 30, 1300, 4, 1, Math.PI / 4), M.toon(night ? 0x1e3020 : 0x5f9a4a));
    grass.rotation.x = -Math.PI / 2; grass.position.y = 0.03; grass.scale.set(1.414, 1.414, 1); add(grass);

    const markM = new T.MeshBasicMaterial({ color: night ? 0xb8b8b0 : 0xf4f4ee });
    const dashes = [];
    for (let k = -4; k <= 4; k++) {
      const c = k * PITCH;
      for (let s = -HALF; s < HALF; s += 8) {
        const inX = Math.abs(((s % PITCH) + PITCH) % PITCH) < ROAD / 2 + 1 || Math.abs(((s % PITCH) + PITCH) % PITCH) > PITCH - ROAD / 2 - 1;
        if (inX) continue;
        if (k === 0) { dashes.push([c, s + 4, 0.5, 8.2]); } // сплошная по главному проспекту
        else dashes.push([c, s + 4, 0.35, 4]);
        dashes.push([s + 4, c, 4, 0.35]);
      }
    }
    const dm = new T.InstancedMesh(new T.BoxGeometry(1, 0.05, 1), markM, dashes.length);
    const mtx = new T.Matrix4();
    dashes.forEach((d, i) => { mtx.makeScale(d[2], 1, d[3]); mtx.setPosition(d[0], 0.03, d[1]); dm.setMatrixAt(i, mtx); });
    add(dm);

    // ---------- здания ----------
    const pal = PALETTES.map((p, i) => ({ p, tex: facadeTex(p, night, 50 + i), b: Builder(), top: Builder() }));
    const shops = Builder();
    const pave = [];
    const trees = [];
    const lamps = [];
    const SHOPC = [0xc8302a, 0x2a52b0, 0xe6b23c, 0x2f8a4a, 0x222222, 0xf2f2f2].map((c) => new T.Color(c));

    const addBox = (x0, z0, x1, z1, h, kind, ref) => {
      const b = { x0, x1, z0, z1, y0: 0, y1: h, kind, ref, id: W.boxes.length };
      W.boxes.push(b);
      const c = W.cell;
      for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
        for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
          const k = i + ',' + j; if (!W.grid.has(k)) W.grid.set(k, []); W.grid.get(k).push(b);
        }
      return b;
    };
    W.addBox = addBox;
    W.removeBox = (b) => {
      const i = W.boxes.indexOf(b); if (i >= 0) W.boxes.splice(i, 1);
      for (const L of W.grid.values()) { const j = L.indexOf(b); if (j >= 0) L.splice(j, 1); }
    };

    const building = (x0, z0, x1, z1, h, pi, opt = {}) => {
      const P = pal[pi % pal.length];
      const mark = [P.b, P.top, shops].map((bl) => [bl, bl.pos.length / 3]);
      boxSides(P.b, x0, 0, z0, x1, h, z1, 30, 28, null, P.top);
      if (opt.shop !== false && h > 10) boxSides(shops, x0 - 0.35, 0, z0 - 0.35, x1 + 0.35, 4.2, z1 + 0.35, 1, 1, U.pick(SHOPC), shops);
      if (S.data.details > 1 && rnd() < 0.6) { // крыши: вентиляция
        const cx = U.lerp(x0 + 3, x1 - 3, rnd()), cz = U.lerp(z0 + 3, z1 - 3, rnd());
        boxSides(P.top, cx - 1.5, h, cz - 1.5, cx + 1.5, h + 2, cz + 1.5, 8, 8, null, P.top);
      }
      const box = addBox(x0, z0, x1, z1, h, 'building', opt.ref);
      box.parts = mark.map(([bl, s]) => ({ bl, s, e: bl.pos.length / 3 })).filter((q) => q.e > q.s);
      box.h0 = h; box.hp = box.maxHp = 160 + h * 8;
      return box;
    };
    W.building = building;

    // ---------- разрушаемость ----------
    W.destructible = false; // дома не ломаются (по просьбе игрока); код обрушения оставлен выключенным
    W.damageBuilding = function (b, amount, point) {
      if (!W.destructible || !b || b.kind !== 'building' || b.dead || !b.parts) return false;
      const before = b.hp / b.maxHp;
      b.hp -= amount;
      const fx = W.fx, after = Math.max(0, b.hp / b.maxHp);
      W.onDamage && W.onDamage(b, after);
      // каждые 25% — от здания откалываются куски
      if (fx && point && Math.floor(before * 4) !== Math.floor(after * 4) && after > 0) {
        fx.burst(point, 18, { color: [0x9a9590, 0x6a6560, 0xd0c8b8], speed: 14, size: 0.6, life: 1.4, g: -20 });
        fx.dust(point, 6); fx.addShake(0.35); HL.Audio.slam();
      }
      if (fx && point) {
        if (Math.random() < Math.min(1, amount / 40)) fx.burst(point, 2, { color: [0x8a8a8a, 0x5a5a5a, 0xc0b8a8], speed: 6, size: 0.3, life: 0.7, g: -18 });
        if (b.hp < b.maxHp * 0.5 && Math.random() < 0.15) fx.smoke(point, 1);
      }
      if (b.hp <= b.maxHp * 0.6 && !b.burning) { b.burning = true; b.firePt = point ? point.clone() : new T.Vector3((b.x0 + b.x1) / 2, b.y1 * 0.6, (b.z0 + b.z1) / 2); }
      if (b.hp <= 0) { collapse(b); return true; }
      return false;
    };
    function collapse(b) {
      b.dead = true; b.burning = false;
      const fx = W.fx, A = HL.Audio;
      for (const q of b.parts) {
        const pa = q.bl.mesh.geometry.attributes.position;
        q.y = pa.array.slice(q.s * 3, q.e * 3);
      }
      if (fx) fx.clearScorch(b);
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, base = new T.Vector3(cx, 0, cz);
      A && A.explosion && A.explosion(1.6);
      W.onCollapse && W.onCollapse(b, base);
      let t = 0; const D = 3.2, sink = b.h0 - 1.4;
      const f = (dt) => {
        t += dt; const k = Math.min(1, t / D), e = k * k * (3 - 2 * k), dy = sink * e;
        const jit = (1 - k) * 0.25;
        const jx = (Math.random() - 0.5) * jit, jz = (Math.random() - 0.5) * jit;
        for (const q of b.parts) {
          const pa = q.bl.mesh.geometry.attributes.position, arr = pa.array, o = q.s * 3;
          for (let i = 0; i < q.y.length; i += 3) { arr[o + i] = q.y[i] + jx; arr[o + i + 1] = Math.max(-0.5, q.y[i + 1] - dy); arr[o + i + 2] = q.y[i + 2] + jz; }
          pa.needsUpdate = true;
        }
        b.y1 = Math.max(1.6, b.h0 - dy);
        if (fx) {
          if (Math.random() < dt * 30) fx.dust(new T.Vector3(U.lerp(b.x0, b.x1, Math.random()), 0.5, Math.random() < 0.5 ? b.z0 : b.z1), 2);
          if (Math.random() < dt * 30) fx.dust(new T.Vector3(Math.random() < 0.5 ? b.x0 : b.x1, 0.5, U.lerp(b.z0, b.z1, Math.random())), 2);
          if (Math.random() < dt * 12) fx.smoke(new T.Vector3(U.lerp(b.x0, b.x1, Math.random()), b.y1 + 1, U.lerp(b.z0, b.z1, Math.random())), 2);
          if (k < 0.9) fx.addShake(0.25 * dt * 10);
        }
        if (k >= 1) {
          rubble(b);
          W.updaters.splice(W.updaters.indexOf(f), 1);
        }
      };
      W.updaters.push(f);
    }
    const rubbleMats = [0x7a7672, 0x5e5a56, 0x8f8a82, 0x4a4744].map((c) => M.toon(c));
    function rubble(b) {
      const grp = new T.Group(), w = b.x1 - b.x0, d = b.z1 - b.z0, n = Math.min(40, 10 + ((w * d) / 40) | 0);
      for (let i = 0; i < n; i++) {
        const s = 1 + Math.random() * 3;
        const m = new T.Mesh(M.box(s * (0.8 + Math.random()), s * 0.6, s * (0.8 + Math.random())), rubbleMats[i % 4]);
        m.position.set(U.lerp(b.x0 + 1, b.x1 - 1, Math.random()), 0.6 + Math.random() * 1.2, U.lerp(b.z0 + 1, b.z1 - 1, Math.random()));
        m.rotation.set(Math.random() - 0.5, Math.random() * 3, Math.random() - 0.5); m.castShadow = true;
        grp.add(m);
      }
      add(grp);
      // тлеющие обломки
      if (W.fx) { const fx = W.fx; let tt = 0; const sm = (dt) => { tt += dt; if (Math.random() < dt * 4) fx.smoke(new T.Vector3(U.lerp(b.x0, b.x1, Math.random()), 2, U.lerp(b.z0, b.z1, Math.random())), 1); if (tt > 25) W.updaters.splice(W.updaters.indexOf(sm), 1); }; W.updaters.push(sm); }
    }

    const blockCenters = [];
    for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) blockCenters.push([i * PITCH + PITCH / 2, j * PITCH + PITCH / 2]);

    for (const [cx, cz] of blockCenters) {
      const bx0 = cx - (PITCH - ROAD) / 2, bx1 = cx + (PITCH - ROAD) / 2, bz0 = cz - (PITCH - ROAD) / 2, bz1 = cz + (PITCH - ROAD) / 2;
      const key = cx + ',' + cz;
      // особые кварталы
      const kremlin = cz < -210 && Math.abs(cx) <= 105; // лужайка Белого дома
      const plaza = cz === -175 && Math.abs(cx) <= 35;
      const port = cx === 245;
      const isVought = cx === 105 && cz === 35;
      const park = !kremlin && !plaza && !port && !isVought && (key === '-105,-35' || key === '175,-105' || key === '-175,175' || key === '35,175' || rnd() < 0.06);
      const pavCol = park || kremlin ? (night ? 0x22401f : 0x6aaa4e) : plaza ? (night ? 0x4a4a52 : 0xb6b2aa) : (night ? 0x50535c : 0xa9adb4);
      pave.push([cx, cz, PITCH - ROAD, PITCH - ROAD, pavCol]);
      // фонари по периметру квартала
      for (let s = -1; s <= 1; s += 2) for (let t = -20; t <= 20; t += 20) { lamps.push([cx + s * ((PITCH - ROAD) / 2 - 1), cz + t]); }
      // точки тротуара для пешеходов
      for (let t = -24; t <= 24; t += 8) {
        W.sidewalkPts.push(new T.Vector3(bx0 + 1.5, 0, cz + t), new T.Vector3(bx1 - 1.5, 0, cz + t), new T.Vector3(cx + t, 0, bz0 + 1.5), new T.Vector3(cx + t, 0, bz1 - 1.5));
      }
      if (kremlin) {
        if (Math.abs(cx) > 40) for (let k = 0; k < 6; k++) trees.push([cx + (rnd() - 0.5) * 44, cz + (rnd() - 0.5) * 44, 1 + rnd() * 0.5]);
        continue;
      }
      if (plaza) { W.parks.push([cx, cz]); continue; }
      if (park) {
        W.parks.push([cx, cz]);
        for (let k = 0; k < 14; k++) trees.push([cx + (rnd() - 0.5) * 48, cz + (rnd() - 0.5) * 48, 0.8 + rnd() * 0.7]);
        continue;
      }
      if (port) { buildPort(cx, cz); continue; }
      if (isVought) { buildVought(cx, cz); continue; }
      // обычный квартал: 1..4 здания
      const m = 3, ix0 = bx0 + m, ix1 = bx1 - m, iz0 = bz0 + m, iz1 = bz1 - m;
      const distC = Math.hypot(cx, cz);
      const hmax = distC < 150 ? 58 : 36;
      const pi = (rnd() * pal.length) | 0;
      const split = rnd();
      const hh = () => 12 + rnd() * hmax;
      let lots = [];
      if (split < 0.25) lots = [[ix0, iz0, ix1, iz1]];
      else if (split < 0.55) { const s = U.lerp(ix0 + 14, ix1 - 14, rnd()); lots = [[ix0, iz0, s - 2, iz1], [s + 2, iz0, ix1, iz1]]; }
      else { const sx = (ix0 + ix1) / 2, sz = (iz0 + iz1) / 2; lots = [[ix0, iz0, sx - 2, sz - 2], [sx + 2, iz0, ix1, sz - 2], [ix0, sz + 2, sx - 2, iz1], [sx + 2, sz + 2, ix1, iz1]]; }
      for (const l of lots) {
        const h = Math.round(hh() / 3.5) * 3.5;
        const b = building(l[0], l[1], l[2], l[3], h, pi + ((rnd() * 2) | 0));
        W.lots.push(b);
      }
      // деревья вдоль тротуара
      if (rnd() < 0.5) for (let t = -18; t <= 18; t += 12) trees.push([bx0 + 1.2, cz + t, 0.6]);
    }

    function buildPort(cx, cz) {
      const wm = M.toon(night ? 0x4a5468 : 0x7d8aa2);
      for (const dz of [-14, 14]) {
        const x0 = cx - 24, x1 = cx + 20, z0 = cz + dz - 10, z1 = cz + dz + 10;
        const m = new T.Mesh(new T.BoxGeometry(x1 - x0, 11, z1 - z0), wm); m.position.set((x0 + x1) / 2, 5.5, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; add(m);
        const roof = new T.Mesh(new T.CylinderGeometry(10, 10, x1 - x0, 12, 1, false, 0, Math.PI), M.toon(night ? 0x3a3a48 : 0x5a6274));
        roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.z = 0.35; roof.position.set((x0 + x1) / 2, 11, (z0 + z1) / 2); add(roof);
        addBox(x0, z0, x1, z1, 13, 'warehouse');
      }
      const cc = [0xc8302a, 0x2a52b0, 0xe6b23c, 0x2f8a4a, 0xe07020];
      for (let k = 0; k < 7; k++) {
        const x = cx + 23 + (k % 2) * 3.2, z = cz - 24 + k * 7.5;
        const st = 1 + (k % 3 === 0 ? 1 : 0);
        for (let s = 0; s < st; s++) {
          const m = new T.Mesh(M.box(2.6, 2.6, 6), M.toon(cc[(k + s) % cc.length])); m.position.set(x, 1.3 + s * 2.6, z); m.castShadow = true; add(m);
        }
        addBox(x - 1.3, z - 3, x + 1.3, z + 3, 2.6 * st, 'container');
        W.special['container' + k] = new T.Vector3(x, 0, z);
      }
      // кран
      const crane = new T.Group();
      const cm = M.toon(0xe6a020);
      const p = new T.Mesh(M.box(2, 40, 2), cm); p.position.y = 20; crane.add(p);
      const a = new T.Mesh(M.box(30, 1.5, 1.5), cm); a.position.set(-8, 40, 0); crane.add(a);
      crane.position.set(cx + 27, 0, cz + 30); add(crane); addBox(cx + 26, cz + 29, cx + 28, cz + 31, 40, 'crane');
    }

    function buildVought(cx, cz) {
      const h = 150;
      const gl = new T.Mesh(new T.BoxGeometry(34, h, 34), M.toonX(0x2e4a7a, { emissive: night ? 0x0a1830 : 0x000000 }));
      gl.position.set(cx, h / 2, cz); gl.castShadow = true; add(gl);
      // полосы стекла
      for (let y = 6; y < h; y += 6) {
        const r = new T.Mesh(M.box(34.4, 0.6, 34.4), M.toon(0x9ab0cc)); r.position.set(cx, y, cz); add(r);
      }
      const top = new T.Mesh(new T.BoxGeometry(26, 14, 26), M.toon(0x1c2c48)); top.position.set(cx, h + 7, cz); add(top);
      // логотип V
      const vs = new T.Shape(); vs.moveTo(-5, 5); vs.lineTo(-2.6, 5); vs.lineTo(0, -1.6); vs.lineTo(2.6, 5); vs.lineTo(5, 5); vs.lineTo(1.2, -5); vs.lineTo(-1.2, -5); vs.closePath();
      const vg = new T.ShapeGeometry(vs);
      const vm = new T.MeshBasicMaterial({ color: 0xe6c060, side: T.DoubleSide, fog: false });
      for (let k = 0; k < 4; k++) {
        const v = new T.Mesh(vg, vm); const a = (k * Math.PI) / 2;
        v.position.set(cx + Math.sin(a) * 13.1, h + 7, cz + Math.cos(a) * 13.1); v.rotation.y = a; add(v);
      }
      addBox(cx - 17, cz - 17, cx + 17, cz + 17, h + 14, 'vought');
      W.special.vought = new T.Vector3(cx, h + 14, cz);
      W.parks.push([cx, cz]);
    }

    // ---------- Белый дом ----------
    {
      const zc = -254, wM = M.toon(night ? 0xc8ccd8 : 0xf4f2ec), dark = M.toon(night ? 0x2a3450 : 0x3a4250), roofM = M.toon(night ? 0x8a8e98 : 0xb8bcc4);
      const g = new T.Group(); g.position.set(0, 0, zc);
      const mk = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
      // главный корпус и крылья
      mk(new T.BoxGeometry(56, 18, 24), wM, 0, 9, 0);
      mk(new T.BoxGeometry(57, 1.2, 25), wM, 0, 18.6, 0);
      mk(new T.BoxGeometry(54, 2.6, 22), roofM, 0, 20.2, 0);
      for (const sx of [-1, 1]) { mk(new T.BoxGeometry(34, 9, 10), wM, sx * 44, 4.5, 4); mk(new T.BoxGeometry(35, 0.8, 10.6), wM, sx * 44, 9.2, 4); }
      // балюстрада
      const posts = new T.InstancedMesh(M.box(0.35, 1.3, 0.35), wM, 120); let pk = 0;
      for (let x = -27.5; x <= 27.5 && pk < 120; x += 1.1) { mtx.makeTranslation(x, 19.8 + 0, 12.1 + zc); posts.setMatrixAt(pk++, mtx); }
      posts.count = pk; add(posts);
      // окна южного фасада
      const wins = new T.InstancedMesh(M.box(1.8, 3.2, 0.3), dark, 80); let wk = 0;
      for (const y of [4, 12.5]) for (let x = -24; x <= 24; x += 4.6) { if (Math.abs(x) < 8) continue; mtx.makeTranslation(x, y, 12.05 + zc); wins.setMatrixAt(wk++, mtx); }
      for (const sx of [-1, 1]) for (let x = 30; x <= 58; x += 4) { mtx.makeTranslation(sx * x, 4.5, 9.05 + zc); wins.setMatrixAt(wk++, mtx); }
      wins.count = wk; add(wins);
      // полукруглый южный портик с колоннами
      const colG = new T.CylinderGeometry(0.55, 0.65, 16, 12);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (i / 6);
        mk(colG, wM, Math.cos(a) * 7.5, 8, 12 + Math.sin(a) * 7.5);
      }
      mk(new T.CylinderGeometry(8.6, 8.6, 1.6, 24, 1, false, Math.PI / 2, Math.PI), wM, 0, 16.6, 12);
      mk(new T.CylinderGeometry(8.0, 8.0, 0.5, 24, 1, false, Math.PI / 2, Math.PI), wM, 0, 0.25, 12);
      mk(new T.BoxGeometry(5, 7, 0.4), dark, 0, 3.5, 12.1);
      // флагшток и флаг США
      mk(new T.CylinderGeometry(0.12, 0.15, 12, 8), M.toon(0xdddddd), 0, 27, 0);
      const flagTex = usFlagTex(); /* (x, w, h) => {
        for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#c22a33'; x.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
        x.fillStyle = '#2a3a7a'; x.fillRect(0, 0, w * 0.42, h * (7 / 13));
      */
      flagTex.wrapS = flagTex.wrapT = T.ClampToEdgeWrapping;
      const flagGeo = new T.PlaneGeometry(6, 3.2, 12, 1); flagGeo.translate(3, 0, 0);
      const flag = new T.Mesh(flagGeo, new T.MeshBasicMaterial({ map: flagTex, side: T.DoubleSide })); flag.position.set(0.1, 31, 0); g.add(flag);
      const fb = flagGeo.attributes.position.array.slice();
      W.updaters.push((dt, t) => {
        const a = flagGeo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) a[i + 2] = Math.sin(fb[i] * 1.3 - t * 5) * 0.25 * (fb[i] / 6);
        flagGeo.attributes.position.needsUpdate = true;
      });
      add(g);
      addBox(-28, zc - 12, 28, zc + 12, 21.5, 'whitehouse');
      addBox(-61, zc - 1, -27, zc + 9, 9.6, 'whitehouse'); addBox(27, zc - 1, 61, zc + 9, 9.6, 'whitehouse');
      addBox(-8.6, zc + 12, 8.6, zc + 20.1, 17.4, 'whitehouse');
      // фонтан на лужайке
      const fz = -228;
      const basin = new T.Mesh(new T.CylinderGeometry(6, 6.4, 1, 28), wM); basin.position.set(0, 0.5, fz); basin.castShadow = true; add(basin);
      const water = new T.Mesh(new T.CylinderGeometry(5.5, 5.5, 0.2, 28), new T.MeshBasicMaterial({ color: night ? 0x2a4a7a : 0x6ab0e8 })); water.position.set(0, 0.95, fz); add(water);
      addBox(-5, fz - 5, 5, fz + 5, 1, 'fountain');
      W.special.fountain = new T.Vector3(0, 0, fz);
      if (night) { const fl = new T.PointLight(0xfff0d0, 1.6, 70, 1.5); fl.position.set(0, 14, -212); add(fl); }
      W.special.whiteHouse = new T.Vector3(0, 0, zc);
      W.special.plaza = new T.Vector3(0, 0, -175);
      // кусты вдоль лужайки
      for (let x = -60; x <= 60; x += 10) if (Math.abs(x) > 12) trees.push([x, -238, 0.55]);
    }

    // ---------- материалы зданий ----------
    for (const P of pal) {
      if (!P.b.pos.length) continue;
      const m = M.toonX(0xffffff, { map: P.tex.map });
      if (P.tex.emap) { m.emissive = new T.Color(0xffffff); m.emissiveMap = P.tex.emap; m.emissiveIntensity = 0.9; }
      const mesh = new T.Mesh(toGeo(P.b), m); mesh.castShadow = mesh.receiveShadow = true; add(mesh); P.b.mesh = mesh;
      const roof = new T.Mesh(toGeo(P.top), M.toon(night ? 0x3a3c44 : 0x8a8d96)); roof.castShadow = roof.receiveShadow = true; add(roof); P.top.mesh = roof;
    }
    if (shops.pos.length) {
      const sm = new T.MeshToonMaterial({ vertexColors: true, gradientMap: M.grad });
      if (night) { sm.emissive = new T.Color(0x3a2a10); }
      { const shm = new T.Mesh(toGeo(shops), sm); add(shm); shops.mesh = shm; }
    }
    // тротуары/кварталы
    {
      const im = new T.InstancedMesh(new T.BoxGeometry(1, 0.25, 1), new T.MeshToonMaterial({ color: 0xffffff, gradientMap: M.grad }), pave.length);
      const col = new T.Color();
      pave.forEach((p, i) => { mtx.makeScale(p[2], 1, p[3]); mtx.setPosition(p[0], 0.12, p[1]); im.setMatrixAt(i, mtx); im.setColorAt(i, col.setHex(p[4])); });
      im.receiveShadow = true; add(im);
    }
    // деревья (инстансы + контур)
    if (trees.length) {
      const fg = new T.IcosahedronGeometry(2.0, 1), tg = new T.CylinderGeometry(0.3, 0.4, 3, 6);
      const fol = new T.InstancedMesh(fg, M.toon(night ? 0x24502a : 0x3f8a3c), trees.length);
      const folO = new T.InstancedMesh(fg, M.outlineMat, trees.length);
      const tr = new T.InstancedMesh(tg, M.toon(0x6a4628), trees.length);
      trees.forEach((t, i) => {
        const s = t[2] * 1.1;
        mtx.makeScale(s, s * 1.15, s); mtx.setPosition(t[0], 3 + 2.0 * s, t[1]); fol.setMatrixAt(i, mtx); folO.setMatrixAt(i, mtx);
        mtx.makeScale(1, 1, 1); mtx.setPosition(t[0], 1.5 + 0.25, t[1]); tr.setMatrixAt(i, mtx);
        addBox(t[0] - 0.4, t[1] - 0.4, t[0] + 0.4, t[1] + 0.4, 4, 'tree');
      });
      fol.castShadow = tr.castShadow = true;
      add(fol); add(folO); add(tr);
    }
    // фонари
    {
      const pm = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.15, 7, 6), M.toon(0x3a3d44), lamps.length);
      const hm = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.25, 1.4), night ? new T.MeshBasicMaterial({ color: 0xffe6a0 }) : M.toon(0x3a3d44), lamps.length);
      lamps.forEach((l, i) => { mtx.makeTranslation(l[0], 3.5, l[1]); pm.setMatrixAt(i, mtx); mtx.makeTranslation(l[0], 7, l[1]); hm.setMatrixAt(i, mtx); });
      add(pm); add(hm);
      if (night && S.data.details > 0) {
        const gl = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: M.glowTex(), color: 0xffcf80, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }), lamps.length);
        lamps.forEach((l, i) => { mtx.makeRotationX(-Math.PI / 2); mtx.scale(new T.Vector3(9, 9, 9)); mtx.setPosition(l[0], 0.3, l[1]); gl.setMatrixAt(i, mtx); });
        add(gl);
      }
    }

    // ---------- физика ----------
    const stamp = { v: 0 };
    W.query = function (x, z, r) {
      const c = W.cell, out = [];
      stamp.v++;
      for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
        for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
          const L = W.grid.get(i + ',' + j); if (!L) continue;
          for (const b of L) { if (b._s === stamp.v) continue; b._s = stamp.v; out.push(b); }
        }
      return out;
    };
    // столкновение капсулы (pos — ступни) с коробками; возвращает высоту опоры или null
    W.collide = function (pos, r, h, prevY) {
      let ground = null;
      for (const b of W.query(pos.x, pos.z, r + 1)) {
        if (b.y0 > 0.5 && prevY != null && prevY + h <= b.y0 + 0.4 && pos.y + h > b.y0 && pos.x > b.x0 && pos.x < b.x1 && pos.z > b.z0 && pos.z < b.z1) {
          pos.y = b.y0 - h; continue; // упёрся головой в потолок
        }
        if (pos.y >= b.y1 - 0.05 || pos.y + h <= b.y0) {
          if (pos.x > b.x0 - r * 0.5 && pos.x < b.x1 + r * 0.5 && pos.z > b.z0 - r * 0.5 && pos.z < b.z1 + r * 0.5 && pos.y >= b.y1 - 0.6 && pos.y <= b.y1 + 0.05) {
            ground = Math.max(ground == null ? -1 : ground, b.y1);
          }
          continue;
        }
        const cx = U.clamp(pos.x, b.x0, b.x1), cz = U.clamp(pos.z, b.z0, b.z1);
        let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (prevY != null && prevY >= b.y1 - 0.6) { pos.y = b.y1; ground = b.y1; continue; }
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
        } else {
          const pen = [pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z];
          const m = Math.min(...pen), k = pen.indexOf(m);
          if (k === 0) pos.x = b.x0 - r; else if (k === 1) pos.x = b.x1 + r; else if (k === 2) pos.z = b.z0 - r; else pos.z = b.z1 + r;
        }
      }
      return ground;
    };
    // луч против коробок и земли
    W.raycast = function (o, d, maxT) {
      let best = maxT, nrm = null, box = null;
      if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; nrm = new T.Vector3(0, 1, 0); } }
      for (const b of W.boxes) {
        if (b.kind === 'tree') continue;
        let tmin = 0, tmax = best, ax = -1, sgn = 0;
        const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
        let ok = true;
        for (let a = 0; a < 3; a++) {
          if (Math.abs(dd[a]) < 1e-8) { if (oo[a] < lo[a] || oo[a] > hi[a]) { ok = false; break; } continue; }
          let t1 = (lo[a] - oo[a]) / dd[a], t2 = (hi[a] - oo[a]) / dd[a], s = -1;
          if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
          if (t1 > tmin) { tmin = t1; ax = a; sgn = s; }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) { ok = false; break; }
        }
        if (ok && ax >= 0 && tmin < best) {
          best = tmin; box = b;
          nrm = new T.Vector3(ax === 0 ? sgn : 0, ax === 1 ? sgn : 0, ax === 2 ? sgn : 0);
        }
      }
      return nrm ? { t: best, normal: nrm, box, point: o.clone().addScaledVector(d, best) } : null;
    };
    W.los = function (a, b) {
      const d = b.clone().sub(a); const L = d.length(); d.divideScalar(L);
      const h = W.raycast(a, d, L - 0.5);
      return !h;
    };
    W.inside = function (x, y, z) {
      for (const b of W.query(x, z, 0.5)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return b;
      return null;
    };
    // ---------- Овальный кабинет (интерьер для финала) ----------
    W.buildOval = function (cx, cz) {
      const RX = 23, RZ = 16, H = 9, N = 64; // просторный Овальный кабинет
      const O = { center: new T.Vector3(cx, 0, cz), RX, RZ, H, segs: [] };
      const grp = new T.Group(); grp.position.set(cx, 0, cz); add(grp);
      const mk = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
      const wallM = M.toonX(0xf1e7c6, { side: T.DoubleSide }), trimM = M.toon(0xffffff), wood = M.toon(0x5a3418), gold = M.toon(0xd8b04a);
      // пол, ковёр с печатью, потолок
      const floor = new T.Mesh(new T.CircleGeometry(1, 48), M.toon(0xa8804e)); floor.rotation.x = -Math.PI / 2; floor.scale.set(RX + 0.5, RZ + 0.5, 1); floor.position.y = 0.04; floor.receiveShadow = true; grp.add(floor);
      const rug = new T.Mesh(new T.CircleGeometry(1, 48), M.toon(0x22346a)); rug.rotation.x = -Math.PI / 2; rug.scale.set(RX - 2.5, RZ - 2.5, 1); rug.position.y = 0.06; rug.receiveShadow = true; grp.add(rug);
      const ring = new T.Mesh(new T.RingGeometry(0.93, 1, 48), new T.MeshBasicMaterial({ color: 0xd8b04a })); ring.rotation.x = -Math.PI / 2; ring.scale.set(RX - 2.5, RZ - 2.5, 1); ring.position.y = 0.07; grp.add(ring);
      const seal = new T.Mesh(new T.CircleGeometry(2.2, 32), new T.MeshBasicMaterial({ color: 0xc9a84a })); seal.rotation.x = -Math.PI / 2; seal.position.y = 0.075; grp.add(seal);
      const seal2 = new T.Mesh(new T.CircleGeometry(1.7, 32), new T.MeshBasicMaterial({ color: 0x1c2c58 })); seal2.rotation.x = -Math.PI / 2; seal2.position.y = 0.08; grp.add(seal2);
      const eagle = new T.Mesh(M.star(1.1), new T.MeshBasicMaterial({ color: 0xe8d08a })); eagle.rotation.x = -Math.PI / 2; eagle.position.y = 0.085; grp.add(eagle);
      const ceil = new T.Mesh(new T.CircleGeometry(1, 48), M.toonX(0xfaf6ea, { side: T.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.scale.set(RX, RZ, 1); ceil.position.y = H; grp.add(ceil);
      const lamp = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: 0xfff6dc })); lamp.rotation.x = Math.PI / 2; lamp.scale.set(7, 4.8, 1); lamp.position.y = H - 0.02; grp.add(lamp);
      // стены: гладкий овал + плинтус
      const wallGeo = (gapC, gapW) => {
        const g2 = gapW ? new T.CylinderGeometry(1, 1, H, 64, 1, true, gapC + gapW / 2, Math.PI * 2 - gapW) : new T.CylinderGeometry(1, 1, H, 64, 1, true);
        g2.translate(0, H / 2, 0); return g2;
      };
      O.wall = new T.Mesh(wallGeo(), wallM); O.wall.scale.set(RX, 1, RZ); O.wall.receiveShadow = true; grp.add(O.wall);
      const base = new T.Mesh(new T.CylinderGeometry(1, 1, 0.5, 64, 1, true), M.toonX(0xffffff, { side: T.DoubleSide })); base.scale.set(RX - 0.05, 1, RZ - 0.05); base.position.y = 0.25; grp.add(base);
      const crown = new T.Mesh(new T.CylinderGeometry(1, 1, 0.4, 64, 1, true), M.toonX(0xffffff, { side: T.DoubleSide })); crown.scale.set(RX - 0.05, 1, RZ - 0.05); crown.position.y = H - 0.3; grp.add(crown);
      // коллайдеры стен (короткие хорды)
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const x0 = cx + Math.sin(a0) * RX, z0 = cz + Math.cos(a0) * RZ, x1 = cx + Math.sin(a1) * RX, z1 = cz + Math.cos(a1) * RZ;
        const b = addBox(Math.min(x0, x1) - 0.35, Math.min(z0, z1) - 0.35, Math.max(x0, x1) + 0.35, Math.max(z0, z1) + 0.35, H + 0.6, 'ovalwall');
        b.ang = (a0 + a1) / 2; O.segs.push(b);
      }
      const ceilBox = addBox(cx - RX - 1, cz - RZ - 1, cx + RX + 1, cz + RZ + 1, H + 1.2, 'ceiling'); ceilBox.y0 = H;
      // окна за столом + шторы
      for (const ax of [-0.32, 0, 0.32]) {
        const a = Math.PI + ax, x = Math.sin(a) * (RX - 0.15), z = Math.cos(a) * (RZ - 0.15);
        const w = mk(M.box(1.8, 4, 0.1), new T.MeshBasicMaterial({ color: 0x1c2a48 }), x, 3.4, z, a); w.castShadow = false;
        for (const sd of [-1, 1]) mk(M.box(0.6, 5, 0.2), gold, x + Math.cos(a) * sd * 1.25, 3.3, z - Math.sin(a) * sd * 1.25, a);
      }
      // стол президента (Resolute desk) и кресло
      const dz = -RZ + 3.4;
      mk(M.box(3.6, 1.05, 1.6), wood, 0, 0.53, dz);
      mk(M.box(3.8, 0.08, 1.75), M.toon(0x3a200c), 0, 1.09, dz);
      mk(M.box(1.3, 0.75, 0.05), M.toon(0x7a4a24), 0, 0.55, dz + 0.81);
      const deskSeal = mk(M.cyl(0.25, 0.25, 0.03, 16), gold, 0, 0.6, dz + 0.84); deskSeal.rotation.x = Math.PI / 2;
      mk(M.box(0.5, 0.04, 0.35), M.toon(0xf4f0e0), -0.8, 1.15, dz); // бумаги
      mk(M.box(0.3, 0.25, 0.3), M.toon(0x222222), 1.2, 1.24, dz); // телефон
      const chair = new T.Group(); chair.position.set(0, 0, dz - 1.3); grp.add(chair);
      const cm = M.toon(0x2a1a14);
      const seat = new T.Mesh(M.box(1, 0.2, 0.9), cm); seat.position.y = 0.36; chair.add(seat);
      const back = new T.Mesh(M.box(1, 1.5, 0.2), cm); back.position.set(0, 1.05, -0.45); chair.add(back);
      const leg = new T.Mesh(M.cyl(0.08, 0.08, 0.5, 8), M.toon(0x777777)); leg.position.y = 0.25; chair.add(leg);
      addBox(cx - 1.9, cz + dz - 0.85, cx + 1.9, cz + dz + 0.85, 1.12, 'desk');
      // флаги за столом
      const ft = usFlagTex();
      for (const [fx, col] of [[-2.6, null], [2.6, 0x1c2c6a]]) {
        mk(M.cyl(0.05, 0.05, 4.2, 8), gold, fx, 2.1, -RZ + 1.4);
        const fl = mk(new T.BoxGeometry(0.9, 1.9, 0.6), col ? M.toon(col) : new T.MeshBasicMaterial({ map: ft }), fx, 2.9, -RZ + 1.4); fl.castShadow = false;
        mk(M.sph(0.1), gold, fx, 4.3, -RZ + 1.4);
      }
      // диваны, столик, камин
      const sofaM = M.toon(0xece0c2);
      for (const sd of [-1, 1]) {
        const sx = sd * 3.4;
        mk(M.box(1.1, 0.55, 3.6), sofaM, sx, 0.28, 2.2); mk(M.box(0.3, 1.1, 3.6), sofaM, sx + sd * 0.55, 0.55, 2.2);
        addBox(cx + sx - 0.7, cz + 0.4, cx + sx + 0.7, cz + 4, 0.85, 'sofa');
      }
      mk(M.box(1.8, 0.45, 1.2), wood, 0, 0.23, 2.2); addBox(cx - 0.9, cz + 1.6, cx + 0.9, cz + 2.8, 0.45, 'table');
      mk(M.box(3.2, 2.4, 0.6), trimM, 0, 1.2, RZ - 0.5);
      mk(M.box(1.6, 1.2, 0.3), M.toon(0x1a1210), 0, 0.7, RZ - 0.85);
      mk(M.box(3.6, 0.15, 0.9), trimM, 0, 2.45, RZ - 0.6);
      O.fire = new T.Vector3(cx, 0.4, cz + RZ - 0.9);
      // портреты
      for (const a of [Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6]) {
        const x = Math.sin(a) * (RX - 0.2), z = Math.cos(a) * (RZ - 0.2);
        mk(M.box(1.6, 2.1, 0.08), gold, x, 3.8, z, a); mk(M.box(1.3, 1.8, 0.1), M.toon(0x4a3a30), x, 3.8, z + Math.cos(a) * 0.02, a);
      }
      // свет внутри
      const l1 = new T.PointLight(0xfff0d4, 1.5, 55, 1.3); l1.position.set(cx, H - 1, cz - 5); add(l1);
      const l2 = new T.PointLight(0xffe4c0, 1.2, 50, 1.3); l2.position.set(cx, H - 1, cz + 7); add(l2);
      // тёплый «ключевой» свет на стол президента — Хоумлендера хорошо видно
      const l3 = new T.PointLight(0xfff2dc, 1.3, 12, 1.6); l3.position.set(cx, 3.2, cz - RZ + 6.5); add(l3);
      O.desk = new T.Vector3(cx, 0, cz + dz); O.chair = new T.Vector3(cx, 0, cz + dz - 1.3);
      // пролом в стене со стороны angle
      // пролом: стена разрушена, за ней коридор Белого дома (выйти наружу нельзя)
      O.breach = function (ang = Math.PI / 2, w = 0.36) {
        O.wall.geometry.dispose(); O.wall.geometry = wallGeo(ang, w);
        const hx = Math.sin(ang) * RX, hz = Math.cos(ang) * RZ;
        const cor = new T.Mesh(new T.BoxGeometry(8, 5.5, 6.4), M.toonX(0xd9cdb0, { side: T.BackSide }));
        cor.position.set(hx + 3.6 * Math.sin(ang), 2.75, hz + 3.6 * Math.cos(ang)); cor.rotation.y = ang - Math.PI / 2; grp.add(cor);
        const cl = new T.PointLight(0xffe0b0, 0.9, 14, 1.5); cl.position.set(cx + hx + 3 * Math.sin(ang), 4, cz + hz + 3 * Math.cos(ang)); add(cl);
        // обломки
        const rm = M.toon(0xe6dcc0);
        for (let i = 0; i < 14; i++) {
          const r = new T.Mesh(M.box(0.4 + Math.random() * 0.8, 0.25 + Math.random() * 0.5, 0.4 + Math.random() * 0.7), rm);
          const d = 0.5 + Math.random() * 3.5, sp = (Math.random() - 0.5) * 3;
          r.position.set(hx - Math.sin(ang) * d + Math.cos(ang) * sp, 0.15, hz - Math.cos(ang) * d - Math.sin(ang) * sp);
          r.rotation.set(Math.random(), Math.random() * 3, Math.random()); r.castShadow = true; grp.add(r);
        }
        // невидимая стена в проёме остаётся (коллайдеры не удаляем)
        return new T.Vector3(cx + hx, 0, cz + hz);
      };
      O.corridor = (ang = Math.PI / 2) => new T.Vector3(cx + Math.sin(ang) * (RX + 3.5), 0, cz + Math.cos(ang) * (RZ + 3.5));
      O.inside = (p) => ((p.x - cx) / (RX - 1)) ** 2 + ((p.z - cz) / (RZ - 1)) ** 2 < 1;
      O.clampInside = (p) => {
        const k = ((p.x - cx) / (RX - 1.2)) ** 2 + ((p.z - cz) / (RZ - 1.2)) ** 2;
        let hit = false;
        if (k > 1) { const f = 1 / Math.sqrt(k); p.x = cx + (p.x - cx) * f; p.z = cz + (p.z - cz) * f; hit = true; }
        if (p.y > H - 2) { p.y = H - 2; hit = true; }
        return hit;
      };
      W.oval = O;
      return O;
    };

    // ---------- особняк (интерьер для кат-сцены) ----------
    W.buildHouse = function (cx, cz) {
      const RW = 16, RD = 12, H = 4.4;
      const grp = new T.Group(); grp.position.set(cx, 0, cz); add(grp);
      const mk = (geo, mat, x, y, z, ry = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
      // комната изнутри
      const room = new T.Mesh(new T.BoxGeometry(RW, H, RD), [M.toonX(0x8a5a4a, { side: T.BackSide }), M.toonX(0x8a5a4a, { side: T.BackSide }), M.toonX(0xf2ead8, { side: T.BackSide }), M.toonX(0x6a4a2a, { side: T.BackSide }), M.toonX(0x9a6a52, { side: T.BackSide }), M.toonX(0x9a6a52, { side: T.BackSide })]);
      room.position.y = H / 2; room.receiveShadow = true; grp.add(room);
      // снаружи: особняк с крышей и окнами
      const shell = mk(M.box(RW + 0.6, H + 0.4, RD + 0.6), M.toon(0xd8ccb0), 0, H / 2 + 0.2, 0); shell.castShadow = false; // не затеняет комнату
      const roof = new T.Mesh(new T.ConeGeometry((RW + 2) * 0.72, 4.2, 4, 1), M.toon(0x5a3a32)); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, (RD + 2) / (RW + 2)); roof.position.set(0, H + 2.5, 0); grp.add(roof);
      // пол, ковёр, мебель
      mk(M.box(RW - 0.1, 0.06, RD - 0.1), M.toon(0x7a5232), 0, 0.03, 0);
      mk(M.box(7, 0.04, 5), M.toon(0x7a1e24), 0, 0.07, 0);
      const sofa = M.toon(0x2e4a6a), wood = M.toon(0x4a2e1a);
      mk(M.box(4.2, 0.6, 1.2), sofa, 0, 0.3, -RD / 2 + 1.1); mk(M.box(4.2, 1.1, 0.35), sofa, 0, 0.55, -RD / 2 + 0.55);
      mk(M.box(1.3, 0.6, 1.3), sofa, -4.2, 0.3, -2.8); mk(M.box(1.3, 1.1, 0.3), sofa, -4.2, 0.55, -3.4);
      mk(M.box(1.8, 0.45, 1.0), wood, 0, 0.23, -2.4);
      mk(M.box(0.6, 3.4, 3.2), wood, RW / 2 - 0.4, 1.7, 2.6); // книжный шкаф
      for (let i = 0; i < 4; i++) mk(M.box(0.3, 0.5, 2.8), M.toon([0xb03a2a, 0x2a5aa0, 0xd8b04a, 0x3a7a3a][i]), RW / 2 - 0.55, 0.6 + i * 0.8, 2.6);
      mk(M.box(2.6, 1.5, 0.12), M.toon(0x111111), -RW / 2 + 0.1, 2.0, 1.5, Math.PI / 2); // телевизор
      mk(M.cyl(0.05, 0.05, 1.6, 6), M.toon(0x333333), 5, 0.8, -4.6); const shade = mk(M.cyl(0.25, 0.45, 0.5, 10), M.toon(0xf4e2b0), 5, 1.75, -4.6); shade.castShadow = false;
      // окна (ночь за стеклом) и дверь
      for (const x of [-4.5, 0, 4.5]) mk(M.box(2.2, 2.0, 0.08), new T.MeshBasicMaterial({ color: 0x14203a }), x, 2.3, RD / 2 - 0.05);
      mk(M.box(1.6, 2.8, 0.1), wood, -RW / 2 + 0.06, 1.4, -3.5, Math.PI / 2);
      // люстра и свет
      mk(M.sph(0.35), new T.MeshBasicMaterial({ color: 0xfff2c8 }), 0, H - 0.5, 0);
      const l1 = new T.PointLight(0xffe2b0, 1.4, 24, 1.4); l1.position.set(0, H - 0.8, 0); add(l1); l1.position.add(grp.position);
      const l2 = new T.PointLight(0xffd8a0, 0.7, 10, 1.6); l2.position.set(cx + 5, 1.8, cz - 4.6); add(l2);
      // стены и потолок — коллайдеры
      const th = 0.6;
      addBox(cx - RW / 2 - th, cz - RD / 2 - th, cx + RW / 2 + th, cz - RD / 2, H + 0.4, 'housewall');
      addBox(cx - RW / 2 - th, cz + RD / 2, cx + RW / 2 + th, cz + RD / 2 + th, H + 0.4, 'housewall');
      addBox(cx - RW / 2 - th, cz - RD / 2, cx - RW / 2, cz + RD / 2, H + 0.4, 'housewall');
      addBox(cx + RW / 2, cz - RD / 2, cx + RW / 2 + th, cz + RD / 2, H + 0.4, 'housewall');
      const ceil = addBox(cx - RW / 2, cz - RD / 2, cx + RW / 2, cz + RD / 2, H + 0.6, 'ceiling'); ceil.y0 = H;
      const Hs = { center: new T.Vector3(cx, 0, cz), RW, RD, H, grp };
      Hs.clampInside = (p) => { let hit = false; const mx = RW / 2 - 0.7, mz = RD / 2 - 0.7;
        if (p.x < cx - mx) { p.x = cx - mx; hit = true; } if (p.x > cx + mx) { p.x = cx + mx; hit = true; }
        if (p.z < cz - mz) { p.z = cz - mz; hit = true; } if (p.z > cz + mz) { p.z = cz + mz; hit = true; }
        if (p.y > H - 0.6) { p.y = H - 0.6; hit = true; } return hit; };
      // ночные облака над домом (Хоумлендер уходит сквозь них)
      Hs.clouds = new T.Group(); add(Hs.clouds);
      const cm = M.toon(0x9aa4c8); // облака в лунном свете
      for (let i = 0; i < 9; i++) {
        const cg = new T.Group();
        for (let k = 0; k < 5; k++) { const sp = new T.Mesh(M.sph(1), cm); sp.scale.set(9 + Math.random() * 8, 4 + Math.random() * 3, 7 + Math.random() * 6); sp.position.set((k - 2) * 9 + Math.random() * 4, Math.random() * 3, Math.random() * 7); cg.add(sp); }
        cg.position.set(cx + (Math.random() - 0.5) * 120, 110 + Math.random() * 40, cz + (Math.random() - 0.5) * 120);
        if (i < 2) cg.position.set(cx + (i ? 8 : -10), 125 + i * 14, cz + (i ? -6 : 5));
        Hs.clouds.add(cg);
      }
      W.house = Hs;
      return Hs;
    };
    W.randomSidewalk = () => U.pick(W.sidewalkPts).clone();
    W.update = function (dt, t, focus) {
      if (W.special.fountain && W.fx && Math.random() < dt * 25) W.fx.burst(W.special.fountain.clone().setY(1.2), 1, { color: [0xbfe4ff, 0xffffff], speed: 3, size: 0.18, life: 0.9, g: -12, drag: 0.2, up: true, dir: new T.Vector3(0, 2.2, 0), spread: 0.3 });
      for (const c of W.clouds) { c.position.x += dt * 3; if (c.position.x > 650) c.position.x -= 1300; }
      for (const f of W.updaters.slice()) f(dt, t);
      if (W.fx) for (const b of W.lots) if (b.burning && !b.dead && Math.random() < dt * 6) { W.fx.fire(b.firePt.clone().add(new T.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)), 1); if (Math.random() < 0.4) W.fx.smoke(b.firePt.clone().setY(b.firePt.y + 2), 1); }
      if (focus) {
        sun.position.copy(focus).add(W.sunOffset); sun.target.position.copy(focus);
        sky.position.copy(focus);
        if (W.stars) W.stars.position.copy(focus);
      }
    };
    W.dispose = function () {
      scene.remove(W.group);
      W.group.traverse((o) => { if (o.geometry && !o.geometry._shared) o.geometry.dispose(); });
      for (const P of pal) { P.tex.map.dispose(); if (P.tex.emap) P.tex.emap.dispose(); }
    };
    return W;
  }

  return { build, PITCH, ROAD, HALF };
})();
