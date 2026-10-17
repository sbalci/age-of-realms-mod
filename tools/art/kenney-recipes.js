import { TURKS_RECIPES } from './turks-recipes.mjs';
import { SARACENS_RECIPES } from './saracens-recipes.mjs';

// Building recipes for the Kenney art style. Coordinates are game tiles: a building of size s covers
// x, y in [0, s]; z is height in world units (one Kenney storey = 1). Kenney modules are 1x1 cells
// centred on their origin; wall panels sit on the cell's +x edge and are rotated to face outwards.
// The camera looks from +x/+y, so the east (+x) and south (+y) walls are the visible ones.

export const STYLES = [   // per age, like STYLE in game/js/render.js
  { roof: '#c8a45a', wall: 'wall-wood', win: 'wall-wood-window-shutters', door: 'wall-wood-door', stone: false },
  { roof: '#b0482f', wall: 'wall-wood', win: 'wall-wood-window-glass', door: 'wall-wood-door', stone: false },
  { roof: '#4d6278', wall: 'wall', win: 'wall-window-glass', door: 'wall-door', stone: true },
  { roof: '#3b5068', wall: 'wall', win: 'wall-window-stone', door: 'wall-door', stone: true },
];
const AGES = [0, 1, 2, 3];
const ROT = { e: 0, s: -90, w: 180, n: 90 };

// ---- helpers ----
// ring of wall panels around a w x d block of cells starting at tile (x0, y0); feats: { 'e0': 'door', 's1': 'win' }
function walls(k, x0, y0, w, d, z = 0, feats = {}, model) {
  const S = k.S, base = model || S.wall;
  const pick = (side, i) => { const f = feats[side + i]; return f === 'door' ? S.door : f === 'win' ? S.win : f || base; };
  for (let i = 0; i < w; i++) { k.add('town', pick('n', i), x0 + i + 0.5, y0 + 0.5, z, ROT.n); k.add('town', pick('s', i), x0 + i + 0.5, y0 + d - 0.5, z, ROT.s); }
  for (let j = 0; j < d; j++) { k.add('town', pick('w', j), x0 + 0.5, y0 + j + 0.5, z, ROT.w); k.add('town', pick('e', j), x0 + w - 0.5, y0 + j + 0.5, z, ROT.e); }
}
// gable roof over a w x d block; ridge runs along the longer side. 'high' uses the steep roof pieces.
function roof(k, x0, y0, w, d, z, high = false) {
  const piece = high ? 'roof-high' : 'roof';
  if (w <= d) {               // ridge along y: two slopes across x, each scaled to half the width
    const sx = w / 2;
    for (let j = 0; j < d; j++) {
      k.add('town', piece, x0 + w / 4, y0 + j + 0.5, z, 0, [sx, sx, 1]);
      k.add('town', piece, x0 + 3 * w / 4, y0 + j + 0.5, z, 180, [sx, sx, 1]);
    }
  } else {
    const sy = d / 2;
    for (let i = 0; i < w; i++) {
      k.add('town', piece, x0 + i + 0.5, y0 + d / 4, z, 90, [sy, sy, 1]);
      k.add('town', piece, x0 + i + 0.5, y0 + 3 * d / 4, z, -90, [sy, sy, 1]);
    }
  }
}

function pillars(k, pts, z = 0, h = 1, model = 'pillar-wood') { for (const [x, y] of pts) k.add('town', model, x, y, z, 0, [1, h, 1]); }
// one-sided lean-to roof strip along a side of a block, sloping outwards
function leanTo(k, side, x0, y0, len, z, depth = 1) {
  for (let i = 0; i < len; i++) {
    if (side === 's') k.add('town', 'roof', x0 + i + 0.5, y0 + depth / 2, z, 90, [depth, 0.6, 1]);
    if (side === 'n') k.add('town', 'roof', x0 + i + 0.5, y0 + depth / 2, z, -90, [depth, 0.6, 1]);
    if (side === 'e') k.add('town', 'roof', x0 + depth / 2, y0 + i + 0.5, z, 0, [depth, 0.6, 1]);
    if (side === 'w') k.add('town', 'roof', x0 + depth / 2, y0 + i + 0.5, z, 180, [depth, 0.6, 1]);
  }
}

