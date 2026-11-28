// The shared fight page. A boss page (src/bosses/<id>/page.ts) is a FightPageSpec and calls fightPage(c, spec) from its boot.
//
// fightPage owns what every boss page has in common: the textures, the hero (skins, fx, PlayerView, Motor, Fight, Prompts,
// Hud, FollowCam, Director), the menu, the pause triggers, the one reset, begin and toMenu, the step and draw skeletons,
// the warm-up, the theatre mount and the loop. The boss owns the rest.
//
// What a boss page provides:
//   bossId, status, heroAsh, names, score, beaten, shots: plain data (see FightPageSpec).
//   build(kit): loads its own geometry, builds its arena (group, ruin, update), its referee's sim and brain, its two views
//     (round 1, round 2) and any extra it needs later (lights, meshes). The shell has already made the hero and the fx.
//   wire(kit): makes its scenes (intro, turn, ending), its director and its staged moments, and returns the Wired hooks.
// Each Wired hook is called where a page's own order needs it; the comment on each member says where and why.
import * as THREE from 'three';
import { regainFullscreen } from '../core/fullscreen.ts';
import { onSettings, saveSettings, settings } from '../core/settings.ts';
import { SPELLS, type SpellId } from '../combat/spells.ts';
import type { Ctx } from '../core/boot.ts';
import type { Tier } from '../core/quality.ts';
import { startLoop } from '../core/loop.ts';
import { loadGeo, loadTextures } from '../render/assets.ts';
import { DEPTH, FOG, SHARED, surface, type SurfOpt } from '../render/surface.ts';
import { Dust, Puffs, Sparks } from '../render/fx.ts';
import { Bursts, type Fx } from '../render/impact.ts';
import { skinnedShadow } from '../render/shadowProxy.ts';
import { Motor, type Press } from '../player/motor.ts';
import { PlayerView } from '../player/view.ts';
import { KHANDA } from '../weapons/khanda.ts';
import { Fight } from '../combat/fight.ts';
import { Prompts } from '../ui/prompts.ts';
import { Hud } from '../ui/hud.ts';
import { Menu } from '../ui/menu.ts';
import { padNav } from '../ui/padnav.ts';
import { sound } from '../audio/sound.ts';
import type { Mood } from '../audio/score.ts';
import { Director, type Court } from './director.ts';
import type { BossWords } from '../boss/words.ts';
import { FollowCam, menuCam } from './camera.ts';
import { Moment, Prompt } from './moment.ts';
import { actionCam } from './actionCam.ts';
import type { Boss, BossBrain } from '../boss/boss.ts';
import type { BossView } from '../boss/view.ts';
import type { Ruin } from '../arena/ruin.ts';
import { mountTheatre, type MomentPlan } from '../dev/theatre.ts';
import { fightList, type BossId } from '../bosses/index.ts';

type Tex = Awaited<ReturnType<typeof loadTextures>>;
type Mat = THREE.MeshStandardMaterial;
type Shot = [number[], number[], number];
type Vec3 = { value: THREE.Vector4 };

/** The hero's and the boss's skin: the surface shader with the page's hit flash, dissolve and extras. */
export type Skin = (d: { value: number }, f: Vec3, at: Vec3, more?: object) => Mat;
export type Surf = (o?: SurfOpt) => Mat;

/** The arena: the court the director and the referee use, plus its group and its per-frame update. */
export type Arena = Court & { group: THREE.Object3D; update(t: number, focus: THREE.Vector3): void; ruin: Ruin };

/** What build() returns: the arena, the sim and brain of the referee, and the two views. A boss may add its own keys. */
export interface Parts {
  arena: Arena;
  sim: Boss;
  brain: BossBrain;
  views: [BossView, BossView];
}

/** What build() is given: the page's context, the textures, the hero's fx and held-weapon material, and the skin makers. */
export interface BuildKit {
  c: Ctx;
  tex: Tex;
  lod: string;
  fx: Fx;
  dust: Dust;
  held: Mat;
  skin: Skin;
  surf: Surf;
}

