// Decides what the Ferryman does, net on and net off: health-gated styles over an attack picker that plays in strings and always leaves an opening.
import { D } from '../../combat/difficulty.ts';
import type { Boss, BossBrain } from '../boss.ts';
import { isMove, type River } from './river.ts';
import { FIRST_GRAB_BY } from '../../bosses/king/brain.ts';

export type RiverStyle = 'pole' | 'chain' | 'lantern' | 'bare' | 'last';
interface Option { seq: string[]; w: number; near: number; far: number; below?: number; need?: (k: River) => boolean }
const POLE: Option[] = [
  { seq: ['lowWater'], w: 3, near: 0, far: 7 }, { seq: ['sounding'], w: 2.5, near: 0, far: 10 }, { seq: ['pushOff'], w: 4, near: 6, far: 30 }, { seq: ['pushOff'], w: 1, near: 0, far: 6 }, { seq: ['turnBoat'], w: 2.5, near: 0, far: 5.2 },
  { seq: ['lowWater', 'turnBoat'], w: 2, near: 0, far: 5, below: 0.9 }, { seq: ['coldHands'], w: 1.6, near: 3, far: 30, below: 0.8 }, { seq: ['sounding', 'lowWater'], w: 2, near: 1, far: 7, below: 0.85 },
];
const CHAIN: Option[] = [
  { seq: ['cast'], w: 4, near: 3.5, far: 16, need: k => !k.tauts }, { seq: ['haulIn'], w: 7, near: 0, far: 30, need: k => k.tauts }, { seq: ['wheelIron'], w: 3, near: 1.5, far: 7, need: k => !k.tauts }, { seq: ['dragDeep'], w: 2.5, near: 2, far: 12, need: k => !k.tauts },
  { seq: ['lowWater'], w: 1.5, near: 0, far: 5 }, { seq: ['turnBoat'], w: 1.2, near: 0, far: 4 }, { seq: ['coldHands'], w: 2, near: 3, far: 30 }, { seq: ['wheelIron', 'cast'], w: 1.5, near: 2, far: 7, below: 0.5, need: k => !k.tauts },
];
const LANTERN: Option[] = [
  { seq: ['gather'], w: 6, near: 0, far: 30, need: k => k.dark <= 0 && k.lanterns.length === 0 }, { seq: ['wrongShore'], w: 3.5, near: 0, far: 30, need: k => k.lanterns.length === 0 }, { seq: ['coldHands'], w: 3, near: 0, far: 30 },
  { seq: ['lowWater'], w: 2.5, near: 0, far: 7 }, { seq: ['sounding'], w: 2, near: 0, far: 10 }, { seq: ['turnBoat'], w: 2, near: 0, far: 5.2 }, { seq: ['pushOff'], w: 2, near: 5, far: 30 },
  { seq: ['lowWater', 'turnBoat'], w: 2, near: 0, far: 5, below: 0.2 },
];
const BARE: Option[] = [
  { seq: ['thrust'], w: 3, near: 0, far: 6.2 }, { seq: ['flurry'], w: 3, near: 0, far: 4.8 }, { seq: ['reap'], w: 2.2, near: 0, far: 5.4 }, { seq: ['vault'], w: 2.4, near: 5, far: 30 }, { seq: ['skim'], w: 3.2, near: 6, far: 12.5 }, { seq: ['lamps'], w: 2.4, near: 3.5, far: 12 },
  { seq: ['flurry', 'thrust'], w: 1.6, near: 0, far: 4.8, below: 0.75 }, { seq: ['reap', 'vault'], w: 1.2, near: 0, far: 5.4, below: 0.6 },
];
/** Below 40%: everything at once. */
const LAST: Option[] = [...BARE, { seq: ['flurry', 'reap', 'thrust'], w: 2, near: 0, far: 4.8 }, { seq: ['lamps', 'skim'], w: 1.6, near: 6, far: 30 }];
const BOOK: Record<RiverStyle, Option[]> = { pole: POLE, chain: CHAIN, lantern: LANTERN, bare: BARE, last: LAST };

