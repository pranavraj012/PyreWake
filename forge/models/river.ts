// The river's pieces: the Ferryman, his pole, anchor and lantern, moored boats, and the parts of the Weight.
import { KING, boneIndex } from '../../src/anim/skeletons.ts';
import { Field, add, any, ball, belly, box, clamp, cone, curve, ell, fbm, lerp3, mix, mul, noise, norm, ridged, rng, sstep, sub, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';
import { strand } from '../sheet.ts';
import { shatter } from './arena.ts';

const b = boneIndex(KING), at = (n: string) => KING[b[n]].pos as V3, SIDES = [['L', 1], ['R', -1]] as const, mir = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];
type Part = [Field, number, number, number, number?];
async function finish(parts: Part[], reach: number, smooth = 0): Promise<Mesh> {
  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft: soft ?? 0.04, smoothSkin: smooth ? Math.round(smooth / voxel) : 0 })), s = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, s, reach); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  return merge(out);
}

/** An old man broad as a door and bent under the net he wears, on the King's frame (scaled down in play). */
export async function ferryman(): Promise<Mesh> {
  const parts: Part[] = [], F = (k: number, voxel: number, mat: number, tris: number, soft = 0.04) => { const f = new Field(k); parts.push([f, voxel, mat, tris, soft]); return f; };
  const sk = F(0.07, 0.0115, 27, 30000), net = F(0.004, 0.0085, 26, 9000), cloth = F(0.05, 0.016, 5, 7000), iron = F(0.01, 0.0095, 12, 4500);
  // --- the barrel of him: broad pelvis, great belly, a back that humps
  sk.bone = b.hips; sk.put(ell([0, 1.9, -0.02], [0.36, 0.24, 0.24]));
  sk.put(ell([0, 2.12, 0.1], [0.34, 0.28, 0.27]), { bone: b.spine1, k: 0.12 }).put(ell([0, 2.42, 0.02], [0.4, 0.34, 0.3]), { bone: b.spine2, k: 0.12 });
  sk.put(ell([0, 2.78, -0.08], [0.56, 0.44, 0.36], [0.2, 0, 0]), { bone: b.chest, k: 0.14 }).put(ell([0, 3.1, -0.32], [0.44, 0.28, 0.3]), { bone: b.chest, k: 0.14 });
  for (const [, s] of SIDES) sk.put(ell([0.34 * s, 3.1, -0.1], [0.2, 0.14, 0.2]), { bone: b.chest, k: 0.1 }).put(belly([0.1 * s, 3.18, -0.06], [0.5 * s, 3.1, -0.1], 0.1, 0.15, 0.12), { bone: b['clav.' + (s > 0 ? 'L' : 'R')], k: 0.1 });
  // --- neck sunk between the shoulders, a heavy head carried forward
  sk.put(cone([0, 3.12, -0.14], [0, 3.34, 0.04], 0.19, 0.15), { bone: b.neck, k: 0.1 }).put(cone([0, 3.3, 0.0], [0, 3.46, 0.12], 0.15, 0.13), { bone: b.neck2, k: 0.08 });
  sk.bone = b.head; sk.put(ell([0, 3.6, 0.18], [0.19, 0.21, 0.23])).put(ell([0, 3.45, 0.3], [0.17, 0.17, 0.15], [0.2, 0, 0]), { k: 0.08 }).put(box([0, 3.37, 0.33], [0.15, 0.065, 0.1], 0.06), { k: 0.08 });
  sk.put(ell([0, 3.5, 0.42], [0.04, 0.085, 0.05], [0.3, 0, 0]), { k: 0.05 }).put(ell([0, 3.45, 0.44], [0.055, 0.03, 0.04]), { k: 0.04 });
  for (const [, s] of SIDES) { sk.put(ell([0.09 * s, 3.62, 0.38], [0.075, 0.05, 0.06], [0.2, 0, 0.1 * s]), { k: 0.06 }).put(ell([0.085 * s, 3.585, 0.405], [0.045, 0.028, 0.03]), { op: 'sub', k: 0.04 }).put(ell([0.18 * s, 3.57, 0.15], [0.03, 0.07, 0.05]), { k: 0.03 }).put(ell([0.12 * s, 3.4, 0.4], [0.05, 0.055, 0.05]), { k: 0.05 }); }
  sk.put(ell([0, 3.395, 0.46], [0.07, 0.014, 0.03]), { op: 'sub', k: 0.02 });
  sk.displace((x, y, z) => 0.009 * fbm(x * 7, y * 7, z * 7, 3) - 0.005 * ridged(x * 16, y * 9, z * 16, 2) + 0.004, 0.014);
  // --- arms: long, thick, rope-scarred
  for (const [S, s] of SIDES) {
    const c = mir(at('clav.L'), s), u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s);
    sk.put(cone(c, u, 0.1, 0.12), { bone: b['clav.' + S], k: 0.08 }); sk.bone = b['upperArm.' + S];
    sk.put(ball(u, 0.16), { k: 0.09 }).put(belly(u, e, 0.13, 0.15, 0.1, 0.35)).put(belly(lerp3(u, e, 0.06), lerp3(u, e, 0.9), 0.05, 0.12, 0.04, 0.4), { k: 0.05 }); sk.bone = b['foreArm.' + S];
    sk.put(ell(e, [0.11, 0.115, 0.115]), { k: 0.07 }); const off: V3 = [0.02, 0.01, 0.034];
    sk.put(cone(add(e, off), add(w, mul(off, 0.8)), 0.085, 0.06), { k: 0.04 }).put(cone(sub(e, off), sub(w, mul(off, 0.8)), 0.08, 0.055), { k: 0.04 }).put(belly(lerp3(e, w, 0.04), lerp3(e, w, 0.7), 0.06, 0.1, 0.05, 0.25), { k: 0.05 });
    sk.bone = b['hand.' + S]; sk.put(ell(w, [0.075, 0.09, 0.085]), { k: 0.05 }).put(ell(add(w, [0.05 * s, -0.1, 0]), [0.05, 0.12, 0.1], [0, 0, 0.4 * s]), { k: 0.06 });
    for (let i = 0; i < 4; i++) { const A = mir(at(`f${i}a.L`), s), Bp = mir(at(`f${i}b.L`), s), L = [0.9, 1.05, 1, 0.8][i], tip = add(Bp, mul(norm(sub(Bp, A)), 0.17 * L)); tip[0] -= 0.035 * s; sk.bone = b['hand.' + S]; sk.put(cone(w, A, 0.05, 0.04), { k: 0.04 }); sk.bone = b[`f${i}a.${S}`]; sk.put(cone(A, Bp, 0.04, 0.034), { k: 0.025 }).put(ball(A, 0.046), { k: 0.03 }); sk.bone = b[`f${i}b.${S}`]; sk.put(cone(Bp, tip, 0.034, 0.024), { k: 0.02 }).put(ball(Bp, 0.04), { k: 0.025 }); }
    sk.bone = b['thumb.' + S]; const th = mir(at('thumb.L'), s); sk.put(cone(add(th, [0, 0.06, -0.06]), th, 0.05, 0.04), { k: 0.04 }).put(cone(th, add(th, [0.02 * s, -0.15, 0.09]), 0.04, 0.026), { k: 0.03 });
    // --- legs: short for the height, planted wide
    const h = mir(at('thigh.L'), s), k = mir(at('shin.L'), s), f = mir(at('foot.L'), s), t = mir(at('toe.L'), s);
    sk.bone = b['thigh.' + S]; sk.put(ell(add(h, [0.02 * s, 0.02, 0]), [0.22, 0.26, 0.22]), { k: 0.1 }).put(cone(h, k, 0.2, 0.13)).put(belly(add(h, [0.02 * s, -0.05, 0.03]), add(k, [0, 0.08, 0.02]), 0.1, 0.19, 0.08, 0.4), { k: 0.06 });
    sk.bone = b['shin.' + S]; sk.put(ell(add(k, [0, 0, 0.02]), [0.15, 0.16, 0.16]), { k: 0.07 }).put(cone(add(k, [0, -0.03, 0.02]), add(f, [0, 0, 0.015]), 0.12, 0.075)).put(belly(add(k, [0, -0.02, -0.04]), add(f, [0, 0.05, -0.04]), 0.07, 0.14, 0.04, 0.3), { k: 0.05 });
    sk.bone = b['foot.' + S]; sk.put(ell(add(f, [0, -0.06, -0.04]), [0.085, 0.09, 0.12]), { k: 0.07 }).put(cone(add(f, [0, -0.02, 0.02]), add(t, [0, 0.02, 0.02]), 0.08, 0.07)); sk.bone = b['toe.' + S];
    for (let i = 0; i < 5; i++) { const x = t[0] + (i - 2) * 0.045 * s; sk.put(cone([x, 0.05, t[2] - 0.02], [x + (i - 2) * 0.012 * s, 0.03, t[2] + 0.13 - i * 0.012], 0.034, 0.024), { k: 0.025 }); }
  }
  // --- a coil of rotted hair at the nape, the beard
  const hair = new Field(0.01); void hair;
  // --- the net: two sets of helical cords over the torso and shoulders, knotted where they cross
  const rx = (y: number) => 0.3 + 0.2 * sstep(1.95, 2.9, y) - 0.12 * sstep(3.0, 3.2, y), rz = (y: number) => 0.24 + 0.1 * sstep(1.95, 2.9, y), zc = (y: number) => 0.06 - 0.12 * sstep(2.3, 3.1, y), boneAt = (y: number) => y < 2.28 ? b.spine1 : y < 2.62 ? b.spine2 : b.chest;
  for (const dir of [1, -1]) for (let k = 0; k < 13; k++) {
    const a0 = k / 13 * Math.PI * 2, pts: V3[] = []; for (let i = 0; i <= 44; i++) { const t = i / 44, y = 2.0 + t * 1.2, a = a0 + dir * t * 3.0; pts.push([Math.sin(a) * (rx(y) + 0.024), y, zc(y) + Math.cos(a) * (rz(y) + 0.024)]); }
    pts.slice(1).forEach((p, i) => net.put(cone(pts[i], p, 0.0105, 0.0105), { bone: boneAt(p[1]), k: 0.004 }));
  }
  for (const [S, s] of SIDES) { const u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s); for (let r = 0; r < 4; r++) { const p = lerp3(u, e, 0.1 + r * 0.2), q: V3[] = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2; q.push(add(p, [Math.sin(a) * 0.17, Math.cos(a * 0.5) * 0.02, Math.cos(a) * 0.16])); } q.slice(1).forEach((x, i) => net.put(cone(q[i], x, 0.011, 0.011), { bone: b['upperArm.' + S], k: 0.004 })); } }
  net.displace((x, y, z) => 0.003 * noise(x * 60, y * 60, z * 60), 0.004);
  // --- a heavy sodden hood and a drape of cloth over the back
  cloth.bone = b.chest; cloth.put(ell([0, 3.14, -0.34], [0.46, 0.2, 0.3], [0.5, 0, 0]), { k: 0.1 }).put(ell([0, 2.86, -0.5], [0.4, 0.5, 0.12], [0.1, 0, 0]), { k: 0.1 });
  for (const [, s] of SIDES) cloth.put(ell([0.4 * s, 3.1, -0.1], [0.18, 0.1, 0.22], [0, 0, 0.5 * s]), { k: 0.08 });
  cloth.bone = b.neck2; cloth.put(ell([0, 3.58, 0.0], [0.27, 0.2, 0.26]), { k: 0.1 }); cloth.bone = b.head; cloth.put(ell([0, 3.7, 0.05], [0.24, 0.17, 0.3], [0.3, 0, 0]), { k: 0.1 }).put(ell([0, 3.68, 0.3], [0.2, 0.07, 0.07]), { k: 0.06 });
  cloth.put(ell([0, 3.52, 0.4], [0.17, 0.15, 0.2]), { op: 'sub', k: 0.07 });
  cloth.displace((x, y, z) => 0.03 * fbm(x * 4.5, y * 4.5, z * 4.5, 3) - 0.014 * ridged(x * 9, y * 9 + z * 5, z * 9, 2), 0.05);
  // --- chain slung from the shoulder, a coil of it at the hip
  const link = (pts: V3[], bone: number) => pts.slice(1).forEach((p, i) => iron.put(cone(pts[i], p, 0.034, 0.034), { bone, k: 0.01 }));
  const sling = curve([[0.38, 3.1, -0.04], [0.4, 2.9, 0.2], [0.15, 2.55, 0.34], [-0.18, 2.2, 0.32], [-0.38, 1.98, 0.1]], 40); link(sling, b.chest);
  for (let r = 0; r < 3; r++) { const p: V3[] = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI * 2; p.push([-0.45 + Math.sin(a) * 0.13, 1.9 + r * 0.05, -0.04 + Math.cos(a) * 0.15]); } link(p, b.hips); }
  iron.displace((x, y, z) => 0.012 * Math.sin((x * 1.5 + y * 2.3 + z * 1.9) * 95) * 0.7, 0.012);
  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft, smoothSkin: mat === 27 ? Math.round(0.07 / voxel) : 0 })), samples = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, samples, 0.34); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  // --- grey beard and wet hair
  const hr = rng(9);
  for (let i = 0; i < 70; i++) {
    const a = (hr() - 0.5) * 2.6, root: V3 = [Math.sin(a) * 0.15, 3.36 + hr() * 0.05, 0.38 + Math.cos(a) * 0.1], L = 0.35 + hr() * 0.5, p: V3[] = [root]; let v: V3 = [Math.sin(a) * 0.3, -0.3, 0.5]; const ph = hr() * 6;
    for (let j = 1; j <= 9; j++) { v = norm(add(mul(v, 0.5), [0.07 * Math.sin(ph + j), -0.8, 0.1 + 0.04 * Math.cos(ph * 2 + j)])); p.push(add(p[j - 1], mul(v, L / 9))); }
    out.push(strand(p, 0.012 + hr() * 0.008, 0.4, 13, t => t < 0.3 ? [[b.head, 1 - t / 0.3], [b.neck2, t / 0.3 + 0.001]] : [[b.neck2, 1]]));
  }
  void clamp; void mix;
  return merge(out);
}

