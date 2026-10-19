// Long routes on huge maps: with the size cap lifted inside the vm (the perf spec's patch: validateMapSpec with
// 'n > 256' raised to 1024), every Town Center reaches every other one on land, on coastal maps round the sea, and on
// islands with a transport: land leg to the shore, naval leg within one water body, land leg to the Town Center.
// The same routes are also asked of the old grid search (HPA.enabled = false) for comparison.
// Maps: land with 8 and 2 players and coastal with 8 and 3 (the evaluation's failed routes were coastal 3p and land
// 2p at 400), islands with 4 (with 8 players the islands generator joins every start into one landmass).
// Not part of npm test (about a minute): node tests/hpa-stress.js [size]   (default 480)
const harness = require('./engine-harness');
const n = +(process.argv[2] || 480);
let failed = 0;
console.log('| map | n | players | Town Center pairs | routes ok, hierarchy | routes ok, old search | legs (land / sea) | ms per route, hierarchy / old | build + edges ms |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [type, np] of [['land', 8], ['land', 2], ['coastal', 8], ['coastal', 3], ['islands', 4]]) {
  const { run } = harness();
  const r = JSON.parse(run(`(() => {
    // the game's own validator source with the cap raised (no outside input reaches the eval), as in maps-perf.spec.js
    validateMapSpec = eval('(' + validateMapSpec.toString().replace('n > 256', 'n > 1024') + ')');
    MAP_SIZES.stress = ${n}; HPA.enabled = true;
    const spec = generateMapSpec({ size: 'stress', seed: 1, mapType: '${type}', numPlayers: ${np} });
    let t0 = performance.now();
    createWorld(spec, { players: Array.from({ length: ${np} }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 1, fog: 'none', startRes: 'high', startAge: 2 });
    const build = performance.now() - t0;   // includes hpaWarm: both graphs and every intra edge
    const m = W.map, tcs = W.list.filter(e => e.type === 'tc').sort((a, b) => a.owner - b.owner);
    // a land tile of the Town Center's island beside open water, nearest to (tx, ty); and its water neighbour
    const shore = (tc, tx, ty) => {
      const reg = m.landReg[m.idx(tc.x + 1, tc.y + 1)]; let best = null, bd = 1e9;
      for (let y = 1; y < m.n - 1; y++) for (let x = 1; x < m.n - 1; x++) {
        const i = m.idx(x, y); if (m.landReg[i] !== reg || m.blk[i] || isWaterT(m.ter[i])) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = m.idx(x + dx, y + dy); if (isWaterT(m.ter[j]) && !m.blk[j]) { const d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = { x, y, wx: x + dx, wy: y + dy }; } break; } }
      }
      return best;
    };
    const unitAt = (type, owner, x, y) => spawnUnit(type, owner, x + 0.5, y + 0.5);
    const route = (u, rect, r, cls) => { const t = performance.now(); const res = findPath(m, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u), undefined, cls); return { ok: res.ok, ms: performance.now() - t }; };
    const out = { pairs: 0, ok: 0, okOld: 0, land: 0, sea: 0, ms: 0, msOld: 0, routes: 0, build: +build.toFixed(0), fails: [] };
    for (let a = 0; a < tcs.length; a++) for (let b = a + 1; b < tcs.length; b++) {
      const A = tcs[a], B = tcs[b], start = freeTileNear(A, false), v = spawnUnit('villager', A.owner, start.x, start.y);
      out.pairs++;
      let good = false, goodOld = false;
      for (const on of [true, false]) {
        HPA.enabled = on;
        const direct = route(v, rectOf(B), 1, 'land');
        on ? (out.ms += direct.ms, out.routes++) : (out.msOld += direct.ms);
        let ok = direct.ok;
        if (!ok && m.landReg[m.idx(A.x + 1, A.y + 1)] !== m.landReg[m.idx(B.x + 1, B.y + 1)]) {
          // islands: walk to the shore facing B, sail to the shore facing A, walk up to B
          const cb = center(B), ca = center(A), s1 = shore(A, cb.x, cb.y), s2 = shore(B, ca.x, ca.y);
          if (s1 && s2) {
            const leg1 = route(v, { x0: s1.x, y0: s1.y, x1: s1.x, y1: s1.y }, 0, 'land');
            const ship = unitAt('transport', A.owner, s1.wx, s1.wy), leg2 = route(ship, { x0: s2.wx, y0: s2.wy, x1: s2.wx, y1: s2.wy }, 0, 'naval');
            const lander = unitAt('villager', A.owner, s2.x, s2.y), leg3 = route(lander, rectOf(B), 1, 'land');
            removeEnt(ship); removeEnt(lander);
            ok = leg1.ok && leg2.ok && leg3.ok;
            if (on) { out.sea++; out.ms += leg1.ms + leg2.ms + leg3.ms; out.routes += 3; } else out.msOld += leg1.ms + leg2.ms + leg3.ms;
          }
        } else if (on) out.land++;
        if (on) good = ok; else goodOld = ok;
      }
      HPA.enabled = true; removeEnt(v);
      if (good) out.ok++; else out.fails.push(A.owner + '-' + B.owner);
      if (goodOld) out.okOld++;
    }
    out.ms = +(out.ms / out.routes).toFixed(1); out.msOld = +(out.msOld / out.routes).toFixed(1);
    return JSON.stringify(out);
  })()`));
  if (r.ok !== r.pairs) failed++;
  console.log(`| ${type} | ${n} | ${np} | ${r.pairs} | ${r.ok}/${r.pairs} | ${r.okOld}/${r.pairs} | ${r.land} / ${r.sea} | ${r.ms} / ${r.msOld} | ${r.build} |${r.fails.length ? ' failed: ' + r.fails.join(' ') : ''}`);
}
console.log(failed ? `FAIL: ${failed} map types have a Town Center pair without a route` : 'PASS: every Town Center pair has a route');
process.exit(failed ? 1 : 0);
