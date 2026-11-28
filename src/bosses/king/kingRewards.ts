// The hero's two rewards against the Hanged King (module A, fix-reward-scenes): the ride (on the kneeling King's back, three blows, each with contact)
// and the rope. Same method as rewardShots.ts: the simulation owns the timings (RIDE, RIP) and the damage; this stages the hero, the camera and the effects.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import type { MomentSpec } from '../../game/moment.ts';
import type { Motor } from '../../player/motor.ts';
import { RIDE, RIP, ROPE, type King } from './king.ts';
import type { KingView } from './kingView.ts';
import { RewardChain } from '../../game/rewardChain.ts';
import { E, V, compose, retime, warp, type RewardKit, type RewardRun } from '../../game/rewardShots.ts';
import { KHANDA } from '../../weapons/khanda.ts';
import type { Clip } from '../../anim/pose.ts';

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

export function rideSpec(sim: King, m: Motor, kit: KingRewardKit, run: RewardRun<KingRewardProps>): MomentSpec {
  const geo = run.props.ride, P = V(), C = V(), F = V(), chestAt = () => { if (kit.king) kit.king.hurt(C); else C.set(sim.x, 1.4, sim.z); return C; };
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
export function rideBeats(sim: King, m: Motor, kit: KingRewardKit, run: RewardRun<KingRewardProps>, t: number, time: number) {
  const geo = run.props.ride, c = V(); if (kit.king) kit.king.hurt(c); else c.set(sim.x, 1.4, sim.z); if (!geo.ready) geo.init(sim, m, c);
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

// ---------------------------------------------------------------- the rope
/** The rope: he hangs by the ankles from a bough 10.6 m up, so the rope runs from 5.2 to 10.6 m and no leap reaches it. The hero's heavy blade throws a crescent of fire (his own
 *  heavy attack does), so the scene is that blow aimed up: a leap, the rising cut, the fire climbing to the rope; the rope parts and he falls. */
export const ROPE_GO = { launch: 0.78, apex: 1.12, peak: 1.4, release: 1.0, cutAt: 0.87, brace: 0.6 };
const ROPE_LAND = ROPE_GO.launch + 2 * (ROPE_GO.apex - ROPE_GO.launch);
export class RopeGeo {
  ready = false; pivot = V(); ankle = V(); cut = V(); arena = 21; private q = new THREE.Quaternion();
  /** The rope's two ends and the place the fire cuts it (a little above his ankles), from the King's own swing. */
  ends(sim: King) {
    this.q.setFromAxisAngle(V(Math.cos(sim.dir), 0, -Math.sin(sim.dir)), -sim.th); this.pivot.set(sim.x, ROPE, sim.z);
    this.ankle.set(0, -(ROPE - 5.22), 0).applyQuaternion(this.q).add(this.pivot); this.cut.lerpVectors(this.pivot, this.ankle, ROPE_GO.cutAt); return this;
  }
  init(sim: King, m: Motor) { this.ends(sim); this.arena = m.arena; this.ready = true; }
  /** The hero's drawn height: crouch, a leap in place (the game's own gravity), a braced landing. */
  heroY(t: number) {
    const L = ROPE_GO.launch;
    if (t < L) return -0.22 * Math.sin(Math.PI * t / L);
    if (t < ROPE_LAND) return ROPE_GO.peak - 0.5 * (2 * ROPE_GO.peak / ((ROPE_GO.apex - L) ** 2)) * (t - ROPE_GO.apex) ** 2;
    return -0.3 * Math.sin(Math.PI * Math.min(1, (t - ROPE_LAND) / ROPE_GO.brace));
  }
}
export function ropeSpec(sim: King, m: Motor, kit: KingRewardKit, run: RewardRun<KingRewardProps>): MomentSpec {
  const geo = run.props.rope, F = V(), A = V(); void kit;
  const ready = () => { if (!geo.ready) geo.init(sim, m); };
  return {
    frame: (t, eye, at) => {
      ready(); geo.ends(sim); const hx = m.x, hz = m.z, dx = hx - sim.x, dz = hz - sim.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, sx = -uz, sz = ux, k = E(0.2, RIP.cut, t), r = E(RIP.cut, RIP.cut + 0.6, t);
      // from behind and beside the hero, low, looking up the whole line: the hero below, the King on his rope, the bough
      F.set(sim.x * 0.55 + hx * 0.45, 2.7 + 2.6 * k - 4.0 * r, sim.z * 0.55 + hz * 0.45); F.x += (geo.cut.x - F.x) * 0.3 * k * (1 - r); F.z += (geo.cut.z - F.z) * 0.3 * k * (1 - r);
      A.set(hx + ux * 5.2 + sx * 2.4, 1.1 + 0.4 * r, hz + uz * 5.2 + sz * 2.4); eye.copy(A); at.copy(F);
      return 62 - 4 * k + 4 * r;
    },
    hero: (t, o) => { ready(); o.set(0, geo.heroY(t), 0); run.last.set(0, 0, 0); },
    rate: t => run.rate(t, RIP.cut, performance.now()),
    letterbox: true, snap: true,
    cues: [{ t: ROPE_GO.launch, name: 'leap' }, { t: ROPE_GO.release, name: 'release' }, { t: RIP.cut, name: 'cut' }],
  };
}
/** The rope's own rope: the two ends whip, drawn with the King's own bark material. */
function ropeMesh(king: KingView, scene: THREE.Object3D): RewardChain {
  const g = new THREE.CylinderGeometry(0.1, 0.1, 0.34, 6).rotateZ(Math.PI / 2), info = king.rope.geometry.getAttribute('aInfo');
  if (info) { const a = new Uint8Array(g.attributes.position.count * 4); for (let i = 0; i < a.length; i += 4) for (let j = 0; j < 4; j++) a[i + j] = (info.array as Uint8Array)[j]; g.setAttribute('aInfo', new THREE.BufferAttribute(a, 4, true)); }
  return new RewardChain(new THREE.InstancedMesh(g, king.rope.material as THREE.Material, 1), scene);
}
/** The rope's beats: the leap, the fire thrown up the line, the cut (the rope's two ends whip, he falls), the landing. */
export function ropeBeats(sim: King, m: Motor, kit: KingRewardKit, run: RewardRun<KingRewardProps>, t: number, time: number) {
  const geo = run.props.rope; if (!geo.ready) geo.init(sim, m); if (!run.ropeBroken) geo.ends(sim);
  const dt = run.tick(time), face = Math.atan2(sim.x - m.x, sim.z - m.z); let d = face - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * 0.35;
  const king = kit.king, scene = king?.group.parent;
  if (king && scene) {
    if (!run.rope2) run.rope2 = ropeMesh(king, scene);
    if (run.ropeBroken) { const ank = V(); king.rig.bones[king.rig.i('foot.L')].getWorldPosition(ank); run.rope2.step(dt, ank, E(2.6, 3.3, t)); }
  }
  run.once('leap', t, ROPE_GO.launch, () => sound.play('whooshH', { gain: 0.6, wet: 0.4 }));
  // the fire: thrown from the blade at the release, up the line to the cut, in RIP.cut - release seconds
  if (t >= ROPE_GO.release && t < RIP.cut + 0.02) {
    const u = Math.min(1, (t - ROPE_GO.release) / (RIP.cut - ROPE_GO.release)), a = V(m.x, 2.0 + geo.heroY(t), m.z), P = a.clone().lerp(geo.cut, u * u * (3 - 2 * u));
    kit.fx.bursts.add('fire', P, 1.5, 0.16, time); kit.fx.sparks.emit(P, V(0, 0.3, 0), 6, 2, 1.6, 0.5, time); if (u < 0.1) kit.fx.bursts.add('flare', P, 1.4, 0.2, time);
  }
  run.once('release', t, ROPE_GO.release, () => { sound.play('flare', { gain: 0.9, wet: 0.4 }); sound.play('whooshH', { gain: 0.5, wet: 0.4 }); kit.kick(0.3); });
  run.once('cut', t, RIP.cut, () => {
    const C = geo.cut.clone();
    sound.play('snap', { gain: 1, wet: 0.5 }); sound.play('tear', { gain: 0.8, wet: 0.4 }); sound.play('boom', { gain: 0.7, wet: 0.4 });
    kit.fx.bursts.add('flare', C.clone(), 3, 0.3, time); kit.fx.bursts.add('ring', C.clone(), 2.2, 0.4, time); kit.fx.sparks.emit(C.clone(), V(0, 0.4, 0), 100, 5, 3, 1.0, time); kit.kick(1);
    if (king && run.rope2) { run.ropeBroken = true; king.ropeCut = true; run.rope2.cut(geo.pivot, geo.ankle, 1 - ROPE_GO.cutAt); }
  });
  run.once('crash', t, RIP.cut + 0.45, () => { const L = V(sim.x, 0, sim.z); sound.play('slam', { gain: 1, x: L.x, z: L.z }); sound.play('thud', { gain: 1, x: L.x, z: L.z }); kit.fx.puffs.emit(L, 22, 3, 1.5, time); kit.fx.bursts.add('ground', V(L.x, 0.06, L.z), 10, 0.9, time, 0, 0.7, 0.3, 0.1); kit.kick(0.9); });
  run.once('land', t, ROPE_LAND, () => { sound.play('thud', { gain: 0.5, wet: 0.3 }); kit.fx.puffs.emit(V(m.x, 0, m.z), 6, 1.5, 0.8, time); });
}

/** The King's reward kit: the scene reads his view (the rope's hanging King, the ride's back). */
export interface KingRewardKit extends RewardKit { king?: KingView }
/** The King's props for the run: the ride's geometry and the rope's. */
export type KingRewardProps = { ride: RideGeo; rope: RopeGeo };

const CLIPS: Record<string, Clip> = {};
/** The reward's clip for the King, built once from the khanda's strikes: the rope's rising cut, or the ride's three blows. */
export function kingClip(kind: string): Clip {
  if (CLIPS[kind]) return CLIPS[kind];
  const c = KHANDA.clips;
  const made = kind === 'rope'
    ? retime('rewardRope', c.risingCut, RIP.len, warp([[0, 0.4], [0.2, 0.85], [0.28, 1.0], [0.5, 1.3], [1.05, 1.9]]))
    : compose('rewardRide', RIDE.len, RIDE.hits.map((h, i) => i < RIDE.hits.length - 1 ? { src: c.light3, hit: 0.255, at: h, k: 1.1 } : { src: c.light5, hit: 0.53, at: h, k: 0.8 }));
  CLIPS[kind] = made; return made;
}
