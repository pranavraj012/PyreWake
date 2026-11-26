// Preview of the meta screens without a world: fake progress and shrines, and a fake pad. Prices are module B's.
// Open: preview.html?s=smith|ash|inv|map ; ?fight shows the HUD kauri as in a fight. Keys: S, A, I, M open a screen, F toggles a fight, Esc closes.
// From a script: window.__pad(['down','ok']) sends pad presses through the real padnav.ts.
import '../style.css';
import { fresh, progress } from '../../game/progress.ts';
import type { Input } from '../../input/input.ts';
import { padNav } from '../padnav.ts';
import { Shop } from './shop.ts';
import { Smith } from './upgrade.ts';
import { Inventory } from './inventory.ts';
import { WorldMap, type ShrineInfo } from './map.ts';
import { Kauri } from './kauri.ts';

const SHRINES: ShrineInfo[] = [
  { id: 'ash1', region: 'ashfields', name: 'The cold pyre by the banyan road' },
  { id: 'ash2', region: 'ashfields', name: 'The pyre under the hanging roots' },
  { id: 'ghat1', region: 'ghats', name: 'The lamp-steps' },
  { id: 'ghat2', region: 'ghats', name: 'The drowned shrine' },
];

const app = document.getElementById('app')!;
// a fake pad: queued presses, read through the same takeNav() the game uses
const pad = { lastDevice: 'pad', nav: [] as string[], takeNav() { const n = this.nav; this.nav = []; return n; } };
(window as unknown as { __pad: (keys: string[]) => void }).__pad = keys => { pad.nav.push(...keys); padNav(pad as unknown as Input); };

// from a script: spend or earn Kauri, to see the HUD flash (window.__kauri(-20))
(window as unknown as { __kauri: (d: number) => void }).__kauri = d => progress.change(p => { p.kauri = Math.max(0, p.kauri + d); });

// a state with something in every list
progress.change(p => {
  const f = fresh();
  Object.assign(p, f, {
    kauri: 340, iron: 4, beads: 5, weapon: { kind: 'khanda', level: 3 }, weapons: ['khanda'], flasks: { count: 3, strength: 1 },
    spells: ['rush', 'sunder', 'brand', 'ashstep'], equipped: ['rush', 'sunder'], charms: ['ember', 'quick', 'perfect'], worn: ['ember', 'quick'],
    shrines: ['ash1', 'ash2', 'ghat1'], at: { region: 'ashfields', shrine: 'ash1' },
  });
});

const smith = new Smith(app);
const ash = new Shop(app, 'ash');
const inv = new Inventory(app);
const map = new WorldMap(app, SHRINES);
const kauri = new Kauri(app);
const log = document.getElementById('log')!;
map.onTravel = s => { log.textContent = 'Travelled to ' + s.name; };

const screens = { smith, ash, inv, map };
type Key = keyof typeof screens;
const show = (k: Key) => { for (const s of Object.values(screens)) s.close(); screens[k].open(); };
const fight = (on: boolean) => { kauri.setFighting(on); document.body.classList.toggle('fight', on); };

// the toolbar (hidden while a sheet is open)
const bar = document.getElementById('dev')!;
bar.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-o]'); if (!b) return;
  if (b.dataset.o === 'fight') fight(!document.body.classList.contains('fight')); else show(b.dataset.o as Key);
});
addEventListener('keydown', e => {
  if (document.body.classList.contains('meta')) return;
  const k = { KeyS: 'smith', KeyA: 'ash', KeyI: 'inv', KeyM: 'map' }[e.code] as Key | undefined;
  if (k) show(k); else if (e.code === 'KeyF') fight(!document.body.classList.contains('fight'));
});

const q = new URLSearchParams(location.search);
if (q.has('fight')) fight(true);
const start = q.get('s') as Key | null;
if (start && start in screens) show(start);
document.body.classList.add('ready');
