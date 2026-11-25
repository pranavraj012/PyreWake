// Cloth layout shared by the forge (which builds the sheets) and the runtime (which simulates them).
// Each cloth is a set of bone chains (columns) hanging from an anchor bone.
import type { BoneDef, P3 } from './skeletons.ts';

export interface ClothDef { name: string; anchor: string; cols: number; rows: number; mat: number; nu: number; nv: number; tatter: number; seed: number; stiff: number; at: (u: number, v: number) => P3 }
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const tail = (a0: number, a1: number, len: number, flare: number, seed: number, y0 = 1.02) => (u: number, v: number): P3 => {
  const a = mix(a0, a1, u), R = 0.13 + flare * v * (0.5 + 0.5 * v), fold = Math.sin(a * 9 + seed) * 0.013 * (0.3 + v);
  return [Math.sin(a) * (R * 1.2 + fold), y0 - len * v, Math.cos(a) * (R + fold)];
};

export const CLOTHS: ClothDef[] = [
  { name: 'cape', anchor: 'chest', cols: 4, rows: 5, mat: 5, nu: 34, nv: 30, tatter: 0.2, seed: 41, stiff: 0.25, at: (u, v) => {
    const a = mix(1.15, 4.25, u), w = Math.sin(a * 7) * 0.02 * v + Math.sin(a * 13 + 1) * 0.008 * (0.3 + v);
    const rx = 0.225 + 0.1 * v + w, rz = 0.15 + 0.13 * v + w, drop = 0.03 * Math.abs(u - 0.55);
    return [Math.sin(a) * rx, 1.475 - drop - 1.12 * v - 0.05 * Math.cos(u * 6), -0.02 + Math.cos(a) * rz];
  } },
  { name: 'tab', anchor: 'hips', cols: 2, rows: 3, mat: 5, nu: 20, nv: 18, tatter: 0.24, seed: 3, stiff: 0.2, at: tail(-0.42, 0.5, 0.5, 0.07, 3) },
  { name: 'back', anchor: 'hips', cols: 2, rows: 3, mat: 5, nu: 20, nv: 16, tatter: 0.24, seed: 11, stiff: 0.2, at: tail(Math.PI - 1.05, Math.PI + 1.0, 0.5, 0.1, 11) },
  { name: 'sashA', anchor: 'hips', cols: 1, rows: 4, mat: 6, nu: 10, nv: 22, tatter: 0.2, seed: 21, stiff: 0.1, at: tail(0.55, 1.1, 0.74, 0.1, 21) },
  { name: 'sashB', anchor: 'hips', cols: 1, rows: 4, mat: 6, nu: 8, nv: 18, tatter: 0.2, seed: 29, stiff: 0.1, at: tail(0.95, 1.35, 0.56, 0.14, 29, 1.03) },
];
export const colU = (c: ClothDef, i: number) => c.cols === 1 ? 0.5 : i / (c.cols - 1);

export const clothBones = (): BoneDef[] => CLOTHS.flatMap(c => Array.from({ length: c.cols }, (_, i) => Array.from({ length: c.rows }, (_, j): BoneDef => ({
  name: `${c.name}${i}_${j}`, parent: j ? `${c.name}${i}_${j - 1}` : c.anchor, pos: c.at(colU(c, i), j / c.rows),
}))).flat());

/** Bone weights for a point on a cloth. */
export function clothWeights(c: ClothDef, idx: Record<string, number>, u: number, v: number): [number, number][] {
  const out: [number, number][] = [], q = v * c.rows - 0.5, j = Math.max(0, Math.min(c.rows - 1, Math.floor(q))), f = Math.max(0, Math.min(1, q - j)), j2 = Math.min(c.rows - 1, j + 1);
  const x = u * (c.cols - 1), i = Math.max(0, Math.min(c.cols - 2, Math.floor(x))), g = c.cols === 1 ? 0 : x - i, i2 = c.cols === 1 ? i : i + 1;
  const col = c.cols === 1 ? 0 : i, anchor = Math.max(0, 1 - v * c.rows * 1.5);
  const put = (n: string, w: number) => { if (w > 0.001) out.push([idx[n], w]); };
  put(c.anchor, anchor);
  for (const [k, kw] of [[col, 1 - g], [c.cols === 1 ? 0 : i2, g]] as const) for (const [r, rw] of [[j, 1 - f], [j2, f]] as const) if (kw * rw > 0.001) put(`${c.name}${k}_${r}`, kw * rw * (1 - anchor));
  const m = new Map<number, number>(); for (const [b, w] of out) m.set(b, (m.get(b) ?? 0) + w); return [...m];
}
