const assert = require('assert/strict'), harness = require('./engine-harness');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
const { c, run, warnings } = harness();
test('invalid maps are rejected without replacing the world', () => {
  assert.equal(run(`(() => { const old=W; let rejected=0; for(const spec of [{n:-1}, {...W.spec,ter:[]}, {...W.spec,objects:[{k:'bld',t:'__proto__',o:1,x:0,y:0}]}, {...W.spec,players:[{start:{x:NaN,y:1}},{}]}]) { try{createWorld(spec,W.settings)}catch(e){rejected++} } return rejected===4&&W===old; })()`), true);
});
test('old maps remain compatible; engineering layers round-trip', () => {
  assert.equal(run(`(() => { const spec=JSON.parse(JSON.stringify(W.spec)); spec.bridge=Array(W.n*W.n).fill(0); spec.tun=spec.bridge.slice(); spec.trench=spec.bridge.slice(); spec.bridge[5]=1; spec.tun[6]=1; spec.trench[7]=1; createWorld(spec,W.settings); Editor.players=spec.players; const out=Editor.toSpec(); return out.version===1&&out.bridge[5]===1&&out.tun[6]===1&&out.trench[7]===1&&validateMapSpec(out).length===0; })()`), true);
});
test('map storage preserves special names and handles quota errors', () => {
  c.localStorage = { value: '{}', getItem() { return this.value; }, setItem(k, v) { this.value = v; } };
  assert.equal(run(`Editor.store('__proto__', Editor.toSpec()); Editor.savedList().includes('__proto__') && !!Editor.load('__proto__')`), true);
  c.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => run(`Editor.store('other',Editor.toSpec())`), /quota/);
  delete c.localStorage;
});
test('same seed and orders reproduce a simulation despite cosmetic RNG', () => {
  const first = run(`make(32); for(let i=0;i<2;i++)W.players[i+1].ai=new AIPlayer(W.players[i+1],'standard'); for(let i=0;i<200;i++)worldTick(0.05); signature()`);
  const second = run(`make(32); for(let i=0;i<2;i++)W.players[i+1].ai=new AIPlayer(W.players[i+1],'standard'); for(let i=0;i<200;i++){ for(let j=0;j<20;j++)Math.random(); worldTick(0.05); } signature()`);
  assert.equal(second, first);
});
test('inspection does not consume simulation randomness', () => {
  assert.equal(run(`(() => { const before=W.rng.state(); for(const u of W.list)if(u.kind==='unit')modLimits(u); return before===W.rng.state(); })()`), true);
});

test('2.5D wall connections respect map edges, ownership and destroyed neighbors',()=>{
  assert.equal(run(`(() => {
    make();W.map.blk.fill(0);
    const wall=spawnBuilding('wall',1,0,20,true);
    spawnBuilding('wall',1,W.n-1,19,true);const other=spawnBuilding('wall',2,0,21,true);
    if(t25dWallMask(wall)!==0)return false;
    const gate=spawnBuilding('gate',1,1,20,true);if(t25dWallMask(wall)!==1)return false;
    idxSetOwner(other,1);if(t25dWallMask(wall)!==5)return false;
    gate.dead=true;return t25dWallMask(wall)===4;
  })()`),true);
});
test('save/load preserves AI, typed fog layers, shared jobs and queued orders', () => {
  assert.equal(run(`(() => { make(); W.players[2].ai=new AIPlayer(W.players[2],'standard'); const vs=W.list.filter(e=>e.type==='villager'&&e.owner===1); const job=terraJob('plant',[{x:20,y:20}]); vs[0].order={t:'terra',job}; vs[1].order={t:'terra',job}; vs[0].terraJob=job; vs[0].terraQ=job.tiles[0]; vs[0].queue=[{t:'move',x:22,y:22}]; W.map.trench=new Uint8Array(W.n*W.n); W.map.trench[11]=1; const text=MatchSave.serialize(); MatchSave.restore(text); const a=ent(vs[0].id),b=ent(vs[1].id); return a.order.job===b.order.job&&a.terraQ===a.order.job.tiles[0]&&a.queue.length===1&&W.players[2].ai.p===W.players[2]&&W.players[2].ai instanceof AIPlayer&&W.players[1].explored instanceof Uint8Array&&W.map.trench[11]===1&&W.ents.get(a.id)===a; })()`), true);
});
test('resuming preserves the next simulation results and pending arrows', () => {
  run(`make(17); W.players[2].ai=new AIPlayer(W.players[2],'standard'); const b=W.list.find(e=>e.type==='tc'&&e.owner===1),t=W.list.find(e=>e.type==='scout'&&e.owner===2); setTimeoutSim(0.1,{type:'buildingArrow',source:b.id,target:t.id}); var SAVE=MatchSave.serialize();`);
  const expected = run(`for(let i=0;i<120;i++)worldTick(0.05); signature()`);
  const actual = run(`MatchSave.restore(SAVE); for(let i=0;i<120;i++)worldTick(0.05); signature()`);
  assert.equal(actual, expected);
});

