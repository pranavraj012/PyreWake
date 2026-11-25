// The Khanda: a broad straight longsword. Everything specific to it lives here.
import { clip, makePose, type Clip } from '../anim/pose.ts';
import { addArts } from './khandaArts.ts';
import { GUARD, addFinishers } from './khandaFinishers.ts';
import type { Weapon } from './weapon.ts';

/** Unhurried: side-on, weight on the back leg, blade tip resting on the stone behind. */
export const REST = makePose({
  hx: -0.025, hy: -0.035, hp: -2, hw: -32, hr: -3, sp: -3, sw: 6, sr: 3, np: 9, nw: 24, nr: 3,
  ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, la: 18, le: -70, ll: 0.86, xl: 8,
  flx: 0.04, flz: 0.13, flw: -4, frx: -0.06, frz: -0.16, frw: -58,
});
/** Coiled tail guard, blade low and behind. */
export const READY = makePose({
  hx: -0.01, hy: -0.13, hp: 8, hw: -38, hr: 0, sp: 12, sw: 2, np: -14, nw: 34,
  ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, xl: 12,
  flx: 0.09, flz: 0.27, flw: -8, frx: -0.1, frz: -0.27, frw: -62,
});

const C: Record<string, Clip> = {};
const def = (n: string, d: Parameters<typeof clip>[1]) => { C[n] = clip(n, d); };

// 1: rising cut, low right to high left
def('light1', { dur: 0.66, hit: [0.13, 0.25], chain: 0.3, free: 0.46, power: 1, blend: 0.135, move: [[0, 0], [0.1, 0.05], [0.22, 0.75], [0.3, 0.85], [0.66, 0.85]], keys: [
  { t: 0, hy: -0.16, hp: 10, hw: -55, sp: 14, sw: -18, np: -12, nw: 55, ra: -82, re: -46, rl: 0.86, ba: -165, be: -18, bo: 0, la: 22, le: -20, ll: 0.6, lg: 0, flx: 0.08, flz: 0.2, flw: -5, frx: -0.1, frz: -0.3, frw: -60, frp: 10 },
  { t: 0.1, hy: -0.19, hw: -58, sw: -24, ra: -92, re: -42, ba: -172, be: -14, la: 30 },
  { t: 0.19, hy: -0.12, hp: 6, hw: 8, sp: 4, sw: 16, nw: -8, ra: -4, re: 6, rl: 0.98, ba: -8, be: 6, la: 78, le: -28, ll: 0.75, flz: 0.42, frz: -0.3 },
  { t: 0.27, hy: -0.1, hp: 0, hw: 26, sp: -5, sw: 30, nw: -26, ra: 52, re: 42, rl: 0.86, ba: 96, be: 46, la: 108, le: -40, ll: 0.8, frp: 24 },
  { t: 0.36, hw: 28, sw: 33, ra: 58, re: 46, ba: 112, be: 50 }, { t: 0.66, hw: 22, sw: 26, ra: 52, re: 36, ba: 118, be: 34, hy: -0.1 } ] });

// 2: backhand, high left to low right, one-handed with the off arm thrown back
def('light2', { dur: 0.64, hit: [0.12, 0.23], chain: 0.28, free: 0.45, power: 1, blend: 0.08, move: [[0, 0], [0.08, 0.02], [0.2, 0.65], [0.64, 0.72]], keys: [
  { t: 0, hy: -0.12, hp: 4, hw: 34, sp: 2, sw: 38, np: -8, nw: -48, ra: 66, re: 34, rl: 0.66, ba: 138, be: 34, la: 70, le: -40, ll: 0.6, lg: 0, flx: 0.06, flz: 0.28, flw: 8, frx: -0.1, frz: -0.26, frw: -40 },
  { t: 0.09, hy: -0.16, hw: 38, sw: 44, ra: 78, re: 36, ba: 150, be: 38 },
  { t: 0.175, hy: -0.17, hp: 10, hw: -8, sp: 10, sw: -8, nw: 8, ra: -2, re: -8, rl: 0.98, ba: 4, be: -8, la: 60, le: -10, frz: 0.34, flz: -0.2, frw: -18, flw: 34 },
  { t: 0.25, hy: -0.15, hw: -34, sw: -30, nw: 44, ra: -74, re: -28, rl: 0.93, ba: -112, be: -28, la: 74, le: 12, ll: 0.85 },
  { t: 0.34, hw: -37, sw: -34, ra: -82, re: -30, ba: -126, be: -27, la: 80, le: 16 }, { t: 0.64, hw: -32, sw: -24, ra: -78, re: -36, ba: -134, be: -26, la: 60, le: -10 } ] });

