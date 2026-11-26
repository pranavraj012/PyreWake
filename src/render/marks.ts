// Ground danger marks and flying crescents.
import * as THREE from 'three';
import type { Hazard, Shot } from '../combat/fight.ts';
import { FOG } from './surface.ts';

const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); } float fbm(vec2 p){ return n(p)*.55 + n(p*2.1+3.7)*.3 + n(p*4.3+1.3)*.15; }`;

export class Marks {
  mesh: THREE.Mesh; private n = 12; private a: THREE.InstancedBufferAttribute; private b: THREE.InstancedBufferAttribute; private g: THREE.InstancedBufferGeometry;
  constructor() {
    const g = this.g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
    const at = () => new THREE.InstancedBufferAttribute(new Float32Array(this.n * 4), 4); this.a = at(); this.b = at(); g.setAttribute('aP', this.a); g.setAttribute('aQ', this.b); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: FOG.uFogP },
      vertexShader: `attribute vec4 aP, aQ; varying vec2 u, s; flat varying float kd; varying float k; void main(){ kd = aQ.x; k = aQ.y; s = aQ.zw; float c = cos(aP.w), n = sin(aP.w); vec2 q = kd > .5 && kd < 1.5 ? vec2(position.x * aQ.z, (position.z * .5 + .5) * aQ.w) : position.xz * aQ.z; u = kd > .5 && kd < 1.5 ? vec2(position.x, position.z * .5 + .5) : position.xz; vec3 w = aP.xyz + vec3(q.x * c + q.y * n, .12, -q.x * n + q.y * c); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`,
      fragmentShader: `varying vec2 u, s; flat varying float kd; varying float k; uniform vec4 uT; ${NOISE}
void main(){ vec3 c; float f = fbm(u * 5. + vec2(0., -uT.w * .8)), pu = .8 + .2 * sin(uT.w * 18.), hot = smoothstep(.75, 1., k);
 if (kd < .5) { float d = length(u); if (d > 1.) discard; float ir = s.y / max(s.x, .01);
   if (ir > .01) { float w = .045 / ir * .06 + .004; float safe = smoothstep(ir + w, ir, d); float rim = smoothstep(w * 1.6, 0., abs(d - ir)), gl = smoothstep(ir, ir + .25, d) * smoothstep(1., .6, d), creep = step(1. - k, (d - ir) / (1. - ir));
     c = vec3(1., .13, .02) * (.08 + .22 * smoothstep(.45, .75, f) * (.6 + 1.4 * hot)) * gl * (1. - safe) * (.35 + .65 * creep) * pu + vec3(.9, .85, .75) * rim * (.5 + .5 * hot) * .9; }
   else { float edge = smoothstep(.07, 0., abs(d - .95)), ring = smoothstep(.05, 0., abs(d - k * .95)), fill = smoothstep(1., .1, d) * .16 + .2 * smoothstep(.45, .75, f) * step(d, k); c = vec3(1., .13, .02) * (edge * 1.5 + ring * 1.0 + fill * (1. + 2. * hot)) * pu; } }
 else if (kd < 1.5) { float e = 1. - abs(u.x), edge = smoothstep(.14, .0, e), fade = smoothstep(1., .85, u.y); float run = smoothstep(.04, 0., abs(u.y - k)); c = vec3(1., .13, .02) * (edge * .75 + run * .8 + .03 + .16 * smoothstep(.45, .75, f) * step(u.y, k) * (1. + 2. * hot)) * fade * pu; }
 else { float d = length(u) * s.x; float q = d - s.y, w = smoothstep(.55, 0., abs(q)) ; float flame = smoothstep(.3, .8, fbm(vec2(atan(u.y, u.x) * 9., d * 2. - uT.w * 5.))); c = mix(vec3(1., .12, .01), vec3(1., .6, .2), w * flame) * w * (.5 + flame) * 1.6 + vec3(1., .13, .02) * smoothstep(1.6, 0., max(q, 0.)) * step(0., q) * .15; }
 gl_FragColor = vec4(c * .85, 1.); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
  }
  update(hz: Hazard[]) {
    let i = 0; for (const h of hz) { if (i >= this.n) break; const k = Math.min(1, h.t / h.delay);
      if (h.shape === 'ring') { const R = Math.max(0, h.speed * (h.t - h.delay)); if (R <= 0) { this.a.setXYZW(i, h.x, 0, h.z, 0); this.b.setXYZW(i, 0, k, 1.0, 0); } else { this.a.setXYZW(i, h.x, 0, h.z, 0); this.b.setXYZW(i, 2, 0, R + 1.8, R); } }
      else if (h.shape === 'sweep') { const u = Math.max(0, Math.min(1, (h.t - h.delay) / (h.dur || 1))); if (u >= 1) continue; const yw = h.yaw + (h.spin ?? 0) * u, ir = h.inner ?? 0, on = h.t >= h.delay; this.a.setXYZW(i, h.x + Math.sin(yw) * ir, 0, h.z + Math.cos(yw) * ir, yw); this.b.setXYZW(i, 1, on ? 1 : k * 0.9, h.half, h.len - ir); }
      else if (h.shape === 'line') { if (h.t > h.delay + 0.12) continue; const back = h.visual ? h.len : 0; this.a.setXYZW(i, h.x - Math.sin(h.yaw) * back, 0, h.z - Math.cos(h.yaw) * back, h.yaw); this.b.setXYZW(i, 1, k, h.half, h.len + back); }
      else { if (h.t > h.delay + 0.12) continue; this.a.setXYZW(i, h.x, 0, h.z, 0); this.b.setXYZW(i, 0, k, h.r, h.inner ?? 0); }
      i++; }
    this.g.instanceCount = i; this.mesh.visible = i > 0; this.a.needsUpdate = this.b.needsUpdate = true;
  }
}

