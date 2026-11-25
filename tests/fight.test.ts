import { describe, expect, it } from 'vitest';
import { Fight, type FightEvent } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { King, isAttack } from '../src/boss/king.ts';
import { Brain } from '../src/boss/brain.ts';
import { ATTACKS, LEAPS } from '../src/boss/moves2.ts';
import { KING_CLIPS } from '../src/boss/clips.ts';
import { Motor, type Press } from '../src/player/motor.ts';
import { BODY_CLIPS } from '../src/player/clips.ts';
import { KHANDA } from '../src/weapons/khanda.ts';
import { Prompts } from '../src/ui/prompts.ts';

const DT = 1 / 60, tap = (a: string): Press[] => [{ a, up: false }, { a, up: true }], down = (a: string): Press[] => [{ a, up: false }], up = (a: string): Press[] => [{ a, up: true }];
/** Player 2 m in front of the King, both facing each other. */
const mk = (gap = 2, passive = true) => { const f = new Fight(new Motor()); f.passive = passive; f.m.x = 0; f.m.z = -4 + gap; f.m.yaw = Math.PI; return f; };
const run = (f: Fight, secs: number, press: (i: number) => Press[] = () => []) => { const ev: FightEvent[] = []; for (let i = 0; i < secs * 60; i++) { f.step(DT, 0, 0, press(i)); ev.push(...f.ev); } return ev; };
const n = (ev: FightEvent[], k: string) => ev.filter(e => e.k === k).length;
/** Step until the King's clip reaches time t. */
const until = (f: Fight, t: number) => { for (let i = 0; i < 900 && f.king.mt < t; i++) f.step(DT, 0, 0, []); };

describe('player attacks', () => {
  it('each swing lands exactly once', () => { const f = mk(); const ev = run(f, 1, i => i === 0 ? tap('attack') : []); expect(n(ev, 'hit')).toBe(1); expect(f.bossHp).toBe(D.boss.hp1 - KHANDA.damage); });
  it('a mashed chain lands all five', () => { const f = mk(); let light5 = false; const ev: FightEvent[] = []; for (let i = 0; i < 360 && !light5; i++) { f.step(DT, 0, 0, i % 8 === 0 ? tap('attack') : []); ev.push(...f.ev); if (f.m.clip?.name === 'light5' && f.m.t > 0.7) light5 = true; } expect(light5).toBe(true); expect(n(ev, 'hit')).toBe(5); });
  it('small gaps are closed; far swings miss', () => { const near = mk(4.6); expect(n(run(near, 1, i => i === 0 ? tap('attack') : []), 'hit')).toBe(1); const far = mk(8); expect(n(run(far, 1, i => i === 0 ? tap('attack') : []), 'hit')).toBe(0); });
  it('holding after hit N gives finisher N, and it hits', () => {
    KHANDA.finishers.forEach((fin, idx) => {
      const f = mk(); const seen: string[] = []; let hits = 0, held = false, power = 0;
      for (let i = 0; i < 420; i++) {
        let p: Press[] = []; const c = f.m.clip?.name;
        if (c === KHANDA.combo[idx] && !held && f.m.t > 0.05) { held = true; p = down('attack'); } else if (!held && i % 8 === 0) p = tap('attack');
        f.step(DT, 0, 0, p); for (const e of f.m.events) if (e.startsWith('clip:')) seen.push(e.slice(5)); if (f.m.clip?.name === fin) for (const e of f.ev) if (e.k === 'hit') { hits++; power = Math.max(power, e.power); } if (seen.includes(fin) && f.m.state === 'free') break;
      }
      expect(seen, fin).toContain(fin); expect(seen.slice(0, idx + 1)).toEqual(KHANDA.combo.slice(0, idx + 1)); expect(hits, fin).toBe(KHANDA.clips[fin].hits?.length ?? 1); expect(power).toBeGreaterThan(1.3);
    });
  });
  it('a tap is never mistaken for a hold', () => { for (const hold of [1, 3, 5, 7]) { const f = mk(); const seen: string[] = []; for (let i = 0; i < 260; i++) { const ph = i % 20; f.step(DT, 0, 0, ph === 0 ? down('attack') : ph === hold ? up('attack') : []); for (const e of f.m.events) if (e.startsWith('clip:')) seen.push(e.slice(5)); } expect(seen.every(s => KHANDA.combo.includes(s)), seen.join()).toBe(true); } });
  it('charging longer hits harder', () => { const go = (s: number) => { const f = mk(2.2); run(f, s, i => i === 0 ? down('attack') : []); run(f, 1, i => i === 0 ? up('attack') : []); return D.boss.hp1 - f.bossHp; }; expect(go(1.5)).toBeGreaterThan(go(0.4)); expect(go(0.4)).toBeGreaterThan(KHANDA.damage * 1.5); });
});

