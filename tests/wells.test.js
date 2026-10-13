const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(type,size,seed,np){ const spec=generateMapSpec({size,seed,mapType:type,numPlayers:np});
 const pl=[]; for(let i=0;i<np;i++) pl.push({name:'P'+i,civ:['franks','teutons','britons'][i%3],color:PC[i%3],human:i===0});
 createWorld(spec,{players:pl,seed,fog:'none',startRes:'high',startAge:1}); return spec; }
mk('coastal','small',3,2); for(let i=0;i<60;i++) worldTick(0.05);`);
ok('well defined and eco', run(`BUILDINGS.well && BUILDINGS.well.cat==='eco' && typeof wlCapacity==='function'`));
const a = run(`(() => { const p=W.players[1], tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  recalcPop(); const cap0=p.waterCap, src=wlBldSource(tc);
  const expect = WELLM.base + WELLM.tcCistern + (src==='fresh'?WELLM.tcFresh:0);
  return {cap0, expect, src, def:p.waterDef}; })()`);
ok('base capacity = allowance + cistern (+fresh)', a.cap0 === a.expect && a.def === 0, a);
// well sources on this map: find fresh, salt and none spots
const s = run(`(() => { const m=W.map, out={fresh:0,salt:0,none:0}; for(let y=0;y<m.n;y+=3) for(let x=0;x<m.n;x+=3){ if(isWaterT(m.ter[m.idx(x,y)])) continue; const k=wlSource(m,x,y,WELLM.wellScan)||'none'; out[k]++; } return out; })()`);
ok('map has fresh, salt-only and dry well sites', s.fresh > 0 && s.salt > 0 && s.none > 0, s);
const b = run(`(() => { const p=W.players[1], tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1); const m=W.map;
  const find=(k)=>{ for(let y=2;y<m.n-2;y++) for(let x=2;x<m.n-2;x++){ if(wlSource(m,x,y,WELLM.wellScan)!==k) continue; if(canPlace(p,'well',x,y,true)) continue; return {x,y}; } };
  const sup={}; for (const k of ['fresh','salt',null]) { const sp=find(k); if(!sp){sup[k]='nosite';continue;} const w=spawnBuilding('well',1,sp.x,sp.y,true); sup[k]=wlWellSupply(w); removeEnt(w); }
  return sup; })()`);
ok('well supply 18 fresh / 7 brackish / 12 dry', b.fresh === 18 && b.salt === 7 && b['null'] === 12, b);
const c = run(`(() => { const p=W.players[1], tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  recalcPop(); const cap=p.waterCap;
  const vs=[]; for(let i=0;i<cap+30;i++) vs.push(spawnUnit('villager',1,tc.x-3+(i%8)*0.5,tc.y+6+((i/8)|0)*0.5));
  recalcPop(); const def=p.waterDef;
  const wood=W.list.find(e=>e.kind==='res'&&e.type==='tree'); const u=vs[0];
  const rate0 = (()=>{ const sav=p.waterDef; p.waterDef=0; const r=gatherRate(u,wood); p.waterDef=sav; return r; })();
  const rate1 = gatherRate(u,wood);
  vs.forEach(v=>v.hp=v.maxhp); for(let i=0;i<20*30;i++) worldTick(0.05);
  const hurt = vs.filter(v=>!v.dying&&!v.dead&&v.hp<v.maxhp).length, minHp=Math.min(...vs.filter(v=>!v.dead&&!v.dying).map(v=>v.hp)), dead=vs.filter(v=>v.dying||v.dead).length;
  // dig wells until supplied
  let made=0; for(let g=0; g<60 && p.pop>p.waterCap; g++){ for(let t=0;t<200;t++){ const x=(tc.x-8+Math.random()*16)|0,y=(tc.y-8+Math.random()*16)|0; if(canPlace(p,'well',x,y,true)) continue; spawnBuilding('well',1,x,y,true); made++; break; } recalcPop(); }
  const rate2=gatherRate(u,wood);
  return {cap,def:+def.toFixed(2),rate0:+rate0.toFixed(3),rate1:+rate1.toFixed(3),hurt,minHp:+minHp.toFixed(2),dead,made,rate2:+rate2.toFixed(3),defAfter:p.waterDef}; })()`);
ok('deficit slows gathering', c.rate1 < c.rate0 && c.rate1 >= c.rate0 * WELLM_FLOOR(), c);
function WELLM_FLOOR() { return 0.5 - 1e-9; }
ok('thirst wears units down but never kills', c.hurt > 0 && c.minHp >= 1 && c.dead === 0, c);
ok('wells restore capacity and gathering', c.defAfter === 0 && Math.abs(c.rate2 - c.rate0) < 1e-6, c);
// AI soak: AI must dig wells and stay mostly supplied
const d = run(`(() => { mk('land','small',5,3); for(let i=1;i<W.players.length;i++) W.players[i].ai=new AIPlayer(W.players[i],'standard'); let err=null; let worst=0;
  try { for(let i=0;i<20*60*12;i++){ worldTick(0.05); if(i%100===0) for(let k=1;k<W.players.length;k++) worst=Math.max(worst,W.players[k].waterDef||0); } } catch(e){ err=e.stack; }
  const wells=W.list.filter(e=>e.kind==='bld'&&e.type==='well').length;
  return {err, wells, worst:+worst.toFixed(2), pops:W.players.slice(1).map(q=>q.pop+'/'+q.waterCap).join(' ')}; })()`);
ok('12 min soak: AIs dig wells, never fall far short, no exceptions', !d.err && d.wells >= 2 && d.worst < 0.25, d);
console.log(`\n${pass} passed, ${fail} failed`);
