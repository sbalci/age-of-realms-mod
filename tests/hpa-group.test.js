// Group orders (game/js/hpa.js with HPA.enabled): one route for the group, counted once against the path budget,
// every unit arriving at its formation slot; attack-move groups share one breach search.   node tests/hpa-group.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type, np) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: typeof size === 'number' ? 'x' + size : size, seed, mapType: type, numPlayers: np || 2 });
  createWorld(spec, { players: Array.from({ length: np || 2 }, (_, i) => ({ name: 'P' + i, civ: ['franks', 'turks', 'britons'][i % 3], color: PLAYER_COLORS[i], human: i === 0 })), seed, fog: 'none', startRes: 'high', startAge: 2 });
}
// 40 knights beside player 1's Town Center, the way the perf spec places them
function knights(a) { const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); } return us; }
`);

// ---------- 1. 40 knights across a 256 map: one search, budget charged once, everyone arrives ----------
const K = JSON.parse(run(`(() => {
  HPA.enabled = true; world(256, 33, 'land', 3);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
  let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
  const us = knights(a), out = { straight: +fd.toFixed(0) };
  const s0 = Object.assign({}, HPA.stats); PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0;
  let t0 = performance.now(); orderMove(us, far.x + 2, far.y + 6); out.groupMs = +(performance.now() - t0).toFixed(1);
  out.searches = HPA.stats.queries - s0.queries; out.shared = HPA.stats.shared - s0.shared; out.groups = HPA.stats.groups - s0.groups; out.budget = PATHB.used;
  out.pathOk = us.filter(u => u.pathOk).length;
  const slots = us.map(u => ({ x: u.order.x, y: u.order.y }));
  let t = 0; while (t < 400 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  out.seconds = +t.toFixed(0);
  const off = us.map((u, i) => Math.hypot(u.x - slots[i].x, u.y - slots[i].y));
  out.done = us.filter(u => !u.order && !u.dead).length;
  out.atSlot = off.filter(d => d < 1.5).length; out.worstSlot = +Math.max(...off).toFixed(1);   // crowding keeps some a little off their slot, as before
  out.within = us.filter(u => Math.hypot(u.x - far.x - 2, u.y - far.y - 6) < 8).length;
  // the same order with the hierarchy off: one full search per knight
  for (const u of us) removeEnt(u);
  HPA.enabled = false; const us2 = knights(a); t0 = performance.now(); orderMove(us2, far.x + 2, far.y + 6); out.oldMs = +(performance.now() - t0).toFixed(1);
  for (const u of us2) removeEnt(u);
  HPA.enabled = true; return JSON.stringify(out);
})()`));
ok('a 40-knight order across a 256 map runs one hierarchical search and charges the path budget once', K.searches === 1 && K.groups === 1 && K.shared === 40 && K.budget === 1 && K.pathOk === 40, K);
ok(`every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (${K.seconds} game seconds for ${K.straight} tiles)`, K.done === 40 && K.within === 40 && K.worstSlot <= 4 && K.atSlot >= 25, K);
ok(`the order takes a fraction of the old per-unit searches in the vm (${K.groupMs} ms against ${K.oldMs} ms)`, K.groupMs * 4 < K.oldMs, K);

// ---------- 2. members repath on their own only when blocked; a far straggler routes alone ----------
const B = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 7, 'land', 2);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
  const us = []; for (let k = 0; k < 10; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const p = nearestLandTile((a.x - 30) | 0, (a.y + 20) | 0, true); const straggler = spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5); us.push(straggler);
  const s0 = Object.assign({}, HPA.stats);
  orderMove(us, b.x + 2, b.y + 7);
  const out = { shared: HPA.stats.shared - s0.shared, searches: HPA.stats.queries - s0.queries, alone: !HPA_GROUP.get(straggler), again: us.filter(u => hpaShares(u)).length };
  // a blocked member: followPath's repath (pathTo with the unit's own goal) is its own search, toward its own slot
  const m = us[3], slot = { x: m.order.x, y: m.order.y };
  let t = 0; while (t < 2) { worldTick(0.05); t += 0.05; }
  const q0 = HPA.stats.queries, sh0 = HPA.stats.shared; pathTo(m, m.goalRect, m.goalR);
  out.repath = HPA.stats.queries === q0 + 1 && HPA.stats.shared === sh0 && m.pathOk && m.goalRect.x0 === (slot.x | 0) && m.goalRect.y0 === (slot.y | 0);
  while (t < 300 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  out.done = us.filter(u => !u.order).length; out.total = us.length;
  return JSON.stringify(out);
})()`));
ok('10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive', B.shared === 10 && B.searches === 2 && B.alone && B.again === 0 && B.repath && B.done === B.total, B);

