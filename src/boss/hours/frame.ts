// The frames of the third boss, shared by the forge (which bakes them) and the runtime (which moves them). No rendering imports.
// The Sister is the human frame (the hero's, without his cape and braid) scaled to her height, with a hanging skirt of bone chains
// and linen strips from both forearms. The Pall has no limbs: a root, the small head at the top, and a ring of chains in the hem.
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

/** The Pall, in metres. The dome from its crown (v = 0) to the hem (v = 1); the hem's ring of chains; the head at the top. */
export const PALL = { H: 5.0, R: 4.0, neck: 0.32, head: 5.32, cols: 16, rows: 2 };
export function domeAt(u: number, v: number, fold = 1): P3 {
  const a = u * Math.PI * 2, s = Math.sin(v * Math.PI / 2), c = Math.cos(v * Math.PI / 2), r0 = PALL.neck + (PALL.R - PALL.neck) * Math.pow(s, 1.25);
  const w = 1 + fold * (0.07 * Math.sin(a * 11 + 2.2 * v + 0.3) + 0.045 * Math.sin(a * 7.3 + 1.1 - 3 * v) + 0.03 * Math.sin(a * 19 + v * 5) + 0.035 * Math.sin(a * 3 + 0.5) + 0.012 * Math.sin(a * 41 + v * 13) + 0.008 * Math.sin(a * 67 - v * 21)) * Math.pow(v, 0.8) + fold * 0.015 * Math.sin(v * 31 + a * 2) * v;
  const drag = fold * 0.12 * Math.max(0, Math.sin(a * 5 + 1.3)) * Math.pow(v, 6);
  return [Math.sin(a) * r0 * w, Math.max(0.01, PALL.H * Math.pow(c, 0.85) + 0.02 - drag), Math.cos(a) * r0 * w];
}
const HEM_V = [0.5, 0.75];
export const PALL_BONES: BoneDef[] = [
  { name: 'root', parent: null, pos: [0, 0, 0] }, { name: 'crown', parent: 'root', pos: [0, PALL.H, 0] }, { name: 'head', parent: 'crown', pos: [0, PALL.head, 0] },
  ...Array.from({ length: PALL.cols }, (_, i) => HEM_V.map((v, j): BoneDef => ({ name: `hem${i}_${j}`, parent: j ? `hem${i}_${j - 1}` : 'root', pos: domeAt(i / PALL.cols, v, 0) }))).flat(),
];
export function domeWeights(idx: Record<string, number>, u: number, v: number): [number, number][] {
  const C = PALL.cols, x = ((u % 1) + 1) % 1 * C, i = Math.floor(x) % C, i2 = (i + 1) % C, g = x - Math.floor(x);
  const m = new Map<number, number>(), put = (n: string, w: number) => { if (w > 0.001) m.set(idx[n], (m.get(idx[n]) ?? 0) + w); };
  const cl = (x: number) => Math.max(0, Math.min(1, x)), top = cl(1 - v / 0.25), rest = 1 - top, hk = cl((v - 0.33) / 0.2), r = cl((v - HEM_V[0]) / (HEM_V[1] - HEM_V[0]));
  put('crown', top); put('root', rest * (1 - hk));
  for (const [c, cw] of [[i, 1 - g], [i2, g]] as const) { put(`hem${c}_0`, rest * hk * cw * (1 - r)); put(`hem${c}_1`, rest * hk * cw * r); }
  return [...m];
}
