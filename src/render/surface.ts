// The one surface shader: PBR with rest-pose triplanar detail, wear/grime from baked curvature and AO, ember veins, ash dusting.
import * as THREE from 'three';
import type { Tier } from '../core/quality.ts';
import type { TexSet } from './assets.ts';
import { MATS } from './mats.ts';

export const FOG = {
  uFogCol: { value: new THREE.Color(0.02, 0.028, 0.042) }, uFogMoon: { value: new THREE.Color(0.10, 0.125, 0.16) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
  uFogP: { value: new THREE.Vector4(0.0045, 0.015, 0.55, 0) }, // base density, ground density, ground falloff, time
  uGlowP: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uGlowC: { value: new THREE.Color(1, 0.46, 0.16) },
};

/** Replace three's fog with height fog + moon in-scatter + analytic fire glow. */
export function installFog(tier: Tier) {
  const C = THREE.ShaderChunk as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG\nvarying vec3 vFogW;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\nvFogW = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);\n#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
varying vec3 vFogW;
uniform vec3 uFogCol, uFogMoon, uMoonDir, uGlowC; uniform vec4 uFogP; uniform vec4 uGlowP[6];
float fh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float fn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(fh(i),fh(i+vec2(1,0)),f.x),mix(fh(i+vec2(0,1)),fh(i+1.),f.x),f.y); }
vec3 applyFog(vec3 col, vec3 w, vec3 eye){
  vec3 d = w - eye; float L = length(d); vec3 rd = d / max(L, 1e-3);
  float k = uFogP.z, y0 = max(eye.y, 0.), y1 = max(w.y, 0.), dy = y1 - y0;
  float e = abs(dy) > .02 ? (exp(-k*y0) - exp(-k*y1)) / (k*dy) : exp(-k*y0);
  vec2 mid = mix(eye.xz, w.xz, .75);
  float n = fn(mid*.16 + uFogP.w*vec2(.05,.02)) * .65 + fn(mid*.5 - uFogP.w*vec2(.07,.04)) * .35;
  float tau = L * (uFogP.x * (1. + L * .02) + uFogP.y * e * (0.35 + 1.35*n));
  float a = 1. - exp(-tau);
  float m = max(dot(rd, uMoonDir), 0.);
  vec3 fc = uFogCol + uFogMoon * (pow(m, 6.) * .34 + pow(m, 40.) * .6 + .06);
  vec3 o = mix(col, fc, a);
#ifdef FOG_GLOWS
  for(int i=0;i<6;i++){ vec3 l = uGlowP[i].xyz - eye; float b = dot(rd,l), c = sqrt(max(dot(l,l)-b*b, .12)); o += uGlowC * uGlowP[i].w * (atan((L-b)/c) + atan(b/c)) / c; }
#endif
  return o;
}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG\ngl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogW, cameraPosition);\n#endif`;
  void tier;
}

/** One depth material per mesh kind: sharing one makes three.js re-resolve its program on every switch. */
export const DEPTH = { still: new THREE.MeshDepthMaterial(), inst: new THREE.MeshDepthMaterial(), skin: new THREE.MeshDepthMaterial() };

export interface SurfOpt { skinned?: boolean; world?: boolean; ash?: number; wet?: number; side?: THREE.Side; /** Per-character: dissolve 0-1 and flash colour + amount. */ fx?: { dis: { value: number }; flash: { value: THREE.Vector4 }; /** Where the flash sits: world position, radius. */ at: { value: THREE.Vector4 }; /** Own ember level instead of the hero's. */ ember?: { value: number }; /** Burning cuts in rest space: centre + heat, and the cut plane's normal. */ wounds?: { w: { value: THREE.Vector4[] }; n: { value: THREE.Vector3[] } }; /** Aura step 0-4: cloth hem and blade catch fire. */ aura?: { value: number } }; /** Glowing cracks between floor slabs. */ rift?: { value: number } }
export interface SurfUniforms { uEmber: { value: number }; uTime: { value: number } }
export const SHARED: SurfUniforms = { uEmber: { value: 0.5 }, uTime: { value: 0 } };

