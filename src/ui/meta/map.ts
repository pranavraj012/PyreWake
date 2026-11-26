// The map: the shrines you have lit, grouped by region, and travel to any of them.
// The shrine list (id, region, name) comes from the world (module E); the lit ones come from progress.
import { progress, type Progress } from '../../game/progress.ts';
import { checkTravel, travel } from './rules.ts';
import { REGIONS, UI } from './metaScript.ts';
import { Sheet } from './sheet.ts';

export interface ShrineInfo { id: string; region: string; name: string }

export class WorldMap extends Sheet {
  private shrines: ShrineInfo[] = [];
  /** Called with the shrine travelled to, just before the sheet closes: the world moves the player there. */
  onTravel: (s: ShrineInfo) => void = () => { };

  constructor(app: HTMLElement, shrines: ShrineInfo[] = []) {
    super(app, 'meta-map', UI.map.title);
    this.shrines = shrines;
    progress.on(() => this.refresh());
  }

  /** The world's full list of shrines. Replaces the one given before. */
  setShrines(shrines: ShrineInfo[]) { this.shrines = shrines; this.refresh(); }

  protected render() {
    const p = progress.get(), lit = this.shrines.filter(s => p.shrines.includes(s.id));
    let html = `<p class="meta-intro">${UI.map.intro}</p>`;
    if (!lit.length) html += `<p class="meta-hint">${UI.map.none}</p>`;
    for (const region of Object.keys(REGIONS)) {
      const here = lit.filter(s => s.region === region);
      if (!here.length) continue;
      html += `<h3>${REGIONS[region]}</h3><div class="meta-list">${here.map(s => this.row(s, p)).join('')}</div>`;
    }
    this.body.innerHTML = html;
  }

  private row(s: ShrineInfo, p: Readonly<Progress>): string {
    const here = p.at.shrine === s.id;
    return `<section class="meta-row"><div><h3>${s.name}</h3>${here ? `<span class="meta-tag">${UI.map.here}</span>` : ''}</div>${here ? '' : this.button('travel', s.id, UI.map.travel)}</section>`;
  }

  protected act(act: string, id: string) {
    if (act !== 'travel') return;
    const s = this.shrines.find(x => x.id === id);
    if (!s) return;
    const v = checkTravel(progress.get(), s.id, s.region);
    if (!v.ok) { this.news(UI.refusal[v.why]); return; }
    progress.change(d => { travel(d, s.id, s.region); });
    this.onTravel(s);
    this.close();
  }
}
