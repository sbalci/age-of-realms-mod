// ===== Realms mod, batch 4: terraforming (canals, trenches, raise/lower/dig ground, plant trees) =====
// Loaded after wells.js. Villagers get a "terra" order that works through a shared job (a list of tiles).
// Terrain edits are plain array writes; pathfinding is per-unit A*, so nothing needs invalidating except the render
// chunks and the region maps, which are refreshed once per tick after a batch of edits.
// URL switch: ?terra=off
'use strict';
const TERRA = {
  enabled: true,
  maxLine: 40, maxArea: 64,
  secs: { canal: 7, trench: 4, raise: 6, lower: 5, dig: 5, plant: 3 },   // villager seconds per tile (per level for lower/dig)
  raiseStone: 10,       // stone per level raised
  digStone: 15,         // stone recovered per level removed
  maxElev: 4,
  trenchSlow: 0.45,     // speed lost inside a trench
  trenchArmor: 2,       // pierce armor for units standing in one
  saplingSecs: 150,     // seconds for a planted tree to mature
};
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('terra') === 'off') TERRA.enabled = false;
const TERRA_OPS = {
  canal: { name: 'Dig Canal', key: 'C', shape: 'line', desc: 'Drag a line from the water\'s edge inland. Villagers dig it tile by tile and ships can then sail it. Free, but slow.' },
  trench: { name: 'Dig Trench', key: 'T', shape: 'line', desc: 'Drag a line. Units in a trench move slower and take 2 less pierce damage; cavalry, siege and carts cannot cross it.' },
  raise: { name: 'Raise Ground', key: 'R', shape: 'rect', desc: 'Drag an area. Raises it one level (10 stone per tile). Steep steps become cliffs.' },
  lower: { name: 'Lower Ground', key: 'L', shape: 'rect', desc: 'Drag an area. Lowers it one level and recovers 15 stone per tile. Good for ramps.' },
  dig: { name: 'Dig Mountain', key: 'D', shape: 'rect', desc: 'Drag an area. Digs hills and mountains down to flat ground, recovering 15 stone per level.' },
  plant: { name: 'Plant Trees', key: 'P', shape: 'rect', desc: 'Drag an area of grass or dirt. Saplings mature into trees in about 2.5 minutes.' },
};

// ---------- checks ----------
function terraFarms() {
  if (W._tfT !== W.tick || !W._tf) { W._tfT = W.tick; W._tf = W.list.filter(f => f.kind === 'bld' && BUILDINGS[f.type].farm); }
  return W._tf;
}
const terraDry = t => t !== T.WATER && t !== T.DEEP && t !== T.SHALLOW;
// null = fine now; 'wait' = a canal tile that must wait for its neighbour; otherwise the reason.
function terraCheck(op, x, y, sim) {
  const m = W.map;
  if (!m.inb(x, y) || x < 1 || y < 1 || x >= m.n - 1 || y >= m.n - 1) return 'Edge of the map';
  const i = m.idx(x, y), t = m.ter[i];
  if (m.blk[i]) { if (W.ents.get(m.blk[i])) return 'Something is in the way'; m.blk[i] = 0; }
  for (const f of terraFarms()) if (x >= f.x && x < f.x + 3 && y >= f.y && y < f.y + 3) return 'A farm is in the way';
  if (op === 'canal') {
    if (isWaterT(t)) return 'Already water';
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0) - (d === 1), ny = y + (d === 2) - (d === 3);
      if (!m.inb(nx, ny)) continue;
      const j = m.idx(nx, ny);
      if (isWaterT(m.ter[j]) || (sim && sim.has(j))) return null;
    }
    return 'wait';
  }
  if (op === 'trench') { if (!terraDry(t)) return 'Not dry land'; if (m.trench && m.trench[i]) return 'Already a trench'; return null; }
  if (op === 'raise') { if (!terraDry(t)) return 'Not dry land'; if (m.elev[i] >= TERRA.maxElev) return 'Already at the peak'; return null; }
  if (op === 'lower' || op === 'dig') { if (!terraDry(t)) return 'Not dry land'; if (m.elev[i] <= 0) return 'Already level'; return null; }
  if (op === 'plant') { if (t !== T.GRASS && t !== T.DIRT && t !== T.FOREST) return 'Trees need grass or dirt'; if (m.trench && m.trench[i]) return 'Trench in the way'; return null; }
  return 'Unknown';
}

