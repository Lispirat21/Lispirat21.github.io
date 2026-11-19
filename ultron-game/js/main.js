import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig, animate } from './rig.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const DEFAULT_MODEL = '../models/sentinel/export/sentinel_lod1.glb';
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');

// ------------------------------------------------------------------ save
const SAVE_KEY = 'iron_protocol_save_v1';
const save = Object.assign({ unlocked: 1, best: {}, freeBest: 0, last: 0,
  settings: { music: 0.6, sfx: 0.8, sens: 1, quality: IS_TOUCH ? 'mid' : 'high', name: 'SENTINEL' } }, (() => {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
})());
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

// custom model storage (IndexedDB, device-local only)
const idb = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('iron_protocol', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) { try { const db = await this.open(); return await new Promise((res) => { const q = db.transaction('files').objectStore('files').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async del(k) { try { const db = await this.open(); db.transaction('files', 'readwrite').objectStore('files').delete(k); } catch {} },
};

// ------------------------------------------------------------------ renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.06);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function applyQuality() {
  const q = save.settings.quality;
  const pr = q === 'low' ? 1 : q === 'mid' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  renderer.shadowMap.enabled = q !== 'low';
  bloom.enabled = true;
  bloom.strength = q === "low" ? 0.55 : 0.7;
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ lights
const hemi = new THREE.HemisphereLight(0x8aa0c0, 0x100808, 0.0);
scene.add(hemi);
const keyLight = new THREE.DirectionalLight(0xffe2cc, 0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
keyLight.shadow.bias = -0.0004;
scene.add(keyLight, keyLight.target);
// menu rim lights
const rimA = new THREE.SpotLight(0xff3020, 0, 12, 0.5, 0.8, 1.2); rimA.position.set(-1.8, 3.2, -2.4);
const rimB = new THREE.SpotLight(0x6f8cff, 0, 12, 0.5, 0.8, 1.2); rimB.position.set(2.2, 2.8, -2.2);
const under = new THREE.PointLight(0xff2210, 0, 4, 2); under.position.set(0, 0.2, 1.2);
scene.add(rimA, rimB, under, rimA.target, rimB.target);
rimA.target.position.set(0, 1.4, 0); rimB.target.position.set(0, 1.4, 0);

// ------------------------------------------------------------------ hero
const hero = new THREE.Group();
scene.add(hero);
let rig = null, heroModel = null, heroHeight = 2.2;
const handPos = { L: new THREE.Vector3(), R: new THREE.Vector3() };

async function loadHero() {
  const loader = new GLTFLoader();
  let url = DEFAULT_MODEL, custom = false;
  const blob = await idb.get('heroModel');
  if (blob) { url = URL.createObjectURL(blob); custom = true; }
  let gltf;
  try { gltf = await loader.loadAsync(url); } catch (e) {
    if (custom) { toast('Не удалось загрузить свою модель — используется модель по умолчанию'); gltf = await loader.loadAsync(DEFAULT_MODEL); custom = false; }
    else throw e;
  }
  if (heroModel) hero.remove(heroModel);
  heroModel = gltf.scene;
  heroModel.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      [].concat(o.material).forEach((m) => { m.envMapIntensity = 0.7; if (m.map) m.map.anisotropy = 4; });
    }
  });
  // normalise height + feet on ground
  heroModel.updateMatrixWorld(true);
  const box = new THREE.Box3();
  heroModel.traverse((o) => {
    if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    else if (o.isMesh) box.expandByObject(o);
  });
  const h = box.max.y - box.min.y;
  const s = h > 0.2 && (h < 1.5 || h > 3.5) ? 2.2 / h : 1;
  heroModel.scale.setScalar(s);
  heroModel.position.y = -box.min.y * s;
  heroHeight = h * s;
  hero.add(heroModel);
  hero.position.set(0, 0, 0); hero.rotation.set(0, 0, 0);
  hero.updateMatrixWorld(true);
  rig = new Rig(hero, heroModel);
  $('modelInfo').textContent = custom
    ? `Своя модель: скелет ${rig.ok ? rig.type.toUpperCase() : 'не распознан (без анимации)'}, высота ${heroHeight.toFixed(2)} м.`
    : 'Сейчас: модель по умолчанию (Sentinel).';
}

// ------------------------------------------------------------------ arena
const arena = new THREE.Group();
arena.visible = false;
scene.add(arena);
const OBST = [];
(function buildArena() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},255,${Math.random() * 0.025})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 2 + Math.random() * 6); }
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 30); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.3 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; arena.add(ground);
  // glowing ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(39.6, 40, 128), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; arena.add(ring);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.45, metalness: 0.85 });
  const strip = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2010, emissiveIntensity: 3 });
  // pillars and wall fragments
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + rand(-0.15, 0.15), r = rand(14, 32);
    const w = rand(1.4, 3.2), h = rand(3, 9), d = rand(1.4, 3.2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); m.rotation.y = rand(0, Math.PI);
    m.castShadow = m.receiveShadow = true; arena.add(m);
    const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), strip);
    s.position.copy(m.position); s.position.y = h * rand(0.3, 0.8); s.rotation.y = m.rotation.y; arena.add(s);
    OBST.push({ x: m.position.x, z: m.position.z, r: Math.max(w, d) * 0.62 });
  }
  // distant towers
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.9 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), r = rand(60, 110), h = rand(15, 60), w = rand(4, 10);
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
    t.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); arena.add(t);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lamp); l.position.set(t.position.x, h + 0.5, t.position.z); arena.add(l);
  }
  // red pools of light
  for (let i = 0; i < 4; i++) {
    const p = new THREE.PointLight(0xff2a10, 6, 18, 2);
    p.position.set(Math.cos(i * 1.57 + 0.6) * 18, 2.5, Math.sin(i * 1.57 + 0.6) * 18); arena.add(p);
  }
})();

