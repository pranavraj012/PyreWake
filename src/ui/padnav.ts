// A gamepad in the menus: whatever panel is up, the stick and D-pad walk its buttons, A presses, B backs out.
import { sound } from '../audio/sound.ts';
import type { Input } from '../input/input.ts';

const PANELS: [string, string, string][] = [['paused', '.pause', '[data-b=go]'], ['won', '.win', '[data-b=again]'], ['menu', '#menu', '[data-b=play]'], ['meta', '.meta-sheet.on', '[data-b=close]'], ['theatre', '.theatre-panel', 'button']];
/** Returns true while a panel has the pad. */
export function padNav(input: Input): boolean {
  const body = document.body.classList; body.toggle('padmode', input.lastDevice === 'pad'); const P = PANELS.find(([c]) => body.contains(c)); const keys = input.takeNav(); if (!P) return false;
  if (!keys.length) return true; const root = document.querySelector<HTMLElement>(P[1])!, list = [...root.querySelectorAll<HTMLElement>('button, input')].filter(e => e.offsetParent !== null); body.toggle('silent', !!sound.ctx && sound.ctx.state !== 'running');
  for (const k of keys) {
    const at = document.activeElement as HTMLElement | null, cur = at && list.includes(at) ? at : null;
    if (k === 'ok') { (cur ?? root.querySelector<HTMLElement>(P[2]))?.click(); continue; }
    if (k === 'back') { if (P[0] === 'paused' || P[0] === 'meta') root.querySelector<HTMLElement>(P[2])?.click(); else if (P[0] === 'menu') root.querySelector<HTMLElement>('nav [aria-expanded=true]')?.click(); else if (P[0] === 'theatre') body.remove('theatre'); continue; }
    if (!cur) { (root.querySelector<HTMLElement>(P[2]) ?? list[0])?.focus(); continue; }
    if (cur instanceof HTMLInputElement && (k === 'left' || k === 'right')) { cur.value = String(+cur.value + (k === 'right' ? 0.1 : -0.1)); cur.dispatchEvent(new Event('input', { bubbles: true })); continue; }
    // the nearest one that way
    const a = cur.getBoundingClientRect(), gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1); let best: HTMLElement | null = null, score = 1e9;
    for (const e of list) {
      if (e === cur || ((k === 'up' || k === 'down') && !!cur.closest('.settings') !== !!e.closest('.settings') && document.body.classList.contains('menu'))) continue; const r = e.getBoundingClientRect(), side = k === 'left' || k === 'right', fw = k === 'left' ? a.left - r.right : k === 'right' ? r.left - a.right : k === 'up' ? a.top - r.bottom : r.top - a.bottom; if (fw < -6) continue;
      const off = side ? gap(a.top, a.bottom, r.top, r.bottom) : gap(a.left, a.right, r.left, r.right), mid = side ? Math.abs(a.top + a.bottom - r.top - r.bottom) : Math.abs(a.left + a.right - r.left - r.right), q = Math.max(0, fw) + off * 2.5 + mid * 0.06; if (q < score) { score = q; best = e; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); sound.play('uiMove', { gain: 0.5 }); }
  }
  return true;
}
