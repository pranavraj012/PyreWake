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
  charge: string; heavy: string;
}