// ------------------------------------------------------------------ fx
const fxGroup = new THREE.Group(); scene.add(fxGroup);
const particles = [];
const sparkGeo = new THREE.SphereGeometry(0.06, 6, 4);
function burst(pos, color = 0xff4a20, n = 18, speed = 7, life = 0.6, size = 1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(pos); m.scale.setScalar(size * rand(0.6, 1.6));
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.6, 1.2), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
    fxGroup.add(m); particles.push({ m, v, life, max: life });
  }
}
function shockwave(pos, color = 0xff3a20, r = 4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.45, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  m.position.copy(pos); m.lookAt(camera.position); fxGroup.add(m);
  particles.push({ m, v: null, life: 0.45, max: 0.45, grow: r });
}
function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.v) { p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); }
    if (p.grow) p.m.scale.setScalar(1 + (1 - p.life / p.max) * p.grow * 3);
    p.m.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) { fxGroup.remove(p.m); if (p.grow) { p.m.geometry.dispose(); p.m.material.dispose(); } particles.splice(i, 1); }
  }
}
let shake = 0;

// ------------------------------------------------------------------ projectiles
const bolts = [];
const boltGeo = new THREE.SphereGeometry(1, 12, 8);
function spawnBolt(from, dir, opts) {
  const mat = new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(boltGeo, mat);
  m.scale.set(opts.r, opts.r, opts.r * 3.5);
  m.position.copy(from); m.lookAt(from.clone().add(dir));
  const light = opts.light ? new THREE.PointLight(opts.color, 3, 5, 2) : null;
  if (light) m.add(light);
  scene.add(m);
  bolts.push({ m, vel: dir.clone().multiplyScalar(opts.speed), life: opts.life || 2.5, dmg: opts.dmg, enemy: opts.enemy, r: opts.r, homing: opts.homing || null });
}

// ------------------------------------------------------------------ enemies
const enemies = [];
const eMat = {
  body: new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.35, metalness: 0.9 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x5a5f69, roughness: 0.3, metalness: 1 }),
};
function makeEnemyMesh(type) {
  const g = new THREE.Group();
  const big = type === 'heavy' ? 1.7 : type === 'boss' ? 4.2 : 1;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: type === 'heavy' ? 0xff7a10 : 0xff2010, emissiveIntensity: 5 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * big, 1), eMat.body); body.castShadow = true; g.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16 * big, 16, 12), eyeMat); eye.position.z = 0.34 * big; g.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 * big, 0.05 * big, 8, 40), eMat.trim); g.add(ring);
  for (let i = 0; i < (type === 'boss' ? 8 : 4); i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08 * big, 0.5 * big, 0.3 * big), eMat.trim);
    const a = i / (type === 'boss' ? 8 : 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.5 * big, Math.sin(a) * 0.5 * big, -0.1 * big); fin.rotation.z = a; g.add(fin);
  }
  if (type === 'boss') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 80), eyeMat); g.add(halo);
    g.userData.halo = halo;
  }
  g.userData.ring = ring; g.userData.eye = eyeMat; g.userData.big = big;
  return g;
}
function spawnEnemy(type, pos) {
  const m = makeEnemyMesh(type);
  const p = pos || (() => { const a = rand(0, Math.PI * 2), r = rand(18, 30); return new THREE.Vector3(Math.cos(a) * r + player.pos.x * 0.3, rand(3, 6), Math.sin(a) * r + player.pos.z * 0.3); })();
  m.position.copy(p);
  scene.add(m);
  const hp = type === 'drone' ? 40 : type === 'heavy' ? 140 : type === 'core' ? 120 : 900;
  const e = { type, m, hp, max: hp, alt: rand(2.2, 4.6), fire: rand(1.2, 2.6), charge: rand(4, 9), state: 'hover', t: 0, flash: 0, orbit: Math.random() < 0.5 ? 1 : -1, r: 0.6 * m.userData.big, vel: new THREE.Vector3() };
  if (type === 'core') {
    m.clear();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.2, 8), eMat.body); base.position.y = 0.6; base.castShadow = true; m.add(base);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.2, 8), eMat.trim); pillar.position.y = 2.2; m.add(pillar);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 4 });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), eyeMat); orb.position.y = 3.6; m.add(orb);
    m.userData.eye = eyeMat; m.userData.orb = orb; m.position.y = 0; e.r = 1.2; e.alt = 0;
    OBST.push(e.obst = { x: m.position.x, z: m.position.z, r: 1.3 });
  }
  enemies.push(e);
  return e;
}
function killEnemy(e, idx) {
  const c = e.m.position.clone(); if (e.type === 'core') c.y = 3;
  burst(c, 0xff5a20, e.type === 'drone' ? 26 : 60, e.type === 'drone' ? 9 : 14, 0.8, e.type === 'drone' ? 1 : 2);
  burst(c, 0xffd0a0, 10, 5, 0.4);
  shockwave(c, 0xff4020, e.type === 'boss' ? 12 : 3);
  audio.play('boom'); shake = Math.max(shake, e.type === 'drone' ? 0.25 : 0.7);
  scene.remove(e.m);
  if (e.obst) OBST.splice(OBST.indexOf(e.obst), 1);
  enemies.splice(idx, 1);
  game.kills++;
  game.score += e.type === 'drone' ? 100 : e.type === 'heavy' ? 350 : e.type === 'core' ? 500 : 5000;
  if (Math.random() < (e.type === 'drone' ? 0.25 : 0.8)) spawnPickup(c);
  mission.onKill(e);
}
const pickups = [];
function spawnPickup(pos) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x30ff90, emissiveIntensity: 3 }));
  m.position.copy(pos); m.position.y = Math.max(0.8, Math.min(pos.y, 2));
  scene.add(m); pickups.push({ m, t: 0 });
}
function damageEnemy(e, dmg, from) {
  e.hp -= dmg; e.flash = 0.12;
  if (from && e.type !== 'core' && e.type !== 'boss') e.vel.add(e.m.position.clone().sub(from).setY(0.2).normalize().multiplyScalar(dmg > 25 ? 10 : 4));
  const idx = enemies.indexOf(e);
  if (e.hp <= 0 && idx >= 0) killEnemy(e, idx);
}

