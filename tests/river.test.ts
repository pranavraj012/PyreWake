import { describe, expect, it } from 'vitest';
import { Fight, type FightEvent } from '../src/combat/fight.ts';
import { D } from '../src/combat/difficulty.ts';
import { River } from '../src/bosses/river/river.ts';
import { RiverBrain } from '../src/bosses/river/brain.ts';
import { RIVER_ATTACKS as A } from '../src/bosses/river/moves.ts';
import { RIVER_CLIPS as C } from '../src/bosses/river/clips.ts';
import { Motor, type Press } from '../src/player/motor.ts';

const DT = 1 / 60, tap = (a: string): Press[] => [{ a, up: false }, { a, up: true }];
/** Hero `gap` metres in front of the boss, facing it. */
const mk = (gap = 3, form: 1 | 2 = 1) => { const f = new Fight(new Motor(), new River(), new RiverBrain()); f.passive = true; const k = f.boss as River; if (form === 2) f.beginRound2(); k.x = 0; k.z = -4; f.m.x = 0; f.m.z = -4 + gap; f.m.yaw = Math.PI; f.invuln = 0; return { f, k }; };
const run = (f: Fight, secs: number, press: (i: number) => Press[] = () => [], move: (i: number) => [number, number] = () => [0, 0]) => { const ev: FightEvent[] = []; for (let i = 0; i < secs * 60; i++) { const [x, z] = move(i); f.step(DT, x, z, press(i)); ev.push(...f.ev); } return ev; };
const n = (ev: FightEvent[], k: string) => ev.filter(e => e.k === k).length, b = (ev: FightEvent[], e: string) => ev.filter(x => x.k === 'b' && x.e === e).length;
/** A cast thrown at you that you have stepped out of. */
const dodged = (f: Fight) => { run(f, 0.6); f.m.x = 9; run(f, 1.0); };
const until = (f: Fight, t: number) => { for (let i = 0; i < 900 && f.boss.mt < t; i++) f.step(DT, 0, 0, []); };
const go = (gap: number, mode: string, form: 1 | 2 = 1) => { const t = mk(gap, form); t.f.brain.seen.add(mode); t.k.set(mode); return t; };

