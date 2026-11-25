// Being hit, healing, dying, Cinder Rush. The hero is never thrown flat: even the worst blow ends on one knee.
import type { ClipDef } from '../anim/pose.ts';

export function addReactions(def: (n: string, d: ClipDef) => void) {
def('hurt', { dur: 0.56, chain: 0.36, free: 0.42, blend: 0.05, move: [[0, 0], [0.1, -0.5], [0.3, -0.85], [0.56, -0.9]], keys: [
  { t: 0, air: 0, tw: 0, hx: 0, hy: -0.1, hp: -14, hw: 12, hr: 4, sp: -22, sw: 18, sr: -6, np: 10, nw: -18, nr: 10, ra: -80, re: -10, rl: 0.8, ba: -70, be: -20, la: 84, le: -4, ll: 0.8, lg: 0, flx: 0.06, flz: 0.3, flw: 0, frx: -0.1, frz: -0.3, frw: -44, fly: 0, fry: 0, flp: 0, frp: 0 },
  { t: 0.1, hy: -0.2, hp: -4, sp: -8, sw: 24, np: -14, nr: 14, ra: -96, ba: -96, la: 96 }, { t: 0.3, hy: -0.24, hp: 14, hw: -10, hr: 0, sp: 22, sw: 4, sr: 0, np: -22, nw: 10, nr: 0, ra: -66, re: -46, ba: -130, be: -24, la: 40, le: -30 },
  { t: 0.56, hy: -0.15, hp: 8, hw: -34, sp: 12, sw: 2, np: -14, nw: 32, ra: -58, re: -52, rl: 0.82, ba: -156, be: -24, la: 12, le: -38, ll: 0.62, frw: -60 } ] });
def('down', { dur: 1.5, chain: 1.05, free: 1.15, blend: 0.06, move: [[0, 0], [0.1, -1.1], [0.36, -2.9], [0.62, -3.4], [1.5, -3.4]], fx: [{ t: 0.3, kind: 'scrape' }, { t: 0.36, kind: 'scrapeFeet' }, { t: 0.42, kind: 'scrape' }, { t: 0.5, kind: 'scrape' }], keys: [
  { t: 0, air: 1, tw: 0, hx: 0, hy: 0.06, hp: -24, hw: 10, hr: 6, sp: -30, sw: 16, sr: -6, np: 22, nw: 0, nr: 8, ra: -60, re: 12, rl: 0.9, ba: -30, be: 0, la: 70, le: 10, ll: 0.9, lg: 0, flx: 0.06, fly: 0.2, flz: 0.5, flw: 0, flp: 0, frx: -0.08, fry: 0.12, frz: 0.34, frw: -30, frp: 0 },
  { t: 0.22, air: 1, hy: -0.2, hp: 0, sp: 6, np: -16, fly: 0, fry: 0, flz: 0.4, frz: -0.1 }, { t: 0.26, air: 0 },
  { t: 0.4, hy: -0.46, hp: 30, hw: -8, hr: 0, sp: 32, sw: -14, sr: 0, np: -46, nw: 16, nr: 0, ra: -84, re: -24, rl: 0.9, ba: -118, be: -10, la: 14, le: -64, ll: 0.95, flz: 0.34, frz: -0.42, frp: 52, frw: -10 },
  { t: 0.62, hy: -0.47, sp: 34 }, { t: 1.0, hy: -0.46, hp: 26, sp: 28, np: -42, la: 14, le: -60 },
  { t: 1.5, hy: -0.13, hp: 8, hw: -38, sp: 12, sw: 2, np: -14, nw: 34, ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, flz: 0.27, frz: -0.27, frp: 0, frw: -62 } ] });
// falls to the knees on the planted blade, bows, and goes to ash
def('die', { dur: 3.4, blend: 0.16, fx: [{ t: 0.5, kind: 'dust' }, { t: 1.3, kind: 'flare' }], keys: [
  { t: 0, air: 0, tw: 0, hx: 0, hy: -0.2, hp: -10, hw: 0, sp: -16, sw: 8, np: 8, nw: 0, ra: -40, re: -20, rl: 0.8, ba: -40, be: -50, la: 60, le: -30, ll: 0.8, lg: 0, flx: 0.06, flz: 0.2, flw: 0, flp: 0, frx: -0.1, frz: -0.24, frw: -30, frp: 0, fly: 0, fry: 0 },
  { t: 0.5, hy: -0.5, hp: 14, sp: 18, sw: 0, np: -10, ra: -10, re: -22, rl: 0.78, ba: 0, be: -84, la: 14, le: -40, ll: 0.7, lg: 1, flz: 0.12, flp: 20, frz: -0.34, frp: 56 },
  { t: 1.0, hy: -0.53, hp: 18, sp: 26, np: 6 }, { t: 2.0, sp: 34, np: 26 }, { t: 3.4, hy: -0.56, sp: 38, np: 32 } ] });

// the Second Flame: down on one knee, then the chest catches
def('rekindle', { dur: 1.9, chain: 1.35, free: 1.4, blend: 0.08, move: [[0, 0], [0.2, -1.2], [0.5, -1.6], [1.9, -1.6]], fx: [{ t: 0.4, kind: 'dust' }, { t: 0.95, kind: 'rekindle' }], keys: [
  { t: 0, air: 0, tw: 0, hx: 0, hy: -0.2, hp: -10, hw: 0, sp: -18, sw: 10, np: 12, nw: 0, ra: -70, re: -20, rl: 0.8, ba: -80, be: -30, la: 70, le: -20, ll: 0.8, lg: 0, flx: 0.06, flz: 0.3, flw: 0, flp: 0, frx: -0.1, frz: -0.3, frw: -30, frp: 0, fly: 0, fry: 0 },
  { t: 0.4, hy: -0.5, hp: 22, sp: 32, sw: 0, np: 14, ra: -60, re: -40, ba: -110, be: -24, la: -14, le: -24, ll: 0.42, xl: 40, flz: 0.2, frz: -0.38, frp: 56 }, { t: 0.85, hy: -0.52, sp: 36, np: 18 },
  { t: 1.0, hy: -0.12, hp: -12, sp: -26, np: 26, ra: -96, re: 0, rl: 0.95, ba: -110, be: 10, la: 96, le: 0, ll: 0.95, xl: 8, frp: 10, flz: 0.26, frz: -0.28 }, { t: 1.35, sp: -22, np: 20 },
  { t: 1.9, hy: -0.13, hp: 8, hw: -38, sp: 12, sw: 2, np: -14, nw: 34, ra: -58, re: -52, rl: 0.82, ba: -158, be: -24, la: 12, le: -38, ll: 0.62, frp: 0, frw: -62 } ] });

// draw the pyre's heat back into the chest
def('heal', { dur: 0.95, chain: 0.66, free: 0.7, blend: 0.14, fx: [{ t: 0.46, kind: 'heal' }], keys: [
  { t: 0, air: 0, tw: 0, hy: -0.06, hp: 2, hw: -22, sp: 8, sw: -4, np: -4, nw: 16, ra: -66, re: -56, rl: 0.9, ba: -124, be: -34, la: 20, le: -50, ll: 0.7, lg: 0, xl: 26, flx: 0.06, flz: 0.18, flw: -4, frx: -0.08, frz: -0.2, frw: -56, flp: 0, frp: 0 },
  { t: 0.28, hy: -0.12, sp: 18, np: 10, nw: 6, la: -16, le: -22, ll: 0.42, xl: 40 }, { t: 0.44, sp: 20, np: 14, ll: 0.38, le: -24 },
  { t: 0.56, hy: -0.02, hp: -4, sp: -12, np: 16, ll: 0.46, la: 4 }, { t: 0.95, hy: -0.06, hp: 0, sp: 0, sw: 4, np: 4, nw: 24, ra: -62, re: -62, rl: 0.92, la: 18, le: -64, ll: 0.82, xl: 8 } ] });

// Cinder Rush. Coil, gone, then standing with the back turned while the trail goes up behind. `move` is a fraction of the dash length.
def('rush', { dur: 1.75, chain: 0.6, free: 0.95, blend: 0.08, move: [[0, 0], [0.1, 0.02], [0.2, 0.5], [0.32, 0.94], [0.44, 1], [1.75, 1]], fx: [{ t: 0.09, kind: 'vanish' }, { t: 0.36, kind: 'reform' }], keys: [
  { t: 0, air: 0, tw: 0, hx: 0, hy: -0.3, hp: 26, hw: -40, sp: 22, sw: -24, np: -38, nw: 44, ra: -110, re: -26, rl: 0.9, ba: -168, be: -8, la: 30, le: -20, ll: 0.7, lg: 0, flx: 0.04, fly: 0, flz: 0.38, flw: 0, flp: 0, frx: -0.06, fry: 0, frz: -0.46, frw: -30, frp: 44 },
  { t: 0.1, hy: -0.36, hp: 32 }, { t: 0.2, hw: 10, sw: 16, nw: -10, ra: 10, re: -6, rl: 0.98, ba: 10, be: -6, la: 100, le: -8 },
  { t: 0.36, hy: -0.4, hp: 22, hw: 34, sp: 24, sw: 34, np: -20, nw: -30, ra: 78, re: -8, rl: 0.95, ba: 112, be: -6, la: 112, le: 4, ll: 0.85, flx: 0.14, flz: 0.42, frx: -0.16, frz: -0.46, frw: -40, frp: 20 },
  { t: 0.6, hy: -0.34, hp: 16, hw: 30, sp: 16, ra: 80, ba: 118 },
  { t: 0.86, hy: -0.05, hp: -2, hw: -14, sp: -4, sw: 4, np: 4, nw: 10, ra: -52, re: -50, rl: 0.95, ba: -70, be: -36, la: 22, le: -66, ll: 0.88, flx: 0.06, flz: 0.14, flw: 4, frx: -0.07, frz: -0.14, frw: -40, frp: 0 },
  { t: 1.2, hy: -0.02, hp: -3, sp: -6, np: 8, nw: -34, nr: -4, ra: -58, re: -58, ba: -84, be: -38 }, { t: 1.45, nw: -36 },
  { t: 1.75, hy: -0.035, hp: -2, hw: -30, sp: -3, sw: 6, np: 9, nw: 20, nr: 3, ra: -62, re: -66, rl: 0.93, ba: -128, be: -33, la: 18, le: -70, ll: 0.86, frw: -58, flz: 0.13, frz: -0.16 } ] });
}
