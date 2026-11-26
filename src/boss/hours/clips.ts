// The Sister of Hours: poses and moves on the human frame, scaled to her height. The scythe is held like a glaive: right hand low on the haft, left hand well up it.
// Timing and travel here are what the simulation reads; the poses are what you see. The Pall (form 2) has no limbs: its clips carry only timing and travel.
import { clip, makePose, type Clip, type Key } from '../../anim/pose.ts';

/** Upright and still, the scythe held across the body, its blade high and forward. */
export const SSTAND = makePose({ hy: -0.06, hp: 4, hw: -14, sp: 3, sw: 10, np: -6, nw: 8, ra: -22, re: -74, rl: 0.62, ba: 12, be: 80, lg: 1, xl: 8, flx: 0.15, flz: 0.17, flw: 8, frx: -0.15, frz: -0.15, frw: -16 });
const B: Key = { t: 0, hx: 0, hy: -0.06, hz: 0, hp: 4, hw: -14, hr: 0, sp: 3, sw: 10, sr: 0, np: -6, nw: 8, nr: 0, ra: -22, re: -74, rl: 0.62, ba: 12, be: 80, bo: 0, xr: 0, la: 30, le: -30, ll: 0.85, lg: 1, xl: 8, tw: 0, air: 0, flx: 0.15, fly: 0, flz: 0.17, flw: 8, flp: 0, frx: -0.15, fry: 0, frz: -0.15, frw: -16, frp: 0 };
const at = (t: number, k: Partial<Key> = {}): Key => ({ ...B, ...k, t });
const C: Record<string, Clip> = {};

// --- the Scythe
/** The Reaping Hour: wound far round behind her, the blade goes through low enough to jump; then back the other way at the waist. */
C.reap = clip('reap', { dur: 3.2, blend: 0.22, move: [[0, 0], [0.9, 0.3], [1.15, 1.3], [1.8, 1.5], [2.0, 2.3], [3.2, 2.3]], fx: [{ t: 1.05, kind: 'sweep' }, { t: 1.9, kind: 'sweep' }], keys: [at(0),
  { t: 0.7, hy: -0.34, hp: 20, hw: -56, sp: 18, sw: -52, nw: 46, ra: -114, re: -40, rl: 0.95, ba: -132, be: -14, flz: 0.44, frz: -0.44 }, { t: 0.95, hw: -60, sw: -56, ra: -120, ba: -138 },
  { t: 1.08, hy: -0.42, hw: 6, sw: 10, nw: -6, ra: -10, ba: 0, be: -16 }, { t: 1.24, hw: 58, sw: 62, nw: -44, ra: 60, re: -40, ba: 120, be: -12 }, { t: 1.6, hy: -0.3, hw: 54, sw: 58, ra: 56, ba: 116, be: 4 },
  { t: 1.86, hy: -0.24, hw: 0, sw: 0, nw: 0, ra: -10, re: -36, ba: 0, be: 6 }, { t: 2.04, hw: -58, sw: -58, nw: 42, ra: -112, ba: -128, be: 6 }, { t: 2.7, hw: -40, sw: -40, ra: -90, ba: -100 }, at(3.2)] });
/** The Hour Behind You: the scythe raised, she goes into the smoke and comes out at your back, already bringing it down. */
C.harvest = clip('harvest', { dur: 2.8, blend: 0.2, fx: [{ t: 0.35, kind: 'vanish' }, { t: 1.2, kind: 'emerge' }, { t: 1.66, kind: 'slam' }], keys: [at(0),
  { t: 0.35, hy: -0.06, hp: -6, sp: -10, np: 10, ra: -20, re: 64, rl: 0.95, ba: 0, be: 112 }, { t: 1.2, hy: -0.04, hp: -8, sp: -12, np: 12, ra: -16, re: 74, ba: 0, be: 124 },
  { t: 1.46, hy: 0.0, hp: -10, sp: -16, np: 14, ra: -12, re: 82, ba: 0, be: 134 }, { t: 1.64, hy: -0.44, hp: 32, sp: 38, np: -30, ra: -8, re: -24, rl: 1, ba: 0, be: -54, flz: 0.5, frz: -0.42 },
  { t: 2.3, hy: -0.42, hp: 30, sp: 34, re: -24, be: -52 }, at(2.8)] });
