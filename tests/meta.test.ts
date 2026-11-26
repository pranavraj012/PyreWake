// Module I: the meta screens' rules (buying, equipping, wearing, travelling). No DOM: the screens only draw these verdicts.
// Prices are module B's (priceOf), so these numbers follow B's RULES: weapon level 1 costs 20 kauri, the spear 150 kauri and 2 iron.
import { describe, expect, it } from 'vitest';
import { fresh, priceOf, RULES, type Progress } from '../src/game/progress.ts';
import { applyBuy, checkBuy, checkTravel, checkWear, equipSpell, giveBeads, takeOff, travel, wear } from '../src/ui/meta/rules.ts';

const rich = (over: Partial<Progress> = {}): Progress => ({ ...fresh(), kauri: 1000, iron: 5, ...over });

describe('buying (prices and effects from module B)', () => {
  it('buys when the purse covers the price, and takes the price', () => {
    const p = rich();
    expect(applyBuy(p, 'weapon-level')).toEqual({ ok: true });
    expect(p.kauri).toBe(1000 - RULES.feesPerLevel);
    expect(p.weapon.level).toBe(1);
  });

  it('refuses when short of kauri, and changes nothing', () => {
    const p = rich({ kauri: 19 });
    expect(checkBuy(p, 'weapon-level')).toEqual({ ok: false, why: 'kauri' });
    expect(applyBuy(p, 'weapon-level')).toEqual({ ok: false, why: 'kauri' });
    expect(p.kauri).toBe(19); expect(p.weapon.level).toBe(0);
  });

  it('refuses when short of pyre-iron, even with kauri to spare', () => {
    const p = rich({ iron: 1 });
    expect(applyBuy(p, 'weapon:spear')).toEqual({ ok: false, why: 'iron' });
    expect(p.weapons).toEqual(['khanda']); expect(p.kauri).toBe(1000);
  });

  it('a price of exactly what you carry is enough', () => {
    const { kauri: spearK, iron: spearI } = priceOf('weapon:spear', fresh())!;
    const p = rich({ kauri: spearK, iron: spearI });
    expect(applyBuy(p, 'weapon:spear')).toEqual({ ok: true });
    expect(p.kauri).toBe(0); expect(p.iron).toBe(0);
    expect(p.weapons).toEqual(['khanda', 'spear']); expect(p.weapon).toEqual({ kind: 'spear', level: 0 });
  });

  it('refuses what is not sold now: a weapon level at the cap, an unknown spell', () => {
    const p = rich({ weapon: { kind: 'khanda', level: RULES.maxWeaponLevel } });
    expect(checkBuy(p, 'weapon-level')).toEqual({ ok: false, why: 'unknown' });
    expect(checkBuy(rich(), 'spell:nope')).toEqual({ ok: false, why: 'unknown' });
    expect(checkBuy(rich(), 'charm:nope')).toEqual({ ok: false, why: 'unknown' });
  });

  it('will not sell a weapon, spell, charm or third cord twice', () => {
    const p = rich({ weapons: ['khanda', 'spear'], spells: ['rush', 'sunder', 'brand', 'ashstep'], charms: ['ember'], flags: { charmSlots: 3 } });
    expect(checkBuy(p, 'weapon:spear')).toEqual({ ok: false, why: 'owned' });
    expect(checkBuy(p, 'spell:ashstep')).toEqual({ ok: false, why: 'owned' });
    expect(checkBuy(p, 'charm:ember')).toEqual({ ok: false, why: 'owned' });
    expect(checkBuy(p, 'charm-slot')).toEqual({ ok: false, why: 'owned' });
  });

  it('flasks stack: a second flask is for sale', () => {
    const p = rich();
    applyBuy(p, 'flask'); applyBuy(p, 'flask');
    expect(p.flasks.count).toBe(5);
  });

  it('buying the third cord gives a third charm slot', () => {
    const p = rich();
    expect(checkBuy(p, 'charm-slot')).toEqual({ ok: true });
    applyBuy(p, 'charm-slot');
    expect(checkBuy(p, 'charm-slot')).toEqual({ ok: false, why: 'owned' });
    expect(p.flags.charmSlots).toBe(3);
  });

  it('buys a named charm, which then can be worn', () => {
    const p = rich();
    expect(applyBuy(p, 'charm:quick')).toEqual({ ok: true });
    expect(p.charms).toEqual(['quick']);
    expect(wear(p, 'quick')).toEqual({ ok: true });
  });

  it('three Name-beads give one life gift (module B turnInBeads); fewer are refused', () => {
    const p = rich({ beads: 2 });
    expect(giveBeads(p)).toEqual({ ok: false, why: 'beads' });
    expect(p.beads).toBe(2);
    p.beads = 7;
    expect(giveBeads(p)).toEqual({ ok: true });
    expect(p.beads).toBe(4); expect(p.flags.lifeTenths).toBe(1);
    expect(p.flags.lifeBeads).toBeUndefined();
    giveBeads(p);
    expect(p.flags.lifeTenths).toBe(2);
  });
});

