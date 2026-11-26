// The Hanged King's staged moments (module A): two grabs that always play out and cost, and two rewards the hero earns.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { GRAB_DMG, HANDS, NOOSE, OFFER, REWARD_SHARE, RIDE, RIP } from '../src/boss/king.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60;
/** Hero two metres in front of the King, who faces him. Passive: the brain is not choosing attacks. */
const mk = (gap = 2) => { const f = new Fight(new Motor()); f.passive = true; f.m.x = 0; f.m.z = -4 + gap; f.m.yaw = Math.PI; f.king.yaw = 0; return f; };
/** A fixed span of time (the Fight may slow itself after a perfect dodge, so spans are in seconds of the fight's own clock). */
const steps = (f: Fight, secs: number, each?: (i: number) => void, press: (i: number) => Press[] = () => []) => { for (let i = 0; i < secs * 60; i++) { each?.(i); f.step(DT, 0, 0, press(i)); } };
/** Steps until a condition holds, at most a long while. */
const until = (f: Fight, done: () => boolean, max = 30) => { for (let i = 0; i < max * 60 && !done(); i++) f.step(DT, 0, 0, []); return done(); };

describe('the grabs', () => {
  it('the noose catches a hero who stands still, costs, and always plays to its end', () => {
    const f = mk(); f.king.set('grab'); const hp0 = f.hp;
    expect(until(f, () => f.king.held === 'noose', 3)).toBe(true);
    expect(until(f, () => f.king.held === null, 15)).toBe(true);
    expect(f.king.mode).toBe('hang');
    expect(hp0 - f.hp).toBeGreaterThanOrEqual(GRAB_DMG.noose - 1);
    expect(hp0 - f.hp).toBeLessThanOrEqual(48);
  });
  it('the noose holds the hero in the grip while the moment plays, whichever way he pushes', () => {
    const f = mk(); f.king.set('grab'); expect(until(f, () => f.king.held === 'noose', 3)).toBe(true);
    let worst = 0;
    steps(f, 1.0, () => { f.m.x += 0.5; f.m.z += 0.5; });
    // the pinned hero is put back at the grip on every step, however he tried to move
    const gx = f.king.x + Math.sin(f.king.yaw) * 1.5, gz = f.king.z + Math.cos(f.king.yaw) * 1.5;
    worst = Math.hypot(f.m.x - gx, f.m.z - gz);
    expect(worst).toBeLessThan(0.05);
  });
  it('a dodge of the grab cue avoids it: no seizing, no cost', () => {
    const f = mk(); f.king.set('grab'); const hp0 = f.hp;
    steps(f, 2.2, () => { if (f.king.mt > 1.3 && f.king.mt < 1.6) f.m.safe = 0.2; });
    expect(f.king.held).toBeNull(); expect(f.hp).toBe(hp0);
  });
  it('the hands catch a hero who stands still, hold him, and cost at the burst', () => {
    const f = mk(); f.king.set('skewer'); const hp0 = f.hp;
    expect(until(f, () => f.king.held === 'hands', 3)).toBe(true);
    expect(until(f, () => f.king.held === null, 15)).toBe(true);
    expect(hp0 - f.hp).toBeGreaterThanOrEqual(GRAB_DMG.hands - 1);
  });
});

describe('the rewards', () => {
  it('the rope is offered only while he hangs and the hero is in reach, and the offer lapses by itself', () => {
    const near = mk(2); near.king.set('hang'); steps(near, 1.0);
    expect(near.king.reward).toBe('rope'); expect(near.king.rewardLeft).toBeGreaterThan(0);
    steps(near, OFFER + 0.2); expect(near.king.reward).toBeNull();
    const far = mk(9); far.king.set('hang'); steps(far, 1.0); expect(far.king.reward).toBeNull();
    const grounded = mk(2); steps(grounded, 1.0); expect(grounded.king.reward).toBeNull();
  });
  it('taking the rope: he drops at the cut, and the boss loses its share of life', () => {
    const f = mk(2); f.king.set('hang'); steps(f, 1.0);
    const hp0 = f.bossHp; expect(f.king.takeReward()).toBe('rope');
    expect(f.king.staging).toBe('rope');
    expect(until(f, () => f.king.mode === 'crash', 5)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp1 * REWARD_SHARE, 0);
    expect(until(f, () => f.king.staging === null, 10)).toBe(true);
  });
  it('a perfect dodge of the cross lunge offers the ride, and the ride costs the boss its share', () => {
    const f = mk(2); f.king.set('cross'); f.m.dodgeAge = 0; f.evade();
    expect(f.king.reward).toBe('ride');
    const hp0 = f.bossHp; expect(f.king.takeReward()).toBe('ride'); expect(f.king.mode).toBe('kneel');
    expect(until(f, () => f.king.staging === null, 10)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp1 * REWARD_SHARE, 0);
  });
  it('a late dodge of the cross offers nothing', () => {
    const f = mk(2); f.king.set('cross'); f.m.dodgeAge = 9; f.evade(); expect(f.king.reward).toBeNull();
  });
  it('a reward pressed without an offer changes nothing', () => {
    const f = mk(2); f.king.set('idle'); expect(f.king.takeReward()).toBeNull(); expect(f.king.mode).toBe('idle');
  });
  it('the reward is never the way out of a grab: no offer while the hero is held', () => {
    const f = mk(2); f.king.set('hang'); steps(f, 1.0); expect(f.king.reward).toBe('rope');
    f.king.reward = null; f.king.set('noose'); f.king.held = 'noose'; steps(f, 0.3);
    expect(f.king.reward).toBeNull();
    expect(RIP.cut).toBeLessThan(RIP.len); expect(RIDE.hit).toBeLessThan(RIDE.len); expect(NOOSE.land).toBeLessThan(NOOSE.end); expect(HANDS.burst).toBeLessThan(HANDS.end);
  });
});
