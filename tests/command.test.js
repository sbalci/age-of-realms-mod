// Headless tests for game/js/command.js: node tests/command.test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '', keys: new Set() } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('command.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`MOD.aging=false; WELLM.enabled=false;
var MISSES=[]; var window={ onArrowMiss: f => MISSES.push(f) };
var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
const spec=generateMapSpec({size:'medium',seed:3,mapType:'land',numPlayers:2});
createWorld(spec,{players:[{name:'P0',civ:'franks',color:PC[0],human:true},{name:'P1',civ:'teutons',color:PC[1]}],seed:3,fog:'none',startRes:'high',startAge:2});
for(let i=0;i<20;i++) worldTick(0.05);
var USED=new Set();
// carve a flat, empty grass arena far from both bases so every scenario has room
(function(){ const m=W.map, tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc'), A=48; let best=null, bd=-1;
  for(let y=1;y+A<m.n-1;y+=3) for(let x=1;x+A<m.n-1;x+=3){ const d=Math.min(...tcs.map(t=>Math.max(Math.max(t.x-(x+A),x-(t.x+4),0),Math.max(t.y-(y+A),y-(t.y+4),0)))); if(d>bd){bd=d;best={x,y};} }
  for(const e of W.list.slice()) if(e.kind!=='bld'&&e.x>=best.x-1&&e.x<best.x+A+1&&e.y>=best.y-1&&e.y<best.y+A+1) removeEnt(e);
  for(let y=best.y;y<best.y+A;y++) for(let x=best.x;x<best.x+A;x++){ const i=m.idx(x,y); m.ter[i]=T.GRASS; m.elev[i]=0; m.blk[i]=0; }
  m.computeVH(); m.computeRegions(); W.arena=best; })();
// w x h block of flat free grass far from bases
function open(w,h){ const m=W.map, tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc');
  for(let y=3;y<m.n-h-3;y++) for(let x=3;x<m.n-w-3;x++){ let good=true; const e0=m.elev[m.idx(x,y)], r0=m.landReg[m.idx(x,y)];
    for(let b=-1;b<=h&&good;b++) for(let a=-1;a<=w&&good;a++){ const i=m.idx(x+a,y+b); if((m.ter[i]!==T.GRASS&&m.ter[i]!==T.DIRT)||m.blk[i]||USED.has(i)||m.elev[i]!==e0||m.landReg[i]!==r0) good=false; }
    if(!good) continue; if(tcs.some(t=>Math.hypot(t.x-x,t.y-y)<14)) continue;
    if(W.list.some(e=>e.kind==='unit'&&e.x>=x-1&&e.x<=x+w+1&&e.y>=y-1&&e.y<=y+h+1)) continue;
    for(let b=-1;b<=h;b++) for(let a=-1;a<=w;a++) USED.add(m.idx(x+a,y+b)); return {x,y}; }
  return null; }
