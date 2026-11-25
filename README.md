<div align="center">

![Pyrewake](docs/media/hero.jpg)

# PYREWAKE

**A dark boss-fight action game that runs in the browser, on desktop and on phones.**
No game engine, no model files, no motion capture, no audio files. Everything is code.

</div>

You are the Pyrekeeper, a human who tends the cremation fires and has died once beside them. Something that hangs in the old banyan has started wearing the dead.

## The fight in four lines

1. Hit the boss and its health goes down. Your normal attack always works on it.
2. When it attacks, dodge or guard.
3. Landing hits fills your fire. Spend fire on skills.
4. At half health it changes. Beat that too.

| | |
|---|---|
| ![Combo](docs/media/combo.jpg) | ![Cinder Rush](docs/media/rush.jpg) |
| ![Danger cue](docs/media/cue.jpg) | ![Phone](docs/media/phone.jpg) |

**One rule for reading danger:** a white star means dodge *or* guard, a red diamond means dodge, glowing ground means move. Each differs in shape and sound as well as colour.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # then open the printed Network address on a phone, in landscape
```

| | Keyboard and mouse | Gamepad | Touch |
|---|---|---|---|
| Move | W A S D | left stick | drag on the left |
| Attack (hold for heavy) | left click or J | X | Attack |
| Dodge | Space | B | Dodge |
| Guard (tap at the last moment to parry) | right click or K | LB | Guard |
| Cinder Rush | Q | RB | Rush |
| Heal | F | D-pad up | Heal |
| Pause | Esc | Start | pause icon |

## How it's made

| Part | Approach |
|---|---|
| Characters, weapons, arena | signed-distance sculpting in TypeScript, meshed and baked at build time by `forge/` |
| Motion | a small clip language over named pose channels, solved with two-bone IK, foot locking, inertialised blending, and simulated cloth and hair |
| Combat | 60 Hz fixed step with no rendering imports, so whole fights run headless in tests |
| Rendering | three.js (WebGL 2) with one layered surface shader, own HDR chain, height fog, GPU particles |
| Sound | synthesised at runtime with the Web Audio API |
| Checks | unit tests, bots that play hundreds of headless fights, per-tier performance budgets, scripted screenshots |

```
forge/        build-time sculpting, meshing, baking
src/combat/   rules, hits, difficulty   (no rendering)
src/weapons/  one module per weapon
src/player/   movement and state
src/boss/     simulation, moves, brain, drawing
src/anim/     rig, IK, clips, cloth, gaits
src/render/   shaders, post, effects
src/game/     camera, effects director, cutscenes
src/audio/    synthesis, score
src/ui/ src/input/ src/arena/ src/core/
```

## Commands

| Command | Does |
|---|---|
| `npm test` | combat, fairness, motion and bot tests |
| `npm run build` | typecheck and production build into `dist/` |
| `npm run perf` | triangle, draw and input checks on all three tiers |
| `npm run soak` | a bot plays the real game and reports hitches (`-- --phone --secs=90`) |
| `npm run fight` | scripted fight that captures every beat (`-- --phone`) |
| `npm run shots`, `npm run sheets` | stills, motion contact sheets |
| `npm run sfx` | measures every sound effect |
| `npm run forge [names]` | rebake models (`textures` needs the CC0 sources in `assets_src/`) |

Address options: `?nointro`, `?still`, `?touch`, `?tier=phone|mid|high`, `?bench=player`, `?bench=king`, `?shot=<name>`.

## Licence

Copyright © 2026 pranavraj012. All rights reserved. The source is visible for reading; it is not licensed for reuse or redistribution. Third-party material is listed in [LICENSES.md](LICENSES.md).
