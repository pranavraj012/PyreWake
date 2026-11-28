// One grab per boss (module A): the first throw of a boss's grab in a fight always connects and plays out; every later throw can be dodged;
// a new fight forces the first throw again; the grabs that were removed (the King's skewer, the Ferryman's thrust) never seize.
import { describe, expect, it } from 'vitest';
import { Brain } from '../src/bosses/king/brain.ts';
import { Fight } from '../src/combat/fight.ts';
import { GRAB_DMG, King } from '../src/bosses/king/king.ts';
import { GRAB_DRAG, River } from '../src/bosses/river/river.ts';
import { RiverBrain } from '../src/bosses/river/brain.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60;
const mkKing = () => { const f = new Fight(new Motor(), new King(), new Brain()); f.passive = true; f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; f.boss.yaw = 0; return f; };
const mkRiver = () => { const f = new Fight(new Motor(), new River(), new RiverBrain()); f.passive = true; f.m.x = 0; f.m.z = -1.5; f.m.yaw = Math.PI; const k = f.boss as River; k.x = 0; k.z = -4; k.yaw = 0; return f; };
const K = (f: Fight) => f.boss as King;
const R = (f: Fight) => f.boss as River;
const steps = (f: Fight, secs: number, each?: (i: number) => void, press: (i: number) => Press[] = () => []) => { for (let i = 0; i < secs * 60; i++) { each?.(i); f.step(DT, 0, 0, press(i)); } };
const until = (f: Fight, done: () => boolean, max = 30) => { for (let i = 0; i < max * 60 && !done(); i++) f.step(DT, 0, 0, []); return done(); };

describe('the King: one grab per fight', () => {
  it('the first throw connects even with a perfect dodge in the window, and plays out', () => {
    const f = mkKing(); f.boss.set('grab'); const hp0 = f.hp;
    steps(f, 3.5, () => { if (f.boss.mt > 1.3 && f.boss.mt < 1.6) { f.m.safe = 0.2; f.m.dodgeAge = 0; } });
    expect(K(f).grabbedOnce).toBe(true);
    expect(until(f, () => K(f).held === null && K(f).mode === 'hang', 15)).toBe(true);
    expect(hp0 - f.hp).toBeGreaterThanOrEqual(GRAB_DMG.noose - 1);
  });
  it('the second throw can be dodged: no seizing, no cost', () => {
    const f = mkKing(); f.boss.set('grab'); expect(until(f, () => K(f).held === 'noose', 3)).toBe(true);
    expect(until(f, () => K(f).held === null, 15)).toBe(true);
    f.boss.set('idle'); f.boss.set('grab'); const hp0 = f.hp;
    steps(f, 4.0, () => { if (f.boss.mt > 1.3 && f.boss.mt < 1.6) f.m.safe = 0.2; });
    expect(K(f).held).toBeNull(); expect(f.hp).toBe(hp0);
  });
  it('a new fight forces the first throw again', () => {
    const f = mkKing(); f.boss.set('grab'); expect(until(f, () => K(f).held === 'noose', 3)).toBe(true);
    expect(until(f, () => K(f).held === null, 15)).toBe(true);
    expect(K(f).grabbedOnce).toBe(true);
    f.reset(false); expect(K(f).grabbedOnce).toBe(false);
  });
  it('the skewer is a plain strike now: it never seizes', () => {
    const f = mkKing(); f.boss.set('skewer'); steps(f, 2.4); expect(K(f).held).toBeNull();
  });
});

describe('the Ferryman: one grab per fight', () => {
  it('the first drag connects even with a perfect dodge of the line', () => {
    const f = mkRiver(); R(f).set('dragDeep'); f.brain.seen.add('dragDeep');
    steps(f, 2.4, () => { if (R(f).mt > 1.0 && R(f).mt < 2.0) { f.m.safe = 0.2; f.m.dodgeAge = 0; } });
    expect(R(f).grabbedOnce).toBe(true);
    expect(until(f, () => R(f).held === null, 15)).toBe(true);
    expect(GRAB_DRAG.drag).toBeGreaterThan(30);
  });
  it('the second drag can be dodged', () => {
    const f = mkRiver(); R(f).set('dragDeep'); f.brain.seen.add('dragDeep');
    expect(until(f, () => R(f).held === 'drag', 4)).toBe(true);
    expect(until(f, () => R(f).held === null, 15)).toBe(true);
    f.boss.set('idle'); R(f).set('dragDeep'); const hp0 = f.hp;
    steps(f, 3.0, () => { if (R(f).mt > 1.0 && R(f).mt < 2.0) f.m.safe = 0.2; });
    expect(R(f).held).toBeNull(); expect(f.hp).toBe(hp0);
  });
  it('the thrust is a plain strike now: it never seizes', () => {
    const f = mkRiver(); f.beginRound2(); R(f).set('thrust'); f.brain.seen.add('thrust'); steps(f, 1.2); expect(R(f).held).toBeNull();
  });
  it('a new fight forces the first drag again', () => {
    const f = mkRiver(); R(f).set('dragDeep'); f.brain.seen.add('dragDeep');
    expect(until(f, () => R(f).held === 'drag', 4)).toBe(true);
    expect(until(f, () => R(f).held === null, 15)).toBe(true);
    f.reset(false); expect(R(f).grabbedOnce).toBe(false);
  });
});
