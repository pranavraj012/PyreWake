// Draws the Ferryman from the river simulation: net and lantern in round 1, and in round 2 without them, the lamps of the river turning round him.
import * as THREE from 'three';
import { Body, Footing, Gait, KING_SPEC } from '../../anim/body.ts';
import { IX, Inertial, N, sampleClip, type Pose } from '../../anim/pose.ts';
import { Rig } from '../../anim/rig.ts';
import { KING } from '../../anim/skeletons.ts';
import type { Fx } from '../../render/fx.ts';
import { LEVEL } from '../../render/water.ts';
import type { BossView } from '../view.ts';
import { DUEL, FSTAND, RIVER_CLIPS as K } from './clips.ts';
import { RiverFx, type FxGeo } from './riverFx.ts';
import type { River } from './river.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export interface RiverGeo extends FxGeo { boat: THREE.BufferGeometry; body: THREE.BufferGeometry; pole: THREE.BufferGeometry }
export interface RiverMats { skin: THREE.Material; held: THREE.Material; wood: THREE.Material }
/** Scale of the Ferryman's rig, which is the King's frame: broad and bent, he stands about two and a quarter metres. */
const SCALE = 0.8, POLE = 1.7, CHAIN_MODES = ['cast', 'haul', 'haulIn', 'wheelIron', 'dragDeep'];

