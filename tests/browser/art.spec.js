const { test, expect } = require('@playwright/test');

const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && KART.booted && Object.keys(KART.img).length + KART.failed.length === KART.requested.size);

test('CC0 art is the default and renders harvest stages without changing the match', async ({ page }) => {
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:8765/')) external.push(r.url()); });
  await page.goto('/game/');
  await waitForArt(page);
  expect(await page.evaluate(() => KART.failed)).toEqual([]);
  await expect(page.locator('#btn-art')).toHaveText('Classic Art');
  await page.locator('#btn-tutorial').click();
  const result = await page.evaluate(() => {
    const g = __game; g.UI.paused = true;
    const cv = document.createElement('canvas'); cv.width = 600; cv.height = 500;
    const ctx = cv.getContext('2d'), p = g.W.players[1];
    const before = JSON.stringify(g.MatchSave.snapshot().graph), mute = FX.mute;
    FX.mute = 'all';
    try {
      for (const type of ['gold', 'stone', 'berry', 'shrub', 'tree']) for (const id of [2, 3]) {
        drawRes(ctx, { id, type, x: 1, y: 1, amount: 50, max: 100, v: 0, felled: type === 'tree', fallDir: id === 2 ? -1 : 1 });
      }
      const stages = [];
      for (const frac of [0.1, 0.4, 1]) {
        ctx.clearRect(0, 0, cv.width, cv.height);
        drawFarm(ctx, { built: true, food: p.farmFood * frac, owner: 1 }, { x: 300, y: 300 });
        stages.push(cv.toDataURL());
      }
      const tc = g.W.list.find(e => e.type === 'tc' && e.owner === 1);
      const mill = { ...tc, type: 'mill', built: true, hp: tc.maxhp, relics: [] };
      ctx.clearRect(0, 0, cv.width, cv.height);
      const c = center(mill), gp = iso(c.x, c.y, g.W.map.h(c.x, c.y));
      ctx.translate(300 - gp.x, 300 - gp.y);
      drawBuilding(ctx, mill, 0.25);
      const pixels = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let alpha = 0; for (let i = 3; i < pixels.length; i += 4) alpha = Math.max(alpha, pixels[i]);
      return {
        unchanged: before === JSON.stringify(g.MatchSave.snapshot().graph),
        stages: new Set(stages).size, alpha, millType: mill.type,
        staticSails: bldSprite('mill', 0, p.color).staticSails,
        cached: ['berry_0|2', 'berry_1|2', 'shrub_0|0', 'shrub_1|0', 'felled_0|0', 'felled_1|0', 'farm_0', 'farm_1', 'farm_2'].every(k => KART.cache.has(k)),
      };
    } finally { FX.mute = mute; }
  });
  expect(result).toMatchObject({ unchanged: true, stages: 3, millType: 'mill', staticSails: true, cached: true });
  expect(result.alpha).toBeGreaterThan(0); expect(result.alpha).toBeLessThanOrEqual(65);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('classic art choice persists and invalid URL values do not overwrite it', async ({ page }) => {
  await page.goto('/game/');
  await Promise.all([page.waitForURL('**/game/?art=classic'), page.locator('#btn-art').click()]);
  await expect(page.locator('#btn-art')).toHaveText('Kenney Art');
  expect(await page.evaluate(() => KART.on)).toBe(false);
  await page.goto('/game/?art=invalid');
  expect(await page.evaluate(() => [KART.on, localStorage.getItem('aor.art')])).toEqual([false, 'classic']);
  await Promise.all([page.waitForURL('**/game/?art=kenney'), page.locator('#btn-art').click()]);
  await waitForArt(page);
  expect(await page.evaluate(() => localStorage.getItem('aor.art'))).toBe('kenney');
});

test('missing sprites fall back to drawn art and play remains available', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/art/kenney/tc_*.png', route => route.abort());
  await page.route('**/art/kenney/farm_*.png', route => route.abort());
  await page.goto('/game/'); await waitForArt(page);
  expect(await page.evaluate(() => KART.failed.filter(k => kartCiv(k) === null).length)).toBe(await page.evaluate(() => Object.keys(KENNEY_ART).filter(k => /^(tc|farm)_/.test(k) && kartCiv(k) === null).length));
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => {
    const p = W.players[1], fallback = bldSprite('tc', p.age, p.color);
    return fallback.cv.width > 0 && !kartKey('tc', p.age);
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('2.5D refreshes cached resource art after a delayed sprite arrives', async ({ page }) => {
  test.setTimeout(90000);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/art/kenney/berry_0.png', async route => { await held; await route.continue(); });
  await page.goto('/game/?renderer=three', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 && KART.booted && Object.keys(KART.img).length === KART.requested.size - 1);
    await page.locator('#btn-tutorial').click();
    await page.evaluate(() => {
      __game.UI.paused = true;
      window.artProbe = { id: 2001, kind: 'res', type: 'berry', x: 5, y: 5, amount: 100, max: 100 };
      window.oldArt = __game.T25D.asset(artProbe);
    });
    release(); await waitForArt(page);
    expect(await page.evaluate(() => __game.T25D.asset(artProbe) !== oldArt)).toBe(true);
  } finally { release(); }
});

// Renders one building sprite from scratch and reports which baked sprite it used and how many painted domes it drew.
const drawProbe = () => {
  window.drawProbe = (type, st, civ) => {
    const real = vicDome; let domes = 0;
    vicDome = (...a) => { domes++; return real(...a); };
    try {
      KART.cache.clear();
      bldSprite(type, st, W.players[1].color, civ);
      return { names: [...KART.cache.keys()].map(k => k.split('|')[0]), domes };
    } finally { vicDome = real; KART.cache.clear(); }
  };
};

test('Turks and Saracens use their own building sprites without the painted crown', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('tc', 2, 'turks'),
    turks5: drawProbe('tc', 5, 'turks'),
    saracens5: drawProbe('tc', 5, 'saracens'),
    franks2: drawProbe('tc', 2, 'franks'),
    turksMonastery1: drawProbe('monastery', 1, 'turks'),
  }));
  expect(r.turks2).toEqual({ names: ['tc_turks_2'], domes: 0 });
  expect(r.turks5.names).toEqual(['tc_turks_5']);    // the Turks' own Republican Town Center
  expect(r.saracens5.names).toEqual(['tc_5']);        // the shared Future Town Center outranks a medieval civ sprite
  expect(r.franks2.names).toEqual(['tc_2']);
  expect(r.turksMonastery1.names).toEqual(['monastery_1']);
  expect(r.turksMonastery1.domes).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a missing civ sprite falls back to the shared sprite and its painted crown', async ({ page }) => {
  await page.route('**/art/kenney/tc_turks_*.png', route => route.abort());
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => KART.loadCiv('turks'));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => drawProbe('tc', 2, 'turks'));
  expect(r.names).toEqual(['tc_2']);
  expect(r.domes).toBeGreaterThan(0);
});

