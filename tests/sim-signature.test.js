// Golden simulation signatures: fixed-seed AI-vs-AI matches must replay to exactly the same state.
// The entity index (game/js/index.js) may make queries faster but must not change any outcome, so these hashes were
// first recorded on the code before the index existed and held unchanged through the index tasks; commit f012cc0
// re-recorded them for the deliberate AI stagger, phase 3 for hierarchical routes and group orders, and phase 4 for
// the movement fix (MOVE.mark: units no longer walk on the spot for good).
// Every scenario plays twice: with the game's defaults (key = the scenario) and with the hierarchy and phase 4's
// movement mark switched off (key + '@hpa-off': the routes and movement before phase 3, hashes f620967b and f3599320).
// AOR_HPA=on or AOR_HPA=off plays only that mode. A change that is meant to alter the simulation re-records them
// deliberately, and its commit says why:
//   AOR_RECORD=1 node tests/sim-signature.test.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const harness = require('./engine-harness');
const FIXTURE = path.join(__dirname, 'fixtures', 'sim-signatures.json');
const SCENARIOS = [
  { key: 'tiny-land-2p-feudal', size: 'tiny', mapType: 'land', players: 2, seed: 5, startAge: 1, minutes: 10 },
  { key: 'small-coastal-3p-castle', size: 'small', mapType: 'coastal', players: 3, seed: 7, startAge: 2, minutes: 10 },
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const MODES = process.env.AOR_HPA === 'off' ? ['off'] : process.env.AOR_HPA === 'on' ? ['on'] : ['on', 'off'];
function play(s, mode) {
  const { run, warnings } = harness();
  if (mode === 'off') run('HPA.enabled = false; MOVE.mark = false');
  run(`(() => {
    const spec = generateMapSpec({ size: '${s.size}', seed: ${s.seed}, mapType: '${s.mapType}', numPlayers: ${s.players} });
    const civs = Object.keys(CIVS);
    createWorld(spec, { players: Array.from({ length: ${s.players} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 3) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${s.seed}, fog: 'normal', startRes: 'high', startAge: ${s.startAge}, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true;
    for (let i = 0; i < ${s.minutes} * 60 * 20 && !W.over; i++) worldTick(0.05);
  })()`);
  const sig = run('signature()');
  return { hash: crypto.createHash('sha1').update(sig).digest('hex'), t: +run('W.t').toFixed(2), entities: run('W.list.length'), aiErrors: warnings.filter(w => w.startsWith('AI error')).length };
}
const record = process.env.AOR_RECORD === '1';
const golden = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : {};
const fresh = Object.assign({}, golden);   // recording one mode keeps the other mode's hashes
for (const mode of MODES) for (const s of SCENARIOS) {
  const key = mode === 'on' ? s.key : s.key + '@hpa-off', r = play(s, mode); fresh[key] = r.hash;
  if (record) { console.log(`recorded ${key} ${r.hash}`, JSON.stringify(r)); continue; }
  ok(`${key}: ${s.minutes} game minutes replay to the recorded state`, golden[key] === r.hash && r.aiErrors === 0, { expected: golden[key], got: r.hash, t: r.t, entities: r.entities, aiErrors: r.aiErrors });
}
if (record) { fs.mkdirSync(path.dirname(FIXTURE), { recursive: true }); fs.writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n'); ok('signatures recorded', true, fresh); }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
