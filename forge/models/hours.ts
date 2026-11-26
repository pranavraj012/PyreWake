// The third boss: the Sister of Hours (on the human frame, scaled in play to 2.6 m), her scythe, and the Pall.
import { boneIndex, ARM_DIR } from '../../src/anim/skeletons.ts';
import { PALL, PALL_BONES, SISTER, SKIRT, STRIPS, STRIP_LEN, domeAt, domeWeights, skirtAt, skirtWeights, stripRoot, stripWeights } from '../../src/boss/hours/frame.ts';
import { Field, add, any, ball, belly, box, cone, cross, curve, ell, fbm, lerp3, mix, mul, noise, norm, ridged, rng, sstep, sub, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';
import { sheet } from '../sheet.ts';

const SIDES = [['L', 1], ['R', -1]] as const, mir = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]], D = ARM_DIR as V3;
type Part = [Field, number, number, number, number?];
async function bakeParts(parts: Part[], reach: number, smooth: (mat: number, voxel: number) => number = () => 0): Promise<Mesh[]> {
  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft: soft ?? 0.02, smoothSkin: smooth(mat, voxel) })), s = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, s, reach); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  return out;
}
/** A sheet cut into bands down its length, each its own material; only the last is torn. */
function banded(f: (u: number, v: number) => V3, bands: [number, number, number][], o: { nu: number; nv: number; tatter?: number; seed?: number; inner?: number; weights: (u: number, v: number) => [number, number][] }): Mesh[] {
  return bands.map(([v0, v1, mat], i) => sheet((u, v) => f(u, v0 + (v1 - v0) * v), { nu: o.nu, nv: Math.max(3, Math.round(o.nv * (v1 - v0))), mat, inner: o.inner ?? mat, tatter: i === bands.length - 1 ? o.tatter : 0, seed: o.seed, weights: (u, v) => o.weights(u, v0 + (v1 - v0) * v) }));
}

/** The sisters' hood: starched linen folded over the head into two stiff points that stand out past the shoulders. u runs wing tip to wing tip, v front to back.
 *  `T` places it (human frame by default). */
