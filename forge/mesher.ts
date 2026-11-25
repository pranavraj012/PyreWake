// Sparse surface nets -> projection -> skin weights -> AO/curvature -> decimation.
import { MeshoptSimplifier } from 'meshoptimizer';
import { Field, type Prim, type V3, clamp, norm } from './sdf.ts';

export interface Mesh { pos: number[]; nrm: number[]; si: number[]; sw: number[]; col: number[]; idx: number[] }
export interface Baked { mesh: Mesh; sample: (x: number, y: number, z: number) => number }
export interface MeshOpt {
  voxel: number; mat?: number; soft?: number; smoothSkin?: number; bounds?: [V3, V3];
  mask?: (x: number, y: number, z: number, n: V3) => number; project?: boolean;
}

const B = 8;
export function meshField(f: Field, o: MeshOpt): Baked {
  const h = o.voxel, [lo, hi] = o.bounds ?? f.bounds(h * 3 + f.dispMax);
  const dim = (c: number) => Math.ceil((hi[c] - lo[c]) / h / B) * B + 1;
  const nx = dim(0), ny = dim(1), nz = dim(2);
  const g = new Float32Array(nx * ny * nz).fill(1), at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const hd = h * B * 0.87 + f.dispMax + h;
  const lists = new Map<number, Prim[]>();
  const bx = (nx - 1) / B, by = (ny - 1) / B, bz = (nz - 1) / B;
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    const cx = lo[0] + (i + 0.5) * B * h, cy = lo[1] + (j + 0.5) * B * h, cz = lo[2] + (k + 0.5) * B * h;
    const l = f.near(cx, cy, cz, hd * 1.8);
    const dc = l.some(p => p.op === 'add') ? f.raw(cx, cy, cz, l) : hd * 2;
    const fill = Math.abs(dc) > hd * 1.5;
    if (!fill) lists.set(i + bx * (j + by * k), l);
    const ei = i === bx - 1 ? B : B - 1, ej = j === by - 1 ? B : B - 1, ek = k === bz - 1 ? B : B - 1;
    for (let c = 0; c <= ek; c++) for (let b = 0; b <= ej; b++) for (let a = 0; a <= ei; a++) {
      const I = i * B + a, J = j * B + b, K = k * B + c;
      g[at(I, J, K)] = fill ? dc : f.eval(lo[0] + I * h, lo[1] + J * h, lo[2] + K * h, l);
    }
  }
  const listAt = (x: number, y: number, z: number) => {
    const i = clamp(Math.floor((x - lo[0]) / h / B), 0, bx - 1), j = clamp(Math.floor((y - lo[1]) / h / B), 0, by - 1), k = clamp(Math.floor((z - lo[2]) / h / B), 0, bz - 1);
    const key = i + bx * (j + by * k); let l = lists.get(key);
    if (!l) { l = f.near(lo[0] + (i + 0.5) * B * h, lo[1] + (j + 0.5) * B * h, lo[2] + (k + 0.5) * B * h, hd * 1.8); lists.set(key, l); }
    return l;
  };
  const sample = (x: number, y: number, z: number) => {
    const fx = (x - lo[0]) / h, fy = (y - lo[1]) / h, fz = (z - lo[2]) / h;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= nx - 1 || fy >= ny - 1 || fz >= nz - 1) return 1;
    const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k, q = at(i, j, k), Y = nx, Z = nx * ny;
    const c = (a: number) => (g[a] * (1 - u) + g[a + 1] * u) * (1 - v) + (g[a + Y] * (1 - u) + g[a + Y + 1] * u) * v;
    return c(q) * (1 - w) + c(q + Z) * w;
  };

  // surface nets
  const vid = new Int32Array(g.length).fill(-1), pos: number[] = [], idx: number[] = [];
  const C = [0, 1, nx, nx + 1, nx * ny, nx * ny + 1, nx * ny + nx, nx * ny + nx + 1];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const q = at(i, j, k); let m = 0;
    for (let c = 0; c < 8; c++) if (g[q + C[c]] < 0) m |= 1 << c;
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const da = g[q + C[a]], db = g[q + C[b]]; if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += (a >> 1 & 1) + ((b >> 1 & 1) - (a >> 1 & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; n++;
    }
    vid[q] = pos.length / 3; pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const q = at(i, j, k), s = g[q] < 0, Y = nx, Z = nx * ny;
    if (s !== g[q + 1] < 0) quad(vid[q - Y - Z], vid[q - Z], vid[q], vid[q - Y], !s);
    if (s !== g[q + Y] < 0) quad(vid[q - 1 - Z], vid[q - 1], vid[q], vid[q - Z], !s);
    if (s !== g[q + Z] < 0) quad(vid[q - 1 - Y], vid[q - Y], vid[q], vid[q - 1], !s);
  }

  // project onto the exact surface; normals from the gradient
  const nv = pos.length / 3, nrm = new Array<number>(nv * 3), e = h * 0.5;
  const grad = (x: number, y: number, z: number, l: Prim[], ep: number): V3 => [
    f.eval(x + ep, y, z, l) - f.eval(x - ep, y, z, l), f.eval(x, y + ep, z, l) - f.eval(x, y - ep, z, l), f.eval(x, y, z + ep, l) - f.eval(x, y, z - ep, l)];
  const primOf: Prim[][] = [];
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const l = listAt(x, y, z); primOf.push(l);
    if (o.project !== false) for (let it = 0; it < 2; it++) {
      const d = f.eval(x, y, z, l), G = norm(grad(x, y, z, l, e)), s = clamp(d, -h * 0.5, h * 0.5) * 0.75;
      x -= G[0] * s; y -= G[1] * s; z -= G[2] * s;
    }
    const n = norm(grad(x, y, z, l, e));
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    nrm[v * 3] = n[0]; nrm[v * 3 + 1] = n[1]; nrm[v * 3 + 2] = n[2];
  }

  // skin weights: soft-min over bone distances, then smoothed across the surface
  const bones = 1 + Math.max(0, ...f.prims.map(p => p.bone)), soft = o.soft ?? 0.02;
  let W = new Float32Array(bones > 1 ? nv * bones : 0);
  if (bones > 1) {
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], best = new Map<number, number>(); let mn = 1e9;
      for (const p of primOf[v]) if (p.op === 'add') { const d = p.d(x, y, z); mn = Math.min(mn, d); best.set(p.bone, Math.min(best.get(p.bone) ?? 1e9, d)); }
      let s = 0;
      for (const [b, d] of best) { const w = Math.exp(-(d - mn) / soft); W[v * bones + b] = w; s += w; }
      for (const b of best.keys()) W[v * bones + b] /= s;
    }
    const nb: number[][] = Array.from({ length: nv }, () => []);
    for (let t = 0; t < idx.length; t += 3) for (let a = 0; a < 3; a++) nb[idx[t + a]].push(idx[t + (a + 1) % 3]);
    for (let it = 0; it < (o.smoothSkin ?? 6); it++) {
      const W2 = new Float32Array(W.length);
      for (let v = 0; v < nv; v++) {
        const n = nb[v];
        for (let b = 0; b < bones; b++) { let s = 0; for (const u of n) s += W[u * bones + b]; W2[v * bones + b] = n.length ? W[v * bones + b] * 0.4 + 0.6 * s / n.length : W[v * bones + b]; }
      }
      W = W2;
    }
  }
  const si: number[] = [], sw: number[] = [];
  for (let v = 0; v < nv; v++) {
    const top: [number, number][] = [];
    if (bones === 1) top.push([0, 1]); else for (let b = 0; b < bones; b++) { const w = W[v * bones + b]; if (w > 0.01) top.push([b, w]); }
    top.sort((a, b) => b[1] - a[1]); top.length = Math.min(top.length, 4);
    const s = top.reduce((a, b) => a + b[1], 0) || 1;
    for (let i = 0; i < 4; i++) { si.push(top[i]?.[0] ?? 0); sw.push(top[i] ? top[i][1] / s : 0); }
  }

  // curvature + mask (AO is filled later by bakeAO)
  const col: number[] = [], ch = h * 2;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], l = primOf[v], n: V3 = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    const lap = f.eval(x + ch, y, z, l) + f.eval(x - ch, y, z, l) + f.eval(x, y + ch, z, l) + f.eval(x, y - ch, z, l) + f.eval(x, y, z + ch, l) + f.eval(x, y, z - ch, l) - 6 * f.eval(x, y, z, l);
    let mk = 0;
    if (o.mask) mk = o.mask(x, y, z, n);
    else { let mn = 1e9; for (const p of l) if (p.op === 'add') { const d = p.d(x, y, z); if (d < mn) { mn = d; mk = p.mask; } } }
    col.push(1, clamp(0.5 + lap / ch * 0.35), clamp(mk), o.mat ?? 0);
  }
  return { mesh: { pos, nrm, si, sw, col, idx }, sample };
}

