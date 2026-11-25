import { describe, expect, it } from 'vitest';
import { Fight, type FightEvent } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { King, SparBrain, isAttack } from '../src/boss/king.ts';
import { ATTACKS } from '../src/boss/moves.ts';
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
  it('each swing lands exactly once', () => { const f = mk(); const ev = run(f, 1, i => i === 0 ? tap('attack') : []); expect(n(ev, 'hit')).toBe(1); expect(f.bossHp).toBe(D.boss.hp - KHANDA.damage); });
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
  it('charging longer hits harder', () => { const go = (s: number) => { const f = mk(2.2); run(f, s, i => i === 0 ? down('attack') : []); run(f, 1, i => i === 0 ? up('attack') : []); return D.boss.hp - f.bossHp; }; expect(go(1.5)).toBeGreaterThan(go(0.4)); expect(go(0.4)).toBeGreaterThan(KHANDA.damage * 1.5); });
});

describe('defence', () => {
  const slam = (gap = 2.4) => { const f = mk(gap); f.brain.seen.add('slam').add('sweep').add('grab'); f.king.set('slam'); return f; };
  it('an undefended blow hurts, once', () => { const f = slam(); const ev = run(f, 3); expect(n(ev, 'hurt')).toBe(1); expect(f.hp).toBe(D.hp - 10); });
  it('guard stops white with a sliver of chip', () => { const f = slam(); const ev = run(f, 3, i => i === 0 ? down('guard') : []); expect(n(ev, 'block')).toBe(1); expect(n(ev, 'hurt')).toBe(0); expect(f.hp).toBeGreaterThan(D.hp - 2); });
  it('chip can never kill', () => { const f = slam(); f.hp = 1; run(f, 3, i => i === 0 ? down('guard') : []); expect(f.hp).toBe(1); });
  it('a well-timed guard parries, drops the King to a knee and pays fire', () => { const f = slam(); until(f, 1.3); const ev = run(f, 1, i => i === 0 ? down('guard') : []); expect(n(ev, 'parry')).toBe(1); expect(f.king.mode).toBe('kneel'); expect(f.fire).toBe(D.gain.parry); expect(f.hp).toBe(D.hp); });
  it('mashing guard does not parry', () => { const f = slam(); const ev = run(f, 1.8, i => i % 8 === 0 ? down('guard') : i % 8 === 4 ? up('guard') : []); expect(n(ev, 'parry')).toBe(0); });
  it('red goes through guard', () => { const f = mk(2.4); f.brain.seen.add('grab'); f.king.set('grab'); const ev = run(f, 2.5, i => i === 0 ? down('guard') : []); expect(n(ev, 'hurt')).toBe(1); expect(n(ev, 'block')).toBe(0); });
  it('dodging through any attack avoids it', () => { for (const a of Object.keys(ATTACKS) as (keyof typeof ATTACKS)[]) { const f = mk(2.4); f.brain.seen.add(a as never); f.king.set(a as never); const s = ATTACKS[a][0]; until(f, s.t[0] - 0.12); const ev = run(f, 0.4, i => i === 0 ? tap('dodge') : []); expect(n(ev, 'hurt'), a).toBe(0); } });
  it('a last-instant dodge slows time and pays fire', () => { const f = slam(); until(f, 1.32); const ev = run(f, 0.5, i => i === 0 ? tap('dodge') : []); expect(ev.some(e => e.k === 'evade' && e.perfect)).toBe(true); expect(f.fire).toBe(D.gain.perfect); });
  it('stepping aside works without any dodge at all', () => { const f = slam(); until(f, 1.2); f.m.x += 1.6; const ev = run(f, 1.5); expect(n(ev, 'hurt')).toBe(0); });
});

