// ===== Realms mod, batch 6: Wonders, relic victory, Imperial upgrades, fog memory, score & statistics =====
// Loaded after terra.js, before main.js. Everything extends the engine by wrapping its globals.
// URL switches: ?wonder=off (no Wonder building / wonder victory), ?relicwin=off (no relic victory), ?imperial=off (no new upgrades),
//               ?fogmem=off (live buildings under fog, as before), ?score=off (no score panel / history), ?wondertime=300, ?relictime=300
'use strict';
const VIC = {
  wonder: true, relic: true, imperial: true, fogmem: true, score: true, aiWonder: true,
  wonderTime: 300,   // game seconds a finished Wonder must stand
  relicTime: 300,    // game seconds one player (or allied team) must hold every relic
  marks: [300, 180, 60, 30],
  sampleEvery: 10,   // history sample interval (game seconds)
};
(function () {
  if (typeof location === 'undefined' || !location.search) return;
  const q = new URLSearchParams(location.search);
  for (const [k, f] of [['wonder', 'wonder'], ['relicwin', 'relic'], ['imperial', 'imperial'], ['fogmem', 'fogmem'], ['score', 'score'], ['aiwonder', 'aiWonder']]) if (q.get(k) === 'off') VIC[f] = false;
  if (+q.get('wondertime') > 0) VIC.wonderTime = +q.get('wondertime');
  if (+q.get('relictime') > 0) VIC.relicTime = +q.get('relictime');
})();
const VIC_ROMAN = ['I', 'II', 'III', 'IV'];
function vicFmt(t) { t = Math.max(0, Math.ceil(t)); return ((t / 60) | 0) + ':' + String(t % 60).padStart(2, '0'); }
// shade() returns rgb(); the building helpers need #rrggbb input, so derived tones go through this
function vicHex(col, f) { const m = shade(col, f).match(/\d+/g); return '#' + m.map(v => (+v).toString(16).padStart(2, '0')).join(''); }
function vicCostSum(c) { let s = 0; for (const r in c || {}) s += c[r] || 0; return s; }

// =====================================================================================
// 1. Data: the Wonder, Imperial/Castle unit upgrades, missing economy and blacksmith tiers
// =====================================================================================
function vicAddTech(id, t) {
  if (TECHS[id]) return;
  TECHS[id] = t;
  (TECHS_AT[t.at] = TECHS_AT[t.at] || []).push(id);
}
if (typeof BUILDINGS === 'object' && VIC.wonder && !BUILDINGS.wonder) {
  BUILDINGS.wonder = { name: 'Wonder', size: 5, hp: 4800, ma: 8, pa: 11, cost: { food: 1000, wood: 1000, stone: 1000, gold: 1000 }, time: 500, age: 3, cat: 'eco', hk: 'G', los: 8,
    desc: `A monument to your civilization. If it stands for ${VIC.wonderTime / 60} minutes after completion, you and your allies win.` };
}
if (typeof BLD_H === 'object') BLD_H.wonder = 170;
if (typeof UNITS === 'object' && VIC.imperial) {
  const U = (id, o) => { if (!UNITS[id]) UNITS[id] = o; };
  U('halberdier', { name: 'Halberdier', tags: ['infantry', 'spear', 'land'], hp: 60, atk: 6, ma: 0, pa: 0, rof: 3, speed: 1.0, los: 4, cost: { food: 35, wood: 25 }, time: 22, age: 3, from: 'barracks', hk: 'W', desc: 'Imperial pike infantry with a halberd. Devastating against cavalry.', bonus: { mounted: 32, building: 1 }, draw: 'spear' });
  U('paladin', { name: 'Paladin', tags: ['cavalry', 'mounted', 'land'], hp: 160, atk: 14, ma: 2, pa: 3, rof: 1.8, speed: 1.35, los: 5, cost: { food: 60, gold: 75 }, time: 30, age: 3, from: 'stable', hk: 'W', desc: 'The finest heavy cavalry: upgraded Cavalier.', draw: 'knight' });
  U('hcavarcher', { name: 'Heavy Cavalry Archer', tags: ['archer', 'cavalry', 'mounted', 'land'], hp: 60, atk: 7, ma: 1, pa: 1, range: 4, rof: 2, speed: 1.4, los: 6, cost: { wood: 40, gold: 70 }, time: 27, age: 3, from: 'range', hk: 'E', proj: 'arrow', desc: 'Elite mounted archer: upgraded Cavalry Archer.', bonus: { spear: 2 }, draw: 'cavarcher' });
  U('cappedram', { name: 'Capped Ram', tags: ['siege', 'machine', 'land'], hp: 200, atk: 3, ma: 0, pa: 190, rof: 5, speed: 0.5, los: 3, cost: { wood: 160, gold: 75 }, time: 36, age: 3, from: 'siege', hk: 'Q', desc: 'Iron-capped battering ram. Wrecks buildings and siege.', bonus: { building: 150, siege: 50 }, onlyBld: true, draw: 'ram' });
  U('onager', { name: 'Onager', tags: ['siege', 'machine', 'land'], hp: 60, atk: 50, ma: 0, pa: 7, range: 8, minRange: 3, rof: 6, speed: 0.6, los: 10, cost: { wood: 160, gold: 135 }, time: 46, age: 3, from: 'siege', hk: 'W', proj: 'stone', blast: 1.4, desc: 'Heavy catapult: bigger blast and range than the Mangonel.', bonus: { building: 45 }, draw: 'mangonel' });
}
if (typeof TECHS === 'object' && VIC.imperial) {
  const inf = (p, o) => addUp(p, 'infantry', o), cav = (p, o) => addUp(p, 'cavalry', o), arc = (p, o) => addUp(p, 'archer', o);
  // unit line upgrades
  vicAddTech('up_halberdier', { name: 'Halberdier', at: 'barracks', age: 3, cost: { food: 300, gold: 600 }, time: 50, hk: 'X', upg: ['pikeman', 'halberdier'], req: ['up_pikeman'], icon: 'unit:halberdier', desc: 'Upgrade Pikemen to Halberdiers.' });
  vicAddTech('up_paladin', { name: 'Paladin', at: 'stable', age: 3, cost: { food: 1300, gold: 750 }, time: 170, hk: 'X', upg: ['cavalier', 'paladin'], req: ['up_cavalier'], icon: 'unit:paladin', desc: 'Upgrade Cavaliers to Paladins.' });
  vicAddTech('up_hcavarcher', { name: 'Heavy Cavalry Archer', at: 'range', age: 3, cost: { food: 900, gold: 500 }, time: 50, hk: 'C', upg: ['cavarcher', 'hcavarcher'], icon: 'unit:hcavarcher', desc: 'Upgrade Cavalry Archers to Heavy Cavalry Archers.' });
  vicAddTech('up_cappedram', { name: 'Capped Ram', at: 'siege', age: 3, cost: { food: 300 }, time: 50, hk: 'Z', upg: ['ram', 'cappedram'], icon: 'unit:cappedram', desc: 'Upgrade Battering Rams to Capped Rams.' });
  vicAddTech('up_onager', { name: 'Onager', at: 'siege', age: 3, cost: { food: 800, gold: 500 }, time: 75, hk: 'X', upg: ['mangonel', 'onager'], icon: 'unit:onager', desc: 'Upgrade Mangonels to Onagers.' });
  // economy tiers
  vicAddTech('croprotation', { name: 'Crop Rotation', at: 'mill', age: 3, cost: { food: 300, wood: 250 }, time: 70, hk: 'E', req: ['heavyplow'], icon: 'plow', tier: 3, desc: 'Farms +175 food.', fx: p => { p.farmFood += 175; } });
  vicAddTech('twomansaw', { name: 'Two-Man Saw', at: 'lumbercamp', age: 3, cost: { food: 300, wood: 200 }, time: 100, hk: 'E', req: ['bowsaw'], icon: 'saw', tier: 3, desc: 'Lumberjacks work 10% faster.', fx: p => { p.gather.wood *= 1.1; } });
  vicAddTech('goldshaft', { name: 'Gold Shaft Mining', at: 'miningcamp', age: 2, cost: { food: 200, wood: 150 }, time: 75, hk: 'E', req: ['goldmining'], icon: 'gold', tier: 2, desc: 'Gold miners work 15% faster.', fx: p => { p.gather.gold *= 1.15; } });
  vicAddTech('stoneshaft', { name: 'Stone Shaft Mining', at: 'miningcamp', age: 2, cost: { food: 200, wood: 150 }, time: 75, hk: 'R', req: ['stonemining'], icon: 'stone', tier: 2, desc: 'Stone miners work 15% faster.', fx: p => { p.gather.stone *= 1.15; } });
  // blacksmith tiers (Feudal tiers exist in data.js; Castle tiers exist for attack/infantry armour)
  vicAddTech('blastfurnace', { name: 'Blast Furnace', at: 'blacksmith', age: 3, cost: { food: 275, gold: 225 }, time: 100, hk: 'Q', req: ['ironcasting'], icon: 'sword2', tier: 3, desc: 'Infantry and cavalry +2 attack.', fx: p => { inf(p, { atk: 2 }); cav(p, { atk: 2 }); } });
  vicAddTech('platemail', { name: 'Plate Mail Armor', at: 'blacksmith', age: 3, cost: { food: 300, gold: 150 }, time: 70, hk: 'W', req: ['chainmail'], icon: 'armor2', tier: 3, desc: 'Infantry +1 melee / +2 pierce armor.', fx: p => inf(p, { ma: 1, pa: 2 }) });
  vicAddTech('chainbarding', { name: 'Chain Barding Armor', at: 'blacksmith', age: 2, cost: { food: 250, gold: 150 }, time: 60, hk: 'E', req: ['scalebarding'], icon: 'horse', tier: 2, desc: 'Cavalry +1/+1 armor.', fx: p => cav(p, { ma: 1, pa: 1 }) });
  vicAddTech('platebarding', { name: 'Plate Barding Armor', at: 'blacksmith', age: 3, cost: { food: 350, gold: 200 }, time: 75, hk: 'E', req: ['chainbarding'], icon: 'horse', tier: 3, desc: 'Cavalry +1 melee / +2 pierce armor.', fx: p => cav(p, { ma: 1, pa: 2 }) });
  vicAddTech('leatherarcher', { name: 'Leather Archer Armor', at: 'blacksmith', age: 2, cost: { food: 150, gold: 150 }, time: 55, hk: 'T', req: ['paddedarcher'], icon: 'armor', tier: 2, desc: 'Archers +1/+1 armor.', fx: p => arc(p, { ma: 1, pa: 1 }) });
  vicAddTech('ringarcher', { name: 'Ring Archer Armor', at: 'blacksmith', age: 3, cost: { food: 250, gold: 250 }, time: 70, hk: 'T', req: ['leatherarcher'], icon: 'armor2', tier: 3, desc: 'Archers +1 melee / +2 pierce armor.', fx: p => arc(p, { ma: 1, pa: 2 }) });
  vicAddTech('bracer', { name: 'Bracer', at: 'blacksmith', age: 3, cost: { food: 300, gold: 200 }, time: 75, hk: 'R', req: ['bodkin'], icon: 'arrow2', tier: 3, desc: 'Archers, towers, TCs and galleys +1 attack and +1 range.', fx: p => { arc(p, { atk: 1, range: 1 }); addUp(p, 'warship', { atk: 1, range: 1 }); p.bldAtk += 1; p.bldRange += 1; } });
}
// Byzantine discount carries over to the new pike tier
if (typeof applyCivBonus === 'function') {
  const _acb = applyCivBonus;
  applyCivBonus = function (p) { const r = _acb(p); if (p.civ === 'byzantines' && UNITS.halberdier) p.costMul.halberdier = 0.75; return r; };
}
const VIC_AI_TECHS = ['goldshaft', 'chainbarding', 'leatherarcher', 'stoneshaft', 'up_cappedram', 'croprotation', 'twomansaw', 'blastfurnace', 'platemail', 'platebarding', 'ringarcher', 'bracer', 'up_halberdier', 'up_onager', 'up_hcavarcher', 'up_paladin'];

