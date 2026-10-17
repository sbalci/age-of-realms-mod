// Shared parts of the Islamic kit recipes (Turks and Saracens): civ palettes, slot colours and placement helpers.
// The pieces are GLBs in assets/original/islamic/, built by tools/art/blender/islamic_kit.py. Coordinates follow
// kenney-recipes.js: game tiles x, y and height z in storeys; the camera sees the east (+x) and south (+y) faces.

// Per-age colours copied from CIV_ARCH in game/js/civ_art.js. tests/islamic-art.test.js keeps them in sync.
export const PALETTES = {
  turks: [
    { wall: '#a88254', roof: '#3a7880', trim: '#684828', stone: '#b09878', accent: '#289098', dome: '#3a7880' },
    { wall: '#d6be98', roof: '#2e7c88', trim: '#6e5030', stone: '#c2ac8c', accent: '#2494a0', dome: '#2e8490' },
    { wall: '#ded4c2', roof: '#526270', trim: '#288290', stone: '#ccc2b0', accent: '#c83028', dome: '#586878' },
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
    { wall: '#ece9e2', roof: '#3c4854', trim: '#485460', stone: '#d8d2c6', accent: '#c83028', dome: '#4c5c6c' },
    { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' },
  ],
  saracens: [
    { wall: '#b88c58', roof: '#d4b068', trim: '#78522c', stone: '#bca07c', accent: '#1e824c', dome: '#c8a058' },
    { wall: '#dfc496', roof: '#c89e54', trim: '#7c5630', stone: '#ceb28a', accent: '#1e824c', dome: '#2e8b78' },
    { wall: '#e8d0a6', roof: '#28887a', trim: '#8c6438', stone: '#dcc29a', accent: '#d8a830', dome: '#289484' },
    { wall: '#f2deb8', roof: '#1e7c72', trim: '#c89830', stone: '#e8d0aa', accent: '#e8b838', dome: '#d8a830' },
  ],
};
export const FIXED = { gold: '#e8c040', dark: '#2a2420', wood: '#6b4a2b', metal: '#4a4640', brick: '#9a4a32' };
// One multiplier on every slot colour. The civ palettes were tuned for flat 2D art; tuned at the pilot's review point 1.
export const SHADE = 0.92;
// Height of each crowning piece at scale 1, so a finial or another piece can sit on top. tests/islamic-art.test.js
// checks these against the GLBs.
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76,
  'tower-round': 2.31, 'asbad': 1.67, 'kiosk': 1.1, 'lookout': 2.16, 'clock-tower': 2.52, 'silo': 2.4, 'headframe': 2.02 };

const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('');

// Colour of every kit material slot for one civ at one age (ages past the civ's palette use its last row).
// The band slot draws the striped (ablaq) courses: trim-coloured for Saracens from age 2, wall-coloured otherwise.
export function islamicSlots(civ, age) {
  if (!PALETTES[civ]) throw new Error('islamic kit pieces need recipe.civ to be one of ' + Object.keys(PALETTES).join(', ') + ' (got ' + civ + ')');
  const P = PALETTES[civ][Math.min(PALETTES[civ].length - 1, Math.max(0, age))];
  const band = civ === 'saracens' && age >= 2 ? P.trim : P.wall;
  const out = { wall: P.wall, stone: P.stone, trim: P.trim, roof: P.roof, dome: P.dome, accent: P.accent, band, ...FIXED };
  for (const k of Object.keys(out)) out[k] = shade(out[k], SHADE);
  return out;
}

export const I = 'islamic';
export const ROT = { e: 0, s: -90, w: 180, n: 90 };
export const CYPRESS = { color: '#2f5a3a' };
export const HIDE = { color: '#b49a72' };   // the Kenney tent's own fabric renders pink; hide-coloured canvas suits a camp

// ring of wall pieces around a w x d block of cells from tile (x0, y0); feats: { s0: 'wall-door', e1: 'wall-window' }
export function ring(k, x0, y0, w, d, z = 0, feats = {}, base = 'wall') {
  const pick = (side, i) => feats[side + i] || base;
  for (let i = 0; i < w; i++) { k.add(I, pick('n', i), x0 + i + 0.5, y0 + 0.5, z, ROT.n); k.add(I, pick('s', i), x0 + i + 0.5, y0 + d - 0.5, z, ROT.s); }
  for (let j = 0; j < d; j++) { k.add(I, pick('w', j), x0 + 0.5, y0 + j + 0.5, z, ROT.w); k.add(I, pick('e', j), x0 + w - 0.5, y0 + j + 0.5, z, ROT.e); }
}
// flat roof over the block, optionally edged with a parapet piece along every outer cell edge
export function roof(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
// a crowning piece standing at (x, y, z), optionally topped by the crescent finial
export function crown(k, piece, x, y, z, s = 1, alem = false) {
  k.add(I, piece, x, y, z, 0, s);
  if (alem) k.add(I, 'alem', x, y, z + TOP[piece] * s, 0, Math.max(1, s * 0.8));
}
// arcaded portico along the south side of a 1-cell-deep row, roofed at storey 1
export function portico(k, x0, y0, w, domes, edge = null) {
  for (let i = 0; i < w; i++) k.add(I, 'wall-arcade', x0 + i + 0.5, y0 + 0.5, 0, ROT.s);
  k.add(I, 'wall-arcade', x0 + w - 0.5, y0 + 0.5, 0, ROT.e);
  k.add(I, 'wall-arcade', x0 + 0.5, y0 + 0.5, 0, ROT.w);
  roof(k, x0, y0, w, 1, 1, edge);
  if (domes) for (let i = 0; i < w; i++) crown(k, domes, x0 + i + 0.5, y0 + 0.5, 1.06, 0.55);
}
// low walls (courtyards, yards, paddocks) around a w x d block: wall pieces scaled to height h
export function lowWall(k, x0, y0, w, d, h = 0.45, base = 'wall') {
  const s = [1, h, 1];
  for (let i = 0; i < w; i++) { k.add(I, base, x0 + i + 0.5, y0 + 0.5, 0, ROT.n, s); k.add(I, base, x0 + i + 0.5, y0 + d - 0.5, 0, ROT.s, s); }
  for (let j = 0; j < d; j++) { k.add(I, base, x0 + 0.5, y0 + j + 0.5, 0, ROT.w, s); k.add(I, base, x0 + w - 0.5, y0 + j + 0.5, 0, ROT.e, s); }
}
// flat roof over the outer ring of cells of a block, leaving its courtyard open; optional parapet as in roof()
export function courtyard(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (i === 0 || j === 0 || i === w - 1 || j === d - 1) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
// columned porch along the south side of a 1-cell-deep row, roofed at storey 1, with an optional pediment
export function porch(k, x0, y0, w, pediment = false) {
  const n = w + 1;
  for (let i = 0; i < n; i++) k.add(I, 'column', x0 + 0.12 + i * (w - 0.24) / (n - 1), y0 + 0.88, 0);
  roof(k, x0, y0, w, 1, 1);
  if (pediment) k.add(I, 'pediment', x0 + w / 2, y0 + 0.5, 1.06, ROT.s, [1, 1, w]);
}
// factory roof: one sawtooth piece per cell, north-light glazing facing +x
export function sawtooth(k, x0, y0, w, d, z) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-sawtooth', x0 + i + 0.5, y0 + j + 0.5, z);
}
