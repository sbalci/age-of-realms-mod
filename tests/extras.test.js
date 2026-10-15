// Headless tests for game/js/extras.js: node tests/extras.test.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const msgs = [];
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number, RegExp,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '', keys: new Set(), human: () => ctx.W.players[ctx.W.humanId] } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('command.js'); load('victory.js');
try { load('ui.js'); } catch (e) { console.log('ui.js not loadable headless:', e.message); }
load('extras.js');
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(civ0,civ1,age,fog){ const spec=generateMapSpec({size:'small',seed:7,mapType:'land',numPlayers:2});
 createWorld(spec,{players:[{name:'P0',civ:civ0,color:PC[0],human:true},{name:'P1',civ:civ1,color:PC[1]}],seed:7,fog:fog||'none',startRes:'high',startAge:age||0,cheats:true}); }
function runUntil(fn,secs){ let t=0; while(t<secs && !fn()){ worldTick(0.05); t+=0.05; } return t; }`);
const A = run(`(() => { mk('turks','franks',2); const p=W.players[1], q=W.players[2];
  const jan=spawnUnit('janissary',1,20.5,20.5), fr=spawnUnit('janissary',2,22.5,20.5);
  return { civ: !!CIVS.turks, uu: CIVS.turks.uu, hpT: jan.maxhp, hpF: fr.maxhp, gold: p.gather.gold, freeLC: (p.freeTechs||[]).includes('up_lightcav'),
    scoutPa: statU(spawnUnit('scout',1,25.5,25.5),'pa'), name: civUnitName('monk',1), nameF: civUnitName('monk',2), imam: isImam(spawnUnit('monk',1,26.5,26.5)) }; })()`);
ok('Turks: janissary +25% hp, gold miners +20%, free light cavalry, scouts +1 pierce', A.civ && A.uu === 'janissary' && A.hpT > A.hpF && Math.abs(A.gold - 1.2) < 1e-9 && A.freeLC && A.scoutPa === 3, A);
ok('Turkish monks are named Imam', A.name === 'Imam' && A.nameF === 'Monk' && A.imam, A);
const B = run(`(() => { mk('franks','teutons',1); const sc=spawnUnit('scout',1,30.5,30.5); const sh=spawnUnit('sheep',2,31.5,30.5); const sh0=spawnUnit('sheep',0,30.5,31.5); const deer=spawnUnit('deer',0,29.5,30.5);
  runUntil(()=>false,6); const wolf=spawnUnit('wolf',0,31.5,31.5); worldTick(0.05); const t=findTargetFor(sc,4); const dbg={t:t&&t.type, ca:canAttack(sc,wolf), reg:[W.map.landReg[W.map.idx(30,30)],W.map.landReg[W.map.idx(31,31)]], near:unitsNear(sc.x,sc.y,5,x=>true).map(x=>x.type+':'+x.owner)};
  return { sheepAlive: !sh.dead && sh.hp>0, gaiaSheep: !sh0.dead, deer: !deer.dead, wolfTarget: t===wolf, direct: canAttack(sc, sh), dbg }; })()`);
ok('scouts do not auto-attack sheep or deer but still fight wolves; direct orders allowed', B.sheepAlive && B.gaiaSheep && B.deer && B.wolfTarget && B.direct, B);
const C = run(`(() => { mk('franks','teutons',0,'normal'); const p=W.players[1]; p.explored=p.explored||new Uint8Array(W.map.n*W.map.n); p.explored.fill(0);
  const b0={r:!!W.revealAll,f:!!W.noFog}; const r1=runCheat('ibn battuta'); const on=W.revealAll&&W.noFog&&p.explored.every(v=>v===1);
  const r2=runCheat('Ibn Batuta'); const dbg2={rv:!!W.revealAll,nf:!!W.noFog,ex:p.explored.reduce((a,b)=>a+b,0)}; const off=!!W.revealAll===b0.r&&!!W.noFog===b0.f&&p.explored.reduce((a,b)=>a+b,0)<p.explored.length/2;
  const r3=runCheat('marco'); return {r1,on,off,dbg2,r3:!!r3,b0,rv:!!W.revealAll,nf:!!W.noFog,ex:p.explored.reduce((a,b)=>a+b,0)}; })()`);
ok('ibn battuta cheat toggles map reveal + no fog (either spelling)', C.on && C.off && C.r3, C);
const P = run(`(() => { mk('turks','franks',0); const p=W.players[1], q=W.players[2];
  const near=(pl,type)=>W.list.filter(e=>e.kind==='unit'&&e.type===type&&e.owner===0&&Math.hypot(e.x-pl.startX,e.y-pl.startY)<22&&Math.hypot(e.x-pl.startX,e.y-pl.startY)<=Math.hypot(e.x-(pl===p?q:p).startX,e.y-(pl===p?q:p).startY)).length;
  const boarT=near(p,'boar'), boarF=near(q,'boar'), sheepT=near(p,'sheep'), sheepF=near(q,'sheep');
  const v=W.list.find(e=>e.kind==='unit'&&e.owner===1&&e.type==='villager'); const b=spawnUnit('boar',0,v.x+1.5,v.y);
  setOrder(v,{t:'hunt',id:b.id}); for(let i=0;i<40;i++) worldTick(0.05);
  const refused=!v.order && b.hp===b.maxhp;
  applyDamage(b,999,null); for(let i=0;i<5;i++) worldTick(0.05);
  const c=W.list.find(e=>e.kind==='res'&&e.type==='carcass'&&e.animal==='boar');
  if(c) setOrder(v,{t:'gather',id:c.id}); for(let i=0;i<40;i++) worldTick(0.05);
  const noButcher=!!c && !v.order && (!v.carry||!v.carry.amt);
  const fv=W.list.find(e=>e.kind==='unit'&&e.owner===2&&e.type==='villager'); const fb=spawnUnit('boar',0,fv.x+1.5,fv.y); setOrder(fv,{t:'hunt',id:fb.id}); worldTick(0.05);
  return { boarT, boarF, sheepT, sheepF, refused, noButcher, franksHunt: !!fv.order&&fv.order.t==='hunt', eatsT: eatsMeat(1,'boar'), eatsSheep: eatsMeat(1,'sheep'), eatsF: eatsMeat(2,'boar') }; })()`);
ok('Turks do not eat pork: no boar at a Turkish start (sheep instead); villagers refuse to hunt or butcher boar; Franks still hunt', P.boarT === 0 && P.boarF > 0 && P.sheepT >= P.sheepF + 3 && P.refused && P.noButcher && P.franksHunt && !P.eatsT && P.eatsSheep && P.eatsF, P);
const D = run(`(() => { mk('turks','franks',2); W.settings.spectate=true; exSpectateBegin(Object.assign({}, W.settings, {name:'P0', difficulty:'standard'}));
  for(let i=2;i<W.players.length;i++) W.players[i].ai=new AIPlayer(W.players[i],'standard');
  const p=W.players[1]; const hasAi=!!p.ai; let err=null; try { for(let i=0;i<20*60*4;i++) worldTick(0.05); } catch(e){ err=e.stack; }
  const vills=W.list.filter(e=>e.kind==='unit'&&e.owner===1&&e.type==='villager').length;
  return {hasAi, spect:W.spectate, err, vills, cmds: commandsFor([W.list.find(e=>e.owner===1&&e.kind==='unit')]).length, name:p.name}; })()`);
ok('spectator: your slot is AI-played and grows its economy, commands disabled', D.hasAi && D.spect && !D.err && D.vills > 6 && D.cmds === 0, D);
const E2 = run(`(() => { let shown=0; UI.showEnd=()=>{shown++}; W.over=false; const p=W.players[1]; p.alive=false; W.players[2].alive=true; for(const e of W.list.slice()) if(e.owner===1) { e.dead=true; } W.list=W.list.filter(e=>e.owner!==1);
  checkVictory(); return {over:W.over, shown, winners:W.spectWinners}; })()`);
ok('spectator: game ends with the last side standing as winner', E2.over && E2.shown === 1 && E2.winners && E2.winners.length === 1 && E2.winners[0] === 2, E2);
console.log(`\n${pass} passed, ${fail} failed`);