// =====================================================================================
// 2. Art: the Wonder (per-civilization silhouette), unit tiers, tier badges on tech icons
// =====================================================================================
function vicArchOf(pc) {
  if (typeof W === 'undefined' || !W || !W.players) return 'west';
  const p = W.players.find(q => q && q.color === pc);
  return p && CIVS[p.civ] ? CIVS[p.civ].arch : 'west';
}
// a dome on a drum: bulge >1 makes an onion dome
function vicDome(g, x, y, r, z, h, col, bulge = 1) {
  const c = P(x, y, z), rx = r * TW / 2 * 1.41, ry = r * TH / 2 * 1.41;
  const grd = g.createRadialGradient(c[0] - rx * 0.35, c[1] - h * 0.65, 2, c[0], c[1] - h * 0.4, rx * 1.3);
  grd.addColorStop(0, shade(col, 1.45)); grd.addColorStop(0.45, col); grd.addColorStop(1, shade(col, 0.55));
  g.fillStyle = grd; g.beginPath();
  g.moveTo(c[0] - rx, c[1]);
  g.bezierCurveTo(c[0] - rx * bulge, c[1] - h * 0.55, c[0] - rx * 0.45, c[1] - h * (bulge > 1 ? 0.8 : 1.0), c[0], c[1] - h);
  g.bezierCurveTo(c[0] + rx * 0.45, c[1] - h * (bulge > 1 ? 0.8 : 1.0), c[0] + rx * bulge, c[1] - h * 0.55, c[0] + rx, c[1]);
  g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI);
  g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,40,0,0.45)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(90,60,10,0.35)'; g.lineWidth = 0.7;
  for (const f of [-0.6, -0.25, 0.1, 0.45]) { g.beginPath(); g.moveTo(c[0] + rx * f, c[1] + ry * Math.sqrt(1 - f * f)); g.quadraticCurveTo(c[0] + rx * f * 1.05, c[1] - h * 0.6, c[0], c[1] - h); g.stroke(); }
}
function vicBanner(g, x, y, z, pc, len = 16) {
  const a = P(x, y, z);
  g.fillStyle = shade(pc.c, 0.7); g.fillRect(a[0] - 4.5, a[1] - 1, 9, 2);
  g.fillStyle = pc.c; g.beginPath(); g.moveTo(a[0] - 4, a[1]); g.lineTo(a[0] + 4, a[1]); g.lineTo(a[0] + 4, a[1] + len); g.lineTo(a[0], a[1] + len - 4); g.lineTo(a[0] - 4, a[1] + len); g.closePath(); g.fill();
  g.strokeStyle = '#e8c860'; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = '#e8c860'; g.beginPath(); g.arc(a[0], a[1] + len * 0.42, 1.8, 0, 6.3); g.fill();
}
function vicColumn(g, x, y, z, h, col) {
  cyl(g, x, y, 0.085, z, h, col);
  box(g, x, y, 0.12, 0.12, z + h - 2, 2.5, vicHex(col, 0.95), { ol: 'rgba(0,0,0,0.25)' });
}
function vicDrawWonder(g, st, pc, t) {
  const arch = vicArchOf(pc);
  const S = STYLE[Math.min(3, Math.max(2, st))];
  const marble = arch === 'east' ? '#ddd3c2' : arch === 'med' ? '#eadcbc' : '#eee7d6';
  const gold = '#e2b23a', roof = arch === 'east' ? '#a33a28' : S.roof;
  // stepped platform
  box(g, 0, 0, 2.45, 2.45, 0, 6, S.base, { bricks: true });
  box(g, 0, 0, 2.2, 2.2, 6, 6, vicHex(S.stone, 1.05), { bricks: true });
  box(g, 0, 0, 1.95, 1.95, 12, 6, vicHex(marble, 0.92), { bricks: true });
  // grand stair on the south-west face
  for (let k = 0; k < 3; k++) box(g, -0.1, 2.32 - k * 0.25, 0.48, 0.13, 0, 6 + k * 6, vicHex(marble, 0.96 - k * 0.03), { ol: 'rgba(0,0,0,0.2)' });
  // rear corner tower
  const tower = (x, y) => {
    if (arch === 'med') { cyl(g, x, y, 0.2, 18, 74, marble); box(g, x, y, 0.27, 0.27, 72, 3, gold); vicDome(g, x, y, 0.2, 92, 16, gold, 1.35); cone(g, x, y, 0.04, 108, 9, gold); }
    else if (arch === 'east') { box(g, x, y, 0.28, 0.28, 18, 44, marble, { bricks: true }); for (let k = 0; k < 3; k++) { pyramid(g, x, y, 0.44 - k * 0.08, 0.44 - k * 0.08, 62 + k * 12, 9, roof); if (k < 2) box(g, x, y, 0.2 - k * 0.04, 0.2 - k * 0.04, 69 + k * 12, 5, marble); } cone(g, x, y, 0.04, 95, 10, gold); }
    else { cyl(g, x, y, 0.3, 18, 56, marble); box(g, x, y, 0.36, 0.36, 72, 3, gold); cone(g, x, y, 0.36, 75, 30, roof); cone(g, x, y, 0.05, 104, 8, gold); }
  };
  tower(-1.72, -1.72);
  // main hall
  box(g, 0, 0, 1.55, 1.55, 18, 34, marble, { bricks: true });
  doorAt(g, -0.1, 1.55, 18, 'l', 0.28, 22);
  for (const x of [-1.0, 0.75]) windowAt(g, x, 1.55, 32, 'l', '#3a2c1c');
  for (const y of [-1.0, -0.2, 0.6]) windowAt(g, 1.55, y, 32, 'r', '#3a2c1c');
  // colonnade on the two visible faces, back to front
  const cols = [];
  for (let k = -1.35; k <= 1.36; k += 0.45) { cols.push([k, 1.76]); cols.push([1.76, k]); }
  cols.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  for (const [x, y] of cols) vicColumn(g, x, y, 18, 33, '#f6f1e4');
  // entablature with gilded frieze
  box(g, 0, 0, 1.9, 1.9, 51, 4, vicHex(marble, 0.97), { ol: 'rgba(0,0,0,0.3)' });
  box(g, 0, 0, 1.92, 1.92, 55, 3, gold, { ol: 'rgba(80,50,0,0.4)' });
  // side towers
  tower(1.72, -1.72); tower(-1.72, 1.72);
  // upper tier
  box(g, 0, 0, 1.15, 1.15, 58, 22, marble, { bricks: true });
  for (const x of [-0.6, 0, 0.6]) windowAt(g, x, 1.15, 66, 'l', '#2a2030');
  for (const y of [-0.6, 0, 0.6]) windowAt(g, 1.15, y, 66, 'r', '#2a2030');
  box(g, 0, 0, 1.22, 1.22, 80, 3, gold, { ol: 'rgba(80,50,0,0.4)' });
  if (arch === 'east') {
    // tiered pagoda crown
    for (let k = 0; k < 3; k++) {
      const w = 1.25 - k * 0.3;
      pyramid(g, 0, 0, w, w, 83 + k * 20, 14, roof);
      box(g, 0, 0, w * 0.55, w * 0.55, 97 + k * 20, 6, marble, { bricks: true });
    }
    cyl(g, 0, 0, 0.12, 143, 6, gold); cone(g, 0, 0, 0.1, 149, 22, gold);
    flag(g, 0, 0, 171, pc.c, t, 1.1);
  } else {
    cyl(g, 0, 0, 0.8, 83, 12, marble);
    for (let k = 0; k < 8; k++) { const a = Math.PI * 0.05 + k * Math.PI / 8; if (Math.sin(a) < 0) continue; windowAt(g, Math.cos(a) * 0.79, Math.sin(a) * 0.79, 86, 'l', '#2a2030'); }
    vicDome(g, 0, 0, 0.8, 95, arch === 'med' ? 56 : 46, gold, arch === 'med' ? 1.3 : 1);
    const top = 95 + (arch === 'med' ? 56 : 46);
    cyl(g, 0, 0, 0.14, top - 2, 9, '#f2ead6'); vicDome(g, 0, 0, 0.14, top + 7, 6, gold);
    if (arch === 'west') { cone(g, 0, 0, 0.07, top + 12, 24, gold); flag(g, 0, 0, top + 34, pc.c, t, 1.1); }
    else { const c = P(0, 0, top + 19); g.strokeStyle = gold; g.lineWidth = 2; g.beginPath(); g.arc(c[0], c[1] - 4, 4, 0.4, Math.PI * 2 - 0.4); g.stroke(); flag(g, 0, 0, top + 14, pc.c, t, 1.0); }
  }
  // front tower
  tower(1.72, 1.72);
  // team banners on the frieze and pennants on every tower
  for (const x of [-1.1, 0.3]) vicBanner(g, x, 1.93, 50, pc, 18);
  for (const y of [-1.1, 0.3]) vicBanner(g, 1.93, y, 50, pc, 18);
  for (const [x, y] of [[-1.72, -1.72], [1.72, -1.72], [-1.72, 1.72], [1.72, 1.72]]) flag(g, x, y, arch === 'west' ? 112 : arch === 'med' ? 115 : 103, pc.c, t + x, 0.7);
  // braziers on the stair
  for (const x of [-0.65, 0.45]) { const b = P(x, 2.4, 6); g.fillStyle = '#5a4a3a'; g.fillRect(b[0] - 2, b[1] - 6, 4, 6); g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(b[0], b[1] - 8, 2.5, 3.5, 0, 0, 6.3); g.fill(); }
}
if (typeof drawBuildingArt === 'function') {
  const _dba = drawBuildingArt;
  drawBuildingArt = function (g, type, st, pc, t) {
    if (type !== 'wonder') return _dba(g, type, st, pc, t);
    vicDrawWonder(g, st, pc, t);
  };
}
// Ghost (remembered) buildings are drawn desaturated without flames; finished Wonders glow
if (typeof drawBuilding === 'function') {
  const _db = drawBuilding;
  drawBuilding = function (ctx, b, alpha) {
    if (b.ghost) {
      ctx.save();
      ctx.filter = 'grayscale(0.75) brightness(0.72)';
      _db(ctx, Object.assign({}, b, { hp: b.maxhp }), 0.88);
      ctx.restore();
      return;
    }
    const r = _db(ctx, b, alpha);
    if (b.type === 'wonder' && b.built) vicWonderGlow(ctx, b);
    return r;
  };
}
function vicWonderGlow(ctx, b) {
  const s = 5, cx = b.x + s / 2, cy = b.y + s / 2;
  const gp = iso(cx, cy, W.map.h(cx, cy));
  const t = R.time || 0, pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const active = b.wonderT !== undefined;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const top = P(0, 0, 118);
  const rad = 70 + pulse * 18;
  const grd = ctx.createRadialGradient(gp.x + top[0], gp.y + top[1], 4, gp.x + top[0], gp.y + top[1], rad);
  grd.addColorStop(0, `rgba(255,220,120,${0.30 + pulse * 0.18})`); grd.addColorStop(0.5, `rgba(255,190,70,${0.10 + pulse * 0.08})`); grd.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(gp.x + top[0], gp.y + top[1], rad, 0, 6.3); ctx.fill();
  if (active) { // a slow ring of light on the ground while the countdown runs
    const k = (t * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,215,110,${0.55 * (1 - k)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(gp.x, gp.y, (2.6 + k * 1.6) * TW / 2 * 1.41, (2.6 + k * 1.6) * TH / 2 * 1.41, 0, 0, 6.3); ctx.stroke();
  }
  ctx.restore();
}
// Unit tiers draw as their predecessor plus a distinguishing detail
const VIC_DRAW_AS = { halberdier: 'pikeman', paladin: 'cavalier', hcavarcher: 'cavarcher', cappedram: 'ram', onager: 'mangonel' };
if (typeof drawUnitFigure === 'function') {
  const _duf = drawUnitFigure;
  drawUnitFigure = function (g, u, t) {
    const base = VIC_DRAW_AS[u.type];
    if (!base) return _duf(g, u, t);
    const pc = pcolor(u.owner);
    _duf(g, Object.assign({}, u, { type: base }), t);
    const walk = u.anim === 'walk', bob = walk ? Math.abs(Math.sin(t * 11)) * 1.2 : Math.sin(t * 2) * 0.3;
    if (u.type === 'halberdier') { // red plume and a broad axe blade on the shoulder
      g.fillStyle = '#c8202a'; g.beginPath(); g.moveTo(0.4, -28.5 - bob); g.quadraticCurveTo(-4.5, -33 - bob, -6.5, -26.5 - bob); g.quadraticCurveTo(-3, -29 - bob, 0.4, -27 - bob); g.fill();
      g.fillStyle = '#f0f0f0'; g.fillRect(-0.3, -29.5 - bob, 1.6, 1.6);
    } else if (u.type === 'paladin') { // gilded great helm crest and gold-trimmed caparison
      g.fillStyle = '#e8c040'; g.beginPath(); g.moveTo(-1.5, -37.5 - bob); g.lineTo(1.2, -45 - bob); g.lineTo(4, -37.5 - bob); g.closePath(); g.fill();
      g.strokeStyle = '#e8c040'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-13, -6); g.lineTo(12, -6); g.stroke();
    } else if (u.type === 'hcavarcher') { // lamellar coat, plumed cap
      g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(1.3, -35.5 - bob, 4, Math.PI, 0); g.fill(); g.fillRect(-2.9, -35.8 - bob, 8.4, 1.3);
      g.fillStyle = pc.l; g.fillRect(0.6, -42 - bob, 1.4, 6.5);
    } else if (u.type === 'cappedram') { // iron-plated roof and capped head
      g.fillStyle = '#7d8088'; g.beginPath(); g.moveTo(-18, -14); g.lineTo(0, -26); g.lineTo(16, -14); g.lineTo(12, -14); g.lineTo(0, -22); g.lineTo(-14, -14); g.closePath(); g.fill();
      g.fillStyle = '#c8ccd4'; for (const [x, y] of [[-12, -16], [-6, -19.5], [0, -23], [6, -19.5], [11, -16]]) { g.beginPath(); g.arc(x, y, 0.9, 0, 6.3); g.fill(); }
      g.fillStyle = '#5a5e66'; g.beginPath(); g.moveTo(19, -12.5); g.lineTo(26, -8); g.lineTo(19, -3.5); g.closePath(); g.fill();
    } else if (u.type === 'onager') { // iron bands on the frame, iron-rimmed wheels
      g.strokeStyle = '#8a8e96'; g.lineWidth = 1.4;
      for (const x of [-10, 9]) { g.beginPath(); g.arc(x, -1, 4.2, 0, 6.3); g.stroke(); }
      g.fillStyle = '#8a8e96'; for (const x of [-11, -1, 9]) g.fillRect(x, -8.5, 2, 6);
    }
  };
}
// tier badge on reused tech icons (Roman numeral of the tier)
if (typeof drawTechIcon === 'function') {
  const _dti = drawTechIcon;
  drawTechIcon = function (g, id, pc) {
    const t = TECHS[id];
    if (!t || !t.tier) return _dti(g, id, pc);
    _dti(g, t.icon, pc);
    g.save();
    g.fillStyle = 'rgba(20,14,8,0.82)'; g.beginPath(); g.arc(50, 14, 11, 0, 6.3); g.fill();
    g.strokeStyle = '#e8c860'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#ffe08a'; g.font = 'bold 12px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(VIC_ROMAN[t.tier], 50, 15);
    g.restore();
  };
}

// =====================================================================================
// 3. Statistics: per-player counters, score (military / economy / technology / society), history
// =====================================================================================
function vicStats(p) {
  if (!p.vs) {
    p.vs = { uKilled: 0, uLost: 0, bRazed: 0, bLost: 0, killValue: 0, razeValue: 0, trainedVil: 0, trainedMil: 0,
      gathered: { food: 0, wood: 0, gold: 0, stone: 0 }, techs: 0, techValue: 0, ageT: [0, null, null, null],
      maxPop: 0, maxVil: 0, maxMil: 0, maxRelics: 0, wondersBuilt: 0, castlesBuilt: 0, defeatT: null };
    for (let a = 1; a <= 3; a++) p.vs.ageT[a] = a <= p.age ? 0 : null;
  }
  return p.vs;
}
function vicCounts(pid) {
  let vil = 0, mil = 0, relics = 0, soc = 0;
  for (const e of W.list) {
    if (e.owner !== pid || e.dying) continue;
    if (e.kind === 'unit') { const d = UNITS[e.type]; if (d.animal || e.type === 'cobra') continue; if (e.type === 'villager') vil++; else if (d.atk > 0 && !hasTag(e.type, 'trade') && e.type !== 'fishingship') mil++; }
    else if (e.kind === 'bld' && e.built) { if (e.type === 'monastery') relics += e.relics.length; if (e.type === 'castle' || e.type === 'wonder') soc += vicCostSum(BUILDINGS[e.type].cost); }
  }
  return { vil, mil, relics, soc };
}
function vicScore(p, counts) {
  const s = vicStats(p), c = counts || vicCounts(p.id);
  const g = s.gathered;
  const mil = Math.round((s.killValue + s.razeValue) / 5);
  const eco = Math.round((g.food + g.wood + g.gold + g.stone + (p.stats.relicGold || 0) + (p.stats.tradeGold || 0)) / 10 + (p.stats.tributeSent || 0) / 20);
  const tech = Math.round(s.techValue / 5);
  const soc = Math.round(c.soc / 5 + c.relics * 10);
  return { mil, eco, tech, soc, total: mil + eco + tech + soc };
}
function vicSample() {
  if (!W.vicHist) W.vicHist = [];
  const row = { t: W.t, p: [null] };
  for (let i = 1; i < W.players.length; i++) {
    const p = W.players[i], s = vicStats(p), c = vicCounts(i);
    s.maxPop = Math.max(s.maxPop, p.pop); s.maxVil = Math.max(s.maxVil, c.vil); s.maxMil = Math.max(s.maxMil, c.mil); s.maxRelics = Math.max(s.maxRelics, c.relics);
    row.p.push({ score: vicScore(p, c).total, pop: p.pop, vil: c.vil, mil: c.mil });
  }
  const last = W.vicHist[W.vicHist.length - 1];
  if (last && Math.abs(last.t - W.t) < 0.01) W.vicHist[W.vicHist.length - 1] = row; else W.vicHist.push(row);
}
if (typeof createWorld === 'function') {
  const _cw = createWorld;
  createWorld = function (spec, settings) {
    const w = _cw(spec, settings);
    w.vicHist = []; w.vicNext = 0; w.vicWonders = new Map(); w.vicRelic = null; w.victory = null;
    for (let i = 1; i < w.players.length; i++) { const p = w.players[i]; p.vs = null; vicStats(p); p.memory = new Map(); }
    return w;
  };
}
if (typeof killEnt === 'function') {
  const _ke = killEnt;
  killEnt = function (e, src) {
    const live = e && !e.dead && !e.dying && (e.kind === 'unit' || e.kind === 'bld');
    const victim = live ? W.players[e.owner] : null;
    const killer = live && src && src.owner && src.owner !== e.owner ? W.players[src.owner] : null;
    const counted = live && victim && !(e.kind === 'unit' && UNITS[e.type].animal);
    const r = _ke(e, src);
    if (counted && (e.dead || e.dying)) {
      const value = vicCostSum(e.kind === 'unit' ? UNITS[e.type].cost : BUILDINGS[e.type].cost);
      if (e.kind === 'unit') { if (killer) { const k = vicStats(killer); k.uKilled++; k.killValue += value; } if (killer) vicStats(victim).uLost++; }
      else if (!BUILDINGS[e.type].wall || killer) { if (killer) { const k = vicStats(killer); k.bRazed++; k.razeValue += value; } if (killer) vicStats(victim).bLost++; }
    }
    return r;
  };
}
if (typeof deposit === 'function') {
  const _dep = deposit;
  deposit = function (u) {
    const c = u.carry, res = c && c.res, amt = c ? c.amt : 0;
    const r = _dep(u);
    const p = W.players[u.owner];
    if (p && res && amt > 0 && (!u.carry || u.carry.amt === 0)) { const g = vicStats(p).gathered; if (g[res] !== undefined) g[res] += amt; }
    return r;
  };
}
if (typeof updateBuilding === 'function') {
  const _ub = updateBuilding;
  updateBuilding = function (b, dt) {
    const q = b.queue && b.queue[0];
    const r = _ub(b, dt);
    if (q && q.kind === 'unit' && b.queue[0] !== q && !b.dead) {
      const p = W.players[b.owner];
      if (p) { const s = vicStats(p); if (q.id === 'villager') s.trainedVil++; else s.trainedMil++; }
    }
    return r;
  };
}
if (typeof completeTech === 'function') {
  const _ct = completeTech;
  completeTech = function (p, id) {
    const had = p.techs.has(id);
    const r = _ct(p, id);
    if (!had && TECHS[id]) {
      const s = vicStats(p); s.techs++; s.techValue += vicCostSum(TECHS[id].cost);
      if (TECHS[id].ageUp) s.ageT[TECHS[id].ageUp] = W.t;
    }
    return r;
  };
}
if (typeof completeBuilding === 'function') {
  const _cb = completeBuilding;
  completeBuilding = function (b) {
    const was = b.built;
    const r = _cb(b);
    if (!was && b.built && W.players[b.owner]) { const s = vicStats(W.players[b.owner]); if (b.type === 'wonder') s.wondersBuilt++; if (b.type === 'castle') s.castlesBuilt++; }
    return r;
  };
}

// =====================================================================================
// 4. Victory conditions: Wonder and relic countdowns
// =====================================================================================
function vicMarkText(m) { return m >= 60 ? `${m / 60} minute${m > 60 ? 's' : ''}` : `${m} seconds`; }
function vicAnnounce(kind, pid, secs) {
  const p = W.players[pid], mine = isFriend(pid, W.humanId);
  const who = pid === W.humanId ? 'Your' : `${p.name}'s`;
  const what = kind === 'wonder' ? `${who} Wonder` : `${pid === W.humanId ? 'You hold' : p.name + ' holds'} every relic and`;
  let text;
  if (kind === 'wonder') text = mine ? `${what} will bring ${pid === W.humanId ? 'you' : 'your alliance'} victory in ${vicMarkText(secs)}!` : `${what} will bring them victory in ${vicMarkText(secs)}! Destroy it!`;
  else text = mine ? `${what} will win in ${vicMarkText(secs)}!` : `${what} will win in ${vicMarkText(secs)}! Take a relic back!`;
  msg(text, mine ? '#ffd76a' : '#ff9a7a');
  if (mine) Sound.bell(); else Sound.alert();
}
function vicCrossed(before, after) { for (const m of VIC.marks) if (before > m && after <= m) return m; return 0; }
function vicWin(pid, kind) {
  if (W.over) return;
  const winners = []; for (let i = 1; i < W.players.length; i++) if (isFriend(i, pid)) winners.push(i);
  for (let i = 1; i < W.players.length; i++) {
    const p = W.players[i];
    if (winners.includes(i) || !p.alive) continue;
    p.alive = false; vicStats(p).defeatT = W.t;
    msg(`${p.name} has been defeated!`, p.color.l);
  }
  W.victory = { kind, pid, winners };
  endGame(winners.includes(W.humanId));
}
function vicWonderTick(dt) {
  const seen = new Set();
  for (const b of W.list) {
    if (b.kind !== 'bld' || b.type !== 'wonder' || !b.built || b.dead) continue;
    seen.add(b.id);
    if (b.wonderT === undefined) {
      b.wonderT = VIC.wonderTime;
      W.vicWonders.set(b.id, { owner: b.owner, x: b.x, y: b.y });
      const p = W.players[b.owner];
      msg(`${b.owner === W.humanId ? 'You have' : p.name + ' has'} completed a Wonder!`, isFriend(b.owner, W.humanId) ? '#ffd76a' : '#ff9a7a');
      vicAnnounce('wonder', b.owner, VIC.wonderTime);
      continue;
    }
    const before = b.wonderT; b.wonderT -= dt;
    const m = vicCrossed(before, b.wonderT); if (m && m < VIC.wonderTime) vicAnnounce('wonder', b.owner, m);
    if (b.wonderT <= 0) { vicWin(b.owner, 'wonder'); return; }
  }
  for (const [id, w] of W.vicWonders) if (!seen.has(id)) {
    W.vicWonders.delete(id);
    const p = W.players[w.owner];
    msg(`${w.owner === W.humanId ? 'Your' : p.name + "'s"} Wonder has been destroyed! Its countdown is cancelled.`, isFriend(w.owner, W.humanId) ? '#ff9a7a' : '#9f9');
  }
}
// returns the holding player if every relic sits in monasteries of one player or one alliance, else 0
function vicRelicHolder() {
  let holder = 0, n = 0;
  for (const r of W.list) {
    if (r.kind !== 'relic') continue;
    n++;
    const m = r.inBld && ent(r.inBld);
    if (!m || m.dead || !m.owner) return 0;
    if (!holder) holder = m.owner;
    else if (!isFriend(holder, m.owner)) return 0;
  }
  return n ? holder : 0;
}
function vicRelicTick(dt) {
  const h = vicRelicHolder();
  const cur = W.vicRelic;
  if (!h) {
    if (cur) { W.vicRelic = null; msg(`The relic countdown of ${W.players[cur.holder].name}${isFriend(cur.holder, W.humanId) ? ' (your side)' : ''} is broken.`, isFriend(cur.holder, W.humanId) ? '#ff9a7a' : '#9f9'); }
    return;
  }
  if (!cur || !isFriend(cur.holder, h) || !W.players[cur.holder].alive) {
    W.vicRelic = { holder: h, t: VIC.relicTime };
    vicAnnounce('relic', h, VIC.relicTime);
    return;
  }
  const before = cur.t; cur.t -= dt;
  const m = vicCrossed(before, cur.t); if (m && m < VIC.relicTime) vicAnnounce('relic', cur.holder, m);
  if (cur.t <= 0) vicWin(cur.holder, 'relic');
}
function vicTick(dt) {
  if (!W || W.menu || !W.players || W.over) return;
  if (!W.vicWonders) { W.vicWonders = new Map(); W.vicHist = W.vicHist || []; W.vicNext = W.vicNext || 0; }
  if (VIC.wonder) vicWonderTick(dt);
  if (!W.over && VIC.relic) vicRelicTick(dt);
  if (VIC.score && W.t >= (W.vicNext || 0)) { vicSample(); W.vicNext = (Math.floor(W.t / VIC.sampleEvery) + 1) * VIC.sampleEvery; }
}
if (typeof worldTick === 'function') {
  const _wt = worldTick;
  worldTick = function (dt) {
    const r = _wt(dt);
    vicTick(dt);
    return r;
  };
}
if (typeof checkVictory === 'function') { // remember when each player fell
  const _cv = checkVictory;
  checkVictory = function () {
    const alive = W.players.map(p => p && p.alive);
    const r = _cv();
    for (let i = 1; i < W.players.length; i++) if (alive[i] && !W.players[i].alive) vicStats(W.players[i]).defeatT = W.t;
    return r;
  };
}
// list of running countdowns for the HUD: [{kind, pid, t}]
function vicTimers() {
  const out = [];
  if (!W || !W.list) return out;
  for (const b of W.list) if (b.kind === 'bld' && b.type === 'wonder' && b.wonderT !== undefined && !b.dead) out.push({ kind: 'wonder', pid: b.owner, t: b.wonderT });
  if (W.vicRelic) out.push({ kind: 'relic', pid: W.vicRelic.holder, t: W.vicRelic.t });
  return out.sort((a, b) => a.t - b.t);
}

// =====================================================================================
// 5. Fog-of-war building memory: enemies' buildings are remembered as last seen
// =====================================================================================
function vicFogOn() { return VIC.fogmem && W && W.settings && W.settings.fog !== 'none' && !W.noFog && !W.menu; }
function vicTileVis(p, x, y) { const n = W.n; if (x < 0 || y < 0 || x >= n || y >= n) return false; return p.visible[y * n + x] === 1; }
function vicBldVisible(p, b) { const c = center(b); return vicTileVis(p, Math.min(W.n - 1, c.x | 0), Math.min(W.n - 1, c.y | 0)); }
function vicMemUpdate(p) {
  if (!p.memory) p.memory = new Map();
  const mem = p.memory;
  for (const b of W.list) {
    if (b.kind !== 'bld' || b.owner === p.id || b.dead || BUILDINGS[b.type].farm) continue;
    if (!vicBldVisible(p, b)) continue;
    mem.set(b.id, { id: b.id, type: b.type, x: b.x, y: b.y, owner: b.owner, built: b.built, progress: b.progress, hpFrac: Math.max(0, b.hp / b.maxhp), style: typeof bldStyle === 'function' ? bldStyle(b) : Math.min(3, W.players[b.owner] ? W.players[b.owner].age : 0), seenT: W.t });
  }
  for (const [id, m] of mem) {
    const b = ent(id);
    if (b && !b.dead && b.owner === m.owner) continue;
    const s = BUILDINGS[m.type].size;
    let seen = false;
    for (let y = m.y; y < m.y + s && !seen; y++) for (let x = m.x; x < m.x + s; x++) if (vicTileVis(p, x, y)) { seen = true; break; }
    if (seen) mem.delete(id);
  }
}
if (typeof updateVisibility === 'function') {
  const _uv = updateVisibility;
  updateVisibility = function (force) {
    const r = _uv(force);
    if (vicFogOn() && W.players[W.humanId]) vicMemUpdate(W.players[W.humanId]);
    return r;
  };
}
// During rendering: hide unseen live buildings of others, show the remembered ghosts instead
function vicWithGhosts(fn) {
  const h = W.players[W.humanId];
  if (!vicFogOn() || !h || !h.memory) return fn();
  const hidden = [], ghosts = [];
  for (const b of W.list) {
    if (b.kind !== 'bld' || b.owner === W.humanId || BUILDINGS[b.type].farm) continue;
    if (vicBldVisible(h, b)) continue;
    hidden.push([b, b.seenBy]); b.seenBy = false;
  }
  for (const m of h.memory.values()) {
    const b = ent(m.id);
    if (b && !b.dead && vicBldVisible(h, b)) continue;
    const maxhp = b ? b.maxhp : BUILDINGS[m.type].hp;
    ghosts.push({ id: m.id, kind: 'bld', ghost: true, type: m.type, x: m.x, y: m.y, owner: m.owner, built: m.built, progress: m.progress, hp: maxhp * m.hpFrac, maxhp, style: m.style, seenBy: true, garrison: [], relics: [], queue: [] });
  }
  const n0 = W.list.length;
  for (const g of ghosts) W.list.push(g);
  try { return fn(); }
  finally {
    if (W.list.length >= n0 + ghosts.length && W.list[n0] === ghosts[0]) W.list.length = n0;
    else for (const g of ghosts) { const i = W.list.indexOf(g); if (i >= 0) W.list.splice(i, 1); }
    for (const [b, s] of hidden) b.seenBy = s;
  }
}
if (typeof bldStyle === 'function') {
  const _bs = bldStyle;
  bldStyle = function (b) { return b.ghost ? b.style : _bs(b); };
}
if (typeof renderWorld === 'function') {
  const _rw = renderWorld;
  renderWorld = function (ctx, opts) {
    if (opts && opts.editor) return _rw(ctx, opts);
    return vicWithGhosts(() => _rw(ctx, opts));
  };
}
if (typeof renderMinimap === 'function') {
  const _rm = renderMinimap;
  renderMinimap = function (cv, editor) {
    if (editor) return _rm(cv, editor);
    return vicWithGhosts(() => _rm(cv, editor));
  };
}
if (typeof hitTest === 'function') { // a building hidden in the fog can only be picked where you remember it (e.g. to send an army at it)
  const _ht = hitTest;
  hitTest = function (sx, sy, opts) {
    const e = _ht(sx, sy, opts);
    if (e && e.kind === 'bld' && !(opts && opts.editor) && e.owner !== W.humanId && vicFogOn()) {
      const h = W.players[W.humanId];
      if (!vicBldVisible(h, e) && !(h.memory && h.memory.has(e.id))) return null;
    }
    return e;
  };
}

// =====================================================================================
// 6. Computer players: research the new tiers, build Wonders, rush enemy Wonders
// =====================================================================================
if (typeof AIPlayer === 'function') {
  const _res = AIPlayer.prototype.research;
  AIPlayer.prototype.research = function (list, reserve) {
    if (VIC.imperial && list && list.length > 10) list = list.concat(VIC_AI_TECHS.filter(id => TECHS[id] && !list.includes(id)));
    return _res.call(this, list, reserve);
  };
  const _eco = AIPlayer.prototype.economy;
  AIPlayer.prototype.economy = function (dt) {
    const p = this.p;
    if (VIC.wonder && VIC.aiWonder && BUILDINGS.wonder && p.age >= 3 && !p.bell && W.t - (this.vicWT || -99) > 15) {
      this.vicWT = W.t;
      const mine = this.mine(e => e.kind === 'bld' && e.type === 'wonder');
      const c = effCost(p, 'wonder');
      const rich = RES.every(r => p.res[r] >= (c[r] || 0) + 150);
      if (!mine.length && rich && this.mine(e => e.kind === 'unit' && e.type === 'villager').length >= 25) this.build('wonder', this.home(), 6, 18);
      // keep builders on an unfinished Wonder
      const wip = mine.find(b => !b.built);
      if (wip && wip.builders < 6) for (const v of this.pickBuilders(wip.x + 2, wip.y + 2, 6 - wip.builders)) if (!(v.order && v.order.t === 'build')) setOrder(v, { t: 'build', id: wip.id });
    }
    return _eco.call(this, dt);
  };
  const _mil = AIPlayer.prototype.military;
  AIPlayer.prototype.military = function (dt) {
    const r = _mil.call(this, dt);
    // an enemy Wonder is counting down: throw the army at it
    const tgt = W.list.find(b => b.kind === 'bld' && b.type === 'wonder' && b.wonderT !== undefined && !b.dead && isEnemy(this.id, b.owner));
    if (tgt && W.t - (this.vicRushT || -99) > 8) {
      this.vicRushT = W.t;
      const army = this.army(); const c = center(tgt);
      if (army.length >= 3) {
        this.state = 'attacking'; this.focus = tgt.owner;
        for (const u of army) {
          if (u.order && u.order.t === 'attack' && u.order.id === tgt.id) continue;
          if (UNITS[u.type].onlyBld || hasTag(u.type, 'siege')) setOrder(u, { t: 'attack', id: tgt.id });
          else if (!u.order || u.order.t === 'move' || u.order.t === 'attackmove') setOrder(u, { t: 'attackmove', x: c.x, y: c.y });
        }
      }
    }
    return r;
  };
}

// =====================================================================================
// 7. HUD: countdown banner, live score panel (top-bar button / F4), rich end screen with chart
// =====================================================================================
const VIC_CSS = `
#vic-banner{position:absolute;top:40px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;z-index:6}
#vic-banner .vb{display:flex;align-items:center;gap:8px;padding:3px 14px;background:linear-gradient(180deg,rgba(58,40,20,.92),rgba(30,20,10,.92));border:1px solid #b08a4a;border-radius:4px;font:600 15px 'Cinzel',serif;color:#f3e2b8;text-shadow:0 1px 2px #000;box-shadow:0 2px 6px rgba(0,0,0,.6)}
#vic-banner .vb b{font-variant-numeric:tabular-nums;color:#ffd76a;min-width:44px;text-align:right}
#vic-banner .vb.hot b{color:#ff8a6a}
#vic-banner .sw{margin:0}
#vic-score{position:absolute;top:40px;right:10px;min-width:200px;padding:6px 8px;background:linear-gradient(180deg,rgba(58,40,20,.94),rgba(30,20,10,.94));border:1px solid #b08a4a;border-radius:4px;font-size:14px;z-index:6;box-shadow:0 2px 8px rgba(0,0,0,.6)}
#vic-score h4{margin:0 0 4px;font:600 13px 'Cinzel',serif;color:#d8b25a;display:flex;justify-content:space-between}
#vic-score table{border-collapse:collapse;width:100%}
#vic-score td{padding:1px 4px;white-space:nowrap}
#vic-score td.n{text-align:right;font-variant-numeric:tabular-nums;color:#ffe9b0;font-weight:600}
#vic-score td.a{color:#d8b25a;font-family:'Cinzel',serif;text-align:center}
#vic-score tr.dead td{opacity:.45;text-decoration:line-through}
#vic-score tr.me td{color:#fff}
.vic-end .vic-sub{margin:0 0 8px}
.vic-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 8px;border-bottom:2px solid #8a6a38}
.vic-tabs button{font-family:'Cinzel',serif;font-size:13px;background:#d8c49a;color:#3a2a14;border:1px solid #8a6a38;border-bottom:none;border-radius:4px 4px 0 0;padding:4px 10px;cursor:pointer}
.vic-tabs button.on{background:#3b2a1a;color:#f3e2b8}
.vic-pane{display:none}.vic-pane.on{display:block}
.vic-end table.stats td:not(:first-child),.vic-end table.stats th:not(:first-child){text-align:right;font-variant-numeric:tabular-nums}
.vic-end table.stats tr.tot td{font-weight:700;border-top:2px solid #6a4a20}
.vic-chartbox{background:#1d150d;border:1px solid #6a4a20;border-radius:4px;padding:6px;position:relative}
.vic-chartbox canvas{width:100%;height:270px;display:block}
.vic-series{display:flex;gap:4px;margin-bottom:6px}
.vic-series button{font-size:12px;padding:2px 8px;background:#3b2a1a;color:#e8d8b0;border:1px solid #8a6a38;border-radius:3px;cursor:pointer}
.vic-series button.on{background:#d8b25a;color:#2a1d12}
`;
function vicEnsureCss() {
  if (typeof document === 'undefined' || document.getElementById('vic-css')) return;
  const s = document.createElement('style'); s.id = 'vic-css'; s.textContent = VIC_CSS; document.head.appendChild(s);
}
const VIC_UI = { scoreOpen: false };
function vicToggleScore(force) {
  VIC_UI.scoreOpen = force !== undefined ? force : !VIC_UI.scoreOpen;
  vicRenderScore();
}
function vicRenderScore() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('vic-score');
  if (!VIC.score || !VIC_UI.scoreOpen || !W || !W.players) { if (el) el.remove(); return; }
  const hud = document.getElementById('hud'); if (!hud) return;
  if (!el) { el = document.createElement('div'); el.id = 'vic-score'; hud.appendChild(el); }
  const rows = W.players.slice(1).map(p => ({ p, s: vicScore(p).total })).sort((a, b) => b.s - a.s);
  const html = `<h4><span>Score</span><span class="small" style="color:#b9a57c">F4</span></h4><table>${rows.map(({ p, s }) => `<tr class="${p.alive ? '' : 'dead'} ${p.id === W.humanId ? 'me' : ''}"><td><span class="sw" style="background:${p.color.c}"></span>${escapeHtml(p.name)}</td><td class="a" title="${AGES[p.age]}">${VIC_ROMAN[p.age]}</td><td class="n">${s}</td></tr>`).join('')}</table>`;
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
function vicRenderBanner() {
  if (typeof document === 'undefined') return;
  const hud = document.getElementById('hud'); if (!hud) return;
  let el = document.getElementById('vic-banner');
  if (!el) { el = document.createElement('div'); el.id = 'vic-banner'; hud.appendChild(el); }
  const ts = W.over ? [] : vicTimers();
  const html = ts.map(x => { const p = W.players[x.pid]; return `<div class="vb ${isFriend(x.pid, W.humanId) ? '' : 'hot'}"><span>${x.kind === 'wonder' ? '🏛 Wonder' : '✝ All relics'}</span><span class="sw" style="background:${p.color.c}"></span><span>${escapeHtml(p.name)}</span><b>${vicFmt(x.t)}</b></div>`; }).join('');
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
if (typeof updateTopbar === 'function') {
  const _ut = updateTopbar;
  updateTopbar = function () {
    _ut();
    vicEnsureCss();
    if (VIC.score && !document.getElementById('b-score')) {
      const bb = document.querySelector('#topbar .tb-btns');
      if (bb) { const b = document.createElement('button'); b.className = 'btn small'; b.id = 'b-score'; b.textContent = 'Score'; b.title = 'Show or hide the score of every player (F4)'; b.onclick = () => vicToggleScore(); bb.insertBefore(b, bb.firstChild); }
    }
    vicRenderBanner();
    vicRenderScore();
  };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', e => {
    if (e.key !== 'F4' || !VIC.score || typeof UI === 'undefined' || !UI.gameRunning || UI.chatOpen) return;
    e.preventDefault(); vicToggleScore();
  });
}
// ---------- end screen ----------
const VIC_DASH = [[], [7, 4], [2, 3], [10, 3, 2, 3], [5, 2], [1, 2]];
function vicDrawChart(cv, key, hoverX) {
  const hist = (W.vicHist || []).slice();
  const players = W.players.slice(1);
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const Wd = cv.clientWidth || 760, Hd = cv.clientHeight || 270;
  if (cv.width !== Math.round(Wd * dpr)) { cv.width = Math.round(Wd * dpr); cv.height = Math.round(Hd * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, Wd, Hd);
  const pad = { l: 46, r: 92, t: 12, b: 24 };
  const T = Math.max(60, hist.length ? hist[hist.length - 1].t : 60);
  const val = (h, i) => (h.p[i] ? h.p[i][key] : 0) || 0;
  let maxV = 10; for (const h of hist) for (let i = 1; i < h.p.length; i++) maxV = Math.max(maxV, val(h, i));
  const step0 = Math.pow(10, Math.floor(Math.log10(maxV))); const niceMax = Math.ceil(maxV / step0) * step0;
  const X = t => pad.l + t / T * (Wd - pad.l - pad.r), Y = v => Hd - pad.b - v / niceMax * (Hd - pad.t - pad.b);
  g.font = '11px Georgia, serif'; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const v = niceMax * k / 4, y = Y(v);
    g.strokeStyle = 'rgba(232,220,190,0.12)'; g.beginPath(); g.moveTo(pad.l, y + 0.5); g.lineTo(Wd - pad.r, y + 0.5); g.stroke();
    g.fillStyle = 'rgba(232,220,190,0.65)'; g.textAlign = 'right'; g.fillText(String(Math.round(v)), pad.l - 6, y + 4);
  }
  g.textAlign = 'center';
  const tstep = T > 3600 ? 900 : T > 1800 ? 600 : T > 600 ? 300 : T > 240 ? 60 : 30;
  for (let t = 0; t <= T + 0.1; t += tstep) g.fillText(vicFmt(t), X(t), Hd - 7);
  const ends = [];
  players.forEach((p, k) => {
    const i = p.id;
    g.strokeStyle = p.color.c; g.lineWidth = i === W.humanId ? 2.6 : 2; g.setLineDash(VIC_DASH[k % VIC_DASH.length]); g.lineJoin = 'round';
    g.beginPath(); hist.forEach((h, j) => { const x = X(h.t), y = Y(val(h, i)); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
    const last = hist[hist.length - 1];
    if (last) { g.fillStyle = p.color.c; g.strokeStyle = '#1d150d'; g.lineWidth = 2; g.beginPath(); g.arc(X(last.t), Y(val(last, i)), 3.5, 0, 6.3); g.fill(); g.stroke(); ends.push({ p, y: Y(val(last, i)), x: X(last.t) }); }
  });
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
  g.textAlign = 'left'; g.fillStyle = 'rgba(240,230,205,0.92)';
  for (const e of ends) g.fillText(e.p.name.slice(0, 12), e.x + 8, e.y + 4);
  if (hoverX != null && hist.length) {
    let idx = 0, bd = 1e9; hist.forEach((h, j) => { const d = Math.abs(X(h.t) - hoverX); if (d < bd) { bd = d; idx = j; } });
    const h = hist[idx], x = X(h.t);
    g.strokeStyle = 'rgba(240,230,205,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 0.5, pad.t); g.lineTo(x + 0.5, Hd - pad.b); g.stroke();
    const lines = players.map(p => ({ p, v: val(h, p.id) })).sort((a, b) => b.v - a.v);
    for (const l of lines) { g.fillStyle = l.p.color.c; g.strokeStyle = '#1d150d'; g.lineWidth = 2; g.beginPath(); g.arc(x, Y(l.v), 4, 0, 6.3); g.fill(); g.stroke(); }
    const bw = 168, bh = 22 + lines.length * 16, bx = x + 12 + bw > Wd ? x - 12 - bw : x + 12, by = pad.t + 4;
    g.fillStyle = 'rgba(20,16,12,0.95)'; g.strokeStyle = 'rgba(201,161,60,0.7)'; g.fillRect(bx, by, bw, bh); g.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    g.fillStyle = '#ffd76a'; g.textAlign = 'left'; g.font = 'bold 12px Georgia, serif'; g.fillText(vicFmt(h.t), bx + 8, by + 15);
    g.font = '12px Georgia, serif';
    lines.forEach((l, k) => { const y = by + 31 + k * 16; g.fillStyle = l.p.color.c; g.fillRect(bx + 8, y - 9, 10, 10); g.fillStyle = 'rgba(240,230,205,0.95)'; g.textAlign = 'left'; g.fillText(l.p.name.slice(0, 14), bx + 24, y); g.textAlign = 'right'; g.fillText(String(Math.round(l.v)), bx + bw - 8, y); });
  }
}
function vicEndHtml(win) {
  const players = W.players.slice(1);
  const v = W.victory;
  let sub;
  if (v && v.kind === 'wonder') sub = isFriend(v.pid, W.humanId) ? `${v.pid === W.humanId ? 'Your' : W.players[v.pid].name + "'s"} Wonder stood for ${vicMarkText(VIC.wonderTime)}. Your legacy is secured.` : `${W.players[v.pid].name}'s Wonder stood for ${vicMarkText(VIC.wonderTime)}. Their legacy outshines yours.`;
  else if (v && v.kind === 'relic') sub = isFriend(v.pid, W.humanId) ? `${v.pid === W.humanId ? 'You' : W.players[v.pid].name} held every relic for ${vicMarkText(VIC.relicTime)}.` : `${W.players[v.pid].name} held every relic for ${vicMarkText(VIC.relicTime)}.`;
  else sub = win ? 'All rival players have been defeated or are your allies.' : 'Your civilization has fallen.';
  const at = t => t === null || t === undefined ? '—' : t === 0 ? 'start' : vicFmt(t);
  const status = p => { const s = vicStats(p); if (v && v.winners && v.winners.includes(p.id)) return 'Winner'; if (!p.alive) return 'Defeated' + (s.defeatT !== null ? ' ' + vicFmt(s.defeatT) : ''); return isFriend(p.id, W.humanId) ? 'Allied' : 'Alive'; };
  const head = `<tr><th></th>${players.map(p => `<th><span class="sw" style="background:${p.color.c}"></span>${escapeHtml(p.name)}</th>`).join('')}</tr>`;
  const table = rows => `<table class="stats">${head}${rows.map(([label, f, cls]) => `<tr class="${cls || ''}"><td>${label}</td>${players.map(p => `<td>${f(p)}</td>`).join('')}</tr>`).join('')}</table>`;
  const S = p => vicStats(p), G = p => S(p).gathered, SC = p => vicScore(p);
  const panes = {
    Summary: table([['Civilization', p => CIVS[p.civ].name], ['Age reached', p => AGES[p.age]], ['Military score', p => SC(p).mil], ['Economy score', p => SC(p).eco], ['Technology score', p => SC(p).tech], ['Society score', p => SC(p).soc], ['Total score', p => SC(p).total, 'tot'], ['Status', status]]),
    Military: table([['Units killed', p => S(p).uKilled], ['Units lost', p => S(p).uLost], ['Buildings razed', p => S(p).bRazed], ['Buildings lost', p => S(p).bLost], ['Military trained', p => S(p).trainedMil], ['Largest army', p => S(p).maxMil], ['Kill/loss ratio', p => S(p).uLost ? (S(p).uKilled / S(p).uLost).toFixed(2) : S(p).uKilled ? '∞' : '—']]),
    Economy: table([['Food gathered', p => Math.floor(G(p).food)], ['Wood gathered', p => Math.floor(G(p).wood)], ['Gold gathered', p => Math.floor(G(p).gold)], ['Stone gathered', p => Math.floor(G(p).stone)], ['Relic gold', p => Math.floor(p.stats.relicGold || 0)], ['Trade gold', p => Math.floor(p.stats.tradeGold || 0)], ['Tribute sent', p => Math.floor(p.stats.tributeSent || 0)], ['Villagers trained', p => S(p).trainedVil], ['Most villagers', p => S(p).maxVil], ['Peak population', p => S(p).maxPop]]),
    Technology: table([['Technologies researched', p => S(p).techs], ['Feudal Age', p => at(S(p).ageT[1])], ['Castle Age', p => at(S(p).ageT[2])], ['Imperial Age', p => at(S(p).ageT[3])]]),
    Society: table([['Relics held now', p => vicCounts(p.id).relics], ['Most relics held', p => S(p).maxRelics], ['Wonders built', p => S(p).wondersBuilt], ['Castles built', p => S(p).castlesBuilt], ['Buildings constructed', p => p.stats.built]]),
    Timeline: `<div class="vic-series">${[['score', 'Score'], ['pop', 'Population'], ['vil', 'Villagers'], ['mil', 'Military']].map(([k, n], i) => `<button data-series="${k}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div><div class="vic-chartbox"><canvas id="vic-chart"></canvas></div><div class="small">Sampled every ${VIC.sampleEvery} s of game time. Hover the chart for exact values.</div>`,
  };
  const names = Object.keys(panes);
  return `<div class="vic-end"><p class="vic-sub">${sub} Time: ${vicFmt(W.t)}</p><div class="vic-tabs">${names.map((n, i) => `<button data-tab="${n}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div>${names.map((n, i) => `<div class="vic-pane ${i ? '' : 'on'}" data-pane="${n}">${panes[n]}</div>`).join('')}</div>`;
}
if (typeof UI === 'object' && typeof openModal === 'function' && VIC.score) {
  UI.showEnd = function (win) {
    vicEnsureCss();
    vicSample();
    const btns = [['Restart', () => restartGame()]];
    if (UI.fromEditor) btns.push(['Return to Editor', () => { UI.gameRunning = false; Editor.open(UI.fromEditorName); }]);
    btns.push(['Main Menu', () => { UI.gameRunning = false; showScreen('menu'); }]);
    btns.push(['Keep watching', () => { }]);
    const m = openModal(win ? '🏆 Victory!' : '💀 Defeat', vicEndHtml(win), btns);
    const box = m.querySelector('.modal-box'); if (box) box.style.minWidth = 'min(820px, 92vw)';
    let series = 'score', hover = null;
    const cv = m.querySelector('#vic-chart');
    const draw = () => { if (cv && cv.clientWidth) vicDrawChart(cv, series, hover); };
    m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      m.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      m.querySelectorAll('[data-pane]').forEach(x => x.classList.toggle('on', x.dataset.pane === b.dataset.tab));
      draw();
    });
    m.querySelectorAll('[data-series]').forEach(b => b.onclick = () => { series = b.dataset.series; m.querySelectorAll('[data-series]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    if (cv) {
      cv.onmousemove = e => { const r = cv.getBoundingClientRect(); hover = e.clientX - r.left; draw(); };
      cv.onmouseleave = () => { hover = null; draw(); };
    }
  };
}
