// Turks building recipes: one builder per architectural era and building type, assembled from the Islamic kit
// (see islamic-kit.mjs) plus a few Kenney props. kenney-recipes.js merges TURKS_RECIPES into RECIPES.
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico, lowWall, courtyard, porch, sawtooth } from './islamic-kit.mjs';

// The architectural era of each Turkish age.
export const ERA = ['seljuk', 'seljuk', 'ottoman', 'ottoman', 'tanzimat', 'republican'];
// Ages each building is baked for: only ages it can exist in (BUILDINGS[type].age), with fixed sets for tower,
// well, castle and outpost (see docs/superpowers/specs/2026-10-17-turks-building-set-design.md).
// A recipe bakes those of its ages whose era has a builder below.
const AGES = {
  house: [0, 1, 2, 3, 4, 5], tc: [0, 1, 2, 3, 4, 5], monastery: [2, 3, 4, 5],
  mill: [0, 1, 2, 3, 4, 5], lumbercamp: [0, 1, 2, 3, 4, 5], miningcamp: [0, 1, 2, 3, 4, 5], dock: [0, 1, 2, 3, 4, 5],
  barracks: [0, 1, 2, 3, 4, 5], market: [1, 2, 3, 4, 5], blacksmith: [1, 2, 3, 4, 5], range: [1, 2, 3, 4, 5],
  stable: [1, 2, 3, 4, 5], university: [2, 3, 4, 5], siege: [2, 3, 4, 5], tower: [1, 2, 3, 4, 5],
  well: [0, 2, 4, 5], castle: [2, 4, 5], outpost: [0, 4, 5],
};
// Footprint and stature as in the shared Kenney recipes: [size, scale, sq]
const FORM = {
  house: [2, 0.72, 0.80], tc: [4, 1.06, 1.02], monastery: [3, 1.02, 1.02],
  mill: [2, 0.82, 0.94], lumbercamp: [2, 0.70, 0.76], miningcamp: [2, 0.70, 0.76], dock: [3, 0.92, 0.86],
  barracks: [3, 0.98, 0.94], market: [3, 0.88, 0.84], blacksmith: [3, 0.84, 0.84], range: [3, 0.88, 0.84],
  stable: [3, 0.90, 0.84], university: [3, 1.02, 0.98], siege: [3, 0.98, 0.94], tower: [1, 0.84, 0.96],
  well: [1, 0.70, 0.78], castle: [4, 1.12, 1.06], outpost: [1, 0.72, 0.84],
};

const SELJUK = {}, OTTOMAN = {}, TANZIMAT = {}, REPUBLICAN = {};

// ---- house: Seljuk stone dwelling (ages 0-1), Ottoman konak (ages 2-3) ----
SELJUK.house = k => {
  ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  // flat roof; a roof room from age 1
  roof(k, 0.1, 0.1, 2, 2, 1);
  if (k.style === 1) { ring(k, 0.1, 0.1, 1, 1, 1.06, { s0: 'wall-window', e0: 'wall-window' }); roof(k, 0.1, 0.1, 1, 1, 2.06); }
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};
OTTOMAN.house = k => {
  ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  // timber-framed upper floor, projecting cumba bay, wide hipped roof
  ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-timber');
  k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
  if (k.style === 3) k.add(I, 'bay-cumba', 1.6, 1.1, 1, ROT.e);
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 1, 2]);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};

