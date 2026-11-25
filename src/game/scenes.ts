// The way in and the way out: the intro before round 1 and the ending after the last blow. Both skippable.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { KingView } from '../boss/kingView.ts';
import type { Fight } from '../combat/fight.ts';
import type { PlayerView } from '../player/view.ts';
import type { Fx } from '../render/impact.ts';
import type { Hud } from '../ui/hud.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface SceneKit { f: Fight; pv: PlayerView; k1: KingView; k2: KingView; fx: Fx; hud: Hud }
/** Shared by every scene: one-shot cues, a hand-held lens, and cuts that don't smear. */
export class Lens {
  trauma = 0; cut = 0; private look = V();
  /** Frame a shot. A new `n` is a cut; the same one eases. */
  aim(cam: THREE.PerspectiveCamera, n: number, p: THREE.Vector3, l: THREE.Vector3, fov: number, time: number, roll = 0) {
    if (this.cut !== n) { this.cut = n; this.look.copy(l); } else this.look.lerp(l, 0.2);
    cam.position.copy(p); cam.lookAt(this.look); cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1);
    const k = this.trauma * this.trauma; cam.rotateZ(roll + Math.sin(time * 47) * 0.014 * k + Math.sin(time * 0.7) * 0.004); cam.rotateX(Math.sin(time * 59) * 0.016 * k + Math.sin(time * 0.9) * 0.0022); cam.rotateY(Math.sin(time * 0.6 + 1) * 0.0026); cam.updateProjectionMatrix();
  }
}
class Cues { private done = new Set<string>(); /** Skipped: what was still to come never happens. */ off = false; at(now: number, t: number, id: string, f: () => void) { if (now >= t && !this.done.has(id)) { this.done.add(id); if (!this.off) f(); } } clear() { this.done.clear(); this.off = false; } }

