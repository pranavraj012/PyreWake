// Drives the Pyrekeeper's body from the motor: locomotion, clip playback, cloth, trails and embers.
import * as THREE from 'three';
import { Body, Footing, Gait, HUMAN_SPEC, dirOf } from '../anim/body.ts';
import { Chains, type ChainSpec } from '../anim/chains.ts';
import { CLOTHS, colU } from '../anim/cloth.ts';
import { CH, IX, Inertial, N, makePose, sampleClip, type Ch, type Pose } from '../anim/pose.ts';
import { Rig } from '../anim/rig.ts';
import { HUMAN } from '../anim/skeletons.ts';
import { Ghosts, Ribbon, type Fx } from '../render/fx.ts';
import { SHARED } from '../render/surface.ts';
import { Blaze } from '../render/marks.ts';
import type { Motor } from './motor.ts';
import { Stride } from './stride.ts';
import type { Weapon } from '../weapons/weapon.ts';

const mix = (a: number, b: number, t: number) => a + (b - a) * t, DEG = Math.PI / 180, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Unhurried and level: weight low, eyes ahead, the blade carried rather than swung. */
const WALKP = makePose({ hy: -0.02, hp: 5, sp: 6, np: -8, ra: -96, re: -66, rl: 0.94, ba: -156, be: -30, la: 26, le: -74, ll: 0.9, xl: 10, flz: 0.02, frz: 0.02, frw: -7, flw: 7 });
/** Driving forward off the ball of the foot, sword hand low behind, blade trailing along the line of travel. */
const RUNP = makePose({ hy: -0.06, hp: 12, sp: 11, np: -18, ra: -128, re: -60, rl: 0.84, ba: -170, be: -12, la: 30, le: -46, ll: 0.66, xl: 14, flz: 0.04, frz: 0.04, frw: -3, flw: 3 });

const FEET = CH.map(c => /^f[lr]/.test(c)), LOWER = CH.map(c => /^h/.test(c));

