// Every word the third fight says, in one place. Scenes cue lines from here by name and time; change the words here, never in the scenes.
//
// The story, in order:
//   The way in. Above the far bank the dying were carried up the hill to wait for the fire, and sisters counted their breaths. On the first
//   night the fire did not wait for them: the Sister of Hours barred the doors and lit the house. Smoke has stood over it since.
//   The turn. Beaten once, she asks the keeper the difference between them, pulls down her breath-cloth and breathes in the smoke: the hours
//   her people did not live. The sky tears open on a low red sun, and she rises into the Pall, the scythe through her like a gnomon.
//   The end. The hours go up into the light. A woman no bigger than you, a cut cord in her lap. You wait while she breathes seven times.
//   Then you give her the fire she gave them, after.
export { speak, type Line } from './script.ts';
import type { Line } from './script.ts';

export const HOURS_NAMES = { r1: 'The Sister of Hours', r2: 'The Pall', won: 'The Hour Moves' } as const;

export const HOURS_INTRO = {
  place: 'The Waiting House',
  lines: [
    { at: 0.9, until: 4.0, text: 'Above the far bank, the dying were borne up the hill to wait upon the fire.' },
    { at: 4.3, until: 7.2, text: 'On the first night, the fire did not wait for them.' },
    { at: 7.5, until: 10.0, text: 'Smoke has stood over the house since. Nothing beneath it has died.' },
  ] as Line[],
  /** From a bed as you pass. */ bed: { at: 10.3, until: 11.6, text: '"...is it morning yet, sister?"' },
  law: { at: 12.6, until: 15.0, text: '"Breathe out. I will count for you."' },
  title: { name: HOURS_NAMES.r1, sub: 'No one in her house died in the dark.' },
};

export const HOURS_TURN = {
  lines: [
    { at: 1.8, until: 4.8, text: '"You burn them after. I burned them before."' },
    { at: 5.0, until: 8.2, text: '"Tell me the difference, keeper. In the dark."' },
    { at: 11.6, until: 14.0, text: 'They had hours left. She takes them in.' },
  ] as Line[],
  title: { name: HOURS_NAMES.r2, sub: 'She keeps the hours they did not live.' },
};

export const HOURS_ENDING = {
  lines: [
    { at: 0.6, until: 3.8, text: 'The hours she kept go up into the light.' },
    { at: 12.5, until: 16.5, text: '"Forty-one asked for water."' },
    { at: 18.0, until: 21.2, text: '"It did not refuse them. Ask the fire why."' },
  ] as Line[],
  title: { name: HOURS_NAMES.won, sub: 'She was burned after.' },
};

/** In the fight: the count, spoken as breath. */
export const HOURS_COUNT = ['Seven...', 'six...', 'five...', 'four...', 'three...', 'two...', 'one...'];
export const HOURS_CALLS = { lost: 'She lost count', burn: 'The linen burns', tear: 'Torn', stake: 'The scythe stands', stakeBreak: 'Shattered', sunk: 'The sun sinks', held: 'She has you', torn: 'Torn free', cut: 'Linen cut', sever: 'She reels', risen: 'The sun climbs' };
