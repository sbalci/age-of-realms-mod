// Headless checks for game/js/units_hd.js: pose keys & frame quantization, LRU, interpolation, occluders,
// the pixel post-pass, back-view drawing hooks, icons and the ?unitshd=off switch.
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
function makeCtx(search) {
  const c = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Uint8ClampedArray, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number, encodeURIComponent, decodeURIComponent,
    URLSearchParams, Sound: stub, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
  if (search !== undefined) c.location = { search };
  const load = f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), c, { filename: f });
  let err = null;
  try {
    for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js', 'render.js']) load(f);
    try { load('ai.js'); } catch (e) { }
    vm.runInContext(`var RES_ICON = { food: '🍖', wood: '🪵', gold: '🪙', stone: '🪨' };`, c);
    for (const f of ['mod.js', 'water.js', 'wells.js', 'terra.js', 'command.js', 'victory.js', 'terrain.js', 'fx.js', 'extras.js', 'units_hd.js']) load(f);
  } catch (e) { err = e.stack; }
  return { c, err, run: s => vm.runInContext(s, c) };
}
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };

const A = makeCtx();
const run = A.run;
ok('units_hd.js loads after the whole engine + mods without errors', !A.err && run('typeof UHD === "object" && typeof uhdKey === "function"'), A.err);
ok('all features on by default', run('UHD.on.any && UHD.on.unitsprites && UHD.on.unitsmooth && UHD.on.facings && UHD.on.unitsil && UHD.on.hdicons'));
run(`var PC=[{c:'#2f6fe0',d:'#1a3f90',l:'#8ab0ff'},{c:'#d8352c',d:'#8a1a14',l:'#ff9a90'}];
 const spec=generateMapSpec({size:'tiny',seed:5,mapType:'land',numPlayers:2});
 createWorld(spec,{players:[{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'turks',color:PC[1]}],seed:5,fog:'none',startRes:'high',startAge:1});
 for(let i=0;i<10;i++) worldTick(0.05);`);

// ---- categories & zoom buckets ----
const CAT = run(`['villager','militia','knight','mangonel','sheep','galley','tradecart','cobra','janissary','monk'].map(t => uhdCategory(UNITS[t]))`);
ok('categories: human/mounted/siege/animal; ships, carts and cobras stay live', JSON.stringify(CAT) === JSON.stringify(['h', 'h', 'm', 's', 'a', null, null, null, 'h', 'h']), CAT);
const ZB = run(`(() => { const zs = [0.3, 0.5, 0.95, 1, 1.05, 1.6, 2.5, 3.2, 5]; return zs.map(z => uhdZoomBucket(z)); })()`);
ok('zoom bucket is the smallest bucket >= zoom (capped), never below the zoom up to the cap', ZB.every((b, i) => b >= Math.min([0.3, 0.5, 0.95, 1, 1.05, 1.6, 2.5, 3.2, 5][i], 3.2)) && ZB[3] === 1 && ZB[4] === 1.12 && ZB[8] === 3.2, ZB);

// ---- animation quantization ----
const PH = run(`(() => { const out = []; const W0 = W.t;
  for (const [type, anim, work] of [['villager','walk'],['villager','idle'],['villager','work','chop'],['villager','work','farm'],['knight','walk'],['sheep','idle'],['deer','walk'],['monk','work','heal'],['mangonel','walk']]) {
    const d = UNITS[type]; const u = { id: 17, type, anim, work: work ? { kind: work } : null };
    let okCycle = true, okIdem = true, frames = new Set();
    for (let t = 0; t < 12; t += 0.037) { const a = uhdPhase(u, d, t, W0); frames.add(a.frame); const b = uhdPhase(u, d, a.tq, W0); if (b.frame !== a.frame) okIdem = false; }
    out.push({ type, anim, n: frames.size, okIdem });
  } return out; })()`);
