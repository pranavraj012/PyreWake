// Ribbons, sparks, rings and afterimages.
import * as THREE from 'three';
import { FOG, SHARED } from './surface.ts';

/** Two-edge ribbon trail (blade) or camera-facing streak (eye). */
export class Ribbon {
  mesh: THREE.Mesh; private n: number; private pos: Float32Array; private age: Float32Array; private hist: { a: THREE.Vector3; b: THREE.Vector3; t: number; w: number }[] = [];
  private life: number; private g = new THREE.BufferGeometry();
  private sub = 4;
  constructor(n: number, life: number, color: THREE.Color, core: number) {
    this.n = n; this.life = life; this.pos = new Float32Array(n * 6); this.age = new Float32Array(n * 6);
    this.g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); this.g.setAttribute('aT', new THREE.BufferAttribute(this.age, 3));
    const ix: number[] = []; for (let i = 0; i < n - 1; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); this.g.setIndex(ix);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uC: { value: color }, uT: FOG.uFogP, uCore: { value: core } },
      vertexShader: `attribute vec3 aT; varying vec3 t; void main(){ t = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec3 t; uniform vec3 uC; uniform vec4 uT; uniform float uCore; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
void main(){ float k = 1. - t.x; float st = n(vec2(t.y * 26., t.x * 5. - uT.w * 3.)) * .7 + .3; float e = smoothstep(0., .25, t.y); float a = k * k * (.35 + .65 * k) * t.z * mix(st * st * 1.25, 1., uCore) * mix(e * (.25 + .75 * smoothstep(.35, 1., t.y)), 1., uCore); gl_FragColor = vec4(mix(uC, vec3(1., .85, .6), smoothstep(.85, 1., t.y) * k * .6) * a, 1.); }` });
    this.mesh = new THREE.Mesh(this.g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  push(a: THREE.Vector3, b: THREE.Vector3, weight: number, t: number) { this.hist.unshift({ a: a.clone(), b: b.clone(), t, w: weight }); if (this.hist.length > this.n / this.sub) this.hist.pop(); }
  clear() { this.hist.length = 0; }
  update(t: number) {
    while (this.hist.length && t - this.hist[this.hist.length - 1].t > this.life) this.hist.pop();
    const h = this.hist, sub = this.sub; let any = false, i = 0; const cr = (p0: number, p1: number, p2: number, p3: number, u: number) => 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
    const K = ['x', 'y', 'z'] as const;
    for (let s = 0; s < h.length - 1 && i < this.n; s++) {
      const p0 = h[Math.max(0, s - 1)], p1 = h[s], p2 = h[s + 1], p3 = h[Math.min(h.length - 1, s + 2)], w0 = p1.w, w1 = p2.w; if (w0 > 0.02) any = true;
      for (let q = 0; q < sub && i < this.n; q++, i++) { const u = q / sub, k = Math.min(1, (t - (p1.t + (p2.t - p1.t) * u)) / this.life), w = w0 + (w1 - w0) * u;
        K.forEach((c, j) => { this.pos[i * 6 + j] = cr(p0.a[c], p1.a[c], p2.a[c], p3.a[c], u); this.pos[i * 6 + 3 + j] = cr(p0.b[c], p1.b[c], p2.b[c], p3.b[c], u); }); this.age.set([k, 0, w, k, 1, w], i * 6); }
    }
    const used = i;
    this.mesh.visible = any; this.g.setDrawRange(0, Math.max(0, used - 1) * 6); this.g.attributes.position.needsUpdate = this.g.attributes.aT.needsUpdate = true;
  }
}

