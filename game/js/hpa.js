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

// ---------- the abstract search ----------
const HS = { n: 0, g: null, st: null, par: null, cl: null, cur: 0, hf: new Float64Array(4096), hi: new Int32Array(4096) };
// A* over the nodes, from the start (its costs to the start cluster's nodes, sCost, and to the goal inside that
// cluster, sDone) to the goal (goalNodes: node tile -> cost from it to the goal). h(t) is the heuristic of a node
// tile. Returns the node tiles of the route in order (empty when the goal is reached inside the start cluster), or null.
function hpaSearch(G, ks, sCost, sDone, goalNodes, h) {
  const n = G.n, N = n * n, GOAL = N;
  if (HS.n !== n) { HS.n = n; HS.g = new Float64Array(N + 1); HS.st = new Uint32Array(N + 1); HS.par = new Int32Array(N + 1); HS.cl = new Uint32Array(N + 1); }
  const stamp = ++HS.cur, g = HS.g, st = HS.st, par = HS.par, cl = HS.cl, ni = G.ni, cls = G.cl;
  let hf = HS.hf, hi = HS.hi, hn = 0;
  const push = (f, i) => {
    if (hn === hf.length) { const f2 = new Float64Array(hn * 2), i2 = new Int32Array(hn * 2); f2.set(hf); i2.set(hi); HS.hf = hf = f2; HS.hi = hi = i2; }
    let q = hn++; hf[q] = f; hi[q] = i;
    while (q > 0) { const p = (q - 1) >> 1; if (hf[p] <= hf[q]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[q]; hi[p] = hi[q]; hf[q] = tf; hi[q] = ti; q = p; }
  };
  const pop = () => { const top = hi[0], len = --hn; if (len > 0) { hf[0] = hf[len]; hi[0] = hi[len]; let q = 0; for (; ;) { const l = 2 * q + 1, r = l + 1; let m = q; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === q) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[q]; hi[m] = hi[q]; hf[q] = tf; hi[q] = ti; q = m; } } return top; };
  const relax = (t, ng, from) => { if (st[t] !== stamp || ng < g[t]) { st[t] = stamp; g[t] = ng; par[t] = from; push(ng + (t === GOAL ? 0 : h(t)), t); } };
  const sc = cls[ks];
  for (let i = 0; i < sc.nodes.length; i++) if (sCost[i] < Infinity) relax(sc.nodes[i], sCost[i], -1);
  if (sDone < Infinity) relax(GOAL, sDone, -1);
  while (hn) {
    const t = pop();
    if (cl[t] === stamp) continue; cl[t] = stamp;
    if (t === GOAL) { const out = []; for (let q = par[GOAL]; q !== -1; q = par[q]) out.push(q); return out.reverse(); }
    const k = hpaCluster(G, t), c = cls[k], a = ni[t], m = c.nodes.length, gt = g[t];
    if (!c.row[a]) hpaRow(G, k, a);
    const cost = c.cost, nodes = c.nodes, base = a * m;
    for (let b = 0; b < m; b++) { const w = cost[base + b]; if (b !== a && w < Infinity) relax(nodes[b], gt + w, t); }
    const e = c.inter[a]; for (let q = 0; q < e.length; q += 2) relax(e[q], gt + e[q + 1], t);
    const gc = goalNodes.get(t); if (gc !== undefined) relax(GOAL, gt + gc, t);
  }
  return null;
}
// Corridor for pfGrid: the clusters of the start and of every node on the abstract route, each widened by ring
// clusters. The abstract route can be walked inside its own clusters, so a corridor of ring 0 always holds a path.
// pfGrid then reads the graph's step masks (mv) and asks the unit's own rule only on gate tiles (gt).
function hpaCorridor(G, ks, route, ring) {
  const cw = G.cw, cm = G.cm, stamp = ++G.cstamp;
  const mark = k => { const cx = k % cw, cy = (k / cw) | 0; for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < cw && y < cw) cm[y * cw + x] = stamp; } };
  mark(ks); for (const t of route) mark(hpaCluster(G, t));
  return { cm, stamp, cw, w: HPA.weight, mv: G.mv, gt: G.gt };
}
// lineClear(map, a, b, passFn) on the graph's step masks: the same answer, asking passFn only on gate tiles.
function hpaClear(G, passFn) {
  const n = G.n, mv = G.mv, gt = G.gt;
  return (a, b) => {
    const x0 = a % n, y0 = (a / n) | 0, x1 = b % n, y1 = (b / n) | 0;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    let px = x0, py = y0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      if (x === px && y === py) continue;
      const dx = x - px, dy = y - py, d = HPA_DIR[(dy + 1) * 3 + dx + 1];
      if (!((mv[py * n + px] >> d) & 1)) return false;
      if ((gt[y * n + x] || (dx && dy && (gt[py * n + x] || gt[y * n + px]))) && (!passFn(y * n + x, x, y) || (dx && dy && (!passFn(py * n + x, x, py) || !passFn(y * n + px, px, y))))) return false;
      px = x; py = y;
    }
    return true;
  };
}
const HPA_DIR = [7, 3, 5, 1, -1, 0, 6, 2, 4];   // (dx, dy) -> bit index of PF_DX / PF_DY

