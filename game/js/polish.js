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
    // a group member taking its group's route (hpa.js) is not charged: the group's one search is, when it runs
    const shared = typeof hpaShares === 'function' && hpaShares(u);
    if (!shared && PATHB.used >= PATHB.perTick && u.path && u.pi < u.path.length && u.goalRect &&
        pathBudgetSameGoal(u.goalRect, rect) && u.goalR === r &&
        u._pathMapVersion === W.map.version) {
      PATHB.deferred++;
      u.repathT = 0.1 + simRandomSafe() * 0.3;
      return u.pathOk;
    }
    if (!shared) PATHB.used++;
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

// ---------- top bar: pause button and gatherer counts per resource ----------
function polishGatherers(pid) {
  const c = { food: 0, wood: 0, gold: 0, stone: 0, coal: 0, build: 0 };
  for (const u of W.list) {
    if (u.kind !== 'unit' || u.owner !== pid || u.dying || u.inside || !u.order) continue;
    if (u.type !== 'villager' && u.type !== 'fishingship' && u.type !== 'sapper') continue;
    const o = u.order;
    if (o.t === 'build' || o.t === 'repair' || o.t === 'terra') { c.build++; continue; }
    if (o.t === 'gather' || o.t === 'farm' || o.t === 'fish' || o.t === 'hunt') {
      const t = ent(o.id); const k = o.t === 'hunt' || o.t === 'farm' || o.t === 'fish' ? 'food' : t ? resKind(t) : (u.carry && u.carry.res);
      if (k && c[k] !== undefined) c[k]++;
    }
  }
  return c;
}
if (typeof updateTopbar === 'function') {
  const _ut2 = updateTopbar;
  updateTopbar = function () {
    _ut2();
    if (typeof document === 'undefined' || !W || !W.players || W.menu) return;
    const bb = document.querySelector('#topbar .tb-btns');
    let pb = document.querySelector('#b-pause');
    if (bb && !pb) {
      pb = document.createElement('button'); pb.className = 'btn small'; pb.id = 'b-pause';
      pb.onclick = () => { UI.paused = !UI.paused; };
      bb.insertBefore(pb, bb.firstChild);
    }
    if (pb) { const t = UI.paused ? 'Resume' : 'Pause'; if (pb.textContent !== t) { pb.textContent = t; pb.title = `${t} the game (F3)`; } }
    if (Math.abs(W.t - (W._gcT || -9)) < 1) return; W._gcT = W.t;   // counts change slowly
    const p = W.spectate ? (W.players[W.watchId] || W.players[W.humanId]) : W.players[W.humanId]; if (!p) return;
    const c = polishGatherers(p.id);
    for (const r of RES) {
      const el = document.querySelector('#r-' + r); if (!el) continue;
      let s = el.querySelector('.gc'); if (!s) { s = document.createElement('small'); s.className = 'gc'; el.appendChild(s); }
      const txt = c[r] ? String(c[r]) : '';
      if (s.textContent !== txt) { s.textContent = txt; el.title = `${r[0].toUpperCase() + r.slice(1)}: ${c[r]} gatherer${c[r] === 1 ? '' : 's'}${r === 'food' && c.build ? '' : ''}`; }
    }
    const v = document.querySelector('#r-vil'); if (v && c.build !== undefined) v.dataset.builders = c.build;
  };
}

// ---------- F1 in the map editor ----------
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key !== 'F1' || !document.body.classList.contains('in-editor')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!document.querySelector('#modal').classList.contains('hidden')) return;
    openModal('Map Editor help', `<p><b>Paint</b> terrain, elevation and objects with the left mouse button; the brush slider sets the size. Right-drag or the arrow keys move the view, the mouse wheel zooms.</p>
<ul><li><b>Select</b>: click or drag objects to move them; Delete removes the selection.</li>
<li><b>Raise / Lower / Flatten</b>: change elevation. Steps of two levels or more become cliffs that units cannot climb.</li>
<li><b>Bridge</b>, <b>Tunnel</b>, <b>Trench</b>: paint engineering layers. Bridges go over water, tunnels pass through hills and cliffs, trenches slow units and stop cavalry and siege.</li>
<li><b>Start</b>: set the selected player's starting location. Every player needs one before the map can be played.</li>
<li><b>Validate</b> checks the map, <b>Save &amp; Play</b> saves and plays it at once, <b>Save</b> keeps it in this browser , <b>Export file</b> downloads it and <b>Import file</b> loads one.</li>
<li><b>Ctrl+Z / Ctrl+Y</b>: undo and redo.</li></ul>`, [['Close', null]]);
  }, true);
}