describe('defence', () => {
  const slam = (gap = 2.4) => { const f = mk(gap); f.brain.seen.add('slam').add('sweep').add('grab'); f.king.set('slam'); return f; };
  it('an undefended blow hurts, once', () => { const f = slam(); const ev = run(f, 3); expect(n(ev, 'hurt')).toBe(1); expect(f.hp).toBe(D.hp - ATTACKS.slam[0].dmg); });
  it('guard stops white with a sliver of chip', () => { const f = slam(); const ev = run(f, 3, i => i === 0 ? down('guard') : []); expect(n(ev, 'block')).toBe(1); expect(n(ev, 'hurt')).toBe(0); expect(f.hp).toBeGreaterThan(D.hp - 2); });
  it('chip can never kill', () => { const f = slam(); f.hp = 1; run(f, 3, i => i === 0 ? down('guard') : []); expect(f.hp).toBe(1); });
  it('a well-timed guard parries, drops the King to a knee and pays fire', () => { const f = slam(); until(f, 1.3); const ev = run(f, 1, i => i === 0 ? down('guard') : []); expect(n(ev, 'parry')).toBe(1); expect(f.king.mode).toBe('kneel'); expect(f.fire).toBe(D.gain.parry); expect(f.hp).toBe(D.hp); });
  it('mashing guard does not parry', () => { const f = slam(); const ev = run(f, 1.8, i => i % 8 === 0 ? down('guard') : i % 8 === 4 ? up('guard') : []); expect(n(ev, 'parry')).toBe(0); });
  it('red goes through guard', () => { const f = mk(2.4); f.brain.seen.add('grab'); f.king.set('grab'); const ev = run(f, 2.5, i => i === 0 ? down('guard') : []); expect(n(ev, 'hurt')).toBe(1); expect(n(ev, 'block')).toBe(0); });
  it('dodging through any attack avoids it', () => { for (const a of Object.keys(ATTACKS).filter(a => !/^hang|rain/.test(a)) as (keyof typeof ATTACKS)[]) { const f = mk(2.4); f.brain.seen.add(a as never); f.king.set(a as never); const s = ATTACKS[a][0]; until(f, s.t[0] - 0.12); const ev = run(f, 0.4, i => i === 0 ? tap('dodge') : []); expect(n(ev, 'hurt'), a).toBe(0); } });
  it('a last-instant dodge slows time and pays fire', () => { const f = slam(); until(f, 1.32); const ev = run(f, 0.5, i => i === 0 ? tap('dodge') : []); expect(ev.some(e => e.k === 'evade' && e.perfect)).toBe(true); expect(f.fire).toBe(D.gain.perfect); });
  it('stepping aside works without any dodge at all', () => { const f = slam(); until(f, 1.2); f.m.x += 1.6; const ev = run(f, 1.5); expect(n(ev, 'hurt')).toBe(0); });
});

