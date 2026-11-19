// Fully synthesized audio (no external files): ambient music + combat SFX.
export class Audio {
  constructor() { this.ctx = null; this.music = 0.6; this.sfx = 0.8; this.mode = null; }

  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.mBus = this.ctx.createGain(); this.mBus.connect(this.master);
    this.sBus = this.ctx.createGain(); this.sBus.connect(this.master);
    this.setVolumes(this.music, this.sfx);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startMusic();
    if (this.mode) this.setMode(this.mode);
  }

  setVolumes(m, s) {
    this.music = m; this.sfx = s;
    if (!this.ctx) return;
    this.mBus.gain.setTargetAtTime(m * 0.5, this.ctx.currentTime, 0.1);
    this.sBus.gain.setTargetAtTime(s, this.ctx.currentTime, 0.05);
  }

  _startMusic() {
    const c = this.ctx;
    this.drone = c.createGain(); this.drone.gain.value = 0; this.drone.connect(this.mBus);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6; lp.connect(this.drone);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    for (const [f, type, g] of [[43.65, 'sawtooth', 0.22], [43.9, 'sawtooth', 0.22], [65.4, 'triangle', 0.18], [87.3, 'sine', 0.1], [130.8, 'sine', 0.03]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const gg = c.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start();
    }
    this.pulse = c.createGain(); this.pulse.gain.value = 0; this.pulse.connect(this.mBus);
    this.step = 0;
    this.nextT = c.currentTime + 0.1;
    setInterval(() => this._sched(), 50);
  }

  _sched() {
    const c = this.ctx;
    while (this.nextT < c.currentTime + 0.2) {
      const t = this.nextT, s = this.step % 16;
      if (this.mode === 'game') {
        if (s % 4 === 0) this._kick(t, 0.55);
        if (s % 8 === 4) this._hat(t, 0.12, 2200);
        if (s % 2 === 1) this._hat(t, 0.04, 7000);
        if ([0, 3, 6, 10].includes(s)) this._bass(t, [43.65, 43.65, 51.9, 38.9][(this.step >> 4) % 4]);
      } else if (this.mode === 'menu') {
        if (s === 0 && (this.step >> 4) % 2 === 0) this._kick(t, 0.25);
        if (s === 8) this._ping(t);
      }
      this.step++;
      this.nextT += 60 / 96 / 4;
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.drone.gain.setTargetAtTime(mode === 'menu' ? 0.9 : mode === 'game' ? 0.45 : 0.2, t, 0.8);
  }

  _env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  _kick(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    this._env(g, t, 0.005, v, 0.35); o.connect(g); g.connect(this.mBus); o.start(t); o.stop(t + 0.5);
  }
  _hat(t, v, f) {
    const c = this.ctx, n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noiseBuf; hp.type = 'highpass'; hp.frequency.value = f;
    this._env(g, t, 0.002, v, 0.06); n.connect(hp); hp.connect(g); g.connect(this.mBus); n.start(t); n.stop(t + 0.1);
  }
  _bass(t, f) {
    const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f * 2; lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.2);
    this._env(g, t, 0.01, 0.22, 0.22); o.connect(lp); lp.connect(g); g.connect(this.mBus); o.start(t); o.stop(t + 0.3);
  }
  _ping(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 523.25 * (Math.random() < 0.5 ? 1 : 0.75);
    this._env(g, t, 0.01, 0.05, 2.5); o.connect(g); g.connect(this.mBus); o.start(t); o.stop(t + 2.6);
  }

  play(name) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const noise = (dur, f0, f1, v, type = 'lowpass') => {
      const n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this._env(g, t, 0.004, v, dur); n.connect(fl); fl.connect(g); g.connect(this.sBus); n.start(t); n.stop(t + dur + 0.05);
    };
    const tone = (type, f0, f1, dur, v) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      this._env(g, t, 0.004, v, dur); o.connect(g); g.connect(this.sBus); o.start(t); o.stop(t + dur + 0.05);
    };
    switch (name) {
      case 'punch': noise(0.12, 3000, 300, 0.5); tone('sine', 160, 50, 0.15, 0.6); break;
      case 'whoosh': noise(0.18, 600, 2400, 0.12, 'bandpass'); break;
      case 'blast': tone('sawtooth', 880, 110, 0.25, 0.18); tone('sine', 1400, 300, 0.2, 0.2); noise(0.15, 5000, 800, 0.12); break;
      case 'ebolt': tone('square', 600, 300, 0.12, 0.05); break;
      case 'hit': noise(0.1, 2000, 400, 0.35); tone('triangle', 300, 120, 0.1, 0.25); break;
      case 'hurt': tone('sawtooth', 140, 60, 0.3, 0.3); noise(0.2, 1500, 200, 0.3); break;
      case 'boom': noise(0.9, 1800, 60, 0.8); tone('sine', 90, 30, 0.8, 0.7); break;
      case 'dash': noise(0.25, 300, 3000, 0.25, 'bandpass'); break;
      case 'fly': tone('sine', 120, 260, 0.6, 0.2); noise(0.6, 400, 1600, 0.12, 'bandpass'); break;
      case 'pickup': tone('sine', 660, 1320, 0.25, 0.2); break;
      case 'ui': tone('sine', 900, 1200, 0.06, 0.08); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.ctx && this._ping(this.ctx.currentTime), i * 150)); break;
    }
  }
}
