import { describe, expect, it } from 'vitest';
import { keepAudioAwake, type AudioLike } from '../src/audio/resume.ts';
import { Tracks } from '../src/audio/tracks.ts';

/** Minimal event target: enough for the page events the code listens to. */
class Bus {
  private l = new Map<string, Set<() => void>>();
  addEventListener(t: string, f: () => void) { if (!this.l.has(t)) this.l.set(t, new Set()); this.l.get(t)!.add(f); }
  fire(t: string) { for (const f of [...(this.l.get(t) ?? [])]) f(); }
  count(t: string) { return this.l.get(t)?.size ?? 0; }
}

/** A context that starts interrupted, as an iPhone leaves it after the page was hidden. resume() only works inside a gesture, like iOS. */
class FakeCtx implements AudioLike {
  state: string; resumes = 0; gestured = false; private bus = new Bus();
  constructor(state: string) { this.state = state; }
  addEventListener(t: 'statechange', f: () => void) { this.bus.addEventListener(t, f); }
  async resume() { this.resumes++; if (this.gestured && this.state !== 'closed') this.set('running'); }
  set(s: string) { if (this.state === s) return; this.state = s; this.bus.fire('statechange'); }
}

function rig(state: string, hidden = false) {
  const ctx = new FakeCtx(state), win = new Bus(), doc = new Bus() as Bus & { visibilityState: string };
  doc.visibilityState = hidden ? 'hidden' : 'visible';
  let after = 0; keepAudioAwake(ctx, win as unknown as Window, doc as unknown as Document, () => { after++; });
  return { ctx, win, doc, after: () => after };
}

describe('audio coming back after the page was hidden (iOS interrupts the context)', () => {
  it('a tap resumes an interrupted context and re-syncs once it runs', () => {
    const r = rig('interrupted');
    r.ctx.gestured = true;
    r.win.fire('pointerdown');
    expect(r.ctx.state).toBe('running');
    expect(r.after()).toBe(1);
  });

  it('a tap on a running context does nothing (no re-sync on every touch, so fades are not cut)', () => {
    const r = rig('running');
    r.win.fire('pointerdown'); r.win.fire('touchend'); r.win.fire('keydown');
    expect(r.ctx.resumes).toBe(0);
    expect(r.after()).toBe(0);
  });

  it('coming back to the page resumes and re-syncs; while hidden nothing is tried', () => {
    const r = rig('suspended', true);
    r.doc.fire('visibilitychange');
    expect(r.ctx.resumes).toBe(0);
    r.doc.visibilityState = 'visible'; r.ctx.gestured = true;
    r.doc.fire('visibilitychange');
    expect(r.ctx.state).toBe('running');
    expect(r.after()).toBeGreaterThanOrEqual(1);
  });

  it('a bfcache restore (pageshow) and focus both try again', () => {
    for (const ev of ['pageshow', 'focus'] as const) {
      const r = rig('interrupted');
      r.ctx.gestured = true;
      r.win.fire(ev);
      expect(r.ctx.state, ev).toBe('running');
    }
  });

  it('without a gesture the context stays interrupted and nothing breaks', () => {
    const r = rig('interrupted');
    r.doc.fire('visibilitychange'); r.win.fire('focus'); r.win.fire('pageshow');
    expect(r.ctx.state).toBe('interrupted');
    expect(r.ctx.resumes).toBeGreaterThan(0);
  });

  it('a closed context is left alone', () => {
    const r = rig('closed');
    r.win.fire('pointerdown');
    expect(r.ctx.resumes).toBe(0);
  });
});

/** Recorded-music decks with the element state the browser would give. */
class FakeEl {
  paused = true; playbacks = 0; src = ''; preload = ''; currentTime = 0; readyState = 4; playbackRate = 1; duration = 100; playsInline = false;
  addEventListener() { /* ready at once */ }
  play() { if (!this.paused) return Promise.resolve(); this.paused = false; this.playbacks++; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const g = globalThis as unknown as Record<string, unknown>;
function fakeAudioGlobals(els: FakeEl[]) {
  g.Audio = class { constructor() { const e = new FakeEl(); els.push(e); return e as unknown as object; } };
}
function fakeTracksCtx() {
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ gain: param(), frequency: param(), connect() { return node(); } });
  return { currentTime: 0, createMediaElementSource: () => node(), createGain: node, createBiquadFilter: node } as unknown as AudioContext;
}

describe('the music after the page comes back', () => {
  it('re-syncs the playing piece exactly once, and never starts a second one', () => {
    const els: FakeEl[] = []; fakeAudioGlobals(els);
    const t = new Tracks(fakeTracksCtx(), fakeTracksCtx() as unknown as AudioNode);
    (t as unknown as { urls: Map<string, string>; primed: boolean }).urls.set('king', 'blob:king');
    (t as unknown as { primed: boolean }).primed = true;
    t.set('king', 1, 20000, 0);
    const playing = els.find(e => !e.paused)!;
    expect(playing).toBeDefined();
    const before = playing.playbacks;
    t.hush(true);
    expect(playing.paused).toBe(true);
    t.hush(false); t.resync(); t.resync();
    expect(playing.paused).toBe(false);
    expect(playing.playbacks).toBe(before + 1);
    expect(els.filter(e => !e.paused)).toHaveLength(1);
  });

  it('a piece that was fading out does not come back', () => {
    const els: FakeEl[] = []; fakeAudioGlobals(els);
    const t = new Tracks(fakeTracksCtx(), fakeTracksCtx() as unknown as AudioNode);
    const u = t as unknown as { urls: Map<string, string>; primed: boolean; cur: unknown };
    u.urls.set('king', 'blob:a'); u.urls.set('hang', 'blob:b'); u.primed = true;
    t.set('king', 1, 20000, 0); t.set('hang', 1, 20000, 0);
    t.hush(true); t.hush(false);
    expect(els.filter(e => !e.paused)).toHaveLength(1);
  });
});