describe('fire, healing, death', () => {
  it('Cinder Rush costs fire, passes through, and detonates on the King', () => { const f = mk(2.4); f.fire = 50; const z0 = f.m.z; const ev = run(f, 2, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'rush')).toBe(1); expect(f.fire).toBe(50 - D.rush.cost); expect(f.m.z).toBeLessThan(f.king.z); expect(z0).toBeGreaterThan(f.king.z); expect(ev.some(e => e.k === 'detonate' && e.hit)).toBe(true); expect(f.bossHp).toBe(D.boss.hp1 - D.rush.dmg); expect(f.king.mode).toBe('reel'); });
  it('no fire, no Rush', () => { const f = mk(); f.fire = D.rush.cost - 1; const ev = run(f, 1, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'rush')).toBe(0); expect(n(ev, 'deny')).toBe(1); });
  it('Rush dodges whatever is landing', () => { const f = mk(2.4); f.fire = 50; f.brain.seen.add('grab'); f.king.set('grab'); until(f, 1.3); const ev = run(f, 1, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'hurt')).toBe(0); });
  it('a Rush ends with the hero standing in the arena, outside the King', () => { for (const a of [0, 1, 2, 3, 4, 5]) { const f = mk(); f.king.x = Math.cos(a) * 17; f.king.z = Math.sin(a) * 17; f.m.x = Math.cos(a) * 14.5; f.m.z = Math.sin(a) * 14.5; f.fire = 60; run(f, 2, i => i === 0 ? tap('skill1') : []); expect(Math.hypot(f.m.x, f.m.z)).toBeLessThan(21.5); expect(f.m.targetDist).toBeGreaterThan(1.05); } });
  it('four heals, never past full, never wasted at full', () => { const f = mk(6); run(f, 1.2, i => i === 0 ? tap('heal') : []); expect(f.heals).toBe(4); for (let k = 0; k < 6; k++) { f.hp = 20; run(f, 1.2, i => i === 0 ? tap('heal') : []); } expect(f.heals).toBe(0); expect(f.hp).toBe(20); });
  it('nothing kills from full, and it takes several blows', () => { for (const s of Object.values(ATTACKS).flat()) { expect(s.dmg).toBeLessThan(D.hp / 5); } });
  it('the first showing of an attack does 40%', () => { const f = mk(2.4); f.king.set('slam', D.teach.rate); run(f, 5); expect(f.hp).toBeCloseTo(D.hp - ATTACKS.slam[0].dmg * D.teach.dmg, 5); });
  it('the Second Flame relights you once, then death restarts the fight', () => { const f = mk(2.4); f.hp = 2; f.brain.seen.add('slam'); f.king.set('slam'); const ev = run(f, 3); expect(n(ev, 'flame')).toBe(1); expect(f.hp).toBe(D.flame); f.hp = 2; f.invuln = 0; f.king.set('slam'); f.king.x = f.m.x; f.king.z = f.m.z - 2.2; f.king.yaw = 0; const e2 = run(f, 6); expect(n(e2, 'dead')).toBe(1); expect(n(e2, 'reset')).toBe(1); expect(f.hp).toBe(D.hp); expect(f.flame).toBe(true); });
  it('half health starts the scene exactly once, and round 2 is a whole, checkpointed fight', () => { const f = mk(); f.bossHp = 5; f.hp = 30; f.heals = 0; const ev = run(f, 4, i => i === 0 ? tap('attack') : []); expect(n(ev, 'half')).toBe(1); expect(f.phase).toBe('scene'); f.beginRound2(); expect(f.hp).toBe(D.hp); expect(f.heals).toBe(D.heals); expect(f.bar).toBeCloseTo(0.5, 5); f.flame = false; f.hp = 1; f.brain.seen.add('skewer'); f.m.x = f.king.x; f.m.z = f.king.z + 2; f.invuln = 0; f.king.yaw = 0; f.king.set('skewer'); run(f, 6); expect(f.round).toBe(2); expect(f.hp).toBe(D.hp); });
  it('a burst across the line cannot skip the scene', () => { const f = mk(); f.bossHp = 50; f.wake = 100; run(f, 4, i => i === 0 ? tap('ultimate') : []); expect(f.phase).toBe('scene'); });
  it('the last blow of round 2 waits for you, then ends it', () => { const f = mk(); f.beginRound2(); f.bossHp = 5; const ev = run(f, 3, i => i === 30 ? tap('attack') : []); expect(n(ev, 'finish')).toBe(1); f.m.x = f.king.x; f.m.z = f.king.z + 2; const e2 = run(f, 4, i => i === 30 ? tap('attack') : []); expect(n(e2, 'won')).toBe(1); expect(f.king.mode).toBe('die2'); });
  it('hit-stop freezes the fight but keeps your input', () => { const f = mk(); f.stop = 0.1; expect(f.step(DT, 0, 0, tap('dodge'))).toBe(0); run(f, 0.2); expect(f.m.clip?.name).toMatch(/^dodge/); });
});

