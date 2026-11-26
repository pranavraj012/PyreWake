// The Pyrekeeper.
import { HUMAN, boneIndex, ARM_DIR } from '../../src/anim/skeletons.ts';
import { CLOTHS, clothWeights } from '../../src/anim/cloth.ts';
import { Field, add, any, ball, belly, box, clamp, cone, curve, ell, fbm, lerp3, mix, mul, noise, ridged, smax, sstep, sub, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';
import { sheet } from '../sheet.ts';

const b = boneIndex(HUMAN), at = (n: string) => HUMAN[b[n]].pos as V3;
const SIDES = [['L', 1], ['R', -1]] as const;
const mir = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];
const D = ARM_DIR as V3;

/** Overlapping bandage ridges around the segment a->b. */
function bands(a: V3, c: V3, pitch: number, depth: number, slant: number) {
  const ax = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], L = Math.hypot(...ax), d = ax.map(v => v / L) as V3;
  return (x: number, y: number, z: number) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * d[0] + py * d[1] + pz * d[2];
    const qx = px - d[0] * t, qz = pz - d[2] * t, an = Math.atan2(qz, qx);
    const u = t / pitch + Math.sin(an + t * 9) * slant + an / (Math.PI * 2) + 0.18 * noise(x * 30, y * 30, z * 30), f = u - Math.floor(u);
    return depth * (f * 0.9 - (f > 0.86 ? (f - 0.86) / 0.14 : 0));
  };
}