describe('fire, healing, death', () => {
  it('Cinder Rush costs fire, passes through, and detonates on the King', () => { const f = mk(2.4); f.fire = 50; const z0 = f.m.z; const ev = run(f, 2, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'rush')).toBe(1); expect(f.fire).toBe(50 - D.rush.cost); expect(f.m.z).toBeLessThan(f.king.z); expect(z0).toBeGreaterThan(f.king.z); expect(ev.some(e => e.k === 'detonate' && e.hit)).toBe(true); expect(f.bossHp).toBe(D.boss.hp - D.rush.dmg); expect(f.king.mode).toBe('reel'); });
  it('no fire, no Rush', () => { const f = mk(); f.fire = D.rush.cost - 1; const ev = run(f, 1, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'rush')).toBe(0); expect(n(ev, 'deny')).toBe(1); });
  it('Rush dodges whatever is landing', () => { const f = mk(2.4); f.fire = 50; f.brain.seen.add('grab'); f.king.set('grab'); until(f, 1.3); const ev = run(f, 1, i => i === 0 ? tap('skill1') : []); expect(n(ev, 'hurt')).toBe(0); });
  it('a Rush ends with the hero standing in the arena, outside the King', () => { for (const a of [0, 1, 2, 3, 4, 5]) { const f = mk(); f.king.x = Math.cos(a) * 17; f.king.z = Math.sin(a) * 17; f.m.x = Math.cos(a) * 14.5; f.m.z = Math.sin(a) * 14.5; f.fire = 60; run(f, 2, i => i === 0 ? tap('skill1') : []); expect(Math.hypot(f.m.x, f.m.z)).toBeLessThan(21.5); expect(f.m.targetDist).toBeGreaterThan(1.05); } });
  it('four heals, never past full, never wasted at full', () => { const f = mk(6); run(f, 1.2, i => i === 0 ? tap('heal') : []); expect(f.heals).toBe(4); for (let k = 0; k < 6; k++) { f.hp = 20; run(f, 1.2, i => i === 0 ? tap('heal') : []); } expect(f.heals).toBe(0); expect(f.hp).toBe(20); });
  it('nothing kills from full, and it takes about ten blows', () => { for (const s of Object.values(ATTACKS).flat()) { expect(s.dmg).toBeLessThan(D.hp / 5); expect(D.hp / s.dmg).toBeGreaterThan(5); } });
  it('the first showing of an attack does 40%', () => { const f = mk(2.4); f.king.set('slam', D.teach.rate); run(f, 5); expect(f.hp).toBeCloseTo(D.hp - 10 * D.teach.dmg, 5); });
  it('death restarts the fight fresh within seconds', () => { const f = mk(2.4); f.hp = 2; f.brain.seen.add('slam'); f.king.set('slam'); const ev = run(f, 6); expect(n(ev, 'dead')).toBe(1); expect(n(ev, 'reset')).toBe(1); expect(f.hp).toBe(D.hp); expect(f.m.dead).toBe(false); expect(f.heals).toBe(D.heals); });
  it('the King falls at zero and rises again for sparring', () => { const f = mk(); f.bossHp = 5; const ev = run(f, 9, i => i === 0 ? tap('attack') : []); expect(n(ev, 'bossDown')).toBe(1); expect(n(ev, 'bossUp')).toBe(1); expect(f.bossHp).toBe(D.boss.hp); });
  it('hit-stop freezes the fight but keeps your input', () => { const f = mk(); f.stop = 0.1; expect(f.step(DT, 0, 0, tap('dodge'))).toBe(0); run(f, 0.2); expect(f.m.clip?.name).toMatch(/^dodge/); });
});

describe('fairness', () => {
  it('every blow is cued long enough ahead, more so the first time', () => { for (const [name, list] of Object.entries(ATTACKS)) list.forEach((s, i) => { expect(s.t[0] - s.cue, name).toBeGreaterThanOrEqual(D.cue - 1e-6); if (i === 0) expect((s.t[0] - s.cue) / D.teach.rate, name).toBeGreaterThanOrEqual(D.cueFirst - 0.02); }); });
  it('every attack leaves at least 1.5 s of opening', () => { for (const [name, list] of Object.entries(ATTACKS)) expect(KING_CLIPS[name].dur - list[list.length - 1].t[1] + D.boss.rest[0], name).toBeGreaterThan(1.5); });
  it('cues in play match the table and never overlap', () => { const f = mk(2.4, false); f.hits = 9; let last = -9; for (let i = 0; i < 60 * 60; i++) { f.step(DT, 0, 0, []); if (f.m.dead) break; f.hp = 100; f.m.x = f.king.x + Math.sin(f.king.yaw) * 2.4; f.m.z = f.king.z + Math.cos(f.king.yaw) * 2.4; for (const e of f.ev) if (e.k === 'cue') { expect(f.time - last).toBeGreaterThan(0.5); last = f.time; } } expect(last).toBeGreaterThan(0); });
  it('the King waits for you to land a few hits first', () => { const f = mk(2.2, false); for (let i = 0; i < 60 * 8; i++) { f.step(DT, 0, 0, []); expect(isAttack(f.king.mode)).toBe(false); } });
  it('it never swings at something behind it', () => { const k = new King(), b = new SparBrain(); for (let i = 0; i < 4000; i++) { const a = k.yaw + Math.PI, was = k.mode; b.step(DT, k, k.x + Math.sin(a) * 2.5, k.z + Math.cos(a) * 2.5, 99); if (was !== k.mode && isAttack(k.mode)) throw new Error('swung backwards'); k.step(DT, k.x + Math.sin(a) * 2.5, k.z + Math.cos(a) * 2.5); } });
});