/** The Turning of the Hours: arms out and the blade level, she comes at you turning, three times round. */
C.hourWheel = clip('hourWheel', { dur: 3.6, blend: 0.25, move: [[0, 0], [0.8, 0.2], [2.7, 5.6], [3.6, 5.8]], fx: [{ t: 1.2, kind: 'sweep' }, { t: 1.8, kind: 'sweep' }, { t: 2.4, kind: 'sweep' }], keys: [at(0),
  { t: 0.6, hy: -0.3, hp: 14, hw: -26, sp: 16, sw: -30, nw: 30, ra: -92, re: -8, rl: 0.95, ba: -92, be: 0, lg: 0, la: 70, le: -10, ll: 0.9, flz: 0.36, frz: -0.36 }, { t: 0.9, tw: -24 },
  { t: 1.5, tw: 260, hw: 0, sw: 0, nw: 0 }, { t: 2.1, tw: 620 }, { t: 2.7, tw: 1080, hw: -10, sw: -10 }, { ...B, t: 3.2, tw: 1080 }, at(3.6, { tw: 1080 })] });
/** Into the smoke and out of it nearer you: how she crosses a room. */
C.blink = clip('blink', { dur: 1.2, blend: 0.2, keys: [at(0), { t: 0.25, hy: -0.12, hp: 16, sp: 20, np: -20, ra: -40, re: -50, ba: -20, be: 40 }, { t: 0.75, hy: -0.12, hp: 16, sp: 20 }, { t: 0.95, hy: -0.08, hp: 8, sp: 8 }, at(1.2)] });

// --- the Linen
/** The scythe planted; the sleeves flung forward and the strips laid out in a fan. */
C.binding = clip('binding', { dur: 2.4, blend: 0.22, fx: [{ t: 0.95, kind: 'cloth' }], keys: [at(0),
  { t: 0.5, hy: -0.1, hp: -4, sp: -10, np: 8, ra: -40, re: 20, rl: 0.7, ba: 0, be: 88, lg: 0, la: 60, le: 30, ll: 0.6, xl: 30 },
  { t: 0.95, hy: -0.22, hp: 18, sp: 20, np: -14, la: 8, le: -4, ll: 1, xl: 0 }, { t: 2.0, hp: 16, sp: 18, la: 10, le: -6, ll: 1, lg: 0 }, at(2.4)] });
/** A ward sheet the size of a room, thrown high over you. */
C.cleanSheet = clip('cleanSheet', { dur: 2.6, blend: 0.22, fx: [{ t: 0.85, kind: 'cloth' }], keys: [at(0),
  { t: 0.4, hy: -0.2, hp: 14, sp: 14, ra: -30, re: -50, ba: 0, be: 86, lg: 0, la: 30, le: -60, ll: 0.8 },
  { t: 0.85, hy: 0.02, hp: -10, sp: -18, np: 20, la: 10, le: 74, ll: 1, ra: -20, re: 30 }, { t: 1.4, hp: -4, sp: -6, la: 20, le: 40 }, at(2.6)] });
/** Both arms out, slow and almost kind: to lay you down. */
C.lieDown = clip('lieDown', { dur: 2.6, blend: 0.3, move: [[0, 0], [1.25, 1.0], [2.6, 1.0]], fx: [{ t: 1.3, kind: 'cloth' }], keys: [at(0),
  { t: 0.6, hy: -0.1, hp: 8, sp: 10, np: -10, ra: -40, re: -20, rl: 0.6, ba: -160, be: -60, lg: 0, la: 30, le: -10, ll: 0.6 },
  { t: 1.3, hy: -0.3, hp: 34, sp: 30, np: -30, ra: -14, re: -14, rl: 1, la: 14, le: -14, ll: 1, flz: 0.5, frz: -0.4 }, { t: 2.2, hy: -0.32, hp: 36, sp: 32 }, at(2.6)] });
