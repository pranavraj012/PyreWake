// The Waiting House: a hospice of red sandstone on the hill. Rope cots with ash shapes on them, sandstone columns, the cloister's cusped arcade, copper bowls on cords, and the great dial.
import fs from 'node:fs';
import { Field, any, ball, box, cone, curve, cyl, ell, fbm, mix, noise, ridged, rng, sstep, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';

const erode = (a: number, seed: number) => (x: number, y: number, z: number) => a * (0.9 * fbm(x * 1.7 + seed, y * 1.7, z * 1.7, 3) + 0.55 * Math.max(0, fbm(x * 5 + seed, y * 5, z * 5, 3) - 0.08) * 3 + 0.12 * noise(x * 24, y * 24, z * 24));
async function bakeAll(parts: [Field, number, number, number][], reach: number, bounds?: [V3, V3]): Promise<Mesh> {
  const b: Baked[] = parts.map(([f, voxel, mat]) => meshField(f, { voxel, mat, bounds })), s = b.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < b.length; i++) { bakeAO(b[i].mesh, s, reach); out.push(await decimate(b[i].mesh, parts[i][3])); }
  return merge(out);
}
/** The same piece already in pieces, each riding its own bone (see arena.ts shatter); one material. */
async function shatterM(name: string, f: Field, mat: number, lo: V3, hi: V3, seeds: V3[], tris: number, voxel = 0.045): Promise<Mesh> {
  const parts: Mesh[] = [], info: { c: V3; h: V3 }[] = [];
  for (let k = 0; k < seeds.length; k++) {
    const s = seeds[k], g = new Field(0.01); g.put(any((x, y, z) => f.eval(x, y, z)));
    for (let j = 0; j < seeds.length; j++) { if (j === k) continue; const o = seeds[j], n: V3 = [o[0] - s[0], o[1] - s[1], o[2] - s[2]], l = Math.hypot(...n), m: V3 = [(o[0] + s[0]) / 2, (o[1] + s[1]) / 2, (o[2] + s[2]) / 2], u: V3 = [n[0] / l, n[1] / l, n[2] / l], sg = k < j ? 1 : -1; g.put(any((x, y, z) => ((x - m[0]) * u[0] + (y - m[1]) * u[1] + (z - m[2]) * u[2] + sg * (0.12 * fbm(x * 2.6 + 3, y * 2.6, z * 2.6 + 7, 3) + 0.04 * ridged(x * 7, y * 7, z * 7, 2) - 0.02)) * 0.7 + 0.006), { op: 'int', k: 0.005 }); }
    const q = meshField(g, { voxel, mat, bounds: [lo, hi] }); bakeAO(q.mesh, [q.sample], 0.3); const m = await decimate(q.mesh, tris);
    const a: V3 = [9, 9, 9], b: V3 = [-9, -9, -9]; for (let i = 0; i < m.pos.length; i++) { a[i % 3] = Math.min(a[i % 3], m.pos[i]); b[i % 3] = Math.max(b[i % 3], m.pos[i]); }
    info.push({ c: [0, 1, 2].map(i => +((a[i] + b[i]) / 2).toFixed(3)) as V3, h: [0, 1, 2].map(i => +((b[i] - a[i]) / 2).toFixed(3)) as V3 });
    for (let i = 0; i < m.si.length; i++) { m.si[i] = i % 4 ? 0 : k; m.sw[i] = i % 4 ? 0 : 1; } parts.push(m);
  }
  fs.writeFileSync(`public/baked/${name}.json`, JSON.stringify(info)); return merge(parts);
}

