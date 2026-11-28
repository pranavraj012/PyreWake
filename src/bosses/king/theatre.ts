// The Hanged King's moment plan (the moment theatre, src/dev/theatre.ts): what each of his ?moment= names stages.
//   ?boss=1&moment=noose     first-person scripted grab (the first throw of a fight)
//   ?boss=1&moment=rope      reward offer: the hanging King, the rope cut (press the attack button to take it)
//   ?boss=1&moment=ride      reward offer: round 2, the sideways lunge dodged, the ride on his back
import { OFFER, type King } from './king.ts';
import { place, type MomentPlan, type PlanCtx } from '../../dev/theatre.ts';

export const kingTheatre: MomentPlan = {
  what: { noose: 'first grab', rope: 'rope reward', ride: 'ride reward' },
  play(name: string, c: PlanCtx) {
    const k = c.sim as King, f = c.fight;
    if (name === 'noose') { place(c, 0, -4, 0, 0, -2.4); k.seize('noose', f); } // the first grab: the same call the throw's own hit makes
    if (name === 'rope') { place(c, 0, -4, 0, 0, -2.2); k.set('hang'); k.ht = 1; k.reward = 'rope'; k.rewardLeft = OFFER; } // the hanging King, the rope on offer
    if (name === 'ride') { c.round2(); place(c, 0, -4, 0, -1.4, -2.6); k.set('cross'); k.dodged(f); } // a perfect dodge of the lunge: the ride on offer
  },
};
