// Checks the story text in script files against docs/game/STYLE.md: the thou/thee/thy/ye grammar and the banned modern words.
// Run: node tools/lintText.mjs (exit 1 on a failing error). The vitest suite runs the same check (tests/lintText.test.mjs).
// Errors in a file listed in ALLOWLIST are printed but do not fail: that text has not been approved for rewrite yet.
// Notes are style hints (contractions, modern "you", comic "forsooth", too many old words); they never fail.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files whose text the owner has not approved yet (repo-relative, forward slashes). Remove an entry once its file is rewritten. */
export const ALLOWLIST = ['src/game/riverScript.ts', 'src/game/hoursScript.ts'];

/** Owner decision: narration takes -s for he, she and it (he takes). Set to 'eth' to flip narration to -eth (he taketh); the check is a note, so flipping never fails the build. Speech in quotes is never checked. */
export const NARRATION_3S = 's';
const PRONOUNS3 = new Set(['he', 'she', 'it']);
/** True for the -s form of a verb in BASE_VERBS (takes, reaches). */
const isS3 = w => [...BASE_VERBS].some(b => w === b + 's' || w === b + 'es');

const VOWEL = /^[aeiou]/i;
const SENTENCE_END = new Set(['.', '!', '?', '"', ';', ':']);
const OBJECT_PREPS = new Set(['to', 'for', 'with', 'of', 'from', 'by', 'at', 'on', 'in', 'upon', 'unto', 'about', 'against', 'into', 'among', 'between', 'betwixt', 'except', 'toward', 'towards', 'behind', 'before', 'after', 'beneath', 'beside', 'under', 'over', 'through', 'without']);
/** Words that may sit between "thou" and its verb. */
const THOU_SKIP = new Set(['not', 'never', 'also', 'still', 'now', 'only', 'already', 'ever', 'truly', 'surely', 'indeed', 'too', 'yet', 'then', 'so', 'here', 'there', 'all', 'even', 'just']);
/** Wrong verb after thou, with the form to use. */
const THOU_FIX = { is: 'art', are: 'art', was: 'wast', were: 'wert', have: 'hast', has: 'hast', had: 'hadst', does: 'dost', did: 'didst', do: 'dost', will: 'wilt', shall: 'shalt', can: 'canst', may: 'mayst', could: 'couldst', would: 'wouldst', should: 'shouldst', might: 'mightst', hath: 'hast', doth: 'dost' };
/** Auxiliaries that invert with thou: the verb after thou is then the plain form (didst thou burn). */
const THOU_INVERTS = new Set(['art', 'wast', 'wert', 'hast', 'hadst', 'dost', 'didst', 'wilt', 'shalt', 'canst', 'mayst', 'couldst', 'wouldst', 'shouldst', 'mightst', 'doth']);
/** Modals in their thou form: the verb after them is plain (thou canst see). */
const THOU_MODALS = new Set(['canst', 'mayst', 'wilt', 'shalt', 'couldst', 'wouldst', 'shouldst', 'mightst', 'must']);
/** Regular verbs that need -est after thou. A short list of the verbs this game's speech uses. */
const BASE_VERBS = new Set(['burn', 'keep', 'know', 'see', 'come', 'go', 'hear', 'speak', 'give', 'take', 'make', 'live', 'die', 'rise', 'fall', 'bring', 'want', 'feel', 'let', 'tell', 'say', 'find', 'leave', 'stay', 'look', 'call', 'wait', 'hold', 'run', 'cut', 'break', 'love', 'fear', 'seek', 'carry', 'lay', 'lift', 'close', 'open', 'bear', 'reach', 'count', 'breathe', 'climb', 'answer', 'cross', 'row', 'sink', 'swing', 'strike', 'stand', 'turn', 'drown', 'wake', 'sleep', 'pray', 'weep', 'forget', 'remember', 'believe', 'cast', 'hide', 'lie', 'mean', 'need', 'owe', 'pay', 'hate', 'trust', 'read', 'send', 'set', 'show', 'stop', 'try', 'use', 'win', 'write', 'walk', 'watch', 'wish', 'kneel', 'weigh']);
/** Words ending in s that are correct after thou. */
const THOU_OK_S = new Set(['this', 'thus', 'us', 'yes', 'alas', 'always', 'perhaps', 'unless', 'across', 'its', 'his', 'ours', 'yours', 'less', 'as', 'towards', 'whereas', 'besides', 'sometimes', 'nevertheless']);
/** What follows thee when it should be thou: a verb or auxiliary. */
const SUBJECT_FOLLOWERS = new Set([...Object.keys(THOU_FIX), ...Object.values(THOU_FIX), 'must', 'shall', 'will', 'can', 'may', 'could', 'would', 'should', 'might', 'art', 'wast', 'wert', 'hast', 'hadst', 'dost', 'didst', 'wilt', 'shalt', 'canst', 'mayst', 'couldst', 'wouldst', 'shouldst', 'mightst']);
/** Modern words that do not belong in the register. */
const BANNED = new Set(['okay', 'ok', 'gonna', 'wanna', 'gotta', 'yeah', 'yep', 'nope', 'hey', 'guys', 'cool', 'kinda', 'sorta', 'dude', 'hi', 'bye', 'lol']);
/** Old words: at most two in one line (STYLE: "one or two a line at most"). */
const OLD_WORDS = new Set(['ere', 'nigh', 'whence', 'whither', 'hither', 'thence', 'aught', 'naught', 'mayhap', 'alas', 'yea', 'nay', 'wherefore', 'betwixt', 'anon']);
const CONTRACTIONS = new Set(["don't", "doesn't", "didn't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "shouldn't", "wouldn't", "couldn't", "it's", "that's", "there's", "here's", "what's", "i'm", "you're", "we're", "they're", "let's", "i'll", "i've", "i'd", "you'll"]);

/** The string literals of a TypeScript source, each with the line it starts on. Comments are skipped. */
export function stringLiterals(src) {
  const out = [];
  let line = 1;
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2), stop = e < 0 ? src.length : e + 2;
      line += src.slice(i, stop).split('\n').length - 1; i = stop; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const start = line; let text = ''; i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { text += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '\n') line++;
        text += src[i]; i++;
      }
      i++;
      out.push({ line: start, text });
      continue;
    }
    i++;
  }
  return out;
}

