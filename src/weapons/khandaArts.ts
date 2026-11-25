// Khanda: attacks that depend on what you were just doing, the second chain, and the fire arts. Same button, different answers.
import type { ClipDef, Key } from '../anim/pose.ts';

const READYK: Key = { t: 0, hx: -0.01, hy: -0.13, hp: 8, hw: -38, hr: 0, sp: 12, sw: 2, sr: 0, np: -14, nw: 34, nr: 0, ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, lg: 0, xl: 12, flx: 0.09, fly: 0, flz: 0.27, flw: -8, flp: 0, frx: -0.1, fry: 0, frz: -0.27, frw: -62, frp: 0, air: 0 };
const RESTK: Key = { t: 0, hx: -0.025, hy: -0.035, hp: -2, hw: -32, hr: -3, sp: -3, sw: 6, sr: 3, np: 9, nw: 24, nr: 3, ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, la: 18, le: -70, ll: 0.86, lg: 0, xl: 8, flx: 0.04, fly: 0, flz: 0.13, flw: -4, flp: 0, frx: -0.06, fry: 0, frz: -0.16, frw: -58, frp: 0, air: 0 };
const at = (t: number, k: Key, o: Partial<Key> = {}): Key => ({ ...k, ...o, t });

export function addArts(def: (n: string, d: ClipDef) => void) {
// sprinting: a long airborne turn into a diagonal fall
def('comet', { dur: 1.15, hit: [0.36, 0.52], chain: 0.7, free: 0.78, power: 1.9, arc: 100, blend: 0.14, move: [[0, 0], [0.1, 0.6], [0.44, 3.9], [0.6, 4.3], [1.15, 4.4]], fx: [{ t: 0.12, kind: 'dust' }, { t: 0.46, kind: 'crack' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.26, hp: 24, hw: -30, sp: 16, sw: -24, np: -30, nw: 34, ra: -100, re: -30, rl: 0.9, ba: -160, be: -10, la: 40, le: -20, ll: 0.7, lg: 0, flx: 0.04, fly: 0, flz: 0.3, flp: 0, frx: -0.06, fry: 0, frz: -0.4, frp: 40 },
  { t: 0.1, air: 1 }, { t: 0.26, tw: 190, hy: 0.42, hp: 30, sp: 20, sw: 10, np: -20, nw: 0, ra: -70, re: 30, rl: 0.95, ba: -80, be: 20, la: 84, le: 20, ll: 0.8, fly: 0.5, flz: -0.3, flp: 60, fry: 0.6, frz: 0.1, frp: 50 },
  { t: 0.38, tw: 340, hy: 0.4, hp: -4, sp: -18, sw: -20, ra: -40, re: 76, ba: -30, be: 120 }, { t: 0.46, tw: 362, hy: -0.26, hp: 24, sp: 28, sw: 16, np: -26, ra: 14, re: -30, rl: 0.98, ba: 20, be: -34, air: 1, fly: 0, fry: 0, flz: 0.44, flp: 0, frz: -0.36, frp: 46 }, { t: 0.5, air: 0, tw: 360 },
  { t: 0.6, hy: -0.36, hw: 20, sw: 24, sp: 32, ra: 34, re: -40, ba: 52, be: -36, la: 90, le: -10 }, { t: 0.8, hy: -0.34, ba: 56 }, at(1.15, READYK, { tw: 360 }) ] });

// out of a forward dodge: skids low under everything, one full turn
def('lowTurn', { dur: 0.95, hit: [0.16, 0.4], chain: 0.52, free: 0.6, power: 1.5, arc: 180, reach: 2.25, blend: 0.12, move: [[0, 0], [0.1, 0.5], [0.4, 1.8], [0.95, 1.9]], fx: [{ t: 0.1, kind: 'scrape' }, { t: 0.2, kind: 'scrape' }, { t: 0.3, kind: 'scrape' }, { t: 0.4, kind: 'dust' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.4, hp: 30, hw: -40, sp: 26, sw: -30, np: -34, nw: 50, ra: -100, re: -30, rl: 0.95, ba: -150, be: -8, la: 60, le: -30, ll: 0.8, lg: 0, flx: 0.14, fly: 0, flz: 0.4, frx: -0.16, fry: 0, frz: -0.5, frp: 40 },
  { t: 0.1, tw: -20, air: 1 }, { t: 0.26, tw: 170, hy: -0.46, hp: 26, sp: 24, sw: 10, nw: 0, ra: -70, re: -24, rl: 1, ba: -74, be: -14, la: 90, le: 0, fly: 0.02, fry: 0.06 }, { t: 0.4, tw: 352, hy: -0.4, sw: 34, ra: 30, re: -18, ba: 50, be: -10 }, { t: 0.43, air: 0, tw: 360 }, { t: 0.5, tw: 364, hw: 20, sw: 38, nw: -24, ra: 64, ba: 110, flz: 0.36, frz: -0.38 }, at(0.95, READYK, { tw: 360 }) ] });

// out of a side dodge: a drawn cut across, body already turning away
const pass = (s: number) => ({ dur: 0.85, hit: [0.14, 0.27] as [number, number], chain: 0.4, free: 0.52, power: 1.5, arc: 120, blend: 0.1, move: [[0, 0], [0.1, 0.3], [0.26, 1.5], [0.85, 1.6]] as [number, number][], fx: [{ t: 0.18, kind: 'crescent' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.22, hp: 14, hw: -30 * s, sp: 14, sw: -34 * s, np: -10, nw: 50 * s, ra: s > 0 ? -96 : 74, re: s > 0 ? -26 : 6, rl: s > 0 ? 0.8 : 0.6, ba: -150 * s, be: -4, la: 30, le: -20, ll: 0.6, lg: 0, flx: 0.1, fly: 0, flz: 0.3, flp: 0, frx: -0.12, fry: 0, frz: -0.32, frp: 10 },
  { t: 0.1, hw: -38 * s, sw: -40 * s }, { t: 0.2, hy: -0.18, hw: 10 * s, sw: 10 * s, nw: -10 * s, ra: -2, re: 0, rl: 1, ba: 0, be: 0, la: 80, le: -10 }, { t: 0.28, hw: 40 * s, sw: 40 * s, ra: s > 0 ? 70 : -84, re: 4, rl: 0.96, ba: 112 * s, be: 4, la: 100, le: 0, flz: 0.38, frz: -0.42 },
  { t: 0.5, tw: 30 * s, hw: 42 * s, ra: s > 0 ? 74 : -88, ba: 120 * s }, at(0.85, READYK, { tw: 0 }) ] });
def('passL', pass(1)); def('passR', pass(-1));

// out of a back dodge: throws a crescent of fire
def('flare', { dur: 0.95, chain: 0.6, free: 0.6, blend: 0.12, move: [[0, 0], [0.2, 0.1], [0.34, 0.6], [0.95, 0.65]], fx: [{ t: 0.05, kind: 'flare' }, { t: 0.31, kind: 'throw' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.22, hp: 12, hw: -50, sp: 14, sw: -30, np: -12, nw: 60, ra: -110, re: -20, rl: 0.9, ba: -178, be: -10, la: 20, le: -10, ll: 0.7, lg: 0, flx: 0.1, flz: 0.34, flp: 0, frx: -0.12, frz: -0.34, frp: 0, fly: 0, fry: 0 },
  { t: 0.2, hw: -58, sw: -36, ra: -118 }, { t: 0.32, hy: -0.18, hw: 10, sw: 14, nw: -10, ra: 0, re: 14, rl: 1, ba: 0, be: 16, la: 90, le: -20 }, { t: 0.44, hw: 38, sw: 38, nw: -34, ra: 64, re: 30, ba: 96, be: 34, frp: 24 }, { t: 0.56, ra: 68, ba: 104 }, at(0.95, READYK) ] });

// the second chain: pause after hit two
def('alt3', { dur: 0.74, hit: [0.14, 0.24], hits: [[0.14, 0.24], [0.32, 0.42]], chain: 0.46, free: 0.56, power: 0.95, arc: 100, blend: 0.12, move: [[0, 0], [0.1, 0.1], [0.22, 0.7], [0.4, 1.2], [0.74, 1.25]], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hp: 12, hw: -40, sp: 14, sw: -22, np: -12, nw: 44, ra: -50, re: 40, rl: 0.8, ba: -70, be: 100, la: 30, le: -20, ll: 0.6, lg: 0, flx: 0.08, fly: 0, flz: 0.26, flp: 0, frx: -0.1, fry: 0, frz: -0.28, frp: 10 },
  { t: 0.1, ra: -54, re: 50 }, { t: 0.19, hw: 10, sw: 14, nw: -6, ra: 6, re: -10, rl: 0.98, ba: 14, be: -14, sp: 18 }, { t: 0.26, hw: 24, sw: 30, ra: 50, re: -44, ba: 78, be: -44 }, { t: 0.31, ra: 56, re: 20, ba: 84, be: 70 },
  { t: 0.37, hw: -4, sw: -6, nw: 8, ra: -2, re: 0, rl: 0.98, ba: 0, be: -4 }, { t: 0.44, hw: -32, sw: -28, nw: 40, ra: -62, re: -46, ba: -96, be: -44, la: 70, le: 6 }, at(0.74, READYK) ] });
