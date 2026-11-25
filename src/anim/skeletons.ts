// Rest skeletons, shared by the build-time forge and the runtime.
// Every bone has identity rest rotation, so local axes are world axes: +X is the character's left, +Z is forward.
export type P3 = [number, number, number];
import { clothBones } from './cloth.ts';
export interface BoneDef { name: string; parent: string | null; pos: P3 }

const both = (name: string, parent: string, p: P3, shared = false): BoneDef[] => [
  { name: `${name}.L`, parent: shared ? parent : `${parent}.L`, pos: p },
  { name: `${name}.R`, parent: shared ? parent : `${parent}.R`, pos: [-p[0], p[1], p[2]] },
];
const one = (name: string, parent: string | null, pos: P3): BoneDef => ({ name, parent, pos });

/** Left arm direction in the player's A-pose. */
export const ARM_DIR: P3 = [0.643, -0.766, 0];

export const HUMAN: BoneDef[] = [
  one('hips', null, [0, 0.96, 0]),
  one('spine1', 'hips', [0, 1.06, -0.01]),
  one('spine2', 'spine1', [0, 1.2, -0.015]),
  one('chest', 'spine2', [0, 1.34, -0.02]),
  one('neck', 'chest', [0, 1.5, -0.02]),
  one('head', 'neck', [0, 1.6, 0.01]),
  ...both('clav', 'chest', [0.03, 1.45, 0], true),
  ...both('upperArm', 'clav', [0.185, 1.44, -0.01]),
  ...both('foreArm', 'upperArm', [0.371, 1.218, -0.01]),
  ...both('hand', 'foreArm', [0.538, 1.019, -0.01]),
  ...both('thigh', 'hips', [0.095, 0.92, 0], true),
  ...both('shin', 'thigh', [0.1, 0.5, 0.012]),
  ...both('foot', 'shin', [0.105, 0.09, -0.025]),
  ...both('toe', 'foot', [0.112, 0.03, 0.11]),
  one('braid1', 'head', [0, 1.6, -0.12]),
  one('braid2', 'braid1', [0, 1.46, -0.15]),
  one('braid3', 'braid2', [0, 1.32, -0.16]),
  one('braid4', 'braid3', [0, 1.18, -0.15]),
  ...clothBones(),
];

export const KING_ARM: P3 = [0.42, -0.9, 0.11];
export const KING: BoneDef[] = [
  one('hips', null, [0, 1.85, 0]),
  one('spine1', 'hips', [0, 2.08, -0.05]),
  one('spine2', 'spine1', [0, 2.4, -0.13]),
  one('chest', 'spine2', [0, 2.75, -0.2]),
  one('neck', 'chest', [0, 3.16, -0.14]),
  one('neck2', 'neck', [0, 3.32, 0.0]),
  one('head', 'neck2', [0, 3.44, 0.14]),
  ...both('clav', 'chest', [0.1, 3.08, -0.1], true),
  ...both('upperArm', 'clav', [0.43, 3.06, -0.13]),
  ...both('foreArm', 'upperArm', [0.87, 2.12, -0.02]),
  ...both('hand', 'foreArm', [1.33, 1.13, 0.1]),
  ...[0, 1, 2, 3].flatMap(i => {
    const z = 0.1 + (1.5 - i) * 0.055;
    return [...both(`f${i}a`, 'hand', [1.425 + (i === 0 || i === 3 ? -0.01 : 0), 0.92, z]), ...both(`f${i}b`, `f${i}a`, [1.49, 0.73, z * 1.15 + 0.01])];
  }),
  ...both('thumb', 'hand', [1.34, 1.03, 0.2]),
  ...both('thigh', 'hips', [0.19, 1.78, 0.0], true),
  ...both('shin', 'thigh', [0.24, 0.98, 0.07]),
  ...both('foot', 'shin', [0.25, 0.14, -0.06]),
  ...both('toe', 'foot', [0.27, 0.05, 0.22]),
  ...(['hFL', 'hFR', 'hBL', 'hBR'] as const).flatMap(n => {
    const s = n[2] === 'L' ? 1 : -1, f = n[1] === 'F', x = f ? 0.11 * s : 0.1 * s, z = f ? 0.3 : 0.02;
    return [one(n + '1', 'head', [x * 0.9, 3.6, z * 0.9 + 0.02]), one(n + '2', n + '1', [x * 1.3, 3.32, z]), one(n + '3', n + '2', [x * 1.35, 3.0, f ? 0.24 : -0.2])];
  }),
  one('graft1', 'spine2', [-0.23, 2.5, -0.02]),
  one('graft2', 'graft1', [-0.42, 2.28, 0.14]),
];

export const boneIndex = (defs: BoneDef[]) => { const m: Record<string, number> = {}; defs.forEach((b, i) => { m[b.name] = i; }); return m; };
