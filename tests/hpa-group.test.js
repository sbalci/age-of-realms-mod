// Group orders (game/js/hpa.js with HPA.enabled): one route for the group, nothing searched in the click (members make
// their requests on their own first ticks, spread by the path budget), every unit arriving at its formation slot;
// attack-move groups share one breach search.   node tests/hpa-group.test.js
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
// A group member makes its first path request on its own tick (hpaJoinDue): one still waiting has a 'move' order marked
// join, or an attack-move without a path. settle plays ticks until no unit of us waits; it returns the ticks played.
function waiting(u) { return !u.dead && !!u.order && (!!u.order.join || (u.order.t === 'attackmove' && !u.path)); }
function settle(us, max = 40) { let k = 0; while (k < max && us.some(waiting)) { worldTick(0.05); k++; } return k; }
`);

// ---------- 1. 40 knights across a 256 map: one search, budget charged once, everyone arrives ----------
const K = JSON.parse(run(`(() => {
  HPA.enabled = true; world(256, 33, 'land', 3);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
  let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
  const us = knights(a), out = { straight: +fd.toFixed(0) }, set = new Set(us);
  const s0 = Object.assign({}, HPA.stats);
  const fp0 = findPath, lc0 = lineClear, hr0 = hpaRoute, pt0 = pathTo, jd0 = hpaJoinDue;
  let joins = 0, sights = 0, routes = 0, work = 0, depth = 0;
  findPath = function (m, sx, sy, g, p, mx) { if (mx === HPA.joinNodes) joins++; return fp0.apply(this, arguments); };
  lineClear = function () { sights++; return lc0.apply(this, arguments); };
  hpaRoute = function () { routes++; return hr0.apply(this, arguments); };
  // the knights' own path work in the ticks after the click (the group route runs inside hpaJoinDue)
  const timed = f => function (u) { if (!set.has(u) || depth) return f.apply(this, arguments); depth++; const t = performance.now(); try { return f.apply(this, arguments); } finally { work += performance.now() - t; depth--; } };
  pathTo = timed(pt0); hpaJoinDue = timed(jd0);
  const perTick = [];
  let t0 = performance.now();
  try {
    orderMove(us, far.x + 2, far.y + 6); out.clickMs = +(performance.now() - t0).toFixed(1);
    out.clickSearches = HPA.stats.queries - s0.queries; out.clickPaths = us.filter(u => u.path).length;
    for (let k = 0; k < 40 && us.some(waiting); k++) { const had = us.filter(u => u.path).length; worldTick(0.05); perTick.push(us.filter(u => u.path).length - had); }
  } finally { findPath = fp0; lineClear = lc0; hpaRoute = hr0; pathTo = pt0; hpaJoinDue = jd0; }
  out.groupMs = +(out.clickMs + work).toFixed(1); out.joinSearches = joins; out.sightLines = sights; out.routes = routes; out.perTick = perTick;
  out.shared = HPA.stats.shared - s0.shared; out.groups = HPA.stats.groups - s0.groups;
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
ok(`a 40-knight order across a 256 map searches nothing in the click; the next tick runs the group's one route search alone, and the 40 members join it over the ticks after, at most PATHB.perTick a tick (${K.perTick.join(' / ')})`,
  K.clickSearches === 0 && K.clickPaths === 0 && K.routes === 1 && K.groups === 1 && K.shared === 40 && K.perTick[0] === 0 && K.perTick.slice(1).every(c => c > 0 && c <= 24) && K.perTick.reduce((s, c) => s + c, 0) === 40 && K.pathOk === 40, K);
ok(`every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (${K.seconds} game seconds for ${K.straight} tiles)`, K.done === 40 && K.within === 40 && K.worstSlot <= 4 && K.atSlot >= 25, K);
// 6ef62aa: 49 ms against about 3200 ms (1.5%); a join that searched for nearly every member cost 175 ms (5.5%)
ok(`the order (click ${K.clickMs} ms, then the knights' own work in the next ticks) takes a small fraction of the old per-unit searches in the vm (${K.groupMs} ms against ${K.oldMs} ms: under 1/40), with at most 10 member join searches (${K.joinSearches}) and 1000 sight lines (${K.sightLines})`, K.groupMs * 40 < K.oldMs && K.clickMs * 4 < K.groupMs && K.joinSearches <= 10 && K.sightLines <= 1000, K);

// ---------- 2. members repath on their own only when blocked; a far straggler routes alone ----------
const B = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 7, 'land', 2);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
  const us = []; for (let k = 0; k < 10; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const p = nearestLandTile((a.x - 30) | 0, (a.y + 20) | 0, true); const straggler = spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5); us.push(straggler);
  const s0 = Object.assign({}, HPA.stats), hr0 = hpaRoute; let routes = 0; hpaRoute = function () { routes++; return hr0.apply(this, arguments); };
  orderMove(us, b.x + 2, b.y + 7);
  const strPath = !!straggler.path;   // the straggler is no member: its own search runs in the click
  try { settle(us); } finally { hpaRoute = hr0; }
  const out = { shared: HPA.stats.shared - s0.shared, routes, strPath, alone: !HPA_GROUP.get(straggler), again: us.filter(u => hpaShares(u)).length };
  // a blocked member: followPath's repath (pathTo with the unit's own goal) is its own search, toward its own slot
  const m = us[3], slot = { x: m.order.x, y: m.order.y };
  let t = 0; while (t < 2) { worldTick(0.05); t += 0.05; }
  const q0 = HPA.stats.queries, sh0 = HPA.stats.shared; pathTo(m, m.goalRect, m.goalR);
  out.repath = HPA.stats.queries === q0 + 1 && HPA.stats.shared === sh0 && m.pathOk && m.goalRect.x0 === (slot.x | 0) && m.goalRect.y0 === (slot.y | 0);
  while (t < 300 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  out.done = us.filter(u => !u.order).length; out.total = us.length;
  return JSON.stringify(out);
})()`));
ok('10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive', B.shared === 10 && B.routes === 1 && B.strPath && B.alone && B.again === 0 && B.repath && B.done === B.total, B);

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
// Two wolves stand by the mine, attack the arrivals, and the fight pulls units off their slots: where 20 units end up
// depends on the way each one came. Along the shared route alone all 20 came round the same side, past one wolf, and over
// 20 order times (0-19 ticks into the match) 104 of 400 ended at their slot; the per-unit searches with the hierarchy off,
// 244. With the wild animals removed, all 400 reach their slot either way. So the mine is summed over 20 order times, and
// the group must keep 9/10 of the per-unit count; its members also set off along the shared route within 3 ticks of the
// click, and take their own paths when their own searches have run (hpa.js hpaOwnDue).
run(`
function blockedTrial(on, kind, delay) {
  HPA.enabled = on; world(160, 7, 'land', 2);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const far = e => { const d = Math.hypot(e.x - a.x, e.y - a.y); return d > 30 && d < 70; };
  const r = kind === 'mine' ? W.list.find(e => e.kind === 'res' && (e.type === 'gold' || e.type === 'stone') && far(e))
    : kind === 'tree' ? W.list.find(e => e.kind === 'res' && (e.type === 'tree' || e.type === 'wood' || e.type === 'forest' || e.res === 'wood') && far(e))
    : (() => { const p = nearestLandTile((a.x + 30) | 0, (a.y + 8) | 0, true); return spawnBuilding('barracks', 1, p.x, p.y, true); })();   // our own, so nothing shoots at the group
  for (let q = 0; q < delay; q++) worldTick(0.05);
  const tgt = { x: r.x + 0.5, y: r.y + 0.5 }, pass = passLand(1);
  orderMove(us, tgt.x, tgt.y);
  const slots = us.map(u => u.order ? { x: u.order.x, y: u.order.y } : null);
  const p0 = us.map(u => [u.x, u.y]), first = us.map(() => -1);   // the tick each unit first moves
  for (let k = 1; k <= 60 && first.some(f => f < 0); k++) { worldTick(0.05); us.forEach((u, i) => { if (first[i] < 0 && (u.x !== p0[i][0] || u.y !== p0[i][1])) first[i] = k; }); }
  settle(us); const pathOk = us.filter(u => u.pathOk).length;
  let t = 0; while (t < 200 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  const off = us.map((u, i) => slots[i] ? Math.hypot(u.x - slots[i].x, u.y - slots[i].y) : 99);
  return { kind, on, clickPassable: pass(W.map.idx(tgt.x | 0, tgt.y | 0)), pathOk, atSlot: off.filter(d => d < 1.5).length, worst: +Math.max(...off).toFixed(1), start: Math.max(...first) };
}`);
for (const [kind, times] of [['tree', 1], ['mine', 20], ['building', 1]]) {
  const sum = on => { const s = { pathOk: 0, atSlot: 0, start: 0, clickPassable: false, each: [] }; for (let d = 0; d < times; d++) { const r = JSON.parse(run(`JSON.stringify(blockedTrial(${on}, '${kind}', ${d}))`)); s.pathOk += r.pathOk; s.atSlot += r.atSlot; s.start = Math.max(s.start, r.start); s.each.push(r.atSlot); s.clickPassable = s.clickPassable || r.clickPassable; } return s; };
  const o = sum(false), n = sum(true), N = 20 * times;
  const atSlotOk = kind === 'mine' ? n.atSlot * 10 >= o.atSlot * 9 : n.atSlot >= Math.min(N - 1, o.atSlot - 1);
  ok(`a group order clicked on a ${kind} keeps the formation (${times} order time${times > 1 ? 's' : ''}: old ${o.pathOk} pathOk, ${o.atSlot} at slot; new ${n.pathOk}, ${n.atSlot}), and every unit moves within 3 ticks (${n.start})`, !n.clickPassable && n.pathOk >= Math.min(N - 1, o.pathOk - 1) && atSlotOk && n.start <= 3, { o, n });
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
  const slots = new Set(us.map(u => u.order ? (u.order.x | 0) + ',' + (u.order.y | 0) : 'none'));
  settle(us);
  const ends = new Set(us.map(u => u.path && u.path.length ? (u.path[u.path.length - 1].x | 0) + ',' + (u.path[u.path.length - 1].y | 0) : 'none'));
  return { on, pathOk: us.filter(u => u.pathOk).length, distinctEnds: ends.size, distinctSlots: slots.size };
}`);
const IO = JSON.parse(run(`JSON.stringify(islandTrial(false))`)), IN = JSON.parse(run(`JSON.stringify(islandTrial(true))`));
ok(`a group order onto an unreachable island gives up as before: nobody pathOk, as many distinct path ends as the old code (old ${IO.distinctEnds}, new ${IN.distinctEnds})`, !IO.none && !IN.none && IN.pathOk === 0 && IO.pathOk === 0 && IN.distinctEnds >= IO.distinctEnds, { IO, IN });

