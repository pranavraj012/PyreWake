// The second fight: the Ferryman and the Weight on the river ghats. Entered from main.ts with ?boss=2; the same referee, director, hero and interface, a different place and body.
import * as THREE from 'three';
import { regainFullscreen } from './core/fullscreen.ts';
import { onSettings, saveSettings, settings } from './core/settings.ts';
import { DEFAULT_SPELLS, SPELLS } from './combat/spells.ts';
import type { Ctx } from './core/boot.ts';
import { startLoop } from './core/loop.ts';
import { loadGeo, loadTextures } from './render/assets.ts';
import { DEPTH, FOG, SHARED, surface } from './render/surface.ts';
import { LINE } from './render/sky.ts';
import { RIVER_NAMES, RIVER_PRESS } from './game/riverScript.ts';
import { Moment, Offer, Prompt, offerSpec, type MomentSpec } from './game/moment.ts';
import { Dust, Puffs, Sparks } from './render/fx.ts';
import { Bursts } from './render/impact.ts';
import { skinnedShadow } from './render/shadowProxy.ts';
import { buildGhats } from './arena/ghats.ts';
import { Motor } from './player/motor.ts';
import { KHANDA } from './weapons/khanda.ts';
import { BODY_CLIPS } from './player/clips.ts';
import { Fight } from './combat/fight.ts';
import { Prompts } from './ui/prompts.ts';
import { Hud } from './ui/hud.ts';
import { Menu } from './ui/menu.ts';
import { padNav } from './ui/padnav.ts';
import { sound } from './audio/sound.ts';
import { PlayerView } from './player/view.ts';
import { Director } from './game/director.ts';
import { FollowCam, menuCam } from './game/camera.ts';
import { actionCam } from './game/cinema.ts';
import { DRAG, River } from './boss/river/river.ts';
import { dragSpec, dragUnder } from './boss/river/dragShot.ts';
import { RiverBrain } from './boss/river/brain.ts';
import { RiverView } from './boss/river/riverView.ts';
import { RiverDirector } from './boss/river/riverDirector.ts';
import { RiverIntro, RiverEnding, RiverTurn, riverMoments } from './game/riverScenes.ts';
import { RewardRun, beginReward, chainBeats, lanternBeats, riverRewards, syncReward, type RewardKit } from './game/rewardShots.ts';

export type { Ctx };

