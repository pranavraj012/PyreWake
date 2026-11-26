// node tools/watch.mjs "<query>" "<setup js>" [seconds=6] [step=0.25] [out=shots_out/watch.jpg] : films a live fight from the follow camera into a contact sheet.
// e.g. node tools/watch.mjs "boss=3&nointro" "__m.revive(0, 9, Math.PI)" 6 0.3
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
fs.mkdirSync('shots_out', { recursive: true });
const [q = 'boss=3&nointro', setup = '', secs = '6', step = '0.25', out = 'shots_out/watch.jpg'] = process.argv.slice(2);
const srv = await createServer({ server: { port: 5221 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = [], tiles = [], p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5221/?tier=high&${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__frames > 5, null, { timeout: 120000 });
if (setup) await p.evaluate(setup);
const t0 = await p.evaluate(() => __f.time);
for (let t = 0; t <= +secs + 1e-6; t += +step) {
  await p.waitForFunction(([a, tt]) => __f.time - a >= tt, [t0, t], { timeout: 60000, polling: 'raf' }).catch(() => { });
  const lab = await p.evaluate(() => `${__king.mode} ${__king.mt.toFixed(2)}`);
  tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 85 })).resize(480, 270).composite([{ input: Buffer.from(`<svg width="480" height="30"><text x="8" y="22" font-size="18" fill="white">${t.toFixed(2)}  ${lab}</text></svg>`), top: 0, left: 0 }]).toBuffer());
}
const cols = 5, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: 480 * cols, height: 270 * rows, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 480, top: Math.floor(i / cols) * 270 }))).jpeg({ quality: 82 }).toFile(out);
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 6).join(' | ') : 'ok', out); await b.close(); await srv.close(); process.exit(0);
