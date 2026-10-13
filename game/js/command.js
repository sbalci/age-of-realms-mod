// ===== Realms mod, command & quality-of-life batch =====
// Shift-queued orders, formations, ranged accuracy, stuck-unit rescue, wall breaching, extra hotkeys,
// combat stances, resigning, villagers/monks fleeing melee. Loaded after terra.js, before main.js.
// Everything wraps engine globals; nothing in world.js/ui.js is rewritten.
// URL switches: ?queue=off ?formation=off ?accuracy=off ?rescue=off ?breach=off ?stances=off
//               ?resign=off (AI auto-resign) ?flee=off ?hotkeys=off
'use strict';
const CMD = {
  queue: true, formation: true, accuracy: true, rescue: true, breach: true, stances: true, autoresign: true, flee: true, hotkeys: true,
  // ranged accuracy (chance to hit a unit; buildings are always hit, splash weapons are unaffected)
  acc: { archer: 0.8, crossbow: 0.85, arbalest: 0.9, cavarcher: 0.6, skirmisher: 0.9, eskirm: 0.9, genoese: 0.85, chukonu: 0.75, conquistador: 0.75,
    axeman: 0.9, mameluke: 0.9, scorpion: 0.9, galley: 0.8, wargalley: 0.85, galleon: 0.9 },
  bldAcc: 0.8,                 // towers, castles, town centers
  missMin: 0.5, missMax: 1.5,  // tiles off target
  missFxLife: 40,              // seconds a stuck arrow stays listed in W.missFx
  speeds: [0.5, 1, 1.5, 2, 3],
  defLeash: 4,                 // defensive stance: chase at most this far from the guard spot
  pathFails: 4,                // failed paths in a row while standing still before the rescue check
  rescueRadius: 40,
  stanceNames: { aggressive: 'Aggressive', defensive: 'Defensive', ground: 'Stand Ground', noattack: 'No Attack' },
  capture: null,               // Set of units whose orders are being appended to their queue (shift)
  user: false,                 // a human-issued command is being executed
  flying: [],                  // projectiles that missed and are still in the air
  mouseShift: false,
};
if (typeof location !== 'undefined' && location.search) {
  const q = new URLSearchParams(location.search);
  for (const k of ['queue', 'formation', 'accuracy', 'rescue', 'breach', 'stances', 'flee', 'hotkeys']) if (q.get(k) === 'off') CMD[k] = false;
  if (q.get('resign') === 'off') CMD.autoresign = false;
}

// ---------- helpers ----------
function cmdMilitary(u) {
  if (!u || u.kind !== 'unit') return false;
  const d = UNITS[u.type];
  return !!d && d.atk > 0 && !d.animal && u.type !== 'villager' && u.type !== 'sapper' && !d.tags.includes('trade');
}
function cmdEndless(o) { return !o || o.t === 'gather' || o.t === 'farm' || o.t === 'trade' || o.t === 'follow' || (o.t === 'attack' && o.auto) || o.flee || o.defReturn; }
function cmdShiftHeld() { return CMD.forceShift !== undefined ? !!CMD.forceShift : !!(CMD.mouseShift || (typeof UI !== 'undefined' && UI.keys && UI.keys.has('Shift'))); }
// where an order "is" (for formations from the end of a queue and for waypoint drawing)
function cmdOrderPoint(o) {
  if (!o) return null;
  if (o.x !== undefined && o.y !== undefined) return { x: o.x, y: o.y };
  if (o.id) { const e = ent(o.id); if (e && !e.dead) return center(e); }
  if (o.job && o.job.tiles && o.job.tiles.length) { const q = o.job.tiles.find(t => !t.done && !t.failed) || o.job.tiles[0]; return { x: q.x + 0.5, y: q.y + 0.5 }; }
  return null;
}
function cmdVirtualPos(u) {
  if (CMD.capture && CMD.capture.has(u) && u.order && !cmdEndless(u.order)) {
    const q = u.queue || [];
    for (let i = q.length - 1; i >= 0; i--) { const p = cmdOrderPoint(q[i]); if (p) return p; }
    const p = cmdOrderPoint(u.order); if (p) return p;
  }
  return { x: u.x, y: u.y };
}
function cmdNext(u) {
  while (u.queue && u.queue.length) {
    const o = u.queue.shift();
    if (o.id && !ent(o.id) && o.t !== 'terra') continue;   // target gone
    setOrder(u, o);
    if (u.order) return true;
  }
  return false;
}
function cmdReach(u, t) {
  const d = UNITS[u.type];
  let r = (d.range || 0) + statU(u, 'range');
  if (r > 0 && d.range && t) { const c = center(t); if (W.map.elevAt(u.x, u.y) > W.map.elevAt(c.x, c.y)) r += 1; }
  return r > 0 ? r : 0.35;
}
// run fn as a human command; with shift held the orders are appended to each unit's queue
function cmdIssue(units, shift, fn) {
  const prevC = CMD.capture, prevU = CMD.user;
  CMD.user = true;
  if (shift && CMD.queue) CMD.capture = new Set(units);
  else { for (const u of units) if (u.kind === 'unit') { u.queue = []; u.defHome = null; } CMD.capture = null; }
  try { return fn(); } finally { CMD.capture = prevC; CMD.user = prevU; }
}

