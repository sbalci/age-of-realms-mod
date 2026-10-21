// ===== Map: terrain, elevation, generation, pathfinding =====
'use strict';
const T = { GRASS: 0, DIRT: 1, SAND: 2, SHALLOW: 3, WATER: 4, DEEP: 5, FOREST: 6, ROCK: 7 };
const TER_NAMES = ['Grass', 'Dirt', 'Sand', 'Shallows', 'Water', 'Deep Water', 'Forest Floor', 'Rocky Ground'];
const isWaterT = t => t === T.WATER || t === T.DEEP;

function mulberry32(a) {
  const next = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  next.state = () => a >>> 0;
  next.restore = state => { a = state >>> 0; };
  return next;
}

// Structural checks also apply to unfinished editor maps, which need not have starts yet.
function validateMapSpec(spec) {
  const errors = [], own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  if (!spec || typeof spec !== 'object') return ['Not a map file.'];
  if (spec.version !== undefined && spec.version !== 1) errors.push('Unsupported map version.');
  const n = spec.n;
  if (!Number.isInteger(n) || n < 16 || n > 256) return ['Map size must be an integer from 16 to 256.'];
  const layer = (key, max, optional = false) => {
    const a = spec[key];
    if (optional && a === undefined) return;
    if ((!Array.isArray(a) && !ArrayBuffer.isView(a)) || a.length !== n * n || Array.from(a).some(v => !Number.isInteger(v) || v < 0 || v > max)) errors.push(`Invalid ${key} layer: expected ${n * n} values from 0 to ${max}.`);
  };
  layer('ter', 7); layer('elev', 4);
  for (const k of ['bridge', 'tun', 'trench']) layer(k, 1, true);
  layer('excavated', 4, true);
  if (spec.name !== undefined && (typeof spec.name !== 'string' || spec.name.length > 120)) errors.push('Invalid map name.');
  if (!Array.isArray(spec.players) || spec.players.length < 2 || spec.players.length > 8) return errors.concat('Maps require 2 to 8 players.');
  const point = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < n && p.y < n;
  for (const p of spec.players) {
    if (!p || typeof p !== 'object' || (p.start && !point(p.start)) || (p.civ !== undefined && !own(CIVS, p.civ)) || (p.color !== undefined && (!Number.isInteger(p.color) || p.color < 0 || p.color > 7)) || (p.team !== undefined && (!Number.isInteger(p.team) || p.team < 0 || p.team > 8))) errors.push('Invalid player, civilization, color, team, or starting position.');
  }
  if (!Array.isArray(spec.objects) || spec.objects.length > n * n * 4) return errors.concat('Invalid or oversized object list.');
  for (const o of spec.objects) {
    if (!point(o)) { errors.push('Object coordinates must be integers inside the map.'); break; }
    if (o.k === 'unit' || o.k === 'bld') {
      const defs = o.k === 'unit' ? UNITS : BUILDINGS;
      if (!own(defs, o.t) || !Number.isInteger(o.o) || o.o < 0 || o.o > spec.players.length) { errors.push('Unknown object type or owner.'); break; }
      if (o.k === 'bld' && (o.o === 0 || o.x + defs[o.t].size > n || o.y + defs[o.t].size > n)) { errors.push('Building has an invalid owner or extends beyond the map.'); break; }
    } else if (!['tree', 'shrub', 'berry', 'gold', 'stone', 'coal', 'fish', 'relic'].includes(o.k)) { errors.push('Unknown resource type.'); break; }
    if (o.depth !== undefined && (!['coal', 'gold', 'stone'].includes(o.k) || !Number.isInteger(o.depth) || o.depth < 0 || o.depth > 4)) { errors.push('Invalid underground deposit depth.'); break; }
  }
  return errors;
}

