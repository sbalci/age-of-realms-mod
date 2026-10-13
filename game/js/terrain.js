// ===== HD look: blended tile-space terrain texture and textured, lit building materials =====
// Switch off with ?hd=off (restores the original renderer exactly).
'use strict';
const HD = {
  on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('hd') === 'off'),
  terrain: true, buildings: true,
};

// ---------- small numeric helpers (pure, usable headless) ----------
function hdHash(x, y, s) {
  let h = (hdImul(x | 0, 374761393) + hdImul(y | 0, 668265263) + hdImul(s | 0, 1274126177)) | 0;
  h = hdImul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// tileable value noise: lattice of period `per` cells
const HD_LAT = new Map();   // cached lattices for small periods
const hdFloor = Math.floor, hdSqrt = Math.sqrt, hdImul = Math.imul;
function hdTNoise(x, y, per, s) {
  const xi = hdFloor(x), yi = hdFloor(y); let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, y0 = ((yi % per) + per) % per, y1 = (y0 + 1) % per;
  let a, b, c, d;
  if (per <= 64) {
    const key = per * 100000 + s; let L = HD_LAT.get(key);
    if (!L) { L = new Float32Array(per * per); for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) L[j * per + i] = hdHash(i, j, s); HD_LAT.set(key, L); }
    a = L[y0 * per + x0]; b = L[y0 * per + x1]; c = L[y1 * per + x0]; d = L[y1 * per + x1];
  } else { a = hdHash(x0, y0, s); b = hdHash(x1, y0, s); c = hdHash(x0, y1, s); d = hdHash(x1, y1, s); }
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

// ======================================================================
// 1. TERRAIN: one texture in tile space (P texels per tile)
// ======================================================================
const HDT = {
  PS: 64,             // tileable patch size (texels)
  WS: 128,            // warp field size (texels, tileable)
  patches: null, warpX: null, warpY: null, P: 0,
  map: null, n: 0, ver: -1, check: false,
  terS: null, elevS: null, depthS: null,  // snapshots for change detection
  kindCol: {}, kind: null, kindS: null, cT: null,
  depth: null, cLM: null, cCliff: null, cDepth: null, cHue: null,
  cv: null, cx: null, stats: { genMs: 0, P: 0, regenBlocks: 0, regenMs: 0, lastRegenMs: 0 },
};
// per-terrain patch recipe: base rgb, alpha
const HDT_BASE = [
  [106, 150, 56, 1],   // GRASS
  [150, 116, 74, 1],   // DIRT
  [214, 192, 138, 1],  // SAND
  [118, 168, 150, 1],  // SHALLOW
  [40, 104, 140, 1],   // WATER (ripple modulation only)
  [24, 70, 112, 1],    // DEEP
  [72, 100, 40, 1],    // FOREST
  [134, 126, 112, 1],  // ROCK
  [116, 102, 84, 1],   // 8: cliff face rock
];
function hdtPerTile(n) { return n >= 110 ? 16 : n >= 90 ? 18 : n >= 72 ? 20 : 24; }
function hdtBuildPatches() {
  const PS = HDT.PS, out = [];
  for (let t = 0; t < HDT_BASE.length; t++) {
    const p = new Float32Array(PS * PS * 4), [R0, G0, B0] = HDT_BASE[t], s = 101 + t * 37;
    for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
      const n1 = hdTNoise(x / 16, y / 16, 4, s) - 0.5, n2 = hdTNoise(x / 8, y / 8, 8, s + 7) - 0.5, n3 = hdTNoise(x / 4, y / 4, 16, s + 13) - 0.5;
      const h = hdHash(x, y, s + 3) - 0.5;
      let k = 1, r = 0, g = 0, b = 0;
      switch (t) {
        case 0: // grass: clumps, bright blades, dark gaps
          k = 1 + n1 * 0.16 + n2 * 0.16 + n3 * 0.1 + h * 0.12; r = n1 * 18; b = -n2 * 6;
          if (h > 0.40) { r += 12; g += 18; b += 4; } else if (h < -0.43) k *= 0.82;
          break;
        case 6: // forest floor: dark, leaf litter
          k = 1 + n1 * 0.14 + n2 * 0.18 + n3 * 0.1 + h * 0.16;
          if (h > 0.36) { r += 34; g += 10; b -= 4; } else if (h < -0.4) k *= 0.72;
          break;
        case 1: // dirt: clods, grit
          k = 1 + n1 * 0.1 + n2 * 0.14 + n3 * 0.12 + h * 0.12;
          if (h > 0.44) { r += 28; g += 24; b += 18; } else if (h < -0.44) k *= 0.76;
          break;
        case 2: { // sand: soft wind ripples
          const rip = Math.sin(2 * Math.PI * (3 * x + 2 * y) / PS + n1 * 5);
          k = 1 + n2 * 0.08 + n3 * 0.04 + h * 0.06 + rip * 0.035;
          if (h > 0.47) k *= 0.9;
          break;
        }
        case 3: { // shallows: ripples over sand
          const rip = Math.sin(2 * Math.PI * (2 * x + 3 * y) / PS + n2 * 6);
          k = 1 + n1 * 0.08 + n3 * 0.08 + rip * 0.06; g = n2 * 10; b = n2 * 8;
          break;
        }
        case 4: case 5:
          k = 1 + n1 * 0.06 + n3 * 0.08; g = n2 * 8; b = n2 * 10;
          break;
        case 7: // rocky ground
          k = 1 + n1 * 0.12 + n2 * 0.16 + n3 * 0.16 + h * 0.1;
          if (h < -0.44) k *= 0.7; if (n3 > 0.3) { r -= 6; g -= 2; }
          break;
        case 8: { // cliff: layered strata
          const st = Math.sin(2 * Math.PI * (x + y) * 4 / PS + n1 * 3);
          k = 1 + n2 * 0.2 + n3 * 0.16 + st * 0.08 + h * 0.08;
          break;
        }
      }
      const i = (y * PS + x) * 4;
      p[i] = R0 * k + r; p[i + 1] = G0 * k + g; p[i + 2] = B0 * k + b;
      p[i + 3] = 0.5 + n2 * 1.1 + n3 * 0.5;  // "height" used for ragged blend edges
    }
    out.push(p);
  }
  HDT.patches = out;
  const WS = HDT.WS; HDT.warpX = new Float32Array(WS * WS); HDT.warpY = new Float32Array(WS * WS);
  for (let y = 0; y < WS; y++) for (let x = 0; x < WS; x++) {
    HDT.warpX[y * WS + x] = (hdTNoise(x / 16, y / 16, 8, 501) - 0.5) * 0.8 + (hdTNoise(x / 8, y / 8, 16, 507) - 0.5) * 0.3;
    HDT.warpY[y * WS + x] = (hdTNoise(x / 16, y / 16, 8, 601) - 0.5) * 0.8 + (hdTNoise(x / 8, y / 8, 16, 607) - 0.5) * 0.3;
  }
}

