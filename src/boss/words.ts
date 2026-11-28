// What a boss says aloud and on the HUD. Each boss page passes its own (FightPageSpec.words); the director reads it.
export interface BossWords {
  /** The boss's voice: the director's cue names (pain, pain2, screech, roar, breath, death, death2) to the sound names it plays. A cue with no entry plays as its own name. */
  voice: Record<string, string>;
  /** The breath between attacks, played straight (not through the voice table). */
  idleBreath: string;
  /** The title when round 2 begins (the second flame), and the one when the boss is quenched. */
  flame: string;
  quenched: string;
  /** The callouts: a blow breaks the guard, a fall crushes, and Last Rites is ready. */
  broken: string;
  crushed: string;
  lastRites: string;
}
