// What the Waiting House's own events look and sound like: the count breathed aloud, linen burning, the sheet torn, the stake, the sun that is the score.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import type { Fight, FightEvent } from '../../combat/fight.ts';
import type { Director } from '../../game/director.ts';
import { HOURS_CALLS, HOURS_COUNT } from '../../game/hoursScript.ts';
import type { Post } from '../../render/post.ts';
import { SUNDIR } from '../../render/sky.ts';
import type { Hud } from '../../ui/hud.ts';
import type { House } from '../../arena/house.ts';
import { HoursFx } from './hoursFx.ts';
import type { PallView } from './pallView.ts';
import type { SisterView } from './sisterView.ts';
import type { Sister } from './sister.ts';
import { DEPTH } from '../../render/surface.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
type Ev = Extract<FightEvent, { k: 'b' }>;
/** Her voices, in the names of the King's so the director's own calls find them. */
const VOICE: Record<string, string> = { kGrunt: 'sGrunt', bBark: 'pGrunt', kPain: 'sPain', bPain: 'pPain', kScreech: 'sCall', bRoar: 'pRoar', kBreath: 'sBreath', kDeath: 'sDeath', bDeath: 'pDeath' };
/** Where the sun stands as she completes counts in round 2: each lower and redder. */
const SUNS = [new THREE.Vector3(-0.85, 0.13, -0.3), new THREE.Vector3(-0.86, 0.085, -0.3), new THREE.Vector3(-0.87, 0.045, -0.3)].map(v => v.normalize());

