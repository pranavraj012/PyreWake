// The boss registry: every boss in fight order, as plain data. The menu's fight list, the ?boss= page switch and the moment theatre all read it.
// Only dynamic import() appears here (inside each load), so any page can import this without pulling in another boss's code.
import type { Ctx } from '../core/boot.ts';

export type BossId = 'king' | 'river' | 'hours';
/** The ?boss= number: 1 is the default page (no param), then 2 and 3. */
export type BossNumber = 1 | 2 | 3;
/** What a boss page's boot takes: main.ts's Ctx. */
export type BossBoot = (c: Ctx) => Promise<void>;

export interface BossEntry {
  id: BossId;
  n: BossNumber;
  /** The menu label. */
  name: string;
  /** The ?moment= names this boss's page takes (dev/theatre.ts). */
  moments: string[];
  /** The page's boot, loaded on demand. Null for the King: his page is main.ts itself. */
  load: (() => Promise<BossBoot>) | null;
}

export const BOSSES: readonly BossEntry[] = [
  { id: 'king', n: 1, name: 'The Hanged King', moments: ['noose', 'rope', 'ride'], load: null },
  { id: 'river', n: 2, name: 'The Ferryman', moments: ['drag', 'chain', 'lantern'], load: () => import('./river/page.ts').then(r => r.bootRiver) },
  { id: 'hours', n: 3, name: 'The Sister of Hours', moments: ['gather', 'turn'], load: () => import('./hours/page.ts').then(r => r.bootHours) },
];

/** The URL search that reaches a boss's page: '' for the King (the default page), '?boss=N' for the others. */
export function bossHref(n: BossNumber): string {
  return n === 1 ? '' : `?boss=${n}`;
}

/** The menu's fight list, in fight order: every boss, the current one with no callback (it is Play), each other one leading to its page. */
export function fightList(current: BossId): [string, (() => void) | null][] {
  return BOSSES.map(b => [b.name, b.id === current ? null : () => { location.search = bossHref(b.n); }]);
}
