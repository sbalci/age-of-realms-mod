const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const load = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js');
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(type,size,seed,np){ const spec=generateMapSpec({size,seed,mapType:type,numPlayers:np});
 const pl=[]; for(let i=0;i<np;i++) pl.push({name:'P'+i,civ:['franks','teutons','britons'][i%3],color:PC[i%3],human:i===0});
 createWorld(spec,{players:pl,seed,fog:'none',startRes:'high',startAge:1}); return spec; }
var USED=new Set();
function area(w,h){ const m=W.map; const starts=W.list.filter(e=>e.kind==='bld'&&e.type==='tc');
 for(let y=6;y<m.n-h-6;y++) for(let x=6;x<m.n-w-6;x++){ let ok=true;
  for(let b=-1;b<=h&&ok;b++) for(let a=-1;a<=w;a++){ const i=m.idx(x+a,y+b); if((m.ter[i]!==T.GRASS&&m.ter[i]!==T.DIRT)||m.blk[i]||USED.has(i)||m.elev[i]!==0){ok=false;break;} }
  if(ok&&!starts.some(s=>Math.hypot(s.x-x,s.y-y)<14)){ for(let b=-1;b<=h;b++)for(let a=-1;a<=w;a++)USED.add(m.idx(x+a,y+b)); return {x,y}; } } return null; }
