const assert = require('assert');
const { run, warnings } = require('./engine-harness')();
let pass = 0, fail = 0;
function test(name, code) {
  try { assert.strictEqual(run(code), true); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.error('FAIL ' + name, e); }
}
run(`
  function assisted(seed = 5) {
    make(seed); MOD.aging = false; WELLM.enabled = false; assistSetEnabled(true, false);
    return W.players[1].ai;
  }
  function arena() {
    const x = W.n / 2 | 0, y = 5;
    for (const e of W.list.slice()) if (e.x >= x-2 && e.x < x+16 && e.y < y+12) removeEnt(e);
    for (let ty=y-2; ty<y+12; ty++) for (let tx=x-2; tx<x+16; tx++) {
      const i=W.map.idx(tx,ty); W.map.ter[i]=T.GRASS; W.map.elev[i]=0; W.map.blk[i]=0; W.players[1].explored[i]=1;
    }
    W.map.computeVH(); W.map.computeRegions(); return { x:x+0.5, y:y+0.5 };
  }
`);
test('assistance is opt-in and uses normal human rates even against hardest opponents', `(() => {
  make(); if(W.aiAssist || W.players[1].ai) return false;
  W.settings.difficulty='hardest'; assistSetEnabled(true,false);
  return W.aiAssist && W.players[1].human && !W.spectate && !W.revealAll && !W.noFog && W.players[1].ai.gatherMul===1;
})()`);
test('the assistant gathers, trains and builds through the real simulation', `(() => {
  assisted(); const initial=W.list.filter(e=>e.owner===1&&e.type==='villager').length;
  for(let i=0;i<3600;i++) worldTick(0.05);
  return W.players[1].stats.gathered>0 && W.list.filter(e=>e.owner===1&&e.type==='villager').length>initial && W.list.some(e=>e.owner===1&&e.kind==='bld'&&e.type==='house');
})()`);
test('player moves and Shift waypoints survive AI updates and finish before handover', `(() => {
  const ai=assisted(), p=arena(), u=spawnUnit('militia',1,p.x,p.y);
  cmdIssue([u],false,()=>orderMove([u],p.x+4,p.y));
  cmdIssue([u],true,()=>orderMove([u],p.x+9,p.y));
  const first=u.order, queued=u.queue[0]; ai.update(1);
  if(u.order!==first || u.queue[0]!==queued || ai.army().includes(u)) return false;
  for(let i=0;i<500 && (u.order || u.queue.length);i++) worldTick(0.05);
  const arrived=Math.hypot(u.x-(p.x+9),u.y-p.y)<0.5;
  ai.update(0.05);
  return arrived && !u.assistControl && ai.army().includes(u);
})()`);
test('continuous player gathering is protected from rebalancing and construction', `(() => {
  const ai=assisted(), v=W.list.find(e=>e.owner===1&&e.type==='villager'), tree=W.list.find(e=>e.type==='tree');
  cmdIssue([v],false,()=>orderTarget([v],tree)); const order=v.order;
  ai.update(5); const h=ai.home();
  return v.order===order && !ai.assign(v,'food') && !ai.pickBuilders(h.x|0,h.y|0,100).includes(v) && ai.mine(e=>e.type==='villager').includes(v);
})()`);
test('Stop holds an idle worker until Return to AI; selection alone does not reserve units', `(() => {
  const ai=assisted(), v=W.list.find(e=>e.owner===1&&e.type==='villager'); UI.selection=[v]; UI.page='main';
  if(!ai.canControl(v)) return false;
  commandsFor([v]).find(c=>c.name==='Stop').fn(); ai.update(5);
  if(v.order || v.assistControl!=='hold') return false;
  assistReturn([v]); ai.update(1);
  return !v.assistControl && !!v.order;
})()`);
test('stances keep soldiers under player control across later move completion', `(() => {
  const ai=assisted(), p=arena(), u=spawnUnit('militia',1,p.x,p.y);
  cmdSetStance([u],'ground'); cmdIssue([u],false,()=>orderMove([u],p.x+1,p.y));
  setOrder(u,null); ai.update(1);
  if(u.assistControl!=='hold' || ai.canControl(u) || u.stance!=='ground') return false;
  assistReturn([u]); return ai.canControl(u) && !u.stance;
})()`);
test('reactive AI defense cannot overwrite a direct player order', `(() => {
  const ai=assisted(), p=arena(), v=spawnUnit('villager',1,p.x,p.y), foe=spawnUnit('scout',2,p.x+1,p.y);
  cmdIssue([v],false,()=>orderMove([v],p.x+8,p.y)); const order=v.order;
  ai.onAttacked(v,foe); return v.order===order && ASSIST.active===null;
})()`);
test('a player attack stays in force until its target dies, then returns to AI', `(() => {
  const ai=assisted(), p=arena(), u=spawnUnit('militia',1,p.x,p.y), target=spawnUnit('villager',2,p.x+0.7,p.y);
  target.hp=1; target.stance='noattack';
  cmdIssue([u],false,()=>orderTarget([u],target)); const order=u.order;
  ai.update(1); if(u.order!==order || order.t!=='attack') return false;
  for(let i=0;i<200 && !target.dying;i++) worldTick(0.05);
  for(let i=0;i<10;i++) worldTick(0.05);
  return target.dying && !u.assistControl && ai.canControl(u);
})()`);
test('player construction keeps its builder and completes before handover', `(() => {
  const ai=assisted(), p=arena(), u=spawnUnit('villager',1,p.x,p.y); let b;
  cmdIssue([u],false,()=>{ b=placeBuilding(W.players[1],'house',(p.x|0)+4,p.y|0,[u]); });
  const order=u.order; ai.update(1);
  if(typeof b!=='object' || u.order!==order || order.t!=='build' || ai.canControl(u)) return false;
  for(let i=0;i<1600 && !b.built;i++) worldTick(0.05);
  for(let i=0;i<10;i++) worldTick(0.05);
  return b.built && !u.assistControl && ai.canControl(u);
})()`);
test('AI town bells spare reserved workers and player bells stay under player control', `(() => {
  const ai=assisted(), v=W.list.find(e=>e.owner===1&&e.type==='villager'), p=W.players[1];
  cmdIssue([v],false,()=>orderMove([v],v.x+2,v.y)); const order=v.order;
  assistContext(ai,()=>ringBell(p));
  if(v.order!==order || v.bellRung) return false;
  assistContext(ai,()=>allClear(p)); ringBell(p);
  const before=p.bell; ai.update(20); if(!before || !p.bell || !p.assistManualBell) return false;
  allClear(p); return !p.bell && !p.assistManualBell;
})()`);
test('the AI cannot eject a player-garrisoned veteran', `(() => {
  const ai=assisted(), b=ai.tc(), u=spawnUnit('militia',1,b.x+5,b.y+5);
  u.inside=b.id; b.garrison.push(u.id); u.assistControl='order'; u.rank=1;
  assistContext(ai,()=>ungarrisonOne(b,u.id));
  return u.inside===b.id && b.garrison.includes(u.id);
})()`);
test('player production cannot be canceled by the AI, and rally orders are reserved', `(() => {
  const ai=assisted(), b=ai.tc(); b.queue=[]; queueUnit(b,'villager'); const q=b.queue[0];
  assistContext(ai,()=>cancelQueue(b,0)); if(b.queue[0]!==q || !q.assistUser) return false;
  const u=spawnUnit('villager',1,b.x+5,b.y+5); b.rally={x:u.x+2,y:u.y};
  setOrder(u,{t:'move',...b.rally}); const order=u.order; ai.onTrained(u,b);
  return u.order===order && u.assistControl==='order';
})()`);
test('turning assistance off pauses decisions and restores the same controller when enabled', `(() => {
  const ai=assisted(), v=W.list.find(e=>e.owner===1&&e.type==='villager');
  cmdIssue([v],false,()=>orderMove([v],v.x+2,v.y)); const order=v.order;
  assistSetEnabled(false,false);
  if(W.players[1].ai || v.order!==order || W.settings.aiAssist) return false;
  assistSetEnabled(true,false); return W.players[1].ai===ai && v.order===order && ai.canControl(v)===false;
})()`);
test('active assistance, manual orders and queues survive a save and deterministic resume', `(() => {
  assisted(); const p=arena(), u=spawnUnit('militia',1,p.x,p.y);
  cmdIssue([u],false,()=>orderMove([u],p.x+3,p.y)); cmdIssue([u],true,()=>orderMove([u],p.x+8,p.y));
  const text=MatchSave.serialize(), id=u.id;
  for(let i=0;i<60;i++) worldTick(0.05); const expected=signature();
  MatchSave.restore(text);
  if(!W.aiAssist || W.players[1].ai!==W.assistAI || !ent(id).assistControl || ent(id).queue.length!==1) return false;
  for(let i=0;i<60;i++) worldTick(0.05);
  return signature()===expected && !W.players[1].ai.canControl(ent(id));
})()`);
test('disabled assistance and held units survive a save', `(() => {
  assisted(); const u=W.list.find(e=>e.owner===1&&e.type==='villager'), id=u.id;
  commandsFor([u]).find(c=>c.name==='Stop').fn(); assistSetEnabled(false,false);
  MatchSave.restore(MatchSave.serialize());
  if(W.aiAssist || W.players[1].ai || !W.assistAI) return false;
  assistSetEnabled(true,false); return ent(id).assistControl==='hold' && !W.players[1].ai.canControl(ent(id));
})()`);
test('the assistant never resigns for the human and cannot be enabled for spectators or tutorials', `(() => {
  const ai=assisted(); W.t=70;
  for(const e of W.list.slice()) if(e.owner===1) removeEnt(e);
  ai.update(6); if(!W.players[1].alive) return false;
  make(); W.spectate=true;
  if(assistSetEnabled(true,false)!==false || W.aiAssist) return false;
  W.spectate=false; W.tutorial={step:0}; return assistSetEnabled(true,false)===false && !W.aiAssist;
})()`);
try { assert.deepStrictEqual(warnings, []); pass++; console.log('PASS all assisted simulations complete without AI warnings'); }
catch (e) { fail++; console.error('FAIL AI warnings', warnings); }
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
