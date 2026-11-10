// Ввод: клавиатура + мышь (pointer lock) и сенсорное управление
HL.Input = (function () {
  const keys = {}, hits = {};
  const mouse = { dx: 0, dy: 0, wheel: 0, b: [false, false, false] };
  const touch = { mx: 0, mz: 0, held: {}, lookDX: 0, lookDY: 0 };
  let canvas = null, enabled = false;

  // привязки действий
  const BIND = {
    up: ['Space'], down: ['KeyC', 'ControlLeft', 'ControlRight'], boost: ['ShiftLeft', 'ShiftRight'],
    fly: ['KeyF'], hear: ['KeyQ'], use: ['KeyE'], pose: ['KeyH'], rage: ['KeyR'], punch: ['KeyV'],
    pause: ['Escape', 'KeyP'], skip: ['Enter'],
  };

  function init(cvEl) {
    canvas = cvEl;
    addEventListener('keydown', (e) => {
      if (e.repeat) { keys[e.code] = true; return; }
      keys[e.code] = true; hits[e.code] = true;
      if (enabled && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab')) e.preventDefault();
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.b = [false, false, false]; for (const k in touch.held) touch.held[k] = false; });
    addEventListener('mousedown', (e) => {
      if (!enabled || !e.target || e.target.id !== 'c') return;
      if (!HL.Settings.useTouch && document.pointerLockElement !== cv()) { lock(); return; }
      mouse.b[e.button] = true; hits['M' + e.button] = true;
    });
    addEventListener('mouseup', (e) => { mouse.b[e.button] = false; });
    addEventListener('contextmenu', (e) => { if (enabled) e.preventDefault(); });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv()) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
    });
    addEventListener('wheel', (e) => { if (enabled) mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    initTouch();
  }
  function cv() { return document.getElementById('c'); }
  function lock() { const canvas = cv(); if (canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
  function unlock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }

  // ---------- сенсор ----------
  function initTouch() {
    const joy = HL.$('joy'), knob = HL.$('joyKnob');
    let joyId = null, jcx = 0, jcy = 0;
    const R = 60;
    joy.addEventListener('pointerdown', (e) => {
      joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
      const r = joy.getBoundingClientRect(); jcx = r.left + r.width / 2; jcy = r.top + r.height / 2;
      moveJoy(e); e.preventDefault();
    });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveJoy(e); });
    const endJoy = (e) => { if (e.pointerId !== joyId) return; joyId = null; touch.mx = touch.mz = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    function moveJoy(e) {
      let dx = e.clientX - jcx, dy = e.clientY - jcy;
      const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      touch.mx = dx / R; touch.mz = -dy / R;
    }
    // обзор: тянем по свободной области экрана
    const looks = {};
    addEventListener('pointerdown', (e) => {
      if (!enabled || e.pointerType === 'mouse' || !e.target || e.target.id !== 'c') return;
      looks[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      const l = looks[e.pointerId]; if (!l) return;
      touch.lookDX += e.clientX - l.x; touch.lookDY += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY;
    });
    const endLook = (e) => { delete looks[e.pointerId]; };
    addEventListener('pointerup', endLook); addEventListener('pointercancel', endLook);
    // кнопки
    document.querySelectorAll('#tbtns .tb').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        touch.held[k] = true; hits['T' + k] = true; b.classList.add('on');
        // кнопка тоже может вращать камеру (тянем лазер — целимся)
        looks[e.pointerId] = { x: e.clientX, y: e.clientY };
      });
      const up = (e) => { touch.held[k] = false; b.classList.remove('on'); delete looks[e.pointerId]; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
  }

  const sim = {};
  function held(act) {
    if (sim[act]) return true;
    if (act === 'laser') return mouse.b[0] || !!touch.held.laser;
    if (act === 'punch') return mouse.b[2] || !!touch.held.punch || (BIND.punch || []).some((c) => keys[c]);
    return (BIND[act] || []).some((c) => keys[c]) || !!touch.held[act];
  }
  function hit(act) {
    if (act === 'laser') return !!hits.M0 || !!hits.Tlaser;
    if (act === 'punch') return !!hits.M2 || !!hits.Tpunch || (BIND.punch || []).some((c) => hits[c]);
    return (BIND[act] || []).some((c) => hits[c]) || !!hits['T' + act];
  }
  function axis() {
    let x = 0, z = 0;
    if (keys.KeyW || keys.ArrowUp) z += 1;
    if (keys.KeyS || keys.ArrowDown) z -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    x += touch.mx; z += touch.mz;
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }
  function look() {
    const s = HL.Settings.data.sens;
    let dx = mouse.dx * 0.0022 * s + touch.lookDX * 0.0055 * s;
    let dy = mouse.dy * 0.0022 * s + touch.lookDY * 0.0055 * s;
    mouse.dx = mouse.dy = 0; touch.lookDX = touch.lookDY = 0;
    if (HL.Settings.data.invertY) dy = -dy;
    return { dx, dy };
  }
  function wheel() { const w = mouse.wheel; mouse.wheel = 0; return w; }
  function endFrame() { for (const k in hits) delete hits[k]; }
  function reset() {
    for (const k in keys) keys[k] = false;
    for (const k in touch.held) touch.held[k] = false;
    mouse.b = [false, false, false]; mouse.dx = mouse.dy = 0; touch.lookDX = touch.lookDY = 0;
    document.querySelectorAll('#tbtns .tb.on').forEach((b) => b.classList.remove('on'));
    endFrame();
  }
  return {
    init, held, hit, axis, sim, look, wheel, endFrame, reset, lock, unlock, keys,
    set enabled(v) { enabled = v; if (!v) reset(); }, get enabled() { return enabled; },
    get locked() { return !!document.pointerLockElement && document.pointerLockElement === cv(); },
  };
})();
