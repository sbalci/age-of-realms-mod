// ===== Units HD: unit & icon graphics =====
// 1. Cached, supersampled unit sprites: each (type, owner, anim, quantized frame, facing, task/carry/relic) pose is
//    rendered once at ~2x screen resolution with a soft dark outline, torso/limb/horse-body shading, a screen-space
//    light gradient and a rim light, then blitted. Per-frame generation budget + byte-capped LRU; when the budget is
//    spent the unit is drawn live (old path) for that frame.
// 2. Smooth motion: unit positions/animation clocks are interpolated between the 20 Hz simulation ticks.
// 3. Four facings: walking away shows the back (back of the head, weapon arm behind the body); horses, siege and
//    animals tilt up when moving away and slightly down when coming closer.
// 4. Occlusion silhouettes: your units hidden behind buildings and trees show through as team-coloured shapes.
// 5. Drawn resource / population / water / idle-villager icons replace the emoji; framed, lit unit portraits.
// URL switches: ?unitshd=off (everything), ?unitsprites=off, ?unitsmooth=off, ?facings=off, ?unitsil=off, ?hdicons=off.
'use strict';
const UHD_Q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search) : null;
const uhdOff = k => !!UHD_Q && (UHD_Q.get(k) === 'off' || UHD_Q.get('unitshd') === 'off');
const UHD = {
  on: {}, cache: new Map(), bytes: 0, maxBytes: 64e6, budgetMs: 2.5, minGen: 1, silMs: 1.5, silMax: 20,
  bad: new Set(), err: null, sets: new Map(), frame: 0, genMs: 0, genN: 0, world: 0, gen: null, occ: [], probe: null,
  ms: { gen: 0, sil: 0 }, n: { hit: 0, miss: 0, gen: 0, near: 0, live: 0, evict: 0, sil: 0 },
  // zoom buckets: a sprite made for bucket z (rendered at 2x, then filtered down) serves zooms in (prev, z], blitted ~1:1
  ZB: [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.8, 3.2],
  HUMAN: new Set(['villager', 'sword', 'samurai', 'tknight', 'berserk', 'spear', 'bow', 'xbow', 'jav', 'axeman', 'monk', 'janissary']),
  MOUNTED: new Set(['scout', 'knight', 'cavarcher', 'conq', 'mameluke']),
  SIEGE: new Set(['ram', 'mangonel', 'scorpion', 'trebuchet']),
  ANIMAL: new Set(['sheep', 'deer', 'boar', 'wolf']),
  // local-unit boxes (symmetric in x) the figure is rendered into before trimming: [half width, top, bottom]
  BOX: { h: [26, 48, 8], m: [32, 56, 10], s: [46, 84, 14], a: [22, 36, 8] },
  BIG: { h: [44, 66, 16], m: [50, 76, 16], s: [60, 100, 20], a: [34, 46, 14] }, // retry box when a pose touches the edge
  WORK_P: { chop: 0.9, mine: 1.0, build: 0.55, repair: 0.6, farm: 1.4, forage: 2 * Math.PI / 5, butcher: 2 * Math.PI / 9, hunt: 1.6, convert: Math.PI / 2, heal: Math.PI / 2 },
  stats() { return Object.assign({ entries: this.cache.size, mb: +(this.bytes / 1e6).toFixed(1), genMs: +this.ms.gen.toFixed(1), silMs: +this.ms.sil.toFixed(1) }, this.n); },
  reset() { for (const k in this.n) this.n[k] = 0; this.ms.gen = this.ms.sil = 0; },
};
for (const k of ['unitsprites', 'unitsmooth', 'facings', 'unitsil', 'hdicons']) UHD.on[k] = !uhdOff(k);
UHD.on.any = !uhdOff('unitshd');

