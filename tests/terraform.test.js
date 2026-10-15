const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(type,size,seed,np){ const spec=generateMapSpec({size,seed,mapType:type,numPlayers:np});
 const pl=[]; for(let i=0;i<np;i++) pl.push({name:'P'+i,civ:['franks','teutons','britons'][i%3],color:PC[i%3],human:i===0});
 createWorld(spec,{players:pl,seed,fog:'none',startRes:'high',startAge:1}); return spec; }
var USED=new Set();
// find a straight inland run of len dry free tiles that starts next to water (dir: dx,dy), away from bases
function site(len){ const m=W.map, P=W.players[1]; const starts=W.list.filter(e=>e.kind==='bld'&&e.type==='tc');
 for(let y=4;y<m.n-4;y++) for(let x=4;x<m.n-4;x++){ for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const px=x-dx, py=y-dy; if(!isWaterT(m.ter[m.idx(px,py)])) continue;
  const tiles=[]; let ok=true; for(let k=0;k<len;k++){ const tx=x+dx*k, ty=y+dy*k; const i=m.idx(tx,ty);
    if(tx<2||ty<2||tx>=m.n-2||ty>=m.n-2||(m.ter[i]!==T.GRASS&&m.ter[i]!==T.SAND&&m.ter[i]!==T.DIRT)||m.blk[i]||USED.has(i)||m.elev[i]>1){ok=false;break;} if(starts.some(s=>Math.hypot(s.x-tx,s.y-ty)<12)){ok=false;break;} // no water neighbours besides first
    if(k>0) for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]) if(isWaterT(m.ter[m.idx(tx+ax,ty+ay)])){ok=false;} if(!ok)break; tiles.push({x:tx,y:ty}); }
  if(ok&&tiles.length===len){ tiles.forEach(q=>USED.add(m.idx(q.x,q.y))); return {tiles,shore:{x:px,y:py}}; } } } return null; }