test('save/load keeps path-budget decisions deterministic in a crowded tick',()=>{
  run(`make();
    for(let y=26;y<=40;y++)for(let x=26;x<=40;x++){const i=W.map.idx(x,y);W.map.ter[i]=T.GRASS;W.map.elev[i]=0;W.map.blk[i]=0;}
    W.map.computeVH();W.map.computeRegions();
    var routeGoal={x0:35,y0:35,x1:35,y1:35};
    var routeIds=Array.from({length:32},()=>{const u=spawnUnit('villager',1,30.5,30.5);pathTo(u,routeGoal,0);return u.id;});
    var routeSave=MatchSave.serialize();
    function routeSignature(){W.tick++;for(const id of routeIds)pathTo(ent(id),routeGoal,0);return JSON.stringify({rng:W.rng.state(),routes:routeIds.map(id=>{const u=ent(id);return {path:u.path,retry:u.repathT,revision:u._pathMapVersion};})});}
  `);
  const expected=run('routeSignature()');
  const actual=run('MatchSave.restore(routeSave);routeSignature()');assert.equal(actual,expected);
});
test('unsupported, corrupt and malicious saves leave the active match untouched', () => {
  assert.equal(run(`(() => { const old=W; const good=MatchSave.snapshot(); let rejected=0; const payloads=[JSON.stringify({...good,version:9}),'{',JSON.stringify({format:'age-of-realms-match',version:1,graph:{nodes:[{type:'Object',data:[['__proto__',{ref:0}]]}],root:{ref:0}}}),JSON.stringify({format:'age-of-realms-match',version:2,n:64,graph:{shapes:[['Object','__proto__']],nodes:[[0,[0]]],root:[0]}}),JSON.stringify({format:'age-of-realms-match',version:2,n:64,graph:{shapes:[],nodes:[['Uint8Array',4,'AAAA']],root:[0]}})]; for(const text of payloads)try{MatchSave.restore(text)}catch(e){rejected++} return rejected===5&&W===old&&({}).polluted===undefined; })()`), true);
});
test('lifecycle hooks can unsubscribe', () => { assert.equal(run(`(() => { let n=0; const stop=GameHooks.on('afterTick',()=>n++); worldTick(0.05); stop(); worldTick(0.05); return n===1; })()`), true); });
test('farm orders survive a save and continue gathering', () => {
  assert.equal(run(`(() => { make(); const v=W.list.find(e=>e.type==='villager'&&e.owner===1),farm=spawnBuilding('farm',1,30,30,true); v.x=31.5;v.y=31.5;setOrder(v,{t:'farm',id:farm.id}); const saved=MatchSave.serialize();MatchSave.restore(saved);const loaded=ent(v.id);for(let i=0;i<40;i++)worldTick(0.05);return loaded.order&&loaded.order.t==='farm'&&loaded.carry&&loaded.carry.amt>0; })()`), true);
});
test('save restores combat and victory settings and in-flight miss tracking', () => {
  assert.equal(run(`(() => { make();CMD.accuracy=false;VIC.wonderTime=180; const p={type:'arrow',x:10,y:10,miss:true};W.projs.push(p);const text=MatchSave.serialize();CMD.accuracy=true;VIC.wonderTime=300;MatchSave.restore(text);const ok=!CMD.accuracy&&VIC.wonderTime===180&&CMD.flying[0]===W.projs[0];applyRules(RULE_DEFAULTS);make();return ok; })()`), true);
});
test('save files cannot replace engine methods', () => {
  assert.equal(run(`(() => { const old=W, s=MatchSave.snapshot(); const gi=s.graph.shapes.findIndex(sh=>sh[0]==='GameMap'); s.graph.shapes[gi].push('computeRegions'); s.graph.nodes.find(n=>n[0]===gi).push('broken'); try{MatchSave.restore(JSON.stringify(s));return false}catch(e){return W===old} })()`), true);
});
test('autosave quota failures report once and leave the match running', () => {
  c.localStorage = { setItem() { throw new Error('quota'); } };
  assert.equal(run(`(() => { W.nextAutosave=W.t;worldTick(0.05);const n=W.msgs.filter(m=>m.text.startsWith('Autosave failed')).length;W.nextAutosave=W.t;worldTick(0.05);return !W.over&&W.autosaveError&&n===1&&W.msgs.filter(m=>m.text.startsWith('Autosave failed')).length===1; })()`), true);
  delete c.localStorage;
});
test('control remaps release old keys and preserve unit commands', () => { assert.equal(run(`(() => { CONTROL_KEYS.pause='p'; UI.cmds=[]; const a=controlKey('p')==='F3'&&controlKey('F3')===''; UI.cmds=[{key:'P'}]; const b=controlKey('p')==='p'; CONTROL_KEYS={...CONTROL_DEFAULTS}; UI.cmds=[]; return a&&b; })()`), true); });
test('converted units clear old owner queue, stance, and defHome, and idle sappers appear in idle worker list', () => {
  assert.equal(run(`(() => { make(); const m=spawnUnit('monk',1,20.5,20.5), k=spawnUnit('knight',2,22.5,20.5); k.queue=[{t:'move',x:5,y:5}]; k.stance='stand'; k.defHome={x:22,y:20}; m.order={t:'convert',id:k.id}; m.convT=11; convertLogic(m,0.05); const s=spawnUnit('sapper',1,18.5,18.5); const idles=typeof exIdleList==='function'?exIdleList('vil'):[]; return k.owner===1&&k.queue.length===0&&k.stance===undefined&&k.defHome===null&&(typeof exIdleList!=='function'||idles.includes(s)); })()`), true);
});
test('save snapshot includes metadata and restores across different wonder/imperial rules', () => {
  assert.equal(run(`(() => { make(); W.players[1].age=3; VIC.wonder=false; VIC.imperial=false; const snap=MatchSave.snapshot(); const lockW=bldLocked(W.players[1],'wonder'), lockI=techLocked(W.players[1],'up_paladin'); const text=JSON.stringify(snap); VIC.wonder=true; VIC.imperial=true; MatchSave.restore(text); const ok=snap.meta&&snap.meta.players===2&&!!lockW&&!!lockI&&!VIC.wonder&&!VIC.imperial&&ED_UNITS.includes('sapper')&&ED_UNITS.includes('paladin'); applyRules(RULE_DEFAULTS); make(); return ok; })()`), true);
});
test('AI simulations do not hide warnings', () => { assert.deepEqual(warnings, []); });
console.log(`${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
