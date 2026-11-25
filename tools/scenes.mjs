// node tools/scenes.mjs [story,lessons,intro,turn,ending,rites,jump,break,media] [--phone] : films the set pieces into shots_out/sc_*.jpg
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
  await until(() => __story.t > 1); await p.keyboard.press('j'); await until(() => __intro.active); await sheet('intro', [0.4, 1.6, 2.6, 3.6, 4.4, 5.4, 6.2, 7.0, 7.8, 8.6, 9.6, 10.6, 11.2, 11.8, 12.4, 12.9, 13.5, 14.1, 14.6, 15.0, 15.6, 16.2, 16.8, 17], t => __intro.t >= t); await p.waitForTimeout(1200); await one('after_intro');
});
await go('story', async () => {
  await open('x'); await p.evaluate(() => document.querySelector('[data-b=play]').click());
  await sheet('story', [0.5, 1.2, 2.6, 4.2, 4.9, 5.6, 6.6, 8.2, 9.8, 10.6, 11.4, 12.6, 13.8, 15.0, 15.7, 16.4, 17.2, 18.2, 19.4, 20.2], t => __story.t >= t);
});
await go('lessons', async () => {
  await open('x'); await p.evaluate(() => document.querySelector('[data-b=train]').click()); await p.waitForTimeout(400);
  // a pupil at the keyboard
  await p.evaluate(() => { const K = { attack: 'KeyJ', dodge: 'Space', jump: 'KeyC', guard: 'KeyK', skill1: 'KeyQ', skill2: 'KeyE', ultimate: 'KeyR', heal: 'KeyF' }, key = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c })); let busy = 0, w = false, held = 0; window.__log = []; let last = '';
    setInterval(() => { const L = __lessons, c = L.card, now = performance.now(); if (!L.active) { if (w) { key('keyup', 'KeyW'); w = false; } return; } const k = c ? c.id + ' ' + c.title : ''; if (k !== last) { last = k; __log.push(k); } const far = __m.targetDist > 2.5 && c && !c.held && /^(move|attack|heavy|rush|rites)$/.test(c.id); if (far !== w) { key(far ? 'keydown' : 'keyup', 'KeyW'); w = far; } if (!c || now < busy) return;
      const press = (a, ms) => { key('keydown', K[a]); setTimeout(() => key('keyup', K[a]), ms); busy = now + ms + 120; };
      if (L.frozen) { held ||= now; if (now - held > 700) { held = 0; press(L.frozen, c.hold ? 650 : 70); } } else { held = 0; if (c.ok) return; if (c.id === 'attack' && !far) press('attack', 60); else if (c.id === 'heavy' && !far && __m.state === 'free') press('attack', 700); else if (c.id === 'rush') press('skill1', 60); else if (c.id === 'heal') press('heal', 60); else if (c.title.startsWith('Once') && __king.strikes?.length && __king.mt > __king.strikes[0].t[0] - 0.22) press('dodge', 60); } }, 16); });
  const shots = []; const snap = async n => { shots.push(n); await one('les_' + n); };
  for (const [n, f] of [['move', () => __lessons.card?.id === 'move'], ['attack', () => __lessons.card?.id === 'attack' && __m.clip], ['dodge', () => __lessons.frozen === 'dodge' && __lessons.mono > 0.5], ['answer', () => __lessons.card?.title === 'Answer' && __lessons.mono > 0.5], ['guard', () => __lessons.frozen === 'guard' && __lessons.mono > 0.4], ['jump', () => __lessons.frozen === 'jump' && __lessons.mono > 0.4], ['air', () => __lessons.card?.title === 'In the air' && __lessons.mono > 0.4], ['sunder', () => __lessons.frozen === 'skill2' && __lessons.mono > 0.4], ['rites', () => __lessons.frozen === 'ultimate' && __lessons.mono > 0.4], ['begun', () => !__lessons.active]]) { await until(f, null, 60000); await snap(n); }
  await p.waitForTimeout(900); await one('les_after'); console.log('lessons:', (await p.evaluate(() => __log)).join(' > ')); const ok = await p.evaluate(() => !__f.passive && __f.hp === 100 && __f.bossHp === __f.maxHp && JSON.parse(localStorage.pyrewake).learned); if (!ok) errs.push('training did not hand over to the fight');
});
await go('turn', async () => {
  await open('turn'); await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -3; __m.revive(0, -1.2, Math.PI); __m.begin('light1'); }); await until(() => __turn.t >= 0);
  await sheet('turn', [0.3, 2.4, 4.4, 7.0, 7.9, 8.4, 9.2, 10.2, 11.2, 12.3, 12.9, 13.3, 14.0, 14.5, 15.2, 15.45, 15.64, 15.8, 16.1, 16.5, 16.75, 17.3, 18.0, 18.4, 18.9, 19.3, 19.6, 20.2, 21.4, 22.6, 23.6, 24.6, 25.4, 26.2, 27, 27.5], t => __turn.t >= t);
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
