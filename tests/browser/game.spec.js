const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/game/');
  await page.waitForFunction(() => !!window.__game?.W);
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));

test('setup exposes presets and starts with their chosen rules', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#rule-preset').selectOption('beginner');
  await expect(page.locator('#rule-aging')).not.toBeChecked();
  await expect(page.locator('#rule-thirst')).not.toBeChecked();
  await page.locator('#s-start').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => __game.W.settings.rules.thirst)).toBe(false);
});
test('tutorial responds to selecting a villager', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#tutorial-panel')).toContainText('Lesson 1/5');
  await page.evaluate(() => { __game.UI.selection = [__game.W.list.find(e => e.type === 'villager' && e.owner === 1)]; });
  await expect(page.locator('#tutorial-panel')).toContainText('Lesson 2/5');
  await page.screenshot({ path: 'test-results/tutorial.png' });
});
test('manual save and autosave resume the match from the menu', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await page.evaluate(() => { __game.W.nextAutosave = __game.W.t + 0.05; });
  await page.waitForFunction(() => !!localStorage.getItem('aor_autosave_v1'));
  await page.locator('#b-menu').click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 1234; });
  await page.getByRole('button', { name: 'Save Match', exact: true }).click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 1; });
  await page.getByRole('button', { name: 'Load Match', exact: true }).click();
  await page.getByRole('button', { name: /Manual save/ }).click();
  expect(await page.evaluate(() => __game.W.players[1].res.gold)).toBe(1234);
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#tutorial-panel')).toBeVisible();
});
test('editor rejects malformed imports without replacing its map', async ({ page }) => {
  await page.locator('#btn-editor').click();
  const before = await page.evaluate(() => JSON.stringify(__game.Editor.toSpec()));
  await page.locator('#ed-import').setInputFiles({ name: 'bad.aoemap.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ n: -1, ter: [], objects: [] })) });
  await expect(page.locator('#ed-status')).toContainText('Import failed');
  expect(await page.evaluate(() => JSON.stringify(__game.Editor.toSpec()))).toBe(before);
});
test('editor saves names as text and retains engineering layers', async ({ page }) => {
  await page.locator('#btn-editor').click();
  await page.evaluate(() => { const m=__game.W.map; for(const key of ['bridge','tun','trench']) { m[key]=new Uint8Array(m.n*m.n); m[key][10]=1; } });
  await page.locator('#ed-name').fill('<img src=x onerror=alert(1)>');
  await page.locator('#ed-save').click();
  await expect(page.locator('#ed-status')).toContainText('Saved "<img');
  await expect(page.locator('#ed-status img')).toHaveCount(0);
  await page.locator('#ed-blank').click();
  await page.locator('#ed-load').click();
  expect(await page.evaluate(() => ['bridge','tun','trench'].every(k=>__game.W.map[k]?.[10]===1))).toBe(true);
});
test('remapped pause shortcut works and modals trap keyboard focus', async ({ page }) => {
  await page.locator('#btn-controls').click();
  await page.locator('[data-key="pause"]').click();
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('#btn-tutorial').click();
  await page.keyboard.press('p');
  expect(await page.evaluate(() => __game.UI.paused)).toBe(true);
  await page.keyboard.press('p');
  expect(await page.evaluate(() => __game.UI.paused)).toBe(false);
  await page.locator('#b-menu').click();
  const buttons = page.locator('#modal button');
  await buttons.last().focus(); await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
});
test('nested dialogs return to the game menu without trapping the match in pause', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await page.locator('#b-menu').click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await page.getByRole('button', { name: 'Back to Game Menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await page.evaluate(() => __game.UI.paused)).toBe(false);
});
