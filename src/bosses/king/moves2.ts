// More moves: the aggressive Executioner, the Crawler, the Hanged, and the One Beneath (round 2).
import { clip, makePose, type Clip, type Key } from '../../anim/pose.ts';

/** Round 2: low, wide, every arm out. */
export const STAND2 = makePose({ hx: 0, hy: -0.34, hz: -0.06, hp: 24, hw: 0, hr: 0, sp: 24, sw: 0, sr: 0, np: -46, nw: 0, nr: 6, ra: -64, re: -34, rl: 0.8, ba: -30, be: 10, la: 64, le: -34, ll: 0.8, xl: 10, xr: 10, flx: 0.14, flz: 0.4, flw: 12, frx: -0.14, frz: -0.3, frw: -24 });
const END: Key = { t: 0, hy: -0.14, hp: 10, hw: 8, hr: -2, sp: 22, sw: -10, sr: 6, np: -38, nw: 6, nr: -14, ra: -38, re: -62, rl: 0.92, ba: -14, be: -26, la: 40, le: -58, ll: 0.9, lg: 0, flx: 0.1, flz: 0.34, flp: 0, frx: -0.1, frz: -0.22, frp: 0, air: 0 };
const END2: Key = { t: 0, hx: 0, hy: -0.34, hz: -0.06, hp: 24, hw: 0, hr: 0, sp: 24, sw: 0, sr: 0, np: -46, nw: 0, nr: 6, ra: -64, re: -34, rl: 0.8, ba: -30, be: 10, la: 64, le: -34, ll: 0.8, flx: 0.14, flz: 0.4, flp: 0, frx: -0.14, frz: -0.3, frp: 0, air: 0, tw: 0 };
const at = (t: number, k: Key): Key => ({ ...k, t });

