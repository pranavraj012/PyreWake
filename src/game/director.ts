// Turns fight events into what you see, hear and feel.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { Mood } from '../audio/score.ts';
import type { BossView } from '../boss/view.ts';
import type { Ruin } from '../arena/ruin.ts';
import type { Fight } from '../combat/fight.ts';
import { D } from '../combat/difficulty.ts';
import { settings } from '../core/settings.ts';
import type { Input } from '../input/input.ts';
import type { PlayerView } from '../player/view.ts';
import { CueMark, type Fx } from '../render/impact.ts';
import { Crescents, Marks } from '../render/marks.ts';
import type { Post } from '../render/post.ts';
import type { Hud } from '../ui/hud.ts';
import type { FollowCam } from './camera.ts';
import { KING_CALLS, KING_TITLES } from './kingScript.ts';
/** What the director needs of the place: the court and the ghats both have it. */
export interface Court { ruin: Ruin; breach(x: number, z: number, r: number, n: number): void; tear(x: number, z: number, r: number, n: number): void; ripple?(x: number, z: number, amp: number, t: number): void }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const AURA = ['', 'Kindled', 'Ablaze', 'Pyre', 'Wake'];
const STYLE: Record<string, Mood> = { executioner: 'r1', crawler: 'crawl', hanged: 'hang', blades: 'r2', eclipse: 'eclipse' };
export class Director {
  cue = new CueMark(); marks = new Marks(); crescents = new Crescents(); heroT = 0; private at = V(); private p = V(); private hurtK = 0; private slowK = 0; private fadeK = 0; private heartT = 0; private breathT = 3; private ritesK = 0; private painT = 0; private cloak = 0; private inkT = 0; private stoneT = 0; private snapK = 0; private snapT = 0; private desatB = 0; private inkB = 0; private cutN = 0;
  f: Fight; pv: PlayerView; views: [BossView, BossView]; fx: Fx; cam: FollowCam; post: Post; hud: Hud; input: Input; camera: THREE.Camera; court: Court; onHalf: () => void = () => { }; onWon: () => void = () => { }; /** Extra colour drain asked for by a scene. */ mono = 0; /** The same drain taken to ink, and to black. */ inkWant = 0; dark = 0; private auraSeen = 0;
  constructor(o: { f: Fight; pv: PlayerView; views: [BossView, BossView]; fx: Fx; cam: FollowCam; post: Post; hud: Hud; input: Input; camera: THREE.Camera; court: Court }) { this.court = o.court; this.court.ruin.heard = (x, z, size) => { if (this.stoneT < 0) { this.stoneT = 0.05; sound.play('stone', { x, z, gain: 0.25 + size * 0.5, rate: 1.25 - size * 0.5 }); } }; this.f = o.f; this.pv = o.pv; this.views = o.views; this.fx = o.fx; this.cam = o.cam; this.post = o.post; this.hud = o.hud; this.input = o.input; this.camera = o.camera; }
  /** The second boss plugs in here: its own events, moods, voices and ambience. */ extra: ((e: Extract<import('../combat/fight.ts').FightEvent, { k: 'b' }>, t: number) => void) | null = null; moods: Record<string, Mood> = STYLE; vm: Record<string, string> = {}; ambient: ((f: Fight) => void) | null = null; /** A boss whose ground blows look otherwise: true when it has drawn the blow itself. */ zoneFx: ((z: import('../combat/fight.ts').Hazard, t: number) => boolean) | null = null; /** A place whose stone sounds otherwise: true when it has answered the blow itself. */ propFx: ((e: Extract<import('../combat/fight.ts').FightEvent, { k: 'prop' }>, t: number) => boolean) | null = null;
  get kv() { return this.views[this.f.king.form - 1]; }
  private buzz(ms: number) { this.input.rumble(ms / 90, ms / 55, 60 + ms * 1.6); if (this.input.lastDevice === 'touch' && settings.rumble > 0) try { navigator.vibrate?.(ms); } catch { /* not supported */ } }
  /** Slash angle on screen, from the blade's motion. */
  private screenAngle(v: THREE.Vector3) { const r = V().setFromMatrixColumn(this.camera.matrixWorld, 0), u = V().setFromMatrixColumn(this.camera.matrixWorld, 1); return Math.atan2(v.dot(u), v.dot(r)); }
  /** The court gives way: standing pillars well clear of the hero come down, harmlessly. */
  private bring(n: number) { const { f } = this, m = f.m; f.props.filter(p => p.kind === 'pillar' && !p.broken && Math.hypot(p.x - m.x, p.z - m.z) > 9.5).sort((a, b) => b.h - a.h || a.z - b.z).slice(0, n).forEach((p, i) => f.fell(p, Math.atan2(-p.x, -p.z) + (i % 2 ? 0.7 : -0.7))); }
  /** From the boss, in its own voice. */
  private say(a: string, b: string, gain = 1) { const k = this.f.king, n = k.form === 2 ? b : a; sound.play(this.vm[n] ?? n, { x: k.hx, z: k.hz, bus: 'voice', gain }); }

