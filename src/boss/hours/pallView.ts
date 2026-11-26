// Draws the Pall: a dome of soot-black linen on smoke, embers moving behind the cloth, her small face at the top, and the hook rising out of her back like a sundial's gnomon.
// Stiff above, alive only at the hem: the hem's chains flare, lift and trail; the whole of her flattens when she lands, and her face comes down to sword height.
import * as THREE from 'three';
import { Rig } from '../../anim/rig.ts';
import { FOG } from '../../render/surface.ts';
import type { Fx } from '../../render/impact.ts';
import type { BossView } from '../view.ts';
import { PALL, PALL_BONES } from './frame.ts';
import type { Sister } from './sister.ts';
import { glow } from './sisterView.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NOISE3 = `float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); } float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
export interface PallGeo { body: THREE.BufferGeometry; hook: THREE.BufferGeometry; frame: THREE.BufferGeometry }

export class PallView implements BossView {
  group = new THREE.Group(); form: 1 | 2 = 2; sim: Sister; rig = new Rig(PALL_BONES); mesh: THREE.SkinnedMesh; cleaver: THREE.Mesh; man = new THREE.Group(); light: THREE.PointLight | null = null;
  wounds = { w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }; private wi = 0; ember = { value: 0.8 }; flash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; dissolve = { value: 0 };
  shake = 0; steps = 0; fxFired: string[] = []; private visible = true; private fx: Fx; private fl = [0, 0]; private fv = [0, 0]; private jit = 0; private flat = 0; private lean = V(); private flare = 0; private spin = 0;
  /** The embers behind the cloth: how bright, and how much they gather at her face (the count). */ coals = { uT: FOG.uFogP, uK: { value: 1 }, uUp: { value: 0 }, uBurn: { value: 0 } };
  /** Seven embers at her face for the Long Count. */ embers: THREE.Sprite[] = []; frame: THREE.SkinnedMesh; private overlay: THREE.SkinnedMesh;
  /** A scene can hold how far down she has come (0 standing, 1 flat). */ hold: number | null = null; /** 0-1: Last Rites has burned her cloth away. */ burnt = 0;
  constructor(scene: THREE.Scene, g: PallGeo, skin: THREE.Material, held: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, sim: Sister) {
    this.sim = sim; this.fx = fx;
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
 vP = position; vM = aInfo.w * 255.; vec4 mv = modelViewMatrix * vec4(transformed, 1.); vF = abs(dot(normalize(normalMatrix * objectNormal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec4 uT; uniform float uK, uUp, uBurn; varying vec3 vP; varying float vM, vF; ${NOISE3}
void main(){ if (abs(vM - 40.) > .5) discard; float t = uT.w; vec3 q = vP * vec3(1.5, 1.1, 1.5) + vec3(0., -t * .12 - uUp * t * .5, 0.);
 float a = n3(q) * .6 + n3(q * 2.3 + 7.1) * .3 + n3(q * 5.1 - t * .1) * .1, coal = smoothstep(.68, .8, a) * (.5 + .5 * n3(vP * .35 + t * .03)), core = smoothstep(.79, .88, a), fl = .75 + .25 * sin(t * 2.3 + a * 20.);
 float lowk = mix(1., smoothstep(0., 4.5, vP.y) * 1.4, uUp), g = (coal * .35 + core * 2.2) * fl * lowk * (.45 + .55 * vF) + uBurn * smoothstep(.3, .7, a) * 2.;
 gl_FragColor = vec4(vec3(1., .3, .06) * g * uK * 1.4, 1.); }` }));
    this.overlay.bind(this.rig.skeleton, new THREE.Matrix4()); this.overlay.frustumCulled = false; this.overlay.renderOrder = 3; this.man.add(this.overlay);
    this.frame = new THREE.SkinnedMesh(g.frame, held); this.frame.bind(this.rig.skeleton, new THREE.Matrix4()); this.frame.frustumCulled = false; this.frame.visible = false; this.man.add(this.frame);
    // the hook stands out of her back: a gnomon
    this.cleaver = new THREE.Mesh(g.hook, held); this.cleaver.castShadow = true; this.cleaver.customDepthMaterial = depth.still; this.cleaver.position.set(0.15, 3.6, -2.4); this.cleaver.rotation.set(-0.62, 0.0, 0.08); this.rig.bones[0].add(this.cleaver);
    for (let i = 0; i < 7; i++) { const e = glow(new THREE.Color(1.6, 0.85, 0.45), 0.26); e.visible = false; scene.add(e); this.embers.push(e); }
  }
  get x() { return this.sim.hx; } get z() { return this.sim.hz; }
  show(v: boolean) { this.visible = v; this.group.visible = v; for (const e of this.embers) e.visible = false; if (this.light) this.light.visible = v; }
  settle() { this.fl.fill(0); this.fv.fill(0); this.flash.value.w = 0; this.flat = 0; this.flare = 0; }
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number) {
    const bone = this.rig.bones[0], l = bone.worldToLocal(p.clone()), n = slash.clone().cross(toward).normalize(); if (n.lengthSq() < 0.5) n.set(0, 1, 0);
    this.wounds.w.value[this.wi].set(l.x, l.y, l.z, heat); this.wounds.n.value[this.wi].copy(n); this.wi = (this.wi + 1) % 5;
  }
  flinch(from: number, power: number, at?: THREE.Vector3) { const k = Math.min(3, power); this.fv[0] += Math.cos(from - this.sim.yaw) * 0.6 * k; this.fv[1] += Math.sin(from - this.sim.yaw) * 0.6 * k; this.jit = 1; this.flash.value.set(1.0, 0.34, 0.07, 1.0 + k * 0.45); if (at) this.flashAt.value.set(at.x, at.y, at.z, 0.9 + k * 0.3); }
  frozen(t: number) { const j = 0.03 * this.jit; this.group.position.x += Math.sin(t * 130) * j; this.group.position.z += Math.cos(t * 117) * j; this.group.updateMatrixWorld(true); this.jit *= 0.82; }
  /** Where along the blade's path the cloth is: the hem all round is her body. */
  nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
    const k = this.sim, mid = a.clone().lerp(b, 0.7), d = V(mid.x - k.x, 0, mid.z - k.z), L = d.length() || 1, R = this.surfR(Math.max(0.3, Math.min(2.5, mid.y)));
    if (this.headDown > 0.6 && mid.distanceTo(this.headAt) < 1.4) return out.copy(this.headAt);
    return out.set(k.x + d.x / L * R, Math.max(0.4, Math.min(2.2, mid.y)), k.z + d.z / L * R);
  }
  /** The dome's radius at a height, with her squash. */
  private surfR(y: number) { const sy = this.man.scale.y, v = Math.acos(Math.max(0, Math.min(1, Math.pow(Math.max(0, (y / sy - 0.02) / PALL.H), 1 / 1.05)))) / (Math.PI / 2); return (PALL.neck + (PALL.R - PALL.neck) * Math.pow(Math.sin(v * Math.PI / 2), 0.85)) * this.man.scale.x * 0.97; }
  private headAt = V(); /** 0-1: how far her face has come down toward sword height. */ headDown = 0;
  mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3) {
    if (m === 'head') return out.copy(this.headAt);
    if (m === 'cleaver') return this.cleaver.visible ? this.cleaver.localToWorld(out.set(0.25, 3.05, 0)) : out.set(this.sim.x, 0.5, this.sim.z);
    return out.set(this.sim.x, 1.2, this.sim.z);
  }
  hurt(out: THREE.Vector3) { return out.set(this.sim.x, 2.0 * this.man.scale.y, this.sim.z); }
  update(dt: number, px: number, pz: number, t: number) {
    if (!this.visible) return; const S0 = this.sim, m = S0.mode, mt = S0.mt;
    // --- how flat she is: landed after Drawing the Sheet, after Noon, while she has lost count, and dying
    let flat = 0; if (m === 'drawSheet') flat = E(1.65, 1.8, mt) * (1 - E(3.4, 4.1, mt)); else if (m === 'sag') flat = E(0, 0.4, mt) * (1 - E(2.5, 3.0, mt)); else if (m === 'noon') flat = 0.45 * E(1.4, 1.6, mt) * (1 - E(1.9, 2.4, mt)); else if (m === 'die') flat = E(0.5, 5.5, mt); else if (m === 'rise') flat = 1 - E(0.3, 2.6, mt); else if (m === 'reel2') flat = 0.25 * Math.sin(Math.min(1, mt / 1.2) * Math.PI);
    if (this.hold !== null) flat = this.hold;
    this.flat += (flat - this.flat) * Math.min(1, dt * (flat > this.flat ? 14 : 4)); const f = this.flat, sy = 1 - 0.7 * f, sx = 1 + 0.28 * f + (m === 'die' ? 0.2 * f : 0);
    // --- the hem: a slow breath of the cloth; open as a canopy over you; lifted to loose the cots; flared all round for the lash
    let flare = 0.04 * Math.sin(t * 0.8); if (m === 'drawSheet') flare = 1.25 * E(0.6, 1.0, mt) * (1 - E(1.55, 1.75, mt)); else if (m === 'wardStands') flare = 0.7 * E(0.5, 1.15, mt) * (1 - E(1.5, 2.2, mt)); else if (m === 'hemLash') flare = 1.1 * E(0.75, 1.02, mt) * (1 - E(1.2, 1.7, mt)) - 0.15 * E(0.3, 0.7, mt) * (1 - E(0.75, 0.9, mt)); else if (m === 'noon') flare = 0.25 * E(0.4, 0.8, mt) * (1 - E(1.4, 1.8, mt));
    this.flare += (flare - this.flare) * Math.min(1, dt * 12);
    // --- gliding: the hem trails behind the way she goes
    const vx = S0.vx, vz = S0.vz; this.lean.x += (vx * 0.06 - this.lean.x) * Math.min(1, dt * 3); this.lean.z += (vz * 0.06 - this.lean.z) * Math.min(1, dt * 3);
    for (let i = 0; i < 2; i++) { this.fv[i] += (-80 * this.fl[i] - 6 * this.fv[i]) * dt; this.fl[i] += this.fv[i] * dt; } this.flash.value.w *= Math.exp(-dt * 9);
    // --- placement: on her smoke, a little off the ground, breathing
    const g = this.group, bob = 0.06 * Math.sin(t * 0.9); g.position.set(S0.x, S0.y + bob * (1 - f) + 0.02, S0.z); g.rotation.set(0, S0.yaw, 0); this.man.scale.set(sx, sy, sx); this.man.rotation.set(this.fl[0] * 0.05, 0, -this.fl[1] * 0.05);
    const r = this.rig; for (const l of r.local) l.identity(); r.rootPos.set(0, 0, 0);
    const inv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -S0.yaw, 0)), lean = this.lean.clone().applyQuaternion(inv);
    for (let i = 0; i < PALL.cols; i++) {
      const a = i / PALL.cols * Math.PI * 2, out = V(Math.sin(a), 0, Math.cos(a)), axis = V(Math.cos(a), 0, -Math.sin(a)), trail = -(out.x * lean.x + out.z * lean.z), w = 0.05 * Math.sin(t * 1.3 + i * 0.9) + 0.03 * Math.sin(t * 2.7 + i * 2.3);
      const k0 = (this.flare * 0.55 + w + trail * 0.6), k1 = (this.flare * 0.75 + w * 1.4 + trail * 0.5 + (m === 'hourHand' ? 0.05 * Math.sin(t * 6 + i) : 0));
      r.local[r.i(`hem${i}_0`)].setFromAxisAngle(axis, -k0); r.local[r.i(`hem${i}_1`)].setFromAxisAngle(axis, -k1);
    }
    // the head: it bows when she sags or loses count, lifts as she breathes in
    let nod = 0.05 * Math.sin(t * 0.5); if (m === 'sag' || m === 'die') nod = 0.6 * E(0, 0.6, mt); if (m === 'longCount') nod = -0.15 * E(0.3, 0.8, mt) * (1 - E(5.9, 6.3, mt)); if (m === 'lastBreath') nod = -0.25 * E(0.3, 0.9, mt) * (1 - E(2.3, 2.9, mt));
    r.local[r.i('head')].setFromEuler(new THREE.Euler(nod, 0.25 * Math.sin(t * 0.21), 0));
    r.fk(); r.apply();
    // her face keeps its size however flat she is
    const hb = r.bones[r.i('head')]; hb.scale.set(1 / sx, 1 / sy, 1 / sx); g.updateMatrixWorld(true);
    hb.localToWorld(this.headAt.set(0, 0.2, 0.15)); this.headDown = E(3.4, 1.8, this.headAt.y);
    // --- the hook: gone while it stands planted as Noon's stake
    this.cleaver.visible = !(m === 'noon' && mt > 0.75) && !S0.stake;
    // --- the coals behind the cloth
    const count = m === 'longCount'; this.coals.uK.value += ((S0.helpless ? 0.55 : 1) * (S0.attacking ? 1.25 : 1) - this.coals.uK.value) * Math.min(1, dt * 3); this.coals.uUp.value += ((count ? 1 : 0) - this.coals.uUp.value) * Math.min(1, dt * 2); this.coals.uBurn.value = this.burnt;
    this.frame.visible = this.burnt > 0.05; this.dissolve.value = Math.max(this.dissolve.value * (S0.mode === 'die' ? 1 : 0), this.burnt * 0.97);
    const lit = count ? S0.embers : 0; this.spin += dt * (count ? 0.6 : 1); this.embers.forEach((e, i) => { const a = this.spin + i / 7 * 6.283; e.position.set(this.headAt.x + Math.sin(a) * 0.75, this.headAt.y + 0.1 + 0.08 * Math.sin(t + i), this.headAt.z + Math.cos(a) * 0.75); e.visible = this.visible && count && S0.mt > 0.3; e.scale.setScalar((i < lit ? 0.26 : 0.05) * (0.85 + 0.15 * Math.sin(t * 9 + i))); });
    if (this.light) { this.light.position.set(S0.x, 2.2 * sy, S0.z); this.light.intensity = 18 * this.coals.uK.value * (0.85 + 0.15 * Math.sin(t * 3)); }
    this.ember.value = 0.8 + this.burnt * 3;
    this.fxFired.length = 0; this.shake *= Math.exp(-dt * 6); for (const w of this.wounds.w.value) w.w *= Math.exp(-dt * 0.09); void px; void pz;
  }
  drive(dt: number, px: number, pz: number, t: number) { this.sim.step(dt, px, pz); this.update(dt, px, pz, t); }
}
