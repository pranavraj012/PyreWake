import * as THREE from 'three';
import { DynamicScale, pickTier } from './core/quality.ts';
import { startLoop } from './core/loop.ts';
import { Input } from './input/input.ts';
import { mountTouch } from './input/touch.ts';
import { loadGeo, loadTextures, useLowLod } from './render/assets.ts';
import { DEPTH, FOG, SHARED, installFog, surface } from './render/surface.ts';
import { makeSky } from './render/sky.ts';
import { Post } from './render/post.ts';
import { Puffs, Sparks } from './render/fx.ts';
import { Bursts } from './render/impact.ts';
import { skinnedShadow } from './render/shadowProxy.ts';
import { PILLARS, buildCourt } from './arena/court.ts';
import { Motor } from './player/motor.ts';
import { BODY_CLIPS } from './player/clips.ts';
import { KHANDA } from './weapons/khanda.ts';
import { Fight } from './combat/fight.ts';
import { Prompts } from './ui/prompts.ts';
import { Hud } from './ui/hud.ts';
import { sound } from './audio/sound.ts';
import { Turn, actionCam } from './game/cinema.ts';
import { ECLIPSE } from './render/sky.ts';
import { Director } from './game/director.ts';
import { PlayerView } from './player/view.ts';
import { KING_CLIPS } from './boss/clips.ts';
import { BENEATH_MODES, KING_MODES } from './boss/king.ts';
import { KingView } from './boss/kingView.ts';
import { FollowCam, INTRO_LEN, introCam } from './game/camera.ts';
import './ui/style.css';

const Q = new URLSearchParams(location.search), SHOT = Q.get('shot'), BENCH = Q.get('bench');
const tier = pickTier();
const app = document.getElementById('app')!, canvas = document.createElement('canvas'); app.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.info.autoReset = false; renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
installFog(tier); if (tier.name !== 'high') useLowLod();

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
  const dpr = Math.min(devicePixelRatio, tier.maxDpr) * dyn.scale, w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(1); renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
  post.resize(Math.round(w * dpr), Math.round(h * dpr)); cam.aspect = w / h; baseFov = w / h > 1.9 ? 42 : 46; cam.fov = baseFov; cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
const input = new Input(canvas);
if (matchMedia('(pointer: coarse)').matches || Q.has('touch')) { document.body.classList.add('touch'); mountTouch(app, input); }
else if (!SHOT && !BENCH) canvas.addEventListener('click', () => { if (!document.pointerLockElement) Promise.resolve(canvas.requestPointerLock()).catch(() => { }); });

