// The referee: health, fire, hits, guard, parry, cues, ground danger, projectiles, aura, phases. No rendering imports.
import type { Strike, Zone } from '../boss/moves2.ts';
import { King, isAttack, type KingMode } from '../boss/king.ts';
import { Brain, type Style } from '../boss/brain.ts';
import type { Motor, Press } from '../player/motor.ts';
import { D } from './difficulty.ts';

export type FightEvent =
  | { k: 'hit'; power: number; dmg: number; reel: boolean; kind: 'blade' | 'fire'; head: boolean } | { k: 'cue'; strike: Strike; lead: number; first: boolean } | { k: 'block' } | { k: 'parry' }
  | { k: 'evade'; perfect: boolean } | { k: 'hurt'; dmg: number; down: boolean } | { k: 'rush' } | { k: 'detonate'; hit: boolean } | { k: 'heal' } | { k: 'deny'; a: string }
  | { k: 'ready'; a: 'skill1' | 'skill2' | 'ultimate' } | { k: 'dead' } | { k: 'reset' } | { k: 'zone'; z: Hazard } | { k: 'zoneHit'; z: Hazard } | { k: 'shot'; p: Shot } | { k: 'shotHit'; p: Shot }
  | { k: 'style'; style: Style } | { k: 'snap' } | { k: 'flame' } | { k: 'aura'; tier: number; up: boolean } | { k: 'break'; by: 'sunder' | 'rites' | 'heavy' } | { k: 'leap' } | { k: 'half' } | { k: 'round2' } | { k: 'finish' } | { k: 'won' } | { k: 'rites'; hit: boolean } | { k: 'hero' };
export interface Hazard { id: number; shape: Zone['shape']; x: number; z: number; yaw: number; r: number; len: number; half: number; t: number; delay: number; dmg: number; down: boolean; speed: number; max: number; done: boolean; visual: boolean; first: boolean; mode: KingMode }
export interface Shot { id: number; x: number; z: number; dx: number; dz: number; t: number; life: number; speed: number; r: number; dmg: number; power: number; big: boolean; hit: boolean }
export type Phase = 'r1' | 'scene' | 'r2' | 'finish' | 'won';

export class Fight {
  m: Motor; king: King; brain: Brain; phase: Phase = 'r1'; round: 1 | 2 = 1;
  hp = D.hp; fire = 0; wake = 0; heals = D.heals; bossHp = D.boss.hp1; hits = 0; time = 0; ev: FightEvent[] = []; taken = 0; deaths = 0;
  /** Hits landed since you were last struck, and the aura it has earned (0-4). */ streak = 0; aura = 0; best = 0;
  /** The flame in the chest: relights you once per round. */ flame = true;
  /** Hit-stop left (real seconds). */ stop = 0; private slowT = 0; private slowK = 1; private teachSlow = false;
  invuln = 0; private reelCd = 0; private swung = ''; private spent = new Set<string>(); private boom = -1; private boomAt = { ax: 0, az: 0, bx: 0, bz: 0 }; deadT = -1; private queue: Press[] = []; private wasReady = { skill1: false, skill2: false, ultimate: false };
  hazards: Hazard[] = []; shots: Shot[] = []; private ids = 0; private hero = false;
  /** Turns the boss's brain off (workbench, tests). */ passive = false;
  /** Scripted movement during a scene. */ sceneMove = { x: 0, z: 0 };
  spawn = { x: 0, z: 5.2, yaw: Math.PI }; private aim = { x: 0, z: 0, r: 0.75 };
  constructor(m: Motor, king = new King(), brain = new Brain()) { this.m = m; this.king = king; this.brain = brain; m.target = this.aim; this.sync(); }
  get maxHp() { return this.round === 2 ? D.boss.hp2 : D.boss.hp1; }
  /** Only what stands in front of you: what comes after has health of its own. */
  get bar() { return this.bossHp / this.maxHp; }
  private sync() { const k = this.king; this.aim.x = k.hx; this.aim.z = k.hz; this.aim.r = k.hr; }

