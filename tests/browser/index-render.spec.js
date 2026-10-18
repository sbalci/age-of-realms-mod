// Rendering, hit-testing and the minimap through the entity index draw and pick exactly what the old W.list scans did.
// IDX.brute = true makes every index-backed loop scan W.list again: that is the old code path, used as the reference.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/game/');
  await page.waitForFunction(() => !!window.__game?.W);
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));

// A small 2-player match, paused and fully explored, where the human remembers enemy buildings it no longer sees
// (fog-memory ghosts). Fog fade and clouds are switched off so two frames of the same state are pixel-identical.
async function startWithGhosts(page) {
  await page.evaluate(() => {
    const g = __game;
    g.launchFromSetup({ name: 'Player', color: 0, civ: 'franks', mapType: 'land', customMap: '', size: 'small', opponents: 1, oppCivs: [], difficulty: 'standard', teams: 'ffa', startAge: 1, startRes: 'high', fog: 'normal', speed: '1', seed: 12, cheats: true, tips: false });
    g.UI.paused = true;
    for (let i = 0; i < 400; i++) worldTick(0.05);
    const W = g.W, h = W.players[W.humanId];
    for (const b of W.list) if (b.kind === 'bld' && b.owner !== W.humanId) { const c = center(b); h.visible[(c.y | 0) * W.n + (c.x | 0)] = 1; }
    vicMemUpdate(h); updateVisibility(true); h.explored.fill(1);
    FX.on.fogfade = false; FX.on.clouds = false;
  });
}

