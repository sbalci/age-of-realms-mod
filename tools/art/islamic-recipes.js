// Turks and Saracens building recipes, assembled from the original parts kit in assets/original/islamic/
// (built by tools/art/blender/islamic_kit.py). Same coordinates as kenney-recipes.js: game tiles x, y and
// height z in storeys; the camera sees the east (+x) and south (+y) faces. kenney-recipes.js merges these
// into RECIPES, so this file must not import anything (tests/islamic-art.test.js also loads it in a vm).

// Per-age colours copied from CIV_ARCH in game/js/civ_art.js, ages 0-3. tests/islamic-art.test.js keeps them in sync.
export const PALETTES = {
  turks: [
    { wall: '#a88254', roof: '#3a7880', trim: '#684828', stone: '#b09878', accent: '#289098', dome: '#3a7880' },
    { wall: '#d6be98', roof: '#2e7c88', trim: '#6e5030', stone: '#c2ac8c', accent: '#2494a0', dome: '#2e8490' },
    { wall: '#ded4c2', roof: '#526270', trim: '#288290', stone: '#ccc2b0', accent: '#c83028', dome: '#586878' },
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
  ],
  saracens: [
    { wall: '#b88c58', roof: '#d4b068', trim: '#78522c', stone: '#bca07c', accent: '#1e824c', dome: '#c8a058' },
    { wall: '#dfc496', roof: '#c89e54', trim: '#7c5630', stone: '#ceb28a', accent: '#1e824c', dome: '#2e8b78' },
    { wall: '#e8d0a6', roof: '#28887a', trim: '#8c6438', stone: '#dcc29a', accent: '#d8a830', dome: '#289484' },
    { wall: '#f2deb8', roof: '#1e7c72', trim: '#c89830', stone: '#e8d0aa', accent: '#e8b838', dome: '#d8a830' },
  ],
};
export const FIXED = { gold: '#e8c040', dark: '#2a2420' };
// One multiplier on every slot colour. The civ palettes were tuned for flat 2D art; tune once at review point 1.
export const SHADE = 0.92;
// Height of each crowning piece at scale 1, so a finial can sit on top. tests/islamic-art.test.js checks these against the GLBs.
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76 };

const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('');

// Colour of every kit material slot for one civ at one age. The band slot draws the striped (ablaq) courses:
// trim-coloured for Saracens from age 2, wall-coloured (a plain ledge) otherwise.
export function islamicSlots(civ, age) {
  const P = PALETTES[civ][Math.min(3, Math.max(0, age))];
  const band = civ === 'saracens' && age >= 2 ? P.trim : P.wall;
  const out = { wall: P.wall, stone: P.stone, trim: P.trim, roof: P.roof, dome: P.dome, accent: P.accent, band, ...FIXED };
  for (const k of Object.keys(out)) out[k] = shade(out[k], SHADE);
  return out;
}

const I = 'islamic';
const ROT = { e: 0, s: -90, w: 180, n: 90 };
const CYPRESS = { color: '#2f5a3a' };

