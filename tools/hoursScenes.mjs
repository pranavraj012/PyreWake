// node tools/hoursScenes.mjs intro|turn|ending [t...] : contact sheet of a Waiting House scene at the given seconds (shots_out/hours_scene_<name>.jpg).
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
fs.mkdirSync('shots_out', { recursive: true });
const [name = 'intro', ...ts] = process.argv.slice(2), times = ts.length ? ts.map(Number) : [1, 3, 5, 8, 10.5, 12, 13, 14.5];
const srv = await createServer({ server: { port: 5215 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = [], tiles = []; const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const q = name === 'intro' ? '' : name === 'turn' ? '&turn' : '&round2&nointro';
await p.goto(`http://localhost:5215/?boss=3&tier=high${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__frames > 5, null, { timeout: 120000 });
const S = { intro: '__intro', turn: '__turn', ending: '__ending' }[name];
if (name === 'intro') await p.evaluate(() => document.querySelector('[data-b=play]').click());
if (name === 'turn') await p.evaluate(() => { __f.passive = false; __m.revive(0, 1, Math.PI); });
if (name === 'ending') await p.evaluate(() => { __f.passive = true; __f.bossHp = 1; __king.set('idle'); __f.hits = 9; });
// the turn begins when round 1's last blow lands; the ending when round 2's does: deal it
if (name !== 'intro') await p.evaluate(() => { const f = __f; f.bossHp = 0.5; const k = __king; k.set(k.downMode ?? 'fall'); }).catch(() => { });
if (name === 'turn') await p.evaluate(() => { __turn.start(); });
if (name === 'ending') await p.evaluate(() => { __king.set('die'); __ending.start(); });
for (const t of times) {
  await p.waitForFunction(([s, tt]) => window[s].t >= tt, [S, t], { timeout: 60000, polling: 'raf' }).catch(() => { });
  tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 88 })).resize(480, 270).composite([{ input: Buffer.from(`<svg width="480" height="30"><text x="8" y="22" font-size="18" fill="white">${name} ${t}</text></svg>`), top: 0, left: 0 }]).toBuffer());
}
const cols = 4, rows = Math.ceil(tiles.length / cols), out = `shots_out/hours_scene_${name}.jpg`;
await sharp({ create: { width: 480 * cols, height: 270 * rows, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 480, top: Math.floor(i / cols) * 270 }))).jpeg({ quality: 85 }).toFile(out);
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 6).join(' | ') : 'ok', out); await b.close(); await srv.close(); process.exit(0);
