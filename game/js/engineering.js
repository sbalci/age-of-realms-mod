// Engineering decisions use existing jobs and costs, with bounded scans and a cooldown.
'use strict';
function aiBridgePlan(map, from, to, radius = 24) {
  const a = map.landReg[map.idx(from.x | 0, from.y | 0)], b = map.landReg[map.idx(to.x | 0, to.y | 0)];
  if (!a || !b || a === b) return null;
  let best = null, score = Infinity;
  for (let y = Math.max(1, (from.y | 0) - radius); y < Math.min(map.n - 1, from.y + radius); y++) for (let x = Math.max(1, (from.x | 0) - radius); x < Math.min(map.n - 1, from.x + radius); x++) {
    const i = map.idx(x, y); if (map.landReg[i] !== a || map.blk[i] || isWaterT(map.ter[i])) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tiles = []; let end = null;
      for (let r = 1; r <= 9; r++) {
        const xx = x + dx * r, yy = y + dy * r; if (!map.inb(xx, yy)) break;
        const j = map.idx(xx, yy); if (map.blk[j]) break;
        if (!isWaterT(map.ter[j])) { if (tiles.length && map.landReg[j] === b) end = { x: xx, y: yy }; break; }
        if (r > 8 || (map.bridge && map.bridge[j])) break;
        tiles.push({ x: xx, y: yy });
      }
      if (!end) continue;
      const cost = Math.hypot(x - from.x, y - from.y) + Math.hypot(end.x - to.x, end.y - to.y) + tiles.length * 3;
      if (cost < score) { score = cost; best = { bank: { x, y }, tiles }; }
    }
  }
  return best;
}
function aiTunnelPlan(map, start, target) {
  const dx = target.x - start.x, dy = target.y - start.y, length = Math.hypot(dx, dy);
  if (!length) return null;
  const distance = Math.min(11, length), end = { x: Math.round(start.x + dx / length * distance), y: Math.round(start.y + dy / length * distance) };
  const line = terraLine({ x: start.x | 0, y: start.y | 0 }, end).slice(0, TERRA.maxTunnel);
  const a = map.landReg[map.idx(start.x | 0, start.y | 0)];
  const b = map.inb(target.x | 0, target.y | 0) ? map.landReg[map.idx(target.x | 0, target.y | 0)] : 0;
  // Only dig when the bounded line actually opens the target's land region (or a different region if target is off-land).
  if (!line.some(q => map.inb(q.x, q.y) && map.landReg[map.idx(q.x, q.y)] && map.landReg[map.idx(q.x, q.y)] !== a && (!b || map.landReg[map.idx(q.x, q.y)] === b))) return null;
  if (line.some(q => terraCheck('tunnel', q.x, q.y))) return null;
  return line;
}
AIPlayer.prototype.engineer = function () {
  if (!TERRA.enabled || this.p.age < 1 || this.p.bell || W.t < (this.nextEngineering || 90)) return;
  this.nextEngineering = W.t + 30;
  const own = this.mine(e => e.kind === 'unit' && !e.inside && !e.dying);
  if (own.some(e => e.order && e.order.t === 'terra')) return;
  const home = this.home(), map = W.map, p = this.p;
  const targets = W.list.filter(e => e.kind === 'bld' && e.owner && isEnemy(this.id, e.owner) && !BUILDINGS[e.type].water && !BUILDINGS[e.type].wall);
  targets.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
  if (!targets.length) return;
  const goal = center(targets[0]);
  if (p.res.wood > 200) {
    const plan = aiBridgePlan(map, home, goal);
    if (plan && p.res.wood >= plan.tiles.length * TERRA.bridgeWood + 150) {
      const builders = this.pickBuilders(plan.bank.x, plan.bank.y, 2).filter(v => !v.order || !['build', 'repair', 'terra'].includes(v.order.t));
      const checked = terraPlan('bridge', plan.tiles[0], plan.tiles[plan.tiles.length - 1]);
      if (builders.length && checked.keep.length === plan.tiles.length) { terraOrder(builders, 'bridge', checked.keep); return; }
    }
  }
  const villager = own.find(e => e.type === 'villager');
  if (villager && p.res.stone > 150 && map.landReg[map.idx(villager.x | 0, villager.y | 0)] !== map.landReg[map.idx(goal.x | 0, goal.y | 0)]) {
    const path = findPath(map, villager.x | 0, villager.y | 0, { x0: goal.x | 0, y0: goal.y | 0, x1: goal.x | 0, y1: goal.y | 0, r: 3 }, unitPass(villager), 2000);
    const end = path.pts[path.pts.length - 1] || villager, line = aiTunnelPlan(map, end, goal);
    if (line && p.res.stone >= line.length * TERRA.tunnelStone + 100) {
      const sapper = own.find(e => e.type === 'sapper' && (!e.order || e.order.t === 'move'));
      if (sapper) { terraOrder([sapper], 'tunnel', line); return; }
      const camp = this.mine(e => e.type === 'miningcamp' && e.built && e.queue.length === 0)[0];
      if (camp && !own.some(e => e.type === 'sapper') && p.res.food > 100 && p.res.gold > 100) queueUnit(camp, 'sapper');
    }
  }
  // Small defensive trenches near ranged raids; avoid fencing in our cavalry or siege.
  const threats = unitsNear(home.x, home.y, 12, e => isEnemy(this.id, e.owner) && UNITS[e.type].range > 0);
  if (!threats.length || own.some(e => hasTag(e.type, 'mounted') || hasTag(e.type, 'siege'))) return;
  const defender = own.find(e => e.type === 'villager' && (!e.order || e.order.t === 'gather'));
  if (!defender) return;
  const c = center(threats[0]), dx = c.x - home.x, dy = c.y - home.y, d = Math.hypot(dx, dy) || 1;
  const x = Math.round(home.x + dx / d * 6), y = Math.round(home.y + dy / d * 6);
  const horizontal = Math.abs(dy) >= Math.abs(dx);
  const plan = terraPlan('trench', { x: x - (horizontal ? 1 : 0), y: y - (horizontal ? 0 : 1) }, { x: x + (horizontal ? 1 : 0), y: y + (horizontal ? 0 : 1) });
  if (plan.keep.length && plan.keep.every(q => map.landReg[map.idx(q.x, q.y)] === map.landReg[map.idx(defender.x | 0, defender.y | 0)])) terraOrder([defender], 'trench', plan.keep);
};