function updateEnemies(dt) {
  const target = player.pos.clone(); target.y += 1.3;
  for (const e of enemies) {
    e.t += dt;
    const m = e.m;
    e.flash = Math.max(0, e.flash - dt);
    m.userData.eye.emissiveIntensity = e.flash > 0 ? 14 : (e.type === 'core' ? 3 + Math.sin(e.t * 4) * 1.5 : 5);
    if (e.type === 'core') { m.userData.orb.rotation.y += dt; m.userData.orb.position.y = 3.6 + Math.sin(e.t * 2) * 0.15; continue; }
    if (m.userData.ring) { m.userData.ring.rotation.x += dt * 2; m.userData.ring.rotation.y += dt * 1.3; }
    if (m.userData.halo) { m.userData.halo.rotation.z += dt * 0.6; m.userData.halo.rotation.x = Math.sin(e.t * 0.4) * 0.4; }
    const to = target.clone().sub(m.position);
    const dist = to.length();
    const dirFlat = to.clone().setY(0).normalize();
    let desired = new THREE.Vector3();
    if (e.type === 'boss') {
      const ang = e.t * 0.25;
      desired.set(Math.cos(ang) * 16, 7 + Math.sin(e.t * 0.7) * 1.5, Math.sin(ang) * 16).sub(m.position).multiplyScalar(0.8);
      e.fire -= dt;
      if (e.fire <= 0) {
        const phase = e.hp < e.max * 0.5 ? 2 : 1;
        const pattern = Math.floor(e.t / 6) % 3;
        if (pattern === 0) { // radial burst
          const n = phase === 2 ? 20 : 14;
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + e.t; spawnBolt(m.position, new THREE.Vector3(Math.cos(a), -0.25, Math.sin(a)).normalize(), { color: 0xff6a20, r: 0.22, speed: 11, dmg: 9, enemy: true }); }
          e.fire = phase === 2 ? 1.6 : 2.2;
        } else if (pattern === 1) { // aimed volley
          for (let i = -2; i <= 2; i++) { const d = to.clone().normalize(); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.09); spawnBolt(m.position, d, { color: 0xff2a10, r: 0.2, speed: 20, dmg: 8, enemy: true }); }
          e.fire = phase === 2 ? 0.8 : 1.2;
        } else { // summon
          if (enemies.length < 7) { spawnEnemy('drone', m.position.clone().add(new THREE.Vector3(rand(-3, 3), -1, rand(-3, 3)))); }
          e.fire = 2.5;
        }
        audio.play('ebolt');
      }
    } else if (e.state === 'charge') {
      desired = to.clone().normalize().multiplyScalar(16);
      if (dist < 1.4) {
        if (player.hurt(e.type === 'heavy' ? 18 : 10, m.position)) { e.state = 'retreat'; e.t = 0; }
        else { e.state = 'retreat'; e.t = 0; }
      }
      if (e.t > 2.2) { e.state = 'retreat'; e.t = 0; }
    } else {
      if (e.state === 'retreat' && e.t > 1.2) e.state = 'hover';
      const want = e.type === 'heavy' ? 13 : 9;
      const radial = dist - want;
      const side = new THREE.Vector3(-dirFlat.z, 0, dirFlat.x).multiplyScalar(e.orbit * 3);
      desired.copy(dirFlat).multiplyScalar(radial * 1.2).add(side);
      desired.y = (player.pos.y + e.alt - m.position.y) * 2;
      if (e.state === 'retreat') desired.add(dirFlat.clone().multiplyScalar(-8));
      e.fire -= dt;
      if (e.fire < 0.35) m.userData.eye.emissiveIntensity = 10 + Math.sin(e.t * 60) * 4; // telegraph
      if (e.fire <= 0 && dist < 34) {
        const shots = e.type === 'heavy' ? 3 : 1;
        for (let i = 0; i < shots; i++) setTimeout(() => {
          if (!enemies.includes(e)) return;
          const d = target.clone().sub(m.position).normalize();
          d.x += rand(-0.03, 0.03); d.y += rand(-0.03, 0.03);
          spawnBolt(m.position.clone().add(d.clone().multiplyScalar(0.6 * m.userData.big)), d.normalize(), { color: e.type === 'heavy' ? 0xff8a20 : 0xff3020, r: 0.13, speed: e.type === 'heavy' ? 17 : 15, dmg: e.type === 'heavy' ? 9 : 7, enemy: true });
          audio.play('ebolt');
        }, i * 160);
        e.fire = e.type === 'heavy' ? rand(2.6, 3.4) : rand(1.6, 2.8);
      }
      e.charge -= dt;
      if (e.charge <= 0 && dist < 22 && e.type === 'drone') { e.state = 'charge'; e.t = 0; e.charge = rand(6, 11); }
    }
    e.vel.lerp(desired, Math.min(1, dt * (e.state === 'charge' ? 4 : 1.8)));
    m.position.addScaledVector(e.vel, dt);
    m.position.y = Math.max(m.position.y, 0.8);
    // separation
    for (const o of enemies) if (o !== e && o.type !== 'core') {
      const d = m.position.clone().sub(o.m.position); const l = d.length();
      if (l < 1.6 * m.userData.big && l > 0.001) m.position.addScaledVector(d.normalize(), (1.6 * m.userData.big - l) * 0.5);
    }
    m.lookAt(target);
  }
}

// ------------------------------------------------------------------ player
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, hp: 100, en: 100, fly: false, flyW: 0, speed: 0, phase: 0,
  attack: null, combo: 0, comboT: 0, blastCd: 0, dashT: 0, dashCd: 0, inv: 0, hitW: 0, dead: false, deadT: 0, blastSide: 'R',
  reset() {
    Object.assign(this, { hp: 100, en: 100, fly: false, flyW: 0, speed: 0, attack: null, combo: 0, comboT: 0, blastCd: 0, dashT: 0, dashCd: 0, inv: 0, hitW: 0, dead: false, deadT: 0 });
    this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); this.yaw = 0;
  },
  hurt(d, from) {
    if (this.inv > 0 || this.dead || this.dashT > 0) return false;
    this.hp -= d; this.inv = 0.35; this.hitW = 1;
    $('flash').style.opacity = 0.9; setTimeout(() => ($('flash').style.opacity = 0), 120);
    audio.play('hurt'); shake = Math.max(shake, 0.3);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deadT = 0; mission.onDeath(); }
    return true;
  },
};

