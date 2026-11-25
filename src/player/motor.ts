// Player state machine and movement. No rendering imports: runs headless in tests.
import { moveAt, type Clip } from '../anim/pose.ts';
import { D } from '../combat/difficulty.ts';
import { KHANDA } from '../weapons/khanda.ts';
import type { Weapon } from '../weapons/weapon.ts';
import { BODY_CLIPS } from './clips.ts';

export interface Blocker { x: number; z: number; r: number }
export type Press = { a: string; up: boolean };
const BUFFER = 0.25, HOLD = 0.22;
export const WALK = 1.75, RUN = 5.3, SPRINT = 6.9, GUARD_SPEED = 2.1;
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
const isDodge = (c: Clip | null) => !!c && c.name.startsWith('dodge');

export class Motor {
  x = 0; z = 9; yaw = Math.PI; vx = 0; vz = 0; speed = 0;
  state: 'free' | 'clip' = 'free';
  clip: Clip | null = null; t = 0; combo = 0; hold = -1; charge = 0;
  /** Seconds since the last attack or dodge: drives flick and idle behaviour. */ calm = 99;
  moveYaw = Math.PI; safe = 0; dodgeAge = 9; sprintT = 0; stopped = 0; private didFlick = true; private idleT = 0;
  guardHeld = false; /** Guard is up right now. */ guarding = false; /** Seconds since guard was raised. */ guardT = 9; private guardGap = 9;
  dead = false; /** What the fight currently allows. */ can = { skill1: false, skill2: false, ultimate: false, heal: false, execute: false };
  /** Seconds left in which Attack answers a parry or a perfect dodge. */ reckoning = 0; private route: 'main' | 'alt' = 'main'; private guardedT = 9;
  rushFrom = { x: 0, z: 0 }; private rushDist = 6; private gap = 0;
  private buf: { a: string; t: number } | null = null; private lastMove = 0; private comboT = 0;
  events: string[] = []; started = 0; arena = 21.4; blockers: Blocker[] = []; target: Blocker | null = null;
  weapon: Weapon; private clips: Record<string, Clip>;
  constructor(weapon: Weapon = KHANDA) { this.weapon = weapon; this.clips = { ...BODY_CLIPS, ...weapon.clips }; }

