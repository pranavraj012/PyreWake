// Turns a pose vector into bone rotations, and keeps feet planted.
import * as THREE from 'three';
import { IX, type Pose } from './pose.ts';
import { Rig } from './rig.ts';

const D = Math.PI / 180, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), FWD = V(0, 0, 1), BACK = V(0, 0, -1), UP = V(0, 1, 0);
export const dirOf = (az: number, el: number, out = V()) => out.set(Math.sin(az * D) * Math.cos(el * D), Math.sin(el * D), Math.cos(az * D) * Math.cos(el * D));

/** A solid the hands may not enter: bone, centre and radii in that bone's frame (rest pose). */
export type Solid = [string, [number, number, number], [number, number, number]];
export interface BodySpec { armDir: [number, number, number]; grip: [number, number]; ankle: number; feet: [number, number]; heel: number; spine: number; /** The torso, for keeping hands out of it. */ torso?: Solid[]; /** Wrist deviation limits in degrees, [toward the little finger, toward the thumb]: the rest of the angle turns the weapon in the fist. */ wrist?: [number, number] }
export const HUMAN_SPEC: BodySpec = { armDir: [0.643, -0.766, 0], grip: [0.085, 0.027], ankle: 0.09, feet: [0.105, -0.025], heel: 0.17, spine: 1, wrist: [30, 22], torso: [['chest', [0, 1.31, 0.0], [0.2, 0.21, 0.16]], ['spine2', [0, 1.17, 0.0], [0.17, 0.14, 0.14]], ['spine1', [0, 1.05, 0.01], [0.17, 0.12, 0.14]], ['hips', [0, 0.95, 0.0], [0.19, 0.13, 0.15]]] };
export const KING_SPEC: BodySpec = { armDir: [0.42, -0.9, 0.11], grip: [0.2, 0.03], ankle: 0.14, feet: [0.25, -0.06], heel: 0.3, spine: 1 };

export interface Limbs { footL: THREE.Vector3; footR: THREE.Vector3; handL: THREE.Vector3 | null; handR: THREE.Vector3 | null; handW: number; headAim: number; kneeOut: number }

