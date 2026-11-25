// The hero's legs on the move. Stance feet are locked to the stone; swing feet follow drawn paths in the body's own frame:
// a walk barely clears the ground, a run kicks the heel up behind, drives the knee and paws the foot back under the hips before it lands.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), cl = (x: number) => Math.max(0, Math.min(1, x)), ss = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); }, mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const ANKLE = 0.09, SIDE = 0.1;

export class Stride {
  /** 0-1 through one full cycle; the left foot lands at 0, the right at 0.5. */ phase = 0;
  /** Share of the cycle a foot is down, for the body to time itself by. */ duty = 0.6;
  pos = [V(), V()]; pitch = [0, 0]; landed: number[] = [];
  private plant = [V(), V()]; private from = [V(), V()]; private down = [true, true]; private inv = new THREE.Matrix4(); private q = V(); private f = V();
  /** Which feet are down. */ get stance() { return this.down; }
  /** Start from wherever the feet already are (world space). */
  reset(at: THREE.Vector3[], phase: number) { for (let i = 0; i < 2; i++) { this.plant[i].copy(at[i]); this.pos[i].copy(at[i]); this.down[i] = true; } this.phase = phase; }
  /** Character space into world space: `root`. `run` 0 walk to 1 run; `spr` sprint on top. Feet come back in character space in `L`, `R`. */
  update(dt: number, vel: THREE.Vector3, root: THREE.Matrix4, run: number, spr: number, L: THREE.Vector3, R: THREE.Vector3) {
    this.inv.copy(root).invert(); this.landed.length = 0; const speed = Math.hypot(vel.x, vel.z), f = this.f.set(vel.x, 0, vel.z).transformDirection(this.inv); f.y = 0; f.normalize();
    const cyc = mix(1.0 * Math.sqrt(Math.max(0.3, speed / 1.75)), 1.56, run) + 0.2 * spr, D = this.duty = mix(0.6, 0.26, run) - 0.03 * spr, T = 1 / cyc;
    const len = speed * D * T, front = len * mix(0.45, 0.36, run), back = front - len, w = mix(SIDE, 0.07, run);
    this.phase = (this.phase + dt * cyc) % 1;
    for (let i = 0; i < 2; i++) {
      const u = (this.phase + i * 0.5) % 1, s = i === 0 ? 1 : -1, local = this.q;
      if (u < D) {
        if (!this.down[i]) { this.plant[i].copy(this.pos[i]); this.plant[i].y = 0; this.landed.push(i); this.down[i] = true; }
        local.copy(this.plant[i]).applyMatrix4(this.inv);
        // turning or slowing has left the foot somewhere a leg can't be: let it slide back toward where it belongs
        const k = u / D, want = mix(front, back, k), dz = local.z - (want * f.z), dx = local.x - (w * s + want * f.x), far = Math.hypot(dx, dz);
        if (far > 0.32) { local.x -= dx * (1 - 0.32 / far); local.z -= dz * (1 - 0.32 / far); this.plant[i].copy(local).applyMatrix4(root); this.plant[i].y = 0; }
        this.pitch[i] = k < 0.2 ? -mix(14, 6, run) * (1 - ss(0, 0.2, k)) : k > 0.5 ? mix(34, 46, run) * ss(0.5, 1, k) : 0;
        local.y = ANKLE + Math.max(0, Math.sin(this.pitch[i] * Math.PI / 180)) * 0.15;
      } else {
        const t = (u - D) / (1 - D);
        if (this.down[i]) { this.from[i].copy(this.plant[i]).applyMatrix4(this.inv); this.down[i] = false; }
        const z0 = this.from[i].z, x0 = this.from[i].x, ex = w * s + front * f.x, ez = front * f.z;
        // walk: a low arc. run: up behind first, then the knee carries it through, reaching past the landing and pawing back
        const yW = 0.085 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12)), 1.2) + 0.03 * (1 - t) * ss(0, 0.2, t);
        const yR = (0.3 + 0.1 * spr) * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - 0.35 * ss(0.6, 1, t));
        const eW = ss(0, 1, t), eR = ss(0.12, 0.88, t), e = mix(eW, eR, run), reach = run * (0.12 + 0.06 * spr) * Math.pow(Math.sin(Math.PI * ss(0.42, 1, t)), 2);
        local.set(mix(x0, ex, e) + f.x * reach, ANKLE + mix(yW, yR, run), mix(z0, ez, e) + f.z * reach);
        this.pitch[i] = mix(t < 0.3 ? mix(34, 8, ss(0, 0.3, t)) : mix(8, -16, ss(0.3, 1, t)), t < 0.35 ? mix(46, 88, ss(0, 0.35, t)) : mix(88, -8, ss(0.35, 1, t)), run);
        this.pos[i].copy(local).applyMatrix4(root);
      }
      (i === 0 ? L : R).copy(local);
      if (this.down[i]) this.pos[i].copy(this.plant[i]);
    }
  }
}
