// ===== Realms mod, batch 2: water bodies (river / lake / sea), rivers with fords, fish stocks =====
// Loaded after mod.js. Wraps engine functions; nothing in the base files changes.
// URL switches: ?rivers=off  ?fishregen=off
'use strict';
const WMOD = {
  rivers: true,
  fishRegen: true,
  // Per water type. fishMax = food in one fish shoal, regen = food/second regrown by a healthy shoal,
  // dens = tiles of water per shoal when stocking rivers and lakes.
  kinds: {
    river: { name: 'River', fresh: true, flow: true, fishMax: 150, regen: 0.10, dens: 9, color: 'rgba(90,200,175,0.20)' },
    lake: { name: 'Lake', fresh: true, flow: false, fishMax: 250, regen: 0.07, dens: 14, color: 'rgba(70,160,175,0.15)' },
    sea: { name: 'Sea', fresh: false, flow: false, fishMax: 200, regen: 0.05, dens: 0, color: null },
  },
  breedFloor: 0.20,    // a shoal fished below this fraction stops regrowing (collapse)
  spawnEvery: 40,      // seconds between new shoals appearing in an understocked body
  spawnNeed: 0.5,      // a shoal this full counts as breeding stock
};
if (typeof location !== 'undefined' && location.search) {
  const q = new URLSearchParams(location.search);
  if (q.get('rivers') === 'off') WMOD.rivers = false;
  if (q.get('fishregen') === 'off') WMOD.fishRegen = false;
}

// ---------- classification ----------
// Works on any terrain array (GameMap.ter or spec.ter). Shallows count as land (they are fords).
function wmClassify(n, ter) {
  const id = new Int32Array(n * n), dist = new Int16Array(n * n).fill(-1);
  const wat = i => ter[i] === T.WATER || ter[i] === T.DEEP;
  const bodies = new Map();
  const st = [];
  let rid = 0;
  for (let i0 = 0; i0 < n * n; i0++) {
    if (!wat(i0) || id[i0]) continue;
    rid++; id[i0] = rid; st.push(i0);
    const b = { id: rid, size: 0, R: 0, sx: 0, sy: 0, kind: 'lake' };
    while (st.length) {
      const c = st.pop(), cx = c % n, cy = (c / n) | 0;
      b.size++; b.sx += cx; b.sy += cy;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0) - (d === 1), ny = cy + (d === 2) - (d === 3);
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (id[j] || !wat(j)) continue;
        id[j] = rid; st.push(j);
      }
    }
    bodies.set(rid, b);
  }
  // distance from shore (4-neighbour BFS from non-water; the map edge is not shore)
  const q = [];
  for (let i = 0; i < n * n; i++) if (!wat(i)) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % n, cy = (c / n) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0) - (d === 1), ny = cy + (d === 2) - (d === 3);
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx; if (dist[j] >= 0) continue;
      dist[j] = dist[c] + 1; q.push(j);
    }
  }
  const seaMin = Math.max(300, 0.025 * n * n);
  for (const b of bodies.values()) { b.cx = b.sx / b.size; b.cy = b.sy / b.size; }
  for (let i = 0; i < n * n; i++) if (id[i]) { const b = bodies.get(id[i]); if (dist[i] > b.R) b.R = dist[i]; }
  for (const b of bodies.values()) {
    if (b.size >= seaMin && b.R >= 4) b.kind = 'sea';
    else if (b.size >= 5 && ((b.R <= 2 && b.size / (b.R * b.R) >= 6) || b.size / (b.R * b.R) > 14)) b.kind = 'river';
    else b.kind = 'lake';
  }
  // Per-tile kind: a river that runs into a lake or the sea stays a river. Open-water cores (3+ tiles from shore) take the
  // body's kind, plus a 2-tile skirt around them; thin channels outside that are rivers when they are long enough.
  const kind = new Uint8Array(n * n), CODE = { river: 1, lake: 2, sea: 3 };
  const skirt = new Int8Array(n * n).fill(-1), sq = [];
  for (let i = 0; i < n * n; i++) {
    if (!id[i]) continue;
    const b = bodies.get(id[i]);
    if (b.kind === 'river' || b.R < 3) { kind[i] = CODE[b.kind]; continue; }
    if (dist[i] >= 3) { kind[i] = CODE[b.kind]; skirt[i] = 0; sq.push(i); }
  }
  for (let h = 0; h < sq.length; h++) {
    const c = sq[h]; if (skirt[c] >= 2) continue;
    const cx = c % n, cy = (c / n) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0) - (d === 1), ny = cy + (d === 2) - (d === 3);
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx; if (!id[j] || skirt[j] >= 0) continue;
      skirt[j] = skirt[c] + 1; kind[j] = kind[c]; sq.push(j);
    }
  }
  const seen = new Uint8Array(n * n);
  for (let i0 = 0; i0 < n * n; i0++) {
    if (!id[i0] || kind[i0] || seen[i0]) continue;
    const comp = [i0], b = bodies.get(id[i0]); seen[i0] = 1;
    for (let h = 0; h < comp.length; h++) {
      const c = comp[h], cx = c % n, cy = (c / n) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0) - (d === 1), ny = cy + (d === 2) - (d === 3);
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (!id[j] || kind[j] || seen[j]) continue;
        seen[j] = 1; comp.push(j);
      }
    }
    const k = comp.length >= 5 ? CODE.river : CODE[b.kind];
    for (const c of comp) kind[c] = k;
  }
  return { n, id, bodies, kind };
}
const WM_KIND = [null, 'river', 'lake', 'sea'];
function wmInfo(map) {
  if (!map._wb) map._wb = wmClassify(map.n, map.ter);
  return map._wb;
}
// Body record at a tile (null if not open water).
function waterBodyAt(map, x, y) {
  x |= 0; y |= 0; if (!map.inb(x, y)) return null;
  const w = wmInfo(map), r = w.id[y * map.n + x];
  return r ? w.bodies.get(r) : null;
}
function waterKindAt(map, x, y) { x |= 0; y |= 0; if (!map.inb(x, y)) return null; return WM_KIND[wmInfo(map).kind[y * map.n + x]]; }
// Drinkable without treatment: fresh water only. (Wells and thirst build on this in the next batch.)
function waterDrinkable(kind) { return !!(kind && WMOD.kinds[kind].fresh); }

