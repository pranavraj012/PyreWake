// Text of the meta screens. Item descriptions and vendors' words are in the archaic register (docs/game STYLE.md);
// controls, labels and messages are plain modern English.

export const REGIONS: Record<string, string> = {
  ashfields: 'The Ashfields and the Banyan Road',
  ghats: 'The Ghats',
  hill: 'The Hill Road and the Sick-houses',
  street: 'The Burning Street',
  pyre: 'Into the Pyre',
};

export const WEAPONS: Record<WeaponName, string> = {
  khanda: 'Khanda',
  spear: 'The Spear',
  chakram: 'Chakrams',
  whip: 'The whip-sword',
};
type WeaponName = 'khanda' | 'spear' | 'chakram' | 'whip';

export interface Entry { name: string; text: string }

export const ITEMS: Record<string, Entry> = {
  'weapon.level': { name: 'Temper the blade', text: 'Thy blade goes back into the fire and comes out with a finer edge. Its blows bite six in a hundred deeper.' },
  'weapon.spear': { name: 'The Spear', text: 'A shaft of ash-wood with a leaf of iron at its end. Thou shalt strike the drowned before they reach thee.' },
  'weapon.chakram': { name: 'Chakrams', text: 'Rings of iron, edged all round. They are thrown, and they come back to thy hand, cutting what they pass.' },
  'weapon.whip': { name: 'The whip-sword', text: 'A blade that bends when it is swung, and so reaches where a straight blade cannot. Thou must learn its curve.' },
  'flask.count': { name: 'A flask', text: 'A vessel of clay with a cork of linen. Thou mayst carry one more.' },
  'flask.strength': { name: 'Stronger water', text: 'The Ash-Reader mixes it stronger. Each draught shall mend thee the more.' },
  'spell.ashstep': { name: 'Ashen Step', text: 'Thou shalt become ash where thou standest, and fall upon the foe from behind.' },
  'spell.wheel': { name: 'Funeral Wheel', text: 'The blade catches thee, and thou turnest with it three times, burning all about thee.' },
  'spell.ashfall': { name: 'Ashfall', text: 'Raise the burnt hand, and the sky shall let fall its embers upon whatsoever standeth below.' },
  'charm.slot': { name: 'A third cord', text: 'A third cord of linen for the wearing of charms. Thou hast room for one more.' },
  'charm.ember': { name: 'Ember hem', text: 'Thy dodges leave embers behind them, and the ground where they fall burns a little while.' },
  'charm.quick': { name: 'Quickened breath', text: 'Thy heals come the sooner, but they mend less.' },
  'charm.perfect': { name: 'Stillness', text: 'A dodge made true kindleth a little fire within thee.' },
  'beads.life': { name: 'Three Name-beads', text: 'Bring three beads from the rosary of the unburned unto the Ash-Reader, and she shall give thee a little more of life.' },
};

/** The vendors: the Smith (weapons) and the Ash-Reader (flasks, fire arts, charms, life). */
export const VENDORS = {
  smith: {
    title: 'Lohar, the Smith',
    intro: 'Bring me iron and Fares, and I will make thy blade keener.',
    items: ['weapon.level', 'weapon.spear', 'weapon.chakram', 'weapon.whip'],
  },
  ash: {
    title: 'Ammaji, the Ash-Reader',
    intro: 'Sit. Show me what thou carriest, and I will tell thee what it is worth.',
    items: ['flask.count', 'flask.strength', 'spell.ashstep', 'spell.wheel', 'spell.ashfall', 'charm.slot', 'charm.ember', 'charm.quick', 'charm.perfect'],
  },
} as const;
export type VendorId = keyof typeof VENDORS;

/** Plain words: controls, labels, messages. */
export const UI = {
  close: 'Close',
  buy: 'Buy',
  owned: 'Owned',
  unsold: 'Not for sale just now',
  cost: 'Cost',
  fares: 'Fares',
  iron: 'Pyre-iron',
  have: 'You have',
  done: 'Done.',
  level: 'Level',
  giveBeads: 'Give three',
  beadsHave: (n: number) => `You carry ${n} of 3.`,
  refusal: {
    unknown: 'Not for sale just now.',
    fares: 'Not enough Fares.',
    iron: 'Not enough Pyre-iron.',
    owned: 'You already have this.',
    notowned: 'You do not have this yet.',
    slots: 'No free charm cord. Take one off first.',
    nowhere: 'That shrine is not lit.',
    same: 'You are already here.',
    beads: 'Three Name-beads are needed.',
  } as Record<string, string>,
  inventory: {
    title: 'Inventory',
    spells: 'Fire arts',
    spellsHint: 'Carry two. Choose a slot; a spell already in the other slot moves over.',
    noSpells: 'You have no fire arts yet.',
    slot1: 'Use in slot 1',
    slot2: 'Use in slot 2',
    slotNow: (n: number) => `In slot ${n}`,
    charms: 'Charms',
    charmsHint: (worn: number, slots: number) => `${worn} of ${slots} cords in use.`,
    noCharms: 'You have no charms yet.',
    wear: 'Wear',
    off: 'Take off',
    worn: 'Worn',
  },
  map: {
    title: 'Shrines',
    intro: 'Shrines you have lit. Travel to any of them.',
    none: 'No shrine is lit yet. Rest at a shrine to light it.',
    here: 'You are here',
    travel: 'Travel',
  },
  fares: { fares: 'Fares', iron: 'Pyre-iron' },
};
