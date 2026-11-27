// The chain in the Ferryman's chain reward (module A): a taut chain from the anchor to his hand, and when the blade cuts it, two halves that whip back
// on their own ends (a small verlet rope each), fall, lie slack, and fade. Drawn with the river's own link geometry and material.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), STEP = 0.17, DT = 1 / 120;
interface Half { p: THREE.Vector3[]; q: THREE.Vector3[]; /** 0: the first node is pinned to the anchor; 1: to his hand. */ pin: 0 | 1 }

export class RewardChain {
  mesh: THREE.InstancedMesh; broken = false; private halves: Half[] = []; private line: THREE.Vector3[] = []; private acc = 0; private fade = 1; private anchorAt = V(); private handAt = V();
  private M = new THREE.Matrix4(); private Q = new THREE.Matrix4(); private S = new THREE.Vector3(); private X = V(); private Y = V(); private Z = V(); private P = new THREE.Quaternion(); private R = new THREE.Vector3();
  constructor(src: THREE.InstancedMesh, parent: THREE.Object3D) { this.mesh = new THREE.InstancedMesh(src.geometry, src.material, 96); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = false; parent.add(this.mesh); }
  /** The chain, taut, from the anchor to his hand. `shake` is the tremble of the strain. */
  taut(a: THREE.Vector3, h: THREE.Vector3, time: number) {
    this.anchorAt.copy(a); this.handAt.copy(h); this.broken = false; this.fade = 1; const n = Math.min(95, Math.max(3, Math.round(a.distanceTo(h) / STEP))); this.line.length = 0;
    for (let i = 0; i < n; i++) { const u = i / (n - 1); this.line.push(V().lerpVectors(a, h, u)); this.line[i].y += Math.sin(time * 80 + i) * 0.006; }
    this.draw([this.line]);
  }
  /** Where the chain is at u (0 anchor, 1 hand) while it is taut. */
  at(a: THREE.Vector3, h: THREE.Vector3, u: number, out: THREE.Vector3) { return out.lerpVectors(a, h, u); }
  /** The cut at u: two halves, each whipping back toward the end it is held by. */
  cut(a: THREE.Vector3, h: THREE.Vector3, u: number) {
    this.broken = true; this.halves = []; this.acc = 0; this.fade = 1; this.anchorAt.copy(a); this.handAt.copy(h);
    const total = a.distanceTo(h), nA = Math.max(2, Math.round(total * u / STEP)), nH = Math.max(2, Math.round(total * (1 - u) / STEP));
    const build = (from: THREE.Vector3, to: THREE.Vector3, n: number, pin: 0 | 1): Half => {
      const p: THREE.Vector3[] = [], q: THREE.Vector3[] = []; const back = V().subVectors(from, to).normalize(), side = V(-back.z, 0, back.x);
      for (let i = 0; i < n; i++) { const k = i / (n - 1); p.push(V().lerpVectors(from, to, k)); const w = k * k, v = V().addScaledVector(back, 16 * w).addScaledVector(side, (Math.random() - 0.5) * 7 * w); v.y += 5 * w + 1 * k; q.push(p[i].clone().addScaledVector(v, -DT)); }
      return { p, q, pin };
    };
    this.halves.push(build(a, V().lerpVectors(a, h, u), nA, 0), build(h, V().lerpVectors(a, h, u), nH, 1));
  }
  /** Advances the loose halves (fixed steps) and draws them; the chain fades out over `fadeIn` seconds once `fading` is set. */
  step(dt: number, hand: THREE.Vector3, fadeK: number) {
    if (!this.broken) return; this.handAt.copy(hand); this.fade = 1 - fadeK; this.acc += Math.min(dt, 0.05);
    while (this.acc >= DT) { this.acc -= DT; for (const h of this.halves) this.verlet(h); }
    this.draw(this.halves.map(h => h.p));
  }
  private verlet(h: Half) {
    const { p, q } = h, g = -9.8 * DT * DT;
    for (let i = 1; i < p.length; i++) { const x = p[i], o = q[i]; const vx = (x.x - o.x) * 0.992, vy = (x.y - o.y) * 0.992, vz = (x.z - o.z) * 0.992; o.copy(x); x.x += vx; x.y += vy + g; x.z += vz; if (x.y < 0.07) { x.y = 0.07; o.y = x.y + vy * -0.2; o.x = x.x - vx * 0.6; o.z = x.z - vz * 0.6; } }
    p[0].copy(h.pin === 0 ? this.anchorAt : this.handAt); q[0].copy(p[0]);
    for (let it = 0; it < 6; it++) { p[0].copy(h.pin === 0 ? this.anchorAt : this.handAt); for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], d = this.R.subVectors(b, a), l = d.length() || 1e-4, k = (l - STEP) / l; if (i === 1) b.addScaledVector(d, -k); else { a.addScaledVector(d, k * 0.5); b.addScaledVector(d, -k * 0.5); } } }
  }
  private draw(paths: THREE.Vector3[][]) {
    let c = 0; const s = Math.max(0.001, this.fade);
    for (const pts of paths) for (let i = 0; i < pts.length && c < 96; i++) {
      const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)]; this.X.subVectors(b, pr); if (this.X.lengthSq() < 1e-8) this.X.set(1, 0, 0); this.X.normalize();
      this.Z.set(0, 1, 0); if (Math.abs(this.X.y) > 0.9) this.Z.set(1, 0, 0); this.Z.cross(this.X).normalize(); this.Y.crossVectors(this.Z, this.X).normalize();
      if (i & 1) { this.R.copy(this.Y); this.Y.copy(this.Z).negate(); this.Z.copy(this.R); }
      this.Q.makeBasis(this.X, this.Y, this.Z); this.P.setFromRotationMatrix(this.Q); this.M.compose(a, this.P, this.S.set(s, s, s)); this.mesh.setMatrixAt(c++, this.M);
    }
    this.mesh.count = c; this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide() { this.mesh.count = 0; this.broken = false; this.halves = []; }
}
