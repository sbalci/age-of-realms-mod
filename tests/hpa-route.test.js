// Hierarchical routes behind findPath (game/js/hpa.js, HPA.enabled): as short as the optimal grid A*, valid step by
// step, the old answer for near goals, a best effort at least as close as the old one for unreachable goals, and the
// unit's own rule on gates, trenches, water, bridges and tunnels.   node tests/hpa-route.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type) {
  const spec = generateMapSpec({ size, seed, mapType: type, numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed, fog: 'none', startRes: 'high', startAge: 2 });
}
const pathLen = (sx, sy, pts) => { let L = 0, px = sx + 0.5, py = sy + 0.5; for (const p of pts) { L += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; } return L; };
// findPath's guarantee for its waypoints, leg by leg from the start tile: a leg is one step by the grid search's own
// rule (target passable and climbable, and on a diagonal both side tiles passable) or a straight line that passes
// lineClear (smoothing's test). Either way no step squeezes between two blocked corners.
function stepOk(a, b, pass) { const n = W.n, ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0; return pass(b) && W.map.canStep(ax, ay, bx, by) && (ax === bx || ay === by || (pass(ay * n + bx) && pass(by * n + ax))); }
function legsClear(sx, sy, pts, pass) {
  const n = W.n; let a = sy * n + sx;
  for (const p of pts) { const b = (p.y | 0) * n + (p.x | 0), one = Math.max(Math.abs(b % n - a % n), Math.abs(((b / n) | 0) - ((a / n) | 0))) === 1; if (!(one && stepOk(a, b, pass)) && !lineClear(W.map, a, b, pass)) return false; a = b; }
  return true;
}
// Stricter than the game asks: walk each leg in 0.05-tile steps and count points on tiles the unit may not stand on.
function strictBad(sx, sy, pts, pass) { let bad = 0, px = sx + 0.5, py = sy + 0.5; for (const p of pts) { const k = Math.ceil(Math.hypot(p.x - px, p.y - py) / 0.05); for (let s = 1; s <= k; s++) { const x = px + (p.x - px) * s / k, y = py + (p.y - py) * s / k; if (!pass(W.map.idx(x | 0, y | 0))) bad++; } px = p.x; py = p.y; } return bad; }
const hGoal = (g, x, y) => { const dx = Math.max(g.x0 - x, 0, x - g.x1), dy = Math.max(g.y0 - y, 0, y - g.y1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
`);

// ---------- 1. 500 random pairs: at most 1.1× the optimal grid A*, every leg valid ----------
const Q = JSON.parse(run(`(() => {
  const out = { pairs: 0, worst: 0, sum: 0, invalid: 0, refInvalid: 0, notOk: 0, strictNew: 0, strictOld: 0, msOld: 0, msNew: 0, routed0: HPA.stats.routed };
  for (const type of ['land', 'coastal', 'islands', 'rivers', 'alpine']) {
    HPA.enabled = true; world('gigantic', 11, type);
    const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(7);
    const tile = () => { for (;;) { const x = (rnd() * n) | 0, y = (rnd() * n) | 0; if (pass(m.idx(x, y))) return { x, y }; } };
    let got = 0;
    while (got < 100) {
      const a = tile(), b = tile(), goal = { x0: b.x, y0: b.y, x1: b.x, y1: b.y, r: 0 };
      HPA.enabled = false; let t0 = performance.now(); const ref = findPath(m, a.x, a.y, goal, pass, n * n); out.msOld += performance.now() - t0;   // the optimal grid A*: no node budget
      if (!ref.ok) continue;
      HPA.enabled = true; t0 = performance.now(); const r = findPath(m, a.x, a.y, goal, pass, undefined, 'land'); out.msNew += performance.now() - t0;
      got++; out.pairs++;
      if (!r.ok) { out.notOk++; continue; }
      const q = pathLen(a.x, a.y, r.pts) / Math.max(1e-9, pathLen(a.x, a.y, ref.pts)); out.worst = Math.max(out.worst, q); out.sum += q;
      const last = r.pts[r.pts.length - 1];
      if (!legsClear(a.x, a.y, r.pts, pass) || (r.pts.length && ((last.x | 0) !== b.x || (last.y | 0) !== b.y))) out.invalid++;
      if (!legsClear(a.x, a.y, ref.pts, pass)) out.refInvalid++;
      out.strictNew += strictBad(a.x, a.y, r.pts, pass); out.strictOld += strictBad(a.x, a.y, ref.pts, pass);
    }
  }
  out.mean = +(out.sum / (out.pairs - out.notOk)).toFixed(4); out.worst = +out.worst.toFixed(3); out.routed = HPA.stats.routed - out.routed0;
  out.msOld = +(out.msOld / out.pairs).toFixed(1); out.msNew = +(out.msNew / out.pairs).toFixed(1); delete out.sum; delete out.routed0;
  return JSON.stringify(out);
})()`));
ok(`500 random pairs on 200 maps of 5 types: every route found, at most 1.1× the optimal grid A* (worst ${Q.worst}, mean ${Q.mean})`, Q.pairs === 500 && Q.notOk === 0 && Q.worst <= 1.1 && Q.routed > 300, Q);
ok('every leg is one valid grid step or passes lineClear (passable, climbable, no corner squeeze), and every route ends on its goal, as the old routes do', Q.invalid === 0 && Q.refInvalid === 0, Q);

// ---------- 2. near goals: exactly the old answer ----------
const N = JSON.parse(run(`(() => {
  HPA.enabled = true; world('gigantic', 5, 'land');
  const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(3); let near = 0, same = 0, total = 0;
  for (let k = 0; k < 300; k++) {
    const x = (rnd() * n) | 0, y = (rnd() * n) | 0; if (!pass(m.idx(x, y))) continue;
    const gx = Math.max(0, Math.min(n - 1, x + ((rnd() * 41) | 0) - 20)), gy = Math.max(0, Math.min(n - 1, y + ((rnd() * 41) | 0) - 20)), goal = { x0: gx, y0: gy, x1: gx, y1: gy, r: (rnd() * 3) | 0 };
    HPA.enabled = false; const a = findPath(m, x, y, goal, pass);
    HPA.enabled = true; const n0 = HPA.stats.near, b = findPath(m, x, y, goal, pass, undefined, 'land');
    total++; if (HPA.stats.near > n0) { near++; if (JSON.stringify(a) === JSON.stringify(b)) same++; }
  }
  return JSON.stringify({ total, near, same });
})()`));
ok('goals within 24 tiles: whenever the bounded plain search finishes (most of them), its answer is exactly the old findPath answer', N.total > 180 && N.near >= N.total * 0.7 && N.same === N.near, N);

// ---------- 3. unreachable goals: a best effort at least as close, at a fraction of the cost ----------
const U = JSON.parse(run(`(() => {
  const out = { cases: 0, perType: {}, closer: 0, farther: 0, emptyBoth: 0, emptyLost: 0, deadEnd: 0, msOld: 0, msNew: 0, unreachable0: HPA.stats.unreachable };
  for (const [type, seed] of [['islands', 4], ['coastal', 6], ['rivers', 8]]) {
    HPA.enabled = true; world('gigantic', seed, type);
    const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(seed), c0 = out.cases;
    for (let k = 0; out.cases - c0 < 40 && k < 5000; k++) {
      const x = (rnd() * n) | 0, y = (rnd() * n) | 0, gx = (rnd() * n) | 0, gy = (rnd() * n) | 0;
      if (!pass(m.idx(x, y)) || !isWaterT(m.ter[m.idx(gx, gy)])) continue;   // a land unit sent onto the water
      const goal = { x0: gx, y0: gy, x1: gx, y1: gy, r: 0 };
      HPA.enabled = false; let t0 = performance.now(); const a = findPath(m, x, y, goal, pass); out.msOld += performance.now() - t0;
      HPA.enabled = true; t0 = performance.now(); const b = findPath(m, x, y, goal, pass, undefined, 'land'); out.msNew += performance.now() - t0;
      if (a.ok || b.ok) continue;
      out.cases++;
      const end = (r) => r.pts.length ? r.pts[r.pts.length - 1] : { x: x + 0.5, y: y + 0.5 };
      const ha = hGoal(goal, end(a).x | 0, end(a).y | 0), hb = hGoal(goal, end(b).x | 0, end(b).y | 0);
      if (hb <= ha + 1e-9) out.closer++; else out.farther++;
      if (!a.pts.length && !b.pts.length) out.emptyBoth++; else if (!b.pts.length) out.emptyLost++;
      // the end is a dead end: sent again from there, the old search and the new one both stay put (empty route, ok
      // false), the case gather, build, attack and trade count as a give-up
      const ex = end(b).x | 0, ey = end(b).y | 0;
      HPA.enabled = false; const a2 = findPath(m, ex, ey, goal, pass);
      HPA.enabled = true; const b2 = findPath(m, ex, ey, goal, pass, undefined, 'land');
      if (!a2.ok && !b2.ok && !a2.pts.length && !b2.pts.length) out.deadEnd++;
    }
    out.perType[type] = out.cases - c0;
  }
  out.msOld = +(out.msOld / out.cases).toFixed(1); out.msNew = +(out.msNew / out.cases).toFixed(1); out.unreachable = HPA.stats.unreachable - out.unreachable0; delete out.unreachable0;
  return JSON.stringify(out);
})()`));
ok('unreachable goals: ok stays false, the route ends at least as close to the goal as the old best effort and never comes back empty where the old one moved, and from its end both searches return an empty route (the give-up callers see)', U.cases === 120 && U.farther === 0 && U.emptyLost === 0 && U.deadEnd === U.cases && U.unreachable >= U.cases * 0.9, U);
ok(`unreachable goals are answered without the old full-budget search (${U.msNew} ms against ${U.msOld} ms in the vm)`, U.msNew * 3 < U.msOld, U);

// ---------- 4. the unit's own rule: gates, trenches, water, bridges, tunnels ----------
const R = JSON.parse(run(`(() => {
  HPA.enabled = true; world('huge', 3, 'land');
  const m = W.map, n = m.n, P1 = W.players[1], P2 = W.players[2]; P1.res.wood = P1.res.stone = 1e6;
  // a flat grass strip 60 × 20, far from both bases
  let best = null; for (let y = 4; y + 20 < n - 4 && !best; y += 4) for (let x = 4; x + 60 < n - 4; x += 4) { const tcs = W.list.filter(e => e.type === 'tc'); if (tcs.every(t => Math.hypot(t.x - x - 30, t.y - y - 10) > 40)) { best = { x, y }; break; } }
  for (const e of W.list.slice()) if (e.kind !== 'unit' && e.x >= best.x - 2 && e.x < best.x + 62 && e.y >= best.y - 2 && e.y < best.y + 22) removeEnt(e);
  for (let y = best.y; y < best.y + 20; y++) for (let x = best.x; x < best.x + 60; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  m.computeVH(); m.computeRegions();
  const X = best.x, Y = best.y, out = {};
  const route = (u, gx, gy) => { u.path = null; pathTo(u, { x0: gx, y0: gy, x1: gx, y1: gy }, 0); return { ok: u.pathOk, pts: u.path }; };
  // a closed wall ring of player 1 round (X + 50, Y + 10), with one gate on its west side
  const ring = [];
  for (let y = Y + 6; y <= Y + 14; y++) for (let x = X + 46; x <= X + 54; x++) if (Math.max(Math.abs(x - X - 50), Math.abs(y - Y - 10)) === 4) ring.push(spawnBuilding(x === X + 46 && y === Y + 10 ? 'gate' : 'wall', 1, x, y, true));
  const v1 = spawnUnit('villager', 1, X + 5.5, Y + 10.5), v2 = spawnUnit('villager', 2, X + 5.5, Y + 12.5);
  let s0 = Object.assign({}, HPA.stats); const own = route(v1, X + 50, Y + 10);
  out.ownGate = own.ok && HPA.stats.routed === s0.routed + 1;
  s0 = Object.assign({}, HPA.stats); const foe = route(v2, X + 50, Y + 10);
  HPA.enabled = false; const old = route(v2, X + 50, Y + 10); HPA.enabled = true;
  out.foeGate = !foe.ok && JSON.stringify(foe.pts) === JSON.stringify(old.pts) && HPA.stats.fallback === s0.fallback + 1;
  for (const b of ring) removeEnt(b);
  // a trench across the strip with a 3-tile gap: a knight goes round through the gap, a villager walks straight
  for (let y = Y; y < Y + 20; y++) if (y < Y + 15 || y > Y + 17) terraApply('trench', X + 40, y, P1);
  terraFlush();
  const kn = spawnUnit('knight', 1, X + 35.5, Y + 2.5), vi = spawnUnit('villager', 1, X + 35.5, Y + 2.5);
  const kr = route(kn, X + 50, Y + 2), vr = route(vi, X + 50, Y + 2);
  out.trench = kr.ok && legsClear(X + 35, Y + 2, kr.pts, unitPass(kn)) && kr.pts.some(p => p.y > Y + 14) && vr.ok && vr.pts.every(p => p.y < Y + 8) && hpaClassOf(kn) === 'mounted' && hpaClassOf(vi) === 'land';
  // a knight standing ON a trench tile (the mounted graph marks it impassable), sent to a reachable goal off the trench:
  // a valid route for its own rule, or exactly the old search's answer
  const kt = spawnUnit('knight', 1, X + 40.5, Y + 5.5), s1 = Object.assign({}, HPA.stats), kt1 = route(kt, X + 50, Y + 2);
  HPA.enabled = false; const kt0 = route(kt, X + 50, Y + 2); HPA.enabled = true;
  out.trenchStart = { ok: kt1.ok, valid: legsClear(X + 40, Y + 5, kt1.pts, unitPass(kt)), sameAsOld: JSON.stringify(kt1) === JSON.stringify(kt0), fallback: HPA.stats.fallback - s1.fallback, n: kt1.pts.length };
  out.trenchStartOk = (kt1.ok && out.trenchStart.valid) || out.trenchStart.sameAsOld;
  // the same knight to a goal 37 tiles away (past the near-goal range, so the hierarchy is asked)
  const s2 = Object.assign({}, HPA.stats), kf1 = route(kt, X + 3, Y + 5);
  HPA.enabled = false; const kf0 = route(kt, X + 3, Y + 5); HPA.enabled = true;
  out.trenchStartFar = { ok: kf1.ok, valid: legsClear(X + 40, Y + 5, kf1.pts, unitPass(kt)), sameAsOld: JSON.stringify(kf1) === JSON.stringify(kf0), routed: HPA.stats.routed - s2.routed, fallback: HPA.stats.fallback - s2.fallback, n: kf1.pts.length };
  out.trenchStartOk = out.trenchStartOk && ((kf1.ok && out.trenchStartFar.valid) || out.trenchStartFar.sameAsOld);
  // a 3-wide river across the strip: no way over, then a bridge, then the bridge removed
  for (let y = Y - 3; y < Y + 23; y++) for (let x = X + 48; x < X + 51; x++) { const i = m.idx(x, y); m.ter[i] = T.WATER; m.elev[i] = 0; }
  for (let y = 0; y < n; y++) for (let x = X + 48; x < X + 51; x++) { const i = m.idx(x, y); if (!m.blk[i]) { m.ter[i] = T.WATER; m.elev[i] = 0; } }
  m.computeVH(); m.computeRegions();
  const vb = spawnUnit('villager', 1, X + 44.5, Y + 5.5);
  out.noBridge = !route(vb, X + 56, Y + 5).ok;
  for (let x = X + 48; x < X + 51; x++) terraApply('bridge', x, Y + 5, P1, new Set([m.idx(X + 48, Y + 5), m.idx(X + 49, Y + 5), m.idx(X + 50, Y + 5)]));
  terraFlush();
  const br = route(vb, X + 56, Y + 5); out.bridge = br.ok && legsClear(X + 44, Y + 5, br.pts, unitPass(vb));
  // a ship sails under the bridge, along the river
  const ship = spawnUnit('galley', 1, X + 49.5, Y + 1.5), sr = route(ship, X + 49, Y + 15);
  out.ship = sr.ok && legsClear(X + 49, Y + 1, sr.pts, unitPass(ship)) && hpaClassOf(ship) === 'naval';
  // a tunnel through a 3-level ridge
  for (let y = Y; y < Y + 20; y++) for (let x = X + 10; x < X + 13; x++) m.elev[m.idx(x, y)] = 3;
  for (let y = Y - 4; y < Y + 24; y++) for (let x = X + 10; x < X + 13; x++) if (m.inb(x, y)) m.elev[m.idx(x, y)] = 3;
  m.computeVH(); m.computeRegions();
  const vt = spawnUnit('villager', 1, X + 7.5, Y + 8.5), ridge = route(vt, X + 16, Y + 8);
  for (let x = X + 10; x < X + 13; x++) terraApply('tunnel', x, Y + 8, P1);
  terraFlush();
  const tun = route(vt, X + 16, Y + 8);
  out.tunnel = tun.ok && legsClear(X + 7, Y + 8, tun.pts, unitPass(vt)) && pathLen(X + 7, Y + 8, tun.pts) < 10 && (!ridge.ok || pathLen(X + 7, Y + 8, ridge.pts) > 12);
  out.stats = HPA.stats;
  return JSON.stringify(out);
})()`));
ok('own gate: routed through by the hierarchy; enemy at the same gate: the old search answers (fallback)', R.ownGate && R.foeGate, R);
ok('trench: a knight (mounted class) goes round through the gap, a villager walks straight over', R.trench, R);
ok("trench start: a knight standing on a trench tile still gets a valid route off it, or the old search's answer", R.trenchStartOk, [R.trenchStart, R.trenchStartFar]);
ok('a river blocks the route until a bridge is built; a ship sails along the river under it', R.noBridge && R.bridge && R.ship, R);
ok('a tunnel through a ridge gives the short route', R.tunnel, R);

// ---------- 5. a new match builds the graphs and their edges up front ----------
const M = JSON.parse(run(`(() => {
  HPA.enabled = true; world('gigantic', 21, 'coastal');
  let cold = 0; const row = hpaRow; hpaRow = function (G, k, a) { if (!G.cl[k].row[a]) cold++; return row(G, k, a); };
  const m = W.map, tcs = W.list.filter(e => e.type === 'tc'), v = W.list.find(e => e.type === 'villager' && e.owner === 1), far = tcs.find(t => t.owner === 2);
  const r = findPath(m, v.x | 0, v.y | 0, { x0: far.x, y0: far.y, x1: far.x + 3, y1: far.y + 3, r: 1 }, unitPass(v), undefined, 'land');
  hpaRow = row;
  W.settings.editor = true; HPA.map = null; HPA.g = {}; hpaWarm(); const editorBuilt = !!HPA.g.land;
  return JSON.stringify({ ok: r.ok, cold, editorBuilt });
})()`));
ok('createWorld builds the land and naval graphs with every intra edge, so the first cross-map route computes none (editor worlds are skipped)', M.ok && M.cold === 0 && !M.editorBuilt, M);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
