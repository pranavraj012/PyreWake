// The Sister of Hours: poses and moves on the human frame, scaled to her height. The pyre-hook is held like a glaive: right hand low on the shaft, left hand well up it.
// Timing and travel here are what the simulation reads; the poses are what you see. The Pall (form 2) has no limbs: its clips carry only timing and travel.
import { clip, makePose, type Clip, type Key } from '../../anim/pose.ts';

/** Upright and heavy, hook held across the body, its head high and forward. */
export const SSTAND = makePose({ hy: -0.06, hp: 6, hw: -18, sp: 5, sw: 12, np: -6, nw: 8, ra: -32, re: -44, rl: 0.8, ba: 18, be: 56, lg: 1, xl: 8, flx: 0.15, flz: 0.17, flw: 8, frx: -0.15, frz: -0.15, frw: -16 });
const B: Key = { t: 0, hx: 0, hy: -0.06, hz: 0, hp: 6, hw: -18, hr: 0, sp: 5, sw: 12, sr: 0, np: -6, nw: 8, nr: 0, ra: -32, re: -44, rl: 0.8, ba: 18, be: 56, bo: 0, xr: 0, la: 30, le: -30, ll: 0.85, lg: 1, xl: 8, tw: 0, air: 0, flx: 0.15, fly: 0, flz: 0.17, flw: 8, flp: 0, frx: -0.15, fry: 0, frz: -0.15, frw: -16, frp: 0 };
const at = (t: number, k: Partial<Key> = {}): Key => ({ ...B, ...k, t });
const C: Record<string, Clip> = {};

// --- the Hook
/** Low across the floor, flipped over, straight down; then it bites the stone and she has to work it free. */
C.turnPyre = clip('turnPyre', { dur: 3.4, blend: 0.25, move: [[0, 0], [0.9, 0.6], [1.75, 1.1], [3.4, 1.1]], fx: [{ t: 1.0, kind: 'sweep' }, { t: 1.8, kind: 'slam' }], keys: [at(0),
  { t: 0.55, hy: -0.32, hp: 20, hw: -44, sp: 16, sw: -40, nw: 40, ra: -110, re: -40, rl: 0.95, ba: -120, be: -12, flz: 0.42, frz: -0.42 }, { t: 0.92, hw: -50, sw: -46, ra: -118, ba: -128 },
  { t: 1.08, hy: -0.36, hw: 30, sw: 38, nw: -24, ra: 40, re: -40, ba: 96, be: -10 }, { t: 1.42, hy: -0.04, hp: -4, hw: 6, sw: 8, sp: -12, np: 10, ra: -14, re: 72, rl: 0.95, ba: 0, be: 118 },
  { t: 1.78, hy: -0.4, hp: 30, sw: 0, sp: 34, np: -34, ra: -8, re: -24, rl: 1, ba: 0, be: -52, flz: 0.5, frz: -0.4 }, { t: 2.9, hy: -0.38, hp: 28, sp: 30, re: -24, be: -50 }, { t: 3.15, hy: -0.2, hp: 16, sp: 14, re: 10, be: 20 }, at(3.4)] });
/** The butt of the pole straight at your face; she overreaches and stays bent. */
C.closeEyes = clip('closeEyes', { dur: 1.9, blend: 0.18, move: [[0, 0], [0.5, -0.1], [0.75, 1.3], [1.9, 1.3]], fx: [{ t: 0.7, kind: 'thrust' }], keys: [at(0),
  { t: 0.45, hy: -0.18, hp: -2, hw: 30, sp: -6, sw: 30, nw: -20, ra: -60, re: 6, rl: 0.45, ba: -176, be: -6, la: 20, ll: 0.5, flz: -0.1, frz: 0.3 },
  { t: 0.74, hy: -0.3, hp: 28, hw: -10, sp: 26, sw: -14, nw: 10, ra: -6, re: 4, rl: 1, ba: -178, be: -4, flz: 0.6, frz: -0.5 }, { t: 1.6, hy: -0.32, hp: 30, sp: 28 }, at(1.9)] });
