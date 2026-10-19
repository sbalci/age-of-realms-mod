// Headless tests for mod.js. Usage: node modtest.js <path-to-mod-js-dir>
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
let aiLoaded = true;
for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js']) load(f);
try { load('ai.js'); } catch (e) { aiLoaded = false; console.log('ai.js not loadable headless:', e.message); }
load('mod.js');
if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js','movement.js']) if (!LOADED.has(f)) load(f);
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };

run(`
var PC = [{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'}];
var spec = generateMapSpec({ size: 'small', seed: 11, mapType: 'land', numPlayers: 2 });
createWorld(spec, { players: [{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}], seed: 11, fog: 'none', startRes: 'high', startAge: 1 });
for (let i = 0; i < 100; i++) worldTick(0.05);
`);
ok('mod hooks installed', run(`typeof MOD === 'object' && MOD.aging && MOD.veterans`));

// ---- aging ----
const a = run(`(() => {
  const p = W.players[1], tc = W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const v = spawnUnit('villager', 1, tc.x - 3, tc.y + 6); v.lifeK = 1; v.vows = true; v.bornT = W.t - (MOD.life.villagerVows + 100); v.carry = { res: 'wood', amt: 7 };
  const woodBefore = p.res.wood, id = v.id; recalcPop(); const popBefore = p.pop;
  worldTick(0.05);
  recalcPop();
  return { type: v.type, sameEntity: ent(id) === v, woodGain: p.res.wood - woodBefore, carryCleared: !v.carry, orderNull: !v.order, popBefore, popAfter: p.pop, maxhp: v.maxhp, monkHp: UNITS.monk.hp };
})()`);
ok('villager past vows age becomes monk', a.type === 'monk' && a.sameEntity, a);
ok('carried goods deposited on transformation', a.woodGain === 7);
ok('population unchanged by transformation', a.popBefore === a.popAfter);
ok('monk has monk hit points', a.maxhp >= a.monkHp);

const b = run(`(() => {
  const p = W.players[1], tc = W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const v = spawnUnit('villager', 1, tc.x - 4, tc.y + 6); v.lifeK = 1; v.vows = true; v.bornT = W.t - (Math.max(MOD.life.villager, MOD.life.villagerVows) + 100);
  const lost0 = p.stats.lost, kills0 = W.players[2].stats.kills;
  worldTick(0.05);
  return { dying: !!v.dying, lostDelta: p.stats.lost - lost0, killsDelta: W.players[2].stats.kills - kills0 };
})()`);
ok('villager past max age dies', b.dying, b);
ok('old-age death is not a battle loss', b.lostDelta === 0 && b.killsDelta === 0);

const c = run(`(() => {
  const tc = W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const u = spawnUnit('militia', 1, tc.x - 3, tc.y + 6); u.lifeK = 1;
  garrisonUnit(u, tc);
  const inBefore = tc.garrison.includes(u.id);
  u.bornT = W.t - 5000;
  worldTick(0.05);
  return { inBefore, stillListed: tc.garrison.includes(u.id), dyingOrGone: !!u.dying || !!u.dead, insideFlag: u.inside };
})()`);
ok('garrisoned unit dying of age leaves the garrison list', c.inBefore && !c.stillListed && c.dyingOrGone && !c.insideFlag, c);

const d = run(`(() => {
  const tc = W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const m = spawnUnit('monk', 1, tc.x - 5, tc.y + 6); m.lifeK = 1;
  const r = spawnRes('relic', (tc.x - 5) | 0, (tc.y + 6) | 0); r.carrier = m.id; m.relic = r.id;
  m.bornT = W.t - 5000; worldTick(0.05);
  return { monkDying: !!m.dying, relicCarrier: r.carrier, monkRelic: m.relic };
})()`);
ok('monk dying of age drops its relic', d.monkDying && d.relicCarrier === 0, d);

const e = run(`(() => {
  const tc = W.list.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1);
  const sheep = spawnUnit('sheep', 1, tc.x - 6, tc.y + 6), ram = spawnUnit('ram', 1, tc.x - 7, tc.y + 6), deer = spawnUnit('deer', 0, tc.x - 8, tc.y + 6);
  for (const u of [sheep, ram, deer]) u.bornT = W.t - 1e6;
  for (let i = 0; i < 20; i++) worldTick(0.05);
  return { sheep: !sheep.dying && !sheep.dead, ram: !ram.dying && !ram.dead, deer: !deer.dying && !deer.dead };
})()`);
ok('animals and siege never age out', e.sheep && e.ram && e.deer, e);

// ---- veterans ----
const f = run(`(() => {
  const far = (W.n - 6);
  const att = spawnUnit('militia', 1, 5.5, 5.5), vic = spawnUnit('militia', 2, far + 0.5, far + 0.5);
  att.lifeK = vic.lifeK = 1; vic.hp = vic.maxhp = 5000;
  const atk0 = statU(att, 'atk'), hp0 = att.maxhp;
  for (let i = 0; i < 6; i++) applyDamage(vic, 1, att);
  const xpAfterHits = att.xp, rankBeforeQuiet = att.rank || 0;
  for (let i = 0; i < 250; i++) worldTick(0.05);       // 12.5s quiet -> battle over
  return { xpAfterHits, rankBeforeQuiet, rank: att.rank || 0, vicRank: vic.rank || 0, atk0, atk1: statU(att, 'atk'), hp0, hp1: att.maxhp, hpNow: att.hp, expectHp: modMaxHp(att) };
})()`);
ok('XP accrues from dealing damage', f.xpAfterHits === 6, f);
ok('no promotion while the fight is still on', f.rankBeforeQuiet === 0);
ok('survivor promoted to Veteran after the battle ends', f.rank === 1 && f.vicRank === 1);
ok('veteran hits harder and has more hit points', f.atk1 > f.atk0 && f.hp1 > f.hp0 && f.hp1 === f.expectHp);

