// iOS Safari suspends an AudioContext (state "suspended" or "interrupted") when the page is hidden or another app takes the audio. Only a user gesture may start it again, so we retry on the page's own events and on the next touch.
export interface AudioLike { readonly state: string; resume(): Promise<void>; addEventListener(t: 'statechange', f: () => void): void }

/** Keeps `ctx` running and calls `after` each time it comes back to running, and whenever the page is seen again. `after` must be safe to call more than once. */
export function keepAudioAwake(ctx: AudioLike, win: Window, doc: Document, after: () => void): void {
  const resume = () => { if (ctx.state === 'running' || ctx.state === 'closed') return; ctx.resume().catch(() => { /* still interrupted: the next touch tries again */ }); };
  // coming back to running (from a resume, a gesture or the system) re-syncs the music
  ctx.addEventListener('statechange', () => { if (ctx.state === 'running') after(); });
  // a tap is the one thing iOS always accepts: no re-sync here, so fades in progress are not cut by every touch
  for (const e of ['pointerdown', 'touchend', 'keydown'] as const) win.addEventListener(e, resume);
  // coming back: try to resume and re-sync what the page had playing
  const back = () => { if (doc.visibilityState === 'hidden') return; resume(); if (ctx.state === 'running') after(); };
  doc.addEventListener('visibilitychange', back);
  for (const e of ['pageshow', 'focus'] as const) win.addEventListener(e, back);
}
