// The hero's four reward shots (module A, fix-reward-scenes): the Ferryman's lantern and chain, the King's rope and ride.
// Each one is a short scene the hero earns with a press. It has a wind-up aimed at its target, a contact frame where the blade meets the target
// (the damage lands there, in the simulation; the hit-stop, sparks, shake and sound land there here), and a landing in control.
// The hero's pose comes from a clip the scene starts (`begin`) and is driven by the moment's own clock (`sync`), so the blade and the strike
// stay in step with the simulation whatever the boss's temper. Timings are the simulation's (LANTERN, CHAIN, RIP, RIDE): the moment's clock is the boss's `stage`.
import * as THREE from 'three';
import { clip, type Clip, type ClipDef, type Key } from '../anim/pose.ts';
import { sound } from '../audio/sound.ts';
import type { MomentSpec } from './moment.ts';
import type { Motor } from '../player/motor.ts';
import type { Fx } from '../render/impact.ts';
import { KHANDA } from '../weapons/khanda.ts';
import { CHAIN, LANTERN, type River } from '../boss/river/river.ts';
import type { RiverView } from '../boss/river/riverView.ts';
import { RIDE, RIP, type King } from '../boss/king.ts';

export type RewardKind = 'lantern' | 'chain' | 'rope' | 'ride';
/** What a reward scene needs from the page: the effects, the sound, the camera shake, and the clock. */
export interface RewardKit { fx: Fx; kick(v: number): void; /** The lantern's view, when the scene shows it (the Ferryman's). */ river?: RiverView }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** Hit-stop, in real milliseconds: the frame the blade lands holds still this long, whatever the moment's clock says. */
export const HITSTOP_MS = 100;

/** A clip of the khanda's own strike, retimed: `map` sends each authored key time to the scene's time, and the clip ends at `dur`. No hit windows, so the
 *  blow lands only where the scene says it does, and no root travel, so the hero stays where the scene puts him. */
function retime(name: string, src: Clip, dur: number, map: (t: number) => number): Clip {
  const keys: Key[] = src.keys.map(k => ({ ...k, t: Math.min(dur, Math.max(0, map(k.t))) })).filter((k, i, a) => i === 0 || k.t >= a[i - 1].t);
  if (keys[keys.length - 1].t < dur) keys.push({ ...keys[keys.length - 1], t: dur });
  const def: ClipDef = { dur, blend: 0.06, keys };
  return clip(name, def);
}
/** Piecewise-linear time map through (from, to) pairs. */
const warp = (pairs: [number, number][]) => (t: number) => { if (t <= pairs[0][0]) return pairs[0][1]; for (let i = 1; i < pairs.length; i++) { const [a, ta] = pairs[i - 1], [b, tb] = pairs[i]; if (t <= b) return ta + (tb - ta) * (t - a) / (b - a); } return pairs[pairs.length - 1][1]; };

/** The reward's clip, built once from the khanda's vertical two-handed cut (light3) for the lantern and chain, and its heavy crescent for the King. */
const CLIPS: Partial<Record<RewardKind, Clip>> = {};
function clipFor(kind: RewardKind): Clip {
  if (CLIPS[kind]) return CLIPS[kind]!;
  const c = KHANDA.clips; let made: Clip;
  if (kind === 'lantern') made = retime('rewardLantern', c.light3, LANTERN_LEN, warp([[0, 0.5], [0.2, 1.0], [0.255, LANTERN.hit], [0.33, LANTERN.hit + 0.3], [0.74, 2.7], [0.74, LANTERN_LEN]]));
  else if (kind === 'chain') made = retime('rewardChain', c.light3, CHAIN_LEN, warp([[0, 0.5], [0.2, 1.1], [0.255, CHAIN.hit], [0.33, CHAIN.hit + 0.3], [0.74, 2.9], [0.74, CHAIN_LEN]]));
  else if (kind === 'rope') made = retime('rewardRope', c.light5, RIP.len + 0.5, warp([[0, 0.3], [0.53, RIP.cut], [1.5, RIP.len + 0.5]]));
  else made = retime('rewardRide', c.heavy, RIDE.len, warp([[0, 0.4], [0.26, RIDE.hit], [1.25, RIDE.len]]));
  CLIPS[kind] = made; return made;
}
const LANTERN_LEN = LANTERN.len, CHAIN_LEN = CHAIN.len;

/** Starts the reward's clip on the hero: the scene's clock is the clip's clock from now on. */
export function beginReward(kind: RewardKind, m: Motor) {
  m.beginClip(clipFor(kind));
}
/** Keeps the hero's pose on the scene's clock (the simulation's stage), so the blow is on the frame it lands. */
export function syncReward(m: Motor, stage: number) { if (m.state === 'clip' && m.clip) m.t = stage; }

