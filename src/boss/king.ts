// The boss's simulation in both forms: where it is, what it is doing, what it threatens. Runs headless.
import { moveAt } from '../anim/pose.ts';
import { D } from '../combat/difficulty.ts';
import { ATTACKS, LEAPS, type Strike } from './moves2.ts';
import { KING_CLIPS as K } from './clips.ts';
import type { Fight } from '../combat/fight.ts';

export type KingMode = 'idle' | 'stalk' | 'strafe' | 'crawl' | 'hang' | 'slam' | 'sweep' | 'drag' | 'leap' | 'grab' | 'pounce' | 'rake' | 'hangSwing' | 'hangSwipe' | 'crash' | 'reel' | 'kneel' | 'fall'
  | 'flurry' | 'cross' | 'skewer' | 'rupture' | 'rain' | 'wheel' | 'hop' | 'reel2' | 'rise2' | 'die2' | 'noose' | 'rope';
export const KING_MODES: KingMode[] = ['idle', 'stalk', 'strafe', 'slam', 'sweep', 'drag', 'leap', 'grab', 'reel', 'kneel', 'fall', 'crawl', 'pounce', 'rake', 'hang', 'hangSwing', 'hangSwipe', 'crash'];
export const BENEATH_MODES: KingMode[] = ['idle', 'strafe', 'flurry', 'cross', 'skewer', 'rupture', 'rain', 'wheel', 'hop', 'reel2', 'kneel', 'rise2', 'die2'];
export const isAttack = (m: string) => m in ATTACKS;
const sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
/** Pivot height of the hang, and how far below it the head swings. */
export const ROPE = 10.6, HEAD_DROP = 8.9;
/** The staged moments (module A). Times are the moment's own clock, `stage`, in seconds from the seizing or the press. */
export const NOOSE = { climb: [0.5, 2.4] as [number, number], release: 3.6, land: 4.6, end: 5.2 }, RIP = { cut: 1.0, len: 2.7 }, RIDE = { hit: 0.9, len: 2.8 };
/** Grabs always cost this much; a reward takes this share of the boss's life; a reward stays on offer this long. */
export const GRAB_DMG = { noose: 44 }, REWARD_SHARE = 0.09, OFFER = 1.8;

