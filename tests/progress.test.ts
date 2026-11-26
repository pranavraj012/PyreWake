import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fresh, progress, replaceProgress, priceOf, stats, buy, die, recoverKauri, rest, turnInBeads,
  equipWeapon, charmSlots, purchase, RULES, lifeTenths, type Progress,
} from '../src/game/progress';
import { attachSaves, readFile, SAVE_KEY, SLOT_COUNT, type Saves, type SaveStore, encodeFile, checkProgress } from '../src/game/save';

/** An in-memory stand-in for localStorage. */
function memStore(init: Record<string, string> = {}): SaveStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: k => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => { data.set(k, v); },
    removeItem: k => { data.delete(k); },
  };
}

let open: Saves[] = [];
const track = (s: Saves): Saves => { open.push(s); return s; };

beforeEach(() => { replaceProgress(fresh()); open = []; });
afterEach(() => { for (const s of open) s.close(); replaceProgress(fresh()); });

const rich = (over: Partial<Progress> = {}): Progress => ({ ...fresh(), kauri: 1000, iron: 10, ...over });

describe('stats', () => {
  it('is neutral for fresh progress, so a fight given no progress behaves as today', () => {
    expect(stats(fresh())).toEqual({ life: 1, damage: 1, flaskHeal: 1 });
  });

  it('rises with weapon levels, Name-bead life and flask strength', () => {
    const p = rich({ weapon: { kind: 'khanda', level: 4 }, flasks: { count: 3, strength: 2 } });
    p.beads = 6;
    expect(turnInBeads(p)).toBe(true);
    expect(turnInBeads(p)).toBe(true);
    const s = stats(p);
    expect(s.damage).toBeCloseTo(1 + RULES.damagePerLevel * 4);
    expect(s.life).toBeCloseTo(1.2);
    expect(s.flaskHeal).toBeCloseTo(1.5);
  });
});

