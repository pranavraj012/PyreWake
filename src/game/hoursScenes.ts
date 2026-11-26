// The Sister's scenes: the way in (up the hill into the smoke, the ward, the dial, and her at the last cot), the turn (she breathes the smoke in and the sun comes),
// and the way out (the hours go up into the light; you wait while she breathes seven times). All skippable.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { SisterView } from '../boss/hours/sisterView.ts';
import type { PallView } from '../boss/hours/pallView.ts';
import type { Sister } from '../boss/hours/sister.ts';
import type { HoursDirector } from '../boss/hours/hoursDirector.ts';
import type { House } from '../arena/house.ts';
import { DIAL_FOOT } from '../arena/house.ts';
import type { Fight } from '../combat/fight.ts';
import type { PlayerView } from '../player/view.ts';
import type { Fx } from '../render/impact.ts';
import type { Hud } from '../ui/hud.ts';
import { Cues, Lens } from './scenes.ts';
import { HOURS_ENDING, HOURS_INTRO, HOURS_TURN, speak } from './hoursScript.ts';
import { SISTER_SCALE } from '../boss/hours/frame.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface HoursKit { f: Fight; pv: PlayerView; k1: SisterView; k2: PallView; fx: Fx; hud: Hud; house: House; hd: HoursDirector }

