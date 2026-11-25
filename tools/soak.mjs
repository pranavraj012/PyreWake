// node tools/soak.mjs [--phone] [--secs=90] : a bot plays the real build with real key events. Reports hitches, leaks, stuck states and the triangle bill.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const phone = process.argv.includes('--phone'), q = process.argv.find(a => a.startsWith('--q='))?.slice(4) ?? '', secs = +(process.argv.find(a => a.startsWith('--secs='))?.slice(7) ?? 90);
const srv = await createServer({ server: { port: 5192 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5 } : { viewport: { width: 1600, height: 900 } }), errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => (m.type() === 'error' || /THREE|WebGL/.test(m.text())) && errs.push(m.text().slice(0, 300)));
await p.goto(`http://localhost:5192/?nointro&tier=${phone ? 'phone' : 'high'}&${q}`); await p.waitForFunction(() => window.__frames > 60, null, { timeout: 60000 });
const r = await p.evaluate(secs => new Promise(res => {
  const key = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c })), tap = c => { key('keydown', c); setTimeout(() => key('keyup', c), 60); };
  const st = performance.now(), long = []; new PerformanceObserver(l => { for (const e of l.getEntries()) long.push([+((e.startTime - st) / 1000).toFixed(1), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); const hitch = [], clips = {}, modes = {}, mem = []; let last = st, n = 0, tris = 0, calls = 0, pos = [0, 0], still = 0, stuck = 0, dead = 0, wasDead = false, next = 0, w = false, cue = 0, act = false, serial = -1, far = 0, lastMem = 0, cpu = [], lv = [], apk = 0, camIn = 0, camLow = 9;
  const f = now => {
    const ms = now - last; last = now; n++; const m = __m, k = __king, F = __f, t = (now - st) / 1000; tris = Math.max(tris, __info.triangles); calls = Math.max(calls, __info.calls); cpu.push(__cpu);
    const what = m.clip?.name ?? 'free'; if (ms > 34) hitch.push([+t.toFixed(1), Math.round(ms), what, k.mode]); clips[what] = (clips[what] ?? 0) + 1; modes[k.mode] = (modes[k.mode] ?? 0) + 1;
    if (t - lastMem > 10) { lastMem = t; mem.push(Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576)); }
    if (m.dead && !wasDead) dead++; wasDead = m.dead; if (!Number.isFinite(m.x + m.z + k.x + k.z)) stuck += 1000;
    { const S = window.__sound; if (S?.ctx && !S.__an) { S.__an = S.ctx.createAnalyser(); S.__an.fftSize = 2048; S.bus.sfx.context; S.duckG.connect(S.__an); S.bus.sfx.connect(S.__an); S.bus.voice.connect(S.__an); S.__b = new Float32Array(2048); } if (S?.__an && n % 6 === 0) { S.__an.getFloatTimeDomainData(S.__b); let s = 0; for (const v of S.__b) { s += v * v; apk = Math.max(apk, Math.abs(v)); } const db = 10 * Math.log10(s / 2048 + 1e-9); lv.push(db); } }
    const c = __camPos?.(); if (c) { if (Math.hypot(c[0] - k.x, c[2] - k.z) < 1.2) camIn++; camLow = Math.min(camLow, c[1]); }
    const d = m.targetDist; if (d > 2.4 && !w) { key('keydown', 'KeyW'); w = true; } else if (d < 2.0 && w) { key('keyup', 'KeyW'); w = false; }
    if (w && Math.hypot(m.x - pos[0], m.z - pos[1]) < 0.002 && m.state === 'free') { if (++still > 90) { stuck++; still = 0; } } else still = 0; pos = [m.x, m.z]; far = Math.max(far, d);
    if (k.serial !== serial) { serial = k.serial; act = Math.random() < 0.65; cue = k.strikes?.[0] ? k.strikes[0].t[0] - 0.15 : 99; }
    if (k.strikes?.length && act && k.mt > cue) { act = false; const r = Math.random(); if (r < 0.55) tap('Space'); else if (r < 0.85 && k.mode !== 'grab') { key('keydown', 'KeyK'); setTimeout(() => key('keyup', 'KeyK'), 900); } else tap('KeyQ'); }
    else if (now > next) { next = now + 110 + Math.random() * 90; const r = Math.random(); if (F.hp < 40 && F.heals) tap('KeyF'); else if (r < 0.04) tap('KeyQ'); else if (r < 0.08) { key('keydown', 'KeyJ'); setTimeout(() => key('keyup', 'KeyJ'), 500); next = now + 600; } else if (r < 0.1) tap('Space'); else tap('KeyJ'); }
    if (t < secs) requestAnimationFrame(f); else { cpu.sort((a, b) => a - b); res({ long, frames: n, fps: Math.round(n / secs), hitch, clips, modes, mem, tris, calls, stuck, dead, far: +far.toFixed(1), camIn, camLow: +camLow.toFixed(2), cpu95: +cpu[Math.floor(cpu.length * .95)].toFixed(2), round: F.round, phase: F.phase, sounds: window.__sound?.bufs.size, mixDb: lv.length ? { median: +lv.sort((a, b) => a - b)[lv.length >> 1].toFixed(1), loud: +lv[Math.floor(lv.length * 0.97)].toFixed(1), quiet: +lv[Math.floor(lv.length * 0.1)].toFixed(1), peakBeforeLimiter: +apk.toFixed(2) } : null }); }
  }; requestAnimationFrame(f);
}), secs);
console.log(JSON.stringify({ ...r, hitch: r.hitch.length, long: undefined, clips: undefined, modes: undefined }));
console.log('hitches [s, ms, player, king]', JSON.stringify(r.hitch.slice(0, 16)));
console.log('main-thread tasks over 50 ms [s, ms]', JSON.stringify(r.long.slice(0, 16)), '(a hitch with no task here is GPU or OS)');
console.log('player clips', Object.keys(r.clips).sort().join(' ')); console.log('king modes', Object.keys(r.modes).join(' '));
console.log('triangles by object:'); for (const l of await p.evaluate(() => window.__bill?.() ?? ['no __bill'])) console.log('  ', l);
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].slice(0, 5).join(' | ') : 'no errors'); await b.close(); await srv.close();
