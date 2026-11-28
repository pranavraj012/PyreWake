import type { Def } from './bank/core.ts';
import { KING } from './bank/king.ts';
import { RIVER } from './bank/river.ts';
import { FIGHT, SCORE, RIVER_BEDS } from './bank/common.ts';
export { SR, render, courtIR } from './bank/core.ts';

/** Ordered by how soon they are needed. */
export const DEFS: Def[] = [
  ...FIGHT,
  ...KING,
  ...SCORE,
  ...RIVER,
  ...RIVER_BEDS,
];