if (typeof GameMap === 'function') {
  const _cr = GameMap.prototype.computeRegions;
  GameMap.prototype.computeRegions = function () { this._wb = null; return _cr.apply(this, arguments); };
}

// ---------- river generation ----------
function wmCarveRivers(spec, seed, mapType) {
  const n = spec.n, rng = mulberry32((seed ^ 0x51ed) >>> 0);
  const ter = spec.ter, elev = spec.elev;
  const starts = spec.players.map(p => p.start).filter(Boolean);
  const dStart = (x, y) => { let m = 1e9; for (const s of starts) m = Math.min(m, Math.hypot(x - s.x, y - s.y)); return m; };
  const isRiverMap = mapType === 'rivers';
  const count = isRiverMap
    ? (n >= 160 ? 4 : n >= 100 ? 3 : 2)
    : (n >= 180 ? 4 : n >= 140 ? 3 : n >= 100 ? 2 : 1);
  const carved = new Uint8Array(n * n);
  const fordTiles = new Set();
  const kill = new Set(['tree', 'gold', 'stone', 'berry', 'shrub', 'relic', 'unit']);
  const keep = new Set();
  for (const o of spec.objects) if (o.k === 'coal' || o.k === 'bld') {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const xx = o.x + ox, yy = o.y + oy;
      if (xx >= 0 && yy >= 0 && xx < n && yy < n) keep.add(yy * n + xx);
    }
  }
  const dropAt = new Set();
  const mainPaths = [];
  for (let r = 0; r < count; r++) {
    let path = [];
    for (let attempt = 0; attempt < 8 && path.length < 25; attempt++) {
      path = [];
      // enter from a random edge, aim at the opposite one
      const side = (rng() * 4) | 0;
      const along = n * (0.2 + rng() * 0.6);
      let x = [along, n - 1, along, 0][side], y = [0, along, n - 1, along][side];
      let ang = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][side] + (rng() - 0.5) * 0.5;
      let turn = 0;
      for (let step = 0; step < n * 3; step++) {
        turn += (rng() - 0.5) * 0.35; turn *= 0.88;
        ang += turn * 0.5;
        // keep clear of bases
        for (const s of starts) {
          const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
          if (d < 17) { const away = Math.atan2(dy, dx); let da = away - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); ang += da * 0.35 * (1 - d / 17); }
        }
        x += Math.cos(ang); y += Math.sin(ang);
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= n || yi >= n) { if (step > 6) break; else continue; }
        if (step > 10 && (ter[yi * n + xi] === T.WATER || ter[yi * n + xi] === T.DEEP) && !carved[yi * n + xi]) { path.push([xi, yi]); break; }  // reached a lake or sea
        path.push([xi, yi]);
      }
    }
    if (path.length < 25) continue;
    // make the course 4-connected (ships and flood fills cannot cross a diagonal-only join)
    const solid = [path[0]];
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1], b = path[k];
      if (a[0] !== b[0] && a[1] !== b[1]) solid.push([b[0], a[1]]);
      solid.push(b);
    }
    path = solid;
    mainPaths.push(path);
    // fords: 2-4 shallow crossings, never at the very ends
    const fords = new Set();
    const nf = path.length > 140 ? 4 : path.length > 70 ? 3 : 2;
    const fordSpan = (isRiverMap || n >= 140) ? 2 : 1;
    for (let f = 0; f < nf; f++) {
      const c = Math.round(path.length * ((f + 0.5) / nf + (rng() - 0.5) * 0.12));
      for (let k = -fordSpan; k <= fordSpan; k++) if (path[c + k]) fords.add(c + k);
    }
    const wideRiver = isRiverMap || (n >= 140 && r === 0);
    for (let k = 0; k < path.length; k++) {
      const [px, py] = path[k];
      const w = wideRiver ? (k > path.length * 0.45 ? 3 : 2) : (k > path.length * 0.55 ? 2 : 1);
      const isFord = fords.has(k);
      for (let oy = 0; oy < w; oy++) for (let ox = 0; ox < w; ox++) {
        const xx = px + ox, yy = py + oy; if (xx < 1 || yy < 1 || xx >= n - 1 || yy >= n - 1) continue;
        if (dStart(xx, yy) < 10) continue;
        const i = yy * n + xx;
        if (keep.has(i)) continue;
        if (!isFord && (ter[i] === T.WATER || ter[i] === T.DEEP)) continue;
        ter[i] = isFord ? T.SHALLOW : T.WATER; elev[i] = 0; carved[i] = 1; dropAt.add(i);
        if (isFord) fordTiles.add(i);
      }
    }
  }
  // Tributary streams on 'rivers' preset and huge/gigantic maps
  const tribCount = (isRiverMap ? 2 : n >= 160 ? 2 : n >= 140 ? 1 : 0);
  if (tribCount > 0 && mainPaths.length > 0) {
    const tRng = mulberry32((seed ^ 0x771b) >>> 0);
    for (let t = 0; t < tribCount; t++) {
      const targetPath = mainPaths[t % mainPaths.length];
      const joinIdx = Math.floor(targetPath.length * (0.3 + tRng() * 0.4));
      const [jx, jy] = targetPath[joinIdx];
      const ang0 = tRng() * Math.PI * 2;
      const len = Math.round(n * (0.22 + tRng() * 0.16));
      let sx = Math.max(4, Math.min(n - 5, Math.round(jx + Math.cos(ang0) * len)));
      let sy = Math.max(4, Math.min(n - 5, Math.round(jy + Math.sin(ang0) * len)));
      if (dStart(sx, sy) < 15) continue;
      const tPath = [];
      let cx = sx, cy = sy;
      for (let step = 0; step < len * 2; step++) {
        const dx = jx - cx, dy = jy - cy, dist = Math.hypot(dx, dy);
        if (dist < 1.5) { tPath.push([jx, jy]); break; }
        let ang = Math.atan2(dy, dx) + (tRng() - 0.5) * 0.45;
        cx += Math.cos(ang); cy += Math.sin(ang);
        const xi = Math.round(cx), yi = Math.round(cy);
        if (xi < 2 || yi < 2 || xi >= n - 2 || yi >= n - 2) break;
        if (dStart(xi, yi) < 12) break;
        tPath.push([xi, yi]);
        if (carved[yi * n + xi]) break;
      }
      if (tPath.length < 14) continue;
      const solidT = [tPath[0]];
      for (let k = 1; k < tPath.length; k++) {
        const a = tPath[k - 1], b = tPath[k];
        if (a[0] !== b[0] && a[1] !== b[1]) solidT.push([b[0], a[1]]);
        solidT.push(b);
      }
      const midFord = Math.floor(solidT.length * 0.5);
      for (let k = 0; k < solidT.length; k++) {
        const [px, py] = solidT[k];
        const isFord = Math.abs(k - midFord) <= 1;
        for (let oy = 0; oy < (k > solidT.length * 0.6 ? 2 : 1); oy++) for (let ox = 0; ox < (k > solidT.length * 0.6 ? 2 : 1); ox++) {
          const xx = px + ox, yy = py + oy;
          if (xx < 1 || yy < 1 || xx >= n - 1 || yy >= n - 1) continue;
          if (dStart(xx, yy) < 10) continue;
          const i = yy * n + xx;
          if (keep.has(i)) continue;
          if (!isFord && (ter[i] === T.WATER || ter[i] === T.DEEP)) continue;
          ter[i] = isFord ? T.SHALLOW : T.WATER; elev[i] = 0; carved[i] = 1; dropAt.add(i);
          if (isFord) fordTiles.add(i);
        }
      }
    }
  }
  if (!dropAt.size) return 0;
  // banks: sand at the water's edge, flat alluvial valley floor near water, while preserving rocky mountain cliffs/canyons
  for (const i of dropAt) {
    const cx = i % n, cy = (i / n) | 0;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const xx = cx + ox, yy = cy + oy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
      const j = yy * n + xx; if (carved[j]) continue;
      const d = Math.max(Math.abs(ox), Math.abs(oy));
      if (d === 1) {
        if (ter[j] === T.GRASS || ter[j] === T.DIRT) ter[j] = T.SAND;
        elev[j] = 0;
      } else if (d === 2) {
        elev[j] = (ter[j] === T.ROCK && elev[j] >= 3) ? 2 : 0;
      } else if (d === 3) {
        if (!(ter[j] === T.ROCK && elev[j] >= 3)) elev[j] = Math.min(elev[j], 1);
      }
    }
  }
  // Ensure every ford has a smooth, walkable approach ramp (|Δelev| <= 1) out to 4 tiles
  for (const i of fordTiles) {
    const cx = i % n, cy = (i / n) | 0;
    for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) {
      const xx = cx + ox, yy = cy + oy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
      const j = yy * n + xx; if (carved[j]) continue;
      const d = Math.max(Math.abs(ox), Math.abs(oy));
      const maxE = d <= 1 ? 0 : d === 2 ? 1 : d === 3 ? 2 : 3;
      if (elev[j] > maxE) {
        elev[j] = maxE;
        if (ter[j] === T.ROCK && maxE <= 1) ter[j] = T.DIRT;
      }
    }
  }
  spec.objects = spec.objects.filter(o => !(kill.has(o.k) && dropAt.has(o.y * n + o.x)));
  return dropAt.size;
}
// Stock rivers and lakes with fish (the base generator only seeds shore fish near bases and deep-sea fish).
function wmStockFresh(spec, seed) {
  const n = spec.n, rng = mulberry32((seed ^ 0xf15b) >>> 0);
  const cls = wmClassify(n, spec.ter);
  const taken = new Set(spec.objects.map(o => o.y * n + o.x));
  let added = 0;
  for (const kc of [1, 2]) {   // rivers, then lakes (sea shoals come from the base generator)
   for (const b of cls.bodies.values()) {
    const inKind = i => cls.id[i] === b.id && cls.kind[i] === kc;
    let size = 0; for (let i = 0; i < n * n; i++) if (inKind(i)) size++;
    if (!size) continue;
    const dens = WMOD.kinds[WM_KIND[kc]].dens;
    const want = Math.max(1, Math.min(26, Math.round(size / dens)));
    const tiles = [];
    for (let i = 0; i < n * n; i++) if (inKind(i) && !taken.has(i)) tiles.push(i);
    let got = 0;
    for (let t = 0; t < want * 12 && got < want && tiles.length; t++) {
      const i = tiles[(rng() * tiles.length) | 0], x = i % n, y = (i / n) | 0;
      let clear = true;
      for (let oy = -1; oy <= 1 && clear; oy++) for (let ox = -1; ox <= 1; ox++) if (taken.has((y + oy) * n + x + ox)) { clear = false; break; }
      if (!clear) continue;
      spec.objects.push({ k: 'fish', x, y, v: 0 }); taken.add(i); got++; added++;
    }
   }
  }
  return added;
}
if (typeof generateMapSpec === 'function') {
  const _gen = generateMapSpec;
  generateMapSpec = function (opts) {
    const spec = _gen(opts);
    try {
      if (WMOD.rivers && opts.mapType !== 'islands' && !(typeof REAL_MAPS !== 'undefined' && REAL_MAPS[opts.mapType])) {
        if (wmCarveRivers(spec, opts.seed >>> 0, opts.mapType) && typeof ensureConnectivity === 'function') ensureConnectivity(spec, true);
      }
      wmStockFresh(spec, opts.seed >>> 0);
    } catch (err) { console.warn('water mod: generation step failed', err); }
    return spec;
  };
}

