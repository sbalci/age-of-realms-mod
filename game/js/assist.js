// Optional shared control: the normal AI runs your realm; direct player orders reserve units.
// Loaded last so every AI extension and command entry point uses the same arbitration.
'use strict';
const ASSIST = { active: null };
function assistOwn(u) { return !!(W && u && u.kind === 'unit' && u.owner === W.humanId && !u.dead && !u.dying); }
function assistReserved(u) { return assistOwn(u) && !!u.assistControl; }
function assistHumanAI(ai) { return !!(W && W.aiAssist && !W.spectate && ai.id === W.humanId); }
function assistContext(ai, fn) {
  const previous = ASSIST.active; ASSIST.active = ai.id;
  try { return fn(); } finally { ASSIST.active = previous; }
}
function assistReleaseFinished() {
  for (const u of W.list) {
    if (u.assistControl === 'order' && !u.order && !(u.queue && u.queue.length) && !u.inside) delete u.assistControl;
  }
}
function assistSetEnabled(enabled, announce = true) {
  if (!W || W.menu || W.editor || W.over || W.tutorial || W.spectate || W.settings.spectate) return false;
  const p = W.players[W.humanId]; if (!p || !p.human || !p.alive) return false;
  enabled = !!enabled;
  if (enabled) {
    W.assistAI = W.assistAI || new AIPlayer(p, 'standard');
    // The assistant has normal human gathering/building rates, regardless of opponent difficulty.
    W.assistAI.gatherMul = 1;
    for (const e of W.list) if (e.owner === p.id) {
      if (e.kind === 'unit' && e.order && e.order.user && !e.assistControl) e.assistControl = 'order';
      if (e.kind === 'bld' && !W.aiAssist) for (const q of e.queue) q.assistUser = true;
    }
    p.ai = W.assistAI;
  } else if (p.ai === W.assistAI) p.ai = null;
  W.aiAssist = W.settings.aiAssist = enabled;
  UI.panelKey = '';
  if (announce) msg(enabled ? 'AI Assist on: your orders take priority. Stop and stances keep units under your control; Return to AI hands them back.' : 'AI Assist off. Units continue their current orders.', '#9fd');
  return true;
}
function assistReturn(units) {
  if (!W.aiAssist || W.spectate) return;
  for (const u of units) if (assistOwn(u)) {
    delete u.assistControl; u.queue = []; u.defHome = null; u.stance = undefined;
    // Leave shelter when the town bell allows it; otherwise resume normal AI orders next tick.
    if (u.inside && !W.players[u.owner].bell) {
      const b = ent(u.inside); if (b && b.kind === 'bld') ungarrisonOne(b, u.id);
    }
    setOrder(u, null);
  }
  UI.panelKey = '';
}
GameHooks.on('worldCreated', () => { ASSIST.active = null; assistSetEnabled(!!W.settings.aiAssist, false); });
GameHooks.on('worldRestored', () => { ASSIST.active = null; });

const assistPreviousCanControl = AIPlayer.prototype.canControl;
AIPlayer.prototype.canControl = function (u) {
  return assistPreviousCanControl.call(this, u) && !(assistHumanAI(this) && assistReserved(u));
};
// Updates and immediate damage/training callbacks all count as AI decisions. Simulation order
// completion, queued waypoints and self-defense remain free to advance the player's orders.
for (const name of ['update', 'onAttacked', 'onTrained', 'onBuilt']) {
  const previous = AIPlayer.prototype[name];
  AIPlayer.prototype[name] = function (...args) {
    if (assistHumanAI(this)) {
      if (name === 'update') assistReleaseFinished();
      if (name === 'onTrained' && args[1].rally) { args[0].assistControl = 'order'; return; }
    }
    return assistContext(this, () => previous.apply(this, args));
  };
}
for (const name of ['army', 'navy']) {
  const previous = AIPlayer.prototype[name];
  AIPlayer.prototype[name] = function (...args) { return previous.apply(this, args).filter(u => this.canControl(u)); };
}
const assistPreviousAssign = AIPlayer.prototype.assign;
AIPlayer.prototype.assign = function (u, ...args) { return this.canControl(u) ? assistPreviousAssign.call(this, u, ...args) : false; };
const assistPreviousDiplomacy = AIPlayer.prototype.diplomacy;
AIPlayer.prototype.diplomacy = function (...args) { if (!assistHumanAI(this)) return assistPreviousDiplomacy.apply(this, args); };
const assistPreviousManageBell = AIPlayer.prototype.manageBell;
AIPlayer.prototype.manageBell = function (...args) { if (!(assistHumanAI(this) && this.p.assistManualBell)) return assistPreviousManageBell.apply(this, args); };

