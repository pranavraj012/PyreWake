// Module B: persistence of progress. One localStorage key holds the whole save file: three slots, the one
// in play, and a version number. Migrations run in order when an older file is read. A file that cannot be
// read is copied aside under a corrupt key, the player starts fresh, and the player is told (never throws).
import { type Progress, fresh, progress, replaceProgress, WEAPON_KINDS, type WeaponKind } from './progress';

export const SAVE_KEY = 'pyrewake.save.v1';
export const SLOT_COUNT = 3;
export const CURRENT_VERSION = 2;

export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveFile {
  version: number;
  active: number;
  slots: (Progress | null)[];
}

/** What happened when the save was read, for the player-facing message and tests. */
export type LoadNotice =
  | { kind: 'empty' }                                                  // nothing stored (v0): fresh
  | { kind: 'loaded'; from: number }                                   // read; `from` is the stored version
  | { kind: 'corrupt'; reason: string; copyKey: string | null }        // unreadable: copied aside, fresh
  | { kind: 'newer'; version: number; copyKey: string | null }         // written by a later build: copied aside, fresh
  | { kind: 'unavailable' };                                           // no storage: play in memory only

/** The browser's localStorage, or null where it cannot be reached (private windows, blocked site data). */
export function defaultStore(): SaveStore | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

// ---- validation -------------------------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNat = (v: unknown, max = Infinity): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
const isFin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrs = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string');

/** Returns a Progress with every field checked, or null when the data is not a progress record. Unknown
 *  extra fields are dropped; missing ones take their fresh value only if they are absent (not if wrong). */
export function checkProgress(raw: unknown): Progress | null {
  if (!isObj(raw)) return null;
  const base = fresh();
  const out: Progress = { ...base };
  const r = raw;
  if (!isNat(r.kauri) || !isNat(r.iron) || !isNat(r.beads)) return null;
  out.kauri = r.kauri; out.iron = r.iron; out.beads = r.beads;

  const w = r.weapon;
  if (!isObj(w) || !WEAPON_KINDS.includes(w.kind as WeaponKind) || !isNat(w.level, 10)) return null;
  out.weapon = { kind: w.kind as WeaponKind, level: w.level };
  if (!isStrs(r.weapons) || !r.weapons.every(k => WEAPON_KINDS.includes(k as WeaponKind))) return null;
  out.weapons = r.weapons;

  const f = r.flasks;
  if (!isObj(f) || !isNat(f.count) || !isNat(f.strength)) return null;
  out.flasks = { count: f.count, strength: f.strength };

  if (!isStrs(r.spells) || !isStrs(r.charms) || !isStrs(r.worn) || !isStrs(r.shrines) || !isStrs(r.burned)) return null;
  out.spells = r.spells; out.charms = r.charms; out.worn = r.worn; out.shrines = r.shrines; out.burned = r.burned;

  const eq = r.equipped;
  if (!Array.isArray(eq) || eq.length !== 2 || !isStrs(eq)) return null;
  out.equipped = [eq[0], eq[1]];

  const at = r.at;
  if (!isObj(at) || typeof at.region !== 'string' || typeof at.shrine !== 'string') return null;
  out.at = { region: at.region, shrine: at.shrine };

  const flags = r.flags;
  if (!isObj(flags)) return null;
  const cleanFlags: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') cleanFlags[k] = v;
    else return null;
  }
  out.flags = cleanFlags;

  const d = r.dropped;
  if (d === null) {
    out.dropped = null;
  } else {
    if (!isObj(d) || typeof d.region !== 'string' || !isFin(d.x) || !isFin(d.z) || !isNat(d.kauri)) return null;
    out.dropped = { region: d.region, x: d.x, z: d.z, kauri: d.kauri };
  }
  return out;
}

function checkFile(raw: unknown): SaveFile | null {
  if (!isObj(raw) || !isNat(raw.active, SLOT_COUNT - 1) || !Array.isArray(raw.slots) || raw.slots.length !== SLOT_COUNT) return null;
  const slots: (Progress | null)[] = [];
  for (const s of raw.slots) {
    if (s === null) { slots.push(null); continue; }
    const p = checkProgress(s);
    if (!p) return null;
    slots.push(p);
  }
  return { version: CURRENT_VERSION, active: raw.active, slots };
}