/** Six metres of iron-shod bamboo, grip at the origin (y from -1.4 to 4.6), hook for the lamp near the top. */
export async function pole(): Promise<Mesh> {
  const f = new Field(0.01), fe = new Field(0.005);
  const seg = [-1.4, -0.45, 0.5, 1.45, 2.4, 3.3, 4.1, 4.6]; for (let i = 0; i < seg.length - 1; i++) { const t = i / (seg.length - 1); f.put(cone([0, seg[i] + 0.02, 0], [0, seg[i + 1] - 0.02, 0], 0.052 - 0.018 * t, 0.052 - 0.018 * (t + 0.14)), { k: 0.01 }).put(ell([0, seg[i + 1], 0], [0.062 - 0.02 * t, 0.028, 0.062 - 0.02 * t]), { k: 0.012 }); }
  f.displace((x, y, z) => 0.0035 * noise(x * 30, y * 6, z * 30) - 0.003 * Math.abs(Math.sin(Math.atan2(z, x) * 3 + y * 0.8)), 0.006);
  fe.put(cone([0, 4.3, 0], [0, 4.78, 0], 0.044, 0.01)).put(cone([0, 4.28, 0], [0, 4.46, 0], 0.062, 0.062)).put(tube([[0, 4.1, 0], [0.12, 4.15, 0], [0.22, 4.0, 0], [0.24, 3.84, 0]] as V3[], () => 0.012)).put(cone([0, -1.4, 0], [0, -1.28, 0], 0.056, 0.056));
  fe.displace((x, y, z) => 0.003 * fbm(x * 30, y * 30, z * 30, 2), 0.004);
  return finish([[f, 0.0105, 24, 2400], [fe, 0.0065, 12, 1500]], 0.1);
}

