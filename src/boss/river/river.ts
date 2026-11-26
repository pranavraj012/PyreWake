// The second boss's simulation in both rounds: the Ferryman (form 1) and the Unburdened (form 2), the same man with the net gone. Runs headless; its own mechanics resolve in tick().
import { moveAt } from '../../anim/pose.ts';
import type { Boss } from '../boss.ts';
import type { Strike } from '../moves2.ts';
import type { Fight, Hazard } from '../../combat/fight.ts';
import { D } from '../../combat/difficulty.ts';
import { RIVER_CLIPS as C } from './clips.ts';
import { RIVER_ATTACKS as A } from './moves.ts';

export const REACH = 18.5;
const sst = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
const QUIET = ['reel', 'reel2', 'snap', 'kneel', 'fall', 'cradle', 'riseW', 'die2', 'idle', 'stalk', 'strafe'];
/** A move rather than footwork or a wound. */
export const isMove = (m: string) => m in C && !QUIET.includes(m);
/** Where the turn stops, so the mark it threw is where it lands: the line is drawn at the cue. */
const LOCK: Record<string, number> = { cast: 0.3, dragDeep: 0.4, haulIn: 0 };
/** The staged moments (module A): a grab that always plays out, and a reward the hero earns. Times are the moment's own clock, `stage`, in seconds. */export const DRAG = { under: 0.55, hold: 0.85, dmg: 1.0, heave: 2.2, end: 3.4 }, CHAIN = { hit: 1.6, len: 3.0 }, LANTERN = { hit: 0.9, len: 2.4 };export const GRAB_DRAG = { drag: 44 }, RIVER_REWARD_SHARE = 0.09, RIVER_OFFER = 1.8;

export interface Chain { x: number; z: number; len: number; hp: number; t: number; cut: number }
export interface Lantern { x: number; z: number; real: boolean; t: number; gone: number }
export interface Coin { x: number; z: number; vx: number; vz: number; life: number; back: boolean }
export interface Wave { x: number; z: number; yaw: number; d: number; speed: number; half: number; gaps: { s: number; w: number }[]; hit: boolean }
export interface Ring { x: number; z: number; R: number; arms: boolean[]; hit: boolean; t: number }
export interface Soul { x: number; z: number; t: number; freed: number }
export interface Out { e: string; x?: number; z?: number; n?: number }

export class River implements Boss {
  x = 0; z = -4; y = 0; yaw = 0; vx = 0; vz = 0; speed = 0; mode = 'idle'; mt = 0; prev = 0; burst = 0; r = 0.9; form: 1 | 2 = 1; rate = 1; pace = 1; serial = 0;
  cues: Strike[] = []; live: Strike[] = []; ended: string | null = null; armed = false; crawling = false; ht = 0; th = 0; dir = 0; mark = { x: 0, z: 0 };
  // --- its own mechanics
  chain: Chain | null = null; /** Seconds of darkness left. */ dark = 0; lanterns: Lantern[] = []; coins: Coin[] = []; wave: Wave | null = null; ring: Ring | null = null; souls: Soul[] = []; /** Patches of cold hands, as the referee holds them. */ hands: Hazard[] = []; freed = 0;
  /** Undertow strength 0-1. */ pull = 0; /** Seconds in which it takes extra, and by how much. */ exposed = 0; bonus = 1.6; /** Under the water. */ sub = false; /** The player jumped the breach circle. */ jumped = false; /** Seconds of boiling river left: it cannot hide. */ boil = 0;
  /** Where the body has been, newest first, for the sections of the Weight. */ trail: { x: number; z: number }[] = []; out: Out[] = [];
  private moved = 0; private side = 1; private sideT = 0; private from = { x: 0, z: 0 }; private cut = new Set<string>(); private castNow = false; private handsNow = false; private burstNow = false; private hauling = 0; private coinAcc = 0; private spin = 0; private orbit = 0; private px = 0; private pz = 5; private oneMoreAt = -99; private seenLeap = -9;