// ---------- fish stocks ----------
function wmState() {
  if (!W.wm) W.wm = { acc: 0, spawnT: 0, target: new Map() };
  return W.wm;
}
function wmUnitOnTile(x, y) { return idxRect('unit', x - 0.5, y - 0.5, x + 1.5, y + 1.5).some(u => Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); }
function wmFishTick(dt) {
  const S = wmState(), map = W.map;
  const byBody = new Map();
  for (const e of idxAll('res:fish')) {   // every shoal in W.list order (the restocking below draws simRandom per body)
    if (e.dead) continue;
    const b = waterBodyAt(map, e.x, e.y); if (!b) continue;
    const k = WMOD.kinds[waterKindAt(map, e.x, e.y)];
    if (!e.wm) {   // rescale an original 200/225 shoal to its water type, keeping how full it is
      const frac = e.max ? e.amount / e.max : 1;
      e.max = Math.round(k.fishMax * (e.v ? 1.12 : 1)); e.amount = e.max * frac; e.wm = 1;
    }
    let rec = byBody.get(b.id); if (!rec) byBody.set(b.id, rec = { b, fish: [], breeders: 0 });
    rec.fish.push(e);
    if (e.amount >= e.max * WMOD.spawnNeed) rec.breeders++;
    if (e.amount < e.max && e.amount >= e.max * WMOD.breedFloor) e.amount = Math.min(e.max, e.amount + k.regen * dt);
  }
  // restocking: the body slowly regrows shoals up to the number it started with
  S.spawnT += dt;
  const doSpawn = S.spawnT >= WMOD.spawnEvery; if (doSpawn) S.spawnT = 0;
  for (const rec of byBody.values()) {
    const key = rec.b.kind + ':' + Math.round(rec.b.cx) + ':' + Math.round(rec.b.cy);
    const prev = S.target.get(key) || 0;
    if (rec.fish.length > prev) S.target.set(key, rec.fish.length);
    if (!doSpawn || rec.fish.length >= (S.target.get(key) || 0) || rec.breeders < 2) continue;
    const parent = rec.fish[(simRandom() * rec.fish.length) | 0];
    for (let t = 0; t < 14; t++) {
      const x = Math.round(parent.x + (simRandom() - 0.5) * 7), y = Math.round(parent.y + (simRandom() - 0.5) * 7);
      if (!map.inb(x, y) || map.blk[map.idx(x, y)]) continue;
      if (!isWaterT(map.ter[map.idx(x, y)]) || waterBodyAt(map, x, y) !== rec.b) continue;
      if (wmUnitOnTile(x, y)) continue;
      const f = spawnRes('fish', x, y, parent.v);
      if (f) { f.max = parent.max; f.amount = f.max * 0.4; f.wm = 1; }
      break;
    }
  }
}
GameHooks.on('afterTick', dt => {
    if (!WMOD.fishRegen || !W.map) return;
    const S = wmState(); S.acc += dt;
    if (S.acc >= 1) { const d = S.acc; S.acc = 0; wmFishTick(d); }
});

