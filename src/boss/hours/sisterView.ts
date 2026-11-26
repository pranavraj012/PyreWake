// Draws the Sister of Hours from the simulation: the human frame at 2.6 m, her skirts and strips on bone chains, the pyre-hook in both hands, and the seven embers of her count turning round the hood.
import * as THREE from 'three';
import { Body, Footing, Gait, HUMAN_SPEC, type BodySpec } from '../../anim/body.ts';
import { Chains, type ChainSpec } from '../../anim/chains.ts';
import { IX, Inertial, N, sampleClip, type Pose } from '../../anim/pose.ts';
import { Rig } from '../../anim/rig.ts';
import type { Fx } from '../../render/impact.ts';
import type { BossView } from '../view.ts';
import { HOURS_CLIPS as K, SSTAND } from './clips.ts';
import { SISTER, SISTER_SCALE, SKIRT, STRIPS, STRIP_LEN, STRIP_ROWS, skirtAt, stripRoot } from './frame.ts';
import type { Sister } from './sister.ts';
import { glow } from './glow.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Her hands sit well apart on the shaft, as on a glaive; the torso is bulkier than the hero's. */
export const SISTER_SPEC: BodySpec = { ...HUMAN_SPEC, second: 0.5, torso: HUMAN_SPEC.torso!.map(([b, c, r]) => [b, c, [r[0] * 1.15, r[1], r[2] * 1.15]]) };
export interface SisterGeo { body: THREE.BufferGeometry; hook: THREE.BufferGeometry }

