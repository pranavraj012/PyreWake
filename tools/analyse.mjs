// node tools/analyse.mjs [fights] : what different kinds of player actually see. Moves, spells and music, from headless fights.
import { makeProps } from '../src/arena/props.ts'; import { Fight } from '../src/combat/fight.ts'; import { Motor } from '../src/player/motor.ts'; import { King } from '../src/boss/king.ts'; import { Brain } from '../src/boss/brain.ts'; import { KHANDA } from '../src/weapons/khanda.ts'; import { D } from '../src/combat/difficulty.ts';
const N = +(process.argv[2] ?? 60), DT = 1 / 60, tap = a => [{ a, up: false }, { a, up: true }];
const MUSIC = { executioner: 'king', crawler: 'crawl', hanged: 'hang', blades: 'beneath', eclipse: 'beneath' };
/** mash: only attack. dodger: mashes and dodges about two blows in three. explorer: also holds, jumps, sprints, spells. */
const KIND = { mash: { dodge: 0 }, dodger: { dodge: .65 }, spells: { dodge: .65, spell: true }, explorer: { dodge: .7, spell: true, hold: .16, jump: .05, pause: .12 } };
function bout(kind, seed) {
  let s = seed * 7919 + 13; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const f = new Fight(new Motor(), new King(), new Brain(seed)), m = f.m, k = f.king, o = KIND[kind]; m.z = 5; f.furnish(makeProps()); let act = -1, last = 0, up = -1, wait = 0, prev = f.bossHp, src = 'free', tr = 'king', trAt = 0;
  const R = { clips: {}, dmg: {}, secs: {}, tracks: [], uses: {}, hitsTaken: 0, spellDmg: {}, t: 0, win: false, r1: 0, gap: [], lastSame: 0, run: 0 }; let chains = [], deaths = 0, idle = 0, total = 0, seenAt = {}, music = [];
  for (let i = 0; i < 60 * 600; i++) {
    if (f.phase === 'scene') { R.r1 = f.time; music.push([tr, f.time - trAt]); tr = 'beneath'; trAt = f.time; f.beginRound2(); prev = f.bossHp; }
    const d = m.targetDist, a = Math.atan2(k.hx - m.x, k.hz - m.z); let p = [], go = d > 2 ? 1 : 0;
    for (const e of f.ev) { if (e.k === 'prop' && e.broken) R[e.p.kind] = (R[e.p.kind] ?? 0) + 1; if (e.k === 'fell' && e.hit) R.crush = (R.crush ?? 0) + 1; }
    for (const e of f.ev) if (e.k === 'cue' && rnd() < o.dodge) act = i + Math.round(Math.max(.1, e.lead - .16 + (rnd() - .5) * .22) * 60);
    if (up === i) { p = [{ a: 'attack', up: true }]; up = -1; }
    else if (act === i) p = tap('dodge');
    else if (f.hp < 35 && f.heals > 0 && m.state === 'free') p = tap('heal');
    else if (o.spell && m.can.ultimate && d < 8) p = tap('ultimate'); else if (o.spell && m.can.skill2 && k.committed) p = tap('skill2'); else if (o.spell && m.can.skill1 && d < 4 && rnd() < .05) p = tap('skill1');
    else if (o.jump && d < 4 && up < 0 && rnd() < o.jump / 20) p = tap('jump');
    else if (d < 2.8 && up < 0 && i - last > 9 && i > wait) { last = i; if (o.hold && rnd() < o.hold) { p = [{ a: 'attack', up: false }]; up = i + 24; } else p = tap('attack'); if (o.pause && rnd() < o.pause) wait = i + 24; }
    f.step(DT, Math.sin(a) * go, Math.cos(a) * go, p); total++; if (m.state === 'free') idle++;
    for (const e of m.events) if (e.startsWith('clip:')) { const c = e.slice(5); R.clips[c] = (R.clips[c] ?? 0) + 1; seenAt[c] ??= f.time; src = c; } else if (e.startsWith('use:')) R.uses[e.slice(4)] = (R.uses[e.slice(4)] ?? 0) + 1;
    const did = Math.max(0, prev - f.bossHp); prev = f.bossHp; if (did) { const n = f.ev.find(e => e.k === 'detonate') ? 'rush' : f.ev.find(e => e.k === 'shotHit') ? 'sunder' : f.ev.find(e => e.k === 'rites') ? 'rites' : src; R.dmg[n] = (R.dmg[n] ?? 0) + did; }
    if (m.clip) R.secs[m.clip.name] = (R.secs[m.clip.name] ?? 0) + DT; const want = MUSIC[f.brain.style]; if (want !== tr && (want === 'beneath' || f.time - trAt >= 16)) { music.push([tr, f.time - trAt]); tr = want; trAt = f.time; }
    if (f.phase === 'finish' || f.phase === 'won') { R.win = true; break; } if (m.dead) { deaths++; break; }
  }
  R.t = f.time; music.push([tr, f.time - trAt]); R.tracks = music; R.idle = idle / total; R.deaths = deaths; R.hitsTaken = f.taken; R.seen = seenAt; return R;
}
const all = KHANDA.chains.flat(), known = [...new Set([...all, ...KHANDA.finishers, 'heavy', ...KHANDA.ripostes, ...Object.values(KHANDA.air), ...Object.values(KHANDA.from).filter(x => x !== 'finale'), 'sunder', 'rites', 'rush'])];
for (const kind of Object.keys(KIND)) {
  const L = Array.from({ length: N }, (_, i) => bout(kind, i + 1)), sum = k => L.reduce((o, r) => { for (const [a, b] of Object.entries(r[k])) o[a] = (o[a] ?? 0) + b; return o; }, {}), clips = sum('clips'), dmg = sum('dmg'), T = L.reduce((a, r) => a + r.t, 0), tot = Object.values(dmg).reduce((a, b) => a + b, 0), win = L.filter(r => r.win).length / N;
  const at = Object.entries(clips).filter(([c]) => known.includes(c)).sort((a, b) => b[1] - a[1]), n = at.reduce((a, b) => a + b[1], 0), pc = x => (x * 100).toFixed(0) + '%';
  console.log(`\n== ${kind}: wins ${pc(win)}, ${(T / N / 60).toFixed(2)} min, blows taken ${(L.reduce((a, r) => a + r.hitsTaken, 0) / N).toFixed(1)}, standing free ${pc(L.reduce((a, r) => a + r.idle, 0) / N)} of the time`);
  console.log('stone per fight:', ['lamp', 'pillar', 'crush'].map(q => `${q} ${(L.reduce((x, r) => x + (r[q] ?? 0), 0) / N).toFixed(1)}`).join(', '));
  console.log(`attacks per minute ${(n / T * 60).toFixed(0)}; different moves per fight ${(L.reduce((a, r) => a + Object.keys(r.seen).filter(c => known.includes(c)).length, 0) / N).toFixed(1)} of ${known.length}; never seen: ${known.filter(c => !clips[c]).join(' ') || 'none'}`);
  console.log('share: ' + at.slice(0, 16).map(([c, q]) => `${c} ${pc(q / n)}`).join('  '));
  for (const [i, ch] of KHANDA.chains.entries()) { const c = ch.map(x => clips[x] ?? 0), dm = ch.reduce((a, x) => a + (dmg[x] ?? 0), 0); console.log(`chain ${'ABC'[i]} per fight: ${c.map(x => (x / N).toFixed(1)).join(' > ')}  (starts that reach the closer ${pc(c[4] / Math.max(1, c[0]))}), damage ${pc(dm / tot)}`); }
  console.log('damage: ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, q]) => `${c} ${pc(q / tot)}`).join('  ')); const u = sum('uses'); console.log(`spells per fight: rush ${((u.skill1 ?? 0) / N).toFixed(1)}  sunder ${((u.skill2 ?? 0) / N).toFixed(1)}  rites ${((u.ultimate ?? 0) / N).toFixed(1)}`);
  const mus = {}; for (const r of L) for (const [t, q] of r.tracks) { mus[t] ??= []; mus[t].push(q); } console.log('music: ' + Object.entries(mus).map(([t, q]) => `${t} ${pc(q.reduce((a, b) => a + b, 0) / T)} in stretches of ${(q.sort((a, b) => a - b)[q.length >> 1]).toFixed(0)} s (shortest ${q[0].toFixed(0)}, ${(q.length / N).toFixed(1)} a fight)`).join('; ') + `; round 1 ${(L.reduce((a, r) => a + r.r1, 0) / N).toFixed(0)} s`);
}
// what each move is worth on its own: damage per second of commitment, up to where the next may start
console.log('\n== worth of each move'); const w = KHANDA.clips, row = n => { const c = w[n]; if (!c?.hit) return; const hits = c.hits ?? [c.hit], p = c.power ?? 1, dm = KHANDA.damage * p * (hits.length - 1 + (D.lastHit[n] ?? 1)), t = c.chain ?? c.dur; return [n, dm, t, dm / t]; };
for (const [i, ch] of KHANDA.chains.entries()) { const r = ch.map(row).filter(Boolean), dm = r.reduce((a, x) => a + x[1], 0), t = r.reduce((a, x) => a + x[2], 0); console.log(`chain ${'ABC'[i]}: ${dm.toFixed(0)} damage in ${t.toFixed(1)} s = ${(dm / t).toFixed(0)}/s   ` + r.map(x => `${x[0]} ${x[3].toFixed(0)}/s`).join('  ')); }
console.log([...KHANDA.finishers, 'heavy', ...KHANDA.ripostes, 'reckon', 'execute', 'comet', 'lowTurn', 'passL', 'palm', 'airCut', 'plungeHit'].map(row).filter(Boolean).map(x => `${x[0]} ${x[1].toFixed(0)} (${x[3].toFixed(0)}/s)`).join('  '));
console.log(`spells: rush ${D.rush.dmg} for ${D.rush.cost} fire (${(D.rush.dmg / D.rush.cost).toFixed(1)} per fire)  sunder ${D.sunder.dmg} for ${D.sunder.cost} (${(D.sunder.dmg / D.sunder.cost).toFixed(1)})  rites ${D.rites.dmg} = ${(D.rites.dmg / D.boss.hp1 * 100).toFixed(0)}% of round 1; a bar of fire takes ${Math.ceil(D.fireMax / D.gain.hit)} hits`);
