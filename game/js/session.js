// Versioned match persistence. References preserve shared jobs, entity links and AI/player cycles.
// Format 2 (phase 4) writes every object once as a compact node: typed arrays (map layers, fog, occupancy) as base64
// run-length bytes (codec.js), objects as a shape (their prototype and keys, listed once) plus their values, and the
// generated map's spec as the options that regenerate it. Format 1 saves and exports still load, and are staggered
// once on the way in (MatchSave.staggerAI).
// Never saved, by design: the pathfinding graph and the entity index (rebuilt on load), HPA.enabled (follows the URL),
// and group-order state (hpa.js HPA_GROUP: a member still waiting for its join when the match is saved routes on its own
// after loading, so a resumed match equals an uninterrupted one only from a moment when no member is waiting to join or
// still has its own deferred search due: hpaPending() is 0).
'use strict';
const MAP_DERIVED = ['vh', 'landReg', 'waterReg', '_wb'];   // GameMap fields rebuilt on load (computeVH, computeRegions)
const MatchSave = {
  version: 2, key: 'aor_match_v1', autoKey: 'aor_autosave_v1', interval: 60,
  // Limits for a save of a map of side n: graph nodes, values in one node, entities and typed-array length. They are
  // never below format 1's fixed limits (200,000 nodes, 1,000,000 values, 100,000 entities) and grow with the map. bytes is
  // the budget for all typed arrays decoded from one save: 64 n² for the map and 16 n² for each of up to 9 players (fog),
  // against about 30 n² a real 8-player match uses; run-length data expands about 65:1, so the file's size alone says little.
  caps(n) { const a = n * n; return { nodes: Math.max(200000, 8 * a), values: Math.max(1000000, 4 * a), entities: Math.max(100000, 4 * a), layer: Math.max(65536, a), bytes: 208 * a }; },
  // ---------- format 1 (read only) ----------
  decode(graph, caps = this.caps(256)) {
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > caps.nodes) throw new Error('Invalid save graph.');
    const types = { Uint8Array, Int16Array, Int32Array, Uint32Array, Float32Array };
    const prototypes = { Object: Object.prototype, GameMap: GameMap.prototype, Player: Player.prototype, AIPlayer: AIPlayer.prototype };
    const objects = graph.nodes.map(n => {
      if (!n || !Array.isArray(n.data) || n.data.length > caps.values) throw new Error('Invalid save node.');
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
  // the map side a format 1 graph holds (root -> world -> n), for its limits; 256 when it cannot be read
  v1Size(graph) {
    try { const root = graph.nodes[graph.root.ref], w = graph.nodes[root.data.find(p => p[0] === 'world')[1].ref]; return w.data.find(p => p[0] === 'n')[1]; } catch (e) { return 256; }
  },
  // ---------- format 2 ----------
  // The graph is { root, shapes, nodes }. Every object is a node, so shared objects and cycles survive:
  //   a typed array -> [type name, length, base64 run-length bytes]
  //   an Array -> ['A', v...], a Set -> ['S', v...], a Map -> ['M', key, value, key, value...]
  //   any other object -> [shape, v...], where shapes[shape] = [prototype name, key...] ('Object', 'GameMap', 'Player', 'AIPlayer')
  // and a value is a number, string, boolean or null as itself, [i] for node i, or [] for undefined.
  // walk(value, out, slice) visits the objects breadth first and fills out.root, out.shapes and out.nodes; a typed array's
  // node holds a copy of it, which pack() turns into text. Both are generators: given slice (ms) they yield when a slice
  // is used up (the sliced autosave); with slice 0 they run to the end in one go. Given snap (freeze()), value is the
  // snapshot's copy, whose typed arrays are copies already and whose flat records are read from the snapshot.
  *walk(value, out, slice = 0, snap = null) {
    const nodes = [], seen = new Map(), shapes = [], shapeOf = new Map(), queue = [], snapShape = [];
    const val = v => {
      if (v === undefined) return [];
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('Cannot save non-finite state.'); return v; }
      if (typeof v !== 'object') throw new Error('Cannot save a pending function.');
      let id = seen.get(v); if (id === undefined) { id = nodes.length; seen.set(v, id); nodes.push(null); queue.push(v); }
      return [id];
    };
    out.root = val(value);
    // tq: when the last stretch (128 nodes, or 4096 items of a list) began; a slice ends before a stretch as long as the
    // last one would take it past slice ms
    let t0 = performance.now(), tq = t0;
    const due = () => { const now = performance.now(), over = now - t0 + (now - tq) > slice; tq = now; return over; };
    for (let q = 0; q < queue.length; q++) {
      const v = queue[q], r = snap ? snap.at(v) : -1; let node;
      if (r >= 0) {   // a flat record of the snapshot: the node the entity had at the moment of the snapshot
        const k = snap.shape[r], keys = snap.shapes[k], o = snap.start[r];
        let s = snapShape[k];
        if (s === undefined) { const sk = 'Object\u0000' + keys.join('\u0000'); s = shapeOf.get(sk); if (s === undefined) { s = shapes.length; shapeOf.set(sk, s); shapes.push(['Object', ...keys]); } snapShape[k] = s; }
        node = [s]; for (let j = 0; j < keys.length; j++) node.push(val(snap.vals[o + j]));
      } else if (ArrayBuffer.isView(v)) {
        if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, v.constructor.name)) throw new Error('Cannot save a ' + v.constructor.name + '.');
        node = [v.constructor.name, v.length, snap ? v : v.slice()];
      } else if (v instanceof Map) { node = ['M']; for (const [k, x] of v) node.push(val(k), val(x)); }
      else if (v instanceof Set) { node = ['S']; for (const x of v) node.push(val(x)); }
      else if (Array.isArray(v)) {   // W.list holds every entity: a long array may span slices
        node = ['A'];
        for (let i = 0; i < v.length; i++) { node.push(val(v[i])); if (slice && (i & 4095) === 4095 && due()) { yield; t0 = tq = performance.now(); } }
      }
      else {
        const type = v instanceof GameMap ? 'GameMap' : v instanceof Player ? 'Player' : typeof AIPlayer !== 'undefined' && v instanceof AIPlayer ? 'AIPlayer' : 'Object';
        const keys = type === 'GameMap' ? Object.keys(v).filter(k => !MAP_DERIVED.includes(k)) : Object.keys(v), sk = type + '\u0000' + keys.join('\u0000');
        let s = shapeOf.get(sk); if (s === undefined) { s = shapes.length; shapeOf.set(sk, s); shapes.push([type, ...keys]); }
        node = [s]; for (const k of keys) node.push(val(v[k]));
      }
      nodes[q] = node;
      if (slice && (q & 127) === 127 && due()) { yield; t0 = tq = performance.now(); }
    }
    out.nodes = nodes; out.shapes = shapes;
  },
  // Typed-array copies -> base64 run-length text. A layer is run-length coded in chunks of 192 KB (runs split at a chunk
  // edge decode back to back, so this size is part of the format) and turned into base64 in pieces of 48 KB (a multiple
  // of 3 bytes: the pieces join into the base64 of the whole), so it may span slices; the one-shot save codes it the
  // same way.
  *pack(out, slice = 0) {
    const CH = 196608, B64 = 49152, P = this.pacer(slice);
    for (const node of out.nodes) {
      if (typeof node[0] !== 'string' || !ArrayBuffer.isView(node[2])) continue;
      const a = node[2], bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), runs = [];
      let len = 0;
      for (let i = 0; i < bytes.length || !runs.length; i += CH) {
        const part = bytes.subarray(i, i + CH);
        if (P.due('rle', part.length)) { yield; P.next(); }
        const r = P.time('rle', part.length, () => rleEncode(part)); runs.push(r); len += r.length;
      }
      const all = runs.length === 1 ? runs[0] : new Uint8Array(len), text = [];
      if (runs.length > 1) { let o = 0; for (const r of runs) { all.set(r, o); o += r.length; } }
      for (let i = 0; i < all.length || !text.length; i += B64) {
        const part = all.subarray(i, i + B64);
        if (P.due('b64', part.length)) { yield; P.next(); }
        text.push(P.time('b64', part.length, () => b64Encode(part)));
      }
      node[2] = text.join('');
    }
  },
  // The pace of the sliced steps that cost unlike amounts (pack's run-length and base64 chunks, the JSON's values and
  // long strings). P = pacer(slice): before a step of a kind and size (units: bytes, values or characters), P.due()
  // says whether it would take the slice past slice ms, predicted from the steps of the same kind so far (ms per unit, a
  // maximum that decays by a fifth a step, so one slow step is not held against the rest for long), or, for a kind not
  // seen yet, as long as the longest recent step of any kind (the same decaying maximum). A slice always runs at least
  // one step, so a step's own size is what bounds it: each kind of step is cut small enough. P.time() runs and times a
  // step, P.next() starts the next slice, P.ran counts the steps of this slice. With slice 0 nothing is ever due (the
  // one-shot save).
  pacer(slice) {
    const rate = Object.create(null);
    let t0 = performance.now(), ran = 0, big = 0;
    return {
      get ran() { return ran; },
      due(kind, units) { return !!slice && ran > 0 && performance.now() - t0 + (kind in rate ? rate[kind] * Math.max(1, units) : big) > slice; },
      next() { t0 = performance.now(); ran = 0; },
      time(kind, units, f) {
        const t = performance.now(), r = f(), ms = performance.now() - t, per = ms / Math.max(1, units);
        rate[kind] = kind in rate ? Math.max(per, rate[kind] * 0.8) : per; big = Math.max(ms, big * 0.8); ran++;
        return r;
      },
    };
  },
  // The JSON of out's graph, as the parts of serialize()'s text in order: the head and the graph up to its nodes, the
  // nodes, then the end, so the text is parts.join('') (one join: the text comes out flat, and IndexedDB copies it as it
  // is). In steps by cost: up to 256 small nodes or 4096 values a step; a longer node (W.list) in pieces of 4096 values,
  // cut between two values; a packed layer's text alone.
  *json(out, head, parts, slice = 0) {
    const STEP = 4096, nodes = out.nodes, P = this.pacer(slice), long = m => typeof m[2] === 'string' && m[2].length > STEP;
    parts.push(JSON.stringify({ ...head, graph: { root: out.root, shapes: out.shapes, nodes: [] } }).slice(0, -3));
    for (let i = 0; i < nodes.length;) {
      if (i) parts.push(',');
      const node = nodes[i];
      if (long(node)) {
        if (P.due('chars', node[2].length)) { yield; P.next(); }
        parts.push(P.time('chars', node[2].length, () => JSON.stringify(node))); i++;
      } else if (node.length > STEP) {
        parts.push('[');
        for (let a = 0; a < node.length; a += STEP) {
          const k = Math.min(STEP, node.length - a);
          if (P.due('values', k)) { yield; P.next(); }
          if (a) parts.push(',');
          parts.push(P.time('values', k, () => JSON.stringify(node.slice(a, a + k)).slice(1, -1)));
        }
        parts.push(']'); i++;
      } else {
        let j = i + 1, units = node.length;
        while (j < nodes.length && j - i < 256) { const m = nodes[j]; if (long(m) || units + m.length > STEP) break; units += m.length; j++; }
        if (P.due('values', units)) { yield; P.next(); }
        const a = i; parts.push(P.time('values', units, () => JSON.stringify(nodes.slice(a, j)).slice(1, -1)));
        i = j;
      }
    }
    parts.push(']}}');
  },
  decode2(graph, caps) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.shapes) || graph.nodes.length > caps.nodes || graph.shapes.length > caps.nodes) throw new Error('Invalid save graph.');
    const prototypes = { Object: Object.prototype, GameMap: GameMap.prototype, Player: Player.prototype, AIPlayer: AIPlayer.prototype };
    for (const s of graph.shapes) {
      if (!Array.isArray(s) || s.length > caps.values || !Object.prototype.hasOwnProperty.call(prototypes, s[0])) throw new Error('Unknown save type.');
      for (let i = 1; i < s.length; i++) { const k = s[i]; if (typeof k !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(k) || typeof prototypes[s[0]][k] === 'function') throw new Error('Invalid save property.'); }
    }
    let bytes = 0;   // decoded typed-array bytes so far, checked before each allocation
    const objects = graph.nodes.map(n => {
      if (!Array.isArray(n) || !n.length || n.length > caps.values + 1) throw new Error('Invalid save node.');
      const h = n[0];
      if (typeof h === 'number') { const s = graph.shapes[h]; if (!s || n.length !== s.length) throw new Error('Invalid save node.'); return Object.create(prototypes[s[0]]); }
      if (h === 'A') return []; if (h === 'S') return new Set(); if (h === 'M') { if (n.length % 2 !== 1) throw new Error('Invalid save node.'); return new Map(); }
      if (Object.prototype.hasOwnProperty.call(CODEC_TYPES, h)) {
        if (n.length !== 3 || !Number.isInteger(n[1]) || n[1] < 0) throw new Error('Invalid numeric layer.');
        if ((bytes += n[1] * CODEC_TYPES[h].BYTES_PER_ELEMENT) > caps.bytes) throw new Error('Save file expands past its size limit.');
        return unpackArray({ t: h, n: n[1], d: n[2] }, caps.layer); }
      throw new Error('Unknown save type.');
    });
    const read = v => {
      if (v === null || typeof v !== 'object') return v;
      if (!Array.isArray(v) || v.length > 1) throw new Error('Invalid save reference.');
      if (!v.length) return undefined;
      if (!Number.isInteger(v[0]) || v[0] < 0 || v[0] >= objects.length) throw new Error('Invalid save reference.');
      return objects[v[0]];
    };
    graph.nodes.forEach((n, i) => {
      const o = objects[i], h = n[0];
      if (typeof h === 'number') { const keys = graph.shapes[h]; for (let k = 1; k < n.length; k++) Object.defineProperty(o, keys[k], { value: read(n[k]), enumerable: true, writable: true, configurable: true }); }
      else if (h === 'A') { for (let k = 1; k < n.length; k++) o.push(read(n[k])); }
      else if (h === 'S') { for (let k = 1; k < n.length; k++) o.add(read(n[k])); }
      else if (h === 'M') { for (let k = 1; k < n.length; k += 2) o.set(read(n[k]), read(n[k + 1])); }
    });
    return read(graph.root);
  },
  // A generated map is saved as the options that regenerate its spec (only Restart reads it), with its name and player
  // starts; an editor map keeps its layers (as typed arrays, packed like the live ones) and objects.
  specStub(w) {
    const s = w.spec, st = w.settings || {};
    if (!s) return s;
    const generated = st.mapType !== 'custom' && (MAP_TYPE_NAMES[st.mapType] || (typeof REAL_MAPS !== 'undefined' && REAL_MAPS[st.mapType])) && Number.isFinite(st.seed) && st.rules;
    if (generated) return { regen: { gen: GEN_VERSION, size: w.n, seed: st.seed, mapType: st.mapType, numPlayers: w.players.length - 1, rivers: !!st.rules.rivers }, name: s.name, players: s.players };
    const out = Object.assign({}, s); for (const k of SPEC_LAYERS) if (Array.isArray(s[k])) out[k] = Uint8Array.from(s[k]);
    return out;
  },
  // the generator version a stub was made with (a missing one is 1)
  genOf(s) { return s && s.regen ? (s.regen.gen || 1) : null; },
  // the full spec of a stub (Restart): regenerated with the river rule it was made with, or the layers as plain arrays
  specOf(s) {
    if (!s) return s;
    if (s.regen) {
      const r = WMOD.rivers; WMOD.rivers = s.regen.rivers;
      try { return generateMapSpec({ size: s.regen.size, seed: s.regen.seed, mapType: s.regen.mapType, numPlayers: s.regen.numPlayers }); } finally { WMOD.rivers = r; }
    }
    const out = Object.assign({}, s); for (const k of SPEC_LAYERS) if (ArrayBuffer.isView(s[k])) out[k] = Array.from(s[k]);
    return out;
  },
  // Phase 2 starts each AI player's once-a-second update on its own tick. A format 1 save from before that has every
  // AI that still ticks on the same tick (one shared acc): stagger them once, on the way into format 2. Staggered saves
  // are left alone. Only AIs that tick count: a defeated or paused AI keeps its acc, so two of them may hold equal values
  // in a save that is already staggered.
  staggerAI(w) {
    const ais = w.players.slice(1).filter(p => p.ai && p.alive && !p.ai.paused).map(p => p.ai);
    if (ais.length < 2 || new Set(ais.map(a => a.acc)).size !== 1) return false;
    const slots = Math.max(1, w.players.length - 1);
    for (const a of ais) a.acc = ((a.p.id - 1) % slots) / slots;
    return true;
  },
  // The save's root value and its file head (walk and pack turn the value into the graph): of the running match, or,
  // given from (what parse() returned for an older save), of that save, without loading it.
  parts(w = W, from = null) {
    if (!from) {
      if (!W || W.menu || W.editor || W.over) throw new Error('Start an active match before saving.');
      if (typeof terraFlush === 'function') terraFlush();
    }
    const omit = new Set(['rng', 'instantFor', 'grid', 'ents', 'fx', 'decals', 'missFx', 'msgs']);
    const world = Object.fromEntries(Object.entries(w).filter(([k]) => !omit.has(k)));
    world.spec = this.specStub(w);
    const view = from ? from.view : typeof R !== 'undefined' ? { ...R.cam } : null;
    const ui = from ? from.ui : typeof UI !== 'undefined' ? { groups: Object.fromEntries(Object.entries(UI.groups || {}).map(([k, es]) => [k, es.map(e => e.id)])), selection: (UI.selection || []).map(e => e.id), fromEditor: !!UI.fromEditor, fromEditorName: UI.fromEditorName } : {};
    const p = w.players[w.humanId];
    const meta = {
      civ: p && typeof CIVS === 'object' && CIVS[p.civ] ? CIVS[p.civ].name : (p ? p.civ : ''),
      age: p && typeof AGES !== 'undefined' ? AGES[p.age] : '',
      mapLabel: (w.spec && w.spec.name) || (w.settings && w.settings.mapType) || 'Map',
      time: w.t | 0,
      players: w.players.length - 1,
    };
    return { head: { format: 'age-of-realms-match', version: this.version, savedAt: new Date().toISOString(), n: w.n, meta }, value: { world, rngState: from ? from.rngState : w.rng.state(), rules: from ? from.rules : currentRules(), view, ui } };
  },
  snapshot() {
    const { head, value } = this.parts(), out = {};
    for (const _ of this.walk(value, out)); for (const _ of this.pack(out));
    this.lastHead = head;
    return { ...head, graph: { root: out.root, shapes: out.shapes, nodes: out.nodes } };
  },
  serialize() { return JSON.stringify(this.snapshot()); },
  parse(text) {
    if (typeof text !== 'string' || text.length > CODEC.cap) throw new Error('Save file is too large.');
    let file; try { file = JSON.parse(text); } catch (e) { throw new Error('Save file is damaged or incomplete.'); }
    if (!file || file.format !== 'age-of-realms-match' || (file.version !== 1 && file.version !== 2)) throw new Error('Unsupported match save.');
    const n0 = file.version === 2 ? file.n : this.v1Size(file.graph);
    if (!Number.isInteger(n0) || n0 < 16 || n0 > 1024) throw new Error('Invalid match map or settings.');
    const caps = this.caps(n0);
    const data = file.version === 2 ? this.decode2(file.graph, caps) : this.decode(file.graph, caps), w = data && data.world;
    if (!w || !(w.map instanceof GameMap) || w.n !== n0 || !Array.isArray(w.players) || w.players.length < 3 || w.players.length > 9 || !Array.isArray(w.list) || w.list.length > caps.entities || !Number.isFinite(w.t) || w.t < 0 || !Number.isInteger(w.tick) || w.tick < 0 || !Number.isInteger(data.rngState) || w.menu || w.editor || w.over) throw new Error('Invalid match state.');
    const spec = { n: w.n, ...mapLayers(w.map), players: w.players.slice(1).map(p => ({ civ: p.civ })), objects: [] };
    const errors = validateMapSpec(spec); if (errors.length || w.map.n !== w.n || !w.settings || !Number.isInteger(w.humanId) || !w.players[w.humanId]) throw new Error('Invalid match map or settings.');
    if (!w.settings.players || w.settings.players.length !== w.players.length - 1 || !w.map.blk || w.map.blk.length !== w.n * w.n) throw new Error('Invalid match players or occupancy.');
    if (!(w.map.ter instanceof Uint8Array) || !(w.map.elev instanceof Uint8Array) || !(w.map.blk instanceof Int32Array) || !(w.map.deco instanceof Uint8Array) || w.map.deco.length !== w.n * w.n) throw new Error('Invalid saved map layers.');
    if (!data.ui || !Array.isArray(data.ui.selection) || !data.ui.groups || Object.values(data.ui.groups).some(ids => !Array.isArray(ids) || ids.some(id => !Number.isInteger(id)))) throw new Error('Invalid saved selection or groups.');
    for (const [i, p] of w.players.slice(1).entries()) {
      if (p.res && p.res.coal === undefined) p.res.coal = 0;
      if (p.gather && p.gather.coal === undefined) p.gather.coal = 1;
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
      if (e.depth !== undefined && (!Number.isInteger(e.depth) || e.depth < 0 || e.depth > 4 || (e.depth && !(e.kind === 'res' && ['coal', 'gold', 'stone'].includes(e.type))))) throw new Error('Invalid saved mine depth.');
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
    // An occupancy id whose entity is gone (older builds could leave one): clear it before anything reads the layer, so
    // code that reads blk directly (freeTileNear, terra.js) and the pathfinding graph built at load agree.
    const blk = w.map.blk; for (let i = 0; i < blk.length; i++) if (blk[i] && !ids.has(blk[i])) blk[i] = 0;
    if (file.version === 1) this.staggerAI(w);
    w.rng = mulberry32(1); w.rng.restore(data.rngState);
    w.instantFor = p => !!(w.instant && p && p.id === w.humanId);
    w.ents = new Map(w.list.map(e => [e.id, e])); w.grid = new Map(); w.fx = []; w.decals = []; w.missFx = []; w.msgs = [];
    w.map.vh = new Float32Array((w.n + 1) ** 2); w.map.landReg = new Int32Array(w.n ** 2); w.map.waterReg = new Int32Array(w.n ** 2);
    delete w.map._wb;
    const mapVersion=w.map.version;
    w.map.computeVH(); w.map.computeRegions();
    // Reconstructing derived height data is not a terrain edit; cached routes keep their revision.
    if(Number.isSafeInteger(mapVersion)&&mapVersion>=0)w.map.version=mapVersion;
    return data;
  },
  restore(text) {
    const data = this.parse(text); // Fully construct and validate before replacing the active match.
    applyRules(data.rules); W = data.world;
    rebuildGrid(); GameHooks.emit('worldRestored', W);
    return data;
  },
  // ---------- slots in IndexedDB (store.js): manual slots '1' to '5' and 'auto'; a summary of each in the meta store ----------
  slots: ['1', '2', '3', '4', '5'],
  async saveTo(slot, text, head = this.lastHead) {
    if (![...this.slots, 'auto'].includes(slot)) throw new Error('Unknown save slot.');
    await Store.put('saves', slot, text);
    await Store.put('meta', 'save:' + slot, { slot, savedAt: head.savedAt, meta: head.meta, n: head.n, version: head.version, chars: text.length });
  },
  async loadFrom(slot) { if (![...this.slots, 'auto'].includes(slot)) throw new Error('Unknown save slot.'); return Store.get('saves', slot); },
  // slot -> its summary, or null when it is empty
  async slotInfos() { const out = {}; for (const s of [...this.slots, 'auto']) out[s] = (await Store.get('meta', 'save:' + s)) || null; return out; },
  slotLabel(slot, info) {
    const name = slot === 'auto' ? 'Autosave' : 'Slot ' + slot;
    if (!info) return name + ' · empty';
    const mt = info.meta, date = info.savedAt ? new Date(info.savedAt).toLocaleString() : '';
    const summary = mt ? [mt.civ, mt.age, mt.mapLabel, typeof fmtTime === 'function' && Number.isFinite(mt.time) ? fmtTime(mt.time) : '', mt.players ? mt.players + 'P' : ''].filter(Boolean).join(' · ') : '';
    return name + ' · ' + [summary, date].filter(Boolean).join(' — ');
  },
  // ---------- the autosave: a snapshot of one moment, then the text in idle slices ----------
  // serializeSliced() copies what the save holds in one go (freeze), between two ticks, and then builds the text from
  // that copy in slices of at most sliceMs, one per idle period (requestIdleCallback, else a timeout), while the match
  // plays on: the walk, the packing of the layers and the JSON. Nothing holds the simulation, and the text is
  // serialize()'s at the moment of the snapshot, whatever the simulation and the player's input do meanwhile.
  // Slices aim at sliceMs: the walk (every 128 nodes, or 4096 items of a list) ends a slice before a stretch as long as
  // its last one would take it past sliceMs, and the packing and the JSON before a step that would (pacer()), so no
  // slice passes 8 ms. Everything else the autosave does runs in tasks of its own too: the rehearsal before the
  // snapshot (rehearse(), in timeouts), and the tail, in idle periods: the text's one join, then the write (whose
  // synchronous part is IndexedDB's copy of the text).
  // stats (the last autosave's): tick and snapMs (the snapshot's), flat and entities (W.list's flat records and length),
  // slices (the time of every other task it ran, in order: the rehearsal's, the walk's, pack's and the JSON's slices,
  // the join, the write), rehearsal (the rehearsal's tasks), rehearseMs, walkMs, packMs and jsonMs (the longest task of
  // each), joinMs, putMs (IndexedDB's put alone), tailMs (the longer of the join's and the write's tasks), hold (the
  // longest of slices), ms (the snapshot to the text) and chars.
  sliceMs: 6, busy: false, stats: null,
  later(fn, soon) { if (!soon && typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 100 }); else if (typeof setTimeout === 'function') setTimeout(fn, 0); else Promise.resolve().then(fn); },
  idle(soon) { return new Promise(r => this.later(r, soon)); },
  // the autosave stops, writing nothing and telling nothing, once the match it saves is no longer the one running
  aborted() { const e = new Error('The match was left during the autosave.'); e.aborted = true; return e; },
  // runs gen one step an idle period (soon: a timeout), each step's time into times; before each step, live() says the
  // match is still the one being saved (else it stops: gen.return() runs gen's finally blocks, and the promise rejects
  // with aborted())
  sliced(gen, times, live = () => true, soon = false) {
    return new Promise((resolve, reject) => {
      const step = () => {
        if (!live()) { try { gen.return(); } catch (e) { /* stopping anyway */ } reject(this.aborted()); return; }
        const t0 = performance.now();
        let r; try { r = gen.next(); } catch (e) { reject(e); return; }
        times.push(+(performance.now() - t0).toFixed(2));
        if (r.done) resolve(); else this.later(step, soon);
      };
      this.later(step, soon);
    });
  },
  // freeze(value) copies, at once, all that the save of value holds, so that walk(), pack() and the JSON can run later
  // and still write this moment. Typed arrays are copied, into the copies the previous snapshot made where it can
  // (GameMap's derived layers are not: walk() leaves them out). Every other object is copied with its prototype, its
  // keys in order and its shared references, so walking the copy gives the graph that walking the match gives now.
  // The exception is W.list's flat records, plain objects that hold only numbers, strings, booleans, null and
  // undefined: the trees, mines and other resources, nearly all of a big map's entities. Copied as objects they cost
  // 11 ms at 480 x 480 with 8 players (48,800 entities: the copies outlive the young generation). Instead their values
  // go into one array, their keys into one list per shape, and the snapshot keeps the entity itself only as the
  // identity that walk() numbers (at(): its index in items, or -1).
  // dry (the rehearsal's): typed arrays are not copied; the copy is the spare as it is (one is made where none fits).
  spares: new WeakMap(),   // a typed array of the match -> the copy the last snapshot made of it
  bufs: null,              // the last snapshot's arrays for its flat records, once its walk is done (release())
  // the copy of typed array v in spares, or a new one where none fits; fill: with v's values now
  spare(v, fill) {
    const c = this.spares.get(v);
    if (c && c.constructor === v.constructor && c.length === v.length) { if (fill) c.set(v); return c; }
    const d = v.slice(); this.spares.set(v, d); return d;
  },
  // b, or new arrays where b is too small for n entities and ids up to top
  bufsFor(b, n, top) {
    const grow = k => Math.ceil(k * 1.25) + 64;
    return b && b.slot.length > top && b.shape.length >= n && b.vals.length >= n * 13 ? b : { slot: new Int32Array(grow(top)), shape: new Int32Array(grow(n)), start: new Int32Array(grow(n)), vals: new Array(grow(n * 13)) };
  },
  freeze(value, list, nextId, dry = false) {   // list: W.list, nextId: W.nextId (or a sample of the list, rehearse())
    const n = list.length, top = Math.max(1, nextId | 0);
    const b = this.bufsFor(this.bufs, n, top); this.bufs = null;   // taken: a snapshot made before this one is released gets arrays of its own
    const items = list.slice(), slot = b.slot, shape = b.shape, start = b.start;
    slot.fill(0, 0, top + 1); shape.fill(-1, 0, n);
    const { shapes, flat } = this.flatPass(items, n, top, slot, shape, start, b.vals);
    let polluted = false; for (const k in Object.prototype) { polluted = true; break; }
    const at = v => { if (Object.getPrototypeOf(v) !== Object.prototype) return -1; const id = v.id; if (!(id >= 1 && id <= top)) return -1; const s = slot[id] - 1; return s >= 0 && items[s] === v ? s : -1; };
    const seen = new Map([[list, items]]), stack = [];
    const copy = v => {
      if (v === null || typeof v !== 'object') return v;
      let c = seen.get(v); if (c !== undefined) return c;
      if (at(v) >= 0) return v;
      if (ArrayBuffer.isView(v)) {
        c = typeof v.slice !== 'function' ? v : this.spare(v, !dry);
        seen.set(v, c); return c;
      }
      // plain objects and arrays are copied whole (spread, slice: one step, not one store per key), their object values below
      const proto = Object.getPrototypeOf(v);
      c = Array.isArray(v) ? v.slice() : v instanceof Map ? new Map() : v instanceof Set ? new Set() : proto === Object.prototype && !polluted ? { ...v } : Object.create(proto);
      seen.set(v, c); stack.push(v, c); return c;
    };
    const root = copy(value);
    for (let i = 0; i < n; i++) if (shape[i] < 0) items[i] = copy(items[i]);
    while (stack.length) {
      const c = stack.pop(), v = stack.pop();
      if (Array.isArray(v)) { for (let i = 0; i < c.length; i++) { const x = c[i]; if (x !== null && typeof x === 'object') c[i] = copy(x); } }
      else if (v instanceof Map) { for (const [k, x] of v) c.set(copy(k), copy(x)); }
      else if (v instanceof Set) { for (const x of v) c.add(copy(x)); }
      else if (Object.getPrototypeOf(c) === Object.prototype && !polluted) { for (const k in c) { const x = c[k]; if (x !== null && typeof x === 'object') c[k] = copy(x); } }
      else {
        // a class's object (GameMap, Player, AIPlayer) key by key; its prototype may have accessors (AIPlayer's id): define, do not assign
        const keys = v instanceof GameMap ? Object.keys(v).filter(k => !MAP_DERIVED.includes(k)) : Object.keys(v);
        for (const k of keys) Object.defineProperty(c, k, { value: copy(v[k]), enumerable: true, writable: true, configurable: true });
      }
    }
    return { root, items, shape, start, shapes, vals: b.vals, at, flat, release: () => { this.bufs = b; } };   // release(): after the walk, the next snapshot may reuse the arrays
  },
  // freeze()'s pass over W.list: the flat records' values into vals, their shapes and starts; slot[id] = index + 1
  flatPass(items, n, top, slot, shape, start, vals) {
    const shapes = [], readers = [], uses = [], same = (a, b) => { if (a.length !== b.length) return false; for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false; return true; };
    let o = 1, flat = 0;
    vals[0] = '';   // a string first, so the array holds values of every kind from the start
    let polluted = false; for (const k in Object.prototype) { polluted = true; break; }   // for-in below lists own keys only while Object.prototype has none
    let s1 = -1, s2 = -1;   // the last two shapes seen: most records have one of them (trees, and trees by water), checked key by key
    for (let i = 0; i < n; i++) {
      const e = items[i];
      if (e === null || typeof e !== 'object' || Object.getPrototypeOf(e) !== Object.prototype) continue;
      const id = e.id; if (!Number.isInteger(id) || id < 1 || id > top || slot[id]) continue;
      let s = -1;
      if (!polluted) for (let c = 0; c < 2 && s < 0; c++) {
        const t = c ? s2 : s1; if (t < 0) continue;
        const ks = shapes[t]; let j = 0; for (const k in e) { if (k !== ks[j]) { j = -1; break; } j++; } if (j === ks.length) s = t;
      }
      if (s < 0) { const ks = Object.keys(e); s = shapes.findIndex(x => same(ks, x)); if (s < 0) { s = shapes.length; shapes.push(ks); readers.push(this.slowReader(ks)); uses.push(0); } }
      if (s !== s1) { s2 = s1; s1 = s; }
      const m = shapes[s].length; if (o + m > vals.length) vals.length = 2 * vals.length;
      if (!readers[s](e, vals, o)) continue;   // it holds an object: it is copied below
      if (++uses[s] === 32) readers[s] = this.reader(shapes[s]);   // a shape with many flat records gets the compiled reader
      slot[id] = i + 1; shape[i] = s; start[i] = o; o += m; flat++;
    }
    return { shapes, flat };
  },
  // reader(keys)(e, v, o) writes the values of e, an object of those keys, to v from index o on, or returns false at the
  // first value that is an object. The compiled reader reads each key by name, and is kept from one snapshot to the
  // next: freeze() at 480 x 480 took 27 ms reading its 580,000 values through computed names (slowReader), 9 ms by
  // name. Only a shape with 32 flat records in a snapshot is compiled; the others (units, buildings, rare resources)
  // read through computed names.
  readers: new Map(),
  reader(keys) {
    const sig = keys.join('\u0000'), had = this.readers.get(sig); if (had) return had;
    if (this.readers.size > 4096) this.readers.clear();
    let r;
    try { r = new Function('e', 'v', 'o', 'let x; ' + keys.map((k, j) => `x = e[${JSON.stringify(k)}]; if (x !== null && typeof x === 'object') return false; v[o + ${j}] = x;`).join(' ') + ' return true;'); }
    catch (err) { r = this.slowReader(keys); }   // where a content security policy forbids compiling
    this.readers.set(sig, r); return r;
  },
  slowReader(keys) { return (e, v, o) => { for (let j = 0; j < keys.length; j++) { const x = e[keys[j]]; if (x !== null && typeof x === 'object') return false; v[o + j] = x; } return true; }; },
  // The typed arrays the snapshot copies: W.map's (but its derived layers) and every player's (fog).
  layers(w = W) {
    const out = [], m = w.map;
    for (const k of Object.keys(m)) if (!MAP_DERIVED.includes(k) && ArrayBuffer.isView(m[k])) out.push(m[k]);
    for (const p of w.players) if (p) for (const k of Object.keys(p)) if (ArrayBuffer.isView(p[k])) out.push(p[k]);
    return out;
  },
  // The snapshot's rehearsal (autosave), a generator in slices of its own (sliced(), timeouts) before the snapshot. The
  // snapshot runs once a minute: cold, its code ran 2-3 times slower (26 ms against 9 at 480 x 480), and the first one
  // after a start or a load also made its arrays. The rehearsal does that work instead, and runs the code once:
  // - pending terrain work (terraFlush), and freeze()'s arrays for the flat records, sized for the whole of W.list;
  // - a spare copy (spares) of each typed array the snapshot copies, where none fits yet, as many a slice as fit;
  // - freeze(), dry, on W.map, the players (and their AIs) and every 8th entity (at most about 2048 of them): the GameMap,
  //   Player, AIPlayer and entity copies, and the flat records' compiled readers;
  // - walk, pack and the JSON on a small sample of that: 256 flat records, 32 other entities and 32 KB of three layers;
  // - the flat records' pass (most of the snapshot's time) over the whole of W.list, 4096 entities a step, and parts().
  // Everything it makes is thrown away but the spares and the arrays. Its steps share slices where they fit (pacer());
  // the dry freeze, its longest step that cannot be cut, starts a slice of its own.
  *rehearse(slice = this.sliceMs) {
    const P = this.pacer(slice), step = function* (kind, units, f) { if (P.due(kind, units)) { yield; P.next(); } return P.time(kind, units, f); };
    yield* step('flush', 1, () => { if (typeof terraFlush === 'function') terraFlush(); });
    yield* step('bufs', 1, () => { this.bufs = this.bufsFor(this.bufs, W.list.length, Math.max(1, W.nextId | 0)); });
    for (const a of this.layers()) {
      const c = this.spares.get(a); if (c && c.constructor === a.constructor && c.length === a.length) continue;
      yield* step('spare', a.byteLength, () => this.spare(a, false));
    }
    if (P.ran) { yield; P.next(); }
    const k = Math.max(8, Math.ceil(W.list.length / 2048)), some = W.list.filter((e, i) => i % k === 0), out = {};
    const snap = P.time('dry', some.length, () => this.freeze({ map: W.map, players: W.players, list: some }, some, W.nextId, true));
    try {
      const flat = [], other = [], p = W.players[W.humanId] || W.players[1];
      for (let i = 0; i < snap.items.length && (flat.length < 256 || other.length < 32); i++) { const l = snap.shape[i] >= 0 ? flat : other; if (l.length < (l === flat ? 256 : 32)) l.push(snap.items[i]); }
      const layers = [W.map.ter.slice(0, 32768), W.map.blk.slice(0, 8192)]; if (p && p.explored) layers.push(p.explored.slice(0, 32768));
      yield* step('walk', 1, () => { for (const _ of this.walk({ flat, other, layers }, out, 0, snap)); });
    } finally { snap.release(); }
    yield* step('pack', 1, () => { for (const _ of this.pack(out, 0)); });
    yield* step('json', 1, () => { for (const _ of this.json(out, {}, [], 0)); });
    const b = this.bufs, top = Math.max(1, W.nextId | 0);
    if (b && b.slot.length > top) for (let a = 0; a < W.list.length; a += 4096) {
      const part = W.list.slice(a, a + 4096);
      yield* step('flat', part.length, () => { b.slot.fill(0, 0, top + 1); b.shape.fill(-1, 0, part.length); this.flatPass(part, part.length, top, b.slot, b.shape, b.start, b.vals); });
    }
    yield* step('parts', 1, () => { if (!W.over && !W.editor) this.parts(); });   // (a match that ended meanwhile is not saved: autosave() stops after this)
  },
  // The autosave's text: the snapshot (freeze) at once, as the first, synchronous step, then the walk, the packing and
  // the JSON in idle slices, then the join in an idle period of its own. live: see sliced(); rehearsal: the rehearsal's
  // task times, which start stats.slices.
  async serializeSliced({ live = () => true, rehearsal = [] } = {}) {
    const t0 = performance.now(), { head, value } = this.parts(), snap = this.freeze(value, W.list, W.nextId), out = {}, parts = [];
    const stats = this.stats = { tick: W.tick, snapMs: +(performance.now() - t0).toFixed(2), flat: snap.flat, entities: snap.items.length, slices: rehearsal.slice(), rehearsal, rehearseMs: rehearsal.length ? Math.max(...rehearsal) : 0, walkMs: 0, packMs: 0, jsonMs: 0, joinMs: 0, putMs: 0, tailMs: 0, hold: 0, ms: 0, chars: 0 };
    const longest = from => Math.max(0, ...stats.slices.slice(from));   // the longest slice of a stage
    let k = stats.slices.length;
    try { await this.sliced(this.walk(snap.root, out, this.sliceMs, snap), stats.slices, live); } finally { snap.release(); }
    stats.walkMs = longest(k); k = stats.slices.length;
    await this.sliced(this.pack(out, this.sliceMs), stats.slices, live);
    stats.packMs = longest(k); k = stats.slices.length;
    await this.sliced(this.json(out, head, parts, this.sliceMs), stats.slices, live);
    stats.jsonMs = longest(k);
    await this.idle();
    if (!live()) throw this.aborted();
    const t1 = performance.now(), text = parts.join('');   // the same text as serialize()
    stats.joinMs = +(performance.now() - t1).toFixed(2); stats.slices.push(stats.joinMs);
    this.lastHead = head; stats.ms = +(performance.now() - t0).toFixed(1); stats.chars = text.length; stats.hold = Math.max(...stats.slices);
    return text;
  },
  // Nothing holds the simulation; every failure shows a message (the old autosave told only once). The autosave saves
  // the match running when it starts (w0): once that is no longer the match running (a load, a new match, the menu),
  // it stops at its next idle period, writing nothing and telling nothing.
  async autosave() {
    if (this.busy) return false;
    this.busy = true;
    const w0 = W, live = () => !!W && W === w0 && !W.menu;
    try {
      await this.idle(true);   // after the tick that started it: the snapshot is of a moment between two ticks, as a manual save's is
      if (!live() || W.editor || W.over) return false;   // the match ended or was left meanwhile
      // the rehearsal's tasks are timeouts, as the first one is: they keep the snapshot close to the tick that started it
      // (a busy page has few idle periods, and each would wait for its own)
      const rehearsal = [];
      await this.sliced(this.rehearse(), rehearsal, live, true);
      await this.idle();   // the snapshot in an idle period of its own
      if (!live() || W.editor || W.over) return false;
      const text = await this.serializeSliced({ live, rehearsal }), stats = this.stats, head = this.lastHead;
      await Store.open();  // the database opened first, so the write's task runs through to IndexedDB's put
      await this.idle();   // the write in an idle period of its own
      if (!live()) return false;
      const t = performance.now();
      await this.saveTo('auto', text, head);
      // the write's task: from its start to the end of IndexedDB's put of the text (store.js times it), a microtask later
      const put = Store.timing && Store.timing.saves, ok = put && put.key === 'auto' && put.at >= t, task = ok ? +(put.at - t).toFixed(2) : 0;
      stats.putMs = ok ? +put.ms.toFixed(2) : 0; stats.slices.push(task); stats.tailMs = Math.max(stats.joinMs, task); stats.hold = Math.max(...stats.slices);
      if (live()) W.autosaveError = false;
      return true;
    }
    catch (e) {
      if (e && e.aborted) return false;
      if (live()) { W.autosaveError = true; msg('Autosave failed: ' + (e && e.message ? e.message : e) + ' Use Export Match from the game menu to keep a copy.', '#fc8'); }
      return false;
    }
    finally { this.busy = false; }
  },
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
  async openLoad() {
    const backToGame = UI.gameRunning && UI.paused;
    const m = openModal('Load Match', '<p>Resume a saved match or choose an exported match file (.json.gz or .json).</p><div id="match-slots"></div><label>Import match <input type="file" id="match-file" accept=".gz,.json,application/gzip,application/json"></label><p id="match-error" role="status"></p>', [[backToGame ? 'Back to Game Menu' : 'Close', backToGame ? () => { openGameMenu(); return false; } : null]]);
    const fail = e => { m.querySelector('#match-error').textContent = e.message; };
    m.querySelector('#match-file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { this.resume(await readTextFile(f)); } catch (err) { fail(err); } };
    let infos; try { infos = await this.slotInfos(); } catch (e) { fail(e); return; }
    const box = m.querySelector('#match-slots');
    if (!box) return;   // the modal was closed or replaced while the slots loaded (an imported file resumed the match)
    for (const s of [...this.slots, 'auto']) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = this.slotLabel(s, infos[s]); b.disabled = !infos[s];
      b.onclick = async () => { try { const text = await this.loadFrom(s); if (!text) throw new Error('That slot is empty.'); this.resume(text); } catch (e) { fail(e); } };
      box.appendChild(b);
    }
  },
  // the game menu's Save Match: five slots, each showing what it holds; a slot that holds a save is overwritten
  async openSave() {
    const m = openModal('Save Match', '<p>Choose a slot. Saving to a slot that holds a match replaces it.</p><div id="match-slots"></div><p id="match-error" role="status"></p>', [['Back to Game Menu', () => { openGameMenu(); return false; }]]);
    const status = m.querySelector('#match-error'), box = m.querySelector('#match-slots');
    let infos; try { infos = await this.slotInfos(); } catch (e) { status.textContent = 'Save failed: ' + e.message; return; }
    for (const s of this.slots) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = this.slotLabel(s, infos[s]);
      b.onclick = async () => {
        for (const x of box.querySelectorAll('button')) x.disabled = true;
        status.textContent = 'Saving…';
        try { await this.saveTo(s, this.serialize()); msg(`Match saved to slot ${s}.`, '#9fd'); openGameMenu(); }
        catch (e) { status.textContent = 'Save failed: ' + e.message; for (const x of box.querySelectorAll('button')) x.disabled = false; }
      };
      box.appendChild(b);
    }
  },
  // a gzip file (CompressionStream); plain JSON where the browser has no CompressionStream
  async export() {
    const text = this.serialize(), gz = typeof CompressionStream === 'function', blob = gz ? await gzipText(text) : new Blob([text], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = gz ? 'age-of-realms-match.json.gz' : 'age-of-realms-match.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
  if (!W || W.menu || W.editor || W.over || MatchSave.busy || (typeof indexedDB === 'undefined' && typeof localStorage === 'undefined')) return;
  if (W.t < (W.nextAutosave ?? MatchSave.interval)) return;
  W.nextAutosave = W.t + MatchSave.interval;
  MatchSave.autosave().catch(() => { /* autosave() handles its own failures; nothing may reject unhandled */ });   // a snapshot right after this tick, then the text in idle slices while the match plays on
});