// ---------- 6. 40 knights ordered into the middle of a forest on a 256 map: slots in pockets, no full search per knight ----------
run(`
function forestTrial(on) {
  HPA.enabled = on; world(256, 33, 'land', 3);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), us = knights(a);
  const trees = W.list.filter(e => e.kind === 'res' && e.type === 'tree' && Math.hypot(e.x - a.x, e.y - a.y) > 60 && Math.hypot(e.x - a.x, e.y - a.y) < 170);
  let best = null, bn = -1;   // the tree with the most trees within 3 tiles (at least 40: the middle of a forest, not its edge)
  for (let i = 0; i < trees.length; i += 7) { const t = trees[i]; let c = 0; for (const q of trees) if (Math.abs(q.x - t.x) <= 3 && Math.abs(q.y - t.y) <= 3) c++; if (c > bn) { bn = c; best = t; } }
  // what the knights charge to the path budget: polish.js charges each pathTo request, hpaRoute the group's search
  // and hpaJoin each pocket search it runs
  // (only the knights' own requests and their group's route count: other units search in these ticks too)
  const set = new Set(us), fp = findPath, pt = pathTo, hr = hpaRoute; let full = 0, pocket = 0, budget = 0, routes = 0, inside = 0, routing = 0;
  findPath = function (m, sx, sy, g, p, mx, cls) { if (inside || routing) { if (cls) full++; else if (mx === HPA.pocketNodes) pocket++; } return fp.apply(this, arguments); };
  pathTo = function (u) { if (!set.has(u)) return pt.apply(this, arguments); pathBudgetTick(); const b = PATHB.used; inside++; try { return pt.apply(this, arguments); } finally { inside--; budget += PATHB.used - b; } };
  hpaRoute = function () { routes++; const b = PATHB.used; routing++; try { return hr.apply(this, arguments); } finally { routing--; if (!inside) budget += PATHB.used - b; } };
  const s0 = HPA.stats.shared, t0 = performance.now();
  try { orderMove(us, best.x + 0.5, best.y + 0.5); settle(us); } finally { findPath = fp; pathTo = pt; hpaRoute = hr; }
  const ms = performance.now() - t0; let h = 0; const str = JSON.stringify(us.map(u => u.path));
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return { on, dense: bn, ms: +ms.toFixed(1), full, pocket, routes, budget, shared: HPA.stats.shared - s0, pathOk: us.filter(u => u.pathOk).length, hash: h };
}`);
const FO = JSON.parse(run(`JSON.stringify(forestTrial(false))`)), F1 = JSON.parse(run(`JSON.stringify(forestTrial(true))`)), F2 = JSON.parse(run(`JSON.stringify(forestTrial(true))`));
ok(`40 knights ordered into a forest: as many reach their slot as before (${F1.pathOk} against ${FO.pathOk}), at most 2 full searches (${F1.full}), the budget charged for every member request, the group's route and every pocket search actually run (${F1.budget} = 40 + ${F1.routes} + ${F1.pocket}), under a tenth of the old time (${F1.ms} ms against ${FO.ms} ms), and the same paths on a repeat`,
  F1.dense >= 40 && F1.pathOk >= FO.pathOk && F1.full <= 2 && F1.routes === 1 && F1.budget === 40 + F1.routes + F1.pocket && F1.ms * 10 < FO.ms && F1.hash === F2.hash, { FO, F1, F2 });

