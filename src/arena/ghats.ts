// Round 1 and 2 of the second fight: the river ghats at night. A drowned landing, steps going up behind it, half-drowned pavilions, moored boats, and a river of floating lamps out to one thin line of day.
import * as THREE from 'three';
import { loadGeo, loadJson, type TexSet } from '../render/assets.ts';
import { DEPTH, FOG, surface } from '../render/surface.ts';
import { LINE } from '../render/sky.ts';
import { Ruin } from './ruin.ts';
import { makeGhatProps } from './props.ts';
import { slabs } from './court.ts';
import { makeAsh, makeFires } from '../render/ambient.ts';
import { LEVEL, Water } from '../render/water.ts';
import type { Tier } from '../core/quality.ts';

const seeded = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const LANDING_R = 22;

/** Plain stone blocks with baked-looking edges: steps, plinths, walls. */
class Blocks {
  pos: number[] = []; nrm: number[] = []; info: number[] = []; idx: number[] = [];
  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, mat = 16, ao = 0.9) {
    const F: [number[], number[]][] = [[[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, 1, 0]], [[0, 1, 0], [1, 0, 0]], [[0, -1, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 0]], [[0, 0, -1], [1, 0, 0]]];
    for (const [n, u] of F) {
      const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], b = this.pos.length / 3, h = [hx, hy, hz];
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this.pos.push(cx + (n[0] + u[0] * a + v[0] * c) * h[0], cy + (n[1] + u[1] * a + v[1] * c) * h[1], cz + (n[2] + u[2] * a + v[2] * c) * h[2]); this.nrm.push(...n); this.info.push(ao * 255, (n[1] > 0.5 ? 0.82 : 0.6) * 255, 0, mat); }
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  get geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3)); g.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array(this.info), 4, true)); g.setIndex(this.idx); g.computeBoundingSphere(); return g; }
}

