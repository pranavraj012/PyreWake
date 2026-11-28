// The moment theatre: every ?moment= name starts its own moment within a second of the fight's clock, on the same boot a real fight takes.
import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { King } from '../src/bosses/king/king.ts';
import { Brain } from '../src/bosses/king/brain.ts';
import { River } from '../src/bosses/river/river.ts';
import { RiverBrain } from '../src/bosses/river/brain.ts';
import { Sister } from '../src/bosses/hours/sister.ts';
import { HoursBrain } from '../src/bosses/hours/brain.ts';
import { Motor } from '../src/player/motor.ts';
import { momentFromQuery, playMoment, type Boss } from '../src/dev/theatre.ts';
import { kingTheatre } from '../src/bosses/king/theatre.ts';
import { riverTheatre } from '../src/bosses/river/theatre.ts';
import { hoursTheatre } from '../src/bosses/hours/theatre.ts';

const DT = 1 / 60;
const SECOND = 60;

/** A fight as its page builds it: the boss's own brain, running. */
function page(boss: Boss) {
  const m = new Motor();
  if (boss === 'king') { const sim = new King(); return { f: new Fight(m, sim, new Brain()), m, sim }; }
  if (boss === 'river') { const sim = new River(); return { f: new Fight(m, sim, new RiverBrain()), m, sim }; }
  const sim = new Sister(); return { f: new Fight(m, sim, new HoursBrain()), m, sim };
}

/** Plays the name on a fresh page, and runs the fight for a second of its clock. */
function start(boss: Boss, name: string) {
  const p = page(boss); let round2 = 0, halfway = 0;
  const plan = { king: kingTheatre, river: riverTheatre, hours: hoursTheatre }[boss];
  const ok = playMoment(boss, name, { fight: p.f, m: p.m, sim: p.sim, round2: () => { round2++; p.f.beginRound2(); }, halfway: () => { halfway++; } }, plan);
  const after = () => { for (let i = 0; i < SECOND; i++) p.f.step(DT, 0, 0, []); };
  return { ...p, ok, round2: () => round2, halfway: () => halfway, after };
}

describe('the moment theatre: each ?moment= name starts its moment within a second', () => {
  it('the King: noose is the first grab (first person, held at once)', () => {
    const g = start('king', 'noose'); expect(g.ok).toBe(true);
    const k = g.sim as King; expect(k.held).toBe('noose'); g.after();
    expect(k.staging).toBe('noose');
  });
  it('the King: rope is the hanging King offering the rope; it stays on offer for the second', () => {
    const g = start('king', 'rope'); const k = g.sim as King;
    expect(k.reward).toBe('rope'); expect(k.hanging).toBe(true); g.after();
    expect(k.reward).toBe('rope'); expect(k.staging).toBeNull();
  });
  it('the King: ride is round 2, the lunge dodged, the ride on offer', () => {
    const g = start('king', 'ride'); const k = g.sim as King;
    expect(g.round2()).toBe(1); expect(k.reward).toBe('ride'); g.after(); expect(k.reward).toBe('ride');
  });
  it('the Ferryman: drag is the undertow grab, held at once', () => {
    const g = start('river', 'drag'); const s = g.sim as River;
    expect(s.held).toBe('drag'); g.after(); expect(s.staging).toBe('drag');
  });
  it('the Ferryman: chain is the cut chain offering the haul', () => {
    const g = start('river', 'chain'); const s = g.sim as River;
    expect(s.reward).toBe('chain'); g.after(); expect(s.reward).toBe('chain');
  });
  it('the Ferryman: lantern is round 2 with the lamps gone out, offering the lantern', () => {
    const g = start('river', 'lantern'); const s = g.sim as River;
    expect(g.round2()).toBe(1); expect(s.reward).toBe('lantern'); g.after(); expect(s.reward).toBe('lantern');
  });
  it('the Sister: gather is the Pall grapple; the arm reaches the hero and grips him', () => {
    const g = start('hours', 'gather'); const s = g.sim as Sister;
    expect(g.round2()).toBe(1); expect(s.mode).toBe('gather');
    let gripped = false; for (let i = 0; i < SECOND && !gripped; i++) { g.f.step(DT, 0, 0, []); gripped = s.mode === 'grip'; }
    expect(gripped).toBe(true);
  });
  it('the Sister: turn is the half-way turn, as ?turn plays it', () => {
    const g = start('hours', 'turn');
    expect(g.halfway()).toBe(1); expect(g.f.passive).toBe(false); expect(g.f.bossHp).toBe(1);
  });
  it('an unknown name for a page is refused, and the query names only what the page has', () => {
    expect(start('king', 'drag').ok).toBe(false);
    expect(momentFromQuery(new URLSearchParams('moment=gather'), 'hours')).toBe('gather');
    expect(momentFromQuery(new URLSearchParams('moment=gather'), 'king')).toBeNull();
    expect(momentFromQuery(new URLSearchParams(''), 'king')).toBeNull();
  });
});
