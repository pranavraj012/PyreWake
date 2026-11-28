// The third fight: the Waiting House on the hill. A paved court of red sandstone with brass hour lines, ringed by a cusped cloister whose wards
// hold the cots of the dead; the great dial at the north; a ceiling of smoke seven metres up, lit orange from inside. Round 2 has no ceiling: a low red sun.
import * as THREE from 'three';
import { loadGeo, loadJson, type TexSet } from '../render/assets.ts';
import { DEPTH, FOG, surface } from '../render/surface.ts';
import { Ruin } from './ruin.ts';
import { makeHouseProps } from './props.ts';
import { slabs } from '../bosses/king/court.ts';
import { makeAsh } from '../render/ambient.ts';
import { shadowOnly } from '../render/shadowProxy.ts';
import type { Tier } from '../core/quality.ts';

const seeded = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** Where the dial's gnomon meets the court floor; the hour lines run out from here. */
export const DIAL_FOOT = new THREE.Vector3(0, 0, -17.6);
/** The cloister ring, and the angle (from +z, toward +x) of the sun's side in round 2. */
export const CLOISTER_R = 21.6, SUN_SIDE = -1.95;
const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); } float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(3.7,1.3); a*=.5; } return s; }`;

/** Flat brass strips inlaid in the floor: [x0, z0, x1, z1, width]. */
function strips(list: [number, number, number, number, number][], y: number, mat: number) {
  const pos: number[] = [], nrm: number[] = [], info: number[] = [], idx: number[] = [];
  for (const [x0, z0, x1, z1, w] of list) { const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w, b = pos.length / 3; pos.push(x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz, x1 - nx, y, z1 - nz, x1 + nx, y, z1 + nz); for (let k = 0; k < 4; k++) { nrm.push(0, 1, 0); info.push(230, 160, 0, mat); } idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array(info), 4, true)); g.setIndex(idx); return g;
}
/** Rough boxes: roofs and the fallen. */
function boxes(list: [number, number, number, number, number, number, number, number?][], mat: number) {
  const parts = list.map(([x, y, z, hx, hy, hz, yaw, tilt]) => { const b = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2).toNonIndexed(); b.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt ?? 0, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))); return b; });
  const pos: number[] = [], nrm: number[] = []; for (const b of parts) { pos.push(...b.attributes.position.array); nrm.push(...b.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); const n = pos.length / 3, a = new Uint8Array(n * 4); for (let i = 0; i < n; i++) a.set([200, nrm[i * 3 + 1] > 0.5 ? 200 : 150, 0, mat], i * 4); g.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); return g;
}

export async function buildHouse(tex: TexSet, tier: Tier) {
  const lo = tier.name !== 'high', ph = tier.name === 'phone', r = seeded(41), group = new THREE.Group();
  const stone = surface(tex, tier, { world: true, ash: 0.22 }), floor = surface(tex, tier, { world: true, ash: 0.42, scars: true }), held = surface(tex, tier, { world: false, ash: 0.2 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.still; group.add(o); return o; };
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], cast = true) => { const o = new THREE.InstancedMesh(g, m, Math.max(1, list.length)); list.forEach((x, i) => o.setMatrixAt(i, x)); o.count = list.length; o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.inst; o.frustumCulled = false; group.add(o); return o; };
  const M = (x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));
  const [gArcade, gDial, gCot, gCotXs, gBowl, gBeam, c0, c1, c2, x0, x1, x2, gArcXs, gDialXs] = await Promise.all(['arcade', 'dial', 'cot', ['cot', '.xs'], 'bowl', 'beam', 'hcol0', 'hcol1', 'hcol2', ['hcol0', '.xs'], ['hcol1', '.xs'], ['hcol2', '.xs'], ['arcade', '.xs'], ['dial', '.xs']].map(n => Array.isArray(n) ? loadGeo(n[0], n[1]) : loadGeo(n)));
  // --- the court: red sandstone paving, worn; the bed beyond it
  mesh(slabs(r, lo, 36), floor, false);
  const bed = new THREE.PlaneGeometry(400, 400, 1, 1).rotateX(-Math.PI / 2); bed.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array([60, 128, 0, 36, 60, 128, 0, 36, 60, 128, 0, 36, 60, 128, 0, 36]), 4, true)); mesh(bed, floor, false).position.y = -0.08;
  // --- brass hour lines from the dial's foot, and two arcs
  const F = DIAL_FOOT, L: [number, number, number, number, number][] = [];
  for (let h = -6; h <= 6; h++) { const a = h / 6 * Math.PI / 2 * 0.98, R0 = h === 0 ? 1.2 : 2.5; L.push([F.x + Math.sin(a) * R0, F.z + Math.cos(a) * R0, F.x + Math.sin(a) * 44, F.z + Math.cos(a) * 44, h % 3 === 0 ? 0.055 : 0.035]); }
  for (let q = -24; q <= 24; q++) { if (q % 4 === 0) continue; const a = q / 24 * Math.PI / 2 * 0.98; L.push([F.x + Math.sin(a) * 11.5, F.z + Math.cos(a) * 11.5, F.x + Math.sin(a) * 13.0, F.z + Math.cos(a) * 13.0, 0.022]); L.push([F.x + Math.sin(a) * 28.5, F.z + Math.cos(a) * 28.5, F.x + Math.sin(a) * 30.5, F.z + Math.cos(a) * 30.5, 0.03]); }
  for (const R of [12.2, 29.4]) for (let i = 0; i < 64; i++) { const a0 = (i / 64 - 0.5) * Math.PI * 0.98, a1 = ((i + 1) / 64 - 0.5) * Math.PI * 0.98; L.push([F.x + Math.sin(a0) * R, F.z + Math.cos(a0) * R, F.x + Math.sin(a1) * R, F.z + Math.cos(a1) * R, 0.03]); }
  const brass = mesh(strips(L, 0.013, 37), floor, false); brass.renderOrder = 1;
  // --- the cloister: cusped bays all round, but where the dial stands
  const bays: THREE.Matrix4[] = [], bayA: number[] = []; const NB = 30; for (let i = 0; i < NB; i++) { const a = (i + 0.5) / NB * Math.PI * 2; if (Math.cos(a) < -0.985) continue; bays.push(M(Math.sin(a) * CLOISTER_R, 0, Math.cos(a) * CLOISTER_R, a + Math.PI)); bayA.push(a); }
  const arcade = inst(ph ? gArcXs : gArcade, stone, bays, false), arcShadow = shadowOnly((g, m) => new THREE.InstancedMesh(g, m, bays.length), gArcXs, DEPTH.inst); bays.forEach((x, i) => arcShadow.setMatrixAt(i, x)); group.add(arcShadow);
  // the wards' roofs, half fallen, and the gaps the light comes through
  const onSun = (a: number) => { let d = a - SUN_SIDE; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; return Math.abs(d) < 0.8; };
  const roof: [number, number, number, number, number, number, number, number?][] = [], roofSun: typeof roof = []; bayA.forEach(a => { if (r() < 0.35) return; const R = CLOISTER_R + 1.7, f = r() < 0.3; (onSun(a) ? roofSun : roof).push([Math.sin(a) * R, f ? 4.4 : 6.15, Math.cos(a) * R, 2.25, 0.14, 1.9, a, f ? 0.4 : 0]); });
  mesh(boxes(roof, 19), stone); const sunRoof = roofSun.length ? mesh(boxes(roofSun, 19), stone) : null;
  // the dial, its foot at the edge of the court
  { const d = mesh(gDial, stone, false); d.position.copy(F); const sh = shadowOnly((g, m) => new THREE.Mesh(g, m), gDialXs, DEPTH.still); sh.position.copy(F); group.add(sh); }
  // --- the ward: rows of cots behind the arches, each with its ash shape; bowls hung over them
  const ward: THREE.Matrix4[] = []; bayA.forEach(a => { for (const k of [-1, 1]) { const R = CLOISTER_R + 1.5, t = a + k * 0.045; if (r() < 0.15) continue; ward.push(M(Math.sin(t) * R, 0, Math.cos(t) * R, a + Math.PI / 2 + (r() - 0.5) * 0.1)); } });
  inst(lo ? gCotXs : gCot, stone, ward, false);
  const bowlAt: { p: THREE.Vector3; ph: number; sun: boolean }[] = []; bayA.forEach(a => { const n = 1 + (r() < 0.5 ? 1 : 0); for (let k = 0; k < n; k++) { const t = a + (k - (n - 1) / 2) * 0.05, R = CLOISTER_R + 0.4 + r() * 1.6; bowlAt.push({ p: new THREE.Vector3(Math.sin(t) * R, 5.3 + r() * 0.3, Math.cos(t) * R), ph: r() * 6, sun: onSun(a) }); } });
  const bowls = inst(gBowl, held, bowlAt.map(b => M(b.p.x, b.p.y, b.p.z)), false);
  // fallen beams on the ward floors
  const beams: THREE.Matrix4[] = []; for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, R = CLOISTER_R + 1.2 + r() * 1.4; beams.push(M(Math.sin(a) * R, 0.15, Math.cos(a) * R, a + (r() - 0.5) * 0.8, 1, 0, (r() - 0.5) * 0.4)); } inst(gBeam, stone, beams);
  // --- stone that breaks: the cots in the court burst into ash at a touch; the columns topple
  const bitN = ['cotBits', 'hcol0Bits', 'hcol1Bits', 'hcol2Bits'], bits = await Promise.all(bitN.map(n => loadGeo(n))), info = await Promise.all(bitN.map(n => loadJson(n))), shards = await Promise.all(['shard0', 'shard1'].map(n => loadGeo(n)));
  const ruin = new Ruin({ stele: gCot, steleXs: gCotXs, pillars: [c0, c1, c2], pillarsXs: [x0, x1, x2], bits, info, shards, stone, loose: surface(tex, tier, { ash: 0.2 }), depth: DEPTH, tier }, makeHouseProps()); group.add(ruin.group);
  for (const l of ruin.lamps) l.lit = false;
  // --- the smoke ceiling: seven metres up, lit from inside as if the house still burned above it. `uIn` draws it down into her mouth.
  const smokeU = { uT: FOG.uFogP, uK: { value: 1 }, uIn: { value: 0 }, uAt: { value: new THREE.Vector3(0, 3, -4) } };
  const smokeG = new THREE.PlaneGeometry(130, 130, ph ? 40 : 90, ph ? 40 : 90).rotateX(Math.PI / 2);
  const smoke = new THREE.Mesh(smokeG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: smokeU,
    vertexShader: `uniform vec4 uT; uniform float uIn; uniform vec3 uAt; varying vec2 w; varying float d, pull; ${NOISE}