// ---------------------------------------------------------------- the way in
export const INTRO_LEN = 16.2;
const B = { ward: 4.2, dial: 7.4, bed: 10.0, her: 11.0, stand: 12.2, line: 12.6, title: 14.0 };
export class HoursIntro {
  t = INTRO_LEN; private c = new Cues(); private lens = new Lens(); private kit: HoursKit; onEnd: () => void = () => { };
  constructor(kit: HoursKit) { this.kit = kit; }
  get active() { return this.t < INTRO_LEN; }
  /** At rest: she sits by the last cot with the cord in her fingers. */
  rest() { const { f, k1 } = this.kit, k = f.king as Sister; k.form = 1; k.x = 0; k.z = -4; k.y = 0; k.yaw = 0; k.reset(); k.set('sit'); k1.settle(); k1.show(true); k1.eyeK = 0; }
  start() { const { f, pv, hd } = this.kit, m = f.m; this.t = 0; this.c.clear(); this.lens.cut = 0; this.lens.trauma = 0; this.rest(); m.revive(0, 15.5, Math.PI); pv.reset(); hd.reset(); sound.score?.set('vigil'); }
  stop() { this.t = INTRO_LEN; this.kit.hud.verse(''); this.restore(); }
  skip() { if (!this.active || this.t < 0.6) return; this.c.off = true; this.t = INTRO_LEN; this.finish(); }
  private restore() { const { k1, f } = this.kit, k = f.king as Sister; k1.eyeK = 1; k1.emberHold = null; if (k.form === 1 && (k.mode === 'kneel' || k.mode === 'sit')) { k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); k1.settle(); } }
  private finish() { this.kit.hud.verse(''); this.restore(); this.onEnd(); }
  step(dt: number, _time: number): number {
    const { f, hud, k1 } = this.kit, k = f.king as Sister, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.6);
    speak(HOURS_INTRO.lines, t, (at, id, g) => c.at(t, at, id, g), v => hud.verse(v));
    c.at(t, 0.05, 'hush', () => { sound.duck(0.4, 3); sound.play('sBreath', { gain: 0.8, wet: 0.7 }); });
    c.at(t, 0.3, 'place', () => hud.say(HOURS_INTRO.place, 3.2, 'place'));
    c.at(t, 2.6, 'breath2', () => sound.play('sBreath', { gain: 0.7, wet: 0.7, rate: 0.95 }));
    c.at(t, B.ward + 0.4, 'creak', () => { sound.play('creak', { gain: 0.5, wet: 0.7 }); sound.play('creak', { gain: 0.35, wet: 0.8, delay: 1.3 }); });
    c.at(t, B.bed + 0.3, 'bed', () => { hud.verse(HOURS_INTRO.bed.text); sound.play('whisper', { gain: 0.7, wet: 0.8 }); });
    c.at(t, HOURS_INTRO.bed.until, 'unbed', () => hud.verse(''));
    // she is sitting at the last cot; she stands, the hood's points rising above you, and takes up the hook
    if (t < B.stand) { if (k.mode !== 'sit') k.set('sit'); k.mt = k.prev = 1.0; k.x = 0; k.z = -4; k.yaw = 0; } else if (k.mode === 'sit') { k.set('idle'); }
    k1.eyeK += ((t > B.her + 0.6 ? 1 : 0) - k1.eyeK) * Math.min(1, dt * 3);
    c.at(t, B.stand, 'stand', () => { sound.play('clothB', { gain: 0.9, wet: 0.5 }); sound.play('sBreath', { gain: 0.9, wet: 0.4 }); this.lens.trauma = 0.25; });
    c.at(t, B.line, 'line', () => { hud.verse(HOURS_INTRO.law.text); sound.play('sCall', { gain: 0.95, wet: 0.55, bus: 'voice' }); });
    c.at(t, HOURS_INTRO.law.until, 'unline', () => hud.verse(''));
    c.at(t, B.title, 'title', () => { hud.say(HOURS_INTRO.title.name, 2.8, 'title', HOURS_INTRO.title.sub); sound.play('rise', { gain: 0.6, wet: 0.6 }); });
    if (t >= INTRO_LEN) this.finish();
    return t > 0.8 && t < B.ward ? -0.45 : t > B.dial && t < B.her ? -0.3 : 0;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, base: number) {
    const { f, k1 } = this.kit, m = f.m, t = this.t, L = this.lens;
    if (t < B.ward) { const u = E(0, B.ward, t); L.aim(cam, 1, V(m.x - 1.4 + u * 0.6, 0.5 + u * 0.4, m.z + 3.2), V(m.x * 0.5, 2.2 + u * 1.5, m.z - 12), 50, time); }
    else if (t < B.dial) { const u = E(B.ward, B.dial, t), a = 1.3 + u * 0.12, R = 22.6; L.aim(cam, 2, V(Math.sin(a) * R, 1.35, Math.cos(a) * R), V(Math.sin(a + 0.4) * 23.1, 0.6, Math.cos(a + 0.4) * 23.1), 50, time); }
    else if (t < B.her) { const u = E(B.dial, B.her, t); L.aim(cam, 3, V(4.5 - u * 1.5, 0.6 + u * 0.4, -6 - u * 1), V(DIAL_FOOT.x, 3 + u * 4, DIAL_FOOT.z - 6), 50, time); }
    else if (t < B.line - 0.3) { const h = k1.mark('head', V()), u = E(B.her, B.line, t); L.aim(cam, 4, V(1.4 - u * 0.4, 0.8 + u * 1.2, -1.2), V(h.x, h.y - 0.1, h.z), 40 - u * 6, time); }
    else if (t < B.title) { const h = k1.mark('head', V()); L.aim(cam, 5, V(0.55, h.y - 0.15, -2.2), V(h.x, h.y, h.z), 30, time); }
    else { const u = E(B.title, INTRO_LEN, t); L.aim(cam, 6, V(m.x + 1.2, 1.6, m.z + 3.4 - u * 0.4), V(0, 2.0, -4), base - 2, time); }
  }
}

