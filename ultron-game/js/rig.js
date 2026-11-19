// Skeleton-agnostic procedural animation.
// Poses are described as world directions in *character space* (+X = character's left, +Y = up, +Z = forward),
// so the same animation code drives any humanoid skeleton (T-pose or A-pose) through a bone map.
import * as THREE from 'three';

const S = (n) => n.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');

// key: [bone, tipBone]
export const BONE_MAPS = {
  sentinel: {
    detect: 'spine_03',
    bones: {
      spineA: ['spine_01', 'spine_02'], spineB: ['spine_03', 'neck_01'], neck: ['neck_01', 'neck_02'], head: ['head'], jaw: ['jaw'],
      upperarm_L: ['upperarm_L', 'forearm_L'], forearm_L: ['forearm_L', 'hand_L'], hand_L: ['hand_L', 'middle_01_L'],
      upperarm_R: ['upperarm_R', 'forearm_R'], forearm_R: ['forearm_R', 'hand_R'], hand_R: ['hand_R', 'middle_01_R'],
      thigh_L: ['thigh_L', 'shin_L'], shin_L: ['shin_L', 'foot_L'], foot_L: ['foot_L', 'ball_L'],
      thigh_R: ['thigh_R', 'shin_R'], shin_R: ['shin_R', 'foot_R'], foot_R: ['foot_R', 'ball_R'],
    },
    fingers: (s) => ['thumb', 'index', 'middle', 'ring', 'pinky'].map((f) => [1, 2, 3].map((i) => `${f}_0${i}_${s}`)),
  },
  xps: {
    detect: 'spine_lower',
    bones: {
      spineA: ['spine_lower', 'spine_upper'], spineB: ['spine_upper', 'head_neck_lower'], neck: ['head_neck_lower', 'head_neck_upper'],
      head: ['head_neck_upper'], jaw: ['head_jaw'],
      upperarm_L: ['arm_left_shoulder_2', 'arm_left_elbow'], forearm_L: ['arm_left_elbow', 'arm_left_wrist'], hand_L: ['arm_left_wrist', 'arm_left_finger_3a'],
      upperarm_R: ['arm_right_shoulder_2', 'arm_right_elbow'], forearm_R: ['arm_right_elbow', 'arm_right_wrist'], hand_R: ['arm_right_wrist', 'arm_right_finger_3a'],
      thigh_L: ['leg_left_thigh', 'leg_left_knee'], shin_L: ['leg_left_knee', 'leg_left_foot'], foot_L: ['leg_left_foot', 'leg_left_toes'],
      thigh_R: ['leg_right_thigh', 'leg_right_knee'], shin_R: ['leg_right_knee', 'leg_right_ankle'], foot_R: ['leg_right_ankle', 'leg_right_toes'],
    },
    fingers: (s) => [1, 2, 3, 4, 5].map((f) => ['a', 'b', 'c'].map((k) => `arm_${s === 'L' ? 'left' : 'right'}_finger_${f}${k}`)),
  },
};

const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _id = new THREE.Quaternion();

