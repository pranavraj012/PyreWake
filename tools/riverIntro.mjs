// node tools/riverIntro.mjs [--phone] : films the Ferryman's intro into a contact sheet (shots_out/river_intro_sheet.jpg)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
const phone = process.argv.includes('--phone'); fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5209 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } }), p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
await p.goto(`http://localhost:5209/?boss=2&tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 }); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#menu [data-b=play]').click());
const times = [0.6, 5.2, 7.8, 9.0, 10.6, 11.4, 12.4, 13.4, 14.5, 15.4, 16.2, 17.2, 18.2, 19.0, 19.8, 20.6, 21.8, 22.4, 22.8, 23.4, 24.6, 25.6, 26.2, 26.6], W = 480, H = 270, c = [];
for (let i = 0; i < times.length; i++) {
  try { await p.waitForFunction(t => __intro.t >= t, times[i], { timeout: 60000, polling: 4 }); } catch { console.log('stuck', await p.evaluate(() => [__intro.t, __intro.active, __f.phase]), errs.join(' | ')); process.exit(1); }
  const img = await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="90" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${times[i]}</text></svg>`), left: 0, top: 0 }]).toBuffer();
  c.push({ input: img, left: (i % 4) * W, top: Math.floor(i / 4) * H });
}
await sharp({ create: { width: 4 * W, height: Math.ceil(times.length / 4) * H, channels: 3, background: '#000' } }).composite(c).jpeg({ quality: 86 }).toFile(`shots_out/${phone ? 'phone_' : ''}river_intro_sheet.jpg`);
await p.waitForFunction(() => !__intro.active, null, { timeout: 30000 }); await p.waitForTimeout(1200); await p.screenshot({ path: 'shots_out/river_after_intro.jpg', type: 'jpeg', quality: 84 });
console.log('after:', await p.evaluate(() => `${__f.phase} passive=${__f.passive} hp=${__f.hp} boss ${__king.x.toFixed(1)},${__king.y.toFixed(2)},${__king.z.toFixed(1)} ${__king.mode} hero ${__m.z.toFixed(1)}`));
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
