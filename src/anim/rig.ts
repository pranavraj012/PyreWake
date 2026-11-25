// Runtime skeleton: FK in character space, plus analytic two-bone IK.
import * as THREE from 'three';
import type { BoneDef } from './skeletons.ts';

const v = () => new THREE.Vector3(), q = () => new THREE.Quaternion();
const T = { a: v(), b: v(), c: v(), d: v(), m: new THREE.Matrix4(), n: new THREE.Matrix4(), q: q() };

export class Rig {
  bones: THREE.Bone[] = [];
  byName: Record<string, number> = {};
  parent: number[] = [];
  rest: THREE.Vector3[] = [];
  /** Character-space rotation and position of each bone this frame. */
  rot: THREE.Quaternion[] = [];
  pos: THREE.Vector3[] = [];
  local: THREE.Quaternion[] = [];
  rootPos: THREE.Vector3;
  skeleton: THREE.Skeleton;
  defs: BoneDef[];

  constructor(defs: BoneDef[]) {
    this.defs = defs;
    defs.forEach((d, i) => {
      const b = new THREE.Bone(); b.name = d.name; this.bones.push(b); this.byName[d.name] = i;
      const p = d.parent ? this.byName[d.parent] : -1; this.parent.push(p);
      this.rest.push(new THREE.Vector3(...d.pos)); this.rot.push(q()); this.pos.push(new THREE.Vector3(...d.pos)); this.local.push(q());
      if (p >= 0) { this.bones[p].add(b); b.position.copy(this.rest[i]).sub(this.rest[p]); } else b.position.copy(this.rest[i]);
    });
    this.rootPos = this.rest[0].clone();
    this.bones[0].updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.bones, this.rest.map(r => new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z)));
  }
  i(name: string) { const k = this.byName[name]; if (k === undefined) throw new Error('no bone ' + name); return k; }
  reset() { for (const l of this.local) l.identity(); this.rootPos.copy(this.rest[0]); this.fk(); }

  /** Recompute character-space transforms from local rotations. */
  fk(from = 0) {
    for (let k = from; k < this.bones.length; k++) {
      const p = this.parent[k];
      if (p < 0) { this.rot[k].copy(this.local[k]); this.pos[k].copy(this.rootPos); }
      else {
        this.rot[k].multiplyQuaternions(this.rot[p], this.local[k]);
        this.pos[k].copy(this.rest[k]).sub(this.rest[p]).applyQuaternion(this.rot[p]).add(this.pos[p]);
      }
    }
  }
  euler(name: string, x: number, y: number, z: number, order: THREE.EulerOrder = 'YXZ') { this.local[this.i(name)].setFromEuler(new THREE.Euler(x, y, z, order)); return this; }
  /** Force a bone's character-space rotation. */
  setRot(k: number, r: THREE.Quaternion) { const p = this.parent[k]; if (p < 0) this.local[k].copy(r); else this.local[k].copy(T.q.copy(this.rot[p]).invert()).multiply(r); this.rot[k].copy(r); }

  /** Rotation taking rest frame (dir, side) to target frame (dir, side). */
  static frame(dir0: THREE.Vector3, side0: THREE.Vector3, dir1: THREE.Vector3, side1: THREE.Vector3, out: THREE.Quaternion) {
    const basis = (m: THREE.Matrix4, d: THREE.Vector3, s: THREE.Vector3) => { const x = d.clone().normalize(), y = s.clone().addScaledVector(x, -s.dot(x)).normalize(); return m.makeBasis(x, y, x.clone().cross(y)); };
    basis(T.m, dir0, side0); basis(T.n, dir1, side1);
    return out.setFromRotationMatrix(T.n.multiply(T.m.transpose()));
  }

  /** Two-bone IK: root->mid->end reaches `target`; the joint bends toward `pole`. */
  ik(root: string, mid: string, end: string, target: THREE.Vector3, pole: THREE.Vector3, restPole: THREE.Vector3) {
    const a = this.i(root), b = this.i(mid), c = this.i(end);
    const R0 = this.rest[b].clone().sub(this.rest[a]), R1 = this.rest[c].clone().sub(this.rest[b]), l0 = R0.length(), l1 = R1.length();
    const A = this.pos[a].clone(), to = target.clone().sub(A); const D = Math.min(Math.max(to.length(), Math.abs(l0 - l1) + 0.01), (l0 + l1) * 0.9985); to.normalize();
    const cosA = (l0 * l0 + D * D - l1 * l1) / (2 * l0 * D), h = l0 * Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const bend = pole.clone().addScaledVector(to, -pole.dot(to)).normalize();
    const B = A.clone().addScaledVector(to, l0 * cosA).addScaledVector(bend, h), C = A.clone().addScaledVector(to, D);
    // the hinge axis is perpendicular to the limb and the bend direction, stable even when straight
    const hinge0 = R0.clone().cross(restPole).normalize(), hinge1 = to.clone().cross(bend).normalize(), r = q();
    this.setRot(a, Rig.frame(R0, hinge0, B.clone().sub(A), hinge1, r));
    this.pos[b].copy(B);
    this.setRot(b, Rig.frame(R1, R1.clone().cross(restPole).normalize(), C.clone().sub(B), hinge1, r));
    this.pos[c].copy(C); this.rot[c].multiplyQuaternions(this.rot[b], this.local[c]);
  }
  /** Copy to the three.js bones. */
  apply() {
    this.bones[0].position.copy(this.rootPos);
    for (let k = 0; k < this.bones.length; k++) this.bones[k].quaternion.copy(this.local[k]);
  }
}
