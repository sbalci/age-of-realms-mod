// ===== Realms mod, batch 1: mortality, elder monks, veterans =====
// Loaded after every other script. Wraps engine functions instead of rewriting them.
// URL switches: ?aging=off  ?veterans=off  ?life=0.5 (multiplies all lifespans)
'use strict';
const MOD = {
  aging: true,
  veterans: true,
  lifeScale: 1,
  vowShare: 0.2,       // one villager in five is destined for the cloister; the rest work until they drop
  // Lifespans in game seconds at normal speed (a 20 minute infantryman, etc.). Each unit gets a +-15% personal variance.
  life: { villagerVows: 900, villager: 1500, monk: 1800, infantry: 1200, ranged: 1200, mounted: 1400, trade: 1500 },
  // Veteran ranks. Promotion needs the unit to survive a battle with enough accumulated XP.
  ranks: ['Recruit', 'Veteran', 'Elite', 'Champion'],
  xpNeeded: [6, 16, 34],        // cumulative XP to reach rank 1, 2, 3
  atkMul: [1, 1.10, 1.20, 1.35],
  hpMul: [1, 1.15, 1.30, 1.50],
  armorAdd: [0, 0, 1, 2],
  rofAdd: [0, 0, -0.05, -0.10], // negative = faster attacks
  battleQuiet: 10,              // seconds without fighting before a battle counts as over
};
if (typeof location !== 'undefined' && location.search) {
  const q = new URLSearchParams(location.search);
  if (q.get('aging') === 'off') MOD.aging = false;
  if (q.get('veterans') === 'off') MOD.veterans = false;
  const scale = +q.get('life'); if (Number.isFinite(scale) && scale > 0 && scale <= 100) MOD.lifeScale = scale;
}

// ---------- helpers ----------
function modLifeSpec(type) {
  const d = UNITS[type];
  if (!d || d.animal || d.naval || d.tags.includes('machine') || d.tags.includes('siege') || type === 'cobra') return null;
  if (type === 'villager') return { vows: MOD.life.villagerVows, max: MOD.life.villager };
  if (type === 'monk') return { max: MOD.life.monk };
  if (d.tags.includes('trade')) return { max: MOD.life.trade };
  if (d.tags.includes('mounted')) return { max: MOD.life.mounted };
  if (d.tags.includes('archer')) return { max: MOD.life.ranged };
  return { max: MOD.life.infantry };
}
function modAge(u) { return W.t - (u.bornT || 0); }
function modLimits(u) {
  const s = modLifeSpec(u.type); if (!s) return null;
  if (u.lifeK === undefined) { u.lifeK = 0.85 + simRandom() * 0.3; u.vows = simRandom() < MOD.vowShare; }
  const k = u.lifeK * MOD.lifeScale;
  return { vows: s.vows && u.vows ? s.vows * k : 0, max: s.max * k };
}
function modEligible(u) {
  if (!u || u.kind !== 'unit') return false;
  const d = UNITS[u.type];
  return !!d && d.atk > 0 && !d.animal && u.type !== 'villager' && u.type !== 'cobra' && !d.selfDestruct && !d.tags.includes('siege');
}
function modMaxHp(u) { return Math.round(unitMaxHp(u.type, u.owner) * MOD.hpMul[u.rank || 0]); }
function modNote(key, gap, text, color, owner) {
  if (owner !== W.humanId) return;
  if (W.t - (W['mod_' + key] || -99) < gap) return;
  W['mod_' + key] = W.t; msg(text, color);
}
function modFmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

// Assign life rolls when a unit enters the world; inspecting it cannot change RNG order.
GameHooks.on('entityAdded', e => { if (e.kind === 'unit') modLimits(e); });

// ---------- aging ----------
function modBecomeMonk(u) {
  const ratio = u.hp / u.maxhp;
  deposit(u);                               // a last day's work is not lost
  setOrder(u, null);
  u.carry = null; u.work = null; u.path = null;
  u.type = 'monk';
  u.maxhp = modMaxHp(u); u.hp = Math.max(1, u.maxhp * ratio);
  u.vowsTaken = true;
  emitFx('convert', u.x, u.y, 8);
  if (typeof UI !== 'undefined' && UI.selection && UI.selection.includes(u)) UI.panelKey = '';
  modNote('vows', 6, 'An elder villager has taken monastic vows.', '#cfe', u.owner);
}
function modDieOfAge(u) {
  const box = u.inside ? ent(u.inside) : null;
  if (box) {
    box.garrison = (box.garrison || []).filter(id => id !== u.id);
    box.cargo = (box.cargo || []).filter(id => id !== u.id);
    const c = center(box); u.x = c.x; u.y = c.y; u.inside = 0;
  }
  const p = W.players[u.owner];
  const name = UNITS[u.type].name;
  killEnt(u, null);
  if (p) p.stats.lost = Math.max(0, p.stats.lost - 1);   // old age is not a battle loss
  modNote('oldage', 5, `A ${name} has died of old age.`, '#bbb', u.owner);
}
function modAgeTick(u) {
  const lim = modLimits(u); if (!lim) return;
  const a = modAge(u);
  if (a >= lim.max) { modDieOfAge(u); return; }
  if (u.type === 'villager' && lim.vows && a >= lim.vows) modBecomeMonk(u);
}