let table: THREE.DataTexture | null = null;
export function surface(tex: TexSet, tier: Tier, o: SurfOpt = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ side: o.side ?? THREE.FrontSide, fog: true });
  const N = MATS.length;
  if (!table) { // material table as a float texture: no per-draw uniform uploads
    const d = new Float32Array(N * 4 * 4);
    MATS.forEach((m, i) => { const a = tex.avg[m.layer]; d.set([...m.tint, m.layer, m.scale, m.keep, m.rough, m.roughTex, m.metal, m.bump, m.edge, m.grime, a.x, a.y, a.z, m.ember], i * 16); });
    table = new THREE.DataTexture(d, 4, N, THREE.RGBAFormat, THREE.FloatType); table.needsUpdate = true;
  }
  const ash = o.ash ?? 0, wet = o.wet ?? 0;
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, FOG, SHARED, { uCol: { value: tex.col }, uNrm: { value: tex.nrm }, uTab: { value: table } }, o.fx ? { uDis: o.fx.dis, uFlash: o.fx.flash, uFlashAt: o.fx.at, ...(o.fx.ember ? { uEmber: o.fx.ember } : {}), ...(o.fx.wounds ? { uWo: o.fx.wounds.w, uWn: o.fx.wounds.n } : {}), ...(o.fx.aura ? { uAura: o.fx.aura } : {}) } : {}, o.rift ? { uRift: o.rift } : {});
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aInfo; uniform highp sampler2D uTab;
varying vec3 vRest, vRestN, vWN; varying vec3 vInf; flat varying vec4 vA, vB, vC, vD; flat varying float vId;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
int id = int(aInfo.w * 255. + .5); vId = float(id); vA = texelFetch(uTab, ivec2(0, id), 0); vB = texelFetch(uTab, ivec2(1, id), 0); vC = texelFetch(uTab, ivec2(2, id), 0); vD = texelFetch(uTab, ivec2(3, id), 0); vInf = aInfo.xyz;
vRest = position; vRestN = normal;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
${o.world ? `{ mat4 mm = modelMatrix;
#ifdef USE_INSTANCING
mm = modelMatrix * instanceMatrix;
vRest = position * length(mm[0].xyz) + mm[3].xyz * 1.37;
#else
vRest = (mm * vec4(position,1.)).xyz; vRestN = normalize(mat3(mm) * normal);
#endif
}` : ''}
vWN = transpose(mat3(viewMatrix)) * normalize(transformedNormal);`);
    const samp = tier.triplanar ? `
  vec3 w = pow(abs(rn), vec3(5.)); w /= (w.x+w.y+w.z);
  vec3 c0 = textureGrad(uCol, vec3(p.zy, ly), dx.zy, dy.zy).rgb, c1 = textureGrad(uCol, vec3(p.xz, ly), dx.xz, dy.xz).rgb, c2 = textureGrad(uCol, vec3(p.xy, ly), dx.xy, dy.xy).rgb;
  vec3 n0 = textureGrad(uNrm, vec3(p.zy, ly), dx.zy, dy.zy).rgb, n1 = textureGrad(uNrm, vec3(p.xz, ly), dx.xz, dy.xz).rgb, n2 = textureGrad(uNrm, vec3(p.xy, ly), dx.xy, dy.xy).rgb;
  vec3 tc = c0*w.x + c1*w.y + c2*w.z; float tr = n0.z*w.x + n1.z*w.y + n2.z*w.z;
  vec2 t0 = n0.xy*2.-1., t1 = n1.xy*2.-1., t2 = n2.xy*2.-1.;
  vec3 g = -(w.x*vec3(0., t0.y, t0.x) + w.y*vec3(t1.x, 0., t1.y) + w.z*vec3(t2.x, t2.y, 0.));` : `
  vec3 an = abs(rn); vec3 w = pow(an, vec3(5.)); float mn = min(w.x, min(w.y, w.z)); w = max(w - mn, 0.); w /= (w.x+w.y+w.z);
  vec3 tc = vec3(0.), g = vec3(0.); float tr = 0.;
  if (w.x > .02) { vec3 c = textureGrad(uCol, vec3(p.zy, ly), dx.zy, dy.zy).rgb, n = textureGrad(uNrm, vec3(p.zy, ly), dx.zy, dy.zy).rgb; tc += c*w.x; tr += n.z*w.x; g -= w.x*vec3(0., n.y*2.-1., n.x*2.-1.); }
  if (w.y > .02) { vec3 c = textureGrad(uCol, vec3(p.xz, ly), dx.xz, dy.xz).rgb, n = textureGrad(uNrm, vec3(p.xz, ly), dx.xz, dy.xz).rgb; tc += c*w.y; tr += n.z*w.y; g -= w.y*vec3(n.x*2.-1., 0., n.y*2.-1.); }
  if (w.z > .02) { vec3 c = textureGrad(uCol, vec3(p.xy, ly), dx.xy, dy.xy).rgb, n = textureGrad(uNrm, vec3(p.xy, ly), dx.xy, dy.xy).rgb; tc += c*w.z; tr += n.z*w.z; g -= w.z*vec3(n.x*2.-1., n.y*2.-1., 0.); }`;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `${tier.glows ? '#define FOG_GLOWS' : ''}