// ring of wall pieces around a w x d block of cells from tile (x0, y0); feats: { s0: 'wall-door', e1: 'wall-window' }
function ring(k, x0, y0, w, d, z = 0, feats = {}, base = 'wall') {
  const pick = (side, i) => feats[side + i] || base;
  for (let i = 0; i < w; i++) { k.add(I, pick('n', i), x0 + i + 0.5, y0 + 0.5, z, ROT.n); k.add(I, pick('s', i), x0 + i + 0.5, y0 + d - 0.5, z, ROT.s); }
  for (let j = 0; j < d; j++) { k.add(I, pick('w', j), x0 + 0.5, y0 + j + 0.5, z, ROT.w); k.add(I, pick('e', j), x0 + w - 0.5, y0 + j + 0.5, z, ROT.e); }
}
// flat roof over the block, optionally edged with a parapet piece along every outer cell edge
function roof(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
// a crowning piece standing at (x, y, z), optionally topped by the crescent finial
function crown(k, piece, x, y, z, s = 1, alem = false) {
  k.add(I, piece, x, y, z, 0, s);
  if (alem) k.add(I, 'alem', x, y, z + TOP[piece] * s, 0, Math.max(1, s * 0.8));
}
// arcaded portico along the south side of a 1-cell-deep row, roofed at storey 1
function portico(k, x0, y0, w, domes, edge = null) {
  for (let i = 0; i < w; i++) k.add(I, 'wall-arcade', x0 + i + 0.5, y0 + 0.5, 0, ROT.s);
  k.add(I, 'wall-arcade', x0 + w - 0.5, y0 + 0.5, 0, ROT.e);
  k.add(I, 'wall-arcade', x0 + 0.5, y0 + 0.5, 0, ROT.w);
  roof(k, x0, y0, w, 1, 1, edge);
  if (domes) for (let i = 0; i < w; i++) crown(k, domes, x0 + i + 0.5, y0 + 0.5, 1.06, 0.55);
}

export const ISLAMIC_RECIPES = {
  house_turks: { civ: 'turks', size: 2, styles: [0, 1, 2, 3], scale: 0.72, sq: 0.80, build(k) {
    ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
    if (k.style <= 1) {
      // Seljuk stone dwelling with a flat roof; a roof room from age 1
      roof(k, 0.1, 0.1, 2, 2, 1);
      if (k.style === 1) { ring(k, 0.1, 0.1, 1, 1, 1.06, { s0: 'wall-window', e0: 'wall-window' }); roof(k, 0.1, 0.1, 1, 1, 2.06); }
    } else {
      // Ottoman konak: timber-framed upper floor, projecting cumba bay, wide hipped roof
      ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-timber');
      k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
      if (k.style === 3) k.add(I, 'bay-cumba', 1.6, 1.1, 1, ROT.e);
      k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 1, 2]);
    }
    k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
  } },
  tc_turks: { civ: 'turks', size: 4, styles: [0, 1, 2, 3], scale: 1.06, sq: 1.02, build(k) {
    if (k.style <= 1) {
      // Seljuk caravanserai: walled stone court behind a tall tiled portal, with a kümbet tower
      ring(k, 0.5, 0.5, 3, 3, 0, { e0: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
      roof(k, 0.5, 0.5, 3, 3, 1, 'merlon-pointed');
      k.add(I, 'portal', 2, 3, 0, ROT.s);
      crown(k, 'kumbet', 1, 1, 1.06, 0.9);
      if (k.style === 1) crown(k, 'dome-lead', 2.4, 1.6, 1.06, 1.1);
      k.add('nature', 'tent_detailedOpen', 3.7, 3.7, 0, -30, 0.5);
    } else {
      // Ottoman Divan: two-storey hall behind a domed portico, stepped domes up to a central dome with an alem
      ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
      ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
      roof(k, 0.5, 0.5, 3, 2, 2);
      crown(k, 'dome-lead', 2, 1.5, 2.06, k.style === 3 ? 2.3 : 2.1, true);
      for (const x of [0.95, 3.05]) crown(k, 'dome-lead', x, 1.5, 2.06, 0.8);
      portico(k, 0.5, 2.5, 3, 'dome-lead');
      k.add('town', 'fountain-round', 0.3, 3.75, 0, 0, 0.3);
      if (k.style === 3) k.add('nature', 'tree_cone', 3.75, 3.75, 0, 0, 0.9, CYPRESS);
    }
    k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
  } },
  monastery_turks: { civ: 'turks', size: 3, styles: [2, 3], scale: 1.02, sq: 1.02, build(k) {
    if (k.style === 2) {
      // Seljuk Gök Medrese: stone court, tiled portal flanked by twin minarets, domed hall
      ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
      roof(k, 0, 0, 3, 3, 1, 'merlon-pointed');
      k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
      for (const x of [1.1, 1.9]) crown(k, 'minaret-pencil', x, 2.97, TOP.portal, 0.55);
      crown(k, 'dome-lead', 1.5, 1.1, 1.06, 1.3, true);
    } else {
      // Ottoman mosque: prayer hall under a great dome with corner domes, domed portico, pencil minaret
      ring(k, 0.5, 0, 2, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
      ring(k, 0.5, 0, 2, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
      roof(k, 0.5, 0, 2, 2, 2);
      crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
      for (const [x, y] of [[0.95, 0.45], [2.05, 0.45], [0.95, 1.55], [2.05, 1.55]]) crown(k, 'dome-lead', x, y, 2.06, 0.6);
      portico(k, 0.5, 2, 2, 'dome-lead');
      crown(k, 'minaret-pencil', 2.75, 0.25, 0, 1.15);
    }
  } },
};
