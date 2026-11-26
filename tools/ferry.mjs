// node tools/ferry.mjs : portrait sheet of the Ferryman in both forms (shots_out/ferry_sheet.jpg)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5207 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = [], tiles = [];
for (const [form, q] of [[1, 'nointro&still'], [2, 'nointro&round2&still']]) {
  const p = await b.newPage({ viewport: { width: 960, height: 960 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:5207/?boss=2&tier=high&shot=boss&${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
  await p.evaluate(() => { __f.passive = true; __king.reset(); __king.x = 0; __king.z = -4; __king.yaw = 0; __king.set('idle'); __m.revive(4, 6, Math.PI); document.getElementById('hud').style.display = 'none'; });
  const cams = [['front', [0, 1.7, 1.6], [0, 1.6, -4], 46], ['three', [3.2, 2.2, 0.2], [0, 1.6, -4], 44], ['face', [0.25, 2.2, -1.9], [0, 2.35, -4], 34], ['low', [0.6, 0.6, -1.6], [0, 2.4, -4], 50], ['back', [-2.6, 2.4, -8.8], [0, 1.6, -4], 44]];
  for (const [n, pos, look, fov] of cams) { await p.evaluate(c => { window.__shotCam = c; }, [pos, look, fov]); await p.waitForTimeout(700); tiles.push({ n: form + n, buf: await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(480, 480).toBuffer() }); }
  await p.close();
}
await sharp({ create: { width: 480 * 5, height: 960, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t.buf, left: (i % 5) * 480, top: Math.floor(i / 5) * 480 }))).jpeg({ quality: 86 }).toFile('shots_out/ferry_sheet.jpg');
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok'); await b.close(); await srv.close(); process.exit(0);
