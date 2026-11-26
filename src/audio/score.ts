// Adaptive score. Everything is in D with a flat second; layers enter with the fight and with your aura.
import type { sound as SoundT } from './sound.ts';
import type { TrackName } from './tracks.ts';
type S = typeof SoundT;
export type Mood = 'still' | 'vigil' | 'lesson' | 'spar' | 'r1' | 'crawl' | 'hang' | 'scene' | 'reveal' | 'r2' | 'eclipse' | 'finish' | 'won' | 'dead' | 'row' | 'row2' | 'row3' | 'weight' | 'weight2' | 'hours' | 'pall' | 'pall2' | 'region' | 'hub';
interface M { bpm: number; drum: number; hi: number; str: number; bra: number; cho: number; trem: number; anvil: number; drone: number; lead: number }
const MOOD: Record<Mood, M> = {
  vigil: { bpm: 84, drum: 0, hi: 0, str: 0, bra: 0, cho: 0.2, trem: 0.15, anvil: 0, drone: 0.6, lead: 0 }, lesson: { bpm: 84, drum: 0.3, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.15, anvil: 0, drone: 0.6, lead: 0 },
  still: { bpm: 84, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.15, anvil: 0, drone: 0.5, lead: 0 }, spar: { bpm: 92, drum: 0.4, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.25, anvil: 0, drone: 0.75, lead: 0 },
  r1: { bpm: 104, drum: 0.95, hi: 0.5, str: 0.6, bra: 0.6, cho: 0, trem: 0, anvil: 0, drone: 0.8, lead: 0 }, crawl: { bpm: 126, drum: 0.8, hi: 0.9, str: 0.8, bra: 0.3, cho: 0, trem: 0.3, anvil: 0, drone: 0.7, lead: 0 }, hang: { bpm: 72, drum: 0.7, hi: 0.15, str: 0, bra: 0.5, cho: 0.35, trem: 0.9, anvil: 0, drone: 1, lead: 0 },
  scene: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0, anvil: 0, drone: 0.12, lead: 0 }, reveal: { bpm: 66, drum: 0.9, hi: 0, str: 0, bra: 1, cho: 0.9, trem: 0.6, anvil: 0.4, drone: 1, lead: 0 },
  r2: { bpm: 138, drum: 1, hi: 0.8, str: 0.95, bra: 0.85, cho: 0.6, trem: 0, anvil: 0.5, drone: 0.8, lead: 0 }, eclipse: { bpm: 148, drum: 1, hi: 1, str: 1, bra: 1, cho: 0.95, trem: 0.4, anvil: 0.9, drone: 0.9, lead: 0.4 }, finish: { bpm: 70, drum: 0.35, hi: 0, str: 0, bra: 0, cho: 0.6, trem: 0.7, anvil: 0, drone: 0.9, lead: 0 },
  row: { bpm: 78, drum: 0, hi: 0, str: 0.35, bra: 0, cho: 0.15, trem: 0.1, anvil: 0, drone: 0.7, lead: 0 }, row2: { bpm: 84, drum: 0, hi: 0, str: 0.5, bra: 0, cho: 0.25, trem: 0.2, anvil: 0, drone: 0.8, lead: 0 }, row3: { bpm: 72, drum: 0, hi: 0, str: 0.3, bra: 0, cho: 0.4, trem: 0.5, anvil: 0, drone: 0.95, lead: 0 },
  weight: { bpm: 96, drum: 0, hi: 0, str: 0.7, bra: 0.3, cho: 0.5, trem: 0.3, anvil: 0, drone: 0.85, lead: 0 }, weight2: { bpm: 104, drum: 0, hi: 0, str: 0.85, bra: 0.5, cho: 0.7, trem: 0.3, anvil: 0, drone: 0.85, lead: 0.3 },
  hours: { bpm: 40, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.15, anvil: 0, drone: 0.8, lead: 0 }, pall: { bpm: 44, drum: 0, hi: 0, str: 0.25, bra: 0, cho: 0.5, trem: 0.25, anvil: 0, drone: 0.85, lead: 0 }, pall2: { bpm: 48, drum: 0, hi: 0, str: 0.55, bra: 0.2, cho: 0.85, trem: 0.4, anvil: 0, drone: 0.9, lead: 0 },
  region: { bpm: 72, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.1, anvil: 0, drone: 0.5, lead: 0 }, hub: { bpm: 66, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.1, anvil: 0, drone: 0.45, lead: 0 },
  won: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0.35, trem: 0, anvil: 0, drone: 0.4, lead: 0.8 }, dead: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0, anvil: 0, drone: 0.3, lead: 0 },
};
/** Recorded piece for each mood (the first of a list that has arrived): level, how far its tone is closed (Hz), and the point it must have reached (s). While one plays, the synthesised layers rest, but for the river's oars and the Waiting House's breath, which keep time over it. */
export const MUSIC: Record<Mood, [TrackName | TrackName[], number, number, number?] | null> = {
  still: ['menu', 1.7, 20000], vigil: ['vigil', 2.0, 20000], lesson: ['king', 1.1, 1500], spar: ['king', 1.7, 9000], r1: ['king', 2.6, 20000, 15.2], crawl: ['crawl', 2.2, 20000], hang: ['hang', 2.4, 20000], scene: null, reveal: ['beneath', 2.5, 20000], r2: ['beneath', 2.5, 20000], eclipse: ['eclipse', 2.6, 20000], finish: ['eclipse', 1.5, 420], row: [['ferry', 'king'], 1.5, 9000], row2: [['ferry', 'king'], 1.9, 20000], row3: [['ferry', 'king'], 1.6, 5000], weight: ['crawl', 2.4, 20000], weight2: ['eclipse', 2.6, 20000], hours: [['hours', 'hang'], 1.8, 20000], pall: [['pall', 'beneath'], 2.3, 20000], pall2: [['pall2', 'pall', 'eclipse'], 2.6, 20000], won: ['morning', 2.2, 20000], dead: null, region: ['region', 1.8, 20000], hub: ['hub', 1.6, 20000],
};
/** The danger layer: near foes the region's or the hub's piece drops away by this much, and a low dread bed rises under it (`setDanger`). */
const DUCK = 0.45;
export function dangerDuck(k: number): number { return 1 - DUCK * Math.max(0, Math.min(1, k)); }
/** Round 1's styles, and the least any one piece plays before another style's may start (s). */
const STYLES = /^(r1|crawl|hang)$/, HOLD = 16;
/** The river's moods keep a slow 6/8 pulse of oars: [level, how much of the low strings and choir]. A recorded piece can be dropped in later by giving the mood an entry in MUSIC. */
const ROW: Partial<Record<Mood, [number, number]>> = { row: [0.75, 0.4], row2: [0.85, 0.6], row3: [0.7, 0.8], weight: [1, 0.9], weight2: [1, 1] };
/** The Waiting House keeps time by breath: in on the first beat, out on the sixth, and a woman's hum stepping down the count, one note a breath. [level, hum, choir of breaths]. */
const BREATH: Partial<Record<Mood, [number, number, number]>> = { hours: [0.85, 1, 0], pall: [1, 0.7, 0.6], pall2: [1, 1, 1] }, COUNTDOWN = [0, -2, -3, -5, -7, -8, -10];
const REST: M = { bpm: 90, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0, anvil: 0, drone: 0, lead: 0 };
// sixteen steps a bar; two bars of question, two of answer
const DRUM = ['x..x..x...x.x...', 'x..x..x.x...x.xx', 'x.x...x..x.x..x.', 'x..x.xx...x.xxxx'], HI = ['..o.o..o..o.o.oo', 'o..o..o.o.o..o.o', '..oo..o...oo.o.o', 'o.o.ooo.o.o.oooo'], OST = [[0, 12, 1, 0, 3, 0, 1, 0, 0, 12, 1, 0, 5, 3, 1, 0], [0, 12, 0, 1, 3, 1, 0, -2, 0, 8, 7, 5, 3, 1, 0, 1]];
const ROOT = [0, 0, 1, -2, 0, 0, -4, 1], SCALE = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15];

