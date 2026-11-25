// node tools/m4.mjs [--phone] [only,these] : drives the build to each key moment and captures it into shots_out/m4_*.jpg
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
const phone = process.argv.includes('--phone'), only = process.argv.slice(2).find(a => !a.startsWith('--'))?.split(','), tag = phone ? 'phone_' : ''; fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5189 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const errs = []; let p;
const open = async q => {
  if (p) await p.close(); const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 400)));
  await p.goto(`http://localhost:5189/?tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}&${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 60000 }); await p.waitForTimeout(400);
};
const shot = async n => { await p.screenshot({ path: `shots_out/${tag}m4_${n}.jpg`, type: 'jpeg', quality: 84 }); console.log(n, await p.evaluate(() => `${__f.phase} ${__king.mode} ${__m.clip?.name} ${document.getElementById('fps').textContent}`)); };
const until = (f, a, ms = 15000) => p.waitForFunction(f, a, { timeout: ms, polling: 6 });
const go = async (n, f) => { if (only && !only.includes(n)) return; try { await f(); } catch (e) { errs.push(n + ': ' + e.message.split('\n')[0]); } };
const boss = (mode, gap = 2.6) => p.evaluate(([mode, gap]) => { __f.passive = true; __f.hp = 100; __f.flame = true; __f.hazards.length = 0; __king.x = 0; __king.z = -3; __king.yaw = 0; __f.brain.seen.add(mode); __m.revive(0, -3 + gap, Math.PI); __king.crawling = mode === 'pounce' || mode === 'rake'; __king.armed = __king.form === 1 && !__king.crawling && !mode.startsWith('hang'); __king.set(mode); }, [mode, gap]);
const move = (clip, t, gap = 2) => async n => { await p.evaluate(([clip, gap]) => { __f.passive = true; __king.crawling = false; __king.set('idle'); __king.x = 0; __king.z = -3; __king.yaw = 0; __f.bossHp = __f.maxHp; __m.revive(0, -3 + gap, Math.PI); __m.begin(clip); }, [clip, gap]); await until(([c, t]) => __m.clip?.name === c && __m.t >= t, [clip, t]); await shot(n); };
await open('nointro');
await go('leap', async () => { await boss('leap', 5); await until(() => __king.mt > 0.95); await shot('leap'); });
await go('drag', async () => { await boss('drag', 4); await until(() => __king.mt > 0.8); await shot('drag'); });
await go('pounce', async () => { await boss('pounce', 5); await until(() => __king.mt > 0.9); await shot('pounce'); });
await go('rake', async () => { await boss('rake', 3); await until(() => __king.mt > 0.8); await shot('rake'); });
await go('hang', async () => {
  await boss('hang', 2); await p.waitForTimeout(2600); await shot('hang'); await p.evaluate(() => { __m.revive(__king.hx, __king.hz + 1.4, Math.PI); __m.begin('light1'); }); await until(() => __m.t > 0.2); await shot('hanghit');
  await p.evaluate(() => { __king.set('hangSwing'); }); await until(() => __king.mt > 0.95); await shot('hangswing'); await until(() => __king.mt > 1.55); await shot('hangswing2'); await p.evaluate(() => { __f.brain.drop(__king); }); await until(() => __king.mode === 'crash' && __king.mt > 1); await shot('crash');
});
for (const [n, c, t] of [['comet', 'comet', 0.48], ['lowTurn', 'lowTurn', 0.28], ['passL', 'passL', 0.22], ['alt3', 'alt3', 0.36], ['alt4', 'alt4', 0.33], ['alt5', 'alt5', 0.95], ['palm', 'palm', 0.26], ['reckon1', 'reckon', 0.45], ['reckon2', 'reckon', 1.6], ['flare', 'flare', 0.4]]) await go(n, () => move(c, t)(n));
await go('sunder', async () => { await move('sunder', 0.62, 6)('sunder'); });
await go('execute', async () => { await move('execute', 1.0, 1.9)('execute1'); await until(() => __m.t > 1.72); await shot('execute2'); });
await go('rites', async () => { await move('rites', 1.3, 4)('rites1'); await until(() => __m.t > 2.3); await shot('rites2'); await until(() => __m.t > 3.2); await shot('rites3'); await until(() => __m.t > 3.7); await shot('rites4'); });
await go('aura', async () => { await p.evaluate(() => { __f.bossHp = __f.maxHp; __king.set('idle'); __m.revive(0, 2, Math.PI); __f.streak = 60; __f.setAura(); __dir.pv.auraStep = 4; __dir.pv.aura.value = 4; }); await p.keyboard.down('s'); await p.waitForTimeout(1300); await shot('aura'); await p.keyboard.up('s'); });
await go('wounds', async () => { await p.evaluate(() => { __king.x = 0; __king.z = -3; __king.yaw = 0; __king.set('idle'); __f.bossHp = __f.maxHp; __m.revive(0, -1.2, Math.PI); }); for (let i = 0; i < 16; i++) { await p.keyboard.press('j'); await p.waitForTimeout(110); } await p.waitForTimeout(900); await shot('wounds'); });
await go('flame', async () => { await p.evaluate(() => { __f.hp = 1; __f.invuln = 0; __king.x = 0; __king.z = -3; __king.yaw = 0; __m.revive(0, -1, Math.PI); __f.brain.seen.add('slam'); __king.set('slam'); }); await until(() => __m.clip?.name === 'rekindle' && __m.t > 1.0); await shot('flame'); });
await go('turn', async () => {
  await open('nointro&turn'); await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -3; __m.revive(0, -1.2, Math.PI); }); await p.waitForTimeout(200); await p.evaluate(() => __m.begin('light1')); await until(() => __f.phase === 'scene'); await p.waitForTimeout(350); await shot('t00_hero');
  for (const t of [1.5, 4.2, 6.4, 8.2, 11, 14.6, 15.9, 17.6, 19.2, 20.6, 23]) { await until(t => __turn.t >= t, t, 30000); await shot('t' + String(Math.round(t * 10)).padStart(3, '0')); } await until(() => __f.phase === 'r2', null, 8000); await p.waitForTimeout(700); await shot('t_r2');
});
await go('r2', async () => {
  await open('nointro&round2'); await p.evaluate(() => { __f.passive = true; __m.revive(0, 1.5, Math.PI); }); await p.waitForTimeout(1200); await shot('r2_idle');
  for (const [mode, t, gap] of [['flurry', 0.84, 2.6], ['flurry', 2.6, 2.6], ['cross', 0.8, 5], ['skewer', 0.95, 3.4], ['rupture', 1.0, 4], ['rain', 1.5, 5], ['wheel', 0.95, 5], ['wheel', 2.0, 5]]) { await boss(mode, gap); await until(([m, t]) => __king.mode === m && __king.mt >= t, [mode, t]); await shot('r2_' + mode + Math.round(t * 10)); await until(() => __king.mode === 'idle', null, 6000).catch(() => { }); }
  await p.evaluate(() => { __f.hazards.length = 0; __king.set('idle'); __king.x = 0; __king.z = -3; __f.bossHp = 5; __m.revive(0, -1.2, Math.PI); __m.begin('light1'); }); await until(() => __f.phase === 'finish'); await p.waitForTimeout(1500); await p.evaluate(() => __m.revive(__king.x, __king.z + 1.8, Math.PI)); await p.waitForTimeout(150); await shot('r2_finish'); await p.evaluate(() => __m.begin('finale')); await until(() => __f.phase === 'won'); await p.waitForTimeout(3200); await shot('r2_won'); await until(() => document.body.classList.contains('won'), null, 30000); await p.waitForTimeout(1500); await shot('r2_panel');
});
await go('storm', async () => { await open('nointro&round2'); await p.evaluate(() => { __f.hp = 100; __f.invuln = 999; __m.revive(0, 1.5, Math.PI); __king.x = 0; __king.z = -3; __f.bossHp = __f.maxHp * 0.38; __f.passive = false; }); await until(() => __f.brain.style === 'eclipse', null, 20000); await p.waitForTimeout(1500); await shot('storm1'); await p.waitForTimeout(2500); await shot('storm2'); await p.evaluate(() => { __f.passive = true; __king.set('idle'); }); await p.waitForTimeout(1500); await shot('storm3'); });
await go('ink', async () => { await open('nointro'); await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -3; __king.set('idle'); __m.revive(0, -1.1, Math.PI); __m.begin('light5'); }); for (let i = 0; i < 1; i++) await until(() => __dir.snapK > 0.8, null, 4000); await shot('ink1'); await p.waitForTimeout(60); await shot('ink2'); });
await go('rush', async () => { await open('nointro'); await p.evaluate(() => { __f.passive = true; __f.fire = 100; __king.x = 0; __king.z = -3; __king.yaw = 0; __king.set('idle'); __m.revive(0, 1, Math.PI); }); await p.waitForTimeout(600); await p.keyboard.press('q'); for (const t of [0.3, 0.7, 1.0, 1.4, 1.9]) { await until(t => __m.clip?.name !== 'rush' || __m.t >= t, t); await shot('rush' + Math.round(t * 10)); } await p.waitForTimeout(800); await shot('rush_after'); });
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(errs.length ? 1 : 0);
