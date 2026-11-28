// The hero's reward scenes (module A, rewardShots.ts): where the hero is drawn through each scene, and where he really stands when it lets go of him.
// Headless: the geometry is pure. The damage-once and the heavy-attack cases are in momentStates.test.ts.
import { describe, expect, it } from 'vitest';
import { Motor } from '../src/player/motor.ts';
import { River, LANTERN, CHAIN } from '../src/bosses/river/river.ts';
import { ChainGeo, LanternGeo, RewardRun, type RewardKit } from '../src/game/rewardShots.ts';
import * as THREE from 'three';

const kit = { fx: null as never, kick() { } } as RewardKit;

describe('the lantern scene', () => {
  const sim = new River(); const spots: [number, number, number, number][] = [];
  for (const r of [2.5, 4, 7, 12]) for (let a = 0; a < 6.28; a += 0.7) for (const bx of [0, 14]) spots.push([bx, 0, bx + r * Math.sin(a), r * Math.cos(a)]);
  it('ends with the hero on the floor, inside the arena, clear of the boss, whatever his start', () => {
    for (const [bx, , hx, hz] of spots) {
      sim.x = bx; sim.z = -4; const m = new Motor(); m.x = hx; m.z = hz - 4; if (Math.hypot(m.x, m.z) > m.arena - 1) continue;
      const geo = new LanternGeo(), run = new RewardRun(kit); geo.init(sim, m); geo.lamp(sim, kit, 0);
      const p = geo.hero(LANTERN.len, new THREE.Vector3()); run.last.set(p.x - m.x, p.y, p.z - m.z); run.end(m);
      expect(p.y).toBeCloseTo(0, 5); expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(m.arena - 0.5); expect(Math.hypot(m.x - sim.x, m.z - sim.z)).toBeGreaterThan(1.8);
    }
  });
  it('is airborne at the cut with the blade a sword away from the lamp, and the height is a believable leap', () => {
    const m = new Motor(); m.x = 0; m.z = -1; sim.x = 0; sim.z = -4; const geo = new LanternGeo(); geo.init(sim, m); geo.lamp(sim, kit, 0);
    const p = geo.hero(LANTERN.hit, new THREE.Vector3()); expect(p.y).toBeGreaterThan(1); expect(p.y).toBeLessThan(2);
    expect(Math.hypot(p.x - geo.L.x, p.z - geo.L.z)).toBeLessThan(2.2);
    let top = 0; for (let t = 0; t < LANTERN.len; t += 1 / 60) top = Math.max(top, geo.hero(t, new THREE.Vector3()).y); expect(top).toBeLessThan(2);
  });
});

describe('the chain scene', () => {
  it('ends with the hero on the floor, inside the arena, clear of the boss, whatever the chain and his start', () => {
    const sim = new River();
    for (const len of [2.5, 4, 7]) for (let a = 0; a < 6.28; a += 0.8) for (const r of [2, 5, 11]) for (const ex of [0, 15]) {
      const boss = new THREE.Vector3(ex, 1, -3), anchor = { x: boss.x + len * Math.sin(a), z: boss.z + len * Math.cos(a) }; if (Math.hypot(anchor.x, anchor.z) > 20) continue;
      sim.x = boss.x; sim.z = boss.z; sim.lastAnchor = anchor; const m = new Motor(); m.x = anchor.x + r * Math.cos(a); m.z = anchor.z - r * Math.sin(a); if (Math.hypot(m.x, m.z) > m.arena - 1) continue;
      const geo = new ChainGeo(), run = new RewardRun(kit); geo.init(sim, m, boss);
      const p = geo.hero(CHAIN.len, new THREE.Vector3()); run.last.set(p.x - m.x, p.y, p.z - m.z); run.end(m);
      expect(p.y).toBeCloseTo(0, 5); expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(m.arena - 0.5); expect(Math.hypot(m.x - boss.x, m.z - boss.z)).toBeGreaterThan(1.3);
    }
  });
  it('lands low and quick: the bound is under a metre and under 0.7 s', () => {
    const sim = new River(); sim.x = 0; sim.z = -4; sim.lastAnchor = { x: 3, z: 0 }; const m = new Motor(); m.x = 2; m.z = 1; const geo = new ChainGeo(); geo.init(sim, m, new THREE.Vector3(0, 1, -4));
    let top = 0, air = 0; for (let t = 0; t < CHAIN.len; t += 1 / 60) { const y = geo.hero(t, new THREE.Vector3()).y; top = Math.max(top, y); if (y > 0.02) air += 1 / 60; }
    expect(top).toBeLessThan(1); expect(air).toBeLessThan(0.72);
  });
});

