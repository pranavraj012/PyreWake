import * as THREE from 'three';
import { DynamicScale, pickTier } from './core/quality.ts';
import { startLoop } from './core/loop.ts';
import { onViewport, viewport } from './core/viewport.ts';
import { regainFullscreen } from './core/fullscreen.ts';
import { Input } from './input/input.ts';
import { mountTouch } from './input/touch.ts';
import { loadGeo, loadTextures, useLowLod } from './render/assets.ts';
import { DEPTH, FOG, RIM, SHARED, installFog, setScars, surface } from './render/surface.ts';
import { makeSky } from './render/sky.ts';
import { Post } from './render/post.ts';
import { Dust, Puffs, Sparks } from './render/fx.ts';
import { Bursts } from './render/impact.ts';
import { skinnedShadow } from './render/shadowProxy.ts';
import { buildCourt } from './bosses/king/court.ts';
import { Motor } from './player/motor.ts';
import { BODY_CLIPS } from './player/clips.ts';
import { KHANDA } from './weapons/khanda.ts';
import { Fight } from './combat/fight.ts';
import { Prompts } from './ui/prompts.ts';
import { Hud } from './ui/hud.ts';
import { Menu } from './ui/menu.ts';
import { padNav } from './ui/padnav.ts';
import { sound } from './audio/sound.ts';
import { onSettings, saveSettings, settings } from './core/settings.ts';
import { DEFAULT_SPELLS, SPELLS } from './combat/spells.ts';
import { Turn, actionCam } from './bosses/king/cinema.ts';
import { Ending, Intro, Prologue, kingMoments } from './bosses/king/scenes.ts';
import { RewardRun, beginReward, syncReward, type RewardKit } from './game/rewardShots.ts';
import { rideBeats, rideSpec, ropeBeats, ropeSpec } from './bosses/king/kingRewards.ts';
import { Moment, Offer, Prompt, offerSpec, type MomentSpec } from './game/moment.ts';
import { KING_LESSON, KING_LINES, KING_PRESS } from './bosses/king/kingScript.ts';
import { Lessons } from './bosses/king/lessons.ts';
import { DAWN, ECLIPSE } from './render/sky.ts';
import { Director } from './game/director.ts';
import { PlayerView } from './player/view.ts';
import { KING_CLIPS } from './bosses/king/clips.ts';
import { BENEATH_MODES, KING_MODES } from './bosses/king/king.ts';
import { KingView } from './bosses/king/kingView.ts';
import { FollowCam, menuCam } from './game/camera.ts';
import { mountTheatre } from './dev/theatre.ts';
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
async function boot() {
  status('Lighting the pyres'); if (!SHOT && !BENCH) sound.load();
  const tex = await loadTextures(tier, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const [court, gPlayer, gPlayerLo, gKing, gKhanda, gCleaver, gRoot, sPlayer, sKing, gBen, sBen] = await Promise.all([buildCourt(tex, tier), loadGeo('player'), loadGeo('player', '.xs'), loadGeo('king'), loadGeo(KHANDA.geo), loadGeo('cleaver'), loadGeo('roots0'), loadGeo('player', tier.name === 'high' ? '.lo' : '.xs'), loadGeo('king', tier.name === 'high' ? '.lo' : '.xs'), loadGeo('beneath'), loadGeo('beneath', tier.name === 'high' ? '.lo' : '.xs')]);
  scene.add(court.group);
  const dis = { value: 0 }, pFlash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }, kFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, none = { value: 0 }, kDis = { value: 0 }, bDis = { value: 0 }, bFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, bAt = { value: new THREE.Vector4(0, 0, 0, 1) }, wounds = () => ({ w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } }), kW = wounds(), bW = wounds(), aura = { value: 0 }, bEmber = { value: 0.8 }, pAt = { value: new THREE.Vector4(0, 0, 0, 1) }, kAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  const skin = (d: { value: number }, f: { value: THREE.Vector4 }, at: { value: THREE.Vector4 }, more: object = {}) => surface(tex, tier, { ash: 0.12, fx: { dis: d, flash: f, at, ...more } });
  const pMat = skin(dis, pFlash, pAt, { aura }), pHeld = skin(dis, pFlash, pAt, { aura }), kMat = skin(kDis, kFlash, kAt, { wounds: kW }), kHeld = skin(kDis, kFlash, kAt), bMat = skin(bDis, bFlash, bAt, { wounds: bW, ember: bEmber }), barkMat = surface(tex, tier, { world: true, ash: 0.2 });
  const fx = { sparks: new Sparks(Math.round(900 * tier.particles), tier.particles), gore: new Sparks(Math.round(260 * tier.particles), tier.particles, true), puffs: new Puffs(), bursts: new Bursts() }; const dust = new Dust(tier.name === 'phone' ? 40 : 110); scene.add(fx.sparks.mesh, fx.puffs.mesh, fx.gore.mesh, fx.bursts.mesh, dust.mesh); court.ruin.fx = fx; court.ruin.dust = dust;
  const pv = new PlayerView(scene, gPlayer, gPlayerLo, gKhanda, pMat, pHeld, DEPTH, fx, tier.name === 'phone' ? 2 : 4, KHANDA); pv.dis = dis; pv.flash = pFlash; pv.flashAt = pAt; pv.aura = aura; void none;
  if (tier.name !== 'phone') { pv.glow = new THREE.PointLight(0xff9450, 1, 6, 1.6); scene.add(pv.glow); }
  const king = new KingView(scene, gKing, gCleaver, gRoot, kMat, kHeld, barkMat, DEPTH, fx); king.flash = kFlash; king.flashAt = kAt; king.wounds = kW; king.dissolve = kDis;
  const beneath = new KingView(scene, gBen, gCleaver, gRoot, bMat, kHeld, barkMat, DEPTH, fx, king.sim, 2); beneath.flash = bFlash; beneath.flashAt = bAt; beneath.wounds = bW; beneath.dissolve = bDis; beneath.ember = bEmber;
  pv.shadow = skinnedShadow(pv.mesh, sPlayer, DEPTH.skin); skinnedShadow(king.mesh, sKing, DEPTH.skin); skinnedShadow(beneath.mesh, sBen, DEPTH.skin); beneath.show(false);
  if (tier.name === 'phone') pv.weapon.castShadow = king.cleaver.castShadow = false;
  const m = new Motor(KHANDA);
  const fight = new Fight(m, king.sim), prompts = new Prompts(), hud = new Hud(app, input); fight.furnish(court.ruin.props); fight.passive = !!(SHOT || BENCH || Q.has('still'));
  const follow = new FollowCam(); follow.blockers = m.blockers;
  // staged moments (src/game/moment.ts): the grab always plays out and holds the hero; the reward is the hero's, offered as a press while the chance lasts
  const moment = new Moment(), qte = new Prompt(app), kSpecs = { ...kingMoments(king.sim, m) } as Record<'noose' | 'rope' | 'ride', MomentSpec>;
  /** The King's staged moments' cues (scenes.ts names them): the sound, the dust, the shake, the words. */
  const kingCue = (name: string) => {
    const L = king.sim.landAt;
    if (name === 'seize') { sound.play('kBreath', { gain: 0.9, wet: 0.7, bus: 'voice' }); sound.play('armsClench', { gain: 0.7, x: m.x, z: m.z }); hud.verse(KING_LINES.seized); }
    // the struggle: a muffled breath and a strain, from the throat
    else if (name === 'lift') { sound.play('kBreath', { gain: 0.6, wet: 0.95, bus: 'voice', rate: 0.75, x: m.x, z: m.z }); sound.play('kGrunt', { gain: 0.5, wet: 0.6, bus: 'voice', x: king.sim.x, z: king.sim.z }); }
    else if (name === 'swing') { sound.play('creak', { gain: 0.7, wet: 0.8, x: king.sim.x, z: king.sim.z }); sound.play('whooshB', { gain: 0.8, x: king.sim.x, z: king.sim.z }); }
    else if (name === 'throw') { sound.play('whooshH', { gain: 0.9, x: m.x, z: m.z }); sound.play('groan', { gain: 0.6, x: king.sim.x, z: king.sim.z }); hud.verse(''); }
    else if (name === 'rise') sound.play('breathIn', { gain: 0.6, wet: 0.6, bus: 'voice', x: m.x, z: m.z });
    else if (name === 'land') { sound.play('slam', { gain: 0.9, x: L.x, z: L.z }); sound.play('thud', { gain: 0.9, x: L.x, z: L.z }); fx.puffs.emit(new THREE.Vector3(L.x, 0, L.z), 18, 2.6, 1.4, t); fx.bursts.add('ground', new THREE.Vector3(L.x, 0.06, L.z), 9, 0.9, t, 0, 0.7, 0.3, 0.1); moment.kick(0.9); }
  }; let staged: 'noose' | 'rope' | 'ride' | null = null; let heroHid = false, dimOn = false;
  const kOffer = new Offer(moment, offerSpec(m, () => ({ x: king.sim.hx, y: king.sim.hanging ? 4.2 : 1.9, z: king.sim.hz, tilt: king.sim.hanging ? 60 : undefined, back: king.sim.hanging ? 3.6 : undefined })), (r, secs) => qte.show('attack', KING_PRESS[r as 'rope' | 'ride'], secs, input.lastDevice));
  const rKit: RewardKit = { fx, kick: s => moment.kick(s), king }, rewardRun = new RewardRun(rKit); Object.assign(kSpecs, { ride: rideSpec(king.sim, m, rKit, rewardRun), rope: ropeSpec(king.sim, m, rKit, rewardRun) });
  const dir = new Director({ f: fight, pv, fx, cam: follow, post, hud, input, camera: cam, views: [king, beneath], court }); scene.add(dir.cue.mesh, dir.marks.mesh, dir.crescents.group);
  const kit = { f: fight, pv, k1: king, k2: beneath, fx, hud }, turn = new Turn(kit, kDis), intro = new Intro(kit), ending = new Ending(kit), story = new Prologue(kit, court.fires), lessons = new Lessons(fight); turn.onEnd = () => follow.snap(m, king.sim); dir.onWon = () => { saveSettings({ beaten: settings.beaten | 1 }); ending.start(); }; hud.next = 'On to the river'; hud.onNext = () => { location.search = '?boss=2'; }; const arm = () => { const sp = lessons.active ? DEFAULT_SPELLS : settings.spells; m.spells = [...sp]; hud.spells(SPELLS[sp[0]], SPELLS[sp[1]]); prompts.spells(SPELLS[sp[0]], SPELLS[sp[1]]); }; onSettings(() => { fight.brain.temper = settings.temper; arm(); }); dir.onHalf = () => { turnWait = 0.9; if (Q.has('turn')) fight.passive = false; }; let turnWait = -1, omenK = 0, dawnK = 0, turned = false;
  const M0 = new THREE.Color(0xa9c2ea), M1 = new THREE.Color(0xff9a72), F0 = FOG.uFogCol.value.clone(), F1 = new THREE.Color(0.010, 0.0042, 0.0046), G0 = FOG.uFogMoon.value.clone(), G1 = new THREE.Color(0.05, 0.011, 0.007);
  const omen = (k: number) => { if (Math.abs(k - omenK) < 0.002 && k !== 0) return; omenK = k; ECLIPSE.value = k; moon.color.lerpColors(M0, M1, k); moon.intensity = 2.5 - 1.3 * k; post.shaft.value.set(0.5 - 0.24 * k, 0.66 - 0.6 * k, 0.9 - 0.87 * k); FOG.uFogCol.value.lerpColors(F0, F1, k); FOG.uFogMoon.value.lerpColors(G0, G1, k); hemi.color.setRGB(0.56 + 0.04 * k, 0.65 - 0.25 * k, 0.8 - 0.3 * k, THREE.LinearSRGBColorSpace); hemi.intensity = 0.3 - 0.04 * k; RIM.value.set(0.36 + 0.54 * k, 0.45 - 0.17 * k, 0.6 - 0.48 * k, 1.25 + 0.35 * k); dust.tint.value.set(0.17 + 0.05 * k, 0.175 - 0.02 * k, 0.19 - 0.07 * k); court.omen(k); dawn(dawnK, true); };
  /** First light, over whatever the sky is doing. */
  const dawn = (k: number, force = false) => { if (!force && Math.abs(k - dawnK) < 0.002) return; dawnK = k; const o = omenK; kick.intensity = 0.55 + 0.2 * o + 1.5 * k; kick.color.setRGB(0.86 + 0.1 * k, 0.7 - 0.16 * o, 0.6 - 0.28 * o - 0.1 * k); hemi.intensity = 0.3 - 0.04 * o + 0.3 * k; post.exposure.value = 1.75 + 0.25 * k; DAWN.value = k; };
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !menu.open && !turn.active && fight.phase !== 'won' && !intro.active && !story.active && !ending.active && !hud.paused && !m.dead) hud.setPaused(true); });
  /** The one reset: every death, the retry, the menu and a fresh start run it (Fight resets the fight, this clears the page). */
  fight.onReset = () => { moment.reset(); staged = null; qte.hide(); kOffer.reset(); king.sim.clearMoments(); ending.stop(); turn.stop(); prompts.reset(); dawn(0); turnWait = -1; bDis.value = kDis.value = 0; dimOn = false; hud.verse(''); if (fight.round === 1) omen(0); sound.score?.set(fight.round === 2 ? 'r2' : 'spar'); };
  hud.onRestart = () => { if (lessons.active) { train(); return; } fight.reset(fight.phase === 'won'); }; for (const e of ['pointerdown', 'keydown', 'touchend']) addEventListener(e, () => { sound.unlock(); sound.startScore(); });
  const direct = !!(SHOT || BENCH || Q.has('nointro') || Q.has('turn') || Q.has('round2')); let t = 0, frames = 0; m.z = direct ? 5.2 : 15.5;
  const direct0 = !!(SHOT || BENCH);
  const bars = (on: boolean) => document.body.classList.toggle('cine', on); 
  const menu = new Menu(app, () => hud.controls()), still = fight.passive; menu.fights([['The Hanged King', null], ['The Ferryman', () => { location.search = '?boss=2'; }], ['The Sister of Hours', () => { location.search = '?boss=3'; }]]);
  /** Back to the very start: the court at night, the hero at the gate. */
  const toMenu = () => { hud.setPaused(false); moment.stop(); staged = null; qte.hide(); king.sim.clearMoments(); if (lessons.active) { lessons.active = false; lessons.frozen = null; } hud.lesson(null); hud.verse(''); ending.stop(); dawn(0); turnWait = -1; bDis.value = kDis.value = 0; fight.reset(true); fight.passive = true; prompts.reset(); omen(0); m.revive(0, 12.2, Math.PI); pv.reset(); bars(false); intro.kneel(); king.settle(); follow.yaw = 0.12; sound.score?.set('still'); menu.show(); };
  hud.onMenu = toMenu; hud.onResume = regainFullscreen;
  // put down mid-fight: wait
  document.addEventListener('visibilitychange', () => { if (document.hidden && !menu.open && !turn.active && !intro.active && !story.active && !ending.active && fight.phase !== 'won' && !direct0) hud.setPaused(true); });
  const grab = () => { input.drain(); if (matchMedia('(pointer: fine)').matches && !document.body.classList.contains('touch')) Promise.resolve(canvas.requestPointerLock()).catch(() => { }); };
  /** Round 1, for real. */
  const begin = () => { bars(false); hud.lesson(null); fight.reset(true); fight.passive = still; kDis.value = bDis.value = 0; follow.snap(m, king.sim); hud.refill(); sound.score?.set('spar'); };
  const train = () => { lessons.active = true; arm(); bars(false); fight.passive = true; hud.callout(''); lessons.start(); follow.snap(m, king.sim); sound.score?.set('lesson'); };
  lessons.onDone = skipped => { lessons.active = false; arm(); saveSettings({ learned: true }); if (!skipped) prompts.taught(); begin(); sound.play('kScreech', { gain: 0.9, wet: 0.6, bus: 'voice' }); hud.say(skipped ? KING_LESSON.skipped : KING_LESSON.taught, 2.6, 'place'); };
  addEventListener('gamepaddisconnected', () => { if (input.lastDevice === 'pad' && !menu.open && !turn.active && !intro.active && !story.active && !ending.active && fight.phase !== 'won') hud.setPaused(true); });
  hud.onSkip = () => lessons.skip(); menu.onTrain = () => { train(); grab(); };
  menu.onPlay = () => { regainFullscreen(); story.start(); bars(true); fight.time = 0; grab(); };

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
    if (padNav(input)) ev = ev.filter(e => e.a === 'pause' && !menu.open);
    if (ev.some(e => e.a === 'pause' && !e.up) && !turn.active && !intro.active && !story.active && fight.phase !== 'won') hud.setPaused(!hud.paused);
    if (hud.paused) return;
    const pace = turn.active ? turn.rate : moment.active ? moment.rate(king.sim.stage) : 1; t += dt * pace; FOG.uFogP.value.w = SHARED.uTime.value = t;
    if (menu.open) intro.kneel();
    else if (story.active) {
      if (story.t > 0.6 && ev.some(e => !e.up)) story.skip(); else story.step(dt, t);
      court.flames(story.flame); omen(story.omen); dir.mono = story.mono; dir.inkWant = story.ink; dir.dark = story.dark;
      if (!story.active) { court.flames(1); omen(0); dir.inkWant = dir.dark = 0; intro.start(); }
      ev = [];
    } else if (intro.active) {
      if (intro.t > 0.6 && ev.some(e => !e.up)) intro.skip(); else mz = intro.step(dt, t);
      if (!intro.active) { if (settings.learned) begin(); else train(); }
      ev = [];
    } else { const s = Math.sin(follow.yaw), c = Math.cos(follow.yaw), mv = input.move; mx = mv.x * c - mv.y * s; mz = -mv.x * s - mv.y * c; }
    if (turn.active && ev.some(e => !e.up)) turn.skip(); if (ending.active && !ending.over && ev.some(e => !e.up)) ending.skip();
    if (lessons.active) ev = lessons.gate(ev as { a: string; up: boolean }[]) as typeof ev;
    // a reward press (only while its chance lasts) starts the hero's scene; a staged moment has the hero, not the player
    qte.step(dt); if (qte.on && ev.some(e => e.a === 'attack' && !e.up) && king.sim.takeReward()) qte.hide();
    if (moment.active) mx = mz = 0; // the fight drops his presses while a moment is on, and keeps the releases
    const held = lessons.active && !!lessons.frozen, sd = held ? 0 : fight.step(dt * pace, mx, mz, ev), kv = dir.kv; if (held) fight.ev.length = 0;
    // a reward scene: the hero's clip runs on the scene's clock, and its beats (the blows) fire on the frame they land
    if (king.sim.rite) { if (rewardRun.kind !== king.sim.rite) { beginReward(king.sim.rite, m); rewardRun.begin(king.sim.rite); } syncReward(m, king.sim.stage); if (king.sim.rite === 'ride') rideBeats(king.sim, m, rKit, rewardRun, king.sim.stage, t); else ropeBeats(king.sim, m, rKit, rewardRun, king.sim.stage, t); } else if (rewardRun.kind) { rewardRun.end(m); }
    { const want = king.sim.staging; if (want !== staged) { staged = want; if (want) { qte.hide(); moment.start(kSpecs[want]); } else moment.stop(); } }
    // a staged moment's cues: its sound, its dust, its shake; and its letterbox (the bars slide in and out by themselves)
    for (const name of moment.due(king.sim.stage)) kingCue(name);
    document.body.classList.toggle('letter', moment.letterbox);
    // a reward on offer: the slow low shot, then the press (plain English), until the chance lapses
    kOffer.step(dt, king.sim.reward, king.sim.rewardLeft, king.sim.staging !== null);
    pv.tumble = moment.hero(king.sim.stage, pv.offset);
    // first person: the hero's own body and eye glow are out of the lens; a dim (a flash, a fall) goes over the picture
    if (heroHid !== moment.hideHero) { heroHid = moment.hideHero; pv.group.visible = pv.eye.mesh.visible = pv.blade.mesh.visible = !heroHid; }
    if (sd > 0) { kv.update(sd, m.x, m.z, t); pv.update(sd, m, t); } else kv.frozen(t);
    lessons.step(dt, sd); hud.lesson(lessons.active ? lessons.card : null);
    if (turnWait > 0 && (turnWait -= dt) <= 0) turn.start();
    turn.step(dt, t); ending.step(dt, t); if (!story.active) dir.mono = Math.max(turn.mono, lessons.mono); if (turn.active) { omen(turn.omen); dawn(turn.dawn); court.flames(turn.flame); post.exposure.value = (1.75 + 0.25 * turn.dawn) * turn.dim + turn.flash * (settings.flash ? 3.2 : 0.6); dir.dark = turn.dark; turned = true; } else if (turned) { turned = false; court.flames(1); dir.dark = 0; post.exposure.value = 1.75; } else if (ending.active) { omen(1 - ending.clear); dawn(ending.dawn); } else if (fight.round === 2 && omenK < 1) omen(1);
    if (sound.score && /^(still|vigil|lesson)$/.test(sound.score.mood) && !menu.open && !intro.active && !story.active && !turn.active && !lessons.active && fight.round === 1) sound.score.set('spar'); if (sound.score && (story.active || intro.active)) sound.score.set('vigil'); if (sound.score && lessons.active) sound.score.set('lesson'); if (sound.score && sound.score.mood === 'spar' && fight.hits > 2) sound.score.set('r1');
    { const c = m.clip?.name, on = (c === 'rites' && m.t < 4.4) || c === 'finale'; if (on !== document.body.classList.contains('cut')) document.body.classList.toggle('cut', on); }
    if (!menu.open && !intro.active && !story.active && !lessons.active && !moment.active && !qte.on) prompts.step(sd, fight); else if (moment.active || qte.on) prompts.current = null;
    court.ruin.step(sd, t, [{ x: m.x, z: m.z, r: m.y > 0.6 ? -9 : 0.35, push: 1 + m.speed * 0.25 }, { x: king.sim.x, z: king.sim.z, r: king.sim.y > 0.6 || king.sim.hanging ? -9 : 0.8, push: 3.2 }]); follow.blockers = m.blockers;
    court.storm(fight.round === 2 && fight.phase !== 'won' ? (fight.brain.style === 'eclipse' ? 1 : 0.3) : 0); post.heat.value = omenK * 0.8;
    { const md = moment.dimAt(king.sim.stage); if (md > 0 || dimOn) { dir.dark = md; dimOn = md > 0; } }
    dir.step(sd, dt, t);
    // the attack's red cue sits at the hand, which is at the lens in first person: it goes while the moment plays
    if (moment.hideHero) dir.cue.mesh.visible = false;
  };
  renderer.compile(scene, cam); resize();
  // draw every effect once so the first hit doesn't hitch
  court.ruin.warm(true); pv.ghosts.warm(true); dir.cue.mesh.visible = true; for (const r of [pv.blade, pv.eye]) r.mesh.visible = true; beneath.show(true); dir.crescents.group.children.forEach(c => { c.visible = true; }); omen(1); post.render(scene, cam, moon, 0); court.ruin.warm(false); pv.ghosts.warm(false); dir.cue.mesh.visible = false; beneath.show(false); dir.crescents.group.children.forEach(c => { c.visible = false; }); omen(0);
  if (Q.has('round2')) { omen(1); king.show(false); beneath.show(true); fight.beginRound2(); } if (Q.has('turn')) { bars(false); fight.bossHp = 1; fight.hits = 5; fight.passive = true; }
  const { mountBench } = BENCH ? await import('./bench.ts') : { mountBench: null };
  const bench = mountBench?.({ scene, cam, m, pv, king: BENCH === 'beneath' ? beneath : king, clips: { ...KHANDA.clips, ...BODY_CLIPS }, kingClips: KING_CLIPS, modes: BENCH === 'beneath' ? BENEATH_MODES : KING_MODES, which: BENCH!, step, setTime: (v: number) => { t = FOG.uFogP.value.w = SHARED.uTime.value = v; } });
  hud.warm(true); for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 40)); hud.warm(false);
  if (!direct) { m.revive(0, 12.2, Math.PI); pv.reset(); fight.passive = true; intro.kneel(); king.settle(); bars(false); menu.show(); }
  document.body.classList.toggle('fps', Q.has('fps')); document.body.classList.add('ready'); if (SHOT || BENCH) document.body.classList.add('bare');
  const fps = document.getElementById('fps')!; let acc = 0, n = 0;
  const draw = (_: number, ms: number) => {
    if (story.active || intro.active || turn.active || ending.active || menu.open) follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6); // the follow camera isn't there to settle it
    if (SHOT && SHOTS[SHOT]) { const [p, l, f] = SHOTS[SHOT]; cam.position.set(p[0], p[1], p[2]); cam.lookAt(l[0], l[1], l[2]); cam.fov = f * (cam.aspect > 1.9 ? 0.92 : 1); cam.updateProjectionMatrix(); }
    else if (bench) bench.camera();
    else if (menu.open) menuCam(cam, t, m.x, m.z);
    else if (turn.active) turn.camera(cam, t);
    else if (ending.active) ending.camera(cam, t);
    else if (story.active) story.camera(cam, t);
    else if (intro.active) intro.camera(cam, t, baseFov);
    else if (moment.active && moment.camera(cam, Math.min(ms / 1000, 0.05), king.sim.stage, t)) { /* a staged moment's shot */ }
    else if (!fight.m.dead && actionCam(cam, fight, dir.heroT, baseFov)) { /* composed shot */ follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6); }
    else follow.update(cam, Math.min(ms / 1000, 0.05), m, { x: king.sim.hx, z: king.sim.hz, solid: !king.sim.hanging && king.sim.y < 0.5, h: king.sim.y * 0.6 + (king.sim.hanging ? 1.7 : king.sim.crawling ? 1.2 : /kneel|fall|crash/.test(king.sim.mode) ? 1.5 : king.sim.form === 2 ? 1.9 : 2.2) }, input.takeLook(), t, baseFov);
    moment.settle(cam, Math.min(ms / 1000, 0.05));
    if (!SHOT && !BENCH && !menu.open) hud.update(Math.min(ms / 1000, 0.05), fight, prompts);
    { const fz = cam.userData.focus as THREE.Vector3 | undefined, film = menu.open || turn.active || ending.active || story.active || intro.active, on = film || cam.userData.frame === true, want = on && fz ? (menu.open ? 0.4 : film ? 0.8 : 0.6) : 0; cam.userData.frame = false; post.dof.amt += (want - post.dof.amt) * (want && post.dof.amt < 0.02 ? 1 : Math.min(1, ms / 90)); if (fz) post.dof.focus = Math.max(0.5, fz.distanceTo(cam.position)); }
    sky.position.copy(cam.position); cam.updateMatrixWorld();
    focus.set(m.x, 0, m.z); court.update(t, focus); sound.listen(cam.position.x * 0.3 + m.x * 0.7, cam.position.z * 0.3 + m.z * 0.7, follow.yaw);
    const c0 = performance.now(); renderer.info.reset(); post.render(scene, cam, moon, t); const cpu = performance.now() - c0;
    acc += ms; n++; frames++;
    if (acc > 500) { fps.textContent = `${Math.round(1000 * n / acc)} fps  ${tier.name}  x${dyn.scale.toFixed(2)}  ${renderer.info.render.calls} draws  ${(renderer.info.render.triangles / 1000) | 0}k tris`; acc = n = 0; }
    if (!SHOT && !BENCH && frames > 60 && dyn.update(ms)) resize();
    Object.assign(window, { __frames: frames, __pos: [m.x, 0, m.z], __info: renderer.info.render, __cpu: cpu, __m: m, __court: court, __king: king.sim, __pv: pv, __f: fight, __p: prompts, __cam: follow, __turn: turn, __intro: intro, __story: story, __lessons: lessons, __hud: hud, __ending: ending, __sound: sound, __dir: dir, __camPos: () => cam.position.toArray(), __bill: bill, __moment: moment, __qte: qte, __kOffer: kOffer, __menu: menu, __post: post, __FOG: FOG, __moon: moon, __hemi: hemi, __kick: kick });
  };
  // ?moment=<name> (and, in dev with ?dev, the moment theatre panel): see src/dev/theatre.ts
  mountTheatre({ Q, boss: 'king', ctx: () => ({ fight, m, sim: king.sim, round2: () => { omen(1); king.show(false); beneath.show(true); fight.beginRound2(); }, halfway: () => dir.onHalf() }), reset: () => { hud.onRestart(); fight.reset(true); king.show(true); beneath.show(false); omen(0); } }).boot();
  startLoop(dt => { if (!bench) step(dt); else bench.tick(dt); }, draw);
}
/** Each fight past the first has its own page, loaded only when asked for. */
const PAGES: Record<string, () => Promise<(c: import('./core/boot.ts').Ctx) => Promise<void>>> = { '2': () => import('./bosses/river/page.ts').then(r => r.bootRiver), '3': () => import('./bosses/hours/page.ts').then(r => r.bootHours) };
const page = PAGES[Q.get('boss') ?? ''];
(page ? page().then(b => b({ Q, tier, renderer, scene, cam, moon, moonDir, hemi, kick, sky, post, dyn, resize, input, app, baseFov: () => baseFov, focus, status, SHOT, BENCH })) : boot()).catch(e => { console.error(e); status('Could not start: ' + e.message); });
