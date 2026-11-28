// node tools/restartCheck.mjs [bosses] [paths] : die-and-restart audit. For each boss (?boss=1|2|3) and each path (die, retry, grab,
// offer, menu, win, three deaths, another boss) the page is driven through the path, then ALL state that should be fresh is snapshotted
// and diffed against a fresh load driven to the same point. Every difference is stale state. Exit code 1 when any path differs.
// Args are comma lists, e.g. `node tools/restartCheck.mjs 2 a1,c2`. Default: every boss, every path.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const PORT = 5241, BOSSES = (process.argv[2] ?? '1,2,3').split(','), ONLY = process.argv[3]?.split(',') ?? null;
const srv = await createServer({ server: { port: PORT }, logLevel: 'error' }); await srv.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const url = (boss, extra = '') => `http://localhost:${PORT}/?boss=${boss}&tier=high${extra}`;

/** Runs in the page before any script: counts live listeners per target and type, so a leaked listener shows as a difference. */
const LISTENERS = () => {
  const label = t => t === window ? 'window' : t === document ? 'document' : t instanceof Element ? t.tagName + (t.id ? '#' + t.id : '') : 'other';
  const live = new WeakMap(), add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  window.__lc = {};
  const bump = (t, type, fn, d) => { let m = live.get(t); if (!m) live.set(t, m = new Map()); const s = m.get(type) ?? new Set(); if (d > 0) s.add(fn); else s.delete(fn); m.set(type, s); const k = label(t) + ':' + type; window.__lc[k] = (window.__lc[k] ?? 0) + d; };
  EventTarget.prototype.addEventListener = function (type, fn, o) { if (fn && !live.get(this)?.get(type)?.has(fn)) bump(this, type, fn, 1); return add.call(this, type, fn, o); };
  EventTarget.prototype.removeEventListener = function (type, fn, o) { if (fn && live.get(this)?.get(type)?.has(fn)) bump(this, type, fn, -1); return rem.call(this, type, fn, o); };
};