/** At a run through the ward, the hook dragged low; then over the shoulder and round behind her. */
C.sweepWard = clip('sweepWard', { dur: 3.0, blend: 0.2, move: [[0, 0], [0.3, 0.2], [1.4, 9.0], [3.0, 9.4]], fx: [{ t: 0.5, kind: 'scrape' }, { t: 0.8, kind: 'scrape' }, { t: 1.1, kind: 'scrape' }, { t: 2.25, kind: 'sweep' }], keys: [at(0),
  { t: 0.3, hy: -0.28, hp: 24, hw: -30, sp: 22, sw: -30, nw: 30, ra: -100, re: -50, rl: 0.95, ba: -150, be: -14, la: 40, le: -40 }, { t: 1.3, hy: -0.3, hp: 26, hw: -34, sw: -34, ra: -104, ba: -156 },
  { t: 1.7, hy: -0.1, hp: 4, hw: 40, sp: -6, sw: 50, nw: -40, ra: 30, re: 60, rl: 0.9, ba: 150, be: 60 }, { t: 2.25, hy: -0.3, hp: 18, hw: -40, sw: -50, nw: 40, ra: -110, re: -10, rl: 1, ba: -110, be: 0 }, { t: 2.7, hw: -36, sw: -44 }, at(3.0)] });

// --- the Linen
/** The hook planted; the sleeves flung forward and the strips laid out in a fan. */
C.binding = clip('binding', { dur: 2.4, blend: 0.22, fx: [{ t: 0.95, kind: 'cloth' }], keys: [at(0),
  { t: 0.5, hy: -0.1, hp: -4, sp: -10, np: 8, ra: -40, re: 20, rl: 0.7, ba: 0, be: 88, lg: 0, la: 60, le: 30, ll: 0.6, xl: 30 },
  { t: 0.95, hy: -0.22, hp: 18, sp: 20, np: -14, la: 8, le: -4, ll: 1, xl: 0 }, { t: 2.0, hp: 16, sp: 18, la: 10, le: -6, ll: 1, lg: 0 }, at(2.4)] });
/** A ward sheet the size of a room, thrown high over you. */
C.cleanSheet = clip('cleanSheet', { dur: 2.6, blend: 0.22, fx: [{ t: 0.85, kind: 'cloth' }], keys: [at(0),
  { t: 0.4, hy: -0.2, hp: 14, sp: 14, ra: -30, re: -50, ba: 0, be: 86, lg: 0, la: 30, le: -60, ll: 0.8 },
  { t: 0.85, hy: 0.02, hp: -10, sp: -18, np: 20, la: 10, le: 74, ll: 1, ra: -20, re: 30 }, { t: 1.4, hp: -4, sp: -6, la: 20, le: 40 }, at(2.6)] });
/** Both arms out, slow and almost kind: to lay you down. */
C.lieDown = clip('lieDown', { dur: 2.6, blend: 0.3, move: [[0, 0], [1.25, 1.0], [2.6, 1.0]], fx: [{ t: 1.3, kind: 'cloth' }], keys: [at(0),
  { t: 0.6, hy: -0.1, hp: 8, sp: 10, np: -10, ra: -40, re: -20, rl: 0.6, ba: -160, be: -60, lg: 0, la: 30, le: -10, ll: 0.6 },
  { t: 1.3, hy: -0.3, hp: 34, sp: 30, np: -30, ra: -14, re: -14, rl: 1, la: 14, le: -14, ll: 1, flz: 0.5, frz: -0.4 }, { t: 2.2, hy: -0.32, hp: 36, sp: 32 }, at(2.6)] });
/** Into the smoke and gone; out of a cot near you, hook first. */
C.betweenBeds = clip('betweenBeds', { dur: 2.8, blend: 0.2, fx: [{ t: 0.3, kind: 'vanish' }, { t: 1.4, kind: 'emerge' }, { t: 1.75, kind: 'sweep' }], keys: [at(0),
  { t: 0.35, hy: -0.5, hp: 30, sp: 30, np: -30 }, { t: 1.4, hy: -0.2, hp: 10, hw: -40, sw: -40, nw: 30, ra: -110, re: 0, rl: 0.95, ba: -120, be: 6 }, { t: 1.78, hw: 40, sw: 46, nw: -30, ra: 60, ba: 110, be: 0 }, { t: 2.4, hw: 36, sw: 40 }, at(2.8)] });

