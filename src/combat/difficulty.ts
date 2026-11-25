// Every tuning number that decides how hard the game is.
export const D = {
  hp: 100, fireMax: 100, heals: 4, heal: 45,
  /** Fraction of a blocked blow that still gets through; it can never kill. */ chip: 0.12,
  dodgeSafe: 0.32, parry: 0.18, perfect: 0.2, hurtSafe: 0.9,
  gain: { hit: 5.2, parry: 22, perfect: 12, block: 4 },
  rush: { cost: 40, dmg: 46, delay: 0.98, width: 1.9 },
  boss: { hp: 1800, reelGap: 6, rest: [0.8, 1.3] as [number, number], near: 3.3 },
  /** Cue lead before a blow lands (s): the first time an attack is seen, and after. */ cueFirst: 0.9, cue: 0.6,
  teach: { dmg: 0.4, rate: 0.7, slow: 0.6 },
};
