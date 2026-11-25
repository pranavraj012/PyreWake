import { describe, expect, it } from 'vitest';
import gold from './hero.gold.json';
import { KHANDA } from '../src/weapons/khanda.ts';
import { IX, makePose, sampleClip } from '../src/anim/pose.ts';
import { BODY_CLIPS } from '../src/player/clips.ts';

const wrap = (a: number) => a - Math.round(a / 360) * 360;
describe('hero combos', () => {
  it('keep their timing, power and travel', () => {
    for (const [n, g] of Object.entries(gold)) { const c = KHANDA.clips[n]; expect(c, n).toBeDefined(); for (const k of Object.keys(g) as (keyof typeof g)[]) expect((c as any)[k], n + '.' + k).toEqual((g as any)[k]); }
  });
  it('never end facing away from the boss', () => {
    const out = makePose(), base = makePose();
    for (const [n, c] of Object.entries({ ...KHANDA.clips, ...BODY_CLIPS })) {
      if (['rites', 'finale', 'execute', 'plunge', 'jump'].includes(n)) continue;
      for (const t of [c.free && c.free > 0.2 ? c.free : c.dur, c.dur]) { sampleClip(c, t, base, out); const f = wrap(out[IX.tw] + out[IX.hw] * 0.6 + out[IX.sw] * 0.4); expect(Math.abs(f), `${n}@${t}`).toBeLessThanOrEqual(66); }
    }
  });
});