// ------------------------------------------------------------------ input
const input = { keys: {}, move: new THREE.Vector2(), run: false, camYaw: Math.PI, camPitch: 0.25, up: false, down: false, stickId: null, lookId: null, lookLast: null };
addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (state.mode !== 'game') return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (game.paused) return;
  if (e.code === 'KeyJ') doPunch();
  if (e.code === 'KeyK') doBlast();
  if (e.code === 'KeyQ') doDash();
  if (e.code === 'KeyF') toggleFly();
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
let mouseDown = false, mouseMoved = 0;
canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'game' || IS_TOUCH) return;
  mouseDown = true; mouseMoved = 0;
  if (e.button === 2) doBlast();
});
addEventListener('mouseup', (e) => { if (mouseDown && e.button === 0 && mouseMoved < 6 && state.mode === 'game' && !game.paused) doPunch(); mouseDown = false; });
addEventListener('mousemove', (e) => {
  if (!mouseDown || state.mode !== 'game') return;
  mouseMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
  input.camYaw -= e.movementX * 0.005 * save.settings.sens;
  input.camPitch = clamp(input.camPitch + e.movementY * 0.004 * save.settings.sens, -0.6, 1.2);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { camDist = clamp(camDist + e.deltaY * 0.004, 3, 9); }, { passive: true });
let camDist = 5.2;

// touch: stick + look-drag + buttons
const stick = $('stick'), knob = $('knob');
function stickMove(t) {
  const r = stick.getBoundingClientRect();
  const dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
  const max = r.width / 2, l = Math.hypot(dx, dy), k = l > max ? max / l : 1;
  knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  input.move.set(dx * k / max, dy * k / max);
}
stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; input.stickId = t.identifier; stickMove(t); }, { passive: false });
canvas.addEventListener('touchstart', (e) => {
  if (state.mode !== 'game') return;
  for (const t of e.changedTouches) if (input.lookId === null) { input.lookId = t.identifier; input.lookLast = [t.clientX, t.clientY]; }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === input.stickId) stickMove(t);
    else if (t.identifier === input.lookId) {
      input.camYaw -= (t.clientX - input.lookLast[0]) * 0.007 * save.settings.sens;
      input.camPitch = clamp(input.camPitch + (t.clientY - input.lookLast[1]) * 0.005 * save.settings.sens, -0.6, 1.2);
      input.lookLast = [t.clientX, t.clientY];
    }
  }
}, { passive: true });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === input.stickId) { input.stickId = null; input.move.set(0, 0); knob.style.transform = ''; }
    if (t.identifier === input.lookId) input.lookId = null;
  }
});
const tbtn = (id, down, up) => {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); if (!game.paused) down(); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('on'); up && up(); }, { passive: false });
};
tbtn('bPunch', () => doPunch());
tbtn('bBlast', () => doBlast());
tbtn('bDash', () => doDash());
tbtn('bFly', () => toggleFly());
tbtn('bUp', () => (input.up = true), () => (input.up = false));
tbtn('bDown', () => (input.down = true), () => (input.down = false));