/** The anchor: iron fluke, long shank, stock, a ring. Origin at the ring; hangs down to y = -1.5. */
export async function anchor(): Promise<Mesh> {
  const f = new Field(0.02), rg = new Field(0.01);
  f.put(cone([0, -0.1, 0], [0, -1.4, 0], 0.06, 0.075), { k: 0.03 }).put(box([0, -0.3, 0], [0.5, 0.04, 0.04], 0.02)).put(ball([0.52, -0.3, 0], 0.07)).put(ball([-0.52, -0.3, 0], 0.07)).put(ball([0, -1.45, 0], 0.1));
  f.put(tube(curve([[-0.62, -1.0, 0], [-0.5, -1.38, 0], [0, -1.62, 0], [0.5, -1.38, 0], [0.62, -1.0, 0]], 18), t => 0.075 - 0.05 * Math.abs(t - 0.5) * 2 + 0.03), { k: 0.04 });
  for (const s of [1, -1]) f.put(any((x, y, z) => { const dx = (x * s - 0.52) * 1.0, dy = y + 1.2; return Math.max(Math.hypot(dx * 0.9, dy * 0.7) - 0.34 + 0.12 * (dx), Math.abs(z) - 0.04) * 0.7; }, [0.5 * s, -1.2, 0], 0.5), { k: 0.03 });
  rg.put(tube(curve([[0, 0.28, 0], [0.12, 0.14, 0], [0.12, -0.04, 0], [0, -0.12, 0], [-0.12, -0.04, 0], [-0.12, 0.14, 0], [0, 0.28, 0]], 24), () => 0.032));
  f.displace((x, y, z) => 0.008 * fbm(x * 9, y * 9, z * 9, 3) + 0.004 * ridged(x * 18, y * 18, z * 18, 2), 0.012);
  return finish([[f, 0.014, 12, 3600], [rg, 0.01, 12, 600]], 0.15);
}

