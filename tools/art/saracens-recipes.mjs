// Saracens building recipes, assembled from the Islamic kit (see islamic-kit.mjs) plus a few Kenney props.
// kenney-recipes.js merges SARACENS_RECIPES into RECIPES.
import { I, ROT, HIDE, ring, roof, crown, portico } from './islamic-kit.mjs';

export const SARACENS_RECIPES = {
  house_saracens: { civ: 'saracens', size: 2, styles: [0, 1, 2, 3], scale: 0.72, sq: 0.80, build(k) {
    // sandstone courtyard house behind stepped merlons; windcatcher from age 1, upper floor with mashrabiya from age 2
    ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
    if (k.style <= 1) {
      roof(k, 0.1, 0.1, 2, 2, 1, 'merlon-stepped');
      if (k.style === 1) k.add(I, 'malqaf', 0.6, 0.6, 1.06);
    } else {
      ring(k, 0.1, 0.1, 2, 2, 1, { s0: 'wall-window', e1: 'wall-window' });
      k.add(I, 'mashrabiya', 1.6, 1.6, 1, ROT.s);
      if (k.style === 3) k.add(I, 'mashrabiya', 1.6, 0.6, 1, ROT.e);
      roof(k, 0.1, 0.1, 2, 2, 2, 'merlon-stepped');
      k.add(I, 'malqaf', 0.6, 0.6, 2.06);
    }
    k.add('nature', 'tree_palm', 2.3, 0.4, 0, 20, 0.55);
  } },
  tc_saracens: { civ: 'saracens', size: 4, styles: [0, 1, 2, 3], scale: 1.06, sq: 1.02, build(k) {
    const tall = k.style >= 2, top = tall ? 2 : 1;
    ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
    if (tall) ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
    roof(k, 0.5, 0.5, 3, 2, top, 'merlon-stepped');
    if (k.style === 0) {
      // mud-brick compound: walled hall, shade tent and palms
      k.add('nature', 'tent_detailedOpen', 1.6, 3.3, 0, 0, 0.7, HIDE);
    } else {
      // Dar al-Imara: horseshoe-arcaded portico before a hall under a pointed ribbed dome
      crown(k, 'dome-ribbed', 2, 1.5, top + 0.06, tall ? 1.7 : 1.3);
      portico(k, 0.5, 2.5, 3, null, 'merlon-stepped');
      if (k.style === 3) crown(k, 'minaret-square', 0.8, 0.8, top + 0.06, 0.6);
    }
    k.add('nature', 'tree_palm', 3.75, 0.4, 0, 0, 0.8);
    k.add('nature', 'tree_palmBend', 3.8, 2.2, 0, 20, 0.75);
  } },
  monastery_saracens: { civ: 'saracens', size: 3, styles: [2, 3], scale: 1.02, sq: 1.02, build(k) {
    // courtyard mosque: arcaded front, prayer hall under a pointed ribbed dome, square tiered minaret
    ring(k, 0, 0, 3, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-door', s2: 'wall-window' });
    ring(k, 0, 0, 3, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
    roof(k, 0, 0, 3, 2, 2, 'merlon-stepped');
    crown(k, 'dome-ribbed', 1.5, 0.95, 2.06, k.style === 3 ? 1.6 : 1.3);
    if (k.style === 3) for (const x of [0.55, 2.45]) crown(k, 'dome-ribbed', x, 0.95, 2.06, 0.6);
    portico(k, 0, 2, 2, null, 'merlon-stepped');
    crown(k, 'minaret-square', 2.5, 2.5, 0, 1.15);
  } },
};
