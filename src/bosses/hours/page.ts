// The third fight: the Sister of Hours and the Pall in the Waiting House. Entered from main.ts with ?boss=3; the same referee, director, hero and interface.
// The shared page (hero, fx, HUD, menu, pause, reset, loop) is src/game/fightPage.ts. This file is what is hers: the house and its light,
// the two bodies, the scenes, the grab and the climb.
import * as THREE from 'three';
import type { Ctx } from '../../core/boot.ts';
import { FOG, RIM, DEPTH } from '../../render/surface.ts';
import { SUN, SUNDIR } from '../../render/sky.ts';
import { skinnedShadow } from '../../render/shadowProxy.ts';
import { loadGeo } from '../../render/assets.ts';
import { buildHouse, type House } from './house.ts';
import { Offer, offerSpec, type MomentSpec } from '../../game/moment.ts';
import { HoursDirector } from './hoursDirector.ts';
import { HOURS_NAMES, HOURS_WORDS } from './hoursScript.ts';
import { GRIP, PIERCE, gripLift, gripTumble, Sister } from './sister.ts';
import { HoursBrain } from './brain.ts';
import { SisterView } from './sisterView.ts';
import { PallView } from './pallView.ts';
import { HoursIntro, HoursTurn, HoursEnding } from './hoursScenes.ts';
import { fightPage, type BuildKit, type FightPageSpec, type Parts, type Pre, type Vec2, type Wired, type WireKit } from '../../game/fightPage.ts';
import type { Press } from '../../player/motor.ts';

interface HoursParts extends Parts {
  arena: House;
  sim: Sister;
  views: [SisterView, PallView];
  light: (day: number) => void;
  cot: THREE.BufferGeometry;
  scythe: THREE.BufferGeometry;
}

/** The house, the Sister and the Pall: the geometry, the lights of day and night, and the two bodies. */
async function buildHours(k: BuildKit): Promise<HoursParts> {
  const { c, tex, lod, fx, held, skin, surf } = k;
  const { tier, scene, moon, moonDir, hemi, kick, post } = c;
  const [house, gSister, sSister, gScythe, gPall, sPall, gCot] = await Promise.all([
    buildHouse(tex, tier),
    loadGeo('sister'),
    loadGeo('sister', lod),
    loadGeo('scythe'),
    loadGeo('pall'),
    loadGeo('pall', lod),
    loadGeo('cot'),
  ]);
  scene.add(house.group);
  FOG.uGlowP.value.forEach((g, i) => g.set(Math.sin(i * 2.1) * 10, 6.6, Math.cos(i * 2.1) * 10 - 2, i < 4 ? 0.0016 : 0));
  FOG.uGlowC.value.setRGB(1, 0.42, 0.14);
  const sim = new Sister();
  const brain = new HoursBrain();
  const v1 = new SisterView(scene, { body: gSister, scythe: gScythe }, held, held, DEPTH, fx, sim);
  const v2 = new PallView(scene, { body: gPall, scythe: gScythe }, held, held, DEPTH, fx, sim);
  v1.mesh.material = skin(v1.dissolve, v1.flash, v1.flashAt, { wounds: v1.wounds, ember: v1.ember });
  v2.mesh.material = surf({ ash: 0, side: THREE.DoubleSide, fx: { dis: v2.dissolve, flash: v2.flash, at: v2.flashAt, wounds: v2.wounds, ember: v2.ember } });
  if (tier.name !== 'phone') {
    v1.light = new THREE.PointLight(0xffa860, 3, 7, 1.6);
    v2.light = new THREE.PointLight(0xff7a30, 18, 16, 1.6);
    scene.add(v1.light, v2.light);
  }
  skinnedShadow(v1.mesh, sSister, DEPTH.skin);
  skinnedShadow(v2.mesh, sPall, DEPTH.skin);
  v2.show(false);
  // --- light: round 1 under the smoke, round 2 under a low red sun
  const light = (day: number) => {
    const d = new THREE.Vector3(0.18, 1, 0.34).normalize().lerp(SUNDIR.value, day).normalize(); moonDir.copy(d); FOG.uMoonDir.value.copy(d); moon.position.copy(d).multiplyScalar(55);
    moon.color.setRGB(1.0, 0.5 + 0.0 * day, 0.28 - 0.08 * day); moon.intensity = 0.9 + 3.4 * day; hemi.color.setRGB(0.55 + 0.25 * day, 0.32 + 0.1 * day, 0.24); hemi.groundColor.setRGB(0.12, 0.05, 0.03); hemi.intensity = 0.42 + 0.25 * day; kick.color.setRGB(1, 0.55, 0.35); kick.intensity = 0.35 + 0.4 * day;
    FOG.uFogCol.value.setRGB(0.034 + 0.01 * day, 0.016 - 0.004 * day, 0.012 - 0.004 * day); FOG.uFogMoon.value.setRGB(0.12 + 0.1 * day, 0.045 + 0.02 * day, 0.02); FOG.uFogP.value.x = 0.012 - 0.009 * day; FOG.uFogP.value.y = 0.05 - 0.042 * day;
    RIM.value.set(0.9, 0.42, 0.22, 1.1 + 0.5 * day); post.shaft.value.set(0.9, 0.38, 0.16); post.exposure.value = 1.7 - 0.3 * day; SUN.value = day; house.smokeAmt(1 - day); house.daylight(day);
  };
  light(0);
  return { arena: house, sim, brain, views: [v1, v2], light, cot: gCot, scythe: gScythe };
}