def('alt4', { dur: 0.95, hit: [0.26, 0.4], chain: 0.56, free: 0.66, power: 1.6, arc: 100, reach: 1.8, blend: 0.14, move: [[0, 0], [0.14, 0.1], [0.38, 1.2], [0.95, 1.3]], fx: [{ t: 0.3, kind: 'kick' }, { t: 0.44, kind: 'dust' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.24, hp: 12, hw: -20, sp: 10, sw: -30, np: -6, nw: 30, ra: -70, re: -40, rl: 0.8, ba: -130, be: -20, la: 60, le: -10, ll: 0.7, lg: 0, flx: 0.06, fly: 0, flz: 0.1, flp: 0, frx: -0.1, fry: 0, frz: -0.26, frp: 20 },
  { t: 0.14, tw: 60, hy: -0.2 }, { t: 0.18, air: 1 }, { t: 0.3, tw: 340, hy: -0.06, hp: -24, hr: -10, sp: 4, sw: 10, np: -10, nw: 0, ra: -90, re: -20, rl: 0.9, ba: -110, be: -10, la: 90, le: 10, ll: 0.9, frx: -0.02, fry: 0.86, frz: 0.62, frp: -10, flx: 0, fly: 0, flz: -0.06, flp: 30 },
  { t: 0.4, tw: 366, fry: 0.7, frz: 0.6 }, { t: 0.5, air: 1, tw: 360, hy: -0.2, hp: 10, hr: 0, fry: 0, frz: 0.34, frp: 0, flz: -0.26, flp: 20 }, { t: 0.53, air: 0 }, at(0.95, READYK, { tw: 360 }) ] });
