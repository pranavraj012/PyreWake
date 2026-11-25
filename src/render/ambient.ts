// Fire, embers, smoke, falling ash. All instanced, all GPU-animated.
import * as THREE from 'three';
import { FOG } from './surface.ts';
import type { Tier } from '../core/quality.ts';

const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.1+3.7; a*=.5; } return s; }`;

function quads(count: number, attrs: Record<string, [number, (i: number) => number[]]>) {
  const g = new THREE.InstancedBufferGeometry(); g.instanceCount = count;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [k, [n, f]] of Object.entries(attrs)) { const a = new Float32Array(count * n); for (let i = 0; i < count; i++) a.set(f(i), i * n); g.setAttribute(k, new THREE.InstancedBufferAttribute(a, n)); }
  return g;
}
const R = Math.random;

export function makeFires(at: THREE.Vector3[]) {
  const per = 6, g = quads(at.length * per, {
    aP: [4, i => { const p = at[Math.floor(i / per)], a = R() * 6.28, d = R() * 0.6; return [p.x + Math.cos(a) * d, p.y + 0.15 + R() * 0.5, p.z + Math.sin(a) * d, R() * 10]; }],
    aS: [2, () => { const s = 0.9 + R() * 0.8; return [s * 1.15, s * 1.9]; }],
  });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: FOG.uFogP },
    vertexShader: `attribute vec4 aP; attribute vec2 aS; varying vec2 u; varying float s; void main(){ u = position.xy + vec2(.5,0.); s = aP.w; vec3 r = normalize(vec3(viewMatrix[0][0], 0., viewMatrix[2][0])); vec3 w = aP.xyz + r * position.x * aS.x + vec3(0., position.y * aS.y, 0.); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`,
    fragmentShader: `uniform vec4 uT; varying vec2 u; varying float s; ${NOISE}
void main(){ float t = uT.w * 1.15 + s * 7.; vec2 p = u; p.x += (fbm(vec2(u.x * 3. + s, u.y * 2.4 - t * 1.4)) - .47) * .55 * u.y; float f = fbm(vec2(p.x * 4.2 + s * 3., p.y * 2.6 - t * 2.)) * .75 + fbm(vec2(p.x * 10., p.y * 7. - t * 3.4)) * .35;
 float w = (1. - pow(abs(p.x - .5) * 2., 1.6)) * smoothstep(0., .12, u.y); float b = clamp(w * 1.25 - u.y * 1.05 + (f - .5) * 1.5, 0., 1.) * smoothstep(1., .7, u.y); b *= w;
 vec3 c = mix(vec3(.85,.09,.008), vec3(1.,.36,.05), smoothstep(.05,.45,b)); c = mix(c, vec3(1.,.78,.36), smoothstep(.4,.95,b)); gl_FragColor = vec4(c * b * b * 2.1, 1.); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; return mesh;
}

export function makeSmoke(at: THREE.Vector3[]) {
  const per = 7, g = quads(at.length * per, { aP: [4, i => { const p = at[Math.floor(i / per)]; return [p.x, p.y + 1, p.z, (i % per) / per + R() * 0.1]; }] });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: FOG.uFogP },
    vertexShader: `attribute vec4 aP; uniform vec4 uT; varying vec2 u; varying float k, s; void main(){ u = position.xy + vec2(.5,0.); s = aP.w * 37.; k = fract(uT.w * .075 + aP.w); float z = 1.1 + k * 4.6; vec3 c = aP.xyz + vec3(sin(s + k * 3.) * .5 + k * k * 2.6, k * 8.5, cos(s) * .4); vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); gl_Position = projectionMatrix * viewMatrix * vec4(c + (r * position.x + up * (position.y - .5)) * z, 1.); }`,
    fragmentShader: `varying vec2 u; varying float k, s; ${NOISE} void main(){ vec2 q = u - .5; float d = fbm(u * 3. + s + vec2(0., -k * 2.)); float a = smoothstep(.5, .12, length(q) + (d - .5) * .42) * smoothstep(0., .18, k) * smoothstep(1., .4, k) * .3; vec3 c = mix(vec3(.16,.06,.022), vec3(.02,.023,.029), smoothstep(0., .22, k)); gl_FragColor = vec4(c * (.6 + d * .6), a); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 6; return mesh;
}

export function makeEmbers(at: THREE.Vector3[], tier: Tier) {
  const n = Math.round(240 * tier.particles), g = quads(n, { aP: [4, i => { const p = at[i % at.length]; return [p.x + (R() - 0.5) * 1.4, p.y + 0.5, p.z + (R() - 0.5) * 1.4, R()]; }], aV: [3, () => [R() - 0.5, 0.6 + R(), R() - 0.5]] });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: FOG.uFogP },
    vertexShader: `attribute vec4 aP; attribute vec3 aV; uniform vec4 uT; varying vec2 u; varying float k; void main(){ u = position.xy + vec2(.5,0.); float s = aP.w * 61.; k = fract(uT.w * (.1 + .12 * aV.y * .5) + aP.w); vec3 c = aP.xyz + vec3(aV.x * 2.2 * k + sin(uT.w * 1.7 + s) * .35 * k + k * k * 1.8, aV.y * 5.5 * k, aV.z * 2.2 * k + cos(uT.w * 1.3 + s) * .35 * k); vec4 p = viewMatrix * vec4(c, 1.); p.xy += (position.xy - vec2(0.,.5)) * mix(.045, .018, k) * (.6 + aP.w); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `varying vec2 u; varying float k; void main(){ float d = length(u - .5); gl_FragColor = vec4(vec3(1.,.33,.07) * smoothstep(.5,.05,d) * smoothstep(0.,.06,k) * pow(1.-k, 1.4) * 5., 1.); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 7; return mesh;
}

/** Ash flakes wrapped in a box around the camera. */
export function makeAsh(tier: Tier) {
  const n = Math.round(1100 * tier.particles), g = quads(n, { aP: [4, () => [R(), R(), R(), R()]] });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: FOG.uFogP, uMoonDir: FOG.uMoonDir },
    vertexShader: `attribute vec4 aP; uniform vec4 uT; varying float a; varying vec2 u; mat3 rx(float t){ float c=cos(t),s=sin(t); return mat3(1,0,0,0,c,s,0,-s,c); } mat3 ry(float t){ float c=cos(t),s=sin(t); return mat3(c,0,-s,0,1,0,s,0,c); }
void main(){ u = position.xy + vec2(.5,0.); float s = aP.w * 40.; vec3 box = vec3(26.,13.,26.); vec3 p = aP.xyz * box + vec3(uT.w * .35 + sin(uT.w * .5 + s) * .5, -uT.w * (.32 + aP.w * .35), uT.w * .12 + cos(uT.w * .4 + s) * .5); vec3 c = mod(p - cameraPosition, box) - box * .5 + cameraPosition; vec3 q = ry(uT.w * (1. + aP.w) + s) * rx(uT.w * 1.3 + s) * ((position - vec3(0.,.5,0.)) * (.012 + .028 * aP.w * aP.w)); vec4 v = viewMatrix * vec4(c + q, 1.); a = smoothstep(1.6, 4., -v.z) * smoothstep(13., 8., -v.z) * smoothstep(0., .5, c.y); gl_Position = projectionMatrix * v; }`,
    fragmentShader: `varying float a; varying vec2 u; void main(){ if (length((u - .5) * vec2(1., 1.5)) > .46) discard; gl_FragColor = vec4(vec3(.17,.18,.195), a * .75); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 8; return mesh;
}