// ---- tc: Seljuk caravanserai (ages 0-1), Ottoman Divan (ages 2-3) ----
SELJUK.tc = k => {
  // walled stone court behind a tall tiled portal, with a kümbet tower
  ring(k, 0.5, 0.5, 3, 3, 0, { e0: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
  roof(k, 0.5, 0.5, 3, 3, 1, 'merlon-pointed');
  k.add(I, 'portal', 2, 3, 0, ROT.s);
  crown(k, 'kumbet', 1, 1, 1.06, 0.9);
  if (k.style === 1) crown(k, 'dome-lead', 2.4, 1.6, 1.06, 1.1);
  k.add('nature', 'tent_detailedOpen', 3.7, 3.7, 0, -30, 0.5, HIDE);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};
OTTOMAN.tc = k => {
  // two-storey hall behind a domed portico, stepped domes up to a central dome with an alem
  ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
  ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
  roof(k, 0.5, 0.5, 3, 2, 2);
  crown(k, 'dome-lead', 2, 1.5, 2.06, k.style === 3 ? 2.3 : 2.1, true);
  for (const x of [0.95, 3.05]) crown(k, 'dome-lead', x, 1.5, 2.06, 0.8);
  portico(k, 0.5, 2.5, 3, 'dome-lead');
  k.add('town', 'fountain-round', 0.3, 3.75, 0, 0, 0.3);
  if (k.style === 3) k.add('nature', 'tree_cone', 3.75, 3.75, 0, 0, 0.9, CYPRESS);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};

// ---- monastery: Seljuk Gök Medrese (age 2), Ottoman mosque (age 3) ----
OTTOMAN.monastery = k => {
  if (k.style === 2) {
    // stone court, tiled portal flanked by twin minarets, domed hall
    ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
    roof(k, 0, 0, 3, 3, 1, 'merlon-pointed');
    k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
    for (const x of [1.1, 1.9]) crown(k, 'minaret-pencil', x, 2.97, TOP.portal, 0.55);
    crown(k, 'dome-lead', 1.5, 1.1, 1.06, 1.3, true);
  } else {
    // prayer hall under a great dome with corner domes, domed portico, pencil minaret
    ring(k, 0.5, 0, 2, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
    ring(k, 0.5, 0, 2, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
    roof(k, 0.5, 0, 2, 2, 2);
    crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
    for (const [x, y] of [[0.95, 0.45], [2.05, 0.45], [0.95, 1.55], [2.05, 1.55]]) crown(k, 'dome-lead', x, y, 2.06, 0.6);
    portico(k, 0.5, 2, 2, 'dome-lead');
    crown(k, 'minaret-pencil', 2.75, 0.25, 0, 1.15);
  }
};

// ---- castle: Rumeli Hisarı-style fortress (age 2) ----
OTTOMAN.castle = k => {
  // two-storey curtain walls with pointed merlons, a gate portal, round cannon towers with lead cones and alems
  ring(k, 0, 0, 4, 4, 0);
  ring(k, 0, 0, 4, 4, 1);
  ring(k, 0, 0, 4, 4, 2, {}, 'merlon-pointed');
  k.add(I, 'portal', 1.5, 3.5, 0, ROT.s);
  for (const [x, y, s] of [[0.5, 0.5, 1.25], [3.5, 0.5, 1.25], [0.5, 3.5, 1.1], [3.5, 3.5, 1.4]]) crown(k, 'tower-round', x, y, 0, s, true);
};

// ---- market: covered bazaar (age 1), bedesten under rows of small lead domes (ages 2-3) ----
SELJUK.market = k => {
  // open arcaded hall behind a row of stalls
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-arcade');
  roof(k, 0, 0, 3, 2, 1, 'merlon-pointed');
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};
OTTOMAN.market = k => {
  ring(k, 0, 0, 3, 2, 0, { s0: 'wall-door', s1: 'wall-window', s2: 'wall-door', e0: 'wall-window', e1: 'wall-door' });
  roof(k, 0, 0, 3, 2, 1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) crown(k, 'dome-lead', i + 0.5, j + 0.5, 1.06, 0.6, k.style === 3 && i === 1 && j === 0);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};

// ---- dock: timber jetty (ages 0-1), arched stone tersane with a domed beacon (ages 2-3) ----
SELJUK.dock = k => {
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 1.5, 0);
  k.add(I, 'jetty', 2.5, 2.5, 0);
  ring(k, 0, 0, 1, 1, 0, { s0: 'wall-door' });
  roof(k, 0, 0, 1, 1, 1);
  if (k.style === 1) k.add(I, 'crane', 2.5, 0.6, 0, 0, 0.8);
};
OTTOMAN.dock = k => {
  // vaulted shipyard galleries open to the water, harbour beacon tower, crane and jetty
  ring(k, 0, 0, 2, 1, 0, { s0: 'wall-arcade', s1: 'wall-arcade', e0: 'wall-arcade' });
  roof(k, 0, 0, 2, 1, 1);
  for (const x of [0.5, 1.5]) crown(k, 'dome-lead', x, 0.5, 1.06, 0.6);
  crown(k, 'tower-round', 2.5, 0.5, 0, 0.6, true);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 2.2, 0);
  k.add(I, 'crane', 1.5, 1.4, 0, 0, 0.8);
  if (k.style === 3) k.add(I, 'cannon', 2.6, 1.5, 0, 0, 0.8);
};

// ---- university: madrasa and observatory (ages 2-3) ----
OTTOMAN.university = k => {
  // courtyard madrasa behind a grand iwan portal, domed lecture hall at the back, sextant in the court
  ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
  courtyard(k, 0, 0, 3, 3, 1, 'merlon-pointed');
  k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
  crown(k, 'dome-lead', 1.5, 0.5, 1.06, 1.0, true);
  k.add(I, 'sextant', 1.5, 1.5, 0, 0, 0.8);
  if (k.style === 3) crown(k, 'minaret-pencil', 2.75, 0.25, 0, 0.9);
};

// ---- mill: wind-tower mill (ages 0-1), with a domed granary (ages 2-3) ----
SELJUK.mill = k => {
  crown(k, 'asbad', 0.6, 0.6, 0, 1.05);
  ring(k, 1, 1, 1, 1, 0, { s0: 'wall-door' });
  roof(k, 1, 1, 1, 1, 1, 'merlon-pointed');
  if (k.style === 1) k.add('town', 'cart', 0.5, 1.75, 0, 90, 0.55);
};
OTTOMAN.mill = k => {
  crown(k, 'asbad', 0.6, 0.6, 0, 1.25);
  ring(k, 1, 1, 1, 1, 0, { s0: 'wall-door', e0: 'wall-window' });
  roof(k, 1, 1, 1, 1, 1);
  crown(k, 'dome-lead', 1.5, 1.5, 1.06, 0.75, k.style === 3);
  k.add('town', 'cart', 0.5, 1.75, 0, 90, 0.55);
};

// ---- lumbercamp: canvas-and-stone timber yard (ages 0-1), stone yard with a timber crane (ages 2-3) ----
SELJUK.lumbercamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.35);
  k.add('nature', 'tent_detailedOpen', 0.65, 0.65, 0, 0, [0.9, 1.4, 0.9], HIDE);
  k.add('nature', 'log_large', 1.35, 1.2, 0, 60, 0.9);
  k.add('nature', 'log', 1.1, 1.6, 0, 20, 1.1);
  if (k.style === 1) k.add('nature', 'stump_roundDetailed', 0.5, 1.5, 0, 0, 1.0);
};
OTTOMAN.lumbercamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.45);
  ring(k, 0.1, 0.1, 1, 1, 0, { s0: 'wall-arcade', e0: 'wall-arcade' });
  roof(k, 0.1, 0.1, 1, 1, 1);
  k.add(I, 'crane', 1.45, 0.55, 0, 0, 0.75);
  k.add('nature', 'log_large', 1.3, 1.35, 0, 60, 0.9);
  k.add('nature', 'log', 0.6, 1.55, 0, 10, 1.1);
};

