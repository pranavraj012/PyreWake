// HDR pipeline: scene (MSAA) -> half-res AO -> moon shafts -> bloom chain -> grade.
import * as THREE from 'three';
import type { Tier } from '../core/quality.ts';

const VS = `out vec2 vUv; void main(){ vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(vUv * 2. - 1., 0., 1.); }`;
const pass = (fs: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, unknown> = {}) =>
  new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'precision highp float;\n' + VS, fragmentShader: 'precision highp float; precision highp sampler2D; precision highp sampler2DShadow; in vec2 vUv; out vec4 o;\n' + fs, uniforms, defines, depthTest: false, depthWrite: false });
const rt = (o: Partial<THREE.RenderTargetOptions> = {}) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, ...o });

export class Post {
  scene: THREE.WebGLRenderTarget;
  private aoRT = rt({ type: THREE.UnsignedByteType, format: THREE.RedFormat }); private aoRT2 = rt({ type: THREE.UnsignedByteType, format: THREE.RedFormat });
  private shRT = rt(); private down: THREE.WebGLRenderTarget[] = []; private up: THREE.WebGLRenderTarget[] = [];
  private tri: THREE.Mesh; private cam = new THREE.OrthographicCamera(); private sc = new THREE.Scene();
  private mAO; private mBlur; private mShaft; private mDown; private mUp; private mFin;
  exposure = { value: 1.0 }; desat = { value: 0 }; fade = { value: 0 }; /** Moon shaft colour. */ shaft = { value: new THREE.Vector3(0.5, 0.66, 0.9) }; /** Impact: radial colour split. */ kick = { value: 0 }; /** Edge tint: colour + amount. */ pulse = { value: new THREE.Vector4(0.6, 0.02, 0.01, 0) }; dofAmt = 0;
  w = 4; h = 4;
  private r: THREE.WebGLRenderer; private tier: Tier;