/** A hooded iron lantern, 0.5 m, ring at y = 0.3 and the flame hung in the middle. */
export async function lantern(): Promise<Mesh> {
  const f = new Field(0.006), fl = new Field(0.01);
  f.put(cone([0, -0.22, 0], [0, -0.2, 0], 0.1, 0.1)).put(cone([0, 0.2, 0], [0, 0.3, 0], 0.13, 0.03)).put(tube([[0, 0.3, 0], [0.04, 0.38, 0], [0, 0.44, 0]] as V3[], () => 0.012));
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; f.put(cone([Math.cos(a) * 0.1, -0.2, Math.sin(a) * 0.1], [Math.cos(a) * 0.115, 0.2, Math.sin(a) * 0.115], 0.012, 0.012), { k: 0.004 }); }
  f.put(cone([0, -0.27, 0], [0, -0.22, 0], 0.07, 0.11)).put(cone([0, 0.2, 0], [0, 0.22, 0], 0.13, 0.13));
  fl.put(ell([0, 0, 0], [0.045, 0.085, 0.045]));
  return finish([[f, 0.0045, 12, 1800], [fl, 0.007, 22, 220]], 0.05);
}

/** Moored boat, 5.6 m: clinker planking, ribs, thwarts, a tall prow. Origin at the keel's centre, gunwale at y ~ 0.7. */
function boatField(wreck: number): Field {
  const f = new Field(0.02), R = 2.8;
  const w = (z: number) => Math.max(0.0, 1 - Math.pow(Math.abs(z) / (R + 0.2), 2.4)), hull = (x: number, y: number, z: number) => { const hw = 0.82 * Math.pow(w(z), 0.55), rise = 0.42 * Math.pow(Math.abs(z) / R, 3); return Math.max(Math.abs(x) - hw * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.55) / 0.62, 2))) - 0.0, y - 0.7 - rise * 1.4, -y - 0.05 + 0.1 * (1 - w(z)), Math.abs(z) - R - 0.5) * 0.6; };
  const out = hull, inner = (x: number, y: number, z: number) => hull(x * 1.07, y - 0.08, z * 1.0) + 0.045;
  f.put(any(out, [0, 0.4, 0], 3.4));
  f.put(any((x, y, z) => Math.max(inner(x, y, z), y - 3), [0, 0.5, 0], 3.2), { op: 'sub', k: 0.015 });
  for (let i = 0; i < 9; i++) { const z = -2.2 + i * 0.55; f.put(any((x, y, z2) => Math.max(Math.abs(z2 - z) - 0.03, hull(x, y, z2) - 0.0, -(hull(x * 1.04, y - 0.05, z2) + 0.015) * 1, -y) * 0.7, [0, 0.4, z], 1.3), { k: 0.01 }); }
  for (const z of [-1.4, 0, 1.3]) f.put(box([0, 0.5, z], [0.78 * Math.pow(w(z), 0.5), 0.035, 0.12], 0.015), { k: 0.01 });
  f.put(box([0, 0.02, 0], [0.06, 0.04, 2.9], 0.02), { k: 0.03 }).put(cone([0, 0.5, R], [0, 1.3, R + 0.5], 0.06, 0.04), { k: 0.04 }).put(cone([0, 0.5, -R], [0, 1.0, -R - 0.35], 0.06, 0.04), { k: 0.04 });
  f.displace((x, y, z) => 0.012 * Math.abs(Math.sin(y * 16 + 0.5 * Math.sin(z * 1.3))) + 0.008 * noise(x * 5, y * 18, z * 5) + 0.006 * fbm(x * 11, y * 11, z * 11, 2), 0.026);
  if (wreck) f.put(any((x, y, z) => -(y - 0.2 - 0.7 * noise(x * 1.5, z * 1.2, 4) - 0.2 * z * wreck) * 0.6), { op: 'int', k: 0.02 });
  return f;
}
export async function boat(): Promise<Mesh> { const q = meshField(boatField(0), { voxel: 0.034, mat: 24, bounds: [[-1.1, -0.1, -3.5], [1.1, 1.5, 3.5]] }); bakeAO(q.mesh, [q.sample], 0.5); return decimate(q.mesh, 7200); }
export const boatBits = () => shatter('boatBits', boatField(0), 1.5, 1.5, [[0, 0.1, -2.2], [0.25, 0.3, -1.2], [-0.25, 0.3, -0.4], [0.2, 0.3, 0.4], [-0.2, 0.3, 1.2], [0.1, 0.5, 2.2], [0.1, 0.7, 2.9], [-0.1, 0.8, -2.9]], 200);