// ---------- 1. order queue (setOrder hook) & stance filter ----------
if (typeof setOrder === 'function') {
  const _setOrder = setOrder;
  setOrder = function (u, o) {
    if (u && u.kind === 'unit' && o) {
      if (CMD.capture && CMD.capture.has(u) && u.order && !cmdEndless(u.order)) {
        (u.queue || (u.queue = [])).push(Object.assign({}, o, { user: true }));
        return;
      }
      if (CMD.user) o.user = true;
      if (CMD.stances && u.stance && o.t === 'attack' && !o.user) {
        if (u.stance === 'noattack') return;
        if (u.stance === 'ground') { const t = ent(o.id); if (!t || distTo(u, t) > cmdReach(u, t) + 0.3) return; }
        if (u.stance === 'defensive' && !u.defHome) u.defHome = { x: o.ox !== undefined ? o.ox : u.x, y: o.oy !== undefined ? o.oy : u.y };
      }
    }
    return _setOrder.apply(this, arguments);
  };
}
// a finished construction hands over to the next queued order instead of auto-gathering
if (typeof afterBuild === 'function') {
  const _afterBuild = afterBuild;
  afterBuild = function (u, b) {
    if (u.queue && u.queue.length && b.owner === u.owner) { setOrder(u, null); return; }
    return _afterBuild.apply(this, arguments);
  };
}

// ---------- 2. formations ----------
function cmdRank(u) {
  const d = UNITS[u.type];
  if (d.tags.includes('siege') || u.type === 'monk' || !(d.atk > 0) || u.type === 'villager') return 2;
  if (d.range > 0) return 1;
  return 0;
}
function cmdSnap(u, x, y, used) {
  const map = W.map, pass = unitPass(u), naval = !!UNITS[u.type].naval;
  const regOf = (tx, ty) => (naval ? map.waterReg : map.landReg)[map.idx(tx, ty)];
  const ux = Math.max(0, Math.min(W.n - 1, u.x | 0)), uy = Math.max(0, Math.min(W.n - 1, u.y | 0));
  const myReg = regOf(ux, uy);
  const ok = (tx, ty) => map.inb(tx, ty) && pass(map.idx(tx, ty)) && (!myReg || regOf(tx, ty) === myReg);
  const tx0 = Math.floor(x), ty0 = Math.floor(y);
  if (ok(tx0, ty0)) return { x, y };
  for (let r = 1; r <= 6; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = tx0 + dx, ty = ty0 + dy; if (!ok(tx, ty)) continue;
      const k = ty * W.n + tx, d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y) + (used.get(k) || 0) * 0.6;
      if (d < bd) { bd = d; best = { x: tx, y: ty, k }; }
    }
    if (best) {
      const c = used.get(best.k) || 0; used.set(best.k, c + 1);
      const j = [[0, 0], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]][c % 5];
      return { x: best.x + 0.5 + j[0], y: best.y + 0.5 + j[1] };
    }
  }
  return { x, y };
}
// slots for a group: returns Map unit -> {x,y}
function cmdFormation(units, x, y) {
  const n = units.length, out = new Map();
  if (!n) return out;
  const pos = new Map(units.map(u => [u, cmdVirtualPos(u)]));
  let cx = 0, cy = 0; for (const u of units) { cx += pos.get(u).x; cy += pos.get(u).y; } cx /= n; cy /= n;
  let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy);
  if (l < 0.5) { dx = Math.SQRT1_2; dy = Math.SQRT1_2; } else { dx /= l; dy /= l; }
  const px = -dy, py = dx;
  const sp = Math.max(0.8, 2 * Math.max(...units.map(u => UNIT_R(u))) + 0.2);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
  const groups = [[], [], []]; for (const u of units) groups[cmdRank(u)].push(u);
  const rowsTot = groups.reduce((s, g) => s + Math.ceil(g.length / cols), 0);
  let row = 0;
  const used = new Map();
  for (const g of groups) {
    if (!g.length) continue;
    // slots of this rank: rows behind the previous rank, last row centred
    const slots = [];
    for (let i = 0; i < g.length; i++) {
      const r = row + Math.floor(i / cols), inRow = Math.min(cols, g.length - Math.floor(i / cols) * cols), c = i % cols;
      const lat = (c - (inRow - 1) / 2) * sp, fwd = ((rowsTot - 1) / 2 - r) * sp;
      slots.push({ x: x + px * lat + dx * fwd, y: y + py * lat + dy * fwd, r, lat });
    }
    row += Math.ceil(g.length / cols);
    // greedy nearest: each unit's spot in the moved group vs each slot, closest pairs first
    const pairs = [];
    for (const u of g) { const p = pos.get(u), ox = p.x - cx + x, oy = p.y - cy + y; slots.forEach((s, si) => pairs.push([Math.hypot(ox - s.x, oy - s.y), u, si])); }
    pairs.sort((a, b) => a[0] - b[0]);
    const taken = new Set(), done = new Set(), asg = new Map();
    for (const [, u, si] of pairs) { if (done.has(u) || taken.has(si)) continue; done.add(u); taken.add(si); asg.set(u, slots[si]); }
    // lateral sort within each row so nobody crosses a neighbour's path
    const byRow = new Map();
    for (const [u, s] of asg) { if (!byRow.has(s.r)) byRow.set(s.r, []); byRow.get(s.r).push([u, s]); }
    for (const list of byRow.values()) {
      const us = list.map(e => e[0]).sort((a, b) => ((pos.get(a).x - cx) * px + (pos.get(a).y - cy) * py) - ((pos.get(b).x - cx) * px + (pos.get(b).y - cy) * py));
      const ss = list.map(e => e[1]).sort((a, b) => a.lat - b.lat);
      us.forEach((u, i) => out.set(u, ss[i]));
    }
  }
  for (const u of units) { const s = out.get(u); out.set(u, cmdSnap(u, s.x, s.y, used)); }
  return out;
}
if (typeof orderMove === 'function') {
  const _orderMove = orderMove;
  orderMove = function (units, x, y) {
    if (!CMD.formation || units.length <= 1) return _orderMove.apply(this, arguments);
    const land = units.filter(u => !UNITS[u.type].naval), sea = units.filter(u => UNITS[u.type].naval);
    for (const grp of [land, sea]) {
      if (grp.length === 1) { _orderMove(grp, x, y); continue; }
      const slots = cmdFormation(grp, x, y);
      for (const u of grp) { const s = slots.get(u); setOrder(u, { t: 'move', x: s.x, y: s.y }); }
    }
  };
}