// Derived per-tile / per-corner fields (global, O(n^2), cheap)
function hdtFields(map) {
  const n = map.n, N = n + 1, ter = map.ter, vh = map.vh;
  const depth = HDT.depth && HDT.depth.length === n * n ? HDT.depth : new Float32Array(n * n);
  const q = new Int32Array(n * n); let qh = 0, qt = 0;
  for (let i = 0; i < n * n; i++) { if (isWaterT(ter[i])) depth[i] = 1e9; else { depth[i] = 0; q[qt++] = i; } }
  while (qh < qt) {
    const c = q[qh++], x = c % n, y = (c / n) | 0, dc = depth[c] + 1;
    if (x > 0 && depth[c - 1] > dc) { depth[c - 1] = dc; q[qt++] = c - 1; }
    if (x < n - 1 && depth[c + 1] > dc) { depth[c + 1] = dc; q[qt++] = c + 1; }
    if (y > 0 && depth[c - n] > dc) { depth[c - n] = dc; q[qt++] = c - n; }
    if (y < n - 1 && depth[c + n] > dc) { depth[c + n] = dc; q[qt++] = c + n; }
  }
  for (let i = 0; i < n * n; i++) { if (depth[i] > 1e8) depth[i] = 8; if (ter[i] === T.DEEP) depth[i] = Math.max(depth[i], 4); }
  HDT.depth = depth;
  // per-tile light (same slope rule as the original renderer) and cliff weight
  const tc = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x; if (isWaterT(ter[i])) { tc[i] = 0; continue; }
    const h0 = vh[y * N + x], h1 = vh[y * N + x + 1], h2 = vh[(y + 1) * N + x + 1], h3 = vh[(y + 1) * N + x];
    const steep = Math.max(h0, h1, h2, h3) - Math.min(h0, h1, h2, h3);
    tc[i] = steep >= 1.3 ? Math.min(1, (steep - 1.1) * 1.2) : steep > 0.9 ? (steep - 0.9) * 0.4 : 0;
  }
  const cLM = HDT.cLM && HDT.cLM.length === N * N ? HDT.cLM : new Float32Array(N * N);
  const cCliff = HDT.cCliff && HDT.cCliff.length === N * N ? HDT.cCliff : new Float32Array(N * N);
  const cDepth = HDT.cDepth && HDT.cDepth.length === N * N ? HDT.cDepth : new Float32Array(N * N);
  const cHue = HDT.cHue && HDT.cHue.length === N * N ? HDT.cHue : new Float32Array(N * N);
  const cFor = HDT.cFor && HDT.cFor.length === N * N ? HDT.cFor : new Float32Array(N * N);
  // macro variation (large soft patches of lighter / drier ground) never changes: compute once per map size
  if (!HDT.cMac || HDT.cMac.length !== N * N * 2) {
    HDT.cMac = new Float32Array(N * N * 2);
    for (let vy = 0; vy <= n; vy++) for (let vx = 0; vx <= n; vx++) { const j = vy * N + vx; HDT.cMac[j * 2] = hdTNoise(vx / 7, vy / 7, 4096, 77) - 0.5; HDT.cMac[j * 2 + 1] = hdTNoise(vx / 3, vy / 3, 4096, 79) - 0.5; }
  }
  const cMac = HDT.cMac;
  for (let vy = 0; vy <= n; vy++) for (let vx = 0; vx <= n; vx++) {
    let c = 0, d = 0, k = 0, f = 0, wc = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
      const x = vx + dx, y = vy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const i = y * n + x; c += tc[i]; d += depth[i]; k++; if (ter[i] === T.FOREST) f++; if (isWaterT(ter[i])) wc++;
    }
    const j = vy * N + vx;
    cFor[j] = f / k;
    // macro variation: large soft patches of lighter / drier ground
    const mac = cMac[j * 2], mac2 = cMac[j * 2 + 1];
    // slope light from the vertex-height gradient (same sun as the original renderer: lit from -x / -y)
    let lt = 1;
    if (wc < k) {
      const xm = vx > 0 ? vx - 1 : 0, xp = vx < n ? vx + 1 : n, ym = vy > 0 ? vy - 1 : 0, yp = vy < n ? vy + 1 : n;
      const gx = (vh[vy * N + xp] - vh[vy * N + xm]) / (xp - xm), gy = (vh[yp * N + vx] - vh[ym * N + vx]) / (yp - ym);
      lt = 1 - gx * 0.34 - gy * 0.18; lt = lt < 0.55 ? 0.55 : lt > 1.4 ? 1.4 : lt;
    }
    cLM[j] = lt * (1 + mac * 0.09 + mac2 * 0.05);
    cCliff[j] = c / k; cDepth[j] = d / k; cHue[j] = mac * 2 + mac2;
  }
  HDT.cLM = cLM; HDT.cCliff = cCliff; HDT.cDepth = cDepth; HDT.cHue = cHue; HDT.cFor = cFor;
  // fresh-water tint (water.js kinds: river / lake) baked in, so it blends instead of tinting whole tiles
  const kind = HDT.kind && HDT.kind.length === n * n ? HDT.kind : new Uint8Array(n * n);
  const info = typeof wmInfo === 'function' && typeof WM_KIND !== 'undefined' && typeof WMOD !== 'undefined' ? wmInfo(map) : null;
  for (let i = 0; i < n * n; i++) kind[i] = info && isWaterT(ter[i]) ? info.kind[i] : 0;
  HDT.kind = kind;
  const cT = HDT.cT && HDT.cT.length === N * N * 4 ? HDT.cT : new Float32Array(N * N * 4); cT.fill(0);
  if (info) {
    const tint = WM_KIND.map(k => { const c = k && HDT.kindCol[k]; if (!c) return null; const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], Math.min(1, +m[3] * 2.2)] : null; });
    for (let vy = 0; vy <= n; vy++) for (let vx = 0; vx <= n; vx++) {
      let r = 0, g = 0, b = 0, a = 0, k = 0;
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const x = vx + dx, y = vy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue; k++;
        const t = tint[kind[y * n + x]]; if (!t) continue; r += t[0] * t[3]; g += t[1] * t[3]; b += t[2] * t[3]; a += t[3];
      }
      const j = (vy * N + vx) * 4; if (a > 0) { cT[j] = r / a; cT[j + 1] = g / a; cT[j + 2] = b / a; cT[j + 3] = a / k; }
    }
  }
  HDT.cT = cT;
}