// 3: two-handed vertical cut
def('light3', { dur: 0.74, hit: [0.2, 0.31], chain: 0.36, free: 0.54, power: 1.25, blend: 0.1, move: [[0, 0], [0.16, 0.18], [0.29, 1.0], [0.74, 1.05]], keys: [
  { t: 0, hy: -0.06, hp: -2, hw: -22, sp: -10, sw: -12, np: 4, nw: 26, ra: -34, re: 58, rl: 0.74, ba: 0, be: 128, la: -10, le: 50, ll: 0.7, lg: 0.6, flx: 0.07, flz: -0.24, flw: 18, frx: -0.07, frz: 0.2, frw: -10 },
  { t: 0.15, hy: -0.01, hp: -8, hw: -24, sp: -18, sw: -10, np: 10, ra: -24, re: 78, rl: 0.8, ba: 0, be: 148, lg: 1, flp: 26 },
  { t: 0.255, hy: -0.16, hp: 14, hw: 4, sp: 18, sw: 6, np: -14, nw: -4, ra: -10, re: 6, rl: 0.96, be: 6, flz: 0.44, flw: -4, flp: 0, frz: -0.26, frw: -38 },
  { t: 0.33, hy: -0.24, hp: 22, hw: 10, sp: 30, sw: 10, np: -30, nw: -8, ra: -4, re: -40, rl: 0.88, ba: 2, be: -46, frp: 22 },
  { t: 0.45, hy: -0.245, re: -42, be: -49 }, { t: 0.74, hy: -0.2, hp: 18, sp: 22, np: -24, re: -42, be: -44, lg: 1 } ] });

// 4: leaping full spin
def('light4', { dur: 0.86, hit: [0.24, 0.46], chain: 0.52, free: 0.66, power: 1.3, arc: 180, blend: 0.18, move: [[0, 0], [0.14, 0.05], [0.44, 1.25], [0.86, 1.3]], fx: [{ t: 0.46, kind: 'dust' }], keys: [
  { t: 0, tw: 0, air: 0, hy: -0.2, hp: 14, hw: -30, sp: 14, sw: -24, nw: 30, np: -12, ra: -60, re: -34, rl: 0.8, ba: -110, be: -22, la: 40, le: -20, ll: 0.6, lg: 0, flx: 0.06, flz: 0.26, flw: 0, frx: -0.1, frz: -0.24, frw: -48, fly: 0, fry: 0 },
  { t: 0.14, tw: -24, hy: -0.28, hw: -42, sw: -34, ra: -86, ba: -140, la: 60 },
  { t: 0.2, air: 1, tw: 20 }, { t: 0.31, tw: 180, hy: 0.1, hp: 10, hw: -10, sp: 10, sw: 18, sr: -8, nw: 10, ra: -66, re: -2, rl: 0.98, ba: -74, be: -2, la: 80, le: 8, ll: 0.85, flx: 0.02, fly: 0.2, flz: -0.16, flp: 40, frx: -0.02, fry: 0.3, frz: 0.12, frp: 30 },
  { t: 0.43, tw: 352, hy: -0.14, air: 1, fly: 0, fry: 0, flp: 0, frp: 0, hw: 10, sw: 30, ra: 10, re: -8, rl: 0.95, ba: 26, be: -8 },
  { t: 0.46, air: 0 }, { t: 0.52, tw: 366, hy: -0.24, hp: 14, hw: 24, sp: 14, sw: 36, nw: -30, ra: 60, re: -16, rl: 0.86, ba: 108, be: -14, la: 110, le: 4, ll: 0.8, flx: 0.14, flz: 0.34, flw: 14, frx: -0.14, frz: -0.34, frw: -40 },
  { t: 0.62, tw: 362, ba: 120 }, { t: 0.86, tw: 360, hy: -0.18, hw: 20, sw: 28, ba: 124, ra: 62 } ] });

