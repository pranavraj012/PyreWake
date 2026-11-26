// The turn: a false victory, then what was inside it. Skippable; ends as round 2's checkpoint.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { Fight } from '../combat/fight.ts';
import { Lens, type SceneKit } from './scenes.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const TURN_LEN = 27.6;
/** The body goes; then the world runs slow; then the arms find their places, each on its own beat. */
const BURST = 15.6, SLOW = 1.15, RATE = 0.2, real = (clip: number) => BURST + SLOW + clip - SLOW * RATE, ARMS = [real(1.4), real(2.0), real(2.45)], ROAR = real(2.95);
export class Turn {
  t = -1; omen = 0; /** Warmth of a victory that isn't one. */ dawn = 0; /** Colour drained, 0-1. */ mono = 0; /** Height of the pyres. */ flame = 1; /** Exposure, and light thrown over everything. */ dim = 1; flash = 0; /** To black. */ dark = 0; /** How fast the world runs. */ rate = 1;
  private done = new Set<string>(); private A = { k: V(), d: V() }; private burst = false; private lens = new Lens(); private ring = 0;
  private kit: SceneKit; private dis: { value: number };
  constructor(kit: SceneKit, dis: { value: number }) { this.kit = kit; this.dis = dis; }
  onEnd: () => void = () => { };
  get active() { return this.t >= 0; }
  private rest() { this.omen = this.dawn = this.mono = this.flash = this.dark = 0; this.flame = this.dim = this.rate = 1; }
  start() { this.t = 0; this.off = false; this.done.clear(); this.burst = false; this.rest(); this.ring = 0; this.lens.cut = 0; const { m, king: k } = this.kit.f; this.A.k.set(k.x, 0, k.z); this.A.d.set(m.x - k.x, 0, m.z - k.z).normalize(); if (Math.hypot(m.x - k.x, m.z - k.z) < 3) { m.revive(k.x + this.A.d.x * 3, k.z + this.A.d.z * 3, Math.atan2(-this.A.d.x, -this.A.d.z)); this.kit.pv.reset(); } document.body.classList.add('cine'); sound.play('kDeath', { x: k.x, z: k.z, bus: 'voice', gain: 1 }); sound.play('doom', { gain: 0.8 }); sound.duck(0.15, 2); sound.score?.set('scene'); }
  private off = false; private at(t: number, id: string, f: () => void) { if (this.t >= t && !this.done.has(id)) { this.done.add(id); if (!this.off) f(); } }
  /** Straight to the end state. */
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.kit.hud.verse(''); this.kit.f.king.mt = this.kit.f.king.prev = 4.6; this.off = true; this.t = TURN_LEN; }
  /** What it costs the court. Each call brings down what is left up to this step. */
  private wreck(n: number) { const { f } = this.kit; for (const p of f.props) { if (p.kind === 'lamp' && p.z < -1) { if (n >= 2) f.drop(p, 0, -3); } else if (p.kind === 'pillar' && p.z < -12) { const i = p.x < -3 ? 0 : p.x > 3 ? 1 : 2; if (n >= 3 + i) f.fell(p, Math.atan2(-p.x, -p.z) + (i === 0 ? 0.5 : i === 1 ? -0.5 : 0.25)); } } }
  private become() {
    if (this.burst) return; this.burst = true; const { f, k1, k2 } = this.kit, { king: k, m } = f; k1.show(false); this.dis.value = 0; k.form = 2; k.armed = false; k.crawling = false; k.set('rise2'); k.x = 0; k.z = -3; k.y = 0; k.yaw = 0; k2.show(true); k2.settle(); this.wreck(2); if (Math.hypot(m.x, m.z - 4.6) > 0.8) { m.revive(0, 4.6, Math.PI); this.kit.pv.reset(); }
  }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const { t } = this, { f, fx, pv, k1, hud } = this.kit, { m, king: k } = f, L = this.lens, here = { x: 0, z: -3 }; L.trauma *= Math.exp(-dt * 2.6); this.mono *= Math.exp(-dt * 1.1); this.flash *= Math.exp(-dt * 4.5);
    if (!this.burst && (k.mode === 'fall' || k.mode === 'crash') && k.mt > 2.6) k.mt = k.prev = 2.6;

    // --- it looks, and sounds, exactly like the end
    this.dawn = 0.6 * E(2.8, 5, t) * (1 - E(7.1, 7.5, t));
    this.at(2.6, 'relocate', () => { k.x = 0; k.z = -3; k.yaw = 0; k.set('fall'); k.mt = k.prev = 2.6; m.revive(0, 1.6, 0); pv.reset(); k1.settle(); sound.score?.set('won'); });
    this.at(3.3, 'title', () => { hud.say('The Long Night Breaks', 3.3, 'victory', 'The King has fallen, and the sky goes grey.'); sound.play('uiGo', { gain: 0.5, wet: 0.5 }); });
    f.sceneMove.z = t > 2.7 && t < 7.2 ? 0.4 : 0; f.sceneMove.x = 0;
    this.at(5.5, 'lift', () => { k.set('hang'); k.ht = 0; k.dir = 0; sound.play('creak', { ...here, gain: 0.35 }); }); // behind him, out of his sight

    // --- the music dies like a hand laid on it, and the fires go with it, one by one
    this.at(7.2, 'stop', () => { sound.tracks?.stopTape(1.3); sound.score?.set('scene'); sound.play('drop', { gain: 0.9 }); pv.ember = 1.8; });
    for (const [i, at] of [7.7, 8.15, 8.6].entries()) this.at(at, 'out' + i, () => { sound.play('vanish', { gain: 0.65, rate: 0.62 - i * 0.07, x: (i - 1) * 9, z: -8 }); L.trauma = Math.max(L.trauma, 0.22); });
    this.flame = t < 7.7 ? 1 : t < BURST ? [0.62, 0.3, 0.03][t < 8.15 ? 0 : t < 8.6 ? 1 : 2] : 1 + 0.9 * Math.exp(-(t - BURST) * 0.5); this.dim = t > 7.7 && t < BURST ? 1 - 0.48 * E(7.7, 9, t) : 1;
    this.at(8.4, 'v0', () => hud.verse('The fires go out. Behind you, the rope is creaking again.')); this.at(12.0, 'v0x', () => hud.verse(''));
    this.at(8.0, 'whisper', () => sound.play('whisper', { gain: 1 })); this.at(8.9, 'creak', () => sound.play('creak', { ...here, gain: 0.9 }));
    for (const [i, at] of [8.5, 9.3, 10.0, 10.6, 11.1, 11.5, 11.85].entries()) this.at(at, 'h' + i, () => sound.play('heart', { gain: 0.8 + i * 0.05 }));
    if (t > 9.2 && t < 10.5) m.yaw += (Math.PI - m.yaw) * Math.min(1, dt * 6);
    this.omen = t > 9.6 ? 0.55 * E(9.8, 13.6, t) + 0.45 * E(ROAR - 0.1, ROAR + 1.1, t) : 0;
    this.at(9.75, 'groan', () => sound.play('groan', { ...here, gain: 1 })); this.at(10.9, 'seen', () => { sound.play('doom', { gain: 1 }); L.trauma = 0.3; });
    if (k.hanging) { k.th = Math.sin((t - 5) * 1.5) * 0.05 + (t > 12.3 ? Math.sin(t * 31) * 0.014 * E(12.3, 15.3, t) : 0); }

    // --- and it begins to open
    this.at(12.0, 'build', () => { sound.play('riserL', { gain: 1 }); }); this.at(12.5, 'tear', () => { sound.play('tear', { ...here, gain: 1 }); sound.play('kScreech', { ...here, bus: 'voice', gain: 0.8, rate: 0.9 }); });
    if (t > 12.6 && t < 15.35 && !this.burst) { const u = E(12.8, 15.4, t); this.dis.value = u * 0.62; L.trauma = Math.max(L.trauma, 0.25 + u * 0.45); const h = k1.hurt(V()); if (Math.random() < 0.85) { fx.gore.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0, 1), 6, 3.4, 1.8, 0.9, time); fx.sparks.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0.3, 0.6), 5, 2.8, 2, -1.2, time); } }
    for (const [i, at] of [13.15, 13.85, 14.4, 14.8, 15.1].entries()) this.at(at, 'pulse' + i, () => { sound.play('fleshH', { gain: 1, ...here, rate: 0.82 }); sound.play('doom', { gain: 0.55 + i * 0.1 }); L.trauma = 0.85; this.flash = Math.max(this.flash, 0.04 + i * 0.02); const h = k1.hurt(V()); fx.gore.emit(V(h.x, h.y + 1.4, h.z), V(0, 0.2, 1), 34, 5, 1.8, 1, time); if (i !== 2 && i !== 4) fx.bursts.add('fire', V(h.x, h.y + 1.3, h.z), 1.0 + i * 0.25, 0.4, time, i); });
    // a held breath: nothing at all
    this.dark = t > 15.34 && t < BURST ? 1 : 0; this.at(15.32, 'hush', () => sound.hush(0.26));
    this.rate = t > BURST && t < BURST + SLOW ? RATE : 1;
    this.at(BURST, 'burst', () => {
      this.become(); this.mono = 1; this.flash = 1.4; const c = V(0, 2, -3); for (let i = 0; i < 6; i++) fx.bursts.add('fire', c.clone().add(V((Math.random() - 0.5) * 2, Math.random() * 1.6 - 0.4, 0)), 4, 1.0, time + i * 0.03, i); fx.bursts.add('flare', c, 12, 0.5, time); fx.bursts.add('ring', c, 9, 0.7, time, 0, 1.6, 1.0, 0.5); fx.bursts.add('ground', V(0, 0.06, -3), 16, 1.0, time); fx.sparks.emit(c, V(0, 0.4, 0.3), 200, 8, 2.2, 1, time); fx.sparks.emit(c, V(0, 0.2, 0), 80, 3, 2.4, -2, time); fx.gore.emit(c, V(0, 0.3, 0.4), 120, 7, 2, 1.2, time); fx.puffs.emit(V(0, 0, -3), 18, 3.8, 1.9, time);
      pv.boomAt.set(0, 2, -3); pv.boomK = 1.4; L.trauma = 1; sound.play('boom', { gain: 1 }); sound.play('break', { gain: 0.8 }); sound.play('braam', { gain: 0.95 }); m.moveYaw = m.yaw; m.begin('down');
    });
    this.at(BURST + 1.3, 'verse', () => hud.verse('He was only what it wore.')); this.at(ROAR - 0.7, 'verseOff', () => hud.verse(''));
    this.at(BURST + 1.25, 'br', () => sound.play('kBreath', { ...here, bus: 'voice', gain: 1.5, rate: 0.7 }));
    // --- one pair of arms after another. The sound starts before the joint does: it has to be drawn in first.
    ARMS.forEach((at, i) => {
      this.at(at - 0.42, 'draw' + i, () => sound.play('rise' + i, { gain: 1 }));
      this.at(at, 'arm' + i, () => { L.trauma = Math.max(L.trauma, 0.6 + i * 0.14); this.flash = Math.max(this.flash, 0.08 + i * 0.04); this.ring = i + 1; this.wreck(3 + i); fx.sparks.emit(V(0, 1.3, -3), V(0, 0.6, 0), 40, 4, 2.4, -1, time); fx.puffs.emit(V(0, 0, -3), 8, 2.4, 1.2, time); fx.bursts.add('ground', V(0, 0.06, -3), 5 + i * 3, 0.7, time); for (let q = 0; q < 8; q++) { const a = q / 8 * 6.283 + i * 0.4, r = 3.4 + i * 1.7; fx.bursts.add('pillar', V(Math.cos(a) * r, 0, -3 + Math.sin(a) * r), 2.2 + i * 0.5, 0.8, time + q * 0.012); } });
    });
    this.at(ROAR - 0.75, 'breathIn', () => sound.play('swell', { gain: 1 }));
    this.at(ROAR, 'roar', () => { sound.play('bRoar', { bus: 'voice', gain: 1.1, ...here }); sound.play('braam', { gain: 0.8 }); sound.play('doom', { gain: 1 }); sound.score?.set('reveal'); hud.say('The One Beneath', 3.8, 'title'); this.flash = 0.5; });
    this.at(ROAR + 0.15, 'shock', () => { fx.bursts.add('ground', V(0, 0.06, -3), 30, 1.3, time); for (let w = 0; w < 2; w++) for (let i = 0; i < 9; i++) { const a = Math.PI + (i - 0.5) / 8 * Math.PI; fx.bursts.add('pillar', V(Math.cos(a) * (4 + w * 3), 0, -3.4 + Math.sin(a) * (4 + w * 3)), 2.8 + w, 0.9, time + 0.05 + w * 0.12); } fx.sparks.emit(V(0, 1.5, -3), V(0, 0.5, 0), 180, 9, 2.4, -2.4, time); fx.puffs.emit(V(0, 0, -1), 16, 4, 1.8, time); sound.play('fire', { gain: 1 }); sound.play('erupt', { gain: 0.7 }); m.moveYaw = m.yaw; m.begin('block'); });
    if (t > ROAR && t < ROAR + 2.4) L.trauma = Math.max(L.trauma, 0.75 * (1 - E(ROAR + 1, ROAR + 2.4, t)));
    this.at(TURN_LEN - 2.7, 'draw', () => { m.begin('flick'); sound.play('sheathe', { gain: 0.7 }); pv.ember = 1.8; });
    this.at(TURN_LEN - 2.2, 'lit', () => { sound.play('aura2', { gain: 0.9 }); pv.ember = 2; pv.boomAt.set(m.x, 1.3, m.z); pv.boomK = 0.4; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; fx.bursts.add('pillar', V(m.x + Math.cos(a) * 0.9, 0, m.z + Math.sin(a) * 0.9), 1.1, 0.7, time + i * 0.015); } });
    if (t >= TURN_LEN) { this.become(); this.wreck(5); this.t = -1; this.rest(); this.omen = 1; this.dis.value = 0; document.body.classList.remove('cine'); if (k.mode === 'rise2') k.set('idle'); f.beginRound2(); this.onEnd(); sound.score?.set('r2'); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const t = this.t, m = this.kit.f.m, L = this.lens, go = (n: number, p: THREE.Vector3, l: THREE.Vector3, f: number, roll = 0) => L.aim(cam, n, p, l, f, time, roll);
    if (t < 2.6) { const u = t / 2.6, d = this.A.d, s = V(d.z, 0, -d.x), p = this.A.k.clone().addScaledVector(d, 4.4 - u * 0.6).addScaledVector(s, 2.6).setY(0.75); go(1, p, this.A.k.clone().setY(1.7 - u * 0.7).addScaledVector(d, 0.7), 44, 0.03 * u); }
    else if (t < 7.2) { const u = E(2.6, 7.2, t); go(2, V(0.75 - 0.2 * u, 1.0 + 0.35 * u, m.z + 3.4 - u * 0.9), V(-0.12, 1.4, m.z - 2), 38); }
    else if (t < 9.6) { const u = (t - 7.2) / 2.4; go(3, V(0.34 - u * 0.16, 1.56, m.z + 1.05 - u * 0.26), V(0.02, 1.57, m.z), 33 - u * 4); }
    else if (t < 12.5) { const u = E(9.6, 12.5, t); go(4, V(0.95 - u * 0.25, 1.2 - u * 0.35, m.z + 1.9 - u * 0.5), V(0, 2.2 + u * 1.1, -3), 48 - u * 6, -0.06 * u); }
    // in close, then back out as it goes, each time nearer
    else if (t > 13.1 && t < 13.6) { go(51, V(0.9, 2.2, -1.3), V(0, 2.9, -3), 26, 0.12); }
    else if (t > 14.35 && t < 14.75) { go(52, V(-0.8, 3.4, -1.2), V(0, 3.2, -3), 24, -0.16); }
    else if (t > 15.05 && t < BURST) { go(55, V(0.5, 2.6, -1.5), V(0, 2.9, -3), 20, 0.2); }
    else if (t < BURST) { const u = E(12.5, 15.3, t); go(t < 13.2 ? 5 : t < 14.5 ? 53 : 54, V(1.0 - u * 0.5, 1.7 + u * 0.25, 1.0 - u * 0.9), V(0, 2.5 + u * 0.3, -3), 42 - u * 8, 0.03 * Math.sin(t * 5) * u); }
    // thrown back, in front of it, slowly
    else if (t < BURST + SLOW + 0.1) { const u = E(BURST, BURST + SLOW, t); go(61, V(1.9 - u * 0.7, 0.45 + u * 0.15, m.z + 3.3 - u * 0.6), V(0.25, 1.5, 0), 48 - u * 4, -0.04); }
    else if (t < ROAR - 0.1) { const a = BURST + SLOW + 0.1, u = E(a, ROAR, t), hit = ARMS.reduce((q, w) => q + (t > w ? Math.exp(-(t - w) * 6) : 0), 0), up = E(ARMS[1], ROAR, t); go(6, V(2.6 - u * 0.9 - this.ring * 0.12, 0.4 + u * 0.15, 1.0 + up * 0.9), V(0, 0.9 + u * 0.25 + up * 1.0, -3), 42 - hit * 7, 0.05 * hit * (this.ring % 2 ? 1 : -1)); }
    else if (t < ROAR + 3.2) { const u = E(ROAR, ROAR + 3.2, t), rush = E(ROAR, ROAR + 0.35, t); go(7, V(0.55 - u * 0.4, 0.5 + u * 0.1, 2.8 - rush * 1.7 + u * 1.5), V(0, 2.35 - u * 0.1, -3), 54 - rush * 4, 0.04 * (1 - u)); }
    else if (t < TURN_LEN - 2.9) { const u = E(ROAR + 3.2, TURN_LEN - 2.9, t); go(8, V(-1.5 + u * 0.5, 0.45, m.z + 3.6 - u * 0.4), V(0.2, 2.1 + u * 0.3, -5), 44, -0.03); }
    else { const u = E(TURN_LEN - 2.9, TURN_LEN, t); go(9, V(0.5 + 0.1 * u, 1.0 + 0.5 * u, m.z + 2.6 + 1.6 * u), V(0.05, 1.6, -3), 46); }
  }
}

