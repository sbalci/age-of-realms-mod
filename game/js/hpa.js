// ===== Hierarchical pathfinding (HPA*): a cluster graph per movement class =====
// Loaded right after index.js. The map is cut into 16 × 16-tile clusters. Where two clusters touch, each run of open
// crossings (an entrance span) gets one transition, or two at its ends when it is 6 tiles or longer, and a crossing
// that only a diagonal step makes (at a cluster corner, or past a cliff corner) gets its own. The end tiles of the
// transitions are the graph's nodes. They are joined across the border (inter edges) and inside their cluster (intra
// edges: the cost of the best route that stays in the cluster, worked out the first time a search needs it).
// Moves follow findPath exactly: a step needs its target passable and canStep, and a diagonal step needs both side
// tiles passable. So the graph's components are the true connected areas. landReg is not: computeRegions joins tiles
// 4-way and misses the diagonal steps past cliff corners that findPath and movement allow, and it ignores buildings,
// trees and walls.
// Classes: 'land' (built gates count as open, since who may pass depends on the owner; the grid search applies the
// real rule), 'mounted' (land without trench tiles, for the mounted, siege and trade units terra.js keeps out of
// trenches; built only on maps that have trenches) and 'naval'.
// Upkeep: everything that changes passability calls hpaDirty(x0, y0, x1, y1); the clusters within a tile of the
// rectangle are rebuilt on the next query. A new map is built whole on its first query (a new or loaded match builds
// it at once: hpaWarm), and so is the live map after any computeRegions call except terraFlush's (tests and tools
// that edit the map by hand end with computeRegions).
// Switch: HPA.enabled (URL ?hpa=off / ?hpa=on). Off, findPath and orderMove behave exactly as they did before.
'use strict';
const HPA = {
  enabled: false,         // the switch: off, findPath and orderMove are the old ones (URL ?hpa=on / ?hpa=off)
  C: 16,                  // cluster side in tiles (pfGrid's corridor test and hpaCluster shift by 4)
  near: 24,               // a goal this close tries a bounded plain grid search first...
  nearNodes: 2000,        // ...of this many nodes; when that search finishes, its answer is exactly the old findPath's
  smooth: 64,             // smoothing looks at most this many chain points ahead
  weight: 1.001,          // corridor search: heuristic weight, so ties go to the tile nearer the goal
  map: null, g: {},       // the GameMap the graphs describe; class -> graph
  quiet: false,           // set by terraFlush around its computeRegions (terraTouch has dirtied the exact rectangle)
  joinNodes: 600,         // a group member's own search onto the shared route
  groupR: 12,             // units farther than this from their group's leader route on their own
  stats: { queries: 0, near: 0, routed: 0, unreachable: 0, fallback: 0, rebuilt: 0, groups: 0, shared: 0 },
};
if (typeof location !== 'undefined' && location.search) { const q = new URLSearchParams(location.search).get('hpa'); if (q === 'off') HPA.enabled = false; else if (q === 'on') HPA.enabled = true; }

// ---------- classes and passability ----------
function hpaClassOf(u) {
  const d = UNITS[u.type];
  if (d.naval) return 'naval';
  return W.map.trench && (d.tags.includes('mounted') || d.tags.includes('siege') || d.tags.includes('trade')) ? 'mounted' : 'land';
}
// The passability a class's graph is built on: the game's own passLand / passNaval (with terra.js's bridges), with
// built gates open and, for 'mounted', trench tiles closed.
function hpaPassFn(cls) {
  const map = W.map;
  if (cls === 'naval') return passNaval();
  const base = passLand(0), tr = cls === 'mounted' ? map.trench : null;
  return i => {
    if (tr && tr[i]) return false;
    if (base(i)) return true;
    const b = map.blk[i], e = b ? W.ents.get(b) : null;
    return !!(e && e.type === 'gate' && e.built);
  };
}