function cornette(T: (p: V3) => V3 = p => p, span = 1): (u: number, v: number) => V3 {
  const H: V3 = [0, 1.705, -0.01], R = 0.13, c = 0.3, top = 0.7;
  return (u, v) => {
    const s = u * 2 - 1, as = Math.abs(s), sg = Math.sign(s) || 1, front = 0.13, back = -0.15;
    if (as <= c) {
      const ph = s / c * top * Math.PI / 2, z = mix(front, back, v), brim = v < 0.18 ? (0.18 - v) * 0.3 : 0;
      return T([Math.sin(ph) * R * 1.05, H[1] + Math.cos(ph) * R * (1 - 0.15 * v) - brim + 0.014 * Math.sin(v * Math.PI), z]);
    }
    const k = (as - c) / (1 - c), ph = top * Math.PI / 2, x0 = Math.sin(ph) * R * 1.05, y0 = H[1] + Math.cos(ph) * R;
    // each wing turns from lying over the head to standing like a sail, broad where it leaves the head, folded to a point that lifts and sweeps back
    const th = 1.25 * sstep(0, 0.35, k), w = Math.pow(1 - k, 0.7), half = mix((front - back) / 2, 0.11, sstep(0, 0.35, k)) * w + 0.006, o = (0.5 - v) * 2 * half;
    const cz = mix((front + back) / 2, -0.07, k) - 0.07 * k * k, fold = 0.02 * Math.sin(v * Math.PI) * (1 - k);
    const y = y0 + 0.03 * k + 0.16 * k * k * k + o * Math.sin(th) + fold, z = cz + o * Math.cos(th);
    return T([sg * (x0 + 0.44 * span * Math.pow(k, 0.95) + 0.03 * Math.sin(v * Math.PI) * k), y, z]);
  };
}
/** Her face, built on `T`: a woman's head, a coif round it, eyes open (or shut, at the top of the Pall). */
function face(sk: Field, coif: Field, eyes: Field | null, T: (p: V3) => V3, s: number, shut: boolean) {
  const P = (c: V3) => T(c);
  sk.put(ell(P([0, 1.69, 0.0]), [0.07 * s, 0.093 * s, 0.088 * s])).put(ell(P([0, 1.63, 0.035]), [0.054 * s, 0.07 * s, 0.058 * s]), { k: 0.035 * s });
  sk.put(cone(P([0, 1.683, 0.088]), P([0, 1.648, 0.112]), 0.008 * s, 0.012 * s), { k: 0.012 * s }).put(cone(P([-0.034, 1.69, 0.082]), P([0.034, 1.69, 0.082]), 0.011 * s, 0.011 * s), { k: 0.016 * s });
  for (const [, sd] of SIDES) {
    sk.put(ell(P([0.031 * sd, 1.668, 0.094]), [0.019 * s, 0.013 * s, 0.02 * s]), { op: 'sub', k: 0.012 * s });
    sk.put(ell(P([0.047 * sd, 1.645, 0.068]), [0.024 * s, 0.017 * s, 0.02 * s]), { k: 0.02 * s });
    if (shut) sk.put(ell(P([0.031 * sd, 1.664, 0.086]), [0.017 * s, 0.006 * s, 0.01 * s]), { k: 0.006 * s });
    else eyes?.put(ball(P([0.031 * sd, 1.666, 0.08]), 0.0125 * s));
  }
  sk.put(cone(P([0, 1.6, 0.0]), P([0, 1.47, -0.02]), 0.05 * s, 0.058 * s), { bone: sk.bone === PALL_IX.head ? PALL_IX.head : B.neck });
  sk.displace((x, y, z) => 0.001 * s * fbm(x * 60 / s, y * 60 / s, z * 60 / s, 2), 0.002 * s);
  // the coif: close linen round the head, open only at the face
  coif.put(any((x, y, z) => { const q = P([0, 1.68, -0.006]), e = ell(q, [0.083 * s, 0.108 * s, 0.098 * s])[0](x, y, z), lz = (z - q[2]) / s, ly = (y - q[1]) / s; return Math.max(Math.abs(e) - 0.0055 * s, Math.min(lz - 0.035 - 0.25 * Math.max(0, ly - 0.02), (0.052 - ly) * 1.0, (ly + 0.1) * 1.0) * s); }, P([0, 1.66, 0]), 0.16 * s));
  coif.put(cone(P([0, 1.6, -0.02]), P([0, 1.46, -0.03]), 0.072 * s, 0.1 * s), { bone: sk.bone === PALL_IX.head ? PALL_IX.head : B.neck, k: 0.03 * s });
  coif.displace((x, y, z) => -0.002 * s * ridged(x * 40 / s, y * 26 / s, z * 40 / s, 2), 0.003 * s);
}
const B = boneIndex(SISTER), at = (n: string) => SISTER[B[n]].pos as V3, PALL_IX = boneIndex(PALL_BONES);

