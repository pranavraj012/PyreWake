import { describe, expect, it } from 'vitest';
import { fresh, type Progress } from '../src/game/progress.ts';
import { apply, Dialogue, holds, startTalk, type Env, type Person } from '../src/story/dialogue.ts';
import { AMMAJI } from '../src/story/people/ammaji.ts';
import { LOHAR } from '../src/story/people/lohar.ts';
import { AMMAJI as AW, LOHAR as LW } from '../src/story/peopleScript.ts';

/** A progress of its own for each test, and the env that reads and writes it. */
const world = (edit: (p: Progress) => void = () => { }) => {
  const p = fresh(); edit(p);
  const env: Env = { read: () => p, write: f => f(p) };
  return { p, env };
};

/** Advances a talk to its replies (the last line of the node on screen), without answering. */
const toReplies = (d: Dialogue) => { for (let i = 0; i < 20 && d.current()?.replies.length === 0; i++) d.advance(); return d.current()!; };
/** Answers the reply whose text is `text`. */
const answer = (d: Dialogue, text: string) => { const s = toReplies(d); const r = s.replies.find(x => x.text === text); expect(r, `reply "${text}"`).toBeDefined(); d.choose(r!.index); };

describe('conditions', () => {
  it('reads flags, burned bosses and counts', () => {
    const { p } = world(q => { q.flags['x'] = true; q.flags['n'] = 2; q.burned.push('king'); q.beads = 3; });
    expect(holds({ flag: 'x' }, p)).toBe(true);
    expect(holds({ flag: 'n', is: 2 }, p)).toBe(true);
    expect(holds({ flag: 'n', is: 3 }, p)).toBe(false);
    expect(holds({ notFlag: 'y' }, p)).toBe(true);
    expect(holds({ burned: 'king' }, p)).toBe(true);
    expect(holds({ burned: 'ferryman' }, p)).toBe(false);
    expect(holds({ count: 'beads', atLeast: 3 }, p)).toBe(true);
    expect(holds({ count: 'kauri', atLeast: 1 }, p)).toBe(false);
  });

  it('combines with all, any and not', () => {
    const { p } = world(q => { q.flags['a'] = true; });
    expect(holds({ all: [{ flag: 'a' }, { notFlag: 'b' }] }, p)).toBe(true);
    expect(holds({ all: [{ flag: 'a' }, { flag: 'b' }] }, p)).toBe(false);
    expect(holds({ any: [{ flag: 'b' }, { flag: 'a' }] }, p)).toBe(true);
    expect(holds({ not: { flag: 'a' } }, p)).toBe(false);
    expect(holds({ always: true }, p)).toBe(true);
  });
});

describe('effects', () => {
  it('sets flags, adds and spends kauri, iron, beads and flasks', () => {
    const { p, env } = world(q => { q.kauri = 5; q.iron = 1; });
    apply({ set: 'met' }, env); expect(p.flags['met']).toBe(true);
    apply({ set: 'mood', to: 'grim' }, env); expect(p.flags['mood']).toBe('grim');
    apply({ kauri: -2 }, env); expect(p.kauri).toBe(3);
    apply({ kauri: -9 }, env); expect(p.kauri).toBe(0);
    apply({ iron: 4 }, env); expect(p.iron).toBe(5);
    apply({ beads: 2 }, env); expect(p.beads).toBe(2);
    apply({ flask: 1 }, env); expect(p.flasks.strength).toBe(1);
  });

  it('returns the shop an effect names instead of changing progress', () => {
    const { p, env } = world();
    expect(apply({ shop: 'lohar' }, env)).toBe('lohar');
    expect(p.flags).toEqual({});
  });
});

describe('the runner', () => {
  it('shows one line at a time, and replies only on a node\'s last line', () => {
    const { env } = world();
    const d = new Dialogue({ nodes: { a: { lines: ['one', 'two'], choices: [{ text: 'yes', next: null }] } } }, env, 'a', 'Test');
    expect(d.current()).toMatchObject({ speaker: 'Test', line: 'one', first: true, replies: [] });
    d.advance();
    expect(d.current()).toMatchObject({ line: 'two', first: false, replies: [{ text: 'yes', index: 0 }] });
    d.advance(); // replies are up: press does nothing
    expect(d.current()!.line).toBe('two');
    expect(d.done).toBe(false);
    d.choose(0);
    expect(d.done).toBe(true);
    expect(d.current()).toBeNull();
  });

  it('hides a reply whose condition does not hold, and ends on the node\'s next when none show', () => {
    const { env } = world();
    const conv = { nodes: { a: { lines: ['x'], choices: [{ text: 'hidden', when: { flag: 'nope' }, next: null }], next: 'b' }, b: { lines: ['y'] } } };
    const d = new Dialogue(conv, env, 'a');
    expect(d.current()!.replies).toEqual([]);
    d.advance();
    expect(d.current()!.line).toBe('y');
  });

  it('runs the effects of a node on entry and of a reply when chosen', () => {
    const { p, env } = world(q => { q.beads = 3; });
    const conv = {
      nodes: {
        a: { lines: ['a'], effects: [{ set: 'entered' }], choices: [{ text: 'pay', effects: [{ beads: -3 }, { flask: 1 }], next: null }] },
      },
    };
    const d = new Dialogue(conv, env, 'a');
    expect(p.flags['entered']).toBe(true);
    expect(p.beads).toBe(3);
    d.choose(0);
    expect(p.beads).toBe(0);
    expect(p.flasks.strength).toBe(1);
  });

  it('records a shop to open once the talk is over', () => {
    const { env } = world();
    const d = new Dialogue({ nodes: { a: { lines: ['wares?'], choices: [{ text: 'show', effects: [{ shop: 'ammaji' }], next: null }] } } }, env, 'a');
    expect(d.shop).toBeNull();
    d.choose(0);
    expect(d.shop).toBe('ammaji');
    expect(d.done).toBe(true);
  });

  it('throws on a node that does not exist, and ignores a reply index that is out of range', () => {
    const { env } = world();
    expect(() => new Dialogue({ nodes: {} }, env, 'missing')).toThrow(/no node/);
    const d = new Dialogue({ nodes: { a: { lines: ['x'], choices: [{ text: 'only', next: null }] } } }, env, 'a');
    d.advance();
    d.choose(5);
    expect(d.done).toBe(false);
  });
});

