// The Sister of Hours and the Pall: every move shows itself, lands on a hero who stands still, and can be escaped; the count, the linen and the hand teach themselves.
import { describe, expect, it } from 'vitest';
import { Fight, type FightEvent } from '../src/combat/fight.ts';
import { Sister } from '../src/bosses/hours/sister.ts';
import { HoursBrain } from '../src/bosses/hours/brain.ts';
import { HOURS_ATTACKS as A } from '../src/bosses/hours/moves.ts';
import { HOURS_CLIPS as C } from '../src/bosses/hours/clips.ts';
import { Motor, type Press } from '../src/player/motor.ts';
import { PALL_HEM } from '../src/bosses/hours/frame.ts';

const DT = 1 / 60, tap = (a: string): Press[] => [{ a, up: false }, { a, up: true }];
const mk = (gap = 3, form: 1 | 2 = 1, ang = 0) => { const f = new Fight(new Motor(), new Sister(), new HoursBrain()); f.passive = true; const k = f.boss as Sister; if (form === 2) f.beginRound2(); k.x = 0; k.z = -4; k.yaw = 0; f.m.x = Math.sin(ang) * gap; f.m.z = -4 + Math.cos(ang) * gap; f.m.yaw = Math.PI; f.invuln = 0; return { f, k }; };
const run = (f: Fight, secs: number, press: (i: number) => Press[] = () => [], move: (i: number) => [number, number] = () => [0, 0]) => { const ev: FightEvent[] = []; for (let i = 0; i < secs * 60; i++) { const [x, z] = move(i); f.step(DT, x, z, press(i)); ev.push(...f.ev); } return ev; };
const n = (ev: FightEvent[], k: string) => ev.filter(e => e.k === k).length;
const go = (gap: number, mode: string, form: 1 | 2 = 1, ang = 0) => { const t = mk(gap, form, ang); t.f.brain.seen.add(mode); t.k.set(mode); return t; };
/** Each move, the form it belongs to, and the range the brain picks it from. */
const RANGE: [string, 1 | 2, number, number][] = [['reap', 1, 1.2, 4.8], ['hourWheel', 1, 2, 7], ['harvest', 1, 2.5, 14], ['lieDown', 1, 1.0, 3.2], ['binding', 1, 2, 8.5], ['cleanSheet', 1, 3, 14], ['betweenBeds', 1, 5, 14],
  ['hourHand', 2, 4, 14], ['drawSheet', 2, 3.5, 14], ['wardStands', 2, 4, 11.5], ['noon', 2, 2, 12], ['lastBreath', 2, 3, 8.5], ['gather', 2, 2.5, 10.5]];