/** A drowned arm reaching up out of the water, 1.7 m, pale, fingers spread. Origin at the water. */
export async function arm(): Promise<Mesh> {
  const f = new Field(0.04), r = rng(3);
  const p = curve([[0, -0.2, 0], [0.04, 0.4, 0.02], [-0.03, 0.95, 0.06], [0.04, 1.35, 0.1], [0.05, 1.55, 0.14]], 14); p.slice(1).forEach((q, i) => f.put(cone(p[i], q, 0.075 - 0.003 * i, 0.075 - 0.0035 * (i + 1)), { k: 0.04 }));
  f.put(ell([0.05, 1.62, 0.15], [0.055, 0.07, 0.03], [0.2, 0, 0]), { k: 0.04 });
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32, base: V3 = [0.05 + (i - 2) * 0.02, 1.66, 0.15], mid = add(base, [Math.sin(a) * 0.06, 0.1, 0.03 + 0.02 * r()]), tip = add(mid, [Math.sin(a) * 0.05, 0.08, 0.05 + 0.02 * r()]); f.put(cone(base, mid, 0.019, 0.015), { k: 0.012 }).put(cone(mid, tip, 0.015, 0.008), { k: 0.01 }); }
  f.displace((x, y, z) => 0.004 * fbm(x * 12, y * 12, z * 12, 3), 0.006);
  return finish([[f, 0.0105, 9, 1800]], 0.15);
}