const status = (s: string) => { document.getElementById('load')!.textContent = s; };
async function boot() {
  status('Lighting the pyres'); if (!SHOT && !BENCH) sound.load();
  const tex = await loadTextures(tier, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const [court, gPlayer, gPlayerLo, gKing, gKhanda, gCleaver, gRoot, sPlayer, sKing, gBen, sBen] = await Promise.all([buildCourt(tex, tier), loadGeo('player'), loadGeo('player', '.xs'), loadGeo('king'), loadGeo(KHANDA.geo), loadGeo('cleaver'), loadGeo('roots0'), loadGeo('player', tier.name === 'high' ? '.lo' : '.xs'), loadGeo('king', tier.name === 'high' ? '.lo' : '.xs'), loadGeo('beneath'), loadGeo('beneath', tier.name === 'high' ? '.lo' : '.xs')]);
  scene.add(court.group);
  const dis = { value: 0 }, pFlash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }, kFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, none = { value: 0 }, kDis = { value: 0 }, bDis = { value: 0 }, bFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, bAt = { value: new THREE.Vector4(0, 0, 0, 1) }, wounds = () => ({ w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }), kW = wounds(), bW = wounds(), aura = { value: 0 }, bEmber = { value: 0.8 }, pAt = { value: new THREE.Vector4(0, 0, 0, 1) }, kAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  const skin = (d: { value: number }, f: { value: THREE.Vector4 }, at: { value: THREE.Vector4 }, more: object = {}) => surface(tex, tier, { ash: 0.12, fx: { dis: d, flash: f, at, ...more } });
  const pMat = skin(dis, pFlash, pAt, { aura }), pHeld = skin(dis, pFlash, pAt, { aura }), kMat = skin(kDis, kFlash, kAt, { wounds: kW }), kHeld = skin(kDis, kFlash, kAt), bMat = skin(bDis, bFlash, bAt, { wounds: bW, ember: bEmber }), barkMat = surface(tex, tier, { world: true, ash: 0.2 });
  const fx = { sparks: new Sparks(Math.round(900 * tier.particles), tier.particles), gore: new Sparks(Math.round(260 * tier.particles), tier.particles, true), puffs: new Puffs(), bursts: new Bursts() }; scene.add(fx.sparks.mesh, fx.puffs.mesh, fx.gore.mesh, fx.bursts.mesh);
  const pv = new PlayerView(scene, gPlayer, gPlayerLo, gKhanda, pMat, pHeld, DEPTH, fx, tier.name === 'phone' ? 2 : 4, KHANDA); pv.dis = dis; pv.flash = pFlash; pv.flashAt = pAt; pv.aura = aura; void none;
  if (tier.name !== 'phone') { pv.glow = new THREE.PointLight(0xff9450, 1, 6, 1.6); scene.add(pv.glow); }
  const king = new KingView(scene, gKing, gCleaver, gRoot, kMat, kHeld, barkMat, DEPTH, fx); king.flash = kFlash; king.flashAt = kAt; king.wounds = kW; king.dissolve = kDis;
  const beneath = new KingView(scene, gBen, gCleaver, gRoot, bMat, kHeld, barkMat, DEPTH, fx, king.sim, 2); beneath.flash = bFlash; beneath.flashAt = bAt; beneath.wounds = bW; beneath.dissolve = bDis; beneath.ember = bEmber;
  pv.shadow = skinnedShadow(pv.mesh, sPlayer, DEPTH.skin); skinnedShadow(king.mesh, sKing, DEPTH.skin); skinnedShadow(beneath.mesh, sBen, DEPTH.skin); beneath.show(false);
  if (tier.name === 'phone') pv.weapon.castShadow = king.cleaver.castShadow = false;
  const m = new Motor(KHANDA); m.blockers = PILLARS;
  const fight = new Fight(m, king.sim), prompts = new Prompts(), hud = new Hud(app, input); fight.passive = !!(SHOT || BENCH || Q.has('still'));
  const follow = new FollowCam(); follow.blockers = PILLARS;
  const dir = new Director({ f: fight, pv, fx, cam: follow, post, hud, input, camera: cam, views: [king, beneath] }); scene.add(dir.cue.mesh, dir.marks.mesh, dir.crescents.group);
  const turn = new Turn({ f: fight, pv, k1: king, k2: beneath, fx, hud, dis: kDis }); dir.onHalf = () => { turnWait = 0.9; }; let turnWait = -1, omenK = 0, wonT = -1;
  const M0 = new THREE.Color(0xa9c2ea), M1 = new THREE.Color(0xff9a72), F0 = FOG.uFogCol.value.clone(), F1 = new THREE.Color(0.010, 0.0042, 0.0046), G0 = FOG.uFogMoon.value.clone(), G1 = new THREE.Color(0.05, 0.011, 0.007);
  const omen = (k: number) => { if (Math.abs(k - omenK) < 0.002 && k !== 0) return; omenK = k; ECLIPSE.value = k; moon.color.lerpColors(M0, M1, k); moon.intensity = 2.5 - 1.3 * k; post.shaft.value.set(0.5 - 0.24 * k, 0.66 - 0.6 * k, 0.9 - 0.87 * k); FOG.uFogCol.value.lerpColors(F0, F1, k); FOG.uFogMoon.value.lerpColors(G0, G1, k); hemi.color.setRGB(0.56 + 0.04 * k, 0.65 - 0.25 * k, 0.8 - 0.3 * k, THREE.LinearSRGBColorSpace); hemi.intensity = 0.3 + 0.1 * k; kick.intensity = 0.55 + 0.6 * k; kick.color.setRGB(0.86, 0.7 - 0.16 * k, 0.6 - 0.28 * k); court.omen(k); };
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && fight.phase !== 'won' && intro >= INTRO_LEN && !hud.paused && !m.dead) hud.setPaused(true); });
  hud.onRestart = () => { wonT = -1; bDis.value = 0; kDis.value = 0; fight.reset(fight.phase === 'won'); if (fight.round === 1) omen(0); }; for (const e of ['pointerdown', 'keydown', 'touchend']) addEventListener(e, () => { sound.unlock(); sound.startScore(); });
  let t = 0, frames = 0, intro = SHOT || BENCH || Q.has('nointro') ? INTRO_LEN : 0; m.z = intro ? 5.2 : 15.5;
  const bars = (on: boolean) => document.body.classList.toggle('cine', on); bars(!intro);

  if (SHOT?.startsWith('hang')) { king.sim.set('hang'); king.sim.x = 0; king.sim.z = -3.2; }

  const SHOTS: Record<string, [number[], number[], number]> = {
    main: [[1.15, 1.75, 8.9], [-0.1, 1.75, -4], 46], wide: [[9, 4.2, 15], [-1, 2.6, -8], 46], boss: [[1.3, 1.5, 0.4], [0.05, 2.35, -4.2], 46], face: [[0.55, 2.75, -1.6], [0.05, 2.95, -4.2], 40],
    player: [[-1.35, 1.3, 2.7], [0, 0.98, 5.2], 40], playerb: [[1.25, 1.3, 7.6], [0, 1.0, 5.2], 40], head: [[-0.42, 1.68, 4.1], [0, 1.5, 5.2], 32], hang: [[0.8, 1.55, 3.4], [0, 2.0, -3.2], 46], hangc: [[1.1, 1.5, -0.6], [0, 1.9, -3.2], 46],
    pillar: [[10.5, 1.8, 2], [17, 2.2, 5.2], 46], up: [[0, 1.6, -2], [2, 7.5, -20], 60], floor: [[3, 1.1, 3], [3.5, 0, -1], 46],
  };
  /** Triangle bill per mesh, main pass plus shadow pass, for tools/soak.mjs. */
  const bill = () => { const o: [number, string][] = []; scene.traverseVisible(x => { const q = x as THREE.InstancedMesh; if (!q.isMesh) return; const g = q.geometry, n = (g.index?.count ?? g.attributes.position.count) / 3 * (q.isInstancedMesh ? q.count : (g as THREE.InstancedBufferGeometry).instanceCount < 1e6 ? (g as THREE.InstancedBufferGeometry).instanceCount ?? 1 : 1); o.push([n * (q.castShadow ? 2 : 1), `${Math.round(n)}${q.castShadow ? ' x2 (shadow)' : ''}  ${q.type}${q.isInstancedMesh ? ' x' + q.count : ''}`]); }); return o.sort((x, y) => y[0] - x[0]).slice(0, 14).map(x => x[1]); };
  const step = (dt: number) => {
    input.poll(); let ev = input.drain(); let mx = 0, mz = 0;
    if (ev.some(e => e.a === 'pause' && !e.up) && !turn.active && fight.phase !== 'won') hud.setPaused(!hud.paused);
    if (hud.paused) return;
    t += dt; FOG.uFogP.value.w = SHARED.uTime.value = t;
    if (intro < INTRO_LEN) {
      intro += dt; mz = intro < 5.6 ? -0.4 : 0;
      if (intro > 0.4 && ev.some(e => !e.up)) intro = INTRO_LEN;
      if (intro >= INTRO_LEN) { bars(false); follow.yaw = 0.12; }
      ev = [];
    } else { const s = Math.sin(follow.yaw), c = Math.cos(follow.yaw), mv = input.move; mx = mv.x * c - mv.y * s; mz = -mv.x * s - mv.y * c; }
    if (turn.active && ev.some(e => !e.up)) turn.skip();
    const sd = fight.step(dt, mx, mz, ev), kv = dir.kv;
    if (sd > 0) { kv.update(sd, m.x, m.z, t); pv.update(sd, m, t); } else kv.frozen(t);
    if (turnWait > 0 && (turnWait -= dt) <= 0) turn.start();
    turn.step(dt, t); if (turn.active) omen(turn.omen); else if (fight.round === 2 && omenK < 1) omen(1);
    if (fight.phase === 'won') { wonT = wonT < 0 ? 0 : wonT + dt; if (wonT > 6 && wonT - dt <= 6) hud.won(fight); }
    if (sound.score && sound.score.mood === 'still' && intro >= INTRO_LEN && fight.round === 1) sound.score.set('spar'); if (sound.score && sound.score.mood === 'spar' && fight.hits > 2) sound.score.set('r1');
    if (intro >= INTRO_LEN) prompts.step(sd, fight);
    dir.step(sd, dt, t);
  };
  renderer.compile(scene, cam); resize();
  // draw every effect once so the first hit doesn't hitch
  pv.ghosts.warm(true); dir.cue.mesh.visible = true; for (const r of [pv.blade, pv.eye]) r.mesh.visible = true; beneath.show(true); dir.crescents.group.children.forEach(c => { c.visible = true; }); omen(1); post.render(scene, cam, moon, 0); pv.ghosts.warm(false); dir.cue.mesh.visible = false; beneath.show(false); dir.crescents.group.children.forEach(c => { c.visible = false; }); omen(0);
  if (Q.has('round2')) { omen(1); king.show(false); beneath.show(true); fight.beginRound2(); } if (Q.has('turn')) { intro = INTRO_LEN; bars(false); fight.bossHp = 1; fight.hits = 5; fight.passive = true; }
  const { mountBench } = BENCH ? await import('./bench.ts') : { mountBench: null };
  const bench = mountBench?.({ scene, cam, m, pv, king: BENCH === 'beneath' ? beneath : king, clips: { ...KHANDA.clips, ...BODY_CLIPS }, kingClips: KING_CLIPS, modes: BENCH === 'beneath' ? BENEATH_MODES : KING_MODES, which: BENCH!, step, setTime: (v: number) => { t = FOG.uFogP.value.w = SHARED.uTime.value = v; } });
  hud.warm(true); for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 40)); hud.warm(false);
  document.body.classList.add('ready'); if (SHOT || BENCH) document.body.classList.add('bare');
  const fps = document.getElementById('fps')!; let acc = 0, n = 0;
  const draw = (_: number, ms: number) => {
    if (SHOT && SHOTS[SHOT]) { const [p, l, f] = SHOTS[SHOT]; cam.position.set(p[0], p[1], p[2]); cam.lookAt(l[0], l[1], l[2]); cam.fov = f * (cam.aspect > 1.9 ? 0.92 : 1); cam.updateProjectionMatrix(); }
    else if (bench) bench.camera();
    else if (turn.active) turn.camera(cam, t, baseFov);
    else if (intro >= INTRO_LEN && !fight.m.dead && actionCam(cam, fight, dir.heroT, baseFov)) { /* composed shot */ }
    else if (intro < INTRO_LEN) introCam(cam, intro, m.x, m.z, baseFov);
    else follow.update(cam, Math.min(ms / 1000, 0.05), m, { x: king.sim.hx, z: king.sim.hz, solid: !king.sim.hanging && king.sim.y < 0.5, h: king.sim.y * 0.6 + (king.sim.hanging ? 1.7 : king.sim.crawling ? 1.2 : /kneel|fall|crash/.test(king.sim.mode) ? 1.5 : king.sim.form === 2 ? 1.9 : 2.2) }, input.takeLook(), t, baseFov);
    if (!SHOT && !BENCH) hud.update(Math.min(ms / 1000, 0.05), fight, prompts);
    sky.position.copy(cam.position); cam.updateMatrixWorld();
    focus.set(m.x, 0, m.z); court.update(t, focus); sound.listen(cam.position.x * 0.3 + m.x * 0.7, cam.position.z * 0.3 + m.z * 0.7, follow.yaw);
    const c0 = performance.now(); renderer.info.reset(); post.render(scene, cam, moon, t); const cpu = performance.now() - c0;
    acc += ms; n++; frames++;
    if (acc > 500) { fps.textContent = `${Math.round(1000 * n / acc)} fps  ${tier.name}  x${dyn.scale.toFixed(2)}  ${renderer.info.render.calls} draws  ${(renderer.info.render.triangles / 1000) | 0}k tris`; acc = n = 0; }
    if (!SHOT && !BENCH && frames > 60 && dyn.update(ms)) resize();
    Object.assign(window, { __frames: frames, __pos: [m.x, 0, m.z], __info: renderer.info.render, __cpu: cpu, __m: m, __king: king.sim, __pv: pv, __f: fight, __p: prompts, __cam: follow, __turn: turn, __sound: sound, __dir: dir, __camPos: () => cam.position.toArray(), __bill: bill });
  };
  startLoop(dt => { if (!bench) step(dt); else bench.tick(dt); }, draw);
}
boot().catch(e => { console.error(e); status('Could not start: ' + e.message); });
