const {test,expect}=require('@playwright/test');
async function captureArmy(page,future){
  await page.evaluate(future=>{
    const g=__game,w=g.W,p=w.players[1],tc=w.list.find(e=>e.type==='tc'&&e.owner===1);g.UI.paused=true;w.noFog=true;p.civ='turks';p.age=future?5:3;UnitArt.set(future?'auto':'ottoman');
    const types=future?['rifleman','marksman','plasmaguard','railgunner','tank','fusionwalker']:['longsword','pikeman','archer','janissary','knight','cavarcher'];
    const created=[];
    types.forEach((type,i)=>{const x=Math.min(w.n-2,tc.x+1.5+(i%3)*1.8),y=Math.min(w.n-2,tc.y+5.5+Math.floor(i/3)*2.2);for(const e of w.list.slice())if(e.kind==='res'&&Math.hypot(e.x-x,e.y-y)<1.5)removeEnt(e);created.push(spawnUnit(type,1,x,y));});
    const tutorial=document.getElementById('tutorial-panel');if(tutorial)tutorial.style.display='none';document.getElementById('msgs').style.display='none';document.getElementById('pausebanner').style.display='none';
    g.UI.selection=[created[future?5:3]];g.UI.panelKey='';renderCommands();renderSelInfo();updateTopbar();
    g.R.cam.zoom=1.5;g.centerCamOn(tc.x+3,tc.y+5);
    for(const u of w.list)if(u.kind==='unit')UnitArt.ensure(UnitArt.key(u));
  },future);
  await page.waitForFunction(()=>UnitArt.pending.size===0&&Object.keys(KART.img).length===Object.keys(KENNEY_ART).length);
  await page.evaluate(()=>renderWorld(__game.R.ctx,{selection:new Set(__game.UI.selection)}));
  await page.screenshot({path:'assets/screenshots/'+(future?'game-future':'game-ottoman')+'.jpg',type:'jpeg',quality:90});
}

