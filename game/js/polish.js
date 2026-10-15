// ===== Realms mod: polish pass (path budget, spectator HUD, panel layout) =====
// Loaded after movement.js, before main.js.
'use strict';

// ---------- path-finding budget ----------
// In big battles dozens of units ask for a new route in the same tick. A unit that still has a route keeps it and
// retries a moment later once the tick's budget is spent; units without any route are always served.
const PATHB = { perTick: 24, tick: -1, used: 0, deferred: 0, world: null };
function pathBudgetSameGoal(a, b) {
  return !!a && ['x0', 'y0', 'x1', 'y1'].every(k => a[k] === b[k]);
}
if (typeof pathTo === 'function') {
  const _pt = pathTo;
  pathTo = function (u, rect, r) {
    if (W && (W !== PATHB.world || W.tick !== PATHB.tick)) { PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0; }
    if (PATHB.used >= PATHB.perTick && u.path && u.pi < u.path.length && u.goalRect &&
        pathBudgetSameGoal(u.goalRect, rect) && u.goalR === r &&
        u._pathMapVersion === W.map.version) {
      PATHB.deferred++;
      u.repathT = 0.1 + simRandomSafe() * 0.3;
      return u.pathOk;
    }
    PATHB.used++;
    const ok = _pt(u, rect, r);
    u._pathMapVersion = W.map.version;
    return ok;
  };
}
function simRandomSafe() { return typeof simRandom === 'function' ? simRandom() : Math.random(); }

// ---------- spectator HUD ----------
// The top bar follows the player you watch (keys 1-8), Diplomacy is hidden and the empty-selection hint fits.
if (typeof updateTopbar === 'function') {
  const _ut = updateTopbar;
  updateTopbar = function () {
    if(typeof document!=='undefined'){
      const d=document.querySelector('#b-dip');if(d)d.style.display=W&&W.spectate?'none':'';
      const age=document.querySelector('#age-label');if(age&&!W?.spectate)age.title='';
    }
    if (!W || !W.spectate || !W.players) return _ut();
    const watch = W.players[W.watchId] || W.players[W.humanId];
    const human = UI.human;
    UI.human = () => watch;
    try { _ut(); } finally { UI.human = human; }
    if (typeof document !== 'undefined') {
      const d = document.querySelector('#b-dip'); if (d) d.style.display = 'none';
      const age = document.querySelector('#age-label'); if (age && watch) age.title = `Watching ${watch.name}`;
    }
  };
}
if (typeof renderSelInfo === 'function') {
  const _rsi = renderSelInfo;
  renderSelInfo = function () {
    _rsi();
    if (!W || !W.spectate || UI.selection.length || typeof document === 'undefined') return;
    const box = document.querySelector('#selinfo'); if (!box) return;
    const p = W.players[W.watchId] || W.players[W.humanId];
    box.innerHTML = `<div class="small dim">Watching <b style="color:${p.color.l}">${escapeHtml(p.name)}</b> (${CIVS[p.civ].name}). Keys 1–8 switch player · +/− speed · F4 scores · click a unit or building to inspect it.</div>`;
  };
}
if (typeof GameHooks === 'object') {
  const resetPathBudget=()=>{PATHB.world=null;PATHB.tick=-1;PATHB.used=0;};
  GameHooks.on('worldCreated',resetPathBudget);GameHooks.on('worldRestored',resetPathBudget);
}

// ---------- score panel and tip box share the top-right corner ----------
if (typeof vicRenderScore === 'function') {
  const _vrs = vicRenderScore;
  vicRenderScore = function () { _vrs(); if (typeof document !== 'undefined') document.body.classList.toggle('vic-score-open', !!document.getElementById('vic-score')); };
}
