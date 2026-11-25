// Decides what the boss does: a health-gated style script over an attack picker that plays in strings and keeps the pressure on.
import { D } from '../combat/difficulty.ts';
import { isAttack, type King, type KingMode } from './king.ts';

export type Style = 'executioner' | 'crawler' | 'hanged' | 'blades' | 'eclipse';
interface Option { seq: KingMode[]; w: number; near: number; far: number; /** Only below this fraction of the current form's health. */ below?: number }
/** A string is several attacks with no rest between. After it there is always an opening. */
const BOOK: Record<Style, Option[]> = {
  executioner: [
    { seq: ['slam'], w: 2, near: 0, far: 4.2 }, { seq: ['sweep'], w: 2, near: 0, far: 4.4 }, { seq: ['drag'], w: 3, near: 0.8, far: 6.8 }, { seq: ['leap'], w: 1, near: 0, far: 5 }, { seq: ['leap'], w: 5, near: 5, far: 30 },
    { seq: ['drag', 'sweep'], w: 3, near: 2, far: 6.5, below: 0.92 }, { seq: ['sweep', 'slam'], w: 2, near: 0, far: 4.2, below: 0.92 }, { seq: ['grab'], w: 2, near: 0, far: 5, below: 0.9 }, { seq: ['slam', 'drag'], w: 2, near: 0, far: 4.5, below: 0.86 },
  ],
  crawler: [{ seq: ['pounce'], w: 3, near: 2.5, far: 30 }, { seq: ['rake'], w: 3, near: 0, far: 6.5 }, { seq: ['rake', 'pounce'], w: 2, near: 0, far: 6.5 }, { seq: ['rake', 'rake'], w: 1, near: 0, far: 6 }],
  hanged: [{ seq: ['hangSwing'], w: 3, near: 0, far: 30 }, { seq: ['hangSwipe'], w: 2, near: 0, far: 3 }],
  blades: [
    { seq: ['flurry'], w: 3, near: 0, far: 5 }, { seq: ['cross'], w: 3, near: 2, far: 10 }, { seq: ['cross', 'cross'], w: 2, near: 2, far: 10, below: 0.95 }, { seq: ['hop', 'skewer'], w: 2, near: 0, far: 4 }, { seq: ['skewer'], w: 2, near: 2.5, far: 6 },
    { seq: ['wheel'], w: 3, near: 3, far: 30 }, { seq: ['rupture'], w: 2, near: 2, far: 12 }, { seq: ['rain'], w: 1, near: 1.2, far: 30, below: 0.9 }, { seq: ['rain', 'cross'], w: 2, near: 3, far: 30, below: 0.8 },
  ],
  eclipse: [
    { seq: ['flurry', 'hop', 'skewer'], w: 2, near: 0, far: 5 }, { seq: ['cross', 'cross', 'flurry'], w: 2, near: 2, far: 10 }, { seq: ['wheel', 'cross'], w: 3, near: 3, far: 30 }, { seq: ['rupture', 'cross'], w: 2, near: 2, far: 12 }, { seq: ['rain', 'wheel'], w: 2, near: 4, far: 30 }, { seq: ['cross'], w: 2, near: 2, far: 10 }, { seq: ['flurry'], w: 2, near: 0, far: 5 },
  ],
};