function runUntil(fn,secs){ let t=0; while(t<secs && !fn()){ worldTick(0.05); t+=0.05; } return t; }
function shift(units, fn){ return cmdIssue(units, true, fn); }
function plain(units, fn){ return cmdIssue(units, false, fn); }`);

// ---------- 1. queue ----------
const Q = run(`(() => { const s=open(14,6); const v=spawnUnit('militia',1,s.x+0.5,s.y+0.5);
  plain([v],()=>orderMove([v],s.x+4.5,s.y+0.5));
  shift([v],()=>orderMove([v],s.x+8.5,s.y+3.5));
  shift([v],()=>orderMove([v],s.x+12.5,s.y+0.5));
  const qlen=v.queue.length; const seen=[];
  runUntil(()=>{ if(v.order && seen[seen.length-1]!==v.order.x) seen.push(v.order.x); return !v.order && !v.queue.length; }, 60);
  const end={x:+v.x.toFixed(1),y:+v.y.toFixed(1)};
  // a plain command wipes the queue
  shift([v],()=>orderMove([v],s.x+0.5,s.y+0.5)); shift([v],()=>orderMove([v],s.x+3.5,s.y+3.5)); const q2=v.queue.length;
  plain([v],()=>orderMove([v],s.x+6.5,s.y+5.5)); const q3=v.queue.length;
  return {qlen, seen:seen.map(x=>+(x-s.x).toFixed(1)), end, endOk:Math.hypot(v.x-(s.x+12.5),v.y-(s.y+0.5))<0.3, q2, q3}; })()`);
ok('shift-queued moves run in order', Q.qlen === 2 && Q.seen.join() === '4.5,8.5,12.5' && Q.endOk, Q);
ok('a plain order clears the queue', Q.q2 === 1 && Q.q3 === 0, Q);
const QG = run(`(() => { const s=open(6,4); const v=spawnUnit('villager',1,s.x+0.5,s.y+0.5);
  const tree=W.list.filter(e=>e.kind==='res'&&e.type==='tree').sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
  plain([v],()=>orderMove([v],s.x+5.5,s.y+3.5)); shift([v],()=>orderTarget([v],tree));
  const queued=v.queue.length===1&&v.queue[0].t==='gather'&&v.order.t==='move';
  runUntil(()=>v.order&&v.order.t==='gather',30); const gathering=v.order&&v.order.t==='gather';
  // shift on an endless order (gathering) replaces it at once
  shift([v],()=>orderMove([v],s.x+1.5,s.y+1.5)); const replaced=v.order.t==='move'&&!v.queue.length;
  return {queued,gathering,replaced}; })()`);
ok('shift-queued gather starts after the move; shift on gathering replaces', QG.queued && QG.gathering && QG.replaced, QG);
const QB = run(`(() => { const s=open(9,4); const p=W.players[1]; const v=spawnUnit('villager',1,s.x+0.5,s.y+3.5);
  let b1,b2; plain([v],()=>{ b1=placeBuilding(p,'house',s.x+1,s.y,[v]); }); shift([v],()=>{ b2=placeBuilding(p,'house',s.x+5,s.y,[v]); });
  const q=v.queue.length, first=v.order&&v.order.id===b1.id;
  runUntil(()=>b1.built&&b2.built,200);
  return {q, first, built:b1.built&&b2.built}; })()`);
ok('shift-placed buildings are built one after another', QB.q === 1 && QB.first && QB.built, QB);

// ---------- 2. formations ----------
const F = run(`(() => { const s=open(16,12); const us=[];
  for(let i=0;i<6;i++) us.push(spawnUnit('militia',1,s.x+1+(i%3),s.y+5+(i/3|0)));
  for(let i=0;i<4;i++) us.push(spawnUnit('archer',1,s.x+1+(i%2),s.y+8+(i/2|0)));
  us.push(spawnUnit('mangonel',1,s.x+2.5,s.y+10.5)); us.push(spawnUnit('monk',1,s.x+3.5,s.y+10.5));
  const tx=s.x+13.5, ty=s.y+6.5; plain(us,()=>orderMove(us,tx,ty));
  const d=us.map(u=>({u,x:u.order.x,y:u.order.y}));
  let minGap=9; for(let i=0;i<d.length;i++) for(let j=i+1;j<d.length;j++) minGap=Math.min(minGap,Math.hypot(d[i].x-d[j].x,d[i].y-d[j].y));
  let cx=0,cy=0; for(const u of us){cx+=u.x;cy+=u.y;} cx/=us.length; cy/=us.length; const L=Math.hypot(tx-cx,ty-cy), fx=(tx-cx)/L, fy=(ty-cy)/L;
  const fwd=t=>{ const a=d.filter(e=>t(e.u.type)); return a.reduce((s,e)=>s+(e.x-tx)*fx+(e.y-ty)*fy,0)/a.length; };
  const mel=fwd(t=>t==='militia'), rng=fwd(t=>t==='archer'), rear=fwd(t=>t==='mangonel'||t==='monk');
  const passable=d.every(e=>tilePassFor(e.u,e.x,e.y));
  // no crossing in the front row: lateral order of units == lateral order of slots
  const px=-fy, py=fx; const mil=d.filter(e=>e.u.type==='militia');
  const byNow=mil.slice().sort((a,b)=>((a.u.x-cx)*px+(a.u.y-cy)*py)-((b.u.x-cx)*px+(b.u.y-cy)*py));
  const fr=byNow.map(e=>({e,f:(e.x-tx)*fx+(e.y-ty)*fy}));
  const rows={}; for(const o of fr){ const k=o.f.toFixed(1); (rows[k]=rows[k]||[]).push(o.e); }
  let mono=true; for(const k in rows){ const lat=rows[k].map(e=>(e.x-tx)*px+(e.y-ty)*py); for(let i=1;i<lat.length;i++) if(lat[i]<lat[i-1]-1e-6) mono=false; }
  runUntil(()=>us.every(u=>!u.order),60);
  const arrived=us.every((u,i)=>Math.hypot(u.x-d[i].x,u.y-d[i].y)<0.8);
  // single unit: exact click point (unchanged behaviour)
  const one=us[0]; plain([one],()=>orderMove([one],s.x+3.5,s.y+3.5)); const single=one.order.x===s.x+3.5&&one.order.y===s.y+3.5;
  return {minGap:+minGap.toFixed(2), mel:+mel.toFixed(2), rng:+rng.toFixed(2), rear:+rear.toFixed(2), passable, mono, arrived, single}; })()`);
ok('formation: distinct slots, melee front, ranged behind, siege/monks rear', F.minGap >= 0.75 && F.mel > F.rng && F.rng > F.rear, F);
ok('formation: slots passable, rows keep lateral order, units arrive; single unit unchanged', F.passable && F.mono && F.arrived && F.single, F);
const FS = run(`(() => { const s=open(10,8); const p=W.players[2];
  const blk=spawnBuilding('barracks',2,s.x+6,s.y+3,true);
  const us=[]; for(let i=0;i<9;i++) us.push(spawnUnit('militia',1,s.x+0.5+(i%3),s.y+0.5+(i/3|0)));
  plain(us,()=>orderMove(us,s.x+7.5,s.y+4.5));
  const bad=us.filter(u=>!tilePassFor(u,u.order.x,u.order.y)).length; removeEnt(blk); return {bad}; })()`);
ok('formation slots on a building snap to free tiles', FS.bad === 0, FS);

// ---------- 3. accuracy ----------
const A = run(`(() => { const s=open(10,3); MISSES.length=0;
  const a=spawnUnit('archer',1,s.x+0.5,s.y+1.5), t=spawnUnit('knight',2,s.x+4.5,s.y+1.5); t.hp=t.maxhp=1e7;
  const hits0=t.hp; let shots=600; const before=W.projs.length; const aims=[];
  for(let i=0;i<shots;i++) fireProjectile(a,t,'arrow',null,{dmgVal:1});
  const fired=W.projs.slice(before); const missed=fired.filter(p=>p.miss);
  const offs=missed.map(p=>Math.hypot(p.tx-t.x,p.ty-t.y));
  const pin=()=>{ t.x=s.x+4.5; t.y=s.y+1.5; t.order=null; t.path=null; a.x=s.x+0.5; a.y=s.y+1.5; a.order=null; };
  runUntil(()=>{ pin(); return !W.projs.length; },10);
  const dmg=hits0-t.hp;
  // buildings are never missed; splash shots are never flagged
  const b=W.list.find(e=>e.kind==='bld'&&e.owner===2&&e.type==='tc'); const n1=W.projs.length;
  for(let i=0;i<100;i++) fireProjectile(a,b,'arrow',null,{dmgVal:1}); const bm=W.projs.slice(n1).filter(p=>p.miss).length;
  const m=spawnUnit('mangonel',1,s.x+0.5,s.y+0.5); const n2=W.projs.length;
  for(let i=0;i<100;i++) fireProjectile(m,t,'stone',null,{dmgVal:1,blast:1}); const sm=W.projs.slice(n2).filter(p=>p.miss).length;
  const ca=spawnUnit('cavarcher',1,s.x+0.5,s.y+2.5); const n3=W.projs.length;
  for(let i=0;i<600;i++) fireProjectile(ca,t,'arrow',null,{dmgVal:1}); const cm=W.projs.slice(n3).filter(p=>p.miss).length;
  runUntil(()=>{ pin(); return !W.projs.length; },10);
  return {hitRate:+(1-missed.length/shots).toFixed(3), dmg, minOff:+Math.min(...offs).toFixed(2), maxOff:+Math.max(...offs).toFixed(2), missFx:W.missFx.length, hook:MISSES.length, bm, sm, caHit:+(1-cm/600).toFixed(3), fxOk:W.missFx.every(f=>typeof f.ang==='number'&&f.x>=0&&f.t>=0)}; })()`);
ok('archer hit rate ~0.8 and misses do no damage', A.hitRate > 0.74 && A.hitRate < 0.86 && Math.abs(A.dmg - Math.round(A.hitRate * 600)) <= 1, A);
ok('misses land 0.5-1.5 tiles off, reported in W.missFx and window.onArrowMiss', A.minOff >= 0.45 && A.maxOff <= 1.55 && A.missFx >= 90 && A.hook >= 90 && A.fxOk, A);
ok('buildings always hit, splash unaffected, cavalry archers ~0.6', A.bm === 0 && A.sm === 0 && A.caHit > 0.53 && A.caHit < 0.67, A);

// ---------- 4. stuck rescue ----------
const S = run(`(() => { const s=open(6,6); const m=W.map;
  const v=spawnUnit('militia',1,s.x+2.5,s.y+2.5); const i=m.idx(s.x+2,s.y+2); m.ter[i]=T.WATER; m.computeRegions();
  runUntil(()=>tilePassFor(v,v.x,v.y),3); const out1=tilePassFor(v,v.x,v.y), d1=Math.hypot(v.x-(s.x+2.5),v.y-(s.y+2.5));
  m.ter[i]=T.GRASS; m.computeRegions();
  // walled pocket (own palisade, 1 free tile): unit ordered out keeps failing to path -> rescued
  const t=open(9,9); const cx=t.x+4, cy=t.y+4; const walls=[];
  for(let y=cy-1;y<=cy+1;y++) for(let x=cx-1;x<=cx+1;x++) if(x!==cx||y!==cy) walls.push(spawnBuilding('palisade',1,x,y,true));
  const u=spawnUnit('spearman',1,cx+0.5,cy+0.5); plain([u],()=>orderMove([u],t.x+0.5,t.y+0.5));
  runUntil(()=>u.rescued,20); const pocket=!!u.rescued; runUntil(()=>!u.order,20);
  const reached=Math.hypot(u.x-(t.x+0.5),u.y-(t.y+0.5))<0.6;
  walls.forEach(w=>removeEnt(w));
  return {out1, d1:+d1.toFixed(2), pocket, reached}; })()`);
ok('unit on a tile turned to water is moved to the nearest dry tile', S.out1 && S.d1 < 1.6, S);
ok('unit trapped in a pocket after failed paths is rescued and completes its move', S.pocket && S.reached, S);

// ---------- 5. wall breaching ----------
const B = run(`(() => { const s=open(13,13); const cx=s.x+6, cy=s.y+6; const walls=[];
  const house=spawnBuilding('house',2,cx,cy,true);
  for(let y=cy-3;y<=cy+4;y++) for(let x=cx-3;x<=cx+4;x++) if(Math.max(Math.abs(x-cx-0.5),Math.abs(y-cy-0.5))===3.5) walls.push(spawnBuilding('palisade',2,x,y,true));
  const ms=[]; for(let i=0;i<4;i++) ms.push(spawnUnit('manatarms',1,s.x+0.5+i,s.y+0.5));
  plain(ms,()=>{ for(const m of ms) setOrder(m,{t:'attack',id:house.id}); });
  runUntil(()=>ms.some(m=>m.order&&m.order.breach),10); const breach=ms.some(m=>m.order&&m.order.breach&&m.order.then&&m.order.then.id===house.id);
  const wallT=ms.map(m=>m.order&&ent(m.order.id)).filter(Boolean).every(e=>e.type==='palisade');
  runUntil(()=>house.dead,240); const houseDown=!!house.dead; const wallsLeft=walls.filter(w=>!w.dead).length;
  // AI-style attack-move into a walled camp
  const s2=open(13,13); const cx2=s2.x+6, cy2=s2.y+6; const tower=spawnBuilding('barracks',2,cx2-1,cy2-1,true); const walls2=[];
  for(let y=cy2-4;y<=cy2+4;y++) for(let x=cx2-4;x<=cx2+4;x++) if(Math.max(Math.abs(x-cx2),Math.abs(y-cy2))===4) walls2.push(spawnBuilding('palisade',2,x,y,true));
  const ks=[]; for(let i=0;i<3;i++) ks.push(spawnUnit('longsword',1,s2.x+0.5+i,s2.y+0.5));
  for(const k of ks) setOrder(k,{t:'attackmove',x:cx2+0.5,y:cy2+0.5});
  runUntil(()=>ks.some(k=>k.breaches),10); const amBreach=ks.some(k=>k.breaches);
  runUntil(()=>walls2.some(w=>w.dead),200); const opened=walls2.some(w=>w.dead);
  runUntil(()=>tower.dead,300);
  return {breach, wallT, houseDown, wallsLeft, amBreach, opened, barracksDown:!!tower.dead}; })()`);
ok('melee units blocked by enemy walls attack a wall, then the original target', B.breach && B.wallT && B.houseDown && B.wallsLeft > 0, B);
ok('attack-move (AI attacks) breaches a walled camp', B.amBreach && B.opened && B.barracksDown, B);

// ---------- 6. stances ----------
const ST = run(`(() => { const s=open(16,6); const r={};
  // no attack: ignores an adjacent enemy and does not retaliate
  const a=spawnUnit('militia',1,s.x+0.5,s.y+0.5), e=spawnUnit('militia',2,s.x+1.3,s.y+0.5); cmdSetStance([a],'noattack');
  setOrder(e,{t:'attack',id:a.id}); runUntil(()=>a.dead||a.dying,30); r.noattackIdle=!a.order||a.order.t!=='attack'; r.noattackDied=!!(a.dead||a.dying);
  if(!e.dead) removeEnt(e);
  // stand ground: melee unit does not walk to an enemy 3 tiles away; archer shoots one in range without moving
  const g=spawnUnit('militia',1,s.x+5.5,s.y+0.5), g2=spawnUnit('archer',1,s.x+5.5,s.y+3.5); cmdSetStance([g,g2],'ground');
  const ev=spawnUnit('villager',2,s.x+8.5,s.y+0.5), ev2=spawnUnit('villager',2,s.x+8.5,s.y+3.5); ev.hp=ev.maxhp=1e6; ev2.hp=ev2.maxhp=1e6; setOrder(ev,null);
  const g0={x:g.x,y:g.y}, g20={x:g2.x,y:g2.y}; for(let i=0;i<120;i++){ worldTick(0.05); ev.x=s.x+8.5; ev.y=s.y+0.5; ev2.x=s.x+8.5; ev2.y=s.y+3.5; }
  r.groundStay=Math.hypot(g.x-g0.x,g.y-g0.y)<0.3; r.archerFired=ev2.hp<ev2.maxhp; r.archerStay=Math.hypot(g2.x-g20.x,g2.y-g20.y)<0.3;
  removeEnt(ev); removeEnt(ev2); removeEnt(g); removeEnt(g2);
  // defensive: engages a close enemy, leaves it when it runs away past the leash, returns home
  const d=spawnUnit('scout',1,s.x+2.5,s.y+3.5); cmdSetStance([d],'defensive'); const home={x:d.x,y:d.y};
  const far=spawnUnit('villager',2,s.x+10.5,s.y+3.5); far.hp=far.maxhp=1e6; runUntil(()=>false,2); r.ignoresFar=!d.order;
  far.x=s.x+4.5; runUntil(()=>d.order&&d.order.t==='attack',3); r.engages=!!(d.order&&d.order.t==='attack');
  setOrder(far,{t:'move',x:s.x+15.5,y:s.y+3.5}); let maxD=0; runUntil(()=>{ maxD=Math.max(maxD,Math.hypot(d.x-home.x,d.y-home.y)); return far.dead||(!d.order&&Math.hypot(d.x-home.x,d.y-home.y)<1.3&&Math.hypot(far.x-d.x,far.y-d.y)>6); },30);
  r.maxD=+maxD.toFixed(2); r.back=Math.hypot(d.x-home.x,d.y-home.y)<1.3; removeEnt(far); removeEnt(d);
  r.aiAggressive=W.list.filter(u=>u.kind==='unit'&&u.owner===2).every(u=>!u.stance);
  return r; })()`);
ok('No Attack: never attacks on its own, not even back', ST.noattackIdle && ST.noattackDied, ST);
ok('Stand Ground: no chasing; archers fire at targets already in range', ST.groundStay && ST.archerFired && ST.archerStay, ST);
ok('Defensive: ignores far enemies, chases at most ~4 tiles, returns home', ST.ignoresFar && ST.engages && ST.maxD < 5.5 && ST.back, ST);
ok('AI units have no stance (aggressive)', ST.aiAggressive, ST);

// ---------- 9. flee ----------
const FL = run(`(() => { const s=open(10,6);
  const tree=W.list.filter(e=>e.kind==='res'&&e.type==='tree').sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
  const v=spawnUnit('villager',1,s.x+3.5,s.y+3.5); setOrder(v,{t:'gather',id:tree.id});
  const m=spawnUnit('militia',2,s.x+4.2,s.y+3.5); m.stance='noattack'; v.hp=v.maxhp=500;
  applyDamage(v,1,m); const fled=!!(v.order&&v.order.flee), saved=v.queue&&v.queue[0]&&v.queue[0].t==='gather';
  const d0=Math.hypot(v.x-m.x,v.y-m.y); runUntil(()=>!v.order||!v.order.flee,10); const d1=Math.hypot(v.x-m.x,v.y-m.y); const resumed=!!(v.order&&v.order.t==='gather');
  // fighting villager does not flee; ranged attackers do not cause fleeing
  const w=spawnUnit('villager',1,s.x+1.5,s.y+1.5); w.hp=w.maxhp=500; setOrder(w,{t:'attack',id:m.id}); applyDamage(w,1,m); const stays=w.order&&w.order.t==='attack';
  const z=spawnUnit('villager',1,s.x+1.5,s.y+4.5); z.hp=z.maxhp=500; const ar=spawnUnit('archer',2,s.x+5.5,s.y+4.5); applyDamage(z,1,ar); const noRangedFlee=!(z.order&&z.order.flee);
  const mk=spawnUnit('monk',1,s.x+7.5,s.y+1.5); mk.hp=mk.maxhp=500; applyDamage(mk,1,m); const monkFled=!!(mk.order&&mk.order.flee);
  [v,w,z,mk,m,ar].forEach(e=>{ if(!e.dead) removeEnt(e); });
  return {fled,saved,gain:+(d1-d0).toFixed(2),resumed,stays,noRangedFlee,monkFled}; })()`);
ok('villager flees a melee attacker, then resumes work', FL.fled && FL.saved && FL.gain > 2 && FL.resumed, FL);
ok('no flight when fighting or shot at; monks flee too', FL.stays && FL.noRangedFlee && FL.monkFled, FL);

// ---------- 8. resign ----------
const RS = run(`(() => { const p=W.players[2]; p.ai=new AIPlayer(p,'standard'); W.t=Math.max(W.t,70);
  const before=p.alive; let msgs0=W.msgs.length;
  for(const e of W.list.slice()) if(e.owner===2&&((e.kind==='bld'&&e.type==='tc')||(e.kind==='unit'&&(e.type==='villager'||cmdMilitary(e))))) removeEnt(e);
  spawnUnit('militia',2,5.5,5.5); spawnUnit('militia',2,6.5,5.5);
  runUntil(()=>!p.alive,8);
  const said=W.msgs.some(m=>/P1 has resigned/.test(m.text));
  const left=W.list.filter(e=>e.owner===2&&!e.dying&&e.kind!=='res').length;
  // keeps playing while it still has an army
  return {before, resigned:!p.alive&&p.resigned, said, left, over:W.over, won:W.won}; })()`);
ok('AI with no TC, no villagers and < 3 soldiers resigns ("<name> has resigned")', RS.before && RS.resigned && RS.said && RS.left === 0, RS);
const RH = run(`(() => { W.over=false; W.won=false; cmdResign(W.humanId); return {over:W.over, won:!!W.won, alive:W.players[1].alive}; })()`);
ok('human resign ends the game as a defeat', RH.over && !RH.won && !RH.alive, RH);

// melee attackers reach building faces (needed for breaching; was an engine stall)
const MB = run(`(() => { W.over=false; const s=open(8,8); const h=spawnBuilding('house',2,s.x+4,s.y+4,true); const hp0=h.hp;
  const ms=[spawnUnit('militia',1,s.x+0.5,s.y+0.5), spawnUnit('militia',1,s.x+0.5,s.y+5.5)]; for(const m of ms) setOrder(m,{t:'attack',id:h.id});
  runUntil(()=>false,20); return {dmg:hp0-h.hp}; })()`);
ok('melee units damage buildings from diagonal and side approaches', MB.dmg > 20, MB);
// soak: two computer players on a fresh map for 12 minutes with every feature on
const SK = run(`(() => { const warns=[]; const cw=console.warn; console.warn=(...a)=>warns.push(String(a[0])+' '+String(a[1]&&a[1].stack||a[1]||'').slice(0,300));
  const spec=generateMapSpec({size:'small',seed:5,mapType:'land',numPlayers:2});
  createWorld(spec,{players:[{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}],seed:5,fog:'none',startRes:'high',startAge:2});
  W.players[1].ai=new AIPlayer(W.players[1],'hard'); W.players[2].ai=new AIPlayer(W.players[2],'hard');
  let err=null; try { for(let i=0;i<20*720 && !W.over;i++) worldTick(0.05); } catch(e){ err=e.stack.slice(0,400); }
  console.warn=cw;
  const missFx=(W.missFx||[]).length, breaches=W.list.reduce((a,u)=>a+(u.breaches||0),0), rescued=W.list.reduce((a,u)=>a+(u.rescued||0),0);
  return {err, warns:warns.slice(0,3), t:Math.round(W.t), kills:W.players[1].stats.kills+W.players[2].stats.kills, missFx, breaches, rescued, units:W.list.filter(e=>e.kind==='unit').length}; })()`);
ok('12 min AI soak with all features: no exceptions or AI errors', !SK.err && !SK.warns.length && SK.t >= 700, SK);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