// ---------- look: fresh water reads differently from the sea ----------
if (typeof drawTile === 'function') {
  const _dt = drawTile;
  drawTile = function (g, map, x, y) {
    _dt(g, map, x, y);
    const i = y * map.n + x; if (!isWaterT(map.ter[i])) return;
    const wk = waterKindAt(map, x, y), c = wk && WMOD.kinds[wk].color; if (!c) return;
    const p0 = iso(x, y, -0.35), p1 = iso(x + 1, y, -0.35), p2 = iso(x + 1, y + 1, -0.35), p3 = iso(x, y + 1, -0.35);
    g.beginPath(); g.moveTo(p0.x, p0.y - 0.5); g.lineTo(p1.x + 0.7, p1.y); g.lineTo(p2.x, p2.y + 0.7); g.lineTo(p3.x - 0.7, p3.y); g.closePath();
    g.fillStyle = c; g.fill();
  };
}

// ---------- info panel ----------
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (sel.length !== 1) return;
    const e = sel[0], info = document.querySelector('#selinfo .info'); if (!info) return;
    let b = null, extra = '';
    if (e.kind === 'res' && e.type === 'fish') {
      b = waterKindAt(W.map, e.x, e.y);
      if (b && e.max) {
        const f = e.amount / e.max;
        extra = f < WMOD.breedFloor ? ' · <span style="color:#f88">overfished, will not recover</span>' : f < 1 ? ' · recovering' : ' · full shoal';
      }
    } else if (e.kind === 'unit' && UNITS[e.type].naval) b = waterKindAt(W.map, e.x, e.y);
    if (!b) return;
    const k = WMOD.kinds[b];
    info.insertAdjacentHTML('beforeend', `<div class="small dim">${k.name} · ${k.fresh ? 'fresh, drinkable' : 'salt, undrinkable'}${k.flow ? ' · flowing' : ''}${extra}</div>`);
  };
}
