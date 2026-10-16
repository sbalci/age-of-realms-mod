const assert = require('assert/strict');
const { run } = require('./engine-harness')();
let pass=0,fail=0;
const test=(name,fn)=>{try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}};
test('all six ages and their technologies are registered in production menus',()=>{
  assert.equal(run(`AGES.length===6&&AGE_TECHS.length===6&&AGES[5]==='Future Age'&&VIC_ROMAN[5]==='VI'&&TECHS_AT.tc.includes('modernage')&&TECHS_AT.tc.includes('futureage')&&TECHS_AT.university.includes('electronics')`),true);
});
test('modern advancement requires Imperial and two prerequisite buildings, then completes through the queue',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1],tc=W.list.find(e=>e.type==='tc'&&e.owner===1);p.res={food:1e5,wood:1e5,gold:1e5,stone:1e5,coal:1e5};
    const early=!!techLocked(p,'modernage',tc);p.age=3;const noBuildings=!!techLocked(p,'modernage',tc);
    spawnBuilding('university',1,4,4,true);spawnBuilding('siege',1,10,4,true);
    const queued=queueTech(tc,'modernage')===null;updateBuilding(tc,TECHS.modernage.time+.1);
    return early&&noBuildings&&queued&&p.age===4&&p.techs.has('modernage');})()`),true);
});
test('future advancement requires both research prerequisites',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1];p.age=4;p.res={food:1e5,wood:1e5,gold:1e5,stone:1e5,coal:1e5};spawnBuilding('university',1,4,4,true);spawnBuilding('siege',1,10,4,true);
    const before=!!techLocked(p,'futureage');completeTech(p,'industrialization');const one=!!techLocked(p,'futureage');completeTech(p,'electronics');
    const ready=techLocked(p,'futureage')===null;completeTech(p,'futureage');return before&&one&&ready&&p.age===5;})()`),true);
});
test('new units unlock by era and can be trained normally',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1];p.res={food:1e5,wood:1e5,gold:1e5,stone:1e5,coal:1e5};p.popCap=200;const b=spawnBuilding('barracks',1,4,4,true);
    p.age=3;const locked=!!unitLocked(p,'rifleman');p.age=4;const futureLocked=!!unitLocked(p,'plasmaguard');const queued=queueUnit(b,'rifleman')===null;updateBuilding(b,UNITS.rifleman.time+.1);
    return locked&&futureLocked&&queued&&W.list.some(e=>e.type==='rifleman'&&e.owner===1)&&TRAIN.siege.includes('fusionwalker');})()`),true);
});
test('rifling and energy research apply to their intended unit classes',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1];const r=spawnUnit('rifleman',1,20,20),g=spawnUnit('plasmaguard',1,21,20);const ra=statU(r,'atk'),ga=statU(g,'atk');
    completeTech(p,'rifling');const rifle=statU(r,'atk')===ra+3&&statU(g,'atk')===ga;completeTech(p,'energyweapons');return rifle&&statU(g,'atk')===ga+6;})()`),true);
});
test('laser and shell projectiles travel and deal damage',()=>{
  assert.equal(run(`(()=>{make();const u=spawnUnit('railgunner',1,20,20),target=spawnUnit('tank',2,24,20);const hp=target.hp;
    fireProjectile(u,target,'laser',null,{dmgVal:30,srcType:u.type});const fast=W.projs[W.projs.length-1].dur<.2&&W.projs[W.projs.length-1].arc===.02;updateProjectiles(2);
    return fast&&target.hp===hp-30;})()`),true);
});
test('nanorepair repairs only owned vehicles and machines do not age',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1],own=spawnUnit('tank',1,20,20),enemy=spawnUnit('fusionwalker',2,30,30),soldier=spawnUnit('rifleman',1,21,20);
    for(const u of [own,enemy,soldier])u.hp-=10;const a=own.hp,b=enemy.hp,c=soldier.hp;completeTech(p,'nanorepair');GameHooks.emit('beforeTick',1);
    return own.hp===a+1&&enemy.hp===b&&soldier.hp===c&&modLifeSpec('tank')===null&&modLifeSpec('fusionwalker')===null;})()`),true);
});
test('later-age AI production chooses modern and future armies',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[2],ai=new AIPlayer(p,'standard');p.age=4;const modern=ai.adaptTypes('barracks',['militia'])[0]==='rifleman'&&ai.adaptTypes('siege',['ram'])[0]==='tank';p.age=5;return modern&&ai.adaptTypes('range',['archer'])[0]==='railgunner'&&ai.adaptTypes('siege',['ram'])[0]==='fusionwalker';})()`),true);
});
test('Future Age starts contain valid age technologies and save/load retains new units and research',()=>{
  assert.equal(run(`(()=>{make();const spec=W.spec,settings={...W.settings,startAge:5};createWorld(spec,settings);const p=W.players[1];if(p.age!==5||!p.techs.has('futureage')||p.techs.has(undefined))return false;
    completeTech(p,'electronics');completeTech(p,'nanorepair');const u=spawnUnit('fusionwalker',1,20,20);u.hp-=23;const hp=u.hp,text=MatchSave.serialize();MatchSave.restore(text);
    return W.players[1].age===5&&W.players[1].nanoRepair&&W.players[1].techs.has('electronics')&&ent(u.id).type==='fusionwalker'&&ent(u.id).hp===hp;})()`),true);
});
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
