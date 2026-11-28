// Draws the Pall: the Sister grown to nearly five metres on her smoke, a robe pooling under her, embers moving in the soot linen, the scythe on her back
// like a sundial's gnomon, and six arms of burning linen. The arms are drawn, not simulated: each frame every move says where each arm reaches, and the
// links follow with a whip's lag, the tips last. An arm that struck the floor lies along the line it struck until it is lifted or cut.
import * as THREE from 'three';
import { Body, HUMAN_SPEC, type BodySpec } from '../../anim/body.ts';
import { Chains, type ChainSpec } from '../../anim/chains.ts';
import { IX, Inertial, N, sampleClip, type Pose } from '../../anim/pose.ts';
import { Rig } from '../../anim/rig.ts';
import { FOG } from '../../render/surface.ts';
import type { Fx } from '../../render/impact.ts';
import type { BossView } from '../../boss/view.ts';
import { HOURS_CLIPS as K, PSTAND } from './clips.ts';
import { ARMS, ARM_LEN, ARM_ROWS, PALL_BONES, PALL_HOVER, PALL_SCALE, SKIRT, armRest, robeAt } from './frame.ts';
import { GRIP, gripLift, type Sister } from './sister.ts';
import { glow } from './glow.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NOISE3 = `float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); } float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
export const PALL_SPEC: BodySpec = { ...HUMAN_SPEC, torso: HUMAN_SPEC.torso!.map(([b, c, r]) => [b, c, [r[0] * 1.05, r[1], r[2] * 1.05]]) };
export interface PallGeo { body: THREE.BufferGeometry; scythe: THREE.BufferGeometry }
const SEG = ARM_LEN / ARM_ROWS * PALL_SCALE, D2R = Math.PI / 180;
const dirW = (a: number, y = 0) => V(Math.sin(a), y, Math.cos(a));

/** One linen arm: its links in the world, and how hard they are drawn to where they want to be. */
interface Arm { p: THREE.Vector3[]; want: THREE.Vector3[]; rate: number; grow: number }

