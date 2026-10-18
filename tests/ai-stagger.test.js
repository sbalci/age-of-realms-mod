// Staggered AI: each computer player's once-a-second update runs on its own tick, so 8 AIs no longer all think on
// the same tick (the 1 Hz hitch of the map evaluation, E§5.2). node tests/ai-stagger.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const S = JSON.parse(run(`(() => {
  const n = 8, spec = generateMapSpec({ size: 'medium', seed: 33, mapType: 'land', numPlayers: n });
  createWorld(spec, { players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const byTick = new Map(), perPlayer = {}; const eco = AIPlayer.prototype.economy;
  AIPlayer.prototype.economy = function (dt) { byTick.set(W.tick, (byTick.get(W.tick) || 0) + 1); perPlayer[this.id] = (perPlayer[this.id] || 0) + 1; return eco.call(this, dt); };
  for (let i = 0; i < 60 * 20; i++) worldTick(0.05);
  AIPlayer.prototype.economy = eco;
  const crowded = [...byTick.values()].filter(c => c > 1).length, most = Math.max(...byTick.values());
  return JSON.stringify({ updates: [...byTick.values()].reduce((a, b) => a + b, 0), ticksWithUpdates: byTick.size, crowded, most, perPlayer });
})()`));
ok('8 AI players over 60 game seconds: no two run their update on the same tick', S.crowded === 0, S);
ok('every AI still updates once a game second', Object.keys(S.perPlayer).length === 8 && Object.values(S.perPlayer).every(c => c >= 59 && c <= 60), S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