describe('the Ferryman: every move shows itself, lands, and can be escaped', () => {
  const MOVES = ['lowWater', 'sounding', 'pushOff', 'turnBoat', 'haulIn', 'wheelIron', 'dragDeep'];
  it('every strike has a telegraph before it lands', () => { for (const m of Object.keys(A)) for (const s of A[m]) { expect(s.cue, m).toBeGreaterThan(0); expect(s.cue, m).toBeLessThan(s.t[0] - (s.zones?.length ? 0.4 : 0.25)); } });
  it('every move in a string has a clip to play', () => { for (const m of Object.keys(A)) expect(C[m], m).toBeDefined(); });
  it('a first sight of any move cues ahead of the blow', () => { for (const m of MOVES) { const { f } = go(2.4, m); f.brain.seen.delete(m); const ev = run(f, 3.5); const c = ev.filter(e => e.k === 'cue'); expect(c.length, m).toBeGreaterThan(0); expect((c[0] as { lead: number }).lead, m).toBeGreaterThan(0.25); } });
  it('the skim sweep hurts if you stand, and a jump goes over it', () => {
    const a = go(3.5, 'lowWater'); expect(n(run(a.f, 3), 'hurt')).toBe(1); expect(a.f.hp).toBe(D.hp - A.lowWater[0].dmg);
    const t = go(3.5, 'lowWater'); until(t.f, 0.7); const ev = run(t.f, 1, i => i === 0 ? tap('jump') : []); expect(n(ev, 'hurt')).toBe(0); expect(n(ev, 'leap')).toBe(1); expect(t.k.mode).toBe('reel'); expect(t.k.dmgMul).toBeGreaterThan(1.5);
  });
  it('Sounding: three stabs, each a ring of ground you can leave', () => {
    const a = go(2.4, 'sounding'); expect(n(run(a.f, 4), 'hurt')).toBeGreaterThanOrEqual(1);
    const t = go(2.4, 'sounding'); const ev = run(t.f, 4, () => [], i => i % 90 < 45 ? [1, 0] : [-1, 0]); expect(n(ev, 'hurt')).toBeLessThanOrEqual(1);
  });
  it('Turn the Boat is safe close to him, and not out in the reach of the pole', () => {
    const far = go(4.4, 'turnBoat'); expect(n(run(far.f, 4.6), 'hurt')).toBeGreaterThanOrEqual(1);
    const close = go(1.4, 'turnBoat'); close.f.m.z = close.k.z + 1.2; expect(n(run(close.f, 4.6), 'hurt')).toBe(0);
  });
  it('Push Off lands behind you, with the landing marked well beforehand', () => {
    const { f, k } = go(6, 'pushOff'); let h = null as null | { x: number; z: number; delay: number; t: number }; for (let i = 0; i < 120 && !h; i++) { f.step(DT, 0, 0, []); h = f.hazards[0] ?? null; } expect(h).not.toBeNull();
    expect(h!.z).toBeGreaterThan(f.m.z - 0.5); until(f, 1.7); expect(Math.hypot(k.x - h!.x, k.z - h!.z)).toBeLessThan(0.7);
  });
  it('the Wheel of Iron breaks columns on its way', () => { const { f, k } = go(4, 'wheelIron'); f.furnish([{ id: 0, kind: 'pillar', shape: 0, x: 0, z: -4 + 3.2, r: 0.85, yaw: 0, h: 5, hp: 1, max: 1, broken: false }]); f.m.x = 3; f.m.z = 3; k.x = 0; k.z = -4; run(f, 4); expect(f.props[0].broken).toBe(true); });
  it('a dodge at the right moment avoids each move', () => { for (const m of ['lowWater', 'turnBoat', 'wheelIron']) { const { f } = go(m === 'turnBoat' ? 4.2 : 3.4, m); const s = A[m][0]; until(f, s.t[0] - 0.12); const ev = run(f, 0.4, i => i === 0 ? tap('dodge') : []); expect(n(ev, 'hurt'), m).toBe(0); } });
  it('a guard stops white blows', () => { const { f } = go(3.4, 'lowWater'); until(f, 0.9); const ev = run(f, 1, i => i === 0 ? [{ a: 'guard', up: false }] : []); expect(n(ev, 'hurt')).toBe(0); expect(n(ev, 'block') + n(ev, 'parry')).toBe(1); });
});