export function addMoves2(K: Record<string, Clip>) {
  // --- Executioner: the cleaver dragged in at a run and torn upward
  K.drag = clip('drag', { dur: 2.3, hit: [0.92, 1.06], blend: 0.22, move: [[0, 0], [0.3, 0.2], [0.9, 3.4], [1.1, 4.0], [2.3, 4.0]], fx: [{ t: 0.4, kind: 'scrape' }, { t: 0.55, kind: 'scrape' }, { t: 0.7, kind: 'scrape' }, { t: 0.82, kind: 'scrape' }, { t: 0.95, kind: 'sweep' }], keys: [
    { t: 0, hy: -0.24, hp: 18, hw: -30, hr: 0, sp: 18, sw: -24, np: -34, nw: 40, nr: -20, ra: -130, re: -50, rl: 0.95, ba: 178, be: -18, la: 30, le: -30, ll: 0.8, lg: 0, flx: 0.1, flz: 0.5, flp: 0, frx: -0.1, frz: -0.5, frp: 20 },
    { t: 0.55, hy: -0.46, hp: 30, hw: -44, sp: 26, sw: -34, nw: 64, nr: -34, ra: -150, re: -52, flz: -0.4, frz: 0.5 }, { t: 0.84, hy: -0.5, hw: -48, sw: -38, ra: -152, ba: 176, be: -24, flz: 0.5, frz: -0.5 },
    { t: 0.99, hy: -0.24, hp: 4, hw: 14, sp: -4, sw: 18, np: -20, nw: -10, nr: 10, ra: 8, re: 14, rl: 1, ba: 6, be: 22, la: 90, le: -20 },
    { t: 1.12, hy: -0.12, hp: -8, hw: 30, sp: -20, sw: 34, nw: -30, nr: 24, ra: 48, re: 70, ba: 50, be: 108, la: 100 }, { t: 1.55, hw: 32, sw: 36, ra: 54, re: 74, ba: 56, be: 116 }, at(2.3, END) ] });
  // leap: gone upward, then straight down on the mark
  K.leap = clip('leap', { dur: 3.0, hit: [1.28, 1.42], blend: 0.25, fx: [{ t: 0.62, kind: 'launch' }, { t: 1.3, kind: 'slam' }], keys: [
    { t: 0, hy: -0.3, hp: 22, hw: 0, hr: 0, sp: 26, sw: 0, np: -50, nw: 0, nr: -20, ra: -70, re: -50, rl: 0.9, ba: -60, be: -20, la: 70, le: -50, ll: 0.9, lg: 0, flx: 0.14, flz: 0.2, flp: 0, frx: -0.14, frz: -0.2, frp: 0, air: 0 },
    { t: 0.5, hy: -0.86, hp: 40, sp: 40, np: -70, ra: -110, re: -60, la: 110, le: -60, flp: 20, frp: 20 }, { t: 0.58, air: 0 }, { t: 0.62, air: 1 },
    { t: 0.8, hy: 0.0, hp: -10, sp: -20, np: -10, nr: 20, ra: -20, re: 80, rl: 0.95, ba: 0, be: 130, la: 20, le: 70, lg: 0.8, flz: -0.4, flp: 60, frz: 0.3, frp: 50, fly: 0.5, fry: 0.7 },
    { t: 1.16, hp: -14, sp: -26, ra: -16, re: 86, be: 146, lg: 1 }, { t: 1.28, air: 1, hy: -0.4, hp: 24, sp: 30, np: -60, ra: -6, re: -10, be: -16, fly: 0, fry: 0, flz: 0.6, flp: 0, frz: -0.5, frp: 30 }, { t: 1.31, air: 0 },
    { t: 1.42, hy: -0.64, hp: 36, sp: 44, re: -26, be: -30, nr: 0 }, { t: 2.35, hy: -0.6, hp: 33, sp: 42, re: -25, be: -29, nr: 16, np: -60 }, at(3.0, END) ] });

  // --- Crawler
  K.pounce = clip('pounce', { dur: 3.3, hit: [1.14, 1.3], blend: 0.22, fx: [{ t: 0.62, kind: 'launch' }, { t: 1.16, kind: 'thud' }], keys: [
    { t: 0, hy: -0.9, hz: -0.4, hp: 56, hw: 0, hr: 0, sp: 24, sw: 0, np: -86, nw: 0, nr: 0, ra: -20, re: -56, rl: 0.8, ba: 170, be: 2, la: 20, le: -56, ll: 0.8, lg: 0, flx: 0.34, flz: -0.75, flp: 26, frx: -0.34, frz: -0.75, frp: 26, air: 0 },
    { t: 0.5, hy: -1.12, hz: -0.7, hp: 44, sp: 36, np: -92, nr: 30, ra: -34, re: -64, la: 34, le: -64 }, { t: 0.58, air: 0 }, { t: 0.62, air: 1 },
    { t: 0.82, hy: -0.5, hz: 0, hp: 66, sp: 0, np: -80, nr: -20, ra: -14, re: 6, rl: 1, la: 14, le: 6, ll: 1, flz: -1.1, flp: 60, frz: -1.1, frp: 60, fly: 0.3, fry: 0.3 },
    { t: 1.14, air: 1, hy: -0.9, hp: 70, sp: 26, ra: -18, re: -44, la: 18, le: -44, flz: -0.6, frz: -0.6, fly: 0, fry: 0 }, { t: 1.17, air: 0 },
    { t: 1.28, hy: -1.04, hp: 72, sp: 34, np: -60, ra: -16, re: -52, la: 16, le: -52 }, { t: 2.6, hy: -1.02, hp: 70, sp: 32, np: -66, nr: 34, ra: -18, la: 18 }, { t: 2.8, nr: -40 }, { t: 3.3, hy: -0.82, hz: -0.5, hp: 62, sp: 22, np: -88, nr: 0, flp: 26, frp: 26, flz: -0.75, frz: -0.75 } ] });
  K.rake = clip('rake', { dur: 2.75, hit: [0.86, 0.98], blend: 0.2, move: [[0, 0], [0.6, 0.2], [0.95, 1.7], [1.4, 2.9], [2.5, 2.9]], fx: [{ t: 0.92, kind: 'sweep' }, { t: 1.5, kind: 'sweep' }], keys: [
    { t: 0, hy: -0.7, hz: -0.4, hp: 48, hw: -14, hr: 0, sp: 22, sw: -20, np: -80, nw: 20, nr: -10, ra: -80, re: -10, rl: 0.9, ba: 170, be: 2, la: 20, le: -56, ll: 0.85, lg: 0, flx: 0.34, flz: -0.5, flp: 20, frx: -0.34, frz: -0.6, frp: 26 },
    { t: 0.55, hy: -0.62, hp: 34, hw: -34, sp: 10, sw: -36, nw: 50, ra: -124, re: 24, rl: 0.95 }, { t: 0.82, hw: -36, sw: -40, ra: -130, re: 28 },
    { t: 0.94, hy: -0.8, hp: 52, hw: 14, sp: 30, sw: 22, nw: -10, ra: 14, re: -36, rl: 1 }, { t: 1.06, hw: 30, sw: 34, ra: 60, re: -40, la: 120, le: 20, ll: 0.95 }, { t: 1.38, hw: 34, sw: 38, la: 130, le: 28 },
    { t: 1.52, hw: -14, sw: -22, nw: 10, la: -14, le: -36, ll: 1, ra: -60 }, { t: 1.64, hw: -28, sw: -34, la: -56, le: -42 }, { t: 2.0, hw: -26, la: -54 }, { t: 2.75, hy: -0.82, hz: -0.5, hp: 62, hw: 0, sp: 22, sw: 0, np: -88, nw: 0, nr: 0, ra: -14, re: -50, rl: 0.8, la: 14, le: -50, ll: 0.8, flz: -0.75, frz: -0.75 } ] });

  // --- Hanged. Upside down: "up" in these keys is toward the floor.
  const H: Key = { t: 0, hy: 0, hp: -4, hw: 6, sp: -26, sw: 12, sr: 4, np: -44, nw: 10, nr: 16, ra: -24, re: 64, rl: 0.95, ba: 0, be: 90, la: 30, le: 58, ll: 0.95, flx: -0.12, flz: 0.02, frx: 0.12, frz: 0.02 };
  K.hangSwing = clip('hangSwing', { dur: 3.6, hit: [1.2, 1.75], blend: 0.35, fx: [{ t: 0.1, kind: 'creak' }, { t: 1.2, kind: 'sweep' }], keys: [H, { t: 0.9, hp: -20, sp: -40, np: -20, nr: 40, ra: -60, re: 40, la: 60, le: 40 }, { t: 1.1, hp: -22 }, { t: 1.4, hp: 16, sp: 14, np: -60, nr: 0, ra: -12, re: 20, rl: 1, la: 12, le: 20, ll: 1 }, { t: 1.9, hp: 22, sp: 18, ra: -30, la: 30 }, at(3.6, H)] });
  K.hangSwipe = clip('hangSwipe', { dur: 2.4, hit: [1.1, 1.26], blend: 0.3, fx: [{ t: 0.1, kind: 'creak' }, { t: 1.14, kind: 'sweep' }], keys: [H, { t: 0.7, sw: -60, hw: -30, nr: -40, ra: -120, re: 30, rl: 0.9, la: -20, le: 40 }, { t: 1.06, sw: -70, hw: -36 }, { t: 1.2, sw: 50, hw: 26, nr: 20, ra: 10, re: 34, rl: 1, la: 120, le: 34, ll: 1 }, { t: 1.45, sw: 74, hw: 36, ra: 50, la: 140 }, at(2.4, H)] });
  // roots snap: lands in a heap, head at sword height
  K.crash = clip('crash', { dur: 4.4, blend: 0.16, fx: [{ t: 0.3, kind: 'slam0' }], keys: [
    { t: 0, hy: -0.6, hp: 20, hw: 0, hr: 0, sp: 10, sw: -20, np: 20, nw: 0, nr: 40, ra: -60, re: 20, rl: 0.95, ba: 0, be: 0, la: 60, le: 20, ll: 0.95, lg: 0, flx: 0.2, flz: 0.3, flp: 0, frx: -0.2, frz: -0.3, frp: 0, air: 0 },
    { t: 0.3, hy: -1.2, hp: 36, sp: 50, sw: 10, np: 12, nr: -30, ra: -40, re: -66, la: 30, le: -70, flz: 0.3, flp: 40, frz: -0.6, frp: 56 }, { t: 0.5, hy: -1.1, sp: 40 }, { t: 0.7, hy: -1.18, sp: 48 }, { t: 3.3, hy: -1.15, sp: 45, np: 6, nr: 20 }, { t: 3.6, nr: -44, sp: 20, hy: -0.8 }, at(4.4, END) ] });

  // --- round 2. Nothing is wasted: it moves like it has been waiting.
  K.flurry = clip('flurry', { dur: 4.2, hit: [0.8, 0.9], blend: 0.2, move: [[0, 0], [0.7, 0.2], [0.85, 1.1], [1.3, 1.3], [1.45, 2.1], [1.9, 2.3], [2.05, 3.0], [2.7, 3.1], [2.9, 4.2], [4.2, 4.2]], fx: [{ t: 0.84, kind: 'sweep' }, { t: 1.42, kind: 'sweep' }, { t: 2.0, kind: 'sweep' }, { t: 2.84, kind: 'slam' }], keys: [
    { t: 0, hy: -0.3, hp: 20, hw: -20, sp: 20, sw: -20, np: -44, nw: 30, nr: 0, ra: -100, re: 0, rl: 0.9, ba: -120, be: 10, la: 70, le: -30, ll: 0.8, lg: 0, flx: 0.14, flz: 0.4, frx: -0.14, frz: -0.3 },
    { t: 0.68, hw: -44, sw: -44, nw: 70, ra: -130, re: 30 }, { t: 0.86, hw: 24, sw: 30, nw: -20, ra: 30, re: -16, rl: 1, ba: 40, flz: -0.3, frz: 0.5 }, { t: 1.0, hw: 34, sw: 40, ra: 66, la: 110, le: 20 },
    { t: 1.28, hw: 40, sw: 44, la: 130, le: 34, ll: 0.95 }, { t: 1.44, hw: -24, sw: -30, nw: 20, la: -30, le: -14, ll: 1, flz: 0.5, frz: -0.3 }, { t: 1.58, hw: -34, sw: -40, la: -60, ra: -110, re: 20 },
    { t: 1.86, hw: -42, sw: -44, ra: -134, re: 34 }, { t: 2.02, hw: 26, sw: 34, ra: 40, re: -20, la: 60 }, { t: 2.16, hw: 34, sw: 40, ra: 70 },
    { t: 2.5, hy: 0.02, hw: 0, hp: -12, sw: 0, sp: -26, np: 4, nw: 0, nr: 20, ra: -24, re: 84, rl: 0.95, la: 24, le: 84, ll: 0.95 }, { t: 2.7, sp: -30, re: 88, le: 88 }, { t: 2.86, hy: -0.7, hp: 40, sp: 46, np: -66, nr: 0, ra: -14, re: -30, rl: 1, la: 14, le: -30, ll: 1 }, { t: 3.7, hy: -0.66, hp: 36, sp: 42, nr: 14 }, at(4.2, END2) ] });
  K.cross = clip('cross', { dur: 2.1, hit: [0.78, 0.96], blend: 0.18, fx: [{ t: 0.74, kind: 'launch' }, { t: 0.86, kind: 'sweep' }], keys: [
    { t: 0, hy: -0.4, hp: 30, hw: -10, sp: 26, sw: -10, np: -56, nw: 10, nr: 0, ra: -110, re: -10, rl: 0.9, ba: -140, be: 0, la: 110, le: -10, ll: 0.9, lg: 0, flx: 0.14, flz: 0.6, frx: -0.14, frz: -0.6, frp: 30, air: 0 },
    { t: 0.6, hy: -0.7, hp: 44, sp: 36, np: -80, ra: -136, re: 16, la: 136, le: 16 }, { t: 0.72, air: 1 }, { t: 0.86, hy: -0.6, hp: 48, sp: 10, np: -50, ra: 20, re: -20, rl: 1, la: -20, le: -20, ll: 1, flz: -0.6, flp: 50 }, { t: 1.0, ra: 50, la: -50, air: 1 }, { t: 1.03, air: 0 },
    { t: 1.2, hy: -0.62, hp: 34, sp: 24, flz: 0.5, flp: 0, frp: 0 }, at(2.1, END2) ] });
  K.skewer = clip('skewer', { dur: 2.9, hit: [1.12, 1.28], blend: 0.22, move: [[0, 0], [0.9, -0.5], [1.05, -0.4], [1.24, 3.4], [1.4, 3.7], [2.9, 3.7]], fx: [{ t: 1.2, kind: 'sweep' }], keys: [
    { t: 0, hy: -0.36, hp: 14, hw: 0, sp: 10, sw: 0, np: -30, nw: 0, nr: 20, ra: -80, re: 20, rl: 0.7, ba: 0, be: 0, la: 80, le: 20, ll: 0.7, lg: 0, flx: 0.14, flz: 0.4, frx: -0.14, frz: -0.5 },
    { t: 0.8, hy: -0.5, hp: -6, sp: -16, np: -8, nr: 40, ra: -150, re: 20, rl: 0.5, la: 150, le: 20, ll: 0.5 }, { t: 1.08, hy: -0.54, sp: -20 },
    { t: 1.22, hy: -0.66, hp: 44, sp: 40, np: -80, nr: 0, ra: -4, re: 2, rl: 1, la: 4, le: 2, ll: 1, flz: -0.6, flp: 40, frz: 0.7 }, { t: 1.4, hy: -0.7, sp: 44 }, { t: 2.2, hy: -0.68, sp: 42, nr: -16 }, at(2.9, END2) ] });
  K.rupture = clip('rupture', { dur: 3.1, hit: [1.25, 1.4], blend: 0.22, fx: [{ t: 1.16, kind: 'slam' }], keys: [
    { t: 0, hy: -0.3, hp: 10, hw: 0, sp: 10, sw: 0, np: -30, nw: 0, nr: 0, ra: -60, re: 30, rl: 0.9, ba: 0, be: 60, la: 60, le: 30, ll: 0.9, lg: 0, flx: 0.18, flz: 0.3, frx: -0.18, frz: -0.3 },
    { t: 0.7, hy: 0.06, hp: -16, sp: -30, np: 10, ra: -24, re: 88, rl: 0.98, la: 24, le: 88, ll: 0.98, nr: 30 }, { t: 1.04, sp: -34 }, { t: 1.17, hy: -0.9, hp: 50, sp: 50, np: -80, nr: 0, ra: -20, re: -40, la: 20, le: -40 }, { t: 2.3, hy: -0.86, hp: 46, sp: 46 }, at(3.1, END2) ] });
  K.rain = clip('rain', { dur: 4.2, hit: [0.8, 0.9], blend: 0.3, fx: [{ t: 0.4, kind: 'roar' }], keys: [
    { t: 0, hy: -0.2, hp: 4, hw: 0, sp: 0, sw: 0, np: -20, nw: 0, nr: 0, ra: -80, re: 10, rl: 0.9, ba: 0, be: 60, la: 80, le: 10, ll: 0.9, lg: 0, flx: 0.18, flz: 0.2, frx: -0.18, frz: -0.2 },
    { t: 0.5, hy: 0.02, hp: -12, sp: -34, np: 34, ra: -70, re: 64, la: 70, le: 64 }, { t: 1.2, nr: 24, sp: -38 }, { t: 2.2, nr: -24 }, { t: 3.2, sp: -32, np: 30, nr: 10 }, at(4.2, END2) ] });
  K.wheel = clip('wheel', { dur: 3.2, hit: [1.22, 1.36], blend: 0.22, fx: [{ t: 0.6, kind: 'launch' }, { t: 1.22, kind: 'slam' }], keys: [
    { t: 0, hy: -0.5, hp: 30, hw: 0, sp: 30, sw: 0, np: -60, nw: 0, nr: 0, ra: -100, re: -30, rl: 0.9, ba: -100, be: 0, la: 100, le: -30, ll: 0.9, lg: 0, flx: 0.16, flz: 0.2, frx: -0.16, frz: -0.2, air: 0, tw: 0 },
    { t: 0.5, hy: -0.9, hp: 40, sp: 40, ra: -130, la: 130 }, { t: 0.6, air: 1, tw: 0 }, { t: 0.8, hy: 0, hp: 10, sp: 0, ra: -86, re: 0, rl: 1, la: 86, le: 0, ll: 1, fly: 0.5, fry: 0.5, tw: 200 }, { t: 1.14, tw: 660, ra: -70, la: 70 },
    { t: 1.22, air: 1, tw: 720, hy: -0.8, hp: 42, sp: 44, np: -70, ra: -20, re: -36, la: 20, le: -36, fly: 0, fry: 0 }, { t: 1.25, air: 0 }, { t: 2.4, hy: -0.78, hp: 40, sp: 42, tw: 720 }, at(3.2, { ...END2, tw: 720 }) ] });
  K.hop = clip('hop', { dur: 0.75, blend: 0.14, move: [[0, 0], [0.1, -0.2], [0.4, -3.6], [0.75, -3.8]], fx: [{ t: 0.08, kind: 'launch' }], keys: [
    { t: 0, hy: -0.5, hp: 30, sp: 20, np: -50, ra: -80, re: -20, rl: 0.8, la: 80, le: -20, ll: 0.8, flx: 0.14, flz: 0.4, frx: -0.14, frz: -0.3, air: 0, lg: 0, hw: 0, sw: 0, nw: 0, nr: 0 }, { t: 0.1, air: 1 }, { t: 0.24, hy: -0.1, hp: 8, fly: 0.3, fry: 0.3 }, { t: 0.4, air: 1, hy: -0.6, fly: 0, fry: 0 }, { t: 0.43, air: 0 }, at(0.75, END2) ] });
  K.reel2 = clip('reel2', { dur: 1.3, blend: 0.07, move: [[0, 0], [0.14, -0.5], [0.4, -1.0], [1.3, -1.0]], keys: [
    { t: 0, hy: -0.3, hp: -8, hw: -18, sp: -24, sw: -26, np: 26, nw: 20, nr: 40, ra: -100, re: 10, rl: 0.95, ba: -60, be: -20, la: 100, le: 20, ll: 0.95, lg: 0, flx: 0.14, flz: 0.3, frx: -0.14, frz: -0.4, flp: 0, frp: 0 }, { t: 0.2, sp: -32, nr: 56, hy: -0.46 }, { t: 0.55, hy: -0.5, hp: 26, hw: 8, sp: 36, sw: 10, np: -30, nw: 0, nr: -20, ra: -50, re: -50, la: 50, le: -50 }, at(1.3, END2) ] });
  // reveal: lands in a heap, then every arm opens
  K.rise2 = clip('rise2', { dur: 5.0, blend: 0.1, fx: [{ t: 0.15, kind: 'slam' }, { t: 3.0, kind: 'roar' }], keys: [
    { t: 0, hy: -1.2, hp: 50, hw: 0, hr: 0, sp: 60, sw: 0, sr: 0, np: 30, nw: 0, nr: 0, ra: -30, re: -60, rl: 0.7, ba: 0, be: -30, la: 30, le: -60, ll: 0.7, lg: 0, flx: 0.2, flz: 0.2, flp: 40, frx: -0.2, frz: -0.5, frp: 56, air: 0, tw: 0 },
    { t: 1.4, hy: -1.22, sp: 62 }, { t: 2.0, hy: -1.0, sp: 40, np: -20, nr: 30, ra: -60, re: -40, la: 60, le: -40 }, { t: 2.4, hy: -0.96, nr: -30 }, { t: 2.9, hy: -0.2, hp: 4, sp: -10, np: 0, nr: 0, ra: -90, re: 10, rl: 0.9, la: 90, le: 10, ll: 0.9, flp: 0, frp: 0 },
    { t: 3.2, hy: 0.0, hp: -10, sp: -34, np: 30, ra: -84, re: 40, rl: 1, la: 84, le: 40, ll: 1 }, { t: 4.2, sp: -36, np: 34, nr: 12 }, at(5.0, END2) ] });
  K.die2 = clip('die2', { dur: 5.5, blend: 0.16, fx: [{ t: 1.4, kind: 'thud' }], keys: [
    { t: 0, hy: -0.3, hp: -10, hw: 0, sp: -30, sw: 0, np: 34, nw: 0, nr: 30, ra: -100, re: 30, rl: 0.95, ba: 0, be: 0, la: 100, le: 30, ll: 0.95, lg: 0, flx: 0.16, flz: 0.3, frx: -0.16, frz: -0.4, flp: 0, frp: 0 },
    { t: 0.9, sp: -40, nr: 50, ra: -110, la: 110 }, { t: 1.4, hy: -1.1, hp: 10, sp: 6, np: 10, ra: -50, re: -60, la: 50, le: -60, flp: 50, frp: 56, flz: 0.1, frz: -0.5 }, { t: 2.2, hy: -1.16, sp: -20, np: 40, nr: 0, ra: -80, re: -10, la: 80, le: -10 }, { t: 5.5, hy: -1.18, sp: -24, np: 46 } ] });
}

