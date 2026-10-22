// Map editor (game/js/editor.js): undo and redo keep only what a change touched and restore the map exactly; maps
// live in IndexedDB (store.js) with an in-memory mirror; custom sizes; imports up to the sanity cap, plain or gzip.
//   node tests/editor.test.js
const v8 = require('v8'), vm = require('vm');
v8.setFlagsFromString('--expose-gc'); const gc = vm.runInNewContext('gc');   // for the heap measurement below
const harness = require('./engine-harness');
const { fakeIndexedDB } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const { c, run } = harness();
Object.assign(c, { indexedDB: fakeIndexedDB(), setTimeout, clearTimeout, Blob, Response, CompressionStream, DecompressionStream, TextDecoderStream });
run(`
Editor.status = () => {}; Editor.refreshUI = () => {};   // the side panel is DOM; the vm has none
// a map's spec with its objects sorted, so two specs compare equal when they hold the same layers, objects and players
function canon(s) { const o = Object.assign({}, s); o.objects = s.objects.map(x => JSON.stringify(x)).sort(); return JSON.stringify(o); }
// one stroke as the mouse makes it: snapshot, apply along a line, commit on mouse-up
function stroke(tool, x0, y0, x1, y1, steps, opts = {}) {
  Object.assign(Editor, { tool, brush: opts.brush || 3 }, opts);
  Editor.snapshot(); Editor.painting = true; Editor.lastApplied = null; Editor.flatLevel = W.map.elevAt(x0, y0);
  for (let k = 0; k <= steps; k++) Editor.apply({ x: x0 + (x1 - x0) * k / steps + 0.5, y: y0 + (y1 - y0) * k / steps + 0.5 });
  Editor.painting = false; Editor.commit();
}`);

// ---------- 1. every kind of change undoes and redoes exactly ----------
const U = JSON.parse(run(`(() => {
  Editor.newGenerated('land', 'large', 77, 3); Editor.name = 'Test';
  const specs = [canon(Editor.toSpec())], kinds = [];
  let noops = 0, entries = 0;
  const at = (kind, f) => { const n0 = Editor.undo.length; f(); const c = canon(Editor.toSpec()); if (c === specs[specs.length - 1]) noops++; entries += Editor.undo.length - n0; specs.push(c); kinds.push(kind); };
  const spot = (() => { for (let y = 90; y < 115; y++) for (let x = 90; x < 115; x++) if (!canPlace(null, 'barracks', x, y, true)) return { x, y }; })();
  at('paint dirt', () => stroke('terrain', 10, 10, 40, 30, 12, { terrain: T.DIRT }));
  at('paint water (removes what cannot stand in it)', () => stroke('terrain', 60, 60, 70, 62, 5, { terrain: T.WATER }));
  at('bridge over it (a new layer)', () => stroke('bridge', 61, 61, 68, 61, 4, { brush: 1 }));
  at('raise', () => stroke('raise', 20, 50, 30, 55, 5));
  at('lower', () => stroke('lower', 22, 50, 28, 52, 3));
  at('flatten', () => stroke('flatten', 30, 60, 40, 66, 5));
  at('tunnel', () => stroke('tunnel', 30, 80, 36, 80, 3, { brush: 1 }));
  at('trench', () => stroke('trench', 70, 30, 75, 34, 3, { brush: 1 }));
  at('trees', () => stroke('object', 80, 70, 90, 75, 5, { obj: ED_OBJECTS[0], brush: 4 }));
  at('erase (objects and layers)', () => stroke('erase', 78, 68, 84, 72, 3, { brush: 3 }));
  at('place a building', () => { Editor.owner = 1; Editor.tool = 'object'; Editor.obj = { k: 'bld', t: 'barracks' }; Editor.snapshot(); Editor.lastApplied = null; Editor.apply({ x: spot.x + 1.5, y: spot.y + 1.5 }); Editor.commit(); });
  at('place a unit', () => { Editor.owner = 2; Editor.tool = 'object'; Editor.obj = { k: 'unit', t: 'knight' }; Editor.snapshot(); const p = nearestLandTile(85, 100, true); Editor.lastApplied = null; Editor.apply({ x: p.x + 0.5, y: p.y + 0.5 }); Editor.commit(); });
  at('drag an entity', () => { const e = W.list.find(q => q.type === 'knight'); Editor.snapshot(); Editor.moving = { ent: e }; const p = nearestLandTile((e.x | 0) + 5, (e.y | 0) + 3, true); Editor.moveEnt(e, { x: p.x + 0.5, y: p.y + 0.5 }); Editor.moving = null; Editor.commit(); });
  at('delete an entity', () => { const e = W.list.find(q => q.type === 'barracks'); Editor.snapshot(); removeEnt(e); Editor.commit(); });
  at('move a start', () => { Editor.owner = 1; Editor.tool = 'start'; Editor.snapshot(); Editor.apply({ x: 33.5, y: 44.5 }); Editor.commit(); });
  at('add a player (reloads the world)', () => { Editor.snapshot(); Editor.players.push({ start: null, civ: 'turks', color: 5, team: 0 }); Editor.loadSpec(Editor.toSpec()); Editor.commit(); });
  const undone = [], redone = [], full = Editor.undo.filter(e => e.full).length;
  for (let k = specs.length - 2; k >= 0; k--) { Editor.doUndo(); undone.push(canon(Editor.toSpec()) === specs[k] ? 1 : 0); }
  for (let k = 1; k < specs.length; k++) { Editor.doRedo(); redone.push(canon(Editor.toSpec()) === specs[k] ? 1 : 0); }
  return JSON.stringify({ kinds: kinds.length, noops, entries, full, undone: undone.join(''), redone: redone.join('') });
})()`));
ok(`${U.kinds} kinds of change (painting, water, a bridge, height, a tunnel, a trench, trees, erasing, a building, a unit, a drag, a delete, a start, a new player) each make one undo entry, and undo and redo restore exactly the map before and after each`, U.noops === 0 && U.entries === U.kinds && U.full === 1 && U.undone === '1'.repeat(U.kinds) && U.redone === '1'.repeat(U.kinds), U);