ok('frame quantization is idempotent (rendering at tq lands in the same frame)', PH.every(p => p.okIdem), PH);
ok('walk/work cycles have 6-10 frames, idle 4-8, static siege 1', PH.every(p => (p.anim === 'walk' && p.type !== 'mangonel' ? p.n >= 6 && p.n <= 10 : p.anim === 'work' ? p.n === 8 : p.type === 'mangonel' ? p.n === 1 : p.n >= 4 && p.n <= 8)), PH);
const AT = run(`(() => { const d = UNITS.militia, out = []; for (const s of [0, 0.03, 0.1, 0.3, 0.5, 1.2, 5]) { const r = uhdPhase({ anim: 'attack', atkT: 10 - s }, d, 0, 10); out.push([s, +r.sinceQ.toFixed(3), r.frame]); } return out; })()`);
ok('attack poses quantize time-since-hit downwards and cap after the reload', AT.every(([s, q]) => q <= s + 1e-9 && q >= 0) && AT[0][1] === 0 && AT[6][1] <= 2.5 && new Set(AT.map(a => a[2])).size >= 5, AT);

// ---- keys ----
const K = run(`(() => { const d = UNITS.militia, k = u => uhdKey(Object.assign({ type: 'militia', owner: 1, anim: 'idle', face: 1, back: false, id: 4 }, u), d, 0.1, W.t, 1, '#2f6fe0').key;
  return { same: k({}) === k({ id: 6 }), id: k({}) !== k({ id: 5 }), face: k({}) !== k({ face: -1 }), back: k({}) !== k({ back: true }), owner: k({}) !== k({ owner: 2 }), anim: k({}) !== k({ anim: 'walk' }),
    vil: (() => { const dv = UNITS.villager, kv = u => uhdKey(Object.assign({ type: 'villager', owner: 1, anim: 'walk', face: 1, id: 3 }, u), dv, 0.1, W.t, 1, '#2f6fe0').key;
      return { carry: kv({}) !== kv({ carry: { res: 'wood', amt: 8 } }), carryAmt: kv({ carry: { res: 'wood', amt: 2 } }) !== kv({ carry: { res: 'wood', amt: 9 } }), farm: kv({}) !== kv({ order: { t: 'farm' } }), gender: kv({ id: 3 }) !== kv({ id: 4 }) }; })(),
    monk: uhdKey({ type: 'monk', owner: 1, anim: 'idle', id: 1, relic: 1 }, UNITS.monk, 0, W.t, 1, 'x').key !== uhdKey({ type: 'monk', owner: 1, anim: 'idle', id: 1 }, UNITS.monk, 0, W.t, 1, 'x').key }; })()`);
ok('pose key: shared across same-variant ids; differs by variant, facing, back, owner, anim', K.same && K.id && K.face && K.back && K.owner && K.anim, K);
ok('pose key: villager carry type/amount, farming hat, gender; monk relic', K.vil.carry && K.vil.carryAmt && K.vil.farm && K.vil.gender && K.monk, K);
ok('?facings: back flag only matters when facings are on', run(`UHD.on.facings = false; const a = uhdKey({ type: 'militia', owner: 1, anim: 'idle', face: 1, id: 2, back: true }, UNITS.militia, 0, W.t, 1, 'x').key === uhdKey({ type: 'militia', owner: 1, anim: 'idle', face: 1, id: 2 }, UNITS.militia, 0, W.t, 1, 'x').key; UHD.on.facings = true; a`));

// ---- LRU ----
const L = run(`(() => { const m = new Map([['a', { b: 10 }], ['b', { b: 10 }], ['c', { b: 10 }]]); uhdTouch(m, 'a'); const order = [...m.keys()].join('');
  const ev = uhdEvict(m, 30, 15, v => v.b); return { order, left: [...m.keys()].join(''), bytes: ev.bytes, n: ev.n, miss: uhdTouch(m, 'zz') === undefined }; })()`);
ok('LRU: touch moves to the back, eviction drops the oldest until under budget', L.order === 'bca' && L.left === 'a' && L.bytes === 10 && L.n === 2 && L.miss, L);

// ---- interpolation ----
const I = run(`(() => { const m = uhdLerpPos(1, 1, 1.4, 1.2, 0.5), tp = uhdLerpPos(1, 1, 9, 9, 0.5), nw = uhdLerpPos(undefined, undefined, 4, 4, 0.2);
  const tc = W.list.find(e => e.type === 'tc' && e.owner === 1); const u = spawnUnit('militia', 1, tc.x + 6.5, tc.y + 6.5); orderMove([u], tc.x + 14, tc.y + 6.5);
  for (let i = 0; i < 20; i++) worldTick(0.05);
  const px = u._uhx, x = u.x, at = u.animT; uhdSwapIn(0.5); const mid = u.x; uhdSwapOut();
  return { m, tp, nw, recorded: px !== undefined && px !== x, mid: Math.abs(mid - (px + (x - px) * 0.5)) < 1e-9, restored: u.x === x && u.animT === at }; })()`);
