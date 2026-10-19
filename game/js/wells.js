// ===== Realms mod, batch 3: wells, clean water and thirst =====
// Loaded after water.js. A settlement can only keep so many people in clean water. Past that, people work less and wear down.
// URL switch: ?thirst=off
'use strict';
const WELLM = {
  enabled: true,
  base: 8,            // free allowance: everyone starts with a few buckets
  tcCistern: 10,      // each Town Center has its own cistern
  tcFresh: 15,        // ...and 15 more when a river or lake is within tcScan tiles
  well: 12,           // people served by one well
  wellFresh: 1.5,     // x when fed by a river or lake within wellScan tiles
  wellBrackish: 0.6,  // x when only the sea is near (salt seeps in)
  wellScan: 7, tcScan: 10,
  gatherFloor: 0.5,   // gathering never falls below this fraction
  drain: 0.2,         // hp per second per unit at full deficit; never lethal (floors at 1 hp)
  thirstAt: 0.05,     // deficit (share of people without clean water) at which the warning shows
};
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('thirst') === 'off') WELLM.enabled = false;

// ---------- the building ----------
if (typeof BUILDINGS === 'object' && !BUILDINGS.well) {
  BUILDINGS.well = { name: 'Well', size: 1, hp: 400, ma: 0, pa: 4, cost: { wood: 40, stone: 10 }, time: 20, age: 0, cat: 'eco', hk: 'C', los: 3,
    desc: 'Clean water for 12 people (18 near a river or lake, 7 near only the sea). Town Centers hold a cistern.' };
}
if (typeof BLD_H === 'object') BLD_H.well = 30;
if (typeof drawBuildingArt === 'function') {
  const _dba = drawBuildingArt;
  drawBuildingArt = function (g, type, st, pc, t) {
    if (type !== 'well') return _dba(g, type, st, pc, t);
    const S = STYLE[Math.min(3, st)];
    cyl(g, 0, 0, 0.42, 0, 11, S.stone);
    cyl(g, 0, 0, 0.3, 11, 0.8, '#2f6b8f');
    box(g, -0.5, -0.06, 0.1, 0.12, 0, 30, S.trim);
    box(g, 0.4, -0.06, 0.1, 0.12, 0, 30, S.trim);
    box(g, -0.54, -0.07, 1.08, 0.14, 30, 4, S.trim);
    box(g, -0.1, -0.05, 0.14, 0.12, 19, 7, '#8a6a3a');
    flag(g, 0.45, 0, 34, pc.c, t, 0.5);
  };
}

