// Every sound in the game, synthesised sample by sample. Pure functions: runs in a worker, and in Node for tools/sfx.mjs.
// The bank is split by owner: core.ts (the RNG, buffers, filters, envelopes, render), common.ts (hero, weapons, impacts, UI, beds, score),
// and one file per boss (king.ts, river.ts). This index merges them into DEFS in the order the bank has always rendered in.
import type { Def } from './core.ts';
import { FIGHT, SCORE, RIVER_BEDS } from './common.ts';
import { KING } from './king.ts';
import { RIVER } from './river.ts';
export { SR, render, courtIR } from './core.ts';
export type { Def } from './core.ts';
/** Ordered by how soon they are needed. */
export const DEFS: Def[] = [
  ...FIGHT,
  ...KING,
  ...SCORE,
  ...RIVER,
  ...RIVER_BEDS,
];
