// Headless checks for game/js/fx.js (render polish): loads with the engine, pure helpers, world hooks.
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..', 'game', 'js');
const noop = () => {};
// a minimal Sound with a fake WebAudio context so the stereo wrapper can be observed
const SoundFake = new Proxy({
  sfx: 'REAL', vol: { muted: false }, calls: [],
  ctx: { createStereoPanner() { return { pan: { value: 0 }, connect() {}, kind: 'panner' }; } },
  posGain() { return 1; },
  play(name, x, y) { this.calls.push(this.sfx); },
}, { get: (t, k) => (k in t ? t[k] : noop) });
const ctx = vm.createContext({ console, performance, Math, Proxy, Uint8Array, Int16Array, Int32Array, Float32Array, Uint32Array, Map, Set, Array, Object, JSON, String, Number,
  Sound: SoundFake, UI: { selection: [], deselect: noop, onRemoved: noop, showEnd: noop, gameRunning: true, panelKey: '' } });
const LOADED = new Set(); const load = f => (LOADED.add(f), 0) || vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
let loadErr = null;
try {
  for (const f of ['data.js', 'map.js', 'world.js', 'render.js']) load(f);
  try { load('ai.js'); } catch (e) { console.log('ai skipped', e.message); }
  load('mod.js'); load('water.js'); load('wells.js'); load('terra.js'); load('fx.js');
  if (process.env.AOR_FULL) for (const f of ['mod.js','water.js','wells.js','terra.js','command.js','victory.js','terrain.js','fx.js','extras.js','units_hd.js']) if (!LOADED.has(f)) load(f);
} catch (e) { loadErr = e.stack; }
const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
ok('fx.js loads after the engine and mods without errors', !loadErr && run('typeof FX === "object" && typeof fxWallMask === "function"'), loadErr);
ok('every feature is on by default (no URL switches outside a browser)', run('Object.values(FX.on).every(Boolean) && Object.keys(FX.on).length === 12'));

// ---- pure helpers ----
const M = run(`(() => { const L = new Set(['1,0','-1,0','0,-1']); const f = (x, y) => L.has(x + ',' + y); return { m: fxWallMask(f, 0, 0), none: fxWallMask(() => false, 5, 5), all: fxWallMask(() => true, 5, 5) }; })()`);
ok('wall mask bits: +x=1, -x=2, +y=4, -y=8', M.m === (1 | 2 | 8) && M.none === 0 && M.all === 15, M);
ok('gate orientation follows the wall line', run('fxGateAlongX(3) && fxGateAlongX(0) && !fxGateAlongX(12) && !fxGateAlongX(4) && fxGateAlongX(5)'));
const H = run(`(() => { const h = fxHull([[0,0],[10,0],[10,10],[0,10],[5,5],[3,7],[10,5]]); const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; };
  const s0 = fxShadowPoly(10, 10, 2, 0, 0, 0), s1 = fxShadowPoly(10, 10, 2, 0, 60, 0), s2 = fxShadowPoly(10, 10, 2, 0, 120, 0);
  const cx = p => p.reduce((a, q) => a + q[0], 0) / p.length;
  return { n: h.length, area: area(h), a0: +area(s0).toFixed(1), a1: +area(s1).toFixed(1), a2: +area(s2).toFixed(1), shiftRight: cx(s2) > cx(s0) }; })()`);
ok('convex hull drops interior/collinear points', H.n === 4 && H.area === 100, H);
ok('projected shadow grows with height and falls away from the light', H.a1 > H.a0 * 1.2 && H.a2 > H.a1 && H.shiftRight, H);
const PN = run('[fxPan(0, 1000), fxPan(500, 1000), fxPan(1000, 1000), fxPan(-500, 1000), fxPan(300, 0)]');
ok('stereo pan: left negative, centre 0, right positive, clamped', PN[0] < -0.8 && Math.abs(PN[1]) < 1e-9 && PN[2] > 0.8 && PN[3] === -0.85 && PN[4] === 0, PN);
const MA = run(`[ 'knight','militia','mangonel','archer','galley','wolf' ].map(t => fxMaterial({ kind: 'unit', type: t })).concat([fxMaterial({ kind: 'bld', type: 'house' }), fxMaterial({ kind: 'bld', type: 'palisade' })])`);
ok('hit material: sparks on armour/siege, blood on soft targets, chips on buildings', MA.join() === 'spark,blood,spark,blood,wood,blood,stone,wood', MA);
const FG = run(`(() => { const A = new Float32Array([255, 255, 0, 115]), vis = [1, 0, 0, 1], exp = [1, 1, 0, 1]; let steps = 0, moved = true; const first = A[0];
  fxFogStep(A, vis, exp, 0.3, null); const after1 = A[0]; while (moved && steps < 100) { moved = fxFogStep(A, vis, exp, 0.3, null); steps++; } return { after1, first, final: Array.from(A), steps }; })()`);
