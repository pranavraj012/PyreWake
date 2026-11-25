// Compact binary: u32 header length, header JSON, interleaved 24-byte vertices, indices.
import fs from 'node:fs';
import type { Mesh } from './mesher.ts';

const clampN = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function packMesh(m: Mesh, file: string) {
  const nv = m.pos.length / 3, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.pos.length; i++) { lo[i % 3] = Math.min(lo[i % 3], m.pos[i]); hi[i % 3] = Math.max(hi[i % 3], m.pos[i]); }
  const v = Buffer.alloc(nv * 24);
  for (let i = 0; i < nv; i++) {
    const o = i * 24;
    for (let c = 0; c < 3; c++) {
      v.writeUInt16LE(Math.round((m.pos[i * 3 + c] - lo[c]) / (hi[c] - lo[c] || 1) * 65535), o + c * 2);
      v.writeInt8(clampN(Math.round(m.nrm[i * 3 + c] * 127), -127, 127), o + 8 + c);
    }
    const w = [0, 1, 2, 3].map(c => Math.round(m.sw[i * 4 + c] * 255));
    w[0] += 255 - (w[0] + w[1] + w[2] + w[3]);
    for (let c = 0; c < 4; c++) {
      v.writeUInt8(m.si[i * 4 + c], o + 12 + c);
      v.writeUInt8(clampN(w[c], 0, 255), o + 16 + c);
      v.writeUInt8(c === 3 ? m.col[i * 4 + 3] : Math.round(clampN(m.col[i * 4 + c], 0, 1) * 255), o + 20 + c);
    }
  }
  const big = nv > 65535, ib = Buffer.from(big ? new Uint32Array(m.idx).buffer : new Uint16Array(m.idx).buffer);
  let head = JSON.stringify({ nv, ni: m.idx.length, big, lo, hi });
  while ((head.length + 4) % 8) head += ' ';
  const hl = Buffer.alloc(4); hl.writeUInt32LE(head.length);
  fs.writeFileSync(file, Buffer.concat([hl, Buffer.from(head), v, ib]));
  return { tris: m.idx.length / 3, verts: nv, kb: Math.round((v.length + ib.length) / 1024) };
}