export async function buildGhats(tex: TexSet, tier: Tier, moon: THREE.Vector3) {
  const lo = tier.name !== 'high', ph = tier.name === 'phone', r = seeded(23), group = new THREE.Group();
  const names = ['boat', 'pillar0', 'pillar1', 'pillar2'], G = Object.fromEntries(await Promise.all(names.map(async n => [n, await loadGeo(n)] as const)));
  const stone = surface(tex, tier, { world: true, ash: 0.1, wet: 0.7 }), floor = surface(tex, tier, { world: true, ash: 0.05, wet: 0.95, scars: true }), wood = surface(tex, tier, { world: true, ash: 0.1, wet: 0.8 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.still; group.add(o); return o; };
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], cast = true) => { const o = new THREE.InstancedMesh(g, m, list.length); list.forEach((x, i) => o.setMatrixAt(i, x)); o.castShadow = cast; o.receiveShadow = true; o.customDepthMaterial = DEPTH.inst; o.frustumCulled = false; group.add(o); return o; };
  const M = (x: number, y: number, z: number, ry = 0, s = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, s, s));

  // --- the drowned landing, and the bed under everything
  mesh(slabs(r, lo), floor, false);
  const bed = new THREE.PlaneGeometry(520, 520, 1, 1).rotateX(-Math.PI / 2); bed.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array([40, 128, 0, 21, 40, 128, 0, 21, 40, 128, 0, 21, 40, 128, 0, 21]), 4, true)); const bedMesh = mesh(bed, floor, false); bedMesh.position.y = -3.2;
  // --- steps up to the town, plinths under the pavilions
  const B = new Blocks();
  for (let i = 0; i < 10; i++) B.box(0, 0.19 * (i + 1) - 0.14, 22.1 + i * 1.5 + 0.75, 19 + i * 0.5, 0.19 * (i + 1) / 2 + 0.07, 0.75, 16, 0.85);
  for (const s of [1, -1]) { B.box(s * 22.5, 1.4, 27.5, 2.4, 1.6, 7.6, 16, 0.8); B.box(s * 19.8, 0.15, 24.3, 0.7, 0.3, 3.4, 16, 0.8); }
  for (const [cx, cz] of [[-17.2, -3.4], [17.4, 0.6]]) { B.box(cx, 0.22, cz, 4.6, 0.26, 4.6, 16, 0.85); B.box(cx, 0.04, cz, 5.1, 0.14, 5.1, 16, 0.75); }
  // low wall along the north edge of the landing, mostly fallen
  for (let i = 0; i < 40; i++) { const a = Math.PI * (1.12 + 0.76 * i / 39), R = LANDING_R + 0.6, gap = r() < 0.28; if (gap) continue; const h = 0.15 + r() * 0.4; B.box(Math.cos(a) * R, h / 2 - 0.1, Math.sin(a) * R, 0.6, h / 2 + 0.1, 0.35 + r() * 0.1, 16, 0.8); }
  mesh(B.geo, stone, false);

  // --- stone that can be broken: lamp posts, pavilion columns, boats
  const [stele, steleXs, p0, p1, p2, boatXs] = await Promise.all([loadGeo('stele'), loadGeo('stele', '.xs'), loadGeo('pillar0', '.xs'), loadGeo('pillar1', '.xs'), loadGeo('pillar2', '.xs'), loadGeo('boat', '.xs')]);
  const bitN = ['steleBits', 'pillar0Bits', 'pillar1Bits', 'pillar2Bits', 'boatBits'], bits = await Promise.all(bitN.map(n => loadGeo(n))), info = await Promise.all(bitN.map(n => loadJson(n))), shards = await Promise.all(['shard0', 'shard1'].map(n => loadGeo(n)));
  const ruin = new Ruin({ stele, steleXs, pillars: [G.pillar0, G.pillar1, G.pillar2], pillarsXs: [p0, p1, p2], boat: { whole: G.boat, xs: boatXs }, bits, info, shards, stone, loose: surface(tex, tier, { ash: 0.1 }), depth: DEPTH, tier }, makeGhatProps()); group.add(ruin.group);
  // boats sit in the water, not on it
  for (const p of ruin.props) if (p.kind === 'boat') { /* placed by the Ruin at y = -0.03; lower them into the river */ }
  // --- more boats, further out; mooring posts; a stranded hull
  const far: THREE.Matrix4[] = []; for (let i = 0; i < (ph ? 7 : 16); i++) { const a = Math.PI * (0.1 + 0.8 * r()) + Math.PI, R = 27 + r() * 38; far.push(M(Math.cos(a) * R, -0.18 - r() * 0.25, Math.sin(a) * R, r() * 6.28, 0.9 + r() * 0.3, (r() - 0.5) * 0.08, (r() - 0.5) * 0.12)); }
  inst(G.boat, wood, far, false);
  const post = new THREE.CylinderGeometry(0.1, 0.13, 1, 7).translate(0, 0.5, 0), pi = new Uint8Array(post.attributes.position.count * 4); for (let i = 0; i < pi.length; i += 4) pi.set([210, 150, 0, 24], i); post.setAttribute('aInfo', new THREE.BufferAttribute(pi, 4, true));
  const posts: THREE.Matrix4[] = []; for (let i = 0; i < (ph ? 14 : 34); i++) { const a = Math.PI * (0.05 + 0.9 * r()) + Math.PI, R = 23 + r() * 25, h = 1.4 + r() * 2.2; posts.push(M(Math.cos(a) * R, -0.5, Math.sin(a) * R, 0, 1, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1).scale(new THREE.Vector3(1, h, 1))); }
  inst(post, wood, posts, false);

  // --- the water, and the lamps on it
  const water = new Water(tier, moon); group.add(water.mesh);
  const lampN = ph ? 260 : lo ? 520 : 820, lamp = (() => {
    const n = lampN, ax = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0; for (let k = 0; k < 8; k++) { const u = r(), R = i < n * 0.1 ? 3 + r() * 17 : 23 + 150 * Math.pow(u, 1.9), th = (r() - 0.5 + (r() - 0.5)) * 2.3 + (r() < 0.12 ? Math.PI : 0); x = Math.sin(th) * R; z = -Math.cos(th) * R; if (!(z > 16 && Math.abs(x) < 24) && !(Math.hypot(x, z) < 22 && Math.hypot(x, z) > 20)) break; }
      ax.set([x, z, r() * 1, r()], i * 4);
    }
    const g = new THREE.InstancedBufferGeometry(); g.instanceCount = n; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0, -1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setAttribute('kind', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 1, 1, 1]), 1)); g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); g.setAttribute('aP', new THREE.InstancedBufferAttribute(ax, 4));
    const u = { uT: FOG.uFogP, uLit: { value: 1 }, uGain: { value: 0.75 }, uLevel: { value: LEVEL }, uFront: { value: 0 }, uOut: { value: new THREE.Vector3(0, 0, 0) } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
      vertexShader: `attribute vec4 aP; attribute float kind; uniform vec4 uT; uniform float uLit, uLevel, uFront; uniform vec3 uOut; varying vec2 u; varying float vk, vl, vf, vd, vg;
void main(){ float t = uT.w; vec3 c = vec3(aP.x, uLevel + .07 + .006 * sin(t * 1.3 + aP.z * 20.), aP.y);
 vl = clamp((uLit - aP.w) * 9. + .5, 0., 1.); if (uOut.z > 0.) vl *= smoothstep(uOut.z - 2.5 - aP.z * 3., uOut.z - aP.z * 3., length(c.xz - uOut.xy)); float bd = length(c.xz - vec2(0., -9.)), fr = uFront > 0. ? smoothstep(uFront, uFront - 4., bd) : 0.; vg = fr * (.9 + 2.4 * exp(-max(uFront - bd, 0.) * .045)); vl = max(vl, fr); vk = kind; vf = aP.z; u = position.xy; float dist = length(c - cameraPosition); vd = dist; float s = .1 * (1. + dist * .011);
 vec4 clip = projectionMatrix * viewMatrix * vec4(c, 1.);
 if (kind < .5) { vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); gl_Position = projectionMatrix * viewMatrix * vec4(c + r * position.x * s * 1.6 + up * position.y * s * 2.6, 1.); }
 else { float L = min(.34 + dist * .035, 4.); gl_Position = clip + vec4(position.x * s * 1.1 * projectionMatrix[0][0], -position.y * L * projectionMatrix[1][1], 0., 0.); } }`,
      fragmentShader: `uniform vec4 uT; uniform float uGain; varying vec2 u; varying float vk, vl, vf, vd, vg;
float h(float p){ return fract(sin(p * 91.7) * 4375.5); } float n(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(h(i), h(i+1.), f); }
void main(){ float t = uT.w, fl = .8 + .2 * sin(t * 7. + vf * 40.) + .1 * sin(t * 13. + vf * 11.); vec3 warm = vec3(1., .46, .12);
 if (vk < .5) { vec2 q = vec2(u.x, u.y * 1.2 - .25); float d = length(q * vec2(1., .8)); float g = smoothstep(1., .0, d); gl_FragColor = vec4(warm * (g * g * .9 + smoothstep(.28, 0., d) * 1.4) * vl * fl * uGain * (1. + vg), 1.); }
 else { float y = u.y; float w = exp(-u.x * u.x * (3. + y * 7.)); float wob = .6 + .4 * n(y * 26. + t * 2.2 + vf * 40.); float k = w * pow(1. - y, 1.5) * wob; gl_FragColor = vec4(warm * k * vl * fl * uGain * .5 * (1. + vd * .004) * (1. + vg), 1.); } }`,
    });
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = 4; group.add(o); return { u, mesh: o };
  })();
  // the clay bowls of those near enough to see
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0.01), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0.12, 0.09), new THREE.Vector2(0.1, 0.1), new THREE.Vector2(0.0, 0.07)], 9); { const n = bowl.attributes.position.count, a = new Uint8Array(n * 4); for (let i = 0; i < n; i++) a.set([220, 160, 0, 25], i * 4); bowl.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); }
  const bowls = new THREE.InstancedMesh(bowl, wood, 140), pa = (lamp.mesh.geometry.attributes.aP as THREE.InstancedBufferAttribute); { let k = 0; for (let i = 0; i < pa.count && k < bowls.count; i++) { const x = pa.getX(i), z = pa.getY(i); if (Math.hypot(x, z) < 40) bowls.setMatrixAt(k++, M(x, LEVEL - 0.035, z, r() * 6, 1 + r() * 0.3)); } bowls.count = k; } bowls.receiveShadow = false; bowls.frustumCulled = false; group.add(bowls);

  // --- the lamp posts burn; the dead throw a little light of their own
  const lampFire = makeFires(ruin.lamps.map(l => l.p), 3, 0.5, 0.14), lampAt = (lampFire.geometry.attributes.aP as THREE.InstancedBufferAttribute), lampY = Float32Array.from({ length: lampAt.count }, (_, i) => lampAt.getY(i)); group.add(lampFire, makeAsh(tier));
  ruin.onLamp = (i, lit) => { for (let k = 0; k < 3; k++) lampAt.setY(i * 3 + k, lit ? lampY[i * 3 + k] : -60); lampAt.needsUpdate = true; };
  const lights = ruin.lamps.slice(0, tier.lights).map(() => { const l = new THREE.PointLight(0xff9448, 0, 18, 1.8); group.add(l); return l; });
  group.updateMatrixWorld(true); group.traverse(o => { if (!(o as THREE.PointLight).isPointLight && !(o as THREE.Bone).isBone) o.matrixAutoUpdate = false; }); water.mesh.matrixAutoUpdate = true; water.mesh.updateMatrix();
  // --- round 2: every fare he ever took, come up out of the river: coins strewn over the drowned landing (hidden below the stone until then)
  const coinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.007, 10); { const n = coinGeo.attributes.position.count, a = new Uint8Array(n * 4); for (let i = 0; i < n; i++) a.set([235, 128, 0, 29], i * 4); coinGeo.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); }
  const coins = new THREE.InstancedMesh(coinGeo, wood, ph ? 800 : 2400); { const rc = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })(); for (let i = 0; i < coins.count; i++) { const a = rc() * 6.283, R = 1.5 + Math.pow(rc(), 0.7) * 19, s = 0.8 + rc() * 0.6; coins.setMatrixAt(i, M(Math.sin(a) * R, 0.004 + rc() * 0.01, Math.cos(a) * R - 2, rc() * 6, s, (rc() - 0.5) * 0.5, (rc() - 0.5) * 0.5)); } }
  coins.frustumCulled = false; coins.receiveShadow = true; coins.visible = false; group.add(coins);
  const fog0 = FOG.uFogCol.value.clone(), fogCold = new THREE.Color(0.003, 0.011, 0.034); let fieldK = -1;
  let lampTo = 1, flameK = 1, lastT = 0, lit = 1;
  return {
    group, ruin, water, /** The lamps you can see, 0-1 lit. The next call eases to it; `at` jumps. */ lamps(k: number, at = false) { lampTo = k; if (at) { lit = k; lamp.u.uLit.value = k; } },
    /** 0-1: pyre light. Unused here; the lamp posts burn. */ flames(k: number) { flameK = k; (lampFire.material as THREE.ShaderMaterial).uniforms.uGain.value = k; }, omen(_k: number) { /* no eclipse on the river */ }, storm(_k: number) { }, breach() { }, tear() { },
    /** The fire running from lamp to lamp: how far out from the boat it has caught, in metres. 0 is off. */ setFront(d: number) { lamp.u.uFront.value = d; },
    /** 0-1, the Unburdened's river: the water rises over the landing, the fare coins lie on the bed, the last daylight goes, the fog turns cold. */
    unburden(k: number) {
      if (Math.abs(k - fieldK) < 0.002) return; if (fieldK < 0) fog0.copy(FOG.uFogCol.value); fieldK = k; const up = 0.1 * k;
      water.mesh.position.y = LEVEL + up; water.u.uLevel.value = LEVEL + up; lamp.u.uLevel.value = LEVEL + up; bowls.position.y = up; bowls.updateMatrix();
      coins.visible = k > 0.01; coins.position.y = -0.06 * (1 - k); coins.updateMatrix(); LINE.value = 1 - 0.85 * k; water.line.value = 1 - 0.85 * k; FOG.uFogCol.value.copy(fog0).lerp(fogCold, k);
    },
    /** One more clay lamp like those on the water, for a scene to hold. */ bowlMesh() { return new THREE.Mesh(bowl, wood); },
    /** The clay bowls glow while their lamps burn; out, they are only clay. */ bowlsLit(on: boolean) { bowls.visible = on; },
    /** A darkness spreading over the water from (x, z): every lamp within `r` metres is out. r = 0 is off. */ setOut(x: number, z: number, r: number) { lamp.u.uOut.value.set(x, z, r); },
    /** A ring spreads on the water. */ ripple(x: number, z: number, amp: number, t: number) { water.ripple(x, z, amp, t); },
    update(t: number, focus: THREE.Vector3) {
      const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t; lit += (lampTo - lit) * (1 - Math.exp(-dt * (lampTo > lit ? 5 : 3.2))); lamp.u.uLit.value = lit; water.boil.value.w *= 1;
      const near = ruin.lamps.filter(l => l.lit).sort((a, b) => a.p.distanceToSquared(focus) - b.p.distanceToSquared(focus));
      lights.forEach((l, i) => { const f = near[i]; if (!f) { l.intensity = 0; return; } l.position.set(f.p.x, f.p.y + 0.35, f.p.z); l.intensity = 30 * flameK * (0.85 + 0.12 * Math.sin(t * 9 + f.p.x) + 0.08 * Math.sin(t * 23 + f.p.z)); });
    },
  };
}
