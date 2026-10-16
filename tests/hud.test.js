// Headless tests for game/js/hud.js (fixed command grid) and the aspect-aware minimap: node tests/hud.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };

// every card a player can open, in every age
const cards = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 3, mapType: 'coastal', numPlayers: 2 }), cards = [];
  for (const age of AGES.map((_, i) => i)) {
    createWorld(spec, { players: [{ name: 'A', civ: 'turks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'franks', color: PLAYER_COLORS[1] }], seed: 3, fog: 'none', startRes: 'high', startAge: age, difficulty: 'standard' });
    const card = (label, sel) => { UI.selection = sel; const c = commandsFor(sel); GameHooks.emit('commands', sel, c); cards.push({ label: label + '@' + age, cmds: c.map(x => ({ name: x.name, key: x.key, slot: x.slot })) }); };
    for (const bt of Object.keys(BUILDINGS)) { const b = spawnBuilding(bt, 1, 10, 10, true); if (!b) continue; b.built = true; b.garrison = b.garrison || []; card(bt, [b]); removeEnt(b); }
    for (const ut of ['villager', 'militia', 'archer', 'knight', 'monk', 'transport', 'tradecart', 'ram', 'sapper']) {
      if (!UNITS[ut]) continue; const u = spawnUnit(ut, 1, 20.5, 20.5);
      for (const pg of ['main', 'eco', 'mil', 'terra']) { UI.page = pg; card(ut + ':' + pg, [u]); }
      UI.page = 'main'; removeEnt(u);
    }
  }
  return JSON.stringify(cards);
})()`));
const clashes = [], unplaced = [], overflow = [];
for (const c of cards) {
  const seen = new Map();
  for (const x of c.cmds) {
    if (!x.slot) { unplaced.push(c.label + ':' + x.name); continue; }
    const k = x.slot.row + ',' + x.slot.col;
    if (seen.has(k)) clashes.push(`${c.label}: ${seen.get(k)} / ${x.name}`); else seen.set(k, x.name);
    if (x.slot.row > 3) overflow.push(c.label + ':' + x.name);
  }
}
ok(`every command on ${cards.length} cards has its own slot`, !clashes.length && !unplaced.length, clashes.concat(unplaced).slice(0, 5));
ok('every card fits the 4 × 6 grid', !overflow.length, overflow.slice(0, 5));
const where = name => { const s = new Set(); for (const c of cards) for (const x of c.cmds) if (x.name === name || (name instanceof RegExp && name.test(x.name))) s.add(x.slot.row + ',' + x.slot.col); return [...s]; };
ok('Delete is always bottom right', JSON.stringify(where(/^(Delete|Delete building|Cancel construction)$/)) === '["3,5"]', where(/^Delete/));
ok('Back is always bottom left', JSON.stringify(where('Back')) === '["3,0"]', where('Back'));
ok('Stop is always in the same slot', where('Stop').length === 1, where('Stop'));
ok('Set Rally Point is always in the same slot', where('Set Rally Point').length === 1, where('Set Rally Point'));
ok('stances keep their slots', ['Defensive', 'Stand Ground', 'No Attack'].every(n => where(n).length === 1), ['Defensive', 'Stand Ground', 'No Attack'].map(where));
let keyed = 0, total = 0;
for (const c of cards) for (const x of c.cmds) if (typeof x.key === 'string' && x.key.length === 1 && /[QWERTYASDFGHZXCVBN]/.test(x.key.toUpperCase())) { total++; const r = ['QWERTY', 'ASDFGH', 'ZXCVBN'][x.slot.row]; if (r && r[x.slot.col] === x.key.toUpperCase()) keyed++; }
ok('buttons sit where their hotkey is on the keyboard', keyed === total, { keyed, total });

// minimap: square and 2:1 canvases map tiles and back consistently
const M = JSON.parse(run(`(() => { const out = [];
  for (const [w, h] of [[220, 220], [400, 200], [342, 171]]) {
    const cv = { width: w, height: h }, n = W.n, k = w / (n * 2), oy = (h - w / 2) / 2;
    for (const [x, y] of [[0, 0], [n, n], [n / 2, n / 3], [n, 0]]) { const sx = (x - y) * k + w / 2, sy = (x + y) * k / 2 + oy, t = minimapToTile(cv, sx, sy); out.push(Math.hypot(t.x - x, t.y - y)); }
    // the whole diamond fits inside the canvas
    out.push(((n + n) * k / 2 + oy) <= h + 1e-9 ? 0 : 99);
  }
  return JSON.stringify(out); })()`));
ok('minimap clicks land on the right tile at any aspect ratio', M.every(d => d < 1e-6), M);
const F = JSON.parse(run(`(() => { const r = {};
  const v = W.list.find(e => e.type === 'villager'), tree = W.list.find(e => e.type === 'tree'), house = W.list.find(e => e.kind === 'bld' && e.type === 'house');
  const s = spawnUnit('militia', 1, 20.5, 20.5);
  for (const f of ['mil', 'eco', 'land']) r[f] = [v, tree, s].map(e => mmFilterPass(e, f));
  removeEnt(s); return JSON.stringify(r); })()`));
ok('minimap filters: Army shows soldiers only, Eco shows villagers and resources, Land hides units', JSON.stringify(F) === JSON.stringify({ mil: [false, false, true], eco: [true, true, false], land: [false, false, false] }), F);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
