// Синтезированный звук (никаких внешних файлов): эффекты, лазер, ветер, музыка
HL.Audio = (function () {
  let ctx = null, master, sfx, music, noiseBuf;
  let laser = null, wind = null, drone = null, seq = null, fireL = null;
  const S = () => HL.Settings.data;

  function init() {
    if (ctx) { resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    music = ctx.createGain(); music.connect(master);
    applyVolumes();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    resume();
  }
  function resume() { if (ctx && ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} } }

  // --- iPhone: без этого Web Audio молчит при беззвучном режиме и в некоторых WebView ---
  let silentEl = null, unlocked = false;
  function silentWav() {
    const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b[44 + i] = 128;
    let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    init();
    if (!ctx) return;
    resume();
    if (!unlocked) {
      // короткий пустой буфер внутри жеста пользователя
      try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) {}
      try {
        silentEl = document.createElement('audio');
        silentEl.setAttribute('playsinline', ''); silentEl.setAttribute('x-webkit-airplay', 'deny');
        silentEl.loop = true; silentEl.preload = 'auto'; silentEl.src = silentWav();
        const p = silentEl.play(); if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    } else if (silentEl && silentEl.paused) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
    if (ctx.state === 'running') unlocked = true;
  }
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach((ev) => addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && unlocked) { resume(); if (silentEl && silentEl.paused) silentEl.play().catch(() => {}); } });
  function applyVolumes() { if (!ctx) return; sfx.gain.value = S().sfx; music.gain.value = S().music * 0.95; }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  function burst(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.3;
    const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.5, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0), dur = o.dur || 0.2;
    const os = ctx.createOscillator(), g = ctx.createGain();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(o.dest || sfx);
    os.start(t); os.stop(t + dur + 0.05);
  }

  // --- непрерывный лазер ---
  function ensureLaser() {
    if (laser || !ctx) return;
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.6;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 150;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 153.5;
    const o3 = ctx.createOscillator(); o3.type = 'square'; o3.frequency.value = 75;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 13;
    const lg = ctx.createGain(); lg.gain.value = 380; lfo.connect(lg); lg.connect(f.frequency);
    const n = noiseSrc(); const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3500;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    n.connect(nf); nf.connect(ng); ng.connect(g);
    [o1, o2, o3].forEach((o) => o.connect(f));
    f.connect(g); g.connect(sfx);
    [o1, o2, o3, lfo, n].forEach((o) => o.start());
    laser = { g, o1, o2 };
  }
  function setLaser(on, rage) {
    if (!ctx) return;
    ensureLaser();
    const t = ctx.currentTime;
    laser.g.gain.setTargetAtTime(on ? 0.22 : 0, t, on ? 0.02 : 0.06);
    const base = rage ? 105 : 150;
    laser.o1.frequency.setTargetAtTime(base, t, 0.1);
    laser.o2.frequency.setTargetAtTime(base * 1.023, t, 0.1);
  }
  // --- ветер в полёте ---
  function setWind(v) {
    if (!ctx) return;
    if (!wind) {
      const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; g.gain.value = 0;
      n.connect(f); f.connect(g); g.connect(sfx); n.start();
      wind = { g, f };
    }
    const t = ctx.currentTime;
    wind.g.gain.setTargetAtTime(Math.min(0.35, v * 0.006), t, 0.15);
    wind.f.frequency.setTargetAtTime(350 + v * 18, t, 0.2);
  }

  // --- горение: гул пламени + шипение + треск; v = 0..1 (сколько огня рядом) ---
  function setFire(v, dt = 0.016) {
    if (!ctx) return;
    if (!fireL) {
      const mk = (type, f, q) => { const n = noiseSrc(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(sfx); n.start(0, Math.random() * 1.5); return { g, fl }; };
      fireL = { roar: mk('lowpass', 320, 0.7), body: mk('bandpass', 900, 0.6), hiss: mk('highpass', 3800, 0.5), lv: 0, flick: 1 };
    }
    const F = fireL, t = ctx.currentTime;
    F.lv += (v - F.lv) * Math.min(1, dt * 3);
    const lv = F.lv;
    if (Math.random() < dt * 6) F.flick = 0.65 + Math.random() * 0.6;      // пламя «дышит»
    F.roar.g.gain.setTargetAtTime(lv * 0.55 * F.flick, t, 0.12);
    F.roar.fl.frequency.setTargetAtTime(220 + 260 * F.flick, t, 0.2);
    F.body.g.gain.setTargetAtTime(lv * 0.09 * F.flick, t, 0.1);
    F.hiss.g.gain.setTargetAtTime(lv * 0.025, t, 0.2);
    if (lv < 0.02) return;
    // треск: щелчки древесины и лопающиеся угли
    const n = lv * dt * 34;
    for (let i = 0; i < 3; i++) if (Math.random() < n / 3) {
      const d = Math.random() * dt;
      burst({ dur: 0.012 + Math.random() * 0.03, type: 'bandpass', f: 1800 + Math.random() * 4500, q: 1.5 + Math.random() * 3, vol: (0.06 + Math.random() * 0.22) * Math.min(1, lv * 1.6), a: 0.001, delay: d });
      if (Math.random() < 0.25) burst({ dur: 0.008, type: 'highpass', f: 6000, vol: 0.12 * lv, a: 0.001, delay: d + 0.01 + Math.random() * 0.03 });
    }
    if (Math.random() < lv * dt * 1.2) burst({ dur: 0.6 + Math.random() * 0.5, type: 'lowpass', f: 500, f2: 150, vol: 0.35 * lv, a: 0.08 }); // «вздох» пламени
  }
  // --- взрыв: хлопок, удар, рокот, огненный выдох, падающие обломки; dist — расстояние до камеры ---
  function explosion(big = 1, dist = 0) {
    if (!ctx) return;
    const k = 1 / (1 + (dist / 70) ** 2), far = U01(dist / 160);
    const v = (x) => Math.max(0.0002, Math.min(1, x * k));
    const dl = Math.min(0.5, dist / 343);                                   // звук приходит позже вспышки
    const hf = 9000 * (1 - far * 0.85);                                     // издалека — глухо
    burst({ dur: 0.12, type: 'lowpass', f: hf, f2: 700, vol: v(1.0), a: 0.001, delay: dl });                         // хлопок
    burst({ dur: 1.0 * big + 0.3, type: 'lowpass', f: Math.min(hf, 2600), f2: 70, vol: v(0.95), a: 0.004, delay: dl }); // тело
    tone({ type: 'sine', f: 85, f2: 24, dur: 1.0 * big + 0.2, vol: v(1.0), a: 0.003, delay: dl });                    // удар в грудь
    tone({ type: 'triangle', f: 48, f2: 19, dur: 1.6 * big, vol: v(0.55), a: 0.01, delay: dl + 0.02 });
    burst({ dur: 2.4 * big + 0.8, type: 'lowpass', f: 420, f2: 35, vol: v(0.55), a: 0.18, delay: dl + 0.08 });        // раскатистый рокот
    burst({ dur: 1.1, type: 'bandpass', f: 280, f2: 950, q: 0.7, vol: v(0.3), a: 0.06, delay: dl + 0.04 });          // огненный выдох
    burst({ dur: 3.2 * big + 1, type: 'lowpass', f: 260, f2: 45, vol: v(0.4), a: 0.9, delay: dl + 0.3 });               // долгое эхо между домами
    tone({ type: 'sine', f: 38, f2: 26, dur: 2.6 * big, vol: v(0.3), a: 0.7, delay: dl + 0.3 });
    const deb = Math.round(5 + 6 * Math.min(2, big));
    for (let i = 0; i < deb; i++) {                                         // осыпающиеся обломки и стекло
      const d = dl + 0.25 + Math.random() * (0.9 + big * 0.6);
      burst({ dur: 0.03 + Math.random() * 0.09, type: 'bandpass', f: 900 + Math.random() * (far > 0.5 ? 1500 : 5000), q: 1 + Math.random() * 4, vol: v(0.08 + Math.random() * 0.2), a: 0.001, delay: d });
      if (Math.random() < 0.3 && far < 0.5) tone({ type: 'triangle', f: 2400 + Math.random() * 2500, dur: 0.08, vol: v(0.03), delay: d });
    }
  }
  function U01(x) { return Math.max(0, Math.min(1, x)); }

  // --- музыка ---
  function stopMusic() {
    if (drone) { const t = ctx.currentTime; drone.g.gain.setTargetAtTime(0, t, 0.4); const d = drone; setTimeout(() => d.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), 2000); drone = null; }
    if (seq) { clearInterval(seq.timer); seq = null; }
  }
  function menuMusic() {
    if (!ctx) return;
    stopMusic();
    const g = ctx.createGain(); g.gain.value = 0; g.connect(music);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g);
    const nodes = [];
    [[55, 'sawtooth', 0.2], [55.4, 'sawtooth', 0.2], [82.4, 'triangle', 0.25], [110, 'triangle', 0.22], [164.8, 'sine', 0.1], [220.5, 'sine', 0.05]].forEach(([fr, ty, v]) => {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = fr;
      const og = ctx.createGain(); og.gain.value = v; o.connect(og); og.connect(f); o.start(); nodes.push(o);
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 200; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); nodes.push(lfo);
    const n = noiseSrc(); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 0.4;
    const ng = ctx.createGain(); ng.gain.value = 0.06; n.connect(nf); nf.connect(ng); ng.connect(g); n.start(); nodes.push(n);
    g.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
    drone = { g, nodes };
    // редкий тяжёлый удар сердца
    let beat = 0;
    seq = { timer: setInterval(() => { beat++; if (beat % 2 === 0) heartbeat(0.5); }, 1700) };
  }
  // простая тёмная "боевая" музыка: бас-остинато + пульс
  const SCALE = [0, 3, 5, 7, 8, 10, 12];
  function gameMusic(mood) {
    if (!ctx) return;
    stopMusic();
    const bpm = mood === 'boss' ? 132 : 104;
    const stepDur = 60 / bpm / 2;
    const root = mood === 'boss' ? 41.2 : 43.65; // E1 / F1
    const pattern = mood === 'boss' ? [0, 0, 3, 0, 5, 0, 3, 6] : [0, 0, 0, 3, 0, 0, 5, 4];
    let step = 0, next = ctx.currentTime + 0.1;
    const out = ctx.createGain(); out.gain.value = 0.0; out.connect(music);
    out.gain.setTargetAtTime(mood === 'calm' ? 0.35 : 0.55, ctx.currentTime, 1);
    const tick = () => {
      while (next < ctx.currentTime + 0.25) {
        const deg = pattern[step % pattern.length];
        const fr = root * Math.pow(2, SCALE[deg] / 12) * 2;
        tone({ type: 'sawtooth', f: fr, dur: stepDur * 0.9, vol: 0.22, dest: out, delay: next - ctx.currentTime });
        tone({ type: 'sine', f: fr / 2, dur: stepDur * 0.9, vol: 0.3, dest: out, delay: next - ctx.currentTime });
        if (mood !== 'calm' && step % 2 === 1) burst({ type: 'highpass', f: 7000, dur: 0.04, vol: 0.12, dest: out, delay: next - ctx.currentTime });
        if (step % 8 === 0) burst({ type: 'lowpass', f: 140, f2: 40, dur: 0.25, vol: 0.6, dest: out, delay: next - ctx.currentTime });
        if (step % 16 === 8 && mood !== 'calm') tone({ type: 'triangle', f: fr * 4, dur: stepDur * 6, vol: 0.06, dest: out, delay: next - ctx.currentTime, a: 0.3 });
        next += stepDur; step++;
      }
    };
    seq = { timer: setInterval(tick, 40) };
    drone = { g: out, nodes: [] };
  }

  function heartbeat(v = 0.4) {
    burst({ type: 'lowpass', f: 500, f2: 120, dur: 0.14, vol: v * 0.7 });
    burst({ type: 'lowpass', f: 450, f2: 110, dur: 0.15, vol: v * 0.55, delay: 0.22 });
    tone({ type: 'sine', f: 62, f2: 38, dur: 0.16, vol: v });
    tone({ type: 'sine', f: 58, f2: 36, dur: 0.18, vol: v * 0.8, delay: 0.22 });
  }

  return {
    init, resume, unlock, applyVolumes, setLaser, setWind, setFire, explosion, menuMusic, gameMusic, stopMusic,
    get ready() { return !!ctx; },
    click() { tone({ type: 'square', f: 520, f2: 760, dur: 0.05, vol: 0.06 }); },
    punch() { burst({ dur: 0.2, f: 1200, f2: 120, vol: 0.9 }); tone({ type: 'sine', f: 150, f2: 40, dur: 0.22, vol: 0.8 }); },
    whiff() { burst({ dur: 0.18, type: 'bandpass', f: 600, f2: 2000, q: 2, vol: 0.25, a: 0.05 }); },
    shot() { burst({ dur: 0.09, type: 'bandpass', f: 2200, q: 0.8, vol: 0.32 }); },
    heavyShot() { burst({ dur: 0.18, type: 'bandpass', f: 1100, q: 0.7, vol: 0.5 }); tone({ type: 'square', f: 170, f2: 60, dur: 0.12, vol: 0.12 }); },
    slam() { burst({ dur: 0.7, f: 900, f2: 40, vol: 1 }); tone({ type: 'sine', f: 70, f2: 22, dur: 0.8, vol: 1 }); },
    hurt() { tone({ type: 'sawtooth', f: 200, f2: 80, dur: 0.14, vol: 0.18 }); },
    whoosh() { burst({ dur: 0.55, type: 'bandpass', f: 250, f2: 2200, q: 1.4, vol: 0.4, a: 0.15 }); },
    pickup() { tone({ type: 'triangle', f: 500, f2: 1000, dur: 0.15, vol: 0.2 }); },
    success() { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.35, vol: 0.18, delay: i * 0.09 })); },
    objective() { [660, 990].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.25, vol: 0.14, delay: i * 0.08 })); },
    fail() { [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', f, dur: 0.4, vol: 0.12, delay: i * 0.16 })); },
    alarm() { for (let i = 0; i < 3; i++) tone({ type: 'square', f: 880, f2: 600, dur: 0.25, vol: 0.08, delay: i * 0.3 }); },
    phone() { for (let i = 0; i < 6; i++) tone({ type: 'square', f: i % 2 ? 1300 : 1600, dur: 0.07, vol: 0.06, delay: i * 0.08 }); },
    cheer() { burst({ dur: 1.6, type: 'bandpass', f: 1400, q: 0.4, vol: 0.28, a: 0.3 }); burst({ dur: 1.2, type: 'bandpass', f: 2600, q: 0.6, vol: 0.12, a: 0.2, delay: 0.15 }); },
    boo() { tone({ type: 'sawtooth', f: 160, f2: 120, dur: 0.9, vol: 0.08, a: 0.2 }); burst({ dur: 1, type: 'bandpass', f: 500, q: 0.5, vol: 0.15, a: 0.3 }); },
    charge(d = 1.6) { tone({ type: 'sawtooth', f: 70, f2: 900, dur: d, vol: 0.15, a: d * 0.8 }); burst({ dur: d, type: 'bandpass', f: 200, f2: 3000, q: 3, vol: 0.15, a: d * 0.9 }); },
    blast() { burst({ dur: 1.4, f: 3000, f2: 200, vol: 0.9 }); tone({ type: 'sawtooth', f: 120, f2: 40, dur: 1.2, vol: 0.4 }); },
    shield() { tone({ type: 'triangle', f: 1400, f2: 500, dur: 0.3, vol: 0.12 }); burst({ dur: 0.25, type: 'highpass', f: 4000, vol: 0.15 }); },
    clang() { tone({ type: 'square', f: 1900, f2: 1500, dur: 0.25, vol: 0.1 }); tone({ type: 'triangle', f: 2600, dur: 0.4, vol: 0.08 }); },
    flash() { // гудение лампы в главном меню
      tone({ type: 'sawtooth', f: 100, dur: 0.55, vol: 0.05, a: 0.02 });
      tone({ type: 'square', f: 50, dur: 0.55, vol: 0.04, a: 0.02 });
      burst({ dur: 0.1, type: 'highpass', f: 4000, vol: 0.12 });
      burst({ dur: 0.08, type: 'highpass', f: 5000, vol: 0.08, delay: 0.18 });
    },
    stinger() { tone({ type: 'sawtooth', f: 55, dur: 1.8, vol: 0.3, a: 0.01 }); tone({ type: 'sawtooth', f: 58.3, dur: 1.8, vol: 0.25 }); burst({ dur: 1.5, f: 600, f2: 60, vol: 0.5 }); },
    heartbeat,
    sonic() { // хлопок звукового барьера: двойной удар + гул
      burst({ dur: 0.35, f: 5000, f2: 300, vol: 1 }); tone({ type: 'sine', f: 90, f2: 28, dur: 0.5, vol: 1 });
      burst({ dur: 0.4, f: 4000, f2: 200, vol: 0.9, delay: 0.12 }); tone({ type: 'sine', f: 70, f2: 22, dur: 0.6, vol: 0.9, delay: 0.12 });
      burst({ dur: 2.6, type: 'lowpass', f: 900, f2: 60, vol: 0.6, a: 0.05, delay: 0.25 }); tone({ type: 'sawtooth', f: 45, f2: 25, dur: 2.2, vol: 0.25, delay: 0.25 });
    },
    roar() { // рык Хоумлендера
      tone({ type: 'sawtooth', f: 95, f2: 48, dur: 2.2, vol: 0.55, a: 0.08 }); tone({ type: 'square', f: 140, f2: 70, dur: 1.9, vol: 0.18, a: 0.1 });
      burst({ dur: 2.0, type: 'lowpass', f: 900, f2: 140, vol: 0.7, a: 0.1 }); burst({ dur: 1.4, type: 'bandpass', f: 400, f2: 1600, q: 1.5, vol: 0.35, a: 0.2 });
    },
    static() { burst({ dur: 1.4, type: 'highpass', f: 2500, vol: 0.35, a: 0.01 }); tone({ type: 'square', f: 1000, dur: 0.9, vol: 0.05, delay: 0.1 }); },
    beep() { tone({ type: 'square', f: 880, dur: 0.12, vol: 0.08 }); },
    go() { tone({ type: 'square', f: 1320, dur: 0.35, vol: 0.1 }); },
  };
})();
