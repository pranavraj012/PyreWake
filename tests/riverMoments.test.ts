// The Ferryman's staged moments (module A): the drag (round 1 grab, the only grab) and the chain and lantern rewards.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { River, CHAIN, DRAG, GRAB_DRAG, LANTERN, RIVER_OFFER, RIVER_REWARD_SHARE } from '../src/boss/river/river.ts';
import { RiverBrain } from '../src/boss/river/brain.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60;
/** Hero `gap` metres in front of the Ferryman, who faces him. Passive: the brain is not choosing moves. */
const mk = (gap = 3, form: 1 | 2 = 1) => { const f = new Fight(new Motor(), new River(), new RiverBrain()); f.passive = true; if (form === 2) f.beginRound2(); const k = f.king as River; f.invuln = 0; k.x = 0; k.z = -4; k.yaw = 0; f.m.x = 0; f.m.z = -4 + gap; f.m.yaw = Math.PI; return { f, k }; };
const steps = (f: Fight, secs: number, each?: (i: number) => void, press: (i: number) => Press[] = () => []) => { for (let i = 0; i < secs * 60; i++) { each?.(i); f.step(DT, 0, 0, press(i)); } };
const until = (f: Fight, done: () => boolean, max = 30) => { for (let i = 0; i < max * 60 && !done(); i++) f.step(DT, 0, 0, []); return done(); };
const R = (f: Fight) => f.king as River;

describe('the drag (round 1)', () => {
  it('a hero who stands still in the drag is taken under, held, and always costs', () => {
    const { f, k } = mk(); f.brain.seen.add('dragDeep'); k.set('dragDeep'); const hp0 = f.hp;
    expect(until(f, () => k.held === 'drag', 4)).toBe(true);
    expect(until(f, () => k.held === null, 15)).toBe(true);
    expect(hp0 - f.hp).toBeGreaterThanOrEqual(GRAB_DRAG.drag - 1);
  });
  it('a dodge of the drag line avoids it: no taking under, no cost', () => {
    const { f, k } = mk(); f.brain.seen.add('dragDeep'); k.set('dragDeep'); const hp0 = f.hp;
    steps(f, 3.0, () => { if (k.mt > 1.0 && k.mt < 2.0) f.m.safe = 0.2; });
    expect(k.held).toBeNull(); expect(f.hp).toBe(hp0);
  });
  it('the hero is held in the drag while the moment plays', () => {
    const { f, k } = mk(); f.brain.seen.add('dragDeep'); k.set('dragDeep'); expect(until(f, () => k.held === 'drag', 4)).toBe(true);
    const gx = k.x + Math.sin(k.yaw) * 1.6, gz = k.z + Math.cos(k.yaw) * 1.6;
    steps(f, 0.4, () => { f.m.x += 0.6; });
    expect(Math.hypot(f.m.x - gx, f.m.z - gz)).toBeLessThan(0.05);
  });
});

describe('the rewards', () => {
  it('the chain: offered when the taut chain is cut and the boat snaps; the hero takes it, and the boss loses its share', () => {
    const { f, k } = mk(); const r = R(f); r.set('idle');
    r.chain = { x: 2, z: -2, len: 4, hp: 1, t: 0, cut: 0 }; r.lastAnchor = { x: 2, z: -2 }; r.offer('chain');
    expect(r.reward).toBe('chain'); expect(r.rewardLeft).toBe(RIVER_OFFER);
    const hp0 = f.bossHp; expect(r.takeReward()).toBe('chain'); expect(r.staging).toBe('chain');
    expect(until(f, () => r.staging === null, 10)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp1 * RIVER_REWARD_SHARE, 0);
    void k;
  });
  it('the chain offer lapses by itself', () => {
    const { f } = mk(); const r = R(f); r.offer('chain'); steps(f, RIVER_OFFER + 0.2); expect(r.reward).toBeNull();
  });
  it('the lantern: offered once the lamps go out in round 2, and the hero smashes it for the boss\'s share of its second life', () => {
    const { f } = mk(3, 2); const r = R(f); r.set('lamps'); expect(until(f, () => r.reward !== null, 10)).toBe(true);
    expect(r.reward).toBe('lantern');
    const hp0 = f.bossHp; expect(r.takeReward()).toBe('lantern');
    expect(until(f, () => r.staging === null, 10)).toBe(true);
    expect(hp0 - f.bossHp).toBeCloseTo(D.boss.hp2 * RIVER_REWARD_SHARE, 0);
  });
  it('the lantern is not offered in round 1, nor while the hero is held', () => {
    const { f } = mk(); const r = R(f); r.set('lamps'); steps(f, 7.0); expect(r.reward).toBeNull();
    const g = mk(3, 2); const q = R(g.f); q.held = 'drag'; q.offer('lantern'); expect(q.reward).toBeNull();
  });
  it('a reward pressed without an offer changes nothing', () => {
    const { f, k } = mk(); const r = R(f); r.set('idle'); expect(r.takeReward()).toBeNull(); expect(k.mode).toBe('idle');
  });
  it('the moments have their timings in order', () => {
    expect(DRAG.dmg).toBeLessThan(DRAG.heave); expect(DRAG.heave).toBeLessThan(DRAG.end);

    expect(CHAIN.hit).toBeLessThan(CHAIN.len); expect(LANTERN.hit).toBeLessThan(LANTERN.len);
  });
});
