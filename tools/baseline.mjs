// node tools/baseline.mjs <outDir> [--tier=high] : fixed-camera stills of every boss (?shot= presets, plus round 2) as PNG into <outDir>.
// node tools/baseline.mjs compare <dirA> <dirB> : mean absolute pixel difference per image (0-255, all channels), for files in both folders.
// Run the capture twice on unchanged code to measure the noise floor; a refactor step is behaviour-preserving when it stays inside that floor.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SHOTS = [
  // [file name, query]. The query is appended to /?tier=... and the page picks its boss from ?boss=.
  ['b1_main', 'shot=main'], ['b1_boss', 'shot=boss'],
  ['b2_main', 'boss=2&shot=main'], ['b2_boss', 'boss=2&shot=boss'],
  ['b3_main', 'boss=3&shot=main'], ['b3_boss', 'boss=3&shot=boss'],
  ['b1_r2_main', 'shot=main&round2'], ['b1_r2_boss', 'shot=boss&round2'],
  ['b2_r2_main', 'boss=2&shot=main&round2'], ['b2_r2_boss', 'boss=2&shot=boss&round2'],
  ['b3_r2_main', 'boss=3&shot=main&round2'], ['b3_r2_boss', 'boss=3&shot=boss&round2'],
];
const PORT = 5233;

async function compare(dirA, dirB) {
  const names = fs.readdirSync(dirA).filter(f => f.endsWith('.png') && fs.existsSync(path.join(dirB, f))).sort();
  if (!names.length) { console.log('no common .png files'); process.exit(1); }
  let worst = 0, sum = 0;
  for (const n of names) {
    const a = await sharp(path.join(dirA, n)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(path.join(dirB, n)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(`${n}: size differs ${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}`); worst = Infinity; continue; }
    let s = 0;
    for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]);
    const mean = s / a.data.length;
    worst = Math.max(worst, mean); sum += mean;
    console.log(`${n.padEnd(16)} mean diff ${mean.toFixed(3)}`);
  }
  console.log(`images ${names.length}, average ${(sum / names.length).toFixed(3)}, worst ${worst.toFixed(3)}`);
}

async function capture(outDir, tier) {
  fs.mkdirSync(outDir, { recursive: true });
  const srv = await createServer({ server: { port: PORT }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  let bad = 0;
  for (const [name, q] of SHOTS) {
    const p = await ctx.newPage(); const seen = new Set();
    p.on('console', m => { if (m.type() === 'error') { const s = m.text().slice(0, 400); if (!seen.has(s)) { seen.add(s); bad++; console.log(name, s); } } });
    p.on('pageerror', e => { bad++; console.log(name, e.message); });
    await p.goto(`http://localhost:${PORT}/?tier=${tier}&${q}`);
    try { await p.waitForFunction(() => window.__frames > 45, null, { timeout: 90000 }); } catch { console.log(name, 'timeout waiting for frames'); bad++; }
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(outDir, name + '.png') });
    console.log('shot', name, q);
    await p.close();
  }
  await b.close(); await srv.close();
  console.log(`captured ${SHOTS.length} shots into ${outDir}${bad ? `, ${bad} page errors (see above)` : ''}`);
  return bad;
}

const args = process.argv.slice(2);
if (args[0] === 'compare') {
  if (args.length !== 3) { console.log('usage: baseline.mjs compare <dirA> <dirB>'); process.exit(2); }
  await compare(args[1], args[2]);
} else {
  const out = args.find(a => !a.startsWith('--'));
  if (!out) { console.log('usage: baseline.mjs <outDir> [--tier=high]'); process.exit(2); }
  const tier = args.find(a => a.startsWith('--tier='))?.slice(7) ?? 'high';
  const bad = await capture(path.resolve(out), tier);
  process.exit(bad ? 1 : 0);
}