/** What wire() is given: the built parts and the shell's objects. `menuOpen` reads the menu, which is made after wire.
 *  `begin`, `arm` and `bars` are the shell's own (a fresh start, the spell pair, the letterbox), for a page that calls them. */
export interface WireKit<P extends Parts> {
  c: Ctx;
  parts: P;
  m: Motor;
  fight: Fight;
  pv: PlayerView;
  fx: Fx;
  hud: Hud;
  prompts: Prompts;
  follow: FollowCam;
  dir: Director;
  moment: Moment;
  qte: Prompt;
  surf: Surf;
  menuOpen: () => boolean;
  begin: () => void;
  arm: () => void;
  bars: (on: boolean) => void;
}

/** What bench() gets back: the workbench's camera and its clock (the tools/bench.ts mount). */
export interface BenchRun {
  camera(): void;
  tick(dt: number): void;
}

export interface IntroRun {
  active: boolean;
  /** Seconds into the intro (read by the tools; a page that wraps its intro passes it on). */
  readonly t?: number;
  start(): void;
  stop(): void;
  rest(): void;
  onEnd: () => void;
}
export interface TurnRun {
  active: boolean;
  rate: number;
  mono: number;
  start(): void;
  stop(): void;
  onEnd: () => void;
}
export interface EndRun {
  active: boolean;
  start(): void;
  stop(): void;
}

export interface Vec2 {
  x: number;
  z: number;
}

/** What Wired.before hands the referee: the events it may see and the walk it may take. */
export interface Pre {
  ev: Press[];
  mx: number;
  mz: number;
  /** The referee is held this frame (no step, the presses dropped): a boss's training, while the world waits for a press. */
  hold?: boolean;
}

/** What wire() returns: the scenes and the hooks. Each comment says where the shell calls the hook, and why it is there. */
export interface Wired {
  intro: IntroRun;
  turn: TurnRun;
  ending: EndRun;
  /** Before the referee, in the boss's own order: the menu and intro movement, the scene presses, the reward or climb press,
   *  and the moment's hold on the hero. Returns the events and the walk the referee takes. */
  before(dt: number, t: number, ev: Press[], walk: Vec2): Pre;
  /** After the referee (sd is the seconds it simulated), before the views move: the reward scene, staging, under-water beats,
   *  the hero's pose, or the freeze on a hit. */
  after(sd: number, dt: number, t: number): void;
  /** After the turn wait: the turn and ending clocks, and the boss's director step. */
  tick(sd: number, dt: number, t: number): void;
  /** The boss's footprint for the arena's push (the shell adds push: 3.2). */
  blocker(): { x: number; z: number; r: number };
  /** The stage a moment's pace and timing read (the boss's clock). */
  clock(): number;
  /** The one reset (every death, the retry, the menu, a fresh start's fight.onReset): the boss's staged state and director. */
  reset(): void;
  /** A fresh start after the intro: the boss's director only. */
  begin(): void;
  /** The menu return: the boss's view and rest, after the scenes are stopped. */
  toMenu(): void;
  /** The turn scene has ended (the round-2 start): the boss's follow-up. */
  turnEnd(): void;
  /** A round-2 start (?round2 and the theatre): the boss's director round two. */
  round2(): void;
  /** The theatre's reset, before the shell shows the views. */
  theatreReset(): void;
  /** A touch tap, for a scene that waits for one. */
  tap(t: number): void;
  /** Whether the hero's trauma decays this frame (a film is on). */
  decay(): boolean;
  /** The scene and moment camera. True if one took the camera. The order of the scenes is the boss's. */
  camera(cam: THREE.PerspectiveCamera, ms: number, t: number): boolean;
  /** Where the follow camera looks, from the boss's state. */
  followTarget(): { x: number; z: number; solid: boolean; h: number };
  /** After the camera chain and before the HUD: the boss's frame work (the moment's settle, the letterbox). */
  frame(cam: THREE.PerspectiveCamera, ms: number): void;
  /** Extra window debug globals for the tools. */
  debug(): Record<string, unknown>;
  // The hooks below are optional: a page that has no such thing leaves them out (some bosses do not).
  /** The menu's Play starts the boss's own scene (a boss's opening scene). Default: the intro. */
  play?(): void;
  /** A scene that holds the world and the pause (a boss's opening scene). Pause, the busy checks and the film are off while it plays. */
  sceneBusy?(): boolean;
  /** Prompts are hidden while this holds (a boss's opening scene and training). */
  noPrompts?(): boolean;
  /** The spell pair the hero is armed with, when it is not the player's (a boss's training uses the starter pair). */
  spells?(): [SpellId, SpellId];
  /** The menu's Training button, for a page that has one in place (default: the ?train page). */
  train?(): void;
  /** The HUD's callbacks, after the shell's own defaults: the page's next fight, its restart and its skip. */
  hudOverride?(hud: Hud): void;
  /** The shell's warm-up render, bracketed: on before the draw, off after it (a boss's eclipse state is drawn once). */
  warm?(on: boolean): void;
  /** After the director step, last in the frame: the page's own visibility or highlight that must follow it. */
  end?(sd: number, dt: number, t: number): void;
  /** The workbench (?bench=): mounted after the round setup; its camera replaces the page's, and its tick replaces the step. */
  bench?(run: { step(dt: number): void; setTime(v: number): void }): Promise<BenchRun | null>;
}

