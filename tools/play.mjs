// node tools/play.mjs [--phone] : plays a scripted session with real input and captures key moments into shots_out/
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
const phone = process.argv.includes('--phone'), tag = phone ? 'phone_' : ''; fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5194 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = async n => { await p.screenshot({ path: `shots_out/${tag}play_${n}.jpg`, type: 'jpeg', quality: 86 }); console.log(n, JSON.stringify(await p.evaluate(() => ({ clip: window.__m.clip?.name, speed: +window.__m.speed.toFixed(1), king: window.__king.mode, fps: document.getElementById('fps').textContent })))); };
const until = (f, a) => p.waitForFunction(f, a, { timeout: 15000, polling: 16 });
await p.goto(`http://localhost:5194/?tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}`); await until(() => document.body.classList.contains('ready'));
await p.waitForTimeout(1500); await shot('intro1'); await p.waitForTimeout(2300); await shot('intro2'); await p.waitForTimeout(2400); await shot('intro3'); await p.waitForTimeout(1600);
const cdp = await ctx.newCDPSession(p);
if (!phone) {
  await p.keyboard.down('w'); await p.waitForTimeout(900); await shot('run'); await p.keyboard.up('w');
  for (const [n, t] of [['light1', 0.2], ['light2', 0.2], ['light3', 0.3], ['light4', 0.36], ['light5', 0.56]]) {
    const iv = setInterval(() => p.keyboard.press('j').catch(() => { }), 90); try { await until(([n, t]) => window.__m.clip?.name === n && window.__m.t >= t, [n, t]); } catch { errs.push('never reached ' + n); } clearInterval(iv); await shot(n);
  }
  await p.waitForTimeout(1500);
  await p.keyboard.down('d'); await p.keyboard.press('Space'); await until(() => /dodge/.test(window.__m.clip?.name ?? '') && window.__m.t > 0.2); await shot('dodge'); await p.keyboard.up('d');
  await p.waitForTimeout(900); await p.keyboard.down('j'); await until(() => window.__m.clip?.name === 'charge' && window.__m.t > 0.8); await shot('charge'); await p.keyboard.up('j'); await until(() => window.__m.clip?.name === 'heavy' && window.__m.t > 0.18); await shot('heavy'); await p.waitForTimeout(320); await shot('heavyhold');
  for (const mode of ['crawl', 'hang']) { await p.evaluate(m => { window.__king.set(m); }, mode); await p.waitForTimeout(2600); await shot(mode); }
} else {
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await T('touchStart', 120, 300); await T('touchMove', 120, 250); await p.waitForTimeout(900); await shot('run'); await T('touchEnd');
  const bb = await (await p.$('.tb-attack')).boundingBox(), d = await (await p.$('.tb-dodge')).boundingBox(), mid = r => [r.x + r.width / 2, r.y + r.height / 2];
  await T('touchStart', ...mid(bb)); await T('touchEnd'); await p.waitForTimeout(230); await shot('light1'); await T('touchStart', ...mid(d)); await T('touchEnd'); await p.waitForTimeout(200); await shot('dodge');
}
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(errs.length ? 1 : 0);
