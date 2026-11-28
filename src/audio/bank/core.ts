// Every sound in the game, synthesised sample by sample. Pure functions: runs in a worker, and in Node for tools/sfx.mjs.
export const SR = 44100;
type F = Float32Array;
let seed = 1; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, rr = (a: number, b: number) => a + (b - a) * R(), TAU = Math.PI * 2;
const buf = (s: number): F => new Float32Array(Math.ceil(s * SR));
const ex = (t: number, d: number) => Math.exp(-t / d);

/** State-variable filter over a buffer; frequency may move. */
function svf(x: F, f: number | ((t: number) => number), q: number, mode: 'lp' | 'bp' | 'hp'): F {
  const o = new Float32Array(x.length); let lo = 0, bd = 0; const k = 1 / q, mv = typeof f === 'function'; let g = Math.tan(Math.PI * Math.min(0.45, (mv ? 100 : f as number) / SR));
  for (let i = 0; i < x.length; i++) { if (mv && (i & 15) === 0) g = Math.tan(Math.PI * Math.min(0.45, Math.max(10, (f as (t: number) => number)(i / SR)) / SR)); const a1 = 1 / (1 + g * (g + k)), v3 = x[i] - lo, v1 = a1 * bd + g * a1 * v3, v2 = lo + g * v1; bd = 2 * v1 - bd; lo = 2 * v2 - lo; o[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 * k : x[i] - k * v1 - v2; }
  return o;
}
const noise = (s: number): F => { const o = buf(s); for (let i = 0; i < o.length; i++) o[i] = R() * 2 - 1; return o; };
const brown = (s: number): F => { const o = buf(s); let l = 0; for (let i = 0; i < o.length; i++) { l = (l + (R() * 2 - 1) * 0.06) * 0.994; o[i] = l * 2.2; } return o; };
const shape = (x: F, e: (t: number) => number): F => { for (let i = 0; i < x.length; i++) x[i] *= e(i / SR); return x; };
const add = (o: F, x: F, g = 1, at = 0): F => { const k = Math.round(at * SR); for (let i = 0; i < x.length && i + k < o.length; i++) o[i + k] += x[i] * g; return o; };
const peakOf = (x: F) => { let m = 1e-6; for (const v of x) m = Math.max(m, Math.abs(v)); return m; };
/** Saturate relative to the sound's own level: warmth, not a square wave. Attacks must survive it. Output peaks near 1. */
const sat = (x: F, d: number): F => { const k = d / peakOf(x), n = 1 / Math.tanh(d); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k) * n; return x; };
const norm = (x: F): F => { const k = 1 / peakOf(x); for (let i = 0; i < x.length; i++) x[i] *= k; return x; };
/** Squeeze the body and leave the first milliseconds alone: what makes a hit read as a hit. */
function punch(x: F, keep: number): F { let e = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; e = Math.max(Math.abs(x[i]), e * 0.9992); x[i] *= t < keep ? 1 : 1 / (1 + 0.5 * e * Math.min(1, (t - keep) / 0.02)); } return x; }
const hit = (a: number, d: number) => (t: number) => (t < a ? t / a : 1) * ex(Math.max(0, t - a), d);
/** Peak-normalise, with a short fade so nothing clicks. */
function fin(x: F, peak: number): F { let m = 1e-6; for (const v of x) m = Math.max(m, Math.abs(v)); const n = x.length, fo = Math.min(n, Math.round(0.02 * SR)); for (let i = 0; i < n; i++) x[i] *= peak / m * Math.min(1, (n - i) / fo) * Math.min(1, i / 40); return x; }
/** Low thump: pitch falls as it decays, saturated so small speakers hear its harmonics. */
function thump(s: number, f0: number, f1: number, d: number, drive: number): F { const o = buf(s); let p = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; p += TAU * (f1 + (f0 - f1) * ex(t, d * 0.35)) / SR; o[i] = Math.sin(p) * hit(0.002, d)(t); } return sat(o, drive); }
/** Struck object: a set of ringing modes. */
function modal(s: number, modes: [number, number, number][], exc = 0.002): F { return norm(modalRaw(s, modes, exc)); }
function modalRaw(s: number, modes: [number, number, number][], exc = 0.002): F { const o = buf(s); for (const [f, g, d] of modes) { if (f > SR * 0.45) continue; const w = TAU * f / SR, r = Math.exp(-1 / (d * SR)), c = 2 * r * Math.cos(w); let y1 = 0, y2 = 0; const L = Math.round(exc * SR); for (let i = 0; i < o.length; i++) { const x = i < L ? (R() * 2 - 1) * (1 - i / L) : 0, y = x * Math.sin(w) + c * y1 - r * r * y2; y2 = y1; y1 = y; o[i] += y * g; } } return o; }
/** Edge on edge: many crowded, short partials, so it clashes instead of ringing. */
function clash(s: number, f: number, d: number, n = 26): F { const m: [number, number, number][] = []; for (let i = 0; i < n; i++) { const u = (i + R() * 0.9) / n, g = Math.pow(16, u); m.push([f * g * rr(0.97, 1.03), rr(0.35, 1) * (0.5 + 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.3))), d * rr(0.35, 1) / Math.pow(g, 0.45)]); } const o = modal(s, m, 0.004); add(o, svf(shape(noise(s), t => ex(t, 0.012)), 3800, 0.7, 'hp'), 0.9); return norm(shape(o, t => 1 - 0.35 * Math.sin(t * 310) * ex(t, 0.08))); }
/** Steel drawn over steel: a ratcheting hiss that climbs. `cut` is where it stops dead. */
function draw(s: number, f0: number, f1: number, cut: number, grit = 170): F { const o = buf(s); let ph = 0; const x = noise(s); for (let i = 0; i < x.length; i++) { const t = i / SR, u = Math.min(1, t / cut); ph += grit * (0.6 + 0.9 * u) / SR; const tooth = 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * ph)); x[i] *= t < cut ? Math.pow(u, 1.7) * tooth : ex(t - cut, 0.006); } add(o, svf(x, t => f0 * Math.pow(f1 / f0, Math.min(1, t / cut)), 1.6, 'bp'), 1.2); add(o, svf(x, t => 2.3 * f0 * Math.pow(f1 / f0, Math.min(1, t / cut)), 2.2, 'bp'), 0.5); return o; }
/** A dry crack: a few joints going, one of them large. */
function cracks(s: number, n: number, big: number): F { const o = buf(s); for (let k = 0; k < n; k++) { const f = rr(420, 1500), g = k === 0 ? 1 : rr(0.2, 0.6), at = k === 0 ? big : R() * s * 0.6; add(o, modal(0.12, [[f, 1, 0.011], [f * 1.63, 0.8, 0.008], [f * 2.71, 0.5, 0.005], [f * 4.3, 0.3, 0.003]], 0.0015), g * 2.2, at); add(o, pluckNoise(0.05, 0.004, 1800), g, at); } return add(o, thump(0.25, 150, 60, 0.04, 2.4), 0.9, big); }
/** Scattered little impacts: gravel, splinters, embers. */
function grains(s: number, n: number, f0: number, f1: number, d: number, spread: (u: number) => number, q = 8): F { const o = buf(s); for (let k = 0; k < n; k++) { const at = spread(R()) * s, L = d * rr(0.5, 1.5), f = f0 * Math.pow(f1 / f0, R()), x = shape(noise(L * 5), t => ex(t, L)), y = svf(x, f, Math.min(q, 1.4), 'bp'); add(o, y, rr(0.2, 1), at); } return o; }
const early = (u: number) => u * u * u;