// Paint tiles [x0..x1]x[y0..y1] into `out` (RGBA, width (x1-x0+1)*P). Pure: same input -> same texels.
// Split into small tight per-tile loops (uniform land / open water / blended edge) so V8 optimises each well.
const HDT_ALPHA = new Float32Array(HDT_BASE.map(b => b[3]));
const HDT_GRASSY = new Uint8Array(HDT_BASE.length); HDT_GRASSY[0] = 1; HDT_GRASSY[6] = 1;
function hdtPaint(map, P, x0, y0, x1, y1, out) {
  const n = map.n, N = n + 1, ter = map.ter, n1 = n - 1, OW = (x1 - x0 + 1) * P;
  const cLM = HDT.cLM, cHue = HDT.cHue, cCliff = HDT.cCliff, cT = HDT.cT;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t0 = ter[ty * n + tx], w0 = t0 === 4 || t0 === 5;
    let same = true, gf = t0 === 0 || t0 === 6;
    for (let dy = -1; dy <= 1 && (same || gf); dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = ty + dy < 0 ? 0 : ty + dy > n1 ? n1 : ty + dy, xx = tx + dx < 0 ? 0 : tx + dx > n1 ? n1 : tx + dx, t = ter[yy * n + xx];
      if (w0 ? !(t === 4 || t === 5) : t !== t0) same = false;
      if (t !== 0 && t !== 6) gf = false;
      if (!same && !gf) break;
    }
    const j = ty * N + tx, base = ((ty - y0) * P * OW + (tx - x0) * P) * 4;
    const tinted = cT[j * 4 + 3] + cT[(j + 1) * 4 + 3] + cT[(j + N) * 4 + 3] + cT[(j + N + 1) * 4 + 3] > 0;
    if (same && !w0) hdtTileUniform(P, tx, ty, t0, cLM[j], cLM[j + 1], cLM[j + N], cLM[j + N + 1], HDT_GRASSY[t0] ? 1 : 0, cHue[j], cHue[j + 1], cHue[j + N], cHue[j + N + 1], out, base, OW);
    else if (gf) hdtTileGrassForest(P, tx, ty, j, N, out, base, OW);
    else if (same && !tinted) hdtTileWater(P, tx, ty, j, N, out, base, OW);
    else hdtTileBlend(map, P, tx, ty, j, N, out, base, OW);
    if (cCliff[j] + cCliff[j + 1] + cCliff[j + N] + cCliff[j + N + 1] > 0.01) hdtTileCliff(P, tx, ty, j, N, out, base, OW);
    if (!(same && w0)) hdtDecals(map, P, tx, ty, t0, x0, y0, OW, out);
  }
}
function hdtTileUniform(P, tx, ty, t0, L00, L10, L01, L11, grassy, H00, H10, H01, H11, out, base, OW) {
  const p = HDT.patches[t0], PM = HDT.PS - 1, PS = HDT.PS, inv = 1 / P, al = HDT_ALPHA[t0] * 255;
  for (let b = 0; b < P; b++) {
    const fv = (b + 0.5) * inv, la = L00 + (L01 - L00) * fv, lb = L10 + (L11 - L10) * fv, ha = H00 + (H01 - H00) * fv, hb = H10 + (H11 - H10) * fv;
    const rowP = ((ty * P + b) & PM) * PS; let o = base + b * OW * 4;
    for (let a = 0; a < P; a++, o += 4) {
      const fu = (a + 0.5) * inv, LM = la + (lb - la) * fu, pi = (rowP + ((tx * P + a) & PM)) * 4;
      let r = p[pi], g = p[pi + 1], bl = p[pi + 2];
      if (grassy) { const hue = ha + (hb - ha) * fu; r += hue * 14; bl -= hue * 6; }
      const sp = LM > 1 ? (LM - 1) * 70 : 0; out[o] = r * LM + sp; out[o + 1] = g * LM + sp * 0.95; out[o + 2] = bl * LM + sp * 0.7; out[o + 3] = al;
    }
  }
}
// grass <-> forest floor: soft, ragged transition driven by a bilinear forest-density field (cheap, no warp needed)
function hdtTileGrassForest(P, tx, ty, j, N, out, base, OW) {
  const gp = HDT.patches[0], fp = HDT.patches[6], PM = HDT.PS - 1, PS = HDT.PS, inv = 1 / P, cF = HDT.cFor, cLM = HDT.cLM, cHue = HDT.cHue;
  const F00 = cF[j], F10 = cF[j + 1], F01 = cF[j + N], F11 = cF[j + N + 1], L00 = cLM[j], L10 = cLM[j + 1], L01 = cLM[j + N], L11 = cLM[j + N + 1];
  const H00 = cHue[j], H10 = cHue[j + 1], H01 = cHue[j + N], H11 = cHue[j + N + 1];
  for (let b = 0; b < P; b++) {
    const fv = (b + 0.5) * inv, fa = F00 + (F01 - F00) * fv, fb = F10 + (F11 - F10) * fv, la = L00 + (L01 - L00) * fv, lb = L10 + (L11 - L10) * fv, ha = H00 + (H01 - H00) * fv, hb = H10 + (H11 - H10) * fv;
    const rowP = ((ty * P + b) & PM) * PS; let o = base + b * OW * 4;
    for (let a = 0; a < P; a++, o += 4) {
      const fu = (a + 0.5) * inv, pi = (rowP + ((tx * P + a) & PM)) * 4, LM = la + (lb - la) * fu, hue = ha + (hb - ha) * fu;
      let e = (fa + (fb - fa) * fu + (fp[pi + 3] - 0.5) * 0.55 - 0.3) / 0.4; e = e < 0 ? 0 : e > 1 ? 1 : e; const w = e * e * (3 - 2 * e);
      const r = gp[pi] + (fp[pi] - gp[pi]) * w + hue * 14, g = gp[pi + 1] + (fp[pi + 1] - gp[pi + 1]) * w, bl = gp[pi + 2] + (fp[pi + 2] - gp[pi + 2]) * w - hue * 6;
      const sp = LM > 1 ? (LM - 1) * 70 : 0; out[o] = r * LM + sp; out[o + 1] = g * LM + sp * 0.95; out[o + 2] = bl * LM + sp * 0.7; out[o + 3] = 255;
    }
  }
}
function hdtTileWater(P, tx, ty, j, N, out, base, OW) {
  const wp = HDT.patches[4], PM = HDT.PS - 1, PS = HDT.PS, inv = 1 / P, cD = HDT.cDepth;
  const D00 = cD[j], D10 = cD[j + 1], D01 = cD[j + N], D11 = cD[j + N + 1];
  for (let b = 0; b < P; b++) {
    const fv = (b + 0.5) * inv, da = D00 + (D01 - D00) * fv, db = D10 + (D11 - D10) * fv;
    const rowP = ((ty * P + b) & PM) * PS; let o = base + b * OW * 4;
    for (let a = 0; a < P; a++, o += 4) {
      const fu = (a + 0.5) * inv; let t = (da + (db - da) * fu - 0.3) / 4.2; t = t < 0 ? 0 : t > 1 ? 1 : t; const dp = t * t * (3 - 2 * t);
      const rip = (wp[(rowP + ((tx * P + a) & PM)) * 4] - 40) * 0.6;
      out[o] = 64 - 44 * dp + rip; out[o + 1] = 148 - 86 * dp + rip * 1.4; out[o + 2] = 158 - 46 * dp + rip * 1.6; out[o + 3] = (0.5 + 0.4 * dp) * 255;
    }
  }
}
const hdtTy = new Int32Array(4), hdtWt = new Float32Array(4);
function hdtTileBlend(map, P, tx, ty, j, N, out, base, OW) {
  const n = map.n, n1 = n - 1, ter = map.ter, PT = HDT.patches, PM = HDT.PS - 1, PS = HDT.PS, WS = HDT.WS, inv = 1 / P;
  const wX = HDT.warpX, wY = HDT.warpY, waterP = PT[4], tty = hdtTy, twt = hdtWt, ALPHA = HDT_ALPHA, GRASSY = HDT_GRASSY;
  const cLM = HDT.cLM, cHue = HDT.cHue, cD = HDT.cDepth, cT = HDT.cT;
  const L00 = cLM[j], L10 = cLM[j + 1], L01 = cLM[j + N], L11 = cLM[j + N + 1];
  const H00 = cHue[j], H10 = cHue[j + 1], H01 = cHue[j + N], H11 = cHue[j + N + 1];
  const D00 = cD[j], D10 = cD[j + 1], D01 = cD[j + N], D11 = cD[j + N + 1];
  const j4 = [j * 4, (j + 1) * 4, (j + N) * 4, (j + N + 1) * 4], A00 = cT[j4[0] + 3], A10 = cT[j4[1] + 3], A01 = cT[j4[2] + 3], A11 = cT[j4[3] + 3];
  const anyTint = A00 + A10 + A01 + A11 > 0;
  for (let b = 0; b < P; b++) {
    const gy = ty * P + b, fv = (b + 0.5) * inv, rowP = (gy & PM) * PS, rowW = (gy % WS) * WS; let o = base + b * OW * 4;
    for (let a = 0; a < P; a++, o += 4) {
      const gx = tx * P + a, fu = (a + 0.5) * inv;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const pi = (rowP + (gx & PM)) * 4, wi = rowW + (gx % WS);
      const LM = L00 * w00 + L10 * w10 + L01 * w01 + L11 * w11, hue = H00 * w00 + H10 * w10 + H01 * w01 + H11 * w11;
      // domain-warped bilinear blend between the four nearest tile centres
      const sx = tx + fu + wX[wi] - 0.5, sy = ty + fv + wY[wi] - 0.5;
      const xa = hdFloor(sx), ya = hdFloor(sy), ax = sx - xa, ay = sy - ya;
      const xc0 = xa < 0 ? 0 : xa > n1 ? n1 : xa, xc1 = xa + 1 < 0 ? 0 : xa + 1 > n1 ? n1 : xa + 1;
      const yc0 = ya < 0 ? 0 : ya > n1 ? n1 : ya, yc1 = ya + 1 < 0 ? 0 : ya + 1 > n1 ? n1 : ya + 1;
      let cnt = 0, ws = 0;
      for (let q = 0; q < 4; q++) {
        const t = ter[(q < 2 ? yc0 : yc1) * n + ((q & 1) ? xc1 : xc0)];
        const w = q === 0 ? (1 - ax) * (1 - ay) : q === 1 ? ax * (1 - ay) : q === 2 ? (1 - ax) * ay : ax * ay;
        if (t === 4 || t === 5) { ws += w; continue; }
        let k = 0; while (k < cnt && tty[k] !== t) k++;
        if (k === cnt) { tty[cnt] = t; twt[cnt] = w; cnt++; } else twt[k] += w;
      }
      let r = 0, g = 0, bl = 0, al = 0;
      if (cnt === 1) { const t = tty[0], p = PT[t]; r = p[pi]; g = p[pi + 1]; bl = p[pi + 2]; al = ALPHA[t]; if (GRASSY[t]) { r += hue * 14; bl -= hue * 6; } }
      else if (cnt > 1) {
        let sum = 0;
        for (let k = 0; k < cnt; k++) { let w = twt[k] * (0.35 + PT[tty[k]][pi + 3]); w = w * w * w; twt[k] = w; sum += w; }
        const is = 1 / sum;
        for (let k = 0; k < cnt; k++) {
          const t = tty[k], w = twt[k] * is, p = PT[t];
          r += p[pi] * w; g += p[pi + 1] * w; bl += p[pi + 2] * w; al += ALPHA[t] * w;
          if (GRASSY[t]) { r += hue * 14 * w; bl -= hue * 6 * w; }
        }
      }
      if (ws > 0) {
        // water: depth-graded colour, wet sand, foam band at the shore line
        let dt = (D00 * w00 + D10 * w10 + D01 * w01 + D11 * w11 - 0.3) / 4.2; dt = dt < 0 ? 0 : dt > 1 ? 1 : dt; const dp = dt * dt * (3 - 2 * dt);
        const fn = waterP[pi + 3], ws2 = ws + (fn - 0.5) * 0.12, rip = (waterP[pi] - 40) * 0.6;
        let wr = 64 - 44 * dp + rip, wg = 148 - 86 * dp + rip * 1.4, wb = 158 - 46 * dp + rip * 1.6;
        const wa = 0.5 + 0.4 * dp;
        if (anyTint) {
          const ta = A00 * w00 + A10 * w10 + A01 * w01 + A11 * w11;
          if (ta > 0) {
            const z0 = w00 * A00 / ta, z1 = w10 * A10 / ta, z2 = w01 * A01 / ta, z3 = w11 * A11 / ta;
            const tr = cT[j4[0]] * z0 + cT[j4[1]] * z1 + cT[j4[2]] * z2 + cT[j4[3]] * z3, tg = cT[j4[0] + 1] * z0 + cT[j4[1] + 1] * z1 + cT[j4[2] + 1] * z2 + cT[j4[3] + 1] * z3, tb = cT[j4[0] + 2] * z0 + cT[j4[1] + 2] * z1 + cT[j4[2] + 2] * z2 + cT[j4[3] + 2] * z3;
            wr += (tr - wr) * ta; wg += (tg - wg) * ta; wb += (tb - wb) * ta;
          }
        }
        if (cnt === 0) { r = wr; g = wg; bl = wb; al = wa; out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al * 255; continue; }
        let e = (ws2 - 0.12) / 0.34; e = e < 0 ? 0 : e > 1 ? 1 : e; const wet = e * e * (3 - 2 * e) * 0.3;
        r *= 1 - wet; g *= 1 - wet; bl *= 1 - wet * 0.7;
        let c = (ws2 - 0.44) / 0.12; c = c < 0 ? 0 : c > 1 ? 1 : c; const cov = c * c * (3 - 2 * c), li = 1 / LM;
        r += (wr * li - r) * cov; g += (wg * li - g) * cov; bl += (wb * li - bl) * cov; al += (wa - al) * cov;
        const f1 = 1 - (ws2 > 0.56 ? ws2 - 0.56 : 0.56 - ws2) / 0.1, f2 = 1 - (ws2 > 0.78 ? ws2 - 0.78 : 0.78 - ws2) / 0.045;
        let foam = (f1 > 0 ? hdSqrt(f1) * (0.7 + 0.5 * fn) : 0) + (f2 > 0 ? f2 * 0.5 * fn : 0);
        if (foam > 0) { if (foam > 1) foam = 1; r += (240 * li - r) * foam; g += (248 * li - g) * foam; bl += (246 * li - bl) * foam; al += (0.95 - al) * foam; }
      }
      const sp = LM > 1 ? (LM - 1) * 70 : 0; out[o] = r * LM + sp; out[o + 1] = g * LM + sp * 0.95; out[o + 2] = bl * LM + sp * 0.7; out[o + 3] = al * 255;
    }
  }
}
// rocky cliff material over steep tiles (post-pass on lit texels: (c - x) * LM == c*LM - x*LM)
function hdtTileCliff(P, tx, ty, j, N, out, base, OW) {
  const cp = HDT.patches[8], PM = HDT.PS - 1, PS = HDT.PS, inv = 1 / P, cC = HDT.cCliff, cLM = HDT.cLM;
  const C00 = cC[j], C10 = cC[j + 1], C01 = cC[j + N], C11 = cC[j + N + 1], L00 = cLM[j], L10 = cLM[j + 1], L01 = cLM[j + N], L11 = cLM[j + N + 1];
  for (let b = 0; b < P; b++) {
    const fv = (b + 0.5) * inv, rowP = ((ty * P + b) & PM) * PS; let o = base + b * OW * 4;
    for (let a = 0; a < P; a++, o += 4) {
      if (out[o + 3] < 200) continue;
      const fu = (a + 0.5) * inv, w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const pi = (rowP + ((tx * P + a) & PM)) * 4;
      let c = (C00 * w00 + C10 * w10 + C01 * w01 + C11 * w11 + (cp[pi + 3] - 0.5) * 0.3 - 0.2) / 0.4; if (c <= 0) continue; if (c > 1) c = 1;
      const cw = c * c * (3 - 2 * c), LM = L00 * w00 + L10 * w10 + L01 * w01 + L11 * w11;
      out[o] += (cp[pi] * LM - out[o]) * cw; out[o + 1] += (cp[pi + 1] * LM - out[o + 1]) * cw; out[o + 2] += (cp[pi + 2] * LM - out[o + 2]) * cw;
    }
  }
}
function hdtDecals(map, P, tx, ty, t0, x0, y0, OW, out) {
  const s = P / 16, h = hdHash(tx, ty, 911);
  const put = (u, v, rr, gg, bb, a) => {
    u = Math.round(u); v = Math.round(v); if (u < 1 || v < 1 || u >= P - 1 || v >= P - 1) return;
    const o = (((ty * P + v) - y0 * P) * OW + (tx * P + u) - x0 * P) * 4;
    if (out[o + 3] < 250) return; // keep decals off water / shallows
    out[o] += (rr - out[o]) * a; out[o + 1] += (gg - out[o + 1]) * a; out[o + 2] += (bb - out[o + 2]) * a;
  };
  const pebble = (u, v, r, base) => {
    for (let dv = -r; dv <= r + 1; dv++) for (let du = -r - 1; du <= r + 1; du++) {
      const e = (du * du) / ((r + 0.6) * (r + 0.6)) + (dv * dv) / ((r * 0.75 + 0.5) * (r * 0.75 + 0.5));
      if (e <= 1) { const lit = du + dv < -r * 0.6 ? 1.25 : du + dv > r * 0.6 ? 0.8 : 1; put(u + du, v + dv, base[0] * lit, base[1] * lit, base[2] * lit, 0.9); }
      else if (e <= 1.7 && du + dv > 0) put(u + du, v + dv, 40, 34, 24, 0.35);
    }
  };
  const rr = k => hdHash(tx * 7 + k, ty * 13 - k, 917 + k);
  if (t0 === 0) {
    if (h < 0.1) { const c = [[246, 226, 96], [250, 250, 245], [214, 120, 210], [232, 104, 90]][(rr(1) * 4) | 0]; const u = 3 * s + rr(2) * (P - 6 * s), v = 3 * s + rr(3) * (P - 6 * s); for (let k = 0; k < 5; k++) put(u + (rr(10 + k) - 0.5) * 6 * s, v + (rr(20 + k) - 0.5) * 5 * s, c[0], c[1], c[2], 0.95); }
    else if (h < 0.125) pebble(3 * s + rr(4) * (P - 6 * s), 3 * s + rr(5) * (P - 6 * s), 1, [128, 122, 110]);
  } else if (t0 === 1) {
    const k = h < 0.15 ? 2 : h < 0.45 ? 1 : 0;
    for (let i = 0; i < k; i++) pebble(3 * s + rr(30 + i) * (P - 6 * s), 3 * s + rr(40 + i) * (P - 6 * s), Math.max(1, (s * (0.8 + rr(50 + i))) | 0), [120, 104, 86]);
  } else if (t0 === 7) {
    const k = 2 + ((h * 3) | 0);
    for (let i = 0; i < k; i++) pebble(3 * s + rr(30 + i) * (P - 6 * s), 3 * s + rr(40 + i) * (P - 6 * s), Math.max(1, (s * (1 + rr(50 + i) * 1.4)) | 0), [146, 140, 128]);
  } else if (t0 === 6) {
    for (let i = 0; i < 6; i++) { const c = rr(60 + i) < 0.5 ? [150, 92, 34] : [118, 70, 30]; put(2 + rr(70 + i) * (P - 4), 2 + rr(80 + i) * (P - 4), c[0], c[1], c[2], 0.8); }
  } else if (t0 === 2 && h < 0.12) {
    put(3 * s + rr(90) * (P - 6 * s), 3 * s + rr(91) * (P - 6 * s), 250, 244, 228, 0.9);
  }
}