// ------------------------------------------------------------------ actions
function nearestEnemy(maxDist, coneDot, fromDir) {
  let best = null, bd = Infinity;
  const p = player.pos.clone(); p.y += 1.3;
  for (const e of enemies) {
    const c = e.m.position.clone(); if (e.type === 'core') c.y = 2.5;
    const d = c.clone().sub(p); const l = d.length();
    if (l > maxDist) continue;
    if (fromDir && d.normalize().dot(fromDir) < coneDot) continue;
    const score = l * (fromDir ? 1.5 - d.dot(fromDir) : 1);
    if (score < bd) { bd = score; best = e; }
  }
  return best;
}
function camForward() { return new THREE.Vector3(-Math.sin(input.camYaw) * Math.cos(input.camPitch), -Math.sin(input.camPitch) + 0.25, -Math.cos(input.camYaw) * Math.cos(input.camPitch)).normalize(); }
function doPunch() {
  if (player.dead || state.mode !== 'game') return;
  if (player.attack && player.attack.type === 'punch' && player.attack.p < 0.55) { player.queued = true; return; }
  player.combo = player.comboT > 0 ? (player.combo + 1) % 3 : 0;
  player.comboT = 0.9;
  const side = player.combo === 1 ? 'L' : 'R';
  player.attack = { type: 'punch', side, p: 0, dur: player.combo === 2 ? 0.55 : 0.42, w: 0, hitDone: false, power: player.combo === 2 };
  const t = nearestEnemy(6, 0.2, camForward().setY(0).normalize());
  if (t) { const d = t.m.position.clone().sub(player.pos); player.yaw = Math.atan2(d.x, d.z); if (d.setY(0).length() > 2.2 && !player.fly) player.vel.addScaledVector(d.normalize(), 9); if (player.fly) player.vel.add(t.m.position.clone().sub(player.pos).setY(t.m.position.y - player.pos.y - 1.2).multiplyScalar(2.2)); }
  audio.play('whoosh');
}
function doBlast() {
  if (player.dead || state.mode !== 'game' || player.blastCd > 0) return;
  if (player.en < 12) { toast('Мало энергии'); return; }
  player.en -= 12; player.blastCd = 0.28;
  player.blastSide = player.blastSide === 'R' ? 'L' : 'R';
  const f = camForward();
  const t = nearestEnemy(40, 0.55, f);
  const from = handPos[player.blastSide].clone();
  let dir;
  if (t) { const c = t.m.position.clone(); if (t.type === 'core') c.y = 3.4; dir = c.sub(from).normalize(); player.yaw = Math.atan2(dir.x, dir.z); }
  else { dir = f; player.yaw = Math.atan2(f.x, f.z); }
  player.attack = { type: 'blast', side: player.blastSide, p: 0, dur: 0.35, w: 0, aimPitch: clamp(dir.y, -0.6, 0.8) };
  spawnBolt(from, dir, { color: 0xff3020, r: 0.16, speed: 42, dmg: 22, enemy: false, light: true, homing: t });
  burst(from, 0xff5030, 6, 3, 0.2, 0.7);
  audio.play('blast');
}
function doDash() {
  if (player.dead || player.dashCd > 0 || state.mode !== 'game') return;
  const mv = moveVector();
  const d = mv.lengthSq() > 0.01 ? mv.normalize() : new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  player.vel.copy(d.multiplyScalar(22)); player.dashT = 0.22; player.dashCd = 0.7;
  audio.play('dash');
}
function toggleFly() {
  if (player.dead || state.mode !== 'game') return;
  player.fly = !player.fly;
  $('bFly').classList.toggle('on', player.fly);
  $('bUp').classList.toggle('hidden', !player.fly); $('bDown').classList.toggle('hidden', !player.fly);
  if (player.fly) { player.vel.y = 6; audio.play('fly'); }
}
function moveVector() {
  const k = input.keys;
  let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
  if (input.stickId !== null) { x = input.move.x; y = input.move.y; }
  const fwd = new THREE.Vector3(-Math.sin(input.camYaw), 0, -Math.cos(input.camYaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  return fwd.multiplyScalar(-y).add(right.multiplyScalar(x));
}

function updatePlayer(dt) {
  const p = player;
  p.inv = Math.max(0, p.inv - dt); p.blastCd = Math.max(0, p.blastCd - dt); p.dashCd = Math.max(0, p.dashCd - dt);
  p.comboT = Math.max(0, p.comboT - dt); p.hitW = Math.max(0, p.hitW - dt * 3);
  p.en = Math.min(100, p.en + dt * 16);
  if (p.dead) { p.deadT += dt; return; }
  const mv = moveVector();
  const mag = Math.min(1, mv.length());
  const running = input.keys.ShiftLeft || input.keys.ShiftRight || (input.stickId !== null && mag > 0.85);
  const maxSp = p.fly ? 12 : running ? 8.5 : 4.4;
  const attacking = p.attack && p.attack.type === 'punch';
  const target = mv.clone().normalize().multiplyScalar(mag * maxSp * (attacking ? 0.25 : 1));
  if (p.dashT > 0) p.dashT -= dt;
  else {
    const accel = p.fly ? 3 : 10;
    p.vel.x = lerp(p.vel.x, target.x, Math.min(1, dt * accel));
    p.vel.z = lerp(p.vel.z, target.z, Math.min(1, dt * accel));
  }
  if (p.fly) {
    const vy = ((input.keys.Space || input.up) ? 7 : 0) - ((input.keys.KeyC || input.keys.ControlLeft || input.down) ? 7 : 0);
    p.vel.y = lerp(p.vel.y, vy + Math.sin(game.time * 2) * 0.3, Math.min(1, dt * 3));
    if (p.pos.y > 30) p.vel.y = Math.min(p.vel.y, 0);
    if (p.pos.y <= 0.01 && vy < 0) { p.fly = false; toggleFly(); toggleFly(); p.fly = false; $('bFly').classList.remove('on'); $('bUp').classList.add('hidden'); $('bDown').classList.add('hidden'); }
  } else {
    p.vel.y -= 24 * dt;
  }
  p.pos.addScaledVector(p.vel, dt);
  if (p.pos.y < 0) { if (p.vel.y < -12) { shake = 0.3; burst(p.pos.clone().setY(0.1), 0x9999aa, 14, 5, 0.5); } p.pos.y = 0; p.vel.y = 0; }
  // arena bounds + obstacles
  const r = Math.hypot(p.pos.x, p.pos.z);
  if (r > 39) { p.pos.x *= 39 / r; p.pos.z *= 39 / r; }
  if (p.pos.y < 9) for (const o of OBST) {
    const dx = p.pos.x - o.x, dz = p.pos.z - o.z, d = Math.hypot(dx, dz), m = o.r + 0.5;
    if (d < m && d > 0.001) { p.pos.x = o.x + dx / d * m; p.pos.z = o.z + dz / d * m; }
  }
  // facing
  const hs = Math.hypot(p.vel.x, p.vel.z);
  if (hs > 0.5 && !p.attack) p.yaw = Math.atan2(p.vel.x, p.vel.z);
  hero.rotation.y = lerpAngle(hero.rotation.y, p.yaw, Math.min(1, dt * 12));
  hero.position.copy(p.pos);
  p.speed = p.fly ? 0 : hs / 4.4;
  p.phase += dt * (p.speed > 1 ? 11 : 7.5) * Math.min(1, p.speed + 0.01);
  p.flyW = lerp(p.flyW, p.fly ? 1 : 0, Math.min(1, dt * 4));
  // attacks
  if (p.attack) {
    const a = p.attack;
    a.p += dt / a.dur;
    a.w = a.p < 0.15 ? a.p / 0.15 : a.p > 0.8 ? Math.max(0, (1 - a.p) / 0.2) : 1;
    if (a.type === 'punch' && !a.hitDone && a.p > 0.45) {
      a.hitDone = true;
      const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const chest = p.pos.clone(); chest.y += 1.3;
      let hit = false;
      for (const e of [...enemies]) {
        const c = e.m.position.clone(); if (e.type === 'core') c.y = Math.min(Math.max(chest.y, 0.6), 3.6);
        const d = c.clone().sub(chest); const l = d.length();
        if (l < 2.6 + e.r && d.setY(0).normalize().dot(fwd) > 0.2) { damageEnemy(e, a.power ? 34 : 20, chest); hit = true; burst(c.lerp(chest, 0.3), 0xffc080, 10, 6, 0.3); }
      }
      if (hit) { audio.play('punch'); shake = Math.max(shake, a.power ? 0.35 : 0.18); hitstop = a.power ? 0.08 : 0.04; if (a.power) shockwave(chest.add(fwd.multiplyScalar(1.5)), 0xffa060, 2); }
    }
    if (a.p >= 1) { p.attack = null; if (p.queued) { p.queued = false; doPunch(); } }
  }
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
let hitstop = 0;

function updateBolts(dt) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    if (b.homing && enemies.includes(b.homing)) {
      const c = b.homing.m.position.clone(); if (b.homing.type === 'core') c.y = 3.4;
      const want = c.sub(b.m.position).normalize().multiplyScalar(b.vel.length());
      b.vel.lerp(want, Math.min(1, dt * 6));
      b.m.lookAt(b.m.position.clone().add(b.vel));
    }
    b.m.position.addScaledVector(b.vel, dt);
    let dead = b.life <= 0 || b.m.position.y < 0;
    if (b.enemy) {
      const c = player.pos.clone(); c.y += 1.2;
      if (b.m.position.distanceTo(c) < 0.65 + b.r) { player.hurt(b.dmg, b.m.position); dead = true; burst(b.m.position, 0xff6030, 8, 4, 0.3); }
    } else {
      for (const e of enemies) {
        const c = e.m.position.clone(); if (e.type === 'core') c.y = Math.min(Math.max(b.m.position.y, 0.5), 3.8);
        if (b.m.position.distanceTo(c) < e.r + b.r + 0.15) { damageEnemy(e, b.dmg, b.m.position); dead = true; audio.play('hit'); burst(b.m.position, 0xff4a20, 12, 6, 0.35); break; }
      }
    }
    if (dead) { scene.remove(b.m); b.m.material.dispose(); bolts.splice(i, 1); }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; k.t += dt; k.m.rotation.y += dt * 3; k.m.position.y += Math.sin(k.t * 4) * dt * 0.3;
    const c = player.pos.clone(); c.y += 1;
    if (k.m.position.distanceTo(c) < 1.6) { player.hp = Math.min(100, player.hp + 15); player.en = Math.min(100, player.en + 25); audio.play('pickup'); scene.remove(k.m); pickups.splice(i, 1); }
    else if (k.t > 15) { scene.remove(k.m); pickups.splice(i, 1); }
  }
}

// ------------------------------------------------------------------ missions
const MISSIONS = [
  { name: 'Пробуждение', desc: 'Охранные дроны подняли тревогу. Уничтожьте 8 дронов.', type: 'kill', total: 8, conc: 3 },
  { name: 'Зачистка', desc: 'Продержитесь против четырёх волн, включая тяжёлые дроны.', type: 'waves',
    waves: [['drone', 'drone', 'drone'], ['drone', 'drone', 'drone', 'heavy'], ['drone', 'drone', 'heavy', 'heavy'], ['drone', 'drone', 'drone', 'heavy', 'heavy', 'heavy']] },
  { name: 'Сердце сети', desc: 'Уничтожьте 4 энергоядра. Пока ядра активны, прибывают дроны.', type: 'cores', cores: 4 },
  { name: 'Страж', desc: 'Главная оборонительная платформа. Победите Стража.', type: 'boss' },
];
const game = { time: 0, kills: 0, score: 0, paused: false, missionIdx: -1, over: false };
const mission = {
  m: null, spawned: 0, wave: 0, waveT: 0, spawnT: 0, coresLeft: 0, boss: null,
  start(idx) {
    this.m = idx >= 0 ? MISSIONS[idx] : { name: 'Свободный режим', type: 'free' };
    this.spawned = 0; this.wave = -1; this.waveT = 2; this.spawnT = 1.5; this.boss = null;
    const m = this.m;
    if (m.type === 'cores') {
      this.coresLeft = m.cores;
      for (let i = 0; i < m.cores; i++) { const a = i / m.cores * Math.PI * 2 + 0.4; spawnEnemy('core', new THREE.Vector3(Math.cos(a) * 22, 0, Math.sin(a) * 22)); }
    }
    if (m.type === 'boss') { this.boss = spawnEnemy('boss', new THREE.Vector3(0, 9, -20)); $('bossbar').classList.remove('hidden'); }
    else $('bossbar').classList.add('hidden');
    banner(m.name, idx >= 0 ? `Миссия ${idx + 1}` : 'Бесконечные волны');
  },
  objective() {
    const m = this.m;
    switch (m.type) {
      case 'kill': return [`Дроны: ${Math.min(game.kills, m.total)} / ${m.total}`, m.name];
      case 'waves': return [`Волна ${Math.max(1, this.wave + 1)} / ${m.waves.length}`, `Врагов: ${enemies.length}`];
      case 'cores': return [`Энергоядра: ${m.cores - this.coresLeft} / ${m.cores}`, m.name];
      case 'boss': return ['Победите Стража', m.name];
      default: return [`Счёт: ${game.score}`, `Волна ${Math.max(1, this.wave + 1)} · рекорд ${save.freeBest}`];
    }
  },
  update(dt) {
    const m = this.m;
    if (m.type === 'kill') {
      const alive = enemies.length;
      this.spawnT -= dt;
      if (this.spawned < m.total && alive < m.conc && this.spawnT <= 0) { spawnEnemy('drone'); this.spawned++; this.spawnT = 1.2; }
    } else if (m.type === 'waves' || m.type === 'free') {
      if (enemies.length === 0) {
        this.waveT -= dt;
        if (this.waveT <= 0) {
          this.wave++;
          if (m.type === 'waves' && this.wave >= m.waves.length) return this.win();
          const list = m.type === 'waves' ? m.waves[this.wave] : Array.from({ length: 2 + Math.floor(this.wave * 1.2) }, (_, i) => (i % 4 === 3 ? 'heavy' : 'drone'));
          list.forEach((t, i) => setTimeout(() => state.mode === 'game' && spawnEnemy(t), i * 400));
          banner(`Волна ${this.wave + 1}`, '', 1.4);
          this.waveT = 2.5;
        }
      }
    } else if (m.type === 'cores') {
      this.spawnT -= dt;
      const drones = enemies.filter((e) => e.type !== 'core').length;
      if (this.coresLeft > 0 && drones < 4 && this.spawnT <= 0) { spawnEnemy(Math.random() < 0.2 ? 'heavy' : 'drone'); this.spawnT = 5; }
    } else if (m.type === 'boss' && this.boss) {
      $('bossbar').querySelector('i').style.transform = `scaleX(${Math.max(0, this.boss.hp / this.boss.max)})`;
    }
  },
  onKill(e) {
    const m = this.m;
    if (m.type === 'kill' && game.kills >= m.total) this.win();
    if (e.type === 'core') { this.coresLeft--; if (this.coresLeft <= 0) { enemies.filter((x) => x.type !== 'core').forEach((x) => damageEnemy(x, 9999)); this.win(); } }
    if (e.type === 'boss') { this.boss = null; $('bossbar').classList.add('hidden'); setTimeout(() => this.win(), 900); }
  },
  win() {
    if (game.over) return;
    game.over = true;
    const idx = game.missionIdx;
    const t = game.time;
    if (idx >= 0) {
      save.unlocked = Math.max(save.unlocked, Math.min(MISSIONS.length, idx + 2));
      save.last = Math.min(MISSIONS.length - 1, idx + 1);
      if (!save.best[idx] || t < save.best[idx]) save.best[idx] = Math.round(t);
      persist();
    }
    audio.play('win');
    setTimeout(() => showResult(true), 1200);
  },
  onDeath() {
    if (game.over) return;
    game.over = true;
    if (game.missionIdx < 0 && game.score > save.freeBest) { save.freeBest = game.score; persist(); }
    setTimeout(() => showResult(false), 2200);
  },
};

// ------------------------------------------------------------------ UI flow
const audio = new Audio();
audio.setVolumes(save.settings.music, save.settings.sfx);
const state = { mode: 'menu' };
let bannerTimer = null;
function banner(a, b = '', dur = 2.4) {
  const el = $('banner'); el.innerHTML = `${a}${b ? `<small>${b}</small>` : ''}`; el.style.opacity = 1;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (el.style.opacity = 0), dur * 1000);
}
let toastTimer = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.opacity = 0), 2200); }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function setTitle() {
  const n = (save.settings.name || 'SENTINEL').trim() || 'SENTINEL';
  $('title').textContent = n; $('dossierTitle').textContent = n; document.title = n;
}
function showPanel(id) {
  ['menu', 'pMissions', 'pDossier', 'pSettings', 'pAbout'].forEach((p) => $(p).classList.toggle('hidden', p !== id));
}
function refreshMenu() {
  $('mContinue').classList.toggle('disabled', save.unlocked <= 1 && !save.best[0]);
  const list = $('missionList'); list.innerHTML = '';
  MISSIONS.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'mission' + (i + 1 > save.unlocked ? ' locked' : '');
    d.innerHTML = `<span class="best">${save.best[i] ? fmt(save.best[i]) : ''}</span><b>${i + 1}. ${m.name}</b><small>${i + 1 > save.unlocked ? 'Заблокировано' : m.desc}</small>`;
    d.onclick = () => { audio.play('ui'); startGame(i); };
    list.appendChild(d);
  });
}
function click(id, fn) { $(id).addEventListener('click', () => { audio.unlock(); audio.play('ui'); fn(); }); }
click('mContinue', () => startGame(Math.min(save.last || 0, save.unlocked - 1)));
click('mNew', () => startGame(0));
click('mMissions', () => { refreshMenu(); showPanel('pMissions'); });
click('mFree', () => startGame(-1));
click('mDossier', () => showPanel('pDossier'));
click('mSettings', () => showPanel('pSettings'));
click('mAbout', () => showPanel('pAbout'));
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { audio.play('ui'); if (state.mode === 'game') { showPanel(null); $('pause').classList.remove('hidden'); } else showPanel('menu'); }));
document.querySelectorAll('#menu li').forEach((li) => li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); }));
addEventListener('pointerdown', () => { audio.unlock(); $('soundHint').classList.add('hidden'); audio.setMode(state.mode === 'game' ? 'game' : 'menu'); }, { once: true });

