// The third fight: the Sister of Hours and the Pall in the Waiting House. Entered from main.ts with ?boss=3; the same referee, director, hero and interface.
import * as THREE from 'three';
import { regainFullscreen } from './core/fullscreen.ts';
import { onSettings, saveSettings, settings } from './core/settings.ts';
import { SPELLS } from './combat/spells.ts';
import { startLoop } from './core/loop.ts';
import { loadGeo, loadTextures } from './render/assets.ts';
import { DEPTH, FOG, RIM, SHARED, surface } from './render/surface.ts';
import { SUN, SUNDIR } from './render/sky.ts';
import { Dust, Puffs, Sparks } from './render/fx.ts';
import { Bursts } from './render/impact.ts';
import { skinnedShadow } from './render/shadowProxy.ts';
import { buildHouse } from './arena/house.ts';
import { Motor } from './player/motor.ts';
import { KHANDA } from './weapons/khanda.ts';
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
import { Sister } from './boss/hours/sister.ts';
import { HoursBrain } from './boss/hours/brain.ts';
import { SisterView } from './boss/hours/sisterView.ts';
import { PallView } from './boss/hours/pallView.ts';
import { HoursDirector } from './boss/hours/hoursDirector.ts';
import { HOURS_NAMES } from './game/hoursScript.ts';
import { HoursIntro, HoursTurn, HoursEnding } from './game/hoursScenes.ts';
import type { Ctx } from './core/boot.ts';

