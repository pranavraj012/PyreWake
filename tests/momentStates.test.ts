// Boss moments against every state the hero can be busy in (module A): both bosses' grabs and rewards, each triggered while the hero
// attacks, charges, dodges, jumps, guards, casts, drinks, staggers or walks. While a moment is on, the hero's presses are the referee's to
// drop (a release still counts), and the moment must start, run to its end, leave the hero on the floor, inside the arena and controllable,
// and pay its damage or reward exactly once.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { type King, OFFER, REWARD_SHARE } from '../src/boss/king.ts';
import { River, RIVER_REWARD_SHARE } from '../src/boss/river/river.ts';
import { RiverBrain } from '../src/boss/river/brain.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60;
type Boss = 'king' | 'river';
type Moment = 'noose' | 'rope' | 'ride' | 'drag' | 'chain' | 'lantern';
type State = 'light' | 'heavy' | 'charge' | 'dodge' | 'jump' | 'guard' | 'spell' | 'flask' | 'stagger' | 'walk';

const MOMENTS: Record<Boss, Moment[]> = { king: ['noose', 'rope', 'ride'], river: ['drag', 'chain', 'lantern'] };
const STATES: State[] = ['light', 'heavy', 'charge', 'dodge', 'jump', 'guard', 'spell', 'flask', 'stagger', 'walk'];
const IDLE = /flick|clench|down|hurt|block|parry|die|land|rekindle/;
/** A moment is on: a grab holds him, or a reward is on offer or being played. */
const busyOf = (k: King & River) => !!(k.staging || k.reward);

/** How each state is entered (`press` at the start, `release` seconds later if it is let go before the moment), and the test that says the hero is in it. */
const SCRIPT: Record<State, { press: Press[]; release?: number; ready: (m: Motor) => boolean; minAge: number }> = {
  light: { press: [{ a: 'attack', up: false }], release: 0.05, ready: m => m.state === 'clip' && !!m.clip?.name.startsWith('light'), minAge: 0.08 },
  heavy: { press: [{ a: 'attack', up: false }], release: 0.4, ready: m => m.state === 'clip' && m.clip?.name === 'heavy', minAge: 0.05 },
  charge: { press: [{ a: 'attack', up: false }], ready: m => m.state === 'clip' && m.clip?.name === 'charge', minAge: 0.2 },
  dodge: { press: [{ a: 'dodge', up: false }], release: 0.05, ready: m => m.state === 'clip' && !!m.clip?.name.startsWith('dodge'), minAge: 0.05 },
  jump: { press: [{ a: 'jump', up: false }], release: 0.05, ready: m => m.y > 0.2, minAge: 0.15 },
  guard: { press: [{ a: 'guard', up: false }], ready: m => m.guardUp, minAge: 0.2 },
  spell: { press: [{ a: 'skill1', up: false }], release: 0.05, ready: m => m.state === 'clip' && m.clip?.name === 'rush', minAge: 0.05 },
  flask: { press: [{ a: 'heal', up: false }], release: 0.05, ready: m => m.state === 'clip' && m.clip?.name === 'heal', minAge: 0.1 },
  stagger: { press: [], ready: m => m.state === 'clip' && (m.clip?.name === 'down' || m.clip?.name === 'hurt'), minAge: 0.05 },
  walk: { press: [], ready: m => m.state === 'free' && m.speed > 1, minAge: 0.3 },
};

/** Hero two metres in front of the boss, facing it; a fresh fight with the boss passive (no moves of its own). */
function setup(boss: Boss, moment: Moment) {
  const f = boss === 'king' ? new Fight(new Motor()) : new Fight(new Motor(), new River(), new RiverBrain());
  if (moment === 'lantern') f.beginRound2();
  f.passive = true; f.invuln = 0; f.m.x = 0; f.m.z = -2; f.m.yaw = Math.PI; f.king.x = 0; f.king.z = -4; f.king.yaw = 0; f.fire = 100; f.hp = D.hp * 0.5;
  if (boss === 'river') f.brain.seen.add('dragDeep');
  return f;
}

/** The boss's own moment: a grab is set off at once (the strike connects a fraction of a second later); a reward is put on offer. */
function trigger(f: Fight, moment: Moment) {
  const k = f.king as King & River;
  if (moment === 'noose') k.set('grab', 8);
  else if (moment === 'drag') k.set('dragDeep', 8);
  else if (moment === 'rope' || moment === 'ride') { k.reward = moment; k.rewardLeft = OFFER; }
  else k.offer(moment);
}

