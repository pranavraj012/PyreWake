// Turns fight events into what you see, hear and feel.
import * as THREE from 'three';
import { sfx } from '../audio/sfx.ts';
import type { KingView } from '../boss/kingView.ts';
import type { Fight } from '../combat/fight.ts';
import { D } from '../combat/difficulty.ts';
import type { Input } from '../input/input.ts';
import type { PlayerView } from '../player/view.ts';
import { CueMark, type Fx } from '../render/impact.ts';
import type { Post } from '../render/post.ts';
import type { Hud } from '../ui/hud.ts';
import type { FollowCam } from './camera.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export class Director {
  cue = new CueMark(); private at = V(); private p = V(); private dir = V(); private hurtK = 0; private slowK = 0; private fadeK = 0;
  f: Fight; pv: PlayerView; kv: KingView; fx: Fx; cam: FollowCam; post: Post; hud: Hud; input: Input; camera: THREE.Camera;
  constructor(o: { f: Fight; pv: PlayerView; kv: KingView; fx: Fx; cam: FollowCam; post: Post; hud: Hud; input: Input; camera: THREE.Camera }) { this.f = o.f; this.pv = o.pv; this.kv = o.kv; this.fx = o.fx; this.cam = o.cam; this.post = o.post; this.hud = o.hud; this.input = o.input; this.camera = o.camera; }
  private buzz(ms: number) { if (this.input.lastDevice === 'touch') try { navigator.vibrate?.(ms); } catch { /* not supported */ } }
  /** Slash angle on screen, from the blade's motion. */
  private screenAngle(v: THREE.Vector3) { const r = V().setFromMatrixColumn(this.camera.matrixWorld, 0), u = V().setFromMatrixColumn(this.camera.matrixWorld, 1); return Math.atan2(v.dot(u), v.dot(r)); }

  /** After the simulation and views have stepped. `dt` is simulated time, 0 while frozen on a hit. */
  step(dt: number, real: number, t: number) {
    const { f, pv, kv, fx, cam } = this, m = f.m, k = f.king;
    for (const e of f.ev) switch (e.k) {
      case 'hit': {
        const p = kv.nearest(pv.base, pv.tip, this.p), pw = e.power, v = pv.tipVel.clone().normalize(), away = V(k.x - m.x, 0, k.z - m.z).normalize(); kv.flinch(Math.atan2(away.x, away.z), pw, p);
        // bring the flash to the near side of the limb
        const n = p.clone().addScaledVector(away, -0.16), an = this.screenAngle(v);
        fx.bursts.add('slash', n, 1.1 + pw * 0.5, 0.17, t, an, 1.6, 0.7, 0.25); if (pw > 1.2) fx.bursts.add('slash', n, 0.9 + pw * 0.35, 0.2, t + 0.02, an + 0.5, 1.5, 0.45, 0.1); fx.bursts.add('flare', n, 1.0 + pw * 0.55, 0.16, t);
        if (pw >= 1.9) fx.bursts.add('fire', n, 0.9 + pw * 0.3, 0.4, t, an);
        const d = v.clone().multiplyScalar(0.6).addScaledVector(away, 0.5); d.y += 0.25;
        fx.sparks.emit(n, d, Math.round(12 + pw * 14), 3 + pw * 1.6, 1.3, 0.5, t); fx.gore.emit(n, d, Math.round(10 + pw * 9), 2.4 + pw * 0.9, 1.4, 0.8, t); fx.sparks.emit(n, V(0, 0.4, 0), Math.round(3 + pw * 3), 0.9, 2, -1.2, t);
        cam.hit(pw, v); sfx.hit(pw); this.buzz(8 + pw * 8); break;
      }
      case 'cue': this.cue.start(e.strike.kind, e.strike.mark, e.lead); if (e.strike.kind === 'white') sfx.cueWhite(); else { sfx.cueRed(); this.buzz(40); } break;
      case 'block': { const p = pv.base.clone().lerp(pv.tip, 0.4); fx.bursts.add('flare', p, 1.8, 0.18, t, 0, 1.5, 1.1, 0.7); fx.bursts.add('slash', p, 1.6, 0.16, t, 1.1, 1.6, 1.2, 0.7); fx.sparks.emit(p, V(0, 0.3, 0), 36, 5, 2, 0.5, t); cam.trauma = Math.max(cam.trauma, 0.45); sfx.block(); this.buzz(25); break; }
      case 'parry': { const p = pv.base.clone().lerp(pv.tip, 0.5); fx.bursts.add('glint', p, 3.4, 0.4, t, 0.3, 1.5, 1.25, 0.9); fx.bursts.add('ring', p, 4.2, 0.45, t, 0, 1.4, 0.9, 0.5); fx.bursts.add('flare', p, 3, 0.25, t, 0, 1.5, 1.1, 0.7); fx.sparks.emit(p, V(0, 0.5, 0), 90, 7, 2, 0.8, t); cam.trauma = 0.7; cam.punch = -7; kv.flinch(Math.atan2(k.x - m.x, k.z - m.z), 2); sfx.parry(); this.buzz(50); this.slowK = 1; break; }
      case 'evade': if (e.perfect) { sfx.perfect(); this.slowK = 1; cam.punch = -4; pv.ghosts.snap(t); fx.sparks.emit(V(m.x, 0.9, m.z), V(0, 0.3, 0), 30, 2, 2.2, -1.3, t); pv.ember = 1.6; } break;
      case 'hurt': { const a = V(k.x - m.x, 0, k.z - m.z).normalize(), p = V(m.x + a.x * 0.25, 1.15, m.z + a.z * 0.25); this.hurtK = e.down ? 1 : 0.8; pv.flash.value.set(1, 0.1, 0.04, 0.7); fx.bursts.add('slash', p, 1.8, 0.2, t, 0.8, 1.5, 0.15, 0.06);  fx.gore.emit(p, a.clone().negate().add(V(0, 0.4, 0)), 26, 3.4, 1.4, 0.8, t); fx.sparks.emit(p, V(0, 0.4, 0), 18, 3, 2, -0.9, t); cam.trauma = e.down ? 0.95 : 0.75; this.hud.hurt(); sfx.hurt(); this.buzz(e.down ? 120 : 70); break; }
      case 'rush': sfx.vanish(); cam.rushT = 1.3; break;
      case 'detonate': {
        const b = f.trail, n = 7, L = Math.hypot(b.bx - b.ax, b.bz - b.az); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, p = V(b.ax + (b.bx - b.ax) * u, 0, b.az + (b.bz - b.az) * u), w = i * 0.035; fx.bursts.add('pillar', p, 2.6 + Math.random() * 1.2, 0.8, t + w); fx.bursts.add('fire', V(p.x, 0.9 + Math.random() * 0.8, p.z), 2.4 + Math.random(), 0.7, t + w, Math.random() * 6); fx.sparks.emit(V(p.x, 0.6, p.z), V(0, 1, 0), 16, 5, 2, 0.9, t + w); fx.sparks.emit(V(p.x, 0.6, p.z), V(0, 0.8, 0), 10, 2.4, 2.2, -2, t + w); }
        const mid = V(b.ax + (b.bx - b.ax) * 0.5, 0.06, b.az + (b.bz - b.az) * 0.5), c = e.hit ? V(k.x, 1.4, k.z) : mid.clone().setY(1.2); fx.bursts.add('ground', mid, L + 6, 0.7, t); fx.bursts.add('fire', c, 5, 0.75, t + 0.06, 1); fx.bursts.add('flare', c, 9, 0.35, t); fx.puffs.emit(mid, 16, 3.4, 1.8, t); pv.boomAt.copy(c).setY(1.8); pv.boomK = 1; cam.trauma = 1; pv.ember = 1.6; sfx.boom(); this.buzz(90); break;
      }
      case 'heal': sfx.heal(); break;
      case 'ready': sfx.ready(); pv.ember = 1.5; break;
      case 'deny': sfx.deny(); this.hud.deny(e.a); break;
      case 'bossDown': this.hud.say('It falls', 3.2); this.slowK = 1; cam.punch = -6; cam.trauma = 0.8; sfx.thud(); break;
      case 'bossUp': this.hud.say('It rises again', 2.4); sfx.cueRed(); break;
      case 'dead': this.hud.say('Extinguished', 2.8, 'dead'); sfx.die(); break;
      case 'reset': pv.reset(); kv.settle(); this.cue.stop(); this.fadeK = 1; cam.yaw = 0.12; break;
    }
    if (dt > 0) {
      for (const e of m.events) {
        if (e === 'swing') sfx.swing(m.clip?.power ?? 1); if (e.startsWith('clip:dodge')) sfx.dodge(); if (e === 'fx:erupt' || e === 'fx:slam') sfx.erupt(); if (e === 'fx:flare') sfx.flare(); if (e === 'fx:crescent') sfx.flare();
      }
      for (const e of kv.fxFired) { if (e === 'slam' || e === 'thud') sfx.thud(); else sfx.swing(3); }
      // a cue dies with its attack
      if (this.cue.active && (!k.committed || f.ev.some(e => e.k === 'hurt' || e.k === 'block' || e.k === 'parry'))) this.cue.stop();
      if (this.cue.active && this.cue.kind === 'red') { kv.flash.value.set(1, 0.03, 0.02, 0.75 + 0.25 * Math.sin(t * 20)); const c = kv.mark('handL', this.p); kv.flashAt.value.set(c.x, c.y, c.z, 1.15); }
    }
    this.cue.update(dt > 0 ? (k.committed && k.mt < (k.strikes[0]?.t[0] ?? 0) ? dt : real) : 0, kv.mark(this.cue.mark, this.at));
    cam.trauma = Math.max(cam.trauma, pv.shake, kv.shake * Math.max(0, 1 - Math.hypot(k.x - m.x, k.z - m.z) / 16));
    pv.fireK = f.fire / D.fireMax;
    // --- screen grade
    this.hurtK *= Math.exp(-real * 2.6); this.slowK *= Math.exp(-real * 2.2); const low = f.hp > 0 && f.hp < D.hp * 0.3 ? 0.28 + 0.12 * Math.sin(t * 4.2) : 0;
    this.post.pulse.value.w = Math.max(this.hurtK * 0.42, low * 0.8, m.dead ? 0.3 : 0); this.post.desat.value += ((m.dead ? 0.8 : this.slowK * 0.55) - this.post.desat.value) * Math.min(1, real * 10);
    const out = f.deadT > 2.5 ? Math.min(1, (f.deadT - 2.5) / 0.6) : 0; this.fadeK = Math.max(out, this.fadeK - real * 1.6); this.post.fade.value = this.fadeK;
  }
}
