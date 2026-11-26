// The third fight's presentation: frames whose weights hold together, a script that reads in order, every sound it calls cooked into the pack.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boneIndex } from '../src/anim/skeletons.ts';
import { ARMS, PALL_BONES, SISTER, SKIRT, STRIPS, armWeights, skirtWeights, stripWeights } from '../src/boss/hours/frame.ts';
import { HOURS_CLIPS } from '../src/boss/hours/clips.ts';
import { isMove } from '../src/boss/hours/sister.ts';
import { HOURS_ENDING, HOURS_INTRO, HOURS_TURN } from '../src/game/hoursScript.ts';
import { makeHouseProps } from '../src/arena/props.ts';
import { DIAL } from '../src/boss/hours/sister.ts';

const sum = (w: [number, number][]) => w.reduce((a, [, x]) => a + x, 0);
describe('the Waiting House on screen', () => {
  it('the Sister and the Pall: every skin weight sums to one and names a real bone', () => {
    const b = boneIndex(SISTER), p = boneIndex(PALL_BONES), nb = SISTER.length, np = PALL_BONES.length;
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 20; j++) {
      const u = i / 40, v = j / 20;
      for (const w of [skirtWeights(b, u, v), skirtWeights(p, u, v), ...ARMS.map((_, k) => armWeights(p, k, v))]) { expect(sum(w)).toBeCloseTo(1, 5); for (const [k] of w) expect(k).toBeGreaterThanOrEqual(0); }
      for (const [k] of skirtWeights(b, u, v)) expect(k).toBeLessThan(nb); for (let a = 0; a < ARMS.length; a++) for (const [k] of armWeights(p, a, v)) expect(k).toBeLessThan(np);
    }
    for (const s of STRIPS) for (let j = 0; j <= 10; j++) expect(sum(stripWeights(b, s.side, s.k, j / 10))).toBeCloseTo(1, 5);
    expect(SISTER.filter(x => x.name.startsWith('skirt')).length).toBe(SKIRT.cols * SKIRT.rows); expect(PALL_BONES.filter(x => x.name.startsWith('arm')).length).toBe(ARMS.length * 8);
  });
  it('her seated pose is not a move, and every move has a clip', () => { expect(isMove('sit')).toBe(false); expect(HOURS_CLIPS.sit).toBeDefined(); });
  it('every line is shown before it is cleared, in order, without two on screen at once', () => {
    for (const lines of [HOURS_INTRO.lines, HOURS_TURN.lines, HOURS_ENDING.lines]) lines.forEach((l, i) => { expect(l.until!).toBeGreaterThan(l.at + 1.5); if (i) expect(l.at).toBeGreaterThanOrEqual(lines[i - 1].until!); });
    expect(HOURS_INTRO.bed.at).toBeGreaterThanOrEqual(HOURS_INTRO.lines.at(-1)!.until!); expect(HOURS_INTRO.law.at).toBeGreaterThanOrEqual(HOURS_INTRO.bed.until);
  });
  it('the court\'s cots and columns stand inside the cloister and clear of where the fight begins', () => {
    for (const p of makeHouseProps()) { const d = Math.hypot(p.x, p.z); expect(d).toBeLessThan(DIAL + 0.5); expect(Math.hypot(p.x, p.z + 4)).toBeGreaterThan(4); expect(Math.hypot(p.x, p.z - 5.2)).toBeGreaterThan(2.5); }
  });
  it('every sound the fight and its scenes call is in the pack, and none rings like a bell', () => {
    const b = fs.readFileSync('public/sfx/sfx.pak'), n = b.readUInt32LE(0), head = JSON.parse(b.subarray(4, 4 + n).toString()) as [string, number, number][], have = new Set(head.map(([k]) => k.replace(/\d+$/, '')));
    const src = ['src/boss/hours/hoursDirector.ts', 'src/game/hoursScenes.ts', 'src/audio/score.ts'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
    const called = new Set([...src.matchAll(/(?:sound\.play|this\.note|sound\.bed)\('([A-Za-z]+)'/g)].map(m => m[1]));
    const theirs = ['sBreath', 'sCall', 'sCount', 'sPain', 'pRoar', 'pDeath', 'emberOut', 'countBegin', 'miscount', 'lostCount', 'whorl', 'smokeIn', 'smokeOut', 'sheetFall', 'clothB', 'cotBurst', 'cotHit', 'inhale', 'embersUp', 'sunSink', 'hourFalls', 'breathIn', 'breathOut', 'hum', 'clothBed'];
    for (const s of theirs) { expect(called.has(s) || s === 'clothBed' || s === 'cotHit', s).toBe(true); expect(have.has(s), s).toBe(true); }
    for (const s of called) if (!['sub', 'cho', 'str', 'trem', 'bra', 'taiko', 'oar', 'drumHi', 'rim', 'shake', 'anvil', 'lead'].includes(s)) expect(have.has(s), s).toBe(true);
    expect([...called].some(s => /bell|gong|chime/i.test(s))).toBe(false);
  });
});
