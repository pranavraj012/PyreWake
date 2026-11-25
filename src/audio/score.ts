// Adaptive score. Everything is in D with a flat second; layers enter with the fight and with your aura.
import type { sound as SoundT } from './sound.ts';
type S = typeof SoundT;
export type Mood = 'still' | 'spar' | 'r1' | 'crawl' | 'hang' | 'scene' | 'reveal' | 'r2' | 'eclipse' | 'finish' | 'won' | 'dead';
interface M { bpm: number; drum: number; hi: number; str: number; bra: number; cho: number; trem: number; anvil: number; drone: number; lead: number }
const MOOD: Record<Mood, M> = {
  still: { bpm: 84, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.15, anvil: 0, drone: 0.5, lead: 0 }, spar: { bpm: 92, drum: 0.4, hi: 0, str: 0, bra: 0, cho: 0, trem: 0.25, anvil: 0, drone: 0.75, lead: 0 },
  r1: { bpm: 104, drum: 0.95, hi: 0.5, str: 0.6, bra: 0.6, cho: 0, trem: 0, anvil: 0, drone: 0.8, lead: 0 }, crawl: { bpm: 126, drum: 0.8, hi: 0.9, str: 0.8, bra: 0.3, cho: 0, trem: 0.3, anvil: 0, drone: 0.7, lead: 0 }, hang: { bpm: 72, drum: 0.7, hi: 0.15, str: 0, bra: 0.5, cho: 0.35, trem: 0.9, anvil: 0, drone: 1, lead: 0 },
  scene: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0, anvil: 0, drone: 0.12, lead: 0 }, reveal: { bpm: 66, drum: 0.9, hi: 0, str: 0, bra: 1, cho: 0.9, trem: 0.6, anvil: 0.4, drone: 1, lead: 0 },
  r2: { bpm: 138, drum: 1, hi: 0.8, str: 0.95, bra: 0.85, cho: 0.6, trem: 0, anvil: 0.5, drone: 0.8, lead: 0 }, eclipse: { bpm: 148, drum: 1, hi: 1, str: 1, bra: 1, cho: 0.95, trem: 0.4, anvil: 0.9, drone: 0.9, lead: 0.4 }, finish: { bpm: 70, drum: 0.35, hi: 0, str: 0, bra: 0, cho: 0.6, trem: 0.7, anvil: 0, drone: 0.9, lead: 0 },
  won: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0.35, trem: 0, anvil: 0, drone: 0.4, lead: 0.8 }, dead: { bpm: 60, drum: 0, hi: 0, str: 0, bra: 0, cho: 0, trem: 0, anvil: 0, drone: 0.3, lead: 0 },
};
// sixteen steps a bar; two bars of question, two of answer
const DRUM = ['x..x..x...x.x...', 'x..x..x.x...x.xx', 'x.x...x..x.x..x.', 'x..x.xx...x.xxxx'], HI = ['..o.o..o..o.o.oo', 'o..o..o.o.o..o.o', '..oo..o...oo.o.o', 'o.o.ooo.o.o.oooo'], OST = [[0, 12, 1, 0, 3, 0, 1, 0, 0, 12, 1, 0, 5, 3, 1, 0], [0, 12, 0, 1, 3, 1, 0, -2, 0, 8, 7, 5, 3, 1, 0, 1]];
const ROOT = [0, 0, 1, -2, 0, 0, -4, 1], SCALE = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15];

