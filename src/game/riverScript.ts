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

export interface Line { at: number; text: string; until?: number; voice?: string }

export const RIVER_NAMES = { r1: 'The Ferryman', r2: 'The Unburdened', won: 'The Far Bank' } as const;

export const RIVER_INTRO = {
  lines: [
    { at: 0.8, until: 3.6, text: 'After the pyre, the crossing.' },
    { at: 4.0, until: 7.0, text: 'What the fire leaves is borne over the Slow River, to the bank where morning yet abides.' },
    { at: 7.3, until: 9.6, text: 'Set a light upon the water. The ferry answers every light.' },
  ] as Line[],
  law: { text: '"Only ash may cross."', voice: 'fCall' },
  title: { name: RIVER_NAMES.r1, sub: 'Warden of the Last Crossing' },
};

export const RIVER_TURN = {
  lines: [
    { at: 4.2, until: 7.2, text: '"She weighs nothing. Feel. She weighs nothing."' },
    { at: 7.4, until: 9.6, text: 'Beneath the jars of ash, a child the fire never touched. For her the river stilled.' },
    { at: 12.6, until: 16.4, text: 'The drowned he gave back to the deep. Their coin he would not give.' },
  ] as Line[],
  title: { name: RIVER_NAMES.r2, sub: 'Mailed in the Fares of the Drowned' },
};

export const RIVER_ENDING = {
  lines: [
    { at: 2.0, until: 4.3, text: 'The fares slip from him. The river takes back what was owed.' },
    { at: 4.6, until: 7.4, text: 'The drowned rise in the shallows. They have paid. They wait.' },
    { at: 9.6, until: 12.4, text: 'What remains is an old man, and in his arms a bundle that weighs nothing.' },
    { at: 17.2, until: 21.0, text: '"I gave her my name, that I might hear it called across the water."' },
    { at: 22.5, until: 26.6, text: '"Call it from the far bank. Let something answer."' },
  ] as Line[],
};

/** Shows each line at its time and clears it at `until`; pass the scene's clock every frame. */
export function speak(lines: Line[], t: number, at: (t: number, id: string, f: () => void) => void, verse: (s: string) => void) {
  lines.forEach((l, i) => { at(l.at, 'say' + i, () => verse(l.text)); if (l.until) at(l.until, 'unsay' + i, () => verse('')); });
  void t;
}