  begin(name: string) { this.clip = this.clips[name]; this.t = 0; this.lastMove = 0; this.gap = 0; this.state = 'clip'; this.started++; this.events.push('clip:' + name); }
  private end() { this.state = 'free'; this.clip = null; this.idleT = 0; }
  get targetDist() { return this.target ? Math.hypot(this.target.x - this.x, this.target.z - this.z) : 99; }
  private toTarget() { return Math.atan2(this.target!.x - this.x, this.target!.z - this.z); }
  private faceTarget(mx: number, mz: number, within = 7.5) {
    if (this.target && this.targetDist < within) this.yaw = this.toTarget();
    else if (Math.hypot(mx, mz) > 0.2) this.yaw = Math.atan2(mx, mz);
  }
  /** Attacks close small gaps so a swing that looks in range is in range. */
  private closeGap() { if (!this.target || !this.clip?.hit) return; const d = this.targetDist - this.target.r - (moveAt(this.clip, this.clip.hit[1]) + (this.clip.reach ?? this.weapon.reach) - 0.55); this.gap = d > 0 && d < 1.7 ? d : 0; }
  private swing(name: string, mx: number, mz: number) { this.faceTarget(mx, mz); this.begin(name); this.closeGap(); this.didFlick = false; }
  private attack(mx: number, mz: number) {
    const W = this.weapon, F = W.from, was = this.clip?.name, near = this.targetDist < 5;
    if (this.can.execute) { this.combo = 0; this.reckoning = 0; this.swing(F.execute, mx, mz); return; }
    if (this.reckoning > 0 && near) { this.reckoning = 0; this.combo = 0; this.safe = 1.2; this.swing(F.reckon, mx, mz); return; }
    const art = was === 'dodgeF' ? F.dodgeF : was === 'dodgeB' ? F.dodgeB : was === 'dodgeL' ? F.dodgeL : was === 'dodgeR' ? F.dodgeR : this.guardedT < 0.1 ? F.guard : this.state === 'free' && this.speed > 6.2 ? F.sprint : '';
    // an art counts as the first hit, so the chain carries on from it
    if (art) { this.swing(art, mx, mz); this.combo = art === F.dodgeB ? 0 : 1; this.route = 'main'; this.comboT = 0; this.sprintT = 0; return; }
    if (this.comboT > 0.75) this.combo = 0;
    if (this.combo === 0) this.route = 'main'; else if (this.combo === 2 && this.comboT > 0.2) this.route = 'alt';
    this.swing(this.route === 'alt' ? W.alt[this.combo - 2] : W.combo[this.combo], mx, mz); this.combo = (this.combo + 1) % W.combo.length; this.comboT = 0;
  }
  private art(name: string, mx: number, mz: number) { this.combo = 0; this.guarding = false; this.didFlick = false; this.faceTarget(mx, mz, 18); this.begin(name); }
  private dodge(mx: number, mz: number) {
    const moving = Math.hypot(mx, mz) > 0.2, near = this.target && this.targetDist < 9;
    if (near) this.faceTarget(0, 0, 9);
    if (!moving) { this.moveYaw = this.yaw; this.begin('dodgeB'); }
    else {
      const want = Math.atan2(mx, mz), rel = wrap(want - this.yaw);
      if (!near || Math.abs(rel) < 0.8) { this.yaw = want; this.moveYaw = want; this.begin('dodgeF'); }
      else if (Math.abs(rel) > 2.36) { this.yaw = wrap(want + Math.PI); this.moveYaw = this.yaw; this.begin('dodgeB'); }
      else { this.moveYaw = want; this.begin(rel > 0 ? 'dodgeL' : 'dodgeR'); }
    }
    this.safe = D.dodgeSafe; this.dodgeAge = 0; this.didFlick = false; this.guarding = false;
  }
  private rush(mx: number, mz: number) {
    const near = this.target && this.targetDist < 9; if (near) this.yaw = this.toTarget(); else if (Math.hypot(mx, mz) > 0.2) this.yaw = Math.atan2(mx, mz);
    this.rushDist = near ? Math.max(4.2, this.targetDist + 2.9) : 7; this.rushFrom = { x: this.x, z: this.z }; this.moveYaw = this.yaw; this.safe = 0.75; this.combo = 0; this.didFlick = false; this.guarding = false; this.begin('rush'); this.events.push('use:skill1');
  }
  /** Struck. `from` is the world yaw pointing at whatever did it. */
  hurt(from: number, down: boolean) { this.yaw = from; this.moveYaw = from; this.buf = null; this.hold = -1; this.combo = 0; this.guarding = false; this.didFlick = false; this.begin(down ? 'down' : 'hurt'); }
  guardHit(from: number, parry: boolean) { this.yaw = from; this.moveYaw = from; this.buf = null; this.didFlick = false; this.begin(parry ? 'parry' : 'block'); }
  die() { this.dead = true; this.buf = null; this.hold = -1; this.guarding = false; this.begin('die'); }
  revive(x: number, z: number, yaw: number) { Object.assign(this, { x, z, yaw, vx: 0, vz: 0, speed: 0, dead: false, hold: -1, combo: 0, safe: 0, calm: 99, guarding: false }); this.didFlick = true; this.buf = null; this.end(); }
  /** Guard stops a blow in these states, including mid-flinch while the button is still down. */
  get guardUp() { return this.guarding || (this.guardHeld && this.state === 'clip' && (this.clip?.name === 'block' || this.clip?.name === 'parry')); }

