// The hero's two rewards against the Hanged King (module A, fix-reward-scenes): the ride (on the kneeling King's back, three blows, each with contact)
// and the rope. Same method as rewardShots.ts: the simulation owns the timings (RIDE, RIP) and the damage; this stages the hero, the camera and the effects.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import type { MomentSpec } from './moment.ts';
import type { Motor } from '../player/motor.ts';
import { RIDE, type King } from '../boss/king.ts';
import { E, V, type RewardKit, type RewardRun } from './rewardShots.ts';

/** The ride's numbers: the hero crouches, bounds over the King's flank onto his back (the game's own gravity), strikes three times, is thrown clear and lands braced. */
const GO = { launch: 0.57, off: 2.45, brace: 0.55, g: 24, side: 2.0, away: 3.2, back: -0.25, up: -0.02 };
/** The ride's geometry, fixed on its first frame: which flank the hero comes round, where he lands. */
export class RideGeo {
  ready = false; start = V(); side = 1; fx = 0; fz = 1; arena = 21; chest = V(); landAt = V(); private K = V();
  init(sim: King, m: Motor, chest: THREE.Vector3) {
    this.fx = Math.sin(sim.yaw); this.fz = Math.cos(sim.yaw); this.arena = m.arena; this.start.set(m.x, 0, m.z); this.chest.copy(chest);
    this.side = ((m.x - sim.x) * -this.fz + (m.z - sim.z) * this.fx) >= 0 ? 1 : -1; this.ready = true;
    let lx = sim.x - this.fz * this.side * GO.away - this.fx * 1.8, lz = sim.z + this.fx * this.side * GO.away - this.fz * 1.8; const lim = this.arena - 0.8, q = Math.hypot(lx, lz); if (q > lim) { lx *= lim / q; lz *= lim / q; } this.landAt.set(lx, 0, lz);
  }
  /** The spot on his back the blows come down on (follows the King as he is drawn). */
  back(chest: THREE.Vector3, out = this.K) { return out.set(chest.x + this.fx * GO.back, chest.y + GO.up, chest.z + this.fz * GO.back); }
  /** The hero's world place at t. */
  hero(sim: King, chest: THREE.Vector3, t: number, out: THREE.Vector3) {
    const H1 = RIDE.hits[0], H3 = RIDE.hits[RIDE.hits.length - 1], B = this.back(chest), T = H1 - GO.launch, v = (B.y + 0.5 * GO.g * T * T) / T;
    if (t < GO.launch) return out.set(this.start.x, -0.2 * Math.sin(Math.PI * t / GO.launch), this.start.z);
    if (t < H1) { // over the flank: a quadratic path through a point at his side, so he never goes through the King
      const u = (t - GO.launch) / T, W = V(sim.x - this.fz * this.side * GO.side + this.fx * -0.6, 0, sim.z + this.fx * this.side * GO.side + this.fz * -0.6), a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, tt = t - GO.launch;
      return out.set(a * this.start.x + b * W.x + c * B.x, v * tt - 0.5 * GO.g * tt * tt, a * this.start.z + b * W.z + c * B.z);
    }
    if (t < GO.off) { const bob = RIDE.hits.reduce((s, h) => s + (t >= h ? 0.14 * Math.exp(-(t - h) * 14) : 0), 0); return out.set(B.x, B.y - bob, B.z); }
    // thrown clear: up and out, then down to the ground at the landing spot, with the game's gravity
    const tau = t - GO.off, vy = 3.2, fall = (vy + Math.sqrt(vy * vy + 2 * GO.g * B.y)) / GO.g, k = Math.min(1, tau / fall); const Bo = this.back(chest, V());
    const y = tau < fall ? Bo.y + vy * tau - 0.5 * GO.g * tau * tau : -0.3 * Math.sin(Math.PI * Math.min(1, (tau - fall) / GO.brace));
    void H3; return out.set(Bo.x + (this.landAt.x - Bo.x) * E(0, 1, k), y, Bo.z + (this.landAt.z - Bo.z) * E(0, 1, k));
  }
}

