// Module B: the player's progress (STUB: interface published so modules G, I and E can code against it).
// Module B replaces the bodies; the exported names and shapes stay.

export type WeaponKind = 'khanda' | 'spear' | 'chakram' | 'whip';

export interface Progress {
  fares: number; iron: number; beads: number;
  weapon: { kind: WeaponKind; level: number }; weapons: string[];
  flasks: { count: number; strength: number }; spells: string[]; equipped: [string, string]; charms: string[]; worn: string[];
  shrines: string[]; at: { region: string; shrine: string }; burned: string[];   // boss ids
  flags: Record<string, number | boolean | string>;                              // quests, people, doors, secrets taken
  dropped: { region: string; x: number; z: number; fares: number } | null;       // fares left where you fell
}

export function fresh(): Progress {
  return {
    fares: 0, iron: 0, beads: 0,
    weapon: { kind: 'khanda', level: 0 }, weapons: ['khanda'],
    flasks: { count: 3, strength: 0 }, spells: [], equipped: ['', ''], charms: [], worn: [],
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

/** Cost of an upgrade, or null when it cannot be bought (unknown, or at its cap). STUB: always null. */
export function priceOf(_upgrade: string, _p: Progress): { fares: number; iron: number } | null { return null; }

/** What a fight reads. STUB: neutral values (a fight given no progress behaves as today). */
export function stats(_p: Progress): { life: number; damage: number; flaskHeal: number } {
  return { life: 1, damage: 1, flaskHeal: 1 };
}