// ---------- 2. 60 strokes at 480 x 480 keep a few megabytes ----------
// (the perf spec's cap patch: sides above 256 stay blocked by validateMapSpec until phase 8)
run(`var __v0 = validateMapSpec; validateMapSpec = eval('(' + __v0.toString().replace('n > 256', 'n > 1024') + ')');
var __max = Editor.maxSize(); Editor.newBlank(480); Editor.name = 'Big'; var __marks = [];`);
gc(); const h0 = process.memoryUsage().heapUsed;
run(`for (let s = 0; s < 60; s++) {
  const x = 20 + (s * 37) % 420, y = 20 + (s * 53) % 420, tool = ['terrain', 'raise', 'object'][s % 3];
  if (s >= 56) __marks.push(hashStr(canon(Editor.toSpec())));   // the maps before strokes 57 to 60 (hashed: kept off the heap measurement)
  stroke(tool, x, y, x + 30, y + 12, 10, { brush: 8, terrain: [T.DIRT, T.SAND, T.FOREST][s % 3], obj: ED_OBJECTS[0] });
}
__marks.push(hashStr(canon(Editor.toSpec())));`);
gc(); const h1 = process.memoryUsage().heapUsed;
const M = JSON.parse(run(`(() => {
  try {
    const entries = Editor.undo.length, bytes = Editor.stackBytes(Editor.undo), trees = W.list.filter(e => e.type === 'tree').length;
    let tiles = 0, objects = 0; for (const e of Editor.undo) { for (const l of e.layers) tiles += l.idx.length; objects += e.after.length + e.before.length; }
    const back = []; for (let k = 3; k >= 0; k--) { Editor.doUndo(); back.push(hashStr(canon(Editor.toSpec())) === __marks[k] ? 1 : 0); }
    const fwd = []; for (let k = 1; k <= 4; k++) { Editor.doRedo(); fwd.push(hashStr(canon(Editor.toSpec())) === __marks[k] ? 1 : 0); }
    return JSON.stringify({ max: __max, entries, bytes, tiles, objects, trees, back: back.join(''), fwd: fwd.join('') });
  } finally { validateMapSpec = __v0; }
})()`));
const heapMB = +((h1 - h0) / 1048576).toFixed(1);
ok(`60 strokes on a 480 x 480 map (${M.tiles.toLocaleString('en-US')} tile changes, ${M.objects.toLocaleString('en-US')} objects) keep ${(M.bytes / 1048576).toFixed(2)} MB of undo entries; the heap grew ${heapMB} MB with the ${M.trees.toLocaleString('en-US')} trees they planted (at most 20 MB; the old undo kept the whole map as JSON for every stroke)`, M.entries === 60 && M.bytes <= 20 * 1048576 && heapMB <= 20, { ...M, heapMB });
ok('the last four strokes at 480 x 480 undo and redo to exactly the maps between them', M.back === '1111' && M.fwd === '1111', M);

