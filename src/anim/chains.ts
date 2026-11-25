// Verlet bone chains: cape, tabard, sash, braid, wet hair. World-space, so gravity is right even upside down.
import * as THREE from 'three';
import type { Rig } from './rig.ts';

export interface ChainSpec { bones: string[]; anchor: string; tip: THREE.Vector3; stiff: number; group: string; wind: number; drag: number }
export interface Capsule { a: string; b: string; r: number }
const V = () => new THREE.Vector3();

interface Chain { spec: ChainSpec; ix: number[]; anchor: number; rest: THREE.Vector3[]; p: THREE.Vector3[]; o: THREE.Vector3[]; len: number[] }

export class Chains {
  private c: Chain[]; private rig: Rig; private caps: { a: number; b: number; r: number }[]; private init = false;
  private links: [number, number, number][] = []; // chain, chain, rest distance per row
  private mat = new THREE.Matrix4(); private q = new THREE.Quaternion();
  gravity = 9.8; private A = V(); private B = V(); private t = V();
  private capW: [THREE.Vector3, THREE.Vector3, number][];

  constructor(rig: Rig, specs: ChainSpec[], caps: Capsule[]) {
    this.rig = rig; this.caps = caps.map(k => ({ a: rig.i(k.a), b: rig.i(k.b), r: k.r })); this.capW = caps.map(k => [V(), V(), k.r]);
    this.c = specs.map(s => { const ix = s.bones.map(b => rig.i(b)), rest = [...ix.map(i => rig.rest[i].clone()), s.tip.clone()]; return { spec: s, ix, anchor: rig.i(s.anchor), rest, p: rest.map(V), o: rest.map(V), len: rest.slice(1).map((r, i) => r.distanceTo(rest[i])) }; });
    for (let i = 1; i < this.c.length; i++) if (this.c[i].spec.group === this.c[i - 1].spec.group) this.links.push([i - 1, i, 0]);
  }
  /** Run after the body is solved; writes rig locals for the chain bones. */
  update(root: THREE.Matrix4, dt: number, time: number, windX: number, windZ: number, velHint = 0) {
    const r = this.rig; this.mat.copy(root).invert();
    for (let i = 0; i < this.caps.length; i++) { this.capW[i][0].copy(r.pos[this.caps[i].a]).applyMatrix4(root); this.capW[i][1].copy(r.pos[this.caps[i].b]).applyMatrix4(root); }
    const home = (c: Chain, j: number, out: THREE.Vector3) => out.copy(c.rest[j]).sub(r.rest[c.anchor]).applyQuaternion(r.rot[c.anchor]).add(r.pos[c.anchor]).applyMatrix4(root);
    if (!this.init) { for (const c of this.c) c.p.forEach((p, j) => { home(c, j, p); c.o[j].copy(p); }); this.init = true; }
    const n = 2, h = Math.min(dt, 1 / 30) / n;
    for (let s = 0; s < n; s++) {
      for (const c of this.c) {
        home(c, 0, c.p[0]); c.o[0].copy(c.p[0]);
        for (let j = 1; j < c.p.length; j++) {
          const p = c.p[j], o = c.o[j], k = 1 - c.spec.drag * h; const vx = (p.x - o.x) * k, vy = (p.y - o.y) * k, vz = (p.z - o.z) * k; o.copy(p);
          const g = Math.sin(time * 2.3 + p.x * 1.7 + p.z * 1.3 + j * 0.6) * 0.55 + Math.sin(time * 5.1 + p.z * 3.1 + j) * 0.3 + 0.75, w = c.spec.wind * (1 + velHint);
          p.x += vx + windX * g * w * h * h; p.y += vy + (-this.gravity + g * w * 0.25) * h * h; p.z += vz + windZ * g * w * h * h;
          // drift back toward the tailored shape
          if (c.spec.stiff) { home(c, j, this.t); p.lerp(this.t, 1 - Math.exp(-c.spec.stiff * 14 * h * (1.4 - j / c.p.length))); }
        }
      }
      for (let it = 0; it < 4; it++) {
        for (const c of this.c) for (let j = 1; j < c.p.length; j++) {
          const a = c.p[j - 1], b = c.p[j]; this.t.copy(b).sub(a); const L = this.t.length() || 1e-6, f = (L - c.len[j - 1]) / L;
          if (j === 1) b.addScaledVector(this.t, -f); else { a.addScaledVector(this.t, f * 0.4); b.addScaledVector(this.t, -f * 0.6); }
        }
        for (const [x, y] of this.links) { const a = this.c[x], b = this.c[y]; for (let j = 1; j < Math.min(a.p.length, b.p.length); j++) { const want = a.rest[j].distanceTo(b.rest[j]); this.t.copy(b.p[j]).sub(a.p[j]); const L = this.t.length() || 1e-6; const f = L > want * 1.15 ? (L - want * 1.15) / L * 0.5 : L < want * 0.5 ? (L - want * 0.5) / L * 0.5 : 0; a.p[j].addScaledVector(this.t, f); b.p[j].addScaledVector(this.t, -f); } }
        for (const c of this.c) for (let j = 1; j < c.p.length; j++) {
          const p = c.p[j];
          for (const [a, b, rad] of this.capW) {
            this.A.copy(b).sub(a); this.B.copy(p).sub(a); const u = Math.max(0, Math.min(1, this.B.dot(this.A) / (this.A.lengthSq() || 1))); this.t.copy(a).addScaledVector(this.A, u); this.B.copy(p).sub(this.t); const d = this.B.length();
            if (d < rad && d > 1e-5) { p.addScaledVector(this.B, (rad - d) / d); c.o[j].lerp(p, 0.25); }
          }
          if (p.y < 0.025) { p.y = 0.025; c.o[j].x += (p.x - c.o[j].x) * 0.4; c.o[j].z += (p.z - c.o[j].z) * 0.4; }
        }
      }
    }
    // particles -> bone rotations
    for (const c of this.c) {
      const base = r.rot[c.anchor];
      for (let j = 0; j < c.ix.length; j++) {
        this.A.copy(c.rest[j + 1]).sub(c.rest[j]).normalize().applyQuaternion(base);
        this.B.copy(c.p[j + 1]).applyMatrix4(this.mat).sub(this.t.copy(c.p[j]).applyMatrix4(this.mat)).normalize();
        this.q.setFromUnitVectors(this.A, this.B).multiply(base); r.setRot(c.ix[j], this.q);
      }
    }
  }
  reset() { this.init = false; }
}