def('alt5', { dur: 1.75, hit: [0.28, 0.38], hits: [[0.28, 0.38], [0.48, 0.58], [0.84, 0.98]], chain: 1.2, free: 1.26, power: 1.5, reel: true, arc: 180, reach: 2.3, blend: 0.14, move: [[0, 0], [0.2, 0.1], [0.6, 1.4], [0.8, 1.6], [0.92, 2.2], [1.75, 2.2]], fx: [{ t: 0.1, kind: 'flare' }, { t: 0.86, kind: 'wave' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.3, hp: 14, hw: -40, sp: 14, sw: -30, np: -12, nw: 44, ra: -96, re: -30, rl: 0.9, ba: -150, be: -16, la: 50, le: -10, ll: 0.7, lg: 0, flx: 0.1, fly: 0, flz: 0.3, flp: 0, frx: -0.12, fry: 0, frz: -0.32, frp: 10 },
  { t: 0.2, tw: -30, hy: -0.36, air: 0 }, { t: 0.24, air: 1 }, { t: 0.33, tw: 160, hy: 0.04, hp: 10, sp: 8, sw: 14, nw: 0, ra: -72, re: -6, rl: 1, ba: -78, be: -4, la: 86, le: 6, ll: 0.9, fly: 0.2, fry: 0.26 }, { t: 0.43, tw: 360, hy: 0.16 }, { t: 0.53, tw: 540, hy: 0.2, ra: -66, re: 14, be: 12 }, { t: 0.64, tw: 700, hy: 0.3, hp: -14, sp: -22, ra: -20, re: 84, ba: 0, be: 150, lg: 0.8, fly: 0.4, fry: 0.5 },
  { t: 0.8, tw: 720, hy: 0.26, re: 88, be: 156, lg: 1 }, { t: 0.88, air: 1, hy: -0.36, hp: 26, sp: 34, np: -32, ra: -6, re: -34, rl: 0.95, be: -40, fly: 0, fry: 0, flz: 0.36, frz: -0.34, frp: 50 }, { t: 0.9, air: 0 }, { t: 1.0, hy: -0.44, sp: 38, re: -42, be: -44 }, { t: 1.2, hy: -0.43, tw: 720 }, at(1.75, RESTK, { tw: 720 }) ] });

