// Arena pieces. All origin-centred on the floor unless noted.
import { Field, add, any, ball, box, clamp, cone, curve, cyl, ell, fbm, lerp3, mix, mul, noise, ridged, rng, sstep, tube, type V3 } from '../sdf.ts';
import fs from 'node:fs';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';

async function bake(f: Field, voxel: number, mat: number, tris: number, reach: number, mask?: (x: number, y: number, z: number, n: V3) => number): Promise<Mesh> {
  const q: Baked = meshField(f, { voxel, mat, mask }); bakeAO(q.mesh, [q.sample], reach); return decimate(q.mesh, tris);
}
/** Weathering: broad erosion, chipped edges, pitting. */
const erode = (a: number, seed: number) => (x: number, y: number, z: number) =>
  a * (0.9 * fbm(x * 1.7 + seed, y * 1.7, z * 1.7, 3) + 0.55 * Math.max(0, fbm(x * 5 + seed, y * 5, z * 5, 3) - 0.08) * 3 + 0.12 * noise(x * 24, y * 24, z * 24));

/** Carved temple pillar, 6.4 m: square base, sixteen-sided shaft, bands, bracket capital. `broken` snaps it. */
export async function pillar(seed: number, broken: number): Promise<Mesh> {
  const f = new Field(0.015);
  f.put(box([0, 0.16, 0], [0.78, 0.16, 0.78], 0.04)).put(box([0, 0.42, 0], [0.66, 0.12, 0.66], 0.05)).put(cyl([0, 0.62, 0], 0.64, 0.1, 0.06, 16));
  f.put(box([0, 1.2, 0], [0.5, 0.52, 0.5], 0.03));
  for (let s = 0; s < 4; s++) { // niches with a worn seated figure
    const a = s * Math.PI / 2, c = Math.cos(a), n = Math.sin(a), R = (x: number, y: number, z: number): V3 => [x * c + z * n, y, -x * n + z * c];
    f.put(box(R(0, 1.2, 0.5), s % 2 ? [0.09, 0.36, 0.27] : [0.27, 0.36, 0.09], 0.05), { op: 'sub', k: 0.02 });
    f.put(ell(R(0, 1.0, 0.43), s % 2 ? [0.07, 0.08, 0.2] : [0.2, 0.08, 0.07]), { k: 0.05 }).put(ell(R(0, 1.18, 0.42), [0.1, 0.15, 0.1]), { k: 0.05 }).put(ball(R(0, 1.4, 0.43), 0.075), { k: 0.03 });
  }
  f.put(cyl([0, 1.78, 0], 0.56, 0.07, 0.05, 16)).put(cyl([0, 3.3, 0], 0.44, 1.5, 0.02, 16));
  for (const y of [2.05, 2.9, 3.05, 4.2]) f.put(cyl([0, y, 0], 0.5, 0.055, 0.045));
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + Math.PI / 16; f.put(cone([Math.cos(a) * 0.475, 2.98, Math.sin(a) * 0.475], [Math.cos(a) * 0.475, 2.96, Math.sin(a) * 0.475], 0.05, 0.05), { k: 0.02 }); f.put(cone([Math.cos(a) * 0.47, 3.2, Math.sin(a) * 0.47], [Math.cos(a) * 0.47, 4.05, Math.sin(a) * 0.47], 0.035, 0.035), { op: 'sub', k: 0.02 }); }
  f.put(cyl([0, 4.85, 0], 0.52, 0.12, 0.08)).put(ell([0, 5.1, 0], [0.66, 0.2, 0.66]), { k: 0.04 }).put(box([0, 5.42, 0], [0.62, 0.13, 0.62], 0.04));
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) f.put(box([x * 0.75, 5.72, z * 0.75], [0.2 + 0.28 * Math.abs(x), 0.17, 0.2 + 0.28 * Math.abs(z)], 0.1), { k: 0.06 }).put(ell([x * 1.08, 5.62, z * 1.08], [0.2, 0.15, 0.2]), { k: 0.06 });
  f.put(box([0, 6.1, 0], [0.85, 0.2, 0.85], 0.04));
  if (broken) f.put(any((x, y, z) => (y - broken - 0.55 * x - 0.3 * z - 0.5 * fbm(x * 2.2 + seed, y, z * 2.2, 3) - 0.25 * ridged(x * 3, 1, z * 3 + seed, 2)) * 0.6), { op: 'int', k: 0.01 });
  f.displace(erode(0.034, seed * 7.3), 0.07);
  const b = broken ? Math.min(6.35, broken + 1.3) : 6.35;
  const q = meshField(f, { voxel: 0.034, mat: 16, bounds: [[-1.45, -0.05, -1.45], [1.45, b, 1.45]] });
  bakeAO(q.mesh, [q.sample], 0.6); return decimate(q.mesh, broken ? 3000 : 4600);
}

