// Impact effects: slash flashes, shock rings, fireballs, flame pillars, and the danger cues.
import * as THREE from 'three';
import type { Puffs, Sparks } from './fx.ts';
import { FOG } from './surface.ts';

export interface Fx { sparks: Sparks; gore: Sparks; puffs: Puffs; bursts: Bursts }
export const BURST = { slash: 0, glint: 1, ring: 2, fire: 3, ground: 4, pillar: 5, flare: 6 } as const;
const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); } float fbm(vec2 p){ return n(p)*.55 + n(p*2.1+3.7)*.3 + n(p*4.3+1.3)*.15; }`;

/** One instanced draw for every short-lived additive effect. Birth times may lie in the future. */
export class Bursts {
  mesh: THREE.Mesh; private i = 0; private n = 72; private a: THREE.InstancedBufferAttribute; private b: THREE.InstancedBufferAttribute; private c: THREE.InstancedBufferAttribute;
  constructor() {
    const g = new THREE.InstancedBufferGeometry(), n = this.n; g.instanceCount = n;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const at = (f: number) => new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(f), 4); this.a = at(-99); this.b = at(0); this.c = at(0); g.setAttribute('aP', this.a); g.setAttribute('aQ', this.b); g.setAttribute('aC', this.c);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: FOG.uFogP },
      vertexShader: `attribute vec4 aP, aQ, aC; uniform vec4 uT; varying vec2 u; varying float k; varying vec3 col; flat varying float kd, sd;
void main(){ float t = uT.w - aP.w; k = t / aQ.w; kd = aQ.x; u = position.xy; col = aC.rgb; sd = fract(aP.x * 3.7 + aP.z * 5.3 + aP.w * 9.1) * 30.; if (t < 0. || k > 1.) { gl_Position = vec4(2.); return; }
 float e = 1. - pow(1. - k, 3.), z = aQ.z; vec4 mv;
 if (kd < .5) { vec2 s = vec2(z * (.55 + .75 * e), z * .1 * (1. - k)); vec2 q = position.xy * s; float c = cos(aQ.y), n = sin(aQ.y); mv = viewMatrix * vec4(aP.xyz, 1.); mv.xy += vec2(q.x * c - q.y * n, q.x * n + q.y * c); mv.z += .5; }
 else if (kd > 3.5 && kd < 4.5) { mv = viewMatrix * vec4(aP.xyz + vec3(position.x, 0., position.y) * z * (.15 + .85 * e), 1.); }
 else if (kd > 4.5 && kd < 5.5) { vec3 r = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0])); mv = viewMatrix * vec4(aP.xyz + r * position.x * z * .46 * (.6 + .6 * e) + vec3(0., (position.y + .5) * z * (.35 + .75 * e), 0.), 1.); }
 else { float s = kd < 1.5 ? z * (1. - .5 * k) : kd > 5.5 ? z : z * (.25 + .75 * e); vec3 w = aP.xyz; if (kd > 2.5 && kd < 3.5) w.y += e * z * .22; mv = viewMatrix * vec4(w, 1.); float c = cos(aQ.y), n = sin(aQ.y); vec2 q = position.xy * s; mv.xy += vec2(q.x * c - q.y * n, q.x * n + q.y * c); mv.z += .25; }
 gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 u; varying float k; varying vec3 col; flat varying float kd, sd; ${NOISE}
