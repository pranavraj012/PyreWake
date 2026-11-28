// node tools/analyse3.mjs [fights] : headless bots against the Sister of Hours and the Pall. Win rate, length, what hurt, what each move was worth.
import { Fight } from '../src/combat/fight.ts'; import { Motor } from '../src/player/motor.ts'; import { Sister } from '../src/bosses/hours/sister.ts'; import { HoursBrain } from '../src/bosses/hours/brain.ts';
const N = +(process.argv[2] ?? 40), DT = 1 / 60, tap = a => [{ a, up: false }, { a, up: true }];
/** mash: only attacks. dodger: answers about two cues in three. smart: also cuts chains and lanterns, turns coins, jumps low sweeps. */
const KIND = { mash: { dodge: 0 }, dodger: { dodge: .65 }, smart: { dodge: .7, spell: true, jump: true } };
function bout(kind, seed) {
  let s = seed * 7919 + 13; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const f = new Fight(new Motor(), new Sister(), new HoursBrain(seed)), m = f.m, k = f.boss, o = KIND[kind]; m.z = 5; let act = -1, last = 0, wait = 0, prev = f.bossHp, tag = 'free', deaths = 0;
  const R = { dmg: {}, hurt: {}, modes: {}, win: false, r1: 0, t: 0, taken: 0 };
  for (let i = 0; i < 60 * 600; i++) {
    if (f.phase === 'scene') { R.r1 = f.time; f.beginRound2(); prev = f.bossHp; }
    let tx = k.hx, tz = k.hz; if (o.spell) { const l = k.lanterns?.find(q => q.real); if (l) { tx = l.x; tz = l.z; } else if (k.chain) { tx = (k.x + k.chain.x) / 2; tz = (k.z + k.chain.z) / 2; } else { const c = k.souls?.find(q => !q.freed); if (c) { tx = c.x; tz = c.z; } } }
    const d = Math.hypot(tx - m.x, tz - m.z), a = Math.atan2(tx - m.x, tz - m.z); let p = [], go = d > k.hr + 1.1 ? 1 : 0;
    for (const e of f.ev) { if (e.k === 'cue' && rnd() < o.dodge) act = i + Math.round(Math.max(.1, e.lead - .16 + (rnd() - .5) * .22) * 60); if (e.k === 'hurt') R.hurt[k.mode] = (R.hurt[k.mode] ?? 0) + e.dmg; }
    if (act === i) p = o.jump && k.mode === 'lowWater' ? tap('jump') : tap('dodge'); else if (f.hp < 35 && f.heals > 0 && m.state === 'free') p = tap('heal');
    else if (o.spell && m.can.ultimate && d < 8) p = tap('ultimate'); else if (o.spell && m.can.skill2 && (k.mode === 'tide' || k.committed)) p = tap('skill2');
    else if (d < k.hr + 2.0 && i - last > 9 && i > wait) { last = i; p = tap('attack'); }
    f.step(DT, Math.sin(a) * go, Math.cos(a) * go, p); R.modes[k.mode] = (R.modes[k.mode] ?? 0) + DT;
    const did = Math.max(0, prev - f.bossHp); prev = f.bossHp; if (did) R.dmg[k.mode] = (R.dmg[k.mode] ?? 0) + did;
    if (f.phase === 'finish' || f.phase === 'won') { R.win = true; break; } if (m.dead) { deaths++; break; }
  }
  R.t = f.time; R.taken = f.taken; return R;
}
const pc = x => (x * 100).toFixed(0) + '%';
for (const kind of Object.keys(KIND)) {
  const L = Array.from({ length: N }, (_, i) => bout(kind, i + 1)), sum = key => L.reduce((o, r) => { for (const [a, b] of Object.entries(r[key])) o[a] = (o[a] ?? 0) + b; return o; }, {}), dmg = sum('dmg'), hurt = sum('hurt'), modes = sum('modes'), T = L.reduce((a, r) => a + r.t, 0), tot = Object.values(dmg).reduce((a, b) => a + b, 0), th = Object.values(hurt).reduce((a, b) => a + b, 0);
  console.log(`\n== ${kind}: wins ${pc(L.filter(r => r.win).length / N)}, ${(T / N / 60).toFixed(2)} min (round 1 ${(L.reduce((a, r) => a + r.r1, 0) / N).toFixed(0)} s), blows taken ${(L.reduce((a, r) => a + r.taken, 0) / N).toFixed(1)}`);
  console.log('time in: ' + Object.entries(modes).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([c, q]) => `${c} ${pc(q / T)}`).join('  '));
  console.log('boss damage taken by: ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c, q]) => `${c} ${pc(q / tot)}`).join('  '));
  console.log('player damage taken from: ' + Object.entries(hurt).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c, q]) => `${c} ${pc(q / th)}`).join('  '));
}
