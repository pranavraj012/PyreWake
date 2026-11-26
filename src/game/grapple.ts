// A grapple: a boss has the hero. For a few seconds the fight is a close scene the boss stages, and a quick-time event decides what it costs.
// Generic, so any fight can use it: the page starts it on the boss's event, gives it the input and the camera while it runs, and hands `prog`
// (0-1, how far the hero has torn free) to the boss's simulation, which owns the hold and the damage. The scene ends when the boss lets go.
import * as THREE from 'three';
import type { Press } from '../player/motor.ts';
import { label } from '../input/bindings.ts';

export interface GrappleOpt {
  /** Seconds before mashing counts (the catch itself), and each press's worth; the bar drains while you rest. */ from: number; per?: number; drain?: number;
  /** What to do, under the key. */ text: string;
  /** The close shot: where the camera stands and what it looks at, given the scene's clock. */ frame: (t: number, eye: THREE.Vector3, at: THREE.Vector3) => number;
}

export class Grapple {
  t = -1; prog = 0; won = false; private o: GrappleOpt | null = null; private el: HTMLElement; private bar: HTMLElement; private key: HTMLElement; private kick = 0;
  private eye = new THREE.Vector3(); private at = new THREE.Vector3(); private sEye = new THREE.Vector3(); private sAt = new THREE.Vector3();
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div'); this.el.className = 'grapple';
    this.el.innerHTML = '<kbd></kbd><div class="gbar"><i></i></div><p></p>'; parent.appendChild(this.el);
    this.key = this.el.querySelector('kbd')!; this.bar = this.el.querySelector('i')!;
  }
  get active() { return this.t >= 0; }
  start(o: GrappleOpt, dev: 'keys' | 'pad' | 'touch') {
    this.o = o; this.t = 0; this.prog = 0; this.won = false; this.kick = 0; this.sEye.set(0, 0, 0);
    this.key.textContent = dev === 'touch' ? 'Tap' : label('attack', dev === 'pad' ? 'pad' : 'keys'); this.el.querySelector('p')!.textContent = o.text; this.el.classList.remove('on', 'won');
  }
  /** Presses this frame: any attack, dodge or jump tears at the hold once the catch has landed. */
  press(ev: Press[]) {
    const o = this.o; if (!o || this.t < o.from || this.won) return;
    for (const e of ev) if (!e.up && (e.a === 'attack' || e.a === 'dodge' || e.a === 'jump')) { this.prog = Math.min(1, this.prog + (o.per ?? 0.1)); this.kick = 1; }
    if (this.prog >= 1) { this.won = true; this.el.classList.add('won'); }
  }
  step(dt: number) {
    const o = this.o; if (!o || this.t < 0) return; this.t += dt; this.kick *= Math.exp(-dt * 14);
    if (this.t >= o.from && !this.won) this.prog = Math.max(0, this.prog - dt * (o.drain ?? 0.3));
    this.el.classList.toggle('on', this.t >= o.from); this.bar.style.width = `${Math.round(this.prog * 100)}%`; this.key.style.transform = `scale(${1 + this.kick * 0.18})`;
  }
  /** The close shot, eased in from wherever the camera was. Returns false when there is nothing to frame. */
  camera(cam: THREE.PerspectiveCamera, dt: number) {
    const o = this.o; if (!o || this.t < 0) return false; const fov = o.frame(this.t, this.eye, this.at);
    if (this.sEye.lengthSq() === 0) { this.sEye.copy(cam.position); this.sAt.copy(this.at); } const k = 1 - Math.exp(-dt * 7);
    this.sEye.lerp(this.eye, k); this.sAt.lerp(this.at, k); cam.position.copy(this.sEye); cam.lookAt(this.sAt); cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
    cam.userData.focus = this.sAt; return true;
  }
  stop() { this.t = -1; this.o = null; this.el.classList.remove('on', 'won'); }
}