// ---------- 3. custom sizes ----------
const Z = JSON.parse(run(`(() => {
  const plain = Editor.maxSize();
  Editor.newBlank(144); const n144 = W.n;
  return JSON.stringify({ plain, n144 });
})()`));
ok(`a custom size makes a blank map of that side (144), up to what validateMapSpec allows: ${Z.plain} today, 480 with the cap raised (${M.max})`, Z.plain === 256 && M.max === 480 && Z.n144 === 144, { Z, max: M.max });

(async () => {
  // ---------- 4. maps in IndexedDB, mirrored in memory ----------
  const S = JSON.parse(await run(`(async () => {
    Editor.newGenerated('land', 'medium', 5, 2); Editor.name = 'Stored';
    const spec = Editor.toSpec(), json = JSON.stringify(spec).length;
    await Editor.store('Stored', spec);
    const rec = await Store.get('maps', 'Stored'), loaded = Editor.load('Stored');
    Editor.maps = new Map(); const n = await Editor.loadAll();
    const again = JSON.stringify(Editor.load('Stored')) === JSON.stringify(spec);
    await Editor.remove('Stored'); const gone = !(await Store.get('maps', 'Stored')) && !Editor.savedList().includes('Stored');
    return JSON.stringify({ json, stored: JSON.stringify(rec).length, packed: rec.format === 'aor-map' && typeof rec.spec.ter.d === 'string', same: JSON.stringify(loaded) === JSON.stringify(spec), n, again, gone });
  })()`));
  ok(`a saved map goes to IndexedDB packed (${S.stored.toLocaleString('en-US')} characters for a ${S.json.toLocaleString('en-US')}-character spec), loads back the same, survives a reload of the mirror, and deletes`, S.packed && S.same && S.n === 1 && S.again && S.gone && S.stored < S.json, S);
  // a map the store cannot take (quota) is refused, and leaves the list again
  const Q = harness(); Object.assign(Q.c, { indexedDB: fakeIndexedDB({ quota: 1000 }), setTimeout, clearTimeout });
  const QR = JSON.parse(await Q.run(`(async () => {
    Editor.newGenerated('land', 'small', 9, 2); let err = '';
    try { await Editor.store('Too big', Editor.toSpec()); } catch (e) { err = e.name; }
    return JSON.stringify({ err, listed: Editor.savedList().includes('Too big') });
  })()`));
  ok('a map the store cannot take (quota) is refused with QuotaExceededError and does not stay in the list', QR.err === 'QuotaExceededError' && !QR.listed, QR);

  // ---------- 5. imports: past the old 8 MB limit, and gzip ----------
  const I = JSON.parse(await run(`(async () => {
    Editor.newGenerated('land', 'small', 9, 2);
    const spec = Editor.toSpec(), text = JSON.stringify(spec, null, 1), pad = text + ' '.repeat(9 * 1024 * 1024 - text.length);
    const big = await Editor.readMapFile(new Blob([pad])), gz = await Editor.readMapFile(await gzipText(text));
    let bad = ''; try { await Editor.readMapFile(new Blob([JSON.stringify({ n: -1, ter: [], objects: [] })])); } catch (e) { bad = e.message; }
    return JSON.stringify({ size: pad.length, big: canon(big) === canon(spec), gz: canon(gz) === canon(spec), bad });
  })()`));
  ok(`a ${(I.size / 1048576).toFixed(0)} MB map file (over the old 8 MB limit) and a gzip one import; a malformed one is refused`, I.big && I.gz && I.bad.startsWith('Map size'), I);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