// ---- migrations ----------------------------------------------------------------------------------------------

/** MIGRATIONS[v] turns a version-v file into a version-(v+1) file. Version 0 is the state before any save
 *  file existed: a missing key, or an object with no version (an early single-progress `progress` field
 *  becomes slot 0). Add a new entry, and bump CURRENT_VERSION, when the format changes. */
// Migrations work on the raw stored data (not on checked Progress records), so an old field name can still be
// renamed after the current shape has changed. Each one hands the next version its output.
const MIGRATIONS: Record<number, (d: unknown) => unknown> = {
  0: (d) => {
    // Version 0 stored one progress record under `progress`; it becomes slot 0 of a version-1 file.
    const slots: unknown[] = [null, null, null];
    if (isObj(d) && d.progress !== undefined) slots[0] = d.progress;
    return { version: 1, active: 0, slots };
  },
  // Version 1 -> 2: the currency `fares` is renamed `kauri` (cowrie shells), also in a dropped pile.
  1: (d) => {
    if (!isObj(d) || !Array.isArray(d.slots)) return d;
    const slots = d.slots.map(s => {
      if (!isObj(s)) return s;
      const out: Record<string, unknown> = { ...s };
      if ('fares' in out) { if (out.kauri === undefined) out.kauri = out.fares; delete out.fares; }
      const dr = out.dropped;
      if (isObj(dr) && 'fares' in dr) {
        const d2: Record<string, unknown> = { ...dr };
        if (d2.kauri === undefined) d2.kauri = d2.fares;
        delete d2.fares;
        out.dropped = d2;
      }
      return out;
    });
    return { ...d, version: 2, slots };
  },
};

// ---- reading and writing -------------------------------------------------------------------------------------

export interface Read { file: SaveFile; notice: LoadNotice; }

/** Pure: turns the stored text into a save file, migrating and validating it. Never throws. `copy` is called
 *  with the unreadable text and returns the key it was kept under (or null if it could not be kept). */
export function readFile(raw: string | null, copy: (text: string) => string | null = () => null): Read {
  const fail = (reason: string, text: string | null, version?: number): Read => {
    const copyKey = text === null ? null : copy(text);
    const notice: LoadNotice = version !== undefined
      ? { kind: 'newer', version, copyKey }
      : { kind: 'corrupt', reason, copyKey };
    return { file: freshFile(), notice };
  };
  if (raw === null || raw.trim() === '') return { file: freshFile(), notice: { kind: 'empty' } };

  let data: unknown;
  try { data = JSON.parse(raw); } catch { return fail('the save is not valid JSON', raw); }
  if (!isObj(data) && data !== null) return fail('the save is not an object', raw);

  const version = isObj(data) && data.version !== undefined ? data.version : 0;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return fail('the save version is unreadable', raw);
  if (version > CURRENT_VERSION) return fail('', raw, version);

  try {
    for (let v = version; v < CURRENT_VERSION; v++) data = MIGRATIONS[v](data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'migration failed', raw);
  }
  const file = checkFile(data);
  if (!file) return fail('the save fields are not all readable', raw);
  return { file, notice: { kind: 'loaded', from: version } };
}

function freshFile(): SaveFile {
  return { version: CURRENT_VERSION, active: 0, slots: Array.from({ length: SLOT_COUNT }, () => null) };
}

export function encodeFile(file: SaveFile): string {
  return JSON.stringify({ version: CURRENT_VERSION, active: file.active, slots: file.slots });
}

// ---- the live save ---------------------------------------------------------------------------------------------

export interface Saves {
  /** What the player is told about the load, if anything (corrupt, newer, unavailable). */
  notice: LoadNotice;
  /** The message for the player, or null when the load needs no message. */
  message: string | null;
  file: SaveFile;
  /** Writes the file now. Returns an error text, or null on success. */
  write(): string | null;
  /** Active slot index. */
  readonly active: number;
  /** Puts progress into a slot (keeping the current one saved first) and makes it the one in play. */
  select(slot: number): void;
  /** Starts a new game in a slot, overwriting what was there. */
  start(slot: number): void;
  /** Empties a slot. If it is the one in play, progress starts fresh in it. */
  clear(slot: number): void;
  /** A short description of a slot for a menu, or null when it is empty. */
  summary(slot: number): { kauri: number; burned: number; at: string } | null;
  /** Stops autosaving. */
  close(): void;
}

