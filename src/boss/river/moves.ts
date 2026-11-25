// The Ferryman's attack tables, net on and net off: what each move threatens, and when. No rendering imports.
import type { Strike, Zone } from '../moves2.ts';

const circle = (r: number, delay: number, at: Zone['at'] = 'mark'): Zone => ({ shape: 'circle', at, r, delay });
export type RiverMode = 'idle' | 'stalk' | 'strafe' | 'lowWater' | 'sounding' | 'pushOff' | 'turnBoat' | 'cast' | 'haul' | 'haulIn' | 'wheelIron' | 'dragDeep' | 'gather' | 'wrongShore' | 'coldHands'
  | 'thrust' | 'flurry' | 'reap' | 'vault' | 'skim' | 'lamps' | 'reel' | 'reel2' | 'snap' | 'kneel' | 'fall' | 'riseW' | 'die2';
export const FERRY_MODES: RiverMode[] = ['idle', 'stalk', 'strafe', 'lowWater', 'sounding', 'pushOff', 'turnBoat', 'cast', 'haul', 'haulIn', 'wheelIron', 'dragDeep', 'gather', 'wrongShore', 'coldHands', 'reel', 'snap', 'kneel', 'fall'];
export const BARE_MODES: RiverMode[] = ['idle', 'stalk', 'strafe', 'thrust', 'flurry', 'reap', 'vault', 'skim', 'lamps', 'reel2', 'kneel', 'riseW', 'die2'];

export const RIVER_ATTACKS: Record<string, Strike[]> = {
  // --- the Pole
  lowWater: [{ kind: 'white', cue: 0.4, t: [1.0, 1.16], dmg: 11, mark: 'cleaver', arc: [6.0, 100], low: true }],
  sounding: [0.3, 1.0, 1.7].map((c, i) => ({ kind: 'ground' as const, cue: c, t: [c + 0.85, c + 0.97] as [number, number], dmg: 10, down: true, mark: 'cleaver' as const, zones: [circle(1.5, 0.85, 'player'), ...(i === 2 ? [{ shape: 'ring' as const, at: 'player' as const, delay: 0.85, speed: 7, max: 4.6 }] : [])] })),
  pushOff: [{ kind: 'ground', cue: 0.35, t: [1.62, 1.76], dmg: 13, down: true, mark: 'cleaver', zones: [circle(2.7, 1.28)] }],
  turnBoat: [{ kind: 'white', cue: 0.6, t: [1.5, 1.66], dmg: 12, mark: 'cleaver', arc: [6.2, 180], inner: 1.9 }, { kind: 'white', cue: 2.1, t: [3.0, 3.16], dmg: 12, mark: 'cleaver', arc: [6.2, 180], inner: 1.9 }],
  // --- the Chain
  cast: [{ kind: 'ground', cue: 0.3, t: [1.06, 1.14], dmg: 0, mark: 'cleaver', silent: true, zones: [{ shape: 'line', at: 'self', len: 10.5, half: 0.9, delay: 0.76 }] }],
  haul: [],
  haulIn: [{ kind: 'white', cue: 0.7, t: [1.45, 1.6], dmg: 12, down: true, mark: 'cleaver', box: [10.8, 1.0] }],
  wheelIron: [1.3, 2.1, 2.9].map(t => ({ kind: 'white' as const, cue: t - 0.55, t: [t, t + 0.12] as [number, number], dmg: 9, mark: 'cleaver' as const, arc: [5.6, 180] as [number, number] })),
  dragDeep: [{ kind: 'ground', cue: 0.4, t: [1.56, 1.7], dmg: 14, down: true, mark: 'handL', zones: [{ shape: 'line', at: 'mark', len: 7, half: 1.5, delay: 1.15 }] }],
  // --- the Lantern
  gather: [],
  wrongShore: [{ kind: 'ground', cue: 4.5, t: [5.35, 5.45], dmg: 0, mark: 'head', silent: true }],
  coldHands: [{ kind: 'ground', cue: 0.5, t: [1.9, 2.0], dmg: 0, mark: 'head', silent: true }],
  // --- the Unburdened
  thrust: [{ kind: 'red', cue: 0.28, t: [0.64, 0.76], dmg: 14, mark: 'cleaver', box: [5.6, 0.75] }],
  flurry: [0.66, 1.11, 1.55].map((t, i) => ({ kind: 'white' as const, cue: t - 0.42, t: [t, t + 0.1] as [number, number], dmg: 9, mark: 'cleaver' as const, ...(i === 2 ? { box: [5.2, 0.8] as [number, number] } : { arc: [4.3, 110] as [number, number] }) })),
  reap: [{ kind: 'white', cue: 0.5, t: [1.02, 1.2], dmg: 12, mark: 'cleaver', arc: [5.4, 180], low: true }],
  vault: [{ kind: 'ground', cue: 0.3, t: [1.42, 1.54], dmg: 14, down: true, mark: 'cleaver', zones: [circle(2.6, 1.1)] }],
  skim: [{ kind: 'red', cue: 0.3, t: [1.06, 1.2], dmg: 15, down: true, mark: 'cleaver', box: [4.2, 0.9] }],
  lamps: [{ kind: 'ground', cue: 0.5, t: [1.0, 1.1], dmg: 0, mark: 'head', silent: true }],
};
for (const l of Object.values(RIVER_ATTACKS)) for (const q of l) q.dmg = Math.round(q.dmg * 1.3);