describe('fairness', () => {
  it('every blow is cued long enough ahead, more so the first time', () => { for (const [name, list] of Object.entries(ATTACKS)) list.forEach((s, i) => { expect(s.t[0] - s.cue, name).toBeGreaterThanOrEqual(D.cue - 1e-6); if (i === 0) expect((s.t[0] - s.cue) / D.teach.rate, name).toBeGreaterThanOrEqual(D.cueFirst - 0.02); }); });
  it('every attack leaves at least 1.5 s of opening', () => { for (const [name, list] of Object.entries(ATTACKS)) if (name !== 'rain') /* stands still throughout */ expect(KING_CLIPS[name].dur - list[list.length - 1].t[1] + D.boss.rest[0], name).toBeGreaterThan(1.5); });
  it('cues in play never overlap a previous blow, in either round', () => { for (const round of [1, 2]) { const f = mk(2.4, false); if (round === 2) f.beginRound2(); f.hits = 9; let last = -9, count = 0; for (let i = 0; i < 60 * 90; i++) { f.step(DT, 0, 0, []); f.hp = 100; f.flame = true; f.m.x = f.king.hx + Math.sin(f.king.yaw) * 2.4; f.m.z = f.king.hz + Math.cos(f.king.yaw) * 2.4; for (const e of f.ev) if (e.k === 'cue' && e.strike.kind !== 'ground') { expect(f.time - last, f.king.mode).toBeGreaterThan(0.25); last = f.time; count++; } } expect(count).toBeGreaterThan(20); } });
  it('the King waits for your first hits', () => { const f = mk(2.2, false); for (let i = 0; i < 60 * 6; i++) { f.step(DT, 0, 0, []); expect(isAttack(f.king.mode)).toBe(false); } });
  it('leaps land where they were marked, and the mark warns in time', () => { for (const a of ['leap', 'pounce', 'wheel'] as const) { const f = mk(6); f.brain.seen.add(a); f.king.form = a === 'wheel' ? 2 : 1; f.king.set(a); let h = null as null | { x: number; z: number; delay: number }; for (let i = 0; i < 100 && f.king.mode === a && f.king.mt < LEAPS[a].t1; i++) { f.step(DT, 1, 0, []); for (const e of f.ev) if (e.k === 'zone' && !h) h = { x: e.z.x, z: e.z.z, delay: e.z.delay }; } expect(h, a).not.toBeNull(); expect(Math.hypot(f.king.x - h!.x, f.king.z - h!.z), a).toBeLessThan(0.3); expect(h!.delay, a).toBeGreaterThan(0.6); expect(f.hp, a + ': running off the mark is enough').toBe(D.hp); } });
  it('the hanging head is always in reach and takes extra', () => { const f = mk(2); f.king.set('hang'); run(f, 2); f.m.x = f.king.hx; f.m.z = f.king.hz + 1.5; const b = f.bossHp; run(f, 0.6, i => i === 0 ? tap('attack') : []); expect(b - f.bossHp).toBeCloseTo(KHANDA.damage * D.boss.headMul, 3); });
  it('enough head hits bring it down; so does time', () => { const f = mk(2, false); f.hits = 9; f.bossHp = f.maxHp * 0.28; let snap = 0, crash = false; for (let i = 0; i < 60 * 40 && !crash; i++) { f.hp = 100; f.flame = true; f.m.x = f.king.hx + 0.6; f.m.z = f.king.hz + 1.4; f.step(DT, 0, 0, i % 9 === 0 ? tap('attack') : []); snap += f.ev.filter(e => e.k === 'snap').length; if (f.king.mode === 'crash') crash = true; } expect(crash).toBe(true); expect(snap).toBe(1); const g = mk(2, false); g.hits = 9; g.bossHp = g.maxHp * 0.28; for (let i = 0; i < 60 * 40 && (g.king.mode as string) !== 'crash'; i++) { g.hp = 100; g.flame = true; g.m.x = 15; g.m.z = 10; g.step(DT, 0, 0, []); } expect(g.king.mode).toBe('crash'); });
  it('it never swings at something behind it', () => { const k = new King(), b = new Brain(); for (let i = 0; i < 4000; i++) { const a = k.yaw + Math.PI, was = k.serial; b.step(DT, k, k.x + Math.sin(a) * 2.5, k.z + Math.cos(a) * 2.5, 99, 1); if (was !== k.serial && isAttack(k.mode)) throw new Error('swung backwards'); k.step(DT, k.x + Math.sin(a) * 2.5, k.z + Math.cos(a) * 2.5); } });
});

