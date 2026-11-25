// Measures what the eye complains about: sliding feet, popping joints, feet through the floor, stretched limbs.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Motor } from '../src/player/motor.ts';
import { KHANDA } from '../src/weapons/khanda.ts';
import { KING_MODES, type KingMode } from '../src/boss/king.ts';
import { Bursts } from '../src/render/impact.ts';
import { PlayerView } from '../src/player/view.ts';
import { KingView } from '../src/boss/kingView.ts';
import { Puffs, Sparks } from '../src/render/fx.ts';

const COMBO = KHANDA.combo, FX = () => ({ sparks: new Sparks(50, 1), gore: new Sparks(50, 1, true), puffs: new Puffs(), bursts: new Bursts() });
const DT = 1 / 60, geo = () => { const g = new THREE.BoxGeometry(); const n = g.attributes.position.count; g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(n * 4), 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(n * 4).fill(0.25), 4)); return g; };
const mat = new THREE.MeshBasicMaterial(), depth = { skin: mat, still: mat };
const make = () => { const scene = new THREE.Scene(), fx = FX(); const m = new Motor(); m.arena = 1e6; return { m, v: new PlayerView(scene, geo(), geo(), geo(), mat, mat, depth, fx, 1, KHANDA) }; };
const ankle = (v: PlayerView, S: string) => v.rig.bones[v.rig.i('foot.' + S)].getWorldPosition(new THREE.Vector3());

describe('player motion', () => {
  for (const [name, stick] of [['walk', 0.4], ['run', 0.9], ['sprint', 1]] as const) it(`${name}: planted feet do not slide`, () => {
    const { m, v } = make(); let t = 0, worst = 0, sum = 0, n = 0; const prev = [new THREE.Vector3(), new THREE.Vector3()], was = [false, false];
    for (let i = 0; i < 300; i++) {
      m.step(DT, 0, -stick, []); t += DT; v.update(DT, m, t);
      ['L', 'R'].forEach((S, k) => {
        const a = ankle(v, S), st = v.gait.stance[k] && v.gait.pitch[k] <= 0; // heel still down
        if (i > 150 && st && was[k]) { const d = Math.hypot(a.x - prev[k].x, a.z - prev[k].z); worst = Math.max(worst, d); sum += d; n++; }
        prev[k].copy(a); was[k] = st; expect(a.y).toBeGreaterThan(0.02);
      });
    }
    expect(n).toBeGreaterThan(20); expect(sum / n).toBeLessThan(0.006); expect(worst).toBeLessThan(0.03);
  });
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) it(`guard step at ${Math.round(a * 57)} deg: planted feet do not slide`, () => {
    const { m, v } = make(); m.guardHeld = true; let t = 0, sum = 0, n = 0; const prev = [new THREE.Vector3(), new THREE.Vector3()], was = [false, false];
    for (let i = 0; i < 240; i++) { m.step(DT, Math.sin(m.yaw + a), Math.cos(m.yaw + a), []); t += DT; v.update(DT, m, t); ['L', 'R'].forEach((S, k) => { const q = ankle(v, S), st = v.gait.stance[k] && v.gait.pitch[k] <= 0; if (i > 90 && st && was[k]) { sum += Math.hypot(q.x - prev[k].x, q.z - prev[k].z); n++; } prev[k].copy(q); was[k] = st; }); }
    expect(n).toBeGreaterThan(20); expect(sum / n).toBeLessThan(0.008);
  });
  it('turning hard while running does not tear the legs', () => {
    const { m, v } = make(); let t = 0; const rest = v.rig.rest[v.rig.i('thigh.L')].distanceTo(v.rig.rest[v.rig.i('shin.L')]);
    for (let i = 0; i < 400; i++) { const a = Math.floor(i / 40) * 2.1; m.step(DT, Math.sin(a), Math.cos(a), []); t += DT; v.update(DT, m, t); expect(v.rig.pos[v.rig.i('thigh.L')].distanceTo(v.rig.pos[v.rig.i('shin.L')])).toBeCloseTo(rest, 3); for (const q of v.rig.rot) expect(Number.isFinite(q.w)).toBe(true); }
  });
  it('transitions never pop', () => {
    const { m, v } = make(); let t = 0; const prev = new THREE.Vector3(), q0 = new THREE.Quaternion(); let prevClip = ''; let since = 9, lastStart = 0, lastFree = true, worstStrike = 0, worstHip = 0, worstSpine = 0, worstName = '', hipName = '', strikeName = '';
    const tap = (a: string) => [{ a, up: false }, { a, up: true }];
    for (let i = 0; i < 900; i++) {
      const ev = i % 97 === 40 ? tap('dodge') : i % 7 === 0 && i % 300 < 200 ? tap('attack') : []; m.step(DT, i % 250 < 60 ? 1 : 0, i % 250 < 60 ? 0.2 : 0, ev); t += DT; v.update(DT, m, t);
      const hip = v.rig.pos[0].clone(), q = v.rig.rot[v.rig.i('chest')].clone();
      if (m.started !== lastStart || (m.state === 'free') !== lastFree) { since = 0; lastStart = m.started; lastFree = m.state === 'free'; } else since++;
      if (i > 5) { const dh = hip.distanceTo(prev), dq = q.angleTo(q0) * 57.3; if (dh > worstHip) { worstHip = dh; hipName = (m.clip?.name ?? 'loco') + '@' + m.t.toFixed(2); } if (dq > worstStrike) { worstStrike = dq; strikeName = (m.clip?.name ?? 'loco') + '@' + m.t.toFixed(2); } if (since < 5 && dq > worstSpine) { worstSpine = dq; worstName = (m.clip?.name ?? 'loco') + '@' + m.t.toFixed(3) + ' frame ' + since + ' step ' + i + ' from ' + prevClip; } }
      prev.copy(hip); q0.copy(q); if (m.started === lastStart && since > 5) prevClip = m.clip?.name ?? 'loco';
    }
    expect(worstHip, 'hip jump per frame (m) in ' + hipName).toBeLessThan(0.16); expect(worstSpine, 'chest turn per frame (deg) in ' + worstName).toBeLessThan(20);
    expect(worstStrike, 'fastest authored strike (deg/frame) in ' + strikeName).toBeLessThan(32);
  });
  it('the blade reaches out at contact in every attack', () => {
    for (const n of [...KHANDA.chains.flat().filter(n => n !== 'alt4'), 'heavy', 'riposteA', ...KHANDA.finishers.slice(0, 3)]) {
      const { m, v } = make(); let t = 0; for (let i = 0; i < 30; i++) { m.step(DT, 0, 0, []); v.update(DT, m, t += DT); }
      (m as never as { begin(n: string): void }).begin(n); let best = 0; const x0 = m.x, z0 = m.z;
      for (let i = 0; i < 60; i++) { m.step(DT, 0, 0, []); v.update(DT, m, t += DT); if (m.clip?.name === n && m.clip.hit && m.t >= m.clip.hit[0] && m.t <= m.clip.hit[1]) best = Math.max(best, Math.hypot(v.tip.x - m.x, v.tip.z - m.z)); }
      expect(best, n).toBeGreaterThan(1.35); void x0; void z0;
    }
  });
});