// ---------- planning a drag ----------
function terraLine(a, b) {   // 4-connected, so a canal is one body of water
  const pts = [{ x: a.x, y: a.y }]; let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
  let err = 0;
  while ((x !== b.x || y !== b.y) && pts.length < TERRA.maxLine) {
    if (dx >= dy) { x += sx; err += dy; if (err * 2 >= dx && y !== b.y) { pts.push({ x, y }); y += sy; err -= dx; } }
    else { y += sy; err += dx; if (err * 2 >= dy && x !== b.x) { pts.push({ x, y }); x += sx; err -= dy; } }
    pts.push({ x, y });
  }
  const seen = new Set(), out = [];
  for (const p of pts) { const k = p.x + ',' + p.y; if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}
function terraRect(a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (out.length < TERRA.maxArea) out.push({ x, y });
  return out;
}
// Walk the tiles in order and mark each as workable. Canals chain: a tile counts once its neighbour is (or will be) water.
function terraEvaluate(op, tiles) {
  const m = W.map, sim = new Set(), res = [];
  for (const q of tiles) {
    const c = terraCheck(op, q.x, q.y, sim);
    res.push(c);
    if (op === 'canal' && c === null) sim.add(m.idx(q.x, q.y));
  }
  return res;
}
function terraPlan(op, a, b) {
  const shape = TERRA_OPS[op].shape;
  let tiles = shape === 'line' ? terraLine(a, b) : terraRect(a, b);
  let ev = terraEvaluate(op, tiles);
  if (op === 'canal') {   // allow dragging from the inland end toward the shore
    const rev = tiles.slice().reverse(), ev2 = terraEvaluate(op, rev);
    if (ev2.filter(c => c === null).length > ev.filter(c => c === null).length) { tiles = rev; ev = ev2; }
  }
  const keep = tiles.filter((q, i) => ev[i] === null);
  const why = ev.find(c => c && c !== 'wait') || (ev.some(c => c === 'wait') ? 'A canal must start at the water\'s edge' : '');
  return { tiles, ev, keep, why };
}

// ---------- applying ----------
function terraTouch(x, y) {
  const d = W.terraDirty || (W.terraDirty = { x0: x, y0: y, x1: x, y1: y });
  d.x0 = Math.min(d.x0, x); d.y0 = Math.min(d.y0, y); d.x1 = Math.max(d.x1, x); d.y1 = Math.max(d.y1, y);
}
function terraFlush() {
  const d = W.terraDirty; if (!d) return; W.terraDirty = null;
  const m = W.map;
  m.computeVH(); m.computeRegions();
  if (typeof R !== 'undefined') { R.mapVersion = m.version; if (typeof invalidateTiles === 'function') invalidateTiles(d.x0 - 2, d.y0 - 2, d.x1 + 2, d.y1 + 2); }
}
function terraNudgeUnits(x, y) {
  for (const u of W.list) {
    if (u.kind !== 'unit' || u.dying || u.dead || u.inside || UNITS[u.type].naval) continue;
    if ((u.x | 0) !== x || (u.y | 0) !== y) continue;
    const m = W.map;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy; if (!m.inb(nx, ny) || isWaterT(m.ter[m.idx(nx, ny)]) || m.blk[m.idx(nx, ny)]) continue;
      u.x = nx + 0.5; u.y = ny + 0.5; u.path = null; break;
    }
  }
}
// Returns null on success, or a message.
function terraApply(op, x, y, p, sim) {
  const m = W.map, i = m.idx(x, y), n = m.n;
  const err = terraCheck(op, x, y, sim); if (err) return err === 'wait' ? 'wait' : err;
  if (op === 'canal') {
    m.ter[i] = T.WATER; m.elev[i] = 0; if (m.trench) m.trench[i] = 0;
    terraNudgeUnits(x, y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!m.inb(nx, ny)) continue;
      const j = m.idx(nx, ny); if (isWaterT(m.ter[j])) continue;
      m.elev[j] = Math.min(m.elev[j], 1);
      if (!dx !== !dy && !m.blk[j] && (m.ter[j] === T.GRASS || m.ter[j] === T.DIRT)) m.ter[j] = T.SAND;
    }
  } else if (op === 'trench') {
    if (!m.trench) m.trench = new Uint8Array(n * n);
    m.trench[i] = 1; if (m.ter[i] !== T.SAND) m.ter[i] = T.DIRT;
  } else if (op === 'raise') {
    if (p.res.stone < TERRA.raiseStone) return `Need ${TERRA.raiseStone} stone`;
    p.res.stone -= TERRA.raiseStone; m.elev[i] += 1;
  } else if (op === 'lower' || op === 'dig') {
    m.elev[i] -= 1; p.res.stone += TERRA.digStone;
    if (p.id === W.humanId && typeof emitFx === 'function') emitFx('goldspark', x + 0.5, y + 0.5, 1);
  } else if (op === 'plant') {
    const e = spawnRes('tree', x, y, (Math.random() * 2) | 0); if (!e) return 'Cannot plant here';
    e.max = 100; e.amount = 20; e.sap = 1;
    if (m.ter[i] === T.GRASS) m.ter[i] = T.FOREST;
  }
  terraTouch(x, y);
  return null;
}