export class Score {
  mood: Mood = 'still'; aura = 0; private s: S; private cur: M = { ...MOOD.still }; private step = 0; private next = 0; private leadAt = 7; private rnd = 5;
  constructor(s: S) { this.s = s; this.next = s.ctx!.currentTime + 0.1; }
  set(m: Mood) { if (m === this.mood) return; const big = MOOD[m].drum - MOOD[this.mood].drum; this.mood = m; if (big > 0.2) { this.s.play('sub', { bus: 'music', gain: 0.8, wet: 0.5 }); } }
  private R() { this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0; return this.rnd / 4294967296; }
  update(dt: number) {
    const c = this.s.ctx; if (!c || c.state !== 'running') return; const T = MOOD[this.mood], k = 1 - Math.exp(-dt * (this.mood === 'scene' || this.mood === 'dead' ? 3 : 0.9)); for (const q in T) this.cur[q as keyof M] += (T[q as keyof M] - this.cur[q as keyof M]) * (q === 'bpm' ? 1 : k);
    this.s.bed('drone', 0.5 * this.cur.drone, 'music', 1, 0.8); const now = c.currentTime; if (this.next < now - 0.5) this.next = now + 0.05;
    while (this.next < now + 0.14) { this.tick(this.next - now); this.next += 60 / this.cur.bpm / 4; this.step++; }
  }
  private note(n: string, semi: number, gain: number, delay: number, wet = 0.3) { this.s.play(n, { bus: 'music', gain, rate: Math.pow(2, semi / 12), delay, wet }); }
  private tick(d: number) {
    const m = this.cur, i = this.step % 16, bar = Math.floor(this.step / 16), phrase = bar % 4, root = ROOT[Math.floor(bar / 2) % 8], soft = 0.75 + 0.25 * this.R();
    if (m.drum > 0.06) { if (DRUM[phrase][i] === 'x' && (m.drum > 0.6 || i % 8 === 0)) this.note('taiko', 0, (i === 0 ? 0.8 : 0.5 * soft) * m.drum, d, 0.25); if (i === 0 && m.drum > 0.8 && bar % 2 === 0) this.note('sub', 0, 0.4 * m.drum, d, 0.2); if (phrase === 3 && i >= 12 && m.drum > 0.7) this.note('drumHi', -3 + (i - 12), 0.3 + (i - 12) * 0.1, d, 0.25); }
    const hi = Math.min(1, m.hi + (this.aura >= 2 && m.drum > 0.5 ? 0.35 : 0)); if (hi > 0.06) { if (HI[phrase][i] === 'o') this.note(i % 3 ? 'rim' : 'drumHi', 0, (i % 4 === 2 ? 0.4 : 0.26) * hi * soft, d, 0.2); if (hi > 0.55) this.note('shake', 0, (i % 2 ? 0.28 : 0.5) * hi * soft, d, 0.05); }
    if (m.str > 0.06) { const n = OST[Math.floor(bar / 4) % 2][i]; if (m.str > 0.55 || i % 2 === 0) this.note('str', n + root + (this.mood === 'eclipse' && bar % 2 ? 12 : 0), (i % 4 === 0 ? 0.5 : 0.3) * m.str * soft, d, 0.22); }
    if (m.bra > 0.06 && i === 0 && bar % 2 === 0) { this.note('bra', root, 0.6 * m.bra, d, 0.45); if (m.bra > 0.7) this.note('bra', root + 6, 0.2 * m.bra, d, 0.5); } if (m.bra > 0.8 && i === 8 && phrase === 3) this.note('bra', root + 1, 0.5 * m.bra, d, 0.4);
    if (m.cho > 0.06 && i === 0 && bar % 2 === 0) { this.note('cho', root, 0.55 * m.cho, d, 0.7); if (m.cho > 0.5) this.note('cho', root + 3, 0.3 * m.cho, d, 0.7); }
    if (m.trem > 0.06 && i === 0 && bar % 2 === 1) { this.note('trem', root + 1, 0.4 * m.trem, d, 0.6); this.note('trem', root, 0.3 * m.trem, d, 0.6); }
    if (m.anvil > 0.06 && (i === 4 || i === 12) && this.R() < 0.75) this.note('anvil', -2, 0.28 * m.anvil, d, 0.4);
    // the hero's line: only while your streak is alive
    const lead = Math.max(m.lead, this.aura >= 3 && m.drum > 0.5 ? 0.35 + 0.2 * (this.aura - 3) : 0); if (lead > 0.06 && (i === 0 || i === 6 || i === 10 || (i === 14 && this.R() < 0.4)) && this.R() < 0.8) { this.leadAt = Math.max(2, Math.min(SCALE.length - 1, this.leadAt + Math.round(this.R() * 4 - 2))); this.note('lead', SCALE[this.leadAt] + (root === 1 ? 0 : root), 0.5 * lead, d, 0.55); }
  }
}
