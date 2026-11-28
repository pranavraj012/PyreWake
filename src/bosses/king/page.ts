// The Hanged King: the first fight and the default page (no ?boss=). Entered from main.ts with no ?boss=, or ?boss=1.
// The shared page (hero, fx, HUD, menu, pause, reset, loop) is src/game/fightPage.ts. This file is what is his: the court and
// its fires, the two forms (the King and the One Beneath), the Prologue and the training, his scenes, his staged moments
// (the noose, the rope and the ride) and the dawn and the eclipse.
import * as THREE from 'three';
import type { Ctx } from '../../core/boot.ts';
import { saveSettings, settings } from '../../core/settings.ts';
import { DEFAULT_SPELLS, type SpellId } from '../../combat/spells.ts';
import { DEPTH, FOG, RIM } from '../../render/surface.ts';
import { DAWN, ECLIPSE } from '../../render/sky.ts';
import { loadGeo } from '../../render/assets.ts';
import { skinnedShadow } from '../../render/shadowProxy.ts';
import type { Dust } from '../../render/fx.ts';
import { sound } from '../../audio/sound.ts';
import { KHANDA } from '../../weapons/khanda.ts';
import { BODY_CLIPS } from '../../player/clips.ts';
import type { Press } from '../../player/motor.ts';
import type { Hud } from '../../ui/hud.ts';
import { Offer, offerSpec, type MomentSpec } from '../../game/moment.ts';
import { RewardRun, beginReward, syncReward } from '../../game/rewardShots.ts';
import {
  fightPage, type BenchRun, type BuildKit, type FightPageSpec, type IntroRun, type Parts, type Pre, type Vec2,
  type Wired, type WireKit,
} from '../../game/fightPage.ts';
import { buildCourt } from './court.ts';
import { KING_CLIPS } from './clips.ts';
import { KingView } from './kingView.ts';
import { BENEATH_MODES, KING_MODES, King } from './king.ts';
import { Brain } from './brain.ts';
import { Turn } from './cinema.ts';
import { Ending, Intro, Prologue, kingMoments } from './scenes.ts';
import { RideGeo, RopeGeo, kingClip, rideBeats, rideSpec, ropeBeats, ropeSpec, type KingRewardKit, type KingRewardProps } from './kingRewards.ts';
import { KING_CALLS, KING_LESSON, KING_LINES, KING_PRESS, KING_TITLES } from './kingScript.ts';
import type { BossWords } from '../../boss/words.ts';
import type { Mood } from '../../audio/score.ts';
import { Lessons } from './lessons.ts';

type Court = Awaited<ReturnType<typeof buildCourt>>;
type Wound = { w: { value: THREE.Vector4[] }; n: { value: THREE.Vector3[] } };
type Flash = { value: THREE.Vector4 };
type Level = { value: number };

/** The King's parts: his court, his sim and brain, his two forms, and the dissolve levels the scenes and the turn drive. */
export interface KingParts extends Parts {
  arena: Court;
  sim: King;
  brain: Brain;
  views: [KingView, KingView];
  dust: Dust;
  kDis: Level;
  bDis: Level;
}

const wounds = (): Wound => ({
  w: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) },
  n: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 1, 0)) },
});

/** The camera shots for ?shot= (the same table as before the shell: no HUD, a passive fight). */
const SHOTS: Record<string, [number[], number[], number]> = {
  main: [[1.15, 1.75, 8.9], [-0.1, 1.75, -4], 46],
  wide: [[9, 4.2, 15], [-1, 2.6, -8], 46],
  boss: [[1.3, 1.5, 0.4], [0.05, 2.35, -4.2], 46],
  face: [[0.55, 2.75, -1.6], [0.05, 2.95, -4.2], 40],
  player: [[-1.35, 1.3, 2.7], [0, 0.98, 5.2], 40],
  playerb: [[1.25, 1.3, 7.6], [0, 1.0, 5.2], 40],
  head: [[-0.42, 1.68, 4.1], [0, 1.5, 5.2], 32],
  hang: [[0.8, 1.55, 3.4], [0, 2.0, -3.2], 46],
  hangc: [[1.1, 1.5, -0.6], [0, 1.9, -3.2], 46],
  pillar: [[10.5, 1.8, 2], [17, 2.2, 5.2], 46],
  up: [[0, 1.6, -2], [2, 7.5, -20], 60],
  floor: [[3, 1.1, 3], [3.5, 0, -1], 46],
};