// from guard: the burnt hand
def('palm', { dur: 0.9, hit: [0.2, 0.32], chain: 0.48, free: 0.56, power: 1.7, reel: true, arc: 60, reach: 1.7, blend: 0.1, move: [[0, 0], [0.14, 0.05], [0.26, 0.9], [0.9, 0.95]], fx: [{ t: 0.04, kind: 'flare' }, { t: 0.23, kind: 'palm' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.22, hp: 8, hw: 34, sp: 10, sw: 26, np: -10, nw: -44, ra: -60, re: -30, rl: 0.7, ba: -90, be: 20, la: 60, le: -30, ll: 0.4, lg: 0, xl: 20, flx: 0.1, fly: 0, flz: 0.2, flp: 0, frx: -0.1, fry: 0, frz: -0.3, frp: 0 },
  { t: 0.14, hw: 44, sw: 34, la: 70, ll: 0.34 }, { t: 0.25, hy: -0.28, hp: 18, hw: -34, sp: 20, sw: -24, np: -30, nw: 42, la: 4, le: 4, ll: 1, ra: -120, re: -20, ba: -150, flz: 0.5, frz: -0.4, frp: 30 }, { t: 0.44, la: 3, le: 5 }, at(0.9, READYK) ] });

// after a parry or a last-instant dodge: six cuts too fast to follow, then the wait
def('reckon', { dur: 2.3, hit: [0.14, 0.2], hits: [[0.14, 0.2], [0.28, 0.34], [0.42, 0.48], [0.56, 0.62], [0.7, 0.76], [0.84, 0.9], [1.5, 1.62]], chain: 1.75, free: 1.8, power: 0.85, reel: true, arc: 180, reach: 2.6, blend: 0.08, move: [[0, 0], [0.1, 0.4], [0.5, 1.0], [0.9, 1.6], [1.1, 1.8], [2.3, 1.8]], fx: [{ t: 0.12, kind: 'blur' }, { t: 0.26, kind: 'blur' }, { t: 0.4, kind: 'blur' }, { t: 0.54, kind: 'blur' }, { t: 0.68, kind: 'blur' }, { t: 0.82, kind: 'blur' }, { t: 1.5, kind: 'reckon' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.26, hp: 16, hw: -40, sp: 14, sw: -26, np: -16, nw: 46, ra: -96, re: -30, rl: 0.9, ba: -160, be: -10, la: 30, le: -20, ll: 0.6, lg: 0, flx: 0.1, fly: 0, flz: 0.34, flp: 0, frx: -0.12, fry: 0, frz: -0.34, frp: 20 },
  { t: 0.17, hw: 30, sw: 30, nw: -30, ra: 56, re: 34, rl: 0.95, ba: 96, be: 40 }, { t: 0.24, ra: 60, re: 40 }, { t: 0.31, hw: -30, sw: -28, nw: 40, ra: -70, re: -34, ba: -104, be: -36 }, { t: 0.38, ra: -74, re: 30, be: 60 }, { t: 0.45, hw: 24, sw: 28, nw: -26, ra: 54, re: -40, ba: 92, be: -44 }, { t: 0.52, ra: 60, re: 4, be: 0 }, { t: 0.59, hw: -30, sw: -30, nw: 40, ra: -76, re: 2, ba: -110, be: 2 }, { t: 0.66, ra: -60, re: 60, be: 90 }, { t: 0.73, hw: 20, sw: 22, nw: -20, ra: 40, re: -44, ba: 70, be: -50 }, { t: 0.8, tw: 0, ra: 56, re: -10 }, { t: 0.87, tw: 30, hw: -34, sw: -30, nw: 40, ra: -84, re: 0, ba: -124, be: 0, la: 90, le: 0 },
  { t: 1.05, tw: 150, hy: -0.1, hp: 0, hw: -10, sp: 0, sw: 0, np: 4, nw: 6, ra: -50, re: -40, ba: -60, be: -20, la: 30, le: -50, ll: 0.7, flz: 0.16, frz: -0.18, frp: 0 }, { t: 1.4, tw: 180, hy: -0.04, sp: -6, np: 10, ra: -30, re: -46, rl: 0.8, ba: -20, be: -56, la: 20, le: -60, ll: 0.8 }, { t: 1.5, re: -56, rl: 0.95, be: -78, np: 16 }, { t: 1.8, re: -58, be: -80 }, at(2.3, RESTK, { tw: 0 }) ] });