/** Into the smoke and gone; out of a cot near you, blade first. */
C.betweenBeds = clip('betweenBeds', { dur: 2.8, blend: 0.2, fx: [{ t: 0.3, kind: 'vanish' }, { t: 1.4, kind: 'emerge' }, { t: 1.75, kind: 'sweep' }], keys: [at(0),
  { t: 0.35, hy: -0.5, hp: 30, sp: 30, np: -30 }, { t: 1.4, hy: -0.2, hp: 10, hw: -40, sw: -40, nw: 30, ra: -110, re: 0, rl: 0.95, ba: -120, be: 6 }, { t: 1.78, hw: 40, sw: 46, nw: -30, ra: 60, ba: 110, be: 0 }, { t: 2.4, hw: 36, sw: 40 }, at(2.8)] });

// --- the Count
/** The scythe planted, the cord in her fingers; one ember goes out with each breath. */
C.sevenBreaths = clip('sevenBreaths', { dur: 6.8, blend: 0.3, fx: [{ t: 0.4, kind: 'plant' }, { t: 6.0, kind: 'hour' }], keys: [at(0),
  { t: 0.5, hy: -0.04, hp: 0, hw: 0, sp: 0, sw: 0, np: -18, nw: 0, ra: -24, re: 10, rl: 0.75, ba: 6, be: 88, lg: 0, la: 12, le: 10, ll: 0.38, xl: 20 },
  ...[1, 2, 3, 4, 5, 6].map(i => ({ t: 0.6 + i * 0.77, np: -18 + (i % 2) * 6, sp: (i % 2) * 3 })), { t: 5.9, np: 10, sp: -10, la: 50, le: 40, ll: 0.9 }, { t: 6.2, np: -24, sp: 14, la: 40, le: -20 }, at(6.8)] });
/** Three blows while she counts and she loses it: the embers scatter, she reels. */
C.lostCount = clip('lostCount', { dur: 2.6, blend: 0.12, keys: [at(0, { hy: -0.1, hp: -14, sp: -20, np: 24, la: 30, le: 50, ll: 0.5, lg: 0, ra: -40, re: -50, be: 20 }), { t: 0.5, hy: -0.4, hp: 30, sp: 36, np: -40, la: 10, le: 30, ll: 0.4 }, { t: 2.2, hy: -0.38, hp: 28, sp: 34 }, at(2.6)] });
/** Her linen caught: a flinch, the arms beating at it. */
C.burnt = clip('burnt', { dur: 2.0, blend: 0.1, keys: [at(0, { hy: -0.12, hp: -10, sp: -14, np: 20, lg: 0, la: 40, le: 20, ll: 0.6, ra: -60, re: 10, rl: 0.6 }), { t: 0.6, hp: 20, sp: 24, la: -10, le: -30, ra: -10, re: -30 }, { t: 1.2, hp: 4, sp: 6, la: 40, le: 10 }, at(2.0)] });
C.reel = clip('reel', { dur: 1.4, blend: 0.1, keys: [at(0, { hy: -0.1, hp: -18, sp: -22, np: 26 }), { t: 0.5, hy: -0.24, hp: 20, sp: 24, np: -24 }, at(1.4)] });
C.kneel = clip('kneel', { dur: 3.0, blend: 0.3, keys: [at(0), { t: 0.6, hy: -0.7, hp: 30, sp: 30, np: -30, ra: -20, re: -10, be: 80, flz: 0.4, frz: -0.6, frp: 60 }, { t: 2.6, hy: -0.7, hp: 30 }, at(3.0)] });
C.fall = clip('fall', { dur: 6.0, blend: 0.3, keys: [at(0), { t: 0.6, hy: -0.7, hp: 30, sp: 30, np: -30, be: 80, frp: 60, frz: -0.6 }, { t: 5.6, hy: -0.7, hp: 34, sp: 36, np: -40 }, at(6.0, { hy: -0.7, hp: 34, sp: 36 })] });

