// What the Sister throws and leaves: linen strips on the floor, the room-sized sheet, the whorl she comes out of, the hook standing as Noon's stake,
// the cots the Pall looses, the gale of Last Breath, and the hour hand's embers. Driven from the simulation each frame; no rules here.
import * as THREE from 'three';
import type { Fight } from '../../combat/fight.ts';
import type { Fx } from '../../render/impact.ts';
import { FOG } from '../../render/surface.ts';
import type { Sister } from './sister.ts';
import { glow } from './sisterView.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const linen = (g: THREE.BufferGeometry, mat = 32) => { const n = g.attributes.position.count, a = new Uint8Array(n * 4); for (let i = 0; i < n; i++) a.set([220, 140, 0, mat], i * 4); g.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); return g; };

export class HoursFx {
  group = new THREE.Group(); private fx: Fx; private strips: THREE.Mesh[] = []; private sheet: THREE.Mesh; private sheetBase: Float32Array; private sheetK = 0; private sheetAt = V(); private sheetFrom = V();
  private stake: THREE.Mesh; private whorl: THREE.Sprite; private whorlT = -1; private whorlAt = V(); private cots: THREE.InstancedMesh; private cotT = -1; private cotFrom = V(); private cotYaw = 0; private hand: THREE.Mesh; private handU = { uT: FOG.uFogP, uK: { value: 0 }, uHot: { value: 0 } }; private gale: THREE.Mesh; private galeU = { uT: FOG.uFogP, uK: { value: 0 } }; private sprayT = 0;
  constructor(scene: THREE.Scene, mat: THREE.Material, hook: THREE.BufferGeometry, cot: THREE.BufferGeometry, fx: Fx, depth: THREE.Material) {
    this.fx = fx; scene.add(this.group);
    for (let i = 0; i < 3; i++) { const g = linen(new THREE.PlaneGeometry(0.34, 1, 1, 12).rotateX(-Math.PI / 2).translate(0, 0.02, 0.5)), m = new THREE.Mesh(g, mat); m.visible = false; m.receiveShadow = true; this.group.add(m); this.strips.push(m); }
    const sg = linen(new THREE.PlaneGeometry(1, 1, 24, 24).rotateX(-Math.PI / 2)); { const q = sg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < q.count; i++) { const x = q.getX(i) * 2, z = q.getZ(i) * 2; q.setX(i, x * Math.sqrt(1 - z * z / 2) / 2); q.setZ(i, z * Math.sqrt(1 - x * x / 2) / 2); } } this.sheetBase = Float32Array.from(sg.attributes.position.array as Float32Array); this.sheet = new THREE.Mesh(sg, mat); this.sheet.visible = false; this.sheet.castShadow = true; this.sheet.customDepthMaterial = depth; this.group.add(this.sheet);
    this.stake = new THREE.Mesh(hook, mat); this.stake.visible = false; this.stake.castShadow = true; this.stake.customDepthMaterial = depth; this.group.add(this.stake);
    this.whorl = glow(new THREE.Color(1.6, 1.6, 1.5), 0.5); this.whorl.visible = false; this.group.add(this.whorl);
    this.cots = new THREE.InstancedMesh(cot, mat, 5); this.cots.visible = false; this.cots.castShadow = true; this.cots.frustumCulled = false; this.group.add(this.cots);
    const gg = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
    this.gale = new THREE.Mesh(gg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.galeU, vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec4 uT; uniform float uK; varying vec3 vP; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
void main(){ float z = vP.z, a = atan(vP.y, vP.x); float s = n(vec2(a * 3., z * 2.5 - uT.w * 9.)) * .6 + n(vec2(a * 7., z * 6. - uT.w * 14.)) * .4; float b = smoothstep(.45, .85, s) * smoothstep(0., .15, z) * smoothstep(1., .55, z); gl_FragColor = vec4(mix(vec3(.35, .12, .05), vec3(1., .42, .1), s) * b * uK * 1.6, 1.); }` }));
    this.gale.visible = false; this.gale.renderOrder = 8; this.group.add(this.gale);
    // the hook's shadow: a long dark band on the stone, embers kindling along its middle
    const hg = new THREE.PlaneGeometry(1, 1, 1, 24).rotateX(-Math.PI / 2).translate(0, 0.03, -0.5);
    this.hand = new THREE.Mesh(hg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.handU, vertexShader: `varying vec2 v; void main(){ v = vec2(position.x, -position.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec4 uT; uniform float uK, uHot; varying vec2 v; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
void main(){ float x = abs(v.x) * 2., edge = smoothstep(1., .55, x) * smoothstep(1., .85, v.y) * smoothstep(0., .06, v.y), core = smoothstep(.22, 0., x) * (.5 + .5 * n(vec2(v.y * 40. - uT.w * 3., 1.))); gl_FragColor = vec4(mix(vec3(.01, .004, .003), vec3(1.4, .35, .06) * (1. + uHot), core * uHot * .8), edge * uK * (.82 + .18 * core)); }` }));
    this.hand.visible = false; this.hand.renderOrder = 4; this.group.add(this.hand);
  }
  reset() { for (const s of this.strips) s.visible = false; this.sheet.visible = false; this.sheetK = 0; this.stake.visible = false; this.whorl.visible = false; this.whorlT = -1; this.cots.visible = false; this.cotT = -1; this.gale.visible = false; }
  /** She went into the smoke: a whorl gathers here. */ whorlAt_(x: number, z: number) { this.whorlAt.set(x, 0, z); this.whorlT = 0; }
  burnStrips(t: number) { for (const s of this.strips) if (s.visible) { const d = V(Math.sin(s.rotation.y), 0, Math.cos(s.rotation.y)); for (let i = 0; i < 8; i++) { const p = s.position.clone().addScaledVector(d, (8 - i) * s.scale.z / 8); this.fx.bursts.add('fire', V(p.x, 0.4, p.z), 1.4, 0.5, t + i * 0.03, i); this.fx.sparks.emit(V(p.x, 0.2, p.z), V(0, 1, 0), 6, 2, 1.6, -1, t + i * 0.03); } s.visible = false; } }
  tearSheet(t: number) { if (!this.sheet.visible) return; const p = this.sheet.position; for (let i = 0; i < 10; i++) this.fx.bursts.add('slash', V(p.x + (Math.random() - 0.5) * 4, p.y, p.z + (Math.random() - 0.5) * 4), 3, 0.3, t + i * 0.02, Math.random() * 3, 1.6, 1.4, 1.2); this.fx.puffs.emit(p, 12, 3, 1.4, t); this.sheet.visible = false; this.sheetK = -1; }
  step(f: Fight, k: Sister, hand: THREE.Vector3, head: THREE.Vector3, dt: number, t: number) {
    const m = k.mode, mt = k.mt;
    // --- the linen strips, flung out along the floor
    this.strips.forEach((s, i) => { const q = k.strips[i]; s.visible = !!q; if (!q) return; const u = E(0, 0.18, q.t); s.position.set(q.x, 0, q.z); s.rotation.set(0, q.yaw, 0); s.scale.set(1, 1, q.len * u); });
    // --- the clean sheet: up out of her hands, high over you, billowing, then down on the glowing circle
    const h = f.hazards.find(z => z.mode === 'cleanSheet' && z.shape === 'circle');
    if (m === 'cleanSheet' && h && this.sheetK >= 0) {
      if (!this.sheet.visible) { this.sheetFrom.copy(hand); this.sheet.visible = true; } this.sheetAt.set(h.x, 0, h.z); const u = Math.min(1, h.t / h.delay), lift = Math.sin(Math.min(1, u * 1.25) * Math.PI) * 4.2, drop = E(0.75, 1.0, u);
      this.sheet.position.lerpVectors(this.sheetFrom, this.sheetAt, E(0, 0.7, u)); this.sheet.position.y = (1 - drop) * (Math.max(0.1, this.sheetFrom.y * (1 - u)) + lift * 0.8 + 1.0) + 0.06; const S = h.r * 2.3 * (0.25 + 0.75 * E(0.3, 0.9, u)); this.sheet.scale.set(S, 1, S); this.sheet.rotation.y = k.yaw + u * 0.6;
      const p = this.sheet.geometry.attributes.position as THREE.BufferAttribute, B = this.sheetBase, fl = 1 - drop * 0.85; for (let i = 0; i < p.count; i++) { const x = B[i * 3], z = B[i * 3 + 2], r = Math.hypot(x, z); p.setY(i, (Math.sin(x * 7 + t * 5) * 0.08 + Math.sin(z * 6 - t * 4.2) * 0.07 - r * r * 0.5 * (1 - drop) + Math.sin(r * 9 - t * 7) * 0.04) * fl / Math.max(0.3, S * 0.25)); } p.needsUpdate = true; this.sheet.geometry.computeVertexNormals();
    } else if (m !== 'cleanSheet') { this.sheetK = 0; if (this.sheet.visible) { this.sheet.visible = false; this.fx.puffs.emit(this.sheet.position.clone().setY(0.2), 8, 2.4, 1.2, t); } }
    // --- the whorl: smoke turning on a cot near you, and a white glint in it
    if (this.whorlT >= 0) { this.whorlT += dt; const u = this.whorlT, w = this.whorlAt; this.whorl.visible = u < 1.25; this.whorl.position.set(w.x, 1.2 + u * 0.6, w.z); this.whorl.scale.setScalar(0.2 + 0.9 * E(0.6, 1.1, u)); if ((this.sprayT -= dt) < 0 && u < 1.2) { this.sprayT = 0.04; for (let i = 0; i < 2; i++) { const a = t * 6 + i * 3.1, r = 1.4 - u * 0.8; this.fx.puffs.emit(V(w.x + Math.cos(a) * r, 0.3 + u * 1.2, w.z + Math.sin(a) * r), 1, 1.6, 1.1, t); } } if (u > 1.6) this.whorlT = -1; }
    // --- Noon's stake: the hook where it fell, leaning, until it is broken or eight seconds pass
    const st = k.stake; this.stake.visible = !!st || (m === 'noon' && mt > 0.75 && mt < 1.5); if (st) { this.stake.position.set(st.x, 1.4, st.z); this.stake.rotation.set(0.18, k.yaw, 0.12 * (3 - st.hp)); } else if (this.stake.visible) { const hz = f.hazards.find(q => q.mode === 'noon' && q.shape === 'circle'); if (hz) { const u = E(0.75, 1.5, mt); this.stake.position.set(hz.x, 1.4 + (1 - u) * 14, hz.z); this.stake.rotation.set(0.18 + (1 - u) * 2, k.yaw, 0); } }
    // --- the Ward Stands: five cots skid out from under her hem along the lines, ash streaming off them
    if (m === 'wardStands' && mt > 1.1 && this.cotT < 0) { this.cotT = 0; this.cotFrom.set(k.x, 0, k.z); this.cotYaw = k.yaw; this.cots.visible = true; }
    if (this.cotT >= 0) { this.cotT += dt; const u = E(0, 0.75, this.cotT); for (let i = 0; i < 5; i++) { const y = this.cotYaw + [-0.8, -0.4, 0, 0.4, 0.8][i], d = 2.6 + u * 9.5; this.cots.setMatrixAt(i, new THREE.Matrix4().compose(V(this.cotFrom.x + Math.sin(y) * d, 0, this.cotFrom.z + Math.cos(y) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, y + Math.PI / 2 + (1 - u) * 0.3 * (i - 2), 0)), V(1, 1, 1))); if (this.cotT < 0.75 && Math.random() < 0.5) this.fx.puffs.emit(V(this.cotFrom.x + Math.sin(y) * d, 0.4, this.cotFrom.z + Math.cos(y) * d), 1, 1.4, 1.0, t); } this.cots.instanceMatrix.needsUpdate = true; if (this.cotT > 2.2) { this.cots.visible = false; this.cotT = -1; for (let i = 0; i < 5; i++) { const y = this.cotYaw + [-0.8, -0.4, 0, 0.4, 0.8][i]; this.fx.puffs.emit(V(this.cotFrom.x + Math.sin(y) * 12, 0.3, this.cotFrom.z + Math.cos(y) * 12), 6, 2, 1.2, t); } } }
    // --- Last Breath: a gale of embers and smoke out of her face, turning
    const gust = m === 'lastBreath' ? k.strikes.reduce((a, q) => Math.max(a, E(q.t[0] - 0.15, q.t[0], mt) * (1 - E(q.t[1], q.t[1] + 0.25, mt))), 0) * E(0.6, 1.0, mt) : 0;
    this.galeU.uK.value += (gust - this.galeU.uK.value) * Math.min(1, dt * 10); this.gale.visible = this.galeU.uK.value > 0.02;
    if (this.gale.visible) { this.gale.position.copy(head); const tgt = V(k.x + Math.sin(k.yaw) * 9, 0.4, k.z + Math.cos(k.yaw) * 9); this.gale.lookAt(tgt); this.gale.scale.set(2.6, 2.6, head.distanceTo(tgt)); if (Math.random() < gust) { const d = tgt.clone().sub(head).normalize(); this.fx.sparks.emit(head.clone().addScaledVector(d, 1), d.clone().multiplyScalar(1.2), 6, 9, 1.4, -0.4, t); this.fx.puffs.emit(head.clone().addScaledVector(d, 2 + Math.random() * 5).setY(0.5 + Math.random() * 1.5), 1, 2.2, 1.2, t); } }
    // --- the Hour Hand: the hook's shadow lies on the stone and turns like a clock hand
    const sw = f.hazards.find(z => z.shape === 'sweep'); this.hand.visible = !!sw && k.mode === 'hourHand'; if (sw && this.hand.visible) { const u = Math.max(0, Math.min(1, (sw.t - sw.delay) / (sw.dur || 1))), yw = sw.yaw + (sw.spin ?? 0) * u, ir = sw.inner ?? 0; this.hand.position.set(sw.x + Math.sin(yw) * ir, 0, sw.z + Math.cos(yw) * ir); this.hand.rotation.set(0, yw + Math.PI, 0); this.hand.scale.set(sw.half * 2.2, 1, sw.len - ir); this.handU.uK.value = Math.min(1, sw.t / Math.max(0.1, sw.delay)) * (1 - E(0.92, 1, u)); this.handU.uHot.value = sw.t >= sw.delay ? 1 : 0.3; }
    // embers kindle along the shadow as it turns
    for (const z of f.hazards) if (z.shape === 'sweep' && z.t >= z.delay && Math.random() < 0.8) { const u = Math.min(1, (z.t - z.delay) / (z.dur || 1)), yw = z.yaw + (z.spin ?? 0) * u, d = (z.inner ?? 0) + Math.random() * (z.len - (z.inner ?? 0)); this.fx.sparks.emit(V(z.x + Math.sin(yw) * d, 0.1, z.z + Math.cos(yw) * d), V(0, 1, 0), 2, 1.6, 2, -1.4, t); }
  }
}
