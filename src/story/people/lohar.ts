// Lohar, the Smith: found in the Gravedigger's pit in the Ashfields, and moves to the Last Pyre once the King is burned.
import type { Person } from '../dialogue.ts';
import { LOHAR as W } from '../peopleScript.ts';
import { BOSS } from '../../game/progress.ts';

const wares = { text: W.replies.wares, effects: [{ shop: 'lohar' as const }], next: null };

export const LOHAR: Person = {
  id: 'lohar',
  name: W.name,
  sub: W.sub,
  place: p => (p.flags['lohar.hub'] ? 'hub' : 'ashfields'),
  entries: [
    { when: { notFlag: 'lohar.met' }, start: 'meet' },
    { when: { all: [{ burned: BOSS.king }, { notFlag: 'lohar.kingWord' }] }, start: 'kingWord' },
    { when: { flag: 'lohar.hub' }, start: 'atHub' },
    { when: { always: true }, start: 'pit' },
  ],
  conv: {
    nodes: {
      meet: { lines: W.meet, voice: 'loharBreath', effects: [{ set: 'lohar.met' }], next: 'pit' },
      pit: { lines: W.pit, voice: 'loharBreath', choices: [wares, { text: W.replies.farewell, next: null }] },
      atHub: { lines: W.atHub, voice: 'loharBreath', choices: [wares, { text: W.replies.farewell, next: null }] },
      kingWord: { lines: W.kingWord, voice: 'loharBreath', effects: [{ set: 'lohar.kingWord' }, { set: 'lohar.hub' }], next: 'atHub' },
    },
  },
};
