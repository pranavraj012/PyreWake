// node tools/perf.mjs : budget check per tier, plus a keyboard and touch input check. Fails on breach.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const BUDGET = { phone: { draws: 120, tris: 250e3 }, mid: { draws: 180, tris: 450e3 }, high: { draws: 300, tris: 900e3 } };
const srv = await createServer({ server: { port: +(process.env.PORT ?? 5198) }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
let bad = 0; const check = (ok, msg) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', msg); };
for (const tier of ['phone', 'mid', 'high']) {
  const phone = tier === 'phone', ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage(); let bytes = 0; const errs = [];
  p.on('response', async r => { try { if (/baked|\.js|\.css/.test(r.url())) bytes += (await r.body()).length; } catch { } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(p); const t0 = Date.now();
  await p.goto(`http://localhost:${process.env.PORT ?? 5198}/?nointro&tier=${tier}${process.env.Q ? "&" + process.env.Q : ""}${phone ? '&touch' : ''}`);
  await p.waitForFunction(() => window.__frames > 30, null, { timeout: 60000 }); const load = Date.now() - t0;
  if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const before = await p.evaluate(() => window.__pos);
  if (phone) {
    const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await send('touchStart', 120, 280); await send('touchMove', 120, 230);
  } else await p.keyboard.down('w');
  const r = await p.evaluate(() => new Promise(res => { const d = [], c = []; let l = performance.now(), s = l; const f = n => { d.push(n - l); c.push(window.__cpu); l = n; if (n - s < 3000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); c.sort((a, b) => a - b); res({ cpu95: c[Math.floor(c.length * 0.95)], p50: d[d.length >> 1], p95: d[Math.floor(d.length * 0.95)], calls: window.__info.calls, tris: window.__info.triangles, pos: window.__pos, mem: performance.memory?.usedJSHeapSize }); } }; requestAnimationFrame(f); }));
  // worst case in M2: spam attack and dodge next to the king and record the peak
  const peak = await p.evaluate(() => new Promise(res => { let mx = 0, c = [], n = 0, l = performance.now(); const key = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c })); const f = now => { if (n % 14 === 0) { const k = n % 42 === 0 ? 'Space' : 'KeyJ'; key('keydown', k); key('keyup', k); } mx = Math.max(mx, window.__info.triangles); c.push(window.__cpu); l = now; if (++n < 260) requestAnimationFrame(f); else { c.sort((a, b) => a - b); res({ mx, cpu: c[Math.floor(c.length * .95)] }); } }; requestAnimationFrame(f); }));
  r.tris = Math.max(r.tris, peak.mx); r.cpu95 = Math.max(r.cpu95, peak.cpu);
  const moved = Math.hypot(r.pos[0] - before[0], r.pos[2] - before[2]);
  const B = BUDGET[tier];
  check(r.calls <= B.draws, `${tier}: ${r.calls} draws (max ${B.draws})`);
  check(r.tris <= B.tris, `${tier}: ${(r.tris / 1e3) | 0}k peak triangles in combat (max ${B.tris / 1e3}k)`);
  // Phone gate is CPU time per frame: this 144 Hz display quantises frame times to 6.9 ms steps, so they can't be compared with a 60 Hz phone.
  // GPU cost on a phone is NOT measured here; only a real device can.
  if (phone) check(r.cpu95 < 14, `${tier}: draw CPU p95 ${r.cpu95.toFixed(1)} ms at 4x throttle (max 14; frame p50 ${r.p50.toFixed(1)}, p95 ${r.p95.toFixed(1)})`);
  else check(r.p95 < 18, `${tier}: frame p50 ${r.p50.toFixed(1)} ms, p95 ${r.p95.toFixed(1)} ms`);
  check(moved > 1, `${tier}: ${phone ? 'touch joystick' : 'W key'} moved player ${moved.toFixed(1)} m`);
  check(errs.length === 0, `${tier}: no console errors ${errs.slice(0, 2).join(' | ')}`);
  console.log(`     ${tier}: load ${load} ms (dev server), ${(bytes / 1048576).toFixed(1)} MB raw incl. dev modules, JS heap ${((r.mem ?? 0) / 1048576).toFixed(0)} MB`);
  await ctx.close();
}
await b.close(); await srv.close(); process.exit(bad ? 1 : 0);