// ---------- 3. ranged accuracy ----------
function cmdAccuracy(src, t, p) {
  if (!t || t.kind !== 'unit' || p.blast) return 1;
  if (src.kind === 'bld') return CMD.bldAcc;
  if (src.type === 'villager') return 1;
  return CMD.acc[src.type] !== undefined ? CMD.acc[src.type] : 1;
}
if (typeof fireProjectile === 'function') {
  const _fireProjectile = fireProjectile;
  fireProjectile = function (src, t, type, dmgFn, extra) {
    const n0 = W.projs.length;
    const r = _fireProjectile.apply(this, arguments);
    if (!CMD.accuracy || W.projs.length !== n0 + 1) return r;
    const p = W.projs[n0];
    if (Math.random() < cmdAccuracy(src, t, p)) return r;
    const speed = p.dur > 0 && p.dist > 0 ? p.dist / p.dur : 8;
    const a = Math.random() * Math.PI * 2, d = CMD.missMin + Math.random() * (CMD.missMax - CMD.missMin);
    p.tx = Math.max(0.05, Math.min(W.n - 0.05, p.tx + Math.cos(a) * d)); p.ty = Math.max(0.05, Math.min(W.n - 0.05, p.ty + Math.sin(a) * d));
    p.dist = Math.hypot(p.tx - p.sx, p.ty - p.sy); p.dur = Math.max(0.1, p.dist / speed);
    p.miss = true; p.aim = p.target; p.target = 0;    // lands on the ground: no damage (a splash still bursts where it lands)
    CMD.flying.push(p);
    return r;
  };
}
if (typeof updateProjectiles === 'function') {
  const _updateProjectiles = updateProjectiles;
  updateProjectiles = function (dt) {
    const r = _updateProjectiles.apply(this, arguments);
    if (CMD.flying.length) {
      const live = new Set(W.projs);
      for (let i = CMD.flying.length - 1; i >= 0; i--) {
        const p = CMD.flying[i]; if (live.has(p)) continue;
        CMD.flying.splice(i, 1);
        const fx = { x: p.tx, y: p.ty, t: W.t, ang: Math.atan2(p.ty - p.sy, p.tx - p.sx), type: p.type, owner: p.owner, water: !!(W.map && W.map.isWater(p.tx | 0, p.ty | 0)) };
        (W.missFx || (W.missFx = [])).push(fx);
        if (W.missFx.length > 300) W.missFx.splice(0, W.missFx.length - 300);
        if (typeof window !== 'undefined' && typeof window.onArrowMiss === 'function') { try { window.onArrowMiss(fx); } catch (e) { console.warn(e); } }
      }
    }
    if (W.missFx && W.missFx.length && W.missFx[0].t < W.t - CMD.missFxLife) W.missFx = W.missFx.filter(f => f.t >= W.t - CMD.missFxLife);
    return r;
  };
}