export async function bootHours(c: Ctx) {
  const { Q, tier, renderer, scene, cam, moon, moonDir, hemi, kick, post, dyn, resize, input, app, focus, status, SHOT } = c;
  status('Climbing the hill'); if (!SHOT) sound.load();
  const tex = await loadTextures(tier, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const lod = tier.name === 'high' ? '.lo' : '.xs';
  const [house, gPlayer, gPlayerLo, gKhanda, gSister, sSister, gHook, gPall, sPall, gFrame, sPlayer, gCot] = await Promise.all([buildHouse(tex, tier), loadGeo('player'), loadGeo('player', '.xs'), loadGeo(KHANDA.geo), loadGeo('sister'), loadGeo('sister', lod), loadGeo('hook'), loadGeo('pall'), loadGeo('pall', lod), loadGeo('pallFrame'), loadGeo('player', lod), loadGeo('cot')]);
  scene.add(house.group); FOG.uGlowP.value.forEach((g, i) => g.set(Math.sin(i * 2.1) * 10, 6.6, Math.cos(i * 2.1) * 10 - 2, i < 4 ? 0.0016 : 0)); FOG.uGlowC.value.setRGB(1, 0.42, 0.14);
  const dis = { value: 0 }, pFlash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) }, pAt = { value: new THREE.Vector4(0, 0, 0, 1) }, aura = { value: 0 };
  const skin = (d: { value: number }, f: { value: THREE.Vector4 }, at: { value: THREE.Vector4 }, more: object = {}) => surface(tex, tier, { ash: 0.08, fx: { dis: d, flash: f, at, ...more } });
  const pMat = skin(dis, pFlash, pAt, { aura }), pHeld = skin(dis, pFlash, pAt, { aura }), held = surface(tex, tier, { world: false, ash: 0.06 });
  const fx = { sparks: new Sparks(Math.round(900 * tier.particles), tier.particles), gore: new Sparks(Math.round(260 * tier.particles), tier.particles, true), puffs: new Puffs(), bursts: new Bursts() }; const dust = new Dust(tier.name === 'phone' ? 40 : 110); scene.add(fx.sparks.mesh, fx.puffs.mesh, fx.gore.mesh, fx.bursts.mesh, dust.mesh); house.ruin.fx = fx; house.ruin.dust = dust;
  const pv = new PlayerView(scene, gPlayer, gPlayerLo, gKhanda, pMat, pHeld, DEPTH, fx, tier.name === 'phone' ? 2 : 4, KHANDA); pv.dis = dis; pv.flash = pFlash; pv.flashAt = pAt; pv.aura = aura;
  if (tier.name !== 'phone') { pv.glow = new THREE.PointLight(0xff9450, 1, 6, 1.6); scene.add(pv.glow); }
  const sim = new Sister(), brain = new HoursBrain(), m = new Motor(KHANDA), fight = new Fight(m, sim, brain), prompts = new Prompts(), hud = new Hud(app, input); fight.furnish(house.ruin.props); fight.passive = !!(SHOT || Q.has('still'));
  const v1 = new SisterView(scene, { body: gSister, hook: gHook }, held, held, DEPTH, fx, sim), v2 = new PallView(scene, { body: gPall, hook: gHook, frame: gFrame }, held, held, DEPTH, fx, sim);
  v1.mesh.material = skin(v1.dissolve, v1.flash, v1.flashAt, { wounds: v1.wounds, ember: v1.ember }); v2.mesh.material = surface(tex, tier, { ash: 0, side: THREE.DoubleSide, fx: { dis: v2.dissolve, flash: v2.flash, at: v2.flashAt, wounds: v2.wounds, ember: v2.ember } });
  if (tier.name !== 'phone') { v1.light = new THREE.PointLight(0xffa860, 3, 7, 1.6); v2.light = new THREE.PointLight(0xff7a30, 18, 16, 1.6); scene.add(v1.light, v2.light); }
  pv.shadow = skinnedShadow(pv.mesh, sPlayer, DEPTH.skin); skinnedShadow(v1.mesh, sSister, DEPTH.skin); skinnedShadow(v2.mesh, sPall, DEPTH.skin); v2.show(false);
  if (tier.name === 'phone') pv.weapon.castShadow = v1.cleaver.castShadow = false;
  const follow = new FollowCam(); follow.blockers = m.blockers;
  const dir = new Director({ f: fight, pv, fx, cam: follow, post, hud, input, camera: cam, views: [v1, v2], court: house }); scene.add(dir.cue.mesh, dir.marks.mesh, dir.crescents.group);
  // --- light: round 1 under the smoke, round 2 under a low red sun
  const light = (day: number) => {
    const d = new THREE.Vector3(0.18, 1, 0.34).normalize().lerp(SUNDIR.value, day).normalize(); moonDir.copy(d); FOG.uMoonDir.value.copy(d); moon.position.copy(d).multiplyScalar(55);
    moon.color.setRGB(1.0, 0.5 + 0.0 * day, 0.28 - 0.08 * day); moon.intensity = 0.9 + 3.4 * day; hemi.color.setRGB(0.55 + 0.25 * day, 0.32 + 0.1 * day, 0.24); hemi.groundColor.setRGB(0.12, 0.05, 0.03); hemi.intensity = 0.42 + 0.25 * day; kick.color.setRGB(1, 0.55, 0.35); kick.intensity = 0.35 + 0.4 * day;
    FOG.uFogCol.value.setRGB(0.034 + 0.01 * day, 0.016 - 0.004 * day, 0.012 - 0.004 * day); FOG.uFogMoon.value.setRGB(0.12 + 0.1 * day, 0.045 + 0.02 * day, 0.02); FOG.uFogP.value.x = 0.012 - 0.009 * day; FOG.uFogP.value.y = 0.05 - 0.042 * day;
    RIM.value.set(0.9, 0.42, 0.22, 1.1 + 0.5 * day); post.shaft.value.set(0.9, 0.38, 0.16); post.exposure.value = 1.7 - 0.3 * day; SUN.value = day; house.smokeAmt(1 - day); house.daylight(day);
  };
  light(0);
  const cloth = surface(tex, tier, { world: false, ash: 0.1, side: THREE.DoubleSide }), hd = new HoursDirector(dir, fight, house, v1, v2, post, hud, light, { cot: gCot, hook: gHook, cloth, scene }); hud.names = [HOURS_NAMES.r1, HOURS_NAMES.r2]; hud.winTitle = HOURS_NAMES.won;
  onSettings(() => { brain.temper = settings.temper; const sp = settings.spells; m.spells = [...sp]; hud.spells(SPELLS[sp[0]], SPELLS[sp[1]]); prompts.spells(SPELLS[sp[0]], SPELLS[sp[1]]); });
  const kit = { f: fight, pv, k1: v1, k2: v2, fx, hud, house, hd }, intro = new HoursIntro(kit), turn = new HoursTurn(kit), ending = new HoursEnding(kit);
  dir.onHalf = () => { turnWait = 0.9; if (Q.has('turn')) fight.passive = false; }; dir.onWon = () => { saveSettings({ beaten: settings.beaten | 4 }); ending.start(); }; let turnWait = -1, t = 0, frames = 0;
  turn.onEnd = () => follow.snap(m, sim); const direct = !!(SHOT || Q.has('nointro') || Q.has('turn') || Q.has('round2')); m.z = direct ? 5.2 : 15.5;
  hud.onRestart = () => { ending.stop(); turn.stop(); hd.reset(); turnWait = -1; fight.reset(fight.phase === 'won'); sound.score?.set(fight.round === 2 ? 'pall' : 'hours'); };
  for (const e of ['pointerdown', 'keydown', 'touchend']) addEventListener(e, () => { sound.unlock(); sound.startScore(); });
  const bars = (on: boolean) => document.body.classList.toggle('cine', on), menu = new Menu(app, () => hud.controls());
  menu.fights([['The Hanged King', () => { location.search = ''; }], ['The Ferryman', () => { location.search = '?boss=2'; }], ['The Sister of Hours', null]]);
  const toMenu = () => { hud.setPaused(false); hud.verse(''); ending.stop(); turn.stop(); hd.reset(); turnWait = -1; fight.reset(true); fight.passive = true; prompts.reset(); m.revive(0, 12.2, Math.PI); pv.reset(); bars(false); intro.stop(); v1.settle(); follow.yaw = 0.12; sound.score?.set('still'); menu.show(); intro.rest(); };
  hud.onMenu = toMenu; hud.onResume = regainFullscreen; hud.next = ''; hud.onSkip = () => { };
  const busy = () => menu.open || intro.active || turn.active || ending.active || fight.phase === 'won';
  document.addEventListener('visibilitychange', () => { if (document.hidden && !busy() && !SHOT) hud.setPaused(true); });
  addEventListener('gamepaddisconnected', () => { if (input.lastDevice === 'pad' && !busy()) hud.setPaused(true); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !busy() && !hud.paused && !m.dead) hud.setPaused(true); });
  const grab = () => { input.drain(); if (matchMedia('(pointer: fine)').matches && !document.body.classList.contains('touch')) Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => { }); };
  const begin = () => { bars(false); fight.reset(true); fight.passive = !!Q.has('still'); hd.reset(); follow.snap(m, sim); hud.refill(); sound.score?.set('hours'); };
  menu.onPlay = () => { regainFullscreen(); intro.start(); bars(true); fight.time = 0; grab(); }; menu.onTrain = () => { location.search = '?train'; };
  intro.onEnd = () => { begin(); };
  const bill = () => { const o: [number, string][] = []; scene.traverseVisible(x => { const q = x as THREE.InstancedMesh; if (!q.isMesh) return; const g = q.geometry, n = (g.index?.count ?? g.attributes.position.count) / 3 * (q.isInstancedMesh ? q.count : 1); o.push([n * (q.castShadow ? 2 : 1), `${Math.round(n)}${q.castShadow ? ' x2 (shadow)' : ''}  ${q.type}${q.isInstancedMesh ? ' x' + q.count : ''}`]); }); return o.sort((x, y) => y[0] - x[0]).slice(0, 14).map(x => x[1]); };

  const still = Q.has('still');
  const step = (dt: number) => {
    input.poll(); let ev = input.drain(); let mx = 0, mz = 0;
    if (padNav(input)) ev = ev.filter(e => e.a === 'pause' && !menu.open);
    if (ev.some(e => e.a === 'pause' && !e.up) && !turn.active && !intro.active && fight.phase !== 'won') hud.setPaused(!hud.paused);
    if (hud.paused) return;
    const pace = turn.active ? turn.rate : 1; t += dt * pace; FOG.uFogP.value.w = SHARED.uTime.value = t;
    if (menu.open) { /* the hero waits at the gate */ }
    else if (intro.active) { if (intro.t > 0.6 && ev.some(e => !e.up)) intro.skip(); else mz = intro.step(dt, t); ev = []; }
    else { const s = Math.sin(follow.yaw), cc = Math.cos(follow.yaw), mv = input.move; mx = mv.x * cc - mv.y * s; mz = -mv.x * s - mv.y * cc; }
    if (turn.active && ev.some(e => !e.up)) turn.skip(); if (ending.active && !ending.over && ev.some(e => !e.up)) ending.skip();
    const sd = fight.step(dt * pace, mx, mz, ev), kv = dir.kv;
    if (still) { /* tools/hours.mjs films a move held at an exact moment */ const fz = (window as unknown as { __freezeAt?: number }).__freezeAt; if (fz !== undefined && sim.mt >= fz) sim.mt = sim.prev = fz; }
    if (sd > 0) { kv.update(sd, m.x, m.z, t); pv.update(sd, m, t); } else kv.frozen(t);
    if (turnWait > 0 && (turnWait -= dt) <= 0) turn.start();
    turn.step(dt, t); ending.step(dt, t); hd.step(sd, dt, t); if (!intro.active) dir.mono = Math.max(turn.mono, 0);
    if (!menu.open && !intro.active) prompts.step(sd, fight);
    house.ruin.step(sd, t, [{ x: m.x, z: m.z, r: m.y > 0.6 ? -9 : 0.35, push: 1 + m.speed * 0.25 }, { x: sim.x, z: sim.z, r: sim.y > 0.6 ? -9 : sim.r, push: 3.2 }]); follow.blockers = m.blockers;
    dir.step(sd, dt, t);
  };
  renderer.compile(scene, cam); resize();
  house.ruin.warm(true); pv.ghosts.warm(true); dir.cue.mesh.visible = true; for (const r of [pv.blade, pv.eye]) r.mesh.visible = true; v2.show(true); dir.crescents.group.children.forEach(x => { x.visible = true; }); post.render(scene, cam, moon, 0); house.ruin.warm(false); pv.ghosts.warm(false); dir.cue.mesh.visible = false; v2.show(false); dir.crescents.group.children.forEach(x => { x.visible = false; });
  if (Q.has('round2')) { v1.show(false); v2.show(true); sim.form = 2; fight.beginRound2(); hd.round2(true); } if (Q.has('turn')) { bars(false); fight.bossHp = 1; fight.hits = 5; fight.passive = true; }
  hud.warm(true); for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 40)); hud.warm(false);
  if (!direct) { m.revive(0, 12.2, Math.PI); pv.reset(); fight.passive = true; bars(false); menu.show(); intro.rest(); }
  document.body.classList.toggle('fps', Q.has('fps')); document.body.classList.add('ready'); if (SHOT) document.body.classList.add('bare');
  const fps = document.getElementById('fps')!; let acc = 0, n = 0;
  const SHOTS: Record<string, [number[], number[], number]> = { main: [[1.15, 1.75, 8.9], [-0.1, 1.9, -4], 46], wide: [[10, 4.5, 14], [-1, 2.2, -6], 50], boss: [[2.4, 1.7, 0.6], [0, 2.0, -4.2], 42], face: [[0.6, 2.6, -1.9], [0, 2.5, -4.0], 34], side: [[5.5, 1.9, -3.5], [0, 1.7, -4], 42], back: [[-1.5, 2.4, -9.5], [0, 1.8, -4], 44], up: [[0, 1.4, 4], [0, 6, -14], 64], dial: [[6, 2.4, 6], [0, 4, -22], 56], pall: [[8, 3.2, 8], [0, 2.8, -4], 52] };
  const draw = (_: number, ms: number) => {
    if (busy() && fight.phase !== 'won' || menu.open) follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6);
    const SC = (window as unknown as { __shotCam?: [number[], number[], number] }).__shotCam ?? (SHOT ? SHOTS[SHOT] : undefined); if (SC) { const [pp, ll, ff] = SC; cam.position.set(pp[0], pp[1], pp[2]); cam.lookAt(ll[0], ll[1], ll[2]); cam.fov = ff * (cam.aspect > 1.9 ? 0.92 : 1); cam.updateProjectionMatrix(); }
    else if (menu.open) menuCam(cam, t, m.x, m.z);
    else if (turn.active) turn.camera(cam, t);
    else if (ending.active) ending.camera(cam, t);
    else if (intro.active) intro.camera(cam, t, c.baseFov());
    else if (!fight.m.dead && actionCam(cam, fight, dir.heroT, c.baseFov())) { follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6); }
    else follow.update(cam, Math.min(ms / 1000, 0.05), m, { x: sim.hx, z: sim.hz, solid: sim.form === 1 && sim.y < 0.5 && !sim.hidden, h: sim.form === 2 ? 2.6 - 1.2 * v2.headDown : 2.2 }, input.takeLook(), t, c.baseFov());
    if (!SHOT && !menu.open) hud.update(Math.min(ms / 1000, 0.05), fight, prompts);
    { const fz = cam.userData.focus as THREE.Vector3 | undefined, film = menu.open || turn.active || ending.active || intro.active, on = film || cam.userData.frame === true, want = on && fz ? (menu.open ? 0.4 : film ? 0.8 : 0.6) : 0; cam.userData.frame = false; post.dof.amt += (want - post.dof.amt) * (want && post.dof.amt < 0.02 ? 1 : Math.min(1, ms / 90)); if (fz) post.dof.focus = Math.max(0.5, fz.distanceTo(cam.position)); }
    c.sky.position.copy(cam.position); cam.updateMatrixWorld();
    focus.set(m.x, 0, m.z); house.update(t, focus); sound.listen(cam.position.x * 0.3 + m.x * 0.7, cam.position.z * 0.3 + m.z * 0.7, follow.yaw);
    const c0 = performance.now(); renderer.info.reset(); post.render(scene, cam, moon, t); const cpu = performance.now() - c0;
    acc += ms; n++; frames++;
    if (acc > 500) { fps.textContent = `${Math.round(1000 * n / acc)} fps  ${tier.name}  x${dyn.scale.toFixed(2)}  ${renderer.info.render.calls} draws  ${(renderer.info.render.triangles / 1000) | 0}k tris`; acc = n = 0; }
    if (!SHOT && frames > 60 && dyn.update(ms)) resize();
    Object.assign(window, { __frames: frames, __pos: [m.x, 0, m.z], __info: renderer.info.render, __cpu: cpu, __m: m, __court: house, __king: sim, __pv: pv, __f: fight, __p: prompts, __cam: follow, __turn: turn, __intro: intro, __hud: hud, __ending: ending, __sound: sound, __dir: dir, __hd: hd, __camPos: () => cam.position.toArray(), __bill: bill, __v1: v1, __v2: v2, __post: post, __light: light });
  };
  startLoop(dt => step(dt), draw);
}
