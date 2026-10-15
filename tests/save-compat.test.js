// Save compatibility: every committed fixture in tests/fixtures/saves must load in the current build, keep playing
// without errors and save again. Make new fixtures with tests/make-save-fixture.js; never regenerate old ones.
// node tests/save-compat.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const dir = path.join(__dirname, 'fixtures/saves');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort() : [];
ok('save fixtures exist', files.length > 0, files);
for (const f of files) {
  const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString());
  const text = JSON.stringify(fx.save), name = fx.label;
  const { run, warnings } = require('./engine-harness')();
  run(`var __save = ${JSON.stringify(text)};`);
  const A = JSON.parse(run(`(() => { let err = null, d;
    try { d = MatchSave.restore(__save); } catch (e) { err = String(e.stack || e).slice(0, 400); }
    if (err) return JSON.stringify({ err });
    return JSON.stringify({ t: Math.round(W.t), ents: W.list.length, players: W.players.length - 1, sel: d.ui.selection.length,
      ais: W.players.slice(1).filter(p => p.ai).length, techs: W.players.slice(1).every(p => p.techs instanceof Set) }); })()`));
  ok(`${name}: loads`, !A.err && A.ents > 50 && A.players === 3 && A.techs && Math.abs(A.t - fx.minutes * 60) <= 1, A);
  // play on for three minutes with every slot run by the computer
  const B = JSON.parse(run(`(() => { let err = null;
    for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true;
    try { for (let i = 0; i < 3 * 60 * 20 && !W.over; i++) worldTick(0.05); } catch (e) { err = String(e.stack || e).slice(0, 400); }
    return JSON.stringify({ err, t: Math.round(W.t), ents: W.list.length }); })()`));
  ok(`${name}: plays three more minutes without errors`, !B.err && B.t >= A.t + 179, B);
  ok(`${name}: no warnings while loading or playing`, warnings.length === 0, warnings.slice(0, 3));
  // and saves again in the current format
  const C = JSON.parse(run(`(() => { try { W.spectate = false; const s = MatchSave.serialize(); MatchSave.parse(s); return JSON.stringify({ ok: true, kb: Math.round(s.length / 1024) }); } catch (e) { return JSON.stringify({ err: String(e).slice(0, 300) }); } })()`));
  ok(`${name}: saves again and the new save validates`, C.ok, C);
  // loading is deterministic: two loads played for 30 s give the same world
  const D = run(`(() => { const sig = () => { MatchSave.restore(__save); for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard'); for (let i = 0; i < 600; i++) worldTick(0.05); return signature(); };
    return sig() === sig(); })()`);
  ok(`${name}: deterministic after loading`, D === true);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
