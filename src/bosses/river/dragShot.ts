// The Ferryman's drag, as the page stages it: the hook pulls the hero off the steps and under the water, the camera goes under with him
// (green-tinted, with bubbles) and looks back up at the boat, where the Ferryman's silhouette stands against the surface; then he is heaved out.
// The times are the drag's own (river.ts DRAG); the page tints the view by dragUnder() and rises bubbles while it runs.
import * as THREE from 'three';
import type { MomentSpec } from '../../game/moment.ts';
import type { Motor } from '../../player/motor.ts';
import { DRAG, type River } from './river.ts';

const E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/** How far under the surface the drag has him: 0 above, 1 held under; the page tints the view by it. */
export function dragUnder(stage: number) { return E(DRAG.under, DRAG.hold, stage) * (1 - E(DRAG.heave, DRAG.end, stage)); }

/** The drag's shot on the boss's clock: above the water, then under it, then up. */
export function dragSpec(sim: River, m: Motor): MomentSpec {
  return {
    frame: (t, eye, at) => {
      const hx = m.x, hz = m.z, bx = sim.x, bz = sim.z, dx = bx - hx, dz = bz - hz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, sx = -uz, sz = ux;
      const low = dragUnder(t);
      // beside him, a little back: the eye goes down under the surface as he does, and the boat stays above the frame's middle
      eye.set(hx + sx * 3.6 - ux * 0.5, 1.2 - 1.45 * low, hz + sz * 3.6 - uz * 0.5);
      at.set(hx + dx * 0.6, 1.5 + 0.9 * low, hz + dz * 0.6);
      return 52 + 8 * low;
    },
    hero: (t, o) => { o.y = t < DRAG.under ? 0 : t < DRAG.hold ? -1.6 * E(DRAG.under, DRAG.hold, t) : t < DRAG.heave ? -1.6 + 0.08 * Math.sin(t * 9) : -1.6 * (1 - E(DRAG.heave, DRAG.end, t)); },
    tumble: t => t > DRAG.hold && t < DRAG.heave ? 0.2 * Math.sin(t * 6) : 0,
    rate: t => t > DRAG.hold - 0.1 && t < DRAG.heave + 0.2 ? 0.4 : 1,
    letterbox: true,
  };
}
