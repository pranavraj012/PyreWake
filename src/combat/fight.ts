// The referee: health, fire, hits, guard, parry, cues, hit-stop. No rendering imports.
import type { Strike } from '../boss/moves.ts';
import { King, SparBrain, isAttack } from '../boss/king.ts';
import type { Motor, Press } from '../player/motor.ts';
import { D } from './difficulty.ts';

export type FightEvent =
  | { k: 'hit'; power: number; dmg: number; reel: boolean } | { k: 'cue'; strike: Strike; lead: number; first: boolean } | { k: 'block' } | { k: 'parry' }
  | { k: 'evade'; perfect: boolean } | { k: 'hurt'; dmg: number; down: boolean } | { k: 'rush' } | { k: 'detonate'; hit: boolean } | { k: 'heal' } | { k: 'deny'; a: string }
  | { k: 'ready' } | { k: 'bossDown' } | { k: 'bossUp' } | { k: 'dead' } | { k: 'reset' };

export class Fight {
  m: Motor; king: King; brain: SparBrain;
  hp = D.hp; fire = 0; heals = D.heals; bossHp = D.boss.hp; hits = 0; time = 0; downs = 0; ev: FightEvent[] = [];
  /** Hit-stop left (real seconds). */ stop = 0; private slowT = 0; private slowK = 1; private teachSlow = false;
  invuln = 0; private reelCd = 0; private swung = ''; private spent = new Set<string>(); private boom = -1; private boomAt = { ax: 0, az: 0, bx: 0, bz: 0 }; deadT = -1; private queue: Press[] = []; private wasReady = false;
  /** Turns the boss's brain off (workbench, tests). */ passive = false;
  spawn = { x: 0, z: 5.2, yaw: Math.PI };
  constructor(m: Motor, king = new King(), brain = new SparBrain()) { this.m = m; this.king = king; this.brain = brain; m.target = king; }

  private slow(k: number, t: number) { this.slowK = k; this.slowT = Math.max(this.slowT, t); }
  private gainFire(n: number) { this.fire = Math.min(D.fireMax, this.fire + n); }
  private damage(dmg: number, power: number, reel: boolean, stop: number) {
    const k = this.king, m = this.m; if (this.bossHp <= 0) return;
    this.bossHp = Math.max(0, this.bossHp - dmg); this.hits++; this.stop = Math.max(this.stop, stop);
    const can = reel && this.reelCd <= 0 && !k.committed && k.mode !== 'kneel' && k.mode !== 'fall';
    if (this.bossHp <= 0) { k.set('fall'); this.downs++; this.slow(0.28, 1.0); this.stop = 0.14; this.ev.push({ k: 'hit', power: 3, dmg, reel: true }, { k: 'bossDown' }); return; }
    if (can) { k.set('reel'); k.turn(0.5, Math.atan2(m.x - k.x, m.z - k.z)); this.reelCd = D.boss.reelGap; }
    this.ev.push({ k: 'hit', power, dmg, reel: can });
  }