// ---------- pure helpers (unit-tested) ----------
function uhdCategory(d) {
  if (!d || d.naval || !d.draw) return null;
  if (UHD.HUMAN.has(d.draw)) return 'h';
  if (UHD.MOUNTED.has(d.draw)) return 'm';
  if (UHD.SIEGE.has(d.draw)) return 's';
  if (UHD.ANIMAL.has(d.draw)) return 'a';
  return null;
}
function uhdZoomBucket(z) { for (const b of UHD.ZB) if (z <= b + 1e-6) return b; return UHD.ZB[UHD.ZB.length - 1]; }
// quantize the animation clock: returns { frame, tq, sinceQ } so equal keys always render identically
function uhdPhase(u, d, t, wt) {
  const anim = u.anim || 'idle', cat = uhdCategory(d), TAU = Math.PI * 2;
  if (anim === 'attack') {
    const since = u.atkT !== undefined ? wt - u.atkT : 9;
    const s = Math.max(0, Math.min(since, (d.rof || 2) + 0.2));
    const sinceQ = s < 0.35 ? Math.floor(s / 0.07 + 1e-9) * 0.07 : 0.35 + Math.floor((s - 0.35) / 0.3 + 1e-9) * 0.3;
    return { frame: 'a' + Math.round(sinceQ * 100), tq: 0, sinceQ };
  }
  let P = Math.PI, F = 4, off = 0, k = 1;
  if (anim === 'walk') {
    if (cat === 'm') { P = TAU / 13; F = 8; }
    else if (cat === 'a') { P = TAU / (d.draw === 'sheep' ? 9 : 12); F = 6; }
    else if (cat === 's') { P = 1; F = 1; }
    else { P = TAU / 11; F = 8; }
  } else if (anim === 'work') {
    const wk = u.work ? u.work.kind : null;
    P = UHD.WORK_P[wk] || (d.draw === 'monk' ? Math.PI / 2 : Math.PI); F = 8;
  } else if (anim === 'idle' && d.draw === 'sheep') { // grazing: sin(t * 0.7 + id)
    k = 0.7; off = u.id || 0; P = TAU; F = 8;
  } else if (cat === 's') { P = 1; F = 1; }
  const ph = ((t * k + off) % P + P) % P;
  const frame = Math.min(F - 1, Math.floor(ph / P * F + 1e-9));
  return { frame, tq: (frame * P / F - off) / k, sinceQ: 9 };
}
// canonical id a pose is drawn with (ids only pick skin/hair/gender variants; animals keep theirs for grazing phase)
function uhdVariantId(u, d) { const id = u.id || 0; return d.draw === 'villager' ? id % 12 : UHD.ANIMAL.has(d.draw) ? id : id % 2; }
// everything besides the clock that changes what drawUnitFigure draws
function uhdExtra(u, d) {
  const dr = d.draw;
  if (dr === 'villager') {
    const wk = u.anim === 'work' && u.work ? u.work.kind : '';
    const ot = u.order && (u.order.t === 'farm' || u.order.t === 'hunt') ? u.order.t : (u.work && u.work.kind === 'farm' ? 'farm' : '');
    const c = u.carry && u.carry.amt > 0.5 && u.anim !== 'work' ? u.carry.res + Math.floor(1 + Math.min(1, u.carry.amt / 10) * 3) : '';
    return wk + '/' + ot + '/' + c + '/' + (u.work && u.work.kind === 'butcher' ? 'b' : '') + '/' + uhdVariantId(u, d);
  }
  if (dr === 'monk') return (u.relic ? 'r' : '') + (u.recharge > 0 ? 'c' : '') + '/' + (u.anim === 'work' && u.work ? u.work.kind : '') + '/' + uhdVariantId(u, d);
  if (UHD.ANIMAL.has(dr)) return (u.breed || '') + ((u.id || 0) % 2);
  return '' + uhdVariantId(u, d);
}
function uhdKey(u, d, t, wt, zb, pcc) {
  const ph = uhdPhase(u, d, t, wt);
  const face = (u.face || 1) < 0 ? -1 : 1, back = UHD.on.facings && u.back ? 1 : 0;
  const a = u.type + '|' + (u.owner || 0) + '|' + pcc + '|' + (u.anim || 'idle') + '|', b = '|' + face + '|' + back + '|' + uhdExtra(u, d) + '|';
  const art = typeof UnitArt !== 'undefined' ? '|' + UnitArt.key(u) + ':' + UnitArt.revision : '';
  return { key: a + ph.frame + b + zb + art, set: a + '*' + b + art, ph, face, back };
}
// LRU over a Map (insertion order = age): touch moves to the end, evict drops from the front until under budget
function uhdTouch(map, key) { const v = map.get(key); if (v === undefined) return undefined; map.delete(key); map.set(key, v); return v; }
function uhdEvict(map, bytes, max, sizeOf) {
  let n = 0;
  for (const [k, v] of map) { if (bytes <= max) break; bytes -= sizeOf(v); map.delete(k); n++; }
  return { bytes, n };
}
// interpolated render position between the previous and current sim tick
function uhdLerpPos(px, py, x, y, a) {
  if (px === undefined || Math.abs(x - px) + Math.abs(y - py) > 2) return [x, y];
  return [px + (x - px) * a, py + (y - py) * a];
}
// tiles in front of (x,y) that can hide a unit drawn behind them
const UHD_OCC_OFF = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [2, 0], [0, 2], [3, 2], [2, 3], [3, 3], [3, 1], [1, 3]];
function uhdOccluders(u, map, getEnt, depthOf) {
  const out = [], tx = Math.floor(u.x), ty = Math.floor(u.y), dep = u.x + u.y;
  for (const [dx, dy] of UHD_OCC_OFF) {
    const x = tx + dx, y = ty + dy; if (!map.inb(x, y)) continue;
    const id = map.blk[map.idx(x, y)]; if (!id) continue;
    const e = getEnt(id); if (!e || out.includes(e)) continue;
    if (e.kind === 'res' ? (e.type !== 'tree' || e.felled) : e.kind !== 'bld') continue;
    if (e.kind === 'bld' && BUILDINGS[e.type] && BUILDINGS[e.type].farm) continue;
    if (depthOf(e) <= dep) continue;
    out.push(e);
  }
  return out;
}
function uhdHexRgb(c) {
  if (typeof c !== 'string') return null;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (m) return [+m[1], +m[2], +m[3]];
  if (c[0] !== '#') return null;
  if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
  if (c.length === 7) return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  return null;
}
function uhdShade(c, f) { const v = uhdHexRgb(c); if (!v) return c; return 'rgb(' + v.map(x => Math.round(Math.min(255, x * f))).join(',') + ')'; }
function uhdLighten(c, k) { const v = uhdHexRgb(c); if (!v) return null; return 'rgb(' + v.map(x => Math.round(x + (255 - x) * k)).join(',') + ')'; }

