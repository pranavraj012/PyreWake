// Player state machine and movement. No rendering imports: runs headless in tests.
import { DEFAULT_SPELLS, SPELLS, type SpellId } from '../combat/spells.ts';
import { moveAt, type Clip } from '../anim/pose.ts';
import { D } from '../combat/difficulty.ts';
import { KHANDA } from '../weapons/khanda.ts';
import { RITES_STEPS } from '../weapons/khandaChains.ts';
import type { Weapon } from '../weapons/weapon.ts';
import { BODY_CLIPS } from './clips.ts';

export interface Blocker { x: number; z: number; r: number }
export type Press = { a: string; up: boolean };
const BUFFER = 0.25, HOLD = 0.22;
export const WALK = 1.75, RUN = 5.3, SPRINT = 6.9, GUARD_SPEED = 2.1;
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
export const AIR_SPEED = 5.4;
const isDodge = (c: Clip | null) => !!c && c.name.startsWith('dodge');

export class Motor {
  x = 0; z = 9; yaw = Math.PI; vx = 0; vz = 0; speed = 0;
  state: 'free' | 'clip' = 'free';
  clip: Clip | null = null; t = 0; combo = 0; hold = -1; charge = 0;
  /** Seconds since the last attack or dodge: drives flick and idle behaviour. */ calm = 99;
  moveYaw = Math.PI; safe = 0; dodgeAge = 9; sprintT = 0; stopped = 0; private didFlick = true; private idleT = 0;
  guardHeld = false; /** Guard is up right now. */ guarding = false; /** Seconds since guard was raised. */ guardT = 9; private guardGap = 9;
  dead = false; /** What the fight currently allows. */ can = { skill1: false, skill2: false, ultimate: false, heal: false, execute: false, finale: false };
  /** Seconds left in which Attack answers a parry or a perfect dodge. */ reckoning = 0; private guardedT = 9;
  /** Height off the floor, and climb rate. */ y = 0; vy = 0; private airV = { x: 0, z: 0 }; private airCuts = 0; /** Seconds in which a plunge hits harder, for having leapt over something. */ sky = 0; /** Seconds until the long answer to a perfect defence returns. */ flourish = 0; private rip = 0;
  private which = 0; private deep = 0; private chain: string[]; private at: Record<string, number> = {}; private rites = { a: 0, n: 0, x: 0, z: 0 };
  /** The two fire arts carried, for the two spell buttons. */ spells: [SpellId, SpellId] = [...DEFAULT_SPELLS];
  rushFrom = { x: 0, z: 0 }; private rushDist = 6; private gap = 0;
  private buf: { a: string; t: number } | null = null; private lastMove = 0; private comboT = 0;
  events: string[] = []; started = 0; arena = 21.4; blockers: Blocker[] = []; target: Blocker | null = null;
  weapon: Weapon; private clips: Record<string, Clip>;
  constructor(weapon: Weapon = KHANDA) { this.weapon = weapon; this.clips = { ...BODY_CLIPS, ...weapon.clips }; this.chain = weapon.combo; for (const c of weapon.chains) c.forEach((n, i) => { this.at[n] = i; }); }