/** The data and the two builders a boss page is. */
export interface FightPageSpec<P extends Parts> {
  /** The fight id: the menu list, the ?boss= page and the moment theatre read it. */
  bossId: BossId;
  /** The loading line. */
  status: string;
  /** The hero's and the held weapon's ash. */
  heroAsh: { skin: number; held: number };
  /** The HUD names: the two rounds and the win line. */
  names: { r1: string; r2: string; won: string };
  /** What the boss says: its voice, the breath, the titles and the callouts (the director reads it). */
  words: BossWords;
  /** The boss's moment plan for the moment theatre (?moment=, src/dev/theatre.ts). */
  moment: MomentPlan;
  /** The sound mood for round 1 and round 2. */
  score: { r1: Mood; r2: Mood };
  /** The bit this boss sets in settings.beaten when won. */
  beaten: number;
  /** The fixed cameras for ?shot=. */
  shots: Record<string, Shot>;
  /** Whether the page starts with no menu (the hero already in the fight). Default: the shot, the skip, the turn, round 2, a moment. */
  direct?(c: Ctx): boolean;
  build(k: BuildKit): Promise<P>;
  wire(k: WireKit<P>): Wired;
}

function makeFx(tier: Tier): Fx {
  return {
    sparks: new Sparks(Math.round(900 * tier.particles), tier.particles),
    gore: new Sparks(Math.round(260 * tier.particles), tier.particles, true),
    puffs: new Puffs(),
    bursts: new Bursts(),
  };
}

