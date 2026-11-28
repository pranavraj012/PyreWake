// What the referee needs from any boss and from its brain. Every boss is one of these. No rendering imports.
import type { Strike } from './strike.ts';
import type { Fight } from '../combat/fight.ts';

export interface Boss {
  x: number; z: number; y: number; yaw: number; vx: number; vz: number; speed: number; mode: string; mt: number; prev: number; burst: number; r: number; form: 1 | 2; rate: number; pace: number; serial: number;
  cues: Strike[]; live: Strike[]; ended: string | null; armed: boolean; crawling: boolean; ht: number; th: number; dir: number; mark: { x: number; z: number };
  readonly hx: number; readonly hz: number; readonly hr: number; readonly hanging: boolean; readonly airborne: boolean; readonly strikes: Strike[]; readonly committed: boolean; readonly helpless: boolean;
  /** Mid-attack or about to be. */ readonly attacking: boolean; /** Can it be hurt right now (a submerged Weight cannot). */ readonly vulnerable: boolean; /** Damage taken is scaled by this (an open back takes more). */ readonly dmgMul: number;
  /** Health of each round. */ readonly hp: [number, number];
  /** Modes the referee puts it in. */ readonly reelMode: string; readonly kneelMode: string; readonly downMode: string; readonly dieMode: string; readonly reeling: boolean; /** Seconds a held kneel / death pose is kept. */ readonly holdKneel: number; readonly holdDie: number;
  set(mode: string, rate?: number): void; break(): void; turn(step: number, to: number): number; step(dt: number, px: number, pz: number): void; covers(q: Strike, px: number, pz: number, r?: number): boolean;
  /** Back to a clean start: bosses with mechanics of their own clear them. */ reset?(): void;
  /** Called by the referee each time a blow lands, with what kind it was. */ struck?(f: Fight, kind: 'blade' | 'fire'): void;
  /** Called by the referee after step: bosses with their own mechanics (chains, lanterns, coins) act here. */ tick?(f: Fight, dt: number): void;
  /** The first throw of a grab in a fight is forced to connect (it cannot be dodged); the sim says so here. */ forcesGrab?(): boolean;
  /** A strike marked `seize` connected (or its hazard): the boss takes the hero into a staged moment instead of the plain blow. */ seize?(kind: string, f: Fight): void;
  /** The hero's dodge was perfect: bosses that offer a reward for it open the chance here. */ dodged?(f: Fight): void;
}
export interface BossBrain {
  temper: number; seen: Set<string>; style: string; began: string | null;
  step(dt: number, k: Boss, px: number, pz: number, hitsLanded: number, frac: number): void; struck(k: Boss, dmg: number): boolean; broken(): void; hurt(time: number): void; reset(form: 1 | 2): void; drop(k: Boss): void;
}
