// The river's pieces: the Ferryman, his pole, anchor and lantern, moored boats, and the parts of the Weight.
import { KING, boneIndex } from '../../src/anim/skeletons.ts';
import { Field, add, any, ball, belly, box, clamp, cone, cross, curve, ell, fbm, lerp3, mix, mul, noise, norm, ridged, rng, sstep, sub, tube, type V3 } from '../sdf.ts';
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

/** Hat frame: centre, forward tilt, height and brim radius. Shared by the hat, the veil and the view's eye-glow placement. */
export const HAT = { c: [0, 3.44, 0.12] as V3, tilt: 0.1, H: 0.38, R: 0.64 };
const hatY = (r: number) => HAT.H * (1 - r / HAT.R) - 0.07 * Math.pow(Math.min(1.2, r / HAT.R), 2.5);
/** Hat frame to rig space. */
const hatPt = (x: number, yy: number, zz: number): V3 => { const c = Math.cos(HAT.tilt), s = Math.sin(HAT.tilt); return [HAT.c[0] + x, HAT.c[1] + yy * c - zz * s, HAT.c[2] + yy * s + zz * c]; };

/** The Drowned Boatman, on the King's long frame (scaled in play to about three metres): gaunt, long-armed, a soaked black shroud to the water,
 *  a steep reed hat with a veil of black-gold fare coins hiding all of the face but the jaw. `bare`: round 2, hat, veil and mantle gone, the starved body under them. */