/** The Sister's scenes, the director, the grab (the hurl and the climb) and the offer of the climb. */
function wireHours(k: WireKit<HoursParts>): Wired {
  const { c, parts, m, fight, pv, fx, hud, follow, dir, moment, qte, surf, menuOpen } = k;
  const { sim, arena: house, light, cot, scythe } = parts;
  const [v1, v2] = parts.views;
  const { input, Q, post, scene } = c;
  let staged: 'hurl' | 'climb' | null = null;
  const climbFrom = new THREE.Vector3();
  const cloth = surf({ world: false, ash: 0.1, side: THREE.DoubleSide });
  const hd = new HoursDirector(dir, fight, house, v1, v2, post, hud, light, { cot, scythe, cloth, scene });
  const toHer = () => { const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d] as const; };
  const hurl: MomentSpec = {
    frame: (t, eye, at) => { const [ux, uz] = toHer(), y = gripLift(t) + 1.0;
      if (t < GRIP.throw) { const l = Math.min(1, t / 0.6); eye.set(m.x + ux * 4.4 + uz * 2.3, 1.15 + 0.35 * l, m.z + uz * 4.4 - ux * 2.3); at.set(m.x * 0.55 + sim.x * 0.45, 2.5 + 0.7 * l, m.z * 0.55 + sim.z * 0.45); return 52 - 4 * l; }
      if (t < GRIP.impact) { eye.set(m.x + ux * 7.5 + uz * 3.2, 0.9, m.z + uz * 7.5 - ux * 3.2); at.set(m.x, y, m.z); return 56; }
      eye.set(m.x + ux * 4.6 + uz * 2.6, 2.6, m.z + uz * 4.6 - ux * 2.6); at.set(m.x, 0.5, m.z); return 46; },
    letterbox: true, hero: (t, o) => o.set(0, gripLift(t), 0), tumble: gripTumble, rate: t => t > GRIP.impact - 0.2 && t < GRIP.impact + 0.15 ? 0.3 : 1,
  };
  /** Up her: a run at her knee, a bound up the length of her arm, the cut across her face, and down again behind the blade. */
  const climbAt = (t: number, o: THREE.Vector3) => { const [ux, uz] = toHer(), face = new THREE.Vector3(sim.x + ux * 1.1, 2.9, sim.z + uz * 1.1), base = new THREE.Vector3(sim.x + ux * 2.0, 0, sim.z + uz * 2.0), E2 = (a: number, b: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
    const p = t < 0.5 ? climbFrom.clone().lerp(base, E2(0, 0.5)) : t < 1.35 ? base.clone().lerp(face, E2(0.5, 1.35)).add(new THREE.Vector3(0, Math.sin(E2(0.5, 1.35) * Math.PI) * 0.8, 0)) : t < 1.7 ? face.clone() : face.clone().lerp(climbFrom, E2(1.7, 2.5)).add(new THREE.Vector3(0, Math.sin(E2(1.7, 2.5) * Math.PI) * 1.6, 0));
    o.set(p.x - m.x, p.y, p.z - m.z); };
  const climb: MomentSpec = {
    frame: (t, eye, at) => { const [ux, uz] = toHer(), h = new THREE.Vector3(); climbAt(t, h); h.add(new THREE.Vector3(m.x, 1.0, m.z));
      if (t < 0.5) { eye.set(climbFrom.x + ux * 3.2 + uz * 1.2, 1.0, climbFrom.z + uz * 3.2 - ux * 1.2); at.set(sim.x, 2.4, sim.z); return 48; }
      if (t < 1.4) { eye.set(sim.x + ux * 5.5 + uz * 5.0, 1.2, sim.z + uz * 5.5 - ux * 5.0); at.copy(h); return 50; }
      if (t < 1.8) { eye.set(sim.x + ux * 2.6 + uz * 2.4, 4.2, sim.z + uz * 2.6 - ux * 2.4); at.set(sim.x + ux * 0.6, 3.4, sim.z + uz * 0.6); return 40; }
      eye.set(sim.x + ux * 8 + uz * 3, 2.2, sim.z + uz * 8 - ux * 3); at.set(sim.x, 2.6, sim.z); return 48; },
    letterbox: true, hero: climbAt, tumble: t => t > 1.7 && t < 2.5 ? (t - 1.7) * 7.85 : 0, rate: t => t > PIERCE.hit - 0.12 && t < PIERCE.hit + 0.25 ? 0.25 : 1,
  };
  hd.onGrab = () => {
    staged = 'hurl';
    moment.start(hurl);
  };
  hd.onFree = () => {
    if (staged === 'hurl') {
      moment.stop();
      staged = null;
      follow.snap(m, sim);
    }
  };
  // the chance to climb her: the same low looming shot the Ferryman and the King offer (it slows time and frames her), then the press
  const offer = new Offer(moment, offerSpec(m, () => ({ x: sim.hx, y: 1.9, z: sim.hz })), (_r, secs) => qte.show('attack', 'Climb her', secs, input.lastDevice));
  hd.onStrike = () => m.begin('flick');
  const kit = { f: fight, pv, k1: v1, k2: v2, fx, hud, house, hd };
  const intro = new HoursIntro(kit);
  const turn = new HoursTurn(kit);
  const ending = new HoursEnding(kit);
  const still = Q.has('still');
  return {
    intro,
    turn,
    ending,
    before(dt: number, t: number, ev0: Press[], walk: Vec2): Pre {
      let ev = ev0;
      let mx = 0;
      let mz = 0;
      if (menuOpen()) { /* the hero waits at the gate */ }
      else if (intro.active) { if (intro.t > 0.6 && ev.some(e => !e.up)) intro.skip(); else mz = intro.step(dt, t); ev = []; }
      else { mx = walk.x; mz = walk.z; }
      // a staged moment: the fight goes on beneath it, but the hero is the scene's
      offer.step(dt, sim.mode === 'sag' && sim.open > 0 ? 'climb' : null, sim.open, staged !== null);
      qte.step(dt);
      if (qte.on && ev.some(e => e.a === 'attack' && !e.up) && sim.climb()) {
        qte.hide();
        climbFrom.set(m.x, 0, m.z);
        staged = 'climb';
        moment.start(climb);
      }
      if (staged === 'climb' && sim.mode !== 'pierced') {
        moment.stop();
        staged = null;
        follow.snap(m, sim);
      }
      if (moment.active) { ev = []; mx = mz = 0; }
      pv.tumble = moment.hero(sim.mt, pv.offset);
      if (turn.active && ev.some(e => !e.up)) turn.skip();
      if (ending.active && !ending.over && ev.some(e => !e.up)) ending.skip();
      return { ev, mx, mz };
    },
    after(_sd: number, _dt: number, _t: number) {
      if (still) { /* tools/hours.mjs films a move held at an exact moment */ const fz = (window as unknown as { __freezeAt?: number }).__freezeAt; if (fz !== undefined && sim.mt >= fz) sim.mt = sim.prev = fz; }
    },
    tick(sd: number, dt: number, t: number) {
      turn.step(dt, t);
      ending.step(dt, t);
      hd.step(sd, dt, t);
      if (!intro.active) dir.mono = Math.max(turn.mono, 0);
    },
    blocker: () => ({ x: sim.x, z: sim.z, r: sim.y > 0.6 ? -9 : sim.r }),
    clock: () => sim.mt,
    reset() {
      offer.reset();
      staged = null;
      hd.reset();
    },
    begin() {
      hd.reset();
    },
    toMenu() {
      v1.settle();
      intro.rest();
    },
    turnEnd() {
      hd.teach();
    },
    round2() {
      hd.round2(true);
    },
    theatreReset() { /* the Sister's views are shown by the shell */ },
    tap() { /* a phone's tap does nothing here: her scenes skip on any press */ },
    decay() {
      const busy = menuOpen() || intro.active || turn.active || ending.active;
      return (busy && fight.phase !== 'won') || menuOpen();
    },
    camera(cam, ms, t) {
      if (moment.active && moment.camera(cam, Math.min(ms / 1000, 0.05), sim.mt)) return true;
      if (turn.active) { turn.camera(cam, t); return true; }
      if (ending.active) { ending.camera(cam, t); return true; }
      if (intro.active) { intro.camera(cam, t, c.baseFov()); return true; }
      return false;
    },
    followTarget: () => ({ x: sim.hx, z: sim.hz, solid: sim.form === 1 && sim.y < 0.5 && !sim.hidden, h: sim.form === 2 ? v2.camH : 2.2 }),
    frame() { document.body.classList.toggle('letter', moment.letterbox); },
    debug: () => ({ __hd: hd, __light: light }),
  };
}

export const hoursSpec: FightPageSpec<HoursParts> = {
  bossId: 'hours',
  status: 'Climbing the hill',
  heroAsh: { skin: 0.08, held: 0.06 },
  names: HOURS_NAMES,
  words: HOURS_WORDS,
  score: { r1: 'hours', r2: 'pall' },
  beaten: 4,
  shots: {
    main: [[1.15, 1.75, 8.9], [-0.1, 1.9, -4], 46],
    wide: [[10, 4.5, 14], [-1, 2.2, -6], 50],
    boss: [[2.4, 1.7, 0.6], [0, 2.0, -4.2], 42],
    face: [[0.6, 2.6, -1.9], [0, 2.5, -4.0], 34],
    side: [[5.5, 1.9, -3.5], [0, 1.7, -4], 42],
    back: [[-1.5, 2.4, -9.5], [0, 1.8, -4], 44],
    up: [[0, 1.4, 4], [0, 6, -14], 64],
    dial: [[6, 2.4, 6], [0, 4, -22], 56],
    pall: [[8, 3.2, 8], [0, 2.8, -4], 52],
  },
  build: buildHours,
  wire: wireHours,
};

export async function bootHours(c: Ctx): Promise<void> {
  await fightPage(c, hoursSpec);
}
