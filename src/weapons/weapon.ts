// A weapon is one module: mesh, grip, moveset, trail. Nothing outside this folder knows which one is held.
import type { Clip, Pose } from '../anim/pose.ts';

export interface Weapon {
  id: string; name: string; geo: string;
  /** Cutting edge along the weapon's own Y axis, metres from the grip. */ blade: [number, number];
  /** Default reach from the body's centre to the target's surface (m), half arc (deg) and base damage. */ reach: number; arc: number; damage: number;
  trail: [number, number, number];
  rest: Pose; ready: Pose; guard: Pose;
  clips: Record<string, Clip>;
  combo: string[];
  /** finishers[i] is what holding Attack gives after combo hit i. */ finishers: string[];
  /** Every five-hit chain. The first is `combo`; a new one comes up after each chain you carry past the second hit. */ chains: string[][];
  /** Short answers after a perfect defence, used while the long one is cooling. */ ripostes: string[];
  air: { cut: string; plunge: string; hit: string };
  /** Attack pressed out of something else. */ from: { sprint: string; dodgeF: string; dodgeB: string; dodgeL: string; dodgeR: string; guard: string; reckon: string; execute: string; finale: string };
  charge: string; heavy: string;
}
