// Performance budget: simulation time per tick on fixed seeds. node tests/perf.test.js [--report]
// Times are divided by a fixed JavaScript workload measured on the same machine ("cpu units"), so the budget holds
// on slower and faster computers alike. The raw milliseconds are printed for reference.
// Budgets sit about 60% above what this build measured; tighten them as the simulation gets faster.
// The plan's target is under 8 ms per tick on a mid-range laptop for an 8-player, 200-unit match.
const { performance } = require('perf_hooks');
const BUDGET = {
  econTickMean: 0.3,   // 2 AI players, small map, Castle Age start, 4 minutes: mean tick (measured 0.16 on 15 Oct 2026)
  econTickP95: 1.5,    //   95th percentile tick (0.85)
  battleTickMean: 2.4, // 120 vs 120 men-at-arms and archers on open ground: mean tick over 20 s (1.42)
  battleTickMax: 12,   //   slowest single tick (5.3–7.9; garbage collection makes it noisy)
  eightPlayerMean: 1.1, // 8 AI players on a medium map for 3 minutes: mean tick (0.62)
};
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };

// one cpu unit: the median time of a fixed mixed workload (array scans, Math, object allocation), in ms
function cpuUnit() {
  const runs = [];
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now(); let acc = 0; const arr = new Float64Array(20000);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.sin(i) * 100;
    for (let k = 0; k < 40; k++) { const objs = []; for (let i = 0; i < 2000; i++) objs.push({ x: arr[(i * 7 + k) % arr.length], y: i }); for (const o of objs) acc += Math.hypot(o.x, o.y); }
    runs.push(performance.now() - t0); if (acc === 42) console.log('');
  }
  runs.sort((a, b) => a - b); return runs[3];
}
const unit0 = cpuUnit();

const { run } = require('./engine-harness')();
run(`function __time(n, dt) { const ts = []; for (let i = 0; i < n && !W.over; i++) { const t0 = performance.now(); worldTick(dt); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b);
  return { mean: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1], n: ts.length }; }`);
const econ = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 31, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 31, fog: 'normal', startRes: 'high', startAge: 2, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard'); W.spectate = true;
  for (let i = 0; i < 600; i++) worldTick(0.05); // warm up the JIT and let the economies start
  return JSON.stringify(__time(4 * 60 * 20, 0.05)); })()`));
const battle = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 32, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 32, fog: 'none', startRes: 'high', startAge: 3, difficulty: 'standard' });
  const m = W.map, cx = m.n >> 1, cy = m.n >> 1;
  for (let y = cy - 14; y < cy + 14; y++) for (let x = cx - 24; x < cx + 24; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  for (const e of W.list.slice()) if (e.kind === 'res' && Math.abs(e.x - cx) < 26 && Math.abs(e.y - cy) < 16) removeEnt(e);
  m.computeVH(); m.computeRegions(); if (m.version !== undefined) m.version++;
  for (let k = 0; k < 120; k++) {
    const r = k % 10, c = (k / 10) | 0, type = k % 3 === 0 ? 'archer' : 'manatarms';
    const a = spawnUnit(UNITS[type] ? type : 'militia', 1, cx - 18 + r * 0.9, cy - 6 + c * 1.0), b = spawnUnit(UNITS[type] ? type : 'militia', 2, cx + 18 - r * 0.9, cy - 6 + c * 1.0);
    setOrder(a, { t: 'attackmove', x: cx + 20, y: cy }); setOrder(b, { t: 'attackmove', x: cx - 20, y: cy });
  }
  for (let i = 0; i < 40; i++) worldTick(0.05);
  return JSON.stringify(__time(20 * 20, 0.05)); })()`));
const eight = JSON.parse(run(`(() => {
  const n = 8, spec = generateMapSpec({ size: 'medium', seed: 33, mapType: 'land', numPlayers: n });
  createWorld(spec, { players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard'); W.spectate = true;
  for (let i = 0; i < 600; i++) worldTick(0.05);
  const r = __time(3 * 60 * 20, 0.05); r.units = W.list.filter(e => e.kind === 'unit' && e.owner > 0).length; return JSON.stringify(r); })()`));
// a villager standing diagonally next to its tree (1.13 tiles away, reach 1.0) used to ask for a new route every tick
const diag = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 34, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 34, fog: 'none', startRes: 'high', startAge: 1, difficulty: 'standard' });
  const m = W.map, cx = 40, cy = 40;
  for (const e of W.list.slice()) if ((e.kind === 'res' || (e.kind === 'unit' && e.owner === 0)) && Math.abs(e.x - cx) < 8 && Math.abs(e.y - cy) < 8) removeEnt(e);
  for (let y = cy - 6; y < cy + 6; y++) for (let x = cx - 6; x < cx + 6; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  m.computeVH(); m.computeRegions();
  const tree = W.list.find(e => e.kind === 'res' && e.type === 'tree'); removeEnt(tree);
  const t = spawnRes ? spawnRes('tree', cx, cy) : null;
  const u = spawnUnit('villager', 1, cx + 1.8, cy + 1.8);
  let calls = 0; const fp = findPath; findPath = function () { calls++; return fp.apply(this, arguments); };
  setOrder(u, { t: 'gather', id: t.id, rtype: 'tree' });
  for (let i = 0; i < 100; i++) worldTick(0.05);
  findPath = fp;
  return JSON.stringify({ calls, wood: +((u.carry && u.carry.amt) || 0).toFixed(2), dist: +distTo(u, t).toFixed(2) }); })()`));
ok('a villager next to its tree chops instead of asking for a route every tick', diag.calls <= 12 && diag.wood > 0, diag);
const unit = Math.min(unit0, cpuUnit()); // re-measure: take the faster, so a noisy start does not loosen the budget
const u = v => +(v / unit).toFixed(2), ms = v => +v.toFixed(2);
console.log(`cpu unit ${unit.toFixed(2)} ms (budgets below are in cpu units; raw ms in brackets)`);
ok(`economy tick mean ${u(econ.mean)} ≤ ${BUDGET.econTickMean}`, u(econ.mean) <= BUDGET.econTickMean, { ms: ms(econ.mean) });
ok(`economy tick p95 ${u(econ.p95)} ≤ ${BUDGET.econTickP95}`, u(econ.p95) <= BUDGET.econTickP95, { ms: ms(econ.p95), maxMs: ms(econ.max) });
ok(`120 v 120 battle tick mean ${u(battle.mean)} ≤ ${BUDGET.battleTickMean}`, u(battle.mean) <= BUDGET.battleTickMean, { ms: ms(battle.mean) });
ok(`120 v 120 battle slowest tick ${u(battle.max)} ≤ ${BUDGET.battleTickMax}`, u(battle.max) <= BUDGET.battleTickMax, { ms: ms(battle.max), p95Ms: ms(battle.p95) });
ok(`8 players, ${eight.units} units: tick mean ${u(eight.mean)} ≤ ${BUDGET.eightPlayerMean}`, u(eight.mean) <= BUDGET.eightPlayerMean, { ms: ms(eight.mean), p95Ms: ms(eight.p95) });
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