// ---------- texture lifecycle ----------
function hdtFull(map) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  if (!HDT.patches) hdtBuildPatches();
  const n = map.n, P = hdtPerTile(n);
  HDT.map = map; HDT.n = n; HDT.P = P; HDT.ver = map.version; HDT.check = false;
  HDT.terS = map.ter.slice(); HDT.elevS = map.elev.slice();
  hdtFields(map); HDT.depthS = HDT.depth.slice(); HDT.kindS = HDT.kind.slice();
  const Wd = n * P;
  if (typeof document !== 'undefined') {
    if (!HDT.cv || HDT.cv.width !== Wd) { HDT.cv = document.createElement('canvas'); HDT.cv.width = Wd; HDT.cv.height = Wd; HDT.cx = HDT.cv.getContext('2d'); }
    // paint in horizontal bands to bound the temporary ImageData size
    const band = Math.max(1, Math.floor(256 / P));
    for (let y = 0; y < n; y += band) {
      const y1 = Math.min(n - 1, y + band - 1), img = HDT.cx.createImageData(Wd, (y1 - y + 1) * P);
      hdtPaint(map, P, 0, y, n - 1, y1, img.data); HDT.cx.putImageData(img, 0, y * P);
    }
  } else {
    HDT.buf = new Uint8ClampedArray(Wd * Wd * 4); hdtPaint(map, P, 0, 0, n - 1, n - 1, HDT.buf);
  }
  HDT.stats.genMs = +(((typeof performance !== 'undefined' ? performance : Date).now()) - t0).toFixed(1); HDT.stats.P = P;
}
// Compare against snapshots; regenerate only the 8x8-tile blocks touched by a change. Returns blocks repainted.
function hdtSync(map, invalidate) {
  if (HDT.map !== map || HDT.n !== map.n || !HDT.terS) { hdtFull(map); return -1; }
  if (map.version === HDT.ver && !HDT.check) return 0;
  HDT.ver = map.version; HDT.check = false;
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const n = map.n, ter = map.ter, elev = map.elev, B = 8, nb = Math.ceil(n / B);
  let changed = false;
  const dirty = new Uint8Array(nb * nb);
  const mark = (x, y, r) => { for (let yy = Math.max(0, y - r); yy <= Math.min(n - 1, y + r); yy += 1) for (let xx = Math.max(0, x - r); xx <= Math.min(n - 1, x + r); xx += 1) dirty[((yy / B) | 0) * nb + ((xx / B) | 0)] = 1; };
  for (let i = 0; i < n * n; i++) if (ter[i] !== HDT.terS[i] || elev[i] !== HDT.elevS[i]) { mark(i % n, (i / n) | 0, 2); HDT.terS[i] = ter[i]; HDT.elevS[i] = elev[i]; changed = true; }
  if (!changed) return 0;
  hdtFields(map);
  for (let i = 0; i < n * n; i++) {
    if (HDT.depth[i] !== HDT.depthS[i]) { mark(i % n, (i / n) | 0, 1); HDT.depthS[i] = HDT.depth[i]; }
    if (HDT.kind[i] !== HDT.kindS[i]) { mark(i % n, (i / n) | 0, 1); HDT.kindS[i] = HDT.kind[i]; }
  }
  let k = 0; const P = HDT.P;
  for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
    if (!dirty[by * nb + bx]) continue;
    const x0 = bx * B, y0 = by * B, x1 = Math.min(n - 1, x0 + B - 1), y1 = Math.min(n - 1, y0 + B - 1);
    const w = (x1 - x0 + 1) * P, h = (y1 - y0 + 1) * P;
    if (HDT.cx) { const img = HDT.cx.createImageData(w, h); hdtPaint(map, P, x0, y0, x1, y1, img.data); HDT.cx.putImageData(img, x0 * P, y0 * P); }
    else if (HDT.buf) { const tmp = new Uint8ClampedArray(w * h * 4); hdtPaint(map, P, x0, y0, x1, y1, tmp); const Wd = n * P; for (let r = 0; r < h; r++) HDT.buf.set(tmp.subarray(r * w * 4, (r + 1) * w * 4), ((y0 * P + r) * Wd + x0 * P) * 4); }
    if (invalidate) invalidate(x0, y0, x1, y1);
    k++;
  }
  const dt = ((typeof performance !== 'undefined' ? performance : Date).now()) - t0;
  HDT.stats.regenBlocks += k; HDT.stats.regenMs += dt; HDT.stats.lastRegenMs = +dt.toFixed(2);
  return k;
}

