import { describe, expect, it } from 'vitest';
import { Encounter, TOKENS, type EncounterEvent } from '../src/combat/encounter.ts';
import { Foe, type Attack, type FoeCtx, type FoeSpec } from '../src/foes/foe.ts';
import { Motor, type Press } from '../src/player/motor.ts';
import { KHANDA } from '../src/weapons/khanda.ts';
import { D } from '../src/combat/difficulty.ts';
import type { Strike } from '../src/boss/moves2.ts';

const DT = 1 / 60;
const tap = (a: string): Press[] => [{ a, up: false }, { a, up: true }];
const down = (a: string): Press[] => [{ a, up: false }];
const up = (a: string): Press[] => [{ a, up: true }];

const SPEC: FoeSpec = { kind: 'test', life: 20, r: 0.4, speed: 1.6, reach: 1.0, fares: 7, cooldown: 0.8, stagger: 0.5 };
const LUNGE: Strike = { kind: 'white', cue: 0.4, t: [0.8, 0.95], dmg: 8, mark: 'handL', box: [2.2, 0.6] };
const RED: Strike = { kind: 'red', cue: 0.4, t: [0.8, 0.95], dmg: 14, down: false, mark: 'handL', box: [2.2, 0.6] };

/** A foe that attacks whenever it can: a lunge, the cue at 0.4 s. */
class Lunger extends Foe {
  private readonly strike: Strike;
  constructor(spec: FoeSpec, x: number, z: number, strike: Strike = LUNGE) { super(spec, x, z); this.strike = strike; }
  protected pick(_ctx: FoeCtx): Attack | null { return { name: 'lunge', dur: 1.2, strikes: [this.strike] }; }
}
/** A foe that never moves or attacks: a target for the hero's blades. */
class Dummy extends Foe {
  protected think(): void { this.mode = 'idle'; }
}

/** The hero at the origin, facing +z (yaw 0), standing still. */
const mk = (...foes: Foe[]) => { const m = new Motor(KHANDA); m.x = 0; m.z = 0; m.yaw = 0; m.moveYaw = 0; return new Encounter(m, foes); };
const run = (e: Encounter, secs: number, press: (i: number) => Press[] = () => []) => {
  const ev: EncounterEvent[] = [];
  for (let i = 0; i < secs * 60; i++) { e.step(DT, 0, 0, press(i)); ev.push(...e.ev); }
  return ev;
};
const count = (ev: EncounterEvent[], k: string) => ev.filter(e => e.k === k).length;

