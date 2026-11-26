// A vendor's list: a line of their words, the purse, and one row per item to buy. The Ash-Reader's screen is this with the life gift.
// Priced from module B (priceOf) unless a test or the preview passes its own table.
import { progress, priceOf, type Progress } from '../../game/progress.ts';
import { sound } from '../../audio/sound.ts';
import { applyBuy, checkBuy, giveBeads, isOwned, BEADS_PER_LIFE, type PriceFn } from './rules.ts';
import { ITEMS, UI, VENDORS, type VendorId } from './metaScript.ts';
import { Sheet } from './sheet.ts';

export interface ScreenOpts { price?: PriceFn }

export class Shop extends Sheet {
  protected vendor: VendorId;
  protected price: PriceFn;

  constructor(app: HTMLElement, vendor: VendorId, opts: ScreenOpts = {}) {
    super(app, 'meta-shop meta-' + vendor, VENDORS[vendor].title);
    this.vendor = vendor;
    this.price = opts.price ?? priceOf;
    progress.on(() => this.refresh());
  }

  protected render() {
    const p = progress.get(), v = VENDORS[this.vendor];
    this.body.innerHTML = `<p class="meta-intro"></p><p class="meta-purse">${UI.have}: <b>${p.fares}</b> ${UI.fares} · <b>${p.iron}</b> ${UI.iron}</p>${this.extra(p)}<div class="meta-list">${v.items.map(id => this.row(id, p)).join('')}</div>`;
    this.body.querySelector('.meta-intro')!.textContent = v.intro;
  }

  /** Anything above the list (the Smith's held weapon, the life gift). */
  protected extra(p: Readonly<Progress>): string {
    if (this.vendor !== 'ash') return '';
    const it = ITEMS['beads.life'];
    return `<section class="meta-row"><div><h3>${it.name}</h3><p>${it.text}</p><small>${UI.beadsHave(p.beads)}</small></div>${this.button('beads', '', `${UI.giveBeads} (${BEADS_PER_LIFE})`)}</section>`;
  }

  protected row(id: string, p: Readonly<Progress>): string {
    const it = ITEMS[id], c = this.price(id, p), owned = isOwned(p, id);
    const cost = c ? `${c.fares} ${UI.fares}${c.iron ? `, ${c.iron} ${UI.iron}` : ''}` : '';
    const short = !!c && (p.fares < c.fares || p.iron < c.iron);
    const action = owned ? `<span class="meta-tag">${UI.owned}</span>` : c ? this.button('buy', id, UI.buy) : `<span class="meta-tag">${UI.unsold}</span>`;
    return `<section class="meta-row"><div><h3>${it.name}</h3><p>${it.text}</p>${cost ? `<small class="${short ? 'short' : ''}">${UI.cost}: ${cost}</small>` : ''}</div>${action}</section>`;
  }

  protected act(act: string, id: string) {
    if (act === 'buy') this.buy(id);
    else if (act === 'beads') this.beads();
  }

  /** Buy one item: refused (with the reason) when it is not sold, owned, or the purse is short. */
  buy(id: string) {
    const v = checkBuy(progress.get(), id, this.price);
    if (!v.ok) { this.news(UI.refusal[v.why]); return; }
    progress.change(d => { applyBuy(d, id, this.price); });
    sound.play('uiPick', { gain: 0.7, wet: 0.4 });
    this.news(UI.done);
  }

  /** Three beads for one life gift. */
  beads() {
    if (progress.get().beads < BEADS_PER_LIFE) { this.news(UI.refusal.beads); return; }
    progress.change(d => { giveBeads(d); });
    sound.play('uiPick', { gain: 0.7, wet: 0.4 });
    this.news(UI.done);
  }
}