// on a helpless enemy: in to the hilt, hold, and out with fire
def('execute', { dur: 2.7, hit: [0.46, 0.56], hits: [[0.46, 0.56], [1.62, 1.74]], chain: 2.15, free: 2.2, power: 3.2, arc: 180, reach: 4, blend: 0.14, move: [[0, 0], [0.3, 0.2], [0.48, 1.1], [1.5, 1.1], [1.66, 0.2], [2.7, 0.1]], fx: [{ t: 0.12, kind: 'flare' }, { t: 0.8, kind: 'flare' }, { t: 1.2, kind: 'flare' }, { t: 1.62, kind: 'wrench' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hp: 8, hw: -46, sp: 8, sw: -24, np: -10, nw: 54, ra: -120, re: -20, rl: 0.62, ba: -4, be: 6, bo: 0, la: 10, le: 10, ll: 0.8, lg: 0, flx: 0.08, fly: 0, flz: 0.3, flw: -4, flp: 0, frx: -0.1, fry: 0, frz: -0.3, frw: -60, frp: 0 },
  { t: 0.36, hy: -0.28, hw: -58, sw: -30, ra: -130, be: 10 }, { t: 0.5, hy: -0.26, hp: 20, hw: 34, sp: 14, sw: 20, np: -18, nw: -30, ra: -4, re: 24, rl: 0.96, ba: 0, be: 18, la: 10, le: 18, ll: 0.86, lg: 0.9, frx: -0.06, frz: 0.5, frw: -4, flz: -0.46, flw: 40, flp: 34 },
  { t: 0.66, hy: -0.3, hp: 24, rl: 0.9, lg: 1 }, { t: 1.46, hy: -0.34, hp: 28, sp: 18, rl: 0.84, be: 14 }, { t: 1.54, hy: -0.36, rl: 0.7 }, { t: 1.68, hy: -0.16, hp: -8, hw: -20, sp: -20, sw: -24, np: 8, nw: 20, ra: -70, re: 20, rl: 0.96, ba: -80, be: 30, lg: 0, la: 90, le: -10, ll: 0.9 }, { t: 2.1, hy: -0.2, hp: 4, sp: -4, ra: -76, re: -10, ba: -110, be: -6 }, at(2.7, RESTK) ] });

