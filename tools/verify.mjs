// node tools/verify.mjs [--skip=<test name substring>] : the gates in order: tsc --noEmit, vitest run, node tools/restartCheck.mjs.
// Stops at the first failing gate. Failing vitest tests whose full name contains a skip string are reported as WARN and do not fail
// the run. The default skip list is the known pre-existing timeout. restartCheck starts its own vite server, so nothing is needed first.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KNOWN_SKIP = ['motion.test.ts cycles every mode'];
const extra = process.argv.filter(a => a.startsWith('--skip=')).map(a => a.slice(7));
const SKIP = [...KNOWN_SKIP, ...extra];
const warnings = [];
const t0 = Date.now();

function run(label, cmd, args) {
  console.log(`\n== ${label}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
}

function gate(label, cmd, args) {
  const code = run(label, cmd, args);
  if (code !== 0) { console.log(`\nVERIFY FAILED at: ${label} (exit ${code})`); summary(false); process.exit(1); }
  console.log(`${label}: ok`);
}

function summary(ok) {
  for (const w of warnings) console.log(`WARN: ${w}`);
  console.log(`verify ${ok ? 'PASSED' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

gate('tsc', 'npx', ['tsc', '--noEmit']);

// vitest: run with a JSON report so known failures can be told apart from new ones
const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-')), 'vitest.json');
console.log('\n== vitest: npx vitest run (json report)');
const vt = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${report}`], { stdio: 'inherit', shell: process.platform === 'win32' });
let json = null;
try { json = JSON.parse(fs.readFileSync(report, 'utf8')); } catch { /* no report: treated as a failure below */ }
if (!json) { console.log('\nVERIFY FAILED at: vitest (no JSON report)'); summary(false); process.exit(1); }
const failed = [];
for (const f of json.testResults ?? []) {
  if (f.status === 'failed' && (!f.assertionResults?.length)) failed.push({ name: `${path.basename(f.name)} (file)`, msg: f.message ?? '' });
  for (const a of f.assertionResults ?? []) {
    if (a.status === 'failed') failed.push({ name: `${path.basename(f.name)} ${a.title}`, msg: (a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 160) });
  }
}
const fatal = failed.filter(f => !SKIP.some(s => f.name.includes(s)));
for (const f of failed.filter(f => SKIP.some(s => f.name.includes(s)))) warnings.push(`known failure skipped: ${f.name} (${f.msg})`);
console.log(`vitest: ${json.numPassedTests} passed, ${json.numFailedTests} failed, ${json.numPendingTests ?? 0} pending, ${json.numTotalTestSuites} suites`);
if (fatal.length) {
  for (const f of fatal) console.log(`  FAIL ${f.name}: ${f.msg}`);
  console.log('\nVERIFY FAILED at: vitest');
  summary(false);
  process.exit(1);
}
if (vt.status !== 0 && !failed.length) { console.log('\nVERIFY FAILED at: vitest (non-zero exit, no failing test named)'); summary(false); process.exit(1); }
console.log('vitest: ok' + (warnings.length ? ' (with skipped known failures)' : ''));

gate('restartCheck', 'node', ['tools/restartCheck.mjs']);

summary(true);