import { King, RIDE } from '../src/bosses/king/king.ts';
import { RideGeo } from '../src/bosses/king/kingRewards.ts';

describe('the ride scene', () => {
  it('ends with the hero on the floor, inside the arena, clear of the King, whatever his start and the King\'s facing', () => {
    for (const yaw of [0, 1.3, 2.9, -2]) for (const kx of [0, 14, -14]) for (const [dx, dz] of [[3, 3], [-4, 2], [0, -5], [5, -5], [-2, 7]]) {
      const sim = new King(); sim.x = kx; sim.z = -3; sim.yaw = yaw; const m = new Motor(); m.x = kx + dx; m.z = -3 + dz; if (Math.hypot(m.x, m.z) > m.arena - 1) continue;
      const geo = new RideGeo(), run = new RewardRun(kit), chest = new THREE.Vector3(kx, 1.7, -3); geo.init(sim, m, chest);
      const p = geo.hero(sim, chest, RIDE.len, new THREE.Vector3()); run.last.set(p.x - m.x, p.y, p.z - m.z); run.end(m);
      expect(p.y).toBeCloseTo(0, 5); expect(Math.hypot(m.x, m.z)).toBeLessThanOrEqual(m.arena - 0.5); expect(Math.hypot(m.x - sim.x, m.z - sim.z)).toBeGreaterThan(1.8);
    }
  });
  it('is on his back at every blow, and his leap is the game\'s own gravity (under 3 m, under 0.8 s)', () => {
    const sim = new King(); sim.x = 0; sim.z = -4; sim.yaw = 0; const m = new Motor(); m.x = 1.5; m.z = 0.5; const geo = new RideGeo(), chest = new THREE.Vector3(0, 1.7, -4.5); geo.init(sim, m, chest);
    for (const h of RIDE.hits) { const p = geo.hero(sim, chest, h, new THREE.Vector3()), b = geo.back(chest, new THREE.Vector3()); expect(Math.hypot(p.x - b.x, p.z - b.z)).toBeLessThan(0.05); expect(Math.abs(p.y - b.y)).toBeLessThan(0.3); }
    let top = 0, air = 0; for (let t = 0; t < RIDE.hits[0]; t += 1 / 60) { const y = geo.hero(sim, chest, t, new THREE.Vector3()).y; top = Math.max(top, y); if (y > 0.05) air += 1 / 60; }
    expect(top).toBeLessThan(3); expect(air).toBeLessThan(0.8);
  });
});

import { RopeGeo, ROPE_GO } from '../src/bosses/king/kingRewards.ts';
import { RIP, ROPE } from '../src/bosses/king/king.ts';

describe('the rope scene', () => {
  it('the cut is on the rope, above his ankles; the hero leaps in place on the game\'s gravity and ends on the floor', () => {
    for (const th of [0, 0.3, -0.5]) for (const dir of [0, 2, 4]) {
      const sim = new King(); sim.x = 1; sim.z = -3; sim.th = th; sim.dir = dir; const geo = new RopeGeo().ends(sim);
      expect(geo.cut.y).toBeGreaterThan(geo.ankle.y); expect(geo.cut.y).toBeLessThan(ROPE); expect(geo.ankle.y).toBeGreaterThan(4.5);
      expect(geo.cut.distanceTo(geo.pivot) + geo.cut.distanceTo(geo.ankle)).toBeCloseTo(geo.pivot.distanceTo(geo.ankle), 4);
    }
    const geo = new RopeGeo(); let top = 0, air = 0; for (let t = 0; t < RIP.len; t += 1 / 60) { const y = geo.heroY(t); top = Math.max(top, y); if (y > 0.05) air += 1 / 60; }
    expect(top).toBeLessThan(1.6); expect(air).toBeLessThan(0.8); expect(geo.heroY(RIP.len)).toBeCloseTo(0, 1);
  });
  it('the fire reaches the rope in the time between the release and the cut, at a speed a thrown blade of fire could have', () => {
    const sim = new King(); sim.x = 0; sim.z = -3; const geo = new RopeGeo().ends(sim), from = new THREE.Vector3(0, 2.0, 2);
    const speed = from.distanceTo(geo.cut) / (RIP.cut - ROPE_GO.release); expect(RIP.cut).toBeGreaterThan(ROPE_GO.release); expect(speed).toBeLessThan(60);
  });
});