// ---------------------------------------------------------------- why
export const STORY = [
  'In this land the dead are burned before dark, or they do not stay dead.',
  'The King feared the fire. He had himself hanged from the oldest tree, where no flame could reach him.',
  'He never died. Night fell on the day he should have burned, and it has not lifted since.',
  'You are the last keeper of the pyres. Burn the King, and let the morning in.',
];
const LINE = 5.1;
export const STORY_LEN = LINE * STORY.length;
export class Prologue {
  t = STORY_LEN; /** To black, and how the world is drained. */ dark = 1; mono = 0; ink = 0; /** Height of the pyres. */ flame = 1; omen = 0; private c = new Cues(); private lens = new Lens(); private kit: SceneKit; private fires: THREE.Vector3[];
  constructor(kit: SceneKit, fires: THREE.Vector3[]) { this.kit = kit; this.fires = fires; }
  get active() { return this.t < STORY_LEN; }
  start() { const { f, pv, k1 } = this.kit, k = f.king; this.t = 0; this.c.clear(); this.lens.cut = 0; this.dark = 1; this.flame = 1; this.omen = 0; k.x = 0; k.z = -4; k.yaw = 0; k.set('hang'); k.ht = 4; k.dir = 0; k1.settle(); f.m.revive(0, 15.3, Math.PI); pv.reset(); sound.score?.set('vigil'); }
  skip() { if (this.active && this.t > 0.6) this.end(); }
  private end() { this.t = STORY_LEN; this.dark = this.mono = this.ink = this.omen = 0; this.flame = 1; this.kit.hud.verse(''); }
  step(dt: number, time: number) {
    const { f, pv, hud, fx } = this.kit, m = f.m, k = f.king, c = this.c; this.t += dt; const t = this.t, i = Math.min(STORY.length - 1, Math.floor(t / LINE)), u = t - i * LINE;
    STORY.forEach((line, n) => { c.at(t, n * LINE + 0.45, 'l' + n, () => hud.verse(line)); c.at(t, (n + 1) * LINE - 0.55, 'x' + n, () => hud.verse('')); });
    this.dark = Math.max(0, 1 - u / 0.7, (u - (LINE - 0.45)) / 0.4); this.mono = 0.96; this.ink = 0.75;
    if (i < 2 || k.mode === 'hang') { if (k.mode !== 'hang') k.set('hang'); k.th = Math.sin(t * 0.9) * 0.07; k.mt = 0; }
    c.at(t, LINE + 0.8, 'creak', () => sound.play('creak', { gain: 0.6, wet: 0.8 })); c.at(t, LINE + 3, 'creak2', () => sound.play('creak', { gain: 0.5, wet: 0.8 }));
    // the fires go out, and stay out, until a hand closes on one
    this.flame = i < 2 ? 1 : i === 2 ? 1 - E(0.8, 3.4, u) : 0.06 + 0.94 * E(2.0, 3.0, u); this.omen = i === 2 ? 0.34 * E(0.4, 3.6, u) : 0;
    c.at(t, LINE * 2 + 0.9, 'out', () => { sound.play('vanish', { gain: 0.5, rate: 0.6, wet: 0.9 }); sound.play('kBreath', { bus: 'voice', gain: 0.7, wet: 0.9, rate: 0.7 }); });
    c.at(t, LINE * 3 + 0.05, 'hand', () => { m.begin('clench'); pv.ember = 0.3; sound.play('heart', { gain: 0.9 }); });
    c.at(t, LINE * 3 + 1.4, 'catch', () => { pv.ember = 2; sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('heart', { gain: 0.8 }); pv.boomAt.set(m.x, 1.3, m.z - 0.4); pv.boomK = 0.25; fx.sparks.emit(V(m.x - 0.1, 1.35, m.z - 0.45), V(0, 0.8, 0), 40, 1.4, 1.8, -1.4, time); });
    if (t >= STORY_LEN) this.end();
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const t = this.t, m = this.kit.f.m, L = this.lens, i = Math.min(3, Math.floor(t / LINE)), u = (t - i * LINE) / LINE, p = this.fires[4] ?? this.fires[0], r = Math.hypot(p.x, p.z), ox = p.x / r, oz = p.z / r;
    if (i === 0) L.aim(cam, 1, V(p.x - ox * (4.6 - u * 0.9) + oz * 1.5, 0.7 + u * 0.2, p.z - oz * (4.6 - u * 0.9) - ox * 1.5), V(p.x, 1.35, p.z), 40, time);
    else if (i === 1) L.aim(cam, 2, V(1.9 - u * 0.6, 0.6 + u * 0.3, 3.4 - u * 0.8), V(-0.1, 2.5 + u * 0.3, -4), 46, time, -0.03);
    else if (i === 2) L.aim(cam, 3, V(5 - u * 2.2, 2.0 + u * 1.2, 12 - u * 1.2), V(-5, 7.6 + u * 0.6, -18), 54, time);
    else L.aim(cam, 4, V(m.x - 0.75 + u * 0.2, 1.42 + u * 0.08, m.z - 1.35 + u * 0.25), V(m.x + 0.02, 1.36 + u * 0.16, m.z), 36 - u * 3, time);
  }
}