/** Eroded wall block, roughly 1.6 x 0.8 x 0.9. */
export async function block(seed: number): Promise<Mesh> {
  const f = new Field(0.02), r = rng(seed);
  f.put(box([0, 0, 0], [0.8 - r() * 0.04, 0.4 - r() * 0.02, 0.45], 0.05));
  for (let i = 0; i < 7; i++) { const s = r() < 0.5 ? -1 : 1, t = r() < 0.5 ? -1 : 1; f.put(ell([s * (0.5 + r() * 0.34), t * 0.44, 0.45 - r() * 0.2], [0.1 + r() * 0.2, 0.05 + r() * 0.1, 0.08 + r() * 0.12], [r(), r(), r()]), { op: 'sub', k: 0.05 }); }
  f.displace(erode(0.045, seed * 3.1), 0.09);
  return bake(f, 0.04, 16, 220, 0.3);
}
export async function rubble(seed: number): Promise<Mesh> {
  const f = new Field(0.02), r = rng(seed + 99);
  f.put(ball([0, 0, 0], 0.5));
  for (let i = 0; i < 9; i++) { const n: V3 = [r() - 0.5, r() - 0.5, r() - 0.5], l = Math.hypot(...n), o = 0.22 + r() * 0.16; f.put(any((x, y, z) => (x * n[0] + y * n[1] + z * n[2]) / l - o), { op: 'int', k: 0.02 }); }
  f.displace(erode(0.04, seed * 5.7), 0.07);
  return bake(f, 0.035, 16, 200, 0.2);
}

/** Ruined shrine tower: stacked curvilinear tiers with ribs, a dark doorway, the top bitten off. 11 m. */
export async function shrine(): Promise<Mesh> {
  const f = new Field(0.05);
  f.put(box([0, 0.35, 0], [3.1, 0.35, 3.1], 0.08)).put(box([0, 0.95, 0], [2.7, 0.3, 2.7], 0.08)).put(box([0, 2.5, 0], [2.2, 1.4, 2.2], 0.08));
  f.put(any((x, y, z) => {
    const t = clamp((y - 3.8) / 7.4), w = 2.35 * Math.pow(1 - t, 0.55) * (1 - 0.1 * t) + 0.25, ax = Math.abs(x), az = Math.abs(z);
    const off = (u: number) => 0.2 * sstep(0.16, 0.2, Math.abs(u - 0.0)) * sstep(0.62, 0.58, u) + 0.0;
    const tier = 0.11 * Math.abs(Math.sin(y * 4.6)) + 0.1 * (1 - sstep(0.0, 0.18, Math.abs((y * 0.732) % 1 - 0.5)));
    const dx = ax - w + tier + off(az / w), dz = az - w + tier + off(ax / w);
    return Math.max(dx, dz, 3.7 - y, y - 11.4) * 0.6;
  }, [0, 7.4, 0], 6));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); f.put(box([c * 2.25, 4.0, s * 2.25], Math.abs(c) > 0.5 ? [0.3, 0.2, 1.1] : [1.1, 0.2, 0.3], 0.06)); for (const o of [-0.95, 0.95]) f.put(cyl([c * 2.4 - s * o, 2.5, s * 2.4 + c * o], 0.22, 1.35, 0.04, 8)); }
  f.put(box([0, 2.1, 2.3], [0.62, 1.15, 1.4], 0.08), { op: 'sub', k: 0.04 });
  for (let i = 0; i < 4; i++) f.put(box([0, 0.14 + i * 0.28, 3.9 - i * 0.28], [1.1, 0.15, 0.9 - i * 0.1], 0.04));
  f.put(any((x, y, z) => (9.2 - 0.5 * x + 0.35 * z + 1.1 * fbm(x * 0.9, y * 0.4, z * 0.9, 3) - y) * -0.6), { op: 'int', k: 0.05 });
  f.put(ell([2.6, 7.4, 1.2], [1.4, 1.7, 1.3]), { op: 'sub', k: 0.2 }).put(ell([-2.2, 4.3, 2.4], [0.8, 0.9, 0.7]), { op: 'sub', k: 0.15 });
  f.displace(erode(0.1, 4), 0.2);
  return bake(f, 0.085, 16, 9500, 1.4);
}

