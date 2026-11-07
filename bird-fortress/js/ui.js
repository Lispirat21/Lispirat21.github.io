'use strict';
// ============ Интерфейс: меню, настройки, HUD, сенсорное управление ============
const UI = window.UI = {};
(function () {
  const $ = id => document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const SKEY = 'birdfortress_settings_v1';
  const DEF = { view: 'third', uiScale: 100, quality: isTouch ? 'medium' : 'high', resolution: 'auto', musicOn: true, musicVol: 60, sfxOn: true, sfxVol: 80, autoAct: true, camDist: 100, sens: 100 };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { }
  G.settings = Object.assign({}, DEF, saved);
  const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(G.settings)); } catch (e) { } };
  const applyAudio = () => Sound.set({ musicOn: G.settings.musicOn, sfxOn: G.settings.sfxOn, musicVol: G.settings.musicVol / 100, sfxVol: G.settings.sfxVol / 100 });
  applyAudio();
  const applyUiScale = () => document.documentElement.style.setProperty('--ui', (G.settings.uiScale || 100) / 100);
  applyUiScale();

  // Золотая птица — особая валюта между прохождениями
  const GB_ICON = '<svg class="gbi" viewBox="0 0 32 32"><defs><linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#f2c230"/><stop offset="1" stop-color="#b07a10"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#gbg)" stroke="#8a5a08" stroke-width="1.5"/><path d="M7 19c3-1 5-4 6-7 1-2 3-3 5-3 2 0 3 1 4 2l3 0-2 2c0 4-3 7-7 8l3 3h-3l-2-2c-3 0-5-1-7-3z" fill="#7a4a06"/><circle cx="20" cy="12" r="1.2" fill="#fff3a0"/></svg>';
  UI.GB_ICON = GB_ICON;
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === 'on') for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (k === 'html') e.innerHTML = attrs[k]; else if (k === 'cls') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    kids.flat().forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return e;
  }
  function tap(el, fn) { el.addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.play('click'); fn(e); }); }
  // Кнопки игрового HUD срабатывают в момент касания (pointerdown), а не по click:
  // на телефоне второй палец (пока первый держит стик) не порождает click.
  function press(el, fn) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Sound.init(); Sound.play('click'); fn(e); });
    el.addEventListener('click', e => { if (e.detail !== 0) { e.preventDefault(); e.stopPropagation(); } else { fn(e); } }); // клавиатура (Enter) — detail 0
  }
  const screens = ['loading', 'menu', 'settings', 'select', 'hud', 'pause', 'over', 'bye'];
  function show(...ids) { screens.forEach(s => $(s).classList.toggle('hidden', !ids.includes(s))); }

  // ---------------- Загрузка ----------------
  const setLoad = (p, t) => { p = Math.round(p); $('loadbar').style.width = p + '%'; $('loadpct').textContent = p + '%'; $('loadtxt').textContent = t; };
  // Экран загрузки: три птицы вплотную к названию, смотрят на игрока
  function placeLoadBirds() {
    const imgs = G.makeLoadBirds(['sparrow', 'guinea', 'turkey']);
    const mk = (sp, cls) => h('img', { src: imgs[sp], cls: 'ldb ' + cls, alt: '' });
    $('ld-left').append(mk('sparrow', 'ldsmall'), mk('guinea', ''));
    $('ld-right').append(mk('turkey', 'ldbig'));
  }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function boot() {
    const bootStart = performance.now();
    setLang(G.settings.lang || 'en');
    setLoad(4, tr('loading')); await nextFrame();
    try { G.initRenderer($('c')); } catch (e) { setLoad(100, tr('webgl_err') + e.message); console.error(e); return; }
    setLoad(12, tr('load_birds')); await nextFrame();
    try { G.makePortraits(); placeLoadBirds(); } catch (e) { console.warn(e); }
    setLoad(30, tr('load_trees')); await nextFrame(); await nextFrame();
    try { G.initWorld(); } catch (e) { setLoad(100, tr('webgl_err') + e.message); console.error(e); return; }
    setLoad(85, tr('load_trees')); await nextFrame();
    G.applyQuality();
    // минимальная длительность экрана загрузки (~4 с), полоска плавно доезжает до 100%
    const MIN_MS = 4000, from = 85, left = Math.max(600, MIN_MS - (performance.now() - bootStart));
    await new Promise(res => { const t0 = performance.now(); (function step() { const k = Math.min(1, (performance.now() - t0) / left); setLoad(from + (100 - from) * k, k < 1 ? tr('load_birds') : tr('load_done')); if (k < 1) requestAnimationFrame(step); else setTimeout(res, 400); })(); });
    G.state = 'menu';
    show('menu'); refreshGB();
    if (!G.settings.lang) openLangPicker(true);
    loop(performance.now());
  }
  let last = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    G.frame(dt);
    requestAnimationFrame(loop);
  }
  window.addEventListener('load', boot);
  window.addEventListener('resize', () => { G.resize(); placeIdleSticks(); });
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => Sound.init(), { capture: true, passive: true }));

  // ---------------- Выбор языка ----------------
  function changeLang(id) {
    G.settings.lang = id; saveSettings(); setLang(id);
    renderSettings(); refreshContinue(); buildResChips(); promptKey = '';
    if (G.state === 'select') renderHero();
    if (modal) renderModal();
  }
  function openLangPicker(first) {
    const cur = G.settings.lang || 'en';
    $('lp-title').textContent = tr('lang_pick');
    const list = $('lp-list'); list.innerHTML = '';
    LANGS.forEach(L => {
      const b = h('button', { cls: L.id === cur ? 'on' : '', lang: L.id }, h('span', { cls: 'fl' }, L.flag), h('span', null, L.name));
      tap(b, () => { changeLang(L.id); $('langpick').classList.add('hidden'); });
      list.append(b);
    });
    $('langpick').classList.remove('hidden');
    void first;
  }
  tap($('btn-lang'), () => openLangPicker(false));
  const langSel = $('s-lang');
  LANGS.forEach(L => { const o = document.createElement('option'); o.value = L.id; o.textContent = L.flag + ' ' + L.name; langSel.append(o); });
  langSel.addEventListener('change', () => changeLang(langSel.value));

  // ---------------- Главное меню ----------------
  let settingsFrom = 'menu';
  document.querySelectorAll('#menu [data-act]').forEach(b => tap(b, () => {
    const a = b.dataset.act;
    if (a === 'play') { $('m-main').classList.add('hidden'); $('m-play').classList.remove('hidden'); refreshContinue(); }
    if (a === 'back') { $('m-play').classList.add('hidden'); $('m-main').classList.remove('hidden'); }
    if (a === 'settings') openSettings('menu');
    if (a === 'exit') exitGame();
    if (a === 'continue') openSlots('load');
    if (a === 'new') openSlots('new');
    if (a === 'slots-back') { $('m-slots').classList.add('hidden'); $('menu').classList.remove('slots-open'); $('m-play').classList.remove('hidden'); refreshContinue(); }
  }));
  function refreshContinue() {
    const n = G.saveCount();
    $('btn-continue').disabled = !n;
    $('saveinfo').textContent = n ? tr('saves_n', { n }) : tr('no_save');
  }
  function refreshGB() { $('gbBadge').innerHTML = `${GB_ICON}<b>${G.meta.gb}</b>`; }
  UI.refreshGB = refreshGB;
  let selSlot = 1;
  function openSlots(mode) {
    $('m-play').classList.add('hidden'); $('m-main').classList.add('hidden'); $('m-slots').classList.remove('hidden'); $('menu').classList.add('slots-open');
    $('slotsTitle').textContent = tr(mode === 'new' ? 'slots_new' : 'slots_load');
    const list = $('slotList'); list.innerHTML = '';
    [1, 2, 3].forEach(n => {
      const info = G.saveInfo(n);
      const main = h('button', { cls: 'slotbtn' + (info ? '' : ' empty') },
        h('b', null, tr('slot', { n })),
        h('small', null, info ? tr('slot_line', { hero: HEROES[info.hero] ? HEROES[info.hero].name : '', diff: (DIFFICULTY[info.diff] || DIFFICULTY.normal).name, day: info.day, wave: info.wave }) : tr('slot_empty')),
        info ? h('small', { cls: 'sl2' }, '🌍 ' + info.biome + (info.at ? ' · ' + new Date(info.at).toLocaleString() : '')) : null);
      if (mode === 'load' && !info) main.disabled = true;
      tap(main, () => {
        if (mode === 'load') { withLoading(tr('load_world'), () => G.load(n)).then(ok => { if (ok) enterGame(); else show('menu'); }); return; }
        if (info && !main.dataset.armed) { main.dataset.armed = '1'; main.querySelector('small').textContent = tr('overwrite'); main.classList.add('warn'); return; }
        selSlot = n; openSelect();
      });
      const row = h('div', { cls: 'slotrow' }, main);
      if (info) {
        const del = h('button', { cls: 'slotdel' }, tr('del_slot'));
        tap(del, () => { if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = tr('del_sure'); return; } G.deleteSave(n); openSlots(mode); refreshContinue(); });
        row.append(del);
      }
      list.append(row);
    });
  }
  function exitGame() {
    if (G.state === 'play') G.save(true);
    G.state = 'bye'; show('bye');
    try { window.close(); } catch (e) { }
  }
  tap($('bye-back'), () => { G.state = 'menu'; show('menu'); backToMain(); });
  function backToMain() { $('m-play').classList.add('hidden'); $('m-slots').classList.add('hidden'); $('menu').classList.remove('slots-open'); $('m-main').classList.remove('hidden'); Sound.setMode('menu'); }

  // ---------------- Настройки ----------------
  function openSettings(from) { settingsFrom = from; renderSettings(); $('settings').classList.remove('hidden'); if (from === 'menu') $('menu').classList.add('hidden'); if (from === 'pause') $('pause').classList.add('hidden'); }
  function renderSettings() {
    const s = G.settings;
    $('s-lang').value = s.lang || 'en';
    document.querySelectorAll('#s-quality button').forEach(b => b.classList.toggle('on', b.dataset.v === s.quality));
    $('s-res').value = s.resolution;
    document.querySelectorAll('#s-view button').forEach(b => b.classList.toggle('on', b.dataset.v === s.view));
    $('s-musicOn').classList.toggle('on', s.musicOn); $('s-sfxOn').classList.toggle('on', s.sfxOn); $('s-autoAct').classList.toggle('on', s.autoAct);
    $('s-uiScale').value = s.uiScale; $('s-uiScaleV').textContent = s.uiScale + '%';
    $('s-musicVol').value = s.musicVol; $('s-sfxVol').value = s.sfxVol; $('s-camDist').value = s.camDist; $('s-sens').value = s.sens;
  }
  document.querySelectorAll('#s-quality button').forEach(b => tap(b, () => { G.settings.quality = b.dataset.v; saveSettings(); renderSettings(); G.applyQuality(); }));
  $('s-res').addEventListener('change', () => { G.settings.resolution = $('s-res').value; saveSettings(); G.resize(); });
  ['musicOn', 'sfxOn', 'autoAct'].forEach(k => tap($('s-' + k), () => { G.settings[k] = !G.settings[k]; saveSettings(); renderSettings(); applyAudio(); }));
  ['musicVol', 'sfxVol', 'camDist', 'sens', 'uiScale'].forEach(k => $('s-' + k).addEventListener('input', e => { G.settings[k] = +e.target.value; saveSettings(); applyAudio(); applyUiScale(); $('s-uiScaleV').textContent = G.settings.uiScale + '%'; placeIdleSticks(); }));
  tap($('s-full'), toggleFullscreen);
  document.querySelectorAll('#s-view button').forEach(b => tap(b, () => setView(b.dataset.v)));
  function setView(v) { G.settings.view = v; saveSettings(); renderSettings(); document.body.classList.toggle('fp', v === 'first'); }
  document.body.classList.toggle('fp', G.settings.view === 'first');
  tap($('s-back'), () => { $('settings').classList.add('hidden'); if (settingsFrom === 'menu') $('menu').classList.remove('hidden'); if (settingsFrom === 'pause' && G.state === 'play') $('pause').classList.remove('hidden'); });
  function toggleFullscreen() {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const r = el.requestFullscreen || el.webkitRequestFullscreen; if (r) { const pr = r.call(el); if (pr && pr.catch) pr.catch(() => { }); } else toast(tr('full_na'), 'warn'); }
  }
  function goFullscreenMobile() {
    if (!isTouch) return;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
  }

  // ---------------- Выбор героя ----------------
  let selIdx = 0, selDiff = 'normal', selSeed = '', selBiome = '';
  function openSelect() {
    G.state = 'select'; show('select'); selIdx = 0; G.selRot = 0.4; selSeed = String(Math.floor(Math.random() * 1e9)); renderHero(); goFullscreenMobile();
  }
  function renderHero() {
    const id = HERO_ORDER[selIdx], d = HEROES[id], locked = !G.heroUnlocked(id);
    G.showHero(id);
    $('sel-go').innerHTML = locked ? tr('hero_buy', { n: d.price }) + ' ' + GB_ICON : tr('start');
    $('sel-go').classList.toggle('gold', locked);
    const bar = (lbl, v, max) => h('div', { cls: 'stat' }, h('b', null, lbl), h('div', { cls: 'sb' }, h('i', { style: `width:${Math.min(100, v / max * 100)}%` })));
    const c = $('heroCard'); c.innerHTML = '';
    c.append(h('div', { cls: 'gbline', html: `${GB_ICON} <b>${G.meta.gb}</b> · ${tr('gbirds')} · ${selIdx + 1}/${HERO_ORDER.length}` }));
    if (locked) c.append(h('div', { cls: 'lockline', html: tr('hero_locked', { n: d.price }) + ' ' + GB_ICON }));
    c.append(h('h3', null, d.name), h('p', null, d.desc),
      h('div', { cls: 'stats' }, bar(tr('st_hp'), d.hp, 160), bar(tr('st_speed'), d.speed, 8), bar(tr('st_attack'), d.dmg * d.atkRate, 56), bar(tr('st_gather'), d.gather, 1.4), bar(tr('st_build'), 1 / d.buildMul, 1.4)),
      h('div', { cls: 'perk' }, '⭐ ' + d.perk));
    const seg = h('div', { cls: 'seg diff' });
    DIFF_ORDER.forEach(k => { const D = DIFFICULTY[k]; const b = h('button', { cls: (k === selDiff ? 'on ' : '') + 'd-' + k }, D.icon + ' ' + D.name); tap(b, () => { selDiff = k; renderHero(); }); seg.append(b); });
    c.append(h('div', { style: 'margin-top:8px;font-weight:800' }, tr('difficulty')), seg, h('div', { cls: 'ddesc', style: 'font-size:12px;margin-top:3px;opacity:.85' }, DIFFICULTY[selDiff].desc + tr('prep', { t: `${Math.floor(DIFFICULTY[selDiff].prep / 60)}:${String(DIFFICULTY[selDiff].prep % 60).padStart(2, '0')}` })));
    // мир (сид) — как в Майнкрафте: одинаковый сид даёт одинаковую карту
    const bioName = () => tr('biome_seed') + ' (' + World.biomeOf(World.seedFrom(selSeed || '1')).name + ')';
    const biomeLbl = { set textContent(v) { const o = document.querySelector('#biomeSel option[value=""]'); if (o) o.textContent = v; } };
    const inp = h('input', { id: 'seedIn', type: 'text', inputmode: 'text', maxlength: '24', value: selSeed, placeholder: tr('seed_ph'), autocomplete: 'off' });
    inp.addEventListener('input', () => { selSeed = inp.value; biomeLbl.textContent = bioName(); });
    const dice = h('button', { cls: 'btn blue', style: 'padding:6px 10px' }, '🎲');
    tap(dice, () => { selSeed = String(Math.floor(Math.random() * 1e9)); inp.value = selSeed; biomeLbl.textContent = bioName(); });
    const bsel = h('select', { id: 'biomeSel' });
    [['', bioName()], ...World.BIOMES.map(b => [b.id, ({ summer: '☀️ ', autumn: '🍂 ', taiga: '🌲 ', winter: '❄️ ', bloom: '🌸 ' }[b.id] || '') + b.name])].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === selBiome) o.selected = true; bsel.append(o); });
    bsel.addEventListener('change', () => { selBiome = bsel.value; biomeLbl.textContent = bioName(); });
    c.append(h('div', { cls: 'seedrow' }, h('b', null, tr('world')), inp, dice, bsel));
  }
  tap($('sel-prev'), () => { selIdx = (selIdx + HERO_ORDER.length - 1) % HERO_ORDER.length; renderHero(); });
  tap($('sel-next'), () => { selIdx = (selIdx + 1) % HERO_ORDER.length; renderHero(); });
  tap($('sel-back'), () => { G.state = 'menu'; show('menu'); backToMain(); refreshGB(); });
  tap($('sel-go'), async () => {
    const hid = HERO_ORDER[selIdx];
    if (!G.heroUnlocked(hid)) { if (G.buyHero(hid)) { renderHero(); refreshGB(); } return; }
    const seed = World.seedFrom(selSeed || String(Math.floor(Math.random() * 1e9)));
    const bio = selBiome || World.biomeOf(seed).id;
    await withLoading(tr('load_gen', { name: World.biomeById(bio).name }), () => G.newGame(hid, selDiff, seed, bio, selSlot));
    enterGame(); toast(tr('welcome', { biome: World.biome.name, seed }), 'good', 4500);
  });
  async function withLoading(text, fn) {
    show('loading'); setLoad(60, text); await nextFrame(); await nextFrame();
    let r; try { r = fn(); } catch (e) { console.error(e); }
    setLoad(100, tr('load_done')); return r;
  }

  // ---------------- Вход в игру ----------------
  function enterGame() {
    show('hud'); closeModal(); $('pause').classList.add('hidden');
    G.paused = false; Sound.setMode('calm');
    buildResChips(); placeIdleSticks();
    document.body.classList.toggle('ask-rotate', isTouch && !rotateOk);
    goFullscreenMobile();
  }
  let rotateOk = false;
  tap($('rot-ok'), () => { rotateOk = true; document.body.classList.remove('ask-rotate'); });

  // ---------------- Пауза ----------------
  function openPause() { if (G.state !== 'play' && G.state !== 'cutscene') return; G.paused = true; $('pause').classList.remove('hidden'); Sound.setMode('menu'); }
  function closePause() { $('pause').classList.add('hidden'); G.paused = modalOpen(); Sound.setMode(G.S() && G.S().waveActive ? 'battle' : 'calm'); }
  tap($('btn-pause'), openPause);
  press($('btn-view'), () => { setView(G.settings.view === 'first' ? 'third' : 'first'); toast(G.settings.view === 'first' ? tr('view_fp') : tr('view_tp'), 'info'); });
  document.querySelectorAll('#pause [data-p]').forEach(b => tap(b, () => {
    const a = b.dataset.p;
    if (a === 'resume') closePause();
    if (a === 'save') G.save();
    if (a === 'settings') openSettings('pause');
    if (a === 'menu') { G.save(true); G.cancelBuild(); G.state = 'menu'; $('pause').classList.add('hidden'); show('menu'); backToMain(); clearFloats(); }
  }));
  // Конец игры
  UI.cutscene = function (on) {
    document.body.classList.toggle('cutscene', on);
    if (on) { closeModal(); clearFloats(); G.input.mx = G.input.mz = G.input.camX = G.input.camY = 0; G.input.run = false; }
  };
  UI.gameOver = function (st) {
    $('over').querySelector('h1').textContent = st.win ? tr('victory') : tr('over_title');
    $('over').classList.toggle('win', !!st.win);
    const t = Math.floor(st.time || 0), hh = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = t % 60;
    const tstr = (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
    const D = DIFFICULTY[st.diff] || DIFFICULTY.normal;
    const cell = (ic, lbl, v) => `<div class="rs"><span class="ri">${ic}</span><span class="rl">${lbl}</span><b>${v}</b></div>`;
    $('overtxt').innerHTML = `
      ${st.win ? `<div class="wintxt">${tr('victory_txt')}</div>` : ''}
      <div class="gbreward">${tr(st.win ? 'win_gb' : 'defeat_gb')} ${GB_ICON} <b>+${st.gb}</b> <small>(${tr('gb_earned', { n: st.gb, t: st.gbTotal })})</small></div>
      <div class="rnote">${st.win ? tr('run_note') : tr('over_note')}</div>
      <div class="rsub">${HEROES[st.hero] ? HEROES[st.hero].name : ''} · ${D.icon} ${D.name} · 🌍 ${st.biome} (${tr('seed')} ${st.seed})</div>
      <div class="rgrid">
        ${cell('🌊', tr('r_waves'), Math.max(0, st.wave - 1))}
        ${cell('⏱️', tr('r_time'), tstr)}
        ${cell('📅', tr('r_days'), st.day)}
        ${cell('🐺', tr('r_kills'), st.kills)}
        ${cell('☠️', tr('r_bosses'), st.bosses || 0)}
        ${cell('🔨', tr('r_built'), st.built)}
        ${cell(RES_INFO.wood.icon, tr('r_wood'), Math.floor(st.wood))}
        ${cell(RES_INFO.stone.icon, tr('r_stone'), Math.floor(st.stone))}
        ${cell(RES_INFO.coal.icon, tr('r_coal'), Math.floor(st.coal || 0))}
        ${cell(RES_INFO.iron.icon, tr('r_iron'), Math.floor(st.iron))}
        ${cell(RES_INFO.food.icon, tr('r_food'), Math.floor(st.food || 0))}
        ${cell(RES_INFO.coins.icon, tr('r_coins'), Math.floor(st.coins || 0))}
        ${cell('🐦', tr('r_birds'), st.boughtBirds)}
      </div>
`;
    setTimeout(() => { $('over').classList.remove('hidden'); }, 1400);
  };
  tap($('over-menu'), () => { refreshGB(); document.body.classList.remove('cutscene'); $('over').classList.add('hidden'); G.state = 'menu'; show('menu'); backToMain(); clearFloats(); });

  // ---------------- HUD ----------------
  const RES_KEYS = ['wood', 'stone', 'iron', 'coal', 'food', 'coins'];
  const chips = {};
  function buildResChips() {
    const r = $('res'); r.innerHTML = '';
    RES_KEYS.forEach(k => { const v = h('span', null, '0'); const c = h('div', { cls: 'chip' + (k === 'coins' ? ' coins' : ''), title: RES_INFO[k].name }, h('span', { cls: 'ic', html: RES_INFO[k].icon }), v); chips[k] = { c, v }; r.append(c); });
  }
  let hudT = 0;
  UI.hud = function (dt) {
    const S = G.S(), P = G.player(); if (!S || !P) return;
    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.12;
      const cap = G.cap();
      RES_KEYS.forEach(k => { const v = Math.floor(S.res[k]); if (chips[k].v.textContent !== String(v)) chips[k].v.textContent = v; chips[k].c.classList.toggle('full', k !== 'coins' && v >= cap); });
      const core = G.core();
      const f = core ? core.hp / core.maxHp : 0;
      const bh = $('basehp'); bh.style.width = (f * 100) + '%'; bh.className = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : '';
      $('basehptxt').textContent = core ? `${Math.ceil(core.hp)} / ${core.maxHp}` : '0';
      const wi = $('waveinfo');
      if (S.waveActive) { wi.textContent = tr('wave_on', { n: S.wave, k: G.enemiesLeft() }); wi.classList.add('alarm'); }
      else { const t = Math.max(0, Math.ceil(S.waveTimer)); wi.textContent = tr('wave_in', { n: S.wave, t: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }); wi.classList.remove('alarm'); }
      $('btn-wave').classList.toggle('hidden', S.waveActive);
      const ph = P.hp / P.maxHp; const pe = $('php'); pe.style.width = (ph * 100) + '%'; pe.className = ph < 0.3 ? 'low' : ph < 0.6 ? 'mid' : '';
      $('phptxt').textContent = P.dead ? tr('wounded') : `${Math.ceil(P.hp)}/${P.maxHp}`;
      const dl = World.daylight;
      const dc = G.dayClock(), mmss = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
      $('daytxt').innerHTML = `${dc.night || G.eternalNight() ? '🌙' : '☀️'} ${tr('goal_day', { n: S.day })} · ${G.diff().icon}<br><small>${G.eternalNight() ? tr('eternal') : tr(dc.night ? 'morning_in' : 'night_in', { t: mmss(dc.left) })}</small>`;
      const st = P.st / P.maxSt; $('pst').style.width = (st * 100) + '%'; $('pst').className = P.tired ? 'tired' : '';
      $('btn-run').classList.toggle('on', !!G.input.run);
      const boss = G.boss(); $('bossbar').classList.toggle('hidden', !boss);
      if (boss) { $('bossname').textContent = '☠️ ' + boss.d.name; $('bosshp').style.width = (boss.hp / boss.maxHp * 100) + '%'; }
      $('quest').innerHTML = `<b>${tr('quest')}</b> ${G.questText()}`;
      const birds = G.birds();
      $('birdcount').textContent = tr('bird_count', { n: birds.length, cap: G.birdCap(), c: birds.filter(b => b.cannon).length });
      // кнопка действия и инструмент
      const tool = G.playerTool();
      document.querySelectorAll('.slot').forEach(s => { s.classList.toggle('on', s.dataset.slot === tool); if (s.dataset.slot === 'pick') s.classList.toggle('locked', S.tools.pick < 0); });
      $('btn-act').textContent = tool === 'pick' ? '⛏️' : '🪓';
      // подсказка взаимодействия
      const b = G.building();
      $('buildbar').classList.toggle('hidden', !b);
      $('prompt').classList.toggle('hidden', !!b);
      if (b) {
        const cost = G.scaleCost(BUILD[b.t].cost);
        $('bb-info').innerHTML = `<b>${BUILD[b.t].name}${b.onWall ? tr('on_wall') : ''}</b><br>${costHtml(cost)}${b.valid ? '' : `<br><span class="bad">${b.reason}</span>`}`;
      } else {
        const t = G.interactTarget();
        const key = t ? t.id + ':' + t.lvl + ':' + (t.cannonId || 0) : '';
        if (key !== promptKey) {
          promptKey = key; const pr = $('prompt'); pr.innerHTML = '';
          if (t) { const btn = h('button', null, `✋ ${isTouch ? '' : '[E] '}${G.buildingLabel(t)}`); tap(btn, () => openBuildingPanel(t)); pr.append(btn); }
        }
      }
      // компас
      const tgt = G.questTarget(); const cp = $('compass');
      if (tgt && Math.hypot(tgt.x - P.pos.x, tgt.z - P.pos.z) > 25) {
        const yaw = G.camYaw(), dx = tgt.x - P.pos.x, dz = tgt.z - P.pos.z;
        const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw), sy = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const a = Math.atan2(sx, sy);
        cp.classList.remove('hidden');
        cp.style.transform = `translate(${Math.sin(a) * 110}px,${-Math.cos(a) * 110}px) rotate(${a - Math.PI / 2}rad)`;
      } else cp.classList.add('hidden');
    }
    updateBars(); updateFloats(dt);
  };
  let promptKey = '';
  function costHtml(cost) {
    const S = G.S();
    return Object.keys(cost).map(k => `<span class="${(S.res[k] || 0) < cost[k] ? 'no' : ''}">${RES_INFO[k].icon}${cost[k]}</span>`).join(' ') || tr('free');
  }
  // полоски здоровья над объектами
  const barPool = [];
  function updateBars() {
    const list = G.state === 'play' ? G.worldBars() : [];
    let i = 0;
    for (const b of list) {
      const s = G.project(b.p); if (!s) continue;
      let el = barPool[i]; if (!el) { el = h('div', { cls: 'wbar' }, h('i')); $('bars').append(el); barPool.push(el); }
      el.style.display = 'block'; el.style.transform = `translate(${s.x}px,${s.y}px)`; el.firstChild.style.width = (b.f * 100) + '%'; el.firstChild.style.background = b.c;
      i++;
    }
    for (; i < barPool.length; i++) barPool[i].style.display = 'none';
  }
  // всплывающий текст
  const floats = [];
  UI.floatText = function (pos, text, color) {
    if (floats.length > 30) return;
    const el = h('div', { cls: 'ft', style: `color:${color || '#fff'}`, html: text });
    $('floats').append(el); floats.push({ el, p: pos.clone(), t: 0 });
  };
  function updateFloats(dt) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; f.p.y += dt * 1.4;
      const s = G.project(f.p);
      if (f.t > 1.3 || !s) { f.el.remove(); floats.splice(i, 1); continue; }
      f.el.style.left = s.x + 'px'; f.el.style.top = s.y + 'px'; f.el.style.opacity = Math.min(1, (1.3 - f.t) * 2);
    }
  }
  function clearFloats() { floats.forEach(f => f.el.remove()); floats.length = 0; barPool.forEach(b => b.style.display = 'none'); }
  // уведомления
  function toast(msg, type = 'info', ms = 2400) {
    const box = $('toasts');
    if (box.children.length >= 4) box.firstChild.remove();
    const el = h('div', { cls: 'toast ' + type, html: msg }); box.append(el);
    setTimeout(() => el.remove(), ms);
  }
  UI.toast = toast;
  UI.banner = function (txt) { const el = h('div', { id: 'banner' }, txt); document.body.append(el); setTimeout(() => el.remove(), 2300); };
  UI.flash = function () { const f = $('flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 150); };
  UI.saveIcon = function () { const s = $('saveic'); s.style.opacity = 1; setTimeout(() => s.style.opacity = 0, 1200); };

  // ---------------- Модальные окна ----------------
  let modal = null;
  const modalOpen = () => !!modal;
  function openModal(title, tabs, render, tab) {
    modal = { title, tabs, render, tab: tab || (tabs.length ? tabs[0][0] : null) };
    $('modal').classList.remove('hidden'); G.paused = true; renderModal();
  }
  function renderModal() {
    if (!modal) return;
    $('mtitle').textContent = modal.title;
    const tb = $('mtabs'); tb.innerHTML = ''; tb.style.display = modal.tabs.length ? 'flex' : 'none';
    modal.tabs.forEach(([id, lbl]) => { const b = h('button', { cls: modal.tab === id ? 'on' : '' }, lbl); tap(b, () => { modal.tab = id; renderModal(); }); tb.append(b); });
    const body = $('mbody'); const st = body.scrollTop; body.innerHTML = ''; modal.render(body, modal.tab); body.scrollTop = st;
  }
  function closeModal() { modal = null; $('modal').classList.add('hidden'); G.paused = !$('pause').classList.contains('hidden'); }
  UI.closeModal = closeModal;
  tap($('mclose'), closeModal);
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  // Меню строительства
  function openBuildMenu() {
    G.cancelBuild();
    openModal(tr('m_build'), BUILD_CATS, (body, cat) => {
      const S = G.S(); const grid = h('div', { cls: 'grid' });
      Object.keys(BUILD).filter(t => BUILD[t].cat === cat).forEach(t => {
        const d = BUILD[t], cost = G.scaleCost(d.cost);
        let lock = '';
        if (d.req && !S.tech[d.req]) lock = tr('need_tech', { name: TECH[d.req].name });
        else if (G.countB(t) >= (d.max || 99)) lock = d.max === 1 ? tr('built_one') : tr('limit_hit', { n: d.max });
        const btn = h('button', { cls: 'btn' + (G.canAfford(cost) ? '' : ' gold') }, G.canAfford(cost) ? tr('b_build') : tr('b_choose'));
        if (lock) btn.disabled = true;
        tap(btn, () => { if (G.enterBuild(t)) { closeModal(); toast(isTouch ? tr('hint_place_touch') : tr('hint_place_pc'), 'info'); } });
        let extra = '';
        if (t === 'wall') extra = tr('levels_n', { s: WALL_LEVELS.map((l, i) => i + 1).join('→') });
        grid.append(h('div', { cls: 'item' + (lock ? ' lock' : '') }, h('div', { cls: 'ico' }, d.icon), h('div', { cls: 'nm' }, d.name), h('div', { cls: 'ds' }, d.desc + (extra ? ' ' + extra : '')),
          h('div', { cls: 'cost', html: costHtml(cost) }), lock ? h('div', { cls: 'ds' }, lock) : null,
          h('div', { cls: 'limit' + (G.countB(t) >= (d.max || 99) ? ' full' : '') }, tr('built_cnt', { n: G.countB(t), m: d.max || '∞' })), btn));
      });
      body.append(grid);
    });
  }
  UI.openBuildMenu = openBuildMenu;

  // Панель постройки
  function openBuildingPanel(b) {
    if (!b) { toast(tr('move_closer'), 'info'); return; }
    openModal(BUILD[b.t].icon + ' ' + G.buildingLabel(b), [], body => {
      if (!G.byId(b.id)) { closeModal(); return; }
      buildingSection(body, b);
      if (b.cannonId && G.byId(b.cannonId)) { body.append(h('hr')); buildingSection(body, G.byId(b.cannonId), true); }
    });
  }
  UI.openBuildingPanel = openBuildingPanel;
  function buildingSection(body, b, sub) {
    const S = G.S(), d = BUILD[b.t];
    const sect = h('div', { cls: 'sect' });
    if (sub) sect.append(h('h4', null, tr('cannon_on_wall') + G.buildingLabel(b)));
    sect.append(h('div', { cls: 'binfo' }, h('div', { cls: 'ico' }, d.icon), h('div', null,
      h('div', null, tr('durability', { a: Math.ceil(b.hp), b: b.maxHp })), h('div', { cls: 'hpline' }, h('i', { style: `width:${b.hp / b.maxHp * 100}%` })),
      h('div', { cls: 'ds', style: 'font-size:12px;margin-top:4px;max-width:420px' }, d.desc))));
    // характеристики
    if (b.t === 'cannon') {
      const L = CANNON_LEVELS[b.lvl - 1];
      sect.append(h('div', { style: 'margin-top:6px;font-size:13px' }, tr('cannon_stats', { d: L.dmg, r: L.rate, g: L.range, s: L.splash }) + (b.lvl >= 4 ? tr('cannon_auto') : tr('cannon_need'))));
    }
    if (b.t === 'farm') sect.append(h('div', null, tr('farm_info')));
    if (b.t === 'ballista') { const L = BALLISTA_LEVELS[b.lvl - 1]; sect.append(h('div', { style: 'margin-top:6px;font-size:13px' }, tr('turret_info', { name: L.name, d: L.dmg, r: L.rate, g: L.range, s: L.splash ? tr('blast', { s: L.splash }) : '' }))); }
    if (b.t === 'mineshaft') { const L = SHAFT_LEVELS[b.lvl - 1]; sect.append(h('div', { style: 'margin-top:6px', html: tr('mine_info', { a: RES_INFO.stone.icon, x: L.stone, b: RES_INFO.coal.icon, y: L.coal, c: RES_INFO.iron.icon, z: L.iron }) })); }
    if (b.t === 'gate') sect.append(h('div', { style: 'margin-top:6px;font-size:13px' }, tr('gate_info')));
    if (b.t === 'minelift') sect.append(h('div', { html: tr('mine_info', { a: RES_INFO.stone.icon, x: 6, b: RES_INFO.coal.icon, y: 14, c: RES_INFO.iron.icon, z: 24 }) }));
    if (b.t === 'storage') sect.append(h('div', null, tr('cap_info', { n: G.cap() })));
    if (d.cap) sect.append(h('div', null, tr('bird_slots', { n: d.cap, t: G.birdCap() })));
    const acts = h('div', { cls: 'acts' });
    const up = G.upgradeCost(b);
    if (up) {
      const locked = up.req && !S.tech[up.req];
      const btn = h('button', { cls: 'btn gold', html: tr('upgrade_to', { name: up.name, cost: costHtml(up.cost) }) + (locked ? ` <br><small>🔒 ${TECH[up.req].name}</small>` : '') });
      tap(btn, () => { if (G.upgrade(b)) renderModal(); else renderModal(); });
      acts.append(btn);
    } else if (G.LEVELS[b.t]) acts.append(h('span', { cls: 'tag g' }, tr('max_level')));
    const rc = G.repairCost(b);
    if (rc) { const btn = h('button', { cls: 'btn blue', html: tr('repair', { cost: costHtml(rc) }) }); tap(btn, () => { G.repair(b); renderModal(); }); acts.append(btn); }
    if (b.t !== 'core') {
      const btn = h('button', { cls: 'btn red' }, tr('demolish')); let armed = false;
      tap(btn, () => { if (!armed) { armed = true; btn.textContent = tr('demolish_ok'); return; } G.demolish(b); closeModal(); });
      acts.append(btn);
    }
    sect.append(acts);
    if (b.t === 'cannon') sect.append(gunnerSection(b));
    if (b.t === 'workshop') { sect.append(h('hr')); renderWorkshop(sect); }
    if (b.t === 'market' || b.t === 'core' || b.t === 'birdhouse' || b.t === 'aviary') { const bb = h('button', { cls: 'btn', style: 'margin-top:8px' }, tr('market_btn')); tap(bb, () => openBirds('shop')); sect.append(bb); }
    if (b.t === 'core') { const bb = h('button', { cls: 'btn gold', style: 'margin:8px 0 0 8px' }, tr('eat_btn')); tap(bb, () => { G.eat(); renderModal(); }); sect.append(bb); }
    body.append(sect);
  }
  function gunnerSection(c) {
    const box = h('div', { cls: 'sect', style: 'margin-top:10px' }, h('h4', null, tr('gunner')));
    if (c.gunner) {
      const bs = BIRDS[c.gunner.sp];
      const btn = h('button', { cls: 'btn red' }, tr('take_off')); tap(btn, () => { G.unassignBird(c.gunner); renderModal(); });
      box.append(h('div', { cls: 'bird-row' }, h('img', { cls: 'bird-pic', src: G.portrait(c.gunner.sp) }), h('div', { cls: 'info' }, h('b', null, bs.name), h('div', null, birdStats(bs))), btn));
    } else box.append(h('div', { style: 'margin-bottom:6px' }, tr('no_gunner')));
    const free = G.birds().filter(b => !b.cannon);
    if (!free.length) { const bb = h('button', { cls: 'btn' }, tr('buy_bird')); tap(bb, () => openBirds('shop')); box.append(bb); }
    free.forEach(bird => {
      const bs = BIRDS[bird.sp]; const btn = h('button', { cls: 'btn blue' }, c.gunner ? tr('replace') : tr('seat'));
      tap(btn, () => { G.assignBird(bird, c); renderModal(); });
      box.append(h('div', { cls: 'bird-row' }, h('img', { cls: 'bird-pic', src: G.portrait(bird.sp) }), h('div', { cls: 'info' }, h('b', null, bs.name), h('div', null, birdStats(bs))), btn));
    });
    return box;
  }
  const birdStats = bs => tr('bird_stats', { d: bs.dmg, r: bs.rate, g: bs.range });

  // Мастерская: инструменты и технологии
  function renderWorkshop(body) {
    const S = G.S();
    if (!G.hasWorkshop()) { body.append(h('div', { cls: 'perk' }, tr('ws_need'))); }
    const gear = h('div', { cls: 'sect' }, h('h4', null, tr('gear_title')));
    const gg = h('div', { cls: 'grid' });
    const G2 = S.gear || { own: {}, eq: null };
    Object.keys(GEAR).forEach(id => {
      const d = GEAR[id], own = G2.own[id], on = G2.eq === id;
      const btn = h('button', { cls: 'btn' + (own ? (on ? ' red' : ' blue') : ' gold') }, own ? (on ? tr('take_off2') : tr('put_on')) : tr('buy'));
      tap(btn, () => { G.buyGear(id); renderModal(); });
      gg.append(h('div', { cls: 'item' }, h('div', { cls: 'ico' }, d.icon), h('div', { cls: 'nm' }, d.name + (on ? ' ✔' : '')), h('div', { cls: 'ds' }, d.desc), own ? null : h('div', { cls: 'cost', html: costHtml(d.cost) }), btn));
    });
    gear.append(gg); body.append(gear);
    const tools = h('div', { cls: 'sect' }, h('h4', null, tr('tools')));
    const g1 = h('div', { cls: 'grid' });
    [['axe', AXES, '🪓'], ['pick', PICKS, '⛏️']].forEach(([k, list, ic]) => {
      const cur = S.tools[k], next = list[cur + 1];
      const curName = cur >= 0 ? list[cur].name : tr('none');
      const item = h('div', { cls: 'item' }, h('div', { cls: 'ico' }, ic), h('div', { cls: 'nm' }, tr('now', { name: curName })), h('div', { cls: 'ds' }, cur >= 0 ? tr('power', { n: list[cur].power }) : tr('pick_need')));
      if (next) {
        const cost = next.cost; const locked = next.req && !S.tech[next.req];
        item.append(h('div', { cls: 'cost', html: `→ ${next.name}: ${costHtml(cost)}` }));
        if (locked) item.append(h('div', { cls: 'ds' }, `🔒 ${TECH[next.req].name}`));
        const btn = h('button', { cls: 'btn' }, tr('craft')); btn.disabled = !G.hasWorkshop() || locked;
        tap(btn, () => { G.craftTool(k); renderModal(); }); item.append(btn);
      } else item.append(h('span', { cls: 'tag g' }, tr('best_tool')));
      g1.append(item);
    });
    tools.append(g1); body.append(tools);
    const tech = h('div', { cls: 'sect' }, h('h4', null, tr('techs')));
    const g2 = h('div', { cls: 'grid' });
    Object.keys(TECH).forEach(id => {
      const t = TECH[id]; const done = S.tech[id]; const locked = t.need && !S.tech[t.need];
      const item = h('div', { cls: 'item' + (locked ? ' lock' : '') }, h('div', { cls: 'nm' }, (done ? '✅ ' : '📜 ') + t.name), h('div', { cls: 'ds' }, t.desc));
      if (!done) {
        item.append(h('div', { cls: 'cost', html: costHtml(t.cost) }));
        if (locked) item.append(h('div', { cls: 'ds' }, tr('first_req', { name: TECH[t.need].name })));
        const btn = h('button', { cls: 'btn gold' }, tr('research')); btn.disabled = !G.hasWorkshop() || locked;
        tap(btn, () => { G.research(id); renderModal(); }); item.append(btn);
      }
      g2.append(item);
    });
    tech.append(g2); body.append(tech);
  }

  // Инвентарь
  function openInventory(tab) {
    openModal(tr('m_inv'), [['res', tr('tab_res')], ['work', tr('tab_work')], ['hero', tr('tab_hero')]], (body, t) => {
      const S = G.S();
      if (t === 'res') {
        const grid = h('div', { cls: 'grid' });
        RES_KEYS.forEach(k => grid.append(h('div', { cls: 'item' }, h('div', { cls: 'ico', html: RES_INFO[k].icon }), h('div', { cls: 'nm' }, RES_INFO[k].name), h('div', { style: 'font-size:20px;font-weight:900' }, `${Math.floor(S.res[k])}${k === 'coins' ? '' : ' / ' + G.cap()}`))));
        body.append(grid);
        const eat = h('button', { cls: 'btn gold', style: 'margin-top:10px' }, tr('eat_btn')); tap(eat, () => { G.eat(); renderModal(); });
        body.append(eat);
        body.append(h('div', { cls: 'perk', style: 'margin-top:10px' }, tr('where')));
      } else if (t === 'work') renderWorkshop(body);
      else {
        const hd = HEROES[S.hero], P = G.player();
        body.append(h('div', { cls: 'sect' }, h('h4', null, hd.name), h('div', null, hd.desc), h('div', { cls: 'perk' }, '⭐ ' + hd.perk),
          h('div', { style: 'margin-top:8px' }, tr('hero_line', { hp: Math.ceil(P.hp), max: P.maxHp, s: hd.speed, d: hd.dmg })),
          h('div', { style: 'margin-top:8px' }, tr('tools_line', { a: AXES[S.tools.axe].name, b: S.tools.pick >= 0 ? PICKS[S.tools.pick].name : tr('no_pick') })),
          h('div', { style: 'margin-top:8px' }, tr('tech_line', { a: Object.keys(TECH).filter(k => S.tech[k]).map(k => TECH[k].name).join(', ') || tr('none') })),
          h('div', { style: 'margin-top:8px' }, tr('world_line', { b: G.worldInfo().biome, s: G.worldInfo().seed })),
          h('div', { style: 'margin-top:8px' }, tr('stats_line', { w: S.wave, d: S.day, k: S.stats.kills, b: S.stats.built }))));
      }
    }, tab);
  }
  UI.openInventory = openInventory;

  // Птицы
  function openBirds(tab) {
    openModal(tr('m_birds'), [['mine', tr('tab_mine')], ['shop', tr('tab_shop')]], (body, t) => {
      const S = G.S();
      if (t === 'mine') {
        const birds = G.birds();
        body.append(h('div', { style: 'margin-bottom:8px' }, tr('birds_info', { n: birds.length, cap: G.birdCap(), f: G.freeCannons().length })));
        if (!birds.length) body.append(h('div', { cls: 'perk' }, tr('no_birds')));
        birds.forEach(bird => {
          const bs = BIRDS[bird.sp];
          const status = bird.cannon ? h('span', { cls: 'tag g' }, tr('st_cannon')) : h('span', { cls: 'tag' }, bird.hidden ? tr('st_hide') : tr('st_walk'));
          const acts = h('div', { cls: 'acts', style: 'margin:0' });
          if (bird.cannon) { const b = h('button', { cls: 'btn red' }, tr('remove')); tap(b, () => { G.unassignBird(bird); renderModal(); }); acts.append(b); }
          else { const fc = G.freeCannons()[0]; const b = h('button', { cls: 'btn blue' }, tr('to_cannon')); b.disabled = !fc; tap(b, () => { G.assignBird(bird, G.freeCannons()[0]); renderModal(); }); acts.append(b); }
          const rel = h('button', { cls: 'btn gold' }, tr('release', { n: Math.floor(bs.price * 0.4) })); tap(rel, () => { G.releaseBird(bird); renderModal(); }); acts.append(rel);
          body.append(h('div', { cls: 'bird-row' }, h('img', { cls: 'bird-pic', src: G.portrait(bird.sp) }),
            h('div', { cls: 'info' }, h('b', null, bs.name), status, h('div', null, `❤️ ${Math.ceil(bird.hp)}/${bird.maxHp}`), h('div', { style: 'font-size:11px' }, birdStats(bs))), acts));
        });
      } else {
        const hasMarket = G.countB('market') > 0;
        body.append(h('div', { style: 'margin-bottom:8px' }, tr('shop_info', { n: G.birds().length, cap: G.birdCap() }) + (hasMarket ? '' : tr('shop_rare'))));
        const grid = h('div', { cls: 'grid' });
        BIRD_ORDER.forEach(sp => {
          const bs = BIRDS[sp]; const cost = { coins: bs.price, food: bs.food }; const locked = bs.market && !hasMarket;
          const btn = h('button', { cls: 'btn' }, tr('buy')); btn.disabled = locked;
          tap(btn, () => { G.buyBird(sp); renderModal(); });
          grid.append(h('div', { cls: 'item' + (locked ? ' lock' : '') }, h('img', { cls: 'bird-pic', src: G.portrait(sp) }), h('div', { cls: 'nm' }, bs.name),
            h('div', { cls: 'ds' }, bs.desc), h('div', { style: 'font-size:11px' }, birdStats(bs) + ` · ❤️${bs.hp}`), h('div', { cls: 'cost', html: costHtml(cost) }), locked ? h('div', { cls: 'ds' }, tr('need_market')) : null, btn));
        });
        body.append(grid);
      }
    }, tab);
  }
  UI.openBirds = openBirds;

  // ---------------- Кнопки HUD ----------------
  document.querySelectorAll('.slot').forEach(s => press(s, () => {
    const k = s.dataset.slot;
    if (k === 'axe' || k === 'pick') G.selectTool(k);
    if (k === 'build') openBuildMenu();
    if (k === 'inv') openInventory();
    if (k === 'birds') openBirds();
  }));
  press($('btn-use'), () => openBuildingPanel(G.interactTarget()));
  press($('btn-run'), () => { const P = G.player(); if (P && P.tired) { toast(tr('no_stamina'), 'warn'); return; } G.input.run = !G.input.run; });
  tap($('btn-wave'), () => { G.startWaveNow(); toast(tr('wave_early'), 'warn'); });
  press($('bb-rot'), () => G.rotateBuild());
  press($('bb-place'), () => G.placeBuild());
  press($('bb-cancel'), () => G.cancelBuild());
  const act = $('btn-act');
  const actOn = e => { e.preventDefault(); e.stopPropagation(); Sound.init(); G.input.action = true; };
  const actOff = e => { e.preventDefault(); G.input.action = false; };
  act.addEventListener('pointerdown', actOn); act.addEventListener('pointerup', actOff); act.addEventListener('pointerleave', actOff); act.addEventListener('pointercancel', actOff);

  // ---------------- Сенсорные стики и мышь ----------------
  const sticks = { L: { el: $('stickL'), id: null, ox: 0, oy: 0 }, R: { el: $('stickR'), id: null, ox: 0, oy: 0, lx: 0, ly: 0 } };
  function placeIdleSticks() {
    const W = window.innerWidth, H = window.innerHeight;
    R = 55 * (G.settings.uiScale || 100) / 100;
    if (!isTouch) { sticks.L.el.style.display = sticks.R.el.style.display = 'none'; return; }
    if (sticks.L.id === null) setStick(sticks.L, Math.max(100, W * 0.12), H - Math.max(110, H * 0.24));
    if (sticks.R.id === null) setStick(sticks.R, W - Math.max(190, W * 0.22), H - Math.max(150, H * 0.33));
  }
  function setStick(s, x, y) { s.ox = x; s.oy = y; s.el.style.left = x + 'px'; s.el.style.top = y + 'px'; s.el.querySelector('.knob').style.transform = ''; }
  let R = 55;
  const touchLayer = $('touch');
  let mouse = null;
  touchLayer.addEventListener('pointerdown', e => {
    Sound.init();
    if (G.state === 'select') { mouse = { id: e.pointerId, x: e.clientX, sel: true }; try { touchLayer.setPointerCapture(e.pointerId); } catch (_) { } return; }
    if (G.state !== 'play' || G.paused) return;
    try { touchLayer.setPointerCapture(e.pointerId); } catch (_) { }
    if (e.pointerType === 'mouse') { mouse = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; return; }
    const left = e.clientX < window.innerWidth * 0.45;
    const s = left ? sticks.L : sticks.R;
    if (s.id !== null) return;
    s.id = e.pointerId; setStick(s, e.clientX, e.clientY); s.el.classList.add('active'); s.lx = e.clientX; s.ly = e.clientY;
  });
  touchLayer.addEventListener('pointermove', e => {
    if (mouse && mouse.id === e.pointerId) {
      if (mouse.sel) { G.selRot += (e.clientX - mouse.x) * 0.012; mouse.x = e.clientX; return; }
      const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y; mouse.moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.005 * G.settings.sens / 100;
      G.camRotate(dx * k, dy * k); mouse.x = e.clientX; mouse.y = e.clientY; return;
    }
    for (const key of ['L', 'R']) {
      const s = sticks[key]; if (s.id !== e.pointerId) continue;
      let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      s.el.querySelector('.knob').style.transform = `translate(${dx}px,${dy}px)`;
      if (key === 'L') { G.input.mx = dx / R; G.input.mz = -dy / R; }
      else {
        // камера: и как стик (непрерывно), и как свайп
        const k = G.settings.sens / 100;
        G.input.camX = (dx / R) * k; G.input.camY = (dy / R) * 0.8 * k;
        G.camRotate((e.clientX - s.lx) * 0.004 * k, (e.clientY - s.ly) * 0.003 * k);
        s.lx = e.clientX; s.ly = e.clientY;
      }
    }
  });
  function release(e) {
    if (mouse && mouse.id === e.pointerId) {
      if (!mouse.sel && mouse.moved < 6 && mouse.btn === 0 && G.state === 'play' && !G.paused) {
        if (G.building()) G.placeBuild(); else { G.input.action = true; setTimeout(() => { if (!keys[' ']) G.input.action = false; }, 250); }
      }
      mouse = null; return;
    }
    for (const key of ['L', 'R']) {
      const s = sticks[key]; if (s.id !== e.pointerId) continue;
      s.id = null; s.el.classList.remove('active');
      if (key === 'L') { G.input.mx = 0; G.input.mz = 0; } else { G.input.camX = 0; G.input.camY = 0; }
      placeIdleSticks();
    }
  }
  touchLayer.addEventListener('pointerup', release); touchLayer.addEventListener('pointercancel', release);
  touchLayer.addEventListener('wheel', e => { if (G.state === 'play') G.camZoom(e.deltaY * 0.01); }, { passive: true });
  touchLayer.addEventListener('contextmenu', e => e.preventDefault());
  // защита от системных жестов
  document.addEventListener('touchmove', e => { if (!e.target.closest('#mbody,#settings .card,#mtabs,#heroCard')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());

  // ---------------- Клавиатура ----------------
  const keys = {};
  function updKeys() {
    if (sticks.L.id !== null) return;
    G.input.mx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    G.input.mz = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    if (keys.shift !== undefined) { if (keys.shift && !G.input._kRun) G.input.run = true; if (!keys.shift && G.input._kRun) G.input.run = false; G.input._kRun = !!keys.shift; }
  }
  const KEYMAP = { 'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'у': 'e', 'и': 'b', 'ш': 'i', 'з': 'p', 'к': 'r', 'а': 'f', 'т': 'n' };
  window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase(); k = KEYMAP[k] || k;
    if (e.code === 'KeyW') k = 'w'; if (e.code === 'KeyA') k = 'a'; if (e.code === 'KeyS') k = 's'; if (e.code === 'KeyD') k = 'd';
    if (e.code === 'KeyE') k = 'e'; if (e.code === 'KeyB') k = 'b'; if (e.code === 'KeyI') k = 'i'; if (e.code === 'KeyP') k = 'p'; if (e.code === 'KeyR') k = 'r'; if (e.code === 'KeyF') k = 'f'; if (e.code === 'KeyN') k = 'n';
    Sound.init();
    if (k === 'escape') {
      if (G.state === 'cutscene') { if ($('pause').classList.contains('hidden')) openPause(); else closePause(); return; }
      if (G.state !== 'play') return;
      if (modal) closeModal(); else if (G.building()) G.cancelBuild(); else if (!$('settings').classList.contains('hidden')) { $('settings').classList.add('hidden'); $('pause').classList.remove('hidden'); } else if ($('pause').classList.contains('hidden')) openPause(); else closePause();
      return;
    }
    if (G.state !== 'play' || G.paused) { if (modal && (k === 'b' || k === 'i' || k === 'p')) closeModal(); return; }
    if (e.repeat && !['w', 'a', 's', 'd'].includes(k)) return;
    keys[k] = true; if (e.key === ' ') { keys[' '] = true; G.input.action = true; e.preventDefault(); }
    if (k === 'e') openBuildingPanel(G.interactTarget());
    if (k === 'b') openBuildMenu();
    if (k === 'i') openInventory();
    if (k === 'p') openBirds();
    if (k === 'r') G.rotateBuild();
    if (k === 'f') G.eat();
    if (k === 'v' || k === 'м') $('btn-view').click();
    if (k === 'n') G.startWaveNow();
    if (k === 'enter' && G.building()) G.placeBuild();
    if (k === '1') G.selectTool('axe'); if (k === '2') G.selectTool('pick');
    updKeys();
  });
  window.addEventListener('keyup', e => {
    let k = e.key.toLowerCase(); k = KEYMAP[k] || k;
    if (e.code === 'KeyW') k = 'w'; if (e.code === 'KeyA') k = 'a'; if (e.code === 'KeyS') k = 's'; if (e.code === 'KeyD') k = 'd';
    keys[k] = false; if (e.key === ' ') { keys[' '] = false; G.input.action = false; }
    updKeys();
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; updKeys(); G.input.action = false; });
  // автосохранение при сворачивании (важно для телефона)
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') { G.save(true); if (!modal) openPause(); } });
  window.addEventListener('pagehide', () => { if (G.state === 'play') G.save(true); });
  if (!isTouch) { $('btn-act').title = 'Space / LMB'; }
})();