// ---------------------------------------------------------------- the way in
export const INTRO_LEN = 17.0;
/** Where the King kneels until it is woken. */
export const KNEEL = 4.5;
export class Intro {
  t = INTRO_LEN; private c = new Cues(); private lens = new Lens(); private kit: SceneKit; private set = { z: 0 };
  constructor(kit: SceneKit) { this.kit = kit; }
  get active() { return this.t < INTRO_LEN; }
  start() { const { f } = this.kit, k = f.king, m = f.m; this.t = 0; this.c.clear(); this.lens.cut = 0; this.lens.trauma = 0; k.x = 0; k.z = -4; k.yaw = 0; k.y = 0; this.kneel(); this.kit.k1.settle(); m.revive(0, 15.3, Math.PI); this.kit.pv.reset(); this.set.z = 0; }
  /** Also the title screen: it is already there, waiting. */
  kneel() { const k = this.kit.f.king; if (k.form !== 1) return; if (k.mode !== 'fall') k.set('fall'); k.mt = k.prev = KNEEL; }
  skip() { if (this.active && this.t > 0.6) { this.end(); } }
  private end() { this.t = INTRO_LEN; const { f, pv } = this.kit, k = f.king; k.x = 0; k.z = -4; k.yaw = 0; if (k.mode === 'fall') k.set('idle'); this.kit.k1.settle(); if (Math.hypot(f.m.x, f.m.z - 5.2) > 0.6) { f.m.revive(0, 5.2, Math.PI); pv.reset(); } }
  /** Returns how far forward the hero wants to walk. */
  step(dt: number, time: number): number {
    const { f, fx, hud, pv } = this.kit, m = f.m, k = f.king, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.6);
    if (t < 11.0) this.kneel();
    c.at(t, 0.1, 'wind', () => sound.play('sub', { gain: 0.5, wet: 0.8 }));
    c.at(t, 1.3, 'place', () => hud.say('The Charnel Court', 2.6, 'place'));
    c.at(t, 3.2, 'b0', () => sound.play('kBreath', { gain: 0.5, wet: 0.9, x: 0, z: -4, bus: 'voice' }));
    for (let i = 0; i < 3; i++) c.at(t, 4.5 + i * 0.75, 's' + i, () => sound.play('scrape', { x: m.x, z: m.z, gain: 0.5, rate: 0.8 }));
    c.at(t, 6.9, 'eye', () => { pv.ember = 1.9; sound.play('flare', { gain: 0.6 }); sound.play('heart', { gain: 0.8 }); });
    c.at(t, 8.7, 'b1', () => sound.play('kBreath', { gain: 1.1, wet: 0.6, x: 0, z: -4, bus: 'voice', rate: 0.85 })); c.at(t, 9.9, 'tick', () => { sound.play('bone', { gain: 0.7, wet: 0.6 }); });
    c.at(t, 10.5, 'hb', () => sound.play('heart', { gain: 0.9 }));
    // it gets up the wrong way
    c.at(t, 11.0, 'wake', () => { k.mt = k.prev = 4.55; });
    c.at(t, 11.2, 'j1', () => { sound.play('crackBone', { gain: 0.9, wet: 0.5 }); sound.play('bone', { gain: 0.9 }); this.lens.trauma = 0.5; }); c.at(t, 11.72, 'j2', () => { sound.play('crackBone', { gain: 1, wet: 0.5 }); sound.play('thud', { gain: 0.5 }); this.lens.trauma = 0.6; });
    c.at(t, 12.3, 'j3', () => { sound.play('crackBone', { gain: 1, wet: 0.5 }); this.lens.trauma = 0.5; });
    c.at(t, 12.75, 'roar', () => { sound.play('kScreech', { gain: 1, wet: 0.6, bus: 'voice' }); sound.duck(0.4, 0.8); this.lens.trauma = 0.9; hud.say('The Hanged King', 2.0, 'title'); fx.puffs.emit(V(0, 0, -4), 18, 3, 1.6, time); fx.bursts.add('ground', V(0, 0.06, -4), 9, 0.9, time, 0, 0.7, 0.3, 0.1); });
    if (t > 12.75 && t < 14) this.lens.trauma = Math.max(this.lens.trauma, 0.7 * (1 - E(13, 14, t)));
    c.at(t, 14.5, 'ready', () => { m.begin('flick'); sound.play('whooshH', { gain: 0.6 }); });
    c.at(t, 14.85, 'burn', () => { pv.ember = 2; sound.play('aura1', { gain: 0.8 }); pv.boomAt.set(m.x, 1.3, m.z); pv.boomK = 0.4; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; fx.bursts.add('pillar', V(m.x + Math.cos(a) * 0.9, 0, m.z + Math.sin(a) * 0.9), 1.1, 0.7, time + i * 0.015); } fx.sparks.emit(V(m.x, 1, m.z), V(0, 0.6, 0), 60, 3, 2.2, -1.8, time); });
    if (t >= INTRO_LEN) this.end();
    return t > 4.0 && m.z > 5.6 && t < 11 ? -0.4 : 0;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, fov: number) {
    const t = this.t, m = this.kit.f.m, L = this.lens;
    if (t < 4.0) { const u = E(0, 4.4, t); L.aim(cam, 1, V(-5.5 + u * 3.2, 11.5 - u * 8.2, -19 + u * 6.5), V(0, 0.6 + u * 0.6, 1 + u * 2), 50 - u * 6, time); }
    else if (t < 6.4) { const u = E(4, 6.4, t); L.aim(cam, 2, V(m.x - 1.3 + 0.2 * u, 0.24, m.z + 1.35 - u * 0.5), V(m.x - 0.15, 0.4, m.z + 0.1), 34, time, 0.02); }
    else if (t < 8.4) { const u = E(6.4, 8.4, t); L.aim(cam, 3, V(m.x + 0.6 - 0.22 * u, 1.53, m.z - 1.6 + 0.1 * u), V(m.x, 1.56, m.z), 28, time); }
    else if (t < 10.9) { const u = E(8.4, 10.9, t); L.aim(cam, 4, V(1.15 - u * 0.25, 1.25 + u * 0.15, -5.9 + u * 0.35), V(0.15, 1.3, 2), 44 - u * 5, time, -0.02); }
    else if (t < 14.3) { const u = E(10.9, 13.2, t), w = E(12.7, 13.1, t); L.aim(cam, 5, V(-1.3 + u * 0.5, 0.5 + u * 0.3, -0.2 + u * 0.5 - w * 0.7), V(0, 1.1 + u * 1.4, -4), 50 - w * 4, time, 0.05 * (1 - u)); }
    else { const u = E(14.3, INTRO_LEN, t); L.aim(cam, 6, V(m.x - 0.95 + 1.35 * u, 0.5 + 0.95 * u, m.z + 2.2 + 1.9 * u), V(m.x + 0.1, 1.5, m.z - 4), 50 + (fov - 50) * u, time); }
  }
}