// settings
const S = save.settings;
$('sMusic').value = S.music; $('sSfx').value = S.sfx; $('sSens').value = S.sens; $('sQuality').value = S.quality; $('sName').value = S.name;
$('sMusic').oninput = (e) => { S.music = +e.target.value; audio.setVolumes(S.music, S.sfx); persist(); };
$('sSfx').oninput = (e) => { S.sfx = +e.target.value; audio.setVolumes(S.music, S.sfx); persist(); };
$('sSens').oninput = (e) => { S.sens = +e.target.value; persist(); };
$('sQuality').onchange = (e) => { S.quality = e.target.value; persist(); applyQuality(); };
$('sName').oninput = (e) => { S.name = e.target.value.toUpperCase(); persist(); setTitle(); };
$('sLoadModel').onclick = () => $('modelFile').click();
$('modelFile').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { await idb.set('heroModel', f); toast('Модель сохранена, загружаю…'); await loadHero(); toast('Модель загружена'); }
  catch (err) { toast('Ошибка: ' + err.message); }
  e.target.value = '';
};
$('sResetModel').onclick = async () => { await idb.del('heroModel'); await loadHero(); toast('Модель по умолчанию'); };

// pause / result
function togglePause() {
  if (state.mode !== 'game' || game.over) return;
  game.paused = !game.paused;
  $('pause').classList.toggle('hidden', !game.paused);
  showPanel(null);
}
$('pauseBtn').onclick = () => { audio.play('ui'); togglePause(); };
click('oResume', togglePause);
click('oRestart', () => { $('pause').classList.add('hidden'); startGame(game.missionIdx); });
click('oQuit', toMenu);
function showResult(win) {
  $('result').classList.remove('hidden');
  $('rTitle').textContent = win ? 'Миссия выполнена' : 'Система отключена';
  $('rTitle').className = win ? 'win' : '';
  const idx = game.missionIdx;
  $('rSub').textContent = idx < 0 ? `Счёт: ${game.score} · Рекорд: ${save.freeBest} · Уничтожено: ${game.kills}`
    : `Время: ${fmt(game.time)} · Уничтожено: ${game.kills}`;
  $('rNext').classList.toggle('hidden', !win || idx < 0 || idx >= MISSIONS.length - 1);
  $('rRetry').textContent = win ? 'Повторить' : 'Повторить';
}
click('rNext', () => startGame(game.missionIdx + 1));
click('rRetry', () => startGame(game.missionIdx));
click('rMenu', toMenu);

