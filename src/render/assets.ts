import * as THREE from 'three';
import type { Tier } from '../core/quality.ts';

const BASE = import.meta.env.BASE_URL + 'baked/';
export const LAYERS = 8;

let LOD = '';
export const useLowLod = () => { LOD = '.lo'; };
export async function loadGeo(name: string, lod = LOD): Promise<THREE.BufferGeometry> {
  const buf = await (await fetch(`${BASE}${name}${lod}.bin`)).arrayBuffer(), dv = new DataView(buf);
  const hl = dv.getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as { nv: number; ni: number; big: boolean; lo: number[]; hi: number[] };
  const o = 4 + hl, pos = new Float32Array(h.nv * 3), nrm = new Int8Array(h.nv * 4), si = new Uint8Array(h.nv * 4), sw = new Uint8Array(h.nv * 4), info = new Uint8Array(h.nv * 4);
  const u8 = new Uint8Array(buf, o, h.nv * 24), i8 = new Int8Array(buf, o, h.nv * 24), u16 = new Uint16Array(buf, o, h.nv * 12);
  for (let i = 0; i < h.nv; i++) for (let c = 0; c < 4; c++) {
    if (c < 3) { pos[i * 3 + c] = h.lo[c] + u16[i * 12 + c] / 65535 * (h.hi[c] - h.lo[c]); nrm[i * 4 + c] = i8[i * 24 + 8 + c]; }
    si[i * 4 + c] = u8[i * 24 + 12 + c]; sw[i * 4 + c] = u8[i * 24 + 16 + c]; info[i * 4 + c] = u8[i * 24 + 20 + c];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 4, true));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4, true));
  const io = o + h.nv * 24;
  g.setIndex(new THREE.BufferAttribute(h.big ? new Uint32Array(buf.slice(io, io + h.ni * 4)) : new Uint16Array(buf.slice(io, io + h.ni * 2)), 1));
  g.computeBoundingSphere();
  return g;
}

export const loadJson = async (n: string) => (await fetch(`${BASE}${n}.json`)).json();
export interface TexSet { col: THREE.DataArrayTexture; nrm: THREE.DataArrayTexture; avg: THREE.Vector3[] }
export async function loadTextures(tier: Tier, aniso: number): Promise<TexSet> {
  const S = tier.tex, col = new Uint8Array(S * S * 4 * LAYERS), nrm = new Uint8Array(S * S * 4 * LAYERS), avg: THREE.Vector3[] = [];
  const cv = new OffscreenCanvas(S, S), cx = cv.getContext('2d', { willReadFrequently: true })!;
  const read = async (n: string) => { const bm = await createImageBitmap(await (await fetch(BASE + 'tex/' + n)).blob(), { colorSpaceConversion: 'none' }); return bm; };
  const all = await Promise.all(Array.from({ length: LAYERS }, (_, i) => Promise.all([read(`${i}_c${S}.webp`), read(`${i}_n${S}.webp`)])));
  all.forEach(([c, n], i) => {
    cx.drawImage(c, 0, 0); const d = cx.getImageData(0, 0, S, S).data; col.set(d, i * S * S * 4);
    const s = [0, 0, 0]; for (let p = 0; p < d.length; p += 64) for (let k = 0; k < 3; k++) s[k] += Math.pow(d[p + k] / 255, 2.2);
    avg.push(new THREE.Vector3(...s.map(x => x / (d.length / 64)) as [number, number, number]));
    cx.drawImage(n, 0, 0); nrm.set(cx.getImageData(0, 0, S, S).data, i * S * S * 4); c.close(); n.close();
  });
  const mk = (d: Uint8Array<ArrayBuffer>, srgb: boolean) => {
    const t = new THREE.DataArrayTexture(d, S, S, LAYERS); t.format = THREE.RGBAFormat; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  };
  return { col: mk(col, true), nrm: mk(nrm, false), avg };
}
