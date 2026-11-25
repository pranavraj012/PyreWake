// node tools/shots.mjs [names,comma] [--phone] [--tier=high] : stills through the real GPU into shots_out/
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createServer } from 'vite';
const args = process.argv.slice(2), phone = args.includes('--phone'), tier = args.find(a => a.startsWith('--tier='))?.slice(7) ?? (phone ? 'phone' : 'high');
const names = (args.find(a => !a.startsWith('--')) ?? 'main,wide,boss,face,player,playerb,head,hang,hangc,pillar,up,floor').split(',');
fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5199 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } });
let bad = 0;
for (const n of names) {
  const p = await ctx.newPage(); const seen = new Set();
  p.on('console', m => { if (m.type() === 'error' || /THREE/.test(m.text())) { const s = m.text().slice(0, 1500); if (!seen.has(s)) { seen.add(s); bad++; console.log(n, s); } } });
  p.on('pageerror', e => { bad++; console.log(n, e.message); });
  await p.goto(`http://localhost:5199/?tier=${tier}&shot=${n}${phone ? '&touch' : ''}`);
  try { await p.waitForFunction(() => window.__frames > 45, null, { timeout: 60000 }); } catch { console.log(n, 'timeout'); bad++; }
  await p.waitForTimeout(900);
  console.log(n, await p.evaluate(() => document.getElementById('fps').textContent));
  await p.screenshot({ path: `shots_out/${phone ? 'phone_' : ''}${n}.jpg`, type: 'jpeg', quality: 88 }); await p.close();
}
await b.close(); await srv.close(); process.exit(bad ? 1 : 0);