export async function player(): Promise<Mesh> {
  const parts: [Field, number, number, number][] = []; // field, voxel, mat, tris
  const F = (k: number, voxel: number, mat: number, tris: number) => { const f = new Field(k); parts.push([f, voxel, mat, tris]); return f; };

  // ---- head: only the eye band is ever visible
  const head = F(0.02, 0.0028, 0, 3600); head.bone = b.head;
  head.put(ell([0, 1.69, 0.0], [0.074, 0.098, 0.094])).put(ell([0, 1.64, 0.04], [0.058, 0.085, 0.06]), { k: 0.04 });
  head.put(cone([-0.036, 1.69, 0.084], [0.036, 1.69, 0.084], 0.012, 0.012), { k: 0.018 });
  head.put(cone([0, 1.684, 0.094], [0, 1.642, 0.118], 0.0085, 0.012), { k: 0.014 });
  for (const [, s] of SIDES) {
    head.put(ell([0.034 * s, 1.668, 0.098], [0.02, 0.014, 0.02]), { op: 'sub', k: 0.014 });
    head.put(ell([0.046 * s, 1.645, 0.072], [0.024, 0.018, 0.02]), { k: 0.02 });
    head.put(cone([0.018 * s, 1.683, 0.1], [0.052 * s, 1.687, 0.084], 0.0065, 0.004), { k: 0.008, mask: 1 });
    const e: V3 = [0.032 * s, 1.667, 0.0795];
    head.put(any((x, y, z) => { const r = Math.hypot(x - e[0], y - e[1], z - e[2]) - 0.0155; const slit = Math.hypot((x - e[0]) / 2.1, (y - e[1] + 0.0005) / 0.9) - 0.0056; return smax(r, -Math.max(slit, e[2] - z), 0.003); }, e, 0.017), { k: 0.004 });
  }
  head.put(cone([0, 1.6, 0.0], [0, 1.47, -0.02], 0.052, 0.06), { bone: b.neck });
  head.displace((x, y, z) => 0.0012 * fbm(x * 60, y * 60, z * 60, 2), 0.002);
  const eyes = F(0, 0.0018, 8, 700); eyes.bone = b.head;
  for (const [, s] of SIDES) eyes.put(ball([0.032 * s, 1.667, 0.0795], 0.0138), { mask: s > 0 ? 1 : 0 });

  // ---- face wrap and hood
  const face = F(0.02, 0.0032, 2, 1800); face.bone = b.head;
  face.put(ell([0, 1.625, 0.036], [0.068, 0.075, 0.072])).put(ell([0, 1.65, 0.0], [0.086, 0.06, 0.1])).put(cone([0, 1.645, 0.1], [0, 1.63, 0.116], 0.014, 0.017), { k: 0.025 });
  face.put(cone([0, 1.57, 0.01], [0, 1.5, -0.01], 0.062, 0.074), { bone: b.neck });
  face.put(any((x, y, z) => y - (1.652 - 0.14 * Math.max(0, z - 0.1) + 0.004 * noise(x * 40, 0, z * 40) - x * x * 1.2)), { op: 'int', k: 0.005 });
  face.displace((x, y, z) => { const u = (y + 0.35 * Math.abs(x) + 0.1 * z) * 46 + noise(x * 18, y * 18, z * 18) * 0.7, f = u - Math.floor(u); return -0.0035 * Math.sin(f * Math.PI) - 0.002 * ridged(x * 30, y * 55, z * 30, 2) + 0.001; }, 0.008);

  const hood = F(0.03, 0.0042, 5, 3800); hood.bone = b.head;
  hood.put(ell([0, 1.69, 0.0], [0.118, 0.137, 0.14])).put(ell([0, 1.66, -0.08], [0.08, 0.1, 0.085]), { k: 0.05 }).put(ell([0, 1.765, 0.06], [0.078, 0.052, 0.085]), { k: 0.05 });
  hood.put(cone([0, 1.62, -0.03], [0, 1.52, -0.025], 0.098, 0.105), { k: 0.05, bone: b.neck });
  // cowl rolls around the neck
  for (let i = 0; i < 4; i++) {
    const y = 1.545 - i * 0.027, r = 0.092 + i * 0.02, pts: V3[] = [];
    for (let j = 0; j <= 20; j++) { const a = j / 20 * Math.PI * 2; pts.push([Math.sin(a) * r * 1.08, y + Math.cos(a) * -0.022 - 0.012 * Math.sin(a * 2 + i * 2) + 0.008 * Math.sin(a * 3 + i), -0.02 + Math.cos(a) * r * 0.98]); }
    hood.put(tube(pts, t => 0.021 + 0.006 * Math.sin(t * 12 + i * 2)), { k: 0.022, bone: i < 2 ? b.neck : b.chest });
  }
  hood.put(ell([0, 1.665, 0.012], [0.086, 0.108, 0.116]), { op: 'sub', k: 0.016 });
  hood.put(ell([0, 1.64, 0.165], [0.07, 0.098, 0.1]), { op: 'sub', k: 0.03 });
  // stiff peaked brim over the eyes, a crown point that droops behind, a heavy cowl fold at each cheek
  hood.put(ell([0, 1.742, 0.098], [0.09, 0.022, 0.062], [-0.3, 0, 0]), { k: 0.035 });
  hood.put(cone([0, 1.77, -0.02], [0, 1.74, -0.17], 0.06, 0.022), { k: 0.06 });
  for (const [, s] of SIDES) hood.put(cone([0.108 * s, 1.68, 0.04], [0.098 * s, 1.55, 0.07], 0.03, 0.04), { k: 0.04 });
  hood.displace((x, y, z) => { const a = Math.atan2(x, z + 0.01); return -0.012 * ridged(a * 1.7, y * 6 + Math.abs(a) * 1.4, 3, 2) - 0.004 * ridged(a * 4, y * 14, 5, 2) + 0.008 + 0.002 * noise(x * 50, y * 50, z * 50); }, 0.014);

  // shoulder mantle
  const mantle = F(0.03, 0.0045, 5, 3600); mantle.bone = b.chest;
  mantle.put(ell([0, 1.425, -0.02], [0.205, 0.105, 0.14])).put(cone([0, 1.5, -0.02], [0, 1.4, -0.02], 0.1, 0.15), { k: 0.06 });
  for (const [S, s] of SIDES) mantle.put(ell(mir([0.18, 1.425, -0.015], s), [0.082, 0.085, 0.088]), { bone: b['upperArm.' + S], k: 0.05 }).put(ball(mir([0.11, 1.45, -0.01], s), 0.085), { bone: b['clav.' + S], k: 0.05 });
  mantle.put(any((x, y, z) => (1.345 + 0.022 * noise(x * 16, 2, z * 16) + 0.012 * noise(x * 50, 5, z * 50) + (z > 0 ? 0.03 : -0.03) - 0.05 * Math.abs(x) - y) * 0.8), { op: 'int', k: 0.006 });
  mantle.displace((x, y, z) => { const a = Math.atan2(x, z + 0.02), t = sstep(1.5, 1.38, y); return -0.011 * t * ridged(a * 3.2 + noise(x * 5, y * 5, z * 5) * 0.5, y * 2.2, 1, 2) + 0.007 * t + 0.0015 * noise(x * 60, y * 60, z * 60); }, 0.012);

  // ---- torso tunic, sleeves
  const tunic = F(0.05, 0.005, 2, 5000); tunic.bone = b.chest;
  tunic.put(ell([0, 1.33, -0.005], [0.158, 0.17, 0.115])).put(ell([0, 1.2, -0.005], [0.136, 0.16, 0.1]), { bone: b.spine2 }).put(ell([0, 1.1, 0], [0.13, 0.13, 0.1]), { bone: b.spine1 }).put(ell([0, 0.98, -0.005], [0.158, 0.125, 0.12]), { bone: b.hips });
  for (const [S, s] of SIDES) {
    tunic.put(ell(mir([0.068, 1.36, 0.07], s), [0.08, 0.06, 0.04], [0.2, 0, 0]), { k: 0.05 }).put(ell(mir([0.09, 1.3, -0.07], s), [0.075, 0.12, 0.045]), { k: 0.05 });
    const u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s);
    tunic.put(ball(add(u, [0.004 * s, -0.004, 0]), 0.067), { bone: b['upperArm.' + S] });
    tunic.put(belly(u, lerp3(u, e, 0.97), 0.058, 0.064, 0.05, 0.4), { bone: b['upperArm.' + S], k: 0.04 });
    tunic.put(cone(lerp3(u, e, 0.9), add(e, mul(mir(D, s), 0.035)), 0.05, 0.048), { bone: b['foreArm.' + S], k: 0.02 });
  }
  const slv = SIDES.map(([, s]) => bands(mir(at('upperArm.L'), s), mir(at('foreArm.L'), s), 0.026, -0.0032, 0.35));
  tunic.displace((x, y, z) => {
    const ax = Math.abs(x);
    if (ax > 0.2) return slv[x > 0 ? 0 : 1](x, y, z) - 0.002 * ridged(x * 25, y * 25, z * 25, 2);
    const wr = (y + x * (z > 0 ? 0.42 : -0.42)) * 24 + noise(x * 8, y * 8, z * 8) * 0.8, edge = 0.0045 * (wr - Math.floor(wr)) * sstep(1.12, 1.2, y);
    const folds = 0.0075 * ridged(x * 6 + y * 4, y * 13 - x * 6, z * 6, 2) * (0.5 + sstep(1.28, 1.08, y));
    return -folds - edge + 0.004 + 0.0015 * noise(x * 40, y * 40, z * 40);
  }, 0.012);

  // ---- hardened leather cuirass over the wraps
  const cui = F(0.02, 0.0046, 3, 5200); cui.bone = b.chest;
  cui.put(ell([0, 1.3, -0.003], [0.163, 0.17, 0.124])).put(ell([0, 1.18, -0.003], [0.147, 0.15, 0.112]), { bone: b.spine2, k: 0.06 }).put(ell([0, 1.09, 0], [0.139, 0.1, 0.11]), { bone: b.spine1, k: 0.05 });
  for (const [, s] of SIDES) cui.put(ell(mir([0.064, 1.335, 0.076], s), [0.076, 0.062, 0.045], [0.2, 0, 0]), { k: 0.04 }).put(ell(mir([0.205, 1.4, -0.005], s), [0.09, 0.13, 0.1]), { op: 'sub', k: 0.02 });
  cui.put(any((x, y, z) => Math.max(y - (z > 0 ? 1.405 : 1.47) + 1.1 * x * x, 1.045 - y)), { op: 'int', k: 0.01 });
  cui.displace((x, y, z) => {
    const v = (1.36 - y) / 0.062, f = v - Math.floor(v), lame = y < 1.25 ? 0.0055 * f - 0.002 : 0, seam = 0.004 * sstep(0.006, 0.002, Math.abs(x)) * (z > 0 ? 1 : 0);
    const st = 0.0028 * sstep(0.55, 0.9, Math.cos(x * 260)) * sstep(0.12, 0.06, Math.abs(f - 0.8)) * (y < 1.25 ? 1 : 0);
    return lame + seam - st + 0.0022 * fbm(x * 26, y * 26, z * 26, 3);
  }, 0.011);

  // ---- burnt forearms and hands, closed on a grip
  const arms = F(0.016, 0.0032, 1, 7000);
  for (const [S, s] of SIDES) {
    const e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s), d = mir(D, s), n: V3 = [-0.766 * s, -0.643, 0];
    arms.bone = b['foreArm.' + S];
    const P = (al: number, nn: number, zz: number, o: V3 = w): V3 => [o[0] + d[0] * al + n[0] * nn, o[1] + d[1] * al + n[1] * nn, o[2] + zz];
    arms.put(cone(e, w, 0.036, 0.02)).put(belly(P(-0.02, 0.012, 0.012, e), P(-0.04, 0.004, 0.008), 0.02, 0.041, 0.014, 0.28)).put(belly(P(0, -0.014, 0.008, e), P(-0.06, -0.004, 0), 0.018, 0.035, 0.013, 0.3)).put(belly(P(-0.03, -0.004, 0.026, e), P(-0.05, 0.0, 0.02), 0.014, 0.03, 0.01, 0.25));
    arms.bone = b['hand.' + S];
    arms.put(ell(P(0.012, 0, 0), [0.021, 0.019, 0.025]), { k: 0.018 }).put(ell(P(0.05, -0.002, 0.004), [0.034, 0.02, 0.038]), { k: 0.02 });
    arms.put(cone(P(0.02, 0, 0.016), P(0.085, -0.004, 0.026), 0.018, 0.016)).put(cone(P(0.02, 0, -0.012), P(0.082, -0.004, -0.028), 0.018, 0.015)).put(cone(P(0.03, 0, 0), P(0.085, -0.004, 0), 0.019, 0.016));
    for (let i = 0; i < 4; i++) {
      const z = 0.031 - i * 0.021, r = [0.0105, 0.011, 0.0105, 0.0092][i], L = [0.94, 1, 0.95, 0.82][i];
      const k0 = P(0.088 - (i === 3 ? 0.006 : 0), -0.006, z), k1 = P(0.118 * L + 0.003, 0.008, z * 1.04), k2 = P(0.108 * L, 0.044, z * 1.04), k3 = P(0.078, 0.052, z);
      arms.put(cone(k0, k1, r * 1.1, r), { k: 0.007 }).put(ball(k0, r * 1.18), { k: 0.01 }).put(cone(k1, k2, r, r * 0.92), { k: 0.005 }).put(cone(k2, k3, r * 0.92, r * 0.8), { k: 0.005 });
    }
    const t0 = P(0.03, 0.014, 0.03), t1 = P(0.062, 0.032, 0.05), t2 = P(0.092, 0.052, 0.034);
    arms.put(cone(t0, t1, 0.017, 0.0125), { k: 0.012 }).put(cone(t1, t2, 0.012, 0.0095), { k: 0.005 });
  }
  arms.displace((x, y, z) => { const c = ridged(x * 26, y * 26, z * 26, 2); return 0.0028 * sstep(0.6, 0.74, c) - 0.0014 * fbm(x * 50, y * 50, z * 50, 2); }, 0.004);

  // ---- trousers
  const legs = F(0.04, 0.005, 5, 3600);
  for (const [S, s] of SIDES) {
    const h = mir(at('thigh.L'), s), k = mir(at('shin.L'), s), f = mir(at('foot.L'), s);
    legs.bone = b['thigh.' + S];
    legs.put(cone(add(h, [0, -0.02, 0]), k, 0.093, 0.064)).put(belly(add(h, [0.01 * s, -0.04, 0.03]), add(k, [0, 0.06, 0.016]), 0.05, 0.072, 0.045, 0.45)).put(belly(add(h, [0, -0.06, -0.035]), add(k, [0, 0.05, -0.015]), 0.05, 0.066, 0.04, 0.45));
    legs.bone = b['shin.' + S];
    legs.put(ell(add(k, [0, 0, 0.006]), [0.062, 0.07, 0.066])).put(cone(k, lerp3(k, f, 0.8), 0.066, 0.056), { k: 0.03 }).put(ell(lerp3(k, f, 0.8), [0.058, 0.04, 0.058]), { k: 0.03 });
  }
  legs.put(ell([0, 0.94, -0.01], [0.15, 0.1, 0.115]), { bone: b.hips });
  legs.displace((x, y, z) => { const t = sstep(0.6, 0.42, y); return -0.012 * ridged(x * 7, y * (9 + t * 9) + x * 5, z * 7, 2) * (0.6 + t) + 0.008 + 0.0015 * noise(x * 50, y * 50, z * 50); }, 0.014);

  // ---- shin wraps
  const shins = F(0.02, 0.004, 2, 3200);
  const sb = SIDES.map(([, s]) => bands(mir(at('shin.L'), s), mir(at('foot.L'), s), 0.026, -0.0036, 0.35));
  for (const [S, s] of SIDES) {
    const k = mir(at('shin.L'), s), f = mir(at('foot.L'), s); shins.bone = b['shin.' + S];
    shins.put(cone(lerp3(k, f, 0.34), lerp3(k, f, 0.84), 0.07, 0.061), { k: 0.01 });
    shins.put(any((x, y) => y - 0.37 - 0.01 * noise(x * 40, 1, 1)), { op: 'int', k: 0.006 });
  }
  shins.displace((x, y, z) => sb[x > 0 ? 0 : 1](x, y, z), 0.008);

  // ---- leather: boots, belt, harness, knee straps, pouches
  const lea = F(0.012, 0.0042, 3, 6500);
  for (const [S, s] of SIDES) {
    const f = mir(at('foot.L'), s), t = mir(at('toe.L'), s);
    lea.bone = b['foot.' + S];
    lea.put(cone(add(f, [0, 0.11, 0]), add(f, [0, -0.02, 0]), 0.056, 0.044), { k: 0.03 }).put(ell(add(f, [0, -0.045, -0.025]), [0.037, 0.045, 0.048]), { k: 0.03 }).put(cone(add(f, [0.003 * s, -0.028, 0.02]), add(t, [0, 0.018, 0]), 0.042, 0.034), { k: 0.04 });
    for (let i = 0; i < 3; i++) lea.put(cone(add(f, [-0.04 * s, 0.05 - i * 0.034, 0.02 + i * 0.02]), add(f, [0.046 * s, 0.056 - i * 0.034, 0.022 + i * 0.02]), 0.012, 0.012), { k: 0.004 });
    lea.bone = b['toe.' + S];
    lea.put(ell(add(t, [-0.002 * s, 0.006, 0.03]), [0.042, 0.033, 0.062]), { k: 0.03 });
    lea.bone = b['foot.' + S];
    lea.put(box([f[0] + 0.004 * s, 0.012, 0.045], [0.041, 0.012, 0.135], 0.012), { k: 0.008 });
    lea.bone = b['foreArm.' + S];
    const e = mir(at('foreArm.L'), s), d = mir(D, s);
    const wl = Math.hypot(...sub(mir(at('hand.L'), s), e)), ar = (q: number) => 0.036 - 0.016 * Math.min(1, q / wl) + 0.0045; for (const q of [0.05, 0.19]) lea.put(cone(add(e, mul(d, q)), add(e, mul(d, q + 0.02)), ar(q), ar(q + 0.02)), { k: 0.003 });
  }
  const ring = (y: number, rx: number, rz: number, tilt: number, z = 0) => { const p: V3[] = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2; p.push([Math.sin(a) * rx, y + tilt * Math.sin(a), z + Math.cos(a) * rz]); } return p; };
  const strap = (pts: V3[], hh: number, th: number, bone: number) => { const s = tube(pts, () => th); lea.put(any((x, y, z) => { let m = 1e9; for (const o of [-1, -0.33, 0.33, 1]) m = Math.min(m, s[0](x, y + o * hh, z)); return m; }, s[1], s[2] + hh), { bone, k: 0.004 }); };
  strap(ring(1.045, 0.142, 0.112, 0.004), 0.018, 0.011, b.hips); strap(ring(1.0, 0.157, 0.124, 0.022), 0.011, 0.01, b.hips);
  // harness strap: right shoulder to left hip and round the back
  const har = curve([[-0.11, 1.46, 0.07], [-0.06, 1.38, 0.118], [0.02, 1.26, 0.122], [0.09, 1.14, 0.106], [0.13, 1.06, 0.06]], 18), harB = curve([[-0.11, 1.46, -0.1], [-0.04, 1.34, -0.135], [0.05, 1.2, -0.125], [0.13, 1.06, -0.07]], 18);
  har.slice(1).forEach((p, i) => lea.put(cone(har[i], p, 0.0145, 0.0145), { bone: p[1] > 1.27 ? b.chest : p[1] > 1.13 ? b.spine2 : b.spine1, k: 0.008 }));
  harB.slice(1).forEach((p, i) => lea.put(cone(harB[i], p, 0.0145, 0.0145), { bone: p[1] > 1.27 ? b.chest : p[1] > 1.13 ? b.spine2 : b.spine1, k: 0.008 }));
  lea.put(box([0.12, 0.965, 0.09], [0.034, 0.042, 0.022], 0.012, [0.1, 0.6, 0.08]), { bone: b.hips }).put(box([0.165, 0.955, 0.0], [0.02, 0.05, 0.036], 0.012, [0, 0, 0.1]), { bone: b.hips }).put(box([-0.1, 0.975, -0.11], [0.05, 0.036, 0.026], 0.014, [0, 0.4, 0]), { bone: b.hips });
  // satchel on the left hip with a strapped flap, and the pouch cord
  lea.put(box([0.19, 0.935, 0.0], [0.04, 0.07, 0.07], 0.018, [0, 0.1, 0]), { bone: b.hips, k: 0.01 }).put(box([0.193, 0.985, 0.0], [0.044, 0.018, 0.075], 0.012, [0, 0.1, 0]), { bone: b.hips, k: 0.006 });
  lea.put(box([0.232, 0.93, 0.03], [0.006, 0.045, 0.012], 0.003), { bone: b.hips });
  lea.displace((x, y, z) => 0.0018 * fbm(x * 45, y * 45, z * 45, 3), 0.003);
  const cord = F(0.004, 0.0034, 11, 1500); cord.bone = b.hips;
  for (const [x0, z0, y1, wob] of [[0.07, 0.128, 0.82, 0.01], [0.105, 0.112, 0.78, -0.012], [-0.12, 0.1, 0.84, 0.01]] as const) {
    const cp = curve([[x0, 1.0, z0], [x0 + wob, 0.93, z0 + 0.016], [x0 + wob * 1.6, (1.0 + y1) / 2 - 0.02, z0 + 0.02], [x0 + wob * 0.6, y1, z0 + 0.014]], 14);
    cp.slice(1).forEach((q, i) => cord.put(cone(cp[i], q, 0.0068, 0.0068), { k: 0.003 }));
    cord.put(ball(cp[cp.length - 1], 0.015), { k: 0.004 }).put(ball(add(cp[cp.length - 1], [0, -0.025, 0]), 0.011), { k: 0.004 });
  }
  cord.displace((x, y, z) => 0.0012 * Math.sin((x * 3 + y * 5 + z * 3) * 140), 0.002);

  // ---- iron lamellar: right pauldron, right tasset, chest half-plate, knee
  const iron = F(0.003, 0.0034, 4, 7500);
  const lam = (u: number, v: number, pu: number, pv: number) => { const row = Math.floor(v / pv), a = u / pu + (row & 1) * 0.5, fu = Math.abs(a - Math.floor(a) - 0.5) * 2, fv = v / pv - row; return 0.0035 * sstep(0.8, 0.98, fu) + 0.004 * fv; };
  for (let i = 0; i < 5; i++) {
    const cen: V3 = [-0.188 - i * 0.02, 1.452 - i * 0.034, -0.012], R = 0.098 + i * 0.002;
    iron.put(any((x, y, z) => {
      const dx = x - cen[0], dy = (y - cen[1]) * 1.05, dz = z - cen[2], q = Math.hypot(dx, dy, dz * 0.97), sh = Math.abs(q - R) - 0.0085;
      const ax = -dx * 0.72 + dy * 0.62, low = -(-dx * 0.643 - dy * 0.766);
      return Math.max(sh, 0.018 - ax, -low - 0.055, Math.abs(dz) - 0.09) * 0.9;
    }, cen, 0.11), { bone: i < 2 ? b['clav.R'] : b['upperArm.R'] });
  }
  for (let i = 0; i < 4; i++) {
    const y0 = 0.985 - i * 0.052;
    iron.put(any((x, y, z) => { const a = Math.atan2(-x, z + 0.005), r = Math.hypot(x, z + 0.005), R = 0.153 + i * 0.011 + (y0 - y) * 0.12; return Math.max(Math.abs(r - R) - 0.0085, Math.abs(y - y0) - 0.034, Math.abs(a - 1.45) * 0.15 - 0.105) * 0.85; }, [-0.15, y0, 0], 0.2), { bone: i < 2 ? b.hips : b['thigh.R'] });
  }
  // disc buckle and harness ring
  iron.put(any((x, y, z) => { const r = Math.hypot(x - 0.0, y - 1.044), zz = z - 0.121; return Math.max(r - 0.036, Math.abs(zz) - 0.007) - 0.003 + 0.004 * Math.cos(r * 420) * (r < 0.032 ? 1 : 0) * 0.5; }, [0, 1.044, 0.121], 0.045), { bone: b.hips });
  iron.put(any((x, y, z) => { const r = Math.hypot(x - 0.02, y - 1.262) - 0.022; return Math.hypot(r, z - 0.137) - 0.005; }, [0.02, 1.262, 0.137], 0.03), { bone: b.spine2 });
  for (const [S, s] of SIDES) { const k = mir(at('shin.L'), s); iron.put(any((x, y, z) => { const q = Math.hypot((x - k[0]) * 1.1, (y - k[1]) * 0.85, z - k[2]); return Math.max(Math.abs(q - 0.077) - 0.0045, k[2] + 0.032 - z); }, k, 0.09), { bone: b['shin.' + S] }); }
  iron.displace((x, y, z) => {
    let p = 0;
    if (x < -0.1 && y > 1.2) p = lam(z + 3, -y * 0.766 + x * -0.643 + 3, 0.03, 0.034); else if (x < -0.1 && y > 0.7 && y < 1.05) p = lam(Math.atan2(-x, z) * 0.16 + 3, 3 - y, 0.028, 0.052);
    return p + 0.0012 * noise(x * 40, y * 40, z * 40);
  }, 0.009);

  // ---- braid
  const hair = F(0.004, 0.0034, 7, 2600);
  const bp = curve([[0, 1.63, -0.1], [0.012, 1.56, -0.155], [0.02, 1.46, -0.168], [0.02, 1.32, -0.165], [0.014, 1.18, -0.152], [0.008, 1.06, -0.145]], 40);
  for (let k = 0; k < 3; k++) {
    const ph = k / 3 * Math.PI * 2, pts = bp.map((p, i) => { const t = i / 40, a = t * 26 + ph, r = 0.013 * (1 - t * 0.55); return [p[0] + Math.sin(a) * r, p[1], p[2] + Math.sin(a * 2) * r * 0.55] as V3; });
    pts.slice(1).forEach((p, i) => { const t = i / 40; hair.put(cone(pts[i], p, 0.0145 * (1 - t * 0.6), 0.0145 * (1 - (i + 1) / 40 * 0.6)), { bone: p[1] > 1.46 ? b.braid1 : p[1] > 1.32 ? b.braid2 : p[1] > 1.18 ? b.braid3 : b.braid4, k: 0.003 }); });
  }
  for (const y of [1.5, 1.12]) hair.put(cone([0.015, y, -0.158], [0.015, y - 0.02, -0.158], 0.02, 0.02), { bone: y > 1.3 ? b.braid1 : b.braid4, k: 0.002 });
  hair.displace((x, y, z) => 0.0013 * Math.sin((x * 9 + z * 5) * 60 + y * 90), 0.002);

  // ---- mesh all solid parts
  const baked: Baked[] = [];
  for (const [f, voxel, mat] of parts) baked.push(meshField(f, { voxel, mat, soft: 0.018, smoothSkin: Math.round(0.03 / voxel) }));
  const samples = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, samples, 0.16); out.push(await decimate(baked[i].mesh, parts[i][3])); }

  // ---- cloth sheets: tabard front/back and sash tails (simulated at runtime later)
  for (const c of CLOTHS) {
    if (!c.hem) { out.push(sheet(c.at, { nu: c.nu, nv: c.nv, mat: c.mat, inner: c.inner, tatter: c.tatter, seed: c.seed, weights: (u, v) => clothWeights(c, b, u, v) })); continue; }
    const v0 = 1 - c.hem[0];
    out.push(sheet((u, v) => c.at(u, v * v0), { nu: c.nu, nv: Math.round(c.nv * v0), mat: c.mat, inner: c.inner, weights: (u, v) => clothWeights(c, b, u, v * v0) }));
    out.push(sheet((u, v) => c.at(u, v0 + v * c.hem![0]), { nu: c.nu, nv: 7, mat: c.hem[1], inner: c.hem[1], tatter: c.tatter * 1.5, seed: c.seed, weights: (u, v) => clothWeights(c, b, u, v0 + v * c.hem![0]) }));
  }
  out.push(sheet((u, v) => { const a = mix(0, Math.PI * 2, u); const k = 1.062 - v * 0.068 + Math.sin(a) * 0.012; return [Math.sin(a) * (0.158 + 0.006 * Math.sin(v * 22 + a * 2)), k, Math.cos(a) * (0.126 + 0.006 * Math.sin(v * 22 + a * 2))] as V3; }, { nu: 48, nv: 10, mat: 6, weights: () => [[b.hips, 1]] }));
  return merge(out);
}
