// The way in and the way out: the intro before round 1 and the ending after the last blow. Both skippable.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import type { KingView } from './kingView.ts';
import { NOOSE, RIDE, RIP, type King } from './king.ts';
import type { Fight } from '../../combat/fight.ts';
import type { Motor } from '../../player/motor.ts';
import type { PlayerView } from '../../player/view.ts';
import type { MomentSpec } from '../../game/moment.ts';
import type { Fx } from '../../render/impact.ts';
import type { Hud } from '../../ui/hud.ts';
import { KING_LINES, KING_STORY, KING_TITLES } from './kingScript.ts';
import { Cues, Lens } from '../../game/sceneKit.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export interface SceneKit { f: Fight; pv: PlayerView; k1: KingView; k2: KingView; fx: Fx; hud: Hud }

// ---------------------------------------------------------------- why
export const STORY = KING_STORY;
/** Which line is which: the camera and the fires follow the telling. */
const FIRE = 0, KEEP = 1, KING = 2, NIGHT = 3, GONE = 4, YOU = 5;
const LINE = 6.4;
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
    if (i < NIGHT || k.mode === 'hang') { if (k.mode !== 'hang') k.set('hang'); k.th = Math.sin(t * 0.9) * 0.07; k.mt = 0; }
    c.at(t, LINE * KING + 0.8, 'creak', () => sound.play('creak', { gain: 0.6, wet: 0.8 })); c.at(t, LINE * KING + 3, 'creak2', () => sound.play('creak', { gain: 0.5, wet: 0.8 })); c.at(t, LINE * KING + 5.2, 'creak3', () => sound.play('creak', { gain: 0.4, wet: 0.9 }));
    c.at(t, LINE * KEEP + 0.6, 'names', () => { sound.play('fire', { gain: 0.5, wet: 0.6 }); sound.play('whisper', { gain: 0.35, wet: 0.95 }); });
    c.at(t, LINE * GONE + 0.5, 'gone', () => { sound.play('whisper', { gain: 0.6, wet: 0.95 }); sound.play('doom', { gain: 0.5, wet: 0.8 }); }); for (const [n, h] of [2.2, 3.6, 5.0].entries()) c.at(t, LINE * GONE + h, 'gh' + n, () => sound.play('heart', { gain: 0.45 + n * 0.12, wet: 0.5 }));
    // the fires go out, and stay out, until a hand closes on one
    this.flame = i < NIGHT ? 1 : i === NIGHT ? 1 - E(0.8, 3.4, u) : i === GONE ? 0.06 : 0.06 + 0.94 * E(2.0, 3.0, u); this.omen = i === NIGHT ? 0.34 * E(0.4, 3.6, u) : i === GONE ? 0.34 : 0;
    c.at(t, LINE * NIGHT + 0.9, 'out', () => { sound.play('vanish', { gain: 0.5, rate: 0.6, wet: 0.9 }); sound.play('kBreath', { bus: 'voice', gain: 0.7, wet: 0.9, rate: 0.7 }); });
    c.at(t, LINE * YOU + 0.05, 'hand', () => { m.begin('clench'); pv.ember = 0.3; sound.play('heart', { gain: 0.9 }); });
    c.at(t, LINE * YOU + 1.4, 'catch', () => { pv.ember = 2; sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('heart', { gain: 0.8 }); pv.boomAt.set(m.x, 1.3, m.z - 0.4); pv.boomK = 0.25; fx.sparks.emit(V(m.x - 0.1, 1.35, m.z - 0.45), V(0, 0.8, 0), 40, 1.4, 1.8, -1.4, time); });
    if (t >= STORY_LEN) this.end();
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const t = this.t, m = this.kit.f.m, L = this.lens, i = Math.min(YOU, Math.floor(t / LINE)), u = (t - i * LINE) / LINE, p = this.fires[i === KEEP ? 2 : 4] ?? this.fires[0], r = Math.hypot(p.x, p.z), ox = p.x / r, oz = p.z / r;
    if (i === FIRE || i === KEEP) L.aim(cam, 1 + i * 10, V(p.x - ox * (4.6 - u * 0.9) + oz * 1.5 * (i === KEEP ? -1 : 1), 0.7 + u * 0.2, p.z - oz * (4.6 - u * 0.9) - ox * 1.5 * (i === KEEP ? -1 : 1)), V(p.x, 1.35, p.z), 40, time);
    else if (i === KING) L.aim(cam, 2, V(1.9 - u * 0.6, 0.6 + u * 0.3, 3.4 - u * 0.8), V(-0.1, 2.5 + u * 0.3, -4), 46, time, -0.03);
    else if (i === NIGHT) L.aim(cam, 3, V(2.6 - u * 1.6, 2.0 + u * 1.2, 12 - u * 1.2), V(-5, 7.6 + u * 0.6, -18), 54, time);
    else if (i === GONE) L.aim(cam, 5, V(-3.2 + u * 1.4, 0.35 + u * 0.5, 6 - u * 2.2), V(0, 1.8 + u * 1.2, -4), 40 - u * 4, time, 0.02);
    else L.aim(cam, 4, V(m.x - 0.75 + u * 0.2, 1.42 + u * 0.08, m.z - 1.35 + u * 0.25), V(m.x + 0.02, 1.36 + u * 0.16, m.z), 36 - u * 3, time);
  }
}