// skill 2, Sunder Arc: one vertical cut whose edge keeps going
def('sunder', { dur: 1.5, chain: 0.95, free: 1.0, blend: 0.14, move: [[0, 0], [0.4, -0.2], [0.56, 0.6], [1.5, 0.7]], fx: [{ t: 0.1, kind: 'flare' }, { t: 0.3, kind: 'flare' }, { t: 0.5, kind: 'sunder' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hp: 6, hw: -40, sp: 6, sw: -20, np: -6, nw: 44, ra: -90, re: -20, rl: 0.9, ba: -140, be: 10, la: 20, le: -20, ll: 0.6, lg: 0, flx: 0.1, fly: 0, flz: 0.3, flp: 0, frx: -0.12, fry: 0, frz: -0.34, frp: 0 },
  { t: 0.3, hy: -0.06, hp: -14, hw: -24, sp: -24, sw: -14, np: 12, nw: 22, ra: -30, re: 82, rl: 0.9, ba: -10, be: 140, la: -10, le: 70, lg: 0.8 }, { t: 0.44, hp: -16, sp: -28, re: 88, be: 156, lg: 1 },
  { t: 0.52, hy: -0.28, hp: 22, hw: 10, sp: 26, sw: 10, np: -24, nw: -8, ra: -6, re: -20, rl: 1, ba: 0, be: -20, flz: 0.5, frz: -0.4, frp: 40 }, { t: 0.6, hy: -0.36, sp: 34, re: -46, be: -48 }, { t: 0.95, hy: -0.34, be: -46 }, at(1.5, READYK) ] });

// ultimate, Last Rites. Every fire in the court comes to the blade. One draw.
def('rites', { dur: 4.4, chain: 4.0, free: 4.0, blend: 0.2, fx: [{ t: 0.2, kind: 'ritesStart' }, { t: 2.06, kind: 'rites' }, { t: 3.3, kind: 'ritesEnd' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.1, hp: 0, hw: -20, sp: 0, sw: 0, np: -4, nw: 14, ra: -60, re: -40, rl: 0.8, ba: -90, be: -10, la: 20, le: -50, ll: 0.7, lg: 0, flx: 0.08, fly: 0, flz: 0.2, flp: 0, frx: -0.1, fry: 0, frz: -0.22, frp: 0 },
  { t: 0.7, hy: 0, hp: -6, sp: -12, np: 14, ra: -20, re: 84, rl: 0.95, ba: 0, be: 90, la: -10, le: 78, lg: 0.8 }, { t: 1.5, hy: 0.02, re: 88, sp: -14, lg: 1 }, { t: 1.72, hy: -0.2, hp: 8, hw: -56, sp: 8, sw: -34, np: -4, nw: 70, ra: -110, re: -24, rl: 0.95, ba: -176, be: -6, la: 20, le: -20, lg: 0, flx: 0.14, flz: 0.4, frx: -0.16, frz: -0.42 }, { t: 2.02, hw: -60, sw: -36, hy: -0.24 },
  { t: 2.1, hw: 30, sw: 34, nw: -20, ra: 40, re: 4, rl: 1, ba: 60, be: 4, la: 100, le: -10, ll: 0.9 }, { t: 2.18, hw: 46, sw: 44, nw: -30, ra: 74, re: 10, ba: 120, be: 10 }, { t: 2.9, hw: 46, sw: 44, ra: 76, ba: 124 }, { t: 3.3, tw: 60, hy: -0.06, hp: -2, hw: 0, sp: -4, sw: 0, np: 6, nw: 0, ra: -50, re: -40, rl: 0.9, ba: -60, be: -40 }, { t: 3.8, tw: 60, ra: -60, re: -60 }, at(4.4, RESTK, { tw: 0 }) ] });
}
