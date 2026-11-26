import { describe, expect, it } from 'vitest';
import { ALLOWLIST, lintLiteral, lintRepo } from '../tools/lintText.mjs';

const errors = s => lintLiteral(s).filter(f => f.level === 'error').map(f => f.rule);
const notes = s => lintLiteral(s).filter(f => f.level === 'note').map(f => f.rule);

describe('STYLE.md grammar: thou, thee, thy, ye', () => {
  it('accepts the forms STYLE.md gives as right', () => {
    for (const s of ['Thou art the last keeper.', 'Didst thou burn him?', 'I give thee this.', 'Thy blade.', 'Thine eyes.', 'The fire is thine.',
      'Thou canst see it.', 'Thou shalt not swing.', 'Thou burnest it.', 'Thou hast the fire.', 'He doth not know.', 'Thou sayest it.', 'Thou art come back. Most do not.'])
      expect(errors(s), s).toEqual([]);
  });

  it('flags a wrong verb after thou, with the form to use', () => {
    expect(errors('Thou is the keeper.')).toEqual(['thou-verb']);
    expect(errors('Thou have seen it.')).toEqual(['thou-verb']);
    expect(errors('Thou does not know.')).toEqual(['thou-verb']);
    expect(errors('Thou will burn.')).toEqual(['thou-verb']);
    expect(errors('Thou burns.')).toEqual(['thou-verb']);
    expect(errors('Thou burn.')).toEqual(['thou-verb']);
  });

  it('flags -eth after thou (it is for he, she and it)', () => {
    expect(errors('Thou burneth.')).toEqual(['thou-eth']);
  });

  it('flags a modal followed by -est or -eth (thou canst see, never seest)', () => {
    expect(errors('Thou canst seest it.')).toEqual(['thou-modal']);
  });

  it('flags thee as a subject', () => {
    expect(errors('Thee art the last keeper.')).toEqual(['thee-subject']);
    expect(errors('Thee. Thee know.')).toEqual(['thee-subject', 'thee-subject']);
  });

  it('flags thou after a preposition (it is the object form thee there)', () => {
    expect(errors('Set it to thou.')).toEqual(['thou-object']);
  });

  it('flags thy before a vowel, and thine before a consonant', () => {
    expect(errors('Thy eyes burn.')).toEqual(['thy-vowel']);
    expect(errors('Thine blade.')).toEqual(['thine-consonant']);
  });

  it('flags ye as an object and "ye olde"', () => {
    expect(errors('To ye I say.')).toEqual(['ye-object']);
    expect(errors('Ye olde inn.')).toEqual(['ye-olde']);
  });
});

describe('banned modern words and notes', () => {
  it('fails on modern words', () => {
    expect(errors('Okay, go.')).toEqual(['banned-word']);
  });

  it('notes (never fails) contractions, modern you, forsooth and too many old words', () => {
    expect(notes("Most don't.")).toEqual(['contraction']);
    expect(notes('You came back.')).toEqual(['you-subject']);
    expect(notes('Forsooth.')).toEqual(['forsooth']);
    expect(notes('Ere nigh whence hither thence aught.')).toEqual(['old-words']);
    expect(errors("Most don't. Forsooth.")).toEqual([]);
  });
});

describe('the story scripts', () => {
  const r = lintRepo();

  it('finds the script files it should', () => {
    expect(r.files).toEqual(expect.arrayContaining(['src/game/riverScript.ts', 'src/game/script.ts']));
  });

  it('has no errors in any script file', () => {
    expect(r.failing).toEqual([]);
  });

  it('has no allowlisted files left', () => {
    expect(ALLOWLIST).toEqual([]);
  });
});
