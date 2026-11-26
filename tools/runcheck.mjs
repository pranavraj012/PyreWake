// node tools/runcheck.mjs : real keyboard run, hard turns and a stop, filmed from the game camera (shots_out/runcheck.jpg)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';
const srv = await createServer({ server: { port: 5213 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5213/?boss=2&tier=high&nointro&still'); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -14; document.getElementById('hud').style.display = 'none'; __m.revive(0, 8, Math.PI); });
const shots = [], snap = async l => shots.push({ l, b: await sharp(await p.screenshot({ type: 'jpeg', quality: 85 })).resize(480, 270).toBuffer() });
const plan = [['KeyW', 700, 'run'], ['KeyD', 450, 'turn right'], ['KeyA', 500, 'turn left'], ['KeyS', 500, 'about'], [null, 500, 'stop']];
for (const [k, ms, l] of plan) { if (k) await p.keyboard.down(k); const t0 = Date.now(); while (Date.now() - t0 < ms) { await snap(l); } if (k) await p.keyboard.up(k); }
const n = Math.min(32, shots.length), pick = Array.from({ length: n }, (_, i) => shots[Math.floor(i * shots.length / n)]);
await sharp({ create: { width: 480 * 8, height: 270 * Math.ceil(n / 8), channels: 3, background: '#000' } }).composite(pick.map((s, i) => ({ input: s.b, left: (i % 8) * 480, top: Math.floor(i / 8) * 270 }))).jpeg({ quality: 82 }).toFile('shots_out/runcheck.jpg');
console.log(shots.length, 'frames', errs.length ? errs.join('|') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