// --- the Count
/** The hook planted, the cord in her fingers; one ember goes out with each breath. */
C.sevenBreaths = clip('sevenBreaths', { dur: 6.8, blend: 0.3, fx: [{ t: 0.4, kind: 'plant' }, { t: 6.0, kind: 'hour' }], keys: [at(0),
  { t: 0.5, hy: -0.04, hp: 0, hw: 0, sp: 0, sw: 0, np: -18, nw: 0, ra: -24, re: 10, rl: 0.75, ba: 6, be: 88, lg: 0, la: 12, le: 10, ll: 0.38, xl: 20 },
  ...[1, 2, 3, 4, 5, 6].map(i => ({ t: 0.6 + i * 0.77, np: -18 + (i % 2) * 6, sp: (i % 2) * 3 })), { t: 5.9, np: 10, sp: -10, la: 50, le: 40, ll: 0.9 }, { t: 6.2, np: -24, sp: 14, la: 40, le: -20 }, at(6.8)] });
/** Three blows while she counts and she loses it: the embers scatter, she reels. */
C.lostCount = clip('lostCount', { dur: 2.6, blend: 0.12, keys: [at(0, { hy: -0.1, hp: -14, sp: -20, np: 24, la: 30, le: 50, ll: 0.5, lg: 0, ra: -40, re: -50, be: 20 }), { t: 0.5, hy: -0.4, hp: 30, sp: 36, np: -40, la: 10, le: 30, ll: 0.4 }, { t: 2.2, hy: -0.38, hp: 28, sp: 34 }, at(2.6)] });
/** Her linen caught: a flinch, the arms beating at it. */
C.burnt = clip('burnt', { dur: 2.0, blend: 0.1, keys: [at(0, { hy: -0.12, hp: -10, sp: -14, np: 20, lg: 0, la: 40, le: 20, ll: 0.6, ra: -60, re: 10, rl: 0.6 }), { t: 0.6, hp: 20, sp: 24, la: -10, le: -30, ra: -10, re: -30 }, { t: 1.2, hp: 4, sp: 6, la: 40, le: 10 }, at(2.0)] });
C.reel = clip('reel', { dur: 1.4, blend: 0.1, keys: [at(0, { hy: -0.1, hp: -18, sp: -22, np: 26 }), { t: 0.5, hy: -0.24, hp: 20, sp: 24, np: -24 }, at(1.4)] });
C.kneel = clip('kneel', { dur: 3.0, blend: 0.3, keys: [at(0), { t: 0.6, hy: -0.7, hp: 30, sp: 30, np: -30, ra: -20, re: -10, be: 80, flz: 0.4, frz: -0.6, frp: 60 }, { t: 2.6, hy: -0.7, hp: 30 }, at(3.0)] });
C.fall = clip('fall', { dur: 6.0, blend: 0.3, keys: [at(0), { t: 0.6, hy: -0.7, hp: 30, sp: 30, np: -30, be: 80, frp: 60, frz: -0.6 }, { t: 5.6, hy: -0.7, hp: 34, sp: 36, np: -40 }, at(6.0, { hy: -0.7, hp: 34, sp: 36 })] });

// --- the Pall: timing only
for (const [n, dur] of [['hourHand', 4.4], ['drawSheet', 4.1], ['wardStands', 2.4], ['noon', 2.4], ['lastBreath', 3.0], ['hemLash', 2.0], ['longCount', 6.8], ['sag', 3.0], ['reel2', 1.4], ['rise', 3.0], ['die', 6.0]] as const)
  C[n] = clip(n, { dur, blend: 0.3, keys: [at(0), at(dur)] });

export const HOURS_CLIPS = C;