// bounding box of pixels with alpha > th in an RGBA buffer
function uhdTrim(px, w, h, th) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4; let any = false;
    for (let x = 0; x < w; x++) if (px[row + x * 4 + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; any = true; }
    if (any) { if (y < y0) y0 = y; y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
// one CPU pass over the trimmed figure: soft contact shadow, dark outline (dilated alpha), diagonal light,
// rim light on edges facing the upper-left light, core shadow on edges facing away. Writes straight RGBA into out.
function uhdPost(src, sw, x0, y0, bw, bh, pad, ri, rr, shadow, out) {
  const W2 = bw + pad * 2, H2 = bh + pad * 2, M = Math.max(ri, rr) + 1, AW = W2 + 2 * M, AH = H2 + 2 * M, N = AW * AH;
  const A = new Uint8Array(N), H = new Uint8Array(N), D = new Uint8Array(N);
  for (let y = 0; y < bh; y++) { const so = ((y + y0) * sw + x0) * 4 + 3, ao = (y + pad + M) * AW + pad + M; for (let x = 0; x < bw; x++) A[ao + x] = src[so + x * 4]; }
  // square dilation of radius ri (separable max filter) = outline mask
  for (let y = M - ri; y < AH - M + ri; y++) { const r = y * AW; for (let x = ri; x < AW - ri; x++) { let m = 0; for (let k = r + x - ri, e = r + x + ri; k <= e; k++) if (A[k] > m) m = A[k]; H[r + x] = m; } }
  for (let y = M; y < AH - M; y++) { const r = y * AW; for (let x = M; x < AW - M; x++) { let m = 0; for (let k = r + x - ri * AW, e = r + x + ri * AW; k <= e; k += AW) if (H[k] > m) m = H[k]; D[r + x] = m; } }
  const UL = -rr * AW - rr, DR = rr * AW + rr, o32 = new Uint32Array(out.buffer, out.byteOffset, W2 * H2);
  const iW = 0.5 / W2, iH = 0.5 / H2, i255 = 1 / 255;
  const scx = shadow ? shadow.cx : 0, scy = shadow ? shadow.cy : 0, irx = shadow ? 1 / shadow.rx : 0, iry = shadow ? 1 / shadow.ry : 0;
  for (let y = 0; y < H2; y++) {
    const gy = y * iH, rowA = (y + M) * AW + M, rowS = ((y - pad + y0) * sw - pad + x0) * 4;
    for (let x = 0; x < W2; x++) {
      const j = rowA + x, av = A[j];
      let ba = 0, br = 0, bg = 0, bb = 0; // bottom layers (contact shadow + outline), premultiplied
      if (av < 255) {
        if (shadow) { const dx = (x - scx) * irx, dy = (y - scy) * iry, d = dx * dx + dy * dy; if (d < 1) ba = d < 0.6 ? 0.3 : 0.75 * (1 - d); }
        const dv = D[j];
        if (dv) { const oa = dv * (0.8 / 255); br = 22 * oa; bg = 16 * oa; bb = 10 * oa; ba = oa + ba * (1 - oa); }
        if (av === 0) {
          if (ba > 0.004) { const k = 1 / ba; o32[y * W2 + x] = ((ba * 255) << 24) | ((bb * k) << 16) | ((bg * k) << 8) | (br * k); }
          continue;
        }
      }
      const a = av * i255, s = rowS + x * 4;
      let r = src[s], g = src[s + 1], b = src[s + 2];
      const gd = x * iW + gy; // 0 upper-left .. 1 lower-right
      let L = (gd < 0.5 ? 0.24 - 0.48 * gd : 0) + 0.5 - A[j + UL] * (0.5 / 255);
      let Dk = (gd > 0.5 ? 0.6 * gd - 0.3 : 0) + 0.32 - A[j + DR] * (0.32 / 255);
      if (L > 0.75) L = 0.75; if (Dk > 0.6) Dk = 0.6;
      r += (255 - r) * L; g += (246 - g) * L; b += (220 - b) * L;
      r += (10 - r) * Dk; g += (8 - g) * Dk; b += (24 - b) * Dk;
      const oa = a + ba * (1 - a), k = 1 / oa, ia = 1 - a;
      o32[y * W2 + x] = ((oa * 255 + 0.5) << 24) | (((b * a + bb * ia) * k) << 16) | (((g * a + bg * ia) * k) << 8) | ((r * a + br * ia) * k);
    }
  }
  return out;
}
// ---------- canvases ----------
function uhdCanvas(w, h, read) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  if (read) c.getContext('2d', { willReadFrequently: true });
  return c;
}
const UHD_TMP = {};
function uhdTmp(name, w, h, read) {
  let c = UHD_TMP[name];
  if (!c || c.width < w || c.height < h) { c = UHD_TMP[name] = uhdCanvas(Math.max(w, c ? c.width : 0), Math.max(h, c ? c.height : 0), read); }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
  return c;
}

// ---------- generation-time drawing hooks (active only while UHD.gen is set) ----------
// limbs get a lit edge, so arms/legs read as cylinders
if (UHD.on.any && typeof limb === 'function') {
  const _limb = limb;
  limb = function (g, x0, y0, len, ang, w, col) {
    const r = _limb.apply(this, arguments);
    if (UHD.gen && w >= 1.3) {
      const hl = uhdLighten(col, 0.42);
      if (hl) {
        const ox = -UHD.gen.face * w * 0.22, a = g.globalAlpha;
        g.globalAlpha = a * 0.55; g.strokeStyle = hl; g.lineWidth = w * 0.36;
        g.beginPath(); g.moveTo(x0 + ox, y0 + Math.cos(ang) * 0.4); g.lineTo(r[0] + ox - Math.sin(ang) * 0.6, r[1] - Math.cos(ang) * 0.6); g.stroke();
        g.globalAlpha = a;
      }
    }
    return r;
  };
}
// torso shading: light from the upper left, a darker side and hem
function uhdShadeTorso(o) {
  const orig = o.torsoDetail, face = UHD.gen ? UHD.gen.face : 1;
  return Object.assign({}, o, {
    torsoDetail: function (g) {
      const crouch = this.crouch || 0;
      g.save(); g.beginPath();
      if (this.robe) { g.moveTo(-4, -10); g.lineTo(4, -10); g.lineTo(5.5, 10 - crouch); g.lineTo(-5.5, 10 - crouch); }
      else { g.moveTo(-3.8, -10); g.lineTo(3.8, -10); g.lineTo(4.4, 1.5); g.lineTo(-4.4, 1.5); }
      g.closePath(); g.clip();
      const gr = g.createLinearGradient(-5 * face, -10, 5 * face, 6);
      gr.addColorStop(0, 'rgba(255,248,230,0.30)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(10,8,20,0.34)');
      g.fillStyle = gr; g.fillRect(-7, -12, 14, 24);
      g.fillStyle = 'rgba(255,250,235,0.22)'; g.fillRect(-4.5, -10.2, 9, 1.1); // shoulder line catches the light
      g.restore();
      if (orig) return orig.call(this, g);
    },
  });
}
// a figure seen from behind: weapon arm behind the body, no face, hair/helmet on the back of the head
function uhdHumanBack(g, o) {
  const t = o.t, walk = o.anim === 'walk';
  const legA = walk ? Math.sin(t * 11) * 0.55 : 0;
  const bob = walk ? Math.abs(Math.sin(t * 11)) * 1.2 : Math.sin(t * 2) * 0.3;
  const crouch = o.crouch || 0, lean = o.lean || 0, hipY = -10 + crouch - bob;
  if (!o.robe) {
    limb(g, 1.2, hipY, 10 - crouch * 0.6, -legA + crouch * 0.08, 2.6, uhdShade(o.legs, 0.8));
    limb(g, -1, hipY, 10 - crouch * 0.6, legA - crouch * 0.05, 2.6, o.legs);
    g.fillStyle = '#3a2a1a'; const f1 = [-1 + Math.sin(legA) * 10, hipY + Math.cos(legA) * 10]; g.fillRect(f1[0] - 2, f1[1] - 1, 3.5, 2);
  }
  g.save(); g.translate(0, hipY); g.rotate(lean);
  const armFront = o.armFront !== undefined ? o.armFront : (walk ? legA * 0.8 : -0.1);
  const hand = limb(g, 1.5, -8, 7.5, armFront, 2.4, uhdShade(o.tunic, 0.85));
  g.fillStyle = o.skin; g.beginPath(); g.arc(hand[0], hand[1], 1.3, 0, 6.3); g.fill();
  if (o.item) { g.save(); g.translate(hand[0], hand[1]); g.rotate(-armFront + (o.itemRot || 0)); o.item(g); g.restore(); }
  const armBack = o.armBack !== undefined ? o.armBack : (walk ? -legA * 0.8 : 0.15);
  limb(g, -1.5, -8, 7.5, armBack, 2.3, uhdShade(o.tunic, 0.8));
  g.fillStyle = uhdShade(o.tunic, 0.92); g.beginPath();
  if (o.robe) { g.moveTo(-4, -10); g.lineTo(4, -10); g.lineTo(5.5, 10 - crouch); g.lineTo(-5.5, 10 - crouch); }
  else { g.moveTo(-3.8, -10); g.lineTo(3.8, -10); g.lineTo(4.4, 1.5); g.lineTo(-4.4, 1.5); }
  g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6; g.stroke();
  if (o.torsoDetail) o.torsoDetail(g);
  if (o.sash) { g.fillStyle = o.sash; g.fillRect(-4.2, -2.5, 8.4, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -9.5); g.lineTo(0, -3); g.stroke(); // back seam
  g.fillStyle = o.skin; g.beginPath(); g.arc(0.5, -13.5, 3.3, 0, 6.3); g.fill();
  g.fillStyle = o.hair || '#4a3020'; g.beginPath(); g.arc(0.2, -13.9, 3.4, 0, 6.3); g.fill();
  if (o.head) o.head(g);
  if (o.shield) { g.save(); g.translate(-2.5, 0.5); o.shield(g); g.restore(); }
  g.restore();
  if (o.carry) o.carry(g, hipY);
}
if (UHD.on.any && typeof drawHuman === 'function') {
  const _dh = drawHuman;
  drawHuman = function (g, o) {
    if (!UHD.gen) return _dh(g, o);
    const o2 = uhdShadeTorso(o);
    if (!UHD.gen.back) return _dh(g, o2);
    // let the inner wrappers (e.g. Imam robes) restyle o, catch the final o at torsoDetail, then draw it from behind
    let fin = null; const STOP = {};
    const probe = Object.assign({}, o2, { torsoDetail: function () { fin = this; throw STOP; } });
    const pg = UHD.probe || (UHD.probe = uhdCanvas(2, 2).getContext('2d'));
    try { _dh(pg, probe); } catch (e) { if (e !== STOP) throw e; pg.restore(); }
    if (!fin) return _dh(g, o2);
    uhdHumanBack(g, Object.assign({}, fin, { torsoDetail: o2.torsoDetail }));
  };
}
// horses: rounded, lit body and a tilt that shows whether the horse moves away (head up) or closer (head down)
if (UHD.on.any && typeof drawHorse === 'function') {
  const _dhr = drawHorse;
  drawHorse = function (g, u, t, anim, col, pc, camel, armor, scale = 1, dx = 0) {
    if (!UHD.gen) return _dhr.apply(this, arguments);
    g.save();
    if (UHD.gen.tilt) g.transform(1, UHD.gen.tilt, 0, 1, 0, 0);
    _dhr.call(this, g, u, t, anim, col, pc, camel, armor, scale, dx);
    g.restore(); g.save();
    if (UHD.gen.tilt) g.transform(1, UHD.gen.tilt, 0, 1, 0, 0);
    g.translate(dx, 0); g.scale(scale, scale);
    const run = anim === 'walk', bob = run ? Math.sin(t * 13 * 2) : 0, bodyY = (camel ? -18 : -13) + bob;
    g.beginPath(); g.ellipse(0, bodyY, 12.5, 5.5, 0, 0, 6.3); g.clip();
    const f = UHD.gen.face, gr = g.createRadialGradient(-3 * f, bodyY - 4, 1, 0, bodyY, 14);
    gr.addColorStop(0, 'rgba(255,250,235,0.32)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.38)');
    g.fillStyle = gr; g.fillRect(-14, bodyY - 7, 28, 14);
    g.restore();
    g.translate(0, bob); // the original leaves the rider bobbing with the horse
  };
}

// ---------- sprite generation ----------
// renders u's pose into a trimmed, outlined, lit canvas. S = sprite px per local unit (already includes US*zoom*2)
function uhdBuild(u, d, cat, tq, sinceQ, face, back, S0, drawFig, olPx = 1, big = false) {
  const t0 = performance.now(), SS = 2, S = S0 * SS; // supersampled working scale
  const [A, top, bot] = (big ? UHD.BIG : UHD.BOX)[cat] || UHD.BOX.h;
  const sw = Math.ceil(2 * A * S), sh = Math.ceil((top + bot) * S), ox = A * S, oy = top * S;
  const sc = uhdTmp('scratch', sw, sh, true), g = sc.getContext('2d');
  g.setTransform(S * face, 0, 0, S, ox, oy);
  g.lineJoin = 'round';
  const fu = Object.assign({}, u, { id: uhdVariantId(u, d), animT: tq, face, back: !!back });
  if (sinceQ < 9 && typeof W !== 'undefined' && W) fu.atkT = W.t - sinceQ;
  const tilt = cat === 'h' ? 0 : back ? -0.11 : 0.05;
  UHD.gen = { face, back: cat === 'h' || cat === 'm' ? !!back : false, tilt: cat === 'm' ? tilt : 0, S };
  // translucent black fills are ground shadows: keep them out of the outline, we add our own soft one
  let shadowSkipped = false;
  g.fill = function () { const fs = this.fillStyle; if (typeof fs === 'string' && /^rgba\(0, 0, 0, 0\.[0-3]/.test(fs)) { shadowSkipped = true; return; } return CanvasRenderingContext2D.prototype.fill.apply(this, arguments); };
  try {
    if (cat !== 'h' && cat !== 'm' && tilt) g.transform(1, tilt, 0, 1, 0, 0);
    drawFig(g, fu, tq);
  } finally { UHD.gen = null; delete g.fill; }
  const img = g.getImageData(0, 0, sw, sh).data;
  const bb = uhdTrim(img, sw, sh, 6) || { x0: Math.floor(ox), y0: Math.floor(oy), x1: Math.floor(ox), y1: Math.floor(oy) };
  if (!big && (bb.x0 === 0 || bb.y0 === 0 || bb.x1 === sw - 1 || bb.y1 === sh - 1)) return uhdBuild(u, d, cat, tq, sinceQ, face, back, S0, drawFig, olPx, true);
  const ri = Math.max(1, Math.round(SS * olPx)), rr = SS, pad = ri + SS + 1;
  const srx = (cat === 's' ? 18 : cat === 'm' ? 14 : 9) * S;
  if (shadowSkipped && cat !== 'h') { // make room for the contact shadow
    bb.x0 = Math.max(0, Math.min(bb.x0, Math.floor(ox - srx))); bb.x1 = Math.min(sw - 1, Math.max(bb.x1, Math.ceil(ox + srx)));
    bb.y1 = Math.min(sh - 1, Math.max(bb.y1, Math.ceil(oy + S + srx * 0.34)));
  }
  const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1, W2 = bw + pad * 2, H2 = bh + pad * 2;
  const ax = ox - bb.x0 + pad, ay = oy - bb.y0 + pad;
  const shadow = shadowSkipped && cat !== 'h' ? { cx: ax, cy: ay + S, rx: srx, ry: srx * 0.34 } : null;
  const post = uhdTmp('post', W2, H2), og = post.getContext('2d'), od = og.createImageData(W2, H2);
  uhdPost(img, sw, bb.x0, bb.y0, bw, bh, pad, ri, rr, shadow, od.data);
  og.putImageData(od, 0, 0);
  UHD.n.gen++;
  // filter the 2x result down once, so every frame is a cheap ~1:1 blit
  const w = Math.ceil(W2 / SS), h = Math.ceil(H2 / SS), out = uhdCanvas(w, h), dg = out.getContext('2d');
  dg.imageSmoothingEnabled = true; dg.imageSmoothingQuality = 'high'; dg.drawImage(post, 0, 0, W2, H2, 0, 0, W2 / SS, H2 / SS);
  return { cv: out, ax: ax / SS, ay: ay / SS, S: S0, bytes: w * h * 4, ms: performance.now() - t0, sil: null };
}
function uhdSil(s, col) {
  if (s.sil && s.silCol === col) return s.sil;
  const c = uhdCanvas(s.cv.width, s.cv.height), g = c.getContext('2d');
  g.drawImage(s.cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  if (!s.sil) { s.bytes += c.width * c.height * 4; UHD.bytes += c.width * c.height * 4; }
  s.sil = c; s.silCol = col; return c;
}

// ---------- the cached draw path ----------
if (UHD.on.any && UHD.on.unitsprites && typeof drawUnitFigure === 'function' && typeof document !== 'undefined') {
  const _duf = drawUnitFigure;
  UHD.drawFig = _duf;
  drawUnitFigure = function (g, u, t) {
    if (!UHD.world || UHD.gen) return _duf.apply(this, arguments);
    const d = UNITS[u.type], cat = UHD.bad.has(u.type) ? null : uhdCategory(d);
    if (!cat) { UHD.n.live++; return _duf.apply(this, arguments); }
    const zb = uhdZoomBucket(R.cam.zoom), pc = pcolor(u.owner);
    const K = uhdKey(u, d, t, W.t, zb, pc.c);
    let s = uhdTouch(UHD.cache, K.key);
    if (s) UHD.n.hit++;
    else {
      if (UHD.genN >= UHD.minGen && UHD.genMs > UHD.budgetMs) {
        // over budget: another frame of the same pose keeps the look consistent, else draw it the old way
        const nk = UHD.sets.get(K.set); s = nk && UHD.cache.get(nk);
        if (!s) { UHD.n.live++; return _duf.apply(this, arguments); }
        UHD.n.near++;
      }
    }
    if (!s) {
      UHD.n.miss++;
      try { s = uhdBuild(u, d, cat, K.ph.tq, K.ph.sinceQ, K.face, K.back, US * zb, _duf); }
      catch (e) { UHD.bad.add(u.type); UHD.err = e && e.stack; UHD.n.live++; return _duf.apply(this, arguments); }
      UHD.genN++; UHD.genMs += s.ms; UHD.ms.gen += s.ms;
      UHD.cache.set(K.key, s); UHD.bytes += s.bytes; UHD.sets.set(K.set, K.key);
      if (UHD.bytes > UHD.maxBytes) { const ev = uhdEvict(UHD.cache, UHD.bytes, UHD.maxBytes * 0.85, v => v.bytes); UHD.bytes = ev.bytes; UHD.n.evict += ev.n; }
    }
    // the caller has applied scale(face * US, US); the sprite is already mirrored, so undo the flip
    g.save(); g.scale(K.face, 1);
    g.imageSmoothingEnabled = true;
    g.drawImage(s.cv, -s.ax / s.S, -s.ay / s.S, s.cv.width / s.S, s.cv.height / s.S);
    g.restore();
    if (UHD.cur === u && g === R.ctx && UHD.on.unitsil && u.owner === W.humanId && !u.dying && UHD.occ.length < 60) UHD.occ.push({ u, s, x: u.x, y: u.y });
  };
}
if (UHD.on.any && typeof drawUnit === 'function') {
  const _du = drawUnit;
  drawUnit = function (ctx, u, sel) {
    UHD.world++; const prev = UHD.cur; UHD.cur = u;
    try { return _du.apply(this, arguments); } finally { UHD.world--; UHD.cur = prev; }
  };
}

// ---------- smooth motion ----------
if (UHD.on.any && UHD.on.unitsmooth && typeof worldTick === 'function') {
  GameHooks.on('beforeTick', dt => {
    if (typeof W !== 'undefined' && W && W.list) for (const e of W.list) if (e.kind === 'unit') { e._uhx = e.x; e._uhy = e.y; e._uha = e.animT; }
  });
}
function uhdAlpha() {
  if (!UHD.on.unitsmooth || typeof simAcc === 'undefined' || typeof SIM_DT === 'undefined') return 1;
  if (typeof UI === 'undefined' || !UI.gameRunning || UI.paused || (W && W.over)) return 1;
  return Math.max(0, Math.min(1, simAcc / SIM_DT));
}
const UHD_SAVE = [];
function uhdSwapIn(a) {
  UHD_SAVE.length = 0;
  if (a >= 1) return;
  for (const e of W.list) {
    if (e.kind !== 'unit' || e._uhx === undefined) continue;
    const [x, y] = uhdLerpPos(e._uhx, e._uhy, e.x, e.y, a);
    UHD_SAVE.push(e, e.x, e.y, e.animT);
    e.x = x; e.y = y;
    if (e._uha !== undefined && e.animT >= e._uha && e.animT - e._uha < 0.2) e.animT = e._uha + (e.animT - e._uha) * a;
  }
}
function uhdSwapOut() { for (let i = 0; i < UHD_SAVE.length; i += 4) { const e = UHD_SAVE[i]; e.x = UHD_SAVE[i + 1]; e.y = UHD_SAVE[i + 2]; e.animT = UHD_SAVE[i + 3]; } UHD_SAVE.length = 0; }

// ---------- occlusion silhouettes (drawn just before the fog, over everything that hides them) ----------
function uhdDrawSilhouettes(ctx) {
  const list = UHD.occ; if (!list.length) return;
  const z = R.cam.zoom, getEnt = id => W.ents.get(id);
  const mute = typeof FX !== 'undefined' && FX ? FX.mute : undefined;
  if (typeof FX !== 'undefined' && FX) FX.mute = 'all';
  try {
    const t0 = performance.now(); let n = 0;
    for (const o of list) {
      if (n >= UHD.silMax || performance.now() - t0 > UHD.silMs) break;
      const occ = uhdOccluders(o, W.map, getEnt, entDepth); if (!occ.length) continue;
      const u = o.u, s = o.s, p = iso(o.x, o.y, W.map.h(o.x, o.y));
      const X0 = p.x - US * s.ax / s.S, Y0 = p.y - US * s.ay / s.S, Wd = US * s.cv.width / s.S, Ht = US * s.cv.height / s.S;
      const pw = Math.ceil(Wd * z), ph = Math.ceil(Ht * z); if (pw < 2 || ph < 2 || pw > 1200 || ph > 1200) continue;
      const m = uhdTmp('silmask', pw, ph), mg = m.getContext('2d');
      mg.setTransform(z, 0, 0, z, -X0 * z, -Y0 * z);
      for (const e of occ) { try { if (e.kind === 'bld') drawBuilding(mg, e); else drawRes(mg, e); } catch (err) { } }
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalAlpha = 1; mg.globalCompositeOperation = 'source-in';
      mg.drawImage(uhdSil(s, pcolor(u.owner).l || '#fff'), 0, 0, s.cv.width, s.cv.height, 0, 0, pw, ph);
      mg.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(m, 0, 0, pw, ph, X0, Y0, Wd, Ht); ctx.restore();
      UHD.n.sil++; n++;
    }
  } finally { if (typeof FX !== 'undefined' && FX) FX.mute = mute; }
}
if (UHD.on.any && UHD.on.unitsil && typeof drawFog === 'function') {
  const _df = drawFog;
  drawFog = function (ctx) {
    const t0 = performance.now();
    try { uhdDrawSilhouettes(ctx); } catch (e) { }
    UHD.ms.sil += performance.now() - t0;
    UHD.occ.length = 0;
    return _df.apply(this, arguments);
  };
}
if (UHD.on.any && typeof renderWorld === 'function') {
  const _rw = renderWorld;
  renderWorld = function (ctx, opts) {
    UHD.frame++; UHD.genMs = 0; UHD.genN = 0; UHD.occ.length = 0;
    const smooth = UHD.on.unitsmooth && W && W.list && !(opts && opts.editor);
    if (smooth) uhdSwapIn(uhdAlpha());
    try { return _rw.apply(this, arguments); } finally { if (smooth) uhdSwapOut(); UHD.occ.length = 0; }
  };
}

// ---------- icons ----------
const UHD_SVG = {
  food: `<defs><radialGradient id="m" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f6a070"/><stop offset=".5" stop-color="#c04a2c"/><stop offset="1" stop-color="#6a1c12"/></radialGradient></defs>
    <path d="M14.2 14.2l5 5" stroke="#2a1a0e" stroke-width="5" stroke-linecap="round"/><path d="M14.2 14.2l5 5" stroke="#f6eedc" stroke-width="3" stroke-linecap="round"/>
    <circle cx="21" cy="19.3" r="2.1" fill="#f6eedc" stroke="#2a1a0e" stroke-width=".9"/><circle cx="19.3" cy="21" r="2.1" fill="#f6eedc" stroke="#2a1a0e" stroke-width=".9"/>
    <path d="M2.2 9.6C2.2 4.6 6.4 1.6 10.8 2.2c5.4.8 8.4 6 6 10.8-1.8 3.6-5.4 5.4-9.2 4.8C4 17.2 2.2 13.8 2.2 9.6z" fill="url(#m)" stroke="#3a140c" stroke-width="1.1"/>
    <path d="M5.4 6.6c1.2-2.2 3.6-3 5.6-2.4" stroke="#ffd8bc" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
  wood: `<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b47a40"/><stop offset="1" stop-color="#5a3216"/></linearGradient><radialGradient id="r"><stop offset="0" stop-color="#f4d8a0"/><stop offset=".6" stop-color="#d6a464"/><stop offset="1" stop-color="#8a5a2a"/></radialGradient></defs>
    <g stroke="#2a1608" stroke-width="1"><rect x="1" y="13" width="17" height="8" rx="4" fill="url(#b)"/><rect x="5" y="4" width="17" height="8" rx="4" fill="url(#b)"/>
    <circle cx="18" cy="17" r="4" fill="url(#r)"/><circle cx="22" cy="8" r="4" fill="url(#r)" transform="translate(-1 0)"/></g>
    <circle cx="18" cy="17" r="1.6" fill="none" stroke="#9a6a32" stroke-width=".7"/><circle cx="21" cy="8" r="1.6" fill="none" stroke="#9a6a32" stroke-width=".7"/>
    <path d="M3.4 15h10M7.4 6h10" stroke="#e0aa70" stroke-width="1" stroke-linecap="round" opacity=".85"/>`,
  gold: `<defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff8c0"/><stop offset=".45" stop-color="#f2c630"/><stop offset="1" stop-color="#8a5806"/></radialGradient></defs>
    <g stroke="#4a2e04" stroke-width="1" fill="url(#g)"><path d="M1.6 20.4l2.4-6.4 6.2-1.4 3 6.8-2.6 2.6z"/><path d="M11.4 21.4l1.8-7 7-1 2.6 6-2.8 2.6z"/><path d="M5.6 12.4l2.6-7.4 7.2-1.2 3 6.8-4 3.4z"/></g>
    <path d="M8.6 7.4l2.6-.6M3.8 15.6l2.2-.5M14 15.4l2.4-.4" stroke="#fffbe2" stroke-width="1.3" stroke-linecap="round"/><path d="M20 1.4v5M17.5 3.9h5" stroke="#fffae0" stroke-width=".9"/>`,
  stone: `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecE8de"/><stop offset=".5" stop-color="#a8a196"/><stop offset="1" stop-color="#5a544c"/></linearGradient></defs>
    <g stroke="#26221e" stroke-width="1" fill="url(#s)"><rect x="1.4" y="13.4" width="10" height="8.2" rx="1.2"/><rect x="12.4" y="13.4" width="10" height="8.2" rx="1.2"/><rect x="6.6" y="4" width="10.6" height="8.6" rx="1.2"/></g>
    <path d="M3 15.2h5M14 15.2h5M8.4 5.8h5.4" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`,
  pop: `<defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ab4f0"/><stop offset="1" stop-color="#2a4a8a"/></linearGradient><linearGradient id="q" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecca92"/><stop offset="1" stop-color="#8a6a38"/></linearGradient></defs>
    <g stroke="#1a140c" stroke-width="1"><circle cx="16.4" cy="6" r="3.8" fill="#e8c4a0"/><path d="M9.4 22c0-6 3-9.4 7-9.4s7 3.4 7 9.4z" fill="url(#q)"/>
    <circle cx="7.8" cy="7.8" r="4" fill="#f0d0b0"/><path d="M.6 23c0-6.4 3.2-10 7.2-10s7.2 3.6 7.2 10z" fill="url(#p)"/></g>
    <path d="M5 6.8a2.8 2.8 0 0 1 2.6-2.2" stroke="#fff" stroke-width="1" fill="none" opacity=".85"/>`,
  water: `<defs><radialGradient id="w" cx=".4" cy=".55" r=".7"><stop offset="0" stop-color="#c8ecff"/><stop offset=".5" stop-color="#3c9ae0"/><stop offset="1" stop-color="#12508e"/></radialGradient></defs>
    <path d="M12 1.2C8.4 6.8 4.2 10.8 4.2 15.6a7.8 7.8 0 0 0 15.6 0C19.8 10.8 15.6 6.8 12 1.2z" fill="url(#w)" stroke="#0c2c50" stroke-width="1.1"/>
    <path d="M8 14.8c0 2.4 1.4 4.2 3.6 4.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".9"/>`,
  idle: `<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0b080"/><stop offset="1" stop-color="#6a4a28"/></linearGradient></defs>
    <g stroke="#1a140c" stroke-width="1"><circle cx="8.6" cy="8.6" r="4" fill="#e8c4a0"/><path d="M4 7.6c.6-3 2.6-4.4 4.6-4.4s4 1.4 4.6 4.4z" fill="#e6cc7a"/><path d="M1 23c0-6.4 3.4-9.8 7.6-9.8s7.6 3.4 7.6 9.8z" fill="url(#v)"/></g>
    <path d="M14.6 4.2h5.6l-5.6 6.4h5.6" stroke="#14304e" stroke-width="3.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M14.6 4.2h5.6l-5.6 6.4h5.6" stroke="#bfe4ff" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`,
};
function uhdIconUrl(k) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">${UHD_SVG[k]}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s*\n\s*/g, ' '));
}
function uhdIconImg(k, alt) { return `<img class="uhd-ri" src="${uhdIconUrl(k)}" alt="${alt || k}" draggable="false">`; }
UHD.RES_EMOJI = typeof RES_ICON !== 'undefined' ? Object.assign({}, RES_ICON) : null;
if (UHD.on.any && UHD.on.hdicons && typeof RES_ICON !== 'undefined') {
  for (const r of ['food', 'wood', 'gold', 'stone']) RES_ICON[r] = uhdIconImg(r, r[0].toUpperCase() + r.slice(1));
}
function uhdSwapEmoji(el, k, alt) {
  if (!el || el.dataset.uhd) return;
  const tn = el.firstChild; if (!tn || tn.nodeType !== 3) return;
  tn.nodeValue = ' '; el.insertAdjacentHTML('afterbegin', uhdIconImg(k, alt)); el.dataset.uhd = '1';
}
function uhdStyle() {
  if (typeof document === 'undefined' || document.getElementById('uhd-style')) return;
  const st = document.createElement('style'); st.id = 'uhd-style';
  st.textContent = `.uhd-ri{height:22px;width:22px;vertical-align:-5px;margin-right:2px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.cost .uhd-ri,.btn .uhd-ri{height:16px;width:16px;vertical-align:-3px;margin-right:2px}
#topbar .res{display:flex;align-items:center;gap:3px}
.cmd,.portrait,.mini{border-color:#c8a058 #7a5a2a #5a4020 #a88040;box-shadow:inset 0 1px 0 rgba(255,236,190,.45),inset 0 0 0 1px rgba(0,0,0,.55),inset 0 -6px 10px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.7)}
.cmd:hover{box-shadow:inset 0 1px 0 rgba(255,240,200,.7),inset 0 0 0 1px rgba(0,0,0,.4),0 0 6px rgba(255,220,130,.55)}`;
  document.head.appendChild(st);
}
if (UHD.on.any && UHD.on.hdicons && typeof initHUD === 'function') {
  const _ih = initHUD;
  initHUD = function () {
    const r = _ih.apply(this, arguments);
    uhdStyle();
    for (const [id, k, alt] of [['food', 'food', 'Food'], ['wood', 'wood', 'Wood'], ['gold', 'gold', 'Gold'], ['stone', 'stone', 'Stone'], ['pop', 'pop', 'Population'], ['vil', 'idle', 'Idle villagers']]) uhdSwapEmoji(document.getElementById('r-' + id), k, alt);
    return r;
  };
}
if (UHD.on.any && UHD.on.hdicons && typeof updateTopbar === 'function') {
  const _ut = updateTopbar;
  updateTopbar = function () {
    const r = _ut.apply(this, arguments);
    if (typeof document !== 'undefined') { const el = document.getElementById('r-water'); if (el && !el.dataset.uhd) uhdSwapEmoji(el, 'water', 'Water'); }
    return r;
  };
}
// framed, lit unit portraits rendered through the sprite pipeline
function uhdUnitIcon(id, owner) {
  if (owner === undefined) owner = W ? W.humanId : 1;
  const d = UNITS[id], cat = uhdCategory(d) || 'h';
  const Z = 128, cv = uhdCanvas(Z, Z), g = cv.getContext('2d');
  const pc = W && W.players[owner] ? W.players[owner].color : PLAYER_COLORS[0];
  const bg = g.createRadialGradient(Z * 0.45, Z * 0.35, 4, Z * 0.5, Z * 0.55, Z * 0.78);
  bg.addColorStop(0, '#7a6448'); bg.addColorStop(0.6, '#3e3122'); bg.addColorStop(1, '#17110a'); g.fillStyle = bg; g.fillRect(0, 0, Z, Z);
  const glow = g.createRadialGradient(Z / 2, Z * 0.9, 2, Z / 2, Z * 0.9, Z * 0.5); glow.addColorStop(0, pc.c + 'aa'); glow.addColorStop(1, pc.c + '00');
  g.fillStyle = glow; g.fillRect(0, 0, Z, Z);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(Z / 2, Z * 0.86, Z * 0.3, Z * 0.07, 0, 0, 6.3); g.fill();
  const sc = d.naval ? 0.95 : d.tags.includes('mounted') || d.tags.includes('siege') ? 1.25 : d.animal ? 1.8 : 1.7;
  const S = sc * 2; // icon canvas is 128 px for a 64 px layout
  const fake = { id: 7, type: id, owner: owner, anim: 'idle', animT: 0.5, face: 1, cargo: [], x: 0, y: 0, carry: null, work: null };
  const s = uhdBuild(fake, d, d.naval ? 's' : cat, 0.5, 9, 1, 0, S, UHD.drawFig || drawUnitFigure, 1.4);
  const px = Z / 2 + (d.naval ? 0 : -4), py = d.naval ? Z * 0.75 : Z * 0.875;
  g.drawImage(s.cv, px - s.ax, py - s.ay);
  const gl = g.createLinearGradient(0, 0, 0, Z * 0.5); gl.addColorStop(0, 'rgba(255,248,225,0.22)'); gl.addColorStop(1, 'rgba(255,248,225,0)');
  g.fillStyle = gl; g.fillRect(0, 0, Z, Z * 0.5);
  const vg = g.createRadialGradient(Z / 2, Z / 2, Z * 0.42, Z / 2, Z / 2, Z * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = vg; g.fillRect(0, 0, Z, Z);
  g.strokeStyle = 'rgba(255,230,170,0.35)'; g.lineWidth = 2; g.strokeRect(3, 3, Z - 6, Z - 6);
  return cv.toDataURL();
}
if (UHD.on.any && UHD.on.hdicons && UHD.on.unitsprites && typeof iconFor === 'function' && typeof document !== 'undefined') {
  const _if = iconFor;
  iconFor = function (key) {
    const at = typeof key === 'string' ? key.indexOf('@') : -1, type = typeof key === 'string' ? key.slice(5, at > 0 ? at : undefined) : '';
    if (typeof key !== 'string' || !key.startsWith('unit:') || !UNITS[type]) return _if.apply(this, arguments);
    if (ICONS.has(key)) return ICONS.get(key);
    let url;
    try { url = uhdUnitIcon(type, at > 0 ? +key.slice(at + 1) : undefined); } catch (e) { return _if.apply(this, arguments); }
    ICONS.set(key, url); return url;
  };
}
