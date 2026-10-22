// Makes a match-save fixture for tests/save-compat.test.js from the code in this checkout.
//   node tests/make-save-fixture.js <label> [--minutes=6]
// Run it once per release (git checkout <tag> first, or use a worktree) and commit the file it writes to
// tests/fixtures/saves/<label>.json.gz. Fixtures are never regenerated: they stand for saves players already have.
// The fixture also records `replay`: the sha1 of signature() after this build loads the save, gives every slot to the
// computer and plays 30 seconds. A later build that loads the save the same way must reach the same hash.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const label = process.argv[2];
if (!label || !/^[\w.-]+$/.test(label)) throw new Error('usage: node tests/make-save-fixture.js <label> [--minutes=6]');
const minutes = Number((process.argv.find(a => a.startsWith('--minutes=')) || '=6').split('=')[1]);
const { run, warnings } = require('./engine-harness')();
const text = run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 21, mapType: 'coastal', numPlayers: 3 });
  createWorld(spec, { players: [{ name: 'Human', civ: 'turks', color: PLAYER_COLORS[0], human: true }, { name: 'AI 1', civ: 'franks', color: PLAYER_COLORS[1] }, { name: 'AI 2', civ: 'byzantines', color: PLAYER_COLORS[2] }],
    seed: 21, fog: 'normal', startRes: 'standard', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard'); // the human slot is played by an AI so the save has armies, farms and queues
  for (let i = 0; i < ${minutes} * 60 * 20; i++) worldTick(0.05);
  UI.selection = W.list.filter(e => e.kind === 'unit' && e.owner === W.humanId).slice(0, 3);
  UI.groups = { 1: UI.selection.slice(0, 2) };
  W.players[W.humanId].ai = null;
  return MatchSave.serialize();
})()`);
if (warnings.length) console.warn(warnings.join('\n'));
const replayRun = require('./engine-harness')().run;
replayRun(`var __save = ${JSON.stringify(text)};`);
const replay = crypto.createHash('sha1').update(replayRun(`(() => { MatchSave.restore(__save); for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard'); for (let i = 0; i < 600; i++) worldTick(0.05); return signature(); })()`)).digest('hex');
let commit = '';
try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim(); } catch (e) { /* not a repo */ }
const dir = path.join(__dirname, 'fixtures/saves'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, label + '.json.gz');
const wrapped = JSON.stringify({ label, commit, made: new Date().toISOString().slice(0, 10), minutes, replay, save: JSON.parse(text) });
fs.writeFileSync(file, zlib.gzipSync(wrapped, { level: 9 }));
console.log(`${path.relative(process.cwd(), file)}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB (${(text.length / 1024).toFixed(0)} KB uncompressed), commit ${commit}, replay ${replay}`);
