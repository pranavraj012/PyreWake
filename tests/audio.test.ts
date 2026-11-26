import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIST } from '../src/audio/tracks.ts';
import { MUSIC, dangerDuck } from '../src/audio/score.ts';

const music = (n: string) => fileURLToPath(new URL(`../public/music/${n}.mp3`, import.meta.url));

describe('world audio (module K)', () => {
  it('every recorded piece in the track list has its file in public/music', () => {
    for (const n of Object.keys(LIST)) expect(existsSync(music(n)), n).toBe(true);
  });

  it('every mood that names a recorded piece names one the track list knows', () => {
    for (const [mood, m] of Object.entries(MUSIC)) if (m) for (const n of ([] as string[]).concat(m[0])) expect(LIST[n as keyof typeof LIST], mood).toBeDefined();
  });

  it('the region and hub moods are driven by their own pieces', () => {
    expect(MUSIC.region?.[0]).toBe('region');
    expect(MUSIC.hub?.[0]).toBe('hub');
  });

  it('danger leaves the piece untouched when off, and drops it at most by under half', () => {
    expect(dangerDuck(0)).toBe(1);
    expect(dangerDuck(1)).toBeCloseTo(0.55, 5);
    expect(dangerDuck(-3)).toBe(1);
    expect(dangerDuck(9)).toBeCloseTo(0.55, 5);
  });
});
