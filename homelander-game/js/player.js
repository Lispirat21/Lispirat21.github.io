// Хоумлендер — управляемый игроком персонаж
HL.Player = (function () {
  const T = THREE, U = HL.U, M = HL.Models, A = () => HL.Audio, I = () => HL.Input;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

  class Player {
    constructor(g) {
      this.g = g;
      this.c = M.buildChar(M.DEFS.homelander);
      g.scene.add(this.c.root);
      this.pos = V(); this.vel = V(); this.yaw = 0; this.prevPos = V();
      this.scriptMove = null; this.scriptSpeed = 1.8; this.scriptFace = null; this.scriptPose = null; this.scriptVel = null; this.scriptGlow = false;
      this.flying = false; this.grounded = true;
      this.maxHp = 2200; this.hp = 2200;
      this.heat = 0; this.overheat = false; this.lasering = false;
      this.rage = 0; this.rageT = 0;
      this.hearT = 0; this.hearCd = 0;
      this.punchT = 0; this.punchCd = 0; this.punchTarget = null; this.punchHit = false;
      this.combo = 0; this.comboTgt = null; this.comboLast = -9; this.punchKind = 1; this.carryT = 0; this.throwT = 0; this.xrayT = 0; this.xrayCd = 0;
      this.poseT = 0; this.poseCd = 0; this.idleT = 0;
      this.carry = null; this.depowerT = 0; this.stunT = 0;
      this.lastHurt = -10; this.dead = false; this.hurtSnd = 0;
      this.radius = 0.5; this.height = 2.2;
      this.fallVy = 0; this.airT = 0;
      this.stats = { kills: 0, civ: 0, laser: 0, dmg: 0 };
    }
    get center() { return V(this.pos.x, this.pos.y + 1.25, this.pos.z); }
    place(x, y, z, yaw = 0) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.sync(); }
    eyePos(i) { const p = V(); this.c.glow[i].getWorldPosition(p); return p; }
    depower(t) {
      if (this.depowerT <= 0) { this.g.ui.tag('СИЛЫ ПОДАВЛЕНЫ', '#9cff9c', Math.min(t, 3)); }
      this.depowerT = Math.max(this.depowerT, t);
      if (this.flying) { this.flying = false; }
      if (this.carry) this.drop();
    }
    stun(t) { this.stunT = Math.max(this.stunT, t); }
    hurt(dmg, from, o = {}) {
      if (this.dead || this.g.godMode) return;
      if (this.g.cinematic && !this.g.cineHit) return; // в кат-сценах урона нет
      let mul = this.rageT > 0 ? 0.35 : 1;
      if (this.depowerT > 0) mul *= 1.6;
      mul *= this.g.diffMul || 1;
      const d = dmg * mul;
      this.hp -= d; this.stats.dmg += d;
      this.rage = Math.min(100, this.rage + d * 0.12);
      this.lastHurt = this.g.time;
      this.g.ui.hurt(Math.min(1, d / 60 + 0.25));
      if (!o.silent && this.hurtSnd <= 0) { A().hurt(); this.hurtSnd = 0.15; }
      if (o.knock && from) {
        const k = this.center.sub(from); k.y = Math.max(0.2, k.y); k.normalize().multiplyScalar(o.knock);
        this.vel.add(k);
        if (o.knock > 10) this.g.fx.addShake(0.35);
        if (o.down && this.rageT <= 0) { const dir = this.center.sub(from); dir.y = 0; this.knockdown(dir.normalize(), o.knock, 1.3); }
      }
      if (this.g.noDeath && this.hp < 1) this.hp = 1; // в сюжетной схватке умереть нельзя
      if (this.hp <= 0) { this.hp = 0; this.die(); }
    }
    // сбит: падает с неба, кувыркается и лежит пару секунд
    knockdown(dir, force = 22, t = 1.3) {
      if (this.dead || this.godMode) return;
      const wasFlying = this.flying;
      this.flying = false;
      if (this.carry) this.drop();
      const v = dir.clone(); if (v.lengthSq() < 1e-4) v.set(0, 0, 1);
      v.normalize().multiplyScalar(force); v.y = Math.max(v.y, wasFlying ? -4 : 7);
      this.vel.copy(v);
      this.downT = Math.max(this.downT || 0, t); this.spin = (Math.random() < 0.5 ? -1 : 1) * 9;
      this.c.cur.pitch = 0;
      this.g.ui.tag('СБИТ!', '#ff8a5a', 1); this.g.fx.addShake(0.6);
      if (this.lasering) { this.lasering = false; A().setLaser(false); this.g.fx.setBeam(0, null); this.g.fx.setBeam(1, null); }
    }
    die() {
      this.dead = true; this.flying = false; this.lasering = false;
      this.g.fx.setBeam(0, null); this.g.fx.setBeam(1, null); A().setLaser(false);
      if (this.carry) this.drop();
      this.g.onPlayerDeath();
    }
    drop() {
      const v = this.carry; if (!v) return;
      v.carried = false; this.carry = null;
      if (v.throwable) { v.throwable = false; v.noPhysics = !!v.noPhysicsPrev; v.pos.set(this.pos.x + Math.sin(this.yaw) * 1.4, this.pos.y + 0.3, this.pos.z + Math.cos(this.yaw) * 1.4); v.vel.set(0, 0, 0); return; }
      v.pos.set(this.pos.x + Math.sin(this.yaw) * 1.2, this.pos.y + 0.2, this.pos.z + Math.cos(this.yaw) * 1.2);
      v.vel.set(0, 0, 0);
      this.g.onDrop && this.g.onDrop(v);
    }

    update(dt) {
      const g = this.g, inp = g.controlsEnabled && this.stunT <= 0 && !this.dead;
      const In = I();
      this.prevPos.copy(this.pos);
      this.hurtSnd -= dt; this.punchCd -= dt; if (this.throwT > 0) this.throwT -= dt; this.poseCd -= dt; this.hearCd -= dt;
      if (this.stunT > 0) this.stunT -= dt;
      if (this.depowerT > 0) this.depowerT -= dt;
      if (this.rageT > 0) { this.rageT -= dt; if (this.rageT <= 0) g.ui.tag('Ярость прошла', '#ff8080', 1); }
      if (this.hearT > 0) this.hearT -= dt;
      if (this.poseT > 0) this.poseT -= dt;
      const depow = this.depowerT > 0;

      if (!this.dead && this.downT > 0) {
        // кувырок и лежание
        this.vel.y -= 32 * dt;
        const w = g.world; let roof = null;
        const nSub = Math.min(10, Math.max(1, Math.ceil((this.vel.length() * dt) / 1.5)));
        for (let k = 0; k < nSub; k++) { const py = this.pos.y; this.pos.addScaledVector(this.vel, dt / nSub); const r = w.collide(this.pos, this.radius, this.height, py); if (r != null) roof = r; }
        const gY = roof != null ? roof : 0;
        const air = this.pos.y > gY + 0.05;
        if (!air) {
          if (this.vel.y < -18) { g.fx.dust(this.pos, 12); A().slam(); g.fx.addShake(0.5); }
          this.pos.y = gY; this.vel.y = 0; this.vel.x *= Math.exp(-7 * dt); this.vel.z *= Math.exp(-7 * dt);
          this.downT -= dt;
        } else this.downT = Math.max(this.downT, 0.6);
        if (air) M.animate(this.c, dt, 'tumble', 0, { spin: (this.c.cur.pitch || 0) + this.spin * dt });
        else M.animate(this.c, dt, this.downT < 0.35 ? 'idle' : 'knocked', 0);
        this.c.capeAng = 0.4; this.c.capeAmp = 0.2;
        M.setGlow(this.c, false); A().setWind(0);
        this.grounded = !air;
        if (this.downT <= 0) { this.downT = 0; this.c.cur.pitch = 0; }
        this.sync(); return;
      }
      if (this.dead) {
        this.vel.y -= 30 * dt; this.pos.addScaledVector(this.vel, dt);
        if (this.pos.y < 0) { this.pos.y = 0; this.vel.set(0, 0, 0); }
        M.animate(this.c, dt, 'dead', 0); M.setGlow(this.c, false); this.sync(); return;
      }

      // регенерация
      if (g.time - this.lastHurt > 4 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (depow ? 20 : 110) * dt);

      const ax = inp ? In.axis() : { x: 0, z: 0 };
      const yaw = g.camYaw, pitch = g.camPitch;
      const F = V(Math.sin(yaw), 0, Math.cos(yaw)), R = V(-Math.cos(yaw), 0, Math.sin(yaw));
      let moveDir = F.clone().multiplyScalar(ax.z).add(R.clone().multiplyScalar(ax.x));
      let scriptSp = 0;
      if (this.scriptMove) {
        const d = V(this.scriptMove.x - this.pos.x, 0, this.scriptMove.z - this.pos.z);
        if (d.length() > 0.12) { moveDir = d.normalize(); scriptSp = this.scriptSpeed; } else { this.vel.x = this.vel.z = 0; }
      }
      const boost = inp && In.held('boost') && !depow;
      const upH = inp && In.held('up'), downH = inp && In.held('down');

      // переключение полёта / прыжок
      if (inp && In.hit('fly') && !depow) { this.flying = !this.flying; if (this.flying) { this.vel.y = Math.max(this.vel.y, 6); A().whoosh(); } }
      if (inp && In.hit('up') && !this.flying) {
        if (this.grounded) { this.vel.y = depow ? 8 : 14; this.grounded = false; }
        else if (!depow) { this.flying = true; A().whoosh(); }
      }
      if (depow) this.flying = false;

      // способности
      if (inp && In.hit('use') && !g.useLock) {
        if (this.carry) { if (this.carry.throwable) this.throwCarry(); else this.drop(); }
        else {
          let best = null, bd = 4;
          for (const a of g.actors) if (a.pickable && !a.carried && !a.rescued && a.alive) { const d = a.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = a; } }
          if (best && !depow) { this.carry = best; best.carried = true; A().pickup(); g.onPickup && g.onPickup(best); }
          else if (!depow) this.tryGrab();
        }
      }
      // держать босса долго нельзя — вырывается
      if (this.carry && this.carry.throwable) {
        this.carryT += dt;
        const c = this.carry;
        if (!c.alive || c.removed) { this.carry = null; }
        else if (c.boss && this.carryT > 1.8) {
          this.carry = null; c.carried = false; c.throwable = false; c.noPhysics = !!c.noPhysicsPrev;
          c.pos.copy(this.pos).add(V(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(1.4));
          g.ui.tag((c.name || 'Враг').toUpperCase() + ' ВЫРВАЛСЯ!', '#ff8a5a', 1.2); A().punch();
          this.knockdown(V(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), 10, 0.7);
        }
      }
      // рентген
      if (this.xrayCd > 0) this.xrayCd -= dt;
      if (inp && In.hit('xray')) {
        if (this.xrayT > 0) { this.xrayT = 0; this.xrayCd = 1.5; A().beep(); }
        else if (this.xrayCd <= 0) { this.xrayT = 12; A().charge(0.3); g.ui.tag('РЕНТГЕН', '#7ab8ff', 0.9); g.onXray && g.onXray(); }
        else g.ui.hint('Рентген перезаряжается', 1);
      }
      if (this.xrayT > 0) { this.xrayT -= dt; if (this.xrayT <= 0) this.xrayCd = 3; }
      if (inp && In.hit('pose') && !this.carry) this.pose();
      if (inp && In.hit('hear')) {
        if (this.hearCd <= 0) { this.hearT = 6; this.hearCd = 12; A().heartbeat(0.6); g.onHear && g.onHear(); }
        else g.ui.hint('Суперслух перезаряжается: ' + Math.ceil(this.hearCd) + ' с', 1.2);
      }
      if (inp && In.hit('rage')) {
        if (this.rage >= 100) { this.rageT = 12; this.rage = 0; g.ui.tag('ЯРОСТЬ!', '#ff3030', 2); A().stinger(); g.fx.addShake(0.6); }
        else g.ui.hint('Ярость ещё не накоплена', 1);
      }

      // движение
      const prevY = this.pos.y;
      if (this.flying) {
        const sp = boost ? 150 : 54;
        const vy = -Math.sin(pitch - 0.22) * ax.z * sp * 0.9 + ((upH ? 1 : 0) - (downH ? 1 : 0)) * (boost ? 80 : 36);
        const want = moveDir.clone().multiplyScalar(sp * (1 - 0.4 * Math.abs(Math.sin(pitch - 0.22)) * Math.abs(ax.z)));
        want.y = vy;
        const k = boost ? 2.2 : 3.2;
        this.vel.x = U.damp(this.vel.x, want.x, k, dt); this.vel.z = U.damp(this.vel.z, want.z, k, dt); this.vel.y = U.damp(this.vel.y, want.y, k + 1, dt);
      } else {
        const sp = scriptSp || (depow ? 6 : boost ? 22 : 9);
        const k = this.grounded ? 14 : 3;
        this.vel.x = U.damp(this.vel.x, moveDir.x * sp, k, dt); this.vel.z = U.damp(this.vel.z, moveDir.z * sp, k, dt);
        this.vel.y -= 32 * dt;
      }
      // удар: рывок к цели
      if (inp && In.hit('punch') && this.punchCd <= 0 && !this.carry) this.startPunch(F);
      else if (inp && In.hit('punch') && this.carry && this.carry.throwable) this.throwCarry();
      if (this.punchT > 0) {
        this.punchT -= dt;
        const tg = this.punchTarget;
        if (tg && tg.alive && !this.punchHit) {
          const to = tg.center.sub(this.center); const L = to.length();
          if (L > 2.2) this.vel.copy(to.normalize().multiplyScalar(Math.min(45, L * 12)));
          else this.doPunchHit(tg);
        } else if (!this.punchHit && this.punchT < 0.2) {
          this.punchHit = true;
          if (this.punchWall) this.punchWallHit(this.punchWall); else A().whiff();
        }
      }
      if (this.scriptVel) this.vel.copy(this.scriptVel);
      // мир (подшаги, чтобы на большой скорости не пролетать сквозь дома)
      const w = g.world;
      const nSub = Math.min(10, Math.max(1, Math.ceil((this.vel.length() * dt) / 1.5)));
      let roof = null;
      for (let k = 0; k < nSub; k++) {
        const py = this.pos.y;
        this.pos.addScaledVector(this.vel, dt / nSub);
        const r = this.noClip ? null : w.collide(this.pos, this.radius, this.height, py);
        if (r != null) roof = r;
      }
      const gY = roof != null ? roof : 0;
      const wasGrounded = this.grounded;
      if (this.pos.y <= gY) {
        const impact = this.vel.y;
        this.pos.y = gY;
        if (this.flying && downH) { this.flying = false; }
        if (!wasGrounded && impact < -24 && !depow) this.slam(-impact);
        if (this.vel.y < 0) this.vel.y = 0;
        this.grounded = !this.flying;
        if (this.flying && this.vel.y < 0) this.vel.y = 0;
      } else this.grounded = !this.flying && this.pos.y - gY < 0.05;
      if (!this.flying && !this.grounded) this.airT += dt; else this.airT = 0;
      const L = HL.World.HALF + 200;
      this.pos.x = U.clamp(this.pos.x, -L, L); this.pos.z = U.clamp(this.pos.z, -L, L);
      if (this.pos.y > 320) { this.pos.y = 320; this.vel.y = Math.min(0, this.vel.y); }

      // лазер
      const wantLaser = inp && In.held('laser') && !this.carry && !depow && !this.overheat && this.punchT <= 0;
      if (wantLaser) {
        this.heat += (this.rageT > 0 ? 2.5 : 6) * dt; // ~16 с непрерывного луча до перегрева
        if (this.heat >= 100) { this.heat = 100; this.overheat = true; g.ui.tag('ПЕРЕГРЕВ', '#ff8040', 1.2); }
      } else { this.heat = Math.max(0, this.heat - 32 * dt); if (this.overheat && this.heat < 35) this.overheat = false; }
      if (wantLaser !== this.lasering) { this.lasering = wantLaser; A().setLaser(wantLaser, this.rageT > 0); }
      if (this.lasering) this.fireLaser(dt); else { g.fx.setBeam(0, null); g.fx.setBeam(1, null); g.fx.laserLight.intensity = 0; }

      // ориентация
      const hs = Math.hypot(this.vel.x, this.vel.z);
      let wantYaw = this.yaw;
      if (this.lasering || this.punchT > 0) wantYaw = yaw;
      else if (hs > 1.2) wantYaw = Math.atan2(this.vel.x, this.vel.z);
      else if (this.scriptFace != null) wantYaw = this.scriptFace;
      const prevYaw = this.yaw;
      this.yaw = U.dampAng(this.yaw, wantYaw, this.flying ? 6 : 12, dt);
      const turn = U.angDiff(prevYaw, this.yaw) / Math.max(dt, 1e-3);

      // анимация
      let mode = 'idle', sp = hs, opt = {};
      if (hs > 0.5 || Math.abs(this.vel.y) > 1 || this.lasering) this.idleT = 0; else this.idleT += dt;
      if (this.scriptPose) { mode = this.scriptPose; opt = this.scriptOpt || { p: 0.35 }; }
      else if (this.throwT > 0) { mode = 'throw'; opt = { p: 1 - this.throwT / 0.4 }; }
      else if (this.carry) { mode = 'carry'; opt = { fly: this.flying, over: !!this.carry.throwable }; }
      else if (this.punchT > 0) { const k = this.punchKind || 1; mode = 'punch'; opt = { p: 1 - this.punchT / 0.35, air: this.flying, left: k === 2, up: k === 3, down: k >= 4 }; }
      else if (this.flying) {
        const sp3 = this.vel.length();
        if (sp3 > 7) { mode = 'fly'; opt = { pitch: U.clamp(Math.atan2(hs, this.vel.y), 0.25, 2.3), roll: U.clamp(-turn * 0.25, -0.7, 0.7) }; }
        else { mode = 'hover'; opt = { pitch: U.clamp(hs * 0.04, 0, 0.3), roll: U.clamp(-turn * 0.1, -0.3, 0.3) }; }
      } else if (!this.grounded && this.airT > 0.15) mode = 'jump';
      else if (hs > 0.6) mode = hs > 6 ? 'run' : 'walk';
      else if (this.poseT > 0) mode = this.poseKind || 'akimbo';
      else if (this.idleT > 4) mode = 'akimbo';
      if (this.lasering) opt.headPitch = (this.flying && mode === 'fly' ? 0 : U.clamp(pitch - 0.2, -0.6, 0.8));
      if (this.scriptHead != null) opt.headPitch = this.scriptHead;
      // плащ
      if (mode === 'fly') { this.c.capeAng = 0.12; this.c.capeAmp = 0.2 + Math.min(0.3, this.vel.length() * 0.004); }
      else if (mode === 'hover') { this.c.capeAng = 0.1; this.c.capeAmp = 0.1; }
      else if (mode === 'run' || mode === 'walk') { this.c.capeAng = 0.15 + Math.min(0.9, hs * 0.05); this.c.capeAmp = 0.08 + hs * 0.006; }
      else if (mode === 'jump') { this.c.capeAng = this.vel.y < 0 ? -0.5 : 0.4; this.c.capeAmp = 0.15; }
      else { this.c.capeAng = 0.06; this.c.capeAmp = 0.05; }
      M.animate(this.c, dt, mode, sp, opt);
      M.setGlow(this.c, this.lasering || this.rageT > 0 || this.scriptGlow, this.lasering ? 0xff2a1a : 0xff5030);
      if (this.lasering) for (const s of this.c.glow) s.scale.setScalar(0.4 + Math.random() * 0.15);
      A().setWind(this.flying ? this.vel.length() : 0);
      this.sync();
    }
    // пролетел ли игрок через точку за этот кадр (отрезок prevPos→pos)
    passed(p, r) {
      const a = this.prevPos.clone().setY(this.prevPos.y + 1.25), b = this.center;
      const ab = b.clone().sub(a), L2 = ab.lengthSq();
      const t = L2 > 1e-6 ? U.clamp(p.clone().sub(a).dot(ab) / L2, 0, 1) : 0;
      return a.addScaledVector(ab, t).distanceTo(p) < r;
    }
    sync() { this.c.root.position.copy(this.pos); this.c.root.rotation.y = this.yaw; }

    fireLaser(dt) {
      const g = this.g;
      const aim = g.aim; // {point, normal, actor}
      const e0 = this.eyePos(0), e1 = this.eyePos(1);
      const rage = this.rageT > 0;
      const width = rage ? 2.4 : 1;
      g.fx.setBeam(0, e0, aim.point, width); g.fx.setBeam(1, e1, aim.point, width);
      g.fx.laserLight.position.copy(aim.point).addScaledVector(aim.normal || V(0, 1, 0), 0.6);
      g.fx.laserLight.intensity = rage ? 5 : 3.2;
      this.stats.laser += dt;
      if (Math.random() < 0.7) g.fx.sparks(aim.point, rage ? 0xff8040 : 0xffd0a0, 1);
      const dps = 235 * (rage ? 2.6 : 1);
      if (aim.actor) {
        const a = aim.actor;
        a.damage(dps * dt, this, a.faction === 'vehicle' ? null : aim.dir.clone().multiplyScalar(rage ? 6 * dt : 0));
        if (Math.random() < 0.3) g.fx.smoke(aim.point, 1, [0x555555, 0x333333]);
      } else if (aim.normal) {
        g.fx.scorch(aim.point, aim.normal);
        if (aim.box) g.world.damageBuilding(aim.box, dps * dt, aim.point);
        if (Math.random() < 0.15) g.fx.smoke(aim.point, 1);
      }
      if (rage) { // широкий луч задевает всё рядом с точкой
        for (const a of g.actors) if (a.alive && a !== aim.actor && a.faction !== 'ally' && !a.pickable && a.center.distanceTo(aim.point) < 2) a.damage(dps * 0.5 * dt, this);
      }
      if (Math.random() < dt * 4) g.alarm(aim.point, 18);
    }

    startPunch(F) {
      const g = this.g;
      this.punchT = 0.35; this.punchCd = 0.38; this.punchHit = false; this.punchTarget = null;
      const camF = V(); g.camera.getWorldDirection(camF); if (g.aimForce) camF.copy(g.aimForce.at).sub(g.aimForce.from).normalize();
      let best = null, bs = -1;
      for (const a of g.actors) {
        if (!a.alive || a.faction === 'ally' || a.pickable || a.carried) continue;
        const to = a.center.sub(this.center); const d = to.length(); if (d > 11) continue;
        const dot = to.normalize().dot(camF);
        if (dot < 0.55) continue;
        const s = dot * 2 - d / 11 - (a.faction === 'civ' ? 0.6 : 0); // прохожих тоже можно бить, но враги в приоритете
        if (s > bs) { bs = s; best = a; }
      }
      this.punchTarget = best; this.punchWall = null;
      this.punchKind = best && best === this.comboTgt && g.time - this.comboLast < 1.0 ? Math.min(4, this.combo + 1) : 1;
      if (!best) {
        this.vel.addScaledVector(camF, 6);
        const h = g.world.raycast(this.center, camF, 4.5);
        if (h && h.box) this.punchWall = h;
      }
    }
    doPunchHit(a) {
      const g = this.g;
      this.punchHit = true;
      const dir = a.center.sub(this.center).normalize();
      const rage = this.rageT > 0;
      // комбо: удар — удар — апперкот — удар сверху
      this.combo = a === this.comboTgt && g.time - this.comboLast < 1.0 ? this.combo + 1 : 1;
      this.comboTgt = a; this.comboLast = g.time;
      const n = Math.min(4, this.combo);
      const mul = [1, 1, 1.15, 1.6, 2.3][n];
      const dmg = (a.boss ? 135 : 220) * (rage ? 2.2 : 1) * mul;
      let knock = dir.clone().multiplyScalar(rage ? 48 : 32).add(V(0, rage ? 16 : 11, 0));
      if (n <= 2) knock = dir.clone().multiplyScalar(a.boss ? 2 : 4).setY(1.5); // первые удары держат врага рядом — серию можно продолжить
      if (n === 3) { knock = dir.clone().multiplyScalar(4).setY(a.boss ? 12 : 20); g.ui.tag('АППЕРКОТ!', '#ffd24a', 0.7); }
      if (n >= 4) { knock = V(0, -24, 0); g.ui.tag('ДОБИВАНИЕ!', '#ff5a3a', 0.9); }
      if (n >= 3 && a.boss) { a.vel.y = n === 3 ? 13 : -24; a.airborne = true; a.downT = Math.max(a.downT || 0, n === 3 ? 1.3 : 1.8); }
      a.damage(dmg, this, knock);
      if (n >= 4) { // ударная волна при добивании
        this.combo = 0; g.fx.ring(a.pos.clone().setY(Math.max(0.3, a.pos.y)), 0xffffff, 7, 0.4); g.fx.dust(a.pos, 14); A().slam();
        for (const b of g.actors) if (b !== a && b.alive && b.faction === 'enemy' && b.pos.distanceTo(a.pos) < 6) b.damage(70, this, b.pos.clone().sub(a.pos).setY(0).normalize().multiplyScalar(18).setY(8));
        g.finisher && g.finisher(a, 'slam');
      } else if (n === 3 && (!a.alive || Math.random() < 0.3)) g.finisher && g.finisher(a, 'upper');
      this.vel.multiplyScalar(0.1);
      A().punch(); g.fx.addShake(0.55);
      g.fx.burst(a.center, 6, { color: [0xb01818, 0x7a0e0e], speed: 7, size: 0.16, life: 0.5, g: -16 });
      g.fx.burst(a.center, 10, { color: [0xffffff, 0xffe0a0], speed: 10, size: 0.2, life: 0.3 });
      g.fx.ring(a.center, 0xffffff, 3, 0.25);
      g.hitStop = 0.05;
    }
    // схватить врага, босса или машину
    tryGrab() {
      const g = this.g; let best = null, bd = 1e9;
      for (const a of g.actors) {
        if (!a.alive || a.removed || a.carried || a.invuln || a.pickable || a.noGrab) continue;
        const isCar = a.faction === 'vehicle';
        if (a.faction !== 'enemy' && !isCar) continue;
        const d = a.dist2D(this.pos), dy = Math.abs(a.pos.y - this.pos.y);
        if (d < (isCar ? 4.6 : 3.4) && dy < 3 && d < bd) { bd = d; best = a; }
      }
      if (!best) { g.ui.hint('Рядом нечего схватить', 1); return; }
      const a = best;
      this.carry = a; this.carryT = 0; a.carried = true; a.throwable = true; a.noPhysicsPrev = a.noPhysics; a.noPhysics = true; a.vel.set(0, 0, 0); a.downT = 0; a.airborne = false;
      if (a.stopEyes) a.stopEyes(); if (a.chestGlow) a.chestGlow.visible = false;
      for (const i of [2, 3, 4, 5]) g.fx.setBeam(i, null);
      if (a.setSt) a.setSt(a.constructor.name === 'Maeve' ? 'approach' : 'chase', 0);
      A().pickup(); A().punch(); g.fx.addShake(0.25);
      g.ui.tag(a.faction === 'vehicle' ? 'МАШИНА ПОДНЯТА — БРОСАЙ!' : (a.boss ? (a.name || '').toUpperCase() + ' СХВАЧЕН — БРОСАЙ!' : 'СХВАЧЕН — БРОСАЙ!'), '#ffd24a', 1.2);
    }
    throwCarry() {
      const g = this.g, a = this.carry; if (!a) return;
      this.carry = null; a.carried = false; a.throwable = false; this.throwT = 0.4;
      const dir = V(); g.camera.getWorldDirection(dir); if (g.aimForce) dir.copy(g.aimForce.at).sub(g.aimForce.from).normalize(); dir.y = Math.max(dir.y, -0.35); dir.normalize();
      const from = this.center.add(V(0, 1.1, 0)).addScaledVector(dir, 1.6);
      A().whoosh(); g.fx.addShake(0.3);
      if (a.faction === 'vehicle') {
        const mesh = a.obj; a.remove(); g.scene.add(mesh); mesh.position.copy(from);
        g.spawnProj('car', from, dir.clone().multiplyScalar(62).add(V(0, 4, 0)), { dmg: 260, owner: this, mesh, radius: 7 });
      } else {
        a.noPhysics = false; a.pos.copy(from).add(V(0, -1, 0)); a.vel.copy(dir).multiplyScalar(44).add(V(0, 6, 0));
        a.airborne = true; a.spin = 12; a.downT = 2.2; a.thrown = { t: 0, hit: new Set() };
      }
    }
    punchWallHit(h) {
      const g = this.g, rage = this.rageT > 0;
      A().punch(); A().slam && A().slam(); g.fx.addShake(0.6); g.hitStop = 0.05;
      g.fx.burst(h.point, 14, { color: [0x9a9590, 0x6a6560, 0xd0c8b8], speed: 11, size: 0.3, life: 0.8, g: -18 });
      g.fx.dust(h.point, 4); g.fx.ring(h.point, 0xffffff, 2.5, 0.25);
      if (h.normal) g.fx.scorch(h.point, h.normal);
      g.world.damageBuilding(h.box, 260 * (rage ? 2.2 : 1), h.point);
      this.vel.copy(h.normal || V()).multiplyScalar(4);
      g.alarm(h.point, 25);
    }
    slam(v) {
      const g = this.g;
      const r = U.clamp(v * 0.25, 5, 12);
      A().slam(); g.fx.addShake(Math.min(1.2, v / 40)); g.fx.dust(this.pos, 20); g.fx.ring(this.pos, 0xffffff, r * 1.3, 0.5);
      for (const a of g.actors) {
        if (!a.alive || a.pickable || a.faction === 'ally') continue;
        const d = a.dist2D(this.pos);
        if (d < r && Math.abs(a.pos.y - this.pos.y) < 4) {
          const k = a.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(18 * (1 - d / r) + 6).setY(10);
          a.damage(a.faction === 'civ' ? 40 : 70 * (1 - d / r) + 20, this, k);
        }
      }
      g.alarm(this.pos, 30);
    }
    pose() {
      const g = this.g;
      if (this.poseT <= 0) this.poseKind = this.poseKind === 'spread' ? 'akimbo' : 'spread'; // позы по очереди: руки в стороны / руки в боки
      this.poseT = 2.2;
      if (this.poseCd > 0) return;
      let n = 0;
      for (const a of g.actors) if (a.faction === 'civ' && a.alive && !a.pickable && a.dist2D(this.pos) < 32 && a.fear <= 0) { a.cheer = 2.5; n++; }
      if (n >= 3) {
        this.poseCd = 10; A().cheer();
        g.changeApproval(Math.min(4, 1 + n * 0.25), 'Толпа в восторге');
      } else g.ui.hint('Рядом нет зрителей', 1);
      g.onPose && g.onPose(n);
    }
  }
  return Player;
})();
