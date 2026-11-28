// The Ferryman's moment plan (the moment theatre, src/dev/theatre.ts): what each of his ?moment= names stages.
//   ?boss=2&moment=drag      scripted first grab: the undertow drag
//   ?boss=2&moment=chain     reward offer: the chain cut, press to haul
//   ?boss=2&moment=lantern   reward offer: round 2, the lamps gone out, press for the lantern
import type { River } from './river.ts';
import { place, type MomentPlan, type PlanCtx } from '../../dev/theatre.ts';

export const riverTheatre: MomentPlan = {
  what: { drag: 'first grab', chain: 'chain reward', lantern: 'lantern reward' },
  play(name: string, c: PlanCtx) {
    const s = c.sim as River, f = c.fight;
    if (name === 'drag') { place(c, 0, -4, 0, 0, -2.4); s.seize('drag', f); } // the undertow's grab
    if (name === 'chain') { place(c, 0, -4, 0, 0, -1.6); s.offer('chain'); } // the chain cut: the reward on offer
    if (name === 'lantern') { c.round2(); place(c, 0, -4, 0, 0, -1.6); s.offer('lantern'); } // round 2: the lamps gone out
  },
};