// ---------------------------------------------------------------- the way in
/** The court before he wakes is held half as long again as it was; from his waking it runs as it always did, to the beat of his joints. */
const WAKE = 11.0, SLOW = 1.5, at0 = (t: number) => t < WAKE * SLOW ? t / SLOW : t - WAKE * (SLOW - 1);
export const INTRO_LEN = 17.0 + WAKE * (SLOW - 1);
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
    const { f, fx, hud, pv } = this.kit, m = f.m, k = f.king, c = this.c; this.t += dt; const real = this.t, t = at0(real); this.lens.trauma *= Math.exp(-dt * 2.6);
    if (t < 11.0) this.kneel();
    c.at(real, 5.0, 'v0', () => hud.verse(KING_LINES.keepers)); c.at(real, 9.0, 'v0x', () => hud.verse(''));
    c.at(real, 9.6, 'v1', () => hud.verse(KING_LINES.kneel)); c.at(real, 14.4, 'v1x', () => hud.verse(''));
    c.at(t, 0.1, 'wind', () => sound.play('doom', { gain: 0.6 }));
    c.at(t, 1.3, 'place', () => hud.say(KING_TITLES.court, 2.6, 'place'));
    c.at(t, 3.2, 'b0', () => sound.play('kBreath', { gain: 0.5, wet: 0.9, x: 0, z: -4, bus: 'voice' }));
    for (let i = 0; i < 3; i++) c.at(t, 4.5 + i * 0.75, 's' + i, () => sound.play('scrape', { x: m.x, z: m.z, gain: 0.5, rate: 0.8 }));
    c.at(t, 6.9, 'eye', () => { pv.ember = 1.9; sound.play('flare', { gain: 0.6 }); sound.play('heart', { gain: 0.8 }); });
    c.at(t, 8.7, 'b1', () => sound.play('kBreath', { gain: 1.1, wet: 0.6, x: 0, z: -4, bus: 'voice', rate: 0.85 })); c.at(t, 9.9, 'tick', () => { sound.play('groan', { gain: 0.6, x: 0, z: -4 }); });
    c.at(t, 10.5, 'hb', () => sound.play('heart', { gain: 0.9 }));
    // it gets up the wrong way
    c.at(t, 11.0, 'wake', () => { k.mt = k.prev = 4.55; });
    // each joint is drawn in before it lands
    for (const [n, at] of [11.2, 11.72, 12.32].entries()) { c.at(t, at - 0.42, 'r' + n, () => sound.play('rise' + n, { gain: 0.95, x: 0, z: -4 })); c.at(t, at, 'j' + n, () => { this.lens.trauma = 0.55 + n * 0.1; fx.puffs.emit(V(0, 0, -4), 6, 2, 1.1, time); }); }
    c.at(t, 11.9, 'swell', () => sound.play('swell', { gain: 0.8 }));
    c.at(t, 12.75, 'roar', () => { sound.play('kScreech', { gain: 0.95, bus: 'voice' }); sound.play('braam', { gain: 0.85 }); sound.duck(0.4, 0.8); this.lens.trauma = 0.9; hud.say(KING_TITLES.hanged, 2.0, 'title'); fx.puffs.emit(V(0, 0, -4), 18, 3, 1.6, time); fx.bursts.add('ground', V(0, 0.06, -4), 9, 0.9, time, 0, 0.7, 0.3, 0.1); });
    if (t > 12.75 && t < 14) this.lens.trauma = Math.max(this.lens.trauma, 0.7 * (1 - E(13, 14, t)));
    c.at(t, 14.5, 'ready', () => { m.begin('flick'); sound.play('sheathe', { gain: 0.7 }); });
    c.at(t, 14.85, 'burn', () => { pv.ember = 2; sound.play('aura1', { gain: 0.8 }); pv.boomAt.set(m.x, 1.3, m.z); pv.boomK = 0.4; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; fx.bursts.add('pillar', V(m.x + Math.cos(a) * 0.9, 0, m.z + Math.sin(a) * 0.9), 1.1, 0.7, time + i * 0.015); } fx.sparks.emit(V(m.x, 1, m.z), V(0, 0.6, 0), 60, 3, 2.2, -1.8, time); });
    if (real >= INTRO_LEN) this.end();
    return t > 4.0 && m.z > 5.6 && t < 11 ? -0.4 / SLOW : 0;
  }
  camera(cam: THREE.PerspectiveCamera, time: number, fov: number) {
    const t = at0(this.t), m = this.kit.f.m, L = this.lens;
    if (t < 4.0) { const u = E(0, 4.4, t); L.aim(cam, 1, V(-5.5 + u * 3.2, 11.5 - u * 8.2, -19 + u * 6.5), V(0, 0.6 + u * 0.6, 1 + u * 2), 50 - u * 6, time); }
    else if (t < 6.4) { const u = E(4, 6.4, t); L.aim(cam, 2, V(m.x - 1.3 + 0.2 * u, 0.24, m.z + 1.35 - u * 0.5), V(m.x - 0.15, 0.4, m.z + 0.1), 34, time, 0.02); }
    else if (t < 8.4) { const u = E(6.4, 8.4, t); L.aim(cam, 3, V(m.x + 0.6 - 0.22 * u, 1.53, m.z - 1.6 + 0.1 * u), V(m.x, 1.56, m.z), 28, time); }
    else if (t < 10.9) { const u = E(8.4, 10.9, t); L.aim(cam, 4, V(1.15 - u * 0.25, 1.25 + u * 0.15, -5.9 + u * 0.35), V(0.15, 1.3, 2), 44 - u * 5, time, -0.02); }
    else if (t < 14.3) { const u = E(10.9, 13.2, t), w = E(12.7, 13.1, t); L.aim(cam, 5, V(-1.3 + u * 0.5, 0.5 + u * 0.3, -0.2 + u * 0.5 - w * 0.7), V(0, 1.1 + u * 1.4, -4), 50 - w * 4, time, 0.05 * (1 - u)); }
    else { const u = E(14.3, 17.0, t); L.aim(cam, 6, V(m.x - 0.95 + 1.35 * u, 0.5 + 0.95 * u, m.z + 2.2 + 1.9 * u), V(m.x + 0.1, 1.5, m.z - 4), 50 + (fov - 50) * u, time); }
  }
}

