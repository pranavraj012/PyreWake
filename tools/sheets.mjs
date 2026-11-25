// node tools/sheets.mjs player|king [clip,clip] [--yaw=0.9] : contact sheets of motions into shots_out/
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import sharp from 'sharp';
import fs from 'node:fs';
const which = process.argv[2] ?? 'player', yaw = +(process.argv.find(a => a.startsWith('--yaw='))?.slice(6) ?? (which === 'king' ? 0.6 : 2.4)), want = process.argv[3]?.startsWith('--') ? null : process.argv[3]?.split(',');
const DUR = { idle: 3, ready: 2, walk: 0.94, run: 0.67, sprint: 0.6, stalk: 3, crawl: 2.2, hang: 4.5, slam: 3.3, sweep: 3.2, grab: 3.5, reel: 1.5, kneel: 3.4, fall: 6.6, guard: 1, guardwalk: 1.2 };
const W = 300, H = 300, NF = 8; fs.mkdirSync('shots_out', { recursive: true });
const srv = await createServer({ server: { port: 5195 }, logLevel: 'error' }); await srv.listen();
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
const p = await b.newPage({ viewport: { width: W * 2, height: H * 2 } }); p.on('pageerror', e => console.log(e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
await p.goto(`http://localhost:5195/?tier=high&bench=${which}`); await p.waitForFunction(() => window.__frames > 90 && window.__bench, null, { timeout: 60000 });
const all = await p.evaluate(() => window.__bench.names);
for (const n of want ?? all) {
  const dur = DUR[n] ?? await p.evaluate(n => { const c = window.__m && window.__bench && n; return c ? null : null; }, n) ?? 1.0;
  await p.evaluate(([n, y, d, warm]) => { window.__bench.pick(n); window.__bench.view(y, 0.06, d); window.__bench.advance(warm); }, [n, yaw, which === 'king' ? (n === 'hang' ? 8 : 7.4) : 3.7, ['walk', 'run', 'sprint'].includes(n) ? 2 : ['idle', 'ready', 'guard', 'guardwalk', 'crawl', 'stalk'].includes(n) ? 1.6 : 0.0]);
  const comp = [], len = Math.max(dur, 0.5), real = DUR[n] ? len : await p.evaluate(() => window.__m.clip?.dur ?? 1);
  for (let f = 0; f < NF; f++) {
    await p.evaluate(s => window.__bench.advance(s), f === 0 ? 1 / 60 : real / (NF - 1)); const fr = await p.evaluate(() => window.__frames); await p.waitForFunction(f => window.__frames > f + 2, fr);
    comp.push({ input: await sharp(await p.screenshot({ type: 'png' })).resize(W, H).toBuffer(), left: (f % 4) * W, top: Math.floor(f / 4) * H });
  }
  await sharp({ create: { width: W * 4, height: H * 2, channels: 3, background: '#000' } }).composite(comp).jpeg({ quality: 85 }).toFile(`shots_out/sheet_${n}.jpg`); console.log('sheet', n, real.toFixed(2) + 's');
}
await b.close(); await srv.close(); process.exit(0);