// ---- miningcamp: quarry pithead with a hoist (ages 0-1), stone assay house with a domed smelter (ages 2-3) ----
SELJUK.miningcamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.3);
  k.add('nature', 'tent_detailedOpen', 0.6, 1.4, 0, -90, [0.85, 1.35, 0.85], HIDE);
  k.add(I, 'crane', 0.7, 0.55, 0, 0, 0.7);
  k.add('nature', 'stone_largeA', 1.4, 1.2, 0, 0, 0.8, { tint: '#a8a196' });
  k.add('nature', 'stone_smallB', 1.6, 0.6, 0, 30, 0.9, { tint: '#a8a196' });
  if (k.style === 1) k.add('town', 'cart', 1.45, 1.7, 0, 0, 0.55);
};
OTTOMAN.miningcamp = k => {
  ring(k, 0.1, 0.1, 1, 1, 0, { s0: 'wall-door', e0: 'wall-window' });
  roof(k, 0.1, 0.1, 1, 1, 1);
  crown(k, 'dome-lead', 0.6, 0.6, 1.06, 0.55);
  k.add(I, 'chimney', 0.9, 0.3, 1.06);
  k.add(I, 'crane', 1.5, 0.6, 0, 0, 0.75);
  k.add('nature', 'stone_largeA', 1.4, 1.4, 0, 0, 0.8, { tint: '#a8a196' });
  k.add('town', 'cart', 0.6, 1.65, 0, 90, 0.55);
};