export class Rig {
  constructor(container, model) {
    this.container = container;
    const byName = {};
    model.traverse((o) => { if (o.isBone) byName[S(o.name)] = o; });
    this.type = Object.keys(BONE_MAPS).find((k) => byName[BONE_MAPS[k].detect]) || null;
    this.ok = !!this.type;
    if (!this.ok) return;
    const map = BONE_MAPS[this.type];
    this.b = {}; this.tip = {};
    for (const [k, [b, t]] of Object.entries(map.bones)) {
      if (byName[b]) { this.b[k] = byName[b]; this.tip[k] = t ? byName[t] : null; }
    }
    this.all = Object.values(byName);
    this.rest = this.all.map((b) => b.quaternion.clone());
    this.restPos = this.all.map((b) => b.position.clone());
    container.updateMatrixWorld(true);
    // fingers: curl axis stored in hand-local space
    this.fingers = { L: [], R: [] };
    container.getWorldQuaternion(_qc);
    const qcInv = _qc.clone().invert();
    for (const s of ['L', 'R']) {
      const hand = this.b['hand_' + s];
      if (!hand) continue;
      hand.getWorldQuaternion(_qw);
      const handInv = _qw.clone().invert();
      map.fingers(s).forEach((chain, i) => {
        const segs = chain.map((n) => byName[n]).filter(Boolean);
        if (segs.length < 2) return;
        segs[0].getWorldPosition(_p); segs[1].getWorldPosition(_c);
        const dir = _c.clone().sub(_p).normalize();
        const dirL = dir.clone().applyQuaternion(qcInv);
        // palm normal guess (character space): down for horizontal hands, toward body for hanging hands
        const posL = _p.clone().applyQuaternion(qcInv);
        const palm = Math.abs(dirL.y) < 0.6 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-Math.sign(posL.x) || -1, 0, 0.25);
        palm.sub(dirL.clone().multiplyScalar(palm.dot(dirL))).normalize();
        const axisL = new THREE.Vector3().crossVectors(dirL, palm).normalize();
        const axisW = axisL.applyQuaternion(_qc);
        this.fingers[s].push({ segs, thumb: i === 0, axis: axisW.applyQuaternion(handInv) });
      });
    }
  }

  reset() {
    if (!this.ok) return;
    this.all.forEach((b, i) => { b.quaternion.copy(this.rest[i]); b.position.copy(this.restPos[i]); });
    this.container.updateMatrixWorld(true);
    this.container.getWorldQuaternion(_qc);
  }

  _applyWorld(bone, q) {
    bone.getWorldQuaternion(_qw);
    bone.parent.getWorldQuaternion(_qp);
    bone.quaternion.copy(_qp.invert().multiply(q).multiply(_qw));
    bone.updateMatrixWorld(true);
  }

  // point bone (head->tip) toward a character-space direction
  aim(key, x, y, z, w = 1) {
    const bone = this.b[key], tip = this.tip[key];
    if (!bone || !tip || w <= 0) return;
    bone.getWorldPosition(_p); tip.getWorldPosition(_c);
    _d.subVectors(_c, _p).normalize();
    _t.set(x, y, z).normalize().applyQuaternion(_qc);
    _q.setFromUnitVectors(_d, _t);
    if (w < 1) _q.slerpQuaternions(_id, _q, w);
    this._applyWorld(bone, _q);
  }

  // rotate bone about a character-space axis
  rot(key, x, y, z, ang) {
    const bone = this.b[key];
    if (!bone || !ang) return;
    _t.set(x, y, z).normalize().applyQuaternion(_qc);
    _q.setFromAxisAngle(_t, ang);
    this._applyWorld(bone, _q);
  }

  curl(side, amt, thumb = amt * 0.6) {
    const hand = this.b['hand_' + side];
    if (!hand) return;
    for (const f of this.fingers[side]) {
      const a = f.thumb ? thumb : amt;
      f.segs.forEach((seg, i) => {
        hand.getWorldQuaternion(_qw);
        _t.copy(f.axis).applyQuaternion(_qw);
        _q.setFromAxisAngle(_t, a * (i === 0 ? 0.8 : 1.0));
        this._applyWorld(seg, _q);
      });
    }
  }
}

// ---------------------------------------------------------------- poses
const lerp = (a, b, t) => a + (b - a) * t;

