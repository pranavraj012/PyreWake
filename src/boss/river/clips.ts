// The Ferryman's poses and moves, on the King's frame: broad, bent, pole in both hands. Timing is what the simulation reads; poses are what you see.
import { clip, makePose, type Clip, type Key } from '../../anim/pose.ts';

/** Stooped, pole planted beside him, a heavy stance. */
export const FSTAND = makePose({ hy: -0.16, hz: 0.02, hp: 8, hw: 0, sp: 16, sw: -6, np: -22, nw: 0, nr: 4, ra: -32, re: -40, rl: 0.9, ba: -6, be: 84, lg: 0, la: 22, le: -66, ll: 0.93, xl: 6, flx: 0.17, flz: 0.2, flw: 10, frx: -0.17, frz: -0.12, frw: -12 });
/** Unburdened: straight for the first time in years, low and wide, the pole levelled at you like a spear. */
export const DUEL = makePose({ hy: -0.2, hz: 0, hp: 10, hw: -34, sp: 10, sw: 4, np: -16, nw: 30, ra: -56, re: -30, rl: 0.72, ba: -6, be: -4, lg: 1, xl: 4, xr: 10, flx: 0.18, flz: 0.34, flw: -10, frx: -0.18, frz: -0.32, frw: -40 });
const E: Key = { t: 0, hy: -0.34, hz: 0.02, hp: 18, hw: 0, hr: 0, sp: 30, sw: -6, sr: 0, np: -50, nw: 0, nr: 4, ra: -30, re: 4, rl: 0.82, ba: -8, be: 80, bo: 0, lg: 1, la: 40, le: -40, ll: 0.85, xl: 6, tw: 0, air: 0, flx: 0.17, fly: 0, flz: 0.28, flw: 12, flp: 0, frx: -0.17, fry: 0, frz: -0.2, frw: -14, frp: 0 };
const at = (t: number, k: Key = E): Key => ({ ...k, t });
const C: Record<string, Clip> = {};
/** Stab: raised high, driven down, held, drawn out. */
const stab = (t: number): Key[] => [{ t: t - 0.6, hy: -0.3, hp: 8, sp: 14, np: -36, ra: -8, re: 70, rl: 0.95, ba: 0, be: 118, lg: 1, flz: 0.34, frz: -0.2 }, { t: t - 0.12, hy: -0.38, hp: 12, sp: 18, ra: -8, re: 78, ba: 0, be: 108 }, { t, hy: -0.62, hp: 34, sp: 46, np: -70, ra: -6, re: -8, rl: 1, ba: 0, be: -74, flz: 0.6, frz: -0.5 }, { t: t + 0.22, hy: -0.6, hp: 32, sp: 44, be: -74 }];

// --- the Pole
C.lowWater = clip('lowWater', { dur: 3.0, hit: [1.0, 1.16], blend: 0.3, move: [[0, 0], [0.9, 0.2], [1.1, 1.5], [3, 1.5]], fx: [{ t: 1.02, kind: 'sweep' }], keys: [at(0),
  { t: 0.55, hy: -0.86, hp: 34, hw: -50, sp: 30, sw: -48, np: -50, nw: 44, ra: -100, re: -48, rl: 0.95, ba: -122, be: -9, flz: 0.5, frz: -0.5, flw: -30, frw: -20 }, { t: 0.92, hw: -56, sw: -52, ra: -106, ba: -128 },
  { t: 1.05, hy: -0.9, hw: 20, sw: 30, nw: -20, ra: -10, re: -50, ba: 6, be: -9, flz: -0.2, frz: 0.4 }, { t: 1.22, hw: 56, sw: 58, nw: -50, ra: 56, re: -48, ba: 112, be: -8 }, { t: 1.6, hw: 56, sw: 58, ra: 60, ba: 120, be: -4 }, at(3.0)] });
