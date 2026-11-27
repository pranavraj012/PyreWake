// On-screen joystick and buttons (multi-touch, safe-area aware).
import type { Action, Input } from './input.ts';
import type { Spell } from '../combat/spells.ts';
import { onViewport, viewport } from '../core/viewport.ts';

/** The buttons and the stick scale with the short side of the page (`--q` in style.css): 0.55 to 1 of the original sizes. */
export const stickScale = (w: number, h: number) => Math.min(1, Math.max(0.55, Math.min(w, h) / 575));

export const ICON: Record<string, string> = {
  attack: '<path d="M5 19 17 5l2-1-1 2L7 18z M4 16l4 4"/>',
  dodge: '<path d="M4 15c4 2 9 1 11-4m0 0-4 .5M15 11l1 4M6 8h4M4 11h4"/>',
  jump: '<path d="M12 20V7m0 0-5 5m5-5 5 5M6 21h12"/>',
  guard: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/>',
  skill1: '<path d="M4 18c5-1 4-6 9-7s5-4 7-6M4 13c3 0 4-2 6-4"/>',
  skill2: '<path d="M4 17C6 9 12 5 20 5c-5 2-9 6-9 13-2-2-4-2-7-1z"/>',
  ultimate: '<path d="M12 2c1 5 5 6 5 12a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5 2-3 1-6 0-10z"/>',
  heal: '<path d="M12 20C7 17 4 13 5 9c1-3 5-3 7 0 2-3 6-3 7 0 1 4-2 8-7 11z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
};
const LABEL: Partial<Record<Action, string>> = { attack: 'Attack', dodge: 'Dodge', jump: 'Jump', guard: 'Guard', heal: 'Heal', skill1: 'Rush', skill2: 'Sunder', ultimate: 'Rites' };

/** The spell buttons show whatever is carried. */
export function spellButtons(a: Spell, b: Spell) { for (const [k, s] of [['skill1', a], ['skill2', b]] as const) { ICON[k] = s.icon; LABEL[k] = s.short; const e = document.querySelector(`.tb-${k}`); if (e) { e.querySelector('svg')!.innerHTML = s.icon; const i = e.querySelector('i'); if (i) i.textContent = s.short; } } }
export function mountTouch(root: HTMLElement, input: Input) {
  const ui = document.createElement('div'); ui.id = 'touch';
  ui.innerHTML = `<div class="pad-l"><div class="base"><div class="knob"></div></div></div><div class="pad-r"></div>` +
    (['attack', 'dodge', 'jump', 'guard', 'skill1', 'skill2', 'ultimate', 'heal', 'pause'] as Action[]).map(a =>
      `<button class="tb tb-${a}" data-a="${a}" aria-label="${a}"><b></b><svg viewBox="0 0 24 24">${ICON[a]}</svg>${LABEL[a] ? `<i>${LABEL[a]}</i>` : ''}</button>`).join('');
  root.append(ui); input.lastDevice = 'touch';
  const L = ui.querySelector<HTMLElement>('.pad-l')!, R = ui.querySelector<HTMLElement>('.pad-r')!, base = ui.querySelector<HTMLElement>('.base')!, knob = ui.querySelector<HTMLElement>('.knob')!;
  let sid = -1, ox = 0, oy = 0, rad = 56 * stickScale(viewport().w, viewport().h); onViewport(() => { const v = viewport(); rad = 56 * stickScale(v.w, v.h); });
  const move = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy);
    if (l > rad) { ox += dx * (1 - rad / l); oy += dy * (1 - rad / l); dx *= rad / l; dy *= rad / l; base.style.transform = `translate(${ox}px,${oy}px)`; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const m = Math.min(1, Math.hypot(dx, dy) / rad), g = m < 0.14 ? 0 : 1 / rad;
    input.stick.x = dx * g; input.stick.y = -dy * g;
  };
  const end = (e: PointerEvent) => { if (e.pointerId !== sid) return; sid = -1; input.stick.x = input.stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); base.style.transform = ''; };
  L.addEventListener('pointerdown', e => { if (sid !== -1) return; sid = e.pointerId; L.setPointerCapture(sid); input.lastDevice = 'touch'; ox = e.clientX; oy = e.clientY; base.classList.add('on'); base.style.transform = `translate(${ox}px,${oy}px)`; });
  L.addEventListener('pointermove', move); L.addEventListener('pointerup', end); L.addEventListener('pointercancel', end);
  let lid = -1, lx = 0, ly = 0;
  R.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; R.setPointerCapture(lid); });
  R.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; input.look.x += (e.clientX - lx) * 0.006; input.look.y += (e.clientY - ly) * 0.004; lx = e.clientX; ly = e.clientY; });
  for (const b of ui.querySelectorAll<HTMLElement>('.tb')) {
    const a = b.dataset.a as Action;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('dn'); input.lastDevice = 'touch'; input.press('t' + e.pointerId, a); });
    const up = (e: PointerEvent) => { b.classList.remove('dn'); input.release('t' + e.pointerId); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  return ui;
}
