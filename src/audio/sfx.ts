// Placeholder synthesised effects: enough for hits and cues to read. The full mix and score are M7.
let ac: AudioContext | null = null, out: GainNode, noise: AudioBuffer;
let muted = false;
const LEVEL = 1.5; // checked with tools/sfx.mjs
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
  try {
    ac = new AudioContext(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; out = ac.createGain(); out.gain.value = muted ? 0 : LEVEL; out.connect(comp).connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}
export function setMuted(m: boolean) { muted = m; if (ac) out.gain.value = m ? 0 : LEVEL; }
export const isMuted = () => muted;

function env(g: GainNode, at: number, a: number, peak: number, dur: number) { g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); }
/** Filtered noise sweep. */
function hiss(type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, dur: number, delay = 0, attack = 0.004) {
  if (!ac) return; const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, attack, peak, dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
function tone(type: OscillatorType, f0: number, f1: number, peak: number, dur: number, delay = 0, attack = 0.003) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur); env(g, t, attack, peak, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
/** Inharmonic partials: struck metal. */
function steel(base: number, peak: number, dur: number) { [1, 2.76, 5.4, 8.93].forEach((m, i) => tone('sine', base * m * (0.99 + Math.random() * 0.02), base * m * 0.995, peak / (1 + i * 0.8), dur / (1 + i * 0.5))); }
const r = (a: number, b: number) => a + Math.random() * (b - a);

export const sfx = {
  swing: (p: number) => hiss('bandpass', r(700, 900) / Math.sqrt(p), r(2400, 3000) / Math.sqrt(p), 1.1, 0.5 + 0.16 * p, 0.22 + 0.05 * p, 0, 0.05),
  hit: (p: number) => { hiss('lowpass', 2600, 240, 0.8, 0.5 + 0.1 * p, 0.14 + 0.05 * p); tone('sine', 150 / Math.sqrt(p), 42, 0.5 + 0.14 * p, 0.2 + 0.06 * p); hiss('bandpass', r(2500, 3600), 1200, 1.6, 0.6, 0.08); hiss('bandpass', 900, 380, 1.2, 0.55, 0.12); if (p > 1.8) { tone('triangle', 74, 28, 0.7, 0.5); hiss('lowpass', 900, 80, 0.7, 0.5, 0.5); } },
  hurt: () => { tone('sine', 120, 40, 0.8, 0.26); hiss('lowpass', 1500, 160, 0.9, 0.6, 0.2); },
  block: () => { steel(r(380, 440), 0.3, 0.4); hiss('highpass', 2600, 5200, 0.6, 0.35, 0.09); tone('sine', 110, 50, 0.45, 0.2); },
  parry: () => { steel(720, 0.42, 1.1); steel(1085, 0.22, 0.9); hiss('highpass', 4200, 8000, 0.6, 0.45, 0.12); tone('sine', 85, 34, 0.7, 0.5); },
  dodge: () => hiss('bandpass', 420, 1500, 0.8, 0.85, 0.36, 0, 0.06),
  perfect: () => { tone('sine', 300, 1200, 0.3, 0.5); hiss('bandpass', 5000, 600, 3, 0.2, 0.6); },
  cueWhite: () => { [2350, 3140].forEach((f, i) => tone('sine', f, f * 0.985, 0.6 - i * 0.15, 0.42)); hiss('highpass', 5000, 9000, 0.7, 0.35, 0.1); },
  cueRed: () => { tone('sawtooth', 70, 47, 0.42, 0.85, 0, 0.03); tone('sawtooth', 311, 208, 0.2, 0.7, 0, 0.02); tone('sawtooth', 330, 220, 0.18, 0.7, 0, 0.02); /* clashing pair up high: small speakers can't play the rest */ tone('square', 104, 69, 0.14, 0.7, 0, 0.02); hiss('lowpass', 260, 90, 3, 0.5, 0.8, 0, 0.05); },
  vanish: () => { hiss('bandpass', 2600, 260, 0.9, 0.8, 0.45, 0, 0.01); tone('sine', 420, 70, 0.22, 0.34); },
  boom: () => { tone('sine', 92, 24, 1.0, 1.1); hiss('lowpass', 2400, 60, 0.6, 0.9, 1.2); for (let i = 0; i < 6; i++) hiss('lowpass', r(900, 1800), 120, 0.8, 0.28, 0.3, i * 0.045); },
  erupt: () => { tone('sine', 78, 26, 0.9, 0.8); hiss('lowpass', 1800, 70, 0.7, 0.75, 0.8); },
  thud: () => { tone('sine', 66, 26, 0.9, 0.55); hiss('lowpass', 500, 60, 0.8, 0.6, 0.5); },
  flare: () => hiss('bandpass', 300, 1400, 0.7, 0.5, 0.5, 0, 0.12),
  heal: () => { hiss('bandpass', 300, 1800, 0.8, 0.28, 0.8, 0, 0.3); [196, 294, 392].forEach((f, i) => tone('triangle', f, f * 1.005, 0.09, 0.9, i * 0.07, 0.1)); },
  ready: () => { tone('triangle', 440, 660, 0.28, 0.5); hiss('bandpass', 700, 2000, 1, 0.35, 0.4, 0, 0.1); },
  deny: () => tone('square', 150, 110, 0.16, 0.12),
  die: () => { tone('sine', 110, 28, 0.6, 2.2, 0, 0.1); hiss('lowpass', 700, 60, 0.8, 0.3, 2.4, 0, 0.3); },
};
