// Title screen. The court is live behind it; nothing starts until Play.
import { sound } from '../audio/sound.ts';
import { saveSettings, settings, settingsPanel, onSettings } from '../core/settings.ts';
import { SPELLS, SPELL_IDS } from '../combat/spells.ts';
import { label } from '../input/bindings.ts';
import { canFullscreen, isFullscreen, onFullscreen, setFullscreen } from '../core/fullscreen.ts';

export class Menu {
  open = false; onPlay: () => void = () => { }; onTrain: () => void = () => { }; /** The other boss, once it is open to you. */ onOther: () => void = () => { }; private root: HTMLElement;
  constructor(app: HTMLElement, controls: () => string) {
    this.root = document.createElement('div'); this.root.id = 'menu';
    this.root.innerHTML = `<div class="title"><h1>Pyrewake</h1><nav><button data-b="play">Play</button><button data-b="train">Training</button><button data-b="spells" aria-expanded="false">Spells</button><button data-b="other" hidden></button>${canFullscreen ? '<button data-b="full"></button>' : ''}<button data-b="sound"></button><button data-b="settings" aria-expanded="false">Settings</button><button data-b="controls" aria-expanded="false">Controls</button></nav><p class="hush">Click or press any key once for sound: browsers don't count a controller.</p></div><div class="controls" hidden><table></table></div><div class="controls set" hidden></div><div class="controls spells" hidden><p>Carry two. Pick one to take the place of the other.</p><div class="list"></div></div>`;
    app.append(this.root); const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!, panel = q('.controls'), set = q('.set'); set.append(settingsPanel()); const sp = q('.spells'), show = (w: 'controls' | 'settings' | 'spells' | '') => { panel.hidden = w !== 'controls'; set.hidden = w !== 'settings'; sp.hidden = w !== 'spells'; for (const b of ['controls', 'settings', 'spells']) q(`[data-b=${b}]`).setAttribute('aria-expanded', String(b === w)); if (w === 'controls') q('table').innerHTML = controls(); };
    q('[data-b=play]').onclick = () => this.play();
    q('[data-b=other]').onclick = () => { if (this.open) { this.close(); this.onOther(); } };
    q('[data-b=train]').onclick = () => { if (this.open) { this.close(); this.onTrain(); } };
    q('[data-b=sound]').onclick = () => { sound.setMuted(!sound.muted); this.labels(); };
    q('[data-b=controls]').onclick = () => show(panel.hidden ? 'controls' : ''); q('[data-b=spells]').onclick = () => show(sp.hidden ? 'spells' : '');
    // two carried: a new pick takes the place of whichever was chosen longer ago
    let next = 1; const list = q('.spells .list'); list.innerHTML = SPELL_IDS.map(id => `<button data-s="${id}"><kbd></kbd><b>${SPELLS[id].name}</b><span>${SPELLS[id].info}</span><em>${SPELLS[id].cost} fire</em></button>`).join('');
    for (const b of list.querySelectorAll<HTMLButtonElement>('button')) b.onclick = () => { const id = b.dataset.s as keyof typeof SPELLS, s = [...settings.spells] as typeof settings.spells; if (s.includes(id)) return; s[next] = id; next = 1 - next; saveSettings({ spells: s }); sound.play('uiPick', { gain: 0.7, wet: 0.4 }); };
    onSettings(() => { for (const b of list.querySelectorAll<HTMLButtonElement>('button')) { const i = settings.spells.indexOf(b.dataset.s as keyof typeof SPELLS); b.classList.toggle('on', i >= 0); b.setAttribute('aria-pressed', String(i >= 0)); b.querySelector('kbd')!.textContent = i >= 0 ? label(i ? 'skill2' : 'skill1', 'keys') : ''; } }); q('[data-b=settings]').onclick = () => show(set.hidden ? 'settings' : '');
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('nav button')) { b.addEventListener('pointerenter', () => sound.play('uiMove', { gain: 0.5, wet: 0.2 })); b.addEventListener('focus', () => sound.play('uiMove', { gain: 0.5, wet: 0.2 })); b.addEventListener('click', () => sound.play(b.dataset.b === 'play' ? 'uiGo' : 'uiPick', { gain: 0.8, wet: 0.5 })); }
    if (canFullscreen) { q('[data-b=full]').onclick = () => void setFullscreen(!isFullscreen()); onFullscreen(() => this.labels()); }
    // arrows move between entries, as on a pad
    this.root.addEventListener('keydown', e => { const b = [...this.root.querySelectorAll<HTMLButtonElement>('nav button')], i = b.indexOf(document.activeElement as HTMLButtonElement), s = /^(ArrowDown|KeyS)$/.test(e.code) ? 1 : /^(ArrowUp|KeyW)$/.test(e.code) ? -1 : 0; if (s) { e.preventDefault(); b[(i + s + b.length) % b.length].focus(); } });
    this.labels();
  }
  /** Both fights, in order: this page's is Play, the other leaves for its own page. */
  fights(here: string, other: string, otherFirst: boolean) { const p = this.root.querySelector<HTMLButtonElement>('[data-b=play]')!, o = this.root.querySelector<HTMLButtonElement>('[data-b=other]')!; p.textContent = here; o.textContent = other; o.hidden = false; if (otherFirst) p.before(o); else p.after(o); }
  private labels() { const set = (k: string, t: string) => { const b = this.root.querySelector(`[data-b=${k}]`); if (b) b.textContent = t; }; set('full', isFullscreen() ? 'Leave full screen' : 'Full screen'); set('sound', sound.muted ? 'Sound: off' : 'Sound: on'); }
  show() { this.open = true; this.labels(); document.body.classList.add('menu'); document.exitPointerLock?.(); this.root.querySelector<HTMLButtonElement>('[data-b=play]')!.focus({ preventScroll: true }); }
  private close() { this.open = false; document.body.classList.remove('menu'); (document.activeElement as HTMLElement | null)?.blur(); }
  play() { if (!this.open) return; this.close(); this.onPlay(); }
}