// ---------- 4. stuck-unit rescue ----------
function cmdRegionSize(map, pass, sx, sy, cap) {
  const n = map.n, s = sy * n + sx; if (!pass(s)) return 0;
  const seen = new Set([s]), q = [s];
  while (q.length && seen.size < cap) {
    const k = q.pop(), x = k % n, y = (k / n) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (!map.inb(nx, ny)) continue;
      const j = ny * n + nx; if (seen.has(j) || !pass(j) || !map.canStep(x, y, nx, ny)) continue;
      seen.add(j); q.push(j);
    }
  }
  return seen.size;
}
// returns true if the unit was moved
function cmdRescue(u, quiet) {
  const map = W.map, pass = unitPass(u);
  const cx = Math.max(0, Math.min(W.n - 1, u.x | 0)), cy = Math.max(0, Math.min(W.n - 1, u.y | 0));
  const here = pass(map.idx(cx, cy));
  if (here && cmdRegionSize(map, pass, cx, cy, 40) >= 40) return false;
  let best = null, any = null;
  for (let r = 1; r <= CMD.rescueRadius && !best; r++) {
    let bd = 1e9;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = cx + i, y = cy + j; if (!map.inb(x, y) || !pass(map.idx(x, y))) continue;
      if (!any) any = { x, y };
      const d = Math.hypot(x + 0.5 - u.x, y + 0.5 - u.y);
      if (d < bd && cmdRegionSize(map, pass, x, y, 40) >= 40) { bd = d; best = { x, y }; }
    }
  }
  const to = best || (!here ? any : null);
  if (!to) return false;
  u.x = to.x + 0.5; u.y = to.y + 0.5; u.path = null; u.stuck = 0; u._pf = 0;
  if (!quiet && u.order && (u.order.t === 'move' || u.order.t === 'attackmove')) moveToPoint(u, u.order.x, u.order.y);
  u.rescued = (u.rescued || 0) + 1;
  return true;
}
if (typeof pathTo === 'function') {
  const _pathTo = pathTo;
  pathTo = function (u, rect, r) {
    let ok = _pathTo.apply(this, arguments);
    // a failed path that cannot even start: if the unit is boxed into a tiny pocket, lift it out and retry
    if (!ok && CMD.rescue && u && u.kind === 'unit' && !u.inside && (!u.path || !u.path.length) && !UNITS[u.type].animal && !CMD.inRescue) {
      CMD.inRescue = true;
      try { if (cmdRescue(u, true)) ok = _pathTo.apply(this, arguments); } finally { CMD.inRescue = false; }
    }
    if (u && u.kind === 'unit') {
      if (!ok) {
        u._pfT = W.t;
        const still = u._pfX !== undefined && Math.hypot(u.x - u._pfX, u.y - u._pfY) < 0.3;
        u._pf = still && (!u.path || !u.path.length) ? (u._pf || 0) + 1 : (!u.path || !u.path.length ? 1 : 0);
        u._pfX = u.x; u._pfY = u.y;
      } else u._pf = 0;
    }
    return ok;
  };
}

// ---------- 5. wall breaching ----------
function cmdBreachable(owner, id) {
  const e = id && ent(id);
  return !!(e && e.kind === 'bld' && (BUILDINGS[e.type].wall || BUILDINGS[e.type].gate) && isEnemy(owner, e.owner)) ? e : null;
}
// path as if enemy walls were open; the first wall tile on it is what blocks us
function cmdFindBreach(u, rect, r) {
  const map = W.map, base = unitPass(u);
  const pass = i => base(i) || !!cmdBreachable(u.owner, map.blk[i]);
  const res = findPath(map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, pass);
  if (!res.ok) return null;
  let px = u.x, py = u.y;
  for (const q of res.pts) {
    const steps = Math.max(1, Math.ceil(Math.hypot(q.x - px, q.y - py) / 0.2));
    for (let s = 1; s <= steps; s++) {
      const x = px + (q.x - px) * s / steps, y = py + (q.y - py) * s / steps;
      if (!map.inb(x | 0, y | 0)) continue;
      const w = cmdBreachable(u.owner, map.blk[map.idx(x | 0, y | 0)]); if (w) return w;
    }
    px = q.x; py = q.y;
  }
  return null;
}
function cmdBreachCheck(u) {
  const o = u.order;
  if (!o || (o.t !== 'attack' && o.t !== 'attackmove') || o.breach || u._pfT !== W.t) return;
  if (W.t - (u._brT || -99) < 2) return;
  const d = UNITS[u.type]; if (d.naval) return;
  const map = W.map, end = u.path && u.path.length ? u.path[u.path.length - 1] : { x: u.x, y: u.y };
  let rect, r, gc;
  if (o.t === 'attack') {
    const t = ent(o.id); if (!t || (t.kind === 'bld' && (BUILDINGS[t.type].wall || BUILDINGS[t.type].gate))) return;
    const reach = cmdReach(u, t);
    if (distTo(end, t) <= reach + 1.5) return;              // the path gets us there: nothing in the way
    rect = rectOf(t); r = Math.max(t.kind === 'unit' ? 0 : 1, Math.min(6, Math.floor(reach > 0.35 ? reach : 0))); gc = center(t);
  } else {
    if (Math.hypot(end.x - o.x, end.y - o.y) <= 3.5) return;
    rect = { x0: o.x | 0, y0: o.y | 0, x1: o.x | 0, y1: o.y | 0 }; r = 3; gc = { x: o.x, y: o.y };
  }
  const gx = Math.max(0, Math.min(W.n - 1, gc.x | 0)), gy = Math.max(0, Math.min(W.n - 1, gc.y | 0));
  if (map.landReg[map.idx(gx, gy)] && map.landReg[map.idx(gx, gy)] !== map.landReg[map.idx(u.x | 0, u.y | 0)]) return;   // across water: walls are not the problem
  u._brT = W.t;
  const w = cmdFindBreach(u, rect, r);
  if (!w || !canAttack(u, w)) return;
  setOrder(u, { t: 'attack', id: w.id, breach: true, user: o.user, then: Object.assign({}, o) });
  u.breaches = (u.breaches || 0) + 1;
}

