// Главный экран: Хоумлендер в темноте, светятся только красные глаза.
// Каждые ~5 секунд его на полсекунды выхватывает свет сверху; плащ тихо колышется.
HL.Menu = (function () {
  const T = THREE, M = HL.Models, U = HL.U;
  let scene, camera, hl, spot, shaft, dust, floor, eyeLight, pool;
  let t = 0, next = 2.2, flashT = -1;
  const FLASH = 0.55;

  function build() {
    scene = new T.Scene();
    scene.background = new T.Color(0x000000);
    scene.fog = new T.Fog(0x000000, 7, 20);
    camera = new T.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 60);

    hl = M.buildChar(M.DEFS.homelander);
    scene.add(hl.root);
    M.setGlow(hl, true, 0xff1a0a);
    hl.glow.forEach((g) => g.scale.setScalar(0.2));
    // слабый красный отсвет глаз на лице
    eyeLight = new T.PointLight(0xff2010, 0.22, 0.55, 2);
    eyeLight.position.set(0, 0.03, 0.42); hl.head.add(eyeLight);

    floor = new T.Mesh(new T.CircleGeometry(9, 48), M.toon(0x2a2a2e));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    spot = new T.SpotLight(0xfff1dc, 0, 16, 0.36, 0.55, 1.2);
    spot.position.set(0.05, 9.5, 0.4); spot.target.position.set(0, 0.6, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
    scene.add(spot); scene.add(spot.target);

    // световой столб
    const sg = new T.CylinderGeometry(0.25, 3.4, 9.5, 32, 1, true); sg.translate(0, -4.75, 0);
    shaft = new T.Mesh(sg, new T.MeshBasicMaterial({ color: 0xfff0d8, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    shaft.position.set(0.05, 9.5, 0.4); scene.add(shaft);
    pool = new T.Mesh(new T.CircleGeometry(2.6, 40), new T.MeshBasicMaterial({ map: M.glowTex(), color: 0xfff0d8, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; scene.add(pool);

    // пыль в луче
    const pg = new T.BufferGeometry(); const P = [];
    for (let i = 0; i < 160; i++) { const r = Math.random() * 2.2, a = Math.random() * 6.28; P.push(Math.cos(a) * r, Math.random() * 6, Math.sin(a) * r); }
    pg.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    dust = new T.Points(pg, new T.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(dust);
    layout();
  }

  function layout() {
    if (!camera) return;
    camera.aspect = innerWidth / innerHeight;
    const portrait = camera.aspect < 0.9;
    camera.fov = portrait ? 46 : 34;
    camera.updateProjectionMatrix();
    // кадр снизу вверх; на широком экране герой справа, меню слева
    hl.root.position.set(portrait ? 0 : 1.15, 0, 0);
    hl.root.rotation.y = portrait ? 0 : -0.22;
    spot.position.x = shaft.position.x = hl.root.position.x + 0.05;
    spot.target.position.x = pool.position.x = dust.position.x = hl.root.position.x;
    camera.userData.base = portrait ? new T.Vector3(0, 0.75, 6.4) : new T.Vector3(-0.3, 0.8, 5.6);
    camera.userData.look = portrait ? new T.Vector3(0, 1.45, 0) : new T.Vector3(0.25, 1.4, 0);
  }

  function update(dt) {
    t += dt;
    // свет сверху: короткая вспышка с миганием
    next -= dt;
    if (next <= 0 && flashT < 0) { flashT = 0; HL.Audio.flash(); }
    let I = 0;
    if (flashT >= 0) {
      flashT += dt;
      const f = flashT;
      if (f < 0.05) I = 1; else if (f < 0.1) I = 0.15; else if (f < 0.14) I = 0.9; else if (f < FLASH) I = 1 - Math.pow((f - 0.14) / (FLASH - 0.14), 3);
      if (f >= FLASH) { flashT = -1; next = 4.6 + Math.random() * 1.2; I = 0; }
    }
    lightNow = I;
    spot.intensity = I * 7;
    shaft.material.opacity = I * 0.07;
    pool.material.opacity = I * 0.35;
    dust.material.opacity = I * 0.7;
    dust.rotation.y += dt * 0.05;
    // в темноте глаза горят сильнее
    const dark = 1 - I;
    const pulse = 0.85 + Math.sin(t * 2.2) * 0.08 + (Math.random() - 0.5) * 0.04;
    hl.glow.forEach((g) => { g.scale.setScalar(0.2 * pulse * (0.75 + dark * 0.25)); g.material.opacity = 0.8 + dark * 0.2; });
    eyeLight.intensity = 0.22 * pulse;
    // поза и плащ: тихо извивается
    hl.capeAng = 0.07 + Math.sin(t * 0.5) * 0.03; hl.capeAmp = 0.06 + Math.sin(t * 0.31) * 0.02;
    M.animate(hl, dt, 'akimbo', 0);
    hl.head.rotation.y = Math.sin(t * 0.23) * 0.06;
    // медленное дыхание камеры
    const b = camera.userData.base;
    camera.position.set(b.x + Math.sin(t * 0.13) * 0.12, b.y + Math.sin(t * 0.21) * 0.04, b.z + Math.sin(t * 0.09) * 0.1);
    camera.lookAt(camera.userData.look);
  }
  let lightNow = 0;
  function render(renderer) {
    // в темноте контуры не видны — только глаза
    const om = M.outlineMat, was = om.visible;
    om.visible = was && lightNow > 0.15;
    renderer.render(scene, camera);
    om.visible = was;
  }
  return { build, update, render, layout, get scene() { return scene; } };
})();
