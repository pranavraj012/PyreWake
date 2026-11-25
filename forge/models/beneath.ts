// The One Beneath, round 2: what was wearing the Hanged King. Burnt lean, hollow, lit from inside, six arms ending in rib-bone blades.
import { BENEATH, boneIndex } from '../../src/anim/skeletons.ts';
import { Field, add, ball, belly, clamp, cone, curve, ell, fbm, lerp3, mix, mul, noise, norm, ridged, rng, sstep, sub, tube, type V3 } from '../sdf.ts';
import { bakeAO, decimate, merge, meshField, type Baked, type Mesh } from '../mesher.ts';
import { sheet, strand } from '../sheet.ts';

const b = boneIndex(BENEATH), at = (n: string) => BENEATH[b[n]].pos as V3;
const SIDES = [['L', 1], ['R', -1]] as const, mir = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];

export async function beneath(): Promise<Mesh> {
  const parts: [Field, number, number, number, number][] = [];
  const F = (k: number, voxel: number, mat: number, tris: number, soft = 0.04) => { const f = new Field(k); parts.push([f, voxel, mat, tris, soft]); return f; };
  const sk = F(0.05, 0.0105, 1, 30000), core = F(0.06, 0.016, 22, 2200), bone = F(0.012, 0.0085, 10, 9000), gum = F(0.02, 0.012, 22, 1200);
  // --- pelvis and a spine you can see through
  sk.bone = b.hips; sk.put(ell([0, 1.86, -0.03], [0.16, 0.11, 0.11]));
  for (const [, s] of SIDES) sk.put(ell([0.16 * s, 1.95, -0.01], [0.05, 0.13, 0.12], [0, 0, -0.45 * s]), { k: 0.04 });
  for (let i = 0; i < 18; i++) { const p = curve([[0, 1.9, -0.1], [0, 2.1, -0.14], [0, 2.4, -0.24], [0, 2.75, -0.36], [0, 3.02, -0.34], [0, 3.2, -0.2], [0, 3.36, -0.06]], 17)[i]; sk.put(ell(p, [0.05, 0.036, 0.06], [0.4, 0, 0]), { bone: i < 4 ? b.spine1 : i < 7 ? b.spine2 : i < 12 ? b.chest : b.neck, k: 0.03 }).put(cone(p, add(p, [0, 0.02, -0.1]), 0.022, 0.006), { bone: i < 4 ? b.spine1 : i < 7 ? b.spine2 : i < 12 ? b.chest : b.neck, k: 0.02 }); }
  sk.put(belly([0.07, 1.95, 0.02], [0.1, 2.4, -0.02], 0.035, 0.05, 0.03), { bone: b.spine1, k: 0.04 }).put(belly([-0.07, 1.95, 0.02], [-0.1, 2.4, -0.02], 0.035, 0.05, 0.03), { bone: b.spine1, k: 0.04 });
  // --- ribs stand free, splayed open at the breastbone; the fire sits behind them
  for (let i = 0; i < 8; i++) for (const [, s] of SIDES) {
    const y = 3.0 - i * 0.095, w = 0.25 + 0.085 * Math.sin((i + 1) / 9 * Math.PI), drop = 0.08 + i * 0.02, zc = -0.2 + (2.95 - y) * 0.2, open = 0.12 + i * 0.035;
    const pts = curve([[0.03 * s, y + 0.04, zc - 0.15], [w * 0.8 * s, y + 0.03, zc - 0.14], [(w + 0.04) * s, y - drop * 0.35, zc + 0.04], [(w * 0.8 + open * 0.3) * s, y - drop * 0.9, zc + 0.24], [open * s, y - drop - 0.02, zc + 0.36 + 0.02 * (i & 1)]], 12);
    pts.slice(1).forEach((p, j) => sk.put(cone(pts[j], p, 0.03 - j * 0.0008, 0.03 - (j + 1) * 0.0012), { bone: y > 2.52 ? b.chest : b.spine2, k: 0.03 }));
    const e = pts[pts.length - 1]; bone.put(cone(e, add(e, [-0.02 * s, -0.03, 0.14]), 0.022, 0.003), { bone: y > 2.52 ? b.chest : b.spine2 });
  }
  core.put(ell([0, 2.66, -0.1], [0.17, 0.3, 0.13], [0.2, 0, 0]), { bone: b.chest }).put(ell([0, 2.3, -0.09], [0.09, 0.18, 0.07]), { bone: b.spine2, k: 0.1 });
  core.displace((x, y, z) => 0.05 * ridged(x * 7, y * 7, z * 7, 3) - 0.03, 0.05);
  sk.put(ell([0, 3.0, -0.2], [0.3, 0.14, 0.17]), { bone: b.chest, k: 0.08 });
  // --- neck, skull
  sk.put(cone([0, 3.05, -0.16], [0, 3.3, 0.0], 0.085, 0.07), { bone: b.neck, k: 0.07 }).put(cone([0, 3.3, 0.0], [0, 3.44, 0.1], 0.07, 0.075), { bone: b.neck2 });
  sk.bone = b.head; sk.put(ell([0, 3.6, 0.14], [0.13, 0.19, 0.2])).put(ell([0, 3.44, 0.29], [0.088, 0.22, 0.1], [0.3, 0, 0]), { k: 0.07 });
  for (const [, s] of SIDES) sk.put(ell([0.07 * s, 3.57, 0.31], [0.05, 0.028, 0.05], [0, 0, 0.35 * s]), { op: 'sub', k: 0.03 }).put(ell([0.11 * s, 3.48, 0.26], [0.04, 0.05, 0.08], [0, 0.5 * s, 0.3 * s]), { k: 0.04 }).put(ell([0.1 * s, 3.36, 0.3], [0.03, 0.1, 0.06]), { op: 'sub', k: 0.04 });
  // a crown of broken ribs, grown out of the back of the skull
  for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.5, L = 0.42 - Math.abs(a) * 0.1, root: V3 = [Math.sin(a) * 0.11, 3.62 + Math.cos(a) * 0.1, 0.06], mid: V3 = [Math.sin(a) * (0.16 + L * 0.5), 3.66 + Math.cos(a) * (0.16 + L * 0.55), -0.08], tip: V3 = [Math.sin(a) * (0.1 + L), 3.66 + Math.cos(a) * (0.12 + L), 0.02 + 0.04 * (i & 1)]; const p = curve([root, mid, tip], 8); p.slice(1).forEach((q, j) => bone.put(cone(p[j], q, 0.026 - j * 0.0026, 0.026 - (j + 1) * 0.0028), { bone: b.head })); }
  // the mouth: brow to breastbone, lit
  const slit = curve([[0, 3.6, 0.35], [0, 3.46, 0.41], [0, 3.35, 0.36], [0, 3.24, 0.18], [0, 3.1, 0.05]], 20), gape = (t: number) => 0.016 + 0.062 * Math.pow(Math.sin(clamp(t * 0.96 + 0.03) * Math.PI), 0.75), hb = (y: number) => y > 3.36 ? b.head : y > 3.2 ? b.neck2 : b.neck;
  sk.put(tube(slit, gape), { op: 'sub', k: 0.03 });
  slit.slice(1).forEach((p, i) => gum.put(cone(add(slit[i], [0, 0, -0.1]), add(p, [0, 0, -0.1]), gape(i / 20) + 0.004, gape((i + 1) / 20) + 0.004), { bone: hb(p[1]) }));
  const r = rng(11); for (let i = 0; i < 34; i++) for (const s of [1, -1]) { const t = 0.04 + i / 34 * 0.9, q = t * 20, j = Math.min(19, Math.floor(q)), p = lerp3(slit[j], slit[j + 1], q - j), g = gape(t), B: V3 = [s * (g + 0.012), p[1], p[2] - 0.02]; bone.put(cone(B, [s * Math.max(0, g - 0.05 - r() * 0.03), p[1] + (r() - 0.5) * 0.03, p[2] + 0.01 + r() * 0.03], 0.012, 0.002), { bone: hb(p[1]) }); }

  // --- six arms
  for (const [S, s] of SIDES) {
    for (const [k, th] of [['', 1], ['2', 0.86], ['3', 0.78]] as [string, number][]) {
      const u = mir(at(`upperArm${k}.L`), s), e = mir(at(`foreArm${k}.L`), s), w = mir(at(`hand${k}.L`), s), U = b[`upperArm${k}.${S}`], E = b[`foreArm${k}.${S}`], W = b[`hand${k}.${S}`];
      const root: V3 = k === '' ? mir(at('clav.L'), s) : [0.12 * s, u[1] + 0.02, u[2] + 0.02], rb = k === '' ? b['clav.' + S] : k === '2' ? b.chest : b.spine2;
      sk.put(cone(root, u, 0.04, 0.045), { bone: rb, k: 0.05 }).put(ball(u, 0.07 * th), { bone: U, k: 0.06 }).put(belly(u, e, 0.05 * th, 0.062 * th, 0.036 * th, 0.35), { bone: U, k: 0.04 }).put(ball(e, 0.056 * th), { bone: E, k: 0.04 });
      const off: V3 = [0.018, 0.01, 0.03]; sk.put(cone(add(e, off), add(w, mul(off, 0.7)), 0.034 * th, 0.024 * th), { bone: E, k: 0.03 }).put(cone(sub(e, off), sub(w, mul(off, 0.7)), 0.032 * th, 0.022 * th), { bone: E, k: 0.03 }).put(belly(lerp3(e, w, 0.03), lerp3(e, w, 0.7), 0.03, 0.054 * th, 0.016, 0.22), { bone: E, k: 0.04 });
      sk.put(ell(w, [0.045 * th, 0.06 * th, 0.05 * th]), { bone: W, k: 0.04 });
      // the blade: a rib ground to an edge, longer than the forearm
      const d = norm(sub(w, e)), L = k === '' ? 1.15 : 0.9, n: V3 = [0, 0.1, 1], tip = add(add(w, mul(d, L)), mul(n, 0.16));
      const spine = curve([add(w, mul(d, -0.12)), add(add(w, mul(d, L * 0.35)), mul(n, -0.07)), add(add(w, mul(d, L * 0.75)), mul(n, 0.0)), tip], 10);
      spine.slice(1).forEach((p, j) => { const t0 = j / 10, t1 = (j + 1) / 10, wd = (t: number) => 0.062 * th * Math.pow(1 - t, 0.5) + 0.004; bone.put(cone(spine[j], p, wd(t0) * 0.55, wd(t1) * 0.55), { bone: W }).put(cone(add(spine[j], mul(n, wd(t0) * 0.9)), add(p, mul(n, wd(t1) * 0.9)), wd(t0) * 0.28, wd(t1) * 0.24), { bone: W, k: 0.02 }).put(cone(add(spine[j], mul(n, wd(t0) * 1.5)), add(p, mul(n, wd(t1) * 1.5)), wd(t0) * 0.12 + 0.002, wd(t1) * 0.1 + 0.002), { bone: W, k: 0.012 }); });
      if (k === '') for (let i = 0; i < 4; i++) { const f = add(w, add(mul(d, 0.1), [0, 0, (i - 1.5) * 0.035])); sk.put(cone(w, f, 0.022, 0.018), { bone: W, k: 0.02 }).put(cone(f, add(f, add(mul(d, 0.08), [-0.06 * s, 0, 0])), 0.016, 0.01), { bone: W, k: 0.012 }); }
    }
    const h = mir(at('thigh.L'), s), kn = mir(at('shin.L'), s), f = mir(at('foot.L'), s), t = mir(at('toe.L'), s);
    sk.put(ell(add(h, [0.02 * s, 0, 0]), [0.08, 0.11, 0.1]), { bone: b['thigh.' + S], k: 0.07 }).put(cone(h, kn, 0.07, 0.046), { bone: b['thigh.' + S] }).put(belly(add(h, [0.02 * s, -0.05, 0.03]), add(kn, [0, 0.08, 0.02]), 0.03, 0.066, 0.02, 0.4), { bone: b['thigh.' + S], k: 0.04 });
    sk.put(ell(add(kn, [0, 0, 0.015]), [0.06, 0.074, 0.07]), { bone: b['shin.' + S], k: 0.04 }).put(cone(add(kn, [0, -0.03, 0.02]), add(f, [0, 0, 0.015]), 0.042, 0.03), { bone: b['shin.' + S] }).put(belly(add(kn, [0, -0.02, -0.03]), add(f, [0, 0.05, -0.035]), 0.026, 0.056, 0.012, 0.28), { bone: b['shin.' + S], k: 0.03 });
    bone.put(cone(add(kn, [0, 0.02, 0.06]), add(kn, [0, 0.2, 0.17]), 0.03, 0.004), { bone: b['shin.' + S] });
    sk.put(ell(add(f, [0, -0.06, -0.06]), [0.045, 0.075, 0.07]), { bone: b['foot.' + S], k: 0.05 }).put(cone(add(f, [0, -0.02, 0.02]), add(t, [0, 0.02, 0]), 0.05, 0.04), { bone: b['foot.' + S] });
    for (let i = 0; i < 4; i++) { const x = t[0] + (i - 1.5) * 0.042 * s; sk.put(cone([x, 0.05, t[2] - 0.02], [x + (i - 1.5) * 0.02 * s, 0.03, t[2] + 0.1], 0.026, 0.014), { bone: b['toe.' + S], k: 0.02 }); bone.put(cone([x + (i - 1.5) * 0.02 * s, 0.03, t[2] + 0.09], [x + (i - 1.5) * 0.03 * s, 0.012, t[2] + 0.2], 0.014, 0.002), { bone: b['toe.' + S] }); }
  }
  sk.displace((x, y, z) => 0.008 * fbm(x * 8, y * 8, z * 8, 3) - 0.011 * ridged(x * 13, y * 7, z * 13, 3) + 0.006, 0.018);
  bone.displace((x, y, z) => 0.0022 * noise(x * 40, y * 16, z * 40), 0.003);

  const baked: Baked[] = parts.map(([f, voxel, mat, , soft]) => meshField(f, { voxel, mat, soft, smoothSkin: Math.round(0.06 / voxel) })), samples = baked.filter((_, i) => i !== 1 && i !== 3).map(q => q.sample), out: Mesh[] = [];
  for (let i = 0; i < baked.length; i++) { bakeAO(baked[i].mesh, samples, 0.34); out.push(await decimate(baked[i].mesh, parts[i][3])); }
  // --- burning hair, and the old skin still hanging from the hips
  const hr = rng(5);
  for (let i = 0; i < 42; i++) {
    const a = Math.PI * 0.45 + hr() * Math.PI * 1.1, n: V3 = [Math.sin(a), 0.5 + hr() * 0.5, Math.cos(a)], p: V3[] = [[n[0] * 0.11, 3.62 + n[1] * 0.06, 0.12 + n[2] * 0.14]], L = 0.7 + hr() * 0.7, seg = 9, ph = hr() * 6; let v: V3 = [n[0] * 0.6, 0.3, n[2]];
    for (let j = 1; j <= seg; j++) { v = norm(add(mul(v, 0.5), [0.1 * Math.sin(ph + j), -0.7, -0.12])); p.push(add(p[j - 1], mul(v, L / seg))); }
    const ch = 'hB' + (n[0] > 0 ? 'L' : 'R'); out.push(strand(p, 0.012 + hr() * 0.016, 0.3, 19, t => { const q = t * 2.6, k = Math.min(2, Math.floor(q)), f = Math.min(1, q - k), hd = Math.max(0, 1 - t / 0.3); if (hd > 0) return [[b.head, hd], [b[ch + '1'], 1 - hd + 0.001]]; return [[b[ch + (k + 1)], 1 - f + 0.001], [b[ch + Math.min(3, k + 2)], f + 0.001]]; }));
  }
  const rag = (a0: number, a1: number, L: number, seed: number, flare: number) => sheet((u, v) => { const a = mix(a0, a1, u), fold = Math.sin(a * 7 + seed) * 0.04 * (0.3 + v) + noise(a * 3, v * 3, seed) * 0.09 * v; return [Math.sin(a) * (0.2 + flare * v + fold), 2.03 - L * v, -0.035 + Math.cos(a) * (0.17 + flare * v * 0.9 + fold)] as V3; }, { nu: 22, nv: 18, mat: 9, tatter: 0.7, seed, weights: (u, v) => { const x = Math.sin(mix(a0, a1, u)), w = sstep(0.15, 1, v) * 0.6, l = clamp(0.5 + x * 0.8); return [[b.hips, 1 - w + 0.001], [b['thigh.L'], w * l + 0.001], [b['thigh.R'], w * (1 - l) + 0.001]]; } });
  out.push(rag(2.0, 4.3, 1.5, 9, 0.3), rag(-0.5, 0.4, 0.8, 5, 0.12), rag(0.9, 1.6, 1.0, 15, 0.2), rag(-1.7, -1.0, 1.1, 23, 0.2));
  return merge(out);
}
