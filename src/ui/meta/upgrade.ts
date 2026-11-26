// The Smith's screen: the weapon in hand and its level, the level-ups, and the other blades for sale.
import type { Progress } from '../../game/progress.ts';
import { Shop } from './shop.ts';
import { UI, WEAPONS } from './metaScript.ts';

export class Smith extends Shop {
  constructor(app: HTMLElement) { super(app, 'smith'); }

  protected extra(p: Readonly<Progress>): string {
    return `<div class="meta-held"><span>In hand</span><b>${WEAPONS[p.weapon.kind]}</b><span>${UI.level} ${p.weapon.level}</span></div>`;
  }
}
