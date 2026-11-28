// MOMENT THEATRE: replay any boss cutscene moment at once, without fighting the boss for it.
//
// USAGE
//   ?boss=N&moment=NAME on a fight page (N and the names come from the boss registry, src/bosses/index.ts): the same boot as a real fight
//   (intro and training skipped, boss and hero placed, the moment started). Each boss plans its own moments in its theatre.ts
//   (src/bosses/<id>/theatre.ts), and the page passes that plan in (FightPageSpec.moment).
//   Add &dev to any of these (npm run dev only) for the MOMENT THEATRE panel: a small list at the right edge of the screen.
//   Tap or click a button and that moment replays at once (boss and hero are put back first). On a gamepad, pause, then
//   "Moment theatre" in the pause menu opens the same list; the pad moves through it and A plays, B closes it.
//   R (dev only) replays the last moment played.
//   A moment, once over, hands the fight back: the fight simply continues.
//   The panel and its R key are compiled out of production builds (import.meta.env.DEV). The ?moment flag itself is harmless and stays.
//
// A plan sets the simulation's own state and calls the simulation's own entry points, so a moment played here runs the code a real fight
// runs. Only the boss's position and the hero's are staged.
import type { Fight } from '../combat/fight.ts';
import type { Motor } from '../player/motor.ts';
import { BOSSES, type BossId } from '../bosses/index.ts';

export type Boss = BossId;
/** The moment names each fight page takes (the ?moment= value), from the boss registry. */
export const MOMENTS = Object.fromEntries(BOSSES.map(b => [b.id, b.moments])) as Record<Boss, string[]>;

/** What a plan may touch: the fight, the hero, the boss, and the page's own round changes (views, the director). */
export interface PlanCtx {
  fight: Fight; m: Motor; /** The boss's simulation: its plan casts it to the boss's own type. */ sim: unknown;
  /** Enters round 2 the way ?round2 does. */ round2(): void;
  /** The round ends the way the director's half does (the turn). */ halfway?(): void;
}
/** A boss's moments: what each one plays, and the words the panel shows for it. */
export interface MomentPlan { what: Record<string, string>; play(name: string, c: PlanCtx): void }

/** Places the boss (at x, z, facing yaw) and the hero (at hx, hz, facing the boss). */
export function place(c: PlanCtx, bx: number, bz: number, yaw: number, hx: number, hz: number) {
  const b = c.sim as unknown as { x: number; z: number; y: number; yaw: number }, m = c.m;
  b.x = bx; b.z = bz; b.y = 0; b.yaw = yaw; m.x = hx; m.z = hz; m.yaw = Math.atan2(bx - hx, bz - hz);
}

/** Plays a moment on a page's fight: the boss's own plan, then the fight's start is safe for a second. False for a name the boss does not have. */
export function playMoment(boss: Boss, name: string, c: PlanCtx, plan: MomentPlan): boolean {
  if (!MOMENTS[boss].includes(name)) return false;
  plan.play(name, c);
  c.fight.invuln = 0; // a round's start is safe for a second; the moment is not
  return true;
}

/** The moment asked for by the URL, if it names one this page has. */
export function momentFromQuery(Q: URLSearchParams, boss: Boss): string | null {
  const name = Q.get('moment'); return name && MOMENTS[boss].includes(name) ? name : null;
}

/** What a page gives the theatre: its query, its boss, its plan context, and a reset to the fight's start (its own restart, then the round's views). */
export interface TheatreHost { Q: URLSearchParams; boss: Boss; /** The boss's own plan for its moments. */ plan: MomentPlan; ctx(): PlanCtx; reset(): void }

/** Boot: plays the URL's moment and, in dev with ?dev, mounts the panel. Returns the replay used by the panel and R. */
export function mountTheatre(h: TheatreHost): { boot(): void; replay(name: string): void } {
  let last: string | null = null;
  const replay = (name: string) => {
    if (!MOMENTS[h.boss].includes(name)) return;
    h.reset(); if (playMoment(h.boss, name, h.ctx(), h.plan)) last = name;
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
    const b = document.createElement('button'); b.type = 'button'; b.dataset.m = name; b.innerHTML = `${name} <small>${h.plan.what[name] ?? ''}</small>`;
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
