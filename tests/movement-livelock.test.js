// The movement livelock (game/js/movement.js): a unit whose straight leg to its next waypoint crosses a cliff corner
// is refused the step, drifts back to its tile centre, steps forward again, and so on. The forward tick counted as
// progress, so the stuck time went +dt, -dt, +dt and never reached MOVE.repathAfter: no repath, no rescue, the unit
// walked on the spot for good. Seen first as 2 spearmen jittering in the 10-spearman group order with HPA.joinReach
// 24-44 (tests/hpa-group.test.js part 2), but it is not a group-route problem: single units with their own paths, the
// hierarchy on or off, hit it on about 2% of moves on cliffy maps.   node tests/movement-livelock.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type, np) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: 'x' + size, seed, mapType: type, numPlayers: np });
  createWorld(spec, { players: Array.from({ length: np }, (_, i) => ({ name: 'P' + i, civ: ['franks', 'turks', 'britons'][i % 3], color: PLAYER_COLORS[i], human: i === 0 })), seed, fog: 'none', startRes: 'high', startAge: 2 });
}`);

// ---------- 1. the smallest case: one spearman, one straight leg past a cliff corner ----------
// Seed 7 at 160 x 160: tile (116, 62) is at elevation 1 and (116, 63) at 3, a cliff; the leg from (117.5, 61.5) to
// (116.5, 64.5) runs exactly through the corner of those tiles. lineClear's sampled line goes round the corner, so a
// path may hold this leg (a shared route did); the unit itself slides into (116, 62) and faces the cliff.
const M = JSON.parse(run(`(() => {
  world(160, 7, 'land', 2);
  const res = [];
  for (const [sx, sy] of [[117.5, 61.5], [116.5, 62.5], [117.5, 62.5]]) {
    const u = spawnUnit('spearman', 1, sx, sy);
    u.order = { t: 'move', x: 116.5, y: 64.5 }; u.path = [{ x: 116.5, y: 64.5 }]; u.pi = 0; u.pathOk = true;
    u.goalRect = { x0: 116, y0: 64, x1: 116, y1: 64 }; u.goalR = 0; u.dest = { x: 116.5, y: 64.5 };
    let t = 0, repaths = 0; const pt = pathTo; pathTo = function (v) { if (v === u) repaths++; return pt.apply(this, arguments); };
    try { while (t < 30 && u.order) { worldTick(0.05); t += 0.05; } } finally { pathTo = pt; }
    res.push({ from: [sx, sy], arrived: !u.order, t: +t.toFixed(2), at: [+u.x.toFixed(3), +u.y.toFixed(3)], repaths });
    removeEnt(u);
  }
  return JSON.stringify({ elev: [W.map.elev[W.map.idx(116, 62)], W.map.elev[W.map.idx(116, 63)], W.map.elev[W.map.idx(117, 63)]], res });
})()`));
ok(`a spearman whose leg passes a cliff corner repaths and arrives within 5 game seconds, from all three starts (elevations ${M.elev.join(' / ')})`,
  M.elev[1] - M.elev[0] >= 2 && M.res.every(r => r.arrived && r.t < 5) && M.res[0].repaths >= 1 && M.res[1].repaths >= 1, M);

// ---------- 2. the group order that found it: 10 spearmen and a straggler, HPA.joinReach 24-44 ----------
const G = JSON.parse(run(`(() => {
  const out = [], reach0 = HPA.joinReach;
  for (const R of [24, 28, 32, 36, 40, 44]) {
    HPA.joinReach = R; world(160, 7, 'land', 2);
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
    const us = []; for (let k = 0; k < 10; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
    const p = nearestLandTile((a.x - 30) | 0, (a.y + 20) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5));
    orderMove(us, b.x + 2, b.y + 7);
    let t = 0; while (t < 300 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
    out.push({ R, left: us.filter(u => u.order).length, t: +t.toFixed(0) });
  }
  HPA.joinReach = reach0;
  return JSON.stringify(out);
})()`));
ok(`with HPA.joinReach 24, 28, 32, 36, 40 and 44, all 11 spearmen of the group order arrive within 300 game seconds (left over: ${G.map(g => g.left).join(', ')})`, G.every(g => g.left === 0), G);

// ---------- 3. single units with their own paths, the hierarchy on and off: none walks on the spot ----------
// 60 random moves of 8-38 tiles on two cliffy 160 maps where 91c0970 left 2 units each walking on the spot for good.
const S = JSON.parse(run(`(() => {
  const out = [];
  for (const [type, seed] of [['land', 3], ['alpine', 2]]) for (const on of [true, false]) {
    HPA.enabled = on; world(160, seed, type, 2);
    for (const p of W.players.slice(1)) p.stance = p.stance.map(() => 'ally');
    const m = W.map, n = m.n, rnd = mulberry32(seed * 77), pass = passLand(1), us = [];
    for (let tries = 0; us.length < 60 && tries < 5000; tries++) {
      const x = 4 + ((rnd() * (n - 8)) | 0), y = 4 + ((rnd() * (n - 8)) | 0); if (!pass(m.idx(x, y))) continue;
      const ang = rnd() * 6.283, d = 8 + rnd() * 30, tx = Math.round(x + Math.cos(ang) * d), ty = Math.round(y + Math.sin(ang) * d);
      if (!m.inb(tx, ty) || !pass(m.idx(tx, ty)) || !findPath(m, x, y, { x0: tx, y0: ty, x1: tx, y1: ty, r: 0 }, pass).ok) continue;
      const u = spawnUnit(rnd() < 0.5 ? 'spearman' : 'knight', 1, x + 0.5, y + 0.5); setOrder(u, { t: 'move', x: tx + 0.5, y: ty + 0.5 }); us.push(u);
    }
    const reps = new Map(), pt = pathTo; pathTo = function (v) { reps.set(v, (reps.get(v) || 0) + 1); return pt.apply(this, arguments); };
    let left, locked;
    try {
      let t = 0; while (t < 60 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
      // a unit still under way that stays within 0.3 tiles and asks for no new path over the next 5 game seconds is stuck for good
      left = us.filter(u => u.order); const at = new Map(left.map(u => [u, { x: u.x, y: u.y, r: reps.get(u) || 0, span: 0 }]));
      for (let k = 0; k < 100; k++) { worldTick(0.05); for (const u of left) { const a = at.get(u); a.span = Math.max(a.span, Math.hypot(u.x - a.x, u.y - a.y)); } }
      locked = left.filter(u => u.order && at.get(u).span < 0.3 && (reps.get(u) || 0) === at.get(u).r).length;
    } finally { pathTo = pt; }
    out.push({ type, seed, hpa: on, moves: us.length, under: left.length, locked });
  }
  HPA.enabled = true;
  return JSON.stringify(out);
})()`));
ok(`240 single-unit moves on two cliffy maps, the hierarchy on and off: no unit walks on the spot without asking for a new path (stuck: ${S.map(s => s.locked).join(', ')})`, S.every(s => s.moves === 60 && s.locked === 0), S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