C.sounding = clip('sounding', { dur: 3.6, hit: [1.12, 1.22], hits: [[1.12, 1.22], [1.82, 1.92], [2.52, 2.62]], blend: 0.3, move: [[0, 0], [0.6, 0.3], [3.6, 0.3]], fx: [{ t: 1.15, kind: 'slam' }, { t: 1.85, kind: 'slam' }, { t: 2.55, kind: 'slam' }], keys: [at(0), ...stab(1.15), ...stab(1.85), ...stab(2.55), at(3.6)] });
C.pushOff = clip('pushOff', { dur: 3.4, blend: 0.3, fx: [{ t: 0.82, kind: 'launch' }, { t: 1.64, kind: 'slam' }], keys: [at(0),
  { t: 0.55, hy: -0.9, hp: 40, sp: 40, np: -70, ra: -14, re: -30, rl: 1, ba: 0, be: -62, lg: 1, flz: 0.4, frz: -0.3, flp: 20, frp: 20 }, { t: 0.78, hy: -1.0, hp: 44 }, { t: 0.84, air: 1, hy: 0.1, hp: 4, sp: 10, np: -20, be: -84, flz: -0.4, flp: 40, frz: 0.3, frp: 50 },
  { t: 1.4, air: 1, hy: 0.05, hp: 14, be: -70, flz: 0.1, frz: -0.2, flp: 10, frp: 10 }, { t: 1.62, air: 1, hy: -0.4, hp: 30, sp: 40, be: -64 }, { t: 1.66, air: 0, hy: -0.84, hp: 40, sp: 44, np: -64, ra: -20, re: 10, be: 60 }, { t: 2.4, hy: -0.7, hp: 34, ra: -26, re: 6, be: 78 }, at(3.4)] });
C.turnBoat = clip('turnBoat', { dur: 4.6, blend: 0.3, move: [[0, 0], [4.6, 0]], fx: [{ t: 1.55, kind: 'sweep' }, { t: 3.05, kind: 'sweep' }], keys: [at(0),
  { t: 0.7, hy: -0.46, hp: 22, hw: -30, sp: 28, sw: -30, nw: 30, ra: -90, re: -6, rl: 0.95, ba: -90, be: 2, tw: 0, flz: 0.42, frz: -0.42 }, { t: 1.0, tw: -30, hw: -40 }, { t: 1.6, tw: 270, hw: 0, sw: 0, nw: 0 }, { t: 1.95, tw: 360 }, { t: 2.2, tw: 360, hw: -34, sw: -30 }, { t: 3.1, tw: 630 }, { t: 3.5, tw: 720, hw: 0, sw: 0 }, { ...E, t: 4.1, tw: 720 }, at(4.6, { ...E, tw: 720 })] });
/** For his entrance only: the pole lifted high and driven into the riverbed. No strike in it. */
C.plant = clip('plant', { dur: 2.4, blend: 0.3, fx: [{ t: 1.15, kind: 'slam' }], keys: [at(0), ...stab(1.15), at(2.4)] });
// --- the Chain (the pole goes on his back; the anchor is in his hand)
C.cast = clip('cast', { dur: 3.4, blend: 0.3, move: [[0, 0], [3.4, 0]], fx: [{ t: 0.3, kind: 'creak' }, { t: 1.08, kind: 'slam' }], keys: [at(0),
  { t: 0.45, hy: -0.5, hp: 22, hw: -34, sp: 26, sw: -38, np: -44, nw: 36, ra: -110, re: 40, rl: 0.95, ba: -120, be: 80, flz: 0.4, frz: -0.4 }, { t: 0.95, hy: -0.56, hw: -44, sw: -48, ra: -128, re: 70, ba: -140, be: 100 },
  { t: 1.08, hy: -0.4, hp: 30, hw: 24, sw: 34, nw: -20, ra: 4, re: 8, rl: 1, ba: 0, be: 8, flz: -0.2, frz: 0.5 }, { t: 1.5, hw: 30, sw: 38, ra: 10, re: 4 }, { t: 2.8, hw: 20, sw: 28 }, at(3.4)] });
