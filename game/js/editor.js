// ===== Map Editor =====
'use strict';
const ED_OBJECTS = [
  { k: 'tree', v: 0, label: 'Oak tree', icon: 'woodi' }, { k: 'tree', v: 1, label: 'Pine tree', icon: 'woodi' }, { k: 'tree', v: 2, label: 'Palm tree', icon: 'woodi' },
  { k: 'shrub', label: 'Shrub (decor)', icon: 'food' }, { k: 'berry', label: 'Berry bush', icon: 'food' }, { k: 'gold', label: 'Gold', icon: 'gold' }, { k: 'stone', label: 'Stone', icon: 'stone' },
  { k: 'coal', depth: 1, label: 'Buried coal seam', icon: 'coal' }, { k: 'gold', depth: 2, label: 'Underground gold', icon: 'gold' }, { k: 'stone', depth: 2, label: 'Underground stone', icon: 'stone' },
  { k: 'fish', v: 0, label: 'Shore fish', icon: 'fish' }, { k: 'fish', v: 1, label: 'Deep fish', icon: 'fish' }, { k: 'relic', label: 'Relic', icon: 'relicicon' },
  { k: 'unit', t: 'sheep', label: 'Sheep' }, { k: 'unit', t: 'deer', label: 'Deer' }, { k: 'unit', t: 'boar', label: 'Wild Boar' }, { k: 'unit', t: 'wolf', label: 'Wolf' },
];
const ED_UNITS = ['villager', 'sapper', 'scout', 'militia', 'spearman', 'halberdier', 'archer', 'skirmisher', 'knight', 'paladin', 'cavarcher', 'hcavarcher', 'monk', 'ram', 'cappedram', 'mangonel', 'onager', 'trebuchet', 'fishingship', 'transport', 'galley', 'fireship', 'demoship', 'tradecart'];
const Editor = {
  active: false, tool: 'terrain', terrain: T.GRASS, obj: null, owner: 1, brush: 2, undo: [], redo: [], players: [], name: 'My Map', sel: null, painting: false,
  base: null, undoLimit: 32 * 1024 * 1024,   // the change being made (see snapshot), and the memory (bytes) the undo and redo stacks may use
  // ---------- saved maps: IndexedDB store 'maps' (store.js), mirrored in memory so the setup screen can list and load them at once ----------
  // A stored map is { format: 'aor-map', version: 2, spec } with its layers packed like a save's (codec.js).
  maps: new Map(), ready: null,
  pack(spec) { const s = Object.assign({}, spec); for (const k of SPEC_LAYERS) if (spec[k]) s[k] = packArray(Uint8Array.from(spec[k])); return { format: 'aor-map', version: 2, spec: s }; },
  unpack(rec) {
    if (!rec || rec.format !== 'aor-map' || rec.version !== 2 || !rec.spec || !Number.isInteger(rec.spec.n)) return rec;   // anything else is a plain spec (older storage)
    const s = Object.assign({}, rec.spec), n = s.n;
    for (const k of SPEC_LAYERS) if (s[k]) s[k] = Array.from(unpackArray(s[k], n * n));
    return s;
  },
  // fills the mirror from storage; resolves with the number of maps (0 without storage)
  async loadAll() {
    const names = await Store.keys('maps'), maps = new Map();
    for (const name of names) { const rec = await Store.get('maps', name); if (rec) maps.set(name, rec); }
    this.maps = maps; return maps.size;
  },
  savedList() { return [...this.maps.keys()].sort(); },
  load(name) { try { if (!this.maps.has(name)) return null; const spec = this.unpack(this.maps.get(name)); if (validateMapSpec(spec).length) return null; return JSON.parse(JSON.stringify(spec)); } catch (e) { return null; } },
  // keeps the map in the mirror at once and resolves when storage has it; if storage fails, the mirror goes back
  async store(name, spec) {
    const errors = validateMapSpec(spec); if (errors.length) throw new Error(errors.join('\n'));
    const rec = this.pack(spec), had = this.maps.get(name);
    this.maps.set(name, rec);
    try { await Store.put('maps', name, rec); } catch (e) { if (had) this.maps.set(name, had); else this.maps.delete(name); throw e; }
  },
  async remove(name) { const had = this.maps.get(name); this.maps.delete(name); try { await Store.del('maps', name); } catch (e) { if (had) this.maps.set(name, had); throw e; } },
  // the side of a new custom map: the editor offers up to 480, as far as validateMapSpec allows (256 until phase 8)
  maxSize() { return (validateMapSpec({ n: 480 })[0] || '').startsWith('Map size') ? 256 : 480; },
  // min: the smallest side the caller can use (16 for a blank map; a generated one needs room for every map type's features)
  customSize(min = 16) { const v = Math.round(+$('#ed-gn').value), max = this.maxSize(); if (!(v >= min && v <= max)) throw new Error(min > 16 ? `A generated map needs a size from ${min} to ${max}; a blank map can be as small as 16.` : `Map size must be from 16 to ${max}.`); return v; },
  open(name) {
    UI.gameRunning = false; this.active = true;
    showScreen('editor'); resize();
    if (!this.ui) this.buildUI();
    let spec = name ? this.load(name) : null;
    // a map loaded here starts a new undo history: entries are diffs of the map that was open before
    if (spec) { this.name = name; this.loadSpec(spec); this.clearUndo(); }
    else if (!W || !this.players.length) this.newGenerated('coastal', 'small', (Math.random() * 1e6) | 0, 3);
    else { this.loadSpec(this.toSpec()); this.clearUndo(); }
    this.refreshUI();
  },
  close() { this.active = false; showScreen('menu'); },
  // size: a MAP_SIZES name, or a side in tiles (a custom size)
  newGenerated(type, size, seed, np) {
    const spec = generateMapSpec({ size, seed, mapType: type, numPlayers: np });
    const civKeys = Object.keys(CIVS);
    spec.players = spec.players.map((p, i) => ({ start: p.start, civ: civKeys[i % civKeys.length], color: i, team: 0 }));
    this.loadSpec(spec); this.clearUndo();
  },
  newBlank(size) {
    const n = Number.isInteger(size) ? size : MAP_SIZES[size] || 80; const spec = blankMapSpec(n);
    spec.players = [{ start: null, civ: 'franks', color: 0, team: 0 }, { start: null, civ: 'teutons', color: 1, team: 0 }];
    this.loadSpec(spec); this.clearUndo();
  },
  loadSpec(spec) {
    const errors = validateMapSpec(spec); if (errors.length) throw new Error(errors.join('\n'));
    const civKeys = Object.keys(CIVS);
    this.players = spec.players.map((p, i) => ({ start: p.start ? { x: p.start.x, y: p.start.y } : null, civ: p.civ || civKeys[i % civKeys.length], color: p.color !== undefined ? p.color : i, team: p.team || 0 }));
    const players = this.players.map((p, i) => ({ name: i === 0 ? 'You (human)' : 'Computer ' + i, civ: p.civ, color: PLAYER_COLORS[p.color % 8], human: i === 0, team: p.team }));
    // players array for createWorld must exist; strip starts so no TCs get auto-created
    const s2 = Object.assign({}, spec, { players: spec.players.map(() => ({ start: null })) });
    createWorld(s2, { players, seed: 1, fog: 'none', startRes: 'standard', startAge: 0, editor: true });
    W.editor = true;
    invalidateTerrain(); R.spriteCache.clear(); MM.baseVer = -1;
    centerCamOn(W.n / 2, W.n / 2); R.cam.zoom = 0.8;
    this.sel = null;
  },
  // the spec object of one entity (null for a carcass), as toSpec writes it
  objOf(e) {
    if (e.kind === 'res') return e.type === 'carcass' ? null : { k: e.type, x: e.x, y: e.y, v: e.v || 0, ...(e.depth ? { depth: e.depth } : {}) };
    if (e.kind === 'relic') return { k: 'relic', x: e.x, y: e.y };
    if (e.kind === 'unit') return { k: 'unit', t: e.type, x: Math.floor(e.x), y: Math.floor(e.y), o: e.owner };
    if (e.kind === 'bld') return { k: 'bld', t: e.type, x: e.x, y: e.y, o: e.owner };
    return null;
  },
  toSpec() {
    const objects = [];
    for (const e of W.list) { const o = this.objOf(e); if (o) objects.push(o); }
    return { version: 1, name: this.name, n: W.n, ...mapLayers(W.map), objects, players: this.players.map(p => ({ start: p.start, civ: p.civ, color: p.color, team: p.team })) };
  },
  // ---------- undo and redo: the tiles and objects a change touched, not whole maps ----------
  // snapshot() marks the start of a change (a stroke, a drag, a delete, a new player...): it keeps copies of the layers,
  // the entity list and the players, which cost no JSON. commit() (at the end of the stroke, or before the next change,
  // undo or redo) compares them with the map as it is now and pushes one entry:
  //   { layers: [{ k, idx, before, after, made, gone }], before: [objects], after: [objects], players: [before, after], bytes }
  // idx lists the tiles of layer k that changed; made / gone: the change created or deleted the layer. A change that
  // replaced the whole world (a new player or colour reloads it) pushes { full: packed spec of before, bytes } instead.
  // Undo and redo apply an entry to the current spec and load it, as the editor always has. The stacks keep at most 60
  // entries and undoLimit bytes; the oldest go first.
  snapshot() {
    this.commit();
    const map = W.map, layers = {};
    for (const k of SPEC_LAYERS) if (map[k]) layers[k] = map[k].slice();
    this.base = { world: W, list: W.list.slice(), nextId: W.nextId, layers, players: JSON.stringify(this.players), name: this.name, moved: new Map() };
    this.redo = [];
  },
  // a change that can fail (a generation): the undo history is touched only if it works
  fresh(make) { const redo = this.redo; this.snapshot(); try { make(); } catch (e) { this.base = null; this.redo = redo; throw e; } },
  clearUndo() { this.undo = []; this.redo = []; this.base = null; },
  stackBytes(stack) { let b = 0; for (const e of stack) b += e.bytes; return b; },
  push(stack, entry) {
    stack.push(entry);
    while (stack.length > 60 || (stack.length > 1 && this.stackBytes(this.undo) + this.stackBytes(this.redo) > this.undoLimit)) stack.shift();
  },
  // the spec of the change's starting point, from the copies snapshot() kept (only for a change that replaced the world)
  baseSpec(b) {
    const objects = [];
    for (const e of b.list) { const o = b.moved.get(e) || this.objOf(e); if (o) objects.push(o); }
    const layers = {}; for (const k of SPEC_LAYERS) if (b.layers[k]) layers[k] = Array.from(b.layers[k]);
    return { version: 1, name: b.name, n: b.world.n, ...layers, objects, players: JSON.parse(b.players) };
  },
  commit() {
    const b = this.base; this.base = null;
    if (!b || !W) return;
    if (W !== b.world) { const full = this.pack(this.baseSpec(b)); this.push(this.undo, { full, bytes: JSON.stringify(full).length * 2 }); return; }
    const map = W.map, layers = [];
    for (const k of SPEC_LAYERS) {
      const was = b.layers[k], now = map[k];
      if (!was && !now) continue;
      const n2 = map.n * map.n, idx = [], before = [], after = [];
      for (let i = 0; i < n2; i++) { const p = was ? was[i] : 0, q = now ? now[i] : 0; if (p !== q) { idx.push(i); before.push(p); after.push(q); } }
      if (idx.length || !was !== !now) layers.push({ k, idx: Int32Array.from(idx), before: Uint8Array.from(before), after: Uint8Array.from(after), made: !was, gone: !now });
    }
    const before = [], after = [];
    for (const e of b.list) {
      if (e.dead) { const o = b.moved.get(e) || this.objOf(e); if (o) before.push(o); }
      else if (b.moved.has(e)) { const o0 = b.moved.get(e), o1 = this.objOf(e); if (JSON.stringify(o0) !== JSON.stringify(o1)) { before.push(o0); after.push(o1); } }
    }
    for (const e of W.list) if (e.id >= b.nextId) { const o = this.objOf(e); if (o) after.push(o); }
    const p0 = b.players, p1 = JSON.stringify(this.players), players = p0 === p1 ? null : [p0, p1];
    if (!layers.length && !before.length && !after.length && !players && b.name === this.name) return;
    let bytes = JSON.stringify(before).length * 2 + JSON.stringify(after).length * 2 + (players ? (p0.length + p1.length) * 2 : 0);
    for (const l of layers) bytes += l.idx.byteLength + l.before.byteLength + l.after.byteLength;
    this.push(this.undo, { layers, before, after, players, names: [b.name, this.name], bytes });
  },
  // spec with entry e undone (dir 'undo') or redone ('redo')
  applyEntry(spec, e, dir) {
    const undo = dir === 'undo', out = Object.assign({}, spec), n2 = spec.n * spec.n;
    for (const l of e.layers) {
      if (undo ? l.made : l.gone) { delete out[l.k]; continue; }
      const a = out[l.k] ? out[l.k].slice() : new Array(n2).fill(0), vals = undo ? l.before : l.after;
      for (let i = 0; i < l.idx.length; i++) a[l.idx[i]] = vals[i];
      out[l.k] = a;
    }
    const drop = undo ? e.after : e.before, add = undo ? e.before : e.after, count = new Map();
    for (const o of drop) { const k = JSON.stringify(o); count.set(k, (count.get(k) || 0) + 1); }
    out.objects = spec.objects.filter(o => { const k = JSON.stringify(o), c = count.get(k); if (c) { count.set(k, c - 1); return false; } return true; }).concat(add.map(o => Object.assign({}, o)));
    if (e.players) out.players = JSON.parse(e.players[undo ? 0 : 1]);
    out.name = e.names[undo ? 0 : 1];
    return out;
  },
  // loads s keeping the camera; the players list comes from s, as loadSpec reads it
  reloadFrom(s) { const cam = Object.assign({}, R.cam); this.loadSpec(s); this.name = s.name || this.name; Object.assign(R.cam, cam); this.refreshUI(); },
  doUndo() {
    this.commit(); const e = this.undo[this.undo.length - 1]; if (!e) return;
    const cur = this.toSpec();
    if (e.full) { const now = this.pack(cur); this.reloadFrom(this.unpack(e.full)); this.undo.pop(); this.push(this.redo, { full: now, bytes: JSON.stringify(now).length * 2 }); return; }
    this.reloadFrom(this.applyEntry(cur, e, 'undo')); this.undo.pop(); this.push(this.redo, e);
  },
  doRedo() {
    this.commit(); const e = this.redo[this.redo.length - 1]; if (!e) return;
    const cur = this.toSpec();
    if (e.full) { const now = this.pack(cur); this.reloadFrom(this.unpack(e.full)); this.redo.pop(); this.push(this.undo, { full: now, bytes: JSON.stringify(now).length * 2 }); return; }
    this.reloadFrom(this.applyEntry(cur, e, 'redo')); this.redo.pop(); this.push(this.undo, e);
  },
  validate(spec) {
    const structural = validateMapSpec(spec); if (structural.length) return structural;
    const errs = [], n = spec.n;
    if (!spec.players || spec.players.length < 2) errs.push('At least 2 players are required (you + one computer).');
    const tcs = spec.objects.filter(o => o.k === 'bld' && o.t === 'tc');
    spec.players.forEach((p, i) => { if (!p.start && !tcs.some(t => t.o === i + 1)) errs.push(`Player ${i + 1} has no Town Center or starting location.`); });
    // overlapping
    const occ = new Map();
    for (const o of spec.objects) {
      if (o.k === 'unit' || o.k === 'shrub') continue;
      const s = o.k === 'bld' ? BUILDINGS[o.t].size : 1;
      for (let y = o.y; y < o.y + s; y++) for (let x = o.x; x < o.x + s; x++) {
        const k = y * n + x; if (occ.has(k)) { errs.push(`Overlapping placement at (${x},${y}): ${occ.get(k)} and ${o.t || o.k}.`); break; }
        occ.set(k, o.t || o.k);
        const water = isWaterT(spec.ter[k]);
        if (o.k === 'fish' && !water) errs.push(`Fish placed on land at (${x},${y}).`);
        if (o.k !== 'fish' && o.k !== 'bld' && water) errs.push(`${o.k} placed on water at (${x},${y}).`);
        if (o.k === 'bld' && (!!BUILDINGS[o.t].water) !== water) errs.push(`${BUILDINGS[o.t].name} at (${o.x},${o.y}) is on invalid terrain.`);
      }
    }
    for (const o of spec.objects) if (o.k === 'unit') { const idx = o.y * n + o.x, water = isWaterT(spec.ter[idx]), bridged = !!(spec.bridge && spec.bridge[idx]); if (UNITS[o.t].naval && !water) errs.push(`Ship (${UNITS[o.t].name}) placed on land at (${o.x},${o.y}).`); if (!UNITS[o.t].naval && water && !bridged) errs.push(`${UNITS[o.t].name} placed on water at (${o.x},${o.y}).`); if (o.o > spec.players.length) errs.push(`${UNITS[o.t].name} owned by missing player ${o.o}.`); }
    for (const o of spec.objects) if (o.k === 'bld' && o.o > spec.players.length) errs.push(`Building owned by missing player ${o.o}.`);
    return [...new Set(errs)].slice(0, 12);
  },
  buildUI() {
    const E = $('#editor');
    E.innerHTML = `<div id="ed-side" class="panel">
      <h2>Map Editor</h2>
      <div class="ed-sec"><b>File</b><div class="row">
        <select id="ed-gtype"><option value="land">Highlands</option><option value="alpine">Alpine Mountains</option><option value="rivers">Great Rivers</option><option value="coastal" selected>Coastal</option><option value="islands">Islands</option><option value="anatolia">Anatolia</option><option value="mediterranean">Mediterranean</option><option value="world">World</option></select>
        <select id="ed-gsize">${Object.keys(MAP_SIZES).map(k => `<option ${k === 'small' ? 'selected' : ''}>${k}</option>`).join('')}<option value="custom">custom</option></select>
        <input id="ed-gn" type="number" min="16" max="${this.maxSize()}" value="200" title="Custom size: the map side in tiles (16 to ${this.maxSize()})" style="width:4.5em"></div>
        <div class="row"><button class="btn small" id="ed-gen">New generated</button><button class="btn small" id="ed-blank">New blank</button></div>
        <div class="row"><input id="ed-name" value="My Map" maxlength="30"><button class="btn small" id="ed-save">Save</button></div>
        <div class="row"><select id="ed-list"></select><button class="btn small" id="ed-load">Load</button><button class="btn small" id="ed-del" title="Delete saved map">${typeof GLYPH === 'function' ? GLYPH('trash') : 'Delete'}</button></div>
        <div class="row"><button class="btn small" id="ed-export">Export file</button><label class="btn small">Import file<input type="file" id="ed-import" accept=".json,.gz,application/json,application/gzip" hidden></label></div>
        <div class="row"><button class="btn primary" id="ed-play">▶ Save & Play</button><button class="btn small" id="ed-validate">Validate</button><button class="btn small" id="ed-exit">Exit</button></div>
      </div>
      <div class="ed-sec"><b>Tools</b><div class="row tools">
        <button class="tool" data-tool="select" title="Select / move (drag) — Delete key removes">✥ Select</button>
        <button class="tool" data-tool="erase" title="Erase objects and engineering layers in brush">⌫ Erase</button>
        <button class="tool" data-tool="start" title="Set the owner's starting location">⚑ Start</button>
        <button class="tool" data-tool="raise" title="Raise elevation">${typeof GLYPH === 'function' ? GLYPH('mountain') : ''} Raise</button>
        <button class="tool" data-tool="lower" title="Lower elevation">↓ Lower</button>
        <button class="tool" data-tool="flatten" title="Flatten to level of first tile">▭ Flatten</button>
        <button class="tool" data-tool="bridge" title="Paint wooden bridge over water">${typeof GLYPH === 'function' ? GLYPH('bridge') : ''} Bridge</button>
        <button class="tool" data-tool="tunnel" title="Paint underground tunnel through land/cliffs">${typeof GLYPH === 'function' ? GLYPH('pick') : ''} Tunnel</button>
        <button class="tool" data-tool="trench" title="Paint defensive trench on land">${typeof GLYPH === 'function' ? GLYPH('trench') : ''} Trench</button>
      </div>
      <div class="row">Brush <input type="range" id="ed-brush" min="1" max="8" value="2"><span id="ed-bv">2</span>
      <button class="btn small" id="ed-undo" title="Ctrl+Z">↶ Undo</button><button class="btn small" id="ed-redo" title="Ctrl+Y">↷ Redo</button></div></div>
      <div class="ed-sec"><b>Terrain</b><div class="row pal" id="ed-ter"></div></div>
      <div class="ed-sec"><b>Objects & animals</b><div class="pal" id="ed-obj"></div></div>
      <div class="ed-sec"><b>Units</b> <span class="small">(owner below)</span><div class="pal" id="ed-units"></div></div>
      <div class="ed-sec"><b>Buildings</b><div class="pal" id="ed-blds"></div></div>
      <div class="ed-sec"><b>Players</b> <span class="small">P1 is you (human); others are computer players</span><div id="ed-players"></div><button class="btn small" id="ed-addp">+ Add computer player</button></div>
      <div id="ed-status" class="small"></div>
    </div>
    <div id="ed-current" class="panel"></div>`;
    this.ui = true;
    const ter = $('#ed-ter');
    [T.GRASS, T.DIRT, T.SAND, T.FOREST, T.ROCK, T.SHALLOW, T.WATER, T.DEEP].forEach(t => { const b = el('button', 'sw-btn', ''); b.style.background = TER_COL[t]; b.title = TER_NAMES[t]; b.dataset.ter = t; b.onclick = () => { this.tool = 'terrain'; this.terrain = t; this.refreshUI(); }; ter.appendChild(b); });
    const mk = (box, item, iconKey, label) => { const b = el('button', 'pal-btn'); b.style.backgroundImage = `url(${iconFor(iconKey)})`; b.title = label; b.onclick = () => { this.tool = 'object'; this.obj = item; this.refreshUI(); }; item.el = b; box.appendChild(b); };
    ED_OBJECTS.forEach(o => mk($('#ed-obj'), o, o.k === 'unit' ? 'unit:' + o.t : o.icon, o.label));
    for (const u of Object.values(CIVS).map(c => c.uu)) if (u && !ED_UNITS.includes(u)) ED_UNITS.push(u);
    ED_UNITS.filter(t => UNITS[t]).forEach(t => mk($('#ed-units'), { k: 'unit', t, label: UNITS[t].name }, 'unit:' + t, UNITS[t].name));
    Object.keys(BUILDINGS).forEach(t => mk($('#ed-blds'), { k: 'bld', t, label: BUILDINGS[t].name }, 'bld:' + t, BUILDINGS[t].name));
    for (const b of document.querySelectorAll('#ed-side .tool')) b.onclick = () => { this.tool = b.dataset.tool; this.refreshUI(); };
    $('#ed-brush').oninput = e => { this.brush = +e.target.value; $('#ed-bv').textContent = this.brush; };
    $('#ed-undo').onclick = () => this.doUndo(); $('#ed-redo').onclick = () => this.doRedo();
    const size = min => $('#ed-gsize').value === 'custom' ? this.customSize(min) : $('#ed-gsize').value;
    $('#ed-gen').onclick = () => { try { const s = size(64); this.fresh(() => this.newGenerated($('#ed-gtype').value, s, (Math.random() * 1e6) | 0, Math.max(2, this.players.length || 3))); this.refreshUI(); } catch (e) { this.status(e.message); } };
    $('#ed-blank').onclick = () => { try { const s = size(); this.fresh(() => this.newBlank(s)); this.refreshUI(); } catch (e) { this.status(e.message); } };
    $('#ed-save').onclick = async () => { const name = $('#ed-name').value.trim() || 'My Map'; try { await this.store(name, { ...this.toSpec(), name }); this.name = name; this.status(`Saved "${name}".`); this.refreshUI(); } catch (e) { this.status('Save failed: ' + e.message); } };
    $('#ed-load').onclick = () => { const n = $('#ed-list').value; if (!n) return; const s = this.load(n); if (!s) { this.status('Map could not be loaded: invalid data or storage is unavailable.'); return; } this.loadSpec(s); this.name = n; this.clearUndo(); this.refreshUI(); this.status(`Loaded "${n}".`); };
    $('#ed-del').onclick = async () => { const n = $('#ed-list').value; if (!n || !confirm(`Delete saved map "${n}"?`)) return; try { await this.remove(n); this.refreshUI(); } catch (e) { this.status('Delete failed: ' + e.message); } };
    $('#ed-export').onclick = () => { const s = this.toSpec(); const blob = new Blob([JSON.stringify(s)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (this.name || 'map').replace(/[^\w-]+/g, '_') + '.aoemap.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); this.status('Exported ' + a.download); };
    $('#ed-import').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const s = await this.readMapFile(f); this.snapshot(); this.loadSpec(s); this.name = s.name || f.name.slice(0, 120); this.redo = []; this.refreshUI(); this.status('Imported ' + f.name); } catch (err) { this.status('Import failed: ' + err.message); } };
    $('#ed-validate').onclick = () => { const errs = this.validate(this.toSpec()); this.status(errs.length ? errs.join('\n') : '✔ Map is valid and playable.'); };
    $('#ed-play').onclick = () => this.play();
    $('#ed-exit').onclick = () => this.close();
    $('#ed-addp').onclick = () => { if (this.players.length >= 8) return; this.snapshot(); const used = new Set(this.players.map(p => p.color)); let c = 0; while (used.has(c)) c++; const civKeys = Object.keys(CIVS); this.players.push({ start: null, civ: civKeys[this.players.length % civKeys.length], color: c, team: 0 }); this.reloadKeep(); };
    const cv = $('#game');
    cv.addEventListener('mousedown', e => this.mouseDown(e));
    cv.addEventListener('mousemove', e => this.mouseMove(e));
    window.addEventListener('mouseup', e => this.mouseUp(e));
    cv.addEventListener('wheel', e => { if (!this.active) return; e.preventDefault(); R.cam.zoom = Math.max(0.4, Math.min(1.8, R.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!this.active || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.doRedo() : this.doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.doRedo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (this.sel && !this.sel.dead) { this.snapshot(); removeEnt(this.sel); this.sel = null; } }
      else if (e.key.startsWith('Arrow')) { UI.keys.add(e.key); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => UI.keys.delete(e.key));
  },
  reloadKeep() { const cam = Object.assign({}, R.cam); this.loadSpec(this.toSpec()); Object.assign(R.cam, cam); this.refreshUI(); },
  // an imported map file (plain or gzip JSON, up to the sanity cap CODEC.cap), checked like any map
  async readMapFile(file) { const s = JSON.parse(await readTextFile(file)); const errors = validateMapSpec(s); if (errors.length) throw new Error(errors.join('\n')); return s; },
  status(h) { $('#ed-status').textContent = h; },
  // the saved-map list alone: boot refreshes it when the mirror has loaded, without touching what the player typed
  refreshList() { $('#ed-list').replaceChildren(...this.savedList().map(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; o.selected = n === this.name; return o; })); },
  refreshUI() {
    $('#ed-name').value = this.name;
    this.refreshList();
    for (const b of document.querySelectorAll('#ed-side .tool')) b.classList.toggle('on', b.dataset.tool === this.tool);
    for (const b of document.querySelectorAll('#ed-ter .sw-btn')) b.classList.toggle('on', this.tool === 'terrain' && +b.dataset.ter === this.terrain);
    for (const b of document.querySelectorAll('.pal-btn')) b.classList.remove('on');
    if (this.tool === 'object' && this.obj && this.obj.el) this.obj.el.classList.add('on');
    // players
    const pl = $('#ed-players');
    pl.innerHTML = this.players.map((p, i) => `<div class="ed-pl ${this.owner === i + 1 ? 'on' : ''}" data-i="${i}">
      <span class="sw" style="background:${PLAYER_COLORS[p.color % 8].c}"></span><b>P${i + 1}</b> ${i === 0 ? '(You)' : '(AI)'}
      <select data-civ="${i}">${Object.keys(CIVS).map(k => `<option value="${k}" ${p.civ === k ? 'selected' : ''}>${CIVS[k].name}</option>`).join('')}</select>
      <select data-col="${i}">${PLAYER_COLORS.map((c, ci) => `<option value="${ci}" ${p.color === ci ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      Team <select data-team="${i}">${[0, 1, 2, 3, 4].map(t => `<option value="${t}" ${p.team === t ? 'selected' : ''}>${t || '-'}</option>`).join('')}</select>
      ${p.start ? '⚑' : ''} ${i >= 2 ? `<button class="btn small" data-rm="${i}">✕</button>` : ''}</div>`).join('') + `<div class="ed-pl ${this.owner === 0 ? 'on' : ''}" data-i="-1"><span class="sw" style="background:#ddd6c0"></span><b>Gaia</b> (nature/neutral)</div>`;
    pl.querySelectorAll('.ed-pl').forEach(d => d.onclick = e => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return; this.owner = +d.dataset.i + 1; this.refreshUI(); });
    pl.querySelectorAll('[data-civ]').forEach(s => s.onchange = () => { this.snapshot(); this.players[+s.dataset.civ].civ = s.value; this.reloadKeep(); });
    pl.querySelectorAll('[data-col]').forEach(s => s.onchange = () => { this.snapshot(); this.players[+s.dataset.col].color = +s.value; this.reloadKeep(); });
    pl.querySelectorAll('[data-team]').forEach(s => s.onchange = () => { this.snapshot(); this.players[+s.dataset.team].team = +s.value; });
    pl.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { this.snapshot(); const i = +b.dataset.rm; const spec = this.toSpec(); spec.objects = spec.objects.filter(o => !((o.k === 'unit' || o.k === 'bld') && o.o === i + 1)).map(o => (o.o > i + 1 ? Object.assign(o, { o: o.o - 1 }) : o)); spec.players.splice(i, 1); const cam = Object.assign({}, R.cam); this.loadSpec(spec); Object.assign(R.cam, cam); if (this.owner > this.players.length) this.owner = 1; this.refreshUI(); });
    // current palette item
    let cur = '';
    if (this.tool === 'terrain') cur = `<span class="sw big" style="background:${TER_COL[this.terrain]}"></span> Painting: <b>${TER_NAMES[this.terrain]}</b>`;
    else if (this.tool === 'object' && this.obj) cur = `<span class="pal-btn cur" style="background-image:url(${iconFor(this.obj.k === 'unit' ? 'unit:' + this.obj.t : this.obj.k === 'bld' ? 'bld:' + this.obj.t : ED_OBJECTS.find(o => o === this.obj) ? this.obj.icon : 'woodi')})"></span> Placing: <b>${this.obj.label}</b>${this.obj.k === 'unit' || this.obj.k === 'bld' ? ` for <b style="color:${this.owner ? PLAYER_COLORS[this.players[this.owner - 1].color % 8].c : '#ddd'}">${this.owner ? 'P' + this.owner : 'Gaia'}</b>` : ''}`;
    else cur = `Tool: <b>${this.tool}</b>${this.tool === 'start' ? ` for P${this.owner || 1}` : ''}`;
    $('#ed-current').innerHTML = cur + `<span class="small dim"> · Left-click/drag to apply · Right-drag or arrows to pan · wheel to zoom · Ctrl+Z / Ctrl+Y</span>`;
  },
  tilesInBrush(t) { const out = [], r = this.brush - 1; const cx = Math.floor(t.x), cy = Math.floor(t.y); for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (W.map.inb(x, y) && Math.hypot(x - cx, y - cy) <= r + 0.5) out.push({ x, y }); return out; },
  mouseDown(e) {
    if (!this.active) return;
    const t = screenToTile(e.offsetX, e.offsetY);
    if (e.button === 2) { this.pan = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y }; return; }
    if (e.button !== 0) return;
    if (this.tool === 'select') {
      const h = hitTest(e.offsetX, e.offsetY, { editor: true });
      this.sel = h; if (h) { this.snapshot(); this.moving = { ent: h }; }
      return;
    }
    this.snapshot(); this.painting = true; this.flatLevel = W.map.elevAt(t.x, t.y); this.lastApplied = null;
    this.apply(t);
  },
  mouseMove(e) {
    if (!this.active) return;
    UI.mouse.x = e.offsetX; UI.mouse.y = e.offsetY; UI.mouse.inCanvas = true;
    if (this.pan) { R.cam.x = this.pan.cx - (e.clientX - this.pan.x) / R.cam.zoom; R.cam.y = this.pan.cy - (e.clientY - this.pan.y) / R.cam.zoom; return; }
    const t = screenToTile(e.offsetX, e.offsetY);
    if (this.moving) { this.moveEnt(this.moving.ent, t); return; }
    if (this.painting && (this.tool === 'terrain' || this.tool === 'erase' || this.tool === 'flatten' || this.tool === 'bridge' || this.tool === 'tunnel' || this.tool === 'trench' || (this.tool === 'object' && this.obj && this.obj.k !== 'bld' && this.obj.k !== 'unit'))) this.apply(t);
  },
  mouseUp(e) { if (!this.active) return; if (this.painting || this.moving) this.commit(); this.painting = false; this.pan = null; this.moving = null; },
  moveEnt(e, t) {
    const x = Math.floor(t.x), y = Math.floor(t.y), b = this.base;
    if (b && b.world === W && e.id < b.nextId && !b.moved.has(e)) b.moved.set(e, this.objOf(e));   // where it was when the change began (undo)
    if (e.kind === 'unit') { const naval = !!UNITS[e.type].naval; if (W.map.isWater(x, y) === naval && !W.map.blk[W.map.idx(x, y)]) { e.x = x + 0.5; e.y = y + 0.5; idxMoved(e); } return; }
    if (e.kind === 'bld') {
      const s = bsize(e); const nx = x - Math.floor(s / 2), ny = y - Math.floor(s / 2);
      if (nx === e.x && ny === e.y) return;
      // temporarily unblock
      for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) if (W.map.blk[W.map.idx(xx, yy)] === e.id) W.map.blk[W.map.idx(xx, yy)] = 0;
      hpaDirty(e.x, e.y, e.x + s - 1, e.y + s - 1);
      const ok = !canPlace(null, e.type, nx, ny, true);
      if (ok) { e.x = nx; e.y = ny; idxMoved(e); }
      if (!BUILDINGS[e.type].farm) for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) W.map.blk[W.map.idx(xx, yy)] = e.id;
      hpaDirty(e.x, e.y, e.x + s - 1, e.y + s - 1);
      return;
    }
    if (e.kind === 'res' || e.kind === 'relic') {
      const water = W.map.isWater(x, y);
      if (W.map.blk[W.map.idx(x, y)] || (e.type === 'fish') !== water) return;
      if (e.kind === 'res' && e.type !== 'shrub') { W.map.blk[W.map.idx(e.x, e.y)] = 0; W.map.blk[W.map.idx(x, y)] = e.id; hpaDirty(e.x, e.y, e.x, e.y); hpaDirty(x, y, x, y); }
      e.x = x; e.y = y; idxMoved(e);
    }
  },
  apply(t) {
    const map = W.map;
    const key = Math.floor(t.x) + ',' + Math.floor(t.y);
    if (this.lastApplied === key && this.tool !== 'raise' && this.tool !== 'lower') return;
    this.lastApplied = key;
    const tiles = this.tilesInBrush(t);
    if (this.tool === 'terrain' || this.tool === 'raise' || this.tool === 'lower' || this.tool === 'flatten') {
      for (const { x, y } of tiles) {
        const i = map.idx(x, y);
        if (this.tool === 'terrain') {
          const was = isWaterT(map.ter[i]), now = isWaterT(this.terrain);
          map.ter[i] = this.terrain;
          if (now) { map.elev[i] = 0; if (map.tun) map.tun[i] = 0; if (map.trench) map.trench[i] = 0; }
          else if (map.bridge) map.bridge[i] = 0;
          if (was !== now) this.clearIncompatible(x, y, now);
        } else if (this.tool === 'raise') { if (!isWaterT(map.ter[i])) map.elev[i] = Math.min(4, map.elev[i] + 1); }
        else if (this.tool === 'lower') map.elev[i] = Math.max(0, map.elev[i] - 1);
        else if (!isWaterT(map.ter[i])) map.elev[i] = this.flatLevel;
      }
      map.computeRegions();
      this.terrainChanged(tiles);
      return;
    }
    if (this.tool === 'bridge' || this.tool === 'tunnel' || this.tool === 'trench') {
      const prop = this.tool === 'tunnel' ? 'tun' : this.tool, needWater = this.tool === 'bridge';
      if (!map[prop]) map[prop] = new Uint8Array(map.n * map.n);
      let changed = false;
      for (const { x, y } of tiles) {
        const i = map.idx(x, y);
        if (isWaterT(map.ter[i]) !== needWater || map.blk[i]) continue;
        map[prop][i] = 1; changed = true;
      }
      if (changed) { map.computeRegions(); this.terrainChanged(tiles); }
      return;
    }
    if (this.tool === 'erase') {
      for (const e of W.list.slice()) { const c = center(e); if (tiles.some(q => Math.floor(c.x) === q.x && Math.floor(c.y) === q.y) || (e.kind === 'bld' && tiles.some(q => q.x >= e.x && q.x < e.x + bsize(e) && q.y >= e.y && q.y < e.y + bsize(e)))) removeEnt(e); }
      let layerChanged = false;
      for (const { x, y } of tiles) {
        const i = map.idx(x, y);
        for (const k of ['bridge', 'tun', 'trench', 'excavated']) if (map[k] && map[k][i]) { map[k][i] = 0; layerChanged = true; }
      }
      if (layerChanged) { map.computeRegions(); this.terrainChanged(tiles); }
      return;
    }
    if (this.tool === 'start') {
      const pi = Math.max(1, this.owner) - 1; this.players[pi].start = { x: Math.floor(t.x), y: Math.floor(t.y) }; this.refreshUI(); return;
    }
    if (this.tool === 'object' && this.obj) {
      const o = this.obj;
      if (o.k === 'bld') {
        const s = BUILDINGS[o.t].size; const x = Math.floor(t.x - s / 2 + 0.5), y = Math.floor(t.y - s / 2 + 0.5);
        if (!this.owner) { this.status('Choose a player (not Gaia) as the owner for buildings.'); return; }
        const err = canPlace(null, o.t, x, y, true); if (err) { this.status('' + err + ''); return; }
        spawnBuilding(o.t, this.owner, x, y, true); this.status(`Placed ${BUILDINGS[o.t].name} for P${this.owner}.`);
        return;
      }
      const list = o.k === 'unit' ? [{ x: Math.floor(t.x), y: Math.floor(t.y) }] : tiles.filter(() => this.brush === 1 || Math.random() < 0.55);
      for (const { x, y } of list) {
        const i = map.idx(x, y); const water = isWaterT(map.ter[i]), bridged = !!(map.bridge && map.bridge[i]);
        if (o.k === 'unit') {
          const d = UNITS[o.t];
          if (d.naval ? !water : (water && !bridged)) { this.status(`${d.name} cannot be placed on ${water ? 'water' : 'land'}.`); continue; }
          if (map.blk[i]) { this.status('Tile is occupied.'); continue; }
          const owner = d.animal ? 0 : this.owner;
          if (!d.animal && !owner) { this.status('Choose a player owner for units.'); continue; }
          spawnUnit(o.t, owner, x + 0.5, y + 0.5);
          continue;
        }
        if (map.blk[i] || W.list.some(e => e.kind === 'res' && e.x === x && e.y === y)) continue;
        if (o.k === 'fish' ? !water : water) { if (list.length === 1) this.status(`${o.label} must be placed on ${o.k === 'fish' ? 'water' : 'land'}.`); continue; }
        if (W.list.some(e => (e.kind === 'relic' || (e.kind === 'res' && e.type === 'shrub')) && e.x === x && e.y === y)) continue;
        if (o.k !== 'shrub' && W.list.some(e => e.kind === 'unit' && Math.floor(e.x) === x && Math.floor(e.y) === y)) continue;
        spawnRes(o.k, x, y, o.v || 0, o.depth || 0);
        if (o.k === 'tree' && map.ter[i] === T.GRASS) { map.ter[i] = T.FOREST; }
      }
      if (o.k === 'tree') this.terrainChanged(list);
    }
  },
  clearIncompatible(x, y, water) {
    for (const e of W.list.slice()) {
      const c = center(e);
      if (e.kind === 'bld') { const s = bsize(e); if (x >= e.x && x < e.x + s && y >= e.y && y < e.y + s && !!BUILDINGS[e.type].water !== water) removeEnt(e); continue; }
      if (Math.floor(c.x) !== x || Math.floor(c.y) !== y) continue;
      if (e.kind === 'unit' && !!UNITS[e.type].naval !== water) removeEnt(e);
      else if ((e.kind === 'res' || e.kind === 'relic') && (e.type === 'fish') !== water) removeEnt(e);
    }
  },
  terrainChanged(tiles) {
    const map = W.map; map.computeVH(); R.mapVersion = map.version;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const q of tiles) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    invalidateTiles(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    hpaDirty(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  },
  async play() {
    this.name = $('#ed-name').value.trim() || this.name || 'My Map';
    const spec = this.toSpec();
    const errs = this.validate(spec);
    if (errs.length) { this.status('Cannot launch:\n' + errs.join('\n')); Sound.play('error'); return; }
    try { await this.store(this.name, spec); } catch (e) { this.status('Save failed: ' + e.message); return; }
    UI.fromEditorName = this.name;
    this.active = false;
    const cfg = Object.assign(loadSetup(), { mapType: 'custom', customMap: this.name, civ: this.players[0].civ, color: this.players[0].color % 8, opponents: this.players.length - 1, teams: 'ffa' });
    if (!cfg.seed) cfg.seed = 1;
    launchFromSetup(cfg);
  },
  frame(dt) {
    const ctx = R.ctx;
    R.time += dt;
    scrollCamera(dt);
    renderWorld(ctx, { editor: true, selection: new Set(this.sel ? [this.sel] : []) });
    camTransform(ctx);
    // starts
    this.players.forEach((p, i) => {
      if (!p.start) return; const g = iso(p.start.x + 0.5, p.start.y + 0.5, W.map.h(p.start.x + 0.5, p.start.y + 0.5));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y - 36); ctx.stroke();
      ctx.fillStyle = PLAYER_COLORS[p.color % 8].c; ctx.beginPath(); ctx.moveTo(g.x, g.y - 36); ctx.lineTo(g.x + 20, g.y - 30); ctx.lineTo(g.x, g.y - 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('P' + (i + 1) + ' start', g.x + 4, g.y + 14);
    });
    // brush preview
    if (UI.mouse.inCanvas && this.tool !== 'select') {
      const t = screenToTile(UI.mouse.x, UI.mouse.y);
      if (this.tool === 'object' && this.obj && this.obj.k === 'bld') {
        const s = BUILDINGS[this.obj.t].size; const x = Math.floor(t.x - s / 2 + 0.5), y = Math.floor(t.y - s / 2 + 0.5);
        const err = canPlace(null, this.obj.t, x, y, true);
        const gp = iso(x + s / 2, y + s / 2, W.map.h(x + s / 2, y + s / 2));
        ctx.save(); ctx.translate(gp.x, gp.y); poly(ctx, [P(-s / 2, -s / 2, 0), P(s / 2, -s / 2, 0), P(s / 2, s / 2, 0), P(-s / 2, s / 2, 0)], err ? 'rgba(255,40,40,0.35)' : 'rgba(60,255,60,0.3)', err ? '#f44' : '#4f4', 1.5); ctx.restore();
      } else {
        for (const q of (this.tool === 'object' && this.obj && this.obj.k === 'unit') || this.tool === 'start' ? [{ x: Math.floor(t.x), y: Math.floor(t.y) }] : this.tilesInBrush(t)) {
          const a = iso(q.x, q.y, W.map.h(q.x, q.y)), b = iso(q.x + 1, q.y, W.map.h(q.x + 1, q.y)), c = iso(q.x + 1, q.y + 1, W.map.h(q.x + 1, q.y + 1)), d = iso(q.x, q.y + 1, W.map.h(q.x, q.y + 1));
          poly(ctx, [[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]], 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.6)', 0.8);
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
};
