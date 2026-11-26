// The referee for a crowd: one hero against many lesser foes. The hero's motor, blades, guard, dodges, cues and ground danger work as in fight.ts; each foe is its own small simulation (src/foes/foe.ts). No rendering imports.
import type { Strike } from '../boss/moves2.ts';
import type { FightEvent, Hazard } from './fight.ts';
import type { Blocker, Motor, Press } from '../player/motor.ts';
import type { Foe, FoeCtx } from '../foes/foe.ts';
import { HERO_R, STAGGER_POWER } from '../foes/foe.ts';
import { D } from './difficulty.ts';

/** At most this many foes may be winding up or striking at once. */
export const TOKENS = 2;
/** Foes beyond this are not locked on. */
export const LOCK_RANGE = 14;
/** Kauri fly to the hero at this speed, after a short wait on the ground. */
export const KAURI_SPEED = 9, KAURI_WAIT = 0.35, KAURI_REACH = 0.7;

/** The fight's events, plus what only a crowd has. Foe events name the foe. */
export type EncounterEvent = FightEvent
  | { k: 'foeHit'; foe: Foe; dmg: number; power: number; dead: boolean }
  | { k: 'foeStagger'; foe: Foe }
  | { k: 'foeDead'; foe: Foe; kauri: number; x: number; z: number }
  | { k: 'kauri'; n: number }
  | { k: 'lock'; foe: Foe | null };

/** Kauri lying on the ground where a foe fell, waiting to be taken. */
export interface Ember { x: number; z: number; n: number; age: number }

export class Encounter {
  hp = D.hp; hits = 0; taken = 0; deaths = 0; time = 0; stop = 0; invuln = 0;
  ev: EncounterEvent[] = [];
  /** Foes in the encounter, dead ones included (they stay for the caller to draw or remove). */
  foes: Foe[];
  /** The foe the hero is locked on to, or null. */
  target: Foe | null = null;
  /** Kauri taken so far by walking into embers. The caller moves them into progress. */
  kauri = 0; embers: Ember[] = [];
  /** Ground danger made by foes. */
  hazards: Hazard[] = [];
  private aim: Blocker = { x: 0, z: 0, r: 0.5 };
  private queue: Press[] = [];
  private spent = new Set<string>();
  private ids = 0;

  readonly m: Motor;
  constructor(m: Motor, foes: Foe[] = []) { this.m = m; this.foes = [...foes]; m.target = null; }

  add(f: Foe) { this.foes.push(f); }
  get alive(): Foe[] { return this.foes.filter(f => !f.dead); }
  /** Foes holding an attack token right now. */
  get attackers(): Foe[] { return this.foes.filter(f => f.hasToken && !f.dead); }

  /** The token rule: a foe may start an attack only while fewer than TOKENS hold one. */
  token(f: Foe): boolean {
    if (f.hasToken) return true;
    if (this.attackers.length >= TOKENS) return false;
    f.hasToken = true; return true;
  }

  /** Locks on to the next foe by distance (a button or stick flick). */
  cycle() {
    const c = this.candidates(); if (c.length === 0) return;
    const i = this.target ? c.indexOf(this.target) : -1;
    this.setTarget(c[(i + 1) % c.length] ?? null);
  }

  /** Advances by real dt; returns the simulated time that passed (0 while frozen on a blow). */
  step(dt: number, mx: number, mz: number, presses: Press[]): number {
    this.ev.length = 0;
    this.queue.push(...presses);
    if (this.stop > 0) { this.stop -= dt; this.m.events.length = 0; return 0; }
    this.time += dt; this.invuln = Math.max(0, this.invuln - dt);
    const m = this.m;
    m.can.skill1 = m.can.skill2 = m.can.ultimate = m.can.heal = m.can.execute = m.can.finale = false;
    const q = this.queue; this.queue = [];
    for (const p of q) if (p.a === 'lock' && !p.up) this.cycle();
    if (!this.target || this.target.dead || Math.hypot(this.target.x - m.x, this.target.z - m.z) > LOCK_RANGE) this.setTarget(this.candidates()[0] ?? null);
    m.blockers = this.alive.map(f => ({ x: f.x, z: f.z, r: f.r }));
    m.step(dt, mx, mz, q.filter(p => p.a !== 'lock'));
    this.sync();
    if (!m.dead) this.heroBlows();
    const ctx: FoeCtx = { hx: m.x, hz: m.z, token: f => this.token(f) };
    for (const f of this.alive) { f.step(dt, ctx); for (const s of f.cues) this.cue(f, s); }
    this.separate();
    if (!m.dead) this.foesStrike();
    this.zones(dt);
    this.kauriStep(dt);
    return dt;
  }

