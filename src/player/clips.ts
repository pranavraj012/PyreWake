// Body motion shared by every weapon: evasion, reactions, healing, skills. Right-handed; character faces +Z.
import { clip, type Clip } from '../anim/pose.ts';
import { addReactions } from './reactions.ts';

const C: Record<string, Clip> = {};
const def = (n: string, d: Parameters<typeof clip>[1]) => { C[n] = clip(n, d); };

// idle flourish: raise the burnt hand, close it, embers answer
def('clench', { dur: 3.2, free: 0.0, blend: 0.3, fx: [{ t: 1.35, kind: 'flare' }], keys: [
  { t: 0, la: 18, le: -70, ll: 0.86, np: 9, nw: 24, nr: 3, hy: -0.035 },
  { t: 0.9, la: 6, le: -34, ll: 0.66, xl: 30, np: 14, nw: 10, nr: 5 }, { t: 1.3, la: 4, le: -28, ll: 0.6, xl: 34, np: 16 }, { t: 1.5, la: 3, le: -26, ll: 0.57 },
  { t: 2.3, la: 4, le: -27, ll: 0.58, np: 12 }, { t: 3.2, la: 18, le: -70, ll: 0.86, xl: 8, np: 9, nw: 24, nr: 3 } ] });

// ash-step: one per direction. Low, long, unhurried recovery.
def('dodgeF', { dur: 0.6, free: 0.36, chain: 0.3, blend: 0.14, move: [[0, 0], [0.05, 0.35], [0.28, 3.3], [0.42, 3.75], [0.6, 3.8]], keys: [
  { t: 0, tw: 0, air: 0, hy: -0.3, hp: 34, hw: -20, sp: 20, sw: -14, np: -40, nw: 24, ra: -120, re: -24, rl: 0.95, ba: -168, be: -6, la: 120, le: -30, ll: 0.8, lg: 0, flx: 0.02, flz: 0.42, frx: -0.04, frz: -0.5, frp: 50, flw: 0, frw: -20 },
  { t: 0.22, hy: -0.4, hp: 38 }, { t: 0.4, hy: -0.26, hp: 16, sp: 12, np: -18, ra: -74, re: -44, ba: -160, be: -20, la: 40, le: -40, frp: 20, flz: 0.3, frz: -0.34 }, { t: 0.6, hy: -0.1, hp: 4, sp: 2, np: 2, ra: -62, re: -62, ba: -132, be: -30, frp: 0, flz: 0.16, frz: -0.2 } ] });
def('dodgeB', { dur: 0.62, free: 0.4, chain: 0.32, blend: 0.14, move: [[0, 0], [0.05, -0.3], [0.26, -2.7], [0.44, -3.2], [0.62, -3.25]], fx: [{ t: 0.16, kind: 'scrape' }, { t: 0.24, kind: 'scrape' }, { t: 0.32, kind: 'scrape' }], keys: [
  { t: 0, tw: 0, air: 0, hy: -0.18, hp: -12, hw: -16, sp: 12, sw: -8, np: 0, nw: 18, ra: -34, re: -50, rl: 0.9, ba: -20, be: -34, la: 70, le: -10, ll: 0.8, lg: 0, flx: 0.06, flz: 0.5, flp: 0, frx: -0.1, frz: -0.2, frw: -50 },
  { t: 0.24, hy: -0.36, hp: 10, sp: 30, np: -28, ra: -46, re: -52, ba: -38, be: -32, la: 100, le: -6, flz: 0.46, frz: -0.44, flx: 0.14, frx: -0.2 }, { t: 0.42, hy: -0.28, hp: 10, sp: 22, np: -20 }, { t: 0.62, hy: -0.1, hp: 2, sp: 0, np: 4, ra: -60, re: -62, ba: -110, be: -32, la: 24, le: -60, flz: 0.16, frz: -0.2 } ] });
