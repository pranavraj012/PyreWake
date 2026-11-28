// The fight's composed hero shots: the last rites, the finale, the execute and reckon finishers, and the hero's own turn. The follow camera
// gives way to them while the hero is in one. Any boss's fight uses them, so they live with the shared
// camera. Returns false when the normal camera should run.
import * as THREE from 'three';
import type { Fight } from '../combat/fight.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), E = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

export function actionCam(cam: THREE.PerspectiveCamera, f: Fight, hero: number, base: number): boolean {
  const { m, boss: k } = f, c = m.clip?.name, dx = k.hx - m.x, dz = k.hz - m.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, sx = fz, sz = -fx;
  let px = 0, py = 0, pz = 0, lx = 0, ly = 0, lz = 0, fov = base;
  if (c === 'rites' && m.t < 4.5) {
    const r = m.ritesFrom, gx = -Math.sin(r.a), gz = -Math.cos(r.a), hx = gz, hz = -gx, far = Math.hypot(r.x - k.hx, r.z - k.hz) > 15; // g: from where he stood, toward it
    if (m.t < 0.95) { const u = E(0, 0.95, m.t); const ah = Math.min(1.0, Math.max(0, d - 2.2)); px = m.x + gx * ah + hx * (2.5 - u * 0.5); pz = m.z + gz * ah + hz * (2.5 - u * 0.5); py = 1.15 + u * 0.1; lx = m.x + gx * 0.2; lz = m.z + gz * 0.2; ly = 1.3; fov = 38; }
    else if (m.t < 1.92) { const u = E(0.95, 1.92, m.t); px = m.x - hx * (3.0 + u * 0.8) - gx * 0.9; pz = m.z - hz * (3.0 + u * 0.8) - gz * 0.9; py = 0.4; lx = m.x + gx * (0.5 + u * 0.4); lz = m.z + gz * (0.5 + u * 0.4); ly = 1.4 + u * 0.6; fov = 46 + u * 4; }
    else if (m.t < 2.9) { const u = E(1.92, 2.9, m.t), w = 6.4 - u * 0.7, cx = far ? r.x + gx * 3 : k.hx, cz = far ? r.z + gz * 3 : k.hz; px = cx + hx * w - gx * 0.8; pz = cz + hz * w - gz * 0.8; py = 0.9; lx = cx; lz = cz; ly = 1.5; fov = 44; }
    else { const u = E(2.9, 4.5, m.t), yx = Math.sin(m.yaw), yz = Math.cos(m.yaw), out = E(3.58, 3.75, m.t) * 0.5; px = m.x + yx * (2.7 - u * 0.3 + out) + yz * 0.7; pz = m.z + yz * (2.7 - u * 0.3 + out) - yx * 0.7; py = 0.5 + u * 0.1; lx = m.x - yx * 1.2; lz = m.z - yz * 1.2; ly = 1.15 + u * 0.2; fov = 46; }
  } else if (c === 'finale' && m.t > 0.3) {
    if (m.t < 1.4) { px = m.x - sx * 3.3 - fx * 0.5; pz = m.z - sz * 3.3 - fz * 0.5; py = 0.8; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.4; fov = 42 - 7 * E(0.5, 1.4, m.t); }
    else { px = m.x + sx * 3.6 - fx * 0.8; pz = m.z + sz * 3.6 - fz * 0.8; py = 0.5; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.6; fov = 48; }
  } else if (c === 'execute' && m.t > 0.3 && m.t < 2.1) { px = m.x - sx * 3.1 - fx * 0.2; pz = m.z - sz * 3.1 - fz * 0.2; py = 0.75; lx = m.x + fx * 0.8; lz = m.z + fz * 0.8; ly = 1.45; fov = 42 - 5 * E(0.6, 1.6, m.t); }
  else if (c === 'reckon' && m.t > 1.02 && m.t < 2.0) { px = m.x + sx * 1.5 - fx * 2.4; pz = m.z + sz * 1.5 - fz * 2.4; py = 0.85; lx = m.x + fx * 0.6; lz = m.z + fz * 0.6; ly = 1.5; fov = 42; }
  else if (hero > 0) { px = m.x - sx * 4.0 - fx * 0.6; pz = m.z - sz * 4.0 - fz * 0.6; py = 0.6; lx = m.x + fx * 0.9; lz = m.z + fz * 0.9; ly = 1.8; fov = 46; }
  else return false;
  const R = Math.hypot(px, pz); if (R > 22) { px *= 22 / R; pz *= 22 / R; }
  cam.position.set(px, py, pz); cam.lookAt(lx, ly, lz); (cam.userData.focus as THREE.Vector3 | undefined ?? (cam.userData.focus = V())).set(lx, ly, lz); cam.userData.frame = true; cam.fov = fov * (cam.aspect > 1.9 ? 0.94 : 1); cam.updateProjectionMatrix(); return true;
}