// ---- barracks: walled drill yard (ages 0-1), Janissary barracks court (ages 2-3) ----
SELJUK.barracks = k => {
  lowWall(k, 0, 0, 3, 3, 0.45);
  ring(k, 0.2, 0.2, 2, 1, 0, { s0: 'wall-door', s1: 'wall-window', e0: 'wall-window' });
  roof(k, 0.2, 0.2, 2, 1, 1, 'merlon-pointed');
  k.add(I, 'rack-shields', 2.3, 1.2, 0, ROT.e);
  k.add(I, 'tug', 2.5, 2.4, 0);
  if (k.style === 1) k.add('nature', 'tent_detailedOpen', 0.9, 2.1, 0, 20, 0.5, HIDE);
};
OTTOMAN.barracks = k => {
  // two-storey barracks range behind a domed arcade, standards and a weapon rack in the yard
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window' });
  ring(k, 0, 0, 3, 1, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window' });
  roof(k, 0, 0, 3, 1, 2, 'merlon-pointed');
  portico(k, 0, 1, 3, 'dome-lead');
  for (const x of [0.4, 2.6]) k.add(I, 'tug', x, 2.6, 0);
  k.add(I, 'rack-shields', 1.6, 2.3, 0, ROT.s);
  if (k.style === 3) crown(k, 'dome-lead', 1.5, 0.5, 2.06, 0.8, true);
};

// ---- blacksmith: smithy (age 1), stone forge hall with racks of scimitars and shields (ages 2-3) ----
SELJUK.blacksmith = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  roof(k, 0, 0, 2, 2, 1, 'merlon-pointed');
  k.add(I, 'chimney', 0.5, 0.5, 1.06);
  k.add(I, 'forge', 2.4, 1.0, 0);
  k.add(I, 'rack-shields', 1.6, 2.35, 0, ROT.s);
};
OTTOMAN.blacksmith = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
  roof(k, 0, 0, 2, 2, 1);
  crown(k, 'dome-lead', 1.0, 1.0, 1.06, 1.1, k.style === 3);
  k.add(I, 'chimney', 0.35, 0.35, 1.06, 0, 1.3);
  k.add(I, 'forge', 2.45, 1.0, 0);
  k.add(I, 'rack-shields', 1.0, 2.35, 0, ROT.s);
  k.add(I, 'rack-shields', 2.35, 2.2, 0, ROT.e);
};

// ---- range: archery lodge (age 1), Meydan-ı Ok lodge with bow racks and targets (ages 2-3) ----
SELJUK.range = k => {
  ring(k, 0, 0, 1, 2, 0, { e0: 'wall-window', e1: 'wall-door' });
  roof(k, 0, 0, 1, 2, 1, 'merlon-pointed');
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.6, y, 0);
  lowWall(k, 0, 2, 1, 1, 0.35);
};
OTTOMAN.range = k => {
  ring(k, 0, 0, 2, 1, 0, { s0: 'wall-window', s1: 'wall-door', e0: 'wall-window' });
  roof(k, 0, 0, 2, 1, 1);
  crown(k, 'dome-lead', 1.0, 0.5, 1.06, 0.7, k.style === 3);
  portico(k, 0, 1, 2, null, 'merlon-pointed');
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
  k.add(I, 'rack-shields', 1.2, 2.4, 0, ROT.s);
  k.add(I, 'tug', 0.4, 2.6, 0);
};

// ---- stable: timber stable (age 1), Has Ahır imperial stables with a lead cupola and tuğ (ages 2-3) ----
SELJUK.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s1: 'wall-arcade', s2: 'wall-arcade' });
  k.add(I, 'roof-hip', 1.5, 0.5, 1, 0, [3, 0.8, 1]);
  lowWall(k, 0, 1.15, 3, 2, 0.3);
};
OTTOMAN.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s1: 'wall-door', s2: 'wall-arcade', e0: 'wall-window' });
  roof(k, 0, 0, 3, 1, 1);
  crown(k, 'kiosk', 1.5, 0.5, 1.06, 0.7);
  lowWall(k, 0, 1.15, 3, 2, 0.35);
  k.add(I, 'tug', 2.6, 2.6, 0);
  if (k.style === 3) k.add(I, 'tug', 0.4, 2.6, 0);
};