function mapLayers(map) {
  const out = {};
  for (const k of ['ter', 'elev', 'bridge', 'tun', 'trench', 'excavated']) if (map[k]) out[k] = Array.from(map[k]);
  return out;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function makeNoise(rng) {
  const P = new Uint8Array(512), G = [];
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  for (let i = 0; i < 256; i++) G.push(rng());
  const fade = t => t * t * (3 - 2 * t);
  function v(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = G[P[(xi & 255) + P[yi & 255]]], b = G[P[((xi + 1) & 255) + P[yi & 255]]];
    const c = G[P[(xi & 255) + P[(yi + 1) & 255]]], d = G[P[((xi + 1) & 255) + P[(yi + 1) & 255]]];
    const u = fade(xf), w = fade(yf);
    return (a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w;
  }
  return function (x, y, oct = 3) { let s = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += v(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
}

class GameMap {
  constructor(n) {
    this.n = n;
    this.ter = new Uint8Array(n * n);
    this.elev = new Uint8Array(n * n);
    this.vh = new Float32Array((n + 1) * (n + 1));
    this.blk = new Int32Array(n * n); // entity id blocking this tile (building/resource)
    this.deco = new Uint8Array(n * n); // random detail seed
    this.landReg = new Int32Array(n * n);
    this.waterReg = new Int32Array(n * n);
    this.version = 0;
  }
  idx(x, y) { return y * this.n + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.n && y < this.n; }
  isWater(x, y) { return this.inb(x, y) && isWaterT(this.ter[y * this.n + x]); }
  elevAt(x, y) { x = Math.max(0, Math.min(this.n - 1, x | 0)); y = Math.max(0, Math.min(this.n - 1, y | 0)); return this.elev[y * this.n + x]; }
  computeVH() {
    const n = this.n, N = n + 1;
    for (let vy = 0; vy <= n; vy++) for (let vx = 0; vx <= n; vx++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const x = vx + dx, y = vy + dy;
        if (x >= 0 && y >= 0 && x < n && y < n) {
          const t = this.ter[y * n + x];
          s += isWaterT(t) ? -0.35 : this.elev[y * n + x]; c++;
        }
      }
      this.vh[vy * N + vx] = s / c;
    }
    this.version++;
  }
  // continuous height (in elevation units) at tile-space point
  h(x, y) {
    const n = this.n, N = n + 1;
    x = Math.max(0, Math.min(n - 0.001, x)); y = Math.max(0, Math.min(n - 0.001, y));
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
    const a = this.vh[yi * N + xi], b = this.vh[yi * N + xi + 1], c = this.vh[(yi + 1) * N + xi], d = this.vh[(yi + 1) * N + xi + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  canStep(ax, ay, bx, by) { return Math.abs(this.elev[ay * this.n + ax] - this.elev[by * this.n + bx]) < 2; }
  computeRegions() {
    const n = this.n;
    this.landReg.fill(0); this.waterReg.fill(0);
    let rid = 0;
    const st = [];
    for (let i = 0; i < n * n; i++) {
      const water = isWaterT(this.ter[i]);
      const arr = water ? this.waterReg : this.landReg;
      if (arr[i]) continue;
      rid++; arr[i] = rid; st.push(i);
      while (st.length) {
        const c = st.pop(), cx = c % n, cy = (c / n) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const j = ny * n + nx;
          if (arr[j] || isWaterT(this.ter[j]) !== water) continue;
          if (!water && !this.canStep(cx, cy, nx, ny)) continue;
          arr[j] = rid; st.push(j);
        }
      }
    }
  }
}

// ---------- Pathfinding (A*, 8-directional) ----------
// The open list is a binary heap in typed arrays: keys in a Float64Array and tile indices in an Int32Array, sifted with
// exactly the comparisons of the old array-of-pairs heap (<= up, strict < down), so equal keys pop in the same order.
const PF = { g: null, par: null, stamp: null, closed: null, cur: 1, n: 0, hf: new Float64Array(4096), hi: new Int32Array(4096), expanded: 0 };
const PF_DX = [1, -1, 0, 0, 1, 1, -1, -1], PF_DY = [0, 0, 1, -1, 1, -1, 1, -1]; // neighbour offsets (were rebuilt for every neighbour)
function pfInit(n) {
  if (PF.n === n) return;
  PF.n = n; PF.g = new Float32Array(n * n); PF.par = new Int32Array(n * n); PF.stamp = new Uint32Array(n * n); PF.closed = new Uint32Array(n * n);
}
// Grid A* from (sx, sy) to the goal {x0, y0, x1, y1, r}; passFn(i, x, y) -> bool. Returns the tile chain from the start
// to the goal (ok) or to the expanded tile nearest the goal (not ok), and whether it stopped at maxNodes (budget).
// lim (optional, from hpa.js) keeps the search inside the clusters whose lim.cm entry equals lim.stamp, takes the
// steps from the class graph's masks lim.mv (asking passFn only on the gate tiles lim.gt) and weighs the heuristic
// by lim.w (slightly above 1, so ties go to the tile nearer the goal).
function pfGrid(map, sx, sy, goal, passFn, maxNodes, lim) {
  const n = map.n; pfInit(n);
  const stamp = ++PF.cur;
  const g = PF.g, par = PF.par, st = PF.stamp, cl = PF.closed, DX = PF_DX, DY = PF_DY;
  let hf = PF.hf, hi = PF.hi, hn = 0;
  const push = (f, i) => {
    if (hn === hf.length) { const f2 = new Float64Array(hn * 2), i2 = new Int32Array(hn * 2); f2.set(hf); i2.set(hi); PF.hf = hf = f2; PF.hi = hi = i2; }
    let k = hn++; hf[k] = f; hi[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[k]; hi[p] = hi[k]; hf[k] = tf; hi[k] = ti; k = p; }
  };
  const pop = () => {
    const top = hi[0], len = --hn;
    if (len > 0) {
      hf[0] = hf[len]; hi[0] = hi[len];
      let k = 0;
      for (; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === k) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[k]; hi[m] = hi[k]; hf[k] = tf; hi[k] = ti; k = m; }
    }
    return top;
  };
  // distance to the goal rectangle, without allocating (this runs for every node the search touches)
  const gx0 = goal.x0, gy0 = goal.y0, gx1 = goal.x1, gy1 = goal.y1, gr = goal.r;
  const hfun = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const done = (x, y) => Math.max(gx0 - x, 0, x - gx1) <= gr && Math.max(gy0 - y, 0, y - gy1) <= gr;
  const cm = lim ? lim.cm : null, cs = lim ? lim.stamp : 0, cw = lim ? lim.cw : 0, w = lim ? lim.w : 1, mv = lim ? lim.mv : null, gt = lim ? lim.gt : null;
  const s = sy * n + sx;
  g[s] = 0; par[s] = -1; st[s] = stamp; push(hfun(sx, sy) * w, s);
  let best = s, bestH = hfun(sx, sy), expanded = 0, found = -1, budget = false;
  while (hn) {
    const c = pop();
    if (cl[c] === stamp) continue; cl[c] = stamp;
    const cx = c % n, cy = (c / n) | 0;
    if (done(cx, cy)) { found = c; break; }
    const hh = hfun(cx, cy); if (hh < bestH) { bestH = hh; best = c; }
    if (++expanded > maxNodes) { budget = true; break; }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      if (cm && cm[(ny >> 4) * cw + (nx >> 4)] !== cs) continue;
      const j = ny * n + nx;
      if (cl[j] === stamp) continue;
      if (mv) {   // the class graph's step rule; the unit's own rule differs from it only on gate tiles
        if (!((mv[c] >> d) & 1)) continue;
        if ((gt[j] || (d >= 4 && (gt[cy * n + nx] || gt[ny * n + cx]))) && (!passFn(j, nx, ny) || (d >= 4 && (!passFn(cy * n + nx, nx, cy) || !passFn(ny * n + cx, cx, ny))))) continue;
      } else {
        if (!passFn(j, nx, ny) || !map.canStep(cx, cy, nx, ny)) continue;
        if (d >= 4 && (!passFn(cy * n + nx, nx, cy) || !passFn(ny * n + cx, cx, ny))) continue;
      }
      const ng = g[c] + (d >= 4 ? 1.414 : 1) + Math.max(0, map.elev[j] - map.elev[c]) * 0.3;
      if (st[j] !== stamp || ng < g[j]) { st[j] = stamp; g[j] = ng; par[j] = c; push(ng + hfun(nx, ny) * w, j); }
    }
  }
  const end = found >= 0 ? found : best, chain = [];
  for (let c = end; c !== -1 && chain.length <= n * n; c = par[c]) chain.push(c);   // no 4,000-point cap: a chain is at most every tile once
  chain.reverse();
  PF.expanded += expanded;   // every search's expanded tiles, counted (hpa.js charges a blocked click's own searches by them)
  return { chain, ok: found >= 0, budget, expanded };
}
// String-pull smoothing of a tile chain into waypoints (tile centres), leaving out the start tile. Each step looks at
// most K points ahead (K = 0: to the end of the chain, the old unbounded smoothing). clear(a, b) is the straight-line
// test, lineClear by default.
function pfSmooth(map, chain, passFn, K, clear) {
  const n = map.n, out = [];
  let i = 0;
  while (i < chain.length - 1) {
    let j = K > 0 ? Math.min(chain.length - 1, i + K) : chain.length - 1;
    for (; j > i + 1; j--) if (clear ? clear(chain[i], chain[j]) : lineClear(map, chain[i], chain[j], passFn)) break;
    out.push(chain[j]); i = j;
  }
  return out.map(c => ({ x: c % n + 0.5, y: ((c / n) | 0) + 0.5 }));
}
// passFn(i, x, y) -> bool. goal: {x0,y0,x1,y1,r}. cls ('land', 'mounted' or 'naval', given by pathTo) lets the
// hierarchical search of hpa.js answer when it is switched on; without cls, or with it off, this is the plain grid A*.
function findPath(map, sx, sy, goal, passFn, maxNodes = 9000, cls) {
  const n = map.n; pfInit(n);
  if (maxNodes === 9000 && n > 110) maxNodes = Math.min(36000, Math.round(n * n * 0.85));
  sx = Math.max(0, Math.min(n - 1, sx | 0)); sy = Math.max(0, Math.min(n - 1, sy | 0));
  const hpaOn = typeof HPA === 'object' && HPA.enabled;
  if (cls && hpaOn) { const r = hpaFindPath(map, sx, sy, goal, passFn, cls); if (r) return r; }
  const res = pfGrid(map, sx, sy, goal, passFn, maxNodes, null);
  return { pts: pfSmooth(map, res.chain, passFn, hpaOn ? HPA.smooth : 0), ok: res.ok };
}
function lineClear(map, a, b, passFn) {
  const n = map.n; let x0 = a % n, y0 = (a / n) | 0; const x1 = b % n, y1 = (b / n) | 0;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  let px = x0, py = y0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps; const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    if (x === px && y === py) continue;
    if (!passFn(y * n + x, x, y) || !map.canStep(px, py, x, y)) return false;
    if (x !== px && y !== py && (!passFn(py * n + x, x, py) || !passFn(y * n + px, px, y))) return false;
    px = x; py = y;
  }
  return true;
}

// ---------- Map generation → spec ----------
const MAP_SIZES = { tiny: 64, small: 80, medium: 100, large: 120, huge: 160, gigantic: 200 };
const MAP_TYPE_NAMES = {
  land: 'Highlands',
  alpine: 'Alpine Mountains',
  rivers: 'Great Rivers',
  coastal: 'Coastal',
  islands: 'Islands',
};
function carveMountainsAndObstacles(n, type, seed, starts, water, ter, elev, dW, dStart) {
  if (type === 'islands') {
    // Volcanic rocky island peaks at the center of larger islands
    for (let y = 4; y < n - 4; y++) for (let x = 4; x < n - 4; x++) {
      const i = y * n + x;
      if (water[i] || dW[i] < 6 || dStart(x, y) < 14) continue;
      if (elev[i] >= 3) { elev[i] = 4; ter[i] = T.ROCK; }
    }
    return;
  }
  if (n <= 80 && (type === 'land' || type === 'coastal')) return;
  const mrng = mulberry32((seed ^ 0x4d544e) >>> 0);
  const mnoise = makeNoise(mrng);
  const scale = n / 80;
  // 1. Tectonic Mountain Ranges with Alpine Passes (elev 3-4, T.ROCK cliffs)
  const rangeCount = type === 'alpine'
    ? Math.max(3, Math.round(3.5 * scale))
    : type === 'rivers'
      ? (n >= 100 ? Math.max(2, Math.round(2.2 * scale)) : 1)
      : type === 'land'
        ? Math.max(2, Math.round(2.4 * scale))
        : (n >= 120 ? Math.max(1, Math.round(1.5 * scale)) : 0);
  const minStartDist = n <= 80 ? 17 : 15;
  for (let r = 0; r < rangeCount; r++) {
    // Anchor mountain spines between player sectors or across the continental interior
    const s0 = starts[r % starts.length], s1 = starts[(r + 1) % starts.length];
    let ax, ay, bx, by;
    if (type === 'alpine' && r < starts.length && starts.length >= 2) {
      const mx = (s0.x + s1.x) * 0.5, my = (s0.y + s1.y) * 0.5;
      const dx = mx - n * 0.5, dy = my - n * 0.5, len = Math.hypot(dx, dy) || 1;
      ax = n * 0.5 + (dx / len) * n * 0.08 + (mrng() - 0.5) * 8;
      ay = n * 0.5 + (dy / len) * n * 0.08 + (mrng() - 0.5) * 8;
      bx = n * 0.5 + (dx / len) * n * 0.44 + (mrng() - 0.5) * 10;
      by = n * 0.5 + (dy / len) * n * 0.44 + (mrng() - 0.5) * 10;
    } else {
      const ang = mrng() * Math.PI * 2, span = n * (type === 'alpine' ? 0.34 : 0.26);
      const cx = n * (0.3 + mrng() * 0.4), cy = n * (0.3 + mrng() * 0.4);
      ax = cx - Math.cos(ang) * span; ay = cy - Math.sin(ang) * span;
      bx = cx + Math.cos(ang) * span; by = cy + Math.sin(ang) * span;
    }
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 14) continue;
    const steps = Math.ceil(len * 1.5);
    const spine = [];
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sway = (mnoise(t * 3.5 + r * 7, r * 3.1, 2) - 0.5) * (n * 0.14) * Math.sin(t * Math.PI);
      const px = ax + (bx - ax) * t + nx * sway;
      const py = ay + (by - ay) * t + ny * sway;
      spine.push([px, py]);
    }
    // 1-2 natural Mountain Passes (walkable defiles cut through the ridge)
    const passes = [Math.round(steps * (0.42 + (mrng() - 0.5) * 0.18))];
    if (steps > 48) passes.push(Math.round(steps * (0.74 + (mrng() - 0.5) * 0.12)));
    const passHalf = type === 'alpine' ? 2.6 : 2.8;
    const baseW = (type === 'alpine' ? 4.4 : 3.4) * (n >= 140 ? 1.25 : n <= 80 ? 0.82 : 1.0);
    for (let s = 0; s <= steps; s++) {
      const [px, py] = spine[s];
      const inPass = passes.some(p => Math.abs(s - p) <= passHalf);
      const taper = Math.min(1, Math.sin((s / steps) * Math.PI) * 1.8);
      const rw = Math.max(2.0, baseW * (0.7 + 0.5 * mnoise(px / 9, py / 9, 2)) * taper);
      const rCeil = Math.ceil(rw + 2);
      for (let yy = Math.max(2, (py - rCeil) | 0); yy <= Math.min(n - 3, (py + rCeil) | 0); yy++) {
        for (let xx = Math.max(2, (px - rCeil) | 0); xx <= Math.min(n - 3, (px + rCeil) | 0); xx++) {
          const i = yy * n + xx;
          if (water[i] || dW[i] < 3 || dStart(xx, yy) < minStartDist) continue;
          if (type === 'coastal' && Math.hypot(xx - n / 2, yy - n / 2) < n * 0.3) continue;
          const d = Math.hypot(xx - px, yy - py);
          if (d > rw + 1.2) continue;
          if (inPass) {
            if (d <= rw * 0.85) {
              elev[i] = Math.min(elev[i], 1);
              ter[i] = T.DIRT;
            }
          } else if (d <= rw * 0.52) {
            elev[i] = 4;
            ter[i] = T.ROCK;
          } else if (d <= rw * 0.88) {
            elev[i] = Math.max(elev[i], 3);
            ter[i] = T.ROCK;
          } else if (d <= rw + 0.8 && elev[i] < 2) {
            elev[i] = Math.max(elev[i], 1);
            if (mrng() < 0.45) ter[i] = T.ROCK;
          }
        }
      }
    }
  }
  // 2. Cliff Mesas & Box Canyons (with a single tactical ramp entrance)
  const baseMesas = type === 'alpine' ? 5 : type === 'land' ? 4 : type === 'rivers' ? 3 : 2;
  const mesaCount = Math.round(baseMesas * Math.max(1, Math.pow(scale, 1.5)));
  for (let k = 0; k < mesaCount; k++) {
    for (let tries = 0; tries < 35; tries++) {
      const cx = 8 + (mrng() * (n - 16)) | 0, cy = 8 + (mrng() * (n - 16)) | 0;
      const r = 3 + mrng() * (n >= 140 ? 4.5 : 3);
      if (dStart(cx, cy) < 16 || dW[cy * n + cx] < r + 3) continue;
      if (type === 'coastal' && Math.hypot(cx - n / 2, cy - n / 2) < n * 0.28) continue;
      const rampA = mrng() * Math.PI * 2;
      const radCeil = Math.ceil(r + 3);
      for (let y = cy - radCeil; y <= cy + radCeil; y++) for (let x = cx - radCeil; x <= cx + radCeil; x++) {
        if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) continue;
        const d = Math.hypot(x - cx, y - cy); if (d > r) continue;
        const i = y * n + x;
        elev[i] = Math.min(4, Math.max(3, elev[i] + 2));
        if (d > r - 1.4 || elev[i] === 4) ter[i] = T.ROCK;
      }
      // Carved ramp entrance
      for (let t = r - 1.5; t <= r + 2.5; t += 0.5) {
        const x = Math.round(cx + Math.cos(rampA) * t), y = Math.round(cy + Math.sin(rampA) * t);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) if (x + ox >= 1 && y + oy >= 1 && x + ox < n - 1 && y + oy < n - 1) {
          const j = (y + oy) * n + x + ox;
          elev[j] = Math.max(0, Math.round(elev[cy * n + cx] - 1 - (t - r + 1.5) * 0.55));
          ter[j] = T.DIRT;
        }
      }
      break;
    }
  }
  // 3. Terrain Obstacles: Jagged Rocky Crag Spires & Lowland Marsh Shallows
  const cragCount = n >= 100 ? Math.round((type === 'alpine' ? 9 : 4) * scale * scale) : (type === 'alpine' ? 4 : 0);
  for (let k = 0; k < cragCount; k++) {
    for (let tries = 0; tries < 25; tries++) {
      const cx = 6 + (mrng() * (n - 12)) | 0, cy = 6 + (mrng() * (n - 12)) | 0;
      if (dStart(cx, cy) < 15 || dW[cy * n + cx] < 4) continue;
      if (type === 'coastal' && Math.hypot(cx - n / 2, cy - n / 2) < n * 0.3) continue;
      const cr = 1.6 + mrng() * 1.8;
      for (let y = Math.max(2, (cy - 3) | 0); y <= Math.min(n - 3, (cy + 3) | 0); y++) {
        for (let x = Math.max(2, (cx - 3) | 0); x <= Math.min(n - 3, (cx + 3) | 0); x++) {
          if (Math.hypot(x - cx, y - cy) <= cr && !water[y * n + x]) {
            const i = y * n + x;
            elev[i] = Math.hypot(x - cx, y - cy) < cr * 0.55 ? 4 : 3;
            ter[i] = T.ROCK;
          }
        }
      }
      break;
    }
  }
  if ((type === 'rivers' || type === 'land') && n >= 100) {
    const bogCount = Math.round((type === 'rivers' ? 5 : 2.5) * scale);
    for (let k = 0; k < bogCount; k++) {
      for (let tries = 0; tries < 25; tries++) {
        const cx = 10 + (mrng() * (n - 20)) | 0, cy = 10 + (mrng() * (n - 20)) | 0;
        if (dStart(cx, cy) < 16 || water[cy * n + cx] || elev[cy * n + cx] > 1) continue;
        const br = 2.2 + mrng() * 2.4;
        for (let y = Math.max(2, (cy - 4) | 0); y <= Math.min(n - 3, (cy + 4) | 0); y++) {
          for (let x = Math.max(2, (cx - 4) | 0); x <= Math.min(n - 3, (cx + 4) | 0); x++) {
            const d = Math.hypot(x - cx, y - cy), i = y * n + x;
            if (d <= br && !water[i] && elev[i] <= 1 && dStart(x, y) >= 14) {
              elev[i] = 0;
              ter[i] = d < br * 0.72 ? T.SHALLOW : T.DIRT;
            }
          }
        }
        break;
      }
    }
  }
}
function generateMapSpec(opts) {
  const n = MAP_SIZES[opts.size] || (Number.isInteger(opts.size) ? opts.size : 80);
  const seed = opts.seed >>> 0;
  const rng = mulberry32(seed);
  const noise = makeNoise(rng), noise2 = makeNoise(rng), noise3 = makeNoise(rng);
  const np = opts.numPlayers;
  const ter = new Uint8Array(n * n), elev = new Uint8Array(n * n);
  const type = opts.mapType;
  const geo = typeof geographyTerrain === 'function' ? geographyTerrain(type, n, np) : null;
  // start positions
  const starts = [];
  const a0 = rng() * Math.PI * 2;
  const rad = type === 'islands' ? 0.32 * n : type === 'coastal' ? 0.35 * n : n >= 140 ? 0.36 * n : 0.34 * n;
  // team arrangement: teammates adjacent
  for (let i = 0; i < np; i++) {
    const a = a0 + (i / np) * Math.PI * 2;
    starts.push({ x: Math.round(n / 2 + Math.cos(a) * rad), y: Math.round(n / 2 + Math.sin(a) * rad) });
  }
  if (geo) starts.splice(0, starts.length, ...geo.starts);
  const water = new Uint8Array(n * n);
  const dStart = (x, y) => { let m = 1e9; for (const s of starts) m = Math.min(m, Math.hypot(x - s.x, y - s.y)); return m; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, nz = noise(x / 14, y / 14, 3), dc = Math.hypot(x - n / 2, y - n / 2);
    let w = false;
    if (type === 'land' || type === 'alpine' || type === 'rivers') {
      const lakeTh = type === 'alpine' ? 0.76 : type === 'rivers' ? 0.72 : 0.74;
      w = nz > lakeTh && dStart(x, y) > 14;
    } else if (type === 'coastal') {
      // central sea with bays; players on ring
      w = dc < n * 0.2 + (nz - 0.5) * n * 0.22 || (noise2(x / 9, y / 9) > 0.78 && dStart(x, y) > 13);
      // inlet channel to edge to make it a coastline
      const ca = a0 + Math.PI / np, along = (x - n / 2) * Math.cos(ca) + (y - n / 2) * Math.sin(ca), perp = Math.abs(-(x - n / 2) * Math.sin(ca) + (y - n / 2) * Math.cos(ca));
      if (along > 0 && perp < 3.2 + (nz - 0.5) * 1.5 && dStart(x, y) > 12) w = true;
    } else if (type === 'islands') {
      const d = dStart(x, y);
      const isl = d < n * 0.17 + (nz - 0.5) * 10;
      const small = noise2(x / 7, y / 7) > 0.72 && d > n * 0.22 && dc > 8;
      w = !(isl || small);
      if (x < 2 || y < 2 || x > n - 3 || y > n - 3) w = true;
    }
    if (geo) w = !!geo.water[i];
    else if (dStart(x, y) < 9) w = false;
    water[i] = w ? 1 : 0;
  }
  // coastal: guarantee each player has water within ~14 tiles by carving small bay toward sea
  if (type === 'coastal') {
    for (const s of starts) {
      let hasNearWater = false;
      for (let y = Math.max(0, s.y - 14); y <= Math.min(n - 1, s.y + 14) && !hasNearWater; y++) {
        for (let x = Math.max(0, s.x - 14); x <= Math.min(n - 1, s.x + 14); x++) {
          if (water[y * n + x] && Math.hypot(x - s.x, y - s.y) <= 14) { hasNearWater = true; break; }
        }
      }
      if (!hasNearWater) {
        const dx = n / 2 - s.x, dy = n / 2 - s.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        for (let d = 12.5; d <= len; d += 1.5) {
          const bx = s.x + ux * d, by = s.y + uy * d;
          for (let y = Math.max(1, (by - 4) | 0); y <= Math.min(n - 2, (by + 4) | 0); y++) {
            for (let x = Math.max(1, (bx - 4) | 0); x <= Math.min(n - 2, (bx + 4) | 0); x++) {
              if (Math.hypot(x - bx, y - by) <= 3.2 && dStart(x, y) >= 9.5) water[y * n + x] = 1;
            }
          }
          if (water[Math.round(by) * n + Math.round(bx)]) break;
        }
      }
    }
  }
  // distance to land / water
  const dW = bfsDist(n, i => water[i]), dL = bfsDist(n, i => !water[i]);
  for (let i = 0; i < n * n; i++) {
    if (water[i]) ter[i] = dL[i] > 3 ? T.DEEP : T.WATER;
    else if (dW[i] <= 1) ter[i] = T.SAND;
    else { const v = noise3(i % n / 6, (i / n | 0) / 6, 2); ter[i] = v > 0.66 ? T.DIRT : v < 0.3 ? T.FOREST : T.GRASS; }
  }
  // elevation: hills
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x; if (water[i]) continue;
    const hv = noise2(x / 18 + 100, y / 18 + 50, 3);
    let e = hv > 0.68 ? 3 : hv > 0.6 ? 2 : hv > 0.52 ? 1 : 0;
    if (dW[i] <= 2) e = Math.min(e, dW[i] - 1 < 0 ? 0 : dW[i] - 1);
    elev[i] = geo ? geo.elev[i] : e;
    if (geo && elev[i] >= 3 && dStart(x, y) > 13) ter[i] = T.ROCK;
  }
  // flatten starts
  for (const s of starts) {
    const e0 = elev[s.y * n + s.x];
    for (let y = s.y - 8; y <= s.y + 8; y++) for (let x = s.x - 8; x <= s.x + 8; x++) if (x >= 0 && y >= 0 && x < n && y < n && !water[y * n + x] && Math.hypot(x - s.x, y - s.y) < 8) elev[y * n + x] = e0;
  }
  smoothElev(n, elev, water);
  // Tectonic mountain ranges, cliff mesas, rocky crag outcrops & marsh obstacles
  if (!geo) {
    if (n <= 80 && (type === 'land' || type === 'coastal')) {
      const count = type === 'land' ? 4 : 2;
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 30; tries++) {
          const cx = 8 + (rng() * (n - 16)) | 0, cy = 8 + (rng() * (n - 16)) | 0, r = 3 + rng() * 3;
          if (dStart(cx, cy) < 16 || dW[cy * n + cx] < r + 3) continue;
          const rampA = rng() * Math.PI * 2;
          for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
            if (x < 0 || y < 0 || x >= n || y >= n) continue;
            const d = Math.hypot(x - cx, y - cy); if (d > r) continue;
            elev[y * n + x] = Math.min(4, elev[y * n + x] + 2);
            if (elev[y * n + x] >= 3) ter[y * n + x] = T.ROCK;
          }
          for (let t = r - 1; t <= r + 2; t += 0.5) {
            const x = Math.round(cx + Math.cos(rampA) * t), y = Math.round(cy + Math.sin(rampA) * t);
            for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) if (x + ox >= 0 && y + oy >= 0 && x + ox < n && y + oy < n) {
              const j = (y + oy) * n + x + ox; elev[j] = Math.max(0, Math.round(elev[cy * n + cx] - 1 - (t - r + 1) * 0.5));
            }
          }
          break;
        }
      }
    }
    carveMountainsAndObstacles(n, type, seed, starts, water, ter, elev, dW, dStart);
  }
  const objects = [];
  const occ = new Uint8Array(n * n);
  const isMountainMap = n > 80 || (type !== 'land' && type !== 'coastal');
  const land = (x, y) => x >= 1 && y >= 1 && x < n - 1 && y < n - 1 && !water[y * n + x];
  const free = (x, y) => land(x, y) && !occ[y * n + x] && !(isMountainMap && ter[y * n + x] === T.ROCK && elev[y * n + x] >= 4);
  const put = (o, w = 1) => { objects.push(o); for (let yy = o.y; yy < o.y + w; yy++) for (let xx = o.x; xx < o.x + w; xx++) occ[yy * n + xx] = 1; };
  // reserve TC areas
  for (const s of starts) for (let y = s.y - 5; y <= s.y + 5; y++) for (let x = s.x - 5; x <= s.x + 5; x++) if (x >= 0 && y >= 0 && x < n && y < n) occ[y * n + x] = 2;
  const clusterAt = (cx, cy, count, mk, spread = 1.3) => {
    const placed = []; const q = [[cx, cy]]; let guard = 0;
    while (placed.length < count && guard++ < 200) {
      const [bx, by] = q.length ? q[(rng() * q.length) | 0] : [cx, cy];
      const x = bx + ((rng() * 3) | 0) - 1, y = by + ((rng() * 3) | 0) - 1;
      if (!free(x, y) || Math.hypot(x - cx, y - cy) > count * spread) continue;
      put(mk(x, y)); placed.push([x, y]); q.push([x, y]);
    }
    return placed.length;
  };
  const findSpot = (s, dmin, dmax, check) => {
    for (let t = 0; t < 200; t++) {
      const a = rng() * Math.PI * 2, d = dmin + rng() * (dmax - dmin);
      const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
      if (check(x, y)) return { x, y };
    }
    return null;
  };
  const areaFree = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (!free(xx, yy)) return false; return true; };
  // Forests (global, avoiding barren rocky mountain summits and shallow marshes)
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const i = y * n + x; if (water[i] || occ[i]) continue;
    const fz = noise3(x / 10 + 30, y / 10 + 70, 3);
    const nearStart = dStart(x, y);
    if (nearStart < 11) continue;
    if (fz > 0.62 || (fz > 0.58 && rng() < 0.35) || rng() < 0.012) {
      if (isMountainMap && ((ter[i] === T.ROCK && elev[i] >= 3) || ter[i] === T.SHALLOW)) continue;
      put({ k: 'tree', x, y, v: ter[i] === T.SAND ? 2 : (noise(x / 5, y / 5) > 0.5 ? 1 : 0) });
      if (ter[i] === T.GRASS) ter[i] = T.FOREST;
    }
  }
  const players = [];
  starts.forEach((s, pi) => {
    // TC
    for (let y = s.y - 5; y <= s.y + 5; y++) for (let x = s.x - 5; x <= s.x + 5; x++) if (x >= 0 && y >= 0 && x < n && y < n && occ[y * n + x] === 2) occ[y * n + x] = 0;
    for (let y = s.y - 2; y <= s.y + 2; y++) for (let x = s.x - 2; x <= s.x + 2; x++) if (x >= 0 && y >= 0 && x < n && y < n && !water[y * n + x] && ter[y * n + x] !== T.SAND) ter[y * n + x] = T.DIRT;
    const owner = pi + 1;
    put({ k: 'bld', t: 'tc', x: s.x - 2, y: s.y - 2, o: owner }, 4);
    for (let v = 0; v < 3; v++) objects.push({ k: 'unit', t: 'villager', x: s.x - 1 + v, y: s.y + 3, o: owner });
    objects.push({ k: 'unit', t: 'scout', x: s.x + 3, y: s.y + 1, o: owner });
    // sheep: 4 near, 4 further (neutral, found by scouting)
    for (let k = 0; k < 4; k++) { const p = findSpot(s, 4, 6, (x, y) => free(x, y)); if (p) objects.push({ k: 'unit', t: 'sheep', x: p.x, y: p.y, o: 0 }); }
    for (let k = 0; k < 2; k++) { const p = findSpot(s, 12, 16, (x, y) => areaFree(x, y, 1)); if (p) { objects.push({ k: 'unit', t: 'sheep', x: p.x, y: p.y, o: 0 }); objects.push({ k: 'unit', t: 'sheep', x: p.x + 1, y: p.y, o: 0 }); } }
    let p = findSpot(s, 6, 8, (x, y) => areaFree(x, y, 2)); if (p) clusterAt(p.x, p.y, 6, (x, y) => ({ k: 'berry', x, y }));
    p = findSpot(s, 7, 10, (x, y) => areaFree(x, y, 2)); if (p) clusterAt(p.x, p.y, 7, (x, y) => ({ k: 'gold', x, y }));
    p = findSpot(s, 13, 17, (x, y) => areaFree(x, y, 2)); if (p) clusterAt(p.x, p.y, 5, (x, y) => ({ k: 'gold', x, y }));
    p = findSpot(s, 8, 12, (x, y) => areaFree(x, y, 2)); if (p) clusterAt(p.x, p.y, 5, (x, y) => ({ k: 'stone', x, y }));
    for (let k = 0; k < 2; k++) { p = findSpot(s, 13, 18, (x, y) => areaFree(x, y, 1)); if (p) objects.push({ k: 'unit', t: 'boar', x: p.x, y: p.y, o: 0 }); }
    p = findSpot(s, 14, 20, (x, y) => areaFree(x, y, 2)); if (p) for (let k = 0; k < 4; k++) objects.push({ k: 'unit', t: 'deer', x: p.x + (k % 2), y: p.y + (k >> 1), o: 0 });
    // Home forests
    for (let k = 0; k < 2; k++) { p = findSpot(s, 9, 13, (x, y) => areaFree(x, y, 1)); if (p) clusterAt(p.x, p.y, 14, (x, y) => { if (ter[y * n + x] === T.GRASS) ter[y * n + x] = T.FOREST; return { k: 'tree', x, y, v: (rng() * 2) | 0 }; }, 0.45); }
    // stragglers
    for (let k = 0; k < 3; k++) { p = findSpot(s, 5, 7, (x, y) => areaFree(x, y, 1)); if (p) put({ k: 'tree', x: p.x, y: p.y, v: 0 }); }
    // shore fish near base
    let fishPlaced = 0;
    for (let t = 0; t < 400 && fishPlaced < 4; t++) {
      const a = rng() * Math.PI * 2, d = 8 + rng() * 14;
      const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) continue;
      const i = y * n + x; if (!water[i] || occ[i] || dL[i] > 3) continue;
      put({ k: 'fish', x, y }); fishPlaced++;
    }
    players.push({ start: { x: s.x, y: s.y } });
  });
  // deep fish
  let df = 0;
  for (let t = 0; t < 4000 && df < n / 5; t++) {
    const x = (rng() * n) | 0, y = (rng() * n) | 0, i = y * n + x;
    if (!water[i] || occ[i] || dL[i] < 3) continue;
    put({ k: 'fish', x, y, v: 1 }); df++;
  }
  // wolves, relics, extra gold/stone (scaled for huge maps & mountain foothills), extra deer
  const areaMul = Math.max(1, (n / 80) * (n / 80));
  const nWolves = Math.round((n / 30) * Math.sqrt(areaMul)) + 1;
  const nRelics = n > 120 ? Math.min(10, Math.round(5 * Math.sqrt(areaMul))) : 5;
  const nMines = Math.round((np + 2) * (n > 120 ? areaMul : 1));
  const nDeer = Math.round(np * 2 * (n > 120 ? Math.sqrt(areaMul) : 1));
  for (let t = 0, c = 0; t < 900 && c < nWolves; t++) { const x = (rng() * n) | 0, y = (rng() * n) | 0; if (free(x, y) && dStart(x, y) > 20) { objects.push({ k: 'unit', t: 'wolf', x, y, o: 0 }); c++; } }
  for (let t = 0, c = 0; t < 1200 && c < nRelics; t++) { const x = (rng() * n) | 0, y = (rng() * n) | 0; if (areaFree(x, y, 1) && dStart(x, y) > 16) { put({ k: 'relic', x, y }); c++; } }
  for (let t = 0, c = 0; t < 1400 && c < nMines; t++) { const x = (rng() * n) | 0, y = (rng() * n) | 0; if (areaFree(x, y, 2) && dStart(x, y) > 20) { clusterAt(x, y, 5, (x, y) => ({ k: c % 2 ? 'stone' : 'gold', x, y })); c++; } }
  for (let t = 0, c = 0; t < 1200 && c < nDeer; t++) { const x = (rng() * n) | 0, y = (rng() * n) | 0; if (areaFree(x, y, 1) && dStart(x, y) > 18) { for (let k = 0; k < 3; k++) objects.push({ k: 'unit', t: 'deer', x: x + k % 2, y: y + (k >> 1), o: 0 }); c++; } }
  // shrubs (decor)
  for (let t = 0; t < n * 3; t++) { const x = (rng() * n) | 0, y = (rng() * n) | 0; if (free(x, y) && dStart(x, y) > 5) { objects.push({ k: 'shrub', x, y }); occ[y * n + x] = 1; } }
  if (geo) {
    const towns = objects.filter(o => o.k === 'bld' && o.t === 'tc');
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.k !== 'bld' && o.k !== 'fish' && (isWaterT(ter[o.y * n + o.x]) || (o.k !== 'unit' && towns.some(b => o.x >= b.x && o.x < b.x + 4 && o.y >= b.y && o.y < b.y + 4)))) objects.splice(i, 1);
    }
  }
  const spec = { name: geo ? geo.name : (MAP_TYPE_NAMES[type] || 'Generated'), n, ter: Array.from(ter), elev: Array.from(elev), objects, players };
  if (geo) geographySupplies(spec, seed);
  ensureConnectivity(spec, type !== 'islands' && !geo);
  return spec;
}
function bfsDist(n, isSrc) {
  const d = new Int32Array(n * n).fill(1e6); const q = [];
  for (let i = 0; i < n * n; i++) if (isSrc(i)) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % n, y = (c / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const j = ny * n + nx; if (d[j] > d[c] + 1) { d[j] = d[c] + 1; q.push(j); } }
  }
  return d;
}
function smoothElev(n, elev, water) {
  for (let it = 0; it < 6; it++) {
    let changed = false;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (elev[i] - elev[j] >= 2) { elev[i] = elev[j] + 1; changed = true; }
      }
    }
    if (!changed) break;
  }
}
// Makes sure all starts (same landmass expected) can reach each other: carve mountain passes and river fords.
function ensureConnectivity(spec, requireLand) {
  const n = spec.n;
  const blocked = new Uint8Array(n * n);
  for (const o of spec.objects) if (o.k === 'tree' || o.k === 'gold' || o.k === 'stone' || o.k === 'berry') blocked[o.y * n + o.x] = 1;
  const reach = (s) => {
    const seen = new Uint8Array(n * n); const q = [s.y * n + s.x]; seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % n, y = (c / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (seen[j] || isWaterT(spec.ter[j]) || blocked[j]) continue;
        if (Math.abs(spec.elev[c] - spec.elev[j]) >= 2) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return seen;
  };
  const ps = spec.players;
  for (let k = 1; k < ps.length; k++) {
    let seen = reach(ps[0].start);
    const t = ps[k].start;
    if (!t || seen[t.y * n + t.x]) continue;
    if (!requireLand) continue;
    // Carve a walkable mountain pass & shallow ford corridor
    const a = ps[0].start, steps = Math.ceil(Math.hypot(t.x - a.x, t.y - a.y) * 2.2);
    const endE = spec.elev[t.y * n + t.x];
    let curE = spec.elev[a.y * n + a.x];
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(a.x + (t.x - a.x) * s / steps), y = Math.round(a.y + (t.y - a.y) * s / steps);
      const rem = steps - s;
      const wantE = rem <= 6 ? endE : Math.min(1, spec.elev[y * n + x]);
      if (s % 2 === 0 && curE !== wantE) curE += Math.sign(wantE - curE);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        const j = yy * n + xx;
        if (isWaterT(spec.ter[j])) { spec.ter[j] = T.SHALLOW; curE = 0; spec.objects = spec.objects.filter(o => !(o.x === xx && o.y === yy && o.k === 'fish')); }
        if (blocked[j]) { blocked[j] = 0; spec.objects = spec.objects.filter(o => !(o.x === xx && o.y === yy && (o.k === 'tree' || o.k === 'gold' || o.k === 'stone' || o.k === 'berry'))); }
        if (spec.ter[j] === T.ROCK && spec.elev[j] >= 3) spec.ter[j] = T.DIRT;
        spec.elev[j] = spec.ter[j] === T.SHALLOW ? 0 : curE;
      }
    }
  }
}
function blankMapSpec(n) {
  const ter = new Array(n * n).fill(T.GRASS), elev = new Array(n * n).fill(0);
  return { name: 'Blank', n, ter, elev, objects: [], players: [{ start: null }, { start: null }] };
}
