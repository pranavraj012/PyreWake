// The turn: a false victory, then what was inside it. Skippable; ends as round 2's checkpoint.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { KingView } from '../boss/kingView.ts';
import type { Fight } from '../combat/fight.ts';
import type { PlayerView } from '../player/view.ts';
import type { Fx } from '../render/impact.ts';
import type { Hud } from '../ui/hud.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const TURN_LEN = 24.4;
export class Turn {
  t = -1; omen = 0; trauma = 0; private cut = 0; private done = new Set<string>(); private A = { k: V(), d: V() }; private look = V(); private burst = false;
  private f: Fight; private pv: PlayerView; private k1: KingView; private k2: KingView; private fx: Fx; private hud: Hud; private dis: { value: number };
  constructor(o: { f: Fight; pv: PlayerView; k1: KingView; k2: KingView; fx: Fx; hud: Hud; dis: { value: number } }) { this.f = o.f; this.pv = o.pv; this.k1 = o.k1; this.k2 = o.k2; this.fx = o.fx; this.hud = o.hud; this.dis = o.dis; }
  get active() { return this.t >= 0; }
  start() { this.t = 0; this.done.clear(); this.burst = false; this.omen = 0; const { m, king: k } = this.f; this.A.k.set(k.x, 0, k.z); this.A.d.set(m.x - k.x, 0, m.z - k.z).normalize(); document.body.classList.add('cine'); sound.play('kDeath', { x: k.x, z: k.z, bus: 'voice', gain: 1 }); sound.duck(0.15, 2); sound.score?.set('scene'); }
  private at(t: number, id: string, f: () => void) { if (this.t >= t && !this.done.has(id)) { this.done.add(id); f(); } }
  /** Straight to the end state. */
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.f.king.mt = this.f.king.prev = 4.6; this.t = TURN_LEN; }
  private become() {
    if (this.burst) return; this.burst = true; const { king: k, m } = this.f; this.k1.show(false); this.dis.value = 0; k.form = 2; k.armed = false; k.crawling = false; k.set('rise2'); k.x = 0; k.z = -3; k.y = 0; k.yaw = 0; this.k2.show(true); this.k2.settle(); if (Math.hypot(m.x, m.z - 4.6) > 0.8) m.revive(0, 4.6, Math.PI);
  }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const { t, f, fx } = this, { m, king: k } = f; this.trauma *= Math.exp(-dt * 3);
    // the body stays down
    if (!this.burst && (k.mode === 'fall' || k.mode === 'crash') && k.mt > 2.6) k.mt = k.prev = 2.6;
    this.at(2.6, 'relocate', () => { k.x = 0; k.z = -3; k.yaw = 0; k.set('fall'); k.mt = k.prev = 2.6; m.revive(0, 2.0, 0); this.pv.reset(); this.k1.settle(); this.hud.say('It is done', 3.0); });
    f.sceneMove.z = t > 2.7 && t < 6.9 ? 0.4 : 0; f.sceneMove.x = 0;
    this.at(5.0, 'lift', () => { k.set('hang'); k.ht = 0; k.dir = 0; sound.play('creak', { x: 0, z: -3, gain: 0.7 }); });
    this.at(6.0, 'creak2', () => sound.play('creak', { x: 0, z: -3, gain: 0.6 })); this.at(7.0, 'whisper', () => { sound.play('whisper', { gain: 1, wet: 0.8 }); this.pv.ember = 1.8; sound.play('heart', { gain: 0.9 }); }); this.at(8.0, 'h2', () => sound.play('heart', { gain: 0.9 })); this.at(8.9, 'h3', () => sound.play('heart', { gain: 1 }));
    if (t > 8.2 && t < 9.4) m.yaw += (Math.PI - m.yaw) * Math.min(1, dt * 7);
    if (t > 8.8 && t < 24) this.omen = 0.55 * E(9, 13, t) + 0.45 * E(18.5, 20, t);
    if (k.hanging) { k.th = Math.sin((t - 5) * 1.5) * 0.05 + (t > 12.4 ? Math.sin(t * 31) * 0.012 * E(12.4, 15.2, t) : 0); }
    this.at(12.5, 'tear', () => { sound.play('tear', { x: 0, z: -3, gain: 1, wet: 0.5 }); sound.play('kScreech', { x: 0, z: -3, bus: 'voice', gain: 0.8 }); });
    if (t > 12.6 && t < 15.5 && !this.burst) { const u = E(12.8, 15.5, t); this.dis.value = u * 0.96; this.trauma = 0.25 + u * 0.4; const h = this.k1.hurt(V()); if (Math.random() < 0.8) { fx.gore.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0, 1), 5, 3, 1.8, 0.9, time); fx.sparks.emit(V(h.x, h.y + 1 + Math.random() * 1.4, h.z), V(0, 0.3, 0.6), 4, 2.5, 2, -1.2, time); } }
    this.at(13.2, 'pulse1', () => sound.play('fleshH', { gain: 0.9, x: 0, z: -3 })); this.at(14.2, 'pulse2', () => sound.play('fleshH', { gain: 1, x: 0, z: -3 }));
    this.at(15.5, 'burst', () => { this.become(); const c = V(0, 2, -3); for (let i = 0; i < 5; i++) fx.bursts.add('fire', c.clone().add(V((Math.random() - 0.5) * 1.6, Math.random() * 1.4 - 0.4, 0)), 3.4, 0.8, time + i * 0.04, i); fx.bursts.add('flare', c, 10, 0.4, time); fx.bursts.add('ground', V(0, 0.06, -3), 10, 0.8, time); fx.sparks.emit(c, V(0, 0.4, 0.3), 160, 7, 2.2, 1, time); fx.sparks.emit(c, V(0, 0.2, 0), 60, 3, 2.4, -2, time); fx.gore.emit(c, V(0, 0.3, 0.4), 90, 6, 2, 1.2, time); fx.puffs.emit(V(0, 0, -3), 16, 3.5, 1.8, time); this.pv.boomAt.set(0, 2, -3); this.pv.boomK = 1; this.trauma = 1; sound.play('boom', { gain: 1, x: 0, z: -3 }); sound.play('slam', { gain: 0.8, x: 0, z: -3, delay: 0.12 }); });
    this.at(16.9, 'br', () => sound.play('kBreath', { x: 0, z: -3, bus: 'voice', gain: 1.4, rate: 0.75 }));
    this.at(18.45, 'roar', () => { sound.play('bRoar', { bus: 'voice', gain: 1.05, x: 0, z: -3, wet: 0.6 }); sound.score?.set('reveal'); this.hud.say('The One Beneath', 3.6, 'title'); });
    this.at(18.6, 'shock', () => { fx.bursts.add('ground', V(0, 0.06, -3), 26, 1.2, time); for (let i = 0; i < 9; i++) { const a = Math.PI + (i - 0.5) / 8 * Math.PI; fx.bursts.add('pillar', V(Math.cos(a) * 4, 0, -3.4 + Math.sin(a) * 4), 2.8, 0.9, time + 0.05); } fx.sparks.emit(V(0, 1.5, -3), V(0, 0.5, 0), 140, 8, 2.4, -2.4, time); sound.play('fire', { gain: 1, wet: 0.5 }); });
    if (t > 18.5 && t < 21) this.trauma = Math.max(this.trauma, 0.65 * (1 - E(19.5, 21, t)));
    this.at(22, 'draw', () => { m.begin('flick'); sound.play('scrape', { gain: 0.8 }); this.pv.ember = 1.8; });
    if (t >= TURN_LEN) { this.become(); this.t = -1; this.omen = 1; this.dis.value = 0; document.body.classList.remove('cine'); if (k.mode === 'rise2') k.set('idle'); f.beginRound2(); sound.score?.set('r2'); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number, fov: number) {
    const t = this.t, m = this.f.m, S = (n: number) => { if (this.cut !== n) { this.cut = n; return true; } return false; }; let p = V(), l = V(), fv = fov, snap = false;
    if (t < 2.6) { snap = S(1); const u = t / 2.6, d = this.A.d, s = V(d.z, 0, -d.x); p = this.A.k.clone().addScaledVector(d, 4.4 - u * 0.6).addScaledVector(s, 2.6); p.y = 0.75; l = this.A.k.clone().setY(1.7 - u * 0.7).addScaledVector(d, 0.7); fv = 44; }
    else if (t < 7.0) { snap = S(2); p.set(0.55, 1.35, m.z + 2.5); l.set(-0.12, 1.42, m.z - 2); fv = 38; }
    else if (t < 9.0) { snap = S(3); const u = (t - 7) / 2; p.set(0.3 - u * 0.12, 1.56, m.z + 0.95 - u * 0.12); l.set(0.02, 1.57, m.z); fv = 32; }
    else if (t < 12.4) { snap = S(4); const u = E(9, 12.4, t); p.set(0.85, 1.35 + u * 0.15, m.z + 1.7 - u * 0.4); l.set(0, 2.2 + u * 0.7, -3); fv = 46; }
    else if (t < 15.5) { snap = S(5); const u = E(12.4, 15.5, t); p.set(1.0 - u * 0.5, 1.7 + u * 0.25, 0.9 - u * 0.5); l.set(0, 2.5 + u * 0.3, -3); fv = 42 - u * 6; }
    else if (t < 18.3) { snap = S(6); const u = E(15.5, 18.3, t); p.set(2.7 - u * 0.8, 0.42 + u * 0.2, 1.2 - u * 0.3); l.set(0, 0.9 + u * 0.4, -3); fv = 42; }
    else if (t < 22) { snap = S(7); const u = E(18.3, 22, t); p.set(0.5, 0.55 + u * 0.1, 1.5 + u * 1.2); l.set(0, 2.35 - u * 0.1, -3); fv = 50; }
    else { snap = S(8); const u = E(22, TURN_LEN, t); p.set(0.5 + 0.1 * u, 1.0 + 0.5 * u, m.z + 2.6 + 1.6 * u); l.set(0.05, 1.6, -3); fv = 46; }
    if (snap) this.look.copy(l); else this.look.lerp(l, 0.2); cam.position.copy(p); cam.lookAt(this.look); cam.fov = fv * (cam.aspect > 1.9 ? 0.94 : 1);
    const k = this.trauma * this.trauma; cam.rotateZ(Math.sin(time * 47) * 0.014 * k + Math.sin(time * 0.7) * 0.004); cam.rotateX(Math.sin(time * 59) * 0.016 * k); cam.updateProjectionMatrix();
  }
}

