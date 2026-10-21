// Saves and maps in the browser: IndexedDB through store.js, the save slots, the sliced autosave, gzip export and
// import, the editor's maps, and the move of old localStorage saves and maps into IndexedDB.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/game/');
  await page.waitForFunction(() => !!window.__game?.W);
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));
const reload = async page => { await page.reload(); await page.waitForFunction(() => !!window.__game?.W); };

test('Store keeps saves, maps and meta in IndexedDB across a reload', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const big = 'x'.repeat(6 * 1024 * 1024);   // more than the whole localStorage quota
    await Store.put('saves', '5', big); await Store.put('maps', 'Probe', { n: 16, ter: [1, 2] }); await Store.put('meta', 'probe', { a: 1 });
    return Store.mode;
  })).toBe('idb');
  await reload(page);
  expect(await page.evaluate(async () => {
    const v = await Store.get('saves', '5'), out = { len: v.length, map: await Store.get('maps', 'Probe'), meta: (await Store.keys('meta')).includes('probe') };
    await Store.del('saves', '5'); await Store.del('maps', 'Probe'); await Store.del('meta', 'probe');
    return out;
  })).toEqual({ len: 6291456, map: { n: 16, ter: [1, 2] }, meta: true });
});

// the perf spec's cap patch: sides above 256 stay blocked by validateMapSpec until phase 8
const CAP_PATCH = `(() => { const src = validateMapSpec.toString(), patched = src.replace('n > 256', 'n > 1024');
  if (patched === src) throw new Error("validateMapSpec no longer contains 'n > 256'"); validateMapSpec = eval('(' + patched + ')'); })();`;
const setup = (n, np, type) => ({ name: 'Player', color: 0, civ: 'franks', mapType: type, customMap: '', size: 'x' + n, opponents: np - 1, oppCivs: [], difficulty: 'standard', teams: 'ffa', startAge: 1, startRes: 'high', fog: 'normal', speed: '1', seed: 33, cheats: true, tips: false });

test('Export Match writes a gzip file that Load Match imports back', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 2468; });
  await page.locator('#b-menu').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Match', exact: true }).click()]);
  expect(download.suggestedFilename()).toBe('age-of-realms-match.json.gz');
  const file = await download.path(), bytes = fs.readFileSync(file);
  expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
  expect(JSON.parse(zlib.gunzipSync(bytes).toString()).version).toBe(2);
  await page.evaluate(() => { __game.W.players[1].res.gold = 1; });
  await page.getByRole('button', { name: 'Load Match', exact: true }).click();
  await page.locator('#match-file').setInputFiles({ name: 'age-of-realms-match.json.gz', mimeType: 'application/gzip', buffer: bytes });
  await expect(page.locator('#modal')).not.toBeVisible();
  expect(await page.evaluate(() => __game.W.players[1].res.gold)).toBe(2468);
});

