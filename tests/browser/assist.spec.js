const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/game/');
  await page.waitForFunction(() => !!window.__game?.W);
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));

test('shared control supports mouse selection, orders, Stop, handover, toggles and save/load', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#s-opp').selectOption('1');
  await page.locator('#s-size').selectOption('tiny');
  await page.locator('#s-seed').fill('5');
  await page.locator('#s-assist').check();
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  expect(await page.evaluate(() => {
    const g=__game; g.UI.paused=true;
    return g.W.players[1].human && !!g.W.players[1].ai && !g.W.spectate && !g.W.noFog;
  })).toBe(true);
  const point = await page.evaluate(() => {
    const g=__game, v=g.W.list.find(e=>e.owner===1 && e.type==='villager');
    g.centerCamOn(v.x,v.y);
    const p=g.toScreen(v.x,v.y,g.W.map.h(v.x,v.y)), rect=g.R.cv.getBoundingClientRect();
    return { x:p.x+rect.left, y:p.y+rect.top-8 };
  });
  await page.mouse.click(point.x,point.y);
  await expect.poll(() => page.evaluate(() => __game.UI.selection.filter(e=>e.kind==='unit' && e.owner===1).length)).toBeGreaterThan(0);
  await page.mouse.click(point.x+120,point.y+75,{button:'right'});
  await expect(page.locator('#b-assist-return')).toBeVisible();
  expect(await page.evaluate(() => __game.UI.selection.every(u=>u.assistControl==='order'))).toBe(true);
  await page.locator('#cmds .cmd').filter({has:page.locator('.hk', {hasText:/^S$/})}).click();
  expect(await page.evaluate(() => __game.UI.selection.every(u=>u.assistControl==='hold' && !u.order))).toBe(true);
  await page.evaluate(() => { window.assistSaved=__game.MatchSave.serialize(); __game.MatchSave.resume(window.assistSaved); __game.UI.paused=true; });
  await expect(page.locator('#b-assist')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#b-assist-return')).toBeVisible();
  await page.locator('#b-assist-return').click();
  await expect(page.locator('#assist-control')).toContainText('AI controls');
  await page.locator('#b-assist').click();
  await expect(page.locator('#b-assist')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(() => !__game.W.players[1].ai)).toBe(true);
  await page.locator('#b-assist').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  for (const width of [1440,1100]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(() => [...document.querySelectorAll('#topbar .tb-btns button')].filter(b=>!b.hidden && getComputedStyle(b).display!=='none').every(b=>{ const r=b.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; }))).toBe(true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/ai-assist.png'});
});

test('the Return to AI button stays the same element while the panel refreshes', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#s-opp').selectOption('1');
  await page.locator('#s-size').selectOption('tiny');
  await page.locator('#s-seed').fill('5');
  await page.locator('#s-assist').check();
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  // The main loop calls renderSelInfo four times a second, paused or not; a button rebuilt on every call
  // detaches before a click on a slow (software-rendered) frame rate can land on it.
  const same = await page.evaluate(() => {
    const g = __game; g.UI.paused = true;
    const vills = g.W.list.filter(e => e.owner === 1 && e.type === 'villager').slice(0, 3);
    const out = {};
    for (const n of [1, 3]) {
      for (const v of vills) v.assistControl = 'order';
      g.UI.selection = vills.slice(0, n);
      renderSelInfo();
      const first = document.querySelector('#b-assist-return');
      renderSelInfo(); renderSelInfo();
      out[n] = !!first && first.isConnected && document.querySelector('#b-assist-return') === first;
    }
    return out;
  });
  expect(same).toEqual({ 1: true, 3: true });
  await page.locator('#b-assist-return').click();
  await expect(page.locator('#assist-control')).toContainText('AI controls');
  expect(await page.evaluate(() => __game.UI.selection.every(u => !u.assistControl))).toBe(true);
});

test('spectating disables shared control and the setup choice persists', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#s-assist').check();
  await page.locator('#s-spectate').check();
  await expect(page.locator('#s-assist')).toBeDisabled();
  await page.locator('#s-spectate').uncheck();
  await expect(page.locator('#s-assist')).toBeEnabled();
  await page.locator('#s-opp').selectOption('1');
  await page.locator('#s-size').selectOption('tiny');
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aoe_setup')).aiAssist)).toBe(true);
  await page.locator('#b-menu').click();
  await page.getByRole('button',{name:'Quit to Main Menu',exact:true}).click();
  await page.locator('#btn-sp').click();
  await expect(page.locator('#s-assist')).toBeChecked();
  await page.locator('#s-spectate').check();
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toBeHidden();
  expect(await page.evaluate(() => !!__game.W.spectate && !__game.W.aiAssist && __game.W.settings.aiAssist===false)).toBe(true);
});

test('AI Assist keeps one villager idle: the . key selects it and the top bar counts it', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#s-opp').selectOption('1');
  await page.locator('#s-size').selectOption('tiny');
  await page.locator('#s-seed').fill('5');
  await page.locator('#s-assist').check();
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  await page.waitForTimeout(4000);
  await page.evaluate(() => { __game.UI.selection = []; });
  await page.keyboard.press('.');
  await expect.poll(() => page.evaluate(() => __game.UI.selection.filter(e => e.kind === 'unit' && e.owner === 1 && e.type === 'villager').length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => Number(document.querySelector('#r-vil span').textContent))).toBeGreaterThanOrEqual(1);
});
