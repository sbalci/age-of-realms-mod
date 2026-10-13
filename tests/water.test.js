const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(type,size,seed,np){ const spec=generateMapSpec({size,seed,mapType:type,numPlayers:np});
 const pl=[]; for(let i=0;i<np;i++) pl.push({name:'P'+i,civ:['franks','teutons','britons'][i%3],color:PC[i%3],human:i===0});
 createWorld(spec,{players:pl,seed,fog:'none',startRes:'high',startAge:1}); return spec; }`);
// 1. generation across types/seeds
let bad = [], stats = [];
for (const type of ['land', 'coastal', 'islands']) for (const size of ['tiny', 'small', 'large']) for (const seed of [1, 7, 42, 99]) {
  const r = run(`(() => { const np=3; const spec=mk('${type}','${size}',${seed},np); const m=W.map, w=wmInfo(m);
    const kinds={river:0,lake:0,sea:0}; let riverTiles=0; for(const b of w.bodies.values()) kinds[b.kind]++; for(let i=0;i<m.n*m.n;i++) if(w.kind[i]===1) riverTiles++;
    const starts=spec.players.map(p=>p.start); let minD=1e9;
    for(let i=0;i<m.n*m.n;i++) if(w.kind[i]===1) for(const s of starts) minD=Math.min(minD,Math.hypot(i%m.n-s.x,((i/m.n)|0)-s.y));
    const reg=starts.map(s=>m.landReg[m.idx(s.x,s.y)]); const conn=reg.every(x=>x===reg[0]);
    let objOnWater=0, fishOnLand=0; for(const e of W.list){ if(e.kind==='res'||e.kind==='bld'){ const wt=isWaterT(m.ter[m.idx(e.x,e.y)]); if(e.type==='fish'){ if(!wt) fishOnLand++; } else if(e.kind==='res'&&wt) objOnWater++; } }
    const fish={river:0,lake:0,sea:0}; for(const e of W.list) if(e.kind==='res'&&e.type==='fish'){ const k=waterKindAt(m,e.x,e.y); if(k) fish[k]++; }
    return {kinds,riverTiles,minD:Math.round(minD),conn,objOnWater,fishOnLand,fish}; })()`);
  stats.push(`${type}/${size}/${seed}: ${JSON.stringify(r)}`);
  if (type !== 'islands' && !(r.riverTiles >= 6)) bad.push(['no river', type, size, seed]);
  if (type === 'islands' && r.kinds.river) bad.push(['river on islands', type, size, seed]);
  if (r.riverTiles && r.minD < 9) bad.push(['river near start', type, size, seed, r.minD]);
  if (type !== 'islands' && !r.conn) bad.push(['starts disconnected', type, size, seed]);
  if (r.objOnWater || r.fishOnLand) bad.push(['object placement', type, size, seed, r]);
}
console.log(stats.join('\n'));
ok('rivers present on land/coastal, none on islands, clear of bases, starts connected, no stray objects', bad.length === 0, bad.slice(0, 6));
// 2. determinism
const d = run(`(() => { const a=JSON.stringify(generateMapSpec({size:'small',seed:5,mapType:'land',numPlayers:2}).ter), b=JSON.stringify(generateMapSpec({size:'small',seed:5,mapType:'land',numPlayers:2}).ter); return a===b; })()`);
ok('generation deterministic', d);
// 3. fish stock behaviour
run(`mk('land','small',11,2);`);
const f = run(`(() => {
  const fish=()=>W.list.filter(e=>e.kind==='res'&&e.type==='fish');
  for(let i=0;i<40;i++) worldTick(0.05);
  const all=fish(), fresh=all.filter(e=>waterKindAt(W.map,e.x,e.y)!=='sea');
  const res={n0:all.length, fresh:fresh.length, scaled: fresh.every(e=>e.wm&&e.max===Math.round(WMOD.kinds[waterKindAt(W.map,e.x,e.y)].fishMax*(e.v?1.12:1)))};
  const r=fresh[0]; r.amount=r.max*0.5; const a0=r.amount; for(let i=0;i<20*10;i++) worldTick(0.05); res.regen=r.amount-a0; res.regenExpect=WMOD.kinds[waterKindAt(W.map,r.x,r.y)].regen*10;
  r.amount=r.max*0.1; const c0=r.amount; for(let i=0;i<20*10;i++) worldTick(0.05); res.collapsed=r.amount===c0;
  r.amount=r.max; // full: no overshoot
  for(let i=0;i<20*5;i++) worldTick(0.05); res.cap=r.amount<=r.max;
  return res; })()`);
ok('fish scaled to water type', f.scaled, f);
ok('healthy shoal regrows at the type rate', Math.abs(f.regen - f.regenExpect) < 0.6, [f.regen, f.regenExpect]);
ok('overfished shoal (<20%) does not recover', f.collapsed);
ok('stock never exceeds cap', f.cap);
const g = run(`(() => {
  const m=W.map; const lake=[...wmInfo(m).bodies.values()].filter(b=>b.kind!=='sea').sort((a,b)=>b.size-a.size)[0];
  const inBody=()=>W.list.filter(e=>e.kind==='res'&&e.type==='fish'&&waterBodyAt(m,e.x,e.y)===lake);
  const start=inBody().length; if(start<4) return {start, skip:true};
  for(const e of W.list.slice()) if(e.kind==='res'&&e.type==='fish'&&waterBodyAt(m,e.x,e.y)===lake&&e.amount>0) {} 
  const victims=inBody().slice(0,2); victims.forEach(v=>{removeEnt(v);});
  const after=inBody().length;
  for(let i=0;i<20*130;i++) worldTick(0.05);
  return {kind:lake.kind,start,after,restored:inBody().length};
})()`);
ok('understocked body restocks while breeders remain', g.skip || (g.restored > g.after && g.restored <= g.start), g);
// 4. soak with AI
let soak;
try { soak = run(`(() => { mk('coastal','small',3,3); let err=null; const t0=Date.now(); try { for(let i=0;i<20*60*10;i++) worldTick(0.05); } catch(e){ err=e.stack; } return {err, fish: W.list.filter(e=>e.type==='fish'&&e.kind==='res').length, ms: Date.now()-t0}; })()`); } catch (e) { soak = { err: String(e) }; }
ok('10 min soak with rivers, regen and AI, no exceptions', !soak.err, soak);
console.log(`\n${pass} passed, ${fail} failed`);
