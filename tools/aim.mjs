// node tools/aim.mjs : the Ferryman's aimed blows with the hero off to one side (shots_out/aim.jpg)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';
const srv = await createServer({ server: { port: 5215 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errs = [], tiles = [];
for (const [q, list] of [['nointro&still', [['sounding', 3.6, 1.0, [1.1, 1.8, 2.55]], ['haulIn', 4, 0.8, [1.0, 1.5]], ['lowWater', 4, 1.2, [1.05]]]], ['nointro&round2&still', [['thrust', 3.4, 1.0, [0.5, 0.68]], ['skim', 6, 1.5, [1.08]], ['flurry', 3.2, -1.0, [1.55]]]]]) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:5215/?boss=2&tier=high&${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
  await p.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
  for (const [mode, gap, side, times] of list) {
    await p.evaluate(([mode, gap, side]) => { __f.passive = true; __f.hp = 100; __f.invuln = 99; __f.hazards.length = 0; __king.reset(); __king.x = 0; __king.z = -4; __king.yaw = 0; __f.brain.seen.add(mode); __m.revive(side, -4 + gap, Math.PI); __king.set(mode); window.__shotCam = [[6.5, 2.2, -1.5 + gap * 0.4], [0, 1.2, -4 + gap * 0.5], 50]; }, [mode, gap, side]);
    for (const t of times) { await p.waitForFunction(([m, t]) => __king.mode === m && __king.mt >= t, [mode, t], { timeout: 15000, polling: 4 }).catch(() => {}); tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 88 })).resize(480, 270).composite([{ input: Buffer.from(`<svg width="200" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${mode} ${t}</text></svg>`), left: 0, top: 0 }]).toBuffer()); }
  }
  await p.close();
}
await sharp({ create: { width: 480 * 4, height: 270 * Math.ceil(tiles.length / 4), channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % 4) * 480, top: Math.floor(i / 4) * 270 }))).jpeg({ quality: 84 }).toFile('shots_out/aim.jpg');
console.log(errs.length ? errs.join('|') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
