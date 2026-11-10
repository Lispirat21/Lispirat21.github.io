// Настройки графики/управления/звука (сохраняются в localStorage)
(function () {
  const KEY = 'hlgame_settings_v1';
  const isMobile = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const PRESETS = {
    low:    { renderScale: 0.6, shadows: 0, antialias: false, drawDist: 0, crowd: 0, outlines: false, particles: 0, details: 0 },
    medium: { renderScale: 0.8, shadows: 1, antialias: false, drawDist: 1, crowd: 1, outlines: true,  particles: 1, details: 1 },
    high:   { renderScale: 1.0, shadows: 2, antialias: true,  drawDist: 2, crowd: 2, outlines: true,  particles: 2, details: 2 },
    ultra:  { renderScale: 1.0, shadows: 3, antialias: true,  drawDist: 3, crowd: 3, outlines: true,  particles: 3, details: 2 },
  };
  const basePreset = isMobile ? 'medium' : 'high';
  const DEFAULTS = Object.assign({
    preset: basePreset,
    fov: 70, showFps: false, sens: 1, invertY: false, camDist: 7,
    music: 0.55, sfx: 0.85, shake: true, captions: true,
    controls: 'auto', // auto | pc | touch
    maxPixelRatio: isMobile ? 2 : 2,
  }, PRESETS[basePreset]);

  const S = {
    isMobile, PRESETS,
    data: Object.assign({}, DEFAULTS),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) Object.assign(this.data, JSON.parse(raw));
      } catch (e) { /* приватный режим */ }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
    setPreset(p) {
      this.data.preset = p;
      Object.assign(this.data, PRESETS[p]);
    },
    // если параметр изменён вручную — пресет "своё"
    markCustom() {
      const p = PRESETS[this.data.preset];
      if (!p) return;
      for (const k in p) if (p[k] !== this.data[k]) { this.data.preset = 'custom'; return; }
    },
    reset() { this.data = Object.assign({}, DEFAULTS); this.save(); },
    get drawDistance() { return [170, 260, 400, 620][this.data.drawDist]; },
    get crowdCount() { return [14, 30, 55, 85][this.data.crowd]; },
    get trafficCount() { return [4, 9, 16, 24][this.data.crowd]; },
    get particleMax() { return [250, 600, 1200, 2200][this.data.particles]; },
    get shadowSize() { return [0, 1024, 2048, 4096][this.data.shadows]; },
    get useTouch() {
      const c = this.data.controls;
      return c === 'touch' || (c === 'auto' && isMobile);
    },
  };
  S.load();
  HL.Settings = S;

  // Прогресс сюжета
  const PKEY = 'hlgame_progress_v1';
  HL.Progress = {
    data: { unlocked: 1, done: {}, ending: null },
    load() { try { const r = localStorage.getItem(PKEY); if (r) Object.assign(this.data, JSON.parse(r)); } catch (e) {} },
    save() { try { localStorage.setItem(PKEY, JSON.stringify(this.data)); } catch (e) {} },
    complete(idx, stats) {
      const d = this.data;
      d.done[idx] = stats;
      d.unlocked = Math.max(d.unlocked, idx + 2);
      this.save();
    },
    reset() { this.data = { unlocked: 1, done: {}, ending: null }; this.save(); },
  };
  HL.Progress.load();
})();