void main(){ vec3 p = position; p.y = 7.2 + (fbm(p.xz * .06 + uT.w * .01) - .5) * 1.6; w = p.xz; d = length(p.xz);
 vec3 to = uAt - p; float L = length(to); pull = smoothstep(0., 1., uIn * 1.6 - (L / 70.)); float sw = pull * 2.5; vec2 q = p.xz - uAt.xz; p.xz = uAt.xz + mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * q * (1. - pull * .985); p.y = mix(p.y, uAt.y, pull);
 gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform vec4 uT; uniform float uK, uIn; varying vec2 w; varying float d, pull; ${NOISE}
void main(){ float t = uT.w; vec2 q = w * .045; float a = fbm(q + vec2(t * .012, -t * .008)), b = fbm(q * 2.6 - vec2(t * .02, t * .015) + a * 1.4), lit = smoothstep(.35, .85, b * .7 + a * .5);
 float pulse = .75 + .25 * sin(t * .5 + a * 6.) * sin(t * .23 + b * 4.);
 vec3 c = mix(vec3(.018, .011, .009), vec3(.95, .26, .06) * .55, lit * lit * pulse) + vec3(1., .5, .16) * .18 * smoothstep(.7, .95, b) * pulse;
 float edge = smoothstep(62., 30., d); gl_FragColor = vec4(c, (.9 + .1 * a) * edge * uK * (1. - pull * .6)); }` }));
  smoke.frustumCulled = false; smoke.renderOrder = 2; group.add(smoke);
  // the light from it, on everything below
  const ceilingGlow = tier.lights > 0 ? [0, 1, 2].map(i => { const l = new THREE.PointLight(0xff7a3a, 0, 26, 1.6); l.position.set(Math.sin(i * 2.1) * 9, 6.3, Math.cos(i * 2.1) * 9 - 2); group.add(l); return l; }) : [];
  const ash = makeAsh(tier); group.add(ash);
  // round 2: the sun side of the cloister has fallen outward
  const sunSide = bayA.map((a, i) => ({ a, i })).filter(({ a }) => { return onSun(a); });
  group.updateMatrixWorld(true); group.traverse(o => { if (!(o as THREE.PointLight).isPointLight && !(o as THREE.Bone).isBone) o.matrixAutoUpdate = false; });
  let lastT = 0, smokeK = 1, dayK = -1;
  return {
    group, ruin, smoke: smokeU,
    /** 0-1: the smoke ceiling and the ash under it. */ smokeAmt(k: number) { smokeK = k; smokeU.uK.value = k; smoke.visible = k > 0.01; ash.visible = k > 0.05; for (const l of ceilingGlow) l.visible = k > 0.01; },
    /** 0-1: the smoke goes down into her mouth, at `at`. */ inhale(k: number, at?: THREE.Vector3) { smokeU.uIn.value = k; if (at) smokeU.uAt.value.copy(at); },
    /** 0-1: round 2's battlefield: the sun side of the cloister lies fallen outward. */
    daylight(k: number) {
      const on = k > 0.5; if ((dayK > 0.5) === on && dayK >= 0) return; dayK = k; if (sunRoof) sunRoof.visible = !on;
      for (const { a, i } of sunSide) { const m = M(Math.sin(a) * (CLOISTER_R + (on ? 2.2 : 0)), on ? -0.4 : 0, Math.cos(a) * (CLOISTER_R + (on ? 2.2 : 0)), a + Math.PI, 1, on ? -1.35 + 0.15 * Math.sin(i) : 0, on ? 0.1 * Math.cos(i * 3) : 0); arcade.setMatrixAt(i, m); arcShadow.setMatrixAt(i, m); } arcade.instanceMatrix.needsUpdate = arcShadow.instanceMatrix.needsUpdate = true;
    },
    flames(_k: number) { }, omen(_k: number) { }, storm(_k: number) { }, breach() { }, tear() { },
    update(t: number, _focus: THREE.Vector3) {
      const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t; void dt;
      // the bowls turn on their cords; they never touch
      bowlAt.forEach((b, i) => bowls.setMatrixAt(i, M(b.p.x, b.p.y, b.p.z, t * 0.12 + b.ph, b.sun && dayK > 0.5 ? 0 : 1, Math.sin(t * 0.4 + b.ph) * 0.03, Math.cos(t * 0.33 + b.ph) * 0.03))); bowls.instanceMatrix.needsUpdate = true;
      ceilingGlow.forEach((l, i) => { l.intensity = 34 * smokeK * (0.8 + 0.2 * Math.sin(t * 0.7 + i * 2) * Math.sin(t * 0.31 + i)); });
    },
  };
}
export type House = Awaited<ReturnType<typeof buildHouse>>;
