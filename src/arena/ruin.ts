// The court coming apart: fractured stone on simple rigid bodies, falling pillars, levered slabs, and scars the floor keeps.
import * as THREE from 'three';
import type { Tier } from '../core/quality.ts';
import type { Dust } from '../render/fx.ts';
import type { Fx } from '../render/impact.ts';
import { SCARS } from '../render/surface.ts';
import { shadowOnly } from '../render/shadowProxy.ts';
import { FALL, makeProps, type Prop } from './props.ts';
/** Boats are the fifth carving: its whole and stand-in, and its pieces are the last of `bits`. */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0), R = Math.random, rr = (a: number, b: number) => a + (b - a) * R();
interface Bit { c: [number, number, number]; h: [number, number, number] }
interface Body { bone: THREE.Bone; h: THREE.Vector3; p: THREE.Vector3; q: THREE.Quaternion; v: THREE.Vector3; w: THREE.Vector3; awake: boolean; still: number; size: number; heard: boolean }
interface Wreck { prop: Prop; mesh: THREE.SkinnedMesh; inv: THREE.Quaternion; bodies: Body[]; fixed: number; fall: { t: number; yaw: number; axis: THREE.Vector3; pivot: THREE.Vector3; rest: { p: THREE.Vector3; q: THREE.Quaternion }[] } | null }
export interface RuinKit { boat?: { whole: THREE.BufferGeometry; xs: THREE.BufferGeometry }; stele: THREE.BufferGeometry; steleXs: THREE.BufferGeometry; pillars: THREE.BufferGeometry[]; pillarsXs: THREE.BufferGeometry[]; bits: THREE.BufferGeometry[]; info: Bit[][]; shards: THREE.BufferGeometry[]; stone: THREE.Material; loose: THREE.Material; depth: { inst: THREE.Material; skin: THREE.Material }; tier: Tier }

export class Ruin {
  group = new THREE.Group(); props: Prop[]; /** Where lamps still burn. */ lamps: { p: THREE.Vector3; lit: boolean; id: number }[] = []; fx!: Fx; dust!: Dust; /** Told when a piece of stone lands hard. */ heard: (x: number, z: number, size: number) => void = () => { }; /** Told when a lamp goes out or is restored. */ onLamp: (i: number, lit: boolean) => void = () => { };
  shake = 0; private k: RuinKit; private whole: THREE.InstancedMesh[] = []; private where = new Map<number, [THREE.InstancedMesh, THREE.InstancedMesh, number, THREE.Matrix4]>(); private wrecks = new Map<number, Wreck>();
  private shards: THREE.InstancedMesh[] = []; private shardI = 0; private rising: { m: THREE.InstancedMesh; i: number; t: number; p: THREE.Vector3; q: THREE.Quaternion; s: number }[] = []; private scarI = 0; private loose: { m: THREE.InstancedMesh; i: number; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; v: THREE.Vector3; w: THREE.Vector3; hold: number }[] = []; private kept = new Map<string, [THREE.InstancedMesh, number, THREE.Matrix4]>();

