const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : e.name.endsWith('.js') ? [path.join(dir,e.name)] : []); }
const scripts = [...files(path.join(root,'game/js')), ...files(__dirname), path.join(root,'playwright.config.js')];
for (const file of scripts) {
  const result = spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if (result.error || result.status !== 0) { console.error(result.error || result.stderr); process.exit(1); }
}
console.log(`${scripts.length} scripts passed syntax checks.`);
