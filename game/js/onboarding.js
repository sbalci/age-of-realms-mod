'use strict';
const RULE_LABELS = { aging: 'People age and retire', veterans: 'Veteran promotions', thirst: 'Clean water and wells', terra: 'Terraforming and engineering', rivers: 'Generate rivers', fishregen: 'Fish stocks recover' };
const RULE_PRESETS = {
  realms: { ...RULE_DEFAULTS },
  beginner: { aging: false, veterans: true, thirst: false, terra: true, rivers: true, fishregen: true, lifeScale: 1 },
  classic: { aging: false, veterans: false, thirst: false, terra: false, rivers: false, fishregen: false, lifeScale: 1 },
};
function readSetupRules() { return Object.fromEntries([...Object.keys(RULE_LABELS).map(k => [k, $('#rule-' + k).checked]), ['lifeScale', +$('#rule-life').value]]); }
const previousBuildSetup = buildSetup;
buildSetup = function () {
  previousBuildSetup();
  const rules = { ...RULE_DEFAULTS, ...(loadSetup().rules || {}) };
  const box = document.createElement('fieldset'); box.className = 'rules-panel';
  box.innerHTML = `<legend>Game rules</legend><label>Preset <select id="rule-preset"><option value="custom">Custom</option><option value="realms">Age of Realms</option><option value="beginner">Beginner</option><option value="classic">Classic economy</option></select></label>${Object.entries(RULE_LABELS).map(([k, text]) => `<label class="check"><input type="checkbox" id="rule-${k}" ${rules[k] ? 'checked' : ''}> ${text}</label>`).join('')}<label>Lifespans <select id="rule-life">${[0.5, 1, 2].map(v => `<option value="${v}" ${v === rules.lifeScale ? 'selected' : ''}>${v}×</option>`).join('')}</select></label><p class="small">Beginner removes aging and water pressure. Rules apply to every player.</p>`;
  $('#setup .setup-btns').before(box);
  const syncPreview = () => {
    if (typeof WMOD === 'object' && $('#rule-rivers')) WMOD.rivers = $('#rule-rivers').checked;
    if ($('#s-seed') && $('#s-seed').onchange) $('#s-seed').onchange();
  };
  syncPreview();
  $('#rule-preset').onchange = e => {
    const r = RULE_PRESETS[e.target.value]; if (!r) return;
    for (const k of Object.keys(RULE_LABELS)) $('#rule-' + k).checked = r[k];
    $('#rule-life').value = String(r.lifeScale);
    syncPreview();
  };
  for (const el of box.querySelectorAll('input, #rule-life')) el.onchange = () => { $('#rule-preset').value = 'custom'; syncPreview(); };
};

const CONTROL_DEFAULTS = { pause: 'F3', menu: 'F10', help: 'F1', idleVillager: '.', idleSoldier: ',', lastAttack: 'Home', music: 'm' };
let CONTROL_KEYS = { ...CONTROL_DEFAULTS };
try { const saved = JSON.parse(localStorage.getItem('aor_controls') || '{}'); if (saved && typeof saved === 'object') for (const k of Object.keys(CONTROL_DEFAULTS)) if (typeof saved[k] === 'string' && saved[k].length <= 20) CONTROL_KEYS[k] = saved[k]; } catch (e) { }
function controlKey(key) {
  if (UI.gameRunning && UI.cmds && UI.cmds.some(c => c.key === key.toUpperCase())) return key;
  for (const action of Object.keys(CONTROL_DEFAULTS)) if (CONTROL_KEYS[action].toLowerCase() === key.toLowerCase()) return CONTROL_DEFAULTS[action];
  if (Object.values(CONTROL_DEFAULTS).some(v => v.toLowerCase() === key.toLowerCase())) return '';
  return key;
}
function openControls() {
  const backToGame = UI.gameRunning && UI.paused;
  const labels = { pause: 'Pause', menu: 'Game menu', help: 'Help', idleVillager: 'Idle villager', idleSoldier: 'Idle soldier', lastAttack: 'Last attack', music: 'Music' };
  const m = openModal('Controls', `<p>Click a shortcut, then press a key. Number keys and arrows remain reserved for groups and camera movement. Games pause while this window is open.</p>${Object.entries(labels).map(([k, label]) => `<label class="row">${label}<button class="btn" data-key="${k}">${escapeHtml(CONTROL_KEYS[k])}</button></label>`).join('')}<p id="control-status" role="status"></p>`, [['Reset defaults', null], [backToGame ? 'Back to Game Menu' : 'Close', backToGame ? () => { openGameMenu(); return false; } : null]]);
  const refresh = () => m.querySelectorAll('[data-key]').forEach(b => { b.textContent = CONTROL_KEYS[b.dataset.key]; });
  m.querySelector('.modal-btns button').onclick = () => { CONTROL_KEYS = { ...CONTROL_DEFAULTS }; try { localStorage.removeItem('aor_controls'); } catch (e) { m.querySelector('#control-status').textContent = e.message; } refresh(); };
  for (const b of m.querySelectorAll('[data-key]')) b.onclick = () => {
    b.textContent = 'Press a key…'; b.focus();
    b.onkeydown = e => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { b.onkeydown = null; refresh(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || /^(Arrow|[0-9]$|Shift$|Control$|Alt$|Meta$|Enter$|Tab$|F4$| $|[+=_\-]$)/.test(e.key)) { m.querySelector('#control-status').textContent = 'Choose an unmodified key. Arrows, numbers, chat, F4 and speed keys are reserved.'; return; }
      if (Object.entries(CONTROL_KEYS).some(([k, v]) => k !== b.dataset.key && v.toLowerCase() === e.key.toLowerCase())) { m.querySelector('#control-status').textContent = 'That shortcut is already assigned.'; return; }
      CONTROL_KEYS[b.dataset.key] = e.key; b.onkeydown = null; refresh();
      try { localStorage.setItem('aor_controls', JSON.stringify(CONTROL_KEYS)); m.querySelector('#control-status').textContent = 'Shortcut saved. Visible unit commands take precedence over matching shortcuts.'; } catch (e) { m.querySelector('#control-status').textContent = 'Shortcut changed for this session; storage is unavailable.'; }
    };
  };
}