describe('prices and buying', () => {
  it('prices the next weapon level in kauri, with pyre-iron at levels 4, 7 and 10', () => {
    expect(priceOf('weapon-level', fresh())).toEqual({ kauri: RULES.feesPerLevel, iron: 0 });
    const at3 = rich({ weapon: { kind: 'khanda', level: 3 } });
    expect(priceOf('weapon-level', at3)).toEqual({ kauri: 4 * RULES.feesPerLevel, iron: RULES.ironAtLevel[4] });
    const at9 = rich({ weapon: { kind: 'khanda', level: 9 } });
    expect(priceOf('weapon-level', at9)?.iron).toBe(RULES.ironAtLevel[10]);
  });

  it('returns null for weapon levels at the cap', () => {
    expect(priceOf('weapon-level', rich({ weapon: { kind: 'khanda', level: RULES.maxWeaponLevel } }))).toBeNull();
  });

  it('buys a weapon level, taking the price', () => {
    const p = rich();
    const r = buy(p, 'weapon-level');
    expect(r.ok).toBe(true);
    expect(p.weapon.level).toBe(1);
    expect(p.kauri).toBe(1000 - RULES.feesPerLevel);
  });

  it('refuses when short of kauri, changing nothing', () => {
    const p = rich({ kauri: 5 });
    expect(buy(p, 'weapon-level')).toEqual({ ok: false, reason: 'poor' });
    expect(p.kauri).toBe(5);
    expect(p.weapon.level).toBe(0);
  });

  it('refuses when short of pyre-iron, changing nothing', () => {
    const p = rich({ iron: 0, weapon: { kind: 'khanda', level: 3 } });
    expect(buy(p, 'weapon-level')).toEqual({ ok: false, reason: 'poor' });
    expect(p.kauri).toBe(1000);
    expect(p.weapon.level).toBe(3);
  });

  it('refuses unknown and owned upgrades', () => {
    expect(buy(rich(), 'nonsense')).toEqual({ ok: false, reason: 'unavailable' });
    expect(buy(rich(), 'weapon:khanda')).toEqual({ ok: false, reason: 'unavailable' });
    const p = rich({ spells: ['ember'] });
    expect(buy(p, 'spell:ember')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('buys a new weapon and keeps the level of the old one for switching back', () => {
    const p = rich({ weapon: { kind: 'khanda', level: 5 } });
    expect(buy(p, 'weapon:spear').ok).toBe(true);
    expect(p.weapon).toEqual({ kind: 'spear', level: 0 });
    expect(p.weapons).toContain('spear');
    expect(equipWeapon(p, 'khanda')).toBe(true);
    expect(p.weapon).toEqual({ kind: 'khanda', level: 5 });
    expect(equipWeapon(p, 'whip')).toBe(false);
  });

  it('caps flasks and charm slots', () => {
    const p = rich({ flasks: { count: RULES.maxFlasks, strength: 0 } });
    expect(priceOf('flask', p)).toBeNull();
    expect(charmSlots(fresh())).toBe(RULES.charmSlotsStart);
    const q = rich();
    expect(buy(q, 'charm-slot').ok).toBe(true);
    expect(charmSlots(q)).toBe(RULES.charmSlotsStart + 1);
  });

  it('purchase() buys on the live progress and reports the result', () => {
    replaceProgress(rich());
    expect(purchase('flask')).toEqual({ ok: true, kauri: RULES.flaskPrice, iron: 0 });
    expect(progress.get().flasks.count).toBe(4);
    replaceProgress(fresh());
    expect(purchase('flask')).toEqual({ ok: false, reason: 'poor' });
  });
});

describe('dying and recovering kauri', () => {
  it('drops the kauri where you fell, and you carry none', () => {
    const p = rich({ kauri: 300 });
    die(p, 'ashfields', 10, -4);
    expect(p.kauri).toBe(0);
    expect(p.dropped).toEqual({ region: 'ashfields', x: 10, z: -4, kauri: 300 });
  });

  it('recovers the dropped kauri once, near the spot, in the same region', () => {
    const p = rich({ kauri: 300 });
    die(p, 'ashfields', 10, -4);
    expect(recoverKauri(p, 'ashfields', 10.5, -4, 1)).toBe(300);
    expect(p.kauri).toBe(300);
    expect(p.dropped).toBeNull();
    expect(recoverKauri(p, 'ashfields', 10, -4)).toBe(0);
    expect(p.kauri).toBe(300);
  });

  it('does not recover from another region or from too far away', () => {
    const p = rich({ kauri: 300 });
    die(p, 'ashfields', 10, -4);
    expect(recoverKauri(p, 'ghats', 10, -4)).toBe(0);
    expect(recoverKauri(p, 'ashfields', 30, -4)).toBe(0);
    expect(p.dropped).not.toBeNull();
  });

  it('loses the first pile on a second death before recovery', () => {
    const p = rich({ kauri: 300 });
    die(p, 'ashfields', 10, -4);
    p.kauri = 80;
    die(p, 'ashfields', 50, 50);
    expect(p.dropped).toEqual({ region: 'ashfields', x: 50, z: 50, kauri: 80 });
    expect(recoverKauri(p, 'ashfields', 50, 50)).toBe(80);
    expect(p.kauri).toBe(80);
  });

  it('drops nothing when no kauri are carried', () => {
    const p = rich({ kauri: 0 });
    die(p, 'ashfields', 1, 1);
    expect(p.dropped).toBeNull();
  });

  it('rest() sets the place you wake at and remembers the shrine', () => {
    const p = fresh();
    rest(p, 'ashfields', 'banyan');
    rest(p, 'ashfields', 'banyan');
    expect(p.at).toEqual({ region: 'ashfields', shrine: 'banyan' });
    expect(p.shrines).toEqual(['banyan']);
  });
});

describe('save file', () => {
  it('starts empty from nothing stored (version 0) with no message', () => {
    const store = memStore();
    const s = track(attachSaves(store));
    expect(s.notice).toEqual({ kind: 'empty' });
    expect(s.message).toBeNull();
    expect(progress.get()).toEqual(fresh());
    expect(JSON.parse(store.data.get(SAVE_KEY)!).version).toBe(2);
  });

  it('migrates a version 0 record with a progress field into slot 0', () => {
    const { kauri: _k, ...rest } = fresh();
    const v0 = JSON.stringify({ progress: { ...rest, fares: 42 } });
    const r = readFile(v0);
    expect(r.notice).toEqual({ kind: 'loaded', from: 0 });
    expect(r.file.slots[0]?.kauri).toBe(42);
    expect(r.file.slots.slice(1)).toEqual([null, null]);
  });

  it('renames the old currency field fares to kauri in a version 1 save, slots and dropped piles', () => {
    const { kauri: _k, ...rest } = fresh();
    const old = { ...rest, fares: 42, dropped: { region: 'ashfields', x: 1, z: 2, fares: 17 } };
    const r = readFile(JSON.stringify({ version: 1, active: 1, slots: [null, old, null] }));
    expect(r.notice).toEqual({ kind: 'loaded', from: 1 });
    expect(r.file.version).toBe(2);
    expect(r.file.slots[1]?.kauri).toBe(42);
    expect(r.file.slots[1]?.dropped).toEqual({ region: 'ashfields', x: 1, z: 2, kauri: 17 });
    expect(JSON.stringify(r.file)).not.toContain('fares');
  });

  it('reads an empty v0 object as an empty file', () => {
    const r = readFile('{}');
    expect(r.notice).toEqual({ kind: 'loaded', from: 0 });
    expect(r.file.slots).toEqual([null, null, null]);
  });

  it('round-trips progress through the store and autosaves every change', () => {
    const store = memStore();
    const s = track(attachSaves(store));
    progress.change(p => { p.kauri = 77; p.burned.push('king'); });
    const again = track(attachSaves(store));
    expect(progress.get().kauri).toBe(77);
    expect(progress.get().burned).toEqual(['king']);
    expect(again.summary(0)).toEqual({ kauri: 77, burned: 1, at: 'ashfields' });
    s.close();
  });

  it('keeps three slots: select, start and clear', () => {
    const store = memStore();
    const s = track(attachSaves(store));
    progress.change(p => { p.kauri = 5; });
    s.start(1);
    expect(s.active).toBe(1);
    expect(progress.get().kauri).toBe(0);
    progress.change(p => { p.kauri = 9; });
    s.select(0);
    expect(progress.get().kauri).toBe(5);
    expect(s.summary(1)?.kauri).toBe(9);
    expect(s.summary(2)).toBeNull();
    s.clear(1);
    expect(s.summary(1)).toBeNull();
    s.select(SLOT_COUNT - 1);
    expect(s.active).toBe(SLOT_COUNT - 1);
  });

  it('keeps a corrupt save aside, starts fresh and says so', () => {
    const bad = '{"version":1,"active":0,"slots":[{"kauri":"lots"';
    const store = memStore({ [SAVE_KEY]: bad });
    const s = track(attachSaves(store));
    expect(s.notice.kind).toBe('corrupt');
    const copyKey = (s.notice as { copyKey: string | null }).copyKey;
    expect(copyKey).not.toBeNull();
    expect(store.data.get(copyKey!)).toBe(bad);
    expect(progress.get()).toEqual(fresh());
    expect(s.message).toContain(copyKey!);
  });

  it('treats a save with a wrong field as corrupt rather than loading it', () => {
    const p = { ...fresh(), kauri: -3 };
    const text = encodeFile({ version: 1, active: 0, slots: [p as Progress, null, null] });
    const r = readFile(text, () => 'copy');
    expect(r.notice).toEqual({ kind: 'corrupt', reason: 'the save fields are not all readable', copyKey: 'copy' });
    expect(checkProgress({ ...fresh(), weapon: { kind: 'axe', level: 0 } })).toBeNull();
  });

  it('refuses a save from a newer build and keeps a copy of it', () => {
    const text = JSON.stringify({ version: 7, slots: [] });
    const r = readFile(text, () => 'copy-key');
    expect(r.notice).toEqual({ kind: 'newer', version: 7, copyKey: 'copy-key' });
    expect(r.file.slots.every(x => x === null)).toBe(true);
  });

  it('plays in memory, with a message, when no storage can be reached', () => {
    const s = track(attachSaves(null));
    expect(s.notice).toEqual({ kind: 'unavailable' });
    expect(s.message).toMatch(/not available/);
    progress.change(p => { p.kauri = 3; });
    expect(progress.get().kauri).toBe(3);
    expect(s.write()).toBeNull();
  });

  it('reports a refused write instead of throwing', () => {
    const store = memStore();
    const s = track(attachSaves(store));
    store.setItem = () => { throw new Error('quota'); };
    progress.change(p => { p.kauri = 1; });
    expect(s.write()).toBe('quota');
  });

  it('turns a store that throws on read into a message, not a crash', () => {
    const store = memStore();
    store.getItem = () => { throw new Error('blocked'); };
    const s = track(attachSaves(store));
    expect(s.notice.kind).toBe('unavailable');
  });
});

describe('charms, spells by name, and the starting kit (module I buys through these)', () => {
  it('starts with three fire arts, two of them equipped', () => {
    const p = fresh();
    expect(p.spells).toEqual(['rush', 'sunder', 'brand']);
    expect(p.equipped).toEqual(['rush', 'sunder']);
    expect(p.equipped.every(s => p.spells.includes(s))).toBe(true);
  });

  it('buys a named charm for its placeholder price, and not twice', () => {
    const p = rich();
    expect(priceOf('charm:ember', p)).toEqual(RULES.charmPrice.ember);
    expect(buy(p, 'charm:ember')).toEqual({ ok: true, kauri: RULES.charmPrice.ember.kauri, iron: 0 });
    expect(p.charms).toEqual(['ember']);
    expect(priceOf('charm:ember', p)).toBeNull();
  });

  it('refuses a charm with no price and a spell name that is not one of the six', () => {
    expect(priceOf('charm:nothing', fresh())).toBeNull();
    expect(priceOf('spell:nope', fresh())).toBeNull();
    expect(buy(rich(), 'spell:nope')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('buys a spell by name, and not one already carried', () => {
    const p = rich();
    expect(priceOf('spell:rush', p)).toBeNull();
    expect(buy(p, 'spell:ashfall')).toEqual({ ok: true, kauri: RULES.spellPrice, iron: 0 });
    expect(p.spells).toContain('ashfall');
  });

  it('turns in three beads for a tenth more life, and refuses with fewer', () => {
    const p = rich({ beads: 2 });
    expect(turnInBeads(p)).toBe(false);
    p.beads = 3;
    expect(turnInBeads(p)).toBe(true);
    expect(p.beads).toBe(0);
    expect(lifeTenths(p)).toBe(1);
  });
});
