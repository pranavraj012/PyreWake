// The Ferryman's two reward shots, split out of rewardShots.ts: the lantern and the chain. The generic helpers (E, V, RewardRun, RewardKit) stay there.
import * as THREE from 'three';
import { sound } from '../../audio/sound.ts';
import type { MomentSpec } from '../../game/moment.ts';
import type { Motor } from '../../player/motor.ts';
import { RewardChain } from '../../game/rewardChain.ts';
import { CHAIN, LANTERN, type River } from './river.ts';
import { E, V, type RewardKind, type RewardKit, type RewardRun } from '../../game/rewardShots.ts';

// ---------------------------------------------------------------- the Ferryman's lantern
/** The scene's numbers. He kneels and swings his pole out so the lamp hangs ahead of him at a height a leap can reach; the hero leaps, cuts it down, springs back and lands braced. */
const LEAP = { from: 0.8, apex: 1.15, peak: 1.5, gap: 1.25, back: 1.3, off: 1.0, brace: 0.7, lampY: 2.8, bear: 0.62, swing: 0.45 };
const LEAP_END = LEAP.apex + (LEAP.apex - LEAP.from);
/** The hero's height at scene time t: a crouch, the leap (gravity), a braced landing. */
function leapY(t: number) {
  const g = 2 * LEAP.peak / ((LEAP.apex - LEAP.from) ** 2);
  if (t < LEAP.from) return -0.22 * Math.sin(Math.PI * t / LEAP.from);
  if (t < LEAP_END) return LEAP.peak - 0.5 * g * (t - LEAP.apex) ** 2;
  return -0.3 * Math.sin(Math.PI * Math.min(1, (t - LEAP_END) / LEAP.brace));
}
/** The lantern's bearing and the hero's place at each time: the geometry shared by the camera, the hero, the beats. */
export class LanternGeo {
  ux = 0; uz = 0; bx = 0; bz = 0; side = 1; ready = false; /** From the cut on the lamp is gone and the pole swings back: its last place stands for it. */ frozen = false; arena = 21; start = V(); L = V(); A = { x: 1, z: 0 };
  /** Fixed on the scene's first frame: the bearing of the swung pole, from the Ferryman, a little off the hero's line. */
  init(sim: River, m: Motor) {
    const dx = m.x - sim.x, dz = m.z - sim.z, d = Math.hypot(dx, dz) || 1; this.ux = dx / d; this.uz = dz / d;
    const c = Math.cos(LEAP.bear), s = Math.sin(LEAP.bear); this.bx = this.ux * c - this.uz * s; this.bz = this.ux * s + this.uz * c; this.arena = m.arena; this.start.set(m.x, 0, m.z); this.side = (-this.bz * this.ux + this.bx * this.uz) >= 0 ? 1 : -1; this.ready = true;
  }
  /** The lamp's own place (read from the view), and the line from the Ferryman to it. */
  lamp(sim: River, kit: RewardKit, t = 0) {
    if (t >= LANTERN.hit) this.frozen = true; else this.frozen = false;
    if (this.frozen) { /* keep L as it was at the cut */ } else if (kit.river) kit.river.lantern.getWorldPosition(this.L); else this.L.set(sim.x + this.bx * 5.6, LEAP.lampY, sim.z + this.bz * 5.6);
    const dx = this.L.x - sim.x, dz = this.L.z - sim.z, d = Math.hypot(dx, dz) || 1; this.A.x = dx / d; this.A.z = dz / d; return this.L;
  }
  /** The hero's world place at t (the feet): from where he stood, to a sword's reach from the lamp, then back and down. */
  hero(t: number, out: THREE.Vector3) {
    const H = LANTERN.hit, o = LEAP.off * this.side, lim = this.arena - 0.8, keep = (x: number, z: number) => { const q = Math.hypot(x, z); return q > lim ? [x * lim / q, z * lim / q] : [x, z]; };
    const [cx, cz] = keep(this.L.x - this.A.x * LEAP.gap - this.A.z * o, this.L.z - this.A.z * LEAP.gap + this.A.x * o), [lx, lz] = keep(cx - this.A.x * LEAP.back, cz - this.A.z * LEAP.back);
    const k = E(LEAP.from, H, t), r = E(H, LEAP_END, t);
    return out.set(this.start.x + (cx - this.start.x) * k + (lx - cx) * r, leapY(t), this.start.z + (cz - this.start.z) * k + (lz - cz) * r);
  }
}
export function lanternSpec(sim: River, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const H = LANTERN.hit, geo = run.lantern, P = V(), F = V(), B = V();
  return {
    frame: (t, eye, at) => {
      if (!geo.ready) geo.init(sim, m); const lp = geo.lamp(sim, kit, t), hp = geo.hero(t, P), k = E(0.2, H, t), r = E(H, 2.2, t);
      // the camera stands on the hero's side of the line from the Ferryman to the lamp, side-on, so the sweep of the pole, the leap and the cut are all in profile
      const sx = -geo.A.z, sz = geo.A.x, sg = geo.side;
      B.set(sim.x, 1.4, sim.z);
      // the focus: the Ferryman and the lamp, then the hero and the lamp, then the hero and the Ferryman
      F.set((B.x + lp.x) / 2, 2.1, (B.z + lp.z) / 2); const cx = (hp.x + lp.x) / 2, cz = (hp.z + lp.z) / 2, cy = (hp.y + 1.2 + lp.y) / 2;
      F.x += (cx - F.x) * k; F.z += (cz - F.z) * k; F.y += (cy - F.y) * k;
      F.x += ((sim.x + hp.x + lp.x) / 3 - F.x) * r; F.z += ((sim.z + hp.z + lp.z) / 3 - F.z) * r; F.y += (1.7 - F.y) * r;
      const dist = 8.2 - 3.4 * k + 3.2 * r, fov = 46 - 6 * k + 9 * r;
      eye.set(F.x + sx * sg * dist + geo.A.x * -0.8, 1.8 + 0.5 * k - 0.4 * r, F.z + sz * sg * dist + geo.A.z * -0.8); at.copy(F); return fov;
    },
    hero: (t, o) => { if (!geo.ready) geo.init(sim, m); const hp = geo.hero(t, P); o.set(hp.x - m.x, hp.y, hp.z - m.z); run.last.copy(o); },
    rate: t => run.rate(t, H, performance.now()),
    letterbox: true,
    cues: [{ t: LEAP.from, name: 'leap' }, { t: H, name: 'shatter' }, { t: LEAP_END, name: 'land' }],
  };
}
/** The lantern's own beats on the scene's clock: the pole swung out, the leap's whoosh, the shatter (glass, burning oil, a flare that dies), the landing. Called each frame while the scene runs. */
export function lanternBeats(sim: River, m: Motor, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const { fx } = kit, geo = run.lantern; if (!geo.ready) geo.init(sim, m);
  if (kit.river) kit.river.poleAim = { x: geo.bx, z: geo.bz, y: LEAP.lampY, k: E(0, LEAP.swing, t) * (1 - E(1.35, 2.1, t)) };
  // he faces the lamp through the leap, then the Ferryman as he lands
  { const lp = geo.lamp(sim, kit, t), px = m.x + run.last.x, pz = m.z + run.last.z, want = t < LANTERN.hit + 0.1 ? Math.atan2(lp.x - px, lp.z - pz) : Math.atan2(sim.x - px, sim.z - pz); let d = want - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * Math.min(1, 0.25 + (t > LANTERN.hit ? 0.1 : 0)); }
  run.once('leap', t, LEAP.from, () => sound.play('whooshH', { gain: 0.6, wet: 0.5 }));
  run.once('shatter', t, LANTERN.hit, () => {
    const L = geo.L.clone();
    sound.play('break', { gain: 1, wet: 0.4 }); sound.play('boom', { gain: 0.9, wet: 0.4 }); sound.play('fire', { gain: 0.8, wet: 0.5 }); sound.play('slam', { gain: 0.6, wet: 0.3 });
    fx.bursts.add('fire', L.clone(), 2.2, 0.6, time); fx.bursts.add('flare', L.clone(), 3.0, 0.3, time); fx.bursts.add('ring', L.clone(), 1.6, 0.4, time);
    fx.bursts.add('flare', L.clone(), 1.6, 0.25, time, 0.4, 0.9, 1.1, 1.3); // the glass: a pale flash among the orange
    fx.sparks.emit(L.clone(), V(0, 0.7, 0), 90, 6, 2.2, 1.4, time); // burning oil, thrown wide, falling
    fx.sparks.emit(L.clone(), V(0, 0.2, 0), 50, 4, 3.2, 1.0, time); // shards
    fx.sparks.emit(L.clone(), V(0, 1, 0), 14, 2, 0.6, -2.2, time); // embers that hang
    fx.puffs.emit(L.clone(), 10, 1.8, 1.2, time); kit.kick(1.0); if (kit.river) kit.river.lampHidden = true;
  });
  run.once('land', t, LEAP_END, () => { sound.play('thud', { gain: 0.6, wet: 0.3 }); kit.fx.puffs.emit(V(m.x + run.last.x, 0, m.z + run.last.z), 7, 1.6, 0.9, time); });
}