/** Runs in the page: every value that should be fresh after a restart, flattened to plain data. */
const SNAP = () => {
  const R = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  const flat = (v, d) => {
    if (v === null || v === undefined || typeof v !== 'object') return typeof v === 'function' ? undefined : R(v);
    if (Array.isArray(v)) return v.length <= 8 && v.every(x => typeof x !== 'object') ? v.map(R) : '[' + v.length + ']';
    if (v instanceof Set || v instanceof Map) return '{' + v.size + '}';
    if (v.isObject3D) return 'obj' + (v.visible ? '+' : '-');
    if (v.isColor) return v.getHexString();
    if (typeof v.x === 'number' && typeof v.y === 'number') return [v.x, v.y, v.z, v.w].filter(x => typeof x === 'number').map(R).join(',');
    if ('value' in v && Object.keys(v).length === 1) return flat(v.value, d);
    if (d < 1 && Object.getPrototypeOf(v) === Object.prototype) return prim(v, new Set(), d + 1);
    return '{..}';
  };
  const prim = (o, skip, d = 0) => { const out = {}; if (!o) return out; for (const k of Object.keys(o)) { if (skip.has(k)) continue; const f = flat(o[k], d); if (f !== undefined) out[k] = f; } return out; };
  const none = new Set();
  const S = {};
  S.fight = prim(__f, new Set(['m', 'boss', 'brain', 'props', 'ev', 'carry', 'blockers', 'target', 'aim', 'spent', 'queue', 'falling', 'blasts', 'shots', 'hazards', 'ids', 'swung', 'chipped', 'boomAt', 'wasReady']));
  Object.assign(S.fight, { props: __f.props.map(p => (p.broken ? 'x' : '.') + R(p.hp)).join(' '), hazards: __f.hazards.length, shots: __f.shots.length, blasts: __f.blasts.length, falling: __f.falling.length, queue: __f.queue.length, momentKey: __f.momentKey, spent: __f.spent.size, wasReady: Object.values(__f.wasReady).map(Boolean).join('') });
  S.brain = prim(__f.brain, new Set(['queue', 'recent']));
  Object.assign(S.brain, { queue: __f.brain.queue?.length, recent: __f.brain.recent?.length });
  S.king = prim(__king, new Set(['strikes', 'live', 'cues', 'ended']));
  S.king.staging = String(__king.staging);
  S.motor = prim(__m, new Set(['x', 'z', 'yaw', 'vx', 'vz', 'y', 'vy', 'speed', 'target', 'blockers', 'weapon', 'clip', 'events', 'spells', 'can', 't', 'started', 'sprintT', 'calm', 'combo', 'safe', 'hold', 'buf', 'sky', 'state']));
  Object.assign(S.motor, { clip: __m.clip?.name ?? null, state: __m.state, spells: __m.spells.join(','), can: Object.entries(__m.can).filter(([, v]) => v).map(([k]) => k).join(',') });
  S.pv = { group: __pv.group.visible, eye: __pv.eye.mesh.visible, blade: __pv.blade.mesh.visible, dis: R(__pv.dis.value), flash: R(__pv.flash.value.w) };
  S.moment = window.__moment ? prim(__moment, new Set(['spec', 'eye', 'at', 'sEye', 'sAt', 'from', 'fromQ', 'last', 'lastQ', 'fresh', 'cued', 'show'])) : null;
  if (S.moment) Object.assign(S.moment, { active: __moment.active, hideHero: __moment.hideHero, letterbox: __moment.letterbox, rate: __moment.rate(__king.stage) });
  S.qte = window.__qte ? { on: __qte.on, text: __qte.el.querySelector('p').textContent, cls: __qte.el.className } : null;
  S.offer = window.__kOffer ? prim(__kOffer, new Set(['moment', 'spec', 'show'])) : null;
  S.body = [...document.body.classList].filter(c => c !== 'ready' && c !== 'bare').sort().join(' ');
  S.menuOpen = __menu.open; S.hudPaused = __hud.paused;
  S.modes = { intro: window.__intro?.active, story: window.__story?.active, turn: window.__turn?.active, ending: window.__ending?.active, lessons: window.__lessons?.active };
  S.dir = prim(__dir, new Set(['views', 'cue', 'marks', 'crescents', 'court', 'kv', 'heroT', 'lens', 'c', 'hd', 'fx', 'post', 'cam', 'hud', 'input', 'camera', 'f', 'pv', 'ring']));
  S.cam = prim(__cam, new Set(['blockers', 'pos', 'look']));
  S.fog = window.__FOG ? { col: __FOG.uFogCol.value.toArray().map(R).join(','), moon: __FOG.uFogMoon.value.toArray().map(R).join(','), p: __FOG.uFogP.value.toArray().slice(0, 3).map(R).join(","), glow: __FOG.uGlowP.value.map(g => R(g.x) + '/' + R(g.w)).join(' ') } : null;
  S.light = window.__moon ? { moon: R(__moon.intensity), moonC: __moon.color.getHexString(), hemi: R(__hemi.intensity), kick: R(__kick.intensity), exposure: R(__post.exposure.value), heat: R(__post.heat.value), fade: R(__post.fade.value), pulse: R(__post.pulse.value.w), shaft: __post.shaft.value.toArray().map(R).join(',') } : null;
  S.visible = [...document.querySelectorAll('#app > *:not(canvas), body > *:not(#app)')].filter(e => e.id !== "fps" && e.tagName !== "CANVAS" && e.tagName !== 'SCRIPT' && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.02).map(e => (e.id || e.tagName) + '.' + [...e.classList].join('.') + ':' + e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)).sort();
  S.sound = __sound.score?.mood ?? null;
  S.listeners = window.__lc;
  S.storage = Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k).slice(0, 160)]));
  void none;
  return S;
};

const READY = () => document.body.classList.contains('ready') && !!window.__f && window.__frames > 5;

/** A fresh tab with its own storage, the listener tracker, and the errors it raised. */
async function open(boss, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(), errs = [];
  await p.addInitScript(() => { try { if (!localStorage.getItem('pyrewake')) localStorage.setItem('pyrewake', JSON.stringify({ learned: true })); } catch { } }); await p.addInitScript(LISTENERS); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  await p.goto(url(boss, extra)); await p.waitForFunction(READY, null, { timeout: 120000 }); await p.keyboard.press('F12');
  return { ctx, p, errs };
}
const wait = (p, ms) => p.waitForTimeout(ms);
const snap = async p => { await wait(p, 1200); await p.evaluate(() => { __f.passive = false; }); await wait(p, 100); return p.evaluate(SNAP); };

