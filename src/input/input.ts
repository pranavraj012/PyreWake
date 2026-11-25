// One action map fed by keyboard/mouse, gamepad and touch.
import { settings } from '../core/settings.ts';
import { actionOn, padFor } from './bindings.ts';
export type Action = 'attack' | 'dodge' | 'jump' | 'guard' | 'skill1' | 'skill2' | 'ultimate' | 'heal' | 'pause';
export const ACTIONS: Action[] = ['attack', 'dodge', 'jump', 'guard', 'skill1', 'skill2', 'ultimate', 'heal', 'pause'];

export class Input {
  move = { x: 0, y: 0 };
  look = { x: 0, y: 0 };
  held = new Set<Action>();
  lastDevice: 'keys' | 'pad' | 'touch' = 'keys';
  private src = new Map<string, Action>();
  private keys = new Set<string>();
  private queue: { a: Action; t: number; up: boolean }[] = [];
  stick = { x: 0, y: 0 };
  private padPrev = new Set<Action>(); private nav: string[] = []; private navHeld = ''; private navAt = 0; private navBtn = new Set<string>();
  /** Presses meant for menus since last asked: up, down, left, right, ok, back. */
  takeNav() { const n = this.nav; this.nav = []; return n; }
  /** 0-1 each, milliseconds. Only when a pad is in hand and can. */
  rumble(strong: number, weak: number, ms: number) {
    if (this.lastDevice !== 'pad' || settings.rumble <= 0) return; const p = navigator.getGamepads?.().find(g => g?.connected) as (Gamepad & { vibrationActuator?: { playEffect(t: string, o: object): Promise<unknown> } }) | undefined;
    try { void p?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong * settings.rumble), weakMagnitude: Math.min(1, weak * settings.rumble) }).catch(() => { }); } catch { /* not supported */ }
  }
  private padMenu(p: Gamepad) {
    const b = (i: number) => !!p.buttons[i]?.pressed, ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0, d = b(12) || ay < -0.6 ? 'up' : b(13) || ay > 0.6 ? 'down' : b(14) || ax < -0.6 ? 'left' : b(15) || ax > 0.6 ? 'right' : '', now = performance.now();
    if (d !== this.navHeld) { this.navHeld = d; this.navAt = now + 380; if (d) this.nav.push(d); } else if (d && now > this.navAt) { this.navAt = now + 130; this.nav.push(d); }
    for (const [n, i] of [['ok', 0], ['back', 1]] as const) { if (b(i) && !this.navBtn.has(n)) { this.nav.push(n); this.navBtn.add(n); } else if (!b(i)) this.navBtn.delete(n); }
    if (this.nav.length) this.lastDevice = 'pad'; if (this.nav.length > 8) this.nav.length = 0;
  }

  constructor(el: HTMLElement) {
    addEventListener('keydown', e => { if (e.repeat || ((e.target as HTMLElement | null)?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter'))) return; this.lastDevice = 'keys'; this.keys.add(e.code); const a = actionOn(e.code); if (a) { e.preventDefault(); this.press('k' + e.code, a); } });
    addEventListener('keyup', e => { this.keys.delete(e.code); this.release('k' + e.code); });
    addEventListener('blur', () => { this.keys.clear(); for (const k of [...this.src.keys()]) this.release(k); this.stick.x = this.stick.y = 0; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; this.lastDevice = 'keys'; const a = actionOn('Mouse' + e.button); if (a) this.press('m' + e.button, a); });
    addEventListener('pointerup', e => { if (e.pointerType === 'mouse') this.release('m' + e.button); });
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && (document.pointerLockElement || e.buttons & 4)) { this.look.x += e.movementX * 0.0025; this.look.y += e.movementY * 0.0025; } });
  }
  press(id: string, a: Action) { if (this.src.has(id)) return; this.src.set(id, a); this.held.add(a); this.queue.push({ a, t: performance.now(), up: false }); }
  release(id: string) {
    const a = this.src.get(id); if (!a) return; this.src.delete(id);
    if (![...this.src.values()].includes(a)) { this.held.delete(a); this.queue.push({ a, t: performance.now(), up: true }); }
  }
  /** Call once per simulated step. */
  poll() {
    let x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    let y = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const p = navigator.getGamepads?.().find(g => g?.connected);
    if (p) {
      this.padMenu(p); const dz = (v: number) => Math.abs(v) < 0.18 ? 0 : v;
      if (dz(p.axes[0]) || dz(p.axes[1])) { x = p.axes[0]; y = -p.axes[1]; this.lastDevice = 'pad'; }
      this.look.x += dz(p.axes[2]) * 0.045; this.look.y += dz(p.axes[3]) * 0.03;
      const now = new Set<Action>(); for (const a of ACTIONS) if (padFor(a).some(b => b.split('+').every(i => p.buttons[+i]?.pressed))) now.add(a);
      for (const a of now) if (!this.padPrev.has(a)) { this.lastDevice = 'pad'; this.press('p' + a, a); }
      for (const a of this.padPrev) if (!now.has(a)) this.release('p' + a);
      this.padPrev = now;
    }
    if (this.stick.x || this.stick.y) { x = this.stick.x; y = this.stick.y; this.lastDevice = 'touch'; }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
  }
  /** Drain press/release events for the combat buffer. */
  drain() { const q = this.queue; this.queue = []; return q; }
  takeLook() { const l = { ...this.look }; this.look.x = this.look.y = 0; return l; }
}