// ---------------------------------------------------------------- the cots
/** A rope cot, 1.95 x 0.86 m, its long axis along z; on it an ash shape lying under a sheet of ash. Origin on the floor at its middle. */
function cotFrame(): Field {
  const f = new Field(0.012), H = 0.44;
  for (const [x, z] of [[0.4, 0.94], [-0.4, 0.94], [0.4, -0.94], [-0.4, -0.94]]) f.put(cone([x, 0, z], [x, H + 0.04, z], 0.04, 0.034)).put(ell([x, 0.16, z], [0.048, 0.05, 0.048]), { k: 0.02 });
  for (const x of [0.4, -0.4]) f.put(cone([x, H, -0.98], [x, H, 0.98], 0.032, 0.032));
  for (const z of [0.94, -0.94]) f.put(cone([-0.44, H, z], [0.44, H, z], 0.03, 0.03));
  f.displace((x, y, z) => 0.004 * fbm(x * 12, y * 12, z * 3, 3) + 0.003 * Math.abs(Math.sin(z * 40 + x * 8)), 0.006);
  return f;
}
function ashShape(): Field {
  const f = new Field(0.05);
  // a body lying on its back, sheeted to the crown: head, shoulders, the fall of the chest, knees a little raised, feet
  f.put(ell([0, 0.55, 0.66], [0.11, 0.09, 0.13])).put(ell([0, 0.56, 0.36], [0.24, 0.1, 0.17])).put(ell([0, 0.55, 0.06], [0.21, 0.1, 0.24])).put(ell([0, 0.55, -0.32], [0.2, 0.09, 0.22])).put(ell([0, 0.58, -0.56], [0.17, 0.1, 0.12])).put(ell([0, 0.55, -0.82], [0.17, 0.08, 0.08]));
  // the sheet over it, down to the rope at the sides
  f.put(any((x, y, z) => Math.max(Math.abs(x) - 0.38 - 0.03 * Math.sin(z * 9), y - 0.5 - 0.03 * noise(x * 6, 1, z * 6), 0.455 - y, Math.abs(z) - 0.9) * 0.8, [0, 0.48, 0], 1.0), { k: 0.08 });
  f.displace((x, y, z) => 0.012 * fbm(x * 7, y * 7, z * 7, 3) - 0.008 * ridged(x * 9 + z * 3, y * 9, z * 9, 2), 0.02);
  return f;
}
export async function cot(): Promise<Mesh> {
  const rope = new Field(0.005); rope.put(any((x, y, z) => { const d = Math.max(Math.abs(x) - 0.38, Math.abs(z) - 0.92, Math.abs(y - 0.44) - 0.012); return d; }, [0, 0.44, 0], 1.0));
  rope.displace((x, y, z) => { const a = Math.abs(Math.sin((x + z) * 42)), b = Math.abs(Math.sin((x - z) * 42)); return -0.006 * Math.min(a, b) + 0.002; }, 0.007);
  return bakeAll([[cotFrame(), 0.018, 41, 1300], [rope, 0.02, 11, 700], [ashShape(), 0.028, 39, 1100]], 0.25);
}
export const cotBits = async () => { const f = new Field(0.02); for (const p of [...cotFrame().prims, ...ashShape().prims]) f.prims.push(p); return shatterM('cotBits', f, 39, [-0.6, -0.05, -1.1], [0.6, 0.75, 1.1], [[0.2, 0.3, 0.7], [-0.2, 0.4, 0.4], [0.15, 0.5, 0.0], [-0.2, 0.5, -0.3], [0.2, 0.4, -0.7], [-0.25, 0.2, 0.85], [0.3, 0.2, -0.9]], 160, 0.03); };

// ---------------------------------------------------------------- columns of the court
/** A red sandstone column, 5.6 m: square plinth, a vase base, an octagonal fluted shaft, a hanging-lotus capital and a bracket. `broken` snaps it. */
function colField(seed: number, broken: number): Field {
  const f = new Field(0.015);
  f.put(box([0, 0.2, 0], [0.62, 0.2, 0.62], 0.03)).put(box([0, 0.5, 0], [0.52, 0.1, 0.52], 0.04)).put(ell([0, 0.85, 0], [0.42, 0.3, 0.42]), { k: 0.06 }).put(cyl([0, 1.18, 0], 0.36, 0.06, 0.03, 8));
  f.put(any((x, y, z) => { const r = Math.hypot(x, z), a = Math.atan2(z, x), oct = r * Math.cos(((a % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4) - Math.PI / 8) - 0.3 + 0.012 * Math.pow(Math.abs(Math.sin(a * 12)), 0.5); return Math.max(oct, Math.abs(y - 2.9) - 1.7); }, [0, 2.9, 0], 1.9));
  for (const y of [1.7, 3.0, 4.2]) f.put(cyl([0, y, 0], 0.36, 0.05, 0.03, 8));
  f.put(ell([0, 4.75, 0], [0.42, 0.22, 0.42]), { k: 0.05 }).put(cyl([0, 4.62, 0], 0.4, 0.06, 0.03, 16));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; f.put(ell([Math.cos(a) * 0.4, 4.6, Math.sin(a) * 0.4], [0.07, 0.15, 0.07], [0, -a, Math.PI / 8]), { k: 0.03 }); }
  f.put(box([0, 5.08, 0], [0.5, 0.12, 0.5], 0.03)); for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) f.put(box([x * 0.6, 5.28, z * 0.6], [0.16 + 0.24 * Math.abs(x), 0.1, 0.16 + 0.24 * Math.abs(z)], 0.05), { k: 0.04 });
  f.put(box([0, 5.48, 0], [0.7, 0.12, 0.7], 0.03));
  if (broken) f.put(any((x, y, z) => (y - broken - 0.5 * x - 0.3 * z - 0.5 * fbm(x * 2.2 + seed, y, z * 2.2, 3) - 0.25 * ridged(x * 3, 1, z * 3 + seed, 2)) * 0.6), { op: 'int', k: 0.01 });
  f.displace(erode(0.03, seed * 7.3), 0.06);
  return f;
}
const colTop = (broken: number) => broken ? Math.min(5.65, broken + 1.2) : 5.65;
export async function hcol(seed: number, broken: number): Promise<Mesh> { const q = meshField(colField(seed, broken), { voxel: 0.032, mat: 36, bounds: [[-1.1, -0.05, -1.1], [1.1, colTop(broken), 1.1]] }); bakeAO(q.mesh, [q.sample], 0.6); return decimate(q.mesh, broken ? 2600 : 4000); }
export const hcolBits = (seed: number, broken: number) => shatterM(`hcol${seed - 1}Bits`, colField(seed, broken), 36, [-1.1, -0.05, -1.1], [1.1, colTop(broken), 1.1], (broken ? [[0, 0.3, 0], [0.15, 1.0, 0.1], [-0.15, 1.5, -0.1], [0.1, 2.2, 0.1], [-0.1, 2.8, -0.08], ...(broken > 2.6 ? [[0.1, 3.5, 0.1]] : [])] : [[0, 0.3, 0], [0.18, 0.95, 0.15], [-0.15, 1.5, -0.15], [0.1, 2.2, 0.1], [-0.1, 2.9, -0.1], [0.1, 3.6, 0.08], [-0.08, 4.3, 0.08], [0, 4.8, -0.05], [0.4, 5.35, 0.25], [-0.4, 5.35, -0.25]]) as V3[], 220);