// ---------- the graph ----------
const hpaCluster = (G, t) => (((t / G.n) | 0) >> 4) * G.cw + ((t % G.n) >> 4);
// The graph of a class for the current map, with its dirty clusters rebuilt. null without a world.
function hpaGraph(cls) {
  if (!W || !W.map) return null;
  if (HPA.map !== W.map) { HPA.map = W.map; HPA.g = {}; }
  let G = HPA.g[cls];
  if (!G) {
    const n = W.map.n, cw = Math.ceil(n / HPA.C), cc = cw * cw;
    G = HPA.g[cls] = {
      cls, map: W.map, n, cw,
      P: new Uint8Array(n * n),            // passable for the class
      gt: new Uint8Array(n * n),           // built gate tiles: the only tiles where a unit's own rule can differ from P
      mv: new Uint8Array(n * n),           // bit d: the step (PF_DX[d], PF_DY[d]) from this tile is allowed
      lab: new Int16Array(n * n),          // connected area inside the tile's cluster (-1: not passable)
      ni: new Int16Array(n * n).fill(-1),  // index of a node tile in its cluster's node list
      comp: new Int32Array(n * n),         // component of a node tile (only node tiles are set)
      cl: Array.from({ length: cc }, () => ({ nodes: [], inter: [], cost: new Float64Array(0), row: new Uint8Array(0) })),
      vb: new Array(cc).fill(null), hb: new Array(cc).fill(null),   // transitions east and south of each cluster: [a, b, cost a→b, cost b→a, ...]
      cb: new Array(cc).fill(null), ca: new Array(cc).fill(null),   // diagonal transitions at the corner south-east of each cluster
      dirty: new Uint8Array(cc).fill(1), any: true,
      cm: new Uint32Array(cc), cstamp: 0,  // corridor marks for pfGrid
    };
  }
  if (G.any) hpaRebuild(G);
  return G;
}
// Something changed passability in the rectangle: rebuild the clusters within a tile of it on the next query.
function hpaDirty(x0, y0, x1, y1) {
  if (!W || HPA.map !== W.map) return;   // graphs of another map are rebuilt whole on their first query
  const C = HPA.C;
  for (const cls in HPA.g) {
    const G = HPA.g[cls], m = G.cw - 1;
    const cx0 = Math.max(0, Math.floor((x0 - 1) / C)), cx1 = Math.min(m, Math.floor((x1 + 1) / C));
    const cy0 = Math.max(0, Math.floor((y0 - 1) / C)), cy1 = Math.min(m, Math.floor((y1 + 1) / C));
    if (cx0 > cx1 || cy0 > cy1) continue;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) G.dirty[cy * G.cw + cx] = 1;
    G.any = true;
  }
}
function hpaDirtyAll() {
  if (!W || HPA.map !== W.map) return;
  for (const cls in HPA.g) { HPA.g[cls].dirty.fill(1); HPA.g[cls].any = true; }
}
function hpaMask(map, P, n, x, y) {
  let m = 0;
  for (let d = 0; d < 8; d++) {
    const nx = x + PF_DX[d], ny = y + PF_DY[d];
    if (nx < 0 || ny < 0 || nx >= n || ny >= n || !P[ny * n + nx] || !map.canStep(x, y, nx, ny)) continue;
    if (d >= 4 && (!P[y * n + nx] || !P[ny * n + x])) continue;
    m |= 1 << d;
  }
  return m;
}
function hpaRebuild(G) {
  const { map, n, cw, P, mv } = G, C = HPA.C, pass = hpaPassFn(G.cls), dirty = [];
  for (let k = 0; k < cw * cw; k++) if (G.dirty[k]) dirty.push(k);
  // Passability first, then the move masks: a mask reads the neighbours' passability, and a change dirties every
  // cluster within a tile of it, so every mask that can change lies in a dirty cluster.
  for (const k of dirty) {
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C), y1 = Math.min(n, y0 + C);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * n + x, b = map.blk[i], e = b ? W.ents.get(b) : null;
      P[i] = pass(i) ? 1 : 0; G.gt[i] = P[i] && e && e.type === 'gate' ? 1 : 0;
    }
  }
  for (const k of dirty) { const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C), y1 = Math.min(n, y0 + C); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mv[y * n + x] = hpaMask(map, P, n, x, y); hpaLabel(G, k); }
  // the borders and corners of every dirty cluster, then the node lists of every cluster they touch
  const vb = new Set(), hb = new Set(), cr = new Set(), touched = new Set(dirty);
  for (const k of dirty) {
    const cx = k % cw, cy = (k / cw) | 0;
    if (cx + 1 < cw) vb.add(k); if (cx > 0) vb.add(k - 1);
    if (cy + 1 < cw) hb.add(k); if (cy > 0) hb.add(k - cw);
    for (const [qx, qy] of [[cx, cy], [cx - 1, cy], [cx, cy - 1], [cx - 1, cy - 1]]) if (qx >= 0 && qy >= 0 && qx + 1 < cw && qy + 1 < cw) cr.add(qy * cw + qx);
  }
  for (const k of vb) { G.vb[k] = hpaBorder(G, k, true); touched.add(k + 1); }
  for (const k of hb) { G.hb[k] = hpaBorder(G, k, false); touched.add(k + cw); }
  for (const k of cr) { hpaCorner(G, k); touched.add(k + 1); touched.add(k + cw); touched.add(k + cw + 1); }
  for (const k of [...touched].sort((a, b) => a - b)) hpaNodes(G, k);
  hpaComponents(G);
  G.dirty.fill(0); G.any = false;
  HPA.stats.rebuilt += dirty.length;
}
// Connected areas inside cluster k (the same moves, kept inside the cluster).
function hpaLabel(G, k) {
  const { n, cw, mv, P, lab } = G, C = HPA.C, x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C) - 1, y1 = Math.min(n, y0 + C) - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) lab[y * n + x] = -1;
  let next = 0; const st = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * n + x; if (!P[i] || lab[i] >= 0) continue;
    lab[i] = next; st.push(i);
    while (st.length) {
      const c = st.pop(), cx = c % n, cy = (c / n) | 0, m = mv[c];
      for (let d = 0; d < 8; d++) {
        if (!((m >> d) & 1)) continue;
        const nx = cx + PF_DX[d], ny = cy + PF_DY[d];
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const j = ny * n + nx; if (lab[j] < 0) { lab[j] = next; st.push(j); }
      }
    }
    next++;
  }
}
function hpaTrans(G, out, a, b, step) {
  const e = G.map.elev;
  out.push(a, b, step + Math.max(0, e[b] - e[a]) * 0.3, step + Math.max(0, e[a] - e[b]) * 0.3);
}
// Transitions across the border east (vert) or south of cluster k. a(t) is the tile on k's side, b(t) its neighbour.
function hpaBorder(G, k, vert) {
  const { n, cw, mv, P } = G, C = HPA.C, cx = k % cw, cy = (k / cw) | 0, out = [];
  const has = (i, d) => P[i] && ((mv[i] >> d) & 1);
  let len, a, b, across, along, back, diagF, diagB;
  if (vert) { const bx = (cx + 1) * C, y0 = cy * C; len = Math.min(n, y0 + C) - y0; a = t => (y0 + t) * n + bx - 1; b = t => (y0 + t) * n + bx; across = 0; along = 2; back = 3; diagF = 4; diagB = 5; }
  else { const by = (cy + 1) * C, x0 = cx * C; len = Math.min(n, x0 + C) - x0; a = t => (by - 1) * n + x0 + t; b = t => by * n + x0 + t; across = 2; along = 0; back = 1; diagF = 4; diagB = 6; }
  const open = t => has(a(t), across);
  // entrance spans: runs of open crossings whose tiles also join each other along both sides
  for (let t = 0; t < len;) {
    if (!open(t)) { t++; continue; }
    let e = t;
    while (e + 1 < len && open(e + 1) && has(a(e), along) && has(b(e), along)) e++;
    const L = e - t + 1;
    if (L < 6) hpaTrans(G, out, a(t + ((L - 1) >> 1)), b(t + ((L - 1) >> 1)), 1);
    else { hpaTrans(G, out, a(t), b(t), 1); hpaTrans(G, out, a(e), b(e), 1); }
    t = e + 1;
  }
  // a diagonal crossing that no orthogonal crossing beside it already connects
  for (let t = 0; t + 1 < len; t++) {
    if (has(a(t), diagF) && !((open(t) && has(b(t), along)) || (has(a(t), along) && open(t + 1)))) hpaTrans(G, out, a(t), b(t + 1), 1.414);
    if (has(a(t + 1), diagB) && !((open(t + 1) && has(b(t + 1), back)) || (has(a(t + 1), back) && open(t)))) hpaTrans(G, out, a(t + 1), b(t), 1.414);
  }
  return out;
}
// Diagonal transitions at the corner south-east of cluster k, where four clusters meet.
function hpaCorner(G, k) {
  const { n, cw, mv, P } = G, C = HPA.C, bx = (k % cw + 1) * C, by = (((k / cw) | 0) + 1) * C;
  const TL = (by - 1) * n + bx - 1, TR = (by - 1) * n + bx, BL = by * n + bx - 1, BR = by * n + bx;
  const has = (i, d) => P[i] && ((mv[i] >> d) & 1), cb = [], ca = [];
  if (has(TL, 4) && !((has(TL, 0) && has(TR, 2)) || (has(TL, 2) && has(BL, 0)))) hpaTrans(G, cb, TL, BR, 1.414);
  if (has(TR, 6) && !((has(TR, 1) && has(TL, 2)) || (has(TR, 2) && has(BR, 1)))) hpaTrans(G, ca, TR, BL, 1.414);
  G.cb[k] = cb; G.ca[k] = ca;
}
// The node list of cluster k: the end tiles on its side of the transitions on its four borders and four corners.
function hpaNodes(G, k) {
  const c = G.cl[k], cw = G.cw, cx = k % cw, cy = (k / cw) | 0, ni = G.ni;
  for (const t of c.nodes) ni[t] = -1;
  const nodes = [], inter = [];
  const add = (t, o, cost) => { let j = ni[t]; if (j < 0) { j = ni[t] = nodes.length; nodes.push(t); inter.push([]); } inter[j].push(o, cost); };
  const scan = (L, side) => { if (L) for (let i = 0; i < L.length; i += 4) { if (side) add(L[i + 1], L[i], L[i + 3]); else add(L[i], L[i + 1], L[i + 2]); } };
  scan(G.vb[k], 0); if (cx > 0) scan(G.vb[k - 1], 1);
  scan(G.hb[k], 0); if (cy > 0) scan(G.hb[k - cw], 1);
  scan(G.cb[k], 0); if (cx > 0 && cy > 0) scan(G.cb[k - cw - 1], 1);
  if (cx > 0) scan(G.ca[k - 1], 0); if (cy > 0) scan(G.ca[k - cw], 1);
  c.nodes = nodes; c.inter = inter; c.cost = new Float64Array(nodes.length * nodes.length); c.row = new Uint8Array(nodes.length);
}
// Components over every node: transitions join their ends, and nodes in one connected area of a cluster are joined.
function hpaComponents(G) {
  const comp = G.comp, lab = G.lab;
  const find = t => { while (comp[t] !== t) { comp[t] = comp[comp[t]]; t = comp[t]; } return t; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) comp[b] = a; else comp[a] = b; } };
  for (const c of G.cl) for (const t of c.nodes) comp[t] = t;
  for (const c of G.cl) {
    const first = new Map();
    for (let i = 0; i < c.nodes.length; i++) {
      const t = c.nodes[i], l = lab[t];
      if (first.has(l)) union(t, first.get(l)); else first.set(l, t);
      const e = c.inter[i]; for (let q = 0; q < e.length; q += 2) union(t, e[q]);
    }
  }
  for (const c of G.cl) for (const t of c.nodes) comp[t] = find(t);
}

