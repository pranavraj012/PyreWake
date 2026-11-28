// The third boss's simulation: the Sister of Hours (form 1) and the Pall (form 2). Runs headless; her own mechanics (the count, the linen, the stake) resolve in tick().
import { moveAt } from '../../anim/pose.ts';
import type { Boss } from '../../boss/boss.ts';
import type { Strike } from '../../boss/strike.ts';
import type { Fight } from '../../combat/fight.ts';
import { HOURS_CLIPS as C } from './clips.ts';
import { HOURS_ATTACKS as A } from './moves.ts';
import { PALL_HEM } from './frame.ts';

export const DIAL = 17.5;
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
const QUIET = ['sit', 'idle', 'stalk', 'strafe', 'blink', 'grip', 'pierced', 'reel', 'reel2', 'kneel', 'fall', 'rise', 'die', 'lostCount', 'burnt', 'sag'];
/** A move rather than footwork or a wound. */
export const isMove = (m: string) => m in C && !QUIET.includes(m);
/** Where the turn stops, so the line drawn at the cue is where it lands. */
const LOCK: Record<string, number> = { reap: 0.75, binding: 0.35, lieDown: 0.9, wardStands: 0.35, hourHand: 0.4, gather: 0.75 };
/** How many blows (a spell is two) break a count, by form. */
export const BREAK = [3, 4] as const;
const COUNT = ['sevenBreaths', 'longCount'];