// ---------------------------------------------------------------- the turn
export const TURN_LEN = 16.6;
export class HoursTurn {
  t = -1; mono = 0; rate = 1; onEnd: () => void = () => { }; private c = new Cues(); private lens = new Lens(); private kit: HoursKit; private off = false;
  constructor(kit: HoursKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const { f, hd } = this.kit, m = f.m, k = f.king as Sister; this.t = 0; this.off = false; this.c.clear(); this.lens.cut = 0; this.mono = 0; if (Math.hypot(m.x - k.x, m.z - k.z) < 3.6) { m.revive(k.x, k.z + 4.2, Math.PI); this.kit.pv.reset(); } document.body.classList.add('cine'); sound.score?.set('scene'); hd.cine = { day: 0 }; }
  stop() { this.t = -1; this.mono = 0; this.kit.hd.cine = null; this.kit.house.inhale(0); this.kit.k1.emberHold = null; document.body.classList.remove('cine'); }
  skip() { if (!this.active || this.t < 0.8) return; this.become(); this.c.off = true; this.kit.hud.verse(''); this.t = TURN_LEN; }
  private become() { const { f, k1, k2, hd } = this.kit, k = f.king as Sister, m = f.m; if (k.form === 2) return; k1.show(false); k.form = 2; k.x = 0; k.z = -4; k.y = 0; k.yaw = 0; k.reset(); k.set('rise'); k2.show(true); k2.settle(); if (hd.cine) hd.cine.day = 1; if (Math.hypot(m.x, m.z + 4) < 6.5) { m.revive(0, 4.5, Math.PI); this.kit.pv.reset(); } }
  step(dt: number, time: number) {
    if (!this.active) return; this.t += dt; const t = this.t, { f, fx, hud, house, k1, hd } = this.kit, k = f.king as Sister, c = this.c, L = this.lens; L.trauma *= Math.exp(-dt * 2.4);
    if (!this.off && k.form === 1 && k.mode === 'fall' && k.mt > 1.2) k.mt = k.prev = 1.2;
    // her knee on the dial floor; the last embers gutter
    if (k.form === 1) k1.emberHold = Math.max(0, Math.round(3 * (1 - E(0.2, 1.6, t))));
    c.at(t, 0.1, 'hush', () => { sound.duck(0.3, 4); sound.play('emberOut', { gain: 0.8, wet: 0.6 }); sound.play('sBreath', { gain: 1, wet: 0.5, rate: 0.9 }); });
    speak(HOURS_TURN.lines, t, (at, id, g) => c.at(t, at, id, g), v => hud.verse(v));
    c.at(t, 1.8, 'v1', () => sound.play('sPain', { gain: 0.5, wet: 0.6, bus: 'voice' }));
    // she pulls the breath-cloth down and breathes in: the whole ceiling pours down into her mouth, and the sky tears open on a low red sun
    c.at(t, 8.6, 'inhale', () => { sound.play('inhale', { gain: 1, wet: 0.5 }); sound.duck(0.2, 3.5); });
    if (k.form === 1) { const h = k1.mark('head', V()); house.inhale(E(8.6, 11.4, t), h); if (t > 8.8 && t < 11.4) for (let i = 0; i < 3; i++) { const f = Math.random(), r = 0.3 + f * 6, a = time * 3 + f * 9 + i * 2.1; fx.puffs.emit(h.clone().add(V(Math.sin(a) * r, 0.2 + f * 6, Math.cos(a) * r)), 1, 1.2 + f * 2, 0.5, time); } }
    if (hd.cine) hd.cine.day = E(10.0, 11.8, t);
    c.at(t, 10.4, 'tear', () => { sound.play('braam', { gain: 0.8 }); sound.play('wind', { gain: 0.7, wet: 0.4 }); this.lens.trauma = 0.5; });
    c.at(t, 11.6, 'swell', () => { this.become(); house.inhale(0); sound.play('pRoar', { gain: 0.9, wet: 0.7, bus: 'voice' }); sound.play('clothB', { gain: 1, wet: 0.6 }); sound.play('boom', { gain: 0.7 }); this.lens.trauma = 0.9; fx.puffs.emit(V(0, 0.4, -4), 40, 6, 2.2, time); });
    c.at(t, 14.2, 'title', () => { hud.say(HOURS_TURN.title.name, 2.8, 'title', HOURS_TURN.title.sub); sound.play('rise', { gain: 0.7, wet: 0.6 }); });
    this.mono = t < 1 ? 0 : t < 8.6 ? 0.5 * E(1, 3, t) : 0.5 * (1 - E(9.5, 12, t));
    if (t >= TURN_LEN) { this.stop(); hud.verse(''); f.beginRound2(); k.set('rise'); k.mt = k.prev = 2.6; this.onEnd(); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k1, k2 } = this.kit, m = f.m, t = this.t, L = this.lens, k = f.king as Sister;
    if (t < 1.8) { const u = E(0, 1.8, t); L.aim(cam, 1, V(m.x + 2.6 - u * 0.6, 0.7, m.z - 0.4), V(k.x, 1.4 - u * 0.3, k.z), 40, time); }
    else if (t < 8.6) { const h = k1.mark('head', V()), u = E(1.8, 8.6, t), fs = Math.sin(k.yaw), fc = Math.cos(k.yaw); L.aim(cam, 2, V(h.x + fs * (1.5 - u * 0.4) + fc * 0.35, h.y - 0.35 + u * 0.1, h.z + fc * (1.5 - u * 0.4) - fs * 0.35), V(h.x, h.y - 0.02, h.z), 32 - u * 6, time); }
    else if (t < 11.6) { const h = k1.mark('head', V()), u = E(8.6, 11.6, t); L.aim(cam, 3, V(h.x + 2.0, 0.7, h.z + 3.0), V(h.x, h.y + 1 + u * 4, h.z - u), 52 + u * 10, time, 0.02); }
    else if (t < 14.2) { const u = E(11.6, 14.2, t); L.aim(cam, 4, V(6.5 - u * 1.5, 1.0 + u * 0.8, 6.0), V(0, 2.4 + u * 1.2, -4), 52, time); }
    else { const h = k2.mark('head', V()), u = E(14.2, TURN_LEN, t); L.aim(cam, 5, V(m.x + 1.8, 1.5 + u * 0.3, m.z + 3.4), V(h.x * 0.5, 2.6, -6), 52, time); }
  }
}

