// ===== FX: rendering polish =====
// Connected walls & palisades, projected building shadows, fog fade, cloud shadows + vignette,
// soft particles (smoke / fire / embers / sparks / chips / debris), combat decals (stuck arrows,
// craters, lingering corpses), circling birds, rally flag + target flash, water glints, stereo SFX.
// Everything wraps engine globals; each feature has a URL switch (?walls=off, ?shadows=off, ?fogfade=off,
// ?clouds=off, ?vignette=off, ?particles=off, ?decals=off, ?birds=off, ?rally=off, ?flash=off,
// ?glints=off, ?pan=off) and ?fx=off disables the whole module.
'use strict';
const FX_Q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search) : null;
const fxOff = k => !!FX_Q && (FX_Q.get(k) === 'off' || FX_Q.get('fx') === 'off');
const FX = {
  on: {}, parts: [], arrows: [], craters: [], corpses: [], corpseIds: new Set(), flash: null, world: null,
  sdt: 0, rdt: 0, lastRT: null, lastNow: null, mute: null, fogA: null, fogN: 0, sprites: new Map(), off: null,
  LX: 0.62, LY: 0.27, // projected light: screen px of shadow offset per px of height (sun upper-left)
  MAXP: 1400,
};
for (const k of ['walls', 'shadows', 'fogfade', 'clouds', 'vignette', 'particles', 'decals', 'birds', 'rally', 'flash', 'glints', 'pan']) FX.on[k] = !fxOff(k);