export interface Strip { x: number; z: number; yaw: number; len: number; t: number }
export interface Stake { x: number; z: number; hp: number; t: number }
export interface Out { e: string; x?: number; z?: number; n?: number }
/** A linen arm lying on the floor where it struck: it can be cut while it lies there. */
export interface Laid { x: number; z: number; yaw: number; len: number; t: number; arm: number }
/** The Weight of Hours, once she has you: lifted to her face, hurled up, slammed down. When it lands, and what it costs. */
export const GRIP = { throw: 2.4, top: 3.15, impact: 3.5, len: 4.6, dmg: 46 };
const ease = (a: number, b: number, t: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** How high she holds the hero at her clock t (the view draws him there, the page puts the camera on him). */
export function gripLift(t: number) { if (t < GRIP.throw) return 2.1 * ease(0, 0.6, t) + 0.12 * Math.sin(t * 5) * ease(0.6, 1, t); if (t < GRIP.top) return 2.1 + 5.6 * (1 - (1 - (t - GRIP.throw) / (GRIP.top - GRIP.throw)) ** 2); if (t < GRIP.impact) return 7.7 * (1 - ((t - GRIP.top) / (GRIP.impact - GRIP.top)) ** 2); return 0; }
/** Head over heels as he goes up and comes down. */
export function gripTumble(t: number) { return t > GRIP.throw && t < GRIP.impact ? -(t - GRIP.throw) * 5.2 : 0; }
/** The finishing climb, when two arms cut have put her on her knees: the hero runs up her and cuts her across the face. */
export const PIERCE = { window: 1.8, hit: 1.55, len: 3.0, dmg: 340 };

export class Sister implements Boss {
  x = 0; z = -4; y = 0; yaw = 0; vx = 0; vz = 0; speed = 0; mode = 'idle'; mt = 0; prev = 0; burst = 0; form: 1 | 2 = 1; rate = 1; pace = 1; serial = 0;
  cues: Strike[] = []; live: Strike[] = []; ended: string | null = null; armed = true; crawling = false; ht = 0; th = 0; dir = 0; mark = { x: 0, z: 0 };
  // --- her own mechanics
  /** Blows taken during this count. */ counted = 0; /** Embers left in the count, 7 to 0. */ embers = 7; /** Linen strips lying on the floor. */ strips: Strip[] = []; /** The scythe planted by Noon. */ stake: Stake | null = null;
  /** Seconds her hem burns. */ lit = 0; /** Seconds she takes extra, and by how much. */ exposed = 0; bonus = 1.25; /** Inside the smoke: cannot be hit. */ hidden = false; /** Where she will come out of the smoke. */ whorl: { x: number; z: number } | null = null;
  /** Counts she has finished in round 2: each lowers the sun and lengthens the Hour Hand. */ sunk = 0; /** Seconds the hero has stood at her hem. */ hugT = 0; out: Out[] = [];
  /** Where the smoke will give her back, behind or beside you. */
  private beyond(ahead: number, side: number) { const ux = this.px - this.x, uz = this.pz - this.z, l = Math.hypot(ux, uz) || 1, q = { x: this.px + (ux * ahead + uz * side) / l, z: this.pz + (uz * ahead - ux * side) / l }, R = Math.hypot(q.x, q.z); if (R > DIAL - 1) { q.x *= (DIAL - 1) / R; q.z *= (DIAL - 1) / R; } return q; }
  private moved = 0; private side = 1; private sideT = 0; private from = { x: 0, z: 0 }; private cut = new Set<string>(); private px = 0; private pz = 5; private burnedAt = -9;

  /** Arms lying on the floor; seconds since each of the six was cut (negative: whole); arms cut since she last staggered. */ laid: Laid[] = []; severed = [-1, -1, -1, -1, -1, -1]; private cuts = 0;
  /** Grabs made this fight: the first Gathering of the Pall always catches (the scripted first grab). */ grabs = 0;
  /** Seconds left in which the hero can climb her (she is on her knees from two arms cut). */ open = 0;
  get r() { return this.form === 2 ? 1.4 : 0.85; }
  set(mode: string, rate = 1) { this.mode = mode; this.mt = this.prev = 0; this.moved = 0; this.rate = rate; this.serial++; this.y = 0; this.counted = 0; if (COUNT.includes(mode)) this.embers = 7; this.hidden = false; this.whorl = null; }
  reset() { this.grabs = 0; this.laid = []; this.severed = [-1, -1, -1, -1, -1, -1]; this.cuts = 0; this.open = 0; this.counted = 0; this.embers = 7; this.strips = []; this.stake = null; this.lit = 0; this.exposed = 0; this.hidden = false; this.whorl = null; this.sunk = 0; this.hugT = 0; this.out = []; this.y = 0; this.cut.clear(); }
  private say(e: string, x = this.x, z = this.z, n = 0) { this.out.push({ e, x, z, n }); }

  get hx() { return this.x; } get hz() { return this.z; } /** What a blow reaches: the drawn hem for the Pall, her frame's radius for the Sister. Her movement keeps using r. */ get hr() { return this.form === 2 ? PALL_HEM : this.r; }
  get hanging() { return false; } get airborne() { return this.y > 1.2; }
  get strikes(): Strike[] {
    const s = A[this.mode] ?? []; if (this.mode !== 'hourHand' || !this.sunk) return s;
    return s.map(q => ({ ...q, zones: q.zones?.map(z => ({ ...z, len: (z.len ?? 0) + Math.min(4, this.sunk * 2) })) }));
  }
  get committed() { const s = this.strikes; return s.length > 0 && this.mt < s[s.length - 1].t[1]; }
  get helpless() { return ['kneel', 'fall', 'reel', 'reel2', 'lostCount', 'sag', 'burnt', 'pierced'].includes(this.mode); }
  get attacking() { return this.strikes.length > 0; }
  get vulnerable() { return !this.hidden && this.mode !== 'rise' && this.mode !== 'die'; }
  get dmgMul() { return this.exposed > 0 ? this.bonus : 1; }
  get hp(): [number, number] { return [4300, 3900]; }
  get reelMode() { return this.form === 2 ? 'reel2' : 'reel'; } get kneelMode() { return 'kneel'; } get downMode() { return 'fall'; } get dieMode() { return 'die'; } get reeling() { return this.mode === 'reel' || this.mode === 'reel2'; } get holdKneel() { return 1.6; } get holdDie() { return 6.4; }
  /** Counting now: the window in which blows break it. */ get counting() { return COUNT.includes(this.mode) && this.mt > 0.6 && this.mt < 6.0; }
  break() { this.set(this.reelMode); }
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
    this.exposed = Math.max(0, this.exposed - dt); this.lit = Math.max(0, this.lit - dt);
    this.hugT = this.form === 2 && dist < this.r + 1.5 ? this.hugT + dt : Math.max(0, this.hugT - dt * 2);
    if (COUNT.includes(m)) this.embers = this.mt < 0.6 ? 7 : Math.max(0, 6 - Math.floor((this.mt - 0.6) / 0.77));
    this.move(dt, m, dist, face, dx, dz);
    this.x += this.vx * dt; this.z += this.vz * dt; const R = Math.hypot(this.x, this.z); if (R > DIAL) { this.x *= DIAL / R; this.z *= DIAL / R; }
  }
  private end(m: string) { this.ended = m; this.set('idle'); }
  private move(dt: number, m: string, dist: number, face: number, dx: number, dz: number) {
    const near = this.form === 2 ? 4.2 : 3.4, sp = this.form === 2 ? 2.1 : 2.6;
    if (m === 'stalk') { this.burst = 1; this.speed = dist > near - 0.2 ? sp : 0; this.turn(1.6 * dt, face); this.vx = Math.sin(this.yaw) * this.speed; this.vz = Math.cos(this.yaw) * this.speed; }
    else if (m === 'strafe') { if ((this.sideT -= dt) < 0) { this.sideT = 1.4 + (this.serial % 3) * 0.4; this.side = -this.side; } const v = 1.4, rad = Math.max(-1.6, Math.min(1.8, (dist - (near + 0.8)) * 1.3)); this.speed = v; this.burst = 0.5; this.vx = Math.cos(face) * v * this.side + Math.sin(face) * rad; this.vz = -Math.sin(face) * v * this.side + Math.cos(face) * rad; this.turn(2.4 * dt, face); }
    else if (m === 'idle') this.turn(1.4 * dt, face);
    else if (m in C) {
      const c = C[m], s = this.strikes, mt = this.mt, p = this.prev;
      if (c.move) { const g = moveAt(c, mt), want = g - this.moved, st = want > 0 ? Math.min(want, Math.max(0, dist - 1.6)) : want; this.moved = g; this.x += Math.sin(this.yaw) * st; this.z += Math.cos(this.yaw) * st; }
      if (m === 'betweenBeds') {
        if (p < 0.3 && mt >= 0.3) { const a = Math.atan2(this.x - this.px, this.z - this.pz) + (this.serial % 2 ? 0.6 : -0.6), q = { x: this.px + Math.sin(a) * 4.2, z: this.pz + Math.cos(a) * 4.2 }, R = Math.hypot(q.x, q.z); if (R > DIAL - 1) { q.x *= (DIAL - 1) / R; q.z *= (DIAL - 1) / R; } this.whorl = q; this.say('whorl', q.x, q.z); }
        if (p < 0.4 && mt >= 0.4) { this.hidden = true; this.say('vanish'); }
        if (p < 1.4 && mt >= 1.4 && this.whorl) { this.x = this.whorl.x; this.z = this.whorl.z; this.yaw = Math.atan2(this.px - this.x, this.pz - this.z); this.hidden = false; this.whorl = null; this.say('emerge'); }
        if (mt > 1.4 && mt < 1.55) this.turn(4 * dt, face);
      } else if (m === 'harvest' || m === 'blink') {
        // into the smoke; out of it at your back (harvest) or a few strides off your shoulder (blink)
        const [w, v, o] = m === 'harvest' ? [0.3, 0.4, 1.2] : [0.15, 0.25, 0.75];
        if (p < w && mt >= w) { const q = m === 'harvest' ? this.beyond(2.7, 0) : this.beyond(-4.8, this.serial % 2 ? 2.0 : -2.0); this.whorl = q; this.say('whorl', q.x, q.z); }
        if (p < v && mt >= v) { this.hidden = true; this.say('vanish'); }
        if (p < o && mt >= o && this.whorl) { this.x = this.whorl.x; this.z = this.whorl.z; this.yaw = Math.atan2(this.px - this.x, this.pz - this.z); this.hidden = false; this.whorl = null; this.say('emerge'); }
        if (mt > o && mt < o + (m === 'harvest' ? 0.32 : 0.3)) this.turn(5 * dt, face);
      } else if (m === 'hourWheel') { if (mt < 0.8 || mt > 2.7) this.turn(2.4 * dt, face); else this.turn(0.9 * dt, face);
      } else if (m === 'drawSheet') {
        if (p < s[0].cue && mt >= s[0].cue) { this.mark = { x: this.px, z: this.pz }; this.from = { x: this.x, z: this.z }; }
        if (mt >= 0.9 && mt < 1.7) { const u = (mt - 0.9) / 0.8, e = u * u * (3 - 2 * u); this.x = this.from.x + (this.mark.x - this.from.x) * e; this.z = this.from.z + (this.mark.z - this.from.z) * e; this.y = Math.sin(Math.PI * u) * 4; }
        if (p < 1.75 && mt >= 1.75) { this.y = 0; this.exposed = 2.2; this.bonus = 1.5; this.say('flat'); }
      } else if (m === 'lastBreath') {
        if (mt < 0.45) this.turn(3 * dt, face - 0.9);
        for (const t of [1.27, 1.62, 1.97]) if (p < t && mt >= t) this.yaw += 0.61;
      } else if (m in LOCK) { if (mt < LOCK[m]) this.turn(3.2 * dt, face); if (m === 'reap' && mt > 1.3 && mt < 1.75) this.turn(4 * dt, face); }
      else { const next = s.find(q => q.t[0] > mt); if (next && mt < next.t[0] - 0.2) this.turn(2.4 * dt, face); else if (!s.length && mt < 0.8) this.turn(1.4 * dt, face); }
      if (mt >= c.dur && !['kneel', 'fall', 'die', 'sit'].includes(m)) this.end(m);
      void dx; void dz;
    }
  }

  /** A blow landed. While she counts it costs her the count; fire catches her hem, and fire on a lit hem staggers her. */
  struck(f: Fight, kind: 'blade' | 'fire') {
    if (this.counting) {
      this.counted += kind === 'fire' ? 2 : 1;
      if (this.counted >= BREAK[this.form - 1]) { const lost = this.form === 2 ? 'sag' : 'lostCount'; f.hazards = f.hazards.filter(h => !COUNT.includes(h.mode)); this.set(lost); this.exposed = this.form === 2 ? 3 : 2.6; this.bonus = this.form === 2 ? 1.5 : 1.25; if (this.form === 2) this.sunk = Math.max(0, this.sunk - 1); f.brain.broken(); this.say('lost'); }
      else this.say('miscount', this.x, this.z, this.counted);
      return;
    }
    if (kind === 'fire') { if (this.lit > 0 && f.time - this.burnedAt > 8 && this.form === 1 && !this.helpless) { this.burnedAt = f.time; this.set('burnt'); this.exposed = 2; this.bonus = 1.3; f.brain.broken(); this.say('hemBurn'); } else this.lit = 3; }
  }
  /** Something of hers the hero's blade can strike: once per swing. */
  private touch(f: Fight, key: string, x: number, z: number, pad = 0.4) {
    const m = f.m; for (const w of f.swings()) { const id = w.id + '/' + key; if (this.cut.has(id)) continue; if (Math.hypot(x - m.x, z - m.z) > w.reach + pad) continue; this.cut.add(id); if (this.cut.size > 160) this.cut = new Set([...this.cut].slice(-60)); return true; }
    return false;
  }
  private onStrip(x: number, z: number, pad: number) { return this.strips.some(s => { const dx = x - s.x, dz = z - s.z, fw = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), sd = Math.abs(dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw)); return fw > -0.3 && fw < s.len && sd < pad; }); }

  tick(f: Fight, dt: number) {
    const m = f.m, mt = this.mt, p = this.prev; for (const o of this.out) f.raise({ k: 'b', ...o }); this.out.length = 0;
    if (this.mode === 'longCount' && p < 6.0 && mt >= 6.0) { this.sunk = Math.min(2, this.sunk + 1); this.say('sunk', this.x, this.z, this.sunk); }
    // --- the linen: strips laid by Binding; any fire on one burns them all back to her
    if (this.mode === 'binding' && p < 1.15 && mt >= 1.15) this.strips = [-0.45, 0, 0.45].map(o => ({ x: this.x, z: this.z, yaw: this.yaw + o, len: 9, t: 0 }));
    for (const s of this.strips) s.t += dt; this.strips = this.strips.filter(s => s.t < 2.5);
    if (this.strips.length && (f.shots.some(s => this.onStrip(s.x, s.z, s.r + 0.6)) || (m.clip?.name === 'rush' && this.onStrip(m.x, m.z, 1.0)))) { this.strips = []; this.set('burnt'); this.exposed = 2.2; this.bonus = 1.3; f.brain.broken(); this.say('burnStrips'); }
    // the thrown sheet: Sunder Arc tears it in the air
    if (this.mode === 'cleanSheet') for (const h of f.hazards) if (h.mode === 'cleanSheet' && h.t < h.delay && f.shots.some(s => s.big && Math.hypot(s.x - h.x, s.z - h.z) < h.r + 1.2)) { h.max = -1; this.say('tear', h.x, h.z); }
    // --- Noon: the scythe stands where it fell, eight seconds; three blows shatter it
    if (this.mode === 'noon' && p < 1.5 && mt >= 1.5) { const h = f.hazards.find(q => q.mode === 'noon' && q.shape === 'circle'); this.stake = { x: h?.x ?? this.px, z: h?.z ?? this.pz, hp: 3, t: 0 }; }
    const st = this.stake; if (st) { st.t += dt; if (this.touch(f, 'stake', st.x, st.z, 0.6)) { st.hp--; this.say('stakeHit', st.x, st.z, st.hp); if (st.hp <= 0) { this.stake = null; this.say('stakeBreak', st.x, st.z); } } if (st.t > 8) this.stake = null; }
    // --- the Gathering: the arm goes out; it catches you or it lies on the floor
    if (this.mode === 'gather' && p < 0.95 && mt >= 0.95) {
      const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw), dx = m.x - this.x, dz = m.z - this.z, fw = dx * sx + dz * sz, sd = Math.abs(dx * sz - dz * sx), on = fw > -0.5 && fw < 11 && sd < 1.25;
      const r = this.grabs === 0 && this.form === 2 ? 'hit' : on ? (m.over ? 'over' : m.safe > 0 || m.clip?.name === 'rush' ? 'safe' : f.invuln > 0 ? 'inv' : 'hit') : 'miss';
      if (r === 'over') f.leapt(); else if (r === 'safe') f.evade();
      if (r === 'hit') { this.grabs++; this.set('grip'); this.say('grab', m.x, m.z); }
      else this.lay(1, 10);
    }
    if (this.mode === 'wardStands' && p < 1.3 && mt >= 1.3) [-0.8, -0.4, 0, 0.4, 0.8].forEach((o, i) => this.lay([0, 2, 1, 3, 4][i], 11, o));
    // --- the Weight of Hours: held at her face, hurled up, slammed down into the stone; then she lets you lie there a moment
    if (this.mode === 'grip') {
      const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
      if (mt < GRIP.impact) { m.x = this.x + sx * (this.r + 1.5); m.z = this.z + sz * (this.r + 1.5); f.invuln = Math.max(f.invuln, 0.15); }
      if (p < GRIP.throw && mt >= GRIP.throw) this.say('hurl', m.x, m.z);
      if (p < GRIP.impact && mt >= GRIP.impact) { f.invuln = 0; f.strikePlayer(GRIP.dmg, true, Math.atan2(this.x - m.x, this.z - m.z), 'gather'); this.say('slam', m.x, m.z); }
      if (mt >= GRIP.len) { this.set('idle'); this.say('released', m.x, m.z); }
    }
    // --- the climb: on her knees, the chance to run up her and cut her face
    this.open = this.mode === 'sag' ? Math.max(0, this.open - dt) : 0;
    if (this.mode === 'pierced') { f.invuln = Math.max(f.invuln, 0.2); if (p < PIERCE.hit && mt >= PIERCE.hit) { f.damage(PIERCE.dmg, 3.2, false, 0.2, 'blade', 'heavy'); this.say('pierce', this.x, this.z); } }
    // --- the arms on the floor: a blade through one cuts it; two cut and she staggers
    for (const l of this.laid) l.t += dt; this.laid = this.laid.filter(l => l.t < 3.2 && this.form === 2);
    for (let i = 0; i < 6; i++) if (this.severed[i] >= 0 && (this.severed[i] += dt) > 6) this.severed[i] = -1;
    for (const l of [...this.laid]) if (this.slash(f, 'arm' + l.arm + '/' + this.serial, l)) {
      this.laid = this.laid.filter(q => q !== l); this.severed[l.arm] = 0; this.cuts++; this.say('armCut', m.x, m.z, l.arm);
      if (this.cuts >= 2 && !this.helpless) { this.cuts = 0; this.set('sag'); this.exposed = 3; this.bonus = 1.5; this.open = PIERCE.window; f.brain.broken(); this.say('sever'); }
    }
  }
  /** The hero took the chance: she is pierced, and he is staged up her (the page plays it). */
  climb() { if (this.open <= 0) return false; this.open = 0; this.set('pierced'); this.exposed = 0; this.say('climb'); return true; }
  private lay(arm: number, len: number, o = 0) { if (this.severed[arm] < 0) this.laid.push({ x: this.x, z: this.z, yaw: this.yaw + o, len, t: 0, arm }); }
  /** Any of the hero's swings this frame passes close enough to a laid arm to cut it. */
  private slash(f: Fight, key: string, l: Laid) {
    const m = f.m, sx = Math.sin(l.yaw), sz = Math.cos(l.yaw), dx = m.x - l.x, dz = m.z - l.z, u = Math.max(this.r, Math.min(l.len, dx * sx + dz * sz)), d = Math.hypot(dx - sx * u, dz - sz * u);
    for (const w of f.swings()) { const id = w.id + '/' + key; if (this.cut.has(id) || d > w.reach + 0.5) continue; this.cut.add(id); return true; }
    return false;
  }
}
