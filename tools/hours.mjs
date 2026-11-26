// node tools/hours.mjs [form] [mode] [t...] : portraits of the Sister / the Pall (shots_out/hours_sheet.jpg). With a mode, films that move at the given times.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
fs.mkdirSync('shots_out', { recursive: true });
const [form = '1', mode = '', ...ts] = process.argv.slice(2), tier = process.env.TIER ?? 'high';
const srv = await createServer({ server: { port: 5213 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = [], tiles = [];
const p = await b.newPage({ viewport: { width: 960, height: 960 } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5213/?boss=3&tier=${tier}&shot=boss&nointro&still${form === '2' ? '&round2' : ''}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 120000 });
await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -4; __king.yaw = 0; __king.set('idle'); __m.revive(0.5, 3, Math.PI); document.getElementById('hud').style.display = 'none'; });
const H = form === '2' ? 2.6 : 1.6, D = form === '2' ? 2.4 : 1;
const cams = JSON.parse(process.env.CAMS ?? 'null') ?? [['front', [0, H, -4 + 5 * D], [0, H, -4], 46], ['three', [3.6 * D, H + 0.6, -4 + 3.4 * D], [0, H, -4], 44], ['face', [0.35, 2.55 + (form === '2' ? 2.9 : 0), -4 + 1.6 * D], [0, 2.4 + (form === '2' ? 2.9 : 0), -4], 34], ['side', [5 * D, H, -4], [0, H, -4], 44], ['back', [-2.6 * D, H + 0.8, -4 - 4.8 * D], [0, H, -4], 44]];
if (!mode) {
  for (const [n, pos, look, fov] of cams) { await p.evaluate(c => { window.__shotCam = c; }, [pos, look, fov]); await p.waitForTimeout(900); tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(480, 480).toBuffer()); }
} else {
  const cam = process.env.CAMS1 ? JSON.parse(process.env.CAMS1) : cams[+(process.env.CAM ?? 1)]; await p.evaluate(c => { window.__shotCam = c; }, [cam[1], cam[2], cam[3]]);
  for (const t of ts.map(Number)) {
    await p.evaluate(tt => { window.__T = tt; }, t);
    await p.evaluate(([md]) => { __f.invuln = 99; __f.hazards.length = 0; window.__freezeAt = undefined; __king.x = 0; __king.z = -4; __king.yaw = 0; __m.revive(+(window.HX ?? 0.5), +(window.HZ ?? 3), Math.PI); __king.set(md); window.__freezeAt = window.__T; }, [mode]);
    await p.waitForFunction(tt => __king.mt >= tt || __king.mode === 'idle', t, { timeout: 30000, polling: 'raf' }).catch(() => { }); await p.waitForTimeout(400);
    tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(480, 480).composite([{ input: Buffer.from(`<svg width="480" height="40"><text x="10" y="28" font-size="22" fill="white">${mode} ${t}</text></svg>`), top: 0, left: 0 }]).toBuffer()); }
}
const cols = Math.min(5, tiles.length), rows = Math.ceil(tiles.length / cols), out = `shots_out/hours_${form}${mode ? '_' + mode : ''}.jpg`;
await sharp({ create: { width: 480 * cols, height: 480 * rows, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 480, top: Math.floor(i / cols) * 480 }))).jpeg({ quality: 86 }).toFile(out);
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 8).join(' | ') : 'ok', out); await b.close(); await srv.close(); process.exit(0);
