const { test, expect } = require('@playwright/test');

const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && Object.keys(KART.img).length + KART.failed.length === Object.keys(KENNEY_ART).length);

// A Turks row and a Saracens row of Town Center, Monastery and House on cleared grass, drawn by the live game.
// Saves test-results/islamic-age<N>.png for the in-game review: footprint fit, shadows, flag and shield, no doubled domes.
const EXPECTED = {
  1: ['tc_turks_1', 'house_turks_1', 'tc_saracens_1', 'house_saracens_1', 'monastery_1'],
  3: ['tc_turks_3', 'monastery_turks_3', 'house_turks_3', 'tc_saracens_3', 'monastery_saracens_3', 'house_saracens_3'],
};

for (const age of [1, 3]) test(`Turks and Saracens towns use their own buildings in game (age ${age})`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
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
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/islamic-age${age}.png` });
  const used = await page.evaluate(() => [...KART.cache.keys()].map(k => k.split('|')[0]));
  for (const name of EXPECTED[age]) expect(used).toContain(name);
  expect(errors).toEqual([]);
});