export class Brain {
  /** Chosen in the menu: 0 measured, 1 fierce, 2 relentless. */ temper = 1;
  seen = new Set<KingMode>(); style: Style = 'executioner'; private wait = 1.0; private queue: KingMode[] = []; private recent: string[] = []; private s: number; private calmT = 0; private hangDmg = 0; private hangsLeft = 2; private ease = 0; private hurts: number[] = []; private strings = 0;
  /** Set when a style begins, for prompts and the director. */ began: Style | null = null;
  constructor(seed = 7) { this.s = seed; }
  private rnd() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private rest(form: 1 | 2) { const r = form === 2 ? D.boss.rest2 : D.boss.rest; this.wait = (r[0] + this.rnd() * (r[1] - r[0])) * D.temper[this.temper].rest + (this.ease > 0 ? (this.ease--, D.boss.assist) : 0); }
  reset(form: 1 | 2) { this.wait = 1.1; this.calmT = 0; this.queue = []; this.recent = []; this.hangsLeft = 2; this.hangDmg = 0; this.ease = 0; this.style = form === 2 ? 'blades' : 'executioner'; this.began = null; this.strings = 0; }
  /** Quiet assist: two blows taken close together and the boss eases off for a couple of strings. */
  hurt(time: number) { this.hurts = [...this.hurts.filter(t => time - t < 6), time]; if (this.hurts.length >= 2) { this.ease = 2; this.hurts = []; } }
  /** It answers being hit instead of standing there. Returns true when the roots give way. */
  struck(k: King, dmg: number) { this.wait -= 0.1; if (!k.hanging) return false; this.hangDmg += dmg; if (this.hangDmg < D.boss.hangBreak) return false; this.drop(k); return true; }
  /** Its attack was broken: the rest of the string is forgotten, and it needs a moment. */
  broken() { this.queue = []; this.wait = 0.45; }
  drop(k: King) { this.style = 'executioner'; this.queue = []; k.armed = true; k.crawling = false; k.set('crash'); this.wait = 0.3; }
  private enter(style: Style, k: King) {
    this.style = style; this.began = style; this.queue = []; this.wait = 1.0; this.recent = [];
    if (style === 'crawler') { k.armed = false; k.crawling = true; k.set('crawl'); }
    else if (style === 'hanged') { k.armed = false; k.crawling = false; this.hangsLeft--; this.hangDmg = 0; this.wait = 2.0; k.set('hang'); }
    else if (style === 'executioner') { k.armed = true; k.crawling = false; k.set('idle'); }
  }
  /** `frac` is health left in this form, 1 to 0. */
  step(dt: number, k: King, px: number, pz: number, hitsLanded: number, frac: number) {
    this.began = null;
    if (k.ended && !this.queue.length) { if (isAttack(k.ended)) { this.rest(k.form); this.strings++; } else if (k.ended !== 'hop') this.wait = Math.max(this.wait, 0.35); }
    // strings: cut out of the recovery into the next attack
    if (this.queue.length && isAttack(k.mode) && !k.committed && k.mt > k.strikes[k.strikes.length - 1].t[1] + 0.2 && k.y === 0) { this.go(k, this.queue.shift()!); return; }
    const free = k.mode === 'idle' || k.mode === 'stalk' || k.mode === 'strafe' || k.mode === 'crawl' || k.mode === 'hang';
    if (!free) return;
    const hx = k.hx, hz = k.hz, dist = Math.hypot(px - hx, pz - hz), off = Math.abs(wrapPi(Math.atan2(px - k.x, pz - k.z) - k.yaw));
    this.calmT += dt; this.wait -= dt;
    // --- style script
    if (k.form === 1 && !this.queue.length && !k.hanging) {
      if ((this.hangsLeft === 2 && frac < 0.3) || (this.hangsLeft === 1 && frac < 0.13)) { this.enter('hanged', k); return; }
      const want: Style = frac < 0.3 ? 'executioner' : frac < 0.64 ? 'crawler' : 'executioner';
      if (want !== this.style) { this.enter(want, k); return; }
    } else if (k.form === 2 && this.style === 'blades' && frac < 0.4 && !this.queue.length) { this.enter('eclipse', k); }
    if (k.hanging && k.ht > D.boss.hangTime && k.mode === 'hang') { this.drop(k); return; }
    // the opening seconds belong to the player
    if (k.form === 1 && this.style === 'executioner' && hitsLanded < 3 && this.calmT < 9) { if (dist > 4.4 && k.mode === 'idle' && this.wait < 0.4) k.set('stalk'); if (k.mode === 'stalk' && dist < D.boss.near) k.set('idle'); return; }
    // --- carry on a string at once
    if (this.queue.length && (off < 1.5 || k.hanging)) { this.go(k, this.queue.shift()!); return; }
    // --- footwork while waiting
    if (this.wait > 0) {
      if (k.mode === 'idle' && dist > D.boss.near + 1.4) k.set(k.form === 2 ? 'strafe' : 'stalk');
      else if (k.mode === 'idle' && k.form === 2 && this.wait > 0.3) k.set('strafe');
      else if (k.mode === 'stalk' && dist < D.boss.near) k.set(this.rnd() < 0.5 ? 'strafe' : 'idle');
      return;
    }
    // never swings at something it isn't looking at
    if (!k.hanging && k.mode !== 'crawl' && off > 1.0) { k.turn(2.4 * dt, Math.atan2(px - k.x, pz - k.z)); return; }
    const opts = BOOK[this.style].filter(o => dist >= o.near && dist <= o.far && (o.below === undefined || frac < o.below) && !(this.recent.at(-1) === o.seq.join()));
    if (!opts.length) { if (k.mode === 'idle' || k.mode === 'strafe') k.set('stalk'); if (k.form === 2 && dist > 6) this.start(k, ['cross']); return; }
    // unseen attacks come up sooner, alone; repeats less often
    const weight = (o: Option) => o.w * (o.seq.filter(isAttack).length > 1 ? D.temper[this.temper].long : 1) * (o.seq.some(q => isAttack(q) && !this.seen.has(q)) ? (o.seq.filter(isAttack).length > 1 ? 0.02 : 3) : 1) * (this.recent.includes(o.seq.join()) ? 0.4 : 1);
    let x = this.rnd() * opts.reduce((a, o) => a + weight(o), 0), pick = opts[0]; for (const o of opts) { x -= weight(o); if (x <= 0) { pick = o; break; } }
    this.start(k, [...pick.seq]);
  }
  private start(k: King, seq: KingMode[]) { this.recent = [...this.recent.slice(-2), seq.join()]; const a = seq.shift()!; this.queue = seq; this.go(k, a); }
  private go(k: King, a: KingMode) { k.set(a, !isAttack(a) || this.seen.has(a) ? 1 : D.teach.rate); }
}
const wrapPi = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
