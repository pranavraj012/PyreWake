// Every word the people say, in one place. Their conversations (story/people/*.ts) cue lines from here by name;
// change the words here, never in the people's files. Register: STYLE.md (thou, thee, thy before a consonant,
// thine before a vowel; verbs with -est or -st after thou; few old words a line).

export const AMMAJI = {
  name: 'Ammaji',
  sub: 'the Ash-Reader',
  meet: [
    'Come nigh. The ash is quieter where I sit, and I have need of quiet to read it.',
    'Thou art come up from the fire. Thou needest not say how. Most come up the same way, and most do not stay long enough to be asked.',
    'I read the names of the dead in what the pyres leave. Every name is in the ash, if one knows where to look.',
    "Thou hast no name of thine own, I think. Only the fire's name for thee, and that is a poor one. Take this bead, and keep it.",
  ],
  hub: ['Thou art back, and not yet ash. Sit. What wouldst thou have of me?'],
  replies: {
    lore: 'Read my ash.',
    beads: 'Here are three name-beads.',
    shop: 'Show me what thou hast for sale.',
    leave: 'Nothing. I am going.',
  },
  lore: [
    'Hold still. The ash keeps the shape of every one who burned, and thy shape is not the shape the fire gave thee.',
    'Thou hast a name the river took. Go and win it back. Bring me three of the beads that carry names, and I will tell thee the rest.',
  ],
  beadsThanks: [
    'Thou hast fed the ash, and it gives a little of thy life back. Thou shalt bear a little more harm now.',
    'Go on, child. The dead are in no hurry. Thou art.',
  ],
  kingWord: [
    'The Hanged King is burned. I felt him come down through the ash like a stone through water, and the ash was quieter after.',
    'Thou didst that. I do not thank thee for it, and I do not curse thee. Sit a while, if thou wilt.',
  ],
};

export const LOHAR = {
  name: 'Lohar',
  sub: 'the Smith',
  meet: [
    'Hold. Thou art too warm to be a corpse, and too quiet to be a thief.',
    'I am Lohar. I work the iron that falls out of the pyres when the bones are raked. The old smiths named it pyre-iron, and it takes an edge that keeps.',
    'Thy blade is a sorry thing. I can see the notch in it from here.',
    'Bring me iron, and I will make it honest. Or go on down into the pit, and see what else lies there.',
  ],
  pit: ['Back again. The iron has not gone anywhere.'],
  atHub: ['Thou hast found me. The forge is poor, but it is hot, and the heat is what matters.'],
  replies: {
    wares: 'Show me thy wares.',
    farewell: 'Farewell.',
  },
  kingWord: [
    'The King is burned. So much iron came up out of that fire at once that I have not slept since.',
    'A smith wants a forge where the smoke goes up nearer the sky. I am going up to the Last Pyre. Come and find me there, and bring thine iron.',
  ],
};