const DIRS: V3[] = [];
for (let i = 0; i < 24; i++) { const y = (i + 0.5) / 24, r = Math.sqrt(1 - y * y), p = i * 2.399963; DIRS.push([Math.cos(p) * r, y, Math.sin(p) * r]); }

export function bakeAO(m: Mesh, samples: Baked['sample'][], reach: number) {
  const nv = m.pos.length / 3;
  for (let v = 0; v < nv; v++) {
    const n: V3 = [m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2]], p: V3 = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
    const t = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [0, n[2], -n[1]]);
    const b: V3 = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
    let occ = 0, wt = 0;
    for (const d of DIRS) {
      const D: V3 = [t[0] * d[0] + n[0] * d[1] + b[0] * d[2], t[1] * d[0] + n[1] * d[1] + b[1] * d[2], t[2] * d[0] + n[2] * d[1] + b[2] * d[2]];
      let vis = 1;
      for (let s = 1; s <= 5; s++) {
        const r = reach * s * s / 25 + reach * 0.03; let q = 1;
        for (const f of samples) q = Math.min(q, f(p[0] + D[0] * r, p[1] + D[1] * r, p[2] + D[2] * r));
        vis = Math.min(vis, clamp(0.15 + q / (r * 0.6)));
      }
      occ += vis * d[1]; wt += d[1];
    }
    m.col[v * 4] = Math.pow(occ / wt, 1.1);
  }
}