describe('attack variety', () => {
  const go = (pre: (f: Fight) => void, secs = 1) => { const f = mk(2.2); pre(f); const seen: string[] = []; for (let i = 0; i < secs * 60; i++) { f.step(DT, 0, 0, i === 0 ? tap('attack') : []); for (const e of f.m.events) if (e.startsWith('clip:')) seen.push(e.slice(5)); } return { seen, f }; };
  it('a pause after the second hit switches to the second chain', () => { const f = mk(); const seen: string[] = []; let t = 0; for (let i = 0; i < 330; i++) { let p: Press[] = []; const c = f.m.clip?.name; if (i === 0 || (c === 'light1' && f.m.t > 0.2 && f.m.t < 0.22)) p = tap('attack'); else if (c === 'light2' && f.m.t > 0.52 && t === 0) { t = i; p = tap('attack'); } else if (t && i % 8 === 0 && seen.length < 5) p = tap('attack'); f.step(DT, 0, 0, p); for (const e of f.m.events) if (e.startsWith('clip:')) seen.push(e.slice(5)); } expect(seen.slice(0, 5)).toEqual(['light1', 'light2', 'alt3', 'alt4', 'alt5']); });
  it('out of a dodge, guard, parry and against a helpless boss', () => {
    for (const [d, want] of [['dodgeF', 'lowTurn'], ['dodgeB', 'flare'], ['dodgeL', 'passR'], ['dodgeR', 'passL']]) expect(go(f => { f.m.begin(d); f.m.t = 0.28; }).seen, d).toContain(want);
    const g = mk(2.2); run(g, 0.5, i => i === 0 ? down('guard') : []); g.step(DT, 0, 0, tap('attack')); for (let i = 0; i < 12; i++) g.step(DT, 0, 0, []); expect(g.m.clip?.name).toBe('palm');
    expect(go(f => { f.m.reckoning = 1; }).seen[0]).toBe('reckon'); expect(go(f => { f.king.set('kneel'); run(f, 0.6); }).seen).toContain('execute');
  });
  it('sprinting into an attack flies', () => { const f = mk(14); f.m.sprintT = 9; f.m.speed = 6.9; f.m.x = 0; for (let i = 0; i < 12; i++) f.step(DT, 0, -1, []); f.step(DT, 0, -1, tap('attack')); for (let i = 0; i < 4; i++) f.step(DT, 0, -1, []); expect(f.m.clip?.name).toBe('comet'); });
  it('Sunder Arc and flare hit from afar; Sunder cuts the roots', () => { const f = mk(9); f.fire = 100; const ev = run(f, 2, i => i === 0 ? tap('skill2') : []); expect(n(ev, 'shotHit')).toBe(1); const h = mk(8); h.fire = 100; h.king.set('hang'); run(h, 1.5); const e2 = run(h, 2, i => i === 0 ? tap('skill2') : []); expect(n(e2, 'snap')).toBe(1); });
  it('Last Rites needs a full wake, freezes the boss, and lands', () => { const f = mk(5); run(f, 0.3, i => i === 0 ? tap('ultimate') : []); expect(f.m.clip).toBeNull(); f.wake = 100; f.king.set('slam'); const t0 = f.king.mt; run(f, 1.5, i => i === 0 ? tap('ultimate') : []); expect(f.king.mt).toBeLessThan(t0 + 0.1); const ev = run(f, 1.5); expect(n(ev, 'rites')).toBe(1); expect(f.bossHp).toBe(f.maxHp - D.rites.dmg); });
  it('aura climbs with unhurt hits and breaks when you are struck', () => { const f = mk(); for (let i = 0; i < D.aura[1]; i++) { f.king.x = 0; f.king.z = -4; (f as never as { damage(a: number, b: number, c: boolean, d: number): void }).damage(1, 1, false, 0); } expect(f.aura).toBe(2); f.king.x = 0; f.king.z = -4; f.brain.seen.add('slam'); f.king.set('slam'); run(f, 2.5); expect(f.aura).toBe(0); });
});

