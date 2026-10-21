// On-demand performance baseline for bigger maps: npm run test:perf (playwright.perf.config.js; the default browser
// run ignores this file). It repeats the browser measurements of the map evaluation
// (docs/superpowers/specs/2026-10-18-map-evaluation.md §3.0, tables T1–T5) and records them:
//   test-results/maps-perf.json   every number of this run
//   docs/maps-perf-baseline.md    one table row per map size, appended; commit the rows a phase is measured by
// Settings (environment variables):
//   AOR_PERF_SIZES  map sides, default 120,200,256. Sides above 256 (320, 480) are blocked by validateMapSpec until
//                   phase 8; for them this spec swaps in a copy of validateMapSpec with the cap raised to 1024, inside
//                   the test page only (the evaluation's runtime patch). Game code is never changed.
//   AOR_PERF_LABEL  the row label, for example "phase 1 baseline" (default "run")
//   AOR_PERF_TICKS  timed simulation ticks per match, default 3600 (3 game minutes, as in the evaluation)
//   AOR_PERF_KNIGHTS  fresh pages per size, player count and moment for the 40-knight order, default 5 (the row shows
//                   the median)
// The 'gpu' project (the default of npm run test:perf) is Chromium's new headless mode on the real GPU, as in the
// evaluation; the 'swiftshader' project is the software-rendering low-end check.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SIZES = (process.env.AOR_PERF_SIZES || '120,200,256').split(',').map(Number);
const LABEL = process.env.AOR_PERF_LABEL || 'run';
const TICKS = +(process.env.AOR_PERF_TICKS || 3600);
const KNIGHTS = +(process.env.AOR_PERF_KNIGHTS || 5);
const ROOT = path.join(__dirname, '..', '..');
const JSON_OUT = path.join(ROOT, 'test-results', 'maps-perf.json');
const MD_OUT = path.join(ROOT, 'docs', 'maps-perf-baseline.md');
const MD_HEAD = `# Bigger maps: performance baseline

Rows are appended by \`npm run test:perf\` (tests/browser/maps-perf.spec.js). Each phase of the bigger-maps roadmap
commits the rows it was measured by, so progress against the budgets stays visible. Methods: the map evaluation, §3.0.

- **Gen**: \`generateMapSpec\` for land, 3 / 8 players (warm JIT).
- **Tick**: all players AI, Feudal start, high resources, seed 33, 600 warm-up ticks, then the timed ticks; 3 players
  on coastal, 8 on land. Mean and p99 in ms. **Tree search**: one \`findNearestRes\` for trees within 30 tiles of
  a villager after the 3-player ticks, in µs (mean of 100).
- **40 knights**: one \`orderMove\` of 40 knights from player 1's Town Center to the farthest Town Center in the 3- and
  the 8-player match, in ms: the worst frame of the order's own work (the click, then each following tick's path work
  of the knights until every knight has a path), the median of AOR_PERF_KNIGHTS fresh pages (default 5). Ordered at
  the start of the match, then after 30 game seconds of AI play; with the fewest routes that reached their goal.
- **2D frame**: mean of 30 synchronous \`renderWorld\` + \`drawOverlays\` calls at zoom 1 / 0.55 (coastal, 3 players,
  seed 7). **2D fps**: live frames over 5 s at each zoom with the match running.
- **2.5D fps**: live frames over 4 s with \`?renderer=three\`.
- **Save**: \`MatchSave.serialize()\` characters and ms after the timed 3-player ticks; from phase 4 also, after the
  semicolon, for 5 autosaves in a live 8-player match: the median of their snapshots (the only time an autosave holds
  the game), their longest slice, and the longest tick while they ran, in ms.
- **Cache MB**: terrain chunk canvases (width × height × 4) after an 11 × 11 pan at zoom 0.55.

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
// The evaluation's runtime-only patch: the game's own validator source with the 256 cap raised to 1024, evaluated
// inside the test page only (no outside input reaches it).
const CAP_PATCH = `(() => { const orig = validateMapSpec, src = orig.toString(), patched = src.replace('n > 256', 'n > 1024');
  if (patched === src) throw new Error("validateMapSpec no longer contains 'n > 256'; update CAP_PATCH");
  validateMapSpec = eval('(' + patched + ')'); })();`;
const results = [];
test.describe.configure({ mode: 'serial' });

async function openGame(page, query = '') {
  await page.goto('/game/' + query);
  await page.waitForFunction(() => !!window.__game?.W);
}
async function prepareSize(page, n) {
  if (n > 256) await page.evaluate(CAP_PATCH);
  await page.evaluate(n => { MAP_SIZES['x' + n] = n; }, n);
}
const setup = (n, np, type, seed, startAge, startRes) => ({ name: 'Player', color: 0, civ: 'franks', mapType: type, customMap: '', size: 'x' + n, opponents: np - 1, oppCivs: [], difficulty: 'standard', teams: 'ffa', startAge, startRes, fog: 'normal', speed: '1', seed, cheats: true, tips: false });

// Generation time (evaluation T5): warm the JIT with one seed, time another.
async function measureGen(page, n) {
  return page.evaluate(n => {
    const out = {};
    for (const np of [3, 8]) {
      generateMapSpec({ size: n, seed: 2, mapType: 'land', numPlayers: np });
      const t0 = performance.now(); generateMapSpec({ size: n, seed: 1, mapType: 'land', numPlayers: np });
      out['p' + np] = +(performance.now() - t0).toFixed(0);
    }
    return out;
  }, n);
}
// Simulation with every player computer-controlled (evaluation T4).
async function measureSim(page, n, np, type) {
  return page.evaluate(({ cfg, ticks }) => {
    const g = __game; g.launchFromSetup(cfg);
    const W = g.W; g.UI.paused = true; W.players[1].ai = new AIPlayer(W.players[1], 'standard'); W.spectate = true;
    const res = { entities0: W.list.length };
    for (let i = 0; i < 600; i++) worldTick(0.05);
    const ts = []; for (let i = 0; i < ticks && !W.over; i++) { const c = performance.now(); worldTick(0.05); ts.push(performance.now() - c); }
    ts.sort((x, y) => x - y);
    res.tick = { n: ts.length, mean: +(ts.reduce((x, y) => x + y, 0) / ts.length).toFixed(2), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(1), max: +ts[ts.length - 1].toFixed(0), over50: ts.filter(x => x > 50).length };
    res.entities1 = W.list.length; res.units = W.list.filter(e => e.kind === 'unit' && e.owner > 0).length;
    const vv = W.list.find(e => e.type === 'villager' && !e.dying);
    let b = performance.now(); for (let i = 0; i < 100; i++) findNearestRes(vv, ['tree'], vv.x, vv.y, 30);
    res.findNearestResUs = +((performance.now() - b) * 10).toFixed(1);
    W.spectate = false; b = performance.now(); let s = ''; try { s = MatchSave.serialize(); } catch (e) { res.saveError = e.message; }
    res.save = { ms: +(performance.now() - b).toFixed(0), chars: s.length };
    return res;
  }, { cfg: setup(n, np, type, 33, 1, 'high'), ticks: TICKS });
}
// One 40-knight order across the map at the start of a match (evaluation T4), in a fresh page: the click, then each tick's
// path work of the knights (hpaJoinDue, which runs the group's route, and their pathTo calls) until every knight has a
// path. A group member makes its first path request on its own tick, so the click alone would not show the cost. full:
// the whole of those ticks, the AI players' own start-of-match work included.
// warm: game ticks of AI play before the order (graph repairs and AI work then run as in a match under way).
async function measureKnights(page, n, np, type, warm) {
  await openGame(page); await prepareSize(page, n);
  return page.evaluate(({ cfg, warm }) => {
    const g = __game; g.launchFromSetup(cfg);
    const W = g.W; g.UI.paused = true; W.players[1].ai = new AIPlayer(W.players[1], 'standard'); W.spectate = true;
    for (let i = 0; i < warm; i++) worldTick(0.05);
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
    let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
    const us = [];
    for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); }
    const set = new Set(us); let work = 0, depth = 0;
    const wrap = name => {
      const f = globalThis[name]; if (typeof f !== 'function') return () => {};
      globalThis[name] = function (u) { if (!set.has(u) || depth) return f.apply(this, arguments); depth++; const t0 = performance.now(); try { return f.apply(this, arguments); } finally { work += performance.now() - t0; depth--; } };
      return () => { globalThis[name] = f; };
    };
    const t0 = performance.now(); orderMove(us, far.x + 2, far.y + 6); const click = performance.now() - t0;
    const undo = [wrap('hpaJoinDue'), wrap('pathTo')], ticks = [], full = [];
    try { for (let i = 0; i < 12 && us.some(u => !u.path); i++) { work = 0; const t1 = performance.now(); worldTick(0.05); full.push(+(performance.now() - t1).toFixed(1)); ticks.push(+work.toFixed(1)); } }
    finally { for (const f of undo) f(); }
    const ok = us.filter(u => u.pathOk).length;
    for (const u of us) removeEnt(u);
    return { click: +click.toFixed(1), ticks, full, worst: +Math.max(click, ...ticks).toFixed(1), worstFull: +Math.max(click, ...full).toFixed(1), ok, straight: +fd.toFixed(0) };
  }, { cfg: setup(n, np, type, 33, 1, 'high'), warm });
}
const median = a => { const s = a.slice().sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };
async function measureKnightRuns(page, n, np, type, warm = 0) {
  const runs = []; for (let i = 0; i < KNIGHTS; i++) runs.push(await measureKnights(page, n, np, type, warm));
  return { ms: median(runs.map(r => r.worst)), full: median(runs.map(r => r.worstFull)), ok: Math.min(...runs.map(r => r.ok)), runs };
}
// The autosave (session.js) in a live 8-player match, 5 times: its snapshot, its slices, and every tick while it ran
// (worldTick timed through a wrapper the main loop calls).
async function measureAutosave(page, n) {
  await openGame(page); await prepareSize(page, n);
  return page.evaluate(async cfg => {
    if (typeof MatchSave.serializeSliced !== 'function') return { snapMs: 'n/a', maxSlice: 'n/a', maxTick: 'n/a' };   // a control run of code before phase 4
    const g = __game; g.launchFromSetup(cfg); const W = g.W;
    W.players[1].ai = new AIPlayer(W.players[1], 'standard'); W.spectate = true; W.nextAutosave = 1e9;
    g.UI.paused = false; g.UI.focusPaused = false;
    await new Promise(r => setTimeout(r, 2000));
    const wt = worldTick, ticks = [], runs = [];
    worldTick = function () { const t = performance.now(); const r = wt.apply(this, arguments); ticks.push(performance.now() - t); return r; };
    for (let k = 0; k < 5; k++) {
      W.nextAutosave = W.t;
      await new Promise(r => { const f = () => (MatchSave.busy || W.nextAutosave === W.t ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
      const s = MatchSave.stats; runs.push({ snapMs: s.snapMs, maxSlice: Math.max(...s.slices), slices: s.slices.length, ms: s.ms, chars: s.chars });
      await new Promise(r => setTimeout(r, 1000));
    }
    worldTick = wt; g.UI.paused = true;
    const snaps = runs.map(x => x.snapMs).sort((a, b) => a - b);
    return { runs, snapMs: snaps[2], maxSlice: +Math.max(...runs.map(x => x.maxSlice)).toFixed(1), maxTick: +Math.max(...ticks).toFixed(1) };
  }, setup(n, 8, 'land', 33, 1, 'high'));
}
// 2D rendering (evaluation T1): steady frame cost, live fps, then a full pan and the terrain-cache size.
async function measure2d(page, n) {
  await page.evaluate(cfg => { __game.launchFromSetup(cfg); __game.UI.paused = true; }, setup(n, 3, 'coastal', 7, 0, 'standard'));
  const steady = await page.evaluate(() => {
    const g = __game, R = g.R, W = g.W, ctx = R.ctx, tc = W.list.find(e => e.type === 'tc' && e.owner === W.humanId), out = {};
    for (const z of [1, 0.55]) {
      R.cam.zoom = z; g.centerCamOn(tc.x + 2, tc.y + 2); invalidateTerrain();
      let prev = -1; for (let f = 0; f < 40; f++) { renderWorld(ctx, { selection: new Set() }); if (R.chunks.size === prev) break; prev = R.chunks.size; }
      const N = 30, ts = [];
      for (let i = 0; i < N; i++) { const a = performance.now(); renderWorld(ctx, { selection: new Set() }); drawOverlays(ctx); ts.push(performance.now() - a); R.time += 1 / 60; }
      out['z' + z] = +(ts.reduce((a, b) => a + b, 0) / N).toFixed(2);
    }
    return out;
  });
  const live = await page.evaluate(async () => {
    const g = __game, W = g.W, tc = W.list.find(e => e.type === 'tc' && e.owner === W.humanId), out = {};
    for (const z of [1, 0.55]) {
      g.R.cam.zoom = z; g.centerCamOn(tc.x + 2, tc.y + 2); g.UI.paused = false; g.UI.focusPaused = false;
      await new Promise(r => setTimeout(r, 1500));
      let frames = 0, worst = 0, last = performance.now(); const t0 = performance.now();
      await new Promise(r => { const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++; if (now - t0 < 5000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
      out['z' + z] = { fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1), worstMs: +worst.toFixed(0) };
    }
    g.UI.paused = true;
    return out;
  });
  const pan = await page.evaluate(() => {
    const g = __game, R = g.R, W = g.W, ctx = R.ctx, n = W.n, step = Math.max(8, Math.round(n / 10));
    R.cam.zoom = 0.55; invalidateTerrain();
    let worst = 0;
    for (let y = 0; y <= n; y += step) for (let x = 0; x <= n; x += step) { g.centerCamOn(x, y); const a = performance.now(); renderWorld(ctx, { selection: new Set() }); worst = Math.max(worst, performance.now() - a); }
    let bytes = 0; for (const c of R.chunks.values()) bytes += c.cv.width * c.cv.height * 4;
    return { chunks: R.chunks.size, cacheMB: +(bytes / 1048576).toFixed(0), worstFrameMs: +worst.toFixed(0) };
  });
  return { steady, live, pan };
}
// 2.5D (evaluation T3): live fps of the three.js renderer.
async function measure25d(page, n) {
  return page.evaluate(async cfg => {
    const g = __game, t = g.T25D;
    if (!t.renderer) return { error: 'no 2.5D renderer: ' + t.error };
    g.launchFromSetup(cfg); g.UI.paused = false; g.UI.focusPaused = false;
    await new Promise(r => setTimeout(r, 1500));
    let frames = 0, worst = 0, last = performance.now(); const t0 = performance.now();
    await new Promise(r => { const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++; if (now - t0 < 4000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    g.UI.paused = true;
    return { fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1), worstMs: +worst.toFixed(0) };
  }, setup(n, 3, 'coastal', 7, 0, 'standard'));
}

for (const n of SIZES) {
  test(`performance at ${n}×${n}`, async ({ page }) => {
    test.setTimeout(20 * 60 * 1000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const rec = { n, renderer: test.info().project.name };
    await openGame(page); await prepareSize(page, n);
    rec.gen = await measureGen(page, n);
    rec.sim3 = await measureSim(page, n, 3, 'coastal');
    await openGame(page); await prepareSize(page, n);
    rec.sim8 = await measureSim(page, n, 8, 'land');
    rec.knights3 = await measureKnightRuns(page, n, 3, 'coastal');
    rec.knights8 = await measureKnightRuns(page, n, 8, 'land');
    rec.knights3w = await measureKnightRuns(page, n, 3, 'coastal', 600);
    rec.knights8w = await measureKnightRuns(page, n, 8, 'land', 600);
    await openGame(page); await prepareSize(page, n);
    rec.autosave = await measureAutosave(page, n);
    await openGame(page); await prepareSize(page, n);
    rec.render2d = await measure2d(page, n);
    await openGame(page, '?renderer=three');
    await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 || !!window.__game?.T25D.error, null, { timeout: 60000 }).catch(() => {});
    await prepareSize(page, n);
    rec.render25d = await measure25d(page, n);
    rec.errors = errors.slice(0, 5);
    expect(errors).toEqual([]);
    expect(rec.sim3.tick.n).toBe(TICKS);
    expect(rec.sim8.tick.n).toBe(TICKS);
    results.push(rec);   // only a run whose assertions all passed is recorded
  });
}

test.afterAll(() => {
  if (results.length !== SIZES.length) return;   // a failed or skipped size means nothing is written
  let commit = 'unknown'; try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch (e) { }
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({ date, label: LABEL, commit, ticks: TICKS, results }, null, 1));
  if (!fs.existsSync(MD_OUT)) fs.writeFileSync(MD_OUT, MD_HEAD);
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.knights3.ms} / ${r.knights8.ms}; ${r.knights3w.ms} / ${r.knights8w.ms} (${Math.min(r.knights3.ok, r.knights3w.ok)}/40, ${Math.min(r.knights8.ok, r.knights8w.ok)}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}; ${r.autosave.snapMs} / ${r.autosave.maxSlice} / ${r.autosave.maxTick}) | ${r.render2d.pan.cacheMB} |`);
  fs.appendFileSync(MD_OUT, rows.join('\n') + '\n');
});