export function merge(ms: Mesh[]): Mesh {
  const o: Mesh = { pos: [], nrm: [], si: [], sw: [], col: [], idx: [] };
  for (const m of ms) {
    const b = o.pos.length / 3;
    for (const k of ['pos', 'nrm', 'si', 'sw', 'col'] as const) for (const v of m[k]) o[k].push(v);
    for (const i of m.idx) o.idx.push(i + b);
  }
  return o;
}

export async function decimate(m: Mesh, targetTris: number): Promise<Mesh> {
  await MeshoptSimplifier.ready;
  if (m.idx.length / 3 <= targetTris) return m;
  const nv = m.pos.length / 3, P = new Float32Array(m.pos), A = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) { A[v * 4] = m.nrm[v * 3]; A[v * 4 + 1] = m.nrm[v * 3 + 1]; A[v * 4 + 2] = m.nrm[v * 3 + 2]; A[v * 4 + 3] = m.col[v * 4 + 2]; }
  const [ni] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(m.idx), P, 3, A, 4, [0.35, 0.35, 0.35, 0.3], null, targetTris * 3, 1, []);
  const map = new Map<number, number>(), o: Mesh = { pos: [], nrm: [], si: [], sw: [], col: [], idx: [] };
  for (const i of ni) {
    let j = map.get(i);
    if (j === undefined) {
      j = map.size; map.set(i, j);
      for (let c = 0; c < 3; c++) { o.pos.push(m.pos[i * 3 + c]); o.nrm.push(m.nrm[i * 3 + c]); }
      for (let c = 0; c < 4; c++) { o.si.push(m.si[i * 4 + c]); o.sw.push(m.sw[i * 4 + c]); o.col.push(m.col[i * 4 + c]); }
    }
    o.idx.push(j);
  }
  return o;
}