export class King {
  x = 0; z = -4; y = 0; private vy = 0; yaw = 0; vx = 0; vz = 0; speed = 0; mode: KingMode = 'idle'; mt = 0; prev = 0; burst = 0; r = 0.75; form: 1 | 2 = 1;
  /** Playback speed of the wind-up: the first showing of an attack is slower. */ rate = 1; /** Overall pace, from the brain. */ pace = 1;
  /** Bumped on every mode change, so each attack instance is distinct. */ serial = 0;
  cues: Strike[] = []; live: Strike[] = []; ended: KingMode | null = null;
  /** Has the cleaver: the Executioner does, the Crawler and the Hanged do not. */ armed = true; crawling = false;
  /** Hang: seconds since the roots took it, pendulum angle and direction. */ ht = 0; th = 0; dir = 0;
  /** Where a leap is going. */ mark = { x: 0, z: 0 }; private from = { x: 0, z: 0 }; private moved = 0; private side = 1; private sideT = 0;
  set(mode: KingMode, rate = 1) { const was = this.hanging; this.mode = mode; this.mt = this.prev = 0; this.moved = 0; this.rate = rate; this.serial++; this.y = 0; this.held = null; if (this.hanging && !was) { this.ht = 0; this.th = 0; this.offered = false; } if (was && !this.hanging) { this.x = this.hx; this.z = this.hz; this.th = 0; } }
  /** Staged moments: the grab that holds the hero, the moment's own clock, the reward in progress, and the reward on offer. */
  held: 'noose' | null = null; stage = 0; rite: 'rope' | 'ride' | null = null; reward: 'rope' | 'ride' | null = null; rewardLeft = 0; private offered = false; private sp = 0;
  get hanging() { return this.mode === 'hang' || this.mode === 'hangSwing' || this.mode === 'hangSwipe'; }
  /** The part you can reach: the swinging head when hanging, otherwise the body. */
  get hx() { return this.hanging ? this.x + Math.sin(this.dir) * Math.sin(this.th) * HEAD_DROP : this.x; }
  get hz() { return this.hanging ? this.z + Math.cos(this.dir) * Math.sin(this.th) * HEAD_DROP : this.z; }
  get hr() { return this.hanging ? 0.35 : this.r; }
  /** Out of sword reach mid-leap, or still being hauled up. */
  get airborne() { return this.y > 1.2 || (this.mode === 'hang' && this.ht < 0.9); }
  get strikes() { return ATTACKS[this.mode] ?? []; }
  /** True from the start of an attack until its last blow has landed: it can't be interrupted. */
  get committed() { const s = this.strikes; return s.length > 0 && this.mt < s[s.length - 1].t[1]; }
  get helpless() { return this.mode === 'kneel' || this.mode === 'crash' || this.mode === 'reel' || this.mode === 'reel2'; }
  get attacking() { return isAttack(this.mode); } get vulnerable() { return true; } get dmgMul() { return 1; } get hp(): [number, number] { return [D.boss.hp1, D.boss.hp2]; }
  get reelMode() { return this.form === 2 ? 'reel2' : 'reel'; } get kneelMode() { return 'kneel'; } get downMode() { return this.hanging ? 'crash' : 'fall'; } get dieMode() { return 'die2'; } get reeling() { return this.mode === 'reel' || this.mode === 'reel2'; } get holdKneel() { return 1.6; } get holdDie() { return 5.3; }
  /** Its attack is broken: whatever it was doing stops here. From a leap, it falls. */
  break() { const y = this.y; this.set(this.form === 2 ? 'reel2' : 'reel'); this.y = y; this.vy = 0; }
  turn(step: number, to: number) { const d = wrap(to - this.yaw); this.yaw += Math.max(-step, Math.min(step, d)); return d; }