function vill(x,y,t){ return spawnUnit(t||'villager',1,x+0.5,y+0.5); }
function runUntil(fn,secs){ let t=0; while(t<secs && !fn()){ worldTick(0.05); t+=0.05; } return t; }
mk('land','large',11,2); for(let i=0;i<60;i++) worldTick(0.05);`);
// ---- monk share
const M = run(`(() => { let v=0, n=400; for(let i=0;i<n;i++){ const u=spawnUnit('villager',1,5.5,5.5); if(modLimits(u).vows>0) v++; removeEnt(u); } return {share:v/n}; })()`);
ok('about one villager in five is destined for vows', M.share > 0.14 && M.share < 0.26, M);
const M2 = run(`(() => { const a=spawnUnit('villager',1,5.5,5.5); a.lifeK=1; a.vows=true; a.bornT=W.t-1000; modAgeTick(a);
  const b=spawnUnit('villager',1,6.5,5.5); b.lifeK=1; b.vows=false; b.bornT=W.t-1000; modAgeTick(b); return {a:a.type,b:b.type}; })()`);
ok('vow-bound villager becomes a monk, others keep working', M2.a === 'monk' && M2.b === 'villager', M2);
// ---- bridge over a ring moat
const B = run(`(() => { const sp=area(7,7); const m=W.map, P=W.players[1]; P.res.wood=500;
  for(let a=0;a<7;a++)for(let b=0;b<7;b++){ if(a===0||b===0||a===6||b===6){ m.ter[m.idx(sp.x+a,sp.y+b)]=T.WATER; } }
  m.computeVH(); m.computeRegions();
  const inside={x:sp.x+3,y:sp.y+3}, outside={x:sp.x+3,y:sp.y-1}, deck={x:sp.x+3,y:sp.y};
  const split=m.landReg[m.idx(inside.x,inside.y)]!==m.landReg[m.idx(outside.x,outside.y)];
  const v=vill(inside.x,inside.y); const plan=terraPlan('bridge',inside,outside); // drag across, land tiles skipped
  terraOrder([v],'bridge',plan.keep); const t=runUntil(()=>!v.order,60);
  const built=!!(m.bridge&&m.bridge[m.idx(deck.x,deck.y)]);
  const joined=m.landReg[m.idx(inside.x,inside.y)]===m.landReg[m.idx(outside.x,outside.y)];
  const walker=vill(outside.x,outside.y); const r=findPath(m,walker.x|0,walker.y|0,{x0:inside.x,y0:inside.y,x1:inside.x,y1:inside.y,r:0},unitPass(walker));
  const ship=passNaval()(m.idx(deck.x,deck.y)); const waterStill=isWaterT(m.ter[m.idx(deck.x,deck.y)]);
  const place=canPlace(P,'dock',deck.x,deck.y,true);
  return {keep:plan.keep.length,split,built,joined,pathOk:r.ok,ship,waterStill,place,woodSpent:500-P.res.wood,sp}; })()`);
ok('bridge: one tile on a moat joins island and mainland, costs wood, ships still pass', B.keep === 1 && B.split && B.built && B.joined && B.pathOk && B.ship && B.waterStill && B.woodSpent === 15 && /bridge/i.test(B.place || ''), B);
// unbridge: refunds, splits again, moves the walker off the span
const U = run(`(() => { const sp=${JSON.stringify(B.sp)}, m=W.map, P=W.players[1];
  const deck={x:sp.x+3,y:sp.y}, inside={x:sp.x+3,y:sp.y+3}, outside={x:sp.x+3,y:sp.y-1};
  const stander=vill(deck.x,deck.y); const w0=P.res.wood; const v=vill(inside.x,inside.y);
  terraOrder([v],'unbridge',[deck]); runUntil(()=>!v.order,60);
  const gone=!m.bridge[m.idx(deck.x,deck.y)]; const split=m.landReg[m.idx(inside.x,inside.y)]!==m.landReg[m.idx(outside.x,outside.y)];
  const off=!isWaterT(m.ter[m.idx(stander.x|0,stander.y|0)]);
  return {gone,split,off,refund:P.res.wood-w0}; })()`);
ok('unbridge: tile removed, regions split, refund, walker moved to the bank', U.gone && U.split && U.off && U.refund === 8, U);
// ---- tunnel through a plateau
const T1 = run(`(() => { const sp=area(7,5), m=W.map, P=W.players[1]; P.res.stone=200;
  for(let a=1;a<=5;a++)for(let b=1;b<=3;b++) m.elev[m.idx(sp.x+a,sp.y+b)]=3;   // plateau, cliffs all round
  m.computeVH(); m.computeRegions();
  const out={x:sp.x,y:sp.y+2}, edge={x:sp.x+1,y:sp.y+2}, inner={x:sp.x+3,y:sp.y+2};
  const split=m.landReg[m.idx(out.x,out.y)]!==m.landReg[m.idx(inner.x,inner.y)];
  const vil=vill(out.x,out.y-1); const planV=terraPlan('tunnel',out,edge);
  terraOrder([vil],'tunnel',planV.keep); runUntil(()=>!vil.order,40);
  const villagerDug=!!(m.tun&&m.tun[m.idx(out.x,out.y)]);
  const sap=vill(out.x,out.y-1,'sapper'); const plan=terraPlan('tunnel',out,{x:sp.x+2,y:sp.y+2});
  const s0=P.res.stone; terraOrder([sap],'tunnel',plan.keep); const t=runUntil(()=>!sap.order,80);
  const dug=plan.keep.every(q=>m.tun[m.idx(q.x,q.y)]);
  const joined=m.landReg[m.idx(out.x,out.y)]===m.landReg[m.idx(inner.x,inner.y)];
  const walker=vill(out.x,out.y-1); const r=findPath(m,walker.x|0,walker.y|0,{x0:inner.x,y0:inner.y,x1:inner.x,y1:inner.y,r:0},unitPass(walker));
  const place=canPlace(P,'house',edge.x,edge.y,true);
  const long=terraPlan('tunnel',{x:sp.x,y:sp.y+2},{x:sp.x+6,y:sp.y+2}).tiles.length;
  return {planV:planV.keep.length,villagerDug,n:plan.keep.length,dug,split,joined,pathOk:r.ok,stone:s0-P.res.stone,secs:+t.toFixed(1),place,long}; })()`);
ok('tunnel: villagers cannot dig it, a sapper can, it joins the plateau, 5 stone per tile', T1.split && !T1.villagerDug && T1.dug && T1.joined && T1.pathOk && T1.stone === 5 * T1.n && /tunnel/i.test(T1.place || ''), T1);
const T2 = run(`(() => { const sp=area(14,3), m=W.map; const tiles=terraPlan('tunnel',{x:sp.x,y:sp.y+1},{x:sp.x+13,y:sp.y+1}).tiles.length; return {tiles}; })()`);
ok('tunnel length capped', T2.tiles === 12, T2);
// ---- sapper availability
const S1 = run(`(() => { const p=W.players[1]; const mc=spawnBuilding('miningcamp',1,30,30,true); const a=TRAIN.miningcamp.includes('sapper'); const err=queueUnit(mc,'sapper'); return {a,err,q:mc.queue.length, d:UNITS.sapper.draw}; })()`);
ok('mining camp trains sappers', S1.a && !S1.err && S1.q === 1, S1);
// sappers dig mountains faster
const S2 = run(`(() => { const sp=area(2,1), m=W.map, P=W.players[1]; m.elev[m.idx(sp.x,sp.y)]=3; m.elev[m.idx(sp.x+1,sp.y)]=3;
  const v=vill(sp.x,sp.y+1), s=vill(sp.x+1,sp.y+1,'sapper');
  terraOrder([v],'dig',[{x:sp.x,y:sp.y}]); terraOrder([s],'dig',[{x:sp.x+1,y:sp.y}]);
  let tv=0,ts=0; for(let t=0;t<120;t+=0.05){ worldTick(0.05); if(!v.order&&!tv)tv=t; if(!s.order&&!ts)ts=t; if(tv&&ts)break; }
  return {tv:+tv.toFixed(1),ts:+ts.toFixed(1)}; })()`);
ok('sapper digs faster than a villager', S2.ts > 0 && S2.ts < S2.tv * 0.85, S2);
// regions equal fresh recompute
const R = run(`(() => { const m=W.map; const a=JSON.stringify(Array.from(m.landReg)); m.computeRegions(); return a===JSON.stringify(Array.from(m.landReg)); })()`);
ok('regions match a fresh recompute', R);
// soak
const S = run(`(() => { mk('coastal','small',8,3); for(let i=1;i<W.players.length;i++) W.players[i].ai=new AIPlayer(W.players[i],'standard'); USED.clear(); let err=null, jobs=0;
  try { for(let i=0;i<20*60*5;i++){ worldTick(0.05); if(i%300===0){ const m=W.map; W.players[1].res.wood=999; W.players[1].res.stone=999;
    for(const op of ['bridge','tunnel','canal','dig']){ const type=op==='tunnel'?'sapper':'villager'; const vs=W.list.filter(e=>e.kind==='unit'&&e.type===type&&e.owner===1); const v=vs.length?vs[0]:spawnUnit(type,1,10.5,10.5);
      const x=(6+Math.random()*(m.n-12))|0,y=(6+Math.random()*(m.n-12))|0; const plan=terraPlan(op,{x,y},{x:x+((Math.random()*8)|0)-4,y:y+((Math.random()*8)|0)-4}); if(plan.keep.length){ terraOrder([v],op,plan.keep); jobs++; } } } } } catch(e){ err=e.stack; }
  const m=W.map; const a=JSON.stringify(Array.from(m.landReg)); m.computeRegions(); return {err,jobs,bridges:m.bridge?m.bridge.reduce((s,v)=>s+v,0):0,same:a===JSON.stringify(Array.from(m.landReg))}; })()`);
ok('5 min soak with bridges/tunnels/canals, no exceptions', !S.err && S.jobs > 3 && S.same, S);
console.log(`\n${pass} passed, ${fail} failed`);