describe('weapon interface', () => {
  it('khanda conforms', () => {
    const W = KHANDA; expect(W.combo.length).toBe(5); expect(W.finishers.length).toBe(W.combo.length - 1); for (const c of [...W.combo, ...W.finishers, W.charge, W.heavy, 'flick', 'block', 'parry']) expect(W.clips[c], c).toBeDefined();
    for (const c of [...W.alt, ...Object.values(W.from), 'sunder', 'rites']) expect(W.clips[c], c).toBeDefined(); for (const c of [...W.combo, ...W.alt, ...W.finishers, W.heavy]) { const k = W.clips[c]; expect(k.hit, c).toBeDefined(); expect(k.chain!, c).toBeGreaterThan((k.hits ?? [k.hit!]).at(-1)![1]); expect(k.power, c).toBeGreaterThan(0); }
    for (const c of ['dodgeF', 'dodgeB', 'dodgeL', 'dodgeR', 'hurt', 'down', 'die', 'heal', 'rush']) expect(BODY_CLIPS[c], c).toBeDefined();
  });
});

describe('prompts', () => {
  it('appear at the right moment and go when done', () => {
    const f = mk(9, false), p = new Prompts(); const seen: string[] = []; const step = (mx: number, mz: number, pr: Press[]) => { const d = f.step(DT, mx, mz, pr); p.step(d, f); if (p.current && seen.at(-1) !== p.current.id) seen.push(p.current.id); };
    for (let i = 0; i < 60; i++) step(0, 0, []); expect(p.current?.id).toBe('move');
    for (let i = 0; i < 400 && f.m.targetDist > 2.2; i++) step(Math.sin(Math.atan2(f.king.x - f.m.x, f.king.z - f.m.z)), Math.cos(Math.atan2(f.king.x - f.m.x, f.king.z - f.m.z)), []);
    for (let i = 0; i < 5; i++) step(0, 0, []); expect(p.current?.id).toBe('attack');
    for (let i = 0; i < 60 * 70; i++) { f.hp = Math.max(f.hp, 60); f.bossHp = f.maxHp * 0.85; step(0, 0, i % 8 === 0 && f.hits < 12 ? tap('attack') : []); }
    expect(seen).toContain('dodge'); expect(seen).toContain('red'); expect(seen).toContain('skill'); expect(p.done.has('attack')).toBe(true); expect(p.done.has('move')).toBe(true);
    f.hp = 20; for (let i = 0; i < 400 && p.current?.id !== 'heal'; i++) { f.hp = 20; step(0, 0, []); } expect(p.current?.id).toBe('heal');
  });
});

describe('prompt lessons are separate', () => {
  it('dodging a white attack does not use up the red lesson', () => { const f = mk(2.4), p = new Prompts(); f.king.set('slam'); for (let i = 0; i < 70; i++) p.step(f.step(DT, 0, 0, i === 60 ? tap('dodge') : []), f); expect(p.done.has('dodge')).toBe(true); expect(p.done.has('red')).toBe(false); });
});

