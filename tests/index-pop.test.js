// Population and water capacity through the entity index: recalcPop (world.js) and wlCapacity (wells.js) give exactly
// the answers of the W.list scans they replaced (kept below verbatim as OLD), sampled through a 4-player AI match, and
// their cost no longer grows with the trees on the map.   node tests/index-pop.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
var OLD = {
  recalcPop() {
    for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.pop = 0; p.popCap = 0; }
    for (const e of W.list) {
      const p = W.players[e.owner]; if (!p) continue;
      if (e.kind === 'unit' && !UNITS[e.type].animal && e.type !== 'cobra' && !e.dying) p.pop++;
      if (e.kind === 'bld' && e.built && BUILDINGS[e.type].pop) p.popCap += e.type === 'tc' && p.tcPop ? p.tcPop : BUILDINGS[e.type].pop;
    }
    for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.popCap = Math.min(200, p.popCap); }
  },
  wlCapacity(p) {
    let cap = WELLM.base;
    for (const e of W.list) {
      if (e.owner !== p.id || e.kind !== 'bld' || !e.built || e.dying) continue;
      if (e.type === 'tc') cap += wlTcSupply(e); else if (e.type === 'well') cap += wlWellSupply(e);
    }
    return cap;
  },
  // recalcPop as the game runs it: wells.js wraps it and fills in the water figures
  all() { OLD.recalcPop(); for (const p of W.players.slice(1)) { p.waterCap = OLD.wlCapacity(p); p.waterDef = WELLM.enabled && p.pop > p.waterCap ? (p.pop - p.waterCap) / p.pop : 0; } },
};
`);

// ---------- 1. the same answers through a 4-player match ----------
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 13, mapType: 'land', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 3 + 2], color: PLAYER_COLORS[i], human: i === 0 })), seed: 13, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const state = () => JSON.stringify(W.players.slice(1).map(p => [p.pop, p.popCap, p.waterCap, p.waterDef]));
  let samples = 0, wrong = 0, wells = 0, maxPop = 0;
  for (let s = 0; s < 30; s++) {
    for (let i = 0; i < 400; i++) worldTick(0.05);   // 20 game seconds between samples, 10 game minutes in all
    OLD.all(); const a = state();
    recalcPop(); const b = state();
    samples++; if (a !== b) wrong++;
    for (const p of W.players.slice(1)) { if (wlCapacity(p) !== OLD.wlCapacity(p)) wrong++; maxPop = Math.max(maxPop, p.pop); }
    wells = Math.max(wells, W.list.filter(e => e.type === 'well').length);
  }
  return JSON.stringify({ samples, wrong, wells, maxPop, t: W.t });
})()`));
ok(`recalcPop and wlCapacity equal their old W.list scans (${D.samples} samples, 4 AI players, 10 game minutes)`, D.samples === 30 && D.wrong === 0 && D.maxPop > 30 && D.wells > 0, D);

// ---------- 2. the cost: owners' lists instead of every tree on a 200 map ----------
const S = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'gigantic', seed: 33, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 33, fog: 'normal', startRes: 'high', startAge: 1 });
  const time = f => { f(); const t0 = performance.now(); for (let i = 0; i < 300; i++) f(); return (performance.now() - t0) / 300; };
  const oldMs = time(OLD.all), newMs = time(recalcPop);
  return JSON.stringify({ entities: W.list.length, oldMs: +oldMs.toFixed(3), newMs: +newMs.toFixed(3), ratio: +(oldMs / newMs).toFixed(1) });
})()`));
ok(`on a 200 map with ${S.entities} entities, recalcPop costs a fraction of the old scan (${S.ratio}× less, at least 3×)`, S.ratio >= 3, S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
