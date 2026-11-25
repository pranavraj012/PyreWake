// Round 1 arena: the charnel court.
import * as THREE from 'three';
import { loadGeo, loadJson, type TexSet } from '../render/assets.ts';
import { DEPTH, FOG, surface } from '../render/surface.ts';
import { shadowOnly } from '../render/shadowProxy.ts';
import { makeAsh, makeEmbers, makeFires, makeSmoke } from '../render/ambient.ts';
import type { Tier } from '../core/quality.ts';

export const COURT_R = 23;
/** Pillar footprints, for movement. */
export const PILLARS = Array.from({ length: 10 }, (_, i) => { const a = (i + 0.5) / 10 * Math.PI * 2; return { x: Math.cos(a) * 16.5, z: Math.sin(a) * 16.5, r: 0.85 }; });
const seeded = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

type P2 = [number, number];
/** Worn floor slabs. Some are split into shards that have settled at different angles. */
function slabs(r: () => number, lo: boolean) {
  const pos: number[] = [], nrm: number[] = [], info: number[] = [], idx: number[] = [];
  const poly = (p: P2[], y: number, tilt: number) => {
    const n = p.length, cx = p.reduce((a, q) => a + q[0], 0) / n, cz = p.reduce((a, q) => a + q[1], 0) / n, tx = (r() - 0.5) * tilt, tz = (r() - 0.5) * tilt, b = 0.016 + r() * 0.014;
    const ring = (inset: number, dy: number, out: number, ao: number, cv: number) => p.forEach(([x, z]) => {
      const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1, k = Math.max(0, 1 - inset / l), v = new THREE.Vector3(dx / l * out - tx, out > 0.9 ? 0.04 : 1 - out * 0.55, dz / l * out - tz).normalize();
      pos.push(cx + dx * k, y + dy + dx * tx + dz * tz, cz + dz * k); nrm.push(v.x, v.y, v.z); info.push(ao * 255, cv * 255, 0, 16);
    });
    const base = pos.length / 3;
    ring(0, -0.2, 0.98, 0.15, 0.3); ring(0, -b, 0.75, 0.55, 0.72); ring(b, 0, 0.12, 0.85, 0.78); if (!lo) { ring(b + 0.03, 0.001, 0, 0.95, 0.52); ring(b + 0.16, 0.002, 0, 1, 0.5); }
    const K = lo ? 2 : 4; for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) { const a = base + k * n + i, d = base + k * n + (i + 1) % n; idx.push(a, d, a + n, d, d + n, a + n); }
    for (let i = 1; i < n - 1; i++) idx.push(base + K * n, base + K * n + i, base + K * n + i + 1);
  };
  const split = (p: P2[], depth: number, out: P2[][]) => {
    if (depth <= 0) { out.push(p); return; }
    const cx = p.reduce((a, q) => a + q[0], 0) / p.length + (r() - 0.5) * 0.4, cz = p.reduce((a, q) => a + q[1], 0) / p.length + (r() - 0.5) * 0.4, an = r() * 6.28, nx = Math.cos(an), nz = Math.sin(an);
    for (const s of [1, -1]) {
      const o: P2[] = [];
      p.forEach((q, i) => {
        const w = p[(i + 1) % p.length], a = ((q[0] - cx) * nx + (q[1] - cz) * nz) * s - 0.008, d = ((w[0] - cx) * nx + (w[1] - cz) * nz) * s - 0.008;
        if (a >= 0) o.push(q);
        if ((a >= 0) !== (d >= 0)) { const t = a / (a - d); o.push([q[0] + (w[0] - q[0]) * t, q[1] + (w[1] - q[1]) * t]); }
      });
      if (o.length >= 3) split(o, depth - 1 - (r() < 0.3 ? 1 : 0), out);
    }
  };
  for (let ring = 0; ring < 19; ring++) {
    const R0 = 0.75 + ring * 1.17, R1 = R0 + 1.15, n = Math.max(5, Math.round((R0 + 0.6) * 6.283 / (1.35 + r() * 0.5))), off = r() * 6;
    for (let i = 0; i < n; i++) {
      if (r() < 0.02 + ring * 0.003) continue;
      const a0 = off + i / n * 6.283 + 0.012 / R0, a1 = off + (i + 1) / n * 6.283 - 0.012 / R0, j = () => (r() - 0.5) * 0.035;
      const quad: P2[] = [[Math.cos(a0) * R0 + j(), Math.sin(a0) * R0 + j()], [Math.cos(a1) * R0 + j(), Math.sin(a1) * R0 + j()], [Math.cos(a1) * R1 + j(), Math.sin(a1) * R1 + j()], [Math.cos(a0) * R1 + j(), Math.sin(a0) * R1 + j()]];
      const parts: P2[][] = [], broken = r() < (lo ? 0.1 : 0.3); split(quad, broken ? 1 + Math.floor(r() * 2.4) : 0, parts);
      for (const q of parts) poly(q, (r() - 0.5) * 0.02 - (broken ? r() * 0.045 : 0), broken ? 0.09 : 0.02);
    }
  }
  const c: P2[] = []; for (let i = 0; i < 10; i++) c.push([Math.cos(i / 10 * 6.283) * 0.72, Math.sin(i / 10 * 6.283) * 0.72]); poly(c, 0.01, 0.01);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array(info), 4, true)); g.setIndex(idx);
  return g;
}