export class HoursDirector {
  fx: HoursFx; private dir: Director; private f: Fight; private house: House; private v1: SisterView; private v2: PallView; private post: Post; private hud: Hud; light: (day: number) => void;
  private lastEmber = 7; private glideT = 0; private litT = 0; private ritesT = 0; private sunK = 0; private sunWant = 0; private second = false;
  /** A scene holds the light (0 under the smoke, 1 the sun) and the smoke; null hands it back to the fight. */ cine: { day: number } | null = null;
  constructor(dir: Director, f: Fight, house: House, v1: SisterView, v2: PallView, post: Post, hud: Hud, light: (day: number) => void, g: { cot: THREE.BufferGeometry; hook: THREE.BufferGeometry; cloth: THREE.Material; scene: THREE.Scene }) {
    this.dir = dir; this.f = f; this.house = house; this.v1 = v1; this.v2 = v2; this.post = post; this.hud = hud; this.light = light; this.fx = new HoursFx(g.scene, g.cloth, g.hook, g.cot, dir.fx, DEPTH.still);
    dir.vm = VOICE; dir.moods = { hook: 'hours', pall: 'pall' }; dir.extra = (e, t) => this.on(e, t); dir.ambient = fi => this.ambient(fi); dir.propFx = (e, t) => this.prop(e, t); dir.zoneFx = (z, t) => this.zone(z, t);
  }
  get sim() { return this.f.king as Sister; }
  private ambient(f: Fight) { const r2 = f.round === 2; sound.bed('fireBed', r2 ? 0.0 : 0.22); sound.bed('windLow', r2 ? 0.55 : 0.22); sound.bed('wind', r2 ? 0.35 : 0); sound.bed('clothBed', r2 && f.phase !== 'won' ? 0.4 : 0); }
  reset() { this.fx.reset(); this.lastEmber = 7; this.ritesT = 0; this.v2.burnt = 0; this.sunK = this.sunWant = 0; this.second = false; SUNDIR.value.copy(SUNS[0]); if (this.f.round === 1) this.light(0); else this.round2(true); }
  round2(first = false) { SUNDIR.value.copy(SUNS[0]); this.light(1); void first; }
  private prop(e: Extract<FightEvent, { k: 'prop' }>, t: number) {
    const p = e.p; if (p.kind !== 'lamp') return false;
    if (e.broken) { sound.play('cotBurst', { x: p.x, z: p.z, gain: 0.85 }); this.dir.fx.puffs.emit(V(p.x, 0.5, p.z), 14, 2.4, 1.5, t); this.dir.fx.sparks.emit(V(p.x, 0.6, p.z), V(0, 0.5, 0), 10, 1.4, 1.6, -0.9, t); this.dir.cam.trauma = Math.max(this.dir.cam.trauma, 0.2); }
    else sound.play('cotHit', { x: p.x, z: p.z, gain: 0.6 });
    return true;
  }
  /** The hour falls on every glowing stone; linen snaps taut; a sheet settles. Not fire: that is the hero's. */
  private zone(z: import('../../combat/fight.ts').Hazard, t: number) {
    const fx = this.dir.fx, cam = this.dir.cam, m = this.f.m, near = Math.max(0, 1 - Math.hypot(z.x - m.x, z.z - m.z) / 14);
    if (z.mode === 'sevenBreaths' || z.mode === 'longCount') {
      const ir = z.inner ?? 0; for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, r = ir + 0.6 + Math.sqrt(Math.random()) * (z.r - ir - 0.6), p = V(z.x + Math.sin(a) * r, 0, z.z + Math.cos(a) * r); fx.bursts.add('pillar', p, 1.6 + Math.random() * 1.6, 0.7, t + r * 0.02); if (i % 3 === 0) fx.puffs.emit(p.clone().setY(0.3), 2, 2.2, 1.4, t); }
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; fx.sparks.emit(V(z.x + Math.sin(a) * (ir + 0.2), 0.1, z.z + Math.cos(a) * (ir + 0.2)), V(0, 1, 0), 3, 1.5, 2, -1, t); }
      sound.play('hourFalls', { gain: 1, wet: 0.6 }); sound.play('erupt', { x: m.x, z: m.z, gain: 0.7 }); sound.duck(0.4, 0.8); cam.trauma = Math.max(cam.trauma, 0.7); this.dir.court.ruin.scar(2, z.x, z.z, z.r * 0.7, 0, 0, 0.3); return true;
    }
    if (z.mode === 'binding' && z.shape === 'line') { for (let i = 0; i < 6; i++) { const d = 0.8 + i * 1.5, q = V(z.x + Math.sin(z.yaw) * d, 0.15, z.z + Math.cos(z.yaw) * d); fx.puffs.emit(q, 2, 1.4, 0.9, t + i * 0.02); } sound.play('clothB', { x: z.x + Math.sin(z.yaw) * 4, z: z.z + Math.cos(z.yaw) * 4, gain: 0.8, rate: 1.3 }); cam.trauma = Math.max(cam.trauma, 0.25 * near); return true; }
    if (z.mode === 'cleanSheet' || z.mode === 'drawSheet') { fx.puffs.emit(V(z.x, 0.2, z.z), 24, z.r * 1.2, 1.6, t); fx.bursts.add('ground', V(z.x, 0.06, z.z), z.r * 2.2, 0.5, t, 0, 0.6, 0.4, 0.2); sound.play('sheetFall', { x: z.x, z: z.z, gain: 0.9 }); cam.trauma = Math.max(cam.trauma, 0.6 * near); return true; }
    return false;
  }
  step(sd: number, real: number, t: number) {
    const f = this.f, k = this.sim, m = f.m, fx = this.dir.fx;
    for (const e of f.ev) { if (e.k === 'round2') this.round2(); if (e.k === 'reset') this.reset(); if (e.k === 'rites' && k.form === 2) this.ritesT = 6; if (e.k === 'zone' && (e.z.mode === 'sevenBreaths' || e.z.mode === 'longCount')) { sound.play('countBegin', { gain: 0.9, wet: 0.5 }); this.hud.verse(''); } }
    // the count, breathed aloud: one ember goes out with each breath, and the hum steps down
    const counting = (k.mode === 'sevenBreaths' || k.mode === 'longCount') && k.mt > 0.6;
    if (counting && k.embers < this.lastEmber) { const i = 6 - k.embers; sound.play('sCount', { x: k.x, z: k.z, bus: 'voice', gain: 0.95, rate: Math.pow(2, -[0, 2, 3, 5, 7, 8, 10][Math.min(6, i)] / 12) }); sound.play('emberOut', { x: k.x, z: k.z, gain: 0.5 }); this.hud.verse(HOURS_COUNT[Math.min(6, i)]); }
    if (!counting && this.lastEmber < 7 && k.mode !== 'lostCount' && k.mode !== 'sag') this.hud.verse(''); this.lastEmber = counting ? k.embers : 7;
    if (k.mode === 'lostCount' || k.mode === 'sag') { if (this.lastEmber !== -1) this.hud.verse(''); }
    // her hem burning
    if (k.lit > 0 && sd > 0 && (this.litT -= sd) < 0) { this.litT = 0.12; const a = Math.random() * 6.283, r = k.form === 2 ? 3.6 : 0.6; fx.bursts.add('fire', V(k.x + Math.sin(a) * r, 0.25 + Math.random() * 0.5, k.z + Math.cos(a) * r), 1.2, 0.5, t, Math.random() * 6); }
    // the Pall glides on smoke
    if (k.form === 2 && sd > 0 && (this.glideT -= sd) < 0) { this.glideT = k.speed > 0.3 ? 0.06 : 0.2; const a = Math.random() * 6.283; fx.puffs.emit(V(k.x + Math.sin(a) * 3.9, 0.1, k.z + Math.cos(a) * 3.9), 1, 1.8, 1.0, t); }
    // Last Rites burns her cloth away for six seconds: the embers inside, on a frame of hoops
    if (this.ritesT > 0) { this.ritesT -= sd; this.v2.burnt = Math.min(1, this.ritesT > 5.4 ? (6 - this.ritesT) / 0.6 : this.ritesT / 1.2); } else this.v2.burnt = 0;
    // the sun is the score
    const sun = SUNS[Math.min(2, k.sunk)]; if (k.form === 2 && !this.cine && SUNDIR.value.distanceTo(sun) > 1e-4) { SUNDIR.value.lerp(sun, Math.min(1, real * 1.5)); this.light(1); }
    if (this.cine) this.light(this.cine.day);
    if (f.round === 2 && !this.second && f.bossHp / k.hp[1] < 0.4 && f.phase === 'r2') { this.second = true; sound.score?.set('pall2'); }
    const hand = this.v1.mark('handL', V()), head = k.form === 2 ? this.v2.mark('head', V()) : this.v1.mark('head', V()); this.fx.step(f, k, hand, head, sd, t);
    void m; void this.sunK; void this.sunWant; void this.post;
  }
  /** Events only this boss has. */
  on(e: Ev, t: number) {
    const { dir, f } = this, k = this.sim, m = f.m, fx = dir.fx, cam = dir.cam, x = e.x ?? k.x, z = e.z ?? k.z;
    switch (e.e) {
      case 'whorl': this.fx.whorlAt_(x, z); sound.play('whorl', { x, z, gain: 0.9, wet: 0.5 }); break;
      case 'vanish': sound.play('smokeIn', { x: k.x, z: k.z, gain: 0.8 }); fx.puffs.emit(V(k.x, 1.0, k.z), 26, 3, 1.8, t); break;
      case 'emerge': sound.play('smokeOut', { x, z, gain: 1 }); fx.puffs.emit(V(x, 1.0, z), 22, 3, 1.6, t); cam.trauma = Math.max(cam.trauma, 0.3); break;
      case 'flat': sound.play('sheetFall', { x, z, gain: 1, wet: 0.5 }); fx.puffs.emit(V(x, 0.3, z), 30, 5, 2, t); cam.trauma = Math.max(cam.trauma, 0.7); this.dir.court.ruin.scar(2, x, z, 4, 0, 0, 0.2); break;
      case 'miscount': sound.play('miscount', { x: k.x, z: k.z, bus: 'voice', gain: 0.8 }); this.hud.callout(`${e.n} of ${k.form === 2 ? 4 : 3}`); break;
      case 'lost': sound.play('lostCount', { x: k.x, z: k.z, gain: 1, wet: 0.6 }); sound.duck(0.4, 0.8); this.hud.callout(HOURS_CALLS.lost); this.hud.verse(''); fx.sparks.emit(V(k.x, 2.6, k.z), V(0, 0.6, 0), 60, 4, 1.4, 0.3, t); cam.trauma = 0.6; cam.punch = -5; if (k.form === 2) this.hud.callout(HOURS_CALLS.risen); break;
      case 'hemBurn': case 'burnStrips': if (e.e === 'burnStrips') this.fx.burnStrips(t); sound.play('fireRun', { x: k.x, z: k.z, gain: 0.9, wet: 0.5 }); sound.play('sPain', { x: k.x, z: k.z, bus: 'voice', gain: 0.9 }); this.hud.callout(HOURS_CALLS.burn); cam.trauma = Math.max(cam.trauma, 0.5); for (let i = 0; i < 6; i++) fx.bursts.add('fire', V(k.x + (Math.random() - 0.5), 0.3 + Math.random() * 1.2, k.z + (Math.random() - 0.5)), 1.8, 0.6, t + i * 0.05, i); break;
      case 'tear': this.fx.tearSheet(t); sound.play('tear', { x, z, gain: 1, wet: 0.4 }); this.hud.callout(HOURS_CALLS.tear); break;
      case 'stakeHit': sound.play('chip', { x, z, gain: 0.8 }); sound.play('thud', { x, z, gain: 0.5 }); fx.sparks.emit(V(x, 1.2, z), V(0, 0.4, 0), 24, 3, 1.4, 0.6, t); if ((e.n ?? 0) > 0) this.hud.callout(`${3 - (e.n ?? 0)} of 3`); break;
      case 'stakeBreak': sound.play('crackStone', { x, z, gain: 0.9 }); sound.play('collapse', { x, z, gain: 0.4 }); fx.sparks.emit(V(x, 1.5, z), V(0, 0.8, 0), 70, 6, 1.6, 0.8, t); fx.puffs.emit(V(x, 0.5, z), 12, 2.4, 1.4, t); this.hud.callout(HOURS_CALLS.stakeBreak); cam.trauma = 0.6; break;
      case 'sunk': sound.play('sunSink', { gain: 0.9, wet: 0.7 }); this.hud.callout(HOURS_CALLS.sunk); break;
    }
    void m;
  }
}