export async function ferryman(bare = false): Promise<Mesh> {
  const parts: Part[] = [], F = (k: number, voxel: number, mat: number, tris: number, soft = 0.04) => { const f = new Field(k); parts.push([f, voxel, mat, tris, soft]); return f; };
  const sk = F(0.04, 0.0085, 31, 30000, 0.035), cloth = F(0.05, 0.014, 30, bare ? 9000 : 15000), rope = F(0.01, 0.007, 11, 2600), wrap = F(0.006, 0.0065, 2, 5000);
  const hat = bare ? null : F(0.01, 0.008, 28, 5200), coin = bare ? null : F(0.003, 0.0042, 29, 7000), iron = bare ? null : F(0.01, 0.009, 12, 3600);
  const sleeve = bare ? [] : SIDES.map(() => F(0.04, 0.013, 30, 3200));
  // --- the frame of him: narrow pelvis, a waist like a wrist, a ribcage you could count
  sk.bone = b.hips; sk.put(ell([0, 1.86, -0.02], [0.19, 0.13, 0.13]));
  sk.put(ell([0, 2.12, -0.06], [0.135, 0.16, 0.1]), { bone: b.spine1, k: 0.08 }).put(ell([0, 2.2, 0.07], [0.09, 0.09, 0.035]), { bone: b.spine1, op: 'sub', k: 0.05 });
  sk.put(ell([0, 2.46, -0.11], [0.19, 0.22, 0.145]), { bone: b.spine2, k: 0.09 }).put(ell([0, 2.78, -0.17], [0.235, 0.2, 0.155]), { bone: b.chest, k: 0.09 }).put(ell([0, 2.99, -0.19], [0.28, 0.075, 0.12]), { bone: b.chest, k: 0.07 });
  sk.put(cone([0, 2.62, 0.01], [0, 2.98, -0.03], 0.018, 0.022), { bone: b.chest, k: 0.02 });
  for (const [S, s] of SIDES) {
    sk.put(cone([0.05 * s, 3.05, -0.08], [0.33 * s, 3.08, -0.12], 0.022, 0.017), { bone: b.chest, k: 0.02 }).put(cone([0.04 * s, 3.13, -0.18], [0.34 * s, 3.07, -0.16], 0.055, 0.04), { bone: b.chest, k: 0.05 });
    sk.put(ell([0.15 * s, 2.86, -0.31], [0.08, 0.1, 0.03], [0, 0, 0.3 * s]), { bone: b.chest, k: 0.04 });
    void S;
  }
  // --- a long neck, all cord; the head of a man who has been under the water a long time
  sk.put(cone([0, 3.06, -0.17], [0, 3.3, -0.02], 0.068, 0.062), { bone: b.neck, k: 0.05 }).put(cone([0, 3.28, -0.03], [0, 3.46, 0.1], 0.062, 0.058), { bone: b.neck2, k: 0.04 });
  for (const [, s] of SIDES) sk.put(cone([0.05 * s, 3.08, -0.1], [0.035 * s, 3.4, 0.1], 0.016, 0.012), { bone: b.neck2, k: 0.02 });
  sk.put(ell([0, 3.3, 0.04], [0.018, 0.028, 0.02]), { bone: b.neck2, k: 0.02 });
  sk.bone = b.head;
  sk.put(ell([0, 3.66, 0.1], [0.13, 0.155, 0.165]), { k: 0.06 }).put(ell([0, 3.6, 0.0], [0.115, 0.125, 0.1]), { k: 0.06 }).put(ell([0, 3.52, 0.2], [0.1, 0.145, 0.105]), { k: 0.06 });
  sk.put(box([0, 3.39, 0.22], [0.07, 0.045, 0.07], 0.035), { k: 0.05 }).put(ell([0, 3.35, 0.28], [0.036, 0.038, 0.032]), { k: 0.03 });
  for (const [, s] of SIDES) {
    sk.put(ell([0.075 * s, 3.555, 0.255], [0.038, 0.024, 0.034], [0, 0.3 * s, 0]), { k: 0.025 }).put(ell([0.078 * s, 3.43, 0.15], [0.022, 0.05, 0.04]), { k: 0.03 }).put(ell([0.13 * s, 3.56, 0.11], [0.014, 0.042, 0.026]), { k: 0.015 });
    sk.put(ell([0.125 * s, 3.62, 0.2], [0.028, 0.05, 0.05]), { op: 'sub', k: 0.04 }).put(ell([0.082 * s, 3.465, 0.27], [0.028, 0.045, 0.035]), { op: 'sub', k: 0.035 }).put(ell([0.047 * s, 3.594, 0.292], [0.031, 0.022, 0.03]), { op: 'sub', k: 0.02 });
  }
  sk.put(ell([0, 3.632, 0.272], [0.1, 0.019, 0.026]), { k: 0.03 }).put(ell([0, 3.55, 0.305], [0.013, 0.05, 0.02], [0.22, 0, 0]), { k: 0.02 }).put(ell([0, 3.503, 0.318], [0.017, 0.014, 0.017]), { k: 0.015 });
  sk.put(ell([0, 3.432, 0.305], [0.042, 0.0045, 0.03]), { op: 'sub', k: 0.008 });
  sk.displace((x, y, z) => 0.004 * fbm(x * 11, y * 11, z * 11, 3) - 0.003 * ridged(x * 22, y * 14, z * 22, 2) + 0.001 + 0.009 * Math.pow(Math.abs(Math.sin((y + 0.03 * Math.abs(x) * 6) * 40)), 4) * sstep(2.34, 2.42, y) * sstep(2.9, 2.8, y) * sstep(-0.2, -0.05, z) * sstep(0.04, 0.09, Math.abs(x)), 0.014);
  // --- arms down past the knee: bone, tendon, and long fingers
  for (const [S, s] of SIDES) {
    const c = mir(at('clav.L'), s), u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s);
    sk.put(cone(c, u, 0.05, 0.06), { bone: b['clav.' + S], k: 0.04 }); sk.bone = b['upperArm.' + S];
    sk.put(ball(u, 0.075), { k: 0.05 }).put(cone(u, e, 0.062, 0.046)).put(belly(lerp3(u, e, 0.1), lerp3(u, e, 0.75), 0.04, 0.062, 0.035, 0.35), { k: 0.03 }); sk.bone = b['foreArm.' + S];
    sk.put(ball(e, 0.052), { k: 0.035 }).put(cone(e, w, 0.046, 0.03), { k: 0.03 }).put(belly(lerp3(e, w, 0.05), lerp3(e, w, 0.6), 0.03, 0.052, 0.03, 0.25), { k: 0.025 }).put(ball(add(e, [0, -0.02, -0.035]), 0.03), { k: 0.02 });
    sk.bone = b['hand.' + S]; sk.put(ell(w, [0.035, 0.045, 0.045]), { k: 0.025 }).put(ell(add(w, [0.03 * s, -0.11, 0]), [0.03, 0.1, 0.07], [0, 0, 0.4 * s]), { k: 0.03 });
    for (let i = 0; i < 4; i++) {
      const A = mir(at(`f${i}a.L`), s), Bp = mir(at(`f${i}b.L`), s), L = [1.0, 1.15, 1.1, 0.9][i], tip = add(Bp, mul(norm(sub(Bp, A)), 0.2 * L)); tip[0] -= 0.04 * s;
      sk.bone = b['hand.' + S]; sk.put(cone(w, A, 0.026, 0.022), { k: 0.02 }); sk.bone = b[`f${i}a.${S}`]; sk.put(cone(A, Bp, 0.021, 0.018), { k: 0.012 }).put(ball(A, 0.025), { k: 0.012 }); sk.bone = b[`f${i}b.${S}`]; sk.put(cone(Bp, tip, 0.018, 0.011), { k: 0.01 }).put(ball(Bp, 0.021), { k: 0.01 });
    }
    sk.bone = b['thumb.' + S]; const th = mir(at('thumb.L'), s); sk.put(cone(add(th, [0, 0.05, -0.05]), th, 0.026, 0.022), { k: 0.02 }).put(cone(th, add(th, [0.02 * s, -0.17, 0.1]), 0.021, 0.013), { k: 0.015 });
    // legs, thin as poles
    const h = mir(at('thigh.L'), s), k = mir(at('shin.L'), s), f = mir(at('foot.L'), s), t = mir(at('toe.L'), s);
    sk.bone = b['thigh.' + S]; sk.put(ell(add(h, [0, 0.02, 0]), [0.12, 0.14, 0.12]), { k: 0.06 }).put(cone(h, k, 0.11, 0.068), { k: 0.04 });
    sk.bone = b['shin.' + S]; sk.put(ball(add(k, [0, 0, 0.02]), 0.07), { k: 0.04 }).put(cone(add(k, [0, -0.03, 0.02]), add(f, [0, 0, 0.01]), 0.062, 0.04), { k: 0.03 });
    sk.bone = b['foot.' + S]; sk.put(ell(add(f, [0, -0.06, -0.03]), [0.05, 0.07, 0.08]), { k: 0.04 }).put(cone(add(f, [0, -0.03, 0.02]), add(t, [0, 0.01, 0.02]), 0.05, 0.045), { k: 0.03 }); sk.bone = b['toe.' + S];
    for (let i = 0; i < 5; i++) { const x = t[0] + (i - 2) * 0.03 * s; sk.put(cone([x, 0.035, t[2] - 0.02], [x + (i - 2) * 0.01 * s, 0.022, t[2] + 0.15 - i * 0.015], 0.02, 0.013), { k: 0.012 }); }
    // grave-wraps round the forearm, wet and grey
    const wp: V3[] = [], ax = norm(sub(w, e)), q1 = norm(cross(ax, [0, 0, 1])), q2 = cross(ax, q1);
    for (let i = 0; i <= 160; i++) { const tt = i / 160, a = tt * 6.283 * 13, p = lerp3(e, w, 0.3 + 0.62 * tt), r = mix(0.05, 0.036, tt) + 0.004; wp.push(add(p, add(mul(q1, Math.cos(a) * r), mul(q2, Math.sin(a) * r)))); }
    wrap.put(tube(wp, () => 0.0135), { bone: b['foreArm.' + S], k: 0.008 });
  }
  wrap.displace((x, y, z) => 0.002 * noise(x * 80, y * 80, z * 80), 0.003);
  // --- a hemp cord at the waist
  { const pts: V3[] = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283; pts.push([Math.sin(a) * 0.245, 2.04 + 0.03 * Math.sin(a * 2), -0.05 + Math.cos(a) * 0.19]); } rope.put(tube(pts, () => 0.018), { bone: b.spine1 }); rope.put(tube(curve([[0.1, 2.03, 0.13], [0.13, 1.85, 0.17], [0.11, 1.6, 0.19]], 14), () => 0.014), { bone: b.hips }); }
  rope.displace((x, y, z) => 0.004 * Math.sin((x + y * 1.7 + z) * 140), 0.004);
  // --- the shroud: a robe to the water in both forms; in round 1 a mantle, wide sleeves and a cowl over it
  cloth.bone = b.hips; cloth.put(cone([0, 2.2, -0.05], [0, 1.62, -0.05], 0.23, 0.3), { k: 0.1 }).put(ell([0, 1.0, -0.2], [0.34, 0.75, 0.1]), { k: 0.12 });
  for (const [S, s] of SIDES) {
    const h = mir(at('thigh.L'), s), k = mir(at('shin.L'), s), f = mir(at('foot.L'), s);
    cloth.bone = b['thigh.' + S]; cloth.put(cone(add(h, [0.03 * s, 0.1, 0]), add(k, [0.05 * s, 0, 0.01]), 0.24, 0.27), { k: 0.1 });
    cloth.bone = b['shin.' + S]; cloth.put(cone(add(k, [0.05 * s, 0.05, 0.01]), add(f, [0.07 * s, -0.12, -0.02]), 0.27, 0.32), { k: 0.1 });
  }
  cloth.put(ell([0, 2.46, -0.12], [0.235, 0.27, 0.19]), { bone: b.spine2, k: 0.1 }).put(ell([0, 2.15, -0.06], [0.21, 0.2, 0.16]), { bone: b.spine1, k: 0.1 });
  if (!bare) {
    cloth.bone = b.chest; cloth.put(ell([0, 2.93, -0.15], [0.38, 0.27, 0.25]), { k: 0.12 }).put(ell([0, 2.5, -0.36], [0.36, 0.55, 0.1], [0.08, 0, 0]), { k: 0.12 });
    cloth.put(ell([0, 3.14, -0.08], [0.25, 0.11, 0.23]), { k: 0.08 }).put(cone([0, 3.0, -0.12], [0, 3.4, 0.0], 0.085, 0.075), { op: 'sub', k: 0.03 });
    for (const [S, s] of SIDES) cloth.put(ell([0.4 * s, 2.92, -0.13], [0.17, 0.22, 0.2], [0, 0, 0.35 * s]), { bone: b['upperArm.' + S], k: 0.08 });
    // sleeves: wide, hanging open, cut ragged a little past the elbow so the long forearms come out of them
    SIDES.forEach(([S, s], i) => {
      const f = sleeve[i], u = mir(at('upperArm.L'), s), e = mir(at('foreArm.L'), s), w = mir(at('hand.L'), s), ax = norm(sub(w, e)), cut = lerp3(e, w, 0.28);
      f.bone = b['upperArm.' + S]; f.put(cone(add(u, [0, -0.04, 0]), e, 0.09, 0.1), { k: 0.05 });
      f.bone = b['foreArm.' + S]; f.put(cone(e, lerp3(e, w, 0.4), 0.1, 0.125), { k: 0.05 });
      f.put(cone(lerp3(e, w, -0.1), lerp3(e, w, 0.6), 0.04, 0.034), { op: 'sub', k: 0.02 });
      f.put(any((x, y, z) => ((x - cut[0]) * ax[0] + (y - cut[1]) * ax[1] + (z - cut[2]) * ax[2]) + 0.05 * ridged(x * 9, y * 9, z * 9, 2) - 0.03), { op: 'int', k: 0.02 });
      f.displace((x, y, z) => 0.02 * fbm(x * 5, y * 5, z * 5, 3) - 0.012 * ridged(x * 10, y * 6, z * 10, 2), 0.035);
    });
  }
  // ragged at the hem, hanging in strips to the water; in round 2 torn off higher
  cloth.put(any((x, y, z) => { const a = Math.atan2(x, z); return (0.16 + 0.16 * fbm(x * 4, 1.3, z * 4, 3) + 0.22 * Math.pow(Math.abs(Math.sin(a * 5.5 + 0.6 * noise(x * 3, 2, z * 3))), 6) * -1 + 0.06 * ridged(x * 11, 2, z * 11, 2) - y) * 0.7; }), { op: 'int', k: 0.02 });
  cloth.displace((x, y, z) => { const a = Math.atan2(x, z); return 0.026 * fbm(x * 4.5, y * 4.5, z * 4.5, 3) - 0.022 * ridged(a * 4, y * 1.4, 1, 2) * sstep(2.2, 0.8, y) - 0.012 * ridged(x * 9, y * 9 + z * 5, z * 9, 2); }, 0.06);
  // --- the hat: steep woven reed, sagging with water, a torn notch; under it a veil of fare coins on black cords
  if (hat && coin) {
    const { c: C, tilt, R } = HAT, ct = Math.cos(tilt), st = Math.sin(tilt);
    hat.bone = b.head; hat.put(any((x, y, z) => {
      const dx = x - C[0], dy = y - C[1], dz = z - C[2], yy = dy * ct + dz * st, zz = dz * ct - dy * st, r = Math.hypot(dx, zz), a = Math.atan2(dx, zz);
      const edge = R + 0.018 * Math.sin(a * 9) + 0.03 * noise(a * 3, 1, 1) - 0.1 * Math.pow(Math.max(0, Math.cos(a - 2.3)), 14);
      return Math.max(Math.abs(yy - hatY(r)) * 0.86 - 0.012, r - edge);
    }, [C[0], C[1] + 0.15, C[2]], R + 0.1));
    hat.put(ball(hatPt(0, HAT.H + 0.005, 0), 0.03), { k: 0.03 });
    { const ring: V3[] = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * 6.283; ring.push(hatPt(Math.sin(a) * 0.15, hatY(0.15) - 0.03, Math.cos(a) * 0.15)); } hat.put(tube(ring, () => 0.014), { k: 0.01 }); }
    hat.displace((x, y, z) => { const dx = x - C[0], dz = z - C[2], r = Math.hypot(dx, dz), a = Math.atan2(dx, dz); return 0.0018 * Math.abs(Math.sin(a * 90 + r * 6)) + 0.0016 * Math.abs(Math.sin(r * 120)) + 0.0015 * fbm(x * 30, y * 30, z * 30, 2); }, 0.005);
    coin.bone = b.head; const cr = rng(31);
    for (let k = 0; k < 20; k++) {
      if (k === 9 || k === 10) continue; // a parting in front of the eyes
      const a = -2.0 + k / 19 * 4.0, rho = 0.27 + 0.012 * Math.sin(k * 1.7), x = Math.sin(a) * rho, zz = Math.cos(a) * rho, top = hatPt(x, hatY(rho) - 0.012, zz), n = 4 + Math.round(cr() * 1.6 + Math.cos(a) * 0.8);
      const bot: V3 = [top[0], top[1] - 0.06 * n - 0.03, top[2]]; coin.put(cone(top, bot, 0.0032, 0.0032), { k: 0.002 });
      for (let j = 0; j < n; j++) coin.put(ell([top[0], top[1] - 0.05 - j * 0.06, top[2]], [0.024, 0.024, 0.0055], [0, a + (cr() - 0.5) * 0.5, (cr() - 0.5) * 0.3]), { k: 0.002 });
    }
    coin.displace((x, y, z) => 0.0012 * noise(x * 160, y * 160, z * 160), 0.0015);
    // a length of mooring chain over the shoulder, a coil of it at the hip
    const link = (pts: V3[], bone: number) => pts.slice(1).forEach((p, i) => iron!.put(cone(pts[i], p, 0.026, 0.026), { bone, k: 0.008 }));
    link(curve([[0.3, 3.08, -0.03], [0.25, 2.9, 0.12], [0.05, 2.6, 0.13], [-0.16, 2.3, 0.11], [-0.26, 2.06, 0.04]], 40), b.chest);
    for (let r = 0; r < 3; r++) { const pp: V3[] = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI * 2; pp.push([-0.33 + Math.sin(a) * 0.1, 1.9 + r * 0.045, -0.04 + Math.cos(a) * 0.12]); } link(pp, b.hips); }
    iron!.displace((x, y, z) => 0.009 * Math.sin((x * 1.5 + y * 2.3 + z * 1.9) * 110) * 0.7, 0.009);
  }
  // --- round 2, the Coin-Mail: every fare he ever took has come up out of the river onto him. A cloak of black-gold scales to the water,
  //     the coins fused over his face into a mask with two holes, and the hat broken open into a crown of reeds.
  if (bare) {
    const mail = F(0.03, 0.011, 29, 16000, 0.05), mask = F(0.008, 0.0055, 29, 4200), crown = F(0.01, 0.008, 28, 4800);
    const byY = (y: number) => y > 2.62 ? b.chest : y > 2.28 ? b.spine2 : y > 1.95 ? b.spine1 : b.hips;
    mail.put(ell([0, 2.97, -0.15], [0.4, 0.2, 0.27]), { bone: b.chest, k: 0.1 }).put(ell([0, 3.12, -0.1], [0.27, 0.13, 0.25]), { bone: b.chest, k: 0.08 }).put(cone([0, 2.98, -0.12], [0, 3.42, 0.0], 0.09, 0.08), { bone: b.chest, op: 'sub', k: 0.03 });
    for (const [S, s2] of SIDES) mail.put(ell([0.42 * s2, 2.93, -0.13], [0.17, 0.16, 0.2], [0, 0, 0.5 * s2]), { bone: b['upperArm.' + S], k: 0.08 });
    // the long cloak behind and round the sides, open at the front, in bands down the back so it follows the spine
    const shell = (x: number, y: number, z: number) => { const k = Math.max(0, Math.min(1, (3.0 - y) / 2.85)), rx = 0.37 + 0.24 * k, rz = 0.24 + 0.1 * k, zc = -0.13 - 0.04 * k, e = Math.hypot(x / rx, (z - zc) / rz); return Math.max(Math.abs(e - 1) * rz * 0.85 - 0.018 - 0.008 * k, (z - zc) - rz * (0.15 - 0.1 * k) - 0.06 * Math.abs(Math.sin(y * 3.1))); };
    for (let i = 0; i < 9; i++) { const y0 = 3.02 - i * 0.33, y1 = y0 - 0.4, bone = byY((y0 + y1) / 2); mail.put(any((x, y, z) => Math.max(shell(x, y, z), y - y0, y1 - y), [0, (y0 + y1) / 2, -0.15], 0.9), { bone, k: 0.06 }); }
    mail.put(any((x, y, z) => (0.12 + 0.1 * fbm(x * 5, 2.2, z * 5, 2) + 0.12 * Math.pow(Math.abs(Math.sin(Math.atan2(x, z) * 6)), 5) - y) * 0.7), { op: 'int', k: 0.02 });
    mail.displace((x, y, z) => { const S = 0.052, u = Math.atan2(x, z - 0.05) * 0.34, row = Math.floor(y / (S * 0.72)), cu = u / S + row * 0.5, fu = cu - Math.floor(cu) - 0.5, fv = y / (S * 0.72) - row - 0.35, d = Math.hypot(fu, fv * 0.9); return 0.009 * Math.max(0, 0.55 - d) - 0.004 * sstep(0.42, 0.5, d) + 0.004 * fbm(x * 9, y * 9, z * 9, 2); }, 0.011);
    // the mask: coins grown together over the face, two holes, a seam where the mouth was
    mask.bone = b.head; mask.put(any((x, y, z) => { const e = ell([0, 3.52, 0.19], [0.125, 0.19, 0.145])[0](x, y, z); return Math.max(Math.abs(e) - 0.011, 0.2 - z); }, [0, 3.52, 0.3], 0.25));
    for (const [, s2] of SIDES) mask.put(ell([0.047 * s2, 3.594, 0.33], [0.024, 0.016, 0.06]), { op: 'sub', k: 0.006 });
    mask.put(box([0, 3.43, 0.33], [0.05, 0.003, 0.05], 0.002), { op: 'sub', k: 0.004 });
    mask.displace((x, y, z) => { const S = 0.034, row = Math.floor(y / (S * 0.8)), cu = x / S + row * 0.5, fu = cu - Math.floor(cu) - 0.5, fv = y / (S * 0.8) - row - 0.5, d = Math.hypot(fu, fv); return 0.004 * Math.max(0, 0.5 - d) - 0.002 * sstep(0.44, 0.5, d); }, 0.005);
    // the crown: the hat split open at the top, its reeds standing up and out like a burst sheaf
    const { c: C, tilt } = HAT, ct = Math.cos(tilt), st = Math.sin(tilt), R2 = 0.3; crown.bone = b.head;
    crown.put(any((x, y, z) => { const dx = x - C[0], dy = y - C[1], dz = z - C[2], yy = dy * ct + dz * st, zz = dz * ct - dy * st, r = Math.hypot(dx, zz), a = Math.atan2(dx, zz), edge = R2 + 0.05 * Math.sin(a * 7) + 0.04 * noise(a * 3, 4, 1); return Math.max(Math.abs(yy - hatY(r) + 0.04) * 0.86 - 0.012, r - edge, 0.15 + 0.03 * Math.sin(a * 11) - r); }, [C[0], C[1] + 0.2, C[2]], 0.6));
    const cr2 = rng(77); for (let i = 0; i < 19; i++) { const a = i / 19 * 6.283 + (cr2() - 0.5) * 0.3, r0 = 0.16, root = hatPt(Math.sin(a) * r0, hatY(r0) - 0.04, Math.cos(a) * r0), L = 0.16 + cr2() * 0.3, out = 0.9 + cr2() * 0.9, tip = add(root, [Math.sin(a) * L * out, L, Math.cos(a) * L * out * 0.8]); crown.put(cone(root, tip, 0.014, 0.003), { k: 0.008 }); }
    crown.displace((x, y, z) => 0.002 * Math.abs(Math.sin(Math.atan2(x, z) * 90)) + 0.0015 * fbm(x * 30, y * 30, z * 30, 2), 0.004);
  }
  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft, smoothSkin: mat === 31 ? Math.round(0.05 / voxel) : mat === 30 ? Math.round(0.09 / voxel) : 0 })), samples = baked.map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, samples, 0.3); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  // --- long black hair, wet and hanging: down the back and over the shoulders, and in front of the face in a split curtain
  const hr = rng(9);
  for (let i = 0; i < (bare ? 0 : 120); i++) {
    const front = i < 12, a = front ? (hr() < 0.5 ? -1 : 1) * (0.62 + hr() * 0.4) : (hr() - 0.5) * 4.4 + Math.PI, el = front ? 0.5 + hr() * 0.2 : 0.15 + hr() * 0.55;
    const root: V3 = [Math.sin(a) * 0.13 * Math.cos(el), 3.66 + 0.15 * Math.sin(el), 0.1 + Math.cos(a) * 0.165 * Math.cos(el)], L = front ? 0.3 + hr() * 0.2 : 0.6 + hr() * 0.55, p: V3[] = [root];
    let v: V3 = norm([Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6]); const ph = hr() * 6;
    for (let j = 1; j <= 12; j++) {
      const out_ = norm([p[j - 1][0], 0, p[j - 1][2] - 0.08]), clear = j < 6 ? 0.5 : 0.15;
      v = norm(add(mul(v, 0.45), add([0.05 * Math.sin(ph + j), -0.9, front ? 0.12 : -0.02], mul(out_, clear * 0.3))));
      p.push(add(p[j - 1], mul(v, L / 12)));
    }
    out.push(strand(p, 0.016 + hr() * 0.01, 0.45, 13, t => { const y = mix(root[1], p[12][1], t); return y > 3.3 ? [[b.head, 1]] : y > 3.05 ? [[b.head, (y - 3.05) / 0.25 + 0.001], [b.neck2, 1 - (y - 3.05) / 0.25]] : [[b.neck2, 0.3], [b.chest, 0.7]]; }));
  }
  void clamp; void belly;
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
