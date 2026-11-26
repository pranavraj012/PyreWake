// Khanda: the bodies of the four newer fire arts. Their fire is the fight's and the view's; these are only the motion.
import type { ClipDef } from '../anim/pose.ts';
import { READYK, at } from './khandaArts.ts';

export function addSpells(def: (n: string, d: ClipDef) => void) {
// Pyre Brand: blade reversed, high, then driven point first into the stone and held while the ring catches
def('brand', { dur: 1.35, chain: 0.95, free: 1.0, blend: 0.12, move: [[0, 0], [0.2, 0.15], [0.38, 0.55], [1.35, 0.55]], fx: [{ t: 0.08, kind: 'flare' }, { t: 0.4, kind: 'brand' }, { t: 0.9, kind: 'flare' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hp: 8, hw: -10, sp: 8, sw: -4, np: -8, nw: 8, ra: -10, re: 30, rl: 0.8, ba: 6, be: -60, bo: 0, la: 10, le: 30, ll: 0.8, lg: 0.8, flx: 0.09, fly: 0, flz: 0.22, flp: 0, frx: -0.1, fry: 0, frz: -0.26, frw: -30, frp: 0 },
  { t: 0.24, hy: -0.04, hp: -10, sp: -18, np: 10, re: 70, rl: 0.82, be: -70, lg: 1 },
  { t: 0.4, hy: -0.46, hp: 26, sp: 32, np: -22, ra: -6, re: -36, rl: 0.74, be: -86, flz: 0.32, frz: -0.38, frp: 50 },
  { t: 0.5, hy: -0.5, hp: 28, sp: 36, np: -16 }, { t: 0.92, hy: -0.49, np: -4 },
  { t: 1.12, hy: -0.2, hp: 10, hw: -26, sp: 8, np: -8, nw: 24, ra: -54, re: -40, rl: 0.82, ba: -110, be: -30, lg: 0, la: 20, le: -50, ll: 0.7, frp: 0 }, at(1.35, READYK) ] });

// Ashen Step: a low crouch, gone, and down from above and behind with both hands
def('ashstep', { dur: 1.15, hit: [0.4, 0.5], chain: 0.72, free: 0.78, power: 6.2, reel: true, arc: 140, reach: 2.6, blend: 0.08, fx: [{ t: 0.06, kind: 'flare' }, { t: 0.14, kind: 'blink' }, { t: 0.42, kind: 'stepCut' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.32, hp: 26, hw: -30, sp: 22, sw: -20, np: -26, nw: 30, ra: -100, re: -20, rl: 0.9, ba: -160, be: -10, la: 40, le: -20, ll: 0.7, lg: 0, flx: 0.1, fly: 0, flz: 0.3, flp: 0, frx: -0.12, fry: 0, frz: -0.36, frp: 40 },
  { t: 0.14, hy: -0.4, hp: 30 }, { t: 0.2, air: 1 },
  { t: 0.3, hy: 0.5, hp: -12, hw: 0, sp: -22, sw: 0, np: 10, nw: 0, ra: -14, re: 84, rl: 0.86, ba: 0, be: 150, la: -8, le: 76, ll: 0.86, lg: 0.9, fly: 0.3, flz: -0.1, flp: 40, fry: 0.44, frz: 0.12, frp: 30 },
  { t: 0.38, hy: 0.3, sp: -10, re: 60, be: 100, lg: 1 },
  { t: 0.46, air: 1, hy: -0.38, hp: 26, sp: 34, np: -30, ra: -6, re: -34, rl: 0.96, be: -40, fly: 0, fry: 0, flz: 0.34, flp: 0, frz: -0.34, frp: 48 }, { t: 0.48, air: 0 },
  { t: 0.62, hy: -0.44, sp: 36, re: -40, be: -46 }, at(1.15, READYK) ] });

// Funeral Wheel: three low turns at full reach, the blade on fire, ending square to it
def('pyreWheel', { dur: 1.45, hit: [0.2, 0.34], hits: [[0.2, 0.34], [0.44, 0.58], [0.68, 0.84]], chain: 1.0, free: 1.06, power: 2.4, reel: true, arc: 180, reach: 2.7, blend: 0.12, move: [[0, 0], [0.14, 0.05], [0.84, 2.2], [1.45, 2.3]], fx: [{ t: 0.08, kind: 'flare' }, { t: 0.27, kind: 'wheelFire' }, { t: 0.51, kind: 'wheelFire' }, { t: 0.76, kind: 'wheelFire' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.26, hp: 14, hw: -36, sp: 14, sw: -26, np: -12, nw: 40, ra: -84, re: -24, rl: 0.9, ba: -134, be: -14, la: 30, le: -16, ll: 0.6, lg: 0, flx: 0.1, fly: 0, flz: 0.28, flp: 0, frx: -0.1, fry: 0, frz: -0.3, frw: -46, frp: 0 },
  { t: 0.14, tw: -24, hy: -0.32, hw: -44, sw: -32, ra: -94, ba: -148 },
  { t: 0.27, tw: 150, hy: -0.3, hp: 16, hw: -10, sp: 14, sw: 10, sr: -6, nw: 6, ra: -68, re: -8, rl: 1, ba: -74, be: -6, la: 40, le: -10, ll: 0.6 },
  { t: 0.39, tw: 360 }, { t: 0.51, tw: 510, sr: 6 }, { t: 0.63, tw: 720 }, { t: 0.76, tw: 870, sr: -4 },
  { t: 0.88, tw: 1080, hy: -0.32, hw: 20, sw: 30, sr: 0, nw: -24, ra: 62, re: -10, rl: 0.92, ba: 112, be: -10, la: 24, le: -24, flx: 0.14, flz: 0.34, frx: -0.14, frz: -0.34 },
  { t: 1.1, tw: 1080, ba: 120 }, at(1.45, READYK, { tw: 1080 }) ] });

// Ashfall: the burnt hand raised and opened to the sky, then closed and brought down
def('ashfall', { dur: 1.3, chain: 0.85, free: 0.9, blend: 0.14, fx: [{ t: 0.1, kind: 'flare' }, { t: 0.46, kind: 'ashfall' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.12, hp: 4, hw: -30, sp: 6, sw: -4, np: -6, nw: 30, ra: -66, re: -50, rl: 0.86, ba: -140, be: -28, la: 20, le: -40, ll: 0.7, lg: 0, xl: 10, flx: 0.09, fly: 0, flz: 0.24, flp: 0, frx: -0.1, fry: 0, frz: -0.26, frw: -56, frp: 0 },
  { t: 0.3, hy: -0.04, hp: -8, sp: -16, np: 18, la: 10, le: 78, ll: 0.98, xl: 0 }, { t: 0.46, hy: -0.02, sp: -18, np: 22, le: 84, ll: 1 },
  { t: 0.62, hy: -0.2, hp: 14, sp: 18, np: -14, la: 30, le: -10, ll: 0.6, xl: 30 }, at(1.3, READYK) ] });
}