  constructor(r: THREE.WebGLRenderer, tier: Tier) {
    this.r = r; this.tier = tier;
    this.scene = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: tier.msaa, depthBuffer: true, minFilter: THREE.LinearFilter });
    if (tier.ao || tier.shafts) { this.scene.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); g.setDrawRange(0, 3);
    this.tri = new THREE.Mesh(g); this.tri.frustumCulled = false; this.sc.add(this.tri);
    const depthFns = `uniform sampler2D tD; uniform mat4 uIP; vec3 vp(vec2 u){ vec4 p = uIP * vec4(vec3(u, textureLod(tD, u, 0.).r) * 2. - 1., 1.); return p.xyz / p.w; }`;
    this.mAO = pass(`${depthFns} uniform vec2 uPx; uniform float uProj;
float h(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056,.00583715)))); }
void main(){ vec3 p = vp(vUv); if (p.z < -70.) { o = vec4(1.); return; }
 vec3 a = vp(vUv + vec2(uPx.x,0.)) - p, b = p - vp(vUv - vec2(uPx.x,0.)), c = vp(vUv + vec2(0.,uPx.y)) - p, d = p - vp(vUv - vec2(0.,uPx.y));
 vec3 n = normalize(cross(abs(a.z) < abs(b.z) ? a : b, abs(c.z) < abs(d.z) ? c : d));
 float R = .75, sr = min(R * uProj / -p.z, .18), rot = h(gl_FragCoord.xy) * 6.2832, occ = 0.;
 for (int i = 0; i < 12; i++) { float t = (float(i) + .5) / 12., an = rot + float(i) * 2.399963; vec2 u = vUv + vec2(cos(an), sin(an) * uPx.y / uPx.x) * sr * t; vec3 q = vp(u) - p; float l2 = dot(q,q); occ += max(dot(q, n) - .012 * -p.z * .25 - .01, 0.) / (l2 + .02) * smoothstep(R * R * 1.6, 0., l2); }
 o = vec4(clamp(1. - occ * .13, 0., 1.)); }`, { tD: { value: null }, uIP: { value: new THREE.Matrix4() }, uPx: { value: new THREE.Vector2() }, uProj: { value: 1 } });
    this.mBlur = pass(`${depthFns} uniform sampler2D tA; uniform vec2 uDir; void main(){ float z0 = vp(vUv).z, s = 0., w = 0.; for (int i = -3; i <= 3; i++) { vec2 u = vUv + uDir * float(i); float k = exp(-abs(vp(u).z - z0) * 6. / max(1., -z0 * .15)) * exp(-float(i*i) * .12); s += textureLod(tA, u, 0.).r * k; w += k; } o = vec4(s / w); }`, { tD: { value: null }, tA: { value: null }, uIP: { value: new THREE.Matrix4() }, uDir: { value: new THREE.Vector2() } });
    this.mShaft = pass(`${depthFns} uniform sampler2DShadow tS; uniform mat4 uCW, uSM; uniform vec3 uMoon, uCam, uTint; uniform float uT;
float h(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056,.00583715)))); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f); vec2 uv = (i.xy + vec2(37.,17.) * i.z); vec4 k = fract(sin(vec4(dot(uv,vec2(12.98,78.2)), dot(uv+vec2(1,0),vec2(12.98,78.2)), dot(uv+vec2(0,1),vec2(12.98,78.2)), dot(uv+1.,vec2(12.98,78.2)))) * 43758.5); return mix(mix(k.x,k.y,f.x),mix(k.z,k.w,f.x),f.y); }
void main(){ vec3 wp = (uCW * vec4(vp(vUv), 1.)).xyz, rd = wp - uCam; float L = min(length(rd), 48.); rd = normalize(rd); float dt = L / 22., t = dt * h(gl_FragCoord.xy), s = 0.;
 for (int i = 0; i < 22; i++) { vec3 p = uCam + rd * t; vec4 q = uSM * vec4(p, 1.); vec3 c = q.xyz / q.w; float v = (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1. || c.z > 1.) ? 1. : textureLod(tS, vec3(c.xy, c.z - .002), 0.); s += v * exp(-max(p.y, 0.) * .16) * (.45 + .9 * n3(vec3(p.xz * .22 + uT * .06, p.y * .3))) * dt; t += dt; }
 float m = max(dot(rd, uMoon), 0.); o = vec4(uTint * s * (.0009 + .010 * pow(m, 5.)), 1.); }`,
      { tD: { value: null }, tS: { value: null }, uIP: { value: new THREE.Matrix4() }, uCW: { value: new THREE.Matrix4() }, uSM: { value: new THREE.Matrix4() }, uMoon: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() }, uTint: this.shaft, uT: { value: 0 } });
    this.mDown = pass(`uniform sampler2D tA; uniform vec2 uPx; uniform float uFirst; vec3 s(vec2 d){ return min(texture(tA, vUv + d * uPx).rgb, vec3(40.)); }
void main(){ vec3 c = s(vec2(0)) * 4. + s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1)); c = c / 8.; if (uFirst > .5) { float b = max(c.r, max(c.g, c.b)); c *= smoothstep(.55, 2.2, b); } o = vec4(c, 1.); }`, { tA: { value: null }, uPx: { value: new THREE.Vector2() }, uFirst: { value: 0 } });
    this.mUp = pass(`uniform sampler2D tA, tB; uniform vec2 uPx; void main(){ vec3 c = vec3(0.); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += textureLod(tA, vUv + vec2(x,y) * uPx, 0.).rgb * (x == 0 ? 2. : 1.) * (y == 0 ? 2. : 1.); o = vec4(texture(tB, vUv).rgb + c / 16. * .92, 1.); }`, { tA: { value: null }, tB: { value: null }, uPx: { value: new THREE.Vector2() } });
    this.mFin = pass(`uniform sampler2D tA, tB, tO, tH, tD; uniform mat4 uIP; float lz(vec2 u){ vec4 p = uIP * vec4(vec3(u, textureLod(tD, u, 0.).r) * 2. - 1., 1.); return -p.z / p.w; }
uniform float uExp, uT, uDesat, uFade; uniform vec2 uPx; uniform vec4 uPulse; uniform float uKick;
// AgX display transform (polynomial fit), written from the published matrices
vec3 agx(vec3 v){ const mat3 M = mat3(.842479,.0423283,.0423757,.0784336,.878469,.0784336,.0792237,.0791661,.879143); v = M * max(v, vec3(1e-6)); v = clamp((log2(v) + 12.47393) / 16.5, 0., 1.); vec3 a = v*v, b = a*a; v = 15.5*b*a - 40.14*b*v + 31.96*b - 6.868*a*v + .4298*a + .1191*v - .00232; return v; }
vec3 agxO(vec3 v){ const mat3 M = mat3(1.19688,-.0528969,-.0529716,-.0980209,1.1519,-.0980435,-.0990297,-.0989612,1.15107); return clamp(M * v, 0., 1.); }
void main(){ vec3 c = texture(tA, vUv).rgb;
 if (uKick > .01) { vec2 kd = (vUv - .5) * uKick * .014; c.r = texture(tA, vUv + kd).r; c.b = texture(tA, vUv - kd).b; }
#ifdef SHARP
 vec3 bl = (texture(tA, vUv + vec2(uPx.x,0.)).rgb + texture(tA, vUv - vec2(uPx.x,0.)).rgb + texture(tA, vUv + vec2(0.,uPx.y)).rgb + texture(tA, vUv - vec2(0.,uPx.y)).rgb) * .25; c = max(c + (c - bl) * .22 / (1. + dot(c, vec3(1.))), 0.);
#endif
#ifdef AO
 float ao = texture(tO, vUv).r; float lum = dot(c, vec3(.3,.6,.1)); c *= mix(ao, 1., smoothstep(.25, 1.6, lum));
#endif
#ifdef SHAFTS
 { vec2 px = uPx * 4.; vec3 s = vec3(0.); float w = 1e-4, z0 = lz(vUv); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 u = (floor(vUv / px) + .5 + vec2(x, y)) * px; float k = exp(-abs(min(lz(u), 60.) - min(z0, 60.)) / (.3 + z0 * .12)) * exp(-dot(vUv - u, vUv - u) / dot(px, px) * .9); s += textureLod(tH, u, 0.).rgb * k; w += k; } c += s / w; }
#endif
 c += texture(tB, vUv).rgb * .075;
 c *= uExp; vec2 q = vUv - .5; c *= mix(1., smoothstep(.95, .25, length(q * vec2(1.05, 1.))), .55);
 vec3 d = agx(c); float l = dot(d, vec3(.2126,.7152,.0722));
 d = mix(vec3(l), d, 1.22 * (1. - uDesat)); d = pow(max(d, 0.), vec3(1.32)) * 1.06; d = mix(d, d * vec3(.93,1.0,1.1), smoothstep(.45, 0., l) * .6);
 d = agxO(d); d += (fract(sin(dot(gl_FragCoord.xy + uT * 61., vec2(12.9898,78.233))) * 43758.5453) - .5) * .022 * (1. - l);
 d = mix(d, uPulse.rgb, uPulse.a * smoothstep(.3, .85, length(q * vec2(1.1, 1.))));
 o = vec4(mix(d, vec3(0.), uFade), 1.); }`, { tA: { value: null }, tB: { value: null }, tO: { value: null }, tH: { value: null }, tD: { value: null }, uIP: { value: new THREE.Matrix4() }, uExp: this.exposure, uT: { value: 0 }, uDesat: this.desat, uFade: this.fade, uPulse: this.pulse, uKick: this.kick, uPx: { value: new THREE.Vector2() } }, { ...(tier.ao ? { AO: 1 } : {}), ...(tier.shafts ? { SHAFTS: 1 } : {}), ...(tier.name !== 'phone' ? { SHARP: 1 } : {}) });
    for (let i = 0; i < tier.bloomMips; i++) { this.down.push(rt()); if (i < tier.bloomMips - 1) this.up.push(rt()); }
  }
  resize(w: number, h: number) {
    this.w = w; this.h = h; this.scene.setSize(w, h);
    const hw = w >> 1, hh = h >> 1; this.aoRT.setSize(hw, hh); this.aoRT2.setSize(hw, hh); this.shRT.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.down.forEach((t, i) => t.setSize(Math.max(1, hw >> i), Math.max(1, hh >> i))); this.up.forEach((t, i) => t.setSize(Math.max(1, hw >> i), Math.max(1, hh >> i)));
  }
  private blit(m: THREE.RawShaderMaterial, t: THREE.WebGLRenderTarget | null) { this.tri.material = m; this.r.setRenderTarget(t); this.r.render(this.sc, this.cam); }

  render(scene: THREE.Scene, cam: THREE.PerspectiveCamera, moon: THREE.DirectionalLight, time: number) {
    const r = this.r, u = <T>(m: THREE.RawShaderMaterial, k: string, v: T) => { m.uniforms[k].value = v; };
    r.setRenderTarget(this.scene); r.clear(); r.render(scene, cam);
    if (this.tier.ao) {
      const D = this.scene.depthTexture; u(this.mAO, 'tD', D); u(this.mAO, 'uIP', cam.projectionMatrixInverse); u(this.mAO, 'uPx', new THREE.Vector2(1 / this.aoRT.width, 1 / this.aoRT.height)); u(this.mAO, 'uProj', cam.projectionMatrix.elements[0] * 0.5);
      this.blit(this.mAO, this.aoRT);
      u(this.mBlur, 'tD', D); u(this.mBlur, 'uIP', cam.projectionMatrixInverse);
      u(this.mBlur, 'tA', this.aoRT.texture); u(this.mBlur, 'uDir', new THREE.Vector2(1 / this.aoRT.width, 0)); this.blit(this.mBlur, this.aoRT2);
      u(this.mBlur, 'tA', this.aoRT2.texture); u(this.mBlur, 'uDir', new THREE.Vector2(0, 1 / this.aoRT.height)); this.blit(this.mBlur, this.aoRT);
    }
    if (this.tier.shafts && moon.shadow.map) {
      const s = this.mShaft; const dt = (moon.shadow.map.depthTexture ?? moon.shadow.map.texture); u(s, 'tS', dt); u(s, 'tD', this.scene.depthTexture); u(s, 'uIP', cam.projectionMatrixInverse); u(s, 'uCW', cam.matrixWorld); u(s, 'uSM', moon.shadow.matrix); u(s, 'uCam', cam.position); u(s, 'uT', time);
      (s.uniforms.uMoon.value as THREE.Vector3).copy(moon.position).sub(moon.target.position).normalize(); this.blit(s, this.shRT);
    }
    let src: THREE.Texture = this.scene.texture, sw = this.w, sh = this.h;
    this.down.forEach((t, i) => { u(this.mDown, 'tA', src); u(this.mDown, 'uPx', new THREE.Vector2(1 / sw, 1 / sh)); u(this.mDown, 'uFirst', i === 0 ? 1 : 0); this.blit(this.mDown, t); src = t.texture; sw = t.width; sh = t.height; });
    for (let i = this.up.length - 1; i >= 0; i--) { u(this.mUp, 'tA', src); u(this.mUp, 'tB', this.down[i].texture); u(this.mUp, 'uPx', new THREE.Vector2(1 / sw, 1 / sh)); this.blit(this.mUp, this.up[i]); src = this.up[i].texture; sw = this.up[i].width; sh = this.up[i].height; }
    const f = this.mFin; u(f, 'tA', this.scene.texture); u(f, 'tB', src); u(f, 'tO', this.aoRT.texture); u(f, 'tH', this.shRT.texture); u(f, 'tD', this.scene.depthTexture); u(f, 'uIP', cam.projectionMatrixInverse); u(f, 'uT', time % 10); u(f, 'uPx', new THREE.Vector2(1 / this.w, 1 / this.h));
    this.blit(f, null);
  }
}
