// The river from underneath, for the Ferryman's drag: while the hero is held under, the camera goes into this small set (far from the arena, so
// nothing of the arena shows) and looks up at the surface from below: a rippling ceiling of green light with the lamps burning blurred on it, the
// Ferryman's dark shape standing on it with his arm reaching down to the hero's throat, bubbles, and the drowned reaching up from the dark below.
// Everything here is plain unlit shaders (no scene lights), so the page only has to show it, move it with the camera and call update().
import * as THREE from 'three';

/** Where the set stands in the world: far outside the river, so no part of the arena is in view from it. */
export const UNDER = new THREE.Vector3(3000, 0, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const FOGC = '(0.004, 0.032, 0.03)';

/** Murky shading shared by the arms, the hand and the floor: lit from the surface above, swallowed by the green dark with distance. */
function murk(base: THREE.Color, k = 0.2) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: { uBase: { value: base }, uK: { value: k } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uBase; uniform float uK; varying vec3 vN; varying vec3 vW;
void main(){ float d = distance(vW, cameraPosition); float lit = .3 + .7 * clamp(vN.y * .5 + .5, 0., 1.); vec3 fog = vec3${FOGC};
 vec3 c = mix(fog, uBase * lit, exp(-d * uK)); gl_FragColor = vec4(c, 1.); }`,
  });
}

/** The soft round ring of a bubble. */
function dot() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!, r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(210,255,240,0.05)'); r.addColorStop(0.82, 'rgba(220,255,245,0.85)'); r.addColorStop(1, 'rgba(220,255,245,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

/** The baked meshes the set borrows from the page: the Ferryman, one drowned arm, one of the drowned standing. */
export interface UnderGeo { ferry: THREE.BufferGeometry; arm: THREE.BufferGeometry; drowned: THREE.BufferGeometry }
interface Arm { root: THREE.Vector3; rest: THREE.Vector3; ph: number; mesh: THREE.Mesh }
const ARM_H = 2.13;

export class UnderSet {
  readonly group = new THREE.Group();
  private surf: THREE.ShaderMaterial; private bub: THREE.Points; private bp: Float32Array; private bv: Float32Array;
  private arms: Arm[] = []; private rim: THREE.Mesh; private hand: THREE.Group; private fig: THREE.Group; private shafts: THREE.Mesh[] = []; private dead: THREE.Mesh[] = [];
  /** How far the drowned have reached: 0 (below, waiting) to 1 (at his face). */ reach = 0;
  constructor(scene: THREE.Scene, geo: UnderGeo) {
    const g = this.group; g.position.copy(UNDER); g.visible = false; g.frustumCulled = false; scene.add(g);
    // --- the water all round: green dark below, a pale glow overhead
    const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec3 p; void main(){ float h = normalize(p).y; vec3 deep = vec3${FOGC}, mid = vec3(.018, .1, .09), top = vec3(.06, .3, .26); vec3 c = mix(deep, mid, smoothstep(-.9, .1, h)); c = mix(c, top, smoothstep(.15, 1., h)); gl_FragColor = vec4(c, 1.); }`,
    }));
    dome.renderOrder = -10; dome.frustumCulled = false; g.add(dome);
    // --- the surface, seen from below: moving light, the lamps blurred orange, one cold glow for the moon, a ring where he went in
    this.surf = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uR: { value: 0 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT, uR; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){ vec2 q = vW.xz - vec2(${UNDER.x.toFixed(1)}, 0.); float r = length(q);
 vec2 w = q + vec2(n(q * .5 + uT * .35), n(q * .5 - uT * .3 + 9.)) * 2.2 - 1.1; float c = n(w * 1.3 + uT * .5) * .6 + n(w * 3.1 - uT * .8) * .4;
 float ring = exp(-pow((r - uR * 3.2) * 1.3, 2.)) * smoothstep(9., 1., uR) * (.5 + .5 * sin((r - uR * 3.2) * 6.));
 float win = exp(-r * r * .012);
 vec3 col = vec3(.03, .17, .15) * (.3 + c * .9) + vec3(.1, .45, .38) * win * (.2 + c * c * .9) + vec3(.4, 1., .85) * ring * .9;
 for (int i = 0; i < 9; i++) { float a = float(i) * 2.399 + .7, d = 2.2 + float(i) * 1.7; vec2 L = vec2(cos(a), sin(a)) * d + vec2(sin(uT * .6 + float(i)), cos(uT * .5 + float(i) * 2.)) * .35; float k = exp(-dot(q - L, q - L) / (.9 + float(i) * .22)); col += vec3(1., .42, .1) * k * (2.6 + c * 1.5); }
 col += vec3(.5, .8, .9) * exp(-dot(q - vec2(-9., 12.), q - vec2(-9., 12.)) * .02) * .5;
 gl_FragColor = vec4(col * .55, 1.); }`,
    });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), this.surf); surf.frustumCulled = false; surf.renderOrder = -5; g.add(surf);
    // --- the bed far below
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2), murk(new THREE.Color(0.05, 0.1, 0.09), 0.08)); floor.position.y = -7.5; floor.frustumCulled = false; g.add(floor);
    // --- shafts of the lamps' and moon's light going down through the water
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + (i % 3) * 0.8, 9), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0.12 + (i % 2) * 0.06 } },
        vertexShader: `varying vec2 u; void main(){ u = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uA; varying vec2 u; void main(){ float a = smoothstep(0., .5, u.x) * smoothstep(1., .5, u.x) * u.y * u.y; gl_FragColor = vec4(vec3(.25, .9, .75) * a * uA, 1.); }`,
      }));
      m.position.set(Math.cos(i * 1.7) * 6, -4.4, Math.sin(i * 1.7) * 6); m.rotation.y = i * 1.1; m.rotation.z = 0.12 * (i % 3 - 1); m.frustumCulled = false; this.shafts.push(m); g.add(m);
    }
    // --- him: a dark shape standing on the water, hat, cloak, pole; and the arm he reaches down with, ending in a hand at the hero's throat
    // his baked body, its arms let down, drawn as a dark shape that shows through the surface
    const black = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying float rim; void main(){ vec3 p = position; float w = smoothstep(.35, .6, abs(p.x)), sd = sign(p.x), dx = abs(p.x) - .4, dy = p.y - 2.55, f = -1.35;
 vec3 q = vec3(sd * (.4 + dx * cos(f) - dy * sin(f)), 2.55 + dx * sin(f) + dy * cos(f), p.z); p = mix(p, q, w); rim = 0.; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.); }`,
      fragmentShader: `varying float rim; void main(){ gl_FragColor = vec4(.008, .028, .024, .93); }`,
    });
    this.fig = new THREE.Group(); const body = new THREE.Mesh(geo.ferry, black); body.scale.setScalar(0.8); body.renderOrder = 6; body.frustumCulled = false; this.fig.add(body);
    this.fig.position.set(0, 0.05, 0); g.add(this.fig);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 4.6, 6), new THREE.MeshBasicMaterial({ color: 0x010605, transparent: true, opacity: 0.93, depthTest: false, fog: false })); pole.position.set(1.2, 2.3, 0.1); pole.renderOrder = 6; this.fig.add(pole);
    const blackM = new THREE.MeshBasicMaterial({ color: 0x010605, transparent: true, opacity: 0.94, depthTest: false, fog: false });
    this.rim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1, 8), blackM); this.rim.renderOrder = 6; this.rim.frustumCulled = false; g.add(this.rim);
    this.hand = new THREE.Group();
    const skin = murk(new THREE.Color(0.55, 0.6, 0.57), 0.1);
    this.hand.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8).scale(1, 0.55, 1.1), skin));
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 8).translate(0, 0.1, 0), skin); f.position.set((i - 1.5) * 0.045, 0.02, 0.1); f.rotation.x = 1.3; this.hand.add(f); }
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.17, 8).translate(0, 0.085, 0), skin); th.position.set(-0.11, 0, 0.02); th.rotation.set(1.1, 0, 1.2); this.hand.add(th);
    this.hand.traverse(o => { o.renderOrder = 7; o.frustumCulled = false; }); g.add(this.hand);
    // --- the drowned: their baked arms reaching up from the bed, and three of them standing far down in the dark
    const flesh = murk(new THREE.Color(0.24, 0.36, 0.32), 0.2);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.39996 + 0.4, d = 1.6 + (k % 4) * 0.8, root = V(Math.cos(a) * d * 1.3, -7.5, Math.sin(a) * d * 1.3), rest = V(Math.cos(a) * d * 0.9, -2.8 - (k % 3) * 0.9, Math.sin(a) * d * 0.9);
      const mesh = new THREE.Mesh(geo.arm, flesh); mesh.frustumCulled = false; g.add(mesh); this.arms.push({ root, rest, ph: k * 1.3, mesh });
    }
    const gone = murk(new THREE.Color(0.12, 0.2, 0.18), 0.16);
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(geo.drowned, gone); m.scale.setScalar(2.1); m.position.set(Math.cos(k * 2.2 + 1) * 6, -7.2, Math.sin(k * 2.2 + 1) * 6 - 2); m.rotation.y = k * 2; m.frustumCulled = false; g.add(m); this.dead.push(m); }
    // --- bubbles
    const N = 170; this.bp = new Float32Array(N * 3); this.bv = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.bp.set([(Math.random() - 0.5) * 9, -Math.random() * 7, (Math.random() - 0.5) * 9], i * 3); this.bv[i] = 0.5 + Math.random() * 1.6; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(this.bp, 3));
    this.bub = new THREE.Points(bg, new THREE.PointsMaterial({ map: dot(), size: 0.075, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x88ddc8, opacity: 0.8 }));
    this.bub.frustumCulled = false; g.add(this.bub);
  }
  show(on: boolean) { this.group.visible = on; }
  /** A burst of bubbles round the lens, as he goes under (the eye is in the set's own coordinates). */
  burst(eye: THREE.Vector3) { const n = this.bv.length; for (let i = 0; i < 70; i++) { const j = (Math.random() * n) | 0; this.bp.set([eye.x - UNDER.x + (Math.random() - 0.5) * 1.4, eye.y - 0.3 - Math.random() * 1.2, eye.z + (Math.random() - 0.5) * 1.4], j * 3); this.bv[j] = 1.4 + Math.random() * 1.6; } }
  /** One frame: `t` seconds since he went under, the camera's eye and the point it looks at (both world), and how long the frame was. */
  update(t: number, dt: number, eye: THREE.Vector3, at: THREE.Vector3) {
    this.surf.uniforms.uT.value = t; this.surf.uniforms.uR.value = Math.min(9, t);
    const ex = eye.x - UNDER.x, ey = eye.y, ez = eye.z;
    this.fig.position.set(0.3, 0.05 + 0.04 * Math.sin(t * 2.1), 0.2); this.fig.rotation.set(0.3 + 0.05 * Math.sin(t * 1.3), 0.4, 0.04 * Math.sin(t * 1.7));
    // his hand: in the lower middle of the view, at the throat; the arm goes from it up through the surface to his shoulder
    const basis = new THREE.Matrix4().lookAt(V(ex, ey, ez), V(at.x - UNDER.x, at.y, at.z), V(0, 1, 0)), rx = V().setFromMatrixColumn(basis, 0), ry = V().setFromMatrixColumn(basis, 1), rz = V().setFromMatrixColumn(basis, 2);
    const hp = V(ex, ey, ez).addScaledVector(rz, -0.85).addScaledVector(ry, -0.46).addScaledVector(rx, 0.06);
    this.hand.position.copy(hp); this.hand.quaternion.setFromRotationMatrix(basis); this.hand.rotateX(-0.5); this.hand.scale.setScalar(1.15);
    const sh = V(0.45, 2.2, 0.25), mid = hp.clone().sub(sh), len = mid.length(); this.rim.position.copy(sh).addScaledVector(mid, 0.5); this.rim.scale.set(1, len, 1); this.rim.quaternion.setFromUnitVectors(V(0, 1, 0), mid.clone().normalize());
    // the drowned
    const em = Math.min(1, Math.max(0, (t - 0.25) / 1.3));
    for (const a of this.arms) {
      const k = Math.max(0, Math.min(1, this.reach * 1.2 - (a.ph % 1) * 0.25)), sw = Math.sin(t * 1.1 + a.ph) * 0.3, ang = Math.PI + Math.sin(a.ph * 2.1) * 1.2, far = 1.3 + (a.ph % 1.7) * 0.6, hh = 3.0 + (a.ph % 1.3) * 1.2;
      const F = V(ex + Math.sin(ang) * far, ey + hh * (0.4 + 0.6 * em) - 4.5 * (1 - em), ez + Math.cos(ang) * far), N = V(ex + Math.sin(ang) * 0.55, ey + 0.7 + (a.ph % 0.8), ez + Math.cos(ang) * 0.7);
      const tip = F.lerp(N, k * 0.85); tip.x += sw; tip.z += Math.cos(t * 0.9 + a.ph) * 0.3;
      const d = tip.clone().sub(a.root), len = d.length() || 1; d.divideScalar(len); d.x += Math.sin(t * 0.8 + a.ph * 2) * 0.12; d.z += Math.cos(t * 0.7 + a.ph) * 0.12; d.normalize();
      a.mesh.position.copy(a.root); a.mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d); a.mesh.scale.set(3.2, len / ARM_H, 3.2);
    }
    this.dead.forEach((m, i) => { m.position.y = -7.2 + 0.25 * Math.sin(t * 0.4 + i) + 0.4 * Math.min(1, t / 3); m.rotation.y += dt * 0.1; });
    // bubbles rise and wrap
    const n = this.bv.length; for (let i = 0; i < n; i++) { this.bp[i * 3 + 1] += this.bv[i] * dt; this.bp[i * 3] += Math.sin(t * 2 + i) * 0.1 * dt; if (this.bp[i * 3 + 1] > 0) { this.bp[i * 3 + 1] = -7 - Math.random() * 2; this.bp[i * 3] = ex + (Math.random() - 0.5) * 8; this.bp[i * 3 + 2] = ez + (Math.random() - 0.5) * 8; } }
    (this.bub.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    for (let i = 0; i < this.shafts.length; i++) this.shafts[i].rotation.y += dt * 0.05 * (i % 2 ? 1 : -1);
  }
}