export class PlayerView {
  group = new THREE.Group(); rig = new Rig(HUMAN); body = new Body(this.rig, HUMAN_SPEC); footing = new Footing(); gait = new Gait([0, 0.5]); stride = new Stride(); /** Lean from speeding up (+) or pulling up (-), degrees. */ private push = 0; private spPrev = 0; chains: Chains;
  /** What casts the body's shadow: the mesh itself, or a stand-in. */ shadow!: THREE.Object3D; mesh: THREE.SkinnedMesh; weapon: THREE.Mesh; blade: Ribbon; eye: Ribbon; ghosts: Ghosts; fx: Fx; arm: Weapon;
  pose: Pose = new Float32Array(N); private src = new Float32Array(N); private tmp = new Float32Array(N); private inert = new Inertial(); private source = ''; private wasGait = false;
  private yawPrev = 0; private lean = 0; private drop = 0; ember = 0.35; /** 0-1, from the fire meter: the arms answer. */ fireK = 0; /** Aura step 0-4, eased. */ aura = { value: 0 }; auraStep = 0; /** Length of the fire beyond the steel (Last Rites; a lick of it at full aura). */ private long = 0; blaze = new Blaze(); shake = 0; private ghostT = 0; steps = 0; private time = 0; private stepped = false;
  /** Dissolve 0-1 and flash, shared with the body and weapon materials. */ dis = { value: 0 }; flash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; private guardK = 0; boomAt = V(); boomK = 0;
  glow: THREE.PointLight | null = null; private weaponQ = new THREE.Quaternion(); tip = V(); private tipPrev = V(); base = V(); tipVel = V(1, 0, 0); tipSpeed = 0; eyeW = V();

  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, geoLo: THREE.BufferGeometry, khanda: THREE.BufferGeometry, mat: THREE.Material, held: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, ghostN: number, arm: Weapon) {
    this.arm = arm; this.fx = fx;
    this.mesh = new THREE.SkinnedMesh(geo, mat); this.group.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4());
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; scene.add(this.group); this.shadow = this.mesh;
    this.weapon = new THREE.Mesh(khanda, held); this.weapon.castShadow = this.weapon.receiveShadow = true; this.weapon.customDepthMaterial = depth.still;
    const A = HUMAN_SPEC.armDir, g = HUMAN_SPEC.grip; this.weapon.position.set(-A[0] * g[0] - A[1] * g[1], A[1] * g[0] - A[0] * g[1], 0); this.weapon.rotation.set(Math.PI / 2, Math.atan2(A[1], -A[0]), 0);
    this.weaponQ.copy(this.weapon.quaternion); this.rig.bones[this.rig.i('hand.R')].add(this.weapon); this.weapon.add(this.blaze.mesh); this.blaze.mesh.position.y = arm.blade[0] - 0.2;
    this.blade = new Ribbon(96, 0.2, new THREE.Color(...arm.trail), 0); this.eye = new Ribbon(96, 0.34, new THREE.Color(1.6, 0.5, 0.1), 1);
    scene.add(this.blade.mesh, this.eye.mesh);
    this.ghosts = new Ghosts(scene, geoLo, this.rig.skeleton, ghostN);
    const specs: ChainSpec[] = CLOTHS.flatMap(c => Array.from({ length: c.cols }, (_, i): ChainSpec => ({ bones: Array.from({ length: c.rows }, (_, j) => `${c.name}${i}_${j}`), anchor: c.anchor, tip: V(...c.at(colU(c, i), 1)), stiff: c.stiff, group: c.cols > 1 ? c.name : c.name + i, wind: c.name === 'cape' ? 1.5 : 0.8, drag: c.name === 'cape' ? 1.6 : 1.2 })));
    specs.push({ bones: ['braid1', 'braid2', 'braid3', 'braid4'], anchor: 'head', tip: V(0.008, 1.06, -0.145), stiff: 0.05, group: 'braid', wind: 0.3, drag: 0.8 });
    this.chains = new Chains(this.rig, specs, [{ a: 'hips', b: 'chest', r: 0.145 }, { a: 'chest', b: 'neck', r: 0.135 }, { a: 'thigh.L', b: 'shin.L', r: 0.105 }, { a: 'thigh.R', b: 'shin.R', r: 0.105 }, { a: 'shin.L', b: 'foot.L', r: 0.075 }, { a: 'shin.R', b: 'foot.R', r: 0.075 }, { a: 'upperArm.L', b: 'foreArm.L', r: 0.07 }, { a: 'upperArm.R', b: 'foreArm.R', r: 0.07 }]);
  }
  /** The body was turned in the world by this much: the pose must not swing back through it. */
  about(deg: number) { this.inert.turned(deg); }
  /** After a teleport. */
  reset() { this.footing.reset(); this.blade.clear(); this.eye.clear(); this.dis.value = 0; this.guardK = 0; this.chains.reset(); this.wasGait = false; this.tipPrev.set(0, -99, 0); }
  private locomotion(m: Motor, out: Pose, dt: number) {
    const s = m.speed, run = sst(2.2, 4.6, s), mv = sst(0.1, 1.0, s), spr = sst(5.4, 6.8, s);
    const calm = sst(1.2, 3.2, m.calm), br = Math.sin(this.time * 1.7);
    for (let i = 0; i < N; i++) { const idle = this.arm.ready[i] + (this.arm.rest[i] - this.arm.ready[i]) * calm, mo = WALKP[i] + (RUNP[i] - WALKP[i]) * run; out[i] = idle + (mo - idle) * mv; }
    const add = (c: Ch, v: number) => { out[IX[c]] += v; }, set = (c: Ch, v: number, k: number) => { out[IX[c]] += (v - out[IX[c]]) * k; };
    // breath and weight shift at rest
    add('sp', br * 1.1 * (1 - mv)); add('hy', br * 0.004 * (1 - mv)); add('re', br * 0.8 * (1 - mv)); add('nw', Math.sin(this.time * 0.43) * 4 * (1 - mv) * calm); add('hx', Math.sin(this.time * 0.6) * 0.008 * (1 - mv));
    // phase 0 = left heel down. Left leg forward means left hip forward, right shoulder forward, left arm back.
    const T = Math.PI * 2, ph = this.stride.phase, D = this.stride.duty, c = Math.cos(T * ph), mid = Math.cos(T * (ph - D / 2)), bob = Math.cos(2 * T * (ph - D / 2)), w = mv;
    const hipA = 6 + 5 * run, chA = 5 + 6 * run;
    add('hw', -c * hipA * w); add('sw', c * (hipA + chA) * w); add('nw', -c * chA * 0.85 * w);
    add('hr', mid * (3.5 - 1.5 * run) * w); add('sr', -mid * 2 * w); add('hx', mid * (0.018 - 0.01 * run) * w);
    add('hy', bob * (0.012 * (1 - run) - 0.032 * run) * w); add('sp', -bob * 2.2 * run * w);
    add('hp', 5 * spr + this.push * w); add('sp', 6 * spr + this.push * 0.6 * w); add('np', -(5 * spr + this.push * 1.4) * w);
    add('hr', this.lean * mv); add('sr', this.lean * 0.6 * mv);
    // arms swing fore and aft from the shoulder, elbows bending more as the pace rises
    const arm = (th: number, out_: number) => { const d = V(out_, -Math.cos(th * DEG), Math.sin(th * DEG)).normalize(); return [Math.atan2(d.x, d.z) / DEG, Math.asin(d.y) / DEG]; };
    // turning: the body banks into the turn and the outside arm swings wide for balance
    const bank = Math.max(-1, Math.min(1, this.lean / 12)) * mv, outL = Math.max(0, -bank) * 0.3, outR = Math.max(0, bank) * 0.22;
    // the free hand runs a real path from the shoulder: up and in toward the chest going forward, elbow closing; down by the hip going back, elbow opening
    const fwd = Math.max(0, -c), bwd = Math.max(0, c), hx = (0.05 - 0.13 * run * fwd + 0.04 * bwd) + outL * 0.25, hy = mix(-0.42, -0.2, run) * fwd + mix(-0.47, -0.42, run) * bwd + mix(-0.47, -0.36, run) * (1 - fwd - bwd), hz = (0.1 + 0.08 * run) * fwd - (0.12 + 0.06 * run) * bwd;
    const chest = (out[IX.hw] + out[IX.sw]) * w, hl = Math.hypot(hx, hy, hz); set('la', Math.atan2(hx, hz) / DEG + chest, w); set('le', Math.asin(hy / hl) / DEG + 16 * outL, w); set('ll', Math.min(0.97, hl / this.body.armLen), w); set('xl', 16 + 12 * run, w);
    // the sword hand stays out by the hip and pumps a little against the free one; the blade hangs back and down, tip near the stone
    const thR = c * (5 + 4 * run) - 24 - 6 * run, [raz, rel] = arm(thR, -0.3 - outR);
    set('ra', raz + chest * 0.6, w); set('re', rel + 6 * run + 10 * outR, w); set('rl', 0.9 - 0.08 * run, w); set('xr', -8, w); set('ba', -148 + c * 2 * w, w); set('be', -22 + 4 * run + Math.sin(2 * T * ph) * 1.5 * w - 3 * spr, w);
    add('sr', bank * 6); add('nr', -bank * 5);
    // guard: the upper body belongs to the weapon, the hips keep walking
    this.guardK += ((m.guarding ? 1 : 0) - this.guardK) * Math.min(1, dt * (m.guarding ? 26 : 12)); const g = this.guardK;
    if (g > 0.005) { const G = this.arm.guard; for (let i = 0; i < N; i++) { if (FEET[i] && mv > 0.3) continue; const k = LOWER[i] ? g * (1 - 0.55 * mv) : g; out[i] += (G[i] - out[i]) * k; } add('sp', br * 0.8 * g); }
  }
  /** What an unbroken streak looks like: arms, eye, hem, then the blade and the ground under each step. */
  private auraFx(m: Motor, t: number, dt: number, sp: number) {
    const a = this.auraStep; if (a < 1) return; const R = Math.random;
    if (R() < dt * (6 + a * 14)) { const p = V(m.x + (R() - 0.5) * 0.7, 0.2 + R() * 1.3, m.z + (R() - 0.5) * 0.7); this.fx.sparks.emit(p, V(0, 1, 0), 1, 0.6, 1, -1.8, t); }
    if (a >= 3 && R() < dt * 26) { const bk = V(-Math.sin(m.yaw), 0, -Math.cos(m.yaw)); this.fx.sparks.emit(V(m.x + bk.x * 0.3 + (R() - 0.5) * 0.5, 0.25 + R() * 0.3, m.z + bk.z * 0.3 + (R() - 0.5) * 0.5), V(bk.x * 0.4, 1, bk.z * 0.4), 2, 0.8, 0.9, -1.4, t); }
    if (a >= 4) { for (let k = 0; k < 2; k++) if (R() < dt * 60) this.fx.sparks.emit(this.base.clone().lerp(this.tip, R()), V(0, 0.8, 0), 1, 0.7, 1, -1.1, t); if (sp > 2 && m.state === 'free') for (const w of this.footing.world) if (R() < dt * 5) this.fx.bursts.add('pillar', V(w.x, -0.03, w.z), 0.55, 0.5, t); }
  }
  update(dt: number, m: Motor, t: number) {
    this.time = t; const p = this.pose;
    let dy = m.yaw - this.yawPrev; dy -= Math.round(dy / 6.2832) * 6.2832; this.yawPrev = m.yaw; this.lean += ((-dy / Math.max(dt, 1e-3)) * Math.min(1, m.speed / 5) * 3.2 - this.lean) * Math.min(1, dt * 8); this.lean = Math.max(-16, Math.min(16, this.lean));
    if (m.events.includes('about')) this.about(180);
    { const a = (m.speed - this.spPrev) / Math.max(dt, 1e-3); this.spPrev = m.speed; this.push += (Math.max(-9, Math.min(8, a * 0.7)) - this.push) * Math.min(1, dt * 6); }
    const inClip = m.state === 'clip' && m.clip, key = inClip ? 'c' + m.started : 'loco';
    this.locomotion(m, this.tmp, dt);
    if (inClip) sampleClip(m.clip!, m.t, this.tmp, this.src); else this.src.set(this.tmp);
    if (key !== this.source) { const far = Math.abs(p[IX.hy] - this.src[IX.hy]); // a mid-air cancel needs longer to come down
      const turn = Math.abs(p[IX.hw] + p[IX.sw] - this.src[IX.hw] - this.src[IX.sw]);
      this.inert.start(this.src, null, Math.max(inClip ? m.clip!.blend ?? 0.12 : 0.26, /^(hurt|down|block|parry|rekindle)$/.test(m.clip?.name ?? '') ? 0 : far * 0.26, /^(hurt|down|block|parry|rekindle)$/.test(m.clip?.name ?? '') ? 0 : Math.min(0.24, turn / 390))); this.source = key; }
    p.set(this.src); this.inert.apply(p, dt);

    this.group.position.set(m.x, m.y, m.z); this.group.rotation.y = m.yaw + p[IX.tw] * Math.PI / 180; this.group.updateMatrixWorld(true);
    const root = this.group.matrixWorld, L = this.body.limbs.footL, R = this.body.limbs.footR;
    const gaiting = !inClip && m.speed > 0.35 && m.y === 0;
    if (gaiting) {
      if (!this.wasGait) { this.stride.reset(this.footing.world, this.stepped ? 0.12 : 0.62); this.stepped = !this.stepped; }
      const run = sst(2.2, 4.6, m.speed); this.stride.update(dt, V(m.vx, 0, m.vz), root, run, sst(5.4, 6.8, m.speed), L, R);
      p[IX.flp] = this.stride.pitch[0]; p[IX.frp] = this.stride.pitch[1]; p[IX.flw] = 0; p[IX.frw] = 0;
      this.steps += this.stride.landed.length; for (const i of this.stride.landed) this.fx.puffs.emit(this.stride.pos[i], run > 0.6 ? 2 : 1, 0.3 + 0.3 * run, 0.6, t);
      this.footing.adopt(this.stride.pos[0], this.stride.pos[1]);
    } else {
      this.body.footTargets(p, L, R); this.footing.update(L, R, root, dt, p[IX.air], 0.09); this.steps += this.footing.events.length;
    }
    this.wasGait = gaiting;
    // never let the hips outrun the planted feet
    // a foot in the air that the leg cannot reach is drawn in toward the hip (the knee folds); only a foot bearing weight may pull the hips down
    let over = 0; [L, R].forEach((f, k) => { const reach = 0.83, hipY = 0.92 + p[IX.hy], hx = k ? -0.095 : 0.095, d = Math.hypot(f.x - hx, f.z, hipY - f.y);
      if (d <= reach) return; if (gaiting && !this.stride.stance[k]) { const q = (reach * 0.995) / d; f.set(hx + (f.x - hx) * q, hipY - (hipY - f.y) * q, f.z * q); } else over = Math.max(over, Math.min(0.14, (d - reach) * 0.9)); });
    this.drop += (over - this.drop) * Math.min(1, dt * 22); p[IX.hy] -= this.drop;
    this.body.solve(p); this.weapon.quaternion.copy(this.body.gripAdj).multiply(this.weaponQ);
    const sp = Math.hypot(m.vx, m.vz); this.chains.update(root, dt, t, 1.1, -0.5, sp * 0.05); this.rig.apply(); this.group.updateMatrixWorld(true);

    // --- trails and embers
    this.weapon.localToWorld(this.tip.set(0, this.arm.blade[1] + (inClip && m.clip!.name === 'rites' ? this.long : 0), 0)); this.weapon.localToWorld(this.base.set(0, this.arm.blade[0], 0));
    this.tipSpeed += (Math.min(60, this.tip.distanceTo(this.tipPrev) / Math.max(dt, 1e-3)) - this.tipSpeed) * 0.6; if (this.tipPrev.y > -90) this.tipVel.copy(this.tip).sub(this.tipPrev).divideScalar(Math.max(dt, 1e-3)); this.tipPrev.copy(this.tip);
    const tr = inClip ? m.clip!.trail ?? (m.clip!.hit ? [m.clip!.hit[0], (m.clip!.hits ?? [m.clip!.hit]).at(-1)![1]] : null) : null, hot = !!tr, hitEnd = tr ? tr[1] : 0;
    this.blade.push(this.base, this.tip, hot ? sst(5, 15, this.tipSpeed) * sst(tr![0] - 0.07, tr![0] - 0.02, m.t) * sst(hitEnd + 0.12, hitEnd + 0.03, m.t) * (m.clip!.reel || m.clip!.trail ? 1.5 : 1) : 0, t); this.blade.update(t);
    const hb = this.rig.bones[this.rig.i('head')]; this.eyeW.set(0.032, 0.067, 0.085); hb.localToWorld(this.eyeW);
    const ew = (hot ? 0.25 : 0) + (this.auraStep >= 2 ? 0.45 : 0) + (inClip && /^dodge|rush/.test(m.clip!.name) ? 0.3 : 0); const up = V(0, 0.0075, 0); this.eye.push(this.eyeW.clone().sub(up), this.eyeW.clone().add(up), ew, t); this.eye.update(t);
    // the blade tip scraping stone
    if (!hot && this.tip.y < 0.09 && this.tipSpeed > 0.7 && Math.random() < Math.min(0.75, this.tipSpeed * 0.16)) this.fx.sparks.emit(V(this.tip.x, 0.03, this.tip.z), V(-m.vx * 0.1, 0.5, -m.vz * 0.1), 2, 1.5 + this.tipSpeed * 0.25, 1.2, 0.45, t);
    if (hot && this.tipSpeed > 12 && Math.random() < 0.8) this.fx.sparks.emit(this.tip, V(0, 0.3, 0), 2, 0.9, 1.6, -0.9, t);
    this.aura.value += (this.auraStep - this.aura.value) * Math.min(1, dt * 3); const rites = inClip && m.clip!.name === 'rites', wantLong = inClip && m.clip!.name === 'pyreWheel' && m.t > 0.12 && m.t < 0.95 ? 0.9 : rites && m.t > 0.4 && m.t < 3.6 ? (m.t < 1.4 ? sst(0.4, 0.8, m.t) * 0.6 : m.t < 1.95 ? 0.6 + sst(1.4, 1.75, m.t) * 3.4 : m.t < 2.9 ? 2.2 : 2.6 * sst(3.5, 2.95, m.t)) : this.auraStep >= 4 ? 1.1 : 0; this.long += (wantLong - this.long) * Math.min(1, dt * 18); this.blaze.set(Math.max(0.2, this.long), rites ? Math.min(1, this.long) : Math.min(0.3, this.long * 0.3));
    this.auraFx(m, t, dt, sp);
    const charging = inClip && m.clip!.name === this.arm.charge ? Math.min(1, m.t / 1.2) : 0, want = 0.35 + this.fireK * 0.75 + this.aura.value * 0.16 + charging * 1.1 + (hot ? 0.35 : 0) + (m.calm < 2 ? 0.15 : 0);
    this.ember += (want - this.ember) * Math.min(1, dt * 5); SHARED.uEmber.value = this.ember;
    if (this.glow) { const f = this.rig.bones[this.rig.i('foreArm.R')].getWorldPosition(V()); this.glow.position.set(f.x + Math.sin(m.yaw) * 0.35, 0.95, f.z + Math.cos(m.yaw) * 0.35); this.glow.intensity = 0.5 + this.ember * 1.25 + this.shake * 2.5; this.glow.distance = 6; if (this.boomK > 0.02) { this.glow.position.copy(this.boomAt); this.glow.distance = 16; this.glow.intensity = 90 * this.boomK; } } this.boomK *= Math.exp(-dt * 5);
    if (Math.random() < dt * (3 + charging * 60)) { const h = this.rig.bones[this.rig.i(Math.random() < 0.5 ? 'foreArm.L' : 'foreArm.R')], q = V(0, 0, 0); h.localToWorld(q); this.fx.sparks.emit(q, V(0, 0.8, 0), 1, 0.35, 1.2, -1.6, t); }
    for (const e of m.events) {
      if (e.startsWith('clip:dodge')) { this.ghostT = 0.26; this.ghosts.snap(t); this.fx.sparks.emit(V(m.x, 0.9, m.z), V(0, 0.2, 0), 22, 1.6, 2, -1.1, t); this.fx.puffs.emit(V(m.x, 0, m.z), 5, 0.9, 0.9, t); }
      if (e === 'fx:slam') { this.shake = 0.5; const g = V(this.tip.x, 0.05, this.tip.z); this.fx.sparks.emit(g, V(0, 0.9, 0), 70, 4.6, 1.9, 0.9, t); this.fx.sparks.emit(g, V(0, 0.4, 0), 40, 2.2, 2.2, -1.8, t); this.fx.puffs.emit(g, 14, 2.4, 1.3, t); }
      if (e === 'fx:erupt') { this.shake = 0.75; const f = V(Math.sin(m.yaw), 0, Math.cos(m.yaw)), g = V(m.x, 0.06, m.z).addScaledVector(f, 0.6); this.fx.bursts.add('ground', g, 7, 0.6, t); for (let i = 0; i < 7; i++) { const a = m.yaw + (i - 3) * 0.5, r = 1.5 + (i & 1) * 0.5; this.fx.bursts.add('pillar', V(m.x + Math.sin(a) * r, 0, m.z + Math.cos(a) * r), 1.9 + Math.random() * 0.8, 0.6, t + 0.03 + Math.abs(i - 3) * 0.04); } this.fx.sparks.emit(g, V(0, 1.1, 0), 80, 5, 2, 0.9, t); this.fx.sparks.emit(g, V(0, 0.6, 0), 40, 2.4, 2.2, -2, t); this.fx.puffs.emit(g, 14, 2.8, 1.4, t); }
      if (e === 'fx:thrust') { const f = V(Math.sin(m.yaw), 0.05, Math.cos(m.yaw)); for (const [d, z] of [[0.9, 1.1], [1.9, 1.7]]) this.fx.bursts.add('ring', V(m.x + f.x * d, 1.25, m.z + f.z * d), z, 0.3, t + d * 0.02); this.fx.sparks.emit(this.tip, f, 36, 7, 0.5, 0.5, t); }
      if (e === 'fx:scrapeFeet') { for (const w of this.footing.world) { this.fx.sparks.emit(V(w.x, 0.03, w.z), V(Math.sin(m.yaw) * 0.7, 0.4, Math.cos(m.yaw) * 0.7), 8, 2.4, 1.0, 0.4, t); } this.fx.puffs.emit(V(m.x, 0, m.z), 4, 0.8, 0.8, t); }
      if (e === 'fx:heal') { this.ember = 1.6; this.flash.value.set(1, 0.36, 0.07, 0.16); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; this.fx.sparks.emit(V(m.x + Math.cos(a) * 0.55, 0.1, m.z + Math.sin(a) * 0.55), V(-Math.cos(a) * 0.25, 1.5, -Math.sin(a) * 0.25), 3, 1.3, 0.5, -1.5, t); } }
      if (e === 'fx:vanish') { this.ghosts.snap(t); this.fx.sparks.emit(V(m.x, 1, m.z), V(0, 0.4, 0), 60, 2.4, 2.4, -1.6, t); this.fx.bursts.add('fire', V(m.x, 0.8, m.z), 1.7, 0.5, t, 1); this.fx.puffs.emit(V(m.x, 0, m.z), 8, 1.4, 1.0, t); }
      if (e === 'fx:reform') { this.shake = 0.2; this.fx.sparks.emit(V(m.x, 0.8, m.z), V(Math.sin(m.yaw), 0.2, Math.cos(m.yaw)), 40, 3, 2, -1.2, t); this.fx.puffs.emit(V(m.x, 0, m.z), 8, 1.6, 1.0, t); }
      if (e === 'land') { const hard = m.clip?.name === this.arm.air.hit; if (!hard) this.fx.puffs.emit(V(m.x, 0, m.z), 8, 1.5, 0.9, t); }
      if (e === 'clip:jump') { this.ghosts.snap(t); this.fx.puffs.emit(V(m.x, 0, m.z), 4, 1.4, 0.7, t); this.fx.sparks.emit(V(m.x, 0.1, m.z), V(0, 0.7, 0), 14, 2, 2, 0.4, t); }
      if (e === 'fx:dive') { this.ghosts.snap(t); this.ghostT = 0.3; this.fx.bursts.add('ring', V(m.x, m.y + 1.1, m.z), 2.6, 0.3, t); this.fx.sparks.emit(V(m.x, m.y + 1, m.z), V(0, 0.4, 0), 24, 2.4, 2, -0.6, t); }
      if (e === 'fx:plunge') { this.shake = 0.8; this.ember = 1.8; const g = V(m.x + Math.sin(m.yaw) * 0.5, 0.06, m.z + Math.cos(m.yaw) * 0.5), hot = m.sky > 0; this.fx.bursts.add('ground', g, hot ? 8 : 5.5, 0.5, t); for (let i = 0; i < (hot ? 7 : 4); i++) { const a = m.yaw + (i - (hot ? 3 : 1.5)) * 0.66, r = 1.5 + (i & 1) * 0.5; this.fx.bursts.add('pillar', V(m.x + Math.sin(a) * r, 0, m.z + Math.cos(a) * r), 1.3 + Math.random() * 0.6, 0.5, t + 0.02 + i * 0.015); } this.fx.sparks.emit(g, V(0, 1, 0), 80, 5.2, 2, 0.9, t); this.fx.sparks.emit(g, V(0, 0.5, 0), 36, 2.4, 2.2, -1.8, t); this.fx.puffs.emit(g, 7, 2.6, 1.1, t); this.boomAt.copy(g).setY(1.2); this.boomK = Math.max(this.boomK, 0.35); }
      if (e === 'fx:wipe') { this.ember = 1.7; for (let i = 0; i < 10; i++) this.fx.sparks.emit(this.base.clone().lerp(this.tip, i / 9), V(0, 0.8, 0), 4, 1, 1.6, -1.4, t + i * 0.025); }
      if (e === 'fx:wheel') { this.ember = 1.8; this.ghosts.snap(t); this.fx.bursts.add('ring', V(m.x + Math.cos(m.yaw) * -0.5, 1.15, m.z + Math.sin(m.yaw) * 0.5), 2.4, 0.35, t, 0, 1.5, 0.7, 0.3); }
      if (e === 'fx:pillar') { this.shake = 0.5; this.ember = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; this.fx.bursts.add('pillar', V(m.x + Math.cos(a) * 1.5, 0, m.z + Math.sin(a) * 1.5), 2.4, 0.7, t + i * 0.02); } this.fx.bursts.add('ground', V(m.x, 0.06, m.z), 7, 0.7, t); }
      if (e === 'fx:rcut') { this.ghosts.snap(t); this.shake = 0.35; }
      if (e === 'fx:rlast') { this.ghosts.snap(t); this.shake = 0.5; this.fx.puffs.emit(V(m.x, 0, m.z), 12, 2, 1.1, t); this.fx.sparks.emit(V(m.x, 0.05, m.z), V(Math.sin(m.yaw), 0.3, Math.cos(m.yaw)), 40, 4.5, 1, 0.6, t); }
      if (e === 'fx:riposte') { this.shake = 0.6; this.ember = 1.8; const f = V(Math.sin(m.yaw), 0, Math.cos(m.yaw)); for (let i = 0; i < 3; i++) this.fx.bursts.add('pillar', V(m.x + f.x * (0.9 + i * 0.7), 0, m.z + f.z * (0.9 + i * 0.7)), 1.6 + i * 0.3, 0.5, t + i * 0.03); }
      if (e === 'fx:impale' || e === 'fx:twist') { this.shake = 0.6; this.ember = 1.9; }
      if (e === 'fx:finale') { this.shake = 1; this.ember = 2; this.ghosts.snap(t); }
      if (e === 'fx:dust') this.fx.puffs.emit(V(m.x, 0, m.z), 8, 1.4, 1.0, t);
      if (e === 'fx:crescent') { this.shake = 0.3; this.fx.sparks.emit(this.tip, dirOf(0, 60), 40, 4, 1.8, 0.8, t); }
      if (e === 'fx:flare') { this.ember = 1.5; for (const h of ['hand.L', 'hand.R']) { const q = V(); this.rig.bones[this.rig.i(h)].localToWorld(q); this.fx.sparks.emit(q, V(0, 1, 0), 12, 0.8, 1.5, -1.6, t); } }
      if (e === 'fx:flick') this.fx.sparks.emit(this.tip, V(Math.sin(m.yaw - 1.4), -0.1, Math.cos(m.yaw - 1.4)), 26, 5, 0.9, 0.5, t);
      if (e === 'fx:crack') { this.shake = 0.45; const g = V(this.tip.x, 0.05, this.tip.z); this.fx.bursts.add('ground', g, 4, 0.5, t); this.fx.sparks.emit(g, V(0, 0.9, 0), 40, 4, 2, 0.8, t); this.fx.puffs.emit(g, 10, 2, 1.2, t); }
      if (e === 'fx:kick') { const f = V(Math.sin(m.yaw), 0, Math.cos(m.yaw)); this.fx.bursts.add('fire', V(m.x + f.x * 0.9, 1.2, m.z + f.z * 0.9), 1.5, 0.4, t); this.fx.sparks.emit(V(m.x + f.x, 1.2, m.z + f.z), f, 26, 4, 1.2, -1, t); }
      if (e === 'fx:palm') { this.shake = 0.4; this.ember = 1.7; const f = V(Math.sin(m.yaw), 0.05, Math.cos(m.yaw)), p = V(); this.rig.bones[this.rig.i('hand.L')].getWorldPosition(p); for (let i = 0; i < 3; i++) this.fx.bursts.add('fire', p.clone().addScaledVector(f, 0.3 + i * 0.5), 1.1 + i * 0.5, 0.45, t + i * 0.03, i * 2); this.fx.bursts.add('ring', p.clone().addScaledVector(f, 0.4), 2.2, 0.3, t); this.fx.sparks.emit(p, f, 60, 6, 0.9, 0.5, t); this.fx.sparks.emit(p, f, 30, 3, 1.4, -1.3, t); }
      if (e === 'fx:blur') { this.ghosts.snap(t); this.fx.sparks.emit(V(m.x, 1, m.z), V(0, 0.2, 0), 10, 2, 2, -1, t); }
      if (e === 'fx:reckon' || e === 'fx:wrench') { this.shake = 0.7; this.ember = 1.8; }
      if (e === 'fx:wave') { this.shake = 0.7; for (let i = 0; i < 8; i++) { const d = 1.2 + i * 0.85, q = V(m.x + Math.sin(m.yaw) * d, 0, m.z + Math.cos(m.yaw) * d); this.fx.bursts.add('pillar', q, 2.0 + Math.random() * 0.7, 0.6, t + i * 0.035); this.fx.sparks.emit(V(q.x, 0.3, q.z), V(0, 1, 0), 8, 3.5, 1.6, 0.7, t + i * 0.035); } this.fx.bursts.add('ground', V(m.x, 0.06, m.z), 5, 0.5, t); this.fx.puffs.emit(V(m.x, 0, m.z), 12, 2.6, 1.3, t); }
      if (e === 'fx:throw' || e === 'fx:sunder') { const big = e === 'fx:sunder'; this.shake = big ? 0.5 : 0.2; this.ember = 1.6; const f = V(Math.sin(m.yaw), 0, Math.cos(m.yaw)); this.fx.sparks.emit(V(m.x + f.x, 1.2, m.z + f.z), f, big ? 70 : 24, 5, 1.2, 0.6, t); if (big) this.fx.bursts.add('flare', V(m.x + f.x, 1.4, m.z + f.z), 3, 0.25, t); }
      if (e === 'fx:rekindle') { this.shake = 0.8; this.ember = 2; this.flash.value.set(1, 0.36, 0.07, 1.2); this.fx.bursts.add('ground', V(m.x, 0.06, m.z), 10, 0.7, t); this.fx.bursts.add('flare', V(m.x, 1.2, m.z), 6, 0.35, t); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; this.fx.bursts.add('pillar', V(m.x + Math.cos(a) * 1.4, 0, m.z + Math.sin(a) * 1.4), 2.6, 0.8, t + 0.03); } this.fx.sparks.emit(V(m.x, 1.2, m.z), V(0, 0.4, 0), 120, 5, 2.4, -1.6, t); this.boomAt.set(m.x, 1.6, m.z); this.boomK = 1; }
      if (e === 'fx:rites') { this.shake = 1; this.ember = 2; }
      if (e === 'fx:blink') { this.ghosts.snap(t); this.ghostT = 0.2; }
      if (e === 'fx:stepCut') { this.shake = 0.7; this.ember = 1.9; const g = V(this.tip.x, 0.05, this.tip.z); this.fx.bursts.add('ground', g, 4, 0.5, t); this.fx.sparks.emit(g, V(0, 1, 0), 60, 4.5, 2, 0.8, t); this.fx.puffs.emit(g, 8, 2, 1.1, t); }
      if (e === 'fx:wheelFire') { this.ember = 1.9; this.ghosts.snap(t); this.fx.bursts.add('ring', V(m.x, 1.0, m.z), 5.2, 0.32, t, 0, 1.6, 0.6, 0.15); }
      if (e === 'fx:ashfall') { this.ember = 2; const q = V(); this.rig.bones[this.rig.i('hand.L')].localToWorld(q); this.fx.bursts.add('flare', q, 2.4, 0.4, t); this.fx.sparks.emit(q, V(0, 1, 0), 60, 7, 1.4, -0.6, t); this.boomAt.copy(q); this.boomK = Math.max(this.boomK, 0.4); }
      if (e === 'fx:scrape') this.fx.sparks.emit(V(this.tip.x, 0.03, this.tip.z), V(Math.sin(m.yaw) * 0.7, 0.6, Math.cos(m.yaw) * 0.7), 10, 3, 0.9, 0.5, t);
    }
    // Cinder Rush: body to ash and back, a burning wall where it passed
    const rush = inClip && m.clip!.name === 'rush', dead = inClip && m.clip!.name === 'die';
    const step = inClip && m.clip!.name === 'ashstep', gone = rites && m.t > 1.9 && m.t < 2.98, u = (m.t - 2.0) / 0.14, dw = rush ? sst(0.05, 0.12, m.t) * sst(0.5, 0.34, m.t) : dead ? sst(1.5, 2.9, m.t) : gone ? (m.t < 2.0 ? sst(1.9, 1.96, m.t) : m.t > 2.84 ? sst(2.96, 2.91, m.t) : sst(0.55, 0.95, u - Math.floor(u)) * 0.9) : 0; this.dis.value = rush || dead || gone ? dw : step ? sst(0.08, 0.15, m.t) * sst(0.36, 0.28, m.t) : Math.max(0, this.dis.value - dt * 6); this.shadow.castShadow = this.dis.value < 0.5;
    const on = rush && m.t > 0.06 && m.t < 0.42; if (on) { for (let d = m.speed * dt; d > 0; d -= 0.42) { const sx = m.vx / (m.speed || 1), sz = m.vz / (m.speed || 1); this.fx.bursts.add('pillar', V(m.x - sx * d, -0.04, m.z - sz * d), 1.1 + Math.random() * 0.5, 1.0 + Math.random() * 0.25, t); } }
    if (on) { for (let i = 0; i < 3; i++) this.fx.sparks.emit(V(m.x - m.vx * dt * i / 3, 0.2 + Math.random() * 1.5, m.z - m.vz * dt * i / 3), V(0, 0.5, 0), 5, 1.2, 1.6, -1.7, t); }
    if (dead && m.t > 1.4 && m.t < 3) this.fx.sparks.emit(V(m.x, 0.3 + Math.random() * 1.0, m.z), V(0.2, 0.7, 0), 2, 0.7, 1.4, -2, t);
    this.flash.value.w *= Math.exp(-dt * 7); this.flashAt.value.set(m.x, 1.15, m.z, 0.8);
    if (this.ghostT > 0) { const b = this.ghostT; this.ghostT -= dt; if (Math.floor(b / 0.07) !== Math.floor(this.ghostT / 0.07)) this.ghosts.snap(t); }
    this.ghosts.update(t); this.shake *= Math.exp(-dt * 6);
  }
}
