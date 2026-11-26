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
  kind: RewardKind | null = null; private hitAt = -1; private fired = new Set<string>();
  private kit: RewardKit;
  constructor(kit: RewardKit) { this.kit = kit; }
  begin(kind: RewardKind) { this.kind = kind; this.hitAt = -1; this.fired.clear(); }
  end() { this.kind = null; this.hitAt = -1; this.fired.clear(); if (this.kit.river) this.kit.river.lampHidden = false; }
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
/** The lantern hangs at the top of his pole, a little out from him toward the hero. */
function lanternAt(sim: River, u: { x: number; z: number }, out = V()) { return out.set(sim.x + u.x * 0.7, 3.5, sim.z + u.z * 0.7); }
export function lanternSpec(sim: River, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const away = () => { const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; return { x: ux, z: uz, sx: -uz, sz: ux }; };
  const H = LANTERN.hit, rise = 0.55, land = 1.9;
  /** The hero's spot at the blow: a leap's length out from the Ferryman, on the hero's side of the pole. */
  const spot = (out: THREE.Vector3) => { const u = away(); return out.set(sim.x + u.x * 1.6, 0, sim.z + u.z * 1.6); };
  const L = V(), S = V(), mid = V();
  return {
    frame: (t, eye, at) => {
      const u = away(), lp = lanternAt(sim, u, L), s = spot(S), hx = m.x + (s.x - m.x) * E(rise, H, t), hz = m.z + (s.z - m.z) * E(rise, H, t), hy = 1.2 * Math.max(0, 1 - ((t - H) / (land - rise) * 2) ** 2);
      mid.set((hx + lp.x) / 2, (hy + lp.y) / 2 + 0.4, (hz + lp.z) / 2);
      if (t < rise) { // the wind-up: low, at his side, the hero and the lantern both in shot
        const k = E(0, rise, t); eye.set(m.x + u.sx * 3.0 + u.x * 1.0, 1.1 + 0.2 * k, m.z + u.sz * 3.0 + u.z * 1.0); at.set(m.x * (1 - 0.4 * k) + lp.x * 0.4 * k, 1.5 + 1.2 * k, m.z * (1 - 0.4 * k) + lp.z * 0.4 * k); return 48;
      }
      if (t < H) { // the leap and the cut: a side-on shot that keeps the blade and the lantern in one frame
        const k = E(rise, H, t); eye.set(mid.x + u.sx * 3.9 + u.x * 0.6, 1.8 + 0.5 * k, mid.z + u.sz * 3.9 + u.z * 0.6); at.copy(mid); return 50 - 4 * k;
      }
      if (t < land + 0.8) { // the reel and the landing: pulls back to show the Ferryman go, then the hero on his feet
        const k = E(H, land + 0.8, t); eye.set(sim.x + u.x * 6.2 + u.sx * 2.6, 2.3 - 0.4 * k, sim.z + u.z * 6.2 + u.sz * 2.6); at.set(sim.x * (1 - k) + hx * k, 2.1 - 1.1 * k, sim.z * (1 - k) + hz * k); return 50;
      }
      const k = E(land + 0.8, LANTERN.len, t); eye.set(hx + u.sx * 2.6 - u.x * (1.4 - 0.4 * k), 1.4, hz + u.sz * 2.6 - u.z * (1.4 - 0.4 * k)); at.set(hx, 1.4, hz); return 46;
    },
    hero: (t, o) => {
      const u = away(), s = spot(S), hx = (s.x - m.x) * E(rise, H, t), hz = (s.z - m.z) * E(rise, H, t);
      const crouch = t < rise ? -0.22 * Math.sin(Math.PI * t / rise) : 0, air = t >= rise && t < land ? 1.2 * Math.max(0, 1 - ((t - H) / (land - rise) * 2) ** 2) : 0;
      o.set(hx, t < land ? crouch + air : -0.12 * Math.sin(Math.PI * Math.min(1, (t - land) / 0.8)), hz);
      void u;
    },
    rate: t => run.rate(t, H, performance.now()),
    letterbox: true,
    cues: [{ t: rise, name: 'leap' }, { t: H, name: 'shatter' }, { t: land, name: 'land' }],
  };
}
/** The lantern's own beats on the scene's clock: the leap's whoosh, the shatter, the landing. Called each frame while the lantern scene runs. */
export function lanternBeats(sim: River, m: Motor, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const { fx } = kit, L = lanternAt(sim, { x: (m.x - sim.x) / (Math.hypot(m.x - sim.x, m.z - sim.z) || 1), z: (m.z - sim.z) / (Math.hypot(m.x - sim.x, m.z - sim.z) || 1) });
  run.once('leap', t, LANTERN.hit - 0.7, () => sound.play('whooshH', { gain: 0.6, wet: 0.5 }));
  run.once('shatter', t, LANTERN.hit, () => {
    sound.play('boom', { gain: 0.9, wet: 0.4 }); sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('slam', { gain: 0.6, wet: 0.3 });
    fx.bursts.add('fire', L.clone(), 2.6, 0.9, time); fx.bursts.add('flare', L.clone(), 3.4, 0.5, time); fx.bursts.add('ring', L.clone(), 1.6, 0.4, time);
    fx.sparks.emit(L.clone(), V(0, 0.7, 0), 90, 5, 1.6, 0.6, time); fx.sparks.emit(L.clone(), V(0, 0.2, 0), 40, 2.4, 2.2, 0.2, time);
    fx.puffs.emit(L.clone(), 12, 1.8, 1.4, time); kit.kick(1.0); if (kit.river) kit.river.lampHidden = true;
  });
  run.once('land', t, LANTERN.len - 1.0, () => sound.play('thud', { gain: 0.5, wet: 0.3 }));
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