// ---------------------------------------------------------------- the way out
/** After the cutaway the morning comes half as slowly again as it did, with words for it. */
const CUT = 6.6, LATE = 1.5, at1 = (t: number) => t < CUT ? t : CUT + (t - CUT) / LATE;
export const END_LEN = CUT + (18.5 - CUT) * LATE;
export class Ending {
  t = -1; /** How far the eclipse has lifted, and how much first light there is. */ clear = 0; dawn = 0; over = false; private c = new Cues(); private lens = new Lens(); private kit: SceneKit; private A = V(); private Y = 0;
  constructor(kit: SceneKit) { this.kit = kit; }
  get active() { return this.t >= 0; }
  start() { const m = this.kit.f.m; this.t = 0; this.over = false; this.clear = this.dawn = 0; this.c.clear(); this.lens.cut = 0; this.A.set(m.x, 0, m.z); const k = this.kit.f.king; this.Y = Math.atan2(m.x - k.x, m.z - k.z); document.body.classList.add('cine'); }
  stop() { this.t = -1; this.clear = this.dawn = 0; this.over = false; this.kit.f.sceneMove = { x: 0, z: 0 }; document.body.classList.remove('cine'); }
  skip() { if (this.active && this.t > 2.2 && this.t < END_LEN) { this.place(); this.c.off = true; this.t = END_LEN; } }
  private place() { this.c.at(99, 0, 'place', () => { const { f, pv, k2 } = this.kit, m = f.m, k = f.king; k.x = 0; k.z = -11; k.yaw = 0; k2.settle(); m.revive(0, -7, 0); pv.reset(); }); }
  step(dt: number, time: number) {
    if (!this.active) return; const { f, pv, fx, hud } = this.kit, m = f.m, c = this.c; this.t += dt; const real = this.t, t = at1(real); this.lens.trauma *= Math.exp(-dt * 2.4);
    c.at(real, 4.4, 'e0', () => hud.verse(KING_LINES.burns)); c.at(real, 6.5, 'e0x', () => hud.verse(''));
    c.at(real, 9.0, 'e1', () => hud.verse(KING_LINES.night)); c.at(real, 13.4, 'e1x', () => hud.verse(''));
    c.at(real, 14.2, 'e2', () => hud.verse(KING_LINES.lastKeepers)); c.at(real, 18.7, 'e2x', () => hud.verse(''));
    this.clear = E(6.2, 11.5, t); this.dawn = E(9.5, 15, t);
    c.at(t, 0.05, 'hush', () => { sound.duck(0.05, 2.2); });
    c.at(t, 3.6, 'crack', () => sound.play('tear', { gain: 0.6, wet: 0.7 }));
    c.at(t, 4.2, 'burn', () => { sound.play('fire', { gain: 0.9, wet: 0.6 }); sound.play('whisper', { gain: 0.8, wet: 0.9 }); });
    if (t > 3.6 && t < 6.6 && Math.random() < 0.7) { const k = f.king; fx.sparks.emit(V(k.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 2.4, k.z + (Math.random() - 0.5) * 1.2), V(0, 0.9, 0), 5, 1.2, 1.6, -2.6, time); }
    c.at(t, 6.6, 'cutaway', () => this.place());
    // he doesn't look back
    if (t > 6.7 && t < 14.2) { f.sceneMove = { x: 0, z: 0.4 / LATE }; } else f.sceneMove = { x: 0, z: 0 };
    c.at(t, 7.9, 'blast', () => { const p = V(0, 1.2, -11); for (let i = 0; i < 5; i++) fx.bursts.add('fire', p.clone().add(V((Math.random() - 0.5) * 2.4, Math.random() * 1.8 - 0.4, 0)), 4.4, 1.0, time + i * 0.05, i); fx.bursts.add('flare', p, 12, 0.5, time); for (let i = 0; i < 9; i++) fx.bursts.add('pillar', V((i - 4) * 0.8, 0, -11 + Math.random()), 3.2, 1, time + Math.abs(i - 4) * 0.04); fx.sparks.emit(p, V(0, 0.8, 0.2), 180, 7, 2.4, -1.4, time); fx.sparks.emit(p, V(0, 0.5, 0.4), 120, 5, 2.4, -2.2, time + 0.1); fx.puffs.emit(V(0, 0, -11), 20, 3.6, 2, time); pv.boomAt.set(0, 2, -10); pv.boomK = 1.1; this.lens.trauma = 0.7; sound.play('boom', { gain: 1 }); sound.play('doom', { gain: 0.8 }); });
    if (t > 8 && t < 14 && Math.random() < 0.8) fx.sparks.emit(V((Math.random() - 0.5) * 7, 0.2 + Math.random() * 3, m.z - 2 - Math.random() * 6), V(0, 0.6, 0.5), 3, 1, 1.8, -1.6, time);
    c.at(t, 11.5, 'eye', () => { sound.play('heart', { gain: 0.6 }); });
    if (t > 11.6 && t < 14.2) pv.ember = Math.max(0.2, pv.ember - dt * 0.6);
    c.at(t, 14.2, 'rest', () => { m.begin('flick'); sound.play('whooshH', { gain: 0.5 }); });
    c.at(t, 14.9, 'title', () => { hud.say(KING_TITLES.dawn, 3.6, 'victory', KING_TITLES.dawnSub); sound.play('uiGo', { gain: 0.6 }); });
    if (real >= END_LEN && !this.over) { this.over = true; this.clear = 1; this.dawn = 1; document.body.classList.remove('cine'); hud.won(f); }
  }
  camera(cam: THREE.PerspectiveCamera, time: number) {
    const { f, k2 } = this.kit, m = f.m, k = f.king, t = at1(this.t), L = this.lens, s = Math.sin(this.Y), c = Math.cos(this.Y);
    if (t < 3.6) { const u = E(0, 3.6, t); // in front of him, low: the turn, and what he has turned his back on
      L.aim(cam, 1, V(m.x + s * (3.1 - u * 0.5) + c * 0.75, 0.55 + u * 0.15, m.z + c * (3.1 - u * 0.5) - s * 0.75), V(m.x - s * 0.8, 1.35, m.z - c * 0.8), 44 - u * 4, time); }
    else if (t < 6.6) { const u = E(3.6, 6.6, t), h = k2.hurt(V()); L.aim(cam, 2, V(k.x + s * 2.6 - c * (1.5 - u * 0.8), 0.6 + u * 0.5, k.z + c * 2.6 + s * (1.5 - u * 0.8)), h.setY(Math.min(1.7, h.y) + 0.15 + u * 0.15), 44, time, -0.03); }
    else if (t < 11.3) { const u = E(6.6, 11.3, t); L.aim(cam, 3, V(m.x + 0.5 - u * 0.2, 0.85 + u * 0.2, m.z + 4.2 - u * 1.3), V(m.x - 0.1, 1.25 + u * 0.1, m.z - 1), 34, time); }
    else if (t < 14.1) { const u = E(11.3, 14.1, t); L.aim(cam, 4, V(m.x + 0.9, 1.5, m.z + 1.0 - u * 0.1), V(m.x, 1.53, m.z), 30, time); }
    else { const u = E(14.1, 22, t); L.aim(cam, 5, V(m.x - 1.4 - u * 0.6, 1.1 + u * 3.4, m.z + 3.4 + u * 4.2), V(m.x, 1.5 + u * 0.3, m.z - 4), 46, time); }
  }
}

