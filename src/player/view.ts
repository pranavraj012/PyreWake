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
import type { Motor } from './motor.ts';
import type { Weapon } from '../weapons/weapon.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const WALKP = makePose({ hy: -0.035, hp: 1, sp: -4, np: 6, ra: -104, re: -60, rl: 0.95, ba: -150, be: -34, la: 34, le: -72, ll: 0.93, xl: 8, flz: 0.03, frz: 0.03, frw: -10, flw: 4 });
const RUNP = makePose({ hy: -0.12, hp: 13, sp: 13, np: -20, ra: -112, re: -42, rl: 0.95, ba: -158, be: -16, la: 60, le: -50, ll: 0.8, xl: 12, flz: 0.06, frz: 0.06, frw: -4 });

const FEET = CH.map(c => /^f[lr]/.test(c)), LOWER = CH.map(c => /^h/.test(c));

export class PlayerView {
  group = new THREE.Group(); rig = new Rig(HUMAN); body = new Body(this.rig, HUMAN_SPEC); footing = new Footing(); gait = new Gait([0, 0.5]); chains: Chains;
  /** What casts the body's shadow: the mesh itself, or a stand-in. */ shadow!: THREE.Object3D; mesh: THREE.SkinnedMesh; weapon: THREE.Mesh; blade: Ribbon; eye: Ribbon; ghosts: Ghosts; fx: Fx; arm: Weapon;
  pose: Pose = new Float32Array(N); private src = new Float32Array(N); private tmp = new Float32Array(N); private inert = new Inertial(); private source = ''; private wasGait = false; private loco = 0;
  private yawPrev = 0; private lean = 0; private drop = 0; ember = 0.35; /** 0-1, from the fire meter: the arms answer. */ fireK = 0; shake = 0; private ghostT = 0; private time = 0; private stepped = false;
  /** Dissolve 0-1 and flash, shared with the body and weapon materials. */ dis = { value: 0 }; flash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }; flashAt = { value: new THREE.Vector4(0, 0, 0, 1) }; private guardK = 0; boomAt = V(); boomK = 0;
  glow: THREE.PointLight | null = null; tip = V(); private tipPrev = V(); base = V(); tipVel = V(1, 0, 0); tipSpeed = 0; eyeW = V();

  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, geoLo: THREE.BufferGeometry, khanda: THREE.BufferGeometry, mat: THREE.Material, held: THREE.Material, depth: { skin: THREE.Material; still: THREE.Material }, fx: Fx, ghostN: number, arm: Weapon) {
    this.arm = arm; this.fx = fx;
    this.mesh = new THREE.SkinnedMesh(geo, mat); this.group.add(this.rig.bones[0], this.mesh); this.mesh.bind(this.rig.skeleton, new THREE.Matrix4());
    this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.customDepthMaterial = depth.skin; this.mesh.frustumCulled = false; scene.add(this.group); this.shadow = this.mesh;
    this.weapon = new THREE.Mesh(khanda, held); this.weapon.castShadow = this.weapon.receiveShadow = true; this.weapon.customDepthMaterial = depth.still;
    const A = HUMAN_SPEC.armDir, g = HUMAN_SPEC.grip; this.weapon.position.set(-A[0] * g[0] - A[1] * g[1], A[1] * g[0] - A[0] * g[1], 0); this.weapon.rotation.set(Math.PI / 2, Math.atan2(A[1], -A[0]), 0);
    this.rig.bones[this.rig.i('hand.R')].add(this.weapon);
    this.blade = new Ribbon(96, 0.2, new THREE.Color(...arm.trail), 0); this.eye = new Ribbon(96, 0.34, new THREE.Color(1.6, 0.5, 0.1), 1);
    scene.add(this.blade.mesh, this.eye.mesh);
    this.ghosts = new Ghosts(scene, geoLo, this.rig.skeleton, ghostN);
    const specs: ChainSpec[] = CLOTHS.flatMap(c => Array.from({ length: c.cols }, (_, i): ChainSpec => ({ bones: Array.from({ length: c.rows }, (_, j) => `${c.name}${i}_${j}`), anchor: c.anchor, tip: V(...c.at(colU(c, i), 1)), stiff: c.stiff, group: c.cols > 1 ? c.name : c.name + i, wind: c.name === 'cape' ? 1.5 : 0.8, drag: c.name === 'cape' ? 1.6 : 1.2 })));
    specs.push({ bones: ['braid1', 'braid2', 'braid3', 'braid4'], anchor: 'head', tip: V(0.008, 1.06, -0.145), stiff: 0.05, group: 'braid', wind: 0.3, drag: 0.8 });
    this.chains = new Chains(this.rig, specs, [{ a: 'hips', b: 'chest', r: 0.145 }, { a: 'chest', b: 'neck', r: 0.135 }, { a: 'thigh.L', b: 'shin.L', r: 0.105 }, { a: 'thigh.R', b: 'shin.R', r: 0.105 }, { a: 'shin.L', b: 'foot.L', r: 0.075 }, { a: 'shin.R', b: 'foot.R', r: 0.075 }, { a: 'upperArm.L', b: 'foreArm.L', r: 0.07 }, { a: 'upperArm.R', b: 'foreArm.R', r: 0.07 }]);
  }
  /** After a teleport. */
  reset() { this.footing.reset(); this.blade.clear(); this.eye.clear(); this.dis.value = 0; this.guardK = 0; this.chains.reset(); this.wasGait = false; this.tipPrev.set(0, -99, 0); }
  private locomotion(m: Motor, out: Pose, dt: number) {
    const s = m.speed, ph = this.gait.phase * Math.PI * 2, run = sst(2.2, 4.6, s), mv = sst(0.1, 1.0, s), spr = sst(5.4, 6.8, s);
    const calm = sst(1.2, 3.2, m.calm), br = Math.sin(this.time * 1.7);
    for (let i = 0; i < N; i++) { const idle = this.arm.ready[i] + (this.arm.rest[i] - this.arm.ready[i]) * calm, mo = WALKP[i] + (RUNP[i] - WALKP[i]) * run; out[i] = idle + (mo - idle) * mv; }
    const add = (c: Ch, v: number) => { out[IX[c]] += v; };
    // breath and weight shift at rest
    add('sp', br * 1.1 * (1 - mv)); add('hy', br * 0.004 * (1 - mv)); add('re', br * 0.8 * (1 - mv)); add('nw', Math.sin(this.time * 0.43) * 4 * (1 - mv) * calm); add('hx', Math.sin(this.time * 0.6) * 0.008 * (1 - mv));
    // walk: a rolling swagger. run: driving and level
    const w = mv * (1 - run), r = mv * run, c = Math.cos(ph), c2 = Math.cos(ph * 2), s1 = Math.sin(ph);
    add('hy', -c2 * (0.016 * w) + Math.cos(ph * 2 + 1.1) * 0.032 * r); add('hx', s1 * 0.028 * w + s1 * 0.012 * r);
    add('hw', c * (9 * w + 13 * r)); add('hr', -s1 * (4.5 * w + 3 * r)); add('sw', -c * (13 * w + 20 * r)); add('sr', s1 * (3.5 * w + 2 * r)); add('nw', c * (5 * w + 8 * r)); add('nr', -s1 * 2 * w);
    add('la', -c * (26 * w + 46 * r)); add('le', (Math.abs(c) * 8) * w + c * 26 * r); add('ll', -0.1 * r * (0.5 + 0.5 * c)); add('ra', c * (6 * w + 8 * r)); add('re', c * 5 * r); add('be', Math.sin(ph * 2) * 1.5 * w - 5 * spr); add('sp', 5 * spr); add('hp', 5 * spr);
    add('hr', this.lean * mv); add('sr', this.lean * 0.6 * mv);
    // guard: the upper body belongs to the weapon, the hips keep walking
    this.guardK += ((m.guarding ? 1 : 0) - this.guardK) * Math.min(1, dt * (m.guarding ? 26 : 12)); const g = this.guardK;
    if (g > 0.005) { const G = this.arm.guard; for (let i = 0; i < N; i++) { if (FEET[i] && mv > 0.3) continue; const k = LOWER[i] ? g * (1 - 0.55 * mv) : g; out[i] += (G[i] - out[i]) * k; } add('sp', br * 0.8 * g); }
  }
  update(dt: number, m: Motor, t: number) {
    this.time = t; const p = this.pose;
    let dy = m.yaw - this.yawPrev; dy -= Math.round(dy / 6.2832) * 6.2832; this.yawPrev = m.yaw; this.lean += ((-dy / Math.max(dt, 1e-3)) * Math.min(1, m.speed / 5) * 3.2 - this.lean) * Math.min(1, dt * 8); this.lean = Math.max(-16, Math.min(16, this.lean));
    const inClip = m.state === 'clip' && m.clip, key = inClip ? 'c' + m.started : 'loco';
    this.locomotion(m, this.tmp, dt);
    if (inClip) sampleClip(m.clip!, m.t, this.tmp, this.src); else this.src.set(this.tmp);
    if (key !== this.source) { const far = Math.abs(p[IX.hy] - this.src[IX.hy]); // a mid-air cancel needs longer to come down
      const turn = Math.abs(p[IX.hw] + p[IX.sw] - this.src[IX.hw] - this.src[IX.sw]);
      this.inert.start(this.src, null, Math.max(inClip ? m.clip!.blend ?? 0.12 : 0.26, /^(hurt|down|block|parry)$/.test(m.clip?.name ?? '') ? 0 : far * 0.26, /^(hurt|down|block|parry)$/.test(m.clip?.name ?? '') ? 0 : Math.min(0.24, turn / 390))); this.source = key; }
    p.set(this.src); this.inert.apply(p, dt);

    this.group.position.set(m.x, 0, m.z); this.group.rotation.y = m.yaw + p[IX.tw] * Math.PI / 180; this.group.updateMatrixWorld(true);
    const root = this.group.matrixWorld, L = this.body.limbs.footL, R = this.body.limbs.footR;
    const gaiting = !inClip && m.speed > 0.35;
    if (gaiting) {
      if (!this.wasGait) { this.gait.reset(this.footing.world); this.gait.phase = this.stepped ? 0.1 : 0.6; this.stepped = !this.stepped; }
      const run = sst(2.2, 4.6, m.speed), k = Math.min(1, m.speed / 1.6), rest = [V(0.085, 0.09, 0.02 - 0.05 * run), V(-0.085, 0.09, 0.02 - 0.05 * run)].map(v => v.applyMatrix4(root));
      const stride = (1.42 + (2.75 - 1.42) * run + Math.max(0, m.speed - 5.3) * 0.2) * (0.45 + 0.55 * k);
      this.gait.update(dt, V(m.vx, 0, m.vz), stride, 0.62 - 0.35 * run, 0.07 + 0.2 * run, rest, 28 + 58 * run);
      const inv = root.clone().invert(); L.copy(this.gait.pos[0]).applyMatrix4(inv); R.copy(this.gait.pos[1]).applyMatrix4(inv);
      p[IX.flp] = this.gait.pitch[0]; p[IX.frp] = this.gait.pitch[1]; L.y += Math.max(0, Math.sin(p[IX.flp] * 0.01745)) * 0.15; R.y += Math.max(0, Math.sin(p[IX.frp] * 0.01745)) * 0.15;
      if (run > 0.6) for (const i of this.gait.landed) this.fx.puffs.emit(this.gait.pos[i], 2, 0.5, 0.7, t);
      this.footing.adopt(this.gait.pos[0], this.gait.pos[1]);
    } else {
      this.body.footTargets(p, L, R); this.footing.update(L, R, root, dt, p[IX.air], 0.09);
    }
    this.wasGait = gaiting;
    // never let the hips outrun the planted feet
    let over = 0; for (const f of [L, R]) { const reach = 0.83, hipY = 0.92 + p[IX.hy], d = Math.hypot(f.x, f.z, hipY - f.y); if (d > reach) over = Math.max(over, Math.min(0.14, (d - reach) * 0.9)); }
    this.drop += (over - this.drop) * Math.min(1, dt * 22); p[IX.hy] -= this.drop;
    this.body.solve(p);
    const sp = Math.hypot(m.vx, m.vz); this.chains.update(root, dt, t, 1.1, -0.5, sp * 0.05); this.rig.apply(); this.group.updateMatrixWorld(true);

    // --- trails and embers
    this.weapon.localToWorld(this.tip.set(0, this.arm.blade[1], 0)); this.weapon.localToWorld(this.base.set(0, this.arm.blade[0], 0));
    this.tipSpeed += (Math.min(60, this.tip.distanceTo(this.tipPrev) / Math.max(dt, 1e-3)) - this.tipSpeed) * 0.6; if (this.tipPrev.y > -90) this.tipVel.copy(this.tip).sub(this.tipPrev).divideScalar(Math.max(dt, 1e-3)); this.tipPrev.copy(this.tip);
    const hot = inClip && !!m.clip!.hit, hitEnd = hot ? (m.clip!.hits ?? [m.clip!.hit!]).at(-1)![1] : 0;
    this.blade.push(this.base, this.tip, hot ? sst(5, 15, this.tipSpeed) * sst(m.clip!.hit![0] - 0.07, m.clip!.hit![0] - 0.02, m.t) * sst(hitEnd + 0.12, hitEnd + 0.03, m.t) * (m.clip!.reel ? 1.5 : 1) : 0, t); this.blade.update(t);
    const hb = this.rig.bones[this.rig.i('head')]; this.eyeW.set(0.032, 0.067, 0.085); hb.localToWorld(this.eyeW);
    const ew = sst(3.5, 8, sp) * 0.5 + (hot ? 0.25 : 0); const up = V(0, 0.0075, 0); this.eye.push(this.eyeW.clone().sub(up), this.eyeW.clone().add(up), ew, t); this.eye.update(t);
    // the blade tip scraping stone
    if (!hot && this.tip.y < 0.09 && this.tipSpeed > 0.7 && Math.random() < Math.min(0.75, this.tipSpeed * 0.16)) this.fx.sparks.emit(V(this.tip.x, 0.03, this.tip.z), V(-m.vx * 0.1, 0.5, -m.vz * 0.1), 2, 1.5 + this.tipSpeed * 0.25, 1.2, 0.45, t);
    if (hot && this.tipSpeed > 12 && Math.random() < 0.8) this.fx.sparks.emit(this.tip, V(0, 0.3, 0), 2, 0.9, 1.6, -0.9, t);
    const charging = inClip && m.clip!.name === this.arm.charge ? Math.min(1, m.t / 1.2) : 0, want = 0.35 + this.fireK * 0.75 + charging * 1.1 + (hot ? 0.35 : 0) + (m.calm < 2 ? 0.15 : 0);
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
      if (e === 'fx:dust') this.fx.puffs.emit(V(m.x, 0, m.z), 8, 1.4, 1.0, t);
      if (e === 'fx:crescent') { this.shake = 0.3; this.fx.sparks.emit(this.tip, dirOf(0, 60), 40, 4, 1.8, 0.8, t); }
      if (e === 'fx:flare') { this.ember = 1.5; for (const h of ['hand.L', 'hand.R']) { const q = V(); this.rig.bones[this.rig.i(h)].localToWorld(q); this.fx.sparks.emit(q, V(0, 1, 0), 12, 0.8, 1.5, -1.6, t); } }
      if (e === 'fx:flick') this.fx.sparks.emit(this.tip, V(Math.sin(m.yaw - 1.4), -0.1, Math.cos(m.yaw - 1.4)), 26, 5, 0.9, 0.5, t);
      if (e === 'fx:scrape') this.fx.sparks.emit(V(this.tip.x, 0.03, this.tip.z), V(Math.sin(m.yaw) * 0.7, 0.6, Math.cos(m.yaw) * 0.7), 10, 3, 0.9, 0.5, t);
    }
    // Cinder Rush: body to ash and back, a burning wall where it passed
    const rush = inClip && m.clip!.name === 'rush', dead = inClip && m.clip!.name === 'die';
    const dw = rush ? sst(0.05, 0.12, m.t) * sst(0.5, 0.34, m.t) : dead ? sst(1.5, 2.9, m.t) : 0; this.dis.value = rush || dead ? dw : Math.max(0, this.dis.value - dt * 6); this.shadow.castShadow = this.dis.value < 0.5;
    const on = rush && m.t > 0.06 && m.t < 0.42; if (on) { for (let d = m.speed * dt; d > 0; d -= 0.42) { const sx = m.vx / (m.speed || 1), sz = m.vz / (m.speed || 1); this.fx.bursts.add('pillar', V(m.x - sx * d, -0.04, m.z - sz * d), 1.1 + Math.random() * 0.5, 1.0 + Math.random() * 0.25, t); } }
    if (on) { for (let i = 0; i < 3; i++) this.fx.sparks.emit(V(m.x - m.vx * dt * i / 3, 0.2 + Math.random() * 1.5, m.z - m.vz * dt * i / 3), V(0, 0.5, 0), 5, 1.2, 1.6, -1.7, t); }
    if (dead && m.t > 1.4 && m.t < 3) this.fx.sparks.emit(V(m.x, 0.3 + Math.random() * 1.0, m.z), V(0.2, 0.7, 0), 2, 0.7, 1.4, -2, t);
    this.flash.value.w *= Math.exp(-dt * 7); this.flashAt.value.set(m.x, 1.15, m.z, 0.8);
    if (this.ghostT > 0) { const b = this.ghostT; this.ghostT -= dt; if (Math.floor(b / 0.07) !== Math.floor(this.ghostT / 0.07)) this.ghosts.snap(t); }
    this.ghosts.update(t); this.shake *= Math.exp(-dt * 6);
  }
}