/** Ground danger. Circles and lines go off after `delay`; a ring rolls outward from the boss. */
export interface Zone { shape: 'circle' | 'line' | 'ring' | 'sweep'; at: 'mark' | 'self' | 'player'; r?: number; len?: number; half?: number; yaw?: number; delay: number; speed?: number; max?: number; /** A circle with a safe middle this wide; a sweep that misses inside this radius. */ inner?: number; /** A sweep turns this far (radians) over `dur` seconds after its delay. */ spin?: number; dur?: number }
/** white: dodge or guard. red: dodge only. ground: leave the glowing area, or dodge as it goes off. */
export interface Strike {
  kind: 'white' | 'red' | 'ground'; t: [number, number]; cue: number; dmg: number; down?: boolean; mark: 'cleaver' | 'handL' | 'head';
  /** A box ahead (length, half width), a sector (radius, half arc in degrees), or a disc around the hanging head, metres. */
  box?: [number, number]; arc?: [number, number]; head?: number; /** Comes in at leg height: a jump clears it. */ low?: boolean;
  /** Ground marks drawn from the cue. With no box/arc/head of its own, the zone does the damage. */ zones?: Zone[];
  /** Hit only outside this radius (a sweep with a safe place at the boss's feet). */ inner?: number; /** The zone is only drawn: the boss resolves it itself. */ silent?: boolean;
  /** When it connects, the boss seizes the hero into a staged moment instead of the plain blow (Boss.seize). */ seize?: string;
}
/** Attacks that fly to a marked spot: launch, landing, height. `past` overshoots through the target. */
export const LEAPS: Record<string, { t0: number; t1: number; h: number; max: number; past?: number }> = {
  leap: { t0: 0.62, t1: 1.3, h: 3.4, max: 11 }, pounce: { t0: 0.62, t1: 1.16, h: 1.5, max: 9 }, wheel: { t0: 0.6, t1: 1.22, h: 2.8, max: 10 }, cross: { t0: 0.72, t1: 1.0, h: 0.15, max: 9, past: 3.2 },
};
const circle = (r: number, delay: number, at: Zone['at'] = 'mark'): Zone => ({ shape: 'circle', at, r, delay });
export const ATTACKS: Record<string, Strike[]> = {
  slam: [{ kind: 'white', cue: 0.7, t: [1.38, 1.52], dmg: 12, mark: 'cleaver', box: [4.2, 0.75] }],
  sweep: [{ kind: 'white', cue: 0.3, t: [0.94, 1.1], dmg: 10, mark: 'cleaver', arc: [4.2, 105], low: true }, { kind: 'white', cue: 1.26, t: [1.88, 2.02], dmg: 10, mark: 'cleaver', arc: [4.2, 105], low: true }],
  drag: [{ kind: 'white', cue: 0.3, t: [0.92, 1.06], dmg: 11, mark: 'cleaver', arc: [3.8, 70] }],
  grab: [{ kind: 'red', cue: 0.56, t: [1.38, 1.52], dmg: 17, down: true, mark: 'handL', box: [3.0, 0.7], seize: 'noose' }],
  leap: [{ kind: 'ground', cue: 0.4, t: [1.28, 1.4], dmg: 12, down: true, mark: 'cleaver', zones: [circle(2.5, 0.9)] }],
  pounce: [{ kind: 'ground', cue: 0.4, t: [1.14, 1.26], dmg: 13, down: true, mark: 'handL', zones: [circle(2.1, 0.76)] }],
  rake: [{ kind: 'white', cue: 0.24, t: [0.86, 0.98], dmg: 9, mark: 'cleaver', arc: [3.5, 80], low: true }, { kind: 'white', cue: 0.9, t: [1.46, 1.58], dmg: 9, mark: 'handL', arc: [3.5, 80], low: true }],
  hangSwing: [{ kind: 'ground', cue: 0.3, t: [1.2, 1.8], dmg: 14, down: true, mark: 'head', head: 1.0, zones: [{ shape: 'line', at: 'self', len: 5.4, half: 0.95, delay: 1.5 }] }],
  hangSwipe: [{ kind: 'white', cue: 0.46, t: [1.1, 1.26], dmg: 10, mark: 'head', head: 2.3 }],
  // --- round 2
  flurry: [{ kind: 'white', cue: 0.2, t: [0.8, 0.9], dmg: 7, mark: 'cleaver', arc: [3.6, 90] }, { kind: 'white', cue: 0.82, t: [1.38, 1.48], dmg: 7, mark: 'handL', arc: [3.6, 90] }, { kind: 'white', cue: 1.4, t: [1.96, 2.06], dmg: 7, mark: 'cleaver', arc: [3.6, 90] }, { kind: 'white', cue: 2.2, t: [2.82, 2.94], dmg: 13, mark: 'head', box: [4.0, 1.0] }],
  cross: [{ kind: 'white', cue: 0.16, t: [0.78, 0.98], dmg: 12, mark: 'cleaver', arc: [2.3, 140], low: true }],
  skewer: [{ kind: 'red', cue: 0.4, t: [1.14, 1.3], dmg: 18, down: true, mark: 'head', box: [4.0, 0.65] }],
  rupture: [{ kind: 'ground', cue: 0.4, t: [1.24, 1.36], dmg: 14, down: true, mark: 'head', zones: [-0.5, 0, 0.5].map(yaw => ({ shape: 'line' as const, at: 'self' as const, len: 13, half: 0.85, yaw, delay: 0.85 })) }],
  rain: [0.8, 1.3, 1.8, 2.3, 2.8].map(t => ({ kind: 'ground' as const, cue: t, t: [t + 0.9, t + 1.0] as [number, number], dmg: 7, mark: 'head' as const, zones: [circle(1.8, 0.9, 'player')] })),
  wheel: [{ kind: 'ground', cue: 0.36, t: [1.22, 1.34], dmg: 13, down: true, mark: 'head', zones: [circle(2.4, 0.88)] }, { kind: 'ground', cue: 1.23, t: [1.3, 1.4], dmg: 8, mark: 'head', zones: [{ shape: 'ring', at: 'self', delay: 0.55, speed: 8.5, max: 12 }] }],
};