// ---------------------------------------------------------------- the moments (the grabs and the rewards)
/** Each moment is staged on the boss's own clock (`stage`), so it never runs ahead of or behind the blows: the page plays these specs while the simulation holds the hero. */
export function kingMoments(sim: King, m: Motor): Record<'noose', MomentSpec> {
  /** From the King toward the hero, on the ground, and its right-hand side. */
  const away = () => { const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d; return { ux, uz, sx: -uz, sz: ux }; };
  /** How high his feet are on the noose at its clock (the sim has him where he is in the plane). */
  const nooseH = (t: number) => { const { lift, swing: [s0, s1], release, land } = NOOSE, FEET = 1.35; if (t < lift) return FEET * E(0, lift, t); if (t < release) return FEET + 0.35 * Math.sin(Math.PI * 2 * Math.max(0, Math.min(1, (t - s0) / (s1 - s0)))); if (t < land) { const u = (t - release) / (land - release); return FEET * (1 - u) + 2.2 * 4 * u * (1 - u); } return 0; };
  /** Lying, the hero's back is on the ground for the beat after the landing, and he gets up from it by lie..end. */
  const lying = (t: number) => t < NOOSE.land ? 0 : 1 - E(NOOSE.lie, NOOSE.end, t);
  /** The grab, seen from the hero's own eyes: the lens is where his head is, so the King's hand is at the bottom of the frame and his face above. */
  const noose: MomentSpec = {
    first: true, snap: true,
    frame: (t, eye, at) => {
      const T = sim.nooseAt(t), ax = T.x - sim.x, az = T.z - sim.z, ad = Math.hypot(ax, az) || 1, ux = ax / ad, uz = az / ad; // from the King to the hero
      const N = NOOSE.swing[0], R = NOOSE.release, LD = NOOSE.land, LIE = NOOSE.lie, END = NOOSE.end, jit = t < N ? 0.01 : 0;
      // the head: just behind the throat, out from the King
      eye.set(T.x + ux * 0.12 + Math.sin(t * 41) * jit, T.y + 0.12 + Math.sin(t * 37) * jit, T.z + uz * 0.12 + Math.cos(t * 43) * jit);
      if (t < N) { // the lift: his face fills the top, the view closing in as the air goes
        const k = E(0, NOOSE.lift, t); at.set(sim.x + ux * 0.25, 3.25 + 0.15 * k, sim.z + uz * 0.25); return 50 - 9 * k;
      }
      if (t < R) { // the swing: the view turns to the way he is flying round, so the world whips past
        const a = T.yaw, tx = Math.cos(a), tz = -Math.sin(a), w = E(N, N + 0.3, t), fx = sim.x + ux * 0.25, fy = 3.4, fz = sim.z + uz * 0.25;
        at.set(fx + (eye.x + tx * 4 - fx) * w, fy + (eye.y - 0.25 - fy) * w, fz + (eye.z + tz * 4 - fz) * w); return 60;
      }
      if (t < LD) { // the throw: the view goes with him, and turns over as he does
        const T2 = sim.nooseAt(Math.min(LD, t + 0.03)), vx = T2.x - T.x, vy = T2.y - T.y, vz = T2.z - T.z, vl = Math.hypot(vx, vy, vz) || 1, a = T.yaw, w = E(R, R + 0.15, t);
        const dx = (Math.cos(a) * (1 - w) + vx / vl * w), dy = vy / vl * w, dz = (-Math.sin(a) * (1 - w) + vz / vl * w), dl = Math.hypot(dx, dy, dz) || 1;
        at.set(eye.x + dx / dl * 4, eye.y + dy / dl * 4, eye.z + dz / dl * 4); return 62 - 4 * E(R, LD, t);
      }
      // the landing: his back on the stones, the lens low by his head, the King far off above
      const L = sim.landAt, lx = L.x - sim.x, lz = L.z - sim.z, ll = Math.hypot(lx, lz) || 1, vx2 = lx / ll, vz2 = lz / ll, g = E(LIE, END, t);
      const lie = [L.x + vx2 * 0.1, 0.32, L.z + vz2 * 0.1], stand = [L.x + vx2 * 0.12, 1.62, L.z + vz2 * 0.12];
      eye.set(lie[0] + (stand[0] - lie[0]) * g, lie[1] + (stand[1] - lie[1]) * g, lie[2] + (stand[2] - lie[2]) * g);
      const kingLook = [sim.x, 3.2, sim.z], faceLook = [eye.x - vx2 * 4, eye.y - 0.1, eye.z - vz2 * 4];
      at.set(kingLook[0] + (faceLook[0] - kingLook[0]) * g, kingLook[1] + (faceLook[1] - kingLook[1]) * g, kingLook[2] + (faceLook[2] - kingLook[2]) * g); return 52 - 2 * g;
    },
    // the flight turns him over twice, and then he lands on his back
    roll: t => {
      const R = NOOSE.release, LD = NOOSE.land, LIE = NOOSE.lie, END = NOOSE.end;
      if (t < R) return 0;
      if (t < LD) return -4 * Math.PI * (t - R) / (LD - R);
      if (t < LIE) return 0.35 * (1 - E(LD, LD + 0.9, t));
      return 0.12 * (1 - E(LIE, END, t));
    },
    dim: t => t < NOOSE.land ? 0 : t < NOOSE.lie ? 0.5 + 0.45 * (1 - E(NOOSE.land, NOOSE.land + 0.35, t)) : 0.5 * (1 - E(NOOSE.lie, NOOSE.end, t)),
    hero: (t, o) => { const T = sim.nooseAt(t); o.set(0, t < NOOSE.land ? T.y - NOOSE.throat : 0.2 * lying(t), 0); },
    // the flight turns him over once and a quarter, so he lands on his back
    tumble: t => t < NOOSE.release ? 0 : t < NOOSE.land ? -Math.PI * 2.5 * (t - NOOSE.release) / (NOOSE.land - NOOSE.release) : -Math.PI / 2 * lying(t),
    rate: t => t > NOOSE.release - 0.1 && t < NOOSE.land + 0.2 ? 0.4 : 1,
    letterbox: true,
    cues: [{ t: 0, name: 'seize' }, { t: 0.3, name: 'lift' }, { t: NOOSE.swing[0], name: 'swing' }, { t: NOOSE.release, name: 'throw' }, { t: NOOSE.land, name: 'land' }, { t: NOOSE.lie, name: 'rise' }],
  };
  return { noose };
}