  private sync() {
    const t = this.target;
    if (t) { this.aim.x = t.x; this.aim.z = t.z; this.aim.r = t.r; this.m.target = this.aim; } else this.m.target = null;
  }
  private setTarget(f: Foe | null) { if (f !== this.target) { this.target = f; this.sync(); this.ev.push({ k: 'lock', foe: f }); } }
  /** Alive foes in lock range: those in front first, then by distance. */
  private candidates(): Foe[] {
    const m = this.m;
    const score = (f: Foe) => { const d = Math.hypot(f.x - m.x, f.z - m.z); let a = Math.atan2(f.x - m.x, f.z - m.z) - m.yaw; a -= Math.round(a / 6.2832) * 6.2832; return d + (Math.abs(a) * 57.3 < 80 || d < 2.5 ? 0 : 6); };
    return this.alive.filter(f => Math.hypot(f.x - m.x, f.z - m.z) <= LOCK_RANGE).sort((a, b) => score(a) - score(b));
  }

  /** The hero's swing windows against every foe in the arc: a cleave hits all of them, once each. */
  private heroBlows() {
    const m = this.m, c = m.clip; if (m.state !== 'clip' || !c?.hit) return;
    const W = c.hits ?? [c.hit];
    W.forEach((w, i) => {
      if (m.t < w[0] || m.t > w[1] + 0.02) return;
      const last = i === W.length - 1, p = (c.power ?? 1) * (last ? D.lastHit[c.name] ?? 1 : 1);
      for (const f of this.alive) {
        const key = m.started + '/' + i + '/' + f.id; if (this.spent.has(key)) continue;
        const dx = f.x - m.x, dz = f.z - m.z, d = Math.hypot(dx, dz) - f.r;
        if (d > (c.reach ?? m.weapon.reach)) continue;
        let a = Math.atan2(dx, dz) - m.yaw; a -= Math.round(a / 6.2832) * 6.2832;
        if (Math.abs(a) * 57.3 > (c.arc ?? m.weapon.arc) && d > 0.2) continue;
        this.spent.add(key); if (this.spent.size > 200) this.spent = new Set([...this.spent].slice(-100));
        const dmg = m.weapon.damage * p, power = Math.min(p, 3.4);
        const dead = f.struck(dmg, p);
        this.hits++; this.stop = Math.max(this.stop, p < 0.9 ? 0.028 : p < 1.2 ? 0.055 : 0.1);
        this.ev.push({ k: 'hit', power, dmg, reel: p >= STAGGER_POWER, kind: 'blade', head: false }, { k: 'foeHit', foe: f, dmg, power: p, dead });
        if (dead) this.drop(f);
        else if (!dead && p >= STAGGER_POWER) this.ev.push({ k: 'foeStagger', foe: f });
      }
    });
  }
  /** A foe's kauri lie where it fell. Called once, on the blow that kills. */
  private drop(f: Foe) {
    this.embers.push({ x: f.x, z: f.z, n: f.kauri, age: 0 });
    this.ev.push({ k: 'foeDead', foe: f, kauri: f.kauri, x: f.x, z: f.z });
    if (this.target === f) this.setTarget(this.candidates()[0] ?? null);
  }
  private kauriStep(dt: number) {
    const m = this.m;
    for (const e of this.embers) {
      e.age += dt; if (e.age < KAURI_WAIT) continue;
      const dx = m.x - e.x, dz = m.z - e.z, d = Math.hypot(dx, dz) || 1, s = Math.min(d, KAURI_SPEED * dt * (1 + e.age));
      e.x += dx / d * s; e.z += dz / d * s;
    }
    const taken = this.embers.filter(e => e.age >= KAURI_WAIT && Math.hypot(m.x - e.x, m.z - e.z) < KAURI_REACH);
    if (taken.length) {
      this.embers = this.embers.filter(e => !taken.includes(e));
      for (const e of taken) { this.kauri += e.n; this.ev.push({ k: 'kauri', n: e.n }); }
    }
  }