#include <common>
precision highp sampler2DArray; uniform sampler2DArray uCol, uNrm; uniform float uEmber, uTime; ${o.fx ? 'uniform float uDis; uniform vec4 uFlash, uFlashAt;' : ''} ${o.fx?.wounds ? 'uniform vec4 uWo[5]; uniform vec3 uWn[5];' : ''} ${o.fx?.aura ? 'uniform float uAura;' : ''} ${o.rift ? 'uniform float uRift;' : ''}
varying vec3 vRest, vRestN, vWN; varying vec3 vInf; flat varying vec4 vA, vB, vC, vD; flat varying float vId;`)
      .replace('#include <map_fragment>', `
  vec3 rn = normalize(vRestN), p = vRest * vB.x, dx = dFdx(p), dy = dFdy(p); float ly = vA.w;
  ${samp}
  float ao = vInf.x, cv = vInf.y, mk = vInf.z;
  vec3 rel = mix(vec3(dot(tc, vec3(.3,.6,.1)) / dot(vD.xyz, vec3(.3,.6,.1))), tc / vD.xyz, vB.y);
  vec3 alb = vA.rgb * clamp(mix(vec3(1.), rel, vId == 0. || vId == 9. ? .55 : 1.), 0., 3.2);
  vec3 macro = texture(uNrm, vec3(vRest.xz * .043 + vRest.y * .031, 0.)).rgb; float mv = macro.x * .6 + macro.y * .4;
  alb *= .72 + .56 * smoothstep(.3, .7, mv);
  float edge = smoothstep(.53, .85, cv) * vC.z, cav = smoothstep(.5, .2, cv);
  alb *= mix(1., (.25 + .75 * ao) * (1. - .55 * cav), vC.w);
  float rgh = mix(vB.z, clamp(tr + (vB.z - .55), .05, 1.), vB.w), met = vC.x;
  alb = mix(alb, alb * 1.9 + .012, edge * (.55 + .45 * tc.g)); rgh = mix(rgh, rgh * (met > .5 ? .62 : 1.05), edge);
  if (met > .5) { float rust = smoothstep(.42, .7, mv * .55 + cav * .5 + (1. - ao) * .4) * vC.w; alb = mix(alb, vec3(.13,.055,.025) * (.5 + rel), rust * .75); met *= 1. - rust * .8; rgh = mix(rgh, .86, rust); }
  if (vId == 9.) { float bl = smoothstep(.3, .85, mk + (mv - .5) * .7); alb = mix(alb, vec3(.028,.021,.019) * (.6 + .6 * rel), bl); alb = mix(alb, alb * vec3(1.15,.78,.72), cav * .7); rgh = mix(rgh, .36, bl * .7); float ckl = smoothstep(.06, .34, mix(texture(uCol, vec3(vRest.xy * .85, 7.)).g, texture(uCol, vec3(vRest.zy * .85, 7.)).g, smoothstep(.35, .65, abs(rn.x)))); alb *= mix(.58, 1.18, ckl); rgh += (1. - ckl) * .16; float v = smoothstep(.66,.74, texture(uNrm, vec3(vRest.xy * .9, 7.)).x) * .35; alb = mix(alb, alb * vec3(.55,.55,.68), v * (1. - bl)); }
  if (vId == 8.) { alb = mix(vec3(.42,.4,.36), vec3(.02,.012,.008), smoothstep(.0905,.0925, vRest.z)); }
  if (vId == 10.) { alb = mix(alb, vec3(.07,.045,.025), smoothstep(.5, .1, ao)); }
  float up = normalize(vWN).y;
  float dust = ${ash.toFixed(2)} * smoothstep(.25, .9, up + (mv - .5) * .9 - edge * .2) * smoothstep(.15, .7, 1.15 - rel.g * .45);
  alb = mix(alb, vec3(.185,.178,.17) * (.75 + .25 * tc.g), dust); rgh = mix(rgh, .97, dust); met *= 1. - dust;
  ${wet ? `float pud = ${wet.toFixed(2)} * smoothstep(.56, .68, texture(uNrm, vec3(vRest.xz * .021 + .3, 1.)).x * .5 + texture(uNrm, vec3(vRest.xz * .06, 0.)).y * .5 + (1. - ao) * .12) * step(.6, up); alb *= 1. - .55 * pud; rgh = mix(rgh, .09, pud); g *= 1. - .9 * pud;` : ''}
  diffuseColor.rgb = alb;
  float emb = 0.;
  if (vD.w > 0.) { float fl = texture(uNrm, vec3(vRest.xy * 1.7 + vec2(0., uTime * .02), 3.)).x; emb = vD.w * uEmber * smoothstep(.47, .28, cv) * (.35 + .65 * smoothstep(.3, .8, fl)) * (.8 + .2 * sin(uTime * 2.1 + vRest.y * 9.)); }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(rgh, .045, 1.);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = met;')
      .replace('#include <normal_fragment_maps>', `{
  vec3 gg = g * vC.y * (1. - .7 * dust); vec3 sx = dFdx(vViewPosition), sy = dFdy(vViewPosition);
  vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1); float dhx = dot(gg, dFdx(vRest)), dhy = dot(gg, dFdy(vRest));
  vec3 gr = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal + gr * faceDirection * -1.);
}`)
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance += vec3(1.0,.26,.045) * min(emb * emb, 1.6) * 7.; if (vId == 22.) { float q = texture(uNrm, vec3(vRest.xy * 1.3 + vec2(0., -uTime * .22), 3.)).x * .6 + texture(uNrm, vec3(vRest.zy * 2.1 + vec2(uTime * .1, -uTime * .3), 0.)).y * .4; totalEmissiveRadiance += mix(vec3(.9,.06,.008), vec3(1.,.5,.14), smoothstep(.42, .7, q)) * smoothstep(.25, .75, q) * uEmber * 4.; } ${o.fx ? `if (uDis > .001) { vec3 q = vRest * 11.; float nz = texture(uNrm, vec3(vRest.xy * 1.9 + vRest.z, 3.)).x * .6 + texture(uNrm, vec3(vRest.zy * 4.7, 0.)).y * .4; float cut = smoothstep(.25, .75, nz) - uDis * 1.12 + .06; if (cut < 0.) discard; totalEmissiveRadiance += vec3(1., .34, .06) * smoothstep(.14, 0., cut) * 5.; } totalEmissiveRadiance += uFlash.rgb * uFlash.a * exp(-dot(vFogW - uFlashAt.xyz, vFogW - uFlashAt.xyz) / (uFlashAt.w * uFlashAt.w)) * (.06 + .94 * pow(max(0., 1. - abs(dot(normal, normalize(vViewPosition)))), 2.5));` : ''} ${o.fx?.wounds ? `{ float wg = 0.; for (int i = 0; i < 5; i++) { if (uWo[i].w < .01) continue; vec3 q = vRest - uWo[i].xyz; float ps = abs(dot(q, uWn[i]) + (mv - .5) * .05), ln = smoothstep(.34, .12, length(q)); wg = max(wg, uWo[i].w * ln * (smoothstep(.03, .004, ps) + .25 * smoothstep(.1, .0, ps))); } totalEmissiveRadiance += mix(vec3(.8, .05, .005), vec3(1., .5, .14), wg) * wg * wg * 2.8; }` : ''} ${o.fx?.aura ? `if (uAura > 2.2) { float q = texture(uNrm, vec3(vRest.xy * 1.6 + vec2(0., -uTime * .5), 3.)).x * .6 + texture(uNrm, vec3(vRest.zy * 3.1 + vec2(0., -uTime * .9), 0.)).y * .4; float a3 = smoothstep(2.2, 3., uAura), hem = (vId == 5. || vId == 6.) ? smoothstep(.62, .16, vRest.y) : 0.; float bl = vId == 14. ? smoothstep(3.2, 4., uAura) * .55 : 0.; float b = max(hem * a3, bl) * smoothstep(.42, .72, q + hem * .2); totalEmissiveRadiance += mix(vec3(.9, .1, .01), vec3(1., .6, .2), b) * b * b * 4.5; }` : ''} ${o.rift ? `if (uRift > .01) { float q = texture(uNrm, vec3(vRest.xz * .11 + uTime * .01, 3.)).x; totalEmissiveRadiance += vec3(1., .13, .015) * uRift * smoothstep(.75, .2, ao) * smoothstep(.35, .7, q) * (1.4 + .5 * sin(uTime * 1.3 + vRest.x)); }` : ''} if (vId == 8. && mk > .5) totalEmissiveRadiance += vec3(1.,.3,.05) * smoothstep(.0905,.0925,vRest.z) * (.6 + 2. * uEmber);`)
      .replace('#include <aomap_fragment>', `float bao = ao; reflectedLight.indirectDiffuse *= bao; reflectedLight.indirectSpecular *= clamp(bao * bao * 1.3, 0., 1.); reflectedLight.directDiffuse *= mix(1., bao, .45); reflectedLight.directSpecular *= mix(1., bao, .7);`);
  };
  mat.customProgramCacheKey = () => `surf${tier.name}${o.world ? 1 : 0}${ash}${wet}${N}${o.fx ? 'f' : ''}${o.fx?.wounds ? 'w' : ''}${o.fx?.aura ? 'a' : ''}${o.rift ? 'r' : ''}`;
  return mat;
}