C.haul = clip('haul', { dur: 3.0, blend: 0.2, fx: [{ t: 0.1, kind: 'creak' }], keys: [at(0), { t: 0.01, hy: -0.52, hp: 24, hw: 10, sw: 14, sp: 36, np: -50, ra: 6, re: 6, rl: 0.9, ba: 0, be: 6, flz: 0.5, frz: -0.5 },
  { t: 0.5, hy: -0.5, hp: 20, hw: -10, sw: -14, ra: -40, re: 24, rl: 0.6, la: 30, le: 24, ll: 0.6, flz: 0.44, frz: -0.44 }, { t: 0.9, hw: 14, sw: 18, ra: 6, re: 6, rl: 0.95 }, { t: 1.4, hw: -12, sw: -16, ra: -44, re: 26, rl: 0.55 }, { t: 1.9, hy: -0.4, hw: 0, sw: 0, ra: -36, re: 10 }, at(3.0)] });
C.haulIn = clip('haulIn', { dur: 2.4, hit: [1.45, 1.6], blend: 0.3, fx: [{ t: 1.5, kind: 'sweep' }], keys: [at(0), { t: 0.4, hy: -0.52, hp: 26, hw: 14, sw: 20, sp: 36, ra: 6, re: 6, rl: 1, ba: 0, be: 8, flz: 0.5, frz: -0.5 }, { t: 1.4, hy: -0.7, hp: 30, hw: 26, sw: 34, ra: 18, re: 10, flz: 0.6, frz: -0.6 },
  { t: 1.5, hy: -0.4, hp: 12, hw: -30, sw: -44, sp: 10, np: -40, ra: -100, re: 50, rl: 0.9, la: 30, le: 40, flz: -0.3, frz: 0.5 }, { t: 1.9, hw: -34, sw: -44 }, at(2.4)] });
C.wheelIron = clip('wheelIron', { dur: 4.6, blend: 0.3, move: [[0, 0], [0.8, 0.3], [3.4, 6.4], [4.6, 6.8]], fx: [{ t: 1.3, kind: 'sweep' }, { t: 2.1, kind: 'sweep' }, { t: 2.9, kind: 'sweep' }], keys: [at(0),
  { t: 0.6, hy: -0.4, hp: 16, hw: -20, sp: 24, sw: -26, ra: -90, re: 100, rl: 0.95, ba: -90, be: 100, la: -60, le: 90, flz: 0.4, frz: -0.2 }, { t: 1.3, tw: 180, hw: 10, ra: -10, re: 110 }, { t: 2.1, tw: 540, ra: -10, re: 110 }, { t: 2.9, tw: 900, ra: -10, re: 110 }, { t: 3.5, tw: 1080, hw: 0, sw: 0 }, at(4.6, { ...E, tw: 1080 })] });
C.dragDeep = clip('dragDeep', { dur: 3.2, blend: 0.3, move: [[0, 0], [3.2, 0]], fx: [{ t: 0.35, kind: 'creak' }, { t: 1.58, kind: 'slam' }], keys: [at(0),
  { t: 0.5, hy: -0.84, hp: 36, hw: -18, sp: 40, sw: -22, np: -64, ra: -30, re: -50, rl: 0.9, ba: -20, be: -40, la: 30, le: -50, ll: 0.9, flz: 0.5, frz: -0.5, flp: 10 }, { t: 1.4, hy: -0.9, hp: 40, ra: -20, re: -54 },
  { t: 1.62, hy: -0.14, hp: -6, sp: -10, np: -20, ra: -20, re: 80, rl: 1, la: 20, le: 80, flz: -0.2, frz: 0.3 }, { t: 2.2, hy: -0.1, ra: -18, re: 84 }, at(3.2)] });
