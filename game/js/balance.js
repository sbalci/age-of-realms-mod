// ===== Realms mod: economy and balance around water and ageing =====
// Loaded after wells.js/mod.js systems and before main.js. Adds two technologies that let a player answer the
// pressure of ageing and thirst, a helper the AI uses to replace villagers before they retire, and a small
// productivity curve so that elders matter: they work steadily, then slow down in their last years.
// URL switch: ?balance=off restores the earlier rules.
'use strict';
const BAL = {
  enabled: true,
  retireWarn: 120,        // seconds before old age (or vows) when the AI already trains a replacement
  elderShare: 0.85,       // share of the lifespan after which a villager gathers more slowly
  elderGather: 0.85,      // gather rate in the last years
  herbalLife: 1.2,        // Herbal Medicine: everyone lives this much longer
  sanitationWater: 1.5,   // Sanitation: wells and cisterns serve this many times more people
};
if (typeof location !== 'undefined' && location.search && new URLSearchParams(location.search).get('balance') === 'off') BAL.enabled = false;

// ---------- lifespans ----------
// In 35-minute AI test games each side lost 14-21 villagers to old age and vows (25-minute lives, vows at 15):
// most of the starting town was gone before the Castle Age. Villagers now live about 30 minutes and the
// one-in-five who are called to the cloister go at about 18; monks live about 35.
if (BAL.enabled && typeof MOD === 'object' && MOD.life) Object.assign(MOD.life, { villager: 1800, villagerVows: 1080, monk: 2100 });

// ---------- technologies ----------
if (BAL.enabled && typeof TECHS === 'object') {
  if (!TECHS.herbalmedicine) {
    TECHS.herbalmedicine = { name: 'Herbal Medicine', at: 'monastery', age: 2, cost: { food: 150, gold: 100 }, time: 45, hk: 'T', icon: 'flask',
      desc: 'Monks share their remedies: villagers, soldiers and monks live 20% longer.', fx: p => { p.lifeMul = (p.lifeMul || 1) * BAL.herbalLife; } };
    (TECHS_AT.monastery = TECHS_AT.monastery || []).push('herbalmedicine');
  }
  if (!TECHS.sanitation) {
    TECHS.sanitation = { name: 'Sanitation', at: 'university', age: 2, cost: { food: 200, stone: 100 }, time: 50, hk: 'A', icon: 'brick',
      desc: 'Lined wells and covered cisterns: every well and Town Center serves 50% more people.', fx: p => { p.waterMul = (p.waterMul || 1) * BAL.sanitationWater; } };
    (TECHS_AT.university = TECHS_AT.university || []).push('sanitation');
  }
}

// ---------- lifespans and water follow the player's technologies ----------
if (BAL.enabled && typeof modLimits === 'function') {
  const _ml = modLimits;
  modLimits = function (u) {
    const lim = _ml(u); if (!lim) return lim;
    const p = W && W.players ? W.players[u.owner] : null, k = (p && p.lifeMul) || 1;
    return k === 1 ? lim : { vows: lim.vows * k, max: lim.max * k };
  };
}
if (BAL.enabled && typeof wlWellSupply === 'function') {
  const _ws = wlWellSupply, _ts = wlTcSupply;
  const mul = b => { const p = W.players[b.owner]; return (p && p.waterMul) || 1; };
  wlWellSupply = function (b) { return Math.round(_ws(b) * mul(b)); };
  wlTcSupply = function (b) { return Math.round(_ts(b) * mul(b)); };
}

// ---------- elders ----------
// A villager past 85% of its lifespan gathers 15% slower: an ageing town is a real cost, and replacing people
// before they retire becomes a decision rather than a surprise.
function balElder(u) {
  if (!BAL.enabled || !u || u.type !== 'villager' || typeof modLimits !== 'function' || typeof modAge !== 'function') return false;
  const lim = modLimits(u); return !!lim && modAge(u) >= lim.max * BAL.elderShare;
}
// true when this person will leave the workforce (old age or vows) within BAL.retireWarn seconds
function balRetiring(u) {
  if (!BAL.enabled || !u || typeof modLimits !== 'function' || typeof modAge !== 'function' || (typeof MOD === 'object' && !MOD.aging)) return false;
  const lim = modLimits(u); if (!lim) return false;
  const a = modAge(u), soon = a + BAL.retireWarn;
  return soon >= lim.max || (u.type === 'villager' && lim.vows > 0 && soon >= lim.vows);
}
if (BAL.enabled && typeof gatherRate === 'function') {
  const _gr = gatherRate;
  gatherRate = function (u, e) { const r = _gr(u, e); return balElder(u) ? r * BAL.elderGather : r; };
}
// the selection panel says so
if (BAL.enabled && typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    const sel = UI.selection; if (sel.length !== 1 || typeof document === 'undefined') return;
    const u = sel[0], info = document.querySelector('#selinfo .info');
    if (!info || u.kind !== 'unit' || !balElder(u)) return;
    info.insertAdjacentHTML('beforeend', '<div class="small dim">Elder: gathers 15% slower</div>');
  };
}
