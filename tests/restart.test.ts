import { describe, expect, it } from 'vitest';
import { Brain } from '../src/bosses/king/brain.ts';
import { King } from '../src/bosses/king/king.ts';
import { Fight } from '../src/combat/fight.ts';
import { Motor } from '../src/player/motor.ts';
import { makeProps } from '../src/arena/props.ts';

const DT = 1 / 60;
/** Private state, read or set by the restart tests. */
const P = (f: Fight) => f as unknown as Record<string, any>;
const mk = () => { const f = new Fight(new Motor(), new King(), new Brain()); f.passive = true; f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; return f; };
const die = (f: Fight) => { f.flame = false; f.hp = 1; f.strikePlayer(50, true, 0, 'x'); };
const run = (f: Fight, s: number) => { for (let i = 0; i < s / DT; i++) f.step(DT, 0, 0, []); };

describe('a restart leaves nothing of the attempt behind', () => {
  it('a death in round 1 clears the wake, the slow-mo, the gift, the blow count and the moment', () => {
    const f = mk(); f.wake = 70; P(f).slow(0.3, 1); P(f).gifted = true;
    f.brain.hurt(0); f.brain.hurt(0.1); // two blows in a row would make it ease
    let hook = 0; f.onReset = () => { hook++; };
    die(f); run(f, 9);
    expect(hook).toBe(1);
    expect(f.wake).toBe(0);
    expect(P(f).slowK).toBe(1);
    expect(P(f).gifted).toBe(false);
    expect(P(f).brain.hurts.length).toBe(0);
    expect(P(f).momentKey).toBeNull();
  });

  it('a death in round 2 returns to the wake the round began with, not to the round 1 wake', () => {
    const f = mk(); f.beginRound2(); const at2 = f.wake; f.wake = 90; die(f); run(f, 9);
    expect(f.round).toBe(2);
    expect(f.wake).toBe(at2);
  });

  it('a fresh fight (reset all) runs the page hook and makes the court whole', () => {
    const f = mk(); f.furnish(makeProps()); const p = f.props[0]; f.hitProp(p, 4, 0, 0, 'hero', 99);
    let all = 0; f.onReset = a => { if (a) all++; };
    f.reset(true); expect(p.broken).toBe(false); expect(all).toBe(1);
  });
});