// ---- siege: cannon foundry with gun barrels in the yard (ages 2-3) ----
OTTOMAN.siege = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-arcade', e0: 'wall-window', e1: 'wall-arcade' });
  roof(k, 0, 0, 2, 2, 1);
  for (const [x, y] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) crown(k, 'dome-lead', x, y, 1.06, 0.6);
  k.add(I, 'chimney', 1.9, 0.2, 1.06, 0, 1.4);
  for (const y of [0.7, 1.7]) k.add(I, 'cannon', 2.5, y, 0, 0, 1.1);
  if (k.style === 3) k.add(I, 'cannon', 1.4, 2.55, 0, ROT.s, 1.1);
};

// ---- tower: watch tower (age 1), domed guard turret (age 2), keep with a cannon on the roof (age 3) ----
SELJUK.tower = k => { crown(k, 'kumbet', 0.5, 0.5, 0, 0.75); };
OTTOMAN.tower = k => {
  if (k.style === 2) { crown(k, 'tower-round', 0.5, 0.5, 0, 0.9, true); return; }
  ring(k, 0, 0, 1, 1, 0, { s0: 'wall-door' });
  ring(k, 0, 0, 1, 1, 1, { s0: 'wall-window', e0: 'wall-window' });
  ring(k, 0, 0, 1, 1, 2, { s0: 'wall-window', e0: 'wall-window' });
  roof(k, 0, 0, 1, 1, 3, 'merlon-pointed');
  k.add(I, 'cannon', 0.5, 0.5, 3.06, 45, 0.6);
};

// ---- well: stone well with a winch (age 0), şadırvan fountain kiosk (age 2) ----
SELJUK.well = k => {
  lowWall(k, 0, 0, 1, 1, 0.35);
  k.add(I, 'crane', 0.35, 0.5, 0, 0, 0.55);
};
OTTOMAN.well = k => { crown(k, 'kiosk', 0.5, 0.5, 0, 1.15, true); };

// ---- outpost: timber lookout (age 0) ----
SELJUK.outpost = k => { k.add(I, 'lookout', 0.5, 0.5, 0); };

// ---- tc: Dolmabahçe-style palace (age 4), First National style hall (age 5) ----
TANZIMAT.tc = k => {
  // two-storey pilastered block under a low hipped roof, pedimented porch, clock tower
  ring(k, 0.5, 0.5, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.5, 0.5, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 2, 1.5, 2, 0, [3, 0.7, 2]);
  porch(k, 1.5, 2.5, 1, true);
  crown(k, 'clock-tower', 3.55, 3.35, 0, 0.85);
  k.add('town', 'fountain-round', 0.6, 3.5, 0, 0, 0.3);
  k.add('nature', 'tree_cone', 0.3, 0.35, 0, 0, 0.9, CYPRESS);
};
REPUBLICAN.tc = k => {
  // dressed stone with tile-panelled pointed windows under broad eaves, columned entrance, flag
  ring(k, 0.5, 0.5, 3, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0.5, 0.5, 3, 2, 1, {}, 'wall-tile-arch');
  k.add(I, 'eave-broad', 2, 1.5, 2, 0, [3, 1, 2]);
  porch(k, 1.5, 2.5, 1);
  k.add(I, 'flagpole', 2.0, 3.65, 0, 0, 1.3);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};

// ---- house: Tanzimat Istanbul mansion (age 4), Ankara cubic house (age 5) ----
TANZIMAT.house = k => {
  // pilastered storeys, projecting bay, hipped roof
  ring(k, 0.1, 0.1, 2, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 0.8, 2]);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};
REPUBLICAN.house = k => {
  // flat roofs and ribbon windows, an upper storey over half the plan
  ring(k, 0.1, 0.1, 2, 2, 0, {}, 'wall-modern');
  roof(k, 0.1, 0.1, 2, 2, 1);
  ring(k, 0.1, 0.1, 1, 2, 1.06, {}, 'wall-modern');
  roof(k, 0.1, 0.1, 1, 2, 2.06);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};