/** Dead banyan: fused buttress trunk, spreading limbs, curtain of aerial roots. Stands behind the court. */
export async function banyan(): Promise<Mesh> {
  const f = new Field(0.28), r = rng(5);
  const add2 = (pts: V3[], r0: number, r1: number, k: number, pw = 1) => { for (let i = 1; i < pts.length; i++) { const a = (i - 1) / (pts.length - 1), c = i / (pts.length - 1); f.put(cone(pts[i - 1], pts[i], mix(r0, r1, Math.pow(a, pw)), mix(r0, r1, Math.pow(c, pw))), { k }); } };
  // fused trunk strands
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + r() * 0.3, R = 2.6 + r() * 1.8, tw = 0.7 + r() * 0.7;
    const pts = curve([[Math.cos(a) * R * 1.5, -0.3, Math.sin(a) * R * 1.5], [Math.cos(a) * R * 0.75, 1.1, Math.sin(a) * R * 0.75], [Math.cos(a + tw * 0.3) * 1.5, 4, Math.sin(a + tw * 0.3) * 1.4], [Math.cos(a + tw * 0.6) * 1.2, 7.5, Math.sin(a + tw * 0.6) * 1.1], [Math.cos(a + tw) * 1.7, 10.5, Math.sin(a + tw) * 1.7]], 14);
    add2(pts, 0.5 + r() * 0.25, 0.38, 0.4);
  }
  const limbs: V3[][] = [];
  for (let i = 0; i < 11; i++) {
    const a = -0.35 + i / 11 * Math.PI * 2 + (r() - 0.5) * 0.4, L = 9 + r() * 7, y0 = 8.2 + r() * 2.6; let p: V3 = [Math.cos(a) * 1.1, y0, Math.sin(a) * 1.1]; const c: V3[] = [p]; let h = a;
    for (let j = 1; j <= 5; j++) { h += (r() - 0.5) * 0.8; p = add(p, [Math.cos(h) * L / 5, 0.25 + (r() - 0.35) * 1.5, Math.sin(h) * L / 5]); c.push(p); }
    const pts = curve(c, 20); limbs.push(pts); add2(pts, 0.85, 0.16, 0.3, 0.8);
    for (let b = 0; b < 4; b++) { const s = pts[6 + Math.floor(r() * 12)]; let q = s, hh = h + (r() - 0.5) * 2.6; const bc: V3[] = [q]; for (let j = 0; j < 4; j++) { hh += (r() - 0.5) * 1.1; q = add(q, [Math.cos(hh) * 1.15, 0.45 + (r() - 0.4) * 0.9, Math.sin(hh) * 1.15]); bc.push(q); } add2(curve(bc, 9), 0.26, 0.045, 0.14); }
  }
  f.displace((x, y, z) => { const a = Math.atan2(z, x); return -0.12 * ridged(a * 4 + noise(x, y * 0.5, z), y * 0.35, 2, 2) * sstep(11, 5, y) + 0.06 - 0.05 * ridged(x * 2.2, y * 0.9, z * 2.2, 2) + 0.03 * noise(x * 6, y * 3, z * 6); }, 0.2);
  fs.writeFileSync('public/baked/banyan.json', JSON.stringify(limbs.map(l => l.map(p => p.map(v => +v.toFixed(2))))));
  const trunk = await bake(f, 0.14, 17, 15000, 1.8);
  return trunk;
}

/** One aerial root clump (a few twisted roots), 7 m tall, hanging from y = 0 downward. Instanced. */
export async function rootClump(seed: number): Promise<Mesh> {
  const f = new Field(0.05), r = rng(seed * 31 + 3);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const L = 3.5 + r() * 3.5, a = r() * 6.28, c: V3[] = [[Math.cos(a) * 0.14, 0.2, Math.sin(a) * 0.14]];
    for (let j = 1; j <= 6; j++) c.push([Math.cos(a + j * 0.7) * (0.13 + r() * 0.16), -L * j / 6, Math.sin(a + j * 0.7) * (0.13 + r() * 0.16)]);
    const R = 0.05 + r() * 0.07; f.put(tube(curve(c, 22), t => R * (1 - t * 0.72) + 0.008), { k: 0.04 });
  }
  f.displace((x, y, z) => -0.012 * ridged(x * 9, y * 2, z * 9, 2) + 0.006, 0.014);
  return bake(f, 0.035, 17, 360, 0.25);
}