// Melee reach fix (needed by breaching): pathTo() stops a melee attacker on a tile next to a building,
// whose centre can be up to ~1.4 tiles from the wall face, beyond the 0.35 melee reach, so swords and rams
// stood idle beside buildings forever. Step straight up to the face for the last bit.
if (typeof doAttack === 'function') {
  const _doAttack = doAttack;
  doAttack = function (u, t, dt) {
    if (t && t.kind === 'bld' && !(UNITS[u.type].range > 0) && !UNITS[u.type].selfDestruct) {
      const dist = distTo(u, t);
      if (dist > 0.35 && dist < 2.2 && (!u.path || u.pi >= u.path.length)) {
        const r = rectOf(t), qx = Math.max(r.x0, Math.min(r.x1 + 1, u.x)), qy = Math.max(r.y0, Math.min(r.y1 + 1, u.y));
        const l = Math.hypot(u.x - qx, u.y - qy) || 1, ax = qx + (u.x - qx) / l * 0.22, ay = qy + (u.y - qy) / l * 0.22;
        if (tilePassFor(u, ax, ay)) { u.path = [{ x: ax, y: ay }]; u.pi = 0; u.repathT = 0.8; }
      }
    }
    return _doAttack.apply(this, arguments);
  };
}

// ---------- 7. stances (tick) ----------
function cmdStanceTick(u) {
  const s = u.stance; if (!s || s === 'aggressive') return;
  const o = u.order;
  if (s === 'noattack') { if (o && o.t === 'attack' && !o.user) setOrder(u, null); return; }
  if (s === 'ground') {
    if (o && o.t === 'attack' && !o.user) { const t = ent(o.id); if (!t || t.dead || distTo(u, t) > cmdReach(u, t) + 0.3) { setOrder(u, null); u.path = null; } }
    return;
  }
  if (s === 'defensive') {
    const h = u.defHome;
    if (o && o.t === 'attack' && !o.user) {
      if (!h) u.defHome = { x: o.ox !== undefined ? o.ox : u.x, y: o.oy !== undefined ? o.oy : u.y };
      else if (Math.hypot(u.x - h.x, u.y - h.y) > CMD.defLeash) setOrder(u, { t: 'move', x: h.x, y: h.y, defReturn: true });
    } else if (!o && h) {
      if (Math.hypot(u.x - h.x, u.y - h.y) > 1.2) setOrder(u, { t: 'move', x: h.x, y: h.y, defReturn: true }); else u.defHome = null;
    } else if (o && !o.defReturn) u.defHome = null;
  }
}
if (typeof findTargetFor === 'function') {
  const _findTargetFor = findTargetFor;
  findTargetFor = function (u, range) {
    if (CMD.stances && u && u.stance && !(u.order && u.order.t === 'attackmove')) {
      if (u.stance === 'noattack') return null;
      if (u.stance === 'ground') range = Math.min(range, cmdReach(u, null) + 0.5);
      if (u.stance === 'defensive') range = Math.min(range, CMD.defLeash + cmdReach(u, null));
    }
    return _findTargetFor.call(this, u, range);
  };
}

// ---------- unit tick ----------
if (typeof updateUnit === 'function') {
  const _updateUnit = updateUnit;
  updateUnit = function (u, dt) {
    if (u.dead || u.dying || u.inside) return _updateUnit.apply(this, arguments);
    if (CMD.rescue && !UNITS[u.type].animal && ((W.tick + u.id) % 20 === 0 || (u._pf || 0) >= CMD.pathFails)) {
      const cx = u.x | 0, cy = u.y | 0;
      if ((u._pf || 0) >= CMD.pathFails || (W.map.inb(cx, cy) && !unitPass(u)(W.map.idx(cx, cy)))) { u._pf = 0; cmdRescue(u); }
    }
    if (!u.order && u.queue && u.queue.length) cmdNext(u);
    if (CMD.stances && u.stance && u.owner === W.humanId) cmdStanceTick(u);
    const r = _updateUnit.apply(this, arguments);
    if (u.dead || u.dying) return r;
    if (CMD.breach && u._pfT === W.t && cmdMilitary(u)) cmdBreachCheck(u);
    if (!u.order && u.queue && u.queue.length && !u.inside) cmdNext(u);
    return r;
  };
}

// ---------- 9. villagers & monks flee from melee ----------
// Only from enemy soldiers: wolves and boars are fought (or hunted) as before, since running from a faster wolf never ends.
function cmdFlee(t, src) {
  const ax = t.x - src.x, ay = t.y - src.y, l = Math.hypot(ax, ay) || 1;
  let tx = t.x + ax / l * 4.5, ty = t.y + ay / l * 4.5;
  for (let k = 0; k < 6 && !tilePassFor(t, tx, ty); k++) { const a = Math.atan2(ay, ax) + (k % 2 ? 1 : -1) * (0.5 + 0.4 * k); tx = t.x + Math.cos(a) * 4; ty = t.y + Math.sin(a) * 4; }
  const prev = t.order;
  if (prev && !prev.flee) (t.queue || (t.queue = [])).unshift(Object.assign({}, prev));
  t.fleeAt = W.t;
  const pc = CMD.capture, pu = CMD.user; CMD.capture = null; CMD.user = false;
  try { setOrder(t, { t: 'move', x: tx, y: ty, flee: true }); } finally { CMD.capture = pc; CMD.user = pu; }
}
if (typeof applyDamage === 'function') {
  const _applyDamage = applyDamage;
  applyDamage = function (t, dmg, src) {
    if (CMD.flee && t && t.kind === 'unit' && !t.dead && !t.dying && !t.inside && (t.type === 'villager' || t.type === 'monk') && t.hp > dmg
      && src && src.kind === 'unit' && !src.dead && src.owner > 0 && src.owner !== t.owner && !UNITS[src.type].animal && !(UNITS[src.type].range > 0) && !UNITS[src.type].naval) {
      const o = t.order;
      const fighting = o && (o.t === 'attack' || o.t === 'hunt' || o.t === 'convert' || o.t === 'garrison' || o.t === 'board' || o.flee);
      if (!fighting && W.t - (t.fleeAt || -99) > 1.5) cmdFlee(t, src);
    }
    return _applyDamage.apply(this, arguments);
  };
}

