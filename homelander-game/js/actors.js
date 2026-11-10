// Персонажи мира: прохожие, враги, боссы, транспорт, снаряды
HL.Actors = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const tmp = V(), tmp2 = V();

  // ================= базовый класс =================
  class Actor {
    constructor(g, def, o = {}) {
      this.g = g;
      this.c = def ? M.buildChar(def) : null;
      this.obj = this.c ? this.c.root : o.obj || new T.Group();
      g.scene.add(this.obj);
      this.def = def;
      this.name = o.name || (def && def.name) || '';
      this.pos = V(); this.vel = V(); this.yaw = o.yaw || 0;
      this.hp = this.maxHp = o.hp || 100;
      this.radius = o.radius || 0.45; this.height = o.height || 2.1;
      this.faction = o.faction || 'civ';
      this.alive = true; this.removed = false;
      this.anim = 'idle'; this.animOpt = {}; this.moveSpeed = 0;
      this.airborne = false; this.spin = 0; this.downT = 0; this.deadT = 0;
      this.dmgMul = 1; this.knockMul = 1;
      this.tags = o.tags || {};
      this.showHp = !!o.showHp;
      this.stagger = 0;
    }
    get center() { return V(this.pos.x, this.pos.y + this.height * 0.55 * (this.c ? this.c.root.scale.y : 1), this.pos.z); }
    centerV() { return this.center.clone(); }
    place(x, y, z) { this.pos.set(x, y, z); this.obj.position.copy(this.pos); return this; }
    face(p, dt, rate = 8) { const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); this.yaw = dt ? U.dampAng(this.yaw, a, rate, dt) : a; }
    distTo(p) { return this.pos.distanceTo(p); }
    dist2D(p) { return U.dist2D(this.pos, p); }
    damage(amount, src, knock) {
      if (!this.alive || this.invuln) return 0;
      amount *= this.dmgMul;
      this.hp -= amount;
      this.lastHurt = this.g.time; this.lastHurtBy = src;
      this.onHurt && this.onHurt(amount, src);
      if (knock && this.knockMul > 0) {
        this.vel.addScaledVector(knock, this.knockMul);
        if (knock.lengthSq() > 30) { this.airborne = true; this.spin = (Math.random() - 0.5) * 14; this.downT = 1.2; }
      }
      if (this.hp <= 0) { this.hp = 0; this.die(src); }
      return amount;
    }
    die(src) {
      this.alive = false; this.deadT = 0;
      this.g.onDeath(this, src);
    }
    moveToward(p, speed, dt, accel = 10) {
      tmp2.set(p.x - this.pos.x, 0, p.z - this.pos.z);
      const L = tmp2.length();
      if (L > 0.05) tmp2.multiplyScalar(speed / L);
      this.vel.x = U.damp(this.vel.x, tmp2.x, accel, dt); this.vel.z = U.damp(this.vel.z, tmp2.z, accel, dt);
      return L;
    }
    stop(dt) { this.vel.x = U.damp(this.vel.x, 0, 10, dt); this.vel.z = U.damp(this.vel.z, 0, 10, dt); }
    physics(dt) {
      const w = this.g.world;
      const prevY = this.pos.y;
      if (this.noPhysics) { this.pos.addScaledVector(this.vel, dt); return; }
      this.vel.y -= 28 * dt;
      this.pos.addScaledVector(this.vel, dt);
      let gY = 0;
      const roof = w.collide(this.pos, this.radius, this.height, prevY);
      if (roof != null) gY = roof;
      if (this.pos.y <= gY) {
        if (this.airborne && this.vel.y < -14) { this.g.fx.dust(this.pos, 5); }
        this.pos.y = gY; this.vel.y = 0;
        if (this.airborne) { this.airborne = false; }
        if (!this.airborne && (!this.alive || this.downT > 0)) { this.vel.x *= Math.exp(-6 * dt); this.vel.z *= Math.exp(-6 * dt); }
      } else if (this.pos.y > gY + 0.4) this.inAir = true;
      if (this.pos.y <= gY + 0.01) this.inAir = false;
      const L = HL.World.HALF + 120;
      this.pos.x = U.clamp(this.pos.x, -L, L); this.pos.z = U.clamp(this.pos.z, -L, L);
    }
    update(dt) {
      if (!this.alive) {
        this.deadT += dt;
        this.physics(dt);
        if (this.airborne) { this.spin *= 0.99; this.c && M.animate(this.c, dt, 'tumble', 0, { spin: (this.c.cur.pitch || 0) + this.spin * dt }); }
        else this.c && M.animate(this.c, dt, this.keepBody ? 'knocked' : 'dead', 0);
        this.sync();
        if (!this.keepBody && this.deadT > 12) { this.pos.y -= dt * 0.5; if (this.deadT > 15) this.remove(); }
        return;
      }
      if (this.stagger > 0) this.stagger -= dt;
      if (this.downT > 0) {
        this.downT -= dt;
        this.physics(dt);
        if (this.c) {
          if (this.airborne) M.animate(this.c, dt, 'tumble', 0, { spin: (this.c.cur.pitch || 0) + this.spin * dt });
          else M.animate(this.c, dt, 'knocked', 0);
        }
        this.sync(); return;
      }
      this.think(dt);
      this.physics(dt);
      if (this.c) M.animate(this.c, dt, this.anim, this.moveSpeed, this.animOpt);
      this.sync();
    }
    think() {}
    sync() { this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw; }
    remove() { if (this.removed) return; this.removed = true; this.alive = false; this.g.scene.remove(this.obj); }
    shootAt(targetPos, o) {
      const from = this.muzzle();
      const d = targetPos.clone().sub(from);
      const dist = d.length();
      d.normalize();
      const sp = o.spread || 0.03;
      d.x += U.rand(-sp, sp); d.y += U.rand(-sp, sp) * 0.6; d.z += U.rand(-sp, sp); d.normalize();
      this.g.spawnProj(o.type || 'bullet', from, d.multiplyScalar(o.speed || 70), { dmg: o.dmg || 10, owner: this, maxDist: (o.range || 120) + 20 });
      (o.heavy ? A().heavyShot : A().shot)();
      if (Math.random() < 0.3) this.g.alarm(this.pos, 28);
      return dist;
    }
    muzzle() {
      if (this.c && this.c.gun) { const p = V(); this.c.gun.getWorldPosition(p); return p; }
      return this.center.clone().add(V(Math.sin(this.yaw) * 0.6, 0.3, Math.cos(this.yaw) * 0.6));
    }
  }

  // ================= прохожий =================
  class Civilian extends Actor {
    constructor(g, o = {}) {
      super(g, o.def || M.randomCivDef(), Object.assign({ hp: 30, faction: 'civ' }, o));
      this.target = null; this.wait = U.rand(0, 3); this.fear = 0; this.fearFrom = V(); this.cheer = 0;
      this.walkSpeed = U.rand(1.2, 1.8); this.watching = false; this.stay = !!o.stay;
      this.mood = o.mood || null;
    }
    scare(from, t = 6) { if (!this.alive) return; this.fear = Math.max(this.fear, t); this.fearFrom.copy(from); }
    think(dt) {
      const g = this.g, P = g.player;
      this.animOpt = {};
      if (this.cheer > 0) { this.cheer -= dt; this.stop(dt); this.face(P.pos, dt, 6); this.anim = 'cheer'; return; }
      if (this.fear > 0) {
        this.fear -= dt;
        tmp2.copy(this.pos).sub(this.fearFrom); tmp2.y = 0;
        if (tmp2.lengthSq() < 0.01) tmp2.set(1, 0, 0);
        tmp2.normalize().multiplyScalar(6).add(this.pos);
        this.moveToward(tmp2, 5.5, dt, 6);
        this.face(tmp2, dt, 10);
        this.anim = 'flee'; this.moveSpeed = 5.5;
        return;
      }
      if (this.mood === 'scared') { this.stop(dt); this.anim = 'scared'; return; }
      const dP = this.dist2D(P.pos);
      if (this.stay || this.mood === 'watch') {
        this.stop(dt); if (dP < 40) this.face(P.pos, dt, 3); this.anim = 'idle'; return;
      }
      if (dP < 9 && !P.flying) { this.stop(dt); this.face(P.pos, dt, 4); this.anim = 'idle'; return; }
      if (this.wait > 0) { this.wait -= dt; this.stop(dt); this.anim = 'idle'; return; }
      if (!this.target || this.dist2D(this.target) < 1) {
        this.target = g.world.randomSidewalk();
        if (this.dist2D(this.target) > 80) { this.target.copy(this.pos).add(V(U.rand(-20, 20), 0, U.rand(-20, 20))); }
        this.wait = Math.random() < 0.3 ? U.rand(1, 4) : 0;
      }
      this.moveToward(this.target, this.walkSpeed, dt, 5);
      this.face(this.target, dt, 5);
      this.anim = 'walk'; this.moveSpeed = this.walkSpeed;
      // застрял — сменим цель
      if (Math.hypot(this.vel.x, this.vel.z) < 0.3) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 2) { this.target = null; this.stuck = 0; } }
    }
  }

  // ================= пострадавший (спасательная миссия) =================
  class Victim extends Civilian {
    constructor(g, o = {}) { super(g, Object.assign({ hp: 1e9, stay: true }, o)); this.pickable = true; this.carried = false; this.rescued = false; this.invuln = true; }
    think(dt) {
      if (this.carried) { this.anim = 'carried'; return; }
      if (this.rescued) { this.anim = 'cheer'; this.stop(dt); this.face(this.g.player.pos, dt, 4); return; }
      this.anim = 'wave'; this.stop(dt); this.face(this.g.player.pos, dt, 2);
    }
    update(dt) {
      if (this.carried) {
        const P = this.g.player;
        this.c.root.updateMatrixWorld();
        tmp.set(0, 1.05, 0.55).applyAxisAngle(V(0, 1, 0), P.yaw);
        this.pos.copy(P.pos).add(tmp); if (P.flying) this.pos.y -= 0.2;
        this.yaw = P.yaw + Math.PI / 2;
        this.vel.set(0, 0, 0);
        M.animate(this.c, dt, 'carried', 0);
        this.obj.position.copy(this.pos); this.obj.position.y -= 1.0; this.obj.rotation.y = this.yaw;
        return;
      }
      super.update(dt);
    }
  }

  // ================= стрелок (грабитель / наёмник / М.М.) =================
  const WEAPONS = {
    pistol: { dmg: 6, rate: 1.1, speed: 60, spread: 0.05, range: 60, type: 'bullet' },
    rifle: { dmg: 9, rate: 0.55, speed: 80, spread: 0.035, range: 90, type: 'bullet', burst: 3 },
    antisupe: { dmg: 22, rate: 1.6, speed: 95, spread: 0.02, range: 110, type: 'antisupe', heavy: true },
    heavy: { dmg: 14, rate: 0.25, speed: 85, spread: 0.06, range: 90, type: 'bullet', burst: 6, heavy: true },
  };
  class Gunman extends Actor {
    constructor(g, def, o = {}) {
      super(g, def, Object.assign({ hp: 60, faction: 'enemy' }, o));
      this.w = Object.assign({}, WEAPONS[o.weapon || 'pistol']);
      this.cool = U.rand(0.5, 2); this.burstLeft = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = U.rand(1, 3);
      this.aggro = o.aggro !== false; this.static = !!o.static; this.prefDist = o.prefDist || U.rand(14, 26);
      this.speed = o.speed || 4.5;
    }
    think(dt) {
      const g = this.g, P = g.player;
      const pc = P.center;
      const d = this.distTo(pc);
      this.face(P.pos, dt, 8);
      this.animOpt = { headPitch: -U.clamp((pc.y - this.pos.y - 1.6) / Math.max(4, d), -0.6, 0.6) };
      if (!this.aggro) { if (d < 45 || this.hp < this.maxHp) this.aggro = true; else { this.anim = 'idle'; this.stop(dt); return; } }
      if (P.dead) { this.anim = 'idle'; this.stop(dt); return; }
      // движение
      let sp = 0;
      if (!this.static) {
        this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = U.rand(1.5, 3.5); }
        const d2 = this.dist2D(P.pos);
        tmp2.set(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z).normalize();
        const side = V(-tmp2.z, 0, tmp2.x).multiplyScalar(this.strafe);
        const fwd = d2 > this.prefDist + 4 ? 1 : d2 < this.prefDist - 6 ? -1 : 0;
        const want = tmp2.multiplyScalar(fwd).add(side.multiplyScalar(0.6)).normalize().multiplyScalar(this.speed);
        this.vel.x = U.damp(this.vel.x, want.x, 6, dt); this.vel.z = U.damp(this.vel.z, want.z, 6, dt);
        sp = Math.hypot(this.vel.x, this.vel.z);
      } else this.stop(dt);
      this.anim = 'shoot'; this.moveSpeed = sp;
      // стрельба
      this.cool -= dt;
      if (this.cool <= 0 && d < this.w.range) {
        if (g.world.los(this.muzzle(), pc)) {
          const lead = P.vel.clone().multiplyScalar((d / this.w.speed) * 0.5);
          this.shootAt(pc.clone().add(lead), this.w);
          if (this.w.burst) { this.burstLeft = this.burstLeft > 0 ? this.burstLeft - 1 : this.w.burst - 1; this.cool = this.burstLeft > 0 ? 0.11 : this.w.rate * U.rand(1.6, 2.4); }
          else this.cool = this.w.rate * U.rand(0.8, 1.3);
        } else this.cool = 0.4;
      }
    }
  }

  // ================= Френчи: гранаты =================
  class Grenadier extends Gunman {
    constructor(g, def, o = {}) { super(g, def, Object.assign({ hp: 320, weapon: 'pistol', prefDist: 22, showHp: true }, o)); this.gren = 2.5; this.throwT = 0; }
    think(dt) {
      super.think(dt);
      this.gren -= dt;
      if (this.throwT > 0) { this.throwT -= dt; this.anim = 'throw'; this.animOpt = { p: 1 - this.throwT / 0.6 }; }
      if (this.gren <= 0 && this.dist2D(this.g.player.pos) < 40) {
        this.gren = U.rand(3, 4.5); this.throwT = 0.6;
        const P = this.g.player, from = this.center.clone().add(V(0, 0.6, 0));
        const tgt = P.pos.clone().add(P.vel.clone().multiplyScalar(0.8));
        const tt = 1.2; const v = tgt.sub(from).divideScalar(tt); v.y += 0.5 * 22 * tt;
        this.g.spawnProj('grenade', from, v, { dmg: 70, owner: this, fuse: tt + 0.15, radius: 6 });
        A().whoosh();
      }
    }
  }

  // ================= Кимико: ближний бой =================
  class Brawler extends Actor {
    constructor(g, def, o = {}) {
      super(g, def, Object.assign({ hp: 750, faction: 'enemy', showHp: true }, o));
      this.atk = 0; this.cd = 1; this.dodgeCd = 0; this.knife = 2; this.knockMul = 0.5;
    }
    onHurt() {
      if (this.dodgeCd <= 0 && this.g.player.lasering && Math.random() < 0.06) {
        this.dodgeCd = 1.6;
        const P = this.g.player; tmp2.set(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z).normalize();
        this.vel.set(-tmp2.z * 16 * (Math.random() < 0.5 ? 1 : -1), 6, tmp2.x * 16); A().whiff();
      }
    }
    think(dt) {
      const P = this.g.player; this.dodgeCd -= dt; this.cd -= dt; this.knife -= dt;
      const d2 = this.dist2D(P.pos), dy = P.pos.y - this.pos.y;
      this.face(P.pos, dt, 12);
      if (this.atk > 0) {
        this.atk -= dt; this.anim = 'punch'; this.animOpt = { p: 1 - this.atk / 0.4 };
        if (!this.hit && this.atk < 0.22) { this.hit = true; if (d2 < 2.8 && Math.abs(dy) < 2.5) this.g.hurtPlayer(32, this.pos, { knock: 6 }); A().punch(); }
        this.stop(dt); return;
      }
      if (dy > 5 && this.knife <= 0) {
        this.knife = 1.2; this.anim = 'throw'; this.animOpt = { p: 0.8 };
        this.shootAt(P.center.clone(), { type: 'knife', dmg: 14, speed: 55, spread: 0.02 });
        return;
      }
      if (d2 > 2.2) {
        this.moveToward(P.pos, 11, dt, 8); this.anim = 'run'; this.moveSpeed = 11; this.animOpt = {};
        if (d2 < 9 && dy > 1.5 && dy < 7 && !this.inAir) this.vel.y = 14; // прыжок к летящему
      } else if (this.cd <= 0) { this.atk = 0.4; this.hit = false; this.cd = 0.55; }
      else { this.stop(dt); this.anim = 'idle'; }
    }
  }

  // ================= Старлайт =================
  class Starlight extends Actor {
    constructor(g, o = {}) {
      super(g, M.DEFS.starlight, Object.assign({ hp: 1800, faction: 'enemy', showHp: false, name: 'Старлайт' }, o));
      this.boss = true; this.bolt = 1.5; this.flashCd = 7; this.flashT = 0; this.jump = 3; this.knockMul = 0.4;
      this.aura = M.glowSprite(0xfff2b0, 3); this.aura.position.y = 1.2; this.aura.material.opacity = 0.0; this.obj.add(this.aura);
      for (const side of [this.c.elbowL, this.c.elbowR]) { const s = M.glowSprite(0xfff0a0, 0.7); s.position.y = -0.36; side.add(s); }
    }
    think(dt) {
      const g = this.g, P = g.player; const pc = P.center;
      this.face(P.pos, dt, 8); this.bolt -= dt; this.flashCd -= dt; this.jump -= dt;
      const d = this.dist2D(P.pos);
      const phase2 = this.hp < this.maxHp * 0.5;
      if (this.flashT > 0) {
        this.flashT -= dt; this.anim = 'charge'; this.stop(dt);
        const k = 1 - this.flashT / 1.3; this.aura.material.opacity = k; this.aura.scale.setScalar(3 + k * 9);
        if (this.flashT <= 0) {
          this.aura.material.opacity = 0;
          g.fx.flashLight(this.center, 0xfff4c0, 12, 0.6, 80);
          const toMe = this.center.clone().sub(g.camera.position).normalize();
          const fwd = V(); g.camera.getWorldDirection(fwd);
          if (fwd.dot(toMe) > 0.55 && this.distTo(pc) < 80 && g.world.los(this.center.clone(), pc.clone())) { g.ui.flash(2.6); g.ui.tag('ОСЛЕПЛЁН!', '#fff', 2); }
          A().blast();
        }
        return;
      }
      if (this.flashCd <= 0 && d < 70) { this.flashCd = phase2 ? 7 : 10; this.flashT = 1.3; g.ui.tag('ОТВЕРНИСЬ! ВСПЫШКА', '#ffe080', 1.3); A().charge(1.3); return; }
      // держит дистанцию, прыгает
      const want = d < 14 ? -1 : d > 28 ? 1 : 0;
      tmp2.set(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z).normalize();
      const v = tmp2.clone().multiplyScalar(want * 6).add(V(-tmp2.z, 0, tmp2.x).multiplyScalar(4 * Math.sin(g.time * 0.7)));
      this.vel.x = U.damp(this.vel.x, v.x, 4, dt); this.vel.z = U.damp(this.vel.z, v.z, 4, dt);
      if (this.jump <= 0 && !this.inAir) { this.jump = U.rand(2.5, 4); this.vel.y = 13; }
      this.anim = this.inAir ? 'jump' : 'shoot'; this.moveSpeed = 4;
      if (this.bolt <= 0 && g.world.los(this.center.clone(), pc.clone())) {
        this.bolt = phase2 ? 0.7 : 1.2;
        const from = this.center.clone().add(V(Math.sin(this.yaw) * 0.6, 0.2, Math.cos(this.yaw) * 0.6));
        const dir = pc.clone().add(P.vel.clone().multiplyScalar(0.3)).sub(from).normalize();
        g.spawnProj('light', from, dir.multiplyScalar(55), { dmg: 26, owner: this });
        A().shield();
      }
    }
  }

  // ================= Эй-Трейн: гонщик =================
  class Runner extends Actor {
    constructor(g, path, o = {}) {
      super(g, M.DEFS.atrain, Object.assign({ hp: 1e9, faction: 'ally', name: 'Эй-Трейн' }, o));
      this.path = path; this.i = 0; this.speed = o.speed || 34; this.noPhysics = true; this.invuln = true; this.running = false; this.done = false; this.progress = 0;
    }
    think(dt) {
      if (!this.running || this.done) { this.anim = 'idle'; this.vel.set(0, 0, 0); return; }
      const tgt = this.path[this.i];
      tmp2.set(tgt.x - this.pos.x, 0, tgt.z - this.pos.z);
      const L = tmp2.length();
      const step = this.speed * dt;
      if (L <= step) { this.pos.x = tgt.x; this.pos.z = tgt.z; this.i++; if (this.i >= this.path.length) { this.done = true; } }
      else { tmp2.multiplyScalar(step / L); this.pos.add(tmp2); }
      this.pos.y = 0; this.vel.set(tmp2.x / dt, 0, tmp2.z / dt);
      this.face(tgt); this.anim = 'run'; this.moveSpeed = 9;
      if (Math.random() < 0.9) this.g.fx.burst(this.center, 1, { color: [0x3a7aff, 0x9ac0ff, 0xffffff], speed: 1, size: 0.35, life: 0.5, g: 0, drag: 2 });
    }
  }

  // ================= Солдатик (босс) =================
  class SoldierBoy extends Actor {
    constructor(g, o = {}) {
      super(g, M.DEFS.soldierboy, Object.assign({ hp: 3200, faction: 'enemy', name: 'Солдатик', radius: 0.55 }, o));
      this.boss = true; this.st = 'chase'; this.stT = 0; this.throwCd = 3; this.blastCd = 8; this.meleeCd = 0; this.hasShield = true; this.knockMul = 0.25;
      this.dmgMul = 0.6;
      this.chestGlow = M.glowSprite(0xffa040, 0.5); this.chestGlow.position.set(0, 0.5, 0.3); this.c.spine.add(this.chestGlow); this.chestGlow.visible = false;
      this.aim = V(0, 0, 1);
    }
    setSt(s, t) { this.st = s; this.stT = t || 0; }
    think(dt) {
      const g = this.g, P = g.player, pc = P.center.clone();
      const phase2 = this.hp < this.maxHp * 0.5;
      this.throwCd -= dt; this.blastCd -= dt; this.meleeCd -= dt; this.stT -= dt;
      const d = this.dist2D(P.pos), dy = P.pos.y - this.pos.y;
      this.dmgMul = this.st === 'recover' ? 1.8 : 0.6;
      this.animOpt = {};
      switch (this.st) {
        case 'chase': {
          this.face(P.pos, dt, 6);
          const sp = phase2 ? 12 : 9;
          if (d > 2.6) { this.moveToward(P.pos, sp, dt, 6); this.anim = 'run'; this.moveSpeed = sp; } else { this.stop(dt); this.anim = 'idle'; }
          if (d < 9 && dy > 2 && dy < 9 && !this.inAir) this.vel.y = 15;
          if (d < 3.2 && Math.abs(dy) < 2.5 && this.meleeCd <= 0) { this.setSt('melee', 0.45); this.hit = false; }
          else if (this.blastCd <= 0 && d < 80) { this.setSt('charge', phase2 ? 1.4 : 1.9); g.ui.tag('ЗАРЯД ИЗ ГРУДИ! УКРОЙСЯ ЗА ЗДАНИЕМ', '#ffb050', this.stT); A().charge(this.stT); this.chestGlow.visible = true; }
          else if (this.hasShield && this.throwCd <= 0 && (d > 7 || dy > 4)) { this.setSt('throw', 0.6); this.thrown = false; }
          break;
        }
        case 'melee':
          this.face(P.pos, dt, 10); this.stop(dt); this.anim = 'punch'; this.animOpt = { p: 1 - this.stT / 0.45 };
          if (!this.hit && this.stT < 0.25) { this.hit = true; A().punch(); if (d < 3.6 && Math.abs(dy) < 2.5) g.hurtPlayer(phase2 ? 150 : 120, this.pos, { knock: 22, down: Math.random() < 0.6 }); }
          if (this.stT <= 0) { this.meleeCd = phase2 ? 0.6 : 1.0; this.setSt('chase'); }
          break;
        case 'throw':
          this.face(P.pos, dt, 10); this.stop(dt); this.anim = 'throw'; this.animOpt = { p: 1 - this.stT / 0.6 };
          if (!this.thrown && this.stT < 0.3) {
            this.thrown = true; this.hasShield = false; this.c.shield.visible = false;
            const from = this.center.clone().add(V(0, 0.4, 0));
            const dir = pc.clone().add(P.vel.clone().multiplyScalar(0.4)).sub(from).normalize();
            g.spawnProj('shield', from, dir.multiplyScalar(phase2 ? 48 : 40), { dmg: phase2 ? 140 : 115, owner: this, maxDist: 70 });
            A().shield();
          }
          if (this.stT <= 0) { this.throwCd = phase2 ? 3 : 4.5; this.setSt('chase'); }
          break;
        case 'charge': {
          this.blastHit = false;
          this.stop(dt); this.anim = 'charge';
          const k = 1 - Math.max(0, this.stT) / 1.9;
          this.chestGlow.scale.setScalar(0.5 + k * 3.5);
          if (this.stT > 0.35) { this.face(P.pos, dt, 4); this.aim.copy(pc).sub(this.chest()).normalize(); }
          if (this.stT <= 0) { this.setSt('blast', 1.1); A().blast(); g.fx.addShake(0.8); }
          break;
        }
        case 'blast': {
          this.anim = 'charge'; this.stop(dt);
          // луч медленно следует за игроком
          const want = pc.clone().sub(this.chest()).normalize();
          this.aim.lerp(want, 1 - Math.exp(-0.7 * dt)).normalize();
          const from = this.chest();
          const hit = g.world.raycast(from, this.aim, 200);
          const end = hit ? hit.point : from.clone().addScaledVector(this.aim, 200);
          g.fx.setBeam(4, from, end, 9, 0xff8a20, 0xfff2c0);
          g.fx.flashLight(end, 0xffa040, 4, 0.05, 30);
          if (hit) { g.fx.burst(end, 3, { color: [0xffa040, 0xffe0a0], speed: 12, size: 0.4, life: 0.4 }); g.fx.scorch(hit.point, hit.normal); }
          // попадание по игроку: расстояние от луча
          const L = hit ? hit.t : 200;
          const rel = pc.clone().sub(from); const t = rel.dot(this.aim);
          if (t > 0 && t < L) {
            const dist = rel.sub(this.aim.clone().multiplyScalar(t)).length();
            if (dist < 2.4) { g.hurtPlayer(330 * dt, from, { knock: 0, silent: true }); P.depower(4); if (!this.blastHit) { this.blastHit = true; P.knockdown(this.aim.clone(), 24, 1.5); } }
          }
          // и по прохожим
          for (const a of g.actors) if (a.faction === 'civ' && a.alive) {
            const r2 = a.center.clone().sub(from); const t2 = r2.dot(this.aim);
            if (t2 > 0 && t2 < L && r2.sub(this.aim.clone().multiplyScalar(t2)).length() < 2.4) a.damage(999, this);
          }
          if (this.stT <= 0) { g.fx.setBeam(4, null); this.chestGlow.visible = false; this.setSt('recover', 4); g.ui.tag('СОЛДАТИК УЯЗВИМ! АТАКУЙ!', '#7cff7c', 3); this.blastCd = phase2 ? 7 : 10; }
          break;
        }
        case 'recover':
          this.stop(dt); this.anim = 'idle'; this.c.cur.spineX = 0.4;
          if (this.stT <= 0) this.setSt('chase');
          break;
      }
    }
    chest() { const p = V(); this.chestGlow.getWorldPosition(p); return p; }
    catchShield() { this.hasShield = true; this.c.shield.visible = true; A().clang(); }
    die(src) { super.die(src); this.g.fx.setBeam(4, null); this.chestGlow.visible = false; }
  }

  // ================= Бутчер на Темп-V (финальный босс) =================
  class ButcherBoss extends Actor {
    constructor(g, o = {}) {
      super(g, M.DEFS.butcherV, Object.assign({ hp: 3800, faction: 'enemy', name: 'Билли Бутчер', radius: 0.6, height: 2.3 }, o));
      this.boss = true; this.st = 'chase'; this.stT = 0; this.cd = { sweep: 2, grab: 5, leap: 6, car: 4 }; this.knockMul = 0.2;
      this.leapFrom = V(); this.leapTo = V(); this.c.irisMat.color.setHex(0xff3a1a);
    }
    setSt(s, t) { this.st = s; this.stT = t; }
    think(dt) {
      const g = this.g, P = g.player, pc = P.center.clone();
      for (const k in this.cd) this.cd[k] -= dt;
      this.stT -= dt;
      const d = this.dist2D(P.pos), dy = P.pos.y - this.pos.y;
      const enraged = this.hp < this.maxHp * 0.4;
      this.animOpt = { lash: false };
      switch (this.st) {
        case 'chase': {
          this.face(P.pos, dt, 6);
          const sp = enraged ? 11 : 8.5;
          if (d > 3) { this.moveToward(P.pos, sp, dt, 5); this.anim = 'run'; this.moveSpeed = sp; } else { this.stop(dt); this.anim = 'idle'; }
          if (d < 8 && Math.abs(dy) < 6 && this.cd.sweep <= 0) { this.setSt('sweep', 0.9); g.ui.tag('ЩУПАЛЬЦА!', '#ff6a6a', 0.9); }
          else if (d < 24 && dy < 12 && this.cd.grab <= 0) { this.setSt('grab', 1.2); this.grabbed = false; }
          else if ((d > 20 || dy > 12) && this.cd.car <= 0) { this.setSt('car', 1.1); this.thrown = false; }
          else if (d > 12 && d < 60 && this.cd.leap <= 0 && dy < 8) { this.setSt('leap', 1.3); this.leapFrom.copy(this.pos); this.leapTo.set(P.pos.x, 0, P.pos.z); A().whoosh(); }
          break;
        }
        case 'sweep': {
          this.stop(dt); this.anim = 'charge'; this.animOpt = { lash: true };
          g.fx.warn(0, this.pos, 9, Math.sin(g.time * 30) * 0.5 + 0.5);
          if (this.stT <= 0) {
            g.fx.warn(0, null); A().slam(); g.fx.ring(this.pos, 0xff4040, 10, 0.4); g.fx.addShake(0.5);
            if (this.dist2D(P.pos) < 9 && Math.abs(P.pos.y - this.pos.y) < 6) g.hurtPlayer(enraged ? 220 : 170, this.pos, { knock: 26, down: true });
            for (const a of g.actors) if (a !== this && a.alive && a.dist2D(this.pos) < 9) a.damage(150, this, a.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(20).setY(8));
            this.cd.sweep = enraged ? 2.5 : 3.5; this.setSt('chase', 0);
          }
          break;
        }
        case 'grab': {
          this.face(P.pos, dt, 10); this.stop(dt); this.anim = 'shoot'; this.animOpt = { lash: true };
          const from = this.center.clone().add(V(0, 0.4, 0));
          const k = U.clamp((1.2 - this.stT) / 0.5, 0, 1);
          const to = from.clone().lerp(pc, k);
          g.fx.setBeam(5, from, to, 3.2, 0x5a1010, 0xa03030);
          if (!this.grabbed && k >= 1) {
            this.grabbed = true;
            if (this.distTo(pc) < 26 && g.world.los(from, pc)) {
              g.hurtPlayer(enraged ? 150 : 120, this.pos, { knock: 0 });
              P.knockdown(from.clone().sub(pc).normalize(), 28, 1.4); // притянул и сбил на землю
              g.ui.tag('СХВАЧЕН!', '#ff6a6a', 1); A().punch();
            }
          }
          if (this.stT <= 0) { g.fx.setBeam(5, null); this.cd.grab = enraged ? 4 : 6; this.setSt('chase', 0); }
          break;
        }
        case 'leap': {
          const k = 1 - Math.max(0, this.stT) / 1.3;
          this.noPhysics = true; this.vel.set(0, 0, 0);
          this.pos.lerpVectors(this.leapFrom, this.leapTo, k); this.pos.y = Math.sin(k * Math.PI) * (g.world.oval ? 3.5 : 18);
          g.fx.warn(1, this.leapTo, 8, k);
          this.anim = 'jump';
          if (this.stT <= 0) {
            this.noPhysics = false; this.pos.y = 0; g.fx.warn(1, null);
            A().slam(); g.fx.dust(this.pos, 24); g.fx.ring(this.pos, 0xffffff, 12, 0.5); g.fx.addShake(1);
            if (this.dist2D(P.pos) < 8 && P.pos.y < 6) g.hurtPlayer(enraged ? 240 : 190, this.pos, { knock: 24, down: true });
            for (const a of g.actors) if (a !== this && a.alive && a.dist2D(this.pos) < 8) a.damage(200, this, V(0, 12, 0));
            this.cd.leap = enraged ? 5 : 7; this.setSt('chase', 0);
          }
          break;
        }
        case 'car': {
          this.face(P.pos, dt, 8); this.stop(dt); this.anim = 'throw'; this.animOpt = { p: 1 - this.stT / 1.1, lash: true };
          if (!this.carMesh) { this.carMesh = g.world.oval ? M.part(new T.Group(), M.box(2.2, 0.9, 1.0), M.toon(0xece0c2), 0, 0, 0).parent : M.buildCar('car'); this.carMesh.position.set(0, 4.2, 0); this.carMesh.rotation.z = 0.3; this.obj.add(this.carMesh); }
          if (!this.thrown && this.stT < 0.35) {
            this.thrown = true; this.obj.remove(this.carMesh);
            const from = this.pos.clone().add(V(0, 4.5, 0));
            const dir = pc.clone().add(P.vel.clone().multiplyScalar(0.5)).sub(from).normalize();
            g.spawnProj('car', from, dir.multiplyScalar(42), { dmg: 220, owner: this, mesh: this.carMesh, radius: 7 });
            this.carMesh = null; A().whoosh();
          }
          if (this.stT <= 0) { this.cd.car = enraged ? 3 : 4.5; this.setSt('chase', 0); }
          break;
        }
      }
    }
    die(src) { super.die(src); this.g.fx.setBeam(5, null); this.g.fx.warn(0, null); this.g.fx.warn(1, null); this.keepBody = true; }
  }

  // ================= Райан (летает, рывки-удары) =================
  class Ryan extends Actor {
    constructor(g, o = {}) {
      super(g, M.DEFS.ryan, Object.assign({ hp: 1700, faction: 'enemy', name: 'Райан', height: 1.6 }, o));
      this.boss = true; this.noPhysics = true; this.st = 'orbit'; this.stT = 2.5; this.knockMul = 0.25; this.keepBody = true; this.orb = Math.random() * 6;
      this.aim = V(0, 0, 1); this.talkT = 3; this.punches = 0;
    }
    say(txt) { /* Райан молчит */ }
    damage(amount, src, knock) {
      // лазер Хоумлендера сбивает Райана в полёте
      if (this.alive && src === this.g.player && amount < 25 && this.st !== 'shot' && this.st !== 'crash' && this.pos.y > 0.9) {
        this.heat = (this.heat || 0) + amount;
        if (this.heat > 45) this.shotDown(knock);
      }
      return super.damage(amount, src, knock);
    }
    shotDown(dir) {
      const g = this.g; this.heat = 0;
      this.st = 'shot'; this.stT = 3; this.dmgMul = 1.5;
      const d = (dir && dir.lengthSq() > 0) ? dir.clone().setY(0).normalize() : this.pos.clone().sub(g.player.pos).setY(0).normalize();
      this.vel.copy(d.multiplyScalar(7)).setY(2); this.spin = 10;
      A().punch(); g.fx.burst(this.center, 8, { color: [0xff4020, 0xffd0a0], speed: 7, size: 0.2, life: 0.4 });
      g.fx.smoke(this.center, 3); g.ui.tag('РАЙАН СБИТ!', '#ff7050', 1.2);
    }
    think(dt) {
      const g = this.g, P = g.player, pc = P.center;
      this.stT -= dt; this.orb += dt * 0.8; this.talkT -= dt;
      this.heat = Math.max(0, (this.heat || 0) - 40 * dt);
      if (this.st === 'shot') {
        // падает кувырком
        this.vel.y -= 32 * dt; this.anim = 'tumble'; this.animOpt = { spin: ((this.c && this.c.cur.pitch) || 0) + this.spin * dt };
        if (Math.random() < 0.5) g.fx.smoke(this.center, 1, [0x555555, 0x333333]);
        const O3 = g.world.oval; if (O3) O3.clampInside(this.pos);
        if (this.pos.y <= 0.05 || this.stT <= 0) {
          this.pos.y = 0; this.vel.set(0, 0, 0); if (this.c) this.c.cur.pitch = -1.52; A().slam(); g.fx.dust(this.pos, 12); g.fx.addShake(0.5);
          this.st = 'crash'; this.stT = 2.6; this.dmgMul = 2; g.ui.tag('РАЙАН НА ПОЛУ — БЕЙ!', '#7cff7c', 1.4);
        }
        return;
      }
      if (this.talkT <= 0) {
        this.talkT = U.rand(6, 9);
        this.say(U.pick(['Я не хочу этого, пап!', 'Мама бы этого не хотела!', 'Почему ты не можешь просто остановиться?!', 'Я тоже умею драться, видишь?!',
          'Ты говорил, что я особенный. Это вот это?', 'Пап, прошу, хватит!', 'Я… я не знаю, что делаю!']));
      }
      if (this.st === 'brawl') {
        // серия ударов кулаками вблизи
        this.vel.multiplyScalar(Math.exp(-8 * dt)); this.face(P.pos, dt, 12);
        const tgt = pc.clone().add(this.pos.clone().sub(pc).setY(0).normalize().multiplyScalar(1.3)); tgt.y = Math.max(0.3, pc.y - 1.0);
        this.vel.lerp(tgt.sub(this.pos).multiplyScalar(5), 1 - Math.exp(-6 * dt));
        const ph = (this.stT % 0.5) / 0.5;
        this.anim = 'punch'; this.animOpt = { p: 1 - ph };
        if (ph < 0.45 && !this.hitThis) {
          this.hitThis = true;
          if (this.center.distanceTo(pc) < 2.4) {
            A().punch(); g.hurtPlayer(38, this.pos, { knock: 4 }); g.fx.burst(pc, 4, { color: [0xffffff, 0x9ac0ff], speed: 6, size: 0.15, life: 0.25 });
            if (++this.punches % 3 === 0) { P.knockdown(pc.clone().sub(this.center).setY(0).normalize(), 16, 0.8); }
          } else A().whiff();
        }
        if (ph > 0.6) this.hitThis = false;
        if (this.stT <= 0) { this.st = 'orbit'; this.stT = U.rand(1.6, 2.6); }
        if (this.pos.y < 0.3) this.pos.y = 0.3;
        const O2 = g.world.oval; if (O2) O2.clampInside(this.pos);
        return;
      }
      const phase2 = this.hp < this.maxHp * 0.5;
      if (this.st === 'crash') {
        this.vel.multiplyScalar(Math.exp(-8 * dt)); this.vel.y -= 20 * dt; this.anim = 'knocked'; this.dmgMul = 2;
        if (this.stT <= 0) { this.st = 'orbit'; this.stT = U.rand(1.5, 2.5); this.dmgMul = 1; }
      } else if (this.st === 'orbit') {
        const r = 9, tgt = pc.clone().add(V(Math.cos(this.orb) * r, 1.5 + Math.sin(this.orb * 1.7), Math.sin(this.orb) * r));
        tgt.y = Math.max(1.2, tgt.y);
        const want = tgt.sub(this.pos); const L = want.length();
        want.multiplyScalar(Math.min(22, L * 2) / Math.max(L, 0.01));
        this.vel.lerp(want, 1 - Math.exp(-4 * dt));
        this.face(P.pos, dt, 8); this.anim = 'hover'; this.animOpt = {};
        if (this.stT <= 0) { this.st = 'wind'; this.stT = 0.45; g.ui.tag('РАЙАН АТАКУЕТ!', '#9ac0ff', 0.6); }
      } else if (this.st === 'wind') {
        this.vel.multiplyScalar(Math.exp(-6 * dt)); this.face(P.pos, dt, 12); this.anim = 'punch'; this.animOpt = { p: 0.1 };
        if (this.stT <= 0) {
          this.st = 'dash'; this.stT = 0.85; this.hit = false;
          // неопытный: часто целится мимо
          const miss = Math.random() < 0.45 ? V(U.rand(-3, 3), U.rand(-1, 1.5), U.rand(-3, 3)) : V();
          this.aim.copy(pc).add(miss).sub(this.center).normalize(); A().whoosh();
          if (Math.random() < 0.3) g.ui.tag('Райан: «Ой… не туда!»', '#9ac0ff', 1);
        }
      } else if (this.st === 'dash') {
        this.vel.copy(this.aim).multiplyScalar(phase2 ? 46 : 38);
        this.anim = 'fly'; this.animOpt = { pitch: 1.4 };
        if (Math.random() < 0.8) g.fx.burst(this.center, 1, { color: [0x9ac0ff, 0xffffff], speed: 1, size: 0.25, life: 0.3, g: 0 });
        if (!this.hit && this.center.distanceTo(pc) < 1.9) {
          this.hit = true; A().punch(); g.fx.addShake(0.5);
          g.hurtPlayer(phase2 ? 110 : 85, this.pos, { knock: 0 });
          P.knockdown(this.aim.clone(), 26, 1.2);
          this.vel.multiplyScalar(-0.3); this.st = 'brawl'; this.stT = 1.5; this.hitThis = true;
        }
        if (this.stT <= 0) { if (this.center.distanceTo(pc) < 4) { this.st = 'brawl'; this.stT = 1.5; this.hitThis = false; } else { this.st = 'orbit'; this.stT = U.rand(phase2 ? 1.4 : 2.2, phase2 ? 2.4 : 3.5); } }
      }
      const minY = this.st === 'crash' ? 0 : 0.3; if (this.pos.y < minY) { this.pos.y = minY; if (this.vel.y < 0) this.vel.y = 0; }
      // в помещении: стены и потолок
      const O = g.world.oval;
      if (O && O.clampInside(this.pos) && this.st === 'dash') {
        this.st = 'crash'; this.stT = 1.6; this.vel.set(0, 0, 0); A().slam(); g.fx.dust(this.pos, 10); g.fx.addShake(0.4);
        g.ui.tag('РАЙАН ВРЕЗАЛСЯ — БЕЙ!', '#7cff7c', 1.4); this.say(U.pick(['Ай! Стена…', 'Ой… я не рассчитал!', 'Блин, опять…']));
        return;
      }
      if (O) return;
      // не влетать в здания
      const b = g.world.inside(this.pos.x, this.pos.y + 0.5, this.pos.z); if (b) { this.pos.y = b.y1 + 0.5; this.vel.y = Math.max(0, this.vel.y); }
    }
    die(src) { this.noPhysics = false; super.die(src); }
  }

  // ================= транспорт =================
  class Vehicle extends Actor {
    constructor(g, kind, o = {}) {
      const obj = M.buildCar(kind, o.color);
      super(g, null, Object.assign({ obj, hp: o.hp || 140, faction: 'vehicle', radius: kind === 'van' ? 1.6 : 1.4, height: 2 }, o));
      this.kind = kind; this.noPhysics = true; this.burning = 0; this.speed = o.speed || U.rand(9, 14); this.lane = o.lane; this.stopT = 0;
    }
    get center() { return V(this.pos.x, this.pos.y + 1.1, this.pos.z); }
    think(dt) {
      if (this.path) return this.followPath(dt);
      if (!this.lane) return;
      const L = this.lane, P = this.g.player;
      // остановиться, если впереди Хоумлендер
      const ahead = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const rel = P.pos.clone().sub(this.pos); const fwd = rel.dot(ahead);
      const blocked = fwd > 0 && fwd < 9 && Math.abs(rel.cross(ahead).y) < 2.2 && P.pos.y < 3;
      const sp = blocked ? 0 : this.speed;
      this.cur = U.damp(this.cur || sp, sp, 3, dt);
      this.pos.addScaledVector(ahead, this.cur * dt);
      const lim = HL.World.HALF + 15;
      if (L.axis === 'x') { if (this.pos.x > lim) this.pos.x = -lim; if (this.pos.x < -lim) this.pos.x = lim; }
      else { if (this.pos.z > lim) this.pos.z = -lim; if (this.pos.z < -lim) this.pos.z = lim; }
      if (this.obj.userData.siren) this.obj.userData.siren.material.color.setHex(Math.floor(this.g.time * 4) % 2 ? 0x2a5aff : 0xff2020);
    }
    followPath(dt) {
      const tgt = this.path[this.pi];
      tmp2.set(tgt.x - this.pos.x, 0, tgt.z - this.pos.z);
      const L = tmp2.length(), step = this.speed * dt;
      if (L <= step) { this.pi = (this.pi + 1) % this.path.length; }
      else { tmp2.multiplyScalar(step / L); this.pos.add(tmp2); }
      this.yaw = U.dampAng(this.yaw, Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z), 5, dt);
    }
    damage(a, src, knock) { return super.damage(a, src, null); }
    die(src) {
      this.alive = false; this.deadT = 0;
      this.g.explode(this.center.clone(), 7, 60, src, 1.2);
      this.obj.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.isMeshToonMaterial) { o.material = M.toon(0x1d1b1a); } });
      this.g.onDeath(this, src);
    }
    update(dt) {
      if (!this.alive) {
        this.deadT += dt;
        if (Math.random() < dt * 6) this.g.fx.smoke(this.center.clone().add(V(0, 0.8, 0)), 1);
        if (this.deadT < 6 && Math.random() < dt * 10) this.g.fx.fire(this.center.clone().add(V(U.rand(-1, 1), 0.5, U.rand(-1, 1))), 1);
        if (this.deadT > 25 && !this.keepBody) this.remove();
        return;
      }
      this.think(dt);
      this.sync();
    }
  }

  // ================= снаряды =================
  const pmats = {};
  function pmat(c) { return pmats[c] || (pmats[c] = new T.MeshBasicMaterial({ color: c, fog: false })); }
  class Proj {
    constructor(g, type, from, vel, o) {
      this.g = g; this.type = type; this.pos = from.clone(); this.vel = vel.clone(); this.o = o; this.alive = true; this.t = 0;
      this.dmg = o.dmg || 10; this.owner = o.owner; this.travel = 0; this.maxDist = o.maxDist || 150;
      let mesh;
      switch (type) {
        case 'bullet': mesh = new T.Mesh(M.box(0.06, 0.06, 1.1), pmat(0xffe070)); break;
        case 'antisupe': mesh = new T.Mesh(M.box(0.1, 0.1, 1.6), pmat(0xc040ff)); mesh.add(M.glowSprite(0xc040ff, 1.2)); break;
        case 'knife': mesh = new T.Mesh(M.box(0.05, 0.05, 0.5), pmat(0xd0d0d0)); break;
        case 'grenade': mesh = new T.Mesh(M.sph(0.16), M.toon(0x2a3a2a)); break;
        case 'light': mesh = M.glowSprite(0xfff0a0, 1.6); mesh.add(new T.Mesh(M.sph(0.18), pmat(0xffffff))); break;
        case 'shield': mesh = M.makeShieldMesh(); mesh.scale.setScalar(1.3); this.back = false; break;
        case 'car': mesh = o.mesh || M.buildCar('car'); break;
        default: mesh = new T.Mesh(M.sph(0.2), pmat(0xffffff));
      }
      this.mesh = mesh; mesh.position.copy(this.pos); g.scene.add(mesh);
      if (type === 'bullet' || type === 'antisupe' || type === 'knife') mesh.lookAt(this.pos.clone().add(this.vel));
    }
    update(dt) {
      const g = this.g, P = g.player;
      this.t += dt;
      if (this.type === 'grenade' || this.type === 'car') this.vel.y -= (this.type === 'car' ? 12 : 22) * dt;
      if (this.type === 'shield') {
        // бумеранг: летит, затем возвращается к владельцу
        const ow = this.owner;
        if (!this.back && (this.travel > this.maxDist || this.t > 1.6)) this.back = true;
        if (this.back) {
          if (!ow || !ow.alive) { this.kill(); return; }
          const to = ow.center.clone().sub(this.pos); const L = to.length();
          if (L < 1.5) { ow.catchShield && ow.catchShield(); this.kill(); return; }
          this.vel.lerp(to.normalize().multiplyScalar(45), 1 - Math.exp(-5 * dt));
        }
        this.mesh.rotation.x = -Math.PI / 2; this.mesh.rotation.z += dt * 25;
      }
      const step = this.vel.length() * dt;
      this.pos.addScaledVector(this.vel, dt); this.travel += step;
      this.mesh.position.copy(this.pos);
      if (this.type === 'car') { this.mesh.rotation.x += dt * 3; this.mesh.rotation.z += dt * 2; }
      if (this.type === 'grenade') { if (this.t > this.o.fuse) { this.boom(); return; } }
      // попадание в игрока
      if (this.owner && this.owner.faction === 'enemy' && !P.dead) {
        const pc = P.center; const r = this.type === 'car' ? 3 : this.type === 'shield' ? 1.6 : 0.9;
        if (this.pos.distanceTo(pc) < r) {
          if (this.type === 'grenade') { this.boom(); return; }
          if (this.type === 'car') { this.boom(); return; }
          g.hurtPlayer(this.dmg, this.pos, { knock: this.type === 'shield' ? 20 : this.type === 'antisupe' ? 3 : 0, type: this.type, down: this.type === 'shield' });
          if (this.type === 'shield') { this.back = true; A().clang(); g.fx.sparks(this.pos, 0xffffff, 10); return; }
          if (this.type === 'light') g.fx.burst(this.pos, 8, { color: [0xffffff, 0xfff0a0], speed: 8, size: 0.2, life: 0.4 });
          this.kill(); return;
        }
      }
      // попадание в мир
      if (this.pos.y < 0.1 || g.world.inside(this.pos.x, this.pos.y, this.pos.z)) {
        if (this.type === 'grenade') { this.vel.y = Math.abs(this.vel.y) * 0.35; this.vel.x *= 0.5; this.vel.z *= 0.5; this.pos.y = Math.max(0.15, this.pos.y); return; }
        if (this.type === 'car') { this.boom(); return; }
        if (this.type === 'shield') { this.back = true; A().clang(); g.fx.sparks(this.pos, 0xffffff, 6); this.pos.addScaledVector(this.vel, -dt * 2); return; }
        g.fx.sparks(this.pos, this.type === 'antisupe' ? 0xc040ff : 0xffe0a0, 3);
        this.kill(); return;
      }
      if (this.travel > this.maxDist + 60 && this.type !== 'shield') this.kill();
    }
    boom() {
      const r = this.o.radius || 6;
      this.g.explode(this.pos.clone(), r, this.dmg, this.owner, this.type === 'car' ? 1.4 : 0.8);
      this.kill();
    }
    kill() { this.alive = false; this.g.scene.remove(this.mesh); }
  }

  return { Ryan, Actor, Civilian, Victim, Gunman, Grenadier, Brawler, Starlight, Runner, SoldierBoy, ButcherBoss, Vehicle, Proj, WEAPONS };
})();
