// Headless tests for game/js/movement.js and friendly-fire rules: node tests/movement.test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '', keys: new Set() } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('command.js'); load('movement.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(seed){ const spec=generateMapSpec({size:'small',seed,mapType:'land',numPlayers:2});
 createWorld(spec,{players:[{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}],seed,fog:'none',startRes:'high',startAge:2}); }
function open(w,h){ const m=W.map, tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc');
 for(let y=4;y<m.n-h-4;y++) for(let x=4;x<m.n-w-4;x++){ let ok=true; for(let b=0;b<h&&ok;b++) for(let a=0;a<w;a++){ const i=m.idx(x+a,y+b); if(isWaterT(m.ter[i])||m.blk[i]||m.elev[i]!==m.elev[m.idx(x,y)]){ok=false;break;} } if(ok&&!tcs.some(t=>Math.hypot(t.x-x,t.y-y)<14)) return {x,y}; } return null; }
function runUntil(fn,secs){ let t=0; while(t<secs && !fn()){ worldTick(0.05); t+=0.05; } return t; }
mk(4);`);
// corner clipping: a unit standing off-centre next to a house corner, heading for a diagonal waypoint
const A = run(`(() => { const o=open(8,8); const res={};
  for (const on of [false, true]) { MOVE.enabled=on;
    const h=spawnBuilding('house',1,o.x+3,o.y+3,true);
    const u=spawnUnit('militia',1,o.x+2.95,o.y+5.02); u.path=[{x:o.x+2.5,y:o.y+5.5},{x:o.x+5.5,y:o.y+1.5}]; u.pi=1; u.goalRect={x0:o.x+5,y0:o.y+1,x1:o.x+5,y1:o.y+1}; u.goalR=0; u.order={t:'move',x:o.x+5.5,y:o.y+1.5}; u.dest={x:o.x+5.5,y:o.y+1.5};
    const t=runUntil(()=>Math.hypot(u.x-(o.x+5.5),u.y-(o.y+1.5))<0.3, 20);
    res[on?'on':'off']={t:+t.toFixed(1), arrived: Math.hypot(u.x-(o.x+5.5),u.y-(o.y+1.5))<0.3};
    removeEnt(u); removeEnt(h); }
  MOVE.enabled=true; return res; })()`);
ok('unit clipping a building corner slides round it and arrives', A.on.arrived && A.on.t < 10, A);
// cliffs: separation never pushes a unit up or down a cliff
const B = run(`(() => { const o=open(6,6), m=W.map; for(let y=o.y;y<o.y+6;y++) for(let x=o.x+3;x<o.x+6;x++) m.elev[m.idx(x,y)]=m.elev[m.idx(o.x,o.y)]+2; m.computeVH(); m.computeRegions();
  const us=[]; for(let k=0;k<8;k++) us.push(spawnUnit('militia',1,o.x+2.85,o.y+2.5+k*0.05));
  runUntil(()=>false,4); const crossed=us.filter(u=>(u.x|0)>=o.x+3).length; us.forEach(u=>removeEnt(u)); return {crossed}; })()`);
ok('crowd separation does not push units over a cliff edge', B.crossed === 0, B);
// head-on in a 1-tile corridor: both get through
const C = run(`(() => { const o=open(12,5), m=W.map; const walls=[];
  for(let x=o.x;x<o.x+12;x++){ walls.push(spawnBuilding('palisade',2,x,o.y+1,true)); walls.push(spawnBuilding('palisade',2,x,o.y+3,true)); }
  const a=spawnUnit('militia',1,o.x+0.5,o.y+2.5), b=spawnUnit('militia',1,o.x+11.5,o.y+2.5);
  orderMove([a],o.x+11.5,o.y+2.5); orderMove([b],o.x+0.5,o.y+2.5);
  const t=runUntil(()=>Math.hypot(a.x-(o.x+11.5),a.y-(o.y+2.5))<0.6&&Math.hypot(b.x-(o.x+0.5),b.y-(o.y+2.5))<0.6, 40);
  const r={t:+t.toFixed(1), a:[+a.x.toFixed(1),+a.y.toFixed(1)], b:[+b.x.toFixed(1),+b.y.toFixed(1)]}; [a,b,...walls].forEach(e=>removeEnt(e)); return r; })()`);
ok('two units meeting head-on in a corridor both get through', C.t < 30, C);
// friendly fire: a mangonel stone landing among your own units hurts only the enemy, and no XP for hitting friends
const D = run(`(() => { const o=open(8,6); const mg=spawnUnit('mangonel',1,o.x+0.5,o.y+2.5); const enemy=spawnUnit('ram',2,o.x+6.5,o.y+2.5);
  const own=spawnUnit('militia',1,o.x+6.8,o.y+2.7), ally0=own.hp; const xp0=mg.xp||0;
  fireProjectile(mg, enemy, 'stone', null, { dmgVal: 30 }); runUntil(()=>!W.projs.length,5);
  const r={ownHp:own.hp, own0:ally0, enemyHurt: enemy.hp<enemy.maxhp || enemy.dead, xp:(mg.xp||0)-xp0};
  [mg,enemy,own].forEach(e=>{ if(!e.dead) removeEnt(e); }); return r; })()`);
ok('catapult splash never hurts own units', D.ownHp === D.own0 && D.enemyHurt, D);
const E2 = run(`(() => { const o=open(4,4); const a=spawnUnit('militia',1,o.x+0.5,o.y+0.5), b=spawnUnit('militia',1,o.x+1.5,o.y+0.5); const xp0=a.xp||0, hp0=b.hp;
  applyDamage(b, 5, a); const r={hp:b.hp, hp0, xp:(a.xp||0)-xp0}; removeEnt(a); removeEnt(b); return r; })()`);
ok('no damage and no experience from hitting a friendly unit', E2.hp === E2.hp0 && E2.xp === 0, E2);
// soak: AI game, count units that stand still for 5 s while having somewhere to go
const S = run(`(() => { mk(3); for(let i=1;i<W.players.length;i++) W.players[i].ai=new AIPlayer(W.players[i],'hard');
  const tr=new Map(); let stuck=0, err=null;
  try { for(let i=0;i<20*60*5;i++){ worldTick(0.05); if(i%20) continue;
    for(const u of W.list){ if(u.kind!=='unit'||u.dying||u.inside||UNITS[u.type].animal) continue; const mv=u.path&&u.pi<u.path.length;
      let r=tr.get(u.id); if(!r||!mv||Math.hypot(u.x-r.x,u.y-r.y)>0.5){ tr.set(u.id,{x:u.x,y:u.y,t:i,rep:false}); continue; }
      if(i-r.t>=100&&!r.rep){ r.rep=true; stuck++; } } } } catch(e){ err=e.stack; }
  return {stuck, err, units: W.list.filter(u=>u.kind==='unit').length}; })()`);
ok('5-minute AI soak: almost no units stand stuck for 5 s', !S.err && S.stuck <= 3, S);
// chasing units must not ask for a new route every tick (pathTo used to reset the caller's repath timer)
const P = run(`(() => { mk(6); const o=open(16,8); const us=[];
  for(let k=0;k<20;k++){ us.push(spawnUnit('militia',1,o.x+0.5+(k%4),o.y+0.5+(k/4|0))); us.push(spawnUnit('militia',2,o.x+15.5-(k%4),o.y+0.5+(k/4|0))); }
  let calls=0; const _fp=findPath; findPath=function(){ calls++; return _fp.apply(this,arguments); };
  for(let i=0;i<20*5;i++) worldTick(0.05); findPath=_fp; us.forEach(u=>{ if(!u.dead) removeEnt(u); });
  return {calls}; })()`);
ok('chasing units repath on a timer, not every tick', P.calls < 900, P);
const Q = run(`(() => { const p=W.players[1]; p.res.wood=10; p.res.gold=0; return shortfallMsg(p,{wood:60,gold:20,food:0}); })()`);
ok('missing resources are named', Q === 'Need 50 more wood and 20 more gold', Q);
console.log(`\n${pass} passed, ${fail} failed`);
