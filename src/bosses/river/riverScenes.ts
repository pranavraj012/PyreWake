// The Ferryman's scenes: the way in (the crossing and what he guards), the turn (the net thrown off), and the way out (a lamp touched to a boat). All skippable.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import { MOONK } from '../../render/sky.ts';
import type { RiverView } from './riverView.ts';
import type { River } from './river.ts';
import type { RiverDirector } from './riverDirector.ts';
import type { buildGhats } from './ghats.ts';
import type { Fight } from '../../combat/fight.ts';
import type { PlayerView } from '../../player/view.ts';
import type { Fx } from '../../render/impact.ts';
import { DAWN } from '../../render/sky.ts';
import { LEVEL } from '../../render/water.ts';
import type { Hud } from '../../ui/hud.ts';
import { Cues, Lens } from '../../game/sceneKit.ts';
import { RIVER_ENDING, RIVER_INTRO, RIVER_TURN, speak } from './riverScript.ts';
import { CHAIN, DRAG, LANTERN, type River as RiverSim } from './river.ts';
import type { Motor, Press } from '../../player/motor.ts';
import type { MomentSpec, Prompt } from '../../game/moment.ts';

/** The flame in a hand: a soft orange point, drawn once. */
function flameCanvas(): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(0.16, 'rgba(255,150,60,.6)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; }
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface RiverKit { f: Fight; pv: PlayerView; k1: RiverView; k2: RiverView; fx: Fx; hud: Hud; ghats: Awaited<ReturnType<typeof buildGhats>>; rd: RiverDirector; /** The page's press prompt (the same one the moments use). */ prompt: Prompt }

// ---------------------------------------------------------------- the way in
// The river at night. You set a lamp on the water to call the ferry. Every lamp on the river goes out, from the far bank toward you, and last of all yours.
// The dark is held a while, and there is only sound in it: a pole drawn along the bottom, a breath. Then his eyes, close, behind the coins, and one low sting.
// A pole comes down through the water, and he stands up out of the river, hat first, and looms over you. He drives the pole into the riverbed and the lamps run back to the horizon.
export const INTRO_LEN = 53.4;
/** The telling (0-25): the river, the law, the drowned, what he keeps. Then the calling, slower than it was, with room to breathe. */
const B = { walk: 16.0, lamp: 26.6, out: 30.2, last: 32.6, reveal: 37.0, plunge: 39.8, rise: 39.95, risen: 43.2, eyes: 44.4, line: 45.6, lift: 48.2, slam: 49.4, title: 51.0 };
export class RiverIntro {
  t = INTRO_LEN; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; onEnd: () => void = () => { };
  private lamp = new THREE.Group(); private lampGlow: THREE.Sprite; private lp = V(); private lv = V(); private eyeK = 1; private dark = 0; private black = 0; private tongue!: THREE.Sprite;
  /** The telling holds at the lamp until the hero sets it down: the flame waits in his hand, and the prompt asks for the light. */
  waiting = false; private lit = false; private waitK = 0; private flameK = 0; private flame: THREE.Sprite;
  constructor(kit: RiverKit) {
    this.kit = kit;
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flameCanvas()), color: new THREE.Color(1, 0.62, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.flame.renderOrder = 6; this.flame.visible = false; kit.ghats.group.add(this.flame);
    const bowl = kit.ghats.bowlMesh();
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,210,140,1)'); g.addColorStop(0.14, 'rgba(255,150,60,.6)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(1.0, 0.62, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); this.lampGlow.position.y = 0.11; this.lampGlow.scale.setScalar(0.2);
    const tongue = new THREE.Sprite((this.lampGlow.material as THREE.SpriteMaterial).clone()); (tongue.material as THREE.SpriteMaterial).color.setRGB(1.6, 1.0, 0.5); tongue.position.y = 0.11; tongue.scale.set(0.045, 0.11, 1); this.tongue = tongue; tongue.renderOrder = this.lampGlow.renderOrder = 6; this.lamp.add(bowl, tongue, this.lampGlow); this.lamp.visible = false; kit.ghats.group.add(this.lamp);
  }
  get active() { return this.t < INTRO_LEN; }
  /** A tap on the screen while the telling waits for the light (touch controls are hidden in scenes). */
  tap(time: number) { if (this.waiting) this.light(time); }
  /** Before the lamp, any press skips the telling as it always has. At the lamp only the attack press lights it. True when the press was used. */
  press(ev: Press[], time: number): boolean {
    if (!this.active || !ev.some(e => !e.up)) return false;
    if (this.waiting) { if (ev.some(e => !e.up && e.a === 'attack')) this.light(time); return true; }
    if (this.t > 0.6) { this.skip(); return true; }
    return false;
  }
  /** Whether the lamp is set down on the water. */ get lampVisible() { return this.lamp.visible; }
  private light(_time: number) { this.lit = true; this.waiting = false; this.kit.prompt.hide(); }
  /** At rest: the hero at the top of the steps, the Ferryman far out in the dark. */
  rest() { const { f, k1 } = this.kit, k = f.king as River; k.form = 1; k.x = 0; k.z = -26; k.y = 0; k.yaw = 0; k.set('idle'); k1.settle(); k1.eyes(1); k1.show(true); }
  start() { const { f, pv } = this.kit, m = f.m; this.t = 0; this.c.clear(); this.resetHold(); this.lens.cut = 0; this.lens.trauma = 0; this.rest(); m.revive(0, 15.5, Math.PI); pv.reset(); this.kit.rd.reset(); this.kit.ghats.lamps(1, true); this.kit.ghats.setOut(0, 0, 0); this.kit.ghats.setFront(0); this.kit.ghats.flames(1); this.lamp.visible = false; this.eyeK = 0; this.dark = 0; this.black = 0; this.kit.k1.show(false); sound.score?.set('vigil'); }
  stop() { this.t = INTRO_LEN; this.kit.hud.verse(''); this.restore(); }
  private resetHold() { this.waiting = false; this.lit = false; this.waitK = 0; this.flameK = 0; this.flame.visible = false; MOONK.value = 1; this.kit.prompt.hide(); }
  skip() { if (!this.active || this.t < 0.6) return; this.c.off = true; this.t = INTRO_LEN; this.finish(); }
  /** However it ended, the river is as the fight needs it. */
  private restore() { const { ghats, k1, f } = this.kit, k = f.king as River; this.kit.rd.cine = null; this.resetHold(); ghats.setOut(0, 0, 0); ghats.setFront(0); ghats.flames(1); ghats.lamps(1); this.lamp.visible = false; ghats.bowlsLit(true); k1.eyes(1); k1.lampHidden = false; if (k.form === 1) k1.show(true); if (k.form === 1) { k.y = 0; if (k.z < -4.5 || k.z > -3.5) { k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); k1.settle(); } } }
  private finish() { this.kit.hud.verse(''); this.restore(); this.onEnd(); }
  /** Returns the hero's forward walk. */
  step(dt: number, time: number, dev: 'keys' | 'pad' | 'touch' = 'keys'): number {
    const { f, fx, hud, ghats, k1 } = this.kit, m = f.m, k = f.king as River, c = this.c; this.t += dt;
    // the lamp: the telling holds here until the hero sets it down
    if (!this.lit && this.t >= B.lamp) { this.t = B.lamp; if (!this.waiting) { this.waiting = true; this.waitK = 0; this.kit.prompt.show('attack', 'Set the light', 1e9, dev); } this.waitK += dt; }
    const t = this.t;
    if (this.waiting) this.flameK = Math.min(1, this.flameK + dt * 2); else if (this.lit && this.flameK > 0) this.flameK *= Math.exp(-dt * 2.2);
    { const fl = 0.9 + 0.1 * Math.sin(time * 9) + 0.06 * Math.sin(time * 19); this.flame.visible = this.flameK > 0.01; this.flame.position.set(m.x + 0.1, 1.05, m.z - 0.9); this.flame.scale.setScalar(0.8 * fl * (0.6 + 0.4 * this.flameK)); (this.flame.material as THREE.SpriteMaterial).opacity = this.flameK;
      if (this.waiting && Math.random() < dt * 9) fx.sparks.emit(this.flame.position.clone(), V(0, 0.5, -0.2), 1, 0.5, 1.4, -0.4, time); }
    MOONK.value = t >= B.reveal && t < B.lift + 0.2 ? 0 : 1; this.lens.trauma *= Math.exp(-dt * 2.6);
    // words: few, and only where nothing else is speaking
    speak(RIVER_INTRO.lines, t, (at, id, f) => c.at(t, at, id, f), v => hud.verse(v));
    c.at(t, 0.05, 'hush', () => { sound.duck(0.5, 3); sound.play('wave', { gain: 0.35, wet: 0.8 }); });
    const walk = t > B.walk && t < B.walk + 5.6 ? -0.5 : 0;
    // the telling: the river breathes under the words; the drowned stir when they are named; one heartbeat for what he hides
    c.at(t, 5.4, 'tell1', () => sound.play('wave', { gain: 0.3, wet: 0.9 }));
    c.at(t, 10.6, 'tell2', () => { sound.play('creak', { gain: 0.45, wet: 0.95 }); sound.play('oar', { gain: 0.4, wet: 0.95 }); });
    c.at(t, 15.8, 'drowned', () => { sound.play('moan', { gain: 0.45, wet: 0.95 }); sound.play('whisper', { gain: 0.4, wet: 0.95 }); });
    if (t > 15.8 && t < 20.2 && Math.random() < dt * 5) ghats.ripple(m.x + (Math.random() - 0.5) * 10, m.z - 9 - Math.random() * 10, 0.9, time);
    c.at(t, 20.8, 'kept', () => { sound.duck(0.25, 3.6); sound.play('heart', { gain: 0.55, wet: 0.5 }); });
    c.at(t, 22.4, 'kept2', () => sound.play('heart', { gain: 0.65, wet: 0.5 }));
    c.at(t, B.lamp - 1.6, 'riser', () => sound.play('riserL', { gain: 0.35, wet: 0.7 }));
    // the hero's lamp: set down, drifting out ahead of the dark
    if (this.lit) c.at(t, B.lamp, 'lamp', () => { this.lp.set(m.x + 0.1, LEVEL, m.z - 1.0); this.lv.set(0, 0, -1.25); this.lamp.visible = true; ghats.ripple(this.lp.x, this.lp.z, 1.2, time); sound.play('lampSet', { gain: 0.9, wet: 0.5 }); fx.sparks.emit(this.lp.clone().add(V(0, 0.15, 0)), V(0, 0.6, 0), 18, 1.2, 1.6, -1.2, time); });
    if (this.lamp.visible) { this.lv.multiplyScalar(Math.exp(-dt * 0.45)); this.lp.addScaledVector(this.lv, dt); this.lamp.position.set(this.lp.x, LEVEL - 0.035 + Math.sin(time * 1.9) * 0.012, this.lp.z); this.lamp.rotation.set(Math.sin(time * 1.3) * 0.06, 0, Math.cos(time * 1.1) * 0.06); this.lampGlow.scale.setScalar(0.2 * (0.9 + 0.1 * Math.sin(time * 9)) * (t > B.last ? Math.max(0, 1 - (t - B.last) * 5) : 1)); this.tongue.visible = t < B.last; this.tongue.scale.set(0.045, 0.11 * (0.85 + 0.25 * Math.sin(time * 17)), 1); }
    // the dark comes in off the river from the far bank, and the last lamp to go out is yours
    if (t >= B.out && t < B.plunge) { const u = Math.min(1, (t - B.out) / (B.last - 0.2 - B.out)); ghats.setOut(0, -110, 1 + Math.pow(u, 0.8) * 125); }
    c.at(t, B.out, 'out', () => { sound.duck(0.15, 4); sound.play('lampOut', { gain: 0.5, wet: 0.95 }); sound.play('whisper', { gain: 0.5, wet: 0.9 }); });
    c.at(t, B.out + 0.7, 'out2', () => sound.play('lampOut', { gain: 0.7, wet: 0.85 }));
    c.at(t, B.out + 1.3, 'out3', () => { sound.play('lampOut', { gain: 0.85, wet: 0.7 }); ghats.flames(0); ghats.bowlsLit(false); });
    c.at(t, B.last, 'last', () => { sound.play('lampOut', { gain: 1, wet: 0.4 }); fx.puffs.emit(this.lp.clone().add(V(0, 0.2, 0)), 4, 0.4, 0.5, time); });
    this.dark += ((t > B.out + 1.2 && t < B.slam ? 1 : 0) - this.dark) * Math.min(1, dt * 3);
    // far out, one lantern: him, on the water
    // far out, on the water, until the dark is cut; then he is close behind the hero's lamp-less shoulder, facing the lens
    if (t < B.reveal) { k.x = 0; k.z = -26; k.y = 0; k.yaw = 0; } else if (t < B.plunge) { k.x = m.x; k.z = m.z + 1.9; k.y = 0; k.yaw = 0; }
    // the dark is for listening: something drawn along the bottom, water, a breath close to the lens, and his heart-beat from nowhere
    c.at(t, 33.0, 'drag1', () => sound.play('poleDrag', { gain: 0.45, wet: 0.85 }));
    c.at(t, 34.0, 'dark1', () => sound.play('wave', { gain: 0.3, wet: 0.9 }));
    c.at(t, 35.8, 'drag2', () => sound.play('poleDrag', { gain: 0.6, wet: 0.85 }));
    c.at(t, 36.4, 'breath', () => sound.play('kBreath', { gain: 0.55, wet: 0.5, bus: 'voice' }));
    c.at(t, B.last + 0.9, 'held', () => { sound.play('heart', { gain: 0.7, wet: 0.4 }); });
    c.at(t, B.last + 1.8, 'held2', () => { sound.play('heart', { gain: 0.85, wet: 0.4 }); });
    c.at(t, B.last + 2.7, 'held3', () => { sound.play('heart', { gain: 1, wet: 0.4 }); });
    // the dark is cut by his eyes: the black goes at once, a low sting, and he is close to the lens, behind the veil
    c.at(t, B.reveal, 'reveal', () => { k1.show(true); k1.eyes(0); sound.play('dreadSting', { gain: 1, wet: 0.5 }); sound.duck(0.25, 2.5); this.lens.trauma = 0.5; });
    this.black += ((t > B.last + 0.12 && t < B.reveal ? 1 : 0) - this.black) * Math.min(1, dt * (t < B.reveal ? 7 : 30));
    k1.lampHidden = t >= B.reveal && t < B.slam;
    this.kit.rd.cine = { black: this.black, lamps: t > B.out + 1.3 && t < B.slam ? 0 : 1, lantern: t < B.reveal ? (t < B.out + 1 ? 1 : 0) : t < B.slam ? 0 : 1, night: this.dark * 0.8 };
    // a pole comes down through the dark, close; the river opens, and he stands up out of it
    c.at(t, B.plunge, 'plunge', () => { k.x = 0; k.z = -4.2; k.y = -3.6; k.yaw = 0; k.set('idle'); k1.settle(); this.lamp.visible = false; sound.play('slam', { gain: 0.9, wet: 0.5 }); sound.play('wave', { gain: 0.8, wet: 0.6 }); ghats.ripple(0.6, -3.6, 2.4, time); fx.puffs.emit(V(0.6, 0.2, -3.6), 16, 2.6, 1.4, time); this.lens.trauma = 0.55; });
    if (t >= B.plunge && t < B.risen + 0.4) { const u = E(B.rise, B.risen, t); k.y = -3.6 + 3.6 * (u * 0.85 + 0.15 * Math.pow(u, 3)); k.x = 0; k.z = -4.2; if (Math.random() < dt * 14) ghats.ripple((Math.random() - 0.5) * 1.6, -4.2 + (Math.random() - 0.5) * 1.2, 0.8, time); if (Math.random() < dt * 30 && k.y > -3) fx.puffs.emit(V((Math.random() - 0.5) * 1.1, 0.15, -4.2 + (Math.random() - 0.5) * 0.9), 1, 0.9, 1.2, time); }
    c.at(t, B.rise, 'rise', () => { sound.play('boatRise', { gain: 0.9, wet: 0.6 }); sound.play('drain', { gain: 0.8, wet: 0.6 }); sound.play('riserL', { gain: 0.5 }); });
    c.at(t, B.risen, 'risen', () => { k.y = 0; sound.play('thud', { gain: 0.6, wet: 0.4 }); ghats.ripple(0, -4.2, 1.6, time); });
    // under the hat, behind the coins, he opens his eyes; he says the law
    const eyesOn = (t >= B.reveal && t < B.plunge) || t >= B.eyes, flick = t >= B.eyes && t < B.eyes + 0.35 ? B.eyes : -1;
    this.eyeK += ((eyesOn ? 1 : 0) - this.eyeK) * Math.min(1, dt * (eyesOn ? 20 : 20)); k1.eyes(this.eyeK * (flick >= 0 ? 0.6 + 0.4 * Math.sin((t - flick) * 40) : 1));
    c.at(t, B.eyes, 'eyes', () => { sound.play('kBreath', { gain: 0.6, wet: 0.5, bus: 'voice' }); });
    c.at(t, B.line, 'line', () => { hud.verse(RIVER_INTRO.law.text); sound.play(RIVER_INTRO.law.voice, { gain: 0.95, wet: 0.55, bus: 'voice' }); });
    c.at(t, B.lift, 'lift', () => { hud.verse(''); k.set('plant'); sound.play('creak', { gain: 0.8, wet: 0.5 }); });
    // the pole goes into the riverbed: the lamps run back out to the far bank, brighter than before
    c.at(t, B.slam, 'slam', () => { sound.play('braam', { gain: 0.85 }); sound.play('boom', { gain: 0.8 }); sound.play('flare', { gain: 0.7, wet: 0.6 }); sound.duck(0.5, 1.4); this.lens.trauma = 1; ghats.setOut(0, 0, 0); ghats.flames(1); ghats.bowlsLit(true); ghats.ripple(0, -3.6, 4.5, time); fx.puffs.emit(V(0, 0.3, -3.4), 26, 4, 2, time); fx.sparks.emit(V(0, 0.4, -3.4), V(0, 1, 0), 60, 6, 2.2, 0.6, time); });
    if (t >= B.slam) ghats.setFront(t < B.title + 2 ? Math.max(0.01, (t - B.slam) * 60) : 0);
    c.at(t, B.title, 'title', () => { hud.say(RIVER_INTRO.title.name, 2.6, 'title', RIVER_INTRO.title.sub); sound.play('rise', { gain: 0.6, wet: 0.6 }); });
    if (t >= INTRO_LEN) this.finish();
    return walk;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, base: number) {
    const { f, k1 } = this.kit, m = f.m, t = this.t, L = this.lens, lp = this.lp; k1.eyeBurst(t >= B.reveal && t < B.lift + 0.2 ? this.eyeK : 0);
    if (t < 10.4) { const u = E(0, 10.4, t); L.aim(cam, 11, V(-7 + u * 4, 9.5 - u * 4.5, 22 - u * 5), V(0, 0.2, -70), 48 - u * 6, time); }
    else if (t < B.walk) { const u = E(10.4, B.walk, t); L.aim(cam, 12, V(-6 + u * 5, 0.38, -6 - u * 3), V(3, 0.5, -60), 38, time, -0.03); }
    else if (t < B.walk + 4.8) { const u = E(B.walk, B.walk + 4.8, t); L.aim(cam, 1, V(-3.2 + u * 2.6, 0.42 + u * 0.55, 4.5 - u * 2.2), V(0, 0.7, -60), 42, time); }
    else if (t < B.lamp + 0.4 && this.waiting) { const push = Math.min(1, this.waitK / 9) * 0.6; L.aim(cam, 12, V(m.x + 1.3, 1.45, m.z + 3.0 - push), V(m.x + 0.1, 0.95, m.z - 0.9), 40, time); }
    else if (t < B.lamp + 0.4) { const u = E(B.walk + 4.8, B.lamp + 0.4, t), push = 0; L.aim(cam, 2, V(m.x + 1.0 - u * 0.4, 1.05 - u * 0.25, m.z + 2.7 - u * 0.5 - push), V(m.x - 0.1, 0.7 - u * 0.4, m.z - 3), 40, time); }
    else if (t < B.last + 0.5) { const u = E(B.lamp + 0.4, B.last + 0.5, t); L.aim(cam, 3, V(lp.x + 0.9 - u * 0.5, 0.3 + u * 0.08, lp.z + 1.7 + u * 0.4), V(lp.x - 0.2, 0.25, lp.z - 8), 38 - u * 4, time); }
    else if (t < B.reveal) { const u = E(B.last + 0.5, B.reveal, t); L.aim(cam, 4, V(m.x - 0.7, 1.5, m.z + 2.3 - u * 0.6), V(0, 1.7, -26), 26 - u * 3, time); }
    // his eyes, close: the lens is a stride from the veil, and it pushes in slowly while the sting dies away
    else if (t < B.plunge) { const h = k1.eyeAt(V()), u = E(B.reveal, B.plunge, t); L.aim(cam, 10, V(h.x + 0.05, h.y - 0.75, h.z + 0.95 - u * 0.1), V(h.x, h.y - 0.05, h.z), 40 - u * 6, time); }
    else if (t < B.risen + 0.3) { const u = E(B.rise, B.risen, t); L.aim(cam, 5, V(1.9 - u * 0.6, 0.32, -0.4 - u * 0.3), V(0, 0.4 + u * 2.3, -4.2), 42 - u * 4, time, 0.02); }
    else if (t < B.lift + 0.2) { const h = k1.eyeAt(V()), u = E(B.risen + 0.3, B.lift, t); L.aim(cam, 6, V(h.x + 0.3 - u * 0.25, h.y - 0.95 + u * 0.22, h.z + 1.6 - u * 0.68), V(h.x, h.y - 0.08 + u * 0.06, h.z), 40 - u * 7, time); }
    else if (t < B.title) { const u = E(B.lift + 0.2, B.title, t); L.aim(cam, 7, V(m.x + 2.4 - u * 0.6, 0.75 + u * 0.5, m.z + 3.6), V(0, 1.4 + u * 0.3, -9), 52, time); }
    else { const u = E(B.title, INTRO_LEN, t); L.aim(cam, 8, V(m.x + 1.2, 1.5, m.z + 3.2 - u * 0.4), V(0, 1.9, -4), base - 2, time); }
  }
  /** 0-1: how much of the night has come in; the director may darken the frame with it. */
  get night() { return this.dark; }
}

