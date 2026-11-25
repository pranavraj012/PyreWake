// node tools/bisect.mjs "query" out_prefix "js1" "js2" ... : screenshot after each snippet runs (cumulative). Snippets may await dynamic imports.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const [q, pre, ...js] = process.argv.slice(2);
const srv = await createServer({ root: process.cwd(), server: { port: 5203 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 400)));
await p.goto(`http://localhost:5203/?${q}`);
await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
await p.waitForTimeout(800);
for (let i = 0; i < js.length; i++) { if (js[i]) await p.evaluate(`(async () => { ${js[i]} })()`); await p.waitForTimeout(700); await p.screenshot({ path: `${pre}${i}.jpg`, type: 'jpeg', quality: 70 }); }
if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 5).join('\n'));
await b.close(); await srv.close();