const g = run(`(() => {
  const att = spawnUnit('militia', 1, 7.5, 5.5), vic = spawnUnit('militia', 2, 40.5, 40.5);
  att.lifeK = vic.lifeK = 1; vic.hp = vic.maxhp = 40;
  applyDamage(vic, 9999, att);   // a kill: 1 (hit) + 4 (kill) = 5 xp
  return { xp: att.xp, victimDying: !!vic.dying };
})()`);
ok('a kill grants bonus XP', g.xp === 5 && g.victimDying, g);

const h = run(`(() => {
  const vil = spawnUnit('villager', 1, 9.5, 5.5), vic = spawnUnit('militia', 2, 40.5, 41.5);
  vic.hp = vic.maxhp = 5000; applyDamage(vic, 1, vil);
  const boar = spawnUnit('boar', 0, 30.5, 30.5), s = spawnUnit('militia', 1, 31.5, 30.5); boar.hp = boar.maxhp = 5000; applyDamage(boar, 1, s);
  return { vilXp: vil.xp || 0, vicGotXpFromVillager: (vic.xp || 0), soldierXpFromBoar: s.xp || 0, eligVil: modEligible(vil), eligSoldier: modEligible(s) };
})()`);
ok('villagers and animals do not earn veteran XP', h.vilXp === 0 && h.soldierXpFromBoar === 0 && !h.eligVil && h.eligSoldier, h);

const i = run(`(() => {
  const p = W.players[1];
  const u = spawnUnit('militia', 1, 11.5, 5.5); u.lifeK = 1; u.rank = 1; u.maxhp = modMaxHp(u); u.hp = u.maxhp;
  const before = u.maxhp;
  completeTech(p, 'up_manatarms');       // upgrade line: militia -> man-at-arms, hp recomputed
  const afterType = u.type, afterMax = u.maxhp, expect = Math.round(unitMaxHp('manatarms', 1) * MOD.hpMul[1]);
  completeTech(p, 'loom');               // generic hp refresh loop
  return { before, afterType, afterMax, expect, afterLoom: u.maxhp, rank: u.rank };
})()`);
ok('veteran hp bonus survives unit-line upgrade and tech hp refresh', i.afterType === 'manatarms' && i.afterMax === i.expect && i.afterLoom === i.expect && i.rank === 1, i);

const j = run(`(() => {
  const u = spawnUnit('militia', 1, 13.5, 5.5), vic = spawnUnit('militia', 2, 41.5, 41.5);
  u.lifeK = 1; vic.hp = vic.maxhp = 1e6; u.xp = 1000; vic.stance = 'noattack'; u.stance = 'ground';
  const ranks = [];
  for (let battle = 0; battle < 5; battle++) { applyDamage(vic, 1, u); for (let k = 0; k < 250; k++) worldTick(0.05); ranks.push(u.rank || 0); }
  return ranks;
})()`);
ok('one rank per battle, capped at Champion', JSON.stringify(j) === '[1,2,3,3,3]', j);

// ---- soak: AI vs AI with default lifespans and with harsh lifespans ----
function soak(label, scale, ticks) {
  const r = run(`(() => {
    MOD.lifeScale = ${scale};
    const spec2 = generateMapSpec({ size: 'small', seed: 5, mapType: 'land', numPlayers: 2 });
    createWorld(spec2, { players: [{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}], seed: 5, fog: 'none', startRes: 'standard', startAge: 0 });
    ${aiLoaded ? "for (let i = 1; i < W.players.length; i++) W.players[i].ai = new AIPlayer(W.players[i], 'standard');" : ''}
    let vows = 0, deaths = 0, promos = 0;
    const ov = modBecomeMonk, od = modDieOfAge, op = modPromote;
    modBecomeMonk = function(u){ vows++; return ov(u); }; modDieOfAge = function(u){ deaths++; return od(u); }; modPromote = function(u){ promos++; return op(u); };
    let err = null; const t0 = performance.now();
    try { for (let i = 0; i < ${ticks}; i++) worldTick(0.05); } catch (e) { err = e.stack.split('\\n').slice(0,3).join(' | '); }
    modBecomeMonk = ov; modDieOfAge = od; modPromote = op; MOD.lifeScale = 1;
    const cnt = {}; for (const e of W.list) if (e.kind === 'unit' && !UNITS[e.type].animal && e.type !== 'sheep' && !e.dying) cnt[e.owner + ':' + e.type] = (cnt[e.owner + ':' + e.type] || 0) + 1;
    return { err, ms: Math.round(performance.now() - t0), gameMin: (W.t / 60).toFixed(1), vows, deaths, promos, pop: [W.players[1].pop, W.players[2].pop], vil: [cnt['1:villager'] || 0, cnt['2:villager'] || 0], monks: [cnt['1:monk'] || 0, cnt['2:monk'] || 0] };
  })()`);
  ok(`soak ${label}: ${ticks} ticks, no exceptions`, !r.err, r);
  return r;
}
soak('lifespans x1', 1, 24000);   // 20 game minutes
soak('lifespans x0.15 (harsh)', 0.15, 12000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
