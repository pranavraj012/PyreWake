// What the river's own events look and sound like, and how the place answers them: lamps going out, rings on the water, the boiled bed.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import type { Fight, FightEvent } from '../../combat/fight.ts';
import { settings } from '../../core/settings.ts';
import type { Director } from '../../game/director.ts';
import type { Post } from '../../render/post.ts';
import type { Hud } from '../../ui/hud.ts';
import type { buildGhats } from './ghats.ts';
import type { RiverView } from './riverView.ts';
import { RIVER_CALLS } from './riverScript.ts';
import type { River } from './river.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Ev = Extract<FightEvent, { k: 'b' }>;

export class RiverDirector {
  private dir: Director; private f: Fight; private g: Awaited<ReturnType<typeof buildGhats>>; private v1: RiverView; private v2: RiverView; private post: Post; private hud: Hud; private boilT = 0; private stepT = 0; private darkK = 0; private freedSeen = 0; private sprayT = 0; private told = new Set<string>(); private waterT = 0;
  constructor(dir: Director, f: Fight, g: Awaited<ReturnType<typeof buildGhats>>, v1: RiverView, v2: RiverView, post: Post, hud: Hud) {
    this.dir = dir; this.f = f; this.g = g; this.v1 = v1; this.v2 = v2; this.post = post; this.hud = hud; dir.moods = { pole: 'row', chain: 'row2', lantern: 'row3', bare: 'weight', last: 'weight2' }; dir.extra = (e, t) => this.on(e, t); dir.ambient = fi => this.ambient(fi);
  }
  get sim() { return this.f.boss as River; }
  private ambient(f: Fight) { sound.bed('waterBed', f.phase === 'won' ? 0.35 : 0.62); sound.bed('windLow', 0.3); sound.bed('lampsBed', 0.18 + 0.2 * this.g.water.line.value); }
  /** After a rest, or a new fight. */
  reset() { this.turnK = 0; if (this.f.round === 1) { this.fieldK = 0; this.g.unburden(0); } this.boilT = 0; this.darkK = 0; this.freedSeen = 0; this.g.water.boil.value.w = 0; this.g.lamps(1, true); this.told.clear(); this.post.heat.value = 0; this.dir.inkWant = 0; this.dir.mono = 0; }
  round2(first = false) { this.g.lamps(0.3, first); }
  private ripple(x: number, z: number, a: number, t: number) { this.g.ripple(x, z, a, t); }
  private say(n: string, o: { x?: number; z?: number; gain?: number; rate?: number; delay?: number; wet?: number } = {}) { sound.play(n, o); }
  /** A scene holding the light: the posts' lamps, his lantern, and how far the night has come in (0-1). */ cine: { lamps: number; lantern: number; night: number; black?: number } | null = null;
  /** How far the turn scene has changed the river toward round 2 (0-1); round 2 itself holds it at 1. */ turnK = 0; private fieldK = 0;
  /** Each step: lamps, darkness, ripples under the hero's feet, the boiling of the river. */
  step(sd: number, real: number, t: number) {
    const f = this.f, m = f.m, k = this.sim, w = this.g.water;
    // ripples from feet
    if (sd > 0 && (this.stepT -= sd) < 0 && !m.dead) { if (m.speed > 1.2 && m.y < 0.2) { this.stepT = 0.26; this.ripple(m.x, m.z, 0.35, t); } else this.stepT = 0.1; }
    for (const e of f.ev) { if (e.k === 'evade' || e.k === 'leap') this.ripple(m.x, m.z, 0.9, t); if (e.k === 'zoneHit' && e.z.shape !== 'line') this.ripple(e.z.x, e.z.z, e.z.shape === 'ring' ? 1.1 : 1.6, t); if (e.k === 'hit' && e.power > 1.5) this.ripple(k.hx, k.hz, 0.5 + e.power * 0.3, t); if (e.k === 'prop' && e.broken && e.p.kind === 'boat') { this.ripple(e.p.x, e.p.z, 2, t); sound.play('boatBreak', { x: e.p.x, z: e.p.z, gain: 0.9 }); } if (e.k === 'rites') this.boil(t); if (e.k === 'round2') this.round2(); if (e.k === 'reset') { this.reset(); if (f.round === 2) this.round2(true); } }
    // darkness: his hand closes over the lamp
    const dark = k.dark > 0 || k.lanterns.length > 0 && k.mode === 'wrongShore' && false; this.darkK += ((dark ? 1 : 0) - this.darkK) * Math.min(1, real * (dark ? 3.5 : 12)); w.dark.value = this.darkK;
    const base = f.round === 2 ? 0.28 + 0.72 * k.lit : 1; { const want = this.f.round === 2 ? 1 : this.turnK; this.fieldK += (want - this.fieldK) * Math.min(1, real * 2.5); if (Math.abs(want - this.fieldK) < 0.003) this.fieldK = want; this.g.unburden(this.fieldK); } const cine = this.cine; if (cine) { this.g.lamps(cine.lamps); this.v1.lampLight(cine.lantern); this.post.exposure.value = (1.85 - 0.95 * cine.night) * (1 - 0.985 * (cine.black ?? 0)); } else { this.g.lamps(dark ? 0 : this.boilT > 0 ? 0.05 : base); this.v1.lampLight(1 - this.darkK); this.post.exposure.value = 1.85 - 0.35 * this.darkK; }
    if (k.freed !== this.freedSeen) { this.freedSeen = k.freed; }
    // the boiled bed
    if (this.boilT > 0) {
      this.boilT -= real; const u = Math.min(1, (6.0 - this.boilT) / 0.6) * Math.min(1, this.boilT / 1.6), R = 15;
      w.boil.value.set(this.bx, this.bz, R * Math.min(1, (6 - this.boilT) / 0.7 + 0.1), Math.max(0, u)); this.post.heat.value = Math.max(this.post.heat.value, 0.9 * Math.max(0, u)); this.dir.mono = Math.max(this.dir.mono, 0.9 * Math.max(0, u)); this.dir.inkWant = Math.max(this.dir.inkWant, 0.5 * Math.max(0, u));
      if ((this.sprayT -= real) < 0 && u > 0.2) { this.sprayT = 0.05; for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283, r = Math.random() * R * 0.95; this.dir.fx.puffs.emit(V(this.bx + Math.cos(a) * r, 0.2, this.bz + Math.sin(a) * r), 1, 2.6, 1.6, t); } }
      if (this.boilT <= 0) { w.boil.value.w = 0; this.post.heat.value = 0; this.dir.mono = 0; this.dir.inkWant = 0; }
    }
  }
  private bx = 0; private bz = 0;
  private boil(t: number) { const m = this.f.m; this.boilT = 6.2; this.bx = m.x; this.bz = m.z; sound.play('boil', { gain: 1, wet: 0.6 }); sound.duck(0.35, 5.5); void t; }
  private callout(id: string, text: string) { if (this.told.has(id)) return; this.told.add(id); this.hud.callout(text); }
  /** Events that only this boss has. */
  on(e: Ev, t: number) {
    const { dir, f } = this, k = this.sim, m = f.m, fx = dir.fx, cam = dir.cam, x = e.x ?? k.x, z = e.z ?? k.z, at = V(x, 0.2, z), at1 = V(x, 1.2, z), pos = { x, z };
    switch (e.e) {
      case 'dark': this.say('lampOut', { gain: 1, wet: 0.5 }); sound.duck(0.3, 1.5); cam.trauma = Math.max(cam.trauma, 0.3); break;
      case 'relight': this.say('lampsRelight', { gain: 1, wet: 0.5 }); for (let i = 0; i < 4; i++) this.ripple(m.x + (Math.random() - 0.5) * 20, m.z + (Math.random() - 0.5) * 20, 1.2, t); break;
      case 'lanterns': this.say('lanternRise', { x: k.x, z: k.z, gain: 0.8 }); break;
      case 'dive': this.say('waterDive', { x: k.x, z: k.z, gain: 1 }); this.ripple(k.x, k.z, 2.2, t); fx.puffs.emit(V(k.x, 0.2, k.z), 10, 2.6, 1.2, t); break;
      case 'breach': this.say('breach', { x, z, gain: 1.1, wet: 0.5 }); this.ripple(x, z, 3, t); fx.puffs.emit(at, 24, 4, 2, t); fx.sparks.emit(at1, V(0, 1.5, 0), 60, 6, 2, 0.9, t); cam.trauma = Math.max(cam.trauma, 0.9); cam.punch = -5; sound.duck(0.45, 0.6); this.callout('breach', ''); if (e.n) this.hud.callout(RIVER_CALLS.leapt); break;
      case 'submerge': this.say('waterDive', { x, z, gain: 0.8, rate: 0.8 }); this.ripple(x, z, 2, t); break;
      case 'tide': this.say('wave', { x, z, gain: 1, wet: 0.5 }); cam.trauma = Math.max(cam.trauma, 0.35); break;
      case 'open': this.say('waveOpen', { x, z, gain: 0.9 }); fx.puffs.emit(V(x, 0.4, z), 12, 3, 1.4, t); break;
      case 'ring': this.say('armsRise', { x, z, gain: 0.9, wet: 0.5 }); this.ripple(x, z, 1.5, t); break;
      case 'arm': this.say('armCut', { x: m.x, z: m.z, gain: 0.8 }); fx.puffs.emit(V(m.x, 0.4, m.z), 4, 1.4, 0.8, t); fx.gore.emit(V(m.x, 0.7, m.z), V(0, 0.5, 0), 10, 2, 1.2, 0.6, t); break;
      case 'clench': this.say('armsClench', { x, z, gain: 1 }); cam.trauma = Math.max(cam.trauma, 0.4); break;
      case 'drain': this.say('drain', { gain: 1, wet: 0.6 }); sound.duck(0.5, 3); break;
      case 'souls': this.say('moan', { gain: 0.5, wet: 0.9 }); this.callout('souls', RIVER_CALLS.souls); break;
      case 'free': this.say('soulFree', { x, z, gain: 0.9, wet: 0.7, rate: 1 + Math.min(0.3, (e.n ?? 0) * 0.03) }); this.ripple(x, z, 1.3, t); fx.sparks.emit(at1, V(0, 1.4, 0), 18, 2, 2, -1.4, t); dir.pv.ember = 1.4; if ((e.n ?? 0) === 1) this.hud.say(RIVER_CALLS.paid, 3, 'place'); else this.hud.callout(`${e.n} freed`); break;
      case 'bite': this.say('chainBite', { x, z, gain: 1, wet: 0.4 }); fx.sparks.emit(V(x, 0.3, z), V(0, 1, 0), 40, 5, 1.6, 0.8, t); fx.puffs.emit(V(x, 0.1, z), 8, 2, 1, t); dir.court.ruin.scar(1, k.x, k.z, 0.14, Math.atan2(x - k.x, z - k.z), Math.hypot(x - k.x, z - k.z), 0.4); this.ripple(x, z, 1.2, t); cam.trauma = Math.max(cam.trauma, 0.4); break;
      case 'cut': this.say('chainCut', { x, z, gain: 0.95, rate: 0.9 + (3 - (e.n ?? 0)) * 0.08 }); fx.sparks.emit(V(m.x + Math.sin(m.yaw), 1, m.z + Math.cos(m.yaw)), V(0, 0.6, 0), 30, 4, 1.4, 0.7, t); cam.trauma = Math.max(cam.trauma, 0.3); if ((e.n ?? 3) > 0) this.hud.callout(`Chain ${3 - (e.n ?? 0)}`); break;
      case 'snap': this.say('chainSnap', { gain: 1.1, wet: 0.5 }); sound.duck(0.4, 0.8); cam.trauma = 0.85; cam.punch = -5; fx.sparks.emit(V(k.x, 1.2, k.z), V(0, 0.8, 0), 90, 7, 1.6, 0.8, t); this.hud.callout(RIVER_CALLS.snapped); break;
      case 'chainGone': this.say('chainSlide', { x, z, gain: 0.8 }); break;
      case 'haul': this.say('chainHaul', { gain: 1, wet: 0.4 }); cam.trauma = Math.max(cam.trauma, 0.6); this.hud.callout(RIVER_CALLS.hauled); break;
      case 'arrive': this.say('arrive', { gain: 0.8 }); this.hud.callout(RIVER_CALLS.cut); break;
      case 'pole': this.say('poleRun', { x, z, gain: 0.9 }); this.hud.callout(RIVER_CALLS.pole); cam.trauma = Math.max(cam.trauma, 0.5); break;
      case 'hands': this.say('handsRise', { gain: 0.8, wet: 0.6 }); break;
      case 'burn': this.say('fire', { x, z, gain: 0.6 }); fx.sparks.emit(V(x, 0.3, z), V(0, 1, 0), 30, 3, 1.8, 0.6, t); break;
      case 'real': this.say('lanternReal', { x, z, gain: 1, wet: 0.6 }); this.say('lampsRelight', { gain: 0.9, wet: 0.5, delay: 0.1 }); fx.sparks.emit(V(x, 1.2, z), V(0, 0.5, 0), 60, 4, 1.8, 0.5, t); cam.trauma = 0.6; this.hud.callout(RIVER_CALLS.real); this.ripple(x, z, 2, t); break;
      case 'fake': this.say('lanternFake', { x, z, gain: 0.7 }); this.ripple(x, z, 0.6, t); break;
      case 'lanternsBurst': this.say('lanternFlare', { gain: 0.9, wet: 0.5 }); break;
      case 'turn': this.say('coinTurn', { x, z, gain: 0.6 }); fx.sparks.emit(V(x, 1, z), V(0, 0.4, 0), 6, 3, 1.2, 0.5, t); dir.pv.ember = 1.1; break;
      case 'coinHit': this.say('coinHit', { x, z, gain: 0.6 }); break;
      case 'coinBack': this.say('coinBack', { x, z, gain: 0.7 }); fx.sparks.emit(V(x, 1.4, z), V(0, 0.4, 0), 10, 3, 1.2, 0.6, t); break;
    }
    void pos; void settings;
  }
}