  /** A foe's cue: the mark, and any ground danger it makes. */
  private cue(f: Foe, s: Strike) {
    const m = this.m;
    this.ev.push({ k: 'cue', strike: s, lead: s.t[0] - f.mt, first: false });
    for (const z of s.zones ?? []) {
      const at = z.at === 'player' ? m : f, h: Hazard = { id: ++this.ids, shape: z.shape, x: at.x, z: at.z, yaw: f.yaw + (z.yaw ?? 0), r: z.r ?? 0, len: z.len ?? 0, half: z.half ?? 0.45, t: 0, delay: z.delay, dmg: s.dmg, down: !!s.down, speed: z.speed ?? 0, max: z.max ?? 0, done: false, visual: !!(s.box || s.arc || s.head || s.silent), first: false, mode: f.mode, inner: z.inner, spin: z.spin, dur: z.dur };
      this.hazards.push(h); this.ev.push({ k: 'zone', z: h });
    }
  }
  /** Live strikes against the hero. A parry staggers the foe; a block chips; anything else hurts. */
  private foesStrike() {
    const m = this.m;
    for (const f of this.alive) {
      const a = f.attack; if (!a) continue;
      for (const s of f.live) {
        if (!s.box && !s.arc && !s.head) continue;
        const id = f.id + '/' + f.serial + '/' + a.strikes.indexOf(s);
        if (this.spent.has(id) || !f.covers(s, m.x, m.z)) continue;
        const from = Math.atan2(f.x - m.x, f.z - m.z);
        if (s.low && m.over) { this.spent.add(id); this.leapt(); continue; }
        if (m.safe > 0) { this.spent.add(id); this.evade(); continue; }
        if (this.invuln > 0) continue;
        this.spent.add(id);
        let fa = from - m.yaw; fa -= Math.round(fa / 6.2832) * 6.2832;
        if (s.kind === 'white' && m.guardUp && Math.abs(fa) < 1.9) {
          if (m.guardT < D.parry) { m.guardHit(from, true); m.reckoning = 1.8; this.stop = 0.12; f.parried(); this.ev.push({ k: 'parry' }); }
          else { m.guardHit(from, false); this.hp = Math.max(1, this.hp - s.dmg * D.chip); this.stop = 0.07; this.ev.push({ k: 'block' }); }
          continue;
        }
        this.hurt(s.dmg, !!s.down, from);
      }
    }
    if (this.spent.size > 200) this.spent = new Set([...this.spent].slice(-100));
  }
  /** Foes pushing each other and the hero apart, so bodies do not stack. */
  private separate() {
    const m = this.m, all = this.foes.filter(f => !f.dead), L = m.arena;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), need = a.r + b.r;
      if (d < need && d > 1e-4) { const o = (need - d) / 2; a.x -= dx / d * o; a.z -= dz / d * o; b.x += dx / d * o; b.z += dz / d * o; }
    }
    for (const a of all) {
      const hx = a.x - m.x, hz = a.z - m.z, hd = Math.hypot(hx, hz), want = a.r + HERO_R;
      if (hd < want && hd > 1e-4) { a.x = m.x + hx / hd * want; a.z = m.z + hz / hd * want; }
      const q = Math.hypot(a.x, a.z); if (q > L) { a.x *= L / q; a.z *= L / q; }
    }
  }

  private hurt(dmg: number, down: boolean, from: number) {
    const m = this.m;
    this.hp = Math.max(0, this.hp - dmg); this.taken++; this.invuln = D.hurtSafe + (down ? 0.9 : 0); this.stop = down ? 0.12 : 0.085;
    if (this.hp <= 0) { m.yaw = from; m.die(); this.deaths++; this.ev.push({ k: 'hurt', dmg, down: true }, { k: 'dead' }); }
    else { m.hurt(from, down); this.ev.push({ k: 'hurt', dmg, down }); }
  }
  private evade() { const m = this.m, perfect = m.dodgeAge < D.perfect; if (perfect) m.reckoning = 1.6; this.ev.push({ k: 'evade', perfect }); }
  private leapt() { this.m.sky = 1.6; this.ev.push({ k: 'leap' }); }

  /** Ground danger from foes: circles, lines, sweeps and rings, as the bosses lay them. */
  private zones(dt: number) {
    const m = this.m;
    for (const h of this.hazards) {
      h.t += dt; if (h.visual || h.t < h.delay) continue;
      const dx = m.x - h.x, dz = m.z - h.z, d = Math.hypot(dx, dz); let inside = false, over = false;
      if (h.shape === 'circle') { inside = d < h.r + 0.1 && d > (h.inner ?? -1) - 0.1; over = h.t > h.delay + 0.1; }
      else if (h.shape === 'sweep') { const u = Math.min(1, (h.t - h.delay) / (h.dur || 1)), yw = h.yaw + (h.spin ?? 0) * u, fw = dx * Math.sin(yw) + dz * Math.cos(yw), sd = Math.abs(dx * Math.cos(yw) - dz * Math.sin(yw)); inside = fw > (h.inner ?? 0) && fw < h.len && sd < h.half + 0.1; over = u >= 1; }
      else if (h.shape === 'line') { const fw = dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw), sd = Math.abs(dx * Math.cos(h.yaw) - dz * Math.sin(h.yaw)); inside = fw > -0.5 && fw < h.len && sd < h.half + 0.1; over = h.t > h.delay + 0.12; }
      else { const R = h.speed * (h.t - h.delay); inside = Math.abs(d - R) < 0.5; over = R > h.max; }
      if (h.t - dt < h.delay) this.ev.push({ k: 'zoneHit', z: h });
      if (inside && !h.done && !m.dead) {
        if (m.over) { h.done = true; this.leapt(); }
        else if (m.safe > 0) { h.done = true; this.evade(); }
        else if (this.invuln <= 0) { h.done = true; this.hurt(h.dmg, h.down, Math.atan2(h.x - m.x, h.z - m.z) || m.yaw); }
      }
      if (over) h.max = -1;
    }
    this.hazards = this.hazards.filter(h => h.max !== -1 && h.t < h.delay + 2.5 && !(h.visual && h.t > h.delay));
  }
}