  constructor(k: RuinKit, props: Prop[] = makeProps()) {
    this.k = k; this.props = props; const all = (f: (p: Prop) => boolean, g: THREE.BufferGeometry, xs: THREE.BufferGeometry) => {
      const list = this.props.filter(f), make = (q: THREE.BufferGeometry, m: THREE.Material) => new THREE.InstancedMesh(q, m, list.length), o = make(g, k.stone), sh = shadowOnly(make, xs, k.depth.inst);
      o.receiveShadow = true; o.customDepthMaterial = k.depth.inst; o.frustumCulled = false;
      list.forEach((p, i) => { const M = new THREE.Matrix4().compose(V(p.x, -0.03, p.z), new THREE.Quaternion().setFromAxisAngle(UP, p.yaw), V(1, 1, 1)); o.setMatrixAt(i, M); sh.setMatrixAt(i, M); this.where.set(p.id, [o, sh, i, M]); }); this.group.add(o, sh); this.whole.push(o);
    };
    all(p => p.kind === 'lamp', k.stele, k.steleXs); for (let s = 0; s < 3; s++) all(p => p.kind === 'pillar' && p.shape === s, k.pillars[s], k.pillarsXs[s]); if (k.boat) all(p => p.kind === 'boat', k.boat.whole, k.boat.xs);
    this.props.forEach(p => { if (p.kind === 'lamp') this.lamps.push({ p: V(p.x, 3.05, p.z), lit: true, id: p.id }); });
    // every wreck exists from the start, unseen: nothing is built in the middle of a fight
    for (const p of this.props) {
      const n = p.kind === 'lamp' ? 0 : p.kind === 'boat' ? 4 : p.shape + 1, mesh = new THREE.SkinnedMesh(k.bits[n], k.loose), bones = k.info[n].map(b => { const o = new THREE.Bone(); o.position.fromArray(b.c); mesh.add(o); return o; });
      mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones)); mesh.position.set(p.x, -0.03, p.z); mesh.rotation.y = p.yaw; mesh.castShadow = mesh.receiveShadow = true; mesh.customDepthMaterial = k.depth.skin; mesh.frustumCulled = false; mesh.visible = false; mesh.updateMatrixWorld(true); this.group.add(mesh);
      const q = new THREE.Quaternion().setFromAxisAngle(UP, p.yaw);
      this.wrecks.set(p.id, { prop: p, mesh, inv: q.clone().invert(), fall: null, fixed: 0, bodies: bones.map((bone, i) => { const h = V(...k.info[n][i].h); return { bone, h, p: V(), q: new THREE.Quaternion(), v: V(), w: V(), awake: false, still: 0, size: Math.cbrt(h.x * h.y * h.z), heard: false }; }) });
    }
    const N = k.tier.name === 'phone' ? 26 : 60; for (const g of k.shards) { const o = new THREE.InstancedMesh(g, k.stone, N); o.receiveShadow = true; o.customDepthMaterial = k.depth.inst; o.frustumCulled = false; o.count = 0; this.group.add(o); this.shards.push(o); }
  }
  /** Draw everything once at load. */
  warm(on: boolean) { for (const w of this.wrecks.values()) w.mesh.visible = on ? true : w.prop.broken; for (const s of this.shards) s.count = on ? 1 : Math.min(this.shardI >> 1, s.instanceMatrix.count); }
  private hide(p: Prop) { const [o, sh, i] = this.where.get(p.id)!, z = new THREE.Matrix4().makeScale(0, 0, 0); for (const m of [o, sh]) { m.setMatrixAt(i, z); m.instanceMatrix.needsUpdate = true; } }
  private swap(p: Prop) {
    const w = this.wrecks.get(p.id)!, n = p.kind === 'lamp' ? 0 : p.kind === 'boat' ? 4 : p.shape + 1; this.hide(p); w.mesh.visible = true; w.fall = null; const q0 = new THREE.Quaternion().setFromAxisAngle(UP, p.yaw);
    w.bodies.forEach((b, i) => { b.p.fromArray(this.k.info[n][i].c).applyQuaternion(q0).add(w.mesh.position); b.q.copy(q0); b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.awake = false; b.still = 0; b.heard = false; this.put(w, b); }); return w;
  }
  private put(w: Wreck, b: Body) { b.bone.position.copy(b.p).sub(w.mesh.position).applyQuaternion(w.inv); b.bone.quaternion.copy(w.inv).multiply(b.q); b.bone.updateMatrix(); }
  /** A blow on stone. `at` is where it bit. */
  struck(p: Prop, power: number, dx: number, dz: number, broken: boolean, t: number) {
    const s = V(p.x - dx * p.r, p.kind === 'lamp' ? 1.2 : 1.4, p.z - dz * p.r), back = V(-dx, 0.5, -dz); this.fx.sparks.emit(s, back, 14 + power * 8, 4, 1.6, 0.6, t); this.dust.emit(s, 3, 0.6, 0.5, 1.2, t);
    if (!broken) return; const w = this.swap(p); if (p.kind === 'pillar') return; w.fixed = p.kind === 'boat' ? 0 : 1;
    // a lamp goes over with its fire in it
    w.bodies.forEach((b, i) => { if (i < w.fixed) return; const up = b.p.y / p.h, k = 1.2 + power * 0.5; b.awake = true; b.v.set(dx * k * rr(0.5, 1.2) + rr(-0.8, 0.8), rr(0.2, 1.4) * up + power * 0.2, dz * k * rr(0.5, 1.2) + rr(-0.8, 0.8)); b.w.set(dz * rr(1, 4) + rr(-2, 2), rr(-2, 2), -dx * rr(1, 4) + rr(-2, 2)); });
    const L = p.kind === 'lamp' ? this.lamps.find(l => l.id === p.id) : undefined; if (L?.lit) { L.lit = false; this.onLamp(this.lamps.indexOf(L), false); const f = V(p.x + dx * 1.6, 0, p.z + dz * 1.6); for (let i = 0; i < 3; i++) this.fx.bursts.add('fire', L.p.clone().add(V(dx * i * 0.5, -i * 0.6, dz * i * 0.5)), 1.4, 0.6, t + i * 0.08, i); for (let i = 0; i < 3; i++) this.fx.bursts.add('pillar', V(f.x + rr(-0.6, 0.6), 0, f.z + rr(-0.6, 0.6)), rr(0.7, 1.2), 1.1, t + 0.35 + i * 0.09); this.fx.sparks.emit(L.p, V(dx, 0.3, dz), 50, 4, 1.6, 1, t); this.fx.sparks.emit(f, V(0, 0.8, 0), 40, 2, 2, -2, t + 0.4); this.scar(2, f.x, f.z, 1.3, 0, 0, 1); }
    this.dust.emit(V(p.x, 0.4, p.z), 9, 1.8, 1.1, 2.2, t); this.shake = Math.max(this.shake, 0.35);
  }
  /** The foot of a temple pillar has gone. */
  topple(p: Prop, yaw: number, t: number) {
    const w = this.wrecks.get(p.id)!; if (!w.mesh.visible) this.swap(p); const d = V(Math.sin(yaw), 0, Math.cos(yaw)); w.fixed = w.bodies.filter(b => b.p.y < 0.75).length; const pivot = V(p.x + d.x * 0.55, 0.7, p.z + d.z * 0.55), axis = V(d.z, 0, -d.x);
    w.fall = { t: 0, yaw, axis, pivot, rest: w.bodies.map(b => ({ p: b.p.clone(), q: b.q.clone() })) }; this.fx.sparks.emit(V(p.x, 0.8, p.z), V(-d.x, 0.5, -d.z), 40, 5, 1.8, 0.6, t); this.dust.emit(V(p.x, 0.5, p.z), 8, 1.4, 0.9, 1.8, t); this.shake = Math.max(this.shake, 0.4);
  }
  /** It has come down. */
  fell(p: Prop, yaw: number, t: number) {
    const w = this.wrecks.get(p.id)!, f = w.fall; if (!f) return; const d = V(Math.sin(yaw), 0, Math.cos(yaw)), L = FALL.len(p); this.lean(w, 1); w.fall = null;
    w.bodies.forEach((b, i) => { if (b.p.y < 0.75 && i < w.fixed) return; const far = (b.p.x - p.x) * d.x + (b.p.z - p.z) * d.z; b.awake = true; b.v.set(d.x * rr(0.4, 1.6) + rr(-1.3, 1.3), -2 - far * 0.35, d.z * rr(0.4, 1.6) + rr(-1.3, 1.3)); b.w.copy(f.axis).multiplyScalar(rr(1, 4)).add(V(rr(-1.5, 1.5), rr(-2, 2), rr(-1.5, 1.5))); });
    const n = Math.round(L * 1.6); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n * L, q = V(p.x + d.x * u, 0.1, p.z + d.z * u); this.dust.emit(q, 2, 1.8, 1.2, rr(1.8, 3), t + u * 0.01); this.fx.sparks.emit(q, V(0, 0.8, 0), 7, 4, 2, 0.7, t); }
    this.fx.bursts.add('ground', V(p.x + d.x * L * 0.6, 0.06, p.z + d.z * L * 0.6), L * 1.1, 0.6, t, 0, 0.6, 0.4, 0.2); this.scar(0, p.x + d.x * L * 0.8, p.z + d.z * L * 0.8, 2.2, 0, 0, 0); this.slabs(p.x + d.x * L * 0.75, p.z + d.z * L * 0.75, 1.4, 5); this.shake = 1;
  }
  private lean(w: Wreck, u: number) { const f = w.fall!, a = Math.pow(u, 2.7) * 1.5, q = new THREE.Quaternion().setFromAxisAngle(f.axis, a); w.bodies.forEach((b, i) => { if (i < w.fixed) return; b.p.copy(f.rest[i].p).sub(f.pivot).applyQuaternion(q).add(f.pivot); b.q.copy(q).multiply(f.rest[i].q); this.put(w, b); }); }
  /** 0 crater, 1 gouge along yaw, 2 scorch. `heat` glows and cools. */
  scar(kind: 0 | 1 | 2, x: number, z: number, r: number, yaw = 0, len = 0, heat = 0.6) { const n = SCARS.a.value.length; SCARS.a.value[this.scarI].set(x, z, r, kind); SCARS.b.value[this.scarI].set(yaw, len, heat, R() * 9); this.scarI = (this.scarI + 1) % n; }
  /** Slabs levered up around a blow. */
  slabs(x: number, z: number, r: number, n: number) {
    for (let k = 0; k < n; k++) { const m = this.shards[this.shardI % this.shards.length], cap = m.instanceMatrix.count, i = Math.floor(this.shardI / this.shards.length) % cap, a = k / n * 6.283 + rr(-0.3, 0.3), d = r * rr(0.75, 1.15), o = V(Math.cos(a), 0, Math.sin(a)); this.shardI++; m.count = Math.max(m.count, i + 1);
      const q = new THREE.Quaternion().setFromAxisAngle(V(o.z, 0, -o.x), -rr(0.25, 0.8)).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rr(0, 6.28))); this.rising.push({ m, i, t: 0, p: V(x + o.x * d, rr(0.02, 0.12), z + o.z * d), q, s: rr(0.5, 1.05) }); }
  }
  /** Take a still instance and let it fall: a hanging root, the top of a wall. */
  drop(m: THREE.InstancedMesh, i: number, v: THREE.Vector3, hold = 0) { const id = m.uuid + i; if (this.kept.has(id)) return; const M = new THREE.Matrix4(), p = V(), q = new THREE.Quaternion(), s = V(); m.getMatrixAt(i, M); M.decompose(p, q, s); this.kept.set(id, [m, i, M]); this.loose.push({ m, i, p, q, s, v: v.clone(), w: V(rr(-0.6, 0.6), rr(-0.6, 0.6), rr(-0.6, 0.6)), hold }); }
  restore() {
    for (const p of this.props) { const [o, sh, i, M] = this.where.get(p.id)!; for (const m of [o, sh]) { m.setMatrixAt(i, M); m.instanceMatrix.needsUpdate = true; } const w = this.wrecks.get(p.id)!; w.mesh.visible = false; w.fall = null; w.bodies.forEach(b => { b.awake = false; }); }
    this.lamps.forEach((l, i) => { l.lit = true; this.onLamp(i, true); }); for (const a of SCARS.a.value) a.z = 0; for (const s of this.shards) s.count = 0; this.shardI = this.scarI = 0; this.rising.length = this.loose.length = 0; for (const [m, i, M] of this.kept.values()) { m.setMatrixAt(i, M); m.instanceMatrix.needsUpdate = true; } this.kept.clear();
  }
  /** `feet`: whatever is walking through the rubble. */
  step(dt: number, t: number, feet: { x: number; z: number; r: number; push: number }[]) {
    this.shake *= Math.exp(-dt * 5); for (const b of SCARS.b.value) b.z *= Math.exp(-dt * 0.85); if (dt <= 0) return;
    for (const w of this.wrecks.values()) {
      if (!w.mesh.visible) continue; if (w.fall) { w.fall.t += dt; this.lean(w, Math.min(1, w.fall.t / FALL.time)); continue; }
      for (let i = 0; i < w.bodies.length; i++) {
        const b = w.bodies[i]; if (i < w.fixed && !b.awake) continue;
        for (const f of feet) { const dx = b.p.x - f.x, dz = b.p.z - f.z, d = Math.hypot(dx, dz), m = f.r + b.size * 0.8; if (d < m && b.p.y < 1.4) { const out = (m - d) * (b.size < 0.3 ? 0.2 : 0.12); b.p.x += dx / (d || 1) * out; b.p.z += dz / (d || 1) * out; const k = f.push * (1 - d / m) / (0.5 + b.size * 2); b.v.x += dx / (d || 1) * k; b.v.z += dz / (d || 1) * k; b.w.x += dz / (d || 1) * k; b.w.z -= dx / (d || 1) * k; b.awake = true; b.still = 0; } }
        if (!b.awake) continue; b.v.y -= 15 * dt; b.p.addScaledVector(b.v, dt); const wl = b.w.length(); if (wl > 1e-3) b.q.premultiply(new THREE.Quaternion().setFromAxisAngle(b.w.clone().divideScalar(wl), wl * dt));
        // rests on its own box
        const e = new THREE.Matrix4().makeRotationFromQuaternion(b.q).elements, foot = (Math.abs(e[1]) * b.h.x + Math.abs(e[5]) * b.h.y + Math.abs(e[9]) * b.h.z) * 0.82;
        if (b.p.y < foot) { b.p.y = foot; const hit = -b.v.y; if (hit > 1.6) { if (!b.heard || hit > 3) { this.heard(b.p.x, b.p.z, b.size); b.heard = true; } this.dust.emit(V(b.p.x, 0.1, b.p.z), 1, 0.7, 0.7, 1.3, t); this.fx.sparks.emit(V(b.p.x, 0.05, b.p.z), UP, 3, 2, 2, 0.5, t); } b.v.y = hit > 0.8 ? hit * 0.2 : 0; const fr = Math.exp(-dt * 7); b.v.x *= fr; b.v.z *= fr; b.w.multiplyScalar(Math.exp(-dt * 9)); }
        // pieces of one pillar keep out of each other
        for (let j = 0; j < w.bodies.length; j++) { if (j === i) continue; const o = w.bodies[j], dx = b.p.x - o.p.x, dy = b.p.y - o.p.y, dz = b.p.z - o.p.z, d = Math.hypot(dx, dy, dz) || 1e-3, m = (b.size + o.size) * 0.78; if (d < m) { const k = (m - d) * 0.35; b.p.x += dx / d * k; b.p.z += dz / d * k; if (dy > 0) b.p.y += dy / d * k; b.v.x += dx / d * k * 4; b.v.z += dz / d * k * 4; } }
        if (b.v.lengthSq() < 0.02 && b.w.lengthSq() < 0.03 && b.p.y <= foot + 0.02) { if ((b.still += dt) > 0.4) b.awake = false; } else b.still = 0; this.put(w, b);
      }
    }
    for (const r of this.rising) { r.t += dt; const u = Math.min(1, r.t / 0.16), k = u * (2 - u); r.m.setMatrixAt(r.i, new THREE.Matrix4().compose(V(r.p.x, -0.25 + (r.p.y + 0.25) * k, r.p.z), new THREE.Quaternion().slerp(r.q, k), V(r.s, r.s, r.s))); r.m.instanceMatrix.needsUpdate = true; } this.rising = this.rising.filter(r => r.t < 0.16);
    for (const l of this.loose) { if ((l.hold -= dt) > 0) continue; l.v.y -= 9 * dt; l.p.addScaledVector(l.v, dt); const wl = l.w.length(); l.q.premultiply(new THREE.Quaternion().setFromAxisAngle(l.w.clone().divideScalar(wl || 1), wl * dt)); if (l.p.y < 0.35) { if (l.v.y < -2) { this.dust.emit(V(l.p.x, 0.1, l.p.z), 3, 0.9, 0.8, 1.6, t); this.heard(l.p.x, l.p.z, 0.4); } l.p.y = 0.35; l.v.set(0, 0, 0); l.w.set(0, 0, 0); l.hold = 1e9; } l.m.setMatrixAt(l.i, new THREE.Matrix4().compose(l.p, l.q, l.s)); l.m.instanceMatrix.needsUpdate = true; } this.loose = this.loose.filter(l => l.hold < 1e8);
  }
  /** How many stones are still moving, for the soak test. */
  get moving() { let n = 0; for (const w of this.wrecks.values()) if (w.mesh.visible) for (const b of w.bodies) if (b.awake) n++; return n; }
}