// ---------------------------------------------------------------- the cloister
/** One bay of the arcade, 4.4 m wide and 6.6 high, facing +z: two piers, a cusped arch between, a deep eave, a parapet; the ward's back wall behind. Origin at the bay's middle on the floor. */
export async function arcade(): Promise<Mesh> {
  const f = new Field(0.03), W = 2.2;
  f.put(any((x, y, z) => {
    const slab = Math.max(Math.abs(z) - 0.42, y - 5.4, -y);
    // the opening: straight jambs, then a cusped (multifoil) arch rising to a point
    const ax = Math.abs(x), spring = 2.9, wide = 1.6, off = 0.55, R = wide + off, top = Math.acos(off / R); let open: number;
    if (y < spring) open = ax - wide; else { open = Math.hypot(ax + off, y - spring) - R; for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * top; open = Math.min(open, Math.hypot(ax - (-off + Math.cos(a) * R), y - (spring + Math.sin(a) * R)) - 0.3); } }
    return Math.max(slab, -open + 0.0 * x, Math.abs(x) - W);
  }, [0, 2.7, 0], 4.5));
  for (const s of [1, -1]) f.put(box([s * (W - 0.32), 1.6, 0.5], [0.3, 1.6, 0.12], 0.03), { k: 0.02 }).put(box([s * (W - 0.32), 0.15, 0.52], [0.36, 0.15, 0.16], 0.03), { k: 0.02 }).put(box([s * (W - 0.32), 3.08, 0.52], [0.36, 0.08, 0.16], 0.03), { k: 0.02 });
  // the eave on carved brackets, the parapet with its rounded merlons
  f.put(box([0, 5.5, 0.55], [W, 0.07, 0.62], 0.02)); for (let i = -2; i <= 2; i++) f.put(any((x, y, z) => Math.max(Math.abs(x - i * 0.95) - 0.1, Math.hypot(Math.max(0, z - 0.3), Math.max(0, 5.42 - y)) - 0.35, 4.95 - y, 0.3 - z - 0.01) , [i * 0.95, 5.2, 0.5], 0.6), { k: 0.02 });
  f.put(box([0, 5.85, 0.05], [W, 0.3, 0.32], 0.02)); for (let i = -2; i <= 2; i++) f.put(any((x, y, z) => Math.max(Math.hypot(x - i * 0.88, Math.max(0, y - 6.3)) - 0.28, Math.abs(z - 0.05) - 0.26, 6.1 - y, y - 6.62), [i * 0.88, 6.35, 0.05], 0.5));
  // the ward's back wall, three metres behind
  f.put(box([0, 2.9, -3.2], [W, 2.9, 0.3], 0.03)); f.put(box([0, 2.1, -2.85], [0.6, 0.9, 0.08], 0.02), { op: 'sub', k: 0.02 });
  f.displace(erode(0.028, 11), 0.06);
  const beam = new Field(0.02); beam.put(box([0, 5.6, -1.4], [W + 0.05, 0.1, 0.12], 0.03)); for (const x of [-1.4, 0.2, 1.5]) beam.put(cone([x, 5.6, 0.2], [x + 0.2, 4.6 + x * 0.3, -3.0], 0.08, 0.07)); beam.displace((x, y, z) => 0.012 * fbm(x * 4, y * 4, z * 4, 3), 0.015);
  return bakeAll([[f, 0.05, 36, 5200], [beam, 0.03, 19, 900]], 0.8);
}