// --- the Lantern
C.gather = clip('gather', { dur: 2.2, blend: 0.3, fx: [{ t: 1.0, kind: 'hush' }], keys: [at(0), { t: 0.6, hy: -0.28, hp: 12, ra: -20, re: 80, rl: 0.85, ba: 0, be: 100, lg: 1, la: 20, le: 80 }, { t: 1.0, ra: -14, re: 84, la: 16, le: 76, ll: 0.7, lg: 0 }, { t: 1.5, hy: -0.4, hp: 22, sp: 36 }, at(2.2)] });
C.wrongShore = clip('wrongShore', { dur: 6.5, blend: 0.3, fx: [{ t: 1.2, kind: 'hush' }], keys: [at(0), { t: 0.9, hy: -0.26, hp: 8, sp: 20, ra: -20, re: 90, rl: 0.95, ba: 0, be: 110, lg: 1 }, { t: 1.3, ra: -10, re: 96 }, { t: 4.4, ra: -12, re: 94 }, { t: 5.3, hy: -0.54, hp: 30, sp: 40, ra: -6, re: 0, be: -50 }, at(6.5)] });
C.coldHands = clip('coldHands', { dur: 4.4, blend: 0.3, fx: [{ t: 0.9, kind: 'creak' }], keys: [at(0), { t: 0.7, hy: -0.5, hp: 28, sp: 42, ra: -10, re: -50, rl: 0.9, ba: 0, be: -60, lg: 1, flz: 0.4, frz: -0.4 }, { t: 2.8, hy: -0.52, hp: 30 }, at(4.4)] });
// --- hurt, held, fallen
C.reel = clip('reel', { dur: 1.5, blend: 0.07, move: [[0, 0], [0.14, -0.4], [0.45, -0.9], [1.5, -0.9]], keys: [{ ...E, t: 0, hy: -0.18, hp: -4, sp: 0, np: -20, nr: 30, ra: -70, re: 30, be: 100, flz: 0.3 }, { t: 0.2, hy: -0.2, hp: -10, sp: -14, np: -10, nr: 44, ra: -90 }, { ...E, t: 0.7, hy: -0.46, hp: 24, sp: 36 }, at(1.5)] });
C.snap = clip('snap', { dur: 4.4, blend: 0.1, move: [[0, 0], [0.3, -1.2], [4.4, -1.2]], keys: [{ ...E, t: 0, hy: -0.2, hp: -6, sp: -10, np: -16, nr: 40, ra: -90, re: 50, be: 100, la: 80, le: 50, lg: 0 }, { t: 0.5, hy: -0.8, hp: 36, sp: 40, np: -60, ra: -30, re: -50 }, { t: 3.6, hy: -0.84, hp: 38, sp: 42 }, at(4.4)] });
C.kneel = clip('kneel', { dur: 3.4, blend: 0.16, move: [[0, 0], [0.3, -0.6], [3.4, -0.6]], fx: [{ t: 0.42, kind: 'thud' }], keys: [{ ...E, t: 0, hy: -0.2, hp: -4, np: -20, nr: 20 }, { t: 0.42, hy: -1.0, hp: 30, sp: 44, np: -70, ra: -30, re: -50, flz: 0.55, frz: -0.6, frp: 50 }, { t: 2.8, hy: -1.0 }, at(3.4)] });
C.fall = clip('fall', { dur: 6.6, blend: 0.2, fx: [{ t: 0.9, kind: 'thud' }, { t: 1.6, kind: 'thud' }], keys: [{ ...E, t: 0, hy: -0.3, hp: 4, np: -20 }, { t: 0.95, hy: -1.1, hp: 34, sp: 46, np: -70, ra: -24, re: -50, flz: 0.5, frp: 50, frz: -0.5 }, { t: 5.6, hy: -1.14, hp: 36, sp: 50 }, at(6.6, { ...E, hy: -1.14, hp: 36, sp: 50 })] });
// --- the Unburdened: fast, light, a fencer with a six-metre spear
const U: Key = { t: 0, hy: -0.2, hz: 0, hp: 10, hw: -34, hr: 0, sp: 10, sw: 4, sr: 0, np: -16, nw: 30, nr: 0, ra: -60, re: -8, rl: 0.78, ba: -6, be: 2, bo: 0, lg: 1, la: 40, le: -20, ll: 0.8, xl: 4, xr: 10, tw: 0, air: 0, flx: 0.18, fly: 0, flz: 0.34, flw: -10, flp: 0, frx: -0.18, fry: 0, frz: -0.32, frw: -40, frp: 0 };
const u = (t: number, o: Partial<Key> = {}): Key => ({ ...U, ...o, t });
C.thrust = clip('thrust', { dur: 1.6, blend: 0.18, move: [[0, 0], [0.5, -0.2], [0.66, 1.6], [0.9, 1.9], [1.6, 1.9]], fx: [{ t: 0.66, kind: 'sweep' }], keys: [u(0),
  { t: 0.45, hy: -0.32, hp: 16, hw: -62, sw: -24, nw: 60, ra: -100, re: -4, rl: 0.5, flz: 0.2, frz: -0.5, frp: 30 },
  { t: 0.66, hy: -0.4, hp: 26, hw: 10, sp: 18, sw: 16, nw: -10, ra: -6, re: -2, rl: 1, ba: 0, be: -2, flz: 0.7, frz: -0.6, frp: 50 }, { t: 0.95, hy: -0.4, rl: 1 }, u(1.6)] });
