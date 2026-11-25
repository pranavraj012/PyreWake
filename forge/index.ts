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
  shrine: async () => (await import('./models/arena.ts')).shrine(),
  banyan: async () => (await import('./models/arena.ts')).banyan(),
  roots0: async () => (await import('./models/arena.ts')).rootClump(1),
  roots1: async () => (await import('./models/arena.ts')).rootClump(2),
  roots2: async () => (await import('./models/arena.ts')).rootClump(3),
  shroud: async () => (await import('./models/arena.ts')).shroud(),
  pyre: async () => (await import('./models/arena.ts')).pyre(),
};

const OUT = 'public/baked';
fs.mkdirSync(OUT, { recursive: true });
if (process.argv[2] === '--one') {
  const n = process.argv[3], t = Date.now(), m = await JOBS[n](), s = packMesh(m, `${OUT}/${n}.bin`);
  packMesh(await decimate(m, Math.round(m.idx.length / 3 * (n === 'player' || n === 'king' || n === 'beneath' ? 0.29 : n.startsWith('block') ? 0.36 : 0.45))), `${OUT}/${n}.lo.bin`);
  // afterimages and shadow stand-ins
  const xs = n === 'player' || n === 'king' || n === 'beneath' ? 4500 : n.startsWith('pillar') ? 260 : 0; if (xs) packMesh(await decimate(m, xs), `${OUT}/${n}.xs.bin`);
  console.log(`${n.padEnd(9)} ${String(s.tris).padStart(6)} tris  ${String(s.kb).padStart(5)} KB  ${((Date.now() - t) / 1000).toFixed(1)}s`);
} else if (process.argv[2] === 'textures') {
  await (await import('./textures.ts')).bakeTextures('assets_src', OUT + '/tex');
} else {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS), q = [...names];
  const run = (n: string) => new Promise<void>((res, rej) => spawn(process.execPath, ['--max-old-space-size=6000', fileURLToPath(import.meta.url), '--one', n], { stdio: 'inherit' }).on('exit', c => c ? rej(new Error(n + ' failed')) : res()));
  await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) await run(q.shift()!); }));
}