  private slow(k: number, t: number) { this.slowK = k; this.slowT = Math.max(this.slowT, t); }
  private gainFire(n: number) { this.fire = Math.min(D.fireMax, this.fire + n); }
  private setAura() { const t = D.aura.filter(n => this.streak >= n).length; if (t !== this.aura) { const up = t > this.aura; this.aura = t; this.ev.push({ k: 'aura', tier: t, up }); } }
  private damage(dmg: number, power: number, reel: boolean, stop: number, kind: 'blade' | 'fire' = 'blade', by: 'sunder' | 'rites' | 'heavy' | null = null) {
    const k = this.king, m = this.m; if (this.bossHp <= 0 || (this.phase !== 'r1' && this.phase !== 'r2')) return;
    const head = k.hanging; if (head) dmg *= D.boss.headMul;
    this.bossHp = Math.max(0, this.bossHp - dmg); this.hits++; this.streak++; this.best = Math.max(this.best, this.streak); this.stop = Math.max(this.stop, stop); this.setAura(); this.wake = Math.min(100, this.wake + dmg * D.wakeGain * (1 + 0.2 * this.aura) * (kind === 'fire' ? D.spellWake : 1));
    // every blow moves it a little
    if (!k.committed && !k.hanging && k.y === 0) { const a = Math.atan2(k.x - m.x, k.z - m.z); k.x += Math.sin(a) * 0.05 * power; k.z += Math.cos(a) * 0.05 * power; }
    if (this.bossHp <= 0) {
      this.stop = 0.16; this.slow(0.2, 0.9); this.hazards.length = 0; this.ev.push({ k: 'hit', power: 3.2, dmg, reel: true, kind, head }, { k: 'hero' });
      if (this.round === 1) { this.phase = 'scene'; k.pace = 1; k.crawling = false; k.set(k.hanging ? 'crash' : 'fall'); this.ev.push({ k: 'half' }); }
      else { this.phase = 'finish'; k.set('kneel'); this.ev.push({ k: 'finish' }); }
      return;
    }
    if (this.brain.struck(k, dmg)) this.ev.push({ k: 'snap' });
    // great blows break an attack outright; heavy ones only a white attack still winding up, and not again for a while
    const winding = k.committed && !k.hanging && k.strikes[0].kind === 'white' && k.mt < k.strikes[0].t[0] - 0.05, breaks = !k.hanging && (k.committed || k.y > 0) && (by === 'sunder' || by === 'rites' || (by === 'heavy' && this.reelCd <= 0) || (reel && winding && this.reelCd <= 0));
    if (breaks) { const mode = k.mode; k.break(); k.turn(0.5, Math.atan2(m.x - k.x, m.z - k.z)); this.brain.broken(); this.hazards = this.hazards.filter(h => h.mode !== mode || h.t >= h.delay); this.reelCd = by ? D.boss.reelGap : D.boss.reelGap * 1.6; this.slow(0.35, 0.22); this.ev.push({ k: 'hit', power: Math.max(power, 2), dmg, reel: true, kind, head }, { k: 'break', by: by ?? 'heavy' }); return; }
    if (by === 'sunder' || by === 'rites') this.reelCd = 0;
    const can = reel && this.reelCd <= 0 && !k.committed && !k.hanging && !k.helpless && k.mode !== 'fall' && k.y === 0;
    if (can) { k.set(this.round === 2 ? 'reel2' : 'reel'); k.turn(0.5, Math.atan2(m.x - k.x, m.z - k.z)); this.reelCd = D.boss.reelGap; }
    this.ev.push({ k: 'hit', power, dmg, reel: can, kind, head });
  }