export async function fightPage<P extends Parts>(c: Ctx, spec: FightPageSpec<P>): Promise<void> {
  const { Q, tier, renderer, scene, cam, moon, moonDir, post, dyn, resize, input, app, focus, status, SHOT, BENCH } = c;
  // a still frame (a shot, the workbench) draws with no HUD, no sound, no quality drift and no page-hide pause
  const quiet = !!(SHOT || BENCH);
  status(spec.status);
  if (!quiet) sound.load();
  const tex = await loadTextures(tier, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const lod = tier.name === 'high' ? '.lo' : '.xs';
  const surf: Surf = o => surface(tex, tier, o);
  const skin: Skin = (d, f, at, more = {}) => surf({ ash: spec.heroAsh.skin, fx: { dis: d, flash: f, at, ...more } });
  const [gPlayer, gPlayerLo, gKhanda, sPlayer] = await Promise.all([
    loadGeo('player'),
    loadGeo('player', '.xs'),
    loadGeo(KHANDA.geo),
    loadGeo('player', lod),
  ]);
  const dis = { value: 0 };
  const pFlash = { value: new THREE.Vector4(1, 0.3, 0.1, 0) };
  const pAt = { value: new THREE.Vector4(0, 0, 0, 1) };
  const aura = { value: 0 };
  const pMat = skin(dis, pFlash, pAt, { aura });
  const pHeld = skin(dis, pFlash, pAt, { aura });
  const held = surf({ world: false, ash: spec.heroAsh.held });
  const fx = makeFx(tier);
  const dust = new Dust(tier.name === 'phone' ? 40 : 110);
  scene.add(fx.sparks.mesh, fx.puffs.mesh, fx.gore.mesh, fx.bursts.mesh, dust.mesh);
  const pv = new PlayerView(scene, gPlayer, gPlayerLo, gKhanda, pMat, pHeld, DEPTH, fx, tier.name === 'phone' ? 2 : 4, KHANDA);
  pv.dis = dis;
  pv.flash = pFlash;
  pv.flashAt = pAt;
  pv.aura = aura;
  if (tier.name !== 'phone') {
    pv.glow = new THREE.PointLight(0xff9450, 1, 6, 1.6);
    scene.add(pv.glow);
  }
  const m = new Motor(KHANDA);
  const parts = await spec.build({ c, tex, lod, fx, dust, held, skin, surf });
  const { arena, sim, brain } = parts;
  const [v1, v2] = parts.views;
  const fight = new Fight(m, sim, brain);
  const prompts = new Prompts();
  const hud = new Hud(app, input, spec);
  fight.furnish(arena.ruin.props);
  fight.passive = !!(quiet || Q.has('still'));
  const still = fight.passive;
  arena.ruin.fx = fx;
  arena.ruin.dust = dust;
  pv.shadow = skinnedShadow(pv.mesh, sPlayer, DEPTH.skin);
  if (tier.name === 'phone') {
    pv.weapon.castShadow = false;
    if (v1.cleaver) v1.cleaver.castShadow = false;
  }
  const follow = new FollowCam();
  follow.blockers = m.blockers;
  const moment = new Moment();
  const qte = new Prompt(app);
  const dir = new Director({
    f: fight, pv, views: parts.views, fx, cam: follow, post, hud, input, camera: cam, court: arena, words: spec.words,
  });
  scene.add(dir.cue.mesh, dir.marks.mesh, dir.crescents.group);
  /** The spell pair the hero is armed with: the page's own while it has one (a boss's training), else the player's. */
  const arm = () => {
    const sp = wired.spells?.() ?? settings.spells;
    m.spells = [...sp];
    hud.spells(SPELLS[sp[0]], SPELLS[sp[1]]);
    prompts.spells(SPELLS[sp[0]], SPELLS[sp[1]]);
  };
  let menu: Menu;
  const wired: Wired = spec.wire({
    c, parts, m, fight, pv, fx, hud, prompts, follow, dir, moment, qte, surf,
    menuOpen: () => menu.open,
    begin: () => begin(),
    arm,
    bars: on => bars(on),
  });
  // after wire: onSettings runs its listener at once, and the spell pair reads the page's hook
  onSettings(() => {
    brain.temper = settings.temper;
    arm();
  });
  const { intro, turn, ending } = wired;
  let turnWait = -1;
  let t = 0;
  let frames = 0;
  dir.onHalf = () => {
    turnWait = 0.9;
    if (Q.has('turn')) fight.passive = false;
  };
  dir.onWon = () => {
    saveSettings({ beaten: settings.beaten | spec.beaten });
    ending.start();
  };
  turn.onEnd = () => {
    follow.snap(m, sim);
    wired.turnEnd();
  };
  const direct = spec.direct ? spec.direct(c) : !!(SHOT || Q.has('nointro') || Q.has('turn') || Q.has('round2') || Q.has('moment'));
  m.z = direct ? 5.2 : 15.5;
  /** The one reset: every death, the retry, the menu and a fresh start run it (Fight resets the fight, this clears the page). */
  fight.onReset = () => {
    moment.reset();
    qte.hide();
    ending.stop();
    turn.stop();
    wired.reset();
    prompts.reset();
    turnWait = -1;
    hud.verse('');
    sound.score?.set(fight.round === 2 ? spec.score.r2 : spec.score.r1);
  };
  hud.onRestart = () => {
    fight.reset(fight.phase === 'won');
  };
  for (const e of ['pointerdown', 'keydown', 'touchend']) {
    addEventListener(e, () => {
      sound.unlock();
      sound.startScore();
    });
  }
  // a phone has no buttons in the scenes: a tap anywhere lights the boat when the scene is waiting for it
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') wired.tap(t);
  });
  const bars = (on: boolean) => document.body.classList.toggle('cine', on);
  menu = new Menu(app, () => hud.controls());
  menu.fights(fightList(spec.bossId));
  const toMenu = () => {
    hud.setPaused(false);
    moment.stop();
    qte.hide();
    hud.verse('');
    ending.stop();
    turn.stop();
    wired.reset();
    turnWait = -1;
    fight.reset(true);
    fight.passive = true;
    prompts.reset();
    m.revive(0, 12.2, Math.PI);
    pv.reset();
    bars(false);
    intro.stop();
    wired.toMenu();
    follow.yaw = 0.12;
    sound.score?.set('still');
    menu.show();
  };
  hud.onMenu = toMenu;
  hud.onResume = regainFullscreen;
  hud.next = '';
  hud.onSkip = () => {};
  wired.hudOverride?.(hud);
  // the pause triggers: the menu, a scene and the win are never paused by focus loss
  const busy = () => menu.open || intro.active || turn.active || ending.active || fight.phase === 'won' || (wired.sceneBusy?.() ?? false);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !busy() && !quiet) hud.setPaused(true);
  });
  addEventListener('gamepaddisconnected', () => {
    if (input.lastDevice === 'pad' && !busy()) hud.setPaused(true);
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && !busy() && !hud.paused && !m.dead) hud.setPaused(true);
  });
  const grab = () => {
    input.drain();
    if (matchMedia('(pointer: fine)').matches && !document.body.classList.contains('touch')) {
      Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
    }
  };
  const begin = () => {
    bars(false);
    fight.reset(true);
    fight.passive = still;
    wired.begin();
    follow.snap(m, sim);
    hud.refill();
    sound.score?.set(spec.score.r1);
  };
  menu.onPlay = () => {
    regainFullscreen();
    if (wired.play) wired.play();
    else intro.start();
    bars(true);
    fight.time = 0;
    grab();
  };
  menu.onTrain = () => {
    if (wired.train) {
      wired.train();
      grab();
    } else {
      location.search = '?train';
    }
  };
  intro.onEnd = () => {
    begin();
  };
  const bill = () => {
    const o: [number, string][] = [];
    scene.traverseVisible(x => {
      const q = x as THREE.InstancedMesh;
      if (!q.isMesh) return;
      const g = q.geometry;
      const per = g.index?.count ?? g.attributes.position.count;
      const ig = g as THREE.InstancedBufferGeometry;
      const inst = q.isInstancedMesh ? q.count : ig.instanceCount < 1e6 ? ig.instanceCount ?? 1 : 1;
      const n = per / 3 * inst;
      const shadow = q.castShadow ? ' x2 (shadow)' : '';
      const insts = q.isInstancedMesh ? ' x' + q.count : '';
      o.push([n * (q.castShadow ? 2 : 1), `${Math.round(n)}${shadow}  ${q.type}${insts}`]);
    });
    return o.sort((x, y) => y[0] - x[0]).slice(0, 14).map(x => x[1]);
  };

  const step = (dt: number) => {
    input.poll();
    let ev = input.drain();
    if (padNav(input)) ev = ev.filter(e => e.a === 'pause' && !menu.open);
    if (ev.some(e => e.a === 'pause' && !e.up) && !turn.active && !intro.active && !(wired.sceneBusy?.() ?? false) && fight.phase !== 'won') {
      hud.setPaused(!hud.paused);
    }
    if (hud.paused) return;
    const pace = turn.active ? turn.rate : moment.active ? moment.rate(wired.clock()) : 1;
    t += dt * pace;
    FOG.uFogP.value.w = SHARED.uTime.value = t;
    const s = Math.sin(follow.yaw), cc = Math.cos(follow.yaw), mv = input.move;
    const pre = wired.before(dt, t, ev, { x: mv.x * cc - mv.y * s, z: -mv.x * s - mv.y * cc });
    // a held frame: the referee does not step and the presses it was given are dropped (a boss's training)
    const sd = pre.hold ? 0 : fight.step(dt * pace, pre.mx, pre.mz, pre.ev), kv = dir.kv;
    if (pre.hold) fight.ev.length = 0;
    wired.after(sd, dt, t);
    if (sd > 0) {
      kv.update(sd, m.x, m.z, t);
      pv.update(sd, m, t);
    } else {
      kv.frozen(t);
    }
    if (turnWait > 0 && (turnWait -= dt) <= 0) turn.start();
    wired.tick(sd, dt, t);
    if (!menu.open && !intro.active && !moment.active && !qte.on && !(wired.noPrompts?.() ?? false)) prompts.step(sd, fight);
    else if (moment.active || qte.on) prompts.current = null;
    arena.ruin.step(sd, t, [
      { x: m.x, z: m.z, r: m.y > 0.6 ? -9 : 0.35, push: 1 + m.speed * 0.25 },
      { ...wired.blocker(), push: 3.2 },
    ]);
    follow.blockers = m.blockers;
    dir.step(sd, dt, t);
    wired.end?.(sd, dt, t);
  };

  renderer.compile(scene, cam);
  resize();
  arena.ruin.warm(true);
  pv.ghosts.warm(true);
  dir.cue.mesh.visible = true;
  for (const r of [pv.blade, pv.eye]) r.mesh.visible = true;
  v2.show(true);
  dir.crescents.group.children.forEach(x => {
    x.visible = true;
  });
  wired.warm?.(true);
  post.render(scene, cam, moon, 0);
  wired.warm?.(false);
  arena.ruin.warm(false);
  pv.ghosts.warm(false);
  dir.cue.mesh.visible = false;
  v2.show(false);
  dir.crescents.group.children.forEach(x => {
    x.visible = false;
  });
  const round2 = () => {
    v1.show(false);
    v2.show(true);
    sim.form = 2;
    fight.beginRound2();
    wired.round2();
  };
  if (Q.has('round2')) round2();
  if (Q.has('turn')) {
    bars(false);
    fight.bossHp = 1;
    fight.hits = 5;
    fight.passive = true;
  }
  // the workbench (?bench=) mounts here, after the round setup and before the warm-up
  const bench = wired.bench ? await wired.bench({ step, setTime: v => { t = FOG.uFogP.value.w = SHARED.uTime.value = v; } }) : null;
  hud.warm(true);
  for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 40));
  hud.warm(false);
  if (!direct) {
    m.revive(0, 12.2, Math.PI);
    pv.reset();
    fight.passive = true;
    bars(false);
    // ?train (the Ferryman's and the Sister's Training buttons load it) starts the page's training from the load, as its own
    // Training button does; a page with no training shows its menu as before
    const training = Q.has('train') && !!wired.train;
    if (!training) menu.show();
    intro.rest();
    if (training) wired.train!();
  }
  document.body.classList.toggle('fps', Q.has('fps'));
  document.body.classList.add('ready');
  if (quiet) document.body.classList.add('bare');
  const fps = document.getElementById('fps')!;
  let acc = 0;
  let n = 0;

  const draw = (_: number, ms: number) => {
    if (wired.decay()) follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6);
    const SC = (window as unknown as { __shotCam?: Shot }).__shotCam ?? (SHOT ? spec.shots[SHOT] : undefined);
    if (SC) {
      const [pp, ll, ff] = SC;
      cam.position.set(pp[0], pp[1], pp[2]);
      cam.lookAt(ll[0], ll[1], ll[2]);
      cam.fov = ff * (cam.aspect > 1.9 ? 0.92 : 1);
      cam.updateProjectionMatrix();
    } else if (bench) {
      bench.camera();
    } else if (menu.open) {
      menuCam(cam, t, m.x, m.z);
    } else if (wired.camera(cam, ms, t)) {
      /* a scene's or a moment's shot */
    } else if (!fight.m.dead && actionCam(cam, fight, dir.heroT, c.baseFov())) {
      follow.trauma = Math.max(0, follow.trauma - ms / 1000 * 1.6);
    } else {
      follow.update(cam, Math.min(ms / 1000, 0.05), m, wired.followTarget(), input.takeLook(), t, c.baseFov());
    }
    wired.frame(cam, ms);
    if (!quiet && !menu.open) hud.update(Math.min(ms / 1000, 0.05), fight, prompts);
    {
      const fz = cam.userData.focus as THREE.Vector3 | undefined;
      const film = menu.open || turn.active || ending.active || intro.active || (wired.sceneBusy?.() ?? false);
      const on = film || cam.userData.frame === true;
      const want = on && fz ? (menu.open ? 0.4 : film ? 0.8 : 0.6) : 0;
      cam.userData.frame = false;
      post.dof.amt += (want - post.dof.amt) * (want && post.dof.amt < 0.02 ? 1 : Math.min(1, ms / 90));
      if (fz) post.dof.focus = Math.max(0.5, fz.distanceTo(cam.position));
    }
    c.sky.position.copy(cam.position);
    cam.updateMatrixWorld();
    focus.set(m.x, 0, m.z);
    arena.update(t, focus);
    sound.listen(cam.position.x * 0.3 + m.x * 0.7, cam.position.z * 0.3 + m.z * 0.7, follow.yaw);
    const c0 = performance.now();
    renderer.info.reset();
    post.render(scene, cam, moon, t);
    const cpu = performance.now() - c0;
    acc += ms;
    n++;
    frames++;
    if (acc > 500) {
      const info = renderer.info.render;
      const kTris = (info.triangles / 1000) | 0;
      fps.textContent = `${Math.round(1000 * n / acc)} fps  ${tier.name}  x${dyn.scale.toFixed(2)}  ${info.calls} draws  ${kTris}k tris`;
      acc = 0;
      n = 0;
    }
    if (!quiet && frames > 60 && dyn.update(ms)) resize();
    Object.assign(window, {
      __frames: frames, __pos: [m.x, 0, m.z], __info: renderer.info.render, __cpu: cpu, __m: m, __court: arena,
      __king: sim, __pv: pv, __f: fight, __p: prompts, __cam: follow, __turn: turn, __intro: intro, __hud: hud,
      __ending: ending, __sound: sound, __dir: dir, __camPos: () => cam.position.toArray(), __bill: bill,
      __v1: v1, __v2: v2, __post: post, __moment: moment, __qte: qte, __menu: menu, __FOG: FOG, __moon: moon,
      __hemi: c.hemi, __kick: c.kick, ...wired.debug(),
    });
  };
  // ?moment=<name> (and, in dev with ?dev, the moment theatre panel): see src/dev/theatre.ts
  mountTheatre({
    Q,
    boss: spec.bossId,
    plan: spec.moment,
    ctx: () => ({ fight, m, sim, round2, halfway: () => dir.onHalf() }),
    reset: () => {
      hud.onRestart();
      fight.reset(true);
      wired.theatreReset();
      v1.show(true);
      v2.show(false);
    },
  }).boot();
  startLoop(dt => {
    if (bench) bench.tick(dt);
    else step(dt);
  }, draw);
}