describe('king motion', () => {
  const mk = () => { const scene = new THREE.Scene(); return new KingView(scene, geo(), geo(), geo(), mat, mat, mat, depth, FX()); };
  it('cycles every mode without NaN', () => { const k = mk(); let t = 0; for (const m of [...KING_MODES, ...KING_MODES].reverse() as KingMode[]) { k.sim.set(m); for (let i = 0; i < 200; i++) { k.drive(DT, Math.sin(t) * 3, 8, t += DT); for (const q of k.rig.rot) expect(Number.isFinite(q.w)).toBe(true); } } });
  it('hanging: the head settles within sword reach and above the floor', () => { const k = mk(); let t = 0; k.sim.set('hang'); let lo = 9, hi = 0; for (let i = 0; i < 600; i++) { k.drive(DT, 0, 8, t += DT); if (i > 120) { const y = k.hurt(new THREE.Vector3()).y; lo = Math.min(lo, y); hi = Math.max(hi, y); } } expect(lo).toBeGreaterThan(0.7); expect(hi).toBeLessThan(2.3); });
  it('crawl: planted hands and feet hold still', () => { const k = mk(); let t = 0, sum = 0, n = 0; k.sim.set('crawl'); const p = [0, 1, 2, 3].map(() => new THREE.Vector3()), w = [false, false, false, false]; for (let i = 0; i < 500; i++) { k.drive(DT, 0, 6, t += DT); k.gait4.stance.forEach((s, j) => { if (i > 120 && s && w[j]) { sum += k.gait4.pos[j].distanceTo(p[j]); n++; } p[j].copy(k.gait4.pos[j]); w[j] = s; }); } expect(sum / n).toBeLessThan(0.02); });
});