// ---------------------------------------------------------------- the way out
export const END_LEN = 18.5;
export class Ending {
  t = -1; /** How far the eclipse has lifted, and how much first light there is. */ clear = 0; dawn = 0; over = false; private c = new Cues(); private lens = new Lens(); private kit: SceneKit; private A = V(); private Y = 0;
  constructor(kit: SceneKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const m = this.kit.f.m; this.t = 0; this.over = false; this.clear = this.dawn = 0; this.c.clear(); this.lens.cut = 0; this.A.set(m.x, 0, m.z); const k = this.kit.f.king; this.Y = Math.atan2(m.x - k.x, m.z - k.z); document.body.classList.add('cine'); }
  stop() { this.t = -1; this.clear = this.dawn = 0; this.over = false; this.kit.f.sceneMove = { x: 0, z: 0 }; document.body.classList.remove('cine'); }
  skip() { if (this.active && this.t > 2.2 && this.t < END_LEN) { this.place(); this.c.off = true; this.t = END_LEN; } }
  private place() { this.c.at(99, 0, 'place', () => { const { f, pv, k2 } = this.kit, m = f.m, k = f.king; k.x = 0; k.z = -11; k.yaw = 0; k2.settle(); m.revive(0, -7, 0); pv.reset(); }); }
  step(dt: number, time: number) {
    if (!this.active) return; const { f, pv, fx, hud } = this.kit, m = f.m, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.4);
    this.clear = E(6.2, 11.5, t); this.dawn = E(9.5, 15, t);
    c.at(t, 0.05, 'hush', () => { sound.duck(0.05, 2.2); });
    c.at(t, 3.6, 'crack', () => sound.play('tear', { gain: 0.6, wet: 0.7 }));
    c.at(t, 4.2, 'burn', () => { sound.play('fire', { gain: 0.9, wet: 0.6 }); sound.play('whisper', { gain: 0.8, wet: 0.9 }); });
    if (t > 3.6 && t < 6.6 && Math.random() < 0.7) { const k = f.king; fx.sparks.emit(V(k.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 2.4, k.z + (Math.random() - 0.5) * 1.2), V(0, 0.9, 0), 5, 1.2, 1.6, -2.6, time); }
    c.at(t, 6.6, 'cutaway', () => this.place());
    // he doesn't look back
    if (t > 6.7 && t < 14.2) { f.sceneMove = { x: 0, z: 0.4 }; } else f.sceneMove = { x: 0, z: 0 };
    c.at(t, 7.9, 'blast', () => { const p = V(0, 1.2, -11); for (let i = 0; i < 5; i++) fx.bursts.add('fire', p.clone().add(V((Math.random() - 0.5) * 2.4, Math.random() * 1.8 - 0.4, 0)), 4.4, 1.0, time + i * 0.05, i); fx.bursts.add('flare', p, 12, 0.5, time); for (let i = 0; i < 9; i++) fx.bursts.add('pillar', V((i - 4) * 0.8, 0, -11 + Math.random()), 3.2, 1, time + Math.abs(i - 4) * 0.04); fx.sparks.emit(p, V(0, 0.8, 0.2), 180, 7, 2.4, -1.4, time); fx.sparks.emit(p, V(0, 0.5, 0.4), 120, 5, 2.4, -2.2, time + 0.1); fx.puffs.emit(V(0, 0, -11), 20, 3.6, 2, time); pv.boomAt.set(0, 2, -10); pv.boomK = 1.1; this.lens.trauma = 0.7; sound.play('boom', { gain: 0.9, wet: 0.8 }); sound.play('sub', { gain: 0.8 }); });
    if (t > 8 && t < 14 && Math.random() < 0.8) fx.sparks.emit(V((Math.random() - 0.5) * 7, 0.2 + Math.random() * 3, m.z - 2 - Math.random() * 6), V(0, 0.6, 0.5), 3, 1, 1.8, -1.6, time);
    c.at(t, 11.5, 'eye', () => { sound.play('heart', { gain: 0.6 }); });
    if (t > 11.6 && t < 14.2) pv.ember = Math.max(0.2, pv.ember - dt * 0.6);
    c.at(t, 14.2, 'rest', () => { m.begin('flick'); sound.play('whooshH', { gain: 0.5 }); });
    c.at(t, 14.9, 'title', () => { hud.say('Morning, at Last', 3.6, 'victory', 'The dead lie still. The fire remembers their names.'); sound.play('bra', { gain: 0.5, bus: 'music', wet: 0.7 }); sound.play('cho', { gain: 0.6, bus: 'music', wet: 0.9 }); sound.play('sub', { gain: 0.5 }); });
    if (t >= END_LEN && !this.over) { this.over = true; this.clear = 1; this.dawn = 1; document.body.classList.remove('cine'); hud.won(f); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k2 } = this.kit, m = f.m, k = f.king, t = this.t, L = this.lens, s = Math.sin(this.Y), c = Math.cos(this.Y);
    if (t < 3.6) { const u = E(0, 3.6, t); // in front of him, low: the turn, and what he has turned his back on
      L.aim(cam, 1, V(m.x + s * (3.1 - u * 0.5) + c * 0.75, 0.55 + u * 0.15, m.z + c * (3.1 - u * 0.5) - s * 0.75), V(m.x - s * 0.8, 1.35, m.z - c * 0.8), 44 - u * 4, time); }
    else if (t < 6.6) { const u = E(3.6, 6.6, t), h = k2.hurt(V()); L.aim(cam, 2, V(k.x + s * 2.6 - c * (1.5 - u * 0.8), 0.6 + u * 0.5, k.z + c * 2.6 + s * (1.5 - u * 0.8)), h.setY(Math.min(1.7, h.y) + 0.15 + u * 0.15), 44, time, -0.03); }
    else if (t < 11.3) { const u = E(6.6, 11.3, t); L.aim(cam, 3, V(m.x + 0.5 - u * 0.2, 0.85 + u * 0.2, m.z + 4.2 - u * 1.3), V(m.x - 0.1, 1.25 + u * 0.1, m.z - 1), 34, time); }
    else if (t < 14.1) { const u = E(11.3, 14.1, t); L.aim(cam, 4, V(m.x + 0.9, 1.5, m.z + 1.0 - u * 0.1), V(m.x, 1.53, m.z), 30, time); }
    else { const u = E(14.1, 22, t); L.aim(cam, 5, V(m.x - 1.4 - u * 0.6, 1.1 + u * 3.4, m.z + 3.4 + u * 4.2), V(m.x, 1.5 + u * 0.3, m.z - 4), 46, time); }
  }
}