/** Ballistic sparks and embers: CPU only touches a particle at birth. */
export class Sparks {
  mesh: THREE.Mesh; private i = 0; private n: number; private a: THREE.InstancedBufferAttribute; private b: THREE.InstancedBufferAttribute; private scale: number;
  constructor(n: number, scale: number, dark = false) {
    this.n = n; this.scale = scale; const g = new THREE.InstancedBufferGeometry(); g.instanceCount = n;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-99), 4); this.b = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    g.setAttribute('aP', this.a); g.setAttribute('aV', this.b);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { uT: FOG.uFogP }, defines: dark ? { DARK: 1 } : {},
      vertexShader: `attribute vec4 aP, aV; uniform vec4 uT; varying vec2 u; varying float k, em2; void main(){ em2 = aV.w < 0. ? 1. : 0.; float t = uT.w - aP.w, L = abs(aV.w); k = t / L; u = position.xy; if (t < 0. || k > 1.) { gl_Position = vec4(2.); return; }
bool em = aV.w < 0.; float dr = em ? 1.6 : 1.1; float s = (1. - exp(-dr * t)) / dr; vec3 p = aP.xyz + aV.xyz * s + vec3(em ? sin(t * 3. + aP.x * 20.) * .12 : 0., em ? .35 * t : -4.2 * t * t, em ? cos(t * 2.6 + aP.z * 20.) * .12 : 0.); if (!em && p.y < .02) p.y = .02 + abs(p.y) * .25;
vec3 v = aV.xyz * exp(-dr * t) + vec3(0., em ? .35 : -8.4 * t, 0.); vec4 mv = viewMatrix * vec4(p, 1.); vec2 d = (viewMatrix * vec4(v, 0.)).xy; float sp = length(d); d = sp > .01 ? d / sp : vec2(0., 1.); float len = em ? .03 : .02 + min(sp * .022, .22), w = em ? .026 : .011;
#ifdef DARK
w = .024; len = .035 + min(sp * .02, .2);
#endif
 mv.xy += vec2(d.y, -d.x) * position.x * w * (1. - k * .5) + d * (position.y - .5) * len; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 u; varying float k, em2; void main(){ float d = 1. - abs(u.x) * 2.; float e = smoothstep(0., .35, u.y) * smoothstep(1., .65, u.y); if (em2 > .5) { d = smoothstep(.5, .0, length(vec2(u.x, u.y - .5))); e = d; } 
#ifdef DARK
gl_FragColor = vec4(vec3(.03, .006, .004), smoothstep(0., .5, d * e) * (1. - k * k) * .9);
#else
gl_FragColor = vec4(mix(vec3(1., .8, .45), vec3(1., .22, .03), smoothstep(0., .6, k)) * d * e * pow(1. - k, 1.3) * 7., 1.);
#endif
}` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  /** Negative life = floating ember. */
  emit(p: THREE.Vector3, dir: THREE.Vector3, count: number, speed: number, spread: number, life: number, t: number) {
    count = Math.max(1, Math.round(count * this.scale));
    for (let c = 0; c < count; c++) { const s = speed * (0.35 + Math.random() * 0.9), q = () => (Math.random() - 0.5) * spread; this.a.setXYZW(this.i, p.x, p.y, p.z, t); this.b.setXYZW(this.i, (dir.x + q()) * s, (dir.y + q()) * s, (dir.z + q()) * s, life * (0.6 + Math.random() * 0.7)); this.i = (this.i + 1) % this.n; }
    this.a.needsUpdate = this.b.needsUpdate = true;
  }
}