/** Kneeling, the cord across her lap, head bowed: how she sits with the dying, and how she is found at the end. */
C.sit = clip('sit', { dur: 4.0, blend: 0.4, keys: [at(0, { hy: -0.72, hp: 4, hw: 0, sp: 12, sw: 0, np: -22, nw: 0, ra: -8, re: -62, rl: 0.42, xr: 20, ba: 20, be: -70, lg: 0, la: 8, le: -62, ll: 0.42, xl: 20, flz: 0.05, frz: -0.35, frp: 70, flp: 0 }), { t: 2, sp: 14, np: -26 }, at(4.0, { hy: -0.72, hp: 4, hw: 0, sp: 12, sw: 0, np: -22, nw: 0, ra: -8, re: -62, rl: 0.42, xr: 20, ba: 20, be: -70, lg: 0, la: 8, le: -62, ll: 0.42, xl: 20, flz: 0.05, frz: -0.35, frp: 70, flp: 0 })] });

// --- the Pall: her own frame grown huge, hanging on her smoke; her hands are empty (the scythe is on her back), the six linen arms are drawn by the view
/** Upright and still, the long arms hanging a little out from the robe, the head bowed toward you. */
export const PSTAND = makePose({ hy: -0.02, hp: 2, hw: 0, sp: 4, sw: 0, np: -12, nw: 0, ra: -16, re: -66, rl: 0.88, ba: 0, be: -80, lg: 0, la: 16, le: -66, ll: 0.88, xl: 0, flx: 0.1, flz: 0.04, frx: -0.1, frz: -0.04 });
const P: Key = { ...B, hy: -0.02, hp: 2, hw: 0, sp: 4, sw: 0, np: -12, nw: 0, ra: -16, re: -66, rl: 0.88, ba: 0, be: -80, lg: 0, la: 16, le: -66, ll: 0.88, xl: 0, flx: 0.1, flz: 0.04, frx: -0.1, frz: -0.04 };
const pa = (t: number, k: Partial<Key> = {}): Key => ({ ...P, ...k, t });
const pall = (n: string, dur: number, keys: Key[], fx: Clip['fx'] = []) => { C[n] = clip(n, { dur, blend: 0.3, fx, keys: [pa(0), ...keys, pa(dur)] }); };
/** The Hour Hand: both arms out level, the shadow of the scythe goes round with her. */
pall('hourHand', 4.4, [pa(0.5, { ra: -86, re: 6, rl: 1, la: 86, le: 6, ll: 1, np: 0, sp: -4 }), pa(3.6, { ra: -86, re: 6, rl: 1, la: 86, le: 6, ll: 1, np: 0, sp: -4 })]);
/** She rises, arms wide, and comes down on you with everything she has. */
pall('drawSheet', 4.1, [pa(0.6, { ra: -70, re: 56, la: 70, le: 56, rl: 1, ll: 1, hp: -10, sp: -12, np: 16 }), pa(1.6, { ra: -80, re: 20, la: 80, le: 20, rl: 1, ll: 1, hp: 20, sp: 16, np: -20 }),
  pa(1.75, { hy: -0.42, hp: 34, sp: 34, np: -30, ra: -40, re: -50, la: 40, le: -50, rl: 1, ll: 1 }), pa(3.4, { hy: -0.4, hp: 32, sp: 32, np: -26, ra: -40, re: -50, la: 40, le: -50, rl: 1, ll: 1 })]);