// ---------- 8. resign ----------
function cmdResign(pid) {
  const p = W.players[pid]; if (!p || !p.alive || p.resigned) return;
  p.resigned = true; p.alive = false;
  msg(`${p.name} has resigned`, pid === W.humanId ? '#f88' : (p.color && p.color.l) || '#fc8');
  for (const e of W.list.slice()) {
    if (e.owner !== pid || e.dead || e.dying) continue;
    if (e.kind === 'unit' && e.type === 'sheep') { e.owner = 0; continue; }
    if (e.kind === 'unit' || e.kind === 'bld') { if (e.kind === 'unit' && e.inside) { const box = ent(e.inside); if (box) { box.garrison = (box.garrison || []).filter(i => i !== e.id); if (box.cargo) box.cargo = box.cargo.filter(i => i !== e.id); } const c = box ? center(box) : e; e.x = c.x; e.y = c.y; e.inside = 0; } killEnt(e, null); }
  }
  recalcPop();
  if (pid === W.humanId) { if (!W.over) endGame(false); }
  else checkVictory();
}
function cmdShouldResign(ai) {
  const id = ai.id;
  let tc = 0, vills = 0, mil = 0;
  for (const e of W.list) {
    if (e.owner !== id || e.dying) continue;
    if (e.kind === 'bld' && e.type === 'tc') tc++;
    else if (e.kind === 'unit' && e.type === 'villager') vills++;
    else if (e.kind === 'unit' && cmdMilitary(e)) mil++;
  }
  return tc === 0 && vills === 0 && mil < 3;
}
if (typeof AIPlayer === 'function') {
  const _aiUpdate = AIPlayer.prototype.update;
  AIPlayer.prototype.update = function (dt) {
    if (CMD.autoresign && this.p.alive && W.t > 60) {
      this._rsT = (this._rsT || 0) + dt;
      if (this._rsT >= 5) { this._rsT = 0; if (cmdShouldResign(this)) { cmdResign(this.id); return; } }
    }
    return _aiUpdate.apply(this, arguments);
  };
}

// ---------- UI: command wrappers (shift queues; plain commands clear the queue) ----------
function cmdSelUnits() { return (typeof UI !== 'undefined' ? UI.selection : []).filter(e => e.kind === 'unit' && e.owner === W.humanId); }
if (typeof rightClick === 'function') {
  const _rightClick = rightClick;
  rightClick = function (sx, sy, t) { const self = this, a = arguments; return cmdIssue(cmdSelUnits(), cmdShiftHeld(), () => _rightClick.apply(self, a)); };
}
if (typeof issueMove === 'function') {
  const _issueMove = issueMove;
  issueMove = function (x, y) {
    if (CMD.user) return _issueMove.apply(this, arguments);          // already inside rightClick
    const self = this, a = arguments; return cmdIssue(cmdSelUnits(), cmdShiftHeld(), () => _issueMove.apply(self, a));
  };
}
if (typeof handleModeClick === 'function') {
  const _hmc = handleModeClick;
  handleModeClick = function (sx, sy, t, e) {
    const m = UI.mode;
    if (m && m.t === 'rally') return _hmc.apply(this, arguments);
    if (m && m.t === 'terra' && !m.start) return _hmc.apply(this, arguments);   // first click of a drag only marks the start
    const self = this, a = arguments; return cmdIssue(cmdSelUnits(), !!(e && e.shiftKey), () => _hmc.apply(self, a));
  };
}
if (typeof tryPlace === 'function') {
  const _tryPlace = tryPlace;
  tryPlace = function (t, shift) {
    const self = this, a = arguments;
    const builders = cmdSelUnits().filter(u => u.type === 'villager');
    if (BUILDINGS[UI.place.type].wall && !UI.place.start) return _tryPlace.apply(this, a);
    return cmdIssue(builders, !!shift, () => _tryPlace.apply(self, a));
  };
}

