// The King's grab, reactions, and the attack table the combat code reads.
import { clip, type Clip } from '../anim/pose.ts';

export function addMoves(K: Record<string, Clip>) {
// a long-armed lunge with the empty hand: the unblockable
K.grab = clip('grab', { dur: 3.5, hit: [1.36, 1.52], blend: 0.3, move: [[0, 0], [1.0, -0.35], [1.28, -0.3], [1.5, 3.0], [1.7, 3.2], [3.5, 3.2]], fx: [{ t: 1.5, kind: 'sweep' }], keys: [
  { t: 0, hy: -0.2, hp: 10, hw: 18, sp: 18, sw: 16, np: -36, nw: -22, nr: -14, ra: -40, re: -58, rl: 0.9, ba: -20, be: -28, la: 70, le: -30, ll: 0.85, lg: 0, flz: 0.3, frz: -0.3 },
  { t: 0.6, hy: -0.4, hp: 6, hw: 40, sp: 6, sw: 34, np: -30, nw: -60, nr: 18, la: 128, le: 26, ll: 0.82, ra: -30, re: -50, flz: 0.34, frz: -0.4 },
  { t: 0.95, hy: -0.46, hw: 44, sw: 38, la: 136, le: 34, nr: 30 }, { t: 1.28, hy: -0.48, hw: 46, sw: 40, la: 140, le: 36, nr: 34 },
  { t: 1.44, hy: -0.56, hp: 34, hw: -14, sp: 38, sw: -26, np: -64, nw: 30, nr: 0, la: 0, le: -30, ll: 1, ra: -80, re: -50, flz: -0.5, frz: 0.7, flp: 30 },
  { t: 1.6, hy: -0.6, hp: 36, sp: 42, la: -10, le: -40 }, { t: 2.6, hy: -0.58, hp: 34, sp: 40, sw: -30, nr: -20, la: -14, le: -42, ra: -84 },
  { t: 3.5, hy: -0.14, hp: 10, hw: 8, sp: 22, sw: -10, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, flz: 0.34, flp: 0, frz: -0.22 } ] });
// struck hard: the spine folds the wrong way
K.reel = clip('reel', { dur: 1.5, blend: 0.07, move: [[0, 0], [0.14, -0.5], [0.45, -1.1], [1.5, -1.1]], keys: [
  { t: 0, hy: -0.18, hp: -10, hw: -18, hr: 6, sp: -22, sw: -26, sr: 10, np: 26, nw: 30, nr: 40, ra: -80, re: -20, rl: 0.95, ba: -60, be: -20, la: 86, le: 6, ll: 0.95, lg: 0, flx: 0.1, flz: 0.3, flw: 10, flp: 0, frx: -0.1, frz: -0.36, frw: -22, frp: 0 },
  { t: 0.2, hy: -0.36, hp: -14, sp: -30, sw: -34, nr: 58, la: 100, ra: -100, ba: -84 }, { t: 0.55, hy: -0.4, hp: 16, hw: 10, hr: -4, sp: 34, sw: 14, sr: -8, np: -20, nw: -10, nr: -30, la: 30, le: -50, ra: -30, re: -50, ba: -30, be: -40 },
  { t: 1.0, hy: -0.34, sp: 36, nr: 20 }, { t: 1.5, hy: -0.14, hp: 10, hw: 8, hr: -2, sp: 22, sw: -10, sr: 6, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, flz: 0.34, frz: -0.22 } ] });
// parried: driven to one knee, head down at blade height
K.kneel = clip('kneel', { dur: 3.4, blend: 0.16, move: [[0, 0], [0.3, -0.8], [3.4, -0.8]], fx: [{ t: 0.42, kind: 'thud' }], keys: [
  { t: 0, hy: -0.3, hp: -6, hw: -20, sp: -14, sw: -30, np: 10, nw: 20, nr: 30, ra: -110, re: 20, rl: 0.95, ba: -90, be: 50, la: 60, le: -20, ll: 0.9, lg: 0, flx: 0.1, flz: 0.3, flw: 10, flp: 0, frx: -0.1, frz: -0.3, frw: -22, frp: 0 },
  { t: 0.42, hy: -0.95, hp: 18, hw: 4, sp: 34, sw: 6, np: 0, nw: 0, nr: -20, ra: -50, re: -60, ba: -60, be: -12, la: 24, le: -66, ll: 0.95, flz: 0.55, frz: -0.6, frp: 50 },
  { t: 0.6, hy: -0.98, sp: 42, np: 8 }, { t: 2.5, hy: -0.97, hp: 18, sp: 40, np: 2, nr: 14, ra: -48, la: 22 },
  { t: 3.4, hy: -0.14, hp: 10, hw: 8, sp: 22, sw: -10, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, flz: 0.34, frz: -0.22, frp: 0 } ] });
// out of health: folds to its knees, hangs there, then snaps upright in three broken jerks
K.fall = clip('fall', { dur: 6.6, blend: 0.2, fx: [{ t: 0.9, kind: 'thud' }, { t: 1.5, kind: 'thud' }, { t: 5.2, kind: 'sweep' }], keys: [
  { t: 0, hy: -0.2, hp: -10, hw: 0, sp: -24, sw: -10, np: 30, nw: 0, nr: 30, ra: -80, re: 10, rl: 0.9, ba: -60, be: 10, la: 80, le: 10, ll: 0.9, lg: 0, flx: 0.1, flz: 0.2, flw: 10, flp: 0, frx: -0.1, frz: -0.2, frw: -22, frp: 0 },
  { t: 0.5, hy: -0.3, sp: -30, np: 36, nr: 44 }, { t: 0.95, hy: -1.1, hp: 8, sp: 4, np: 10, ra: -40, re: -70, rl: 0.95, ba: -50, be: -14, la: 30, le: -72, ll: 0.95, flz: -0.1, flp: 54, frz: -0.5, frp: 56 },
  { t: 1.5, hy: -1.16, hp: 26, sp: 52, np: 30, nr: -16, ra: -24, re: -66, la: 18, le: -66 }, { t: 4.6, hy: -1.17, sp: 54, np: 34 },
  { t: 4.75, hy: -1.0, hp: 10, sp: 20, np: -30, nr: 48 }, { t: 5.1, hy: -0.98, nr: 50 }, { t: 5.25, hy: -0.5, hp: -4, sp: -14, np: 0, nr: -40, ra: -70, re: -40, la: 70, le: -40, flz: 0.2, flp: 0, frz: -0.3, frp: 0 }, { t: 5.7, hy: -0.48, sp: -16, nr: -44 },
  { t: 5.85, hy: -0.16, hp: 8, sp: 18, np: -34, nr: -14 }, { t: 6.6, hy: -0.14, hp: 10, hw: 8, sp: 22, sw: -10, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, flz: 0.34, frz: -0.22 } ] });
}
