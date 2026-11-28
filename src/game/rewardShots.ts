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
import { RewardChain } from './rewardChain.ts';
import { RideGeo, RopeGeo } from '../bosses/king/kingRewards.ts';
import { KHANDA } from '../weapons/khanda.ts';
import { CHAIN, LANTERN, type River } from '../bosses/river/river.ts';
import type { RiverView } from '../bosses/river/riverView.ts';
import { RIDE, RIP } from '../bosses/king/king.ts';
import type { KingView } from '../bosses/king/kingView.ts';
import { LanternGeo, ChainGeo } from '../bosses/river/rewards.ts';

export type RewardKind = 'lantern' | 'chain' | 'rope' | 'ride';
/** What a reward scene needs from the page: the effects, the sound, the camera shake, and the clock. */
export interface RewardKit { fx: Fx; kick(v: number): void; /** The lantern's view, when the scene shows it (the Ferryman's). */ river?: RiverView; /** The King's view, when the scene shows him (the court's). */ king?: KingView }

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z); export const E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** Hit-stop, in real milliseconds: the frame the blade lands holds still this long, whatever the moment's clock says. */
export const HITSTOP_MS = 100;

/** A clip of the khanda's own strike, retimed: `map` sends each authored key time to the scene's time, and the clip ends at `dur`. No hit windows, so the
 *  blow lands only where the scene says it does, and no root travel, so the hero stays where the scene puts him. */
export function retime(name: string, src: Clip, dur: number, map: (t: number) => number): Clip {
  const keys: Key[] = src.keys.map(k => ({ ...k, t: Math.min(dur, Math.max(0, map(k.t))) })).filter((k, i, a) => i === 0 || k.t >= a[i - 1].t);
  if (keys[keys.length - 1].t < dur) keys.push({ ...keys[keys.length - 1], t: dur });
  const def: ClipDef = { dur, blend: 0.06, keys };
  return clip(name, def);
}
/** Piecewise-linear time map through (from, to) pairs. */
export const warp = (pairs: [number, number][]) => (t: number) => { if (t <= pairs[0][0]) return pairs[0][1]; for (let i = 1; i < pairs.length; i++) { const [a, ta] = pairs[i - 1], [b, tb] = pairs[i]; if (t <= b) return ta + (tb - ta) * (t - a) / (b - a); } return pairs[pairs.length - 1][1]; };