// ---------- findPath's hierarchical answer ----------
// Same contract as findPath: { pts, ok }. null tells findPath to run its plain grid search (the old answer).
function hpaFindPath(map, sx, sy, goal, passFn, cls) {
  if (!W || map !== W.map) return null;
  HPA.stats.queries++;
  const n = map.n, C = HPA.C;
  const gx0 = goal.x0, gy0 = goal.y0, gx1 = goal.x1, gy1 = goal.y1, gr = goal.r;
  const hxy = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const h = t => hxy(t % n, (t / n) | 0);
  // 1. A near goal: the plain search with a small budget. When it finishes (found, or no tile left), it is the old answer.
  if (hxy(sx, sy) <= HPA.near) {
    const r = pfGrid(map, sx, sy, goal, passFn, HPA.nearNodes, null);
    if (!r.budget) { HPA.stats.near++; return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth), ok: r.ok }; }
  }
  const G = hpaGraph(cls), cw = G.cw, s = sy * n + sx, ks = (sy >> 4) * cw + (sx >> 4), sc = G.cl[ks];
  // 2. The start: its costs to its cluster's nodes, and to the goal tiles inside its cluster.
  const dx0 = Math.max(0, Math.ceil(gx0 - gr)), dx1 = Math.min(n - 1, Math.floor(gx1 + gr)), dy0 = Math.max(0, Math.ceil(gy0 - gr)), dy1 = Math.min(n - 1, Math.floor(gy1 + gr));
  hpaLocal(G, ks, [s], false);
  const sCost = new Float64Array(sc.nodes.length);
  for (let i = 0; i < sc.nodes.length; i++) sCost[i] = hpaD(sc.nodes[i]);
  let sDone = Infinity;
  const kx0 = (sx >> 4) * C, ky0 = (sy >> 4) * C;
  for (let y = Math.max(dy0, ky0); y <= Math.min(dy1, ky0 + C - 1); y++) for (let x = Math.max(dx0, kx0); x <= Math.min(dx1, kx0 + C - 1); x++) sDone = Math.min(sDone, hpaD(y * n + x));
  // 3. The goal: in each cluster the goal tiles fall in, the cost from every node to the nearest goal tile.
  const goalNodes = new Map();
  if (dx0 <= dx1 && dy0 <= dy1) for (let cy = dy0 >> 4; cy <= dy1 >> 4; cy++) for (let cx = dx0 >> 4; cx <= dx1 >> 4; cx++) {
    const k = cy * cw + cx, srcs = [];
    for (let y = Math.max(dy0, cy * C); y <= Math.min(dy1, cy * C + C - 1); y++) for (let x = Math.max(dx0, cx * C); x <= Math.min(dx1, cx * C + C - 1); x++) if (G.P[y * n + x]) srcs.push(y * n + x);
    if (!srcs.length) continue;
    hpaLocal(G, k, srcs, true);
    for (const t of G.cl[k].nodes) { const c = hpaD(t); if (c < Infinity) goalNodes.set(t, c); }
  }
  // 4. Region reject: the components the start reaches against those the goal is reached from.
  const comps = new Set();
  for (let i = 0; i < sc.nodes.length; i++) if (sCost[i] < Infinity) comps.add(G.comp[sc.nodes[i]]);
  let reach = sDone < Infinity;
  if (!reach) for (const t of goalNodes.keys()) if (comps.has(G.comp[t])) { reach = true; break; }
  if (reach) {
    const route = hpaSearch(G, ks, sCost, sDone, goalNodes, h);
    if (route) {
      const r = pfGrid(map, sx, sy, goal, passFn, n * n, hpaCorridor(G, ks, route, 1));
      if (r.ok) { HPA.stats.routed++; return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth, hpaClear(G, passFn)), ok: true }; }
    }
    HPA.stats.fallback++;   // the unit's own rule is stricter than the graph's (a gate it may not use): the old search decides
    return null;
  }
  // 5. Unreachable: a route to the reachable tile nearest the goal, ok false (findPath's best effort; the old search
  // could only find that tile or a farther one). A cluster's tiles are reachable when they share a connected area
  // with one of its nodes in the start's components; clusters are scanned nearest first.
  HPA.stats.unreachable++;
  let best = s, bh = h(s);
  hpaLocal(G, ks, [s], false);   // the start cluster's own reachable tiles count too
  for (let y = ky0; y < Math.min(n, ky0 + C); y++) for (let x = kx0; x < Math.min(n, kx0 + C); x++) { const t = y * n + x; if (hpaD(t) < Infinity) { const ht = hxy(x, y); if (ht < bh) { bh = ht; best = t; } } }
  const cand = [];
  for (let k = 0; k < G.cl.length; k++) {
    const labs = new Set(); for (const t of G.cl[k].nodes) if (comps.has(G.comp[t])) labs.add(G.lab[t]);
    if (!labs.size) continue;
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, ex = Math.max(gx0 - (x0 + C - 1), 0, x0 - gx1), ey = Math.max(gy0 - (y0 + C - 1), 0, y0 - gy1);
    cand.push({ k, labs, lb: ex > ey ? ex + 0.414 * ey : ey + 0.414 * ex });
  }
  cand.sort((a, b) => a.lb - b.lb || a.k - b.k);
  for (const { k, labs, lb } of cand) {
    if (lb >= bh) break;
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C;
    for (let y = y0; y < Math.min(n, y0 + C); y++) for (let x = x0; x < Math.min(n, x0 + C); x++) { const t = y * n + x; if (G.P[t] && labs.has(G.lab[t])) { const ht = hxy(x, y); if (ht < bh) { bh = ht; best = t; } } }
  }
  if (best === s) return { pts: [], ok: false };
  const bx = best % n, by = (best / n) | 0, toB = { x0: bx, y0: by, x1: bx, y1: by, r: 0 }, kb = hpaCluster(G, best);
  const hB = t => { const ax = Math.abs(t % n - bx), ay = Math.abs(((t / n) | 0) - by); return ax > ay ? ax + 0.414 * ay : ay + 0.414 * ax; };
  hpaLocal(G, kb, [best], true);
  const toBest = new Map(); for (const t of G.cl[kb].nodes) { const c = hpaD(t); if (c < Infinity) toBest.set(t, c); }
  let sB = Infinity; if (kb === ks) { hpaLocal(G, ks, [s], false); sB = hpaD(best); }
  const route = hpaSearch(G, ks, sCost, sB, toBest, hB);
  const r = route && pfGrid(map, sx, sy, toB, passFn, n * n, hpaCorridor(G, ks, route, 1));
  if (!r || !r.ok) { HPA.stats.fallback++; return null; }
  return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth, hpaClear(G, passFn)), ok: false };
}
// ---------- group orders ----------
// A group order computes one route. orderMove and the attack-move command hand their units to hpaGroupOrder: per
// movement class, the unit nearest the group's middle leads, and every unit of the leader's owner within HPA.groupR
// of it is a member. A member's first path request for the order (setOrder's moveToPoint, or attack-move's first
// tick) takes the group route, which the first such request computes once from the leader to the order point:
// a short leg onto the route, the shared waypoints, then the member's own slot. Every later request, including
// followPath's repath when the member is blocked, searches on its own. The one search counts against PATHB.
// cmdFindBreach keeps one breach answer per group and target (hpaGroupOf).
const HPA_GROUP = new WeakMap();   // unit -> { g, o, used }: its group and the order object it was given
// units: the ordered units; slotOf(u) -> {x, y} its destination; (x, y) the order point; t 'move' or 'attackmove'.
function hpaGroupOrder(units, slotOf, x, y, t) {
  const orderFor = u => { const s = slotOf(u); return { t, x: s.x, y: s.y }; };
  if (!HPA.enabled || units.length < 2 || !W || !W.map) { for (const u of units) setOrder(u, orderFor(u)); return; }
  const byClass = new Map(), groupOf = new Map();
  for (const u of units) { const c = hpaClassOf(u); if (!byClass.has(c)) byClass.set(c, []); byClass.get(c).push(u); }
  for (const [cls, grp] of byClass) {
    if (grp.length < 2) continue;
    let cx = 0, cy = 0; for (const u of grp) { cx += u.x; cy += u.y; } cx /= grp.length; cy /= grp.length;
    let L = grp[0], ld = Infinity; for (const u of grp) { const d = Math.hypot(u.x - cx, u.y - cy); if (d < ld) { ld = d; L = u; } }
    const g = { cls, leader: L, owner: L.owner, x: Math.max(0.3, Math.min(W.n - 0.3, x)), y: Math.max(0.3, Math.min(W.n - 0.3, y)), route: null, breach: null };
    for (const u of grp) if (u.owner === g.owner && Math.hypot(u.x - L.x, u.y - L.y) <= HPA.groupR) groupOf.set(u, g);
  }
  for (const u of units) {
    const o = orderFor(u), g = groupOf.get(u);
    if (g) HPA_GROUP.set(u, { g, o, used: false }); else HPA_GROUP.delete(u);
    setOrder(u, o);
  }
  HPA.stats.groups += new Set(groupOf.values()).size;
}
// Will u's next path request take its group's route? (polish.js does not charge such a request to PATHB.)
function hpaShares(u) { const r = HPA_GROUP.get(u); return !!(r && !r.used && u.order === r.o); }
// The group of u's current order, if it has one.
function hpaGroupOf(u) { const r = HPA_GROUP.get(u); return r && u.order === r.o ? r.g : null; }
// pathTo's first call for a member: its route from the group's, or null to search on its own.
function hpaShared(u, rect, r) {
  const rec = HPA_GROUP.get(u);
  if (!rec || rec.used || u.order !== rec.o) return null;
  rec.used = true;
  const g = rec.g;
  if (!g.route) {
    const L = g.leader.dead || g.leader.dying || g.leader.inside ? u : g.leader;
    if (typeof PATHB === 'object') PATHB.used++;   // the group's one search, charged to the per-tick path budget
    const res = findPath(W.map, L.x | 0, L.y | 0, { x0: g.x | 0, y0: g.y | 0, x1: g.x | 0, y1: g.y | 0, r: 0 }, unitPass(L), undefined, g.cls);
    g.route = { pts: res.pts, ok: res.ok, sx: L.x | 0, sy: L.y | 0 };
  }
  if (!g.route.pts.length) return null;
  const out = hpaJoin(u, g.route, rect);
  if (out) HPA.stats.shared++;
  return out;
}
// A member's own copy of the group route: a leg from where it stands onto the route's first waypoint, the waypoints,
// and its slot (rect) at the end.
function hpaJoin(u, route, rect) {
  const map = W.map, n = map.n, pass = unitPass(u), pts = route.pts;
  const T = p => Math.max(0, Math.min(n - 1, p.y | 0)) * n + Math.max(0, Math.min(n - 1, p.x | 0));
  const ux = Math.max(0, Math.min(n - 1, u.x | 0)), uy = Math.max(0, Math.min(n - 1, u.y | 0)), ui = uy * n + ux, first = T(pts[0]);
  let head;
  if (lineClear(map, ui, first, pass)) head = [];
  else if (lineClear(map, ui, route.sy * n + route.sx, pass)) head = [{ x: route.sx + 0.5, y: route.sy + 0.5 }];
  else {
    const j = findPath(map, ux, uy, { x0: first % n, y0: (first / n) | 0, x1: first % n, y1: (first / n) | 0, r: 0 }, pass, HPA.joinNodes);
    if (!j.ok) return null;
    head = j.pts.slice(0, -1);
  }
  if (!route.ok) return { pts: head.concat(pts), ok: false };
  const slot = { x: rect.x0 + 0.5, y: rect.y0 + 0.5 }, st = rect.y0 * n + rect.x0, body = pts.slice(0, -1);
  const prev = body.length ? T(body[body.length - 1]) : head.length ? T(head[head.length - 1]) : ui;
  // leave the route before the order point when the slot is in plain sight; otherwise go through the order point (a
  // slot that cannot be walked to from there gets the member's own repath when it is blocked)
  if (st === T(pts[pts.length - 1]) || lineClear(map, prev, st, pass)) return { pts: head.concat(body, [slot]), ok: true };
  return { pts: head.concat(pts, [slot]), ok: true };
}
// A new or loaded match: build the land and naval graphs and every intra edge now, so the first long order of the
// match does not pay for them. (Rebuilds after changes stay lazy. The editor's worlds never route, so they are skipped.)
function hpaWarm() {
  if (!HPA.enabled || !W || !W.map || (W.settings && W.settings.editor)) return;
  for (const cls of ['land', 'naval']) { const G = hpaGraph(cls); for (let k = 0; k < G.cl.length; k++) for (let a = 0; a < G.cl[k].nodes.length; a++) hpaRow(G, k, a); }
}
GameHooks.on('worldCreated', hpaWarm);
GameHooks.on('worldRestored', hpaWarm);

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
