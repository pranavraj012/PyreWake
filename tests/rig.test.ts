import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Rig } from '../src/anim/rig.ts';
import { HUMAN, KING } from '../src/anim/skeletons.ts';
import { MATS } from '../src/render/mats.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('rig', () => {
  it('parents always precede children', () => { for (const d of [HUMAN, KING]) { const r = new Rig(d); r.parent.forEach((p, i) => expect(p).toBeLessThan(i)); } });
  it('rest pose reproduces rest positions', () => { const r = new Rig(KING); r.reset(); r.pos.forEach((p, i) => expect(p.distanceTo(r.rest[i])).toBeLessThan(1e-6)); });
  it('IK reaches reachable targets and keeps bone lengths', () => {
    const r = new Rig(HUMAN); r.reset();
    for (const t of [V(0.4, 1.3, 0.3), V(0.2, 1.1, 0.35), V(0.5, 1.6, 0.1)]) {
      r.ik('upperArm.L', 'foreArm.L', 'hand.L', t, V(0.6, -0.4, -0.6), V(0, 0, -1));
      expect(r.pos[r.i('hand.L')].distanceTo(t)).toBeLessThan(1e-3);
      const a = r.i('upperArm.L'), b = r.i('foreArm.L');
      expect(r.pos[a].distanceTo(r.pos[b])).toBeCloseTo(r.rest[a].distanceTo(r.rest[b]), 4);
    }
  });
  it('IK clamps unreachable targets without NaN', () => {
    const r = new Rig(HUMAN); r.reset(); r.ik('upperArm.R', 'foreArm.R', 'hand.R', V(-5, 5, 5), V(-1, 0, 0), V(0, 0, -1));
    for (const q of r.rot) expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
  });
  it('FK after IK agrees with the IK result', () => {
    const r = new Rig(HUMAN); r.reset(); const t = V(-0.3, 1.1, 0.3);
    r.ik('upperArm.R', 'foreArm.R', 'hand.R', t, V(-0.7, -0.3, -0.6), V(0, 0, -1)); r.fk();
    expect(r.pos[r.i('hand.R')].distanceTo(t)).toBeLessThan(1e-3);
  });
});

describe('materials', () => { it('ids match their index', () => MATS.forEach((m, i) => expect(m.id).toBe(i))); });