/** A blade of fire longer than the steel: crossed sheets along the weapon's Y axis. */
export class Blaze {
  mesh: THREE.Mesh; private u = { uK: { value: 0 }, uT: FOG.uFogP };
  constructor() {
    const pos: number[] = [], uv: number[] = [], ix: number[] = []; [0, Math.PI / 2].forEach((a, k) => { for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(Math.cos(a) * x * 0.2, y, Math.sin(a) * x * 0.2); uv.push(x, y); } ix.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: this.u, vertexShader: `varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: `varying vec2 v; uniform float uK; uniform vec4 uT; ${NOISE} void main(){ float x = abs(v.x), f = fbm(vec2(v.x * 2.5, v.y * 7. - uT.w * 6.)), w = (1. - pow(v.y, 2.2)) * (.35 + .55 * f); float b = smoothstep(w, 0., x) * smoothstep(0., .05, v.y); gl_FragColor = vec4(mix(vec3(1., .16, .02), vec3(1.3, 1., .6), smoothstep(.45, .95, b)) * b * uK * 2.2, 1.); }` }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 9; this.mesh.visible = false;
  }
  set(len: number, k: number) { this.mesh.visible = k > 0.01; this.mesh.scale.set(0.6 + len * 0.16, len, 0.6 + len * 0.16); this.u.uK.value = k; }
}

/** Blades of fire in flight: upright for Sunder Arc, flat for the flare. */
export class Crescents {
  group = new THREE.Group(); private pool: { m: THREE.Mesh; u: { uK: { value: number }; uT: { value: THREE.Vector4 } } }[] = [];
  constructor(count = 3) {
    const pos: number[] = [], uv: number[] = [], ix: number[] = [], N = 28; for (let i = 0; i <= N; i++) { const t = i / N, a = (t - 0.5) * 2.5, w = 0.34 * Math.sin(Math.PI * t) ** 0.8; for (const r of [1, 1 - w]) { pos.push(Math.sin(a) * r, 0, Math.cos(a) * r - 0.75); uv.push(t, r === 1 ? 1 : 0); } if (i < N) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix);
    for (let k = 0; k < count; k++) {
      const u = { uK: { value: 0 }, uT: FOG.uFogP }, m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: u, vertexShader: `varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: `varying vec2 v; uniform float uK; uniform vec4 uT; ${NOISE} void main(){ float f = fbm(vec2(v.x * 12., v.y * 3. + uT.w * 9.)), e = smoothstep(0., .75, v.y), b = e * (.45 + f) * smoothstep(0., .12, v.x) * smoothstep(1., .88, v.x); b *= 1. - uK * uK; gl_FragColor = vec4(mix(vec3(1., .16, .02), vec3(1.2, .95, .6), smoothstep(.7, 1., v.y) * .9) * b * 3., 1.); }` }));
      m.frustumCulled = false; m.renderOrder = 9; m.visible = false; this.group.add(m); this.pool.push({ m, u });
    }
  }
  update(shots: Shot[]) { this.pool.forEach((p, i) => { const s = shots[shots.length - 1 - i]; p.m.visible = !!s; if (!s) return; const big = s.big; p.m.position.set(s.x, big ? 1.5 : 1.15, s.z); p.m.rotation.set(0, Math.atan2(s.dx, s.dz), big ? Math.PI / 2 - 0.12 : 0.25, 'YXZ'); p.m.scale.setScalar(big ? 2.1 : 1.25); p.u.uK.value = s.t / s.life; }); }
}
