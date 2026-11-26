// Module I: the rules the meta screens follow (buying, equipping, wearing, travelling). No DOM here, so the tests can run them.
// Every mutation takes a draft Progress, so the screens call these inside progress.change(...).
import type { Progress, WeaponKind } from '../../game/progress.ts';

export interface Price { fares: number; iron: number }
/** priceOf from module B: null when the upgrade cannot be bought now (unknown, or at its cap). */
export type PriceFn = (id: string, p: Progress) => Price | null;

export type Refusal = 'unknown' | 'fares' | 'iron' | 'owned' | 'notowned' | 'slots' | 'nowhere' | 'same' | 'beads';
export type Verdict = { ok: true } | { ok: false; why: Refusal };
const OK: Verdict = { ok: true };
const no = (why: Refusal): Verdict => ({ ok: false, why });

/** Charm cords: two at first, a third when bought or found (flags.slot3). */
export function charmSlots(p: Readonly<Progress>): number { return p.flags.slot3 ? 3 : 2; }

/** Name-beads given for one life gift at the Ash-Reader. */
export const BEADS_PER_LIFE = 3;

/** Already owned? Stackable upgrades (weapon levels, flasks) are never owned. */
export function isOwned(p: Readonly<Progress>, id: string): boolean {
  if (id.startsWith('spell.')) return p.spells.includes(id.slice(6));
  if (id === 'charm.slot') return !!p.flags.slot3;
  if (id.startsWith('charm.')) return p.charms.includes(id.slice(6));
  if (id.startsWith('weapon.') && id !== 'weapon.level') return p.weapons.includes(id.slice(7));
  return false;
}

/** Can this buy go through? Checks in the order a player would read them: sold at all, not owned, then the purse. */
export function checkBuy(p: Readonly<Progress>, id: string, price: PriceFn): Verdict {
  const c = price(id, p as Progress);
  if (!c) return no('unknown');
  if (isOwned(p, id)) return no('owned');
  if (p.fares < c.fares) return no('fares');
  if (p.iron < c.iron) return no('iron');
  return OK;
}

/** Buy on a draft: takes the price and applies the effect. Refused drafts are left untouched. */
export function applyBuy(p: Progress, id: string, price: PriceFn): Verdict {
  const v = checkBuy(p, id, price);
  if (!v.ok) return v;
  const c = price(id, p)!;
  p.fares -= c.fares; p.iron -= c.iron;
  if (id === 'weapon.level') p.weapon = { kind: p.weapon.kind, level: p.weapon.level + 1 };
  else if (id.startsWith('weapon.')) { const kind = id.slice(7) as WeaponKind; p.weapons = [...p.weapons, kind]; p.weapon = { kind, level: 0 }; }
  else if (id === 'flask.count') p.flasks = { ...p.flasks, count: p.flasks.count + 1 };
  else if (id === 'flask.strength') p.flasks = { ...p.flasks, strength: p.flasks.strength + 1 };
  else if (id === 'charm.slot') p.flags.slot3 = true;
  else if (id.startsWith('charm.')) p.charms = [...p.charms, id.slice(6)];
  else if (id.startsWith('spell.')) p.spells = [...p.spells, id.slice(6)];
  return OK;
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

/** Three Name-beads for one life gift (flags.lifeBeads counts the gifts; module B's stats() reads it). */
export function giveBeads(p: Progress): Verdict {
  if (p.beads < BEADS_PER_LIFE) return no('beads');
  p.beads -= BEADS_PER_LIFE;
  const n = typeof p.flags.lifeBeads === 'number' ? p.flags.lifeBeads : 0;
  p.flags.lifeBeads = n + 1;
  return OK;
}