// ---- monastery: baroque mosque (age 4), Republican-era mosque (age 5) ----
TANZIMAT.monastery = k => {
  // tall pilastered prayer hall under one dome, balustraded roof, columned porch, two slender minarets
  ring(k, 0.5, 0, 2, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.5, 0, 2, 2, 1, {}, 'wall-pilaster');
  roof(k, 0.5, 0, 2, 2, 2, 'balustrade');
  crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
  porch(k, 0.5, 2, 2);
  for (const x of [0.25, 2.75]) crown(k, 'minaret-pencil', x, 2.3, 0, 1.05);
};
REPUBLICAN.monastery = k => {
  // classical revival in plain dressed stone: one dome, domed portico, two minarets
  ring(k, 0.5, 0, 2, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0.5, 0, 2, 2, 1, {}, 'wall-tile-arch');
  roof(k, 0.5, 0, 2, 2, 2);
  crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
  portico(k, 0.5, 2, 2, 'dome-lead');
  for (const x of [0.25, 2.75]) crown(k, 'minaret-pencil', x, 0.25, 0, 1.1);
};

// ---- barracks: Selimiye-style courtyard block (age 4), 1930s military academy (age 5) ----
TANZIMAT.barracks = k => {
  // pilastered courtyard block with a balustrade and round corner towers
  ring(k, 0, 0, 3, 3, 0, {}, 'wall-pilaster');
  courtyard(k, 0, 0, 3, 3, 1, 'balustrade');
  for (const [x, y] of [[0.3, 0.3], [2.7, 0.3], [0.3, 2.7], [2.7, 2.7]]) crown(k, 'tower-round', x, y, 0, 0.6);
};
REPUBLICAN.barracks = k => {
  // long flat-roofed block, columned entrance, flag
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-modern');
  roof(k, 0, 0, 3, 2, 2);
  porch(k, 1, 2, 1);
  k.add(I, 'flagpole', 2.6, 2.6, 0);
};

// ---- mill: brick steam mill (age 4), concrete grain silos (age 5) ----
TANZIMAT.mill = k => {
  ring(k, 0.1, 0.6, 2, 1, 0, {}, 'wall-brick');
  ring(k, 0.1, 0.6, 2, 1, 1, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 0.6, 1]);
  k.add(I, 'stack', 0.4, 0.3, 0, 0, [1, 1.5, 1]);   // tall enough to clear the roof from the camera side
  k.add('town', 'cart', 0.6, 1.85, 0, 90, 0.55);
};
REPUBLICAN.mill = k => {
  // two silos beside a three-storey elevator tower, warehouse in front
  for (const y of [0.3, 0.75]) crown(k, 'silo', 0.3, y, 0, 0.8);   // west of the tower, so it hides neither silo
  for (const z of [0, 1, 2]) ring(k, 1.1, 0, 1, 1, z, {}, 'wall-modern');
  roof(k, 1.1, 0, 1, 1, 3);
  ring(k, 0.1, 1.0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0.1, 1.0, 2, 1, 1);
};

// ---- lumbercamp: steam sawmill (age 4), sawtooth-roofed sawmill (age 5) ----
TANZIMAT.lumbercamp = k => {
  ring(k, 0.1, 0.1, 2, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.1, 0.6, 1, 0, [2, 0.6, 1]);
  k.add(I, 'stack', 1.85, 0.3, 0, 0, 0.7);
  k.add('nature', 'log_large', 1.3, 1.5, 0, 60, 0.9);
  k.add('nature', 'log', 0.6, 1.6, 0, 10, 1.1);
};
REPUBLICAN.lumbercamp = k => {
  ring(k, 0.1, 0.1, 2, 1, 0, {}, 'wall-modern');
  sawtooth(k, 0.1, 0.1, 2, 1, 1);
  k.add('nature', 'log_large', 1.3, 1.5, 0, 60, 0.9);
  k.add('town', 'cart', 0.6, 1.65, 0, 90, 0.55);
};

