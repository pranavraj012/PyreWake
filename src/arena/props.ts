// What in the court can be broken. No rendering imports: the fight owns these, the view follows.
import type { Blocker } from '../player/motor.ts';

export type PropKind = 'lamp' | 'pillar' | 'boat';
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
/** The river ghats: lamp posts and pavilion columns on the landing, boats moored round it. */
export function makeGhatProps(): Prop[] {
  const o: Prop[] = [], add = (kind: PropKind, shape: number, x: number, z: number, r: number, h: number, hp: number, yaw: number) => o.push({ id: o.length, kind, shape, x, z, r, yaw, h, hp, max: hp, broken: false });
  for (const [x, z] of [[-9.2, -3.2], [9.6, -5.0], [-8.0, 9.4], [8.4, 8.8]]) add('lamp', 0, x, z, 0.5, 3.3, 3, (x + z) % 6);
  // two half-drowned pavilions, east and west
  for (const [cx, cz, s] of [[-17.2, -3.4, 1], [17.4, 0.6, -1]] as const) for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) { const i = o.length; add('pillar', [0, 1, 0, 2, 0, 0, 1, 0][i % 8], cx + dx * s, cz + dz * s, 0.85, [6.3, 4.4, 2.6][[0, 1, 0, 2, 0, 0, 1, 0][i % 8]], 5, i * 1.7); }
  for (const [x, z, y] of [[-12.5, -12.5, 0.5], [13.5, -11.5, -0.35], [-13.5, 9.5, 1.2], [12.8, 13.2, -0.9], [0.5, -17.5, 1.6]]) add('boat', 0, x, z, 1.5, 0.7, 4, y);
  return o;
}
/** The Waiting House: rope cots in two broken rows round the court (they burst at a touch, like a lamp), and sandstone columns at its edge. */
export function makeHouseProps(): Prop[] {
  const o: Prop[] = [], add = (kind: PropKind, shape: number, x: number, z: number, r: number, h: number, hp: number, yaw: number) => o.push({ id: o.length, kind, shape, x, z, r, yaw, h, hp, max: hp, broken: false });
  // cots: their long sides toward the dial's foot, as the ward was laid out
  for (const [R, n, off] of [[10.2, 9, 0.18], [13.6, 12, 0.05]] as const) for (let i = 0; i < n; i++) { const a = off + (i + 0.5) / n * Math.PI * 1.55 + Math.PI * 0.22 + (i % 3 === 1 ? 0.04 : 0); if (Math.abs(Math.sin(a * 7.1 + R)) < 0.18) continue; const x = Math.sin(a) * R, z = Math.cos(a) * R; add('lamp', 0, x, z, 0.72, 0.6, 2, a + Math.PI / 2 + (Math.sin(i * 3.7) * 0.12)); }
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2 + 0.31, shape = [0, 1, 0, 2, 0, 0, 1, 0, 2, 0][i]; add('pillar', shape, Math.sin(a) * 16.6, Math.cos(a) * 16.6, 0.7, [5.65, 4.2, 2.7][shape], 5, a); }
  return o;
}