test('actor library loads all styles and animations without external requests',async({page})=>{
  test.setTimeout(90000);const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:8765/'))external.push(r.url());});
  await page.goto('/tools/art/actor-gallery.html');
  await page.waitForFunction(()=>cards.every(c=>c.base.complete&&c.base.naturalWidth>0&&c.mask.complete&&c.mask.naturalWidth>0));
  expect(await page.locator('.tile').count()).toBe(53);
  await page.locator('#play').uncheck();await page.locator('#action').selectOption('idle');
  await page.screenshot({path:'assets/screenshots/unit-library.jpg',fullPage:true,type:'jpeg',quality:90});
  await page.locator('#theme').selectOption('ottoman');await expect(page.locator('section[data-theme="ottoman"]')).toBeVisible();await expect(page.locator('section[data-theme="seljuk"]')).toBeHidden();
  await page.locator('#action').selectOption('attack');await page.locator('#direction').selectOption('3');
  expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('historical unit styles, team colors and tasks render without changing match state',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/?units=ottoman');
  await expect(page.locator('#unit-style')).toHaveValue('ottoman');await page.locator('#btn-tutorial').click();
  await page.evaluate(()=>{__game.UI.paused=true;UnitArt.ensure('ottoman-sword');UnitArt.ensure('ottoman-villager');});
  await page.waitForFunction(()=>UnitArt.loaded.has('ottoman-sword')&&UnitArt.loaded.has('ottoman-villager'));
  const result=await page.evaluate(()=>{
    const cv=document.createElement('canvas');cv.width=cv.height=160;const g=cv.getContext('2d');g.translate(80,130);
    const before=JSON.stringify(__game.MatchSave.snapshot().graph),u={id:2,type:'militia',owner:1,face:1,anim:'idle',animT:0,x:1,y:1};
    const images=[];for(const owner of [1,2]){g.clearRect(-80,-130,160,160);drawUnitFigure(g,{...u,owner},0);images.push(cv.toDataURL());}
    for(const kind of ['chop','mine','farm','build','forage'])drawUnitFigure(g,{...u,type:'villager',anim:'work',work:{kind}},.25);
    const unchanged=before===JSON.stringify(__game.MatchSave.snapshot().graph);UnitArt.set('seljuk');const early=UnitArt.key(u)==='seljuk-sword';
    return {teamColors:images[0]!==images[1],unchanged,early,failed:[...UnitArt.failed]};
  });
  expect(result).toMatchObject({teamColors:true,unchanged:true,early:true,failed:[]});expect(errors).toEqual([]);
  await captureArmy(page,false);expect(errors).toEqual([]);
});

test('Modern and Future ages expose train commands, research and resumable units',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/');await page.locator('#btn-sp').click();await page.locator('#s-age').selectOption('3');await page.locator('#s-start').click();
  const result=await page.evaluate(()=>{
    const g=__game;g.UI.paused=true;const p=g.W.players[1],tc=g.W.list.find(e=>e.type==='tc'&&e.owner===1);
    p.res={food:1e5,wood:1e5,gold:1e5,stone:1e5,coal:1e5};spawnBuilding('university',1,4,4,true);spawnBuilding('siege',1,10,4,true);
    g.UI.selection=[tc];g.UI.panelKey='';renderCommands();const modernCommand=g.UI.cmds.find(c=>c.name==='Modern Age');if(!modernCommand||modernCommand.lock)throw new Error('Missing Modern Age command');
    runCmd(modernCommand);updateBuilding(tc,TECHS.modernage.time+.1);
    const barracks=spawnBuilding('barracks',1,16,4,true);g.UI.selection=[barracks];g.UI.panelKey='';renderCommands();const rifle=g.UI.cmds.find(c=>c.name==='Rifleman');
    const modern=p.age===4&&rifle&&!rifle.lock;completeTech(p,'industrialization');completeTech(p,'electronics');completeTech(p,'futureage');
    const walker=spawnUnit('fusionwalker',1,25,25);completeTech(p,'nanorepair');const save=g.MatchSave.serialize();g.MatchSave.resume(save);g.UI.paused=true;
    return {modern:!!modern,future:g.W.players[1].age===5,restored:g.W.list.some(e=>e.id===walker.id&&e.type==='fusionwalker'),research:g.W.players[1].nanoRepair};
  });
  expect(result).toEqual({modern:true,future:true,restored:true,research:true});expect(errors).toEqual([]);
  await captureArmy(page,true);expect(errors).toEqual([]);
});

test('missing unit atlases use the animated drawn fallback',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/art/actors/medieval-villager*.png',r=>r.abort());
  await page.goto('/game/?units=auto');await page.locator('#btn-tutorial').click();await page.waitForFunction(()=>UnitArt.failed.has('medieval-villager'));
  await expect(page.locator('#hud')).toBeVisible();expect(errors).toEqual([]);
});

test('2.5D displays later-era vehicle sprites and keeps match state intact',async({page})=>{
  test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/game/?renderer=three');await page.waitForFunction(()=>window.__game?.T25D.stats.frames>1);await page.locator('#btn-tutorial').click();
  await page.evaluate(()=>{__game.UI.paused=true;UnitArt.ensure('modern-tank');UnitArt.ensure('future-walker');});
  await page.waitForFunction(()=>UnitArt.loaded.has('modern-tank')&&UnitArt.loaded.has('future-walker'));
  const r=await page.evaluate(()=>{const g=__game,t=g.T25D,tc=g.W.list.find(e=>e.type==='tc'&&e.owner===1);g.W.noFog=true;
    const tank=spawnUnit('tank',1,tc.x+4.5,tc.y+4.5),walker=spawnUnit('fusionwalker',1,tc.x+5.5,tc.y+4.5);g.centerCamOn(tank.x,tank.y);
    const before=JSON.stringify(g.MatchSave.snapshot().graph);t.render(g.R.ctx,{selection:new Set([walker])});return {actors:t.actors.has(tank.id)&&t.actors.has(walker.id),unchanged:before===JSON.stringify(g.MatchSave.snapshot().graph)};});
  expect(r).toEqual({actors:true,unchanged:true});expect(errors).toEqual([]);
});