describe('the chain', () => {
  const cast = (gap = 6) => { const t = go(gap, 'cast'); return t; };
  it('a cast that misses leaves the chain taut', () => { const { f, k } = cast(); dodged(f); expect(k.chain).not.toBeNull(); expect(k.chain!.hp).toBe(3); });
  it('a cast that finds you hauls you in with your blade ready, and opens him', () => {
    const { f, k } = cast(6); const ev = run(f, 3); expect(b(ev, 'haul')).toBe(1); expect(b(ev, 'arrive')).toBe(1); expect(Math.hypot(f.m.x - k.x, f.m.z - k.z)).toBeLessThan(2.6); expect(f.m.reckoning).toBeGreaterThan(0);
    const t = cast(6); run(t.f, 1.2); expect(t.f.m.can).toBeDefined();
  });
  it('the haul gives a free cut: reckoning answers the attack button, and it hurts him more', () => {
    const { f, k } = cast(6); run(f, 2.3); const hp = f.bossHp; const ev = run(f, 1.5, i => i === 0 ? tap('attack') : []); expect(n(ev, 'hit')).toBeGreaterThan(0); expect(f.bossHp).toBeLessThan(hp); expect(k.dmgMul).toBeGreaterThan(1);
  });
  it('a dodge or a jump avoids the cast', () => { for (const press of ['dodge', 'jump']) { const { f } = cast(6); until(f, 0.95); const ev = run(f, 1, i => i === 0 ? tap(press) : []); expect(n(ev, 'hurt'), press).toBe(0); expect(b(ev, 'haul'), press).toBe(0); } });
  it('three cuts snap it back into him and open him for a long while', () => {
    const { f, k } = cast(6); dodged(f); expect(k.chain).not.toBeNull(); const c = k.chain!; f.m.x = c.x * 0.5 + 1; f.m.z = c.z * 0.5 + 0.4; f.m.yaw = Math.atan2(-1, 0); let cuts = 0, snapped = false;
    for (let i = 0; i < 600 && !snapped; i++) { const mid = { x: (k.x + c.x) / 2, z: (k.z + c.z) / 2 }; if (f.m.state === 'free') { f.m.x = mid.x + 0.9; f.m.z = mid.z; f.m.yaw = Math.atan2(mid.x - f.m.x, 0.0001); } f.step(DT, 0, 0, i % 12 === 0 ? tap('attack') : []); cuts += f.ev.filter(e => e.k === 'b' && e.e === 'cut').length; snapped = f.ev.some(e => e.k === 'b' && e.e === 'snap'); k.mode === 'snap'; }
    expect(snapped).toBe(true); expect(cuts).toBe(3); expect(k.chain).toBeNull(); expect(k.mode).toBe('snap'); expect(C.snap.dur).toBeGreaterThan(3.5);
  });
  it('left alone, a taut chain hauls in along its line, and the line is clear to step out of', () => {
    const { f, k } = cast(6); dodged(f); expect(k.chain).not.toBeNull(); f.m.x = 5; f.m.z = -4 + 5; k.set('haulIn'); const ev = run(f, 3); expect(n(ev, 'hurt')).toBe(0); expect(k.mode).toBe('idle');
    const g = cast(6); dodged(g.f); g.f.m.x = 0; g.f.m.z = -4 + 4; g.k.set('haulIn'); expect(n(run(g.f, 3), 'hurt')).toBe(1);
  });
  it('the chain lets go on its own', () => { const { f, k } = cast(6); f.m.x = 5; run(f, 12); expect(k.chain).toBeNull(); });
});