/** The Sister of Hours: upright, heavy-shouldered, layered grey linen gone stiff and black with soot from the knees down; the starched two-pointed hood; a breath-cloth over the mouth; sleeves bound back with cord; a counting cord at her belt. */
export async function sister(): Promise<Mesh> {
  const parts: Part[] = [], F = (k: number, voxel: number, mat: number, tris: number, soft = 0.02) => { const f = new Field(k); parts.push([f, voxel, mat, tris, soft]); return f; };
  const sk = F(0.02, 0.0034, 35, 9000, 0.016), eyes = F(0, 0.002, 8, 500), coif = F(0.02, 0.004, 32, 3200), robe = F(0.05, 0.006, 32, 9000, 0.025), wrap = F(0.006, 0.0036, 32, 3600), rope = F(0.008, 0.0035, 11, 3200), mouth = F(0.01, 0.0036, 34, 1800);
  sk.bone = B.head; coif.bone = B.head; eyes.bone = B.head; face(sk, coif, eyes, p => p, 1, false);
  // --- the breath-cloth over the mouth and nose, hanging in a fold below the chin
  mouth.bone = B.head; mouth.put(any((x, y, z) => { const e = ell([0, 1.632, 0.016], [0.08, 0.08, 0.1])[0](x, y, z); return Math.max(Math.abs(e) - 0.005, 0.03 - z, y - 1.664 - 0.006 * Math.cos(x * 30)); }, [0, 1.62, 0.07], 0.14));

  mouth.displace((x, y, z) => -0.0025 * ridged(x * 30, y * 60, z * 20, 2), 0.004);
  // --- arms: bare grey forearms, linen wound at the wrists, hands closed on a shaft
  for (const [S, s] of SIDES) {
    const e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s), d = mir(D, s), n: V3 = [-0.766 * s, -0.643, 0];
    const P = (al: number, nn: number, zz: number, o: V3 = w): V3 => [o[0] + d[0] * al + n[0] * nn, o[1] + d[1] * al + n[1] * nn, o[2] + zz];
    sk.bone = B['foreArm.' + S]; sk.put(cone(e, w, 0.038, 0.026)).put(belly(P(-0.02, 0.012, 0.012, e), P(-0.04, 0.004, 0.008), 0.02, 0.043, 0.015, 0.28), { k: 0.02 });
    sk.bone = B['hand.' + S]; sk.put(ell(P(0.012, 0, 0), [0.027, 0.023, 0.03]), { k: 0.02 }).put(ell(P(0.052, -0.002, 0.004), [0.036, 0.021, 0.04]), { k: 0.02 });
    for (let i = 0; i < 4; i++) {
      const z = 0.033 - i * 0.022, r = [0.011, 0.0115, 0.011, 0.0096][i], L = [0.94, 1, 0.95, 0.82][i], k0 = P(0.09, -0.006, z), k1 = P(0.122 * L, 0.008, z * 1.04), k2 = P(0.11 * L, 0.046, z * 1.04), k3 = P(0.08, 0.054, z);
      sk.put(cone(k0, k1, r * 1.1, r), { k: 0.007 }).put(ball(k0, r * 1.18), { k: 0.01 }).put(cone(k1, k2, r, r * 0.92), { k: 0.005 }).put(cone(k2, k3, r * 0.92, r * 0.8), { k: 0.005 });
    }
    sk.put(cone(P(0.025, 0.02, 0.035), P(0.07, 0.05, 0.05), 0.014, 0.011), { k: 0.01 });
    // linen wound at the wrist
    const wp: V3[] = [], ax = norm(sub(w, e)), q1 = norm(cross(ax, [0, 0, 1])), q2 = cross(ax, q1);
    for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * 6.283 * 5, p = lerp3(e, w, 0.7 + 0.28 * t), r = mix(0.034, 0.027, t) + 0.002; wp.push(add(p, add(mul(q1, Math.cos(a) * r), mul(q2, Math.sin(a) * r)))); }
    wrap.put(tube(wp, () => 0.006), { bone: B['foreArm.' + S], k: 0.006 });
    // sleeves: wide, rolled back above the elbow and bound with cord
    const u = mir(at('upperArm.L'), s);
    robe.put(cone(add(u, [0, -0.01, 0]), lerp3(u, e, 0.88), 0.058, 0.052), { bone: B['upperArm.' + S], k: 0.03 }).put(ell(lerp3(u, e, 0.8), [0.058, 0.05, 0.058]), { bone: B['upperArm.' + S], k: 0.03 });
    robe.put(ell(add(u, [0.01 * s, 0.0, -0.005]), [0.07, 0.065, 0.07]), { bone: B['upperArm.' + S], k: 0.04 });
    const cp: V3[] = [], c0 = lerp3(u, e, 0.74), ax2 = norm(sub(e, u)), r1 = norm(cross(ax2, [0, 0, 1])), r2 = cross(ax2, r1); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283 * 2, p = add(c0, mul(ax2, i / 40 * 0.03)); cp.push(add(p, add(mul(r1, Math.cos(a) * 0.055), mul(r2, Math.sin(a) * 0.055)))); }
    rope.put(tube(cp, () => 0.0075), { bone: B['upperArm.' + S], k: 0.004 });
  }
  wrap.displace((x, y, z) => 0.0015 * noise(x * 90, y * 90, z * 90), 0.002);
  // --- the body under the linen: heavy shoulders, a deep chest, an upright back
  robe.bone = B.chest; robe.put(ell([0, 1.33, -0.012], [0.165, 0.165, 0.118])).put(ell([0, 1.42, -0.02], [0.2, 0.065, 0.11]), { k: 0.06 });
  for (const [, s] of SIDES) robe.put(ell(mir([0.075, 1.31, 0.075], s), [0.08, 0.075, 0.05], [0.25, 0, 0]), { k: 0.05 });
  robe.put(ell([0, 1.19, -0.008], [0.14, 0.15, 0.11]), { bone: B.spine2, k: 0.07 }).put(ell([0, 1.07, -0.005], [0.125, 0.12, 0.1]), { bone: B.spine1, k: 0.07 }).put(ell([0, 0.99, -0.01], [0.17, 0.09, 0.13]), { bone: B.hips, k: 0.06 });
  // the wimple: linen from under the chin over the shoulders, front and back
  robe.put(any((x, y, z) => { const e = ell([0, 1.43, -0.01], [0.21, 0.16, 0.15])[0](x, y, z); return Math.max(Math.abs(e) - 0.01, 1.37 - y + 0.03 * Math.sin(Math.atan2(x, z) * 7) - 0.02 * Math.cos(x * 9)); }, [0, 1.45, 0], 0.3), { k: 0.03 });
  const cape = F(0.04, 0.0055, 32, 6000, 0.03); cape.bone = B.chest;
  cape.put(any((x, y, z) => { const e = ell([0, 1.36, -0.015], [0.235, 0.23, 0.175])[0](x, y, z), a = Math.atan2(x, z), hem = 1.2 - 0.07 * Math.cos(a) + 0.03 * Math.sin(a * 9) + 0.02 * noise(x * 12, 3, z * 12); return Math.max(Math.abs(e) - 0.01, hem - y, y - 1.5 - 0.02 * Math.cos(x * 8)); }, [0, 1.36, 0], 0.4), { k: 0.02 });
  for (const [S, sd] of SIDES) cape.put(any((x, y, z) => { const c: V3 = [0.2 * sd, 1.4, -0.01], e = ell(c, [0.12, 0.09, 0.12])[0](x, y, z); return Math.max(Math.abs(e) - 0.009, 1.33 - y); }, [0.2 * sd, 1.4, 0], 0.15), { bone: B['upperArm.' + S], k: 0.02 });
  cape.displace((x, y, z) => { const a = Math.atan2(x, z); return -0.008 * ridged(a * 5 + noise(x * 7, y * 7, z * 7) * 0.5, y * 4, 3, 2) * sstep(1.45, 1.25, y) + 0.003; }, 0.01);
  // the scapular: a long panel of linen down the front, belted
  const scap = F(0.02, 0.005, 32, 2600, 0.03);
  for (const [zz, bone, y0, y1] of [[0.135, B.chest, 1.42, 1.2], [0.128, B.spine2, 1.22, 1.08], [0.13, B.spine1, 1.1, 1.0]] as const) scap.put(any((x, y, z) => Math.max(Math.abs(x) - 0.085 - 0.01 * (1.4 - y), Math.abs(z - zz + (1.42 - y) * 0.04) - 0.006, y - y0, y1 - y), [0, (y0 + y1) / 2, zz], 0.25), { bone, k: 0.02 });
  scap.displace((x, y, z) => -0.003 * ridged(x * 30, y * 8, z, 2), 0.005);
  robe.displace((x, y, z) => { const a = Math.atan2(x, z); return -0.009 * ridged(a * 3.4 + noise(x * 6, y * 6, z * 6) * 0.6, y * 3.5, 2, 2) * sstep(1.48, 1.2, y) - 0.004 * ridged(x * 20, y * 20, z * 20, 2) + 0.006; }, 0.014);
  // the counting cord: round the waist, then down from the right hip, seven knots
  { const w: V3[] = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283; w.push([Math.sin(a) * 0.178, 1.035 + 0.012 * Math.sin(a * 2), -0.012 + Math.cos(a) * 0.142]); } rope.put(tube(w, () => 0.009), { bone: B.spine1 });
    const h = curve([[-0.12, 1.03, 0.1], [-0.15, 0.92, 0.17], [-0.16, 0.78, 0.2], [-0.14, 0.62, 0.21]], 22); rope.put(tube(h, () => 0.006), { bone: B.hips }); for (let k = 0; k < 7; k++) rope.put(ell(h[3 + k * 3], [0.011, 0.014, 0.011]), { bone: B.hips, k: 0.004 }); }
  rope.displace((x, y, z) => 0.0018 * Math.sin((x + y * 1.7 + z) * 300), 0.002);
  const out = await bakeParts(parts, 0.16, (mat, v) => mat === 35 ? Math.round(0.03 / v) : mat === 32 ? Math.round(0.05 / v) : 0);
  // --- the hood
  out.push(sheet(cornette(), { nu: 70, nv: 14, mat: 34, inner: 32, weights: () => [[B.head, 1]] }));
  // --- the skirts: a long one to the floor, soot from the knee down; over it a shorter one, torn
  out.push(...banded((u, v) => skirtAt(u, v), [[0, 0.42, 32], [0.42, 0.62, 33], [0.62, 1, 33]], { nu: 96, nv: 40, tatter: 0.06, seed: 5, weights: (u, v) => skirtWeights(B, u, v) }));
  out.push(...banded((u, v) => { const p = skirtAt(u, v * 0.64, 1.5), k = 1.07 + 0.03 * v; return [p[0] * k, p[1] + 0.025, (p[2] + 0.01) * k - 0.01]; }, [[0, 0.68, 32], [0.68, 1, 33]], { nu: 96, nv: 26, tatter: 0.32, seed: 13, weights: (u, v) => skirtWeights(B, u, v * 0.64) }));
  // the strips that trail from her arms
  for (const s of STRIPS) { const r = stripRoot(s.side, s.at), sd = s.side === 'L' ? 1 : -1, w = 0.045 + 0.012 * s.k; out.push(sheet((u, v) => [r[0] + (u - 0.5) * w * sd + 0.02 * sd * v, r[1] - STRIP_LEN * v * (0.85 + 0.15 * s.k), r[2] - 0.01 * v + 0.012 * Math.sin(v * 7 + s.k)], { nu: 3, nv: 18, mat: 32, tatter: 0.5, seed: 31 + s.k * 7 + sd, weights: (_u, v) => stripWeights(B, s.side, s.k, v) })); }
  return merge(out);
}