// ---------- drawing a tile from the texture (called from render.js drawTile hook) ----------
function hdtDrawTile(g, map, x, y) {
  if (!HD.terrain || HDT.map !== map || !HDT.cv) return false;
  const n = map.n, N = n + 1, i = y * n + x, t = map.ter[i], P = HDT.P, Wd = n * P;
  const h0 = map.vh[y * N + x], h1 = map.vh[y * N + x + 1], h2 = map.vh[(y + 1) * N + x + 1], h3 = map.vh[(y + 1) * N + x];
  const water = isWaterT(t);
  const H = v => water ? -0.35 : v;
  const p0 = iso(x, y, H(h0)), p1 = iso(x + 1, y, H(h1)), p2 = iso(x + 1, y + 1, H(h2)), p3 = iso(x, y + 1, H(h3));
  const u0 = x * P, v0 = y * P, CH = R.CH || 8;
  // first tile of a chunk: lay the water plane (water tiles and their shore neighbours) in one seamless pass
  if (x % CH === 0 && y % CH === 0) hdtWaterPass(g, map, x, y, Math.min(n, x + CH), Math.min(n, y + CH));
  const planar = Math.abs((h0 + h2) - (h1 + h3)) < 0.02;
  if (water) { /* drawn by the water pass */ }
  else if (planar) {
    // one affine map takes the tile's texel square onto the parallelogram; overdraw half a texel so tiles meet seamlessly
    const a = (p1.x - p0.x) / P, b = (p1.y - p0.y) / P, c = (p3.x - p0.x) / P, d = (p3.y - p0.y) / P;
    g.save(); g.transform(a, b, c, d, p0.x - a * u0 - c * v0, p0.y - b * u0 - d * v0);
    const sx = Math.max(0, u0 - 0.6), sy = Math.max(0, v0 - 0.6), sw = Math.min(Wd, u0 + P + 0.6) - sx, sh = Math.min(Wd, v0 + P + 0.6) - sy;
    g.drawImage(HDT.cv, sx, sy, sw, sh, sx, sy, sw, sh);
    g.restore();
  } else {
    // two triangles, each with its own affine transform and clip
    hdtTri(g, p0, p1, p2, (p1.x - p0.x) / P, (p1.y - p0.y) / P, (p2.x - p1.x) / P, (p2.y - p1.y) / P, u0, v0, P, Wd);
    hdtTri(g, p0, p2, p3, (p2.x - p3.x) / P, (p2.y - p3.y) / P, (p3.x - p0.x) / P, (p3.y - p0.y) / P, u0, v0, P, Wd);
  }
  if (!water) {
    const steep = Math.max(h0, h1, h2, h3) - Math.min(h0, h1, h2, h3);
    if (steep >= 1.3) { // cliff strata and boulders (as the original renderer)
      g.strokeStyle = 'rgba(60,45,30,0.42)'; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(p3.x + (p2.x - p3.x) * 0.1, p3.y - k * 5 + (p2.y - p3.y) * 0.1); g.lineTo(p2.x - (p2.x - p3.x) * 0.1, p2.y - k * 5 - (p2.y - p3.y) * 0.1); g.stroke(); }
      const rng = mulberry32(i * 7 + 3);
      for (let k = 0; k < 3; k++) {
        const px = p0.x + (rng() - 0.5) * 40, py = (p0.y + p2.y) / 2 + (rng() - 0.5) * 12, rx = 3 + rng() * 3, ry = 2 + rng() * 2, c = 90 + rng() * 40;
        g.fillStyle = 'rgba(30,22,14,0.35)'; g.beginPath(); g.ellipse(px + 1, py + 1.2, rx, ry, 0, 0, 6.3); g.fill();
        g.fillStyle = `rgb(${c | 0},${(c * 0.9) | 0},${(c * 0.78) | 0})`; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 6.3); g.fill();
        g.fillStyle = 'rgba(255,245,225,0.25)'; g.beginPath(); g.ellipse(px - rx * 0.3, py - ry * 0.35, rx * 0.5, ry * 0.4, 0, 0, 6.3); g.fill();
      }
    }
    // upright grass tufts (screen space, crisp at any zoom)
    if (t === T.GRASS || t === T.FOREST) {
      let nearW = false;
      for (let dy = -1; dy <= 1 && !nearW; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && (isWaterT(map.ter[yy * n + xx]) || map.ter[yy * n + xx] === T.SAND)) { nearW = true; break; } }
      const rng = mulberry32(i * 9301 + 49297), cx = (p0.x + p2.x) / 2, cy = (p0.y + p2.y) / 2;
      const k = nearW ? 2 : t === T.FOREST ? 4 : 6;
      for (let q = 0; q < k; q++) {
        const u = rng() - 0.5, v = rng() - 0.5;
        const px = cx + (u - v) * TW / 2 * 0.85, py = cy + (u + v) * TH / 2 * 0.85 - (map.h(x + 0.5 + u, y + 0.5 + v) - (h0 + h2) / 2) * EH;
        const dark = rng() < 0.5, hgt = 2.5 + rng() * 2;
        g.strokeStyle = dark ? 'rgba(38,70,18,0.6)' : t === T.FOREST ? 'rgba(120,140,60,0.5)' : 'rgba(168,204,96,0.55)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1.6, py - hgt); g.moveTo(px, py); g.lineTo(px + 0.3, py - hgt - 1); g.moveTo(px, py); g.lineTo(px + 1.7, py - hgt * 0.85); g.stroke();
      }
    }
  }
  if (R.showGrid) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath(); g.stroke(); }
  return true;
}
function hdtWaterPass(g, map, x0, y0, x1, y1) {
  const n = map.n, ter = map.ter, P = HDT.P, Wd = n * P;
  let any = false;
  g.beginPath();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let w = false;
    for (let dy = -1; dy <= 1 && !w; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && isWaterT(ter[yy * n + xx])) { w = true; break; } }
    if (!w) continue;
    any = true;
    const a = iso(x, y, -0.35), b = iso(x + 1, y, -0.35), c = iso(x + 1, y + 1, -0.35), d = iso(x, y + 1, -0.35);
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
  }
  if (!any) return;
  g.save(); g.clip();
  g.transform(TW / 2 / P, TH / 2 / P, -TW / 2 / P, TH / 2 / P, 0, 0.35 * EH);
  const sx = Math.max(0, (x0 - 1) * P), sy = Math.max(0, (y0 - 1) * P), sw = Math.min(Wd, (x1 + 1) * P) - sx, sh = Math.min(Wd, (y1 + 1) * P) - sy;
  g.drawImage(HDT.cv, sx, sy, sw, sh, sx, sy, sw, sh);
  g.restore();
}
function hdtTri(g, A, B, C, a, b, c, d, u0, v0, P, Wd) {
  const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3, e = 0.75;
  const ex = p => { const dx = p.x - mx, dy = p.y - my, l = Math.hypot(dx, dy) || 1; return [p.x + dx / l * e, p.y + dy / l * e]; };
  const qa = ex(A), qb = ex(B), qc = ex(C);
  g.save();
  g.beginPath(); g.moveTo(qa[0], qa[1]); g.lineTo(qb[0], qb[1]); g.lineTo(qc[0], qc[1]); g.closePath(); g.clip();
  g.transform(a, b, c, d, A.x - a * u0 - c * v0, A.y - b * u0 - d * v0);
  const sx = Math.max(0, u0 - 1), sy = Math.max(0, v0 - 1), sw = Math.min(Wd, u0 + P + 1) - sx, sh = Math.min(Wd, v0 + P + 1) - sy;
  g.drawImage(HDT.cv, sx, sy, sw, sh, sx, sy, sw, sh);
  g.restore();
}