// ---------- supply ----------
// 'fresh' if a river or lake lies within r tiles, 'salt' if only the sea does, else null. Cached per terrain version.
function wlSource(map, x, y, r) {
  let salt = false;
  for (let yy = Math.max(0, y - r); yy <= Math.min(map.n - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(map.n - 1, x + r); xx++) {
    if (Math.hypot(xx - x, yy - y) > r || !isWaterT(map.ter[yy * map.n + xx])) continue;
    const k = typeof waterKindAt === 'function' ? waterKindAt(map, xx, yy) : 'sea';
    if (k === 'river' || k === 'lake') return 'fresh';
    salt = true;
  }
  return salt ? 'salt' : null;
}
function wlBldSource(b) {
  if (b._wsV !== W.map.version) {
    const c = center(b);
    b._wsV = W.map.version;
    b._ws = wlSource(W.map, c.x | 0, c.y | 0, b.type === 'tc' ? WELLM.tcScan : WELLM.wellScan);
  }
  return b._ws;
}
function wlWellSupply(b) { const s = wlBldSource(b); return Math.round(WELLM.well * (s === 'fresh' ? WELLM.wellFresh : s === 'salt' ? WELLM.wellBrackish : 1)); }
function wlTcSupply(b) { return WELLM.tcCistern + (wlBldSource(b) === 'fresh' ? WELLM.tcFresh : 0); }
function wlCapacity(p) {
  let cap = WELLM.base;
  for (const e of idxOwned(p.id, 'bld')) {   // the player's buildings (index.js), in W.list order
    if (!e.built || e.dying) continue;
    if (e.type === 'tc') cap += wlTcSupply(e); else if (e.type === 'well') cap += wlWellSupply(e);
  }
  return cap;
}
if (typeof recalcPop === 'function') {
  const _rp = recalcPop;
  recalcPop = function () {
    _rp();
    for (let i = 1; i < W.players.length; i++) {
      const p = W.players[i]; if (!p) continue;
      p.waterCap = wlCapacity(p);
      p.waterDef = WELLM.enabled && p.pop > p.waterCap ? (p.pop - p.waterCap) / p.pop : 0;
    }
  };
}

// ---------- consequences ----------
if (typeof gatherRate === 'function') {
  const _gr = gatherRate;
  gatherRate = function (u, e) {
    const v = _gr(u, e), p = W.players[u.owner];
    return p && p.waterDef > 0 ? v * Math.max(WELLM.gatherFloor, 1 - p.waterDef * 1.5) : v;
  };
}
GameHooks.on('afterTick', dt => {
    if (!WELLM.enabled || !W.map) return;
    W.wlAcc = (W.wlAcc || 0) + dt;
    if (W.wlAcc < 1) return;
    const d = W.wlAcc; W.wlAcc = 0;
    for (const u of W.list) {
      if (u.kind !== 'unit' || u.dying || u.dead || u.inside) continue;
      const p = W.players[u.owner], def = p && p.waterDef;
      if (def > 0.2 && UNITS[u.type] && !UNITS[u.type].animal && !UNITS[u.type].naval && !UNITS[u.type].tags.includes('machine')) u.hp = Math.max(1, u.hp - WELLM.drain * def * d);
    }
    const h = W.players[W.humanId];
    if (h && h.waterDef > WELLM.thirstAt && W.t - (W.wlMsg || -99) > 60) { W.wlMsg = W.t; msg('Your people are thirsty. Dig wells, or settle by a river or lake.', '#8cf'); }
});

// ---------- AI: dig wells before the people go thirsty ----------
if (typeof AIPlayer === 'function') {
  const _eco = AIPlayer.prototype.economy;
  AIPlayer.prototype.economy = function (dt) {
    const p = this.p;
    if (WELLM.enabled && p.waterCap !== undefined && W.t - (this.wlT || -99) > 6) {
      this.wlT = W.t;
      const wells = this.mine(e => e.kind === 'bld' && e.type === 'well');
      const tcs = this.mine(e => e.kind === 'bld' && e.type === 'tc' && e.built);
      if (tcs.length && p.pop + 6 >= p.waterCap && !wells.some(w => !w.built) && wells.length < 16 && p.res.wood >= 40 && p.res.stone >= 10) {
        const home = center(tcs[(simRandom() * tcs.length) | 0]);
        this.build('well', home, 3, 10) || this.build('well', home, 3, 14);
      }
    }
    return _eco.call(this, dt);
  };
}

// ---------- HUD and info ----------
if (typeof updateTopbar === 'function') {
  const _ut = updateTopbar;
  updateTopbar = function () {
    _ut();
    const pop = document.querySelector('#r-pop'); if (!pop) return;
    let el = document.querySelector('#r-water');
    if (!el) { el = document.createElement('div'); el.className = 'res'; el.id = 'r-water'; el.innerHTML = '💧 <span>0</span>'; pop.insertAdjacentElement('afterend', el); }
    const p = UI.human(); if (!p || p.waterCap === undefined) return;
    el.title = 'Clean water: people your wells and cisterns can serve / population';
    el.querySelector('span').textContent = `${p.waterCap}`;
    el.classList.toggle('warn', p.pop > p.waterCap);
  };
}
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (sel.length !== 1) return;
    const e = sel[0], info = document.querySelector('#selinfo .info');
    if (!info || e.kind !== 'bld' || !e.built || (e.type !== 'well' && e.type !== 'tc') || e.owner !== W.humanId) return;
    const src = wlBldSource(e), n = e.type === 'well' ? wlWellSupply(e) : wlTcSupply(e);
    const how = src === 'fresh' ? 'fed by a river or lake' : src === 'salt' ? 'brackish, sea water seeps in' : 'rain-fed';
    info.insertAdjacentHTML('beforeend', `<div class="small dim">${e.type === 'well' ? 'Well' : 'Cistern'}: clean water for ${n} people (${how})</div>`);
  };
}