/** Words (lower-cased, with their apostrophes) and sentence punctuation of one literal, in order. */
export function tokenize(text) {
  const toks = [];
  for (const m of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*|[.!?;:,"“”]/g)) {
    const w = m[0];
    toks.push(/^[A-Za-z]/.test(w) ? { w: w.replace('’', "'").toLowerCase() } : { p: w });
  }
  return toks;
}

/** Checks one literal's text. Returns findings without file names. */
export function lintLiteral(text, mode = NARRATION_3S) {
  const toks = tokenize(text), found = [];
  let inQuote = false;
  const add = (level, rule, match, message) => found.push({ level, rule, match, message });
  const word = i => (toks[i] && toks[i].w) || '';
  const isPunct = i => !toks[i] || SENTENCE_END.has(toks[i].p);

  let oldCount = 0;
  toks.forEach((t, i) => {
    if (t.p !== undefined) { if (t.p === '"') inQuote = !inQuote; else if (t.p === '“') inQuote = true; else if (t.p === '”') inQuote = false; return; }
    const w = t.w, prev = i > 0 ? toks[i - 1] : undefined;
    if (OLD_WORDS.has(w)) oldCount++;

    if (w === 'ye' && word(i + 1) === 'olde') add('error', 'ye-olde', 'ye olde', 'Never write "ye olde".');
    if (w === 'ye' && prev && prev.w && OBJECT_PREPS.has(prev.w)) add('error', 'ye-object', `${prev.w} ye`, 'ye is the plural subject; as an object write you.');
    if (w === 'thou' && prev && prev.w && OBJECT_PREPS.has(prev.w)) add('error', 'thou-object', `${prev.w} thou`, 'thou is the subject; after a preposition write thee.');

    if (w === 'thee') {
      let j = i + 1; while (THOU_SKIP.has(word(j))) j++;
      const next = word(j);
      if (SUBJECT_FOLLOWERS.has(next) || BASE_VERBS.has(next)) add('error', 'thee-subject', `thee ${next}`, 'thee is the object; the subject is thou.');
      else if (isPunct(i - 1)) add('error', 'thee-subject', 'thee', 'Sentence-initial thee is the object; the subject is thou.');
    }

    if (w === 'thou') {
      // Inverted after an auxiliary (didst thou burn, art thou, hast thou): the verb after thou is plain.
      if (THOU_INVERTS.has(prev?.w)) return;
      let j = i + 1; while (THOU_SKIP.has(word(j))) j++;
      const next = word(j);
      if (!next) return;
      if (THOU_MODALS.has(next) && /(est|eth)$/.test(word(j + 1))) add('error', 'thou-modal', `thou ${next} ${word(j + 1)}`, 'A modal takes the plain verb: thou canst see.');
      if (THOU_FIX[next]) add('error', 'thou-verb', `thou ${next}`, `Thou takes ${THOU_FIX[next]}, not ${next}.`);
      else if (/eth$/.test(next)) add('error', 'thou-eth', `thou ${next}`, `-eth is for he, she and it: thou takes -est (${next.slice(0, -3)}est).`);
      else if (BASE_VERBS.has(next)) add('error', 'thou-verb', `thou ${next}`, `Thou takes -est: thou ${next}est (or the irregular form).`);
      else if (/s$/.test(next) && !/st$/.test(next) && !/ss$/.test(next) && !THOU_OK_S.has(next)) add('error', 'thou-verb', `thou ${next}`, `Thou takes -est: thou ${next.slice(0, -1)}est.`);
    }

    if (w === 'thy' && VOWEL.test(word(i + 1))) add('error', 'thy-vowel', `thy ${word(i + 1)}`, 'Before a vowel write thine.');
    if (w === 'thine' && word(i + 1) && !VOWEL.test(word(i + 1)) && !isPunct(i + 1)) add('error', 'thine-consonant', `thine ${word(i + 1)}`, 'Before a consonant write thy.');

    if (BANNED.has(w)) add('error', 'banned-word', w, `"${w}" is modern; find a register word.`);

    if (CONTRACTIONS.has(w)) add('note', 'contraction', w, 'Write the contraction out (do not, it is).');
    if (w === 'you' && (SUBJECT_FOLLOWERS.has(word(i + 1)) || BASE_VERBS.has(word(i + 1)) || i === 0)) add('note', 'you-subject', `you ${word(i + 1)}`.trim(), 'You as subject is modern: thou (one person) or ye (several).');
    if (!inQuote && PRONOUNS3.has(w)) {
      const n = word(i + 1);
      if (mode === 's' && /eth$/.test(n)) add('note', 'third-person-form', `${w} ${n}`, 'Narration takes -s for he, she and it (he takes).');
      if (mode === 'eth' && n && isS3(n)) add('note', 'third-person-form', `${w} ${n}`, 'Narration takes -eth for he, she and it (he taketh).');
    }
    if (w === 'forsooth') add('note', 'forsooth', w, 'Comic in this register: avoid.');
  });
  if (oldCount > 2) add('note', 'old-words', `${oldCount} old words`, 'More than two old words in one line.');
  return found;
}

/** Lints one source file's text. */
export function lintText(src, file = '<text>', mode = NARRATION_3S) {
  const out = [];
  for (const lit of stringLiterals(src)) {
    for (const f of lintLiteral(lit.text, mode)) out.push({ file, line: lit.line, ...f });
  }
  return out;
}

/** Every story script file under `src/` (names ending in Script.ts or script.ts), repo-relative with forward slashes. */
export function scriptFiles(root) {
  const found = [];
  const walk = dir => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (/[Ss]cript\.ts$/.test(name.name)) found.push(relative(root, p).split(sep).join('/'));
    }
  };
  const src = join(root, 'src');
  if (existsSync(src)) walk(src);
  return found.sort();
}

/** Lints every script file in the repo at `root`. */
export function lintRepo(root = fileURLToPath(new URL('..', import.meta.url))) {
  const files = scriptFiles(root);
  const findings = files.flatMap(f => lintText(readFileSync(join(root, f), 'utf8'), f));
  return {
    files,
    findings,
    failing: findings.filter(f => f.level === 'error' && !ALLOWLIST.includes(f.file)),
    allowed: findings.filter(f => f.level === 'error' && ALLOWLIST.includes(f.file)),
    notes: findings.filter(f => f.level === 'note'),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = lintRepo();
  const show = (label, list) => { if (!list.length) return; console.log(label); for (const f of list) console.log(`  ${f.file}:${f.line} [${f.rule}] ${f.match}: ${f.message}`); };
  console.log(`Scanned ${r.files.length} script files.`);
  show('Failing errors:', r.failing);
  show('Errors in allowlisted files (not failing yet):', r.allowed);
  show('Notes:', r.notes);
  process.exit(r.failing.length ? 1 : 0);
}