// ---------- 3. attack-move into a walled camp: one breach search for the group ----------
const W2 = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 3, 'land', 2);
  const m = W.map, n = m.n, tcs = W.list.filter(e => e.type === 'tc');
  let s = null; for (let y = 10; y < n - 30 && !s; y += 3) for (let x = 10; x < n - 40; x += 3) { if (tcs.some(t => Math.hypot(t.x - x - 15, t.y - y - 8) < 30)) continue; s = { x, y }; break; }
  for (const e of W.list.slice()) if (e.kind !== 'unit' && e.x >= s.x - 2 && e.x < s.x + 34 && e.y >= s.y - 2 && e.y < s.y + 18) removeEnt(e);
  for (let y = s.y; y < s.y + 16; y++) for (let x = s.x; x < s.x + 32; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  m.computeVH(); m.computeRegions();
  const cx = s.x + 24, cy = s.y + 8, camp = spawnBuilding('barracks', 2, cx - 1, cy - 1, true), walls = [];
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === 4) walls.push(spawnBuilding('palisade', 2, x, y, true));
  const ks = []; for (let i = 0; i < 8; i++) ks.push(spawnUnit('longsword', 1, s.x + 1.5 + (i % 4), s.y + 6.5 + ((i / 4) | 0)));
  let inBreach = false, breachSearches = 0; const cfb = cmdFindBreach, fb = findPath;
  cmdFindBreach = function () { inBreach = true; try { return cfb.apply(this, arguments); } finally { inBreach = false; } };
  findPath = function () { if (inBreach) breachSearches++; return fb.apply(this, arguments); };
  hpaGroupOrder(ks, () => ({ x: cx + 0.5, y: cy + 0.5 }), cx + 0.5, cy + 0.5, 'attackmove');
  let t = 0; while (t < 10 && !ks.some(k => k.breaches)) { worldTick(0.05); t += 0.05; }
  const breached = ks.filter(k => k.breaches).length, firstBreachSearches = breachSearches;
  while (t < 300 && !camp.dead) { worldTick(0.05); t += 0.05; }
  findPath = fb; cmdFindBreach = cfb;
  return JSON.stringify({ breached, firstBreachSearches, opened: walls.some(w => w.dead), campDown: !!camp.dead, t: +t.toFixed(0) });
})()`));
ok('a grouped attack-move blocked by walls makes one breach search for the group, breaches and takes the camp', W2.breached >= 4 && W2.firstBreachSearches === 1 && W2.opened && W2.campDown, W2);
// ---------- 4. a group order onto a tree, a mine or a building: the formation holds, as the old code did ----------
run(`
function blockedTrial(on, kind) {
  HPA.enabled = on; world(160, 7, 'land', 2);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const far = e => { const d = Math.hypot(e.x - a.x, e.y - a.y); return d > 30 && d < 70; };
  const r = kind === 'mine' ? W.list.find(e => e.kind === 'res' && (e.type === 'gold' || e.type === 'stone') && far(e))
    : kind === 'tree' ? W.list.find(e => e.kind === 'res' && (e.type === 'tree' || e.type === 'wood' || e.type === 'forest' || e.res === 'wood') && far(e))
    : (() => { const p = nearestLandTile((a.x + 30) | 0, (a.y + 8) | 0, true); return spawnBuilding('barracks', 1, p.x, p.y, true); })();   // our own, so nothing shoots at the group
  const tgt = { x: r.x + 0.5, y: r.y + 0.5 }, pass = passLand(1);
  orderMove(us, tgt.x, tgt.y);
  const slots = us.map(u => u.order ? { x: u.order.x, y: u.order.y } : null), pathOk = us.filter(u => u.pathOk).length;
  let t = 0; while (t < 200 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  const off = us.map((u, i) => slots[i] ? Math.hypot(u.x - slots[i].x, u.y - slots[i].y) : 99);
  return { kind, on, clickPassable: pass(W.map.idx(tgt.x | 0, tgt.y | 0)), pathOk, atSlot: off.filter(d => d < 1.5).length, worst: +Math.max(...off).toFixed(1) };
}`);
for (const kind of ['tree', 'mine', 'building']) {
  const o = JSON.parse(run(`JSON.stringify(blockedTrial(false, '${kind}'))`)), n = JSON.parse(run(`JSON.stringify(blockedTrial(true, '${kind}'))`));
  ok(`a group order clicked on a ${kind} keeps the formation (old ${o.pathOk} pathOk, ${o.atSlot} at slot; new ${n.pathOk}, ${n.atSlot})`, !n.clickPassable && n.pathOk >= Math.min(19, o.pathOk - 1) && n.atSlot >= Math.min(19, o.atSlot - 1) && n.atSlot >= o.atSlot - 1 && n.pathOk >= o.pathOk - 1, { o, n });
}

// ---------- 5. a group order onto an island its units cannot reach: nobody is sent to one shared tile ----------
run(`
function islandTrial(on) {
  HPA.enabled = on; world(160, 5, 'islands', 2);
  const m = W.map, n = m.n, a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), pass = passLand(1);
  const us = []; for (let k = 0; k < 12; k++) { const p = nearestLandTile((a.x + 5 + (k % 4)) | 0, (a.y + 6 + ((k / 4) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  // a land tile no land route reaches: the nearest one by straight distance whose search fails, 30 to 70 tiles off
  let tgt = null, bd = Infinity;
  for (let y = 2; y < n - 2; y += 2) for (let x = 2; x < n - 2; x += 2) {
    const d = Math.hypot(x - a.x, y - a.y); if (d < 30 || d > 70 || d >= bd || !pass(m.idx(x, y))) continue;
    const r = findPath(m, a.x | 0, a.y | 0, { x0: x, y0: y, x1: x, y1: y, r: 0 }, pass, undefined, 'land'); if (!r.ok) { bd = d; tgt = { x: x + 0.5, y: y + 0.5 }; }
  }
  if (!tgt) return { none: true };
  orderMove(us, tgt.x, tgt.y);
  const ends = new Set(us.map(u => u.path && u.path.length ? (u.path[u.path.length - 1].x | 0) + ',' + (u.path[u.path.length - 1].y | 0) : 'none'));
  const slots = new Set(us.map(u => u.order ? (u.order.x | 0) + ',' + (u.order.y | 0) : 'none'));
  return { on, pathOk: us.filter(u => u.pathOk).length, distinctEnds: ends.size, distinctSlots: slots.size };
}`);
const IO = JSON.parse(run(`JSON.stringify(islandTrial(false))`)), IN = JSON.parse(run(`JSON.stringify(islandTrial(true))`));
ok(`a group order onto an unreachable island gives up as before: nobody pathOk, as many distinct path ends as the old code (old ${IO.distinctEnds}, new ${IN.distinctEnds})`, !IO.none && !IN.none && IN.pathOk === 0 && IO.pathOk === 0 && IN.distinctEnds >= IO.distinctEnds, { IO, IN });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
