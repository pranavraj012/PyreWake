// The Sister of Hours' moment plan (the moment theatre, src/dev/theatre.ts): what each of her ?moment= names stages.
//   ?boss=3&moment=gather    the Pall's grapple (round 2): the arm goes out and catches you
//   ?boss=3&moment=turn      the half-way turn (the same as ?turn)
import type { Sister } from './sister.ts';
import { place, type MomentPlan, type PlanCtx } from '../../dev/theatre.ts';

export const hoursTheatre: MomentPlan = {
  what: { gather: 'the Pall grapple', turn: 'half-way turn' },
  play(name: string, c: PlanCtx) {
    const s = c.sim as Sister, f = c.fight;
    // the Pall's arm goes out; the hero is in its line (seen: no teaching slow-down on a replay)
    if (name === 'gather') { c.round2(); place(c, 0, -4, 0, 0, -1.0); f.brain.seen.add('gather'); s.set('gather'); }
    if (name === 'turn') { f.bossHp = 1; f.hits = 5; f.passive = false; c.halfway?.(); }
  },
};
