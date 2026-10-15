const assert = require('assert/strict'), harness = require('./engine-harness');
const {run,warnings}=harness(); let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+' '+e.stack)}}
test('bridge planner finds a narrow crossing and rejects a wide sea',()=>{
  assert.equal(run(`(() => { const m=new GameMap(32); for(let y=0;y<32;y++)for(let x=14;x<=16;x++)m.ter[m.idx(x,y)]=T.WATER; m.computeRegions(); const p=aiBridgePlan(m,{x:10,y:16},{x:21,y:16}); if(!p||p.tiles.length!==3)return false; for(let y=0;y<32;y++)for(let x=10;x<=21;x++)m.ter[m.idx(x,y)]=T.WATER; m.computeRegions(); return aiBridgePlan(m,{x:6,y:16},{x:26,y:16})===null; })()`),true);
});
test('tunnel planner opens a cliff region and rejects obstructed routes or isolated mesas',()=>{
  assert.equal(run(`(() => { make(); const m=W.map; m.ter.fill(T.GRASS);m.elev.fill(0);m.blk.fill(0);for(let y=0;y<m.n;y++)for(let x=22;x<m.n;x++)m.elev[m.idx(x,y)]=3;m.computeRegions(); const a=aiTunnelPlan(m,{x:20,y:20},{x:27,y:20});spawnRes('tree',22,20);const b=aiTunnelPlan(m,{x:20,y:20},{x:27,y:20}); m.blk.fill(0); m.elev.fill(0); for(let y=19;y<=21;y++)for(let x=22;x<=24;x++)m.elev[m.idx(x,y)]=3; m.computeRegions(); const mesa=aiTunnelPlan(m,{x:20,y:20},{x:27,y:20}); return a&&a.length<=12&&b===null&&mesa===null; })()`),true);
});
test('AI assigns a bridge job, respects costs and avoids duplicate jobs',()=>{
  assert.equal(run(`(() => { make(); const m=W.map; for(const e of W.list.slice())removeEnt(e);m.ter.fill(T.GRASS);m.blk.fill(0);m.elev.fill(0);for(let y=0;y<m.n;y++)for(let x=25;x<28;x++)m.ter[m.idx(x,y)]=T.WATER;m.computeRegions();const p=W.players[2];spawnBuilding('tc',2,18,20,true);spawnBuilding('tc',1,32,20,true);const v=spawnUnit('villager',2,23.5,20.5);p.ai=new AIPlayer(p,'standard');W.t=100;p.ai.engineer(); const job=v.order&&v.order.job;if(!job||job.op!=='bridge')return false;W.t+=31;p.ai.engineer();return v.order.job===job; })()`),true);
});
test('engineering remains disabled by the rule switch',()=>{assert.equal(run(`(() => { const v=W.list.find(e=>e.type==='villager');setOrder(v,null);TERRA.enabled=false;W.t+=60;W.players[2].ai.engineer();TERRA.enabled=true;return !v.order; })()`),true)});
test('AI engineering does not conceal exceptions',()=>assert.deepEqual(warnings,[]));
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
