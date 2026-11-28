// The second fight: the Ferryman and the Weight on the river ghats. Entered from main.ts with ?boss=2; the same referee, director, hero and interface, a different place and body.
// The shared page (hero, fx, HUD, menu, pause, reset, loop) is src/game/fightPage.ts. This file is what is his: the ghats and the light,
// the two bodies, the scenes, the staged moments (the drag, the chain and the lantern shots) and the under-water beats.
import * as THREE from 'three';
import type { Ctx } from '../../core/boot.ts';
import { DEPTH, FOG } from '../../render/surface.ts';
import { LINE } from '../../render/sky.ts';
import { loadGeo } from '../../render/assets.ts';
import { skinnedShadow } from '../../render/shadowProxy.ts';
import { sound } from '../../audio/sound.ts';
import { Offer, offerSpec, type MomentSpec } from '../../game/moment.ts';
import { RIVER_NAMES, RIVER_PRESS } from './riverScript.ts';
import { buildGhats } from './ghats.ts';
import { DRAG, River } from './river.ts';
import { dragSpec, dragUnder } from './dragShot.ts';
import { RiverBrain } from './brain.ts';
import { RiverView } from './riverView.ts';
import { RiverDirector } from './riverDirector.ts';
import { RiverIntro, RiverEnding, RiverTurn, riverMoments } from './riverScenes.ts';
import { RewardRun, beginReward, syncReward, type RewardKit } from '../../game/rewardShots.ts';
import { chainBeats, lanternBeats, riverRewards } from './rewards.ts';
import {
  fightPage, type BuildKit, type FightPageSpec, type Parts, type Pre, type Vec2, type Wired, type WireKit,
} from '../../game/fightPage.ts';
import type { Press } from '../../player/motor.ts';

type Ghats = Awaited<ReturnType<typeof buildGhats>>;

interface RiverParts extends Parts {
  arena: Ghats;
  sim: River;
  brain: RiverBrain;
  views: [RiverView, RiverView];
}

/** The ghats, the Ferryman's boat and pole, and the Weight (round 2, the bare body). */
async function buildRiver(k: BuildKit): Promise<RiverParts> {
  const { c, tex, lod, fx, held, skin, surf } = k;
  const { tier, scene, moon, post } = c;
  const [ghats, gFerry, sFerry, gPole, gAnchor, gBoat, gLantern, gArm, gBare, sBare, gDrowned] = await Promise.all([
    buildGhats(tex, tier, c.moonDir),
    loadGeo('ferryman'),
    loadGeo('ferryman', lod),
    loadGeo('pole'),
    loadGeo('anchor'),
    loadGeo('boat'),
    loadGeo('lantern'),
    loadGeo('arm'),
    loadGeo('ferryman2'),
    loadGeo('ferryman2', lod),
    loadGeo('drowned'),
  ]);
  scene.add(ghats.group); LINE.value = 1; FOG.uGlowP.value.forEach((g, i) => { const l = ghats.ruin.lamps[i]; if (l) g.set(l.p.x, l.p.y + 0.4, l.p.z, 0.0042); else g.set(0, 0, 0, 0); }); FOG.uFogCol.value.setRGB(0.008, 0.016, 0.026); FOG.uFogMoon.value.setRGB(0.05, 0.075, 0.1); FOG.uFogP.value.x = 0.0065; moon.intensity = 2.0; post.exposure.value = 1.85;
  const wood = surf({ world: false, ash: 0.02 });
  const fMat = skin({ value: 0 }, { value: new THREE.Vector4(1, 0.4, 0.1, 0) }, { value: new THREE.Vector4(0, 0, 0, 1) });
  const geo = { boat: gBoat, body: gFerry, pole: gPole, anchor: gAnchor, lantern: gLantern, arm: gArm, drowned: gDrowned };
  const mats = { skin: fMat, held, wood };
  const sim = new River();
  const brain = new RiverBrain();
  const v1 = new RiverView(scene, geo, mats, DEPTH, fx, sim, 1).withWater(ghats);
  const v2 = new RiverView(scene, { ...geo, body: gBare }, mats, DEPTH, fx, sim, 2).withWater(ghats);
  v2.oldGeo = gFerry;
  for (const v of [v1, v2]) { v.mesh.material = skin({ value: 0 }, v.flash, v.flashAt, { wounds: v.wounds, ember: v.ember }); }
  if (tier.name !== 'phone') { v1.light = new THREE.PointLight(0xffa860, 16, 14, 1.7); scene.add(v1.light); }
  skinnedShadow(v1.mesh, sFerry, DEPTH.skin);
  skinnedShadow(v2.mesh, sBare, DEPTH.skin);
  v2.show(false);
  return { arena: ghats, sim, brain, views: [v1, v2] };
}

