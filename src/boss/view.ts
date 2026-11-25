// What the director and the scenes need from the picture of a boss. The King's view and the Ferryman's both have it.
import type * as THREE from 'three';
import type { Boss } from './boss.ts';

export interface BossView {
  group: THREE.Group; form: 1 | 2; sim: Boss; /** The weapon, if it has one in its hand. */ cleaver?: THREE.Object3D;
  flash: { value: THREE.Vector4 }; flashAt: { value: THREE.Vector4 }; wounds: { w: { value: THREE.Vector4[] }; n: { value: THREE.Vector3[] } }; dissolve: { value: number }; ember?: { value: number };
  shake: number; steps: number; fxFired: string[]; readonly x: number; readonly z: number;
  show(v: boolean): void; settle(): void; update(dt: number, px: number, pz: number, t: number): void; frozen(t: number): void; flinch(from: number, power: number, at?: THREE.Vector3): void;
  wound(p: THREE.Vector3, slash: THREE.Vector3, toward: THREE.Vector3, heat: number): void; nearest(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3): THREE.Vector3; mark(m: 'cleaver' | 'handL' | 'head', out: THREE.Vector3): THREE.Vector3; hurt(out: THREE.Vector3): THREE.Vector3;
}