/** Short composed shots inside the fight. Returns false when the normal camera should run. */
export function actionCam(cam: THREE.PerspectiveCamera, f: Fight, hero: number, base: number): boolean {
  const { m, king: k } = f, c = m.clip?.name, dx = k.hx - m.x, dz = k.hz - m.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, sx = fz, sz = -fx;
  let px = 0, py = 0, pz = 0, lx = 0, ly = 0, lz = 0, fov = base;
  if (c === 'rites' && m.t < 4.5) {
    const r = m.ritesFrom, gx = -Math.sin(r.a), gz = -Math.cos(r.a), hx = gz, hz = -gx, far = Math.hypot(r.x - k.hx, r.z - k.hz) > 15; // g: from where he stood, toward it
    if (m.t < 0.95) { const u = E(0, 0.95, m.t); const ah = Math.min(1.0, Math.max(0, d - 2.2)); px = m.x + gx * ah + hx * (2.5 - u * 0.5); pz = m.z + gz * ah + hz * (2.5 - u * 0.5); py = 1.15 + u * 0.1; lx = m.x + gx * 0.2; lz = m.z + gz * 0.2; ly = 1.3; fov = 38; }
    else if (m.t < 1.92) { const u = E(0.95, 1.92, m.t); px = m.x - hx * (3.0 + u * 0.8) - gx * 0.9; pz = m.z - hz * (3.0 + u * 0.8) - gz * 0.9; py = 0.4; lx = m.x + gx * (0.5 + u * 0.4); lz = m.z + gz * (0.5 + u * 0.4); ly = 1.4 + u * 0.6; fov = 46 + u * 4; }
    else if (m.t < 2.9) { const u = E(1.92, 2.9, m.t), w = 6.4 - u * 0.7, cx = far ? r.x + gx * 3 : k.hx, cz = far ? r.z + gz * 3 : k.hz; px = cx + hx * w - gx * 0.8; pz = cz + hz * w - gz * 0.8; py = 0.9; lx = cx; lz = cz; ly = 1.5; fov = 44; }
    else { const u = E(2.9, 4.5, m.t), yx = Math.sin(m.yaw), yz = Math.cos(m.yaw), out = E(3.58, 3.75, m.t) * 0.5; px = m.x + yx * (2.7 - u * 0.3 + out) + yz * 0.7; pz = m.z + yz * (2.7 - u * 0.3 + out) - yx * 0.7; py = 0.5 + u * 0.1; lx = m.x - yx * 1.2; lz = m.z - yz * 1.2; ly = 1.15 + u * 0.2; fov = 46; }
  } else if (c === 'finale' && m.t > 0.3) {
    if (m.t < 1.4) { px = m.x - sx * 3.3 - fx * 0.5; pz = m.z - sz * 3.3 - fz * 0.5; py = 0.8; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.4; fov = 42 - 7 * E(0.5, 1.4, m.t); }
    else { px = m.x + sx * 3.6 - fx * 0.8; pz = m.z + sz * 3.6 - fz * 0.8; py = 0.5; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.6; fov = 48; }
  } else if (c === 'execute' && m.t > 0.3 && m.t < 2.1) { px = m.x - sx * 3.1 - fx * 0.2; pz = m.z - sz * 3.1 - fz * 0.2; py = 0.75; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.45; fov = 42 - 5 * E(0.6, 1.6, m.t); }
  else if (c === 'reckon' && m.t > 1.02 && m.t < 2.0) { px = m.x + sx * 1.5 - fx * 2.4; pz = m.z + sz * 1.5 - fz * 2.4; py = 0.85; lx = m.x + fx * 0.6; lz = m.z + fz * 0.6; ly = 1.5; fov = 42; }
  else if (hero > 0) { px = m.x - sx * 4.0 - fx * 0.6; pz = m.z - sz * 4.0 - fz * 0.6; py = 0.6; lx = m.x + fx * 0.9; lz = m.z + fz * 0.9; ly = 1.8; fov = 46; }
  else return false;
  const R = Math.hypot(px, pz); if (R > 22) { px *= 22 / R; pz *= 22 / R; }
  cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz); (cam.userData.focus as THREE.Vector3 | undefined ?? (cam.userData.focus = V())).set(lx, ly, lz); cam.userData.frame = true; cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1); cam.updateProjectionMatrix(); return true;
}
