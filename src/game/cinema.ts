// The turn: a false victory, then what was inside it. Skippable; ends as round 2's checkpoint.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { Fight } from '../combat/fight.ts';
import { Lens, type SceneKit } from './scenes.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const TURN_LEN = 26.4;
export class Turn {
  t = -1; omen = 0; /** Warmth of a victory that isn't one. */ dawn = 0; /** Colour drained, 0-1. */ mono = 0; private done = new Set<string>(); private A = { k: V(), d: V() }; private burst = false; private lens = new Lens();
  private kit: SceneKit; private dis: { value: number };
  constructor(kit: SceneKit, dis: { value: number }) { this.kit = kit; this.dis = dis; }
  onEnd: () => void = () => { };
  get active() { return this.t >= 0; }
  start() { this.t = 0; this.off = false; this.done.clear(); this.burst = false; this.omen = this.dawn = this.mono = 0; this.lens.cut = 0; const { m, king: k } = this.kit.f; this.A.k.set(k.x, 0, k.z); this.A.d.set(m.x - k.x, 0, m.z - k.z).normalize(); if (Math.hypot(m.x - k.x, m.z - k.z) < 3) { m.revive(k.x + this.A.d.x * 3, k.z + this.A.d.z * 3, Math.atan2(-this.A.d.x, -this.A.d.z)); this.kit.pv.reset(); } document.body.classList.add('cine'); sound.play('kDeath', { x: k.x, z: k.z, bus: 'voice', gain: 1 }); sound.duck(0.15, 2); sound.score?.set('scene'); }
  private off = false; private at(t: number, id: string, f: () => void) { if (this.t >= t && !this.done.has(id)) { this.done.add(id); if (!this.off) f(); } }
  /** Straight to the end state. */
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.kit.hud.verse(''); this.kit.f.king.mt = this.kit.f.king.prev = 4.6; this.off = true; this.t = TURN_LEN; }
  private become() {
    if (this.burst) return; this.burst = true; const { f, k1, k2 } = this.kit, { king: k, m } = f; k1.show(false); this.dis.value = 0; k.form = 2; k.armed = false; k.crawling = false; k.set('rise2'); k.x = 0; k.z = -3; k.y = 0; k.yaw = 0; k2.show(true); k2.settle(); if (Math.hypot(m.x, m.z - 4.6) > 0.8) m.revive(0, 4.6, Math.PI);
  }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const { t } = this, { f, fx, pv, k1, hud } = this.kit, { m, king: k } = f, L = this.lens; L.trauma *= Math.exp(-dt * 3); this.mono *= Math.exp(-dt * 1.5);
    // the body stays down
    if (!this.burst && (k.mode === 'fall' || k.mode === 'crash') && k.mt > 2.6) k.mt = k.prev = 2.6;
    // it looks, and sounds, exactly like the end
    this.dawn = 0.6 * E(2.8, 5, t) * (1 - E(7.1, 7.5, t));
    this.at(2.6, 'relocate', () => { k.x = 0; k.z = -3; k.yaw = 0; k.set('fall'); k.mt = k.prev = 2.6; m.revive(0, 1.6, 0); pv.reset(); k1.settle(); sound.score?.set('won'); });
    this.at(3.3, 'title', () => { hud.say('The Long Night Breaks', 3.3, 'victory', 'The King has fallen, and the sky goes grey.'); sound.play('cho', { gain: 0.5, bus: 'music', wet: 0.9 }); });
    f.sceneMove.z = t > 2.7 && t < 7.2 ? 0.4 : 0; f.sceneMove.x = 0;
    // behind him, out of his sight
    this.at(5.5, 'lift', () => { k.set('hang'); k.ht = 0; k.dir = 0; sound.play('creak', { x: 0, z: -3, gain: 0.35, wet: 0.8 }); });
    this.at(7.2, 'hush', () => { sound.score?.set('scene'); sound.duck(0.02, 2.4); sound.play('creak', { x: 0, z: -3, gain: 0.8 }); pv.ember = 1.8; });
    this.at(7.5, 'h1', () => sound.play('heart', { gain: 0.9 })); this.at(7.9, 'whisper', () => sound.play('whisper', { gain: 1, wet: 0.8 })); this.at(8.4, 'h2', () => sound.play('heart', { gain: 0.9 })); this.at(9.2, 'h3', () => sound.play('heart', { gain: 1 }));
    if (t > 8.7 && t < 9.9) m.yaw += (Math.PI - m.yaw) * Math.min(1, dt * 7);
    if (t > 9.2 && t < 26) this.omen = 0.55 * E(9.3, 13, t) + 0.45 * E(18.5, 20, t);
    if (k.hanging) { k.th = Math.sin((t - 5) * 1.5) * 0.05 + (t > 12.4 ? Math.sin(t * 31) * 0.012 * E(12.4, 15.2, t) : 0); }
    this.at(12.5, 'tear', () => { sound.play('tear', { x: 0, z: -3, gain: 1, wet: 0.5 }); sound.play('kScreech', { x: 0, z: -3, bus: 'voice', gain: 0.8 }); });
    if (t > 12.6 && t < 15.5 && !this.burst) { const u = E(12.8, 15.5, t); this.dis.value = u * 0.62; L.trauma = 0.25 + u * 0.4; const h = k1.hurt(V()); if (Math.random() < 0.8) { fx.gore.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0, 1), 5, 3, 1.8, 0.9, time); fx.sparks.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0.3, 0.6), 4, 2.5, 2, -1.2, time); } }
    for (const [i, at] of [13.2, 13.9, 14.5, 14.9].entries()) this.at(at, 'pulse' + i, () => { sound.play('fleshH', { gain: 0.9, x: 0, z: -3 }); sound.play('crackBone', { gain: 0.8, x: 0, z: -3, wet: 0.5 }); L.trauma = 0.8; const h = k1.hurt(V()); fx.gore.emit(V(h.x, h.y + 1.4, h.z), V(0, 0.2, 1), 30, 5, 1.8, 1, time); });
    this.at(15.5, 'burst', () => { this.become(); this.mono = 1; const c = V(0, 2, -3); for (let i = 0; i < 5; i++) fx.bursts.add('fire', c.clone().add(V((Math.random() - 0.5) * 1.6, Math.random() * 1.4 - 0.4, 0)), 3.4, 0.8, time + i * 0.04, i); fx.bursts.add('flare', c, 10, 0.4, time); fx.bursts.add('ground', V(0, 0.06, -3), 10, 0.8, time); fx.sparks.emit(c, V(0, 0.4, 0.3), 160, 7, 2.2, 1, time); fx.sparks.emit(c, V(0, 0.2, 0), 60, 3, 2.4, -2, time); fx.gore.emit(c, V(0, 0.3, 0.4), 90, 6, 2, 1.2, time); fx.puffs.emit(V(0, 0, -3), 16, 3.5, 1.8, time); pv.boomAt.set(0, 2, -3); pv.boomK = 1; L.trauma = 1; sound.play('boom', { gain: 1, x: 0, z: -3 }); sound.play('slam', { gain: 0.8, x: 0, z: -3, delay: 0.12 }); });
    // one pair of arms after another
    for (const [i, at] of [16.9, 17.35, 17.8].entries()) this.at(at, 'arm' + i, () => { sound.play('crackBone', { gain: 1, x: 0, z: -3, wet: 0.5, rate: 1 - i * 0.12 }); sound.play('taiko', { bus: 'music', gain: 0.9, wet: 0.4 }); L.trauma = Math.max(L.trauma, 0.55 + i * 0.1); fx.sparks.emit(V(0, 1.2, -3), V(0, 0.6, 0), 24, 3, 2.2, -1, time); });
    this.at(15.9, 'verse', () => hud.verse('He was only what it wore.')); this.at(18.2, 'verseOff', () => hud.verse(''));
    this.at(16.5, 'br', () => sound.play('kBreath', { x: 0, z: -3, bus: 'voice', gain: 1.4, rate: 0.75 }));
    this.at(18.45, 'roar', () => { sound.play('bRoar', { bus: 'voice', gain: 1.05, x: 0, z: -3, wet: 0.6 }); sound.score?.set('reveal'); hud.say('The One Beneath', 3.8, 'title'); });
    this.at(18.6, 'shock', () => { fx.bursts.add('ground', V(0, 0.06, -3), 26, 1.2, time); for (let i = 0; i < 9; i++) { const a = Math.PI + (i - 0.5) / 8 * Math.PI; fx.bursts.add('pillar', V(Math.cos(a) * 4, 0, -3.4 + Math.sin(a) * 4), 2.8, 0.9, time + 0.05); } fx.sparks.emit(V(0, 1.5, -3), V(0, 0.5, 0), 140, 8, 2.4, -2.4, time); sound.play('fire', { gain: 1, wet: 0.5 }); m.moveYaw = m.yaw; m.begin('block'); });
    if (t > 18.5 && t < 21) L.trauma = Math.max(L.trauma, 0.65 * (1 - E(19.5, 21, t)));
    this.at(23.8, 'draw', () => { m.begin('flick'); sound.play('scrape', { gain: 0.8 }); pv.ember = 1.8; });
    this.at(24.3, 'lit', () => { sound.play('aura2', { gain: 0.8 }); pv.ember = 2; pv.boomAt.set(m.x, 1.3, m.z); pv.boomK = 0.4; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; fx.bursts.add('pillar', V(m.x + Math.cos(a) * 0.9, 0, m.z + Math.sin(a) * 0.9), 1.1, 0.7, time + i * 0.015); } });
    if (t >= TURN_LEN) { this.become(); this.t = -1; this.omen = 1; this.dawn = this.mono = 0; this.dis.value = 0; document.body.classList.remove('cine'); if (k.mode === 'rise2') k.set('idle'); f.beginRound2(); this.onEnd(); sound.score?.set('r2'); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const t = this.t, m = this.kit.f.m, L = this.lens, go = (n: number, p: THREE.Vector3, l: THREE.Vector3, f: number, roll = 0) => L.aim(cam, n, p, l, f, time, roll);
    if (t < 2.6) { const u = t / 2.6, d = this.A.d, s = V(d.z, 0, -d.x), p = this.A.k.clone().addScaledVector(d, 4.4 - u * 0.6).addScaledVector(s, 2.6).setY(0.75); go(1, p, this.A.k.clone().setY(1.7 - u * 0.7).addScaledVector(d, 0.7), 44, 0.03 * u); }
    else if (t < 7.2) { const u = E(2.6, 7.2, t); go(2, V(0.75 - 0.2 * u, 1.0 + 0.35 * u, m.z + 3.4 - u * 0.9), V(-0.12, 1.4, m.z - 2), 38); }
    else if (t < 9.3) { const u = (t - 7.2) / 2.1; go(3, V(0.3 - u * 0.12, 1.56, m.z + 0.95 - u * 0.14), V(0.02, 1.57, m.z), 32); }
    else if (t < 12.4) { const u = E(9.3, 12.4, t); go(4, V(0.85, 1.3 + u * 0.15, m.z + 1.7 - u * 0.4), V(0, 2.2 + u * 0.7, -3), 46, -0.04 * u); }
    // in close, twice, then back out as it goes
    else if (t > 13.15 && t < 13.75) { go(51, V(0.9, 2.2, -1.3), V(0, 2.9, -3), 26, 0.12); }
    else if (t > 14.45 && t < 15.05) { go(52, V(-0.8, 3.4, -1.2), V(0, 3.2, -3), 24, -0.14); }
    else if (t < 15.5) { const u = E(12.4, 15.5, t); go(t < 13.2 ? 5 : t < 14.5 ? 53 : 54, V(1.0 - u * 0.5, 1.7 + u * 0.25, 0.9 - u * 0.5), V(0, 2.5 + u * 0.3, -3), 42 - u * 6); }
    else if (t < 18.3) { const u = E(15.5, 18.3, t), punch = [16.9, 17.35, 17.8].reduce((a, q) => a + (t > q ? Math.exp(-(t - q) * 7) : 0), 0); go(6, V(2.7 - u * 0.7, 0.42 + u * 0.2, 1.2 + E(17.4, 18.2, t) * 0.8), V(0, 0.9 + u * 0.3 + E(17.4, 18.2, t) * 0.85, -3), 42 - punch * 5); }
    else if (t < 21.6) { const u = E(18.3, 21.6, t), rush = E(18.4, 18.8, t); go(7, V(0.5, 0.55 + u * 0.1, 2.4 - rush * 1.2 + u * 1.4), V(0, 2.35 - u * 0.1, -3), 50); }
    else if (t < 23.6) { const u = E(21.6, 23.6, t); go(8, V(-1.5 + u * 0.4, 0.45, m.z + 2.3), V(0.2, 2.6 + u * 0.3, -5), 44, -0.03); }
    else { const u = E(23.6, TURN_LEN, t); go(9, V(0.5 + 0.1 * u, 1.0 + 0.5 * u, m.z + 2.6 + 1.6 * u), V(0.05, 1.6, -3), 46); }
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
  cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz); cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1); cam.updateProjectionMatrix(); return true;
}