export function rideSpec(sim: King, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const geo = run.ride, P = V(), C = V(), F = V(), chestAt = () => { if (kit.king) kit.king.hurt(C); else C.set(sim.x, 1.4, sim.z); return C; };
  const ready = () => { if (!geo.ready) geo.init(sim, m, chestAt()); };
  return {
    frame: (t, eye, at) => {
      ready(); chestAt(); const hp = geo.hero(sim, C, t, P), H1 = RIDE.hits[0], k = E(0.2, H1, t), r = E(RIDE.hits[RIDE.hits.length - 1] + 0.1, GO.off + 0.6, t);
      // side-on to the King's back from the hero's own flank (he lands in front of the lens): the leap, the blows and the buckle all in profile
      F.set((C.x + hp.x) / 2, Math.max(1.7, (C.y + hp.y + 1.3) / 2), (C.z + hp.z) / 2); F.x += (C.x - F.x) * 0.3 * k; F.z += (C.z - F.z) * 0.3 * k;
      F.x += ((sim.x + geo.landAt.x) / 2 - F.x) * r; F.z += ((sim.z + geo.landAt.z) / 2 - F.z) * r; F.y += (1.3 - F.y) * r;
      const dist = 8.2 - 2.4 * k + 1.6 * r, fov = 49 - 3 * k + 4 * r, sx = -geo.fz * geo.side, sz = geo.fx * geo.side;
      eye.set(F.x + sx * dist, 1.6 + 0.5 * k - 0.2 * r, F.z + sz * dist); at.copy(F); return fov;
    },
    hero: (t, o) => { ready(); chestAt(); const hp = geo.hero(sim, C, t, P); o.set(hp.x - m.x, hp.y, hp.z - m.z); run.last.copy(o); },
    rate: t => run.rateAt(t, RIDE.hits, performance.now()),
    letterbox: true, snap: true,
    cues: RIDE.hits.map((t, i) => ({ t, name: 'blow' + i })),
  };
}
/** The ride's beats: the leap, the three blows (each: sparks, shake, a heavy sound, the King's dip), the throw-off, the landing. */
export function rideBeats(sim: King, m: Motor, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const geo = run.ride, c = V(); if (kit.king) kit.king.hurt(c); else c.set(sim.x, 1.4, sim.z); if (!geo.ready) geo.init(sim, m, c);
  const px = m.x + run.last.x, pz = m.z + run.last.z, face = t < GO.off ? Math.atan2(geo.fx, geo.fz) : Math.atan2(sim.x - px, sim.z - pz); let d = face - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * 0.35;
  const hit = RIDE.hits.reduce((s, h) => s + (t >= h ? [0.22, 0.28, 0.55][RIDE.hits.indexOf(h)] * Math.exp(-(t - h) * 6) : 0), 0);
  if (kit.king) kit.king.dip = hit;
  run.once('leap', t, GO.launch, () => sound.play('whooshH', { gain: 0.6, wet: 0.4 }));
  RIDE.hits.forEach((h, i) => run.once('blow' + i, t, h, () => {
    const B = geo.back(c, V()), last = i === RIDE.hits.length - 1;
    sound.play(last ? 'fleshH' : 'flesh', { gain: 1, wet: 0.3 }); sound.play(last ? 'boom' : 'thud', { gain: last ? 0.9 : 0.7, wet: 0.3 }); sound.play('kPain', { gain: last ? 0.9 : 0.6, wet: 0.5, bus: 'voice', x: sim.x, z: sim.z });
    kit.fx.sparks.emit(B.clone(), V(-geo.fz * geo.side, 0.9, geo.fx * geo.side), last ? 110 : 60, last ? 7 : 5, 2.2, 0.8, time); kit.fx.bursts.add('flare', B.clone(), last ? 2.2 : 1.4, 0.22, time); kit.fx.bursts.add('ring', B.clone(), last ? 2.0 : 1.2, 0.3, time);
    kit.fx.puffs.emit(V(sim.x, 0, sim.z), last ? 10 : 4, 1.6, 0.9, time); kit.kick(last ? 1 : 0.55);
  }));
  run.once('land', t, 3.0, () => { sound.play('thud', { gain: 0.6, wet: 0.3 }); kit.fx.puffs.emit(V(m.x + run.last.x, 0, m.z + run.last.z), 7, 1.6, 0.9, time); });
}