// 5: rising leap into a driving downward slam, then a long kneeling hold
def('light5', { dur: 1.5, hit: [0.46, 0.58], chain: 0.95, free: 1.0, power: 2.2, reel: true, arc: 110, blend: 0.12, move: [[0, 0], [0.2, 0.1], [0.53, 1.7], [1.5, 1.7]], fx: [{ t: 0.53, kind: 'slam' }, { t: 1.12, kind: 'flare' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.26, hp: 16, hw: 14, sp: 18, sw: 18, np: -18, nw: -14, ra: 44, re: -30, rl: 0.72, ba: 110, be: -20, la: 20, le: -40, ll: 0.6, lg: 0.8, flx: 0.08, fly: 0, flz: 0.2, frx: -0.1, fry: 0, frz: -0.26, frw: -40 },
  { t: 0.16, hy: -0.34, hp: 22, sp: 24, ra: 20, re: -44, ba: 60, be: -50, lg: 1 },
  { t: 0.22, air: 1 }, { t: 0.35, hy: 0.6, hp: -14, hw: -4, sp: -26, sw: 0, np: 10, nw: 0, ra: -18, re: 88, rl: 0.8, ba: 0, be: 158, flx: 0.02, fly: 0.5, flz: -0.2, flp: 55, frx: -0.04, fry: 0.66, frz: 0.16, frp: 40 },
  { t: 0.4, hy: 0.52, sp: -12, re: 74, be: 124 }, { t: 0.47, hy: 0.06, sp: 6, re: 30, be: 60 },
  { t: 0.53, air: 1, hy: -0.4, hp: 26, sp: 34, np: -34, ra: -8, re: -34, rl: 0.94, be: -38, fly: 0, fry: 0, flp: 0, frp: 46, flz: 0.34, frz: -0.34 },
  { t: 0.55, air: 0 }, { t: 0.61, hy: -0.47, hp: 28, sp: 38, np: -38, re: -44, be: -46, frp: 58, flx: 0.1, flz: 0.32, frx: -0.1, frz: -0.36 },
  { t: 0.95, hy: -0.46, hp: 26, sp: 34, np: -30, nw: 0, re: -43, be: -45, lg: 1, ba: 0 },
  { t: 1.14, hy: -0.2, hp: 8, hw: -24, sp: 4, np: -4, nw: 22, ra: -50, re: -52, rl: 0.88, ba: -50, be: -42, lg: 0, la: 20, le: -62, ll: 0.8, frp: 6, flz: 0.16, frz: -0.2 },
  { t: 1.5, hy: -0.05, hp: -2, hw: -32, sp: -3, sw: 6, ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, frw: -58, frp: 0, la: 18, le: -70 } ] });

// heavy: hold to charge, release a one-handed crescent that leaves the back turned to the enemy
def('charge', { dur: 1.2, blend: 0.16, fx: [{ t: 0.3, kind: 'flare' }, { t: 0.75, kind: 'flare' }, { t: 1.15, kind: 'flare' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.14, hp: 10, hw: -60, sp: 10, sw: -22, np: -10, nw: 72, ra: -100, re: -34, rl: 0.86, ba: 178, be: -20, la: 34, le: -8, ll: 0.7, lg: 0, flx: 0.1, flz: 0.36, flw: -6, frx: -0.12, frz: -0.34, frw: -80 },
  { t: 1.2, hy: -0.24, hw: -68, sw: -30, nw: 84, ra: -112, re: -30, ba: 172, be: -14, le: 2 } ] });