// ---------------------------------------------------------------- the way out
export const END_LEN = 28.5;
/** Breaths, each a little longer: when each of her seven embers goes out. */
const BREATHS = [8.8, 10.2, 11.7, 13.4, 15.3, 17.6, 21.5];
export class HoursEnding {
  t = -1; over = false; private c = new Cues(); private lens = new Lens(); private kit: HoursKit;
  constructor(kit: HoursKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { this.t = 0; this.over = false; this.c.clear(); this.lens.cut = 0; document.body.classList.add('cine'); sound.score?.set('scene'); this.kit.hd.cine = { day: 1 }; }
  stop() { const { k1, hd, f } = this.kit; this.t = -1; this.over = false; f.sceneMove = { x: 0, z: 0 }; k1.size(SISTER_SCALE); k1.emberHold = null; k1.dissolve.value = 0; k1.cleaver.visible = true; hd.cine = null; this.kit.hud.verse(''); document.body.classList.remove('cine'); }
  skip() { if (this.active && this.t > 2.2 && this.t < END_LEN) { this.c.off = true; this.t = END_LEN; } }
  step(dt: number, time: number) {
    if (!this.active) return; const { f, fx, hud, k1, k2 } = this.kit, m = f.m, k = f.king as Sister, c = this.c; this.t += dt; const t = this.t; this.lens.trauma *= Math.exp(-dt * 2.4);
    c.at(t, 0.05, 'hush', () => { sound.duck(0.05, 3); sound.play('pDeath', { gain: 1, wet: 0.7, bus: 'voice' }); });
    speak(HOURS_ENDING.lines, t, (at, id, g) => c.at(t, at, id, g), v => hud.verse(v));
    // the hours go up out of the cloth into the sunlight, hundreds, slowly
    if (t < 6 && Math.random() < 0.9) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, r = Math.random() * 3.6, y = 0.5 + Math.random() * 3.5 * (1 - E(3, 6, t)); fx.sparks.emit(V(k.x + Math.sin(a) * r, y, k.z + Math.cos(a) * r), V(0, 1, 0), 2, 0.9, 0.3, -1.6, time); }
    c.at(t, 0.4, 'up', () => sound.play('embersUp', { gain: 0.9, wet: 0.7 }));
    // the linen falls in on itself, empty; inside, a woman no bigger than you, against the dial
    c.at(t, 6.6, 'her', () => { k2.show(false); k.form = 1; k.x = 0; k.z = -4.4; k.yaw = 0; k.set('sit'); k1.size(1.05); k1.settle(); k1.show(true); k1.cleaver.visible = false; k1.eyeK = 0.6; k1.emberHold = 7; fx.puffs.emit(V(0, 0.3, -4), 24, 4, 1.6, time); sound.play('sheetFall', { gain: 0.7, wet: 0.6 }); });
    if (t > 6.6) { if (k.mode !== 'sit') k.set('sit'); k.mt = k.prev = 1.0; k.x = 0; k.z = -4.4; k.yaw = 0; }
    // you kneel beside her; nothing to press
    f.sceneMove = t > 7.0 && t < 9.4 && Math.hypot(m.x, m.z + 4.4) > 1.9 ? { x: -m.x * 0.12, z: -(m.z + 4.4) * 0.12 } : { x: 0, z: 0 };
    BREATHS.forEach((b, i) => c.at(t, b, 'b' + i, () => { k1.emberHold = 6 - i; sound.play('sBreath', { gain: 0.7 - i * 0.05, wet: 0.6, rate: 1 - i * 0.03, bus: 'voice' }); sound.play('emberOut', { gain: 0.35, wet: 0.6 }); }));
    // you wait two seconds longer than is comfortable, then set your blade's fire to her linen
    c.at(t, 23.6, 'fire', () => { const p = V(k.x, 0.6, k.z + 0.3); fx.bursts.add('fire', p, 2.4, 0.9, time); fx.bursts.add('flare', p, 4, 0.4, time); fx.sparks.emit(p, V(0, 1, 0), 60, 3, 2, -0.8, time); sound.play('fire', { gain: 0.9, wet: 0.5 }); this.lens.trauma = 0.25; });
    if (t > 23.6) { k1.dissolve.value = E(24, 26.5, t); if (Math.random() < 0.5) fx.bursts.add('fire', V(k.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.2, k.z + (Math.random() - 0.5) * 0.6), 1.2, 0.6, time, Math.random() * 6); }
    c.at(t, 25.6, 'title', () => { hud.say(HOURS_ENDING.title.name, 3, 'title', HOURS_ENDING.title.sub); sound.play('rise', { gain: 0.5, wet: 0.7 }); });
    if (t >= END_LEN && !this.over) { this.over = true; document.body.classList.remove('cine'); hud.won(f); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k1 } = this.kit, m = f.m, t = this.t, L = this.lens, k = f.king as Sister;
    if (t < 6.6) { const u = E(0, 6.6, t); L.aim(cam, 1, V(m.x + 3 - u, 1 + u * 0.8, m.z + 1.5), V(k.x, 2 + u * 3, k.z), 46, time); }
    else if (t < 9.6) { L.aim(cam, 2, V(2.4, 0.9, -1.2), V(0, 0.8, -4.4), 38, time); }
    else if (t < 23.6) { const h = k1.mark('head', V()), u = E(9.6, 23.6, t); L.aim(cam, 3, V(h.x + 1.0 - u * 0.2, h.y + 0.15, h.z + 2.1 - u * 0.5), V(h.x, h.y - 0.15, h.z), 38 - u * 6, time); }
    else if (t < 25.4) { L.aim(cam, 4, V(1.6, 1.0, -1.6), V(0, 0.7, -4.4), 40, time); }
    else { const u = E(25.4, END_LEN, t); L.aim(cam, 5, V(3.5, 1.2, -9 - u), V(DIAL_FOOT.x, 0.2, DIAL_FOOT.z + 2), 40, time); }
  }
}
