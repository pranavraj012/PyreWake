// The boss strike language, shared by every boss and by the lesser foes: a strike (white, red or ground) and the danger a ground strike leaves.
/** Ground danger. Circles and lines go off after `delay`; a ring rolls outward from the boss. */
export interface Zone { shape: 'circle' | 'line' | 'ring' | 'sweep'; at: 'mark' | 'self' | 'player'; r?: number; len?: number; half?: number; yaw?: number; delay: number; speed?: number; max?: number; /** A circle with a safe middle this wide; a sweep that misses inside this radius. */ inner?: number; /** A sweep turns this far (radians) over `dur` seconds after its delay. */ spin?: number; dur?: number }
/** white: dodge or guard. red: dodge only. ground: leave the glowing area, or dodge as it goes off. */
export interface Strike {
  kind: 'white' | 'red' | 'ground'; t: [number, number]; cue: number; dmg: number; down?: boolean; mark: 'cleaver' | 'handL' | 'head';
  /** A box ahead (length, half width), a sector (radius, half arc in degrees), or a disc around the hanging head, metres. */
  box?: [number, number]; arc?: [number, number]; head?: number; /** Comes in at leg height: a jump clears it. */ low?: boolean;
  /** Ground marks drawn from the cue. With no box/arc/head of its own, the zone does the damage. */ zones?: Zone[];
  /** Hit only outside this radius (a sweep with a safe place at the boss's feet). */ inner?: number; /** The zone is only drawn: the boss resolves it itself. */ silent?: boolean;
  /** When it connects, the boss seizes the hero into a staged moment instead of the plain blow (Boss.seize). */ seize?: string;
}
