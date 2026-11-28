// A lesser foe: a small simulation of its own, built for crowds. It speaks the boss strike language (white, red, ground; the same Strike type) but has no rig, no phases and no brain. Kinds subclass Foe and override `pick` (what to throw next) or `think` (how to move). No rendering imports.
import type { Strike } from '../bosses/king/moves2.ts';

/** Data a kind is made of. `life` is health in the hero's damage units. */
export interface FoeSpec {
  kind: string;
  life: number;
  /** Body radius, metres. */
  r: number;
  /** Walking speed when closing in, m/s. */
  speed: number;
  /** Gap to the hero (between bodies) at which it starts to attack, metres. */
  reach: number;
  /** Kauri dropped on death. */
  kauri: number;
  /** Seconds after an attack before the next one may begin. */
  cooldown: number;
  /** Seconds it is staggered for after a heavy blow or a parry. */
  stagger: number;
}

/** One attack: its strike table (times in seconds from its start) and its length. */
export interface Attack { name: string; dur: number; strikes: Strike[] }

/** What the encounter gives a foe each step. */
export interface FoeCtx {
  /** Where the hero stands. */
  hx: number; hz: number;
  /** Asks for an attack token; true if the foe may start winding up now (at most two foes hold one at a time). */
  token(f: Foe): boolean;
}

/** A blow this heavy (power, as the hero's blade reports it) staggers a foe. */
export const STAGGER_POWER = 1.2;
/** The hero's body radius, as the encounter sees it. */
export const HERO_R = 0.45;

let seq = 0;

export abstract class Foe {
  readonly id = ++seq;
  x: number; z: number; yaw = 0;
  life: number;
  /** A short name for what it is doing: idle, approach, circle, reel, dead, or the attack's name. */
  mode = 'idle';
  /** Seconds into the current attack. */
  mt = 0;
  /** Holds an attack token (winding up or striking). */
  hasToken = false;
  /** Counts attacks begun, so strikes can be told apart. */
  serial = 0;
  dead = false;
  /** Seconds before another attack may begin. */
  cooldown = 0;
  /** Seconds left staggered: no attacks, and it is helpless. */
  stunT = 0;
  attack: Attack | null = null;
  /** Strikes whose cue time passed this step. */
  cues: Strike[] = [];
  /** Strikes live this step (inside their hit window). */
  live: Strike[] = [];

  readonly spec: FoeSpec;
  constructor(spec: FoeSpec, x = 0, z = 0) { this.spec = spec; this.x = x; this.z = z; this.life = spec.life; }

  get r() { return this.spec.r; }
  get kauri() { return this.spec.kauri; }
  get attacking() { return this.attack !== null; }
  /** Dead, or staggered: the hero's blows land clean. */
  get helpless() { return this.dead || this.stunT > 0; }
  get strikes(): Strike[] { return this.attack?.strikes ?? []; }

  /** The next attack this kind wants to throw, or null. Called only when it is free to act and in reach. */
  protected pick(_ctx: FoeCtx): Attack | null { return null; }

  /** Movement and choice while free. Default: close to reach, attack when a token and a pick allow, otherwise circle. */
  protected think(dt: number, ctx: FoeCtx): void {
    const gap = this.gap(ctx);
    if (gap > this.spec.reach) { this.mode = 'approach'; this.approach(dt, ctx); return; }
    if (this.cooldown <= 0) { const a = this.pick(ctx); if (a && this.begin(a, ctx)) return; }
    this.mode = 'circle'; this.orbit(dt, ctx);
  }

  /** Starts an attack if a token is held or can be had. */
  begin(a: Attack, ctx: FoeCtx): boolean {
    if (!this.hasToken && !ctx.token(this)) return false;
    this.hasToken = true; this.attack = a; this.mt = 0; this.serial++; this.mode = a.name; this.cues = []; this.live = [];
    return true;
  }

  /** Advances by dt (real seconds of simulated time). */
  step(dt: number, ctx: FoeCtx): void {
    this.cues = []; this.live = [];
    if (this.dead) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.stunT > 0) { if ((this.stunT -= dt) <= 0) { this.stunT = 0; this.mode = 'idle'; } return; }
    const a = this.attack;
    if (a) {
      const prev = this.mt; this.mt += dt;
      if (this.mt < (a.strikes[0]?.t[0] ?? 0)) this.face(ctx);
      for (const s of a.strikes) if (prev < s.cue && this.mt >= s.cue) this.cues.push(s);
      for (const s of a.strikes) if (this.mt >= s.t[0] && this.mt <= s.t[1] + 0.02) this.live.push(s);
      if (this.mt >= a.dur) this.finish();
      return;
    }
    this.think(dt, ctx);
  }

  /** A blow landed. Returns true only on the blow that kills (so drops happen once). */
  struck(dmg: number, power: number): boolean {
    if (this.dead) return false;
    this.life -= dmg;
    if (this.life <= 0) { this.life = 0; this.dead = true; this.breakAttack(); this.mode = 'dead'; return true; }
    if (power >= STAGGER_POWER) this.stagger();
    return false;
  }
  /** Parried: the attack is over and the foe is staggered. */
  parried(): void { this.breakAttack(); this.stagger(); }
  /** Drops the attack and its token (a broken wind-up). */
  breakAttack(): void { this.attack = null; this.hasToken = false; this.live = []; this.cues = []; }
  /** Does this strike reach point (px, pz)? Same geometry as the bosses. */
  covers(s: Strike, px: number, pz: number, r = 0.3): boolean {
    if (s.head) return Math.hypot(px - this.x, pz - this.z) < s.head + r;
    const dx = px - this.x, dz = pz - this.z, fw = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw), sd = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
    if (s.box) return fw > -0.4 && fw < s.box[0] + r && Math.abs(sd) < s.box[1] + r;
    if (s.arc) return Math.hypot(dx, dz) < s.arc[0] + r && Math.abs(Math.atan2(sd, fw)) * 57.3 < s.arc[1];
    return false;
  }

  private stagger() { this.breakAttack(); this.stunT = this.spec.stagger; this.mode = 'reel'; }
  private finish() { this.attack = null; this.hasToken = false; this.live = []; this.mode = 'idle'; this.cooldown = this.spec.cooldown; }
  /** Distance between bodies. */
  protected gap(ctx: FoeCtx): number { return Math.hypot(ctx.hx - this.x, ctx.hz - this.z) - this.r - HERO_R; }
  protected face(ctx: FoeCtx): void { this.yaw = Math.atan2(ctx.hx - this.x, ctx.hz - this.z); }
  protected approach(dt: number, ctx: FoeCtx): void {
    this.face(ctx); const dx = ctx.hx - this.x, dz = ctx.hz - this.z, d = Math.hypot(dx, dz) || 1, s = Math.min(this.spec.speed * dt, Math.max(0, this.gap(ctx) - this.spec.reach));
    this.x += dx / d * s; this.z += dz / d * s;
  }
  /** Sidesteps round the hero, keeping about its reach away. Which way is fixed by the foe's id. */
  protected orbit(dt: number, ctx: FoeCtx): void {
    this.face(ctx); const dx = this.x - ctx.hx, dz = this.z - ctx.hz, d = Math.hypot(dx, dz) || 1, side = this.id % 2 ? 1 : -1, v = this.spec.speed * 0.5 * dt;
    const want = this.spec.reach + this.r + HERO_R, pull = (d - want) * Math.min(1, dt * 2);
    this.x += (-dz / d * side * v) - dx / d * pull; this.z += (dx / d * side * v) - dz / d * pull;
  }
}
