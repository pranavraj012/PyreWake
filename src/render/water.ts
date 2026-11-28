// The river: black, ankle deep over the landing and bottomless beyond it. Ripples from feet, blows and ground fire; the line of daylight at the end of it.
import * as THREE from 'three';
import type { Tier } from '../core/quality.ts';
import { FOG } from './surface.ts';

const N = 24;
/** Level of the water over the landing, metres above the stone. */
export const LEVEL = 0.12;
export class Water {
  mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; private ring: THREE.Vector4[]; private n = 0;
  /** 0-1: how lit the horizon line is. */ line = { value: 1 }; /** 0-1: darkness over everything (a boss's scene closes it). */ dark = { value: 0 };
  /** The river boiled away: centre x, z, radius, and how far gone. */ boil = { value: new THREE.Vector4(0, 0, 0, 0) };
  constructor(tier: Tier, moon: THREE.Vector3) {
    const ph = tier.name === 'phone', cnt = ph ? 12 : N; this.ring = Array.from({ length: cnt }, () => new THREE.Vector4(0, 0, -99, 0));
    this.u = { ...THREE.UniformsLib.fog, ...FOG, uR: { value: this.ring }, uMoon: { value: moon }, uLine: this.line, uBoil: this.boil, uDark: this.dark, uLevel: { value: LEVEL } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true, uniforms: this.u, defines: { NR: cnt, ...(ph ? { CHEAP: 1 } : {}) },
      vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `varying vec3 vW; uniform vec4 uT, uR[NR], uBoil; uniform vec3 uMoon; uniform float uLine, uLevel, uDark;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
float fb(vec2 p){ return n(p) * .55 + n(p * 2.17 + 4.1) * .3 + n(p * 4.7 - 2.3) * .15; }
void main(){
 vec2 p = vW.xz; float t = uT.w, R0 = length(p);
 // broad slow swell and fine chop; the current runs east to west
 vec2 q = p * .32 + vec2(t * .035, t * .012); float e = .08;
 float hc = fb(q), hx = fb(q + vec2(e, 0.)), hz = fb(q + vec2(0., e)); vec2 g = vec2(hx - hc, hz - hc) / e * .045;
#ifndef CHEAP
 vec2 q2 = p * 1.6 + vec2(-t * .1, t * .07); float c2 = n(q2); g += vec2(n(q2 + vec2(.1, 0.)) - c2, n(q2 + vec2(0., .1)) - c2) * .16 * smoothstep(100., 15., R0);
#endif
 // ripples
 float glint = 0.;
 for (int i = 0; i < NR; i++) { vec4 r = uR[i]; float age = t - r.z; if (age < 0. || age > 3.6 || r.w < .01) continue; vec2 d = p - r.xy; float L = length(d) + 1e-4, ring = age * 2.4 + .1, w = L - ring, a = r.w * exp(-age * 1.1) / (1. + L * .35) * smoothstep(0., .25, age);
  float env = exp(-w * w * 5.), s = cos(w * 11.) * 11. * env * a * .045; g += d / L * s; glint += env * a * (.5 + .5 * sin(w * 11.)); }
 vec3 N = normalize(vec3(-g.x, 1., -g.y)), V = normalize(cameraPosition - vW);
 float F = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.); vec3 Rf = reflect(-V, N);
 float up = max(Rf.y, 0.); vec3 sky = mix(vec3(.034, .043, .06), vec3(.006, .009, .016), pow(up, .4));
 float band = exp(-pow((Rf.y - .02) * 55., 2.)) * smoothstep(-.35, .45, -Rf.z) * uLine; sky += vec3(1.05, .52, .22) * band * .9 + vec3(.5, .25, .1) * exp(-up * 14.) * smoothstep(-.4, .6, -Rf.z) * uLine * .22;
 float m = max(dot(Rf, uMoon), 0.); sky += vec3(.7, .8, 1.) * (pow(m, 260.) * 6. + pow(m, 18.) * .12);
 sky *= 1. - uDark * .8;
 vec3 col = sky * F + vec3(.0022, .0036, .0046) * (1. - F) + vec3(.5, .6, .8) * glint * .02 * (1. - uDark);
 // shallows show the stone; the deep does not
 float deep = smoothstep(19., 25., R0), alpha = clamp(mix(.84, .99, deep) + F * .2, 0., 1.);
 // the river boiled away around the hero, and the foam at its edge
 float boil = 0.; if (uBoil.w > .001) { float d = length(p - uBoil.xy), edge = uBoil.z + (fb(p * .5 + t * .6) - .5) * 2.4, k = smoothstep(edge, edge - 1.4, d) * uBoil.w; alpha *= 1. - k; col += vec3(.7, .72, .75) * smoothstep(1.6, 0., abs(d - edge)) * uBoil.w * (.25 + fb(p * 3. - t * 2.)); boil = k; }
 gl_FragColor = vec4(col, alpha * (1. - boil * .0));
#include <fog_fragment>
}`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(520, 520, 1, 1).rotateX(-Math.PI / 2), m); this.mesh.position.y = LEVEL; this.mesh.renderOrder = 2; this.mesh.frustumCulled = false;
  }
  /** A ring spreads from here. Strength about 0.3 for a footfall, 1 for a blow, 2 for something falling in. */
  ripple(x: number, z: number, amp: number, t: number) { this.ring[this.n].set(x, z, t, amp); this.n = (this.n + 1) % this.ring.length; }
}
