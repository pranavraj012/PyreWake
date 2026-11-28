import { SPELL_IDS, type SpellId } from '../combat/spells.ts';
import type { BossId } from '../bosses/index.ts';
// Module B: the player's progress and the rules that change it.
// Exported names and shapes are the published interface (modules E, G, I code against them); add, never rename.

export type WeaponKind = 'khanda' | 'spear' | 'chakram' | 'whip';

export interface Progress {
  kauri: number; iron: number; beads: number;
  weapon: { kind: WeaponKind; level: number }; weapons: string[];
  flasks: { count: number; strength: number }; spells: string[]; equipped: [string, string]; charms: string[]; worn: string[];
  shrines: string[]; at: { region: string; shrine: string }; burned: string[];   // boss ids
  flags: Record<string, number | boolean | string>;                              // quests, people, doors, secrets taken
  dropped: { region: string; x: number; z: number; kauri: number } | null;       // kauri left where you fell
}

export const WEAPON_KINDS: readonly WeaponKind[] = ['khanda', 'spear', 'chakram', 'whip'];

/** Boss ids, as the codebase names them (the folders under src/bosses/ and the fight modules). `burned` holds these. */
export const BOSS = { king: 'king', ferryman: 'river', sister: 'hours' } as const satisfies Record<string, BossId>;

/** Tunable numbers, kept in one place for module M (balance). */
export const RULES = {
  maxWeaponLevel: 10,
  /** Pyre-iron needed to reach a weapon level (levels not listed cost none). */
  ironAtLevel: { 4: 1, 7: 2, 10: 3 } as Record<number, number>,
  /** Kauri to reach weapon level L is feesPerLevel * L. */
  feesPerLevel: 20,
  damagePerLevel: 0.06,
  maxFlasks: 5,
  flaskPrice: 60,
  maxFlaskStrength: 3,
  flaskStrengthPrice: (strength: number) => 80 * (strength + 1),
  flaskHealPerStrength: 0.25,
  beadsPerLifeTenth: 3,
  lifePerTenth: 0.1,
  spellPrice: 120,
  charmSlotsStart: 2,
  maxCharmSlots: 3,
  charmSlotPrice: { kauri: 250, iron: 2 },
  /** Price of each charm you can buy by name. PLACEHOLDER numbers until module M balances them. */
  charmPrice: {
    ember: { kauri: 120, iron: 0 },
    quick: { kauri: 110, iron: 0 },
    perfect: { kauri: 160, iron: 1 },
  } as Record<string, { kauri: number; iron: number }>,
  newWeaponPrice: {
    spear: { kauri: 150, iron: 2 },
    chakram: { kauri: 300, iron: 4 },
    whip: { kauri: 450, iron: 6 },
  } as Record<Exclude<WeaponKind, 'khanda'>, { kauri: number; iron: number }>,
  /** How close (in world units) you must come to your dropped kauri to take them back. */
  recoverReach: 2,
};

/** The hero's three fire arts at the start; two are carried (equipped) into a fight. Last Rites is always the third. */
export const STARTING_SPELLS: readonly string[] = ['rush', 'sunder', 'brand'];

export function fresh(): Progress {
  return {
    kauri: 0, iron: 0, beads: 0,
    weapon: { kind: 'khanda', level: 0 }, weapons: ['khanda'],
    flasks: { count: 3, strength: 0 }, spells: [...STARTING_SPELLS], equipped: [STARTING_SPELLS[0], STARTING_SPELLS[1]], charms: [], worn: [],
    shrines: [], at: { region: 'ashfields', shrine: '' }, burned: [],
    flags: {}, dropped: null,
  };
}

let state: Progress = fresh();
const listeners = new Set<(p: Progress) => void>();

export const progress = {
  get(): Readonly<Progress> { return state; },
  change(f: (p: Progress) => void): void { f(state); for (const l of listeners) l(state); },
  on(f: (p: Progress) => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; },
};

/** Replaces the whole state (used when a save is loaded). Listeners are told. */
export function replaceProgress(p: Progress): void {
  state = p;
  for (const l of listeners) l(state);
}

const num = (p: Progress, key: string): number => {
  const v = p.flags[key];
  return typeof v === 'number' ? v : 0;
};

/** Charm slots you have (2 at first, 3 after the upgrade). */
export function charmSlots(p: Progress): number {
  return Math.max(RULES.charmSlotsStart, num(p, 'charmSlots'));
}

/** Life tenths bought with Name-beads (three beads each). */
export function lifeTenths(p: Progress): number {
  return num(p, 'lifeTenths');
}

/** Cost of an upgrade, or null when it cannot be bought (unknown, owned, or at its cap).
 *  Upgrade ids: 'weapon-level' (the current weapon, one level up), 'weapon:<kind>' (a new weapon),
 *  'flask' (one more flask), 'flask-strength', 'spell:<name>', 'charm-slot'. */
