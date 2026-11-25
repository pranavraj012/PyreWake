/** Fixed 60 Hz simulation with interpolated rendering. */
export const STEP = 1 / 60;
export function startLoop(sim: (dt: number) => void, draw: (alpha: number, frameMs: number) => void) {
  let last = performance.now(), acc = 0, raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const ms = now - last; last = now;
    if (document.hidden) return;
    acc = Math.min(acc + ms / 1000, STEP * 4);
    while (acc >= STEP) { sim(STEP); acc -= STEP; }
    draw(acc / STEP, ms);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