describe('weapon interface', () => {
  it('khanda conforms', () => {
    const W = KHANDA; expect(W.combo.length).toBe(5); expect(W.finishers.length).toBe(W.combo.length - 1); for (const c of [...W.combo, ...W.finishers, W.charge, W.heavy, 'flick', 'block', 'parry']) expect(W.clips[c], c).toBeDefined();
    for (const c of [...W.combo, ...W.finishers, W.heavy]) { const k = W.clips[c]; expect(k.hit, c).toBeDefined(); expect(k.chain!, c).toBeGreaterThan((k.hits ?? [k.hit!]).at(-1)![1]); expect(k.power, c).toBeGreaterThan(0); }
    for (const c of ['dodgeF', 'dodgeB', 'dodgeL', 'dodgeR', 'hurt', 'down', 'die', 'heal', 'rush']) expect(BODY_CLIPS[c], c).toBeDefined();
  });
});

describe('prompts', () => {
  it('appear at the right moment and go when done', () => {
    const f = mk(9, false), p = new Prompts(); const seen: string[] = []; const step = (mx: number, mz: number, pr: Press[]) => { const d = f.step(DT, mx, mz, pr); p.step(d, f); if (p.current && seen.at(-1) !== p.current.id) seen.push(p.current.id); };
    for (let i = 0; i < 60; i++) step(0, 0, []); expect(p.current?.id).toBe('move');
    for (let i = 0; i < 400 && f.m.targetDist > 2.2; i++) step(Math.sin(Math.atan2(f.king.x - f.m.x, f.king.z - f.m.z)), Math.cos(Math.atan2(f.king.x - f.m.x, f.king.z - f.m.z)), []);
    for (let i = 0; i < 5; i++) step(0, 0, []); expect(p.current?.id).toBe('attack');
    for (let i = 0; i < 60 * 25; i++) { f.hp = Math.max(f.hp, 60); step(0, 0, i % 8 === 0 && f.hits < 12 ? tap('attack') : []); }
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
    const f = new Fight(new Motor(), new King(), new SparBrain(seed)); f.m.z = 5; let act = -1, what = '', lastAtk = 0, held = -1;
    for (let i = 0; i < 60 * 600; i++) {
      const m = f.m, k = f.king, d = m.targetDist, a = Math.atan2(k.x - m.x, k.z - m.z); let p: Press[] = [], go = d > 2.1 ? 1 : 0;
      for (const e of f.ev) if (e.k === 'cue' && o.defend !== false && rnd() < o.acc) { const j = o.react + rnd() * 0.18; act = i + Math.round(Math.max(0.1, Math.min(e.lead - 0.06, Math.max(j, e.lead - 0.22 + (rnd() - 0.5) * 0.2))) * 60); what = o.guard ? 'guard' : 'dodge'; }
      if (act === i) { act = -1; if (what === 'guard') { p = down('guard'); held = i + 40; } else p = tap('dodge'); }
      else if (held === i) { p = up('guard'); held = -1; }
      else if (f.hp < 35 && f.heals > 0 && m.state === 'free' && !k.committed) p = tap('heal');
      else if (o.skill && f.fire >= D.rush.cost && d < 4 && k.committed) p = tap('skill1');
      else if (d < 2.6 && act < 0 && held < 0 && i - lastAtk > 9) { lastAtk = i; p = tap('attack'); }
      f.step(DT, Math.sin(a) * go, Math.cos(a) * go, p);
      if (f.downs > 0) return { win: true, t: f.time }; if (m.dead) return { win: false, t: f.time };
    }
    return { win: false, t: 600 };
  };
  const rate = (o: Parameters<typeof bout>[1], N = 60) => { let w = 0, t = 0; for (let i = 1; i <= N; i++) { const r = bout(i, o); if (r.win) { w++; t += r.t; } } return { win: w / N, t: t / Math.max(1, w) }; };
  it('a novice who dodges half the time and mashes usually wins', () => { const r = rate({ react: 0.45, acc: 0.5, skill: true }); console.log('novice', r); expect(r.win).toBeGreaterThan(0.8); });
  it('dodge-only, guard-only and no-skill players can win', () => { const a = rate({ react: 0.3, acc: 0.7 }), b = rate({ react: 0.3, acc: 0.8, guard: true }); console.log('dodge', a, 'guard', b); expect(a.win).toBeGreaterThan(0.6); expect(b.win).toBeGreaterThan(0.6); });
  it('someone who never defends is at real risk', () => { const r = rate({ react: 0, acc: 0, defend: false }); console.log('never', r); expect(r.win).toBeLessThan(0.9); });
});
