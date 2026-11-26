// Every word the river fight says, in one place. Scenes cue lines from here by name and time; change the words here, never in the scenes.
//
// The story, in order:
//   The way in. After the fire comes the crossing: a ferryman takes the ash of the dead over the Slow River to the far bank, where mornings start.
//   The law of the river is that only ash may cross. You set a lamp on the water to call him, and he comes up out of the river.
//   The turn. Beaten once, he holds the thing he has hidden under the jars of ash for forty years: his daughter, unburned. The river would not
//   carry her, and he would not set her down. He lets the dead who clung to his boat go into the water at last. What they paid him, he keeps,
//   and the coins come up out of the river onto him. He has set down every burden but the one he will not.
//   The end. The coins go back into the river. He is an old man with a bundle in his arms. He gave her his name, once, because he liked to hear
//   it called across the water. He holds out his lamp, and you light the boat; this is the one blow in the game you do not swing.

import type { Line } from './script.ts';
export { speak, type Line } from './script.ts';

export const RIVER_NAMES = { r1: 'The Ferryman', r2: 'The Unburdened', won: 'The Far Bank' } as const;

export const RIVER_INTRO = {
  lines: [
    { at: 1.2, until: 5.0, text: 'After the pyre, the crossing.' },
    { at: 5.6, until: 10.2, text: 'What the fire leaves is borne over the Slow River, to the far bank, where the mornings begin.' },
    { at: 10.8, until: 15.0, text: 'One man has rowed it for forty years, and he carries only ash.' },
    { at: 15.6, until: 20.2, text: 'The drowned, whom no fire reached, cling to his hull and pay him coin. He takes it. He does not carry them.' },
    { at: 20.8, until: 24.4, text: 'What he keeps beneath the jars, no one has seen.' },
    { at: 25.0, until: 28.6, text: 'Set a light upon the water. The ferry answers every light.' },
  ] as Line[],
  law: { text: '"Only ash shall cross."', voice: 'fCall' },
  title: { name: RIVER_NAMES.r1, sub: 'Warden of the Last Crossing' },
};

export const RIVER_TURN = {
  lines: [
    { at: 2.6, until: 6.4, text: 'Beaten, he reaches not for his pole. He reaches beneath the jars.' },
    { at: 7.0, until: 10.8, text: '"Feel her, keeper. She weigheth nothing."' },
    { at: 11.4, until: 15.6, text: 'A child the fire never touched. Forty years he has rowed her, and the river will not let her cross.' },
    { at: 16.2, until: 19.8, text: 'Only ash may cross. He would not set her down.' },
    { at: 20.6, until: 24.4, text: 'The drowned who clung to his boat, he gives back to the deep at last.' },
    { at: 28.8, until: 32.6, text: 'Their coin, he will not give. It comes up out of the river, upon him.' },
  ] as Line[],
  title: { name: RIVER_NAMES.r2, sub: 'Mailed in the Fares of the Drowned' },
};

export const RIVER_ENDING = {
  lines: [
    { at: 2.4, until: 6.4, text: 'The fares slip from him. The river takes back what was owed.' },
    { at: 7.2, until: 11.2, text: 'The drowned rise in the shallows. They have paid. They wait.' },
    { at: 12.6, until: 16.8, text: 'What remains is an old man, and in his arms a bundle that weighs nothing.' },
    { at: 17.6, until: 21.8, text: '"Forty years I rowed her toward the far bank. Forty years the river turneth me back."' },
    { at: 22.6, until: 26.6, text: '"I gave her my name, that I might hear it called across the water."' },
    { at: 27.4, until: 31.4, text: 'He holds his lamp out to thee. This is the one blow thou shalt not swing.' },
    { at: 35.0, until: 39.2, text: '"Call it from the far bank. Let aught answer."' },
  ] as Line[],
};

// The presses the Ferryman's staged moments offer the hero. Cue prompts stay plain, as STYLE.md asks.
export const RIVER_PRESS = { chain: 'Run the chain', lantern: 'Strike the lantern' } as const;

// The call-outs in the river fight. Cues ("Cut them free", "Cut him", "Up the pole") are instructions and stay plain.
export const RIVER_CALLS = { paid: 'Every one of them has paid', leapt: 'Leapt', souls: 'Cut them free', snapped: 'Chain riven', hauled: 'Hauled', cut: 'Cut him', pole: 'Up the pole', real: 'The true one' } as const;
