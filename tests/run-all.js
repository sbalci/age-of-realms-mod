// Runs every headless suite: node tests/run-all.js
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
let bad = 0;
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  let out = '';
  try { out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 600000 }); } catch (e) { out = (e.stdout || '') + (e.stderr || ''); bad++; }
  const sum = (out.match(/\d+ passed, \d+ failed/) || ['no summary'])[0];
  if (!/ 0 failed/.test(sum)) bad++;
  console.log(`${f.padEnd(28)} ${sum}`);
  for (const l of out.split('\n')) if (l.startsWith('FAIL')) console.log('   ' + l.slice(0, 200));
}
process.exit(bad ? 1 : 0);