const assistPreviousOrder = setOrder;
setOrder = function (u, o) {
  if (W.aiAssist && ASSIST.active === W.humanId && assistReserved(u)) return;
  if (assistOwn(u) && !ASSIST.active && CMD.user && (W.aiAssist || W.assistAI)) {
    // A held stance stays in force across subsequent moves until explicitly returned to AI.
    if (u.assistControl !== 'hold') u.assistControl = o ? 'order' : 'hold';
    UI.panelKey = '';
  }
  return assistPreviousOrder.apply(this, arguments);
};
const assistPreviousStance = cmdSetStance;
cmdSetStance = function (units, stance) {
  if (W.aiAssist && !ASSIST.active) for (const u of units) if (assistOwn(u) && cmdMilitary(u)) u.assistControl = 'hold';
  return assistPreviousStance.apply(this, arguments);
};
const assistPreviousCommands = commandsFor;
commandsFor = function (sel) {
  const commands = assistPreviousCommands.apply(this, arguments);
  if (W.aiAssist && !W.spectate) {
    const stop = commands.find(c => c.name === 'Stop');
    if (stop) { const previous = stop.fn; stop.fn = () => cmdIssue(sel.filter(assistOwn), false, previous); }
  }
  return commands;
};
const assistPreviousUngarrison = ungarrisonOne;
ungarrisonOne = function (b, id) {
  if (W.aiAssist && ASSIST.active === W.humanId && assistReserved(ent(id))) return;
  return assistPreviousUngarrison.apply(this, arguments);
};
const assistPreviousRingBell = ringBell, assistPreviousAllClear = allClear;
ringBell = function (p) {
  if (p.id === W.humanId && (W.aiAssist || W.assistAI) && !ASSIST.active) p.assistManualBell = true;
  return assistPreviousRingBell(p, u => !(W.aiAssist && ASSIST.active === W.humanId && assistReserved(u)));
};
allClear = function (p) {
  if (p.id === W.humanId && !ASSIST.active) p.assistManualBell = false;
  return assistPreviousAllClear(p, u => !(W.aiAssist && ASSIST.active === W.humanId && assistReserved(u)));
};
// The AI may add production, but cannot cancel a player's paid-for training or research.
for (const name of ['queueUnit', 'queueTech']) {
  const previous = name === 'queueUnit' ? queueUnit : queueTech;
  const wrapped = function (b, id) {
    const result = previous.apply(this, arguments);
    if (!result && b.owner === W.humanId && !ASSIST.active && (W.aiAssist || W.assistAI)) b.queue[b.queue.length - 1].assistUser = true;
    return result;
  };
  if (name === 'queueUnit') queueUnit = wrapped; else queueTech = wrapped;
}
const assistPreviousCancel = cancelQueue;
cancelQueue = function (b, idx) {
  if (W.aiAssist && ASSIST.active === W.humanId && b.owner === W.humanId && b.queue[idx] && b.queue[idx].assistUser) return;
  return assistPreviousCancel.apply(this, arguments);
};

const assistPreviousSetup = buildSetup;
buildSetup = function () {
  assistPreviousSetup();
  const anchor = document.querySelector('#s-spectate');
  if (!anchor) return;
  const label = document.createElement('label'); label.className = 'check';
  label.innerHTML = `<input type="checkbox" id="s-assist" ${loadSetup().aiAssist ? 'checked' : ''}> AI Assist — share control of your realm`;
  label.title = 'The AI gathers, builds, trains and fights. Select your units and command them at any time. Your orders take priority. No account or internet needed.';
  anchor.closest('label').after(label);
  const box = label.querySelector('input');
  const sync = () => { box.disabled = anchor.checked; label.classList.toggle('dim', anchor.checked); };
  anchor.addEventListener('change', sync); sync();
};
const assistPreviousLaunch = launchFromSetup;
launchFromSetup = function (cfg) {
  const box = typeof document !== 'undefined' ? document.querySelector('#s-assist') : null;
  if (cfg && cfg.aiAssist === undefined && box && box.offsetParent !== null) cfg = { ...cfg, aiAssist: box.checked && !box.disabled };
  if (cfg && cfg.spectate) cfg = { ...cfg, aiAssist: false };
  if (cfg && box && box.offsetParent !== null) {
    try { const saved = JSON.parse(localStorage.getItem('aoe_setup') || '{}'); saved.aiAssist = !!cfg.aiAssist; localStorage.setItem('aoe_setup', JSON.stringify(saved)); } catch (e) { }
  }
  return assistPreviousLaunch(cfg);
};
GameHooks.on('topbar', () => {
  if (typeof document === 'undefined') return;
  const toolbar = document.querySelector('#topbar .tb-btns'); if (!toolbar) return;
  let button = document.querySelector('#b-assist');
  if (!button) {
    button = document.createElement('button'); button.id = 'b-assist'; button.className = 'btn small';
    button.onclick = () => { assistSetEnabled(!W.aiAssist); updateTopbar(); renderSelInfo(); };
    toolbar.prepend(button);
  }
  button.hidden = !!(W.spectate || W.tutorial || W.menu || W.editor || W.over);
  button.textContent = 'AI Assist: ' + (W.aiAssist ? 'On' : 'Off');
  button.setAttribute('aria-pressed', String(!!W.aiAssist));
  button.title = 'Toggle AI management of your economy and army. Your unit orders take priority; Stop and stances hold units until Return to AI.';
});
const assistPreviousSelInfo = renderSelInfo;
renderSelInfo = function () {
  assistPreviousSelInfo();
  const box = document.querySelector('#selinfo'); if (!box) return;
  const old = box.querySelector('#assist-control'); if (old) old.remove();
  if (!W.aiAssist || W.spectate) return;
  const units = UI.selection.filter(assistOwn); if (!units.length) return;
  const held = units.filter(assistReserved).length;
  const row = document.createElement('div'); row.id = 'assist-control'; row.className = 'small';
  const text = document.createElement('span');
  text.textContent = held ? `${held}/${units.length} under your control. ` : 'AI controls these units. Your commands take priority.';
  row.appendChild(text);
  if (held) {
    const button = document.createElement('button'); button.id = 'b-assist-return'; button.className = 'btn small'; button.textContent = 'Return to AI';
    button.onclick = () => { assistReturn(units); renderCommands(); renderSelInfo(); };
    row.appendChild(button);
  }
  (box.querySelector('.info') || box).appendChild(row);
};