// ---------- the villager order ----------
function terraJob(op, tiles) {
  const job = { op, tiles: tiles.map(q => ({ x: q.x, y: q.y, done: false, failed: false, by: 0 })), msgd: false, sim: null };
  // A canal may be dug by several villagers at once, so a tile only has to touch water or another tile of the same job.
  if (op === 'canal') job.sim = new Set(tiles.map(q => W.map.idx(q.x, q.y)));
  return job;
}
function terraClaimed(job, q) {
  if (!q.by) return false;
  const u = ent(q.by);
  if (u && !u.dying && !u.dead && u.order && u.order.job === job && u.terraQ === q) return true;
  q.by = 0; return false;
}
function terraNextTile(job, u) {
  for (const q of job.tiles) {
    if (q.done || q.failed || terraClaimed(job, q)) continue;
    const c = terraCheck(job.op, q.x, q.y, job.sim);
    if (c === null) return q;
    if (c !== 'wait') q.failed = true;
  }
  return null;
}
function terraPending(job) { return job.tiles.some(q => !q.done && !q.failed); }
function terraLogic(u, dt) {
  const o = u.order, job = o.job;
  if (!job || !TERRA.enabled) { setOrder(u, null); return; }
  const p = W.players[u.owner];
  let q = u.terraQ && u.terraJob === job ? u.terraQ : null;
  if (q && (q.done || q.failed)) q = u.terraQ = null;
  if (!q) {
    q = terraNextTile(job, u);
    if (!q) {
      if (!terraPending(job)) { setOrder(u, null); return; }
      o.wait = (o.wait || 0) + dt; u.anim = 'idle';
      if (o.wait > 20) setOrder(u, null);
      return;
    }
    o.wait = 0; q.by = u.id; u.terraQ = q; u.terraJob = job; u.terraProg = 0; u.path = null; u.tfail = 0;
  }
  const chk = terraCheck(job.op, q.x, q.y, job.sim);
  if (chk) { if (chk !== 'wait') q.failed = true; q.by = 0; u.terraQ = null; return; }
  const dx = Math.max(q.x - u.x, 0, u.x - (q.x + 1)), dy = Math.max(q.y - u.y, 0, u.y - (q.y + 1)), dist = Math.hypot(dx, dy);
  if (dist > 1.2) {
    if (!u.path || u.pi >= u.path.length) {
      pathTo(u, { x0: q.x, y0: q.y, x1: q.x, y1: q.y }, 1);
      if (!u.pathOk && dist > 2.5) { u.tfail = (u.tfail || 0) + 1; if (u.tfail > 3) { q.failed = true; q.by = 0; u.terraQ = null; return; } }
    }
    followPath(u, dt); return;
  }
  u.path = null; setFacing(u, q.x + 0.5 - u.x, q.y + 0.5 - u.y);
  u.anim = 'work'; u.work = { kind: job.op === 'raise' ? 'build' : job.op === 'plant' ? 'forage' : 'mine' };
  u.terraProg += dt / TERRA.secs[job.op] * (p ? p.buildSpeed || 1 : 1) * (p && p.ai ? p.ai.gatherMul : 1);
  u.workBeat = (u.workBeat || 0) + dt;
  if (u.workBeat > 0.6) { u.workBeat = 0; emitFx('dirt', q.x + 0.5, q.y + 0.5, 2); Sound.play(job.op === 'plant' ? 'forage' : 'mine', q.x, q.y); }
  if (u.terraProg < 1) return;
  const err = terraApply(job.op, q.x, q.y, p, job.sim);
  u.terraProg = 0;
  if (err === 'wait') { q.by = 0; u.terraQ = null; return; }
  if (err) {
    q.failed = true; q.by = 0; u.terraQ = null;
    if (u.owner === W.humanId && !job.msgd) { job.msgd = true; msg(err + '.', '#fc8'); }
    return;
  }
  if ((job.op === 'dig') && W.map.elev[W.map.idx(q.x, q.y)] > 0) return;   // keep digging this tile
  q.done = true; q.by = 0; u.terraQ = null;
}
function terraOrder(units, op, tiles) {
  const job = terraJob(op, tiles);
  for (const u of units) setOrder(u, { t: 'terra', job });
  return job;
}

