import * as THREE from 'three';
import { DynamicScale, pickTier } from './core/quality.ts';
import { onViewport, viewport } from './core/viewport.ts';
import { Input } from './input/input.ts';
import { mountTouch } from './input/touch.ts';
import { useLowLod } from './render/assets.ts';
import { FOG, installFog, setScars } from './render/surface.ts';
import { makeSky } from './render/sky.ts';
import { Post } from './render/post.ts';
import { BOSSES } from './bosses/index.ts';
import type { Ctx } from './core/boot.ts';
import './ui/style.css';

const Q = new URLSearchParams(location.search), SHOT = Q.get('shot'), BENCH = Q.get('bench');
const tier = pickTier();
const app = document.getElementById('app')!, canvas = document.createElement('canvas'); app.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.info.autoReset = false; renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
setScars(tier.name === 'phone' ? 6 : 14); installFog(tier); if (tier.name !== 'high') useLowLod();

const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0, 0.01);
const cam = new THREE.PerspectiveCamera(46, 1, 0.12, 500);
const moonDir = new THREE.Vector3(-0.42, 0.44, -0.79).normalize(); FOG.uMoonDir.value.copy(moonDir);
const sky = makeSky(moonDir); scene.add(sky);
const moon = new THREE.DirectionalLight(0xa9c2ea, 2.5); moon.castShadow = true; moon.shadow.mapSize.setScalar(tier.shadow); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.035; moon.shadow.radius = 2.2;
Object.assign(moon.shadow.camera, { left: -27, right: 27, top: 25, bottom: -25, near: 1, far: 110 }); scene.add(moon, moon.target);
const focus = new THREE.Vector3(); moon.position.copy(moonDir).multiplyScalar(55);
const hemi = new THREE.HemisphereLight(0x8fa6cc, 0x2a2018, 0.3); scene.add(hemi);
const kick = new THREE.DirectionalLight(0xdcc8b8, 0.55); kick.position.set(9, 7, 16); scene.add(kick, kick.target); // south pyres, seen from far
{ // environment from our own sky
  const s = new THREE.Scene(), m = makeSky(moonDir); (m.material as THREE.ShaderMaterial).uniforms.uEnv.value = 1; m.material.depthTest = false; s.add(m);
  const p = new THREE.PMREMGenerator(renderer); scene.environment = p.fromScene(s, 0.02, 0.1, 500).texture; scene.environmentIntensity = 1.5; p.dispose();
}
const post = new Post(renderer, tier); post.exposure.value = 1.75;
const dyn = new DynamicScale(tier.minScale); let baseFov = 46;
function resize() {
  const dpr = Math.min(devicePixelRatio, tier.maxDpr) * dyn.scale, { w, h } = viewport();
  renderer.setPixelRatio(1); renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
  post.resize(Math.round(w * dpr), Math.round(h * dpr)); cam.aspect = w / h; baseFov = w / h > 1.9 ? 42 : 46; cam.fov = baseFov; cam.updateProjectionMatrix();
}
onViewport(resize);
const input = new Input(canvas);
if (matchMedia('(pointer: coarse)').matches || Q.has('touch')) { document.body.classList.add('touch'); mountTouch(app, input); }
else if (!SHOT && !BENCH) canvas.addEventListener('click', () => { if (!document.pointerLockElement) Promise.resolve(canvas.requestPointerLock()).catch(() => { }); });

const status = (s: string) => { document.querySelector('#load span')!.textContent = s; };
/** The one Ctx every page boots from: the shared boot's objects (renderer, scene, camera, lights, sky, post, input). */
const ctx: Ctx = { Q, tier, renderer, scene, cam, moon, moonDir, hemi, kick, sky, post, dyn, resize, input, app, baseFov: () => baseFov, focus, status, SHOT, BENCH };
// every boss boots the same way: ?boss=N names the page, and no ?boss= (or an unknown one) is the King
const page = BOSSES.find(b => String(b.n) === Q.get('boss')) ?? BOSSES[0];
page.load().then(b => b(ctx)).catch(e => { console.error(e); status('Could not start: ' + e.message); });