ok('lerp: midpoint, teleports and new units are not interpolated', Math.abs(I.m[0] - 1.2) < 1e-9 && Math.abs(I.m[1] - 1.1) < 1e-9 && I.tp[0] === 9 && I.nw[0] === 4, I);
ok('worldTick records the previous position; render swap-in lerps, swap-out restores exactly', I.recorded && I.mid && I.restored, I);

// ---- occluders ----
const O = run(`(() => { const tc = W.list.find(e => e.type === 'tc' && e.owner === 1); const getEnt = id => W.ents.get(id);
  const behind = { x: tc.x - 0.5, y: tc.y - 0.5 }, front = { x: tc.x + 5.5, y: tc.y + 5.5 };
  const tree = W.list.find(e => e.kind === 'res' && e.type === 'tree'); const bt = { x: tree.x - 0.5, y: tree.y - 0.5 };
  return { behind: uhdOccluders(behind, W.map, getEnt, entDepth).includes(tc), front: uhdOccluders(front, W.map, getEnt, entDepth).length, tree: uhdOccluders(bt, W.map, getEnt, entDepth).some(e => e.type === 'tree') }; })()`);
ok('occluders: a unit behind a building or tree finds it, one in front finds nothing', O.behind && O.front === 0 && O.tree, O);

// ---- pixel post-pass ----
const PP = run(`(() => { const sw = 40, sh = 40, src = new Uint8ClampedArray(sw * sh * 4);
  for (let y = 10; y < 30; y++) for (let x = 12; x < 28; x++) { const i = (y * sw + x) * 4; src[i] = 120; src[i + 1] = 120; src[i + 2] = 120; src[i + 3] = 255; }
  const bb = uhdTrim(src, sw, sh, 6), pad = 5, bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1, W2 = bw + pad * 2, H2 = bh + pad * 2;
  const out = new Uint8ClampedArray(W2 * H2 * 4); uhdPost(src, sw, bb.x0, bb.y0, bw, bh, pad, 2, 2, null, out);
  const px = (x, y) => Array.from(out.slice((y * W2 + x) * 4, (y * W2 + x) * 4 + 4));
  const out2 = new Uint8ClampedArray(W2 * H2 * 4); uhdPost(src, sw, bb.x0, bb.y0, bw, bh, pad, 2, 2, { cx: W2 / 2, cy: H2 - 2, rx: 14, ry: 4 }, out2);
  return { bb, outline: px(pad - 1, pad + 8), far: px(0, 0), ul: px(pad, pad), dr: px(pad + bw - 1, pad + bh - 1), mid: px(pad + 8, pad + 10), shadow: Array.from(out2.slice(((H2 - 2) * W2 + 1) * 4, ((H2 - 2) * W2 + 1) * 4 + 4)) }; })()`);
ok('trim finds the drawn box', PP.bb.x0 === 12 && PP.bb.x1 === 27 && PP.bb.y0 === 10 && PP.bb.y1 === 29, PP.bb);
ok('outline: dark, mostly opaque ring outside the figure; empty far away', PP.outline[3] > 150 && PP.outline[0] < 40 && PP.far[3] === 0, PP);
ok('lighting: upper-left edge lit, lower-right edge shaded, body keeps its colour', PP.ul[0] > PP.mid[0] + 30 && PP.dr[0] < PP.mid[0] - 20 && Math.abs(PP.mid[0] - 120) < 40 && PP.mid[3] === 255, PP);
ok('contact shadow drawn under the figure when requested', PP.shadow[3] > 30 && PP.shadow[0] < 30, PP.shadow);

// ---- drawing hooks: back view hides the face, keeps every type drawable ----
run(`function mockCtx() { const calls = []; const grad = { addColorStop() {} }; const t = { calls, fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, lineCap: '', lineJoin: '', font: '', textAlign: '', globalCompositeOperation: '' };
  for (const k of ['save','restore','translate','rotate','scale','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','ellipse','quadraticCurveTo','bezierCurveTo','rect','clip','strokeRect','fillText','setTransform','transform','drawImage','clearRect']) t[k] = function () {};
  t.fillRect = function (x, y, w, h) { calls.push([x, y, w, h]); }; t.createLinearGradient = t.createRadialGradient = () => grad; return t; }
  UHD.probe = mockCtx();`);