/** One reward's run: the wall-clock hit-stop, and the effects that fire once at each cue. */
export class RewardRun {
  kind: RewardKind | null = null; /** The hero's drawn offset on the last frame: where he really stands once the scene lets go of him. */ last = V(); lantern = new LanternGeo(); private hitAt = -1; private fired = new Set<string>();
  private kit: RewardKit;
  constructor(kit: RewardKit) { this.kit = kit; }
  begin(kind: RewardKind) { this.kind = kind; this.lantern.ready = false; this.hitAt = -1; this.fired.clear(); }
  end(m?: Motor) { if (m) { m.x += this.last.x; m.z += this.last.z; } this.last.set(0, 0, 0); this.lantern.ready = false; if (this.kit.river) this.kit.river.poleAim = null; this.kind = null; this.hitAt = -1; this.fired.clear(); if (this.kit.river) this.kit.river.lampHidden = false; }
  /** A once-only cue on the scene's clock. */
  once(name: string, t: number, at: number, f: () => void) { if (t >= at && !this.fired.has(name)) { this.fired.add(name); f(); } }
  /** The moment's rate: slow into a blow, then hold for HITSTOP_MS of real time on the frame it lands. */
  rate(t: number, hit: number, now: number): number {
    if (t < hit) return t > hit - 0.2 ? 0.5 : 1;
    if (this.hitAt < 0) this.hitAt = now;
    return now - this.hitAt < HITSTOP_MS ? 0.02 : 1;
  }
}

