const { test, expect } = require('@playwright/test');

test('2.5D renders original units, preserves state and aligns picking', async ({ page }) => {
  test.setTimeout(90000); // Software WebGL also rebuilds terrain and loads a save in this test.
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/game/?renderer=three');
  await page.waitForFunction(()=>window.__game?.T25D.stats.frames>1);
  await page.locator('#btn-tutorial').click();
  await page.waitForFunction(()=>__game.T25D.world===__game.W && __game.T25D.stats.sprites>0);
  const result=await page.evaluate(()=>{
    const g=__game,t=g.T25D;g.UI.paused=true;
    const before=JSON.stringify(g.MatchSave.snapshot().graph);
    t.render(g.R.ctx,{selection:new Set()});
    const after=JSON.stringify(g.MatchSave.snapshot().graph);
    const u=g.W.list.find(e=>e.kind==='unit'&&e.owner===1&&!e.inside);
    g.centerCamOn(u.x,u.y);t.render(g.R.ctx,{selection:new Set([u])});
    const h=g.W.map.h(u.x,u.y),v=new t.lib.Vector3(u.x,h*14/(64/Math.SQRT2*Math.sqrt(3)/2),u.y).project(t.camera);
    const expected=g.toScreen(u.x,u.y,h),actual={x:(v.x+1)*g.R.cw/2,y:(1-v.y)*g.R.ch/2};
    const picked=g.screenToTile(expected.x,expected.y);
    return {unchanged:before===after,error:Math.hypot(expected.x-actual.x,expected.y-actual.y),pickError:Math.hypot(picked.x-u.x,picked.y-u.y),stats:t.stats};
  });
  expect(result.unchanged).toBe(true);expect(result.error).toBeLessThan(.01);expect(result.pickError).toBeLessThan(.15);
  expect(result.stats.structures).toBeGreaterThan(0);
  const extra=await page.evaluate(()=>{
    const g=__game,t=g.T25D;
    const b=g.W.list.find(e=>e.type==='tc'&&e.owner===1);
    g.centerCamOn(b.x+1.5,b.y+1.5);t.render(g.R.ctx,{selection:new Set()});
    const box=new t.lib.Box3().setFromObject(t.structures.get(b.id).group),p=box.getCenter(new t.lib.Vector3()).project(t.camera);
    const picked=t.pickBuilding((p.x+1)*g.R.cw/2,(1-p.y)*g.R.ch/2);
    const builds=t.stats.terrainBuilds;g.W.map.elev[g.W.map.idx(b.x,b.y)]++;g.W.map.computeVH();t.render(g.R.ctx,{selection:new Set()});
    const save=g.MatchSave.serialize();g.MatchSave.resume(save);g.UI.paused=true;t.render(g.R.ctx,{selection:new Set()});
    return {picked:picked?.id===b.id,rebuilt:t.stats.terrainBuilds>builds,restored:t.world===g.W};
  });
  expect(extra).toEqual({picked:true,rebuilt:true,restored:true});
  await page.setViewportSize({width:1280,height:900});
  await page.waitForFunction(()=>__game.T25D.width===__game.R.cw);
  expect((await page.locator('#b-fullscreen').boundingBox()).height).toBeLessThanOrEqual(34);
  await page.screenshot({path:'test-results/three25d.png'});
  await page.locator('#b-graphics').click();
  expect(await page.evaluate(()=>__game.T25D.enabled)).toBe(false);
  await expect(page.locator('#three25d')).toBeHidden();
  expect(errors).toEqual([]);
});

test('unavailable WebGL module falls back to Canvas 2D',async({page})=>{
  await page.route('**/vendor/three/three.module.js',route=>route.abort());
  await page.goto('/game/?renderer=three');
  await expect(page.locator('#graphics-status')).toContainText('2.5D is unavailable');
  expect(await page.evaluate(()=>__game.T25D.enabled)).toBe(false);
  await page.locator('#btn-tutorial').click();await expect(page.locator('#hud')).toBeVisible();
});

test('full screen enters and exits while resizing the game', async ({page})=>{
  await page.goto('/game/');await page.waitForFunction(()=>!!window.__game?.W);
  await page.locator('#btn-fullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement);
  await expect(page.locator('#btn-fullscreen')).toHaveText('Exit Full Screen');
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#b-fullscreen')).toHaveText('Exit Full Screen');
  await page.locator('#b-fullscreen').click();
  await page.waitForFunction(()=>!document.fullscreenElement);
  expect(await page.evaluate(()=>__game.R.cw===document.querySelector('#game').clientWidth)).toBe(true);
});
