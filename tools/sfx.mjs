// node tools/sfx.mjs : renders every sound effect offline and reports peak, loudness, length and brightness.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const srv = await createServer({ server: { port: 5190 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
await p.goto('http://localhost:5190/LICENSES.md');
const rows = await p.evaluate(async () => {
  let last; window.AudioContext = class extends OfflineAudioContext { constructor() { super(1, 48000 * 3, 48000); last = this; } };
  const names = Object.keys((await import('/src/audio/sfx.ts')).sfx), out = [];
  for (const n of names) for (const pw of /^(swing|hit)$/.test(n) ? [1, 2.9] : [1]) {
    const m = await import('/src/audio/sfx.ts?v=' + n + (pw > 1 ? 'H' : 'L')); m.unlockAudio(); m.sfx[n](pw); const d = (await last.startRendering()).getChannelData(0);
    let pk = 0, e = 0, zc = 0, end = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); pk = Math.max(pk, a); e += a * a; if (a > 0.004) end = i; } for (let i = 1; i < end; i++) if ((d[i] > 0) !== (d[i - 1] > 0)) zc++;
    // loudest 100 ms
    let w = 0, best = 0; for (let i = 0; i < d.length; i++) { w += d[i] * d[i]; if (i >= 4800) w -= d[i - 4800] * d[i - 4800]; best = Math.max(best, w); }
    out.push([n + (pw > 1 ? ' (heavy)' : ''), pk.toFixed(2), (10 * Math.log10(best / 4800 + 1e-9)).toFixed(1) + ' dB', (end / 48000).toFixed(2) + ' s', Math.round(zc / 2 / (end / 48000 || 1)) + ' Hz']);
  }
  return out;
});
for (const r of rows) console.log(r[0].padEnd(16), 'peak', r[1], ' loudest', r[2].padStart(9), ' length', r[3], ' centre', r[4]);
await b.close(); await srv.close();
