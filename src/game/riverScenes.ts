// The Ferryman's scenes: the way in (the crossing and what he guards), the turn to the Weight, and the way out (a lamp touched to a boat). All skippable.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { RiverView } from '../boss/river/riverView.ts';
import type { River } from '../boss/river/river.ts';
import type { RiverDirector } from '../boss/river/riverDirector.ts';
import type { buildGhats } from '../arena/ghats.ts';
import type { Fight } from '../combat/fight.ts';
import type { PlayerView } from '../player/view.ts';
import type { Fx } from '../render/impact.ts';
import { DAWN } from '../render/sky.ts';
import type { Hud } from '../ui/hud.ts';
import { Cues, Lens } from './scenes.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface RiverKit { f: Fight; pv: PlayerView; k1: RiverView; k2: RiverView; fx: Fx; hud: Hud; ghats: Awaited<ReturnType<typeof buildGhats>>; rd: RiverDirector }

// ---------------------------------------------------------------- the way in
export const INTRO_LEN = 23.5;
export const LORE = [
  'After the fire comes the crossing. A ferryman takes what is left across the Slow River, and pours it out where mornings start.',
  'The river has one law: only ash may cross. Ash weighs nothing.',
  'The Ferryman laid his daughter in the boat, unburned, under the jars of other people\'s ash. The river noticed.',
  'Behind him the dead walked into the water to reach the morning. Every one of them has paid. They hold on.',
  'You carry the King\'s ash down the steps, and set a lamp on the river to call the ferry. He will not let you.',
];
export class RiverIntro {
  t = INTRO_LEN; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; onEnd: () => void = () => { }; private line = -1;
  constructor(kit: RiverKit) { this.kit = kit; }
  get active() { return this.t < INTRO_LEN; }
  /** At rest: the hero at the top of the steps, the Ferryman far out in the dark. */
  rest() { const { f, k1 } = this.kit, k = f.king as River; k.form = 1; k.x = 0; k.z = -26; k.yaw = 0; k.set('idle'); k1.settle(); }
  start() { const { f, pv } = this.kit, m = f.m; this.t = 0; this.line = -1; this.c.clear(); this.lens.cut = 0; this.lens.trauma = 0; this.rest(); m.revive(0, 15.5, Math.PI); pv.reset(); this.kit.rd.reset(); this.kit.ghats.lamps(1, true); sound.score?.set('vigil'); }
  stop() { this.t = INTRO_LEN; this.kit.hud.verse(''); }
  skip() { if (!this.active || this.t < 0.6) return; this.c.off = true; this.kit.hud.verse(''); this.t = INTRO_LEN; this.finish(); }
  private finish() { this.kit.hud.verse(''); this.onEnd(); }
  /** Returns the hero's forward walk. */
  step(dt: number, time: number): number {
    const { f, pv, fx, hud, ghats } = this.kit, m = f.m, k = f.king as River, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.6);
    const i = Math.min(LORE.length - 1, Math.floor(t / 4.2)); if (t < 21.5 && i !== this.line) { this.line = i; hud.verse(LORE[i]); } else if (t >= 21.5 && this.line !== 9) { this.line = 9; hud.verse(''); }
    c.at(t, 0.05, 'hush', () => { sound.duck(0.5, 3); });
    // the hero goes down to the water and sets a lamp on it
    const walk = t > 1.0 && t < 6.6 ? -0.5 : 0, kneel = t > 12.5 && t < 15.5; void kneel;
    c.at(t, 12.6, 'lamp', () => { ghats.ripple(m.x, m.z - 1.2, 1.6, time); sound.play('lampSet', { gain: 0.8, wet: 0.5 }); fx.sparks.emit(V(m.x, 0.3, m.z - 1), V(0, 0.6, 0), 24, 1.6, 2, -1.2, time); });
    // far out, a lantern; then a man walking up out of the river
    if (t > 13.5 && t < 20.4) { const u = E(13.5, 20.2, t); if (k.mode === 'idle' && u > 0.02) k.set('stalk'); k.z = Math.min(-4, -26 + (Math.min(-4, k.z) + 26) * 0 + 22 * u); k.x = 0; k.yaw = 0; if (u > 0.98) k.set('idle'); }
    c.at(t, 13.6, 'lantern', () => { sound.play('lanternRise', { gain: 0.8, wet: 0.7 }); ghats.lamps(0.5); });
    c.at(t, 16.4, 'dark', () => { ghats.lamps(0.12); });
    c.at(t, 20.6, 'title', () => { hud.say('The Ferryman', 2.4, 'title', 'Only ash may cross.'); sound.play('fCall', { gain: 0.9, wet: 0.6, bus: 'voice' }); sound.play('braam', { gain: 0.7 }); ghats.lamps(1); this.lens.trauma = 0.7; ghats.ripple(0, -4, 3, time); fx.puffs.emit(V(0, 0.2, -4), 14, 3, 1.5, time); });
    if (t >= INTRO_LEN) this.finish();
    return walk;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, base: number) {
    const { f } = this.kit, m = f.m, k = f.king as River, t = this.t, L = this.lens;
    if (t < 4.2) { const u = E(0, 4.2, t); L.aim(cam, 1, V(-5 + u * 4, 1.7 + u * 0.4, 18 - u * 2), V(0, 0.7, -28), 40, time); }
    else if (t < 8.6) { const u = E(4.2, 8.6, t); L.aim(cam, 2, V(m.x + 2.6 - u * 0.6, 1.1, m.z + 3.6 - u * 0.6), V(m.x - 0.2, 1.2, m.z - 2.4), 38, time); }
    else if (t < 12.6) { const u = E(8.6, 12.6, t); L.aim(cam, 3, V(m.x - 2.4 + u * 0.5, 0.5, m.z - 3.2), V(m.x, 1.0 - u * 0.2, m.z + 0.4), 36, time); }
    else if (t < 16.2) { const u = E(12.6, 16.2, t); L.aim(cam, 4, V(m.x + 1.4, 0.9 + u * 0.3, m.z + 2.4), V(0, 1.2, -16), 32, time); }
    else if (t < 20.5) { const u = E(16.2, 20.5, t); L.aim(cam, 5, V(2.2 - u * 1.4, 0.5, 2.2 - u * 1.5), V(0, 1.7, k.z), 40 - u * 4, time); }
    else { const u = E(20.5, 23.5, t); L.aim(cam, 6, V(m.x + 1.2, 1.5, m.z + 3.2 - u * 0.4), V(0, 1.8, -4), base - 2, time); }
  }
}

