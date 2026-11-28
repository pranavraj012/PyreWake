// The Ferryman's way out (module A): the scene holds at the boat until the hero lights it, and no timeout does it for them.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

// the scene touches the page only through `document` (a canvas for the flame, the cine class)
const g = globalThis as unknown as { document?: unknown };
g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() { } }), fillRect() { }, fillStyle: '' }) }), body: { classList: { add() { }, remove() { } } } };
const { RiverEnding, END_LEN } = await import('../src/bosses/river/riverScenes.ts');

const DT = 1 / 60;
function kit() {
  const shown: [string, string, number, string][] = []; let hides = 0;
  const kit = {
    f: { m: { x: 0, z: 0 }, sceneMove: { x: 0, z: 0 }, king: { x: 0, z: -9, y: 0 } },
    k2: { boat() { }, standing() { } },
    fx: { sparks: { emit() { } }, bursts: { add() { } }, puffs: { emit() { } } },
    hud: { verse() { }, say() { }, won() { } },
    ghats: { group: new THREE.Group(), lamps() { }, setFront() { }, ripple() { }, flames() { }, setOut() { } },
    prompt: { show(a: string, t: string, s: number, d: string) { shown.push([a, t, s, d]); }, hide() { hides++; } },
  };
  return { kit: kit as never, shown, hides: () => hides };
}
const run = (e: { step(dt: number, t: number, d?: string): void }, secs: number) => { for (let i = 0; i < secs / DT; i++) e.step(DT, i * DT, 'keys'); };

describe('the way out waits for the light', () => {
  it('holds at the boat with a prompt, however long the player takes', () => {
    const { kit: k, shown } = kit(); const e = new RiverEnding(k); e.start();
    run(e, 33.5);
    expect(e.waiting).toBe(true); expect(e.t).toBeCloseTo(32.6, 3);
    expect(shown.length).toBe(1); expect(shown[0][0]).toBe('attack'); expect(shown[0][1]).toBe('Light the boat');
    run(e, 60); // a minute on the boat: nothing lights it, the scene does not move on
    expect(e.waiting).toBe(true); expect(e.t).toBeCloseTo(32.6, 3); expect(e.over).toBe(false);
  });
  it('only the light gets past the hold; other presses do nothing', () => {
    const { kit: k } = kit(); const e = new RiverEnding(k); e.start(); run(e, 34);
    expect(e.press([{ a: 'dodge', up: false }], 0)).toBe(true);
    expect(e.press([{ a: 'attack', up: true }], 0)).toBe(false); // a release is not a press
    expect(e.waiting).toBe(true);
    expect(e.press([{ a: 'attack', up: false }], 0)).toBe(true);
    expect(e.waiting).toBe(false);
  });
  it('after the light the scene goes on to the end', () => {
    const { kit: k, hides } = kit(); const e = new RiverEnding(k); e.start(); run(e, 34);
    e.press([{ a: 'attack', up: false }], 0); expect(hides()).toBeGreaterThan(0);
    run(e, 1.5); expect(e.t).toBeGreaterThan(33.5); expect(e.front).toBeGreaterThan(0);
    run(e, 20); expect(e.over).toBe(true);
  });
  it('before the boat, a press skips the whole scene as it always has', () => {
    const { kit: k } = kit(); const e = new RiverEnding(k); e.start(); run(e, 5);
    expect(e.press([{ a: 'move', up: false } as never], 0)).toBe(true);
    run(e, 0.1); expect(e.over).toBe(true); expect(e.waiting).toBe(false);
  });
  it('stop() clears the hold', () => {
    const { kit: k, hides } = kit(); const e = new RiverEnding(k); e.start(); run(e, 34); e.stop();
    expect(e.waiting).toBe(false); expect(e.active).toBe(false); expect(hides()).toBeGreaterThan(0);
  });
  it('the scene ends at END_LEN', () => { expect(END_LEN).toBe(47); });
});