// ---------------------------------------------------------------- the turn
export const TURN_LEN = 37.6;
/** He kneels, and shows you what he kept: the child. He lets the drowned go, keeps their coin, and the coin comes up out of the river onto him. */
const T = { reach: 3.4, show: 6.8, hands: 20.4, swell: 24.8, net: 26.2, rise: 27.3, lamps: 31.0, title: 33.2 };
export class RiverTurn {
  t = -1; mono = 0; rate = 1; onEnd: () => void = () => { }; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; private off = false;
  constructor(kit: RiverKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const { f } = this.kit, m = f.m, k = f.king as River; this.t = 0; this.off = false; this.c.clear(); this.lens.cut = 0; this.mono = 0; if (Math.hypot(m.x - k.x, m.z - k.z) < 3.4) { m.revive(k.x, k.z + 3.6, Math.PI); this.kit.pv.reset(); } document.body.classList.add('cine'); sound.score?.set('scene'); }
  stop() { this.t = -1; this.mono = 0; this.kit.rd.turnK = 0; this.kit.k1.holding(false); document.body.classList.remove('cine'); }
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.c.off = true; this.kit.hud.verse(''); this.t = TURN_LEN; }
  private become() { const { f, k1, k2, ghats } = this.kit, k = f.king as River, m = f.m; if (k.form === 2) return; k1.holding(false); k1.show(false); k.form = 2; k.set('riseW'); k.x = 0; k.z = -5; k.y = 0; k.yaw = 0; k.reset(); k2.show(true); k2.settle(); ghats.lamps(0.28, true); if (Math.hypot(m.x, m.z - 5) > 0.8) { m.revive(0, 5, Math.PI); this.kit.pv.reset(); } }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const t = this.t, { f, fx, hud, ghats, k1 } = this.kit, k = f.king as River, c = this.c, L = this.lens; L.trauma *= Math.exp(-dt * 2.4);
    if (!this.off && k.form === 1 && (k.mode === 'fall') && k.mt > 3.0) k.mt = k.prev = 3.0;
    if (!this.off && k.form === 1 && k.mode === 'cradle' && k.mt > 8.0) k.mt = k.prev = 8.0;
    c.at(t, 0.1, 'hush', () => { sound.duck(0.3, 4); sound.play('fDeath', { gain: 1, wet: 0.6, bus: 'voice' }); this.lens.trauma = 0.5; });
    c.at(t, 1.5, 'lampsOut', () => { ghats.lamps(0.0); sound.play('lampOut', { gain: 1, wet: 0.6 }); });
    speak(RIVER_TURN.lines, t, (at, id, f) => c.at(t, at, id, f), v => hud.verse(v));
    // beneath the jars: the bundle, and then nothing but his breath and a heart
    c.at(t, T.reach, 'reach', () => { if (k.form === 1) k.set('cradle'); sound.play('creak', { gain: 0.7, wet: 0.6 }); sound.play('cloth', { gain: 0.6, wet: 0.5 }); });
    c.at(t, T.show, 'show', () => { k1.holding(true); sound.duck(0.12, 9); sound.play('kBreath', { gain: 0.7, wet: 0.5, bus: 'voice' }); });
    for (const [i, h] of [7.6, 9.0, 10.4, 12.2, 14.6, 17.4].entries()) c.at(t, h, 'heart' + i, () => sound.play('heart', { gain: 0.5 + i * 0.07, wet: 0.45 }));
    c.at(t, 16.2, 'law', () => { sound.play('whisper', { gain: 0.5, wet: 0.95 }); sound.play('doom', { gain: 0.45, wet: 0.8 }); });
    // he lets the drowned go: hands all over the river, and they sink
    c.at(t, T.hands, 'hands', () => { sound.play('handsRise', { gain: 0.8, wet: 0.8 }); sound.play('moan', { gain: 0.6, wet: 0.9 }); for (let i = 0; i < 10; i++) ghats.ripple((Math.random() - 0.5) * 20, -4 + (Math.random() - 0.5) * 20, 1.2, time + i * 0.1); });
    c.at(t, T.hands + 2.0, 'free', () => { sound.play('soulFree', { gain: 0.7, wet: 0.9 }); for (let i = 0; i < 30; i++) fx.sparks.emit(V((Math.random() - 0.5) * 16, 0.1, -4 + (Math.random() - 0.5) * 14), V(0, 0.8, 0), 1, 0.6, 2.6, -0.5, time); });
    if (t > T.hands && t < T.swell && Math.random() < dt * 6) ghats.ripple((Math.random() - 0.5) * 16, -4 + (Math.random() - 0.5) * 16, 0.9, time);
    c.at(t, T.swell - 2.4, 'build', () => { sound.play('riser', { gain: 0.7, wet: 0.5 }); sound.play('coinTurn', { gain: 0.6, wet: 0.7 }); });
    c.at(t, T.swell, 'swell', () => { this.become(); sound.play('drain', { gain: 1, wet: 0.7 }); this.lens.trauma = 0.6; });
    this.kit.rd.turnK = E(T.swell + 0.8, T.lamps, t);
    if (t > T.swell && t < T.swell + 3.8 && Math.random() < 0.5) ghats.ripple((Math.random() - 0.5) * 8, -5 + (Math.random() - 0.5) * 8, 1.6, time);
    c.at(t, T.net, 'net', () => { sound.play('snap', { gain: 0.9, wet: 0.6 }); sound.play('wave', { gain: 0.7, wet: 0.7 }); sound.play('coinHit', { gain: 0.8, wet: 0.6 }); this.lens.trauma = 0.8; ghats.ripple(0, -5, 3, time); fx.puffs.emit(V(0, 0.4, -5), 24, 4, 2, time); for (let i = 0; i < 40; i++) fx.sparks.emit(V((Math.random() - 0.5) * 1.6, 1 + Math.random() * 2.4, -5 + (Math.random() - 0.5) * 1.6), V((Math.random() - 0.5), 0.6, (Math.random() - 0.5)), 2, 4, 1.6, 0.9, time); });
    c.at(t, T.rise, 'rise', () => { sound.score?.set('weight'); sound.play('wRoar', { gain: 0.9, wet: 0.7, bus: 'voice' }); sound.play('braam', { gain: 0.9 }); sound.play('boom', { gain: 0.7 }); sound.duck(0.35, 1.2); this.lens.trauma = 1; ghats.lamps(0.6); ghats.ripple(0, -5, 4, time); fx.sparks.emit(V(0, 2, -5), V(0, 1.5, 0), 120, 7, 2, -1.2, time); });
    c.at(t, T.rise + 1.6, 'coins', () => { sound.play('coinBack', { gain: 0.7, wet: 0.7 }); });
    c.at(t, T.lamps, 'lamps', () => { sound.play('aura2', { gain: 0.8, wet: 0.7 }); sound.play('lampsRelight', { gain: 0.6, wet: 0.7 }); });
    c.at(t, T.title, 'title', () => { hud.say(RIVER_TURN.title.name, 2.8, 'title', RIVER_TURN.title.sub); sound.play('boom', { gain: 0.8 }); this.lens.trauma = 0.4; });
    this.mono = t < 2 ? 0.0 : t < T.swell ? 0.55 * E(1.5, 4, t) + 0.2 * E(T.show, T.show + 3, t) * (1 - E(T.hands - 1, T.hands, t)) : 0.4 * (1 - E(T.rise, T.rise + 4, t));
    if (t >= TURN_LEN) { this.stop(); hud.verse(''); f.beginRound2(); k.set('riseW'); k.mt = k.prev = 3.2; this.onEnd(); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k1 } = this.kit, m = f.m, t = this.t, L = this.lens, k = f.king as River;
    if (t < T.show) { const u = E(0, T.show, t); L.aim(cam, 1, V(m.x + 3.2 - u * 1.2, 0.9 + u * 0.1, m.z - 0.6 - u * 0.6), V(k.x, 1.0 - u * 0.3, k.z), 40 - u * 4, time); }
    else if (t < 11.4) { const h = k1.eyeAt(V()), u = E(T.show, 11.4, t); L.aim(cam, 7, V(h.x + 1.1 - u * 0.3, h.y - 0.7, h.z + 2.6 - u * 0.6), V(h.x, h.y - 1.15, h.z + 0.45), 34 - u * 4, time); }
    else if (t < 16.2) { const u = E(11.4, 16.2, t); L.aim(cam, 8, V(k.x - 4.6 + u * 0.8, 1.0, k.z + 3.2 - u * 0.4), V(k.x, 1.3, k.z + 0.3), 36, time, 0.02); }
    else if (t < T.hands) { const u = E(16.2, T.hands, t); L.aim(cam, 9, V(k.x + 0.4, 0.5 + u * 2.4, k.z + 4.2 + u * 2.4), V(k.x, 0.9, k.z), 40, time); }
    else if (t < T.swell) { const u = E(T.hands, T.swell, t); L.aim(cam, 2, V(m.x - 2.6, 0.45 + u * 0.3, m.z + 1.2), V(0, 0.5 + u * 0.5, -9), 40, time, -0.02); }
    else if (t < T.rise + 0.1) { const u = E(T.swell, T.rise + 0.1, t); L.aim(cam, 3, V(2.4, 0.5 + u * 0.3, 3.2), V(0, 0.8 + u * 1.2, -5), 44, time); }
    else if (t < T.lamps) { const u = E(T.rise, T.lamps, t); L.aim(cam, 4, V(k.x - 1.6 + u * 0.8, 0.8, k.z + 6.8 - u * 0.5), V(k.x, 2.4 + u * 1.2, k.z), 50, time); }
    else if (t < T.title + 1.2) { const u = E(T.lamps, T.title + 1.2, t); L.aim(cam, 5, V(k.x + 2.2 - u * 0.6, 1.3 + u * 0.2, k.z + 3.4 + u * 0.4), V(k.x, 1.9, k.z), 38 - u * 4, time, 0.03); }
    else { const u = E(T.title + 1.2, TURN_LEN, t), dx = k.x - m.x, dz = k.z - m.z, d = Math.hypot(dx, dz) || 1; L.aim(cam, 6, V(m.x - dx / d * 2.6 + dz / d * 1.0, 1.5, m.z - dz / d * 2.6 - dx / d * 1.0), V(k.x, 2.0, k.z), 46, time); }
  }
}

