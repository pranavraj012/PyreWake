// The first grab is never left out of round 1 (outside training): with the hero standing in reach, the boss throws it by FIRST_GRAB_BY seconds.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { FIRST_GRAB_BY } from '../src/bosses/king/brain.ts';
import { River } from '../src/boss/river/river.ts';
import { RiverBrain } from '../src/boss/river/brain.ts';
import { Motor } from '../src/player/motor.ts';
import type { King } from '../src/bosses/king/king.ts';

const DT = 1 / 60;
/** Plays a real round 1 with the hero standing still in reach, keeping him alive; returns the second the boss first has a moment (held) and whether it was the grab. */
function firstMoment(f: Fight, held: () => string | null, limit: number) {
  for (let i = 0; i < limit * 60; i++) { f.m.revive(f.m.x, f.m.z, f.m.yaw); f.hp = D.hp; f.invuln = Math.max(f.invuln, 0.1); f.step(DT, 0, 0, []); if (held()) return f.time; }
  return null;
}

describe('the first grab is thrown in round 1', () => {
  it('the King throws his grab by the deadline when the hero stands in reach', () => {
    const f = new Fight(new Motor()); f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; const K = f.king as King; K.x = 0; K.z = -4; K.yaw = 0;
    f.passive = false;
    const at = firstMoment(f, () => K.held, FIRST_GRAB_BY + 10);
    expect(at).not.toBeNull(); expect(at!).toBeLessThanOrEqual(FIRST_GRAB_BY + 6);
    expect(K.grabbedOnce).toBe(true);
  });
  it('the Ferryman throws his drag by the deadline when the hero stands in reach', () => {
    const f = new Fight(new Motor(), new River(), new RiverBrain()); f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; const R = f.king as River; R.x = 0; R.z = -4; R.yaw = 0;
    f.passive = false;
    const at = firstMoment(f, () => R.held, FIRST_GRAB_BY + 10);
    expect(at).not.toBeNull(); expect(at!).toBeLessThanOrEqual(FIRST_GRAB_BY + 6);
    expect(R.grabbedOnce).toBe(true);
  });
});