/** The reward's clip, built once from the khanda's vertical two-handed cut (light3) for the lantern and chain, and its heavy crescent for the King. */
const CLIPS: Partial<Record<RewardKind, Clip>> = {};
function clipFor(kind: RewardKind): Clip {
  if (CLIPS[kind]) return CLIPS[kind]!;
  const c = KHANDA.clips; let made: Clip;
  if (kind === 'lantern') made = retime('rewardLantern', c.light3, LANTERN_LEN, warp([[0, 0.55], [0.2, 1.0], [0.255, LANTERN.hit], [0.33, LANTERN.hit + 0.3], [0.74, 2.7], [0.74, LANTERN_LEN]]));
  else if (kind === 'chain') made = retime('rewardChain', c.light3, CHAIN_LEN, warp([[0, 0.4], [0.2, 1.05], [0.285, CHAIN.hit], [0.36, CHAIN.hit + 0.3], [0.74, 2.9], [0.74, CHAIN_LEN]]));
  else if (kind === 'rope') made = retime('rewardRope', c.risingCut, RIP.len, warp([[0, 0.4], [0.2, 0.85], [0.28, 1.0], [0.5, 1.3], [1.05, 1.9]]));
  else made = compose('rewardRide', RIDE.len, RIDE.hits.map((h, i) => i < RIDE.hits.length - 1 ? { src: c.light3, hit: 0.255, at: h, k: 1.1 } : { src: c.light5, hit: 0.53, at: h, k: 0.8 }));
  CLIPS[kind] = made; return made;
}
/** One clip out of several blows: each part is a strike of the khanda, retimed so its authored contact falls at `at` (scaled by `k`), and it runs until the next part's wind-up. */
export function compose(name: string, dur: number, parts: { src: Clip; hit: number; at: number; k: number }[]): Clip {
  const keys: Key[] = [];
  parts.forEach((p, i) => {
    const map = (t: number) => p.at + (t - p.hit) * p.k, from = i === 0 ? 0 : parts[i].at - p.hit * p.k, to = i < parts.length - 1 ? parts[i + 1].at - parts[i + 1].hit * parts[i + 1].k : dur;
    for (const key of p.src.keys) { const t = map(key.t); if (t < from - 1e-6 || t >= to) continue; if (keys.length && t <= keys[keys.length - 1].t) continue; keys.push({ ...key, t }); }
    if (i === 0 && (keys.length === 0 || keys[0].t > 0)) keys.unshift({ ...p.src.keys[0], t: 0 });
  });
  if (keys[keys.length - 1].t < dur) keys.push({ ...keys[keys.length - 1], t: dur });
  return clip(name, { dur, blend: 0.06, keys });
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
  kind: RewardKind | null = null; /** The hero's drawn offset on the last frame: where he really stands once the scene lets go of him. */ last = V(); lantern = new LanternGeo(); chainGeo = new ChainGeo(); ride = new RideGeo(); rope = new RopeGeo(); rope2: RewardChain | null = null; ropeBroken = false; private hitAts = new Map<number, number>(); chain: RewardChain | null = null; private lastT = -1; /** Seconds since the last call, from the scene's clock (0 on the first). */ tick(time: number) { const d = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time; return d; } private hitAt = -1; private fired = new Set<string>();
  private kit: RewardKit;
  constructor(kit: RewardKit) { this.kit = kit; }
  begin(kind: RewardKind) { this.kind = kind; this.lantern.ready = false; this.chainGeo.ready = false; this.ride.ready = false; this.rope.ready = false; this.ropeBroken = false; this.hitAts.clear(); this.lastT = -1; this.hitAt = -1; this.fired.clear(); }
  end(m?: Motor) { if (m) { m.x += this.last.x; m.z += this.last.z; } this.last.set(0, 0, 0); this.lantern.ready = false; this.chainGeo.ready = false; this.ride.ready = false; this.rope.ready = false; this.ropeBroken = false; this.rope2?.hide(); this.hitAts.clear(); this.lastT = -1; this.chain?.hide(); if (this.kit.river) this.kit.river.poleAim = null; if (this.kit.king) { this.kit.king.ropeCut = false; this.kit.king.dip = 0; } this.kind = null; this.hitAt = -1; this.fired.clear(); if (this.kit.river) this.kit.river.lampHidden = false; }
  /** A once-only cue on the scene's clock. */
  once(name: string, t: number, at: number, f: () => void) { if (t >= at && !this.fired.has(name)) { this.fired.add(name); f(); } }
  /** The rate with several blows: slow into each, and hold still for HITSTOP_MS of real time on the frame each lands. */
  rateAt(t: number, hits: readonly number[], now: number): number {
    for (let i = 0; i < hits.length; i++) { const h = hits[i]; if (t < h) return t > h - 0.15 ? 0.5 : 1; if (!this.hitAts.has(i)) this.hitAts.set(i, now); if (now - this.hitAts.get(i)! < HITSTOP_MS) return 0.02; }
    return 1;
  }
  /** The moment's rate: slow into a blow, then hold for HITSTOP_MS of real time on the frame it lands. */
  rate(t: number, hit: number, now: number): number {
    if (t < hit) return t > hit - 0.2 ? 0.5 : 1;
    if (this.hitAt < 0) this.hitAt = now;
    return now - this.hitAt < HITSTOP_MS ? 0.02 : 1;
  }
}
