const assert=require('assert/strict');
const {run}=require('./engine-harness')();let pass=0,fail=0;
const test=(name,fn)=>{try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}};
run(`function mineScene(height=0,depth=1){make();for(const e of W.list.slice())if(e.x>=14&&e.x<26&&e.y>=14&&e.y<26)removeEnt(e);for(let y=14;y<26;y++)for(let x=14;x<26;x++){const i=W.map.idx(x,y);W.map.ter[i]=T.GRASS;W.map.elev[i]=0;W.map.blk[i]=0;}W.map.elev[W.map.idx(20,20)]=height;W.map.computeVH();W.map.computeRegions();const seam=spawnRes('coal',20,20,0,depth),worker=spawnUnit('villager',1,19.5,20.5);return {seam,worker,p:W.players[1]};}`);
test('three real-world presets retain geographic shorelines across seeds and support 2–8 players',()=>{
  assert.equal(run(`(()=>{for(const mapType of Object.keys(REAL_MAPS))for(const size of Object.keys(MAP_SIZES))for(const numPlayers of [2,8]){
    const a=generateMapSpec({mapType,size,numPlayers,seed:1}),b=generateMapSpec({mapType,size,numPlayers,seed:2});if(validateMapSpec(a).length||a.players.length!==numPlayers||a.name!==REAL_MAPS[mapType].name)return false;
    if(a.ter.some((v,i)=>isWaterT(v)!==isWaterT(b.ter[i])))return false;
    for(const p of a.players)for(let y=p.start.y-2;y<=p.start.y+3;y++)for(let x=p.start.x-2;x<=p.start.x+2;x++)if(isWaterT(a.ter[y*a.n+x]))return false;
    const m=new GameMap(a.n);m.ter.set(a.ter);m.elev.set(a.elev);m.computeRegions();
    for(const p of a.players)for(const [k,min]of [['gold',4],['stone',3],['berry',6],['tree',20]])if(a.objects.filter(o=>o.k===k&&m.landReg[o.y*a.n+o.x]===m.landReg[p.start.y*a.n+p.start.x]&&Math.hypot(o.x-p.start.x,o.y-p.start.y)<=12).length<min)return false;
    if(a.objects.filter(o=>o.k==='coal').length!==numPlayers*3)return false;
  }return true;})()`),true);
});
test('geographic landmarks put Anatolia, Rome, Africa and the Americas on land and seas on water',()=>{
  assert.equal(run(`(()=>{const checks={anatolia:[[33,39,1],[38,38,1],[33,42,0],[30,35.5,0]],mediterranean:[[12.5,42,1],[2,34,1],[18,34,0]],world:[[-100,40,1],[-60,-10,1],[20,5,1],[100,40,1],[-30,0,0],[160,0,0]]};for(const [type,points]of Object.entries(checks)){const m=geographyMask(type);for(const [lon,lat,land]of points){const q=geographyPoint(type,256,lon,lat);if(m[(q.y|0)*256+(q.x|0)]!==land)return false;}}return true;})()`),true);
});
test('buried deposits cannot gather, block the surface, or be selected by resource search',()=>{
  assert.equal(run(`(()=>{const {seam,worker,p}=mineScene();const before=p.res.coal;worker.order={t:'gather',id:seam.id};gatherLogic(worker,100);return !mineAccessible(seam)&&!W.map.blk[W.map.idx(20,20)]&&!worker.carry&&p.res.coal===before&&!findNearestRes(worker,['coal'],20,20,1);})()`),true);
});
test('right-click mining orders excavate flat ground then switch to gathering',()=>{
  assert.equal(run(`(()=>{const {seam,worker,p}=mineScene();setOrder(worker,{t:'gather',id:seam.id});if(worker.order.t!=='terra')return false;terraLogic(worker,6);terraLogic(worker,.1);const opened=mineAccessible(seam)&&W.map.excavated[W.map.idx(20,20)]===1&&worker.order.t==='gather';gatherLogic(worker,2);return opened&&worker.carry?.res==='coal'&&worker.carry.amt>0;})()`),true);
});
test('mountain removal alone leaves the seam sealed until its ground cover is excavated',()=>{
  assert.equal(run(`(()=>{const {seam,p}=mineScene(2,2);if(terraApply('dig',20,20,p)||mineAccessible(seam))return false;terraApply('dig',20,20,p);if(mineAccessible(seam)||mineDigRemaining(20,20)!==2)return false;terraApply('dig',20,20,p);if(mineAccessible(seam))return false;terraApply('dig',20,20,p);return mineAccessible(seam)&&mineDigRemaining(20,20)===0&&terraCheck('dig',20,20)==='Already level';})()`),true);
});
test('connected tunnels open mountain mines; isolated bores do not',()=>{
  assert.equal(run(`(()=>{const {seam,p}=mineScene(3,2);terraApply('tunnel',20,20,p);if(mineAccessible(seam))return false;W.map.elev[W.map.idx(19,20)]=1;terraApply('tunnel',19,20,p);if(!mineAccessible(seam))return false;W.map.tun[W.map.idx(19,20)]=0;W.map.mineRevision++;return !mineAccessible(seam);})()`),true);
});
test('flooding or raising ground reseals excavated deposits',()=>{
  assert.equal(run(`(()=>{const {seam,p}=mineScene();terraApply('dig',20,20,p);if(!mineAccessible(seam))return false;terraApply('raise',20,20,p);if(mineAccessible(seam))return false;terraApply('dig',20,20,p);W.map.ter[W.map.idx(20,20)]=T.WATER;return !mineAccessible(seam);})()`),true);
});
test('blocking the only tunnel entrance closes access and removing the blocker reopens it',()=>{
  assert.equal(run(`(()=>{const {seam,p}=mineScene(3,2);for(const [x,y]of [[20,19],[21,20],[20,21],[19,19],[18,20],[19,21]])W.map.elev[W.map.idx(x,y)]=4;W.map.elev[W.map.idx(19,20)]=1;W.map.elev[W.map.idx(18,20)]=0;terraApply('tunnel',20,20,p);terraApply('tunnel',19,20,p);if(!mineAccessible(seam))return false;const tree=spawnRes('tree',18,20);if(mineAccessible(seam))return false;removeEnt(tree);return mineAccessible(seam);})()`),true);
});
test('coal deposits deplete and coal can be deposited at mining camps and town centers',()=>{
  assert.equal(run(`(()=>{const {seam,worker,p}=mineScene();terraApply('dig',20,20,p);seam.amount=.1;worker.order={t:'gather',id:seam.id};gatherLogic(worker,2);const before=p.res.coal;deposit(worker);return seam.dead&&p.res.coal>before&&BUILDINGS.tc.drop.includes('coal')&&BUILDINGS.miningcamp.drop.includes('coal')&&vicStats(p).gathered.coal>0;})()`),true);
});
test('industrial improvements require and consume coal; missing resource keys cannot bypass payment',()=>{
  assert.equal(run(`(()=>{mineScene();const p=W.players[1];p.age=4;p.res={food:1e4,wood:1e4,gold:1e4,stone:1e4,coal:0};const b=spawnBuilding('university',1,14,14,true),cost=effCost(p,'industrialization',true);const locked=queueTech(b,'industrialization')!==null;delete p.res.coal;const missing=!canPay(p,cost);p.res.coal=200;const queued=queueTech(b,'industrialization')===null;return locked&&missing&&queued&&p.res.coal===0&&['modernage','rifling','compositearmor'].every(id=>TECHS[id].cost.coal>0);})()`),true);
});
test('coal market trading supports older maps without seams',()=>{
  assert.equal(run(`(()=>{mineScene();const p=W.players[1];spawnBuilding('market',1,14,14,true);p.res.gold=1000;const bought=marketTrade(p,'coal',true)===null&&p.res.coal===100&&p.res.gold===820;return bought&&marketTrade(p,'coal',false)===null&&p.res.coal===0&&Number.isFinite(p.res.gold);})()`),true);
});
test('AI ratios stay finite in all ages and Imperial AI excavates coal',()=>{
  assert.equal(run(`(()=>{const {worker,seam,p}=mineScene();const ai=new AIPlayer(p,'standard');for(let age=0;age<6;age++){p.age=age;if(RES.some(r=>!Number.isFinite(ai.ratios()[r])))return false;}p.age=3;return ai.ratios().coal>0&&ai.assign(worker,'coal')&&worker.order.t==='terra'&&ai.vTask(worker)==='coal';})()`),true);
});
test('disabling terraforming blocks sealed-mine income',()=>{
  assert.equal(run(`(()=>{const {seam,worker}=mineScene();TERRA.enabled=false;setOrder(worker,{t:'gather',id:seam.id});const result=!worker.order&&!worker.carry;TERRA.enabled=true;return result;})()`),true);
});
test('mine depths, excavation, coal and automatic excavation jobs survive saves and editor export',()=>{
  assert.equal(run(`(()=>{const {seam,worker,p}=mineScene(1,2);setOrder(worker,{t:'gather',id:seam.id});p.res.coal=87;terraApply('dig',20,20,p);terraApply('dig',20,20,p);const text=MatchSave.serialize();MatchSave.restore(text);const s=ent(seam.id),u=ent(worker.id);if(s.depth!==2||W.players[1].res.coal!==87||mineDigRemaining(20,20)!==1||u.order.job.mineId!==s.id)return false;Editor.players=W.spec.players.map(p=>({...p,civ:'franks',color:0}));const spec=Editor.toSpec();return !validateMapSpec(spec).length&&spec.objects.some(o=>o.k==='coal'&&o.depth===2)&&spec.excavated[W.map.idx(20,20)]===1;})()`),true);
});
test('older saves gain coal defaults without changing existing balances',()=>{
  assert.equal(run(`(()=>{make();const wood=W.players[1].res.wood;for(const p of W.players)if(p){delete p.res.coal;delete p.gather.coal;}delete W.market.coal;const text=MatchSave.serialize();MatchSave.restore(text);return W.players.every(p=>!p||p.res.coal===0&&p.gather.coal===1)&&W.market.coal===180&&W.players[1].res.wood===wood;})()`),true);
});
test('invalid mine depths and excavation layers are rejected',()=>{
  assert.equal(run(`(()=>{make();const s=JSON.parse(JSON.stringify(W.spec));s.objects.push({k:'coal',x:20,y:20,depth:5});const badDepth=validateMapSpec(s).length>0;s.objects.pop();s.excavated=Array(s.n*s.n).fill(9);return badDepth&&validateMapSpec(s).length>0;})()`),true);
});
test('one in ten villagers rolls vows and converts only on becoming elderly, including Turkish Imams',()=>{
  assert.equal(run(`(()=>{make();if(MOD.vowShare!==.1||MOD.life.villagerVows!==MOD.life.villager*BAL.elderShare)return false;let vows=0;for(let k=0;k<5000;k++){const u={type:'villager',owner:1};modLimits(u);vows+=!!u.vows;}if(vows<400||vows>600)return false;const v=spawnUnit('villager',2,20,20);v.lifeK=1;v.vows=true;v.bornT=W.t-MOD.life.villagerVows+.1;modAgeTick(v);if(v.type!=='villager')return false;v.bornT-=.2;modAgeTick(v);return v.type==='monk'&&isImam(v)&&v.vowsTaken;})()`),true);
});
test('Wonders have six age forms and advance without resetting construction, health or victory time',()=>{
  assert.equal(run(`(()=>{make();const p=W.players[1],w=spawnBuilding('wonder',1,14,14,true);w.hp=1500;w.wonderT=123;const names=new Set(),styles=new Set();for(let age=0;age<6;age++){p.age=age;names.add(wonderName(p));styles.add(bldStyle(w));}const before=w.wonderT;p.age=3;completeTech(p,'modernage');return names.size===6&&styles.size===6&&bldStyle(w)===4&&w.wonderT===before&&w.hp===1500&&BUILDINGS.wonder.age===0;})()`),true);
});
console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
