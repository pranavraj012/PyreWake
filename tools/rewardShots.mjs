// node tools/rewardShots.mjs lantern|chain|rope|ride [phone] [outDir] : films one of the hero's reward scenes on a fixed clock.
// The page's clock is faked (Playwright), so each frame is taken at an exact scene time (the boss's stage). The reward is earned by a real
// attack press after its offer. Writes <outDir>/<kind>_<desk|phone>_NN.jpg, one per time in TIMES, and prints a line per frame.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const [kind = 'lantern', variant = 'desk', outArg] = process.argv.slice(2);
const phone = variant === 'phone';
const OUT = outArg ?? path.join('shots_out', 'A5');
fs.mkdirSync(OUT, { recursive: true });
/** The scene times (stage seconds) to film. The contact is frame-held for the hit-stop, so a few frames sit on it. */
const TIMES = {
  lantern: [0.0, 0.2, 0.4, 0.55, 0.75, 0.95, 1.1, 1.25, 1.35, 1.5, 1.7, 1.95, 2.3, 2.7, 3.1, 3.38],
  chain: [0.0, 0.2, 0.4, 0.5, 0.7, 0.9, 1.1, 1.3, 1.45, 1.6, 1.8, 2.1, 2.5, 2.9, 3.2, 3.38],
  rope: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.35, 1.5, 1.7, 1.9, 2.2, 2.6, 3.0, 3.4, 3.7],
  ride: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.15, 1.3, 1.5, 1.7, 1.9, 2.2, 2.5, 2.8, 3.1, 3.3],
}[kind];
const LEN = { lantern: 3.4, chain: 3.4, rope: 3.7, ride: 3.3 }[kind];
const PORT = 5240;
const srv = await createServer({ server: { port: PORT }, logLevel: 'error' }); await srv.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force-high-performance-gpu', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const vp = phone ? { width: 844, height: 390 } : { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 300)));
await p.clock.install();
// the river is boss 2; the King's rewards are the default page
const url = kind === 'lantern' || kind === 'chain' ? `http://localhost:${PORT}/?boss=2&tier=${phone ? 'phone' : 'high'}&nointro&round2${phone ? '&touch' : ''}` : `http://localhost:${PORT}/?tier=${phone ? 'phone' : 'high'}&nointro${phone ? '&touch' : ''}`;
await p.goto(url);
/** Runs the game's own loop for `ms` of page time (the loop is driven by the fake clock). */
const run = ms => p.clock.runFor(ms);
for (let i = 0; i < 400 && !(await p.evaluate(() => document.body.classList.contains('ready') && (window.__frames ?? 0) > 5)); i++) await run(50);

// set the scene up: the hero three metres in front of the boss, the boss passive (no attacks while it is filmed)
const setup = {
  lantern: () => { const k = __king; __f.passive = true; __f.invuln = 99; k.set('idle'); __m.revive(0, k.z + 3, Math.PI); __f.hp = 100; k.reward = null; k.rewardLeft = 0; return __f.bossHp; },
};
if (kind === 'lantern' || kind === 'chain') {
  await p.evaluate(() => { __f.passive = true; __f.invuln = 99; __f.hp = 100; __king.set('idle'); __m.revive(0, __king.z + 3, Math.PI); });
  if (kind === 'lantern') await p.evaluate(() => { __king.reward = 'lantern'; __king.rewardLeft = 1.8; });
  else await p.evaluate(() => { const k = __king; k.chain = { x: 2.6, z: 1.0, len: 4, hp: 1, t: 0, cut: 0 }; k.lastAnchor = { x: 2.6, z: 1.0 }; k.offer('chain'); });
} else {
  await p.evaluate(() => { __f.passive = true; __f.invuln = 99; __f.hp = 100; __king.set('hang'); __m.revive(0, __king.z + 2.2, Math.PI); });
  await run(600);
  await p.evaluate(kind => { __king.reward = kind; __king.rewardLeft = 1.8; }, kind === 'rope' ? 'rope' : 'ride');
}
void setup;
// the offer settles (its press shows after ~0.9 s), then the hero presses the attack key
await run(1200);
const shown = await p.evaluate(() => ({ reward: __king.reward, on: __p ? true : false }));
await p.keyboard.down('KeyJ'); await run(32); await p.keyboard.up('KeyJ'); await run(16);
let st = await p.evaluate(() => ({ staging: __king.staging, rite: __king.rite, stage: __king.stage, bossHp: __f.bossHp }));
if (!st.staging) console.log('WARNING: the press did not start the scene', JSON.stringify(shown), JSON.stringify(st));
const hp0 = st.bossHp;
const rows = [];
let hit = null;
for (let i = 0; i < TIMES.length; i++) {
  const want = TIMES[i];
  for (let g = 0; g < 2000; g++) {
    const s = await p.evaluate(() => ({ stage: __king.stage, staging: __king.staging, bossHp: __f.bossHp, m: [__m.x, __m.y, __m.z], clip: __m.clip?.name ?? null, mt: __m.t, off: __pv ? [__pv.offset.x, __pv.offset.y, __pv.offset.z] : null, tumble: __pv ? __pv.tumble : 0, bmode: __king.mode }));
    if (s.stage >= want || !s.staging) { st = s; break; }
    await run(16);
  }
  const file = path.join(OUT, `${kind}_${variant}_${String(i + 1).padStart(2, '0')}.jpg`);
  await p.screenshot({ path: file, type: 'jpeg', quality: 88 });
  const after = await p.evaluate(() => ({ stage: __king.stage, staging: __king.staging, bossHp: __f.bossHp, m: [__m.x, __m.y, __m.z], clip: __m.clip?.name ?? null, mt: __m.t, bmode: __king.mode, off: [__pv.offset.x, __pv.offset.y, __pv.offset.z] }));
  if (hit === null && after.bossHp < hp0) hit = after.stage;
  rows.push({ n: i + 1, want, stage: +after.stage.toFixed(3), staging: after.staging, clip: after.clip, mt: +after.mt.toFixed(3), off: after.off.map(v => +v.toFixed(2)), boss: after.bossHp, bmode: after.bmode, file: path.basename(file) });
  console.log(JSON.stringify(rows.at(-1)));
  if (!after.staging) break;
}
// run the scene to its end
for (let g = 0; g < 2000; g++) { const s = await p.evaluate(() => __king.staging); if (!s) break; await run(16); }
const end = await p.evaluate(() => ({ m: [__m.x, __m.y, __m.z], arena: __m.arena, state: __m.state, bossHp: __f.bossHp, hp0: null, stage: __king.stage, bmode: __king.mode, dead: __m.dead }));
console.log(JSON.stringify({ kind, variant, hp0, contactStage: hit, end, errors: errs.slice(0, 5) }));
await browser.close(); await srv.close();