// ---------- UI: stances, stop, selection info ----------
function cmdSetStance(units, s) {
  for (const u of units) {
    if (!cmdMilitary(u)) continue;
    u.stance = s === 'aggressive' ? undefined : s; u.defHome = null;
    if (s === 'noattack' && u.order && u.order.t === 'attack' && !u.order.user) setOrder(u, null);
    if (s === 'defensive' && !u.order) u.defHome = { x: u.x, y: u.y };
  }
}
if (typeof commandsFor === 'function') {
  const _commandsFor = commandsFor;
  commandsFor = function (sel) {
    const cmds = _commandsFor.apply(this, arguments);
    if (!sel.length || sel[0].kind !== 'unit' || sel[0].owner !== W.humanId) return cmds;
    const stop = cmds.find(c => c.name === 'Stop');
    if (stop) { const f = stop.fn; stop.fn = () => { for (const u of sel) if (u.kind === 'unit') { u.queue = []; u.defHome = null; } f(); }; }
    if (CMD.stances && (UI.page === 'main') && sel.some(cmdMilitary)) {
      const cur = new Set(sel.filter(cmdMilitary).map(u => u.stance || 'aggressive'));
      const at = Math.max(0, cmds.findIndex(c => c.name === 'Stop'));
      const mk = (key, s, desc) => ({ key, icon: 'stance:' + s, name: CMD.stanceNames[s] + (cur.size === 1 && cur.has(s) ? ' (current)' : ''), desc, fn: () => { cmdSetStance(sel, s); msg(`Stance: ${CMD.stanceNames[s]}`, '#ccc'); } });
      cmds.splice(at, 0,
        mk('Z', 'aggressive', 'Attack any enemy in sight and chase it (default).'),
        mk('X', 'defensive', `Attack enemies that come close, chase at most ${CMD.defLeash} tiles, then return to the guard spot.`),
        mk('C', 'ground', 'Never move on their own: only attack enemies already within range.'),
        mk('F', 'noattack', 'Never attack on their own, not even when attacked. Direct orders still work.'));
    }
    return cmds;
  };
}
if (typeof renderCommands === 'function') {
  const _renderCommands = renderCommands;
  renderCommands = function () {
    // re-render the card when stances change
    const sel = UI.selection, k = sel.map(u => u.stance || '').join('');
    if (UI._cmdStK !== k) { UI._cmdStK = k; UI.panelKey = ''; }
    return _renderCommands.apply(this, arguments);
  };
}
if (typeof iconFor === 'function') {
  const _iconFor = iconFor;
  iconFor = function (key) {
    if (typeof key !== 'string' || !key.startsWith('stance:')) return _iconFor(key);
    if (ICONS.has(key)) return ICONS.get(key);
    const s = key.slice(7), cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#4a3a5a'); grd.addColorStop(1, '#221a2a'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    g.translate(32, 32); g.lineCap = 'round'; g.lineJoin = 'round';
    const sword = (rot, col) => { g.save(); g.rotate(rot); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 18); g.lineTo(0, -20); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#c9a050'; g.beginPath(); g.moveTo(-7, 10); g.lineTo(7, 10); g.stroke(); g.restore(); };
    const shield = () => { g.fillStyle = '#3a6ab0'; g.strokeStyle = '#dfe6f0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -20); g.lineTo(16, -14); g.quadraticCurveTo(16, 8, 0, 20); g.quadraticCurveTo(-16, 8, -16, -14); g.closePath(); g.fill(); g.stroke(); };
    if (s === 'aggressive') { sword(0.7, '#e8e8f0'); sword(-0.7, '#e8e8f0'); g.fillStyle = '#e04030'; g.beginPath(); g.arc(0, -2, 4, 0, 6.3); g.fill(); }
    else if (s === 'defensive') { shield(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-2, 6); g.lineTo(8, -6); g.stroke(); }
    else if (s === 'ground') { g.strokeStyle = '#d9c070'; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 20); g.lineTo(-8, -20); g.stroke(); g.fillStyle = '#c04030'; g.beginPath(); g.moveTo(-8, -20); g.lineTo(16, -12); g.lineTo(-8, -4); g.closePath(); g.fill(); g.fillStyle = '#6a5a3a'; g.fillRect(-20, 16, 40, 6); }
    else { sword(0.6, '#bbb'); g.strokeStyle = '#e03030'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 20, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(-14, -14); g.lineTo(14, 14); g.stroke(); }
    const url = cv.toDataURL(); ICONS.set(key, url); return url;
  };
}
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi.apply(this, arguments);
    const sel = UI.selection; if (!sel.length || sel[0].owner !== W.humanId || sel[0].kind !== 'unit') return;
    const box = document.querySelector('#selinfo'); if (!box) return;
    const parts = [];
    const mil = sel.filter(cmdMilitary);
    if (CMD.stances && mil.length) { const st = new Set(mil.map(u => u.stance || 'aggressive')); parts.push('Stance: ' + (st.size === 1 ? CMD.stanceNames[[...st][0]] : 'mixed')); }
    const q = sel.length === 1 ? (sel[0].queue || []).length : 0;
    if (q) parts.push(`${q} queued order${q > 1 ? 's' : ''} (shift)`);
    if (!parts.length) return;
    const html = parts.map(t => `<div class="small dim">${t}</div>`).join('');
    const info = box.querySelector('.info');
    if (info) info.insertAdjacentHTML('beforeend', html); else box.insertAdjacentHTML('beforeend', html);
  };
}
if (typeof orderLabel === 'function') {
  const _ol = orderLabel;
  orderLabel = function (u) { const o = u.order; if (o && o.flee) return 'Fleeing'; if (o && o.breach) return 'Breaching a wall'; if (o && o.defReturn) return 'Returning to guard spot'; return _ol.apply(this, arguments); };
}

