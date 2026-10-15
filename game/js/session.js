// Versioned match persistence. References preserve shared jobs, entity links and AI/player cycles.
'use strict';
const MatchSave = {
  version: 1, key: 'aor_match_v1', autoKey: 'aor_autosave_v1', interval: 60,
  encode(value) {
    const nodes = [], seen = new Map();
    const visit = v => {
      if (v === undefined) return { undef: true };
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('Cannot save non-finite state.'); return v; }
      if (typeof v !== 'object') throw new Error('Cannot save a pending function.');
      if (seen.has(v)) return { ref: seen.get(v) };
      const id = nodes.length; seen.set(v, id); nodes.push(null);
      let type = 'Object', data;
      if (ArrayBuffer.isView(v)) { type = v.constructor.name; data = Array.from(v); }
      else if (v instanceof Map) { type = 'Map'; data = Array.from(v, ([k, x]) => [visit(k), visit(x)]); }
      else if (v instanceof Set) { type = 'Set'; data = Array.from(v, visit); }
      else if (Array.isArray(v)) { type = 'Array'; data = Array.from(v, visit); }
      else {
        if (v instanceof GameMap) type = 'GameMap';
        else if (v instanceof Player) type = 'Player';
        else if (typeof AIPlayer !== 'undefined' && v instanceof AIPlayer) type = 'AIPlayer';
        data = Object.entries(v).filter(([k]) => type !== 'GameMap' || !['vh', 'landReg', 'waterReg', '_wb'].includes(k)).map(([k, x]) => [k, visit(x)]);
      }
      nodes[id] = { type, data }; return { ref: id };
    };
    const root = visit(value); return { root, nodes };
  },
  decode(graph) {
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > 200000) throw new Error('Invalid save graph.');
    const types = { Uint8Array, Int16Array, Int32Array, Uint32Array, Float32Array };
    const prototypes = { Object: Object.prototype, GameMap: GameMap.prototype, Player: Player.prototype, AIPlayer: AIPlayer.prototype };
    const objects = graph.nodes.map(n => {
      if (!n || !Array.isArray(n.data) || n.data.length > 1000000) throw new Error('Invalid save node.');
      if (Object.prototype.hasOwnProperty.call(types, n.type)) {
        if (n.data.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new Error('Invalid numeric layer.');
        return new types[n.type](n.data);
      }
      if (n.type === 'Map') return new Map(); if (n.type === 'Set') return new Set(); if (n.type === 'Array') return [];
      if (!Object.prototype.hasOwnProperty.call(prototypes, n.type)) throw new Error('Unknown save type.');
      return Object.create(prototypes[n.type]);
    });
    const read = v => {
      if (!v || typeof v !== 'object') return v;
      if (v.undef === true) return undefined;
      if (!Number.isInteger(v.ref) || v.ref < 0 || v.ref >= objects.length) throw new Error('Invalid save reference.');
      return objects[v.ref];
    };
    graph.nodes.forEach((node, i) => {
      const o = objects[i]; if (Object.prototype.hasOwnProperty.call(types, node.type)) return;
      if (node.type === 'Array') { for (const v of node.data) o.push(read(v)); }
      else if (node.type === 'Set') { for (const v of node.data) o.add(read(v)); }
      else {
        for (const pair of node.data) {
          if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Invalid save entry.');
          if (node.type === 'Map') o.set(read(pair[0]), read(pair[1]));
          else {
            const [k, v] = pair;
            if (typeof k !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(k) || typeof prototypes[node.type][k] === 'function') throw new Error('Invalid save property.');
            Object.defineProperty(o, k, { value: read(v), enumerable: true, writable: true, configurable: true });
          }
        }
      }
    });
    return read(graph.root);
  },
  snapshot() {
    if (!W || W.menu || W.editor || W.over) throw new Error('Start an active match before saving.');
    if (typeof terraFlush === 'function') terraFlush();
    const omit = new Set(['rng', 'instantFor', 'grid', 'ents', 'fx', 'decals', 'missFx', 'msgs']);
    const world = Object.fromEntries(Object.entries(W).filter(([k]) => !omit.has(k)));
    const view = typeof R !== 'undefined' ? { ...R.cam } : null;
    const ui = typeof UI !== 'undefined' ? { groups: Object.fromEntries(Object.entries(UI.groups || {}).map(([k, es]) => [k, es.map(e => e.id)])), selection: (UI.selection || []).map(e => e.id), fromEditor: !!UI.fromEditor, fromEditorName: UI.fromEditorName } : {};
    const p = W.players[W.humanId];
    const meta = {
      civ: p && typeof CIVS === 'object' && CIVS[p.civ] ? CIVS[p.civ].name : (p ? p.civ : ''),
      age: p && typeof AGES !== 'undefined' ? AGES[p.age] : '',
      mapLabel: (W.spec && W.spec.name) || (W.settings && W.settings.mapType) || 'Map',
      time: W.t | 0,
      players: W.players.length - 1,
    };
    return { format: 'age-of-realms-match', version: this.version, savedAt: new Date().toISOString(), meta, graph: this.encode({ world, rngState: W.rng.state(), rules: currentRules(), view, ui }) };
  },
  serialize() { return JSON.stringify(this.snapshot()); },
  parse(text) {
    if (typeof text !== 'string' || text.length > 16e6) throw new Error('Save file is too large.');
    const file = JSON.parse(text);
    if (file.format !== 'age-of-realms-match' || file.version !== this.version) throw new Error('Unsupported match save.');
    const data = this.decode(file.graph), w = data && data.world;
    if (!w || !(w.map instanceof GameMap) || !Array.isArray(w.players) || w.players.length < 3 || w.players.length > 9 || !Array.isArray(w.list) || w.list.length > 100000 || !Number.isFinite(w.t) || w.t < 0 || !Number.isInteger(w.tick) || w.tick < 0 || !Number.isInteger(data.rngState) || w.menu || w.editor || w.over) throw new Error('Invalid match state.');
    const spec = { n: w.n, ...mapLayers(w.map), players: w.players.slice(1).map(p => ({ civ: p.civ })), objects: [] };
    const errors = validateMapSpec(spec); if (errors.length || w.map.n !== w.n || !w.settings || !Number.isInteger(w.humanId) || !w.players[w.humanId]) throw new Error('Invalid match map or settings.');
    if (!w.settings.players || w.settings.players.length !== w.players.length - 1 || !w.map.blk || w.map.blk.length !== w.n * w.n) throw new Error('Invalid match players or occupancy.');
    if (!(w.map.ter instanceof Uint8Array) || !(w.map.elev instanceof Uint8Array) || !(w.map.blk instanceof Int32Array) || !(w.map.deco instanceof Uint8Array) || w.map.deco.length !== w.n * w.n) throw new Error('Invalid saved map layers.');
    if (!data.ui || !Array.isArray(data.ui.selection) || !data.ui.groups || Object.values(data.ui.groups).some(ids => !Array.isArray(ids) || ids.some(id => !Number.isInteger(id)))) throw new Error('Invalid saved selection or groups.');
    for (const [i, p] of w.players.slice(1).entries()) {
      if (p.id !== i + 1 || typeof p.name !== 'string' || p.name.length > 120 || !p.color || ['c', 'd', 'l'].some(k => !/^#[\da-f]{3,8}$/i.test(p.color[k]))) throw new Error('Invalid saved player identity.');
      if (!(p instanceof Player) || !(p.techs instanceof Set) || !(p.researching instanceof Set) || !p.explored || p.explored.length !== w.n * w.n || !p.visible || p.visible.length !== w.n * w.n || !p.res || RES.some(k => !Number.isFinite(p.res[k]) || p.res[k] < 0) || !p.color || !/^#[\da-f]{3,8}$/i.test(p.color.c)) throw new Error('Invalid player state.');
      if (p.ai && (!(p.ai instanceof AIPlayer) || p.ai.p !== p)) throw new Error('Invalid AI state.');
    }
    const ids = new Set();
    for (const e of w.list) {
      if (!e || !Number.isInteger(e.id) || e.id < 1 || ids.has(e.id) || !Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isInteger(e.owner) || e.owner < 0 || e.owner >= w.players.length) throw new Error('Invalid entity state.');
      ids.add(e.id);
      const defs = e.kind === 'unit' ? UNITS : e.kind === 'bld' ? BUILDINGS : null;
      if (defs ? !Object.prototype.hasOwnProperty.call(defs, e.type) : !['res', 'relic'].includes(e.kind)) throw new Error('Unknown saved entity.');
      if (defs && (!Number.isFinite(e.hp) || !Number.isFinite(e.maxhp))) throw new Error('Invalid entity health.');
      if (e.kind === 'unit' && (!Array.isArray(e.cargo) || (e.queue !== undefined && !Array.isArray(e.queue)) || (e.order && !['move', 'attack', 'attackmove', 'gather', 'farm', 'hunt', 'build', 'repair', 'garrison', 'board', 'heal', 'convert', 'relic', 'deposit', 'trade', 'unload', 'moveto', 'follow', 'dropoff', 'guard', 'terra'].includes(e.order.t)))) throw new Error('Invalid unit orders.');
      if (e.kind === 'bld' && (!Array.isArray(e.queue) || !Array.isArray(e.garrison) || !Array.isArray(e.relics))) throw new Error('Invalid building state.');
      if (e.kind === 'bld' && e.queue.some(q => !q || !['unit', 'tech'].includes(q.kind) || !Object.prototype.hasOwnProperty.call(q.kind === 'unit' ? UNITS : TECHS, q.id) || !Number.isFinite(q.t) || q.t < 0)) throw new Error('Invalid production queue.');
    }
    let maxId = 0; for (const id of ids) maxId = Math.max(maxId, id);
    if (!Number.isInteger(w.nextId) || w.nextId <= maxId) throw new Error('Invalid next entity ID.');
    if (w.timers && (!Array.isArray(w.timers) || w.timers.some(t => !Number.isFinite(t.at) || !t.action || t.action.type !== 'buildingArrow'))) throw new Error('Invalid pending action.');
    if (!Array.isArray(w.projs) || w.projs.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid projectiles.');
    if (!data.rules || ['aging', 'veterans', 'thirst', 'terra', 'rivers', 'fishregen'].some(k => typeof data.rules[k] !== 'boolean') || !Number.isFinite(data.rules.lifeScale) || data.rules.lifeScale <= 0 || data.rules.lifeScale > 100) throw new Error('Invalid saved rules.');
    if (typeof data.rules.movement !== 'boolean' || !data.rules.commands || !data.rules.victory || COMMAND_RULE_KEYS.some(k => typeof data.rules.commands[k] !== 'boolean') || VICTORY_RULE_KEYS.some(k => typeof data.rules.victory[k] !== 'boolean') || ['wonderTime', 'relicTime'].some(k => !Number.isFinite(data.rules.victory[k]) || data.rules.victory[k] <= 0)) throw new Error('Invalid saved combat or victory rules.');
    w.rng = mulberry32(1); w.rng.restore(data.rngState);
    w.instantFor = p => !!(w.instant && p && p.id === w.humanId);
    w.ents = new Map(w.list.map(e => [e.id, e])); w.grid = new Map(); w.fx = []; w.decals = []; w.missFx = []; w.msgs = [];
    w.map.vh = new Float32Array((w.n + 1) ** 2); w.map.landReg = new Int32Array(w.n ** 2); w.map.waterReg = new Int32Array(w.n ** 2);
    delete w.map._wb;
    w.map.computeVH(); w.map.computeRegions();
    return data;
  },
  restore(text) {
    const data = this.parse(text); // Fully construct and validate before replacing the active match.
    applyRules(data.rules); W = data.world;
    rebuildGrid(); GameHooks.emit('worldRestored', W);
    return data;
  },
  save(auto = false) { localStorage.setItem(auto ? this.autoKey : this.key, this.serialize()); },
  resume(text) {
    const data = this.restore(text);
    Editor.active = false; UI.gameRunning = true; UI.paused = false; UI.focusPaused = false;
    UI.keys.clear(); UI.drag = UI.place = UI.mode = null; UI.mmDrag = UI.chatOpen = false; UI.page = 'main'; UI.panelKey = '';
    UI.selection = (data.ui.selection || []).map(id => ent(id)).filter(Boolean);
    UI.groups = Object.fromEntries(Object.entries(data.ui.groups || {}).map(([k, ids]) => [k, ids.map(id => ent(id)).filter(Boolean)]));
    UI.fromEditor = data.ui.fromEditor; UI.fromEditorName = data.ui.fromEditorName;
    UI.lastSpec = W.spec; UI.lastSettings = W.settings;
    closeModal(); showScreen('hud'); resize();
    $('#chatbox').classList.add('hidden');
    invalidateTerrain(); R.spriteCache.clear(); ICONS.clear(); MM.baseVer = -1;
    if (data.view && ['x', 'y', 'zoom'].every(k => Number.isFinite(data.view[k]))) { Object.assign(R.cam, data.view); R.cam.zoom = Math.max(0.55, Math.min(1.8, R.cam.zoom)); clampCam(); }
    else centerCamOn(W.players[W.humanId].startX, W.players[W.humanId].startY);
    R.time = W.t; resetGameClock();
    if (typeof CMD !== 'undefined' && typeof EXTRAS !== 'undefined') CMD.speeds = W.spectate ? EXTRAS.spectateSpeeds : (EXTRAS.savedSpeeds || [0.5, 1, 1.5, 2, 3]);
    updateTopbar(); renderCommands(); renderSelInfo(); renderMinimap($('#minimap'));
    if (typeof tutorialPanel === 'function') tutorialPanel();
    Sound.init(); Sound.startMusic(); msg('Saved match resumed.', '#9fd');
  },
  openLoad() {
    const backToGame = UI.gameRunning && UI.paused;
    const m = openModal('Load Match', '<p>Resume a local save or choose an exported match file.</p><div id="match-slots"></div><label>Import match <input type="file" id="match-file" accept=".json"></label><p id="match-error" role="status"></p>', [[backToGame ? 'Back to Game Menu' : 'Close', backToGame ? () => { openGameMenu(); return false; } : null]]);
    const fail = e => { m.querySelector('#match-error').textContent = e.message; };
    for (const [key, label] of [[this.key, 'Manual save'], [this.autoKey, 'Autosave']]) {
      let text; try { text = localStorage.getItem(key); } catch (e) { fail(e); continue; }
      if (!text) continue;
      const b = document.createElement('button'); b.className = 'btn';
      let info = '';
      try {
        const parsed = JSON.parse(text), date = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : '', mt = parsed.meta;
        const summary = mt ? [mt.civ, mt.age, mt.mapLabel, typeof fmtTime === 'function' && Number.isFinite(mt.time) ? fmtTime(mt.time) : '', mt.players ? mt.players + 'P' : ''].filter(Boolean).join(' · ') : '';
        info = [summary, date].filter(Boolean).join(' — ');
      } catch (e) { }
      b.textContent = label + (info ? ' · ' + info : ''); b.onclick = () => { try { this.resume(text); } catch (e) { fail(e); } }; m.querySelector('#match-slots').appendChild(b);
    }
    m.querySelector('#match-file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { if (f.size > 16e6) throw new Error('Save file is too large.'); this.resume(await f.text()); } catch (e) { fail(e); } };
  },
  export() {
    const blob = new Blob([this.serialize()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'age-of-realms-match.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

const COMMAND_RULE_KEYS = ['queue', 'formation', 'accuracy', 'rescue', 'breach', 'stances', 'autoresign', 'flee', 'hotkeys'];
const VICTORY_RULE_KEYS = ['wonder', 'relic', 'imperial', 'fogmem', 'score', 'aiWonder'];
function currentRules() { return { aging: MOD.aging, veterans: MOD.veterans, thirst: WELLM.enabled, terra: TERRA.enabled, rivers: WMOD.rivers, fishregen: WMOD.fishRegen, lifeScale: MOD.lifeScale, movement: MOVE.enabled, commands: Object.fromEntries(COMMAND_RULE_KEYS.map(k => [k, CMD[k]])), victory: Object.fromEntries([...VICTORY_RULE_KEYS, 'wonderTime', 'relicTime'].map(k => [k, VIC[k]])) }; }
const RULE_DEFAULTS = currentRules();
function applyRules(rules = RULE_DEFAULTS) {
  MOD.aging = !!rules.aging; MOD.veterans = !!rules.veterans; MOD.lifeScale = rules.lifeScale || 1;
  WELLM.enabled = !!rules.thirst; TERRA.enabled = !!rules.terra; WMOD.rivers = !!rules.rivers; WMOD.fishRegen = !!rules.fishregen;
  MOVE.enabled = rules.movement === undefined ? RULE_DEFAULTS.movement : rules.movement;
  for (const k of COMMAND_RULE_KEYS) CMD[k] = (rules.commands || RULE_DEFAULTS.commands)[k];
  for (const k of [...VICTORY_RULE_KEYS, 'wonderTime', 'relicTime']) VIC[k] = (rules.victory || RULE_DEFAULTS.victory)[k];
}
GameHooks.on('afterTick', () => {
  if (!W || W.menu || W.editor || W.over || typeof localStorage === 'undefined') return;
  if (W.t < (W.nextAutosave ?? MatchSave.interval)) return;
  W.nextAutosave = W.t + MatchSave.interval;
  try { MatchSave.save(true); W.autosaveError = false; }
  catch (e) { if (!W.autosaveError) msg('Autosave failed. Use Export Match from the game menu to keep a copy.', '#fc8'); W.autosaveError = true; }
});

if (typeof initMenus === 'function') {
  const previous = initMenus;
  initMenus = function () { previous(); $('#btn-load').onclick = () => MatchSave.openLoad(); $('#btn-tutorial').onclick = startTutorial; $('#btn-controls').onclick = openControls; };
}
if (typeof openGameMenu === 'function') {
  const previous = openGameMenu;
  openGameMenu = function () {
    previous(); const buttons = $('#modal .modal-btns');
    for (const [label, action] of [['Save Match', () => { MatchSave.save(); msg('Match saved.', '#9fd'); }], ['Export Match', () => MatchSave.export()], ['Load Match', () => MatchSave.openLoad()], ['Controls', () => openControls()]]) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
      if (W.over && ['Save Match', 'Export Match'].includes(label)) b.disabled = true;
      b.onclick = () => { try { action(); } catch (e) { const p = document.createElement('p'); p.textContent = 'Save failed: ' + e.message; $('#modal .modal-body').appendChild(p); } }; buttons.appendChild(b);
    }
  };
}