// ---- miningcamp: coal winding tower and engine house (age 4), steel headframe (age 5) ----
TANZIMAT.miningcamp = k => {
  k.add(I, 'lookout', 0.6, 0.6, 0, 0, 1.05);
  ring(k, 1.0, 1.0, 1, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.5, 1.5, 1, 0, [1, 0.6, 1]);
  k.add(I, 'stack', 1.85, 1.15, 0, 0, 0.6);
  k.add('nature', 'stone_largeA', 0.5, 1.5, 0, 0, 0.7, { tint: '#3a3a3a' });   // coal heap
};
REPUBLICAN.miningcamp = k => {
  k.add(I, 'headframe', 0.75, 0.6, 0, 0, 0.95);
  ring(k, 1.0, 1.0, 1, 1, 0, {}, 'wall-modern');
  roof(k, 1.0, 1.0, 1, 1, 1);
  k.add('nature', 'stone_largeA', 0.5, 1.5, 0, 0, 0.7, { tint: '#3a3a3a' });
};

// ---- dock: arsenal with a clock tower (age 4), concrete quay with a gantry crane (age 5) ----
TANZIMAT.dock = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1, 0.5, 1, 0, [2, 0.6, 1]);
  crown(k, 'clock-tower', 2.5, 0.5, 0, 0.6);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 2.2, 0);
  k.add(I, 'crane', 1.5, 1.4, 0, 0, 0.85);
};
REPUBLICAN.dock = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 2, 1, 1);
  for (const x of [0.5, 1.5, 2.5]) for (const y of [1.5, 2.5]) k.add(I, 'roof-flat', x, y, 0.05);   // concrete quay
  k.add(I, 'gantry', 1.6, 1.9, 0.11, 0, 0.9);
};

// ---- market: arcaded commercial hall (age 4), First National style market hall (age 5) ----
TANZIMAT.market = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 1, 2, 0, [3, 0.6, 2]);
  porch(k, 1, 2, 1, true);
  for (const x of [0.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};
REPUBLICAN.market = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-tile-arch');
  k.add(I, 'eave-broad', 1.5, 1, 2, 0, [3, 1, 2]);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};

// ---- blacksmith: brick ironworks (age 4), steelworks (age 5) ----
TANZIMAT.blacksmith = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.5, 1, 1, 0, [3, 0.6, 2]);
  k.add(I, 'stack', 2.6, 0.4, 0, 0, 0.9);
  k.add(I, 'forge', 1.5, 2.5, 0, ROT.s);
};
REPUBLICAN.blacksmith = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  sawtooth(k, 0, 0, 3, 2, 1);
  for (const x of [0.5, 1.3]) k.add(I, 'stack', x, 0.35, 0, 0, 1.15);
};

// ---- range: neoclassical shooting lodge (age 4), rifle range shelter (age 5) ----
TANZIMAT.range = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1, 0.5, 1, 0, [2, 0.6, 1]);
  porch(k, 0, 1, 2);
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
};
REPUBLICAN.range = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 2, 1, 1);
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
  k.add(I, 'flagpole', 0.3, 2.6, 0);
};

// ---- stable: neoclassical imperial stables (age 4), Republican stud farm (age 5) ----
TANZIMAT.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s2: 'wall-arcade' }, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 0.5, 1, 0, [3, 0.6, 1]);
  k.add(I, 'pediment', 1.5, 0.5, 1, ROT.s);
  lowWall(k, 0, 1.15, 3, 2, 0.3);
};
REPUBLICAN.stable = k => {
  ring(k, 0, 0, 3, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 3, 1, 1);
  lowWall(k, 0, 1.15, 3, 2, 0.3, 'wall-modern');
};

// ---- university: Darülfünun-style faculty (age 4), monumental 1930s faculty (age 5) ----
TANZIMAT.university = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 1, 2, 0, [3, 0.6, 2]);
  porch(k, 0.5, 2, 2, true);
};
REPUBLICAN.university = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-modern');
  roof(k, 0, 0, 3, 2, 2);
  porch(k, 0, 2, 3);
  k.add(I, 'flagpole', 1.5, 1.0, 2.06, 0, 0.8);
};