// ---------- UI: queued waypoints ----------
if (typeof drawOverlays === 'function') {
  const _drawOverlays = drawOverlays;
  drawOverlays = function (ctx) {
    _drawOverlays.apply(this, arguments);
    if (!W || !UI.selection.length) return;
    const us = UI.selection.filter(u => u.kind === 'unit' && u.owner === W.humanId && u.queue && u.queue.length);
    if (!us.length) return;
    camTransform(ctx);
    ctx.save();
    for (const u of us.slice(0, 60)) {
      const pts = [];
      const p0 = cmdOrderPoint(u.order) || { x: u.x, y: u.y }; pts.push(p0);
      for (const o of u.queue) { const p = cmdOrderPoint(o); if (p) pts.push(p); }
      const sp = pts.map(p => iso(p.x, p.y, W.map.h(p.x, p.y)));
      ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(200,255,200,0.55)';
      ctx.beginPath(); sp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.setLineDash([]);
      sp.forEach((p, i) => { const o = i ? u.queue[i - 1] : u.order; ctx.fillStyle = o && (o.t === 'attack' || o.t === 'attackmove') ? '#ff6a5a' : '#9f9'; ctx.beginPath(); ctx.arc(p.x, p.y, i ? 2.6 : 2, 0, 6.3); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); });
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
}

// ---------- UI: speed indicator & resign button ----------
function cmdSetSpeed(dir) {
  const s = CMD.speeds, cur = W.speed || 1;
  let i = dir > 0 ? s.findIndex(v => v > cur + 1e-6) : (() => { let k = -1; s.forEach((v, j) => { if (v < cur - 1e-6) k = j; }); return k; })();
  if (i < 0) i = dir > 0 ? s.length - 1 : 0;
  W.speed = s[i];
  msg(`Game speed ×${W.speed}`, '#ccc');
  if (typeof updateTopbar === 'function' && typeof document !== 'undefined') updateTopbar();
}
if (typeof updateTopbar === 'function') {
  const _ut = updateTopbar;
  updateTopbar = function () {
    _ut.apply(this, arguments);
    let s = document.querySelector('#r-speed');
    if (!s) {
      const clock = document.querySelector('#clock'); if (!clock) return;
      s = document.createElement('div'); s.id = 'r-speed'; s.className = 'res'; s.title = 'Game speed (+ / − to change)'; s.style.cursor = 'pointer';
      s.onclick = e => cmdSetSpeed(e.shiftKey ? -1 : 1);
      clock.parentNode.insertBefore(s, clock.nextSibling);
    }
    const txt = `⏩ ×${W.speed || 1}`; if (s.textContent !== txt) s.textContent = txt;
  };
}
if (typeof openGameMenu === 'function') {
  const _ogm = openGameMenu;
  openGameMenu = function () {
    const r = _ogm.apply(this, arguments);
    const bb = document.querySelector('#modal .modal-btns');
    if (bb && W && !W.over && W.players[W.humanId].alive) {
      const b = document.createElement('button'); b.className = 'btn danger'; b.textContent = 'Resign'; b.id = 'btn-resign';
      b.onclick = () => {
        closeModal();
        openModal('Resign?', '<p>Do you really want to resign this game? Your civilization will be defeated.</p>', [
          ['Resign', () => { setTimeout(() => { UI.paused = false; cmdResign(W.humanId); }, 0); }],
          ['Cancel', () => { UI.paused = false; }]]);
      };
      bb.insertBefore(b, bb.lastChild);
    }
    return r;
  };
}

// ---------- 6. hotkeys ----------
function cmdKey(e) {
  if (!CMD.hotkeys || typeof UI === 'undefined' || !UI.gameRunning || !W || UI.chatOpen) return;
  const modal = document.querySelector('#modal'); if (modal && !modal.classList.contains('hidden')) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, cardHas = key => UI.cmds && UI.cmds.some(c => c.key === key);
  if (k === ',') {
    const idle = W.list.filter(u => u.kind === 'unit' && u.owner === W.humanId && cmdMilitary(u) && !u.order && !u.inside && !u.dying && !(u.queue && u.queue.length));
    if (idle.length) { UI.idleMilIdx = ((UI.idleMilIdx === undefined ? -1 : UI.idleMilIdx) + 1) % idle.length; const u = idle[UI.idleMilIdx]; selectEnts([u], false); centerCamOn(u.x, u.y); }
    else msg('No idle military units.', '#ccc');
    e.preventDefault(); return;
  }
  if (k === 'Home' || (k === ' ' && !UI.selection.length)) {
    const a = W.alerts[W.alerts.length - 1];
    if (a) centerCamOn(a.x, a.y); else if (k === 'Home') msg('No recent attack alerts.', '#ccc');
    e.preventDefault(); return;
  }
  if ((k === '+' || k === '=') && !cardHas('+')) { cmdSetSpeed(1); e.preventDefault(); return; }
  if ((k === '-' || k === '_') && !cardHas('-')) { cmdSetSpeed(-1); e.preventDefault(); return; }
  if ((k === 'm' || k === 'M') && !cardHas('M')) {
    if (typeof Sound !== 'undefined') { Sound.init && Sound.init(); if (Sound.musicOn) { Sound.stopMusic(); msg('Music off (M)', '#ccc'); } else { Sound.startMusic(); msg('Music on (M)', '#ccc'); } }
    e.preventDefault(); return;
  }
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', cmdKey);
  window.addEventListener('mousedown', e => { CMD.mouseShift = !!e.shiftKey; }, true);
  window.addEventListener('keyup', e => { if (e.key === 'Shift') CMD.mouseShift = false; });
}
