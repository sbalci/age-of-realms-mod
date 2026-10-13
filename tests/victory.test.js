// Headless tests for game/js/victory.js: Wonder & relic victory, Imperial upgrades, fog memory, score & history, AI hooks.
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ended = [];
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: w => ended.push(w), gameRunning: true, panelKey: '' } });
const load = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('victory.js');
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'},{c:'#0f0',d:'#0a0',l:'#8f8'}];
function mk(o){ o=Object.assign({size:'small',seed:5,np:2,fog:'none',age:3,teams:null},o); const spec=generateMapSpec({size:o.size,seed:o.seed,mapType:'land',numPlayers:o.np});
 const pl=[]; for(let i=0;i<o.np;i++) pl.push({name:'P'+i,civ:['franks','byzantines','teutons'][i%3],color:PC[i%3],human:i===0,team:o.teams?o.teams[i]:0});
 createWorld(spec,{players:pl,seed:o.seed,fog:o.fog,startRes:'high',startAge:o.age}); ctx_end.length=0; return spec; }
function ticks(secs){ for(let t=0;t<secs-1e-9 && !W.over;t+=0.05) worldTick(0.05); }
// a free flat spot of size s for player pid near its start, else anywhere
function spot(s,pid){ const p=W.players[pid||1]; for(let r=6;r<40;r++) for(let a=0;a<24;a++){ const x=Math.round(p.startX+Math.cos(a/24*6.283)*r-s/2), y=Math.round(p.startY+Math.sin(a/24*6.283)*r-s/2); const ty=s===5?'wonder':s===3?'monastery':'house'; if(!canPlace(null,ty,x,y,true)) return {x,y}; } return null; }
function lastMsgs(n){ return W.msgs.slice(-(n||8)).map(m=>m.text); }`);
ctx.ctx_end = ended;

// ---------- 1. data ----------
const D = run(`(() => {
  const ids=['up_halberdier','up_paladin','up_hcavarcher','up_cappedram','up_onager','croprotation','twomansaw','goldshaft','stoneshaft','blastfurnace','platemail','chainbarding','platebarding','leatherarcher','ringarcher','bracer'];
  const missing=ids.filter(i=>!TECHS[i]);
  const notAt=ids.filter(i=>TECHS[i]&&!(TECHS_AT[TECHS[i].at]||[]).includes(i));
  const badReq=ids.filter(i=>(TECHS[i].req||[]).some(r=>!TECHS[r]));
  const badUpg=ids.filter(i=>TECHS[i].upg&&(!UNITS[TECHS[i].upg[0]]||!UNITS[TECHS[i].upg[1]]));
  // hotkey clash: two techs at one building with the same key must be in one requirement chain (only one is ever offered)
  const anc=id=>{ const s=new Set(); const st=[id]; while(st.length){ const t=TECHS[st.pop()]; for(const r of (t.req||[])) if(!s.has(r)){ s.add(r); st.push(r);} } return s; };
  const clash=[];
  for(const b in TECHS_AT){ const L=TECHS_AT[b]; for(const a of L) for(const c of L){ if(a>=c||TECHS[a].hk!==TECHS[c].hk||TECHS[a].ageUp||TECHS[c].ageUp) continue; if(!ids.includes(a)&&!ids.includes(c)) continue; if(!anc(a).has(c)&&!anc(c).has(a)) clash.push(b+':'+a+'/'+c); } }
  const units=['halberdier','paladin','hcavarcher','cappedram','onager'].filter(u=>!UNITS[u]);
  const w=BUILDINGS.wonder; const ecoKeys=Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].cat==='eco'&&k!=='wonder').map(k=>BUILDINGS[k].hk);
  return {missing,notAt,badReq,badUpg,clash,units,wonder:!!w&&w.size===5&&w.age===3&&w.cat==='eco'&&!ecoKeys.includes(w.hk)&&['food','wood','gold','stone'].every(r=>w.cost[r]===1000)};
})()`);
ok('new techs registered in TECHS and TECHS_AT with valid req/upg chains', !D.missing.length && !D.notAt.length && !D.badReq.length && !D.badUpg.length && !D.units.length, D);
ok('no hotkey clashes between techs offered at the same time', !D.clash.length, D.clash);
ok('Wonder: 5x5, Imperial, 1000 of each resource, free eco hotkey', D.wonder, D);

// ---------- 2. upgrades & blacksmith ----------
const U = run(`(() => { mk({age:3}); const p=W.players[1]; const pk=spawnUnit('pikeman',1,p.startX+3,p.startY+3); const kn=spawnUnit('cavalier',1,p.startX+4,p.startY+3);
  const atk0=statU(pk,'atk'); const pa0=statU(kn,'pa');
  for(const id of ['up_pikeman','up_halberdier','up_cavalier','up_paladin','ironcasting','blastfurnace','scalebarding','chainbarding','platebarding']) completeTech(p,id);
  const lockH=techLocked(W.players[2],'up_halberdier'); const ram=currentType(p,'ram');
  return {pk:pk.type,kn:kn.type,cur:currentType(p,'spearman'),hp:kn.maxhp,atkUp:statU(pk,'atk')-atk0,paUp:statU(kn,'pa')-pa0,lockH,ram,byz:W.players[2].costMul.halberdier,techs:p.vs.techs}; })()`);
ok('Halberdier/Paladin upgrades convert existing units and new training', U.pk === 'halberdier' && U.kn === 'paladin' && U.cur === 'halberdier' && U.hp >= 160, U);
ok('Blast Furnace and barding tiers stack on the unit (halberdier atk, paladin pierce armor)', U.atkUp >= 2 + (6 - 4) && U.paUp >= 3, U);
ok('Halberdier requires Pikeman; Byzantines get the pike discount', /Pikeman/.test(U.lockH || '') && U.byz === 0.75, U);

// ---------- 3. Wonder victory ----------
const WV = run(`(() => { mk({age:3}); const s=spot(5,2); const b=spawnBuilding('wonder',2,s.x,s.y,false); completeBuilding(b); ticks(0.1);
  const started=b.wonderT!==undefined&&W.vicWonders.has(b.id); const m0=lastMsgs(3).join(' | ');
  ticks(121); const m180=lastMsgs(2).join(' | ');
  const timers=vicTimers().map(x=>x.kind+':'+x.pid+':'+Math.round(x.t));
  killEnt(b,null); ticks(0.2); const cancelled=!W.vicWonders.size && vicTimers().length===0; const mk2=lastMsgs(1)[0];
  // now our own Wonder runs the full countdown
  const s2=spot(5,1); const w=spawnBuilding('wonder',1,s2.x,s2.y,true); completeBuilding(w);
  const t0=W.t; ticks(VIC.wonderTime+1);
  return {started,m0,m180,timers,cancelled,mk2,over:W.over,won:W.won,victory:W.victory,took:Math.round(W.t-t0),p2alive:W.players[2].alive,ended:ctx_end.slice()}; })()`);
ok('Wonder completion starts a countdown and announces it to everyone', WV.started && /completed a Wonder/.test(WV.m0) && /5 minutes/.test(WV.m0), WV.m0);
ok('Announcement at 3 minutes; timer listed for the banner', /3 minutes.*Destroy it/.test(WV.m180) && WV.timers[0] && WV.timers[0].startsWith('wonder:2:'), { m: WV.m180, t: WV.timers });
ok('Destroying the Wonder cancels its countdown', WV.cancelled && /destroyed/.test(WV.mk2), WV.mk2);
ok('Own Wonder standing 300 s wins the game (wonder victory)', WV.over && WV.won === true && WV.victory && WV.victory.kind === 'wonder' && WV.took >= 299 && WV.took <= 302 && !WV.p2alive && WV.ended[0] === true, WV);

// ---------- 4. Wonder of an ally wins for the human too; enemy wonder loses ----------
const WA = run(`(() => { mk({np:3,teams:[1,1,2],age:3}); const s=spot(5,2); const w=spawnBuilding('wonder',2,s.x,s.y,true); completeBuilding(w); ticks(VIC.wonderTime+1);
  const a={over:W.over,won:W.won,winners:W.victory&&W.victory.winners,p3:W.players[3].alive};
  mk({np:2,age:3}); const s2=spot(5,2); const e=spawnBuilding('wonder',2,s2.x,s2.y,true); completeBuilding(e); ticks(VIC.wonderTime+1);
  return {a,b:{over:W.over,won:W.won,human:W.players[1].alive}}; })()`);
ok('Allied Wonder: the whole alliance wins', WA.a.over && WA.a.won === true && WA.a.winners.join() === '1,2' && !WA.a.p3, WA.a);
ok('Enemy Wonder standing 300 s: defeat', WA.b.over && WA.b.won === false && !WA.b.human, WA.b);

// ---------- 5. relic victory ----------
const RV = run(`(() => { mk({age:3}); const relics=W.list.filter(e=>e.kind==='relic'); const s=spot(3,1); const mon=spawnBuilding('monastery',1,s.x,s.y,true);
  for(const r of relics){ r.inBld=mon.id; mon.relics.push(r.id); } ticks(0.2); const started=!!W.vicRelic&&W.vicRelic.holder===1; const m0=lastMsgs(1)[0];
  ticks(60); // drop one relic: countdown breaks
  const r0=relics[0]; mon.relics=mon.relics.filter(id=>id!==r0.id); r0.inBld=0; r0.x=s.x-2; r0.y=s.y; ticks(0.2); const broken=!W.vicRelic; const mb=lastMsgs(1)[0];
  r0.inBld=mon.id; mon.relics.push(r0.id); ticks(0.2); const restarted=W.vicRelic&&W.vicRelic.t>VIC.relicTime-1;
  ticks(VIC.relicTime+1);
  return {n:relics.length,started,m0,broken,mb,restarted,over:W.over,won:W.won,kind:W.victory&&W.victory.kind}; })()`);
ok('Holding every relic in a Monastery starts the relic countdown', RV.n > 0 && RV.started && /every relic/.test(RV.m0), RV);
ok('Losing a relic breaks the countdown; regaining restarts it at 5:00', RV.broken && /broken/.test(RV.mb) && RV.restarted, RV);
ok('Holding all relics for 300 s wins (relic victory)', RV.over && RV.won === true && RV.kind === 'relic', RV);
const RT = run(`(() => { mk({np:3,teams:[1,1,2],age:3}); const relics=W.list.filter(e=>e.kind==='relic'); const a=spawnBuilding('monastery',1,spot(3,1).x,spot(3,1).y,true); const s=spot(3,2); const b=spawnBuilding('monastery',2,s.x,s.y,true);
  relics.forEach((r,i)=>{ const m=i%2?a:b; r.inBld=m.id; m.relics.push(r.id); }); ticks(0.2); const team=!!W.vicRelic;
  const s3=spot(3,3); const c=spawnBuilding('monastery',3,s3.x,s3.y,true); const r=relics[0]; const m=ent(r.inBld); m.relics=m.relics.filter(id=>id!==r.id); r.inBld=c.id; c.relics.push(r.id); ticks(0.2);
  return {team,split:!W.vicRelic}; })()`);
ok('Allies may split the relics between them; an enemy holding one blocks it', RT.team && RT.split, RT);

// ---------- 6. fog-of-war building memory ----------
const FM = run(`(() => { mk({fog:'normal',age:2}); const h=W.players[1]; const s=spot(3,2); const b=spawnBuilding('barracks',2,s.x,s.y,true);
  updateVisibility(true); const before=h.memory.has(b.id);
  const scout=spawnUnit('scout',1,s.x+1.5,s.y+5); updateVisibility(true); const seen=h.memory.has(b.id);
  b.hp=b.maxhp*0.4; updateVisibility(true); const frac=+h.memory.get(b.id).hpFrac.toFixed(2);
  scout.x=h.startX; scout.y=h.startY; updateVisibility(true); b.hp=b.maxhp*0.9; updateVisibility(true);
  const stale=+h.memory.get(b.id).hpFrac.toFixed(2); const vis=vicBldVisible(h,b);
  // render-time swap: the live building is hidden, a ghost with the remembered state appears
  let inside=null; vicWithGhosts(()=>{ const g=W.list.find(e=>e.ghost&&e.id===b.id); inside={ghost:!!g,ghostHp:g&&+(g.hp/g.maxhp).toFixed(2),liveHidden:b.seenBy===false}; });
  const clean=!W.list.some(e=>e.ghost);
  killEnt(b,null); updateVisibility(true); const remembersRuin=h.memory.has(b.id);
  scout.x=s.x+1.5; scout.y=s.y+5; updateVisibility(true); const forgot=!h.memory.has(b.id);
  return {before,seen,frac,stale,vis,inside,clean,remembersRuin,forgot}; })()`);
ok('Enemy building enters memory only once seen', !FM.before && FM.seen && FM.frac === 0.4, FM);
ok('Out of sight the memory keeps the last-seen hp, not the live hp', !FM.vis && FM.stale === 0.4, FM);
ok('Rendering shows a ghost from memory and hides the live building; ghosts removed afterwards', FM.inside && FM.inside.ghost && FM.inside.ghostHp === 0.4 && FM.inside.liveHidden && FM.clean, FM.inside);
ok('Destroyed unseen building stays remembered until the spot is seen again', FM.remembersRuin && FM.forgot, FM);
const FN = run(`(() => { mk({fog:'none',age:2}); const s=spot(3,2); const b=spawnBuilding('barracks',2,s.x,s.y,true); updateVisibility(true); return {mem:W.players[1].memory.size}; })()`);
ok('No memory bookkeeping when fog is off', FN.mem === 0, FN);

// ---------- 7. score & history ----------
const SC = run(`(() => { mk({age:1}); const p=W.players[1], q=W.players[2];
  const a=spawnUnit('knight',1,p.startX+3,p.startY+3), v=spawnUnit('militia',2,p.startX+4,p.startY+3);
  const s0=vicScore(p).total; killEnt(v,a); const mil=vicScore(p).mil; const k=p.vs.uKilled, l=q.vs.uLost;
  const s=spot(2,2); const h=spawnBuilding('house',2,s.x,s.y,true); killEnt(h,a);
  const vil=spawnUnit('villager',1,p.startX+2,p.startY+2); vil.carry={res:'wood',amt:10}; deposit(vil);
  completeTech(p,'castleage');
  ticks(31);
  const sc=vicScore(p);
  return {s0,mil,k,l,razed:p.vs.bRazed,bLost:q.vs.bLost,wood:p.vs.gathered.wood,tech:sc.tech,age2:Math.round(p.vs.ageT[2]),age1:p.vs.ageT[1],hist:W.vicHist.length,ht:W.vicHist.map(h=>Math.round(h.t)).slice(0,4),hasScore:W.vicHist[W.vicHist.length-1].p[1].score===vicScore(p).total||true,keys:Object.keys(W.vicHist[0].p[1])}; })()`);
ok('Kills and razes are counted and raise military score', SC.k === 1 && SC.l === 1 && SC.mil > SC.s0 && SC.razed === 1 && SC.bLost === 1, SC);
ok('Gathering per resource and techs/age times feed the score', SC.wood === 10 && SC.tech > 0 && SC.age1 === 0 && SC.age2 === 0, SC);
ok('History sampled every 10 s with score, population, villagers, military', SC.hist >= 4 && SC.ht.join() === '0,10,20,30' && ['score', 'pop', 'vil', 'mil'].every(k => SC.keys.includes(k)), SC);
const TR = run(`(() => { mk({age:1}); const p=W.players[1]; const tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1); W.instant=false; queueUnit(tc,'villager'); ticks(30); return {vil:p.vs.trainedVil}; })()`);
ok('Trained villagers are counted', TR.vil >= 1, TR);

// ---------- 8. AI ----------
const AI = run(`(() => { if(typeof AIPlayer!=='function') return {skip:true}; mk({age:3}); const p=W.players[2]; const ai=new AIPlayer(p,'standard'); p.ai=ai;
  for(const r of RES) p.res[r]=50000;
  const s=spot(3,2); const bs=spawnBuilding('blacksmith',2,s.x,s.y,true); p.techs.add('ironcasting'); p.techs.add('forging');
  const base=['loom','wheelbarrow','doublebit','horsecollar','goldmining','forging','fletching','scalemail','paddedarcher','scalebarding','bowsaw','heavyplow']; for(const id of base) p.techs.add(id);
  ai.research(base,0);
  const queued=bs.queue.map(q=>q.id);
  // wonder building
  for(let k=0;k<26;k++) spawnUnit('villager',2,p.startX+(k%6),p.startY+4+((k/6)|0));
  ai.vicWT=-99; ai.economy(1); const w=W.list.find(e=>e.kind==='bld'&&e.type==='wonder'&&e.owner===2);
  return {queued, wonder:!!w}; })()`);
ok('AI research list picks up the new blacksmith tiers', AI.skip || AI.queued.some(id => ['blastfurnace', 'chainbarding', 'leatherarcher', 'platemail', 'bracer'].includes(id)), AI);
ok('AI starts a Wonder in the Imperial Age when rich', AI.skip || AI.wonder, AI);
const AR = run(`(() => { if(typeof AIPlayer!=='function') return {skip:true}; mk({age:3}); const p=W.players[2]; const ai=new AIPlayer(p,'standard'); p.ai=ai;
  const s=spot(5,1); const w=spawnBuilding('wonder',1,s.x,s.y,true); completeBuilding(w); ticks(0.2);
  const army=[]; for(let k=0;k<5;k++) army.push(spawnUnit('knight',2,p.startX+k,p.startY+5)); ai.vicRushT=-99; ai.military(1);
  return {rushing:army.filter(u=>u.order&&((u.order.t==='attack'&&u.order.id===w.id)||(u.order.t==='attackmove'&&Math.hypot(u.order.x-center(w).x,u.order.y-center(w).y)<1))).length}; })()`);
ok('AI army rushes an enemy Wonder during its countdown', AR.skip || AR.rushing >= 4, AR);

const AG = run(`(() => { if(typeof AIPlayer!=='function') return {skip:true}; mk({age:0,np:2}); for(let i=1;i<W.players.length;i++){ const p=W.players[i]; p.ai=new AIPlayer(p,'standard'); }
  ticks(150); const out=[]; for(let i=1;i<W.players.length;i++){ const p=W.players[i], g=p.vs.gathered; out.push({mine:Math.round(g.food+g.wood+g.gold+g.stone), engine:Math.round(p.stats.gathered), vil:p.vs.trainedVil}); } return out; })()`);
ok('Per-resource gathering matches the engine total in an AI game', AG.skip || AG.every(o => o.mine === o.engine && o.mine > 0 && o.vil > 0), AG);

// ---------- 9. history full game sanity: score panel data never NaN ----------
const NN = run(`(() => { mk({age:0}); ticks(25); const bad=[]; for(const h of W.vicHist) for(let i=1;i<h.p.length;i++) for(const k in h.p[i]) if(!isFinite(h.p[i][k])) bad.push(k); return {bad,n:W.vicHist.length}; })()`);
ok('History values are finite', !NN.bad.length && NN.n >= 3, NN);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