// ---------- 7. groups spread round a Town Center or standing in a block, ordered 14-40 tiles: no longer, no backwards ----------
// Members joined the shared route at its first waypoint and walked all of it, so they took longer ways and some first walked
// away from their slot. Against the same units each searching alone: total planned path, first legs away from the slot,
// and the game seconds until every order is done.
run(`
function armTrial(share, seed, dist, spread, layout) {
  HPA.enabled = true;
  const g0 = hpaGroupOrder;
  if (!share) hpaGroupOrder = function (units, slotOf, x, y, t) { for (const u of units) { const s = slotOf(u); setOrder(u, { t, x: s.x, y: s.y }); } };
  try {
    world(160, seed, 'land', 2);
    const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), rnd = mulberry32(seed * 31 + dist), us = [];
    for (let k = 0; k < 16; k++) {
      let p;
      if (layout === 'spread') { const ang = rnd() * 6.283, r = 3 + rnd() * spread; p = nearestLandTile((a.x + 1.5 + Math.cos(ang) * r) | 0, (a.y + 1.5 + Math.sin(ang) * r) | 0, true); }
      else p = nearestLandTile((a.x + 6 + (k % 4)) | 0, (a.y - 2 + ((k / 4) | 0)) | 0, true);
      if (p) us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5));
    }
    const pos = us.map(u => ({ x: u.x, y: u.y }));
    orderMove(us, a.x + 1.5 + dist, a.y + 1.5 - dist * 0.4);
    settle(us);   // a member stands still until it joins, so its path starts where it stood at the click
    let len = 0, back = 0;
    us.forEach((u, i) => {
      let px = pos[i].x, py = pos[i].y; for (const p of (u.path || [])) { len += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
      const p0 = u.path && u.path[0], s = { x: u.order.x, y: u.order.y };
      if (p0 && Math.hypot(p0.x - s.x, p0.y - s.y) - Math.hypot(pos[i].x - s.x, pos[i].y - s.y) > 1) back++;
    });
    let t = 0; while (t < 120 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
    return { len, back, sec: t };
  } finally { hpaGroupOrder = g0; }
}
function armSum(share, layout) {
  const out = { len: 0, back: 0, sec: 0 };
  for (const [seed, dist, spread] of [[7, 14, 6], [7, 20, 8], [3, 14, 6], [3, 25, 8], [11, 18, 8], [11, 40, 8]]) { const r = armTrial(share, seed, dist, spread, layout); out.len += r.len; out.back += r.back; out.sec += r.sec; }
  return JSON.stringify({ len: +out.len.toFixed(0), back: out.back, sec: +out.sec.toFixed(1) });
}`);
for (const layout of ['spread', 'block']) {
  const S = JSON.parse(run(`armSum(false, '${layout}')`)), G = JSON.parse(run(`armSum(true, '${layout}')`));
  ok(`${layout} groups (6 orders of 14-40 tiles, 16 spearmen): the shared route plans at most 1.05x the per-unit paths (${G.len} against ${S.len}), nobody's first leg walks away from the slot (${G.back}, per-unit ${S.back}), and the last arrival is within 1.05x (${G.sec} s against ${S.sec} s)`,
    G.len <= S.len * 1.05 && G.back <= S.back && G.back === 0 && G.sec <= S.sec * 1.05, { S, G });
}

