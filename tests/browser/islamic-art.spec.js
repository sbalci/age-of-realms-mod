const { test, expect } = require('@playwright/test');

const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && KART.booted && Object.keys(KART.img).length + KART.failed.length === KART.requested.size);

// A Turks row and a Saracens row of Town Center, Monastery and House on cleared grass, drawn by the live game.
// Saves test-results/islamic-age<N>.png for the in-game review: footprint fit, shadows, flag and shield, no doubled domes.
const EXPECTED = {
  1: ['tc_turks_1', 'house_turks_1', 'tc_saracens_1', 'house_saracens_1', 'monastery_1'],
  3: ['tc_turks_3', 'monastery_turks_3', 'house_turks_3', 'tc_saracens_3', 'monastery_saracens_3', 'house_saracens_3'],
  // the Turks have Republican sprites of their own; for the Saracens the shared Future Town Center (tc_5)
  // outranks their medieval one while their age-3 house and mosque still apply
  5: ['tc_turks_5', 'house_turks_5', 'monastery_turks_5', 'tc_5', 'house_saracens_3', 'monastery_saracens_3'],
};

for (const age of [1, 3, 5]) test(`Turks and Saracens towns use their own buildings in game (age ${age})`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  await page.evaluate(age => {
    const g = __game, w = g.W, m = w.map;
    g.UI.paused = true; w.noFog = true; w.players[1].age = age;
    const x0 = (w.n >> 1) - 7, y0 = (w.n >> 1) - 6;
    for (const e of w.list.slice()) if (e.x >= x0 - 1 && e.x < x0 + 15 && e.y >= y0 - 1 && e.y < y0 + 13) removeEnt(e);
    for (let y = y0 - 1; y < y0 + 13; y++) for (let x = x0 - 1; x < x0 + 15; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; m.blk[i] = 0; }
    m.computeVH(); m.computeRegions(); invalidateTerrain(); MM.baseVer = -1;
    for (const [row, civ] of [[0, 'turks'], [6, 'saracens']]) for (const [type, dx] of [['tc', 0], ['monastery', 5], ['house', 9]]) {
      spawnBuilding(type, 1, x0 + dx, y0 + row, true).civ = civ;
    }
    KART.cache.clear(); R.spriteCache.clear();
    g.centerCamOn(x0 + 6, y0 + 6);
  }, age);
  await page.waitForFunction(names => names.every(n => [...KART.cache.keys()].some(k => k.startsWith(n + '|'))), EXPECTED[age]);
  await page.screenshot({ path: `test-results/islamic-age${age}.png` });
  const used = await page.evaluate(() => [...KART.cache.keys()].map(k => k.split('|')[0]));
  for (const name of EXPECTED[age]) expect(used).toContain(name);
  if (age === 1) for (const name of ['monastery_turks_1', 'monastery_saracens_1']) expect(used).not.toContain(name);
  expect(errors).toEqual([]);
});
// Every Turks building type on cleared ground, drawn by the live game, zoomed out to fit one screenshot.
// Saves test-results/turks-town-age<N>.png for the review of the full Turks set in game.
const TURKS_TYPES = ['tc', 'castle', 'monastery', 'university', 'barracks', 'market', 'dock', 'siege', 'stable',
  'range', 'blacksmith', 'mill', 'lumbercamp', 'miningcamp', 'house', 'tower', 'well', 'outpost'];
const TURKS_TOWN = {
  // before their Turks sprites exist, the mosque, university and siege workshop show the shared age-1 sprite
  // and the castle the family castle_med
  1: ['tc_turks_1', 'house_turks_1', 'mill_turks_1', 'lumbercamp_turks_1', 'miningcamp_turks_1', 'dock_turks_1',
    'barracks_turks_1', 'market_turks_1', 'blacksmith_turks_1', 'range_turks_1', 'stable_turks_1', 'tower_turks_1',
    'well_turks_0', 'outpost_turks_0', 'monastery_1', 'university_1', 'siege_1', 'castle_med'],
  3: ['tc_turks_3', 'house_turks_3', 'monastery_turks_3', 'university_turks_3', 'barracks_turks_3', 'market_turks_3',
    'dock_turks_3', 'siege_turks_3', 'stable_turks_3', 'range_turks_3', 'blacksmith_turks_3', 'mill_turks_3',
    'lumbercamp_turks_3', 'miningcamp_turks_3', 'tower_turks_3', 'well_turks_2', 'castle_turks_2', 'outpost_turks_0'],
  4: TURKS_TYPES.map(t => t + '_turks_4'),
  5: TURKS_TYPES.map(t => t + '_turks_5'),
};

for (const age of [1, 3, 4, 5]) test(`every Turks building type uses its own sprite in game (age ${age})`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => KART.loadCiv('turks'));
  await page.evaluate(({ age, types }) => {
    const g = __game, w = g.W, m = w.map;
    g.UI.paused = true; w.noFog = true; w.players[1].age = age;
    const x0 = (w.n >> 1) - 15, y0 = (w.n >> 1) - 8;
    for (const e of w.list.slice()) if (e.x >= x0 - 1 && e.x < x0 + 31 && e.y >= y0 - 1 && e.y < y0 + 16) removeEnt(e);
    for (let y = y0 - 1; y < y0 + 16; y++) for (let x = x0 - 1; x < x0 + 31; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; m.blk[i] = 0; }
    m.computeVH(); m.computeRegions(); invalidateTerrain(); MM.baseVer = -1;
    types.forEach((type, i) => { spawnBuilding(type, 1, x0 + (i % 6) * 5, y0 + Math.floor(i / 6) * 5, true).civ = 'turks'; });
    KART.cache.clear(); R.spriteCache.clear();
    R.cam.zoom = 0.6;
    g.centerCamOn(x0 + 15, y0 + 7);
  }, { age, types: TURKS_TYPES });
  await page.waitForFunction(names => names.every(n => [...KART.cache.keys()].some(k => k.startsWith(n + '|'))), TURKS_TOWN[age]);
  await page.screenshot({ path: `test-results/turks-town-age${age}.png` });
  expect(errors).toEqual([]);
});