  /** Advances by real dt; returns the simulated time that passed (0 while frozen on a hit). */
  step(dt: number, mx: number, mz: number, presses: Press[]): number {
    this.ev.length = 0; const m = this.m, k = this.king;
    this.queue.push(...presses);
    if (this.stop > 0) { this.stop -= dt; m.events.length = 0; return 0; }
    if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowK; }
    this.time += dt; this.invuln = Math.max(0, this.invuln - dt); this.reelCd -= dt;
    m.can.skill1 = this.fire >= D.rush.cost; m.can.heal = this.heals > 0 && this.hp < D.hp;
    const q = this.queue; this.queue = []; m.step(dt, mx, mz, q);
    for (const e of m.events) {
      if (e === 'use:skill1') { this.fire -= D.rush.cost; this.boom = D.rush.delay; this.ev.push({ k: 'rush' }); }
      if (e === 'fx:heal') { if (this.heals > 0) { this.heals--; this.hp = Math.min(D.hp, this.hp + D.heal); this.ev.push({ k: 'heal' }); } }
      if (e.startsWith('deny:')) this.ev.push({ k: 'deny', a: e.slice(5) });
    }
    if (!this.passive && !m.dead) this.brain.step(dt, k, m.x, m.z, this.hits);
    k.step(dt, m.x, m.z);
    if (k.ended === 'fall') { this.bossHp = D.boss.hp; this.brain.rest(1); this.ev.push({ k: 'bossUp' }); }
    this.playerHits(); this.bossHits();
    if (this.boom > 0 && (this.boom -= dt) <= 0) this.detonate();
    if (this.fire >= D.rush.cost && !this.wasReady) this.ev.push({ k: 'ready' }); this.wasReady = this.fire >= D.rush.cost;
    if (this.deadT >= 0 && (this.deadT += dt) > 3.2) this.reset();
    return dt;
  }
  private playerHits() {
    const m = this.m, k = this.king, c = m.clip; if (m.state !== 'clip' || !c?.hit) return;
    (c.hits ?? [c.hit]).forEach((w, i) => {
      const id = m.started + '/' + i; if (m.t < w[0] || m.t > w[1] + 0.02 || this.swung === id) return;
      const dx = k.x - m.x, dz = k.z - m.z, d = Math.hypot(dx, dz) - k.r; if (d > (c.reach ?? m.weapon.reach)) return;
      let a = Math.atan2(dx, dz) - m.yaw; a -= Math.round(a / 6.2832) * 6.2832; if (Math.abs(a) * 57.3 > (c.arc ?? m.weapon.arc) && d > 0.2) return;
      this.swung = id; const p = (c.power ?? 1) * (c.name === m.weapon.heavy ? 0.8 + 0.16 * m.charge : 1);
      this.gainFire(D.gain.hit * p); this.damage(m.weapon.damage * p, p, !!c.reel && (!c.hits || i === c.hits.length - 1), p < 1.2 ? 0.05 : p < 1.8 ? 0.066 : 0.115);
    });
  }
  private bossHits() {
    const m = this.m, k = this.king;
    for (const s of k.cues) { const first = !this.brain.seen.has(k.mode); this.ev.push({ k: 'cue', strike: s, lead: (s.t[0] - k.mt) / (s === k.strikes[0] ? k.rate : 1), first }); if (first && s === k.strikes[0]) this.teachSlow = true; }
    // the very first showing of each attack also slows time a little, until it lands or you answer
    if (this.teachSlow) { if (isAttack(k.mode) && k.mt < k.strikes[0].t[0] && !(m.dodgeAge < 0.3) && !m.guarding) this.slow(D.teach.slow, 0.04); else this.teachSlow = false; }
    if (!isAttack(k.mode)) return;
    k.live.forEach(s => {
      const id = k.serial + '/' + k.strikes.indexOf(s); if (this.spent.has(id) || m.dead || !k.covers(s, m.x, m.z)) return;
      const from = Math.atan2(k.x - m.x, k.z - m.z), vanished = m.clip?.name === 'rush' && m.t < 0.75;
      if (m.safe > 0 || vanished) { this.spent.add(id); const perfect = !vanished && m.dodgeAge < D.perfect; if (perfect) { this.slow(0.32, 0.5); this.gainFire(D.gain.perfect); } this.ev.push({ k: 'evade', perfect }); return; }
      if (this.invuln > 0) return;
      this.spent.add(id); const teach = this.brain.seen.has(k.mode) ? 1 : D.teach.dmg, dmg = s.dmg * teach;
      let fa = from - m.yaw; fa -= Math.round(fa / 6.2832) * 6.2832;
      if (s.kind === 'white' && m.guardUp && Math.abs(fa) < 1.9) {
        if (m.guardT < D.parry) { m.guardHit(from, true); this.gainFire(D.gain.parry); this.stop = 0.12; this.slow(0.3, 0.55); this.ev.push({ k: 'parry' }); this.brain.seen.add(k.mode); k.set('kneel'); this.reelCd = D.boss.reelGap; }
        else { m.guardHit(from, false); this.hp = Math.max(1, this.hp - dmg * D.chip); this.gainFire(D.gain.block); this.stop = 0.07; this.ev.push({ k: 'block' }); }
        return;
      }
      this.hp = Math.max(0, this.hp - dmg); this.invuln = D.hurtSafe + (s.down ? 0.9 : 0); this.stop = s.down ? 0.12 : 0.085;
      if (this.hp <= 0) { m.yaw = from; m.die(); this.deadT = 0; this.slow(0.4, 0.8); this.ev.push({ k: 'hurt', dmg, down: true }, { k: 'dead' }); }
      else { m.hurt(from, !!s.down); this.ev.push({ k: 'hurt', dmg, down: !!s.down }); }
    });
    if (isAttack(k.mode) && !k.committed) this.brain.seen.add(k.mode);
    if (this.spent.size > 40) this.spent.clear();
  }
  private detonate() {
    const m = this.m, k = this.king, a = m.rushFrom, b = m.clip?.name === 'rush' ? m : { x: m.x, z: m.z }, vx = b.x - a.x, vz = b.z - a.z, L = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((k.x - a.x) * vx + (k.z - a.z) * vz) / L)), d = Math.hypot(a.x + vx * u - k.x, a.z + vz * u - k.z), hit = d < D.rush.width && this.bossHp > 0;
    this.boomAt = { ax: a.x, az: a.z, bx: b.x, bz: b.z }; this.ev.push({ k: 'detonate', hit });
    if (hit) { const free = this.reelCd; this.reelCd = 0; this.damage(D.rush.dmg, 3, true, 0.13); if (k.mode !== 'reel') this.reelCd = free; }
  }
  get trail() { return this.boomAt; }
  reset() {
    const m = this.m, k = this.king; this.hp = D.hp; this.fire = 0; this.heals = D.heals; this.bossHp = D.boss.hp; this.deadT = -1; this.invuln = 1; this.boom = -1; this.slowT = this.stop = 0; this.spent.clear(); this.queue = [];
    m.revive(this.spawn.x, this.spawn.z, this.spawn.yaw); k.x = 0; k.z = -4; k.yaw = 0; k.set('idle'); this.brain.reset(); this.ev.push({ k: 'reset' });
  }
}