// ---------------------------------------------------------------- the turn
export const TURN_LEN = 21.5;
/** He folds, the lamps go out, the dead stand up in the water, and what they hold rises: the hull on end, and twenty metres behind it. */
export class RiverTurn {
  t = -1; mono = 0; rate = 1; onEnd: () => void = () => { }; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; private off = false;
  constructor(kit: RiverKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const { f } = this.kit, m = f.m, k = f.king as River; this.t = 0; this.off = false; this.c.clear(); this.lens.cut = 0; this.mono = 0; if (Math.hypot(m.x - k.x, m.z - k.z) < 3.4) { m.revive(k.x, k.z + 3.6, Math.PI); this.kit.pv.reset(); } document.body.classList.add('cine'); sound.score?.set('scene'); }
  stop() { this.t = -1; this.mono = 0; document.body.classList.remove('cine'); }
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.c.off = true; this.kit.hud.verse(''); this.t = TURN_LEN; }
  private become() { const { f, k1, k2, ghats } = this.kit, k = f.king as River, m = f.m; if (k.form === 2) return; k1.show(false); k.form = 2; k.set('riseW'); k.x = 0; k.z = -5; k.y = 0; k.yaw = 0; k.reset(); k2.show(true); k2.settle(); ghats.lamps(0.28, true); if (Math.hypot(m.x, m.z - 5) > 0.8) { m.revive(0, 5, Math.PI); this.kit.pv.reset(); } }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const t = this.t, { f, fx, hud, ghats } = this.kit, k = f.king as River, m = f.m, c = this.c, L = this.lens; L.trauma *= Math.exp(-dt * 2.4);
    if (!this.off && k.form === 1 && (k.mode === 'fall') && k.mt > 3.0) k.mt = k.prev = 3.0;
    c.at(t, 0.1, 'hush', () => { sound.duck(0.3, 4); sound.play('fDeath', { gain: 1, wet: 0.6, bus: 'voice' }); });
    c.at(t, 1.5, 'lampsOut', () => { ghats.lamps(0.0); sound.play('lampOut', { gain: 1, wet: 0.6 }); });
    c.at(t, 4.2, 'line1', () => hud.verse('"She weighs nothing. Feel. She weighs nothing."'));
    c.at(t, 7.4, 'hands', () => { sound.play('armsRise', { gain: 1, wet: 0.8 }); sound.play('moan', { gain: 0.6, wet: 0.9 }); hud.verse('Every one of them has paid.'); for (let i = 0; i < 6; i++) ghats.ripple((Math.random() - 0.5) * 18, -4 + (Math.random() - 0.5) * 18, 1.2, time + i * 0.1); });
    c.at(t, 9.6, 'swell', () => { this.become(); hud.verse(''); sound.play('drain', { gain: 1, wet: 0.7 }); this.lens.trauma = 0.6; });
    if (t > 9.6 && t < 13.4 && Math.random() < 0.5) ghats.ripple((Math.random() - 0.5) * 8, -5 + (Math.random() - 0.5) * 8, 1.6, time);
    c.at(t, 12.1, 'rise', () => { sound.play('breach', { gain: 1.2, wet: 0.6 }); sound.play('wRoar', { gain: 1, wet: 0.7, bus: 'voice' }); sound.play('braam', { gain: 0.9 }); sound.duck(0.35, 1.2); this.lens.trauma = 1; ghats.ripple(0, -5, 4, time); fx.puffs.emit(V(0, 0.3, -5), 30, 5, 2.4, time); fx.sparks.emit(V(0, 2, -5), V(0, 1.5, 0), 120, 7, 2, 0.9, time); });
    c.at(t, 15.6, 'sections', () => { sound.play('wave', { gain: 0.9, wet: 0.7 }); });
    c.at(t, 17.2, 'title', () => { hud.say('The Weight', 2.8, 'title', 'Only ash may cross.'); sound.play('boom', { gain: 0.8 }); });
    this.mono = t < 2 ? 0.0 : t < 9.6 ? 0.55 * E(1.5, 4, t) : 0.4 * (1 - E(12.1, 16, t));
    if (t >= TURN_LEN) { this.stop(); hud.verse(''); f.beginRound2(); k.set('riseW'); k.mt = k.prev = 3.2; this.onEnd(); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f } = this.kit, m = f.m, t = this.t, L = this.lens, k = f.king as River;
    if (t < 4.2) { const u = E(0, 4.2, t); L.aim(cam, 1, V(m.x + 3.2 - u * 0.8, 0.9 + u * 0.1, m.z - 0.6), V(k.x, 1.0 - u * 0.3, k.z), 40, time); }
    else if (t < 9.6) { const u = E(4.2, 9.6, t); L.aim(cam, 2, V(m.x - 1.0, 0.35 + u * 0.1, m.z + 2.0), V(0, 0.5 + u * 0.5, -7), 36, time, -0.02); }
    else if (t < 12.2) { const u = E(9.6, 12.2, t); L.aim(cam, 3, V(2.4, 0.5 + u * 0.3, 3.2), V(0, 0.8 + u * 1.2, -5), 44, time); }
    else if (t < 15.6) { const u = E(12.1, 15.6, t); L.aim(cam, 4, V(-1.6 + u * 0.8, 0.8, 1.8 - u * 0.5), V(0, 2.4 + u * 1.2, -5), 50, time); }
    else if (t < 18.4) { const u = E(15.6, 18.4, t); L.aim(cam, 5, V(9 - u * 3, 3.2 + u * 1.5, 9), V(-3, 0.6, -10), 56, time); }
    else { const u = E(18.4, 21.5, t); L.aim(cam, 6, V(m.x + 1.0, 1.4, m.z + 3.4 - u * 0.5), V(0, 2.2, -5), 46, time); }
  }
}