export function animate(rig, s) {
  if (!rig.ok) return;
  rig.reset();
  const t = s.time;
  const ph = s.phase;
  const loco = Math.min(1, s.speed);          // 0 idle .. 1 walk
  const run = Math.max(0, Math.min(1, s.speed - 1)); // 0..1 run
  const fly = s.fly || 0;
  const breath = Math.sin(t * 1.6);

  // torso
  rig.rot('spineA', 1, 0, 0, 0.03 * breath * (1 - loco) + run * 0.22 + fly * 0.18 + (s.dash || 0) * 0.45 - (s.hit || 0) * 0.35 + (s.menu ? 0.05 : 0));
  rig.rot('spineA', 0, 1, 0, Math.sin(ph) * (0.1 * loco + 0.08 * run) + (s.twist || 0));
  rig.rot('spineB', 1, 0, 0, 0.02 * breath + (s.menu ? 0.06 : 0) - (s.hit || 0) * 0.2);
  rig.rot('spineB', 0, 1, 0, -Math.sin(ph) * (0.12 * loco + 0.1 * run) + (s.twist || 0) * 0.6);
  // head
  const look = s.look || 0;
  rig.rot('neck', 0, 1, 0, look * 0.4);
  rig.rot('head', 0, 1, 0, look * 0.6);
  rig.rot('head', 1, 0, 0, (s.menu ? 0.22 : 0.04) - run * 0.15 - (s.hit || 0) * 0.3 + (s.nod || 0));
  rig.rot('jaw', 1, 0, 0, s.jaw || 0);

  // legs
  for (const [side, sg, off] of [['L', 1, 0], ['R', -1, Math.PI]]) {
    const stride = 0.42 * loco + 0.32 * run;
    let a = stride * Math.sin(ph + off);
    let k = 0.08 + (0.75 * loco + 0.7 * run) * Math.max(0, Math.cos(ph + off)) + (s.crouch || 0);
    let spread = 0.05 + (s.menu ? 0.06 : 0);
    if (fly) { a = lerp(a, -0.12 + 0.05 * Math.sin(t * 2 + off), fly); k = lerp(k, 0.35 + 0.1 * Math.sin(t * 2 + off), fly); spread = lerp(spread, 0.02, fly); }
    a += (s.crouch || 0) * 0.5;
    rig.aim('thigh_' + side, sg * spread, -Math.cos(a), Math.sin(a));
    rig.aim('shin_' + side, sg * spread * 0.5, -Math.cos(a - k), Math.sin(a - k));
    rig.aim('foot_' + side, 0, lerp(-0.4, -0.8, fly), 1);
  }

  // arms
  for (const [side, sg, off] of [['L', 1, Math.PI], ['R', -1, 0]]) {
    const swing = (0.35 * loco + 0.55 * run) * Math.sin(ph + off);
    let out = s.menu ? 0.32 : 0.22;
    let ux = sg * out, uy = -Math.cos(swing), uz = Math.sin(swing) * 0.9;
    let elbow = 0.25 + 0.25 * loco + 1.1 * run + (s.menu ? 0.25 : 0);
    let fx = sg * 0.08, fy = -Math.cos(elbow + swing * 0.5), fz = Math.sin(elbow + swing * 0.5);
    if (fly) {
      ux = lerp(ux, sg * 0.35, fly); uy = lerp(uy, -1, fly); uz = lerp(uz, -0.25, fly);
      fx = lerp(fx, sg * 0.3, fly); fy = lerp(fy, -1, fly); fz = lerp(fz, -0.1, fly);
    }
    // attacks override
    const at = s.attack;
    if (at && at.side === side && at.w > 0) {
      if (at.type === 'punch') {
        const wind = at.p < 0.35 ? at.p / 0.35 : 0, strike = at.p >= 0.35 ? Math.sin(Math.min(1, (at.p - 0.35) / 0.3) * Math.PI / 2) : 0;
        const tx = lerp(sg * 0.2, -sg * 0.05, strike), ty = lerp(-0.4, 0.05, strike), tz = lerp(-0.4, 1, strike);
        ux = lerp(ux, tx, at.w); uy = lerp(uy, ty, at.w); uz = lerp(uz, tz, at.w);
        const fby = lerp(0.3, 0.06, strike), fbz = lerp(0.2 * wind - 0.6, 1, strike);
        fx = lerp(fx, -sg * 0.1, at.w); fy = lerp(fy, fby, at.w); fz = lerp(fz, fbz, at.w);
      } else if (at.type === 'blast') {
        ux = lerp(ux, sg * 0.08, at.w); uy = lerp(uy, 0.12 + (s.aimPitch || 0), at.w); uz = lerp(uz, 1, at.w);
        fx = lerp(fx, 0, at.w); fy = lerp(fy, 0.15 + (s.aimPitch || 0), at.w); fz = lerp(fz, 1, at.w);
      }
    }
    rig.aim('upperarm_' + side, ux, uy, uz);
    rig.aim('forearm_' + side, fx, fy, fz);
    let hx = fx, hy = fy - 0.15, hz = fz;
    if (at && at.side === side && at.type === 'blast' && at.w > 0) { hy = lerp(hy, 1.4, at.w); hz = lerp(hz, 0.8, at.w); }
    rig.aim('hand_' + side, hx, hy, hz);
    let curl = s.menu ? 0.7 : 0.35 + 0.4 * run;
    if (at && at.side === side) curl = at.type === 'punch' ? lerp(curl, 1.4, at.w) : lerp(curl, -0.3, at.w);
    rig.curl(side, curl);
  }
}