/** A throat: glottal pulses with jitter and a subharmonic, noise breath, moving formants, then a torn waveshaper. */
function voice(s: number, pitch: (u: number) => number, formants: [number, number, number][], o: { jitter?: number; sub?: number; breath?: number; drive?: number; env?: (u: number) => number; wob?: number; shift?: (u: number) => number } = {}): F {
  const src = buf(s), J = o.jitter ?? 0.05, sub = o.sub ?? 0.5; let ph = 0, per = 0, jit = 1, n = 0;
  for (let i = 0; i < src.length; i++) { const u = i / src.length; ph += pitch(u) * jit * (1 + (o.wob ?? 0) * Math.sin(i / SR * 41)) / SR; if (ph >= 1) { ph -= 1; n++; jit = 1 + (R() * 2 - 1) * J; per = (n & 1 ? 1 - sub : 1) * rr(0.75, 1); } const g = ph < 0.6 ? Math.sin(Math.PI * ph / 0.6) : -0.35 * (1 - (ph - 0.6) / 0.4); src[i] = g * per + (R() * 2 - 1) * (o.breath ?? 0.2) * (0.35 + 0.65 * Math.max(0, g)); }
  const out = new Float32Array(src.length), sh = o.shift ?? (() => 1); for (const [f, g, q] of formants) add(out, svf(src, t => f * sh(t / s), q, 'bp'), g);
  add(out, svf(src, 180, 0.7, 'lp'), 0.22); const e = o.env ?? (u => Math.min(1, u * 12) * Math.min(1, (1 - u) * 5)); for (let i = 0; i < out.length; i++) out[i] *= e(i / out.length); return sat(out, o.drive ?? 2);
}
/** Detuned saw ensemble, the basis of strings and brass. */
function saws(s: number, f: number, n: number, det: number, vib = 0): F { const o = buf(s); for (let k = 0; k < n; k++) { let p = R(); const d = Math.pow(2, (k / Math.max(1, n - 1) - 0.5) * det / 600), vr = rr(4.6, 5.8), vp = R() * 6; for (let i = 0; i < o.length; i++) { const t = i / SR; p += f * d * (1 + vib * Math.sin(t * TAU * vr + vp) * Math.min(1, t * 3)) / SR; p -= Math.floor(p); o[i] += (2 * p - 1) / n; } } return o; }
function pluckNoise(s: number, d: number, hp: number): F { return svf(shape(noise(s), t => ex(t, d)), hp, 0.7, 'hp'); }

