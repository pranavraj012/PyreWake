// node tools/probe.mjs "query" "js expression returning JSON" : load the build, wait for ready, print the result.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const [q, js, wait] = process.argv.slice(2);
const srv = await createServer({ root: process.cwd(), server: { port: 5202 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 400)));
await p.goto(`http://localhost:5202/?${q}`);
await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 });
await p.waitForTimeout(+(wait ?? 800));
console.log(JSON.stringify(await p.evaluate(js), null, 1));
if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 5).join('\n'));
await b.close(); await srv.close();
