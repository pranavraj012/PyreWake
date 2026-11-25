// The clip language: a pose is a flat vector of named channels; clips are sparse keys over them.
// Angles are degrees. az 0 = forward, + = character's left. el + = up (values past 90 carry over the head to the back).
export const CH = [
  'hx', 'hy', 'hz', 'hp', 'hw', 'hr',            // hips offset, pitch / yaw / roll
  'sp', 'sw', 'sr', 'np', 'nw', 'nr',            // spine, head
  'ra', 're', 'rl', 'ba', 'be', 'bo', 'xr',      // right hand: az, el, reach 0-1 from the shoulder; blade az, el, roll; elbow swivel
  'la', 'le', 'll', 'lg', 'xl',                  // left hand, lg = 1 grips the weapon
  'tw', 'air',                                   // whole-body spin; air > 0 releases the feet from the floor
  'flx', 'fly', 'flz', 'flw', 'flp', 'frx', 'fry', 'frz', 'frw', 'frp', // feet: offset, yaw, heel pitch
] as const;
export type Ch = typeof CH[number];
export type Key = Partial<Record<Ch, number>> & { t: number };
export type Pose = Float32Array;
export const IX = Object.fromEntries(CH.map((c, i) => [c, i])) as Record<Ch, number>;
export const N = CH.length;
export const makePose = (o: Partial<Record<Ch, number>> = {}): Pose => { const p = new Float32Array(N); for (const k in o) p[IX[k as Ch]] = o[k as Ch]!; return p; };

// Kinetic chain: hips arrive first, then spine; the blade trails the hand.
const LEAD = CH.map(c => /^h[xyzpwr]$/.test(c) ? 0.035 : /^s[pwr]$/.test(c) ? 0.02 : /^b[aeo]$/.test(c) ? -0.012 : /^n/.test(c) ? 0.03 : 0);

export interface ClipDef {
  dur: number; keys: Key[];
  /** Forward root travel in metres as [time, distance] pairs. */
  move?: [number, number][];
  /** Active damage window. */ hit?: [number, number];
  /** From here the next attack may start. */ chain?: number;
  /** From here movement may interrupt. */ free?: number;
  /** Effects at times. */ fx?: { t: number; kind: string }[];
  blend?: number; power?: number;
  /** Extra damage windows; defaults to [hit]. */ hits?: [number, number][];
  /** Overrides of the weapon's reach (m) and half arc (deg). */ reach?: number; arc?: number;
  /** Strong enough to send the target reeling. */ reel?: boolean;
}
export interface Clip extends ClipDef { name: string; tracks: { t: number[]; v: number[]; m: number[] }[] }

/** Monotone cubic tangents: no overshoot unless authored. */
function tangents(t: number[], v: number[]) {
  const n = t.length, m = new Array<number>(n).fill(0); if (n < 2) return m;
  const d: number[] = []; for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / (t[i + 1] - t[i]));
  for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const h0 = t[i] - t[i - 1], h1 = t[i + 1] - t[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  return m;
}
export function clip(name: string, def: ClipDef): Clip {
  const tracks = CH.map(c => { const k = def.keys.filter(q => q[c] !== undefined), t = k.map(q => q.t), v = k.map(q => q[c]!); return { t, v, m: tangents(t, v) }; });
  return { ...def, name, tracks };
}
export function curveAt(t: number[], v: number[], m: number[], x: number) {
  const n = t.length; if (x <= t[0]) return v[0]; if (x >= t[n - 1]) return v[n - 1];
  let i = 0; while (x > t[i + 1]) i++;
  const h = t[i + 1] - t[i], s = (x - t[i]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v[i + 1] + (s3 - s2) * h * m[i + 1];
}
/** Channels the clip doesn't mention keep whatever `base` holds. */
export function sampleClip(c: Clip, time: number, base: Pose, out: Pose) {
  for (let i = 0; i < N; i++) { const k = c.tracks[i]; out[i] = k.t.length ? curveAt(k.t, k.v, k.m, Math.min(time + LEAD[i], c.dur)) : base[i]; }
  return out;
}
const moveCache = new WeakMap<object, { t: number[]; v: number[]; m: number[] }>();
export function moveAt(c: ClipDef, time: number) {
  if (!c.move) return 0; let k = moveCache.get(c.move);
  if (!k) { const t = c.move.map(p => p[0]), v = c.move.map(p => p[1]); k = { t, v, m: tangents(t, v) }; moveCache.set(c.move, k); }
  return curveAt(k.t, k.v, k.m, time);
}

const WRAP = CH.map(c => ['ra', 'ba', 'la', 'tw', 'hw', 'flw', 'frw'].includes(c));
/** Inertialised transitions: the new motion starts at once; the leftover offset decays with matched velocity. */
export class Inertial {
  private x = new Float32Array(N); private v = new Float32Array(N); private t = 9; private w = 40; private dt = 1 / 60;
  private p1 = new Float32Array(N); private p2 = new Float32Array(N); private primed = 0;
  /** Call when the source changes; `next` is the new source's first pose. */
  start(next: Pose, nextVel: Pose | null, dur: number) {
    if (this.primed < 2) return;
    for (let i = 0; i < N; i++) { let d = this.p1[i] - next[i]; if (WRAP[i]) d -= Math.round(d / 360) * 360; this.x[i] = d; const v = (this.p1[i] - this.p2[i]) / this.dt - (nextVel ? nextVel[i] : 0); this.v[i] = Math.abs(v) < 3000 ? v : 0; }
    this.t = 0; this.w = 5.5 / dur;
  }
  apply(p: Pose, dt: number) {
    this.t += dt; const e = Math.exp(-this.w * this.t);
    if (e > 0.002) for (let i = 0; i < N; i++) p[i] += (this.x[i] + (this.v[i] * 0.6 + this.w * this.x[i]) * this.t) * e;
    this.p2.set(this.p1); this.p1.set(p); this.dt = Math.max(dt, 1e-4); this.primed++;
  }
  /** Shift remembered yaw spin so a finished 360 does not unwind. */
  unwind() { const i = IX.tw; for (const p of [this.p1, this.p2]) p[i] -= Math.round(p[i] / 360) * 360; }
}