function flesh(w: number): F {
  const s = 0.34 + w * 0.2, o = buf(s); add(o, thump(s, 170 - w * 30, 46, 0.07 + w * 0.06, 2.4), 1.0);
  // the edge going in
  add(o, svf(shape(noise(s), t => hit(0.004, 0.035)(t)), t => 7000 * ex(t, 0.05) + 900, 0.9, 'bp'), 0.9);
  // wet: a wandering band broken into gulps
  const gulp = rr(26, 40), ph = R() * 6; add(o, svf(shape(noise(s), t => hit(0.01, 0.07 + w * 0.04)(t) * (0.45 + 0.55 * Math.sin(t * TAU * gulp + ph + Math.sin(t * 90)))), t => 520 + 620 * Math.abs(Math.sin(t * 31 + ph)), 3.2, 'bp'), 1.3);
  add(o, grains(s, 4 + Math.round(w * 9), 700, 2600, 0.006, u => 0.02 + early(u) * 0.35, 5), 0.8 + w * 0.5);
  add(o, pluckNoise(0.06, 0.005, 2200), 1.1); add(o, svf(shape(noise(0.12), hit(0.001, 0.018)), 1500, 1.1, 'bp'), 1.2); add(o, thump(0.16, 320 - w * 60, 70, 0.03, 2.8), 0.7); return punch(sat(o, 1.2), 0.012);
}
function slamStone(w: number): F {
  const s = 1.0 + w * 0.9, o = buf(s); add(o, thump(s, 120, 30, 0.16 + w * 0.16, 2.6), 1.2); add(o, svf(shape(noise(s), hit(0.002, 0.05)), 2600, 0.6, 'lp'), 0.9); add(o, svf(shape(brown(s), hit(0.01, 0.3 + w * 0.3)), 420, 0.6, 'lp'), 1.4);
  add(o, grains(s, 40 + Math.round(60 * w), 380, 3400, 0.009, u => 0.03 + Math.pow(u, 1.7) * 0.75, 6), 0.55); return sat(o, 1.6);
}
function fireBurst(s: number, w: number): F { const o = buf(s); add(o, svf(shape(noise(s), t => hit(0.02 + 0.05 * w, s * 0.28)(t)), t => 300 + 2600 * ex(t, s * 0.2), 0.7, 'bp'), 1.2); add(o, svf(shape(brown(s), hit(0.015, s * 0.4)), 260, 0.6, 'lp'), 1.1 * w); add(o, grains(s, Math.round(50 * s), 1200, 6000, 0.003, u => Math.pow(u, 1.3), 4), 0.4); return sat(o, 1.4); }
function whoosh(s: number, f: number, w: number): F { const o = buf(s), mid = s * 0.42, fl = rr(28, 46); add(o, svf(shape(noise(s), t => Math.exp(-Math.pow((t - mid) / (s * 0.13), 2)) * (0.6 + 0.4 * Math.sin(t * TAU * fl))), t => f * 2.2 * (1.5 - t / s), 2.4, 'bp'), 0.5); add(o, svf(shape(noise(s), t => Math.exp(-Math.pow((t - mid) / (s * 0.17), 2))), t => f * (0.45 + 1.25 * Math.exp(-Math.pow((t - mid) / (s * 0.2), 2))), 1.3, 'bp'), 1); add(o, svf(shape(noise(s), t => Math.exp(-Math.pow((t - mid) / (s * 0.1), 2))), f * 3.1, 2, 'bp'), 0.35); add(o, svf(shape(brown(s), t => Math.exp(-Math.pow((t - mid) / (s * 0.2), 2))), 300, 0.7, 'lp'), w); return o; }