  set(mode: string, rate = 1) { this.mode = mode; this.mt = this.prev = 0; this.moved = 0; this.rate = rate; this.serial++; this.y = 0; if (mode === 'wake') { this.jumped = false; this.from = { x: this.x, z: this.z }; } }
  /** Staged moments: the grab holding the hero, its clock, the reward in progress and the reward on offer. */
  held: 'drag' | null = null; stage = 0; rite: 'chain' | 'lantern' | null = null; reward: 'chain' | 'lantern' | null = null; rewardLeft = 0; lastAnchor = { x: 0, z: 0 }; private sp = 0;
  /** One grab per boss: its first throw in a fight is forced to connect. Round 1 starts a fight afresh. */
  grabbedOnce = false; forcesGrab() { return !this.grabbedOnce; }
  reset() { if (this.form === 1) this.grabbedOnce = false; this.clearMoments(); this.chain = null; this.dark = 0; this.lanterns = []; this.coins = []; this.wave = null; this.ring = null; this.souls = []; this.hands = []; this.freed = 0; this.pull = 0; this.exposed = 0; this.sub = false; this.trail = []; this.out = []; this.boil = 0; this.hauling = 0; this.castNow = this.handsNow = this.burstNow = false; this.oneMoreAt = -99; this.y = 0; this.cut.clear(); }
  private say(e: string, x = this.x, z = this.z, n = 0) { this.out.push({ e, x, z, n }); }

  get hx() { return this.x; } get hz() { return this.z; }
  get hr() { return this.r; }
  get hanging() { return false; } get airborne() { return this.y > 1.2 || this.sub; }
  get strikes() { return A[this.mode] ?? []; }
  get committed() { const s = this.strikes; return s.length > 0 && this.mt < s[s.length - 1].t[1]; }
  get helpless() { return this.mode === 'kneel' || this.mode === 'snap' || this.mode === 'fall' || this.mode === 'reel' || this.mode === 'reel2'; }
  get attacking() { return this.strikes.length > 0; }
  get vulnerable() { return (!this.sub || this.boil > 0) && this.mode !== 'riseW' && this.mode !== 'die2'; }
  get dmgMul() { return (this.exposed > 0 ? this.bonus : 1) * (this.boil > 0 ? 1.25 : 1); }
  get hp(): [number, number] { return [D.boss.hp1 - 100, D.boss.hp2 + 300]; }
  get reelMode() { return this.form === 2 ? 'reel2' : 'reel'; } get kneelMode() { return 'kneel'; } get downMode() { return 'fall'; } get dieMode() { return 'die2'; } get reeling() { return this.mode === 'reel' || this.mode === 'reel2'; } get holdKneel() { return 1.6; } get holdDie() { return 6.4; }
  get tauts() { return !!this.chain; }
  break() { const y = this.y; this.sub = false; this.set(this.reelMode); this.y = y; }
  turn(step: number, to: number) { const d = wrap(to - this.yaw); this.yaw += Math.max(-step, Math.min(step, d)); return d; }

