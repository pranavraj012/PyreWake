// One-line prompts that appear once, at the moment they matter, and leave when you have done the thing.
import type { Action } from '../input/input.ts';
import type { Fight } from '../combat/fight.ts';
import { D } from '../combat/difficulty.ts';

export interface Prompt { id: string; action: Action | 'move'; text: string; tone?: 'white' | 'red' | 'ground' }
const P: Record<string, Prompt> = {
  move: { id: 'move', action: 'move', text: 'Move' },
  attack: { id: 'attack', action: 'attack', text: 'Attack' },
  dodge: { id: 'dodge', action: 'dodge', text: 'White glint: dodge', tone: 'white' },
  guard: { id: 'guard', action: 'guard', text: 'White glint: you can also hold Guard', tone: 'white' },
  red: { id: 'red', action: 'dodge', text: 'Red: cannot be blocked. Dodge', tone: 'red' },
  ground: { id: 'ground', action: 'move', text: 'Glowing ground: get off it', tone: 'ground' },
  hang: { id: 'hang', action: 'attack', text: 'Strike the hanging head' },
  reckon: { id: 'reckon', action: 'attack', text: 'Now! Attack' },
  execute: { id: 'execute', action: 'attack', text: 'It is helpless: attack' },
  finish: { id: 'finish', action: 'attack', text: 'End it' },
  sunder: { id: 'sunder', action: 'skill2', text: 'Sunder Arc: cut from afar' },
  wake: { id: 'wake', action: 'ultimate', text: 'Last Rites' },
  heal: { id: 'heal', action: 'heal', text: 'Heal' },
  skill: { id: 'skill', action: 'skill1', text: 'Fire ready: Cinder Rush, straight through it' },
  heavy: { id: 'heavy', action: 'attack', text: 'Hold for a heavy strike' },
  finisher: { id: 'finisher', action: 'attack', text: 'Hold during a combo for a finisher' },
};
/** Most urgent first. */ const ORDER = ['finish', 'red', 'ground', 'dodge', 'guard', 'reckon', 'execute', 'heal', 'hang', 'wake', 'sunder', 'skill', 'attack', 'move', 'finisher', 'heavy'];

export class Prompts {
  current: Prompt | null = null; done = new Set<string>(); private t = 0; private moved = 0; private cueT = 0; private kind: 'white' | 'red' | 'ground' = 'white'; private white = 0; private combos = 0;
  private want(id: string) { return !this.done.has(id); }
  private show(id: string) { if (!this.want(id)) return; const cur = this.current; if (cur && cur.id !== id && ORDER.indexOf(cur.id) <= ORDER.indexOf(id)) return; if (cur?.id !== id) { this.current = P[id]; this.t = 0; } }
  private finish(id: string) { this.done.add(id); if (this.current?.id === id) this.current = null; }
  step(dt: number, f: Fight) {
    const m = f.m; this.t += dt; this.cueT -= dt; this.moved += Math.hypot(m.vx, m.vz) * dt;
    for (const e of m.events) {
      if (/^clip:(light|heavy)/.test(e)) { if (m.targetDist < 4) this.finish('attack'); if (e === 'clip:heavy') this.finish('heavy'); if (e === 'clip:light5') this.combos++; }
      if (m.weapon.finishers.some(n => e === 'clip:' + n)) this.finish('finisher');
      if (e.startsWith('clip:dodge') && this.cueT > 0) this.finish(this.kind === 'red' ? 'red' : this.kind === 'ground' ? 'ground' : 'dodge');
      if (e === 'use:skill1') this.finish('skill'); if (e === 'use:skill2') this.finish('sunder'); if (e === 'use:ultimate') this.finish('wake');
      if (e === 'clip:reckon') this.finish('reckon'); if (e === 'clip:execute') { this.finish('execute'); this.finish('finish'); }
    }
    if (m.guarding && this.white > 1) this.finish('guard');
    if (this.moved > 3) this.finish('move');
    for (const e of f.ev) {
      if (e.k === 'heal') this.finish('heal');
      if (e.k === 'cue') { this.cueT = e.lead + 0.15; this.kind = e.strike.kind; if (e.strike.kind === 'red') this.show('red'); else if (e.strike.kind === 'ground') this.show('ground'); else { this.white++; this.show(this.want('dodge') ? 'dodge' : 'guard'); } }
      // a cue prompt goes when its blow has passed, and comes back with the next one until answered
      if (e.k === 'hit' && e.head) this.finish('hang'); if (e.k === 'reset') this.current = null;
      if (e.k === 'evade' || e.k === 'hurt' || e.k === 'block' || e.k === 'parry') this.cueT = Math.min(this.cueT, 0.2);
    }
    const cue = this.current && (this.current.id === 'dodge' || this.current.id === 'guard' || this.current.id === 'red' || this.current.id === 'ground');
    if (cue && this.cueT <= 0) { if (this.current!.id === 'ground' && m.targetDist > 2.6) this.finish('ground'); this.current = null; }
    if (this.current?.id === 'reckon' && m.reckoning <= 0) this.current = null; if (this.current?.id === 'execute' && !m.can.execute) this.current = null; if (this.current?.id === 'hang' && !f.king.hanging) this.current = null;
    if (this.current && !cue && this.t > 7) { if (this.current.id !== 'attack' && this.current.id !== 'heal' && !/^(hang|finish|execute|reckon|wake)$/.test(this.current.id)) this.done.add(this.current.id); this.current = null; }
    if (f.phase === 'finish') { this.done.delete('finish'); this.show('finish'); return; }
    if (m.dead || f.phase === 'scene' || f.phase === 'won') { this.current = null; return; }
    if (f.time > 0.5) this.show('move');
    if (m.targetDist < 4.2 && f.hits === 0) this.show('attack');
    if (f.hp < D.hp * 0.4 && f.heals > 0) this.show('heal');
    if (m.reckoning > 0 && m.targetDist < 5) this.show('reckon'); if (m.can.execute) this.show('execute'); if (f.king.hanging && f.king.ht > 1.2) this.show('hang'); if (m.can.ultimate) this.show('wake'); if (m.can.skill2 && this.done.has('skill') && m.targetDist > 5) this.show('sunder');
    if (f.fire >= D.rush.cost && m.targetDist < 9) this.show('skill');
    if (this.combos >= 1 && f.hits > 8 && this.cueT <= 0) this.show('finisher');
    if (this.combos >= 2 && this.done.has('finisher') && this.cueT <= 0) this.show('heavy');
  }
}
