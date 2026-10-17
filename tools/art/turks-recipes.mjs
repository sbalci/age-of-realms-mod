// Turks building recipes: one builder per architectural era and building type, assembled from the Islamic kit
// (see islamic-kit.mjs) plus a few Kenney props. kenney-recipes.js merges TURKS_RECIPES into RECIPES.
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico, lowWall, courtyard } from './islamic-kit.mjs';

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

// ---- recipes (keep last) ----
const BUILDERS = { seljuk: SELJUK, ottoman: OTTOMAN, tanzimat: TANZIMAT, republican: REPUBLICAN };
export const TURKS_RECIPES = {};
for (const [type, [size, scale, sq]] of Object.entries(FORM)) {
  const styles = AGES[type].filter(a => BUILDERS[ERA[a]][type]);
  if (styles.length) TURKS_RECIPES[type + '_turks'] = { civ: 'turks', size, styles, scale, sq, build(k) { BUILDERS[ERA[k.style]][type](k); } };
}