if (typeof initMenus === 'function') {
  const previous = initMenus;
  initMenus = function () {
    previous(); $('#btn-load').onclick = () => MatchSave.openLoad(); $('#btn-tutorial').onclick = startTutorial; $('#btn-controls').onclick = openControls;
    // the editor's maps come from IndexedDB: the setup screen waits for them, so its custom-map list is complete
    Editor.ready = Editor.loadAll().then(n => { if (Editor.active && Editor.ui) Editor.refreshList(); return n; }, () => 0);
    const setup = $('#btn-sp').onclick; $('#btn-sp').onclick = e => Editor.ready.then(() => setup(e));
  };
}
if (typeof openGameMenu === 'function') {
  const previous = openGameMenu;
  openGameMenu = function () {
    previous(); const buttons = $('#modal .modal-btns');
    for (const [label, action] of [['Save Match', () => MatchSave.openSave()], ['Export Match', () => MatchSave.export().catch(e => msg('Export failed: ' + e.message, '#fc8'))], ['Load Match', () => MatchSave.openLoad()], ['Controls', () => openControls()]]) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
      if (W.over && ['Save Match', 'Export Match'].includes(label)) b.disabled = true;
      b.onclick = () => { try { action(); } catch (e) { const p = document.createElement('p'); p.textContent = 'Save failed: ' + e.message; $('#modal .modal-body').appendChild(p); } }; buttons.appendChild(b);
    }
  };
}