ok('fog fades gradually toward visible/explored/unexplored targets and settles', FG.after1 < FG.first && FG.after1 > 0 && FG.final.join() === '0,115,255,0' && FG.steps < 40, FG);
const NZ = run(`(() => { const S = 64, a = fxNoise(S, 9, 4); let mn = 1, mx = 0, seam = 0, inner = 0; for (let i = 0; i < a.length; i++) { mn = Math.min(mn, a[i]); mx = Math.max(mx, a[i]); }
  for (let y = 0; y < S; y++) { seam += Math.abs(a[y * S] - a[y * S + S - 1]); inner += Math.abs(a[y * S + 20] - a[y * S + 21]); } return { mn, mx, seam: seam / S, inner: inner / S }; })()`);
ok('cloud fbm noise is in 0..1 and tiles seamlessly', NZ.mn >= 0 && NZ.mx <= 1 && NZ.mx - NZ.mn > 0.3 && NZ.seam < NZ.inner * 3 + 0.02, NZ);

// ---- world hooks ----
run(`var PC=[{c:'#00f',d:'#00a',l:'#88f'},{c:'#f00',d:'#a00',l:'#f88'}];
  const spec=generateMapSpec({size:'small',seed:3,mapType:'land',numPlayers:2});
  createWorld(spec,{players:[{name:'A',civ:'franks',color:PC[0],human:true},{name:'B',civ:'teutons',color:PC[1]}],seed:3,fog:'none',startRes:'high',startAge:2});
  for(let i=0;i<20;i++) worldTick(0.05);
  var FREE=(w,h,away)=>{ const m=W.map; for(let y=4;y<m.n-h-4;y++) for(let x=4;x<m.n-w-4;x++){ let ok=true; for(let yy=y;yy<y+h&&ok;yy++) for(let xx=x;xx<x+w&&ok;xx++){ const i=m.idx(xx,yy); if(m.blk[i]||isWaterT(m.ter[i])) ok=false; if(away&&away.some(a=>Math.abs(a.x-xx)<3&&Math.abs(a.y-yy)<3)) ok=false; } if(ok) return {x,y}; } return null; };`);
const WM = run(`(() => { const o = FREE(8, 8); const B = (t, x, y) => spawnBuilding(t, 1, o.x + x, o.y + y, true);
  const line = [0,1,2,3,4].map(k => B(k === 2 ? 'gate' : 'wall', k, 0));
  const col = [1,2,3].map(k => B('wall', 0, k));          // L corner at (0,0)
  const tw = B('tower', 5, 0);
  const vg = [B('palisade', 7, 2), B('gate', 7, 3), B('palisade', 7, 4)];
  const m1 = line.map(fxWallMaskFor), mc = col.map(fxWallMaskFor), mv = vg.map(fxWallMaskFor);
  removeEnt(line[3]);
  const m2 = line.map(fxWallMaskFor);
  return { m1, mc, mv, m2, gateX: fxGateAlongX(m1[2]), vGateX: fxGateAlongX(mv[1]) }; })()`);
ok('wall line connects: ends, middles, gate in line, tower joins the end', WM.m1.join() === [1 | 4, 3, 3, 3, 3].join(), WM);
ok('L corner and column masks', WM.mc.join() === [8 | 4, 12, 8].join(), WM);
ok('gate orientation: along x in an x-line, along y in a y-line (palisade + gate link)', WM.gateX && !WM.vGateX && WM.mv.join() === [4, 12, 8].join(), WM);
ok('removing a wall re-masks its neighbours on the next draw (no stale sprites)', WM.m2[2] === 2 && WM.m2[4] === 1, WM);