function describe(notice: LoadNotice): string | null {
  switch (notice.kind) {
    case 'corrupt':
      return notice.copyKey
        ? `Your save could not be read (${notice.reason}). A copy is kept under "${notice.copyKey}". You start fresh.`
        : `Your save could not be read (${notice.reason}), and no copy could be kept. You start fresh.`;
    case 'newer':
      return notice.copyKey
        ? `Your save was made by a newer version of the game. A copy is kept under "${notice.copyKey}". You start fresh.`
        : `Your save was made by a newer version of the game, and no copy could be kept. You start fresh.`;
    case 'unavailable':
      return 'Saving is not available in this browser. Progress lasts only until you leave.';
    default:
      return null;
  }
}

/** Reads the store, loads the slot in play into `progress`, and autosaves every change to it. */
export function attachSaves(store: SaveStore | null = defaultStore()): Saves {
  let copies = 0;
  const copy = (text: string): string | null => {
    if (!store) return null;
    const key = `${SAVE_KEY}.corrupt.${Date.now()}${copies ? `.${copies}` : ''}`;
    copies++;
    try { store.setItem(key, text); return key; } catch { return null; }
  };

  let notice: LoadNotice;
  let file: SaveFile;
  if (!store) {
    notice = { kind: 'unavailable' };
    file = freshFile();
  } else {
    let raw: string | null = null;
    let readOk = true;
    try { raw = store.getItem(SAVE_KEY); } catch { readOk = false; }
    if (!readOk) {
      notice = { kind: 'unavailable' };
      file = freshFile();
    } else {
      const r = readFile(raw, copy);
      notice = r.notice;
      file = r.file;
    }
  }

  const writeFile = (): string | null => {
    if (!store) return null;
    try { store.setItem(SAVE_KEY, encodeFile(file)); return null; }
    catch (e) { return e instanceof Error ? e.message : 'the browser refused the save'; }
  };

  const loaded = file.slots[file.active];
  replaceProgress(loaded ? checkProgress(loaded) ?? fresh() : fresh());
  if (!loaded) file.slots[file.active] = structuredClone(progress.get()) as Progress;
  writeFile();

  const saves: Saves = {
    notice,
    message: describe(notice),
    file,
    write: writeFile,
    get active() { return file.active; },
    select(slot) {
      if (slot < 0 || slot >= SLOT_COUNT) return;
      file.slots[file.active] = structuredClone(progress.get()) as Progress;
      file.active = slot;
      const next = file.slots[slot];
      replaceProgress(next ? checkProgress(next) ?? fresh() : fresh());
      file.slots[slot] = structuredClone(progress.get()) as Progress;
      writeFile();
    },
    start(slot) {
      if (slot < 0 || slot >= SLOT_COUNT) return;
      file.active = slot;
      replaceProgress(fresh());
      file.slots[slot] = structuredClone(progress.get()) as Progress;
      writeFile();
    },
    clear(slot) {
      if (slot < 0 || slot >= SLOT_COUNT) return;
      file.slots[slot] = null;
      if (slot === file.active) {
        replaceProgress(fresh());
        file.slots[slot] = structuredClone(progress.get()) as Progress;
      }
      writeFile();
    },
    summary(slot) {
      const p = file.slots[slot];
      if (!p) return null;
      return { kauri: p.kauri, burned: p.burned.length, at: p.at.shrine ? `${p.at.region}, ${p.at.shrine}` : p.at.region };
    },
    close() { unsub(); },
  };

  // The slot in play mirrors progress: every change is written at once (cheap: a few hundred bytes).
  const unsub = progress.on(p => {
    file.slots[file.active] = structuredClone(p) as Progress;
    writeFile();
  });
  return saves;
}