export class RiverView implements BossView {
  group = new THREE.Group(); form: 1 | 2; sim: River; rig = new Rig(KING); body: Body; mesh: THREE.SkinnedMesh; cleaver: THREE.Mesh; man = new THREE.Group(); fxv: RiverFx; light: THREE.PointLight | null = null;
  wounds = { w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }; private wi = 0; ember = { value: 0.8 }; flash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; dissolve = { value: 0 };
  pose: Pose = new Float32Array(N); private src = new Float32Array(N); private inert = new Inertial(); private last = ''; footing = new Footing(); gait2 = new Gait([0, 0.5]); private vel = V(); private rootM = new THREE.Matrix4(); private head = { w: 0 }; private visible = true; private orbit: THREE.Sprite[] = []; private lantern: THREE.Mesh; private sections: THREE.Mesh[] = []; private hull: THREE.Mesh | null = null;
  shake = 0; steps = 0; fxFired: string[] = []; private fl = [0, 0, 0, 0]; private fv = [0, 0, 0, 0]; private jit = 0; private fx: Fx; private surf = 1; private lampK = 1; private scene: THREE.Scene; /** The ending: he is an old man in a boat, and the dead stand about. */ private old = false; private boatT = 0; private boatM: THREE.Mesh; private water: { ripple(x: number, z: number, a: number, t: number): void } | null = null; private hands = [V(), V()]; private glow: THREE.Sprite; private eyeM: THREE.Mesh[] = [];
  /** Between the eyes, in the world. */ eyeAt(out: THREE.Vector3) { const a = this.eyeM[0].getWorldPosition(V()), b = this.eyeM[1].getWorldPosition(V()); return out.copy(a).add(b).multiplyScalar(0.5); }
  /** The eyes under the hat, 0 shut to 1 burning. */ eyes(k: number) { for (const e of this.eyeM) { e.visible = k > 0.02; e.scale.set(1, Math.max(0.05, k), 1); } }
  constructor(scene: THREE.Scene, g: RiverGeo, m: RiverMats, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, sim: River, form: 1 | 2) {
    this.form = form; this.sim = sim; this.fx = fx; this.scene = scene; this.body = new Body(this.rig, KING_SPEC); this.man.scale.setScalar(SCALE);
    this.mesh = new THREE.SkinnedMesh(g.body, m.skin); this.man.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4()); this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; this.group.add(this.man); scene.add(this.group);
    const A = KING_SPEC.armDir, gp = KING_SPEC.grip; this.cleaver = new THREE.Mesh(g.pole, m.wood); this.cleaver.scale.setScalar(POLE); this.cleaver.castShadow = true; this.cleaver.customDepthMaterial = depth.still; this.cleaver.position.set(-A[0] * gp[0] - A[1] * gp[1], A[1] * gp[0] - A[0] * gp[1], A[2] * gp[0]); this.cleaver.rotation.set(Math.PI / 2, Math.atan2(0.9, 0.42), 0); this.rig.bones[this.rig.i('hand.R')].add(this.cleaver);
    this.lantern = new THREE.Mesh(g.lantern, m.held); this.lantern.scale.setScalar(1.15); this.lantern.castShadow = false; scene.add(this.lantern);
    const c = document.createElement('canvas'); c.width = c.height = 64; const cx = c.getContext('2d')!, r = cx.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,235,180,1)'); r.addColorStop(0.2, 'rgba(255,160,70,.6)'); r.addColorStop(1, 'rgba(255,90,20,0)'); cx.fillStyle = r; cx.fillRect(0, 0, 64, 64);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.glow.scale.setScalar(1.2); scene.add(this.glow);
    const ec = document.createElement('canvas'); ec.width = ec.height = 32; { const x = ec.getContext('2d')!, gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,220,255,.5)'); gr.addColorStop(1, 'rgba(120,160,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); } const eyeTex = new THREE.CanvasTexture(ec);
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.6, 4.2), fog: false }), h = KING.find(b => b.name === 'head')!.pos; for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), eye); e.position.set(0.047 * s - h[0], 3.594 - h[1], 0.29 - h[2]); this.rig.bones[this.rig.i('head')].add(e); this.eyeM.push(e); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: new THREE.Color(0.55, 0.7, 0.95), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); gl.scale.setScalar(0.13); gl.position.z = 0.03; e.add(gl); }
    this.fxv = new RiverFx(g, m.held, m.skin); scene.add(this.fxv.group); this.boatM = new THREE.Mesh(g.boat, m.wood); this.boatM.visible = false; this.boatM.castShadow = this.boatM.receiveShadow = true; this.boatM.scale.setScalar(1.05); scene.add(this.boatM);
    // round 2: the lamps of the river have come to him and turn about him
    if (form === 2) for (let k = 0; k < 7; k++) { const q = new THREE.Sprite((this.glow.material as THREE.SpriteMaterial).clone()); q.scale.setScalar(0.55); scene.add(q); this.orbit.push(q); }
  }
  standing(on: boolean) { this.fxv.crowd = on; }
  /** The boat rises with him in it: no longer the Ferryman, a man. */
  /** The body he is drawn with once the boat rises: the Ferryman again, not the coin-mail. */ oldGeo: THREE.BufferGeometry | null = null; private baseGeo: THREE.BufferGeometry | null = null; private bundle: THREE.Mesh | null = null;
  boat(on: boolean) {
    this.old = on; this.boatT = 0; this.boatM.visible = on; this.baseGeo ??= this.mesh.geometry; this.mesh.geometry = on && this.oldGeo ? this.oldGeo : this.baseGeo; this.eyes(on ? 0.35 : 1);
    this.holding(on);
    if (on) { this.visible = true; this.group.visible = true; this.man.scale.setScalar(0.52); } else this.man.scale.setScalar(SCALE);
  }
  /** The bundle in his arms: what he kept beneath the jars. The turn shows it first; the ending keeps it. */
  holding(on: boolean) {
    if (on && !this.bundle) { const g = new THREE.SphereGeometry(1, 14, 10).scale(0.13, 0.11, 0.24), n = g.attributes.position.count, a = new Uint8Array(n * 4); for (let i = 0; i < n; i++) a.set([220, 150, 0, 2], i * 4); g.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); this.bundle = new THREE.Mesh(g, this.lantern.material as THREE.Material); const ch = KING.find(b => b.name === 'chest')!.pos; this.bundle.position.set(0.05, 2.28 - ch[1], 0.38 - ch[2]); this.bundle.rotation.set(0.2, 0.5, 0); this.rig.bones[this.rig.i('chest')].add(this.bundle); }
    if (this.bundle) this.bundle.visible = on;
  }
  withWater(w: { ripple(x: number, z: number, a: number, t: number): void }) { this.water = w; return this; }
  /** Lights the lamps and the lantern's glow, 0-1. */ lampLight(k: number) { this.lampK = k; }
  show(v: boolean) { this.visible = v; this.group.visible = v; this.lantern.visible = this.glow.visible = v; this.fxv.group.visible = v; for (const s of this.orbit) s.visible = v; if (this.light) this.light.visible = v; }
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number) {
    let best = 1e9, bi = 0; const q = V(); for (const n of ['hips', 'spine1', 'spine2', 'chest', 'neck2', 'head', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'upperArm.L', 'foreArm.L', 'upperArm.R', 'foreArm.R']) { const i = this.rig.i(n); this.rig.bones[i].getWorldPosition(q); const d = q.distanceToSquared(p); if (d < best) { best = d; bi = i; } }
    const bone = this.rig.bones[bi], l = bone.worldToLocal(p.clone()).add(this.rig.rest[bi]), n = slash.clone().cross(toward).normalize(); if (n.lengthSq() < 0.5) n.set(0, 1, 0); n.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.wounds.w.value[this.wi].set(l.x, l.y, l.z, heat); this.wounds.n.value[this.wi].copy(n); this.wi = (this.wi + 1) % 5;
  }
  get x() { return this.sim.hx; } get z() { return this.sim.hz; }
  flinch(from: number, power: number, at?: THREE.Vector3) {
    const rel = from - this.sim.yaw, k = Math.min(3, power), n = Math.random() < 0.5 ? -1 : 1, low = this.sim.helpless ? 0.5 : this.form === 2 ? 0.7 : 1;
    this.fv[0] += Math.cos(rel) * 170 * k * low; this.fv[1] += (Math.sin(rel) * 160 + n * 90) * k * low; this.fv[2] += n * 200 * k * low; this.fv[3] += Math.cos(rel) * 0.7 * k * low; this.jit = 1;
    this.flash.value.set(1.0, 0.34, 0.07, 1.0 + k * 0.45); if (at) this.flashAt.value.set(at.x, at.y, at.z, 0.45 + k * 0.22);
  }
  frozen(t: number) { const j = 0.028 * this.jit; this.group.position.x += Math.sin(t * 130) * j; this.group.position.z += Math.cos(t * 117) * j; this.group.updateMatrixWorld(true); this.jit *= 0.82; }
  settle() { this.footing.reset(); this.fl.fill(0); this.fv.fill(0); this.flash.value.w = 0; this.last = ''; }
  nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
    const p = V(), ab = b.clone().sub(a), L = ab.lengthSq() || 1; let best = 1e9;
    const spots = ['hips', 'spine1', 'spine2', 'chest', 'thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'head', 'foreArm.L', 'hand.L'].map(n => { this.rig.bones[this.rig.i(n)].getWorldPosition(p); return p.clone(); });
    for (const s of spots) { const k = Math.max(0, Math.min(1, s.clone().sub(a).dot(ab) / L)), q = a.clone().addScaledVector(ab, k), d = q.distanceTo(s); if (d < best) { best = d; out.copy(q).lerp(s, Math.min(1, 0.5 + Math.max(0, d - 0.5))); } }
    return out;
  }
  mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3) {
    if (m === 'head') return this.rig.bones[this.rig.i('head')].localToWorld(out.set(0, 0.1, 0.1));
    if (m === 'cleaver') return this.cleaver.visible ? this.cleaver.localToWorld(out.set(0, 4.5, 0)) : out.copy(this.fxv.anchorAt);
    return this.rig.bones[this.rig.i('hand.L')].localToWorld(out.set(0, -0.2, 0));
  }
  hurt(out: THREE.Vector3) { this.rig.bones[this.rig.i('chest')].getWorldPosition(out); return out; }
  drive(dt: number, px: number, pz: number, t: number) { this.sim.step(dt, px, pz); this.update(dt, px, pz, t); }

  update(dt: number, px: number, pz: number, t: number) {
    const S0 = this.sim, p = this.pose, m = S0.mode, dx = px - S0.x, dz = pz - S0.z, speed = S0.speed; this.vel.set(S0.vx, 0, S0.vz); if (this.old) { this.oldMan(dt, px, pz, t); return; } if (!this.visible) return;
    const still = this.form === 2 ? DUEL : FSTAND;
    if (m in K) sampleClip(K[m], S0.mt, still, this.src); else this.src.set(still);
    if (m !== this.last) { this.inert.start(this.src, null, m in K ? K[m].blend ?? 0.3 : 0.4); this.last = m; }
    p.set(this.src); this.inert.apply(p, dt);
    // --- living details
    const br = Math.sin(t * 0.9); p[IX.sp] += br * 1.6; p[IX.hy] += br * 0.012; let hw = Math.atan2(dx, dz) - S0.yaw; hw -= Math.round(hw / 6.2832) * 6.2832; this.head.w += (Math.max(-60, Math.min(60, hw * 57.3)) - this.head.w) * Math.min(1, dt * 6); if (!(m in K)) p[IX.nw] += this.head.w - p[IX.hw] - p[IX.sw];
    if ((m === 'stalk' || m === 'strafe') && speed > 0.2) { const ph = this.gait2.phase * 6.283; p[IX.hy] += Math.cos(ph * 2) * 0.06; p[IX.hr] += Math.sin(ph) * 6; p[IX.sw] += Math.cos(ph) * 9; p[IX.sp] += 6; }
    // --- flinch springs
    for (let i = 0; i < 4; i++) { const w = i === 2 ? 15 : 18; this.fv[i] += (-w * w * this.fl[i] - 2 * w * 0.42 * this.fv[i]) * dt; this.fl[i] += this.fv[i] * dt; }
    const lim4 = (v: number, l: number) => Math.max(-l, Math.min(l, v)); p[IX.sp] += lim4(this.fl[0], 30); p[IX.sw] += lim4(this.fl[1], 30); p[IX.nr] += lim4(this.fl[2], 50); p[IX.np] -= lim4(this.fl[0] * 0.8, 30); p[IX.hp] += lim4(this.fl[0] * 0.3, 10); this.flash.value.w *= Math.exp(-dt * 11);
    // --- placement
    const g = this.group, root = g; g.position.set(S0.x, S0.y, S0.z); { const y = S0.yaw; g.position.x -= Math.sin(y) * lim4(this.fl[3], 0.1); g.position.z -= Math.cos(y) * lim4(this.fl[3], 0.1); }
    g.rotation.set(0, S0.yaw, 0);
    this.man.rotation.set(0, p[IX.tw] * 0.01745, 0); g.updateMatrixWorld(true); const rm = this.rootM.copy(this.man.matrixWorld), inv = rm.clone().invert(), lim = this.body.limbs; void root;
    // --- limbs
    if ((m === 'stalk' || m === 'strafe') && speed > 0.2) {
      const rest = [V(0.26, 0.14, 0), V(-0.26, 0.14, 0)].map(v => v.applyMatrix4(rm)); if (this.gait2.offs.length && (S0.burst < 0.08 || this.last !== m)) this.gait2.reset(this.footing.world);
      this.gait2.update(dt, this.vel, this.form === 2 ? 2.9 : 2.3, this.form === 2 ? 0.42 : 0.6, this.form === 2 ? 0.34 : 0.26, rest, 24); lim.footL.copy(this.gait2.pos[0]).applyMatrix4(inv); lim.footR.copy(this.gait2.pos[1]).applyMatrix4(inv); this.footing.adopt(this.gait2.pos[0], this.gait2.pos[1]); p[IX.flp] = this.gait2.pitch[0]; p[IX.frp] = this.gait2.pitch[1];
      this.steps += this.gait2.landed.length; for (const i of this.gait2.landed) { this.fx.puffs.emit(this.gait2.pos[i], 2, 0.7, 0.8, t); this.shake = 0.1; this.water?.ripple(this.gait2.pos[i].x, this.gait2.pos[i].z, 0.45, t); }
    } else { this.body.footTargets(p, lim.footL, lim.footR); { this.footing.stepTime = this.form === 2 ? 0.2 : 0.34; this.footing.lift = 0.2; this.footing.slack = 0.3; this.footing.update(lim.footL, lim.footR, rm, dt, p[IX.air], 0.14); this.steps += this.footing.events.length; for (const i of this.footing.events) { this.shake = 0.1; this.water?.ripple(this.footing.world[i].x, this.footing.world[i].z, 0.45, t); } } }
    lim.handL = lim.handR = null;
    // --- the pole goes for you: in the last moments of a thrust or a stab, arm and pole turn to where the blow lands
    const aim = this.aimFor(S0, px, pz);
    if (aim > 0.01) {
      this.body.solve(p); const r = this.rig, tg = this.aimAt.clone().applyMatrix4(inv), d = tg.clone().sub(r.pos[r.i('hand.R')]).normalize(), a = tg.clone().sub(r.pos[r.i('upperArm.R')]).normalize();
      const ang = (from: number, to: number, k: number) => { let e = to - from; e -= Math.round(e / 360) * 360; return from + e * k; };
      p[IX.ba] = ang(p[IX.ba], Math.atan2(d.x, d.z) / 0.01745, aim); p[IX.be] += (Math.asin(Math.max(-1, Math.min(1, d.y))) / 0.01745 - p[IX.be]) * aim;
      p[IX.ra] = ang(p[IX.ra], Math.atan2(a.x, a.z) / 0.01745, aim * 0.75); p[IX.re] += (Math.asin(Math.max(-1, Math.min(1, a.y))) / 0.01745 - p[IX.re]) * aim * 0.75; p[IX.rl] += (0.96 - p[IX.rl]) * aim * 0.6;
    }
    this.body.solve(p);
    // --- hands close on the pole or the anchor
    const anchored = CHAIN_MODES.includes(m) || !!S0.chain, grip = 1; this.cleaver.visible = this.form === 2 || !anchored;
    for (let i = 0; i < 4; i++) { const w = Math.sin(t * 2.1 + i * 1.3) * 0.06; this.rig.euler(`f${i}a.L`, -0.1 + i * 0.07, 0, -0.3 - w).euler(`f${i}b.L`, 0, 0, -0.4 + w); this.rig.euler(`f${i}a.R`, (i * 0.07 - 0.1) * (1 - grip), 0, 0.35 + grip).euler(`f${i}b.R`, 0, 0, 0.5 + grip); }
    this.rig.euler('thumb.R', 0.4, 0, 0.5); this.rig.fk(); this.rig.apply(); g.updateMatrixWorld(true);
    // --- the pole, the lantern, the chain
    const hand = this.rig.bones[this.rig.i('hand.R')].getWorldPosition(this.hands[0]); this.fxv.update(S0, dt, t, hand.clone().add(V(0, 0.15, 0)), anchored && this.form === 1 && !S0.chain && !(S0.mode === 'cast' && S0.mt > 1.0), this.water, { x: px, z: pz });
    this.placeLantern(t, dt); this.placeOrbit(t);
    this.fxFired.length = 0;
    if (m in K) for (const f of K[m].fx ?? []) if (f.t > S0.prev && f.t <= S0.mt) {
      const tip = this.mark('cleaver', V()); tip.y = Math.max(0.05, tip.y); this.fxFired.push(f.kind);
      if (f.kind === 'slam') { this.shake = 0.8; tip.y = 0.1; this.fx.sparks.emit(tip, V(0, 0.8, 0), 40, 5, 2, 0.8, t); this.fx.puffs.emit(tip, 8, 2.2, 1.0, t); this.water?.ripple(tip.x, tip.z, 1.6, t); } else if (f.kind === 'thud') { this.shake = 0.5; this.fx.puffs.emit(V(S0.x, 0, S0.z), 10, 2, 1.1, t); this.water?.ripple(S0.x, S0.z, 1.2, t); } else if (f.kind === 'launch') { this.shake = 0.3; this.fx.puffs.emit(V(S0.x, 0, S0.z), 10, 2, 1, t); this.water?.ripple(S0.x, S0.z, 1.6, t); } else if (f.kind === 'sweep') { tip.y = 0.15; this.water?.ripple(tip.x, tip.z, 0.8, t); }
    }
    this.shake *= Math.exp(-dt * 6); for (const w of this.wounds.w.value) w.w *= Math.exp(-dt * 0.09); this.ember.value += ((S0.committed ? 1.4 : 0.8) - this.ember.value) * Math.min(1, dt * 4);
  }
  private aimAt = V(); private aimLock = new Map<object, THREE.Vector3>(); private aimSerial = -1;
  /** How much the pole is aimed (0-1) this frame, and where (`aimAt`): your chest for a thrust, the marked spot for a stab. */
  private aimFor(S0: River, px: number, pz: number) {
    if (S0.serial !== this.aimSerial) { this.aimSerial = S0.serial; this.aimLock.clear(); }
    const mt = S0.mt;
    for (const q of S0.strikes) {
      if (q.mark !== 'cleaver' || !(q.box || q.down) || q.zones?.some(z => z.at === 'mark')) continue;
      if (mt < q.cue || mt > q.t[1] + 0.35) continue;
      const stab = !q.box, ground = stab && q.zones?.some(z => z.at === 'player');
      if (!this.aimLock.has(q) && (ground ? mt >= q.cue : mt >= q.t[0] - 0.14)) this.aimLock.set(q, V(px, ground ? 0.12 : q.low ? 0.5 : 1.05, pz));
      const lock = this.aimLock.get(q); if (lock) this.aimAt.copy(lock); else this.aimAt.set(px, q.low ? 0.5 : 1.05, pz);
      return sst(q.t[0] - 0.3, q.t[0] - 0.02, mt) * (1 - sst(q.t[1] + 0.03, q.t[1] + 0.35, mt));
    }
    return 0;
  }
  private oldMan(dt: number, px: number, pz: number, t: number) {
    this.boatT += dt; const u = sst(0, 3.2, this.boatT), p = this.pose, g = this.group, rig = this.rig, lim = this.body.limbs, y = LEVEL - 1.5 + 1.55 * u + Math.sin(t * 1.1) * 0.03;
    this.boatM.position.set(0, y, -9.4); this.boatM.rotation.set(0, 0.06, 0); g.position.set(0, y + 0.35, -9.4); g.rotation.set(0, Math.atan2(px, pz + 9.4) * 0.5, 0); g.visible = true; this.man.visible = true; for (const s of this.orbit) s.visible = false;
    p.set(FSTAND); p[IX.hp] = 6; p[IX.sp] = 10; p[IX.np] = -16; p[IX.hy] = -0.1; p[IX.ra] = -6; p[IX.re] = -18; p[IX.rl] = 0.55; p[IX.xr] = 30; p[IX.lg] = 0; p[IX.la] = 18; p[IX.le] = 8; p[IX.ll] = 0.9; p[IX.be] = 0; p[IX.ba] = 0; p[IX.hw] = 0; p[IX.sw] = 0; p[IX.nw] = 0; p[IX.flz] = 0.1; p[IX.frz] = -0.1; p[IX.flw] = 0; p[IX.frw] = 0; p[IX.sp] += Math.sin(t * 0.9) * 1.2;
    g.updateMatrixWorld(true); const rm = this.rootM.copy(this.man.matrixWorld); this.body.footTargets(p, lim.footL, lim.footR); lim.handL = lim.handR = null; this.body.solve(p); this.cleaver.visible = false;
    for (let i = 0; i < 4; i++) { this.rig.euler(`f${i}a.L`, -0.2, 0, -0.5).euler(`f${i}b.L`, 0, 0, -0.6); this.rig.euler(`f${i}a.R`, 0, 0, 1.1).euler(`f${i}b.R`, 0, 0, 1.2); } void rm; rig.fk(); rig.apply(); g.updateMatrixWorld(true);
    const hp = this.rig.bones[this.rig.i('hand.L')].getWorldPosition(V()); this.lantern.visible = this.glow.visible = true; this.lantern.position.copy(hp).add(V(0, -0.22, 0)); this.lantern.rotation.set(0, 0, 0); this.glow.position.copy(this.lantern.position); this.glow.scale.setScalar(0.9 * (0.9 + 0.1 * Math.sin(t * 8)) * (0.5 + 0.5 * u));
    this.fxv.update(this.sim, dt, t, hp, false, this.water, { x: px, z: pz });
  }
  /** Hung from the hook of the pole, or at his belt when his hands are busy with the chain. */
  private placeLantern(t: number, dt: number) {
    const S0 = this.sim, k = this.lampK, on = this.form === 1, p = V(); this.lantern.visible = this.glow.visible = this.visible && on;
    if (on) {
      if (this.cleaver.visible) this.cleaver.localToWorld(p.set(0.24, 3.55, 0)); else this.rig.bones[this.rig.i('hips')].localToWorld(p.set(0.5, 0.1, 0.1));
      this.lantern.position.copy(p); this.lantern.rotation.set(Math.sin(t * 1.3) * 0.08, 0, Math.cos(t * 1.1) * 0.08); this.glow.position.copy(p).add(V(0, 0.02, 0));
      const dark = S0.dark > 0, base = dark ? 1.9 : 1, fl = 0.9 + 0.1 * Math.sin(t * 8) + 0.06 * Math.sin(t * 19); this.glow.scale.setScalar(1.0 * base * fl * (0.5 + 0.5 * k + (dark ? 0.6 : 0)));
      if (this.light) { this.light.position.copy(p); this.light.intensity = (dark ? 70 : 16) * fl; }
    }
    void dt;
  }
  /** Seven lamps on a slow wheel round his shoulders; they go out to you when he throws them. */
  private placeOrbit(t: number) {
    const S0 = this.sim, n = this.orbit.length, throwing = S0.mode === 'lamps' && S0.mt > 0.8 && S0.mt < 4.8, R = throwing ? 1.7 : 1.15 + 0.1 * Math.sin(t * 0.7);
    const show = S0.mode === 'lamps' && S0.mt > 0.2 && S0.mt < 5.2; this.orbit.forEach((q, i) => { const a = t * (throwing ? 2.6 : 0.9) + i / n * 6.283; q.visible = this.visible && show; q.position.set(S0.x + Math.sin(a) * R, 1.9 + 0.35 * Math.sin(t * 1.3 + i * 1.7) + S0.y, S0.z + Math.cos(a) * R); q.scale.setScalar((0.2 + 0.04 * Math.sin(t * 9 + i)) * this.lampK); });
  }
}
