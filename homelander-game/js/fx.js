// Эффекты: частицы (один InstancedMesh), лазерные лучи, подпалины, ударные волны, вспышки света
HL.FX = (function () {
  const T = THREE, U = HL.U, M = HL.Models;
  function create(scene) {
    const S = HL.Settings;
    const MAX = S.particleMax;
    const geo = new T.IcosahedronGeometry(1, 0);
    const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const im = new T.InstancedMesh(geo, mat, MAX);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    im.setColorAt(0, new T.Color());
    scene.add(im);
    const P = [];
    for (let i = 0; i < MAX; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0, drag: 0, grow: 0, c: new T.Color(), rot: 0 });
    let head = 0;
    const mtx = new T.Matrix4(), q = new T.Quaternion(), sv = new T.Vector3(), pv = new T.Vector3(), e = new T.Euler();

    function spawn(x, y, z, vx, vy, vz, size, color, life, g = 0, drag = 1, grow = -1) {
      const p = P[head]; head = (head + 1) % MAX;
      p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s = size; p.c.setHex(color); p.life = p.max = life; p.g = g; p.drag = drag; p.grow = grow; p.rot = Math.random() * 6;
    }
    const k = [0.4, 0.7, 1, 1.3][S.data.particles];
    function burst(pos, n, o = {}) {
      n = Math.max(1, Math.round(n * k));
      for (let i = 0; i < n; i++) {
        const sp = (o.speed || 8) * (0.4 + Math.random() * 0.8);
        const th = Math.random() * Math.PI * 2, ph = Math.acos(U.rand(o.up ? 0 : -1, 1));
        let dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
        if (o.dir) { dx = dx * (o.spread || 0.5) + o.dir.x; dy = dy * (o.spread || 0.5) + o.dir.y; dz = dz * (o.spread || 0.5) + o.dir.z; }
        const col = Array.isArray(o.color) ? U.pick(o.color) : o.color || 0xffaa33;
        spawn(pos.x, pos.y, pos.z, dx * sp, dy * sp, dz * sp, (o.size || 0.25) * (0.6 + Math.random() * 0.8), col, (o.life || 0.6) * (0.6 + Math.random() * 0.8), o.g == null ? -14 : o.g, o.drag == null ? 1.5 : o.drag, o.grow == null ? -1 : o.grow);
      }
    }
    function explosion(pos, scale = 1) {
      burst(pos, 26 * scale, { color: [0xffffff, 0xffe080, 0xffa020, 0xff5010], speed: 16 * scale, size: 0.7 * scale, life: 0.55, g: 2, drag: 3, grow: -0.6 });
      burst(pos, 18 * scale, { color: [0x3a3a3a, 0x555555, 0x2a2a2a, 0x777777], speed: 6 * scale, size: 1.1 * scale, life: 1.6, g: 3, drag: 1.5, grow: 0.3, up: true });
      burst(pos, 14 * scale, { color: [0xffc040, 0xff6020], speed: 22 * scale, size: 0.15, life: 1.0, g: -20, drag: 0.3 });
      flashLight(pos, 0xffa040, 6 * scale, 0.35, 40 * scale);
      ring(pos, 0xffd080, 8 * scale, 0.45);
    }
    function sparks(pos, color = 0xffe0a0, n = 6) { burst(pos, n, { color: [color, 0xffffff], speed: 10, size: 0.12, life: 0.35, g: -18, drag: 0.5 }); }
    function smoke(pos, n = 1, col) { burst(pos, n, { color: col || [0x333333, 0x444444, 0x2a2a2a], speed: 1.5, size: 0.9, life: 2.2, g: 3.5, drag: 0.6, grow: 0.8, up: true }); }
    function fire(pos, n = 1) {
      burst(pos, n, { color: [0xffd040, 0xff8020, 0xff4010], speed: 2, size: 0.8, life: 0.9, g: 7, drag: 0.8, grow: -0.6, up: true });
      if (Math.random() < 0.4) smoke(new T.Vector3(pos.x, pos.y + 2, pos.z), 1);
    }
    function dust(pos, n = 10) { burst(pos, n, { color: [0x8a8070, 0xa09888, 0x6a6458], speed: 7, size: 0.8, life: 1.0, g: 1, drag: 2, grow: 0.6, up: true }); }

    // --- огни (фиксированное количество, чтобы не пересобирать шейдеры) ---
    const lights = [];
    for (let i = 0; i < 2; i++) { const l = new T.PointLight(0xffaa50, 0, 30, 2); scene.add(l); lights.push({ l, t: 0, d: 1, i: 0 }); }
    let li = 0;
    function flashLight(pos, color, intensity, dur, dist = 30) {
      const L = lights[li]; li = (li + 1) % lights.length;
      L.l.position.copy(pos); L.l.color.setHex(color); L.l.distance = dist; L.i = intensity; L.t = dur; L.d = dur;
    }
    const laserLight = new T.PointLight(0xff2010, 0, 14, 2); scene.add(laserLight);

    // --- лазерные лучи ---
    const beamGeo = new T.CylinderGeometry(1, 1, 1, 8, 1, true); beamGeo.translate(0, 0.5, 0);
    const beamOuter = new T.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    const beamCore = new T.MeshBasicMaterial({ color: 0xffe0d0, fog: false });
    const beams = [];
    function makeBeam() {
      const g = new T.Group();
      const o = new T.Mesh(beamGeo, beamOuter.clone()); const c = new T.Mesh(beamGeo, beamCore.clone());
      g.add(o); g.add(c); g.visible = false; scene.add(g);
      return { g, o, c };
    }
    for (let i = 0; i < 6; i++) beams.push(makeBeam());
    const up = new T.Vector3(0, 1, 0);
    function setBeam(i, from, to, width = 1, color = 0xff2010, core = 0xffe0d0) {
      const b = beams[i]; if (!b) return;
      if (!from) { b.g.visible = false; return; }
      const d = sv.copy(to).sub(from); const L = d.length(); if (L < 0.01) { b.g.visible = false; return; }
      b.g.visible = true; b.g.position.copy(from);
      q.setFromUnitVectors(up, d.divideScalar(L)); b.g.quaternion.copy(q);
      const fl = 0.85 + Math.random() * 0.3;
      b.o.scale.set(0.09 * width * fl, L, 0.09 * width * fl); b.c.scale.set(0.028 * width, L, 0.028 * width);
      b.o.material.color.setHex(color); b.c.material.color.setHex(core);
    }

    // --- подпалины ---
    const scorchMat = new T.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const glowMat = new T.MeshBasicMaterial({ map: M.glowTex(), color: 0xff5010, transparent: true, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3 });
    const SC = 70; const scorches = []; let si = 0;
    const scGeo = new T.CircleGeometry(0.45, 8);
    for (let i = 0; i < SC; i++) {
      const m = new T.Mesh(scGeo, scorchMat); m.visible = false; scene.add(m);
      const g = new T.Mesh(scGeo, glowMat.clone()); g.visible = false; scene.add(g);
      scorches.push({ m, g, t: 0 });
    }
    let lastScorch = new T.Vector3(1e9, 0, 0);
    function scorch(point, normal) {
      if (point.distanceToSquared(lastScorch) < 0.16) return;
      lastScorch.copy(point);
      const s = scorches[si]; si = (si + 1) % SC;
      pv.copy(point).addScaledVector(normal, 0.03);
      s.m.position.copy(pv); s.m.lookAt(pv.clone().add(normal)); s.m.visible = true;
      s.m.scale.setScalar(0.7 + Math.random() * 0.6);
      s.g.position.copy(pv).addScaledVector(normal, 0.01); s.g.quaternion.copy(s.m.quaternion); s.g.visible = true; s.g.scale.setScalar(1.4); s.t = 1.5;
    }

    // --- кольца ударной волны ---
    const ringGeo = new T.RingGeometry(0.85, 1, 40);
    const rings = [];
    for (let i = 0; i < 6; i++) {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, t: 0, d: 1, r: 1 });
    }
    let ri = 0;
    function ring(pos, color, radius, dur) {
      const R = rings[ri]; ri = (ri + 1) % rings.length;
      R.m.position.set(pos.x, Math.max(0.2, pos.y), pos.z); R.m.material.color.setHex(color); R.t = R.d = dur; R.r = radius; R.m.visible = true;
    }

    // --- телеграф (красная зона атаки на земле) ---
    const warnGeo = new T.CircleGeometry(1, 40);
    const warns = [];
    for (let i = 0; i < 4; i++) {
      const m = new T.Mesh(warnGeo, new T.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); warns.push(m);
    }
    function warn(i, pos, radius, k) {
      const m = warns[i]; if (!pos) { m.visible = false; return; }
      m.visible = true; m.position.set(pos.x, 0.15, pos.z); m.scale.setScalar(radius); m.material.opacity = 0.18 + 0.25 * k;
    }

    let shake = 0;
    function addShake(v) { if (HL.Settings.data.shake) shake = Math.min(1.5, shake + v); }

    function update(dt, camera) {
      let n = 0; const cp = camera ? camera.position : null;
      for (let i = 0; i < MAX; i++) {
        const p = P[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) continue;
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vy = p.vy * dr + p.g * dt; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
        const a = p.life / p.max;
        let s = Math.max(0.01, p.s * (p.grow >= 0 ? 1 + (1 - a) * p.grow * 3 : Math.pow(a, -p.grow * 0.8)));
        if (cp) { const dx = p.x - cp.x, dy = p.y - cp.y, dz = p.z - cp.z, d2 = dx * dx + dy * dy + dz * dz, lim = (s + 1.2) * (s + 1.2) * 4; if (d2 < lim) s *= Math.max(0.02, Math.sqrt(d2 / lim) * 1.2 - 0.2); }
        p.rot += dt * 3;
        mtx.makeRotationY(p.rot); mtx.scale(sv.set(s, s, s)); mtx.setPosition(p.x, p.y, p.z);
        im.setMatrixAt(n, mtx); im.setColorAt(n, p.c); n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      for (const L of lights) { if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, (L.t / L.d) * L.i); } else L.l.intensity = 0; }
      for (const s of scorches) if (s.t > 0) { s.t -= dt; s.g.material.opacity = Math.max(0, s.t / 1.5); if (s.t <= 0) s.g.visible = false; }
      for (const R of rings) if (R.t > 0) {
        R.t -= dt; const a = 1 - R.t / R.d; R.m.scale.setScalar(0.5 + a * R.r); R.m.material.opacity = (1 - a) * 0.8;
        if (R.t <= 0) R.m.visible = false;
      }
      shake = Math.max(0, shake - dt * 2.2);
    }
    function clear() {
      for (const p of P) p.life = 0;
      for (const b of beams) b.g.visible = false;
      for (const s of scorches) { s.m.visible = false; s.g.visible = false; s.t = 0; }
      for (const w of warns) w.visible = false;
      laserLight.intensity = 0;
    }
    function clearScorch(b) {
      for (const s of scorches) { const p = s.m.position; if (s.m.visible && p.x > b.x0 - 0.6 && p.x < b.x1 + 0.6 && p.z > b.z0 - 0.6 && p.z < b.z1 + 0.6) { s.m.visible = false; s.g.visible = false; s.t = 0; } }
    }
    return { burst, explosion, sparks, smoke, fire, dust, flashLight, setBeam, scorch, clearScorch, ring, warn, update, clear, addShake, laserLight,
      get shake() { return shake; } };
  }
  return { create };
})();