// ---------- veterans ----------
function modMark(u, xp) {
  if (!modEligible(u) || u.dead || u.dying) return;
  u.xp = (u.xp || 0) + xp; u.fightT = W.t;
}
function modPromote(u) {
  const r = (u.rank || 0) + 1;
  u.rank = r;
  const m = modMaxHp(u); u.hp += m - u.maxhp; u.maxhp = m;
  emitFx('convert', u.x, u.y, 6);
  modNote('promo', 4, `Your ${UNITS[u.type].name} was promoted to ${MOD.ranks[r]}!`, '#ffd76a', u.owner);
}
function modBattleCheck(u) {
  if (!u.fightT || W.t - u.fightT < MOD.battleQuiet) return;
  u.fightT = 0;                                             // battle over; the unit survived it
  const r = u.rank || 0;
  if (r < 3 && (u.xp || 0) >= MOD.xpNeeded[r]) modPromote(u);
}

// ---------- engine wrappers (each guarded so the headless tests can load a subset) ----------
if (typeof updateUnit === 'function') {
  const _updateUnit = updateUnit;
  updateUnit = function (u, dt) {
    if (!u.dying && !u.dead) {
      if (MOD.aging) { modAgeTick(u); if (u.dead || u.dying) return; }
      if (MOD.veterans && !u.inside && u.fightT) modBattleCheck(u);
    }
    return _updateUnit(u, dt);
  };
}
if (typeof applyDamage === 'function') {
  const _applyDamage = applyDamage;
  applyDamage = function (t, dmg, src) {
    // no friendly fire: catapult splash and stray hits never hurt your own or allied units and buildings
    if (t && src && src.owner > 0 && t.owner > 0 && isFriend(src.owner, t.owner) && !(t.kind === 'unit' && UNITS[t.type] && UNITS[t.type].animal)) return;
    const live = t && !t.dead && !t.dying && t.kind === 'unit' && !UNITS[t.type].animal;
    const r = _applyDamage(t, dmg, src);
    // experience only from fighting an enemy player
    if (MOD.veterans && live && src && src.kind === 'unit' && !src.dead && src.owner > 0 && t.owner > 0 && isEnemy(src.owner, t.owner)) { modMark(src, 1); modMark(t, 1.5); }
    return r;
  };
}
if (typeof killEnt === 'function') {
  const _killEnt = killEnt;
  killEnt = function (e, src) {
    if (MOD.veterans && e && e.kind === 'unit' && !e.dead && !e.dying && !UNITS[e.type].animal && src && src.kind === 'unit' && src.owner > 0 && e.owner > 0 && isEnemy(src.owner, e.owner)) modMark(src, 4);
    return _killEnt(e, src);
  };
}
if (typeof statU === 'function') {
  const _statU = statU;
  statU = function (u, k) {
    const v = _statU(u, k), r = u && u.rank;
    if (!r) return v;
    if (k === 'atk') return v * MOD.atkMul[r];
    if (k === 'ma' || k === 'pa') return v + MOD.armorAdd[r];
    if (k === 'rofMul') return v + MOD.rofAdd[r];
    return v;
  };
}
if (typeof drawUnit === 'function') {
  const _drawUnit = drawUnit;
  drawUnit = function (ctx, u, sel) {
    _drawUnit(ctx, u, sel);
    if (!u.rank || u.dying) return;
    const d = UNITS[u.type], p = iso(u.x, u.y, d.naval ? -0.35 : W.map.h(u.x, u.y));
    ctx.save(); ctx.translate(p.x, p.y - unitHeight(u) - 8);
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    for (let i = 0; i < u.rank; i++) {
      const y = -i * 3.4;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(-3.5, y); ctx.lineTo(0, y + 2.6); ctx.lineTo(3.5, y); ctx.stroke();
      ctx.strokeStyle = u.rank >= 3 ? '#ffe36a' : u.rank === 2 ? '#e8e8f0' : '#e0a050'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-3.5, y); ctx.lineTo(0, y + 2.6); ctx.lineTo(3.5, y); ctx.stroke();
    }
    ctx.restore();
  };
}
if (typeof renderSelInfo === 'function') {
  const _renderSelInfo = renderSelInfo;
  renderSelInfo = function () {
    _renderSelInfo();
    const sel = UI.selection;
    if (sel.length !== 1 || sel[0].kind !== 'unit' || !sel[0].owner) return;
    const u = sel[0], info = document.querySelector('#selinfo .info'); if (!info) return;
    const parts = [];
    const lim = MOD.aging ? modLimits(u) : null;
    if (lim) {
      const a = modAge(u);
      let s = `Age ${modFmt(a)}`;
      if (u.type === 'villager' && lim.vows) s += ` · becomes a Monk at ~${modFmt(lim.vows)}`;
      else s += ` · lifespan ~${modFmt(lim.max)}`;
      parts.push(s);
    }
    if (MOD.veterans && modEligible(u)) {
      const r = u.rank || 0;
      parts.push(r ? `<b style="color:#ffd76a">${MOD.ranks[r]}</b>${r < 3 ? ` · XP ${Math.floor(u.xp || 0)}/${MOD.xpNeeded[r]}` : ''}` : `Recruit · XP ${Math.floor(u.xp || 0)}/${MOD.xpNeeded[0]}`);
    }
    if (parts.length) info.insertAdjacentHTML('beforeend', parts.map(t => `<div class="small dim">${t}</div>`).join(''));
  };
}