// ---------------------------------------------------------------- the Ferryman's chain
/** The chain's numbers. It runs taut from the anchor to his hand; the hero bounds in low and brings the khanda down on it, a third of the way from his hand; it parts, and both halves whip back. */
const LINK = { launch: 1.1, air: 0.4, cutAt: 0.5, off: 0.5, gap: 1.15, peak: 0.5, brace: 0.7, fade: [2.4, 3.2] as [number, number] };
export class ChainGeo {
  ready = false; start = V(); A = V(); Hd = V(); B = V(); perp = { x: 0, z: 0 }; side = 1; arena = 21;
  /** Fixed on the scene's first frame: the anchor, which side the hero stands, and the place he will cut from. */
  init(sim: River, m: Motor, hand: THREE.Vector3) {
    this.A.set(sim.lastAnchor.x, 0.15, sim.lastAnchor.z); this.Hd.copy(hand); this.arena = m.arena; this.start.set(m.x, 0, m.z);
    const dx = hand.x - this.A.x, dz = hand.z - this.A.z, d = Math.hypot(dx, dz) || 1; this.perp = { x: -dz / d, z: dx / d };
    this.side = ((m.x - this.A.x) * this.perp.x + (m.z - this.A.z) * this.perp.z) >= 0 ? 1 : -1; this.ready = true; this.cut(hand);
  }
  /** The cut point on the chain (it follows his hand). */
  cut(hand: THREE.Vector3) { this.Hd.copy(hand); return this.B.lerpVectors(this.A, this.Hd, LINK.cutAt); }
  /** The hero's world place at t: a crouch, a low bound to the chain (landing on the cut), a braced crouch, up. */
  hero(t: number, out: THREE.Vector3) {
    const lim = this.arena - 0.8, o = LINK.off * this.side; const dx = this.Hd.x - this.A.x, dz = this.Hd.z - this.A.z, dl = Math.hypot(dx, dz) || 1; let cx = this.B.x - dx / dl * LINK.gap + this.perp.x * o, cz = this.B.z - dz / dl * LINK.gap + this.perp.z * o; const q = Math.hypot(cx, cz); if (q > lim) { cx *= lim / q; cz *= lim / q; }
    const end = LINK.launch + LINK.air, dist = Math.hypot(cx - this.start.x, cz - this.start.z), t0 = Math.max(0.2, LINK.launch - Math.max(0, dist - 4) / 8), k = E(t0, end, t);
    let y: number; if (t < LINK.launch) y = -0.22 * Math.sin(Math.PI * Math.min(1, t / LINK.launch)); else if (t < end) { const u = (t - LINK.launch) / LINK.air; y = LINK.peak * 4 * u * (1 - u); } else y = -0.3 * Math.sin(Math.PI * Math.min(1, (t - end) / LINK.brace));
    return out.set(this.start.x + (cx - this.start.x) * k, y, this.start.z + (cz - this.start.z) * k);
  }
}
export function chainSpec(sim: River, m: Motor, kit: RewardKit, run: RewardRun): MomentSpec {
  const H = CHAIN.hit, geo = run.chainGeo, P = V(), F = V(), Hh = V();
  const handAt = () => { if (kit.river) kit.river.mark('handL', Hh); else Hh.set(sim.x, 1.0, sim.z); return Hh; };
  const ready = () => { if (!geo.ready) geo.init(sim, m, handAt()); };
  return {
    frame: (t, eye, at) => {
      ready(); handAt(); const B = geo.cut(Hh), hp = geo.hero(t, P), k = E(0.3, H, t), r = E(H, H + 0.5, t), cs = geo.side;
      // the camera stands on the hero's side, low and square to the chain, so the leap, the blade and the chain are all in profile
      F.set((B.x + hp.x) / 2, 1.0, (B.z + hp.z) / 2); F.x += (B.x - F.x) * k; F.z += (B.z - F.z) * k; F.y += (0.9 - F.y) * k;
      F.x += ((B.x + hp.x + Hh.x) / 3 - F.x) * r; F.z += ((B.z + hp.z + Hh.z) / 3 - F.z) * r; F.y += (1.1 - F.y) * r;
      const dist = 7.6 - 2.2 * k + 1.6 * r, fov = 46 - 4 * k + 6 * r;
      eye.set(F.x + geo.perp.x * cs * dist, 1.15 + 0.5 * r, F.z + geo.perp.z * cs * dist); at.copy(F); return fov;
    },
    hero: (t, o) => { ready(); const hp = geo.hero(t, P); o.set(hp.x - m.x, hp.y, hp.z - m.z); run.last.copy(o); },
    rate: t => run.rate(t, H, performance.now()),
    letterbox: true, snap: true,
    cues: [{ t: LINK.launch, name: 'leap' }, { t: H, name: 'snap' }],
  };
}
export function chainBeats(sim: River, m: Motor, kit: RewardKit, run: RewardRun, t: number, time: number) {
  const geo = run.chainGeo, hand = V(); if (kit.river) kit.river.mark('handL', hand); else hand.set(sim.x, 1.0, sim.z);
  if (!geo.ready) geo.init(sim, m, hand);
  const dt = run.tick(time);
  if (kit.river) {
    if (!run.chain) run.chain = new RewardChain(kit.river.fxv.links, kit.river.fxv.group);
    if (!run.chain.broken) run.chain.taut(geo.A, hand, time); else run.chain.step(dt, hand, E(LINK.fade[0], LINK.fade[1], t));
  }
  { const B = geo.cut(hand), px = m.x + run.last.x, pz = m.z + run.last.z, want = t < CHAIN.hit + 0.1 ? Math.atan2(B.x - px, B.z - pz) : Math.atan2(sim.x - px, sim.z - pz); let d = want - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * 0.3; }
  run.once('leap', t, LINK.launch, () => sound.play('whooshH', { gain: 0.6, wet: 0.5 }));
  run.once('snap', t, CHAIN.hit, () => {
    const C = geo.B.clone();
    sound.play('snap', { gain: 1, wet: 0.4 }); sound.play('slam', { gain: 0.8, wet: 0.3 }); sound.play('boom', { gain: 0.55, wet: 0.3 }); sound.play('chainSlide', { gain: 0.8, wet: 0.4 });
    kit.fx.sparks.emit(C.clone(), V(0, 0.8, 0), 110, 7, 2.6, 0.9, time); kit.fx.sparks.emit(C.clone(), V(geo.perp.x * -geo.side, 0.3, geo.perp.z * -geo.side), 50, 5, 1.6, 0.6, time);
    kit.fx.bursts.add('flare', C.clone(), 1.8, 0.25, time); kit.fx.bursts.add('ring', C.clone(), 1.5, 0.35, time); kit.fx.puffs.emit(V(C.x, 0, C.z), 8, 1.8, 1, time); kit.kick(0.9);
    run.chain?.cut(geo.A, hand, LINK.cutAt);
  });
  run.once('land', t, LINK.launch + LINK.air, () => { sound.play('thud', { gain: 0.5, wet: 0.3 }); kit.fx.puffs.emit(V(m.x + run.last.x, 0, m.z + run.last.z), 6, 1.5, 0.8, time); });
}

/** The Ferryman's two rewards, built on the river's clock, and the run that times them. */
export function riverRewards(sim: River, m: Motor, kit: RewardKit, run: RewardRun): Pick<Record<RewardKind, MomentSpec>, 'lantern' | 'chain'> {
  return { lantern: lanternSpec(sim, m, kit, run), chain: chainSpec(sim, m, kit, run) };
}
