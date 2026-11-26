// The dialogue box: the speaker's name, the line, a press to go on, and replies when there are some.
// Keyboard: Enter or the attack/jump keys go on; W/S or arrows (or the stick) pick a reply, the same keys answer.
// Pad: the stick picks, A (attack or jump) answers. Touch: tap the box. It never opens while foes are near.
import { sound } from '../audio/sound.ts';
import { label } from '../input/bindings.ts';
import type { Action, Input } from '../input/input.ts';
import { Dialogue, startTalk, type Person, type Shown } from '../story/dialogue.ts';

export class Talk {
  /** True while a conversation is on screen. The caller keeps combat input away from the world while this is set. */
  open = false;
  /** Called after a conversation that ran a shop effect has closed; the caller opens that shop. */
  onShop: (id: string) => void = () => { };
  /** Answers true while foes are near; a talk does not open then. */
  foesNear: () => boolean = () => false;

  private root: HTMLElement;
  private who: HTMLElement;
  private line: HTMLElement;
  private replies: HTMLElement;
  private more: HTMLElement;
  private dlg: Dialogue | null = null;
  private cur: Shown | null = null;
  private sel = 0;
  private stickY = 0;
  private input: Input | null = null;

  constructor(app: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'talk';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-live', 'polite');
    this.root.innerHTML = '<h2 class="who"></h2><p class="line"></p><div class="replies"></div><p class="more"></p>';
    this.who = this.root.querySelector<HTMLElement>('.who')!;
    this.line = this.root.querySelector<HTMLElement>('.line')!;
    this.replies = this.root.querySelector<HTMLElement>('.replies')!;
    this.more = this.root.querySelector<HTMLElement>('.more')!;
    app.append(this.root);
    // touch and mouse: a tap on the box goes on (a reply button takes its own tap)
    this.root.addEventListener('pointerdown', e => {
      if (!this.open || (e.target as HTMLElement).closest('button')) return;
      this.confirm();
    });
    addEventListener('keydown', e => {
      if (!this.open) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this.confirm(); }
      else if (this.cur?.replies.length && /^(Digit|Numpad)[1-9]$/.test(e.code)) {
        const i = +e.code.slice(-1) - 1; if (i < this.cur.replies.length) { e.preventDefault(); this.pick(i); }
      }
    });
  }

  /** Opens a talk with the person. False when one is already open, or foes are near. */
  start(person: Person): boolean {
    if (this.open || this.foesNear()) return false;
    this.dlg = startTalk(person);
    this.open = true;
    this.sel = 0;
    this.sub = person.sub;
    this.root.hidden = false;
    document.body.classList.add('talking');
    this.show();
    return true;
  }

  private sub = '';

  /** Ends the talk at once (a fight has started, say). A shop the talk asked for still opens. */
  close() {
    if (!this.open) return;
    const shop = this.dlg?.shop ?? null;
    this.open = false; this.dlg = null; this.cur = null;
    this.root.hidden = true;
    document.body.classList.remove('talking');
    if (shop) this.onShop(shop);
  }

  /** Call once per frame with the presses drained from input this frame (`input.drain()`). */
  update(events: { a: Action; up: boolean }[], input: Input) {
    this.input = input;
    if (!this.open) return;
    for (const e of events) if (!e.up && (e.a === 'attack' || e.a === 'jump')) this.confirm();
    if (!this.open) return;
    const y = input.move.y;
    if (this.cur?.replies.length) {
      const n = this.cur.replies.length;
      if (y < -0.6 && this.stickY >= -0.6) this.select((this.sel + 1) % n);
      else if (y > 0.6 && this.stickY <= 0.6) this.select((this.sel + n - 1) % n);
    }
    this.stickY = y;
  }

  private select(i: number) {
    this.sel = i;
    this.replies.querySelectorAll<HTMLElement>('button').forEach((b, k) => b.classList.toggle('on', k === i));
    sound.play('uiMove', { gain: 0.5 });
  }

  private confirm() {
    if (!this.dlg || !this.cur) return this.close();
    if (this.cur.replies.length) this.pick(this.sel);
    else { this.dlg.advance(); this.show(); }
  }

  private pick(i: number) {
    if (!this.dlg) return;
    this.dlg.choose(i); this.sel = 0; this.show();
  }

  private show() {
    if (!this.dlg) return;
    const cur = this.dlg.current();
    if (!cur) { this.close(); return; }
    this.cur = cur;
    if (cur.first && cur.voice) sound.play(cur.voice, { gain: 0.6 });
    const small = document.createElement('small');
    small.textContent = this.sub;
    this.who.replaceChildren(cur.speaker, ' ', small);
    this.line.textContent = cur.line;
    this.replies.replaceChildren(...cur.replies.map((r, i) => {
      const b = document.createElement('button');
      b.className = 'reply' + (i === this.sel ? ' on' : '');
      b.textContent = r.text;
      b.addEventListener('click', () => this.pick(i));
      return b;
    }));
    const dev = this.input?.lastDevice === 'pad' ? 'pad' : 'keys';
    this.more.textContent = cur.replies.length
      ? `${dev === 'pad' ? 'Stick' : 'W S'} to choose, ${label('attack', dev)} to answer`
      : `${label('attack', dev)} to go on`;
  }
}