export class RiverBrain implements BossBrain {
  temper = 1; seen = new Set<string>(); style: string = 'pole'; began: string | null = null;
  private wait = 1.0; private queue: string[] = []; private recent: string[] = []; private s: number; private calmT = 0; private ease = 0; private hurts: number[] = []; private cool: Record<string, number> = {};
  constructor(seed = 11) { this.s = seed; }
  private rnd() { this.s = (this.s + 0x6d2b79f5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private rest(form: 1 | 2) { const r = form === 2 ? [0.35, 0.8] : [0.45, 0.95]; this.wait = (r[0] + this.rnd() * (r[1] - r[0])) * D.temper[this.temper].rest + (this.ease > 0 ? (this.ease--, D.boss.assist) : 0); }
  /** Round 1 seconds spent without the drag thrown yet (see FIRST_GRAB_BY in bosses/king/brain.ts). */ private noGrab = 0;
  reset(form: 1 | 2) { this.hurts = []; this.noGrab = 0; this.wait = 1.2; this.calmT = 0; this.queue = []; this.recent = []; this.ease = 0; this.style = form === 2 ? 'bare' : 'pole'; this.began = null; this.cool = {}; }
  hurt(time: number) { this.hurts = [...this.hurts.filter(t => time - t < 6), time]; if (this.hurts.length >= 2) { this.ease = 2; this.hurts = []; } }
  struck(_k: Boss, _dmg: number) { this.wait -= 0.1; return false; }
  broken() { this.queue = []; this.wait = 0.5; }
  drop(_k: Boss) { this.queue = []; this.wait = 0.4; }
  step(dt: number, b: Boss, px: number, pz: number, hitsLanded: number, frac: number) {
    const k = b as River; this.began = null;
    if (k.ended && !this.queue.length) { if (isMove(k.ended)) this.rest(k.form); else this.wait = Math.max(this.wait, 0.35); }
    if (this.queue.length && isMove(k.mode) && !k.committed && k.mt > (k.strikes.at(-1)?.t[1] ?? 0) + 0.2) { this.go(k, this.queue.shift()!); return; }
    if (k.form === 1 && !k.grabbedOnce) this.noGrab += dt;
    const free = k.mode === 'idle' || k.mode === 'stalk' || k.mode === 'strafe'; if (!free) return;
    const dist = Math.hypot(px - k.hx, pz - k.hz), off = Math.abs(wrapPi(Math.atan2(px - k.x, pz - k.z) - k.yaw)); this.calmT += dt; this.wait -= dt; for (const c in this.cool) this.cool[c] -= dt;
    // --- the style script
    const want: RiverStyle = k.form === 2 ? (frac < 0.4 ? 'last' : 'bare') : frac < 0.33 ? 'lantern' : frac < 0.66 ? 'chain' : 'pole';
    if (want !== this.style && !this.queue.length && !k.tauts && k.lanterns.length === 0) { this.style = want; this.began = want; this.wait = Math.max(this.wait, 1.0); this.recent = []; if (k.dark > 0) k.dark = 0; }
    // the opening seconds belong to the player
    if (k.form === 1 && this.style === 'pole' && hitsLanded < 3 && this.calmT < 9) { if (dist > 4.4 && k.mode === 'idle' && this.wait < 0.4) k.set('stalk'); if (k.mode === 'stalk' && dist < D.boss.near) k.set('idle'); return; }
    if (this.queue.length && (off < 1.5 || k.form === 2)) { this.go(k, this.queue.shift()!); return; }
    if (this.wait > 0) {
      if (k.form === 2) { if (k.mode === 'idle' && dist > D.boss.near + 1.2) k.set('stalk'); else if (k.mode === 'stalk' && dist < D.boss.near) k.set('strafe'); else if (k.mode === 'idle') k.set('strafe'); return; }
      if (k.mode === 'idle' && dist > D.boss.near + 1.6) k.set('stalk'); else if (k.mode === 'stalk' && dist < D.boss.near) k.set(this.rnd() < 0.5 ? 'strafe' : 'idle'); else if (k.mode === 'idle' && this.wait > 0.4 && this.rnd() < 0.02) k.set('strafe'); return;
    }
    if (off > 1.0 && !k.tauts) { k.turn((k.form === 2 ? 5 : 2.4) * dt, Math.atan2(px - k.x, pz - k.z)); return; }
    // the drag is never left out of a fight: if it has not been thrown by the deadline, it is thrown as soon as the hero is in reach
    if (k.form === 1 && !k.grabbedOnce && this.noGrab > FIRST_GRAB_BY && !k.tauts && dist <= 12 && off < 1.0 && !this.queue.length) { this.go(k, 'dragDeep'); return; }
    const dark = k.dark > 0, opts = BOOK[this.style as RiverStyle].filter(o => dist >= o.near && dist <= o.far && (o.below === undefined || frac < o.below) && (!o.need || o.need(k)) && !(this.recent.at(-1) === o.seq.join()) && !(this.cool[o.seq[0]] > 0));
    if (!opts.length) { if (k.mode === 'idle') k.set('stalk'); return; }
    const weight = (o: Option) => o.w * (o.seq.length > 1 ? D.temper[this.temper].long : 1) * (o.seq.some(q => !this.seen.has(q)) ? (o.seq.length > 1 ? 0.02 : 3) : 1) * (this.recent.includes(o.seq.join()) ? 0.4 : 1) * (dark && /^(lowWater|sounding|turnBoat)$/.test(o.seq[0]) ? 2.2 : 1);
    let x = this.rnd() * opts.reduce((a, o) => a + weight(o), 0), pick = opts[0]; for (const o of opts) { x -= weight(o); if (x <= 0) { pick = o; break; } }
    this.recent = [...this.recent.slice(-2), pick.seq.join()]; const a = pick.seq[0]; this.queue = pick.seq.slice(1); if (a === 'lamps') this.cool.lamps = 12; if (a === 'gather') this.cool.gather = 14; this.go(k, a);
  }
  private go(k: River, a: string) { k.set(a, !isMove(a) || this.seen.has(a) ? 1 : D.teach.rate); }
}
const wrapPi = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