// ---------------------------------------------------------------- the way out
export const END_LEN = 29;
/** The Weight comes apart into people, the boat rises, and the fire runs from lamp to lamp to the far bank. */
export class RiverEnding {
  t = -1; over = false; dawn = 0; /** How far the lamps have caught, in metres from the boat. */ front = 0; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; private A = V();
  constructor(kit: RiverKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const m = this.kit.f.m; this.t = 0; this.over = false; this.dawn = 0; this.front = 0; this.c.clear(); this.lens.cut = 0; this.A.set(m.x, 0, m.z); document.body.classList.add('cine'); sound.score?.set('scene'); }
  stop() { this.t = -1; this.dawn = 0; this.front = 0; this.over = false; this.kit.f.sceneMove = { x: 0, z: 0 }; this.kit.ghats.lamps(1, true); this.kit.ghats.setFront(0); document.body.classList.remove('cine'); DAWN.value = 0; }
  skip() { if (this.active && this.t > 2.2 && this.t < END_LEN) { this.c.off = true; this.t = END_LEN; this.dawn = 1; this.front = 400; } }
  step(dt: number, time: number) {
    if (!this.active) return; const { f, fx, hud, ghats, k2 } = this.kit, m = f.m, k = f.king as River, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.4);
    c.at(t, 0.05, 'hush', () => { sound.duck(0.05, 3); });
    c.at(t, 0.5, 'apart', () => { sound.play('wDeath', { gain: 1, wet: 0.7, bus: 'voice' }); sound.play('breach', { gain: 0.9, wet: 0.6 }); ghats.ripple(k.x, k.z, 4, time); fx.puffs.emit(V(k.x, 0.3, k.z), 30, 5, 2.4, time); this.lens.trauma = 0.8; });
    c.at(t, 4.4, 'people', () => { sound.play('moan', { gain: 0.5, wet: 0.9 }); k2.standing(true); });
    c.at(t, 7.2, 'boat', () => { sound.play('boatRise', { gain: 0.9, wet: 0.6 }); k2.boat(true); ghats.ripple(0, -9, 3, time); });
    c.at(t, 9.6, 'line1', () => hud.verse('He is an old man of ordinary size, with a bundle in his arms.'));
    c.at(t, 12.4, 'line2', () => hud.verse(''));
    // you walk out to it; this is the one blow you do not swing
    f.sceneMove = t > 9.4 && t < 14.4 ? { x: 0, z: -0.5 } : { x: 0, z: 0 };
    c.at(t, 15.0, 'touch', () => { const p = V(m.x, 1.0, m.z - 1.1); fx.bursts.add('fire', p, 2, 0.8, time); fx.bursts.add('flare', p, 4, 0.4, time); fx.sparks.emit(p, V(0, 0.6, -0.4), 60, 3, 2, -0.6, time); sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('lampSet', { gain: 0.8, wet: 0.5 }); this.lens.trauma = 0.3; });
    if (t > 15.3) this.front = (t - 15.3) * 14; ghats.setFront(this.front);
    c.at(t, 15.6, 'run', () => { sound.play('fireRun', { gain: 1, wet: 0.7 }); ghats.lamps(1); });
    this.dawn = E(17.5, 26, t); DAWN.value = this.dawn;
    c.at(t, 22.5, 'line3', () => hud.verse('"Call her by it. It is a good name."'));
    c.at(t, 26.6, 'quiet', () => hud.verse(''));
    if (t >= END_LEN && !this.over) { this.over = true; this.dawn = 1; document.body.classList.remove('cine'); hud.won(f); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f } = this.kit, m = f.m, k = f.king as River, t = this.t, L = this.lens;
    if (t < 4.4) { const u = E(0, 4.4, t); L.aim(cam, 1, V(m.x + 2.8 - u * 0.4, 0.8 + u * 0.2, m.z - 2.6), V(k.x, 1.8 - u * 0.5, k.z), 42, time); }
    else if (t < 9.6) { const u = E(4.4, 9.6, t); L.aim(cam, 2, V(-3 + u * 1.5, 0.45, 2.0), V(0, 0.9 + u * 0.6, -9), 36, time); }
    else if (t < 15.0) { const u = E(9.6, 15, t); L.aim(cam, 3, V(m.x + 1.3, 1.2, m.z + 3.0 - u * 0.6), V(0, 1.2, -8.5), 32, time); }
    else if (t < 21) { const u = E(15, 21, t); L.aim(cam, 4, V(m.x - 1.5 - u * 1.2, 1.0 + u * 2.2, m.z + 3.8 + u * 3.8), V(0, 1.1 + u * 0.7, -30), 44 + u * 6, time); }
    else { const u = E(21, 29, t); L.aim(cam, 5, V(m.x + 0.3, 1.2 + u * 0.6, m.z + 4.8), V(0, 1.5, -40), 48, time); }
  }
}
