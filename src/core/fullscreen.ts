// Full screen, with the older WebKit spelling, and a landscape lock where the browser allows one.
type Doc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type El = HTMLElement & { webkitRequestFullscreen?: () => void };
const d = document as Doc, el = document.documentElement as El;
/** False on iPhone browsers, which have no full screen for pages: the button is hidden there. */
export const canFullscreen = !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
export const isFullscreen = () => !!(d.fullscreenElement ?? d.webkitFullscreenElement);
let wanted = false;
/** On a phone, leaving the browser drops full screen: take it back with the next tap that resumes play. */
export function regainFullscreen() { if (wanted && !isFullscreen() && matchMedia('(pointer: coarse)').matches) void setFullscreen(true); }
/** Must be called from a click, tap or key press. */
export async function setFullscreen(on: boolean) {
  wanted = on;
  try {
    if (on && !isFullscreen()) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' }); else el.webkitRequestFullscreen?.();
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => { });
    } else if (!on && isFullscreen()) { if (d.exitFullscreen) await d.exitFullscreen(); else d.webkitExitFullscreen?.(); }
  } catch { /* refused by the browser */ }
}
export function onFullscreen(f: () => void) { for (const e of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(e, f); }
// Alt+Enter, the usual shortcut
addEventListener('keydown', e => { if (e.altKey && e.code === 'Enter') { e.preventDefault(); void setFullscreen(!isFullscreen()); } });
