// How much of the page can really be seen. Phones change it under us: address bars, leaving full screen, coming back from another app.
const subs: (() => void)[] = []; let w = 0, h = 0;
export const viewport = () => ({ w: w || innerWidth, h: h || innerHeight });
function measure() {
  const v = window.visualViewport, zoomed = !!v && Math.abs(v.scale - 1) > 0.01; const nw = Math.round(!v || zoomed ? innerWidth : Math.min(v.width, innerWidth)), nh = Math.round(!v || zoomed ? innerHeight : Math.min(v.height, innerHeight));
  if (nw === w && nh === h || !nw || !nh) return; w = nw; h = nh; const s = document.documentElement.style; s.setProperty('--vw', w + 'px'); s.setProperty('--vh', h + 'px'); if (scrollX || scrollY) scrollTo(0, 0); for (const f of subs) f();
}
// the size is often still the old one when the event arrives
const soon = () => { measure(); for (const t of [60, 250, 700]) setTimeout(measure, t); };
for (const e of ['resize', 'orientationchange', 'pageshow', 'focus']) addEventListener(e, soon); for (const e of ['visibilitychange', 'fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(e, soon); window.visualViewport?.addEventListener('resize', soon);
export function onViewport(f: () => void) { subs.push(f); }
measure();