test('the autosave of a live 256 x 256 match takes its snapshot in at most 8 ms, then writes that moment in slices of at most 8 ms while the match plays on', async ({ page }) => {
  test.setTimeout(180000);
  await page.evaluate(n => { MAP_SIZES['x' + n] = n; }, 256);
  const r = await page.evaluate(async cfg => {
    const g = __game; g.launchFromSetup(cfg); let W = g.W;
    for (const p of W.players.slice(1)) p.ai = p.ai || new AIPlayer(p, 'standard');
    W.spectate = true; W.nextAutosave = 1e9; g.UI.paused = false; g.UI.focusPaused = false;
    await new Promise(r => setTimeout(r, 2000));
    const ticks = [], wt = worldTick, runs = [];
    worldTick = function () { const t = performance.now(); const r = wt.apply(this, arguments); ticks.push(performance.now() - t); return r; };
    // one autosave; hold: the longest task it ran but the snapshot (a slice, a rehearsal task, the join or the write)
    const once = async () => {
      W.nextAutosave = W.t;
      await new Promise(r => { const f = () => (MatchSave.busy || W.nextAutosave === W.t ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
      const s = MatchSave.stats; runs.push({ snapMs: s.snapMs, hold: Math.max(...s.slices), slices: s.slices.length, rehearseMs: s.rehearseMs, tailMs: s.tailMs, putMs: s.putMs, ticked: W.tick - s.tick });   // ticks played after the snapshot
      await new Promise(r => setTimeout(r, 1000));
    };
    // the last autosave of the started match is checked against the one-shot save of its snapshot's moment
    const sliced = MatchSave.serializeSliced;
    for (let k = 0; k < 5; k++) {
      if (k === 4) MatchSave.serializeSliced = function () { globalThis.__sync = MatchSave.serialize(); MatchSave.serializeSliced = sliced; return sliced.apply(this, arguments); };
      await once();
    }
    const text = await Store.get('saves', 'auto'); let parsed = '';
    try { MatchSave.parse(text); parsed = 'ok'; } catch (e) { parsed = e.message; }
    const same = JSON.stringify(JSON.parse(text).graph) === JSON.stringify(JSON.parse(__sync).graph);
    // then a load: the first autosave of the loaded match (new layers, so no spare copies yet) is held to 8 ms as well
    MatchSave.resume(text); W = g.W; W.nextAutosave = 1e9; g.UI.focusPaused = false;
    await new Promise(r => setTimeout(r, 2000));
    await once();
    worldTick = wt;
    return { runs, maxTick: +Math.max(...ticks).toFixed(1), parsed, same, chars: text.length };
  }, setup(256, 3, 'coastal'));
  const started = r.runs.slice(0, 5), loaded = r.runs[5];
  const snap = started.map(x => x.snapMs).sort((a, b) => a - b)[2], hold = Math.max(...r.runs.map(x => x.hold));
  console.log(JSON.stringify({ snapMs: started.map(x => x.snapMs), medianSnap: snap, firstSnap: started[0].snapMs, afterLoad: loaded.snapMs, hold, holds: r.runs.map(x => x.hold), rehearse: r.runs.map(x => x.rehearseMs), tail: r.runs.map(x => x.tailMs), put: r.runs.map(x => x.putMs), slices: r.runs.map(x => x.slices), ticked: r.runs.map(x => x.ticked), maxTick: r.maxTick, chars: r.chars }));
  expect(r.parsed).toBe('ok');
  expect(r.same).toBe(true);
  expect(Math.min(...r.runs.map(x => x.ticked))).toBeGreaterThan(0);   // the match played on while the text was built
  expect(snap).toBeLessThanOrEqual(8);
  expect(started[0].snapMs).toBeLessThanOrEqual(8);   // the first snapshot after the start
  expect(loaded.snapMs).toBeLessThanOrEqual(8);       // and after a load
  expect(hold).toBeLessThanOrEqual(8);                // every slice, rehearsal task, join and write
  expect(r.maxTick).toBeLessThanOrEqual(16);
});

test('a 480 x 480 save with 8 players round trips through IndexedDB across a reload', async ({ page }) => {
  test.setTimeout(180000);
  await page.evaluate(CAP_PATCH); await page.evaluate(n => { MAP_SIZES['x' + n] = n; }, 480);
  const a = await page.evaluate(async cfg => {
    const g = __game; g.launchFromSetup(cfg); g.UI.paused = true;
    for (let i = 0; i < 200; i++) worldTick(0.05);
    const text = MatchSave.serialize(); await MatchSave.saveTo('2', text);
    return { chars: text.length, n: g.W.n, ents: g.W.list.length, t: g.W.t, gold: g.W.players[1].res.gold };
  }, setup(480, 8, 'land'));
  expect(a.n).toBe(480);
  expect(a.chars).toBeLessThanOrEqual(6 * 1048576);
  await reload(page);
  await page.evaluate(CAP_PATCH);
  const b = await page.evaluate(async () => { const text = await MatchSave.loadFrom('2'); MatchSave.resume(text); __game.UI.paused = true; const W = __game.W; return { n: W.n, ents: W.list.length, t: W.t, gold: W.players[1].res.gold, slot: MatchSave.slotLabel('2', (await MatchSave.slotInfos())['2']).startsWith('Slot 2 · Franks') }; });
  expect(b).toEqual({ n: 480, ents: a.ents, t: a.t, gold: a.gold, slot: true });
});
