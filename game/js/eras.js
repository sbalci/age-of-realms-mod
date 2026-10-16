// Playable ages after Imperial: modern firearms and armor, then energy weapons and walkers.
'use strict';
AGES.push('Modern Age', 'Future Age');
VIC_ROMAN.push('V', 'VI');
AGE_REQ[4] = ['university', 'siege', 'castle'];
AGE_REQ[5] = ['university', 'siege', 'market'];
Object.assign(TECHS, {
  modernage: { name: 'Modern Age', at: 'tc', age: 3, ageUp: 4, cost: { food: 2000, wood: 1000, gold: 1200 }, time: 180, hk: 'W', icon: 'age4', desc: 'Advance beyond Imperial. Unlock riflemen, marksmen, tanks and industrial research. Requires two of University, Siege Workshop and Castle.' },
  futureage: { name: 'Future Age', at: 'tc', age: 4, ageUp: 5, req: ['industrialization', 'electronics'], cost: { food: 3000, wood: 1500, gold: 2200 }, time: 210, hk: 'W', icon: 'age5', desc: 'Unlock plasma infantry, railgunners and fusion walkers. Requires Industrialization, Electronics and two advanced economy/military buildings.' },
  industrialization: { name: 'Industrialization', at: 'university', age: 4, cost: { food: 400, wood: 500, gold: 400 }, time: 70, hk: 'G', icon: 'saw', desc: 'Wood and stone gathering +20%; new farms +100 food.', fx: p => { p.gather.wood *= 1.2; p.gather.stone *= 1.2; p.farmFood += 100; } },
  electronics: { name: 'Electronics', at: 'university', age: 4, cost: { wood: 400, gold: 600 }, time: 80, hk: 'S', icon: 'eye', desc: 'Modern and future infantry +1 line of sight. Required for the Future Age.', fx: p => addUp(p, 'advanced', { los: 1 }) },
  rifling: { name: 'Precision Rifling', at: 'blacksmith', age: 4, cost: { food: 300, gold: 450 }, time: 65, hk: 'A', icon: 'arrow2', desc: 'Firearm infantry +3 attack and +1 range.', fx: p => addUp(p, 'firearm', { atk: 3, range: 1 }) },
  compositearmor: { name: 'Composite Armor', at: 'blacksmith', age: 4, cost: { wood: 350, gold: 500 }, time: 75, hk: 'S', icon: 'armor2', desc: 'Armored vehicles +2 melee and pierce armor.', fx: p => addUp(p, 'vehicle', { ma: 2, pa: 2 }) },
  fusionpower: { name: 'Fusion Power', at: 'university', age: 5, cost: { food: 500, gold: 900 }, time: 100, hk: 'D', icon: 'gold', desc: 'Gold and stone gathering +25%.', fx: p => { p.gather.gold *= 1.25; p.gather.stone *= 1.25; } },
  energyweapons: { name: 'Energy Focusing', at: 'blacksmith', age: 5, cost: { food: 400, gold: 800 }, time: 90, hk: 'D', icon: 'sword2', desc: 'Plasma and rail weapons +6 attack.', fx: p => addUp(p, 'energy', { atk: 6 }) },
  nanorepair: { name: 'Nanorepair', at: 'university', age: 5, cost: { food: 600, gold: 1000 }, time: 100, hk: 'F', icon: 'armor2', desc: 'Your armored vehicles slowly repair themselves (1 HP per second).', fx: p => { p.nanoRepair = true; } },
});
Object.assign(UNITS, {
  rifleman: { name: 'Rifleman', tags: ['infantry', 'land', 'advanced', 'firearm'], hp: 95, atk: 15, ma: 1, pa: 3, range: 6, rof: 1.6, speed: 1.05, los: 8, cost: { food: 65, gold: 55 }, time: 28, age: 4, from: 'barracks', hk: 'R', proj: 'bullet', draw: 'janissary', artRole: 'gunner', era: 'modern', desc: 'Modern ranged infantry. Strong against medieval troops; vulnerable to armor and siege.' },
  marksman: { name: 'Marksman', tags: ['infantry', 'land', 'advanced', 'firearm'], hp: 65, atk: 24, ma: 0, pa: 2, range: 9, rof: 3.2, speed: 1, los: 11, cost: { food: 55, gold: 90 }, time: 35, age: 4, from: 'range', hk: 'R', proj: 'bullet', draw: 'bow', artRole: 'archer', era: 'modern', desc: 'Long-range precision rifle. Slow firing and lightly armored.' },
  tank: { name: 'Battle Tank', tags: ['siege', 'machine', 'vehicle', 'land', 'advanced'], hp: 420, atk: 55, ma: 8, pa: 10, range: 7, minRange: 1, rof: 4, speed: 0.8, los: 9, blast: 1.1, bonus: { building: 45 }, cost: { wood: 220, gold: 200 }, time: 65, age: 4, from: 'siege', hk: 'T', proj: 'shell', draw: 'mangonel', artRole: 'tank', era: 'modern', desc: 'Armored tracked vehicle with an explosive cannon. Expensive and slow; no aging.' },
  plasmaguard: { name: 'Plasma Guard', tags: ['infantry', 'land', 'advanced', 'energy'], hp: 140, atk: 23, ma: 4, pa: 5, range: 7, rof: 1.8, speed: 1.1, los: 9, cost: { food: 90, gold: 100 }, time: 36, age: 5, from: 'barracks', hk: 'T', proj: 'plasma', draw: 'janissary', artRole: 'gunner', era: 'future', desc: 'Powered infantry with a plasma carbine. Durable, versatile and costly.' },
  railgunner: { name: 'Railgunner', tags: ['infantry', 'land', 'advanced', 'energy'], hp: 85, atk: 38, ma: 2, pa: 3, range: 10, rof: 3, speed: 1.05, los: 12, bonus: { vehicle: 25 }, cost: { food: 70, gold: 145 }, time: 42, age: 5, from: 'range', hk: 'T', proj: 'laser', draw: 'bow', artRole: 'archer', era: 'future', desc: 'Long-range electromagnetic rifle. Particularly effective against armored vehicles.' },
  fusionwalker: { name: 'Fusion Walker', tags: ['siege', 'machine', 'vehicle', 'land', 'advanced', 'energy'], hp: 560, atk: 78, ma: 10, pa: 12, range: 8, minRange: 1, rof: 4.5, speed: 0.75, los: 10, blast: 1.4, bonus: { building: 65 }, cost: { wood: 280, gold: 350 }, time: 85, age: 5, from: 'siege', hk: 'G', proj: 'plasma', draw: 'mangonel', artRole: 'walker', era: 'future', desc: 'Heavy ground walker with a fusion cannon. Strong at siege; vulnerable to railgun fire. No aging.' },
});
for (const [id, t] of Object.entries(TECHS)) {
  const list = TECHS_AT[t.at] || (TECHS_AT[t.at] = []);
  if (!list.includes(id)) list.push(id);
}
TRAIN.barracks.push('rifleman', 'plasmaguard');
TRAIN.range.push('marksman', 'railgunner');
TRAIN.siege.push('tank', 'fusionwalker');

