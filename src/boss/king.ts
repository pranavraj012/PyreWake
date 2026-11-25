// The Hanged King's simulation: where it is, what it is doing, and the sparring brain. Runs headless.
import { moveAt } from '../anim/pose.ts';
import { D } from '../combat/difficulty.ts';
import { ATTACKS, type Strike } from './moves.ts';
import { KING_CLIPS as K } from './clips.ts';

export type KingMode = 'idle' | 'stalk' | 'crawl' | 'hang' | 'slam' | 'sweep' | 'grab' | 'reel' | 'kneel' | 'fall';
export const KING_MODES: KingMode[] = ['idle', 'stalk', 'slam', 'sweep', 'grab', 'reel', 'kneel', 'fall', 'crawl', 'hang'];
export const isAttack = (m: KingMode) => m in ATTACKS;
const sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

export class King {
  x = 0; z = -4; yaw = 0; vx = 0; vz = 0; speed = 0; mode: KingMode = 'idle'; mt = 0; prev = 0; burst = 0; r = 0.75;
  /** Playback speed of the wind-up: the first showing of an attack is slower. */ rate = 1;
  /** Bumped on every mode change, so each attack instance is distinct. */ serial = 0;
  cues: Strike[] = []; live: Strike[] = []; ended: KingMode | null = null;
  private moved = 0;
  set(mode: KingMode, rate = 1) { this.mode = mode; this.mt = this.prev = 0; this.moved = 0; this.rate = rate; this.serial++; }
  get strikes() { return ATTACKS[this.mode] ?? []; }
  /** True from the start of an attack until its last blow has landed: it can't be interrupted. */
  get committed() { const s = this.strikes; return s.length > 0 && this.mt < s[s.length - 1].t[1]; }
  turn(step: number, to: number) { const d = wrap(to - this.yaw); this.yaw += Math.max(-step, Math.min(step, d)); return d; }

  step(dt: number, px: number, pz: number) {
    const s = this.strikes, m = this.mode, d = dt * (s.length && this.mt < s[0].t[0] ? this.rate : 1);
    this.prev = this.mt; this.mt += d; this.ended = null; this.cues = s.filter(q => q.cue > this.prev && q.cue <= this.mt); this.live = s.filter(q => this.mt >= q.t[0] && this.prev <= q.t[1]);
    const dx = px - this.x, dz = pz - this.z, dist = Math.hypot(dx, dz), face = Math.atan2(dx, dz); this.speed = 0; this.vx = this.vz = 0;
    if (m === 'stalk') {
      // broken time: a held beat, then three quick steps
      const k = (this.mt * 0.62) % 1; this.burst = k < 0.36 ? 0 : sst(0.36, 0.43, k) * sst(1, 0.92, k); this.speed = this.burst * (dist > D.boss.near - 0.2 ? 4.1 : 0); this.turn((0.5 + this.burst * 2.4) * dt, face);
      this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed;
    } else if (m === 'crawl') {
      const k = (this.mt * 0.8) % 1, b = 0.55 + 1.0 * sst(0.2, 0.35, k) * sst(1, 0.8, k), R = 6.2, ang = Math.atan2(this.x - px, this.z - pz); this.speed = 3.4 * b; const radial = (R - dist) * 0.9;
      this.vx = Math.cos(ang) * this.speed + Math.sin(ang) * radial; this.vz = -Math.sin(ang) * this.speed + Math.cos(ang) * radial; this.turn(4.2 * dt, face - 0.62);
    } else if (m === 'idle') this.turn(0.7 * dt, face);
    else if (m === 'hang') this.turn(0.35 * dt, face);
    else if (m in K) {
      const c = K[m], g = moveAt(c, this.mt), want = g - this.moved, st = want > 0 ? Math.min(want, Math.max(0, dist - 1.9)) : want; this.moved = g; this.x += Math.sin(this.yaw) * st; this.z += Math.cos(this.yaw) * st;
      // tracks you through the wind-up, then commits: the last stretch before the blow can always be side-stepped
      if (s.length && this.mt < s[0].t[0] - 0.22) this.turn(2.2 * dt, face);
      if (this.mt >= c.dur) { this.ended = m; this.set('idle'); }
    }
    this.x += this.vx * dt; this.z += this.vz * dt; const R = Math.hypot(this.x, this.z); if (R > 18.5) { this.x *= 18.5 / R; this.z *= 18.5 / R; }
  }
  /** Does this strike cover the point (with the player's own width)? */
  covers(q: Strike, px: number, pz: number, r = 0.3) {
    const dx = px - this.x, dz = pz - this.z, fw = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw), sd = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
    if (q.box) return fw > -0.4 && fw < q.box[0] + r && Math.abs(sd) < q.box[1] + r;
    if (q.arc) return Math.hypot(dx, dz) < q.arc[0] + r && Math.abs(Math.atan2(sd, fw)) * 57.3 < q.arc[1];
    return false;
  }
}

/** Sparring: one attack at a time, always followed by a long opening, and nothing at all until you have landed a few hits. */
export class SparBrain {
  seen = new Set<KingMode>(); private wait = 1.2; private last: KingMode | null = null; private order: KingMode[] = ['slam', 'sweep', 'grab']; private s: number; private calmT = 0;
  constructor(seed = 7) { this.s = seed; }
  private rnd() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  rest(extra = 0) { this.wait = D.boss.rest[0] + this.rnd() * (D.boss.rest[1] - D.boss.rest[0]) + extra; }
  reset() { this.wait = 1.6; this.calmT = 0; this.last = null; }
  step(dt: number, k: King, px: number, pz: number, hitsLanded: number) {
    if (k.ended) { if (isAttack(k.ended)) this.rest(); else this.wait = Math.max(this.wait, 0.7); }
    if (k.mode !== 'idle' && k.mode !== 'stalk') return;
    const dist = Math.hypot(px - k.x, pz - k.z);
    this.calmT += dt; this.wait -= dt;
    if (dist > D.boss.near + 1.1 && k.mode === 'idle' && this.wait < 0.6) k.set('stalk');
    if (k.mode === 'stalk' && dist < D.boss.near) k.set('idle');
    // the opening minute belongs to the player
    if (hitsLanded < 4 && this.calmT < 14) return;
    if (this.wait > 0 || dist > D.boss.near + 1.1) return;
    // never swing at something it isn't looking at
    if (Math.abs(wrap(Math.atan2(px - k.x, pz - k.z) - k.yaw)) > 1.1) { k.turn(1.6 * dt, Math.atan2(px - k.x, pz - k.z)); return; }
    let a: KingMode; if (this.order.length) a = this.order.shift()!; else do a = (['slam', 'sweep', 'grab', 'slam', 'sweep'] as KingMode[])[Math.floor(this.rnd() * 5)]; while (a === this.last);
    this.last = a; k.set(a, this.seen.has(a) ? 1 : D.teach.rate);
  }
}