export class Body {
  rig: Rig; spec: BodySpec; armLen: number;
  limbs: Limbs = { footL: V(), footR: V(), handL: null, handR: null, handW: 0, headAim: 0, kneeOut: 0 };
  blade = V(0, 0, 1); gripPos = V();
  private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion();
  constructor(rig: Rig, spec: BodySpec) {
    this.rig = rig; this.spec = spec;
    const p = (n: string) => rig.rest[rig.i(n)]; this.armLen = p('upperArm.L').distanceTo(p('foreArm.L')) + p('foreArm.L').distanceTo(p('hand.L'));
  }
  /** Wanted foot positions in character space, straight from the pose. */
  footTargets(p: Pose, L: THREE.Vector3, R: THREE.Vector3) {
    const s = this.spec, f = (o: THREE.Vector3, x: number, y: number, z: number, side: number, pitch: number) => o.set(s.feet[0] * side + p[x], s.ankle + p[y] + Math.max(0, Math.sin(p[pitch] * D)) * s.heel, s.feet[1] + p[z]);
    f(L, IX.flx, IX.fly, IX.flz, 1, IX.flp); f(R, IX.frx, IX.fry, IX.frz, -1, IX.frp);
  }
  /** Push a hand target out of the torso: the hand is a ball of about six centimetres. */
  /** The weapon's turn in the sword hand this frame, in the hand's own frame (identity when the wrist takes it all). */
  gripAdj = new THREE.Quaternion();
  /** Hand frame for a hand holding something along `want`, with the forearm along `fA`: the wrist bends only so far. */
  private wristFrame(fA: THREE.Vector3, want: THREE.Vector3, side0: THREE.Vector3, roll: number, lim: [number, number]) {
    const n = fA.clone().cross(want); if (n.lengthSq() < 1e-8) n.set(1, 0, 0).cross(fA); n.normalize();
    const dev = Math.acos(Math.max(-1, Math.min(1, fA.dot(want)))) / D - 90, wd = Math.max(-lim[0], Math.min(lim[1], dev));
    const a0 = fA.clone().applyAxisAngle(n, wd * D), f = fA.clone().applyAxisAngle(n, (wd + 90) * D), a = a0.clone();
    // a roll about the blade would really come from the forearm turning; only as much as keeps the wrist within reach is taken here
    if (roll) for (const k of [1, 0.75, 0.5, 0.3, 0.15, 0]) { a.copy(a0).applyAxisAngle(f, roll * k * D); if (Math.acos(Math.max(-1, Math.min(1, a.dot(fA)))) / D <= Math.max(lim[0], lim[1]) + 6) break; }
    return { q: Rig.frame(FWD, side0, f, a, new THREE.Quaternion()), phi: (dev - wd) * D, n };
  }
  outside(t: THREE.Vector3) {
    const r = this.rig, T = this.spec.torso; if (!T) return t; const q = new THREE.Quaternion(), l = V();
    for (let pass = 0; pass < 2; pass++) for (const [bone, c, rad] of T) {
      const b = r.i(bone), rest = r.rest[b]; q.copy(r.rot[b]).invert(); l.copy(t).sub(r.pos[b]).applyQuaternion(q).sub(V(c[0] - rest.x, c[1] - rest.y, c[2] - rest.z));
      const sx = rad[0] + 0.06, sy = rad[1] + 0.06, sz = rad[2] + 0.06, k = Math.hypot(l.x / sx, l.y / sy, l.z / sz); if (k >= 1 || k < 1e-4) continue;
      l.divideScalar(k).add(V(c[0] - rest.x, c[1] - rest.y, c[2] - rest.z)).applyQuaternion(r.rot[b]).add(r.pos[b]); t.copy(l);
    }
    return t;
  }
  solve(p: Pose) {
    const r = this.rig, g = (c: keyof typeof IX) => p[IX[c]];
    for (const l of r.local) l.identity();
    r.rootPos.copy(r.rest[0]); r.rootPos.x += g('hx'); r.rootPos.y += g('hy'); r.rootPos.z += g('hz');
    r.euler('hips', g('hp') * D, g('hw') * D, g('hr') * D);
    const sp = g('sp') * D / 3, sw = g('sw') * D / 3, sr = g('sr') * D / 3;
    for (const n of ['spine1', 'spine2', 'chest']) r.euler(n, sp, sw, sr);
    const neck2 = r.byName.neck2 !== undefined, k = neck2 ? 1 / 3 : 0.5;
    for (const n of neck2 ? ['neck', 'neck2', 'head'] : ['neck', 'head']) r.euler(n, g('np') * D * k, g('nw') * D * k, g('nr') * D * k);
    // shoulders rise and reach with the hands
    const shrug = (el: number) => Math.max(0, Math.min(1, (el + 5) / 85)) * 0.42, reach = (az: number) => Math.max(-0.35, Math.min(0.45, az * D * 0.28));
    r.euler('clav.R', 0, reach(g('ra')), -shrug(Math.min(g('re'), 150 - g('re')))); r.euler('clav.L', 0, reach(g('la')), shrug(Math.min(g('le'), 150 - g('le'))));
    r.fk();
    // legs
    for (const [S, s, foot, yaw, pitch] of [['L', 1, this.limbs.footL, g('flw'), g('flp')], ['R', -1, this.limbs.footR, g('frw'), g('frp')]] as const) {
      const hipYaw = g('hw') * D * 0.5, y = yaw * D * 0.65 + hipYaw * 0.5;
      r.ik('thigh.' + S, 'shin.' + S, 'foot.' + S, foot, V(Math.sin(y) + (0.12 + this.limbs.kneeOut) * s, 0.15, Math.cos(y)), FWD);
      this.q.setFromAxisAngle(UP, yaw * D); this.q2.setFromAxisAngle(V(1, 0, 0), pitch * D); r.setRot(r.i('foot.' + S), this.q.multiply(this.q2));
      const toe = r.i('toe.' + S); if (pitch > 0) r.local[toe].setFromAxisAngle(V(1, 0, 0), -pitch * D * 0.75);
    }
    // weapon arm
    const A = this.spec.armDir, arm = (S: 'L' | 'R', t: THREE.Vector3, swivel: number) => {
      const s = S === 'L' ? 1 : -1, sh = r.pos[r.i('upperArm.' + S)], to = t.clone().sub(sh).normalize();
      const pole = V(0.62 * s, -0.75, -0.4); pole.addScaledVector(to, -pole.dot(to)).normalize().applyAxisAngle(to, swivel * D * s);
      r.ik('upperArm.' + S, 'foreArm.' + S, 'hand.' + S, t, pole, BACK);
      return r.pos[r.i('hand.' + S)].clone().sub(r.pos[r.i('foreArm.' + S)]).normalize();
    };
    const shR = r.pos[r.i('upperArm.R')], tR = this.outside(shR.clone().addScaledVector(dirOf(g('ra'), g('re')), Math.min(1, g('rl')) * this.armLen));
    if (this.limbs.handR) tR.lerp(this.limbs.handR, this.limbs.handW);
    const dR = V(-A[0], A[1], A[2]), dL = V(A[0], A[1], A[2]), lg = Math.max(0, Math.min(1, g('lg')));
    const handed = (S: 'L' | 'R', q: THREE.Quaternion) => r.setRot(r.i('hand.' + S), q);
    const off = (s: number) => V((A[0] * this.spec.grip[0] + A[1] * this.spec.grip[1]) * s, A[1] * this.spec.grip[0] - A[0] * this.spec.grip[1], A[2] * this.spec.grip[0]);
    const shL = r.pos[r.i('upperArm.L')], tL0 = shL.clone().addScaledVector(dirOf(g('la'), g('le')), Math.min(1, g('ll')) * this.armLen), tL = V(), kn = V();
    let qL: THREE.Quaternion | null = null;
    // the sword hand, then where the second hand would close on the hilt; if that is inside the body, the whole grip moves out together
    const grip = () => {
      const fR = arm('R', tR, g('xr'));
      dirOf(g('ba'), g('be'), this.blade);
      kn.copy(fR).addScaledVector(this.blade, -fR.dot(this.blade)); if (kn.lengthSq() < 0.01) kn.set(0, -1, 0); kn.normalize().applyAxisAngle(this.blade, g('bo') * D);
      this.gripAdj.identity();
      if (!(this.limbs.handR && this.limbs.handW > 0.5)) {
        const W = this.spec.wrist;
        if (W) { const w = this.wristFrame(fR, this.blade, dR, g('bo'), W); handed('R', w.q); this.gripAdj.setFromAxisAngle(w.n.clone().applyQuaternion(w.q.clone().invert()), w.phi); }
        else handed('R', Rig.frame(FWD, dR, this.blade, kn, new THREE.Quaternion()));
      }
      this.gripPos.copy(off(-1)).applyQuaternion(r.rot[r.i('hand.R')]).add(r.pos[r.i('hand.R')]);
      tL.copy(tL0); qL = null;
      if (lg > 0.01) { qL = Rig.frame(FWD, dL, this.blade, kn, new THREE.Quaternion()); tL.lerp(this.gripPos.clone().addScaledVector(this.blade, -0.12).sub(off(1).applyQuaternion(qL)), lg); }
      if (this.limbs.handL) tL.lerp(this.limbs.handL, this.limbs.handW);
    };
    grip();
    if (lg > 0.01) { const d = this.outside(tL.clone()).sub(tL); if (d.lengthSq() > 1e-8) { tR.addScaledVector(d, lg); this.outside(tR); grip(); } }
    this.outside(tL);
    const fL = arm('L', tL, g('xl'));
    if (qL && this.spec.wrist) qL = this.wristFrame(fL, this.blade, dL, g('bo'), this.spec.wrist).q;
    if (qL) { const k2 = r.i('hand.L'); handed('L', r.rot[k2].clone().slerp(qL, lg)); }
    // a forearm turns along its length: half the hand's twist about the forearm goes into the forearm, so the wrist does not wring like a cloth
    if (this.spec.wrist) for (const S of ['R', 'L']) {
      const fa = r.i('foreArm.' + S), hd = r.i('hand.' + S), ax = r.rest[hd].clone().sub(r.rest[fa]).normalize(), handW = r.rot[hd].clone();
      const rel = r.rot[fa].clone().invert().multiply(handW), p = V(rel.x, rel.y, rel.z), proj = ax.clone().multiplyScalar(p.dot(ax)), tw = new THREE.Quaternion(proj.x, proj.y, proj.z, rel.w); if (tw.lengthSq() < 1e-10) continue; tw.normalize();
      const half = new THREE.Quaternion().slerp(tw, 0.62); r.setRot(fa, r.rot[fa].clone().multiply(half)); r.setRot(hd, handW);
    }
    r.fk();
  }
}

