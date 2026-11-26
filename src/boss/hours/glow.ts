// A soft round additive glow, shared by the Sister's embers and eyes, the Pall's count and the whorl.
import * as THREE from 'three';

let tex: THREE.Texture | null = null;
export function glow(color: THREE.Color, size: number) {
  if (!tex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,200,140,.55)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); tex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.scale.setScalar(size); s.renderOrder = 7; return s;
}
