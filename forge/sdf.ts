// Signed-distance sculpting kit. Everything solid in the game is built from this.
export type V3 = [number, number, number];
export type Sdf = (x: number, y: number, z: number) => number;

export interface Prim { bone: number; d: Sdf; c: V3; r: number; k: number; op: 'add' | 'sub' | 'int'; mask: number }

const P = new Uint8Array(512);
{
  let s = 1337; const a = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < 512; i++) P[i] = a[i & 255];
}
const GX = new Float32Array(256), GY = new Float32Array(256), GZ = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const t = Math.acos(1 - 2 * ((i * 0.618034) % 1)), p = i * 2.399963;
  GX[i] = Math.sin(t) * Math.cos(p); GY[i] = Math.sin(t) * Math.sin(p); GZ[i] = Math.cos(t);
}

export function noise(x: number, y: number, z: number): number {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  x -= X; y -= Y; z -= Z;
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
  const g = (ix: number, iy: number, iz: number) => {
    const h = P[(P[(P[(X + ix) & 255] + Y + iy) & 255] + Z + iz) & 255];
    return GX[h] * (x - ix) + GY[h] * (y - iy) + GZ[h] * (z - iz);
  };
  const a = g(0, 0, 0), b = g(1, 0, 0), c = g(0, 1, 0), d = g(1, 1, 0), e = g(0, 0, 1), f = g(1, 0, 1), h = g(0, 1, 1), i = g(1, 1, 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = h + (i - h) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return (y1 + (y2 - y1) * w) * 1.5;
}
export function fbm(x: number, y: number, z: number, o = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < o; i++) { s += a * noise(x, y, z); x = x * 2.03 + 11.3; y = y * 2.03 - 4.1; z = z * 2.03 + 7.7; a *= 0.5; }
  return s;
}
export function ridged(x: number, y: number, z: number, o = 3) {
  let a = 0.5, s = 0;
  for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(noise(x, y, z))); x = x * 2.1 + 3.1; y = y * 2.1 + 5.7; z = z * 2.1 - 2.3; a *= 0.5; }
  return s;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const clamp = (x: number, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smin = (a: number, b: number, k: number) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** [sdf, centre, boundingRadius] */
export type Shape = [Sdf, V3, number];

export function cone(a: V3, b: V3, ra: number, rb: number): Shape {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz || 1e-9;
  return [(x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2], t = clamp((px * bx + py * by + pz * bz) / bb);
    const qx = px - bx * t, qy = py - by * t, qz = pz - bz * t;
    return Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + (rb - ra) * t);
  }, lerp3(a, b, 0.5), Math.sqrt(bb) / 2 + Math.max(ra, rb)];
}
export const ball = (c: V3, r: number): Shape => [(x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, c, r];

/** Muscle belly: a capsule that swells in the middle. */
export function belly(a: V3, b: V3, r0: number, rm: number, r1 = r0, at = 0.5): Shape {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz || 1e-9;
  return [(x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2], t = clamp((px * bx + py * by + pz * bz) / bb);
    const u = t < at ? t / at : (1 - t) / (1 - at), s = u * u * (3 - 2 * u), e = t < at ? r0 : r1;
    return (Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (e + (rm - e) * s)) * 0.9;
  }, lerp3(a, b, 0.5), Math.sqrt(bb) / 2 + Math.max(r0, rm, r1)];
}

export function rotM([a, b, c]: V3) {
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  return [cb * cc, -cb * sc, sb, ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb, sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb];
}
export const inv = (m: number[], x: number, y: number, z: number): V3 => [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
export const fwd = (m: number[], x: number, y: number, z: number): V3 => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];

