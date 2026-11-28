// The hero's reward shots, shared by every boss that offers one: a short scene the hero earns with a press. Each has a wind-up aimed at its
// target, a contact frame where the blade meets the target (the damage lands there, in the simulation; the hit-stop, sparks, shake and sound
// land there here), and a landing in control. The hero's pose comes from a clip the boss builds (retime, warp and compose turn the khanda's own
// strikes into one) and the scene starts (beginReward), driven by the moment's own clock (syncReward), so the blade and the strike stay in step
// with the simulation whatever the boss's temper. A boss keeps its own props (geometry), timings and views: it hands RewardRun its props, and
// its kit's end() clears its view's flags. Nothing here names a boss.

import * as THREE from 'three';
import { clip, type Clip, type ClipDef, type Key } from '../anim/pose.ts';
import type { Motor } from '../player/motor.ts';
import type { Fx } from '../render/impact.ts';
import { RewardChain } from './rewardChain.ts';

/** A reward's name (a boss's own rite): the run only keeps it. */
export type RewardKind = string;
/** What a reward scene needs from the page: the effects, the camera shake, and the boss's own reset when a scene ends. */
export interface RewardKit { fx: Fx; kick(v: number): void; /** Clears what the boss's scene set on its own view, when the scene ends. */ end?(): void }
/** A prop a scene drives (its geometry): the run clears its ready flag when a scene begins and when it ends. */
export interface RewardProp { ready: boolean }

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
/** Starts the reward's clip on the hero: the scene's clock is the clip's clock from now on. */
export function beginReward(pose: Clip, m: Motor) {
  m.beginClip(pose);
}
/** Keeps the hero's pose on the scene's clock (the simulation's stage), so the blow is on the frame it lands. */
export function syncReward(m: Motor, stage: number) { if (m.state === 'clip' && m.clip) m.t = stage; }

/** One reward's run: the wall-clock hit-stop, and the effects that fire once at each cue. */
export class RewardRun<P extends Record<string, RewardProp> = Record<string, RewardProp>> {
  kind: RewardKind | null = null; /** The hero's drawn offset on the last frame: where he really stands once the scene lets go of him. */ last = V(); rope2: RewardChain | null = null; ropeBroken = false; private hitAts = new Map<number, number>(); chain: RewardChain | null = null; private lastT = -1; /** Seconds since the last call, from the scene's clock (0 on the first). */ tick(time: number) { const d = this.lastT < 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastT)); this.lastT = time; return d; } private hitAt = -1; private fired = new Set<string>();
  private kit: RewardKit;
  /** The boss's own props, by name: its scenes drive them; the run clears their ready flags. */
  readonly props: P;
  constructor(kit: RewardKit, props: P) { this.kit = kit; this.props = props; }
  private clearProps() { for (const p of Object.values<RewardProp>(this.props)) p.ready = false; }
  begin(kind: RewardKind) { this.kind = kind; this.clearProps(); this.ropeBroken = false; this.hitAts.clear(); this.lastT = -1; this.hitAt = -1; this.fired.clear(); }
  end(m?: Motor) { if (m) { m.x += this.last.x; m.z += this.last.z; } this.last.set(0, 0, 0); this.clearProps(); this.ropeBroken = false; this.rope2?.hide(); this.hitAts.clear(); this.lastT = -1; this.chain?.hide(); this.kit.end?.(); this.kind = null; this.hitAt = -1; this.fired.clear(); }
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