// ---------------------------------------------------------------- the Ferryman's lantern
/** The scene's numbers. He kneels and swings his pole out so the lamp hangs ahead of him at a height a leap can reach; the hero leaps, cuts it down, springs back and lands braced. */
const LEAP = { from: 0.5, apex: 1.1, peak: 1.5, gap: 1.25, back: 1.3, off: 1.0, brace: 0.7, lampY: 2.8, bear: 0.62, swing: 0.45 };
const LEAP_END = LEAP.apex + (LEAP.apex - LEAP.from);
/** The hero's height at scene time t: a crouch, the leap (gravity), a braced landing. */
function leapY(t: number) {
  const g = 2 * LEAP.peak / ((LEAP.apex - LEAP.from) ** 2);
  if (t < LEAP.from) return -0.22 * Math.sin(Math.PI * t / LEAP.from);
  if (t < LEAP_END) return LEAP.peak - 0.5 * g * (t - LEAP.apex) ** 2;
  return -0.3 * Math.sin(Math.PI * Math.min(1, (t - LEAP_END) / LEAP.brace));
}
/** The lantern's bearing and the hero's place at each time: the geometry shared by the camera, the hero, the beats. */
export class LanternGeo {
  ux = 0; uz = 0; bx = 0; bz = 0; side = 1; ready = false; /** From the cut on the lamp is gone and the pole swings back: its last place stands for it. */ frozen = false; arena = 21; start = V(); L = V(); A = { x: 1, z: 0 };
  /** Fixed on the scene's first frame: the bearing of the swung pole, from the Ferryman, a little off the hero's line. */
  init(sim: River, m: Motor) {
    const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1; this.ux = dx / d; this.uz = dz / d;
    const c = Math.cos(LEAP.bear), s = Math.sin(LEAP.bear); this.bx = this.ux * c - this.uz * s; this.bz = this.ux * s + this.uz * c; this.arena = m.arena; this.start.set(m.x, 0, m.z); this.side = (-this.bz * this.ux + this.bx * this.uz) >= 0 ? 1 : -1; this.ready = true;
  }
  /** The lamp's own place (read from the view), and the line from the Ferryman to it. */
  lamp(sim: River, kit: RewardKit, t = 0) {
    if (t >= LANTERN.hit) this.frozen = true; else this.frozen = false;
    if (this.frozen) { /* keep L as it was at the cut */ } else if (kit.river) kit.river.lantern.getWorldPosition(this.L); else this.L.set(sim.x + this.bx * 5.6, LEAP.lampY, sim.z + this.bz * 5.6);
    const dx = this.L.x - sim.x, dz = this.L.z - sim.z, d = Math.hypot(dx, dz) || 1; this.A.x = dx / d; this.A.z = dz / d; return this.L;
  }
  /** The hero's world place at t (the feet): from where he stood, to a sword's reach from the lamp, then back and down. */
  hero(t: number, out: THREE.Vector3) {
    const H = LANTERN.hit, o = LEAP.off * this.side, lim = this.arena - 0.8, keep = (x: number, z: number) => { const q = Math.hypot(x, z); return q > lim ? [x * lim / q, z * lim / q] : [x, z]; };
    const [cx, cz] = keep(this.L.x - this.A.x * LEAP.gap - this.A.z * o, this.L.z - this.A.z * LEAP.gap + this.A.x * o), [lx, lz] = keep(cx - this.A.x * LEAP.back, cz - this.A.z * LEAP.back);
    const k = E(LEAP.from, H, t), r = E(H, LEAP_END, t);
    return out.set(this.start.x + (cx - this.start.x) * k + (lx - cx) * r, leapY(t), this.start.z + (cz - this.start.z) * k + (lz - cz) * r);
  }
}
export function lanternSpec(sim: River, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const H = LANTERN.hit, geo = run.lantern, P = V(), F = V(), B = V();
  return {
    frame: (t, eye, at) => {
      if (!geo.ready) geo.init(sim, m); const lp = geo.lamp(sim, kit, t), hp = geo.hero(t, P), k = E(0.2, H, t), r = E(H, 2.2, t);
      // the camera stands on the hero's side of the line from the Ferryman to the lamp, side-on, so the sweep of the pole, the leap and the cut are all in profile
      const sx = -geo.A.z, sz = geo.A.x, sg = geo.side;
      B.set(sim.x, 1.4, sim.z);
      // the focus: the Ferryman and the lamp, then the hero and the lamp, then the hero and the Ferryman
      F.set((B.x + lp.x) / 2, 2.1, (B.z + lp.z) / 2); const cx = (hp.x + lp.x) / 2, cz = (hp.z + lp.z) / 2, cy = (hp.y + 1.2 + lp.y) / 2;
      F.x += (cx - F.x) * k; F.z += (cz - F.z) * k; F.y += (cy - F.y) * k;
      F.x += ((sim.x + hp.x + lp.x) / 3 - F.x) * r; F.z += ((sim.z + hp.z + lp.z) / 3 - F.z) * r; F.y += (1.7 - F.y) * r;
      const dist = 8.2 - 3.4 * k + 4.4 * r, fov = 46 - 6 * k + 9 * r;
      eye.set(F.x + sx * sg * dist + geo.A.x * -0.8, 1.8 + 0.5 * k - 0.4 * r, F.z + sz * sg * dist + geo.A.z * -0.8); at.copy(F); return fov;
    },
    hero: (t, o) => { if (!geo.ready) geo.init(sim, m); const hp = geo.hero(t, P); o.set(hp.x - m.x, hp.y, hp.z - m.z); run.last.copy(o); },
    rate: t => run.rate(t, H, performance.now()),
    letterbox: true,
    cues: [{ t: LEAP.from, name: 'leap' }, { t: H, name: 'shatter' }, { t: LEAP_END, name: 'land' }],
  };
}
/** The lantern's own beats on the scene's clock: the pole swung out, the leap's whoosh, the shatter (glass, burning oil, a flare that dies), the landing. Called each frame while the scene runs. */
export function lanternBeats(sim: River, m: Motor, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const { fx } = kit, geo = run.lantern; if (!geo.ready) geo.init(sim, m);
  if (kit.river) kit.river.poleAim = { x: geo.bx, z: geo.bz, y: LEAP.lampY, k: E(0, LEAP.swing, t) * (1 - E(1.35, 2.1, t)) };
  // he faces the lamp through the leap, then the Ferryman as he lands
  { const lp = geo.lamp(sim, kit, t), px = m.x + run.last.x, pz = m.z + run.last.z, want = t < LANTERN.hit + 0.1 ? Math.atan2(lp.x - px, lp.z - pz) : Math.atan2(sim.x - px, sim.z - pz); let d = want - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * Math.min(1, 0.25 + (t > LANTERN.hit ? 0.1 : 0)); }
  run.once('leap', t, LEAP.from, () => sound.play('whooshH', { gain: 0.6, wet: 0.5 }));
  run.once('shatter', t, LANTERN.hit, () => {
    const L = geo.L.clone();
    sound.play('break', { gain: 1, wet: 0.4 }); sound.play('boom', { gain: 0.9, wet: 0.4 }); sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('slam', { gain: 0.6, wet: 0.3 });
    fx.bursts.add('fire', L.clone(), 2.2, 0.6, time); fx.bursts.add('flare', L.clone(), 3.0, 0.3, time); fx.bursts.add('ring', L.clone(), 1.6, 0.4, time);
    fx.bursts.add('flare', L.clone(), 1.6, 0.25, time, 0.4, 0.9, 1.1, 1.3); // the glass: a pale flash among the orange
    fx.sparks.emit(L.clone(), V(0, 0.7, 0), 90, 6, 2.2, 1.4, time); // burning oil, thrown wide, falling
    fx.sparks.emit(L.clone(), V(0, 0.2, 0), 50, 4, 3.2, 1.0, time); // shards
    fx.sparks.emit(L.clone(), V(0, 1, 0), 14, 2, 0.6, -2.2, time); // embers that hang
    fx.puffs.emit(L.clone(), 10, 1.8, 1.2, time); kit.kick(1.0); if (kit.river) kit.river.lampHidden = true;
  });
  run.once('land', t, LEAP_END, () => { sound.play('thud', { gain: 0.6, wet: 0.3 }); kit.fx.puffs.emit(V(m.x + run.last.x, 0, m.z + run.last.z), 7, 1.6, 0.9, time); });
}

