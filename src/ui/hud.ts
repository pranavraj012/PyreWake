// Health, fire, boss bar, ability readouts, prompts, pause. Plain HTML so text stays sharp.
import { D } from '../combat/difficulty.ts';
import type { Fight } from '../combat/fight.ts';
import type { Action, Input } from '../input/input.ts';
import { ICON } from '../input/touch.ts';
import type { Prompts } from './prompts.ts';
import { isMuted, setMuted } from '../audio/sfx.ts';

const KEY: Record<'keys' | 'pad', Partial<Record<Action | 'move', string>>> = {
  keys: { move: 'W A S D', attack: 'Left click', dodge: 'Space', guard: 'Right click', skill1: 'Q', heal: 'F' },
  pad: { move: 'Left stick', attack: 'X', dodge: 'B', guard: 'LB', skill1: 'RB', heal: 'D-pad up' },
};
const LINES: [Action | 'move', string][] = [['move', 'Move'], ['attack', 'Attack (hold: heavy)'], ['dodge', 'Dodge'], ['guard', 'Guard (hold)'], ['skill1', 'Cinder Rush'], ['heal', 'Heal']];

export class Hud {
  private root: HTMLElement; private q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
  private hpLag = 1; private bossLag = 1; private lagWait = 0; private bossWait = 0; private last = { hp: 1, boss: 1, prompt: '', dev: '', heals: -1 };
  paused = false; private input: Input; private banner = 0;
  onRestart: () => void = () => { };
  constructor(app: HTMLElement, input: Input) {
    this.input = input;
    this.root = document.createElement('div'); this.root.id = 'hud';
    this.root.innerHTML = `<div class="me"><div class="bar hp"><b></b><u></u></div><div class="bar fire"><u></u><s style="left:${D.rush.cost / D.fireMax * 100}%"></s><s style="left:${2 * D.rush.cost / D.fireMax * 100}%"></s></div></div>
<div class="boss"><div class="name">The Hanged King</div><div class="bar"><b></b><u></u></div></div>
<div class="ab"><div class="sk" data-a="skill1"><i></i><svg viewBox="0 0 24 24">${ICON.skill1}</svg><kbd></kbd></div><div class="sk" data-a="heal"><svg viewBox="0 0 24 24">${ICON.heal}</svg><em></em><kbd></kbd></div></div>
<div class="prompt"><kbd></kbd><svg viewBox="0 0 24 24"></svg><span></span></div><div class="banner"></div>
<div class="pause"><h2>Paused</h2><table></table><div><button data-b="go">Resume</button><button data-b="re">Restart fight</button><button data-b="mu">Sound: on</button></div></div>`;
    app.append(this.root);
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.pause button')) b.onclick = () => { const k = b.dataset.b; if (k === 'mu') { setMuted(!isMuted()); b.textContent = 'Sound: ' + (isMuted() ? 'off' : 'on'); return; } this.setPaused(false); if (k === 're') this.onRestart(); };
  }
  /** Paint every lit state once behind the loading screen: the browser compiles these effects on first sight, which costs a 70 ms stall mid-fight. */
  warm(on: boolean) {
    this.root.classList.toggle('lit', on); this.root.classList.toggle('low', on); document.body.classList.toggle('warming', on);
    for (const e of document.querySelectorAll<HTMLElement>('.sk, .tb')) { e.classList.toggle('ready', on); e.classList.toggle('hint', on); e.style.setProperty('--k', on ? '0.6' : '0'); }
    const p = this.q('.prompt'); p.className = 'prompt' + (on ? ' on red' : ''); const b = this.q('.banner'); b.className = 'banner' + (on ? ' on' : ''); b.textContent = on ? 'It falls' : '';
  }
  setPaused(p: boolean) {
    this.paused = p; document.body.classList.toggle('paused', p); if (p) document.exitPointerLock?.();
    const dev = this.input.lastDevice; if (p) this.q('table').innerHTML = LINES.map(([a, t]) => `<tr><td>${dev === 'touch' ? `<svg viewBox="0 0 24 24">${ICON[a] ?? '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'}</svg>` : `<kbd>${KEY[dev][a]}</kbd>`}</td><td>${t}</td></tr>`).join('');
  }
  say(text: string, secs: number, cls = '') { const b = this.q('.banner'); b.textContent = text; b.className = 'banner on ' + cls; this.banner = secs; }
  hurt() { this.q('.me').classList.remove('jolt'); void this.q('.me').offsetWidth; this.q('.me').classList.add('jolt'); }
  deny(a: string) { for (const e of document.querySelectorAll(`.sk[data-a="${a}"], .tb-${a}`)) { e.classList.remove('deny'); void (e as HTMLElement).offsetWidth; e.classList.add('deny'); } }
  update(dt: number, f: Fight, p: Prompts) {
    const hp = f.hp / D.hp, fire = f.fire / D.fireMax, boss = f.bossHp / D.boss.hp, L = this.last;
    if (hp < L.hp) this.lagWait = 0.6; if (boss < L.boss) this.bossWait = 0.7; L.hp = hp; L.boss = boss;
    this.lagWait -= dt; this.bossWait -= dt; if (this.lagWait < 0) this.hpLag += (hp - this.hpLag) * Math.min(1, dt * 5); if (this.bossWait < 0) this.bossLag += (boss - this.bossLag) * Math.min(1, dt * 5); this.hpLag = Math.max(hp, this.hpLag); this.bossLag = Math.max(boss, this.bossLag);
    const w = (s: string, k: number) => { this.q(s).style.transform = `scaleX(${k.toFixed(4)})`; };
    w('.hp u', hp); w('.hp b', this.hpLag); w('.fire u', fire); w('.boss u', boss); w('.boss b', this.bossLag);
    this.root.classList.toggle('low', hp < 0.3 && hp > 0); this.root.classList.toggle('lit', f.m.can.skill1);
    const ring = Math.min(1, f.fire / D.rush.cost), ready = ring >= 1;
    for (const e of document.querySelectorAll<HTMLElement>('.sk[data-a="skill1"], .tb-skill1')) { e.style.setProperty('--k', ring.toFixed(3)); e.classList.toggle('ready', ready); }
    if (f.heals !== L.heals) { L.heals = f.heals; this.q('.ab em').textContent = String(f.heals); const c = document.querySelector('.tb-heal i'); if (c) c.textContent = `Heal ${f.heals}`; for (const e of document.querySelectorAll('.sk[data-a="heal"], .tb-heal')) e.classList.toggle('empty', f.heals === 0); }
    const dev = this.input.lastDevice; if (dev !== L.dev) { L.dev = dev; L.prompt = '?'; for (const a of ['skill1', 'heal'] as const) this.q(`.sk[data-a="${a}"] kbd`).textContent = dev === 'touch' ? '' : KEY[dev][a]!; }
    const cur = p.current, id = cur?.id ?? '';
    if (id !== L.prompt) {
      L.prompt = id; const el = this.q('.prompt'); el.className = 'prompt' + (cur ? ' on ' + (cur.tone ?? '') : '');
      for (const b of document.querySelectorAll('.tb.hint')) b.classList.remove('hint');
      if (cur) {
        const kbd = this.q('.prompt kbd'), svg = this.q('.prompt svg'), t = dev === 'touch'; kbd.style.display = t ? 'none' : ''; svg.style.display = t && cur.action !== 'move' ? '' : 'none';
        if (t) { svg.innerHTML = ICON[cur.action] ?? ''; document.querySelector('.tb-' + cur.action)?.classList.add('hint'); } else kbd.textContent = KEY[dev][cur.action] ?? '';
        this.q('.prompt span').textContent = t && cur.action === 'move' ? 'Drag on the left side to move' : cur.text;
      }
    }
    if (this.banner > 0 && (this.banner -= dt) <= 0) this.q('.banner').classList.remove('on');
  }
}