export interface Def { n: string; peak: number; make: () => F }
const V = (n: string, count: number, peak: number, make: (i: number) => F): Def[] => Array.from({ length: count }, (_, i) => ({ n: count > 1 ? `${n}${i}` : n, peak, make: () => make(i) }));
const splash = (s: number, f: number, w: number): F => { const o = buf(s); add(o, svf(shape(noise(s), hit(0.006, s * 0.3)), t => f * ex(t, s * 0.4) + 400, 0.8, 'bp'), 1.2); add(o, svf(shape(brown(s), hit(0.01, s * 0.5)), 380, 0.6, 'lp'), 1.1 * w); add(o, grains(s, Math.round(40 * s * w), 1800, 7500, 0.004, u => 0.04 + Math.pow(u, 1.3) * 0.8, 5), 0.5); return o; };
const gulps = (s: number, n: number, f0: number, f1: number, g: number): F => { const o = buf(s); for (let k = 0; k < n; k++) { const at = R() * (s - 0.3), L = rr(0.05, 0.14), f = f0 * Math.pow(f1 / f0, R()); add(o, svf(shape(noise(L), t => Math.sin(Math.PI * t / L)), t => f * (1 + 1.4 * t / L), 5, 'bp'), rr(0.4, 1) * g, at); } return o; };
const wood = (s: number, f: number, g: number): F => { const o = buf(s); for (const [m, a, d] of [[1, 1, 0.05], [1.9, 0.7, 0.035], [2.7, 0.5, 0.025], [4.1, 0.3, 0.015]]) add(o, modal(s, [[f * m, a, d]], 0.002), g); return o; };
const lampPops = (s: number, n: number): F => { const o = buf(s); for (let k = 0; k < n; k++) add(o, svf(shape(noise(0.08), hit(0.001, 0.014)), rr(1400, 3200), 1.2, 'bp'), rr(0.15, 0.6), R() * (s - 0.1)); return o; };
/** Crossfade the tail into the head. */
function loop(x: F, xf: number): F { const k = Math.round(xf * SR), n = x.length - k, o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = i < k ? x[i] * Math.sqrt(i / k) + x[n + i] * Math.sqrt(1 - i / k) : x[i]; return o; }
/** Share of energy wanted above 250 Hz, so a hit has an edge as well as weight and survives a phone speaker. */
const WANT: Record<string, number> = { sub: 0, heart: 0.15, drone: 0.12, taiko: 0.3, bra: 0.4, slam: 0.4, thud: 0.38, stepK: 0.35, stepP: 0.6, stepC: 0.55, flesh: 0.6, fleshH: 0.55, hurt: 0.6, kGrunt: 0.6, kPain: 0.7, kDeath: 0.6, bRoar: 0.55, bBark: 0.6, bPain: 0.65, bDeath: 0.6, cueGround: 0.6, break: 0.5, barFill: 0.35, finalCut: 0.42, land: 0.5, jump: 0.5, uiGo: 0.4, cueRed: 0.6, boom: 0.4, erupt: 0.45, whooshB: 0.5, fireBed: 0.4 };
function balance(n: string, x: F): F {
  const w = WANT[n.replace(/\d+$/, '')] ?? 0.5; if (w <= 0) return x; const split = (m: 'lp' | 'hp') => svf(svf(x, 250, 0.54, m), 250, 1.31, m), lo = split('lp'), hi = split('hp'); let el = 1e-9, eh = 1e-9; for (let i = 0; i < x.length; i++) { el += lo[i] * lo[i]; eh += hi[i] * hi[i]; }
  if (eh / (el + eh) >= w) return x; const r = Math.sqrt(w / (1 - w) * el / eh), g = Math.min(5, Math.sqrt(r)), gl = g / Math.max(1, r); for (let i = 0; i < x.length; i++) x[i] = lo[i] * Math.max(0.12, gl) + hi[i] * g; return sat(x, 0.9);
}
const LOOPS = new Set(['wind', 'fireBed', 'drone', 'waterBed', 'windLow', 'lampsBed']);
export function render(d: Def): F { seed = 7; for (const c of d.n) seed = (seed * 31 + c.charCodeAt(0)) >>> 0; const x = balance(d.n, d.make()); if (!LOOPS.has(d.n)) return fin(x, d.peak); let m = 1e-6; for (const v of x) m = Math.max(m, Math.abs(v)); for (let i = 0; i < x.length; i++) x[i] *= d.peak / m; return x; }
/** Stereo impulse response: a stone court open to the sky. */
export function courtIR(ch: number): F { seed = 99 + ch * 17; const s = 2.6, o = buf(s); let lp = 0; for (let i = 0; i < o.length; i++) { const t = i / SR, c = Math.min(0.85, 0.12 + t * 0.4); lp += ((R() * 2 - 1) - lp) * (1 - c); o[i] = lp * Math.exp(-t / 0.55) * Math.min(1, t / 0.02) * 0.6; } for (let k = 0; k < 12; k++) { const at = 0.012 + R() * 0.11; o[Math.round(at * SR)] += (R() < 0.5 ? -1 : 1) * 0.9 * Math.exp(-at / 0.06); } return o; }

export type { F };
export { R, rr, TAU, buf, ex, svf, noise, brown, shape, add, peakOf, sat, norm, punch, hit, fin, thump, modalRaw, modal, clash, draw, cracks, grains, early, voice, saws, pluckNoise, flesh, slamStone, fireBurst, whoosh, loop, V, splash, gulps, wood, lampPops };
