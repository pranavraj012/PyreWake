// Turns a pose vector into bone rotations, and keeps feet planted.
import * as THREE from 'three';
import { IX, type Pose } from './pose.ts';
import { Rig } from './rig.ts';

const D = Math.PI / 180, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), FWD = V(0, 0, 1), BACK = V(0, 0, -1), UP = V(0, 1, 0);
export const dirOf = (az: number, el: number, out = V()) => out.set(Math.sin(az * D) * Math.cos(el * D), Math.sin(el * D), Math.cos(az * D) * Math.cos(el * D));

export interface BodySpec { armDir: [number, number, number]; grip: [number, number]; ankle: number; feet: [number, number]; heel: number; spine: number }
export const HUMAN_SPEC: BodySpec = { armDir: [0.643, -0.766, 0], grip: [0.085, 0.027], ankle: 0.09, feet: [0.105, -0.025], heel: 0.17, spine: 1 };
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
    const shR = r.pos[r.i('upperArm.R')], tR = shR.clone().addScaledVector(dirOf(g('ra'), g('re')), Math.min(1, g('rl')) * this.armLen);
    if (this.limbs.handR) tR.lerp(this.limbs.handR, this.limbs.handW);
    const fR = arm('R', tR, g('xr'));
    dirOf(g('ba'), g('be'), this.blade);
    const kn = fR.clone().addScaledVector(this.blade, -fR.dot(this.blade)); if (kn.lengthSq() < 0.01) kn.set(0, -1, 0); kn.normalize().applyAxisAngle(this.blade, g('bo') * D);
    const dR = V(-A[0], A[1], A[2]), dL = V(A[0], A[1], A[2]);
    const handed = (S: 'L' | 'R', q: THREE.Quaternion) => r.setRot(r.i('hand.' + S), q);
    if (!(this.limbs.handR && this.limbs.handW > 0.5)) handed('R', Rig.frame(FWD, dR, this.blade, kn, new THREE.Quaternion()));
    const gq = r.rot[r.i('hand.R')], off = (s: number) => V((A[0] * this.spec.grip[0] + A[1] * this.spec.grip[1]) * s, A[1] * this.spec.grip[0] - A[0] * this.spec.grip[1], A[2] * this.spec.grip[0]);
    this.gripPos.copy(off(-1)).applyQuaternion(gq).add(r.pos[r.i('hand.R')]);
    // free hand, or second hand on the hilt
    const shL = r.pos[r.i('upperArm.L')], tL = shL.clone().addScaledVector(dirOf(g('la'), g('le')), Math.min(1, g('ll')) * this.armLen), lg = Math.max(0, Math.min(1, g('lg')));
    let qL: THREE.Quaternion | null = null;
    if (lg > 0.01) { qL = Rig.frame(FWD, dL, this.blade, kn, new THREE.Quaternion()); tL.lerp(this.gripPos.clone().addScaledVector(this.blade, -0.12).sub(off(1).applyQuaternion(qL)), lg); }
    if (this.limbs.handL) tL.lerp(this.limbs.handL, this.limbs.handW);
    arm('L', tL, g('xl'));
    if (qL) { const k2 = r.i('hand.L'); handed('L', r.rot[k2].clone().slerp(qL, lg)); }
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