// ---------------------------------------------------------------- the way out
export const END_LEN = 47;
/** The coin goes, the drowned stand, the boat comes up with an old man in it; he speaks, and holds out his lamp. */
const N = { people: 6.6, boat: 11.6, walk: 27.0, touch: 32.6, run: 33.2, dawn: 35.0 };
/** He goes down for the last time, the boat rises, and the fire runs from lamp to lamp to the far bank. The hero lights the boat: the scene holds at `touch` until the press. */
export class RiverEnding {
  t = -1; over = false; dawn = 0; /** How far the lamps have caught, in metres from the boat. */ front = 0;
  /** The scene holds at the boat, waiting for the hero's light. */ waiting = false;
  private lit = false; private waitK = 0; private flameK = 0; private flame: THREE.Sprite; private c = new Cues(); private lens = new Lens(); private kit: RiverKit; private A = V();
  constructor(kit: RiverKit) {
    this.kit = kit;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(0.16, 'rgba(255,150,60,.6)'); g.addColorStop(1, 'rgba(255,90,20,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(1, 0.62, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.flame.renderOrder = 6; this.flame.visible = false; kit.ghats.group.add(this.flame);
  }
  get active() { return this.t >= 0; }
  start() { const m = this.kit.f.m; this.t = 0; this.over = false; this.dawn = 0; this.front = 0; this.lit = false; this.waiting = false; this.waitK = 0; this.flameK = 0; this.c.clear(); this.lens.cut = 0; this.A.set(m.x, 0, m.z); document.body.classList.add('cine'); sound.score?.set('scene'); }
  stop() { this.t = -1; this.dawn = 0; this.front = 0; this.over = false; this.waiting = false; this.lit = false; this.flameK = 0; this.flame.visible = false; this.kit.prompt.hide(); this.kit.f.sceneMove = { x: 0, z: 0 }; this.kit.k2.boat(false); this.kit.k2.standing(false); this.kit.hud.verse(''); this.kit.ghats.lamps(1, true); this.kit.ghats.setFront(0); document.body.classList.remove('cine'); DAWN.value = 0; }
  /** Before the boat, any press skips the scene (as it always has). At the boat only the light does; nothing else gets past it. True when the press was used. */
  press(ev: Press[], time: number): boolean {
    if (!this.active || this.over || !ev.some(e => !e.up)) return false;
    if (this.waiting) { if (ev.some(e => !e.up && e.a === 'attack')) this.light(time); return true; }
    this.skip(); return true;
  }
  /** A tap on the screen (the touch controls are hidden in the scenes, so a phone taps anywhere): it lights the boat while the scene waits. */
  tap(time: number) { if (this.waiting) this.light(time); }
  skip() { if (this.active && this.t > 2.2 && this.t < END_LEN) { this.c.off = true; this.lit = true; this.waiting = false; this.kit.prompt.hide(); this.t = END_LEN; this.dawn = 1; this.front = 400; } }
  /** The hero lights the boat: the one blow he does not swing. The fire runs on from here. */
  private light(time: number) {
    const { f, fx } = this.kit, m = f.m, p = V(m.x, 1.0, m.z - 1.1);
    this.lit = true; this.waiting = false; this.kit.prompt.hide();
    fx.bursts.add('fire', p, 2, 0.8, time); fx.bursts.add('flare', p, 4, 0.4, time); fx.sparks.emit(p, V(0, 0.6, -0.4), 60, 3, 2, -0.6, time); sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('lampSet', { gain: 0.8, wet: 0.5 }); this.lens.trauma = 0.3;
  }
  step(dt: number, time: number, dev: 'keys' | 'pad' | 'touch' = 'keys') {
    if (!this.active) return; const { f, fx, hud, ghats, k2 } = this.kit, m = f.m, k = f.king as River, c = this.c; this.t += dt;
    // the scene holds at the boat until the hero lights it: the world, the flame and the water go on, the words and the story do not
    if (!this.lit && this.t >= N.touch) { this.t = N.touch; if (!this.waiting) { this.waiting = true; this.waitK = 0; this.kit.prompt.show('attack', 'Light the boat', 1e9, dev); } this.waitK += dt; }
    const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.4);
    if (this.waiting) this.flameK = Math.min(1, this.flameK + dt * 2); else if (this.lit && this.flameK > 0) this.flameK *= Math.exp(-dt * 2.2);
    { const p = V(m.x, 1.0, m.z - 1.1), fl = 0.9 + 0.1 * Math.sin(time * 9) + 0.06 * Math.sin(time * 19); this.flame.visible = this.flameK > 0.01; this.flame.position.copy(p); this.flame.scale.setScalar(0.8 * fl * (0.6 + 0.4 * this.flameK) * (this.lit ? 1 + 3 * (1 - this.flameK) : 1)); (this.flame.material as THREE.SpriteMaterial).opacity = this.flameK;
      if (this.waiting && Math.random() < dt * 9) fx.sparks.emit(p.clone(), V(0, 0.5, -0.2), 1, 0.5, 1.4, -0.4, time); }
    c.at(t, 0.05, 'hush', () => { sound.duck(0.05, 3); });
    c.at(t, 2.2, 'coins', () => { sound.play('coinBack', { gain: 0.8, wet: 0.7 }); sound.play('drain', { gain: 0.6, wet: 0.7 }); });
    c.at(t, N.boat - 0.6, 'quiet', () => sound.duck(0.1, 15));
    for (const [i, h] of [17.4, 19.6, 22.4, 24.8].entries()) c.at(t, h, 'heart' + i, () => sound.play('heart', { gain: 0.45 + i * 0.06, wet: 0.5 }));
    c.at(t, 17.4, 'him', () => sound.play('kBreath', { gain: 0.5, wet: 0.5, bus: 'voice' }));
    c.at(t, N.walk, 'lamp', () => { sound.play('creak', { gain: 0.6, wet: 0.6 }); sound.play('riserL', { gain: 0.35, wet: 0.7 }); });
    c.at(t, N.dawn, 'swell', () => sound.play('swell', { gain: 0.7, wet: 0.7 }));
    speak(RIVER_ENDING.lines, t, (at, id, f) => c.at(t, at, id, f), v => hud.verse(v));
    c.at(t, 0.5, 'apart', () => { sound.play('wDeath', { gain: 1, wet: 0.7, bus: 'voice' }); sound.play('breach', { gain: 0.9, wet: 0.6 }); ghats.ripple(k.x, k.z, 4, time); fx.puffs.emit(V(k.x, 0.3, k.z), 30, 5, 2.4, time); this.lens.trauma = 0.8; });
    c.at(t, N.people, 'people', () => { sound.play('moan', { gain: 0.5, wet: 0.9 }); k2.standing(true); });
    c.at(t, N.boat, 'boat', () => { sound.play('boatRise', { gain: 0.9, wet: 0.6 }); k2.boat(true); ghats.ripple(0, -9, 3, time); });
    // you walk out to it; this is the one blow you do not swing
    f.sceneMove = t > N.walk && t < N.walk + 5 ? { x: 0, z: -0.5 } : { x: 0, z: 0 };
    if (t > N.touch + 0.3) this.front = (t - N.touch - 0.3) * 14; ghats.setFront(this.front);
    c.at(t, N.run, 'run', () => { sound.score?.set('won'); sound.play('fireRun', { gain: 1, wet: 0.7 }); ghats.lamps(1); });
    this.dawn = E(N.dawn, N.dawn + 9, t); DAWN.value = this.dawn;
    if (t >= END_LEN && !this.over) { this.over = true; this.dawn = 1; document.body.classList.remove('cine'); hud.won(f); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k2 } = this.kit, m = f.m, k = f.king as River, t = this.t, L = this.lens;
    if (t < N.people) { const u = E(0, N.people, t); L.aim(cam, 1, V(m.x + 2.8 - u * 0.6, 0.8 + u * 0.2, m.z - 2.6), V(k.x, 1.8 - u * 0.5, k.z), 42, time); }
    else if (t < N.boat) { const u = E(N.people, N.boat, t); L.aim(cam, 2, V(-5.5 + u * 1.5, 0.6, 3.0), V(-1.5, 0.9 + u * 0.6, -10), 36, time); }
    else if (t < 17.4) { const u = E(N.boat, 17.4, t); L.aim(cam, 6, V(3.6 - u * 1.2, 0.9 + u * 0.3, -1.4 - u * 1.2), V(0, 1.0 + u * 0.3, -9.4), 36, time, 0.02); }
    else if (t < N.walk) { const h = k2.eyeAt(V()), u = E(17.4, N.walk, t); L.aim(cam, 7, V(h.x - 1.4 + u * 0.4, h.y - 0.2, h.z + 3.6 - u * 0.8), V(h.x, h.y - 0.45, h.z), 30 - u * 3, time); }
    else if (t < N.touch) { const u = E(N.walk, N.touch, t); L.aim(cam, 3, V(m.x + 1.3, 1.2, m.z + 3.0 - u * 0.6), V(0, 1.2, -8.5), 32, time); }
    else if (t < N.touch + 6) { const u = E(N.touch, N.touch + 6, t), push = Math.min(1, this.waitK / 9) * 0.5; if (this.waiting) L.aim(cam, 11, V(m.x + 0.8, 1.3, m.z + 2.7 - push), V(m.x, 1.0, m.z - 1.6), 40, time); else L.aim(cam, 4, V(m.x - 1.5 - u * 1.2, 1.0 + u * 2.2, m.z + 3.8 + u * 3.8), V(0, 1.1 + u * 0.7, -30), 44 + u * 6, time); }
    else { const u = E(N.touch + 6, END_LEN, t); L.aim(cam, 5, V(m.x + 0.3, 1.2 + u * 0.6, m.z + 4.8), V(0, 1.5, -40), 48, time); }
  }
}