export class SisterView implements BossView {
  group = new THREE.Group(); form: 1 | 2 = 1; sim: Sister; rig = new Rig(SISTER); body: Body; mesh: THREE.SkinnedMesh; cleaver: THREE.Mesh; man = new THREE.Group(); light: THREE.PointLight | null = null;
  wounds = { w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }; private wi = 0; ember = { value: 0.8 }; flash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; dissolve = { value: 0 };
  pose: Pose = new Float32Array(N); private src = new Float32Array(N); private inert = new Inertial(); private last = ''; footing = new Footing(); gait = new Gait([0, 0.5]); private vel = V(); private head = { w: 0 }; private visible = true; chains: Chains; private hookQ = new THREE.Quaternion(); private chainRoot = new THREE.Matrix4();
  shake = 0; steps = 0; fxFired: string[] = []; private fl = [0, 0, 0, 0]; private fv = [0, 0, 0, 0]; private jit = 0; private fx: Fx;
  /** The count: seven embers round the hood; they go out one by one, and scatter when she loses it. */ embers: THREE.Sprite[] = []; private emberV: THREE.Vector3[] = []; private scatterT = -1; private eyeG: THREE.Sprite[] = [];
  /** 0-1: a scene holds her eyes; 1 is open. */ eyeK = 1; /** A scene can take the embers. */ emberHold: number | null = null;
  constructor(scene: THREE.Scene, g: SisterGeo, skin: THREE.Material, held: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, sim: Sister) {
    this.sim = sim; this.fx = fx; this.body = new Body(this.rig, SISTER_SPEC); this.man.scale.setScalar(SISTER_SCALE);
    this.mesh = new THREE.SkinnedMesh(g.body, skin); this.man.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4()); this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; this.group.add(this.man); scene.add(this.group);
    const A = SISTER_SPEC.armDir, gp = SISTER_SPEC.grip; this.cleaver = new THREE.Mesh(g.hook, held); this.cleaver.scale.setScalar(1 / SISTER_SCALE); this.cleaver.castShadow = true; this.cleaver.customDepthMaterial = depth.still;
    this.cleaver.position.set(-A[0] * gp[0] - A[1] * gp[1], A[1] * gp[0] - A[0] * gp[1], 0); this.cleaver.rotation.set(Math.PI / 2, Math.atan2(A[1], -A[0]), 0); this.hookQ.copy(this.cleaver.quaternion); this.rig.bones[this.rig.i('hand.R')].add(this.cleaver);
    const specs: ChainSpec[] = Array.from({ length: SKIRT.cols }, (_, i): ChainSpec => ({ bones: Array.from({ length: SKIRT.rows }, (_, j) => `skirt${i}_${j}`), anchor: 'hips', tip: V(...skirtAt(i / SKIRT.cols, 1, 0)), stiff: 0.55, group: 'skirt', wind: 0.12, drag: 2.6 }));
    for (const s of STRIPS) { const r = stripRoot(s.side, s.at); specs.push({ bones: Array.from({ length: STRIP_ROWS }, (_, j) => `strip${s.side}${s.k}_${j}`), anchor: 'foreArm.' + s.side, tip: V(r[0], r[1] - STRIP_LEN, r[2]), stiff: 0.04, group: 'strip' + s.side + s.k, wind: 0.9, drag: 1.1 }); }
    this.chains = new Chains(this.rig, specs, [{ a: 'hips', b: 'chest', r: 0.17 }, { a: 'thigh.L', b: 'shin.L', r: 0.15 }, { a: 'thigh.R', b: 'shin.R', r: 0.15 }, { a: 'shin.L', b: 'foot.L', r: 0.12 }, { a: 'shin.R', b: 'foot.R', r: 0.12 }]);
    for (let i = 0; i < 7; i++) { const e = glow(new THREE.Color(2.2, 1.1, 0.5), 0.12); scene.add(e); this.embers.push(e); this.emberV.push(V()); }
    for (let i = 0; i < 2; i++) { const e = glow(new THREE.Color(0.5, 0.45, 0.4), 0.03); scene.add(e); this.eyeG.push(e); }
  }
  /** Her size: 1 is the human frame. In the end she is a woman no bigger than you. */ sk = SISTER_SCALE;
  size(k: number) { this.sk = k; this.man.scale.setScalar(k); this.cleaver.scale.setScalar(1 / k * (k / SISTER_SCALE)); this.chains.reset(); this.footing.reset(); }
  get x() { return this.sim.hx; } get z() { return this.sim.hz; }
  show(v: boolean) { this.visible = v; this.group.visible = v; for (const e of [...this.embers, ...this.eyeG]) e.visible = v; if (this.light) this.light.visible = v; }
  settle() { this.footing.reset(); this.fl.fill(0); this.fv.fill(0); this.flash.value.w = 0; this.last = ''; this.chains.reset(); this.scatterT = -1; }
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number) {
    let best = 1e9, bi = 0; const q = V(); for (const n of ['hips', 'spine1', 'spine2', 'chest', 'neck', 'head', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'upperArm.L', 'foreArm.L', 'upperArm.R', 'foreArm.R']) { const i = this.rig.i(n); this.rig.bones[i].getWorldPosition(q); const d = q.distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    const bone = this.rig.bones[bi], l = bone.worldToLocal(p.clone()).add(this.rig.rest[bi]), n = slash.clone().cross(toward).normalize(); if (n.lengthSq() < 0.5) n.set(0, 1, 0); n.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.wounds.w.value[this.wi].set(l.x, l.y, l.z, heat); this.wounds.n.value[this.wi].copy(n); this.wi = (this.wi + 1) % 5;
  }
  flinch(from: number, power: number, at?: THREE.Vector3) {
    const rel = from - this.sim.yaw, k = Math.min(3, power), n = Math.random() < 0.5 ? -1 : 1, low = this.sim.helpless ? 0.5 : 1;
    this.fv[0] += Math.cos(rel) * 150 * k * low; this.fv[1] += (Math.sin(rel) * 140 + n * 80) * k * low; this.fv[2] += n * 180 * k * low; this.fv[3] += Math.cos(rel) * 0.6 * k * low; this.jit = 1;
    this.flash.value.set(1.0, 0.34, 0.07, 1.0 + k * 0.45); if (at) this.flashAt.value.set(at.x, at.y, at.z, 0.5 + k * 0.25);
  }
  frozen(t: number) { const j = 0.028 * this.jit; this.group.position.x += Math.sin(t * 130) * j; this.group.position.z += Math.cos(t * 117) * j; this.group.updateMatrixWorld(true); this.jit *= 0.82; }
  nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
    const p = V(), ab = b.clone().sub(a), L = ab.lengthSq() || 1; let best = 1e9;
    for (const n of ['hips', 'spine1', 'spine2', 'chest', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'head', 'foreArm.L', 'foreArm.R']) { this.rig.bones[this.rig.i(n)].getWorldPosition(p); const s = p.clone(), k = Math.max(0, Math.min(1, s.clone().sub(a).dot(ab) / L)), q = a.clone().addScaledVector(ab, k), d = q.distanceTo(s); if (d < best) { best = d; out.copy(q).lerp(s, Math.min(1, 0.5 + Math.max(0, d - 0.6))); } }
    return out;
  }
  mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3) {
    if (m === 'head') return this.rig.bones[this.rig.i('head')].localToWorld(out.set(0, 0.1, 0.06));
    if (m === 'cleaver') return this.cleaver.localToWorld(out.set(0.3, 3.0, 0));
    return this.rig.bones[this.rig.i('hand.L')].localToWorld(out.set(0, 0, 0));
  }
  hurt(out: THREE.Vector3) { this.rig.bones[this.rig.i('chest')].getWorldPosition(out); return out; }
  /** The hook's head in the world, and its butt. */ hookHead(out: THREE.Vector3) { return this.cleaver.localToWorld(out.set(0.25, 3.05, 0)); }
  hookButt(out: THREE.Vector3) { return this.cleaver.localToWorld(out.set(0, -0.9, 0)); }
  update(dt: number, px: number, pz: number, t: number) {
    const S0 = this.sim, p = this.pose, m = S0.mode, dx = px - S0.x, dz = pz - S0.z, speed = S0.speed; this.vel.set(S0.vx, 0, S0.vz); if (!this.visible) return;
    const hidden = S0.hidden; this.group.visible = !hidden;
    if (m in K) sampleClip(K[m], S0.mt, SSTAND, this.src); else this.src.set(SSTAND);
    if (m !== this.last) { this.inert.start(this.src, null, m in K ? K[m].blend ?? 0.3 : 0.4); this.last = m; }
    p.set(this.src); this.inert.apply(p, dt);
    // --- living: she breathes slowly and deeply; her head keeps you
    const br = Math.sin(t * 0.75); p[IX.sp] += br * 1.8; p[IX.hy] += br * 0.008; let hw = Math.atan2(dx, dz) - S0.yaw; hw -= Math.round(hw / 6.2832) * 6.2832; this.head.w += (Math.max(-55, Math.min(55, hw * 57.3)) - this.head.w) * Math.min(1, dt * 5); if (!(m in K) || m === 'sevenBreaths') p[IX.nw] += (this.head.w - p[IX.hw] - p[IX.sw]) * (m === 'sevenBreaths' ? 0.4 : 1);
    if ((m === 'stalk' || m === 'strafe') && speed > 0.2) { const ph = this.gait.phase * 6.283; p[IX.hy] += Math.cos(ph * 2) * 0.025; p[IX.hr] += Math.sin(ph) * 3; p[IX.sw] += Math.cos(ph) * 5; p[IX.sp] += 3; }
    for (let i = 0; i < 4; i++) { const w = i === 2 ? 15 : 18; this.fv[i] += (-w * w * this.fl[i] - 2 * w * 0.42 * this.fv[i]) * dt; this.fl[i] += this.fv[i] * dt; }
    const lim4 = (v: number, l: number) => Math.max(-l, Math.min(l, v)); p[IX.sp] += lim4(this.fl[0], 28); p[IX.sw] += lim4(this.fl[1], 28); p[IX.nr] += lim4(this.fl[2], 40); p[IX.np] -= lim4(this.fl[0] * 0.8, 26); p[IX.hp] += lim4(this.fl[0] * 0.3, 10); this.flash.value.w *= Math.exp(-dt * 11);
    const g = this.group; g.position.set(S0.x - Math.sin(S0.yaw) * lim4(this.fl[3], 0.1), S0.y, S0.z - Math.cos(S0.yaw) * lim4(this.fl[3], 0.1)); g.rotation.set(0, S0.yaw, 0);
    this.man.rotation.set(0, p[IX.tw] * 0.01745, 0); g.updateMatrixWorld(true); const rm = this.man.matrixWorld.clone(), inv = rm.clone().invert(), lim = this.body.limbs;
    // --- feet
    if ((m === 'stalk' || m === 'strafe') && speed > 0.2) {
      const rest = [V(0.105, 0.09, 0), V(-0.105, 0.09, 0)].map(v => v.applyMatrix4(rm)); if (this.gait.offs.length && (S0.burst < 0.08 || this.last !== m)) this.gait.reset(this.footing.world);
      this.gait.update(dt, this.vel, 1.05, 0.62, 0.11, rest, 16); lim.footL.copy(this.gait.pos[0]).applyMatrix4(inv); lim.footR.copy(this.gait.pos[1]).applyMatrix4(inv); this.footing.adopt(this.gait.pos[0], this.gait.pos[1]); p[IX.flp] = this.gait.pitch[0] * 0.6; p[IX.frp] = this.gait.pitch[1] * 0.6;
      this.steps += this.gait.landed.length;
    } else { this.body.footTargets(p, lim.footL, lim.footR); this.footing.stepTime = 0.28; this.footing.lift = 0.07; this.footing.slack = 0.12; this.footing.update(lim.footL, lim.footR, rm, dt, p[IX.air], 0.09 * this.sk); this.steps += this.footing.events.length; }
    lim.handL = lim.handR = null;
    const aim = this.aimFor(S0, px, pz);
    if (aim > 0.01) {
      this.body.solve(p); const r = this.rig, tg = this.aimAt.clone().applyMatrix4(inv), d = tg.clone().sub(r.pos[r.i('hand.R')]).normalize();
      const ang = (from: number, to: number, k: number) => { let e = to - from; e -= Math.round(e / 360) * 360; return from + e * k; };
      p[IX.ba] = ang(p[IX.ba], Math.atan2(d.x, d.z) / 0.01745 + (S0.mode === 'closeEyes' ? 180 : 0), aim); p[IX.be] += ((S0.mode === 'closeEyes' ? -1 : 1) * Math.asin(Math.max(-1, Math.min(1, d.y))) / 0.01745 - p[IX.be]) * aim;
    }
    this.body.solve(p); this.cleaver.quaternion.copy(this.body.gripAdj).multiply(this.hookQ);
    // --- skirts and strips: chains in her own units, so their lengths hold at her scale
    const k = this.sk; this.chainRoot.makeRotationY(S0.yaw + p[IX.tw] * 0.01745).setPosition(g.position.x / k, g.position.y / k, g.position.z / k);
    this.chains.update(this.chainRoot, dt, t, 0.35, 0.2, speed * 0.08); this.rig.apply(); g.updateMatrixWorld(true);
    this.place(dt, t);
    this.fxFired.length = 0;
    if (m in K) for (const f of K[m].fx ?? []) if (f.t > S0.prev && f.t <= S0.mt) {
      this.fxFired.push(f.kind); const tip = this.hookHead(V()); if (f.kind === 'slam') { this.shake = 0.7; tip.y = 0.08; this.fx.sparks.emit(tip, V(0, 0.8, 0), 40, 5, 2, 0.8, t); this.fx.puffs.emit(tip, 8, 2.2, 1.0, t); } else if (f.kind === 'plant') { this.shake = 0.3; const b = this.hookButt(V()); b.y = 0.05; this.fx.puffs.emit(b, 5, 1.4, 0.8, t); }
    }
    this.shake *= Math.exp(-dt * 6); for (const w of this.wounds.w.value) w.w *= Math.exp(-dt * 0.09); this.ember.value += ((S0.lit > 0 ? 3.2 : S0.committed ? 0.7 : 0.4) - this.ember.value) * Math.min(1, dt * 5);
  }
  /** The embers of her count, her eyes, the light she throws. */
  private place(dt: number, t: number) {
    const S0 = this.sim, head = this.rig.bones[this.rig.i('head')], c = head.localToWorld(V(0, 0.13, -0.01)), counting = S0.mode === 'sevenBreaths' || S0.mode === 'longCount', lit = this.emberHold ?? (counting ? S0.embers : S0.mode === 'lostCount' ? 0 : 7);
    if (S0.mode === 'lostCount' && this.scatterT < 0) { this.scatterT = 0; this.embers.forEach((e, i) => { const a = i / 7 * 6.283 + t; this.emberV[i].set(Math.sin(a) * 2.2, 1.5 + Math.random(), Math.cos(a) * 2.2); }); }
    if (S0.mode !== 'lostCount') this.scatterT = -1;
    const R = counting ? 0.62 : 0.5, spin = counting ? 0.35 : 0.55;
    this.embers.forEach((e, i) => {
      if (this.scatterT >= 0) { this.scatterT += dt / 7; const v = this.emberV[i]; v.y -= dt * 2.4; e.position.addScaledVector(v, dt); e.scale.setScalar(0.16 * Math.max(0, 1 - this.scatterT * 1.4)); e.visible = this.visible && !S0.hidden; return; }
      const a = t * spin + i / 7 * 6.283, on = i < lit, hy = 0.08 * Math.sin(t * 1.1 + i * 1.9); e.position.set(c.x + Math.sin(a) * R, c.y + hy, c.z + Math.cos(a) * R);
      const fl = 0.85 + 0.15 * Math.sin(t * 9 + i * 2.3); e.scale.setScalar((on ? 0.13 : 0.025) * fl * (counting && i === lit - 1 ? 1 + 0.4 * Math.sin(t * 7) : 1)); e.visible = this.visible && !S0.hidden;
    });
    const eyes = [V(0.031, 1.666, 0.088), V(-0.031, 1.666, 0.088)]; this.eyeG.forEach((e, i) => { const q = eyes[i].clone().sub(this.rig.rest[this.rig.i('head')]); head.localToWorld(q); e.position.copy(q); e.scale.setScalar(0.035 * this.eyeK); e.visible = this.visible && !S0.hidden && this.eyeK > 0.02; });
    if (this.light) { this.light.position.copy(c); this.light.intensity = (2 + 0.5 * (this.emberHold ?? S0.embers)) * (S0.hidden ? 0 : 1) * (0.9 + 0.1 * Math.sin(t * 8)); }
  }
  private aimAt = V(); private aimLock = new Map<object, THREE.Vector3>(); private aimSerial = -1;
  /** In the last moments of a thrust or a chop, arms and hook turn to where the blow lands. */
  private aimFor(S0: Sister, px: number, pz: number) {
    if (S0.serial !== this.aimSerial) { this.aimSerial = S0.serial; this.aimLock.clear(); }
    const mt = S0.mt;
    for (const q of S0.strikes) {
      if (q.mark !== 'cleaver' || !q.box) continue; if (mt < q.cue || mt > q.t[1] + 0.35) continue;
      if (!this.aimLock.has(q) && mt >= q.t[0] - 0.14) this.aimLock.set(q, V(px, q.down ? 0.1 : 1.1, pz));
      const lock = this.aimLock.get(q); if (lock) this.aimAt.copy(lock); else this.aimAt.set(px, q.down ? 0.1 : 1.1, pz);
      return 0.8 * sst(q.t[0] - 0.3, q.t[0] - 0.02, mt) * (1 - sst(q.t[1] + 0.05, q.t[1] + 0.4, mt));
    }
    return 0;
  }
  drive(dt: number, px: number, pz: number, t: number) { this.sim.step(dt, px, pz); this.update(dt, px, pz, t); }
}