GameHooks.on('beforeTick', dt => {
  if (!W || W.menu) return;
  for (const p of W.players) if (p && p.nanoRepair) for (const u of W.list) {
    if (u.kind === 'unit' && u.owner === p.id && !u.dying && hasTag(u.type, 'vehicle')) u.hp = Math.min(u.maxhp, u.hp + dt);
  }
});

// Later-age AIs keep the existing army planner and replace its production choices with current units.
const eraAdapt = AIPlayer.prototype.adaptTypes;
AIPlayer.prototype.adaptTypes = function (building, types) {
  if (this.p.age >= 4) {
    const future = this.p.age >= 5;
    if (building === 'barracks') return [future ? 'plasmaguard' : 'rifleman'];
    if (building === 'range') return [future ? 'railgunner' : 'marksman'];
    if (building === 'siege') return [future ? 'fusionwalker' : 'tank'];
  }
  return eraAdapt ? eraAdapt.call(this, building, types) : types;
};
const eraEconomy = AIPlayer.prototype.economy;
AIPlayer.prototype.economy = function (dt) {
  eraEconomy.call(this, dt);
  const p = this.p;
  if (p.age < 4 || p.bell) return;
  for (const id of ['industrialization', 'electronics', 'rifling', 'compositearmor', 'fusionpower', 'energyweapons', 'nanorepair']) {
    const t = TECHS[id], b = W.list.find(e => e.kind === 'bld' && e.owner === p.id && e.type === t.at && e.built && !e.queue.length);
    if (b && !techLocked(p, id, b) && canPay(p, effCost(p, id, true))) { queueTech(b, id); break; }
  }
};