/** The state a player would have built up before dying: the same in every path. */
const MESS = () => {
  window.__wasP = __f.passive; __f.passive = true; __f.damage(20, 1, false, 0); __f.fire = 40; __f.wake = 70; __f.streak = 4; __f.hp = 40; __f.heals = 1;
  const lamp = __f.props.find(p => p.kind === 'lamp' && !p.broken); if (lamp) __f.hitProp(lamp, 4, lamp.x - 1, lamp.z, 'hero', 99);
};
/** The killing blow. */
const KILL = () => { __f.flame = false; __f.hp = 1; __f.strikePlayer(50, true, 0, 'x'); };
/** Waits for the fight to bring itself back after the fall (the game resets it three seconds after death). */
const AUTO_RESET = () => new Promise(r => { const t0 = Date.now(); const iv = setInterval(() => { if (__f.deadT === -1 && !__m.dead && Date.now() - t0 > 300) { clearInterval(iv); r(); } }, 50); });
const ENDING_WAIT = () => new Promise(r => { const iv = setInterval(() => { if (__ending.t > 12) { clearInterval(iv); r(); } }, 100); });
const ROUND_LIVE = () => __f.phase === 'r1' && !window.__intro?.active && !window.__story?.active && !__menu.open && __f.time > 0.5;

/** Presses the menu's play, and gets through the telling (any press skips it). */
async function startFromMenu(p) {
  await p.evaluate(() => __menu.play()); const t0 = Date.now();
  while (Date.now() - t0 < 90000) { if (await p.evaluate(ROUND_LIVE)) break; await p.keyboard.press('KeyE'); await wait(p, 700); }
  await wait(p, 300);
}

/** Each path: what it drives after opening the fight (`mode`: the URL extras). `start` paths are compared with a fresh start from the menu. */
const PATHS = {
  a1: { mode: '', run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await p.evaluate(AUTO_RESET); } },
  a2: { mode: '', run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await wait(p, 300); await p.evaluate(() => __hud.onRestart()); } },
  b1: { mode: '&round2', ref: 'round2', run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await p.evaluate(AUTO_RESET); } },
  b2: { mode: '&round2', ref: 'round2', run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await wait(p, 300); await p.evaluate(() => __hud.onRestart()); } },
  c1: { mode: '', run: async p => { await p.evaluate(MESS); if (!(await p.evaluate(() => typeof __king.seize === 'function'))) throw new Error('boss has no grab'); await p.evaluate(() => __king.seize('noose', __f)); await wait(p, 900); await p.evaluate(KILL); await p.evaluate(AUTO_RESET); } },
  c2: { mode: '', run: async p => { await p.evaluate(MESS); await p.evaluate(() => { if (typeof __king.offer === 'function') __king.offer('chain'); else { __king.reward = 'ride'; __king.rewardLeft = 6; } }); await wait(p, 1500); await p.evaluate(KILL); await p.evaluate(AUTO_RESET); } },
  c3: { mode: '', run: async p => { await p.evaluate(MESS); if (!(await p.evaluate(() => typeof __king.seize === 'function'))) throw new Error('boss has no grab'); await p.evaluate(() => __king.seize('noose', __f)); await wait(p, 900); await p.evaluate(KILL); await wait(p, 200); await p.evaluate(() => __hud.onRestart()); } },
  d: { mode: '', start: true, run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await wait(p, 300); await p.evaluate(() => __hud.onMenu()); await wait(p, 500); await startFromMenu(p); } },
  e: { mode: '&round2', run: async p => { await p.evaluate(() => { __f.passive = true; __m.revive(0, -1.5, Math.PI); __f.bossHp = 5; }); await wait(p, 100); await p.evaluate(() => __m.begin('light1')); await p.waitForFunction(() => __f.phase === 'finish', null, { timeout: 30000 }); await wait(p, 1500); await p.evaluate(() => { __m.revive(__king.x, __king.z + 1.8, Math.PI); __m.begin('finale'); }); await p.waitForFunction(() => __f.phase === 'won', null, { timeout: 30000 }); await wait(p, 400); await p.evaluate(ENDING_WAIT).catch(() => { }); await p.evaluate(() => __hud.onRestart()); } },
  f: { mode: '', run: async p => { for (let i = 0; i < 3; i++) { await p.evaluate(MESS); await wait(p, 200); await p.evaluate(KILL); await p.evaluate(AUTO_RESET); await wait(p, 300); } } },
  g: { mode: '', other: true, run: async p => { await p.evaluate(MESS); await wait(p, 300); await p.evaluate(KILL); await wait(p, 300); } },
};