// ---------------------------------------------------------------- the moments (the drag; the rewards are in rewardShots.ts)
/** Each moment is staged on the boss's own clock (`stage`): the page plays these specs while the simulation holds the hero. */
export function riverMoments(sim: RiverSim, m: Motor): { drag: MomentSpec } {
  /** From the boat toward the hero, on the water, and its right-hand side. */
  const away = () => { const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; return { ux, uz, sx: -uz, sz: ux }; };
  // the drag: hooked and pulled under, held down, and heaved up onto the steps
  const drag: MomentSpec = {
    frame: (t, eye, at) => { const { sx, sz, ux, uz } = away(), down = E(DRAG.under, DRAG.hold, t), up = E(DRAG.heave, DRAG.end, t), low = Math.max(down, 1 - up), hx = m.x, hz = m.z;
      // above the water, then down under the surface as he goes, and up again as he is heaved out
      eye.set(hx + sx * 4.6 + ux * 1.2, 2.2 - 3.0 * low, hz + sz * 4.6 + uz * 1.2); at.set(hx, 0.8 - 1.8 * low, hz); return 56 - 2 * low; },
    hero: (t, o) => { o.y = t < DRAG.under ? 0 : t < DRAG.hold ? -1.6 * E(DRAG.under, DRAG.hold, t) : t < DRAG.heave ? -1.6 + 0.1 * Math.sin(t * 9) : -1.6 * (1 - E(DRAG.heave, DRAG.end, t)); },
    tumble: t => t > DRAG.hold && t < DRAG.heave ? 0.25 * Math.sin(t * 6) : 0,
    rate: t => t > DRAG.hold - 0.1 && t < DRAG.heave + 0.2 ? 0.4 : 1,
  };
  return { drag };
}
