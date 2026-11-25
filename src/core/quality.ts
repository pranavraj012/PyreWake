export type TierName = 'phone' | 'mid' | 'high';
export interface Tier {
  name: TierName; maxDpr: number; minScale: number; msaa: number; shadow: number; tex: 512 | 1024;
  ao: boolean; shafts: boolean; triplanar: boolean; glows: boolean; lights: number; particles: number; bloomMips: number;
}
export const TIERS: Record<TierName, Tier> = {
  phone: { name: 'phone', maxDpr: 1.5, minScale: 0.6, msaa: 2, shadow: 1024, tex: 512, ao: false, shafts: false, triplanar: false, glows: false, lights: 2, particles: 0.4, bloomMips: 4 },
  mid: { name: 'mid', maxDpr: 1.5, minScale: 0.7, msaa: 4, shadow: 1536, tex: 1024, ao: true, shafts: false, triplanar: true, glows: true, lights: 3, particles: 0.7, bloomMips: 5 },
  high: { name: 'high', maxDpr: 2, minScale: 0.8, msaa: 4, shadow: 2048, tex: 1024, ao: true, shafts: true, triplanar: true, glows: true, lights: 4, particles: 1, bloomMips: 6 },
};
export function pickTier(): Tier {
  const forced = new URLSearchParams(location.search).get('tier') as TierName | null;
  if (forced && TIERS[forced]) return TIERS[forced];
  if (matchMedia('(pointer: coarse)').matches) return TIERS.phone;
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  const name = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return /RTX|RX \d{4}|M[1-9] (Pro|Max|Ultra)/i.test(name) ? TIERS.high : TIERS.mid;
}

/** Adjusts render scale to hold the frame budget. */
export class DynamicScale {
  scale = 1; private avg = 16; private hold = 0; private min: number;
  constructor(min: number) { this.min = min; }
  update(frameMs: number): boolean {
    this.avg += (Math.min(frameMs, 60) - this.avg) * 0.05;
    if (--this.hold > 0) return false;
    let n = this.scale;
    if (this.avg > 19) n -= 0.08; else if (this.avg < 17.2 && this.scale < 1) n += 0.03;
    n = Math.max(this.min, Math.min(1, n));
    if (Math.abs(n - this.scale) < 0.02) return false;
    this.scale = n; this.hold = 45; return true;
  }
}
