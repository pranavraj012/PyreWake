// node tools/sfx.mjs [name,name] : renders the sound bank, prints levels, and draws spectrograms into shots_out/spec_*.png
import sharp from 'sharp'; import fs from 'node:fs';
import { DEFS, SR, render } from '../src/audio/bank.ts';
const want = process.argv[2]?.split(','), t0 = Date.now(), rows = []; fs.mkdirSync('shots_out', { recursive: true });
const N = 1024, win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } } for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), x = re[i + k + len / 2] * c - im[i + k + len / 2] * s, y = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - x; im[i + k + len / 2] = im[i + k] - y; re[i + k] += x; im[i + k] += y; } } }
const W = 220, H = 110, tiles = [];
for (const d of DEFS) {
  if (want && !want.some(w => d.n.startsWith(w))) continue; const t = Date.now(), x = render(d), ms = Date.now() - t; let pk = 0, bad = 0, w = 0, best = 0, small = 0, tot = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (!Number.isFinite(a)) bad++; pk = Math.max(pk, a); w += x[i] * x[i]; if (i >= 4410) w -= x[i - 4410] ** 2; best = Math.max(best, w); }
  const px = Buffer.alloc(W * H * 3); let cen = 0, sum = 0;
  for (let c = 0; c < W; c++) { const s = Math.round(c / W * Math.max(0, x.length - N)), re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = (x[s + i] ?? 0) * win[i]; fft(re, im); for (let k = 1; k < N / 2; k++) { const m = re[k] ** 2 + im[k] ** 2, f = k * SR / N; cen += m * f; sum += m; tot += m; if (f > 250) small += m; } for (let r = 0; r < H; r++) { const f = 40 * Math.pow(400, 1 - r / H), k = Math.max(1, Math.round(f / SR * N)), v = Math.max(0, Math.min(1, (10 * Math.log10(re[k] ** 2 + im[k] ** 2 + 1e-9) + 35) / 65)); px.set([Math.min(255, v * 420), Math.max(0, v * 400 - 130), Math.max(0, v * 500 - 320)], (r * W + c) * 3); } }
  rows.push([d.n, pk, 10 * Math.log10(best / 4410 + 1e-9), x.length / SR, cen / sum, small / tot, ms, bad]); tiles.push({ n: d.n, png: await sharp(px, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(`<svg width="${W}" height="16"><text x="4" y="12" font-size="11" fill="#fff" font-family="sans-serif">${d.n} ${(x.length / SR).toFixed(1)}s</text></svg>`), top: 0, left: 0 }]).png().toBuffer() });
}
for (const r of rows) console.log(r[0].padEnd(11), 'peak', r[1].toFixed(2), ' loudest', r[2].toFixed(1).padStart(6), 'dB ', r[3].toFixed(2), 's  centre', String(Math.round(r[4])).padStart(5), 'Hz  heard on phones', Math.round(r[5] * 100) + '%', r[7] ? 'NaN!' : '');
const C = 8; await sharp({ create: { width: C * (W + 4), height: Math.ceil(tiles.length / C) * (H + 4), channels: 3, background: '#222' } }).composite(tiles.map((t, i) => ({ input: t.png, left: (i % C) * (W + 4), top: Math.floor(i / C) * (H + 4) }))).png().toFile('shots_out/spec.png');
console.log(rows.length, 'sounds in', Date.now() - t0, 'ms incl. spectrograms; synthesis', rows.reduce((a, r) => a + r[6], 0), 'ms');
