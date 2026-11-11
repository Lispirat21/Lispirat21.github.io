// Модели в "игрушечном" мульт-стиле: тун-шейдинг + чёрный контур, процедурная анимация
HL.Models = (function () {
  const T = THREE, U = HL.U;

  // 3-ступенчатая тун-градиента
  const grad = (() => {
    const d = new Uint8Array([80, 80, 80, 255, 165, 165, 165, 255, 255, 255, 255, 255]);
    const t = new T.DataTexture(d, 3, 1, T.RGBAFormat);
    t.minFilter = t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  })();

  const mats = {};
  function toon(color) {
    return mats[color] || (mats[color] = new T.MeshToonMaterial({ color, gradientMap: grad }));
  }
  function toonX(color, extra) { return new T.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, extra)); }

  // Контур методом "вывернутой оболочки"
  const outlineMat = new T.MeshBasicMaterial({ color: 0x0b0b0e, side: T.BackSide });
  outlineMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.024;');
  };
  function setOutlines(on) { outlineMat.visible = !!on; }

  const gc = {};
  const G = (k, fn) => gc[k] || (gc[k] = fn());
  const cap = (r, l) => G('c' + r + '_' + l, () => new T.CapsuleGeometry(r, l, 4, 12));
  const sph = (r) => G('s' + r, () => new T.SphereGeometry(r, 16, 12));
  const hemi = (r, k = 0.55) => G('h' + r + '_' + k, () => new T.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI * k));
  const box = (x, y, z) => G('b' + x + '_' + y + '_' + z, () => new T.BoxGeometry(x, y, z));
  const cyl = (a, b, h, s = 16) => G('y' + a + '_' + b + '_' + h + '_' + s, () => new T.CylinderGeometry(a, b, h, s));
  const star = (r) => G('st' + r, () => {
    const s = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.42 : r;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    return new T.ShapeGeometry(s);
  });

  function part(parent, geo, mat, x = 0, y = 0, z = 0, outline = true) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    if (outline) { const o = new T.Mesh(geo, outlineMat); o.castShadow = false; m.add(o); }
    return m;
  }

  // ---------- текстуры ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  let _camo = null;
  function camoTex() {
    return _camo || (_camo = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#8c9bb0'; x.fillRect(0, 0, w, h);
      const cols = ['#3b4a68', '#d4dbe6', '#5d6d8a', '#1f2840', '#a9b6c9'];
      const r = U.seeded(7);
      for (let i = 0; i < 70; i++) {
        x.fillStyle = cols[(r() * cols.length) | 0];
        x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 14, 4 + r() * 9, r() * 3, 0, Math.PI * 2); x.fill();
      }
    }));
  }
  let _glow = null;
  function glowTex() {
    return _glow || (_glow = canvasTex(64, 64, (x, w) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    }));
  }
  const ribbedCache = {};
  function ribbed(color) {
    if (ribbedCache[color]) return ribbedCache[color];
    const c = new T.Color(color);
    const hex = (k) => '#' + c.clone().multiplyScalar(k).getHexString();
    const tex = canvasTex(16, 64, (x, w, h) => {
      x.fillStyle = hex(1); x.fillRect(0, 0, w, h);
      x.fillStyle = hex(0.62); for (let y = 0; y < h; y += 8) x.fillRect(0, y, w, 3);
      x.fillStyle = hex(1.18 > 1 ? 1 : 1.18); for (let y = 4; y < h; y += 8) x.fillRect(0, y, w, 1);
    });
    tex.repeat.set(1, 3);
    return (ribbedCache[color] = toonX(0xffffff, { map: tex }));
  }
  function glowSprite(color, size) {
    const m = new T.SpriteMaterial({ map: glowTex(), color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    const s = new T.Sprite(m); s.scale.setScalar(size); return s;
  }

  // ---------- персонажи ----------
  const DEFS = {
    homelander: { name: 'Хоумлендер', ribbed: true, muscles: true, eagle: 0xe6b23c, cuffs: 0xe6b23c, skin: 0xf2c4a0, hair: 0xf2d35e, hairStyle: 'slick', torso: 0x1d2c68, stripe: 0xc9232c, collar: 0xc9232c,
      arms: 0x1d2c68, forearms: 0xc9232c, gloves: 0xc9232c, legs: 0x1d2c68, boots: 0xc9232c, kneeDots: 0xe6b23c, belt: 0xe6b23c,
      epaulettes: 0xe6b23c, cape: 0xb41c24, capeFlag: true, eye: 0x3a7be0, brows: 0x9a7a30, angry: true, bulk: 1.08 },
    butcher: { name: 'Бутчер', crowbar: true, skin: 0xd9a27a, hair: 0x17120e, hairStyle: 'short', beard: 0x16110d, torsoTex: 'camo', torso: 0xffffff,
      coat: 0x2e2f2a, arms: 0x2e2f2a, forearms: 0x2e2f2a, gloves: 0xd9a27a, legs: 0x26272a, boots: 0x161616, eye: 0x4a3420, brows: 0x111111, angry: true, bulk: 1.05 },
    butcherV: { name: 'Бутчер (Темп-V)', crowbar: true, skin: 0xcf9670, hair: 0x17120e, hairStyle: 'short', beard: 0x16110d, torsoTex: 'camo', torso: 0xffffff,
      coat: 0x2e2f2a, arms: 0x2e2f2a, forearms: 0x2e2f2a, gloves: 0xcf9670, legs: 0x26272a, boots: 0x161616, eye: 0xff3a1a, brows: 0x111111, angry: true, bulk: 1.15, scale: 1.12, tentacles: true },
    soldierboy: { name: 'Солдатик', muscles: true, cuffs: 0x3a2716, pads: 0x4a3018, skin: 0xe2b08a, hair: 0x3d2818, hairStyle: 'short', stubble: 0x3d2818, torso: 0x56603a, emblem: 0xe9e4d4, straps: 0x5e3d22,
      arms: 0x56603a, forearms: 0x5e3d22, gloves: 0x5e3d22, legs: 0x4c5534, boots: 0x3a2716, belt: 0x5e3d22, shield: true, eye: 0x5a7a9a, brows: 0x2a1a10, angry: true, bulk: 1.15, scale: 1.05 },
    starlight: { name: 'Старлайт', skin: 0xf3c9a9, hair: 0xf6df8e, hairStyle: 'long', torso: 0xeef2fb, emblem: 0x2f62e0, arms: 0xeef2fb, forearms: 0x2f62e0,
      gloves: 0xeef2fb, legs: 0xeef2fb, boots: 0x2f62e0, belt: 0xc8cedc, eye: 0x4a7a3a, brows: 0xb09a50, bulk: 0.86, scale: 0.94 },
    atrain: { name: 'Эй-Трейн', atrain: true, belt: 0xc8ccd6, collar: 0xf2f2f2, skin: 0x6e4630, hair: 0x111111, hairStyle: 'short', torso: 0x2050c4, stripe: 0xf2f2f2, arms: 0x2050c4, forearms: 0xf2f2f2,
      gloves: 0xf2f2f2, legs: 0x2050c4, boots: 0xf2f2f2, eye: 0x2a1a10, brows: 0x111111, bulk: 0.95 },
    hughie: { name: 'Хьюи', skin: 0xf1c6a3, hair: 0x6a4a2a, hairStyle: 'curly', torso: 0x8a7656, arms: 0x8a7656, forearms: 0x8a7656, gloves: 0xf1c6a3,
      legs: 0x3d4e6e, boots: 0x5a3622, eye: 0x4a6a8a, brows: 0x5a3a1a, bulk: 0.85, scale: 0.9 },
    ryan: { name: 'Райан', skin: 0xf2c8a8, hair: 0xe0c468, hairStyle: 'curly', torso: 0x5d6470, hood: 0x4d5460, arms: 0x5d6470, forearms: 0x5d6470, gloves: 0xf2c8a8,
      legs: 0x3a4e78, boots: 0xeeeeee, eye: 0x3a7be0, brows: 0x9a7a30, bulk: 0.86, scale: 0.93 },
    kimiko: { name: 'Кимико', skin: 0xeac6a2, hair: 0x101010, hairStyle: 'long', torso: 0x2a2a2e, arms: 0x2a2a2e, forearms: 0x2a2a2e, gloves: 0xeac6a2,
      legs: 0x1e1e22, boots: 0x111111, eye: 0x221a14, brows: 0x101010, angry: true, bulk: 0.8, scale: 0.88 },
    frenchie: { name: 'Френчи', skin: 0xe6b690, hair: 0x2a1a10, hairStyle: 'curly', stubble: 0x2a1a10, torso: 0x6a4a32, arms: 0x6a4a32, forearms: 0x6a4a32,
      gloves: 0xe6b690, legs: 0x333338, boots: 0x222222, eye: 0x3a2a1a, brows: 0x2a1a10, gun: true, bulk: 0.92 },
    mm: { name: 'М.М.', skin: 0x5a3a28, hair: 0x111111, hairStyle: 'short', beard: 0x161616, torso: 0x3c3c40, arms: 0x3c3c40, forearms: 0x3c3c40,
      gloves: 0x5a3a28, legs: 0x2a2a30, boots: 0x161616, eye: 0x221a14, brows: 0x111111, angry: true, gun: true, bulk: 1.2, scale: 1.05 },
    noir: { name: 'Чёрный Нуар', skin: 0x18181c, hair: 0x18181c, hairStyle: 'mask', torso: 0x1b1b20, arms: 0x1b1b20, forearms: 0x1b1b20, gloves: 0x1b1b20,
      legs: 0x1b1b20, boots: 0x101012, belt: 0x2a2a30, eye: 0x18181c, noFace: true, bulk: 1.1 },
    agent: { name: 'Наёмник', skin: 0xd8a882, hair: 0x2a2a2a, hairStyle: 'cap', capColor: 0x2b3038, torso: 0x2b3038, vest: 0x40452e, arms: 0x2b3038, forearms: 0x2b3038,
      gloves: 0x1a1a1a, legs: 0x30343c, boots: 0x161616, eye: 0x2a2a2a, brows: 0x1a1a1a, angry: true, gun: true, bulk: 1 },
    maeve: { name: 'Королева Мейв', skin: 0xf0c8a8, hair: 0x7a3a22, hairStyle: 'long', hairVolume: true, torso: 0x262c3a, arms: 0x262c3a, forearms: 0xa8aeb8, gloves: 0x262c3a, cuffs: 0xc8a050,
      legs: 0x262c3a, boots: 0x7c8290, bootRim: 0xc8a050, belt: 0xc8a050, tiara: 0xd8b860, maeveArmor: true, lips: 0xa0303c, eye: 0x4a6a3a, brows: 0x5a2a1a, angry: true, bulk: 0.92, scale: 0.97 },
    thug: { name: 'Грабитель', skin: 0x3a3a3e, hair: 0x3a3a3e, hairStyle: 'mask', torso: 0x4a4a52, arms: 0x4a4a52, forearms: 0x4a4a52, gloves: 0x111111,
      legs: 0x22252c, boots: 0x111111, eye: 0xffffff, brows: 0x222222, gun: true, bulk: 1, balaclava: true },
  };

  const CIV_SHIRTS = [0xd8312c, 0xf2c522, 0x2f62c8, 0x3aa04a, 0xf07a22, 0xf2f2f2, 0xd8a77a, 0x8a3ac8, 0x222222];
  const CIV_PANTS = [0x2a3e7a, 0x1d2a52, 0x111111, 0xcab48a, 0x3a3a3a];
  const CIV_SKIN = [0xf2c8a8, 0xe0ac86, 0xc58a62, 0x8a5a3a, 0xf6d6bc];
  const CIV_HAIR = [0x1a1410, 0x5a3a1a, 0xe8cf7a, 0x9a9a9a, 0xb04a1a, 0x222222];
  function randomCivDef() {
    const r = Math.random;
    const shirt = U.pick(CIV_SHIRTS);
    return { name: 'Гражданин', skin: U.pick(CIV_SKIN), hair: U.pick(CIV_HAIR), hairStyle: U.pick(['short', 'short', 'long', 'curly', 'bald', 'cap']),
      capColor: U.pick(CIV_SHIRTS), torso: shirt, arms: shirt, forearms: r() < 0.5 ? shirt : U.pick(CIV_SKIN), gloves: null, legs: U.pick(CIV_PANTS), boots: 0x222222,
      eye: 0x222222, brows: 0x222222, simple: true, bulk: U.rand(0.85, 1.05), scale: U.rand(0.86, 1.0) };
  }

  function buildChar(def) {
    const root = new T.Group();
    const body = new T.Group(); body.position.y = 1; root.add(body);
    const hips = new T.Group(); hips.position.y = -0.05; body.add(hips);
    const bulk = def.bulk || 1, sc = def.scale || 1;
    root.scale.setScalar(sc);
    const simple = !!def.simple;
    const c = { root, body, hips, def, eyes: [], glow: [], cur: {}, tg: {}, phase: Math.random() * 6, t: Math.random() * 10 };

    // ноги
    const legs = [];
    for (const side of [1, -1]) {
      const p = new T.Group(); p.position.set(0.14 * side * bulk, 0, 0); hips.add(p);
      part(p, cap(0.11 * bulk, 0.48), toon(def.legs), 0, -0.36, 0);
      part(p, cap(0.125 * bulk, 0.16), def.ribbed ? ribbed(def.boots) : toon(def.boots), 0, -0.78, 0.03);
      const toe = part(p, cap(0.1 * bulk, 0.12), toon(def.boots), 0, -0.9, 0.12, !def.simple); toe.rotation.x = Math.PI / 2; toe.scale.set(1, 1, 0.75);
      if (def.kneeDots) part(p, sph(0.065), toon(def.kneeDots), 0, -0.6, 0.12, false);
      if (def.bootRim) { part(p, cyl(0.135 * bulk, 0.13 * bulk, 0.04, 14), toon(def.bootRim), 0, -0.64, 0.01, false); const kp = part(p, sph(0.085), toon(def.boots), 0, -0.6, 0.1); kp.scale.set(1.1, 1.2, 0.7); }
      legs.push(p);
    }
    c.legL = legs[0]; c.legR = legs[1];

    // торс
    const spine = new T.Group(); hips.add(spine); c.spine = spine;
    const tmat = def.torsoTex === 'camo' ? toonX(0xffffff, { map: camoTex() }) : toon(def.torso);
    const torso = part(spine, cap(0.26, 0.3), tmat, 0, 0.38, 0);
    torso.scale.set(1.12 * bulk, 1, 0.74 * bulk);
    if (def.vest) { const v = part(spine, cap(0.27, 0.2), toon(def.vest), 0, 0.42, 0); v.scale.set(1.16 * bulk, 1, 0.8 * bulk); }
    if (def.stripe) { const s = part(spine, cap(0.035, 0.55), toon(def.stripe), 0, 0.4, 0.19 * bulk, false); s.scale.z = 0.6; }
    if (def.collar) part(spine, cyl(0.12, 0.14, 0.12), toon(def.collar), 0, 0.76, 0);
    if (def.belt) { const b = part(spine, cyl(0.27, 0.27, 0.11), toon(def.belt), 0, 0.06, 0); b.scale.set(1.13 * bulk, 1, 0.78 * bulk);
      if (def.belt === 0xe6b23c) { const bk = part(spine, cyl(0.075, 0.075, 0.04, 18), toon(0xf2c650), 0, 0.06, 0.2 * bulk); bk.rotation.x = Math.PI / 2; const bi = part(spine, sph(0.04), toon(0xc9952c), 0, 0.06, 0.22 * bulk, false); bi.scale.z = 0.5; } }
    if (def.emblem) { const e = new T.Mesh(star(0.11), new T.MeshBasicMaterial({ color: def.emblem })); e.position.set(0, 0.52, 0.197 * bulk + 0.003); spine.add(e); }
    if (def.straps) {
      const s1 = part(spine, box(0.06, 0.62, 0.43 * bulk), toon(def.straps), 0, 0.42, 0, false); s1.rotation.z = 0.55;
    }
    if (def.epaulettes) for (const side of [1, -1]) {
      const e = part(spine, sph(0.16), toon(def.epaulettes), 0.34 * side * bulk, 0.7, 0); e.scale.set(1.4, 0.62, 1.2);
      const fr = part(spine, G('fringe', () => new T.TorusGeometry(0.17, 0.035, 8, 20)), toon(0xc9952c), 0.34 * side * bulk, 0.66, 0, false); fr.rotation.x = Math.PI / 2; fr.scale.set(1.25, 1.1, 1);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const d = part(spine, cap(0.022, 0.06), toon(0xd8a838), 0.34 * side * bulk + Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.17, false); }
    }
    if (def.muscles) {
      for (const side of [1, -1]) { const pc = part(spine, sph(0.13), toon(def.torso), 0.115 * side * bulk, 0.53, 0.12 * bulk, false); pc.scale.set(1.15, 0.78, 0.62); }
      for (let i = 0; i < 2; i++) for (const side of [1, -1]) { const ab = part(spine, sph(0.06), toon(def.torso), 0.06 * side, 0.3 - i * 0.12, 0.16 * bulk, false); ab.scale.set(1, 0.8, 0.5); }
    }
    if (def.eagle) {
      // золотой орёл на груди (крылья под воротником)
      const sh = new T.Shape();
      sh.moveTo(0, 0.05); sh.lineTo(0.08, 0.07); sh.lineTo(0.24, 0.06); sh.lineTo(0.2, 0.01); sh.lineTo(0.23, -0.01); sh.lineTo(0.17, -0.04); sh.lineTo(0.19, -0.06); sh.lineTo(0.09, -0.05); sh.lineTo(0, -0.11);
      sh.lineTo(-0.09, -0.05); sh.lineTo(-0.19, -0.06); sh.lineTo(-0.17, -0.04); sh.lineTo(-0.23, -0.01); sh.lineTo(-0.2, 0.01); sh.lineTo(-0.24, 0.06); sh.lineTo(-0.08, 0.07); sh.closePath();
      const eg = new T.Mesh(G('eagle', () => new T.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 })), toon(def.eagle));
      eg.position.set(0, 0.66, 0.155 * bulk); eg.rotation.x = -0.25; spine.add(eg);
    }
    if (def.maeveArmor) {
      const metal = toon(0x6c7382), gold = toon(0xc8a050), dark = toon(0x3a4252);
      const bp = part(spine, sph(0.21), metal, 0, 0.5, 0.075 * bulk); bp.scale.set(1.2 * bulk, 0.8, 0.55 * bulk);          // нагрудник
      for (const sd of [1, -1]) { const v = part(spine, box(0.028, 0.27, 0.02), gold, 0.065 * sd, 0.5, 0.188 * bulk, false); v.rotation.z = 0.42 * sd; v.rotation.x = -0.12; } // золотое «V»
      const gm = part(spine, sph(0.03), gold, 0, 0.39, 0.185 * bulk, false); gm.scale.z = 0.5;
      for (const sd of [1, -1]) { const ln = part(spine, box(0.022, 0.2, 0.015), dark, 0.13 * sd, 0.5, 0.17 * bulk, false); ln.rotation.z = -0.15 * sd; }
      part(spine, cyl(0.1, 0.125, 0.09, 14), metal, 0, 0.75, 0, false);                                                        // ворот
      for (const sd of [1, -1]) {                                                                                                 // наплечники
        const pd = part(spine, sph(0.13), metal, 0.34 * sd * bulk, 0.68, 0); pd.scale.set(1.25, 0.6, 1.1);
        const rim = part(spine, G('mvrim', () => new T.TorusGeometry(0.135, 0.018, 6, 18)), gold, 0.34 * sd * bulk, 0.645, 0, false); rim.rotation.x = Math.PI / 2; rim.scale.set(1.2, 1.05, 1);
      }
      for (let i = 0; i < 5; i++) {                                                                                               // пластины на бёдрах
        const a = (i - 2) * 0.42, r = 0.27 * bulk;
        const pl = part(spine, box(0.11, 0.2, 0.025), metal, Math.sin(a) * r, -0.06, Math.cos(a) * r * 0.78, false); pl.rotation.y = a; pl.rotation.x = 0.18;
        const ed = part(spine, box(0.11, 0.022, 0.03), gold, Math.sin(a) * (r + 0.01), -0.16, Math.cos(a) * (r + 0.01) * 0.78, false); ed.rotation.y = a;
      }
    }
    if (def.pads) for (const side of [1, -1]) { const pd = part(spine, sph(0.14), toon(def.pads), 0.33 * side * bulk, 0.68, 0); pd.scale.set(1.2, 0.55, 1.1); }
    if (def.pads) for (const side of [1, -1]) { const pu = part(spine, box(0.1, 0.12, 0.08), toon(def.pads), 0.16 * side, 0.08, 0.2 * bulk, false); }
    if (def.coat) {
      const g = G('coat', () => new T.CylinderGeometry(0.31, 0.4, 1.12, 16, 1, true, 0.35, Math.PI * 2 - 0.7));
      const m = toonX(def.coat, { side: T.DoubleSide });
      const coat = part(spine, g, m, 0, 0.17, 0, false); coat.scale.set(1.12 * bulk, 1, 0.82 * bulk);
      for (const side of [1, -1]) { const col = part(spine, box(0.14, 0.2, 0.05), toon(def.coat), 0.13 * side, 0.74, 0.12); col.rotation.z = -0.4 * side; col.rotation.x = -0.3; }
    }
    if (def.shield) {
      const sh = new T.Group(); sh.position.set(0, 0.36, -0.27 * bulk); sh.rotation.y = Math.PI; sh.scale.setScalar(1.05); spine.add(sh);
      buildShield(sh); c.shield = sh;
    }

    // руки
    const arms = [], elbows = [];
    for (const side of [1, -1]) {
      const sh = new T.Group(); sh.position.set(0.36 * side * bulk, 0.62, 0); spine.add(sh);
      part(sh, cap(0.085 * bulk, 0.2), toon(def.arms), 0, -0.17, 0);
      const el = new T.Group(); el.position.y = -0.36; sh.add(el);
      part(el, cap(0.08 * bulk, 0.19), def.ribbed ? ribbed(def.forearms || def.arms) : toon(def.forearms || def.arms), 0, -0.15, 0);
      if (def.cuffs) { const cf = part(el, cyl(0.1 * bulk, 0.09 * bulk, 0.06), toon(def.cuffs), 0, -0.02, 0, false); }
      if (def.maeveArmor) { part(el, cyl(0.095 * bulk, 0.088 * bulk, 0.04), toon(0xc8a050), 0, -0.27, 0, false); const rg = part(el, box(0.03, 0.2, 0.05), toon(0x8a909c), 0, -0.15, 0.085, false); }
      part(el, sph(0.085), toon(def.gloves || def.skin), 0, -0.36, 0);
      arms.push(sh); elbows.push(el);
    }
    c.armL = arms[0]; c.armR = arms[1]; c.elbowL = elbows[0]; c.elbowR = elbows[1];
    if (def.crowbar) {
      const cb = new T.Group(); cb.position.set(0, -0.4, 0.05); cb.rotation.x = -0.25; c.elbowR.add(cb);
      const barM = toon(0x34363c);
      part(cb, cyl(0.022, 0.022, 1.0, 8), barM, 0, -0.28, 0);
      const hk = part(cb, cyl(0.022, 0.022, 0.2, 8), barM, 0, -0.82, 0.07); hk.rotation.x = 1.1;
      part(cb, box(0.06, 0.03, 0.08), barM, 0, 0.23, 0.03);
      c.crowbar = cb;
    }
    if (def.camera) {
      const cam = new T.Group(); cam.position.set(0, -0.38, 0.12); c.elbowR.add(cam);
      part(cam, box(0.22, 0.26, 0.5), toon(0x1e1e22), 0, 0, 0);
      const lens = part(cam, cyl(0.07, 0.08, 0.14, 12), toon(0x111111), 0, 0, 0.3); lens.rotation.x = Math.PI / 2;
      const red = new T.Mesh(sph(0.025), new T.MeshBasicMaterial({ color: 0xff2020 })); red.position.set(0.08, 0.12, 0.2); cam.add(red);
    }
    if (def.hood) { const hd = part(spine, G('hood', () => new T.TorusGeometry(0.17, 0.07, 8, 16)), toon(def.hood), 0, 0.78, -0.05); hd.rotation.x = Math.PI / 2 + 0.3; hd.scale.set(1.2, 1, 1); }
    if (def.gun) {
      const g = part(c.elbowR, box(0.07, 0.42, 0.13), toon(0x1c1c1c), 0, -0.52, 0.04);
      c.gun = g;
    }

    // голова
    part(spine, cyl(0.075, 0.09, 0.16), toon(def.skin), 0, 0.8, 0, false);
    const head = new T.Group(); head.position.y = 1.0; spine.add(head); c.head = head;
    const skull = part(head, sph(0.2), toon(def.skin)); skull.scale.set(0.95, 1.14, 1);
    if (!def.noFace) {
      const whites = toon(0xffffff), iris = new T.MeshBasicMaterial({ color: def.eye || 0x222222 });
      c.irisMat = iris; c.irisColor = def.eye || 0x222222;
      for (const side of [1, -1]) {
        if (!def.balaclava || true) {
          const w = part(head, sph(0.045), whites, 0.075 * side, 0.03, 0.165, false); w.scale.set(1, 1.1, 0.55);
          const ir = new T.Mesh(sph(0.026), iris); ir.position.set(0.075 * side, 0.03, 0.188); ir.scale.z = 0.5; head.add(ir);
          c.eyes.push(ir);
        }
        if (!simple || def.angry) {
          const b = part(head, box(0.1, 0.024, 0.03), toon(def.brows || 0x222222), 0.075 * side, 0.1, 0.175, false);
          b.rotation.z = (def.angry ? 0.3 : -0.08) * side;
        }
        if (!simple) part(head, sph(0.045), toon(def.skin), 0.19 * side, 0, 0, false);
      }
      if (!def.balaclava) {
        const n = part(head, cap(0.035, 0.04), toon(def.skin), 0, -0.03, 0.2, false); n.rotation.x = 0.3;
        part(head, box(def.lips ? 0.085 : 0.09, def.lips ? 0.022 : 0.015, 0.02), toon(def.lips || 0x3a1a14), 0, -0.11, 0.18, false);
      }
    }
    if (def.noFace) { const v = part(head, box(0.22, 0.06, 0.05), new T.MeshBasicMaterial({ color: 0x050505 }), 0, 0.02, 0.18, false); }
    hairFor(head, def);
    if (def.tiara) {
      const tm = toon(def.tiara);
      const tr = part(head, cyl(0.207, 0.217, 0.045, 20), tm, 0, 0.12, -0.01, false); tr.rotation.x = -0.18;
      for (const sd of [1, -1]) { const v = part(head, box(0.026, 0.13, 0.025), tm, 0.034 * sd, 0.2, 0.19, false); v.rotation.z = -0.38 * sd; v.rotation.x = -0.25; } // центральный зубец «V»
      for (const sd of [1, -1]) { const sp = part(head, box(0.02, 0.07, 0.02), tm, 0.12 * sd, 0.17, 0.15, false); sp.rotation.z = -0.25 * sd; sp.rotation.y = 0.6 * sd; }
      const gem = part(head, sph(0.025), new T.MeshBasicMaterial({ color: 0x9ad0ff }), 0, 0.15, 0.205, false); gem.scale.z = 0.5;
    }
    if (def.hairVolume) { // длинные волнистые волосы до лопаток
      const hm = toon(def.hair);
      for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.33, y = -0.06 - Math.abs(i - 4) * 0.02;
        const h = part(head, sph(0.08), hm, Math.sin(a) * 0.17, y - 0.08, -0.1 - Math.cos(a) * 0.08, false); h.scale.set(1, 2.1, 0.9); }
      for (const sd of [1, -1]) for (let k = 0; k < 3; k++) { const h = part(head, sph(0.065), hm, 0.17 * sd, -0.12 - k * 0.11, -0.02 - k * 0.03, false); h.scale.set(0.9, 1.4, 0.9); }
    }
    if (def.beard) {
      const b = part(head, sph(0.165), toon(def.beard), 0, -0.1, 0.06); b.scale.set(1.17, 0.95, 0.98);
      part(head, box(0.15, 0.04, 0.04), toon(def.beard), 0, -0.06, 0.2, false);
      // нос поверх бороды
      const n = part(head, sph(0.05), toon(def.skin), 0, -0.02, 0.22, false); n.scale.set(0.9, 1.1, 1);
      // губы
      part(head, box(0.08, 0.02, 0.02), toon(0xb04a44), 0, -0.1, 0.235, false);
    }
    if (def.stubble) { const s = new T.Mesh(sph(0.198), new T.MeshBasicMaterial({ color: def.stubble, transparent: true, opacity: 0.35 })); s.position.set(0, -0.08, 0.015); s.scale.set(0.95, 0.75, 1); head.add(s); }

    // плащ
    if (def.cape) {
      c.cape = makeCape(def.cape, def.capeFlag);
      c.cape.position.set(0, 0.66, -0.2 * bulk);
      spine.add(c.cape);
      c.capeAng = 0.06; c.capeAmp = 0.05;
    }
    // щупальца (Бутчер на Темп-V)
    // Эй-Трейн: фирменные очки на лбу и белые полосы на костюме
    if (def.atrain) {
      const W = toon(0xf4f4f4), lens = new T.MeshBasicMaterial({ color: 0x48c8ff });
      const band = part(head, G('atband', () => new T.TorusGeometry(0.205, 0.022, 6, 24)), toon(0x1a1a1a), 0, 0.12, -0.005, false);
      band.rotation.x = Math.PI / 2 - 0.25; band.scale.set(1, 1.04, 1);
      for (const side of [1, -1]) {
        const g2 = new T.Group(); g2.position.set(0.075 * side, 0.15, 0.17); g2.rotation.x = -0.45; head.add(g2);
        const rim = part(g2, G('atrim', () => new T.TorusGeometry(0.058, 0.017, 6, 18)), W, 0, 0, 0, false);
        const l = new T.Mesh(sph(0.055), lens); l.scale.z = 0.35; g2.add(l);
        const sh = new T.Mesh(sph(0.018), new T.MeshBasicMaterial({ color: 0xffffff })); sh.position.set(-0.02, 0.02, 0.018); g2.add(sh);
      }
      part(head, box(0.05, 0.03, 0.04), W, 0, 0.15, 0.2, false); // перемычка
      for (const [p, side] of [[c.legL, 1], [c.legR, -1]]) {
        part(p, cap(0.028, 0.5), W, 0.1 * side * bulk, -0.36, 0.02, false);
        part(p, cap(0.022, 0.5), W, 0.07 * side * bulk, -0.36, 0.085, false);
      }
      for (const [a, side] of [[c.armL, 1], [c.armR, -1]]) part(a, cap(0.024, 0.2), W, 0.075 * side * bulk, -0.17, 0, false);
      for (const side of [1, -1]) {
        const v2 = part(spine, box(0.05, 0.42, 0.04), W, 0.1 * side, 0.46, 0.185 * bulk, false); v2.rotation.z = 0.45 * side; v2.rotation.x = -0.08;
        const sd = part(spine, cap(0.025, 0.45), W, 0.28 * side * bulk, 0.4, 0, false);
      }
      const bolt = new T.Shape(); bolt.moveTo(0.02, 0.09); bolt.lineTo(-0.045, -0.005); bolt.lineTo(0.0, -0.005); bolt.lineTo(-0.02, -0.09); bolt.lineTo(0.05, 0.015); bolt.lineTo(0.005, 0.015); bolt.closePath();
      const bm = new T.Mesh(new T.ShapeGeometry(bolt), new T.MeshBasicMaterial({ color: 0xffd23a })); bm.position.set(0, 0.62, 0.2 * bulk); spine.add(bm);
    }
    if (def.tentacles) {
      c.tentacles = [];
      for (let i = 0; i < 3; i++) {
        const t = makeTentacle();
        t.root.position.set((i - 1) * 0.16, 0.45, -0.22);
        spine.add(t.root);
        t.base = { yaw: (i - 1) * 0.8, pitch: -0.6 - (i % 2) * 0.3 };
        t.phase = i * 2;
        c.tentacles.push(t);
      }
    }
    // свечение глаз
    if (!def.noFace) {
      for (const side of [1, -1]) {
        const g = glowSprite(0xff2a1a, 0.32); g.position.set(0.075 * side, 0.03, 0.22); g.visible = false; head.add(g); c.glow.push(g);
      }
    }
    return c;
  }

  function hairFor(head, def) {
    const hm = toon(def.hair);
    switch (def.hairStyle) {
      case 'slick': {
        const h = part(head, hemi(0.215, 0.5), hm, 0, 0.02, -0.01); h.scale.set(1.0, 1.15, 1.06);
        const q = part(head, sph(0.1), hm, 0.05, 0.19, 0.11); q.scale.set(1.6, 0.6, 1.0); q.rotation.z = -0.25;
        break;
      }
      case 'short': { const h = part(head, hemi(0.212, 0.45), hm, 0, 0.03, -0.012); h.scale.set(1.0, 1.1, 1.04); break; }
      case 'curly': {
        const h = part(head, hemi(0.216, 0.5), hm, 0, 0.03, -0.01); h.scale.set(1.04, 1.15, 1.06);
        for (let i = 0; i < 5; i++) part(head, sph(0.07), hm, Math.cos(i * 1.3) * 0.13, 0.17 + (i % 2) * 0.03, Math.sin(i * 1.3) * 0.1, false);
        break;
      }
      case 'long': {
        const h = part(head, hemi(0.217, 0.52), hm, 0, 0.02, -0.01); h.scale.set(1.04, 1.15, 1.08);
        const b = part(head, cap(0.17, 0.25), hm, 0, -0.14, -0.08); b.scale.set(1.15, 1, 0.65);
        if (def.hairVolume) { h.rotation.x = -0.42; h.position.set(0, 0.05, -0.03); } // открытый лоб: волосы зачёсаны назад
        break;
      }
      case 'cap': {
        const h = part(head, hemi(0.218, 0.45), toon(def.capColor || 0x333333), 0, 0.04, 0); h.scale.set(1, 1.05, 1.05);
        const v = part(head, cyl(0.15, 0.15, 0.02), toon(def.capColor || 0x333333), 0, 0.08, 0.15, false); v.scale.z = 0.8;
        break;
      }
      case 'mask': {
        const h = part(head, sph(0.208), hm, 0, 0, 0); h.scale.set(0.96, 1.15, 1.0);
        break;
      }
      default: break; // bald
    }
  }

  function shieldShape(k = 1) {
    const sh = new T.Shape();
    sh.moveTo(-0.46 * k, 0.32 * k);
    sh.quadraticCurveTo(-0.22 * k, 0.4 * k, -0.09 * k, 0.44 * k);
    sh.quadraticCurveTo(0, 0.52 * k, 0.09 * k, 0.44 * k);
    sh.quadraticCurveTo(0.22 * k, 0.4 * k, 0.46 * k, 0.32 * k);
    sh.quadraticCurveTo(0.44 * k, -0.06 * k, 0.07 * k, -0.47 * k);
    sh.quadraticCurveTo(0, -0.52 * k, -0.07 * k, -0.47 * k);
    sh.quadraticCurveTo(-0.44 * k, -0.06 * k, -0.46 * k, 0.32 * k);
    return sh;
  }
  // латунный щит: плоскость XY, лицевая сторона смотрит в +Z
  function buildShield(parent) {
    const brass = toon(0xc9b98a), dark = toon(0x8c7a4a), deep = toon(0x6a5a34);
    const body = G('shieldBody', () => { const g = new T.ExtrudeGeometry(shieldShape(1), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.025); return g; });
    const m = new T.Mesh(body, brass); m.castShadow = true; parent.add(m);
    const o = new T.Mesh(body, outlineMat); m.add(o);
    // внутренний выпуклый кант
    const rim = G('shieldRim', () => { const sh = shieldShape(0.86); const g = new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 10 }); g.translate(0, -0.01, 0.028); return g; });
    const r = new T.Mesh(rim, dark); parent.add(r);
    const inner = G('shieldInner', () => { const g = new T.ExtrudeGeometry(shieldShape(0.8), { depth: 0.012, bevelEnabled: false, curveSegments: 10 }); g.translate(0, -0.015, 0.032); return g; });
    parent.add(new T.Mesh(inner, brass));
    const strip = (x, y, len, ang, w = 0.028) => { const b2 = new T.Mesh(box(w, len, 0.02), dark); b2.position.set(x, y, 0.05); b2.rotation.z = ang; parent.add(b2); };
    // «перья» крыльев: вертикальные дуги по бокам
    for (const sd of [1, -1]) for (let i = 0; i < 4; i++) {
      const x = sd * (0.12 + i * 0.065);
      strip(x, 0.06 - i * 0.02, 0.5 - i * 0.09, sd * (0.18 + i * 0.07));
    }
    // шевроны внизу
    for (let i = 0; i < 2; i++) {
      const y = -0.1 - i * 0.12;
      strip(0.075, y, 0.2, 0.95); strip(-0.075, y, 0.2, -0.95);
    }
    // круг со звездой в центре
    const disc = new T.Mesh(cyl(0.07, 0.07, 0.03, 20), dark); disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.1, 0.05); parent.add(disc);
    const st = new T.Mesh(star(0.05), new T.MeshBasicMaterial({ color: 0xe8dcb0, side: T.DoubleSide })); st.position.set(0, 0.1, 0.068); parent.add(st);
    // голова орла сверху
    const head = new T.Mesh(sph(0.07), brass); head.scale.set(1, 0.9, 0.6); head.position.set(0, 0.42, 0.05); parent.add(head);
    const beak = new T.Mesh(G('beak', () => new T.ConeGeometry(0.03, 0.08, 8)), deep); beak.rotation.z = Math.PI / 2 + 0.4; beak.position.set(-0.07, 0.41, 0.06); parent.add(beak);
    const eye = new T.Mesh(sph(0.012), new T.MeshBasicMaterial({ color: 0x2a2010 })); eye.position.set(-0.025, 0.44, 0.09); parent.add(eye);
    // ремни сзади
    const strap = new T.Mesh(box(0.06, 0.4, 0.03), toon(0x4a3018)); strap.position.set(0, 0, -0.05); parent.add(strap);
    return m;
  }
  function makeShieldMesh() { const g = new T.Group(); buildShield(g); return g; }

  // ---------- плащ (вершинная анимация) ----------
  let _flagCape = null;
  function flagCapeTex() {
    // флаг США, вытянутый по вертикали плаща: полосы поперёк, синий кантон со звёздами сверху
    return _flagCape || (_flagCape = (() => {
      const t = canvasTex(256, 448, (x, w, h) => {
        for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f4f1ea' : '#b8202c'; x.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
        const cw = w * 0.5, ch = h * (7 / 13);
        x.fillStyle = '#1f2f6e'; x.fillRect(0, 0, cw, ch);
        x.fillStyle = '#fff';
        const star = (cx, cy, r) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
        for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) star(cw * ((c + (r % 2 ? 1 : 0.5)) / 6), ch * ((r + 0.7) / 9.6), 7.5);
      });
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.anisotropy = 4; t.repeat.x = -1; t.offset.x = 1; // кантон слева сверху, если смотреть со спины
      return t;
    })());
  }
  function makeCape(color, flag) {
    const W = 0.78, H = 1.45, SX = 6, SY = 14;
    const geo = new T.PlaneGeometry(W, H, SX, SY);
    geo.translate(0, -H / 2, 0);
    const mat = flag ? toonX(0xffffff, { side: T.DoubleSide, map: flagCapeTex() }) : toonX(color, { side: T.DoubleSide });
    const m = new T.Mesh(geo, mat); m.castShadow = true;
    m.userData = { base: geo.attributes.position.array.slice(), W, H, SX, SY, rowY: new Float32Array(SY + 1), rowZ: new Float32Array(SY + 1) };
    return m;
  }
  // angle: базовый наклон назад; amp: сила волн
  function updateCape(c, dt) {
    const cape = c.cape; if (!cape) return;
    const u = cape.userData, pos = cape.geometry.attributes.position, arr = pos.array, b = u.base;
    const t = c.t, ang = c.capeAng, amp = c.capeAmp;
    const seg = u.H / u.SY;
    let y = 0, z = 0;
    for (let j = 0; j <= u.SY; j++) {
      const v = j / u.SY;
      u.rowY[j] = y; u.rowZ[j] = z;
      const a = ang * (0.4 + v) + Math.sin(t * 2.1 - v * 4.2) * amp * v + Math.sin(t * 3.7 - v * 7) * amp * 0.35 * v;
      y -= seg * Math.cos(a); z -= seg * Math.sin(a);
    }
    for (let i = 0, n = arr.length / 3; i < n; i++) {
      const bx = b[i * 3], by = b[i * 3 + 1];
      const j = Math.round((-by / u.H) * u.SY), v = j / u.SY;
      const flare = 1 + v * 0.45;
      arr[i * 3] = bx * flare;
      arr[i * 3 + 1] = u.rowY[j];
      arr[i * 3 + 2] = u.rowZ[j] + Math.sin(bx * 7 + t * 3.1 - v * 3) * amp * 0.5 * v - Math.abs(bx) * v * 0.15;
    }
    pos.needsUpdate = true;
    cape.geometry.computeVertexNormals();
  }

  // ---------- щупальца ----------
  function makeTentacle() {
    const root = new T.Group();
    const segs = [];
    let parent = root;
    const N = 9;
    for (let i = 0; i < N; i++) {
      const r = 0.09 * (1 - i / N) + 0.025;
      const g = new T.Group(); g.position.y = i === 0 ? 0 : 0.32; parent.add(g);
      part(g, cap(r, 0.22), toon(i % 2 ? 0x7a2a2a : 0x8e3434), 0, 0.16, 0);
      segs.push(g); parent = g;
    }
    return { root, segs, ext: 0 };
  }
  function updateTentacles(c, dt, mode) {
    if (!c.tentacles) return;
    for (const tn of c.tentacles) {
      const t = c.t + tn.phase;
      const lash = mode === 'lash' ? 1 : 0;
      tn.root.rotation.set(tn.base.pitch - lash * 0.8 + Math.sin(t * 1.3) * 0.2, tn.base.yaw + Math.sin(t * 0.9) * 0.3, 0);
      tn.segs.forEach((s, i) => {
        if (!i) return;
        s.rotation.x = Math.sin(t * 2.4 - i * 0.7) * (0.25 + lash * 0.1) - 0.08 + lash * 0.05;
        s.rotation.z = Math.cos(t * 1.9 - i * 0.6) * 0.18;
      });
    }
  }

  // ---------- позы/анимации ----------
  const DEF_POSE = { pitch: 0, roll: 0, bodyY: 1, spineX: 0, headX: 0, headY: 0, lLx: 0, lLz: 0, lRx: 0, lRz: 0,
    aLx: 0, aLz: 0.08, aRx: 0, aRz: -0.08, eLx: 0, eLz: 0, eRx: 0, eRz: 0 };
  function animate(c, dt, mode, speed = 0, opt = {}) {
    c.t += dt;
    const tg = c.tg;
    Object.assign(tg, DEF_POSE);
    const t = c.t;
    let rate = 12;
    switch (mode) {
      case 'idle':
        tg.spineX = Math.sin(t * 1.6) * 0.02; tg.aLz = 0.1 + Math.sin(t * 1.6) * 0.02; tg.aRz = -0.1 - Math.sin(t * 1.6) * 0.02;
        break;
      case 'akimbo':
        tg.aLz = 0.62; tg.eLz = -1.55; tg.aRz = -0.62; tg.eRz = 1.55; tg.aLx = 0.12; tg.aRx = 0.12;
        tg.spineX = -0.06 + Math.sin(t * 1.4) * 0.015; tg.headX = -0.08; tg.lLz = 0.07; tg.lRz = -0.07;
        break;
      case 'spread': // «встречайте!» — руки в стороны ладонями вверх, грудь вперёд
        tg.aLz = 1.02; tg.aRz = -1.02; tg.aLx = -0.32; tg.aRx = -0.32; tg.eLx = -0.3; tg.eRx = -0.3;
        tg.spineX = -0.12 + Math.sin(t * 1.3) * 0.012; tg.headX = -0.14; tg.headY = Math.sin(t * 0.7) * 0.08; tg.lLz = 0.1; tg.lRz = -0.1;
        break;
      case 'walk': case 'run': case 'flee': {
        const run = mode !== 'walk';
        c.phase += dt * (run ? 1.4 : 1.9) * Math.max(2, speed);
        const s = Math.sin(c.phase), a = run ? 0.85 : 0.5;
        tg.lLx = s * a; tg.lRx = -s * a;
        tg.aLx = -s * a * 0.8; tg.aRx = s * a * 0.8; tg.eLx = run ? -0.9 : -0.25; tg.eRx = run ? -0.9 : -0.25;
        tg.bodyY = 1 + Math.abs(Math.cos(c.phase)) * (run ? 0.08 : 0.03);
        tg.spineX = run ? 0.2 : 0.04;
        if (mode === 'flee') { tg.aLx = -2.6 + s * 0.4; tg.aRx = -2.6 - s * 0.4; tg.eLx = -0.3; tg.eRx = -0.3; }
        rate = 18;
        break;
      }
      case 'fly':
        tg.pitch = opt.pitch != null ? opt.pitch : 1.35; tg.aRx = -3.0; tg.aRz = 0.1; tg.aLx = 0.25; tg.aLz = 0.2; tg.headX = -1.0;
        tg.lLx = 0.06 + Math.sin(t * 3) * 0.04; tg.lRx = -0.08 - Math.sin(t * 3) * 0.04; tg.lLz = 0.05; tg.lRz = -0.05;
        tg.roll = opt.roll || 0;
        rate = 6;
        break;
      case 'hover':
        tg.pitch = opt.pitch || 0.08; tg.roll = opt.roll || 0;
        tg.aLz = 0.62; tg.eLz = -1.55; tg.aRz = -0.62; tg.eRz = 1.55; tg.aLx = 0.12; tg.aRx = 0.12;
        tg.lLx = 0.12 + Math.sin(t * 1.5) * 0.05; tg.lRx = -0.05 - Math.sin(t * 1.5) * 0.05; tg.lLz = 0.06; tg.lRz = -0.06; tg.headX = -0.05;
        rate = 6;
        break;
      case 'jump':
        tg.lLx = -0.6; tg.lRx = 0.3; tg.aLx = -0.8; tg.aRx = -0.8; tg.aLz = 0.4; tg.aRz = -0.4;
        break;
      case 'punch': {
        const p = opt.p || 0; // 0..1
        const k = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
        if (opt.up) { // апперкот
          tg.aRx = -0.3 - 2.5 * k; tg.aRz = -0.1; tg.eRx = -1.5 * (1 - k); tg.aLx = 0.4; tg.eLx = -1.2; tg.spineX = -0.25 * k; tg.headX = -0.15 * k; tg.lLx = -0.5; tg.lRx = 0.5; tg.bodyY = 1 + 0.12 * k;
        } else if (opt.down) { // удар сверху двумя руками
          const s2 = p < 0.4 ? 0 : Math.min(1, (p - 0.4) / 0.3);
          tg.aLx = tg.aRx = -2.9 + 2.5 * s2; tg.eLx = tg.eRx = -0.3; tg.aLz = 0.2; tg.aRz = -0.2; tg.spineX = -0.2 + 0.65 * s2; tg.headX = 0.15 * s2; tg.lLx = -0.3; tg.lRx = 0.3;
        } else if (opt.left) { // удар левой
          tg.aLx = -1.55 * k - 0.2; tg.aLz = 0.15; tg.eLx = -0.6 * (1 - k);
          tg.aRx = 0.5 * k; tg.eRx = -1.2; tg.spineX = 0.15 * k; tg.headX = -0.05; tg.lLx = 0.4; tg.lRx = -0.4;
        } else {
          tg.aRx = -1.55 * k - 0.2; tg.aRz = -0.15; tg.eRx = -0.6 * (1 - k);
          tg.aLx = 0.5 * k; tg.eLx = -1.2; tg.spineX = 0.15 * k; tg.headX = -0.05;
          tg.lLx = -0.4; tg.lRx = 0.4;
        }
        if (opt.air) { tg.pitch = 0.5; }
        rate = 30;
        break;
      }
      case 'shoot':
        tg.aRx = -1.5; tg.aLx = -1.35; tg.aLz = -0.35; tg.eLz = 0; tg.headX = 0.05; tg.spineX = 0.05;
        if (speed > 0.5) { c.phase += dt * 2.6 * speed; const s = Math.sin(c.phase); tg.lLx = s * 0.6; tg.lRx = -s * 0.6; }
        break;
      case 'throw': {
        const p = opt.p || 0;
        tg.aRx = p < 0.5 ? -2.8 : -1.0; tg.aRz = -0.3; tg.spineX = p < 0.5 ? -0.2 : 0.25; tg.lLx = -0.4; tg.lRx = 0.4;
        rate = 20; break;
      }
      case 'charge':
        tg.aLz = 1.2; tg.aRz = -1.2; tg.aLx = 0.4; tg.aRx = 0.4; tg.spineX = -0.25; tg.headX = -0.3; tg.lLz = 0.25; tg.lRz = -0.25;
        tg.bodyY = 0.95 + Math.sin(t * 40) * 0.01;
        break;
      case 'cheer':
        tg.aLx = -2.7 + Math.sin(t * 9) * 0.25; tg.aRx = -2.7 - Math.sin(t * 9) * 0.25; tg.aLz = 0.3; tg.aRz = -0.3;
        tg.bodyY = 1 + Math.abs(Math.sin(t * 6)) * 0.1;
        break;
      case 'wave': // зовёт на помощь
        tg.aRx = -2.7; tg.aRz = -0.4 - Math.sin(t * 8) * 0.4; tg.aLx = -0.2;
        break;
      case 'scared':
        tg.aLx = -1.8; tg.aRx = -1.8; tg.eLx = -1.4; tg.eRx = -1.4; tg.aLz = -0.2; tg.aRz = 0.2; tg.spineX = 0.25; tg.headX = 0.3;
        tg.lLx = -0.5; tg.lRx = -0.5; tg.bodyY = 0.8;
        break;
      case 'carried':
        tg.pitch = -1.4; tg.bodyY = 1; tg.lLx = -0.4; tg.lRx = -0.5; tg.aLx = -0.5; tg.aRx = -2.2; tg.headX = 0.3;
        rate = 20;
        break;
      case 'carry':
        tg.aLx = -1.3; tg.aRx = -1.3; tg.eLx = -0.6; tg.eRx = -0.6; tg.aLz = 0.15; tg.aRz = -0.15;
        if (opt.fly) { tg.pitch = 0.5; tg.lLx = 0.2; tg.lRx = -0.1; }
        if (opt.over) { tg.aLx = -2.95; tg.aRx = -2.95; tg.eLx = -0.25; tg.eRx = -0.25; tg.aLz = 0.35; tg.aRz = -0.35; tg.spineX = -0.08; tg.pitch = opt.fly ? 0.15 : 0; }
        break;
      case 'dead':
        tg.pitch = -1.52; tg.bodyY = 0.24; tg.aLz = 1.2; tg.aRz = -0.9; tg.lLz = 0.25; tg.lRz = -0.15; tg.headX = 0.2;
        rate = 9;
        break;
      case 'tumble':
        tg.pitch = (opt.spin || 0); tg.aLz = 1.4; tg.aRz = -1.4; tg.lLz = 0.4; tg.lRz = -0.4; rate = 30;
        break;
      case 'grab': // рука на шее противника
        tg.aRx = -2.0; tg.aRz = -0.12; tg.eRx = -0.15; tg.spineX = 0.04; tg.headX = 0.05 + Math.sin(t * 9) * 0.015;
        tg.aLz = 0.62; tg.eLz = -1.55; tg.lLx = -0.2; tg.lRx = 0.25;
        rate = 20; break;
      case 'choked':
        tg.aLx = -1.4; tg.aLz = -0.35; tg.eLx = -1.7; tg.aRx = -1.4; tg.aRz = 0.35; tg.eRx = -1.7;
        tg.lLx = Math.sin(t * 11) * 0.35; tg.lRx = -Math.sin(t * 11) * 0.35; tg.headX = -0.25; tg.spineX = -0.05;
        rate = 18; break;
      case 'sit':
        tg.bodyY = 0.42; tg.lLx = -1.5; tg.lRx = -1.4; tg.lLz = 0.15; tg.lRz = -0.15; tg.spineX = 0.25; tg.aLx = -0.5; tg.aRx = -1.3; tg.eRx = -1.4; tg.headX = 0.25;
        rate = 8; break;
      case 'prone': // лежит лицом в пол (можно «вырываться»)
        tg.pitch = 1.5; tg.bodyY = 0.26; tg.aLz = 1.25; tg.aRz = -1.25; tg.eLx = -0.4; tg.eRx = -0.4; tg.headX = -0.55; tg.lLz = 0.12; tg.lRz = -0.12;
        if (opt.struggle) { const k = opt.struggle; tg.aLz += Math.sin(t * 17) * 0.35 * k; tg.aRz += Math.sin(t * 15 + 1) * 0.35 * k; tg.headX += Math.sin(t * 11) * 0.25 * k; tg.lLx = Math.sin(t * 13) * 0.4 * k; tg.lRx = -Math.sin(t * 12) * 0.4 * k; tg.roll = Math.sin(t * 9) * 0.12 * k; }
        rate = 14; break;
      case 'knocked':
        tg.pitch = -1.52; tg.bodyY = 0.24; tg.aLz = 0.6; tg.aRz = -1.6; tg.lLx = -0.6; tg.headX = 0.4 + Math.sin(t * 2) * 0.1;
        rate = 8; break;
    }
    if (opt.headPitch != null) tg.headX += opt.headPitch;
    const cur = c.cur;
    for (const k in tg) cur[k] = cur[k] === undefined ? tg[k] : U.damp(cur[k], tg[k], rate, dt);
    if (mode === 'tumble') cur.pitch = tg.pitch;
    c.body.rotation.set(cur.pitch, 0, cur.roll);
    c.body.position.y = cur.bodyY;
    c.spine.rotation.x = cur.spineX;
    c.head.rotation.set(cur.headX, cur.headY, 0);
    c.legL.rotation.set(cur.lLx, 0, cur.lLz); c.legR.rotation.set(cur.lRx, 0, cur.lRz);
    c.armL.rotation.set(cur.aLx, 0, cur.aLz); c.armR.rotation.set(cur.aRx, 0, cur.aRz);
    c.elbowL.rotation.set(cur.eLx, 0, cur.eLz); c.elbowR.rotation.set(cur.eRx, 0, cur.eRz);
    if (c.cape) updateCape(c, dt);
    if (c.tentacles) updateTentacles(c, dt, opt.lash ? 'lash' : 'idle');
  }

  function setGlow(c, on, color = 0xff2a1a) {
    if (!c.irisMat) return;
    c.irisMat.color.setHex(on ? color : c.irisColor);
    for (const g of c.glow) { g.visible = on; g.material.color.setHex(color); }
  }

  // ---------- транспорт и предметы ----------
  function buildCar(kind = 'car', color) {
    const g = new T.Group();
    const col = kind === 'taxi' ? 0xf2c522 : color || U.pick([0xd8312c, 0x2f62c8, 0xf2f2f2, 0x222222, 0xf2c522, 0x3aa04a, 0x8a8f99]);
    if (kind === 'van' || kind === 'ambulance') {
      const c1 = kind === 'ambulance' ? 0xf4f4f4 : 0x161618;
      part(g, box(2.3, 2.3, 5.4), toon(c1), 0, 1.65, 0);
      part(g, box(2.2, 1.0, 1.4), toon(kind === 'ambulance' ? 0x9ab6d8 : 0x2a3340), 0, 2.0, 2.05, false);
      if (kind === 'ambulance') {
        part(g, box(2.34, 0.3, 5.42), toon(0xd8312c), 0, 1.4, 0, false);
        const cr = new T.Mesh(box(0.25, 0.9, 0.9), toon(0xd8312c)); cr.position.set(0, 2.2, -0.6); g.add(cr);
        const cr2 = new T.Mesh(box(2.36, 0.25, 0.9), toon(0xd8312c)); cr2.position.set(0, 2.2, -0.6); g.add(cr2);
        const l = new T.Mesh(box(1.2, 0.2, 0.3), new T.MeshBasicMaterial({ color: 0x3a6aff })); l.position.set(0, 2.9, 1.6); g.add(l); g.userData.siren = l;
      }
    } else {
      part(g, box(2.0, 0.8, 4.4), toon(col), 0, 0.8, 0);
      part(g, box(1.7, 0.7, 2.2), toon(col), 0, 1.5, -0.2);
      part(g, box(1.72, 0.5, 2.0), toon(0x2a3a50), 0, 1.5, -0.2, false);
      if (kind === 'taxi') {
        const sg = part(g, box(0.9, 0.3, 0.35), toon(0xffffff), 0, 2.0, -0.2, false);
        part(g, box(2.02, 0.12, 4.42), toon(0x222222), 0, 1.0, 0, false);
      }
      if (kind === 'police') {
        const l = new T.Mesh(box(1.0, 0.2, 0.3), new T.MeshBasicMaterial({ color: 0xff2020 })); l.position.set(0, 1.95, -0.2); g.add(l); g.userData.siren = l;
      }
    }
    const wg = cyl(0.42, 0.42, 0.3, 14);
    const wm = toon(0x151515);
    const L = kind === 'van' || kind === 'ambulance' ? 1.8 : 1.4;
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const w = new T.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(1.0 * sx * (kind === 'car' || kind === 'police' || kind === 'taxi' ? 1 : 1.12), 0.42, L * sz); g.add(w);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function buildRing(color = 0xffd23a) {
    const g = new T.Group();
    const m = new T.Mesh(G('ring', () => new T.TorusGeometry(4.2, 0.32, 10, 40)), new T.MeshBasicMaterial({ color, fog: false }));
    g.add(m);
    const halo = new T.Mesh(G('ring2', () => new T.TorusGeometry(4.2, 0.8, 8, 40)), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    g.add(halo);
    return g;
  }

  return { DEFS, randomCivDef, buildChar, animate, setGlow, toon, toonX, part, outlineMat, setOutlines, glowSprite, glowTex, canvasTex,
    buildCar, buildRing, makeShieldMesh, cap, sph, box, cyl, star, grad, updateCape };
})();