  /** mx, mz: wanted move direction in world space, length 0-1. */
  step(dt: number, mx: number, mz: number, presses: Press[]) {
    this.events.length = 0;
    if (this.dead) { mx = mz = 0; presses = []; }
    const ml = Math.hypot(mx, mz);
    for (const p of presses) {
      if (p.a === 'attack') { if (!p.up) { this.buf = { a: 'attack', t: 0 }; this.hold = 0; } else this.hold = -1; }
      else if (p.a === 'guard') { if (p.up) { this.guardHeld = false; this.guardGap = 0; } else { this.guardHeld = true; this.guardT = this.guardGap > 0.2 ? 0 : 9; } } // mashing Guard never parries
      else if (!p.up && (p.a === 'dodge' || (p.a === 'skill1' && this.can.skill1) || (p.a === 'skill2' && this.can.skill2) || (p.a === 'ultimate' && this.can.ultimate) || (p.a === 'heal' && this.can.heal))) this.buf = { a: p.a, t: 0 };
      else if (!p.up && (p.a === 'skill1' || p.a === 'skill2' || p.a === 'ultimate' || p.a === 'heal')) this.events.push('deny:' + p.a);
    }
    if (this.hold >= 0) this.hold += dt;
    // a press stays buffered while we wait to learn whether it's a tap or a hold
    if (this.buf && (this.buf.t += dt) > BUFFER && !(this.buf.a === 'attack' && this.hold >= 0)) this.buf = null;
    this.safe = Math.max(0, this.safe - dt); this.dodgeAge += dt; this.guardT += dt; this.guardGap += dt; this.guardedT += dt; this.reckoning -= dt; this.comboT += this.state === 'free' || (this.clip?.chain !== undefined && this.t > this.clip.chain) ? dt : 0;
    let dx = 0, dz = 0; const W = this.weapon;

    if (this.state === 'clip' && this.clip) {
      const c = this.clip; const t0 = this.t; this.t += dt; this.calm = /flick|clench/.test(c.name) ? this.calm + dt : 0; this.guarding = false;
      for (const f of c.fx ?? []) if (f.t > t0 && f.t <= this.t) this.events.push('fx:' + f.kind);
      for (const h of c.hits ?? (c.hit ? [c.hit] : [])) if (t0 < h[0] && this.t >= h[0]) this.events.push('swing');
      const scale = c.name === 'rush' ? this.rushDist : 1, m = moveAt(c, this.t) * scale; let d = m - this.lastMove; this.lastMove = m;
      if (c.hit && t0 < c.hit[0]) d += this.gap * dt / c.hit[0];
      const my = isDodge(c) || /^(hurt|down|block|rush)$/.test(c.name) ? this.moveYaw : this.yaw; dx = Math.sin(my) * d; dz = Math.cos(my) * d;
      // steer gently toward the target through an attack's wind-up
      if (this.target && c.hit && this.t < c.hit[0] && this.targetDist < 8) this.yaw += wrap(this.toTarget() - this.yaw) * Math.min(1, dt * 12);
      this.vx = dx / dt; this.vz = dz / dt; this.speed = Math.hypot(this.vx, this.vz);
      const alt = W.alt.indexOf(c.name), idx = alt >= 0 ? alt + 2 : W.combo.indexOf(c.name), open = c.chain !== undefined && this.t >= c.chain, reacting = /^(hurt|down|die|rekindle)$/.test(c.name), scripted = /^(rites|execute)$/.test(c.name) && !open;
      const early = isDodge(c) && this.t < (c.chain ?? 0), free = c.free !== undefined && this.t >= c.free;
      const struck = c.hit ? this.t > (c.hits ?? [c.hit])[(c.hits ?? [c.hit]).length - 1][1] || this.t < c.hit[0] * 0.5 : /^(charge|flick|clench)$/.test(c.name);
      if (c.name === W.charge) {
        this.charge = Math.min(3, Math.floor(this.t / 0.4));
        if (this.buf?.a === 'dodge') { this.buf = null; this.hold = -1; this.dodge(mx, mz); }
        else if (this.hold < 0 || this.t > 1.6) { this.hold = -1; this.buf = null; this.swing(W.heavy, mx, mz); this.comboT = 9; }
      }
      else if (c.name === 'die') { if (this.t > c.dur) this.t = c.dur; }
      else if (scripted) { if (this.buf && this.t < 1) this.buf = null; }
      else if (this.buf?.a === 'dodge' && !early && !(reacting && !open) && !(c.name === 'reckon' && this.t < 0.95) && !(c.name === 'rush' && this.t < 0.45)) { this.buf = null; this.dodge(mx, mz); }
      else if (this.buf?.a === 'skill1' && !early && !(reacting && !open) && c.name !== 'rush') { this.buf = null; this.rush(mx, mz); }
      else if (this.buf?.a === 'ultimate' && !early && !(reacting && !open)) { this.buf = null; this.safe = 4; this.art('rites', mx, mz); this.events.push('use:ultimate'); }
      else if (this.buf?.a === 'skill2' && !early && !(reacting && !open) && c.name !== 'sunder' && c.name !== 'rush') { this.buf = null; this.art('sunder', mx, mz); this.events.push('use:skill2'); }
      else if (this.buf?.a === 'heal' && (open || struck) && c.name !== 'heal') { this.buf = null; this.begin('heal'); }
      // holding the very first press turns the opening cut into a charge
      else if (idx === 0 && this.hold > HOLD && this.t <= c.hit![0] + 0.03) { this.buf = null; this.combo = 0; this.faceTarget(mx, mz); this.begin(W.charge); }
      else if (open && this.hold > HOLD && (c.hit || isDodge(c))) { this.buf = null; if (idx >= 0 && idx < W.finishers.length) { this.swing(W.finishers[idx], mx, mz); this.combo = 0; this.hold = -1; } else { this.faceTarget(mx, mz); this.begin(W.charge); } }
      else if (open && this.buf?.a === 'attack' && this.hold < 0) { this.buf = null; this.attack(mx, mz); }
      else if (this.guardHeld && (open || (struck && this.guardT < this.t)) && !reacting && c.name !== 'rush' && !isDodge(c)) this.end();
      else if (free && (ml > 0.15 || this.buf || this.guardHeld)) this.end();
      else if (this.t >= c.dur) this.end();
    }
    if (this.state === 'free') {
      this.guarding = this.guardHeld; if (this.guarding) this.guardedT = 0;
      if (this.buf?.a === 'dodge') { this.buf = null; this.dodge(mx, mz); }
      else if (this.buf?.a === 'skill1') { this.buf = null; this.rush(mx, mz); }
      else if (this.buf?.a === 'ultimate') { this.buf = null; this.safe = 4; this.art('rites', mx, mz); this.events.push('use:ultimate'); }
      else if (this.buf?.a === 'skill2') { this.buf = null; this.art('sunder', mx, mz); this.events.push('use:skill2'); }
      else if (this.buf?.a === 'heal') { this.buf = null; this.guarding = false; this.begin('heal'); }
      else if (this.hold > HOLD) { this.buf = null; this.guarding = false; this.faceTarget(mx, mz); this.begin(W.charge); }
      else if (this.buf?.a === 'attack' && (this.hold < 0 || this.buf.t > 0.1)) { this.buf = null; this.guarding = false; this.attack(mx, mz); }
      else if (this.guarding) {
        // square up to the threat and step in any direction
        this.calm = 0; this.idleT = 0; this.didFlick = false; this.sprintT = 0;
        if (this.target && this.targetDist < 14) { const d = wrap(this.toTarget() - this.yaw); this.yaw = wrap(this.yaw + Math.max(-dt * 9, Math.min(dt * 9, d))); }
        const want = ml < 0.12 ? 0 : GUARD_SPEED * Math.min(1, ml), k = Math.min(1, dt * 12), tx = ml > 0.01 ? mx / ml * want : 0, tz = ml > 0.01 ? mz / ml * want : 0; this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k; this.speed = Math.hypot(this.vx, this.vz); dx = this.vx * dt; dz = this.vz * dt;
      } else {
        this.calm += dt; this.sprintT = ml > 0.97 ? this.sprintT + dt : 0;
        // half stick is a walk; full stick breaks into a run, then a sprint
        const want = ml < 0.12 ? 0 : ml < 0.55 ? WALK : this.sprintT > 1.6 ? SPRINT : RUN, acc = want > this.speed ? 16 : 24;
        this.speed += Math.max(-acc * dt, Math.min(acc * dt, want - this.speed));
        if (ml > 0.12) { const w = Math.atan2(mx, mz), d = wrap(w - this.yaw), max = dt * (this.speed > 3 ? 11 : 9); this.yaw = wrap(this.yaw + Math.max(-max, Math.min(max, d * 0.3))); this.stopped = 0; this.idleT = 0; } else this.stopped += dt;
        this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed; dx = this.vx * dt; dz = this.vz * dt;
        if (this.speed < 0.05) {
          this.idleT += dt;
          if (!this.didFlick && this.idleT > 0.18) { this.didFlick = true; this.begin('flick'); }
          else if (this.calm > 5 && this.idleT > 6) { this.idleT = -4; this.begin('clench'); }
        }
      }
    }
    this.x += dx; this.z += dz;
    const push = (bx: number, bz: number, r: number) => { const ox = this.x - bx, oz = this.z - bz, d = Math.hypot(ox, oz); if (d < r && d > 1e-4) { this.x = bx + ox / d * r; this.z = bz + oz / d * r; } };
    const gone = this.clip?.name === 'rush' && this.t < 0.44;
    for (const b of this.blockers) push(b.x, b.z, b.r + 0.35);
    if (this.target && !gone && !(this.clip?.name === 'dodgeF' && this.safe > 0)) push(this.target.x, this.target.z, this.target.r + 0.35);
    const d = Math.hypot(this.x, this.z); if (d > this.arena) { this.x *= this.arena / d; this.z *= this.arena / d; }
  }
}
