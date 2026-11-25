// What the river's mechanics look like: the chain and anchor, lanterns, coins, the tide, the ring of arms, the dead, and the wake.
import * as THREE from 'three';
import type { River } from './river.ts';
import { LEVEL } from '../../render/water.ts';
import { FOG } from '../../render/surface.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), E = new THREE.Euler();
const sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const glowTex = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(0.2, 'rgba(255,150,60,.55)'); r.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; };

export interface FxGeo { anchor: THREE.BufferGeometry; lantern: THREE.BufferGeometry; arm: THREE.BufferGeometry }
export class RiverFx {
  group = new THREE.Group(); anchor: THREE.Mesh; private links: THREE.InstancedMesh; private coins: THREE.InstancedMesh; private wave: THREE.Mesh; private waveU: Record<string, THREE.IUniform>; private arms: THREE.InstancedMesh; private souls: THREE.InstancedMesh; private lanterns: THREE.Mesh[] = []; private glows: THREE.Sprite[] = []; private wake: THREE.Mesh; private wakeG: THREE.BufferGeometry;
  /** Held where the anchor is wanted this frame. */ anchorAt = V(); hand = V(); private anchorQ = new THREE.Quaternion(); /** World position of the real lantern, for the light. */ lanternLit = false; /** The dead, standing in the shallows at the end. */ crowd = false; private crowdT = 0; private people: [number, number][] = (() => { let s = 5; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }, o: [number, number][] = []; while (o.length < 30) { const a = r() * 6.283, d = 4 + r() * 12, x = Math.sin(a) * d, z = -6 + Math.cos(a) * d; if (Math.abs(x) < 2.2 && z > -9.5) continue; if (Math.hypot(x, z) > 19) continue; o.push([x, z]); } return o; })();
  constructor(g: FxGeo, held: THREE.Material, skin: THREE.Material) {
    this.anchor = new THREE.Mesh(g.anchor, held); this.anchor.scale.setScalar(0.95); this.anchor.castShadow = true; this.anchor.visible = false; this.anchor.frustumCulled = false;
    const link = new THREE.TorusGeometry(0.1, 0.03, 5, 9), li = new Uint8Array(link.attributes.position.count * 4); for (let i = 0; i < li.length; i += 4) li.set([220, 140, 0, 12], i); link.setAttribute('aInfo', new THREE.BufferAttribute(li, 4, true));
    this.links = new THREE.InstancedMesh(link, held, 72); this.links.frustumCulled = false; this.links.count = 0; this.links.castShadow = true;
    const coin = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10).rotateX(Math.PI / 2); this.coins = new THREE.InstancedMesh(coin, new THREE.MeshStandardMaterial({ color: 0x0d0a08, metalness: 1, roughness: 0.32, emissive: 0x3a1d08, emissiveIntensity: 0.9 }), 130); this.coins.frustumCulled = false; this.coins.count = 0;
    this.waveU = { uT: FOG.uFogP, uHalf: { value: 16 }, uGaps: { value: Array.from({ length: 6 }, () => new THREE.Vector2(0, 0)) } };
    this.wave = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 90, 12).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: this.waveU,
      vertexShader: `varying vec2 uv2; varying float hh; uniform float uHalf; uniform vec4 uT; uniform vec2 uGaps[6];
float h(float p){ return fract(sin(p * 91.7) * 4375.5); } float n(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(h(i), h(i+1.), f); }
void main(){ float lat = position.x * 2. * uHalf, f = position.z * 3.; float gap = 1.; for (int i = 0; i < 6; i++) { if (uGaps[i].y > 0.) gap = min(gap, smoothstep(uGaps[i].y * .5 - .4, uGaps[i].y * .5 + .5, abs(lat - uGaps[i].x))); }
 float amp = (1.25 + .45 * n(lat * .45 + uT.w * .8) + .2 * n(lat * 1.9 - uT.w * 1.6)) * gap; float prof = smoothstep(-1.5, -.05, f) * (1. - smoothstep(.05, 1.5, f)) * (1. + .35 * smoothstep(-.2, .35, f) * (1. - smoothstep(.35, 1., f)));
 vec3 p = vec3(position.x * 2. * uHalf, prof * amp, f + .3 * prof * amp); uv2 = vec2(lat, f); hh = prof * amp; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.); }`,
      fragmentShader: `varying vec2 uv2; varying float hh; uniform vec4 uT;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
void main(){ if (hh < .02) discard; float foam = smoothstep(.55, 1.05, hh) * (.5 + .7 * n(uv2 * vec2(1.3, 3.) + uT.w * vec2(.4, -1.5))) + smoothstep(.1, 0., abs(uv2.y - .12)) * .35; vec3 deep = vec3(.012, .03, .035), c = mix(deep + vec3(.02, .045, .055) * hh, vec3(.7, .78, .8), clamp(foam, 0., 1.)); gl_FragColor = vec4(c, clamp(.4 + hh * .6, 0., .94)); }` }));
    this.wave.frustumCulled = false; this.wave.visible = false; this.wave.renderOrder = 3;
    this.arms = new THREE.InstancedMesh(g.arm, skin, 40); this.arms.frustumCulled = false; this.arms.count = 0; this.arms.castShadow = false;
    const body = new THREE.LatheGeometry([0, 0.05, 0.26, 0.32, 0.22, 0.17, 0.12, 0.0].map((r, i) => new THREE.Vector2(r, [0, 0.3, 0.9, 1.35, 1.52, 1.62, 1.72, 1.82][i])), 8), n = body.attributes.position.count, ai = new Uint8Array(n * 4); for (let i = 0; i < n; i++) ai.set([230, 150, 0, 9], i * 4); body.setAttribute('aInfo', new THREE.BufferAttribute(ai, 4, true));
    this.souls = new THREE.InstancedMesh(body, skin, 44); this.souls.frustumCulled = false; this.souls.count = 0;
    const tex = glowTex(); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(g.lantern, held); m.visible = false; m.scale.setScalar(1.1); m.frustumCulled = false; this.lanterns.push(m); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.scale.setScalar(2.2); s.visible = false; this.glows.push(s); this.group.add(m, s); }
    this.wakeG = new THREE.BufferGeometry(); const N = 26; this.wakeG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3)); this.wakeG.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(N * 4 * 2), 2)); const ix: number[] = []; for (let i = 0; i < N - 1; i++) for (const s of [0, 2]) { const a = i * 4 + s, b = a + 1, c = a + 4, d = a + 5; ix.push(a, b, c, b, d, c); } this.wakeG.setIndex(ix);
    this.wake = new THREE.Mesh(this.wakeG, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } }, vertexShader: `varying vec2 u; void main(){ u = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: `varying vec2 u; uniform float uK; void main(){ float e = smoothstep(0., .35, u.x) * smoothstep(1., .55, u.x); gl_FragColor = vec4(vec3(.55, .65, .7) * e * (1. - u.y) * uK * .75, 1.); }` })); this.wake.frustumCulled = false; this.wake.renderOrder = 3; this.wake.visible = false;
    this.group.add(this.anchor, this.links, this.coins, this.wave, this.arms, this.souls, this.wake);
  }
  private put(m: THREE.InstancedMesh, i: number, p: THREE.Vector3, yaw: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) { M4.compose(p, Q.setFromEuler(E.set(rx, yaw, rz, 'YXZ')), S.set(sx, sy, sz)); m.setMatrixAt(i, M4); m.instanceMatrix.needsUpdate = true; }
  /** `hand`: the anchor hand in the world. `heldAnchor`: it is in the hand, not out on its chain. */
  update(s: River, dt: number, t: number, hand: THREE.Vector3, holding: boolean, water: { ripple(x: number, z: number, a: number, t: number): void } | null, player: { x: number; z: number }) {
    // --- the chain
    let end: THREE.Vector3 | null = null, slack = 0, aim = 0; const m = s.mode, ch = s.chain;
    if (s.form === 1) {
      const a = V(); if (m === 'cast' && s.mt < 1.06) { a.copy(hand).add(V(0, -0.5, 0)); end = a; slack = 0.9; }
      else if (m === 'cast' && s.mt < 1.4 && ch) { const u = sst(1.06, 1.38, s.mt); a.copy(hand).lerp(V(ch.x, 0.1, ch.z), u); a.y += Math.sin(u * Math.PI) * 0.8; end = a; slack = 0.1 * (1 - u); }
      else if (ch) { a.set(ch.x, 0.12, ch.z); end = a; slack = 0.0; aim = 1; }
      else if (m === 'haul') { const u = sst(0, 0.5, s.mt); a.copy(hand).lerp(V(player.x, 1.2, player.z), 1 - u * 0.0); end = a; slack = 0; if (s.mt > 1.4) end = null; }
      else if (m === 'wheelIron') { const k = s.mt * 7.0; a.set(s.x + Math.sin(k) * 3.4, 1.9 + Math.sin(k * 0.5) * 0.3, s.z + Math.cos(k) * 3.4); if (s.mt > 0.55 && s.mt < 3.9) { end = a; slack = 0.2; } else if (holding) { end = a.copy(hand).add(V(0, -0.5, 0)); slack = 0.9; } }
      else if (m === 'dragDeep' || m === 'haulIn') { if (m === 'haulIn' && s.mt > 0.6 && s.mt < 1.8) { const L = ch ? ch : { x: s.x + Math.sin(s.yaw) * 10, z: s.z + Math.cos(s.yaw) * 10 }, u = sst(1.45, 1.75, s.mt); a.set(L.x, 0.12, L.z).lerp(hand, u); end = a; } else if (holding) { end = a.copy(hand).add(V(0, -0.5, 0)); slack = 0.9; } }
      else if (holding) { end = a.copy(hand).add(V(0, -0.5, 0)); slack = 0.9; }
    }
    this.anchor.visible = !!end; if (end) { this.anchorAt.copy(end); this.anchor.position.copy(end); const d = end.clone().sub(hand); this.anchorQ.setFromUnitVectors(V(0, -1, 0), d.lengthSq() > 0.01 ? d.normalize() : V(0, -1, 0)); this.anchor.quaternion.copy(this.anchorQ); this.anchor.position.addScaledVector(V(0, 1, 0), 0); }
    const n = end ? Math.min(72, Math.max(3, Math.round(end.distanceTo(hand) / 0.17))) : 0; this.links.count = n;
    if (end) for (let i = 0; i < n; i++) { const u = i / Math.max(1, n - 1), p = hand.clone().lerp(end, u); p.y -= Math.sin(u * Math.PI) * slack * (1 + aim * 0) + 0.0; const d = end.clone().sub(hand).normalize(); this.put(this.links, i, p, Math.atan2(d.x, d.z) + (i & 1 ? Math.PI / 2 : 0), 1, 1, 1, (i & 1) ? Math.PI / 2 : 0, 0); }
    // --- the lanterns: three, one real
    this.lanternLit = false; for (let i = 0; i < 4; i++) { this.lanterns[i].visible = this.glows[i].visible = false; }
    s.lanterns.forEach((l, i) => { const o = this.lanterns[i + 1 > 3 ? 3 : i], g = this.glows[i + 1 > 3 ? 3 : i], k = l.gone > 0 ? Math.max(0, 1 - l.gone * 2.4) : sst(0, 0.7, l.t); o.visible = g.visible = k > 0.01; o.position.set(l.x, LEVEL + 1.15 + Math.sin(t * 1.4 + i * 2) * 0.07, l.z); g.position.copy(o.position); g.position.y += 0.05; o.scale.setScalar(1.1 * k); g.scale.setScalar((l.real ? 2.6 : 2.2) * k * (0.9 + 0.1 * Math.sin(t * 9 + i))); if (l.real && water && Math.floor(t * 2.2) !== Math.floor((t - dt) * 2.2)) water.ripple(l.x, l.z, 0.9, t); this.lanternLit = this.lanternLit || k > 0.1; });
    // --- coins
    let c = 0; for (const q of s.coins) { if (c >= 130) break; this.put(this.coins, c++, V(q.x, 1.0 + Math.sin(t * 6 + q.x * 3) * 0.08, q.z), Math.atan2(q.vx, q.vz) + t * (q.back ? 12 : 5), 1, 1, 1, t * 6 + q.z, 0); } this.coins.count = c;
    // --- the tide
    const w = s.wave; this.wave.visible = !!w; if (w) {
      const sx = Math.sin(w.yaw), sz = Math.cos(w.yaw); this.wave.position.set(w.x + sx * w.d, LEVEL, w.z + sz * w.d); this.wave.rotation.set(0, w.yaw, 0); this.wave.scale.set(1, 1, 1); this.waveU.uHalf.value = w.half;
      const G = this.waveU.uGaps.value as THREE.Vector2[]; for (let i = 0; i < 6; i++) { const g = w.gaps[i]; G[i].set(g ? g.s : 0, g ? g.w : 0); }
      if (water && Math.floor(t * 9) !== Math.floor((t - dt) * 9)) water.ripple(w.x + sx * w.d + sz * (Math.random() - 0.5) * 20, w.z + sz * w.d - sx * (Math.random() - 0.5) * 20, 0.6, t);
    }
    // --- arms: the closing ring, and the patches of cold hands
    let a = 0; const r = s.ring; if (r) for (let i = 0; i < r.arms.length && a < 40; i++) { if (!r.arms[i]) continue; const ang = i / r.arms.length * 6.283, rise = sst(0, 0.55, r.t), y = LEVEL - 1.7 + 1.7 * rise; this.put(this.arms, a++, V(r.x + Math.sin(ang) * r.R, y, r.z + Math.cos(ang) * r.R), ang + Math.PI, 0.9, 0.9, 0.9, -0.5 * (1 - r.R / 7.5) - 0.12, (Math.sin(i * 3.1) * 0.12)); }
    for (const h of s.hands) { if (a >= 40) break; if (h.max === -1 || h.t > h.delay + 0.3) continue; const rise = sst(0, h.delay, h.t) * (h.t < h.delay ? 1 : 1 - sst(h.delay, h.delay + 0.3, h.t)); for (let k = 0; k < 2 && a < 40; k++) this.put(this.arms, a++, V(h.x + Math.sin(k * 3.1 + h.id) * 0.4, LEVEL - 1.7 + 1.65 * rise, h.z + Math.cos(k * 3.1 + h.id) * 0.4), h.id * 2.3 + k, 1, 1, 1, Math.sin(t * 2 + k) * 0.1, 0); } this.arms.count = a;
    // --- the dead
    let d = 0; for (const q of s.souls) { if (d >= 10) break; const lo = q.freed > 0 ? sst(0, 1.2, q.freed) : 0; this.put(this.souls, d++, V(q.x, LEVEL - 0.2 + lo * 2.4, q.z), Math.atan2(player.x - q.x, player.z - q.z), 1 - lo * 0.5, 1 + lo * 0.3, 1 - lo * 0.5, 0.1 * Math.sin(t * 1.4 + q.x), 0); } if (this.crowd) { this.crowdT += dt; const u = sst(0, 3, this.crowdT); this.people.forEach(([x, z], i) => { if (d >= 44) return; this.put(this.souls, d++, V(x, LEVEL - 1.9 + 1.7 * Math.min(1, u * 1.2 - i * 0.012), z), Math.atan2(-x, -6 - z) + Math.PI, 1, 1, 1, 0.05 * Math.sin(t * 0.8 + i), 0); }); } else this.crowdT = 0; this.souls.count = d;
    // --- the wake of the submerged head
    const show = s.form === 2 && (s.sub || (s.mode === 'wake' && s.mt > 0.3)); this.wake.visible = show; if (show) {
      const P = this.wakeG.attributes.position as THREE.BufferAttribute, U = this.wakeG.attributes.uv as THREE.BufferAttribute, N = 26; let arc = 0; const tr = s.trail;
      for (let i = 0; i < N; i++) { const q = tr[Math.min(tr.length - 1, i * 3)] ?? { x: s.x, z: s.z }, p = tr[Math.min(tr.length - 1, i * 3 + 2)] ?? q, dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, spread = 0.5 + i * 0.28, u = i / (N - 1); arc += 1;
        for (const [side, k] of [[-1, 0], [1, 2]] as const) { const x0 = q.x + nx * side * spread, z0 = q.z + nz * side * spread, x1 = q.x + nx * side * (spread + 0.9 + i * 0.12), z1 = q.z + nz * side * (spread + 0.9 + i * 0.12); P.setXYZ(i * 4 + k, x0, LEVEL + 0.04, z0); P.setXYZ(i * 4 + k + 1, x1, LEVEL + 0.04, z1); U.setXY(i * 4 + k, 0.0 + 0.0, u); U.setXY(i * 4 + k + 1, 1.0, u); } }
      P.needsUpdate = U.needsUpdate = true; (this.wake.material as THREE.ShaderMaterial).uniforms.uK.value = Math.min(1, s.mt * 1.2); void arc;
    }
  }
}
