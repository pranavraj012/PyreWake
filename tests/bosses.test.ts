// The boss registry: unique ids, the ?boss= numbers, the menu's fight list, the page hrefs, and no eager import of a boss module.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES, bossHref, fightList } from '../src/bosses/index.ts';

describe('the boss registry', () => {
  it('has unique ids and names, in fight order', () => {
    expect(new Set(BOSSES.map(b => b.id)).size).toBe(BOSSES.length);
    expect(new Set(BOSSES.map(b => b.name)).size).toBe(BOSSES.length);
    expect(BOSSES.map(b => b.id)).toEqual(['king', 'river', 'hours']);
    expect(BOSSES.map(b => b.name)).toEqual(['The Hanged King', 'The Ferryman', 'The Sister of Hours']);
  });

  it('numbers the bosses 1 to 3, one each', () => {
    expect(BOSSES.map(b => b.n).sort()).toEqual([1, 2, 3]);
  });

  it('gives every boss a loader: the King too, so main.ts boots every page the same way', () => {
    expect(BOSSES.every(b => typeof b.load === 'function')).toBe(true);
  });
});

describe('bossHref', () => {
  it('gives the strings the pages use today', () => {
    expect(bossHref(1)).toBe('');
    expect(bossHref(2)).toBe('?boss=2');
    expect(bossHref(3)).toBe('?boss=3');
  });
});

describe('fightList', () => {
  it('marks the current boss null and gives the others a callback', () => {
    const saved = (globalThis as { location?: unknown }).location;
    const loc = { search: 'unset' };
    (globalThis as { location?: unknown }).location = loc;
    try {
      for (const b of BOSSES) {
        const list = fightList(b.id);
        expect(list.map(([name]) => name)).toEqual(BOSSES.map(x => x.name));
        list.forEach(([, go], i) => {
          if (BOSSES[i].id === b.id) { expect(go).toBeNull(); return; }
          expect(typeof go).toBe('function');
          go!();
          expect(loc.search).toBe(bossHref(BOSSES[i].n));
        });
      }
    } finally {
      (globalThis as { location?: unknown }).location = saved;
    }
  });
});

describe('the registry module', () => {
  it('imports no boss module statically (only through each load())', () => {
    const src = readFileSync(new URL('../src/bosses/index.ts', import.meta.url), 'utf8');
    const statics = src.split('\n').filter(l => /^\s*(import|export)\b.*\bfrom\s+['"]/.test(l));
    const bossImports = statics.filter(l => /from\s+['"]\.\/(king|river|hours)/.test(l));
    expect(bossImports).toEqual([]);
  });
});