C.flurry = clip('flurry', { dur: 2.1, blend: 0.16, move: [[0, 0], [0.55, 0.5], [1.0, 1.0], [1.45, 1.6], [2.1, 1.7]], fx: [{ t: 0.62, kind: 'sweep' }, { t: 1.07, kind: 'sweep' }, { t: 1.52, kind: 'sweep' }], keys: [u(0),
  { t: 0.45, hw: -60, sw: -30, nw: 60, ra: -110, re: 50, rl: 0.9, ba: -120, be: 60 }, { t: 0.66, hy: -0.28, hw: 30, sw: 30, nw: -30, ra: 60, re: -20, rl: 1, ba: 110, be: -30, flz: 0.5 },
  { t: 0.9, hw: 40, sw: 40, ra: 80, re: 50, ba: 130, be: 60 }, { t: 1.11, hy: -0.3, hw: -40, sw: -36, nw: 40, ra: -90, re: -30, ba: -120, be: -30, frz: 0.4, flz: -0.3 },
  { t: 1.32, hy: -0.1, hp: -6, sp: -14, hw: -20, ra: -20, re: 80, ba: 0, be: 130, flz: 0.3 }, { t: 1.55, hy: -0.44, hp: 28, sp: 30, np: -36, ra: -6, re: -30, rl: 1, ba: 0, be: -60, flz: 0.6, frz: -0.5, frp: 40 }, { t: 1.75, hy: -0.44 }, u(2.1)] });
C.reap = clip('reap', { dur: 2.3, blend: 0.18, move: [[0, 0], [0.9, 0.3], [1.3, 0.8], [2.3, 0.8]], fx: [{ t: 1.06, kind: 'sweep' }], keys: [u(0),
  { t: 0.75, tw: 0, hy: -0.62, hp: 28, hw: -60, sw: -40, sp: 24, nw: 60, ra: -110, re: -40, rl: 1, ba: -150, be: -16, flz: 0.5, frz: -0.5, frp: 40 }, { t: 0.92, tw: -20 },
  { t: 1.1, tw: 200, hy: -0.7, hw: 0, sw: 0, nw: 0, ra: -80, re: -40, ba: -80, be: -18 }, { t: 1.28, tw: 360, hw: 30, sw: 40, ra: 50, ba: 110 }, { ...U, t: 1.7, tw: 360, hy: -0.4, hp: 20 }, u(2.3, { tw: 360 })] });
C.vault = clip('vault', { dur: 3.0, blend: 0.2, fx: [{ t: 0.62, kind: 'launch' }, { t: 1.44, kind: 'slam' }], keys: [u(0),
  { t: 0.5, hy: -0.6, hp: 30, hw: 0, sw: 0, nw: 0, sp: 30, np: -50, ra: -14, re: -40, rl: 1, ba: 0, be: -70, flz: 0.4, frz: -0.3, flp: 20, frp: 20 }, { t: 0.62, hy: -0.7 },
  { t: 0.66, air: 1, hy: 0.2, hp: -10, sp: -6, np: 0, ra: -10, re: 70, ba: 0, be: 120, flz: -0.3, flp: 40, frz: 0.3, frp: 50 }, { t: 1.2, air: 1, hy: 0.1, hp: -14, re: 84, be: 150 },
  { t: 1.42, air: 1, hy: -0.3, hp: 30, sp: 40, ra: -6, re: -40, be: -70, flz: 0.4, frz: -0.4 }, { t: 1.46, air: 0, hy: -0.7, hp: 36, sp: 44, np: -54 }, { t: 2.2, hy: -0.6 }, u(3.0)] });
