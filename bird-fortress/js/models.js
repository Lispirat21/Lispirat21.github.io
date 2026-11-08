'use strict';
// ============ 3D-модели: птицы, герои, звери, постройки ============
const Models = (() => {
  const matCache = {}, geoCache = {};
  function mat(color, o) {
    const key = color + (o ? JSON.stringify(o) : '');
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, flatShading: true }, o || {}));
    return matCache[key];
  }
  function geo(key, fn) { return geoCache[key] || (geoCache[key] = fn()); }
  const G_BOX = new THREE.BoxGeometry(1, 1, 1);
  const G_SPH = new THREE.SphereGeometry(0.5, 12, 9);
  const G_SPH_LO = new THREE.SphereGeometry(0.5, 7, 5);
  // Графика «ПК»: гладкие высокополигональные формы и дополнительные детали у птиц и зверей
  const G_SPH_HI = new THREE.SphereGeometry(0.5, 28, 20);
  let HI = false; const smoothCache = new Map();
  function setDetail(on) { HI = !!on; }
  function smooth(m) {
    if (!HI || !m.flatShading) return m;
    if (!smoothCache.has(m)) { const c = m.clone(); c.flatShading = false; smoothCache.set(m, c); }
    return smoothCache.get(m);
  }
  function M(material) { return typeof material === 'object' ? material : mat(material); }
  function add(m, parent, x, y, z, shadow = true) {
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = shadow; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function box(w, h, d, c, x, y, z, p, shadow) { const m = add(new THREE.Mesh(G_BOX, M(c)), p, x, y, z, shadow); m.scale.set(w, h, d); return m; }
  function sph(w, h, d, c, x, y, z, p, lo, shadow) { const m = add(new THREE.Mesh(HI ? G_SPH_HI : (lo ? G_SPH_LO : G_SPH), HI ? smooth(M(c)) : M(c)), p, x, y, z, shadow); m.scale.set(w, h, d); return m; }
  function cyl(rt, rb, h, c, x, y, z, p, seg = 8, shadow) {
    const g = geo('c' + rt + '_' + rb + '_' + h + '_' + seg, () => new THREE.CylinderGeometry(rt, rb, h, seg));
    return add(new THREE.Mesh(g, M(c)), p, x, y, z, shadow);
  }
  function cone(r, h, c, x, y, z, p, seg = 8, shadow) {
    const g = geo('k' + r + '_' + h + '_' + seg, () => new THREE.ConeGeometry(r, h, seg));
    return add(new THREE.Mesh(g, M(c)), p, x, y, z, shadow);
  }
  function torus(r, t, c, x, y, z, p, seg = 12) {
    const g = geo('t' + r + '_' + t + '_' + seg, () => new THREE.TorusGeometry(r, t, 6, seg));
    return add(new THREE.Mesh(g, M(c)), p, x, y, z);
  }
  function group(p, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (p) p.add(g); return g; }

  // ---------- Текстуры (canvas) ----------
  const texCache = {};
  function canvasTex(key, w, h, draw, rx = 1, ry = 1) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    texCache[key] = t; return t;
  }
  function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const T = {
    dots: () => canvasTex('dots', 256, 128, (g, w, h) => {
      g.fillStyle = '#22252c'; g.fillRect(0, 0, w, h); const r = rnd(7);
      g.fillStyle = '#f2f2f2';
      for (let i = 0; i < 700; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1.4 + r() * 1.3, 0, 7); g.fill(); }
    }),
    checker: () => canvasTex('checker', 128, 128, (g, w, h) => {
      g.fillStyle = '#121416'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f4';
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2 === 0) g.fillRect(x * 8 + 2, y * 8 + 2, 4, 3);
    }),
    streak: () => canvasTex('streak', 128, 128, (g, w, h) => {
      g.fillStyle = '#b48a55'; g.fillRect(0, 0, w, h); const r = rnd(3);
      for (let i = 0; i < 220; i++) {
        g.strokeStyle = r() < 0.5 ? '#3a2a1c' : (r() < 0.5 ? '#e9dcc0' : '#7a5530'); g.lineWidth = 2 + r() * 2;
        const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 - r() * 6, y + 8 + r() * 8); g.stroke();
      }
    }),
    feather: (col = '#5b4a36', line = '#2a2018', key = 'feather') => canvasTex(key, 128, 128, (g, w, h) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 2;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) {
        g.beginPath(); g.arc(x * 16 + (y % 2) * 8, y * 12, 8, 0.2, Math.PI - 0.2); g.stroke();
      }
    }),
    brick: (base, key, dark) => canvasTex(key, 256, 256, (g, w, h) => {
      g.fillStyle = dark; g.fillRect(0, 0, w, h); const r = rnd(key.length * 31);
      const bh = 32, bw = 64;
      for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw + 1; x++) {
        const c = new THREE.Color(base); c.offsetHSL(0, 0, (r() - 0.5) * 0.12);
        g.fillStyle = '#' + c.getHexString();
        g.fillRect(x * bw + (y % 2) * bw / 2 + 2, y * bh + 2, bw - 4, bh - 4);
      }
    }, 1, 1),
    planks: () => canvasTex('planks', 128, 128, (g, w, h) => {
      const r = rnd(11);
      for (let x = 0; x < 8; x++) { const c = new THREE.Color('#a87a4a'); c.offsetHSL(0, 0, (r() - 0.5) * 0.1); g.fillStyle = '#' + c.getHexString(); g.fillRect(x * 16, 0, 16, h); g.fillStyle = '#5a3b20'; g.fillRect(x * 16, 0, 2, h); }
    }),
  };
  function texMat(tex, o) { return new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.9, flatShading: true }, o || {})); }

  // ===================== ПТИЦЫ =====================
  function makeBird(id) {
    const root = new THREE.Group();
    const b = group(root); // корпус (для подпрыгивания)
    const P = { root, body: b };
    const legC = { flamingo: 0xf08aa8, hummingbird: 0x333333, phoenix: 0xf0c040, peacock: 0x8a8a8a, loon: 0x222222, eagle: 0xe8c040, owl: 0x8a7050, parrot: 0x555555 }[id] || 0xc08060;
    let bodyMat = mat(0x8a6a4a), bellyMat = mat(0xe8dcc8), headMat = mat(0x8a7a62), wingMat = mat(0x6a4a2a), beakC = 0x7a7a7a, tailMat;
    let bodyS = [0.62, 0.56, 0.78], headS = 0.38, headPos = [0, 0.8, 0.32], neck = 0, beakLen = 0.16, beakR = 0.07;
    switch (id) {
      case 'sparrow': bodyMat = texMat(T.streak()); headMat = mat(0x8c8070); wingMat = texMat(T.streak()); beakC = 0x8a8a90; break;
      case 'tit': bodyMat = mat(0x6f8a5a); bellyMat = mat(0xf2d23a); headMat = mat(0x151515); wingMat = mat(0x5a7090); beakC = 0x222222; bodyS = [0.56, 0.52, 0.7]; break;
      case 'bullfinch': bodyMat = mat(0x707a86); bellyMat = mat(0xe0482e); headMat = mat(0x151515); wingMat = mat(0x1a1a1a); beakC = 0x151515; beakR = 0.09; beakLen = 0.12; break;
      case 'guinea': bodyMat = texMat(T.dots()); bellyMat = bodyMat; headMat = mat(0x8fb4e6); wingMat = texMat(T.dots()); beakC = 0xd8b088; bodyS = [0.8, 0.74, 0.92]; headS = 0.3; headPos = [0, 0.86, 0.4]; break;
      case 'woodpecker': bodyMat = mat(0x1a1a1a); bellyMat = mat(0xf0f0f0); headMat = mat(0x1a1a1a); wingMat = mat(0x202020); beakC = 0x444444; beakLen = 0.28; beakR = 0.05; bodyS = [0.56, 0.6, 0.74]; break;
      case 'loon': bodyMat = texMat(T.checker()); bellyMat = mat(0xf2f2f2); headMat = mat(0x0e1012); wingMat = texMat(T.checker()); beakC = 0x111111; beakLen = 0.36; beakR = 0.055; neck = 0.25; headPos = [0, 1.05, 0.46]; headS = 0.34; bodyS = [0.66, 0.6, 0.95]; break;
      case 'turkey': bodyMat = texMat(T.feather('#5f4c38', '#c8a878', 'turk')); bellyMat = bodyMat; headMat = mat(0x9fb0c8); wingMat = texMat(T.feather('#4a3a2a', '#d6c09a', 'turkw')); beakC = 0xd8c8a0; neck = 0.35; headS = 0.24; headPos = [0, 1.12, 0.42]; bodyS = [0.78, 0.74, 0.95]; break;
      case 'owl': bodyMat = texMat(T.feather('#7a5a3a', '#3a2818', 'owl')); bellyMat = texMat(T.feather('#d8c09a', '#8a6a4a', 'owlb')); headMat = mat(0x7a5a3a); wingMat = texMat(T.feather('#6a4a2a', '#2a1a0a', 'owlw')); beakC = 0x333333; headS = 0.5; headPos = [0, 0.95, 0.12]; bodyS = [0.7, 0.8, 0.66]; beakLen = 0.1; break;
      case 'hummingbird': bodyMat = mat(0x2ab07a, { metalness: 0.4, roughness: 0.35 }); bellyMat = mat(0xd8f0e0); headMat = mat(0x1a9a6a, { metalness: 0.4, roughness: 0.35 }); wingMat = mat(0x6a8a8a); beakC = 0x222222; beakLen = 0.42; beakR = 0.03; bodyS = [0.42, 0.42, 0.62]; headS = 0.3; break;
      case 'flamingo': bodyMat = mat(0xf08aa8); bellyMat = mat(0xf8a8c0); headMat = mat(0xf08aa8); wingMat = mat(0xe86890); beakC = 0x222222; beakLen = 0.24; beakR = 0.07; neck = 0.55; headPos = [0, 1.55, 0.4]; headS = 0.28; bodyS = [0.6, 0.55, 0.85]; break;
      case 'peacock': bodyMat = mat(0x1a5ad0, { metalness: 0.3, roughness: 0.4 }); bellyMat = mat(0x1a4ab0); headMat = mat(0x1a5ad0, { metalness: 0.3, roughness: 0.4 }); wingMat = mat(0x8a6a40); beakC = 0xd8c8a0; headS = 0.3; headPos = [0, 1.0, 0.4]; neck = 0.25; bodyS = [0.6, 0.6, 0.85]; break;
      case 'phoenix': bodyMat = mat(0xe8401a, { emissive: 0xc02000, emissiveIntensity: 0.7 }); bellyMat = mat(0xf8a020, { emissive: 0xe06000, emissiveIntensity: 0.6 }); headMat = bodyMat; wingMat = mat(0xf86a10, { emissive: 0xd04000, emissiveIntensity: 0.8 }); beakC = 0xf0d040; beakR = 0.09; beakLen = 0.2; bodyS = [0.64, 0.6, 0.86]; break;
      case 'parrot': bodyMat = mat(0xd62a20); bellyMat = mat(0xe03a28); headMat = mat(0xd62a20); wingMat = mat(0x2a6ad8); beakC = 0xf0ead8; beakR = 0.1; beakLen = 0.16; bodyS = [0.58, 0.62, 0.74]; break;
      case 'eagle': bodyMat = texMat(T.feather('#4a3220', '#2a1a10', 'eagle')); bellyMat = bodyMat; headMat = mat(0xb08840); wingMat = texMat(T.feather('#3a2618', '#1a0e08', 'eaglew')); beakC = 0xf0c030; beakR = 0.1; beakLen = 0.2; bodyS = [0.72, 0.66, 0.92]; break;
    }
    // тело
    const legH = id === 'flamingo' ? 0.75 : 0.2;
    sph(bodyS[0], bodyS[1], bodyS[2], bodyMat, 0, legH + bodyS[1] / 2, 0, b);
    sph(bodyS[0] * 0.82, bodyS[1] * 0.8, bodyS[2] * 0.7, bellyMat, 0, legH + bodyS[1] * 0.42, bodyS[2] * 0.18, b);
    // шея
    if (neck > 0) {
      const nm = id === 'loon' ? headMat : mat(0x9fb0c8);
      const n = cyl(0.11, 0.16, neck + 0.2, nm, 0, headPos[1] - neck / 2 - 0.08, headPos[2] - 0.05, b);
      n.rotation.x = 0.3;
      if (id === 'loon') { const c = cyl(0.165, 0.17, 0.06, 0xf4f4f4, 0, headPos[1] - neck * 0.55, headPos[2] - 0.08, b); c.rotation.x = 0.3; }
    }
    // голова
    const head = group(b, headPos[0], headPos[1], headPos[2]); P.head = head;
    sph(headS, headS * 0.95, headS, headMat, 0, 0, 0, head);
    const beak = cone(beakR, beakLen, beakC, 0, -0.02, headS / 2 + beakLen / 2 - 0.03, head, 6);
    beak.rotation.x = Math.PI / 2 + (id === 'eagle' || id === 'parrot' || id === 'owl' ? 0.5 : 0.05);
    // глаза
    const eyeC = id === 'owl' ? 0xf09020 : (id === 'loon' ? 0xb01010 : 0x111111);
    const eyeS = id === 'owl' ? 0.14 : 0.075;
    const ex = headS * 0.36, ez = headS * (id === 'owl' ? 0.42 : 0.28);
    [-1, 1].forEach(sx => {
      if (id !== 'owl') sph(eyeS * 1.5, eyeS * 1.5, eyeS * 0.6, 0xffffff, sx * ex, headS * 0.1, ez - 0.01, head, true, false);
      sph(eyeS, eyeS, eyeS * 0.7, eyeC, sx * ex * (id === 'owl' ? 0.7 : 1.05), headS * 0.1, ez + 0.01, head, true, false);
      if (id === 'owl') sph(0.06, 0.06, 0.04, 0x000000, sx * ex * 0.7, headS * 0.1, ez + 0.06, head, true, false);
    });
    // особенности
    if (id === 'guinea') {
      cone(0.06, 0.14, 0xd8781a, 0, headS * 0.5, -0.02, head, 5).rotation.x = -0.4;
      [-1, 1].forEach(sx => sph(0.09, 0.13, 0.06, 0xd02020, sx * 0.07, -0.13, 0.12, head, true));
    }
    if (id === 'sparrow') {
      [-1, 1].forEach(sx => sph(0.12, 0.08, 0.12, 0xe89a3a, sx * 0.12, 0.05, 0.08, head, true));
      box(0.04, 0.03, 0.3, 0x2a2018, 0, headS * 0.48, -0.02, head, false);
    }
    if (id === 'tit') [-1, 1].forEach(sx => sph(0.04, 0.16, 0.18, 0xffffff, sx * 0.17, -0.03, 0.03, head, true, false));
    if (id === 'tit') box(0.08, 0.3, 0.05, 0x151515, 0, legH + bodyS[1] * 0.45, bodyS[2] * 0.48, b, false);
    if (id === 'woodpecker') { sph(0.26, 0.15, 0.3, 0xd02020, 0, headS * 0.35, -0.04, head, true); [-1, 1].forEach(sx => sph(0.04, 0.12, 0.2, 0xffffff, sx * 0.17, -0.04, 0.02, head, true, false)); }
    if (id === 'turkey') { const w = sph(0.09, 0.3, 0.08, 0xd0281c, 0, -0.18, 0.1, head, true); w.rotation.x = 0.2; cone(0.03, 0.14, 0xc02018, 0.04, 0.02, 0.18, head, 5).rotation.x = 2.5; }
    if (id === 'owl') { [-1, 1].forEach(sx => { const t = cone(0.07, 0.22, 0x5a3a20, sx * 0.17, 0.25, -0.02, head, 4); t.rotation.z = -sx * 0.35; }); sph(0.42, 0.36, 0.1, 0xd8c09a, 0, -0.01, 0.2, head, true); }
    if (id === 'parrot') { sph(0.2, 0.18, 0.06, 0xf6f0e6, 0, 0.02, 0.17, head, true, false); }
    if (id === 'flamingo') { const bk = cone(0.05, 0.12, 0x111111, 0, -0.08, 0.32, head, 5); bk.rotation.x = 2.3; }
    if (id === 'peacock') for (let i = 0; i < 5; i++) { const c = cyl(0.008, 0.008, 0.18, 0x1a3a90, -0.08 + i * 0.04, 0.22, -0.02, head, 3, false); c.rotation.z = (i - 2) * 0.15; sph(0.05, 0.05, 0.05, 0x40c0f0, -0.08 + i * 0.04 - (i - 2) * 0.03, 0.31, -0.02, head, true, false); }
    if (id === 'phoenix') { for (let i = 0; i < 4; i++) { const f = cone(0.06, 0.28, mat(0xffd040, { emissive: 0xffa000, emissiveIntensity: 1.6 }), -0.09 + i * 0.06, 0.22, -0.05 - i * 0.03, head, 4, false); f.rotation.x = -0.4 - i * 0.15; } }
    if (id === 'eagle') sph(headS * 1.05, headS * 0.6, headS * 1.05, 0xd8b060, 0, 0.06, -0.02, head, true);
    if (id === 'loon') { box(0.36, 0.05, 0.02, 0xf4f4f4, 0, -0.22, 0.05, head, false); }
    // крылья
    const wingL = group(b, -bodyS[0] * 0.45, legH + bodyS[1] * 0.78, 0.02), wingR = group(b, bodyS[0] * 0.45, legH + bodyS[1] * 0.78, 0.02);
    const wl = sph(0.1, bodyS[1] * 0.7, bodyS[2] * 0.85, wingMat, -0.02, -bodyS[1] * 0.3, -0.06, wingL);
    const wr = sph(0.1, bodyS[1] * 0.7, bodyS[2] * 0.85, wingMat, 0.02, -bodyS[1] * 0.3, -0.06, wingR);
    if (id === 'parrot') { sph(0.08, bodyS[1] * 0.4, bodyS[2] * 0.6, 0xf0c020, -0.04, -bodyS[1] * 0.12, 0, wingL); sph(0.08, bodyS[1] * 0.4, bodyS[2] * 0.6, 0xf0c020, 0.04, -bodyS[1] * 0.12, 0, wingR); }
    if (id === 'bullfinch') { box(0.11, 0.05, 0.3, 0xf0f0f0, -0.03, -0.12, 0, wingL, false); box(0.11, 0.05, 0.3, 0xf0f0f0, 0.03, -0.12, 0, wingR, false); }
    P.wingL = wingL; P.wingR = wingR; wl.rotation.x = 0.15; wr.rotation.x = 0.15;
    if (HI) {
      // маховые перья веером на концах крыльев, блик в глазах, перья на груди
      const fc = new THREE.Color(wingMat.color || 0x6a4a2a).multiplyScalar(0.7).getHex();
      [[wingL, -1], [wingR, 1]].forEach(([wg, sx]) => {
        for (let i = 0; i < 5; i++) { const f = box(0.025, 0.07, bodyS[2] * (0.42 - i * 0.04), fc, sx * 0.03, -bodyS[1] * (0.45 + i * 0.07), -bodyS[2] * 0.42, wg, false); f.rotation.x = 0.35 + i * 0.12; }
        for (let i = 0; i < 3; i++) { const cv = box(0.03, 0.05, bodyS[2] * 0.5, wingMat, sx * 0.05, -bodyS[1] * (0.12 + i * 0.1), -0.02, wg, false); cv.rotation.x = 0.2; }
      });
      [-1, 1].forEach(sx => sph(0.03, 0.03, 0.02, 0xffffff, sx * headS * 0.33, headS * 0.17, headS * (id === 'owl' ? 0.48 : 0.33), head, true, false));
      for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.28; sph(0.13, 0.08, 0.06, bellyMat, Math.sin(a) * bodyS[0] * 0.32, legH + bodyS[1] * (0.25 + (i % 2) * 0.12), bodyS[2] * 0.36 + Math.cos(a) * 0.02, b, true, false); }
    }
    // хвост
    const tail = group(b, 0, legH + bodyS[1] * 0.55, -bodyS[2] * 0.45); P.tail = tail;
    if (id === 'peacock') {
      const fanMat = texMat(canvasTex('pfan', 64, 128, (g2, w, h2) => { g2.fillStyle = '#2a8a3a'; g2.fillRect(0, 0, w, h2); g2.strokeStyle = '#7ad04a'; g2.lineWidth = 2; for (let i = 0; i < 8; i++) { g2.beginPath(); g2.moveTo(w / 2, h2); g2.lineTo(i * 9, 0); g2.stroke(); } g2.fillStyle = '#e8c030'; g2.beginPath(); g2.arc(w / 2, 22, 13, 0, 7); g2.fill(); g2.fillStyle = '#1a5ad0'; g2.beginPath(); g2.arc(w / 2, 22, 8, 0, 7); g2.fill(); g2.fillStyle = '#101830'; g2.beginPath(); g2.arc(w / 2, 22, 4, 0, 7); g2.fill(); }));
      for (let i = 0; i < 13; i++) { const a = -1.45 + i * 0.242; const f = box(0.26, 1.3, 0.03, fanMat, Math.sin(a) * 0.6, 0.35 + Math.cos(a) * 0.6, -0.12, tail); f.rotation.z = -a; }
    } else if (id === 'phoenix') {
      const fl = mat(0xffa020, { emissive: 0xff6000, emissiveIntensity: 1.4 });
      for (let i = 0; i < 5; i++) { const f = cone(0.09, 0.9, fl, (i - 2) * 0.09, 0.05, -0.45, tail, 5, false); f.rotation.x = -Math.PI / 2 - 0.2 + Math.abs(i - 2) * 0.12; f.rotation.z = (i - 2) * 0.15; }
    } else if (id === 'flamingo' || id === 'hummingbird') {
      const t1 = box(0.16, 0.04, 0.3, wingMat, 0, 0, -0.12, tail); t1.rotation.x = -0.3;
    } else if (id === 'turkey') {
      const fanMat = texMat(T.feather('#6a4e34', '#e8d8b0', 'fan'));
      for (let i = 0; i < 11; i++) {
        const a = -1.35 + i * 0.27;
        const f = box(0.2, 0.95, 0.04, fanMat, Math.sin(a) * 0.45, 0.25 + Math.cos(a) * 0.45, -0.1, tail);
        f.rotation.z = -a; box(0.21, 0.12, 0.05, 0xe8d8b0, Math.sin(a) * 0.9, 0.25 + Math.cos(a) * 0.9, -0.1, tail, false).rotation.z = -a;
      }
    } else if (id === 'parrot') {
      const t1 = box(0.12, 0.04, 0.7, 0x2a6ad8, 0, -0.1, -0.3, tail); t1.rotation.x = 0.5;
      const t2 = box(0.08, 0.04, 0.6, 0xd62a20, 0, -0.06, -0.28, tail); t2.rotation.x = 0.45;
    } else if (id === 'loon' || id === 'guinea') {
      const t1 = box(0.25, 0.08, 0.2, wingMat, 0, -0.05, -0.05, tail); t1.rotation.x = 0.4;
    } else {
      const t1 = box(0.22, 0.05, 0.36, id === 'tit' ? 0x3a4a5a : wingMat, 0, 0, -0.14, tail); t1.rotation.x = -0.35;
    }
    // лапы
    const legL = group(b, -0.1, legH, 0.03), legR = group(b, 0.1, legH, 0.03);
    [legL, legR].forEach(l => {
      cyl(0.022, 0.022, legH, legC, 0, -legH / 2, 0, l, 5, false);
      if (id === 'loon') box(0.14, 0.02, 0.14, legC, 0, -legH + 0.01, 0.05, l, false);
      else { box(0.03, 0.02, 0.14, legC, 0, -legH + 0.01, 0.05, l, false); box(0.12, 0.02, 0.03, legC, 0, -legH + 0.01, 0.06, l, false); }
    });
    P.legL = legL; P.legR = legR;
    const s = BIRDS[id] ? BIRDS[id].size : 1;
    root.scale.setScalar(s);
    root.userData.parts = P; root.userData.hover = id === 'hummingbird';
    return root;
  }
  // mode: idle | walk | peck | fly | sit
  function animBird(root, mode, t, phase = 0) {
    const P = root.userData.parts; const tt = t + phase;
    if (mode === 'fly' || mode === 'glide') {
      const f = mode === 'fly' ? Math.sin(tt * 16) * 0.8 : Math.sin(tt * 2) * 0.1;
      P.wingL.rotation.z = -1.25 - f; P.wingR.rotation.z = 1.25 + f;
      P.body.position.y = Math.sin(tt * 16) * 0.03; P.body.rotation.x = 0.15;
      P.legL.rotation.x = P.legR.rotation.x = 1.1; P.head.rotation.x = -0.1; P.tail.rotation.x = 0;
      return;
    }
    P.body.rotation.x = 0;
    const flutter = root.userData.hover ? Math.sin(tt * 60) * 0.9 : (Math.sin(tt * 0.7) > 0.97) ? Math.sin(tt * 30) * 0.4 : 0;
    P.wingL.rotation.z = -0.05 - Math.abs(flutter); P.wingR.rotation.z = 0.05 + Math.abs(flutter);
    if (mode === 'walk') {
      P.legL.rotation.x = Math.sin(tt * 14) * 0.7; P.legR.rotation.x = -Math.sin(tt * 14) * 0.7;
      P.body.position.y = Math.abs(Math.sin(tt * 14)) * 0.04;
      P.head.rotation.x = Math.sin(tt * 14) * 0.12;
    } else {
      P.legL.rotation.x = P.legR.rotation.x = 0; P.body.position.y = Math.sin(tt * 2) * 0.008;
      P.head.rotation.x = mode === 'peck' ? Math.max(0, Math.sin(tt * 9)) * 0.9 : Math.sin(tt * 0.9) * 0.08;
      P.head.rotation.y = mode === 'peck' ? 0 : Math.sin(tt * 0.6 + Math.sin(tt * 1.7)) * 0.6;
    }
    P.tail.rotation.x = Math.sin(tt * 3) * 0.08;
  }

  // ===================== ГЕРОИ =====================
  const HERO_LOOK = {
    defender: { skin: 0xf1c7a0, shirt: 0x3d7a3a, pants: 0x5a4632, boots: 0x3a2a1a, hair: 0x6a3e1e, width: 0.56 },
    builder:  { skin: 0xe8b890, shirt: 0xe07a20, pants: 0x2c5a9a, boots: 0x4a3018, hair: 0x7a4a24, width: 0.7 },
    hunter:   { skin: 0xf3cfa8, shirt: 0x8a5a32, pants: 0x4a4a34, boots: 0x2a1e12, hair: 0x2a1a10, width: 0.5 },
    knight:   { skin: 0xf0c4a0, shirt: 0x9aa0aa, pants: 0x6a6e78, boots: 0x3a3c44, hair: 0x5a3a1e, width: 0.62 },
    ranger:   { skin: 0xe8c09a, shirt: 0x2f5a3a, pants: 0x3a3a2a, boots: 0x2a1e12, hair: 0xc89a4a, width: 0.5 },
    engineer: { skin: 0xd8a888, shirt: 0x3a5a8a, pants: 0x2a3a5a, boots: 0x222222, hair: 0x2a2a2a, width: 0.58 },
    druid:    { skin: 0xf0d0b0, shirt: 0x5a3a8a, pants: 0x4a2a6a, boots: 0x3a2a1a, hair: 0xe8e8e8, width: 0.54 },
  };
  function makeHero(type) {
    const L = HERO_LOOK[type]; const root = new THREE.Group(); const P = { root };
    const hips = group(root, 0, 0.92, 0); P.hips = hips;
    const torso = group(hips, 0, 0, 0); P.torso = torso; P.torsoW = L.width;
    box(L.width, 0.62, 0.32, L.shirt, 0, 0.36, 0, torso);
    box(L.width + 0.02, 0.1, 0.34, 0x3a2614, 0, 0.06, 0, torso); // пояс
    box(0.12, 0.08, 0.05, 0xd8b040, 0, 0.06, 0.18, torso, false);
    const head = group(torso, 0, 0.88, 0); P.head = head;
    sph(0.38, 0.4, 0.38, L.skin, 0, 0, 0, head);
    [-1, 1].forEach(sx => sph(0.06, 0.07, 0.04, 0x1a1a1a, sx * 0.08, 0.02, 0.18, head, true, false));
    sph(0.07, 0.06, 0.06, 0xe0a080, 0, -0.04, 0.2, head, true, false);
    // ноги
    P.legs = [-1, 1].map(sx => {
      const l = group(hips, sx * L.width * 0.24, 0, 0);
      box(0.2, 0.62, 0.22, L.pants, 0, -0.32, 0, l);
      box(0.22, 0.26, 0.28, L.boots, 0, -0.78, 0.03, l);
      return l;
    });
    // руки
    P.arms = [-1, 1].map(sx => {
      const a = group(torso, sx * (L.width / 2 + 0.09), 0.6, 0);
      box(0.16, 0.36, 0.18, L.shirt, 0, -0.16, 0, a);
      box(0.14, 0.26, 0.16, type === 'builder' ? L.skin : L.shirt, 0, -0.44, 0, a);
      sph(0.15, 0.15, 0.15, L.skin, 0, -0.6, 0, a, true);
      return a;
    });
    P.hand = group(P.arms[1], 0, -0.62, 0.02);
    if (type === 'defender') {
      sph(0.42, 0.42, 0.42, 0x2f6a2c, 0, 0.04, -0.04, head, true); // капюшон
      sph(0.4, 0.2, 0.4, L.hair, 0, 0.15, 0.04, head, true);
      const cape = box(L.width + 0.08, 0.95, 0.06, 0x2f6a2c, 0, 0.2, -0.2, torso); cape.rotation.x = 0.08; P.cape = cape;
      const sh = cyl(0.3, 0.3, 0.07, 0x8a5a2a, 0, 0.42, -0.27, torso, 12); sh.rotation.x = Math.PI / 2;
      const sb = cyl(0.1, 0.1, 0.08, 0xc8c8c8, 0, 0.42, -0.31, torso, 8); sb.rotation.x = Math.PI / 2;
      torus(0.29, 0.03, 0xb0b0b0, 0, 0.42, -0.3, torso);
    } else if (type === 'builder') {
      sph(0.42, 0.24, 0.42, 0xf2c41a, 0, 0.13, 0, head, true); cyl(0.3, 0.3, 0.03, 0xf2c41a, 0, 0.08, 0.04, head, 12);
      sph(0.3, 0.2, 0.2, L.hair, 0, -0.14, 0.12, head, true); // борода
      box(L.width * 0.7, 0.4, 0.04, 0x2c5a9a, 0, 0.3, 0.17, torso); // комбинезон
      [-1, 1].forEach(sx => box(0.07, 0.36, 0.03, 0x2c5a9a, sx * 0.18, 0.62, 0.17, torso, false));
      box(0.3, 0.25, 0.2, 0x7a5a3a, 0, 0.3, -0.25, torso); // сумка
    } else if (type === 'knight') {
      const steel = mat(0xb8bec8, { metalness: 0.7, roughness: 0.3 });
      sph(0.42, 0.42, 0.42, steel, 0, 0.04, -0.01, head, true);
      box(0.3, 0.05, 0.05, 0x1a1a1e, 0, 0.04, 0.2, head, false); // прорезь шлема
      const pl = cone(0.05, 0.35, 0xd02020, 0, 0.32, -0.05, head, 5); pl.rotation.x = -0.4;
      box(L.width + 0.06, 0.4, 0.36, steel, 0, 0.45, 0, torso); // нагрудник
      [-1, 1].forEach(sx => sph(0.26, 0.18, 0.26, steel, sx * (L.width / 2 + 0.06), 0.66, 0, torso, true));
      const sh = cyl(0.32, 0.32, 0.07, 0x2a4aa0, 0, 0.4, -0.26, torso, 6); sh.rotation.x = Math.PI / 2;
      box(0.08, 0.4, 0.02, 0xd8b040, 0, 0.4, -0.3, torso, false); box(0.3, 0.08, 0.02, 0xd8b040, 0, 0.45, -0.3, torso, false);
      const cape = box(L.width + 0.08, 0.9, 0.05, 0xb02a2a, 0, 0.2, -0.24, torso); P.cape = cape;
    } else if (type === 'ranger') {
      sph(0.44, 0.44, 0.44, 0x2f5a3a, 0, 0.05, -0.05, head, true); // капюшон
      sph(0.36, 0.14, 0.3, L.hair, 0, 0.1, 0.06, head, true);
      const cape = box(L.width + 0.1, 0.95, 0.05, 0x24482e, 0, 0.2, -0.2, torso); P.cape = cape;
      const q = cyl(0.11, 0.09, 0.6, 0x6a3a1a, -0.12, 0.42, -0.24, torso, 8); q.rotation.z = -0.35;
      for (let i = 0; i < 4; i++) { const ar = box(0.02, 0.3, 0.02, 0xf0f0f0, -0.16 - i * 0.03, 0.78, -0.24 + (i - 1.5) * 0.03, torso, false); ar.rotation.z = -0.35; }
    } else if (type === 'engineer') {
      sph(0.42, 0.22, 0.42, 0xf28a1a, 0, 0.14, 0, head, true);
      box(0.36, 0.1, 0.06, 0x2a2a2e, 0, 0.13, 0.19, head, false); // очки-гоглы
      [-1, 1].forEach(sx => sph(0.11, 0.11, 0.05, mat(0x80d0ff, { metalness: 0.3, roughness: 0.2 }), sx * 0.09, 0.13, 0.22, head, true, false));
      box(L.width * 0.75, 0.45, 0.04, 0xd8a040, 0, 0.32, 0.17, torso); // жилет
      box(L.width + 0.04, 0.12, 0.36, 0x5a3a1a, 0, 0.06, 0, torso);
      for (let i = 0; i < 3; i++) box(0.06, 0.14, 0.06, [0xc0c0c8, 0xd03020, 0xd8b040][i], -0.2 + i * 0.12, 0.04, 0.2, torso, false);
      box(0.32, 0.36, 0.22, 0x5a6a7a, 0, 0.4, -0.24, torso); cyl(0.04, 0.04, 0.4, 0x8a8a90, 0.1, 0.75, -0.26, torso, 5);
    } else if (type === 'druid') {
      sph(0.42, 0.2, 0.42, L.hair, 0, 0.12, 0, head, true);
      const beard = cone(0.16, 0.5, 0xeeeeee, 0, -0.32, 0.12, head, 6); beard.rotation.x = Math.PI;
      const wreath = torus(0.2, 0.04, 0x3f8f32, 0, 0.19, 0, head, 10); wreath.rotation.x = Math.PI / 2;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; sph(0.06, 0.06, 0.06, 0xe8e040, Math.cos(a) * 0.2, 0.21, Math.sin(a) * 0.2, head, true, false); }
      const robe = box(L.width + 0.1, 1.0, 0.4, L.shirt, 0, -0.1, 0, torso); void robe;
      const cape = box(L.width + 0.12, 1.1, 0.05, 0x3a2a5a, 0, 0.1, -0.22, torso); P.cape = cape;
    } else {
      sph(0.4, 0.18, 0.4, L.hair, 0, 0.13, -0.02, head, true);
      const hat = cone(0.3, 0.3, 0x3e5a2a, 0, 0.3, 0, head, 8); cyl(0.36, 0.36, 0.03, 0x3e5a2a, 0, 0.17, 0, head, 12);
      const fe = box(0.04, 0.32, 0.08, 0xd03020, 0.18, 0.36, -0.05, head); fe.rotation.z = -0.5;
      const q = cyl(0.11, 0.09, 0.6, 0x6a3a1a, 0.12, 0.42, -0.22, torso, 8); q.rotation.z = 0.35;
      for (let i = 0; i < 3; i++) { const ar = box(0.02, 0.3, 0.02, 0xe8e0c0, 0.18 + i * 0.03, 0.78, -0.22 + (i - 1) * 0.04, torso, false); ar.rotation.z = 0.35; }
      const cape = box(L.width + 0.05, 0.5, 0.05, 0x3e5a2a, 0, 0.5, -0.19, torso); P.cape = cape;
    }
    root.userData.parts = P;
    root.userData.type = type;
    return root;
  }
  // Спасательный вертолёт (финальная сцена)
  function makeHelicopter() {
    const g = new THREE.Group(); const red = mat(0xd8302a, { roughness: 0.5 }), white = mat(0xf2f2f2, { roughness: 0.5 });
    sph(3.0, 2.4, 4.6, red, 0, 2.2, 0, g);
    sph(2.6, 1.8, 2.2, mat(0x8ad0ff, { metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.75 }), 0, 2.5, 1.6, g, false, false);
    box(3.02, 0.5, 3.0, white, 0, 2.0, -0.3, g);
    const boom = cyl(0.3, 0.55, 5.5, red, 0, 2.6, -4.6, g, 8); boom.rotation.x = Math.PI / 2;
    box(0.15, 1.6, 1.0, white, 0, 3.3, -7.2, g);
    const tailRotor = group(g, 0.22, 3.4, -7.2); for (let i = 0; i < 2; i++) { const b = box(0.06, 1.6, 0.18, 0x2a2a2e, 0, 0, 0, tailRotor, false); b.rotation.x = i * Math.PI / 2; }
    [-1, 1].forEach(sx => { box(0.12, 0.12, 4.2, 0x2a2a2e, sx * 1.2, 0.35, 0.2, g); [-1, 1].forEach(sz => box(0.1, 0.9, 0.1, 0x2a2a2e, sx * 1.1, 0.8, sz * 1.2, g, false)); });
    cyl(0.25, 0.3, 0.6, 0x3a3a40, 0, 3.6, 0.2, g, 8);
    const rotor = group(g, 0, 3.95, 0.2); for (let i = 0; i < 4; i++) { const b = box(0.35, 0.06, 6.5, 0x2a2a2e, 0, 0, 3.1, rotor, false); const piv = group(rotor); piv.rotation.y = i * Math.PI / 2; piv.add(b); }
    box(1.4, 1.4, 0.06, white, 0, 2.3, -0.05 + 1.0, g, false).position.set(1.52, 2.3, -0.4);
    const crossH = box(0.06, 0.25, 0.8, red, 1.56, 2.3, -0.4, g, false); void crossH; box(0.06, 0.8, 0.25, red, 1.56, 2.3, -0.4, g, false);
    const lamp = sph(0.2, 0.2, 0.2, mat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 2 }), 0, 4.05, -6.8, g, true, false); void lamp;
    // --- детали ---
    const dark = mat(0x2a2a2e, { roughness: 0.6 }), steel = mat(0xb8bec8, { metalness: 0.6, roughness: 0.35 }), glass = mat(0x8ad0ff, { metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.8 });
    box(0.5, 0.25, 0.25, dark, 0, 1.6, 1.6, g);                                   // рама кабины
    for (let i = -1; i <= 1; i += 2) cyl(0.04, 0.04, 2.0, dark, i * 0.75, 2.5, 1.9, g, 4, false).rotation.x = 0.5;
    [-1, 1].forEach(sx => {
      box(0.06, 1.0, 1.3, glass, sx * 1.47, 2.6, 0.2, g, false);                  // боковые окна
      box(0.06, 1.15, 1.45, dark, sx * 1.46, 2.6, 0.2, g, false).scale.set(0.04, 1.15, 1.45);
      box(0.06, 1.4, 1.2, white, sx * 1.5, 2.2, -1.3, g, false);                  // сдвижная дверь
      box(0.08, 0.06, 0.3, dark, sx * 1.55, 2.2, -0.9, g, false);                 // ручка
      cyl(0.05, 0.05, 1.2, steel, sx * 1.55, 2.9, -1.3, g, 4, false).rotation.x = Math.PI / 2; // направляющая двери
      box(0.6, 0.06, 0.35, dark, sx * 1.35, 0.95, 0.9, g);                        // ступенька
      const ex = cyl(0.16, 0.2, 0.6, 0x4a4a50, sx * 0.55, 3.35, -1.4, g, 8); ex.rotation.x = Math.PI / 2 + 0.3; // выхлоп
      cyl(0.12, 0.12, 0.05, 0x111111, sx * 0.55, 3.25, -1.72, g, 8).rotation.x = Math.PI / 2 + 0.3;
      box(1.1, 0.08, 0.45, red, sx * 0.6, 2.75, -6.3, g);                          // хвостовой стабилизатор
      box(0.08, 0.5, 0.45, white, sx * 1.15, 2.85, -6.3, g, false);
    });
    box(1.6, 0.7, 2.6, red, 0, 3.4, -0.6, g);                                       // кожух двигателя
    box(1.2, 0.08, 1.2, 0x3a3a40, 0, 3.78, -1.3, g, false);                         // решётка
    for (let i = 0; i < 4; i++) box(1.0, 0.04, 0.06, 0x111111, 0, 3.83, -1.7 + i * 0.25, g, false);
    box(0.17, 0.6, 1.02, red, 0, 3.0, -7.2, g, false);                              // полоса на киле
    const ant = cyl(0.02, 0.02, 0.8, dark, 0, 4.0, -2.4, g, 4, false); ant.rotation.x = -0.4; // антенна
    const sl = cyl(0.18, 0.22, 0.25, dark, 0.6, 0.95, 2.1, g, 10); sl.rotation.x = Math.PI / 2; // прожектор под носом
    cyl(0.16, 0.16, 0.03, mat(0xffffff, { emissive: 0xfff4c0, emissiveIntensity: 2 }), 0.6, 0.95, 2.24, g, 10, false).rotation.x = Math.PI / 2;
    sph(0.12, 0.12, 0.12, mat(0x30ff40, { emissive: 0x20ff30, emissiveIntensity: 2 }), 1.5, 2.0, 1.0, g, true, false); // навигационные огни
    sph(0.12, 0.12, 0.12, mat(0xff3030, { emissive: 0xff2020, emissiveIntensity: 2 }), -1.5, 2.0, 1.0, g, true, false);
    cyl(0.12, 0.12, 0.3, steel, 0, 3.75, 0.2, g, 8);                                // вал ротора
    sph(0.35, 0.2, 0.35, dark, 0, 4.05, 0.2, g, true);                               // втулка
    for (let i = 0; i < 4; i++) { const tip = box(0.36, 0.07, 0.4, 0xf2c41a, 0, 0, 6.2, rotor, false); const pv = group(rotor); pv.rotation.y = i * Math.PI / 2; pv.add(tip); } // жёлтые кончики лопастей
    [-1, 1].forEach(sx => [-1.1, 1.3].forEach(z => { const st = box(0.08, 0.08, 0.8, dark, sx * 1.2, 0.35, z, g, false); st.rotation.x = 0; box(0.14, 0.14, 0.14, steel, sx * 1.2, 0.35, z + 0.4, g, false); })); // крепления полозьев
    [-1, 1].forEach(sx => { const tipU = box(0.12, 0.12, 0.5, 0x2a2a2e, sx * 1.2, 0.5, 2.45, g, false); tipU.rotation.x = -0.6; }); // загнутые носки полозьев
    g.userData.rotor = rotor; g.userData.tailRotor = tailRotor;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  // Снаряжение: лампа в левой руке или каска с прожектором
  function setGear(root, gear) {
    const P = root.userData.parts;
    if (P.gearL) { P.gearL.parent.remove(P.gearL); P.gearL = null; }
    if (P.gearH) { P.gearH.parent.remove(P.gearH); P.gearH = null; }
    if (gear === 'lamp') {
      const l = group(P.arms[0], 0, -0.7, 0.05); P.gearL = l;
      cyl(0.01, 0.01, 0.12, 0x2a2a2e, 0, 0.02, 0, l, 4, false);
      box(0.16, 0.2, 0.16, mat(0xffd27a, { emissive: 0xffa030, emissiveIntensity: 1.8 }), 0, -0.12, 0, l, false);
      cone(0.13, 0.1, 0x2a2a2e, 0, 0.0, 0, l, 4, false);
    } else if (gear === 'helmet') {
      const hd = group(P.head, 0, 0, 0); P.gearH = hd;
      sph(0.44, 0.26, 0.44, mat(0xf2c41a, { roughness: 0.5 }), 0, 0.14, 0, hd, true);
      cyl(0.31, 0.31, 0.03, 0xf2c41a, 0, 0.09, 0.03, hd, 12);
      const lamp = cyl(0.08, 0.1, 0.1, 0x3a3a40, 0, 0.18, 0.2, hd, 10); lamp.rotation.x = Math.PI / 2;
      const glass = cyl(0.075, 0.075, 0.02, mat(0xffffff, { emissive: 0xfff4c0, emissiveIntensity: 2.5 }), 0, 0.18, 0.26, hd, 10, false); glass.rotation.x = Math.PI / 2;
    }
  }
  // Броня: кожаная (жилет, наплечники, наручи) или железная (нагрудник, наплечники, поножи)
  function setArmor(root, id) {
    const P = root.userData.parts;
    if (P.armor) { P.armor.forEach(o => o.parent && o.parent.remove(o)); }
    P.armor = [];
    if (!id) return;
    const ruby = id === 'ruby', iron = id === 'iron' || ruby;
    const m1 = ruby ? mat(0xe0204a, { emissive: 0x900018, emissiveIntensity: 0.6, roughness: 0.25 }) : iron ? mat(0xd4dae2, { metalness: 0.3, roughness: 0.3 }) : mat(0x7a4a24, { roughness: 0.85 });
    const m2 = ruby ? mat(0x8a1028, { roughness: 0.35 }) : iron ? mat(0x9aa2ae, { metalness: 0.3, roughness: 0.4 }) : mat(0x4a2c14, { roughness: 0.9 });
    const rim = iron ? mat(0xd8b040, { metalness: 0.6, roughness: 0.35 }) : mat(0xc8a070);
    const w = (P.torsoW || 0.56) + 0.06;
    const t = group(P.torso, 0, 0, 0); P.armor.push(t);
    box(w, 0.5, 0.38, m1, 0, 0.4, 0, t);                       // корпус
    if (iron) {
      box(w * 0.7, 0.3, 0.04, m2, 0, 0.48, 0.2, t);             // выпуклая пластина
      box(w + 0.02, 0.05, 0.4, rim, 0, 0.66, 0, t, false);
      box(w + 0.02, 0.05, 0.4, rim, 0, 0.16, 0, t, false);
      box(0.24, 0.12, 0.3, m1, 0, 0.72, 0, t);                  // горжет
    } else {
      [-1, 1].forEach(sx => { const st = box(0.06, 0.62, 0.02, m2, sx * w * 0.22, 0.4, 0.2, t, false); st.rotation.z = sx * 0.5; });
      box(0.08, 0.06, 0.02, rim, 0, 0.4, 0.21, t, false);       // пряжка
      box(w + 0.02, 0.06, 0.4, m2, 0, 0.18, 0, t, false);
    }
    P.arms.forEach((a, i) => {
      const sx = i ? 1 : -1;
      const g = group(a, 0, 0, 0); P.armor.push(g);
      const sh = sph(0.27, iron ? 0.2 : 0.16, 0.27, m1, sx * 0.02, 0.02, 0, g, true); // наплечник
      if (iron) box(0.22, 0.04, 0.24, rim, sx * 0.02, -0.06, 0, g, false);
      box(0.18, 0.18, 0.2, iron ? m1 : m2, 0, -0.44, 0, g);     // наруч
    });
    P.legs.forEach(l => {
      const g = group(l, 0, 0, 0); P.armor.push(g);
      if (iron) { box(0.24, 0.3, 0.26, m1, 0, -0.5, 0.01, g); sph(0.12, 0.1, 0.1, m2, 0, -0.36, 0.12, g, true); }
      else box(0.24, 0.16, 0.26, m2, 0, -0.06, 0, g);           // кожаная юбка
    });
  }
  function makeTool(kind, tier) {
    const g = new THREE.Group();
    const headC = [0x8a6a44, 0x8a8a8a, 0xd8dce4, 0xe0204a][Math.max(0, tier)] || 0x8a6a44;
    const metal = tier >= 3 ? { emissive: 0xa00020, emissiveIntensity: 0.7, roughness: 0.25 } : tier >= 2 ? { metalness: 0.6, roughness: 0.35 } : undefined;
    cyl(0.035, 0.035, 0.75, 0x6a4424, 0, 0.25, 0, g, 6);
    if (kind === 'axe' && tier >= 4) { // бензопила
      g.children[0].visible = false;
      box(0.07, 0.14, 0.12, 0x2a2a2a, 0, 0.0, 0, g);                     // рукоять
      box(0.2, 0.24, 0.36, 0xf08a10, 0, 0.18, -0.04, g);                  // корпус
      box(0.21, 0.08, 0.2, 0x2a2a2a, 0, 0.33, -0.08, g, false);
      box(0.04, 0.8, 0.14, mat(0xc8ccd4, { metalness: 0.6, roughness: 0.35 }), 0, 0.68, 0.06, g);  // шина
      cyl(0.07, 0.07, 0.05, 0xc8ccd4, 0, 1.08, 0.06, g, 10).rotation.z = Math.PI / 2;
      for (let i = 0; i < 8; i++) box(0.06, 0.04, 0.18, 0x3a3a3a, 0, 0.33 + i * 0.1, 0.06, g, false); // цепь
    } else if (kind === 'pick' && tier >= 4) { // отбойный молоток
      g.children[0].visible = false;
      box(0.36, 0.06, 0.06, 0x2a2a2a, 0, -0.02, 0, g);                   // поперечная рукоять
      box(0.18, 0.4, 0.18, 0xf2c41a, 0, 0.22, 0, g);                      // корпус
      box(0.2, 0.06, 0.2, 0x2a2a2a, 0, 0.44, 0, g, false);
      cyl(0.06, 0.07, 0.24, 0x5a5a62, 0, 0.56, 0, g, 8);
      const bit = mat(0xe0204a, { emissive: 0x900018, emissiveIntensity: 0.6, roughness: 0.25 });
      cyl(0.03, 0.03, 0.34, bit, 0, 0.82, 0, g, 6); cone(0.04, 0.1, bit, 0, 1.02, 0, g, 6, false);
    } else if (kind === 'axe') {
      box(0.06, 0.2, 0.24, mat(headC, metal), 0, 0.52, 0.1, g);
      box(0.04, 0.24, 0.05, mat(tier >= 3 ? 0xff5070 : tier >= 1 ? 0xcfd2d8 : 0x6a4a2a, metal), 0, 0.52, 0.23, g, false);
    } else if (kind === 'pick') {
      const a = box(0.06, 0.06, 0.32, mat(headC, metal), 0, 0.58, 0.14, g); a.rotation.x = 0.35;
      const b = box(0.06, 0.06, 0.32, mat(headC, metal), 0, 0.58, -0.14, g); b.rotation.x = -0.35;
    } else if (kind === 'hammer') {
      box(0.14, 0.14, 0.26, 0x5a5a5a, 0, 0.56, 0, g);
    } else if (kind === 'sword') {
      g.children[0].visible = false;
      // 0 — дерево, 1 — камень, 2 — сталь, 3 — рубин
      const st = Math.max(0, Math.min(3, tier));
      const steel = [mat(0xa87444, { roughness: 0.9 }), mat(0x9a9a96, { roughness: 0.85 }), mat(0xdde2ea, { metalness: 0.8, roughness: 0.25 }), mat(0xe8204a, { emissive: 0xb00024, emissiveIntensity: 0.8, roughness: 0.2 })][st];
      cyl(0.035, 0.035, 0.22, 0x5a3a1a, 0, 0.0, 0, g, 6);
      box(0.3, 0.05, 0.08, st >= 2 ? 0xd8b040 : 0x6a4424, 0, 0.12, 0, g);
      box(0.08, 0.85, 0.025, steel, 0, 0.56, 0, g);
      cone(0.04, 0.12, steel, 0, 1.04, 0, g, 4, false);
    } else if (kind === 'bow') {
      g.children[0].visible = false;
      for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const seg = box(0.05, 0.2, 0.05, 0x7a4a24, 0, 0.25 + Math.sin(a) * 0.5, Math.cos(a) * 0.22 - 0.12, g); seg.rotation.x = -a; }
      box(0.01, 1.0, 0.01, 0xeeeeee, 0, 0.25, -0.14, g, false);
    } else if (kind === 'wrench') {
      const steel = mat(0xb0b6c0, { metalness: 0.7, roughness: 0.35 });
      box(0.08, 0.16, 0.24, steel, 0, 0.58, 0.04, g); box(0.08, 0.1, 0.08, steel, 0, 0.66, -0.1, g);
    } else if (kind === 'staff') {
      g.children[0].scale.y = 1.6; g.children[0].position.y = 0.45;
      sph(0.18, 0.18, 0.18, mat(0x7ae860, { emissive: 0x40d020, emissiveIntensity: 1.6 }), 0, 1.05, 0, g, true, false);
      for (let i = 0; i < 3; i++) { const l = sph(0.08, 0.03, 0.14, 0x3f8f32, Math.cos(i * 2.1) * 0.1, 0.92, Math.sin(i * 2.1) * 0.1, g, true, false); l.rotation.y = i * 2.1; }
    }
    g.rotation.x = Math.PI / 2; g.position.set(0, -0.02, 0.02);
    return g;
  }
  // swing 0..1 (анимация удара)
  function animHero(root, state, t, speedK, swing) {
    const P = root.userData.parts;
    const run = state === 'run' ? 1.4 : 1;
    if (state === 'walk' || state === 'run') {
      const f = t * 10 * speedK, a = Math.sin(f) * 0.7 * run;
      P.legs[0].rotation.x = a; P.legs[1].rotation.x = -a;
      P.arms[0].rotation.x = -a * 0.8; P.arms[1].rotation.x = a * 0.8;
      P.hips.position.y = 0.92 + Math.abs(Math.cos(f)) * 0.07;
      P.torso.rotation.x = 0.08 * run; P.head.rotation.y = 0;
    } else {
      P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      P.arms[0].rotation.x = Math.sin(t * 1.6) * 0.05; P.arms[1].rotation.x = -Math.sin(t * 1.6) * 0.05;
      P.hips.position.y = 0.92 + Math.sin(t * 2) * 0.012; P.torso.rotation.x = 0;
      P.head.rotation.y = Math.sin(t * 0.5) * 0.25;
    }
    P.arms[0].rotation.z = -0.08; P.arms[1].rotation.z = 0.08;
    if (P.cape) P.cape.rotation.x = 0.08 + (state === 'idle' ? Math.sin(t * 2) * 0.03 : 0.25 * run);
    if (swing > 0) {
      const s = swing < 0.4 ? swing / 0.4 : 1 - (swing - 0.4) / 0.6;
      const k = swing < 0.4 ? -2.6 * s : -2.6 + 3.4 * (1 - s) - 0.8 * (1 - s); // замах и удар
      P.arms[1].rotation.x = swing < 0.4 ? -2.6 * s : -2.6 + 3.2 * Math.min(1, (swing - 0.4) / 0.25);
      P.torso.rotation.y = swing < 0.4 ? -0.3 * s : 0.3 * (1 - s);
      void k;
    } else P.torso.rotation.y = 0;
  }

  // ===================== ЗВЕРИ =====================
  function makeEnemy(type) {
    const root = new THREE.Group(); const P = { root };
    const d = ({
      wolf:    { c: 0x7c8088, c2: 0x50545c, belly: 0xc8c8c8, len: 1.15, h: 0.5, w: 0.42, legH: 0.48, head: 0.36 },
      fox:     { c: 0xd8742a, c2: 0xb85a1a, belly: 0xf4f0e8, len: 0.9, h: 0.38, w: 0.32, legH: 0.36, head: 0.3 },
      boar:    { c: 0x4a3426, c2: 0x2e2018, belly: 0x5a4434, len: 1.15, h: 0.66, w: 0.58, legH: 0.36, head: 0.42 },
      bear:    { c: 0x5a3c24, c2: 0x3e2816, belly: 0x6a4a30, len: 1.7, h: 1.0, w: 0.95, legH: 0.6, head: 0.6 },
      lynx:    { c: 0xc8a272, c2: 0x8a6a48, belly: 0xece0cc, len: 1.0, h: 0.46, w: 0.38, legH: 0.5, head: 0.34 },
      monster: { c: 0x2e3f26, c2: 0x1a2416, belly: 0x4a5a30, len: 2.2, h: 1.5, w: 1.4, legH: 0.9, head: 0.85 },
      raccoon: { c: 0x8a8a90, c2: 0x5a5a60, belly: 0xc8c8c8, len: 0.8, h: 0.42, w: 0.4, legH: 0.26, head: 0.32 },
      wolverine: { c: 0x3a2a1e, c2: 0x2a1c12, belly: 0xa8885a, len: 1.0, h: 0.52, w: 0.5, legH: 0.32, head: 0.36 },
      elk:     { c: 0x6a4a2e, c2: 0x4a3420, belly: 0x9a7a54, len: 1.8, h: 1.0, w: 0.8, legH: 1.15, head: 0.5 },
      alpha:   { c: 0x1e1e24, c2: 0x101014, belly: 0x4a4a52, len: 1.9, h: 0.85, w: 0.75, legH: 0.8, head: 0.6 },
      bearking:{ c: 0x4a2e18, c2: 0x2e1c0e, belly: 0x6a4428, len: 2.6, h: 1.6, w: 1.5, legH: 0.9, head: 0.9 },
      werewolf:{ c: 0x4a3e36, c2: 0x2e2620, belly: 0x6a5e54, len: 1.5, h: 0.85, w: 0.7, legH: 0.85, head: 0.5 },
      direboar:{ c: 0x3a2a20, c2: 0x241812, belly: 0x4a3a2c, len: 1.6, h: 0.95, w: 0.85, legH: 0.5, head: 0.58 },
      troll:   { c: 0x5a6a4a, c2: 0x3e4a32, belly: 0x7a8a62, len: 2.0, h: 1.7, w: 1.4, legH: 1.0, head: 0.75 },
      treant:  { c: 0x5a4028, c2: 0x3e2c1a, belly: 0x6e5236, len: 2.4, h: 1.8, w: 1.3, legH: 1.1, head: 0.8 },
    })[type];
    const body = group(root, 0, d.legH + d.h / 2, 0); P.body = body;
    const bark = (type === 'treant') ? texMat(canvasTex('bark', 64, 128, (g, w, hh) => { g.fillStyle = '#5a4028'; g.fillRect(0, 0, w, hh); g.strokeStyle = '#2e1e10'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 4, hh); g.stroke(); } })) : null;
    const bodyMat = bark ? bark : type === 'lynx' ? texMat(canvasTex('lynx', 128, 128, (g, w, h) => { g.fillStyle = '#c8a272'; g.fillRect(0, 0, w, h); g.fillStyle = '#6a4a2a'; const r = rnd(5); for (let i = 0; i < 120; i++) { g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 2, 0, 7); g.fill(); } })) : mat(d.c);
    sph(d.w, d.h, d.len, bodyMat, 0, 0, 0, body);
    sph(d.w * 0.95, d.h * 0.7, d.len * 0.55, d.c2, 0, d.h * 0.2, -d.len * 0.1, body, true);
    sph(d.w * 0.8, d.h * 0.6, d.len * 0.6, d.belly, 0, -d.h * 0.15, d.len * 0.08, body, true);
    if (type === 'wolf' || type === 'monster' || type === 'alpha' || type === 'werewolf') sph(d.w * 1.05, d.h * 1.0, d.len * 0.45, d.c, 0, 0.05, d.len * 0.25, body, true); // грива
    if (type === 'boar') for (let i = 0; i < 6; i++) cone(0.05, 0.22, 0x1a120c, 0, d.h * 0.5, d.len * 0.35 - i * 0.14, body, 4, false);
    if (type === 'wolverine') box(d.w * 0.9, 0.06, d.len * 0.8, 0xc8a870, 0, d.h * 0.32, -d.len * 0.05, body, false);
    if (type === 'alpha') for (let i = 0; i < 6; i++) { const sp = cone(0.08, 0.4, 0x3a3a44, 0, d.h * 0.48, d.len * 0.3 - i * 0.18, body, 4, false); sp.rotation.x = -0.5; }
    if (type === 'bearking') { box(d.w * 1.05, d.h * 0.5, d.len * 0.55, mat(0x7a7e88, { metalness: 0.6, roughness: 0.4 }), 0, d.h * 0.3, -d.len * 0.05, body); for (let i = 0; i < 4; i++) cone(0.12, 0.4, mat(0xd8b040, { metalness: 0.7, roughness: 0.3 }), 0, d.h * 0.62, d.len * 0.15 - i * 0.25, body, 5, false); }
    if (type === 'treant') { for (let i = 0; i < 6; i++) { const lf = sph(1.1 + (i % 3) * 0.3, 0.8, 1.1, i % 2 ? 0x3f7f32 : 0x4c8f3a, (i % 2 ? 0.4 : -0.4), d.h * 0.55 + (i % 3) * 0.2, d.len * 0.3 - i * 0.28, body, true); void lf; } for (let i = 0; i < 4; i++) { const br = cyl(0.06, 0.12, 1.2, 0x4a3420, (i % 2 ? 0.6 : -0.6), d.h * 0.7, d.len * 0.1 - i * 0.3, body, 5); br.rotation.z = (i % 2 ? -0.7 : 0.7); } }
    if (type === 'direboar') { const steel = mat(0x8a8e98, { metalness: 0.7, roughness: 0.35 }); for (let i = 0; i < 4; i++) box(d.w * 1.02, 0.12, 0.3, steel, 0, d.h * 0.35, d.len * 0.3 - i * 0.32, body); for (let i = 0; i < 6; i++) cone(0.06, 0.3, 0x2a2a2e, 0, d.h * 0.52, d.len * 0.35 - i * 0.2, body, 4, false); }
    if (type === 'werewolf') { sph(d.w * 1.1, d.h * 1.1, d.len * 0.5, d.c2, 0, 0.1, d.len * 0.22, body, true); for (let i = 0; i < 5; i++) { const sp = cone(0.07, 0.3, d.c2, 0, d.h * 0.55, d.len * 0.25 - i * 0.18, body, 4, false); sp.rotation.x = -0.6; } }
    if (type === 'troll') { const club = group(body, d.w * 0.6, -d.h * 0.1, d.len * 0.3); const c1 = cyl(0.12, 0.28, 1.8, 0x6a4a2a, 0, -0.4, 0.3, club, 7); c1.rotation.x = 0.9; for (let i = 0; i < 4; i++) cone(0.06, 0.2, 0x9a9aa4, 0.15 * Math.cos(i * 1.6), -0.9, 0.95 + 0.15 * Math.sin(i * 1.6), club, 4, false); sph(d.w * 0.9, d.h * 0.4, d.len * 0.4, 0x8a6a3a, 0, -d.h * 0.25, 0, body, true); }
    if (type === 'raccoon') { for (let i = 0; i < 3; i++) { const r = cyl(0.13, 0.13, 0.08, 0x2a2a2e, 0, -0.05 - i * 0.02, -0.15 - i * 0.16, null, 8, false); void r; } }
    if (type === 'monster') for (let i = 0; i < 5; i++) { const sp = cone(0.14, 0.55, 0x5a6a3a, 0, d.h * 0.48, d.len * 0.3 - i * 0.32, body, 5); sp.rotation.x = -0.4; }
    // голова
    const head = group(body, 0, d.h * 0.25, d.len * 0.5); P.head = head;
    sph(d.head, d.head * 0.9, d.head * 1.05, d.c, 0, 0, 0, head);
    const snoutL = type === 'treant' ? 0.2 : (type === 'bear' || type === 'bearking') ? 0.3 : type === 'elk' ? 0.45 : (type === 'boar' ? 0.32 : (type === 'lynx' ? 0.16 : 0.34));
    const sn = box(d.head * 0.5, d.head * 0.42, snoutL, type === 'fox' ? 0xf4f0e8 : d.c2, 0, -d.head * 0.12, d.head * 0.45 + snoutL / 2 - 0.05, head);
    if (type === 'boar') { box(d.head * 0.55, d.head * 0.45, 0.06, 0xd89a90, 0, -d.head * 0.12, d.head * 0.45 + snoutL, head, false); [-1, 1].forEach(sx => { const t = cone(0.04, 0.22, 0xf4ecd8, sx * 0.13, -d.head * 0.1, d.head * 0.55 + snoutL * 0.6, head, 5); t.rotation.x = -0.6; }); }
    else sph(0.08 * d.head / 0.35, 0.06 * d.head / 0.35, 0.06, 0x111111, 0, -d.head * 0.04, d.head * 0.45 + snoutL - 0.04, head, true, false);
    void sn;
    const eyeMat = (type === 'werewolf') ? mat(0xffd020, { emissive: 0xffb000, emissiveIntensity: 2.4 }) : (type === 'alpha' || type === 'bearking' || type === 'direboar') ? mat(0xff2010, { emissive: 0xff1000, emissiveIntensity: 2.2 }) : type === 'treant' ? mat(0x9aff60, { emissive: 0x60ff20, emissiveIntensity: 2 }) : type === 'monster' ? mat(0xff3010, { emissive: 0xff2000, emissiveIntensity: 2 }) : mat(0x111111);
    [-1, 1].forEach(sx => {
      sph(d.head * 0.15, d.head * 0.15, d.head * 0.1, eyeMat, sx * d.head * 0.28, d.head * 0.12, d.head * 0.42, head, true, false);
      // уши
      if (type === 'elk') { const ant = group(head, sx * d.head * 0.3, d.head * 0.45, -d.head * 0.1); const a1 = cyl(0.04, 0.06, 0.7, 0xd8c8a0, 0, 0.3, 0, ant, 5); a1.rotation.z = -sx * 0.6; const pal = box(0.6, 0.08, 0.35, 0xd8c8a0, sx * 0.45, 0.62, 0, ant); pal.rotation.z = -sx * 0.3; for (let k = 0; k < 3; k++) cone(0.04, 0.25, 0xd8c8a0, sx * (0.25 + k * 0.17), 0.78, 0, ant, 4, false); }
      else if (type === 'treant') { const hb = cyl(0.05, 0.1, 0.9, 0x4a3420, sx * d.head * 0.4, d.head * 0.6, 0, head, 5); hb.rotation.z = -sx * 0.5; }
      else if (type === 'troll') { const t2 = cone(0.08, 0.35, 0xf0e8d0, sx * d.head * 0.25, -d.head * 0.15, d.head * 0.5, head, 5); t2.rotation.x = -2.6; sph(d.head * 0.35, d.head * 0.25, d.head * 0.1, d.c2, sx * d.head * 0.5, d.head * 0.1, 0, head, true); }
      else if (type === 'bear' || type === 'boar' || type === 'bearking' || type === 'direboar' || type === 'raccoon' && false) sph(d.head * 0.3, d.head * 0.3, d.head * 0.12, d.c2, sx * d.head * 0.35, d.head * 0.42, -d.head * 0.05, head, true);
      else if (type === 'monster') { const h = cone(0.12, 0.7, 0xd8ccb0, sx * d.head * 0.4, d.head * 0.5, 0, head, 6); h.rotation.z = -sx * 0.5; h.rotation.x = -0.3; }
      else {
        const e = cone(d.head * 0.22, d.head * 0.5, type === 'fox' ? 0x2a1a10 : d.c2, sx * d.head * 0.25, d.head * 0.5, -d.head * 0.05, head, 4); e.rotation.z = -sx * 0.15;
        if (type === 'lynx') cone(0.025, 0.18, 0x111111, sx * d.head * 0.25, d.head * 0.82, -d.head * 0.05, head, 4, false);
      }
    });
    // ноги
    P.legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
      const l = group(body, sx * d.w * 0.3, -d.h * 0.2, sz * d.len * 0.3);
      box(d.w * 0.28, d.legH + d.h * 0.2, d.w * 0.3, sz > 0 ? d.c : d.c2, 0, -(d.legH + d.h * 0.2) / 2, 0, l);
      box(d.w * 0.3, 0.08, d.w * 0.36, type === 'fox' ? 0x1a1010 : d.c2, 0, -(d.legH + d.h * 0.2) + 0.04, 0.03, l, false);
      P.legs.push(l);
    });
    // хвост
    const tail = group(body, 0, d.h * 0.2, -d.len * 0.48); P.tail = tail;
    if (type === 'raccoon') { [-1, 1].forEach(sx => box(0.14, 0.08, 0.04, 0x1a1a1a, sx * 0.09, d.head * 0.12, d.head * 0.44, head, false)); const t = sph(0.18, 0.18, 0.55, 0x8a8a90, 0, -0.08, -0.25, tail); t.rotation.x = 0.4; for (let i = 0; i < 3; i++) { const r = cyl(0.1, 0.1, 0.06, 0x2a2a2e, 0, -0.1 - i * 0.05, -0.12 - i * 0.14, tail, 8, false); r.rotation.x = Math.PI / 2 + 0.4; } }
    else if (type === 'bearking') { const cr = group(head, 0, d.head * 0.55, 0); cyl(0.32, 0.36, 0.2, mat(0xd8b040, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, cr, 8); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; cone(0.07, 0.25, mat(0xd8b040, { metalness: 0.8, roughness: 0.3 }), Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3, cr, 4, false); } }
    else if (type === 'alpha') { const t = sph(0.26, 0.26, 0.9, d.c2, 0, -0.15, -0.35, tail); t.rotation.x = 0.7; }
    else if (type === 'elk') { const t = cyl(0.05, 0.08, 0.3, d.c2, 0, -0.05, -0.05, tail, 5); t.rotation.x = 0.5; }
    else if (type === 'fox') { const t = sph(0.26, 0.26, 0.75, d.c, 0, -0.1, -0.35, tail); t.rotation.x = 0.5; sph(0.18, 0.18, 0.22, 0xffffff, 0, -0.27, -0.68, tail, true); }
    else if (type === 'wolf') { const t = sph(0.18, 0.18, 0.6, d.c2, 0, -0.15, -0.25, tail); t.rotation.x = 0.7; }
    else if (type === 'lynx') sph(0.12, 0.12, 0.22, 0x1a1a1a, 0, 0, -0.08, tail, true);
    else if (type === 'boar') { const t = cyl(0.025, 0.025, 0.3, d.c2, 0, -0.12, -0.05, tail, 4); t.rotation.x = 0.4; }
    else if (type === 'monster') { const t = cone(0.3, 1.2, d.c2, 0, -0.2, -0.5, tail, 6); t.rotation.x = -Math.PI / 2 - 0.4; }
    if (HI) {
      // шерсть клочьями, когти, клыки, блики в глазах
      const furC = new THREE.Color(d.c).multiplyScalar(0.85).getHex();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const f = cone(d.w * 0.09, d.h * 0.32, furC, Math.cos(a) * d.w * 0.46, Math.sin(a) * d.h * 0.42, d.len * 0.22, body, 4, false); f.rotation.set(Math.PI / 2 - 0.6, 0, -a + Math.PI / 2); }
      for (let i = 0; i < 6; i++) { const f = cone(d.w * 0.07, d.h * 0.25, d.c2, (i % 2 ? 1 : -1) * d.w * 0.12, d.h * 0.47, d.len * 0.25 - i * d.len * 0.1, body, 4, false); f.rotation.x = -0.9; }
      P.legs.forEach(l => { for (let k = -1; k <= 1; k++) { const cl = cone(0.025 * d.w / 0.42 + 0.01, 0.1, 0xe8e0d0, k * d.w * 0.08, -(d.legH + d.h * 0.2) + 0.03, d.w * 0.22, l, 4, false); cl.rotation.x = Math.PI / 2; } });
      [-1, 1].forEach(sx => { const tth = cone(0.025, 0.1, 0xf4f0e4, sx * d.head * 0.12, -d.head * 0.3, d.head * 0.62, head, 4, false); tth.rotation.x = Math.PI; sph(d.head * 0.05, d.head * 0.05, d.head * 0.03, 0xffffff, sx * d.head * 0.24, d.head * 0.17, d.head * 0.48, head, true, false); });
    }
    root.userData.parts = P; root.userData.d = d;
    root.userData.baseScale = { monster: 1.1, alpha: 1.15, bearking: 1.25, treant: 1.2, troll: 1.1 }[type] || 1;
    root.scale.setScalar(root.userData.baseScale);
    return root;
  }
  function animEnemy(root, mode, t, speed) {
    const P = root.userData.parts;
    if (mode === 'walk') {
      const f = t * speed * 3.2, a = Math.sin(f) * 0.6;
      P.legs[0].rotation.x = a; P.legs[3].rotation.x = a; P.legs[1].rotation.x = -a; P.legs[2].rotation.x = -a;
      P.body.rotation.z = Math.sin(f) * 0.03; P.head.rotation.x = Math.sin(f * 2) * 0.05;
      P.tail.rotation.y = Math.sin(f) * 0.3;
    } else if (mode === 'attack') {
      const a = Math.max(0, Math.sin(t * 9));
      P.head.rotation.x = -a * 0.5 + 0.2; P.body.rotation.x = -a * 0.12;
      P.legs.forEach(l => l.rotation.x *= 0.8);
    } else {
      P.legs.forEach(l => l.rotation.x = 0); P.head.rotation.x = Math.sin(t) * 0.05; P.tail.rotation.y = Math.sin(t * 2) * 0.2;
    }
  }

  // ===================== ПОСТРОЙКИ =====================
  const WOOD = 0xa8743e, WOOD_D = 0x6e4622, WOOD_L = 0xc89a5e;
  const brickMats = {};
  function brickMat(lvl) {
    if (!brickMats[lvl]) {
      const conf = { 3: ['#9a9a94', '#5a5a56'], 4: ['#b2aca0', '#6a645a'], 5: ['#5a5e68', '#2a2c32'] }[lvl];
      brickMats[lvl] = texMat(T.brick(conf[0], 'brick' + lvl, conf[1]));
      brickMats[lvl].map.repeat.set(2, 1);
    }
    return brickMats[lvl];
  }
  function palisade(p, len, h, r, color, tipColor) {
    const n = Math.round(len / (r * 2));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + r + i * (len / n);
      const hh = h * (0.92 + ((i * 37) % 7) / 60);
      cyl(r, r * 1.05, hh, i % 2 ? color : WOOD_D, x, hh / 2, 0, p, 6);
      cone(r, r * 2.2, tipColor || color, x, hh + r * 1.1, 0, p, 6);
    }
  }
  function makeWall(lvl) {
    const g = new THREE.Group(); const H = WALL_LEVELS[lvl - 1].h;
    if (lvl === 1) {
      palisade(g, 4, H - 0.3, 0.24, WOOD, WOOD_L);
      box(4, 0.14, 0.12, WOOD_D, 0, 0.7, 0.24, g); box(4, 0.14, 0.12, WOOD_D, 0, 1.5, 0.24, g);
      box(4, 0.1, 0.6, WOOD_L, 0, H - 0.6, -0.2, g); // настил для птиц
    } else if (lvl === 2) {
      palisade(g, 4, H - 0.3, 0.27, 0x9a6634, WOOD_L);
      [0.5, 1.2, 1.9].forEach(y => { box(4.05, 0.16, 0.14, WOOD_D, 0, y, 0.27, g); box(4.05, 0.06, 0.16, 0x4a4a50, 0, y, 0.29, g, false); });
      box(4, 0.12, 0.8, WOOD_L, 0, H - 0.5, -0.3, g);
      [-1.8, 1.8].forEach(x => box(0.3, H, 0.3, WOOD_D, x, H / 2, -0.55, g));
    } else if (lvl === 6) {
      const plate = texMat(canvasTex('steelplate', 128, 128, (c, w, hh) => { c.fillStyle = '#5a5f6a'; c.fillRect(0, 0, w, hh); c.strokeStyle = '#2e3138'; c.lineWidth = 3; for (let i = 0; i <= 2; i++) { c.strokeRect(2, i * 64 + 2, w - 4, 60); } c.fillStyle = '#9aa0aa'; for (let y = 8; y < hh; y += 32) for (let x = 8; x < w; x += 28) { c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); } }), { metalness: 0.6, roughness: 0.4 });
      plate.map.repeat.set(2, 1.4);
      box(4, H, 1.4, plate, 0, H / 2, 0, g);
      box(4.1, 0.3, 1.55, 0x2e3138, 0, 0.15, 0, g);
      for (let i = 0; i < 5; i++) box(0.55, 0.55, 0.5, plate, -1.6 + i * 0.8, H + 0.27, 0.45, g);
      for (let i = 0; i < 6; i++) { const sp = cone(0.08, 0.55, mat(0xc8ccd6, { metalness: 0.8, roughness: 0.25 }), -1.75 + i * 0.7, H * 0.45, 0.95, g, 5); sp.rotation.x = Math.PI / 2; }
      box(4.12, 0.14, 1.5, mat(0xd8b040, { metalness: 0.7, roughness: 0.35 }), 0, H * 0.78, 0, g, false);
      // два прожектора, светят наружу
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      g.userData.beams = [];
      [-1.25, 1.25].forEach((x, i) => {
        const sp = group(g, x, H + 0.15, -0.1);
        box(0.3, 0.35, 0.3, 0x2a2c32, 0, 0.17, 0, sp);
        const head = group(sp, 0, 0.45, 0);
        const housing = cyl(0.26, 0.2, 0.45, 0x3a3e48, 0, 0, 0, head, 10); housing.rotation.x = Math.PI / 2;
        const lens = cyl(0.23, 0.23, 0.03, mat(0xffffff, { emissive: 0xfff4c0, emissiveIntensity: 2.8 }), 0, 0, 0.24, head, 10, false); lens.rotation.x = Math.PI / 2;
        const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14, 16, 1, true), beamMat); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0, 7.2); head.add(beam);
        head.rotation.x = 0.28; head.userData.phase = i * 1.7;
        g.userData.beams.push(head);
      });
      g.userData.beamMat = beamMat;
      g.userData.lightPos = new THREE.Vector3(0, H + 0.8, 1.6); g.userData.lightPower = 1.5;
    } else {
      const th = lvl === 3 ? 1.0 : (lvl === 4 ? 1.1 : 1.3);
      box(4, H, th, brickMat(lvl), 0, H / 2, 0, g);
      box(4.08, 0.25, th + 0.12, lvl === 5 ? 0x3a3c44 : 0x7a7a74, 0, 0.12, 0, g);
      if (lvl >= 4) {
        for (let i = 0; i < 4; i++) box(0.62, 0.5, th * 0.4, brickMat(lvl), -1.5 + i, H + 0.25, th * 0.3, g);
      } else box(4, 0.15, th + 0.1, 0x8a8a84, 0, H + 0.07, 0, g);
      if (lvl === 5) {
        for (let i = 0; i < 5; i++) { const s = cone(0.08, 0.5, mat(0x9a9aa4, { metalness: 0.7, roughness: 0.3 }), -1.6 + i * 0.8, H * 0.5, th / 2 + 0.2, g, 5); s.rotation.x = Math.PI / 2; }
        box(4.06, 0.12, th + 0.06, mat(0xd8b040, { metalness: 0.7, roughness: 0.35 }), 0, H * 0.75, 0, g, false);
        const fl = box(0.5, 0.7, 0.03, 0x2a5ad0, 0, H * 0.5, th / 2 + 0.03, g, false); void fl;
      }
    }
    return g;
  }
  function makeGate(lvl) {
    const g = new THREE.Group();
    const steel = mat(0x5a5a62, { metalness: 0.5, roughness: 0.4 });
    if (lvl <= 2) {
      [-1.75, 1.75].forEach(x => { cyl(lvl === 2 ? 0.38 : 0.32, 0.36, 3.2, WOOD_D, x, 1.6, 0, g, 6); cone(0.36, 0.6, lvl === 2 ? 0x8a8a94 : WOOD_L, x, 3.5, 0, g, 6); });
      box(3.1, 2.3, 0.2, texMat(T.planks()), 0, 1.2, 0, g);
      (lvl === 2 ? [0.35, 0.95, 1.55, 2.1] : [0.6, 1.8]).forEach(y => box(3.15, 0.14, 0.24, 0x4a4a50, 0, y, 0, g, false));
      box(4, 0.3, 0.4, WOOD_D, 0, 2.7, 0, g);
      if (lvl === 2) {
        for (let i = 0; i < 7; i++) cone(0.08, 0.35, 0x9a9aa4, -1.5 + i * 0.5, 3.0, 0, g, 4, false);
        [-0.7, 0.7].forEach(x => { const r = torus(0.14, 0.03, 0x2a2a2e, x, 1.3, 0.14, g, 8); void r; });
      }
    } else {
      const bm = brickMat(lvl === 5 ? 5 : 4);
      const H = lvl === 3 ? 3.8 : 4.3;
      [-1.6, 1.6].forEach(x => { box(1, H, 1.4, bm, x, H / 2, 0, g); for (let i = 0; i < 2; i++) box(0.35, 0.4, 1.4, bm, x - 0.25 + i * 0.5, H + 0.2, 0, g); });
      box(2.4, 0.7, 1.2, bm, 0, H - 0.6, 0, g);
      if (lvl === 3) { box(2.2, 2.8, 0.18, steel, 0, 1.4, 0, g); for (let i = 0; i < 6; i++) box(0.06, 2.8, 0.24, 0x2a2a30, -1 + i * 0.4, 1.4, 0, g, false); }
      else if (lvl === 4) {
        box(2.2, 3.2, 0.22, texMat(T.planks()), 0, 1.6, 0, g);
        const gold = mat(0xd8b040, { metalness: 0.7, roughness: 0.35 });
        [0.5, 1.6, 2.7].forEach(y => box(2.25, 0.16, 0.28, gold, 0, y, 0, g, false));
        [-1.6, 1.6].forEach(x => box(0.6, 1.2, 0.04, 0xc03028, x, H - 1.3, 0.72, g, false));
      } else {
        for (let i = 0; i < 7; i++) box(0.1, 3.3, 0.14, mat(0x9aa0aa, { metalness: 0.8, roughness: 0.3 }), -1.05 + i * 0.35, 1.65, 0, g);
        for (let i = 0; i < 4; i++) box(2.2, 0.1, 0.14, mat(0x9aa0aa, { metalness: 0.8, roughness: 0.3 }), 0, 0.4 + i * 0.85, 0, g, false);
        for (let i = 0; i < 7; i++) cone(0.06, 0.3, 0x9aa0aa, -1.05 + i * 0.35, 0.0, 0, g, 4, false).rotation.x = Math.PI;
        [-1.6, 1.6].forEach(x => { cone(0.5, 0.9, 0x2a2c34, x, H + 0.85, 0, g, 4); });
      }
    }
    return g;
  }
  function woodTower(g, h, w) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(0.13, 0.16, h, WOOD_D, sx * w / 2, h / 2, sz * w / 2, g, 6));
    [h * 0.33, h * 0.66].forEach(y => { box(w, 0.1, 0.1, WOOD, 0, y, w / 2, g); box(w, 0.1, 0.1, WOOD, 0, y, -w / 2, g); box(0.1, 0.1, w, WOOD, w / 2, y, 0, g); box(0.1, 0.1, w, WOOD, -w / 2, y, 0, g); });
    const x1 = box(0.08, h * 0.75, 0.08, WOOD, 0, h * 0.4, w / 2, g); x1.rotation.z = 0.6;
    const x2 = box(0.08, h * 0.75, 0.08, WOOD, 0, h * 0.4, -w / 2, g); x2.rotation.z = -0.6;
    box(w + 0.5, 0.2, w + 0.5, texMat(T.planks()), 0, h, 0, g);
  }
  // Пушка: возвращает группу; userData.turret (вращается), muzzle, seat
  function makeCannon(lvl, onWall) {
    const g = new THREE.Group(); let baseH = 0;
    if (!onWall) { woodTower(g, 2.4, 1.8); baseH = 2.5; }
    const turret = group(g, 0, baseH, 0);
    const metal = lvl >= 3 ? mat(lvl >= 5 ? 0xd8b040 : 0xb07a3a, { metalness: 0.7, roughness: 0.35 }) : mat(0x2a2e3a, { metalness: 0.4, roughness: 0.5 });
    cyl(0.75, 0.85, 0.25, lvl >= 4 ? 0x4a4e58 : WOOD_D, 0, 0.12, 0, turret, 10);
    box(0.8, 0.45, 1.1, lvl >= 4 ? 0x5a5e68 : WOOD, 0, 0.45, 0, turret);
    [-1, 1].forEach(sx => { const w = cyl(0.28, 0.28, 0.1, WOOD_D, sx * 0.45, 0.35, 0.15, turret, 10); w.rotation.z = Math.PI / 2; });
    const barrel = group(turret, 0, 0.75, 0.1);
    if (lvl <= 2) {
      const b = cyl(0.2, 0.26, 1.4, metal, 0, 0, 0.5, barrel, 10); b.rotation.x = Math.PI / 2;
      torus(0.22, 0.05, lvl === 2 ? 0x8a8a94 : 0x1a1a20, 0, 0, 1.15, barrel);
      if (lvl === 2) { torus(0.25, 0.05, 0x8a8a94, 0, 0, 0.2, barrel); torus(0.24, 0.04, 0x8a8a94, 0, 0, 0.65, barrel); }
    } else if (lvl === 3) {
      [-0.2, 0.2].forEach(x => { const b = cyl(0.15, 0.2, 1.4, metal, x, 0, 0.5, barrel, 10); b.rotation.x = Math.PI / 2; torus(0.16, 0.04, 0x5a3a1a, x, 0, 1.15, barrel); });
    } else if (lvl >= 6) { // птичья ракетница: красный короб на 4 трубы с золотой каймой
      const red = mat(0xc8242a, { roughness: 0.45 }), gold = mat(0xd8b040, { metalness: 0.6, roughness: 0.35 });
      box(1.0, 0.8, 1.2, red, 0, 0.1, 0.25, barrel);
      box(1.04, 0.08, 1.24, gold, 0, 0.52, 0.25, barrel, false); box(1.04, 0.08, 1.24, gold, 0, -0.32, 0.25, barrel, false);
      [[-0.25, 0.28], [0.25, 0.28], [-0.25, -0.08], [0.25, -0.08]].forEach(([x, y]) => {
        const t = cyl(0.15, 0.15, 0.3, 0x2a2a30, x, y, 0.82, barrel, 10); t.rotation.x = Math.PI / 2;
        const r = cone(0.11, 0.22, mat(0xf0f0f0, { emissive: 0xff3020, emissiveIntensity: 0.5 }), x, y, 0.98, barrel, 8, false); r.rotation.x = Math.PI / 2;
      });
      box(0.12, 0.3, 0.12, 0x2a2a30, 0.42, 0.7, -0.1, barrel); sph(0.1, 0.1, 0.1, mat(0xff3020, { emissive: 0xff2010, emissiveIntensity: 1.5 }), 0.42, 0.9, -0.1, barrel, true, false); // прицел
    } else {
      const n = 6, R = lvl === 5 ? 0.22 : 0.18;
      const spin = group(barrel, 0, 0, 0); g.userData.spin = spin;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = cyl(0.06, 0.06, 1.5, metal, Math.cos(a) * R, Math.sin(a) * R, 0.6, spin, 6); b.rotation.x = Math.PI / 2; }
      [0.1, 1.2].forEach(z => { const d = cyl(R + 0.1, R + 0.1, 0.12, 0x3a3a40, 0, 0, z, spin, 10); d.rotation.x = Math.PI / 2; });
      box(0.6, 0.5, 0.5, 0x3a3e48, 0, 0.1, -0.35, barrel);
    }
    g.userData.turret = turret; g.userData.barrel = barrel;
    g.userData.muzzle = new THREE.Vector3(0, 0.75, 1.3);
    g.userData.seat = new THREE.Vector3(0, 0.25 + baseH, -0.95);
    g.userData.baseH = baseH;
    // ящик ядер
    if (!onWall) for (let i = 0; i < 4; i++) sph(0.22, 0.22, 0.22, 0x1a1a1a, -0.6 + (i % 2) * 0.3, baseH + 0.2, 0.7 + Math.floor(i / 2) * 0.25, g, true, false);
    return g;
  }
  function makeBuilding(type, lvl = 1) {
    let g;
    switch (type) {
      case 'wall': g = makeWall(lvl); break;
      case 'fence': {
        g = new THREE.Group();
        for (let i = 0; i < 5; i++) { cyl(0.08, 0.08, 1.3, 0xd8742a, -2 + i, 0.65, 0, g, 6); cone(0.09, 0.2, 0xe8c070, -2 + i, 1.4, 0, g, 6); }
        [0.45, 0.95].forEach(y => box(4, 0.1, 0.07, 0xe0823a, 0, y, 0, g));
        break;
      }
      case 'gate': g = makeGate(lvl); break;
      case 'stonegate': g = makeGate(3); break;
      case 'tower': {
        g = new THREE.Group(); woodTower(g, 3.6, 2.0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.1, 0.8, 0.1, WOOD_D, sx * 1.1, 4.1, sz * 1.1, g));
        const roof = cone(1.9, 1.3, 0xb04030, 0, 5.2, 0, g, 4); roof.rotation.y = Math.PI / 4;
        const cb = group(g, 0, 3.9, 0); g.userData.turret = cb;
        box(0.25, 0.25, 1.1, WOOD_D, 0, 0, 0.1, cb); const bow = box(1.4, 0.08, 0.1, 0xd8742a, 0, 0.05, 0.55, cb); void bow;
        box(0.05, 0.05, 0.9, 0x6a6aff, 0, 0.17, 0.3, cb, false);
        g.userData.muzzle = new THREE.Vector3(0, 3.9, 0.7);
        break;
      }
      case 'stonetower': {
        g = new THREE.Group();
        const m = brickMat(4);
        cyl(1.4, 1.6, 5, m, 0, 2.5, 0, g, 10);
        cyl(1.65, 1.65, 0.3, 0x7a7a74, 0, 5.1, 0, g, 10);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(0.5, 0.6, 0.4, m, Math.cos(a) * 1.45, 5.55, Math.sin(a) * 1.45, g).rotation.y = -a; }
        box(0.7, 1.2, 0.1, 0x3a2a1a, 0, 0.6, 1.55, g);
        const cb = group(g, 0, 5.4, 0); g.userData.turret = cb;
        box(0.3, 0.3, 1.3, WOOD_D, 0, 0, 0.1, cb); box(1.8, 0.1, 0.12, 0x8a8a94, 0, 0.05, 0.65, cb);
        g.userData.muzzle = new THREE.Vector3(0, 5.4, 0.8);
        break;
      }
      case 'ballista': {
        g = new THREE.Group(); woodTower(g, 1.6, 1.8);
        const cb = group(g, 0, 1.9, 0); g.userData.turret = cb;
        const steel = mat(0x9a9aa4, { metalness: 0.6, roughness: 0.4 });
        cyl(0.45, 0.55, 0.3, 0x4a4e58, 0, 0, 0, cb, 8);
        if (lvl <= 1) {
          box(0.35, 0.3, 2.0, 0x6e4622, 0, 0.3, 0.2, cb);
          box(2.6, 0.12, 0.16, steel, 0, 0.35, 0.9, cb);
          box(0.08, 0.08, 1.6, 0xd8b040, 0, 0.5, 0.4, cb, false);
          const gr = cyl(0.3, 0.3, 0.1, 0xb0b0b8, 0.3, 0.3, -0.5, cb, 8); gr.rotation.z = Math.PI / 2;
          g.userData.muzzleL = new THREE.Vector3(0, 0.5, 1.2);
        } else if (lvl === 2) {
          box(0.7, 0.55, 1.0, 0x3a3e48, 0, 0.45, -0.1, cb);
          [-0.14, 0.14].forEach(x => { const b = cyl(0.07, 0.08, 1.5, steel, x, 0.5, 0.9, cb, 8); b.rotation.x = Math.PI / 2; const m = cyl(0.1, 0.1, 0.2, 0x2a2a2e, x, 0.5, 1.6, cb, 8); m.rotation.x = Math.PI / 2; });
          box(0.45, 0.4, 0.5, 0x5a6a3a, 0.6, 0.35, -0.1, cb); // ящик с патронами
          for (let i = 0; i < 6; i++) box(0.05, 0.12, 0.05, 0xd8b040, 0.38 - i * 0.05, 0.45, 0.1 + i * 0.05, cb, false);
          box(0.9, 0.5, 0.06, steel, 0, 0.75, 0.3, cb); // щиток
          g.userData.muzzleL = new THREE.Vector3(0, 0.5, 1.7);
        } else {
          const green = mat(0x3e8a3a, { roughness: 0.6 });
          box(1.3, 0.9, 1.5, green, 0, 0.75, 0.1, cb);
          box(1.35, 0.1, 1.55, 0x2a5a28, 0, 1.22, 0.1, cb, false);
          for (let i = 0; i < 6; i++) {
            const x = -0.4 + (i % 3) * 0.4, y = 0.55 + Math.floor(i / 3) * 0.42;
            const t = cyl(0.15, 0.15, 0.1, 0x1a1a1a, x, y, 0.86, cb, 10, false); t.rotation.x = Math.PI / 2;
            const r = cone(0.11, 0.25, 0xe8e030, x, y, 0.95, cb, 8, false); r.rotation.x = Math.PI / 2;
          }
          box(0.15, 0.6, 0.15, 0x2a2a2e, 0.75, 0.4, -0.4, cb);
          g.userData.muzzleL = new THREE.Vector3(0, 0.8, 1.0);
        }
        g.userData.muzzle = new THREE.Vector3(0, 2.2, 1.2);
        break;
      }
      case 'mineshaft': {
        g = new THREE.Group();
        const mound = sph(3.4, 2.2, 3.4, 0x7a7670, 0, 0.3, -0.2, g); void mound;
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; sph(1, 0.8, 1, 0x8a8680, Math.cos(a) * 1.4, 0.5, Math.sin(a) * 1.4 - 0.2, g, true); }
        box(1.6, 1.8, 0.6, 0x080808, 0, 0.9, 1.3, g);
        [-1, 1].forEach(sx => box(0.25, 2.1, 0.25, WOOD_D, sx * 0.95, 1.05, 1.55, g));
        box(2.3, 0.3, 0.3, WOOD_D, 0, 2.15, 1.55, g);
        [-0.35, 0.35].forEach(x => box(0.06, 0.05, 1.8, 0x5a5a62, x, 0.04, 2.1, g, false));
        const cart = group(g, 0, 0, 2.4); box(0.8, 0.5, 0.9, 0x5a5a62, 0, 0.4, 0, cart);
        for (let i = 0; i < 3; i++) sph(0.28, 0.22, 0.28, [0x8a8a86, 0x151515, 0xc87a40][i], -0.2 + i * 0.2, 0.7, 0, cart, true);
        box(0.25, 0.3, 0.25, mat(0xffc040, { emissive: 0xffa020, emissiveIntensity: 1.5 }), 0.95, 1.7, 1.75, g, false);
        if (lvl >= 2) { [-1, 1].forEach(sx => { const p = box(0.18, 3.2, 0.18, WOOD_D, sx * 0.9, 2.6, -0.4, g); p.rotation.z = -sx * 0.2; }); const wh = torus(0.55, 0.06, 0x5a5a62, 0, 4.1, -0.4, g, 14); g.userData.spin = wh; }
        if (lvl >= 3) { box(0.9, 1.1, 0.9, 0x3a3e48, -1.6, 0.55, 0.9, g); cyl(0.12, 0.15, 1.6, 0x5a5a5a, -1.6, 1.8, 0.9, g, 6); const gr = cyl(0.35, 0.35, 0.12, 0xb0b0b8, -1.6, 0.8, 1.38, g, 10); gr.rotation.x = Math.PI / 2; g.userData.gear = gr; }
        break;
      }
      case 'cannon': g = makeCannon(lvl, false); break;
      case 'spikes': {
        g = new THREE.Group(); box(2, 0.12, 2, WOOD_D, 0, 0.06, 0, g);
        for (let i = 0; i < 9; i++) cone(0.12, 0.6, 0x9a9aa4, -0.65 + (i % 3) * 0.65, 0.4, -0.65 + Math.floor(i / 3) * 0.65, g, 5);
        break;
      }
      case 'birdhouse': {
        g = new THREE.Group(); cyl(0.08, 0.1, 1.6, WOOD_D, 0, 0.8, 0, g, 6);
        box(0.9, 0.9, 0.9, 0xe0b070, 0, 2.05, 0, g);
        const r = cone(0.85, 0.6, 0xc04a30, 0, 2.8, 0, g, 4); r.rotation.y = Math.PI / 4;
        cyl(0.16, 0.16, 0.05, 0x1a1008, 0, 2.15, 0.46, g, 10, false).rotation.x = Math.PI / 2;
        box(0.3, 0.05, 0.2, WOOD_D, 0, 1.9, 0.55, g, false);
        g.userData.perch = [new THREE.Vector3(0, 3.05, 0)];
        break;
      }
      case 'aviary': {
        g = new THREE.Group(); box(3.2, 0.2, 3.2, WOOD_D, 0, 0.1, 0, g);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(0.1, 0.1, 2.6, WOOD_D, sx * 1.5, 1.3, sz * 1.5, g, 6));
        const net = mat(0xc0c0c0, { transparent: true, opacity: 0.25 });
        box(3, 2.4, 3, net, 0, 1.3, 0, g, false);
        const r = cone(2.4, 1.2, 0x3a7ac0, 0, 3.2, 0, g, 4); r.rotation.y = Math.PI / 4;
        box(1.2, 1, 1, 0xe0b070, 0.8, 0.7, -0.8, g); cyl(0.05, 0.05, 2.8, WOOD, -0.6, 1.2, 0.3, g, 4).rotation.z = Math.PI / 2;
        g.userData.perch = [new THREE.Vector3(0, 3.8, 0), new THREE.Vector3(-0.6, 1.25, 0.3)];
        break;
      }
      case 'lantern': {
        g = new THREE.Group();
        cyl(0.07, 0.1, 2.4, 0x3a2a1c, 0, 1.2, 0, g, 6); box(0.36, 0.08, 0.36, 0x2a2a2e, 0, 0.04, 0, g);
        box(0.5, 0.06, 0.06, 0x2a2a2e, 0.18, 2.35, 0, g, false);
        const lamp = group(g, 0.4, 2.0, 0);
        box(0.3, 0.38, 0.3, mat(0xffd27a, { emissive: 0xffa030, emissiveIntensity: 1.6 }), 0, 0, 0, lamp, false);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(0.04, 0.42, 0.04, 0x2a2a2e, sx * 0.15, 0, sz * 0.15, lamp, false));
        cone(0.26, 0.2, 0x2a2a2e, 0, 0.29, 0, lamp, 4, false).rotation.y = Math.PI / 4;
        cyl(0.02, 0.02, 0.2, 0x2a2a2e, 0, 0.32, 0, lamp, 4, false);
        g.userData.lightPos = new THREE.Vector3(0.4, 2.0, 0); g.userData.lightPower = 1;
        g.userData.perch = [new THREE.Vector3(0, 2.45, 0)];
        break;
      }
      case 'torch': {
        g = new THREE.Group();
        cyl(0.45, 0.55, 0.5, 0x7a7a74, 0, 0.25, 0, g, 8);
        cyl(0.15, 0.2, 1.8, 0x3a3a40, 0, 1.4, 0, g, 6);
        cyl(0.5, 0.25, 0.35, mat(0x4a4a50, { metalness: 0.5, roughness: 0.5 }), 0, 2.45, 0, g, 8);
        for (let i = 0; i < 5; i++) sph(0.22, 0.18, 0.22, 0x1a1a1a, Math.cos(i * 1.26) * 0.2, 2.62, Math.sin(i * 1.26) * 0.2, g, true, false);
        const fire = group(g, 0, 2.7, 0); g.userData.fire = fire;
        cone(0.32, 0.8, mat(0xff7a20, { emissive: 0xff5010, emissiveIntensity: 2 }), 0, 0.35, 0, fire, 6, false);
        cone(0.18, 0.6, mat(0xffe070, { emissive: 0xffc040, emissiveIntensity: 2.2 }), 0.05, 0.3, 0.04, fire, 5, false);
        g.userData.lightPos = new THREE.Vector3(0, 3.1, 0); g.userData.lightPower = 1.7;
        break;
      }
      case 'market': {
        g = new THREE.Group(); box(3.4, 0.9, 1.4, texMat(T.planks()), 0, 0.45, 0.4, g);
        [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]].forEach(([x, z]) => cyl(0.08, 0.08, 2.6, WOOD_D, x, 1.3, z, g, 6));
        for (let i = 0; i < 6; i++) { const s = box(0.6, 0.08, 2.6, i % 2 ? 0xffffff : 0xd83030, -1.5 + i * 0.6, 2.7, 0, g); s.rotation.x = 0.15; }
        for (let i = 0; i < 3; i++) { const c = cyl(0.3, 0.3, 0.6, mat(0xd8b040, { metalness: 0.5, roughness: 0.4, wireframe: true }), -1 + i, 1.2, 0.4, g, 8, false); void c; }
        g.userData.perch = [new THREE.Vector3(0, 2.85, 0)];
        break;
      }
      case 'storage': {
        g = new THREE.Group(); box(3.2, 2, 2.4, texMat(T.planks()), 0, 1, 0, g);
        const r1 = box(3.4, 0.12, 1.5, 0x8a3a24, 0, 2.35, -0.6, g); r1.rotation.x = 0.5;
        const r2 = box(3.4, 0.12, 1.5, 0x8a3a24, 0, 2.35, 0.6, g); r2.rotation.x = -0.5;
        box(1, 1.4, 0.05, WOOD_D, 0, 0.7, 1.22, g);
        for (let i = 0; i < 4; i++) { const l = cyl(0.17, 0.17, 1.4, WOOD, 1.95, 0.2 + Math.floor(i / 2) * 0.32, -0.3 + (i % 2) * 0.36, g, 7); l.rotation.x = Math.PI / 2; }
        box(0.5, 0.5, 0.5, WOOD_L, -1.9, 0.25, 0.6, g);
        g.userData.perch = [new THREE.Vector3(0, 2.75, 0)];
        break;
      }
      case 'workshop': {
        g = new THREE.Group(); box(3.4, 0.2, 2.8, 0x7a7a74, 0, 0.1, 0, g);
        box(3.2, 1.9, 0.2, texMat(T.planks()), 0, 1.15, -1.2, g); box(0.2, 1.9, 2.4, texMat(T.planks()), -1.5, 1.15, 0, g);
        [[1.5, 1.2], [-1.5, 1.2], [1.5, -1.2]].forEach(([x, z]) => cyl(0.1, 0.1, 2.6, WOOD_D, x, 1.3, z, g, 6));
        const r = box(3.8, 0.15, 3.3, 0x5a6a7a, 0, 2.7, 0, g); r.rotation.x = 0.12;
        box(0.6, 0.35, 0.4, 0x3a3a40, 0.5, 0.75, 0.3, g); box(0.4, 0.6, 0.3, 0x2a2a2e, 0.5, 0.35, 0.3, g); // наковальня
        box(1.2, 0.8, 0.6, WOOD, -0.7, 0.6, -0.6, g); box(0.8, 0.6, 0.6, 0x8a3a24, 1.0, 0.5, -0.7, g); // горн
        cyl(0.12, 0.15, 1.2, 0x5a5a5a, 1.0, 1.3, -0.8, g, 6);
        g.userData.perch = [new THREE.Vector3(0, 2.95, 0)];
        break;
      }
      case 'farm': {
        g = new THREE.Group(); box(3.8, 0.2, 3.8, 0x6a4a2a, 0, 0.1, 0, g);
        for (let r = 0; r < 4; r++) { box(3.4, 0.15, 0.4, 0x5a3a1a, 0, 0.25, -1.35 + r * 0.9, g, false); for (let c = 0; c < 6; c++) { const crop = cone(0.18, 0.5, r % 2 ? 0x6abf3a : 0xd8c040, -1.5 + c * 0.6, 0.55, -1.35 + r * 0.9, g, 5, false); void crop; } }
        [[-1.9, 0], [1.9, 0]].forEach(([x]) => box(0.08, 0.6, 3.8, 0xe0823a, x, 0.3, 0, g));
        const sc = group(g, 1.5, 0, 1.5); cyl(0.05, 0.05, 1.6, WOOD_D, 0, 0.8, 0, sc, 4); box(0.9, 0.06, 0.06, WOOD_D, 0, 1.2, 0, sc); sph(0.25, 0.3, 0.25, 0xe8c070, 0, 1.6, 0, sc);
        break;
      }
      case 'minelift': {
        g = new THREE.Group(); box(2.8, 0.2, 2.8, 0x5a4a3a, 0, 0.1, 0, g); box(1.6, 0.1, 1.6, 0x101010, 0, 0.21, 0, g, false);
        [-1, 1].forEach(sx => { const a = box(0.18, 4, 0.18, WOOD_D, sx * 1.1, 2, 0.6, g); a.rotation.z = -sx * 0.22; const b = box(0.18, 4, 0.18, WOOD_D, sx * 1.1, 2, -0.6, g); b.rotation.z = -sx * 0.22; });
        box(1.8, 0.2, 1.4, WOOD, 0, 3.9, 0, g);
        const wh = torus(0.7, 0.07, 0x5a5a62, 0, 4.4, 0, g, 16); g.userData.spin = wh;
        cyl(0.03, 0.03, 4.2, 0x2a2a2a, 0, 2.2, 0, g, 4, false);
        box(0.8, 0.5, 0.6, 0x5a5a62, 1.6, 0.5, 0, g); for (let i = 0; i < 3; i++) sph(0.25, 0.2, 0.25, 0x606060, 1.5 + i * 0.12, 0.85, 0, g, true);
        if (lvl >= 2) { // железные распорки и вагонетка с рудой
          [-1, 1].forEach(sx => box(0.1, 0.1, 1.4, 0x8a8f98, sx * 0.9, 2.6, 0, g));
          box(0.9, 0.5, 0.7, 0x6a6e76, -1.6, 0.45, 0, g); for (let i = 0; i < 3; i++) sph(0.22, 0.18, 0.22, 0xc87a40, -1.7 + i * 0.12, 0.8, 0, g, true);
          box(1.9, 0.12, 1.5, 0x8a8f98, 0, 4.05, 0, g);
        }
        if (lvl >= 3) { // рубины на крыше и в вагонетке
          const rm = mat(0xe8204a, { emissive: 0xb00024, emissiveIntensity: 0.9, roughness: 0.25 });
          [[-0.7, 0.55], [0.7, -0.55], [0, 0]].forEach(([x, z], i) => { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), rm); c.scale.set(0.8, 1.6, 0.8); c.position.set(x, 4.45 + (i === 2 ? 0.95 : 0), z); g.add(c); });
          for (let i = 0; i < 3; i++) sph(0.18, 0.16, 0.18, rm, 1.5 + i * 0.12, 1.0, 0.1, g, true);
        }
        break;
      }
      case 'core': {
        g = new THREE.Group();
        cyl(2.3, 2.8, 2.0, 0x6a4424, 0, 1.0, 0, g, 12);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = box(0.6, 0.5, 1.8, 0x5a3a1c, Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6, g); r.rotation.y = -a + Math.PI / 2; }
        cyl(2.05, 2.05, 0.05, 0xc8a070, 0, 2.02, 0, g, 12, false);
        const nest = torus(1.7, 0.55, 0x8a6236, 0, 2.3, 0, g, 16); nest.rotation.x = Math.PI / 2;
        const n2 = torus(1.6, 0.35, 0xa87a46, 0, 2.6, 0, g, 14); n2.rotation.x = Math.PI / 2; n2.rotation.z = 0.5;
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const tw = box(0.06, 0.06, 1.2, 0x6a4424, Math.cos(a) * 1.8, 2.5 + (i % 3) * 0.1, Math.sin(a) * 1.8, g, false); tw.rotation.y = a + 0.6; }
        const eggM = texMat(canvasTex('egg', 64, 64, (c, w, h) => { c.fillStyle = '#cfe6f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a6a7a'; const r = rnd(9); for (let i = 0; i < 60; i++) c.fillRect(r() * w, r() * h, 2, 2); }));
        [[-0.5, 0.2], [0.5, 0.3], [0, -0.5]].forEach(([x, z]) => sph(0.75, 0.95, 0.75, eggM, x, 2.6, z, g));
        cyl(0.06, 0.06, 4.5, WOOD_D, 1.9, 3.2, -1.2, g, 5);
        const flag = box(1.1, 0.7, 0.04, 0x2a7ad8, 2.45, 5.0, -1.2, g); g.userData.flag = flag;
        g.userData.perch = [new THREE.Vector3(1.6, 2.8, 0.5), new THREE.Vector3(-1.5, 2.8, -0.6), new THREE.Vector3(0.2, 2.8, 1.7)];
        break;
      }
      default: g = new THREE.Group(); box(2, 2, 2, 0xff00ff, 0, 1, 0, g);
    }
    return g;
  }

  // ===================== ПРИРОДА =====================
  // Слияние геометрий с цветами вершин (для инстансинга)
  function merge(parts) {
    const pos = [], nor = [], col = [];
    parts.forEach(([gm, color, matrix]) => {
      let g = gm.index ? gm.toNonIndexed() : gm.clone();
      if (matrix) g.applyMatrix4(matrix);
      g.computeVertexNormals();
      const c = new THREE.Color(color);
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      for (let i = 0; i < p.length / 3; i++) col.push(c.r, c.g, c.b);
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const mtx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  // pal: цвета листвы для биома (лето, осень, тайга, цветущий луг)
  function treeGeos(pal) {
    const P = pal || {};
    const pc = P.pine || [0x2f6e34, 0x3a8040, 0x46924a], oc = P.oak || [0x4f9a3a, 0x5aa844, 0x468a34, 0x62b04a], bc = P.birch || [0x8ac850, 0x9ad458];
    const pine = merge([
      [new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6), 0x6a4426, mtx(0, 0.8, 0)],
      [new THREE.ConeGeometry(1.7, 2.2, 7), pc[0], mtx(0, 2.4, 0)],
      [new THREE.ConeGeometry(1.35, 1.9, 7), pc[1], mtx(0, 3.5, 0, 1, 1, 1, 0.4)],
      [new THREE.ConeGeometry(0.95, 1.6, 7), pc[2], mtx(0, 4.5, 0, 1, 1, 1, 0.8)],
      ...(P.snowy ? [[new THREE.ConeGeometry(0.5, 0.7, 7), 0xf4f6fa, mtx(0, 5.0, 0, 1, 1, 1, 0.8)]] : []),
    ]);
    const oak = merge([
      [new THREE.CylinderGeometry(0.28, 0.4, 2.2, 7), 0x6e4a2a, mtx(0, 1.1, 0)],
      [new THREE.IcosahedronGeometry(1.5, 0), oc[0], mtx(0, 3.0, 0)],
      [new THREE.IcosahedronGeometry(1.1, 0), oc[1], mtx(0.9, 2.6, 0.4)],
      [new THREE.IcosahedronGeometry(1.1, 0), oc[2], mtx(-0.8, 2.7, -0.3)],
      [new THREE.IcosahedronGeometry(1.0, 0), oc[3], mtx(0.1, 3.8, -0.2)],
    ]);
    const birch = merge([
      [new THREE.CylinderGeometry(0.16, 0.22, 3.2, 6), 0xeeeee6, mtx(0, 1.6, 0)],
      [new THREE.BoxGeometry(0.34, 0.08, 0.34), 0x2a2a2a, mtx(0, 1.0, 0)],
      [new THREE.BoxGeometry(0.3, 0.06, 0.3), 0x2a2a2a, mtx(0, 2.1, 0)],
      [new THREE.IcosahedronGeometry(1.1, 0), bc[0], mtx(0, 3.5, 0, 1, 1.3, 1)],
      [new THREE.IcosahedronGeometry(0.8, 0), bc[1], mtx(0.5, 2.9, 0.2)],
    ]);
    return { pine, oak, birch };
  }
  function rockGeos() {
    const stone = merge([[new THREE.DodecahedronGeometry(1, 0), 0x9a9a96, mtx(0, 0.5, 0, 1.2, 0.85, 1)], [new THREE.DodecahedronGeometry(0.6, 0), 0x8a8a86, mtx(0.8, 0.3, 0.3)]]);
    const coal = merge([[new THREE.DodecahedronGeometry(1, 0), 0x6a6a66, mtx(0, 0.5, 0, 1.1, 0.8, 1)], [new THREE.OctahedronGeometry(0.35, 0), 0x151515, mtx(0.5, 0.8, 0.5)], [new THREE.OctahedronGeometry(0.3, 0), 0x101010, mtx(-0.6, 0.6, 0.2)], [new THREE.OctahedronGeometry(0.28, 0), 0x1a1a1a, mtx(0.1, 1.0, -0.5)]]);
    const iron = merge([[new THREE.DodecahedronGeometry(1, 0), 0x7a706a, mtx(0, 0.5, 0, 1.1, 0.85, 1)], [new THREE.OctahedronGeometry(0.32, 0), 0xc87a40, mtx(0.55, 0.8, 0.4)], [new THREE.OctahedronGeometry(0.28, 0), 0xd88a50, mtx(-0.6, 0.6, 0.3)], [new THREE.OctahedronGeometry(0.25, 0), 0xb06a34, mtx(0, 1.05, -0.45)]]);
    const ruby = merge([[new THREE.DodecahedronGeometry(1, 0), 0x5a5054, mtx(0, 0.5, 0, 1.1, 0.85, 1)], [new THREE.OctahedronGeometry(0.4, 0), 0xe0204a, mtx(0.45, 1.2, 0.35, 1, 1.7, 1)], [new THREE.OctahedronGeometry(0.32, 0), 0xff3a5e, mtx(-0.55, 1.0, 0.3, 1, 1.6, 1)], [new THREE.OctahedronGeometry(0.3, 0), 0xc01036, mtx(0.05, 1.35, -0.35, 1, 1.8, 1)]]);
    const berry = merge([[new THREE.IcosahedronGeometry(0.8, 0), 0x3a7a30, mtx(0, 0.6, 0, 1.2, 0.9, 1.2)], [new THREE.IcosahedronGeometry(0.55, 0), 0x46883a, mtx(0.5, 0.5, 0.3)],
      ...[[0.5, 0.9, 0.5], [-0.6, 0.7, 0.4], [0.2, 1.1, -0.4], [-0.3, 0.9, 0.7], [0.7, 0.6, -0.3], [0, 0.4, 0.95]].map(p => [new THREE.IcosahedronGeometry(0.11, 0), 0xd02040, mtx(p[0], p[1], p[2])])]);
    return { stone, coal, iron, ruby, berry };
  }

  return { setDetail, get detail() { return HI; }, makeHelicopter, setGear, setArmor, mat, texMat, T, box, sph, cyl, cone, torus, group, makeBird, animBird, makeHero, makeTool, animHero, makeEnemy, animEnemy, makeBuilding, makeCannon, merge, mtx, treeGeos, rockGeos, WALL_H: l => WALL_LEVELS[l - 1].h };
})();