  begin(name: string) { this.clip = this.clips[name]; this.t = 0; this.lastMove = 0; this.gap = 0; this.state = 'clip'; this.started++; this.events.push('clip:' + name); }
  /** Starts a clip built outside the weapon's table (a staged moment's own strike). */
  beginClip(c: Clip) { this.clip = c; this.t = 0; this.lastMove = 0; this.gap = 0; this.state = 'clip'; this.started++; this.events.push('clip:' + c.name); }
  private end() { this.state = 'free'; this.clip = null; this.idleT = 0; }
  /** Feet high enough for low blows and ground fire to pass under. */
  get over() { return this.y > D.jump.clear; }
  /** How far into the current chain. */
  get depth() { return this.deep; }
  /** Where Last Rites began, and facing from target to hero then. */
  get ritesFrom() { return this.rites; }
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
    if (this.can.execute) { this.combo = 0; this.reckoning = 0; this.swing(this.can.finale ? F.finale : F.execute, mx, mz); return; }
    if (this.reckoning > 0 && near) {
      // the long answer is a treat, not a habit
      this.reckoning = 0; this.combo = 0; const long = this.flourish <= 0; this.safe = long ? 1.2 : 0.7; if (long) this.flourish = D.flourish; this.swing(long ? F.reckon : W.ripostes[this.rip++ % W.ripostes.length], mx, mz); return;
    }
    const art = was === 'dodgeF' ? F.dodgeF : was === 'dodgeB' ? F.dodgeB : was === 'dodgeL' ? F.dodgeL : was === 'dodgeR' ? F.dodgeR : this.guardedT < 0.1 ? F.guard : this.state === 'free' && this.speed > 6.2 ? F.sprint : '';
    // an art counts as the first hit, so the chain carries on from it
    if (art) { this.swing(art, mx, mz); this.combo = art === F.dodgeB ? 0 : 1; this.chain = W.chains[this.which]; this.comboT = 0; this.sprintT = 0; return; }
    if (this.comboT > 0.75) this.combo = 0;
    // a chain carried past its second hit hands over to the next, so mashing never looks the same twice running
    if (this.combo === 0) { if (this.deep > 2) this.which = (this.which + 1) % W.chains.length; this.deep = 0; this.chain = W.chains[this.which]; }
    else if (this.combo === 2 && this.comboT > 0.2) this.chain = this.chain === W.chains[1] ? W.chains[2] : W.chains[1];
    this.swing(this.chain[this.combo], mx, mz); this.combo = (this.combo + 1) % this.chain.length; this.deep++; this.comboT = 0;
  }
  private jump(mx: number, mz: number) {
    const ml = Math.hypot(mx, mz); if (this.target && this.targetDist < 9) this.faceTarget(0, 0, 9); else if (ml > 0.2) this.yaw = Math.atan2(mx, mz);
    this.airV = ml > 0.12 ? { x: mx / ml * AIR_SPEED, z: mz / ml * AIR_SPEED } : { x: 0, z: 0 }; this.y = 0.001; this.vy = D.jump.v; this.airCuts = 0; this.combo = 0; this.guarding = false; this.didFlick = false; this.hold = -1; this.begin('jump');
  }
  private airborne(dt: number, mx: number, mz: number, c: Clip) {
    const W = this.weapon, A = W.air, tx = this.target ? this.target.x - this.x : 0, tz = this.target ? this.target.z - this.z : 0, d = Math.hypot(tx, tz) || 1, gap = this.target && d < 8 ? d - this.target.r - 0.9 : 0;
    if (c.name === A.plunge) {
      // a held breath at the top, then straight down on whatever is there
      const diving = this.t > 0.2; this.vy = diving ? -20 : 1.2; const v = diving && gap > 0 ? Math.min(10, gap * 12) : 0; if (this.target && d < 8) this.yaw = this.toTarget(); this.airV = { x: tx / d * v, z: tz / d * v }; return;
    }
    const k = Math.min(1, dt * 3.5); this.airV.x += (mx * AIR_SPEED - this.airV.x) * k; this.airV.z += (mz * AIR_SPEED - this.airV.z) * k;
    if (c.name === A.cut) { if (this.t < 0.3) this.vy = Math.max(this.vy, 0.6); if (gap > 0.4 && this.t < 0.2) { const v = Math.min(7, gap * 7); this.airV = { x: tx / d * v, z: tz / d * v }; } }
    if (this.buf?.a === 'attack' && this.t > (c.name === 'jump' ? 0.1 : c.chain!)) {
      const tap = this.hold < 0, held = this.hold > 0.16;
      if (tap && this.airCuts === 0 && this.vy > -3.5) { this.buf = null; this.airCuts++; this.faceTarget(0, 0, 8); this.begin(A.cut); this.vy = Math.max(this.vy, 2.4); this.calm = 0; }
      else if (tap || held) { this.buf = null; this.faceTarget(0, 0, 8); this.begin(A.plunge); this.hold = -1; }
    } else if (c.name === A.cut && this.t >= c.dur) { this.begin('jump'); this.t = 0.4; }
  }
  private landed(ml: number) {
    const c = this.clip?.name, A = this.weapon.air; this.y = this.vy = 0; this.events.push('land'); const sp = Math.hypot(this.airV.x, this.airV.z);
    if (c === A.plunge) { this.begin(A.hit); this.combo = 1; this.deep = 1; this.chain = this.weapon.chains[this.which]; this.comboT = 0; }
    else if (c === 'jump' || c === A.cut) { if (ml > 0.3) { this.yaw = Math.atan2(this.airV.x, this.airV.z); this.end(); this.speed = Math.min(RUN, sp); this.moveYaw = this.yaw; } else this.begin('land'); }
  }
  /** Last Rites: gone from here, standing there. */
  private ritesStep(last: boolean) {
    const r = this.rites, t = this.target; if (!t || Math.hypot(r.x - t.x, r.z - t.z) > 15) return; const R = last ? t.r + 3.4 : t.r + 1.5, a = last ? r.a + Math.PI : r.a + RITES_STEPS[r.n++ % RITES_STEPS.length];
    this.x = t.x + Math.sin(a) * R; this.z = t.z + Math.cos(a) * R; const q = Math.hypot(this.x, this.z), lim = this.arena - 0.6; if (q > lim) { this.x *= lim / q; this.z *= lim / q; } this.yaw = last ? a : this.toTarget();
  }
  private art(name: string, mx: number, mz: number) { this.combo = 0; this.guarding = false; this.didFlick = false; this.faceTarget(mx, mz, 18); this.begin(name); if (name === 'rites') this.rites = { a: this.target ? Math.atan2(this.x - this.target.x, this.z - this.target.z) : this.yaw + Math.PI, n: 0, x: this.x, z: this.z }; }
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
  private casting(name: string) { return name === 'rush' || this.spells.some(s => SPELLS[s].clip === name); }
  /** Fire art in slot `i`. */
  private cast(i: 0 | 1, mx: number, mz: number) {
    const s = SPELLS[this.spells[i]]; if (s.id === 'rush') { this.rush(mx, mz, i); return; }
    this.art(s.clip, mx, mz); this.events.push('use:skill' + (i + 1), 'cast:' + s.id); if (s.id === 'ashstep' || s.id === 'wheel') this.safe = s.id === 'ashstep' ? 0.55 : 0.3;
  }
  /** Ashen Step: from where you stood to its far side, facing it. */
  private blink() { const t = this.target; if (!t || this.targetDist > 14) return; const a = Math.atan2(this.x - t.x, this.z - t.z) + Math.PI, R = t.r + 1.35; this.x = t.x + Math.sin(a) * R; this.z = t.z + Math.cos(a) * R; const q = Math.hypot(this.x, this.z), lim = this.arena - 0.6; if (q > lim) { this.x *= lim / q; this.z *= lim / q; } this.yaw = this.toTarget(); this.moveYaw = this.yaw; this.events.push('about'); }
  private rush(mx: number, mz: number, slot = 0) {
    const near = this.target && this.targetDist < 9; if (near) this.yaw = this.toTarget(); else if (Math.hypot(mx, mz) > 0.2) this.yaw = Math.atan2(mx, mz);
    this.rushDist = near ? Math.max(4.2, this.targetDist + 2.9) : 7; this.rushFrom = { x: this.x, z: this.z }; this.moveYaw = this.yaw; this.safe = 0.75; this.combo = 0; this.didFlick = false; this.guarding = false; this.begin('rush'); this.events.push('use:skill' + (slot + 1), 'cast:rush');
  }
  /** Struck. `from` is the world yaw pointing at whatever did it. */
  hurt(from: number, down: boolean) { this.yaw = from; this.moveYaw = from; this.buf = null; this.hold = -1; this.combo = 0; this.guarding = false; this.didFlick = false; this.begin(down ? 'down' : 'hurt'); }
  guardHit(from: number, parry: boolean) { this.yaw = from; this.moveYaw = from; this.buf = null; this.didFlick = false; this.begin(parry ? 'parry' : 'block'); }
  die() { this.dead = true; this.buf = null; this.hold = -1; this.guarding = false; this.begin('die'); }
  revive(x: number, z: number, yaw: number) { Object.assign(this, { x, z, yaw, vx: 0, vz: 0, speed: 0, dead: false, hold: -1, combo: 0, safe: 0, calm: 99, guarding: false, y: 0, vy: 0, sky: 0 }); this.didFlick = true; this.buf = null; this.end(); }
  /** A staged moment takes him out of whatever he is doing (attack, charge, dodge, jump, guard, spell, flask, flinch) and sets him on the
   * floor, still. Nothing he held or buffered goes on afterwards; a button still down is read again only when pressed again. */
  interrupt() { this.buf = null; this.hold = -1; this.combo = 0; this.charge = 0; this.comboT = 0; this.guarding = false; this.guardHeld = false; this.safe = 0; this.reckoning = 0; this.gap = 0; this.sprintT = 0; this.y = 0; this.vy = 0; this.airV = { x: 0, z: 0 }; this.speed = 0; this.vx = 0; this.vz = 0; this.didFlick = true; this.end(); }
  /** A button came up while the world was waiting. */
  drop(a: string) { if (a === 'guard') { this.guardHeld = false; this.guardGap = 1; } if (a === 'attack') this.hold = -1; }
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
      else if (!p.up && (p.a === 'dodge' || p.a === 'jump' || (p.a === 'skill1' && this.can.skill1) || (p.a === 'skill2' && this.can.skill2) || (p.a === 'ultimate' && this.can.ultimate) || (p.a === 'heal' && this.can.heal))) this.buf = { a: p.a, t: 0 };
      else if (!p.up && (p.a === 'skill1' || p.a === 'skill2' || p.a === 'ultimate' || p.a === 'heal')) this.events.push('deny:' + p.a);
    }
    if (this.hold >= 0) this.hold += dt;
    // a press stays buffered while we wait to learn whether it's a tap or a hold
    if (this.buf && (this.buf.t += dt) > BUFFER && !(this.buf.a === 'attack' && this.hold >= 0)) this.buf = null;
    this.safe = Math.max(0, this.safe - dt); this.dodgeAge += dt; this.guardT += dt; this.guardGap += dt; this.guardedT += dt; this.reckoning -= dt; this.flourish -= dt; this.sky -= dt; this.comboT += this.state === 'free' || (this.clip?.chain !== undefined && this.t > this.clip.chain) ? dt : 0;
    let dx = 0, dz = 0; const W = this.weapon;

    if (this.state === 'clip' && this.clip) {
      const c = this.clip; const t0 = this.t; this.t += dt; this.calm = /flick|clench/.test(c.name) ? this.calm + dt : 0; this.guarding = false;
      for (const f of c.fx ?? []) if (f.t > t0 && f.t <= this.t) { this.events.push('fx:' + f.kind); if (f.kind === 'rcut') this.ritesStep(false); if (f.kind === 'rlast') this.ritesStep(true); if (f.kind === 'blink') this.blink(); }
      for (const h of c.hits ?? (c.hit ? [c.hit] : [])) { const s = Math.max(0.005, h[0] - 0.075); if (t0 < s && this.t >= s) this.events.push('swing'); }
      if (c.name === 'rush' && this.t >= 0.6 && this.t - dt < 0.6) { this.yaw = wrap(this.yaw + Math.PI); this.events.push('about'); }
      const scale = c.name === 'rush' ? this.rushDist : 1, m = moveAt(c, this.t) * scale; let d = m - this.lastMove; this.lastMove = m;
      if (c.hit && t0 < c.hit[0]) d += this.gap * dt / c.hit[0];
      const my = isDodge(c) || /^(hurt|down|block|rush)$/.test(c.name) ? this.moveYaw : this.yaw; dx = Math.sin(my) * d; dz = Math.cos(my) * d;
      const flying = this.y > 0 && (c.name === 'jump' || c.name === W.air.cut || c.name === W.air.plunge);
      if (flying) { this.airborne(dt, mx, mz, c); dx = this.airV.x * dt; dz = this.airV.z * dt; }
      // steer gently toward the target through an attack's wind-up
      if (this.target && c.hit && this.t < c.hit[0] && this.targetDist < 8) this.yaw += wrap(this.toTarget() - this.yaw) * Math.min(1, dt * 12);
      this.vx = dx / dt; this.vz = dz / dt; this.speed = Math.hypot(this.vx, this.vz);
      const idx = this.at[c.name] ?? -1, open = c.chain !== undefined && this.t >= c.chain, reacting = /^(hurt|down|die|rekindle)$/.test(c.name), scripted = /^(rites|execute|finale)$/.test(c.name) && !open;
      const early = isDodge(c) && this.t < (c.chain ?? 0), free = c.free !== undefined && this.t >= c.free;
      const struck = c.hit ? this.t > (c.hits ?? [c.hit])[(c.hits ?? [c.hit]).length - 1][1] || this.t < c.hit[0] * 0.5 : /^(charge|flick|clench)$/.test(c.name);
      if (flying) { /* only the floor ends it */ }
      else if (c.name === W.charge) {
        this.charge = Math.min(3, Math.floor(this.t / 0.4));
        if (this.buf?.a === 'dodge') { this.buf = null; this.hold = -1; this.dodge(mx, mz); }
        else if (this.buf?.a === 'jump') { this.buf = null; this.jump(mx, mz); }
        else if (this.hold < 0 || this.t > 1.6) { this.hold = -1; this.buf = null; this.swing(W.heavy, mx, mz); this.comboT = 9; }
      }
      else if (c.name === 'die') { if (this.t > c.dur) this.t = c.dur; }
      else if (scripted) { if (this.buf && this.t < 1) this.buf = null; }
      else if (this.buf?.a === 'dodge' && !early && !(reacting && !open) && !(c.name === 'reckon' && this.t < 0.95) && !(c.name === 'rush' && this.t < 0.45)) { this.buf = null; this.dodge(mx, mz); }
      else if (this.buf?.a === 'jump' && !early && !(reacting && !open) && !(c.name === 'reckon' && this.t < 0.95) && c.name !== 'rush' && (open || struck || isDodge(c))) { this.buf = null; this.jump(mx, mz); }
      else if (this.buf?.a === 'skill1' && !early && !(reacting && !open) && !this.casting(c.name)) { this.buf = null; this.cast(0, mx, mz); }
      else if (this.buf?.a === 'ultimate' && !early && !(reacting && !open)) { this.buf = null; this.safe = 4; this.art('rites', mx, mz); this.events.push('use:ultimate'); }
      else if (this.buf?.a === 'skill2' && !early && !(reacting && !open) && !this.casting(c.name)) { this.buf = null; this.cast(1, mx, mz); }
      else if (this.buf?.a === 'heal' && (open || struck) && c.name !== 'heal') { this.buf = null; this.begin('heal'); }
      // holding the very first press turns the opening cut into a charge
      else if (idx === 0 && this.hold > HOLD && this.t <= c.hit![0] + 0.03) { this.buf = null; this.combo = 0; this.faceTarget(mx, mz); this.begin(W.charge); }
      else if (open && this.hold > HOLD && (c.hit || isDodge(c))) { this.buf = null; if (idx >= 0 && idx < W.finishers.length) { this.swing(W.finishers[idx], mx, mz); this.combo = 0; this.hold = -1; } else { this.faceTarget(mx, mz); this.begin(W.charge); } }
      else if (open && this.buf?.a === 'attack' && this.hold < 0) { this.buf = null; this.attack(mx, mz); }
      else if (this.guardHeld && (open || (struck && this.guardT < this.t)) && !reacting && c.name !== 'rush' && !isDodge(c)) this.end();
      else if (free && (ml > 0.15 || this.buf || this.guardHeld)) this.end();
      else if (this.t >= c.dur) { if (c.name === 'finale') { this.yaw = wrap(this.yaw + Math.PI); this.moveYaw = this.yaw; this.events.push('about'); } this.end(); }
    }
    if (this.state === 'free') {
      this.guarding = this.guardHeld || this.guardT < D.parry; if (this.guarding) this.guardedT = 0; // a quick tap still parries
      if (this.buf?.a === 'dodge') { this.buf = null; this.dodge(mx, mz); }
      else if (this.buf?.a === 'jump') { this.buf = null; this.jump(mx, mz); }
      else if (this.buf?.a === 'skill1') { this.buf = null; this.cast(0, mx, mz); }
      else if (this.buf?.a === 'ultimate') { this.buf = null; this.safe = 4; this.art('rites', mx, mz); this.events.push('use:ultimate'); }
      else if (this.buf?.a === 'skill2') { this.buf = null; this.cast(1, mx, mz); }
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
    if (this.y > 0) { const c = this.clip?.name; this.vy -= D.jump.g * (c === W.air.plunge ? 0 : c === W.air.cut ? 0.45 : c === 'jump' ? 1 : 1.8) * dt; this.y += this.vy * dt; if (this.y <= 0) this.landed(ml); }
    const push = (bx: number, bz: number, r: number) => { const ox = this.x - bx, oz = this.z - bz, d = Math.hypot(ox, oz); if (d < r && d > 1e-4) { this.x = bx + ox / d * r; this.z = bz + oz / d * r; } };
    const gone = this.clip?.name === 'rush' && this.t < 0.44;
    for (const b of this.blockers) push(b.x, b.z, b.r + 0.35);
    if (this.target && !gone && !(this.clip?.name === 'dodgeF' && this.safe > 0)) push(this.target.x, this.target.z, this.target.r + 0.35);
    const d = Math.hypot(this.x, this.z); if (d > this.arena) { this.x *= this.arena / d; this.z *= this.arena / d; }
  }
}