// ---------- wiring into the renderer ----------
if (HD.on && typeof R !== 'undefined' && typeof drawTerrain === 'function') {
  R.hd = hdtDrawTile;
  if (typeof WMOD !== 'undefined' && WMOD.kinds) for (const k in WMOD.kinds) { HDT.kindCol[k] = WMOD.kinds[k].color; WMOD.kinds[k].color = null; }
  R.hdStats = HDT.stats;
  const _invT = typeof invalidateTiles === 'function' ? invalidateTiles : null;
  if (_invT) invalidateTiles = function (x0, y0, x1, y1) { HDT.check = true; return _invT(x0, y0, x1, y1); };
  if (typeof invalidateTerrain === 'function') { const _it = invalidateTerrain; invalidateTerrain = function () { HDT.check = true; return _it(); }; }
  const _dtr = drawTerrain;
  drawTerrain = function (ctx) {
    if (HD.terrain && W && W.map) hdtSync(W.map, _invT);
    return _dtr(ctx);
  };
}

// ======================================================================
// 2. BUILDINGS: procedural materials on the box / roof helpers
// ======================================================================
const HDB = { st: 1, type: '', tex: null, pats: null, active: 0 };   // active > 0 only while a building sprite is painted
function hdRGB(c) {
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  const m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}
function hdHSL(c) {
  const [r, g, b] = hdRGB(c).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}
