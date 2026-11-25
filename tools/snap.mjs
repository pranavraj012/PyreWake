// node snap.mjs "query" out.jpg [js to run before] [wait ms]
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
const root = process.cwd();
const [q, out, pre, wait] = process.argv.slice(2);
const srv = await createServer({ root, server: { port: 5201 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }), errs = [];
p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text().slice(0, 600)));
await p.goto(`http://localhost:5201/?${q}`);
try { await p.waitForFunction(() => document.body.classList.contains('ready') && window.__f && window.__frames > 5, null, { timeout: 90000 }); } catch (e) { console.log('NOT READY', errs.slice(0, 6).join('\n')); await p.screenshot({ path: out }); await b.close(); await srv.close(); process.exit(1); }
if (pre) await p.evaluate(pre);
await p.waitForTimeout(+(wait ?? 1500));
await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
console.log(await p.evaluate(() => document.getElementById('fps').textContent + ' ' + (window.__f?.phase)));
console.log(errs.length ? 'ERRORS ' + [...new Set(errs)].slice(0, 8).join('\n') : 'no errors');
await b.close(); await srv.close();
