// Resume equals continue: a match saved at tick T and resumed in a fresh page plays on exactly as the match that was
// never saved (signature() every game second for N seconds). Group-order state is not saved (session.js), so a save
// is compared from a moment when no group member is still waiting for its join (hpaPending() is 0); a save made while
// members wait resumes with them routing on their own, and everyone still arrives.   node tests/resume.test.js
const crypto = require('crypto'), harness = require('./engine-harness');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const start = s => `(() => {
  MAP_SIZES['x' + ${s.n}] = ${s.n};
  const spec = generateMapSpec({ size: 'x${s.n}', seed: ${s.seed}, mapType: '${s.type}', numPlayers: ${s.np} }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: ${s.np} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 3) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${s.seed}, size: 'x${s.n}', mapType: '${s.type}', fog: 'normal', startRes: 'high', startAge: ${s.age}, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
})()`;
const play = (run, sec) => run(`for (let i = 0; i < ${Math.round(sec * 20)} && !W.over; i++) worldTick(0.05)`);
const sigs = (run, sec) => { const out = []; for (let s = 0; s < sec; s++) { play(run, 1); out.push(crypto.createHash('sha1').update(run('signature()')).digest('hex').slice(0, 12)); } return out; };
const stale = run => +run(`(() => { let s = 0; const b = W.map.blk; for (let i = 0; i < b.length; i++) if (b[i] && !W.ents.get(b[i])) s++; return s; })()`);
// play to T (then on to the first tick no group member waits), save; A plays N more, B loads the save in a fresh page and plays N
function trial(s, T, N) {
  const A = harness(); A.run(start(s)); play(A.run, T);
  let waited = 0; while (+A.run('hpaPending()') > 0 && waited < 40) { play(A.run, 0.05); waited++; }
  const text = A.run('W.spectate = false; const __t = MatchSave.serialize(); W.spectate = true; __t');
  const staleT = stale(A.run), sa = sigs(A.run, N), staleN = stale(A.run);
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save); W.spectate = true;');
  const sb = sigs(B.run, N), first = sa.findIndex((h, i) => h !== sb[i]);
  return { T, N, waited, chars: text.length, firstDifferentSecond: first, staleT, staleN, a: sa.slice(-2), b: sb.slice(-2) };
}
const S1 = trial({ n: 80, seed: 7, type: 'coastal', np: 3, age: 2 }, 150, 60);
ok(`80 x 80 coastal, 3 AI players: saved at ${S1.T} s and resumed, the match plays ${S1.N} s exactly as the one never saved`, S1.firstDifferentSecond === -1 && S1.staleT === 0 && S1.staleN === 0, S1);
const S2 = trial({ n: 100, seed: 11, type: 'land', np: 4, age: 1 }, 240, 60);
ok(`100 x 100 land, 4 AI players: saved at ${S2.T} s and resumed, the match plays ${S2.N} s exactly as the one never saved`, S2.firstDifferentSecond === -1 && S2.staleT === 0 && S2.staleN === 0, S2);
ok('no entity removal in these matches left a stale occupancy id (the case loading clears)', S1.staleT + S1.staleN + S2.staleT + S2.staleN === 0, { S1: [S1.staleT, S1.staleN], S2: [S2.staleT, S2.staleN] });

// ---------- a 40-knight order saved while its members wait for their join, and once they have joined ----------
const knightScene = `(() => {
  MAP_SIZES.x160 = 160;
  const spec = generateMapSpec({ size: 'x160', seed: 33, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [0, 1].map(i => ({ name: 'P' + i, civ: ['franks', 'turks'][i], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, size: 'x160', mapType: 'land', fog: 'none', startRes: 'high', startAge: 2, rules: currentRules() });
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
  const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p.x + 0.5, p.y + 0.5)); }
  globalThis.__ids = us.map(u => u.id);
  orderMove(us, b.x + 2, b.y + 8);
})()`;
const doneIn = (run, max) => +run(`(() => { let t = 0; const us = __ids.map(id => ent(id)); while (t < ${max} && us.some(u => u && u.order)) { worldTick(0.05); t += 0.05; } return us.every(u => u && !u.order) ? +t.toFixed(1) : -1; })()`);
const K = (() => {
  const A = harness(); A.run(knightScene);
  const pending = +A.run('hpaPending()'), text = A.run('MatchSave.serialize()');
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save); globalThis.__ids = W.list.filter(e => e.type === "knight").map(e => e.id);');
  const own = B.run(`(() => { worldTick(0.05); return HPA.stats.shared === 0 && __ids.every(id => ent(id).path && ent(id).path.length); })()`);
  const sa = sigs(A.run, 3), sb = sigs(B.run, 3);
  return { pending, own, differs: sa.join() !== sb.join(), a: doneIn(A.run, 200), b: doneIn(B.run, 200) };
})();
ok(`a save made while the 40 members wait for their join (${K.pending} waiting) resumes with every knight routing on its own, and all 40 still arrive (${K.a} s uninterrupted, ${K.b} s resumed)`, K.pending === 40 && K.own && K.a > 0 && K.b > 0, K);
const J = (() => {
  const A = harness(); A.run(knightScene);
  let ticks = 0; while (+A.run('hpaPending()') > 0 && ticks < 40) { play(A.run, 0.05); ticks++; }
  // a knight mid-path with its livelock mark set (u.mvAt, u.mvBest: movement.js): the mark must stay the very object u.path[u.pi]
  const marked = +A.run('(() => { const us = __ids.map(id => ent(id)).filter(u => u.path && u.pi < u.path.length); for (const u of us) { u.mvAt = u.path[u.pi]; u.mvBest = Math.hypot(u.mvAt.x - u.x, u.mvAt.y - u.y); } return us.length; })()');
  const text = A.run('MatchSave.serialize()'), sa = sigs(A.run, 30);
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save); globalThis.__ids = W.list.filter(e => e.type === "knight").map(e => e.id);');
  const mvAtShared = String(B.run('__ids.map(id => ent(id)).filter(u => u.mvAt).every(u => u.mvAt === u.path[u.pi] && Number.isFinite(u.mvBest))')) === 'true' && +B.run('__ids.filter(id => ent(id).mvAt).length') === marked;
  const sb = sigs(B.run, 30);
  return { ticks, marked, mvAtShared, firstDifferentSecond: sa.findIndex((h, i) => h !== sb[i]) };
})();
ok(`saved once every member has joined (${J.ticks} ticks after the click), the knights' march resumes exactly as the uninterrupted one for 30 s`, J.ticks > 0 && J.firstDifferentSecond === -1, J);
ok('after loading, u.mvAt is still the very object u.path[u.pi] for every marked knight (and u.mvBest finite), as in the saved match', J.marked > 0 && J.mvAtShared === true, J);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