// wall material from colour and options (style index = age)
function hdWallMat(col, opt, w, d, z0, h) {
  const st = HDB.st;
  if (opt.bricks) return (z0 <= 0.5 && h <= 8) ? 'rubble' : 'ashlar';
  if (opt.beams) return 'plaster';
  const [hu, s, l] = hdHSL(col);
  const brown = hu >= 12 && hu <= 48 && s > 0.22 && l < 0.56;
  if (w < 0.2 && d < 0.2) return brown ? 'wood' : 'ashlar';
  if (brown) return st === 0 ? 'logs' : 'planks';
  if (s < 0.22) return 'ashlar';
  return 'plaster';
}
function hdRoofMat(col) {
  const [hu, s, l] = hdHSL(col);
  if (hu >= 32 && hu <= 60 && l > 0.45 && s > 0.3) return 'thatch';
  if ((hu < 22 || hu > 340) && s > 0.3) return 'tile';
  if (hu >= 22 && hu < 45 && l < 0.45) return 'shingle';
  return 'slate';
}
// Neutral-grey detail maps (128 = no change) applied with 'overlay' so the art's own colours and lighting stay.
function hdMakeTextures() {
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h); fn(g, w, h); return c; };
  const grey = v => `rgb(${v | 0},${v | 0},${v | 0})`;
  const speck = (g, w, h, n, amp, seed) => { const r = mulberry32(seed); for (let i = 0; i < n; i++) { g.fillStyle = grey(128 + (r() - 0.5) * amp); g.fillRect((r() * w) | 0, (r() * h) | 0, 1, 1); } };
  const TX = {};
  TX.ashlar = mk(64, 64, (g, w, h) => { // dressed stone courses, staggered joints
    const r = mulberry32(11), rowH = 8;
    for (let y = 0, row = 0; y < h; y += rowH, row++) {
      let x = row % 2 ? -7 : 0;
      while (x < w) {
        const bw = 12 + ((r() * 8) | 0), v = 120 + (r() - 0.5) * 34;
        for (const ox of [0, -w, w]) {
          g.fillStyle = grey(v); g.fillRect(x + ox + 1, y + 1, bw - 1, rowH - 1);
          g.fillStyle = grey(v + 26); g.fillRect(x + ox + 1, y + 1, bw - 1, 1);
          g.fillStyle = grey(v - 22); g.fillRect(x + ox + 1, y + rowH - 1, bw - 1, 1);
        }
        x += bw;
      }
      g.fillStyle = grey(70); g.fillRect(0, y, w, 1);
    }
    speck(g, w, h, 500, 40, 12);
  });
  TX.rubble = mk(64, 64, (g, w, h) => { // rough fieldstone
    g.fillStyle = grey(78); g.fillRect(0, 0, w, h);
    const r = mulberry32(21);
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, rx = 4 + r() * 5, ry = 3 + r() * 3, v = 120 + (r() - 0.5) * 50;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        g.fillStyle = grey(v); g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, 0, 0, 6.3); g.fill();
        g.fillStyle = grey(v + 30); g.beginPath(); g.ellipse(x + ox - rx * 0.25, y + oy - ry * 0.35, rx * 0.55, ry * 0.4, 0, 0, 6.3); g.fill();
      }
    }
    speck(g, w, h, 400, 40, 22);
  });
  TX.planks = mk(64, 64, (g, w, h) => { // vertical boards with grain
    const r = mulberry32(31);
    for (let x = 0; x < w; x += 8) {
      const v = 124 + (r() - 0.5) * 30; g.fillStyle = grey(v); g.fillRect(x, 0, 8, h);
      g.fillStyle = grey(60); g.fillRect(x, 0, 1, h); g.fillStyle = grey(v + 18); g.fillRect(x + 1, 0, 1, h);
      g.strokeStyle = 'rgba(70,70,70,0.45)'; g.lineWidth = 0.6;
      for (let k = 0; k < 2; k++) { const o = x + 2.5 + r() * 4; g.beginPath(); g.moveTo(o, 0); g.bezierCurveTo(o + 1, 20, o - 1, 44, o, 64); g.stroke(); }
      if (r() < 0.5) { g.fillStyle = grey(70); g.beginPath(); g.arc(x + 4, r() * h, 1, 0, 6.3); g.fill(); }
    }
    speck(g, w, h, 200, 30, 32);
  });
  TX.wood = TX.planks;
  TX.logs = mk(64, 64, (g, w, h) => { // horizontal round logs
    const r = mulberry32(41);
    for (let y = 0; y < h; y += 8) {
      const v = 122 + (r() - 0.5) * 22, gr = g.createLinearGradient(0, y, 0, y + 8);
      gr.addColorStop(0, grey(62)); gr.addColorStop(0.25, grey(v + 22)); gr.addColorStop(0.6, grey(v)); gr.addColorStop(1, grey(58));
      g.fillStyle = gr; g.fillRect(0, y, w, 8);
      g.strokeStyle = 'rgba(80,80,80,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, y + 4 + r()); g.lineTo(w, y + 4 + r()); g.stroke();
    }
    speck(g, w, h, 200, 30, 42);
  });
  TX.plaster = mk(64, 64, (g, w, h) => { // lime wash with mottling and a few cracks
    const r = mulberry32(51);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,90,90' : '170,170,170'},0.08)`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 8, 0, 6.3); g.fill(); }
    speck(g, w, h, 700, 36, 52);
    g.strokeStyle = 'rgba(80,80,80,0.35)'; g.lineWidth = 0.5;
    for (let i = 0; i < 2; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 6; y += 2 + r() * 3; g.lineTo(x, y); } g.stroke(); }
  });
  TX.paving = mk(64, 64, (g, w, h) => {
    const r = mulberry32(61);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const v = 122 + (r() - 0.5) * 26; g.fillStyle = grey(v); g.fillRect(x + 1, y + 1, 15, 15); g.fillStyle = grey(76); g.fillRect(x, y, 16, 1); g.fillRect(x, y, 1, 16); }
    speck(g, w, h, 400, 34, 62);
  });
  TX.thatch = mk(64, 64, (g, w, h) => { // straw strands in layered courses (v runs down the slope)
    const r = mulberry32(71);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = grey(84); g.fillRect(0, y + 7, w, 1);
      for (let k = 0; k < 70; k++) { const x = r() * w, len = 4 + r() * 5; g.strokeStyle = r() < 0.5 ? 'rgba(200,200,200,0.45)' : 'rgba(70,70,70,0.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y + r() * 2); g.lineTo(x + (r() - 0.5) * 1.5, y + len); g.stroke(); }
    }
  });
  TX.tile = mk(64, 64, (g, w, h) => { // clay barrel tiles
    const r = mulberry32(81);
    for (let y = 0, row = 0; y < h; y += 6, row++) {
      const off = row % 2 ? 4 : 0;
      for (let x = -8 + off; x < w + 8; x += 8) {
        const v = 128 + (r() - 0.5) * 30, gr = g.createLinearGradient(x, 0, x + 8, 0);
        gr.addColorStop(0, grey(70)); gr.addColorStop(0.35, grey(v + 26)); gr.addColorStop(0.65, grey(v)); gr.addColorStop(1, grey(72));
        g.fillStyle = gr; g.fillRect(x, y, 8, 6);
      }
      g.fillStyle = grey(56); g.fillRect(0, y + 5, w, 1);
    }
  });
  TX.slate = mk(64, 64, (g, w, h) => {
    const r = mulberry32(91);
    g.fillStyle = grey(64); g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 5, row++) { const off = row % 2 ? 4 : 0; for (let x = -8 + off; x < w; x += 8) { const v = 126 + (r() - 0.5) * 30; g.fillStyle = grey(v); g.fillRect(x + 0.5, y + 0.5, 7, 4.2); g.fillStyle = grey(v + 24); g.fillRect(x + 0.5, y + 0.5, 7, 0.8); } }
  });
  TX.shingle = mk(64, 64, (g, w, h) => {
    const r = mulberry32(101);
    g.fillStyle = grey(60); g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 6, row++) { const off = row % 2 ? 5 : 0; for (let x = -10 + off; x < w; x += 10) { g.fillStyle = grey(124 + (r() - 0.5) * 36); g.fillRect(x + 0.6, y + 0.6, 9, 5.2); g.fillStyle = grey(70); g.fillRect(x + 0.6, y + 5, 9, 0.8); } }
  });
  HDB.tex = TX;
}
function hdPat(g, name) {
  if (!HDB.tex) hdMakeTextures();
  if (!HDB.pats) HDB.pats = new Map();
  let p = HDB.pats.get(name); if (!p) { p = g.createPattern(HDB.tex[name], 'repeat'); HDB.pats.set(name, p); }
  return p;
}
const HD_STR = { ashlar: 0.85, rubble: 0.9, planks: 0.8, wood: 0.7, logs: 0.85, plaster: 0.55, paving: 0.6, thatch: 0.9, tile: 0.85, slate: 0.85, shingle: 0.85 };
// Paint a textured, lit face. pts: screen polygon; O: texture origin; U, V: screen vectors per texel.
// light: 'sun' | 'shade' | 'top'; ao: texels of ground occlusion (along +V from origin) or 0.
function hdFace(g, pts, fill, mat, O, U, V, light, ao, stroke, lw) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath();
  g.fillStyle = fill; g.fill();
  g.save(); g.clip();
  if (mat) {
    g.save(); g.transform(U[0], U[1], V[0], V[1], O[0], O[1]);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = HD_STR[mat] || 0.8;
    g.fillStyle = hdPat(g, mat); g.fillRect(-2000, -2000, 4000, 4000);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (ao) { const gr = g.createLinearGradient(0, 0, 0, ao); gr.addColorStop(0, 'rgba(20,12,4,0.42)'); gr.addColorStop(1, 'rgba(20,12,4,0)'); g.fillStyle = gr; g.fillRect(-2000, 0, 4000, ao); }
    g.restore();
  }
  // Lambert-ish tint: warm sunlit faces, cool shadowed faces
  if (light === 'sun') { g.fillStyle = 'rgba(255,236,200,0.08)'; g.fill(); }
  else if (light === 'shade') { g.fillStyle = 'rgba(30,40,80,0.13)'; g.fill(); }
  else if (light === 'top') { g.fillStyle = 'rgba(255,250,230,0.07)'; g.fill(); }
  g.restore();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 0.7; g.stroke(); }
}
const HD_TS = 0.5;                          // world px per texel
const HD_UX = [TW / 2 / 45.25 * HD_TS, TH / 2 / 45.25 * HD_TS];   // along +x, per texel
const HD_UY = [-TW / 2 / 45.25 * HD_TS, TH / 2 / 45.25 * HD_TS];  // along +y, per texel
const HD_UP = [0, -HD_TS];                  // up the wall, per texel

