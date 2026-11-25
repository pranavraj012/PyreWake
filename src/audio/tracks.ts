// Recorded music (all CC0, see LICENSES.md): streamed from a few shared players, crossfaded, looped with an overlap.
export type TrackName = 'vigil' | 'king' | 'crawl' | 'hang' | 'beneath' | 'morning';
/** `start` is where it comes in, `from` where a loop picks up, `end` where it lets go, `xf` the overlap in seconds (0: plays once). */
const LIST: Record<TrackName, { start: number; from: number; end: number; xf: number }> = {
  vigil: { start: 0, from: 0, end: 53, xf: 0 }, king: { start: 0, from: 15.2, end: 87, xf: 3 }, crawl: { start: 18, from: 0, end: 107.9, xf: 0.25 },
  hang: { start: 0, from: 0, end: 40.5, xf: 3 }, beneath: { start: 0, from: 0, end: 123.3, xf: 0.2 }, morning: { start: 0, from: 0, end: 83, xf: 5 },
};
const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
interface Deck { el: HTMLAudioElement; g: GainNode; lp: BiquadFilterNode; name: TrackName | null; level: number; stopAt: number }

export class Tracks {
  private ctx: AudioContext; private decks: Deck[] = []; private urls = new Map<TrackName, string>(); private cur: Deck | null = null; private want = { gain: 1, lp: 20000 }; private primed = false; private started = false;
  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    for (let i = 0; i < 3; i++) { const el = new Audio(); el.preload = 'auto'; (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true; el.src = SILENCE; const s = ctx.createMediaElementSource(el), g = ctx.createGain(), lp = ctx.createBiquadFilter(); g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 20000; s.connect(lp).connect(g).connect(out); this.decks.push({ el, g, lp, name: null, level: 0, stopAt: 0 }); }
  }
  /** One after another, in the order they are needed. Until a piece has arrived the synthesised score stands in. */
  async load() { if (this.started) return; this.started = true; for (const n of Object.keys(LIST) as TrackName[]) try { const r = await fetch(`${import.meta.env.BASE_URL}music/${n}.mp3`); if (r.ok) this.urls.set(n, URL.createObjectURL(await r.blob())); } catch { /* offline: the synthesised score carries on */ } }
  has(n: TrackName) { return this.urls.has(n); }
  get playing() { return this.cur?.name ?? null; }
  /** From a tap or key: phones only let a player speak later if it was touched once by hand. */
  prime() { if (this.primed) return; this.primed = true; for (const d of this.decks) if (!d.name) void d.el.play().catch(() => { this.primed = false; }); }
  private ramp(p: AudioParam, v: number, tc: number) { p.cancelScheduledValues(this.ctx.currentTime); p.setTargetAtTime(v, this.ctx.currentTime, tc); }
  private put(n: TrackName, at: number, fade: number) {
    const now = this.ctx.currentTime, d = this.decks.filter(x => x !== this.cur).sort((a, b) => a.stopAt - b.stopAt)[0]; const url = this.urls.get(n)!;
    if (d.el.src !== url) d.el.src = url; d.name = n; d.stopAt = 0; d.g.gain.cancelScheduledValues(now); d.g.gain.setValueAtTime(0, now);
    const go = () => { try { d.el.currentTime = at; } catch { /* not seekable yet */ } }; if (d.el.readyState >= 1) go(); else d.el.addEventListener('loadedmetadata', go, { once: true });
    void d.el.play().catch(() => { /* waits for a tap */ }); d.lp.frequency.setValueAtTime(this.want.lp, now); this.ramp(d.g.gain, this.want.gain, fade / 3); d.level = this.want.gain; return d;
  }
  private drop(d: Deck, fade: number) { this.ramp(d.g.gain, 0, fade / 3); d.level = 0; d.stopAt = this.ctx.currentTime + fade * 1.8; }
  /** What should be heard now. Same piece: only its level and tone move. */
  set(n: TrackName | null, gain = 1, lp = 20000, fade = 1.6, at = -1) {
    this.want = { gain, lp };
    // wanted from a later point than it has reached: jump there on the beat of whatever caused it
    if (n && this.cur?.name === n && at >= 0 && this.cur.el.currentTime < at - 0.5) { const old = this.cur; this.cur = this.put(n, at, 0.15); this.drop(old, 0.5); return; }
    if (n && this.cur?.name === n) { this.ramp(this.cur.g.gain, gain, 0.5); this.ramp(this.cur.lp.frequency, lp, 0.4); return; }
    if (this.cur) { this.drop(this.cur, fade); this.cur = null; } if (n && this.has(n)) this.cur = this.put(n, at >= 0 ? at : LIST[n].start, n === 'beneath' ? 0.1 : fade);
  }
  update() {
    const now = this.ctx.currentTime; for (const d of this.decks) if (d.stopAt && now > d.stopAt) { d.el.pause(); d.stopAt = 0; d.name = null; }
    const c = this.cur; if (!c?.name) return; const T = LIST[c.name], t = c.el.currentTime; if (c.el.paused && this.primed) void c.el.play().catch(() => { });
    if (T.xf && t > T.end - T.xf) { const old = c; this.cur = this.put(c.name, T.from, T.xf); this.drop(old, T.xf); }
  }
  /** The page was hidden or shown again. */
  hush(on: boolean) { for (const d of this.decks) if (on) d.el.pause(); else if (d.name) void d.el.play().catch(() => { }); }
}
