'use strict';
// ============ Процедурная музыка и звуки (WebAudio, без файлов) ============
const Sound = (() => {
  let ctx = null, master, musicGain, sfxGain, ambGain, noiseBuf;
  const cfg = { musicVol: 0.6, sfxVol: 0.8, musicOn: true, sfxOn: true };
  let mode = 'menu', nextTime = 0, step = 0, chordIdx = 0, timer = null;
  let lastSfx = {};

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    ambGain = ctx.createGain(); ambGain.connect(sfxGain);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(scheduler, 60);
    startWind();
  }
  function apply() {
    if (!ctx) return;
    musicGain.gain.value = cfg.musicOn ? cfg.musicVol * 0.32 : 0;
    sfxGain.gain.value = cfg.sfxOn ? cfg.sfxVol * 0.9 : 0;
  }
  function set(o) { Object.assign(cfg, o); apply(); }
  function setMode(m) { if (m !== mode) { mode = m; step = 0; } }

  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  function tone(freq, t, dur, type, vol, dest, attack = 0.01, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || musicGain);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // Музыка: спокойная пентатоника днём / в меню, напряжённая — во время волны
  const PROG_CALM = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]; // Am F G Em
  const PROG_BATTLE = [[45, 48, 52], [41, 45, 48], [43, 47, 50], [44, 47, 52]];
  const PENTA = [0, 3, 5, 7, 10, 12, 15];
  function scheduler() {
    if (!ctx || ctx.state !== 'running') return;
    const battle = mode === 'battle';
    const stepDur = battle ? 0.17 : (mode === 'menu' ? 0.32 : 0.28);
    while (nextTime < ctx.currentTime + 0.35) {
      playStep(step, nextTime, stepDur, battle);
      nextTime += stepDur; step++;
    }
  }
  function playStep(s, t, sd, battle) {
    const prog = battle ? PROG_BATTLE : PROG_CALM;
    if (s % 16 === 0) {
      chordIdx = (s / 16) % prog.length;
      const ch = prog[chordIdx];
      ch.forEach((n, i) => {
        tone(mtof(n), t, sd * 16, 'triangle', battle ? 0.08 : 0.07, null, 0.6, i * 4);
        tone(mtof(n + 12), t, sd * 16, 'sine', 0.03, null, 1.2, -5);
      });
      tone(mtof(ch[0] - 12), t, sd * 8, 'sine', 0.12, null, 0.05);
    }
    if (s % 16 === 8) tone(mtof(prog[chordIdx][0] - 12), t, sd * 8, 'sine', 0.1, null, 0.05);
    const root = prog[chordIdx][0] + 12;
    if (battle) {
      if (s % 4 === 0) drum(t, 0.5);
      if (s % 8 === 4) snare(t);
      if (s % 2 === 0) tone(mtof(root + PENTA[(s * 3) % 5] - 12), t, sd * 1.5, 'square', 0.025, null);
    } else {
      // мелодичные "птичьи" ноты
      if ((s % 2 === 0 && Math.random() < 0.55) || s % 8 === 0) {
        const n = root + PENTA[Math.floor(Math.random() * PENTA.length)];
        tone(mtof(n), t, sd * 3, 'sine', 0.06, null, 0.02);
        tone(mtof(n + 12), t, sd * 2, 'triangle', 0.015, null, 0.02);
      }
    }
  }
  function drum(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.35);
  }
  function snare(t) { noise(t, 0.15, 0.12, 'highpass', 1500, musicGain); }
  function noise(t, dur, vol, ftype, freq, dest, q = 1) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return f;
  }

  // Атмосфера: ветер и пение птиц
  function startWind() {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(ambGain);
    s.start(); lfo.start();
    setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !cfg.sfxOn) return;
      if (Math.random() < (ambientNight ? 0.25 : 0.6)) ambientNight ? cricket() : chirp(0.05);
    }, 1400);
  }
  let ambientNight = false;
  function setNight(n) { ambientNight = n; }
  function cricket() {
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) tone(4200 + Math.random() * 200, t + i * 0.07, 0.04, 'square', 0.012, ambGain);
  }
  function chirp(vol = 0.08, base) {
    if (!ctx) return;
    const t = ctx.currentTime, f0 = base || 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), st = t + i * 0.11;
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.5), st + 0.06);
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(vol, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
      o.connect(g); g.connect(ambGain); o.start(st); o.stop(st + 0.1);
    }
  }

  // Звуковые эффекты
  function play(name, vol = 1) {
    if (!ctx || ctx.state !== 'running' || !cfg.sfxOn) return;
    const t = ctx.currentTime;
    if (lastSfx[name] && t - lastSfx[name] < 0.04) return;
    lastSfx[name] = t;
    switch (name) {
      case 'chop': noise(t, 0.12, 0.5 * vol, 'bandpass', 900, null, 2); tone(160, t, 0.12, 'sine', 0.3 * vol, sfxGain); break;
      case 'mine': tone(1800 + Math.random() * 400, t, 0.15, 'square', 0.06 * vol, sfxGain); noise(t, 0.08, 0.4 * vol, 'highpass', 2500, null); break;
      case 'hit': noise(t, 0.1, 0.4 * vol, 'lowpass', 1200, null); tone(220, t, 0.08, 'sawtooth', 0.08 * vol, sfxGain); break;
      case 'hurt': tone(300, t, 0.2, 'sawtooth', 0.12, sfxGain); tone(200, t + 0.05, 0.2, 'sawtooth', 0.1, sfxGain); break;
      case 'boom': {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.55);
        noise(t, 0.35, 0.35 * vol, 'lowpass', 700, null); break;
      }
      case 'arrow': noise(t, 0.12, 0.2 * vol, 'bandpass', 3000, null, 3); break;
      case 'build': tone(120, t, 0.2, 'sine', 0.4, sfxGain); noise(t, 0.15, 0.3, 'lowpass', 600, null); tone(523, t + 0.12, 0.2, 'triangle', 0.08, sfxGain); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.08, 0.3, 'triangle', 0.12, sfxGain)); break;
      case 'coin': tone(1318, t, 0.12, 'square', 0.05, sfxGain); tone(1760, t + 0.07, 0.18, 'square', 0.05, sfxGain); break;
      case 'pickup': tone(660, t, 0.08, 'triangle', 0.1, sfxGain); tone(880, t + 0.05, 0.1, 'triangle', 0.08, sfxGain); break;
      case 'click': tone(800, t, 0.05, 'triangle', 0.1, sfxGain); break;
      case 'error': tone(180, t, 0.15, 'square', 0.08, sfxGain); tone(150, t + 0.12, 0.2, 'square', 0.08, sfxGain); break;
      case 'growl': {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(60, t + 0.5);
        f.type = 'lowpass'; f.frequency.value = 500;
        g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.15 * vol, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.65); break;
      }
      case 'horn': {
        [0, 0.6].forEach(dt => {
          const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(196, t + dt); o.frequency.linearRampToValueAtTime(220, t + dt + 0.5);
          f.type = 'lowpass'; f.frequency.value = 900;
          g.gain.setValueAtTime(0.001, t + dt); g.gain.linearRampToValueAtTime(0.2, t + dt + 0.1); g.gain.linearRampToValueAtTime(0.001, t + dt + 0.55);
          o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t + dt); o.stop(t + dt + 0.6);
        });
        break;
      }
      case 'crumble': noise(t, 0.8, 0.5, 'lowpass', 400, null); tone(70, t, 0.6, 'sine', 0.3, sfxGain); break;
      case 'chirp': chirp(0.12); break;
      case 'win': [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'triangle', 0.12, sfxGain)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.25, 0.5, 'triangle', 0.14, sfxGain)); break;
    }
  }
  return { init, set, cfg, setMode, play, setNight, chirp };
})();