function ground(seg: number) {
  const g = new THREE.PlaneGeometry(170, 170, seg, seg).rotateX(-Math.PI / 2), p = g.attributes.position, info = new Uint8Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z), n = Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27 + x * 0.1);
    p.setY(i, d < 25 ? -0.075 + 0.03 * Math.sin(x * 1.7) * Math.cos(z * 1.4) : -0.07 + n * 0.5 * Math.min(1, (d - 25) / 10) + Math.max(0, d - 70) * 0.06);
    info.set([255, 128, 0, 21], i * 4);
  }
  g.computeVertexNormals(); g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4, true)); return g;
}

export async function buildCourt(tex: TexSet, tier: Tier) {
  const lo = tier.name !== 'high', ph = tier.name === 'phone', r = seeded(11), group = new THREE.Group();
  const names = ['pillar0', 'pillar1', 'pillar2', 'block0', 'block1', 'block2', 'rubble0', 'rubble1', 'shrine', 'banyan', 'roots0', 'roots1', 'roots2', 'shroud', 'pyre'];
  const G = Object.fromEntries(await Promise.all(names.map(async n => [n, await loadGeo(n)] as const)));
  const [shrineLo, banyanLo] = await Promise.all([loadGeo('shrine', '.lo'), loadGeo('banyan', '.lo')]);
  const stone = surface(tex, tier, { world: true, ash: 0.75 }), rift = { value: 0 }, floor = surface(tex, tier, { world: true, ash: 0.5, wet: 0.85, rift }), wood = surface(tex, tier, { world: true, ash: 0.35 }), bark = surface(tex, tier, { world: true, ash: 0.35 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.still; group.add(o); return o; };
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], cast = true) => { const o = new THREE.InstancedMesh(g, m, list.length); list.forEach((x, i) => o.setMatrixAt(i, x)); o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.inst; o.frustumCulled = false; group.add(o); return o; };
  const M = (x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));

  mesh(slabs(r, lo), floor, false); mesh(ground(lo ? 56 : 110), floor, false);

  // pillars
  const pl: THREE.Matrix4[][] = [[], [], []];
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, k = [0, 1, 0, 2, 0, 0, 1, 0, 2, 0][i]; pl[k].push(M(Math.cos(a) * 16.5, -0.03, Math.sin(a) * 16.5, r() * 6, 1, (r() - 0.5) * 0.03, (r() - 0.5) * 0.04)); }
  const lite = await Promise.all([0, 1, 2].map(i => loadGeo('pillar' + i, '.xs')));
  pl.forEach((l, i) => { inst(G['pillar' + i], stone, l, false); group.add(shadowOnly((g, m) => { const o = new THREE.InstancedMesh(g, m, l.length); l.forEach((x, k) => o.setMatrixAt(k, x)); return o; }, lite[i], DEPTH.inst)); });

  // ruined wall
  const bl: THREE.Matrix4[][] = [[], [], []], rb: THREE.Matrix4[][] = [[], []];
  for (let i = 0; i < 92; i++) {
    const a = i / 92 * Math.PI * 2, gap = Math.abs(Math.sin(a * 0.5 + 0.78)) < 0.07;
    const H = gap ? 0 : Math.max(0, Math.round(4.4 + 2.2 * Math.sin(a * 3 + 1) + 1.4 * Math.sin(a * 7.3) + (r() - 0.5) * 1.5));
    for (let c = 0; c < H; c++) { const aa = a + (c & 1) * 0.034; bl[Math.floor(r() * 3)].push(M(Math.cos(aa) * (COURT_R + 0.9) + (r() - 0.5) * 0.1, 0.35 + c * 0.79, Math.sin(aa) * (COURT_R + 0.9), -aa + Math.PI / 2 + (r() - 0.5) * 0.05 + (r() < 0.5 ? Math.PI : 0), 1.03, 0, c === H - 1 ? (r() - 0.5) * 0.2 : 0)); }
    if (H < 3) for (let k = 0; k < 2; k++) bl[Math.floor(r() * 3)].push(M(Math.cos(a) * (COURT_R - 0.4 - r() * 2.2), 0.22, Math.sin(a) * (COURT_R - 0.4 - r() * 2.2), r() * 6, 0.75 + r() * 0.3, r() * 6, r() * 0.6));
  }
  for (let i = 0; i < (ph ? 30 : lo ? 90 : 170); i++) { const a = r() * 6.28, d = 14.5 + Math.sqrt(r()) * 9, s = 0.12 + Math.pow(r(), 3) * 0.75; rb[i & 1].push(M(Math.cos(a) * d, s * 0.12, Math.sin(a) * d, r() * 6, s, r() * 6, r() * 6)); }
  bl.forEach((l, i) => inst(G['block' + i], stone, l, false)); rb.forEach((l, i) => inst(G['rubble' + i], stone, l, false));

  // shrines and skyline
  inst(G.shrine, stone, [M(-27, -0.2, -19, 0.9, 1.15), M(30, -0.3, -13, -1.1, 1.0)], false);
  inst(shrineLo, stone, [...(ph ? [] : [M(-44, -1, -50, 0.5, 2.0)]), M(25, -1, -62, 0, 2.6, 0, 0.04), M(62, -1, -38, -0.6, 1.9), ...(ph ? [] : [M(-66, -1, -14, 1.2, 1.8)]), M(52, -1, 30, 2.1, 1.7), M(-40, -1, 46, 2.6, 2.0), ...(ph ? [] : [M(12, -1, 66, 3, 2.4), M(-70, -1, 20, 1.6, 2.2)])], false);
  if (!ph) inst(banyanLo, wood, [M(-52, -1, 8, 2, 0.8), M(48, -1, 8, 4, 0.75), M(-30, -1, 40, 1, 0.7), M(34, -1, 44, 5, 0.85), M(2, -1, 52, 3, 0.7), M(-58, -1, -38, 0, 0.9), M(58, -1, -14, 2.6, 0.7)], false);

  // banyan, roots, shrouds
  const tree = mesh(G.banyan, bark); tree.position.set(0, -0.4, -27); tree.scale.setScalar(1.25); tree.rotation.y = 0.35;
  const ro: THREE.Matrix4[][] = [[], [], []], sh: THREE.Matrix4[] = [];
  // aerial roots hang from real points along the limbs
  const limbs = await loadJson('banyan') as number[][][], w = new THREE.Vector3(), lp: THREE.Vector3[] = []; tree.updateMatrixWorld();
  for (const l of limbs) for (let i = 4; i < l.length; i++) { w.fromArray(l[i]).applyMatrix4(tree.matrixWorld); if (w.z > -31 && w.z < 8) lp.push(w.clone()); }
  for (const p of lp) for (let k = 0; k < 2; k++) {
    const clump = 0.5 + 0.5 * Math.sin(p.x * 0.8 + p.z * 0.55);
    if (r() > 0.1 + 0.55 * clump * clump) continue;
    const s = 0.4 + Math.pow(r(), 1.6) * 1.15, x = p.x + (r() - 0.5) * 0.5, z = p.z + (r() - 0.5) * 0.5;
    ro[Math.floor(r() * 3)].push(M(x, p.y - 0.05, z, r() * 6, s, (r() - 0.5) * 0.05, (r() - 0.5) * 0.05));
    if (r() < 0.3 && sh.length < (ph ? 6 : 20)) { const drop = 2.2 + r() * 2.6; sh.push(M(x + 0.3, p.y - drop, z + 0.3, r() * 6, 0.92 + r() * 0.15, 0, (r() - 0.5) * 0.07)); ro[Math.floor(r() * 3)].push(M(x + 0.3, p.y, z + 0.3, r() * 6, drop / 4.6)); }
  }
  ro.forEach((l, i) => inst(G['roots' + i], wood, ph ? l.filter((_, k) => k % 3 < 1) : lo ? l.filter((_, k) => k % 5 < 3) : l, !ph)); inst(G.shroud, wood, sh, !ph);

  // pyres
  const fires: THREE.Vector3[] = []; const py: THREE.Matrix4[] = [];
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2 + 0.28, x = Math.cos(a) * 19.8, z = Math.sin(a) * 19.8; py.push(M(x, -0.05, z, r() * 6)); fires.push(new THREE.Vector3(x, 0.45, z)); }
  inst(G.pyre, wood, py, !ph);
  fires.forEach((f, i) => FOG.uGlowP.value[i].set(f.x, f.y + 0.9, f.z, 0.0075));
  group.add(makeFires(fires), makeSmoke(fires), makeEmbers(fires, tier), makeAsh(tier));
  const lights = fires.slice(0, tier.lights).map(() => { const l = new THREE.PointLight(0xff9448, 0, 18, 1.8); group.add(l); return l; });

  // round 2: the banyan burns
  const tp = lp.filter((_, i) => i % Math.max(1, Math.round(lp.length / (ph ? 12 : 26))) === 0), burn = makeFires(tp.map(p => p.clone().setY(p.y - 0.6)), ph ? 2 : 4, 1.5), burnE = makeEmbers(tp, tier); burn.visible = burnE.visible = false; group.add(burn, burnE);
  group.updateMatrixWorld(true); group.traverse(o => { if (!(o as THREE.PointLight).isPointLight) o.matrixAutoUpdate = false; });
  return {
    group, fires, /** 0-1: round 2's burning court. */ omen(k: number) { rift.value = k * 0.6; burn.visible = burnE.visible = k > 0.35; (burn.material as THREE.ShaderMaterial).uniforms.uGain.value = Math.max(0, (k - 0.35) / 0.65) * 0.5; },
    update(t: number, focus: THREE.Vector3) {
      const near = [...fires].sort((a, b) => a.distanceToSquared(focus) - b.distanceToSquared(focus));
      lights.forEach((l, i) => { const f = near[i]; l.position.set(f.x, f.y + 1.25, f.z); l.intensity = 62 * (0.85 + 0.12 * Math.sin(t * 9 + f.x) + 0.08 * Math.sin(t * 23 + f.z)); });
    },
  };
}