/** A shrouded body, hanging upside down by the ankles from y = 0. */
export async function shroud(): Promise<Mesh> {
  const f = new Field(0.09), rp = new Field(0.01);
  f.put(cone([0, -0.35, 0], [0, -0.8, 0], 0.075, 0.125)).put(cone([0, -0.8, 0], [0, -1.25, 0.01], 0.125, 0.185)).put(ell([0, -1.5, 0], [0.225, 0.34, 0.16])).put(ell([0, -1.75, 0], [0.24, 0.16, 0.155])).put(ell([0.01, -2.02, 0.03], [0.115, 0.15, 0.125]), { k: 0.07 });
  for (const s of [1, -1]) f.put(cone([0.2 * s, -1.75, 0.02], [0.14 * s, -1.4, 0.13], 0.06, 0.05));
  f.put(ell([0, -2.03, 0.13], [0.03, 0.045, 0.04]), { op: 'sub', k: 0.04 });
  for (const s of [1, -1]) f.put(ell([0.042 * s, -2.06, 0.13], [0.022, 0.02, 0.03]), { op: 'sub', k: 0.03 });
  f.displace((x, y, z) => { const a = Math.atan2(x, z); const u = y * 9 + Math.sin(a + y * 3) * 0.45 + a * 0.16, q = u - Math.floor(u); return -0.014 * q - 0.018 * ridged(a * 1.6 + y, y * 5, 1, 2) + 0.018 + 0.004 * noise(x * 30, y * 30, z * 30); }, 0.03);
  for (const y of [-0.42, -0.95, -1.38, -1.84]) { const R = y > -0.6 ? 0.1 : y > -1 ? 0.155 : y > -1.5 ? 0.225 : 0.225; for (let k = 0; k < 2; k++) { const p: V3[] = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * 6.283; p.push([Math.sin(a) * R, y - k * 0.035 + 0.02 * Math.sin(a * 2), Math.cos(a) * R * 0.74]); } rp.put(tube(p, () => 0.014)); } }
  rp.put(tube([[0, 0.1, 0], [0.01, -0.2, 0], [0, -0.45, 0]] as V3[], () => 0.018));
  const q = meshField(f, { voxel: 0.016, mat: 18 }), w = meshField(rp, { voxel: 0.011, mat: 11 }); const s = [q.sample, w.sample];
  bakeAO(q.mesh, s, 0.2); bakeAO(w.mesh, s, 0.2);
  // long stray strips of cloth
  return merge([await decimate(q.mesh, 1300), await decimate(w.mesh, 320)]);
}

/** Cremation pyre: crossed logs burnt to char, bones in the ash. */
export async function pyre(): Promise<Mesh> {
  const f = new Field(0.015), bn = new Field(0.01), ash = new Field(0.15), r = rng(17);
  for (let l = 0; l < 5; l++) for (let i = 0; i < 5; i++) {
    if (r() < 0.12) continue; const o = (i - 2) * 0.28 + (r() - 0.5) * 0.12, y = 0.16 + l * 0.21, L = 1.15 + r() * 0.3 - l * 0.08, j = () => (r() - 0.5) * 0.2, R = 0.085 + r() * 0.055;
    f.put(l % 2 ? cone([o, y + j() * 0.3, -L + j()], [o + j(), y + j() * 0.3, L + j()], R, R * 0.9) : cone([-L + j(), y + j() * 0.3, o], [L + j(), y + j() * 0.3, o + j()], R, R * 0.9));
  }
  f.displace((x, y, z) => 0.014 * sstep(0.55, 0.72, ridged(x * 7, y * 7, z * 7, 2)) + 0.012 * fbm(x * 9, y * 9, z * 9, 3), 0.03);
  ash.put(ell([0, 0, 0], [1.75, 0.22, 1.7])).displace((x, y, z) => 0.07 * fbm(x * 2.2, y * 2, z * 2.2, 4), 0.09);
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.9 + r() * 0.5, p: V3 = [Math.cos(a) * d, 0.17, Math.sin(a) * d], q = add(p, [(r() - 0.5) * 0.5, 0.04, (r() - 0.5) * 0.5]); bn.put(cone(p, q, 0.022, 0.018)).put(ball(p, 0.036)).put(ball(q, 0.034)); }
  bn.put(ell([1.2, 0.22, 0.5], [0.1, 0.11, 0.13])).put(ell([1.24, 0.15, 0.6], [0.07, 0.07, 0.07]));
  for (const s of [1, -1]) bn.put(ball([1.24 + s * 0.042, 0.22, 0.625], 0.032), { op: 'sub', k: 0.02 });
  const a = meshField(f, { voxel: 0.034, mat: 19 }), b = meshField(ash, { voxel: 0.07, mat: 21 }), c = meshField(bn, { voxel: 0.018, mat: 20 }), s = [a.sample, b.sample, c.sample];
  for (const q of [a, b, c]) bakeAO(q.mesh, s, 0.4);
  return merge([await decimate(a.mesh, 2400), await decimate(b.mesh, 400), await decimate(c.mesh, 700)]);
}
void lerp3; void mul;