// ---- siege: Tophane-style domed cannon foundry (age 4), arms factory (age 5) ----
TANZIMAT.siege = k => {
  ring(k, 0, 0, 2, 2, 0, {}, 'wall-brick');
  roof(k, 0, 0, 2, 2, 1);
  for (const [x, y] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) crown(k, 'dome-lead', x, y, 1.06, 0.6);
  k.add(I, 'stack', 1.95, 0.15, 0, 0, 0.8);
  for (const y of [0.7, 1.7]) k.add(I, 'cannon', 2.5, y, 0, 0, 1.1);
};
REPUBLICAN.siege = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  sawtooth(k, 0, 0, 3, 2, 1);
  k.add(I, 'stack', 2.7, 0.3, 0, 0, 1.0);
  for (const x of [0.8, 2.2]) k.add(I, 'cannon', x, 2.5, 0, ROT.s, 1.1);
};

// ---- tower: coastal artillery tower (age 4), concrete gun battery tower (age 5) ----
TANZIMAT.tower = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-brick');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-brick');
  roof(k, 0, 0, 1, 1, 2, 'balustrade');
  k.add(I, 'cannon', 0.5, 0.5, 2.06, 45, 0.6);
};
REPUBLICAN.tower = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-modern');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-modern');
  roof(k, 0, 0, 1, 1, 2);
  k.add(I, 'gun-turret', 0.5, 0.5, 2.06, 45, 0.7);
};

// ---- well: baroque fountain (age 4), plain Republican fountain (age 5) ----
TANZIMAT.well = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'eave-broad', 0.5, 0.5, 1, 0, [1, 0.8, 1]);
  crown(k, 'dome-lead', 0.5, 0.5, 1.1, 0.45, true);
};
REPUBLICAN.well = k => {
  lowWall(k, 0, 0, 1, 1, 0.35, 'wall-modern');
  k.add('town', 'fountain-round', 0.5, 0.5, 0, 0, 0.5);
};

// ---- castle: Tanzimat gun bastion (age 4), concrete coastal fortress (age 5) ----
TANZIMAT.castle = k => {
  // low thick ramparts with a balustrade and guns, brick barracks inside, flag
  lowWall(k, 0, 0, 4, 4, 0.7);
  ring(k, 0, 0, 4, 4, 0.7, {}, 'balustrade');
  ring(k, 1, 1, 2, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 2, 1.5, 1, 0, [2, 0.6, 1]);
  for (const [x, y, rot] of [[3.6, 0.6, 0], [3.6, 3.4, 0], [0.6, 3.6, -90], [2.0, 3.65, -90]]) k.add(I, 'cannon', x, y, 0.7, rot, 1.0);
  k.add(I, 'flagpole', 0.6, 0.6, 0.7, 0, 1.3);
};
REPUBLICAN.castle = k => {
  // casemate walls with gun turrets on the corners, flag
  ring(k, 0, 0, 4, 4, 0, {}, 'wall-modern');
  ring(k, 0, 0, 4, 4, 1, {}, 'wall-modern');
  courtyard(k, 0, 0, 4, 4, 2);
  for (const [x, y] of [[0.5, 0.5], [3.5, 0.5], [0.5, 3.5], [3.5, 3.5]]) k.add(I, 'gun-turret', x, y, 2.06, 45, 0.9);
  k.add(I, 'flagpole', 2, 2, 0, 0, 1.6);
};

// ---- outpost: telegraph signal station (age 4), fire-watch tower (age 5) ----
TANZIMAT.outpost = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 0.5, 0.5, 1, 0, [1, 0.6, 1]);
  k.add(I, 'flagpole', 0.5, 0.5, 1.2, 0, 0.8);
};
REPUBLICAN.outpost = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-modern');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-modern');
  roof(k, 0, 0, 1, 1, 2);
  k.add(I, 'flagpole', 0.5, 0.5, 2.06, 0, 0.8);
};

// ---- recipes (keep last) ----
const BUILDERS = { seljuk: SELJUK, ottoman: OTTOMAN, tanzimat: TANZIMAT, republican: REPUBLICAN };
export const TURKS_RECIPES = {};
for (const [type, [size, scale, sq]] of Object.entries(FORM)) {
  const styles = AGES[type].filter(a => BUILDERS[ERA[a]][type]);
  if (styles.length) TURKS_RECIPES[type + '_turks'] = { civ: 'turks', size, styles, scale, sq, build(k) { BUILDERS[ERA[k.style]][type](k); } };
}
