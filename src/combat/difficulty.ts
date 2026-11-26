// Every tuning number that decides how hard the game is.
export const D = {
  hp: 100, fireMax: 100, heals: 4, heal: 45, /** Health after the Second Flame. */ flame: 50,
  /** Fraction of a blocked blow that still gets through; it can never kill. */ chip: 0.1,
  dodgeSafe: 0.32, parry: 0.18, perfect: 0.2, hurtSafe: 0.9,
  gain: { hit: 3.9, parry: 22, perfect: 12, block: 4 },
  rush: { cost: 40, dmg: 110, delay: 0.98, width: 1.9 }, sunder: { cost: 50, dmg: 170 }, flare: { dmg: 22 }, rites: { dmg: 650 },
  /** The newer fire arts: Pyre Brand ring then eruption, Ashen Step's burst, each turn of the Funeral Wheel, each ember of Ashfall (seven). */ spell: { brand: [45, 150] as [number, number], step: 40, wheel: 20, fall: 26 },
  /** Unhurt hits needed for each aura step. */ aura: [6, 14, 26, 42],
  /** Ultimate charge per point of damage. */ wakeGain: 0.05, /** Spells barely feed Last Rites: it has to be earned with the blade. */ spellWake: 0.15, /** Share of the King's health by which Last Rites is in your hands whatever happened. */ gift: 0.5,
  /** The closing blow of a multi-hit attack hits this much harder. */ lastHit: { reckon: 4.2, alt5: 1.7, execute: 1.9, riposteB: 2.6 } as Record<string, number>,
  /** Jump: launch speed and gravity (m/s, m/s^2), and how high your feet must be for low blows and ground fire to pass under. */ jump: { v: 8.6, g: 24, clear: 0.42, /** Plunge power after leaping over something. */ bonus: 1.5 },
  /** Boss temper, chosen in the menu: rest between strings, overall pace, taste for long strings. */ temper: [{ rest: 1.8, pace: 0.94, long: 0.45 }, { rest: 1, pace: 1, long: 1 }, { rest: 0.45, pace: 1.07, long: 1.8 }],
  /** Seconds before the long answer to a perfect defence comes round again. */ flourish: 40,
  boss: { hp1: 4300, hp2: 3700, reelGap: 6, rest: [0.5, 1.0] as [number, number], rest2: [0.35, 0.8] as [number, number], near: 3.1, /** Extra rest when the quiet assist is on. */ assist: 1.2, headMul: 1.5, hangBreak: 520, hangTime: 20 },
  /** Cue lead before a blow lands (s): the first time an attack is seen, and after. */ cueFirst: 0.8, cue: 0.5,
  teach: { dmg: 0.4, rate: 0.7, slow: 0.6 },
};
