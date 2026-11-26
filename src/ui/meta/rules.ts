// Module I: the rules the meta screens follow (buying, equipping, wearing, travelling). No DOM here, so the tests can run them.
// Prices, the buying itself, the life gift from beads and charm cords are module B's (priceOf, buy, turnInBeads, charmSlots);
// this file adds the refusal reasons the screens show, and the rules B does not own (equipping spells, wearing charms, travel).
// Every mutation takes a draft Progress, so the screens call these inside progress.change(...).
import { type Progress, RULES, buy, charmSlots, priceOf, turnInBeads } from '../../game/progress.ts';

export type Refusal = 'unknown' | 'kauri' | 'iron' | 'owned' | 'notowned' | 'slots' | 'nowhere' | 'same' | 'beads';
export type Verdict = { ok: true } | { ok: false; why: Refusal };
const OK: Verdict = { ok: true };
const no = (why: Refusal): Verdict => ({ ok: false, why });

/** Name-beads given for one life gift at the Ash-Reader (module B: three beads make one tenth more life). */
export const BEADS_PER_LIFE = RULES.beadsPerLifeTenth;

/** Already owned? Read from progress. Stacking upgrades (weapon levels, flasks, strength) are never owned. */
export function isOwned(p: Readonly<Progress>, id: string): boolean {
  if (id.startsWith('weapon:')) return p.weapons.includes(id.slice('weapon:'.length));
  if (id.startsWith('spell:')) return p.spells.includes(id.slice('spell:'.length));
  if (id.startsWith('charm:')) return p.charms.includes(id.slice('charm:'.length));
  if (id === 'charm-slot') return charmSlots(p) >= RULES.maxCharmSlots;
  return false;
}

/** Can this buy go through? Checked in the order a player reads them: owned, sold at all, then the purse. */
export function checkBuy(p: Readonly<Progress>, id: string): Verdict {
  if (isOwned(p, id)) return no('owned');
  const c = priceOf(id, p as Progress);
  if (!c) return no('unknown');
  if (p.kauri < c.kauri) return no('kauri');
  if (p.iron < c.iron) return no('iron');
  return OK;
}

/** Buy on a draft: module B takes the price and applies the effect. Refused drafts are left untouched. */
export function applyBuy(p: Progress, id: string): Verdict {
  const v = checkBuy(p, id);
  if (!v.ok) return v;
  return buy(p, id).ok ? OK : no('unknown');
}

/** Put a carried spell in slot 0 (first) or 1 (second). A spell already in the other slot moves over: two slots never hold the same art. */
export function equipSpell(p: Progress, slot: 0 | 1, id: string): Verdict {
  if (!p.spells.includes(id)) return no('notowned');
  const e: [string, string] = [...p.equipped];
  if (e[1 - slot] === id) e[1 - slot] = e[slot];
  e[slot] = id; p.equipped = e;
  return OK;
}

/** Can this charm be worn? Owned charms only; no more than the cords allow. Wearing one already worn is fine (nothing to do). */
export function checkWear(p: Readonly<Progress>, id: string): Verdict {
  if (!p.charms.includes(id)) return no('notowned');
  if (p.worn.includes(id)) return OK;
  if (p.worn.length >= charmSlots(p)) return no('slots');
  return OK;
}

export function wear(p: Progress, id: string): Verdict {
  const v = checkWear(p, id);
  if (v.ok && !p.worn.includes(id)) p.worn = [...p.worn, id];
  return v;
}

export function takeOff(p: Progress, id: string): Verdict {
  p.worn = p.worn.filter(x => x !== id);
  return OK;
}

/** Travel to a lit shrine. Unlit shrines are refused. */
export function checkTravel(p: Readonly<Progress>, shrine: string, region: string): Verdict {
  if (!p.shrines.includes(shrine)) return no('nowhere');
  if (p.at.shrine === shrine && p.at.region === region) return no('same');
  return OK;
}

export function travel(p: Progress, shrine: string, region: string): Verdict {
  const v = checkTravel(p, shrine, region);
  if (v.ok) p.at = { region, shrine };
  return v;
}

/** Three Name-beads for one life gift: module B's turnInBeads does the taking and the giving. */
export function giveBeads(p: Progress): Verdict {
  if (p.beads < BEADS_PER_LIFE) return no('beads');
  return turnInBeads(p) ? OK : no('beads');
}