/** The Ferryman's scenes, the director, the staged moments (drag, chain, lantern) and the press for the reward. */
function wireRiver(k: WireKit<RiverParts>): Wired {
  const { c, parts, m, fight, pv, fx, hud, dir, moment, qte, menuOpen } = k;
  const { sim, arena: ghats } = parts;
  const [v1, v2] = parts.views;
  const { input, post, app } = c;
  // staged moments (src/game/moment.ts): the grab always plays out and holds the hero; the reward is the hero's, offered as a press while the chance lasts
  const rSpecs = { ...riverMoments(sim, m) } as Record<'drag' | 'chain' | 'lantern', MomentSpec>;
  const dSpec = dragSpec(sim, m);
  const under = document.createElement('div');
  let staged: 'drag' | 'chain' | 'lantern' | null = null;
  let dragK = 0;
  // the reward on offer: the slow low shot by the hero's feet, then the press; the drag's own beats: the pull under, the bite, the heave
  under.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:1;background:radial-gradient(ellipse at 50% 45%, rgba(40,92,72,0.18), rgba(8,36,28,0.8))';
  app.appendChild(under);
  const kOffer = new Offer(moment, offerSpec(m, () => ({ x: sim.x, y: 2.2, z: sim.z })), (r, secs) => qte.show('attack', RIVER_PRESS[r as 'chain' | 'lantern'], secs, input.lastDevice));
  const rd = new RiverDirector(dir, fight, ghats, v1, v2, post, hud);
  const rKit: RewardKit = { fx, kick: s => moment.kick(s), get river() { return sim.form === 2 ? v2 : v1; } };
  const rewardRun = new RewardRun(rKit);
  Object.assign(rSpecs, riverRewards(sim, m, rKit, rewardRun));
  const kit = { f: fight, pv, k1: v1, k2: v2, fx, hud, ghats, rd, prompt: qte };
  const intro = new RiverIntro(kit);
  const turn = new RiverTurn(kit);
  const ending = new RiverEnding(kit);
  return {
    intro,
    turn,
    ending,
    before(dt: number, t: number, ev0: Press[], walk: Vec2): Pre {
      let ev = ev0;
      let mx = 0;
      let mz = 0;
      if (menuOpen()) { /* the hero kneels at the water */ }
      else if (intro.active) { intro.press(ev, t); mz = intro.active ? intro.step(dt, t, input.lastDevice) : 0; ev = []; }
      else { mx = walk.x; mz = walk.z; }
      if (turn.active && ev.some(e => !e.up)) turn.skip();
      if (ending.active) { ending.press(ev, t); if (ending.waiting) ev = []; }
      // a reward press (only while its chance lasts) starts the hero's scene; a staged moment has the hero, not the player
      qte.step(dt);
      if (qte.on && ev.some(e => e.a === 'attack' && !e.up)) { const rr = sim.takeReward(); if (rr) qte.hide(); }
      if (moment.active) { mx = mz = 0; } // the fight drops his presses while a moment is on, and keeps the releases
      return { ev, mx, mz };
    },
    after(sd: number, dt: number, t: number) {
      // a reward scene: the hero's clip runs on the scene's clock, and its beats (the shatter, the snap) fire on the frame they land
      if (sim.rite) { if (rewardRun.kind !== sim.rite) { beginReward(sim.rite, m); rewardRun.begin(sim.rite); } syncReward(m, sim.stage); if (sim.rite === 'lantern') lanternBeats(sim, m, rKit, rewardRun, sim.stage, t); else chainBeats(sim, m, rKit, rewardRun, sim.stage, t); } else if (rewardRun.kind) rewardRun.end(m);
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
    },
    tick(sd: number, dt: number, t: number) {
      turn.step(dt, t);
      ending.step(dt, t, input.lastDevice);
      rd.step(sd, dt, t);
      if (!intro.active) dir.mono = Math.max(turn.mono, 0);
    },
    blocker: () => ({ x: sim.x, z: sim.z, r: sim.y > 0.6 ? -9 : 0.8 }),
    clock: () => sim.stage,
    reset() {
      staged = null;
      kOffer.reset();
      rd.reset();
    },
    begin() {
      rd.reset();
    },
    toMenu() {
      v1.settle();
    },
    turnEnd() { /* nothing more after his turn */ },
    round2() {
      rd.round2(true);
    },
    theatreReset() {
      sim.form = 1;
    },
    tap(t: number) {
      if (ending.waiting) ending.tap(t);
      if (intro.waiting) intro.tap(t);
    },
    decay: () => intro.active || turn.active || ending.active || menuOpen(),
    camera(cam, ms, t) {
      if (turn.active) { turn.camera(cam, t); return true; }
      if (ending.active) { ending.camera(cam, t); return true; }
      if (intro.active) { intro.camera(cam, t, c.baseFov()); return true; }
      return !!(moment.active && moment.camera(cam, Math.min(ms / 1000, 0.05), sim.stage, t));
    },
    followTarget: () => ({ x: sim.hx, z: sim.hz, solid: sim.form === 1 && sim.y < 0.5, h: sim.form === 2 ? 2.1 : 1.7 + sim.y * 0.6 }),
    frame(cam, ms) { moment.settle(cam, Math.min(ms / 1000, 0.05)); },
    debug: () => ({ __rd: rd, __kOffer: kOffer }),
  };
}

export const riverSpec: FightPageSpec<RiverParts> = {
  bossId: 'river',
  status: 'Lighting the river',
  heroAsh: { skin: 0.04, held: 0.04 },
  names: RIVER_NAMES,
  score: { r1: 'row', r2: 'weight' },
  beaten: 3,
  shots: {
    main: [[1.15, 1.75, 8.9], [-0.1, 1.5, -4], 46],
    wide: [[10, 4.5, 14], [-1, 1.8, -6], 46],
    boss: [[2.2, 1.5, 0.2], [0, 1.9, -4.2], 42],
    bossc: [[1.2, 1.9, -1.4], [0, 2.1, -4.1], 36],
    face: [[0.7, 2.4, -2.1], [0, 2.4, -4.0], 34],
    side: [[5.5, 1.7, -3.5], [0, 1.6, -4], 42],
    back: [[-1.5, 2.2, -8.5], [0, 1.8, -4], 44],
    up: [[0, 1.4, 1], [0, 6, -14], 60],
    weight: [[8, 3.2, 8], [0, 1.8, -5], 52],
    horizon: [[0, 1.6, 12], [0, 0.8, -60], 50],
    lamps: [[3, 0.7, 6], [4, 0.2, -20], 40],
  },
  build: buildRiver,
  wire: wireRiver,
};

export async function bootRiver(c: Ctx): Promise<void> {
  await fightPage(c, riverSpec);
}