const BV = run(`(() => { const eye = c => c.calls.some(a => a[0] === 2.4 && a[1] === -14 && a[2] === 0.9);
  const u = spawnUnit('militia', 1, 20, 20), res = {};
  const f = mockCtx(); UHD.gen = { face: 1, back: false, tilt: 0 }; drawUnitFigure(f, u, 0.3); UHD.gen = null; res.frontEye = eye(f);
  const b = mockCtx(); UHD.gen = { face: 1, back: true, tilt: 0 }; drawUnitFigure(b, u, 0.3); UHD.gen = null; res.backEye = eye(b);
  const p = mockCtx(); drawUnitFigure(p, u, 0.3); res.plainEye = eye(p);
  const bad = [];
  for (const t of Object.keys(UNITS)) { const cat = uhdCategory(UNITS[t]); if (!cat) continue; for (const back of [false, true]) for (const anim of ['idle', 'walk', 'attack', 'work']) {
    const v = Object.assign(spawnUnit(t, 2, 22, 22), { anim, atkT: W.t - 0.2, back, work: anim === 'work' && t === 'villager' ? { kind: 'chop' } : null });
    try { UHD.gen = { face: -1, back, tilt: back ? -0.11 : 0.05 }; drawUnitFigure(mockCtx(), v, 0.4); } catch (e) { bad.push(t + '/' + anim + '/' + back + ': ' + e.message); } finally { UHD.gen = null; } } }
  res.bad = bad; return res; })()`);
ok('front view draws the eye; back view (incl. probe through inner wrappers) does not', BV.frontEye && !BV.backEye && BV.plainEye, BV);
ok('every cached unit type draws in all anims, front and back, through the hooks (incl. Imam/Janissary)', BV.bad.length === 0, BV.bad.slice(0, 5));

// ---- icons ----
const IC = run(`(() => { const r = ['food','wood','gold','stone'].map(k => RES_ICON[k]); const svgs = Object.keys(UHD_SVG).map(k => decodeURIComponent(uhdIconUrl(k).slice('data:image/svg+xml,'.length)));
  const bal = s => { const open = (s.match(/<(?!\\/)[a-zA-Z]+[^>]*[^\\/]>/g) || []).length, close = (s.match(/<\\/[a-zA-Z]+>/g) || []).length; return open === close; };
  return { imgs: r.every(s => s.startsWith('<img class="uhd-ri" src="data:image/svg+xml,')), alts: r.every(s => / alt="[A-Z][a-z]+"/.test(s)), n: svgs.length, wellFormed: svgs.every(s => s.startsWith('<svg') && s.endsWith('</svg>') && bal(s)), noRawQuote: r.every(s => (s.match(/"/g) || []).length === 8), emoji: UHD.RES_EMOJI && UHD.RES_EMOJI.food === '🍖' }; })()`);
ok('resource cost/top-bar icons are drawn SVG <img> tags (food, wood, gold, stone)', IC.imgs && IC.alts && IC.emoji, IC);
ok('7 SVG icons (+pop, water, idle villager), balanced markup, attribute-safe data URLs', IC.n === 7 && IC.wellFormed && IC.noRawQuote, IC);

// ---- switch off ----
const B = makeCtx('?unitshd=off');
const OFF = B.run(`(() => { const spec = generateMapSpec({ size: 'tiny', seed: 5, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'franks', color: PLAYER_COLORS[1] }], seed: 5, fog: 'none', startRes: 'high', startAge: 1 });
  worldTick(0.05); const u = W.list.find(e => e.kind === 'unit');
  return { any: UHD.on.any, emoji: RES_ICON.food, recorded: u._uhx !== undefined }; })()`);
ok('?unitshd=off: nothing wrapped, emoji kept, no interpolation bookkeeping', !B.err && OFF.any === false && OFF.emoji === '🍖' && !OFF.recorded, { err: B.err, OFF });
const C = makeCtx('?unitsmooth=off&hdicons=off');
ok('sub-switches: ?unitsmooth=off and ?hdicons=off', !C.err && C.run('!UHD.on.unitsmooth && !UHD.on.hdicons && UHD.on.unitsprites && RES_ICON.wood === "🪵"'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
