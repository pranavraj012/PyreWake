// A staged moment inside a fight: a boss's grab, the hero's climb to strike a fallen boss. For a few seconds the page hands the camera to a short
// scene, the hero is drawn where the scene puts him (the motor never moves), and the fight may run slow. Every timing is the boss's own clock
// (the simulation owns what happens and when; this only stages it), so a skipped frame or a slow one never puts the picture out of step.
// A Prompt is separate: a quick-time press shown while a chance lasts. Taking it may start a moment; missing it only loses the chance.
import * as THREE from 'three';
import { label } from '../input/bindings.ts';

export interface MomentSpec {
  /** Where the camera stands and looks at the boss's clock t; returns the field of view. */ frame(t: number, eye: THREE.Vector3, at: THREE.Vector3): number;
  /** Where the hero is drawn, relative to where he stands. */ hero?(t: number, out: THREE.Vector3): void;
  /** His roll head over heels, radians. */ tumble?(t: number): number;
  /** How fast the fight runs (1 is normal). */ rate?(t: number): number;
  /** Letterbox bars slide in while it plays, and the HUD goes. */ letterbox?: boolean;
  /** Named moments on the boss's clock: the page plays the sound, the dust, the shake (`due` reports each one once). */ cues?: { t: number; name: string }[];
}

export class Moment {
  spec: MomentSpec | null = null; private eye = new THREE.Vector3(); private at = new THREE.Vector3(); private sEye = new THREE.Vector3(); private sAt = new THREE.Vector3(); private fresh = true;
  /** Camera shake (0 to 1, decays by itself); a cue kicks it. */ trauma = 0; private cued = 0;
  get active() { return !!this.spec; }
  get letterbox() { return !!this.spec?.letterbox; }
  start(spec: MomentSpec) { this.spec = spec; this.fresh = true; this.cued = 0; this.trauma = 0; }
  stop() { this.spec = null; }
  rate(t: number) { return this.spec?.rate?.(t) ?? 1; }
  /** The cues whose time has come since the last call (in order). */
  due(t: number): string[] {
    const list = this.spec?.cues; if (!list) return []; const out: string[] = [];
    while (this.cued < list.length && list[this.cued].t <= t) out.push(list[this.cued++].name); return out;
  }
  /** A blow or a fall: shake the camera, which settles by itself. */ kick(v: number) { this.trauma = Math.min(1, Math.max(this.trauma, v)); }
  /** Fills the hero's drawn offset and roll; zero when nothing is staged. */
  hero(t: number, out: THREE.Vector3) { out.set(0, 0, 0); this.spec?.hero?.(t, out); return this.spec?.tumble?.(t) ?? 0; }
  camera(cam: THREE.PerspectiveCamera, dt: number, t: number, time = 0) {
    const s = this.spec; if (!s) return false; const fov = s.frame(t, this.eye, this.at);
    if (this.fresh) { this.sEye.copy(cam.position); this.sAt.copy(this.at); this.fresh = false; } const k = 1 - Math.exp(-dt * 9);
    this.sEye.lerp(this.eye, k); this.sAt.lerp(this.at, k); cam.position.copy(this.sEye); cam.lookAt(this.sAt);
    this.trauma *= Math.exp(-dt * 2.2); const j = this.trauma * this.trauma; if (j > 0) { cam.rotateZ(Math.sin(time * 47) * 0.02 * j); cam.rotateX(Math.sin(time * 59) * 0.024 * j); }
    cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); cam.userData.focus = this.sAt; return true;
  }
}

/** A quick-time press: a key and a line, while the chance lasts. */
export class Prompt {
  private el: HTMLElement; private bar: HTMLElement; private left = 0; private len = 1;
  constructor(parent: HTMLElement) { this.el = document.createElement('div'); this.el.className = 'qte'; this.el.innerHTML = '<kbd></kbd><div class="gbar"><i></i></div><p></p>'; parent.appendChild(this.el); this.bar = this.el.querySelector('i')!; }
  get on() { return this.left > 0; }
  show(action: 'attack' | 'dodge' | 'jump', text: string, secs: number, dev: 'keys' | 'pad' | 'touch') { this.left = this.len = secs; this.el.querySelector('kbd')!.textContent = dev === 'touch' ? 'Tap' : label(action, dev === 'pad' ? 'pad' : 'keys'); this.el.querySelector('p')!.textContent = text; this.el.classList.add('on'); }
  step(dt: number) { if (this.left <= 0) return; this.left -= dt; this.bar.style.width = `${Math.max(0, this.left / this.len) * 100}%`; if (this.left <= 0) this.hide(); }
  hide() { this.left = 0; this.el.classList.remove('on'); }
}
