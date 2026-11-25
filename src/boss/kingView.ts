// Draws the Hanged King from its simulation: gait, pose blending, flinches, hair, the hang rig.
import * as THREE from 'three';
import { Body, Footing, Gait, KING_SPEC } from '../anim/body.ts';
import { Chains, type ChainSpec } from '../anim/chains.ts';
import { IX, Inertial, N, sampleClip, type Pose } from '../anim/pose.ts';
import { Rig } from '../anim/rig.ts';
import { BENEATH, KING } from '../anim/skeletons.ts';
import type { Fx } from '../render/fx.ts';
import { CRAWL, HANG, KING_CLIPS as K, STAND } from './clips.ts';
import { King, ROPE } from './king.ts';
import { STAND2 } from './moves2.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };


export class KingView {
  group = new THREE.Group(); form: 1 | 2; rig: Rig; body: Body; wounds = { w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }; private wi = 0; ember = { value: 0.8 }; shadow: THREE.Object3D | null = null; private echo: THREE.Quaternion[][] = []; private ei = 0; private visible = true; footing = new Footing(); gait2 = new Gait([0, 0.5]); gait4 = new Gait([0, 0.5, 0.52, 0.02]); chains: Chains; mesh: THREE.SkinnedMesh; cleaver: THREE.Mesh; rope: THREE.Mesh;
  sim: King; pose: Pose = new Float32Array(N); private src = new Float32Array(N); private inert = new Inertial(); private last = ''; private gaitMode = ''; private crawlK = 0; hangK = 0; private head = { w: 0, p: 0, r: 0, tr: 0, next: 0 }; private vel = V(); private handW = [V(), V()]; private rootM = new THREE.Matrix4(); shake = 0; private pend = V(); private wasMode = ''; private hangAt = V();
  private fx: Fx; flash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  /** Additive hit reaction: spine pitch, spine yaw, head roll, hips back. */ private fl = [0, 0, 0, 0]; private fv = [0, 0, 0, 0]; private jit = 0;

  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, cleaver: THREE.BufferGeometry, rootGeo: THREE.BufferGeometry, mat: THREE.Material, held: THREE.Material, bark: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, sim = new King(), form: 1 | 2 = 1) {
    this.form = form; this.rig = new Rig(form === 2 ? BENEATH : KING); this.body = new Body(this.rig, KING_SPEC); if (form === 2) this.group.scale.setScalar(0.86);
    this.fx = fx; this.sim = sim;
    this.mesh = new THREE.SkinnedMesh(geo, mat); this.group.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4()); this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; scene.add(this.group);
    this.cleaver = new THREE.Mesh(cleaver, held); this.cleaver.castShadow = true; this.cleaver.customDepthMaterial = depth.still;
    const A = KING_SPEC.armDir, g = KING_SPEC.grip; this.cleaver.position.set(-A[0] * g[0] - A[1] * g[1], A[1] * g[0] - A[0] * g[1], A[2] * g[0]); this.cleaver.rotation.set(Math.PI / 2, Math.atan2(0.9, 0.42), 0); this.rig.bones[this.rig.i('hand.R')].add(this.cleaver);
    const shine = new THREE.MeshBasicMaterial({ color: form === 2 ? new THREE.Color(3.2, 0.9, 0.2) : new THREE.Color(1.5, 1.75, 2.0), fog: false }), h = KING.find(b => b.name === 'head')!.pos;
    for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 10, 8), shine); e.position.set(0.072 * s - h[0], 3.545 - h[1], 0.345 - h[2]); this.rig.bones[this.rig.i('head')].add(e); }
    this.rope = new THREE.Mesh(rootGeo, bark); this.rope.castShadow = false; this.rope.visible = false; scene.add(this.rope);
    const hair: ChainSpec[] = [['hFL', 0.15, 2.72, 0.24], ['hFR', -0.15, 2.72, 0.24], ['hBL', 0.14, 2.7, -0.3], ['hBR', -0.14, 2.7, -0.3]].map(([n, x, y, z]) => ({ bones: [1, 2, 3].map(i => `${n}${i}`), anchor: 'head', tip: V(x as number, y as number, z as number), stiff: 0, group: n as string, wind: 0.4, drag: 5 }));
    this.chains = new Chains(this.rig, hair, [{ a: 'neck', b: 'head', r: 0.15 }, { a: 'chest', b: 'neck', r: 0.2 }]);
  }
  show(v: boolean) { this.visible = v; this.group.visible = v; if (!v) this.rope.visible = false; }
  /** A burning cut where the blade went through, in the body's own space so it moves with it. */
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number) {
    let best = 1e9, bi = 0; const q = V(); for (const n of ['hips', 'spine1', 'spine2', 'chest', 'neck2', 'head', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'upperArm.L', 'foreArm.L', 'upperArm.R', 'foreArm.R']) { const i = this.rig.i(n); this.rig.bones[i].getWorldPosition(q); const d = q.distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    const bone = this.rig.bones[bi], l = bone.worldToLocal(p.clone()).add(this.rig.rest[bi]), n = slash.clone().cross(toward).normalize(); if (n.lengthSq() < 0.5) n.set(0, 1, 0); n.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.wounds.w.value[this.wi].set(l.x, l.y, l.z, heat); this.wounds.n.value[this.wi].copy(n); this.wi = (this.wi + 1) % 5;
  }
  get x() { return this.sim.hx; } get z() { return this.sim.hz; }
  /** A blow landed. `from` is the attacker's world yaw, power about 1-3. */
  flinch(from: number, power: number, at?: THREE.Vector3) {
    const rel = from - this.sim.yaw, k = Math.min(3, power), n = Math.random() < 0.5 ? -1 : 1, kneel = this.sim.mode === 'kneel' || this.sim.mode === 'fall' || this.sim.mode === 'crash' ? 0.5 : 1;
    this.fv[0] += Math.cos(rel) * 260 * k * kneel; this.fv[1] += (Math.sin(rel) * 240 + n * 130) * k * kneel; this.fv[2] += n * 320 * k; this.fv[3] += Math.cos(rel) * 1.1 * k * kneel; this.jit = 1;
    this.flash.value.set(1.0, 0.34, 0.07, 1.1 + k * 0.5); if (at) this.flashAt.value.set(at.x, at.y, at.z, 0.45 + k * 0.22);
  }
  /** Shiver in place while the world is frozen on impact. */
  frozen(t: number) { const j = 0.028 * this.jit; this.group.position.x += Math.sin(t * 130) * j; this.group.position.z += Math.cos(t * 117) * j; this.group.updateMatrixWorld(true); this.jit *= 0.82; }
  steps = 0; dissolve = { value: 0 };
  /** Clip effects that fired this step, for sound. */ fxFired: string[] = [];
  /** After a teleport. */
  settle() { this.footing.reset(); this.chains.reset(); this.fl.fill(0); this.fv.fill(0); this.flash.value.w = 0; }
  drive(dt: number, px: number, pz: number, t: number) { this.sim.step(dt, px, pz); this.update(dt, px, pz, t); }
  /** Closest joint to a blade segment: where a hit should bleed. */
  nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
    const p = V(), ab = b.clone().sub(a), L = ab.lengthSq() || 1; let best = 1e9;
    for (const n of ['hips', 'spine1', 'spine2', 'chest', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'head', 'foreArm.L', 'hand.L']) { this.rig.bones[this.rig.i(n)].getWorldPosition(p); const k = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / L)), q = a.clone().addScaledVector(ab, k), d = q.distanceTo(p); if (d < best) { best = d; out.copy(q).lerp(p, Math.min(1, 0.55 + Math.max(0, d - 0.5))); } }
    return out;
  }
  mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3) { return m === 'head' ? this.rig.bones[this.rig.i('head')].localToWorld(out.set(0, 0.1, 0.1)) : m === 'cleaver' ? (this.cleaver.visible ? this.cleaver.localToWorld(out.set(0, 1.1, 0)) : this.rig.bones[this.rig.i('hand.R')].localToWorld(out.set(0, -0.3, 0))) : this.rig.bones[this.rig.i('hand.L')].localToWorld(out.set(0, -0.2, 0)); }
  /** Where the body can be struck right now (world). */
  hurt(out: THREE.Vector3) { this.rig.bones[this.rig.i(this.sim.hanging ? 'head' : 'chest')].getWorldPosition(out); return out; }

  update(dt: number, px: number, pz: number, t: number) {
    const S0 = this.sim, p = this.pose, m = S0.mode, dx = px - S0.x, dz = pz - S0.z, speed = S0.speed; this.vel.set(S0.vx, 0, S0.vz);
    // --- source pose
    const hanging = S0.hanging, still = this.form === 2 ? STAND2 : STAND, base = m === 'crawl' ? CRAWL : hanging ? HANG : still; if (!this.visible) return;
    if (m in K) sampleClip(K[m], S0.mt, hanging ? HANG : m === 'pounce' || m === 'rake' ? CRAWL : still, this.src); else this.src.set(base);
    if (m !== this.last) { this.inert.start(this.src, null, m in K ? K[m].blend ?? 0.3 : hanging || this.last.startsWith('hang') ? 0.5 : this.form === 2 ? 0.28 : 0.45); this.last = m; }
    p.set(this.src); this.inert.apply(p, dt);
    // --- living details: shallow breath, snapping head, tremor
    const br = Math.sin(t * 1.1); p[IX.sp] += br * 1.8; p[IX.hy] += br * 0.012;
    if (t > this.head.next) { this.head.tr = (Math.random() - 0.5) * (Math.random() < 0.35 ? 62 : 16); this.head.next = t + 0.5 + Math.random() * 2.2; }
    this.head.r += (this.head.tr - this.head.r) * (1 - Math.exp(-dt * 30)); if (!hanging && this.form === 1) p[IX.nr] += this.head.r;
    // head never leaves the player
    let hw = Math.atan2(dx, dz) - S0.yaw; hw -= Math.round(hw / 6.2832) * 6.2832; this.head.w += (Math.max(-70, Math.min(70, hw * 57.3)) - this.head.w) * Math.min(1, dt * 7); if (!(m in K) && !hanging) p[IX.nw] += this.head.w - p[IX.hw] - p[IX.sw];
    if (m === 'stalk' || m === 'strafe') { const ph = this.gait2.phase * 6.283; p[IX.hy] += Math.cos(ph * 2) * 0.05 - 0.1 * S0.burst; p[IX.hr] += Math.sin(ph) * 7; p[IX.sw] += Math.cos(ph) * 12; p[IX.sp] += 10 * S0.burst; p[IX.la] += -Math.cos(ph) * 24; p[IX.ra] += Math.cos(ph) * 10; }
    if (m === 'crawl') { const ph = this.gait4.phase * 6.283; p[IX.hr] += Math.sin(ph) * 8; p[IX.sr] += -Math.sin(ph) * 13; p[IX.hw] += Math.cos(ph) * 9; p[IX.sw] += -Math.cos(ph) * 11; p[IX.hy] += Math.cos(ph * 2) * 0.05; }
    if (hanging) { p[IX.la] += Math.sin(t * 0.9) * 14; p[IX.ra] += Math.sin(t * 0.8 + 1) * 12; p[IX.le] += Math.sin(t * 1.3) * 6; p[IX.nr] += Math.sin(t * 0.7) * 10; p[IX.sw] += Math.sin(t * 0.55) * 12; }

    // --- flinch springs
    for (let i = 0; i < 4; i++) { const w = i === 2 ? 15 : 18; this.fv[i] += (-w * w * this.fl[i] - 2 * w * 0.42 * this.fv[i]) * dt; this.fl[i] += this.fv[i] * dt; }
    const lim4 = (v: number, l: number) => Math.max(-l, Math.min(l, v)); p[IX.sp] += lim4(this.fl[0], 34); p[IX.sw] += lim4(this.fl[1], 34); p[IX.nr] += lim4(this.fl[2], 60); p[IX.np] -= lim4(this.fl[0] * 0.8, 36); p[IX.hz] -= 0; p[IX.hp] += lim4(this.fl[0] * 0.3, 12);
    this.flash.value.w *= Math.exp(-dt * 11);
    // --- placement
        const hk = hanging ? sst(0, 0.9, S0.ht) : 0; if (hanging) this.hangK = hk; else this.hangK += (hk - this.hangK) * Math.min(1, dt * 9);
    const g = this.group; this.rope.visible = this.hangK > 0.02;
    if (this.hangK > 0.002) {
      const dir = S0.dir, th = S0.th, tw = Math.sin(S0.ht * 0.5) * 0.35;
      const q = new THREE.Quaternion().setFromAxisAngle(V(Math.cos(dir), 0, -Math.sin(dir)), -th), pivot = V(S0.x, ROPE, S0.z), flip = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI * this.hangK), yq = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), S0.yaw + (hanging ? tw : 0));
      // rest the ankles (y = .14 in body space) on the end of the rope; hips ride an arc while flipping
      const ankle = V(0, -(ROPE - 5.22), 0), up = this.hangK; const off = ankle.applyQuaternion(q).add(pivot);
      g.quaternion.copy(q).multiply(yq).multiply(flip); const local = V(0, 0.14, 0).applyQuaternion(g.quaternion); g.position.set(S0.x + (off.x - local.x - S0.x) * up, (off.y - local.y) * up, S0.z + (off.z - local.z - S0.z) * up);
      const L = pivot.distanceTo(off); this.rope.position.copy(pivot); this.rope.quaternion.copy(q); this.rope.scale.set(1.1, (L + 0.1) / 6.2, 1.1);
     
    } else { g.position.set(S0.x, S0.y, S0.z); { const y = S0.yaw; g.position.x -= Math.sin(y) * lim4(this.fl[3], 0.12); g.position.z -= Math.cos(y) * lim4(this.fl[3], 0.12); } g.rotation.set(0, S0.yaw + p[IX.tw] * 0.01745, 0); }
    g.updateMatrixWorld(true); const root = this.rootM.copy(g.matrixWorld), inv = root.clone().invert(), lim = this.body.limbs;

    // --- limbs
    this.crawlK += ((m === 'crawl' ? 1 : 0) - this.crawlK) * Math.min(1, dt * 6); lim.handW = this.crawlK; lim.kneeOut = this.crawlK * 0.9;
    if (m === 'crawl') {
      const rest = [V(0.55, 0.14, -0.75), V(-0.55, 0.14, -0.75), V(0.72, 0.1, 1.2), V(-0.72, 0.1, 1.2)].map(v => v.applyMatrix4(root));
      if (S0.mt < dt * 1.5) this.gait4.reset([...this.footing.world, rest[2], rest[3]]);
      this.gait4.update(dt, this.vel, 2.1, 0.56, 0.32, rest, 10);
      this.steps += this.gait4.landed.length; for (const i of this.gait4.landed) this.fx.puffs.emit(this.gait4.pos[i], 2, 0.7, 0.7, t);
      lim.footL.copy(this.gait4.pos[0]).applyMatrix4(inv); lim.footR.copy(this.gait4.pos[1]).applyMatrix4(inv); this.footing.adopt(this.gait4.pos[0], this.gait4.pos[1]);
      this.handW[0].copy(this.gait4.pos[2]); this.handW[1].copy(this.gait4.pos[3]); p[IX.flp] = 26; p[IX.frp] = 26;
    } else if ((m === 'stalk' || m === 'strafe') && speed > 0.2) {
      const rest = [V(0.24, 0.14, 0), V(-0.24, 0.14, 0)].map(v => v.applyMatrix4(root)); if (this.gait2.offs.length && (S0.burst < 0.08 || this.gaitMode !== m)) this.gait2.reset(this.footing.world); this.gaitMode = m;
      this.gait2.update(dt, this.vel, 3.0, 0.52, 0.3, rest, 30); lim.footL.copy(this.gait2.pos[0]).applyMatrix4(inv); lim.footR.copy(this.gait2.pos[1]).applyMatrix4(inv); this.footing.adopt(this.gait2.pos[0], this.gait2.pos[1]); p[IX.flp] = this.gait2.pitch[0]; p[IX.frp] = this.gait2.pitch[1];
      lim.footL.y += Math.max(0, Math.sin(p[IX.flp] * 0.01745)) * 0.25; lim.footR.y += Math.max(0, Math.sin(p[IX.frp] * 0.01745)) * 0.25;
      this.steps += this.gait2.landed.length; for (const i of this.gait2.landed) { this.fx.puffs.emit(this.gait2.pos[i], 4, 1, 0.9, t); this.shake = 0.1; }
    } else {
      this.gaitMode = ''; this.body.footTargets(p, lim.footL, lim.footR);
      if (this.hangK > 0.02) { this.footing.adopt(lim.footL.clone().applyMatrix4(root), lim.footR.clone().applyMatrix4(root)); }
      else { this.footing.stepTime = 0.3; this.footing.lift = 0.2; this.footing.slack = 0.3; this.footing.update(lim.footL, lim.footR, root, dt, p[IX.air], 0.14); this.steps += this.footing.events.length; for (const i of this.footing.events) { this.fx.puffs.emit(this.footing.world[i], 4, 1, 0.9, t); this.shake = 0.12; } }
    }
    lim.handL = this.crawlK > 0.01 ? this.handW[0].clone().applyMatrix4(inv) : null; lim.handR = this.crawlK > 0.01 ? this.handW[1].clone().applyMatrix4(inv) : null;
    this.body.solve(p);
    // fingers: right closes on the cleaver, left is a loose claw; both splay when crawling
    const gripK = S0.armed && this.form === 1 ? 1 : 0; this.cleaver.visible = gripK > 0;
    for (let i = 0; i < 4; i++) { const w = Math.sin(t * 2.1 + i * 1.3) * 0.08; this.rig.euler(`f${i}a.L`, -0.12 + i * 0.07, 0, -0.35 - w).euler(`f${i}b.L`, 0, 0, -0.5 + w); this.rig.euler(`f${i}a.R`, (i * 0.07 - 0.12) * (1 - gripK), 0, 0.35 + gripK).euler(`f${i}b.R`, 0, 0, 0.5 + gripK); }
    this.rig.euler('thumb.R', 0.4 * gripK, 0, 0.5 * gripK); this.rig.euler('graft1', -0.3 + Math.sin(t * 0.8) * 0.12, 0.2, 0.1).euler('graft2', -0.5 + Math.sin(t * 1.9) * 0.2, 0, 0);
    if (this.crawlK > 0.5) for (const S of ['L', 'R'] as const) { const k = this.rig.i('hand.' + S), s = S === 'L' ? 1 : -1; this.rig.setRot(k, new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15, 0.2 * s, -0.42 * s))); }
    if (this.form === 2) this.sixArms(t);
    this.rig.fk(); this.chains.update(root, dt, t, 0.5, -0.3); this.rig.apply(); g.updateMatrixWorld(true);
    this.fxFired.length = 0;
    if (m in K) for (const f of K[m].fx ?? []) if (f.t > S0.prev && f.t <= S0.mt) {
      const tip = V(0, 1.95, 0); if (this.cleaver.visible) this.cleaver.localToWorld(tip); else this.rig.bones[this.rig.i('hand.R')].getWorldPosition(tip); tip.y = Math.max(0.05, tip.y); this.fxFired.push(f.kind); if (f.kind === 'creak' || f.kind === 'roar') { /* heard, not seen */ } else if (f.kind === 'launch') { this.shake = 0.3; this.fx.puffs.emit(V(S0.x, 0, S0.z), 12, 2.2, 1.1, t); this.fx.sparks.emit(V(S0.x, 0.2, S0.z), V(0, 0.8, 0), 16, 3, 2, 0.5, t); } else if (f.kind === 'scrape') { tip.y = 0.04; this.fx.sparks.emit(tip, V(-Math.sin(S0.yaw) * 0.6, 0.7, -Math.cos(S0.yaw) * 0.6), 18, 4, 1.4, 0.6, t); } else if (f.kind === 'thud' || f.kind === 'slam0') { this.shake = 0.55; this.fx.puffs.emit(V(S0.x, 0, S0.z), 14, 2.2, 1.3, t); } else if (f.kind === 'slam') { this.shake = 0.8; tip.y = 0.05; this.fx.sparks.emit(tip, V(0, 0.8, 0), 60, 5, 2, 0.8, t); this.fx.puffs.emit(tip, 16, 2.6, 1.5, t); } else { this.fx.sparks.emit(tip, V(0, 0.4, 0), 16, 3, 2, 0.5, t); this.shake = 0.2; }
    }
    this.shake *= Math.exp(-dt * 6); for (const w of this.wounds.w.value) w.w *= Math.exp(-dt * 0.09);
    this.ember.value += ((S0.committed ? 1.5 : 0.85) + (this.form === 2 && S0.mode === 'rain' ? 0.6 : 0) - this.ember.value) * Math.min(1, dt * 4);
  }
  /** The extra pairs repeat what the main arms did a moment ago, fanned out. */
  private sixArms(t: number) {
    const r = this.rig, N8 = 14, names = ['upperArm', 'foreArm', 'hand']; const now = ['L', 'R'].flatMap(S => names.map(n => r.local[r.i(n + '.' + S)].clone())); if (!this.echo.length) this.echo = Array.from({ length: N8 }, () => now); this.ei = (this.ei + 1) % N8; this.echo[this.ei] = now;
    const e = new THREE.Euler(), q = new THREE.Quaternion();
    [['2', 5, 0.5, 0.34], ['3', 10, 0.95, 0.62]].forEach(([k, lag, up, out], j) => { const old = this.echo[(this.ei - (lag as number) + N8) % N8]; ['L', 'R'].forEach((S, si) => { const s = si === 0 ? 1 : -1; names.forEach((n, ni) => { const l = r.local[r.i(n + k + '.' + S)]; l.copy(old[si * 3 + ni]); if (ni === 0) l.premultiply(q.setFromEuler(e.set((up as number) * 0.55 + Math.sin(t * 1.7 + j * 2 + s) * 0.06, s * (out as number) * 0.5, s * (out as number) * 0.8 + Math.sin(t * 1.1 + j) * 0.05))); }); }); });
  }
}
