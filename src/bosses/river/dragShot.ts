// The Ferryman's drag, as the page stages it, all through the hero's own eyes (the King's noose reads the same way): his hand closes on the throat
// with his veiled face over you; he walks backward hauling you across the stones by the throat; he thrusts you down through the surface (the
// river closes over the lens); you are held under, looking up at the lamps blurred on the water and his dark shape on it, the drowned reaching
// up out of the green dark; then he heaves you out, you are flung back onto the landing, hit the stones, and lie there looking up at him.
// The times are the drag's own (river.ts DRAG); the camera goes to the under-water set (underSet.ts) for the time he is held under.
import * as THREE from 'three';
import type { MomentSpec } from '../../game/moment.ts';
import type { Motor } from '../../player/motor.ts';
import { DRAG, type River } from './river.ts';
import { UNDER } from './underSet.ts';

const sm = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** Where the Ferryman's hand and head are, when the view can say (the page gives it its view's marks); otherwise a standing guess from where he is. */
export interface Marks { hand(out: THREE.Vector3): THREE.Vector3; head(out: THREE.Vector3): THREE.Vector3 }
/** In the drag's under-water stretch (the camera is in the set, not in the arena). */
export const underWater = (t: number) => t >= DRAG.under && t < DRAG.heave;

/** The drag's shot on the boss's clock. */
export function dragSpec(sim: River, m: Motor, marks?: Marks): MomentSpec {
  const hd = new THREE.Vector3(), hh = new THREE.Vector3();
  return {
    snap: true, first: true, letterbox: true,
    frame: (t, eye, at) => {
      const ux = Math.sin(sim.yaw), uz = Math.cos(sim.yaw), sx = -uz, sz = ux, bx = sim.x, bz = sim.z;
      if (t < DRAG.under) {
        // the real stones: the lens is just behind his hand, which has the throat; his veiled face and the reed hat level with it, the lamps and the moon behind him
        if (marks) { marks.hand(hd); marks.head(hh); } else { hd.set(bx + ux * 1.8, 1.45, bz + uz * 1.8); hh.set(bx - ux * 0.3, 1.5, bz - uz * 0.3); }
        const dive = sm(DRAG.haul, DRAG.under, t), jit = sm(DRAG.grip, DRAG.grip + 0.3, t) * (t < DRAG.haul ? 0.016 : 0.03), reach = sm(DRAG.grip, DRAG.grip + 0.25, t) * (1 - sm(DRAG.haul - 0.1, DRAG.haul + 0.2, t));
        // dragged by the throat: the lens trails and bobs with his steps, sways, and turns partly down so the stones and the lamps slide past, then back to his face
        const bob = Math.sin(t * 13) * 0.075 * reach, sway = Math.sin(t * 6.5) * 0.16 * reach, down = 0.5 * sm(0.75, 1.15, t) * (1 - sm(1.5, 1.75, t));
        const ey = 1.5 - 0.62 * sm(DRAG.grip + 0.1, DRAG.haul, t) - 0.7 * dive + bob, back = 0.62 + 0.5 * down - 0.15 * dive;
        eye.set(hd.x + ux * back + sx * (sway + Math.sin(t * 29) * jit), Math.max(0.17, ey) + Math.sin(t * 37) * jit, hd.z + uz * back + sz * (sway + Math.sin(t * 29) * jit));
        const fy = hh.y - 0.3 + 0.6 * dive;
        at.set(hh.x + (eye.x - ux * 2.2 - hh.x) * down, fy + (0.1 - fy) * down, hh.z + (eye.z - uz * 2.2 - hh.z) * down); return 60 + 6 * dive;
      }
      if (t < DRAG.heave) {
        // under: the lens sinks away from the surface it was just above, looking up the length of his arm at him, with the lamps blurred on the water
        const u = t - DRAG.under, d = sm(0, 0.85, u), sink = 0.3 + 2.1 * d + 0.45 * sm(1.0, 1.65, u);
        const wob = Math.sin(u * 1.3) * 0.12;
        eye.set(UNDER.x + 0.15 + wob + Math.sin(u * 0.7) * 0.06, -sink - 0.12 * Math.sin(u * 2.1), 3.6 - 0.45 * sm(0.8, 1.6, u));
        at.set(UNDER.x + 0.35 + 0.25 * Math.sin(u * 0.5), 1.1, 0.4 + 0.15 * Math.sin(u * 0.4)); return 64 + 6 * sm(1.0, 1.65, u);
      }
      // heaved out: the surface breaks over the lens, he flings you back onto the landing (the lens looks back up at him as you go), the stones, the lie, the rising
      const FLY = DRAG.land - DRAG.heave, uu = Math.min(1, (t - DRAG.heave) / FLY), lx = bx + ux * DRAG.hold, lz = bz + uz * DRAG.hold;
      if (t < DRAG.land) {
        const x0 = bx + ux * 0.5, z0 = bz + uz * 0.5; eye.set(x0 + (lx - x0) * uu, 0.2 + 1.9 * Math.sin(Math.PI * Math.min(1, uu * 1.05)) * (1 - 0.3 * uu), z0 + (lz - z0) * uu);
        at.set(bx - ux * 0.1, 1.9 + 0.6 * uu, bz - uz * 0.1); return 62 - 6 * uu;
      }
      const g = sm(DRAG.lie, DRAG.end, t); // knocked back across the stones: the lens slides with him, then lies still, then rises
      eye.set(m.x + ux * 0.25, 0.34 + 1.1 * g, m.z + uz * 0.25); at.set(bx + ux * 0.1, 2.3 - 0.6 * g, bz + uz * 0.1); return 54 - 2 * g;
    },
    // the throw turns the lens over a little, the stones knock it crooked, the lie settles it
    roll: t => t < DRAG.grip ? 0 : t < DRAG.haul ? 0.14 * sm(DRAG.grip, 0.9, t) + 0.07 * Math.sin(t * 6.5) * sm(DRAG.grip, DRAG.grip + 0.25, t) : t < DRAG.under ? 0.18 * sm(DRAG.haul, DRAG.under, t) : t < DRAG.heave ? 0.1 * Math.sin((t - DRAG.under) * 0.8) : t < DRAG.land ? 0.5 * Math.sin(Math.PI * (t - DRAG.heave) / (DRAG.land - DRAG.heave)) : 0.3 * (1 - sm(DRAG.land, DRAG.end, t)),
    // dark at each cut (in and out of the water) and a fall of light as the air runs out; a flash and a dim at the stones
    dim: t => {
      if (t < DRAG.under - 0.15) return 0; if (t < DRAG.under) return sm(DRAG.under - 0.15, DRAG.under, t);
      if (t < DRAG.under + 0.35) return 1 - 0.85 * sm(DRAG.under, DRAG.under + 0.35, t);
      if (t < DRAG.heave - 0.1) return 0.15 + 0.4 * sm(DRAG.under + 0.9, DRAG.heave - 0.2, t);
      if (t < DRAG.heave) return 0.55 + 0.45 * sm(DRAG.heave - 0.1, DRAG.heave, t);
      if (t < DRAG.heave + 0.14) return 1 - 1 * sm(DRAG.heave, DRAG.heave + 0.14, t);
      if (t < DRAG.land) return 0; return 0.5 * (1 - sm(DRAG.land, DRAG.land + 0.4, t)) + 0.08 * (1 - sm(DRAG.land + 0.4, DRAG.end, t));
    },
    hero: (t, o) => o.set(0, 0, 0),
    rate: t => t > DRAG.land - 0.2 && t < DRAG.land + 0.18 ? 0.3 : 1,
    cues: [{ t: 0.12, name: 'grip' }, { t: DRAG.grip + 0.05, name: 'haul' }, { t: DRAG.haul + 0.2, name: 'dip' }, { t: DRAG.under, name: 'under' }, { t: DRAG.under + 0.6, name: 'hands' }, { t: DRAG.heave - 0.05, name: 'heave' }, { t: DRAG.land, name: 'land' }, { t: DRAG.lie, name: 'rise' }],
  };
}
