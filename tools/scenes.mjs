// node tools/scenes.mjs [intro,turn,ending,rites,jump,break,media] [--phone] : films the set pieces into shots_out/sc_*.jpg
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp'; import fs from 'node:fs';
const phone = process.argv.includes('--phone'), only = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(','), tag = phone ? 'phone_' : ''; fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5186 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const errs = []; let p;
const open = async q => {
  if (p) await p.close(); const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 400)));
  await p.goto(`http://localhost:5186/?tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}&${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__frames > 5, null, { timeout: 60000 }); await p.waitForTimeout(500);
};
const until = (f, a, ms = 30000) => p.waitForFunction(f, a, { timeout: ms, polling: 4 }), one = n => p.screenshot({ path: `shots_out/${tag}sc_${n}.jpg`, type: 'jpeg', quality: 86 });
const sheet = async (n, times, cond, cols = 4) => {
  const W = 480, H = 270, c = [];
  for (let i = 0; i < times.length; i++) { await until(cond, times[i]); c.push({ input: await sharp(await p.screenshot({ type: 'jpeg', quality: 90 })).resize(W, H, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="90" height="22"><text x="4" y="16" font-size="15" fill="#fd6">${times[i]}</text></svg>`), left: 0, top: 0 }]).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H }); }
  await sharp({ create: { width: cols * W, height: Math.ceil(times.length / cols) * H, channels: 3, background: '#000' } }).composite(c).jpeg({ quality: 86 }).toFile(`shots_out/${tag}sc_${n}.jpg`); console.log('filmed', n);
};
const go = async (n, f) => { if (only ? !only.includes(n) : n === 'media') return; try { await f(); } catch (e) { errs.push(n + ': ' + e.message.split('\n')[0]); } };
const clip = (n, times, cols) => sheet(n, times.map(t => t), new Function('t', `return __m.clip && __m.clip.name === '${n}' && __m.t >= t`), cols);
const set = (gap, extra = '') => p.evaluate(([gap, extra]) => { __f.passive = true; __king.x = 0; __king.z = -3; __king.yaw = 0; __king.set('idle'); __m.revive(0, -3 + gap, Math.PI); new Function(extra)(); }, [gap, extra]);
await go('intro', async () => {
  await open('x'); await one('menu'); await p.evaluate(() => document.querySelector('[data-b=play]').click());
  await sheet('intro', [0.4, 1.6, 2.6, 3.6, 4.4, 5.4, 6.2, 7.0, 7.8, 8.6, 9.6, 10.6, 11.2, 11.8, 12.4, 12.9, 13.5, 14.1, 14.6, 15.0, 15.6, 16.2, 16.8, 17], t => __intro.t >= t); await p.waitForTimeout(1200); await one('after_intro');
});
await go('turn', async () => {
  await open('turn'); await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -3; __m.revive(0, -1.2, Math.PI); __m.begin('light1'); }); await until(() => __turn.t >= 0);
  await sheet('turn', [0.3, 1.5, 2.5, 3.2, 4.4, 5.4, 6.4, 7.1, 7.6, 8.9, 9.8, 11, 12.2, 12.8, 13.4, 14, 14.7, 15.3, 15.6, 16.2, 17, 17.5, 18.2, 18.7, 19.4, 20.5, 21.4, 22.4, 23.4, 24.4, 25.2, 26], t => __turn.t >= t);
  await until(() => __f.phase === 'r2'); for (const ms of [250, 500, 1100]) { await p.waitForTimeout(ms); await one('bar' + ms); }
});
await go('ending', async () => {
  await open('round2'); await set(1.8, '__f.bossHp = 5; __m.begin("light1")'); await until(() => __f.phase === 'finish'); await p.waitForTimeout(2600); await p.evaluate(() => { __m.revive(__king.x, __king.z + 1.9, Math.PI); }); await p.waitForTimeout(250); await p.keyboard.press('j');
  await clip('finale', [0.2, 0.5, 0.8, 1.1, 1.4, 1.55, 1.75, 1.95]); await until(() => __ending.t >= 0);
  await sheet('ending', [0.1, 0.5, 1.2, 2.0, 2.8, 3.4, 3.9, 4.8, 5.6, 6.3, 6.8, 7.6, 8.1, 8.6, 9.6, 10.8, 11.6, 12.8, 13.8, 14.6, 15.2, 16.2, 17.5, 18.4], t => __ending.t >= t); await p.waitForTimeout(1800); await one('won');
});
await go('rites', async () => { await open('nointro'); await set(3.6, '__f.wake = 100'); await p.waitForTimeout(300); await p.keyboard.press('r'); await clip('rites', [0.1, 0.35, 0.6, 0.8, 0.95, 1.1, 1.25, 1.4, 1.6, 1.8, 1.92, 2.02, 2.1, 2.2, 2.35, 2.5, 2.7, 2.86, 2.96, 3.2, 3.55, 3.62, 3.7, 3.85, 4.1, 4.3, 4.5, 4.9]); });
await go('jump', async () => {
  await open('nointro'); await set(5); await p.waitForTimeout(700); await p.keyboard.press('c'); await clip('jump', [0.05, 0.15, 0.3, 0.5]);
  await set(2.6); await p.waitForTimeout(800); await p.keyboard.press('c'); await p.waitForTimeout(150); await p.keyboard.press('j'); await clip('airCut', [0.05, 0.12, 0.2, 0.3]);
  await set(2.6); await p.waitForTimeout(800); await p.keyboard.press('c'); await p.waitForTimeout(100); await p.keyboard.down('j'); await clip('plunge', [0.1, 0.2]); await p.keyboard.up('j'); await clip('plungeHit', [0.02, 0.1, 0.25, 0.5]);
});
await go('break', async () => { await open('nointro'); await set(5.6, '__f.fire = 100'); await p.waitForTimeout(500); await p.keyboard.press('e'); await p.waitForTimeout(250); await p.evaluate(() => __king.set('slam')); await until(() => __king.mode === 'reel'); await sheet('break', [0.0, 0.05, 0.15, 0.4, 0.7, 1.0], t => __king.mode === 'reel' && __king.mt >= t, 3); });
await go('media', async () => {
  const jpg = async n => { await p.evaluate(() => document.getElementById('hud').style.display = 'none'); await p.screenshot({ path: `docs/media/${n}.jpg`, type: 'jpeg', quality: 84 }); };
  await open('nointro'); await set(3.6, '__f.wake = 100'); await p.waitForTimeout(300); await p.keyboard.press('r'); await until(() => __m.clip?.name === 'rites' && __m.t >= 3.0); await jpg('rites'); await until(() => __m.t >= 3.62); await jpg('rites2');
  await open('nointro'); await set(2.6); await p.waitForTimeout(800); await p.keyboard.press('c'); await p.waitForTimeout(150); await p.keyboard.press('j'); await until(() => __m.clip?.name === 'airCut' && __m.t >= 0.1); await jpg('air');
  await open('round2'); await set(1.8, '__f.bossHp = 5; __m.begin("light1")'); await until(() => __f.phase === 'finish'); await p.waitForTimeout(2600); await p.evaluate(() => { __m.revive(__king.x, __king.z + 1.9, Math.PI); __m.begin('finale'); }); await until(() => __ending.t >= 8.2); await jpg('ending');
});
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(errs.length ? 1 : 0);
