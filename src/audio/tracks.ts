// Recorded music (all CC0, see LICENSES.md): streamed from a few shared players, crossfaded, looped with an overlap.
export type TrackName = 'menu' | 'vigil' | 'king' | 'crawl' | 'hang' | 'beneath' | 'eclipse' | 'morning' | 'ferry' | 'hours' | 'pall' | 'pall2' | 'region' | 'hub';
/** `start` is where it comes in, `from` where a loop picks up, `end` where it lets go, `xf` the overlap in seconds (0: plays once). */
export const LIST: Record<TrackName, { start: number; from: number; end: number; xf: number }> = {
  menu: { start: 0, from: 0, end: 81.0, xf: 0.3 }, vigil: { start: 0, from: 0, end: 53, xf: 0 }, king: { start: 0, from: 15.2, end: 87, xf: 3 }, crawl: { start: 18, from: 0, end: 107.9, xf: 0.25 },
  hang: { start: 0, from: 0, end: 40.5, xf: 3 }, beneath: { start: 0, from: 0, end: 123.3, xf: 0.2 }, eclipse: { start: 0, from: 0, end: 124.1, xf: 0.2 }, morning: { start: 0, from: 0, end: 83, xf: 5 },
  // pieces of their own for the river and the Waiting House: used when public/music/<name>.mp3 is there (end 0: loop at the file's own length)
  ferry: { start: 0, from: 0, end: 0, xf: 2 }, hours: { start: 0, from: 0, end: 0, xf: 2 }, pall: { start: 0, from: 0, end: 0, xf: 2 }, pall2: { start: 0, from: 0, end: 0, xf: 2 },
  // module K: the Ashfields (Junkala, "Sneaking Around") and the Last Pyre (Junkala, "Home Town"); the whole piece, looped with a 3 s overlap
  region: { start: 0, from: 0, end: 0, xf: 3 }, hub: { start: 0, from: 0, end: 0, xf: 3 },
};
const SILENCE = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
interface Deck { el: HTMLAudioElement; g: GainNode; lp: BiquadFilterNode; name: TrackName | null; level: number; stopAt: number; /** Being slowed to a halt: since when, over how long. */ tape?: [number, number] }

export class Tracks {
  private ctx: AudioContext; private decks: Deck[] = []; private urls = new Map<TrackName, string>(); private cur: Deck | null = null; private want = { gain: 1, lp: 20000 }; private primed = false; private started = false;
  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    for (let i = 0; i < 3; i++) { const el = new Audio(); el.preload = 'auto'; (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true; el.src = SILENCE; const s = ctx.createMediaElementSource(el), g = ctx.createGain(), lp = ctx.createBiquadFilter(); g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 20000; s.connect(lp).connect(g).connect(out); this.decks.push({ el, g, lp, name: null, level: 0, stopAt: 0 }); }
  }
  /** One after another, in the order they are needed. Until a piece has arrived the synthesised score stands in. */
  async load() { if (this.started) return; this.started = true; for (const n of Object.keys(LIST) as TrackName[]) try { const r = await fetch(`${import.meta.env.BASE_URL}music/${n}.mp3?v=${__V__}`); if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) this.urls.set(n, URL.createObjectURL(await r.blob())); } catch { /* offline: the synthesised score carries on */ } }
  has(n: TrackName) { return this.urls.has(n); }
  get playing() { return this.cur?.name ?? null; }
  /** From a tap or key: phones only let a player speak later if it was touched once by hand. */
  prime() { if (this.primed) return; this.primed = true; for (const d of this.decks) if (!d.name) void d.el.play().catch(() => { this.primed = false; }); }
  private ramp(p: AudioParam, v: number, tc: number) { p.cancelScheduledValues(this.ctx.currentTime); p.setTargetAtTime(v, this.ctx.currentTime, tc); }
  private put(n: TrackName, at: number, fade: number) {
    const now = this.ctx.currentTime, d = this.decks.filter(x => x !== this.cur).sort((a, b) => a.stopAt - b.stopAt)[0]; const url = this.urls.get(n)!; d.tape = undefined; d.el.playbackRate = 1;
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
    if (this.cur) { this.drop(this.cur, fade); this.cur = null; } if (n && this.has(n)) this.cur = this.put(n, at >= 0 ? at : LIST[n].start, n === 'beneath' || n === 'eclipse' ? 0.1 : fade);
  }
  /** A hand on the record. */
  stopTape(secs: number) { const d = this.cur; if (!d) return; (d.el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false; d.tape = [this.ctx.currentTime, secs]; this.cur = null; this.ramp(d.lp.frequency, 300, secs * 0.4); d.g.gain.cancelScheduledValues(this.ctx.currentTime); d.g.gain.setTargetAtTime(0, this.ctx.currentTime + secs * 0.55, secs * 0.16); d.stopAt = this.ctx.currentTime + secs * 1.5; }
  update() {
    const now = this.ctx.currentTime; for (const d of this.decks) if (d.tape) { const u = (now - d.tape[0]) / d.tape[1]; d.el.playbackRate = Math.max(0.2, 1 - 0.8 * Math.min(1, u) ** 0.8); if (u > 1.5) d.tape = undefined; }
    for (const d of this.decks) if (d.stopAt && now > d.stopAt) { d.el.pause(); d.stopAt = 0; d.name = null; d.el.playbackRate = 1; (d.el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true; }
    const c = this.cur; if (!c?.name) return; const T = LIST[c.name], t = c.el.currentTime, end = T.end || (isFinite(c.el.duration) ? c.el.duration : 1e9); if (c.el.paused && this.primed) void c.el.play().catch(() => { });
    if (T.xf && t > end - T.xf) { const old = c; this.cur = this.put(c.name, T.from, T.xf); this.drop(old, T.xf); }
  }
  /** The page was hidden or shown again. */
  hush(on: boolean) { if (on) { for (const d of this.decks) d.el.pause(); } else this.resync(); }
  /** After the page was hidden or the audio was interrupted: the piece that was playing plays again, once (a playing element is left alone, so nothing doubles), and a piece that was fading out stays silent. */
  resync() {
    for (const d of this.decks) if (d !== this.cur && d.stopAt) { d.el.pause(); d.stopAt = 0; d.name = null; d.el.playbackRate = 1; d.g.gain.cancelScheduledValues(this.ctx.currentTime); d.g.gain.setValueAtTime(0, this.ctx.currentTime); }
    const c = this.cur; if (c?.name && this.primed && c.el.paused) void c.el.play().catch(() => { /* waits for a tap */ });
  }
}