export class PallView implements BossView {
  group = new THREE.Group(); form: 1 | 2 = 2; sim: Sister; rig = new Rig(PALL_BONES); body: Body; mesh: THREE.SkinnedMesh; cleaver: THREE.Mesh; man = new THREE.Group(); light: THREE.PointLight | null = null;
  wounds = { w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }; private wi = 0; ember = { value: 0.8 }; flash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; dissolve = { value: 0 };
  shake = 0; steps = 0; fxFired: string[] = []; private visible = true; private fx: Fx; private fl = [0, 0, 0]; private fv = [0, 0, 0]; private jit = 0;
  pose: Pose = new Float32Array(N); private src = new Float32Array(N); private inert = new Inertial(); private last = ''; private chains: Chains; private chainRoot = new THREE.Matrix4(); private head = { w: 0 };
  /** The embers in the linen: how bright, how much they climb (the count), and Last Rites' burn. */ coals = { uT: FOG.uFogP, uK: { value: 1 }, uUp: { value: 0 }, uBurn: { value: 0 } };
  /** Seven embers at her face for the Long Count. */ embers: THREE.Sprite[] = []; private overlay: THREE.SkinnedMesh; private arms: Arm[];
  /** 0-1: Last Rites has burned her. */ burnt = 0; /** The camera looks this high at her. */ camH = 3.2; /** Kept for the page: her face never comes down to sword height now. */ headDown = 0; private headAt = V(); private spin = 0;
  constructor(scene: THREE.Scene, g: PallGeo, skin: THREE.Material, held: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, sim: Sister) {
    this.sim = sim; this.fx = fx; this.body = new Body(this.rig, PALL_SPEC); this.man.scale.setScalar(PALL_SCALE);
    this.mesh = new THREE.SkinnedMesh(g.body, skin); this.man.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4()); this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; this.group.add(this.man); scene.add(this.group);
    this.overlay = new THREE.SkinnedMesh(g.body, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: this.coals,
      vertexShader: `#include <common>
#include <skinning_pars_vertex>
attribute vec4 aInfo; varying vec3 vP; varying float vM, vF;
void main(){
#include <skinbase_vertex>
#include <begin_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <skinning_vertex>
 vP = position * ${PALL_SCALE.toFixed(2)}; vM = aInfo.w * 255.; vec4 mv = modelViewMatrix * vec4(transformed, 1.); vF = abs(dot(normalize(normalMatrix * objectNormal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec4 uT; uniform float uK, uUp, uBurn; varying vec3 vP; varying float vM, vF; ${NOISE3}
void main(){ if (abs(vM - 40.) > .5) discard; float t = uT.w; vec3 q = vP * vec3(2.2, 1.6, 2.2) + vec3(0., -t * .2 - uUp * t * .6, 0.);
 float a = n3(q) * .6 + n3(q * 2.3 + 7.1) * .3 + n3(q * 5.1 - t * .1) * .1, coal = smoothstep(.66, .8, a) * (.5 + .5 * n3(vP * .5 + t * .03)), core = smoothstep(.78, .88, a), fl = .75 + .25 * sin(t * 2.3 + a * 20.);
 float g = (coal * .4 + core * 2.4) * fl * (.45 + .55 * vF) + uBurn * smoothstep(.3, .7, a) * 2.;
 gl_FragColor = vec4(vec3(1., .3, .06) * g * uK * 1.4, 1.); }` }));
    this.overlay.bind(this.rig.skeleton, new THREE.Matrix4()); this.overlay.frustumCulled = false; this.overlay.renderOrder = 3; this.man.add(this.overlay);
    // the scythe stands out of her back: a gnomon
    this.cleaver = new THREE.Mesh(g.scythe, held); this.cleaver.castShadow = true; this.cleaver.customDepthMaterial = depth.still; this.cleaver.scale.setScalar(1.35 / PALL_SCALE); this.cleaver.position.set(0.04, 0.78, -0.2); this.cleaver.rotation.set(-0.32, 0.4, 0.06); this.rig.bones[this.rig.i('chest')].add(this.cleaver);
    const specs: ChainSpec[] = Array.from({ length: SKIRT.cols }, (_, i): ChainSpec => ({ bones: Array.from({ length: SKIRT.rows }, (_, j) => `skirt${i}_${j}`), anchor: 'hips', tip: V(...robeAt(i / SKIRT.cols, 1, 0)), stiff: 0.7, group: 'skirt', wind: 0.2, drag: 2.4 }));
    this.chains = new Chains(this.rig, specs, [{ a: 'hips', b: 'chest', r: 0.17 }, { a: 'thigh.L', b: 'shin.L', r: 0.16 }, { a: 'thigh.R', b: 'shin.R', r: 0.16 }]);
    this.arms = ARMS.map(() => ({ p: Array.from({ length: ARM_ROWS + 1 }, () => V()), want: Array.from({ length: ARM_ROWS + 1 }, () => V()), rate: 4, grow: 1 }));
    for (let i = 0; i < 7; i++) { const e = glow(new THREE.Color(1.6, 0.85, 0.45), 0.26); e.visible = false; scene.add(e); this.embers.push(e); }
  }
  get x() { return this.sim.hx; } get z() { return this.sim.hz; }
  show(v: boolean) { this.visible = v; this.group.visible = v; for (const e of this.embers) e.visible = false; if (this.light) this.light.visible = v; if (v) this.fresh = true; }
  private fresh = true;
  settle() { this.fl.fill(0); this.fv.fill(0); this.flash.value.w = 0; this.last = ''; this.chains.reset(); this.fresh = true; }
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number) {
    let best = 1e9, bi = 0; const q = V(); for (const n of ['hips', 'spine1', 'spine2', 'chest', 'neck', 'head', 'upperArm.L', 'foreArm.L', 'upperArm.R', 'foreArm.R']) { const i = this.rig.i(n); this.rig.bones[i].getWorldPosition(q); const d = q.distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    const bone = this.rig.bones[bi], l = bone.worldToLocal(p.clone()).add(this.rig.rest[bi]), n = slash.clone().cross(toward).normalize(); if (n.lengthSq() < 0.5) n.set(0, 1, 0); n.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.wounds.w.value[this.wi].set(l.x, l.y, l.z, heat); this.wounds.n.value[this.wi].copy(n); this.wi = (this.wi + 1) % 5;
  }
  flinch(from: number, power: number, at?: THREE.Vector3) { const k = Math.min(3, power), rel = from - this.sim.yaw; this.fv[0] += Math.cos(rel) * 90 * k; this.fv[1] += Math.sin(rel) * 90 * k; this.fv[2] += (Math.random() < 0.5 ? -1 : 1) * 60 * k; this.jit = 1; this.flash.value.set(1.0, 0.34, 0.07, 1.0 + k * 0.45); if (at) this.flashAt.value.set(at.x, at.y, at.z, 0.9 + k * 0.3); }
  frozen(t: number) { const j = 0.04 * this.jit; this.group.position.x += Math.sin(t * 130) * j; this.group.position.z += Math.cos(t * 117) * j; this.group.updateMatrixWorld(true); this.jit *= 0.82; }
  /** Where a blade passing from a to b meets her: the robe, the body, or a linen arm lying near. */
  nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
    const p = V(), ab = b.clone().sub(a), L = ab.lengthSq() || 1; let best = 1e9;
    const pts: THREE.Vector3[] = []; for (const n of ['hips', 'spine1', 'spine2', 'chest', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R']) { this.rig.bones[this.rig.i(n)].getWorldPosition(p); pts.push(p.clone()); }
    for (const s of pts) { const k = Math.max(0, Math.min(1, s.clone().sub(a).dot(ab) / L)), q = a.clone().addScaledVector(ab, k), d = q.distanceTo(s); if (d < best) { best = d; out.copy(q).lerp(s, Math.min(1, 0.4 + Math.max(0, d - 0.9))); } }
    return out;
  }
  mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3) {
    if (m === 'head') return out.copy(this.headAt);
    if (m === 'cleaver') { const a = this.arms[1].p; return out.copy(a[ARM_ROWS - 2]); }
    return this.rig.bones[this.rig.i('hand.L')].getWorldPosition(out);
  }
  hurt(out: THREE.Vector3) { return this.rig.bones[this.rig.i('chest')].getWorldPosition(out); }
  /** The tip of an arm, in the world (for the grip scene). */ armTip(k: number, out: THREE.Vector3) { return out.copy(this.arms[k].p[ARM_ROWS]); }

  update(dt: number, px: number, pz: number, t: number) {
    if (!this.visible) return; const S0 = this.sim, m = S0.mode, mt = S0.mt, p = this.pose;
    if (m in K) sampleClip(K[m], mt, PSTAND, this.src); else this.src.set(PSTAND);
    if (m !== this.last) { this.inert.start(this.src, null, m in K ? K[m].blend ?? 0.3 : 0.4); this.last = m; }
    p.set(this.src); this.inert.apply(p, dt);
    // --- living: a slow breath; her head keeps you; the shudder of a blow
    const br = Math.sin(t * 0.6); p[IX.sp] += br * 2.2; p[IX.np] -= br * 1.5; let hw = Math.atan2(px - S0.x, pz - S0.z) - S0.yaw; hw -= Math.round(hw / 6.2832) * 6.2832; this.head.w += (Math.max(-50, Math.min(50, hw * 57.3)) - this.head.w) * Math.min(1, dt * 4); p[IX.nw] += this.head.w * 0.8;
    for (let i = 0; i < 3; i++) { this.fv[i] += (-240 * this.fl[i] - 2 * 15 * 0.45 * this.fv[i]) * dt; this.fl[i] += this.fv[i] * dt; } p[IX.sp] += Math.max(-24, Math.min(24, this.fl[0])); p[IX.sw] += Math.max(-24, Math.min(24, this.fl[1])); p[IX.nr] += Math.max(-30, Math.min(30, this.fl[2])); this.flash.value.w *= Math.exp(-dt * 9);
    // --- on her smoke, a little off the floor, rising and settling
    const g = this.group, bob = 0.08 * Math.sin(t * 0.9), lift = m === 'drawSheet' ? 0 : PALL_HOVER + bob;
    g.position.set(S0.x, S0.y + lift, S0.z); g.rotation.set(0, S0.yaw, 0); this.man.scale.setScalar(PALL_SCALE); g.updateMatrixWorld(true);
    const lim = this.body.limbs; lim.handL = lim.handR = null; lim.footL.set(0.1, 0.16, 0.06); lim.footR.set(-0.1, 0.16, 0.02);
    this.body.solve(p);
    const k = PALL_SCALE; this.chainRoot.makeRotationY(S0.yaw).setPosition(g.position.x / k, g.position.y / k, g.position.z / k); this.chains.update(this.chainRoot, dt, t, 0.3, 0.2, Math.hypot(S0.vx, S0.vz) * 0.03);
    // --- the six arms
    this.reach(dt, t, px, pz);
    this.rig.apply(); g.updateMatrixWorld(true);
    for (let a = 0; a < 6; a++) { const s = this.arms[a].grow; this.rig.bones[this.rig.i(`arm${a}_0`)].scale.setScalar(Math.max(0.05, s)); }
    this.rig.bones[this.rig.i('head')].localToWorld(this.headAt.set(0, 0.1, 0.06));
    // --- the scythe: gone while it stands planted as Noon's stake
    this.cleaver.visible = !(m === 'noon' && mt > 1.3) && !S0.stake && this.dissolve.value < 0.45;
    // --- the embers in her linen
    const count = m === 'longCount'; this.coals.uK.value += ((S0.helpless ? 0.55 : 1) * (S0.attacking ? 1.3 : 1) - this.coals.uK.value) * Math.min(1, dt * 3); this.coals.uUp.value += ((count ? 1 : 0) - this.coals.uUp.value) * Math.min(1, dt * 2); this.coals.uBurn.value = this.burnt;
    this.dissolve.value = Math.max(this.dissolve.value * (m === 'die' ? 1 : 0), this.burnt * 0.6, m === 'die' ? E(1.5, 5.8, mt) : 0);
    const lit = count ? S0.embers : 0; this.spin += dt * (count ? 0.6 : 1); this.embers.forEach((e, i) => { const a = this.spin + i / 7 * 6.283; e.position.set(this.headAt.x + Math.sin(a) * 0.9, this.headAt.y + 0.15 + 0.1 * Math.sin(t + i), this.headAt.z + Math.cos(a) * 0.9); e.visible = this.visible && count && S0.mt > 0.3; e.scale.setScalar((i < lit ? 0.26 : 0.05) * (0.85 + 0.15 * Math.sin(t * 9 + i))); });
    if (this.light) { this.light.position.set(S0.x, 2.6, S0.z); this.light.intensity = 16 * this.coals.uK.value * (0.85 + 0.15 * Math.sin(t * 3)); }
    this.ember.value = 0.8 + this.burnt * 3;
    this.fxFired.length = 0; this.shake *= Math.exp(-dt * 6); for (const w of this.wounds.w.value) w.w *= Math.exp(-dt * 0.09);
  }

  /** Where each arm wants to be this frame, then the links drawn after it and laid on the rig. */
  private reach(dt: number, t: number, px: number, pz: number) {
    const S0 = this.sim, m = S0.mode, mt = S0.mt, F = S0.yaw, base = V(S0.x, 0, S0.z), r = this.rig, inv = this.man.matrixWorld.clone().invert(), tmp = V(), q = new THREE.Quaternion();
    const roots = ARMS.map((A, k) => this.man.localToWorld(r.pos[r.i(`arm${k}_0`)].clone()));
    for (let k = 0; k < 6; k++) {
      const arm = this.arms[k], R = roots[k], side = ARMS[k].root[0] > 0 ? 1 : -1, row = k % 3; let tip: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, rate = 3.2, wave = 0.35;
      // at rest: out and back, lying on the floor behind her in long curls
      const restA = F + Math.PI - side * (0.55 + 0.42 * row) + 0.12 * Math.sin(t * 0.4 + k);
      tip = base.clone().add(dirW(restA).multiplyScalar(4.6 + row * 0.9)); tip.y = 0.06; c1 = R.clone().add(dirW(F + side * 1.4 + Math.PI * 0.2 * side).multiplyScalar(1.2)).add(V(0, 0.6, 0)); c2 = base.clone().add(dirW(restA).multiplyScalar(2.6)).add(V(0, 0.4, 0));
      const lay = S0.laid.find(l => l.arm === k);
      if (lay) { const d = dirW(lay.yaw); tip = V(lay.x, 0.06, lay.z).addScaledVector(d, lay.len); c1 = V(lay.x, 0.4, lay.z).addScaledVector(d, 2.2); c2 = V(lay.x, 0.08, lay.z).addScaledVector(d, lay.len * 0.6); rate = 14; wave = 0.05; }
      else if (m === 'wardStands' && k !== 5) {
        const o = [-0.8, 0.4, -0.4, 0.4, 0.8][k], up = E(0.3, 0.9, mt) * (1 - E(1.1, 1.25, mt)), d = dirW(F + o);
        if (mt < 1.15) { tip = R.clone().add(V(0, 5 * up + 1, 0)).addScaledVector(dirW(F + Math.PI + o * 0.6), 1.6 * up); c1 = R.clone().add(V(0, 2.4 * up, 0)).addScaledVector(dirW(F + side), 1.2); c2 = tip.clone().add(V(0, -1, 0)); rate = 6; }
        else { tip = base.clone().addScaledVector(d, 11); tip.y = 0.06; c1 = base.clone().addScaledVector(d, 2.5).add(V(0, 2.2, 0)); c2 = base.clone().addScaledVector(d, 7).add(V(0, 0.2, 0)); rate = 22; wave = 0.04; }
      } else if (m === 'gather' && k === 1) {
        if (mt < 0.9) { const u = E(0.2, 0.8, mt); tip = R.clone().add(V(0, 3.6 * u + 0.6, 0)).addScaledVector(dirW(F + Math.PI - 0.5), 2.4 * u); c1 = R.clone().add(V(0, 1.6, 0)); c2 = tip.clone().add(V(0, -1, 0)); rate = 7; }
        else { const d = dirW(F); tip = base.clone().addScaledVector(d, 11.5); tip.y = 1.0; c1 = R.clone().addScaledVector(d, 2); c2 = base.clone().addScaledVector(d, 7).add(V(0, 1.0, 0)); rate = 30; wave = 0.02; }
      } else if (m === 'grip') {
        // the Weight of Hours: three arms wound round him at her face; then all six carry him up, and bring him down
        const h = V(px, gripLift(mt) + 0.9, pz), a = t * (1.6 + k) + k * 2.1;
        if (mt < GRIP.throw) { if (k <= 2) { tip = h.clone().add(V(Math.sin(a) * 0.45, 0.3 * k - 0.3, Math.cos(a) * 0.45)); c1 = R.clone().add(V(0, 1.2, 0)).addScaledVector(dirW(F), 1.2); c2 = h.clone().add(V(0, 1.4, 0)); rate = 9; wave = 0.08; } }
        else if (mt < GRIP.impact + 0.05) { tip = h.clone().add(V(Math.sin(a) * 0.5, -0.2 + 0.2 * row, Math.cos(a) * 0.5)); c1 = R.clone().add(V(0, 2.5, 0)).addScaledVector(dirW(F + (k - 2.5) * 0.3), 1.5); c2 = h.clone().add(V(0, -1.2, 0)).addScaledVector(dirW(F + Math.PI), 1.2); rate = 30; wave = 0.05; }
        else { const b = F + (k - 2.5) * 0.38, d = dirW(b); tip = V(px, 0.06, pz).addScaledVector(d, 1.4); c1 = R.clone().addScaledVector(dirW(F), 1.5).add(V(0, 0.8, 0)); c2 = V(px, 0.3, pz).addScaledVector(d, -0.5); rate = 16; wave = 0.04; }
      } else if (m === 'hemLash') {
        const wrap = E(0.2, 0.7, mt) * (1 - E(0.75, 0.95, mt)), out = E(0.75, 1.0, mt) * (1 - E(1.3, 1.8, mt)), a = F + k * Math.PI / 3 + 6.283 * E(0.75, 1.3, mt);
        if (out > 0.01) { tip = base.clone().addScaledVector(dirW(a), 1.4 + 3.6 * out); tip.y = 0.7; c1 = R.clone().addScaledVector(dirW(a - 0.5), 1.2); c2 = base.clone().addScaledVector(dirW(a - 0.25), 3).add(V(0, 0.9, 0)); rate = 24; wave = 0.05; }
        else if (wrap > 0.01) { tip = base.clone().addScaledVector(dirW(F + k * 1.05), 1.6); tip.y = 1.4 + row * 0.6; c1 = R.clone().addScaledVector(dirW(F + side), 1.0); c2 = tip.clone().add(V(0, 0.8, 0)); rate = 6; }
      } else if (m === 'hourHand') {
        const u = E(1.0, 3.6, mt) * 1, a = F - 100 * D2R + 200 * D2R * Math.max(0, Math.min(1, (mt - 1.0) / 2.6));
        if (k === 0 || k === 3) { const d = dirW(a + (k === 3 ? 0.06 : 0)); tip = base.clone().addScaledVector(d, 10); tip.y = 0.08; c1 = R.clone().addScaledVector(d, 2); c2 = base.clone().addScaledVector(d, 6).add(V(0, 0.15, 0)); rate = 12; wave = 0.05; void u; }
        else { const a2 = F + (k - 2.5) * 0.7; tip = R.clone().add(V(0, 4.2, 0)).addScaledVector(dirW(a2), 2.2); c1 = R.clone().add(V(0, 1.5, 0)); c2 = tip.clone().add(V(0, -0.5, 0)); rate = 4; }
      } else if (m === 'drawSheet') {
        const a = F + k * Math.PI / 3 + 0.3, air = E(0.6, 0.95, mt) * (1 - E(1.62, 1.75, mt)), land = E(1.65, 1.8, mt) * (1 - E(3.4, 4.0, mt));
        if (air > 0.01) { tip = base.clone().addScaledVector(dirW(a), 3.6); tip.y = S0.y + 1.5 * air; c1 = R.clone().addScaledVector(dirW(a), 1.4).add(V(0, 1, 0)); c2 = base.clone().addScaledVector(dirW(a), 2.8).add(V(0, S0.y + 1.8, 0)); rate = 10; }
        else if (land > 0.01) { tip = base.clone().addScaledVector(dirW(a), 4.6); tip.y = 0.06; c1 = R.clone().addScaledVector(dirW(a), 1.2); c2 = base.clone().addScaledVector(dirW(a), 3).add(V(0, 0.1, 0)); rate = 18; wave = 0.05; }
      } else if (m === 'noon' && k === 4) {
        const at = S0.stake ? V(S0.stake.x, 0.1, S0.stake.z) : V(px, 0.1, pz); if (mt < 1.4) { tip = R.clone().add(V(0, 4 * E(0.3, 1.0, mt) + 0.8, 0)); c1 = R.clone().add(V(0, 1, 0)); c2 = tip.clone(); rate = 6; } else { tip = at; c1 = R.clone().add(V(0, 2.5, 0)); c2 = at.clone().add(V(0, 2.6, 0)); rate = 16; }
      } else if (m === 'lastBreath') {
        const a = F + Math.PI + (k - 2.5) * 0.32; tip = base.clone().addScaledVector(dirW(a), 6.2); tip.y = 2.2 + row * 0.8; c1 = R.clone().addScaledVector(dirW(a), 1.5).add(V(0, 0.8, 0)); c2 = base.clone().addScaledVector(dirW(a), 4).add(V(0, 2.4, 0)); rate = 5; wave = 0.6;
      } else if (m === 'longCount') {
        const a = F + k * Math.PI / 3, rise = E(0.3, 1.6, mt) * (1 - E(6.0, 6.4, mt)); if (rise > 0.01) { tip = base.clone().addScaledVector(dirW(a + 1.2), 0.7).add(V(0, 5.6 + row * 0.5, 0)); c1 = R.clone().addScaledVector(dirW(a), 1.8).add(V(0, 0.5, 0)); c2 = base.clone().addScaledVector(dirW(a + 0.6), 1.8).add(V(0, 5.2, 0)); rate = 2.5 * rise + 1; wave = 0.2; }
      } else if (m === 'sag' || m === 'die' || m === 'reel2' || m === 'pierced') {
        const a = F + Math.PI * 0.5 * side + (row - 1) * 0.5; tip = base.clone().addScaledVector(dirW(a), 3.2); tip.y = 0.06; c1 = R.clone().addScaledVector(dirW(a), 0.8); c2 = base.clone().addScaledVector(dirW(a), 1.8).add(V(0, 0.1, 0)); rate = 3; wave = 0.06;
      }
      // a cut arm burns back to the shoulder and grows again
      const sv = S0.severed[k]; arm.grow += ((sv >= 0 ? (sv < 3.5 ? 0.06 : E(3.5, 6, sv)) : 1) - arm.grow) * Math.min(1, dt * (sv >= 0 && sv < 0.3 ? 20 : 2));
      this.curve(arm, R, c1, c2, tip, t, k, wave);
      // drawn after: the root at once, the tip last
      if (this.fresh) for (let j = 0; j <= ARM_ROWS; j++) arm.p[j].copy(arm.want[j]);
      for (let j = 1; j <= ARM_ROWS; j++) arm.p[j].lerp(arm.want[j], 1 - Math.exp(-dt * rate * (1.6 - 0.9 * j / ARM_ROWS)));
      arm.p[0].copy(R); for (let j = 1; j <= ARM_ROWS; j++) { tmp.copy(arm.p[j]).sub(arm.p[j - 1]); const l = tmp.length() || 1; arm.p[j].copy(arm.p[j - 1]).addScaledVector(tmp, SEG / l); if (arm.p[j].y < 0.04) arm.p[j].y = 0.04; }
      // onto the rig: each link turned to point at the next
      for (let j = 0; j < ARM_ROWS; j++) {
        const i = r.i(`arm${k}_${j}`), rest = j < ARM_ROWS - 1 ? V(...armRest(k, j + 1)).sub(V(...armRest(k, j))).normalize() : V(...ARMS[k].dir).normalize();
        const a = arm.p[j].clone().applyMatrix4(inv), b = arm.p[j + 1].clone().applyMatrix4(inv), d = b.sub(a).normalize(); q.setFromUnitVectors(rest, d); r.setRot(i, q);
      }
    }
    r.fk(); this.fresh = false; void GRIP;
  }
  /** The arm's wanted links: along a curve from its root through two controls to the tip, with a travelling wave, a fixed length apart. */
  private curve(arm: Arm, R: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, tip: THREE.Vector3, t: number, k: number, wave: number) {
    const pts: THREE.Vector3[] = [], n = 48; for (let i = 0; i <= n; i++) { const u = i / n, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3; pts.push(V(R.x * a + c1.x * b + c2.x * c + tip.x * d, R.y * a + c1.y * b + c2.y * c + tip.y * d, R.z * a + c1.z * b + c2.z * c + tip.z * d)); }
    let j = 1, acc = 0; arm.want[0].copy(R);
    for (let i = 1; i <= n && j <= ARM_ROWS; i++) { const l = pts[i].distanceTo(pts[i - 1]); acc += l; while (acc >= SEG && j <= ARM_ROWS) { acc -= SEG; arm.want[j].copy(pts[i]).lerp(pts[i - 1], acc / l); j++; } }
    for (; j <= ARM_ROWS; j++) arm.want[j].copy(arm.want[j - 1]).add(tip.clone().sub(arm.want[j - 1]).normalize().multiplyScalar(SEG));
    for (let j2 = 1; j2 <= ARM_ROWS; j2++) { const s = wave * (j2 / ARM_ROWS); arm.want[j2].x += Math.sin(t * 2.1 + j2 * 0.9 + k * 1.7) * s; arm.want[j2].y += Math.sin(t * 1.7 + j2 * 1.1 + k) * s * 0.6; arm.want[j2].z += Math.cos(t * 1.9 + j2 * 0.8 + k * 2.3) * s; }
  }
  drive(dt: number, px: number, pz: number, t: number) { this.sim.step(dt, px, pz); this.update(dt, px, pz, t); }
}
