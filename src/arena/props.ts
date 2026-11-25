// What in the court can be broken. No rendering imports: the fight owns these, the view follows.
import type { Blocker } from '../player/motor.ts';

export type PropKind = 'lamp' | 'pillar';
export interface Prop extends Blocker { id: number; kind: PropKind; /** Which carving. */ shape: number; yaw: number; h: number; hp: number; max: number; broken: boolean }
/** Lamp pillars stand among the fight; temple pillars ring it. */
export const LAMP_R = 10.2, RING_R = 16.5;
export function makeProps(): Prop[] {
  const o: Prop[] = []; const spin = (i: number) => Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 6.283;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; o.push({ id: o.length, kind: 'lamp', shape: 0, x: Math.cos(a) * LAMP_R, z: Math.sin(a) * LAMP_R, r: 0.5, yaw: spin(i), h: 3.3, hp: 3, max: 3, broken: false }); }
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, shape = [0, 1, 0, 2, 0, 0, 1, 0, 2, 0][i]; o.push({ id: o.length, kind: 'pillar', shape, x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, r: 0.85, yaw: spin(i + 20), h: [6.3, 4.4, 2.6][shape], hp: 5, max: 5, broken: false }); }
  return o;
}
/** How a tall pillar comes down: seconds from the blow to the floor, reach and half width of where it lands. */
export const FALL = { time: 1.25, len: (p: Prop) => p.h * 0.92, half: 1.0, dmg: 14, boss: 190 };