/** The Weight's head: a ferry hull stood on end, 5 m, hollow and open toward where it looks, ribs showing, hands holding on all round the rim. Origin at the waterline; a thwart at 1.3 m for the rower. */
export async function hull(): Promise<Mesh> {
  const body = new Field(0.03), g = new Field(0.02), r = rng(21), C: V3 = [0, 2.4, -0.45], RAD: V3 = [1.25, 2.75, 1.5], shell = 0.1;
  const outer = ell(C, RAD), inner = ell([C[0], C[1], C[2] + 0.05], [RAD[0] - shell, RAD[1] - shell, RAD[2] - shell]);
  body.put(any((x, y, z) => Math.max(outer[0](x, y, z), z - 0.3, -y - 0.2), C, 3.2));
  body.put(any((x, y, z) => inner[0](x, y, z), C, 3.2), { op: 'sub', k: 0.02 });
  // the thwart, a keel timber down the back, ribs lying on the inside of the planking, the prow's upturned stem
  body.put(box([0, 1.28, -0.4], [1.0, 0.05, 0.85], 0.02), { k: 0.03 }).put(box([0, 2.4, -1.85], [0.07, 2.7, 0.07], 0.03), { k: 0.03 });
  for (let i = 0; i < 8; i++) { const y = 0.5 + i * 0.58; body.put(any((x, yy, z) => Math.max(Math.abs(inner[0](x, yy, z) + 0.03) - 0.035, Math.abs(yy - y) - 0.055, z - 0.28), [0, y, -0.4], 1.5), { k: 0.012 }); }
  body.put(tube(curve([[0, 4.6, -1.1], [0, 5.3, -0.7], [0, 5.55, 0.2], [0, 5.35, 0.7]], 12), t => 0.16 - 0.1 * t), { k: 0.06 });
  // the planking on the left is torn away
  body.put(any((x, y, z) => Math.max(Math.abs(x + 1.0) - 0.45, Math.abs(y - 2.7) - 0.8, Math.abs(z + 0.5) - 0.9) * 0.6, [-1, 2.7, -0.5], 1.4), { op: 'sub', k: 0.03 });
  body.displace((x, y, z) => 0.012 * Math.abs(Math.sin(y * 7 + 0.4 * Math.sin(x * 2))) + 0.016 * fbm(x * 5, y * 5, z * 5, 3), 0.03);
  // hands on the rim and over the planking
  for (let i = 0; i < 26; i++) { const a = -1.6 + (i / 25) * 3.2 + (r() - 0.5) * 0.15, y = 1.0 + r() * 3.6, k = Math.sqrt(Math.max(0.06, 1 - Math.pow((y - C[1]) / RAD[1], 2))), p: V3 = [Math.sin(a) * (RAD[0] * k + 0.02), y, C[2] + Math.cos(a) * RAD[2] * k * 0.55 + 0.1]; if (p[2] > 0.3) continue; g.put(ell(p, [0.07, 0.05, 0.09]), { k: 0.02 }); for (let j = 0; j < 4; j++) g.put(cone(p, add(p, [Math.sin(a) * 0.12 + (j - 1.5) * 0.03, 0.12 + 0.03 * j, Math.cos(a) * 0.06]), 0.02, 0.012), { k: 0.012 }); }
  return finish([[body, 0.05, 24, 14000], [g, 0.012, 9, 2600]], 0.5);
}

