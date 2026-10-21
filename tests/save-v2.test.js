// Save format 2 (game/js/session.js, game/js/codec.js): run-length base64 layers, compact object nodes, the generated
// map's spec as its options, limits that grow with the map, format 1 still loading (with the AI stagger once), and
// stale occupancy ids cleared on the way in.   node tests/save-v2.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const harness = require('./engine-harness');
const { run } = harness();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function match(size, seed, type, np, minutes, age = 1) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: 'x' + size, seed, mapType: type, numPlayers: np }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: np }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 5) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed, size: 'x' + size, mapType: type, fog: 'normal', startRes: 'high', startAge: age, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  for (let i = 0; i < minutes * 1200; i++) worldTick(0.05);
  W.spectate = false;
}`);

// ---------- 1. the codecs ----------
const C = JSON.parse(run(`(() => {
  const out = { rle: true, b64: true, vectors: true, bad: 0 }, rnd = mulberry32(9);
  const cases = [0, 1, 2, 3, 4, 127, 128, 129, 130, 131, 258, 1000, 100000].flatMap(n => {
    const runs = new Uint8Array(n), noise = new Uint8Array(n), mixed = new Uint8Array(n);
    for (let i = 0; i < n; i++) { runs[i] = (i / 37) & 3; noise[i] = (rnd() * 256) | 0; mixed[i] = (i % 300) < 150 ? 0 : (rnd() * 4) | 0; }
    return [runs, noise, mixed];
  });
  for (const a of cases) {
    const r = rleEncode(a), back = rleDecode(r, a.length);
    if (back.length !== a.length || back.some((v, i) => v !== a[i]) || r.length > a.length + Math.ceil(a.length / 128) + 1) out.rle = false;
    const s = b64Encode(a), d = b64Decode(s);
    if (d.length !== a.length || d.some((v, i) => v !== a[i]) || s.length !== Math.ceil(a.length / 3) * 4) out.b64 = false;
  }
  const enc = t => b64Encode(Uint8Array.from(t, c => c.charCodeAt(0)));
  out.vectors = ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map(enc).join(',') === ',Zg==,Zm8=,Zm9v,Zm9vYg==,Zm9vYmE=,Zm9vYmFy';
  const a = new Int32Array([0, 0, 0, 0, 70000, -5, 0, 0]), p = packArray(a), q = unpackArray(p, 100);
  out.typed = q instanceof Int32Array && q.length === 8 && q[4] === 70000 && q[5] === -5 && p.t === 'Int32Array';
  for (const f of [() => rleDecode(Uint8Array.of(5, 1), 6), () => rleDecode(Uint8Array.of(200), 75), () => rleDecode(Uint8Array.of(0, 1), 5), () => b64Decode('abc'), () => b64Decode('ab=c'), () => b64Decode('a$cd'),
    () => unpackArray({ t: 'Function', n: 1, d: 'AAAA' }, 10), () => unpackArray({ t: 'Uint8Array', n: 20, d: p.d }, 10), () => unpackArray({ t: 'Float32Array', n: 1, d: packArray(new Float32Array([NaN])).d }, 10)])
    try { f(); } catch (e) { out.bad++; }
  return JSON.stringify(out);
})()`));
ok('run-length bytes and base64 round trip on runs, noise and mixed arrays of every boundary length, and match the RFC 4648 vectors', C.rle && C.b64 && C.vectors && C.typed, C);
ok('malformed run-length data, base64, array types, lengths over the limit and non-finite floats are refused', C.bad === 9, C);

// ---------- 2. a match round trips to its own signature, and saving again gives the same graph ----------
const R = JSON.parse(run(`(() => {
  match(200, 33, 'coastal', 3, 3);
  const sig0 = signature(), t0 = performance.now(), text = MatchSave.serialize(), ms = performance.now() - t0;
  const g0 = JSON.stringify(JSON.parse(text).graph);
  MatchSave.restore(text); W.spectate = false;
  const sig1 = signature(), g1 = JSON.stringify(MatchSave.snapshot().graph);
  const file = JSON.parse(text), types = {};
  for (const nd of file.graph.nodes) { const k = typeof nd[0] === 'number' ? 'object' : nd[0]; types[k] = (types[k] || 0) + 1; }
  return JSON.stringify({ same: sig0 === sig1, graphSame: g0 === g1, chars: text.length, ms: +ms.toFixed(0), version: file.version, n: file.n, nodes: file.graph.nodes.length, shapes: file.graph.shapes.length, types, entities: W.list.length, specKeys: Object.keys(W.spec).sort().join(',') });
})()`));
ok(`a 200 x 200 3-player match after 3 game minutes saves in format 2 (${R.chars.toLocaleString('en-US')} characters, format 1 needed about 3,170,000) and loads to exactly its own signature`, R.same && R.version === 2 && R.n === 200 && R.chars < 1000000, R);
ok('saving the loaded match again gives the same graph, node for node', R.graphSame, { nodes: R.nodes, shapes: R.shapes, types: R.types });
ok('the generated map is saved as the options that regenerate it, with its name and starts', R.specKeys === 'name,players,regen', R.specKeys);

// ---------- 3. the regenerated spec is the original one, for every map type, rivers on and off ----------
const G = JSON.parse(run(`(() => {
  const bad = [], rivers0 = WMOD.rivers; let n = 0;
  for (const type of [...Object.keys(MAP_TYPE_NAMES), ...Object.keys(REAL_MAPS)]) for (const rv of [true, false]) {
    WMOD.rivers = rv; MAP_SIZES.x96 = 96;
    const spec = generateMapSpec({ size: 'x96', seed: 41, mapType: type, numPlayers: 3 }), want = JSON.stringify(spec);
    createWorld(spec, { players: [0, 1, 2].map(i => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 41, size: 'x96', mapType: type, fog: 'none', startRes: 'standard', startAge: 0, rules: currentRules() });
    WMOD.rivers = !rv;   // the rule at Restart time may differ: the stub regenerates with the one the map was made with
    const stub = MatchSave.specStub(W), back = JSON.stringify(MatchSave.specOf(JSON.parse(JSON.stringify(stub))));
    n++; if (back !== want || !stub.regen) bad.push(type + (rv ? '+rivers' : ''));
  }
  WMOD.rivers = rivers0;
  // an editor map keeps its layers and objects
  const blank = blankMapSpec(48); blank.players = [{ start: { x: 10, y: 10 }, civ: 'franks' }, { start: { x: 36, y: 36 }, civ: 'turks' }]; blank.ter[5] = T.WATER;
  createWorld(blank, { players: [0, 1].map(i => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 3, mapType: 'custom', fog: 'none', startRes: 'standard', startAge: 0, rules: currentRules() });
  const st = MatchSave.specStub(W), custom = ArrayBuffer.isView(st.ter) && !st.regen && JSON.stringify(MatchSave.specOf(st)) === JSON.stringify(blank);
  return JSON.stringify({ n, bad, custom });
})()`));
ok(`a generated map's spec regenerates exactly from its options (${G.n} map types and river rules); an editor map keeps its own layers`, G.bad.length === 0 && G.custom && G.n >= 16, G);

// ---------- 4. a 480 x 480 match with 8 players fits in 6 MB ----------
const H = JSON.parse(run(`(() => {
  const v0 = validateMapSpec;   // the perf spec's cap patch: sides above 256 stay blocked until phase 8
  validateMapSpec = eval('(' + v0.toString().replace('n > 256', 'n > 1024') + ')');
  try {
    match(480, 33, 'land', 8, 1);
    const sig0 = signature(), t0 = performance.now(), text = MatchSave.serialize(), ms = performance.now() - t0;
    MatchSave.restore(text);
    return JSON.stringify({ chars: text.length, ms: +ms.toFixed(0), entities: W.list.length, same: signature() === sig0 });
  } finally { validateMapSpec = v0; }
})()`));
ok(`a 480 x 480 match with 8 players saves in ${(H.chars / 1048576).toFixed(2)} M characters (at most 6 M) and loads to its own signature`, H.chars <= 6 * 1048576 && H.same, H);

// ---------- 5. limits: a 256 MB sanity cap on the text; node, value and entity limits that grow with the map ----------
const L = JSON.parse(run(`(() => {
  const out = {}, cap = CODEC.cap;
  CODEC.cap = 1000; try { MatchSave.parse(' '.repeat(1001)); out.cap = 'accepted'; } catch (e) { out.cap = e.message; } finally { CODEC.cap = cap; }
  out.capMB = CODEC.cap / 1048576;
  out.c256 = MatchSave.caps(256); out.c480 = MatchSave.caps(480);
  // 120,000 shrubs on a 200 map: more entities than format 1's fixed limit of 100,000 allowed
  match(200, 7, 'land', 2, 0);
  for (let i = 0; i < 120000; i++) spawnRes('shrub', 2 + (i % 196), 2 + ((i / 196) | 0) % 196);
  const text = MatchSave.serialize(); let parsed;
  try { parsed = MatchSave.parse(text).world.list.length; } catch (e) { parsed = e.message; }
  out.many = { entities: W.list.length, parsed };
  return JSON.stringify(out);
})()`));
ok('a save text over the sanity cap (CODEC.cap, 256 MB) is refused before it is parsed', L.cap === 'Save file is too large.' && L.capMB === 256, L);
ok(`the limits grow with the map: ${L.many.entities.toLocaleString('en-US')} entities on a 200 map load (format 1 stopped at 100,000), and a 480 map allows ${L.c480.entities.toLocaleString('en-US')}`, L.many.parsed === L.many.entities && L.c480.entities >= 4 * 480 * 480 && L.c480.nodes >= 8 * 480 * 480 && L.c256.entities >= 100000, L);

// ---------- 6. format 1: today's fixture loads unchanged, older ones get the AI stagger once ----------
const dir = path.join(__dirname, 'fixtures/saves'), load = f => JSON.stringify(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()).save);
const S = (() => {
  const h = harness(); h.c.__old = load('2026-10-15-a2e8c0f-before-tactics.json.gz'); h.c.__new = load('2026-10-20-phase3-final-v1.json.gz');
  return JSON.parse(h.run(`(() => {
    const accOf = text => { const f = JSON.parse(text), d = MatchSave.decode(f.graph, MatchSave.caps(256)); return d.world.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null); };
    const out = { oldFile: accOf(__old), newFile: accOf(__new) };
    MatchSave.restore(__old); out.oldLoaded = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    const v2 = MatchSave.serialize(); MatchSave.restore(v2); out.oldAgain = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    MatchSave.restore(__new); out.newLoaded = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    return JSON.stringify(out);
  })()`));
})();
ok(`a format 1 save from before the AI stagger (AI acc ${S.oldFile.slice(1).join(', ')}) loads staggered (${S.oldLoaded.slice(1).join(', ')}), and its format 2 save loads without a second stagger`, S.oldFile[1] === S.oldFile[2] && S.oldLoaded[1] !== S.oldLoaded[2] && JSON.stringify(S.oldAgain) === JSON.stringify(S.oldLoaded), S);
ok(`a format 1 save from today's build keeps its AI phases (${S.newFile.slice(1).join(', ')})`, JSON.stringify(S.newLoaded) === JSON.stringify(S.newFile), S);

// ---------- 7. a stale occupancy id: cleared on loading, never written by the pathfinding graph ----------
const B = JSON.parse(run(`(() => {
  match(96, 5, 'land', 2, 0);
  // an entity gone from the lists without its tile cleared, as an older build could leave it
  const tree = W.list.find(e => e.type === 'tree'), i = W.map.idx(tree.x, tree.y), id = tree.id;
  W.list.splice(W.list.indexOf(tree), 1); W.ents.delete(id); idxRebuild();
  const before = W.map.blk[i];
  hpaDirtyAll(); hpaGraph('land'); hpaGraph('naval');   // a whole rebuild visits every tile
  const afterGraph = W.map.blk[i], open = hpaGraph('land').P[i];
  MatchSave.restore(MatchSave.serialize());
  return JSON.stringify({ before: before === id, afterGraph: afterGraph === id, graphOpen: open === 1, loaded: W.map.blk[i] });
})()`));
ok('building the pathfinding graph leaves a stale occupancy id in place (counting the tile open), and loading a save clears it', B.before && B.afterGraph && B.graphOpen && B.loaded === 0, B);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
