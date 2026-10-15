const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
function setup(){
  const c=vm.createContext({W:{tick:10,map:{version:2}},calls:0,simRandom:()=>.5,
    pathTo(u,rect,r){c.calls++;u.goalRect={...rect};u.goalR=r;u.path=[{x:2,y:2}];u.pi=0;u.pathOk=true;return true;}});
  vm.runInContext(fs.readFileSync('game/js/polish.js','utf8'),c);
  const run=s=>vm.runInContext(s,c);
  run(`var goal={x0:5,y0:5,x1:6,y1:6},u={};pathTo(u,goal,1);PATHB.used=PATHB.perTick;`);
  return {c,run};
}
test('a usable route to the same destination is deferred after the tick budget',()=>{
  const {c,run}=setup();assert.equal(run('pathTo(u,{...goal},1)'),true);assert.equal(c.calls,1);assert.equal(run('PATHB.deferred'),1);assert.ok(run('u.repathT>0'));
});
test('changed destination extent or stopping radius is always served',()=>{
  for(const request of ['{...goal,x1:9},1','{...goal,y1:9},1','goal,2']){
    const {c,run}=setup();run(`pathTo(u,${request})`);assert.equal(c.calls,2);
  }
});
test('terrain edits invalidate cached routes despite an exhausted budget',()=>{
  const {c,run}=setup();run('W.map.version++;pathTo(u,goal,1)');assert.equal(c.calls,2);assert.equal(run('u._pathMapVersion'),3);
});
test('units without a remaining route are always served',()=>{
  for(const state of ['u.path=null','u.pi=u.path.length']){const {c,run}=setup();run(`${state};pathTo(u,goal,1)`);assert.equal(c.calls,2);}
});
test('loading another world at the same tick resets the path budget',()=>{
  const {c,run}=setup();run('W={tick:10,map:{version:2}};pathTo(u,goal,1)');assert.equal(c.calls,2);assert.equal(run('PATHB.used'),1);
});
test('a new simulation tick gets its own path budget',()=>{
  const {c,run}=setup();run('W.tick++;pathTo(u,goal,1)');assert.equal(c.calls,2);assert.equal(run('PATHB.used'),1);
});
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