/** Oriented ellipsoid; `rot` is radians about x, y, z. */
export function ell(c: V3, r: V3, rot: V3 = [0, 0, 0]): Shape {
  const m = rotM(rot), mn = Math.min(...r);
  return [(x, y, z) => {
    const p = inv(m, x - c[0], y - c[1], z - c[2]);
    const k0 = Math.hypot(p[0] / r[0], p[1] / r[1], p[2] / r[2]);
    if (k0 < 0.02) return -mn;
    const k1 = Math.hypot(p[0] / (r[0] * r[0]), p[1] / (r[1] * r[1]), p[2] / (r[2] * r[2]));
    return k0 * (k0 - 1) / k1;
  }, c, Math.max(...r)];
}
export function box(c: V3, h: V3, round = 0.01, rot: V3 = [0, 0, 0]): Shape {
  const m = rotM(rot);
  return [(x, y, z) => {
    const p = inv(m, x - c[0], y - c[1], z - c[2]);
    const qx = Math.abs(p[0]) - h[0] + round, qy = Math.abs(p[1]) - h[1] + round, qz = Math.abs(p[2]) - h[2] + round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round;
  }, c, Math.hypot(...h)];
}
/** Vertical cylinder, optionally an n-sided prism. */
export function cyl(c: V3, r: number, h: number, round = 0.01, sides = 0): Shape {
  const s = sides ? Math.PI * 2 / sides : 0, ap = sides ? Math.cos(s / 2) : 1;
  return [(x, y, z) => {
    const px = x - c[0], pz = z - c[2]; let d = Math.hypot(px, pz);
    if (sides) { let a = Math.atan2(pz, px); a = ((a % s) + s) % s - s / 2; d *= Math.cos(a); }
    const qx = d - r * ap + round, qy = Math.abs(y - c[1]) - h + round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round;
  }, c, Math.hypot(r, h)];
}
/** Polyline tube with a radius along its length. */
export function tube(pts: V3[], rad: (t: number) => number): Shape {
  const n = pts.length - 1, segs = pts.slice(1).map((b, i) => cone(pts[i], b, rad(i / n), rad((i + 1) / n)));
  let c: V3 = [0, 0, 0]; for (const p of pts) c = add(c, mul(p, 1 / pts.length));
  const r = Math.max(...pts.map((p, i) => len(sub(p, c)) + rad(i / n)));
  return [(x, y, z) => {
    let d = 1e9;
    for (const s of segs) { const lb = Math.hypot(x - s[1][0], y - s[1][1], z - s[1][2]) - s[2]; if (lb < d) { const v = s[0](x, y, z); if (v < d) d = v; } }
    return d;
  }, c, r];
}
export const any = (d: Sdf, c: V3 = [0, 0, 0], r = 1e3): Shape => [d, c, r];

/** Catmull-Rom resample of a control polyline. */
export function curve(ctrl: V3[], n: number): V3[] {
  const out: V3[] = [], m = ctrl.length - 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n * m, s = Math.min(Math.floor(t), m - 1), u = t - s;
    const p0 = ctrl[Math.max(s - 1, 0)], p1 = ctrl[s], p2 = ctrl[s + 1], p3 = ctrl[Math.min(s + 2, m)];
    out.push([0, 1, 2].map(c => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u * u * u)) as V3);
  }
  return out;
}

export interface PrimOpt { k?: number; op?: Prim['op']; mask?: number; bone?: number }
export class Field {
  prims: Prim[] = [];
  disp: Sdf | null = null;
  dispMax = 0;
  k: number;
  bone = 0;
  constructor(k = 0.02) { this.k = k; }
  put(s: Shape, o: PrimOpt = {}) { this.prims.push({ bone: o.bone ?? this.bone, d: s[0], c: s[1], r: s[2], k: o.k ?? this.k, op: o.op ?? 'add', mask: o.mask ?? 0 }); return this; }
  displace(f: Sdf, max: number) { this.disp = f; this.dispMax = max; return this; }
  raw(x: number, y: number, z: number, l: Prim[]) {
    let d = 1e3;
    for (const p of l) { const v = p.d(x, y, z); d = p.op === 'add' ? smin(d, v, p.k) : p.op === 'sub' ? smax(d, -v, p.k) : smax(d, v, p.k); }
    return d;
  }
  eval(x: number, y: number, z: number, l: Prim[] = this.prims) { const d = this.raw(x, y, z, l); return this.disp && Math.abs(d) < 0.5 ? d + this.disp(x, y, z) : d; }
  near(x: number, y: number, z: number, pad: number) {
    return this.prims.filter(p => p.op === 'int' || p.r > 500 || Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.r < pad + p.k);
  }
  bounds(pad: number): [V3, V3] {
    const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
    for (const p of this.prims) if (p.op === 'add' && p.r < 500) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.c[i] - p.r - pad); hi[i] = Math.max(hi[i], p.c[i] + p.r + pad); }
    return [lo, hi];
  }
}
