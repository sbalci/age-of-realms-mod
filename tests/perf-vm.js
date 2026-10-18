// Simulation cost in the node vm harness, before and after the entity index: the same match is played with every
// index query answered by a W.list scan (IDX.brute, the cost of the old scans) and with the index.
// 8 AI players on land, seed 33, Feudal start, high resources; 600 warm-up ticks, then 1200 timed ticks.
// Not part of npm test (it takes about two minutes): node tests/perf-vm.js [sizes]   (default 200,256)
const harness = require('./engine-harness');
const sizes = (process.argv[2] || '200,256').split(',').map(Number);
function play(n, brute) {
  const { run } = harness();
  return JSON.parse(run(`(() => {
    const spec = generateMapSpec({ size: ${n}, seed: 33, mapType: 'land', numPlayers: 8 });
    createWorld(spec, { players: Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true; IDX.brute = ${brute};
    let ai = 0; const up = AIPlayer.prototype.update;
    AIPlayer.prototype.update = function (dt) { const t0 = performance.now(); try { return up.call(this, dt); } finally { ai += performance.now() - t0; } };
    for (let i = 0; i < 600; i++) worldTick(0.05);
    ai = 0; const ts = [];
    for (let i = 0; i < 1200; i++) { const t0 = performance.now(); worldTick(0.05); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    return JSON.stringify({ mean: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(2), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(1), ai: +(ai / 1200).toFixed(2), entities: W.list.length });
  })()`));
}
console.log('| n | vm tick mean / p99 ms, W.list scans | vm tick mean / p99 ms, index | vm AI ms per tick, scans → index |');
console.log('| --- | --- | --- | --- |');
for (const n of sizes) {
  const a = play(n, true), b = play(n, false);
  console.log(`| ${n} | ${a.mean} / ${a.p99} | ${b.mean} / ${b.p99} | ${a.ai} → ${b.ai} |`);
}
