// Auto-framing follow camera. Low and slightly off-shoulder, so the hero reads tall.
import * as THREE from 'three';
import { settings } from '../core/settings.ts';
import type { Motor } from '../player/motor.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export class FollowCam {
  yaw = 0; pitch = 0.1; private manual = 0; private focus = V(0, 1.35, 9); private dist = 4.2; trauma = 0; private fov = 46; private look = V(); /** Field-of-view kick in degrees; springs back. */ punch = 0; /** Seconds left of a Cinder Rush: hold the old side, then swing round. */ rushT = 0; private kick = V(); private pull = 1; blockers: { x: number; z: number; r: number }[] = [];
  /** After a composed shot or a teleport: straight to where it belongs, behind the hero and looking past them. */
  snap(m: Motor, boss: { x: number; z: number }) { this.yaw = Math.atan2(m.x - boss.x, m.z - boss.z) + 0.12; this.pitch = 0.1; this.focus.set(m.x, 1.28, m.z); this.dist = 4.3; this.pull = 1; this.look.set(0, 0, 0); this.manual = 0; }
  /** A blow landed: shove the view along the blade. */
  hit(power: number, v: THREE.Vector3) { this.trauma = Math.max(this.trauma, 0.16 + power * 0.14); this.kick.addScaledVector(v, 0.02 + power * 0.022); this.punch = Math.min(this.punch, power > 1.8 ? -3.2 : -0.9); }
  update(cam: THREE.PerspectiveCamera, dt: number, m: Motor, boss: { x: number; z: number; h: number; solid?: boolean } | null, look: { x: number; y: number }, t: number, baseFov: number) {
    if (look.x || look.y) this.manual = 1.6; this.manual -= dt;
    this.yaw -= look.x; this.pitch = Math.max(-0.12, Math.min(0.75, this.pitch + look.y));
    let d = 9, want = this.yaw;
    if (boss) {
      const bx = boss.x - m.x, bz = boss.z - m.z; d = Math.hypot(bx, bz); want = Math.atan2(-bx, -bz) + 0.12;
      this.rushT -= dt; const held = this.rushT > 0.95, whip = this.rushT > 0;
      if (this.manual < 0 && !held) { let e = want - this.yaw; e -= Math.round(e / 6.2832) * 6.2832; this.yaw += e * (1 - Math.exp(-dt * (whip ? 6.5 : Math.abs(e) > 0.9 ? 3.8 : 2.3))); this.pitch += (0.1 - this.pitch) * (1 - Math.exp(-dt * 2)); }
    } else if (this.manual < 0 && m.speed > 1) { let e = m.yaw + Math.PI - this.yaw; e -= Math.round(e / 6.2832) * 6.2832; this.yaw += e * (1 - Math.exp(-dt * 0.9)) * Math.max(0, Math.cos(e * 0.5)); }
    const wd = boss ? 4.25 + Math.max(0, 5 - d) * 0.5 + Math.max(0, d - 8) * 0.05 : 4.0; this.dist += (wd - this.dist) * (1 - Math.exp(-dt * 2.5));
    if (!(this.rushT > 0.95)) this.focus.lerp(V(m.x, 1.28 + m.y * 0.55, m.z), 1 - Math.exp(-dt * (this.rushT > 0.4 ? 7 : 11)));
    // pillars never come between you and the view
    { let free = 1; const ex = Math.sin(this.yaw) * this.dist, ez = Math.cos(this.yaw) * this.dist, L2 = ex * ex + ez * ez; for (const b of this.blockers) { const u = ((b.x - this.focus.x) * ex + (b.z - this.focus.z) * ez) / L2; if (u < 0.1 || u > 1.15) continue; const ox = this.focus.x + ex * u - b.x, oz = this.focus.z + ez * u - b.z, r = b.r + 0.25, d2 = ox * ox + oz * oz; if (d2 < r * r) free = Math.min(free, Math.max(0.42, u - Math.sqrt(r * r - d2) / this.dist)); } this.pull += (free - this.pull) * (1 - Math.exp(-dt * (free < this.pull ? 12 : 3))); }
    const D = this.dist * this.pull; this.kick.multiplyScalar(Math.exp(-dt * 12)); this.punch *= Math.exp(-dt * 6);
    const cp = Math.cos(this.pitch), side = 0.42, rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    cam.position.set(this.focus.x + Math.sin(this.yaw) * cp * D + rx * side, Math.max(0.28, this.focus.y + Math.sin(this.pitch) * D + 0.12), this.focus.z + Math.cos(this.yaw) * cp * D + rz * side).add(this.kick);
    // never inside the boss
    if (boss?.solid) { const ox = cam.position.x - boss.x, oz = cam.position.z - boss.z, bd = Math.hypot(ox, oz), min = 1.9; if (bd < min) { cam.position.x = boss.x + ox / (bd || 1) * min; cam.position.z = boss.z + oz / (bd || 1) * min; } }
    const R = Math.hypot(cam.position.x, cam.position.z); if (R > 22.2) { cam.position.x *= 22.2 / R; cam.position.z *= 22.2 / R; }
    const L = this.focus.clone().add(V(rx * side * 0.6, 0.12, rz * side * 0.6)); if (boss && (this.manual < 0)) L.lerp(V(boss.x, boss.h, boss.z), Math.min(0.42, 0.12 + 1.4 / Math.max(3, d)));
    if (this.look.lengthSq() === 0) this.look.copy(L); this.look.lerp(L, 1 - Math.exp(-dt * 10)); cam.lookAt(this.look);
    this.trauma = Math.min(1, this.trauma); const k = this.trauma * this.trauma * settings.shake; cam.rotateZ(Math.sin(t * 47) * 0.012 * k); cam.rotateX(Math.sin(t * 59 + 1) * 0.014 * k); cam.rotateY(Math.sin(t * 53 + 2) * 0.012 * k); this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.fov += (baseFov + (m.speed > 6 ? 4 : 0) - this.fov) * (1 - Math.exp(-dt * 4)); cam.fov = this.fov + this.punch; cam.updateProjectionMatrix();
  }
}

/** Title screen: the hero at the gate, the King small and waiting beyond. Drifts slowly. */
const MENU_AT = new THREE.Vector3();
export function menuCam(cam: THREE.PerspectiveCamera, t: number, x: number, z: number) {
  cam.position.set(x - 1.15 + Math.sin(t * 0.11) * 0.2, 1.0 + Math.sin(t * 0.17) * 0.06, z + 2.75 + Math.sin(t * 0.09) * 0.15); cam.lookAt(x - 1.25, 1.95, z - 8); cam.userData.focus = MENU_AT.set(x, 1.3, z - 3.5); cam.fov = cam.aspect > 1.9 ? 42 : 46; cam.updateProjectionMatrix();
}
