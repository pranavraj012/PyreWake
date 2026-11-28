// The Hanged King's poses, clips and attack data. No rendering imports.
import { clip, makePose, type Clip } from '../../anim/pose.ts';
import { addMoves } from './moves.ts';
import { addMoves2 } from './moves2.ts';

export const STAND = makePose({ hx: 0, hy: -0.12, hz: -0.04, hp: 10, hw: 8, hr: -2, sp: 22, sw: -12, sr: 6, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, xl: 6, flx: 0.1, flz: 0.34, flw: 10, frx: -0.1, frz: -0.22, frw: -22 });
export const CRAWL = makePose({ hy: -0.82, hz: -0.5, hp: 62, sp: 22, np: -88, ra: -14, re: -50, rl: 0.8, ba: 170, be: 2, la: 14, le: -50, ll: 0.8, flx: 0.34, flz: -0.75, flw: 34, frx: -0.34, frz: -0.75, frw: -34 });
export const HANG = makePose({ hy: 0, hp: -4, hw: 6, sp: -26, sw: 12, sr: 4, np: -44, nw: 10, nr: 16, ra: -24, re: 64, rl: 0.95, ba: 0, be: 90, la: 30, le: 58, ll: 0.95, flx: -0.12, flz: 0.02, frx: 0.12, frz: 0.02 });

const K: Record<string, Clip> = {
  // raise, then HOLD far too long, then drop
  slam: clip('slam', { dur: 3.3, hit: [1.36, 1.5], blend: 0.3, move: [[0, 0], [1.24, 0.1], [1.46, 1.7], [3.3, 1.7]], fx: [{ t: 1.45, kind: 'slam' }], keys: [
    { t: 0, hy: -0.2, hp: 12, hw: -10, sp: 20, sw: -10, np: -40, nw: 10, nr: -14, ra: -50, re: -20, rl: 0.8, ba: -40, be: -10, la: 50, le: -50, ll: 0.85, lg: 0, flz: 0.3, frz: -0.3 },
    { t: 0.62, hy: 0.0, hp: -8, hw: -22, sp: -16, sw: -14, np: 4, nw: 26, nr: -26, ra: -30, re: 76, rl: 0.92, ba: 0, be: 120, la: 26, le: 62, ll: 0.8, lg: 0.8 },
    { t: 0.8, hy: 0.03, sp: -20, re: 80, be: 136, nr: -30, lg: 1 }, { t: 1.28, hy: 0.04, sp: -22, re: 82, be: 140, nr: -34 },
    { t: 1.44, hy: -0.5, hp: 30, hw: 4, sp: 40, sw: 4, np: -62, nw: 0, nr: -8, ra: -6, re: -22, rl: 0.98, be: -28, lg: 1, flz: 0.7, frz: -0.4, frp: 30 },
    { t: 1.56, hy: -0.56, hp: 32, sp: 44, re: -26, be: -30 }, { t: 2.5, hy: -0.54, hp: 30, sp: 42, np: -60, re: -25, be: -29, nr: 14, nw: -12 }, { t: 3.3, hy: -0.14, hp: 10, hw: 8, sp: 22, sw: -10, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, lg: 0, frp: 0, flz: 0.34, frz: -0.22 } ] }),
  sweep: clip('sweep', { dur: 3.4, hit: [0.95, 1.12], blend: 0.3, move: [[0, 0], [0.8, 0.1], [1.1, 1.4], [1.75, 1.5], [2.0, 2.6], [3.4, 2.6]], fx: [{ t: 1.02, kind: 'sweep' }, { t: 1.92, kind: 'sweep' }], keys: [
    { t: 0, hy: -0.2, hp: 12, hw: -24, sp: 16, sw: -20, np: -34, nw: 40, nr: -10, ra: -70, re: -30, rl: 0.85, ba: -90, be: -10, la: 40, le: -40, ll: 0.85, lg: 0, flz: 0.34, frz: -0.3 },
    { t: 0.6, hy: -0.34, hw: -46, sw: -40, nw: 78, nr: -24, ra: -112, re: -18, rl: 0.95, ba: -160, be: -6, la: 60, le: -10 }, { t: 0.88, hw: -50, sw: -44, ra: -116, ba: -168, nr: -30 },
    { t: 1.03, hy: -0.36, hw: 6, sw: 10, nw: -8, nr: 0, ra: -6, re: -22, rl: 1, ba: -4, be: -6, la: 90, le: 0, flz: -0.2, frz: 0.5 }, { t: 1.16, hw: 40, sw: 44, nw: -60, ra: 66, re: -20, rl: 0.92, ba: 96, be: -4, la: 110 },
    { t: 1.4, hw: 44, sw: 50, nw: -72, ra: 76, ba: 128, be: 4, nr: 24 }, { t: 1.76, hw: 46, sw: 52, ra: 80, ba: 138, be: 8, nr: 30 },
    { t: 1.93, hw: -4, sw: -6, nw: 8, nr: 0, ra: -4, re: -12, rl: 1, ba: -2, be: 2, flz: 0.55, frz: -0.2, la: 60 }, { t: 2.06, hy: -0.3, hw: -40, sw: -40, nw: 60, ra: -86, re: -16, ba: -116, be: 0, la: 40, le: -30 },
    { t: 2.7, hw: -42, sw: -44, nw: 70, ra: -92, ba: -124, nr: -20 }, { t: 3.4, hy: -0.14, hw: 8, hp: 10, sp: 22, sw: -10, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, flz: 0.34, frz: -0.22 } ] }),
};
// the noose: the hero held up by the throat, the King climbing the rope with him, then the hand opens and lets him fall
K.noose = clip('noose', { dur: 6.4, blend: 0.25, keys: [
  { t: 0, hy: -0.3, hp: 12, hw: -6, sp: 14, sw: -14, np: -26, nw: 10, nr: 10, ra: -110, re: -70, rl: 0.9, ba: -60, be: -30, la: 40, le: -40, ll: 0.9 },
  { t: 1.6, hy: -0.4, hp: 18, sp: 26, np: -34, ra: -128, re: -80, la: 40, le: -40 },
  { t: 3.3, hy: -0.4, hp: 20, sp: 28, np: -40, ra: -132, re: -84 },
  { t: 3.8, hy: -0.4, hp: 20, sp: 28, np: -40, ra: -90, re: -60 },
  { t: 5.6, hy: -0.14, hp: 10, sp: 22, sw: -10, np: -38, nw: 6, ra: -38, re: -62, la: 40, le: -58 } ] });
addMoves(K); addMoves2(K);
export const KING_CLIPS = K;