test('the 2D view draws the same entities in the same order, pixel for pixel, and picks the same entity', async ({ page }) => {
  await startWithGhosts(page);
  const r = await page.evaluate(() => {
    const g = __game, W = g.W, R = g.R, ctx = R.ctx, rnd = mulberry32(3);
    const names = ['drawBuilding', 'drawUnit', 'drawRes', 'drawRelic'], saved = {}, seq = [];
    for (const k of names) { saved[k] = window[k]; window[k] = function (c, e) { seq.push((e.ghost ? 'ghost:' : '') + e.kind + ':' + e.id); return saved[k].apply(this, arguments); }; }
    const frame = () => { seq.length = 0; renderWorld(ctx, { selection: new Set() }); const d = ctx.getImageData(0, 0, R.cv.width, R.cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return { seq: seq.join(','), pix: h }; };
    const out = { cams: 0, sameSeq: 0, stable: 0, samePix: 0, drawn: 0, ghosts: 0, picks: 0, samePick: 0, hits: 0 };
    // the occlusion silhouettes redraw trees and buildings within a 1.5 ms budget: lift it so each frame draws them all
    const silMs = UHD.silMs; UHD.silMs = 1e9;
    try {
      renderWorld(ctx, { selection: new Set() });   // warm sprite caches
      for (let k = 0; k < 50; k++) {
        R.cam.zoom = 0.55 + rnd() * 1.25; g.centerCamOn(rnd() * W.n, rnd() * W.n);
        frame();   // a first frame at a new view fills sprite caches, which draws some sprites off-screen
        // old path, index, old path again: a few effects follow the wall clock (dashed order lines), so pixels are
        // compared only where the two old-path frames agree with each other
        IDX.brute = true; const a = frame(); IDX.brute = false; const b = frame(); IDX.brute = true; const a2 = frame(); IDX.brute = false;
        out.cams++; if (a.seq === b.seq && a.seq === a2.seq) out.sameSeq++;
        if (a.pix === a2.pix) { out.stable++; if (b.pix === a.pix) out.samePix++; }
        out.drawn += a.seq ? a.seq.split(',').length : 0; out.ghosts += (a.seq.match(/ghost:/g) || []).length;
        // aim at entities on screen, from their foot up to the top of tall building art, plus random points
        const shown = W.list.filter(e => !(e.kind === 'unit' && e.inside)).map(e => { const c = center(e); return g.toScreen(c.x, c.y, W.map.h(c.x, c.y)); }).filter(p => p.x > 0 && p.y > 0 && p.x < R.cw && p.y < R.ch);
        const points = [];
        for (let q = 0; q < 15 && shown.length; q++) { const p = shown[(rnd() * shown.length) | 0]; points.push([p.x + (rnd() - 0.5) * 30 * R.cam.zoom, p.y - rnd() * 140 * R.cam.zoom]); }
        for (let q = 0; q < 15; q++) points.push([rnd() * R.cw, rnd() * R.ch]);
        for (const [sx, sy] of points) {
          IDX.brute = true; const pa = g.hitTest(sx, sy); IDX.brute = false; const pb = g.hitTest(sx, sy);
          out.picks++; if (pa === pb) out.samePick++; if (pa) out.hits++;
        }
      }
    } finally { for (const k of names) window[k] = saved[k]; IDX.brute = false; UHD.silMs = silMs; }
    return out;
  });
  expect(r.cams).toBe(50);
  expect(r.sameSeq).toBe(50);
  expect(r.stable).toBeGreaterThanOrEqual(40);
  expect(r.samePix).toBe(r.stable);
  expect(r.samePick).toBe(r.picks);
  expect(r.ghosts).toBeGreaterThan(0);
  expect(r.hits).toBeGreaterThan(100);
});

test('the minimap paints trees from a cached layer and every other entity as before', async ({ page }) => {
  await startWithGhosts(page);
  const r = await page.evaluate(() => {
    const g = __game, W = g.W, cv = document.querySelector('#minimap'), mg = cv.getContext('2d'), fill = mg.fillRect;
    let rects = 0; mg.fillRect = function () { rects++; return fill.apply(this, arguments); };
    const h = W.players[W.humanId], explTrees = () => [...idxAll('res:tree')].filter(e => h.explored[e.y * W.n + e.x]).length;
    const count = brute => { IDX.brute = brute; rects = 0; renderMinimap(cv); IDX.brute = false; return rects; };
    const out = {};
    try {
      out.oldRects = count(true); out.newRects = count(false); out.trees = explTrees();
      const layer = mmTreeLayer(h.explored), d = layer.getContext('2d').getImageData(0, 0, W.n, W.n).data;
      let painted = 0, wrong = 0;
      for (let i = 0; i < W.n * W.n; i++) if (d[i * 4 + 3]) painted++;
      for (const e of idxAll('res:tree')) if (!!d[(e.y * W.n + e.x) * 4 + 3] !== !!h.explored[e.y * W.n + e.x]) wrong++;
      out.painted = painted; out.wrong = wrong;
      const t = [...idxAll('res:tree')].find(e => h.explored[e.y * W.n + e.x]); const ti = (t.y * W.n + t.x) * 4;
      removeEnt(t); renderMinimap(cv);
      out.cleared = MM.trees.getContext('2d').getImageData(0, 0, W.n, W.n).data[ti + 3] === 0;
      MM.filter = 'mil'; let built = 0; const keep = mmTreeLayer; mmTreeLayer = function () { built++; return keep.apply(this, arguments); };
      renderMinimap(cv); mmTreeLayer = keep; MM.filter = 'all'; out.milLayer = built;
    } finally { mg.fillRect = fill; IDX.brute = false; }
    return out;
  });
  // the old pass drew one rectangle per explored tree; the new pass draws exactly the others
  expect(r.oldRects - r.newRects).toBe(r.trees);
  expect(r.painted).toBe(r.trees);
  expect(r.wrong).toBe(0);
  expect(r.cleared).toBe(true);
  expect(r.milLayer).toBe(0);
});

test('2.5D places the same entities with the index', async ({ page }) => {
  await page.goto('/game/?renderer=three');
  await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 || !!window.__game?.T25D.error, null, { timeout: 60000 });
  test.skip(await page.evaluate(() => !__game.T25D.renderer), 'no WebGL renderer in this browser');
  await startWithGhosts(page);
  const r = await page.evaluate(() => {
    const g = __game, W = g.W, R = g.R, t = g.T25D, rnd = mulberry32(8);
    // syncEntities only places entities whose centre falls in this screen window
    const placed = list => list.filter(e => { const c = center(e), s = g.toScreen(c.x, c.y, 0); return !(s.x < -220 || s.x > R.cw + 220 || s.y < -150 || s.y > R.ch + 260); }).map(e => (e.ghost ? 'ghost:' : '') + e.id).join(',');
    const out = { cams: 0, same: 0, ghosts: 0, placed: 0 };
    try {
      for (let k = 0; k < 20; k++) {
        R.cam.zoom = 0.55 + rnd() * 1.25; g.centerCamOn(rnd() * W.n, rnd() * W.n);
        IDX.brute = true; const a = placed(t.visibleEntities({ selection: new Set() })); IDX.brute = false; const b = placed(t.visibleEntities({ selection: new Set() }));
        out.cams++; if (a === b) out.same++; out.ghosts += (a.match(/ghost:/g) || []).length; out.placed += a ? a.split(',').length : 0;
      }
    } finally { IDX.brute = false; }
    return out;
  });
  expect(r.same).toBe(r.cams);
  expect(r.placed).toBeGreaterThan(0);
});