// ---------- searches inside one cluster ----------
const HL = { d: new Float64Array(256), st: new Uint32Array(256), cl: new Uint32Array(256), cur: 0, hf: new Float64Array(4096), hi: new Int32Array(4096), n: 0, x0: 0, y0: 0 };
// Dijkstra inside cluster k from the tiles srcs (cost 0) with findPath's step costs. rev: the cost of moving toward
// the sources (the goal side). Afterwards hpaD(t) is the cost of tile t of the cluster, Infinity if not reached.
function hpaLocal(G, k, srcs, rev) {
  const n = G.n, cw = G.cw, mv = G.mv, el = G.map.elev, C = HPA.C, DX = PF_DX, DY = PF_DY;
  const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C) - 1, y1 = Math.min(n, y0 + C) - 1;
  const d = HL.d, st = HL.st, cl = HL.cl, hf = HL.hf, hi = HL.hi, stamp = ++HL.cur;
  HL.n = n; HL.x0 = x0; HL.y0 = y0;
  let hn = 0;
  const push = (f, i) => { let q = hn++; hf[q] = f; hi[q] = i; while (q > 0) { const p = (q - 1) >> 1; if (hf[p] <= hf[q]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[q]; hi[p] = hi[q]; hf[q] = tf; hi[q] = ti; q = p; } };
  const pop = () => { const top = hi[0], len = --hn; if (len > 0) { hf[0] = hf[len]; hi[0] = hi[len]; let q = 0; for (; ;) { const l = 2 * q + 1, r = l + 1; let m = q; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === q) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[q]; hi[m] = hi[q]; hf[q] = tf; hi[q] = ti; q = m; } } return top; };
  for (const s of srcs) { const l = (((s / n) | 0) - y0) * C + s % n - x0; if (st[l] === stamp) continue; st[l] = stamp; d[l] = 0; push(0, s); }
  while (hn) {
    const c = pop(), cx = c % n, cy = (c / n) | 0, lc = (cy - y0) * C + cx - x0;
    if (cl[lc] === stamp) continue; cl[lc] = stamp;
    const m = mv[c], gc = d[lc], ec = el[c];
    for (let dd = 0; dd < 8; dd++) {
      if (!((m >> dd) & 1)) continue;
      const nx = cx + DX[dd], ny = cy + DY[dd];
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const j = ny * n + nx, lj = (ny - y0) * C + nx - x0, climb = rev ? ec - el[j] : el[j] - ec;
      const ng = gc + (dd >= 4 ? 1.414 : 1) + (climb > 0 ? climb * 0.3 : 0);
      if (st[lj] !== stamp || ng < d[lj]) { st[lj] = stamp; d[lj] = ng; push(ng, j); }
    }
  }
}
function hpaD(t) { const n = HL.n, l = (((t / n) | 0) - HL.y0) * HPA.C + t % n - HL.x0; return HL.st[l] === HL.cur ? HL.d[l] : Infinity; }
// Intra-edge costs from node a of cluster k to the cluster's other nodes, worked out on first use.
function hpaRow(G, k, a) {
  const c = G.cl[k], m = c.nodes.length;
  if (c.row[a]) return;
  c.row[a] = 1; hpaLocal(G, k, [c.nodes[a]], false);
  for (let b = 0; b < m; b++) c.cost[a * m + b] = hpaD(c.nodes[b]);
}

// The live map changed by hand (tests and tools end such edits with computeRegions): rebuild everything. terraFlush
// sets HPA.quiet, since terraTouch has already dirtied what it changed.
if (typeof GameMap === 'function') {
  const _hpaRegions = GameMap.prototype.computeRegions;
  GameMap.prototype.computeRegions = function () {
    const r = _hpaRegions.apply(this, arguments);
    if (this === HPA.map && !HPA.quiet) hpaDirtyAll();
    return r;
  };
}
