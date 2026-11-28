import { DEFS, SR, courtIR, render } from './bank/index.ts';
const post = (m: unknown, t: Transferable[]) => (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(m, t);
self.onmessage = e => { const skip = new Set(e.data as string[]); const l = courtIR(0), r = courtIR(1); post({ ir: [l, r], sr: SR }, [l.buffer, r.buffer]); for (const d of DEFS) { if (skip.has(d.n.replace(/\d+$/, ''))) continue; const x = render(d); post({ n: d.n, x, sr: SR }, [x.buffer]); } post({ done: true }, []); };
