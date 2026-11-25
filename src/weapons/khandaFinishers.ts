// Khanda: finishers (hold Attack instead of tapping the next hit) and guard reactions.
import { makePose, type ClipDef } from '../anim/pose.ts';

/** Blade across the body, off hand braced behind the flat. */
export const GUARD = makePose({
  hx: 0, hy: -0.15, hp: 8, hw: -24, hr: 0, sp: 10, sw: -4, np: -12, nw: 26,
  ra: -34, re: -14, rl: 0.62, ba: 72, be: 38, la: 30, le: 4, ll: 0.56, xl: 14, xr: 8,
  flx: 0.08, flz: 0.25, flw: -6, frx: -0.1, frz: -0.26, frw: -56,
});

export function addFinishers(def: (n: string, d: ClipDef) => void) {
// after 1: rising cut. Blade drops behind the left hip, then tears upward and carries the body with it.
def('risingCut', { dur: 1.05, hit: [0.2, 0.36], chain: 0.64, free: 0.7, power: 2.0, reel: true, blend: 0.14, move: [[0, 0], [0.16, 0.15], [0.34, 1.0], [1.05, 1.05]], fx: [{ t: 0.22, kind: 'flare' }, { t: 0.62, kind: 'dust' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hp: 14, hw: 34, sp: 18, sw: 28, np: -14, nw: -48, ra: 46, re: -36, rl: 0.7, ba: 138, be: -26, la: 20, le: -40, ll: 0.6, lg: 0.8, flx: 0.1, fly: 0, flz: 0.28, flw: 8, flp: 0, frx: -0.1, fry: 0, frz: -0.26, frw: -38, frp: 10 },
  { t: 0.16, hy: -0.34, hp: 18, sw: 36, sp: 24, ra: 56, re: -44, ba: 154, be: -34, lg: 1 },
  { t: 0.22, air: 0 }, { t: 0.25, hy: -0.08, hp: 2, hw: 6, sp: 2, sw: 6, nw: -6, ra: 6, re: -2, rl: 0.95, ba: 12, be: -8, air: 1 },
  { t: 0.33, hy: 0.3, hp: -12, hw: -16, sp: -20, sw: -14, np: 12, nw: 18, ra: -16, re: 62, rl: 0.98, ba: -18, be: 72, lg: 0.3, flx: 0.03, fly: 0.36, flz: 0.14, flp: 20, frx: -0.04, fry: 0.28, frz: -0.2, frp: 48 },
  { t: 0.44, hy: 0.44, hw: -22, sp: -26, ra: -28, re: 84, rl: 0.96, ba: -40, be: 112, lg: 0, la: 64, le: -34, ll: 0.85, fly: 0.46, fry: 0.4 },
  { t: 0.6, hy: -0.16, hp: 6, air: 1, sp: -2, np: -2, ra: -50, re: 30, rl: 0.9, ba: -70, be: 46, fly: 0, fry: 0, flp: 0, frp: 12 },
  { t: 0.62, air: 0 }, { t: 0.74, hy: -0.26, hp: 14, hw: -34, sp: 12, sw: -8, nw: 32, ra: -72, re: -18, ba: -104, be: -10, flz: 0.3, frz: -0.3, frw: -56 },
  { t: 1.05, hy: -0.13, hp: 8, hw: -38, sp: 12, sw: 2, np: -14, nw: 34, ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, frp: 0, frw: -62 } ] });

// after 2: spinning cleave. Two low turns at full reach; hits everything around.
def('cleave', { dur: 1.2, hit: [0.2, 0.38], hits: [[0.2, 0.38], [0.42, 0.6]], chain: 0.78, free: 0.84, power: 1.35, reel: true, arc: 180, reach: 2.3, blend: 0.14, move: [[0, 0], [0.16, 0.05], [0.6, 1.5], [1.2, 1.6]], fx: [{ t: 0.22, kind: 'dust' }, { t: 0.44, kind: 'crescent' }, { t: 0.62, kind: 'dust' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.24, hp: 14, hw: -36, sp: 14, sw: -26, np: -12, nw: 40, ra: -84, re: -30, rl: 0.86, ba: -134, be: -20, la: 46, le: -14, ll: 0.7, lg: 0, flx: 0.1, fly: 0, flz: 0.28, flw: 0, flp: 0, frx: -0.1, fry: 0, frz: -0.3, frw: -46, frp: 0 },
  { t: 0.15, tw: -28, hy: -0.34, hw: -46, sw: -34, ra: -96, ba: -150, la: 64 },
  { t: 0.19, air: 1 }, { t: 0.29, tw: 170, hy: -0.2, hp: 12, hw: -10, sp: 12, sw: 14, sr: -6, nw: 8, ra: -68, re: -10, rl: 0.99, ba: -76, be: -8, la: 84, le: 6, ll: 0.88, flx: 0.04, fly: 0.05, flz: 0.1, frx: -0.1, fry: 0.2, frz: -0.22, frp: 34 },
  { t: 0.4, tw: 372, hy: -0.28, ra: -66, re: -14, ba: -72, be: -12, flx: 0.14, fly: 0.12, flz: -0.14, flp: 30, frx: -0.04, fry: 0.02, frz: 0.12, frp: 0 },
  { t: 0.5, tw: 560, hy: -0.14, sr: 4, ra: -62, re: 0, ba: -66, be: 0, fly: 0.05, frz: -0.2, fry: 0.16 },
  { t: 0.6, tw: 716, hy: -0.28, hw: 14, sw: 30, sp: 12, ra: 20, re: -6, rl: 0.95, ba: 36, be: -6, fly: 0, flz: 0.3, flp: 0, fry: 0, frz: -0.3, frp: 0 },
  { t: 0.62, air: 0 }, { t: 0.7, tw: 726, hy: -0.32, hw: 28, sw: 40, nw: -34, ra: 66, re: -8, rl: 0.9, ba: 118, be: -8, la: 116, le: 6, flx: 0.16, flz: 0.36, flw: 14, frx: -0.16, frz: -0.36, frw: -40 },
  { t: 0.92, tw: 722, ba: 126, ra: 68 }, { t: 1.2, tw: 720, hy: -0.16, hw: -16, sw: 4, nw: 14, sp: 10, ra: -40, re: -44, rl: 0.8, ba: -120, be: -24, la: 20, le: -36, ll: 0.65, flx: 0.09, flz: 0.26, frx: -0.1, frz: -0.27, frw: -60 } ] });

// after 3: thrust. The blade is drawn back level, the free hand sights along it, then one long lunge held to the end.
def('thrust', { dur: 1.2, hit: [0.3, 0.42], chain: 0.74, free: 0.8, power: 2.4, reel: true, arc: 40, reach: 2.7, blend: 0.16, move: [[0, 0], [0.24, -0.12], [0.36, 2.3], [0.5, 2.6], [1.2, 2.6]], fx: [{ t: 0.31, kind: 'thrust' }, { t: 0.36, kind: 'dust' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.16, hp: 6, hw: -40, hr: 0, sp: 6, sw: -18, np: -6, nw: 52, ra: -116, re: -34, rl: 0.6, ba: -8, be: 2, bo: 0, la: 12, le: 6, ll: 0.9, lg: 0, xr: 26, flx: 0.06, flz: 0.26, flw: -4, frx: -0.1, frz: -0.26, frw: -64, frp: 0, flp: 0 },
  { t: 0.22, hy: -0.28, hp: 10, hw: -58, sw: -28, nw: 78, ra: -128, re: -26, rl: 0.66, ba: 0, be: 1, la: 4, le: 4, ll: 0.96 },
  { t: 0.29, hw: -30 }, { t: 0.355, hy: -0.36, hp: 22, hw: 44, sp: 18, sw: 24, np: -30, nw: -44, ra: -2, re: 6, rl: 1, ba: 0, be: 0, xr: 0, la: 128, le: -10, ll: 0.9, frx: -0.06, frz: 0.6, frw: -2, flz: -0.56, flw: 44, flp: 40 },
  { t: 0.44, hy: -0.4, hp: 24, sw: 28, la: 138, le: -14 }, { t: 0.76, hy: -0.39, hp: 22, sp: 16, sw: 27, la: 136, le: -14, ra: -2, re: 5, ba: 0 },
  { t: 1.2, hy: -0.16, hp: 8, hw: -30, sp: 12, sw: 2, np: -14, nw: 32, ra: -58, re: -50, rl: 0.82, ba: -150, be: -24, la: 12, le: -38, ll: 0.62, frx: -0.1, frz: -0.27, frw: -60, flz: 0.27, flw: -8, flp: 0 } ] });

// after 4: ground slam. Blade reversed and driven into the stone; the floor answers with fire.
def('groundSlam', { dur: 1.7, hit: [0.44, 0.6], chain: 1.06, free: 1.12, power: 2.9, reel: true, arc: 180, reach: 2.9, blend: 0.14, move: [[0, 0], [0.18, 0.1], [0.44, 1.2], [1.7, 1.2]], fx: [{ t: 0.2, kind: 'flare' }, { t: 0.45, kind: 'erupt' }, { t: 1.0, kind: 'flare' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.28, hp: 16, hw: 8, sp: 16, sw: 14, np: -16, nw: -10, ra: 24, re: -10, rl: 0.6, ba: 60, be: -20, la: 20, le: -20, ll: 0.6, lg: 0.6, flx: 0.1, fly: 0, flz: 0.2, flw: 6, flp: 0, frx: -0.1, fry: 0, frz: -0.24, frw: -30, frp: 0 },
  { t: 0.16, hy: -0.36, hp: 20, sp: 22, sw: 2, ra: 6, re: -6, ba: 18, be: -50, lg: 1 },
  { t: 0.2, air: 1 }, { t: 0.31, hy: 0.42, hp: -16, hw: 0, sp: -24, sw: 0, np: -8, nw: 0, ra: -6, re: 58, rl: 0.8, ba: 4, be: -70, flx: 0.06, fly: 0.46, flz: -0.14, flp: 60, frx: -0.08, fry: 0.6, frz: -0.06, frp: 60 },
  { t: 0.37, hy: 0.4, re: 62, be: -80 },
  { t: 0.44, air: 1, hy: -0.42, hp: 24, sp: 30, np: -24, ra: -8, re: -34, rl: 0.72, ba: 4, be: -84, fly: 0, flz: 0.28, flp: 0, fry: 0, frz: -0.34, frp: 54 },
  { t: 0.46, air: 0 }, { t: 0.54, hy: -0.5, hp: 28, sp: 36, np: -20, re: -40, be: -85 },
  { t: 1.04, hy: -0.49, hp: 26, sp: 33, np: 2, re: -39, be: -85, lg: 1, ba: 4 },
  { t: 1.3, hy: -0.22, hp: 10, hw: -22, sp: 8, np: -6, nw: 18, ra: -48, re: -40, rl: 0.8, ba: -40, be: -58, lg: 0, la: 20, le: -54, ll: 0.75, frp: 8 },
  { t: 1.7, hy: -0.08, hp: 0, hw: -32, sp: 0, sw: 4, np: 4, nw: 26, ra: -62, re: -62, rl: 0.92, ba: -136, be: -32, la: 18, le: -66, ll: 0.84, frp: 0, frz: -0.2, frw: -58, flz: 0.16 } ] });

// --- guard reactions
def('block', { dur: 0.42, chain: 0.18, free: 0.3, blend: 0.05, move: [[0, 0], [0.08, -0.4], [0.26, -0.72], [0.42, -0.76]], fx: [{ t: 0.03, kind: 'scrapeFeet' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.2, hz: 0, hp: 4, hw: -24, sp: -4, sw: -10, np: -10, nw: 26, ra: -30, re: -6, rl: 0.46, ba: 78, be: 50, bo: 0, la: 30, le: 10, ll: 0.46, lg: 0, xl: 14, xr: 8, flx: 0.1, flz: 0.3, flw: -6, frx: -0.12, frz: -0.34, frw: -56 },
  { t: 0.08, hy: -0.25, sp: -10, hp: -2, rl: 0.42, be: 58, np: -2 }, { t: 0.42, hy: -0.15, hp: 8, sp: 10, sw: -4, np: -12, ra: -34, re: -14, rl: 0.62, ba: 72, be: 38, la: 30, le: 4, ll: 0.56 } ] });
def('parry', { dur: 0.75, chain: 0.14, free: 0.34, blend: 0.05, move: [[0, 0], [0.1, 0.1], [0.75, 0.12]], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.16, hp: 6, hw: -20, sp: 4, sw: -8, np: -8, nw: 22, ra: -20, re: 0, rl: 0.7, ba: 60, be: 46, bo: 0, la: 30, le: 0, ll: 0.6, lg: 0, xr: 0, xl: 10, flx: 0.08, flz: 0.28, flw: -4, frx: -0.1, frz: -0.28, frw: -56 },
  { t: 0.09, hy: -0.08, hp: -4, hw: 16, sp: -10, sw: 26, np: 4, nw: -24, ra: 48, re: 34, rl: 0.95, ba: 92, be: 40, la: 110, le: -30, ll: 0.85 },
  { t: 0.3, hw: 20, sw: 30, ra: 56, re: 38, ba: 108, be: 44 }, { t: 0.75, hy: -0.13, hp: 6, hw: -20, sp: 8, sw: 0, np: -10, nw: 22, ra: -40, re: -36, rl: 0.75, ba: 60, be: 10, la: 26, le: -30, ll: 0.6 } ] });
}
