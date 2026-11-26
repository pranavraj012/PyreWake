// Ammaji, the Ash-Reader: met at the Last Pyre from the start. Lore, name-beads for flask strength, and a line once the King is burned.
import type { Person } from '../dialogue.ts';
import { AMMAJI as W } from '../peopleScript.ts';

export const AMMAJI: Person = {
  id: 'ammaji',
  name: W.name,
  sub: W.sub,
  place: () => 'hub',
  entries: [
    { when: { notFlag: 'ammaji.met' }, start: 'meet' },
    { when: { all: [{ burned: 'king' }, { notFlag: 'ammaji.kingWord' }] }, start: 'kingWord' },
    { when: { always: true }, start: 'hub' },
  ],
  conv: {
    nodes: {
      meet: { lines: W.meet, voice: 'ammajiBreath', effects: [{ set: 'ammaji.met' }, { beads: 1 }], next: 'hub' },
      hub: {
        lines: W.hub, voice: 'ammajiBreath',
        choices: [
          { text: W.replies.lore, next: 'lore' },
          { text: W.replies.beads, when: { count: 'beads', atLeast: 3 }, effects: [{ beads: -3 }, { flask: 1 }], next: 'beadsThanks' },
          { text: W.replies.shop, effects: [{ shop: 'ammaji' }], next: null },
          { text: W.replies.leave, next: null },
        ],
      },
      lore: { lines: W.lore, next: 'hub' },
      beadsThanks: { lines: W.beadsThanks, next: 'hub' },
      kingWord: { lines: W.kingWord, voice: 'ammajiBreath', effects: [{ set: 'ammaji.kingWord' }], next: 'hub' },
    },
  },
};
