// node tools/restart.mjs : win the river fight, Restart, reach round 2 again; checks the boss is drawn where it is and the hero can move
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const srv = await createServer({ server: { port: 5211 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5211/?boss=2&tier=high&nointro&round2'); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -4; __king.set('idle'); __m.revive(0, -1.5, Math.PI); __f.bossHp = 5; }); await p.waitForTimeout(100); await p.evaluate(() => __m.begin('light1'));
await p.waitForFunction(() => __f.phase === 'finish', null, { timeout: 20000 }); await p.waitForTimeout(1500); await p.evaluate(() => { __m.revive(__king.x, __king.z + 1.8, Math.PI); __m.begin('finale'); });
await p.waitForFunction(() => __f.phase === 'won', null, { timeout: 20000 }); await p.waitForFunction(() => __ending.t > 12, null, { timeout: 40000 });
await p.evaluate(() => __hud.onRestart()); await p.waitForTimeout(800);
console.log('after restart:', await p.evaluate(() => `${__f.phase} round ${__f.round} form ${__king.form}`));
await p.evaluate(() => { __f.passive = true; __king.x = 0; __king.z = -4; __king.set('idle'); __m.revive(0, -1.2, Math.PI); __f.bossHp = 1; __f.hits = 5; }); await p.waitForTimeout(100); await p.evaluate(() => __m.begin('light1'));
await p.waitForFunction(() => __f.phase === 'r2', null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500);
await p.evaluate(() => { __f.passive = false; }); const z0 = await p.evaluate(() => __m.z); await p.keyboard.down('KeyS'); await p.waitForTimeout(900); await p.keyboard.up('KeyS');
const r = await p.evaluate(() => ({ phase: __f.phase, old: __v2.old, crowd: __v2.fxv.crowd, boatVis: __v2.boatM.visible, v2vis: __v2.group.visible, viewAt: [__v2.group.position.x.toFixed(1), __v2.group.position.z.toFixed(1)], sim: [__king.x.toFixed(1), __king.z.toFixed(1)], hz: __m.z }));
console.log(JSON.stringify(r), 'hero moved', (r.hz - z0).toFixed(2)); await p.screenshot({ path: 'shots_out/restart_r2.jpg', type: 'jpeg', quality: 80 });
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(0);