describe('spells in the two slots', () => {
  const owned = (): Progress => rich({ spells: ['rush', 'sunder', 'brand'], equipped: ['rush', 'sunder'] });

  it('equips an owned spell into a slot', () => {
    const p = owned();
    expect(equipSpell(p, 1, 'brand')).toEqual({ ok: true });
    expect(p.equipped).toEqual(['rush', 'brand']);
  });

  it('a spell already in the other slot moves over (the two never hold the same art)', () => {
    const p = owned();
    equipSpell(p, 0, 'sunder');
    expect(p.equipped).toEqual(['sunder', 'rush']);
    expect(new Set(p.equipped).size).toBe(2);
  });

  it('refuses a spell that is not owned', () => {
    const p = owned();
    expect(equipSpell(p, 0, 'ashfall')).toEqual({ ok: false, why: 'notowned' });
    expect(p.equipped).toEqual(['rush', 'sunder']);
  });

  it('equipping a spell already in its slot changes nothing', () => {
    const p = owned();
    equipSpell(p, 0, 'rush');
    expect(p.equipped).toEqual(['rush', 'sunder']);
  });
});

describe('charms on the cords', () => {
  it('two cords at first: a third charm is refused until one is taken off', () => {
    const p = rich({ charms: ['ember', 'quick', 'perfect'], worn: ['ember', 'quick'] });
    expect(checkWear(p, 'perfect')).toEqual({ ok: false, why: 'slots' });
    expect(wear(p, 'perfect')).toEqual({ ok: false, why: 'slots' });
    expect(p.worn).toEqual(['ember', 'quick']);
    takeOff(p, 'quick');
    expect(wear(p, 'perfect')).toEqual({ ok: true });
    expect(p.worn).toEqual(['ember', 'perfect']);
  });

  it('the third cord gives a third charm', () => {
    const p = rich({ charms: ['ember', 'quick', 'perfect'], worn: ['ember', 'quick'], flags: { charmSlots: 3 } });
    expect(wear(p, 'perfect')).toEqual({ ok: true });
    expect(p.worn).toHaveLength(3);
  });

  it('only owned charms can be worn', () => {
    const p = rich({ charms: ['ember'] });
    expect(wear(p, 'quick')).toEqual({ ok: false, why: 'notowned' });
    expect(p.worn).toEqual([]);
  });

  it('wearing a charm already worn is not a second cord', () => {
    const p = rich({ charms: ['ember', 'quick'], worn: ['ember'] });
    expect(wear(p, 'ember')).toEqual({ ok: true });
    expect(p.worn).toEqual(['ember']);
  });

  it('the check itself does not change anything', () => {
    const p = rich({ charms: ['ember'] });
    checkWear(p, 'ember');
    expect(p.worn).toEqual([]);
  });
});

describe('travel between lit shrines', () => {
  it('travels to a lit shrine', () => {
    const p = rich({ shrines: ['a1', 'b2'], at: { region: 'ashfields', shrine: 'a1' } });
    expect(travel(p, 'b2', 'ghats')).toEqual({ ok: true });
    expect(p.at).toEqual({ region: 'ghats', shrine: 'b2' });
  });

  it('refuses a shrine that is not lit', () => {
    const p = rich({ shrines: ['a1'], at: { region: 'ashfields', shrine: 'a1' } });
    expect(checkTravel(p, 'c3', 'hill')).toEqual({ ok: false, why: 'nowhere' });
    expect(travel(p, 'c3', 'hill')).toEqual({ ok: false, why: 'nowhere' });
    expect(p.at.shrine).toBe('a1');
  });

  it('the shrine you are at is refused (nothing to do)', () => {
    const p = rich({ shrines: ['a1'], at: { region: 'ashfields', shrine: 'a1' } });
    expect(checkTravel(p, 'a1', 'ashfields')).toEqual({ ok: false, why: 'same' });
  });
});

describe('refusal reasons have words for the player', () => {
  it('every reason the rules give is in the text file', async () => {
    const { UI } = await import('../src/ui/meta/metaScript.ts');
    for (const why of ['unknown', 'kauri', 'iron', 'owned', 'notowned', 'slots', 'nowhere', 'same', 'beads'])
      expect(UI.refusal[why]).toBeTruthy();
  });
});
