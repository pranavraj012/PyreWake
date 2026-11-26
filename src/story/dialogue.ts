// Module G: the dialogue runner. A conversation is data: nodes of lines with a speaker, at most a few replies, and
// conditions and effects that read and write module B's progress (flags, kauri, iron, beads, flasks). No DOM here:
// the box is src/ui/talk.ts, and tests drive this file directly.
import { progress, type Progress } from '../game/progress.ts';

export type Scalar = number | boolean | string;

/** A condition reads progress; `all`, `any` and `not` combine them. */
export type Cond =
  | { always: true }
  | { flag: string; is?: Scalar }
  | { notFlag: string }
  | { burned: string }
  | { count: 'kauri' | 'iron' | 'beads'; atLeast: number }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

/** An effect writes progress. `shop` opens a shop once the conversation closes (the hub or module I opens it). */
export type Effect =
  | { set: string; to?: Scalar }
  | { kauri: number } | { iron: number } | { beads: number }
  | { flask: number }
  | { shop: string };

export interface Choice { text: string; when?: Cond; effects?: Effect[]; next: string | null }
export interface Node { speaker?: string; lines: string[]; voice?: string; effects?: Effect[]; choices?: Choice[]; next?: string | null }
export interface Conversation { nodes: Record<string, Node> }

/** Where a conversation reads and writes. The game passes the live progress; tests pass their own. */
export interface Env { read(): Readonly<Progress>; write(f: (p: Progress) => void): void }
export const LIVE: Env = { read: () => progress.get(), write: f => progress.change(f) };

export function holds(c: Cond, p: Readonly<Progress>): boolean {
  if ('always' in c) return true;
  if ('flag' in c) return c.is === undefined ? !!p.flags[c.flag] : p.flags[c.flag] === c.is;
  if ('notFlag' in c) return !p.flags[c.notFlag];
  if ('burned' in c) return p.burned.includes(c.burned);
  if ('count' in c) return p[c.count] >= c.atLeast;
  if ('all' in c) return c.all.every(x => holds(x, p));
  if ('any' in c) return c.any.some(x => holds(x, p));
  return !holds(c.not, p);
}

/** Writes an effect; returns the shop it names, if any. Spending never takes a count below zero. */
export function apply(e: Effect, env: Env): string | null {
  if ('shop' in e) return e.shop;
  env.write(p => {
    if ('set' in e) p.flags[e.set] = e.to ?? true;
    else if ('kauri' in e) p.kauri = Math.max(0, p.kauri + e.kauri);
    else if ('iron' in e) p.iron = Math.max(0, p.iron + e.iron);
    else if ('beads' in e) p.beads = Math.max(0, p.beads + e.beads);
    else p.flasks.strength += e.flask;
  });
  return null;
}

export interface Reply { text: string; index: number }
/** What the box shows now. `replies` is empty until the last line of a node is up. `first` marks a node's first line. */
export interface Shown { speaker: string; line: string; voice?: string; first: boolean; replies: Reply[] }

/** One talk with one person, from one entry node. */
export class Dialogue {
  /** Set when the talk runs a shop effect; the caller opens that shop once the talk is over. */
  shop: string | null = null;
  done = false;
  private id: string | null = null;
  private at = 0;
  private fresh = false;
  private conv: Conversation;
  private env: Env;
  private speaker: string;

  constructor(conv: Conversation, env: Env, start: string, speaker = '') {
    this.conv = conv; this.env = env; this.speaker = speaker; this.enter(start);
  }

  private enter(id: string | null) {
    if (id === null) { this.done = true; this.id = null; return; }
    const n = this.conv.nodes[id];
    if (!n) throw new Error(`dialogue: no node "${id}"`);
    this.id = id; this.at = 0; this.fresh = true;
    for (const e of n.effects ?? []) this.shop = apply(e, this.env) ?? this.shop;
  }

  private node(): Node | null { return this.id === null ? null : this.conv.nodes[this.id]; }

  private liveChoices(n: Node): Choice[] {
    const p = this.env.read(); return (n.choices ?? []).filter(c => !c.when || holds(c.when, p));
  }

  /** The line on screen, or null once the talk is over. Replies appear only on a node's last line. */
  current(): Shown | null {
    const n = this.node(); if (!n) return null;
    const last = this.at === n.lines.length - 1;
    const replies = last ? this.liveChoices(n).map((c, i) => ({ text: c.text, index: i })) : [];
    return { speaker: n.speaker ?? this.speaker, line: n.lines[this.at], voice: n.voice, first: this.fresh, replies };
  }

  /** Press to go on. With replies up, this does nothing: choose one. */
  advance() {
    const n = this.node(); if (!n) return;
    this.fresh = false;
    if (this.at < n.lines.length - 1) { this.at++; return; }
    if (this.liveChoices(n).length) return;
    this.enter(n.next ?? null);
  }

  /** Picks a reply by its index in `current().replies`. */
  choose(i: number) {
    const n = this.node(); if (!n) return;
    const c = this.liveChoices(n)[i]; if (!c) return;
    this.fresh = false;
    for (const e of c.effects ?? []) this.shop = apply(e, this.env) ?? this.shop;
    this.enter(c.next);
  }
}

export interface Entry { when: Cond; start: string }
/** A person: where they are, what they say, and which node a talk starts from. Entries are tried in order; the last is `always`. */
export interface Person { id: string; name: string; sub: string; place(p: Readonly<Progress>): string; entries: Entry[]; conv: Conversation }

/** Starts a talk with a person from the first entry whose condition holds. */
export function startTalk(person: Person, env: Env = LIVE): Dialogue {
  const p = env.read(); const e = person.entries.find(x => holds(x.when, p));
  if (!e) throw new Error(`dialogue: ${person.id} has no entry for this progress`);
  return new Dialogue(person.conv, env, e.start, person.name);
}
