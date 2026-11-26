// node forge/index.ts [names...]  - bakes models to public/baked (parallel child processes).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { packMesh } from './pack.ts';
import { decimate } from './mesher.ts';
import type { Mesh } from './mesher.ts';

const JOBS: Record<string, () => Promise<Mesh>> = {
  player: async () => (await import('./models/player.ts')).player(),
  king: async () => (await import('./models/king.ts')).king(),
  beneath: async () => (await import('./models/beneath.ts')).beneath(),
  khanda: async () => (await import('./models/weapons.ts')).khanda(),
  cleaver: async () => (await import('./models/weapons.ts')).cleaver(),
  pillar0: async () => (await import('./models/arena.ts')).pillar(1, 0),
  pillar1: async () => (await import('./models/arena.ts')).pillar(2, 3.4),
  pillar2: async () => (await import('./models/arena.ts')).pillar(3, 1.5),
  block0: async () => (await import('./models/arena.ts')).block(1),
  block1: async () => (await import('./models/arena.ts')).block(2),
  block2: async () => (await import('./models/arena.ts')).block(3),
  rubble0: async () => (await import('./models/arena.ts')).rubble(1),
  rubble1: async () => (await import('./models/arena.ts')).rubble(2),
  stele: async () => (await import('./models/arena.ts')).stele(),
  steleBits: async () => (await import('./models/arena.ts')).steleBits(),
  pillar0Bits: async () => (await import('./models/arena.ts')).pillarBits(1, 0),
  pillar1Bits: async () => (await import('./models/arena.ts')).pillarBits(2, 3.4),
  pillar2Bits: async () => (await import('./models/arena.ts')).pillarBits(3, 1.5),
  shard0: async () => (await import('./models/arena.ts')).shard(1),
  shard1: async () => (await import('./models/arena.ts')).shard(2),
  shrine: async () => (await import('./models/arena.ts')).shrine(),
  banyan: async () => (await import('./models/arena.ts')).banyan(),
  roots0: async () => (await import('./models/arena.ts')).rootClump(1),
  roots1: async () => (await import('./models/arena.ts')).rootClump(2),
  roots2: async () => (await import('./models/arena.ts')).rootClump(3),
  shroud: async () => (await import('./models/arena.ts')).shroud(),
  pyre: async () => (await import('./models/arena.ts')).pyre(),
  ferryman: async () => (await import('./models/river.ts')).ferryman(),
  ferryman2: async () => (await import('./models/river.ts')).ferryman(true),
  pole: async () => (await import('./models/river.ts')).pole(),
  anchor: async () => (await import('./models/river.ts')).anchor(),
  lantern: async () => (await import('./models/river.ts')).lantern(),
  boat: async () => (await import('./models/river.ts')).boat(),
  boatBits: async () => (await import('./models/river.ts')).boatBits(),
  arm: async () => (await import('./models/river.ts')).arm(),
  drowned: async () => (await import('./models/river.ts')).drowned(),
  hull: async () => (await import('./models/river.ts')).hull(),
  section: async () => (await import('./models/river.ts')).section(),
  sister: async () => (await import('./models/hours.ts')).sister(),
  scythe: async () => (await import('./models/hours.ts')).scythe(),
  pall: async () => (await import('./models/hours.ts')).pall(),
  pallFrame: async () => (await import('./models/hours.ts')).pallFrame(),
  cot: async () => (await import('./models/house.ts')).cot(),
  cotBits: async () => (await import('./models/house.ts')).cotBits(),
  hcol0: async () => (await import('./models/house.ts')).hcol(1, 0),
  hcol1: async () => (await import('./models/house.ts')).hcol(2, 3.0),
  hcol2: async () => (await import('./models/house.ts')).hcol(3, 1.5),
  hcol0Bits: async () => (await import('./models/house.ts')).hcolBits(1, 0),
  hcol1Bits: async () => (await import('./models/house.ts')).hcolBits(2, 3.0),
  hcol2Bits: async () => (await import('./models/house.ts')).hcolBits(3, 1.5),
  arcade: async () => (await import('./models/house.ts')).arcade(),
  dial: async () => (await import('./models/house.ts')).dial(),
  bowl: async () => (await import('./models/house.ts')).bowl(),
  beam: async () => (await import('./models/house.ts')).beam(),
};
const CHAR = ['player', 'king', 'beneath', 'ferryman', 'ferryman2', 'sister', 'pall'];

const OUT = 'public/baked';
fs.mkdirSync(OUT, { recursive: true });
if (process.argv[2] === '--one') {
  const n = process.argv[3], t = Date.now(), m = await JOBS[n](), s = packMesh(m, `${OUT}/${n}.bin`);
  packMesh(await decimate(m, Math.round(m.idx.length / 3 * (CHAR.includes(n) ? 0.29 : n.startsWith('block') ? 0.36 : 0.45))), `${OUT}/${n}.lo.bin`);
  // afterimages and shadow stand-ins
  const xs = CHAR.includes(n) ? 4500 : (n.startsWith('pillar') || n.startsWith('hcol')) && !n.endsWith('Bits') ? 260 : n === 'stele' ? 160 : n === 'boat' ? 300 : n === 'cot' ? 200 : n === 'arcade' ? 1100 : n === 'dial' ? 1500 : 0; if (xs) packMesh(await decimate(m, xs), `${OUT}/${n}.xs.bin`);
  console.log(`${n.padEnd(9)} ${String(s.tris).padStart(6)} tris  ${String(s.kb).padStart(5)} KB  ${((Date.now() - t) / 1000).toFixed(1)}s`);
} else if (process.argv[2] === 'textures') {
  await (await import('./textures.ts')).bakeTextures('assets_src', OUT + '/tex');
} else {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS), q = [...names];
  const run = (n: string) => new Promise<void>((res, rej) => spawn(process.execPath, ['--max-old-space-size=6000', fileURLToPath(import.meta.url), '--one', n], { stdio: 'inherit' }).on('exit', c => c ? rej(new Error(n + ' failed')) : res()));
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) await run(q.shift()!); }));
}
