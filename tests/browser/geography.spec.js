const {test,expect}=require('@playwright/test');
test('offline geography preview renders the three real coastlines',async({page})=>{
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8765/'))external.push(r.url());});
  await page.goto('/tools/geography-gallery.html');await expect(page.locator('canvas')).toHaveCount(3);await page.screenshot({path:'assets/screenshots/real-world-maps.png',fullPage:true});expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('real-world maps are selectable in setup and editor, with coal in the HUD',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/');await page.locator('#btn-sp').click();
  for(const type of ['anatolia','mediterranean','world']){await page.locator('#s-map').selectOption(type);expect(await page.locator('#s-map').inputValue()).toBe(type);}
  await page.locator('#s-map').selectOption('anatolia');await page.locator('#s-civ').selectOption('turks');await page.locator('#s-start').click();
  await expect(page.locator('#r-coal')).toBeVisible();expect(await page.evaluate(()=>__game.W.spec.name)).toBe('Anatolia');
  expect(await page.evaluate(()=>__game.W.list.filter(e=>e.type==='coal'&&e.depth>0).length)).toBeGreaterThan(0);
  for(const width of [1440,1280,1100]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.getElementById('b-menu').getBoundingClientRect().right<=innerWidth)).toBe(true);}
  await page.locator('#b-menu').click();await page.getByRole('button',{name:'Quit to Main Menu',exact:true}).click();
  // Editor entry is also exercised from a fresh menu to avoid depending on endgame transitions.
  await page.goto('/game/');await page.locator('#btn-editor').click();await page.locator('#ed-gtype').selectOption('mediterranean');await page.locator('#ed-gen').click();
  expect(await page.evaluate(()=>__game.W.spec.name)).toBe('Mediterranean');await expect(page.locator('#ed-obj [title="Buried coal seam"]')).toBeVisible();expect(errors).toEqual([]);
});

test('buried seams show excavation instructions and villagers excavate, mine and save coal',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/');await page.locator('#btn-tutorial').click();
  const result=await page.evaluate(()=>{
    const g=__game;g.UI.paused=true;g.W.noFog=true;
    for(const e of g.W.list.slice())if(e.x>=15&&e.x<25&&e.y>=15&&e.y<25)removeEnt(e);
    for(let y=15;y<25;y++)for(let x=15;x<25;x++){const i=g.W.map.idx(x,y);g.W.map.ter[i]=T.GRASS;g.W.map.elev[i]=0;g.W.map.blk[i]=0;}
    g.W.map.computeVH();g.W.map.computeRegions();const seam=spawnRes('coal',20,20,0,1),v=spawnUnit('villager',1,19.5,20.5);
    g.UI.selection=[seam];renderSelInfo();const instructions=document.getElementById('selinfo').textContent.includes('Buried seam');
    orderTarget([v],seam,false);const excavating=v.order.t==='terra';terraLogic(v,6);terraLogic(v,.1);gatherLogic(v,4);deposit(v);
    const coal=g.W.players[1].res.coal;g.MatchSave.resume(g.MatchSave.serialize());g.UI.paused=true;g.UI.selection=[ent(seam.id)];renderSelInfo();
    return {instructions,excavating,coal,restored:g.W.players[1].res.coal===coal,open:mineAccessible(ent(seam.id))};
  });
  expect(result.instructions).toBe(true);expect(result.excavating).toBe(true);expect(result.coal).toBeGreaterThan(0);expect(result.restored&&result.open).toBe(true);
  await expect(page.locator('#selinfo')).toContainText('Coal Mine');await expect(page.locator('#selinfo')).toContainText('Underground mine open');expect(errors).toEqual([]);
});

test('six distinct Wonder forms render with the default artwork and have age-specific names',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/');await page.locator('#btn-tutorial').click();
  const result=await page.evaluate(()=>{
    __game.UI.paused=true;const p=__game.W.players[1];p.civ='turks';const hashes=[],names=[];
    const preview=document.createElement('div');preview.id='wonder-preview';preview.style='position:fixed;inset:0;z-index:10000;background:#192127;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:24px;color:#ebd4a3';
    for(let age=0;age<6;age++){
      p.age=age;const sprite=bldSprite('wonder',age,p.color);hashes.push(sprite.cv.toDataURL());names.push(wonderName(p));
      const frame=document.createElement('div'),title=document.createElement('p'),cv=document.createElement('canvas');title.textContent=AGES[age]+' · '+wonderName(p);title.style='font:16px Georgia;text-align:center';cv.width=420;cv.height=320;const ctx=cv.getContext('2d'),scale=Math.min(400/sprite.w,300/sprite.h);ctx.drawImage(sprite.cv,210-sprite.w*scale/2,310-sprite.h*scale,sprite.w*scale,sprite.h*scale);frame.append(title,cv);preview.append(frame);
    }
    document.body.append(preview);return {forms:new Set(hashes).size,names:new Set(names).size};
  });
  expect(result).toEqual({forms:6,names:6});await page.locator('#wonder-preview').screenshot({path:'assets/screenshots/wonders-by-age.png'});expect(errors).toEqual([]);
});

test('2.5D rebuilds age-specific Wonder geometry and updates opened mine sprites without changing simulation',async({page})=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/?renderer=three');await page.locator('#btn-tutorial').click();await page.waitForFunction(()=>__game.T25D.enabled && __game.T25D.world===__game.W);
  const result=await page.evaluate(()=>{
    const g=__game;g.UI.paused=true;g.W.noFog=true;const p=g.W.players[1],b=spawnBuilding('wonder',1,14,14,true);b.wonderT=151;
    const styles=[];for(let age=0;age<6;age++){p.age=age;g.T25D.render(g.R.ctx,{selection:new Set()});styles.push(g.T25D.structures.get(b.id).key);}
    const mine=spawnRes('coal',25,25,0,1);g.W.map.ter[g.W.map.idx(25,25)]=T.GRASS;g.W.map.elev[g.W.map.idx(25,25)]=0;g.W.map.blk[g.W.map.idx(25,25)]=0;g.W.map.computeVH();
    const sealed=g.T25D.asset(mine);terraApply('dig',25,25,p);const opened=g.T25D.asset(mine),before=JSON.stringify(g.MatchSave.snapshot().graph);g.T25D.render(g.R.ctx,{selection:new Set()});
    return {styles:new Set(styles).size,mine:sealed!==opened,unchanged:before===JSON.stringify(g.MatchSave.snapshot().graph),timer:b.wonderT};
  });
  expect(result).toEqual({styles:6,mine:true,unchanged:true,timer:151});expect(errors).toEqual([]);
});
