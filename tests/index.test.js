// Entity index (game/js/index.js): the buckets and owner lists must always equal a brute-force scan of W.list.
// node tests/index.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
// Compares every bucket, category list and owner list with what a scan of W.list says they should hold.
function idxCheck() {
  idxSync();
  const bad = [];
  for (let i = 1; i < W.list.length; i++) if (W.list[i - 1].id >= W.list[i].id) { bad.push('W.list not in id order at ' + i); break; }
  const want = new Map(), wantAll = new Map(), wantOwned = new Map();
  const push = (m, k, e) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(e); };
  for (const e of W.list) {
    const cat = idxCat(e);
    let cells = want.get(cat); if (!cells) want.set(cat, cells = new Map());
    push(cells, idxCellOf(e.x, e.y), e); push(wantAll, cat, e);
    if (e.kind === 'unit' || e.kind === 'bld') { push(wantOwned, e.owner + ':' + e.kind, e); push(wantOwned, e.owner + ':all', e); }
    if (e.kind === 'bld') push(wantOwned, e.owner + ':type:' + e.type, e);
  }
  const same = (a, b) => a.length === b.length && a.every((e, i) => e === b[i]);
  for (const cat of new Set([...want.keys(), ...IDX.cells.keys()])) {
    const arr = IDX.cells.get(cat) || [], cells = want.get(cat) || new Map();
    for (let i = 0; i < IDX.cw * IDX.cw; i++) {
      const got = arr[i] ? [...arr[i]].sort((a, b) => a.id - b.id) : [];
      if (!same(got, cells.get(i) || [])) bad.push(cat + ' cell ' + i + ': ' + got.length + ' filed, ' + (cells.get(i) || []).length + ' expected');
    }
    if (!same([...(IDX.all.get(cat) || [])], wantAll.get(cat) || [])) bad.push(cat + ': category list differs');
  }
  for (let o = 0; o < W.players.length; o++) {
    for (const k of ['unit', 'bld', 'all']) if (!same(idxOwned(o, k), wantOwned.get(o + ':' + k) || [])) bad.push('owner ' + o + ' ' + k + ' list differs');
    const r = IDX.owned[o], types = new Set(r ? r.types.keys() : []);
    for (const k of wantOwned.keys()) if (k.startsWith(o + ':type:')) types.add(k.slice((o + ':type:').length));
    for (const t of types) if (!same((r && r.types.get(t)) || [], wantOwned.get(o + ':type:' + t) || [])) bad.push('owner ' + o + ' ' + t + ' list differs');
  }
  if (IDX.at.size !== W.list.length) bad.push(IDX.at.size + ' records for ' + W.list.length + ' entities');
  return bad;
}
function landTile(rnd) { for (let k = 0; k < 400; k++) { const x = (rnd() * W.n) | 0, y = (rnd() * W.n) | 0, i = W.map.idx(x, y); if (!isWaterT(W.map.ter[i]) && !W.map.blk[i]) return { x, y }; } return null; }
`);

// ---------- 1. ten game minutes of AI play plus random owner changes, teleports, kills, spawns and moves ----------
const P = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 11, mapType: 'coastal', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 2], color: PLAYER_COLORS[i], human: i === 0 })), seed: 11, fog: 'normal', startRes: 'high', startAge: 2, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(99), pick = a => a[(rnd() * a.length) | 0], ops = { owner: 0, teleport: 0, kill: 0, spawn: 0, move: 0, unreported: 0 };
  const checks = [], first = [];
  for (let s = 1; s <= 600; s++) {
    for (let i = 0; i < 20; i++) worldTick(0.05);
    if (s % 2 === 0) {
      const units = W.list.filter(e => e.kind === 'unit' && !e.dying && !e.inside && e.owner > 0);
      const op = (rnd() * 5) | 0;
      if (op === 0 && units.length) { const u = pick(units); idxSetOwner(u, 1 + ((u.owner + ((rnd() * 3) | 0)) % 4)); setOrder(u, null); ops.owner++; }
      if (op === 1 && units.length) { const u = pick(units), t = landTile(rnd); if (t) { u.x = t.x + 0.5; u.y = t.y + 0.5; u.path = null; ops.teleport++; } }
      if (op === 2) { const c = W.list.filter(e => (e.kind === 'unit' && !e.dying) || (e.kind === 'res' && e.type === 'tree') || (e.kind === 'bld' && e.type === 'house')); if (c.length) { const e = pick(c); if (e.kind === 'res') removeEnt(e); else killEnt(e, null); ops.kill++; } }
      if (op === 3) { const t = landTile(rnd); if (t) { spawnRes(pick(['tree', 'gold', 'stone', 'berry', 'relic']), t.x, t.y); ops.spawn++; } }
      if (op === 4) { const trees = W.list.filter(e => e.kind === 'res' && e.type === 'tree' && !e.gatherers), t = landTile(rnd); if (trees.length && t) { const e = pick(trees); W.map.blk[W.map.idx(e.x, e.y)] = 0; e.x = t.x; e.y = t.y; W.map.blk[W.map.idx(t.x, t.y)] = e.id; idxMoved(e); ops.move++; } }
    }
    if (s % 30 === 0) { const bad = idxCheck(); checks.push(bad.length); if (bad.length && !first.length) first.push(...bad.slice(0, 5)); }
  }
  const fixes = IDX.fixes;
  // a direct owner write that skips idxSetOwner is caught by the next sync and counted
  const u = W.list.find(e => e.kind === 'unit' && e.owner === 2 && !e.dying);
  u.owner = 3; const before = IDX.fixes; idxSync(); ops.unreported = IDX.fixes - before;
  const after = idxCheck();
  return JSON.stringify({ t: W.t, entities: W.list.length, units: W.list.filter(e => e.kind === 'unit').length, ops, checks: checks.length, failedChecks: checks.filter(n => n).length, first, fixes, unreportedFixed: ops.unreported === 1 && !after.length });
})()`));
ok('10 game minutes of AI play with random owner changes, teleports, kills, spawns and moves: every bucket equals a brute-force scan', P.checks === 20 && P.failedChecks === 0 && P.t >= 600, P);
ok('every owner change in play went through idxSetOwner; a direct write is caught and counted by idxSync', P.fixes === 0 && P.unreportedFixed, P);

