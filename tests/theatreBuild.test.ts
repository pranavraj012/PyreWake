// The production bundle has no moment theatre panel: its labels are compiled out with the import.meta.env.DEV branch.
import { describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';

describe('the production build', () => {
  it('does not include the moment theatre panel', async () => {
    // what `vite build` sets for itself (vitest runs under NODE_ENV=test, which would keep the dev branch)
    const env = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    let out: Awaited<ReturnType<typeof build>>;
    try { out = await build({ mode: 'production', logLevel: 'silent', build: { write: false, minify: true } }); } finally { process.env.NODE_ENV = env; }
    const outputs: Rollup.RollupOutput[] = Array.isArray(out) ? out : [out as Rollup.RollupOutput];
    const code = outputs.flatMap(o => o.output).map(c => (c.type === 'chunk' ? c.code : '')).join('\n');
    expect(code.length).toBeGreaterThan(10000);
    for (const label of ['MOMENT THEATRE', 'R replays the last', 'Moment theatre']) expect(code).not.toContain(label);
    // the ?moment flag itself is not dev-only: the moment's plans are in the bundle
    expect(code).toContain('noose');
  }, 120000);
});
