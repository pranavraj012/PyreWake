// Packs CC0 scans into two small layers per material: colour, and normal.xy + roughness.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

export const TEX_LAYERS = ['Rock030', 'Ground036', 'Bark014', 'Bark001', 'Leather028', 'Fabric066', 'Metal021', 'Rock061'];

export async function bakeTextures(src: string, out: string) {
  fs.mkdirSync(out, { recursive: true });
  for (const [i, id] of TEX_LAYERS.entries()) {
    const f = (k: string) => path.join(src, id, `${id}_1K-JPG_${k}.jpg`);
    for (const size of [1024, 512]) {
      const raw = (k: string, ch: 1 | 3) => {
        let s = sharp(f(k)).resize(size, size);
        s = ch === 1 ? s.greyscale() : s.removeAlpha().toColourspace('srgb');
        return s.raw().toBuffer();
      };
      const col = await raw('Color', 3), nrm = await raw('NormalGL', 3), rgh = await raw('Roughness', 1);
      const ao = fs.existsSync(f('AmbientOcclusion')) ? await raw('AmbientOcclusion', 1) : null;
      const a = Buffer.alloc(size * size * 3), b = Buffer.alloc(size * size * 3);
      for (let p = 0; p < size * size; p++) {
        const o = ao ? 0.35 + 0.65 * (ao[p] / 255) : 1;
        for (let c = 0; c < 3; c++) a[p * 3 + c] = col[p * 3 + c] * o;
        b[p * 3] = nrm[p * 3]; b[p * 3 + 1] = nrm[p * 3 + 1]; b[p * 3 + 2] = rgh[p];
      }
      const raw3 = { raw: { width: size, height: size, channels: 3 as const } };
      await sharp(a, raw3).webp({ quality: 80 }).toFile(path.join(out, `${i}_c${size}.webp`));
      await sharp(b, raw3).webp({ quality: 86, smartSubsample: true }).toFile(path.join(out, `${i}_n${size}.webp`));
    }
  }
}
