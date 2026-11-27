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
  /** First person: the hero's own body is out of the lens while it plays. */ first?: boolean;
  /** A cut: the camera goes straight to the shot, no easing in. */ snap?: boolean;
  /** Roll of the shot about its view axis, radians, at the boss's clock. */ roll?(t: number): number;
  /** Darkness over the picture (0 to 1) at the boss's clock: a flash, a dim. */ dim?(t: number): number;
}

const EASE_OUT = 0.7;
/** While a reward is on offer, time runs at this rate. */
export const OFFER_SLOW = 0.35;

export class Moment {
  spec: MomentSpec | null = null; private eye = new THREE.Vector3(); private at = new THREE.Vector3(); private sEye = new THREE.Vector3(); private sAt = new THREE.Vector3(); private fresh = true;
  /** Camera shake (0 to 1, decays by itself); a cue kicks it. */ trauma = 0; private cued = 0;
  get active() { return !!this.spec; }
  get letterbox() { return !!this.spec?.letterbox; }
  /** After a stop, the camera eases from where the moment left it to wherever the follow camera puts it. */ private ease = 0; private fromFp = false; private from = new THREE.Vector3(); private fromQ = new THREE.Quaternion(); private last = new THREE.Vector3(); private lastQ = new THREE.Quaternion();
  /** A hard reset for a fresh attempt: nothing staged, no ease back, no shake. */ reset() { this.spec = null; this.ease = 0; this.fromFp = false; this.trauma = 0; this.cued = 0; }
  start(spec: MomentSpec) { this.spec = spec; this.fresh = true; this.cued = 0; this.trauma = 0; this.ease = 0; }
  stop() { if (this.spec) { this.from.copy(this.last); this.fromQ.copy(this.lastQ); this.ease = EASE_OUT; this.fromFp = !!this.spec.first; } this.spec = null; }
  /** Whether the hero's own body is hidden: in first person, and while the camera is still close to where it was. */
  get hideHero() { return this.spec ? !!this.spec.first : this.fromFp && this.ease > EASE_OUT * 0.5; }
  /** Darkness over the picture at the boss's clock t (0 when nothing is staged). */ dimAt(t: number) { return this.spec?.dim?.(t) ?? 0; }
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
    if (this.fresh) { this.sEye.copy(cam.position); this.sAt.copy(this.at); this.fresh = false; } const k = s.snap ? 1 : 1 - Math.exp(-dt * 9);
    this.sEye.lerp(this.eye, k); this.sAt.lerp(this.at, k); cam.position.copy(this.sEye); cam.lookAt(this.sAt); if (s.roll) cam.rotateZ(s.roll(t));
    this.trauma *= Math.exp(-dt * 2.2); const j = this.trauma * this.trauma; if (j > 0) { cam.rotateZ(Math.sin(time * 47) * 0.02 * j); cam.rotateX(Math.sin(time * 59) * 0.024 * j); }
    cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); cam.userData.focus = this.sAt; this.last.copy(cam.position); this.lastQ.copy(cam.quaternion); return true;
  }
  /** After the camera has been set by the follow camera: while easing out of a moment, blend from the moment's last shot. Call every frame. */
  settle(cam: THREE.PerspectiveCamera, dt: number) { if (this.spec || this.ease <= 0) return; this.ease = Math.max(0, this.ease - dt); const k = this.ease / EASE_OUT * this.ease / EASE_OUT; cam.position.lerp(this.from, k); cam.quaternion.slerp(this.fromQ, k); cam.updateMatrixWorld(); }
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

/** The shot for a reward on offer: a low camera (about half a metre off the floor) behind and beside the hero, looking at the boss over his shoulder.
 *  The look point is the boss's chest or head, tilted up no more than `tilt` degrees (38 unless the boss says otherwise), so the floor and the fires stay in the lower frame.
 *  It dollies in half a metre over the offer. Framing comes from the actual positions, so it works for any boss. */
export function offerSpec(hero: { x: number; z: number }, boss: () => { x: number; y: number; z: number; tilt?: number; back?: number }): MomentSpec {
  return {
    frame: (t, eye, at) => {
      const b = boss(), dx = b.x - hero.x, dz = b.z - hero.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, sx = -uz, sz = ux, u = Math.min(1, t / 0.9);
      const back = (b.back ?? 2.3) - 0.5 * u, side = b.back ? 1.2 : 0.9, eh = 0.5 + 0.04 * u;
      eye.set(hero.x - ux * back + sx * side, eh, hero.z - uz * back + sz * side);
      const hd = Math.hypot(b.x - eye.x, b.z - eye.z) || 1, cap = eh + Math.tan((b.tilt ?? 38) * Math.PI / 180) * hd;
      at.set(b.x, Math.min(b.y, cap), b.z); return 62 - 4 * u;
    },
    rate: () => OFFER_SLOW,
    letterbox: true,
  };
}

/** A reward on offer, staged by a boss page: the slow shot starts when the chance opens, the press is shown once it has settled, and a miss eases the camera back.
 * `staged` means a moment the boss has started instead (the press was taken): the offer hands the moment over and stays out of it. */
export class Offer {
  private on = false; private age = 0; private shown = '';
  private moment: Moment; private spec: MomentSpec; private show: (reward: string, secs: number) => void; private settleAt: number;
  constructor(moment: Moment, spec: MomentSpec, show: (reward: string, secs: number) => void, settleAt = 0.9) { this.moment = moment; this.spec = spec; this.show = show; this.settleAt = settleAt; }
  /** Forgets any offer on the table (a fresh attempt). */ reset() { this.on = false; this.age = 0; this.shown = ''; }
  get active() { return this.on; }
  step(dt: number, reward: string | null, left: number, staged: boolean) {
    if (staged || !reward) { if (this.on) { this.on = false; this.shown = ''; if (!staged) this.moment.stop(); } return; }
    if (!this.on) { this.on = true; this.age = 0; this.shown = ''; this.moment.start(this.spec); }
    this.age += dt;
    if (this.age >= this.settleAt && this.shown !== reward) { this.shown = reward; this.show(reward, left / OFFER_SLOW); }
  }
}
