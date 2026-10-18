// ===== Entity index: spatial buckets and per-owner lists kept in step with W.list =====
// Loaded right after world.js. Trees and other resources are most of W.list on big maps, so code that scanned the
// whole list (the AI, resource searches, rendering, hit-testing) asks this index instead. Every query returns
// entities in W.list order (ascending id), so a caller that took the first match or sorted stably gets the same
// answer as the old scan.
// Upkeep: addEnt and removeEnt call idxAdd and idxRemove; owner changes go through idxSetOwner; units and relics
// move every tick and are refiled by idxSync (from rebuildGrid each tick and before every unit or relic query);
// anything else that moves an entity calls idxMoved. A new world or a replaced W.list is rebuilt on first use.
'use strict';
const IDX = {
  cell: 8,               // bucket side in tiles
  w: null, list: null,   // the world and the W.list array the buckets describe
  n: 0, cw: 0,           // map side and cells per side
  cells: new Map(),      // category -> Array(cw * cw) of Set, created on demand
  all: new Map(),        // category -> Set of every entity in it, in W.list order
  owned: [],             // owner -> { unit, bld, all, types: Map(building type -> []) }, every array sorted by id
  at: new Map(),         // entity -> { cat, cell, owner } where it is filed
  rev: new Map(),        // category -> count of adds and removes, so caches (the minimap tree layer) notice changes
  brute: false,          // tests: answer every query by scanning W.list, the reference the buckets must match
  fixes: 0,              // owner changes idxSync found that no idxSetOwner call reported; stays 0 in play
};
const IDX_NONE = Object.freeze([]);
const idxById = (a, b) => a.id - b.id;
// Categories: 'unit', 'bld', 'relic', and 'res:<type>' for resources ('res:tree', 'res:gold', ...).
function idxCat(e) { return e.kind === 'res' ? 'res:' + e.type : e.kind; }
function idxCellOf(x, y) {
  const c = IDX.cell, m = IDX.cw - 1;
  return Math.max(0, Math.min(m, (y / c) | 0)) * IDX.cw + Math.max(0, Math.min(m, (x / c) | 0));
}
function idxLive() { return !!(W && W.list && W.map) && IDX.w === W && IDX.list === W.list && IDX.n === W.n; }
// True when a real world is loaded; rebuilds the buckets first if they describe another world or list.
function idxEnsure() {
  if (!W || !W.list || !W.map) return false;
  if (!idxLive()) idxRebuild();
  return true;
}
function idxRebuild() {
  IDX.w = W; IDX.list = W.list; IDX.n = W.n; IDX.cw = Math.max(1, Math.ceil(W.n / IDX.cell));
  IDX.cells = new Map(); IDX.all = new Map(); IDX.owned = []; IDX.at = new Map(); IDX.fixes = 0;
  for (const k of IDX.rev.keys()) IDX.rev.set(k, IDX.rev.get(k) + 1);
  for (const e of W.list) idxPut(e);
}
// ---------- filing ----------
function idxInsert(a, e) {
  const id = e.id; let lo = 0, hi = a.length;
  if (!hi || a[hi - 1].id < id) { a.push(e); return; }
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].id < id) lo = m + 1; else hi = m; }
  if (a[lo] !== e) a.splice(lo, 0, e);
}
function idxDelete(a, e) {
  const id = e.id; let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].id < id) lo = m + 1; else hi = m; }
  if (a[lo] === e) a.splice(lo, 1);
}
function idxOwnerRec(o) { let r = IDX.owned[o]; if (!r) r = IDX.owned[o] = { unit: [], bld: [], all: [], types: new Map() }; return r; }
function idxFileOwner(e, owner) {
  if (e.kind !== 'unit' && e.kind !== 'bld') return;
  const r = idxOwnerRec(owner); idxInsert(r[e.kind], e); idxInsert(r.all, e);
  if (e.kind === 'bld') { let t = r.types.get(e.type); if (!t) r.types.set(e.type, t = []); idxInsert(t, e); }
}
function idxUnfileOwner(e, owner) {
  const r = IDX.owned[owner]; if (!r || (e.kind !== 'unit' && e.kind !== 'bld')) return;
  idxDelete(r[e.kind], e); idxDelete(r.all, e);
  if (e.kind === 'bld') { const t = r.types.get(e.type); if (t) idxDelete(t, e); }
}
function idxFileCell(cat, cell, e) {
  let a = IDX.cells.get(cat); if (!a) IDX.cells.set(cat, a = new Array(IDX.cw * IDX.cw));
  let s = a[cell]; if (!s) s = a[cell] = new Set(); s.add(e);
}
function idxUnfileCell(cat, cell, e) { const a = IDX.cells.get(cat), s = a && a[cell]; if (s) s.delete(e); }
function idxPut(e) {
  if (e.ghost || IDX.at.has(e)) return;   // fog-memory ghosts live in W.list only while a frame is drawn
  const cat = idxCat(e), cell = idxCellOf(e.x, e.y);
  IDX.at.set(e, { cat, cell, owner: e.owner });
  let all = IDX.all.get(cat); if (!all) IDX.all.set(cat, all = new Set()); all.add(e);
  idxFileCell(cat, cell, e); idxFileOwner(e, e.owner);
  IDX.rev.set(cat, (IDX.rev.get(cat) || 0) + 1);
}
// ---------- upkeep (called from world.js and the other owner-change and move sites) ----------
function idxAdd(e) {
  if (!W || !W.list || !W.map) return;
  if (!idxLive()) { idxRebuild(); return; }   // addEnt has already pushed e, so the rebuild files it
  idxPut(e);
}
function idxRemove(e) {
  if (!W || !W.list || !W.map) return;
  if (!idxLive()) { idxRebuild(); return; }   // removeEnt has already spliced e out
  const r = IDX.at.get(e); if (!r) return;
  IDX.at.delete(e); IDX.all.get(r.cat).delete(e); idxUnfileCell(r.cat, r.cell, e); idxUnfileOwner(e, r.owner);
  IDX.rev.set(r.cat, (IDX.rev.get(r.cat) || 0) + 1);
}
function idxSetOwner(e, owner) {
  const r = idxLive() ? IDX.at.get(e) : null;
  if (r && r.owner !== owner) { idxUnfileOwner(e, r.owner); r.owner = owner; idxFileOwner(e, owner); }
  e.owner = owner;
}
// A building or resource moved outside the simulation (the editor's drag): refile it.
function idxMoved(e) {
  if (!idxEnsure()) return;
  const r = IDX.at.get(e); if (!r) return;
  const cell = idxCellOf(e.x, e.y); if (cell === r.cell) return;
  idxUnfileCell(r.cat, r.cell, e); r.cell = cell; idxFileCell(r.cat, cell, e);
}
// Units and relics move during play: refile those that left their cell, and units whose owner changed without
// idxSetOwner (counted in IDX.fixes). O(units + relics).
function idxSync() {
  if (!idxEnsure()) return;
  for (const cat of ['unit', 'relic']) {
    const all = IDX.all.get(cat); if (!all) continue;
    for (const e of all) {
      const r = IDX.at.get(e), cell = idxCellOf(e.x, e.y);
      if (cell !== r.cell) { idxUnfileCell(cat, r.cell, e); r.cell = cell; idxFileCell(cat, cell, e); }
      if (r.owner !== e.owner) { IDX.fixes++; idxUnfileOwner(e, r.owner); r.owner = e.owner; idxFileOwner(e, e.owner); }
    }
  }
}
// ---------- queries ----------
// Every entity of a category, in W.list order. A live Set: do not add to it, and copy it before a loop that may
// add or remove entities.
function idxAll(cat) {
  if (IDX.brute || !idxEnsure()) return W && W.list ? W.list.filter(e => !e.ghost && idxCat(e) === cat) : IDX_NONE;
  return IDX.all.get(cat) || IDX_NONE;
}
// Units ('unit'), buildings ('bld') or both merged by id ('all') of one owner (0 = gaia), sorted by id.
// A live array: never mutate it, and copy it before a loop that may add or remove entities.
function idxOwned(owner, kind) {
  if (IDX.brute || !idxEnsure()) return W && W.list ? W.list.filter(e => !e.ghost && e.owner === owner && (kind === 'all' ? e.kind === 'unit' || e.kind === 'bld' : e.kind === kind)) : IDX_NONE;
  const r = IDX.owned[owner]; return r ? r[kind] : IDX_NONE;
}
// Number of finished buildings of a type that an owner has (the old builtCount scan).
function idxCount(owner, type) {
  let c = 0;
  if (IDX.brute || !idxEnsure()) { if (W && W.list) for (const e of W.list) if (!e.ghost && e.kind === 'bld' && e.owner === owner && e.type === type && e.built) c++; return c; }
  const r = IDX.owned[owner], a = r && r.types.get(type);
  if (a) for (const e of a) if (e.built) c++;
  return c;
}
// Pushes the category's entities whose position (e.x, e.y) lies in the rectangle (bounds included) onto out, unsorted.
function idxCollect(cat, x0, y0, x1, y1, out) {
  const a = IDX.cells.get(cat); if (!a) return;
  const c = IDX.cell, w = IDX.cw, m = w - 1;
  const cx0 = Math.max(0, Math.min(m, Math.floor(x0 / c))), cx1 = Math.max(0, Math.min(m, Math.floor(x1 / c)));
  const cy0 = Math.max(0, Math.min(m, Math.floor(y0 / c))), cy1 = Math.max(0, Math.min(m, Math.floor(y1 / c)));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const s = a[cy * w + cx]; if (!s) continue;
    for (const e of s) if (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e);
  }
}
// Entities of a category whose position (e.x, e.y) lies in the rectangle, bounds included, sorted by id.
function idxRect(cat, x0, y0, x1, y1) {
  const out = [];
  if (!idxEnsure()) return out;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && idxCat(e) === cat && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e); return out; }
  if (cat === 'unit' || cat === 'relic') idxSync();
  idxCollect(cat, x0, y0, x1, y1, out);
  if (out.length > 1) out.sort(idxById);
  return out;
}
// Entities of every category whose position lies in the rectangle, bounds included, sorted by id (W.list order).
function idxRectAll(x0, y0, x1, y1) {
  const out = [];
  if (!idxEnsure()) return out;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e); return out; }
  idxSync();
  for (const cat of IDX.cells.keys()) idxCollect(cat, x0, y0, x1, y1, out);
  if (out.length > 1) out.sort(idxById);
  return out;
}
// The entries at the end of W.list that the index does not hold: the fog-memory ghosts vicWithGhosts appends while a
// frame or the minimap is drawn. Drawing code adds them after the index's entities, where the old W.list loops met them.
function idxGhosts() {
  const L = W && W.list ? W.list : IDX_NONE; let g = L.length;
  while (g > 0 && L[g - 1].ghost) g--;
  return L.slice(g);
}
// Entities of a category whose position (e.x, e.y) is within r tiles of (x, y), sorted by id. Callers that measure
// from a centre (a resource tile's x + 0.5) pass r + 1 and keep their own exact test.
function idxNear(cat, x, y, r) {
  return idxRect(cat, x - r, y - r, x + r, y + r).filter(e => Math.hypot(e.x - x, e.y - y) <= r);
}
// Nearest-first walk for best-match searches. Visits the cells of the categories ring by ring around the cell that
// holds (x, y): ring 0 is that cell, ring k the cells k cells away. Before ring k (k >= 1) it calls
// more((k - 1) * IDX.cell), the least distance from (x, y) to any tile in that ring, and stops when more() returns
// false. visit(e) gets every entity in a visited cell in no fixed order, so callers break ties by id.
function idxWalk(cats, x, y, more, visit) {
  if (!idxEnsure()) return;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && cats.includes(idxCat(e))) visit(e); return; }
  if (cats.includes('unit') || cats.includes('relic')) idxSync();
  const arrays = []; for (const cat of cats) { const a = IDX.cells.get(cat); if (a) arrays.push(a); }
  if (!arrays.length) return;
  const c = IDX.cell, w = IDX.cw, m = w - 1, cx = Math.floor(x / c), cy = Math.floor(y / c);
  const kmax = Math.max(cx, m - cx, cy, m - cy);
  for (let k = 0; k <= kmax; k++) {
    if (k > 0 && !more((k - 1) * c)) return;
    for (let gy = cy - k; gy <= cy + k; gy++) {
      if (gy < 0 || gy > m) continue;
      const step = gy === cy - k || gy === cy + k ? 1 : 2 * k;
      for (let gx = cx - k; gx <= cx + k; gx += step) {
        if (gx < 0 || gx > m) continue;
        const i = gy * w + gx;
        for (const a of arrays) { const s = a[i]; if (s) for (const e of s) visit(e); }
      }
    }
  }
}
GameHooks.on('worldCreated', idxRebuild);
GameHooks.on('worldRestored', idxRebuild);