function run(boss: Boss, moment: Moment, state: State) {
  const f = setup(boss, moment), k = f.king as King & River, m = f.m, sc = SCRIPT[state];
  const isGrab = moment === 'noose' || moment === 'drag';
  if (state === 'stagger') f.strikePlayer(8, true, Math.PI, 'stagger');
  const r = { triggered: false, onset: -1, end: -1, hpOnset: 0, hpEnd: 0, takenOnset: 0, takenEnd: 0, swings: 0, reeled: false, expect: 0, accepted: false, pool: 0, state: '' };
  let trig = -1, released = false, base = { hp: 0, taken: 0 };
  for (let i = 0; i < 40 * 60; i++) {
    const t = i * DT;
    const presses: Press[] = i === 0 ? sc.press.slice() : [];
    if (trig < 0 && !released && sc.release !== undefined && t >= sc.release && sc.press.length) { presses.push({ a: sc.press[0].a, up: true }); released = true; }
    // the hero's state is ready: the boss's moment is set off now (a charge or guard is let go in the middle of it, which the referee must drop)
    if (trig < 0 && t >= sc.minAge && sc.ready(m)) { trig = t; r.triggered = true; r.state = m.clip?.name ?? (m.guardUp ? 'guard' : m.y > 0 ? 'air' : m.state); trigger(f, moment); }
    if (trig >= 0 && !released && (state === 'charge' || state === 'guard') && t - trig >= 0.6) { presses.push({ a: state === 'guard' ? 'guard' : 'attack', up: true }); released = true; }
    // the page's rule: an offer is taken by the first press while its chance lasts, and that press is then the hero's reward, not an attack
    let pressesNow = presses;
    if (trig >= 0 && k.reward && !r.accepted && t - trig >= 1.0) { r.accepted = true; r.expect = Math.round(r.pool || (f.round === 2 ? D.boss.hp2 : D.boss.hp1) * (boss === 'king' ? REWARD_SHARE : RIVER_REWARD_SHARE)); k.takeReward(); pressesNow = presses.filter(p => p.up); }
    const busyBefore = !!(k.staging || k.reward);
    if (busyBefore && r.onset < 0) { r.onset = t; r.hpOnset = f.bossHp; r.takenOnset = f.taken; }
    // the page stops the hero's walk while a moment is on
    const mz = state === 'walk' && trig < 0 ? -1 : 0;
    f.step(DT, 0, busyBefore ? 0 : mz, pressesNow);
    if (r.onset >= 0 && busyBefore) { if (m.events.some(e => e === 'swing' || (e.startsWith('clip:') && !IDLE.test(e)))) r.swings++; if (k.mode === k.reelMode) r.reeled = true; }
    if (r.onset >= 0 && !(k.staging || k.reward)) { r.end = t; r.hpEnd = f.bossHp; r.takenEnd = f.taken; break; }
  }
  void base;
  return { f, m, k, r, isGrab };
}

describe('every boss moment, triggered in every hero state', () => {
  for (const boss of ['king', 'river'] as Boss[]) {
    for (const moment of MOMENTS[boss]) {
      for (const state of STATES) {
        it(`${boss} ${moment} during ${state}: starts, runs to its end, leaves the hero sane, pays once`, () => {
          const { f, m, k, r, isGrab } = run(boss, moment, state);
          expect(r.triggered, 'the hero reached the state').toBe(true);
          expect(r.onset, 'the moment started').toBeGreaterThanOrEqual(0);
          expect(r.end, 'the moment ran to its end').toBeGreaterThan(r.onset);
          // while it plays, the hero does not attack and the boss is not knocked out of it
          expect(r.swings, 'no attack of his during the moment').toBe(0);
          expect(r.reeled, 'the boss is not reeled out of the moment').toBe(false);
          if (isGrab) {
            expect(r.takenEnd - r.takenOnset, 'the grab lands once').toBe(1);
            expect(r.hpEnd, 'the boss takes nothing from the hero in the grab').toBe(r.hpOnset);
          } else {
            expect(r.takenEnd - r.takenOnset, 'a reward costs the hero nothing').toBe(0);
            expect(r.hpOnset - r.hpEnd, 'the reward is paid once').toBeCloseTo(r.expect, 0);
          }
          // a sane end: on the floor, inside the arena, alive, and his controls answer again
          expect(m.y).toBe(0);
          expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(m.arena + 0.05);
          expect(m.dead).toBe(false);
          // after a breath (he may be standing idle or flinching), an attack press still gets his blade out
          for (let i = 0; i < 3 * 60; i++) f.step(DT, 0, 0, []);
          f.step(DT, 0, 0, [{ a: 'attack', up: false }]);
          for (let i = 0; i < 2 * 60 && !m.clip?.name.startsWith('light'); i++) f.step(DT, 0, 0, []);
          expect(m.clip?.name ?? '', 'answers an attack after the moment').toMatch(/^light/);
          expect(busyOf(k)).toBe(false);
        });
      }
    }
  }
});
