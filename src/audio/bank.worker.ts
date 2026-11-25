import { DEFS, SR, courtIR, render } from './bank.ts';
const post = (m: unknown, t: Transferable[]) => (self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(m, t);
self.onmessage = () => { const l = courtIR(0), r = courtIR(1); post({ ir: [l, r], sr: SR }, [l.buffer, r.buffer]); for (const d of DEFS) { const x = render(d); post({ n: d.n, x, sr: SR }, [x.buffer]); } post({ done: true }, []); };