// ---------------------------------------------------------------- the Ferryman's chain
/** The chain's middle, where the blade comes down on it: between the anchor where it was cut and the boat, at the height of a knee. */
function chainPoint(sim: River, out = V()) { const a = sim.lastAnchor; return out.set(a.x + (sim.x - a.x) * 0.5, 0.9, a.z + (sim.z - a.z) * 0.5); }
export function chainSpec(sim: River, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const away = () => { const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; return { x: ux, z: uz, sx: -uz, sz: ux }; };
  const H = CHAIN.hit, rise = 0.5, land = H + 0.9;
  const S = V(), C = V(), mid = V();
  const spot = (u: { x: number; z: number }) => chainPoint(sim, C).add(V(u.x * 1.3, 0, u.z * 1.3));
  return {
    frame: (t, eye, at) => {
      const u = away(), c = chainPoint(sim, C), s = spot(u), hx = m.x + (s.x - m.x) * E(rise, H, t), hz = m.z + (s.z - m.z) * E(rise, H, t), hy = 0.6 * Math.max(0, 1 - ((t - H) / (land - rise) * 2) ** 2);
      mid.set((hx + c.x) / 2, (hy + c.y) / 2 + 0.5, (hz + c.z) / 2); void S;
      if (t < rise) { const k = E(0, rise, t); eye.set(m.x + u.sx * 3.0 + u.x * 1.2, 1.0, m.z + u.sz * 3.0 + u.z * 1.2); at.set(m.x + (c.x - m.x) * 0.4 * k, 1.0, m.z + (c.z - m.z) * 0.4 * k); return 48; }
      if (t < H) { const k = E(rise, H, t); eye.set(mid.x + u.sx * 3.6, 1.6 + 0.3 * k, mid.z + u.sz * 3.6); at.copy(mid); return 50 - 4 * k; }
      const k = E(H, land + 0.8, t); eye.set(sim.x + u.x * 5.0 + u.sx * 3.0, 1.8 - 0.3 * k, sim.z + u.z * 5.0 + u.sz * 3.0); at.set(sim.x * (1 - k) + c.x * k, 1.4 - 0.4 * k, sim.z * (1 - k) + c.z * k); return 50;
    },
    hero: (t, o) => {
      const u = away(), s = spot(u), hx = (s.x - m.x) * E(0.5, H, t), hz = (s.z - m.z) * E(0.5, H, t);
      const crouch = t < 0.5 ? -0.2 * Math.sin(Math.PI * t / 0.5) : 0, air = t >= 0.5 && t < land ? 0.6 * Math.max(0, 1 - ((t - H) / (land - 0.5) * 2) ** 2) : 0;
      o.set(hx, t < land ? crouch + air : -0.1 * Math.sin(Math.PI * Math.min(1, (t - land) / 0.8)), hz);
    },
    rate: t => run.rate(t, H, performance.now()),
    letterbox: true,
    cues: [{ t: rise, name: 'leap' }, { t: H, name: 'snap' }],
  };
}
export function chainBeats(sim: River, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const C = chainPoint(sim);
  run.once('leap', t, CHAIN.hit - 0.8, () => sound.play('whooshH', { gain: 0.6, wet: 0.5 }));
  run.once('snap', t, CHAIN.hit, () => {
    sound.play('chainCut', { gain: 1, wet: 0.4 }); sound.play('chainSnap', { gain: 1, wet: 0.5 }); sound.play('boom', { gain: 0.6, wet: 0.3 });
    kit.fx.sparks.emit(C.clone(), V(0, 0.8, 0), 90, 7, 1.4, 0.8, time); kit.fx.puffs.emit(C.clone(), 8, 2, 1, time); kit.kick(0.9);
  });
}

/** The Ferryman's two rewards, built on the river's clock, and the run that times them. */
export function riverRewards(sim: River, m: Motor, kit: RewardKit, run: RewardRun): Pick<Record<RewardKind, MomentSpec>, 'lantern' | 'chain'> {
  return { lantern: lanternSpec(sim, m, kit, run), chain: chainSpec(sim, m, kit, run) };
}