/** One section of the long body behind: a keel timber, ribs, and arms grown through it. 3 m, along z, origin at its centre. */
export async function section(): Promise<Mesh> {
  const f = new Field(0.03), g = new Field(0.02), r = rng(8);
  f.put(box([0, 0, 0], [0.16, 0.2, 1.55], 0.06), { k: 0.05 });
  for (let i = 0; i < 6; i++) { const z = -1.2 + i * 0.48; const pts = curve([[0, 0.1, z], [0.46, 0.45, z + 0.02], [0.78, 1.0, z], [0.7, 1.55, z - 0.04]], 12); for (const s of [1, -1]) pts.slice(1).forEach((p, j) => f.put(cone(mir(pts[j], s), mir(p, s), 0.07 - j * 0.003, 0.07 - (j + 1) * 0.003), { k: 0.03 })); }
  for (let i = 0; i < 7; i++) { const z = -1.3 + r() * 2.6, s = r() < 0.5 ? 1 : -1, y = 0.2 + r() * 0.9, p = curve([[0.1 * s, y - 0.1, z], [0.5 * s, y + 0.1, z + 0.1], [0.95 * s, y + 0.3 + r() * 0.3, z + 0.2 * (r() - 0.5)], [1.25 * s, y + 0.7 + r() * 0.4, z + 0.3 * (r() - 0.5)]], 10); p.slice(1).forEach((q, j) => g.put(cone(p[j], q, 0.07 - j * 0.004, 0.07 - (j + 1) * 0.004), { k: 0.03 })); const e = p[10]; g.put(ell(e, [0.06, 0.07, 0.03]), { k: 0.03 }); for (let k = 0; k < 4; k++) g.put(cone(e, add(e, [0.04 * s * (k - 1.5) * 0.4, 0.13, 0.03 * (k - 1.5)]), 0.017, 0.01), { k: 0.012 }); }
  f.displace((x, y, z) => 0.012 * fbm(x * 6, y * 6, z * 6, 3) + 0.01 * Math.abs(Math.sin(z * 11 + x * 3)), 0.03);
  return finish([[f, 0.034, 24, 5200], [g, 0.014, 9, 3200]], 0.4);
}