if (HD.on && typeof box === 'function' && typeof drawBuildingArt === 'function') {
  const _dba = drawBuildingArt;
  drawBuildingArt = function (g, type, st, pc, t) { HDB.st = st; HDB.type = type; HDB.active++; try { return _dba(g, type, st, pc, t); } finally { HDB.active--; } };
  const _box = box;
  box = function (g, x, y, w, d, z0, h, col, opt = {}) {
    if (!HD.buildings || !HDB.active) return _box(g, x, y, w, d, z0, h, col, opt);
    const z1 = z0 + h;
    const top = opt.top || shade(col, 1.15), left = opt.left || shade(col, 1.0), right = opt.right || shade(col, 0.72);
    const ol = opt.ol === undefined ? 'rgba(0,0,0,0.35)' : opt.ol;
    const mat = hdWallMat(col, opt, w, d, z0, h);
    const aoT = Math.min(h, 10) / HD_TS;
    // front-left face (along x at y+d)
    const fl = [P(x - w, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x - w, y + d, z1)];
    hdFace(g, fl, left, mat, fl[0], HD_UX, HD_UP, 'sun', h > 3 ? aoT : 0, ol, 0.7);
    // front-right face (along y at x+w)
    const fr = [P(x + w, y - d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y - d, z1)];
    hdFace(g, fr, right, mat, fr[0], HD_UY, HD_UP, 'shade', h > 3 ? aoT : 0, ol, 0.7);
    if (!opt.noTop) {
      const tp = [P(x - w, y - d, z1), P(x + w, y - d, z1), P(x + w, y + d, z1), P(x - w, y + d, z1)];
      const tm = mat === 'ashlar' || mat === 'rubble' ? 'paving' : (mat === 'planks' || mat === 'logs' || mat === 'wood') ? 'planks' : null;
      hdFace(g, tp, top, tm, tp[0], HD_UX, HD_UY, 'top', 0, ol, 0.7);
    }
    if (opt.beams) { // timber framing, as the original (plus diagonal braces)
      g.strokeStyle = opt.beams; g.lineWidth = 1.6;
      const seg = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
      for (const f of [0.25, 0.75]) seg(P(x - w + 2 * w * f, y + d, z0), P(x - w + 2 * w * f, y + d, z1));
      seg(P(x - w, y + d, z0 + h * 0.5), P(x + w, y + d, z0 + h * 0.5));
      seg(P(x + w, y - d, z0 + h * 0.5), P(x + w, y + d, z0 + h * 0.5));
      seg(P(x + w, y - d, z0), P(x + w, y + d, z1));
      g.lineWidth = 1.1; seg(P(x - w, y + d, z0 + h * 0.5), P(x - w + 0.5 * w, y + d, z1)); seg(P(x + w, y + d, z0 + h * 0.5), P(x + w - 0.5 * w, y + d, z1));
      g.lineWidth = 2; seg(P(x - w, y + d, z0 + 0.8), P(x + w, y + d, z0 + 0.8)); seg(P(x + w, y - d, z0 + 0.8), P(x + w, y + d, z0 + 0.8));
    }
  };
  const roofFace = (g, pts, fill, mat, O, U, ridgeTo, light) => {
    // V runs down the slope from the ridge; ridgeTo = screen vector ridge->eave, slopeLen = 3D length in world px
    const L = ridgeTo.len, V = [ridgeTo.x / L * HD_TS, ridgeTo.y / L * HD_TS];
    hdFace(g, pts, fill, mat, O, U, V, light, 0, 'rgba(0,0,0,0.4)', 0.7);
  };
  const eaveShadow = (g, a, b) => { g.strokeStyle = 'rgba(20,10,0,0.28)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(a[0], a[1] + 1.6); g.lineTo(b[0], b[1] + 1.6); g.stroke(); };
  const _gx = gableX;
  gableX = function (g, x, y, w, d, z, rh, col, o = 0.12) {
    if (!HD.buildings || !HDB.active) return _gx(g, x, y, w, d, z, rh, col, o);
    const zr = z + rh, mat = hdRoofMat(col), slope = Math.hypot((d + o) * 45.25, rh);
    const back = [P(x - w - o, y - d - o, z), P(x + w + o, y - d - o, z), P(x + w + o, y, zr), P(x - w - o, y, zr)];
    roofFace(g, back, shade(col, 0.8), mat, back[3], HD_UX, { x: back[0][0] - back[3][0], y: back[0][1] - back[3][1], len: slope }, 'shade');
    hdFace(g, [P(x + w, y - d, z), P(x + w, y + d, z), P(x + w, y, zr)], shade(col, 0.62), null, null, null, null, 'shade', 0, 'rgba(0,0,0,0.4)', 0.7);
    const front = [P(x - w - o, y + d + o, z), P(x + w + o, y + d + o, z), P(x + w + o, y, zr), P(x - w - o, y, zr)];
    roofFace(g, front, shade(col, 1.05), mat, front[3], HD_UX, { x: front[0][0] - front[3][0], y: front[0][1] - front[3][1], len: slope }, 'sun');
    eaveShadow(g, front[0], front[1]);
    // ridge cap
    const r0 = P(x - w - o, y, zr), r1 = P(x + w + o, y, zr); g.strokeStyle = shade(col, 0.55); g.lineWidth = 1.6; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
  };
  const _gy = gableY;
  gableY = function (g, x, y, w, d, z, rh, col, o = 0.12) {
    if (!HD.buildings || !HDB.active) return _gy(g, x, y, w, d, z, rh, col, o);
    const zr = z + rh, mat = hdRoofMat(col), slope = Math.hypot((w + o) * 45.25, rh);
    const left = [P(x - w - o, y - d - o, z), P(x - w - o, y + d + o, z), P(x, y + d + o, zr), P(x, y - d - o, zr)];
    roofFace(g, left, shade(col, 0.8), mat, left[3], HD_UY, { x: left[0][0] - left[3][0], y: left[0][1] - left[3][1], len: slope }, 'sun');
    hdFace(g, [P(x - w, y + d, z), P(x + w, y + d, z), P(x, y + d, zr)], shade(col, 0.9), null, null, null, null, 'sun', 0, 'rgba(0,0,0,0.4)', 0.7);
    const right = [P(x + w + o, y - d - o, z), P(x + w + o, y + d + o, z), P(x, y + d + o, zr), P(x, y - d - o, zr)];
    roofFace(g, right, shade(col, 0.66), mat, right[3], HD_UY, { x: right[0][0] - right[3][0], y: right[0][1] - right[3][1], len: slope }, 'shade');
    eaveShadow(g, right[0], right[1]);
    const r0 = P(x, y - d - o, zr), r1 = P(x, y + d + o, zr); g.strokeStyle = shade(col, 0.55); g.lineWidth = 1.6; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
  };
  const _pyr = pyramid;
  pyramid = function (g, x, y, w, d, z, rh, col) {
    if (!HD.buildings || !HDB.active) return _pyr(g, x, y, w, d, z, rh, col);
    const ap = P(x, y, z + rh), mat = hdRoofMat(col);
    poly(g, [P(x - w, y - d, z), P(x + w, y - d, z), ap], shade(col, 0.8));
    poly(g, [P(x - w, y - d, z), P(x - w, y + d, z), ap], shade(col, 0.85));
    const f1 = [P(x - w, y + d, z), P(x + w, y + d, z), ap], m1 = P(x, y + d, z);
    roofFace(g, f1, shade(col, 1.05), mat, ap, HD_UX, { x: m1[0] - ap[0], y: m1[1] - ap[1], len: Math.hypot(d * 45.25, rh) }, 'sun');
    const f2 = [P(x + w, y - d, z), P(x + w, y + d, z), ap], m2 = P(x + w, y, z);
    roofFace(g, f2, shade(col, 0.68), mat, ap, HD_UY, { x: m2[0] - ap[0], y: m2[1] - ap[1], len: Math.hypot(w * 45.25, rh) }, 'shade');
  };
  const _cyl = cyl;
  cyl = function (g, x, y, r, z0, h, col) {
    if (!HD.buildings || !HDB.active) return _cyl(g, x, y, r, z0, h, col);
    const c = P(x, y, z0), c2 = P(x, y, z0 + h); const rx = r * TW / 2 * 1.41, ry = r * TH / 2 * 1.41;
    g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.lineTo(c2[0] - rx, c2[1]); g.ellipse(c2[0], c2[1], rx, ry, 0, Math.PI, 0, true); g.closePath();
    g.fillStyle = col; g.fill();
    g.save(); g.clip();
    g.save(); g.translate(c[0] - rx, c[1]); g.scale(HD_TS, -HD_TS);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.85; g.fillStyle = hdPat(g, hdWallMat(col, { bricks: true }, 1, 1, z0, h)); g.fillRect(-500, -500, 1000, 1000);
    g.restore();
    const grd = g.createLinearGradient(c[0] - rx, 0, c[0] + rx, 0); grd.addColorStop(0, 'rgba(255,240,210,0.18)'); grd.addColorStop(0.35, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,15,40,0.45)');
    g.fillStyle = grd; g.fillRect(c[0] - rx - 2, c2[1] - ry - 2, rx * 2 + 4, c[1] - c2[1] + ry * 2 + 4);
    const ao = g.createLinearGradient(0, c[1] + ry, 0, c[1] + ry - 10); ao.addColorStop(0, 'rgba(20,12,4,0.4)'); ao.addColorStop(1, 'rgba(20,12,4,0)');
    g.fillStyle = ao; g.fillRect(c[0] - rx - 2, c[1] + ry - 12, rx * 2 + 4, 14);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = shade(col, 1.15); g.beginPath(); g.ellipse(c2[0], c2[1], rx, ry, 0, 0, 6.3); g.fill(); g.stroke();
  };
  const _cone = cone;
  cone = function (g, x, y, r, z0, h, col) {
    if (!HD.buildings || !HDB.active) return _cone(g, x, y, r, z0, h, col);
    const c = P(x, y, z0), rx = r * TW / 2 * 1.41, ry = r * TH / 2 * 1.41;
    g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.lineTo(c[0], c[1] - h); g.closePath();
    g.fillStyle = col; g.fill();
    g.save(); g.clip();
    g.save(); g.translate(c[0], c[1] - h); g.scale(HD_TS, HD_TS);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.85; g.fillStyle = hdPat(g, hdRoofMat(col)); g.fillRect(-500, -10, 1000, 1000);
    g.restore();
    const grd = g.createLinearGradient(c[0] - rx, 0, c[0] + rx, 0); grd.addColorStop(0, 'rgba(255,240,210,0.22)'); grd.addColorStop(0.4, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,15,40,0.5)');
    g.fillStyle = grd; g.fillRect(c[0] - rx - 2, c[1] - h - 2, rx * 2 + 4, h + ry + 4);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.7; g.stroke();
  };
}