/** A flat blade in the XY plane, hung below a spine (a polyline, root to tip): `w(t)` deep, thick at the spine and drawn to an edge. */
function blade(spine: [number, number][], w: (t: number) => number, thick: number): ReturnType<typeof any> {
  const n = spine.length - 1, L: number[] = [0]; for (let i = 0; i < n; i++) L.push(L[i] + Math.hypot(spine[i + 1][0] - spine[i][0], spine[i + 1][1] - spine[i][1])); const T = L[n];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of spine) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const c: V3 = [(x0 + x1) / 2, (y0 + y1) / 2 - 0.15, 0], r = Math.hypot(x1 - x0, y1 - y0) / 2 + 0.45;
  return any((x, y, z) => {
    let best = 1e9, off = 0, tt = 0, cap = false;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = spine[i], [bx, by] = spine[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), px = ax + dx * u, py = ay + dy * u, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; const l = Math.sqrt(l2); off = ((x - ax) * -dy + (y - ay) * dx) / l; tt = (L[i] + u * l) / T; cap = (i === 0 && u <= 0) || (i === n - 1 && u >= 1); }
    }
    const W = w(tt), below = -off, d2 = cap || below <= 0 ? best : below > W ? below - W : -Math.min(below, W - below), k = Math.max(0, Math.min(1, below / Math.max(W, 1e-3)));
    return Math.max(d2, Math.abs(z) - (0.0025 + thick * Math.pow(1 - k, 1.4) * (1 - 0.6 * tt)));
  }, c, r);
}