const TUTORIAL_STEPS = [
  { text: 'Select a villager by clicking one near your Town Center.', done: () => UI.selection.some(e => e.type === 'villager' && e.owner === W.humanId) },
  { text: 'With a villager selected, right-click a tree or berry bush to gather resources.', done: () => W.players[W.humanId].stats.gathered >= 10 },
  { text: 'Build a House: select a villager, open Build (B), choose House, then click clear ground. Houses increase your population limit.', done: () => builtCount(W.players[W.humanId], 'house') > W.tutorial.houses },
  { text: 'Select the Town Center and train a Villager using its command button.', done: () => W.list.filter(e => e.owner === W.humanId && e.type === 'villager').length > W.tutorial.villagers },
  { text: 'Gather 500 food, select the Town Center and advance to the Feudal Age.', done: () => W.players[W.humanId].age >= 1 },
];
function startTutorial() {
  const rules = { ...RULE_PRESETS.beginner }, cfg = { ...SETUP_DEFAULT, name: 'Learner', mapType: 'land', size: 'tiny', opponents: 1, difficulty: 'easy', teams: 'ffa', startRes: 'medium', seed: 2026, fog: 'explored', cheats: false, tips: false, rules };
  launchFromSetup(cfg);
  W.players[2].ai.paused = true; W.players[1].stance[2] = W.players[2].stance[1] = 'neutral';
  W.tutorial = { step: 0, houses: builtCount(W.players[1], 'house'), villagers: W.list.filter(e => e.owner === 1 && e.type === 'villager').length };
  tutorialPanel();
}
function tutorialPanel() {
  let panel = $('#tutorial-panel');
  if (!W || !UI.gameRunning || !W.tutorial) { if (panel) panel.remove(); return; }
  if (!panel) { panel = document.createElement('aside'); panel.id = 'tutorial-panel'; panel.className = 'panel'; panel.setAttribute('aria-live', 'polite'); $('#hud').appendChild(panel); }
  const state = W.tutorial, step = TUTORIAL_STEPS[state.step];
  const text = step ? `Lesson ${state.step + 1}/${TUTORIAL_STEPS.length}: ${step.text}` : 'Lessons complete! Practice freely, or start a Beginner match from the main menu. Wells, veterans and engineering are described in Help.';
  if (panel.dataset.step === String(state.step)) return;
  panel.dataset.step = String(state.step); panel.replaceChildren();
  const p = document.createElement('p'); p.textContent = text; panel.appendChild(p);
  const button = document.createElement('button'); button.className = 'btn small'; button.textContent = 'End lesson'; button.onclick = () => { W.tutorial = null; panel.remove(); }; panel.appendChild(button);
}
GameHooks.on('afterTick', () => { if (!W.tutorial || typeof document === 'undefined' || W.tick % 5) return; const step = TUTORIAL_STEPS[W.tutorial.step]; if (step && step.done()) W.tutorial.step++; tutorialPanel(); });
GameHooks.on('worldCreated', () => { if (typeof document !== 'undefined') { const panel = $('#tutorial-panel'); if (panel) panel.remove(); } });
GameHooks.on('worldRestored', () => { if (typeof document !== 'undefined') { const panel = $('#tutorial-panel'); if (panel) panel.remove(); tutorialPanel(); } });
const previousKey = onKey;
onKey = function (event) {
  const key = controlKey(event.key);
  if (key === event.key || UI.chatOpen || (event.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))) return previousKey(event);
  const proxy = new Proxy(event, { get: (target, prop) => prop === 'key' ? key : typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop] });
  return previousKey(proxy);
};
