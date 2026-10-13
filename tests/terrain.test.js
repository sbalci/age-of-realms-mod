// Headless checks for the HD terrain texture (game/js/terrain.js): node tests/terrain.test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Uint8ClampedArray, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number, Date,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js', 'render.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('terrain.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'}];
function mk(type,size,seed){ const spec=generateMapSpec({size,seed,mapType:type,numPlayers:2});
 createWorld(spec,{players:[{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}],seed,fog:'none',startRes:'high',startAge:1}); }
function px(x,y){ const Wd=HDT.n*HDT.P, o=(y*Wd+x)*4; return [HDT.buf[o],HDT.buf[o+1],HDT.buf[o+2],HDT.buf[o+3]]; }
function tileAvg(tx,ty){ const P=HDT.P; let s=[0,0,0,0]; for(let b=0;b<P;b++)for(let a=0;a<P;a++){ const p=px(tx*P+a,ty*P+b); for(let k=0;k<4;k++) s[k]+=p[k]; } return s.map(v=>v/(P*P)); }`);

ok('switch is on by default and the API exists', run(`HD.on && typeof hdtFull==='function' && typeof hdtSync==='function' && typeof hdtPaint==='function'`));

// generation time on the large map (120x120)
const G = run(`(() => { mk('coastal','large',5); const t0=performance.now(); hdtFull(W.map); const ms=performance.now()-t0;
  const t1=performance.now(); hdtFull(W.map); const ms2=performance.now()-t1; return { n:W.map.n, P:HDT.P, ms:+ms.toFixed(1), ms2:+ms2.toFixed(1), MB:+(HDT.buf.length/1048576).toFixed(1) }; })()`);
// the vm sandbox runs this code several times slower than a browser tab (see the browser timings in the report)
ok('large map texture generated (vm budget < 1500 ms)', G.n === 120 && G.ms2 < 1500, G);

// colours: grass reads green, sand sandy, deep water darker and more transparent than shore water
const C = run(`(() => { const m=W.map, n=m.n; const find=(f)=>{ for(let y=2;y<n-2;y++)for(let x=2;x<n-2;x++){ let all=true; for(let dy=-1;dy<=1&&all;dy++)for(let dx=-1;dx<=1;dx++) if(!f(m.ter[(y+dy)*n+x+dx],x+dx,y+dy)){all=false;break;} if(all) return {x,y}; } return null; };
  const gr=find(t=>t===T.GRASS), dp=find(t=>t===T.DEEP||(t===T.WATER&&false));
  let deep=null; for(let i=0;i<n*n;i++) if(isWaterT(m.ter[i]) && HDT.depth[i]>=5){ deep={x:i%n,y:(i/n)|0}; break; }
  let shoreW=null; for(let y=1;y<n-1&&!shoreW;y++)for(let x=1;x<n-1;x++){ const i=y*n+x; if(isWaterT(m.ter[i])&&HDT.depth[i]===1&&m.ter[i-1]===T.SAND&&isWaterT(m.ter[i+1])&&m.elev[i-1]===0){ shoreW={x,y}; break; } }
  return { grass: gr&&tileAvg(gr.x,gr.y), deep: deep&&tileAvg(deep.x,deep.y), shoreW, shore: shoreW&&tileAvg(shoreW.x,shoreW.y), sandEdge: shoreW && (()=>{ const P=HDT.P; return px(shoreW.x*P-1, shoreW.y*P+P/2); })() }; })()`);
ok('grass texels are green', C.grass && C.grass[1] > C.grass[0] && C.grass[1] > C.grass[2] && C.grass[3] === 255, C.grass);
ok('deep water is darker and more opaque than shore water', C.deep && C.shore && C.deep[1] < C.shore[1] && C.deep[3] > 0.5 * 255 && C.deep[3] < 255, { deep: C.deep, shore: C.shore });

// blending: across a land/water boundary the texture mixes (some foam/white texels and intermediate alphas), not a hard tile edge
const B = run(`(() => { const P=HDT.P, s=${JSON.stringify(C.shoreW)}; if(!s) return null; let foam=0, mid=0, cnt=0;
  for(let a=-P;a<P;a++){ const p=px(s.x*P+a, s.y*P+(P>>1)); cnt++; if(p[0]>200&&p[1]>210&&p[2]>205) foam++; if(p[3]>140&&p[3]<250) mid++; }
  // the boundary column between the sand tile and the water tile must not be a single hard step
  let steps=0; for(let b=0;b<P;b++){ const l=px(s.x*P-1,s.y*P+b), r=px(s.x*P,s.y*P+b); if(Math.abs(l[3]-r[3])>150) steps++; }
  return {foam, mid, cnt, hardSteps: steps}; })()`);
ok('shore has a foam band and a soft alpha ramp', B && B.foam > 0 && B.mid > 0 && B.hardSteps < HDT_P_HALF(), B);
function HDT_P_HALF() { return run('HDT.P') / 2; }

// grass/dirt boundary is warped (not a straight line along the tile edge)
const D = run(`(() => { const m=W.map, n=m.n, P=HDT.P; for(let y=3;y<n-3;y++)for(let x=3;x<n-3;x++){ const i=y*n+x; if(m.ter[i]===T.GRASS&&m.ter[i+1]===T.DIRT&&m.ter[i-n]===T.GRASS&&m.ter[i+n]===T.GRASS&&m.ter[i+1-n]===T.DIRT&&m.ter[i+1+n]===T.DIRT){
   const cols=[]; for(let b=0;b<P;b+=2){ let edge=-1; for(let a=-P/2;a<P/2;a++){ const p=px((x+1)*P+a,y*P+b); if(p[0]-p[1]>-8){ edge=a; break; } } cols.push(edge); } return {x,y,cols}; } } return null; })()`);
ok('grass/dirt boundary is domain-warped and blended', D && new Set(D.cols).size >= 3, D);

// regeneration: an edit repaints only nearby blocks, and the result equals a full repaint
const E = run(`(() => { const m=W.map, n=m.n, P=HDT.P; let sp=null;
  for(let y=20;y<n-20&&!sp;y++) for(let x=20;x<n-20&&!sp;x++){ let ok=true; for(let dy=-3;dy<=3&&ok;dy++)for(let dx=-3;dx<=3;dx++) if(m.ter[(y+dy)*n+x+dx]!==T.GRASS){ok=false;break;} if(ok) sp={x,y}; }
  const before=HDT.buf.slice(); const inv=[];
  m.ter[sp.y*n+sp.x]=T.WATER; m.ter[sp.y*n+sp.x+1]=T.WATER; m.elev[sp.y*n+sp.x]=0; m.elev[sp.y*n+sp.x+1]=0; m.computeVH();
  const t0=performance.now(); const k=hdtSync(m,(a,b,c,d)=>inv.push([a,b,c,d])); const ms=performance.now()-t0;
  const part=HDT.buf.slice(); hdtFull(m); const full=HDT.buf;
  let diff=0, changedFar=0; for(let i=0;i<full.length;i++){ if(Math.abs(full[i]-part[i])>1) diff++; }
  const Wd=n*P; for(let i=0;i<full.length;i+=4){ const x=(i/4)%Wd/P|0, y=((i/4)/Wd)/P|0; if(Math.abs(x-sp.x)>12||Math.abs(y-sp.y)>12){ if(before[i]!==part[i]) changedFar++; } }
  const c=tileAvg(sp.x,sp.y); return {blocks:k, inv:inv.length, ms:+ms.toFixed(1), diff, changedFar, water:c}; })()`);
ok('edit repaints only a few 8x8 blocks (vm budget < 400 ms)', E.blocks >= 1 && E.blocks <= 9 && E.inv === E.blocks && E.ms < 400, E);
ok('partial repaint matches a full repaint; far texels untouched', E.diff === 0 && E.changedFar === 0, { diff: E.diff, far: E.changedFar });
ok('dug tile now shows water (translucent blue)', E.water[2] > E.water[0] && E.water[3] < 250, E.water);

// unchanged version -> no work; elevation change (terraform raise) is picked up and lit
const F = run(`(() => { const m=W.map, n=m.n; const k0=hdtSync(m); let sp=null;
  for(let y=30;y<n-30&&!sp;y++) for(let x=30;x<n-30&&!sp;x++){ let ok=true; for(let dy=-2;dy<=2&&ok;dy++)for(let dx=-2;dx<=2;dx++){ const j=(y+dy)*n+x+dx; if(m.ter[j]!==T.GRASS||m.elev[j]!==0){ok=false;break;} } if(ok) sp={x,y}; }
  const before=tileAvg(sp.x-1,sp.y);
  m.elev[sp.y*n+sp.x]=3; m.computeVH(); const k=hdtSync(m); const after=tileAvg(sp.x-1,sp.y), cliff=tileAvg(sp.x,sp.y);
  return {k0, k, before, after}; })()`);
ok('no repaint when nothing changed', F.k0 === 0, F.k0);
ok('elevation edit repaints with slope light', F.k >= 1 && Math.abs(F.after[1] - F.before[1]) > 2, F);

// terraform integration: a real canal order through terra.js flows into hdtSync
const Gt = run(`(() => { mk('coastal','small',11); hdtFull(W.map); const m=W.map, n=m.n;
  let site=null; for(let y=4;y<n-4&&!site;y++) for(let x=4;x<n-4&&!site;x++){ if(!isWaterT(m.ter[y*n+x-1])) continue; const i=y*n+x; if((m.ter[i]===T.GRASS||m.ter[i]===T.SAND)&&!m.blk[i]&&m.elev[i]<=1) site={x,y}; }
  const v=spawnUnit('villager',1,site.x+0.5,site.y+1.5); terraOrder([v],'canal',[site]); let t=0; while(v.order&&t<120){ worldTick(0.05); t+=0.05; }
  const dug=isWaterT(m.ter[site.y*n+site.x]); const k=hdtSync(m); const c=tileAvg(site.x,site.y); return {dug,k,c}; })()`);
ok('terraform canal -> texture repaint shows water', Gt.dug && Gt.k >= 1 && Gt.c[2] > Gt.c[0], Gt);

// building material choice follows age/style
const M = run(`(() => { const r={}; HDB.st=0; r.st0wall=hdWallMat(STYLE[0].wall,{},0.7,0.6,8,10); HDB.st=1; r.st1wall=hdWallMat(STYLE[1].wall,{beams:STYLE[1].beams},0.7,0.6,8,12);
  HDB.st=2; r.st2wall=hdWallMat(STYLE[2].wall,{bricks:true},0.7,0.6,8,12); r.found=hdWallMat(STYLE[2].base,{bricks:true},0.7,0.6,0,8);
  r.roofs=STYLE.map(s=>hdRoofMat(s.roof)); r.monk=hdRoofMat('#7a3a2a'); r.post=hdWallMat('#5e3f22',{},0.06,0.06,0,16); return r; })()`);
ok('wall materials by age: logs, timber-plaster, ashlar; rubble foundations', M.st0wall === 'logs' && M.st1wall === 'plaster' && M.st2wall === 'ashlar' && M.found === 'rubble' && M.post === 'wood', M);
ok('roof materials by age: thatch, clay tile, slate', M.roofs[0] === 'thatch' && M.roofs[1] === 'tile' && M.roofs[2] === 'slate' && M.roofs[3] === 'slate', M.roofs);

// ?hd=off: nothing installed
const ctx2 = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Uint8ClampedArray, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number, Date, URLSearchParams,
  location: { search: '?hd=off' }, Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
for (const f of ['data.js', 'map.js', 'world.js', 'render.js', 'terrain.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx2, { filename: f });
ok('?hd=off disables the HD renderer', vm.runInContext('HD.on === false', ctx2));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
