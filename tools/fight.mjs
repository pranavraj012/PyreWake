// node tools/fight.mjs [--phone] : plays the sparring fight with real input and captures each combat beat into shots_out/
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
const phone = process.argv.includes('--phone'), tag = phone ? 'phone_' : ''; fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5193 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const st = () => p.evaluate(() => ({ hp: Math.round(__f.hp), fire: Math.round(__f.fire), boss: Math.round(__f.bossHp), clip: __m.clip?.name, king: __king.mode, prompt: __p.current?.text }));
const shot = async n => { await p.screenshot({ path: `shots_out/${tag}m3_${n}.jpg`, type: 'jpeg', quality: 86 }); console.log(n, JSON.stringify(await st())); };
const until = (f, a, ms = 20000) => p.waitForFunction(f, a, { timeout: ms, polling: 8 });
const cdp = await ctx.newCDPSession(p);
const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const mid = async s => { const r = await (await p.$(s)).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
const BTN = { j: '.tb-attack', Space: '.tb-dodge', k: '.tb-guard', q: '.tb-skill1', f: '.tb-heal' };
const down = async k => phone ? T('touchStart', ...await mid(BTN[k])) : p.keyboard.down(k), up = async k => phone ? T('touchEnd') : p.keyboard.up(k);
const tap = async k => { await down(k); await up(k); };
const tryDo = async (name, f) => { try { await f(); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); } };
const mash = async (k, cond, arg, ms = 12000) => { const t0 = Date.now(); for (; ;) { await tap(k); if (await p.evaluate(cond, arg)) return; if (Date.now() - t0 > ms) throw new Error('mash timeout'); await p.waitForTimeout(50); } };

await p.goto(`http://localhost:5193/?nointro&tier=${phone ? 'phone' : 'high'}${phone ? '&touch' : ''}`); await until(() => document.body.classList.contains('ready'));
await p.waitForTimeout(1400); await shot('01_move');
if (phone) { await T('touchStart', 120, 300); await T('touchMove', 120, 240); } else await p.keyboard.down('w');
await tryDo('approach', () => until(() => __m.targetDist < 2.6)); if (phone) await T('touchEnd'); else await p.keyboard.up('w');
await p.waitForTimeout(250); await shot('02_attackprompt');
await tryDo('hit', async () => { await tap('j'); await until(() => __f.hits > 0); await shot('03_hit'); });
await tryDo('combo', async () => { await mash('j', () => __m.clip?.name === 'light5' && __m.t > 0.4); await until(() => __m.t > 0.56); await shot('04_slam'); });
await tryDo('white', async () => { await p.waitForTimeout(2500); await p.evaluate(() => { if (__king.mode !== 'slam') __king.set('slam', 0.7); }); await until(() => __king.mode === 'slam' && __king.mt > 1.0); await shot('05_cuewhite'); await until(() => __king.mt > 1.24); if (phone) await tap('Space'); else { await p.keyboard.down('d'); await tap('Space'); await p.keyboard.up('d'); } await until(() => __king.mt > 1.45 || __king.mode !== 'slam'); await shot('06_evade'); });
// go back to it
await tryDo('finisher', async () => { await p.evaluate(() => { __m.x = __king.x + Math.sin(__king.yaw) * 1.9; __m.z = __king.z + Math.cos(__king.yaw) * 1.9; }); for (const [n, w, t] of [['risingCut', 'light1', 0.34], ['cleave', 'light2', 0.5], ['thrust', 'light3', 0.38], ['groundSlam', 'light4', 0.6]]) { await p.evaluate(() => { __f.passive = true; __f.bossHp = __f.maxHp; if (__king.mode !== 'idle') __king.set('idle'); }); await mash('j', w => __m.clip?.name === w, w); await down('j'); await until(n => __m.clip?.name === n, n); await up('j'); await until(t => __m.t >= t, t); await shot('07_' + n); await until(() => __m.state === 'free'); await p.waitForTimeout(900); } });
await tryDo('guard', async () => { await p.evaluate(() => { __king.set('slam'); __m.x = __king.x + Math.sin(__king.yaw) * 2.4; __m.z = __king.z + Math.cos(__king.yaw) * 2.4; }); await p.waitForTimeout(500); await down('k'); await until(() => __king.mt > 1.0); await shot('08_guard'); await until(() => __m.clip?.name === 'block'); await shot('09_block'); await up('k'); });
await tryDo('parry', async () => { await until(() => __king.mode === 'idle'); await p.evaluate(() => { __king.set('slam'); __m.x = __king.x + Math.sin(__king.yaw) * 2.4; __m.z = __king.z + Math.cos(__king.yaw) * 2.4; }); await until(() => __king.mt > 1.28); await down('k'); await until(() => __m.clip?.name === 'parry'); await shot('10_parry'); await up('k'); await p.waitForTimeout(700); await shot('11_kneel'); });
await tryDo('red', async () => { await p.waitForTimeout(3500); await p.evaluate(() => { __king.set('grab'); __m.x = __king.x + Math.sin(__king.yaw) * 3; __m.z = __king.z + Math.cos(__king.yaw) * 3; }); await until(() => __king.mt > 1.0); await shot('12_cuered'); await until(() => __m.clip?.name === 'down'); await shot('13_hurt'); await until(() => __m.t > 0.45); await shot('14_down'); });
await tryDo('heal', async () => { await p.waitForTimeout(1500); await p.evaluate(() => { __f.hp = 30; }); await p.waitForTimeout(400); await shot('15_low'); await tap('f'); await until(() => __m.clip?.name === 'heal' && __m.t > 0.52); await shot('16_heal'); });
await tryDo('rush', async () => { await p.waitForTimeout(900); await p.evaluate(() => { __king.set('idle'); __f.fire = 100; __m.x = __king.x + Math.sin(__king.yaw) * 2.6; __m.z = __king.z + Math.cos(__king.yaw) * 2.6; }); await p.waitForTimeout(900); await shot('17_ready'); await tap('q'); await until(() => __m.clip?.name === 'rush' && __m.t > 0.16); await shot('18_rush'); await until(() => __m.t > 0.6); await shot('19_reform'); await until(() => __m.t > 1.06); await shot('20_boom'); await p.waitForTimeout(160); await shot('21_boom2'); });
await tryDo('die', async () => { await until(() => __king.mode === 'idle', null, 15000); await p.evaluate(() => { __f.hp = 3; __f.flame = false; __f.brain.seen.add('slam'); __king.set('slam'); __m.x = __king.x + Math.sin(__king.yaw) * 2.4; __m.z = __king.z + Math.cos(__king.yaw) * 2.4; }); await until(() => __m.dead); await p.waitForTimeout(2300); await shot('23_dead'); await until(() => !__m.dead, null, 9000); await p.waitForTimeout(700); await shot('24_again'); });
if (phone) { await tap('j'); const [x, y] = await mid('.tb-pause'); await T('touchStart', x, y); await T('touchEnd'); } else await p.keyboard.press('Escape'); await p.waitForTimeout(300); await shot('25_pause');
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors'); await b.close(); await srv.close(); process.exit(errs.length ? 1 : 0);
