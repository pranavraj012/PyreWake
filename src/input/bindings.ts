// Which key or button does what. Everything that reads or names a control goes through here, so a remapping screen only has to write `settings.binds`.
import { settings } from '../core/settings.ts';
import type { Action } from './input.ts';

type Binds = Record<Action, string[]>;
/** Keyboard codes, or Mouse0 / Mouse1 / Mouse2. The first one is the one shown. */
export const DEFAULT_KEYS: Binds = { attack: ['Mouse0', 'KeyJ'], dodge: ['Space'], jump: ['KeyC'], guard: ['Mouse2', 'KeyK'], skill1: ['KeyQ'], skill2: ['KeyE'], ultimate: ['KeyR'], heal: ['KeyF'], pause: ['Escape'] };
/** Standard gamepad button numbers; '10+11' is both at once. */
export const DEFAULT_PAD: Binds = { attack: ['2'], dodge: ['1'], jump: ['0'], guard: ['4'], skill1: ['5'], skill2: ['7'], ultimate: ['6', '10+11'], heal: ['3', '12'], pause: ['9'] };
export const keysFor = (a: Action) => settings.binds?.keys?.[a] ?? DEFAULT_KEYS[a];
export const padFor = (a: Action) => settings.binds?.pad?.[a] ?? DEFAULT_PAD[a];
const ACTS = Object.keys(DEFAULT_KEYS) as Action[];
/** The action on a key code or mouse button, if any. */
export const actionOn = (code: string): Action | null => ACTS.find(a => keysFor(a).includes(code)) ?? null;
const NAME: Record<string, string> = { Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Escape: 'Esc', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt' }, PAD: Record<string, string> = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Select', 9: 'Start', 10: 'L3', 11: 'R3', 12: 'D-pad up', 13: 'D-pad down', 14: 'D-pad left', 15: 'D-pad right', '10+11': 'L3 + R3' };
export const keyName = (code: string) => NAME[code] ?? code.replace(/^(Key|Digit|Arrow)/, '');
/** What to call a control for whoever is holding what. */
export const label = (a: Action | 'move', dev: 'keys' | 'pad') => a === 'move' ? (dev === 'keys' ? 'W A S D' : 'Left stick') : dev === 'keys' ? keyName(keysFor(a)[0]) : PAD[padFor(a)[0]] ?? padFor(a)[0];