  private hit(e: { power: number; reel: boolean; kind: 'blade' | 'fire'; head: boolean }, t: number) {
    const { f, pv, fx, cam, kv } = this, m = f.m, k = f.king, pos = { x: k.hx, z: k.hz };
    const p = kv.nearest(pv.base, pv.tip, this.p), pw = e.power, v = pv.tipVel.clone().normalize(), away = V(k.hx - m.x, 0, k.hz - m.z).normalize(); if (e.kind === 'fire') p.set(k.hx, k.hanging ? 1.6 : 1.5, k.hz);
    kv.flinch(Math.atan2(away.x, away.z), pw, p); kv.wound(p, v, away, Math.min(1, 0.55 + pw * 0.2));
    const n = p.clone().addScaledVector(away, -0.16), an = this.screenAngle(v), light = pw < 0.95;
    fx.bursts.add('slash', n, 1.2 + pw * 0.6, light ? 0.13 : 0.18, t, an, 1.6, 0.7, 0.25); if (pw > 1.2) { fx.bursts.add('slash', n, 1.0 + pw * 0.4, 0.22, t + 0.02, an + 0.5, 1.5, 0.45, 0.1); fx.bursts.add('slash', n, 0.8 + pw * 0.3, 0.24, t + 0.04, an - 0.6, 1.5, 0.35, 0.08); } fx.bursts.add('flare', n, 1.1 + pw * 0.6, 0.18, t);
    if (pw >= 1.9) { fx.bursts.add('fire', n, 0.9 + pw * 0.35, 0.42, t, an); fx.bursts.add('ring', n, 1.5 + pw * 0.5, 0.28, t); }
    const d = v.clone().multiplyScalar(0.7).addScaledVector(away, 0.5); d.y += 0.25;
    fx.sparks.emit(n, d, Math.round(12 + pw * 16), 3.4 + pw * 1.8, 1.3, 0.5, t); fx.gore.emit(n, d, Math.round(12 + pw * 12), 2.6 + pw * 1.0, 1.4, 0.8, t); fx.sparks.emit(n, V(0, 0.4, 0), Math.round(3 + pw * 3), 0.9, 2, -1.2, t);
    // the blow lights the room for an instant
    if (pw >= 1.9 && e.kind === 'blade' && settings.flash && this.snapT <= 0 && m.clip?.name !== 'rites') { this.snapT = 2.2; this.snapK = 1; }
    pv.boomAt.copy(n); pv.boomK = Math.max(pv.boomK, 0.03 + pw * 0.03); cam.hit(pw, v); this.hud.struck(pw);
    // each cut of a chain lands a little higher than the last; the closer drops
    const deep = Math.min(5, m.depth), up = pw > 1.7 ? 1 : 1 + 0.028 * deep; sound.play(pw > 1.7 ? 'fleshH' : 'flesh', { ...pos, gain: light ? 0.62 : 0.78 + pw * 0.06, rate: (pw > 2.4 ? 0.9 : up) * (e.head ? 1.08 : 1) }); if (e.kind === 'fire') sound.play('fire', { ...pos, gain: 0.7 }); if (pw > 2.6) { sound.play('doom', { gain: 0.5 }); sound.duck(0.5, 0.25); }
    this.painT -= pw; if (e.reel || this.painT < 0) { this.painT = 9 + Math.random() * 7; this.say('kPain', 'bPain', e.reel ? 0.85 : 0.55); } this.buzz(8 + pw * 9);
  }
  /** After the simulation and views have stepped. `dt` is simulated time, 0 while frozen on a hit. */
  step(dt: number, real: number, t: number) {
    const { f, pv, fx, cam } = this, kv = this.kv, m = f.m, k = f.king, pos = { x: k.hx, z: k.hz }, me = { x: m.x, z: m.z };
    for (const e of f.ev) switch (e.k) {
      case 'hit': this.hit(e, t); break;
      case 'cue': if (e.strike.kind !== 'ground') this.cue.start(e.strike.kind, e.strike.mark, e.lead); sound.play(e.strike.kind === 'white' ? 'cueWhite' : e.strike.kind === 'red' ? 'cueRed' : 'cueGround', { gain: e.strike.kind === 'white' ? 1.2 : 1.2, wet: 0.25 }); if (e.strike.kind === 'red') this.buzz(40); if (e.strike === k.strikes[0] && Math.random() < 0.8) this.say('kGrunt', 'bBark', 0.75); break;
      case 'b': this.extra?.(e, t); break;
      case 'break': {
        // its attack comes apart: you should feel it stop
        const q = V(k.hx, 1.7, k.hz); fx.bursts.add('ring', q, e.by === 'heavy' ? 3 : 4.6, 0.4, t, 0, 1.5, 1.0, 0.6); fx.bursts.add('glint', q, e.by === 'heavy' ? 2.6 : 3.6, 0.35, t, 0.5, 1.5, 1.1, 0.7); if (e.by !== 'heavy') fx.bursts.add('ground', V(k.x, 0.06, k.z), 5, 0.6, t); fx.sparks.emit(q, V(0, 0.4, 0), 70, 7, 2.2, 0.9, t); fx.puffs.emit(V(k.x, 0, k.z), 6, 2.6, 1.2, t); cam.trauma = Math.max(cam.trauma, 0.8); cam.punch = -6; this.slowK = Math.max(this.slowK, 0.6);
        sound.play('break', { ...pos, gain: 1, wet: 0.5 }); sound.duck(0.35, 0.5); this.say('kPain', 'bPain', 1); this.hud.struck(3); this.buzz(80); if (e.by !== 'heavy' || m.clip?.name === m.weapon.heavy) this.hud.callout(KING_CALLS.broken); break;
      }
      case 'prop': { const p = e.p; this.court.ruin.struck(p, e.power, e.dx, e.dz, e.broken, t); if (this.propFx?.(e, t)) break; const at = { x: p.x, z: p.z }; if (e.broken && p.kind === 'lamp') { sound.play('shatter', { ...at, gain: 0.72 }); sound.play('fire', { ...at, gain: 0.6 }); cam.trauma = Math.max(cam.trauma, 0.35); this.buzz(40); } else { sound.play('chip', { ...at, gain: 0.6 }); cam.trauma = Math.max(cam.trauma, 0.18); } break; }
      case 'topple': this.court.ruin.topple(e.p, e.yaw, t); sound.play('crackStone', { x: e.p.x, z: e.p.z, gain: 0.65 }); sound.play('groan', { x: e.p.x, z: e.p.z, gain: 0.9 }); break;
      case 'fell': { this.court.ruin.fell(e.p, e.yaw, t); const d = Math.hypot(e.p.x - m.x, e.p.z - m.z); sound.play('collapse', { x: e.p.x, z: e.p.z, gain: 0.62 }); if (e.hit || d < 8) sound.duck(0.5, 0.7); cam.trauma = Math.max(cam.trauma, 0.95 - d * 0.03); this.buzz(120); if (e.hit) { this.hud.callout(KING_CALLS.crushed); this.slowK = Math.max(this.slowK, 0.6); } break; }
      case 'restore': this.court.ruin.restore(); break;
      case 'leap': sound.play('leapt', { ...me, gain: 0.8 }); this.slowK = Math.max(this.slowK, 0.5); pv.ghosts.snap(t); fx.sparks.emit(V(m.x, 0.3, m.z), V(0, 0.8, 0), 26, 2.4, 2, -1, t); pv.ember = 1.6; break;
      case 'block': { const p = pv.base.clone().lerp(pv.tip, 0.4); fx.bursts.add('flare', p, 1.8, 0.18, t, 0, 1.5, 1.1, 0.7); fx.bursts.add('slash', p, 1.6, 0.16, t, 1.1, 1.6, 1.2, 0.7); fx.sparks.emit(p, V(0, 0.3, 0), 36, 5, 2, 0.5, t); cam.trauma = Math.max(cam.trauma, 0.45); sound.play('block', { ...me, gain: 0.95 }); this.buzz(25); break; }
      case 'parry': { const p = pv.base.clone().lerp(pv.tip, 0.5); fx.bursts.add('glint', p, 3.4, 0.4, t, 0.3, 1.5, 1.25, 0.9); fx.bursts.add('ring', p, 4.2, 0.45, t, 0, 1.4, 0.9, 0.5); fx.bursts.add('flare', p, 3, 0.25, t, 0, 1.5, 1.1, 0.7); fx.sparks.emit(p, V(0, 0.5, 0), 90, 7, 2, 0.8, t); cam.trauma = 0.7; cam.punch = -7; kv.flinch(Math.atan2(k.hx - m.x, k.hz - m.z), 2); sound.play('parry', { ...me, gain: 1, wet: 0.6 }); sound.duck(0.25, 0.7); this.say('kPain', 'bPain', 0.8); this.buzz(50); this.slowK = 1; break; }
      case 'evade': if (e.perfect) { sound.play('perfect', { gain: 0.9 }); this.slowK = 1; cam.punch = -4; pv.ghosts.snap(t); fx.sparks.emit(V(m.x, 0.9, m.z), V(0, 0.3, 0), 30, 2, 2.2, -1.3, t); pv.ember = 1.6; } break;
      case 'hurt': { const a = V(k.hx - m.x, 0, k.hz - m.z).normalize(), p = V(m.x + a.x * 0.25, 1.15, m.z + a.z * 0.25); this.hurtK = e.down ? 1 : 0.8; pv.flash.value.set(1, 0.1, 0.04, 0.7); fx.bursts.add('slash', p, 1.8, 0.2, t, 0.8, 1.5, 0.15, 0.06); fx.gore.emit(p, a.clone().negate().add(V(0, 0.4, 0)), 26, 3.4, 1.4, 0.8, t); fx.sparks.emit(p, V(0, 0.4, 0), 18, 3, 2, -0.9, t); cam.trauma = e.down ? 0.95 : 0.75; this.hud.hurt(); sound.play('hurt', { ...me, gain: e.down ? 1 : 0.85, rate: e.down ? 0.9 : 1 }); if (e.down) sound.play('thud', { ...me, gain: 0.7, delay: 0.25 }); sound.duck(0.6, 0.25); this.buzz(e.down ? 120 : 70); break; }
      case 'zoneHit': {
        if (this.zoneFx?.(e.z, t)) break;
        const z = e.z, big = z.r > 2.2;
        if (z.shape === 'line') { for (let i = 0; i < 9; i++) { const d = 0.8 + i * 1.4, q = V(z.x + Math.sin(z.yaw) * d, 0, z.z + Math.cos(z.yaw) * d); fx.bursts.add('pillar', q, 2.6 + Math.random(), 0.6, t + i * 0.018); fx.sparks.emit(V(q.x, 0.3, q.z), V(0, 1, 0), 8, 4.5, 1.4, 0.8, t); } sound.play('erupt', { x: z.x + Math.sin(z.yaw) * 5, z: z.z + Math.cos(z.yaw) * 5, gain: 0.75 }); }
        else if (z.shape === 'circle') { const q = V(z.x, 0.06, z.z); fx.bursts.add('ground', q, z.r * 2.6, 0.55, t); if (z.mode === 'rain') { for (let i = 0; i < 3; i++) fx.bursts.add('pillar', V(z.x + (Math.random() - 0.5) * z.r, 0, z.z + (Math.random() - 0.5) * z.r), 3.2, 0.6, t); sound.play('fire', { x: z.x, z: z.z, gain: 0.85 }); } fx.sparks.emit(q, V(0, 1, 0), big ? 60 : 36, 5, 2, 0.8, t); fx.puffs.emit(q, 12, 2.6, 1.3, t); }
        else sound.play('fire', { x: z.x, z: z.z, gain: 0.9, rate: 0.8 });
        if (z.shape === 'circle' && z.mode !== 'rain' && z.mode !== 'idle') { this.court.ruin.scar(0, z.x, z.z, z.r * 0.95, 0, 0, f.round === 2 ? 1 : 0.25); this.court.ruin.slabs(z.x, z.z, z.r * 0.75, 7); } else if (z.shape === 'line' && z.mode === 'rupture') this.court.ruin.scar(1, z.x, z.z, 0.4, z.yaw, z.len, 1); else if (z.mode === 'rain') this.court.ruin.scar(2, z.x, z.z, z.r * 0.8, 0, 0, 0.9);
        cam.trauma = Math.max(cam.trauma, 0.5 * Math.max(0, 1 - Math.hypot(z.x - m.x, z.z - m.z) / 14)); break;
      }
      case 'shot': sound.play(e.p.big ? 'fire' : 'flare', { ...me, gain: 0.95 }); sound.play(e.p.big ? 'whooshB' : 'whooshH', { ...me, gain: 0.8, rate: 1.2 }); if (e.p.big) cam.punch = -3; break;
      case 'shotHit': { const q = V(k.hx, 1.5, k.hz); fx.bursts.add('fire', q, e.p.big ? 4 : 2, 0.6, t); fx.bursts.add('flare', q, e.p.big ? 5 : 2.6, 0.25, t); fx.sparks.emit(q, V(e.p.dx, 0.4, e.p.dz), e.p.big ? 80 : 30, 6, 1.6, 0.8, t); if (e.p.big) sound.play('boom', { ...pos, gain: 0.8, rate: 1.2 }); break; }
      case 'rush': sound.play('vanish', { ...me, gain: 0.95 }); cam.rushT = 1.3; break;
      case 'detonate': {
        const b = f.trail, n = 7, L = Math.hypot(b.bx - b.ax, b.bz - b.az); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, p = V(b.ax + (b.bx - b.ax) * u, 0, b.az + (b.bz - b.az) * u), w = i * 0.035; fx.bursts.add('pillar', p, 2.6 + Math.random() * 1.2, 0.8, t + w); fx.bursts.add('fire', V(p.x, 0.9 + Math.random() * 0.8, p.z), 2.4 + Math.random(), 0.7, t + w, Math.random() * 6); fx.sparks.emit(V(p.x, 0.6, p.z), V(0, 1, 0), 16, 5, 2, 0.9, t + w); fx.sparks.emit(V(p.x, 0.6, p.z), V(0, 0.8, 0), 10, 2.4, 2.2, -2, t + w); }
        const mid = V(b.ax + (b.bx - b.ax) * 0.5, 0.06, b.az + (b.bz - b.az) * 0.5), c = e.hit ? V(k.hx, 1.4, k.hz) : mid.clone().setY(1.2); fx.bursts.add('ground', mid, L + 6, 0.7, t); fx.bursts.add('fire', c, 5, 0.75, t + 0.06, 1); fx.bursts.add('flare', c, 9, 0.35, t); fx.puffs.emit(mid, 16, 3.4, 1.8, t); pv.boomAt.copy(c).setY(1.8); pv.boomK = 1; this.court.ruin.scar(1, b.ax, b.az, 0.55, Math.atan2(b.bx - b.ax, b.bz - b.az), L, 0.9); cam.trauma = 1; pv.ember = 1.6; sound.play('boom', { x: c.x, z: c.z, gain: 1, wet: 0.6 }); sound.duck(0.4, 0.5); this.buzz(90); break;
      }
      case 'rites': {
        this.court.ruin.scar(0, k.hx, k.hz, 3.2, 0, 0, 1); this.court.ruin.slabs(k.hx, k.hz, 2.2, 12);
        this.ritesK = 1; cam.trauma = 1; const a = m.yaw, c = V(k.hx, 1.7, k.hz);
        for (let i = 0; i < 10; i++) { const b = i / 10 * 6.283, q = V(k.hx + Math.cos(b) * 1.5, 0, k.hz + Math.sin(b) * 1.5); fx.bursts.add('pillar', q, 3.4, 0.9, t + i * 0.012); fx.sparks.emit(V(q.x, 1, q.z), V(Math.cos(b) * 0.5, 0.9, Math.sin(b) * 0.5), 12, 6, 1.6, -2, t); }
        for (let i = 0; i < 6; i++) fx.bursts.add('slash', V(c.x, 1.2 + (i % 3) * 0.4, c.z), 9, 0.4, t + i * 0.022, [0.35, -0.6, 1.25, -0.15, 0.85, -1.0][i], 2, 0.8, 0.25, 0.75);
        fx.bursts.add('flare', c, 9, 0.4, t); fx.bursts.add('ground', V(k.hx, 0.06, k.hz), 12, 0.8, t); for (let i = 0; i < 4; i++) fx.bursts.add('fire', V(c.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, c.z + (Math.random() - 0.5) * 3), 3.2, 0.9, t + i * 0.05, i); fx.gore.emit(c, V(0, 0.4, 0), 120, 7, 2, 1, t); void a;
        pv.boomAt.copy(c); pv.boomK = 1.2; sound.play('ritesCut', { gain: 1.05, wet: 0.7 }); sound.play('boom', { gain: 1, delay: 0.06, wet: 0.6 }); this.say('kPain', 'bPain'); this.buzz(200); break;
      }
      case 'heal': sound.play('heal', { ...me, gain: 0.9 }); break;
      case 'blastSet': if (e.kind === 'brand') { fx.bursts.add('ground', V(e.x, 0.06, e.z), e.r * 2.2, e.delay + 0.2, t, 0, 1.4, 0.45, 0.1); fx.bursts.add('ring', V(e.x, 0.08, e.z), e.r * 2, e.delay, t, 0, 1.2, 0.4, 0.1); sound.play('rise1', { x: e.x, z: e.z, gain: 0.5, rate: 1.3 }); } else if (e.kind === 'fall') { sound.play('whooshB', { x: e.x, z: e.z, gain: 0.35, delay: Math.max(0, e.delay - 0.35), rate: 0.8 }); } break;
      case 'blast': {
        const q = V(e.x, 0.06, e.z), near = Math.max(0, 1 - Math.hypot(e.x - m.x, e.z - m.z) / 16), R = this.court.ruin;
        if (e.kind === 'ring' || e.kind === 'wheel') { const n = e.kind === 'ring' ? 10 : 8; for (let i = 0; i < n; i++) { const a = i / n * 6.283; fx.bursts.add('pillar', V(e.x + Math.cos(a) * e.r * 0.8, 0, e.z + Math.sin(a) * e.r * 0.8), 1.3 + Math.random() * 0.6, 0.55, t + i * 0.012); } fx.bursts.add('ground', q, e.r * 1.9, 0.45, t); sound.play('fire', { x: e.x, z: e.z, gain: 0.7 }); cam.trauma = Math.max(cam.trauma, 0.3 * near); }
        else if (e.kind === 'brand') { fx.bursts.add('ground', q, e.r * 3, 0.9, t); fx.bursts.add('flare', V(e.x, 1.2, e.z), 6, 0.4, t); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, d = e.r * (0.3 + 0.6 * (i & 1)); fx.bursts.add('pillar', V(e.x + Math.cos(a) * d, 0, e.z + Math.sin(a) * d), 2.6 + Math.random(), 0.9, t + i * 0.015); } fx.sparks.emit(V(e.x, 0.4, e.z), V(0, 1, 0), 140, 7, 2.2, 0.9, t); fx.puffs.emit(q, 14, 3, 1.4, t); sound.play('erupt', { x: e.x, z: e.z, gain: 1 }); cam.trauma = Math.max(cam.trauma, 0.8 * near); R.scar(0, e.x, e.z, e.r * 0.8, 0, 0, 1); R.slabs(e.x, e.z, e.r * 0.6, 7); this.buzz(70); }
        else if (e.kind === 'fall') { for (let k = 0; k < 3; k++) fx.bursts.add('slash', V(e.x, 2.5 + k * 2.2, e.z), 5, 0.16, t - 0.12 + k * 0.03 - 0.03 * k, Math.PI / 2 + 0.12, 1.7, 0.6, 0.18); fx.bursts.add('fire', V(e.x, 0.9, e.z), 2.2, 0.45, t, 2); fx.bursts.add('pillar', V(e.x, 0, e.z), 3.4, 0.7, t); fx.bursts.add('ring', V(e.x, 0.2, e.z), 3.6, 0.35, t, 0, 1.5, 0.6, 0.15); fx.bursts.add('ground', q, 3.2, 0.4, t); fx.sparks.emit(V(e.x, 0.3, e.z), V(0, 1, 0), 36, 5, 1.6, 0.8, t); fx.puffs.emit(q, 5, 1.6, 0.9, t); sound.play('boom', { x: e.x, z: e.z, gain: 0.45, rate: 1.25 }); cam.trauma = Math.max(cam.trauma, 0.35 * near); R.scar(2, e.x, e.z, 1.1, 0, 0, 0.8); }
        else if (e.kind === 'step') { fx.bursts.add('fire', V(e.x, 0.9, e.z), 2, 0.5, t, 1); fx.sparks.emit(V(e.x, 1, e.z), V(0, 0.4, 0), 50, 3, 2.2, -1.4, t); fx.puffs.emit(q, 8, 1.6, 1, t); sound.play('vanish', { x: e.x, z: e.z, gain: 0.9 }); }
        if (e.hit) this.buzz(30); break;
      }
      case 'flame': this.hud.say(KING_TITLES.flame, 2.4, 'flame'); this.slowK = 1; sound.play('heart', { gain: 1.1 }); sound.play('erupt', { gain: 0.9, delay: 1.4 }); sound.duck(0.2, 1.6); break;
      case 'ready': if (e.a === 'ultimate') { sound.play('aura3', { gain: 0.8 }); this.hud.callout(KING_CALLS.lastRites); } else sound.play('ready', { gain: e.a === 'skill2' ? 0.8 : 0.9, rate: e.a === 'skill2' ? 1.33 : 1 }); pv.ember = 1.5; break;
      case 'deny': sound.play('deny'); this.hud.deny(e.a); break;
      case 'aura': pv.auraStep = e.tier; if (sound.score) sound.score.aura = e.tier; if (e.up && e.tier <= this.auraSeen) { /* reached before: it simply catches again */ pv.ember = 1.6; sound.play('flare', { ...me, gain: 0.6 }); fx.sparks.emit(V(m.x, 0.6, m.z), V(0, 0.8, 0), 16 + e.tier * 10, 2.4, 2, -1.6, t); } else if (e.up) { this.auraSeen = e.tier; sound.play('aura' + (e.tier - 1), { gain: 0.8, wet: 0.5 }); this.hud.callout(AURA[e.tier]); pv.ember = 1.8; pv.boomAt.set(m.x, 1.4, m.z); pv.boomK = 0.35; for (let i = 0; i < 3 + e.tier * 2; i++) { const a = i / (3 + e.tier * 2) * 6.283; fx.bursts.add('pillar', V(m.x + Math.cos(a) * 0.8, 0, m.z + Math.sin(a) * 0.8), 1.2 + e.tier * 0.35, 0.6, t); } fx.sparks.emit(V(m.x, 1, m.z), V(0, 0.6, 0), 30 + e.tier * 20, 3, 2.2, -1.8, t); } else this.hud.callout(''); break;
      case 'style': if (this.moods[e.style]) sound.score?.set(this.moods[e.style]); if (e.style === 'crawler') { this.say('kScreech', 'bRoar', 0.9); cam.trauma = 0.4; } if (e.style === 'hanged') { sound.play('creak', { ...pos, gain: 1 }); sound.play('creak', { ...pos, gain: 0.8, delay: 0.5 }); this.say('kScreech', 'bRoar', 0.6); } if (e.style === 'eclipse') { this.say('kScreech', 'bRoar', 1); cam.trauma = 0.7; fx.bursts.add('ground', V(k.x, 0.06, k.z), 14, 0.9, t); this.bring(3); this.court.breach(0, -20, 16, 16); sound.play('quake', { gain: 0.62 }); sound.duck(0.4, 1.2); this.court.ruin.scar(0, k.x, k.z, 3, 0, 0, 1); this.court.ruin.slabs(k.x, k.z, 2.1, 9); } break;
      case 'snap': this.court.tear(k.x, k.z, 5, 7); sound.play('snap', { ...pos, gain: 1 }); cam.trauma = 0.8; cam.punch = -4; fx.puffs.emit(V(k.x, 0, k.z), 16, 3, 1.6, t); this.say('kPain', 'bPain'); break;
      case 'hero': this.heroT = 0.75; this.slowK = 1; sound.duck(0.15, 1); break;
      case 'half': this.onHalf(); break;
      case 'round2': this.hud.refill(); sound.play('barFill', { gain: 0.9, wet: 0.4 }); this.hud.callout(''); break;
      case 'finish': sound.score?.set('finish'); this.say('kBreath', 'kBreath', 1.3); break;
      case 'won': { sound.score?.set('won'); this.say('kDeath', 'bDeath'); sound.play('finalCut', { gain: 1.05, wet: 0.7 }); sound.play('boom', { ...pos, gain: 0.7, delay: 0.5 }); cam.trauma = 1; this.slowK = 1; this.ritesK = 1; this.inkT = 1.1; const q = V(k.hx, 1.5, k.hz); fx.bursts.add('slash', q, 16, 1.6, t, 0.06, 1.8, 1.6, 1.4, 1); fx.bursts.add('slash', q, 8, 0.3, t, 0.06, 2, 0.8, 0.3, 0.5); fx.sparks.emit(q, V(0, 0.3, 0), 140, 8, 1.6, 0.9, t); this.onWon(); break; }
      case 'dead': this.hud.say(KING_TITLES.quenched, 2.6, 'dead'); sound.play('die', { gain: 1 }); sound.score?.set('dead'); break;
      case 'reset': if (f.round === 1 && f.hits === 0) this.auraSeen = 0; pv.reset(); this.p.set(0, 0, 0); this.painT = 0; this.views.forEach(v => { v.settle(); v.wounds.w.value.forEach(w => { w.w = 0; }); }); this.views[0].show(k.form === 1); this.views[1].show(k.form === 2); this.cue.stop(); this.fadeK = 1; cam.yaw = 0.12; pv.auraStep = 0; sound.score?.set(f.round === 2 ? 'r2' : 'spar'); this.hud.callout(''); break;
    }
    if (dt > 0) {
      for (const e of m.events) {
        if (e === 'swing') { const pw = m.clip?.power ?? 1; sound.play(pw > 1.7 ? 'whooshH' : 'whoosh', { ...me, gain: 0.7 + 0.1 * pw, rate: 1 / Math.sqrt(Math.max(0.8, pw * 0.75)) }); sound.play('cloth', { ...me, gain: 0.7 }); }
        else if (e.startsWith('clip:dodge')) { sound.play('dodge', { ...me, gain: 0.9 }); sound.play('cloth', { ...me, gain: 1 }); }
        else if (e === 'fx:erupt' || e === 'fx:wave') { sound.play('erupt', { ...me, gain: 1 }); if (e === 'fx:erupt') { this.court.ruin.scar(0, m.x, m.z, 1.9, 0, 0, 1); this.court.ruin.slabs(m.x, m.z, 1.4, 6); } else this.court.ruin.scar(1, m.x, m.z, 0.3, m.yaw, 7, 1); }
        else if (e === 'fx:sunder') this.court.ruin.scar(1, m.x + Math.sin(m.yaw), m.z + Math.cos(m.yaw), 0.16, m.yaw, 9, 0.8);
        else if (e === 'fx:slam' || e === 'fx:crack') sound.play('slam', { ...me, gain: 0.75, rate: 1.15 });
        else if (e === 'fx:flare' || e === 'fx:crescent') sound.play('flare', { ...me, gain: 0.8 });
        else if (e === 'fx:palm' || e === 'fx:kick') sound.play('fire', { ...me, gain: 0.75, rate: 1.25 });
        else if (e === 'fx:scrape' || e === 'fx:flick') sound.play('scrape', { ...me, gain: 0.55 });
        else if (e === 'fx:reform') sound.play('reform', { ...me, gain: 0.9 });
        else if (e === 'fx:rekindle') { sound.play('boom', { ...me, gain: 0.9 }); sound.play('fire', { ...me, gain: 1 }); }
        else if (e === 'clip:jump') { sound.play('jump', { ...me, gain: 0.9 }); sound.play('cloth', { ...me, gain: 1 }); }
        else if (e === 'land') sound.play(m.clip?.name === m.weapon.air.hit ? 'thud' : 'land', { ...me, gain: m.clip?.name === m.weapon.air.hit ? 0.5 : 0.8 });
        else if (e === 'fx:dive') sound.play('whooshH', { ...me, gain: 1, rate: 1.25 });
        else if (e === 'fx:plunge') { this.court.ruin.scar(0, m.x + Math.sin(m.yaw) * 0.5, m.z + Math.cos(m.yaw) * 0.5, 1.5, 0, 0, 0.9); this.court.ruin.slabs(m.x + Math.sin(m.yaw) * 0.5, m.z + Math.cos(m.yaw) * 0.5, 1.05, 5); sound.play('erupt', { ...me, gain: 0.8, rate: 1.2 }); sound.play('slam', { ...me, gain: 0.5, rate: 1.3 }); cam.trauma = Math.max(cam.trauma, 0.6); cam.punch = Math.min(cam.punch, -3); }
        else if (e === 'fx:wipe') sound.play('wipe', { ...me, gain: 0.9, wet: 0.5 });
        else if (e === 'fx:wheel') sound.play('whooshH', { ...me, gain: 0.9, rate: 1.1 });
        else if (e === 'fx:pillar') sound.play('fire', { ...me, gain: 0.9, wet: 0.5 });
        else if (e === 'fx:vanish' && m.clip?.name === 'rites') { sound.play('vanish', { gain: 1, wet: 0.5 }); this.cutN = 0; sound.duck(0.0, 2.2); }
        else if (e === 'fx:rcut') {
          // a straight white line through it each time, all still hanging in the air when he stops
          const i = this.cutN++, far = f.m.targetDist > 14, q = far ? V(m.x + Math.sin(m.yaw) * 2, 1.4, m.z + Math.cos(m.yaw) * 2) : V(k.hx, 1.3 + (i % 3) * 0.35, k.hz), an = [0.35, -0.6, 1.25, -0.15, 0.85, -1.0][i % 6]; fx.bursts.add('slash', q, 10, 1.7, t, an, 1.6, 1.6, 1.6, 1); fx.bursts.add('slash', q, 5, 0.16, t, an, 1.6, 1.6, 1.6, 0.6); pv.blade.clear(); this.hud.callout(''); if (!far) { kv.flinch(Math.atan2(k.hx - m.x, k.hz - m.z), 1.4); fx.gore.emit(q, V(Math.cos(an), 0.3, Math.sin(an)), 24, 5, 1.2, 0.8, t); } sound.play('riteCut', { ...pos, gain: 0.85, rate: 1 + i * 0.05, wet: 0.5 }); cam.trauma = Math.max(cam.trauma, 0.45); this.buzz(20);
        }
        else if (e === 'fx:rlast') { pv.blade.clear(); sound.play('sheathe', { gain: 0.9, wet: 0.8 }); }
        else if (e === 'fx:ritesEnd') { sound.play('whooshH', { ...me, gain: 0.6 }); cam.snap(m, { x: k.hx, z: k.hz }); }
        else if (e === 'fx:riposte') sound.play('parry', { ...me, gain: 0.6, rate: 1.1 });
        else if (e === 'fx:impale') { sound.play('fleshH', { ...pos, gain: 1.1 }); sound.play('riteCut', { ...pos, gain: 0.5, rate: 0.7 }); const p = pv.tip.clone(); fx.gore.emit(p, V(Math.sin(m.yaw), 0.3, Math.cos(m.yaw)), 70, 5, 1.6, 0.9, t); fx.bursts.add('flare', p, 3.4, 0.3, t); cam.trauma = 0.7; kv.flinch(m.yaw, 3); this.buzz(80); }
        else if (e === 'fx:twist') { sound.play('fleshH', { ...pos, gain: 1, rate: 0.75 }); sound.play('groan', { ...pos, gain: 0.8 }); sound.play('fire', { ...pos, gain: 0.8 }); cam.trauma = 0.6; kv.flinch(m.yaw + 1.5, 2.4); for (let i = 0; i < 3; i++) fx.bursts.add('fire', V(k.hx, 1.2 + i * 0.4, k.hz), 2.2, 0.6, t + i * 0.06, i); this.say('bPain', 'bPain', 1); }
        else if (e === 'fx:finale') { sound.play('whooshB', { gain: 1, rate: 1.3 }); }
        else if (e === 'fx:blur') sound.play('whoosh', { ...me, gain: 0.8, rate: 1.5 });
        else if (e === 'fx:reckon') { sound.play('sheathe', { ...me, gain: 0.9, wet: 0.5 }); for (let i = 0; i < 7; i++) fx.bursts.add('slash', V(k.hx + (Math.random() - 0.5) * 0.9, 0.8 + Math.random() * 1.8, k.hz + (Math.random() - 0.5) * 0.9), 3.4, 0.3, t + i * 0.035, Math.random() * 3.1, 1.7, 0.8, 0.3); }
        else if (e === 'fx:wrench') { sound.play('tear', { ...pos, gain: 0.5, rate: 1.6 }); sound.play('fire', { ...pos, gain: 1 }); if (m.clip?.name === 'finale') { const q = V(k.hx, 1.6, k.hz); fx.bursts.add('fire', q, 3.4, 0.7, t); fx.gore.emit(q, V(0, 1, 0), 80, 6, 1.4, 1, t); fx.sparks.emit(q, V(0, 1, 0), 60, 6, 1.4, 0.8, t); cam.trauma = 0.8; kv.flinch(m.yaw, 3); } }
        else if (e === 'fx:ritesStart') { sound.play('riser', { gain: 0.95, wet: 0.5 }); sound.duck(0.12, 2.4); }
      }
      // feet
      for (let i = 0; i < Math.min(2, pv.steps); i++) sound.play('stepP', { ...me, gain: m.speed > 4 ? 1 : 0.6 }); pv.steps = 0;
      for (let i = 0; i < Math.min(2, kv.steps); i++) sound.play(k.crawling || k.mode === 'crawl' ? 'stepC' : 'stepK', { x: k.x, z: k.z, gain: 0.9, rate: k.form === 2 ? 1.2 : 1 }); kv.steps = 0;
      for (const e of kv.fxFired) { if (e === 'slam' && k.form === 1 && kv.cleaver?.visible && !this.extra) { const q = kv.mark('cleaver', V()); this.court.ruin.scar(0, q.x, q.z, 1.2, 0, 0, 0.15); this.court.ruin.slabs(q.x, q.z, 0.8, 4); } if (e === 'slam' || e === 'slam0') sound.play('slam', { x: k.x, z: k.z, gain: 1 }); else if (e === 'thud') sound.play('thud', { x: k.x, z: k.z, gain: 1 }); else if (e === 'creak') sound.play('creak', { ...pos, gain: 0.8 }); else if (e === 'scrape') sound.play('scrape', { x: k.x, z: k.z, gain: 0.9, rate: 0.75 }); else if (e === 'launch') { sound.play('whooshB', { x: k.x, z: k.z, gain: 0.9 }); sound.play('thud', { x: k.x, z: k.z, gain: 0.5 }); } else if (e === 'roar') { if (f.phase !== 'scene') sound.play('bRoar', { ...pos, bus: 'voice', gain: 0.85 }); } else sound.play('whooshB', { x: k.x, z: k.z, gain: 1 }); }
      if (this.cue.active && (!k.committed || f.ev.some(e => e.k === 'hurt' || e.k === 'block' || e.k === 'parry'))) this.cue.stop();
      if (this.cue.active && this.cue.kind === 'red') { kv.flash.value.set(1, 0.03, 0.02, 0.75 + 0.25 * Math.sin(t * 20)); const c = kv.mark(this.cue.mark, this.p); kv.flashAt.value.set(c.x, c.y, c.z, 1.15); }
      if ((this.breathT -= dt) < 0) { this.breathT = 3.5 + Math.random() * 4; if (!k.attacking && f.phase !== 'scene' && f.phase !== 'won') sound.play('kBreath', { ...pos, bus: 'voice', gain: k.form === 2 ? 0.8 : 1, rate: k.form === 2 ? 0.8 : 1 }); }
      if (m.dead && pv.dis.value > 0.1 && (this.cloak -= dt) < 0) { this.cloak = 0.5; sound.play('flare', { ...me, gain: 0.4 }); }
    }
    this.cue.update(dt > 0 ? (k.committed && k.mt < (k.strikes[0]?.t[0] ?? 0) ? dt : real) : 0, kv.mark(this.cue.mark, this.at)); this.marks.update(f.hazards); this.crescents.update(f.shots);
    if (f.phase === 'won') { const u = Math.max(0, Math.min(1, (k.mt - 2) / 2.6)); kv.dissolve.value = u; if (u > 0.02 && u < 1 && Math.random() < 0.7) fx.sparks.emit(V(k.x + (Math.random() - 0.5), 0.4 + Math.random() * 1.8, k.z + (Math.random() - 0.5)), V(0.1, 0.8, 0), 4, 1, 1.4, -2.4, t); }
    this.stoneT -= real; cam.trauma = Math.max(cam.trauma, pv.shake, this.court.ruin.shake * 0.7, kv.shake * Math.max(0, 1 - Math.hypot(k.x - m.x, k.z - m.z) / 16)); pv.fireK = f.fire / D.fireMax; this.heroT = Math.max(0, this.heroT - real);
    // --- the world gathers into the blade
    const rites = m.clip?.name === 'rites' ? m.t : -1; if (rites > 0.4 && rites < 1.9) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, r = 2 + Math.random() * 5, p = V(m.x + Math.cos(a) * r, 0.3 + Math.random() * 2.5, m.z + Math.sin(a) * r), to = pv.tip.clone().sub(p); fx.sparks.emit(p, to.multiplyScalar(0.32), 2, 1.6, 0.2, -0.9, t); }
    // --- screen and mix
    this.hurtK *= Math.exp(-real * 2.6); this.slowK *= Math.exp(-real * 2.2); this.ritesK *= Math.exp(-real * 1.6); const low = f.hp > 0 && f.hp < D.hp * 0.3 ? 0.28 + 0.12 * Math.sin(t * 4.2) : 0, quiet = rites > 0.3 && rites < 3.6 ? Math.min(1, (rites - 0.3) * 1.4) : 0; this.inkT = Math.max(0, this.inkT - real); this.mono = Math.max(0, this.mono);
    this.post.pulse.value.w = Math.max(this.hurtK * 0.42, low * 0.8, m.dead ? 0.3 : 0); this.snapT -= real; this.snapK = this.snapK > 0.02 ? this.snapK * Math.exp(-real * (this.snapK > 0.82 ? 2.6 : 16)) : 0; this.desatB += (Math.max(m.dead ? 0.8 : 0, this.slowK * 0.55, quiet * 0.97, this.mono, Math.min(1, this.inkT * 3) * 0.97) - this.desatB) * Math.min(1, real * 10); this.post.desat.value = Math.max(this.desatB, this.snapK * 0.97); this.post.kick.value = Math.max(this.ritesK * 1.4, cam.trauma * cam.trauma * 0.6) * settings.shake; this.inkB += (Math.max(rites > 1.9 && rites < 3.6 ? 1 : 0, this.inkT > 0 ? 1 : 0, this.inkWant) - this.inkB) * Math.min(1, real * 12); this.post.ink.value = Math.max(this.inkB, this.snapK);
    const out = f.deadT > 2.3 ? Math.min(1, (f.deadT - 2.3) / 0.6) : 0; this.fadeK = Math.max(out, this.fadeK - real * 1.6); this.post.fade.value = Math.max(this.fadeK, this.dark);
    sound.slow(Math.max(this.slowK > 0.35 ? this.slowK * 0.75 : 0, quiet * 0.8, low * 0.5)); if (low > 0 && (this.heartT -= real) < 0) { this.heartT = 0.95; sound.play('heart', { gain: 0.8 }); }
    if (this.ambient) this.ambient(f); else { sound.bed('wind', f.round === 2 ? 0.3 : 0.5); sound.bed('fireBed', f.round === 2 ? 0.75 : 0.35); sound.bed('storm', f.round === 2 && f.phase !== 'won' ? (f.brain.style === 'eclipse' ? 0.65 : 0.25) : 0); }
    sound.score?.update(real);
  }
}
