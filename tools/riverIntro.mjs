// node tools/riverIntro.mjs [--phone] : films the Ferryman's intro into a contact sheet. Desktop 1280x800 (shots_out/river_intro_sheet.jpg); --phone 844x390 landscape, the phone layout (shots_out/phone_river_intro_sheet.jpg); portrait shows the turn-sideways screen
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
const phone = process.argv.includes('--phone'); fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5209 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const errs = [], ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } }), p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
await p.goto(`http://localhost:5209/?boss=2&tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 }); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#menu [data-b=play]').click());
const times = [2, 7, 12, 17, 22, 26, 28.5, 31, 33.5, 35.5, 36.8, 37.4, 38.6, 39.6, 40.8, 42.5, 44.6, 46.6, 48.4, 49.5, 50.4, 51.2, 52.4, 53.2], W = phone ? 281 : 480, H = phone ? 130 : 300, c = [];
let pressed = false; const holds = [];
for (let i = 0; i < times.length; i++) {
  try { await p.waitForFunction(t => __intro.t >= t || __intro.waiting, times[i], { timeout: 60000, polling: 4 }); } catch { console.log('stuck', await p.evaluate(() => [__intro.t, __intro.active, __f.phase]), errs.join(' | ')); process.exit(1); }
  // the lamp holds until the player sets it down: film the hold, then press
  if (!pressed && await p.evaluate(() => __intro.waiting)) {
    for (const label of ['set the light: hold', 'hold +2.5s']) { await p.waitForTimeout(label.includes('+') ? 2500 : 1200); const im = await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="200" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${label}</text></svg>`), top: 0, left: 0 }]).toBuffer(); holds.push({ input: im, left: (holds.length % 4) * W, top: Math.floor(holds.length / 4) * H }); }
    if (phone) await p.touchscreen.tap(422, 195); else await p.keyboard.press('KeyJ');
    pressed = true; await p.waitForFunction(() => !__intro.waiting, null, { timeout: 15000 }).catch(() => { });
    await p.waitForFunction(t => __intro.t >= t, times[i], { timeout: 60000, polling: 4 }).catch(() => { });
  }
  const img = await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="90" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${times[i]}</text></svg>`), left: 0, top: 0 }]).toBuffer();
  c.push({ input: img, left: (i % 4) * W, top: Math.floor(i / 4) * H });
}
await sharp({ create: { width: 4 * W, height: Math.ceil(times.length / 4) * H, channels: 3, background: '#000' } }).composite(c).jpeg({ quality: 86 }).toFile(`shots_out/${phone ? 'phone_' : ''}river_intro_sheet.jpg`);
if (holds.length) await sharp({ create: { width: 4 * W, height: Math.ceil(holds.length / 4) * H, channels: 3, background: '#000' } }).composite(holds).jpeg({ quality: 86 }).toFile(`shots_out/${phone ? 'phone_' : ''}river_intro_hold.jpg`);
await p.waitForFunction(() => !__intro.active, null, { timeout: 30000 }); await p.waitForTimeout(1200); await p.screenshot({ path: 'shots_out/river_after_intro.jpg', type: 'jpeg', quality: 84 });
console.log('after:', await p.evaluate(() => `${__f.phase} passive=${__f.passive} hp=${__f.hp} boss ${__king.x.toFixed(1)},${__king.y.toFixed(2)},${__king.z.toFixed(1)} ${__king.mode} hero ${__m.z.toFixed(1)}`));
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