/** Ground dust / shock ring, and the heavy's fire crescent. */
export class Puffs {
  mesh: THREE.Mesh; private i = 0; private a: THREE.InstancedBufferAttribute; private b: THREE.InstancedBufferAttribute; private n = 48;
  constructor() {
    const g = new THREE.InstancedBufferGeometry(), n = this.n; g.instanceCount = n;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-99), 4); this.b = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); g.setAttribute('aP', this.a); g.setAttribute('aV', this.b);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: FOG.uFogP },
      vertexShader: `attribute vec4 aP, aV; uniform vec4 uT; varying vec2 u; varying float k, s; void main(){ float t = uT.w - aP.w; k = t / aV.w; u = position.xy + .5; s = fract(aP.x * 7.7 + aP.z * 3.1) * 40.; if (t < 0. || k > 1.) { gl_Position = vec4(2.); return; } float e = 1. - exp(-3.2 * t); vec3 p = aP.xyz + aV.xyz * e * .6; float z = .45 + e * 1.5; vec4 mv = viewMatrix * vec4(p, 1.); mv.xy += position.xy * z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 u; varying float k, s; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); } void main(){ float d = n(u * 3.4 + s) * .6 + n(u * 8. - s) * .4; float a = smoothstep(.5, .1, length(u - .5) + (d - .5) * .4) * pow(1. - k, 1.5) * .34; gl_FragColor = vec4(vec3(.125, .128, .135) * (.6 + .7 * d), a); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }
  emit(p: THREE.Vector3, count: number, speed: number, life: number, t: number) { for (let c = 0; c < count; c++) { const an = c / count * 6.283 + Math.random(); this.a.setXYZW(this.i, p.x, 0.16, p.z, t); this.b.setXYZW(this.i, Math.cos(an) * speed, 0.35 + Math.random() * 0.5, Math.sin(an) * speed, life * (0.7 + Math.random() * 0.5)); this.i = (this.i + 1) % this.n; } this.a.needsUpdate = this.b.needsUpdate = true; }
}

/** Frozen burning copies of a skinned mesh. */
export class Ghosts {
  private pool: { mesh: THREE.SkinnedMesh; sk: THREE.Skeleton; born: number; u: { value: number } }[] = []; private i = 0; private src: THREE.Skeleton; private life = 0.55;
  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, src: THREE.Skeleton, count: number) {
    this.src = src;
    for (let k = 0; k < count; k++) {
      const u = { value: 1 }, sk = new THREE.Skeleton(src.bones, src.boneInverses); sk.computeBoneTexture(); sk.update = () => { };
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: u, uT: SHARED.uTime },
        vertexShader: `#include <common>
#include <skinning_pars_vertex>
varying vec3 vN, vV, vW; void main(){
#include <skinbase_vertex>
#include <beginnormal_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <skinning_vertex>
vec4 mv = modelViewMatrix * vec4(transformed, 1.); vN = normalize(normalMatrix * objectNormal); vV = normalize(-mv.xyz); vW = transformed; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vN, vV, vW; uniform float uK; float h(vec3 p){ return fract(sin(dot(p, vec3(12.98,78.23,37.7))) * 43758.5); } float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2); float d = n(vW * 9.) * .65 + n(vW * 23.) * .35; float cut = d - uK * 1.15 + .12; if (cut < 0.) discard; float edge = smoothstep(.12, 0., cut); gl_FragColor = vec4((vec3(1., .26, .05) * (f * .55 + .03) + vec3(1., .5, .14) * edge * 1.5) * (1. - uK), 1.); }` });
      const mesh = new THREE.SkinnedMesh(geo, m); mesh.bind(sk, new THREE.Matrix4()); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 4; scene.add(mesh); this.pool.push({ mesh, sk, born: -9, u });
    }
  }
  snap(t: number) { const g = this.pool[this.i]; this.i = (this.i + 1) % this.pool.length; this.src.update(); (g.sk.boneMatrices as Float32Array).set(this.src.boneMatrices as Float32Array); if (g.sk.boneTexture) g.sk.boneTexture.needsUpdate = true; g.born = t; g.mesh.visible = true; }
  update(t: number) { for (const g of this.pool) { const k = (t - g.born) / this.life; g.u.value = Math.min(1, k); if (k >= 1) g.mesh.visible = false; } }
  /** Draw once at load so the first dodge doesn't hitch. */
  warm(on: boolean) { for (const g of this.pool) g.mesh.visible = on; }
}

export type { Fx } from './impact.ts';