function vill(x,y){ return spawnUnit('villager',1,x+0.5,y+0.5); }
function runUntil(fn,secs){ let t=0; while(t<secs && !fn()){ worldTick(0.05); t+=0.05; } return t; }
mk('land','small',11,2); for(let i=0;i<60;i++) worldTick(0.05);`);
const A = run(`(() => { for (const e of W.list.slice()) if (e.kind === 'unit' && (e.type === 'wolf' || e.type === 'boar')) removeEnt(e);   // a long detour past wolves is not what this checks
  const s=site(5); if(!s) return {nosite:true}; const m=W.map; const p=W.players[1];
  const a=s.tiles[0], b=s.tiles[4]; const plan=terraPlan('canal',a,b); const v=vill(a.x-(a.x-s.shore.x), a.y-(a.y-s.shore.y));
  v.x=s.shore.x+0.5; v.y=s.shore.y+0.5; // never mind: shore is water; stand beside the first tile instead
  v.x=a.x+0.5; v.y=a.y+1.5; terraOrder([v],'canal',plan.keep);
  const t=runUntil(()=>!v.order,200);
  const done=s.tiles.every(q=>isWaterT(m.ter[m.idx(q.x,q.y)])&&m.elev[m.idx(q.x,q.y)]===0);
  const body=waterBodyAt(m,b.x,b.y), shore=waterBodyAt(m,s.shore.x,s.shore.y);
  return {keep:plan.keep.length, done, secs:+t.toFixed(1), merged: !!body&&body===shore}; })()`);
ok('canal dug tile by tile, joins the water body', !A.nosite && A.keep === 5 && A.done && A.merged, A);
const B = run(`(() => { const s=site(5); if(!s) return {nosite:true}; const m=W.map;
  const a=s.tiles[4], b=s.tiles[0]; const plan=terraPlan('canal',a,b); // dragged inland to shore
  return {keep:plan.keep.length, firstIsShore:plan.keep[0].x===s.tiles[0].x&&plan.keep[0].y===s.tiles[0].y}; })()`);
ok('canal dragged from the inland end is reordered', !B.nosite && B.keep === 5 && B.firstIsShore, B);
const C = run(`(() => { const out={}; for(const n of [1,3]){ const s=site(6); if(!s) return {nosite:true}; const m=W.map; const plan=terraPlan('canal',s.tiles[0],s.tiles[5]);
  const vs=[]; for(let k=0;k<n;k++) vs.push(vill(s.tiles[0].x,s.tiles[0].y+1+k)); terraOrder(vs,'canal',plan.keep);
  out['t'+n]=+runUntil(()=>vs.every(v=>!v.order),300).toFixed(1); out['ok'+n]=s.tiles.every(q=>isWaterT(m.ter[m.idx(q.x,q.y)])); } return out; })()`);
ok('villagers share a job (3 faster than 1, no tile dug twice)', C.ok1 && C.ok3 && C.t3 < C.t1 * 0.7, C);
const D = run(`(() => { const m=W.map, P=W.players[1]; let sp=null;
  for(let y=6;y<m.n-6&&!sp;y++) for(let x=6;x<m.n-6&&!sp;x++){ let ok=true; for(let k=0;k<4;k++){ const i=m.idx(x+k,y); if(m.ter[i]!==T.GRASS||m.blk[i]||USED.has(i)||m.elev[i]!==0) ok=false; } if(ok) sp={x,y}; }
  const tiles=[0,1,2,3].map(k=>({x:sp.x+k,y:sp.y})); tiles.forEach(q=>USED.add(m.idx(q.x,q.y)));
  const plan=terraPlan('trench',tiles[0],tiles[3]); const v=vill(sp.x,sp.y+1); terraOrder([v],'trench',plan.keep); runUntil(()=>!v.order,100);
  const flagged=tiles.every(q=>m.trench&&m.trench[m.idx(q.x,q.y)]);
  const knight=spawnUnit('knight',1,sp.x+0.5,sp.y+2.5), vil=vill(sp.x+4,sp.y+2);
  const idx=m.idx(sp.x+1,sp.y); const kPass=unitPass(knight)(idx), vPass=unitPass(vil)(idx);
  const inTrench=vill(sp.x+1,sp.y); const sp0=UNITS.villager.speed; const sp1=sp0+statU(inTrench,'speed'); const pa0=UNITS.villager.pa||0, pa1=statU(inTrench,'pa');
  const outside=vill(sp.x+1,sp.y+3); const spOut=sp0+statU(outside,'speed');
  return {flagged,kPass,vPass,speedIn:+sp1.toFixed(2),speedOut:+spOut.toFixed(2),paIn:pa1,paOut:statU(outside,'pa')}; })()`);
ok('trench: flagged, blocks cavalry only, slows and armours units inside', D.flagged && !D.kPass && D.vPass && D.speedIn < D.speedOut * 0.7 && D.paIn === D.paOut + 2, D);
const E = run(`(() => { const m=W.map, P=W.players[1]; let sp=null;
  for(let y=6;y<m.n-6&&!sp;y++) for(let x=6;x<m.n-6&&!sp;x++){ let ok=true; for(let a=0;a<2;a++)for(let b=0;b<2;b++){ const i=m.idx(x+a,y+b); if(m.ter[i]!==T.GRASS||m.blk[i]||USED.has(i)||m.elev[i]!==0) ok=false; } if(ok) sp={x,y}; }
  const t4=[]; for(let a=0;a<2;a++)for(let b=0;b<2;b++){ t4.push({x:sp.x+a,y:sp.y+b}); USED.add(m.idx(sp.x+a,sp.y+b)); }
  P.res.stone=100; const v=vill(sp.x-1,sp.y); terraOrder([v],'raise',terraRect(t4[0],t4[3])); runUntil(()=>!v.order,200);
  const raised=t4.every(q=>m.elev[m.idx(q.x,q.y)]===1), stoneAfter=P.res.stone;
  // not enough stone: nothing happens
  P.res.stone=5; const v2=vill(sp.x-1,sp.y); terraOrder([v2],'raise',terraRect(t4[0],t4[3])); runUntil(()=>!v2.order,100);
  const unchanged=t4.every(q=>m.elev[m.idx(q.x,q.y)]===1), stone5=P.res.stone;
  // two levels up becomes a cliff
  P.res.stone=500; const v3=vill(sp.x-1,sp.y); terraOrder([v3],'raise',[t4[0]]); runUntil(()=>!v3.order,100); const v4=vill(sp.x-1,sp.y); terraOrder([v4],'raise',[t4[0]]); runUntil(()=>!v4.order,100);
  const e0=m.elev[m.idx(t4[0].x,t4[0].y)]; const cliff=!m.canStep(t4[0].x,t4[0].y,t4[0].x-1,t4[0].y)||!m.canStep(t4[0].x,t4[0].y,t4[0].x,t4[0].y-1);
  // dig it back down
  const v5=vill(sp.x-1,sp.y); const st0=P.res.stone; terraOrder([v5],'dig',[t4[0]]); runUntil(()=>!v5.order,200);
  return {raised, stoneAfter, unchanged, stone5, e0, cliff, flat:m.elev[m.idx(t4[0].x,t4[0].y)], gained:P.res.stone-st0}; })()`);
ok('raise costs stone, refuses without stone, two-level step is a cliff', E.raised && E.stoneAfter === 60 && E.unchanged && E.stone5 === 5 && E.e0 === 3 && E.cliff, E);
ok('dig mountain: back to flat, stone recovered per level', E.flat === 0 && E.gained === 45, E);
const F = run(`(() => { const m=W.map; let sp=null;
  for(let y=6;y<m.n-6&&!sp;y++) for(let x=6;x<m.n-6&&!sp;x++){ let ok=true; for(let a=0;a<3;a++)for(let b=0;b<3;b++){ const i=m.idx(x+a,y+b); if(m.ter[i]!==T.GRASS||m.blk[i]||USED.has(i)) ok=false; } if(ok) sp={x,y}; }
  const t=[]; for(let a=0;a<3;a++)for(let b=0;b<3;b++){ t.push({x:sp.x+a,y:sp.y+b}); USED.add(m.idx(sp.x+a,sp.y+b)); }
  const vs=[vill(sp.x-1,sp.y),vill(sp.x-1,sp.y+1),vill(sp.x-1,sp.y+2)]; terraOrder(vs,'plant',t); runUntil(()=>vs.every(v=>!v.order),100);
  const trees=W.list.filter(e=>e.kind==='res'&&e.type==='tree'&&e.sap&&e.x>=sp.x&&e.x<sp.x+3&&e.y>=sp.y&&e.y<sp.y+3);
  const small=trees.every(e=>e.amount<60); for(let i=0;i<20*160;i++) worldTick(0.05);
  const grown=trees.every(e=>!e.sap&&e.amount===e.max); const blkOk=t.every(q=>m.blk[m.idx(q.x,q.y)]);
  return {planted:trees.length, small, grown, blkOk, floor:m.ter[m.idx(sp.x,sp.y)]===T.FOREST}; })()`);
ok('planting: nine saplings that mature into gatherable trees', F.planted === 9 && F.small && F.grown && F.blkOk && F.floor, F);
const G = run(`(() => { const m=W.map; const tree=W.list.find(e=>e.kind==='res'&&e.type==='tree'); const tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc');
  return { tree: terraCheck('trench',tree.x,tree.y), bld: terraCheck('canal',tc.x,tc.y), edge: terraCheck('trench',0,5), water: terraCheck('raise',...(()=>{ for(let i=0;i<m.n*m.n;i++) if(m.ter[i]===T.WATER&&i%m.n>3&&i%m.n<m.n-3&&((i/m.n)|0)>3&&((i/m.n)|0)<m.n-3) return [i%m.n,(i/m.n)|0]; })()) }; })()`);
ok('blocked tiles are refused', G.tree === 'Something is in the way' && G.bld && G.bld !== null && G.edge === 'Edge of the map' && G.water === 'Not dry land', G);
const H = run(`(() => { const s=site(6); if(!s) return {nosite:true}; const m=W.map; const plan=terraPlan('canal',s.tiles[0],s.tiles[5]);
  const a=vill(s.tiles[0].x,s.tiles[0].y+1), b=vill(s.tiles[0].x+1,s.tiles[0].y+1); terraOrder([a,b],'canal',plan.keep);
  runUntil(()=>false,9); setOrder(a,null); const claimsLeak=plan.keep.length; // a leaves mid-tile
  runUntil(()=>!b.order,300); return {done:s.tiles.every(q=>isWaterT(m.ter[m.idx(q.x,q.y)]))}; })()`);
ok('a villager pulled off a job does not strand its tile', H.done, H);
// regions stay consistent with a fresh recompute
const I = run(`(() => { const m=W.map; const a=Array.from(m.landReg), b=Array.from(m.waterReg); m.computeRegions(); return JSON.stringify(a)===JSON.stringify(Array.from(m.landReg))&&JSON.stringify(b)===JSON.stringify(Array.from(m.waterReg)); })()`);
ok('region maps match a fresh recompute after all edits', I);
// soak: AI game, random terra jobs, no exceptions
const S = run(`(() => { mk('coastal','small',8,3); for(let i=1;i<W.players.length;i++) W.players[i].ai=new AIPlayer(W.players[i],'standard'); USED.clear(); let err=null, jobs=0;
  try { for(let i=0;i<20*60*6;i++){ worldTick(0.05); if(i%400===0){ const vs=W.list.filter(e=>e.kind==='unit'&&e.type==='villager'&&e.owner===1); const m=W.map;
    for(const op of ['canal','trench','raise','dig','plant']){ if(!vs.length) break; const x=(6+Math.random()*(m.n-12))|0,y=(6+Math.random()*(m.n-12))|0; const plan=terraPlan(op,{x,y},{x:x+((Math.random()*5)|0),y:y+((Math.random()*5)|0)}); if(plan.keep.length){ terraOrder(vs.slice(0,2),op,plan.keep); jobs++; } } } } } catch(e){ err=e.stack; }
  const m=W.map; const a=Array.from(m.landReg); m.computeRegions(); return {err,jobs,same:JSON.stringify(a)===JSON.stringify(Array.from(m.landReg))}; })()`);
ok('6 min soak with AI and random terraforming, no exceptions', !S.err && S.jobs > 3 && S.same, S);
console.log(`\n${pass} passed, ${fail} failed`);