function clearWorld() {
  enemies.slice().forEach((e) => { scene.remove(e.m); if (e.obst) OBST.splice(OBST.indexOf(e.obst), 1); });
  enemies.length = 0;
  bolts.forEach((b) => scene.remove(b.m)); bolts.length = 0;
  pickups.forEach((k) => scene.remove(k.m)); pickups.length = 0;
}
function startGame(idx) {
  audio.unlock();
  clearWorld();
  state.mode = 'game';
  Object.assign(game, { time: 0, kills: 0, score: 0, paused: false, missionIdx: idx, over: false });
  player.reset();
  player.pos.set(0, 0, 8); player.yaw = Math.PI;
  input.camYaw = 0; input.camPitch = 0.25;
  hero.rotation.set(0, Math.PI, 0);
  showPanel(null);
  $('hud').classList.remove('hidden'); $('pause').classList.add('hidden'); $('result').classList.add('hidden');
  $('bFly').classList.remove('on'); $('bUp').classList.add('hidden'); $('bDown').classList.add('hidden');
  arena.visible = true;
  setLighting('game');
  audio.setMode('game');
  mission.start(idx);
}
function toMenu() {
  clearWorld();
  state.mode = 'menu';
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('result').classList.add('hidden'); $('bossbar').classList.add('hidden');
  arena.visible = false;
  hero.position.set(0, 0, 0); hero.rotation.set(0, 0, 0);
  setLighting('menu');
  audio.setMode('menu');
  refreshMenu();
  showPanel('menu');
}
function setLighting(mode) {
  const menu = mode === 'menu';
  scene.background.set(menu ? 0x000000 : 0x07080b);
  scene.fog.color.set(menu ? 0x000000 : 0x07080b);
  scene.fog.density = menu ? 0.09 : 0.018;
  hemi.intensity = menu ? 0.0 : 0.55;
  keyLight.intensity = menu ? 0 : 1.6;
  rimA.intensity = menu ? 26 : 0; rimB.intensity = menu ? 14 : 0; under.intensity = menu ? 0.6 : 0;
  renderer.toneMappingExposure = menu ? 1.0 : 1.15;
}

