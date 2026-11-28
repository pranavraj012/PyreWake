import * as THREE from 'three';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
/** Shared by every scene: one-shot cues, a hand-held lens, and cuts that don't smear. */
export class Lens {
  trauma = 0; cut = 0; private look = V();
  /** Frame a shot. A new `n` is a cut; the same one eases. */
  aim(cam: THREE.PerspectiveCamera, n: number, p: THREE.Vector3, l: THREE.Vector3, fov: number, time: number, roll = 0) {
    if (this.cut !== n) { this.cut = n; this.look.copy(l); } else this.look.lerp(l, 0.2);
    cam.position.copy(p); cam.lookAt(this.look); cam.userData.focus = this.look; cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1);
    const k = this.trauma * this.trauma; cam.rotateZ(roll + Math.sin(time * 47) * 0.014 * k + Math.sin(time * 0.7) * 0.004); cam.rotateX(Math.sin(time * 59) * 0.016 * k + Math.sin(time * 0.9) * 0.0022); cam.rotateY(Math.sin(time * 0.6 + 1) * 0.0026); cam.updateProjectionMatrix();
  }
}
export class Cues { private done = new Set<string>(); /** Skipped: what was still to come never happens. */ off = false; at(now: number, t: number, id: string, f: () => void) { if (now >= t && !this.done.has(id)) { this.done.add(id); if (!this.off) f(); } } clear() { this.done.clear(); this.off = false; } }