export class Score {
  mood: Mood = 'still'; aura = 0; /** Wanted danger, 0 (off, the default) to 1; see `setDanger`. */ danger = 0; private dangerK = 0; private s: S; private cur: M = { ...MOOD.still }; private step = 0; private next = 0; private leadAt = 7; private rnd = 5; private heard = ''; private rowK = 0; private since = -99; private next_: Mood | null = null;
  constructor(s: S) { this.s = s; this.next = s.ctx!.currentTime + 0.1; }
  /** A world page drives this from the foes nearby: 0 is quiet, 1 is a pack at your back. It rises over about a second and falls more slowly. */
  setDanger(v: number) { this.danger = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)); }
  /** The King changes its mind faster than a piece of music can bear: within round 1 a piece holds for a while before the next may take over. */
  set(m: Mood) {
    if (m === this.mood) { this.next_ = null; return; } const now = this.s.ctx?.currentTime ?? 0; if (STYLES.test(m) && STYLES.test(this.mood) && now - this.since < HOLD) { this.next_ = m; return; }
    if (this.pick(m) !== this.pick(this.mood)) this.since = now; this.next_ = null; this.turn(m);
  }
  private turn(m: Mood) { const big = MOOD[m].drum - MOOD[this.mood].drum; this.mood = m; if (big > 0.2 && !this.s.tracks?.playing) { this.s.play('sub', { bus: 'music', gain: 0.8, wet: 0.5 }); } }
  /** The piece a mood would play now: the first of its list that has arrived. */
  private pick(m: Mood): TrackName | null { const mu = MUSIC[m], tr = this.s.tracks; if (!mu || !tr) return null; for (const n of Array.isArray(mu[0]) ? mu[0] : [mu[0]]) if (tr.has(n)) return n; return null; }
  /** A recording is playing: the oars and breaths keep time over it, softer, and nothing pitched. */ private over = false;
  private R() { this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0; return this.rnd / 4294967296; }
  update(dt: number) {
    const c = this.s.ctx; if (!c || c.state !== 'running') return; if (this.next_ && c.currentTime - this.since >= HOLD) { const m = this.next_; this.next_ = null; this.set(m); }
    this.dangerK += (this.danger - this.dangerK) * (1 - Math.exp(-dt * (this.danger > this.dangerK ? 1.2 : 0.5))); if (this.dangerK < 1e-3) this.dangerK = 0; this.s.bed('dreadBed', 0.6 * this.dangerK, 'music', 1, 0.8);
    const mu = MUSIC[this.mood], tr = this.s.tracks, name = this.pick(this.mood), on = !!name, g = mu ? mu[1] * (1 + (name === 'morning' || name === 'vigil' ? 0 : 0.04 * this.aura)) * dangerDuck(this.dangerK) : 0, key = on ? `${name} ${g} ${mu![2]}` : ''; this.over = on;
    if (key !== this.heard) { this.heard = key; tr?.set(on ? name : null, g, mu?.[2], this.mood === 'dead' || this.mood === 'scene' ? 0.7 : 1.8, mu?.[3]); } tr?.update();
    const T = on ? REST : MOOD[this.mood], k = 1 - Math.exp(-dt * (this.mood === 'scene' || this.mood === 'dead' ? 3 : 0.9)); for (const q in T) this.cur[q as keyof M] += (T[q as keyof M] - this.cur[q as keyof M]) * (q === 'bpm' ? 1 : k);
    this.rowK += ((ROW[this.mood]?.[0] ?? 0) - this.rowK) * (1 - Math.exp(-dt * 0.9)); this.s.bed('drone', 0.5 * this.cur.drone, 'music', 1, 0.8); const now = c.currentTime; if (this.next < now - 0.5) this.next = now + 0.05;
    while (this.next < now + 0.14) { this.tick(this.next - now); this.next += 60 / this.cur.bpm / 4; this.step++; }
  }
  private note(n: string, semi: number, gain: number, delay: number, wet = 0.3) { this.s.play(n, { bus: 'music', gain, rate: Math.pow(2, semi / 12), delay, wet }); }
  /** Six eight: two long beats of three, the oars on the weak steps, the voices a bar behind. */
  private rowTick(d: number) {
    const m = this.cur, i = this.step % 12, bar = Math.floor(this.step / 12), root = [0, -2, -4, -5][Math.floor(bar / 2) % 4], k = this.rowK * (this.over ? 0.55 : 1), heavy = ROW[this.mood]![1];
    if (i === 0) { if (!this.over) this.note('sub', root - 12, 0.55 * k, d, 0.3); this.note('taiko', root - 12, 0.2 * k * (0.5 + heavy * 0.5), d, 0.3); } if (i === 6) this.note('taiko', root - 17, 0.22 * k * (0.5 + heavy * 0.5), d, 0.3);
    if ((i === 3 || i === 9) && this.R() < 0.9) this.note('oar', 0, 0.3 * k, d, 0.4);
    if (m.str > 0.06 && i === 0 && bar % 2 === 0) { this.note('str', root, 0.4 * m.str, d, 0.4); this.note('str', root + 7, 0.24 * m.str, d, 0.4); } if (m.str > 0.06 && i === 6 && bar % 2 === 1) this.note('str', root + 3, 0.3 * m.str, d, 0.4);
    if (m.cho > 0.06 && i === 0 && bar % 4 === 0) this.note('cho', root, 0.5 * m.cho, d, 0.8); if (m.trem > 0.06 && i === 0 && bar % 4 === 2) this.note('trem', root + 1, 0.35 * m.trem, d, 0.7); if (m.bra > 0.06 && i === 0 && bar % 4 === 0 && heavy > 0.8) this.note('bra', root - 12, 0.4 * m.bra, d, 0.5);
  }
  private breathTick(d: number) {
    const m = this.cur, b = BREATH[this.mood]!, i = this.step % 12, bar = Math.floor(this.step / 12), L = b[0] * (this.over ? 0.6 : 1), hum = this.over ? 0 : b[1];
    if (i === 0) { this.note('breathIn', 0, 0.55 * L, d, 0.5); this.note('sub', -12, 0.3 * L, d, 0.4); } if (i === 5) this.note('breathOut', 0, 0.5 * L, d, 0.5);
    if (i === 2 && hum > 0.05 && bar % 8 !== 7) this.note('hum', COUNTDOWN[bar % 8] ?? 0, 0.42 * hum, d, 0.7);
    if (b[2] > 0.05 && (i === 0 || i === 6) && this.R() < 0.6) this.note('breathOut', -3 - Math.floor(this.R() * 5), 0.25 * b[2], d + this.R() * 0.2, 0.8);
    if (m.cho > 0.06 && i === 0 && bar % 2 === 0) this.note('cho', COUNTDOWN[bar % 8] ?? 0, 0.4 * m.cho, d, 0.8); if (m.str > 0.06 && i === 6 && bar % 2 === 1) this.note('str', -12, 0.3 * m.str, d, 0.5); if (m.trem > 0.06 && i === 0 && bar % 4 === 2) this.note('trem', 1, 0.3 * m.trem, d, 0.7);
  }
  private tick(d: number) {
    if (BREATH[this.mood]) { this.breathTick(d); return; }
    if (ROW[this.mood]) { this.rowTick(d); return; }
    const m = this.cur, i = this.step % 16, bar = Math.floor(this.step / 16), phrase = bar % 4, root = ROOT[Math.floor(bar / 2) % 8], soft = 0.75 + 0.25 * this.R();
    if (m.drum > 0.06) { if (DRUM[phrase][i] === 'x' && (m.drum > 0.6 || i % 8 === 0)) this.note('taiko', 0, (i === 0 ? 0.8 : 0.5 * soft) * m.drum, d, 0.25); if (i === 0 && m.drum > 0.8 && bar % 2 === 0) this.note('sub', 0, 0.4 * m.drum, d, 0.2); if (phrase === 3 && i >= 12 && m.drum > 0.7) this.note('drumHi', -3 + (i - 12), 0.3 + (i - 12) * 0.1, d, 0.25); }
    const hi = Math.min(1, m.hi + (this.aura >= 2 && m.drum > 0.5 ? 0.35 : 0)); if (hi > 0.06) { if (HI[phrase][i] === 'o') this.note(i % 3 ? 'rim' : 'drumHi', 0, (i % 4 === 2 ? 0.4 : 0.26) * hi * soft, d, 0.2); if (hi > 0.55) this.note('shake', 0, (i % 2 ? 0.28 : 0.5) * hi * soft, d, 0.05); }
    if (m.str > 0.06) { const n = OST[Math.floor(bar / 4) % 2][i]; if (m.str > 0.55 || i % 2 === 0) this.note('str', n + root + (this.mood === 'eclipse' && bar % 2 ? 12 : 0), (i % 4 === 0 ? 0.5 : 0.3) * m.str * soft, d, 0.22); }
    if (m.bra > 0.06 && i === 0 && bar % 2 === 0) { this.note('bra', root, 0.6 * m.bra, d, 0.45); if (m.bra > 0.7) this.note('bra', root + 6, 0.2 * m.bra, d, 0.5); } if (m.bra > 0.8 && i === 8 && phrase === 3) this.note('bra', root + 1, 0.5 * m.bra, d, 0.4);
    if (m.cho > 0.06 && i === 0 && bar % 2 === 0) { this.note('cho', root, 0.55 * m.cho, d, 0.7); if (m.cho > 0.5) this.note('cho', root + 3, 0.3 * m.cho, d, 0.7); }
    if (m.trem > 0.06 && i === 0 && bar % 2 === 1) { this.note('trem', root + 1, 0.4 * m.trem, d, 0.6); this.note('trem', root, 0.3 * m.trem, d, 0.6); }
    if (m.anvil > 0.06 && (i === 4 || i === 12) && this.R() < 0.75) this.note('anvil', -2, 0.24 * m.anvil, d, 0.3);
    // the hero's line: only while your streak is alive
    const lead = Math.max(m.lead, this.aura >= 3 && m.drum > 0.5 ? 0.35 + 0.2 * (this.aura - 3) : 0); if (lead > 0.06 && (i === 0 || i === 6 || i === 10 || (i === 14 && this.R() < 0.4)) && this.R() < 0.8) { this.leadAt = Math.max(2, Math.min(SCALE.length - 1, this.leadAt + Math.round(this.R() * 4 - 2))); this.note('lead', SCALE[this.leadAt] + (root === 1 ? 0 : root), 0.5 * lead, d, 0.55); }
  }
}