// ---------- engine hooks ----------
if (typeof worldTick === 'function') {
  const _wt = worldTick;
  worldTick = function (dt) {
    _wt(dt);
    if (!W.map) return;
    terraFlush();
    W.saplAcc = (W.saplAcc || 0) + dt;
    if (W.saplAcc >= 1) {
      const d = W.saplAcc; W.saplAcc = 0;
      for (const e of W.list) if (e.kind === 'res' && e.sap) { e.amount = Math.min(e.max, e.amount + e.max * d / TERRA.saplingSecs); if (e.amount >= e.max) e.sap = 0; }
    }
  };
}
if (typeof unitPass === 'function') {
  const _up = unitPass;
  unitPass = function (u) {
    const base = _up(u), m = W.map, d = UNITS[u.type];
    if (!m.trench || d.naval || !(d.tags.includes('mounted') || d.tags.includes('siege') || d.tags.includes('trade'))) return base;
    const tr = m.trench, here = (u.y | 0) * m.n + (u.x | 0);
    return i => base(i) && (!tr[i] || i === here);
  };
}
if (typeof statU === 'function') {
  const _st = statU;
  statU = function (u, k) {
    const v = _st(u, k), m = W.map;
    if (!m || !m.trench || (k !== 'speed' && k !== 'pa') || !u || u.kind !== 'unit') return v;
    const d = UNITS[u.type]; if (!d || d.naval || !m.trench[(u.y | 0) * m.n + (u.x | 0)]) return v;
    return k === 'speed' ? v - (d.speed + v) * TERRA.trenchSlow : v + TERRA.trenchArmor;   // followPath moves at d.speed + statU(u,'speed')
  };
}
if (typeof drawTile === 'function') {
  const _dt = drawTile;
  drawTile = function (g, map, x, y) {
    _dt(g, map, x, y);
    if (!map.trench || !map.trench[y * map.n + x]) return;
    const N = map.n + 1, h = (dx, dy) => map.vh[(y + dy) * N + x + dx];
    const p = [iso(x, y, h(0, 0)), iso(x + 1, y, h(1, 0)), iso(x + 1, y + 1, h(1, 1)), iso(x, y + 1, h(0, 1))];
    const cx = (p[0].x + p[2].x) / 2, cy = (p[0].y + p[2].y) / 2, k = 0.28;
    const q = p.map(a => ({ x: a.x + (cx - a.x) * k, y: a.y + (cy - a.y) * k }));
    g.beginPath(); g.moveTo(q[0].x, q[0].y); for (let i = 1; i < 4; i++) g.lineTo(q[i].x, q[i].y); g.closePath();
    g.fillStyle = 'rgba(38,24,12,0.62)'; g.fill();
    g.strokeStyle = 'rgba(200,170,120,0.55)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(q[0].x, q[0].y); g.lineTo(q[1].x, q[1].y); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.stroke();
  };
}
if (typeof worldTick === 'function' && typeof updateUnit === 'function') { /* order dispatch lives in world.js: case 'terra' */ }