/** The court, his two bodies (the King and the One Beneath), their skins, wounds and shadows. */
async function buildKing(k: BuildKit): Promise<KingParts> {
  const { c, tex, lod, fx, dust, skin, surf } = k;
  const { tier, scene } = c;
  const [court, gKing, gCleaver, gRoot, sKing, gBen, sBen] = await Promise.all([
    buildCourt(tex, tier),
    loadGeo('king'),
    loadGeo('cleaver'),
    loadGeo('roots0'),
    loadGeo('king', lod),
    loadGeo('beneath'),
    loadGeo('beneath', lod),
  ]);
  scene.add(court.group);
  const kDis = { value: 0 };
  const kFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) };
  const kAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  const kW = wounds();
  const bDis = { value: 0 };
  const bFlash = { value: new THREE.Vector4(1, 0.4, 0.1, 0) };
  const bAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  const bW = wounds();
  const bEmber = { value: 0.8 };
  const kMat = skin(kDis, kFlash, kAt, { wounds: kW });
  const kHeld = skin(kDis, kFlash, kAt);
  const bMat = skin(bDis, bFlash, bAt, { wounds: bW, ember: bEmber });
  const barkMat = surf({ world: true, ash: 0.2 });
  const king = new KingView(scene, gKing, gCleaver, gRoot, kMat, kHeld, barkMat, DEPTH, fx);
  king.flash = kFlash;
  king.flashAt = kAt;
  king.wounds = kW;
  king.dissolve = kDis;
  const beneath = new KingView(scene, gBen, gCleaver, gRoot, bMat, kHeld, barkMat, DEPTH, fx, king.sim, 2);
  beneath.flash = bFlash;
  beneath.flashAt = bAt;
  beneath.wounds = bW;
  beneath.dissolve = bDis;
  beneath.ember = bEmber;
  skinnedShadow(king.mesh, sKing, DEPTH.skin);
  skinnedShadow(beneath.mesh, sBen, DEPTH.skin);
  beneath.show(false);
  return {
    arena: court,
    sim: king.sim,
    brain: new Brain(),
    views: [king, beneath],
    dust,
    kDis,
    bDis,
  };
}

