// Hierarchical pathfinding graph (game/js/hpa.js): its components are the map's true connected areas, and a graph
// kept up to date through hpaDirty equals one built from scratch after every kind of passability change.
// node tests/hpa-graph.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
// Labels of an 8-way flood fill under findPath's own step rule, on the class's passability: the reference the
// graph's components must equal.
function floodLabels(cls) {
  const m = W.map, n = m.n, pass = hpaPassFn(cls), P = new Uint8Array(n * n), lab = new Int32Array(n * n).fill(-1);
  for (let i = 0; i < n * n; i++) P[i] = pass(i) ? 1 : 0;
  let next = 0; const st = [];
  for (let i = 0; i < n * n; i++) {
    if (!P[i] || lab[i] >= 0) continue;
    lab[i] = next; st.push(i);
    while (st.length) {
      const c = st.pop(), cx = c % n, cy = (c / n) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + PF_DX[d], ny = cy + PF_DY[d]; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (lab[j] >= 0 || !P[j] || !m.canStep(cx, cy, nx, ny)) continue;
        if (d >= 4 && (!P[cy * n + nx] || !P[ny * n + cx])) continue;
        lab[j] = next; st.push(j);
      }
    }
    next++;
  }
  return lab;
}
// Do two labellings split the graph's node tiles into the same groups? Returns the number of node tiles that disagree.
function samePartition(G, labOf) {
  const a = new Map(), b = new Map(); let bad = 0;
  for (const c of G.cl) for (const t of c.nodes) {
    const x = G.comp[t], y = labOf(t);
    if (!a.has(x)) a.set(x, y); else if (a.get(x) !== y) bad++;
    if (!b.has(y)) b.set(y, x); else if (b.get(y) !== x) bad++;
  }
  return bad;
}
// landReg / waterReg with the regions that a diagonal step past a cliff corner joins merged (computeRegions is 4-way).
function regionsJoined(cls) {
  const m = W.map, n = m.n, reg = cls === 'naval' ? m.waterReg : m.landReg, pass = hpaPassFn(cls), up = new Map();
  const find = r => { while (up.has(r) && up.get(r) !== r) r = up.get(r); return r; };
  let squeezes = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let d = 4; d < 8; d++) {
    const nx = x + PF_DX[d], ny = y + PF_DY[d]; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
    const i = y * n + x, j = ny * n + nx;
    if (!pass(i) || !pass(j) || !pass(y * n + nx) || !pass(ny * n + x) || !m.canStep(x, y, nx, ny)) continue;
    const a = find(reg[i]), b = find(reg[j]); if (a === b) continue;
    squeezes++; if (a < b) up.set(b, a); else up.set(a, b);
  }
  return { label: t => find(reg[t]), squeezes };
}
// Everything a graph holds, in a comparable form (cost rows are all worked out first).
function graphShape(G) {
  for (let k = 0; k < G.cl.length; k++) for (let a = 0; a < G.cl[k].nodes.length; a++) hpaRow(G, k, a);
  const root = new Map(); for (const c of G.cl) for (const t of c.nodes) { const r = G.comp[t]; if (!root.has(r) || root.get(r) > t) root.set(r, t); }
  return JSON.stringify({ P: Array.from(G.P), mv: Array.from(G.mv), lab: Array.from(G.lab),
    cl: G.cl.map(c => ({ nodes: c.nodes, inter: c.inter, cost: Array.from(c.cost).map(v => v === Infinity ? -1 : +v.toFixed(6)), comp: c.nodes.map(t => root.get(G.comp[t])) })) });
}
function freshShape(cls) { const keep = HPA.g[cls]; delete HPA.g[cls]; const s = graphShape(hpaGraph(cls)); HPA.g[cls] = keep; return s; }
`);

// ---------- 1. components = true connected areas, on 20 seeds × 3 map types ----------
const C = JSON.parse(run(`(() => {
  const out = { maps: 0, nodes: 0, floodBad: 0, regionBad: 0, squeezes: 0, worst: [] };
  for (const type of ['land', 'coastal', 'islands']) for (let seed = 1; seed <= 20; seed++) {
    const spec = generateMapSpec({ size: 'medium', seed, mapType: type, numPlayers: 2 });
    createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed, fog: 'none', startRes: 'standard', startAge: 0 });
    out.maps++;
    for (const cls of ['land', 'naval']) {
      const G = hpaGraph(cls), ff = floodLabels(cls), bad = samePartition(G, t => ff[t]);
      out.floodBad += bad; for (const c of G.cl) out.nodes += c.nodes.length;
      if (bad) out.worst.push(type + ' ' + seed + ' ' + cls + ' flood ' + bad);
    }
    // with every building, tree and mine gone, the components are landReg / waterReg (regions joined at cliff corners)
    for (const e of W.list.slice()) removeEnt(e);
    for (const cls of ['land', 'naval']) {
      const G = hpaGraph(cls), R = regionsJoined(cls), bad = samePartition(G, R.label);
      out.regionBad += bad; out.squeezes += R.squeezes;
      if (bad) out.worst.push(type + ' ' + seed + ' ' + cls + ' regions ' + bad);
    }
  }
  out.worst = out.worst.slice(0, 5);
  return JSON.stringify(out);
})()`));
ok(`graph components equal an 8-way flood fill under findPath's step rule (${C.maps} maps, land and naval)`, C.maps === 60 && C.nodes > 10000 && C.floodBad === 0, C);
ok(`with no buildings or resources they equal landReg / waterReg, joined where a diagonal step passes a cliff corner (${C.squeezes} such steps)`, C.regionBad === 0, C);