/** Keeps grounded feet locked in the world; when the pose asks for a new spot, takes a real step. */
export class Footing {
  private w = [V(), V()]; private from = [V(), V()]; private t = [1, 1]; private init = false;
  stepTime = 0.17; lift = 0.07; slack = 0.13;
  events: number[] = [];
  /** Targets in and out are character space; `root` maps character -> world. */
  update(L: THREE.Vector3, R: THREE.Vector3, root: THREE.Matrix4, dt: number, free: number, ankle: number) {
    const inv = root.clone().invert(), want = [L, R].map(v => v.clone().applyMatrix4(root));
    this.events.length = 0;
    if (!this.init) { this.w[0].copy(want[0]); this.w[1].copy(want[1]); this.init = true; }
    const err = [0, 1].map(i => Math.hypot(want[i].x - this.w[i].x, want[i].z - this.w[i].z));
    const first = err[0] > err[1] ? 0 : 1;
    for (const i of [first, 1 - first]) {
      const raised = want[i].y > ankle + 0.05;
      if (free > 0.5 || raised) { this.w[i].lerp(want[i], raised ? 1 : 0.6); this.t[i] = 1; this.from[i].copy(this.w[i]); continue; }
      if (this.t[i] < 1) {
        this.t[i] = Math.min(1, this.t[i] + dt / this.stepTime); const s = this.t[i], e = s * s * (3 - 2 * s);
        this.w[i].lerpVectors(this.from[i], want[i], e); this.w[i].y = want[i].y + Math.sin(s * Math.PI) * this.lift * Math.min(1, this.from[i].distanceTo(want[i]) * 3);
        if (this.t[i] >= 1) this.events.push(i);
      } else if (err[i] > this.slack && (this.t[1 - i] >= 1 || this.t[1 - i] > 0.55 || err[i] > 0.5)) { this.t[i] = 0; this.from[i].copy(this.w[i]); }
      else this.w[i].y += (want[i].y - this.w[i].y) * 0.35;
    }
    L.copy(this.w[0]).applyMatrix4(inv); R.copy(this.w[1]).applyMatrix4(inv);
  }
  reset() { this.init = false; this.t = [1, 1]; }
  /** Adopt externally driven feet (locomotion) so the hand-over is seamless. */
  adopt(wL: THREE.Vector3, wR: THREE.Vector3) { this.w[0].copy(wL); this.w[1].copy(wR); this.t[0] = this.t[1] = 1; this.init = true; }
  get world() { return this.w; }
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** World-locked gait for any number of limbs. Phase offsets decide walk, run or crawl. */
export class Gait {
  phase = 0; plant: THREE.Vector3[]; lift: THREE.Vector3[]; pos: THREE.Vector3[]; stance: boolean[]; pitch: number[]; swing: number[]; landed: number[] = [];
  offs: number[];
  constructor(offs: number[]) { this.offs = offs; const m = () => offs.map(() => V()); this.plant = m(); this.lift = m(); this.pos = m(); this.stance = offs.map(() => true); this.pitch = offs.map(() => 0); this.swing = offs.map(() => 0); }
  reset(at: THREE.Vector3[]) { at.forEach((a, i) => { this.plant[i].copy(a); this.lift[i].copy(a); this.pos[i].copy(a); }); }
  /** rest: limb home in world space; vel: world velocity. */
  update(dt: number, vel: THREE.Vector3, stride: number, duty: number, height: number, rest: THREE.Vector3[], kick = 0, toe = 38, strike = 16) {
    const sp = Math.hypot(vel.x, vel.z), cyc = sp / Math.max(stride, 0.05); this.phase = (this.phase + dt * cyc) % 1; this.landed.length = 0;
    const T = 1 / Math.max(cyc, 0.2);
    this.offs.forEach((o, i) => {
      const ph = (this.phase + o) % 1, st = ph < duty;
      if (st) {
        if (!this.stance[i]) { this.plant[i].copy(this.pos[i]); this.plant[i].y = rest[i].y; this.landed.push(i); }
        // give up the plant if turning has stretched the limb too far
        const dx = rest[i].x - this.plant[i].x, dz = rest[i].z - this.plant[i].z, d = Math.hypot(dx, dz), mx = stride * duty * 0.62 + 0.14; if (d > mx) { this.plant[i].x += dx * (1 - mx / d); this.plant[i].z += dz * (1 - mx / d); }
        this.pos[i].copy(this.plant[i]); const k = ph / duty; this.pitch[i] = k > 0.55 ? toe * smooth((k - 0.55) / 0.45) : k < 0.18 ? -strike * (1 - smooth(k / 0.18)) : 0; this.swing[i] = 0;
      } else {
        if (this.stance[i]) this.lift[i].copy(this.pos[i]);
        const s = (ph - duty) / (1 - duty), e = s * s * (3 - 2 * s), left = (1 - s) * (1 - duty) * T + duty * T * 0.5;
        const tx = rest[i].x + vel.x * left, tz = rest[i].z + vel.z * left;
        this.pos[i].set(this.lift[i].x + (tx - this.lift[i].x) * e, rest[i].y + Math.sin(Math.pow(s, 0.8) * Math.PI) * height, this.lift[i].z + (tz - this.lift[i].z) * e);
        this.pitch[i] = s < 0.36 ? toe + (kick - toe) * smooth(s / 0.36) : kick + (-strike - kick) * smooth((s - 0.36) / 0.64); this.swing[i] = Math.sin(s * Math.PI);
      }
      this.stance[i] = st;
    });
  }
}
