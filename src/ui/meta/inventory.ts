// Inventory: the fire arts carried into a fight (two slots) and the charms worn on the cords.
import { progress, type Progress } from '../../game/progress.ts';
import { SPELLS, type SpellId } from '../../combat/spells.ts';
import { charmSlots, checkWear, equipSpell, takeOff, wear } from './rules.ts';
import { ITEMS, UI } from './metaScript.ts';
import { Sheet } from './sheet.ts';

export class Inventory extends Sheet {
  constructor(app: HTMLElement) {
    super(app, 'meta-inventory', UI.inventory.title);
    progress.on(() => this.refresh());
  }

  protected render() {
    const p = progress.get(), I = UI.inventory;
    this.body.innerHTML = `<h3>${I.spells}</h3><p class="meta-hint">${I.spellsHint}</p><div class="meta-list">${this.spellRows(p)}</div>`
      + `<h3>${I.charms}</h3><p class="meta-hint">${I.charmsHint(p.worn.length, charmSlots(p))}</p><div class="meta-list">${this.charmRows(p)}</div>`;
  }

  private spellRows(p: Readonly<Progress>): string {
    const owned = p.spells.filter(id => id in SPELLS) as SpellId[];
    if (!owned.length) return `<p class="meta-hint">${UI.inventory.noSpells}</p>`;
    return owned.map(id => {
      const s = SPELLS[id], at = p.equipped.indexOf(id), now = at >= 0 ? `<small class="meta-tag">${UI.inventory.slotNow(at + 1)}</small>` : '';
      return `<section class="meta-row"><div><h3>${s.name} <small>${s.cost} fire</small></h3><p>${s.info}</p>${now}</div><div class="meta-pair">${this.button('slot', '0:' + id, UI.inventory.slot1)}${this.button('slot', '1:' + id, UI.inventory.slot2)}</div></section>`;
    }).join('');
  }

  private charmRows(p: Readonly<Progress>): string {
    if (!p.charms.length) return `<p class="meta-hint">${UI.inventory.noCharms}</p>`;
    return p.charms.map(id => {
      const it = ITEMS['charm.' + id] ?? { name: id, text: '' }, on = p.worn.includes(id);
      return `<section class="meta-row"><div><h3>${it.name}</h3><p>${it.text}</p>${on ? `<small class="meta-tag">${UI.inventory.worn}</small>` : ''}</div>${on ? this.button('off', id, UI.inventory.off) : this.button('wear', id, UI.inventory.wear)}</section>`;
    }).join('');
  }

  protected act(act: string, id: string) {
    if (act === 'slot') {
      const [slot, spell] = [Number(id.slice(0, 1)) as 0 | 1, id.slice(2)];
      progress.change(d => { equipSpell(d, slot, spell); });
    } else if (act === 'wear') {
      const v = checkWear(progress.get(), id);
      if (!v.ok) { this.news(UI.refusal[v.why]); return; }
      progress.change(d => { wear(d, id); });
    } else if (act === 'off') progress.change(d => { takeOff(d, id); });
  }
}