export const RECIPES = {
  house: { size: 2, styles: AGES, scale: 0.72, sq: 0.80, build(k) {
    walls(k, 0.1, 0.1, 2, 2, 0, { s0: 'door', e1: 'win', s1: 'win' });
    roof(k, 0.1, 0.1, 2, 2, 1);
    if (k.style >= 1) k.add('town', 'chimney', 0.55, 0.55, 1.2, 90);
    if (k.style >= 2) {
      k.add('town', 'hedge', 1.55, 1.92, 0, 0, 0.55);
    }
    k.add('town', 'lantern', 0.2, 1.92, 0, 0, 0.65);
  } },
  tc: { size: 4, styles: AGES, scale: 1.06, sq: 1.02, build(k) {
    // a grand two-storey town hall with a steep roof, a 3.5-storey corner keep tower and a colonnaded porch
    walls(k, 0.5, 0.5, 3, 2, 0, { s0: 'win', s1: 'door', s2: 'win', e0: 'win', e1: 'win' });
    walls(k, 0.5, 0.5, 3, 2, 1, { s0: 'win', s1: 'win', s2: 'win', e0: 'win', e1: 'win' });
    roof(k, 0.5, 0.5, 3, 2, 2);
    walls(k, 3, 2.5, 1, 1, 0, { s0: 'win', e0: 'door' }); walls(k, 3, 2.5, 1, 1, 1, { s0: 'win', e0: 'win' }); walls(k, 3, 2.5, 1, 1, 2, { s0: 'win', e0: 'win' });
    k.add('town', 'roof-high-point', 3.5, 3, 3);
    leanTo(k, 's', 0.5, 2.5, 2, 0.7, 0.9); pillars(k, [[0.6, 3.35], [1.5, 3.35], [2.45, 3.35]], 0, 0.72, k.S.stone ? 'pillar-stone' : 'pillar-wood');
    if (k.style >= 1) k.add('town', 'chimney', 1, 0.9, 2.5, 90);
    if (k.style >= 2) k.add('town', 'fountain-round', 2.25, 3.55, 0, 0, 0.34);
    k.add('town', 'lantern', 0.3, 3.7, 0, 0, 0.8); k.add('town', 'cart', 1.2, 3.9, 0, 90, 0.6);
  } },
  mill: { size: 2, styles: AGES, scale: 0.82, sq: 0.94, build(k) {
    walls(k, 0.5, 0.5, 1, 1, 0, { s0: 'door', e0: 'win' });
    walls(k, 0.5, 0.5, 1, 1, 1, { s0: 'win' });
    k.add('town', k.style >= 2 ? 'roof-high-point' : 'roof-point', 1, 1, 2);
    k.add('town', 'windmill', 1.62, 1, 1.55, 0, 0.62);
    k.add('town', 'cart', 0.35, 1.55, 0, 90, 0.7);
  } },
  lumbercamp: { size: 2, styles: AGES, scale: 0.70, sq: 0.76, build(k) {
    walls(k, 0, 0, 2, 1, 0, { n0: 'wall-wood', n1: 'wall-wood', w0: 'wall-wood', e0: 'poles' }, 'wall-wood');
    roof(k, 0, 0, 2, 1, 1);
    pillars(k, [[0.1, 0.95], [1.9, 0.95], [1, 0.95]]);
    k.add('nature', 'log_stackLarge', 0.7, 1.55, 0, 0, 0.9);
    k.add('nature', 'log_stack', 1.6, 1.5, 0, 90, 0.8);
    k.add('nature', 'stump_round', 1.75, 0.6, 0, 0, 0.8);
  } },
  miningcamp: { size: 2, styles: AGES, scale: 0.70, sq: 0.76, build(k) {
    walls(k, 0, 0, 2, 1, 0, { e0: 'poles' }, k.S.stone ? 'wall' : 'wall-wood');
    roof(k, 0, 0, 2, 1, 1);
    pillars(k, [[0.1, 0.95], [1.9, 0.95], [1, 0.95]]);
    k.add('town', 'cart-high', 0.65, 1.5, 0, 90, 0.8);
    k.add('nature', 'rock_smallA', 1.55, 1.45, 0, 0, 0.9);
    k.add('nature', 'rock_smallC', 1.75, 1.75, 0, 40, 0.7);
  } },
  dock: { size: 3, styles: AGES, scale: 0.92, sq: 0.86, build(k) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) k.add('town', 'planks', i + 0.5, j + 0.5, 0.05);
    for (const [x, y] of [[0.05, 0.05], [2.95, 0.05], [0.05, 2.95], [2.95, 2.95], [1.5, 2.95], [2.95, 1.5]]) k.add('town', 'pillar-wood', x, y, -0.6, 0, [1.2, 0.75, 1.2]);
    walls(k, 0, 0, 1, 1, 0.06, { s0: 'door', e0: 'win' });
    roof(k, 0, 0, 1, 1, 1.06);
    k.add('town', 'lantern', 2.7, 2.7, 0.05, 0, 0.8);
    k.add('town', 'cart', 2, 1, 0.05, 30, 0.6);
  } },
  market: { size: 3, styles: AGES, scale: 0.88, sq: 0.84, build(k) {
    walls(k, 0, 0, 3, 1, 0, { s0: 'win', s1: 'door', s2: 'win' });
    roof(k, 0, 0, 3, 1, 1);
    k.add('town', 'stall-red', 0.6, 1.8, 0); k.add('town', 'stall-green', 1.6, 2.3, 0, 0); k.add('town', 'stall', 2.5, 1.7, 0, 90);
    k.add('town', 'stall-stool', 2.6, 2.4, 0); k.add('town', 'cart', 0.7, 2.6, 0, 90, 0.7);
  } },
  blacksmith: { size: 3, styles: AGES, scale: 0.84, sq: 0.84, build(k) {
    walls(k, 0, 0, 2, 2, 0, { s0: 'door', e1: 'win' }, k.S.stone ? 'wall' : 'wall-wood');
    roof(k, 0, 0, 2, 2, 1);
    k.add('town', 'chimney-base', 1.5, 0.5, 0, 0); k.add('town', 'chimney', 1.5, 0.5, 1, 0); k.add('town', 'chimney-top', 1.5, 0.5, 2, 0);
    leanTo(k, 's', 0, 2, 2, 0.7, 0.8); pillars(k, [[0.1, 2.75], [1, 2.75], [1.9, 2.75]], 0, 0.72);
    k.add('town', 'wheel', 2.3, 2.4, 0, 0, 1); k.add('nature', 'rock_smallFlatA', 1, 2.5, 0, 0, 0.7);
  } },
  university: { size: 3, styles: AGES, scale: 1.02, sq: 0.98, build(k) {
    walls(k, 0, 0.5, 3, 2, 0, { s0: 'win', s1: 'door', s2: 'win', e0: 'win', e1: 'win' }, k.S.stone ? 'wall' : 'wall-wood');
    walls(k, 0, 0.5, 3, 2, 1, { s0: 'win', s1: 'win', s2: 'win', e0: 'win', e1: 'win' }, k.S.stone ? 'wall' : 'wall-wood');
    roof(k, 0, 0.5, 3, 2, 2);
    walls(k, 2, 0.5, 1, 1, 2, { s0: 'wall-window-round', e0: 'wall-window-round' }, 'wall');
    k.add('town', 'roof-high-point', 2.5, 1.0, 3);
    leanTo(k, 's', 0.5, 2.45, 2, 0.75, 0.5);
    pillars(k, [[0.55, 2.9], [1.45, 2.9], [2.45, 2.9]], 0, 0.75, 'pillar-stone');
    k.add('town', 'fountain-round', 2.45, 2.65, 0, 0, 0.28);
    k.add('town', 'hedge', 0.35, 2.75, 0, 0, 0.55);
  } },
  monastery: { size: 3, styles: AGES, scale: 1.02, sq: 1.02, build(k) {
    walls(k, 0, 0, 2, 3, 0, { s0: 'wall-doorway-round', e1: 'wall-window-round', e0: 'wall-window-round', e2: 'wall-window-round' }, 'wall');
    walls(k, 0, 0, 2, 3, 1, { e1: 'wall-window-round' }, 'wall');
    roof(k, 0, 0, 2, 3, 2, true);
    walls(k, 2, 2, 1, 1, 0, { s0: 'wall-window-round' }, 'wall'); walls(k, 2, 2, 1, 1, 1, { s0: 'wall-window-round', e0: 'wall-window-round' }, 'wall'); walls(k, 2, 2, 1, 1, 2, { s0: 'wall-window-small', e0: 'wall-window-small' }, 'wall');
    k.add('town', 'roof-high-point', 2.5, 2.5, 3);
    k.add('nature', 'tree_cone', 2.5, 0.6, 0, 0, 0.8);
    k.add('town', 'fountain-round', 2.45, 1.35, 0, 0, 0.28);
  } },
  barracks: { size: 3, styles: AGES, scale: 0.98, sq: 0.94, build(k) {
    walls(k, 0, 0, 3, 2, 0, { s0: 'win', s1: 'door', s2: 'win', e1: 'win' });
    roof(k, 0, 0, 3, 2, 1);
    walls(k, 2, 0, 1, 1, 1, { s0: 'win', e0: 'win' });
    k.add('town', k.style >= 2 ? 'roof-high-point' : 'roof-point', 2.5, 0.5, 2);
    for (let i = 0; i < 3; i++) k.add('town', 'fence', i + 0.5, 2.5, 0, ROT.s);
    k.add('town', 'fence', 2.5, 2.5, 0, ROT.e); k.add('town', 'banner-red', 2.5, 1.5, 0, 0, 0.9);
    k.add('town', 'lantern', 1.4, 2.1, 0, 0, 0.7);
  } },
  range: { size: 3, styles: AGES, scale: 0.88, sq: 0.84, build(k) {
    walls(k, 0, 0, 2, 2, 0, { s0: 'door', e0: 'win', e1: 'win' });
    roof(k, 0, 0, 2, 2, 1);
    leanTo(k, 'e', 2, 0, 2, 0.68, 0.55);
    for (let i = 0; i < 3; i++) k.add('town', 'fence', i + 0.5, 2.5, 0, ROT.s);
    for (let j = 0; j < 2; j++) k.add('town', 'fence', 2.5, j + 0.5, 0, ROT.e);
    k.add('town', 'wheel', 2.5, 1.2, 0, 0, 1.3); k.add('town', 'stall-bench', 1.2, 2.4, 0, 90);
    k.add('town', 'banner-green', 0.4, 2.35, 0, 0, 0.85);
  } },
  stable: { size: 3, styles: AGES, scale: 0.90, sq: 0.84, build(k) {
    walls(k, 0, 0, 3, 2, 0, { s0: 'wall-wood-doorway-square-wide', s2: 'wall-wood-doorway-square-wide', s1: 'win', e1: 'win' }, 'wall-wood');
    roof(k, 0, 0, 3, 2, 1);
    leanTo(k, 's', 0, 2, 3, 0.65, 0.5);
    for (let i = 0; i < 3; i++) k.add('town', i === 1 ? 'fence-gate' : 'fence', i + 0.5, 2.5, 0, ROT.s);
    k.add('town', 'fence', 2.5, 2.5, 0, ROT.e); k.add('town', 'fence', 0.5, 2.5, 0, ROT.w);
    k.add('nature', 'log_stack', 2.35, 2.35, 0, 45, 0.65, { tint: '#e4be58' });
  } },
  siege: { size: 3, styles: AGES, scale: 0.98, sq: 0.94, build(k) {
    walls(k, 0, 0, 3, 2, 0, { s0: 'poles', s1: 'poles', s2: 'poles', e0: 'poles', e1: 'poles' }, 'wall-wood');
    roof(k, 0, 0, 3, 2, 1);
    k.add('castle', 'siege-ram', 1.6, 1.0, 0, 0, 0.7);
    k.add('castle', 'siege-catapult', 1.1, 2.5, 0, -30, 0.55);
    if (k.style >= 2) k.add('castle', 'siege-ballista', 2.4, 2.35, 0, 20, 0.52);
  } },
  // ---- 3D siege engine unit sprites from Kenney CC0 Castle Kit ----
  unit_ram: { size: 1, res: true, build(k) { k.add('castle', 'siege-ram', 0.5, 0.5, 0, 45, 0.62); } },
  unit_cappedram: { size: 1, res: true, build(k) {
    k.add('castle', 'siege-ram', 0.5, 0.5, 0, 45, 0.66, { tint: '#b8c4d0' });
    k.add('castle', 'flag-pennant', 0.35, 0.65, 0.55, 45, 0.45);
  } },
  unit_mangonel: { size: 1, res: true, build(k) { k.add('castle', 'siege-catapult', 0.5, 0.5, 0, 45, 0.58); } },
  unit_onager: { size: 1, res: true, build(k) {
    k.add('castle', 'siege-catapult', 0.5, 0.5, 0, 45, 0.64, { tint: '#c8b294' });
    k.add('castle', 'flag-pennant', 0.32, 0.68, 0.45, 45, 0.45);
  } },
  unit_scorpion: { size: 1, res: true, build(k) { k.add('castle', 'siege-ballista', 0.5, 0.5, 0, 45, 0.62); } },
  unit_trebuchet: { size: 1, res: true, build(k) { k.add('castle', 'siege-trebuchet', 0.5, 0.5, 0, 45, 0.58); } },
  tower: { size: 1, styles: [0, 2], scale: 0.84, sq: 0.96, build(k) {
    if (k.style < 2) { // wooden watch tower
      pillars(k, [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]], 0, 1.6);
      k.add('town', 'planks', 0.5, 0.5, 1.6); k.add('castle', 'tower-hexagon-top-wood', 0.5, 0.5, 1.62, 0, 1.1); k.add('town', 'roof-point', 0.5, 0.5, 2.05, 0, 1.05);
    } else {
      k.add('castle', 'tower-square-base', 0.5, 0.5, 0); k.add('castle', 'tower-square-mid-windows', 0.5, 0.5, 1.01); k.add('castle', 'tower-square-top-roof-high', 0.5, 0.5, 2.02);
    }
  } },
  castle: { size: 4, scale: 1.12, sq: 1.06, build(k) {
    for (let i = 1; i < 3; i++) { k.add('castle', 'wall', i + 0.5, 0.5, 0, 90); k.add('castle', 'wall', i + 0.5, 3.5, 0, 90); k.add('castle', 'wall', 0.5, i + 0.5, 0); k.add('castle', 'wall', 3.5, i + 0.5, 0); }
    for (const [x, y] of [[0.5, 0.5], [3.5, 0.5], [0.5, 3.5], [3.5, 3.5]]) { k.add('castle', 'tower-square-base', x, y, 0, 0, [1.15, 1.35, 1.15]); k.add('castle', 'tower-square-top-roof', x, y, 1.36, 0, 1.15); }
    k.add('castle', 'tower-square-base', 2, 2, 0, 0, [1.85, 1.5, 1.85]); k.add('castle', 'tower-square-mid-windows', 2, 2, 1.51, 0, 1.85); k.add('castle', 'tower-square-top-roof-high', 2, 2, 2.52, 0, 1.85);
    k.add('castle', 'gate', 2, 3.95, 0, 90, 1.35);
  } },
  outpost: { size: 1, scale: 0.72, sq: 0.84, build(k) {
    pillars(k, [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]], 0, 1.3);
    k.add('town', 'planks', 0.5, 0.5, 1.3, 0, 0.8); k.add('castle', 'tower-hexagon-top-wood', 0.5, 0.5, 1.32, 0, 0.9);
  } },
  well: { size: 1, styles: [0, 2], scale: 0.70, sq: 0.78, build(k) {
    k.add('town', 'fountain-round', 0.5, 0.5, 0, 0, 0.42);
    pillars(k, [[0.2, 0.5], [0.8, 0.5]], 0, 0.95, k.style >= 2 ? 'pillar-stone' : 'pillar-wood');
    k.add('town', 'roof-gable', 0.5, 0.5, 0.92, 90, [0.75, 0.6, 0.6]);
  } },
  wonder: { size: 5, scale: 1.15, sq: 1.08, build(k) {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i === 0 || j === 0 || i === 4 || j === 4) k.add('castle', 'tower-square-base-border', i + 0.5, j + 0.5, 0);
    k.add('castle', 'tower-square-base', 2.5, 2.5, 0.45, 0, [2.6, 1.3, 2.6]);
    k.add('castle', 'tower-square-mid-windows', 2.5, 2.5, 1.76, 0, [2.2, 1.2, 2.2]);
    k.add('castle', 'tower-square-mid-windows', 2.5, 2.5, 2.97, 0, [1.7, 1.1, 1.7]);
    k.add('castle', 'tower-square-top-roof-high', 2.5, 2.5, 4.08, 0, [1.7, 1.5, 1.7]);
    for (const [x, y] of [[0.5, 0.5], [4.5, 0.5], [0.5, 4.5], [4.5, 4.5]]) { k.add('castle', 'tower-hexagon-base', x, y, 0); k.add('castle', 'tower-hexagon-roof', x, y, 1.31); }
  } },
  // Wheat fields use the same Nature Kit as the surrounding scenery. Separate harvest stages
  // keep food depletion visible without generating a new sprite for every farm.
  farm: { size: 3, res: true, styles: [0, 1, 2], build(k) {
    for (let row = 0; row < 6; row++) {
      const y = 0.25 + row * 0.5;
      for (let col = 0; col < 3; col++) k.add('nature', 'crops_dirtRow', col + 0.5, y, 0, 0, [1, 0.7, 0.7], { color: '#705132' });
      for (let col = 0; col < 6; col++) {
        const x = 0.25 + col * 0.5;
        if (k.style === 0 && (row + col) % 3) continue;
        k.add('nature', k.style === 2 ? 'crops_wheatStageB' : 'crops_wheatStageA', x, y, 0.035, 0, k.style === 0 ? [0.55, 0.3, 0.55] : 0.72, { tint: k.style === 2 ? '#e6b63c' : '#8ca650' });
      }
    }
  } },
  // ---- resources (trees, mines, understory and felled timber) ----
  tree_anatolian_0: { size: 1, res: true, build(k) { k.add('nature', 'tree_cone', .5, .5, 0, 0, [.8, 1.7, .8], { leaf: '#3e6742' }); } },
  tree_anatolian_1: { size: 1, res: true, build(k) { k.add('nature', 'tree_thin', .5, .5, 0, 70, 1.2, { leaf: '#6d8053' }); } },
  tree_anatolian_2: { size: 1, res: true, build(k) { k.add('nature', 'tree_pineTallA', .5, .5, 0, 20, 1.15, { leaf: '#506b49' }); } },
  berry_0: { size: 1, res: true, build(k) {
    k.add('nature', 'plant_bushDetailed', 0.45, 0.5, 0, 0, 1.6, { color: '#456e32' });
    k.add('nature', 'plant_bushSmall', 0.8, 0.65, 0, 30, 1.4, { color: '#587e39' });
  } },
  berry_1: { size: 1, res: true, build(k) {
    k.add('nature', 'plant_bushDetailed', 0.55, 0.5, 0, 70, 1.6, { color: '#4c7535' });
    k.add('nature', 'plant_bushSmall', 0.25, 0.6, 0, 0, 1.4, { color: '#5a813e' });
  } },
  shrub_0: { size: 1, res: true, build(k) { k.add('nature', 'plant_bushSmall', 0.5, 0.5, 0, 25, 1.2, { color: '#557a39' }); } },
  shrub_1: { size: 1, res: true, build(k) { k.add('nature', 'grass_leafs', 0.5, 0.5, 0, 65, 0.8, { color: '#768d42' }); } },
  felled_0: { size: 1, res: true, build(k) {
    k.add('nature', 'stump_roundDetailed', 0.3, 0.4, 0, 0, 1.2);
    k.add('nature', 'log', 0.65, 0.65, 0, 55, 1.5);
  } },
  felled_1: { size: 1, res: true, build(k) {
    k.add('nature', 'stump_squareDetailed', 0.3, 0.4, 0, 20, 1.2);
    k.add('nature', 'log_large', 0.7, 0.65, 0, 65, 1.1);
  } },
  tree_0: { size: 1, res: true, build(k) { k.add('nature', 'tree_oak', 0.5, 0.5, 0, 0, 1.46, { leaf: '#4f8f2f' }); } },
  tree_1: { size: 1, res: true, build(k) { k.add('nature', 'tree_default', 0.5, 0.5, 0, 40, 1.46, { leaf: '#5a9a34' }); } },
  tree_2: { size: 1, res: true, build(k) { k.add('nature', 'tree_fat', 0.5, 0.5, 0, 80, 1.33, { leaf: '#3f7f2c' }); } },
  tree_3: { size: 1, res: true, build(k) { k.add('nature', 'tree_pineDefaultA', 0.5, 0.5, 0, 0, 1.53, { leaf: '#2f6b3a' }); } },
  tree_4: { size: 1, res: true, build(k) { k.add('nature', 'tree_pineRoundB', 0.5, 0.5, 0, 0, 1.53, { leaf: '#2a6236' }); } },
  tree_5: { size: 1, res: true, build(k) { k.add('nature', 'tree_detailed', 0.5, 0.5, 0, 120, 1.39, { leaf: '#4a8a30' }); } },
  tree_6: { size: 1, res: true, build(k) { k.add('nature', 'tree_palmTall', 0.5, 0.5, 0, 30, 1.33, { leaf: '#4f9a3a' }); } },
  stone_0: { size: 1, res: true, build(k) { k.add('nature', 'stone_largeA', 0.5, 0.5, 0, 0, 1.05, { tint: '#a8a196' }); k.add('nature', 'stone_smallB', 0.95, 0.9, 0, 30, 0.98, { tint: '#a8a196' }); } },
  stone_1: { size: 1, res: true, build(k) { k.add('nature', 'stone_largeC', 0.5, 0.5, 0, 60, 1.05, { tint: '#a8a196' }); k.add('nature', 'stone_smallE', 0.15, 0.85, 0, 0, 0.9, { tint: '#a8a196' }); } },
  gold_0: { size: 1, res: true, build(k) { k.add('nature', 'stone_largeB', 0.5, 0.5, 0, 0, 0.98, { tint: '#ffd24a' }); k.add('nature', 'stone_smallC', 0.95, 0.85, 0, 0, 0.9, { tint: '#ffc830' }); } },
  gold_1: { size: 1, res: true, build(k) { k.add('nature', 'stone_largeD', 0.5, 0.5, 0, 90, 0.98, { tint: '#ffd24a' }); } },
};

// Turks and Saracens buildings from the original Islamic kit (assets/original/islamic/)
Object.assign(RECIPES, TURKS_RECIPES, SARACENS_RECIPES);

