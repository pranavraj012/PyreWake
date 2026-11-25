// What the player has chosen. Kept on this device only.
export interface Settings { /** 0 measured, 1 fierce, 2 relentless. */ temper: 0 | 1 | 2; /** 0-1. */ music: number; sfx: number; shake: number; /** 1 full, 0 reduced: ink frames and bright flashes. */ flash: number; /** Controller vibration. */ rumble: number; /** Best winning time in seconds, per temper. */ best: [number, number, number]; /** Training done. */ learned: boolean; /** Remapped controls; anything missing is the default. */ binds?: { keys?: Partial<Record<string, string[]>>; pad?: Partial<Record<string, string[]>> } }
const BASE: Settings = { temper: 1, music: 0.8, sfx: 0.8, shake: 1, flash: 1, rumble: 0.8, best: [0, 0, 0], learned: false };
const load = (): Settings => { try { return { ...BASE, ...JSON.parse(localStorage.getItem('pyrewake') ?? '{}') }; } catch { return { ...BASE }; } };
export const settings: Settings = load();
const subs: (() => void)[] = [];
export function onSettings(f: () => void) { subs.push(f); f(); }
export function saveSettings(p: Partial<Settings> = {}) { Object.assign(settings, p); try { localStorage.setItem('pyrewake', JSON.stringify(settings)); } catch { /* private window */ } for (const f of subs) f(); }

/** The same panel serves the title screen and the pause menu. */
export function settingsPanel(): HTMLElement {
  const el = document.createElement('div'); el.className = 'settings';
  el.innerHTML = `<div class="row" role="group" aria-label="Boss temper"><span>Boss temper</span><div class="seg">${['Measured', 'Fierce', 'Relentless'].map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div></div>` + `<div class="row" role="group" aria-label="Flashing"><span>Flashing</span><div class="seg two">${['Reduced', 'Full'].map((n, i) => `<button data-f="${i}">${n}</button>`).join('')}</div></div>` + ([['music', 'Music'], ['sfx', 'Effects'], ['shake', 'Camera shake'], ['rumble', 'Vibration']] as const).map(([k, n]) => `<label class="row"><span>${n}</span><input type="range" min="0" max="1" step="0.05" data-k="${k}"></label>`).join('');
  const seg = [...el.querySelectorAll<HTMLButtonElement>('[data-v]')], fl = [...el.querySelectorAll<HTMLButtonElement>('[data-f]')], ins = [...el.querySelectorAll<HTMLInputElement>('input')];
  fl.forEach((b, i) => { b.onclick = () => saveSettings({ flash: i }); }); seg.forEach((b, i) => { b.onclick = () => saveSettings({ temper: i as 0 | 1 | 2 }); }); ins.forEach(x => { x.oninput = () => saveSettings({ [x.dataset.k!]: +x.value }); });
  onSettings(() => { fl.forEach((b, i) => b.setAttribute('aria-pressed', String(i === settings.flash))); seg.forEach((b, i) => b.setAttribute('aria-pressed', String(i === settings.temper))); ins.forEach(x => { x.value = String(settings[x.dataset.k as 'music' | 'sfx' | 'shake' | 'rumble']); x.style.setProperty('--v', x.value); }); });
  return el;
}
