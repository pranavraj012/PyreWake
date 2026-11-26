// node tools/riverEnding.mjs [phone]: films the Ferryman's way out. It holds at the boat, the hero lights it with the attack press (a tap on phone), and the fire runs on.
// Writes shots_out/river_ending_sheet.jpg (or phone_river_ending_sheet.jpg), with the hold and the press.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
const phone = process.argv.includes('--phone'); fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5217 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = [], ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } }), p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
await p.goto(`http://localhost:5217/?boss=2&tier=${phone ? 'phone' : 'high'}&round2&nointro${phone ? '&touch' : ''}`);
await p.waitForFunction(() => document.body.classList.contains('ready') && window.__frames > 5, null, { timeout: 120000 });
// the fight is won: the way out begins
await p.evaluate(() => { __f.passive = true; __f.bossHp = 1; __king.set('idle'); __f.hits = 9; __king.set('die'); __ending.start(); });
const W = phone ? 390 : 480, H = phone ? 844 : 270, cols = phone ? 4 : 3, tiles = [];
const shot = async (label, cap = 0.5) => { tiles.push(await sharp(await p.screenshot({ type: 'jpeg', quality: 88 })).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="${W}" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${label}</text></svg>`), top: 0, left: 0 }]).toBuffer()); };
for (const t of [2, 12, 22, 27, 30, 32]) { await p.waitForFunction(x => __ending.t >= x, t, { timeout: 60000, polling: 'raf' }).catch(() => { }); await shot('t ' + t); }
// the hold: the flame waits, the prompt shows; time passes and nothing moves on
await p.waitForFunction(() => __ending.waiting, null, { timeout: 60000, polling: 'raf' });
await p.waitForTimeout(1500); await shot('hold'); await p.waitForTimeout(2500); await shot('hold +4s');
const holdT = await p.evaluate(() => __ending.t);
// the press
if (phone) await p.locator('.tb-attack').tap(); else await p.keyboard.press('KeyJ');
await p.waitForFunction(() => !__ending.waiting, null, { timeout: 15000 }).catch(() => { });
for (const x of [0.25, 0.7, 1.6, 4.5, 9]) { await p.waitForTimeout(x * 1000 - (x === 0.25 ? 0 : 0)); await shot('lit +' + x + 's'); }
const full = await p.evaluate(() => ({ t: __ending.t, over: __ending.over, waiting: __ending.waiting }));
const out = `shots_out/${phone ? 'phone_' : ''}river_ending_sheet.jpg`, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * W, top: Math.floor(i / cols) * H }))).jpeg({ quality: 86 }).toFile(out);
console.log('hold at', holdT.toFixed(2), 'after press', JSON.stringify(full)); console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors', out);
await b.close(); await srv.close(); process.exit(0);
