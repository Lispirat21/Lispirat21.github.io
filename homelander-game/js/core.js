// Общие утилиты и пространство имён
window.HL = window.HL || {};
(function () {
  const PI2 = Math.PI * 2;
  HL.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    damp: (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt)),
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (a) => a[(Math.random() * a.length) | 0],
    angDiff(a, b) {
      let d = (b - a) % PI2;
      if (d > Math.PI) d -= PI2;
      if (d < -Math.PI) d += PI2;
      return d;
    },
    dampAng(a, b, l, dt) { return a + HL.U.angDiff(a, b) * (1 - Math.exp(-l * dt)); },
    seeded(seed) {
      let s = seed >>> 0;
      return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    fmtTime(s) {
      s = Math.max(0, Math.ceil(s));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    dist2D(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); },
  };
  HL.$ = (id) => document.getElementById(id);
})();
