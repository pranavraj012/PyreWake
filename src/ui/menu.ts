// Title screen. The court is live behind it; nothing starts until Play.
import { sound } from '../audio/sound.ts';
import { settingsPanel } from '../core/settings.ts';
import { canFullscreen, isFullscreen, onFullscreen, setFullscreen } from '../core/fullscreen.ts';

export class Menu {
  open = false; onPlay: () => void = () => { }; private root: HTMLElement;
  constructor(app: HTMLElement, controls: () => string) {
    this.root = document.createElement('div'); this.root.id = 'menu';
    this.root.innerHTML = `<div class="title"><h1>Pyrewake</h1><nav><button data-b="play">Play</button>${canFullscreen ? '<button data-b="full"></button>' : ''}<button data-b="sound"></button><button data-b="settings" aria-expanded="false">Settings</button><button data-b="controls" aria-expanded="false">Controls</button></nav></div><div class="controls" hidden><table></table></div><div class="controls set" hidden></div>`;
    app.append(this.root); const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!, panel = q('.controls'), set = q('.set'); set.append(settingsPanel()); const show = (w: 'controls' | 'settings' | '') => { panel.hidden = w !== 'controls'; set.hidden = w !== 'settings'; for (const b of ['controls', 'settings']) q(`[data-b=${b}]`).setAttribute('aria-expanded', String(b === w)); if (w === 'controls') q('table').innerHTML = controls(); };
    q('[data-b=play]').onclick = () => this.play();
    q('[data-b=sound]').onclick = () => { sound.setMuted(!sound.muted); this.labels(); };
    q('[data-b=controls]').onclick = () => show(panel.hidden ? 'controls' : ''); q('[data-b=settings]').onclick = () => show(set.hidden ? 'settings' : '');
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('nav button')) { b.addEventListener('pointerenter', () => sound.play('uiMove', { gain: 0.5, wet: 0.2 })); b.addEventListener('focus', () => sound.play('uiMove', { gain: 0.5, wet: 0.2 })); b.addEventListener('click', () => sound.play(b.dataset.b === 'play' ? 'uiGo' : 'uiPick', { gain: 0.8, wet: 0.5 })); }
    if (canFullscreen) { q('[data-b=full]').onclick = () => void setFullscreen(!isFullscreen()); onFullscreen(() => this.labels()); }
    // arrows move between entries, as on a pad
    this.root.addEventListener('keydown', e => { const b = [...this.root.querySelectorAll<HTMLButtonElement>('nav button')], i = b.indexOf(document.activeElement as HTMLButtonElement), s = /^(ArrowDown|KeyS)$/.test(e.code) ? 1 : /^(ArrowUp|KeyW)$/.test(e.code) ? -1 : 0; if (s) { e.preventDefault(); b[(i + s + b.length) % b.length].focus(); } });
    this.labels();
  }
  private labels() { const set = (k: string, t: string) => { const b = this.root.querySelector(`[data-b=${k}]`); if (b) b.textContent = t; }; set('full', isFullscreen() ? 'Leave full screen' : 'Full screen'); set('sound', sound.muted ? 'Sound: off' : 'Sound: on'); }
  show() { this.open = true; this.labels(); document.body.classList.add('menu'); document.exitPointerLock?.(); this.root.querySelector<HTMLButtonElement>('[data-b=play]')!.focus({ preventScroll: true }); }
  play() { if (!this.open) return; this.open = false; document.body.classList.remove('menu'); (document.activeElement as HTMLElement | null)?.blur(); this.onPlay(); }
}
