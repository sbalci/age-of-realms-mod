// AI scans through the entity index: every rewritten query gives exactly the answer of the W.list scan it replaced
// (kept below verbatim as OLD), a match played with the index equals the same match played on brute-force scans, and
// the AI's own time drops. node tests/index-ai.test.js
const crypto = require('crypto');
const harness = require('./engine-harness');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };

// ---------- 1. each rewritten query against its old scan, sampled through a 4-player match ----------
const { run } = harness();
run(`
const OLD = {
  mine(ai, filter) { return W.list.filter(e => e.owner === ai.id && filter(e)); },
  tc(ai) { return W.list.find(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'tc' && e.built) || W.list.find(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'tc'); },
  home(ai) { const tc = OLD.tc(ai); if (tc) return center(tc); const any = W.list.find(e => e.owner === ai.id && e.kind === 'bld'); if (any) return center(any); return { x: ai.p.startX, y: ai.p.startY }; },
  firstBuilding(pid) { return W.list.find(e => e.owner === pid && e.kind === 'bld'); },
  herd(ai) { return W.list.filter(s => s.kind === 'unit' && s.type === 'sheep' && s.owner === ai.id); },
  naturalFood(ai, home) { return W.list.some(e => (e.kind === 'res' && (e.type === 'berry' || e.type === 'carcass') && Math.hypot(e.x - home.x, e.y - home.y) < 22) || (e.kind === 'unit' && e.type === 'sheep' && e.owner === ai.id)); },
  hasDock(ai) { return W.list.some(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'dock'); },
  trees(home) { const trees = new Set(); for (const o of W.list) if (o.kind === 'res' && o.type === 'tree' && Math.abs(o.x - home.x) < 29 && Math.abs(o.y - home.y) < 29) trees.add(W.map.idx(o.x | 0, o.y | 0)); return trees; },
  villagers(ai) { return W.list.filter(e => e.owner === ai.id && e.type === 'villager').length; },
  sheep(ai, home) { return W.list.filter(s => s.kind === 'unit' && s.type === 'sheep' && s.owner === ai.id && !s.dying && Math.hypot(s.x - home.x, s.y - home.y) < 14).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)); },
  carc(ai, home) { return W.list.find(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(ai.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14 && e.gatherers < 5); },
  activeCarc(ai, home) { return W.list.some(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(ai.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14); },
  hunted(ai, s) { return W.list.some(u => u.kind === 'unit' && u.owner === ai.id && u.order && u.order.t === 'hunt' && u.order.id === s.id); },
  hunters(ai, id) { return W.list.filter(u => u.kind === 'unit' && u.owner === ai.id && u.order && u.order.t === 'hunt' && u.order.id === id).length; },
  farm(ai) { return W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === ai.id && f.built && !f.farmer); },
  deer(home) { return W.list.find(a => a.kind === 'unit' && a.type === 'deer' && a.owner === 0 && Math.hypot(a.x - home.x, a.y - home.y) < 20); },
  unfinished(ai) { return W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === ai.id && !f.built); },
  enemyCav(ai) { return W.list.filter(e => e.kind === 'unit' && isEnemy(ai.id, e.owner) && hasTag(e.type, 'mounted')).length; },
  enemyArch(ai) { return W.list.filter(e => e.kind === 'unit' && isEnemy(ai.id, e.owner) && hasTag(e.type, 'archer')).length; },
  relic(ai, m, reg) { return W.list.filter(r => r.kind === 'relic' && !r.carrier && !r.inBld && W.map.landReg[W.map.idx(r.x, r.y)] === reg && !W.list.some(o => o.kind === 'unit' && o.type === 'monk' && o.owner === ai.id && o.order && o.order.id === r.id)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0]; },
  attack(tp, cx, cy) {
    let tgt = null, bd = 1e9, fortTgt = null, fbd = 1e9;
    for (const e of W.list) {
      if (e.owner !== tp || e.dead) continue;
      if (e.kind === 'bld' && (BUILDINGS[e.type].wall)) continue;
      if (e.kind === 'unit' && (e.inside || UNITS[e.type].naval)) continue;
      const c = center(e), dist = Math.hypot(c.x - cx, c.y - cy);
      const d = dist - (e.type === 'tc' || e.type === 'castle' ? 4 : 0) + (e.kind === 'unit' ? 6 : 0);
      if (d < bd) { bd = d; tgt = e; }
      if (e.kind === 'bld' && (e.type === 'castle' || e.type === 'tower' || e.type === 'tc') && dist < fbd) { fbd = dist; fortTgt = e; }
    }
    return { tgt, fortTgt };
  },
  seam(x, y, size) { return W.list.some(e=>e.depth&&e.amount>0&&e.x>=x&&e.x<x+size&&e.y>=y&&e.y<y+size); },
  buried(v, res, home) { return W.list.filter(e=>e.type===res&&e.amount>0&&!mineAccessible(e)&&Math.hypot(e.x-home.x,e.y-home.y)<35&&adjReachable(v,e)); },
  coal(p) { return W.list.some(e=>e.type==='coal'&&Math.hypot(e.x-p.startX,e.y-p.startY)<40); },
  fish() { return W.list.filter(e => e.kind === 'res' && e.type === 'fish' && !e.dead); },
  unitOnTile(x, y) { return W.list.some(u => u.kind === 'unit' && Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); },
};
function sameAnswer(a, b) {
  if (a instanceof Set && b instanceof Set) return a.size === b.size && [...a].every(x => b.has(x));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  if (a && b && typeof a === 'object' && 'tgt' in a) return a.tgt === b.tgt && a.fortTgt === b.fortTgt;
  return a === b;
}
`);
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 21, mapType: 'coastal', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 2 + 1], color: PLAYER_COLORS[i], human: i === 0 })), seed: 21, fog: 'normal', startRes: 'high', startAge: 2, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(5), counts = {}, wrong = {};
  const check = (name, a, b) => { counts[name] = (counts[name] || 0) + 1; if (!sameAnswer(a, b)) wrong[name] = (wrong[name] || 0) + 1; };
  const filters = [e => e.kind === 'unit' && e.type === 'villager' && !e.dying, e => e.kind === 'bld' && e.built, e => true];
  for (let s = 0; s < 24; s++) {
    for (let i = 0; i < 400; i++) worldTick(0.05);   // 20 game seconds between samples, 8 game minutes in all
    for (const p of W.players.slice(1)) {
      const ai = p.ai, homes = [ai.home(), { x: rnd() * W.n, y: rnd() * W.n }, { x: rnd() * W.n, y: rnd() * W.n }];
      for (const f of filters) check('mine', ai.mine(f), OLD.mine(ai, f));
      check('tc', ai.tc(), OLD.tc(ai));
      const h0 = ai.home(), h1 = OLD.home(ai); check('home', h0.x === h1.x && h0.y === h1.y, true);
      for (let q = 1; q < W.players.length; q++) check('firstBuilding', ai.firstBuilding(q), OLD.firstBuilding(q));
      check('ownSheep', ai.ownSheep(), OLD.herd(ai));
      check('hasDock', ai.hasDock(), OLD.hasDock(ai));
      check('villagerCount', ai.villagerCount(), OLD.villagers(ai));
      check('freeFarm', ai.freeFarm(), OLD.farm(ai));
      check('unfinishedFarm', ai.unfinishedFarm(), OLD.unfinished(ai));
      const ec = ai.enemyUnitCounts(); check('enemyUnitCounts', ec.cav === OLD.enemyCav(ai) && ec.arch === OLD.enemyArch(ai), true);
      for (const home of homes) {
        check('naturalFoodNear', ai.naturalFoodNear(home), OLD.naturalFood(ai, home));
        check('treeTilesNear', ai.treeTilesNear(home), OLD.trees(home));
        const sheep = ai.sheepNear(home); check('sheepNear', sheep, OLD.sheep(ai, home));
        const carcs = ai.carcassesNear(home);
        check('carcass find', carcs.find(e => e.gatherers < 5), OLD.carc(ai, home));
        check('active carcass', carcs.length > 0, OLD.activeCarc(ai, home));
        for (const sh of sheep) { check('hunted sheep', ai.huntersOf(sh.id).length > 0, OLD.hunted(ai, sh)); check('huntersOf', ai.huntersOf(sh.id).length, OLD.hunters(ai, sh.id)); }
        check('deerNear', ai.deerNear(home), OLD.deer(home));
        for (const res of ['gold', 'stone', 'coal']) { const v = ai.mine(e => e.type === 'villager')[0]; if (v) check('geologyBuriedNear', geologyBuriedNear(v, res, home), OLD.buried(v, res, home)); }
      }
      check('geologyCoalNear', geologyCoalNear(p), OLD.coal(p));
      for (const m of ai.mine(e => e.kind === 'unit' && (e.type === 'monk' || e.type === 'villager')).slice(0, 4)) { const reg = W.map.landReg[W.map.idx(m.x | 0, m.y | 0)]; check('relicFor', ai.relicFor(m, reg), OLD.relic(ai, m, reg)); }
      for (let q = 1; q < W.players.length; q++) for (let k = 0; k < 3; k++) { const cx = rnd() * W.n, cy = rnd() * W.n; check('attackTargets', ai.attackTargets(q, cx, cy), OLD.attack(q, cx, cy)); }
    }
    for (let k = 0; k < 20; k++) { const x = (rnd() * W.n) | 0, y = (rnd() * W.n) | 0, size = 1 + ((rnd() * 5) | 0); check('geologySeamUnder', geologySeamUnder(x, y, size), OLD.seam(x, y, size)); }
    check('fish list', [...idxAll('res:fish')].filter(e => !e.dead), OLD.fish());
    const units = W.list.filter(e => e.kind === 'unit');
    for (let k = 0; k < 20; k++) { const u = units[(rnd() * units.length) | 0], x = (u.x - 0.5 + (rnd() - 0.5) * 2) | 0, y = (u.y - 0.5 + (rnd() - 0.5) * 2) | 0; check('wmUnitOnTile', wmUnitOnTile(x, y), OLD.unitOnTile(x, y)); }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return JSON.stringify({ t: W.t, total, wrong, counts });
})()`));
ok(`every AI, geology and water query equals its old W.list scan (${D.total} comparisons in 8 game minutes)`, D.total > 5000 && Object.keys(D.wrong).length === 0 && Object.keys(D.counts).length === 25, D);

// ---------- 2. 200 map, 8 AI players: the index plays the brute-force match exactly, with far less AI time ----------
function aiRun(brute) {
  const h = harness();
  const r = JSON.parse(h.run(`(() => {
    const spec = generateMapSpec({ size: 'gigantic', seed: 33, mapType: 'land', numPlayers: 8 });
    createWorld(spec, { players: Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true; IDX.brute = ${brute};
    let aiMs = 0; const up = AIPlayer.prototype.update;
    AIPlayer.prototype.update = function (dt) { const t0 = performance.now(); try { return up.call(this, dt); } finally { aiMs += performance.now() - t0; } };
    for (let i = 0; i < 600; i++) worldTick(0.05);
    aiMs = 0; const t0 = performance.now();
    for (let i = 0; i < 1200; i++) worldTick(0.05);
    return JSON.stringify({ aiMs: +(aiMs / 1200).toFixed(3), tickMs: +((performance.now() - t0) / 1200).toFixed(3), units: W.list.filter(e => e.kind === 'unit' && e.owner > 0).length });
  })()`));
  r.hash = crypto.createHash('sha1').update(h.run('signature()')).digest('hex');
  r.aiErrors = h.warnings.filter(w => w.startsWith('AI error')).length;
  return r;
}
const brute = aiRun(true), indexed = aiRun(false);
const R = { brute, indexed, ratio: +(brute.aiMs / indexed.aiMs).toFixed(1) };
ok('200 map, 8 AI players, 90 game seconds: the indexed match ends in exactly the brute-force state', brute.hash === indexed.hash && !brute.aiErrors && !indexed.aiErrors, R);
ok(`AI time per tick drops ${R.ratio}× with the index (at least 3×)`, R.ratio >= 3, R);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