describe('the Sister of Hours and the Pall', () => {
  it('every strike has a telegraph before it lands, and every move a clip', () => { for (const m of Object.keys(A)) { expect(C[m], m).toBeDefined(); for (const s of A[m]) { expect(s.cue, m).toBeGreaterThan(0); expect(s.cue, m).toBeLessThan(s.t[0] - (s.zones?.length ? 0.4 : 0.25)); } } });
  it('every move lands on a hero who stands still, anywhere in the range it is chosen from', () => {
    for (const [mode, form, near, far] of RANGE) for (let i = 0; i < 4; i++) for (const ang of [-0.4, 0, 0.4]) {
      const d = near + (far - near) * i / 3, { f, k } = go(d, mode, form, ang), hp = f.hp; for (let j = 0; j < 8 * 60 && (k.mode === mode || k.mode === 'grip' || j < 5); j++) { f.invuln = 0; f.step(DT, 0, 0, []); }
      expect(f.hp, `${mode} at ${d.toFixed(1)} m, ${ang}`).toBeLessThan(hp);
    }
  });
  it('every move can be dodged: a dodge as each blow comes takes no damage', () => {
    for (const [mode, form, near] of RANGE.filter(r => r[0] !== 'hourHand' && r[0] !== 'noon')) {
      const { f, k } = go(near + 0.6, mode, form); if (mode === 'gather') k.grabs = 1; const times = A[mode].map(s => s.t[0] - 0.12).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.3); let ti = 0; f.invuln = 0;
      const ev = run(f, 7, () => { if (ti < times.length && k.mode === mode && k.mt >= times[ti]) { ti++; return tap('dodge'); } return []; });
      expect(n(ev, 'hurt'), mode).toBe(0);
    }
  });
  it('Seven Breaths: the dark circle at her feet is safe, the rest of the floor is not', () => {
    const near = go(1.8, 'sevenBreaths'); expect(n(run(near.f, 7), 'hurt')).toBe(0);
    const far = go(6, 'sevenBreaths'); expect(n(run(far.f, 7), 'hurt')).toBe(1);
  });
  it('Seven Breaths: three blows while she counts and she loses it, reels, and takes more', () => {
    const { f, k } = go(1.6, 'sevenBreaths'); let lost = false;
    run(f, 6, i => i % 22 === 0 && k.counting ? tap('attack') : [], () => { if (k.mode === 'lostCount') lost = true; return [0, 0]; });
    expect(lost).toBe(true); expect(f.hazards.some(h => h.mode === 'sevenBreaths')).toBe(false);
  });
  it('Binding: any fire on the strips burns them back to her', () => {
    const { f, k } = go(4, 'binding', 1, 0.22); f.fire = 100; for (let i = 0; i < 300 && !k.strips.length; i++) { f.invuln = 1; f.step(DT, 0, 0, []); } expect(k.strips.length).toBe(3); f.m.yaw = Math.atan2(k.x - f.m.x, k.z - f.m.z); run(f, 1.4, i => i === 0 ? tap('skill2') : []); expect(k.mode === 'burnt' || k.mode === 'idle').toBe(true); expect(k.strips.length).toBe(0);
  });
  it('The Hour Hand: jumped as it passes, or stood inside at her hem, it misses', () => {
    const { f, k } = go(7, 'hourHand', 2), times: number[] = []; for (let j = 0; j < 260 && k.mode === 'hourHand'; j++) { const h = f.hazards.find(q => q.shape === 'sweep'); if (h && h.t >= h.delay) { const u = Math.min(1, (h.t - h.delay) / (h.dur ?? 1)), yw = h.yaw + (h.spin ?? 0) * u, a = Math.atan2(f.m.x - h.x, f.m.z - h.z); let e = a - yw; e -= Math.round(e / 6.283) * 6.283; if (Math.abs(e) < 0.3 && !times.length) { times.push(j); f.step(DT, 0, 0, tap('jump')); continue; } } f.step(DT, 0, 0, []); }
    expect(f.hp).toBe(100);
    const close = go(2.2, 'hourHand', 2); expect(n(run(close.f, 4.4), 'hurt')).toBe(0);
  });
  it('Noon: step out of the stake, then jump the ring of stone it throws', () => {
    const { f, k } = go(2.6, 'noon', 2); let dodged = false, jumped = false;
    for (let i = 0; i < 300 && (k.mode === 'noon' || i < 5); i++) { let p: Press[] = []; if (!dodged && k.mt >= 1.38) { dodged = true; p = tap('dodge'); } else { const r = f.hazards.find(h => h.shape === 'ring'); if (r && !jumped && r.t >= r.delay && Math.abs(Math.hypot(f.m.x - r.x, f.m.z - r.z) - r.speed * (r.t - r.delay)) < 1.3) { jumped = true; p = tap('jump'); } } f.step(DT, 0, 0, p); }
    expect(f.hp).toBe(100);
  });
  it('Between Beds: she cannot be hit inside the smoke, and comes out within six metres of you', () => {
    const { f, k } = go(8, 'betweenBeds'); run(f, 0.8); expect(k.vulnerable).toBe(false); run(f, 0.7); expect(k.vulnerable).toBe(true); expect(Math.hypot(k.x - f.m.x, k.z - f.m.z)).toBeLessThan(6);
  });
  it('The Gathering: caught, the Weight of Hours always plays out and costs a great deal', () => {
    const { f, k } = go(5, 'gather', 2); let held = false; run(f, 7, () => { if (k.mode === 'grip') held = true; return []; }); expect(held).toBe(true); expect(100 - f.hp).toBeGreaterThan(30);
  });
  it('the Gathering lets go: the hold ends with a "released" event, so the page can hand the camera and the hero back', () => {
    const { f, k } = go(5, 'gather', 2); const ev = run(f, 7) as unknown as { k: string; e?: string }[];
    expect(ev.some(e => e.k === 'b' && e.e === 'grab')).toBe(true);
    expect(ev.some(e => e.k === 'b' && e.e === 'released')).toBe(true); expect(k.mode).not.toBe('grip');
  });
  it('the first Gathering of the Pall always catches, even from the side; the next one can be missed', () => {
    // she turns to face you as the arm goes out, so the step aside has to come after her turn (about 0.4 s in)
    const aside = (f: Fight) => (i: number): Press[] => { if (i === 24) { f.m.x = 3.4; f.m.z = -4; } return []; };
    const first = go(4, 'gather', 2, 0); run(first.f, 4, aside(first.f)); expect(first.k.grabs, 'first grab from the side').toBe(1);
    const again = go(4, 'gather', 2, 0); again.k.grabs = 1; run(again.f, 4, aside(again.f)); expect(again.k.grabs, 'second grab from the side is not forced').toBe(1);
  });
  it('a linen arm left on the floor can be cut', () => {
    const { f, k } = go(4, 'gather', 2, 0.6); k.grabs = 1; f.invuln = 3; run(f, 1.2); expect(k.laid.length).toBe(1);
    const l = k.laid[0]; f.m.x = l.x + Math.sin(l.yaw) * 5 + Math.cos(l.yaw) * 0.6; f.m.z = l.z + Math.cos(l.yaw) * 5 - Math.sin(l.yaw) * 0.6; f.m.yaw = Math.atan2(-Math.cos(l.yaw), Math.sin(l.yaw));
    let cut = false; run(f, 1, i => i === 2 ? tap('attack') : [], () => { if (k.severed[l.arm] >= 0) cut = true; return [0, 0]; }); expect(cut).toBe(true);
  });
  it('the Pall rises after the turn and can be hurt: its rise ends, and a blow or a spell lands', () => {
    for (const kind of ['attack', 'skill1']) {
      const { f, k } = mk(2.4, 2); f.fire = 100; k.set('rise'); k.mt = k.prev = 2.6; const hp = f.bossHp;
      run(f, 4, i => i === 150 ? tap(kind) : []);
      expect(k.mode, kind).not.toBe('rise'); expect(k.vulnerable, kind).toBe(true); expect(f.bossHp, kind).toBeLessThan(hp);
    }
  });
  it('the Pall is hit where her drawn hem is: a blade that reaches the visible edge lands, from outside her hitbox', () => {
    // the swing lunges the hero about 0.8 m as it lands, so measure how far he stands when the first blow lands
    const { f, k } = mk(1, 2), reach = f.m.weapon.reach; f.m.x = 0; f.m.z = k.z + PALL_HEM + reach + 0.5; f.m.yaw = Math.PI; f.m.target = null;
    let hitAt = -1; for (let i = 0; i < 90; i++) { const before = f.bossHp; f.step(DT, 0, 0, i === 30 ? tap('attack') : []); if (hitAt < 0 && f.bossHp < before) hitAt = Math.hypot(k.x - f.m.x, k.z - f.m.z); }
    expect(hitAt).toBeGreaterThan(k.r + reach); expect(hitAt).toBeLessThan(PALL_HEM + reach + 0.2);
  });
  it('a hero who answers the cues wins in a sensible time', () => {
    let wins = 0, T = 0; const N = 6;
    for (let seed = 1; seed <= N; seed++) {
      const f = new Fight(new Motor(), new Sister(), new HoursBrain(seed)), m = f.m, k = f.boss as Sister; m.z = 5; let act = -1, last = 0;
      for (let i = 0; i < 60 * 480; i++) {
        if (f.phase === 'scene') f.beginRound2();
        const d = Math.hypot(k.hx - m.x, k.hz - m.z), a = Math.atan2(k.hx - m.x, k.hz - m.z); let p: Press[] = [];
        for (const e of f.ev) if (e.k === 'cue') act = i + Math.round(Math.max(0.1, (e as { lead: number }).lead - 0.15) * 60);
        if (act === i) p = tap('dodge'); else if (f.hp < 35 && f.heals > 0 && m.state === 'free') p = tap('heal'); else if (d < k.hr + 2.2 && i - last > 9) { last = i; p = tap('attack'); }
        f.step(DT, Math.sin(a) * (d > k.hr + 1.4 ? 1 : 0), Math.cos(a) * (d > k.hr + 1.4 ? 1 : 0), p);
        if (f.phase === 'finish' || f.phase === 'won') { wins++; break; } if (m.dead) break;
      }
      T += f.time;
    }
    expect(wins).toBeGreaterThanOrEqual(3); expect(T / N / 60).toBeLessThan(5);
  });
});