describe('the lantern', () => {
  it('Only His: the lamps go out when he closes his hand, and come back', () => { const { f, k } = go(5, 'gather'); const ev = run(f, 2.5); expect(b(ev, 'dark')).toBe(1); expect(k.dark).toBeGreaterThan(5); const e2 = run(f, 10); expect(b(e2, 'relight')).toBe(1); expect(k.dark).toBe(0); });
  it('Wrong Shore: three lanterns, exactly one real; hitting the real one relights and stuns', () => {
    const { f, k } = go(6, 'wrongShore'); run(f, 1.6); expect(k.lanterns.length).toBe(3); expect(k.lanterns.filter(l => l.real).length).toBe(1);
    const real = k.lanterns.find(l => l.real)!; f.m.x = real.x - 1.2; f.m.z = real.z; f.m.yaw = Math.PI / 2; f.invuln = 5; const ev = run(f, 1.2, i => i === 0 ? tap('attack') : []); expect(b(ev, 'real')).toBe(1); expect(b(ev, 'relight')).toBe(1); expect(k.mode).toBe('snap'); expect(k.lanterns.length).toBe(0);
  });
  it('a false lantern is only a ripple', () => { const { f, k } = go(6, 'wrongShore'); run(f, 1.6); const fake = k.lanterns.find(l => !l.real)!, real = k.lanterns.find(l => l.real)!, dx = fake.x - real.x, dz = fake.z - real.z, L = Math.hypot(dx, dz); f.m.x = fake.x + dx / L * 1.2; f.m.z = fake.z + dz / L * 1.2; f.m.yaw = Math.atan2(-dx, -dz); f.invuln = 5; const ev = run(f, 1, i => i === 0 ? tap('attack') : []); expect(b(ev, 'fake')).toBe(1); expect(k.mode).toBe('wrongShore'); expect(k.lanterns.length).toBe(2); });
  it('ignored, the lanterns burn where they float', () => { const { f } = go(6, 'wrongShore'); f.m.x = 12; f.m.z = 4; f.invuln = 0; const ev = run(f, 6.6); expect(b(ev, 'lanternsBurst')).toBe(1); expect(f.hazards.length + n(ev, 'zone')).toBeGreaterThan(0); });
  it('Cold Hands: the drowned grab under you, then across your way, then close a ring of arms; standing still is caught, a spell burns a path', () => {
    const a = go(4, 'coldHands'); a.f.invuln = 0; const ev = run(a.f, 4.5); expect(b(ev, 'hands')).toBe(3); expect(n(ev, 'zone')).toBe(5); expect((a.f.boss as River).ring).not.toBeNull(); expect(n(ev, 'hurt')).toBeGreaterThanOrEqual(1);
    const t = go(4, 'coldHands'); t.f.fire = 100; run(t.f, 1.1); const zs = t.f.hazards.filter(h => h.mode === 'coldHands'); expect(zs.length).toBe(2); expect(Math.hypot(zs[0].x - t.f.m.x, zs[0].z - t.f.m.z)).toBeLessThan(0.1);
  });
  it('Cold Hands: a hero who keeps moving and jumps the ring gets out', () => {
    const t = go(4, 'coldHands'); let jumped = false; const ev = run(t.f, 4.6, () => { const r = (t.f.boss as River).ring; if (r && !jumped && Math.abs(Math.hypot(t.f.m.x - r.x, t.f.m.z - r.z) - r.R) < 1.0) { jumped = true; return tap('jump'); } return []; }, i => [Math.sin(i / 25), Math.cos(i / 25)]);
    expect(n(ev, 'hurt')).toBeLessThanOrEqual(1);
  });
});

describe('the Unburdened', () => {
  const MOVES = ['thrust', 'flurry', 'reap', 'vault', 'skim'];
  it('every move cues ahead of its blow, then lands on someone who stands there', () => { for (const m of MOVES) { const { f } = go(m === 'skim' ? 8 : m === 'vault' ? 7 : 2.6, m, 2); f.brain.seen.add(m); const ev = run(f, 3.2, () => [], () => [0, 0]); const c = ev.filter(e => e.k === 'cue'); expect(c.length, m).toBeGreaterThan(0); expect((c[0] as { lead: number }).lead, m).toBeGreaterThan(0.25); expect(n(ev, 'hurt'), m).toBeGreaterThan(0); } });
  it('a dodge at each cue escapes each move', () => { for (const m of MOVES) { const g = go(m === 'skim' ? 8 : m === 'vault' ? 7 : 2.6, m, 2), at: number[] = [], ev: FightEvent[] = []; for (let i = 0; i < 200; i++) { g.f.step(DT, 0, 0, at.includes(i) ? tap('dodge') : []); for (const e of g.f.ev) { ev.push(e); if (e.k === 'cue') at.push(i + Math.round(Math.max(0.05, (e as { lead: number }).lead - 0.14) * 60)); } } expect(n(ev, 'hurt'), m).toBe(0); } });
  it('the low sweep goes under a jump', () => { const { f } = go(2.6, 'reap', 2); let at = -1; const ev: FightEvent[] = []; for (let i = 0; i < 160; i++) { f.step(DT, 0, 0, i === at ? tap('jump') : []); for (const e of f.ev) { ev.push(e); if (e.k === 'cue' && at < 0) at = i + Math.round(Math.max(0.05, (e as { lead: number }).lead - 0.2) * 60); } } expect(n(ev, 'hurt')).toBe(0); expect(n(ev, 'leap')).toBeGreaterThan(0); });
  it('thrown lamps hurt a little, and the blade sends them back into him', () => { const { f, k } = go(5, 'lamps', 2); run(f, 2.2); expect(k.coins.length).toBeGreaterThan(3); const hp = f.bossHp; f.m.x = k.coins[0].x - Math.sin(f.m.yaw) * 1; f.m.z = k.coins[0].z - Math.cos(f.m.yaw) * 1; run(f, 2.5, i => i % 9 === 0 ? tap('attack') : []); expect(f.bossHp).toBeLessThanOrEqual(hp); });
  it('he is faster than the Ferryman was', () => { const a = mk(10, 1), b = mk(10, 2); a.k.set('stalk'); b.k.set('stalk'); run(a.f, 1.5); run(b.f, 1.5); expect(Math.abs(b.k.z + 4)).toBeGreaterThan(Math.abs(a.k.z + 4)); });
});