def('heavy', { dur: 1.25, hit: [0.1, 0.26], chain: 0.72, free: 0.8, power: 2.6, reel: true, arc: 100, blend: 0.07, move: [[0, 0], [0.06, 0.1], [0.22, 1.7], [0.34, 1.9], [1.25, 1.9]], fx: [{ t: 0.14, kind: 'crescent' }, { t: 0.24, kind: 'dust' }], keys: [
  { t: 0, tw: 0, hy: -0.26, hp: 14, hw: -62, sp: 14, sw: -30, nw: 70, np: -10, ra: -108, re: -38, rl: 0.95, ba: -184, be: -22, la: 40, le: 0, ll: 0.7, lg: 0, flx: 0.1, flz: 0.3, flw: -6, frx: -0.12, frz: -0.34, frw: -76 },
  { t: 0.08, hw: -40, ra: -96, ba: -160 },
  { t: 0.17, tw: 10, hy: -0.16, hp: 4, hw: 20, sp: 0, sw: 22, nw: -6, ra: -6, re: 8, rl: 1, ba: -6, be: 10, la: 90, le: -20, ll: 0.9, frz: 0.42, frx: -0.02, frw: 18, flz: -0.3, flw: 30 },
  { t: 0.27, tw: 60, hy: -0.06, hp: -6, hw: 44, sp: -14, sw: 40, sr: 6, nw: -20, ra: 60, re: 64, rl: 0.95, ba: 92, be: 66, la: 120, le: -36, ll: 0.9, flp: 30 },
  { t: 0.4, tw: 78, hw: 46, sw: 42, ra: 66, re: 68, ba: 104, be: 72, nw: 10 },
  { t: 0.74, tw: 78, hw: 44, sw: 38, ra: 62, re: 64, ba: 110, be: 70, np: 4, nw: 46, nr: 6, la: 124, le: -44 },
  { t: 1.02, tw: 30, hw: -10, sw: 6, sp: -4, nw: 24, ra: -30, re: -30, rl: 0.8, ba: -60, be: 30 },
  { t: 1.25, tw: 0, hy: -0.04, hw: -32, hp: -2, sw: 6, ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, flx: 0.04, flz: 0.13, flw: -4, frx: -0.06, frz: -0.16, frw: -58, flp: 0, la: 18, le: -70, ll: 0.86 } ] });

// after a fight beat: snap the blade clean, then let it hang
def('flick', { dur: 1.0, free: 0.0, blend: 0.14, fx: [{ t: 0.27, kind: 'flick' }], keys: [
  { t: 0, hy: -0.04, hp: -2, hw: -26, sp: -4, sw: 6, np: 2, nw: 22, ra: -18, re: -26, rl: 0.62, ba: 34, be: 34, la: 18, le: -68, ll: 0.84, lg: 0, flx: 0.04, flz: 0.14, flw: -4, frx: -0.06, frz: -0.16, frw: -54 },
  { t: 0.18, ra: -8, re: -18, rl: 0.6, ba: 50, be: 44, sw: 14 },
  { t: 0.28, ra: -66, re: -46, rl: 0.97, ba: -96, be: -38, sw: -8, hw: -36, nw: 34 },
  { t: 0.42, ra: -70, re: -50, ba: -108, be: -42, sw: -10 },
  { t: 0.72, ra: -66, re: -60, ba: -116, be: -38, np: 8 }, { t: 1.0, ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, sw: 6, sp: -3, np: 9 } ] });

addFinishers(def); addArts(def);
export const KHANDA: Weapon = {
  id: 'khanda', name: 'Khanda', geo: 'khanda', blade: [0.42, 1.0], reach: 1.95, arc: 75, damage: 10, trail: [1.5, 0.5, 0.12],
  rest: REST, ready: READY, guard: GUARD, clips: C,
  alt: ['alt3', 'alt4', 'alt5'], from: { sprint: 'comet', dodgeF: 'lowTurn', dodgeB: 'flare', dodgeL: 'passR', dodgeR: 'passL', guard: 'palm', reckon: 'reckon', execute: 'execute' },
  combo: ['light1', 'light2', 'light3', 'light4', 'light5'], finishers: ['risingCut', 'cleave', 'thrust', 'groundSlam'], charge: 'charge', heavy: 'heavy',
};