/** Short composed shots inside the fight. Returns false when the normal camera should run. */
export function actionCam(cam: THREE.PerspectiveCamera, f: Fight, hero: number, base: number): boolean {
  const { m, king: k } = f, c = m.clip?.name, dx = k.hx - m.x, dz = k.hz - m.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, sx = fz, sz = -fx;
  let px = 0, py = 0, pz = 0, lx = 0, ly = 0, lz = 0, fov = base;
  if (c === 'rites' && m.t < 2.9) {
    if (m.t < 1.66) { const u = m.t / 1.66; px = m.x + fx * (2.6 - u * 0.5) + sx * 0.9; pz = m.z + fz * (2.6 - u * 0.5) + sz * 0.9; py = 0.5 + u * 0.2; lx = m.x; lz = m.z; ly = 1.5 + u * 0.7; fov = 46; }
    else { const mx = m.x + fx * d * 0.45, mz = m.z + fz * d * 0.45, w = 5.2 + d * 0.4; px = mx + sx * w; pz = mz + sz * w; py = 1.3; lx = mx; lz = mz; ly = 1.6; fov = 44; }
  } else if (c === 'execute' && m.t > 0.3 && m.t < 2.1) { px = m.x - sx * 3.1 - fx * 0.2; pz = m.z - sz * 3.1 - fz * 0.2; py = 0.75; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.45; fov = 42 - 5 * E(0.6, 1.6, m.t); }
  else if (c === 'reckon' && m.t > 1.02 && m.t < 2.0) { px = m.x + sx * 1.5 - fx * 2.4; pz = m.z + sz * 1.5 - fz * 2.4; py = 0.85; lx = m.x + fx * 0.6; lz = m.z + fz * 0.6; ly = 1.5; fov = 42; }
  else if (hero > 0) { px = m.x - sx * 4.0 - fx * 0.6; pz = m.z - sz * 4.0 - fz * 0.6; py = 0.6; lx = m.x + fx * 0.9; lz = m.z + fz * 0.9; ly = 1.8; fov = 46; }
  else return false;
  const R = Math.hypot(px, pz); if (R > 22) { px *= 22 / R; pz *= 22 / R; }
  cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz); cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1); cam.updateProjectionMatrix(); return true;
}