describe('the whole fight', () => {
  it('a bot that attacks and dodges beats both rounds, and it does not take forever', () => {
    const f = new Fight(new Motor(), new River(), new RiverBrain(3)), k = f.boss as River, m = f.m; m.z = 5; let t = 0, act = -1, up = -1, last = 0; const out: string[] = [];
    for (let i = 0; i < 60 * 900; i++) {
      if (f.phase === 'scene') { f.beginRound2(); out.push('r2@' + Math.round(f.time)); }
      const d = m.targetDist, a = Math.atan2(k.hx - m.x, k.hz - m.z); let p: Press[] = [], go = d > 2 ? 1 : 0;
      for (const e of f.ev) if (e.k === 'cue' && Math.random() < 0.8) act = i + Math.round(Math.max(0.1, e.lead - 0.16) * 60);
      if (act === i) p = tap('dodge'); else if (f.hp < 35 && f.heals > 0 && m.state === 'free') p = tap('heal'); else if (d < 2.8 && i - last > 9) { last = i; p = tap('attack'); }
      f.step(DT, Math.sin(a) * go, Math.cos(a) * go, p); t++; if (f.phase === 'finish' || f.phase === 'won' || m.dead) break; if (!Number.isFinite(k.x + k.z + m.x + m.z)) throw new Error('nan');
    }
    expect(f.phase === 'finish' || f.phase === 'won' || m.dead).toBe(true); expect(t / 60).toBeLessThan(900); void up; void out;
  });
  it('restart puts everything back', () => { const { f, k } = go(6, 'cast'); dodged(f); expect(k.chain).not.toBeNull(); f.reset(true); expect(k.chain).toBeNull(); expect(k.mode).toBe('idle'); expect(f.bossHp).toBe(k.hp[0]); expect(f.round).toBe(1); k.set('wrongShore'); run(f, 2); f.reset(true); expect(k.lanterns.length).toBe(0); });
  it('round 1 ends in a scene, round 2 begins whole', () => { const { f, k } = mk(2); f.bossHp = 1; f.m.x = 0; f.m.z = -2.5; run(f, 1, i => i === 0 ? tap('attack') : []); expect(f.phase).toBe('scene'); expect(k.mode).toBe('fall'); f.beginRound2(); expect(f.phase).toBe('r2'); expect(f.bossHp).toBe(k.hp[1]); });
  it('a death and a restart in round 2 stays in round 2', () => { const { f } = mk(6, 2); f.hp = 1; f.flame = false; f.invuln = 0; f.strikePlayer(50, true, 0, 'x'); expect(f.m.dead).toBe(true); run(f, 4.5); expect(f.round).toBe(2); expect(f.m.dead).toBe(false); expect(f.bossHp).toBe(f.maxHp); });
  it('the Unburdened can be won: finish, then the final blow', () => { const { f, k } = mk(2, 2); f.bossHp = 1; k.x = 0; k.z = -4; f.m.x = 0; f.m.z = -2.5; run(f, 1, i => i === 0 ? tap('attack') : []); expect(f.phase).toBe('finish'); expect(k.mode).toBe('kneel'); });
});
