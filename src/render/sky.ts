import * as THREE from 'three';
import { FOG } from './surface.ts';

/** 0 clear night, 1 total eclipse. */
export const ECLIPSE = { value: 0 };
/** First light, 0-1. */
export const DAWN = { value: 0 };
/** The river's far bank: one thin line of daylight on the horizon, 0-1. */
export const LINE = { value: 0 };
/** Night sky dome with a hazed moon and drifting cloud. Also used to build the environment map. */
export function makeSky(moonDir: THREE.Vector3) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uMoon: { value: moonDir }, uT: FOG.uFogP, uEnv: { value: 0 }, uEcl: ECLIPSE, uDawn: DAWN, uLine: LINE },
    vertexShader: `varying vec3 d; void main(){ d = position; vec4 p = projectionMatrix * vec4(mat3(modelViewMatrix) * position, 1.); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 d; uniform vec3 uMoon; uniform vec4 uT; uniform float uEnv, uEcl, uDawn, uLine;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec3(7.1,3.3,1.7); a*=.5; } return s; }
void main(){ vec3 r = normalize(d); float y = max(r.y, 0.), m = max(dot(r, uMoon), 0.);
 vec3 c = mix(vec3(.024,.031,.044), vec3(.006,.0085,.015), pow(y, .45));
 float ang = acos(clamp(dot(r,uMoon), -1., 1.));
 vec2 q = r.xz / (r.y + .28); float cl = fbm(vec3(q * 1.5 + uT.w * .006, uT.w * .008)), cl2 = fbm(vec3(q * 3.6 + cl * 1.2, 4.));
 float cover = smoothstep(.36, .74, cl * .75 + cl2 * .3) * smoothstep(.0, .2, r.y) * (1. - .7 * smoothstep(.34, .04, ang));
 float st = step(.9975, h(floor(r * 210.))) * h(floor(r * 210.) + 3.) * smoothstep(.05,.5,r.y); c += vec3(.5,.55,.65) * st * .35 * (1. - cover);
 float disc = smoothstep(.0405, .0385, ang); vec3 t = r - uMoon; float mar = fbm(t * 42. + 5.); vec3 mo = vec3(1.,.95,.86) * (.5 + .75 * smoothstep(.3,.65,mar)) * (1. - .3 * smoothstep(.02,.039,ang));
 c += mo * disc * mix(2.6, 14., uEnv) * (1. - cover * .5);
 float halo = exp(-ang * 7.) * .14 + exp(-ang * 26.) * .32; c += vec3(.62,.74,.95) * halo * (.55 + .6 * cover);
 c = mix(c, vec3(.018,.022,.03) + vec3(.2,.235,.29) * (pow(m, 14.) * .95 + pow(m, 3.) * .13) * (.35 + 1.1 * cl2), cover * .85);
 c += vec3(.16,.052,.014) * exp(-max(r.y,0.) * 13.) * .12;
 if (uEcl > .001) { vec2 sh = vec2(dot(r - uMoon, normalize(cross(uMoon, vec3(0., 1., 0.)))), (r - uMoon).y); float bite = smoothstep(.0425, .0395, length(sh - vec2(.11 * (1. - uEcl), .03 * (1. - uEcl)))); vec3 cor = vec3(1., .16, .04) * (exp(-max(ang - .04, 0.) * 46.) * 1.6 + exp(-max(ang - .04, 0.) * 9.) * .35) * (.7 + .5 * fbm(vec3(sh * 26., uT.w * .2))); vec3 e = c * vec3(.42, .14, .11) + vec3(.0075, .0014, .0011) * (1. + 2. * cl2) + cor * smoothstep(.037, .041, ang); e *= 1. - bite * .98 * smoothstep(.0415, .0385, ang); c = mix(c * (1. - .9 * bite * step(ang, .0405)), e, smoothstep(.3, 1., uEcl)); }
 if (uDawn > .001) { float hz = exp(-max(r.y, 0.) * 5.), side = .35 + .65 * smoothstep(-.6, .9, -r.z * .8 + r.x * .5); c += uDawn * side * (vec3(.34, .13, .035) * hz + vec3(.06, .04, .05) * exp(-max(r.y, 0.) * 1.6) * (.6 + cover * .9)); }
 if (uLine > .001) { float side = smoothstep(-.5, .5, -r.z - r.x * .15), bn = exp(-pow((r.y - .012) * 170., 2.)), hz = exp(-abs(r.y) * 22.); c *= 1. - .68 * uLine; c += uLine * side * (vec3(1.1, .6, .26) * bn * 2.4 + vec3(.3, .13, .045) * hz * .3); }
 if (r.y < 0.) c = mix(c, vec3(.012,.0125,.014), smoothstep(0., -.12, r.y));
 gl_FragColor = vec4(c, 1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 32), mat); mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}
