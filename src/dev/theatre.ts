// MOMENT THEATRE: replay any boss cutscene moment at once, without fighting the boss for it.
//
// USAGE
//   Query flags on the fight pages (the same boot as a real fight: intro and training skipped, boss and hero placed, the moment started):
//     King        ?boss=1&moment=noose     first-person scripted grab (the first throw of a fight)
//                 ?boss=1&moment=rope      reward offer: the hanging King, the rope cut (press the attack button to take it)
//                 ?boss=1&moment=ride      reward offer: round 2, the sideways lunge dodged, the ride on his back
//     Ferryman    ?boss=2&moment=drag      scripted first grab: the undertow drag
//                 ?boss=2&moment=chain     reward offer: the chain cut, press to haul
//                 ?boss=2&moment=lantern   reward offer: round 2, the lamps gone out, press for the lantern
//     Sister      ?boss=3&moment=gather    the Pall's grapple (round 2): the arm goes out and catches you
//                 ?boss=3&moment=turn      the half-way turn (the same as ?turn)
//   Add &dev to any of these (npm run dev only) for the MOMENT THEATRE panel: a small list at the right edge of the screen.
//   Tap or click a button and that moment replays at once (boss and hero are put back first). On a gamepad, pause, then
//   "Moment theatre" in the pause menu opens the same list; the pad moves through it and A plays, B closes it.
//   R (dev only) replays the last moment played.
//   A moment, once over, hands the fight back: the fight simply continues.
//   The panel and its R key are compiled out of production builds (import.meta.env.DEV). The ?moment flag itself is harmless and stays.
//
// The plans below set the simulation's own state and call the simulation's own entry points (King.seize, Ferryman.offer,
// King.dodged, ...), so a moment played here runs the code a real fight runs. Only the boss's position and the hero's are staged.
import type { Fight } from '../combat/fight.ts';
import type { Motor } from '../player/motor.ts';
import { OFFER, type King } from '../bosses/king/king.ts';
import type { River } from '../bosses/river/river.ts';
import type { Sister } from '../boss/hours/sister.ts';

export type Boss = 'king' | 'river' | 'hours';
/** The moment names each fight page takes (the ?moment= value). */
export const MOMENTS: Record<Boss, string[]> = { king: ['noose', 'rope', 'ride'], river: ['drag', 'chain', 'lantern'], hours: ['gather', 'turn'] };
/** What each moment is, for the panel. */
const WHAT: Record<string, string> = { noose: 'first grab', rope: 'rope reward', ride: 'ride reward', drag: 'first grab', chain: 'chain reward', lantern: 'lantern reward', gather: 'the Pall grapple', turn: 'half-way turn' };

/** What a plan may touch: the fight, the hero, the boss, and the page's own round changes (views, the director). */
export interface PlanCtx {
  fight: Fight; m: Motor; sim: King | River | Sister;
  /** Enters round 2 the way ?round2 does. */ round2(): void;
  /** The round ends the way the director's half does (the turn). */ halfway?(): void;
}

/** Places the boss (at x, z, facing yaw) and the hero (at hx, hz, facing the boss). */
function place(c: PlanCtx, bx: number, bz: number, yaw: number, hx: number, hz: number) {
  const b = c.sim as unknown as { x: number; z: number; y: number; yaw: number }, m = c.m;
  b.x = bx; b.z = bz; b.y = 0; b.yaw = yaw; m.x = hx; m.z = hz; m.yaw = Math.atan2(bx - hx, bz - hz);
}

/** Plays a moment on a page's fight: the state it needs, then the simulation's own entry point. False for a name the boss does not have. */
export function playMoment(boss: Boss, name: string, c: PlanCtx): boolean {
  if (!MOMENTS[boss].includes(name)) return false;
  const f = c.fight;
  if (boss === 'king') {
    const k = c.sim as King;
    if (name === 'noose') { place(c, 0, -4, 0, 0, -2.4); k.seize('noose', f); } // the first grab: the same call the throw's own hit makes
    if (name === 'rope') { place(c, 0, -4, 0, 0, -2.2); k.set('hang'); k.ht = 1; k.reward = 'rope'; k.rewardLeft = OFFER; } // the hanging King, the rope on offer
    if (name === 'ride') { c.round2(); place(c, 0, -4, 0, -1.4, -2.6); k.set('cross'); k.dodged(f); } // a perfect dodge of the lunge: the ride on offer
  } else if (boss === 'river') {
    const s = c.sim as River;
    if (name === 'drag') { place(c, 0, -4, 0, 0, -2.4); s.seize('drag', f); } // the undertow's grab
    if (name === 'chain') { place(c, 0, -4, 0, 0, -1.6); s.offer('chain'); } // the chain cut: the reward on offer
    if (name === 'lantern') { c.round2(); place(c, 0, -4, 0, 0, -1.6); s.offer('lantern'); } // round 2: the lamps gone out
  } else {
    const s = c.sim as Sister;
    if (name === 'gather') { c.round2(); place(c, 0, -4, 0, 0, -1.0); f.brain.seen.add('gather'); s.set('gather'); } // the Pall's arm goes out; the hero is in its line (seen: no teaching slow-down on a replay)
    if (name === 'turn') { f.bossHp = 1; f.hits = 5; f.passive = false; c.halfway?.(); }
  }
  f.invuln = 0; // a round's start is safe for a second; the moment is not
  return true;
}

