// The base of the meta screens: a sheet with a title, a line of news, a scrolling body and a close button.
// Keys: arrows walk the buttons, Enter/Space press them (the browser does that), Escape closes. The pad reaches it through padnav.ts (body.meta).
// Touch: every control is at least 44 px and the body scrolls on its own.
import { UI } from './metaScript.ts';

export class Sheet {
  readonly el: HTMLElement;
  protected body: HTMLElement;
  protected say: HTMLElement;
  isOpen = false;
  /** Called after the sheet closes (for the caller to resume the world). */
  onClose: () => void = () => { };
  private returnTo: HTMLElement | null = null;

  constructor(app: HTMLElement, cls: string, title: string) {
    this.el = document.createElement('div');
    this.el.className = 'meta-sheet ' + cls;
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', title);
    this.el.innerHTML = `<div class="meta-card"><header><h2></h2><button type="button" data-b="close">${UI.close}</button></header><p class="meta-say" aria-live="polite"></p><div class="meta-body"></div></div>`;
    this.el.querySelector('h2')!.textContent = title;
    this.body = this.el.querySelector<HTMLElement>('.meta-body')!;
    this.say = this.el.querySelector<HTMLElement>('.meta-say')!;
    this.el.querySelector<HTMLButtonElement>('[data-b=close]')!.addEventListener('click', () => this.close());
    // keys pressed on a sheet belong to it, not to the world behind
    this.el.addEventListener('keydown', e => this.key(e));
    // one delegated handler for every [data-act] button in the body
    this.body.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (b && this.isOpen) this.act(b.dataset.act!, b.dataset.id ?? '');
    });
    app.append(this.el);
  }

  open() {
    if (this.isOpen) return;
    this.returnTo = document.activeElement as HTMLElement | null;
    this.isOpen = true; this.el.hidden = false; this.el.classList.add('on'); document.body.classList.add('meta');
    this.say.textContent = '';
    this.render();
    (this.el.querySelector<HTMLElement>('.meta-body button:not([disabled])') ?? this.el.querySelector<HTMLElement>('[data-b=close]'))?.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false; this.el.hidden = true; this.el.classList.remove('on'); document.body.classList.remove('meta');
    this.returnTo?.focus?.({ preventScroll: true });
    this.onClose();
  }

  /** Redraw the body, keeping the focus on the same button when it still exists. */
  protected refresh() {
    if (!this.isOpen) return;
    const at = document.activeElement as HTMLElement | null, key = at && this.body.contains(at) ? at.dataset.key : undefined;
    this.render();
    if (key) this.body.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }

  /** A button that does an action when pressed. `key` keeps the focus on it across redraws. */
  protected button(act: string, id: string, label: string, cls = ''): string {
    return `<button type="button" class="${cls}" data-act="${act}" data-id="${id}" data-key="${act}:${id}">${label}</button>`;
  }

  /** Subclasses draw their body here. */
  protected render() { }
  /** Subclasses handle their [data-act] buttons here. */
  protected act(_act: string, _id: string) { }
  /** A line of news under the title. */
  protected news(text: string) { this.say.textContent = text; }

  private key(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const list = [...this.el.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.offsetParent !== null && !b.disabled);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    // list holds buttons only
    list[next].focus({ preventScroll: true }); list[next].scrollIntoView({ block: 'nearest' });
  }
}