// ---------- 8. attack-move onto unreachable land: the members' identical pocket search runs once, charged once ----------
const AM = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 5, 'islands', 2);
  const m = W.map, n = m.n, a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), pass = passLand(1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  let tgt = null, bd = Infinity;
  for (let y = 2; y < n - 2; y += 2) for (let x = 2; x < n - 2; x += 2) {
    const d = Math.hypot(x - a.x, y - a.y); if (d < 30 || d > 70 || d >= bd || !pass(m.idx(x, y))) continue;
    const r = findPath(m, a.x | 0, a.y | 0, { x0: x, y0: y, x1: x, y1: y, r: 0 }, pass, undefined, 'land'); if (!r.ok) { bd = d; tgt = { x: x + 0.5, y: y + 0.5 }; }
  }
  if (!tgt) return JSON.stringify({ none: true });
  const fp = findPath; let pocket = 0; findPath = function (mm, sx, sy, g, p, mx) { if (mx === HPA.pocketNodes) pocket++; return fp.apply(this, arguments); };
  PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0;
  try { hpaGroupOrder(us, () => ({ x: tgt.x, y: tgt.y }), tgt.x, tgt.y, "attackmove"); settle(us); } finally { findPath = fp; }
  return JSON.stringify({ pocket, groups: new Set(us.map(u => HPA_GROUP.get(u) && HPA_GROUP.get(u).g)).size, gotPath: us.filter(u => u.path && u.path.length).length });
})()`));
ok(`20 units attack-moving onto unreachable land run 1 pocket search (${AM.pocket}), not 20; all of them walk (the charge to the path budget is checked by the forest order above)`, !AM.none && AM.groups === 1 && AM.pocket === 1 && AM.gotPath === 20, AM);

// ---------- 9. joins under budget load; deferred work dropped when a member dies, is reordered, or the leader dies ----------
// Part 1 again with the tick's path budget already spent by other units at every tick start: a group's joins have their own
// quota (ceil(members / 2) a tick), so the shared budget cannot starve them.
const PR = JSON.parse(run(`(() => {
  HPA.enabled = true; world(200, 33, 'land', 3);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
  let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
  const out = {};
  for (const pressure of [false, true]) {
    const us = knights(a), set = new Set(us), pbt = pathBudgetTick, pt0 = pathTo, jd0 = hpaJoinDue;
    if (pressure) pathBudgetTick = function () { const t = PATHB.tick, w = PATHB.world; pbt(); if (PATHB.tick !== t || PATHB.world !== w) PATHB.used = PATHB.perTick; };
    let work = 0, depth = 0;
    const timed = f => function (u) { if (!set.has(u) || depth) return f.apply(this, arguments); depth++; const t = performance.now(); try { return f.apply(this, arguments); } finally { work += performance.now() - t; depth--; } };
    pathTo = timed(pt0); hpaJoinDue = timed(jd0);
    const p0 = us.map(u => [u.x, u.y]), got = us.map(() => -1), moved = us.map(() => -1), ms = [];
    orderMove(us, far.x + 2, far.y + 6);
    try { for (let k = 1; k <= 80 && (got.some(f => f < 0) || moved.some(f => f < 0)); k++) { work = 0; worldTick(0.05); ms.push(+work.toFixed(1)); us.forEach((u, i) => { if (got[i] < 0 && u.path) got[i] = k; if (moved[i] < 0 && (u.x !== p0[i][0] || u.y !== p0[i][1])) moved[i] = k; }); } }
    finally { pathBudgetTick = pbt; pathTo = pt0; hpaJoinDue = jd0; }
    out[pressure ? 'pressed' : 'free'] = { lastPath: Math.max(...got), lastMove: Math.max(...moved), ms: ms.slice(0, 4) };
    for (const u of us) removeEnt(u);
  }
  return JSON.stringify(out);
})()`));
ok(`40 knights ordered while other units have spent the path budget every tick still have all their paths by tick 3 and all move by tick 3 (last path tick ${PR.pressed.lastPath}, last move ${PR.pressed.lastMove}; free budget ${PR.free.lastPath}/${PR.free.lastMove}; order work per tick ${PR.pressed.ms.join(' / ')} ms)`,
  PR.pressed.lastPath <= 3 && PR.pressed.lastMove <= 3 && PR.free.lastPath <= 3 && PR.free.lastMove <= 3, PR);

// A blocked click (a mine): members join the shared route, then each one's own search is still due (hpaOwnPending).
run(`
function mineGroup(np) {
  HPA.enabled = true; world(160, 7, 'land', np || 2);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const r = W.list.find(e => e.kind === 'res' && (e.type === 'gold' || e.type === 'stone') && (d => d > 30 && d < 70)(Math.hypot(e.x - a.x, e.y - a.y)));
  return { a, us, r };
}
`);
const D = JSON.parse(run(`(() => {
  const { a, us, r } = mineGroup(), out = {};
  orderMove(us, r.x + 0.5, r.y + 0.5);
  const dead = us[3], moved = us[4], other = { x: a.x + 8, y: a.y + 12 };
  removeEnt(dead);                                  // dies before its join
  orderMove([moved], other.x, other.y);             // gets a new order before its join (a lone unit: its own order)
  settle(us);
  out.pending0 = us.filter(u => !u.dead && hpaOwnPending(u)).length;
  out.deadPath = !!dead.path; out.movedFresh = !!moved.path && !hpaOwnPending(moved) && !hpaShares(moved);
  const e = moved.path && moved.path[moved.path.length - 1]; out.movedEnd = e ? Math.hypot(e.x - other.x, e.y - other.y) : 99;
  // one more member is reordered and one killed after its join, before its own search
  const late = us[7], gone = us[9]; removeEnt(gone); orderMove([late], a.x + 10, a.y + 3);
  out.latePending = hpaOwnPending(late);
  const stats0 = HPA.stats.own;
  for (let k = 0; k < 120 && us.some(u => !u.dead && hpaOwnPending(u)); k++) worldTick(0.05);
  out.left = us.filter(u => !u.dead && hpaOwnPending(u)).length; out.own = HPA.stats.own - stats0;
  const le = late.path && late.path[late.path.length - 1]; out.lateEnd = le ? Math.hypot(le.x - (a.x + 10), le.y - (a.y + 3)) : 99;
  return JSON.stringify(out);
})()`));
ok(`members that die or get a new order before their join or their own search drop the deferred work: no stale path (own searches still due after the join ${D.pending0}, none left ${D.left}; the dead has no path ${!D.deadPath}; reordered members end at their new point ${D.movedEnd.toFixed(1)} / ${D.lateEnd.toFixed(1)} tiles away)`,
  D.pending0 > 0 && !D.deadPath && D.movedFresh && D.movedEnd < 3 && !D.latePending && D.left === 0 && D.lateEnd < 3, D);
const LD = JSON.parse(run(`(() => {
  HPA.enabled = true; world(200, 33, 'land', 3);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), far = W.list.filter(e => e.type === 'tc').reduce((b, t) => Math.hypot(t.x - a.x, t.y - a.y) > Math.hypot(b.x - a.x, b.y - a.y) ? t : b);
  const res = die => {
    HPA.enabled = true; world(200, 33, 'land', 3);
    const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1), far = W.list.filter(e => e.type === 'tc').reduce((b, t) => Math.hypot(t.x - a.x, t.y - a.y) > Math.hypot(b.x - a.x, b.y - a.y) ? t : b);
    const us = knights(a); orderMove(us, far.x + 2, far.y + 6);
    const L = HPA_GROUP.get(us[0]).g.leader; if (die) removeEnt(L);   // the leader dies before the route tick
    const rest = us.filter(u => u !== L), ticks = settle(us);
    return { ticks, withPath: rest.filter(u => u.path && u.path.length).length, pathOk: rest.filter(u => u.pathOk).length, of: rest.length };
  };
  return JSON.stringify({ dies: res(true), lives: res(false) });
})()`));
ok(`the leader dying before the route tick: another member runs the route, all ${LD.dies.of} others join by tick ${LD.dies.ticks}, with as many routes reaching their goal as when it lives (${LD.dies.pathOk} against ${LD.lives.pathOk})`, LD.dies.ticks <= 3 && LD.dies.withPath === LD.dies.of && LD.dies.pathOk >= LD.lives.pathOk, LD);
// An own search never turns a unit round onto a longer way: a taken path whose first leg points back has to be no longer than what was left.
const RV = JSON.parse(run(`(() => {
  let bad = 0, taken = 0, checked = 0;
  for (let d = 0; d < 6; d++) {
    const { us, r } = mineGroup(); for (let q = 0; q < d; q++) worldTick(0.05);
    orderMove(us, r.x + 0.5, r.y + 0.5);
    const len = (u, p, i) => { let l = 0, x = u.x, y = u.y; for (; i < p.length; i++) { l += Math.hypot(p[i].x - x, p[i].y - y); x = p[i].x; y = p[i].y; } return l; };
    const lead = (u, p, i) => { for (; i < p.length; i++) { const dx = p[i].x - u.x, dy = p[i].y - u.y; if (dx * dx + dy * dy > 0.04) return [dx, dy]; } return null; };
    for (let k = 0; k < 160; k++) {
      const before = us.map(u => u.path ? { p: u.path, rest: len(u, u.path, u.pi), c: lead(u, u.path, u.pi) } : null), n0 = HPA.stats.ownTaken;
      worldTick(0.05);
      if (HPA.stats.ownTaken === n0) continue;
      us.forEach((u, i) => { const b = before[i]; if (!b || u.path === b.p || !u.path) return; taken++;
        const n = lead(u, u.path, 0), dot = b.c && n ? b.c[0] * n[0] + b.c[1] * n[1] : 1;
        checked++; if (dot <= 0 && len(u, u.path, 0) > b.rest + 1) bad++; });   // 1 tile: the unit also walked in that tick
    }
  }
  return JSON.stringify({ taken, checked, bad });
})()`));
ok(`own searches are taken (${RV.taken} switches over 6 order times) but never turn a unit round onto a longer way (${RV.bad} did)`, RV.taken > 0 && RV.bad === 0, RV);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