// ---------------------------------------------------------------- the great dial
/** The great dial, facing south (+z): the gnomon a triangular wall nine metres high with a stair up its slope, and an hour arc either side with brass at the hours. Origin at the gnomon's foot. */
export async function dial(): Promise<Mesh> {
  const f = new Field(0.04), br = new Field(0.01), L = 16, Hh = 11.5;
  // the gnomon: rises from its foot (z = 0) to nine metres at z = -L
  f.put(any((x, y, z) => Math.max(Math.abs(x) - 1.3, -y, y - (-z) / L * Hh, z, -L - 1.2 - z), [0, 5.5, -L / 2], 12));
  f.put(box([0, Hh / 2, -L - 0.6], [1.3, Hh / 2, 0.6], 0.04)); f.put(box([0, Hh + 0.2, -L - 0.4], [1.5, 0.2, 0.9], 0.04));
  // the stair cut into its slope
  f.put(any((x, y, z) => { const s = 0.36, u = (-z) / L * Hh, step = Math.floor(u / s) * s; return Math.max(Math.abs(x) - 0.8, step - y, z, -L - z); }, [0, 5.5, -L / 2], 12), { op: 'sub', k: 0.01 });
  for (const s of [1, -1]) f.put(any((x, y, z) => Math.max(Math.abs(x - s * 1.05) - 0.22, y - (-z) / L * Hh - 0.4, -y, z, -L - z), [s * 1.05, 5.5, -L / 2], 12), { k: 0.02 });
  // the hour arcs: quarter-round walls either side, their inner faces graduated
  for (const s of [1, -1]) {
    const cx = s * 1.0, R = 6.5;
    f.put(any((x, y, z) => { const dx = (x - cx) * s, dz = z + 3.0, r = Math.hypot(dx, y - R * 0.7) ; const shell = Math.max(Math.abs(r - R) - 0.5, -dx, Math.abs(dz) - 1.6, -y, y - R * 0.7 - 0.2); return shell; }, [cx + s * R * 0.6, 2.5, -3.0], 7.5), { k: 0.03 });
    for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI / 2, x = cx + s * Math.sin(a) * (R - 0.52), y = R * 0.7 - Math.cos(a) * (R - 0.52); if (y < 0.1) continue; br.put(box([x, y, -3.0], [0.035, 0.035, 1.62], 0.01, [0, 0, s * a])); }
  }
  f.displace(erode(0.04, 23), 0.08);
  br.put(box([0, 0.02, 0.2], [0.06, 0.03, 0.2], 0.01));
  return bakeAll([[f, 0.07, 36, 9000], [br, 0.03, 37, 1600]], 1.2);
}

// ---------------------------------------------------------------- the waiting bowls
/** A copper bowl on a cord, hung from the rafters: origin at the top of the cord, the bowl 1.8 m below it. */
export async function bowl(): Promise<Mesh> {
  const c = new Field(0.008), r = new Field(0.004), Y = -1.8;
  c.put(any((x, y, z) => { const q = Math.hypot(x, z), e = Math.hypot(q, y - Y - 0.17) - 0.2; return Math.max(Math.abs(e) - 0.008, y - Y - 0.17); }, [0, Y + 0.06, 0], 0.25)).put(cyl([0, Y + 0.17, 0], 0.212, 0.01, 0.006));
  c.displace((x, y, z) => 0.0015 * fbm(x * 30, y * 30, z * 30, 2), 0.002);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; r.put(cone([Math.sin(a) * 0.2, Y + 0.17, Math.cos(a) * 0.2], [0, Y + 0.62, 0], 0.005, 0.005)); }
  r.put(cone([0, Y + 0.62, 0], [0, 0, 0], 0.007, 0.007));
  return bakeAll([[c, 0.01, 38, 420], [r, 0.008, 11, 120]], 0.1);
}
/** A beam fallen from a ward roof, charred: 4.6 m along x. */
export async function beam(): Promise<Mesh> {
  const f = new Field(0.02), g = rng(3); f.put(box([0, 0, 0], [2.3, 0.13, 0.15], 0.04)); for (let i = 0; i < 5; i++) f.put(ell([-2 + g() * 4, (g() - 0.5) * 0.2, (g() - 0.5) * 0.2], [0.2, 0.08, 0.08]), { op: 'sub', k: 0.05 });
  f.displace((x, y, z) => 0.012 * sstep(0.5, 0.7, ridged(x * 6, y * 9, z * 9, 2)) + 0.01 * fbm(x * 5, y * 5, z * 5, 3), 0.025);
  return bakeAll([[f, 0.03, 19, 700]], 0.3);
}
void ball; void curve; void tube; void mix;