describe('encounter: many foes', () => {
  it('three foes close in and attack the hero', () => {
    const foes = [new Lunger(SPEC, -3, 4), new Lunger(SPEC, 3, 4.5), new Lunger(SPEC, 0, 6)];
    const e = mk(...foes);
    const ev = run(e, 8);
    for (const f of foes) expect(f.serial).toBeGreaterThan(0);
    expect(count(ev, 'hurt') + count(ev, 'block') + count(ev, 'parry') + count(ev, 'evade')).toBeGreaterThan(0);
  });

  it('attack tokens: never more than two foes winding up, and the third waits', () => {
    const foes = [new Lunger(SPEC, -1.5, 1.8), new Lunger(SPEC, 1.5, 1.8), new Lunger(SPEC, 0, 2.2)];
    const e = mk(...foes);
    let most = 0, waited = false;
    for (let i = 0; i < 10 * 60; i++) {
      e.step(DT, 0, 0, []);
      most = Math.max(most, e.attackers.length);
      if (foes.some(f => !f.hasToken && !f.attacking && f.mode === 'circle')) waited = true;
    }
    expect(TOKENS).toBe(2);
    expect(most).toBe(2);
    expect(waited).toBe(true);
    expect(foes.every(f => f.serial > 0)).toBe(true);
  });

  it('cleave: one swing hits every foe in its arc, each once', () => {
    const a = new Dummy(SPEC, -0.5, 1.4), b = new Dummy(SPEC, 0.5, 1.4), far = new Dummy(SPEC, 0, 6);
    const e = mk(a, b, far);
    const ev: EncounterEvent[] = [];
    let first: string | null = null;
    for (let i = 0; i < 90; i++) {
      e.step(DT, 0, 0, i === 0 ? tap('attack') : []);
      if (!first && e.m.clip) first = e.m.clip.name;
      ev.push(...e.ev);
    }
    const hitsOn = (f: Foe) => ev.filter(x => x.k === 'foeHit' && x.foe === f).length;
    const windows = KHANDA.clips[first!]?.hits?.length ?? 1;
    expect(hitsOn(a)).toBe(windows);
    expect(hitsOn(b)).toBe(windows);
    expect(hitsOn(far)).toBe(0);
    expect(a.life).toBeCloseTo(SPEC.life - KHANDA.damage * windows, 5);
    expect(b.life).toBeCloseTo(SPEC.life - KHANDA.damage * windows, 5);
  });

  it('a red cue can be dodged: no hurt, and an evade is reported', () => {
    const foe = new Lunger(SPEC, 0, 1.35, RED);
    const e = mk(foe);
    for (let i = 0; i < 600 && !(foe.attack && foe.mt >= RED.t[0] - 0.12); i++) e.step(DT, 0, 0, []);
    const ev: EncounterEvent[] = [];
    e.step(DT, 0, 0, tap('dodge')); ev.push(...e.ev);
    for (let i = 0; i < 60; i++) { e.step(DT, 0, 0, []); ev.push(...e.ev); }
    expect(count(ev, 'evade')).toBe(1);
    expect(count(ev, 'hurt')).toBe(0);
    expect(e.hp).toBe(D.hp);
  });

  it('a foe that is not dodged hurts the hero once', () => {
    const foe = new Lunger(SPEC, 0, 1.35, RED);
    const e = mk(foe);
    const ev = run(e, 2);
    expect(count(ev, 'hurt')).toBe(1);
    expect(e.hp).toBe(D.hp - RED.dmg);
  });

  it('a dead foe drops its fares once; they fly to the hero and are taken once', () => {
    const foe = new Dummy({ ...SPEC, life: KHANDA.damage * 2 - 1, fares: 7 }, 0, 1.35);
    const e = mk(foe);
    const ev: EncounterEvent[] = [];
    for (let i = 0; i < 4 * 60; i++) { e.step(DT, 0, 0, i % 30 === 0 ? tap('attack') : []); ev.push(...e.ev); }
    expect(foe.dead).toBe(true);
    expect(count(ev, 'foeDead')).toBe(1);
    expect(e.embers.length).toBe(0);
    expect(e.fares).toBe(7);
    // more blows on the corpse, and more time, pay nothing more
    foe.struck(999, 3);
    const more = run(e, 3, i => i % 30 === 0 ? tap('attack') : []);
    expect(count(more, 'foeDead')).toBe(0);
    expect(e.fares).toBe(7);
  });

  it('lock-on picks a foe in front, and the lock button cycles to the next', () => {
    const near = new Dummy(SPEC, 0, 2), other = new Dummy(SPEC, 0.6, 3.2);
    const e = mk(near, other);
    run(e, 0.1);
    expect(e.target).toBe(near);
    run(e, 0.1, i => i === 0 ? tap('lock') : []);
    expect(e.target).toBe(other);
    expect(e.m.target?.x).toBe(other.x);
  });

  it('foes cannot walk through the hero or each other', () => {
    const foes = [new Dummy(SPEC, 0.05, 0.1), new Dummy(SPEC, 0.02, 0.15)];
    const e = mk(...foes);
    run(e, 0.5);
    expect(Math.hypot(foes[0].x - e.m.x, foes[0].z - e.m.z)).toBeGreaterThanOrEqual(foes[0].r + 0.45 - 1e-6);
    expect(Math.hypot(foes[1].x - e.m.x, foes[1].z - e.m.z)).toBeGreaterThanOrEqual(foes[1].r + 0.45 - 1e-6);
    expect(Math.hypot(foes[0].x - foes[1].x, foes[0].z - foes[1].z)).toBeGreaterThanOrEqual(foes[0].r + foes[1].r - 1e-3);
  });

  it('a heavy blow staggers a foe, and it cannot attack while staggered', () => {
    const foe = new Lunger({ ...SPEC, life: 999 }, 0, 1.35);
    const e = mk(foe);
    foe.struck(1, 1.5);
    expect(foe.helpless).toBe(true);
    expect(foe.stunT).toBeGreaterThan(0);
    run(e, 0.3);
    expect(foe.attacking).toBe(false);
  });

  it('a foe out of reach does nothing to the hero', () => {
    const e = mk(new Dummy(SPEC, 0, 12));
    const ev = run(e, 2);
    expect(count(ev, 'hurt')).toBe(0);
    expect(e.hp).toBe(D.hp);
    expect(e.embers.length).toBe(0);
  });
});
