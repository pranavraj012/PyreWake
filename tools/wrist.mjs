// node tools/wrist.mjs : close-ups of the hero's sword wrist while running and attacking (shots_out/wrist.jpg)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';
const srv = await createServer({ server: { port: 5217 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 480 } }), errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5217/?boss=2&tier=high&nointro&still'); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
await p.evaluate(() => { __f.passive = true; __king.z = -30; document.getElementById('hud').style.display = 'none'; __m.revive(-6, 12, Math.PI);
  window.__side = 'R'; setInterval(() => { const r = __pv.rig, h = r.bones[r.i('hand.' + __side)].getWorldPosition(r.pos[0].clone()), y = __m.yaw, s = __side === 'R' ? -1 : 1, rx = Math.cos(y) * s, rz = -Math.sin(y) * s; window.__shotCam = [[h.x + rx * 0.55 + Math.sin(y) * 0.25, h.y + 0.12, h.z + rz * 0.55 + Math.cos(y) * 0.25], [h.x, h.y, h.z], 42]; }, 4); });
const tiles = [], snap = async l => tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 88 })).resize(320, 240).composite([{ input: Buffer.from(`<svg width="160" height="20"><text x="4" y="15" font-size="13" fill="#fd6">${l}</text></svg>`), left: 0, top: 0 }]).toBuffer());
await p.keyboard.down('KeyW'); await p.waitForTimeout(900); for (let i = 0; i < 8; i++) { await snap('run R'); await p.waitForTimeout(45); }
await p.keyboard.down('KeyD'); for (let i = 0; i < 4; i++) { await snap('turn R'); await p.waitForTimeout(60); } await p.keyboard.up('KeyD'); await p.keyboard.up('KeyW');
await p.evaluate(() => { window.__side = 'L'; }); await p.keyboard.down('KeyW'); await p.waitForTimeout(700); for (let i = 0; i < 4; i++) { await snap('run L'); await p.waitForTimeout(60); } await p.keyboard.up('KeyW');
await p.evaluate(() => { window.__side = 'R'; }); await p.waitForTimeout(600); await p.keyboard.press('KeyJ'); for (let i = 0; i < 4; i++) { await snap('attack'); await p.waitForTimeout(70); } await p.waitForTimeout(150); await p.keyboard.press('KeyJ'); for (let i = 0; i < 4; i++) { await snap('attack 2'); await p.waitForTimeout(70); }
await sharp({ create: { width: 320 * 8, height: 240 * Math.ceil(tiles.length / 8), channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % 8) * 320, top: Math.floor(i / 8) * 240 }))).jpeg({ quality: 84 }).toFile('shots_out/wrist.jpg');
console.log(tiles.length, errs.length ? errs.join('|') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