// ---------- pure helpers (unit-tested) ----------
// 4-neighbour connection mask: 1 = +x, 2 = -x, 4 = +y, 8 = -y
function fxWallMask(isLink, x, y) {
  return (isLink(x + 1, y) ? 1 : 0) | (isLink(x - 1, y) ? 2 : 0) | (isLink(x, y + 1) ? 4 : 0) | (isLink(x, y - 1) ? 8 : 0);
}
const FX_WALL_LINK = new Set(['wall', 'palisade', 'gate', 'tower']);
function fxIsWallType(type) { return type === 'wall' || type === 'palisade' || type === 'gate'; }
function fxWallMaskFor(b) {
  const map = W.map;
  return fxWallMask((x, y) => {
    if (!map.inb(x, y)) return false;
    const id = map.blk[map.idx(x, y)]; if (!id) return false;
    const e = ent(id); return !!(e && e.kind === 'bld' && !e.dead && FX_WALL_LINK.has(e.type));
  }, b.x, b.y);
}
// gate orientation: along x unless it only has y neighbours
function fxGateAlongX(mask) { return (mask & 3) !== 0 || !(mask & 12); }
// convex hull (monotone chain), points [[x,y],...] -> hull in order
function fxHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
// shadow polygon (iso px) for a footprint square [x0,y0]-[x0+s,y0+s] at ground height hh, casting height h
function fxShadowPoly(x0, y0, s, hh, h, inset) {
  const cx = x0 + s / 2, cy = y0 + s / 2, a = inset || 0, base = [], top = [];
  for (const [u, v] of [[x0 + a, y0 + a], [x0 + s - a, y0 + a], [x0 + s - a, y0 + s - a], [x0 + a, y0 + s - a]]) {
    const p = iso(u, v, hh); base.push([p.x, p.y]);
    const q = iso(cx + (u - cx) * 0.65, cy + (v - cy) * 0.65, hh); top.push([q.x + FX.LX * h, q.y + FX.LY * h]);
  }
  return fxHull(base.concat(top));
}
// stereo position from screen x: -1 (left) .. 1 (right), softened
function fxPan(sx, cw) { if (!cw) return 0; return Math.max(-0.85, Math.min(0.85, (sx / cw * 2 - 1) * 0.85)); }
// hit material of a target
function fxMaterial(t) {
  if (!t) return null;
  if (t.kind === 'bld') return BUILDINGS[t.type].wall && t.type === 'palisade' ? 'wood' : 'stone';
  if (t.kind !== 'unit') return null;
  const d = UNITS[t.type]; if (!d) return null;
  if (d.naval) return 'wood';
  if (d.tags.includes('siege') || d.tags.includes('machine')) return 'spark';
  if (d.animal) return 'blood';
  if ((d.ma || 0) >= 2 || (d.pa || 0) >= 3 || d.tags.includes('mounted') && (d.ma || 0) >= 1) return 'spark';
  return 'blood';
}
// one step of temporal fog fade: A (alpha 0..255) toward target from visible/explored; returns true if anything moved
function fxFogStep(A, vis, exp, k, out) {
  let moved = false;
  for (let i = 0; i < A.length; i++) {
    const tg = vis[i] ? 0 : exp[i] ? 115 : 255, a = A[i];
    if (a === tg) continue;
    let nv = a + (tg - a) * k; if (Math.abs(tg - nv) < 1.5) nv = tg;
    A[i] = nv; moved = true; if (out) out[i * 4 + 3] = nv;
  }
  return moved;
}
// tileable fbm value noise, returns Float32Array size*size in 0..1
function fxNoise(size, seed, oct) {
  const rnd = mulberry32(seed || 1), out = new Float32Array(size * size);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < (oct || 4); o++) {
    const P = 4 << o, lat = new Float32Array(P * P); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * P, fy = y / size * P, ix = fx | 0, iy = fy | 0, tx = sm(fx - ix), ty = sm(fy - iy);
      const a = lat[iy * P + ix], b = lat[iy * P + (ix + 1) % P], c = lat[((iy + 1) % P) * P + ix], d = lat[((iy + 1) % P) * P + (ix + 1) % P];
      out[y * size + x] += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

// ---------- shared state helpers ----------
function fxActive() { return !!(W && W.map && !W.menu && R.cw && !(typeof Editor !== 'undefined' && Editor.active)); }
function fxReset() {
  FX.world = W; FX.parts.length = 0; FX.arrows.length = 0; FX.craters.length = 0; FX.corpses.length = 0; FX.corpseIds.clear();
  FX.flash = null; FX.fogA = null; FX.birds = null; FX.lastRT = null;
}
function fxFrame() { // once per rendered frame (called from the terrain hook)
  if (FX.world !== W) fxReset();
  const now = performance.now();
  FX.rdt = FX.lastNow === null ? 0.016 : Math.min(0.1, (now - FX.lastNow) / 1000); FX.lastNow = now;
  FX.sdt = FX.lastRT === null ? 0 : Math.max(0, Math.min(0.1, R.time - FX.lastRT)); FX.lastRT = R.time;
  const z = R.cam.zoom;
  FX.view = { x0: R.cam.x - R.cw / 2 / z - 120, x1: R.cam.x + R.cw / 2 / z + 120, y0: R.cam.y - R.ch / 2 / z - 60, y1: R.cam.y + R.ch / 2 / z + 200 };
  FX.fogOn = true;
}
function fxInView(px, py, m) { const v = FX.view; m = m || 0; return v && px > v.x0 - m && px < v.x1 + m && py > v.y0 - m && py < v.y1 + m; }
function fxSeen(e) {
  if (!W.players[W.humanId]) return true;
  if (e.kind === 'unit') return e.owner === W.humanId || isVisibleToHuman(e);
  const c = center(e);
  if (!isExploredForHuman(c.x, c.y)) return false;
  if (e.kind === 'bld' && e.owner !== W.humanId && !isVisibleToHuman(e) && !e.seenBy) return false;
  return true;
}
function fxTileVisible(x, y) { const h = W.players[W.humanId]; if (!h) return true; const n = W.n; x = Math.max(0, Math.min(n - 1, x | 0)); y = Math.max(0, Math.min(n - 1, y | 0)); return h.visible[y * n + x] === 1; }
function fxCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
function fxPuff(key, r, g, b) {
  let s = FX.sprites.get(key); if (s) return s;
  s = fxCanvas(32, 32); const c = s.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.fillStyle = gr; c.fillRect(0, 0, 32, 32); FX.sprites.set(key, s); return s;
}
const fxSmokeL = () => fxPuff('smokeL', 200, 198, 192), fxSmokeD = () => fxPuff('smokeD', 48, 44, 40), fxDust = () => fxPuff('dust', 176, 150, 112), fxGlow = () => fxPuff('glow', 255, 150, 50), fxGlowW = () => fxPuff('gloww', 255, 230, 160);

// ---------- 1. connected walls & palisades ----------
function fxWallArt(g, type, st, pc, mask, open) {
  if (type === 'palisade') return fxPalisadeArt(g, mask);
  const c = STYLE[Math.max(2, st)].stone;
  if (type === 'gate') return fxGateArt(g, c, pc, mask, open);
  const T = 0.2, H = 24, arms = [];
  const m = mask || 3; // a lone wall reads as a short straight run
  if (m & 2) arms.push([-0.25, 0, 0.25, T, 0]); if (m & 8) arms.push([0, -0.25, T, 0.25, 0]);
  const back = arms.slice(); arms.length = 0;
  if (m & 1) arms.push([0.25, 0, 0.25, T, 0]); if (m & 4) arms.push([0, 0.25, T, 0.25, 0]);
  const seg = ([x, y, w, d]) => {
    box(g, x, y, w, d, 0, H, c, { bricks: true, ol: false });
    fxMerlons(g, x, y, w, d, H, c);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.7;
    const a = P(x - w, y + d, H), b = P(x + w, y + d, H), e = P(x + w, y - d, H); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.stroke();
  };
  for (const s of back) seg(s);
  const straight = m === 3 || m === 12;
  if (straight) seg([0, 0, T, T]);
  else { box(g, 0, 0, T + 0.07, T + 0.07, 0, H + 7, c, { bricks: true }); crenel(g, 0, 0, T + 0.07, T + 0.07, H + 7, c); }
  for (const s of arms) seg(s);
}
function fxMerlons(g, x, y, w, d, z, c) {
  const s = 0.055;
  if (w >= d) { for (const yy of [y - d + s, y + d - s]) for (let k = x - w + s; k <= x + w - s + 1e-6; k += 0.125) box(g, k, yy, s, s, z, 4, c, { ol: 'rgba(0,0,0,0.25)' }); }
  else { for (const xx of [x - w + s, x + w - s]) for (let k = y - d + s; k <= y + d - s + 1e-6; k += 0.125) box(g, xx, k, s, s, z, 4, c, { ol: 'rgba(0,0,0,0.25)' }); }
}
function fxPalisadeArt(g, mask) {
  const m = mask || 3, st = [[0, 0]];
  const run = (dx, dy) => { for (let k = 0.11; k <= 0.5 + 1e-6; k += 0.11) st.push([dx * k, dy * k]); };
  if (m & 1) run(1, 0); if (m & 2) run(-1, 0); if (m & 4) run(0, 1); if (m & 8) run(0, -1);
  st.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [x, y] of st) {
    const hh = 20 + ((Math.abs(x * 97 + y * 61) * 10) | 0) % 4, a = P(x, y, 0), b = P(x, y, hh);
    g.lineCap = 'butt'; g.strokeStyle = '#6e4a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = '#94653a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(a[0] - 1.2, a[1]); g.lineTo(b[0] - 1.2, b[1]); g.stroke();
    g.fillStyle = '#a87a48'; g.beginPath(); g.moveTo(b[0] - 2.5, b[1]); g.lineTo(b[0], b[1] - 5); g.lineTo(b[0] + 2.5, b[1]); g.fill();
  }
  // binding rails along each run
  g.strokeStyle = 'rgba(60,38,18,0.85)'; g.lineWidth = 1.2;
  for (const z of [6, 15]) for (const [bit, dx, dy] of [[1, 1, 0], [2, -1, 0], [4, 0, 1], [8, 0, -1]]) if (m & bit) {
    const a = P(0, 0, z), b = P(dx * 0.5, dy * 0.5, z); g.beginPath(); g.moveTo(a[0], a[1] + 1); g.lineTo(b[0], b[1] + 1); g.stroke();
  }
}
function fxGateArt(g, c, pc, mask, open) {
  const ax = fxGateAlongX(mask), H = 36, T = 0.2;
  const post = (x, y) => { box(g, x, y, 0.13, 0.13, 0, H, c, { bricks: true }); crenel(g, x, y, 0.13, 0.13, H, c); };
  const [p0, p1] = ax ? [[-0.37, 0], [0.37, 0]] : [[0, -0.37], [0, 0.37]];
  post(p0[0], p0[1]);
  if (ax) {
    box(g, 0, 0, 0.25, T, 24, 9, c, { bricks: true }); fxMerlons(g, 0, 0, 0.25, T, 33, c);
    poly(g, [P(-0.24, T, 0), P(0.24, T, 0), P(0.24, T, 24), P(-0.24, T, 24)], open ? 'rgba(25,16,8,0.92)' : '#5a3a1e', 'rgba(0,0,0,0.5)');
    if (!open) { g.strokeStyle = 'rgba(30,20,10,0.7)'; g.lineWidth = 1; for (let k = -0.16; k <= 0.17; k += 0.08) { const a = P(k, T, 1), b = P(k, T, 23); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    else { g.strokeStyle = 'rgba(70,70,74,0.8)'; g.lineWidth = 1; for (let k = -0.16; k <= 0.17; k += 0.08) { const a = P(k, T, 17), b = P(k, T, 23); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
  } else {
    box(g, 0, 0, T, 0.25, 24, 9, c, { bricks: true }); fxMerlons(g, 0, 0, T, 0.25, 33, c);
    poly(g, [P(T, -0.24, 0), P(T, 0.24, 0), P(T, 0.24, 24), P(T, -0.24, 24)], open ? 'rgba(25,16,8,0.92)' : '#4e3219', 'rgba(0,0,0,0.5)');
    if (!open) { g.strokeStyle = 'rgba(30,20,10,0.7)'; g.lineWidth = 1; for (let k = -0.16; k <= 0.17; k += 0.08) { const a = P(T, k, 1), b = P(T, k, 23); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
  }
  post(p1[0], p1[1]);
  flag(g, p1[0], p1[1], H + 4, pc.c, 0.3, 0.7);
}
function fxWallSprite(type, st, pc, mask, open) {
  const key = 'fxw|' + type + '|' + st + '|' + pc.c + '|' + mask + '|' + (open ? 1 : 0);
  let s = R.spriteCache.get(key); if (s) return s;
  const SC = 2, w = TW + 60, h = TH + (BLD_H[type] || 40) + 60;
  const cv = fxCanvas(w * SC, h * SC), g = cv.getContext('2d'); g.scale(SC, SC);
  const ax = w / 2, ay = h - TH / 2 - 14; g.translate(ax, ay);
  fxWallArt(g, type, st, pc, mask, open);
  s = { cv, ax, ay, w, h, SC }; R.spriteCache.set(key, s); return s;
}

// ---------- 2. shadows + 9. glints (terrain pass, under all sprites) ----------
function fxGrow(pts, d) {
  let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= pts.length; cy /= pts.length;
  return pts.map(p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1, k = Math.max(0.2, (l + d) / l); return [cx + dx * k, cy + dy * k]; });
}
// One path per layer: overlapping shadows inside a single fill() never double-darken (nonzero union).
// Two layers (wide faint + narrow core) give a cheap soft edge without blur or an offscreen blit.
function fxShadowPass(ctx) {
  const map = W.map, polys = [], ells = [];
  for (const e of FX.visList) {
    if (e.kind === 'bld') {
      const d = BUILDINGS[e.type]; if (d.farm) continue;
      const s = d.size, prog = e.built ? 1 : Math.max(0, e.progress || 0); if (prog < 0.05) continue;
      const h = (BLD_H[e.type] || 50) * 0.62 * prog;
      const hh = d.water ? -0.35 : map.h(e.x + s / 2, e.y + s / 2);
      polys.push(fxShadowPoly(e.x, e.y, s, hh, h, d.wall || d.gate ? 0.28 : 0.05));
    } else if (e.kind === 'unit' && !e.dying) {
      const d = UNITS[e.type]; if (d.naval || d.animal || d.tags.includes('mounted')) continue;
      const big = d.tags.includes('siege'), p = iso(e.x, e.y, map.h(e.x, e.y));
      ells.push(p.x + 3, p.y + 1, big ? 15 : 7.5, big ? 6.5 : 3.4);
    }
  }
  if (!polys.length && !ells.length) return;
  ctx.fillStyle = '#000';
  for (const [grow, al, eg] of [[2.5, 0.1, 1.6], [-2, 0.17, -1]]) {
    ctx.beginPath();
    for (const pp of polys) { const q = fxGrow(pp, grow); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); }
    for (let i = 0; i < ells.length; i += 4) { const rx = Math.max(1, ells[i + 2] + eg), ry = Math.max(0.5, ells[i + 3] + eg * 0.5); ctx.moveTo(ells[i] + rx, ells[i + 1]); ctx.ellipse(ells[i], ells[i + 1], rx, ry, 0, 0, 6.2832); }
    ctx.globalAlpha = al; ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function fxGlints(ctx) {
  const map = W.map, n = map.n, v = FX.view, t = R.time, hum = W.players[W.humanId];
  const toT = (wx, wy) => [(wx / (TW / 2) + wy / (TH / 2)) / 2, (wy / (TH / 2) - wx / (TW / 2)) / 2];
  const cs = [toT(v.x0, v.y0), toT(v.x1, v.y0), toT(v.x0, v.y1), toT(v.x1, v.y1)];
  const tx0 = Math.max(0, Math.floor(Math.min(cs[0][0], cs[1][0], cs[2][0], cs[3][0]))), tx1 = Math.min(n - 1, Math.ceil(Math.max(cs[0][0], cs[1][0], cs[2][0], cs[3][0])));
  const ty0 = Math.max(0, Math.floor(Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1]))), ty1 = Math.min(n - 1, Math.ceil(Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1])));
  ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 1.1;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * n + tx; if (!isWaterT(map.ter[i])) continue;
    if (hum && !hum.explored[i]) continue;
    const hsh = ((tx * 73856093) ^ (ty * 19349663)) >>> 0, a = Math.sin(t * 1.1 + (hsh % 1000) * 0.006283);
    if (a < 0.6) continue;
    const ix = (tx - ty) * TW / 2, iy = (tx + ty + 1) * TH / 2 + 0.35 * EH;
    if (ix < v.x0 || ix > v.x1 || iy < v.y0 || iy > v.y1) continue;
    const ox = ((hsh >> 10) % 30) - 15, oy = ((hsh >> 16) % 12) - 6;
    ctx.globalAlpha = (a - 0.6) / 0.4 * (map.ter[i] === T.SHALLOW ? 0.3 : 0.45);
    ctx.beginPath(); ctx.moveTo(ix + ox - 5, iy + oy); ctx.quadraticCurveTo(ix + ox, iy + oy - 2, ix + ox + 5, iy + oy); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function fxFishRipples(ctx) {
  ctx.lineWidth = 1;
  for (const e of FX.visList) {
    if (e.type !== 'fish') continue;
    for (let k = 0; k < 2; k++) {
      const per = 2.6 + k * 0.9, ph = R.time / per + e.id * 0.37 + k * 0.5, cyc = Math.floor(ph), f = ph - cyc;
      const rng = mulberry32(e.id * 977 + cyc * 13 + k); if (rng() < 0.45) continue;
      const p = iso(e.x + 0.5 + (rng() - 0.5) * 2.2, e.y + 0.5 + (rng() - 0.5) * 2.2, -0.35);
      if (!W.map.isWater(Math.floor(e.x + 0.5), Math.floor(e.y + 0.5))) continue;
      ctx.strokeStyle = `rgba(235,248,255,${0.5 * (1 - f)})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2 + f * 11, 1 + f * 5, 0, 0, 6.2832); ctx.stroke();
    }
  }
}
function fxCollectVisible() {
  const out = FX.visList || (FX.visList = []); out.length = 0;
  for (const e of W.list) {
    if (e.kind === 'unit' && e.inside) continue;
    if (e.kind !== 'bld' && e.kind !== 'unit' && e.type !== 'fish') continue;
    const c = center(e), p = iso(c.x, c.y, 0);
    if (!fxInView(p.x, p.y, 60)) continue;
    if (!fxSeen(e)) continue;
    out.push(e);
  }
}

// ---------- 6. decals: corpses, stuck arrows, craters ----------
function fxCorpseSprite(c) {
  const key = 'corpse|' + c.type + '|' + c.owner + '|' + (c.id % 4) + '|' + c.face;
  let s = FX.sprites.get(key); if (s) return s;
  s = fxCanvas(110, 80); const g = s.getContext('2d'); g.translate(55, 55); g.scale(c.face * US, US); g.rotate(-1.45); g.translate(-3, 0);
  try { drawUnitFigure(g, c.snap, 0); } catch (e) { }
  FX.sprites.set(key, s); return s;
}
function fxAddCorpse(u) {
  if (!FX.on.decals || FX.corpseIds.has(u.id) || !UNITS[u.type] || UNITS[u.type].naval) return;
  FX.corpseIds.add(u.id);
  const snap = Object.assign({}, u, { anim: 'idle', work: null, carry: null, rank: 0, dying: false });
  FX.corpses.push({ id: u.id, type: u.type, owner: u.owner, face: u.face || 1, x: u.x, y: u.y, t: W.t - Math.max(0, (u.dieT || 0) - 0.6), snap, blood: !hasTag(u.type, 'machine') });
  if (FX.corpses.length > 400) { const o = FX.corpses.shift(); FX.corpseIds.delete(o.id); }
}
function fxDecalPass(ctx) {
  const map = W.map, now = W.t;
  // craters
  for (let i = FX.craters.length - 1; i >= 0; i--) {
    const c = FX.craters[i], age = now - c.t; if (age > 40) { FX.craters.splice(i, 1); continue; }
    const p = iso(c.x, c.y, map.h(c.x, c.y)); if (!fxInView(p.x, p.y, 30) || !isExploredForHuman(c.x, c.y)) continue;
    const a = Math.min(1, (40 - age) / 10) * 0.85, r = 7 + c.r * 7;
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(60,44,28,0.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.3, r * 0.65, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(30,22,14,0.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.75, r * 0.36, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(150,120,80,0.5)'; const rng = mulberry32(c.seed);
    for (let k = 0; k < 6; k++) { const an = rng() * 6.283; ctx.fillRect(p.x + Math.cos(an) * r * 1.4, p.y + Math.sin(an) * r * 0.7, 2, 1.5); }
  }
  ctx.globalAlpha = 1;
  // corpses
  for (let i = FX.corpses.length - 1; i >= 0; i--) {
    const c = FX.corpses[i], age = now - c.t; if (age > 25) { FX.corpses.splice(i, 1); FX.corpseIds.delete(c.id); continue; }
    const p = iso(c.x, c.y, map.h(c.x, c.y)); if (!fxInView(p.x, p.y, 40)) continue;
    if (c.owner !== W.humanId && !fxTileVisible(c.x, c.y)) continue;
    const a = age < 20 ? 1 : (25 - age) / 5;
    if (c.blood) { ctx.globalAlpha = a * 0.55 * Math.min(1, age / 2 + 0.3); ctx.fillStyle = '#5a0e0c'; ctx.beginPath(); ctx.ellipse(p.x - c.face * 4, p.y + 1, 8, 3.4, 0, 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = a; ctx.drawImage(fxCorpseSprite(c), p.x - 55, p.y - 55);
  }
  ctx.globalAlpha = 1;
  // stuck arrows (own + another module's W.missFx)
  const draw = (m) => {
    const age = now - m.t; if (age > 22 || age < 0) return age <= 22;
    const p = iso(m.x, m.y, map.h(m.x, m.y)); if (!fxInView(p.x, p.y, 20) || !isExploredForHuman(m.x, m.y)) return true;
    const ang = m.ang || 0, dx = Math.cos(ang) - Math.sin(ang), dy = (Math.cos(ang) + Math.sin(ang)) * 0.5, l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l, tx = p.x - ux * 6, ty = p.y - uy * 3 - 5;
    ctx.globalAlpha = age > 18 ? (22 - age) / 4 : 1;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#eee'; ctx.fillRect(tx - 1.2, ty - 1.2, 2.4, 2.4);
    return true;
  };
  for (let i = FX.arrows.length - 1; i >= 0; i--) if (!draw(FX.arrows[i])) FX.arrows.splice(i, 1);
  if (Array.isArray(W.missFx)) for (const m of W.missFx) if (m && typeof m.x === 'number') draw(m);
  ctx.globalAlpha = 1;
}

// ---------- 5. particles ----------
function fxPart(o) {
  if (FX.parts.length >= FX.MAXP) return null;
  const p = Object.assign({ vx: 0, vy: 0, z: 0, vz: 0, g: 0, drag: 0, grow: 0, life: 0, max: 1, size: 2, alpha: 1, bounce: 0, rot: 0, vr: 0, add: false }, o);
  FX.parts.push(p); return p;
}
const FX_ADD = { fire: 1, ember: 1, spark: 1 };
function fxSmoke(x, y, z, dark, s) {
  fxPart({ kind: dark ? 'dsmoke' : 'smoke', x: x + (Math.random() - 0.5) * 3, y, z, vx: 5 + Math.random() * 5, vz: 13 + Math.random() * 7, drag: 0.35, size: 3 * (s || 1), grow: (dark ? 6.5 : 5) * (s || 1), max: 2.6 + Math.random() * 1.2, alpha: dark ? 0.5 : 0.32 });
}
function fxDustAt(x, y, n, s) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (8 + Math.random() * 18) * (s || 1); fxPart({ kind: 'dust', x, y, z: 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 4 + Math.random() * 6, drag: 2.4, size: (2.5 + Math.random() * 2) * (s || 1), grow: 9 * (s || 1), max: 0.7 + Math.random() * 0.6, alpha: 0.5 }); }
}
function fxBurst(kind, x, y, z, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = 15 + Math.random() * 30;
    if (kind === 'spark') fxPart({ kind, x, y, z, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 0.6, vz: 25 + Math.random() * 35, g: 140, size: 1.3, max: 0.35 + Math.random() * 0.25, bounce: 0.35, col: '#ffe9a0', add: true });
    else if (kind === 'chip') fxPart({ kind, x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: 20 + Math.random() * 30, g: 150, size: 1.3 + Math.random(), max: 0.9 + Math.random() * 0.5, bounce: 0.4, col, vr: (Math.random() - 0.5) * 20 });
    else if (kind === 'drop') fxPart({ kind, x, y, z, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * 0.3, vz: 12 + Math.random() * 18, g: 130, size: 1.1 + Math.random() * 0.6, max: 0.7 + Math.random() * 0.4, bounce: 0, col: Math.random() < 0.5 ? '#8a1010' : '#b01818' });
    else if (kind === 'debris') fxPart({ kind, x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 14, z: z + Math.random() * 20, vx: Math.cos(a) * v * 1.6, vy: Math.sin(a) * v * 0.8, vz: 40 + Math.random() * 60, g: 160, size: 2 + Math.random() * 3, max: 1.8 + Math.random() * 1.2, bounce: 0.3, col, vr: (Math.random() - 0.5) * 14 });
    else if (kind === 'ember') fxPart({ kind, x: x + (Math.random() - 0.5) * 8, y, z, vx: (Math.random() - 0.5) * 14 + 4, vz: 22 + Math.random() * 26, drag: 0.6, size: 1 + Math.random() * 0.8, max: 0.9 + Math.random() * 0.8, add: true });
  }
}
function fxUpdateParts(dt) {
  const A = FX.parts; let w = 0;
  for (let i = 0; i < A.length; i++) {
    const p = A[i]; p.life += dt; if (p.life >= p.max) continue;
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; if (!p.g) p.vz *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.size += p.grow * dt; p.rot += p.vr * dt;
    if (p.g && p.z < 0) { p.z = 0; if (p.bounce && Math.abs(p.vz) > 12) { p.vz = -p.vz * p.bounce; p.vx *= 0.55; p.vy *= 0.55; } else { p.vz = 0; p.vx *= 0.3; p.vy *= 0.3; p.vr = 0; p.g = 0; p.rest = true; } }
    A[w++] = p;
  }
  A.length = w;
}
function fxDrawParts(ctx) {
  const A = FX.parts; if (!A.length) return;
  const sl = fxSmokeL(), sd = fxSmokeD(), du = fxDust(), gl = fxGlow();
  for (let pass = 0; pass < 2; pass++) {
    if (pass) ctx.globalCompositeOperation = 'lighter';
    for (const p of A) {
      if (!!FX_ADD[p.kind] !== !!pass) continue;
      const sx = p.x, sy = p.y - p.z; if (!fxInView(sx, sy, 40)) continue;
      const k = p.life / p.max;
      switch (p.kind) {
        case 'smoke': case 'dsmoke': case 'dust': {
          const s = Math.max(1, p.size); ctx.globalAlpha = p.alpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
          ctx.drawImage(p.kind === 'smoke' ? sl : p.kind === 'dsmoke' ? sd : du, sx - s, sy - s, s * 2, s * 2); break;
        }
        case 'chip': case 'debris': {
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1; ctx.fillStyle = p.col;
          if (p.kind === 'chip') ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size * 0.8);
          else { ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-p.size, 0, p.size * 2, p.size * 0.6); ctx.restore(); }
          break;
        }
        case 'drop': ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.col; ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.rest ? p.size * 0.6 : p.size); break;
        case 'spark': ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.03, sy + p.vz * 0.03 - p.vy * 0.03); ctx.stroke(); break;
        case 'ember': { ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(p.life * 30 + p.x)); ctx.fillStyle = k < 0.5 ? '#ffd27a' : '#ff7a2a'; ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size); break; }
        case 'fire': { const s = p.size * (1 - k * 0.6); ctx.globalAlpha = 0.9 * (1 - k); ctx.drawImage(gl, sx - s, sy - s, s * 2, s * 2); break; }
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function fxFireSpot(ctx, x, y, s, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = (9 + Math.sin(t * 9) * 1.5) * s; ctx.globalAlpha = 0.55; ctx.drawImage(fxGlow(), x - r, y - r * 1.2, r * 2, r * 2);
  ctx.globalAlpha = 0.35; ctx.drawImage(fxGlowW(), x - r * 0.5, y - r * 0.9, r, r);
  ctx.restore();
  drawFlame(ctx, x, y, s * 0.8, t);
}
function fxBuildingEffects(ctx, b) {
  const d = BUILDINGS[b.type]; if (d.farm || !b.built) return;
  const s = d.size, c = center(b), gp = iso(c.x, c.y, d.water ? -0.35 : W.map.h(c.x, c.y)), dt = FX.sdt;
  const H = BLD_H[b.type] || 50, st = bldStyle(b);
  // chimneys
  if (dt > 0) {
    let ch = null, rate = 0, dark = false;
    if (b.type === 'house') { ch = P(0.35, -0.2, st >= 2 ? 38 : 31); rate = 1.3; }
    else if (b.type === 'tc') { ch = P(0.9, -0.6, 37); rate = 1.6; }
    else if (b.type === 'blacksmith') { ch = P(0.6, -0.5, 40); rate = 3.2; dark = true; }
    if (ch && Math.random() < dt * rate) fxSmoke(gp.x + ch[0], gp.y + ch[1] + 40, 40, dark, 0.8); // z offset keeps them in front-to-back order
  }
  // damage: fire spots multiply as hp drops, with dark smoke columns and embers
  const f = b.hp / b.maxhp;
  if (f < 0.75) {
    const dmg = (0.75 - f) / 0.75, nSpots = Math.max(1, Math.min(6, Math.ceil(dmg * 6)));
    for (let k = 0; k < nSpots; k++) {
      const rng = mulberry32(b.id * 31 + k * 7 + 1);
      const fx = (rng() - 0.5) * s * 0.8, fy = (rng() - 0.5) * s * 0.8, fz = H * (0.25 + rng() * 0.35);
      const p = P(fx, fy, fz), x = gp.x + p[0], y = gp.y + p[1];
      fxFireSpot(ctx, x, y, 0.75 + dmg * 0.6, R.time + k * 1.7);
      if (dt > 0) {
        if (Math.random() < dt * (1.6 + dmg * 3)) fxSmoke(x, y + fz, fz, true, 1 + dmg);
        if (Math.random() < dt * (1 + dmg * 4)) fxBurst('ember', x, y + fz, fz, 1);
      }
    }
  }
}

// ---------- 7. birds ----------
function fxBirds(ctx) {
  const n = W.n;
  if (!FX.birds) {
    const rng = mulberry32(((W.settings && W.settings.seed) || 7) * 131 + n);
    FX.birds = Array.from({ length: Math.max(2, Math.round(n / 30)) }, () => ({ cx: 8 + rng() * (n - 16), cy: 8 + rng() * (n - 16), r: 2.5 + rng() * 4, w: (0.25 + rng() * 0.2) * (rng() < 0.5 ? -1 : 1), a0: rng() * 6.283, z: 90 + rng() * 50, ph: rng() * 10, dr: rng() * 6.283 }));
  }
  const t = R.time;
  for (const b of FX.birds) {
    const cx = b.cx + Math.sin(t * 0.02 + b.dr) * 6, cy = b.cy + Math.cos(t * 0.017 + b.dr) * 6;
    const a = b.a0 + b.w * t, x = cx + Math.cos(a) * b.r, y = cy + Math.sin(a) * b.r;
    if (x < 1 || y < 1 || x > n - 1 || y > n - 1 || !isExploredForHuman(x, y)) continue;
    const h = Math.max(0, W.map.h(x, y)), g = iso(x, y, h);
    if (!fxInView(g.x, g.y - b.z, 60)) continue;
    const hx = -Math.sin(a) * Math.sign(b.w), hy = Math.cos(a) * Math.sign(b.w); // heading (tile space)
    let fx = hx - hy, fy = (hx + hy) * 0.5; const l = Math.hypot(fx, fy) || 1; fx /= l; fy /= l;
    const px = -fy, py = fx, ph = t + b.ph;
    const flap = Math.floor(ph / 2.5) % 2 ? Math.sin(ph * 10) * 2.4 : 0.5;
    const wing = (sx, sy, col, w) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(sx + px * 9 - fx * 2, sy + py * 9 - flap - fy * 2);
      ctx.quadraticCurveTo(sx + px * 4, sy + py * 4 - flap * 0.6 - 2, sx, sy);
      ctx.quadraticCurveTo(sx - px * 4, sy - py * 4 - flap * 0.6 - 2, sx - px * 9 - fx * 2, sy - py * 9 - flap - fy * 2);
      ctx.stroke();
    };
    ctx.globalAlpha = 0.16; wing(g.x + FX.LX * b.z, g.y + FX.LY * b.z, '#000', 2.4);
    ctx.globalAlpha = 0.92; wing(g.x, g.y - b.z, '#2a2018', 2);
    ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.ellipse(g.x + fx * 1.5, g.y - b.z + fy * 1.5, 1.9, 1.1, Math.atan2(fy, fx), 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

// ---------- 3. fog fade, 4. clouds + vignette ----------
// Fog and cloud shadows share the one n x n tile-space canvas the engine already blits, so clouds cost
// no extra full-screen draw: alpha = 1 - (1 - fog) * (1 - cloud), clouds sampled from tileable fbm.
function fxRaining() { const w = W.weather; return !!(w && (w === 'rain' || w === 'storm' || w.rain || w.type === 'rain' || w.type === 'storm')) || !!W.raining; }
function fxFog(ctx) {
  const n = W.n, human = W.players[W.humanId];
  if (!R.fogCv || R.fogCv.width !== n) { R.fogCv = fxCanvas(n, n); R.fogImg = R.fogCv.getContext('2d').createImageData(n, n); FX.fogA = null; }
  const d = R.fogImg.data;
  let dirty = false;
  if (!FX.fogA || FX.fogA.length !== n * n || FX.fogW !== W) {
    FX.fogA = new Float32Array(n * n); FX.fogW = W; dirty = true;
    for (let i = 0; i < n * n; i++) FX.fogA[i] = human.visible[i] ? 0 : human.explored[i] ? 115 : 255;
  } else dirty = fxFogStep(FX.fogA, human.visible, human.explored, FX.on.fogfade ? 1 - Math.exp(-FX.rdt * 7) : 1, null);
  const A = FX.fogA;
  if (FX.on.clouds) {
    if (!FX.cloud) FX.cloud = fxNoise(128, 4242, 5);
    const C = FX.cloud, S = 128, rain = fxRaining(), str = rain ? 0.26 : 0.15, thr = rain ? 0.38 : 0.47;
    const st = 3.6, ox = R.time * 0.8, oy = R.time * 0.36;
    for (let y = 0, i = 0; y < n; y++) {
      const fy = y * st + oy, iy = Math.floor(fy), ty = fy - iy, y0 = ((iy % S) + S) % S * S, y1 = (((iy + 1) % S) + S) % S * S;
      for (let x = 0; x < n; x++, i++) {
        const fx = x * st + ox, ix = Math.floor(fx), tx = fx - ix, x0 = ((ix % S) + S) % S, x1 = (x0 + 1) % S;
        const v = (C[y0 + x0] * (1 - tx) + C[y0 + x1] * tx) * (1 - ty) + (C[y1 + x0] * (1 - tx) + C[y1 + x1] * tx) * ty;
        let c = (v - thr) * 3.4; c = c <= 0 ? 0 : c >= 1 ? str : c * c * (3 - 2 * c) * str;
        d[i * 4 + 3] = 255 - (255 - A[i]) * (1 - c);
      }
    }
    dirty = true;
  } else if (dirty || FX.cloudWas) { for (let i = 0; i < n * n; i++) d[i * 4 + 3] = A[i]; dirty = true; }
  FX.cloudWas = FX.on.clouds;
  if (dirty) R.fogCv.getContext('2d').putImageData(R.fogImg, 0, 0);
  const z = R.cam.zoom;
  ctx.save();
  ctx.setTransform(z * TW / 2, z * TH / 2, -z * TW / 2, z * TH / 2, R.cw / 2 - R.cam.x * z, R.ch / 2 - R.cam.y * z - 0.6 * EH * z);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(R.fogCv, 0, 0);
  ctx.restore(); camTransform(ctx);
}
// Vignette is a CSS overlay above the canvas (pointer-events: none): free for the canvas rasterizer.
function fxVignette(show) {
  if (typeof document === 'undefined' || !R.cv) return;
  let v = FX.vig;
  if (!v) {
    v = FX.vig = document.createElement('div');
    v.style.cssText = 'position:fixed;pointer-events:none;display:none;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(8,6,4,0.16) 78%, rgba(8,6,4,0.42) 100%)';
    R.cv.insertAdjacentElement('afterend', v);
  }
  if (!show) { if (v.style.display !== 'none') v.style.display = 'none'; return; }
  const now = performance.now();
  if (!FX.vigT || now - FX.vigT > 500 || v.style.display === 'none') {
    FX.vigT = now; const r = R.cv.getBoundingClientRect();
    Object.assign(v.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
}
// ---------- 8. rally flag, target flash ----------
function fxRally(ctx) {
  const t = R.time, pc = W.players[W.humanId].color;
  for (const b of UI.selection) {
    if (b.kind !== 'bld' || !b.rally || b.owner !== W.humanId || b.dead) continue;
    const c = center(b), a = iso(c.x, c.y, W.map.h(c.x, c.y)), p = iso(b.rally.x, b.rally.y, W.map.h(b.rally.x, b.rally.y));
    ctx.save(); ctx.setLineDash([5, 4]); ctx.lineDashOffset = -performance.now() / 60; ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(a.x, a.y + 1); ctx.lineTo(p.x, p.y + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 2.4, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 26); ctx.stroke();
    // waving cloth: strip of quads with a travelling sine
    const N = 7, L = 15, Hh = 9, top = p.y - 26; const ys = [];
    for (let i = 0; i <= N; i++) { const u = i / N; ys.push(Math.sin(t * 6 - u * 5) * 2.2 * u); }
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N, x0 = p.x + u0 * L, x1 = p.x + u1 * L;
      const sh = 0.8 + 0.35 * Math.cos(t * 6 - (u0 + 0.5 / N) * 5);
      ctx.fillStyle = shade(pc.c, sh); ctx.beginPath();
      ctx.moveTo(x0, top + ys[i]); ctx.lineTo(x1 + 0.4, top + ys[i + 1]); ctx.lineTo(x1 + 0.4, top + Hh + ys[i + 1] - u1 * 1.5); ctx.lineTo(x0, top + Hh + ys[i] - u0 * 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e8c860'; ctx.beginPath(); ctx.arc(p.x, p.y - 27, 1.5, 0, 6.2832); ctx.fill();
  }
}
function fxTint(ctx, e, drawFn) {
  const fl = FX.flash; const k = (performance.now() - fl.t0) / 600; if (k >= 1) { FX.flash = null; return; }
  let ax, ay, w, h;
  const c = center(e);
  const gp = iso(c.x, c.y, e.kind === 'unit' && UNITS[e.type].naval ? -0.35 : e.kind === 'bld' && BUILDINGS[e.type].water ? -0.35 : W.map.h(c.x, c.y));
  if (e.kind === 'bld') { const s = BUILDINGS[e.type].size; w = s * TW + 80; h = s * TH + (BLD_H[e.type] || 60) + 80; ax = w / 2; ay = h - s * TH / 2 - 24; }
  else if (e.kind === 'unit') { w = 120; h = 120; ax = 60; ay = 95; }
  else { w = 110; h = 135; ax = 55; ay = 118; }
  const z = Math.min(3, Math.max(1, R.cam.zoom)), W2 = Math.ceil(w * z), H2 = Math.ceil(h * z); // render at screen scale so the tint stays crisp
  if (!FX.off || FX.off.width < W2 || FX.off.height < H2) { FX.off = fxCanvas(Math.max(W2, FX.off ? FX.off.width : 0), Math.max(H2, FX.off ? FX.off.height : 0)); FX.offG = FX.off.getContext('2d'); }
  const g = FX.offG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W2, H2);
  g.setTransform(z, 0, 0, z, (ax - gp.x) * z, (ay - gp.y) * z);
  FX.mute = 'all'; try { drawFn(g); } catch (err) { } FX.mute = null;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = fl.col; g.fillRect(0, 0, W2, H2); g.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.5) + 0.05;
  ctx.drawImage(FX.off, 0, 0, W2, H2, gp.x - ax, gp.y - ay, w, h); ctx.restore();
}

// ---------- engine hooks ----------
if (!fxOff('fx') && typeof drawTerrain === 'function') {
  const _drawTerrain = drawTerrain;
  drawTerrain = function (ctx) {
    const r = _drawTerrain.apply(this, arguments);
    if (!fxActive()) { if (FX.vig) fxVignette(false); return r; }
    fxFrame();
    fxCollectVisible();
    if (FX.on.glints) { fxGlints(ctx); fxFishRipples(ctx); }
    if (FX.on.decals) fxDecalPass(ctx);
    if (FX.on.shadows) fxShadowPass(ctx);
    if (FX.on.particles && FX.sdt > 0) fxUpdateParts(FX.sdt);
    return r;
  };
}
if (!fxOff('fx') && typeof drawFog === 'function') {
  const _drawFog = drawFog;
  drawFog = function (ctx) {
    if (!fxActive() || !FX.view) return _drawFog.apply(this, arguments);
    if (FX.on.particles) fxDrawParts(ctx);
    if (FX.on.fogfade || FX.on.clouds) fxFog(ctx); else _drawFog.apply(this, arguments);
    if (FX.on.birds) fxBirds(ctx);
  };
}
if (!fxOff('fx') && typeof bldSprite === 'function') {
  const _bldSprite = bldSprite;
  bldSprite = function (type, st, pc) {
    if (FX.wallMask !== undefined && FX.wallMask !== null && fxIsWallType(type)) return fxWallSprite(type, st, pc, FX.wallMask, FX.wallOpen);
    return _bldSprite.apply(this, arguments);
  };
}
if (!fxOff('fx') && typeof drawBuilding === 'function') {
  const _drawBuilding = drawBuilding;
  FX.baseDrawBuilding = _drawBuilding;
  drawBuilding = function (ctx, b, alpha) {
    if (!fxActive()) return _drawBuilding.apply(this, arguments);
    const wall = FX.on.walls && fxIsWallType(b.type);
    const hp = b.hp, open = b.open, quiet = FX.on.particles;
    if (wall) { FX.wallMask = fxWallMaskFor(b); FX.wallOpen = b.type === 'gate' && !!b.open && b.built; if (b.type === 'gate') b.open = false; }
    if (quiet && b.built && hp < b.maxhp * 0.75) b.hp = b.maxhp; // our own fire spots replace the stock flames
    if (quiet && !FX.mute) FX.mute = 'smoke';
    try { _drawBuilding.apply(this, arguments); }
    finally { b.hp = hp; if (wall) { b.open = open; FX.wallMask = null; } if (FX.mute === 'smoke') FX.mute = null; }
    if (quiet && FX.mute !== 'all') fxBuildingEffects(ctx, b);
    if (FX.flash && FX.flash.e === b && FX.mute !== 'all') fxTint(ctx, b, g => drawBuilding(g, b));
  };
}
if (!fxOff('fx') && typeof drawUnit === 'function') {
  const _drawUnit = drawUnit;
  drawUnit = function (ctx, u, sel) {
    if (!fxActive()) return _drawUnit.apply(this, arguments);
    if (u.dying && FX.on.decals) { if ((u.dieT || 0) >= 0.6) { fxAddCorpse(u); return; } return _drawUnit.apply(this, arguments); }
    const r = _drawUnit.apply(this, arguments);
    if (FX.mute === 'all') return r;
    const d = UNITS[u.type];
    if (FX.on.particles && FX.sdt > 0 && u.anim === 'walk' && d.tags.includes('mounted') && Math.random() < FX.sdt * 9) {
      const p = iso(u.x, u.y, W.map.h(u.x, u.y));
      fxPart({ kind: 'dust', x: p.x - (u.face || 1) * 8 + (Math.random() - 0.5) * 6, y: p.y + 1, z: 1, vx: -(u.face || 1) * (6 + Math.random() * 6), vz: 5 + Math.random() * 5, drag: 1.5, size: 2.5, grow: 7, max: 0.7 + Math.random() * 0.4, alpha: 0.45 });
    }
    if (FX.flash && FX.flash.e === u) fxTint(ctx, u, g => _drawUnit(g, u, null));
    return r;
  };
}
if (!fxOff('fx') && typeof drawRes === 'function') {
  const _drawRes = drawRes;
  drawRes = function (ctx, e) {
    const r = _drawRes.apply(this, arguments);
    if (FX.flash && FX.flash.e === e && FX.mute !== 'all' && fxActive()) fxTint(ctx, e, g => _drawRes(g, e));
    return r;
  };
}
if (!fxOff('fx') && typeof drawFx === 'function') {
  const _drawFx = drawFx;
  drawFx = function (ctx, f) {
    if (!FX.on.particles || !fxActive()) return _drawFx.apply(this, arguments);
    const a = iso(f.x, f.y, W.map.h(f.x, f.y)), x = a.x, y = a.y - f.z * EH, k = f.life / f.max;
    const puff = (img, cx, cy, r, al) => { ctx.globalAlpha = Math.max(0, al); ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); ctx.globalAlpha = 1; };
    switch (f.type) {
      case 'smoke': puff(fxSmokeD(), x, y - 20 - k * 8, 5 + k * 12, 0.42 * (1 - k)); break;
      case 'dust': puff(fxDust(), x, y - 4, 3 + k * 8, 0.55 * (1 - k)); break;
      case 'impact': puff(fxDust(), x, y - 4, 5 + k * 16, 0.65 * (1 - k)); break;
      case 'collapse': puff(fxDust(), x, y - 8, 9 + k * 24, 0.6 * (1 - k)); break;
      case 'explosion':
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; puff(fxGlow(), x, y - 6, 6 + k * 18, 1 - k); puff(fxGlowW(), x, y - 6, 3 + k * 8, 0.8 * (1 - k)); ctx.restore();
        puff(fxSmokeD(), x + 4, y - 14 - k * 12, 4 + k * 12, 0.55 * (1 - k)); break;
      case 'fire':
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; puff(fxGlow(), x, y - 5, 7 * (1 - k) + 3, 0.9 * (1 - k)); ctx.restore();
        drawFlame(ctx, x, y, 0.4 * (1 - k) + 0.15, R.time + f.r * 5);
        if (FX.sdt > 0 && Math.random() < FX.sdt * 3) fxBurst('ember', x, y, 4, 1);
        break;
      case 'blood': ctx.fillStyle = `rgba(140,16,16,${0.9 * (1 - k)})`; ctx.fillRect(x - 0.7, y - 7, 1.4, 1.4); break;
      default: return _drawFx.apply(this, arguments);
    }
  };
}
if (!fxOff('fx') && typeof drawOverlays === 'function') {
  const _drawOverlays = drawOverlays;
  drawOverlays = function (ctx) {
    if (!fxActive()) { fxVignette(false); return _drawOverlays.apply(this, arguments); }
    const stash = [];
    if (FX.on.rally) for (const b of UI.selection) if (b.kind === 'bld' && b.rally && b.owner === W.humanId) { stash.push([b, b.rally]); b.rally = null; }
    try { _drawOverlays.apply(this, arguments); } finally { for (const [b, r] of stash) b.rally = r; }
    if (stash.length) { camTransform(ctx); fxRally(ctx); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    fxVignette(FX.on.vignette);
  };
}
if (!fxOff('fx') && typeof rightClick === 'function') {
  const _rightClick = rightClick;
  rightClick = function (sx, sy, t) {
    let target = null, sel = null;
    if (FX.on.flash && W && typeof hitTest === 'function') { sel = UI.selection.filter(e => e.owner === W.humanId); if (sel.length && sel[0].kind === 'unit') target = hitTest(sx, sy); }
    const r = _rightClick.apply(this, arguments);
    if (target && target !== sel[0] && !target.dead) {
      const enemy = target.owner > 0 && isEnemy(W.humanId, target.owner) || (target.kind === 'unit' && UNITS[target.type].predator);
      FX.flash = { e: target, t0: performance.now(), col: enemy ? '#ff3a2a' : '#46ff5a' };
    }
    return r;
  };
}
if (!fxOff('fx') && typeof emitFx === 'function') {
  const _emitFx = emitFx;
  emitFx = function (type, x, y, n) {
    if (FX.mute === 'all' || (FX.mute === type) || (FX.mute === 'smoke' && type === 'smoke')) return;
    return _emitFx.apply(this, arguments);
  };
}
// world-side hooks: hits, deaths, destruction, projectiles (cheap; spawn only when on screen)
function fxScreenOf(e) { const c = center(e), d = e.kind === 'unit' ? UNITS[e.type] : null; const p = iso(c.x, c.y, d && d.naval ? -0.35 : W.map.h(c.x, c.y)); return p; }
if (!fxOff('fx') && typeof applyDamage === 'function') {
  const _applyDamage = applyDamage;
  applyDamage = function (t, dmg, src) {
    let mat = null;
    if (FX.on.particles && t && !t.dead && !t.dying && FX.view && fxActive()) {
      mat = fxMaterial(t);
      if (mat) {
        const p = fxScreenOf(t);
        if (fxInView(p.x, p.y, 20) && fxSeen(t)) {
          const z = t.kind === 'bld' ? (BLD_H[t.type] || 40) * (0.2 + Math.random() * 0.3) : unitHeight(t) * 0.5;
          const ox = t.kind === 'bld' ? (Math.random() - 0.5) * BUILDINGS[t.type].size * 24 : 0, x = p.x + ox, y = p.y + Math.random() * 4;
          if (mat === 'spark') fxBurst('spark', x, y, z, 4);
          else if (mat === 'blood') fxBurst('drop', x, y, z, 3);
          else { const col = mat === 'wood' ? '#9a6a3a' : '#a9a294'; fxBurst('chip', x, y, z, 4, col); if (t.kind === 'bld' && Math.random() < 0.5) fxDustAt(x, y, 1, 0.7); }
        } else mat = null;
      }
    }
    if (mat === 'blood') FX.mute = 'blood';
    try { return _applyDamage.apply(this, arguments); } finally { if (FX.mute === 'blood') FX.mute = null; }
  };
}
if (!fxOff('fx') && typeof killEnt === 'function') {
  const _killEnt = killEnt;
  killEnt = function (e, src) {
    const bld = e && e.kind === 'bld' && !e.dead && !BUILDINGS[e.type].farm;
    const r = _killEnt.apply(this, arguments);
    if (bld && FX.on.particles && FX.view && fxActive()) {
      const p = fxScreenOf(e), s = BUILDINGS[e.type].size;
      if (fxInView(p.x, p.y, 60) && isExploredForHuman(center(e).x, center(e).y)) {
        const stone = e.type === 'wall' || e.type === 'gate' || e.type === 'tower' || e.type === 'castle' || bldStyle(e) >= 2;
        fxBurst('debris', p.x, p.y, 10, 6 + s * 5, stone ? '#8f877a' : '#7a5230');
        fxBurst('debris', p.x, p.y, 10, 3 + s * 2, stone ? '#b3ab9c' : '#a87a48');
        fxDustAt(p.x, p.y, 4 + s * 2, 1.2 + s * 0.3);
        for (let k = 0; k < s * 2; k++) fxSmoke(p.x + (Math.random() - 0.5) * s * 30, p.y, 10, true, 1.4);
      }
    }
    return r;
  };
}
if (!fxOff('fx') && typeof removeEnt === 'function') {
  const _removeEnt = removeEnt;
  removeEnt = function (e) {
    if (e && e.kind === 'unit' && e.dying && W && !W.menu) fxAddCorpse(e);
    return _removeEnt.apply(this, arguments);
  };
}
if (!fxOff('fx') && typeof updateProjectiles === 'function') {
  const _updateProjectiles = updateProjectiles;
  updateProjectiles = function (dt) {
    if (!FX.on.decals || !W || W.menu) return _updateProjectiles.apply(this, arguments);
    const landing = [];
    for (const p of W.projs) if (p.t + dt >= p.dur) landing.push(p);
    const r = _updateProjectiles.apply(this, arguments);
    const own = !Array.isArray(W.missFx);
    for (const p of landing) {
      const x = p.tx, y = p.ty; if (!W.map.inb(x | 0, y | 0) || W.map.isWater(x | 0, y | 0)) continue;
      if (p.blast && (p.type === 'stone' || p.type === 'boulder')) {
        FX.craters.push({ x, y, t: W.t, r: Math.min(2, p.blast || 1), seed: (Math.random() * 1e9) | 0 }); if (FX.craters.length > 120) FX.craters.shift();
      } else if (own && (p.type === 'arrow' || p.type === 'bolt')) {
        const t = ent(p.target), ang = Math.atan2(p.ty - p.sy, p.tx - p.sx);
        if (t && t.kind === 'bld') continue;
        const hit = t && !t.dead && Math.hypot(t.x - x, t.y - y) < UNIT_R(t) + 0.35;
        if (hit ? Math.random() < 0.08 : Math.random() < 0.6) {
          const j = hit ? 0.35 : 0.1;
          FX.arrows.push({ x: x + (Math.random() - 0.5) * j, y: y + (Math.random() - 0.5) * j, t: W.t, ang: ang + (Math.random() - 0.5) * 0.3 });
          if (FX.arrows.length > 300) FX.arrows.shift();
        }
      }
    }
    return r;
  };
}
// ---------- 10. stereo panning ----------
if (!fxOff('fx') && typeof Sound !== 'undefined' && Sound && typeof Sound.play === 'function') {
  const _play = Sound.play;
  Sound.play = function (name, x, y) {
    if (!FX.on.pan || x === undefined || !this.ctx || !this.ctx.createStereoPanner || !this.sfx || typeof R === 'undefined' || !R.cw || !W) return _play.apply(this, arguments);
    const s = toScreen(x, y, 0), pan = fxPan(s.x, R.cw);
    if (Math.abs(pan) < 0.04 || this.vol.muted || this.posGain(x, y) <= 0) return _play.apply(this, arguments);
    const real = this.sfx, pn = this.ctx.createStereoPanner(); pn.pan.value = pan; pn.connect(real);
    this.sfx = pn; FX.lastPan = pan;
    try { return _play.apply(this, arguments); } finally { this.sfx = real; }
  };
}
