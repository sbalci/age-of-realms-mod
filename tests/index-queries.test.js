// Resource and drop-site searches through the entity index give exactly the answers of the old W.list scans.
// The old functions are kept below, verbatim, as the reference. node tests/index-queries.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function oldNearestOwn(u, type, exclude) {
  let best = null, bd = 1e9;
  for (const e of W.list) if (e.kind === 'bld' && e.type === type && e.owner === u.owner && e.built && e.id !== exclude) { const d = distTo(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
function oldNearestDrop(u, res) {
  let best = null, bd = 1e9;
  for (const e of W.list) {
    if (e.kind !== 'bld' || e.owner !== u.owner || !e.built) continue;
    const bdef = BUILDINGS[e.type];
    if (!bdef.drop || !bdef.drop.includes(res)) continue;
    if (!!UNITS[u.type].naval !== (e.type === 'dock')) continue;
    const d = distTo(u, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function oldFindNearestRes(u, types, x, y, maxD = 30, filter) {
  let best = null, bd = maxD;
  for (const e of W.list) {
    if (e.kind !== 'res' || !types.includes(e.type) || e.amount <= 0 || (typeof mineAccessible === 'function' && !mineAccessible(e))) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) + e.gatherers * 0.7;
    if (d < bd) {
      if (!UNITS[u.type].naval && W.map.landReg[W.map.idx(u.x | 0, u.y | 0)] && !adjReachable(u, e)) continue;
      bd = d; best = e;
    }
  }
  return best;
}
function oldBuiltCount(p, type) { let c = 0; for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) c++; return c; }
function oldHasBuilt(p, type) { for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) return true; return false; }
`);
const SEEDS = [[1, 'land', 'small'], [2, 'coastal', 'small'], [3, 'rivers', 'medium']];
const total = { res: 0, resHit: 0, drop: 0, own: 0, built: 0, same: { res: 0, drop: 0, own: 0, built: 0 } };
for (const [seed, mapType, size] of SEEDS) {
  const r = JSON.parse(run(`(() => {
    const spec = generateMapSpec({ size: '${size}', seed: ${seed}, mapType: '${mapType}', numPlayers: 3 });
    createWorld(spec, { players: Array.from({ length: 3 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i + ${seed}], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${seed}, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true;
    for (let i = 0; i < 4 * 60 * 20; i++) worldTick(0.05);   // drop sites built, gatherers spread, carcasses and fish in play
    const rnd = mulberry32(${seed} * 101), pick = a => a[(rnd() * a.length) | 0];
    const units = W.list.filter(e => e.kind === 'unit' && !e.dying);
    const kinds = ['tree', 'gold', 'stone', 'berry', 'fish', 'carcass', 'coal'], drops = ['food', 'wood', 'gold', 'stone', 'coal', 'fish'];
    const filters = [null, e => e.id % 3 !== 0, e => e.amount > 50];
    const btypes = Object.keys(BUILDINGS), owned = W.list.filter(e => e.kind === 'bld');
    const out = { res: 0, resHit: 0, drop: 0, own: 0, built: 0, same: { res: 0, drop: 0, own: 0, built: 0 }, misses: [] };
    for (let q = 0; q < 167; q++) {
      const u = rnd() < 0.2 ? { x: rnd() * W.n, y: rnd() * W.n, type: 'villager' } : pick(units);
      const types = kinds.filter(() => rnd() < 0.4); if (!types.length) types.push(pick(kinds));
      const near = rnd() < 0.7, x = near ? u.x + (rnd() - 0.5) * 20 : rnd() * W.n, y = near ? u.y + (rnd() - 0.5) * 20 : rnd() * W.n;
      const maxD = pick([10, 20, 25, 30, 40, 60]), f = pick(filters);
      const a = findNearestRes(u, types, x, y, maxD, f), b = oldFindNearestRes(u, types, x, y, maxD, f);
      out.res++; if (b) out.resHit++; if (a === b) out.same.res++; else if (out.misses.length < 3) out.misses.push({ q, types, maxD, got: a && a.id, want: b && b.id });
      const v = pick(units), res = pick(drops);
      out.drop++; if (nearestDrop(v, res) === oldNearestDrop(v, res)) out.same.drop++;
      const t = pick(btypes), ex = rnd() < 0.5 && owned.length ? pick(owned).id : undefined;
      out.own++; if (nearestOwn(v, t, ex) === oldNearestOwn(v, t, ex)) out.same.own++;
      const p = W.players[1 + ((rnd() * 3) | 0)];
      out.built++; if (builtCount(p, t) === oldBuiltCount(p, t) && hasBuilt(p, t) === oldHasBuilt(p, t)) out.same.built++;
    }
    return JSON.stringify(out);
  })()`));
  for (const k of ['res', 'resHit', 'drop', 'own', 'built']) total[k] += r[k];
  for (const k in r.same) total.same[k] += r.same[k];
  if (r.misses.length) console.log('misses', seed, JSON.stringify(r.misses));
}
ok(`findNearestRes equals the old scan on ${total.res} random queries over 3 seeds (${total.resHit} found something)`, total.same.res === total.res && total.res >= 500, total);
ok(`nearestDrop and nearestOwn equal the old scans on ${total.drop} queries each`, total.same.drop === total.drop && total.same.own === total.own, total);
ok(`builtCount and hasBuilt equal the old scans on ${total.built} queries`, total.same.built === total.built, total);

// ---------- speed on a 200 map ----------
const S = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'gigantic', seed: 4, mapType: 'land', numPlayers: 3 });
  createWorld(spec, { players: Array.from({ length: 3 }, (_, i) => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 4, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  const vs = W.list.filter(e => e.type === 'villager');
  const time = fn => { for (let i = 0; i < 200; i++) fn(i); const t0 = performance.now(); for (let i = 0; i < 2000; i++) fn(i); return (performance.now() - t0) / 2000; };
  const fresh = time(i => { const v = vs[i % vs.length]; findNearestRes(v, ['tree'], v.x, v.y, 30); });
  const old = time(i => { const v = vs[i % vs.length]; oldFindNearestRes(v, ['tree'], v.x, v.y, 30); });
  return JSON.stringify({ n: W.n, entities: W.list.length, msNew: +fresh.toFixed(4), msOld: +old.toFixed(4) });
})()`));
// The vm harness inflates times about 17× against the browser (the old scan: ~5 ms here, 0.28–0.30 ms in the browser,
// E§3 T4), so this checks the speed-up; the perf spec records the browser figure (budget 50 µs at 200).
ok(`findNearestRes on a 200 map: ${S.msNew} ms against ${S.msOld} ms for the old scan in the vm (at least 20× faster)`, S.msNew * 20 <= S.msOld, S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