const side = (s: number) => ({ dur: 0.6, free: 0.38, chain: 0.3, blend: 0.14, move: [[0, 0], [0.05, 0.3], [0.28, 2.9], [0.44, 3.3], [0.6, 3.35]] as [number, number][], keys: [
  { t: 0, tw: 0, air: 0, hy: -0.2, hp: 10, hw: -30, hr: 12 * s, sp: 12, sw: 10 * s, np: -10, nw: 20, ra: -80, re: -24, rl: 0.9, ba: -140, be: -12, la: 80, le: -10, ll: 0.8, lg: 0, flx: 0.08, flz: 0.2, frx: -0.1, frz: -0.24, frw: -40 },
  { t: 0.08, air: 1 }, { t: 0.2, tw: 180 * s, hy: -0.26, hr: 16 * s, ra: -86, re: -8, ba: -100, be: 0, la: 88, le: 4, fly: 0.04, fry: 0.12 },
  { t: 0.36, tw: 352 * s, hy: -0.34, hr: 4 * s, hp: 14, sp: 16, fly: 0, fry: 0, flx: 0.2, flz: 0.26, frx: -0.22, frz: -0.28 }, { t: 0.38, air: 0 }, { t: 0.46, tw: 364 * s, ra: -70, re: -40, ba: -150, be: -18 },
  { t: 0.6, tw: 360 * s, hy: -0.12, hr: 0, hp: 4, sp: 2, sw: 2, np: 2, ra: -62, re: -60, ba: -136, be: -30, la: 20, le: -60, flx: 0.06, flz: 0.16, frx: -0.08, frz: -0.2 } ] });
def('dodgeL', side(1)); def('dodgeR', side(-1));

// a jump. Height and travel come from the motor; the clip is the shape in the air.
def('jump', { dur: 1.2, blend: 0.08, keys: [
  { t: 0, tw: 0, air: 1, hr: 0, hy: -0.2, hp: 18, hw: -18, sp: 16, sw: -8, np: -24, nw: 18, ra: -84, re: -40, rl: 0.9, ba: -150, be: -22, la: 50, le: -50, ll: 0.8, lg: 0, flx: 0.08, fly: 0, flz: 0.14, flp: 30, frx: -0.08, fry: 0, frz: -0.2, frp: 50, flw: 0, frw: -20 },
  { t: 0.12, hy: 0.04, hp: -6, sp: -12, np: 6, ra: -104, re: -14, ba: -146, be: -14, la: 84, le: 6, ll: 0.9, fly: 0.18, flz: 0.12, frx: -0.07, fry: 0.4, frz: -0.16, frp: 60 },
  { t: 0.34, hy: 0.03, hp: 10, sp: 4, np: -18, fly: 0.36, flz: 0.14, flp: 24, fry: 0.48, ra: -110, re: -4, la: 92, le: 14 }, { t: 0.62, hy: 0, hp: 12, sp: 8, np: -26, fly: 0.06, flz: 0.18, flp: 14, fry: 0.14, frz: -0.1, frp: 26, ra: -96, re: 10, ba: -140, be: 0, la: 96, le: 26 }, { t: 1.2, fly: 0.04, fry: 0.1 } ] });
def('land', { dur: 0.42, free: 0.1, chain: 0.04, blend: 0.05, fx: [{ t: 0.01, kind: 'land' }], keys: [
  { t: 0, tw: 0, air: 0, hr: 0, hy: -0.3, hp: 20, hw: -26, sp: 20, sw: 0, np: -26, nw: 26, ra: -72, re: -40, rl: 0.88, ba: -150, be: -22, la: 60, le: -20, ll: 0.8, lg: 0, flx: 0.1, fly: 0, flz: 0.24, flp: 0, frx: -0.12, fry: 0, frz: -0.26, frp: 20, frw: -50 },
  { t: 0.08, hy: -0.36 }, { t: 0.42, hy: -0.13, hp: 8, hw: -36, sp: 12, sw: 2, np: -14, nw: 34, ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, flx: 0.09, flz: 0.27, frx: -0.1, frz: -0.27, frp: 0, frw: -62 } ] });

addReactions(def);
export const BODY_CLIPS = C;