export function priceOf(upgrade: string, p: Progress): { kauri: number; iron: number } | null {
  if (upgrade === 'weapon-level') {
    const next = p.weapon.level + 1;
    if (next > RULES.maxWeaponLevel) return null;
    return { kauri: RULES.feesPerLevel * next, iron: RULES.ironAtLevel[next] ?? 0 };
  }
  if (upgrade.startsWith('weapon:')) {
    const kind = upgrade.slice('weapon:'.length) as WeaponKind;
    if (kind === 'khanda' || !WEAPON_KINDS.includes(kind)) return null;
    if (p.weapons.includes(kind)) return null;
    return { ...RULES.newWeaponPrice[kind] };
  }
  if (upgrade === 'flask') {
    if (p.flasks.count >= RULES.maxFlasks) return null;
    return { kauri: RULES.flaskPrice, iron: 0 };
  }
  if (upgrade === 'flask-strength') {
    if (p.flasks.strength >= RULES.maxFlaskStrength) return null;
    return { kauri: RULES.flaskStrengthPrice(p.flasks.strength), iron: 0 };
  }
  if (upgrade.startsWith('spell:')) {
    const name = upgrade.slice('spell:'.length);
    if (!SPELL_IDS.includes(name as SpellId) || p.spells.includes(name)) return null;
    return { kauri: RULES.spellPrice, iron: 0 };
  }
  if (upgrade.startsWith('charm:')) {
    const name = upgrade.slice('charm:'.length);
    const c = RULES.charmPrice[name];
    if (!c || p.charms.includes(name)) return null;
    return { ...c };
  }
  if (upgrade === 'charm-slot') {
    if (charmSlots(p) >= RULES.maxCharmSlots) return null;
    return { ...RULES.charmSlotPrice };
  }
  return null;
}

export type BuyResult =
  | { ok: true; kauri: number; iron: number }
  | { ok: false; reason: 'unavailable' | 'poor' };

/** Buys an upgrade on this progress object (mutates it). Refuses, changing nothing, when it cannot be
 *  bought or the player is short of kauri or iron. */
export function buy(p: Progress, upgrade: string): BuyResult {
  const price = priceOf(upgrade, p);
  if (!price) return { ok: false, reason: 'unavailable' };
  if (p.kauri < price.kauri || p.iron < price.iron) return { ok: false, reason: 'poor' };
  p.kauri -= price.kauri;
  p.iron -= price.iron;
  if (upgrade === 'weapon-level') {
    p.weapon.level += 1;
  } else if (upgrade.startsWith('weapon:')) {
    const kind = upgrade.slice('weapon:'.length) as WeaponKind;
    // Each weapon keeps its own level: the old one's level is stashed in flags and restored on switching back.
    p.flags[`weaponLevel.${p.weapon.kind}`] = p.weapon.level;
    p.weapons.push(kind);
    p.weapon = { kind, level: 0 };
  } else if (upgrade === 'flask') {
    p.flasks.count += 1;
  } else if (upgrade === 'flask-strength') {
    p.flasks.strength += 1;
  } else if (upgrade.startsWith('spell:')) {
    p.spells.push(upgrade.slice('spell:'.length));
  } else if (upgrade.startsWith('charm:')) {
    p.charms.push(upgrade.slice('charm:'.length));
  } else if (upgrade === 'charm-slot') {
    p.flags.charmSlots = charmSlots(p) + 1;
  }
  return { ok: true, kauri: price.kauri, iron: price.iron };
}

/** Buys an upgrade on the live progress; the result says what happened. */
export function purchase(upgrade: string): BuyResult {
  let result: BuyResult = { ok: false, reason: 'unavailable' };
  progress.change(p => { result = buy(p, upgrade); });
  return result;
}

/** Switches to an owned weapon, restoring its own level. Returns false when it is not owned. */
export function equipWeapon(p: Progress, kind: WeaponKind): boolean {
  if (!p.weapons.includes(kind) || p.weapon.kind === kind) return p.weapon.kind === kind;
  p.flags[`weaponLevel.${p.weapon.kind}`] = p.weapon.level;
  const stored = p.flags[`weaponLevel.${kind}`];
  p.weapon = { kind, level: typeof stored === 'number' ? stored : 0 };
  return true;
}

/** Turns in Name-beads for life: three beads give one tenth more life. Returns false when short. */
export function turnInBeads(p: Progress): boolean {
  if (p.beads < RULES.beadsPerLifeTenth) return false;
  p.beads -= RULES.beadsPerLifeTenth;
  p.flags.lifeTenths = lifeTenths(p) + 1;
  return true;
}

/** The player dies in the world: the kauri they carry lie where they fell. A pile already on the ground
 *  (died before taking it back) is lost. */
export function die(p: Progress, region: string, x: number, z: number): void {
  p.dropped = p.kauri > 0 ? { region, x, z, kauri: p.kauri } : null;
  p.kauri = 0;
}

/** Takes the dropped kauri back if the player is in the same region and within reach. Once: the pile is
 *  gone after this. Returns the kauri recovered (0 when nothing was taken). */
export function recoverKauri(p: Progress, region: string, x: number, z: number, reach = RULES.recoverReach): number {
  const d = p.dropped;
  if (!d || d.region !== region) return 0;
  if (Math.hypot(d.x - x, d.z - z) > reach) return 0;
  p.kauri += d.kauri;
  p.dropped = null;
  return d.kauri;
}

/** Rests at a shrine: it becomes the place you wake at, and it is remembered as lit. */
export function rest(p: Progress, region: string, shrine: string): void {
  p.at = { region, shrine };
  if (!p.shrines.includes(shrine)) p.shrines.push(shrine);
}

/** What a fight reads. Neutral (1, 1, 1) for fresh progress, so a fight given no progress behaves as today. */
export function stats(p: Progress): { life: number; damage: number; flaskHeal: number } {
  return {
    life: 1 + RULES.lifePerTenth * lifeTenths(p),
    damage: 1 + RULES.damagePerLevel * p.weapon.level,
    flaskHeal: 1 + RULES.flaskHealPerStrength * p.flasks.strength,
  };
}
