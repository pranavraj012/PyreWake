// The Hanged King, round 1 body: four metres of starved, stitched-together corpse.
import { KING, boneIndex } from '../../src/anim/skeletons.ts';
import { Field, add, any, ball, belly, box, clamp, cone, curve, ell, fbm, lerp3, mix, mul, noise, norm, ridged, rng, sstep, sub, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';
import { sheet, strand } from '../sheet.ts';

const b = boneIndex(KING), at = (n: string) => KING[b[n]].pos as V3;
const SIDES = [['L', 1], ['R', -1]] as const;
const mir = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];

export async function king(): Promise<Mesh> {
  const parts: [Field, number, number, number, number][] = [];
  const F = (k: number, voxel: number, mat: number, tris: number, soft = 0.04) => { const f = new Field(k); parts.push([f, voxel, mat, tris, soft]); return f; };

  const sk = F(0.06, 0.0105, 9, 30000);
  // --- pelvis, gut, rib cage
  sk.bone = b.hips;
  sk.put(ell([0, 1.86, -0.03], [0.17, 0.13, 0.12]));
  for (const [, s] of SIDES) sk.put(ell([0.16 * s, 1.93, -0.01], [0.055, 0.12, 0.13], [0, 0, -0.35 * s]), { k: 0.04 }).put(cone([0.2 * s, 2.0, 0.07], [0.15 * s, 2.02, -0.12], 0.032, 0.03), { k: 0.05 });
  sk.put(ell([0, 2.1, -0.06], [0.13, 0.22, 0.1]), { bone: b.spine1 }).put(ell([0, 2.3, -0.09], [0.145, 0.2, 0.11]), { bone: b.spine2 });
  sk.put(ell([0, 2.72, -0.15], [0.285, 0.4, 0.245], [0.22, 0, 0]), { bone: b.chest, k: 0.1 }).put(ell([0, 2.95, -0.2], [0.285, 0.21, 0.22]), { bone: b.chest, k: 0.1 });
  // ribs pressing through the skin
  for (let i = 0; i < 9; i++) for (const [, s] of SIDES) {
    const y = 3.0 - i * 0.082, w = 0.21 + 0.075 * Math.sin((i + 1.2) / 10 * Math.PI), drop = 0.07 + i * 0.017, zc = -0.2 + (2.95 - y) * 0.2;
    const pts = curve([[0.03 * s, y + 0.04, zc - 0.19], [w * 0.75 * s, y + 0.03, zc - 0.17], [(w + 0.03) * s, y - drop * 0.35, zc + 0.02], [w * 0.75 * s, y - drop * 0.9, zc + 0.2], [(0.05 + Math.max(0, i - 5) * 0.045) * s, y - drop - 0.02, zc + 0.235]], 12);
    pts.slice(1).forEach((p, j) => sk.put(cone(pts[j], p, 0.025, 0.025), { bone: y > 2.52 ? b.chest : b.spine2, k: 0.055 }));
  }
  // spine knobs
  for (let i = 0; i < 17; i++) {
    const t = i / 16, p = curve([[0, 1.9, -0.16], [0, 2.1, -0.185], [0, 2.4, -0.27], [0, 2.75, -0.39], [0, 3.02, -0.37], [0, 3.2, -0.24], [0, 3.36, -0.1]], 16)[i];
    sk.put(ell(p, [0.034, 0.03, 0.05 - t * 0.008], [0.4, 0, 0]), { bone: i < 4 ? b.spine1 : i < 7 ? b.spine2 : i < 12 ? b.chest : b.neck, k: 0.04 });
  }
  // --- neck cords and eyeless head
  sk.put(cone([0, 3.05, -0.16], [0, 3.3, 0.0], 0.105, 0.085), { bone: b.neck, k: 0.09 }).put(cone([0, 3.3, 0.0], [0, 3.44, 0.1], 0.085, 0.085), { bone: b.neck2 });
  for (const [, s] of SIDES) sk.put(belly([0.17 * s, 3.1, -0.1], [0.08 * s, 3.45, 0.1], 0.02, 0.034), { bone: b.neck, k: 0.03 }).put(cone([0.03 * s, 3.02, 0.05], [0.05 * s, 3.36, 0.17], 0.022, 0.018), { bone: b.neck2, k: 0.03 });
  sk.bone = b.head;
  sk.put(ell([0, 3.57, 0.16], [0.15, 0.17, 0.2])).put(ell([0, 3.43, 0.27], [0.098, 0.2, 0.11], [0.25, 0, 0]), { k: 0.09 });
  for (const [, s] of SIDES) sk.put(ell([0.1 * s, 3.47, 0.29], [0.05, 0.04, 0.07], [0, 0.5 * s, 0.3 * s]), { k: 0.05 }).put(ell([0.066 * s, 3.545, 0.35], [0.048, 0.036, 0.04]), { op: 'sub', k: 0.05 }).put(ell([0.105 * s, 3.39, 0.3], [0.03, 0.09, 0.06]), { op: 'sub', k: 0.06 });

  // --- limbs
  for (const [S, s] of SIDES) {
    const thick = s > 0 ? 1.2 : 1.0; // the left arm came from someone bigger
    const c = mir(at('clav.L'), s), u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s);
    sk.put(cone(c, u, 0.04, 0.05), { bone: b['clav.' + S], k: 0.05 }).put(ell([0.22 * s, 2.92, -0.34], [0.11, 0.18, 0.04], [0.25, 0.35 * s, 0.25 * s]), { bone: b['clav.' + S], k: 0.06 }).put(cone([0.14 * s, 3.0, -0.4], [0.4 * s, 3.1, -0.22], 0.025, 0.03), { bone: b['clav.' + S], k: 0.04 });
    sk.bone = b['upperArm.' + S];
    sk.put(ball(u, 0.085 * thick), { k: 0.08 }).put(belly(u, e, 0.062 * thick, 0.074 * thick, 0.05 * thick, 0.35)).put(belly(lerp3(u, e, 0.05), lerp3(u, e, 0.9), 0.03, 0.056 * thick, 0.02, 0.4), { k: 0.04 });
    sk.put(ell(lerp3(u, e, 0.14), [0.09 * thick, 0.14, 0.085 * thick]), { k: 0.06 });
    sk.bone = b['foreArm.' + S];
    sk.put(ell(e, [0.075 * thick, 0.08, 0.085 * thick]), { k: 0.06 }).put(ball(add(e, [0.01 * s, 0.0, -0.06]), 0.04 * thick), { k: 0.04 });
    const off: V3 = [0.02, 0.01, 0.034];
    sk.put(cone(add(e, off), add(w, mul(off, 0.8)), 0.042 * thick, 0.03 * thick), { k: 0.035 }).put(cone(sub(e, off), sub(w, mul(off, 0.8)), 0.04 * thick, 0.027 * thick), { k: 0.035 });
    sk.put(belly(lerp3(e, w, 0.03), lerp3(e, w, 0.7), 0.04, 0.068 * thick, 0.02, 0.22), { k: 0.05 });
    // hand: long fused digits
    sk.bone = b['hand.' + S];
    sk.put(ell(add(w, [0.0, 0.0, 0]), [0.048, 0.06, 0.058]), { k: 0.04 }).put(ell(add(w, [0.045 * s, -0.11, 0.0]), [0.035, 0.11, 0.1], [0, 0, 0.42 * s]), { k: 0.05 });
    for (let i = 0; i < 4; i++) {
      const A = mir(at(`f${i}a.L`), s), Bp = mir(at(`f${i}b.L`), s), L = [0.95, 1.1, 1.05, 0.85][i], tip = add(Bp, mul(norm(sub(Bp, A)), 0.16 * L)); tip[0] -= 0.035 * s;
      sk.bone = b['hand.' + S]; sk.put(cone(w, A, 0.032, 0.026), { k: 0.03 });
      sk.bone = b[`f${i}a.${S}`]; sk.put(cone(A, Bp, 0.022, 0.02), { k: 0.02 }).put(ball(A, 0.031), { k: 0.025 });
      sk.bone = b[`f${i}b.${S}`]; sk.put(cone(Bp, tip, 0.02, 0.013), { k: 0.015 }).put(ball(Bp, 0.026), { k: 0.02 });
    }
    sk.bone = b['thumb.' + S]; const th = mir(at('thumb.L'), s);
    sk.put(cone(add(th, [0, 0.05, -0.05]), th, 0.034, 0.026), { k: 0.03 }).put(cone(th, add(th, [0.02 * s, -0.16, 0.09]), 0.024, 0.014), { k: 0.02 });

    const h = mir(at('thigh.L'), s), k = mir(at('shin.L'), s), f = mir(at('foot.L'), s), t = mir(at('toe.L'), s);
    sk.bone = b['thigh.' + S];
    sk.put(ell(add(h, [0.02 * s, 0.02, -0.01]), [0.09, 0.12, 0.11]), { k: 0.08 }).put(cone(h, k, 0.085, 0.058)).put(belly(add(h, [0.02 * s, -0.05, 0.03]), add(k, [0, 0.08, 0.02]), 0.04, 0.08, 0.025, 0.4), { k: 0.04 }).put(belly(add(h, [0, -0.05, -0.04]), add(k, [-0.02 * s, 0.03, -0.04]), 0.04, 0.062, 0.018, 0.35), { k: 0.035 });
    sk.bone = b['shin.' + S];
    sk.put(ell(add(k, [0, 0, 0.015]), [0.074, 0.088, 0.082]), { k: 0.05 }).put(ball(add(k, [0, 0.01, 0.07]), 0.045), { k: 0.04 }).put(cone(add(k, [0, -0.03, 0.02]), add(f, [0, 0, 0.015]), 0.052, 0.034)).put(belly(add(k, [0, -0.02, -0.03]), add(f, [0, 0.05, -0.035]), 0.03, 0.066, 0.014, 0.28), { k: 0.04 });
    sk.bone = b['foot.' + S];
    sk.put(ell(add(f, [0, -0.06, -0.06]), [0.05, 0.08, 0.075]), { k: 0.05 }).put(ball(add(f, [0.05 * s, 0.0, 0]), 0.034), { k: 0.03 }).put(cone(add(f, [0, -0.02, 0.02]), add(t, [0, 0.02, 0]), 0.055, 0.045));
    sk.bone = b['toe.' + S];
    for (let i = 0; i < 5; i++) { const z = t[2] + 0.02 - Math.abs(i - 1.5) * 0.015, x = t[0] + (i - 2) * 0.032 * s; sk.put(cone([x * 1 - 0.0, 0.05, t[2] - 0.02], [x + (i - 2) * 0.012 * s, 0.028, z + 0.11 - i * 0.012], 0.026, 0.017), { k: 0.02 }); }
  }
  // --- grafted withered arm under the right ribs
  const g0 = at('graft1'), g1 = at('graft2'), g2: V3 = [-0.36, 2.06, 0.3];
  sk.put(ball(g0, 0.06), { bone: b.graft1, k: 0.07 }).put(cone(g0, g1, 0.042, 0.03), { bone: b.graft1, k: 0.04 }).put(ball(g1, 0.04), { bone: b.graft2, k: 0.03 }).put(cone(g1, g2, 0.032, 0.022), { bone: b.graft2, k: 0.03 });
  for (let i = 0; i < 4; i++) { const p = add(g2, [0.02 + (i - 1.5) * 0.02, -0.1, 0.045 - i * 0.012]); sk.put(cone(g2, p, 0.016, 0.013), { bone: b.graft2, k: 0.012 }).put(cone(p, add(p, [0.015, -0.055, -0.04]), 0.013, 0.008), { bone: b.graft2, k: 0.006 }); }
  // --- a second face, pressed flat beneath the belly skin
  const fc: V3 = [0.055, 2.29, 0.02]; sk.bone = b.spine2;
  sk.put(ell(fc, [0.085, 0.12, 0.05], [-0.1, 0.1, 0.15]), { k: 0.05 }).put(cone(add(fc, [0.0, 0.03, 0.05]), add(fc, [0.005, -0.02, 0.063]), 0.012, 0.018), { k: 0.03 });
  for (const s of [1, -1]) sk.put(ell(add(fc, [0.033 * s, 0.035, 0.055]), [0.023, 0.017, 0.022]), { op: 'sub', k: 0.02 });
  sk.put(ell(add(fc, [0.0, -0.062, 0.052]), [0.024, 0.036, 0.026]), { op: 'sub', k: 0.02 });

  // --- the vertical mouth, brow to breastbone
  const slit = curve([[0, 3.56, 0.37], [0, 3.46, 0.39], [0, 3.35, 0.34], [0, 3.22, 0.15], [0, 3.08, 0.06], [0, 2.92, 0.07], [0, 2.74, 0.115]], 24);
  const gape = (t: number) => 0.014 + 0.068 * Math.pow(Math.sin(clamp(t * 0.96 + 0.03) * Math.PI), 0.75);
  const slitSdf = tube(slit, gape);
  sk.put(slitSdf, { op: 'sub', k: 0.035 });
  // lips: a raised, torn rim
  for (const s of [1, -1]) { const rim = slit.map((p, i) => [s * (gape(i / 24) + 0.012), p[1], p[2] - 0.012] as V3); rim.slice(1).forEach((p, i) => sk.put(cone(rim[i], p, 0.013, 0.013), { bone: p[1] > 3.36 ? b.head : p[1] > 3.2 ? b.neck2 : p[1] > 3.02 ? b.neck : b.chest, k: 0.03 })); }
  sk.displace((x, y, z) => 0.006 * fbm(x * 7, y * 7, z * 7, 3) - 0.0055 * ridged(x * 16, y * 9, z * 16, 2) + 0.004 + 0.0016 * noise(x * 60, y * 60, z * 60), 0.012);

  // --- mouth interior
  const gum = F(0.02, 0.011, 15, 1600);
  slit.slice(1).forEach((p, i) => gum.put(cone(add(slit[i], [0, 0, -0.11]), add(p, [0, 0, -0.11]), gape(i / 24) + 0.006, gape((i + 1) / 24) + 0.006), { bone: p[1] > 3.36 ? b.head : p[1] > 3.2 ? b.neck2 : p[1] > 3.02 ? b.neck : b.chest }));
  gum.displace((x, y, z) => -0.01 * ridged(x * 14, y * 14, z * 14, 2), 0.011);
  // --- teeth, crowded and uneven
  const teeth = F(0.0, 0.006, 10, 5200), r = rng(7);
  for (let i = 0; i < 46; i++) for (const s of [1, -1]) {
    const t = 0.03 + i / 46 * 0.93, q = t * 24, j = Math.min(23, Math.floor(q)), p = lerp3(slit[j], slit[j + 1], q - j), g = gape(t);
    if (r() < 0.12) continue;
    const L = (0.03 + r() * 0.045) * (0.45 + g * 9), base: V3 = [s * (g + 0.012), p[1] + (r() - 0.5) * 0.012, p[2] - 0.02 - r() * 0.02];
    const tip: V3 = [s * Math.max(0.0, g + 0.008 - L), base[1] + (r() - 0.5) * 0.03, base[2] + 0.012 + r() * 0.03];
    teeth.put(cone(base, tip, 0.0125 + r() * 0.006, 0.002), { bone: p[1] > 3.36 ? b.head : p[1] > 3.2 ? b.neck2 : p[1] > 3.02 ? b.neck : b.chest });
  }
  // --- nails
  const nails = F(0.004, 0.006, 10, 1100);
  for (const [S, s] of SIDES) for (let i = 0; i < 4; i++) {
    const A = mir(at(`f${i}a.L`), s), Bp = mir(at(`f${i}b.L`), s), L = [0.95, 1.1, 1.05, 0.85][i], d = norm(sub(Bp, A)), tip = add(Bp, mul(d, 0.15 * L)); tip[0] -= 0.033 * s;
    nails.put(cone(tip, add(tip, add(mul(d, 0.09), [-0.035 * s, 0, 0])), 0.0125, 0.002), { bone: b[`f${i}b.${S}`] });
  }
  // --- rope: ankle nooses, stitches across neck, shoulders and belly
  const rope = F(0.004, 0.0075, 11, 5000);
  const coil = (c: V3, rx: number, rz: number, n: number, dy: number, bone: number, rad = 0.02) => { const p: V3[] = []; for (let i = 0; i <= n * 22; i++) { const a = i / 22 * Math.PI * 2; p.push([c[0] + Math.sin(a) * rx, c[1] + dy * i / 22 + 0.01 * Math.sin(a * 1.5), c[2] + Math.cos(a) * rz]); } p.slice(1).forEach((q, i) => rope.put(cone(p[i], q, rad, rad), { bone })); };
  for (const [S, s] of SIDES) {
    const f = mir(at('foot.L'), s); coil(add(f, [0, 0.09, 0.005]), 0.066, 0.07, 4, 0.034, b['shin.' + S], 0.021);
    rope.put(tube(curve([add(f, [0.06 * s, 0.14, 0]), add(f, [0.12 * s, 0.05, 0.05]), add(f, [0.16 * s, -0.08, 0.02]), add(f, [0.2 * s, -0.12, -0.1])], 10), t => 0.019 * (1 - t * 0.5)), { bone: b['shin.' + S] });
  }
  coil([0, 2.02, -0.04], 0.2, 0.165, 3, 0.036, b.hips, 0.021);
  const stitch = (p: V3, d: V3, bone: number) => rope.put(tube(curve([sub(p, mul(d, 0.05)), add(p, [0, 0.0, 0]), add(p, mul(d, 0.05))], 5), () => 0.0075), { bone });
  for (let i = 0; i < 15; i++) { const a = i / 15 * Math.PI * 2; stitch([Math.sin(a) * 0.112, 3.13 + 0.02 * Math.sin(a * 3), -0.1 + Math.cos(a) * 0.11], [0.15 * Math.cos(a * 5), 1, 0.35], b.neck); }
  for (const [S, s] of SIDES) { const u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s), d = norm(sub(e, u)), c = lerp3(u, e, 0.27); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = s > 0 ? 0.104 : 0.086; stitch(add(c, [Math.sin(a) * rr * 0.9 * -d[1], Math.sin(a) * rr * d[0], Math.cos(a) * rr * 0.95]), d, b['upperArm.' + S]); } }
  rope.displace((x, y, z) => 0.0025 * Math.sin((x + y * 1.6 + z) * 190), 0.003);

  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft, smoothSkin: Math.round(0.07 / voxel), mask: mat === 9 ? (x, y, z) => {
    // mask: 0 ash-pale, 1 blackened (hands, feet, mouth rim, seams)
    const hand = sstep(1.35, 0.85, y) * sstep(0.7, 1.1, Math.abs(x)), foot = sstep(0.7, 0.1, y) * sstep(0.6, 0.4, Math.abs(x)), mouth = sstep(0.12, 0.02, slitSdf[0](x, y, z)), n = fbm(x * 3, y * 3, z * 3, 3);
    return clamp(Math.max(hand, foot, mouth) + 0.5 * n + (x > 0.55 && y > 1.2 ? 0.22 : 0));
  } : undefined }));
  const samples = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, samples, 0.34); out.push(await decimate(baked[i].mesh, parts[i][3])); }

  // --- wet hair, hanging over the face and down the back
  const hr = rng(42);
  for (let i = 0; i < 170; i++) {
    const a = hr() * Math.PI * 2, el = Math.pow(hr(), 0.7) * 1.25, face = Math.cos(a) > 0.35;
    if (face && el > 0.5 && Math.abs(Math.sin(a)) < 0.4 && hr() < 0.9) continue;
    const n: V3 = [Math.sin(a) * Math.sin(el), Math.cos(el), Math.cos(a) * Math.sin(el)], root: V3 = [n[0] * 0.146, 3.575 + n[1] * 0.168, 0.16 + n[2] * 0.2];
    const L = (face ? 0.55 : 0.85) + hr() * 0.75, seg = 12, p: V3[] = [root]; let v: V3 = [n[0] * 0.7, 0.35, n[2] * 0.8]; const ph = hr() * 6;
    // strands over the face part to either side of the mouth
    const part = Math.sign(n[0] || 1) * (0.12 + hr() * 0.1);
    const ch = (Math.cos(a) > 0 ? 'hF' : 'hB') + (n[0] > 0 ? 'L' : 'R');
    for (let j = 1; j <= seg; j++) { const t = j / seg; v = norm(add(mul(v, 0.45), [0.06 * Math.sin(ph + t * 5) + (face ? part * 1.5 * (1 - t) : 0), -0.75, 0.05 * Math.cos(ph * 2 + t * 4)])); const q = add(p[j - 1], mul(v, L / seg)); if (q[1] > 3.2) { const dx = q[0], dz = q[2] - 0.17, dd = Math.hypot(dx, dz * 0.8); const rmin = q[1] > 3.42 ? 0.16 : 0.135; if (dd < rmin) { q[0] *= rmin / dd; q[2] = 0.17 + dz * rmin / dd; } } else if (q[2] < 0.02 && Math.abs(q[0]) < 0.3) q[2] = Math.min(q[2], -0.2); p.push(q); }
    out.push(strand(p, 0.011 + hr() * 0.013, 0.4, 13, t => { const q = t * 2.6, i = Math.min(2, Math.floor(q)), f = Math.min(1, q - i); const hd = Math.max(0, 1 - Math.max(0, t - 0.1) / 0.28); if (hd >= 1) return [[b.head, 1]]; if (hd > 0) return [[b.head, hd], [b[ch + '1'], (1 - hd) * (1 - Math.min(1, t * 2.6))], [b[ch + '2'], (1 - hd) * Math.min(1, t * 2.6)]]; return i >= 2 ? [[b[ch + '3'], 1]] : [[b[ch + (i + 1)], 1 - f], [b[ch + (i + 2)], f]]; }, 4));
  }
  // --- loin rags and shroud strips
  const rag = (a0: number, a1: number, L: number, seed: number, flare: number) => sheet((u, v) => {
    const a = mix(a0, a1, u), fold = Math.sin(a * 8 + seed) * 0.03 * (0.3 + v) + noise(a * 3, v * 3, seed) * 0.07 * v;
    return [Math.sin(a) * (0.215 + flare * v + fold), 2.03 - L * v, -0.035 + Math.cos(a) * (0.18 + flare * v * 0.9 + fold)] as V3;
  }, { nu: 26, nv: 20, mat: 18, tatter: 0.5, seed, weights: (u, v) => { const x = Math.sin(mix(a0, a1, u)), w = sstep(0.15, 1, v) * 0.6, l = clamp(0.5 + x * 0.8); return [[b.hips, 1 - w + 0.001], [b['thigh.L'], w * l + 0.001], [b['thigh.R'], w * (1 - l) + 0.001]]; } });
  out.push(rag(-0.7, 0.55, 0.95, 5, 0.12), rag(2.2, 4.0, 1.15, 9, 0.16), rag(0.9, 1.7, 0.6, 15, 0.12), rag(-1.9, -1.1, 0.75, 23, 0.12));
  void box; void any;
  return merge(out);
}