// ---------- UI ----------
function terraVillagers() { return UI.selection.filter(u => u.kind === 'unit' && u.owner === W.humanId && u.type === 'villager' && !u.dying); }
if (typeof commandsFor === 'function') {
  const _cf = commandsFor;
  commandsFor = function (sel) {
    const vs = sel.length && sel[0].kind === 'unit' && sel[0].owner === W.humanId && sel.some(u => u.type === 'villager');
    if (!vs || !TERRA.enabled) return _cf(sel);
    if (UI.page === 'terra') {
      const cmds = [];
      for (const op of Object.keys(TERRA_OPS)) {
        const d = TERRA_OPS[op];
        cmds.push({ key: d.key, icon: 'terra:' + op, name: d.name, desc: d.desc, fn: () => { UI.mode = { t: 'terra', op, start: null }; UI.page = 'terra'; } });
      }
      cmds.push({ key: 'Escape', label: 'Esc', icon: 'stop', name: 'Back', desc: 'Return to villager commands', fn: () => { UI.page = 'main'; UI.mode = null; } });
      return cmds;
    }
    const cmds = _cf(sel);
    if (UI.page === 'main') cmds.splice(Math.max(0, cmds.length - 2), 0, { key: 'N', icon: 'terra:dig', name: 'Terraform', desc: 'Dig canals and trenches, raise or lower ground, dig mountains, plant trees.', fn: () => { UI.page = 'terra'; } });
    return cmds;
  };
}
if (typeof iconFor === 'function') {
  const _if = iconFor;
  iconFor = function (key) {
    if (typeof key !== 'string' || !key.startsWith('terra:')) return _if(key);
    if (ICONS.has(key)) return ICONS.get(key);
    const op = key.slice(6), cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#5a4a36'); grd.addColorStop(1, '#2a2218'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.translate(32, 34); g.lineJoin = 'round'; g.lineCap = 'round';
    const slab = (c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(0, -12); g.lineTo(24, 0); g.lineTo(0, 12); g.lineTo(-24, 0); g.closePath(); g.fill(); g.strokeStyle = c2; g.lineWidth = 1.5; g.stroke(); };
    if (op === 'canal') { slab('#7a9a4a', '#3a4a22'); g.fillStyle = '#3a8fc0'; g.beginPath(); g.moveTo(-14, -2); g.lineTo(10, -14); g.lineTo(14, -12); g.lineTo(-10, 0); g.closePath(); g.fill(); g.strokeStyle = '#bfe6ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, -3); g.lineTo(8, -11); g.stroke(); }
    else if (op === 'trench') { slab('#8a7a52', '#4a3a22'); g.fillStyle = '#2a1a0c'; g.beginPath(); g.moveTo(-14, -2); g.lineTo(10, -14); g.lineTo(14, -12); g.lineTo(-10, 0); g.closePath(); g.fill(); g.strokeStyle = '#c8a870'; g.lineWidth = 1.5; g.stroke(); }
    else if (op === 'raise') { slab('#7a9a4a', '#3a4a22'); g.fillStyle = '#9a8a6a'; g.beginPath(); g.moveTo(-14, 2); g.lineTo(0, -12); g.lineTo(14, 2); g.closePath(); g.fill(); g.strokeStyle = '#ffe9a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 14); g.lineTo(0, -4); g.moveTo(-6, 2); g.lineTo(0, -4); g.lineTo(6, 2); g.stroke(); }
    else if (op === 'lower') { slab('#8a7a52', '#4a3a22'); g.strokeStyle = '#ffe9a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 6); g.moveTo(-6, 0); g.lineTo(0, 6); g.lineTo(6, 0); g.stroke(); }
    else if (op === 'dig') { g.fillStyle = '#8d8478'; g.beginPath(); g.moveTo(-22, 12); g.lineTo(-6, -14); g.lineTo(2, -4); g.lineTo(10, -16); g.lineTo(24, 12); g.closePath(); g.fill(); g.strokeStyle = '#c8bca8'; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = '#d9c070'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -12); g.lineTo(14, 10); g.stroke(); g.beginPath(); g.moveTo(4, -2); g.lineTo(20, -2); g.stroke(); }
    else { slab('#7a9a4a', '#3a4a22'); g.fillStyle = '#6b4a2a'; g.fillRect(-2, -4, 4, 14); g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(0, -8, 11, 0, 6.3); g.fill(); g.fillStyle = '#5faa4a'; g.beginPath(); g.arc(-3, -11, 5, 0, 6.3); g.fill(); }
    const url = cv.toDataURL(); ICONS.set(key, url); return url;
  };
}
function terraClick(t) {
  const m = UI.mode, vs = terraVillagers();
  if (!vs.length) { UI.mode = null; return; }
  const q = { x: Math.floor(t.x), y: Math.floor(t.y) };
  if (!m.start) { m.start = q; return; }
  const plan = terraPlan(m.op, m.start, q);
  m.start = null;
  if (!plan.keep.length) { msg((plan.why || 'Nothing to do there') + '.', '#fc8'); return; }
  terraOrder(vs, m.op, plan.keep);
  Sound.speak(vs[0], 'build');
  UI.flash = { x: q.x + 0.5, y: q.y + 0.5, t: performance.now(), col: '#4f4' };
  msg(`${TERRA_OPS[m.op].name}: ${plan.keep.length} tile${plan.keep.length > 1 ? 's' : ''}${plan.keep.length < plan.tiles.length ? ` (${plan.tiles.length - plan.keep.length} skipped)` : ''}.`, '#cfc');
}
if (typeof handleModeClick === 'function') {
  const _hmc = handleModeClick;
  handleModeClick = function (sx, sy, t, e) {
    if (UI.mode && UI.mode.t === 'terra') { terraClick(t); if (!UI.mode.start && !e.shiftKey) { UI.mode = null; } return; }
    return _hmc(sx, sy, t, e);
  };
}
if (typeof drawOverlays === 'function') {
  const _do = drawOverlays;
  drawOverlays = function (ctx) {
    _do(ctx);
    const m = UI.mode; if (!m || m.t !== 'terra' || !W || !UI.mouse.inCanvas) return;
    const t = screenToTile(UI.mouse.x, UI.mouse.y), cur = { x: Math.floor(t.x), y: Math.floor(t.y) };
    const plan = m.start ? terraPlan(m.op, m.start, cur) : { tiles: [cur], ev: terraEvaluate(m.op, [cur]), keep: [], why: '' };
    camTransform(ctx);
    plan.tiles.forEach((q, i) => {
      const c = plan.ev[i], h = W.map.h(q.x + 0.5, q.y + 0.5);
      const a = iso(q.x, q.y, h), b = iso(q.x + 1, q.y, h), d = iso(q.x + 1, q.y + 1, h), e = iso(q.x, q.y + 1, h);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.lineTo(e.x, e.y); ctx.closePath();
      ctx.fillStyle = c === null ? 'rgba(80,255,80,0.32)' : c === 'wait' ? 'rgba(255,220,60,0.28)' : 'rgba(255,60,60,0.35)'; ctx.fill();
      ctx.strokeStyle = c === null ? '#4f4' : c === 'wait' ? '#fd4' : '#f55'; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    const first = plan.ev[plan.ev.length - 1];
    const label = `${TERRA_OPS[m.op].name}${m.start ? ` · ${plan.keep.length}/${plan.tiles.length} tiles` : ' · click the first tile'}${!m.start && first && first !== 'wait' ? ` (${first})` : ''}`;
    ctx.fillText(label, UI.mouse.x + 16, UI.mouse.y - 12);
  };
}
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (sel.length !== 1) return;
    const u = sel[0], info = document.querySelector('#selinfo .info');
    if (!info || u.kind !== 'unit' || !u.order || u.order.t !== 'terra') return;
    const job = u.order.job, left = job.tiles.filter(q => !q.done && !q.failed).length;
    info.insertAdjacentHTML('beforeend', `<div class="small dim">${TERRA_OPS[job.op].name}: ${left} tile${left === 1 ? '' : 's'} left</div>`);
  };
}