/** Many Hands: the arms go up behind her, then she throws them down at the floor in a fan. */
pall('wardStands', 2.4, [pa(0.4, { ra: -40, re: 74, la: 40, le: 74, rl: 1, ll: 1, hp: -8, sp: -10, np: 14 }), pa(1.1, { ra: -50, re: 80, la: 50, le: 80, hp: -12, sp: -14 }), pa(1.3, { ra: -24, re: -36, la: 24, le: -36, rl: 1, ll: 1, hp: 22, sp: 24, np: -24 }), pa(1.9, { ra: -24, re: -40, la: 24, le: -40, hp: 20, sp: 22 })]);
/** Noon: she reaches back over her shoulder for the scythe and drives it into the floor. */
pall('noon', 2.4, [pa(0.6, { ra: -30, re: 88, rl: 1, sp: -10, np: 10, hw: -20, sw: -20 }), pa(1.2, { ra: -30, re: 92, rl: 1, sp: -14, hw: -24, sw: -26 }), pa(1.5, { ra: -6, re: -30, rl: 1, hp: 24, sp: 26, np: -26, hw: 10, sw: 14 }), pa(2.0, { ra: -6, re: -34, hp: 20, sp: 22 })]);
/** The Last Breath: she draws the smoke in, head back, then lets it out at you in gusts. */
pall('lastBreath', 3.0, [pa(0.45, { hp: -10, sp: -16, np: 24, ra: -60, re: 20, la: 60, le: 20, rl: 1, ll: 1 }), pa(1.0, { hp: 14, sp: 18, np: -6, ra: -50, re: -20, la: 50, le: -20 }), pa(2.3, { hp: 16, sp: 20, np: -4, ra: -50, re: -20, la: 50, le: -20 })]);
/** At her hem too long: the arms wrapped in close, then flung out all round. */
pall('hemLash', 2.0, [pa(0.6, { ra: 40, re: -20, la: -40, le: -20, rl: 0.6, ll: 0.6, hp: 12, sp: 16, np: -20 }), pa(1.02, { ra: -100, re: 10, la: 100, le: 10, rl: 1, ll: 1, hp: -6, sp: -8, np: 0 }), pa(1.4, { ra: -96, re: 0, la: 96, le: 0 })]);
/** The Long Count: her hands together at her breast, her head bowed over them; at the end, thrown open. */
pall('longCount', 6.8, [pa(0.6, { ra: 18, re: -8, rl: 0.5, la: -18, le: -8, ll: 0.5, np: -30, sp: 10 }), pa(5.9, { ra: 18, re: -8, rl: 0.5, la: -18, le: -8, ll: 0.5, np: -34, sp: 12 }), pa(6.2, { ra: -80, re: 30, la: 80, le: 30, rl: 1, ll: 1, np: 20, sp: -12 })]);
/** The Gathering: one arm drawn back like a whip and sent out straight at you. */
pall('gather', 2.6, [pa(0.5, { ra: -110, re: 30, rl: 1, hw: -30, sw: -34, hp: -4 }), pa(0.95, { ra: 0, re: 0, rl: 1, hw: 18, sw: 22, hp: 16, sp: 16, np: -16 }), pa(1.8, { ra: -10, re: -30, rl: 0.8, hw: 8, sw: 10 })]);
/** She has you: lifted in the linen, close to her face. */
pall('grip', 3.6, [pa(0.4, { ra: -20, re: 30, rl: 0.9, la: 20, le: 30, ll: 0.9, np: -24, sp: 14, hp: 8 }), pa(3.2, { ra: -20, re: 34, rl: 0.9, la: 20, le: 34, ll: 0.9, np: -28, sp: 16, hp: 10 })]);
pall('sag', 3.0, [pa(0.4, { hy: -0.5, hp: 30, sp: 34, np: -40, ra: -30, re: -70, la: 30, le: -70 }), pa(2.5, { hy: -0.5, hp: 30, sp: 34, np: -40, ra: -30, re: -70, la: 30, le: -70 })]);
pall('reel2', 1.4, [pa(0.3, { hp: -16, sp: -20, np: 24, ra: -60, re: 10, la: 60, le: 10 })]);
pall('rise', 3.0, [pa(0, { hy: -0.7, hp: 40, sp: 40, np: -50, ra: -20, re: -80, la: 20, le: -80 }), pa(1.6, { hy: -0.3, hp: 10, sp: 6, np: 10, ra: -70, re: 40, la: 70, le: 40, rl: 1, ll: 1 })]);
C.die = clip('die', { dur: 6.0, blend: 0.3, keys: [pa(0), pa(0.8, { hy: -0.5, hp: 30, sp: 30, np: -40, ra: -30, re: -70, la: 30, le: -70 }), pa(6.0, { hy: -0.7, hp: 40, sp: 40, np: -50, ra: -30, re: -80, la: 30, le: -80 })] });

export const HOURS_CLIPS = C;
