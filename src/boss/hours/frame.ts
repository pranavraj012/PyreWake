// The frames of the third boss, shared by the forge (which bakes them) and the runtime (which moves them). No rendering imports.
// The Sister is the human frame (the hero's, without his cape and braid) scaled to her height, with a hanging skirt of bone chains
// and linen strips from both forearms. The Pall is the same frame grown huge, in a long robe, with six chained arms of linen.
import { HUMAN, type BoneDef, type P3 } from '../../anim/skeletons.ts';

/** The human frame is about 1.79 m to the crown; she stands 2.6 m. */
export const SISTER_SCALE = 1.45;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Her skirt: twelve chains of three round the waist, a heavy bell to the floor. u goes once round (0 = forward), v from the waist down. */
export const SKIRT = { cols: 12, rows: 3, top: 1.02 };
export function skirtAt(u: number, v: number, fold = 1): P3 {
  const a = u * Math.PI * 2, rx = mix(0.165, 0.44, Math.pow(v, 0.85)), rz = mix(0.13, 0.4, Math.pow(v, 0.85)), w = 1 + fold * (0.055 * Math.sin(a * 9 + 0.4) + 0.03 * Math.sin(a * 17 + 2.1)) * Math.pow(v, 0.7);
  return [Math.sin(a) * rx * w, SKIRT.top - (SKIRT.top - 0.012) * v, -0.01 + Math.cos(a) * rz * w];
}
/** Two strips of grave-linen hang from each forearm. */
export const STRIPS = [{ side: 'L', k: 0, at: 0.45 }, { side: 'L', k: 1, at: 0.7 }, { side: 'R', k: 0, at: 0.45 }, { side: 'R', k: 1, at: 0.7 }] as const;
export const STRIP_ROWS = 4, STRIP_LEN = 0.56;
export function stripRoot(side: 'L' | 'R', at: number): P3 { const s = side === 'L' ? 1 : -1; return [mix(0.371, 0.538, at) * s, mix(1.218, 1.019, at) - 0.025, -0.035]; }

const core = HUMAN.filter(b => !b.name.startsWith('braid') && !b.name.includes('_'));
export const SISTER: BoneDef[] = [
  ...core,
  ...Array.from({ length: SKIRT.cols }, (_, i) => Array.from({ length: SKIRT.rows }, (_, j): BoneDef => ({ name: `skirt${i}_${j}`, parent: j ? `skirt${i}_${j - 1}` : 'hips', pos: skirtAt(i / SKIRT.cols, j / SKIRT.rows, 0) }))).flat(),
  ...STRIPS.flatMap(s => Array.from({ length: STRIP_ROWS }, (_, j): BoneDef => { const r = stripRoot(s.side, s.at); return { name: `strip${s.side}${s.k}_${j}`, parent: j ? `strip${s.side}${s.k}_${j - 1}` : 'foreArm.' + s.side, pos: [r[0], r[1] - STRIP_LEN * j / STRIP_ROWS, r[2]] }; })),
];

/** Skin weights for a point of the skirt: the hips at the waist, the two nearest chains below, wrapping round. */
export function skirtWeights(idx: Record<string, number>, u: number, v: number): [number, number][] {
  const C = SKIRT.cols, R = SKIRT.rows, x = ((u % 1) + 1) % 1 * C, i = Math.floor(x) % C, i2 = (i + 1) % C, g = x - Math.floor(x), q = v * R - 0.5, j = Math.max(0, Math.min(R - 1, Math.floor(q))), f = Math.max(0, Math.min(1, q - j)), j2 = Math.min(R - 1, j + 1), anchor = Math.max(0, 1 - v * R * 1.6);
  const m = new Map<number, number>(), put = (n: string, w: number) => { if (w > 0.001) m.set(idx[n], (m.get(idx[n]) ?? 0) + w); };
  put('hips', anchor); for (const [k, kw] of [[i, 1 - g], [i2, g]] as const) for (const [r, rw] of [[j, 1 - f], [j2, f]] as const) put(`skirt${k}_${r}`, kw * rw * (1 - anchor));
  return [...m];
}
export function stripWeights(idx: Record<string, number>, side: 'L' | 'R', k: number, v: number): [number, number][] {
  const q = v * STRIP_ROWS - 0.3, j = Math.max(0, Math.min(STRIP_ROWS - 1, Math.floor(q))), f = Math.max(0, Math.min(1, q - j)), j2 = Math.min(STRIP_ROWS - 1, j + 1), a = Math.max(0, 1 - v * STRIP_ROWS * 2);
  const m = new Map<number, number>(), put = (n: string, w: number) => { if (w > 0.001) m.set(idx[n], (m.get(idx[n]) ?? 0) + w); };
  put('foreArm.' + side, a); put(`strip${side}${k}_${j}`, (1 - f) * (1 - a)); put(`strip${side}${k}_${j2}`, f * (1 - a)); return [...m];
}

