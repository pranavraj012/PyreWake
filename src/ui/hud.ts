// Health, fire, boss bar, ability readouts, prompts, pause. Plain HTML so text stays sharp.
import { D } from '../combat/difficulty.ts';
import type { Fight } from '../combat/fight.ts';
import type { Action, Input } from '../input/input.ts';
import { ICON, spellButtons } from '../input/touch.ts';
import type { Spell } from '../combat/spells.ts';
import { label } from '../input/bindings.ts';
import type { Card } from '../bosses/king/lessons.ts';
import type { Prompts } from './prompts.ts';
import { sound } from '../audio/sound.ts';
import { KING_TITLES } from '../bosses/king/kingScript.ts';
import { saveSettings, settings, settingsPanel } from '../core/settings.ts';
import { canFullscreen, isFullscreen, onFullscreen, setFullscreen } from '../core/fullscreen.ts';

const LINES: [Action | 'move', string][] = [['move', 'Move'], ['attack', 'Attack (hold: heavy)'], ['dodge', 'Dodge'], ['jump', 'Jump (Attack in the air)'], ['guard', 'Guard (hold)'], ['skill1', 'Cinder Rush'], ['skill2', 'Sunder Arc'], ['ultimate', 'Last Rites'], ['heal', 'Heal']];

export class Hud {
  private root: HTMLElement; private q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
  private hpLag = 1; private bossLag = 1; private lagWait = 0; private bossWait = 0; private last = { aura: -1, round: 0, flame: false, hp: 1, boss: 1, prompt: '', dev: '', heals: -1 };
  paused = false; private fill = 1; private input: Input; private banner = 0;
  /** Names of the two forms, and the panel after the last blow. */ names: [string, string] = ['The Hanged King', 'The One Beneath']; winTitle = 'Morning, at Last'; /** A button after the win that goes on to the next fight. */ next = ''; onNext: () => void = () => { };
  onRestart: () => void = () => { }; onMenu: () => void = () => { }; onResume: () => void = () => { };
  constructor(app: HTMLElement, input: Input) {
    this.input = input;
    this.root = document.createElement('div'); this.root.id = 'hud';
    this.root.innerHTML = `<div class="me"><div class="bar hp"><b></b><u></u></div><div class="bar fire"><u></u><s></s><s></s></div><div class="aura"><i></i><i></i><i></i><i></i><em></em></div></div>
<div class="boss"><div class="name">The Hanged King</div><div class="bar"><b></b><u></u></div></div>
<div class="ab"><div class="sk ult" data-a="ultimate"><i></i><svg viewBox="0 0 24 24">${ICON.ultimate}</svg><kbd></kbd></div><div class="sk" data-a="skill2"><i></i><svg viewBox="0 0 24 24">${ICON.skill2}</svg><kbd></kbd></div><div class="sk" data-a="skill1"><i></i><svg viewBox="0 0 24 24">${ICON.skill1}</svg><kbd></kbd></div><div class="sk" data-a="heal"><svg viewBox="0 0 24 24">${ICON.heal}</svg><em></em><kbd></kbd></div></div>
<div class="prompt"><kbd></kbd><svg viewBox="0 0 24 24"></svg><span></span></div><div class="banner"></div><div class="verse"></div><div class="call"></div><div class="lesson"><div class="pips"></div><h3></h3><p></p></div><div class="press"><kbd></kbd><svg viewBox="0 0 24 24"></svg><span></span></div>
<div class="win"><h2>Morning, at Last</h2><table></table><div><button data-b="again">Fight again</button> <button data-b="next" hidden></button> <button data-b="menu">Main menu</button></div></div>
<div class="pause"><h2>Paused</h2><div class="btns"><button data-b="go">Resume</button><button data-b="re">Restart fight</button><button data-b="sk">Skip training</button>${canFullscreen ? '<button data-b="fs">Full screen</button>' : ''}<button data-b="mu">Sound: on</button><button data-b="menu">Main menu</button></div><div class="cols"><table></table></div></div>`;
    app.append(this.root); this.q('.pause .cols').append(settingsPanel());
    this.q<HTMLButtonElement>('.win [data-b=next]').onclick = () => { document.body.classList.remove('won'); this.onNext(); };
    this.q<HTMLButtonElement>('.win [data-b=menu]').onclick = () => { document.body.classList.remove('won'); this.onMenu(); };
    const fs = this.root.querySelector('[data-b=fs]'); if (fs) onFullscreen(() => { fs.textContent = isFullscreen() ? 'Leave full screen' : 'Full screen'; });
    this.q<HTMLButtonElement>('.win button').onclick = () => { document.body.classList.remove('won'); this.onRestart(); };
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.pause button[data-b]')) b.onclick = () => { const k = b.dataset.b; if (k === 'fs') { void setFullscreen(!isFullscreen()); return; } if (k === 'mu') { sound.setMuted(!sound.muted); b.textContent = 'Sound: ' + (sound.muted ? 'off' : 'on'); return; } this.setPaused(false); this.onResume(); if (k === 're') this.onRestart(); if (k === 'sk') this.onSkip(); if (k === 'menu') this.onMenu(); };
  }
  /** Paint every lit state once behind the loading screen: the browser compiles these effects on first sight, which costs a 70 ms stall mid-fight. */
  warm(on: boolean) {
    this.root.classList.toggle('lit', on); this.root.classList.toggle('low', on); document.body.classList.toggle('warming', on);
    for (const e of document.querySelectorAll<HTMLElement>('.sk, .tb')) { e.classList.toggle('ready', on); e.classList.toggle('hint', on); e.style.setProperty('--k', on ? '0.6' : '0'); }
    const p = this.q('.prompt'); p.className = 'prompt' + (on ? ' on red' : ''); const b = this.q('.banner'); b.className = 'banner' + (on ? ' on' : ''); b.textContent = on ? KING_TITLES.dawn : ''; const c = this.q<HTMLElement>('.call'); c.textContent = on ? 'Broken Kindled Ablaze Pyre Wake Last Rites ready' : ''; c.classList.toggle('on', on);
  }
  setPaused(p: boolean) {
    this.paused = p; document.body.classList.toggle('paused', p); if (p) document.exitPointerLock?.();
    if (p) { this.q('.pause table').innerHTML = this.controls(); this.q('[data-b=mu]').textContent = 'Sound: ' + (sound.muted ? 'off' : 'on'); this.q<HTMLButtonElement>('[data-b=go]').focus({ preventScroll: true }); }
  }
  /** Rows of the controls table for whatever is being used. */
  controls() {
    const dev = this.input.lastDevice; return LINES.map(([a, t]) => `<tr><td>${dev === 'touch' ? `<svg viewBox="0 0 24 24">${ICON[a] ?? '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'}</svg>` : `<kbd>${label(a, dev)}</kbd>`}</td><td>${t}</td></tr>`).join('');
  }
  onSkip: () => void = () => { };
  /** A line of the story. Empty clears it. */
  verse(text: string) { const v = this.q('.verse'); if (text) v.textContent = text; v.classList.toggle('on', !!text); }
  private shown = '';
  /** The training card, or null. */
  lesson(c: Card | null) {
    const dev = this.input.lastDevice, key = c ? [c.id, c.title, c.text, c.action, c.held, c.ok, dev].join('|') : ''; if (key === this.shown) return; this.shown = key; document.body.classList.toggle('training', !!c); document.body.classList.toggle('held', !!c?.held);
    const L = this.q('.lesson'), P = this.q('.press'); L.classList.toggle('on', !!c); for (const b of document.querySelectorAll('.tb.hint')) b.classList.remove('hint'); if (!c) { P.className = 'press'; return; }
    L.classList.toggle('ok', c.ok); this.q('.lesson h3').textContent = c.title; this.q('.lesson p').textContent = c.text; this.q('.lesson .pips').innerHTML = Array.from({ length: c.of }, (_, i) => `<i class="${i < c.n || (i === c.n && c.ok) ? 'done' : i === c.n ? 'now' : ''}"></i>`).join('');
    P.className = 'press' + (c.ok ? '' : ' on') + (c.held ? ' held' : '') + (dev === 'touch' ? ' touchy' : ''); const t = dev === 'touch', k = this.q('.press kbd'), v = this.q('.press svg'); k.style.display = t ? 'none' : ''; v.style.display = t && c.action !== 'move' ? '' : 'none';
    if (t) { if (c.action !== 'move') { v.innerHTML = ICON[c.action] ?? ''; if (!c.ok) document.querySelector('.tb-' + c.action)?.classList.add('hint'); } } else k.textContent = label(c.action, dev); this.q('.press span').textContent = c.hold ? 'Hold' : !t ? '' : c.action === 'move' ? 'Drag on the left' : c.held ? 'Tap' : '';
  }
  say(text: string, secs: number, cls = '', under = '') { const b = this.q('.banner'); b.textContent = text; if (under) { const u = document.createElement('small'); u.textContent = under; b.append(u); } b.className = 'banner on ' + cls; this.banner = secs; }
  /** Big word at the side: aura steps, readiness. */
  callout(text: string) { const c = this.q('.call'); c.textContent = text; c.classList.remove('on'); void c.offsetWidth; if (text) c.classList.add('on'); }
  /** The boss's bar takes the blow too. */
  struck(power: number) { if (power < 1.2) return; const b = this.q('.boss'); b.classList.remove('jolt'); void b.offsetWidth; b.classList.add('jolt'); }
  won(f: Fight) {
    const t = Math.round(f.time), clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, k = f.brain.temper as 0 | 1 | 2, old = settings.best[k], best = !old || t < old; if (best) { const b = [...settings.best] as [number, number, number]; b[k] = t; saveSettings({ best: b }); }
    this.q('.win table').innerHTML = [['Time', clock(t) + (best ? ' <em>best</em>' : '')], ...(best ? [] : [['Best', clock(old)]]), ['Temper', ['Measured', 'Fierce', 'Relentless'][k]], ['Longest streak', String(f.best)], ['Blows taken', String(f.taken)], ['Deaths', String(f.deaths)]].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join(''); this.q('.win h2').textContent = this.winTitle; const nx = this.q<HTMLButtonElement>('.win [data-b=next]'); nx.hidden = !this.next; nx.textContent = this.next; document.body.classList.add('won'); document.exitPointerLock?.(); }
  /** A new bar, filling from nothing. */
  refill() { this.fill = 0; this.bossLag = 0; }
  hurt() { this.q('.me').classList.remove('jolt'); void this.q('.me').offsetWidth; this.q('.me').classList.add('jolt'); }
  deny(a: string) { for (const e of document.querySelectorAll(`.sk[data-a="${a}"], .tb-${a}`)) { e.classList.remove('deny'); void (e as HTMLElement).offsetWidth; e.classList.add('deny'); } }
  /** Show the two carried fire arts. */
  spells(a: Spell, b: Spell) { spellButtons(a, b); this.costs = [a.cost, b.cost]; LINES[5][1] = a.name; LINES[6][1] = b.name; [a, b].forEach((s, i) => { this.q(`.sk[data-a="skill${i + 1}"] svg`).innerHTML = s.icon; (this.root.querySelectorAll('.fire s')[i] as HTMLElement).style.left = `${s.cost / D.fireMax * 100}%`; }); }
  private costs = [40, 50];
  update(dt: number, f: Fight, p: Prompts) {
    const hp = f.hp / D.hp, fire = f.fire / D.fireMax, boss = Math.min(f.bar, this.fill), L = this.last;
    this.fill = Math.min(1, this.fill + dt / 1.3); if (hp < L.hp) this.lagWait = 0.6; if (boss < L.boss) this.bossWait = 0.7; L.hp = hp; L.boss = boss;
    this.lagWait -= dt; this.bossWait -= dt; if (this.lagWait < 0) this.hpLag += (hp - this.hpLag) * Math.min(1, dt * 5); if (this.bossWait < 0) this.bossLag += (boss - this.bossLag) * Math.min(1, dt * 5); this.hpLag = Math.max(hp, this.hpLag); this.bossLag = Math.max(boss, this.bossLag);
    const w = (s: string, k: number) => { this.q(s).style.transform = `scaleX(${k.toFixed(4)})`; };
    w('.hp u', hp); w('.hp b', this.hpLag); w('.fire u', fire); w('.boss u', boss); w('.boss b', this.bossLag);
    this.root.classList.toggle('low', hp < 0.3 && hp > 0); this.root.classList.toggle('lit', f.m.can.skill1);
    for (const [a, r] of [['skill1', f.fire / this.costs[0]], ['skill2', f.fire / this.costs[1]], ['ultimate', f.wake / 100]] as const) for (const e of document.querySelectorAll<HTMLElement>(`.sk[data-a="${a}"], .tb-${a}`)) { e.style.setProperty('--k', Math.min(1, r).toFixed(3)); e.classList.toggle('ready', r >= 1); }
    if (f.aura !== L.aura || f.round !== L.round || f.flame !== L.flame) { L.aura = f.aura; L.round = f.round; L.flame = f.flame; this.root.querySelectorAll('.aura i').forEach((e, i) => e.classList.toggle('on', i < f.aura)); this.q('.aura em').textContent = ['', 'Kindled', 'Ablaze', 'Pyre', 'Wake'][f.aura]; this.q('.boss .name').textContent = this.names[f.round - 1]; this.q('.hp').classList.toggle('flame', f.flame); this.root.classList.toggle('two', f.round === 2); }
    if (f.heals !== L.heals) { L.heals = f.heals; this.q('.ab em').textContent = String(f.heals); const c = document.querySelector('.tb-heal i'); if (c) c.textContent = `Heal ${f.heals}`; for (const e of document.querySelectorAll('.sk[data-a="heal"], .tb-heal')) e.classList.toggle('empty', f.heals === 0); }
    const dev = this.input.lastDevice; if (dev !== L.dev) { L.dev = dev; L.prompt = '?'; for (const a of ['skill1', 'skill2', 'ultimate', 'heal'] as const) this.q(`.sk[data-a="${a}"] kbd`).textContent = dev === 'touch' ? '' : label(a, dev); }
    const cur = p.current, id = cur?.id ?? '';
    if (id !== L.prompt) {
      L.prompt = id; const el = this.q('.prompt'); el.className = 'prompt' + (cur ? ' on ' + (cur.tone ?? '') : '');
      for (const b of document.querySelectorAll('.tb.hint')) b.classList.remove('hint');
      if (cur) {
        const kbd = this.q('.prompt kbd'), svg = this.q('.prompt svg'), t = dev === 'touch'; kbd.style.display = t ? 'none' : ''; svg.style.display = t && cur.action !== 'move' ? '' : 'none';
        if (t) { svg.innerHTML = ICON[cur.action] ?? ''; document.querySelector('.tb-' + cur.action)?.classList.add('hint'); } else kbd.textContent = label(cur.action, dev);
        this.q('.prompt span').textContent = t && cur.action === 'move' ? 'Drag on the left side to move' : cur.text;
      }
    }
    if (this.banner > 0 && (this.banner -= dt) <= 0) this.q('.banner').classList.remove('on');
  }
}