describe('Ammaji', () => {
  it('meets you once: four lines, a name-bead, the flag', () => {
    const { p, env } = world();
    const d = startTalk(AMMAJI, env);
    expect(d.current()!.speaker).toBe(AW.name);
    for (let i = 0; i < AW.meet.length - 1; i++) { expect(d.current()!.line).toBe(AW.meet[i]); d.advance(); }
    expect(d.current()!.line).toBe(AW.meet[AW.meet.length - 1]);
    expect(p.flags['ammaji.met']).toBe(true);
    expect(p.beads).toBe(1);
    d.advance();
    expect(d.current()!.line).toBe(AW.hub[0]);
    // the next talk is the hub, not the meeting
    expect(startTalk(AMMAJI, env).current()!.line).toBe(AW.hub[0]);
  });

  it('offers the bead turn-in only with three beads, and gives flask strength for them', () => {
    const { p, env } = world(q => { q.flags['ammaji.met'] = true; q.beads = 2; });
    const d = startTalk(AMMAJI, env);
    expect(toReplies(d).replies.map(r => r.text)).not.toContain(AW.replies.beads);
    d.choose(toReplies(d).replies.findIndex(r => r.text === AW.replies.leave));
    expect(d.done).toBe(true);

    p.beads = 3;
    const e = startTalk(AMMAJI, env);
    answer(e, AW.replies.beads);
    expect(p.beads).toBe(0);
    expect(p.flasks.strength).toBe(1);
    expect(e.current()!.line).toBe(AW.beadsThanks[0]);
  });

  it('opens the shop from the hub', () => {
    const { env } = world(q => { q.flags['ammaji.met'] = true; });
    const d = startTalk(AMMAJI, env);
    answer(d, AW.replies.shop);
    expect(d.shop).toBe('ammaji');
    expect(d.done).toBe(true);
  });

  it('says a line once the King is burned, once, and then goes back to the hub', () => {
    const { p, env } = world(q => { q.flags['ammaji.met'] = true; q.burned.push('king'); });
    const d = startTalk(AMMAJI, env);
    expect(d.current()!.line).toBe(AW.kingWord[0]);
    expect(p.flags['ammaji.kingWord']).toBe(true);
    d.advance(); d.advance();
    expect(d.current()!.line).toBe(AW.hub[0]);
    expect(startTalk(AMMAJI, env).current()!.line).toBe(AW.hub[0]);
  });
});

describe('Lohar', () => {
  it('is found in the pit, and sets the flag when met', () => {
    const { p, env } = world();
    expect(LOHAR.place(p)).toBe('ashfields');
    const d = startTalk(LOHAR, env);
    expect(d.current()!.line).toBe(LW.meet[0]);
    expect(p.flags['lohar.met']).toBe(true);
    for (let i = 0; i < 12 && !(d.current()?.replies.length); i++) d.advance();
    expect(d.current()!.line).toBe(LW.pit[0]);
    answer(d, LW.replies.wares);
    expect(d.shop).toBe('lohar');
  });

  it('moves to the Last Pyre after the King, and says so once', () => {
    const { p, env } = world(q => { q.flags['lohar.met'] = true; q.burned.push('king'); });
    const d = startTalk(LOHAR, env);
    expect(d.current()!.line).toBe(LW.kingWord[0]);
    expect(p.flags['lohar.hub']).toBe(true);
    expect(LOHAR.place(p)).toBe('hub');
    d.advance(); d.advance();
    expect(d.current()!.line).toBe(LW.atHub[0]);
    expect(startTalk(LOHAR, env).current()!.line).toBe(LW.atHub[0]);
  });
});

describe('entries', () => {
  it('a person with no entry for the progress is an error, not a silent talk', () => {
    const { env } = world();
    const person: Person = { id: 'x', name: 'X', sub: '', place: () => 'hub', entries: [{ when: { flag: 'never' }, start: 'a' }], conv: { nodes: { a: { lines: ['x'] } } } };
    expect(() => startTalk(person, env)).toThrow(/no entry/);
  });
});