const CP = run(`(() => { const o = FREE(3, 3); const u = spawnUnit('militia', 2, o.x + 1.5, o.y + 1.5); const n0 = FX.corpses.length;
  killEnt(u); const dying = !!u.dying; let t = 0; while (!u.dead && t < 20) { worldTick(0.05); t += 0.05; }
  const c = FX.corpses.find(c => c.id === u.id); return { dying, dead: !!u.dead, n0, n1: FX.corpses.length, has: !!c, age: c ? +(W.t - c.t).toFixed(1) : null, snapClean: c ? (!c.snap.dying && c.snap.anim === 'idle') : null }; })()`);
ok('a fallen unit leaves a corpse decal that outlives the engine death animation', CP.dying && CP.dead && CP.has && CP.n1 === CP.n0 + 1 && CP.age > 10 && CP.age < 13 && CP.snapClean, CP);
const CR = run(`(() => { const o = FREE(4, 4); const src = spawnUnit('villager', 1, o.x + 0.5, o.y + 0.5), tg = spawnUnit('knight', 2, o.x + 3.5, o.y + 3.5);
  const n0 = FX.craters.length; fireProjectile(src, tg, 'stone', null, { dmgVal: 1, blast: 1, srcType: 'mangonel' });
  let t = 0; while (W.projs.length && t < 5) { worldTick(0.05); t += 0.05; } const c = FX.craters[FX.craters.length - 1];
  return { n0, n1: FX.craters.length, near: c ? Math.hypot(c.x - (o.x + 3.5), c.y - (o.y + 3.5)) < 1.5 : false }; })()`);
ok('mangonel stones leave craters where they land', CR.n1 === CR.n0 + 1 && CR.near, CR);
const AR = run(`(() => { const o = FREE(6, 6); const rnd = Math.random; Math.random = () => 0.01;
  try {
    const src = spawnUnit('villager', 1, o.x + 0.5, o.y + 0.5), tg = spawnUnit('militia', 2, o.x + 4.5, o.y + 0.5);
    const n0 = FX.arrows.length; fireProjectile(src, tg, 'arrow', null, { dmgVal: 0 }); tg.x += 2; tg.y += 2; // dodge -> miss
    let t = 0; while (W.projs.length && t < 5) { worldTick(0.05); t += 0.05; } const own = FX.arrows.length - n0;
    W.missFx = []; const n1 = FX.arrows.length; tg.x -= 2; tg.y -= 2; fireProjectile(src, tg, 'arrow', null, { dmgVal: 0 }); tg.x += 2;
    t = 0; while (W.projs.length && t < 5) { worldTick(0.05); t += 0.05; } const withMissFx = FX.arrows.length - n1; delete W.missFx;
    return { cmd: typeof CMD !== 'undefined', own, withMissFx, ang: FX.arrows.length ? typeof FX.arrows[FX.arrows.length - 1].ang : null };
  } finally { Math.random = rnd; } })()`);
ok('missed arrows stick in the ground; deferred to W.missFx when another module provides it', (AR.cmd ? AR.own <= 1 : AR.own === 1) && AR.withMissFx === 0 && AR.ang === 'number', AR);
const SP = run(`(() => { R.cw = 1000; R.ch = 600; R.cam.zoom = 1; R.cv = R.cv || { getBoundingClientRect: () => ({ top: 0, left: 0 }) }; const W0 = W; centerCamOn(40, 40); const s = Sound; s.calls.length = 0;
  const left = screenToTile(50, 300), right = screenToTile(950, 300), mid = screenToTile(500, 300);
  s.play('bow', left.x, left.y); s.play('bow', right.x, right.y); s.play('bow', mid.x, mid.y); s.play('click');
  const c = s.calls; return { kinds: c.map(x => typeof x === 'object' ? (x.pan.value < 0 ? 'L' : 'R') : x), restored: s.sfx }; })()`);
ok('positional sounds pan by screen x and the bus is restored after each call', SP.kinds.join() === 'L,R,REAL,REAL' && SP.restored === 'REAL', SP);
const SK = run(`(() => { let err = null; try { for (let i = 0; i < 20 * 30; i++) worldTick(0.05); } catch (e) { err = e.stack; } return { err, craters: FX.craters.length <= 120, arrows: FX.arrows.length <= 300, corpses: FX.corpses.length <= 400 }; })()`);
ok('30 s soak with fx hooks: no exceptions, decal lists stay capped', !SK.err && SK.craters && SK.arrows && SK.corpses, SK);
console.log(`\n${pass} passed, ${fail} failed`);
