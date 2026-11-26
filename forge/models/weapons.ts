// Weapons are modelled along +Y with the grip centred on the origin.
import { Field, any, ball, box, clamp, cone, cyl, ell, fbm, noise, ridged, smax, sstep, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';

async function finish(parts: [Field, number, number, number][], reach: number) {
  const baked: Baked[] = parts.map(([f, voxel, mat]) => meshField(f, { voxel, mat }));
  const s = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, s, reach); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  return merge(out);
}

/** Broad straight longsword with a reinforced spine, basket guard and spiked disc pommel. Tip at y = 1.02. */
export async function khanda(): Promise<Mesh> {
  const blade = new Field(0.004), hilt = new Field(0.006), grip = new Field(0.003);
  const W = (y: number) => 0.034 + 0.012 * sstep(0.2, 0.95, y) - 0.005 * Math.sin(clamp((y - 0.12) / 0.8) * Math.PI);
  blade.put(any((x, y, z) => {
    const w = W(y), tipY = 1.02 - Math.pow(Math.abs(x) / w, 2.2) * 0.07, ax = Math.abs(x);
    const bevel = Math.abs(z) - 0.0048 * clamp((w - ax) / 0.018 * 0.9 + 0.03);
    const full = 0.0015 * sstep(0.0095, 0.004, Math.abs(ax - 0.0075)) * sstep(0.88, 0.8, y);
    return smax(Math.max(bevel * 0.45 + full * 0.3, ax - w + 0.0012 * sstep(0.55, 0.75, noise(y * 24, x > 0 ? 3 : 9, 1))), Math.max(y - tipY, 0.07 - y), 0.004);
  }, [0, 0.55, 0], 0.5));
  // riveted spine plates up both faces from the guard
  for (const s of [1, -1]) blade.put(any((x, y, z) => Math.max(Math.abs(x) - 0.0075 * (1 - (y - 0.1) * 1.9) - 0.002, Math.abs(z - s * 0.004) - 0.0022, 0.08 - y, y - 0.42) * 0.8, [0, 0.25, 0], 0.18), { k: 0.002 });
  hilt.put(box([0, 0.085, 0], [0.072, 0.011, 0.015], 0.006)).put(ball([0.072, 0.089, 0], 0.013)).put(ball([-0.072, 0.089, 0], 0.013)).put(box([0, 0.105, 0], [0.026, 0.02, 0.011], 0.005)).put(ell([0, 0.078, 0], [0.034, 0.016, 0.03]));
  hilt.put(cyl([0, -0.122, 0], 0.042, 0.006, 0.004)).put(ell([0, -0.13, 0], [0.026, 0.014, 0.026])).put(cone([0, -0.13, 0], [0, -0.165, 0], 0.01, 0.004));
  hilt.displace((x, y, z) => 0.0008 * fbm(x * 60, y * 60, z * 60, 2), 0.001);
  grip.put(cone([0, 0.075, 0], [0, -0.118, 0], 0.0145, 0.0155)).displace((x, y, z) => { const a = Math.atan2(z, x), f = (y * 95 + a / 6.283) % 1; return -0.0014 * Math.abs(Math.sin(f * Math.PI)); }, 0.002);
  return finish([[blade, 0.0022, 14, 2600], [hilt, 0.0024, 4, 2200], [grip, 0.0024, 3, 600]], 0.05);
}

/** The King's cleaver: a man-sized slab of rusted iron. Grip on the origin, blade to y = 2.15. */
export async function cleaver(): Promise<Mesh> {
  const bl = new Field(0.01), hd = new Field(0.012), rp = new Field(0.004);
  bl.put(any((x, y, z) => {
    const e = -0.16 - 0.2 * sstep(0.5, 1.9, y) + 0.025 * noise(y * 5, 2, 1) + 0.05 * Math.pow(clamp(noise(y * 9, 7, 1) * 1.6), 2), back = 0.075 + 0.02 * Math.sin(y * 2.2) + 0.006 * noise(y * 14, 1, 1);
    const top = 2.12 + x * 0.32 + 0.03 * noise(x * 14, 4, 2), t = 0.026 * clamp((x - e) / 0.13 + 0.06) + 0.004;
    return Math.max(Math.abs(z) - t, (e - x) * 0.8, (x - back) * 0.9, (y - top) * 0.9, 0.36 - y) * 0.75;
  }, [0, 1.25, 0], 1.05));
  bl.put(cyl([0, 0, 0], 0.07, 0.2).map((v, i) => i === 0 ? (x: number, y: number, z: number) => Math.hypot(Math.hypot(x + 0.02, y - 1.86) - 0, 0) - 0.075 : i === 1 ? [-0.02, 1.86, 0] : 0.1) as never, { op: 'sub', k: 0.012 });
  bl.displace((x, y, z) => 0.006 * fbm(x * 8, y * 8, z * 8, 3) + 0.006 * sstep(0.62, 0.78, ridged(x * 6, y * 6, z * 6, 2)), 0.012);
  hd.put(cone([0, -0.42, 0], [0, 0.42, 0], 0.03, 0.036)).put(box([0.0, 0.4, 0], [0.1, 0.05, 0.05], 0.02)).put(ball([0, -0.45, 0], 0.055));
  hd.displace((x, y, z) => 0.004 * fbm(x * 14, y * 14, z * 14, 3), 0.005);
  rp.put(cone([0, -0.33, 0], [0, 0.3, 0], 0.041, 0.044)).displace((x, y, z) => { const a = Math.atan2(z, x), f = (y * 24 + a / 6.283) % 1; return -0.006 * Math.abs(Math.sin(f * Math.PI)) + 0.002 * noise(x * 40, y * 40, z * 40); }, 0.008);
  return finish([[bl, 0.0085, 12, 4200], [hd, 0.009, 12, 700], [rp, 0.007, 11, 900]], 0.2);
}
