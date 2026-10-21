// Saves and maps in the browser: IndexedDB through store.js, the save slots, the sliced autosave, gzip export and
// import, the editor's maps, and the move of old localStorage saves and maps into IndexedDB.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/game/');
  await page.waitForFunction(() => !!window.__game?.W);
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));
const reload = async page => { await page.reload(); await page.waitForFunction(() => !!window.__game?.W); };

test('Store keeps saves, maps and meta in IndexedDB across a reload', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const big = 'x'.repeat(6 * 1024 * 1024);   // more than the whole localStorage quota
    await Store.put('saves', '5', big); await Store.put('maps', 'Probe', { n: 16, ter: [1, 2] }); await Store.put('meta', 'probe', { a: 1 });
    return Store.mode;
  })).toBe('idb');
  await reload(page);
  expect(await page.evaluate(async () => {
    const v = await Store.get('saves', '5'), out = { len: v.length, map: await Store.get('maps', 'Probe'), meta: (await Store.keys('meta')).includes('probe') };
    await Store.del('saves', '5'); await Store.del('maps', 'Probe'); await Store.del('meta', 'probe');
    return out;
  })).toEqual({ len: 6291456, map: { n: 16, ter: [1, 2] }, meta: true });
});