test('civilization building sprites load on demand and refresh caches at most once per frame', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  const r = await page.evaluate(async () => {
    const turks = Object.keys(KENNEY_ART).filter(k => kartCiv(k) === 'turks');
    const before = turks.filter(k => KART.requested.has(k)).length;
    const clear = R.spriteCache.clear.bind(R.spriteCache);
    let clears = 0;
    R.spriteCache.clear = () => { clears++; return clear(); };
    try {
      const first = KART.loadCiv('turks'), again = KART.loadCiv('turks');
      await first;
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return {
        total: turks.length, before, same: first === again, loaded: turks.filter(k => KART.img[k]).length, clears,
        shared: kartCiv('tree_anatolian_0'), civ: kartCiv('castle_turks_2'),
      };
    } finally { delete R.spriteCache.clear; }
  });
  expect(r.total).toBeGreaterThan(0);
  expect(r.before).toBe(0);              // nothing of the Turks set is fetched at startup
  expect(r.same).toBe(true);
  expect(r.loaded).toBe(r.total);
  expect(r.clears).toBeGreaterThan(0);
  expect(r.clears).toBeLessThan(r.total); // one cache refresh per frame, not per image
  expect(r.shared).toBeNull();
  expect(r.civ).toBe('turks');
  expect(errors).toEqual([]);
});

test('a civilization with its own castle draws it before its family castle', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all(['turks', 'saracens', 'byzantines', 'franks'].map(civ => KART.loadCiv(civ))));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('castle', 2, 'turks'), turks3: drawProbe('castle', 3, 'turks'), turks4: drawProbe('castle', 4, 'turks'),
    saracens2: drawProbe('castle', 2, 'saracens'), byzantines2: drawProbe('castle', 2, 'byzantines'), franks2: drawProbe('castle', 2, 'franks'),
  }));
  expect(r.turks2).toEqual({ names: ['castle_turks_2'], domes: 0 });
  expect(r.turks3.names).toEqual(['castle_turks_2']);
  expect(r.turks4.names).toEqual(['castle_turks_4']);
  expect(r.saracens2.names).toEqual(['castle_med']);
  expect(r.byzantines2.names).toEqual(['castle_med']);
  expect(r.franks2.names).toEqual(['castle']);
  expect(errors).toEqual([]);
});

test('civ sprites baked for the Modern or Future age skip the painted era add-ons', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  const r = await page.evaluate(() => {
    const real = drawCivBuildingOverlay, seen = [];
    drawCivBuildingOverlay = (...a) => { seen.push(a[6]); return real(...a); };
    const probe = (type, st, civ) => {
      KART.cache.clear(); seen.length = 0;
      bldSprite(type, st, W.players[1].color, civ);
      return { names: [...KART.cache.keys()].map(k => k.split('|')[0]), opts: seen[0] };
    };
    // the era option really removes section 4: the same overlay call draws fewer rectangles with era: false
    const rects = opts => {
      const g = document.createElement('canvas').getContext('2d'), fill = g.fillRect.bind(g);
      let n = 0;
      g.fillRect = (...a) => { n++; return fill(...a); };
      real(g, 'house', 4, W.players[1].color, 'turks', true, opts);
      return n;
    };
    try {
      return {
        turks4: probe('house', 4, 'turks'), turks5: probe('tc', 5, 'turks'), saracens4: probe('house', 4, 'saracens'),
        withEra: rects({ crown: false }), withoutEra: rects({ crown: false, era: false }),
      };
    } finally { drawCivBuildingOverlay = real; KART.cache.clear(); }
  });
  expect(r.turks4).toEqual({ names: ['house_turks_4'], opts: { crown: false, era: false } });
  expect(r.turks5).toEqual({ names: ['tc_turks_5'], opts: { crown: false, era: false } });
  expect(r.saracens4).toEqual({ names: ['house_saracens_3'], opts: { crown: false, era: true } });
  expect(r.withoutEra).toBeLessThan(r.withEra);
  expect(errors).toEqual([]);
});