// ---------- 2. incremental upkeep = a fresh build, after each kind of passability change ----------
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'medium', seed: 9, mapType: 'coastal', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 9, fog: 'none', startRes: 'high', startAge: 2 });
  const m = W.map, n = m.n, P1 = W.players[1], rnd = mulberry32(3);
  P1.res.wood = P1.res.stone = 1e6;
  const land = () => { for (let k = 0; k < 500; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (!isWaterT(m.ter[i]) && !m.blk[i]) return { x, y }; } return null; };
  const shore = () => { for (let k = 0; k < 4000; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (isWaterT(m.ter[i]) || m.blk[i]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isWaterT(m.ter[m.idx(x + dx, y + dy)])) return { x, y, wx: x + dx, wy: y + dy }; } return null; };
  const water = () => { for (let k = 0; k < 4000; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (isWaterT(m.ter[i]) && !m.blk[i]) return { x, y }; } return null; };
  const ops = {
    house() { const p = land(); if (p && !canPlace(P1, 'house', p.x, p.y)) spawnBuilding('house', 1, p.x, p.y, true); },
    wallLine() { const p = land(); if (p) for (let k = 0; k < 6; k++) if (!canPlace(P1, 'wall', p.x + k, p.y)) spawnBuilding('wall', 1, p.x + k, p.y, true); },
    gate() { const p = land(); if (p && !canPlace(P1, 'gate', p.x, p.y)) { const g = spawnBuilding('gate', 1, p.x, p.y, false); hpaGraph('land'); completeBuilding(g); } },
    removeBuilding() { const b = W.list.filter(e => e.kind === 'bld'); if (b.length) removeEnt(b[(rnd() * b.length) | 0]); },
    fellTree() { const t = W.list.filter(e => e.kind === 'res' && e.type === 'tree'); if (t.length) removeEnt(t[(rnd() * t.length) | 0]); },
    plantTree() { const p = land(); if (p) spawnRes('tree', p.x, p.y); },
    fish() { const p = water(); if (p) spawnRes('fish', p.x, p.y); },
    removeFish() { const f = W.list.filter(e => e.type === 'fish'); if (f.length) removeEnt(f[(rnd() * f.length) | 0]); },
    dock() { const s = shore(); if (s && !canPlace(P1, 'dock', s.wx, s.wy)) spawnBuilding('dock', 1, s.wx, s.wy, true); },
    canal() { const s = shore(); if (s) terraApply('canal', s.x, s.y, P1); },
    raise() { const p = land(); if (p) for (let k = 0; k < 3; k++) terraApply('raise', p.x, p.y, P1); },
    lower() { const p = land(); if (p) terraApply('lower', p.x, p.y, P1); },
    trench() { const p = land(); if (p) for (let k = 0; k < 4; k++) terraApply('trench', p.x + k, p.y, P1); },
    tunnel() { const p = land(); if (p) for (let k = 0; k < 3; k++) terraApply('tunnel', p.x, p.y + k, P1); },
    bridge() { const s = shore(); if (!s) return; const dx = s.wx - s.x, dy = s.wy - s.y; for (let k = 1; k <= 4; k++) terraApply('bridge', s.x + dx * k, s.y + dy * k, P1, new Set()); },
    unbridge() { if (!m.bridge) return; for (let i = 0; i < n * n; i++) if (m.bridge[i]) { terraApply('unbridge', i % n, (i / n) | 0, P1); break; } },
    editorStroke() { const p = land(); if (!p) return; Editor.tool = 'raise'; Editor.brush = 2; Editor.lastApplied = null; Editor.apply({ x: p.x + 0.5, y: p.y + 0.5 }); },
    editorDrag() { const b = W.list.filter(e => e.kind === 'bld' && e.type === 'house'), p = land(); if (b.length && p) Editor.moveEnt(b[0], { x: p.x + 0.5, y: p.y + 0.5 }); },
    byHand() { const p = land(); if (p) { m.elev[m.idx(p.x, p.y)] = 4; m.computeVH(); m.computeRegions(); } },
  };
  for (const cls of ['land', 'naval']) hpaGraph(cls);
  const names = Object.keys(ops), bad = [];
  let checks = 0;
  for (let round = 0; round < 3; round++) for (const name of names) {
    ops[name](); if (typeof terraFlush === 'function') terraFlush();
    if (m.trench) hpaGraph('mounted');
    for (const cls of Object.keys(HPA.g)) { checks++; if (graphShape(hpaGraph(cls)) !== freshShape(cls)) bad.push(round + ':' + name + ':' + cls); }
  }
  return JSON.stringify({ checks, bad, rebuilt: HPA.stats.rebuilt, classes: Object.keys(HPA.g) });
})()`));
ok(`after buildings, gates, walls, docks, trees, fish, terraforming, bridges, tunnels, trenches and editor strokes, the kept graph equals a fresh build (${D.checks} comparisons)`, D.checks >= 100 && D.bad.length === 0 && D.classes.includes('mounted'), D);
// A world created with a trench layer builds the mounted graph at load (hpaWarm), not on its first cavalry order.
const WM = JSON.parse(run(`(() => {
  HPA.enabled = true;
  const mk = trench => {
    const spec = generateMapSpec({ size: 'tiny', seed: 5, mapType: 'land', numPlayers: 2 });
    if (trench) spec.trench = new Array(MAP_SIZES.tiny * MAP_SIZES.tiny).fill(0);
    createWorld(spec, { players: [0, 1].map(i => ({ name: 'P' + i, civ: ['franks', 'turks'][i], color: PLAYER_COLORS[i], human: i === 0 })), seed: 5, fog: 'none', startRes: 'high', startAge: 1 });
    return { trench: !!W.map.trench, classes: Object.keys(HPA.g), rows: HPA.g.mounted ? HPA.g.mounted.cl.length : 0 };
  };
  return JSON.stringify({ without: mk(false), withT: mk(true) });
})()`));
ok('a world created with a trench layer has the mounted graph built after creation; one without does not build it', WM.withT.trench && WM.withT.classes.includes('mounted') && WM.withT.classes.includes('land') && !WM.without.classes.includes('mounted'), WM);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
