// Интерфейс: HUD, диалоги, субтитры, карточки, панели меню и настройки
HL.UI = (function () {
  const $ = HL.$, U = HL.U, S = () => HL.Settings;
  const T = THREE;

  const SPEAKERS = {
    hl: ['Хоумлендер', '#e8b53c'], ash: ['Эшли (Vought)', '#ff8fa0'], but: ['Бутчер', '#7fb2ff'], sb: ['Солдатик', '#b8c27a'],
    sl: ['Старлайт', '#fff1a8'], at: ['Эй-Трейн', '#6aa0ff'], hu: ['Хьюи', '#c9a27a'], ki: ['Кимико', '#cfcfcf'], fr: ['Френчи', '#d08a5a'],
    mm: ['М.М.', '#a0a0a0'], noir: ['Чёрный Нуар', '#888'], scam: ['Неизвестный номер', '#9aff9a'], news: ['Новости', '#ff5050'],
    sys: ['', '#aaa'], crowd: ['Толпа', '#ddd'],
  };

  function create(g) {
    const el = {
      hud: $('hud'), hpBar: $('hpBar'), hpTxt: $('hpTxt'), rageBar: $('rageBar'), rageTxt: $('rageTxt'), heatBar: $('heatBar'),
      apTxt: $('apTxt'), apBar: $('apBar'), approval: $('approval'), oTitle: $('oTitle'), oText: $('oText'), oTimer: $('oTimer'), objective: $('objective'),
      boss: $('bossbar'), bName: $('bName'), bBar: $('bBar'), cross: $('cross'), wp: $('waypoint'), wpDist: $('wpDist'), markers: $('markers'), tags: $('tags'), fps: $('fps'),
      dialog: $('dialog'), dWho: $('dWho'), dTxt: $('dTxt'), caption: $('caption'), location: $('location'), statcard: $('statcard'), hint: $('hint'),
      fxDamage: $('fxDamage'), fxRage: $('fxRage'), fxHear: $('fxHear'), fxDepower: $('fxDepower'), fxFlash: $('fxFlash'), fxFade: $('fxFade'),
    };
    const ui = { el };
    let dq = [], dCur = null, dT = 0, dDone = null;
    let capQ = [], capT = 0;
    let hintT = 0, locT = 0, cardT = 0, hurtV = 0, flashV = 0;
    const tagList = [];
    const floats = [];
    const markerPool = [];
    let fpsAcc = 0, fpsN = 0;

    // ---------- диалоги ----------
    ui.say = function (lines, done) {
      dq = lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1], dur: l[2] } : l));
      dDone = done || null; nextLine();
    };
    function nextLine() {
      dCur = dq.shift() || null;
      if (!dCur) { el.dialog.classList.add('hidden'); const f = dDone; dDone = null; f && f(); return; }
      const sp = SPEAKERS[dCur.who] || [dCur.who, '#ddd'];
      el.dWho.textContent = sp[0]; el.dWho.style.color = sp[1];
      el.dTxt.textContent = dCur.text;
      el.dialog.classList.toggle('hidden', !S().data.captions && false);
      el.dialog.classList.remove('hidden');
      dT = dCur.dur || Math.max(2.2, 1.2 + dCur.text.length * 0.052);
      if (dCur.who === 'scam') HL.Audio.phone();
    }
    ui.skipLine = function () { if (dCur) { dT = 0; } };
    Object.defineProperty(ui, 'talking', { get: () => !!dCur });
    ui.clearDialog = function () { dq = []; dCur = null; dDone = null; el.dialog.classList.add('hidden'); };

    // ---------- субтитры как в ролике (по словам) ----------
    ui.caption = function (text, per = 0.36) {
      if (!S().data.captions) return;
      capQ = []; const words = text.split(' ');
      // по 1-2 слова на экран
      for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (w.length <= 3 && i + 1 < words.length) { w += ' ' + words[++i]; }
        capQ.push({ w, t: per + w.length * 0.025 });
      }
      capT = 0; el.caption.innerHTML = '';
    };
    // ---------- карточки ----------
    ui.location = function (text, dur = 3.5) { el.location.textContent = text; el.location.classList.add('on'); locT = dur; };
    ui.statcard = function (name, rows, quote, dur = 4.5) {
      el.statcard.innerHTML = cardHTML(name, rows, quote);
      el.statcard.classList.remove('hidden'); cardT = dur; HL.Audio.beep();
    };
    ui.hideCard = function () { el.statcard.classList.add('hidden'); cardT = 0; };
    ui.hint = function (text, dur = 2.5) { el.hint.textContent = text; el.hint.classList.add('on'); hintT = dur; };
    ui.tag = function (text, color = '#fff', dur = 1.5) {
      const d = document.createElement('div'); d.textContent = text; d.style.color = color; d.style.borderColor = color;
      el.tags.appendChild(d); tagList.push({ d, t: dur });
      if (tagList.length > 3) { const o = tagList.shift(); o.d.remove(); }
    };
    ui.hurt = function (k) { hurtV = Math.min(1, hurtV + k); };
    ui.flash = function (dur = 0.4) { flashV = Math.max(flashV, dur); };
    ui.fade = function (on) { el.fxFade.style.opacity = on ? 1 : 0; };
    ui.objective = function (title, text) {
      if (title != null) el.oTitle.textContent = title;
      el.oText.textContent = text || '';
      el.objective.classList.remove('flash'); void el.objective.offsetWidth; el.objective.classList.add('flash');
    };
    ui.timer = function (sec) {
      if (sec == null) { el.oTimer.textContent = ''; return; }
      el.oTimer.textContent = U.fmtTime(sec); el.oTimer.classList.toggle('warn', sec < 20);
    };
    ui.boss = function (name, frac) {
      if (name == null) { el.boss.classList.add('hidden'); return; }
      el.boss.classList.remove('hidden'); el.bName.textContent = name; el.bBar.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    };
    ui.float = function (pos, text, color = '#fff') {
      const d = document.createElement('div'); d.className = 'mk ft'; d.textContent = text; d.style.color = color;
      el.markers.appendChild(d); floats.push({ d, p: pos.clone(), t: 1.6 });
    };
    ui.showHud = function (on) { el.hud.classList.toggle('hidden', !on); };

    // ---------- проекция ----------
    const pv = new T.Vector3();
    function project(p) {
      pv.copy(p).project(g.camera);
      const behind = pv.z > 1;
      return { x: (pv.x * 0.5 + 0.5) * innerWidth, y: (-pv.y * 0.5 + 0.5) * innerHeight, behind, ndc: pv };
    }
    function marker(i, cls) {
      let m = markerPool[i];
      if (!m) { m = document.createElement('div'); el.markers.appendChild(m); markerPool[i] = m; }
      if (m._cls !== cls) { m.className = 'mk ' + cls; m._cls = cls; m.innerHTML = cls === 'hpb' ? '<i></i>' : ''; }
      m.style.display = '';
      return m;
    }

    ui.update = function (dt, rdt) {
      const P = g.player;
      // FPS
      if (S().data.showFps) { fpsAcc += rdt; fpsN++; if (fpsAcc > 0.5) { el.fps.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; } el.fps.classList.remove('hidden'); }
      else el.fps.classList.add('hidden');
      // диалог
      if (dCur) { dT -= rdt; if (dT <= 0) nextLine(); }
      // субтитры
      if (capQ.length || el.caption.firstChild) {
        capT -= rdt;
        if (capT <= 0) {
          const c = capQ.shift();
          if (c) { el.caption.innerHTML = ''; const s = document.createElement('span'); s.textContent = c.w; el.caption.appendChild(s); capT = c.t; }
          else el.caption.innerHTML = '';
        }
      }
      if (hintT > 0) { hintT -= rdt; if (hintT <= 0) el.hint.classList.remove('on'); }
      if (locT > 0) { locT -= rdt; if (locT <= 0) el.location.classList.remove('on'); }
      if (cardT > 0) { cardT -= rdt; if (cardT <= 0) el.statcard.classList.add('hidden'); }
      for (let i = tagList.length - 1; i >= 0; i--) { const t = tagList[i]; t.t -= rdt; if (t.t <= 0) { t.d.remove(); tagList.splice(i, 1); } }
      hurtV = Math.max(0, hurtV - rdt * 1.6); el.fxDamage.style.opacity = hurtV.toFixed(2);
      flashV = Math.max(0, flashV - rdt); el.fxFlash.style.opacity = Math.min(1, flashV).toFixed(2);
      if (!P) return;
      el.fxRage.style.opacity = P.rageT > 0 ? 1 : 0;
      el.fxHear.style.opacity = P.hearT > 0 ? 1 : 0;
      el.fxDepower.style.opacity = P.depowerT > 0 ? 1 : 0;
      // полосы
      const hp = P.hp / P.maxHp;
      el.hpBar.style.width = (hp * 100).toFixed(1) + '%';
      el.hpTxt.textContent = Math.ceil(hp * 100) + '%';
      el.hpBar.style.background = hp < 0.3 ? 'linear-gradient(#ff7a5a,#c0201a)' : '';
      const rage = P.rageT > 0 ? P.rageT / 12 : P.rage / 100;
      el.rageBar.style.width = (rage * 100).toFixed(1) + '%';
      el.rageBar.parentNode.classList.toggle('full', P.rage >= 100);
      el.rageTxt.textContent = P.rageT > 0 ? 'АКТИВНА' : P.rage >= 100 ? 'R — ГОТОВО' : '';
      el.heatBar.style.width = P.heat.toFixed(1) + '%';
      el.heatBar.parentNode.classList.toggle('over', P.overheat);
      const ap = Math.round(g.approval);
      el.apTxt.textContent = ap + '%'; el.apBar.style.width = ap + '%';
      el.approval.classList.toggle('bad', ap < 25);
      el.approval.style.display = g.mission && g.mission.def.noApproval ? 'none' : '';
      el.cross.classList.toggle('hot', !!(g.aim && g.aim.actor && g.aim.actor.faction !== 'civ'));
      const tbr = $('tbRage'); if (tbr) tbr.classList.toggle('ready', P.rage >= 100);
      const tbu = $('tbUse'); if (tbu) tbu.textContent = P.carry ? 'ОТПУСТИТЬ' : 'ВЗЯТЬ';

      // путевая точка
      const wp = g.waypoint;
      if (wp && !g.cinematic) {
        const pr = project(wp);
        let x = pr.x, y = pr.y;
        const m = 40;
        if (pr.behind || x < m || x > innerWidth - m || y < m || y > innerHeight - m) {
          let nx = pr.ndc.x, ny = pr.ndc.y; if (pr.behind) { nx = -nx; ny = -ny; }
          const k = 1 / Math.max(Math.abs(nx), Math.abs(ny), 1e-3);
          x = (nx * k * 0.5 + 0.5) * innerWidth; y = (-ny * k * 0.5 + 0.5) * innerHeight;
          x = U.clamp(x, m, innerWidth - m); y = U.clamp(y, m + 40, innerHeight - m);
        }
        el.wp.classList.remove('hidden');
        el.wp.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        el.wpDist.textContent = Math.round(P.pos.distanceTo(wp)) + ' м';
      } else el.wp.classList.add('hidden');

      // маркеры: суперслух / полоски здоровья врагов
      let mi = 0;
      if (!g.cinematic) {
        for (const a of g.actors) {
          if (!a.alive || a.removed) continue;
          const hear = P.hearT > 0;
          const d = a.pos.distanceTo(P.pos);
          if (hear && d < 160 && (a.faction === 'enemy' || a.hearable || a.faction === 'civ' && d < 60 || a.pickable)) {
            const pr = project(a.center.add(new T.Vector3(0, 0.3, 0)));
            if (pr.behind) continue;
            const cls = a.hearable ? 'sound' : a.faction === 'enemy' ? 'enemy' : a.pickable ? 'obj' : 'civ';
            const m = marker(mi++, cls);
            if (cls === 'sound') m.textContent = a.hearIcon || '☎';
            if (cls === 'obj') m.textContent = '🆘';
            m.style.left = pr.x + 'px'; m.style.top = pr.y + 'px';
          } else if (a.showHp && a.faction === 'enemy' && !a.boss && d < 70 && a.hp < a.maxHp) {
            const pr = project(a.center.add(new T.Vector3(0, 1.4, 0)));
            if (pr.behind) continue;
            const m = marker(mi++, 'hpb');
            m.firstChild.style.width = (a.hp / a.maxHp * 100) + '%';
            m.style.left = pr.x + 'px'; m.style.top = pr.y + 'px';
          } else if (a.pickable && !a.carried && !a.rescued && d < 220) {
            const pr = project(a.center.add(new T.Vector3(0, 1.6, 0)));
            if (pr.behind) continue;
            const m = marker(mi++, 'obj'); m.textContent = '🆘';
            m.style.left = pr.x + 'px'; m.style.top = pr.y + 'px';
          }
        }
      }
      for (let i = mi; i < markerPool.length; i++) markerPool[i].style.display = 'none';
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]; f.t -= rdt; f.p.y += rdt * 1.2;
        const pr = project(f.p);
        if (f.t <= 0) { f.d.remove(); floats.splice(i, 1); continue; }
        f.d.style.display = pr.behind ? 'none' : '';
        f.d.style.left = pr.x + 'px'; f.d.style.top = pr.y + 'px'; f.d.style.opacity = Math.min(1, f.t);
      }
    };
    ui.reset = function () {
      ui.clearDialog(); capQ = []; el.caption.innerHTML = ''; ui.hideCard(); el.location.classList.remove('on');
      for (const t of tagList) t.d.remove(); tagList.length = 0;
      for (const f of floats) f.d.remove(); floats.length = 0;
      ui.boss(null); ui.timer(null); hurtV = 0; flashV = 0; el.hint.classList.remove('on');
    };

    // ---------- экраны результата / выбора ----------
    ui.result = function (o) {
      const r = $('result');
      $('rTitle').textContent = o.title; $('rTitle').className = 'rtitle ' + (o.win ? 'win' : 'lose');
      $('rSub').textContent = o.sub || '';
      $('rStats').innerHTML = (o.stats || []).map((s) => `<div><b>${s[1]}</b><span>${s[0]}</span></div>`).join('');
      const bb = $('rBtns'); bb.innerHTML = '';
      for (const b of o.buttons) {
        const e = document.createElement('button'); e.className = 'mbtn' + (b.dim ? ' dim' : ''); e.textContent = b.text;
        e.onclick = () => { HL.Audio.click(); r.classList.add('hidden'); b.fn(); }; bb.appendChild(e);
      }
      r.classList.remove('hidden');
    };
    ui.choice = function (title, opts) {
      const c = $('choice'); $('cTitle').textContent = title; const cb = $('cBtns'); cb.innerHTML = '';
      for (const o of opts) {
        const e = document.createElement('button'); e.className = 'cbtn'; e.innerHTML = o.text + (o.sub ? `<small>${o.sub}</small>` : '');
        e.onclick = () => { HL.Audio.click(); c.classList.add('hidden'); o.fn(); }; cb.appendChild(e);
      }
      c.classList.remove('hidden');
    };
    return ui;
  }

  // ---------- карточка как в ролике ----------
  function cardHTML(name, rows, quote) {
    return `<div class="scard"><div class="sh">${name}</div>${rows.map((r) => `<div class="sr"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}${quote ? `<div class="sq">${quote}</div>` : ''}</div>`;
  }

  // ================= ПАНЕЛИ =================
  const panel = $('panel'), pbody = $('pbody'), ptitle = $('ptitle');
  let onPanelClose = null;
  $('pclose').onclick = () => closePanel();
  panel.addEventListener('pointerdown', (e) => { if (e.target === panel) closePanel(); });
  function openPanel(title, html, onClose) {
    ptitle.textContent = title; pbody.innerHTML = ''; if (typeof html === 'string') pbody.innerHTML = html; else pbody.appendChild(html);
    panel.classList.remove('hidden'); onPanelClose = onClose || null;
  }
  function closePanel() { if (panel.classList.contains('hidden')) return; HL.Audio.click(); panel.classList.add('hidden'); const f = onPanelClose; onPanelClose = null; f && f(); }

  // ---------- настройки ----------
  const SCHEMA = {
    'Графика': [
      { k: 'preset', label: 'Качество графики', type: 'seg', opts: [['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое'], ['ultra', 'Ультра']], note: 'Быстро выставляет все параметры ниже' },
      { k: 'renderScale', label: 'Разрешение рендера', type: 'range', min: 0.5, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%', note: 'Ниже — больше FPS' },
      { k: 'shadows', label: 'Тени', type: 'seg', opts: [[0, 'Выкл'], [1, 'Низк.'], [2, 'Средн.'], [3, 'Высок.']] },
      { k: 'antialias', label: 'Сглаживание (MSAA)', type: 'seg', opts: [[false, 'Выкл'], [true, 'Вкл']] },
      { k: 'drawDist', label: 'Дальность прорисовки', type: 'seg', opts: [[0, 'Близко'], [1, 'Средне'], [2, 'Далеко'], [3, 'Макс']] },
      { k: 'crowd', label: 'Толпа и машины', type: 'seg', opts: [[0, 'Мало'], [1, 'Средне'], [2, 'Много'], [3, 'Толпы']] },
      { k: 'particles', label: 'Частицы и взрывы', type: 'seg', opts: [[0, 'Мин.'], [1, 'Средн.'], [2, 'Высок.'], [3, 'Ультра']] },
      { k: 'details', label: 'Детализация города', type: 'seg', opts: [[0, 'Низк.'], [1, 'Средн.'], [2, 'Высок.']] },
      { k: 'outlines', label: 'Мультяшные контуры', type: 'seg', opts: [[false, 'Выкл'], [true, 'Вкл']] },
      { k: 'fov', label: 'Поле зрения (FOV)', type: 'range', min: 55, max: 100, step: 1, fmt: (v) => v + '°' },
      { k: 'showFps', label: 'Показывать FPS', type: 'seg', opts: [[false, 'Нет'], [true, 'Да']] },
    ],
    'Управление': [
      { k: 'controls', label: 'Схема управления', type: 'seg', opts: [['auto', 'Авто'], ['pc', 'ПК'], ['touch', 'Сенсор']] },
      { k: 'sens', label: 'Чувствительность', type: 'range', min: 0.3, max: 2.5, step: 0.05, fmt: (v) => v.toFixed(2) },
      { k: 'invertY', label: 'Инверсия по вертикали', type: 'seg', opts: [[false, 'Нет'], [true, 'Да']] },
      { k: 'camDist', label: 'Дистанция камеры', type: 'range', min: 4, max: 14, step: 0.5, fmt: (v) => v + ' м' },
      { k: 'shake', label: 'Тряска камеры', type: 'seg', opts: [[false, 'Выкл'], [true, 'Вкл']] },
    ],
    'Звук': [
      { k: 'music', label: 'Музыка', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'sfx', label: 'Эффекты', type: 'range', min: 0, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'captions', label: 'Субтитры-слова (как в роликах)', type: 'seg', opts: [[false, 'Выкл'], [true, 'Вкл']] },
    ],
  };
  let curTab = 'Графика';
  function openSettings(onClose) {
    const wrap = document.createElement('div');
    const render = () => {
      wrap.innerHTML = '';
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      for (const t in SCHEMA) { const b = document.createElement('button'); b.className = 'tab' + (t === curTab ? ' on' : ''); b.textContent = t; b.onclick = () => { curTab = t; HL.Audio.click(); render(); }; tabs.appendChild(b); }
      wrap.appendChild(tabs);
      const D = HL.Settings.data;
      for (const row of SCHEMA[curTab]) {
        const r = document.createElement('div'); r.className = 'srow';
        r.innerHTML = `<label>${row.label}${row.note ? `<small>${row.note}</small>` : ''}</label>`;
        if (row.type === 'seg') {
          const seg = document.createElement('div'); seg.className = 'seg';
          for (const [v, txt] of row.opts) {
            const b = document.createElement('button'); b.textContent = txt; if (D[row.k] === v) b.classList.add('on');
            b.onclick = () => { HL.Audio.click(); setVal(row.k, v); render(); };
            seg.appendChild(b);
          }
          if (row.k === 'preset' && D.preset === 'custom') { const c = document.createElement('button'); c.textContent = 'Своё'; c.className = 'on'; seg.appendChild(c); }
          r.appendChild(seg);
        } else {
          const box = document.createElement('div'); box.style.display = 'flex'; box.style.alignItems = 'center'; box.style.gap = '8px';
          const inp = document.createElement('input'); inp.type = 'range'; inp.min = row.min; inp.max = row.max; inp.step = row.step; inp.value = D[row.k];
          const val = document.createElement('span'); val.className = 'val'; val.textContent = row.fmt(D[row.k]);
          inp.oninput = () => { const v = parseFloat(inp.value); val.textContent = row.fmt(v); setVal(row.k, v, true); };
          inp.onchange = () => render();
          box.appendChild(inp); box.appendChild(val); r.appendChild(box);
        }
        wrap.appendChild(r);
      }
      const note = document.createElement('div'); note.className = 'pnote';
      note.innerHTML = curTab === 'Графика' ? 'Толпа, детализация и частицы применяются при следующем запуске миссии. Совет: на телефоне — «Среднее», на ПК — «Высокое»/«Ультра».' : '';
      wrap.appendChild(note);
      const reset = document.createElement('button'); reset.className = 'tab'; reset.textContent = 'Сбросить настройки';
      reset.onclick = () => { HL.Settings.reset(); HL.Game.applySettings('all'); render(); };
      wrap.appendChild(reset);
    };
    function setVal(k, v, live) {
      const St = HL.Settings;
      if (k === 'preset') St.setPreset(v); else { St.data[k] = v; if (k in St.PRESETS.high) St.markCustom(); }
      St.save();
      HL.Game.applySettings(k);
    }
    render();
    openPanel('Настройки', wrap, onClose);
  }

  function openMissions(onPick) {
    const L = HL.Missions.LIST, P = HL.Progress.data;
    const wrap = document.createElement('div'); wrap.className = 'mlist';
    L.forEach((m, i) => {
      const locked = i + 1 > P.unlocked;
      const b = document.createElement('button'); b.className = 'mitem' + (locked ? ' locked' : '');
      const done = P.done[i];
      b.innerHTML = `<div class="num">${String(i + 1).padStart(2, '0')}</div><div><div class="mt">${locked ? '???' : m.title}</div><div class="md">${locked ? 'Пройдите предыдущую миссию' : m.desc}</div></div>${done ? `<div class="done">✔ ${done.approval != null ? 'рейтинг ' + done.approval + '%' : 'пройдено'}</div>` : ''}`;
      b.onclick = () => { HL.Audio.click(); closePanel(); onPick(i); };
      wrap.appendChild(b);
    });
    const r = document.createElement('button'); r.className = 'tab'; r.style.marginTop = '14px'; r.textContent = 'Сбросить прогресс';
    r.onclick = () => { if (r.dataset.arm) { HL.Progress.reset(); closePanel(); openMissions(onPick); } else { r.dataset.arm = '1'; r.textContent = 'Точно сбросить? Нажмите ещё раз'; } };
    wrap.appendChild(r);
    openPanel('Миссии', wrap);
  }

  const DOSSIER = [
    ['ХОУМЛЕНДЕР', [['СИЛА', 'MAX'], ['ПОЛЁТ', 'ДА'], ['ЛАЗЕР ИЗ ГЛАЗ', 'ДА'], ['УРОВЕНЬ', '99']], 'Лицо Vought. Улыбается в камеру. Не любит, когда его обманывают.'],
    ['БИЛЛИ БУТЧЕР', [['СУПЕРСИЛА', 'НЕТ'], ['НАГЛОСТЬ', 'MAX'], ['ТЕЛЕФОННЫЕ РАЗВОДЫ', 'ДА'], ['УРОВЕНЬ', '??']], 'Он же «продавец Уильям». Ненавидит суперов. Особенно одного.'],
    ['СОЛДАТИК', [['СИЛА', 'MAX'], ['ЩИТ', 'ДА'], ['ВЗРЫВ ИЗ ГРУДИ', 'ДА'], ['УРОВЕНЬ', '98']], 'Легенда прошлого века. Его взрыв подавляет силы суперов.'],
    ['СТАРЛАЙТ', [['СВЕТ', 'MAX'], ['ПОЛЁТ', 'НЕТ'], ['ОСЛЕПЛЕНИЕ', 'ДА'], ['УРОВЕНЬ', '80']], 'Бывшая звезда Семёрки. Теперь на стороне Пацанов.'],
    ['ЭЙ-ТРЕЙН', [['СКОРОСТЬ', 'MAX'], ['СКРОМНОСТЬ', 'НЕТ'], ['УРОВЕНЬ', '75']], 'Самый быстрый человек на планете. Так он говорит.'],
    ['КИМИКО', [['РЕГЕНЕРАЦИЯ', 'ДА'], ['БЛИЖНИЙ БОЙ', 'MAX'], ['УРОВЕНЬ', '70']], 'Молчалива. Опасна. Не любит лазеры.'],
    ['ФРЕНЧИ', [['ГРАНАТЫ', 'ДА'], ['ХИМИЯ', 'ДА'], ['УРОВЕНЬ', '30']], 'Мастер взрывчатки и импровизации.'],
    ['М.М.', [['ДИСЦИПЛИНА', 'MAX'], ['ПУЛЕМЁТ', 'ДА'], ['УРОВЕНЬ', '35']], 'Держит Пацанов в узде. Почти.'],
    ['ХЬЮИ', [['СИЛА', 'НЕТ'], ['СМЕЛОСТЬ', 'ИНОГДА'], ['ХАКЕР', 'ДА'], ['УРОВЕНЬ', '12']], 'Обычный парень, который попал не в ту компанию.'],
    ['ЭШЛИ', [['ПИАР', 'MAX'], ['ПАНИКА', 'MAX'], ['УРОВЕНЬ', '5']], 'Отвечает за рейтинг одобрения. Нервничает.'],
  ];
  function openDossier() {
    const g = document.createElement('div'); g.className = 'dgrid';
    g.innerHTML = DOSSIER.map((d) => cardHTML(d[0], d[1], d[2])).join('');
    openPanel('Досье', g);
  }

  const CONTROLS_HTML = `
    <h3>ПК (клавиатура + мышь)</h3>
    <div class="keys">
      <b>W A S D</b><span>Движение (в полёте — куда смотрит камера)</span>
      <b>Мышь</b><span>Обзор (щёлкните по экрану, чтобы захватить курсор)</span>
      <b>ЛКМ (держать)</b><span>Лазер из глаз (перегревается)</span>
      <b>ПКМ / V</b><span>Суперудар с рывком к цели</span>
      <b>Пробел</b><span>Прыжок · в воздухе — взлёт · в полёте — вверх</span>
      <b>F</b><span>Включить / выключить полёт</span>
      <b>C / Ctrl</b><span>Вниз · у земли — приземлиться (с высоты — ударная волна)</span>
      <b>Shift</b><span>Суперскорость</span>
      <b>Q</b><span>Суперслух: враги и цели видны сквозь стены</span>
      <b>E</b><span>Взять / отпустить человека</span>
      <b>H</b><span>Позировать (руки в боки) — толпа ликует, рейтинг растёт</span>
      <b>R</b><span>Ярость (когда шкала полна): мощный лазер и меньше урона</span>
      <b>Колесо</b><span>Приблизить / отдалить камеру</span>
      <b>Esc / P</b><span>Пауза</span>
      <b>Enter</b><span>Пропустить реплику</span>
    </div>
    <h3>Телефон</h3>
    <p>Левый джойстик — движение, свайп по экрану — обзор. Кнопки справа: ЛАЗЕР (держать, можно вести пальцем — камера поворачивается), УДАР, ▲/▼ — вверх/вниз, ПОЛЁТ, ⚡ — суперскорость, СЛУХ, ВЗЯТЬ, ПОЗА, ЯРОСТЬ. На телефоне включено лёгкое автонаведение лазера.</p>`;
  function openAbout() {
    openPanel('Об игре', `<div class="about">
      <h3>Что это</h3>
      <p>Сюжетная одиночная игра (только соло, без мультиплеера) по мотивам сериала: вы — Хоумлендер. 7 миссий, финал с выбором и режим «Свободный полёт».
      Следите за <b>рейтингом одобрения</b>: Vought не простит убитых гражданских на камеру.</p>
      <h3>ПК или телефон?</h3>
      <p>Игра работает в браузере на обоих. <b>Лучше всего — на ПК</b>: мышь даёт точное прицеливание лазером, а видеокарта тянет тени, толпы и дальнюю прорисовку.
      На телефоне всё тоже играется: сенсорное управление включается само, а графика по умолчанию стоит на «Среднем». Если тормозит — понизьте «Разрешение рендера» и «Тени» в настройках.</p>
      ${CONTROLS_HTML}
      <h3>Персонажи</h3>
      <p>Хоумлендер, Билли Бутчер, Солдатик, Старлайт, Эй-Трейн, Кимико, Френчи, М.М., Хьюи и Эшли из Vought.</p>
      <p style="color:#666;font-size:12px">Неофициальный некоммерческий фан-проект. Все персонажи принадлежат правообладателям сериала. Вся графика и звук сделаны кодом прямо в игре.</p>
    </div>`);
  }
  function openControls(onClose) { openPanel('Управление', `<div class="about">${CONTROLS_HTML}</div>`, onClose); }

  return { create, openSettings, openMissions, openDossier, openAbout, openControls, closePanel, cardHTML, get panelOpen() { return !panel.classList.contains('hidden'); } };
})();
