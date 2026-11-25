// The mixer: buses, court reverb, positions, ducking, and a low-pass that closes with slow motion.
import { onSettings, settings } from '../core/settings.ts';
import { Score } from './score.ts';
import { Tracks } from './tracks.ts';

/** Tuned to the score: never detuned at random. */
const EXACT = /^(doom|drop|braam|rise|riser|swell|barFill|aura|finalCut|ritesCut|uiGo|die|heart|break|parry|perfect)/;
type Bus = 'sfx' | 'voice' | 'amb' | 'music';
export interface Play { x?: number; z?: number; gain?: number; rate?: number; delay?: number; wet?: number; bus?: Bus }
class Sound {
  ctx: AudioContext | null = null; bufs = new Map<string, AudioBuffer>(); private variants = new Map<string, number>(); private last = new Map<string, number>(); private pending: { n: string; x: Float32Array; sr: number }[] = []; private ir: Float32Array[] | null = null;
  private master!: GainNode; private lp!: BiquadFilterNode; private rev!: GainNode; bus!: Record<Bus, GainNode>; private duckG!: GainNode; private loops = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
  /** Recorded music. */ tracks: Tracks | null = null; muted = false; loaded = false; score: Score | null = null; private ear = { x: 0, z: 0, yaw: 0 }; private started = false; /** Designed sounds from the pack, and how much silence the decoder left in front of each. */ private real = new Map<string, number>(); private recent: number[] = [];
  /** Begin synthesis at once; nothing is heard until a tap. */
  load() { if (this.started || typeof Worker === 'undefined') return; this.started = true; this.unlock(); void this.tracks?.load(); void this.pack().then(() => this.synth()); }
  private async pack() {
    const c = this.ctx; if (!c) return;
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}sfx/sfx.pak?v=${__V__}`); if (!r.ok) return; const b = await r.arrayBuffer(), n = new DataView(b).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 4, n))) as [string, number, number][]; let at = 4 + n; const jobs: [string, ArrayBuffer, number][] = head.map(([k, len, frames]) => { const x = b.slice(at, at + len); at += len; return [k, x, frames]; });
      const fam = new Map<string, number>(); for (const [k] of jobs) { const m = /^(.*?)(\d+)$/.exec(k); if (m) fam.set(m[1], Math.max(fam.get(m[1]) ?? 0, +m[2] + 1)); }
      // a few at a time: decoding must not stall the title screen
      const next = async () => { for (let j = jobs.shift(); j; j = jobs.shift()) { const a = await c.decodeAudioData(j[1]); this.bufs.set(j[0], a); this.real.set(j[0], Math.max(0, a.length / c.sampleRate - j[2] / 44100) > 0.02 ? 1105 / 44100 : 0); } };
      await Promise.all([next(), next(), next()]); for (const [k, v] of fam) this.variants.set(k, v);
    } catch { /* the synthesised set stands in */ }
  }
  private synth() { /* opened now, silent until a tap resumes it: opening a device mid-fight stalls */ try { const w = new Worker(new URL('./bank.worker.ts', import.meta.url), { type: 'module' }); w.onmessage = e => { const d = e.data; if (d.ir) { this.ir = d.ir; this.reverb(); } else if (d.n) { this.pending.push(d); this.flush(); } else if (d.done) { this.loaded = true; w.terminate(); } }; w.onerror = () => { this.loaded = true; }; w.postMessage([...this.real.keys()].map(k => k.replace(/\d+$/, ''))); } catch { this.loaded = true; } }
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => { }); this.tracks?.prime(); return; }
    try {
      const c = this.ctx = new AudioContext(), g = (v: number, to: AudioNode) => { const n = c.createGain(); n.gain.value = v; n.connect(to); return n; };
      const clip = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); } clip.curve = cv; clip.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18; comp.connect(clip);
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.connect(comp); this.master = g(this.muted ? 0 : 0.9, this.lp);
      this.duckG = g(1, this.master); this.bus = { sfx: g(0.68, this.master), voice: g(0.6, this.master), amb: g(0.32, this.duckG), music: g(0.32, this.duckG) };
      this.tracks = new Tracks(c, this.bus.music); document.addEventListener('visibilitychange', () => this.tracks?.hush(document.hidden));
      onSettings(() => this.volumes());
      this.rev = g(0.2, this.master); this.reverb(); this.flush();
    } catch { this.ctx = null; }
  }
  private conv: ConvolverNode | null = null;
  private reverb() { if (!this.ctx || !this.ir || this.conv) return; const b = this.ctx.createBuffer(2, this.ir[0].length, this.ctx.sampleRate); b.copyToChannel(this.ir[0] as Float32Array<ArrayBuffer>, 0); b.copyToChannel(this.ir[1] as Float32Array<ArrayBuffer>, 1); this.conv = this.ctx.createConvolver(); this.conv.buffer = b; this.conv.connect(this.rev); }
  private flush() { if (!this.ctx) return; for (const p of this.pending) { const fam = p.n.replace(/\d+$/, ''); if (this.real.has(p.n) || this.real.has(fam) || this.real.has(fam + '0')) continue; const b = this.ctx.createBuffer(1, p.x.length, p.sr); b.copyToChannel(p.x as Float32Array<ArrayBuffer>, 0); this.bufs.set(p.n, b); const base = p.n.replace(/\d+$/, ''); if (base !== p.n) this.variants.set(base, Math.max(this.variants.get(base) ?? 0, +p.n.slice(base.length) + 1)); } this.pending.length = 0; }
  /** 0.8 on the slider is the mix as made. */
  private volumes() { if (!this.ctx) return; const t = this.ctx.currentTime, s = settings.sfx / 0.8, m = settings.music / 0.8; for (const [b, v] of [['sfx', 0.68 * s], ['voice', 0.6 * s], ['amb', 0.32 * s], ['music', 0.32 * m]] as const) this.bus[b].gain.setTargetAtTime(v, t, 0.05); }
  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }
  listen(x: number, z: number, yaw: number) { this.ear = { x, z, yaw }; }
  play(name: string, o: Play = {}) {
    const c = this.ctx; if (!c || c.state !== 'running') return; let n = name; const v = this.variants.get(name);
    if (v) { let k = Math.floor(Math.random() * v); if (v > 1 && k === this.last.get(name)) k = (k + 1) % v; this.last.set(name, k); n = name + k; }
    const b = this.bufs.get(n); if (!b) return; const now = c.currentTime; this.recent = this.recent.filter(t => now - t < 0.5); if (this.recent.length > 26) return; this.recent.push(now);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = (o.rate ?? 1) * (o.bus === 'music' || EXACT.test(name) ? 1 : 0.965 + Math.random() * 0.07); let gain = o.gain ?? 1, pan = o.bus === 'music' ? 0 : (Math.random() - 0.5) * 0.14, wet = (o.wet ?? 0.35) * (this.real.has(n) ? 0.35 : 1);
    if (o.x !== undefined && o.z !== undefined) { const dx = o.x - this.ear.x, dz = o.z - this.ear.z, d = Math.hypot(dx, dz); pan = d > 0.3 ? pan + Math.max(-0.8, Math.min(0.8, (dx * Math.cos(this.ear.yaw) - dz * Math.sin(this.ear.yaw)) / d * Math.min(1, d / 4))) : 0; gain *= 1 / (1 + Math.max(0, d - 4) * 0.055); wet += Math.min(0.5, d * 0.02); }
    g.gain.value = gain; const p = c.createStereoPanner(); p.pan.value = pan; s.connect(g).connect(p); p.connect(this.bus[o.bus ?? 'sfx']); if (this.conv && wet > 0) { const w = c.createGain(); w.gain.value = wet; p.connect(w).connect(this.conv); }
    s.start(now + (o.delay ?? 0), this.real.get(n) ?? 0); return s;
  }
  /** A bed that fades in and out. */
  bed(name: string, gain: number, bus: Bus = 'amb', rate = 1, tc = 0.6) {
    const c = this.ctx; if (!c) return; let l = this.loops.get(name); const b = this.bufs.get(name);
    if (!l) { if (!b || gain <= 0) return; const src = c.createBufferSource(), g = c.createGain(); src.buffer = b; src.loop = true; if (this.real.has(name)) { src.loopStart = 0.2 + this.real.get(name)!; src.loopEnd = src.loopStart + Math.floor(b.duration - 0.4); } g.gain.value = 0; src.connect(g).connect(this.bus[bus]); src.start(); l = { src, g }; this.loops.set(name, l); }
    l.g.gain.setTargetAtTime(gain, c.currentTime, tc); l.src.playbackRate.setTargetAtTime(rate, c.currentTime, 0.4);
  }
  duck(to: number, secs: number) { if (!this.ctx) return; const g = this.duckG.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(to, t, 0.02); g.setTargetAtTime(1, t + secs, 0.35); }
  /** Everything, tails and all, held for a moment. */
  hush(secs: number) { if (!this.ctx || this.muted) return; const g = this.master.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.012); g.setValueAtTime(0.9, t + secs); }
  /** 0 normal, 1 fully slowed: the world goes under water. */
  slow(k: number) { if (this.ctx) this.lp.frequency.setTargetAtTime(20000 * Math.pow(0.032, Math.max(0, Math.min(1, k))), this.ctx.currentTime, 0.04); }
  startScore() { if (!this.score && this.ctx) this.score = new Score(this); }
}
export const sound = new Sound();