/** The Pall: the Sister's own frame grown to 4.7 m and lifted off the floor on her smoke, in a robe that pools below her, with six arms of burning linen
 *  from her shoulders and back. The core and robe bones are named and ordered as hers, so her skirt's weights serve the robe. */
export const PALL_SCALE = 2.6, PALL_HOVER = 0.42;
/** The robe: the skirt's twelve chains of three, a wider bell that falls past her feet. */
export function robeAt(u: number, v: number, fold = 1): P3 {
  const a = u * Math.PI * 2, e = Math.pow(v, 0.8), rx = mix(0.17, 0.66, e), rz = mix(0.14, 0.6, e), w = 1 + fold * (0.07 * Math.sin(a * 9 + 0.4) + 0.04 * Math.sin(a * 17 + 2.1) + 0.03 * Math.sin(a * 5 + 1.2)) * Math.pow(v, 0.7);
  return [Math.sin(a) * rx * w, SKIRT.top - (SKIRT.top + 0.12) * v, -0.02 + Math.cos(a) * rz * w];
}
/** How far the Pall's drawn hem reaches from her centre, in metres: the widest point of the robe's foot, at the runtime scale. The sim's hits and the view share it. */
export const PALL_HEM = (() => { let r = 0; for (let i = 0; i < 360; i++) { const p = robeAt(i / 360, 1); r = Math.max(r, Math.hypot(p[0], p[2])); } return +(r * PALL_SCALE).toFixed(2); })();
/** Six arms of linen: where each leaves her, on which bone, and the way it lies at rest (out, back and down). */
export const ARMS = [1, -1].flatMap(s => [
  { root: [0.12 * s, 1.43, -0.1], bone: 'chest', dir: [0.62 * s, 0.25, -0.74] }, { root: [0.2 * s, 1.31, -0.1], bone: 'chest', dir: [0.92 * s, -0.05, -0.38] }, { root: [0.13 * s, 1.15, -0.1], bone: 'spine2', dir: [0.66 * s, -0.42, -0.62] },
] as { root: P3; bone: string; dir: P3 }[]);
export const ARM_ROWS = 8, ARM_LEN = 3.5;
export function armRest(k: number, j: number): P3 { const A = ARMS[k], l = Math.hypot(...A.dir), t = ARM_LEN * j / ARM_ROWS; return [A.root[0] + A.dir[0] / l * t, A.root[1] + A.dir[1] / l * t, A.root[2] + A.dir[2] / l * t]; }
export const PALL_BONES: BoneDef[] = [
  ...core,
  ...Array.from({ length: SKIRT.cols }, (_, i) => Array.from({ length: SKIRT.rows }, (_, j): BoneDef => ({ name: `skirt${i}_${j}`, parent: j ? `skirt${i}_${j - 1}` : 'hips', pos: robeAt(i / SKIRT.cols, j / SKIRT.rows, 0) }))).flat(),
  ...ARMS.flatMap((A, k) => Array.from({ length: ARM_ROWS }, (_, j): BoneDef => ({ name: `arm${k}_${j}`, parent: j ? `arm${k}_${j - 1}` : A.bone, pos: armRest(k, j) }))),
];
/** Skin weights along an arm: its root bone at the shoulder, then the two nearest links. */
export function armWeights(idx: Record<string, number>, k: number, v: number): [number, number][] {
  const q = v * ARM_ROWS, j = Math.max(0, Math.min(ARM_ROWS - 1, Math.floor(q))), f = Math.max(0, Math.min(1, q - j)), j2 = Math.min(ARM_ROWS - 1, j + 1), a = Math.max(0, 1 - v * ARM_ROWS * 1.5);
  const m = new Map<number, number>(), put = (n: string, w: number) => { if (w > 0.001) m.set(idx[n], (m.get(idx[n]) ?? 0) + w); };
  put(ARMS[k].bone, a); put(`arm${k}_${j}`, (1 - f) * (1 - a)); put(`arm${k}_${j2}`, f * (1 - a)); return [...m];
}