  /** Advances by real dt; returns the simulated time that passed (0 while frozen on a hit). */
  step(dt: number, mx: number, mz: number, presses: Press[]): number {
    this.ev.length = 0; this.ev.push(...this.carry); this.carry.length = 0; this.inStep = true; try { return this.advance(dt, mx, mz, presses); } finally { this.inStep = false; }
  }
  private carry: FightEvent[] = []; private inStep = false;
  /** Raised from outside (a button, a scene): kept for the next step so nobody misses it. */
  private raise(e: FightEvent) { (this.inStep ? this.ev : this.carry).push(e); }
  private advance(dt: number, mx: number, mz: number, presses: Press[]): number {
    const m = this.m, k = this.king;
    if (this.phase === 'scene' || this.phase === 'won') { this.queue.length = 0; presses = []; mx = this.sceneMove.x; mz = this.sceneMove.z; }
    this.queue.push(...presses);
    if (this.stop > 0) { this.stop -= dt; m.events.length = 0; k.cues.length = 0; return 0; }
    if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowK; }
    this.time += dt; this.invuln = Math.max(0, this.invuln - dt); this.reelCd -= dt; this.sync();
    const live = this.phase === 'r1' || this.phase === 'r2';
    m.can.skill1 = live && this.fire >= D.rush.cost; m.can.skill2 = live && this.fire >= D.sunder.cost; m.can.ultimate = live && this.wake >= 100; m.can.heal = live && this.heals > 0 && this.hp < D.hp;
    m.can.finale = this.phase === 'finish'; m.can.execute = (this.phase === 'finish' || (k.helpless && k.mode !== 'reel' && k.mode !== 'reel2' && k.mt > 0.3 && k.mt < 2.2 && !this.hero)) && m.targetDist < 3.4;
    const q = this.queue; this.queue = []; m.step(dt, mx, mz, q);
    for (const e of m.events) {
      if (e === 'use:skill1') { this.fire -= D.rush.cost; this.boom = D.rush.delay; this.ev.push({ k: 'rush' }); }
      if (e === 'use:skill2') this.fire -= D.sunder.cost;
      if (e === 'use:ultimate') { this.wake = 0; this.invuln = 5.6; }
      if (e === 'clip:execute') { this.hero = true; this.invuln = Math.max(this.invuln, 2.4); }
      if (e === 'clip:reckon') this.invuln = Math.max(this.invuln, 1.2); if (e.startsWith('clip:riposte')) this.invuln = Math.max(this.invuln, 0.7); if (e === 'clip:finale') this.invuln = 9;
      if (e === 'fx:throw') this.shoot(D.flare.dmg, 1.3, false); if (e === 'fx:sunder') this.shoot(D.sunder.dmg, 3, true);
      if (e === 'fx:wave') this.wave();
      if (e === 'fx:rites') { const hit = m.targetDist < 15 && live; this.ev.push({ k: 'rites', hit }); if (hit) { this.damage(D.rites.dmg, 3.4, true, 0.2, 'fire', 'rites'); this.hazards.length = 0; } }
      if (e === 'fx:heal' && this.heals > 0) { this.heals--; this.hp = Math.min(D.hp, this.hp + D.heal); this.ev.push({ k: 'heal' }); }
      if (e.startsWith('deny:')) this.ev.push({ k: 'deny', a: e.slice(5) });
    }
    if (!k.helpless) this.hero = false;
    const frozen = m.clip?.name === 'rites' && m.t < 3.6; // the world holds its breath
    if (!this.passive && !m.dead && live && !frozen) { this.brain.step(dt, k, m.x, m.z, this.hits, this.bossHp / this.maxHp); if (this.brain.began) this.ev.push({ k: 'style', style: this.brain.began }); if (this.brain.style === 'eclipse' && this.bossHp / this.maxHp < 0.36 && this.wake < 100 && !this.granted) { this.granted = true; this.wake = 100; } }
    // every fire is in your hands before the King falls
    if (this.phase === 'r1' && !this.passive && !this.gifted && this.bossHp < this.maxHp * D.gift) { this.gifted = true; this.wake = 100; this.fire = Math.max(this.fire, D.sunder.cost); }
    if (this.phase === 'finish' && k.mode === 'kneel' && k.mt > 1.6) k.mt = k.prev = 1.6;
    if (this.phase === 'won' && k.mode === 'die2' && k.mt > 5.3) k.mt = k.prev = 5.3;
    if (!frozen) { k.pace = (this.round === 2 ? (this.brain.style === 'eclipse' ? 1.1 : 1.04) : 1) * D.temper[this.brain.temper].pace; k.step(dt, m.x, m.z); } else { k.cues.length = k.live.length = 0; k.ended = null; }
    this.sync();
    if (live) { this.playerHits(); this.bossHits(); if (!frozen) this.zones(dt); this.fly(dt); if (this.boom > 0 && (this.boom -= dt) <= 0) this.detonate(); }
    else if (this.phase === 'finish') { if (m.clip?.name === 'finale' && m.t > 2.0) { this.phase = 'won'; k.set('die2'); this.ev.push({ k: 'hit', power: 3.4, dmg: 1, reel: false, kind: 'fire', head: false }, { k: 'won' }); this.stop = 0.2; this.slow(0.25, 1.6); } }
    for (const [a, ok] of [['skill1', this.fire >= D.rush.cost], ['skill2', this.fire >= D.sunder.cost], ['ultimate', this.wake >= 100]] as const) { if (ok && !this.wasReady[a] && live) this.ev.push({ k: 'ready', a }); this.wasReady[a] = ok; }
    if (this.deadT >= 0 && (this.deadT += dt) > 3.0) this.reset();
    return dt;
  }
  private granted = false; private gifted = false;
  private playerHits() {
    const m = this.m, k = this.king, c = m.clip; if (m.state !== 'clip' || !c?.hit || (k.airborne && !(m.y > 0.5 && k.y > 0 && k.y < m.y + 2))) return;
    const W = c.hits ?? [c.hit];
    W.forEach((w, i) => {
      const id = m.started + '/' + i; if (m.t < w[0] || m.t > w[1] + 0.02 || this.swung === id) return;
      const dx = k.hx - m.x, dz = k.hz - m.z, d = Math.hypot(dx, dz) - k.hr; if (d > (c.reach ?? m.weapon.reach)) return;
      let a = Math.atan2(dx, dz) - m.yaw; a -= Math.round(a / 6.2832) * 6.2832; if (Math.abs(a) * 57.3 > (c.arc ?? m.weapon.arc) && d > 0.2) return;
      const last = i === W.length - 1, p = (c.power ?? 1) * (c.name === m.weapon.heavy ? 0.75 + 0.35 * m.charge : 1) * (last ? D.lastHit[c.name] ?? 1 : 1) * (c.name === m.weapon.air.hit && m.sky > 0 ? D.jump.bonus : 1);
      this.swung = id; this.gainFire(D.gain.hit * Math.min(p, 2.4)); this.damage(m.weapon.damage * p, Math.min(p, 3.4), !!c.reel && last, p < 0.9 ? 0.028 : p < 1.2 ? 0.055 : p < 1.8 ? 0.075 : p < 3 ? 0.12 : 0.15, 'blade', c.name === m.weapon.heavy && m.charge >= 3 ? 'heavy' : null);
    });
  }
  private shoot(dmg: number, power: number, big: boolean) { const m = this.m, a = m.target && m.targetDist < 18 ? Math.atan2(m.target.x - m.x, m.target.z - m.z) : m.yaw, p: Shot = { id: ++this.ids, x: m.x + Math.sin(a) * 0.9, z: m.z + Math.cos(a) * 0.9, dx: Math.sin(a), dz: Math.cos(a), t: 0, life: big ? 1.1 : 0.75, speed: big ? 17 : 15, r: big ? 1.5 : 0.8, dmg, power, big, hit: false }; this.shots.push(p); this.ev.push({ k: 'shot', p }); }
  private fly(dt: number) {
    const k = this.king; for (const p of this.shots) { p.t += dt; p.x += p.dx * p.speed * dt; p.z += p.dz * p.speed * dt; if (!p.hit && Math.hypot(k.hx - p.x, k.hz - p.z) < p.r + k.hr && k.y < (p.big ? 4 : 2.2)) { p.hit = true; this.gainFire(p.big ? 0 : D.gain.hit); this.ev.push({ k: 'shotHit', p }); this.damage(p.dmg, p.power, p.big, p.big ? 0.14 : 0.05, 'fire', p.big ? 'sunder' : null); if (p.big && k.hanging) { this.brain.drop(k); this.ev.push({ k: 'snap' }); } } }
    this.shots = this.shots.filter(p => p.t < p.life);
  }
  /** Fire running along the floor from the second chain's ender. */
  private wave() { const m = this.m, k = this.king, dx = k.hx - m.x, dz = k.hz - m.z, fw = dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw), sd = Math.abs(dx * Math.cos(m.yaw) - dz * Math.sin(m.yaw)); if (fw > 1.5 && fw < 8 && sd < 1.4 && !k.airborne) this.damage(m.weapon.damage * 1.6, 1.8, false, 0.06, 'fire'); }

  private strikePlayer(dmg0: number, down: boolean, from: number, mode: KingMode) {
    const m = this.m, dmg = dmg0 * (this.brain.seen.has(mode) ? 1 : D.teach.dmg);
    this.hp = Math.max(0, this.hp - dmg); this.taken++; this.invuln = D.hurtSafe + (down ? 0.9 : 0); this.stop = down ? 0.12 : 0.085; this.brain.hurt(this.time);
    if (this.streak) { this.streak = 0; this.setAura(); }
    if (this.hp <= 0 && this.flame) { this.flame = false; this.hp = D.flame; this.invuln = 2.6; m.begin('rekindle'); m.yaw = from; this.slow(0.3, 1.0); this.hazards.length = 0; this.ev.push({ k: 'hurt', dmg, down: true }, { k: 'flame' }); if (!this.king.hanging && this.king.y === 0) this.king.set(this.round === 2 ? 'reel2' : 'reel'); return; }
    if (this.hp <= 0) { m.yaw = from; m.die(); this.deaths++; this.deadT = 0; this.hazards.length = 0; this.slow(0.4, 0.8); this.ev.push({ k: 'hurt', dmg, down: true }, { k: 'dead' }); }
    else { m.hurt(from, down); this.ev.push({ k: 'hurt', dmg, down }); }
  }
  private evade() { const m = this.m, vanished = m.clip?.name === 'rush', perfect = !vanished && m.dodgeAge < D.perfect; if (perfect) { this.slow(0.32, 0.5); this.gainFire(D.gain.perfect); m.reckoning = 1.6; } this.ev.push({ k: 'evade', perfect }); }
  /** Something passed under your feet. */
  private leapt() { this.gainFire(D.gain.perfect); this.m.sky = 1.6; this.slow(0.5, 0.22); this.ev.push({ k: 'leap' }); }
  private get vanished() { return this.m.clip?.name === 'rush' && this.m.t < 0.75; }
  private bossHits() {
    const m = this.m, k = this.king;
    for (const s of k.cues) {
      const first = !this.brain.seen.has(k.mode); this.ev.push({ k: 'cue', strike: s, lead: (s.t[0] - k.mt) / (s === k.strikes[0] ? k.rate : 1) / k.pace, first }); if (first && s === k.strikes[0]) this.teachSlow = true;
      for (const z of s.zones ?? []) {
        const at = z.at === 'player' ? m : z.at === 'mark' ? k.mark : k, h: Hazard = { id: ++this.ids, shape: z.shape, x: at.x, z: at.z, yaw: (s.head ? k.dir : k.yaw) + (z.yaw ?? 0), r: z.r ?? 0, len: z.len ?? 0, half: z.half ?? 0.45, t: 0, delay: z.delay / (s === k.strikes[0] ? k.rate : 1) / k.pace, dmg: s.dmg, down: !!s.down, speed: z.speed ?? 0, max: z.max ?? 0, done: false, visual: !!(s.box || s.arc || s.head), first, mode: k.mode };
        this.hazards.push(h); this.ev.push({ k: 'zone', z: h });
      }
    }
    // the very first showing of each attack also slows time a little, until it lands or you answer
    if (this.teachSlow) { if (isAttack(k.mode) && k.mt < k.strikes[0].t[0] && !(m.dodgeAge < 0.3) && !m.guarding) this.slow(D.teach.slow, 0.04); else this.teachSlow = false; }
    if (isAttack(k.mode) && !k.committed) this.brain.seen.add(k.mode);
    if (!isAttack(k.mode)) return;
    for (const s of k.live) {
      if (!s.box && !s.arc && !s.head) continue;
      const id = k.serial + '/' + k.strikes.indexOf(s); if (this.spent.has(id) || m.dead || !k.covers(s, m.x, m.z)) continue;
      const from = Math.atan2(k.hx - m.x, k.hz - m.z);
      if (s.low && m.over) { this.spent.add(id); this.leapt(); continue; }
      if (m.safe > 0 || this.vanished) { this.spent.add(id); this.evade(); continue; }
      if (this.invuln > 0) continue;
      this.spent.add(id); let fa = from - m.yaw; fa -= Math.round(fa / 6.2832) * 6.2832;
      if (s.kind === 'white' && m.guardUp && Math.abs(fa) < 1.9) {
        if (m.guardT < D.parry) {
          m.guardHit(from, true); m.reckoning = 1.8; this.gainFire(D.gain.parry); this.stop = 0.12; this.slow(0.3, 0.55); this.ev.push({ k: 'parry' }); this.brain.seen.add(k.mode);
          // in a string, only the last blow's parry breaks it
          if (k.hanging) { /* keeps swinging */ } else if (k.strikes.indexOf(s) === k.strikes.length - 1) { k.set('kneel'); this.reelCd = D.boss.reelGap; }
        } else { m.guardHit(from, false); this.hp = Math.max(1, this.hp - s.dmg * (this.brain.seen.has(k.mode) ? 1 : D.teach.dmg) * D.chip); this.gainFire(D.gain.block); this.stop = 0.07; this.ev.push({ k: 'block' }); }
        continue;
      }
      this.strikePlayer(s.dmg, !!s.down, from, k.mode);
    }
    if (this.spent.size > 60) this.spent = new Set([...this.spent].slice(-30));
  }
  private zones(dt: number) {
    const m = this.m;
    for (const h of this.hazards) {
      h.t += dt; if (h.visual || h.t < h.delay) continue;
      const dx = m.x - h.x, dz = m.z - h.z, d = Math.hypot(dx, dz); let inside = false, over = false;
      if (h.shape === 'circle') { inside = d < h.r + 0.1; over = h.t > h.delay + 0.1; }
      else if (h.shape === 'line') { const fw = dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw), sd = Math.abs(dx * Math.cos(h.yaw) - dz * Math.sin(h.yaw)); inside = fw > -0.5 && fw < h.len && sd < h.half + 0.1; over = h.t > h.delay + 0.12; }
      else { const R = h.speed * (h.t - h.delay); inside = Math.abs(d - R) < 0.5; over = R > h.max; }
      if (!h.done && h.shape !== 'ring') { if (h.t - dt < h.delay) this.ev.push({ k: 'zoneHit', z: h }); }
      else if (h.shape === 'ring' && h.t - dt < h.delay) this.ev.push({ k: 'zoneHit', z: h });
      if (inside && !h.done && !m.dead) { if (m.over) { h.done = true; this.leapt(); } else if (m.safe > 0 || this.vanished) { h.done = true; this.evade(); } else if (this.invuln <= 0) { h.done = true; this.strikePlayer(h.dmg, h.down, Math.atan2(h.x - m.x, h.z - m.z) || m.yaw, h.mode); } }
      if (over) h.max = -1;
    }
    this.hazards = this.hazards.filter(h => h.max !== -1 && h.t < h.delay + 2.5 && !(h.visual && h.t > h.delay));
  }
  private detonate() {
    const m = this.m, k = this.king, a = m.rushFrom, b = { x: m.x, z: m.z }, vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((k.hx - a.x) * vx + (k.hz - a.z) * vz) / L)), d = Math.hypot(a.x + vx * u - k.hx, a.z + vz * u - k.hz), hit = d < D.rush.width && this.bossHp > 0 && k.y < 1.5;
    this.boomAt = { ax: a.x, az: a.z, bx: b.x, bz: b.z }; this.ev.push({ k: 'detonate', hit });
    if (hit) { const free = this.reelCd; this.reelCd = 0; this.damage(D.rush.dmg, 3, true, 0.13, 'fire'); if (k.mode !== 'reel' && k.mode !== 'reel2') this.reelCd = free; }
  }
  get trail() { return this.boomAt; }
  /** The scene is over: round 2 begins whole, and is a checkpoint. */
  beginRound2() {
    const m = this.m, k = this.king; this.round = 2; this.phase = 'r2'; this.hp = D.hp; this.heals = D.heals; this.flame = true; this.bossHp = D.boss.hp2; this.hazards.length = 0; this.shots.length = 0; this.invuln = 1.2; this.slowT = this.stop = 0; this.reelCd = 2; this.sceneMove = { x: 0, z: 0 };
    k.form = 2; k.armed = false; k.crawling = false; if (k.mode !== 'rise2') k.set('idle'); this.brain.reset(2); if (m.clip?.name !== 'flick') m.revive(m.x, m.z, Math.atan2(k.x - m.x, k.z - m.z)); this.raise({ k: 'round2' });
  }
  reset(all = false) {
    const m = this.m, k = this.king; if (all) { this.round = 1; this.wake = 0; this.deaths = this.taken = this.best = 0; this.time = 0; this.granted = this.gifted = false; }
    this.phase = this.round === 2 ? 'r2' : 'r1'; this.hp = D.hp; this.fire = this.round === 2 ? 50 : 0; this.heals = D.heals; this.flame = true; this.bossHp = this.maxHp; this.deadT = -1; this.invuln = 1; this.boom = -1; this.slowT = this.stop = 0; this.spent.clear(); this.queue = []; this.hazards.length = 0; this.shots.length = 0; this.streak = 0; this.setAura(); if (this.round === 1) this.hits = 0;
    m.revive(this.spawn.x, this.spawn.z, this.spawn.yaw); k.form = this.round; k.armed = this.round === 1; k.crawling = false; k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); this.brain.reset(this.round); this.sync(); this.raise({ k: 'reset' });
  }
}