/** Fresh loads driven to the same point as the paths. */
async function baseline(boss) {
  const out = {};
  { const { ctx, p } = await open(boss, '&nointro&still&round2'); out.round2 = await snap(p); await ctx.close(); }
  { const { ctx, p } = await open(boss, ''); await startFromMenu(p); await wait(p, 300); out.start = await snap(p); await ctx.close(); }
  return out;
}

const flatten = (o, pre = '', out = {}) => { if (o === null || typeof o !== 'object') { out[pre] = o; return out; } for (const k of Object.keys(o)) flatten(o[k], pre ? pre + '.' + k : k, out); return out; };
/** Clocks that keep moving on purpose (animation, the boss's own timers in a passive fight, run counters). */
const NOISE = /(^|.)(time|t|mt|prev|ht|th|frames|cued|fill|pace|age|lastDt|deaths|taken|best|fresh|noGrab|wait|calmT|rate|serial|manual|at|dir|flourish|reckoning|cloak|trauma|trail|stopped|s|sp|x|z|y|yaw|pz|px|vx|vz|vy|speed|lastMove|moveYaw|idleT|hx|hz|landAt|didFlick)$/;
// Countdowns and time-since clocks: only whether they run matters, not how far they have got.
const CLOCK = /(T|Age|Gap|Cd|Ago|Clock)$|stopped$/;

function diff(a, b) {
  const fa = flatten(a), fb = flatten(b), out = [];
  for (const k of [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort()) { if (NOISE.test(k) || /^listeners.AUDIO/.test(k)) continue; const x = fa[k], y = fb[k]; if (k === "sound" && (x === null || y === null)) continue; if (typeof x === "number" && typeof y === "number" && CLOCK.test(k.split(".").pop()) && (x > 0) === (y > 0)) continue; if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${k}: fresh=${JSON.stringify(x)} now=${JSON.stringify(y)}`); }
  return out;
}

let bad = 0; const report = [];
for (const boss of BOSSES) {
  console.log(`== boss ${boss}: baselines`); const base = await baseline(boss);
  for (const [name, path] of Object.entries(PATHS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    let d = [], errs = [];
    try {
      const { ctx, p, errs: e } = await open(boss, '&nointro&still' + path.mode); errs = e;
      await wait(p, 200);
      if (path.other) {
        await path.run(p); const other = boss === '1' ? '2' : boss === '2' ? '3' : '1';
        await p.goto(url(other, '&nointro&still')); await p.waitForFunction(READY, null, { timeout: 120000 });
        const fo = await open(other, '&nointro&still'); const ob = { start: await snap(fo.p) }; await fo.ctx.close();
        d = diff(ob.start, await snap(p)); // replaced below await ctx.close(); report.push(`boss ${boss} ${name} (now boss ${other})`);
      } else {
        await path.run(p);
        const now = await snap(p); await ctx.close();
        d = diff(path.ref === "round2" ? base.round2 : base.start, now);
      }
    } catch (err) { d = ['FAILED: ' + err.message.slice(0, 200)]; }
    if (errs.length) d.push('errors: ' + errs.join(' | '));
    if (d.length) bad++;
    console.log(`boss ${boss} ${name}: ${d.length ? d.length + ' difference(s)' : 'matches a fresh load'}`);
    for (const l of d.slice(0, 80)) console.log('   ' + l);
  }
}
await browser.close(); await srv.close();
console.log(bad ? `RESULT: ${bad} path(s) differ` : 'RESULT: every path matches a fresh load');
process.exitCode = bad ? 1 : 0;
