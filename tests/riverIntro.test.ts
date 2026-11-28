// The Ferryman's telling (module A): the lamp waits for the hero to set it down, and no timeout does it for them. The dark follows the light.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

const g = globalThis as unknown as { document?: unknown };
g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() { } }), fillRect() { }, fillStyle: '' }) }), body: { classList: { add() { }, remove() { } } } };
const { RiverIntro } = await import('../src/bosses/river/riverScenes.ts');
const { MOONK } = await import('../src/render/sky.ts');

const DT = 1 / 60;
function kit() {
  const shown: [string, string, number, string][] = []; let hides = 0;
  const m = { x: 0, z: 0, revive() { } };
  const k = { x: 0, z: -26, y: 0, yaw: 0, form: 1, set() { } };
  const kit = {
    f: { m, boss: k },
    pv: { reset() { } },
    rd: { reset() { }, cine: null as unknown },
    k1: { settle() { }, eyes() { }, show() { }, eyeBurst() { }, eyeAt: () => new THREE.Vector3(), lampHidden: false },
    fx: { sparks: { emit() { } }, puffs: { emit() { } }, bursts: { add() { } } },
    hud: { verse() { }, say() { } },
    ghats: { group: new THREE.Group(), bowlMesh: () => new THREE.Group(), lamps() { }, setOut() { }, setFront() { }, flames() { }, ripple() { }, bowlsLit() { } },
    prompt: { show(a: string, t: string, s: number, d: string) { shown.push([a, t, s, d]); }, hide() { hides++; } },
  };
  return { kit: kit as never, shown, hides: () => hides };
}
const run = (e: { step(dt: number, t: number, d?: string): number }, secs: number) => { for (let i = 0; i < secs / DT; i++) e.step(DT, i * DT, 'keys'); };
const start = (k: never) => { const e = new RiverIntro(k); e.start(); e.onEnd = () => { }; return e; };

describe('the telling waits at the lamp', () => {
  it('holds at the lamp with a prompt to set the light, however long the player takes', () => {
    const { kit: k, shown } = kit(); const e = start(k);
    run(e, 27.5);
    expect(e.waiting).toBe(true); expect(e.t).toBeCloseTo(26.6, 3);
    expect(shown.length).toBe(1); expect(shown[0][0]).toBe('attack'); expect(shown[0][1]).toBe('Set the light');
    run(e, 60);
    expect(e.waiting).toBe(true); expect(e.t).toBeCloseTo(26.6, 3); expect(e.active).toBe(true);
    expect(e.lampVisible).toBe(false);
  });
  it('only the attack press sets the lamp down', () => {
    const { kit: k } = kit(); const e = start(k); run(e, 27.5);
    expect(e.press([{ a: 'dodge', up: false }], 0)).toBe(true);
    expect(e.press([{ a: 'attack', up: true }], 0)).toBe(false);
    expect(e.waiting).toBe(true);
    expect(e.press([{ a: 'attack', up: false }], 0)).toBe(true);
    expect(e.waiting).toBe(false);
  });
  it('after the light, the lamp is set down and the telling goes on into the dark', () => {
    const { kit: k, hides } = kit(); const e = start(k); run(e, 27.5);
    e.press([{ a: 'attack', up: false }], 0); expect(hides()).toBeGreaterThan(0);
    run(e, 0.5); expect(e.lampVisible).toBe(true); expect(e.t).toBeGreaterThan(26.6);
    run(e, 11); expect(e.t).toBeGreaterThan(37); expect(MOONK.value).toBe(0);
  });
  it('a tap on the screen sets the lamp down while it waits', () => {
    const { kit: k } = kit(); const e = start(k); run(e, 27.5);
    e.tap(0); expect(e.waiting).toBe(false); run(e, 0.5); expect(e.lampVisible).toBe(true);
  });
  it('before the lamp, a press skips the telling as it always has', () => {
    const { kit: k } = kit(); const e = start(k); run(e, 3);
    expect(e.press([{ a: 'dodge', up: false }], 0)).toBe(true);
    expect(e.active).toBe(false);
  });
  it('the moon is put out only through the reveal and the close-ups, and comes back after', () => {
    const { kit: k } = kit(); const e = start(k); run(e, 27.5); e.press([{ a: 'attack', up: false }], 0);
    run(e, 12.5); expect(MOONK.value).toBe(0); // t ~ 40
    run(e, 12); expect(MOONK.value).toBe(1);   // t ~ 52
  });
});
