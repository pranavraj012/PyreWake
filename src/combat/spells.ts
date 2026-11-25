// The six fire arts. Two are carried into a fight, chosen on the title screen; Last Rites is always the third.
export type SpellId = 'rush' | 'sunder' | 'brand' | 'ashstep' | 'wheel' | 'ashfall';
export interface Spell { id: SpellId; name: string; /** On the touch button. */ short: string; cost: number; /** Clip it plays. */ clip: string; /** What the title screen says. */ info: string; /** The prompt when it is ready. */ ready: string; icon: string }
export const SPELLS: Record<SpellId, Spell> = {
  rush: { id: 'rush', name: 'Cinder Rush', short: 'Rush', cost: 40, clip: 'rush', info: 'Gone in ash, straight through it, and the line you left behind you burns.', ready: 'Fire ready: Cinder Rush, straight through it', icon: '<path d="M4 18c5-1 4-6 9-7s5-4 7-6M4 13c3 0 4-2 6-4"/>' },
  sunder: { id: 'sunder', name: 'Sunder Arc', short: 'Sunder', cost: 50, clip: 'sunder', info: 'A cut that leaves the blade and flies. Breaks whatever it is doing.', ready: 'Sunder Arc: cut from afar', icon: '<path d="M4 17C6 9 12 5 20 5c-5 2-9 6-9 13-2-2-4-2-7-1z"/>' },
  brand: { id: 'brand', name: 'Pyre Brand', short: 'Brand', cost: 50, clip: 'brand', info: 'Drive the blade into the stone. A ring of fire answers, then the ground beneath it goes up.', ready: 'Fire ready: Pyre Brand, close in', icon: '<path d="M12 3v12m-4-4 4 4 4-4M5 20h14M7 17c-2 1-3 2-2 3m12-3c2 1 3 2 2 3"/>' },
  ashstep: { id: 'ashstep', name: 'Ashen Step', short: 'Step', cost: 35, clip: 'ashstep', info: 'Become ash where you stand and fall on it from behind.', ready: 'Fire ready: Ashen Step, behind it', icon: '<path d="M6 20c0-5 3-7 6-7m0 0c3 0 6-2 6-7m-6 7V4m0 0-3 3m3-3 3 3M4 9h2m12 6h2"/>' },
  wheel: { id: 'wheel', name: 'Funeral Wheel', short: 'Wheel', cost: 45, clip: 'pyreWheel', info: 'The blade catches and you turn with it: three burning turns that cut all around.', ready: 'Fire ready: Funeral Wheel, close in', icon: '<path d="M12 4a8 8 0 1 1-8 8m8-8-3-1m3 1-1 3M12 9a3 3 0 1 1-3 3"/>' },
  ashfall: { id: 'ashfall', name: 'Ashfall', short: 'Ashfall', cost: 60, clip: 'ashfall', info: 'Raise the burnt hand: the sky lets go of its embers onto it, wherever it stands.', ready: 'Fire ready: Ashfall, from anywhere', icon: '<path d="M12 3v5M7 5l2 4m8-4-2 4M6 13l1 3m5-2v4m5-5-1 3M5 21h14"/>' },
};
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];
export const DEFAULT_SPELLS: [SpellId, SpellId] = ['rush', 'sunder'];
/** Anything saved that no longer names two different spells comes back as the default pair. */
export const sane = (s: unknown): [SpellId, SpellId] => Array.isArray(s) && s.length === 2 && s[0] !== s[1] && s.every(x => x in SPELLS) ? s as [SpellId, SpellId] : [...DEFAULT_SPELLS];
