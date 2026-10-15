// Headless tests for game/js/balance.js and game/js/tactics.js: node tests/tactics.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`function fresh(seed){ const spec=generateMapSpec({size:'small',seed,mapType:'land',numPlayers:2});
  createWorld(spec,{players:[{name:'A',civ:'franks',color:PLAYER_COLORS[0],human:true},{name:'B',civ:'teutons',color:PLAYER_COLORS[1]}],seed,fog:'none',startRes:'high',startAge:2,difficulty:'standard'}); }
function flat(w,h){ const m=W.map; const tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc');
  for(let y=6;y<m.n-h-6;y++) for(let x=6;x<m.n-w-6;x++){ let ok=true; for(let b=0;b<h&&ok;b++) for(let a=0;a<w;a++){ const i=m.idx(x+a,y+b); if(isWaterT(m.ter[i])||m.ter[i]===T.SHALLOW||m.ter[i]===T.FOREST||m.blk[i]||m.elev[i]!==0){ok=false;break;} } if(ok&&!tcs.some(t=>Math.hypot(t.x-x,t.y-y)<12)) return {x,y}; } return null; }
fresh(4);`);

// ---------- terrain and battle modifiers ----------
const A = run(`(() => { const o=flat(10,6), m=W.map;
  const arch=spawnUnit('archer',1,o.x+0.5,o.y+2.5), foe=spawnUnit('militia',2,o.x+4.5,o.y+2.5);
  const open=computeDamage(arch,foe);
  m.ter[m.idx(o.x+4,o.y+2)]=T.FOREST; const forest=computeDamage(arch,foe); m.ter[m.idx(o.x+4,o.y+2)]=T.GRASS;
  const sw=spawnUnit('militia',1,o.x+3.5,o.y+2.5); const meleeOpen=computeDamage(sw,foe);
  m.ter[m.idx(o.x+3,o.y+2)]=T.SHALLOW; const fromFord=computeDamage(sw,foe); m.ter[m.idx(o.x+3,o.y+2)]=T.GRASS;
  m.ter[m.idx(o.x+4,o.y+2)]=T.SHALLOW; const intoFord=computeDamage(sw,foe); m.ter[m.idx(o.x+4,o.y+2)]=T.GRASS;
  [arch,foe,sw].forEach(removeEnt);
  return {open,forest,meleeOpen,fromFord,intoFord}; })()`);
ok('forest cover: arrows do 25% less to a unit in forest', Math.abs(A.forest - A.open * 0.75) < 1e-9, A);
ok('fords: fighting from a ford is weaker, being caught in one hurts', Math.abs(A.fromFord - A.meleeOpen * 0.8) < 1e-9 && Math.abs(A.intoFord - A.meleeOpen * 1.15) < 1e-9, A);
const B = run(`(() => { const o=flat(10,6);
  const t=spawnUnit('militia',2,o.x+4.5,o.y+2.5), front=spawnUnit('militia',1,o.x+5.3,o.y+2.5), back=spawnUnit('militia',1,o.x+3.7,o.y+2.5);
  t.dir=0; t.anim='attack'; t.order={t:'attack',id:front.id};
  const flank=computeDamage(back,t), head=computeDamage(front,t);
  const vet=spawnUnit('knight',1,o.x+2.5,o.y+3.5); vet.rank=2; rebuildGrid(); back._ledT=undefined; const led=computeDamage(back,t);
  [t,front,back,vet].forEach(removeEnt);
  return {flank,head,led}; })()`);
ok('flanking: hitting a busy unit from behind does 20% more', Math.abs(B.flank - B.head * 1.2) < 1e-9, B);
ok('a nearby Elite veteran lifts damage by 10%', Math.abs(B.led - B.flank * 1.1) < 1e-9, B);
const H = run(`(() => { const o=flat(8,8), m=W.map; m.elev[m.idx(o.x+5,o.y+5)]=2; m.elev[m.idx(o.x+5,o.y+6)]=1; m.computeVH(); m.computeRegions();
  const ai=new AIPlayer(W.players[2],'standard'); const p=ai.highGround(o.x+4,o.y+4,3); return {p, want:[o.x+5.5,o.y+5.5]}; })()`);
ok('AI finds the high ground nearby', H.p && H.p.x === H.want[0] && H.p.y === H.want[1], H);

// ---------- battle memory and troop choice ----------
const M = run(`(() => { fresh(6); const p=W.players[2]; p.ai=new AIPlayer(p,'standard');
  const before=p.ai.adaptTypes('barracks',['militia','spearman']).length;
  const o=flat(6,4), k=spawnUnit('knight',1,o.x+0.5,o.y+0.5), s=spawnUnit('militia',2,o.x+1.5,o.y+0.5);
  for(let i=0;i<40;i++) computeDamage(k,s);
  const pool=p.ai.adaptTypes('barracks',['militia','spearman']);
  return {before, n:pool.length, spear:pool.filter(t=>t==='spearman').length, seen:Math.round(p.ai.battle.seen.cavalry||0)}; })()`);
ok('after losing to cavalry, the AI trains more spearmen', M.before === 2 && M.spear >= 3 && M.seen > 150, M);

// ---------- AI battle discipline ----------
const D = run(`(() => { fresh(8); const p=W.players[2]; p.ai=new AIPlayer(p,'standard'); const ai=p.ai;
  const tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===2);
  const v=spawnUnit('militia',2,tc.x+6.5,tc.y+6.5); v.rank=1; v.hp=v.maxhp*0.2;
  ai.tacT=2; ai.tactics(0); const retreat=v.order&&v.order.t;
  // a wave that lost most of its strength pulls back
  const w=[]; for(let k=0;k<8;k++) w.push(spawnUnit('militia',2,tc.x+8.5+k*0.5,tc.y+9.5));
  ai.state='attacking'; ai.waveStart=0; ai.tacT=2; ai.tactics(0); const start=ai.waveStart;
  for(const u of w) u.hp=u.maxhp*0.2; ai.tacT=2; ai.tactics(0);
  return {retreat, start:start>0, state:ai.state, regroups:ai.regroups||0}; })()`);
ok('a wounded veteran falls back into a garrison to heal', D.retreat === 'garrison', D);
ok('a broken wave regroups instead of dying piecemeal', D.start && D.state === 'boom' && D.regroups === 1, D);
const S = run(`(() => { fresh(9); const p=W.players[2]; p.ai=new AIPlayer(p,'standard'); const ai=p.ai;
  const tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===2), etc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const army=[]; for(let k=0;k<8;k++) army.push(spawnUnit('militia',2,tc.x+5.5+(k%4),tc.y+5.5+(k>>2)));
  const tgt=center(etc); const first=ai.stageAttack(army,tgt); const st=ai.staging;
  const d=Math.hypot(st.x-tgt.x,st.y-tgt.y);
  for(const u of army){ u.x=st.x; u.y=st.y; } const second=ai.stageAttack(army,tgt);
  return {first, second, d:+d.toFixed(1), moving:army.every(u=>u.order&&u.order.t==='move')}; })()`);
ok('an AI wave gathers short of the target, then attacks together', S.first && !S.second && S.d > 6 && S.d < 18 && S.moving, S);

// ---------- economy: water and ageing ----------
const E = run(`(() => { fresh(10); const p=W.players[1];
  const v=spawnUnit('villager',1,20.5,20.5); v.lifeK=1; v.vows=false;
  const life0=modLimits(v).max; p.techs.add('herbalmedicine'); TECHS.herbalmedicine.fx(p); const life1=modLimits(v).max;
  recalcPop(); const cap0=p.waterCap; TECHS.sanitation.fx(p); recalcPop(); const cap1=p.waterCap;
  v.bornT=W.t-life1*0.9; const tree=W.list.find(e=>e.kind==='res'&&e.type==='tree'); const rOld=gatherRate(v,tree); v.bornT=W.t; const rYoung=gatherRate(v,tree);
  v.bornT=W.t-(life1-60); const retiring=balRetiring(v); v.bornT=W.t; const young=balRetiring(v);
  return {villagerLife:MOD.life.villager, vows:MOD.life.villagerVows, life0, life1, cap0, cap1, ratio:+(rOld/rYoung).toFixed(3), retiring, young}; })()`);
ok('villagers live about 30 minutes; vows at about 18', E.villagerLife === 1800 && E.vows === 1080, E);
ok('Herbal Medicine adds 20% to lifespans', Math.abs(E.life1 - E.life0 * 1.2) < 1e-6, E);
ok('Sanitation raises clean-water capacity', E.cap1 > E.cap0, E);
ok('elders gather 15% slower', E.ratio === 0.85, E);
ok('the AI sees villagers who will retire within two minutes', E.retiring && !E.young, E);
const R = run(`(() => { fresh(11); const p=W.players[2]; p.ai=new AIPlayer(p,'standard');
  const vs=W.list.filter(u=>u.kind==='unit'&&u.owner===2&&u.type==='villager'); for(const v of vs){ v.lifeK=1; v.bornT=W.t-(modLimits(v).max-30); }
  const tc=W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===2); p.res.food=1000; tc.queue=[];
  p.ai.economy(1); return {queued: tc.queue.filter(q=>q.kind==='unit'&&q.id==='villager').length}; })()`);
ok('the AI queues replacements for villagers about to die', R.queued >= 1, R);
// soak: AI vs AI for 8 minutes with everything on
const Z = run(`(() => { fresh(12); for(const p of W.players.slice(1)) p.ai=new AIPlayer(p,'standard'); W.spectate=true; let err=null;
  try { for(let i=0;i<20*60*8;i++) worldTick(0.05); } catch(e){ err=String(e.stack||e).slice(0,300); }
  return {err, mem:!!(W.players[1].ai.battle||W.players[2].ai.battle)}; })()`);
ok('8-minute AI soak with tactics and balance runs clean', !Z.err, Z);
console.log(`\n${pass} passed, ${fail} failed`);
