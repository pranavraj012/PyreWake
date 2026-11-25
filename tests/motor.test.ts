import { describe, expect, it } from 'vitest';
import { Motor, RUN, WALK } from '../src/player/motor.ts';
import { BODY_CLIPS } from '../src/player/clips.ts';
import { KHANDA } from '../src/weapons/khanda.ts';
import { clip, makePose, moveAt, sampleClip, N, IX } from '../src/anim/pose.ts';
const COMBO = KHANDA.combo, C = { ...BODY_CLIPS, ...KHANDA.clips };
const DT = 1 / 60, tap = (a: string) => [{ a, up: false }, { a, up: true }];
const run = (m: Motor, s: number, mx = 0, mz = 0) => { const names: string[] = []; for (let i = 0; i < s * 60; i++) { m.step(DT, mx, mz, []); for (const e of m.events) if (e.startsWith('clip:')) names.push(e.slice(5)); } return names; };
describe('motor', () => {
  it('half stick walks, full stick runs', () => { const m = new Motor(); run(m, 0.6, 0, -0.4); expect(m.speed).toBeCloseTo(WALK, 1); run(m, 0.6, 0, -0.9); expect(m.speed).toBeCloseTo(RUN, 1); });
  it('mashing attack gives the clean five-hit chain in order', () => { const m = new Motor(), seen: string[] = []; for (let i = 0; i < 60 * 4 && seen.length < 5; i++) { m.step(DT, 0, 0, i % 8 === 0 ? tap('attack') : []); for (const e of m.events) if (e.startsWith('clip:')) seen.push(e.slice(5)); } expect(seen).toEqual(COMBO); });
  it('a pause resets the chain', () => { const m = new Motor(); m.step(DT, 0, 0, tap('attack')); run(m, 2.5); m.step(DT, 0, 0, tap('attack')); m.step(DT, 0, 0, []); expect(m.clip?.name).toBe('light1'); });
  it('dodge cancels any attack at any moment', () => { for (const n of [...COMBO, 'heavy', ...KHANDA.finishers]) for (const f of [0.05, 0.5, 0.9]) { const m = new Motor(); m.clip = C[n]; m.state = 'clip'; m.t = C[n].dur * f; m.step(DT, 1, 0, tap('dodge')); m.step(DT, 1, 0, []); expect(m.clip?.name).toMatch(/^dodge/); expect(m.safe).toBeGreaterThan(0.2); } });
  it('early attack press during a dodge is buffered', () => { const m = new Motor(); m.step(DT, 0, 0, tap('dodge')); run(m, 0.25); m.step(DT, 0, 0, tap('attack')); const seen = run(m, 0.2); expect(seen).toContain('flare'); });
  it('holding attack charges, releasing strikes', () => { const m = new Motor(); m.step(DT, 0, 0, [{ a: 'attack', up: false }]); run(m, 0.7); expect(m.clip?.name).toBe('charge'); m.step(DT, 0, 0, [{ a: 'attack', up: true }]); m.step(DT, 0, 0, []); expect(m.clip?.name).toBe('heavy'); });
  it('dodge direction is relative to the boss', () => { const go = (mx: number, mz: number) => { const m = new Motor(); m.x = 0; m.z = 4; m.target = { x: 0, z: 0, r: 0.75 }; m.step(DT, mx, mz, tap('dodge')); return m.clip?.name; }; expect(go(0, -1)).toBe('dodgeF'); expect(go(0, 1)).toBe('dodgeB'); expect(go(1, 0)).toBe('dodgeR'); expect(go(-1, 0)).toBe('dodgeL'); });
  it('stays in the arena and out of pillars', () => { const m = new Motor(); m.blockers = [{ x: 0, z: 5, r: 0.85 }]; run(m, 2, 0, -1); expect(Math.hypot(m.x, m.z - 5)).toBeGreaterThanOrEqual(1.19); run(m, 12, 1, 0); expect(Math.hypot(m.x, m.z)).toBeLessThan(21.5); });
  it('attack steps toward the target but not through it', () => { const m = new Motor(); m.x = 0; m.z = 2; m.target = { x: 0, z: 0, r: 0.75 }; for (let i = 0; i < 300; i++) m.step(DT, 0, 0, i % 8 === 0 ? tap('attack') : []); expect(Math.hypot(m.x, m.z)).toBeGreaterThanOrEqual(1.09); });
  it('flicks the blade once after a combo, then rests', () => { const m = new Motor(); m.step(DT, 0, 0, tap('attack')); const s = run(m, 4); expect(s.filter(x => x === 'flick').length).toBe(1); });
});
describe('clips', () => {
  it('every clip is well-formed', () => { for (const c of Object.values(C)) { expect(c.keys[0].t).toBe(0); for (let i = 1; i < c.keys.length; i++) expect(c.keys[i].t).toBeGreaterThan(c.keys[i - 1].t); expect(c.keys.at(-1)!.t).toBeLessThanOrEqual(c.dur + 1e-6); if (c.hit) { expect(c.hit[0]).toBeLessThan(c.hit[1]); expect(c.chain!).toBeGreaterThan(c.hit[1]); } } });
  it('samples contain no NaN and never overshoot their keys', () => { const b = makePose(), o = new Float32Array(N); for (const c of Object.values(C)) for (let t = 0; t <= c.dur; t += 0.01) { sampleClip(c, t, b, o); for (const v of o) expect(Number.isFinite(v)).toBe(true); const rl = c.tracks[IX.rl]; if (rl.v.length) { expect(o[IX.rl]).toBeLessThanOrEqual(Math.max(...rl.v) + 1e-4); } } });
  it('monotone interpolation holds flat between equal keys', () => { const c = clip('x', { dur: 1, keys: [{ t: 0, hy: 0 }, { t: 0.4, hy: 1 }, { t: 0.6, hy: 1 }, { t: 1, hy: 0 }], move: [[0, 0], [1, 2]] }); const o = sampleClip(c, 0.465, makePose(), new Float32Array(N)); expect(o[IX.hy]).toBeCloseTo(1, 5); expect(moveAt(c, 0.5)).toBeCloseTo(1, 5); });
});
