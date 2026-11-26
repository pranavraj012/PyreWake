// node tools/pakdiff.mjs old.pak new.pak : which sounds changed, which are new
import fs from 'node:fs';
const read = f => { const b = fs.readFileSync(f), n = b.readUInt32LE(0), head = JSON.parse(b.subarray(4, 4 + n).toString()); let at = 4 + n; const m = new Map(); for (const [k, len] of head) { m.set(k, b.subarray(at, at + len)); at += len; } return m; };
const a = read(process.argv[2]), b = read(process.argv[3]); let same = 0; const changed = [], added = [];
for (const [k, v] of b) { if (!a.has(k)) added.push(k); else if (Buffer.compare(a.get(k), v) === 0) same++; else changed.push(k); }
console.log('unchanged', same, 'changed', changed.join(' ') || 'none', 'removed', [...a.keys()].filter(k => !b.has(k)).join(' ') || 'none'); console.log('added', added.length, added.join(' '));
