// Ammaji, the Ash-Reader: met at the Last Pyre from the start. Lore, name-beads turned in for a little more life, and a line once the King is burned.
import type { Person } from '../dialogue.ts';
import { AMMAJI as W } from '../peopleScript.ts';
import { BOSS } from '../../game/progress.ts';

export const AMMAJI: Person = {
  id: 'ammaji',
  name: W.name,
  sub: W.sub,
  place: () => 'hub',
  entries: [
    { when: { notFlag: 'ammaji.met' }, start: 'meet' },
    { when: { all: [{ burned: BOSS.king }, { notFlag: 'ammaji.kingWord' }] }, start: 'kingWord' },
    { when: { always: true }, start: 'hub' },
  ],
  conv: {
    nodes: {
      meet: { lines: W.meet, voice: 'ammajiBreath', effects: [{ set: 'ammaji.met' }, { beads: 1 }], next: 'hub' },
      hub: {
        lines: W.hub, voice: 'ammajiBreath',
        choices: [
          { text: W.replies.lore, next: 'lore' },
          { text: W.replies.beads, when: { count: 'beads', atLeast: 3 }, effects: [{ turnInBeads: true }], next: 'beadsThanks' },
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