/** Her scythe: 3.5 m of black iron, an hour-ring of brass where the blade meets the haft, and a long blade drooping forward, its edge kept red. The grip of the lower hand is the origin; the haft runs up +Y and the blade reaches toward +X. */
export async function scythe(): Promise<Mesh> {
  const f = new Field(0.012), br = new Field(0.008), bl = new Field(0.006), ed = new Field(0.004), cl = new Field(0.01);
  // the haft: slightly bent, banded, a spike at the foot
  const haft = curve([[0, -0.95, 0], [0.02, 0.5, 0], [0.0, 1.6, 0], [-0.03, 2.62, 0]], 24); f.put(tube(haft, t => 0.032 - 0.006 * t), { k: 0.01 });
  f.put(cone([0, -0.95, 0], [0, -1.18, 0], 0.03, 0.004), { k: 0.008 });
  for (const y of [-0.8, 0.9, 1.85]) br.put(cone([0, y - 0.035, 0], [0, y + 0.035, 0], 0.04, 0.04), { k: 0.006 });
  f.put(cone([-0.03, 2.5, 0], [-0.02, 2.74, 0], 0.046, 0.04), { k: 0.012 }).put(ball([-0.02, 2.76, 0], 0.045));
  f.displace((x, y, z) => 0.003 * fbm(x * 20, y * 4, z * 20, 3) + 0.002 * ridged(x * 50, y * 30, z * 50, 2), 0.005);
  // the hour-ring: a brass dial round the head, twelve marks on it
  const RC: V3 = [-0.02, 2.5, 0], R = 0.3; br.put(any((x, y, z) => Math.hypot(Math.hypot(x - RC[0], y - RC[1]) - R, z) - 0.017, RC, R + 0.05), { k: 0.004 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, p: V3 = [RC[0] + Math.cos(a) * R, RC[1] + Math.sin(a) * R, 0]; br.put(ell(p, [0.026, 0.026, 0.022]), { k: 0.006 }); }
  br.put(cone([RC[0] - R, RC[1], 0], [RC[0] + R, RC[1], 0], 0.009, 0.009), { k: 0.004 }).put(cone([RC[0], RC[1] - R, 0], [RC[0], RC[1] + R, 0], 0.009, 0.009), { k: 0.004 });
  // the blade: a long crescent; black on the flat, the last finger of it toward the edge glowing
  const spine: [number, number][] = [[-0.02, 2.66], [0.3, 2.86], [0.72, 2.94], [1.15, 2.86], [1.52, 2.64], [1.8, 2.32], [1.96, 1.98]];
  const W = (t: number) => (0.27 * Math.pow(1 - t, 0.8) + 0.012) * Math.min(1, 0.55 + t * 8);
  bl.put(blade(spine, t => W(t) * 0.8, 0.018), { k: 0.004 });
  ed.put(blade(spine, W, 0.012), { k: 0.002 });
  bl.put(ell([0.04, 2.63, 0], [0.09, 0.07, 0.035]), { k: 0.02 });
  bl.displace((x, y, z) => 0.0015 * ridged(x * 30, y * 30, z * 30, 2), 0.003);
  // a counting cord knotted to the ring, and linen tied under it, burned at the ends
  const c0: V3 = [-0.02, 2.2, 0.02]; cl.put(tube(curve([c0, [0.06, 1.95, 0.05], [0.04, 1.62, 0.04]], 14), () => 0.008), { k: 0.004 }); for (let k = 0; k < 7; k++) cl.put(ball([0.04 + 0.015 * Math.sin(k), 1.98 - k * 0.05, 0.045], 0.016), { k: 0.004 });
  for (let k = 0; k < 3; k++) { const a = k * 2.1, p0: V3 = [Math.sin(a) * 0.04, 2.3 - k * 0.04, Math.cos(a) * 0.04]; cl.put(tube(curve([p0, add(p0, [Math.sin(a) * 0.05, -0.15, Math.cos(a) * 0.05]), add(p0, [Math.sin(a) * 0.04, -0.4 - k * 0.1, Math.cos(a) * 0.06])], 10), t => 0.018 - 0.008 * t), { k: 0.01 }); }
  cl.put(cone([0, 2.26, 0], [0, 2.36, 0], 0.05, 0.05), { k: 0.01 }); cl.displace((x, y, z) => 0.003 * ridged(x * 40, y * 40, z * 40, 2), 0.004);
  return merge(await bakeParts([[f, 0.008, 4, 1800], [br, 0.006, 37, 900], [bl, 0.005, 4, 1400], [ed, 0.004, 42, 900], [cl, 0.007, 33, 700]], 0.1));
}

/** The Pall: a dome of soot-black linen six metres high, eight across the hem, nothing under it but the hours. At the top, small and unchanged, her face with its eyes shut, under the two points of the hood. */
export async function pall(): Promise<Mesh> {
  const S = 1.45, top: V3 = [0, PALL.head, 0.02], T = (p: V3): V3 => [p[0] * S + top[0], (p[1] - 1.66) * S + top[1], p[2] * S + top[2]];
  const parts: Part[] = [], F = (k: number, voxel: number, mat: number, tris: number) => { const f = new Field(k); parts.push([f, voxel, mat, tris]); return f; };
  const sk = F(0.02 * S, 0.0045, 35, 4200), coif = F(0.02 * S, 0.006, 33, 2400); sk.bone = PALL_IX.head; coif.bone = PALL_IX.head; face(sk, coif, null, T, S, true);
  // the dome's shoulder, where the hood's linen goes into it
  coif.put(cone(T([0, 1.5, -0.02]), [0, PALL.H - 0.25, 0], 0.13 * S, PALL.neck + 0.12), { bone: PALL_IX.crown, k: 0.08 });
  const out = await bakeParts(parts, 0.2, (mat, v) => mat === 35 ? Math.round(0.04 / v) : 0);
  out.push(sheet(cornette(T, 1.25), { nu: 70, nv: 14, mat: 34, inner: 33, weights: () => [[PALL_IX.head, 1]] }));
  out.push(...banded((u, v) => domeAt(u, v), [[0, 0.85, 40], [0.85, 1, 40]], { nu: 150, nv: 54, inner: 33, tatter: 0.16, seed: 19, weights: (u, v) => domeWeights(PALL_IX, u, v) }));
  return merge(out);
}
/** What Last Rites leaves of her: hoops of iron in the shape of the dome, and the scythe's socket at the back. */
export async function pallFrame(): Promise<Mesh> {
  const f = new Field(0.03), r = rng(4);
  for (const v of [0.18, 0.4, 0.62, 0.84]) { const ring: V3[] = []; for (let i = 0; i <= 48; i++) ring.push(domeAt(i / 48, v, 0).map((c, k) => k === 1 ? c : c * 0.93) as V3); f.put(tube(ring, () => 0.045 + 0.01 * r()), { k: 0.02, bone: v < 0.3 ? PALL_IX.crown : PALL_IX.root }); }
  for (let i = 0; i < 8; i++) { const rib: V3[] = []; for (let j = 0; j <= 16; j++) rib.push(domeAt(i / 8 + 0.03, 0.12 + j / 16 * 0.8, 0).map((c, k) => k === 1 ? c : c * 0.92) as V3); f.put(tube(rib, () => 0.04), { k: 0.02, bone: PALL_IX.root }); }
  f.displace((x, y, z) => 0.012 * fbm(x * 3, y * 3, z * 3, 3), 0.016);
  return merge(await bakeParts([[f, 0.03, 12, 5000]], 0.3));
}
void box;