  step(dt: number, px: number, pz: number) {
    const s = this.strikes, m = this.mode, d = dt * this.pace * (s.length && this.mt < s[0].t[0] ? this.rate : 1);
    this.prev = this.mt; this.mt += d; this.ended = null; this.cues = s.filter(q => q.cue > this.prev && q.cue <= this.mt); this.live = s.filter(q => this.mt >= q.t[0] && this.prev <= q.t[1]);
    const dx = px - this.x, dz = pz - this.z, dist = Math.hypot(dx, dz), face = Math.atan2(dx, dz); this.speed = 0; this.vx = this.vz = 0; if (this.y > 0 && !LEAPS[m]) { this.vy -= 26 * dt; this.y = Math.max(0, this.y + this.vy * dt); }
    if (m === 'stalk') {
      // broken time: a held beat, then three quick steps
      const k = (this.mt * 0.8) % 1; this.burst = k < 0.22 ? 0 : sst(0.22, 0.3, k) * sst(1, 0.92, k); this.speed = this.burst * (dist > D.boss.near - 0.2 ? 5.2 : 0); this.turn((0.8 + this.burst * 2.8) * dt, face);
      this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed;
    } else if (m === 'strafe') {
      if ((this.sideT -= dt) < 0) { this.sideT = 1.1 + (this.serial % 3) * 0.4; this.side = -this.side; }
      const sp = this.form === 2 ? 2.9 : 1.7, rad = Math.max(-2, Math.min(2.4, (dist - (D.boss.near + 0.5)) * 1.6)); this.speed = sp; this.burst = 0.6;
      this.vx = Math.cos(face) * sp * this.side + Math.sin(face) * rad; this.vz = -Math.sin(face) * sp * this.side + Math.cos(face) * rad; this.turn(3.2 * dt, face);
    } else if (m === 'crawl') {
      const k = (this.mt * 0.8) % 1, b = 0.75 + 1.1 * sst(0.2, 0.35, k) * sst(1, 0.8, k), R = 5.2, ang = Math.atan2(this.x - px, this.z - pz); this.speed = 3.6 * b; const radial = (R - dist) * 1.1;
      this.vx = Math.cos(ang) * this.speed + Math.sin(ang) * radial; this.vz = -Math.sin(ang) * this.speed + Math.cos(ang) * radial; this.turn(4.6 * dt, face - 0.62);
    } else if (m === 'idle') this.turn((this.form === 2 ? 2.0 : 1.1) * dt, face);
    else if (this.hanging) this.hang(dt, face);
    else if (m in K) {
      const c = K[m], g = moveAt(c, this.mt), want = g - this.moved, st = want > 0 ? Math.min(want, Math.max(0, dist - 1.7)) : want; this.moved = g; this.x += Math.sin(this.yaw) * st; this.z += Math.cos(this.yaw) * st;
      const L = LEAPS[m];
      if (L) {
        // locks on at the cue, flies to the mark
        if (this.prev < s[0].cue && this.mt >= s[0].cue) { const go = Math.min(L.max, dist) + (L.past ?? 0); this.mark = { x: this.x + dx / (dist || 1) * go, z: this.z + dz / (dist || 1) * go }; const R = Math.hypot(this.mark.x, this.mark.z); if (R > 18) { this.mark.x *= 18 / R; this.mark.z *= 18 / R; } }
        if (this.mt < L.t0) { this.from = { x: this.x, z: this.z }; this.turn(5 * dt, this.mt > s[0].cue ? Math.atan2(this.mark.x - this.x, this.mark.z - this.z) : face); }
        else { const u = Math.min(1, (this.mt - L.t0) / (L.t1 - L.t0)), e = L.past ? u : u * u * (3 - 2 * u) * 0.6 + u * 0.4; this.x = this.from.x + (this.mark.x - this.from.x) * e; this.z = this.from.z + (this.mark.z - this.from.z) * e; this.y = u < 1 ? Math.sin(Math.PI * Math.pow(u, 0.8)) * L.h : 0; if (u >= 1 && L.past && this.mt < L.t1 + 0.5) this.turn(8 * dt, face); }
      }
      // tracks you through the wind-up and between blows, then commits: the last stretch can always be side-stepped
      else { const next = s.find(q => q.t[0] > this.mt); if (next && this.mt < next.t[0] - 0.2) this.turn((this.form === 2 ? 3.4 : 2.4) * dt, face); }
      if (this.mt >= c.dur) { this.ended = m; this.set(this.crawling ? 'crawl' : 'idle'); }
    }
    this.x += this.vx * dt; this.z += this.vz * dt; const R = Math.hypot(this.x, this.z); if (R > 18.5) { this.x *= 18.5 / R; this.z *= 18.5 / R; }
  }
  private hang(dt: number, face: number) {
    this.ht += dt; const m = this.mode, idle = Math.sin(this.ht * 1.35) * 0.1 * sst(1.2, 3, this.ht); this.turn(0.4 * dt, face);
    if (m === 'hangSwing') {
      const t = this.mt; if (t < 0.3) this.dir = face;
      // hauled back, held, let go: one committed pass along the line, a spent return
      const want = t < 0.95 ? -0.34 * sst(0, 0.95, t) : t < 1.1 ? -0.34 : t < 1.85 ? -0.34 + 0.86 * sst(1.1, 1.85, t) : t < 2.9 ? 0.52 - 0.7 * sst(1.85, 2.9, t) : -0.18 * (1 - sst(2.9, 3.6, t));
      this.th += (want - this.th) * Math.min(1, dt * 24);
    } else this.th += (idle - this.th) * Math.min(1, dt * 2.5);
    if (m !== 'hang' && this.mt >= K[m].dur) { this.ended = m; this.set('hang'); }
  }
  /** The grab connected: the boss takes the hero into a staged moment. It always plays out and always costs. */
  seize(kind: string, f: Fight) {
    this.stage = this.sp = 0; f.brain.seen.add('grab');
    this.set('noose'); this.dir = this.yaw;
    this.held = 'noose';
  }
  /** A perfect dodge of the sideways lunge leaves him behind you, exposed: a chance to ride him. */
  dodged(_f: Fight) { if (this.mode === 'cross' && !this.held && !this.rite) { this.reward = 'ride'; this.rewardLeft = OFFER; } }
  /** The hero took the offered reward: the scene plays, and the blow lands at its own moment. */
  takeReward(): 'rope' | 'ride' | null {
    const r = this.reward; if (!r) return null; this.reward = null; this.rewardLeft = 0; this.stage = this.sp = 0;
    if (r === 'rope') this.set('rope'); else this.set('kneel');
    this.rite = r; return r;
  }
  /** A fresh start: no moment is playing and no reward is on offer. */
  clearMoments() { this.held = null; this.rite = null; this.reward = null; this.rewardLeft = 0; this.stage = this.sp = 0; }
  /** Which staged moment is playing, if any (the page stages the camera and the hero for it). */
  get staging(): 'noose' | 'rope' | 'ride' | null { return this.held ?? this.rite; }
  /** Runs the moments' timings and what they do to the hero and the boss. Called once a step, after the boss moves. */
  tick(f: Fight, dt: number) {
    const m = f.m, cross = (a: number) => this.sp < a && this.stage >= a;
    if (this.reward && (this.rewardLeft -= dt) <= 0) { this.reward = null; this.rewardLeft = 0; }
    if (this.hanging && !this.offered && !this.held && !this.rite && this.ht > 0.8 && Math.hypot(m.x - this.x, m.z - this.z) < 5.5) { this.offered = true; this.reward = 'rope'; this.rewardLeft = OFFER; }
    if (this.held || this.rite) this.stage += dt * this.pace;
    if (this.held === 'noose') {
      f.invuln = Math.max(f.invuln, 0.15);
      if (this.stage < NOOSE.release) { m.x = this.x + Math.sin(this.yaw) * 1.5; m.z = this.z + Math.cos(this.yaw) * 1.5; }
      if (cross(NOOSE.land)) { f.invuln = 0; f.strikePlayer(GRAB_DMG.noose, true, Math.atan2(this.x - m.x, this.z - m.z), 'grab'); }
      if (this.stage >= NOOSE.end) { this.set('hang'); this.ht = 1.2; }
    }
    const pool = f.round === 2 ? D.boss.hp2 : D.boss.hp1;
    if (this.rite === 'rope') { if (cross(RIP.cut)) { this.set('crash'); f.damage(Math.round(pool * REWARD_SHARE), 3.4, true, 0.2, 'blade', 'heavy'); } if (this.stage >= RIP.len) this.rite = null; }
    else if (this.rite === 'ride') { if (cross(RIDE.hit)) f.damage(Math.round(pool * REWARD_SHARE), 3.4, true, 0.2, 'blade', 'heavy'); if (this.stage >= RIDE.len) this.rite = null; }
    this.sp = this.stage;
  }
  /** Does this strike cover the point (with the player's own width)? */
  covers(q: Strike, px: number, pz: number, r = 0.3) {
    if (q.head) return Math.hypot(px - this.hx, pz - this.hz) < q.head + r;
    const dx = px - this.x, dz = pz - this.z, fw = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw), sd = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
    if (q.box) return fw > -0.4 && fw < q.box[0] + r && Math.abs(sd) < q.box[1] + r;
    if (q.arc) return Math.hypot(dx, dz) < q.arc[0] + r && Math.abs(Math.atan2(sd, fw)) * 57.3 < q.arc[1];
    return false;
  }
}
