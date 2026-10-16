// --quick runs focused regressions; --full loads the existing module integration suites.
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const quick = new Set(['assist.test.js', 'geography-geology.test.js', 'actors.test.js', 'reliability.test.js', 'timing.test.js', 'engineering.test.js', 'eras.test.js', 'extras.test.js', 'terrain.test.js', 'fx.test.js', 'units_hd.test.js', 'polish.test.js', 'tactics.test.js', 'hud.test.js']);
let failed = 0, passed = 0;
for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!process.argv.includes('--quick') || quick.has(f))).sort()) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: 900000, maxBuffer: 4e6, env: { ...process.env, ...(process.argv.includes('--full') ? { AOR_FULL: '1' } : {}) } });
  const output = (result.stdout || '') + (result.stderr || '');
  const summary = output.match(/(\d+) passed, (\d+) failed/);
  const ok = !result.error && result.status === 0 && summary && Number(summary[2]) === 0;
  console.log(`${file.padEnd(28)} ${summary ? summary[0] : 'no summary'}`);
  if (ok) { passed += Number(summary[1]); continue; }
  failed++;
  if (result.error) console.error(`   ${result.error.code || 'ERROR'}: ${result.error.message}`);
  if (result.signal) console.error(`   Terminated by ${result.signal}`);
  if (result.status !== null && result.status !== 0) console.error(`   Exit status ${result.status}`);
  console.error(output || '   Test produced no output.');
}
console.log(`Total: ${passed} checks passed; ${failed} suites failed.`);
process.exitCode = failed ? 1 : 0;
