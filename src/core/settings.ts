// What the player has chosen. Kept on this device only.
export interface Settings { /** 0 measured, 1 fierce, 2 relentless. */ temper: 0 | 1 | 2; /** 0-1. */ music: number; sfx: number; shake: number; /** Best winning time in seconds, per temper. */ best: [number, number, number] }
const BASE: Settings = { temper: 1, music: 0.8, sfx: 0.8, shake: 1, best: [0, 0, 0] };
const load = (): Settings => { try { return { ...BASE, ...JSON.parse(localStorage.getItem('pyrewake') ?? '{}') }; } catch { return { ...BASE }; } };
export const settings: Settings = load();
const subs: (() => void)[] = [];
export function onSettings(f: () => void) { subs.push(f); f(); }
export function saveSettings(p: Partial<Settings> = {}) { Object.assign(settings, p); try { localStorage.setItem('pyrewake', JSON.stringify(settings)); } catch { /* private window */ } for (const f of subs) f(); }

/** The same panel serves the title screen and the pause menu. */
export function settingsPanel(): HTMLElement {
  const el = document.createElement('div'); el.className = 'settings';
  el.innerHTML = `<div class="row" role="group" aria-label="Boss temper"><span>Boss temper</span><div class="seg">${['Measured', 'Fierce', 'Relentless'].map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div></div>` + ([['music', 'Music'], ['sfx', 'Effects'], ['shake', 'Camera shake']] as const).map(([k, n]) => `<label class="row"><span>${n}</span><input type="range" min="0" max="1" step="0.05" data-k="${k}"></label>`).join('');
  const seg = [...el.querySelectorAll<HTMLButtonElement>('.seg button')], ins = [...el.querySelectorAll<HTMLInputElement>('input')];
  seg.forEach((b, i) => { b.onclick = () => saveSettings({ temper: i as 0 | 1 | 2 }); }); ins.forEach(x => { x.oninput = () => saveSettings({ [x.dataset.k!]: +x.value }); });
  onSettings(() => { seg.forEach((b, i) => b.setAttribute('aria-pressed', String(i === settings.temper))); ins.forEach(x => { x.value = String(settings[x.dataset.k as 'music' | 'sfx' | 'shake']); x.style.setProperty('--v', x.value); }); });
  return el;
}