export async function bootRiver(c: Ctx) {
  const { Q, tier, renderer, scene, cam, moon, moonDir, hemi, kick, post, dyn, resize, input, app, focus, status, SHOT } = c;
  status('Lighting the river'); if (!SHOT) sound.load();
  const tex = await loadTextures(tier, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const lod = tier.name === 'high' ? '.lo' : '.xs';
  const [ghats, gPlayer, gPlayerLo, gKhanda, gFerry, sFerry, gPole, gAnchor, gBoat, gLantern, gArm, gBare, sBare, sPlayer, gDrowned] = await Promise.all([buildGhats(tex, tier, moonDir), loadGeo('player'), loadGeo('player', '.xs'), loadGeo(KHANDA.geo), loadGeo('ferryman'), loadGeo('ferryman', lod), loadGeo('pole'), loadGeo('anchor'), loadGeo('boat'), loadGeo('lantern'), loadGeo('arm'), loadGeo('ferryman2'), loadGeo('ferryman2', lod), loadGeo('player', lod), loadGeo('drowned')]);
  scene.add(ghats.group); LINE.value = 1; FOG.uGlowP.value.forEach((g, i) => { const l = ghats.ruin.lamps[i]; if (l) g.set(l.p.x, l.p.y + 0.4, l.p.z, 0.0042); else g.set(0, 0, 0, 0); }); FOG.uFogCol.value.setRGB(0.008, 0.016, 0.026); FOG.uFogMoon.value.setRGB(0.05, 0.075, 0.1); FOG.uFogP.value.x = 0.0065; moon.intensity = 2.0; post.exposure.value = 1.85;
  const dis = { value: 0 }, pFlash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }, pAt = { value: new THREE.Vector4(0, 0, 0, 1) }, aura = { value: 0 };
  const wounds = () => ({ w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) } });
  const skin = (d: { value: number }, f: { value: THREE.Vector4 }, at: { value: THREE.Vector4 }, more: object = {}) => surface(tex, tier, { ash: 0.04, fx: { dis: d, flash: f, at, ...more } });
  const pMat = skin(dis, pFlash, pAt, { aura }), pHeld = skin(dis, pFlash, pAt, { aura }), held = surface(tex, tier, { world: false, ash: 0.04 }), wood = surface(tex, tier, { world: false, ash: 0.02 });
  const fx = { sparks: new Sparks(Math.round(900 * tier.particles), tier.particles), gore: new Sparks(Math.round(260 * tier.particles), tier.particles, true), puffs: new Puffs(), bursts: new Bursts() }; const dust = new Dust(tier.name === 'phone' ? 40 : 110); scene.add(fx.sparks.mesh, fx.puffs.mesh, fx.gore.mesh, fx.bursts.mesh, dust.mesh); ghats.ruin.fx = fx; ghats.ruin.dust = dust;
  const pv = new PlayerView(scene, gPlayer, gPlayerLo, gKhanda, pMat, pHeld, DEPTH, fx, tier.name === 'phone' ? 2 : 4, KHANDA); pv.dis = dis; pv.flash = pFlash; pv.flashAt = pAt; pv.aura = aura;
  if (tier.name !== 'phone') { pv.glow = new THREE.PointLight(0xff9450, 1, 6, 1.6); scene.add(pv.glow); }
  const sim = new River(), brain = new RiverBrain(), m = new Motor(KHANDA), fight = new Fight(m, sim, brain), prompts = new Prompts(), hud = new Hud(app, input); fight.furnish(ghats.ruin.props); fight.passive = !!(SHOT || Q.has('still'));
  const fMat = skin({ value: 0 }, { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, { value: new THREE.Vector4(0, 0, 0, 1) }), geo = { boat: gBoat, body: gFerry, pole: gPole, anchor: gAnchor, lantern: gLantern, arm: gArm, drowned: gDrowned }, mats = { skin: fMat, held, wood };
  const v1 = new RiverView(scene, geo, mats, DEPTH, fx, sim, 1).withWater(ghats), v2 = new RiverView(scene, { ...geo, body: gBare }, mats, DEPTH, fx, sim, 2).withWater(ghats); v2.oldGeo = gFerry;
  for (const v of [v1, v2]) { v.mesh.material = skin({ value: 0 }, v.flash, v.flashAt, { wounds: v.wounds, ember: v.ember }) }
  if (tier.name !== 'phone') { v1.light = new THREE.PointLight(0xffa860, 16, 14, 1.7); scene.add(v1.light); }
  pv.shadow = skinnedShadow(pv.mesh, sPlayer, DEPTH.skin); skinnedShadow(v1.mesh, sFerry, DEPTH.skin); skinnedShadow(v2.mesh, sBare, DEPTH.skin); v2.show(false);
  if (tier.name === 'phone') pv.weapon.castShadow = v1.cleaver.castShadow = false;
  const follow = new FollowCam(); follow.blockers = m.blockers;
  // staged moments (src/game/moment.ts): the grab always plays out and holds the hero; the reward is the hero's, offered as a press while the chance lasts
  const moment = new Moment(), qte = new Prompt(app), rSpecs = { ...riverMoments(sim, m) } as Record<'drag' | 'chain' | 'lantern', MomentSpec>, dSpec = dragSpec(sim, m), under = document.createElement('div'); let staged: 'drag' | 'chain' | 'lantern' | null = null, dragK = 0;
  // the reward on offer: the slow low shot by the hero's feet, then the press; the drag's own beats: the pull under, the bite, the heave
  under.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:1;background:radial-gradient(ellipse at 50% 45%, rgba(40,92,72,0.18), rgba(8,36,28,0.8))'; app.appendChild(under);
  const kOffer = new Offer(moment, offerSpec(m, () => ({ x: sim.x, y: 2.2, z: sim.z })), (r, secs) => qte.show('attack', RIVER_PRESS[r as 'chain' | 'lantern'], secs, input.lastDevice));
  const dir = new Director({ f: fight, pv, fx, cam: follow, post, hud, input, camera: cam, views: [v1, v2], court: ghats }); scene.add(dir.cue.mesh, dir.marks.mesh, dir.crescents.group);
  const rd = new RiverDirector(dir, fight, ghats, v1, v2, post, hud); hud.names = [RIVER_NAMES.r1, RIVER_NAMES.r2]; hud.winTitle = RIVER_NAMES.won; onSettings(() => { brain.temper = settings.temper; const sp = settings.spells; m.spells = [...sp]; hud.spells(SPELLS[sp[0]], SPELLS[sp[1]]); prompts.spells(SPELLS[sp[0]], SPELLS[sp[1]]); });
  const rKit: RewardKit = { fx, kick: s => moment.kick(s), river: v1 }, rewardRun = new RewardRun(rKit); Object.assign(rSpecs, riverRewards(sim, m, rKit, rewardRun));
  const kit = { f: fight, pv, k1: v1, k2: v2, fx, hud, ghats, rd, prompt: qte }, intro = new RiverIntro(kit), turn = new RiverTurn(kit), ending = new RiverEnding(kit); dir.onHalf = () => { turnWait = 0.9; if (Q.has('turn')) fight.passive = false; }; dir.onWon = () => { saveSettings({ beaten: settings.beaten | 3 }); ending.start(); }; let turnWait = -1, t = 0, frames = 0;
  turn.onEnd = () => follow.snap(m, sim); const direct = !!(SHOT || Q.has('nointro') || Q.has('turn') || Q.has('round2')); m.z = direct ? 5.2 : 15.5;
  hud.onRestart = () => { moment.stop(); staged = null; qte.hide(); ending.stop(); turn.stop(); rd.reset(); turnWait = -1; fight.reset(fight.phase === 'won'); sound.score?.set(fight.round === 2 ? 'weight' : 'row'); };
  for (const e of ['pointerdown', 'keydown', 'touchend']) addEventListener(e, () => { sound.unlock(); sound.startScore(); });
  // a phone has no buttons in the scenes: a tap anywhere lights the boat when the scene is waiting for it
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { if (ending.waiting) ending.tap(t); if (intro.waiting) intro.tap(t); } });
  const bars = (on: boolean) => document.body.classList.toggle('cine', on), menu = new Menu(app, () => hud.controls());
  menu.fights([['The Hanged King', () => { location.search = ''; }], ['The Ferryman', null], ['The Sister of Hours', () => { location.search = '?boss=3'; }]]);
  const toMenu = () => { hud.setPaused(false); moment.stop(); staged = null; qte.hide(); hud.verse(''); ending.stop(); turn.stop(); rd.reset(); turnWait = -1; fight.reset(true); fight.passive = true; prompts.reset(); m.revive(0, 12.2, Math.PI); pv.reset(); bars(false); intro.stop(); v1.settle(); follow.yaw = 0.12; sound.score?.set('still'); menu.show(); };
  hud.onMenu = toMenu; hud.onResume = regainFullscreen; hud.next = ''; hud.onSkip = () => { };
  document.addEventListener('visibilitychange', () => { if (document.hidden && !menu.open && !intro.active && !turn.active && !ending.active && fight.phase !== 'won' && !SHOT) hud.setPaused(true); });
  addEventListener('gamepaddisconnected', () => { if (input.lastDevice === 'pad' && !menu.open && !intro.active && !turn.active && !ending.active && fight.phase !== 'won') hud.setPaused(true); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !menu.open && !intro.active && !turn.active && !ending.active && fight.phase !== 'won' && !hud.paused && !m.dead) hud.setPaused(true); });
  const grab = () => { input.drain(); if (matchMedia('(pointer: fine)').matches && !document.body.classList.contains('touch')) Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => { }); };
  const begin = () => { bars(false); fight.reset(true); fight.passive = !!Q.has('still'); rd.reset(); follow.snap(m, sim); hud.refill(); sound.score?.set('row'); };
  menu.onPlay = () => { regainFullscreen(); intro.start(); bars(true); fight.time = 0; grab(); }; menu.onTrain = () => { location.search = '?train'; };
  intro.onEnd = () => { begin(); };
  const bill = () => { const o: [number, string][] = []; scene.traverseVisible(x => { const q = x as THREE.InstancedMesh; if (!q.isMesh) return; const g = q.geometry, n = (g.index?.count ?? g.attributes.position.count) / 3 * (q.isInstancedMesh ? q.count : (g as THREE.InstancedBufferGeometry).instanceCount < 1e6 ? (g as THREE.InstancedBufferGeometry).instanceCount ?? 1 : 1); o.push([n * (q.castShadow ? 2 : 1), `${Math.round(n)}${q.castShadow ? ' x2 (shadow)' : ''}  ${q.type}${q.isInstancedMesh ? ' x' + q.count : ''}`]); }); return o.sort((x, y) => y[0] - x[0]).slice(0, 14).map(x => x[1]); };

  const step = (dt: number) => {
    input.poll(); let ev = input.drain(); let mx = 0, mz = 0;
    if (padNav(input)) ev = ev.filter(e => e.a === 'pause' && !menu.open);
    if (ev.some(e => e.a === 'pause' && !e.up) && !turn.active && !intro.active && fight.phase !== 'won') hud.setPaused(!hud.paused);
    if (hud.paused) return;
    const pace = turn.active ? turn.rate : moment.active ? moment.rate(sim.stage) : 1; t += dt * pace; FOG.uFogP.value.w = SHARED.uTime.value = t;
    if (menu.open) { /* the hero kneels at the water */ }
    else if (intro.active) { intro.press(ev, t); mz = intro.active ? intro.step(dt, t, input.lastDevice) : 0; ev = []; }
    else { const s = Math.sin(follow.yaw), cc = Math.cos(follow.yaw), mv = input.move; mx = mv.x * cc - mv.y * s; mz = -mv.x * s - mv.y * cc; }
    if (turn.active && ev.some(e => !e.up)) turn.skip(); if (ending.active) { ending.press(ev, t); if (ending.waiting) ev = []; }
    // a reward press (only while its chance lasts) starts the hero's scene; a staged moment has the hero, not the player
    qte.step(dt); if (qte.on && ev.some(e => e.a === 'attack' && !e.up)) { const rr = sim.takeReward(); if (rr) { qte.hide(); beginReward(rr, m); rewardRun.begin(rr); } }
    if (moment.active) { ev = []; mx = mz = 0; }
    const sd = fight.step(dt * pace, mx, mz, ev), kv = dir.kv;
    // a reward scene: the hero's clip runs on the scene's clock, and its beats (the shatter, the snap) fire on the frame they land
    if (sim.rite) { syncReward(m, sim.stage); if (sim.rite === 'lantern') lanternBeats(sim, m, rKit, rewardRun, sim.stage, t); else chainBeats(sim, rKit, rewardRun, sim.stage, t); } else if (rewardRun.kind) rewardRun.end();
    { const want = sim.staging; if (want !== staged) { staged = want; dragK = 0; if (want) { qte.hide(); moment.start(want === 'drag' ? dSpec : rSpecs[want]); } else moment.stop(); } }
    // the drag's beats, on the boss's clock: a groan as he is pulled under, the bite, and a slam as he is heaved onto the steps
    // under the water: a green wash over the view, and bubbles rising from him while he is held down
    under.style.opacity = String(sim.held === 'drag' ? dragUnder(sim.stage) : 0);
    if (sim.held === 'drag' && sim.stage > DRAG.under && sim.stage < DRAG.heave) { for (let q = 0; q < 2; q++) fx.sparks.emit(new THREE.Vector3(m.x + (Math.random() - 0.5) * 0.8, -0.4 - Math.random() * 1.4, m.z + (Math.random() - 0.5) * 0.8), new THREE.Vector3(0, 1, 0), 2, 0.5, 0.04, 1.4, t); }
    if (sim.held === 'drag') { const beats = [DRAG.under, DRAG.dmg, DRAG.heave]; while (dragK < 3 && sim.stage >= beats[dragK]) { if (dragK === 0) sound.play('groan', { gain: 0.6, x: sim.x, z: sim.z }); else if (dragK === 1) { sound.play('doom', { gain: 0.8 }); moment.kick(0.7); } else { sound.play('slam', { gain: 0.8, x: sim.x, z: sim.z }); moment.kick(0.6); } dragK++; } }
    document.body.classList.toggle('letter', moment.letterbox || sim.held === 'drag');
    kOffer.step(dt, sim.reward, sim.rewardLeft, sim.staging !== null);
    pv.tumble = moment.hero(sim.stage, pv.offset);
    if (sim.held === 'drag' && sim.stage >= 0.55 && sim.stage < 0.62) fx.sparks.emit(new THREE.Vector3(m.x, 0.2, m.z), new THREE.Vector3(0, 1, 0), 40, 4, 1.2, 0.5, t);
    if (sd > 0) { kv.update(sd, m.x, m.z, t); pv.update(sd, m, t); } else kv.frozen(t);
    if (turnWait > 0 && (turnWait -= dt) <= 0) turn.start();
    turn.step(dt, t); ending.step(dt, t, input.lastDevice); rd.step(sd, dt, t); if (!intro.active) dir.mono = Math.max(turn.mono, 0);
    if (!menu.open && !intro.active && !moment.active && !qte.on) prompts.step(sd, fight); else if (moment.active || qte.on) prompts.current = null;
    ghats.ruin.step(sd, t, [{ x: m.x, z: m.z, r: m.y > 0.6 ? -9 : 0.35, push: 1 + m.speed * 0.25 }, { x: sim.x, z: sim.z, r: sim.y > 0.6 ? -9 : 0.8, push: 3.2 }]); follow.blockers = m.blockers;
    dir.step(sd, dt, t);
  };
  renderer.compile(scene, cam); resize();
  ghats.ruin.warm(true); pv.ghosts.warm(true); dir.cue.mesh.visible = true; for (const r of [pv.blade, pv.eye]) r.mesh.visible = true; v2.show(true); dir.crescents.group.children.forEach(x => { x.visible = true; }); post.render(scene, cam, moon, 0); ghats.ruin.warm(false); pv.ghosts.warm(false); dir.cue.mesh.visible = false; v2.show(false); dir.crescents.group.children.forEach(x => { x.visible = false; });
  if (Q.has('round2')) { v1.show(false); v2.show(true); sim.form = 2; fight.beginRound2(); rd.round2(true); } if (Q.has('turn')) { bars(false); fight.bossHp = 1; fight.hits = 5; fight.passive = true; }
  hud.warm(true); for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 40)); hud.warm(false);
  if (!direct) { m.revive(0, 12.2, Math.PI); pv.reset(); fight.passive = true; bars(false); menu.show(); intro.rest(); }
  document.body.classList.toggle('fps', Q.has('fps')); document.body.classList.add('ready'); if (SHOT) document.body.classList.add('bare');
  const fps = document.getElementById('fps')!; let acc = 0, n = 0;
  const SHOTS: Record<string, [number[], number[], number]> = { main: [[1.15, 1.75, 8.9], [-0.1, 1.5, -4], 46], wide: [[10, 4.5, 14], [-1, 1.8, -6], 46], boss: [[2.2, 1.5, 0.2], [0, 1.9, -4.2], 42], bossc: [[1.2, 1.9, -1.4], [0, 2.1, -4.1], 36], face: [[0.7, 2.4, -2.1], [0, 2.4, -4.0], 34], side: [[5.5, 1.7, -3.5], [0, 1.6, -4], 42], back: [[-1.5, 2.2, -8.5], [0, 1.8, -4], 44], up: [[0, 1.4, 1], [0, 6, -14], 60], weight: [[8, 3.2, 8], [0, 1.8, -5], 52], horizon: [[0, 1.6, 12], [0, 0.8, -60], 50], lamps: [[3, 0.7, 6], [4, 0.2, -20], 40] };
  const draw = (_: number, ms: number) => {
    if (intro.active || turn.active || ending.active || menu.open) follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6);
    const SC = (window as unknown as { __shotCam?: [number[], number[], number] }).__shotCam ?? (SHOT ? SHOTS[SHOT] : undefined); if (SC) { const [pp, ll, ff] = SC; cam.position.set(pp[0], pp[1], pp[2]); cam.lookAt(ll[0], ll[1], ll[2]); cam.fov = ff * (cam.aspect > 1.9 ? 0.92 : 1); cam.updateProjectionMatrix(); }
    else if (menu.open) menuCam(cam, t, m.x, m.z);
    else if (turn.active) turn.camera(cam, t);
    else if (ending.active) ending.camera(cam, t);
    else if (intro.active) intro.camera(cam, t, c.baseFov());
    else if (moment.active && moment.camera(cam, Math.min(ms / 1000, 0.05), sim.stage, t)) { /* a staged moment's shot */ }
    else if (!fight.m.dead && actionCam(cam, fight, dir.heroT, c.baseFov())) { follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6); }
    else follow.update(cam, Math.min(ms / 1000, 0.05), m, { x: sim.hx, z: sim.hz, solid: sim.form === 1 && sim.y < 0.5, h: sim.form === 2 ? 2.1 : 1.7 + sim.y * 0.6 }, input.takeLook(), t, c.baseFov());
    moment.settle(cam, Math.min(ms / 1000, 0.05));
    if (!SHOT && !menu.open) hud.update(Math.min(ms / 1000, 0.05), fight, prompts);
    { const fz = cam.userData.focus as THREE.Vector3 | undefined, film = menu.open || turn.active || ending.active || intro.active, on = film || cam.userData.frame === true, want = on && fz ? (menu.open ? 0.4 : film ? 0.8 : 0.6) : 0; cam.userData.frame = false; post.dof.amt += (want - post.dof.amt) * (want && post.dof.amt < 0.02 ? 1 : Math.min(1, ms / 90)); if (fz) post.dof.focus = Math.max(0.5, fz.distanceTo(cam.position)); }
    c.sky.position.copy(cam.position); cam.updateMatrixWorld();
    focus.set(m.x, 0, m.z); ghats.update(t, focus); sound.listen(cam.position.x * 0.3 + m.x * 0.7, cam.position.z * 0.3 + m.z * 0.7, follow.yaw);
    const c0 = performance.now(); renderer.info.reset(); post.render(scene, cam, moon, t); const cpu = performance.now() - c0;
    acc += ms; n++; frames++;
    if (acc > 500) { fps.textContent = `${Math.round(1000 * n / acc)} fps  ${tier.name}  x${dyn.scale.toFixed(2)}  ${renderer.info.render.calls} draws  ${(renderer.info.render.triangles / 1000) | 0}k tris`; acc = n = 0; }
    if (!SHOT && frames > 60 && dyn.update(ms)) resize();
    Object.assign(window, { __frames: frames, __pos: [m.x, 0, m.z], __info: renderer.info.render, __cpu: cpu, __m: m, __court: ghats, __king: sim, __pv: pv, __f: fight, __p: prompts, __cam: follow, __turn: turn, __intro: intro, __hud: hud, __ending: ending, __sound: sound, __dir: dir, __rd: rd, __camPos: () => cam.position.toArray(), __bill: bill, __v1: v1, __v2: v2, __post: post });
  };
  startLoop(dt => step(dt), draw);
  void saveSettings; void bars;
}
