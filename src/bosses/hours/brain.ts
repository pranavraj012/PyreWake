// Decides what the Sister and the Pall do: a range-aware picker that plays in strings and always leaves an opening, with the counts on their own clock.
import { D } from '../../combat/difficulty.ts';
import type { Boss, BossBrain } from '../../boss/boss.ts';
import { isMove, type Sister } from './sister.ts';

interface Option { seq: string[]; w: number; near: number; far: number; below?: number; after?: number }
const SISTER: Option[] = [
  { seq: ['reap'], w: 3, near: 0, far: 4.8 }, { seq: ['hourWheel'], w: 2.2, near: 2, far: 7 }, { seq: ['lieDown'], w: 1.6, near: 0, far: 3.2 },
  { seq: ['harvest'], w: 2.4, near: 2.5, far: 14, after: 6 }, { seq: ['binding'], w: 2.2, near: 2, far: 8.5 }, { seq: ['cleanSheet'], w: 2, near: 3, far: 14 },
  { seq: ['betweenBeds'], w: 2.4, near: 5, far: 30, after: 30 },
  { seq: ['harvest', 'reap'], w: 1.4, near: 2.5, far: 14, below: 0.8, after: 6 }, { seq: ['binding', 'cleanSheet'], w: 1.2, near: 3, far: 8.5, below: 0.7 },
];
const PALL: Option[] = [
  { seq: ['hourHand'], w: 3, near: 4, far: 14 }, { seq: ['drawSheet'], w: 2.4, near: 3.5, far: 14 }, { seq: ['wardStands'], w: 2.4, near: 4, far: 11.5 },
  { seq: ['noon'], w: 2, near: 2, far: 12 }, { seq: ['lastBreath'], w: 2.4, near: 0, far: 8.5 }, { seq: ['gather'], w: 2.6, near: 2.5, far: 10.5 },
  { seq: ['wardStands', 'drawSheet'], w: 1.4, near: 4, far: 11.5, below: 0.6 }, { seq: ['noon', 'hourHand'], w: 1.4, near: 2, far: 12, below: 0.5 }, { seq: ['wardStands', 'gather'], w: 1.2, near: 4, far: 10.5, below: 0.75 },
];

export class HoursBrain implements BossBrain {
  temper = 1; seen = new Set<string>(); style = 'scythe'; began: string | null = null;
  private wait = 1.2; private queue: string[] = []; private recent: string[] = []; private s: number; private t = 0; private countAt = 0; private counts = 0; private lashAt = -99; private blinkAt = -99; private ease = 0; private hurts: number[] = [];
  constructor(seed = 17) { this.s = seed; }
  private rnd() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private rest(form: 1 | 2) { const r = form === 2 ? [0.35, 0.8] : [0.5, 1.0]; this.wait = (r[0] + this.rnd() * (r[1] - r[0])) * D.temper[this.temper].rest + (this.ease > 0 ? (this.ease--, D.boss.assist) : 0); }
  reset(form: 1 | 2) { this.hurts = []; this.wait = 1.2; this.queue = []; this.recent = []; this.ease = 0; this.t = 0; this.countAt = 0; this.counts = 0; this.lashAt = -99; this.blinkAt = -99; this.style = form === 2 ? 'pall' : 'scythe'; this.began = null; }
  hurt(time: number) { this.hurts = [...this.hurts.filter(t => time - t < 6), time]; if (this.hurts.length >= 2) { this.ease = 2; this.hurts = []; } }
  struck(_k: Boss, _dmg: number) { this.wait -= 0.1; return false; }
  broken() { this.queue = []; this.wait = 0.6; }
  drop(_k: Boss) { this.queue = []; this.wait = 0.4; }
  step(dt: number, b: Boss, px: number, pz: number, _hitsLanded: number, frac: number) {
    const k = b as Sister; this.t += dt; this.began = null; if (k.mode !== 'idle' && k.mode !== 'stalk' && k.mode !== 'strafe' && k.mode !== 'blink') return; if (k.mode === 'blink') { this.wait -= dt; return; }
    const dist = Math.hypot(px - k.hx, pz - k.hz); this.wait -= dt;
    // the count runs on its own clock and alone: first at 85% (slow, to teach it), then about every 35 s; round 2's below 40%
    const due = k.form === 1 ? (this.counts === 0 ? frac < 0.85 : this.t - this.countAt > 35) : frac < 0.4 && (this.counts === 0 || this.t - this.countAt > 35);
    if (due && this.wait < 0.3 && dist < 14) { this.counts++; this.countAt = this.t; this.queue = []; this.go(k, k.form === 1 ? 'sevenBreaths' : 'longCount', k.form === 1 && this.counts === 1 ? 0.77 : 1); return; }
    // round 2: standing at her hem forever is answered
    if (k.form === 2 && k.hugT > 2.5 && this.wait < 0.6 && this.t - this.lashAt > 9) { this.lashAt = this.t; k.hugT = 0; this.queue = []; this.go(k, 'hemLash'); return; }
    if (this.wait > 0) { this.foot(k, dist); return; }
    if (!this.queue.length) {
      const opts = (k.form === 1 ? SISTER : PALL).filter(o => dist >= o.near && dist <= o.far && (o.below === undefined || frac < o.below) && (o.after === undefined || this.t > o.after) && !(this.recent.at(-1) === o.seq[0] && o.seq.length === 1) && !(o.seq[0] === 'betweenBeds' && this.recent.includes('betweenBeds')) && !(o.seq[0] === 'harvest' && this.recent.at(-1) === 'harvest'));
      if (!opts.length) { this.foot(k, dist); return; }
      let r = this.rnd() * opts.reduce((a, o) => a + o.w, 0); const o = opts.find(q => (r -= q.w) < 0) ?? opts[0]; this.queue = [...o.seq];
    }
    this.go(k, this.queue.shift()!);
  }
  private go(k: Sister, mode: string, rate = 1) { k.set(mode, rate); this.began = mode; this.recent = [...this.recent.slice(-3), mode]; this.seen.add(mode); this.rest(k.form); if (this.queue.length) this.wait = 0.15; }
  private foot(k: Sister, dist: number) { const near = k.form === 2 ? 4.2 : 3.4; if (k.form === 1 && k.mode === 'stalk' && dist > 9 && k.mt > 0.8 && this.t - this.blinkAt > 4) { this.blinkAt = this.t; k.set('blink'); return; } if (k.mode === 'idle' && dist > near + 1.4) k.set('stalk'); else if (k.mode === 'stalk' && dist < near) k.set(this.rnd() < 0.5 ? 'strafe' : 'idle'); else if (k.mode === 'strafe' && k.mt > 2.2) k.set('idle'); }
  /** For tests: whether a mode is an attack. */ static isMove = isMove;
}