  covers(q: Strike, px: number, pz: number, r = 0.3) {
    const dx = px - this.x, dz = pz - this.z, fw = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw), sd = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
    if (q.box) return fw > -0.4 && fw < q.box[0] + r && Math.abs(sd) < q.box[1] + r;
    if (q.arc) { const d = Math.hypot(dx, dz); return d < q.arc[0] + r && d > (q.inner ?? 0) && (q.arc[1] >= 180 || Math.abs(Math.atan2(sd, fw)) * 57.3 < q.arc[1]); }
    return false;
  }

  step(dt: number, px: number, pz: number) {
    this.px = px; this.pz = pz; const s = this.strikes, m = this.mode, d = dt * this.pace * (s.length && this.mt < s[0].t[0] ? this.rate : 1);
    this.prev = this.mt; this.mt += d; this.ended = null; this.cues = s.filter(q => q.cue > this.prev && q.cue <= this.mt); this.live = s.filter(q => this.mt >= q.t[0] && this.prev <= q.t[1]);
    const dx = px - this.x, dz = pz - this.z, dist = Math.hypot(dx, dz), face = Math.atan2(dx, dz); this.speed = 0; this.vx = this.vz = 0;
    this.exposed = Math.max(0, this.exposed - dt); this.boil = Math.max(0, this.boil - dt); if (this.dark > 0 && (this.dark -= dt) <= 0) { this.dark = 0; this.say('relight'); }
    if (this.chain && (this.chain.t += dt) > 9 && !(m === 'haulIn')) { this.say('chainGone', this.chain.x, this.chain.z); this.chain = null; }
    this.ferry(dt, m, dist, face, dx, dz);
    this.x += this.vx * dt; this.z += this.vz * dt; const R = Math.hypot(this.x, this.z); if (R > REACH) { this.x *= REACH / R; this.z *= REACH / R; }
    const L = this.trail[0]; if (!L || Math.hypot(L.x - this.x, L.z - this.z) > 0.25) { this.trail.unshift({ x: this.x, z: this.z }); if (this.trail.length > 160) this.trail.length = 160; }
  }
  private end(m: string) { this.ended = m; this.set('idle'); }
  /** The first turn is its own: slowed while it holds the chain taut. */
  private ferry(dt: number, m: string, dist: number, face: number, dx: number, dz: number) {
    const taut = this.tauts, near = D.boss.near + 0.4;
    const fast = this.form === 2 ? 1.9 : 1;
    if (m === 'stalk') { const k = (this.mt * 0.7) % 1, b = this.form === 2 ? 1 : k < 0.2 ? 0.25 : 1; this.burst = b; this.speed = taut ? 0 : dist > near - 0.2 ? 2.7 * b * fast : 0; this.turn((taut ? 0.4 : 1.4) * fast * dt, face); this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed; }
    else if (m === 'strafe') { if ((this.sideT -= dt) < 0) { this.sideT = 1.4 + (this.serial % 3) * 0.4; this.side = -this.side; } const sp = taut ? 0 : 1.5 * fast, rad = taut ? 0 : Math.max(-1.6, Math.min(1.8, (dist - (near + 0.8)) * 1.3)); this.speed = sp; this.burst = 0.5; this.vx = Math.cos(face) * sp * this.side + Math.sin(face) * rad; this.vz = -Math.sin(face) * sp * this.side + Math.cos(face) * rad; this.turn((taut ? 0.5 : 2.6) * dt, face); }
    else if (m === 'idle') this.turn((taut ? 0.4 : 1.3) * fast * dt, face);
    else if (m in C) {
      const c = C[m], g = moveAt(c, this.mt), want = g - this.moved, st = want > 0 ? Math.min(want, Math.max(0, dist - 1.7)) : want; this.moved = g; this.x += Math.sin(this.yaw) * st; this.z += Math.cos(this.yaw) * st; const s = this.strikes, mt = this.mt, p = this.prev;
      if (m === 'pushOff' || m === 'vault') {
        if (p < s[0].cue && mt >= s[0].cue) { const go = Math.min(14, dist) + 2.2; this.mark = { x: this.x + dx / (dist || 1) * go, z: this.z + dz / (dist || 1) * go }; const R = Math.hypot(this.mark.x, this.mark.z); if (R > 17.5) { this.mark.x *= 17.5 / R; this.mark.z *= 17.5 / R; } }
        const lift = m === 'vault' ? 0.66 : 0.84; if (mt < lift) { this.from = { x: this.x, z: this.z }; this.turn(5 * dt, mt > s[0].cue ? Math.atan2(this.mark.x - this.x, this.mark.z - this.z) : face); }
        else { const u = Math.min(1, (mt - lift) / (m === 'vault' ? 0.78 : 0.8)), e = u * u * (3 - 2 * u) * 0.6 + u * 0.4; this.x = this.from.x + (this.mark.x - this.from.x) * e; this.z = this.from.z + (this.mark.z - this.from.z) * e; this.y = u < 1 ? Math.sin(Math.PI * Math.pow(u, 0.8)) * (m === 'vault' ? 2.8 : 3.6) : 0; }
      } else if (m === 'haul' || m === 'reel' || m === 'snap' || m === 'kneel' || m === 'fall' || m === 'cradle') { /* held */ }
      else if (m in LOCK) { if (mt < LOCK[m]) this.turn((taut ? 1.0 : 3.2) * dt, face); }
      else { const next = s.find(q => q.t[0] > mt); if (next && mt < next.t[0] - 0.2) this.turn(2.2 * fast * dt, face); else if (!s.length && mt < 1.2) this.turn(1.6 * dt, face); }
      if (m === 'cast' && p < 1.06 && mt >= 1.06) this.castNow = true;
      if (m === 'gather' && p < 1.0 && mt >= 1.0) { this.dark = 9.5; this.say('dark'); }
      if (m === 'wrongShore') { if (p < 1.2 && mt >= 1.2) this.conjure(); if (p < s[0].t[0] && mt >= s[0].t[0]) this.burstNow = true; }
      if (m === 'lamps' && mt > 1.0 && mt < 4.6) { this.spin += 1.6 * dt; this.coinAcc += 7 * dt; while (this.coinAcc >= 1) { this.coinAcc -= 1; const k = this.serial + Math.floor(mt * 7), a = Math.atan2(this.px - this.x, this.pz - this.z) + [-0.34, -0.12, 0.12, 0.34][k % 4] + Math.sin(mt * 3) * 0.08, sp = 6.4 + (k % 3) * 0.5; this.coins.push({ x: this.x + Math.sin(a) * 1.6, z: this.z + Math.cos(a) * 1.6, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, life: 4, back: false }); } }
      if (mt >= c.dur) { if (m === 'wrongShore') this.lanterns = []; if (m === 'lamps' && this.form === 2) this.offer('lantern'); this.end(m); }
    }
  }
  /** The grab connected (the drag's line): the boss takes the hero into a staged moment. It always plays out and always costs. */
  seize(kind: string, f: Fight) {
    this.stage = this.sp = 0; this.grabbedOnce = true; this.held = 'drag'; f.brain.seen.add('dragDeep');
    f.invuln = Math.max(f.invuln, 0.15);
  }
  /** A reward is on offer for a while (the chain cut, or the lamps gone out). */
  offer(kind: 'chain' | 'lantern') { if (!this.held && !this.rite) { this.reward = kind; this.rewardLeft = RIVER_OFFER; } }
  /** The hero took the offered reward: the scene plays, and the blow lands at its own moment. */
  takeReward(): 'chain' | 'lantern' | null {
    const r = this.reward; if (!r) return null; this.reward = null; this.rewardLeft = 0; this.stage = this.sp = 0;
    if (r === 'chain') this.set('snap'); else this.set('kneel');
    this.rite = r; return r;
  }
  /** A fresh start: no moment is playing and no reward is on offer. */
  clearMoments() { this.held = null; this.rite = null; this.reward = null; this.rewardLeft = 0; this.stage = this.sp = 0; }
  /** Which staged moment is playing, if any (the page stages the camera and the hero for it). */
  get staging(): 'drag' | 'chain' | 'lantern' | null { return this.held ?? this.rite; }
  /** Runs the moments' timings and what they do to the hero and the boss. Called once a step, after everything else has moved. */
  private tickMoments(f: Fight, dt: number) {
    const m = f.m, cross = (a: number) => this.sp < a && this.stage >= a;
    if (this.reward && (this.rewardLeft -= dt) <= 0) { this.reward = null; this.rewardLeft = 0; }
    if (this.held || this.rite) this.stage += dt * this.pace;
    const pool = f.round === 2 ? D.boss.hp2 : D.boss.hp1;
    if (this.held === 'drag') {
      f.invuln = Math.max(f.invuln, 0.15);
      if (this.stage < DRAG.heave) { m.x = this.x + Math.sin(this.yaw) * 1.6; m.z = this.z + Math.cos(this.yaw) * 1.6; }
      if (cross(DRAG.dmg)) { f.invuln = 0; f.strikePlayer(GRAB_DRAG.drag, true, Math.atan2(this.x - m.x, this.z - m.z), 'dragDeep'); }
      if (this.stage >= DRAG.end) this.held = null;
    }
    if (this.rite === 'chain') { if (cross(CHAIN.hit)) f.damage(Math.round(pool * RIVER_REWARD_SHARE), 3.4, true, 0.2, 'blade', 'heavy'); if (this.stage >= CHAIN.len) this.rite = null; }
    else if (this.rite === 'lantern') { if (cross(LANTERN.hit)) f.damage(Math.round(pool * RIVER_REWARD_SHARE), 3.4, true, 0.2, 'blade', 'heavy'); if (this.stage >= LANTERN.len) this.rite = null; }
    this.sp = this.stage;
  }
  /** Three lanterns round the player; one is real. */
  private conjure() {
    const real = Math.floor(((this.serial * 7919) % 97) / 97 * 3), a0 = Math.atan2(this.x - this.px, this.z - this.pz); this.lanterns = [0, 1, 2].map(i => { const a = a0 + (i - 1) * 0.95 + (i === 1 ? 0.1 : 0), R = 3.6 + ((i * 1.7 + this.serial) % 2.2), x = this.px + Math.sin(a) * R, z = this.pz + Math.cos(a) * R, q = Math.hypot(x, z), k = q > 16.5 ? 16.5 / q : 1; return { x: x * k, z: z * k, real: i === real, t: 0, gone: 0 }; });
    this.say('lanterns');
  }
  /** Whatever the blade passes through, this step: returns true once per swing per thing. */
  private touch(f: Fight, key: string, x: number, z: number, pad = 0.4, aimed = false) {
    const m = f.m; for (const w of f.swings()) {
      const id = w.id + '/' + key; if (this.cut.has(id)) continue; const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz); if (d > w.reach + pad) continue;
      let a = Math.atan2(dx, dz) - m.yaw; a -= Math.round(a / 6.2832) * 6.2832; if (aimed && Math.abs(a) * 57.3 > w.arc && d > 0.5) continue; this.cut.add(id); if (this.cut.size > 160) this.cut = new Set([...this.cut].slice(-60)); return true;
    }
    return false;
  }
  /** A blow that lands, unless you are in the air, dodging, or already hurt. */
  private strike(f: Fight, dmg: number, down: boolean, sx: number, sz: number, tag: string): 'over' | 'safe' | 'hit' | 'inv' {
    const m = f.m; if (m.over) return 'over'; if (m.safe > 0 || m.clip?.name === 'rush') return 'safe'; if (f.invuln > 0 || m.dead) return 'inv';
    f.strikePlayer(dmg, down, Math.atan2(sx - m.x, sz - m.z), tag); return 'hit';
  }

  tick(f: Fight, dt: number) {
    const m = f.m; for (const o of this.out) f.raise({ k: 'b', ...o }); this.out.length = 0;
    // --- you jumped something
    if (f.leapT !== this.seenLeap && f.time - f.leapT < 0.2) { this.seenLeap = f.leapT; if (this.mode === 'wake' || this.mode === 'breach') this.jumped = true; if (this.form === 1 && this.mode === 'lowWater' && this.mt > 0.8 && this.mt < 1.6) { this.exposed = 2.4; this.bonus = 1.7; f.raise({ k: 'b', e: 'pole', x: this.x, z: this.z }); this.set('reel'); f.brain.broken(); } }
    if (f.ev.some(e => e.k === 'rites')) this.boil = 6;
    if (this.form === 1) this.tickFerry(f, dt, m); else this.tickWeight(f, dt, m); this.tickRing(f, dt, m);
    if (f.ev.some(e => e.k === 'break') && this.mode === 'reel') this.exposed = Math.max(this.exposed, 1.2);
    this.tickMoments(f, dt);
  }
  private tickFerry(f: Fight, dt: number, m: Fight['m']) {
    const ch = this.chain;
    // the cast bites: it either catches you or stays taut
    if (this.castNow) {
      this.castNow = false; const len = 10.5, sx = Math.sin(this.yaw), sz = Math.cos(this.yaw), dx = m.x - this.x, dz = m.z - this.z, fw = dx * sx + dz * sz, sd = Math.abs(dx * sz - dz * sx);
      let ax = this.x + sx * len, az = this.z + sz * len; const R = Math.hypot(ax, az); if (R > 17.6) { ax *= 17.6 / R; az *= 17.6 / R; }
      const on = fw > -0.5 && fw < len && sd < 1.25, r = on ? (m.over ? 'over' : m.safe > 0 || m.clip?.name === 'rush' ? 'safe' : f.invuln > 0 ? 'inv' : 'hit') : 'miss';
      if (r === 'over') f.leapt(); else if (r === 'safe') f.evade();
      if (r === 'hit') { f.hp = Math.max(1, f.hp - 9); f.taken++; f.raise({ k: 'hurt', dmg: 9, down: false }); this.hauling = 1.1; this.set('haul'); this.chain = null; this.exposed = 3.6; this.bonus = 1.5; f.raise({ k: 'b', e: 'haul', x: m.x, z: m.z }); f.brain.broken(); }
      else { this.chain = { x: ax, z: az, len: Math.hypot(ax - this.x, az - this.z), hp: 3, t: 0, cut: 0 }; f.raise({ k: 'b', e: 'bite', x: ax, z: az }); }
    }
    if (this.hauling > 0) { this.hauling -= dt; const dx = this.x - m.x, dz = this.z - m.z, d = Math.hypot(dx, dz); if (d > 2.3) { const s = Math.min(d - 2.3, 17 * dt); m.x += dx / d * s; m.z += dz / d * s; } else { this.hauling = 0; m.reckoning = 1.8; f.raise({ k: 'b', e: 'arrive' }); } }
    // the taut chain can be cut
    if (ch && !this.castNow && this.touchLine(f, ch)) {
      ch.hp--; ch.cut++; f.stop = Math.max(f.stop, 0.05); f.fire = Math.min(D.fireMax, f.fire + 2); f.raise({ k: 'b', e: 'cut', n: ch.hp, x: ch.x, z: ch.z });
      if (ch.hp <= 0) { this.lastAnchor = { x: ch.x, z: ch.z }; this.offer('chain'); this.chain = null; this.set('snap'); this.exposed = 4.4; this.bonus = 1.45; f.brain.broken(); f.raise({ k: 'b', e: 'snap', x: this.x, z: this.z }); }
    }
    // a wide strike of the anchor along the chain's own line is dodged like any other; spells and the rush clear patches of hands
    // the drowned reach for you: under your feet, then across the way you are going, then all round you, closing
    if (this.mode === 'coldHands') {
      const sp = Math.hypot(m.vx, m.vz), dir = sp > 0.5 ? { x: m.vx / sp, z: m.vz / sp } : { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }, inR = (x: number, z: number) => { const q = Math.hypot(x, z), k = q > 17 ? 17 / q : 1; return { x: x * k, z: z * k }; };
      const grab = (x: number, z: number, delay: number) => { const p = inR(x, z); this.hands.push(f.addZone({ shape: 'circle', x: p.x, z: p.z, r: 1.3, delay, dmg: 10, down: false, mode: 'coldHands' })); };
      const lead = Math.min(2.4, sp * 0.8), mt = this.mt, pv = this.prev;
      if (pv < 1.0 && mt >= 1.0) { grab(m.x, m.z, 1.0); grab(m.x + dir.x * (1.4 + lead), m.z + dir.z * (1.4 + lead), 1.15); f.raise({ k: 'b', e: 'hands' }); }
      if (pv < 2.0 && mt >= 2.0) { grab(m.x + dir.x * lead, m.z + dir.z * lead, 0.9); grab(m.x + dir.z * 2.1, m.z - dir.x * 2.1, 1.0); grab(m.x - dir.z * 2.1, m.z + dir.x * 2.1, 1.0); f.raise({ k: 'b', e: 'hands' }); }
      if (pv < 2.9 && mt >= 2.9 && !this.ring) { const p = inR(m.x, m.z); this.ring = { x: p.x, z: p.z, R: 4.4, arms: Array.from({ length: 16 }, () => true), hit: false, t: 0 }; f.raise({ k: 'b', e: 'hands' }); }
    }
    this.hands = this.hands.filter(h => h.t < h.delay + 0.5 && h.max !== -1);
    if (this.mode === 'coldHands') for (const h of f.hazards) if (h.mode === 'coldHands' && h.t < h.delay && h.max !== -1) {
      if (f.shots.some(s => Math.hypot(s.x - h.x, s.z - h.z) < s.r + h.r + 0.4) || (m.clip?.name === 'rush' && Math.hypot(m.x - h.x, m.z - h.z) < h.r + 1.3)) { h.max = -1; f.raise({ k: 'b', e: 'burn', x: h.x, z: h.z }); }
    }
    // three lanterns; one moves the water
    if (this.lanterns.length) {
      for (const l of this.lanterns) { l.t += dt; if (l.gone > 0) { l.gone += dt; continue; } if (this.touch(f, 'L' + this.lanterns.indexOf(l), l.x, l.z, 0.7)) {
        if (l.real) { this.lanterns.forEach(q => { q.gone = 0.01; }); this.dark = 0; this.say('relight'); this.set('snap'); this.exposed = 3.8; this.bonus = 1.4; f.brain.broken(); f.raise({ k: 'b', e: 'real', x: l.x, z: l.z }); f.stop = Math.max(f.stop, 0.1); f.fire = Math.min(D.fireMax, f.fire + 12); break; }
        else { l.gone = 0.01; f.raise({ k: 'b', e: 'fake', x: l.x, z: l.z }); }
      } }
      this.lanterns = this.lanterns.filter(l => l.gone < 0.5);
      if (this.burstNow) { this.burstNow = false; for (const l of this.lanterns) f.addZone({ shape: 'circle', x: l.x, z: l.z, r: 2.3, delay: 0.8, dmg: 16, down: true, mode: 'wrongShore' }); f.raise({ k: 'b', e: 'lanternsBurst' }); }
    } else this.burstNow = false;
  }
  private touchLine(f: Fight, c: Chain) {
    const m = f.m, ax = this.x, az = this.z, vx = c.x - ax, vz = c.z - az, L = vx * vx + vz * vz || 1, u = Math.max(0.08, Math.min(1, ((m.x - ax) * vx + (m.z - az) * vz) / L));
    return this.touch(f, 'chain', ax + vx * u, az + vz * u, 0.55);
  }
  /** The closing ring of drowned arms: cut one and that place in it is open; jump or dodge through, or be held. */
  private tickRing(f: Fight, dt: number, m: Fight['m']) {
    // the closing ring of arms
    const r = this.ring; if (r) {
      r.t += dt; r.R = Math.max(1.0, r.R - 2.9 * dt); const N = r.arms.length;
      for (let i = 0; i < N; i++) if (r.arms[i] && this.touch(f, 'a' + i + '/' + Math.round(r.R * 2), r.x + Math.sin(i / N * 6.283) * r.R, r.z + Math.cos(i / N * 6.283) * r.R, 0.7)) { r.arms[i] = false; f.fire = Math.min(D.fireMax, f.fire + 1.5); f.raise({ k: 'b', e: 'arm', n: i, x: r.x, z: r.z }); }
      const dx = m.x - r.x, dz = m.z - r.z, d = Math.hypot(dx, dz);
      if (!r.hit && !m.dead && Math.abs(d - r.R) < 0.55) { const i = (Math.round(Math.atan2(dx, dz) / 6.283 * N) + N) % N; if (r.arms[i]) { if (m.over) { r.hit = true; f.leapt(); } else if (m.safe > 0) { r.hit = true; f.evade(); } else if (f.invuln <= 0) { r.hit = true; this.strike(f, 15, true, r.x + Math.sin(i / N * 6.283) * r.R, r.z + Math.cos(i / N * 6.283) * r.R, 'holdOn'); } } }
      if (r.R <= 1.0 && !r.hit) { r.hit = true; f.raise({ k: 'b', e: 'clench', x: r.x, z: r.z }); if (d < 1.7 && !m.over && !m.safe) this.strike(f, 18, true, r.x, r.z, 'holdOn'); }
      if (r.R <= 1.0 && r.t > 4.5) this.ring = null;
    }
  }
  private tickWeight(f: Fight, dt: number, m: Fight['m']) {
    // coins: spat in spirals; your blade turns them back
    for (const c of this.coins) {
      c.life -= dt; c.x += c.vx * dt; c.z += c.vz * dt;
      if (!c.back) {
        if (this.touch(f, 'c' + Math.round(c.x * 7) + '/' + Math.round(c.z * 7), c.x, c.z, 0.35, true)) { c.back = true; const dx = this.x - c.x, dz = this.z - c.z, d = Math.hypot(dx, dz) || 1; c.vx = dx / d * 12.5; c.vz = dz / d * 12.5; c.life = 2; f.raise({ k: 'b', e: 'turn', x: c.x, z: c.z }); continue; }
        if (Math.hypot(c.x - m.x, c.z - m.z) < 0.55 && !m.dead) { if (m.safe > 0) continue; if (m.over) { continue; } if (f.invuln <= 0) { c.life = 0; this.strike(f, 6, false, c.x, c.z, 'coins'); f.raise({ k: 'b', e: 'coinHit', x: c.x, z: c.z }); } }
      } else if (this.vulnerable && Math.hypot(c.x - this.x, c.z - this.z) < this.hr + 0.3) { c.life = 0; f.fire = Math.min(D.fireMax, f.fire + 1.4); f.damage(15, 0.7, false, 0.03, 'fire'); f.raise({ k: 'b', e: 'coinBack', x: c.x, z: c.z }); }
    }
    this.coins = this.coins.filter(c => c.life > 0 && Math.hypot(c.x, c.z) < 24);
    // the tide
    if (this.mode === 'tide' && this.mt >= 0.6 && this.prev < 0.6) { const yaw = Math.atan2(m.x - this.x, m.z - this.z); f.addZone({ shape: 'line', x: this.x, z: this.z, yaw, len: 32, half: 16, delay: 0.95, visual: true, mode: 'tide' }); }
    const w = this.wave; if (w) {
      w.d += w.speed * dt; const sx = Math.sin(w.yaw), sz = Math.cos(w.yaw);
      for (const s of f.shots) if (s.big) { const dx = s.x - w.x, dz = s.z - w.z, fw = dx * sx + dz * sz; if (Math.abs(fw - w.d) < 1.6) { const sd = dx * sz - dz * sx; if (!w.gaps.some(g => Math.abs(g.s - sd) < 1)) { w.gaps.push({ s: sd, w: 3.4 }); f.raise({ k: 'b', e: 'open', x: s.x, z: s.z }); } } }
      const dx = m.x - w.x, dz = m.z - w.z, fw = dx * sx + dz * sz, sd = dx * sz - dz * sx;
      if (!w.hit && Math.abs(fw - w.d) < 0.9 && Math.abs(sd) < w.half && !m.dead) {
        if (w.gaps.some(g => Math.abs(g.s - sd) < g.w / 2)) { /* through the door */ } else if (m.over) { w.hit = true; f.leapt(); } else if (m.safe > 0) { w.hit = true; f.evade(); } else if (f.invuln <= 0) { w.hit = true; this.strike(f, 17, true, w.x + sx * w.d, w.z + sz * w.d, 'tide'); }
      }
      if (w.d > 36) this.wave = null;
    }
    // the undertow: everything loose goes toward it
    if (this.pull > 0.01) { const dx = this.x - m.x, dz = this.z - m.z, d = Math.hypot(dx, dz); if (d > 3) { const s = 2.5 * this.pull * dt; m.x += dx / d * s; m.z += dz / d * s; } }
    // the dead: cut one and it lets go
    for (const s of this.souls) {
      s.t += dt; if (s.freed > 0) { s.freed += dt; continue; } const dx = m.x - s.x, dz = m.z - s.z, d = Math.hypot(dx, dz); if (d > 0.9) { s.x += dx / d * 1.6 * dt; s.z += dz / d * 1.6 * dt; }
      if (this.touch(f, 's' + this.souls.indexOf(s), s.x, s.z, 0.6)) { s.freed = 0.01; this.freed++; f.fire = Math.min(D.fireMax, f.fire + 8); f.raise({ k: 'b', e: 'free', n: this.freed, x: s.x, z: s.z }); }
    }
    this.souls = this.souls.filter(s => s.freed < 1.6);
  }
  /** How much of the river is lit by the dead let go. */
  get lit() { return Math.min(1, this.freed / 10); }
  /** Where to find nearby ground to land on, for scenes. */
  get isBreach() { return this.mode === 'breach'; } get oneMoreSerial() { return this.oneMoreAt; }
}
