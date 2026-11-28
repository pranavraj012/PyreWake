# PYREWAKE: agent map

A souls-like in three.js + TypeScript (vite, vitest): one hero, the Pyrekeeper, fights three bosses in a burnt river-city. The hero is a sword-and-fire fighter; the bosses (the Hanged King, the Ferryman, the Sister of Hours) each have two rounds, staged cutscene "moments", and a reward or a price.
Stack: three.js 0.187, TypeScript, vite 8, vitest 5, playwright-core for the headless tools. Node >= 22.

## Layout

The boss files are final (refactor P2): each boss lives in its own folder under src/bosses/. The boss registry is src/bosses/index.ts (P3). The shared fight page is src/game/fightPage.ts (P4a; see "The shared fight page" below), and all three bosses boot on it (P4b). Re-check paths with `git ls-files` if in doubt.

- `src/main.ts`: the shared boot only: renderer, lights, camera, sky, post, input, touch, and the page switch (`?boss=N` loads that boss's page from the registry; no `?boss=` is the King). It builds one Ctx for every page.
- `src/bosses/index.ts`: BOSSES, the registry of every boss (id, ?boss= number, menu name, moments, lazy page loader for all three), plus bossHref and fightList. Plain data: it imports no boss module statically.
- `src/core/`: boot.ts (what main hands a page), loop.ts (60 Hz fixed step), quality.ts (render scale), settings.ts, viewport.ts, fullscreen.ts.
- `src/combat/`: fight.ts (the referee for one boss: health, hits, guard, phases), encounter.ts (crowds), difficulty.ts (every tuning number), spells.ts + spellScript.ts (the six fire arts).
- `src/boss/`: generic only. boss.ts (the interface the referee needs), view.ts (what the director needs of a picture), strike.ts (the strike language: Strike, Zone), words.ts (BossWords: what a boss says and its callouts).
- `src/bosses/king/`: the Hanged King. page.ts (his page, a FightPageSpec), king.ts (sim), kingView.ts, brain.ts, clips.ts, moves.ts, moves2.ts, scenes.ts (way in/out, the Prologue), cinema.ts (his turn), kingScript.ts, kingRewards.ts (rope and ride), lessons.ts (training), court.ts (arena).
- `src/bosses/river/`: the Ferryman. river.ts (sim), riverView.ts, brain.ts, clips.ts, moves.ts, riverDirector.ts, riverFx.ts, dragShot.ts, riverScenes.ts, riverScript.ts, rewards.ts (lantern and chain shots), ghats.ts (arena), page.ts (his page).
- `src/bosses/hours/`: the Sister of Hours. sister.ts (sim), sisterView.ts, pallView.ts, brain.ts, clips.ts, moves.ts, frame.ts, hoursDirector.ts, hoursFx.ts, glow.ts, hoursScenes.ts, hoursScript.ts, house.ts (arena), page.ts (her page).
- `src/game/`: fightPage.ts (the shared fight page: hero, menu, pause, reset, step, draw, loop; a boss page is a FightPageSpec), director.ts (fight events to look/sound/feel), moment.ts (staged moments: Moment/Offer/Prompt), camera.ts (follow cam), sceneKit.ts (Lens and Cues, shared by the scenes), script.ts (how a scene speaks), rewardShots.ts (generic reward runner and helpers: RewardRun<Props>, beginReward, retime/warp/compose; names no boss), actionCam.ts (the hero's composed shots: last rites, finishers), rewardShots' bosses' own rewards live in their folders, rewardChain.ts (the chain, shared by the King and the Ferryman), progress.ts + save.ts (progress, localStorage save).
- `src/arena/`: ruin.ts + props.ts (breakable court, shared). Each boss's own arena is in its folder (court.ts, ghats.ts, house.ts).
- `src/dev/theatre.ts`: moment theatre (`?moment=`, dev panel with `?dev`). Generic: playMoment, the panel. Each boss plans its moments in src/bosses/<id>/theatre.ts.
- `src/player/`: motor.ts (hero state machine, headless), view.ts, clips.ts, reactions.ts, stride.ts.
- `src/weapons/`: khanda*.ts (the sword), weapon.ts (interface). Nothing outside knows which is held.
- `src/foes/foe.ts`: lesser foes for crowds.
- `src/anim/`: rig.ts (FK + two-bone IK), pose.ts (clip language), body.ts, chains.ts (verlet cape/hair), cloth.ts, skeletons.ts.
- `src/render/`: surface.ts (THE surface shader, use it for every material), mats.ts (material ids), post.ts (HDR pipeline), fx.ts, impact.ts, marks.ts, ambient.ts, sky.ts, water.ts, shadowProxy.ts, assets.ts.
- `src/audio/`: sound.ts (mixer), bank.ts (every sound, synthesised; also used by tools/sfx.mjs), bank.worker.ts, score.ts (adaptive score), tracks.ts (CC0 music), resume.ts (iOS).
- `src/ui/`: hud.ts (HUD, plain HTML), menu.ts (title), prompts.ts, talk.ts (dialogue box), padnav.ts (gamepad in menus), style.css, meta/* (shop, upgrade, map, inventory, sheets, rules).
- `src/input/`: input.ts (one action map), bindings.ts, touch.ts.
- `src/story/`: dialogue.ts (runner), people/*.ts, peopleScript.ts.
- `src/bench.ts`: animation workbench (`?bench=player|king`).
- `forge/`: offline asset pipeline. `index.ts` bakes `forge/models/*.ts` into `public/baked/`; sdf.ts, mesher.ts, sheet.ts, textures.ts, pack.ts are its kit; `sound/` is sfx input.
- `tools/`: headless drivers that write to `shots_out/` (gitignored). Key ones: restartCheck.mjs, shots.mjs, peek.mjs, baseline.mjs, verify.mjs, fight.mjs, river.mjs, hours.mjs, scenes.mjs, sfx.mjs, lintText.mjs, analyse*.mjs (headless bots).
- `tests/`: vitest, `*.test.ts` (plus lintText.test.mjs). Fight, boss, moment, progress, restart, theatre, motion, audio.
- `public/`: baked models, sfx pak, music, media. `LICENSES.md`: third-party sources.

## Adding a boss

1. Make `src/bosses/<id>/` with the sim, view, brain, and a `page.ts`: a `FightPageSpec` (copy `src/bosses/river/page.ts`: `build` and `wire`) and `export async function boot<Name>(c: Ctx)` that calls `fightPage(c, spec)`.
2. Add one entry to `BOSSES` in `src/bosses/index.ts`: id, the next ?boss= number, menu name, moments, and `load: () => import('./<id>/page.ts').then(r => r.boot<Name>)`. The menu fight list, the page switch and the moment theatre all read from it.
3. Add the boss's page to the per-boss list below.

## The shared fight page (src/game/fightPage.ts)

fightPage(c, spec) builds the hero (skins, fx, PlayerView, Motor, Fight, Prompts, Hud, FollowCam, Director), then the menu, the pause triggers, the one reset, begin and toMenu, the step and draw skeletons, the warm-up, the theatre mount and the loop. A boss page provides (FightPageSpec):
- plain data: `bossId`, `status` (loading line), `heroAsh`, `names` (HUD r1, r2, won), `score` (sound moods for the rounds), `beaten` (the settings bit), `shots` (the ?shot= cameras).
- `build(kit)`: its geometry, its arena (group, ruin, update), its sim and brain, its two views (round 1, round 2), and any extra it needs later (for example a light). Returns the Parts.
- `wire(kit)`: its scenes (intro, turn, ending), its director, its staged moments, and the Wired hooks. Each hook says where the shell calls it, because the two pages order those steps differently: `before` (menu and intro movement, scene presses, the reward or climb press, the moment hold, before the referee), `after` (after the referee: reward scene, staging, held beats, hero pose), `tick` (turn and ending clocks, the director step), `blocker` (arena push), `clock` (the moment's stage), `reset` / `begin` / `toMenu` / `turnEnd` / `round2` / `theatreReset` / `tap`, the draw hooks `decay`, `camera` (the scene and moment camera, in its own order), `followTarget`, `frame`, and `debug` (extra window globals).
The shell owns everything else; do not copy shell code into a boss page.
What a boss page passes besides the hooks (all in its spec or wire):
- `words` (BossWords, src/boss/words.ts): `voice` (the director's cue names to its sound names: pain, pain2, screech, roar, breath, death, death2; a cue with no entry plays as its own name), `idleBreath` (the breath between attacks), `flame` and `quenched` (titles), `broken`, `crushed`, `lastRites` (callouts). The director and the HUD read it. The King's are in kingScript (KING_WORDS in page.ts), the Ferryman's RIVER_WORDS (riverScript.ts), the Sister's HOURS_WORDS (hoursScript.ts).
- `names` (HUD r1, r2, won): the boss bar name, the win title and the warm-up banner come from it; the HUD's initial HTML is filled from it at startup.
- `moment` (MomentPlan from src/bosses/<id>/theatre.ts): `play(name, c)` stages each ?moment= name with the boss's own entry points, and `what` gives the panel's words for them. The names are in the BOSSES entry.
- Rewards: the boss builds its props and its clip in its own rewards file, then runs them: `new RewardRun<Props>(kit, { lantern: new LanternGeo(), chainGeo: new ChainGeo() })` and `beginReward(riverClip(kind), m)` (src/bosses/river/rewards.ts; the King's is kingClip in kingRewards.ts). Its kit (RiverRewardKit, KingRewardKit) carries its own view; the kit's `end()` clears that view's flags when a scene ends.
- The director's moods: the King's brain styles are set in his wire (KING_MOODS); the other bosses set `dir.moods` in their own directors.
- The referee takes its boss and brain explicitly: `new Fight(motor, boss, brain)`. There is no default boss.
The King uses the optional hooks, which the others leave out: `play` (the Prologue starts on Play), `sceneBusy` and `noPrompts` (the Prologue and the training hold the pause and the prompts), `spells` and `train` and `hudOverride` (the training's starter spells, the Training button, his next fight and skip), `warm` (the eclipse state in the warm-up), `end` (after the director step), `bench` (`?bench=`), and `Pre.hold` from `before` (the training's held frame). `FightPageSpec.direct` says when a page starts with no menu (the King: not for `?moment=`).

## Per-boss: files to read before changing it

Read only the list for the boss you change, plus the shared engine files below.

**King (boss 1, the Hanged King; default page).** `src/bosses/king/*` (page.ts, theatre.ts, king.ts, kingView, brain, clips, moves, moves2, scenes, cinema, kingRewards, kingScript, lessons, court), `src/game/{sceneKit,rewardShots,rewardChain}.ts` (shared scene and reward helpers). Models: `forge/models/king.ts`, `forge/models/beneath.ts` (round 2). Tests: `tests/kingMoments.test.ts`, `tests/oneGrab.test.ts`, `tests/firstGrab.test.ts`.

**Ferryman (boss 2).** `src/bosses/river/*` (page.ts, river.ts sim, riverView.ts, brain, clips, moves, riverDirector, riverFx, dragShot, riverScenes, riverScript, rewards.ts for the lantern and chain shots, theatre.ts, ghats.ts arena), plus `src/game/{rewardShots,rewardChain,sceneKit}.ts` (shared helpers). Model: `forge/models/river.ts`. Tests: `tests/river*.test.ts`, `tests/riverMoments.test.ts`.

**Sister of Hours (boss 3).** `src/bosses/hours/*` (page.ts, sister.ts sim, sisterView.ts, pallView.ts, brain, clips, moves, frame.ts, hoursDirector, hoursFx, glow.ts, hoursScenes, hoursScript, house.ts arena, theatre.ts). Models: `forge/models/hours.ts`, `forge/models/house.ts`. Tests: `tests/hours*.test.ts`. Shared with the King and the Ferryman: `src/game/sceneKit.ts`.

**Shared engine (touch with care; every boss runs through them):** `src/combat/fight.ts` (referee), `src/boss/boss.ts` (the Boss interface), `src/game/director.ts`, `src/game/moment.ts`, `src/ui/hud.ts`, `src/dev/theatre.ts`. Left over: the referee's boss field is still named `king` (Fight.king, used by the bosses and the tests). It is a name only: nothing defaults to the King any more.

## Commands

- `npm run dev`: vite dev server on :5173.
- `npm run check`: `tsc --noEmit`. `npm test`: `vitest run`. `npm run build`: check + vite build.
- `npm run verify`: tools/verify.mjs; runs check, test, restartCheck in order, stops at the first failure. Known pre-existing timeout in motion.test 'cycles every mode' is skipped with a warning.
- `node tools/restartCheck.mjs [1,2,3] [paths]`: die-and-restart audit (starts its own vite server on :5241, needs installed Chrome). Exit 1 on stale state.
- `node tools/peek.mjs "<query>" "<js>" [out]`: one frame after running js in the page. `CAM='[[x,y,z],[lx,ly,lz],fov]'` frames it.
- `node tools/shots.mjs [names] [--phone]`: fixed-camera stills (names: main, wide, boss, face, player, ...).
- `node tools/baseline.mjs <dir>`: fixed-camera shots of all bosses into a folder; `node tools/baseline.mjs compare <a> <b>` diffs two folders.
- `npm run forge [names]`: bake models into public/baked. `npm run sfx [names]`: render the sound bank, levels and spectrograms.
- `node tools/fight.mjs`, `river.mjs`, `hours.mjs`, `scenes.mjs`, `menu.mjs`, `pad.mjs`, `perf.mjs`: scripted real-input runs and captures.

## URL flags

- `?boss=N` (numbers from BOSSES in src/bosses/index.ts): `?boss=2` river page, `?boss=3` Sister page; no param is the King.
- `?turn`: start at the turn (round 1 won, passive). `?round2`: start in round 2. `?nointro`: skip the intro scene.
- `?moment=<name>`: start one staged moment (names per boss in the registry, src/bosses/index.ts; the plans in each boss's theatre.ts). `?dev`: dev panel (dev builds only).
- `?shot=<name>`: fixed camera from the SHOTS table in each page, no HUD, passive fight. `?still`: passive fight.
- `?tier=high|phone|...`: quality tier. `?touch`: touch controls. `?fps`: fps meter. `?bench=player|king`: workbench.

## Gotchas

- Do not use MeshStandardMaterial directly: it renders white in this setup. Use `surface()` from src/render/surface.ts (and the mats.ts ids).
- Every arena must set `FOG.uGlowP` (the six glow slots, see src/bosses/king/court.ts, src/bosses/hours/house.ts, src/bosses/hours/page.ts), or the glows of the previous arena stay in the fog.
- Third-party assets must be CC0 (or equivalent) and listed in LICENSES.md with source and licence.
- `docs/game/` and `docs/BOSS*.md` are gitignored: design notes and plans live there, never committed. Do not commit them.
- Bash commands over 8 KB fail on Windows: put long scripts in a file (scratchpad) and run that.
- Shell is Git Bash on Windows; use forward slashes and `/dev/null`.
- Pre-existing failure: `tests/motion.test.ts` 'cycles every mode' times out. Known, not caused by your change.
- Keep changes behaviour-preserving during the refactor: the screenshot baseline (shots_out/baseline) and restartCheck are the gates.

## Refactor gates (during the refactor in progress)

- Gates after every phase: `npm run verify` and screenshots of all bosses compared to shots_out/baseline (`node tools/baseline.mjs`, then compare).
- Shot noise, measured in P1 on unchanged code (two runs of `node tools/baseline.mjs`, compared with `compare`): mean pixel diff average 1.41, worst 4.58 (b1_r2_boss, King round 2, flickering fire). A step is behaviour-preserving if its diff stays near these numbers; a jump on one boss is a real change.
- restartCheck at the P1 base (09feeab) reports 31 differing paths on unchanged code (stale-state audit, pre-existing). Compare the count against the base, not zero, until the restart fixes land.