// ------------------------------------------------------------------ camera
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function updateCamera(dt, t) {
  if (state.mode === 'menu') {
    // character on the right side, like a title screen
    const d = 4.3;
    const visW = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const portrait = camera.aspect < 0.9;
    const offX = portrait ? 0 : -visW * 0.17;
    const look = new THREE.Vector3(offX, portrait ? 1.0 : 1.38, 0);
    const drift = Math.sin(t * 0.13) * 0.25;
    camera.position.set(look.x + drift, look.y + 0.25 + Math.sin(t * 0.21) * 0.05, d + Math.sin(t * 0.17) * 0.15);
    camera.lookAt(look);
    return;
  }
  const p = player.pos;
  camTarget.lerp(new THREE.Vector3(p.x, p.y + 1.65, p.z), Math.min(1, dt * 10));
  const cy = input.camYaw, cp = input.camPitch;
  camPos.set(camTarget.x + Math.sin(cy) * Math.cos(cp) * camDist, camTarget.y + Math.sin(cp) * camDist, camTarget.z + Math.cos(cy) * Math.cos(cp) * camDist);
  if (camPos.y < 0.3) camPos.y = 0.3;
  camera.position.copy(camPos);
  const right = new THREE.Vector3(Math.cos(cy), 0, -Math.sin(cy));
  camera.position.addScaledVector(right, 0.55);
  if (shake > 0) { camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.15)); shake = Math.max(0, shake - dt * 1.8); }
  camera.lookAt(camTarget.clone().addScaledVector(right, 0.55));
}

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (hitstop > 0) { hitstop -= dt; dt *= 0.1; }
  if (state.mode === 'game' && !game.paused) {
    if (!game.over || player.dead) game.time += game.over ? 0 : dt;
    updatePlayer(dt);
    if (!game.over) mission.update(dt);
    updateEnemies(dt);
    updateBolts(dt);
    // HUD
    $('hp').firstChild.style.transform = `scaleX(${player.hp / 100})`;
    $('en').firstChild.style.transform = `scaleX(${player.en / 100})`;
    const [a, b] = mission.objective();
    $('objective').innerHTML = `${a}<small>${b}</small>`;
  }
  updateFx(dt);
  if (rig) {
    const p = player;
    const menu = state.mode === 'menu';
    const look = menu ? Math.sin(elapsed * 0.35) * 0.18 : 0;
    animate(rig, {
      time: elapsed, phase: p.phase, speed: menu ? 0 : p.speed, fly: menu ? 0 : p.flyW,
      attack: menu ? null : p.attack, menu, look, hit: p.hitW, dash: p.dashT > 0 ? 1 : 0,
      aimPitch: p.attack ? p.attack.aimPitch || 0 : 0, twist: p.attack && p.attack.type === 'punch' ? (p.attack.side === 'R' ? 0.35 : -0.35) * p.attack.w : 0,
      jaw: menu ? Math.max(0, Math.sin(elapsed * 0.5)) * 0.04 : 0,
    });
    if (rig.b.hand_L) { rig.b.hand_L.getWorldPosition(handPos.L); rig.b.hand_R.getWorldPosition(handPos.R); }
    else { handPos.L.copy(hero.position).add(new THREE.Vector3(0, 1.3, 0)); handPos.R.copy(handPos.L); }
    if (state.mode === 'game' && player.dead) { hero.rotation.x = -Math.min(1.45, player.deadT * 2.2); hero.position.y = Math.max(0, hero.position.y - player.deadT * 0.5); }
    else hero.rotation.x = 0;
  }
  if (state.mode === 'game') {
    keyLight.position.set(player.pos.x - 8, 18, player.pos.z + 6);
    keyLight.target.position.copy(player.pos);
  }
  updateCamera(dt, elapsed);
  composer.render();
}

// ------------------------------------------------------------------ boot
applyQuality();
setTitle();
setLighting('menu');
refreshMenu();
showPanel('menu');
frame();
loadHero().then(() => { $('loading').classList.add('hidden'); window.__ready = true; })
  .catch((e) => { $('loading').textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ'; console.error(e); window.__ready = true; });
