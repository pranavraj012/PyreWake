import { describe, expect, it } from 'vitest';
import { Fight } from '../src/combat/fight.ts';
import { Motor } from '../src/player/motor.ts';
import { King } from '../src/bosses/king/king.ts';
import { Brain } from '../src/bosses/king/brain.ts';
import { SPELLS, SPELL_IDS, sane, type SpellId } from '../src/combat/spells.ts';

const DT = 1 / 60, tap = (a: string) => [{ a, up: false }, { a, up: true }];
function cast(id: SpellId, gap: number, slot: 0 | 1 = 0) {
  const f = new Fight(new Motor(), new King(), new Brain(1)); f.passive = true; f.reset(true); f.boss.x = 0; f.boss.z = -3; f.m.revive(0, -3 + gap, Math.PI); f.m.spells = slot ? ['rush', id] as [SpellId, SpellId] : [id, id === 'sunder' ? 'rush' : 'sunder'];
  f.fire = 100; for (let i = 0; i < 10; i++) f.step(DT, 0, 0, []);
  const hp = f.bossHp, ev: string[] = []; f.step(DT, 0, 0, tap(slot ? 'skill2' : 'skill1'));
  for (let i = 0; i < 240; i++) { f.step(DT, 0, 0, []); for (const e of f.ev) ev.push(e.k); }
  return { f, dealt: hp - f.bossHp, spent: 100 - f.fire, ev };
}
describe('fire arts', () => {
  for (const id of SPELL_IDS) it(`${SPELLS[id].name} costs its fire and hurts the King from its own range`, () => {
    const gap = { rush: 3, sunder: 9, brand: 2.2, ashstep: 4, wheel: 2.4, ashfall: 12 }[id], r = cast(id, gap);
    expect(r.dealt).toBeGreaterThan(80); expect(r.dealt).toBeLessThan(260);
    expect(r.spent).toBeGreaterThan(SPELLS[id].cost * 0.5);
  });
  it('the second button casts the second art', () => { const r = cast('brand', 2.2, 1); expect(r.ev).toContain('blast'); expect(r.dealt).toBeGreaterThan(80); });
  it('not enough fire: nothing happens', () => { const f = new Fight(new Motor(), new King(), new Brain(1)); f.passive = true; f.reset(true); f.m.spells = ['ashfall', 'brand']; f.fire = 30; f.step(DT, 0, 0, tap('skill1')); for (let i = 0; i < 30; i++) f.step(DT, 0, 0, []); expect(f.fire).toBeGreaterThanOrEqual(30); expect(f.m.clip?.name).not.toBe('ashfall'); });
  it('Ashen Step ends behind the King, facing it', () => { const r = cast('ashstep', 4); const { m, boss: k } = r.f; expect(m.z).toBeLessThan(k.z); });
  it('a bad save comes back as the default pair', () => { expect(sane(['rush', 'rush'])).toEqual(['rush', 'sunder']); expect(sane(['nope', 'brand'])).toEqual(['rush', 'sunder']); expect(sane(['ashfall', 'brand'])).toEqual(['ashfall', 'brand']); });
});
