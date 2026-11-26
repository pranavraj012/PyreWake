// Fares and Pyre-iron on the HUD. Shown outside fights; during a fight shown only for a few seconds when either changes.
// The caller says whether a fight is on: fares.setFighting(true) at the start, false at the end.
import { progress, type Progress } from '../../game/progress.ts';
import { UI } from './metaScript.ts';

const SHOW_SECS = 2.5;

export class Fares {
  private el: HTMLElement;
  private fighting = false;
  private timer = 0;
  private last = { fares: -1, iron: -1 };
  private off: () => void;

  constructor(app: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'meta-fares';
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `<span class="f"><b>${UI.fares}</b><i></i></span><span class="iron"><b>${UI.iron}</b><i></i></span>`;
    app.append(this.el);
    this.off = progress.on(p => this.changed(p));
    this.changed(progress.get());
  }

  setFighting(on: boolean) { this.fighting = on; this.paint(); }

  /** The HUD's own element, to place it. */
  get element() { return this.el; }

  destroy() { this.off(); clearTimeout(this.timer); this.el.remove(); }

  private changed(p: Readonly<Progress>) {
    // the first reading is not a change
    const moved = this.last.fares >= 0 && (p.fares !== this.last.fares || p.iron !== this.last.iron);
    this.last = { fares: p.fares, iron: p.iron };
    this.el.querySelector('.f i')!.textContent = String(p.fares);
    this.el.querySelector('.iron i')!.textContent = String(p.iron);
    if (moved) {
      this.el.classList.add('bump');
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => { this.el.classList.remove('bump'); this.paint(); }, SHOW_SECS * 1000);
      this.paint(true);
    }
  }

  private paint(flash = false) {
    const shown = !this.fighting || flash || this.el.classList.contains('bump');
    this.el.classList.toggle('on', shown);
  }
}
