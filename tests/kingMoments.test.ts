// The Hanged King's staged moments (module A): two grabs that always play out and cost, and two rewards the hero earns.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { GRAB_DMG, NOOSE, OFFER, REWARD_SHARE, RIDE, RIP, type King } from '../src/boss/king.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60;
/** The King itself (the Fight types it as the generic Boss). */
const K = (f: Fight) => f.king as King;
/** Hero two metres in front of the King, who faces him. Passive: the brain is not choosing attacks. */
const mk = (gap = 2) => { const f = new Fight(new Motor()); f.passive = true; f.m.x = 0; f.m.z = -4 + gap; f.m.yaw = Math.PI; K(f).yaw = 0; return f; };
/** A fixed span of time (the Fight may slow itself after a perfect dodge, so spans are in seconds of the fight's own clock). */
const steps = (f: Fight, secs: number, each?: (i: number) => void, press: (i: number) => Press[] = () => []) => { for (let i = 0; i < secs * 60; i++) { each?.(i); f.step(DT, 0, 0, press(i)); } };
/** Steps until a condition holds, at most a long while. */
const until = (f: Fight, done: () => boolean, max = 30) => { for (let i = 0; i < max * 60 && !done(); i++) f.step(DT, 0, 0, []); return done(); };

describe('the grabs', () => {
  it('the noose catches a hero who stands still, costs, and always plays to its end', () => {
    const f = mk(); K(f).set('grab'); const hp0 = f.hp;
    expect(until(f, () => K(f).held === 'noose', 3)).toBe(true);
    expect(until(f, () => K(f).held === null, 15)).toBe(true);
    expect(K(f).mode).toBe('hang');
    expect(hp0 - f.hp).toBeGreaterThanOrEqual(GRAB_DMG.noose - 1);
    expect(hp0 - f.hp).toBeLessThanOrEqual(48);
  });
  it('the noose holds the hero in the grip while the moment plays, whichever way he pushes', () => {
    const f = mk(); K(f).set('grab'); expect(until(f, () => K(f).held === 'noose', 3)).toBe(true);
    let worst = 0;
    steps(f, 1.0, () => { f.m.x += 0.5; f.m.z += 0.5; });
    // the pinned hero is put back at the grip on every step, however he tried to move
    const gx = K(f).x + Math.sin(K(f).yaw) * 1.5, gz = K(f).z + Math.cos(K(f).yaw) * 1.5;
    worst = Math.hypot(f.m.x - gx, f.m.z - gz);
    expect(worst).toBeLessThan(0.05);
  });
});

describe('the rewards', () => {
  it('the rope is offered only while he hangs and the hero is in reach, and the offer lapses by itself', () => {
    const near = mk(2); K(near).set('hang'); steps(near, 1.0);
    expect(K(near).reward).toBe('rope'); expect(K(near).rewardLeft).toBeGreaterThan(0);
    steps(near, OFFER + 0.2); expect(K(near).reward).toBeNull();
    const far = mk(9); K(far).set('hang'); steps(far, 1.0); expect(K(far).reward).toBeNull();
    const grounded = mk(2); steps(grounded, 1.0); expect(K(grounded).reward).toBeNull();
  });
  it('taking the rope: he drops at the cut, and the boss loses its share of life', () => {
    const f = mk(2); K(f).set('hang'); steps(f, 1.0);
    const hp0 = f.bossHp; expect(K(f).takeReward()).toBe('rope');
    expect(K(f).staging).toBe('rope');
    expect(until(f, () => K(f).mode === 'crash', 5)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp1 * REWARD_SHARE, 0);
    expect(until(f, () => K(f).staging === null, 10)).toBe(true);
  });
  it('a perfect dodge of the cross lunge offers the ride, and the ride costs the boss its share', () => {
    const f = mk(2); K(f).set('cross'); f.m.dodgeAge = 0; f.evade();
    expect(K(f).reward).toBe('ride');
    const hp0 = f.bossHp; expect(K(f).takeReward()).toBe('ride'); expect(K(f).mode).toBe('kneel');
    expect(until(f, () => K(f).staging === null, 10)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp1 * REWARD_SHARE, 0);
  });
  it('a late dodge of the cross offers nothing', () => {
    const f = mk(2); K(f).set('cross'); f.m.dodgeAge = 9; f.evade(); expect(K(f).reward).toBeNull();
  });
  it('a reward pressed without an offer changes nothing', () => {
    const f = mk(2); K(f).set('idle'); expect(K(f).takeReward()).toBeNull(); expect(K(f).mode).toBe('idle');
  });
  it('the reward is never the way out of a grab: no offer while the hero is held', () => {
    const f = mk(2); K(f).set('hang'); steps(f, 1.0); expect(K(f).reward).toBe('rope');
    K(f).reward = null; K(f).set('noose'); K(f).held = 'noose'; steps(f, 0.3);
    expect(K(f).reward).toBeNull();
    expect(RIP.cut).toBeLessThan(RIP.len); expect(RIDE.hit).toBeLessThan(RIDE.len); expect(NOOSE.land).toBeLessThan(NOOSE.end);
  });
});
