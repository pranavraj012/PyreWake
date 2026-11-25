// Thin parametric geometry the voxel mesher is bad at: cloth sheets, hair strands.
import type { Mesh } from './mesher.ts';
import { type V3, add, clamp, cross, mul, norm, sub, rng, noise } from './sdf.ts';

const empty = (): Mesh => ({ pos: [], nrm: [], si: [], sw: [], col: [], idx: [] });

export interface SheetOpt { nu: number; nv: number; mat: number; tatter?: number; weights: (u: number, v: number) => [number, number][]; seed?: number; /** Material of the inside face. */ inner?: number }
/** Double-sided cloth sheet from a point function; v runs down the cloth. */
export function sheet(f: (u: number, v: number) => V3, o: SheetOpt): Mesh {
  const m = empty(), { nu, nv } = o, seed = o.seed ?? 1;
  const p: V3[] = [], cut = (u: number) => 1 - (o.tatter ?? 0) * clamp(0.45 + 0.75 * noise(u * 4, seed, 0) + 0.4 * noise(u * 13, seed, 3) + 0.22 * noise(u * 41, seed, 7));
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) p.push(f(i / nu, j / nv * cut(i / nu)));
  const at = (i: number, j: number) => p[clamp(j, 0, nv) * (nu + 1) + clamp(i, 0, nu)];
  for (const side of [1, -1]) {
    const base = m.pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const q = at(i, j), n = mul(norm(cross(sub(at(i, j + 1), at(i, j - 1)), sub(at(i + 1, j), at(i - 1, j)))), side);
      m.pos.push(...add(q, mul(n, 0.003))); m.nrm.push(...n);
      const w = o.weights(i / nu, j / nv).sort((a, b) => b[1] - a[1]).slice(0, 4), s = w.reduce((a, b) => a + b[1], 0);
      for (let c = 0; c < 4; c++) { m.si.push(w[c]?.[0] ?? 0); m.sw.push(w[c] ? w[c][1] / s : 0); }
      const l = add(add(at(i - 1, j), at(i + 1, j)), mul(q, -2)), cv = -(l[0] * n[0] + l[1] * n[1] + l[2] * n[2]);
      m.col.push(clamp((side > 0 ? 0.95 : 0.55) + cv * 12, 0.35, 1), clamp(0.5 + cv * 25 + (j === nv ? 0.3 : 0)), j / nv, side > 0 ? o.mat : o.inner ?? o.mat);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (side > 0) m.idx.push(a, c, b, b, c, d); else m.idx.push(a, b, c, b, d, c);
    }
  }
  return m;
}

/** Tapered flattened strand along a polyline. */
export function strand(pts: V3[], width: number, flat: number, mat: number, bone: (t: number) => [number, number][], sides = 5): Mesh {
  const m = empty(), n = pts.length - 1;
  for (let j = 0; j <= n; j++) {
    const t = j / n, dir = norm(sub(pts[Math.min(j + 1, n)], pts[Math.max(j - 1, 0)]));
    const a = norm(cross(dir, Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), b = cross(a, dir), w = width * Math.pow(1 - t, 0.6) * (0.7 + 0.3 * Math.sin(t * 6));
    for (let s = 0; s < sides; s++) {
      const an = s / sides * Math.PI * 2, nr = norm(add(mul(a, Math.cos(an) * flat), mul(b, Math.sin(an))));
      m.pos.push(...add(pts[j], add(mul(a, Math.cos(an) * w), mul(b, Math.sin(an) * w * flat)))); m.nrm.push(...nr);
      const bw = bone(t); for (let c = 0; c < 4; c++) { m.si.push(bw[c]?.[0] ?? 0); m.sw.push(bw[c]?.[1] ?? 0); }
      m.col.push(0.45 + 0.5 * t, 0.5, t, mat);
    }
    if (j < n) for (let s = 0; s < sides; s++) { const p = j * sides + s, q = j * sides + (s + 1) % sides; m.idx.push(p, p + sides, q, q, p + sides, q + sides); }
  }
  return m;
}
export { rng };
