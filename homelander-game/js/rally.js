// Миссия «Митинг» (3 сезон): речь перед толпой, протестующий с банкой — и выбор.
HL.Rally = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const STAGE = V(0, 1.4, -197);   // сцена на площади
  const cut = (g, pos, look) => { g.camOverride = { pos: pos.clone(), look: look.clone(), snap: true }; };
  const cam = (g, pos, look, rate = 4) => { g.camOverride = { pos: pos.clone(), look: look.clone(), rate }; };
  function chain(g, v, lines, shots, done) {
    let i = 0;
    const next = () => { if (i >= lines.length) { done && done(); return; } if (shots && shots[i]) v.shot = shots[i](); g.ui.say([lines[i]], next); i++; };
    next();
  }

  function buildStage(g) {
    const grp = new T.Group(); g.scene.add(grp);
    const mk = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; grp.add(m); return m; };
    mk(M.box(18, 1.4, 8), M.toon(0x1a1c24), 0, 0.7, -197);
    mk(M.box(18.2, 0.12, 8.2), M.toon(0xc22a33), 0, 1.42, -197);
    const scr = M.canvasTex(1024, 448, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d2a7a'); gr.addColorStop(1, '#050a1e'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(194,42,51,.25)'; x.fillRect(0, (i * h) / 13, w, h / 13); }
      x.fillStyle = '#ffd24a'; x.font = 'bold 150px Impact, Arial Black'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('HOMELANDER', w / 2, h * 0.45);
      x.fillStyle = '#fff'; x.font = 'bold 44px Arial'; x.fillText('ОН ЗАЩИЩАЕТ НАС. МЫ ЗАЩИЩАЕМ ЕГО.', w / 2, h * 0.78);
    });
    const screen = new T.Mesh(new T.PlaneGeometry(20, 8.75), new T.MeshBasicMaterial({ map: scr, fog: false })); screen.position.set(0, 7.2, -201.2); grp.add(screen);
    mk(M.box(21, 10, 0.5), M.toon(0x111318), 0, 6.6, -201.6);
    for (const x of [-11, 11]) { mk(M.box(1.2, 13, 1.2), M.toon(0x3a3d44), x, 6.5, -199); mk(M.box(2.4, 3.2, 1.8), M.toon(0x16171c), x * 1.18, 1.6, -194.5); }
    mk(M.box(1.2, 1.3, 0.8), M.toon(0x2a2c34), 0, 2.05, -195.2); // трибуна
    const seal = mk(M.cyl(0.35, 0.35, 0.05, 16), M.toon(0xd8b04a), 0, 2.3, -194.78); seal.rotation.x = Math.PI / 2;
    // флаги вдоль сцены
    const flag = M.canvasTex(192, 100, (x, w, h) => { for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#fff' : '#c22a33'; x.fillRect(0, (i * h) / 13, w, h / 13 + 1); } x.fillStyle = '#2a3a7a'; x.fillRect(0, 0, w * 0.42, h * 0.54); });
    for (const x of [-16, -13, 13, 16]) { mk(M.cyl(0.06, 0.06, 7, 6), M.toon(0xd8d8d8), x, 3.5, -196); const f = new T.Mesh(new T.PlaneGeometry(2.4, 1.3), new T.MeshBasicMaterial({ map: flag, side: T.DoubleSide })); f.position.set(x + 1.25, 6.2, -196); grp.add(f); }
    g.world.addBox(-9, -201, 9, -193, 1.4, 'stage');
    g.world.addBox(-10.6, -202, 10.6, -201.1, 11.6, 'stagewall'); // задник: камера не залезает внутрь
    return grp;
  }
  const SIGNS = ['МЫ ЛЮБИМ ТЕБЯ, ХОУМЛЕНДЕР', 'АМЕРИКА — ЭТО ОН', 'ТОЛЬКО ХОУМЛЕНДЕР', 'ВЕРНЫЕ ДО КОНЦА', 'СПАСИБО, ГЕРОЙ!', 'ХОУМЛЕНДЕР 2028'];
  function signMesh(text, red) {
    const t = M.canvasTex(256, 140, (x, w, h) => {
      x.fillStyle = red ? '#ffffff' : '#fdf6dc'; x.fillRect(0, 0, w, h); x.strokeStyle = red ? '#c22a33' : '#1f3f8f'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
      x.fillStyle = red ? '#c22a33' : '#1f3f8f'; x.font = 'bold 34px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const words = text.split(' '), lines = []; let cur = '';
      for (const w2 of words) { if ((cur + ' ' + w2).trim().length > 12) { lines.push(cur.trim()); cur = w2; } else cur += ' ' + w2; } lines.push(cur.trim());
      lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 38));
    });
    const grp = new T.Group();
    const pole = new T.Mesh(M.cyl(0.025, 0.025, 0.9, 5), M.toon(0x8a6a40)); pole.position.y = -0.1; grp.add(pole);
    const s = new T.Mesh(new T.PlaneGeometry(0.95, 0.52), new T.MeshBasicMaterial({ map: t, side: T.DoubleSide })); s.position.y = 0.5; grp.add(s);
    return grp;
  }
  // толпа
  function spawnCrowd(g, v) {
    v.crowd = [];
    for (let i = 0; i < 52; i++) {
      const row = Math.floor(i / 13), x = -22 + (i % 13) * 3.6 + U.rand(-1, 1), z = -188 + row * 4.2 + U.rand(-1, 1);
      if (Math.abs(x - 3) < 1.6 && row === 0) continue;
      const a = g.spawn('civ', x, z, { stay: true });
      a.cheerPh = Math.random() * 6;
      a.think = function (dt) { this.stop(dt); this.face(STAGE, dt, 5); const m = v.mood; this.anim = m === 'cheer' ? (Math.sin(g.time * 3 + this.cheerPh) > -0.2 ? 'cheer' : 'idle') : m === 'shock' ? 'idle' : m === 'fear' ? 'scared' : 'idle'; this.animOpt = {}; };
      if (i % 4 === 0) { const sg = signMesh(SIGNS[(i / 4) % SIGNS.length]); sg.position.set(0, -0.55, 0.05); sg.rotation.x = Math.PI; a.c.elbowR.add(sg); }
      v.crowd.push(a);
    }
    // протестующий в первом ряду
    const def = Object.assign(M.randomCivDef(), { torso: 0xb02020, arms: 0xb02020, forearms: 0xb02020, simple: true });
    const p = g.spawn('civ', 3, -188.5, { def, stay: true }); v.prot = p; p.name = 'Протестующий';
    p.think = function (dt) { this.stop(dt); this.face(STAGE, dt, 5); this.anim = v.protAnim || 'idle'; this.animOpt = v.protOpt || {}; };
    const sg = signMesh('ТЫ УБИЙЦА', true); sg.position.set(0, -0.55, 0.05); sg.rotation.x = Math.PI; p.c.elbowR.add(sg);
  }
  const confetti = (g, n = 30) => { for (let i = 0; i < n; i++) g.fx.burst(V(U.rand(-20, 20), 16, U.rand(-195, -165)), 1, { color: [0xc22a33, 0xffffff, 0x2a52b0, 0xffd24a], speed: 2, size: 0.18, life: 3, g: -3, drag: 1.2 }); };

  // ---------- 1. Речь ----------
  const speechStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      v.mood = 'cheer'; v.e = { ev: 0, T: 0, beat: 0 };
      P.place(0, 45, -197, 0); P.flying = true; P.scriptVel = V(0, 0, 0);
      g.cinema(V(0, 20, -150), STAGE);
      cut(g, V(-30, 24, -150), V(0, 2, -185));
      g.ui.caption('МИТИНГ В ПОДДЕРЖКУ ХОУМЛЕНДЕРА', 0.4);
      g.ui.say([['crowd', 'ХО-УМ-ЛЕН-ДЕР! ХО-УМ-ЛЕН-ДЕР!', 3]]);
    },
    update(g, dt, v) {
      const e = v.e, P = g.player; e.T += dt; e.beat -= dt;
      if (v.mood === 'cheer' && e.beat <= 0) { e.beat = 1.6; A().cheer(); }
      if (e.ev === 0) { // дрон над толпой
        const k = Math.min(1, e.T / 4.5);
        cam(g, V(-30 + k * 26, 24 - k * 14, -150 - k * 18), V(0, 2 + k * 3, -185 - k * 10), 2);
        if (e.T > 4.5) { e.ev = 1; e.T = 0; P.scriptVel = V(0, -26, 0); A().whoosh(); }
      } else if (e.ev === 1) { // Хоумлендер спускается на сцену
        cam(g, V(6, 2.2, -184), P.center, 4);
        if (P.pos.y <= 1.5 || e.T > 2.5) {
          P.scriptVel = null; P.flying = false; P.place(0, 1.4, -194.2, 0); P.scriptPose = 'akimbo';
          g.fx.dust(P.pos, 16); g.fx.ring(P.pos.clone().setY(1.5), 0xffffff, 8, 0.4); A().slam(); A().cheer(); confetti(g, 40);
          e.ev = 2; e.T = 0;
          const hero = () => ({ pos: V(1.7, 1.3, -189.6), look: P.center.add(V(0, 0.55, 0)) }), crowdShot = () => ({ pos: V(-4, 3.2, -194), look: V(4, 1.2, -176) });
          chain(g, v, [
            ['hl', 'Они говорят, что я опасен.', 2.2],
            ['hl', 'Что я угроза. Что меня нужно остановить.', 2.6],
            ['crowd', 'У-у-у!', 1.2],
            ['hl', 'Но знаете что? Я — единственное, что стоит между вами и хаосом.', 3.2],
            ['hl', 'Я не ваш слуга. Я — ваш защитник. Я — ваш Хоумлендер!', 3],
          ], [hero, hero, crowdShot, hero, crowdShot], () => { e.ev = 3; e.T = 0; confetti(g, 50); A().cheer(); });
        }
      } else if (e.ev === 2) {
        if (v.shot) cam(g, v.shot.pos, v.shot.look, 3);
      } else if (e.ev === 3) { // протестующий
        if (e.T < dt * 1.5) {
          v.protAnim = 'wave';
          chain(g, v, [['prot', 'Ты убийца! Сколько ещё людей ты бросишь умирать?!', 2.6]], [() => ({ pos: v.prot.center.add(V(-1.4, 0.4, 2.2)), look: v.prot.center.add(V(0, 0.4, 0)) })], () => { e.ev = 4; e.T = 0; });
        }
        if (v.shot) cam(g, v.shot.pos, v.shot.look, 4);
      } else if (e.ev === 4) { // бросает банку
        if (e.T < dt * 1.5) {
          v.protAnim = 'throw'; v.protOpt = { p: 0.8 };
          const can = new T.Mesh(M.cyl(0.07, 0.07, 0.22, 10), M.toon(0xc8c8d0)); g.scene.add(can); v.can = { m: can, from: v.prot.center.add(V(0.2, 0.6, 0)), to: P.center.add(V(0, 0.3, 0.3)) };
          A().whoosh();
        }
        const c = v.can, k = Math.min(1, e.T / 0.8);
        c.m.position.lerpVectors(c.from, c.to, k); c.m.position.y += Math.sin(k * Math.PI) * 2.5; c.m.rotation.x += dt * 12; c.m.rotation.z += dt * 8;
        cam(g, V(-2.5, 2.4, -186), c.m.position.clone().lerp(P.center, 0.4), 4);
        if (k >= 1) {
          g.scene.remove(c.m); v.mood = 'shock'; g.music(null);
          g.fx.burst(c.to, 26, { color: [0x8a4a1a, 0xc87a30, 0xffffff], speed: 5, size: 0.12, life: 0.7, g: -14 }); A().punch();
          P.scriptPose = null; e.ev = 5; e.T = 0;
          g.ui.say([['sys', '*тишина*', 1.6]]); A().heartbeat(0.7);
        }
      } else if (e.ev === 5) { // медленный наезд на лицо
        P.scriptFace = Math.atan2(v.prot.pos.x - P.pos.x, v.prot.pos.z - P.pos.z);
        const head = P.center.add(V(0, 0.6, 0)), k = Math.min(1, e.T / 3);
        cam(g, head.clone().add(V(0.4 - k * 0.2, 0.1, 3.8 - k * 2.6)), head, 2.5);
        if (Math.floor(e.T / 0.9) !== Math.floor((e.T - dt) / 0.9)) A().heartbeat(0.6);
        if (e.T > 3.2) return true;
      }
      return false;
    },
    exit(g, v) { g.cinema(null); g.camYaw = Math.atan2(v.prot.pos.x - g.player.pos.x, v.prot.pos.z - g.player.pos.z); g.camPitch = 0.25; },
  };

  // ---------- 2. Выбор игрока ----------
  const choiceStep = {
    text: 'Накажите его — или сдержитесь',
    enter(g, v) {
      v.t = 9; v.prot.hp = 30;
      g.ui.tag('ВСЕ СМОТРЯТ НА ВАС', '#ff9a8a', 2.5);
      g.ui.hint('Лазер по протестующему — или просто ждите, чтобы сдержаться', 6);
    },
    update(g, dt, v) {
      v.t -= dt;
      g.ui.el.oText.textContent = `Накажите его — или сдержитесь (${Math.ceil(Math.max(0, v.t))})`;
      if (!v.prot.alive) { v.killed = true; return true; }
      return v.t <= 0;
    },
    wp: (g, v) => v.prot.alive && v.prot.center,
  };

  // ---------- 3. Реакция толпы ----------
  const reactStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      g.cinema(P.center, STAGE); P.scriptVel = null; P.flying = false; P.place(0, 1.4, -194.2, 0); P.scriptFace = 0;
      v.e = { ev: 0, T: 0, beat: 0 };
      if (v.killed) {
        v.mood = 'shock';
        cut(g, V(-6, 2.0, -183), V(2, 1.5, -190));
      } else {
        chain(g, v, [['hl', '…Свобода слова. Пусть говорит.', 2.2], ['prot', '*отступает и исчезает в толпе*', 1.6]], null, () => { v.mood = 'cheer'; A().cheer(); g.changeApproval(3, 'Сдержался'); v.e.done = true; });
        cut(g, P.center.add(V(1.2, 0.3, 3.2)), P.center.add(V(0, 0.6, 0)));
      }
    },
    update(g, dt, v) {
      const e = v.e, P = g.player; e.T += dt; e.beat -= dt;
      if (v.mood === 'cheer' && e.beat <= 0) { e.beat = 1.2; A().cheer(); }
      if (!v.killed) {
        if (v.prot && v.prot.alive && e.T > 2) v.prot.remove();
        cam(g, P.center.add(V(1.2, 0.3, 3.2)), P.center.add(V(0, 0.6, 0)), 3);
        return !!e.done && e.T > 1;
      }
      // убил — тишина… и толпа взрывается аплодисментами
      if (e.ev === 0) {
        cam(g, V(-6, 2.0, -183), V(2, 1.5, -190), 2);
        if (e.T > 1.6) { e.ev = 1; e.T = 0; A().punch(); g.ui.say([['sys', '*кто-то в толпе начинает хлопать*', 1.8]]); }
      } else if (e.ev === 1) {
        if (Math.random() < dt * 6) HL.Audio.click(); // одинокие хлопки
        cam(g, V(-3, 2.6, -178), V(0, 1.6, -186), 2);
        if (e.T > 2) { e.ev = 2; e.T = 0; v.mood = 'cheer'; confetti(g, 60); g.changeApproval(8, 'Толпа в восторге');
          chain(g, v, [['crowd', 'ХО-УМ-ЛЕН-ДЕР! ХО-УМ-ЛЕН-ДЕР!', 2.4], ['ash', '*по рации* О боже… Они… они аплодируют?', 2.6], ['hl', '*медленно улыбается*', 1.8]],
            [() => ({ pos: V(5, 3, -170), look: V(0, 1.5, -186) }), () => ({ pos: P.center.add(V(0.8, 0.2, 2.4)), look: P.center.add(V(0, 0.6, 0)) }), () => ({ pos: P.center.add(V(0.3, 0.3, 1.6)), look: P.center.add(V(0, 0.65, 0)) })],
            () => { e.done = true; }); }
      } else if (e.ev === 2) {
        if (v.shot) cam(g, v.shot.pos, v.shot.look, 3);
        if (e.done) return true;
      }
      return false;
    },
    exit(g, v) { g.cinema(null); },
  };

  // ---------- 4. Нападение супертеррористов ----------
  const attackStep = {
    text: 'Защитите митинг',
    enter(g, v) {
      const P = g.player;
      v.mood = 'fear';
      const boom = V(-28, 1, -172);
      g.explode(boom, 6, 10, null, 1.6); g.fx.addShake(0.8);
      g.spawn('pyro', -26, -170, { group: 'atk' }); g.spawn('brute', 26, -168, { group: 'atk', quiet: true }); g.spawn('hawk', 0, -160, { group: 'atk', quiet: true });
      g.spawnGroup('atk', 'thug', V(0, 0, -160), 4, { spread: 16, weapon: 'pistol', hp: 55 });
      for (const a of v.crowd) if (a.alive) { a.think = HL.Actors.Civilian.prototype.think; a.scare && a.scare(boom, 8); }
      g.ui.say([['sys', '*взрыв у края площади*', 1.4], ['crowd', 'А-а-а! Бегите!', 1.4]]);
      g.music('combat'); g.alarm(boom, 80);
      g.camYaw = Math.PI; g.camPitch = 0.2;
    },
    update(g) { const n = g.groupCount('atk'); g.ui.el.oText.textContent = `Защитите митинг: осталось ${n}`; return n === 0; },
    wp: (g) => g.groupNearest('atk'),
  };

  // ---------- 5. Финал митинга ----------
  const endStep = {
    text: '…',
    enter(g, v) {
      const P = g.player;
      for (const a of v.crowd) if (!a.removed) a.remove();
      v.mood = 'cheer'; spawnCrowd(g, v); if (v.prot && !v.prot.removed) v.prot.remove();
      P.scriptVel = null; P.flying = false; P.place(0, 1.4, -194.2, 0); P.scriptPose = 'akimbo'; P.scriptFace = 0;
      g.cinema(P.center, STAGE); g.music('calm');
      cut(g, V(-12, 9, -172), V(0, 3, -194));
      v.e = { T: 0, beat: 0 };
      confetti(g, 80); A().cheer();
      chain(g, v, [['crowd', 'ХО-УМ-ЛЕН-ДЕР!', 2], ['ash', '*по рации* Рейтинг одобрения… девяносто три процента. Это рекорд.', 3], ['hl', 'Конечно рекорд.', 1.8]], null, () => { v.e.done = true; });
      g.changeApproval(10, 'Митинг спасён');
    },
    update(g, dt, v) {
      const e = v.e; e.T += dt; e.beat -= dt;
      if (e.beat <= 0) { e.beat = 1.3; A().cheer(); if (Math.random() < 0.5) confetti(g, 20); }
      const k = Math.min(1, e.T / 8);
      cam(g, V(-12 + k * 16, 9 - k * 6, -172 - k * 14), V(0, 2.6, -195.5), 1.5);
      return !!e.done && e.T > 2;
    },
    exit(g) { g.cinema(null); g.player.scriptPose = null; },
  };

  const mission = {
    id: 'rally', title: 'Митинг', desc: 'Тысячи людей пришли поддержать Хоумлендера. Но не все.',
    time: 'dusk', location: 'НЬЮ-ЙОРК · ПЛОЩАДЬ · 18:30', start: [0, 45, -197, 0], music: null,
    setup(g, v) { buildStage(g); spawnCrowd(g, v); },
    steps: [speechStep, choiceStep, reactStep, attackStep, endStep],
  };
  return { mission };
})();