/** The Prologue, the training, his staged moments (the noose, the rope and the ride), the dawn and the eclipse. */
function wireKing(k: WireKit<KingParts>): Wired {
  const { c, parts, m, fight, pv, fx, hud, prompts, follow, dir, moment, qte, menuOpen, begin, arm, bars } = k;
  dir.moods = KING_MOODS;
  const [king, beneath] = parts.views;
  const { input, post, moon, hemi, kick } = c;
  const { arena: court, dust, kDis, bDis } = parts;
  // a reading of the scene, for the tools: the King's Hanging pose (the ?shot=hang frames)
  if (c.SHOT?.startsWith('hang')) {
    king.sim.set('hang');
    king.sim.x = 0;
    king.sim.z = -3.2;
  }
  // staged moments (src/game/moment.ts): the grab always plays out and holds the hero; the reward is the hero's, offered as a press while the chance lasts
  const kSpecs = { ...kingMoments(king.sim, m) } as Record<'noose' | 'rope' | 'ride', MomentSpec>;
  /** The King's staged moments' cues (scenes.ts names them): the sound, the dust, the shake, the words. */
  const kingCue = (name: string, t: number) => {
    const L = king.sim.landAt;
    if (name === 'seize') {
      sound.play('kBreath', { gain: 0.9, wet: 0.7, bus: 'voice' });
      sound.play('armsClench', { gain: 0.7, x: m.x, z: m.z });
      hud.verse(KING_LINES.seized);
    } else if (name === 'lift') { // the struggle: a muffled breath and a strain, from the throat
      sound.play('kBreath', { gain: 0.6, wet: 0.95, bus: 'voice', rate: 0.75, x: m.x, z: m.z });
      sound.play('kGrunt', { gain: 0.5, wet: 0.6, bus: 'voice', x: king.sim.x, z: king.sim.z });
    } else if (name === 'swing') {
      sound.play('creak', { gain: 0.7, wet: 0.8, x: king.sim.x, z: king.sim.z });
      sound.play('whooshB', { gain: 0.8, x: king.sim.x, z: king.sim.z });
    } else if (name === 'throw') {
      sound.play('whooshH', { gain: 0.9, x: m.x, z: m.z });
      sound.play('groan', { gain: 0.6, x: king.sim.x, z: king.sim.z });
      hud.verse('');
    } else if (name === 'rise') {
      sound.play('breathIn', { gain: 0.6, wet: 0.6, bus: 'voice', x: m.x, z: m.z });
    } else if (name === 'land') {
      sound.play('slam', { gain: 0.9, x: L.x, z: L.z });
      sound.play('thud', { gain: 0.9, x: L.x, z: L.z });
      fx.puffs.emit(new THREE.Vector3(L.x, 0, L.z), 18, 2.6, 1.4, t);
      fx.bursts.add('ground', new THREE.Vector3(L.x, 0.06, L.z), 9, 0.9, t, 0, 0.7, 0.3, 0.1);
      moment.kick(0.9);
    }
  };
  let staged: 'noose' | 'rope' | 'ride' | null = null;
  let heroHid = false;
  let dimOn = false;
  const kOffer = new Offer(
    moment,
    offerSpec(m, () => ({
      x: king.sim.hx,
      y: king.sim.hanging ? 4.2 : 1.9,
      z: king.sim.hz,
      tilt: king.sim.hanging ? 60 : undefined,
      back: king.sim.hanging ? 3.6 : undefined,
    })),
    (r, secs) => qte.show('attack', KING_PRESS[r as 'rope' | 'ride'], secs, input.lastDevice),
  );
  const rKit: KingRewardKit = { fx, kick: s => moment.kick(s), king, end: () => { king.ropeCut = false; king.dip = 0; } };
  const rewardRun = new RewardRun<KingRewardProps>(rKit, { ride: new RideGeo(), rope: new RopeGeo() });
  Object.assign(kSpecs, { ride: rideSpec(king.sim, m, rKit, rewardRun), rope: ropeSpec(king.sim, m, rKit, rewardRun) });
  const kit = { f: fight, pv, k1: king, k2: beneath, fx, hud };
  const turn = new Turn(kit, kDis);
  const intro = new Intro(kit);
  const ending = new Ending(kit);
  const story = new Prologue(kit, court.fires);
  const lessons = new Lessons(fight);

  let omenK = 0;
  let dawnK = 0;
  let turned = false;
  const M0 = new THREE.Color(0xa9c2ea);
  const M1 = new THREE.Color(0xff9a72);
  const F0 = FOG.uFogCol.value.clone();
  const F1 = new THREE.Color(0.010, 0.0042, 0.0046);
  const G0 = FOG.uFogMoon.value.clone();
  const G1 = new THREE.Color(0.05, 0.011, 0.007);
  /** The eclipse: the moon goes red and the light goes out with it, from 0 (the moon) to 1 (the eclipse). */
  const omen = (k: number) => {
    if (Math.abs(k - omenK) < 0.002 && k !== 0) return;
    omenK = k;
    ECLIPSE.value = k;
    moon.color.lerpColors(M0, M1, k);
    moon.intensity = 2.5 - 1.3 * k;
    post.shaft.value.set(0.5 - 0.24 * k, 0.66 - 0.6 * k, 0.9 - 0.87 * k);
    FOG.uFogCol.value.lerpColors(F0, F1, k);
    FOG.uFogMoon.value.lerpColors(G0, G1, k);
    hemi.color.setRGB(0.56 + 0.04 * k, 0.65 - 0.25 * k, 0.8 - 0.3 * k, THREE.LinearSRGBColorSpace);
    hemi.intensity = 0.3 - 0.04 * k;
    RIM.value.set(0.36 + 0.54 * k, 0.45 - 0.17 * k, 0.6 - 0.48 * k, 1.25 + 0.35 * k);
    dust.tint.value.set(0.17 + 0.05 * k, 0.175 - 0.02 * k, 0.19 - 0.07 * k);
    court.omen(k);
    dawn(dawnK, true);
  };
  /** First light, over whatever the sky is doing. */
  const dawn = (k: number, force = false) => {
    if (!force && Math.abs(k - dawnK) < 0.002) return;
    dawnK = k;
    const o = omenK;
    kick.intensity = 0.55 + 0.2 * o + 1.5 * k;
    kick.color.setRGB(0.86 + 0.1 * k, 0.7 - 0.16 * o, 0.6 - 0.28 * o - 0.1 * k);
    hemi.intensity = 0.3 - 0.04 * o + 0.3 * k;
    post.exposure.value = 1.75 + 0.25 * k;
    DAWN.value = k;
  };

  /** The training: the Lessons, with the starter spells and the world held on each press (Lessons.gate). */
  const train = () => {
    lessons.active = true;
    arm();
    bars(false);
    fight.passive = true;
    hud.callout('');
    lessons.start();
    follow.snap(m, king.sim);
    sound.score?.set('lesson');
  };
  lessons.onDone = skipped => {
    lessons.active = false;
    arm();
    saveSettings({ learned: true });
    if (!skipped) prompts.taught();
    begin();
    sound.play('kScreech', { gain: 0.9, wet: 0.6, bus: 'voice' });
    hud.say(skipped ? KING_LESSON.skipped : KING_LESSON.taught, 2.6, 'place');
  };
  // the intro is the shell's IntroRun: the King's own scene is the Prologue (play) and his intro is the one the step drives
  const introRun: IntroRun = {
    get active() {
      return intro.active;
    },
    start: () => intro.start(),
    stop: () => {},
    rest: () => {
      intro.kneel();
      king.settle();
    },
    onEnd: () => {},
  };
  const noPrompts = () => story.active || lessons.active;

  return {
    intro: introRun,
    turn,
    ending,
    play: () => story.start(),
    sceneBusy: () => story.active,
    noPrompts,
    spells: (): [SpellId, SpellId] => (lessons.active ? DEFAULT_SPELLS : settings.spells),
    train,
    hudOverride() {
      hud.next = 'On to the river';
      hud.onNext = () => {
        location.search = '?boss=2';
      };
      hud.onRestart = () => {
        if (lessons.active) {
          train();
          return;
        }
        fight.reset(fight.phase === 'won');
      };
      hud.onSkip = () => lessons.skip();
    },
    warm: on => omen(on ? 1 : 0),
    before(dt: number, t: number, ev0: Press[], walk: Vec2): Pre {
      let ev = ev0;
      let mx = 0;
      let mz = 0;
      if (menuOpen()) {
        intro.kneel();
      } else if (story.active) {
        if (story.t > 0.6 && ev.some(e => !e.up)) story.skip();
        else story.step(dt, t);
        court.flames(story.flame);
        omen(story.omen);
        dir.mono = story.mono;
        dir.inkWant = story.ink;
        dir.dark = story.dark;
        if (!story.active) {
          court.flames(1);
          omen(0);
          dir.inkWant = 0;
          dir.dark = 0;
          intro.start();
        }
        ev = [];
      } else if (intro.active) {
        if (intro.t > 0.6 && ev.some(e => !e.up)) intro.skip();
        else mz = intro.step(dt, t);
        if (!intro.active) {
          if (settings.learned) begin();
          else train();
        }
        ev = [];
      } else {
        mx = walk.x;
        mz = walk.z;
      }
      if (turn.active && ev.some(e => !e.up)) turn.skip();
      if (ending.active && !ending.over && ev.some(e => !e.up)) ending.skip();
      if (lessons.active) ev = lessons.gate(ev as { a: string; up: boolean }[]) as typeof ev;
      // a reward press (only while its chance lasts) starts the hero's scene; a staged moment has the hero, not the player
      qte.step(dt);
      if (qte.on && ev.some(e => e.a === 'attack' && !e.up) && king.sim.takeReward()) qte.hide();
      if (moment.active) {
        mx = 0;
        mz = 0;
      } // the fight drops his presses while a moment is on, and keeps the releases
      return { ev, mx, mz, hold: lessons.active && !!lessons.frozen };
    },
    after(_sd: number, dt: number, t: number) {
      // a reward scene: the hero's clip runs on the scene's clock, and its beats (the blows) fire on the frame they land
      if (king.sim.rite) {
        if (rewardRun.kind !== king.sim.rite) {
          beginReward(kingClip(king.sim.rite), m);
          rewardRun.begin(king.sim.rite);
        }
        syncReward(m, king.sim.stage);
        if (king.sim.rite === 'ride') rideBeats(king.sim, m, rKit, rewardRun, king.sim.stage, t);
        else ropeBeats(king.sim, m, rKit, rewardRun, king.sim.stage, t);
      } else if (rewardRun.kind) {
        rewardRun.end(m);
      }
      {
        const want = king.sim.staging;
        if (want !== staged) {
          staged = want;
          if (want) {
            qte.hide();
            moment.start(kSpecs[want]);
          } else {
            moment.stop();
          }
        }
      }
      // a staged moment's cues: its sound, its dust, its shake; and its letterbox (the bars slide in and out by themselves)
      for (const name of moment.due(king.sim.stage)) kingCue(name, t);
      document.body.classList.toggle('letter', moment.letterbox);
      // a reward on offer: the slow low shot, then the press (plain English), until the chance lapses
      kOffer.step(dt, king.sim.reward, king.sim.rewardLeft, king.sim.staging !== null);
      pv.tumble = moment.hero(king.sim.stage, pv.offset);
      // first person: the hero's own body and eye glow are out of the lens; a dim (a flash, a fall) goes over the picture
      if (heroHid !== moment.hideHero) {
        heroHid = moment.hideHero;
        pv.group.visible = !heroHid;
        pv.eye.mesh.visible = !heroHid;
        pv.blade.mesh.visible = !heroHid;
      }
    },
    tick(sd: number, dt: number, t: number) {
      lessons.step(dt, sd);
      hud.lesson(lessons.active ? lessons.card : null);
      turn.step(dt, t);
      ending.step(dt, t);
      if (!story.active) dir.mono = Math.max(turn.mono, lessons.mono);
      if (turn.active) {
        omen(turn.omen);
        dawn(turn.dawn);
        court.flames(turn.flame);
        post.exposure.value = (1.75 + 0.25 * turn.dawn) * turn.dim + turn.flash * (settings.flash ? 3.2 : 0.6);
        dir.dark = turn.dark;
        turned = true;
      } else if (turned) {
        turned = false;
        court.flames(1);
        dir.dark = 0;
        post.exposure.value = 1.75;
      } else if (ending.active) {
        omen(1 - ending.clear);
        dawn(ending.dawn);
      } else if (fight.round === 2 && omenK < 1) {
        omen(1);
      }
      if (sound.score && /^(still|vigil|lesson)$/.test(sound.score.mood) && !menuOpen() && !intro.active && !story.active && !turn.active && !lessons.active && fight.round === 1) {
        sound.score.set('spar');
      }
      if (sound.score && (story.active || intro.active)) sound.score.set('vigil');
      if (sound.score && lessons.active) sound.score.set('lesson');
      if (sound.score && sound.score.mood === 'spar' && fight.hits > 2) sound.score.set('r1');
      {
        const c0 = m.clip?.name;
        const on = (c0 === 'rites' && m.t < 4.4) || c0 === 'finale';
        if (on !== document.body.classList.contains('cut')) document.body.classList.toggle('cut', on);
      }
      court.storm(fight.round === 2 && fight.phase !== 'won' ? (fight.brain.style === 'eclipse' ? 1 : 0.3) : 0);
      post.heat.value = omenK * 0.8;
      {
        const md = moment.dimAt(king.sim.stage);
        if (md > 0 || dimOn) {
          dir.dark = md;
          dimOn = md > 0;
        }
      }
    },
    blocker: () => ({ x: king.sim.x, z: king.sim.z, r: king.sim.y > 0.6 || king.sim.hanging ? -9 : 0.8 }),
    clock: () => king.sim.stage,
    reset() {
      staged = null;
      kOffer.reset();
      king.sim.clearMoments();
      dawn(0);
      bDis.value = 0;
      kDis.value = 0;
      dimOn = false;
      if (fight.round === 1) omen(0);
    },
    begin() {
      hud.lesson(null);
      kDis.value = 0;
      bDis.value = 0;
    },
    toMenu() {
      if (lessons.active) {
        lessons.active = false;
        lessons.frozen = null;
      }
      hud.lesson(null);
      omen(0);
      intro.kneel();
      king.settle();
    },
    turnEnd() { /* the round-2 start: the shell's follow snap is all */ },
    round2: () => omen(1),
    theatreReset: () => omen(0),
    tap() { /* a touch tap does nothing in his scenes */ },
    decay: () => story.active || intro.active || turn.active || ending.active || menuOpen(),
    camera(cam, ms, t) {
      if (turn.active) {
        turn.camera(cam, t);
        return true;
      }
      if (ending.active) {
        ending.camera(cam, t);
        return true;
      }
      if (story.active) {
        story.camera(cam, t);
        return true;
      }
      if (intro.active) {
        intro.camera(cam, t, c.baseFov());
        return true;
      }
      return !!(moment.active && moment.camera(cam, Math.min(ms / 1000, 0.05), king.sim.stage, t));
    },
    followTarget() {
      const K = king.sim;
      const h = K.y * 0.6 + (K.hanging ? 1.7 : K.crawling ? 1.2 : /kneel|fall|crash/.test(K.mode) ? 1.5 : K.form === 2 ? 1.9 : 2.2);
      return { x: K.hx, z: K.hz, solid: !K.hanging && K.y < 0.5, h };
    },
    frame(cam, ms) {
      moment.settle(cam, Math.min(ms / 1000, 0.05));
    },
    end(_sd, _dt, _t) {
      // the cue sits at the hand, which is at the lens in first person: it goes while the moment plays
      if (moment.hideHero) dir.cue.mesh.visible = false;
    },
    bench: async (run): Promise<BenchRun | null> => {
      if (!c.BENCH) return null;
      const { mountBench } = await import('../../bench.ts');
      const modes = c.BENCH === 'beneath' ? BENEATH_MODES : KING_MODES;
      return mountBench({
        scene: c.scene,
        cam: c.cam,
        m,
        pv,
        king: c.BENCH === 'beneath' ? beneath : king,
        clips: { ...KHANDA.clips, ...BODY_CLIPS },
        kingClips: KING_CLIPS,
        modes,
        which: c.BENCH,
        step: run.step,
        setTime: run.setTime,
      });
    },
    debug: () => ({ __story: story, __lessons: lessons, __kOffer: kOffer }),
  };
}

