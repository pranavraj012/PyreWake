// node tools/peek.mjs "<query>" "<js to run>" [out] : one frame of the game after running some code in the page (shots_out/peek.jpg). CAM='[[x,y,z],[x,y,z],fov]' frames it.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
fs.mkdirSync('shots_out', { recursive: true });
const [q = 'boss=3&nointro&still', js = '', out = 'shots_out/peek.jpg'] = process.argv.slice(2), W = +(process.env.W ?? 1280), Hh = +(process.env.H ?? 720);
const srv = await createServer({ server: { port: 5214 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const errs = []; const p = await b.newPage({ viewport: { width: W, height: Hh } }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:5214/?${q}`); await p.waitForFunction(() => document.body.classList.contains('ready') && window.__frames > 5, null, { timeout: 120000 });
if (process.env.CAM) await p.evaluate(c => { window.__shotCam = c; }, JSON.parse(process.env.CAM));
if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); }
await p.waitForTimeout(+(process.env.WAIT ?? 900)); await p.screenshot({ path: out, type: 'jpeg', quality: 88 });
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 6).join(' | ') : 'ok', out); await b.close(); await srv.close(); process.exit(0);