/** The moment asked for by the URL, if it names one this page has. */
export function momentFromQuery(Q: URLSearchParams, boss: Boss): string | null {
  const name = Q.get('moment'); return name && MOMENTS[boss].includes(name) ? name : null;
}

/** What a page gives the theatre: its query, its boss, its plan context, and a reset to the fight's start (its own restart, then the round's views). */
export interface TheatreHost { Q: URLSearchParams; boss: Boss; ctx(): PlanCtx; reset(): void }

/** Boot: plays the URL's moment and, in dev with ?dev, mounts the panel. Returns the replay used by the panel and R. */
export function mountTheatre(h: TheatreHost): { boot(): void; replay(name: string): void } {
  let last: string | null = null;
  const replay = (name: string) => {
    if (!MOMENTS[h.boss].includes(name)) return;
    h.reset(); if (playMoment(h.boss, name, h.ctx())) last = name;
  };
  return {
    replay,
    boot() {
      const name = momentFromQuery(h.Q, h.boss); if (name) replay(name);
      if (import.meta.env.DEV && h.Q.has('dev')) devPanel(h, replay, () => last);
    },
  };
}

/** The dev panel: a corner list of buttons, the R key, and a pause-menu entry for the pad. Compiled out of production (only reached when import.meta.env.DEV). */
function devPanel(h: TheatreHost, replay: (name: string) => void, last: () => string | null) {
  const style = document.createElement('style');
  style.textContent = '.theatre-panel{position:fixed;right:6px;top:34%;z-index:60;display:flex;flex-direction:column;gap:3px;padding:5px;max-width:124px;background:rgba(10,8,8,.6);border:1px solid #6d5a3a;border-radius:4px;font:10px/1.2 monospace;color:#e8d9b8}' +
    '.theatre-panel b{font-size:9px;letter-spacing:.08em;opacity:.8}.theatre-panel button{font:inherit;text-align:left;padding:3px 5px;background:#1d1714;color:inherit;border:1px solid #4a3c2a;border-radius:3px;cursor:pointer}' +
    '.theatre-panel button:focus,.theatre-panel button:hover{border-color:#e0a050;outline:none}.theatre-panel small{font-size:9px;opacity:.6}';
  document.head.appendChild(style);
  const box = document.createElement('div'); box.className = 'theatre-panel'; box.setAttribute('aria-label', 'Moment theatre');
  box.innerHTML = '<b>MOMENT THEATRE</b>';
  for (const name of MOMENTS[h.boss]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.m = name; b.innerHTML = `${name} <small>${WHAT[name] ?? ''}</small>`;
    b.onclick = () => { replay(name); };
    box.appendChild(b);
  }
  const hint = document.createElement('small'); hint.textContent = '` (backquote) replays the last'; box.appendChild(hint);
  document.body.appendChild(box);
  // the pad: a pause-menu entry that opens the panel for navigation (padNav reads the body class `theatre`)
  const pause = document.querySelector('.pause');
  if (pause) {
    const p = document.createElement('button'); p.type = 'button'; p.dataset.b = 'moments'; p.textContent = 'Moment theatre';
    p.onclick = () => { document.body.classList.add('theatre'); (document.querySelector<HTMLElement>('.pause [data-b=go]'))?.click(); };
    pause.appendChild(p);
  }
  addEventListener('keydown', e => {
    if (e.code !== 'Backquote' || e.repeat) return; const t = e.target as HTMLElement | null; if (t && /INPUT|TEXTAREA/.test(t.tagName)) return;
    const n = last(); if (n) replay(n);
  });
}