void main(){ vec3 c = vec3(0.); float d = length(u) * 2.;
 if (kd < .5) { float x = max(0., 1. - abs(u.x) * 2.), y = max(0., 1. - abs(u.y) * 2. / (.06 + x * x * .94)); float b = pow(y, 1.6) * smoothstep(0., .5, x); c = mix(col, vec3(1.3, 1.05, .75), pow(y, 4.)) * b * (1. - k) * 3.; }
 else if (kd < 1.5) { float a = max(0., 1. - abs(u.x) * 26. * (.3 + abs(u.y) * 2.)) * (1. - abs(u.y) * 2.), b = max(0., 1. - abs(u.y) * 26. * (.3 + abs(u.x) * 2.)) * (1. - abs(u.x) * 2.); c = (col * (a + b) * 5. + col * pow(max(0., 1. - d), 4.) * 3.) * (1. - k) * smoothstep(0., .1, k); }
 else if (kd < 2.5) { vec2 q = u / max(d, .01) * 2.; float f = fbm(q * 1.9 + sd), w = mix(.06, .012, k); float r = d + (f - .5) * .22; c = col * smoothstep(w, 0., abs(r - .88)) * smoothstep(.46, .72, f) * pow(max(0., 1. - k), 1.5) * 1.3; }
 else if (kd < 3.5) { float f = fbm(u * 3.2 + sd + vec2(0., -k * 1.4)) * 1.1 + fbm(u * 8. - sd) * .4; float b = clamp(1.25 - d * 1.05 + (f - .75) * 1.3 - k * 1.25, 0., 1.); b *= smoothstep(1., .72, d); c = mix(vec3(.75, .07, .006), mix(vec3(1., .34, .05), vec3(1., .82, .45), smoothstep(.45, .95, b)), smoothstep(.02, .4, b)) * b * b * 1.7; }
 else if (kd < 4.5) { vec2 an = u / max(d, .01) * 2.; float f = fbm(an * 2.6 + sd + vec2(0., d * 2. - k * 3.)); float w = mix(.28, .07, k), q = d + (f - .5) * .16; float r = smoothstep(w, 0., abs(q - (.9 - w * .5))) * smoothstep(1., .9, d); c = mix(vec3(.9, .12, .01), vec3(1., .55, .18), r * f) * r * smoothstep(.25, .75, f) * pow(1. - k, 1.5) * 1.7; }
 else if (kd < 5.5) { vec2 p = vec2(u.x + .5, u.y + .5); p.x += (fbm(vec2(p.x * 3. + sd, p.y * 2. - k * 4.)) - .5) * .5 * p.y; float f = fbm(vec2(p.x * 5. + sd, p.y * 2.6 - k * 6.)); float w = 1. - pow(abs(p.x - .5) * 2., 1.5); float b = clamp(w * 1.4 - p.y * 1.0 + (f - .5) * 1.7 - k * k * 1.3, 0., 1.) * smoothstep(1., .6, p.y); b *= max(w, 0.) * smoothstep(0., .06, p.y); c = mix(vec3(.85, .08, .006), mix(vec3(1., .36, .05), vec3(1., .8, .4), smoothstep(.4, .95, b)), smoothstep(.05, .45, b)) * b * b * 1.75; }
 else { c = col * pow(max(0., 1. - d), 2.2) * (1. - k) * .62; }
 gl_FragColor = vec4(max(c, 0.), 1.); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
  }
  add(kind: keyof typeof BURST, p: THREE.Vector3, size: number, life: number, t: number, rot = 0, r = 1.4, g = 0.55, b = 0.16) {
    this.a.setXYZW(this.i, p.x, p.y, p.z, t); this.b.setXYZW(this.i, BURST[kind], rot, size, life); this.c.setXYZW(this.i, r, g, b, 0); this.i = (this.i + 1) % this.n;
    this.a.needsUpdate = this.b.needsUpdate = this.c.needsUpdate = true;
  }
}

/** A danger cue pinned to the limb about to strike. White is a four-point star, red a hollow diamond; a closing outline shows when it lands. Draws over everything. */
export class CueMark {
  mesh: THREE.Mesh; private u = { uK: { value: 0 }, uRed: { value: 0 }, uA: { value: 0 }, uAsp: { value: 1 }, uT: FOG.uFogP }; private left = 0; private len = 1; at = new THREE.Vector3(); kind: 'white' | 'red' = 'white'; mark: 'cleaver' | 'handL' = 'cleaver';
  constructor() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: this.u,
      vertexShader: `varying vec2 u; uniform float uAsp; void main(){ u = position.xy; vec4 c = projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.); c.w = max(c.w, .5); c.xy = clamp(c.xy, vec2(-.84, -.7) * c.w, vec2(.84, .62) * c.w); float s = max(1.0 * projectionMatrix[1][1], .2 * c.w); c.xy += position.xy * s * vec2(projectionMatrix[0][0] / projectionMatrix[1][1], 1.); gl_Position = c; }`,
      fragmentShader: `varying vec2 u; uniform float uK, uRed, uA; uniform vec4 uT; void main(){ float d = length(u), g = pow(max(0., 1. - d), 2.5); vec3 c;
 if (uRed < .5) { float pop = exp(-uK * 5.), a = max(0., 1. - abs(u.x) * (34. - 20. * pop) * (.22 + abs(u.y) * 1.6)) * max(0., 1. - abs(u.y) * 1.1), b = max(0., 1. - abs(u.y) * (34. - 20. * pop) * (.22 + abs(u.x) * 1.6)) * max(0., 1. - abs(u.x) * 1.1); float R = mix(.92, .12, uK); float ring = smoothstep(.035, 0., abs(d - R)) * .55; c = vec3(.95, .98, 1.05) * ((a + b) * (1. + 2.5 * pop) + ring + g * (.25 + pop)); }
 else { float q = abs(u.x) + abs(u.y), pu = .75 + .25 * sin(uT.w * 22.); float R = mix(1., .3, uK); float ring = smoothstep(.05, 0., abs(q - R)), core = smoothstep(.06, 0., abs(q - .3)), fill = smoothstep(.3, .0, q); c = vec3(1.2, .025, .012) * (ring * .8 + core * 1.1 + fill * .5 * pu + g * .5 * pu); }
 gl_FragColor = vec4(c * uA * 1.5, 1.); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 50; this.mesh.visible = false;
  }
  start(kind: 'white' | 'red', mark: 'cleaver' | 'handL', lead: number) { this.kind = kind; this.mark = mark; this.left = this.len = Math.max(0.1, lead); this.u.uRed.value = kind === 'red' ? 1 : 0; this.mesh.visible = true; }
  stop() { this.left = Math.min(this.left, 0); }
  get active() { return this.mesh.visible; }
  update(dt: number, at: THREE.Vector3) { if (!this.mesh.visible) return; this.left -= dt; this.mesh.position.copy(at); this.mesh.updateMatrixWorld(); this.u.uK.value = Math.min(1, 1 - this.left / this.len); this.u.uA.value = this.left > 0 ? Math.min(1, (this.len - this.left) / 0.05) : Math.max(0, 1 + this.left / 0.12); if (this.left < -0.12) this.mesh.visible = false; }
}