/** The Hanged King's voice: the director's cue names to his sounds, and his breath between attacks. */
const KING_WORDS: BossWords = {
  voice: { pain: 'kPain', pain2: 'bPain', screech: 'kScreech', roar: 'bRoar', breath: 'kBreath', death: 'kDeath', death2: 'bDeath' },
  idleBreath: 'kBreath', flame: KING_TITLES.flame, quenched: KING_TITLES.quenched, broken: KING_CALLS.broken, crushed: KING_CALLS.crushed, lastRites: KING_CALLS.lastRites,
};
/** The score's mood for each of his brain's styles. */
const KING_MOODS: Record<string, Mood> = { executioner: 'r1', crawler: 'crawl', hanged: 'hang', blades: 'r2', eclipse: 'eclipse' };

export const kingSpec: FightPageSpec<KingParts> = {
  bossId: 'king',
  status: 'Lighting the pyres',
  heroAsh: { skin: 0.12, held: 0.12 },
  names: { r1: 'The Hanged King', r2: 'The One Beneath', won: 'Morning, at Last' },
  words: KING_WORDS,
  score: { r1: 'spar', r2: 'r2' },
  beaten: 1,
  shots: SHOTS,
  direct: c => !!(c.SHOT || c.BENCH || c.Q.has('nointro') || c.Q.has('turn') || c.Q.has('round2')),
  build: buildKing,
  wire: wireKing,
};

export async function bootKing(c: Ctx): Promise<void> {
  await fightPage(c, kingSpec);
}
