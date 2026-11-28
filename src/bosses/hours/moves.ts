// The Sister of Hours (form 1) and the Pall (form 2): what each move threatens, and when. No rendering imports.
// Cues keep their meanings: white = dodge or guard, red = dodge, ground = leave the glowing area or jump it.
import type { Strike, Zone } from '../../boss/strike.ts';

const D = Math.PI / 180;
const line = (len: number, half: number, delay: number, yaw = 0): Zone => ({ shape: 'line', at: 'self', len, half, delay, yaw });
export type HoursMode = 'idle' | 'stalk' | 'strafe' | 'blink' | 'reap' | 'harvest' | 'hourWheel' | 'binding' | 'cleanSheet' | 'lieDown' | 'betweenBeds' | 'sevenBreaths' | 'lostCount' | 'burnt'
  | 'hourHand' | 'drawSheet' | 'wardStands' | 'noon' | 'lastBreath' | 'hemLash' | 'longCount' | 'gather' | 'grip' | 'pierced' | 'sag' | 'reel' | 'reel2' | 'kneel' | 'fall' | 'rise' | 'die';

export const HOURS_ATTACKS: Record<string, Strike[]> = {
  // --- the Scythe
  reap: [{ kind: 'white', cue: 0.4, t: [1.02, 1.16], dmg: 10, low: true, mark: 'cleaver', arc: [5.0, 100] }, { kind: 'white', cue: 1.5, t: [1.86, 2.0], dmg: 11, mark: 'cleaver', arc: [5.0, 100] }],
  harvest: [{ kind: 'red', cue: 1.22, t: [1.62, 1.74], dmg: 16, down: true, mark: 'cleaver', box: [4.2, 0.9] }],
  hourWheel: [[1.15, 1.3], [1.75, 1.9], [2.35, 2.5]].map((t, i) => ({ kind: 'white' as const, cue: i ? t[0] - 0.3 : 0.4, t: t as [number, number], dmg: 8, mark: 'cleaver' as const, arc: [4.3, 180] as [number, number] })),
  // --- the Linen
  binding: [{ kind: 'ground', cue: 0.35, t: [1.15, 1.3], dmg: 9, mark: 'handL', zones: [-0.45, 0, 0.45].map(y => line(9, 0.55, 0.8, y)) }],
  cleanSheet: [{ kind: 'ground', cue: 0.4, t: [1.75, 1.9], dmg: 12, down: true, mark: 'head', zones: [{ shape: 'circle', at: 'player', r: 3.3, delay: 1.35 }] }],
  lieDown: [{ kind: 'red', cue: 0.55, t: [1.25, 1.4], dmg: 18, down: true, mark: 'handL', box: [3.0, 0.8] }],
  betweenBeds: [{ kind: 'white', cue: 1.1, t: [1.7, 1.85], dmg: 11, mark: 'cleaver', arc: [4.0, 120] }],
  // --- the Count: seven breaths; the whole floor but the dark circle at her feet
  sevenBreaths: [{ kind: 'ground', cue: 0.6, t: [6.0, 6.25], dmg: 16, down: true, mark: 'head', zones: [{ shape: 'circle', at: 'self', r: 16, inner: 2.8, delay: 5.4 }] }],
  // --- the Pall
  hourHand: [{ kind: 'ground', cue: 0.4, t: [1.0, 3.6], dmg: 11, low: true, mark: 'cleaver', zones: [{ shape: 'sweep', at: 'self', len: 15, half: 0.8, inner: 3.4, yaw: -100 * D, spin: 200 * D, dur: 2.6, delay: 0.6 }] }],
  drawSheet: [{ kind: 'ground', cue: 0.4, t: [1.7, 1.85], dmg: 15, down: true, mark: 'head', zones: [{ shape: 'circle', at: 'player', r: 4.2, delay: 1.3 }] }],
  wardStands: [{ kind: 'ground', cue: 0.35, t: [1.25, 1.4], dmg: 10, mark: 'cleaver', zones: [-0.8, -0.4, 0, 0.4, 0.8].map(y => line(12, 0.7, 0.9, y)) }],
  noon: [{ kind: 'ground', cue: 0.4, t: [1.5, 1.62], dmg: 14, down: true, mark: 'cleaver', zones: [{ shape: 'circle', at: 'player', r: 2.4, delay: 1.1 }] }, { kind: 'ground', cue: 0.4, t: [1.55, 1.65], dmg: 7, mark: 'cleaver', zones: [{ shape: 'ring', at: 'player', delay: 1.15, speed: 8, max: 7 }] }],
  lastBreath: [[1.0, 1.2], [1.35, 1.55], [1.7, 1.9], [2.05, 2.25]].map(t => ({ kind: 'red' as const, cue: 0.45, t: t as [number, number], dmg: 6, mark: 'head' as const, arc: [9.0, 22] as [number, number] })),
  hemLash: [{ kind: 'white', cue: 0.45, t: [1.0, 1.14], dmg: 10, mark: 'head', arc: [4.6, 180] }],
  /** The Gathering: a linen arm sent straight at you. Caught, you are held (the view plays it); missed, the arm lies on the floor to be cut. */
  gather: [{ kind: 'red', cue: 0.35, t: [0.95, 1.05], dmg: 0, silent: true, mark: 'cleaver', zones: [line(11, 1.0, 0.6)] }],
  longCount: [{ kind: 'ground', cue: 0.6, t: [6.0, 6.25], dmg: 16, down: true, mark: 'head', zones: [{ shape: 'circle', at: 'self', r: 18, inner: 3.4, delay: 5.4 }] }],
};
for (const l of Object.values(HOURS_ATTACKS)) for (const q of l) q.dmg = Math.round(q.dmg * 1.3);
/** Each later lastBreath gust only cues once: the first carries the warning. */
HOURS_ATTACKS.lastBreath.forEach((q, i) => { if (i) q.cue = q.t[0] - 0.3; });
