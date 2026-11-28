// Animation workbench: ?bench=player or ?bench=king. Pick a motion, scrub, slow down, orbit.
import * as THREE from 'three';
import type { Clip } from './anim/pose.ts';
import type { Motor } from './player/motor.ts';
import type { PlayerView } from './player/view.ts';
import type { KingMode } from './bosses/king/king.ts';
import type { KingView } from './bosses/king/kingView.ts';

interface B { scene: THREE.Scene; cam: THREE.PerspectiveCamera; m: Motor; pv: PlayerView; king: KingView; clips: Record<string, Clip>; kingClips: Record<string, Clip>; modes: KingMode[]; which: string; step: (dt: number) => void; setTime: (t: number) => void }

export function mountBench(b: B) {
  const king = b.which !== 'player', names = king ? b.modes as string[] : ['idle', 'ready', 'guard', 'guardwalk', 'walk', 'run', 'sprint', ...Object.keys(b.clips)];
  let cur = names[0], time = 0, t = 0, speed = 1, play = true, yaw = 0.7, pitch = 0.08, dist = king ? 7 : 3.4, auto = true;
  const place = () => { b.m.x = 0; b.m.z = 4; b.m.yaw = Math.PI; b.m.target = null; b.king.sim.x = king ? 0 : 60; b.king.group.visible = king; b.king.sim.z = king ? 2 : -9; b.king.sim.yaw = 0; if (b.which === 'beneath') { b.king.sim.form = 2; b.king.sim.armed = false; b.king.show(true); } b.pv.reset(); };
  const pick = (n: string) => { cur = n; time = 0; b.m.state = 'free'; b.m.clip = null; b.m.guardHeld = false; b.m.can.skill1 = true; b.m.speed = 0; b.m.calm = n === 'ready' ? 0 : 99; place(); if (king) b.king.sim.set(n as KingMode); else if (b.clips[n]) { b.m.clip = b.clips[n]; b.m.state = 'clip'; b.m.t = 0; b.m.started++; (b.m as never as { lastMove: number }).lastMove = 0; } };
  const tick = (dt: number) => {
    const d = dt * speed; time += d; t += d; b.setTime(t);
    if (king) { b.king.drive(d, Math.sin(time * 0.2), cur === 'stalk' ? 40 : 9, t); b.pv.update(d, b.m, t); return; }
    const c = b.clips[cur]; const sp: Record<string, number> = { walk: 0.4, run: 0.9, sprint: 1 };
    if (c) { if (time > c.dur + 0.7) pick(cur); b.m.moveYaw = b.m.yaw; b.m.step(d, 0, 0, []); }
    else { b.m.guardHeld = cur.startsWith('guard'); if (cur === 'guardwalk') { b.m.step(d, 0.9, 0, []); b.pv.update(d, b.m, t); return; } if (cur === 'sprint') (b.m as { sprintT: number }).sprintT = 9; b.m.step(d, 0, sp[cur] ? -sp[cur] : 0, []); if (cur === 'ready') b.m.calm = 0; if (b.m.z < -14) { const k = b.m.z; b.m.z += 22; void k; b.pv.footing.adopt(b.pv.footing.world[0].add(new THREE.Vector3(0, 0, 22)), b.pv.footing.world[1].add(new THREE.Vector3(0, 0, 22))); b.pv.gait.plant.forEach(v => { v.z += 22; }); b.pv.gait.lift.forEach(v => { v.z += 22; }); b.pv.gait.pos.forEach(v => { v.z += 22; }); b.pv.chains.reset(); } }
    b.pv.update(d, b.m, t);
  };
  const ui = document.createElement('div'); ui.id = 'bench';
  ui.innerHTML = `<select>${names.map(n => `<option>${n}</option>`).join('')}</select> <label>speed <input type="range" min="0" max="1.5" step="0.05" value="1"></label> <button>pause</button> <button>step</button> <span></span>`;
  document.getElementById('app')!.append(ui);
  const [pb, sb] = ui.querySelectorAll('button'); ui.querySelector('select')!.onchange = e => pick((e.target as HTMLSelectElement).value); ui.querySelector('input')!.oninput = e => { speed = +(e.target as HTMLInputElement).value; }; pb.onclick = () => { play = !play; }; sb.onclick = () => { play = false; tick(1 / 60); };
  addEventListener('pointermove', e => { if (e.buttons & 1 && (e.target as HTMLElement).tagName === 'CANVAS') { yaw -= e.movementX * 0.008; pitch = Math.max(-0.1, Math.min(1.4, pitch + e.movementY * 0.006)); } });
  addEventListener('wheel', e => { dist *= e.deltaY > 0 ? 1.1 : 0.9; });
  pick(cur);
  Object.assign(window, { __bench: { pick, advance: (s: number) => { play = false; for (let k = 0; k < Math.round(s * 60); k++) tick(1 / 60); }, view: (y: number, p: number, d: number) => { yaw = y; pitch = p; dist = d; }, names } });
  return {
    tick: (dt: number) => { if (play) tick(dt); },
    camera: () => { const x = king ? b.king.x : b.m.x, z = king ? b.king.z : b.m.z, y = king ? 1.9 : 1.0, c = Math.cos(pitch); b.cam.position.set(x + Math.sin(yaw) * c * dist, Math.max(0.15, y + Math.sin(pitch) * dist), z + Math.cos(yaw) * c * dist); b.cam.lookAt(x, y, z); b.cam.fov = 42; b.cam.updateProjectionMatrix(); (ui.querySelector('span') as HTMLElement).textContent = `${cur} ${time.toFixed(2)}s`; },
  };
}
