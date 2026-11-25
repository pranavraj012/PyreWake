// node tools/menus.mjs : the title screen of each fight, desktop and phone, into shots_out/menus_*.jpg
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const srv = await createServer({ server: { port: 5206 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] }), errs = [];
for (const [tag, q] of [['king', ''], ['river', 'boss=2']]) for (const phone of [false, true]) {
  const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } }), p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:5206/?tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}&${q}`); await p.waitForFunction(() => document.body.classList.contains('menu'), null, { timeout: 90000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots_out/menus_${tag}${phone ? '_phone' : ''}.jpg`, type: 'jpeg', quality: 82 }); console.log(tag, phone ? 'phone' : 'desktop', await p.evaluate(() => [...document.querySelectorAll('#menu nav button:not([hidden])')].map(b => b.textContent).join(' | ')));
  await ctx.close();
}
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(errs.length ? 1 : 0);