C.skim = clip('skim', { dur: 2.2, blend: 0.18, move: [[0, 0], [0.4, -0.3], [0.55, 0.4], [1.05, 7.2], [1.3, 7.8], [2.2, 7.9]], fx: [{ t: 0.55, kind: 'launch' }, { t: 1.12, kind: 'sweep' }], keys: [u(0),
  { t: 0.4, hy: -0.5, hp: 30, hw: -50, sp: 24, sw: -20, nw: 50, ra: -110, re: -10, rl: 0.6, flz: 0.1, frz: -0.6, frp: 40 }, { t: 0.7, hy: -0.4, hp: 34, ra: -100, rl: 0.7, flz: 0.4, frz: -0.4 },
  { t: 1.1, hy: -0.46, hp: 26, hw: 14, sp: 18, sw: 18, nw: -14, ra: -6, re: 0, rl: 1, ba: 0, be: 0, flz: 0.7, frz: -0.6, frp: 50 }, { t: 1.5, hy: -0.44 }, u(2.2)] });
C.lamps = clip('lamps', { dur: 5.6, blend: 0.25, fx: [{ t: 0.8, kind: 'hush' }], keys: [u(0),
  { t: 0.8, hy: -0.1, hp: -4, hw: 0, sw: 0, nw: 0, sp: -8, np: 10, ra: -60, re: 40, rl: 1, ba: 0, be: 110, lg: 0, la: 60, le: 40, ll: 1, xl: 0 }, { t: 2.6, hw: 30, sw: 20 }, { t: 4.2, hw: -30, sw: -20 }, { t: 4.9, hw: 0 }, u(5.6)] });
C.reel2 = clip('reel2', { dur: 1.2, blend: 0.07, move: [[0, 0], [0.12, -0.5], [0.4, -1.0], [1.2, -1.0]], keys: [{ ...U, t: 0, hy: -0.14, hp: -6, sp: -10, np: -6, nr: 30, ra: -80, re: 30, be: 60 }, { t: 0.2, hy: -0.2, hp: -12, sp: -18, nr: 40 }, { ...U, t: 0.7, hy: -0.4, hp: 24, sp: 30 }, u(1.2)] });
C.riseW = clip('riseW', { dur: 4.4, blend: 0.3, fx: [{ t: 1.3, kind: 'thud' }, { t: 2.45, kind: 'launch' }], keys: [{ ...E, t: 0, hy: -1.0, hp: 30, sp: 44, np: -70, ra: -30, re: -50, flz: 0.55, frz: -0.6, frp: 50 },
  { t: 1.2, hy: -0.9, hp: 26, sp: 30, np: -20, la: 40, le: 60, ll: 1, lg: 0, ra: -40, re: 60 }, { t: 2.4, hy: -0.7, hp: -10, sp: -24, np: 26, la: 70, le: 90, ra: -70, re: 90, ll: 1, rl: 1, ba: 0, be: 150 },
  { ...U, t: 3.2, hy: -0.1, hp: 0, sp: -6, np: 4 }, u(4.4)] });
C.die2 = clip('die2', { dur: 7.0, blend: 0.2, fx: [{ t: 1.1, kind: 'thud' }], keys: [{ ...U, t: 0, hy: -0.2, hp: 4, np: -10 }, { t: 1.1, hy: -1.0, hp: 30, sp: 40, np: -60, ra: -30, re: -50, rl: 0.9, lg: 0, la: 20, le: -40, flz: 0.5, frp: 50, frz: -0.5 }, { t: 6.0, hy: -1.04, hp: 34, sp: 46 }, { ...E, t: 7.0, hy: -1.04, hp: 34, sp: 46, lg: 0 }] });
export const RIVER_CLIPS = C;
