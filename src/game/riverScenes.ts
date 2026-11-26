// The Ferryman's scenes: the way in (the crossing and what he guards), the turn (the net thrown off), and the way out (a lamp touched to a boat). All skippable.
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
import { LEVEL } from '../render/water.ts';
import type { Hud } from '../ui/hud.ts';
import { Cues, Lens } from './scenes.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface RiverKit { f: Fight; pv: PlayerView; k1: RiverView; k2: RiverView; fx: Fx; hud: Hud; ghats: Awaited<ReturnType<typeof buildGhats>>; rd: RiverDirector }

// ---------------------------------------------------------------- the way in
// The river at night. You set a lamp on the water to call the ferry. Every lamp on the river goes out, from the far bank toward you, and last of all yours.
// One lantern, far out. Then a pole comes down through the dark in front of you, and he stands up out of the river, hat first.
// Under the hat, behind the coins, two eyes. He drives the pole into the riverbed and the lamps run back to the horizon.
export const INTRO_LEN = 26.8;
const B = { lamp: 7.4, out: 9.9, last: 11.7, far: 14.1, plunge: 15.3, rise: 15.45, risen: 18.6, eyes: 19.4, line: 20.1, lift: 21.5, slam: 22.65, title: 24.3 };
export class RiverIntro {
  t = INTRO_LEN; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; onEnd: () => void = () => { };
  private lamp = new THREE.Group(); private lampGlow: THREE.Sprite; private lp = V(); private lv = V(); private eyeK = 1; private dark = 0; private black = 0; private tongue!: THREE.Sprite;
  constructor(kit: RiverKit) {
    this.kit = kit;
    const bowl = kit.ghats.bowlMesh();
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,210,140,1)'); g.addColorStop(0.14, 'rgba(255,150,60,.6)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(1.0, 0.62, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.lampGlow.position.y = 0.11; this.lampGlow.scale.setScalar(0.2);
    const tongue = new THREE.Sprite((this.lampGlow.material as THREE.SpriteMaterial).clone()); (tongue.material as THREE.SpriteMaterial).color.setRGB(1.6, 1.0, 0.5); tongue.position.y = 0.11; tongue.scale.set(0.045, 0.11, 1); this.tongue = tongue; tongue.renderOrder = this.lampGlow.renderOrder = 6; this.lamp.add(bowl, tongue, this.lampGlow); this.lamp.visible = false; kit.ghats.group.add(this.lamp);
  }
  get active() { return this.t < INTRO_LEN; }
  /** At rest: the hero at the top of the steps, the Ferryman far out in the dark. */
  rest() { const { f, k1 } = this.kit, k = f.king as River; k.form = 1; k.x = 0; k.z = -26; k.y = 0; k.yaw = 0; k.set('idle'); k1.settle(); k1.eyes(1); k1.show(true); }
  start() { const { f, pv } = this.kit, m = f.m; this.t = 0; this.c.clear(); this.lens.cut = 0; this.lens.trauma = 0; this.rest(); m.revive(0, 15.5, Math.PI); pv.reset(); this.kit.rd.reset(); this.kit.ghats.lamps(1, true); this.kit.ghats.setOut(0, 0, 0); this.kit.ghats.setFront(0); this.kit.ghats.flames(1); this.lamp.visible = false; this.eyeK = 0; this.dark = 0; this.black = 0; this.kit.k1.show(false); sound.score?.set('vigil'); }
  stop() { this.t = INTRO_LEN; this.kit.hud.verse(''); this.restore(); }
  skip() { if (!this.active || this.t < 0.6) return; this.c.off = true; this.t = INTRO_LEN; this.finish(); }
  /** However it ended, the river is as the fight needs it. */
  private restore() { const { ghats, k1, f } = this.kit, k = f.king as River; this.kit.rd.cine = null; ghats.setOut(0, 0, 0); ghats.setFront(0); ghats.flames(1); ghats.lamps(1); this.lamp.visible = false; ghats.bowlsLit(true); k1.eyes(1); if (k.form === 1) k1.show(true); if (k.form === 1) { k.y = 0; if (k.z < -4.5 || k.z > -3.5) { k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); k1.settle(); } } }
  private finish() { this.kit.hud.verse(''); this.restore(); this.onEnd(); }
  /** Returns the hero's forward walk. */
  step(dt: number, time: number): number {
    const { f, fx, hud, ghats, k1 } = this.kit, m = f.m, k = f.king as River, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.6);
    // words: few, and only where nothing else is speaking
    c.at(t, 0.8, 'w1', () => hud.verse('After the fire comes the crossing.'));
    c.at(t, 4.0, 'w1x', () => hud.verse(''));
    c.at(t, 4.8, 'w2', () => hud.verse('Set a lamp on the water, and the ferry will come.'));
    c.at(t, 8.4, 'w2x', () => hud.verse(''));
    c.at(t, 0.05, 'hush', () => { sound.duck(0.5, 3); sound.play('wave', { gain: 0.35, wet: 0.8 }); });
    const walk = t > 1.0 && t < 6.6 ? -0.5 : 0;
    // the hero's lamp: set down, drifting out ahead of the dark
    c.at(t, B.lamp, 'lamp', () => { this.lp.set(m.x + 0.1, LEVEL, m.z - 1.0); this.lv.set(0, 0, -1.25); this.lamp.visible = true; ghats.ripple(this.lp.x, this.lp.z, 1.2, time); sound.play('lampSet', { gain: 0.9, wet: 0.5 }); fx.sparks.emit(this.lp.clone().add(V(0, 0.15, 0)), V(0, 0.6, 0), 18, 1.2, 1.6, -1.2, time); });
    if (this.lamp.visible) { this.lv.multiplyScalar(Math.exp(-dt * 0.45)); this.lp.addScaledVector(this.lv, dt); this.lamp.position.set(this.lp.x, LEVEL - 0.035 + Math.sin(time * 1.9) * 0.012, this.lp.z); this.lamp.rotation.set(Math.sin(time * 1.3) * 0.06, 0, Math.cos(time * 1.1) * 0.06); this.lampGlow.scale.setScalar(0.2 * (0.9 + 0.1 * Math.sin(time * 9)) * (t > B.last ? Math.max(0, 1 - (t - B.last) * 5) : 1)); this.tongue.visible = t < B.last; this.tongue.scale.set(0.045, 0.11 * (0.85 + 0.25 * Math.sin(time * 17)), 1); }
    // the dark comes in off the river from the far bank, and the last lamp to go out is yours
    if (t >= B.out && t < B.plunge) { const u = Math.min(1, (t - B.out) / (B.last - 0.2 - B.out)); ghats.setOut(0, -110, 1 + Math.pow(u, 0.8) * 125); }
    c.at(t, B.out, 'out', () => { sound.duck(0.15, 4); sound.play('lampOut', { gain: 0.5, wet: 0.95 }); sound.play('whisper', { gain: 0.5, wet: 0.9 }); });
    c.at(t, B.out + 0.7, 'out2', () => sound.play('lampOut', { gain: 0.7, wet: 0.85 }));
    c.at(t, B.out + 1.3, 'out3', () => { sound.play('lampOut', { gain: 0.85, wet: 0.7 }); ghats.flames(0); ghats.bowlsLit(false); });
    c.at(t, B.last, 'last', () => { sound.play('lampOut', { gain: 1, wet: 0.4 }); fx.puffs.emit(this.lp.clone().add(V(0, 0.2, 0)), 4, 0.4, 0.5, time); });
    this.dark += ((t > B.out + 1.2 && t < B.slam ? 1 : 0) - this.dark) * Math.min(1, dt * 3);
    // far out, one lantern: him, on the water
    if (t < B.plunge) { k.x = 0; k.z = -26; k.y = 0; k.yaw = 0; }
    c.at(t, B.last + 0.9, 'held', () => { sound.play('heart', { gain: 0.7, wet: 0.4 }); });
    c.at(t, B.last + 1.8, 'held2', () => { sound.play('heart', { gain: 0.85, wet: 0.4 }); });
    c.at(t, B.far, 'lantern', () => { k1.show(true); k1.eyes(0); sound.play('lanternRise', { gain: 0.8, wet: 0.8 }); });
    this.black += ((t > B.last + 0.12 && t < B.far ? 1 : 0) - this.black) * Math.min(1, dt * (t < B.far ? 7 : 1.6));
    this.kit.rd.cine = { black: this.black, lamps: t > B.out + 1.3 && t < B.slam ? 0 : 1, lantern: t < B.far ? (t < B.out + 1 ? 1 : 0) : t < B.plunge ? E(B.far, B.far + 0.8, t) : 1, night: this.dark * 0.8 };
    // a pole comes down through the dark, close; the river opens, and he stands up out of it
    c.at(t, B.plunge, 'plunge', () => { k.x = 0; k.z = -4.2; k.y = -3.6; k.yaw = 0; k.set('idle'); k1.settle(); this.lamp.visible = false; sound.play('slam', { gain: 0.9, wet: 0.5 }); sound.play('wave', { gain: 0.8, wet: 0.6 }); ghats.ripple(0.6, -3.6, 2.4, time); fx.puffs.emit(V(0.6, 0.2, -3.6), 16, 2.6, 1.4, time); this.lens.trauma = 0.55; });
    if (t >= B.plunge && t < B.risen + 0.4) { const u = E(B.rise, B.risen, t); k.y = -3.6 + 3.6 * (u * 0.85 + 0.15 * Math.pow(u, 3)); k.x = 0; k.z = -4.2; if (Math.random() < dt * 14) ghats.ripple((Math.random() - 0.5) * 1.6, -4.2 + (Math.random() - 0.5) * 1.2, 0.8, time); if (Math.random() < dt * 30 && k.y > -3) fx.puffs.emit(V((Math.random() - 0.5) * 1.1, 0.15, -4.2 + (Math.random() - 0.5) * 0.9), 1, 0.9, 1.2, time); }
    c.at(t, B.rise, 'rise', () => { sound.play('boatRise', { gain: 0.9, wet: 0.6 }); sound.play('drain', { gain: 0.8, wet: 0.6 }); sound.play('riserL', { gain: 0.5 }); });
    c.at(t, B.risen, 'risen', () => { k.y = 0; sound.play('thud', { gain: 0.6, wet: 0.4 }); ghats.ripple(0, -4.2, 1.6, time); });
    // under the hat, behind the coins, he opens his eyes; he says the law
    this.eyeK += ((t >= B.eyes ? 1 : 0) - this.eyeK) * Math.min(1, dt * (t >= B.eyes ? 7 : 20)); k1.eyes(this.eyeK * (t >= B.eyes && t < B.eyes + 0.35 ? 0.6 + 0.4 * Math.sin((t - B.eyes) * 40) : 1));
    c.at(t, B.eyes, 'eyes', () => { sound.play('kBreath', { gain: 0.6, wet: 0.5, bus: 'voice' }); });
    c.at(t, B.line, 'line', () => { hud.verse('"Only ash may cross."'); sound.play('fCall', { gain: 0.95, wet: 0.55, bus: 'voice' }); });
    c.at(t, B.lift, 'lift', () => { hud.verse(''); k.set('plant'); sound.play('creak', { gain: 0.8, wet: 0.5 }); });
    // the pole goes into the riverbed: the lamps run back out to the far bank, brighter than before
    c.at(t, B.slam, 'slam', () => { sound.play('braam', { gain: 0.85 }); sound.play('boom', { gain: 0.8 }); sound.play('flare', { gain: 0.7, wet: 0.6 }); sound.duck(0.5, 1.4); this.lens.trauma = 1; ghats.setOut(0, 0, 0); ghats.flames(1); ghats.bowlsLit(true); ghats.ripple(0, -3.6, 4.5, time); fx.puffs.emit(V(0, 0.3, -3.4), 26, 4, 2, time); fx.sparks.emit(V(0, 0.4, -3.4), V(0, 1, 0), 60, 6, 2.2, 0.6, time); });
    if (t >= B.slam) ghats.setFront(t < B.title + 2 ? Math.max(0.01, (t - B.slam) * 60) : 0);
    c.at(t, B.title, 'title', () => { hud.say('The Ferryman', 2.6, 'title', 'He has never lost a fare.'); sound.play('rise', { gain: 0.6, wet: 0.6 }); });
    if (t >= INTRO_LEN) this.finish();
    return walk;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, base: number) {
    const { f, k1 } = this.kit, m = f.m, t = this.t, L = this.lens, lp = this.lp;
    if (t < 4.6) { const u = E(0, 4.6, t); L.aim(cam, 1, V(-3.2 + u * 2.6, 0.42 + u * 0.55, 4.5 - u * 2.2), V(0, 0.7, -60), 42, time); }
    else if (t < B.lamp + 0.4) { const u = E(4.6, B.lamp + 0.4, t); L.aim(cam, 2, V(m.x + 1.0 - u * 0.4, 1.05 - u * 0.25, m.z + 2.7 - u * 0.5), V(m.x - 0.1, 0.7 - u * 0.4, m.z - 3), 40, time); }
    else if (t < B.last + 0.5) { const u = E(B.lamp + 0.4, B.last + 0.5, t); L.aim(cam, 3, V(lp.x + 0.9 - u * 0.5, 0.3 + u * 0.08, lp.z + 1.7 + u * 0.4), V(lp.x - 0.2, 0.25, lp.z - 8), 38 - u * 4, time); }
    else if (t < B.plunge) { const u = E(B.last + 0.5, B.plunge, t); L.aim(cam, 4, V(m.x - 0.7, 1.5, m.z + 2.3 - u * 0.6), V(0, 1.7, -26), 26 - u * 3, time); }
    else if (t < B.risen + 0.3) { const u = E(B.rise, B.risen, t); L.aim(cam, 5, V(1.9 - u * 0.6, 0.32, -0.4 - u * 0.3), V(0, 0.4 + u * 2.3, -4.2), 42 - u * 4, time, 0.02); }
    else if (t < B.lift + 0.2) { const h = k1.eyeAt(V()), u = E(B.risen + 0.3, B.lift, t); L.aim(cam, 6, V(h.x + 0.3 - u * 0.25, h.y - 0.95 + u * 0.22, h.z + 1.6 - u * 0.68), V(h.x, h.y - 0.08 + u * 0.06, h.z), 40 - u * 7, time); }
    else if (t < B.title) { const u = E(B.lift + 0.2, B.title, t); L.aim(cam, 7, V(m.x + 2.4 - u * 0.6, 0.75 + u * 0.5, m.z + 3.6), V(0, 1.4 + u * 0.3, -9), 52, time); }
    else { const u = E(B.title, INTRO_LEN, t); L.aim(cam, 8, V(m.x + 1.2, 1.5, m.z + 3.2 - u * 0.4), V(0, 1.9, -4), base - 2, time); }
  }
  /** 0-1: how much of the night has come in; the director may darken the frame with it. */
  get night() { return this.dark; }
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
    c.at(t, 7.4, 'hands', () => { sound.play('moan', { gain: 0.6, wet: 0.9 }); hud.verse('Every one of them has paid. He sets them down.'); for (let i = 0; i < 6; i++) ghats.ripple((Math.random() - 0.5) * 18, -4 + (Math.random() - 0.5) * 18, 1.2, time + i * 0.1); });
    c.at(t, 9.6, 'swell', () => { this.become(); hud.verse(''); sound.play('drain', { gain: 1, wet: 0.7 }); this.lens.trauma = 0.6; });
    if (t > 9.6 && t < 13.4 && Math.random() < 0.5) ghats.ripple((Math.random() - 0.5) * 8, -5 + (Math.random() - 0.5) * 8, 1.6, time);
    c.at(t, 11.0, 'net', () => { sound.play('snap', { gain: 0.9, wet: 0.6 }); sound.play('wave', { gain: 0.7, wet: 0.7 }); this.lens.trauma = 0.8; ghats.ripple(0, -5, 3, time); fx.puffs.emit(V(0, 0.4, -5), 24, 4, 2, time); for (let i = 0; i < 40; i++) fx.sparks.emit(V((Math.random() - 0.5) * 1.6, 1 + Math.random() * 2.4, -5 + (Math.random() - 0.5) * 1.6), V((Math.random() - 0.5), 0.6, (Math.random() - 0.5)), 2, 4, 1.6, 0.9, time); });
    c.at(t, 12.1, 'rise', () => { sound.play('wRoar', { gain: 0.9, wet: 0.7, bus: 'voice' }); sound.play('braam', { gain: 0.9 }); sound.duck(0.35, 1.2); this.lens.trauma = 1; ghats.lamps(0.6); ghats.ripple(0, -5, 4, time); fx.sparks.emit(V(0, 2, -5), V(0, 1.5, 0), 120, 7, 2, -1.2, time); });
    c.at(t, 15.6, 'lamps', () => { sound.play('aura2', { gain: 0.8, wet: 0.7 }); });
    c.at(t, 17.2, 'title', () => { hud.say('The Unburdened', 2.8, 'title', 'Every fare he ever took has come up out of the river to him.'); sound.play('boom', { gain: 0.8 }); });
    this.mono = t < 2 ? 0.0 : t < 9.6 ? 0.55 * E(1.5, 4, t) : 0.4 * (1 - E(12.1, 16, t));
    if (t >= TURN_LEN) { this.stop(); hud.verse(''); f.beginRound2(); k.set('riseW'); k.mt = k.prev = 3.2; this.onEnd(); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f } = this.kit, m = f.m, t = this.t, L = this.lens, k = f.king as River;
    if (t < 4.2) { const u = E(0, 4.2, t); L.aim(cam, 1, V(m.x + 3.2 - u * 0.8, 0.9 + u * 0.1, m.z - 0.6), V(k.x, 1.0 - u * 0.3, k.z), 40, time); }
    else if (t < 9.6) { const u = E(4.2, 9.6, t); L.aim(cam, 2, V(m.x - 1.0, 0.35 + u * 0.1, m.z + 2.0), V(0, 0.5 + u * 0.5, -7), 36, time, -0.02); }
    else if (t < 12.2) { const u = E(9.6, 12.2, t); L.aim(cam, 3, V(2.4, 0.5 + u * 0.3, 3.2), V(0, 0.8 + u * 1.2, -5), 44, time); }
    else if (t < 15.6) { const u = E(12.1, 15.6, t); L.aim(cam, 4, V(-1.6 + u * 0.8, 0.8, 1.8 - u * 0.5), V(0, 2.4 + u * 1.2, -5), 50, time); }
    else if (t < 18.4) { const u = E(15.6, 18.4, t); L.aim(cam, 5, V(2.2 - u * 0.6, 1.3 + u * 0.2, -1.6 + u * 0.4), V(0, 1.9, -5), 38 - u * 4, time, 0.03); }
    else { const u = E(18.4, 21.5, t); L.aim(cam, 6, V(m.x + 1.0, 1.4, m.z + 3.4 - u * 0.5), V(0, 2.2, -5), 46, time); }
  }
}

// ---------------------------------------------------------------- the way out
export const END_LEN = 29;
/** He goes down for the last time, the boat rises, and the fire runs from lamp to lamp to the far bank. */
export class RiverEnding {
  t = -1; over = false; dawn = 0; /** How far the lamps have caught, in metres from the boat. */ front = 0; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; private A = V();
  constructor(kit: RiverKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const m = this.kit.f.m; this.t = 0; this.over = false; this.dawn = 0; this.front = 0; this.c.clear(); this.lens.cut = 0; this.A.set(m.x, 0, m.z); document.body.classList.add('cine'); sound.score?.set('scene'); }
  stop() { this.t = -1; this.dawn = 0; this.front = 0; this.over = false; this.kit.f.sceneMove = { x: 0, z: 0 }; this.kit.k2.boat(false); this.kit.k2.standing(false); this.kit.hud.verse(''); this.kit.ghats.lamps(1, true); this.kit.ghats.setFront(0); document.body.classList.remove('cine'); DAWN.value = 0; }
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