describe('bots', () => {
  /** One fight to the first death on either side. */
  const bout = (seed: number, o: { react: number; acc: number; guard?: boolean; skill?: boolean; defend?: boolean }) => {
    let s = seed * 7919 + 13; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const f = new Fight(new Motor(), new King(), new Brain(seed)); f.m.z = 5; let act = -1, what = '', lastAtk = 0, held = -1, flee = 0; const styles = new Set<string>(), modes = new Set<string>(); let r1 = 0;
    for (let i = 0; i < 60 * 900; i++) {
      const m = f.m, k = f.king, d = m.targetDist, a = Math.atan2(k.hx - m.x, k.hz - m.z); let p: Press[] = [], go = d > 2.0 ? 1 : 0; styles.add(f.brain.style); modes.add(k.mode);
      if (f.phase === 'scene') { r1 = f.time; f.beginRound2(); }
      for (const e of f.ev) if (e.k === 'cue' && o.defend !== false && rnd() < o.acc) { if (e.strike.kind === 'ground') { flee = i + Math.round((o.react + rnd() * 0.2) * 60); } else { const j = o.react + rnd() * 0.18; act = i + Math.round(Math.max(0.1, Math.min(e.lead - 0.06, Math.max(j, e.lead - 0.22 + (rnd() - 0.5) * 0.2))) * 60); what = o.guard && e.strike.kind === 'white' ? 'guard' : 'dodge'; } }
      const zone = f.hazards.find(h => h.shape !== 'ring' && !h.visual && Math.hypot(m.x - h.x, m.z - h.z) < (h.shape === 'circle' ? h.r + 0.4 : h.len)); let dir = a;
      const fleeing = !!zone && flee > 0 && i > flee;
      if (fleeing) { dir = zone!.shape === 'circle' ? Math.atan2(m.x - zone!.x, m.z - zone!.z) : zone!.yaw + Math.PI / 2 * (((m.x - zone!.x) * Math.cos(zone!.yaw) - (m.z - zone!.z) * Math.sin(zone!.yaw)) > 0 ? 1 : -1); go = 1; } else if (!f.hazards.length) flee = 0;
      if (act === i) { act = -1; if (what === 'guard') { p = down('guard'); held = i + 40; } else p = tap('dodge'); }
      else if (held === i) { p = up('guard'); held = -1; }
      else if (f.hp < 35 && f.heals > 0 && m.state === 'free' && !k.committed) p = tap('heal');
      else if (o.skill && m.can.ultimate && d < 8) p = tap('ultimate'); else if (o.skill && m.can.skill2 && d > 5) p = tap('skill2');
      else if (o.skill && f.fire >= D.rush.cost && d < 4 && k.committed) p = tap('skill1');
      else if (d < 2.6 && act < 0 && held < 0 && !fleeing && i - lastAtk > 9) { lastAtk = i; p = tap('attack'); }
      f.step(DT, Math.sin(dir) * go, Math.cos(dir) * go, p);
      if (f.phase === 'won') return { win: true, t: f.time, r1, styles, modes }; if (m.dead) return { win: false, t: f.time, r1, styles, modes };
    }
    return { win: false, t: 900, r1, styles, modes };
  };
  const rate = (o: Parameters<typeof bout>[1], N = 60) => { let w = 0, t = 0, half = 0, r1 = 0; const styles = new Set<string>(), modes = new Set<string>(); for (let i = 1; i <= N; i++) { const r = bout(i, o); if (r.win) { w++; t += r.t; } if (r.r1) { half++; r1 += r.r1; } r.styles.forEach(x => styles.add(x)); r.modes.forEach(x => modes.add(x)); } return { win: w / N, mins: +(t / Math.max(1, w) / 60).toFixed(2), half: half / N, r1mins: +(r1 / Math.max(1, half) / 60).toFixed(2), styles, modes }; };
  const say = (n: string, r: ReturnType<typeof rate>) => console.log('BOT', n, 'win', r.win.toFixed(2), 'mins', r.mins, 'reach half', r.half.toFixed(2), 'r1 mins', r.r1mins);
  it('a novice who dodges half the time and mashes usually wins first try', () => { const r = rate({ react: 0.45, acc: 0.5, skill: true }); say('novice', r); expect(r.win).toBeGreaterThanOrEqual(0.8); expect(r.half).toBeGreaterThan(0.9); for (const s of ['executioner', 'crawler', 'hanged', 'blades', 'eclipse']) expect(r.styles.has(s), s).toBe(true); for (const a of Object.keys(ATTACKS)) expect(r.modes.has(a), a).toBe(true); }, 60000);
  it('dodge-only, guard-only and no-skill players can win', () => { const a = rate({ react: 0.3, acc: 0.65 }), b = rate({ react: 0.3, acc: 0.75, guard: true }); say('dodge', a); say('guard', b); expect(a.win).toBeGreaterThan(0.6); expect(b.win).toBeGreaterThan(0.6); }, 60000);
  it('someone who never defends loses', () => { const r = rate({ react: 0, acc: 0, defend: false }); say('never', r); expect(r.win).toBeLessThan(0.15); }, 60000);
});