// ---------- 2. queries equal the brute-force answer ----------
const Q = JSON.parse(run(`(() => {
  const rnd = mulberry32(7), cats = ['unit', 'bld', 'relic', 'res:tree', 'res:gold', 'res:stone', 'res:berry', 'res:fish', 'res:carcass'];
  let rect = 0, near = 0, rectAll = 0, owned = 0, count = 0, walk = 0, n = 0;
  const same = (a, b) => a.length === b.length && a.every((e, i) => e === b[i]);
  for (let q = 0; q < 300; q++) {
    const cat = cats[q % cats.length], x0 = rnd() * W.n - 10, y0 = rnd() * W.n - 10, x1 = x0 + rnd() * 40, y1 = y0 + rnd() * 40;
    const r = rnd() * 30, x = rnd() * W.n, y = rnd() * W.n;
    const a = idxRect(cat, x0, y0, x1, y1), b = idxNear(cat, x, y, r);
    const z = idxRectAll(x0, y0, x1, y1);
    IDX.brute = true; const a2 = idxRect(cat, x0, y0, x1, y1), b2 = idxNear(cat, x, y, r), z2 = idxRectAll(x0, y0, x1, y1); IDX.brute = false;
    if (same(a, a2)) rect++; if (same(b, b2)) near++; if (same(z, z2)) rectAll++; n++;
    const o = q % W.players.length, kind = ['unit', 'bld', 'all'][q % 3], type = Object.keys(BUILDINGS)[q % Object.keys(BUILDINGS).length];
    const c = idxOwned(o, kind).slice(), k = idxCount(o, type);
    IDX.brute = true; const c2 = idxOwned(o, kind), k2 = idxCount(o, type); IDX.brute = false;
    if (same(c, c2)) owned++; if (k === k2) count++;
    // a walk that never stops visits exactly the category's entities
    const seen = new Set(); idxWalk([cat], x, y, () => true, e => seen.add(e));
    const all = W.list.filter(e => idxCat(e) === cat);
    if (seen.size === all.length && all.every(e => seen.has(e))) walk++;
  }
  // ghosts pushed past the indexed list (as vicWithGhosts does while drawing) are reported, and only they
  const ghost = { id: 1, kind: 'bld', ghost: true, type: 'house', x: 1, y: 1 }; W.list.push(ghost);
  const ghosts = idxGhosts().length === 1 && idxGhosts()[0] === ghost; W.list.pop();
  return JSON.stringify({ n, rect, near, rectAll, owned, count, walk, ghosts: ghosts && idxGhosts().length === 0 });
})()`));
ok('idxRect, idxNear, idxRectAll, idxOwned and idxCount equal the brute-force scan on 300 random queries; idxWalk reaches every entity; idxGhosts finds the ghosts', Q.rect === Q.n && Q.near === Q.n && Q.rectAll === Q.n && Q.owned === Q.n && Q.count === Q.n && Q.walk === Q.n && Q.ghosts, Q);

// ---------- 3. a new world, a replaced W.list and a restored save rebuild the index ----------
const R = JSON.parse(run(`(() => {
  const out = {};
  make(9); out.created = IDX.w === W && IDX.list === W.list && idxCheck().length === 0;
  W.list = W.list.filter(e => !(e.kind === 'res' && e.type === 'tree')); W.ents = new Map(W.list.map(e => [e.id, e]));
  out.replaced = idxAll('res:tree').size === undefined ? idxAll('res:tree').length === 0 : idxAll('res:tree').size === 0;
  make(9);
  for (let i = 0; i < 100; i++) worldTick(0.05);
  const text = MatchSave.serialize(), units = idxOwned(1, 'unit').length;
  out.notSaved = !text.includes('"IDX"') && !text.includes('"cells"');
  MatchSave.restore(text);
  out.restored = IDX.w === W && idxCheck().length === 0 && idxOwned(1, 'unit').length === units;
  return JSON.stringify(out);
})()`));
ok('a new world, a replaced W.list and a restored save each rebuild the index; the index is not written into saves', R.created && R.replaced && R.notSaved && R.restored, R);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
