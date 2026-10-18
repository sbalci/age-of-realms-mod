# Bigger Maps — Phases 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two broken tests, record a performance baseline, and remove the whole-`W.list` scans and the synchronised AI hitch that make big maps slow, without changing any match outcome except the deliberate AI stagger.
**Architecture:** Phase 1 repairs `tests/command.test.js`, fixes the AI Assist panel that made a browser test flaky, and adds an on-demand Playwright performance spec (`npm run test:perf`) that writes `docs/maps-perf-baseline.md`. Phase 2 adds `game/js/index.js`, a spatial and per-owner entity index kept in step with `W.list` by `addEnt`, `removeEnt`, owner changes and a per-tick unit sync; every query returns entities in `W.list` order so the rewritten call sites give identical answers. The AI, resource searches, rendering, hit-testing and the minimap then query the index, and each AI player's once-a-second update runs on its own tick.
**Tech Stack:** plain browser JS (`game/js/*.js`, loaded in order by `game/index.html`), Node 22 vm tests (`tests/*.test.js`, `tests/engine-harness.js`, collected by `tests/run-all.js`), Playwright 1.64.1 with Chromium 1248 (`tests/browser/*.spec.js`).

## Global Constraints

- Free and open source only. Every tool and library is free; no paid APIs.
- Prefix `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright` on every Playwright command. Never set it user-wide (`setx`).
- The full browser suite rewrites `assets/screenshots/`. Restore it afterwards with `git checkout -- assets/screenshots`.
- Generation stays deterministic per seed. Fixed-seed snapshots change only in phase 7 and phase 8, and those changes are deliberate.
- No phase may regress today's sizes: `npm test` and the default browser suite stay green at 80–200 throughout.
- v1 saves and v1 exports keep loading for good.
- Unit speeds and combat stats do not change.
- Home bases keep today's resource rings and radii (map.js:544-567, 466-536).
- **Budgets** (on the RTX A4000 reference machine; SwiftShader is recorded as the low-end check):

  | Measure | Budget |
  |---|---|
  | Simulation tick, 480, 8 AI | mean ≤ 8 ms, p99 ≤ 33 ms |
  | 40-unit cross-map order | ≤ 16 ms, every route reaches its goal |
  | 2D frame rate at 480 | ≥ 50 fps |
  | 2.5D frame rate at 480 | ≥ 50 fps |
  | Terrain-cache canvas memory | ≤ 600 MB |

- Every commit message ends with the committing agent's own `Co-Authored-By:` line.

---

## File Structure

| File | Task | Change | Responsibility |
|---|---|---|---|
| `tests/command.test.js` | 1, 4 | Modify | Arena widened from 44 to 48 tiles; loads `index.js` |
| `game/js/assist.js` | 2 | Modify | AI Assist panel row and Return to AI button reused across refreshes |
| `tests/browser/assist.spec.js` | 2 | Modify | Regression test: the button stays the same element |
| `tests/browser/maps-perf.spec.js` | 3 | Create | Browser performance measurements; writes the JSON and the baseline rows |
| `playwright.perf.config.js` | 3 | Create | Perf config: `gpu` (new headless, real GPU) and `swiftshader` projects |
| `playwright.config.js` | 3 | Modify | Default browser run ignores the perf spec |
| `package.json` | 3 | Modify | `npm run test:perf` |
| `docs/maps-perf-baseline.md` | 3, 9 | Create, append | Phase 1 baseline rows, then the phase 2 rows and the vm table |
| `game/js/index.js` | 4 | Create | Entity index: cell buckets per category, category lists, per-owner lists, queries |
| `game/index.html` | 4 | Modify | Loads `index.js` right after `world.js` |
| `game/js/world.js` | 4, 5 | Modify | `addEnt`/`removeEnt` hooks, `rebuildGrid` from the index, owner changes through `idxSetOwner`; resource and drop-site searches through the index |
| `game/js/command.js` | 4 | Modify | Resign hands sheep to gaia through `idxSetOwner` |
| `game/js/editor.js` | 4 | Modify | Dragged entities are refiled (`idxMoved`) |
| `tests/index.test.js` | 4 | Create | Property test: buckets equal a brute-force scan after 10 game minutes |
| `tests/sim-signature.test.js` | 4, 7 | Create | Golden fixed-seed match signatures (recorded before the index; re-recorded for the stagger) |
| `tests/fixtures/sim-signatures.json` | 4, 7 | Create, re-record | The recorded hashes |
| `tests/bridges-tunnels.test.js`, `tests/extras.test.js`, `tests/fx.test.js`, `tests/mortality.test.js`, `tests/movement.test.js`, `tests/terraform.test.js`, `tests/terrain.test.js`, `tests/units_hd.test.js`, `tests/victory.test.js`, `tests/water.test.js`, `tests/wells.test.js` | 4 | Modify | Their hand-written script lists load `index.js` after `world.js` |
| `tests/index-queries.test.js` | 5 | Create | `findNearestRes`, `nearestDrop`, `nearestOwn`, `builtCount`, `hasBuilt` against the old scans |
| `game/js/ai.js` | 6, 7 | Modify | AI queries through the index (named query methods); staggered update phase |
| `game/js/geology.js` | 6 | Modify | Seam, buried-deposit and coal searches through the index |
| `game/js/water.js` | 6 | Modify | Fish restocking iterates the fish list; unit-on-tile check through the index |
| `tests/index-ai.test.js` | 6 | Create | Each AI/geology/water query against its old scan; brute-force vs index match; AI time ratio |
| `tests/tactics.test.js` | 6 | Modify | A direct `owner` write becomes `idxSetOwner` |
| `tests/ai-stagger.test.js` | 7 | Create | No two of 8 AIs update on the same tick |
| `game/js/render.js` | 8 | Modify | `viewCandidates` for view culling; minimap tree layer and entity pass |
| `game/js/ui.js` | 8 | Modify | `hitCandidates` for `hitTest` |
| `game/js/victory.js` | 8 | Modify | Fog memory and ghosts iterate the building list |
| `game/js/renderer25d.js` | 8 | Modify | 2.5D `visibleEntities` takes candidates from the index |
| `tests/browser/index-render.spec.js` | 8 | Create | Old scan vs index: draw sequence, pixels, picks, minimap, 2.5D |
| `tests/perf-vm.js` | 9 | Create | On-demand vm tick comparison, W.list scans vs index, at 200 and 256 |

**Validated while planning.** Every task below was applied in a scratch git worktree of `feat/bigger-maps` (7e85bea) in this order, and the outputs quoted as "observed while planning" come from those runs (Windows 11, Node 22.17.1, Playwright 1.64.1, RTX A4000). Browser specs ran against the patched worktree through a temporary config that served it. A second clean checkout then replayed every node step from the blocks printed here: the quoted node outputs, hashes and totals came out the same (`Total: 352` after Task 4, `Total: 361` at the end), and the 39 files it produced equal the validated ones. Each "replace" block below was checked to occur exactly once in the current files, and each replacement text is the one that was run.

**Test runs.** `npm test` (`tests/run-all.js`) runs every `tests/*.test.js`, so the new suites run there; none joins the `--quick` set, because each new suite plays several game minutes (10–50 s). `tests/perf-vm.js` is not a `.test.js` file and runs only by hand. A full `npm test` took about 7 minutes on the planning machine after Task 8.

**Commits.** The commit messages below end with the trailer of the model that wrote this plan. An implementer running on another model puts its own `Co-Authored-By:` line there instead.

**Tie-breaking and determinism, in one place.** `W.list` is always in ascending id order: ids only grow (`newId`), entities are only appended (`addEnt`), and saves keep the order. Every index list is either insertion-ordered from `W.list` (the category `Set`s) or sorted by id (the owner lists, the query results), so it is in `W.list` order. Every rewritten site either keeps an order-dependent loop over such a list (first match, strict `<` running minimum, stable sort, `simRandom` draws per item), or is order-independent (`some`, counts, Sets), or breaks ties by the lowest id explicitly (`findNearestRes`). The golden signatures (Task 4) prove the match outcome does not move through Tasks 4–6 and 8.

---


### Task 1: Fix `tests/command.test.js`

The suite builds a medium land map and carves a flat 44 × 44 grass "arena" (tests/command.test.js:24, which is line 19 of the setup script inside `run(...)`). Since commit 1f7ab9f made all other land non-flat, the earlier sections use the arena up, `open(16,6)` at line 164 returns `null`, the file crashes, and its last 10 checks (stances, flee, resign, diagonal building damage, the 12-minute AI soak) never run. The game is right; the arena is too small. 48 is the smallest tried size that makes every section fit (see `.superpowers/maps/command-test-diagnosis.md`).

**Files:**
- Modify: `tests/command.test.js:24` (the arena IIFE)
- Test: `tests/command.test.js` itself

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. `npm test` has no failing suite from here on, which every later task relies on.

- [ ] **Step 1: Run the suite and watch it crash**

Run: `node tests/command.test.js`
Expected: FAIL. Fourteen `PASS` lines, the last one `PASS attack-move (AI attacks) breaches a walled camp`, then:
```
TypeError: Cannot read properties of null (reading 'x')
    at evalmachine.<anonymous>:3:35
```
and no `passed, failed` summary line (exit status 1).

- [ ] **Step 2: Widen the arena from 44 to 48 tiles**

In `tests/command.test.js`, replace:
```js
(function(){ const m=W.map, tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc'), A=44; let best=null, bd=-1;
```
with:
```js
(function(){ const m=W.map, tcs=W.list.filter(e=>e.kind==='bld'&&e.type==='tc'), A=48; let best=null, bd=-1;
```

- [ ] **Step 3: Run the suite again**

Run: `node tests/command.test.js`
Expected: PASS. The last two lines are:
```
PASS 12 min AI soak with all features: no exceptions or AI errors  {"err":null,"warns":[],"t":720,"kills":18,"missFx":0,"breaches":0,"rescued":0,"units":91}
24 passed, 0 failed
```

- [ ] **Step 4: Run every node suite**

Run: `npm test`
Expected: every suite prints a summary, `command.test.js              24 passed, 0 failed`, and the last line is `Total: 346 checks passed; 0 suites failed.` (Before this task it was `Total: 322 checks passed; 1 suites failed.`.) `tests/perf.test.js` is a timing test: on the reference machine its "8 players" check measures 1.03–1.08 against a budget of 1.1 even on unmodified code, so run it alone (`node tests/perf.test.js`) if it fails while other programs load the CPU.

- [ ] **Step 5: Commit**

```bash
git add tests/command.test.js
git commit -m "test(command): widen the flat arena to 48 tiles so every section runs

The 44-tile arena ran out of flat land before the stances section, so
the file crashed and its last 10 checks never ran.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Stabilise the flaky "shared control supports mouse selection…" browser test

**Root cause (found and reproduced while planning, on `feat/bigger-maps` 7e85bea):**
- The main loop calls `renderSelInfo()` every 0.25 s of frame time, paused or not (game/js/main.js:40-43).
- AI Assist's wrapper (game/js/assist.js:196-214) removes the `#assist-control` row and builds a new row and a new `#b-assist-return` button on every call. The button therefore lives at most 0.25 s.
- The default browser project is the headless shell with software rendering (SwiftShader). A paused frame of this tiny match takes about 35 ms there, so the button lives about 7 frames. Playwright's click needs "visible, enabled and stable" (two equal frames), a hit-target check and the click itself; that sequence keeps straddling a rebuild, so it ends with `element was detached from the DOM, retrying` until the 45 s timeout. The outcome depends on frame time, which is why the same commit passed on one day and failed on the next.
- Measurements (3 s windows, unmodified code): `#cmds` was never rebuilt (`renderCommands` ran 11 times, 0 rebuilds), so the command panel is not the cause; `#assist-control` was replaced 11 times; a trial click on `#b-assist-return` failed for 8 s even before `MatchSave.resume`; with `renderSelInfo` stubbed out the click landed in 377 ms; with `renderWorld` stubbed out (16.6 ms frames) it landed in 109 ms despite the rebuilds. The spec failed 4 of 6 repeats.
- Players are affected too: on a slow machine a real click can straddle a rebuild and be lost.

**Fix:** reuse the row, and its button, while its text is unchanged. A single selection rebuilds the panel's HTML every refresh, so the wrapper takes the row out before the rebuild and puts the same node back into the new panel within the same call. The button acts on the units selected when it is clicked.

**Files:**
- Modify: `game/js/assist.js:196-214` (the `renderSelInfo` wrapper)
- Test: `tests/browser/assist.spec.js` (new test after line 52)

**Interfaces:**
- Consumes: `renderSelInfo`, `assistOwn`, `assistReserved`, `assistReturn`, `renderCommands` (unchanged).
- Produces: `#assist-control` keeps its identity across refreshes and carries `data-label` with its text. No later task depends on it.

- [ ] **Step 1: Write the failing regression test**

In `tests/browser/assist.spec.js`, replace:
```js
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/ai-assist.png'});
});
```
with:
```js
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/ai-assist.png'});
});

test('the Return to AI button stays the same element while the panel refreshes', async ({ page }) => {
  await page.locator('#btn-sp').click();
  await page.locator('#s-opp').selectOption('1');
  await page.locator('#s-size').selectOption('tiny');
  await page.locator('#s-seed').fill('5');
  await page.locator('#s-assist').check();
  await page.locator('#s-start').click();
  await expect(page.locator('#b-assist')).toHaveText('AI Assist: On');
  // The main loop calls renderSelInfo four times a second, paused or not; a button rebuilt on every call
  // detaches before a click on a slow (software-rendered) frame rate can land on it.
  const same = await page.evaluate(() => {
    const g = __game; g.UI.paused = true;
    const vills = g.W.list.filter(e => e.owner === 1 && e.type === 'villager').slice(0, 3);
    const out = {};
    for (const n of [1, 3]) {
      for (const v of vills) v.assistControl = 'order';
      g.UI.selection = vills.slice(0, n);
      renderSelInfo();
      const first = document.querySelector('#b-assist-return');
      renderSelInfo(); renderSelInfo();
      out[n] = !!first && first.isConnected && document.querySelector('#b-assist-return') === first;
    }
    return out;
  });
  expect(same).toEqual({ 1: true, 3: true });
  await page.locator('#b-assist-return').click();
  await expect(page.locator('#assist-control')).toContainText('AI controls');
  expect(await page.evaluate(() => __game.UI.selection.every(u => !u.assistControl))).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/assist.spec.js -g "Return to AI button" --reporter=line`
Expected: FAIL at `expect(same).toEqual({ 1: true, 3: true })` with
```
-   "1": true,
-   "3": true,
+   "1": false,
+   "3": false,
```

- [ ] **Step 3: Keep the row while its text is unchanged**

In `game/js/assist.js`, replace:
```js
const assistPreviousSelInfo = renderSelInfo;
renderSelInfo = function () {
  assistPreviousSelInfo();
  const box = document.querySelector('#selinfo'); if (!box) return;
  const old = box.querySelector('#assist-control'); if (old) old.remove();
  if (!W.aiAssist || W.spectate) return;
  const units = UI.selection.filter(assistOwn); if (!units.length) return;
  const held = units.filter(assistReserved).length;
  const row = document.createElement('div'); row.id = 'assist-control'; row.className = 'small';
  const text = document.createElement('span');
  text.textContent = held ? `${held}/${units.length} under your control. ` : 'AI controls these units. Your commands take priority.';
  row.appendChild(text);
  if (held) {
    const button = document.createElement('button'); button.id = 'b-assist-return'; button.className = 'btn small'; button.textContent = 'Return to AI';
    button.onclick = () => { assistReturn(units); renderCommands(); renderSelInfo(); };
    row.appendChild(button);
  }
  (box.querySelector('.info') || box).appendChild(row);
};
```
with:
```js
const assistPreviousSelInfo = renderSelInfo;
// The main loop refreshes this panel four times a second, paused or not. The row and its Return to AI button are
// reused while their text is unchanged: a button rebuilt on every refresh lives only a few frames on a slow
// (software-rendered) frame rate, and a click keeps landing on a detached node.
renderSelInfo = function () {
  const box = document.querySelector('#selinfo');
  const kept = box && box.querySelector('#assist-control');
  assistPreviousSelInfo();
  if (!box) return;
  const units = W.aiAssist && !W.spectate ? UI.selection.filter(assistOwn) : [];
  const held = units.filter(assistReserved).length;
  const label = held ? `${held}/${units.length} under your control. ` : 'AI controls these units. Your commands take priority.';
  const parent = box.querySelector('.info') || box;
  // A single selection rebuilds the panel's HTML: the kept row is moved into the new panel within this same call.
  if (kept && units.length && kept.dataset.label === label) { if (kept.parentNode !== parent) parent.appendChild(kept); return; }
  if (kept) kept.remove();
  if (!units.length) return;
  const row = document.createElement('div'); row.id = 'assist-control'; row.className = 'small'; row.dataset.label = label;
  const text = document.createElement('span');
  text.textContent = label;
  row.appendChild(text);
  if (held) {
    const button = document.createElement('button'); button.id = 'b-assist-return'; button.className = 'btn small'; button.textContent = 'Return to AI';
    button.onclick = () => { assistReturn(UI.selection.filter(assistOwn)); renderCommands(); renderSelInfo(); };
    row.appendChild(button);
  }
  parent.appendChild(row);
};
```

- [ ] **Step 4: Run the new test again**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/assist.spec.js -g "Return to AI button" --reporter=line`
Expected: `1 passed`.

- [ ] **Step 5: Five consecutive passes of the whole assist spec**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/assist.spec.js --repeat-each=5 --reporter=line`
Expected: `20 passed` (4 tests × 5), about 3 minutes. Before the fix the "shared control" test failed 4 of 6 repeats with `element was detached from the DOM, retrying` at assist.spec.js:39. Then run `git status --short`: if `assets/screenshots/` shows changes, restore them with `git checkout -- assets/screenshots`.

- [ ] **Step 6: Run the node suites**

Run: `npm test`
Expected: `Total: 346 checks passed; 0 suites failed.` (`tests/assist.test.js` does not load the DOM wrapper and is unchanged.)

- [ ] **Step 7: Commit**

```bash
git add game/js/assist.js tests/browser/assist.spec.js
git commit -m "fix(assist): keep the Return to AI button across panel refreshes

renderSelInfo runs four times a second, paused or not, and the AI Assist
wrapper rebuilt its row and button every time. On software-rendered
frames (~35 ms) the button lived ~7 frames, so Playwright's click kept
hitting a detached node. The row is now reused while its text is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Performance harness `tests/browser/maps-perf.spec.js` and `npm run test:perf`

The spec repeats the browser measurements of the map evaluation (E§3.0, tables T1–T5) with the evaluation's own methods (its scratch scripts `browser.js` and `browser-sim.js` are the source of each measuring block): generation time; steady tick mean and p99 with 3 AI players on coastal and 8 on land (Feudal start, high resources, seed 33, 600 warm-up ticks, 3,600 timed ticks inside one `page.evaluate`); one 40-knight cross-map `orderMove`; 2D frame cost and live fps at zoom 1 and 0.55; 2.5D live fps; save size and serialise time; terrain-cache bytes after an 11 × 11 pan at zoom 0.55; and a tree search (`findNearestRes`, for Task 5). It writes `test-results/maps-perf.json` and appends one row per size to `docs/maps-perf-baseline.md`, creating the file with its header on first run.

Sizes 320 and 480 need `AOR_PERF_SIZES`: until phase 8 the spec swaps in a copy of `validateMapSpec` with the cap raised to 1024, inside the test page only (the evaluation's runtime patch). The `gpu` project is Chromium's new headless mode on the real GPU (`channel: 'chromium'`), as in the evaluation; the default headless shell renders in software and would not match E§3. A `swiftshader` project records the low-end check.

**Files:**
- Create: `tests/browser/maps-perf.spec.js`, `playwright.perf.config.js`, `docs/maps-perf-baseline.md` (written by the first run)
- Modify: `playwright.config.js:3` (ignore the perf spec), `package.json:14` (`test:perf` script)

**Interfaces:**
- Consumes: `__game.launchFromSetup`, `__game.W`, `__game.R`, `__game.UI`, `__game.T25D`, `__game.centerCamOn` (main.js:75), and the page globals `generateMapSpec`, `MAP_SIZES`, `validateMapSpec`, `worldTick`, `orderMove`, `spawnUnit`, `removeEnt`, `nearestLandTile`, `findNearestRes`, `renderWorld`, `drawOverlays`, `invalidateTerrain`, `MatchSave`, `AIPlayer`.
- Produces: `npm run test:perf`; environment variables `AOR_PERF_SIZES` (default `120,200,256`), `AOR_PERF_LABEL` (default `run`), `AOR_PERF_TICKS` (default `3600`); `test-results/maps-perf.json` (`{ date, label, commit, ticks, results: [{ n, renderer, gen, sim3, sim8, render2d, render25d, errors }] }`); one row per size in `docs/maps-perf-baseline.md`. Task 9 appends the phase 2 rows with the same command.

- [ ] **Step 1: Confirm there is no perf run yet**

Run: `npm run test:perf`
Expected: FAIL with `npm error Missing script: "test:perf"`.

- [ ] **Step 2: Create the perf spec**

Create `tests/browser/maps-perf.spec.js`:
```js
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
// The 'gpu' project (the default of npm run test:perf) is Chromium's new headless mode on the real GPU, as in the
// evaluation; the 'swiftshader' project is the software-rendering low-end check.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SIZES = (process.env.AOR_PERF_SIZES || '120,200,256').split(',').map(Number);
const LABEL = process.env.AOR_PERF_LABEL || 'run';
const TICKS = +(process.env.AOR_PERF_TICKS || 3600);
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
- **40 knights**: one \`orderMove\` of 40 knights from player 1's Town Center to the farthest Town Center, made
  before the timed ticks of the 3- and the 8-player match, in ms, with the routes that reached their goal.
- **2D frame**: mean of 30 synchronous \`renderWorld\` + \`drawOverlays\` calls at zoom 1 / 0.55 (coastal, 3 players,
  seed 7). **2D fps**: live frames over 5 s at each zoom with the match running.
- **2.5D fps**: live frames over 4 s with \`?renderer=three\`.
- **Save**: \`MatchSave.serialize()\` characters and ms after the timed 3-player ticks.
- **Cache MB**: terrain chunk canvases (width × height × 4) after an 11 × 11 pan at zoom 0.55.

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
// The evaluation's runtime-only patch: the game's own validator source with the 256 cap raised to 1024, evaluated
// inside the test page only (no outside input reaches it).
const CAP_PATCH = `(() => { const orig = validateMapSpec; validateMapSpec = eval('(' + orig.toString().replace('n > 256', 'n > 1024') + ')'); })();`;
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
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
    let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
    const us = [];
    for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); }
    let b = performance.now(); orderMove(us, far.x + 2, far.y + 6);
    res.group40 = { ms: +(performance.now() - b).toFixed(0), ok: us.filter(u => u.pathOk).length, straight: +fd.toFixed(0) };
    for (const u of us) removeEnt(u);
    for (let i = 0; i < 600; i++) worldTick(0.05);
    const ts = []; for (let i = 0; i < ticks && !W.over; i++) { const c = performance.now(); worldTick(0.05); ts.push(performance.now() - c); }
    ts.sort((x, y) => x - y);
    res.tick = { n: ts.length, mean: +(ts.reduce((x, y) => x + y, 0) / ts.length).toFixed(2), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(1), max: +ts[ts.length - 1].toFixed(0), over50: ts.filter(x => x > 50).length };
    res.entities1 = W.list.length; res.units = W.list.filter(e => e.kind === 'unit' && e.owner > 0).length;
    const vv = W.list.find(e => e.type === 'villager' && !e.dying);
    b = performance.now(); for (let i = 0; i < 100; i++) findNearestRes(vv, ['tree'], vv.x, vv.y, 30);
    res.findNearestResUs = +((performance.now() - b) * 10).toFixed(1);
    W.spectate = false; b = performance.now(); let s = ''; try { s = MatchSave.serialize(); } catch (e) { res.saveError = e.message; }
    res.save = { ms: +(performance.now() - b).toFixed(0), chars: s.length };
    return res;
  }, { cfg: setup(n, np, type, 33, 1, 'high'), ticks: TICKS });
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
    await openGame(page); await prepareSize(page, n);
    rec.render2d = await measure2d(page, n);
    await openGame(page, '?renderer=three');
    await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 || !!window.__game?.T25D.error, null, { timeout: 60000 }).catch(() => {});
    await prepareSize(page, n);
    rec.render25d = await measure25d(page, n);
    rec.errors = errors.slice(0, 5);
    results.push(rec);
    expect(errors).toEqual([]);
    expect(rec.sim3.tick.n).toBe(TICKS);
    expect(rec.sim8.tick.n).toBe(TICKS);
  });
}

test.afterAll(() => {
  if (!results.length) return;
  let commit = 'unknown'; try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch (e) { }
  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify({ date, label: LABEL, commit, ticks: TICKS, results }, null, 1));
  if (!fs.existsSync(MD_OUT)) fs.writeFileSync(MD_OUT, MD_HEAD);
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.sim3.group40.ms} / ${r.sim8.group40.ms} (${r.sim3.group40.ok}/40, ${r.sim8.group40.ok}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}) | ${r.render2d.pan.cacheMB} |`);
  fs.appendFileSync(MD_OUT, rows.join('\n') + '\n');
});
```

- [ ] **Step 3: Create the perf config**

Create `playwright.perf.config.js`:
```js
// Performance baseline for bigger maps: npm run test:perf (runs the 'gpu' project). Slow, so the default browser
// run (playwright.config.js) ignores tests/browser/maps-perf.spec.js.
// 'gpu': Chromium's new headless mode on the real GPU, as the map evaluation measured.
// 'swiftshader': the default headless shell with software rendering, the low-end check:
//   PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test --config playwright.perf.config.js --project=swiftshader
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser', testMatch: 'maps-perf.spec.js', timeout: 20 * 60 * 1000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', launchOptions: { args: ['--enable-precise-memory-info'] } },
  projects: [
    { name: 'gpu', use: { channel: 'chromium' } },
    { name: 'swiftshader', use: {} },
  ],
  webServer: { command: 'node tests/serve.js', url: 'http://127.0.0.1:8765', reuseExistingServer: false, timeout: 10000 },
});
```

- [ ] **Step 4: Keep the perf spec out of the default browser run**

In `playwright.config.js`, replace:
```js
  testDir: './tests/browser', timeout: 45000, workers: 1,
```
with:
```js
  testDir: './tests/browser', timeout: 45000, workers: 1,
  testIgnore: ['**/maps-perf.spec.js'],   // slow; run it with npm run test:perf (playwright.perf.config.js)
```

- [ ] **Step 5: Add the npm script**

In `package.json`, replace:
```json
    "test:browser": "playwright test"
```
with:
```json
    "test:browser": "playwright test",
    "test:perf": "playwright test --config playwright.perf.config.js --project=gpu"
```

- [ ] **Step 6: The default browser run does not pick it up**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test --list | grep -c maps-perf`
Expected: `0`.
Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test --config playwright.perf.config.js --list`
Expected: 6 tests listed: `[gpu] › maps-perf.spec.js › performance at 120×120`, `… 200×200`, `… 256×256`, and the same three for `[swiftshader]`.

- [ ] **Step 7: Record the phase 1 baseline**

Close other heavy programs first; the numbers are timings.
Run: `AOR_PERF_LABEL="phase 1 baseline" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf`
Expected: `3 passed` in about 3–4 minutes, `test-results/maps-perf.json` written, and `docs/maps-perf-baseline.md` created with the header and three rows. Observed while planning on the RTX A4000 machine (unmodified game code):

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-18 | phase 1 baseline | unknown | gpu | 120 | 50 / 47 | 0.93 / 13.5 | 2.32 / 37.1 | 124 | 92 / 38 (40/40, 40/40) | 3.13 / 2.59 | 60 / 60 | 60.2 | 1,262,500 (23) | 353 |
| 2026-10-18 | phase 1 baseline | unknown | gpu | 200 | 100 / 117 | 2.18 / 36.7 | 5.56 / 98.3 | 288 | 213 / 91 (40/40, 40/40) | 4.09 / 3.45 | 60.1 / 60 | 59.4 | 3,174,070 (40) | 982 |
| 2026-10-18 | phase 1 baseline | unknown | gpu | 256 | 176 / 197 | 3.39 / 56.7 | 8.25 / 148.2 | 575 | 435 / 400 (40/40, 40/40) | 4.62 / 4.16 | 59.7 / 59.8 | 56.5 | 5,285,118 (81) | 1038 |

Your numbers will differ somewhat; check that they are of the same order as E§3 T1–T4 (for example 8 players at 200: tick mean about 4.6–5.6 ms, p99 about 80–100 ms). If git refuses to report the commit, the row says `unknown`; replace it with `git rev-parse --short HEAD` by hand.

- [ ] **Step 8: The cap override works for 320 and 480**

Run: `AOR_PERF_SIZES=320,480 AOR_PERF_TICKS=200 AOR_PERF_LABEL="cap check" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf`
Expected: `2 passed` in about 3 minutes, with no `pageerror`. Observed while planning: 480 with 8 players ticked at a mean of 30.3 ms (p99 602 ms over 200 ticks), and 2.5D ran at 11.6 fps. This step only checks the override: remove the two `cap check` rows it appended to `docs/maps-perf-baseline.md` before committing.

- [ ] **Step 9: Syntax check and node suites**

Run: `npm run test:syntax`
Expected: no error.
Run: `npm test`
Expected: `Total: 346 checks passed; 0 suites failed.` (no node test changed).

- [ ] **Step 10: Commit**

```bash
git add tests/browser/maps-perf.spec.js playwright.perf.config.js playwright.config.js package.json docs/maps-perf-baseline.md
git commit -m "test(perf): on-demand map performance spec and the phase 1 baseline

npm run test:perf repeats the map evaluation's browser measurements at
120, 200 and 256 (320 and 480 through a test-page-only cap override),
writes test-results/maps-perf.json and appends rows to
docs/maps-perf-baseline.md. The default browser run ignores it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Entity index module `game/js/index.js`

Trees are 73–93 % of `W.list` (E§1.3), and the AI, resource searches, rendering and hit-testing all scan the whole list. This task adds the index and keeps it in step with the world. It replaces only one scan, `rebuildGrid` (the per-tick unit grid at world.js:397), so no query answer changes yet; Tasks 5, 6 and 8 move the scans onto it.

**Design (each point is checked by `tests/index.test.js`):**
- **Buckets:** `IDX.cell = 8`. For each category there is one `Set` per 8 × 8-tile cell, keyed by the entity's position `(e.x, e.y)` (a building's top-left tile, a resource's tile, a unit's position). Categories are `unit`, `bld`, `relic` and `res:<type>` (`res:tree`, `res:gold`, …).
- **Category lists:** `IDX.all.get(cat)` is a `Set` of every entity of the category in insertion order, which is `W.list` order (entities are only appended, and the list is rebuilt from `W.list`).
- **Owner lists:** `IDX.owned[owner]` holds `unit`, `bld` and `all` (both merged), plus `types` (building type → array). Every array is sorted by id. `W.list` is always in ascending id order (ids only grow and entities are only appended), so "sorted by id" is "`W.list` order": a caller that took the first match of a scan, or sorted stably, gets the same entity. Owner 0 (gaia: animals, unclaimed sheep) has lists too.
- **Upkeep:** `addEnt` → `idxAdd`, `removeEnt` → `idxRemove`, every owner change → `idxSetOwner` (conversion, cargo conversion, sheep capture and theft, the defeated player's sheep, resign), the editor's drag → `idxMoved`. Units and relics move every tick: `idxSync` refiles the ones that left their cell. It runs in `rebuildGrid` at the start of every tick and before every unit or relic query, so those queries are exact. It also refiles a unit whose owner changed without `idxSetOwner` and counts it in `IDX.fixes`; the property test asserts that this stays 0 in play. Buildings and resources are filed once and never re-synced. Checked while planning with `grep -nE ".(x|y)s*=[^=]" game/js/*.js`: outside the editor's drag, game code moves only units, relics and projectiles. Any later code that moves a building or a resource must call `idxMoved`.
- **Rebuilds:** the index remembers the `W` and the `W.list` array it describes. A new world, a loaded save, the menu backdrop or a test that assigns a new `W.list` is rebuilt from `W.list` on first use. It is also rebuilt on `worldCreated` and `worldRestored`. A stub `W` without `list` or `map` (ui.js:80, the timing test) is ignored.
- **Not saved:** the index lives in the global `IDX`, not on `W`, and entity records are kept in a `Map`, not on the entities, so `MatchSave` never sees it.
- **Not stored:** "built" and unit types. `idxCount` counts `e.built` when it is read (buildings finish in `completeBuilding`). The roadmap's per-owner villager set is not kept: a villager can become a monk (`modBecomeMonk`, mod.js:68) with no hook, so villagers are filtered from the owner's unit list (one owner's units, not the whole map).
- **Reference mode:** `IDX.brute = true` makes every query scan `W.list` instead. Tests use it as the reference the index must equal.
- **Loaders:** 12 node test files load `world.js` by hand instead of through the harness (13 load lists: `tests/terrain.test.js` has two). Each gets `'index.js'` after `'world.js'`. The vm harness (`tests/engine-harness.js`) loads every `<script src="js/…">` of `game/index.html`, so it picks the module up from the script tag.

**Files:**
- Create: `game/js/index.js`, `tests/index.test.js`, `tests/sim-signature.test.js`, `tests/fixtures/sim-signatures.json` (recorded in Step 2)
- Modify: `game/index.html:39` (script tag), `game/js/world.js:135` (`addEnt`), `:181` (`removeEnt`), `:397-404` (`rebuildGrid`), `:1240`, `:1242` (`convertLogic`), `:1438`, `:1446` (`sheepCapture`), `:1562` (`checkVictory`), `game/js/command.js:448` (`cmdResign`), `game/js/editor.js:213`, `:220`, `:228` (`moveEnt`)
- Modify (test loaders): `tests/bridges-tunnels.test.js:8`, `tests/command.test.js:9`, `tests/extras.test.js:10`, `tests/fx.test.js:17`, `tests/mortality.test.js:10`, `tests/movement.test.js:9`, `tests/terraform.test.js:8`, `tests/terrain.test.js:9` and `:93`, `tests/units_hd.test.js:14`, `tests/victory.test.js:10`, `tests/water.test.js:8`, `tests/wells.test.js:8`

**Interfaces:**
- Consumes: `W`, `W.list`, `W.map`, `GameHooks` (world.js); `addEnt`, `removeEnt`, `rebuildGrid` call into this module.
- Produces (globals, all used by Tasks 5–8):
  - `IDX` — `{ cell: 8, cells, all, owned, at, rev, brute, fixes, … }`. `IDX.rev.get(cat)` counts adds and removes per category (Task 8's minimap tree layer keys on `IDX.rev.get('res:tree')`).
  - `idxCat(e) → string` and `idxCellOf(x, y) → number`.
  - `idxAdd(e)`, `idxRemove(e)`, `idxSetOwner(e, owner)`, `idxMoved(e)`, `idxSync()`, `idxEnsure() → boolean`, `idxRebuild()`.
  - `idxAll(cat) → Set|Array` — every entity of a category in `W.list` order (live; do not mutate).
  - `idxOwned(owner, kind) → Array` — `kind` is `'unit'`, `'bld'` or `'all'`; sorted by id (live; never mutate it, and copy it before a loop that may add or remove entities).
  - `idxCount(owner, type) → number` — finished buildings of a type (the old `builtCount`).
  - `idxRect(cat, x0, y0, x1, y1) → Array` — entities whose `(e.x, e.y)` lies in the rectangle, bounds included, sorted by id.
  - `idxNear(cat, x, y, r) → Array` — entities whose `(e.x, e.y)` is within `r` of `(x, y)`, sorted by id. Callers that measure from a centre pass a larger `r` and keep their own exact test.
  - `idxRectAll(x0, y0, x1, y1) → Array` — `idxRect` over every category, merged and sorted by id (Task 8's view and hit candidates).
  - `idxGhosts() → Array` — the fog-memory ghost entries at the end of `W.list`, which the index never holds (Task 8).
  - `idxWalk(cats, x, y, more, visit)` — nearest-first walk over cells in rings; before ring k ≥ 1 it calls `more((k - 1) * IDX.cell)`, the least distance from `(x, y)` to any tile of that ring, and stops when it returns false; `visit(e)` sees entities in no fixed order, so callers break ties by id.

- [ ] **Step 1: Create the golden-signature test**

Create `tests/sim-signature.test.js`:
```js
// Golden simulation signatures: fixed-seed AI-vs-AI matches must replay to exactly the same state.
// The entity index (game/js/index.js) may make queries faster but must not change any outcome, so these hashes were
// recorded on the code before the index existed. A change that is meant to alter the simulation re-records them
// deliberately, and its commit says why:  AOR_RECORD=1 node tests/sim-signature.test.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const harness = require('./engine-harness');
const FIXTURE = path.join(__dirname, 'fixtures', 'sim-signatures.json');
const SCENARIOS = [
  { key: 'tiny-land-2p-feudal', size: 'tiny', mapType: 'land', players: 2, seed: 5, startAge: 1, minutes: 10 },
  { key: 'small-coastal-3p-castle', size: 'small', mapType: 'coastal', players: 3, seed: 7, startAge: 2, minutes: 10 },
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
function play(s) {
  const { run, warnings } = harness();
  run(`(() => {
    const spec = generateMapSpec({ size: '${s.size}', seed: ${s.seed}, mapType: '${s.mapType}', numPlayers: ${s.players} });
    const civs = Object.keys(CIVS);
    createWorld(spec, { players: Array.from({ length: ${s.players} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 3) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${s.seed}, fog: 'normal', startRes: 'high', startAge: ${s.startAge}, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true;
    for (let i = 0; i < ${s.minutes} * 60 * 20 && !W.over; i++) worldTick(0.05);
  })()`);
  const sig = run('signature()');
  return { hash: crypto.createHash('sha1').update(sig).digest('hex'), t: +run('W.t').toFixed(2), entities: run('W.list.length'), aiErrors: warnings.filter(w => w.startsWith('AI error')).length };
}
const record = process.env.AOR_RECORD === '1';
const golden = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : {};
const fresh = {};
for (const s of SCENARIOS) {
  const r = play(s); fresh[s.key] = r.hash;
  if (record) { console.log(`recorded ${s.key} ${r.hash}`, JSON.stringify(r)); continue; }
  ok(`${s.key}: ${s.minutes} game minutes replay to the recorded state`, golden[s.key] === r.hash && r.aiErrors === 0, { expected: golden[s.key], got: r.hash, t: r.t, entities: r.entities, aiErrors: r.aiErrors });
}
if (record) { fs.mkdirSync(path.dirname(FIXTURE), { recursive: true }); fs.writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n'); ok('signatures recorded', true, fresh); }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Record the signatures on the unmodified simulation**

This must run before any change to `game/js`. It records the outcome of two fixed-seed AI-vs-AI matches (10 game minutes each). Tasks 4, 5, 6 and 8 must keep them unchanged; Task 7 re-records them on purpose.

Run: `AOR_RECORD=1 node tests/sim-signature.test.js`
Expected (about 40 s; these hashes were observed while planning on Node 22.17.1):
```
recorded tiny-land-2p-feudal 44241bbc71457d682559b8863842080a2cc0ced9 {"hash":"44241bbc71457d682559b8863842080a2cc0ced9","t":600,"entities":974,"aiErrors":0}
recorded small-coastal-3p-castle d0b895b7bd313d2ed61a585fef11e99249d5087c {"hash":"d0b895b7bd313d2ed61a585fef11e99249d5087c","t":600,"entities":1463,"aiErrors":0}
PASS signatures recorded  {...}
1 passed, 0 failed
```
If your hashes differ (another Node version), keep yours: what matters is that the next command replays them.
Then run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`.

- [ ] **Step 3: Write the failing property test**

Create `tests/index.test.js`:
```js
// Entity index (game/js/index.js): the buckets and owner lists must always equal a brute-force scan of W.list.
// node tests/index.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
// Compares every bucket, category list and owner list with what a scan of W.list says they should hold.
function idxCheck() {
  idxSync();
  const bad = [];
  for (let i = 1; i < W.list.length; i++) if (W.list[i - 1].id >= W.list[i].id) { bad.push('W.list not in id order at ' + i); break; }
  const want = new Map(), wantAll = new Map(), wantOwned = new Map();
  const push = (m, k, e) => { let a = m.get(k); if (!a) m.set(k, a = []); a.push(e); };
  for (const e of W.list) {
    const cat = idxCat(e);
    let cells = want.get(cat); if (!cells) want.set(cat, cells = new Map());
    push(cells, idxCellOf(e.x, e.y), e); push(wantAll, cat, e);
    if (e.kind === 'unit' || e.kind === 'bld') { push(wantOwned, e.owner + ':' + e.kind, e); push(wantOwned, e.owner + ':all', e); }
    if (e.kind === 'bld') push(wantOwned, e.owner + ':type:' + e.type, e);
  }
  const same = (a, b) => a.length === b.length && a.every((e, i) => e === b[i]);
  for (const cat of new Set([...want.keys(), ...IDX.cells.keys()])) {
    const arr = IDX.cells.get(cat) || [], cells = want.get(cat) || new Map();
    for (let i = 0; i < IDX.cw * IDX.cw; i++) {
      const got = arr[i] ? [...arr[i]].sort((a, b) => a.id - b.id) : [];
      if (!same(got, cells.get(i) || [])) bad.push(cat + ' cell ' + i + ': ' + got.length + ' filed, ' + (cells.get(i) || []).length + ' expected');
    }
    if (!same([...(IDX.all.get(cat) || [])], wantAll.get(cat) || [])) bad.push(cat + ': category list differs');
  }
  for (let o = 0; o < W.players.length; o++) {
    for (const k of ['unit', 'bld', 'all']) if (!same(idxOwned(o, k), wantOwned.get(o + ':' + k) || [])) bad.push('owner ' + o + ' ' + k + ' list differs');
    const r = IDX.owned[o], types = new Set(r ? r.types.keys() : []);
    for (const k of wantOwned.keys()) if (k.startsWith(o + ':type:')) types.add(k.slice((o + ':type:').length));
    for (const t of types) if (!same((r && r.types.get(t)) || [], wantOwned.get(o + ':type:' + t) || [])) bad.push('owner ' + o + ' ' + t + ' list differs');
  }
  if (IDX.at.size !== W.list.length) bad.push(IDX.at.size + ' records for ' + W.list.length + ' entities');
  return bad;
}
function landTile(rnd) { for (let k = 0; k < 400; k++) { const x = (rnd() * W.n) | 0, y = (rnd() * W.n) | 0, i = W.map.idx(x, y); if (!isWaterT(W.map.ter[i]) && !W.map.blk[i]) return { x, y }; } return null; }
`);

// ---------- 1. ten game minutes of AI play plus random owner changes, teleports, kills, spawns and moves ----------
const P = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 11, mapType: 'coastal', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 2], color: PLAYER_COLORS[i], human: i === 0 })), seed: 11, fog: 'normal', startRes: 'high', startAge: 2, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(99), pick = a => a[(rnd() * a.length) | 0], ops = { owner: 0, teleport: 0, kill: 0, spawn: 0, move: 0, unreported: 0 };
  const checks = [], first = [];
  for (let s = 1; s <= 600; s++) {
    for (let i = 0; i < 20; i++) worldTick(0.05);
    if (s % 2 === 0) {
      const units = W.list.filter(e => e.kind === 'unit' && !e.dying && !e.inside && e.owner > 0);
      const op = (rnd() * 5) | 0;
      if (op === 0 && units.length) { const u = pick(units); idxSetOwner(u, 1 + ((u.owner + ((rnd() * 3) | 0)) % 4)); setOrder(u, null); ops.owner++; }
      if (op === 1 && units.length) { const u = pick(units), t = landTile(rnd); if (t) { u.x = t.x + 0.5; u.y = t.y + 0.5; u.path = null; ops.teleport++; } }
      if (op === 2) { const c = W.list.filter(e => (e.kind === 'unit' && !e.dying) || (e.kind === 'res' && e.type === 'tree') || (e.kind === 'bld' && e.type === 'house')); if (c.length) { const e = pick(c); if (e.kind === 'res') removeEnt(e); else killEnt(e, null); ops.kill++; } }
      if (op === 3) { const t = landTile(rnd); if (t) { spawnRes(pick(['tree', 'gold', 'stone', 'berry', 'relic']), t.x, t.y); ops.spawn++; } }
      if (op === 4) { const trees = W.list.filter(e => e.kind === 'res' && e.type === 'tree' && !e.gatherers), t = landTile(rnd); if (trees.length && t) { const e = pick(trees); W.map.blk[W.map.idx(e.x, e.y)] = 0; e.x = t.x; e.y = t.y; W.map.blk[W.map.idx(t.x, t.y)] = e.id; idxMoved(e); ops.move++; } }
    }
    if (s % 30 === 0) { const bad = idxCheck(); checks.push(bad.length); if (bad.length && !first.length) first.push(...bad.slice(0, 5)); }
  }
  const fixes = IDX.fixes;
  // a direct owner write that skips idxSetOwner is caught by the next sync and counted
  const u = W.list.find(e => e.kind === 'unit' && e.owner === 2 && !e.dying);
  u.owner = 3; const before = IDX.fixes; idxSync(); ops.unreported = IDX.fixes - before;
  const after = idxCheck();
  return JSON.stringify({ t: W.t, entities: W.list.length, units: W.list.filter(e => e.kind === 'unit').length, ops, checks: checks.length, failedChecks: checks.filter(n => n).length, first, fixes, unreportedFixed: ops.unreported === 1 && !after.length });
})()`));
ok('10 game minutes of AI play with random owner changes, teleports, kills, spawns and moves: every bucket equals a brute-force scan', P.checks === 20 && P.failedChecks === 0 && P.t >= 600, P);
ok('every owner change in play went through idxSetOwner; a direct write is caught and counted by idxSync', P.fixes === 0 && P.unreportedFixed, P);

// ---------- 2. queries equal the brute-force answer ----------
const Q = JSON.parse(run(`(() => {
  const rnd = mulberry32(7), cats = ['unit', 'bld', 'relic', 'res:tree', 'res:gold', 'res:stone', 'res:berry', 'res:fish', 'res:carcass'];
  let rect = 0, near = 0, rectAll = 0, owned = 0, count = 0, walk = 0, n = 0;
  const same = (a, b) => a.length === b.length && a.every((e, i) => e === b[i]);
  for (let q = 0; q < 300; q++) {
    const cat = cats[q % cats.length], x0 = rnd() * W.n - 10, y0 = rnd() * W.n - 10, x1 = x0 + rnd() * 40, y1 = y0 + rnd() * 40;
    const r = rnd() * 30, x = rnd() * W.n, y = rnd() * W.n;
    const a = idxRect(cat, x0, y0, x1, y1), b = idxNear(cat, x, y, r);
    const z = idxRectAll(x0, y0, x1, y1);
    IDX.brute = true; const a2 = idxRect(cat, x0, y0, x1, y1), b2 = idxNear(cat, x, y, r), z2 = idxRectAll(x0, y0, x1, y1); IDX.brute = false;
    if (same(a, a2)) rect++; if (same(b, b2)) near++; if (same(z, z2)) rectAll++; n++;
    const o = q % W.players.length, kind = ['unit', 'bld', 'all'][q % 3], type = Object.keys(BUILDINGS)[q % Object.keys(BUILDINGS).length];
    const c = idxOwned(o, kind).slice(), k = idxCount(o, type);
    IDX.brute = true; const c2 = idxOwned(o, kind), k2 = idxCount(o, type); IDX.brute = false;
    if (same(c, c2)) owned++; if (k === k2) count++;
    // a walk that never stops visits exactly the category's entities
    const seen = new Set(); idxWalk([cat], x, y, () => true, e => seen.add(e));
    const all = W.list.filter(e => idxCat(e) === cat);
    if (seen.size === all.length && all.every(e => seen.has(e))) walk++;
  }
  // ghosts pushed past the indexed list (as vicWithGhosts does while drawing) are reported, and only they
  const ghost = { id: 1, kind: 'bld', ghost: true, type: 'house', x: 1, y: 1 }; W.list.push(ghost);
  const ghosts = idxGhosts().length === 1 && idxGhosts()[0] === ghost; W.list.pop();
  return JSON.stringify({ n, rect, near, rectAll, owned, count, walk, ghosts: ghosts && idxGhosts().length === 0 });
})()`));
ok('idxRect, idxNear, idxRectAll, idxOwned and idxCount equal the brute-force scan on 300 random queries; idxWalk reaches every entity; idxGhosts finds the ghosts', Q.rect === Q.n && Q.near === Q.n && Q.rectAll === Q.n && Q.owned === Q.n && Q.count === Q.n && Q.walk === Q.n && Q.ghosts, Q);

// ---------- 3. a new world, a replaced W.list and a restored save rebuild the index ----------
const R = JSON.parse(run(`(() => {
  const out = {};
  make(9); out.created = IDX.w === W && IDX.list === W.list && idxCheck().length === 0;
  W.list = W.list.filter(e => !(e.kind === 'res' && e.type === 'tree')); W.ents = new Map(W.list.map(e => [e.id, e]));
  out.replaced = idxAll('res:tree').size === undefined ? idxAll('res:tree').length === 0 : idxAll('res:tree').size === 0;
  make(9);
  for (let i = 0; i < 100; i++) worldTick(0.05);
  const text = MatchSave.serialize(), units = idxOwned(1, 'unit').length;
  out.notSaved = !text.includes('"IDX"') && !text.includes('"cells"');
  MatchSave.restore(text);
  out.restored = IDX.w === W && idxCheck().length === 0 && idxOwned(1, 'unit').length === units;
  return JSON.stringify(out);
})()`));
ok('a new world, a replaced W.list and a restored save each rebuild the index; the index is not written into saves', R.created && R.replaced && R.notSaved && R.restored, R);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 4: Run it and watch it fail**

Run: `node tests/index.test.js`
Expected: FAIL with `ReferenceError: idxSetOwner is not defined` (the first index call the test makes), exit status 1.

- [ ] **Step 5: Create the index module**

Create `game/js/index.js`:
```js
// ===== Entity index: spatial buckets and per-owner lists kept in step with W.list =====
// Loaded right after world.js. Trees and other resources are most of W.list on big maps, so code that scanned the
// whole list (the AI, resource searches, rendering, hit-testing) asks this index instead. Every query returns
// entities in W.list order (ascending id), so a caller that took the first match or sorted stably gets the same
// answer as the old scan.
// Upkeep: addEnt and removeEnt call idxAdd and idxRemove; owner changes go through idxSetOwner; units and relics
// move every tick and are refiled by idxSync (from rebuildGrid each tick and before every unit or relic query);
// anything else that moves an entity calls idxMoved. A new world or a replaced W.list is rebuilt on first use.
'use strict';
const IDX = {
  cell: 8,               // bucket side in tiles
  w: null, list: null,   // the world and the W.list array the buckets describe
  n: 0, cw: 0,           // map side and cells per side
  cells: new Map(),      // category -> Array(cw * cw) of Set, created on demand
  all: new Map(),        // category -> Set of every entity in it, in W.list order
  owned: [],             // owner -> { unit, bld, all, types: Map(building type -> []) }, every array sorted by id
  at: new Map(),         // entity -> { cat, cell, owner } where it is filed
  rev: new Map(),        // category -> count of adds and removes, so caches (the minimap tree layer) notice changes
  brute: false,          // tests: answer every query by scanning W.list, the reference the buckets must match
  fixes: 0,              // owner changes idxSync found that no idxSetOwner call reported; stays 0 in play
};
const IDX_NONE = Object.freeze([]);
const idxById = (a, b) => a.id - b.id;
// Categories: 'unit', 'bld', 'relic', and 'res:<type>' for resources ('res:tree', 'res:gold', ...).
function idxCat(e) { return e.kind === 'res' ? 'res:' + e.type : e.kind; }
function idxCellOf(x, y) {
  const c = IDX.cell, m = IDX.cw - 1;
  return Math.max(0, Math.min(m, (y / c) | 0)) * IDX.cw + Math.max(0, Math.min(m, (x / c) | 0));
}
function idxLive() { return !!(W && W.list && W.map) && IDX.w === W && IDX.list === W.list && IDX.n === W.n; }
// True when a real world is loaded; rebuilds the buckets first if they describe another world or list.
function idxEnsure() {
  if (!W || !W.list || !W.map) return false;
  if (!idxLive()) idxRebuild();
  return true;
}
function idxRebuild() {
  IDX.w = W; IDX.list = W.list; IDX.n = W.n; IDX.cw = Math.max(1, Math.ceil(W.n / IDX.cell));
  IDX.cells = new Map(); IDX.all = new Map(); IDX.owned = []; IDX.at = new Map(); IDX.fixes = 0;
  for (const k of IDX.rev.keys()) IDX.rev.set(k, IDX.rev.get(k) + 1);
  for (const e of W.list) idxPut(e);
}
// ---------- filing ----------
function idxInsert(a, e) {
  const id = e.id; let lo = 0, hi = a.length;
  if (!hi || a[hi - 1].id < id) { a.push(e); return; }
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].id < id) lo = m + 1; else hi = m; }
  if (a[lo] !== e) a.splice(lo, 0, e);
}
function idxDelete(a, e) {
  const id = e.id; let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].id < id) lo = m + 1; else hi = m; }
  if (a[lo] === e) a.splice(lo, 1);
}
function idxOwnerRec(o) { let r = IDX.owned[o]; if (!r) r = IDX.owned[o] = { unit: [], bld: [], all: [], types: new Map() }; return r; }
function idxFileOwner(e, owner) {
  if (e.kind !== 'unit' && e.kind !== 'bld') return;
  const r = idxOwnerRec(owner); idxInsert(r[e.kind], e); idxInsert(r.all, e);
  if (e.kind === 'bld') { let t = r.types.get(e.type); if (!t) r.types.set(e.type, t = []); idxInsert(t, e); }
}
function idxUnfileOwner(e, owner) {
  const r = IDX.owned[owner]; if (!r || (e.kind !== 'unit' && e.kind !== 'bld')) return;
  idxDelete(r[e.kind], e); idxDelete(r.all, e);
  if (e.kind === 'bld') { const t = r.types.get(e.type); if (t) idxDelete(t, e); }
}
function idxFileCell(cat, cell, e) {
  let a = IDX.cells.get(cat); if (!a) IDX.cells.set(cat, a = new Array(IDX.cw * IDX.cw));
  let s = a[cell]; if (!s) s = a[cell] = new Set(); s.add(e);
}
function idxUnfileCell(cat, cell, e) { const a = IDX.cells.get(cat), s = a && a[cell]; if (s) s.delete(e); }
function idxPut(e) {
  if (e.ghost || IDX.at.has(e)) return;   // fog-memory ghosts live in W.list only while a frame is drawn
  const cat = idxCat(e), cell = idxCellOf(e.x, e.y);
  IDX.at.set(e, { cat, cell, owner: e.owner });
  let all = IDX.all.get(cat); if (!all) IDX.all.set(cat, all = new Set()); all.add(e);
  idxFileCell(cat, cell, e); idxFileOwner(e, e.owner);
  IDX.rev.set(cat, (IDX.rev.get(cat) || 0) + 1);
}
// ---------- upkeep (called from world.js and the other owner-change and move sites) ----------
function idxAdd(e) {
  if (!W || !W.list || !W.map) return;
  if (!idxLive()) { idxRebuild(); return; }   // addEnt has already pushed e, so the rebuild files it
  idxPut(e);
}
function idxRemove(e) {
  if (!W || !W.list || !W.map) return;
  if (!idxLive()) { idxRebuild(); return; }   // removeEnt has already spliced e out
  const r = IDX.at.get(e); if (!r) return;
  IDX.at.delete(e); IDX.all.get(r.cat).delete(e); idxUnfileCell(r.cat, r.cell, e); idxUnfileOwner(e, r.owner);
  IDX.rev.set(r.cat, (IDX.rev.get(r.cat) || 0) + 1);
}
function idxSetOwner(e, owner) {
  const r = idxLive() ? IDX.at.get(e) : null;
  if (r && r.owner !== owner) { idxUnfileOwner(e, r.owner); r.owner = owner; idxFileOwner(e, owner); }
  e.owner = owner;
}
// A building or resource moved outside the simulation (the editor's drag): refile it.
function idxMoved(e) {
  if (!idxEnsure()) return;
  const r = IDX.at.get(e); if (!r) return;
  const cell = idxCellOf(e.x, e.y); if (cell === r.cell) return;
  idxUnfileCell(r.cat, r.cell, e); r.cell = cell; idxFileCell(r.cat, cell, e);
}
// Units and relics move during play: refile those that left their cell, and units whose owner changed without
// idxSetOwner (counted in IDX.fixes). O(units + relics).
function idxSync() {
  if (!idxEnsure()) return;
  for (const cat of ['unit', 'relic']) {
    const all = IDX.all.get(cat); if (!all) continue;
    for (const e of all) {
      const r = IDX.at.get(e), cell = idxCellOf(e.x, e.y);
      if (cell !== r.cell) { idxUnfileCell(cat, r.cell, e); r.cell = cell; idxFileCell(cat, cell, e); }
      if (r.owner !== e.owner) { IDX.fixes++; idxUnfileOwner(e, r.owner); r.owner = e.owner; idxFileOwner(e, e.owner); }
    }
  }
}
// ---------- queries ----------
// Every entity of a category, in W.list order. A live Set: do not add to it, and copy it before a loop that may
// add or remove entities.
function idxAll(cat) {
  if (IDX.brute || !idxEnsure()) return W && W.list ? W.list.filter(e => !e.ghost && idxCat(e) === cat) : IDX_NONE;
  return IDX.all.get(cat) || IDX_NONE;
}
// Units ('unit'), buildings ('bld') or both merged by id ('all') of one owner (0 = gaia), sorted by id.
// A live array: never mutate it, and copy it before a loop that may add or remove entities.
function idxOwned(owner, kind) {
  if (IDX.brute || !idxEnsure()) return W && W.list ? W.list.filter(e => !e.ghost && e.owner === owner && (kind === 'all' ? e.kind === 'unit' || e.kind === 'bld' : e.kind === kind)) : IDX_NONE;
  const r = IDX.owned[owner]; return r ? r[kind] : IDX_NONE;
}
// Number of finished buildings of a type that an owner has (the old builtCount scan).
function idxCount(owner, type) {
  let c = 0;
  if (IDX.brute || !idxEnsure()) { if (W && W.list) for (const e of W.list) if (!e.ghost && e.kind === 'bld' && e.owner === owner && e.type === type && e.built) c++; return c; }
  const r = IDX.owned[owner], a = r && r.types.get(type);
  if (a) for (const e of a) if (e.built) c++;
  return c;
}
// Pushes the category's entities whose position (e.x, e.y) lies in the rectangle (bounds included) onto out, unsorted.
function idxCollect(cat, x0, y0, x1, y1, out) {
  const a = IDX.cells.get(cat); if (!a) return;
  const c = IDX.cell, w = IDX.cw, m = w - 1;
  const cx0 = Math.max(0, Math.min(m, Math.floor(x0 / c))), cx1 = Math.max(0, Math.min(m, Math.floor(x1 / c)));
  const cy0 = Math.max(0, Math.min(m, Math.floor(y0 / c))), cy1 = Math.max(0, Math.min(m, Math.floor(y1 / c)));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const s = a[cy * w + cx]; if (!s) continue;
    for (const e of s) if (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e);
  }
}
// Entities of a category whose position (e.x, e.y) lies in the rectangle, bounds included, sorted by id.
function idxRect(cat, x0, y0, x1, y1) {
  const out = [];
  if (!idxEnsure()) return out;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && idxCat(e) === cat && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e); return out; }
  if (cat === 'unit' || cat === 'relic') idxSync();
  idxCollect(cat, x0, y0, x1, y1, out);
  if (out.length > 1) out.sort(idxById);
  return out;
}
// Entities of every category whose position lies in the rectangle, bounds included, sorted by id (W.list order).
function idxRectAll(x0, y0, x1, y1) {
  const out = [];
  if (!idxEnsure()) return out;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1) out.push(e); return out; }
  idxSync();
  for (const cat of IDX.cells.keys()) idxCollect(cat, x0, y0, x1, y1, out);
  if (out.length > 1) out.sort(idxById);
  return out;
}
// The entries at the end of W.list that the index does not hold: the fog-memory ghosts vicWithGhosts appends while a
// frame or the minimap is drawn. Drawing code adds them after the index's entities, where the old W.list loops met them.
function idxGhosts() {
  const L = W && W.list ? W.list : IDX_NONE; let g = L.length;
  while (g > 0 && L[g - 1].ghost) g--;
  return L.slice(g);
}
// Entities of a category whose position (e.x, e.y) is within r tiles of (x, y), sorted by id. Callers that measure
// from a centre (a resource tile's x + 0.5) pass r + 1 and keep their own exact test.
function idxNear(cat, x, y, r) {
  return idxRect(cat, x - r, y - r, x + r, y + r).filter(e => Math.hypot(e.x - x, e.y - y) <= r);
}
// Nearest-first walk for best-match searches. Visits the cells of the categories ring by ring around the cell that
// holds (x, y): ring 0 is that cell, ring k the cells k cells away. Before ring k (k >= 1) it calls
// more((k - 1) * IDX.cell), the least distance from (x, y) to any tile in that ring, and stops when more() returns
// false. visit(e) gets every entity in a visited cell in no fixed order, so callers break ties by id.
function idxWalk(cats, x, y, more, visit) {
  if (!idxEnsure()) return;
  if (IDX.brute) { for (const e of W.list) if (!e.ghost && cats.includes(idxCat(e))) visit(e); return; }
  if (cats.includes('unit') || cats.includes('relic')) idxSync();
  const arrays = []; for (const cat of cats) { const a = IDX.cells.get(cat); if (a) arrays.push(a); }
  if (!arrays.length) return;
  const c = IDX.cell, w = IDX.cw, m = w - 1, cx = Math.floor(x / c), cy = Math.floor(y / c);
  const kmax = Math.max(cx, m - cx, cy, m - cy);
  for (let k = 0; k <= kmax; k++) {
    if (k > 0 && !more((k - 1) * c)) return;
    for (let gy = cy - k; gy <= cy + k; gy++) {
      if (gy < 0 || gy > m) continue;
      const step = gy === cy - k || gy === cy + k ? 1 : 2 * k;
      for (let gx = cx - k; gx <= cx + k; gx += step) {
        if (gx < 0 || gx > m) continue;
        const i = gy * w + gx;
        for (const a of arrays) { const s = a[i]; if (s) for (const e of s) visit(e); }
      }
    }
  }
}
GameHooks.on('worldCreated', idxRebuild);
GameHooks.on('worldRestored', idxRebuild);
```

- [ ] **Step 6: Load it right after world.js**

In `game/index.html`, replace:
```html
<script src="js/world.js"></script>
```
with:
```html
<script src="js/world.js"></script>
<script src="js/index.js"></script>
```

- [ ] **Step 7: Hook `addEnt`, `removeEnt` and the per-tick grid**

In `game/js/world.js`, replace:
```js
function addEnt(e) { W.ents.set(e.id, e); W.list.push(e); GameHooks.emit('entityAdded', e); return e; }
```
with:
```js
function addEnt(e) { W.ents.set(e.id, e); W.list.push(e); idxAdd(e); GameHooks.emit('entityAdded', e); return e; }
```

Replace:
```js
  const i = W.list.indexOf(e); if (i >= 0) W.list.splice(i, 1);
  const map = W.map;
```
with:
```js
  const i = W.list.indexOf(e); if (i >= 0) W.list.splice(i, 1);
  idxRemove(e);
  const map = W.map;
```

Replace (`rebuildGrid`, the per-tick unit grid; `idxAll('unit')` lists units in `W.list` order, so `W.grid` is built in the same order as before):
```js
function rebuildGrid() {
  const g = W.grid; g.clear();
  for (const e of W.list) {
    if (e.kind !== 'unit' || e.inside || e.dying) continue;
```
with:
```js
function rebuildGrid() {
  const g = W.grid; g.clear();
  idxSync();   // refile units that crossed an index cell; idxAll('unit') is W.list's units in W.list order
  for (const e of idxAll('unit')) {
    if (e.inside || e.dying) continue;
```

- [ ] **Step 8: Route every owner change through `idxSetOwner`**

In `game/js/world.js` (`convertLogic`), replace:
```js
    t.owner = u.owner; setOrder(t, null);
```
with:
```js
    idxSetOwner(t, u.owner); setOrder(t, null);
```

Replace:
```js
if (cu) { cu.owner = u.owner; cu.queue = [];
```
with:
```js
if (cu) { idxSetOwner(cu, u.owner); cu.queue = [];
```

In `sheepCapture`, replace:
```js
    if (owners.size === 1) { s.owner = [...owners][0]; s.capturedT = W.t;
```
with:
```js
    if (owners.size === 1) { idxSetOwner(s, [...owners][0]); s.capturedT = W.t;
```

Replace:
```js
    const old = s.owner; s.owner = rival; s.contest = 0;
```
with:
```js
    const old = s.owner; idxSetOwner(s, rival); s.contest = 0;
```

In `checkVictory`, replace:
```js
e.kind === 'unit' && e.type === 'sheep') e.owner = 0;
```
with:
```js
e.kind === 'unit' && e.type === 'sheep') idxSetOwner(e, 0);
```

In `game/js/command.js` (`cmdResign`), replace:
```js
    if (e.kind === 'unit' && e.type === 'sheep') { e.owner = 0; continue; }
```
with:
```js
    if (e.kind === 'unit' && e.type === 'sheep') { idxSetOwner(e, 0); continue; }
```

- [ ] **Step 9: Refile entities the editor drags**

In `game/js/editor.js` (`moveEnt`), replace:
```js
if (W.map.isWater(x, y) === naval && !W.map.blk[W.map.idx(x, y)]) { e.x = x + 0.5; e.y = y + 0.5; } return; }
```
with:
```js
if (W.map.isWater(x, y) === naval && !W.map.blk[W.map.idx(x, y)]) { e.x = x + 0.5; e.y = y + 0.5; idxMoved(e); } return; }
```

Replace:
```js
      if (ok) { e.x = nx; e.y = ny; }
```
with:
```js
      if (ok) { e.x = nx; e.y = ny; idxMoved(e); }
```

Replace:
```js
      e.x = x; e.y = y;
    }
```
with:
```js
      e.x = x; e.y = y; idxMoved(e);
    }
```

- [ ] **Step 10: Load index.js in the node tests that load world.js by hand**

Make these 13 replacements, each the only match in its file:
In `tests/bridges-tunnels.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/command.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/extras.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/fx.test.js`, replace:
```js
  for (const f of ['data.js', 'map.js', 'world.js', 'render.js']) load(f);
```
with:
```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js']) load(f);
```

In `tests/mortality.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/movement.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/terraform.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/terrain.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'render.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js']) load(f);
```

In `tests/terrain.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'render.js', 'terrain.js']) vm.runInContext
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js', 'terrain.js']) vm.runInContext
```

In `tests/units_hd.test.js`, replace:
```js
    for (const f of ['data.js', 'map.js', 'world.js', 'render.js']) load(f);
```
with:
```js
    for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js']) load(f);
```

In `tests/victory.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/water.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

In `tests/wells.test.js`, replace:
```js
for (const f of ['data.js', 'map.js', 'world.js']) load(f);
```
with:
```js
for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
```

- [ ] **Step 11: Run the property test**

Run: `node tests/index.test.js`
Expected (about 45 s; observed while planning):
```
PASS 10 game minutes of AI play with random owner changes, teleports, kills, spawns and moves: every bucket equals a brute-force scan  {"t":600.000000000002,"entities":1865,"units":174,"ops":{"owner":56,"teleport":58,"kill":70,"spawn":71,"move":45,"unreported":1},"checks":20,"failedChecks":0,"first":[],"fixes":0,"unreportedFixed":true}
PASS every owner change in play went through idxSetOwner; a direct write is caught and counted by idxSync  {...}
PASS idxRect, idxNear, idxRectAll, idxOwned and idxCount equal the brute-force scan on 300 random queries; idxWalk reaches every entity; idxGhosts finds the ghosts  {"n":300,"rect":300,"near":300,"rectAll":300,"owned":300,"count":300,"walk":300,"ghosts":true}
PASS a new world, a replaced W.list and a restored save each rebuild the index; the index is not written into saves  {"created":true,"replaced":true,"notSaved":true,"restored":true}
4 passed, 0 failed
```
The test also proves it can fail: with `sheepCapture` still writing `s.owner = [...owners][0]` directly, the second check fails (`"fixes"` above 0).

- [ ] **Step 12: The simulation is unchanged**

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, with the hashes recorded in Step 2.

- [ ] **Step 13: Run the syntax check and every node suite**

Run: `npm run test:syntax`
Expected: `… scripts passed syntax checks.` with no error.
Run: `npm test`
Expected: `index.test.js                4 passed, 0 failed`, `sim-signature.test.js        2 passed, 0 failed`, and `Total: 352 checks passed; 0 suites failed.` If only `perf.test.js` fails on its "8 players" check, run it alone (see Task 1, Step 4); it measured 1.03 alone on this code.

- [ ] **Step 14: Browser smoke test**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/game.spec.js tests/browser/assist.spec.js --reporter=line`
Expected: all pass with no `pageerror`. Restore `assets/screenshots` with `git checkout -- assets/screenshots` if `git status --short` lists it.

- [ ] **Step 15: Commit**

```bash
git add game/js/index.js game/index.html game/js/world.js game/js/command.js game/js/editor.js tests/index.test.js tests/sim-signature.test.js tests/fixtures/sim-signatures.json tests/bridges-tunnels.test.js tests/command.test.js tests/extras.test.js tests/fx.test.js tests/mortality.test.js tests/movement.test.js tests/terraform.test.js tests/terrain.test.js tests/units_hd.test.js tests/victory.test.js tests/water.test.js tests/wells.test.js
git commit -m "feat(index): spatial and per-owner entity index kept in step with W.list

game/js/index.js files every entity in 8-tile cells per category and in
per-owner lists sorted by id (W.list order). addEnt, removeEnt, owner
changes and the editor's drag keep it current; units and relics are
refiled every tick. A property test compares every bucket with a
brute-force scan after 10 game minutes, and golden signatures recorded
before this change prove no match outcome moved.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Resource and drop-site searches through the index

`findNearestRes` (world.js:375-387) scans all of `W.list` for every re-task: 0.28–0.30 ms per call at 200 in the browser (E§3 T4). `nearestDrop`, `nearestOwn` (world.js:359-373) and `builtCount` / `hasBuilt` (world.js:629-630) are the same pattern.

**Equivalence:**
- `nearestOwn` and `nearestDrop` keep their loop bodies but iterate `idxOwned(u.owner, 'bld')`, which is the owner's buildings in `W.list` order; the strict `d < bd` therefore keeps the same building on ties.
- `findNearestRes` returns the lexicographic minimum of (score, id) over the resources that pass its filters, are reachable and score below `maxD`, exactly what the old running minimum did over `W.list` (ids ascend along `W.list`). `idxWalk` visits cells nearest-first. A ring k cells away cannot hold a tile closer than `(k - 1) · 8`, and the score (distance to the tile centre plus 0.7 per gatherer) is at least that distance, so the walk stops once the bound exceeds the best score or reaches `maxD`. A bound equal to the best score is still walked, for ties. `adjReachable` is still only asked about a candidate that would improve the best, and the unit's land region is read once instead of per candidate (the same value).
- `builtCount` and `hasBuilt` count the owner's buildings of that type with `built` set, read at call time.

**Files:**
- Modify: `game/js/world.js:359-363` (`nearestOwn`), `:364-373` (`nearestDrop`), `:375-387` (`findNearestRes`), `:629-630` (`builtCount`, `hasBuilt`)
- Create: `tests/index-queries.test.js`

**Interfaces:**
- Consumes: `idxOwned(owner, 'bld')`, `idxWalk(cats, x, y, more, visit)`, `idxCount(owner, type)` from Task 4.
- Produces: the same signatures as before: `nearestOwn(u, type, exclude) → bld|null`, `nearestDrop(u, res) → bld|null`, `findNearestRes(u, types, x, y, maxD = 30, filter) → res|null`, `builtCount(p, type) → number`, `hasBuilt(p, type) → boolean`.

- [ ] **Step 1: Write the differential test**

Create `tests/index-queries.test.js`. It keeps the old functions verbatim as `old…` and compares them with the live ones on 501 random queries over 3 seeds (small land, small coastal, medium rivers; 3 AI players after 4 game minutes, so drop sites, gatherers, carcasses and fish exist). The speed check runs on a 200 map:
```js
// Resource and drop-site searches through the entity index give exactly the answers of the old W.list scans.
// The old functions are kept below, verbatim, as the reference. node tests/index-queries.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function oldNearestOwn(u, type, exclude) {
  let best = null, bd = 1e9;
  for (const e of W.list) if (e.kind === 'bld' && e.type === type && e.owner === u.owner && e.built && e.id !== exclude) { const d = distTo(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
function oldNearestDrop(u, res) {
  let best = null, bd = 1e9;
  for (const e of W.list) {
    if (e.kind !== 'bld' || e.owner !== u.owner || !e.built) continue;
    const bdef = BUILDINGS[e.type];
    if (!bdef.drop || !bdef.drop.includes(res)) continue;
    if (!!UNITS[u.type].naval !== (e.type === 'dock')) continue;
    const d = distTo(u, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function oldFindNearestRes(u, types, x, y, maxD = 30, filter) {
  let best = null, bd = maxD;
  for (const e of W.list) {
    if (e.kind !== 'res' || !types.includes(e.type) || e.amount <= 0 || (typeof mineAccessible === 'function' && !mineAccessible(e))) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) + e.gatherers * 0.7;
    if (d < bd) {
      if (!UNITS[u.type].naval && W.map.landReg[W.map.idx(u.x | 0, u.y | 0)] && !adjReachable(u, e)) continue;
      bd = d; best = e;
    }
  }
  return best;
}
function oldBuiltCount(p, type) { let c = 0; for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) c++; return c; }
function oldHasBuilt(p, type) { for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) return true; return false; }
`);
const SEEDS = [[1, 'land', 'small'], [2, 'coastal', 'small'], [3, 'rivers', 'medium']];
const total = { res: 0, resHit: 0, drop: 0, own: 0, built: 0, same: { res: 0, drop: 0, own: 0, built: 0 } };
for (const [seed, mapType, size] of SEEDS) {
  const r = JSON.parse(run(`(() => {
    const spec = generateMapSpec({ size: '${size}', seed: ${seed}, mapType: '${mapType}', numPlayers: 3 });
    createWorld(spec, { players: Array.from({ length: 3 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i + ${seed}], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${seed}, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true;
    for (let i = 0; i < 4 * 60 * 20; i++) worldTick(0.05);   // drop sites built, gatherers spread, carcasses and fish in play
    const rnd = mulberry32(${seed} * 101), pick = a => a[(rnd() * a.length) | 0];
    const units = W.list.filter(e => e.kind === 'unit' && !e.dying);
    const kinds = ['tree', 'gold', 'stone', 'berry', 'fish', 'carcass', 'coal'], drops = ['food', 'wood', 'gold', 'stone', 'coal', 'fish'];
    const filters = [null, e => e.id % 3 !== 0, e => e.amount > 50];
    const btypes = Object.keys(BUILDINGS), owned = W.list.filter(e => e.kind === 'bld');
    const out = { res: 0, resHit: 0, drop: 0, own: 0, built: 0, same: { res: 0, drop: 0, own: 0, built: 0 }, misses: [] };
    for (let q = 0; q < 167; q++) {
      const u = rnd() < 0.2 ? { x: rnd() * W.n, y: rnd() * W.n, type: 'villager' } : pick(units);
      const types = kinds.filter(() => rnd() < 0.4); if (!types.length) types.push(pick(kinds));
      const near = rnd() < 0.7, x = near ? u.x + (rnd() - 0.5) * 20 : rnd() * W.n, y = near ? u.y + (rnd() - 0.5) * 20 : rnd() * W.n;
      const maxD = pick([10, 20, 25, 30, 40, 60]), f = pick(filters);
      const a = findNearestRes(u, types, x, y, maxD, f), b = oldFindNearestRes(u, types, x, y, maxD, f);
      out.res++; if (b) out.resHit++; if (a === b) out.same.res++; else if (out.misses.length < 3) out.misses.push({ q, types, maxD, got: a && a.id, want: b && b.id });
      const v = pick(units), res = pick(drops);
      out.drop++; if (nearestDrop(v, res) === oldNearestDrop(v, res)) out.same.drop++;
      const t = pick(btypes), ex = rnd() < 0.5 && owned.length ? pick(owned).id : undefined;
      out.own++; if (nearestOwn(v, t, ex) === oldNearestOwn(v, t, ex)) out.same.own++;
      const p = W.players[1 + ((rnd() * 3) | 0)];
      out.built++; if (builtCount(p, t) === oldBuiltCount(p, t) && hasBuilt(p, t) === oldHasBuilt(p, t)) out.same.built++;
    }
    return JSON.stringify(out);
  })()`));
  for (const k of ['res', 'resHit', 'drop', 'own', 'built']) total[k] += r[k];
  for (const k in r.same) total.same[k] += r.same[k];
  if (r.misses.length) console.log('misses', seed, JSON.stringify(r.misses));
}
ok(`findNearestRes equals the old scan on ${total.res} random queries over 3 seeds (${total.resHit} found something)`, total.same.res === total.res && total.res >= 500, total);
ok(`nearestDrop and nearestOwn equal the old scans on ${total.drop} queries each`, total.same.drop === total.drop && total.same.own === total.own, total);
ok(`builtCount and hasBuilt equal the old scans on ${total.built} queries`, total.same.built === total.built, total);

// ---------- speed on a 200 map ----------
const S = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'gigantic', seed: 4, mapType: 'land', numPlayers: 3 });
  createWorld(spec, { players: Array.from({ length: 3 }, (_, i) => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 4, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  const vs = W.list.filter(e => e.type === 'villager');
  const time = fn => { for (let i = 0; i < 200; i++) fn(i); const t0 = performance.now(); for (let i = 0; i < 2000; i++) fn(i); return (performance.now() - t0) / 2000; };
  const fresh = time(i => { const v = vs[i % vs.length]; findNearestRes(v, ['tree'], v.x, v.y, 30); });
  const old = time(i => { const v = vs[i % vs.length]; oldFindNearestRes(v, ['tree'], v.x, v.y, 30); });
  return JSON.stringify({ n: W.n, entities: W.list.length, msNew: +fresh.toFixed(4), msOld: +old.toFixed(4) });
})()`));
// The vm harness inflates times about 17× against the browser (the old scan: ~5 ms here, 0.28–0.30 ms in the browser,
// E§3 T4), so this checks the speed-up; the perf spec records the browser figure (budget 50 µs at 200).
ok(`findNearestRes on a 200 map: ${S.msNew} ms against ${S.msOld} ms for the old scan in the vm (at least 20× faster)`, S.msNew * 20 <= S.msOld, S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch the speed check fail**

Run: `node tests/index-queries.test.js`
Expected: the three equality checks pass (the live functions are still the old scans) and the speed check fails, for example:
```
FAIL findNearestRes on a 200 map: 4.7062 ms against 4.9845 ms for the old scan in the vm (at least 20× faster)  {"n":200,"entities":8195,"msNew":4.7062,"msOld":4.9845}
3 passed, 1 failed
```

- [ ] **Step 3: `nearestOwn` and `nearestDrop` read the owner's buildings**

In `game/js/world.js`, replace:
```js
function nearestOwn(u, type, exclude) {
  let best = null, bd = 1e9;
  for (const e of W.list) if (e.kind === 'bld' && e.type === type && e.owner === u.owner && e.built && e.id !== exclude) { const d = distTo(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
```
with:
```js
// The owner's buildings come from the index in id order (W.list order), so ties go to the same building as before.
function nearestOwn(u, type, exclude) {
  let best = null, bd = 1e9;
  for (const e of idxOwned(u.owner, 'bld')) if (e.type === type && e.built && e.id !== exclude) { const d = distTo(u, e); if (d < bd) { bd = d; best = e; } }
  return best;
}
```

Replace:
```js
function nearestDrop(u, res) {
  let best = null, bd = 1e9;
  for (const e of W.list) {
    if (e.kind !== 'bld' || e.owner !== u.owner || !e.built) continue;
```
with:
```js
function nearestDrop(u, res) {
  let best = null, bd = 1e9;
  for (const e of idxOwned(u.owner, 'bld')) {
    if (!e.built) continue;
```

- [ ] **Step 4: `findNearestRes` walks the index nearest-first**

Replace:
```js
function findNearestRes(u, types, x, y, maxD = 30, filter) {
  let best = null, bd = maxD;
  for (const e of W.list) {
    if (e.kind !== 'res' || !types.includes(e.type) || e.amount <= 0 || (typeof mineAccessible === 'function' && !mineAccessible(e))) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) + e.gatherers * 0.7;
    if (d < bd) {
      if (!UNITS[u.type].naval && W.map.landReg[W.map.idx(u.x | 0, u.y | 0)] && !adjReachable(u, e)) continue;
      bd = d; best = e;
    }
  }
  return best;
}
```
with:
```js
// Nearest resource of the given types by distance from (x, y) to the tile centre plus 0.7 per gatherer, below maxD.
// The index walk visits cells nearest-first and stops once no closer resource can exist; ties go to the lowest id,
// which is the entity the old W.list scan found first.
function findNearestRes(u, types, x, y, maxD = 30, filter) {
  let best = null, bd = maxD;
  const landed = !UNITS[u.type].naval && W.map.landReg[W.map.idx(u.x | 0, u.y | 0)];
  idxWalk(types.map(t => 'res:' + t), x, y, lb => lb <= bd && lb < maxD, e => {
    if (e.amount <= 0 || (typeof mineAccessible === 'function' && !mineAccessible(e))) return;
    if (filter && !filter(e)) return;
    const d = Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) + e.gatherers * 0.7;
    if (d < bd || (d === bd && best && e.id < best.id)) {
      if (landed && !adjReachable(u, e)) return;
      bd = d; best = e;
    }
  });
  return best;
}
```

- [ ] **Step 5: `builtCount` and `hasBuilt` read the per-type lists**

Replace:
```js
function builtCount(p, type) { let c = 0; for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) c++; return c; }
function hasBuilt(p, type) { for (const e of W.list) if (e.kind === 'bld' && e.owner === p.id && e.type === type && e.built) return true; return false; }
```
with:
```js
function builtCount(p, type) { return idxCount(p.id, type); }
function hasBuilt(p, type) { return idxCount(p.id, type) > 0; }
```

- [ ] **Step 6: Run the differential test**

Run: `node tests/index-queries.test.js`
Expected (observed while planning):
```
PASS findNearestRes equals the old scan on 501 random queries over 3 seeds (449 found something)  {"res":501,"resHit":449,"drop":501,"own":501,"built":501,"same":{"res":501,"drop":501,"own":501,"built":501}}
PASS nearestDrop and nearestOwn equal the old scans on 501 queries each  {...}
PASS builtCount and hasBuilt equal the old scans on 501 queries  {...}
PASS findNearestRes on a 200 map: 0.0572 ms against 5.0829 ms for the old scan in the vm (at least 20× faster)  {"n":200,"entities":8195,"msNew":0.0572,"msOld":5.0829}
4 passed, 0 failed
```
The vm is about 17 times slower than the browser here, so the browser figure (budget 50 µs) is read from the perf spec's "Tree search µs" column in Task 9.

- [ ] **Step 7: The simulation is unchanged**

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed` with the Task 4 hashes.

- [ ] **Step 8: Every node suite**

Run: `npm test`
Expected: `index-queries.test.js        4 passed, 0 failed` and `Total: 356 checks passed; 0 suites failed.`

- [ ] **Step 9: Commit**

```bash
git add game/js/world.js tests/index-queries.test.js
git commit -m "perf(world): resource and drop-site searches use the entity index

findNearestRes walks index cells nearest-first and breaks ties by id;
nearestOwn, nearestDrop, builtCount and hasBuilt read the owner's
building lists. A differential test keeps the old scans as the reference
on 501 random queries over 3 seeds.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: AI scans through the index

`AIPlayer.mine()` alone was 76 % of the AI's time at 320 (E§1.3); `tc()`, `home()`, the economy's sheep, carcass, farm and deer searches, the lumber-camp tree count, `needNaval`, `targetPlayer` and `pressAttack` all scan `W.list`, which is mostly trees. Each rewritten query becomes a small `AIPlayer` method (or a named function in geology.js and water.js) so it can be compared with the scan it replaced. `wells.js:110-116` only calls `this.mine(...)` and needs no edit.

**Equivalence rules used below:**
- An owner's entities come from `idxOwned(owner, kind)` in id order (`W.list` order), so `filter`, `find`, `[0]`, a strict `<` running minimum and a stable `sort` give the old answers. `pressAttack` scans units and buildings together, so it uses the merged `'all'` list.
- Only units and buildings have an owner other than 0, so `W.list.filter(e => e.owner === id && f(e))` is `idxOwned(id, 'all').filter(f)`.
- `.some`, counts and Sets do not depend on order. Radius queries go through `idxNear`/`idxRect` with a radius at least as large as the old test, then keep the old exact test.
- The match must replay exactly: `tests/sim-signature.test.js` keeps the Task 4 hashes, and a 200-map, 8-AI match ends in the same state with the index as on brute-force scans.

**Files:**
- Modify: `game/js/ai.js:40-42` (`mine`, `tc`, `home`, plus new query methods), `:83`, `:114`, `:118`, `:169`, `:245`, `:265-273`, `:278`, `:282`, `:284`, `:417`, `:426-427`, `:457`, `:506`, `:514-524`
- Modify: `game/js/geology.js:92`, `:95`, `:99`, `:106`
- Modify: `game/js/water.js:339`, `:342-343`, `:368`
- Create: `tests/index-ai.test.js`
- Modify: `tests/tactics.test.js:101` (an owner written directly in a test)

**Interfaces:**
- Consumes: `idxOwned`, `idxAll`, `idxNear`, `idxRect` (Task 4).
- Produces (all used only inside the AI, geology and water modules and by the test):
  - `AIPlayer.prototype.firstBuilding(pid) → bld|undefined`, `ownSheep() → unit[]`, `naturalFoodNear(home) → boolean`, `hasDock() → boolean`, `treeTilesNear(home) → Set<number>`, `villagerCount() → number`, `sheepNear(home) → unit[]` (nearest first), `carcassesNear(home) → res[]`, `huntersOf(id) → unit[]`, `freeFarm() → bld|undefined`, `unfinishedFarm() → bld|undefined`, `deerNear(home) → unit|undefined`, `enemyUnitCounts() → { cav, arch }`, `relicFor(m, reg) → relic|undefined`, `attackTargets(tp, cx, cy) → { tgt, fortTgt }`.
  - `geologySeamUnder(x, y, size) → boolean`, `geologyBuriedNear(v, res, home) → res[]`, `geologyCoalNear(p) → boolean` (geology.js); `wmUnitOnTile(x, y) → boolean` (water.js).
  - `mine(filter)`, `tc()`, `home()` keep their signatures.

- [ ] **Step 1: Write the test**

Create `tests/index-ai.test.js`. Part 1 samples a 4-player coastal match every 20 game seconds for 8 minutes and compares every new query with its old scan (kept verbatim in `OLD`). Part 2 plays a 200 map with 8 AI players for 90 game seconds twice, once with `IDX.brute = true` (every index query answered by a `W.list` scan, the cost of the old code) and once with the index; the two must end in the same state and the AI must be at least 3× faster:
```js
// AI scans through the entity index: every rewritten query gives exactly the answer of the W.list scan it replaced
// (kept below verbatim as OLD), a match played with the index equals the same match played on brute-force scans, and
// the AI's own time drops. node tests/index-ai.test.js
const crypto = require('crypto');
const harness = require('./engine-harness');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };

// ---------- 1. each rewritten query against its old scan, sampled through a 4-player match ----------
const { run } = harness();
run(`
const OLD = {
  mine(ai, filter) { return W.list.filter(e => e.owner === ai.id && filter(e)); },
  tc(ai) { return W.list.find(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'tc' && e.built) || W.list.find(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'tc'); },
  home(ai) { const tc = OLD.tc(ai); if (tc) return center(tc); const any = W.list.find(e => e.owner === ai.id && e.kind === 'bld'); if (any) return center(any); return { x: ai.p.startX, y: ai.p.startY }; },
  firstBuilding(pid) { return W.list.find(e => e.owner === pid && e.kind === 'bld'); },
  herd(ai) { return W.list.filter(s => s.kind === 'unit' && s.type === 'sheep' && s.owner === ai.id); },
  naturalFood(ai, home) { return W.list.some(e => (e.kind === 'res' && (e.type === 'berry' || e.type === 'carcass') && Math.hypot(e.x - home.x, e.y - home.y) < 22) || (e.kind === 'unit' && e.type === 'sheep' && e.owner === ai.id)); },
  hasDock(ai) { return W.list.some(e => e.kind === 'bld' && e.owner === ai.id && e.type === 'dock'); },
  trees(home) { const trees = new Set(); for (const o of W.list) if (o.kind === 'res' && o.type === 'tree' && Math.abs(o.x - home.x) < 29 && Math.abs(o.y - home.y) < 29) trees.add(W.map.idx(o.x | 0, o.y | 0)); return trees; },
  villagers(ai) { return W.list.filter(e => e.owner === ai.id && e.type === 'villager').length; },
  sheep(ai, home) { return W.list.filter(s => s.kind === 'unit' && s.type === 'sheep' && s.owner === ai.id && !s.dying && Math.hypot(s.x - home.x, s.y - home.y) < 14).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)); },
  carc(ai, home) { return W.list.find(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(ai.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14 && e.gatherers < 5); },
  activeCarc(ai, home) { return W.list.some(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(ai.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14); },
  hunted(ai, s) { return W.list.some(u => u.kind === 'unit' && u.owner === ai.id && u.order && u.order.t === 'hunt' && u.order.id === s.id); },
  hunters(ai, id) { return W.list.filter(u => u.kind === 'unit' && u.owner === ai.id && u.order && u.order.t === 'hunt' && u.order.id === id).length; },
  farm(ai) { return W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === ai.id && f.built && !f.farmer); },
  deer(home) { return W.list.find(a => a.kind === 'unit' && a.type === 'deer' && a.owner === 0 && Math.hypot(a.x - home.x, a.y - home.y) < 20); },
  unfinished(ai) { return W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === ai.id && !f.built); },
  enemyCav(ai) { return W.list.filter(e => e.kind === 'unit' && isEnemy(ai.id, e.owner) && hasTag(e.type, 'mounted')).length; },
  enemyArch(ai) { return W.list.filter(e => e.kind === 'unit' && isEnemy(ai.id, e.owner) && hasTag(e.type, 'archer')).length; },
  relic(ai, m, reg) { return W.list.filter(r => r.kind === 'relic' && !r.carrier && !r.inBld && W.map.landReg[W.map.idx(r.x, r.y)] === reg && !W.list.some(o => o.kind === 'unit' && o.type === 'monk' && o.owner === ai.id && o.order && o.order.id === r.id)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0]; },
  attack(tp, cx, cy) {
    let tgt = null, bd = 1e9, fortTgt = null, fbd = 1e9;
    for (const e of W.list) {
      if (e.owner !== tp || e.dead) continue;
      if (e.kind === 'bld' && (BUILDINGS[e.type].wall)) continue;
      if (e.kind === 'unit' && (e.inside || UNITS[e.type].naval)) continue;
      const c = center(e), dist = Math.hypot(c.x - cx, c.y - cy);
      const d = dist - (e.type === 'tc' || e.type === 'castle' ? 4 : 0) + (e.kind === 'unit' ? 6 : 0);
      if (d < bd) { bd = d; tgt = e; }
      if (e.kind === 'bld' && (e.type === 'castle' || e.type === 'tower' || e.type === 'tc') && dist < fbd) { fbd = dist; fortTgt = e; }
    }
    return { tgt, fortTgt };
  },
  seam(x, y, size) { return W.list.some(e=>e.depth&&e.amount>0&&e.x>=x&&e.x<x+size&&e.y>=y&&e.y<y+size); },
  buried(v, res, home) { return W.list.filter(e=>e.type===res&&e.amount>0&&!mineAccessible(e)&&Math.hypot(e.x-home.x,e.y-home.y)<35&&adjReachable(v,e)); },
  coal(p) { return W.list.some(e=>e.type==='coal'&&Math.hypot(e.x-p.startX,e.y-p.startY)<40); },
  fish() { return W.list.filter(e => e.kind === 'res' && e.type === 'fish' && !e.dead); },
  unitOnTile(x, y) { return W.list.some(u => u.kind === 'unit' && Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); },
};
function sameAnswer(a, b) {
  if (a instanceof Set && b instanceof Set) return a.size === b.size && [...a].every(x => b.has(x));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  if (a && b && typeof a === 'object' && 'tgt' in a) return a.tgt === b.tgt && a.fortTgt === b.fortTgt;
  return a === b;
}
`);
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 21, mapType: 'coastal', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 2 + 1], color: PLAYER_COLORS[i], human: i === 0 })), seed: 21, fog: 'normal', startRes: 'high', startAge: 2, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(5), counts = {}, wrong = {};
  const check = (name, a, b) => { counts[name] = (counts[name] || 0) + 1; if (!sameAnswer(a, b)) wrong[name] = (wrong[name] || 0) + 1; };
  const filters = [e => e.kind === 'unit' && e.type === 'villager' && !e.dying, e => e.kind === 'bld' && e.built, e => true];
  for (let s = 0; s < 24; s++) {
    for (let i = 0; i < 400; i++) worldTick(0.05);   // 20 game seconds between samples, 8 game minutes in all
    for (const p of W.players.slice(1)) {
      const ai = p.ai, homes = [ai.home(), { x: rnd() * W.n, y: rnd() * W.n }, { x: rnd() * W.n, y: rnd() * W.n }];
      for (const f of filters) check('mine', ai.mine(f), OLD.mine(ai, f));
      check('tc', ai.tc(), OLD.tc(ai));
      const h0 = ai.home(), h1 = OLD.home(ai); check('home', h0.x === h1.x && h0.y === h1.y, true);
      for (let q = 1; q < W.players.length; q++) check('firstBuilding', ai.firstBuilding(q), OLD.firstBuilding(q));
      check('ownSheep', ai.ownSheep(), OLD.herd(ai));
      check('hasDock', ai.hasDock(), OLD.hasDock(ai));
      check('villagerCount', ai.villagerCount(), OLD.villagers(ai));
      check('freeFarm', ai.freeFarm(), OLD.farm(ai));
      check('unfinishedFarm', ai.unfinishedFarm(), OLD.unfinished(ai));
      const ec = ai.enemyUnitCounts(); check('enemyUnitCounts', ec.cav === OLD.enemyCav(ai) && ec.arch === OLD.enemyArch(ai), true);
      for (const home of homes) {
        check('naturalFoodNear', ai.naturalFoodNear(home), OLD.naturalFood(ai, home));
        check('treeTilesNear', ai.treeTilesNear(home), OLD.trees(home));
        const sheep = ai.sheepNear(home); check('sheepNear', sheep, OLD.sheep(ai, home));
        const carcs = ai.carcassesNear(home);
        check('carcass find', carcs.find(e => e.gatherers < 5), OLD.carc(ai, home));
        check('active carcass', carcs.length > 0, OLD.activeCarc(ai, home));
        for (const sh of sheep) { check('hunted sheep', ai.huntersOf(sh.id).length > 0, OLD.hunted(ai, sh)); check('huntersOf', ai.huntersOf(sh.id).length, OLD.hunters(ai, sh.id)); }
        check('deerNear', ai.deerNear(home), OLD.deer(home));
        for (const res of ['gold', 'stone', 'coal']) { const v = ai.mine(e => e.type === 'villager')[0]; if (v) check('geologyBuriedNear', geologyBuriedNear(v, res, home), OLD.buried(v, res, home)); }
      }
      check('geologyCoalNear', geologyCoalNear(p), OLD.coal(p));
      for (const m of ai.mine(e => e.kind === 'unit' && (e.type === 'monk' || e.type === 'villager')).slice(0, 4)) { const reg = W.map.landReg[W.map.idx(m.x | 0, m.y | 0)]; check('relicFor', ai.relicFor(m, reg), OLD.relic(ai, m, reg)); }
      for (let q = 1; q < W.players.length; q++) for (let k = 0; k < 3; k++) { const cx = rnd() * W.n, cy = rnd() * W.n; check('attackTargets', ai.attackTargets(q, cx, cy), OLD.attack(q, cx, cy)); }
    }
    for (let k = 0; k < 20; k++) { const x = (rnd() * W.n) | 0, y = (rnd() * W.n) | 0, size = 1 + ((rnd() * 5) | 0); check('geologySeamUnder', geologySeamUnder(x, y, size), OLD.seam(x, y, size)); }
    check('fish list', [...idxAll('res:fish')].filter(e => !e.dead), OLD.fish());
    const units = W.list.filter(e => e.kind === 'unit');
    for (let k = 0; k < 20; k++) { const u = units[(rnd() * units.length) | 0], x = (u.x - 0.5 + (rnd() - 0.5) * 2) | 0, y = (u.y - 0.5 + (rnd() - 0.5) * 2) | 0; check('wmUnitOnTile', wmUnitOnTile(x, y), OLD.unitOnTile(x, y)); }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return JSON.stringify({ t: W.t, total, wrong, counts });
})()`));
ok(`every AI, geology and water query equals its old W.list scan (${D.total} comparisons in 8 game minutes)`, D.total > 5000 && Object.keys(D.wrong).length === 0 && Object.keys(D.counts).length === 25, D);

// ---------- 2. 200 map, 8 AI players: the index plays the brute-force match exactly, with far less AI time ----------
function aiRun(brute) {
  const h = harness();
  const r = JSON.parse(h.run(`(() => {
    const spec = generateMapSpec({ size: 'gigantic', seed: 33, mapType: 'land', numPlayers: 8 });
    createWorld(spec, { players: Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true; IDX.brute = ${brute};
    let aiMs = 0; const up = AIPlayer.prototype.update;
    AIPlayer.prototype.update = function (dt) { const t0 = performance.now(); try { return up.call(this, dt); } finally { aiMs += performance.now() - t0; } };
    for (let i = 0; i < 600; i++) worldTick(0.05);
    aiMs = 0; const t0 = performance.now();
    for (let i = 0; i < 1200; i++) worldTick(0.05);
    return JSON.stringify({ aiMs: +(aiMs / 1200).toFixed(3), tickMs: +((performance.now() - t0) / 1200).toFixed(3), units: W.list.filter(e => e.kind === 'unit' && e.owner > 0).length });
  })()`));
  r.hash = crypto.createHash('sha1').update(h.run('signature()')).digest('hex');
  r.aiErrors = h.warnings.filter(w => w.startsWith('AI error')).length;
  return r;
}
const brute = aiRun(true), indexed = aiRun(false);
const R = { brute, indexed, ratio: +(brute.aiMs / indexed.aiMs).toFixed(1) };
ok('200 map, 8 AI players, 90 game seconds: the indexed match ends in exactly the brute-force state', brute.hash === indexed.hash && !brute.aiErrors && !indexed.aiErrors, R);
ok(`AI time per tick drops ${R.ratio}× with the index (at least 3×)`, R.ratio >= 3, R);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/index-ai.test.js`
Expected: FAIL with `TypeError: ai.firstBuilding is not a function`.

- [ ] **Step 3: The AI's own queries**

In `game/js/ai.js`, replace:
```js
  mine(filter) { return W.list.filter(e => e.owner === this.id && filter(e)); }
  tc() { return W.list.find(e => e.kind === 'bld' && e.owner === this.id && e.type === 'tc' && e.built) || W.list.find(e => e.kind === 'bld' && e.owner === this.id && e.type === 'tc'); }
  home() { const tc = this.tc(); if (tc) return center(tc); const any = W.list.find(e => e.owner === this.id && e.kind === 'bld'); if (any) return center(any); return { x: this.p.startX, y: this.p.startY }; }
```
with:
```js
  // The AI asks the entity index (index.js) instead of scanning W.list. Index lists come in W.list order, so a
  // first match or a stable sort picks the same entity as the old scan; tests/index-ai.test.js checks every query
  // below against the scan it replaced.
  mine(filter) { return idxOwned(this.id, 'all').filter(filter); }
  tc() { const own = idxOwned(this.id, 'bld'); return own.find(e => e.type === 'tc' && e.built) || own.find(e => e.type === 'tc'); }
  home() { const tc = this.tc(); if (tc) return center(tc); const any = this.firstBuilding(this.id); if (any) return center(any); return { x: this.p.startX, y: this.p.startY }; }
  firstBuilding(pid) { return idxOwned(pid, 'bld')[0]; }
  ownSheep() { return idxOwned(this.id, 'unit').filter(s => s.type === 'sheep'); }
  naturalFoodNear(home) { return ['res:berry', 'res:carcass'].some(c => idxNear(c, home.x, home.y, 22).some(e => Math.hypot(e.x - home.x, e.y - home.y) < 22)) || this.ownSheep().length > 0; }
  hasDock() { return idxOwned(this.id, 'bld').some(e => e.type === 'dock'); }
  treeTilesNear(home) { const trees = new Set(); for (const o of idxRect('res:tree', home.x - 29, home.y - 29, home.x + 29, home.y + 29)) if (Math.abs(o.x - home.x) < 29 && Math.abs(o.y - home.y) < 29) trees.add(W.map.idx(o.x | 0, o.y | 0)); return trees; }
  villagerCount() { return idxOwned(this.id, 'unit').filter(e => e.type === 'villager').length; }
  sheepNear(home) { return this.ownSheep().filter(s => !s.dying && Math.hypot(s.x - home.x, s.y - home.y) < 14).sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y)); }
  carcassesNear(home) { return idxNear('res:carcass', home.x, home.y, 14).filter(e => e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(this.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14); }
  huntersOf(id) { return idxOwned(this.id, 'unit').filter(u => u.order && u.order.t === 'hunt' && u.order.id === id); }
  freeFarm() { return idxOwned(this.id, 'bld').find(f => f.type === 'farm' && f.built && !f.farmer); }
  unfinishedFarm() { return idxOwned(this.id, 'bld').find(f => f.type === 'farm' && !f.built); }
  deerNear(home) { return idxOwned(0, 'unit').find(a => a.type === 'deer' && Math.hypot(a.x - home.x, a.y - home.y) < 20); }
  enemyUnitCounts() { let cav = 0, arch = 0; for (let i = 1; i < W.players.length; i++) if (isEnemy(this.id, i)) for (const e of idxOwned(i, 'unit')) { if (hasTag(e.type, 'mounted')) cav++; if (hasTag(e.type, 'archer')) arch++; } return { cav, arch }; }
  relicFor(m, reg) { return [...idxAll('relic')].filter(r => !r.carrier && !r.inBld && W.map.landReg[W.map.idx(r.x, r.y)] === reg && !idxOwned(this.id, 'unit').some(o => o.type === 'monk' && o.order && o.order.id === r.id)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0]; }
  // nearest enemy building (non wall), prefer TC/castle, and track nearby fortifications for siege
  attackTargets(tp, cx, cy) {
    let tgt = null, bd = 1e9, fortTgt = null, fbd = 1e9;
    for (const e of idxOwned(tp, 'all')) {
      if (e.dead) continue;
      if (e.kind === 'bld' && (BUILDINGS[e.type].wall)) continue;
      if (e.kind === 'unit' && (e.inside || UNITS[e.type].naval)) continue;
      const c = center(e), dist = Math.hypot(c.x - cx, c.y - cy);
      const d = dist - (e.type === 'tc' || e.type === 'castle' ? 4 : 0) + (e.kind === 'unit' ? 6 : 0);
      if (d < bd) { bd = d; tgt = e; }
      if (e.kind === 'bld' && (e.type === 'castle' || e.type === 'tower' || e.type === 'tc') && dist < fbd) { fbd = dist; fortTgt = e; }
    }
    return { tgt, fortTgt };
  }
```

- [ ] **Step 4: Economy call sites**

Replace (herding sheep home):
```js
    for (const s of W.list) if (s.kind === 'unit' && s.type === 'sheep' && s.owner === this.id && !s.order && Math.hypot(s.x - home.x, s.y - home.y) > 7) setOrder(s,
```
with:
```js
    for (const s of this.ownSheep()) if (!s.order && Math.hypot(s.x - home.x, s.y - home.y) > 7) setOrder(s,
```

Replace:
```js
    const naturalFood = W.list.some(e => (e.kind === 'res' && (e.type === 'berry' || e.type === 'carcass') && Math.hypot(e.x - home.x, e.y - home.y) < 22) || (e.kind === 'unit' && e.type === 'sheep' && e.owner === this.id));
```
with:
```js
    const naturalFood = this.naturalFoodNear(home);
```

Replace:
```js
tot >= 8 && !W.list.some(e => e.kind === 'bld' && e.owner === this.id && e.type === 'dock');
```
with:
```js
tot >= 8 && !this.hasDock();
```

Replace (the lumber camp's tree density, in the building programme):
```js
        const trees = new Set(); for (const o of W.list) if (o.kind === 'res' && o.type === 'tree' && Math.abs(o.x - home.x) < 29 && Math.abs(o.y - home.y) < 29) trees.add(W.map.idx(o.x | 0, o.y | 0));
```
with:
```js
        const trees = this.treeTilesNear(home);
```

Replace (in `ratios()`):
```js
    if (a === 0 && W.list.filter(e => e.owner === this.id && e.type === 'villager').length < 12) r =
```
with:
```js
    if (a === 0 && this.villagerCount() < 12) r =
```

- [ ] **Step 5: `assign()` call sites**

The carcass list is read once: if no carcass with fewer than 5 gatherers exists, nothing changes before "is any carcass active" is asked, so the same list answers both.

Replace:
```js
      const sheep = W.list.filter(s => s.kind === 'unit' && s.type === 'sheep' && s.owner === this.id && !s.dying && Math.hypot(s.x - home.x, s.y - home.y) < 14)
        .sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
      const carc = W.list.find(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(this.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14 && e.gatherers < 5);
```
with:
```js
      const sheep = this.sheepNear(home);
      const carcs = this.carcassesNear(home), carc = carcs.find(e => e.gatherers < 5);
```

Replace:
```js
      const activeCarc = W.list.some(e => e.kind === 'res' && e.type === 'carcass' && e.amount > 10 && (typeof eatsMeat !== 'function' || eatsMeat(this.id, e.animal)) && Math.hypot(e.x - home.x, e.y - home.y) < 14);
      const huntedSheep = sheep.find(s => W.list.some(u => u.kind === 'unit' && u.owner === this.id && u.order && u.order.t === 'hunt' && u.order.id === s.id));
```
with:
```js
      const activeCarc = carcs.length > 0;
      const huntedSheep = sheep.find(s => this.huntersOf(s.id).length > 0);
```

Replace:
```js
        const hunters = W.list.filter(u => u.kind === 'unit' && u.owner === this.id && u.order && u.order.t === 'hunt' && u.order.id === huntedSheep.id).length;
```
with:
```js
        const hunters = this.huntersOf(huntedSheep.id).length;
```

Replace:
```js
      const farm = W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === this.id && f.built && !f.farmer);
```
with:
```js
      const farm = this.freeFarm();
```

Replace:
```js
      const deer = W.list.find(a => a.kind === 'unit' && a.type === 'deer' && a.owner === 0 && Math.hypot(a.x - home.x, a.y - home.y) < 20);
```
with:
```js
      const deer = this.deerNear(home);
```

Replace:
```js
      const unfinished = W.list.find(f => f.kind === 'bld' && f.type === 'farm' && f.owner === this.id && !f.built);
```
with:
```js
      const unfinished = this.unfinishedFarm();
```

- [ ] **Step 6: Military call sites**

Replace (in `needNaval`):
```js
    return en.some(i => { const b = W.list.find(e => e.owner === i && e.kind === 'bld'); if (!b) return false;
```
with:
```js
    return en.some(i => { const b = this.firstBuilding(i); if (!b) return false;
```

Replace (in `military`):
```js
    const enemyCav = W.list.filter(e => e.kind === 'unit' && isEnemy(this.id, e.owner) && hasTag(e.type, 'mounted')).length;
    const enemyArch = W.list.filter(e => e.kind === 'unit' && isEnemy(this.id, e.owner) && hasTag(e.type, 'archer')).length;
```
with:
```js
    const { cav: enemyCav, arch: enemyArch } = this.enemyUnitCounts();
```

Replace (monks fetching relics):
```js
      const r = W.list.filter(r => r.kind === 'relic' && !r.carrier && !r.inBld && W.map.landReg[W.map.idx(r.x, r.y)] === reg && !W.list.some(o => o.kind === 'unit' && o.type === 'monk' && o.owner === this.id && o.order && o.order.id === r.id)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
```
with:
```js
      const r = this.relicFor(m, reg);
```

Replace (in `targetPlayer`):
```js
const ba = W.list.find(e => e.owner === a && e.kind === 'bld'), bb = W.list.find(e => e.owner === b && e.kind === 'bld');
```
with:
```js
const ba = this.firstBuilding(a), bb = this.firstBuilding(b);
```

Replace (in `pressAttack`; the loop moved into `attackTargets`):
```js
    // nearest enemy building (non wall), prefer TC/castle, and track nearby fortifications for siege
    let tgt = null, bd = 1e9, fortTgt = null, fbd = 1e9;
    for (const e of W.list) {
      if (e.owner !== tp || e.dead) continue;
      if (e.kind === 'bld' && (BUILDINGS[e.type].wall)) continue;
      if (e.kind === 'unit' && (e.inside || UNITS[e.type].naval)) continue;
      const c = center(e), dist = Math.hypot(c.x - cx, c.y - cy);
      const d = dist - (e.type === 'tc' || e.type === 'castle' ? 4 : 0) + (e.kind === 'unit' ? 6 : 0);
      if (d < bd) { bd = d; tgt = e; }
      if (e.kind === 'bld' && (e.type === 'castle' || e.type === 'tower' || e.type === 'tc') && dist < fbd) { fbd = dist; fortTgt = e; }
    }
    if (!tgt) return;
```
with:
```js
    const { tgt, fortTgt } = this.attackTargets(tp, cx, cy);
    if (!tgt) return;
```

- [ ] **Step 7: Geology**

In `game/js/geology.js`, replace:
```js
canPlace=function(p,type,x,y,ignoreExplored){const error=geologyPlace(p,type,x,y,ignoreExplored);if(error)return error;const size=BUILDINGS[type].size;return W.list.some(e=>e.depth&&e.amount>0&&e.x>=x&&e.x<x+size&&e.y>=y&&e.y<y+size)?'A mineral seam is in the way':null;};
```
with:
```js
// Buried seams are gold, stone or coal deposits with a depth; the entity index finds the ones under a footprint.
function geologySeamUnder(x,y,size){return ['res:gold','res:stone','res:coal'].some(c=>idxRect(c,x,y,x+size-1,y+size-1).some(e=>e.depth&&e.amount>0));}
canPlace=function(p,type,x,y,ignoreExplored){const error=geologyPlace(p,type,x,y,ignoreExplored);if(error)return error;const size=BUILDINGS[type].size;return geologySeamUnder(x,y,size)?'A mineral seam is in the way':null;};
```

Replace:
```js
const geologyAssign=AIPlayer.prototype.assign;
```
with:
```js
function geologyBuriedNear(v,res,home){return idxNear('res:'+res,home.x,home.y,35).filter(e=>e.amount>0&&!mineAccessible(e)&&Math.hypot(e.x-home.x,e.y-home.y)<35&&adjReachable(v,e));}
function geologyCoalNear(p){return idxNear('res:coal',p.startX,p.startY,40).some(e=>Math.hypot(e.x-p.startX,e.y-p.startY)<40);}
const geologyAssign=AIPlayer.prototype.assign;
```

Replace:
```js
  const home=this.home(),targets=W.list.filter(e=>e.type===res&&e.amount>0&&!mineAccessible(e)&&Math.hypot(e.x-home.x,e.y-home.y)<35&&adjReachable(v,e));
```
with:
```js
  const home=this.home(),targets=geologyBuriedNear(v,res,home);
```

Replace:
```js
(!TERRA.enabled||!W.list.some(e=>e.type==='coal'&&Math.hypot(e.x-p.startX,e.y-p.startY)<40)))marketTrade(p,'coal',true);};
```
with:
```js
(!TERRA.enabled||!geologyCoalNear(p)))marketTrade(p,'coal',true);};
```

- [ ] **Step 8: Fish restocking (`wmFishTick`)**

`idxAll('res:fish')` lists the shoals in `W.list` order; the restocking draws `simRandom` per water body in the order the bodies were first met, so that order must not change.

In `game/js/water.js`, replace:
```js
function wmFishTick(dt) {
```
with:
```js
function wmUnitOnTile(x, y) { return idxRect('unit', x - 0.5, y - 0.5, x + 1.5, y + 1.5).some(u => Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); }
function wmFishTick(dt) {
```

Replace:
```js
  for (const e of W.list) {
    if (e.kind !== 'res' || e.type !== 'fish' || e.dead) continue;
    const b = waterBodyAt(map, e.x, e.y); if (!b) continue;
```
with:
```js
  for (const e of idxAll('res:fish')) {   // every shoal in W.list order (the restocking below draws simRandom per body)
    if (e.dead) continue;
    const b = waterBodyAt(map, e.x, e.y); if (!b) continue;
```

Replace:
```js
      if (W.list.some(u => u.kind === 'unit' && Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1)) continue;
```
with:
```js
      if (wmUnitOnTile(x, y)) continue;
```

- [ ] **Step 9: Run the test**

Run: `node tests/index-ai.test.js`
Expected (about 50 s; observed while planning):
```
PASS every AI, geology and water query equals its old W.list scan (8091 comparisons in 8 game minutes)  {"t":480.00000000007486,"total":8091,"wrong":{},"counts":{...}}
PASS 200 map, 8 AI players, 90 game seconds: the indexed match ends in exactly the brute-force state  {"brute":{"aiMs":5.215,"tickMs":10.007,"units":103,"hash":"a0fceefed740ac8c3bbe1fbcb551f0edc7145f65","aiErrors":0},"indexed":{"aiMs":0.726,"tickMs":3.989,"units":103,"hash":"a0fceefed740ac8c3bbe1fbcb551f0edc7145f65","aiErrors":0},"ratio":7.2}
PASS AI time per tick drops 7.2× with the index (at least 3×)  {...}
3 passed, 0 failed
```
All 25 query names must appear in `counts` (the test checks it).

- [ ] **Step 10: The simulation is unchanged**

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed` with the Task 4 hashes. This is the roadmap's "same outcome signature before and after".

- [ ] **Step 11: A test that hands sheep over by writing `owner` directly**

`tests/tactics.test.js:101` gives player 2 some sheep with `s.owner=2` and calls `p2.ai.assign` on the same tick. The AI now reads owner lists from the index, which only `idxSetOwner` updates at once (`idxSync` would catch the write on the next tick). Run: `node tests/tactics.test.js`
Expected: FAIL, `16 passed, 1 failed`, the failing check ending in `"sameSheep":false,"deposited":true}`.

In `tests/tactics.test.js`, replace:
```js
Math.hypot(s.x-W.players[2].startX,s.y-W.players[2].startY)<12) s.owner=2;
```
with:
```js
Math.hypot(s.x-W.players[2].startX,s.y-W.players[2].startY)<12) idxSetOwner(s,2);
```

Run: `node tests/tactics.test.js`
Expected: `17 passed, 0 failed`.

- [ ] **Step 12: Every node suite**

Run: `npm run test:syntax` then `npm test`
Expected: `index-ai.test.js             3 passed, 0 failed` and `Total: 359 checks passed; 0 suites failed.` `tests/perf.test.js` now has headroom: its 8-player mean dropped well below the 1.1 budget.

- [ ] **Step 13: Commit**

```bash
git add game/js/ai.js game/js/geology.js game/js/water.js tests/index-ai.test.js tests/tactics.test.js
git commit -m "perf(ai): AI, geology and fish-stock scans use the entity index

Every replaced W.list scan becomes a named query compared with the old
scan 8,091 times through an 8-minute match. On a 200 map with 8 AIs the
indexed match ends in the brute-force state and the AI's time per tick
drops 7x; the golden signatures are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Stagger the AI phase

Every `AIPlayer` starts with `acc = 0` and runs its full update when `acc` reaches 1 s (ai.js:43-46). All AIs are created on the same tick (ui.js:340), so they all think on the same tick: one heavy tick per second, the 1 Hz hitch of E§5.2 (browser p99 with 8 players: 80 ms at 200, 126 ms at 256). Player k now starts with `acc = (k − 1) / players`, so the updates spread over the second. With 8 players and 20 ticks per second the first updates fall on ticks 20, 18, 15, 13, 10, 8, 5, 3; every later update keeps its phase, because every AI then counts the same 20 ticks from 0.

This is the one deliberate change to match outcomes in this phase: AI decisions happen on other ticks, so the golden signatures are re-recorded in Step 6.

**Files:**
- Modify: `game/js/ai.js:26` (the `AIPlayer` constructor)
- Create: `tests/ai-stagger.test.js`
- Modify: `tests/fixtures/sim-signatures.json` (re-recorded)

**Interfaces:**
- Consumes: `W.players` (the player count when the AI is created).
- Produces: `AIPlayer#acc` starts at `((p.id - 1) % slots) / slots`, where `slots = max(1, W.players.length - 1)`. Saves keep `acc`, so a resumed match keeps its phases. The AI Assist's `AIPlayer` for player 1 starts at 0, as before.

- [ ] **Step 1: Write the failing test**

Create `tests/ai-stagger.test.js`:
```js
// Staggered AI: each computer player's once-a-second update runs on its own tick, so 8 AIs no longer all think on
// the same tick (the 1 Hz hitch of the map evaluation, E§5.2). node tests/ai-stagger.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const S = JSON.parse(run(`(() => {
  const n = 8, spec = generateMapSpec({ size: 'medium', seed: 33, mapType: 'land', numPlayers: n });
  createWorld(spec, { players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const byTick = new Map(), perPlayer = {}; const eco = AIPlayer.prototype.economy;
  AIPlayer.prototype.economy = function (dt) { byTick.set(W.tick, (byTick.get(W.tick) || 0) + 1); perPlayer[this.id] = (perPlayer[this.id] || 0) + 1; return eco.call(this, dt); };
  for (let i = 0; i < 60 * 20; i++) worldTick(0.05);
  AIPlayer.prototype.economy = eco;
  const crowded = [...byTick.values()].filter(c => c > 1).length, most = Math.max(...byTick.values());
  return JSON.stringify({ updates: [...byTick.values()].reduce((a, b) => a + b, 0), ticksWithUpdates: byTick.size, crowded, most, perPlayer });
})()`));
ok('8 AI players over 60 game seconds: no two run their update on the same tick', S.crowded === 0, S);
ok('every AI still updates once a game second', Object.keys(S.perPlayer).length === 8 && Object.values(S.perPlayer).every(c => c >= 59 && c <= 60), S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/ai-stagger.test.js`
Expected: FAIL. Every update tick holds all 8 AIs:
```
FAIL 8 AI players over 60 game seconds: no two run their update on the same tick  {"updates":480,"ticksWithUpdates":60,"crowded":60,"most":8,"perPlayer":{...}}
PASS every AI still updates once a game second  {...}
1 passed, 1 failed
```

- [ ] **Step 3: Give each player its own phase**

In `game/js/ai.js`, replace:
```js
    this.t = 0; this.acc = 0; this.state = 'boom'; this.attitude = {}; this.lastAttackBy = {};
```
with:
```js
    // Each player's once-a-second update runs on its own tick: player k starts (k - 1) / players of a second into its
    // clock, so several AIs no longer all think on the same tick (the 1 Hz hitch).
    const slots = Math.max(1, W.players.length - 1);
    this.t = 0; this.acc = ((p.id - 1) % slots) / slots; this.state = 'boom'; this.attitude = {}; this.lastAttackBy = {};
```

- [ ] **Step 4: Run the test again**

Run: `node tests/ai-stagger.test.js`
Expected (observed while planning):
```
PASS 8 AI players over 60 game seconds: no two run their update on the same tick  {"updates":480,"ticksWithUpdates":480,"crowded":0,"most":1,"perPlayer":{"1":60,"2":60,"3":60,"4":60,"5":60,"6":60,"7":60,"8":60}}
PASS every AI still updates once a game second  {...}
2 passed, 0 failed
```

- [ ] **Step 5: See the golden signatures change, as expected**

Run: `node tests/sim-signature.test.js`
Expected: FAIL on both scenarios (`"expected":"44241bbc…"` against a new `"got"` hash). The index did not move them (Tasks 4–6 kept them); the stagger does, on purpose.

- [ ] **Step 6: Re-record them deliberately**

Run: `AOR_RECORD=1 node tests/sim-signature.test.js`
Expected (observed while planning):
```
recorded tiny-land-2p-feudal f620967b4318fae0eb0477b6cfc44259a3e3ec66 {"hash":"f620967b4318fae0eb0477b6cfc44259a3e3ec66","t":600,"entities":940,"aiErrors":0}
recorded small-coastal-3p-castle f3599320291fc01383e6d58f4c82a3230c7b398b {"hash":"f3599320291fc01383e6d58f4c82a3230c7b398b","t":600,"entities":1455,"aiErrors":0}
PASS signatures recorded  {...}
1 passed, 0 failed
```
Then run `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`. From now on Task 8 must keep these new hashes.

- [ ] **Step 7: Every node suite**

Run: `npm test`
Expected: `ai-stagger.test.js           2 passed, 0 failed` and `Total: 361 checks passed; 0 suites failed.` The suites with fixed AI scenarios (assist, tactics, extras, victory, command's 12-minute soak) still pass with the new timing.

- [ ] **Step 8: Commit**

```bash
git add game/js/ai.js tests/ai-stagger.test.js tests/fixtures/sim-signatures.json
git commit -m "perf(ai): stagger each AI player's once-a-second update

Player k starts its update clock (k - 1) / players of a second ahead, so
8 AIs no longer all think on the same tick (the 1 Hz hitch). The golden
signatures are re-recorded on purpose: AI decisions now fall on other
ticks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Render and input scans through the index

Every frame `renderWorld` culls all of `W.list` (render.js:1273-1287), `hitTest` scans it while the mouse is over the map (ui.js:601), `vicWithGhosts` scans it for hidden enemy buildings (victory.js:542), and every 0.4 s the minimap draws one rectangle per entity, trees included (render.js:1369-1385). The 2.5D view's `visibleEntities` does the same (renderer25d.js:299-315).

**How each scan becomes exact:**
- **Fog-memory ghosts.** `vicWithGhosts` (victory.js:538-562) pushes remembered enemy buildings into `W.list` around `renderWorld` and `renderMinimap` and takes them out afterwards. The index never holds them, so the new loops add `idxGhosts()` (the trailing ghost entries of `W.list`) after the index's entities, where the old loops met them.
- **Order.** Candidates are sorted by id (`W.list` order). `renderWorld` sorts the visible set by depth with a stable sort, so its draw order is unchanged, and `hitTest`'s strict comparisons keep the same pick on ties.
- **Margins.** `renderWorld` tests an entity's centre at height 0 against the view rectangle. The rectangle's bounds are inverted to tile coordinates, then widened by 3 tiles, because a centre lies at most 2.5 tiles past the position the index files an entity under. `hitTest`'s boxes are in screen space. The tallest art is the wonder (170 px), plus 4 elevation steps of 14 px; a box therefore reaches at most about 9 tiles from the cursor's ground point at height 0, and the index is asked for ±12. The 2.5D view uses the window `syncEntities` places entities in (render.js's `viewCandidates` with that window).
- **Minimap.** Trees move to a cached map-sized layer, drawn before the other entities. The base image is keyed on `map.version`, which chopping a tree does not change, so the layer has its own key: `IDX.rev.get('res:tree')`, plus under fog the number of explored tiles. The old loop skipped trees on unexplored tiles, and the layer leaves those pixels empty. The `mil` and `land` filters hide trees, so the layer is drawn only when `mmFilterPass` lets a tree through. Trees are now always under units and buildings; before, a tree with a larger id could cover a starting villager's dot.
- **Reference.** With `IDX.brute = true` every new loop runs on `W.list` again, which is the old code path. The browser spec compares the two on the same frame: the sequence of drawn entities, a checksum of the pixels, and `hitTest` on points aimed at entities' art.

**Files:**
- Modify: `game/js/render.js:1258` (new `viewCandidates` before `renderWorld`), `:1271-1273` (the collect loop), `:1344` (new `mmTreeLayer` and `mmEntities` after `MM`), `:1367-1369` (the minimap entity pass)
- Modify: `game/js/ui.js:596-597` (new `hitCandidates` before `hitTest`), `:600-601` (the hit loop)
- Modify: `game/js/victory.js:514-516` (`vicMemUpdate`), `:541-543` (`vicWithGhosts`)
- Modify: `game/js/renderer25d.js:299-301` (`candidates()` and `visibleEntities`)
- Create: `tests/browser/index-render.spec.js`

**Interfaces:**
- Consumes: `idxEnsure`, `idxAll`, `idxRectAll(x0, y0, x1, y1)`, `idxGhosts()`, `IDX.rev`, `IDX.brute` (Task 4).
- Produces: `viewCandidates(vx0, vx1, vy0, vy1) → entity[]` (render.js), `hitCandidates(sx, sy) → entity[]` (ui.js), `mmTreeLayer(explored) → canvas` and `mmEntities() → entity[]` (render.js), `T25D.candidates() → entity[]` (renderer25d.js). Phase 5 (rendering at scale) and phase 6 (minimap) build on `mmTreeLayer` and `viewCandidates`.

- [ ] **Step 1: Write the browser spec**

Create `tests/browser/index-render.spec.js`:
```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/index-render.spec.js --reporter=line`
Expected: FAIL. The first test passes trivially (both paths still scan `W.list`), the minimap test fails with `ReferenceError: mmTreeLayer is not defined`, and the 2.5D test passes trivially:
```
  1 failed
    …index-render.spec.js:… › the minimap paints trees from a cached layer and every other entity as before
  2 passed
```

- [ ] **Step 3: `renderWorld` culls through the index**

In `game/js/render.js`, replace:
```js
function renderWorld(ctx, opts = {}) {
```
with:
```js
// Entities that can be drawn in a view rectangle (world pixels at zoom 1, vx0..vx1 by vy0..vy1, tested on an entity's
// centre at height 0), in W.list order: the index's entities around the view, then whatever W.list holds past the index
// (the fog-memory ghosts that vicWithGhosts appends while a frame or the minimap is drawn). IDX.brute gives the old scan.
function viewCandidates(vx0, vx1, vy0, vy1) {
  if (IDX.brute || !idxEnsure()) return W.list;
  // iso(x, y, 0) = ((x - y)·TW/2, (x + y)·TH/2), inverted at the rectangle's bounds. A centre lies at most 2.5 tiles
  // (half a wonder) past the position the index files an entity under, so the tile rectangle is widened by 3.
  const u0 = vx0 / (TW / 2), u1 = vx1 / (TW / 2), v0 = vy0 / (TH / 2), v1 = vy1 / (TH / 2);
  return idxRectAll((u0 + v0) / 2 - 3, (v0 - u1) / 2 - 3, (u1 + v1) / 2 + 3, (v1 - u0) / 2 + 3).concat(idxGhosts());
}
function renderWorld(ctx, opts = {}) {
```

Replace:
```js
  // collect
  const vis = [];
  for (const e of W.list) {
```
with:
```js
  // collect
  const vis = [];
  for (const e of viewCandidates(vx0, vx1, vy0, vy1)) {
```

- [ ] **Step 4: The minimap's tree layer**

Replace:
```js
const MM = { cv: null, base: null, baseVer: -1, t: 0 };
```
with:
```js
const MM = { cv: null, base: null, baseVer: -1, t: 0 };
// Trees are most of a map's entities. They are painted once into a map-sized layer (one pixel per tree tile, only the
// explored ones under fog) and the layer is rebuilt only when a tree is added or removed (IDX.rev) or more of the map
// is explored, instead of one rectangle per tree on every minimap refresh.
function mmTreeLayer(explored) {
  const n = W.n, rev = IDX.rev.get('res:tree') || 0;
  let seen = -1; if (explored) { seen = 0; for (let i = 0; i < explored.length; i++) seen += explored[i]; }
  const key = rev + ':' + seen;
  if (MM.trees && MM.trees.width === n && MM.treeKey === key && MM.treeMap === W.map) return MM.trees;
  if (!MM.trees || MM.trees.width !== n) { MM.trees = document.createElement('canvas'); MM.trees.width = MM.trees.height = n; }
  const tg = MM.trees.getContext('2d'), img = tg.createImageData(n, n), d = img.data;
  for (const e of idxAll('res:tree')) {
    const x = e.x | 0, y = e.y | 0;
    if (x < 0 || y < 0 || x >= n || y >= n || (explored && !explored[y * n + x])) continue;
    const i = (y * n + x) * 4; d[i] = 0x1f; d[i + 1] = 0x4a; d[i + 2] = 0x1a; d[i + 3] = 255;
  }
  tg.putImageData(img, 0, 0); MM.treeKey = key; MM.treeMap = W.map;
  return MM.trees;
}
// Every entity the minimap draws one by one: all but the trees, in W.list order, then the fog-memory ghosts.
function mmEntities() {
  const out = [];
  for (const [cat, set] of IDX.all) if (cat !== 'res:tree') for (const e of set) out.push(e);
  return out.sort(idxById).concat(idxGhosts());
}
```

Replace:
```js
  g.drawImage(MM.base, 0, 0);
  // entities (MM.filter: 'all', 'mil', 'eco' or 'land')
  for (const e of W.list) {
```
with:
```js
  g.drawImage(MM.base, 0, 0);
  const fogged = !editor && W.settings.fog !== 'none' && !W.noFog, layered = !IDX.brute && idxEnsure();
  if (layered && (!MM.filter || MM.filter === 'all' || mmFilterPass({ kind: 'res', type: 'tree' }, MM.filter))) g.drawImage(mmTreeLayer(fogged ? human.explored : null), 0, 0);
  // entities (MM.filter: 'all', 'mil', 'eco' or 'land')
  for (const e of layered ? mmEntities() : W.list) {
```

- [ ] **Step 5: `hitTest` asks the index**

In `game/js/ui.js`, replace:
```js
// ---------- input ----------
function hitTest(sx, sy, opts = {}) {
```
with:
```js
// ---------- input ----------
// Entities whose hit box can hold the cursor, in W.list order. A hit box reaches about 9 tiles at most from the
// cursor's ground point at height 0 (a wonder's art is 170 px tall, plus 4 elevation steps), so the index is asked for
// a square of 12 tiles around it. IDX.brute gives the old scan.
function hitCandidates(sx, sy) {
  if (IDX.brute || !idxEnsure()) return W.list;
  const wx = (sx - R.cw / 2) / R.cam.zoom + R.cam.x, wy = (sy - R.ch / 2) / R.cam.zoom + R.cam.y;
  const tx = (wx / (TW / 2) + wy / (TH / 2)) / 2, ty = (wy / (TH / 2) - wx / (TW / 2)) / 2, m = 12;
  return idxRectAll(tx - m, ty - m, tx + m, ty + m);
}
function hitTest(sx, sy, opts = {}) {
```

Replace:
```js
  const human = W.players[W.humanId];
  for (const e of W.list) {
    if (e.kind === 'unit' && (e.inside || e.dying)) continue;
```
with:
```js
  const human = W.players[W.humanId];
  for (const e of hitCandidates(sx, sy)) {
    if (e.kind === 'unit' && (e.inside || e.dying)) continue;
```

- [ ] **Step 6: Fog memory reads the building list**

In `game/js/victory.js`, replace:
```js
  const mem = p.memory;
  for (const b of W.list) {
    if (b.kind !== 'bld' || b.owner === p.id || b.dead || BUILDINGS[b.type].farm) continue;
```
with:
```js
  const mem = p.memory;
  for (const b of idxAll('bld')) {   // every building, in W.list order
    if (b.owner === p.id || b.dead || BUILDINGS[b.type].farm) continue;
```

Replace:
```js
  const hidden = [], ghosts = [];
  for (const b of W.list) {
    if (b.kind !== 'bld' || b.owner === W.humanId || BUILDINGS[b.type].farm) continue;
```
with:
```js
  const hidden = [], ghosts = [];
  for (const b of idxAll('bld')) {   // every building, in W.list order
    if (b.owner === W.humanId || BUILDINGS[b.type].farm) continue;
```

- [ ] **Step 7: 2.5D**

In `game/js/renderer25d.js`, replace:
```js
  visibleEntities(opts) {
    const fog = !opts.editor && W.settings.fog !== 'none' && !W.noFog, p=W.players[W.humanId], out=[];
    for(const e of W.list) {
```
with:
```js
  // The entities syncEntities can place: its window is a centre's 2D screen position within -220..cw+220 by
  // -150..ch+260, so the index is asked for that view (viewCandidates in render.js).
  candidates() {
    const z=R.cam.zoom;
    return viewCandidates(R.cam.x+(-220-R.cw/2)/z,R.cam.x+(R.cw/2+220)/z,R.cam.y+(-150-R.ch/2)/z,R.cam.y+(R.ch/2+260)/z);
  },
  visibleEntities(opts) {
    const fog = !opts.editor && W.settings.fog !== 'none' && !W.noFog, p=W.players[W.humanId], out=[];
    for(const e of this.candidates()) {
```

- [ ] **Step 8: Run the browser spec again**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/index-render.spec.js --reporter=line`
Expected: `3 passed`. Observed while planning: 50 of 50 camera positions drew the same sequence (11,134 draws, 44 of them ghosts) with the same pixel checksum; all 1,500 picks matched (454 of them hit an entity); the minimap pass went from 881 rectangles to 157, exactly one fewer per explored tree (724), and the tree layer held those 724 pixels; in 2.5D 20 of 20 views placed the same 5,478 entities, ghosts included. The test was run 3 times in a row with the same result.

- [ ] **Step 9: The default browser suite and the screenshots**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser`
Expected: every test passes (the art spec included; it has no pixel baselines, which is why Step 8 compares pixels itself). Then run `git status --short` and restore the screenshots with `git checkout -- assets/screenshots` if they are listed.

- [ ] **Step 10: Node suites and the signatures**

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed` with the hashes recorded in Task 7 (the render changes touch no simulation state; `vicMemUpdate` only fills the human's memory).
Run: `npm run test:syntax` then `npm test`
Expected: `Total: 361 checks passed; 0 suites failed.`

- [ ] **Step 11: Commit**

```bash
git add game/js/render.js game/js/ui.js game/js/victory.js game/js/renderer25d.js tests/browser/index-render.spec.js
git commit -m "perf(render): view culling, hit-testing, fog memory and the minimap use the entity index

renderWorld, hitTest and 2.5D take candidates from the index around the
view (fog-memory ghosts appended where W.list had them); the minimap
paints trees from a cached layer keyed on tree changes and exploration.
A browser spec compares each with the old scan (IDX.brute): same draw
sequence and pixels on 50 cameras, same picks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Phase 2 performance rows

Measure phase 2 with the same harness as the phase 1 baseline, record the browser rows and a vm comparison in `docs/maps-perf-baseline.md`, and run every suite.

**Files:**
- Create: `tests/perf-vm.js` (on-demand vm comparison; not part of `npm test`)
- Modify: `docs/maps-perf-baseline.md` (append the phase 2 rows and the vm table)

**Interfaces:**
- Consumes: `npm run test:perf` (Task 3), `IDX.brute` (Task 4).
- Produces: the phase 2 rows that phase 3 compares against.

- [ ] **Step 1: Create the vm comparison script**

Create `tests/perf-vm.js`:
```js
// Simulation cost in the node vm harness, before and after the entity index: the same match is played with every
// index query answered by a W.list scan (IDX.brute, the cost of the old scans) and with the index.
// 8 AI players on land, seed 33, Feudal start, high resources; 600 warm-up ticks, then 1200 timed ticks.
// Not part of npm test (it takes about two minutes): node tests/perf-vm.js [sizes]   (default 200,256)
const harness = require('./engine-harness');
const sizes = (process.argv[2] || '200,256').split(',').map(Number);
function play(n, brute) {
  const { run } = harness();
  return JSON.parse(run(`(() => {
    const spec = generateMapSpec({ size: ${n}, seed: 33, mapType: 'land', numPlayers: 8 });
    createWorld(spec, { players: Array.from({ length: 8 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
    W.spectate = true; IDX.brute = ${brute};
    let ai = 0; const up = AIPlayer.prototype.update;
    AIPlayer.prototype.update = function (dt) { const t0 = performance.now(); try { return up.call(this, dt); } finally { ai += performance.now() - t0; } };
    for (let i = 0; i < 600; i++) worldTick(0.05);
    ai = 0; const ts = [];
    for (let i = 0; i < 1200; i++) { const t0 = performance.now(); worldTick(0.05); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    return JSON.stringify({ mean: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(2), p99: +ts[Math.floor(ts.length * 0.99)].toFixed(1), ai: +(ai / 1200).toFixed(2), entities: W.list.length });
  })()`));
}
console.log('| n | vm tick mean / p99 ms, W.list scans | vm tick mean / p99 ms, index | vm AI ms per tick, scans → index |');
console.log('| --- | --- | --- | --- |');
for (const n of sizes) {
  const a = play(n, true), b = play(n, false);
  console.log(`| ${n} | ${a.mean} / ${a.p99} | ${b.mean} / ${b.p99} | ${a.ai} → ${b.ai} |`);
}
```

- [ ] **Step 2: Run it**

Run: `node tests/perf-vm.js`
Expected (about 2 minutes; observed while planning; both columns include the Task 7 stagger, the left one answers every index query by scanning `W.list`, which is what the code cost before Tasks 4–6):

| n | vm tick mean / p99 ms, W.list scans | vm tick mean / p99 ms, index | vm AI ms per tick, scans → index |
| --- | --- | --- | --- |
| 200 | 10.25 / 49.5 | 4.11 / 11 | 5.42 → 0.9 |
| 256 | 13.34 / 43.3 | 3.39 / 7.4 | 7.23 → 0.35 |


- [ ] **Step 3: The browser rows**

Close other heavy programs first.
Run: `AOR_PERF_LABEL="phase 2 indexes + stagger" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf`
Expected: `3 passed`, three new rows in `docs/maps-perf-baseline.md`. Observed while planning (compare with the phase 1 rows in Task 3, Step 7):

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-18 | phase 2 indexes + stagger | unknown | gpu | 120 | 50 / 46 | 0.33 / 1.1 | 0.86 / 2.4 | 7 | 87 / 32 (40/40, 40/40) | 3.67 / 2.67 | 60 / 60 | 60 | 1,252,603 (14) | 353 |
| 2026-10-18 | phase 2 indexes + stagger | unknown | gpu | 200 | 120 / 114 | 0.66 / 2.7 | 1.37 / 5.1 | 8 | 218 / 90 (40/40, 40/40) | 4.54 / 3.81 | 60 / 60 | 60 | 3,172,827 (45) | 982 |
| 2026-10-18 | phase 2 indexes + stagger | unknown | gpu | 256 | 184 / 192 | 0.96 / 3.2 | 1.69 / 6.9 | 4 | 438 / 443 (40/40, 40/40) | 4.52 / 4.78 | 60 / 60 | 57.4 | 5,291,790 (75) | 1038 |


- [ ] **Step 4: Check the numbers against the roadmap**

Compare the new rows with the phase 1 rows:
- Tree search at 200: at most 50 µs (Task 5's acceptance; observed 8 µs, from 288).
- Tick mean at 200 and 256 lower than phase 1, for 3 and for 8 players (this task's acceptance; observed at 200 with 8 players 5.56 → 1.37 ms, at 256 8.25 → 1.69 ms).
- 8-player p99 at 200 at most 33 ms (Task 7's acceptance; observed 98.3 → 5.1 ms).
- The 40-knight order, 2D frame, fps, save size and cache columns stay about the same: phase 2 does not touch pathfinding, the terrain cache, fog or saves (phases 3–5).
If a number misses its target on your machine, run the spec once more with nothing else running before investigating; the tick columns are the ones phase 2 changes.

- [ ] **Step 5: Add the vm table to the baseline document**

Append to `docs/maps-perf-baseline.md` a heading and the table that Step 2 printed, under the browser rows:
```markdown

## Phase 2: vm tick, W.list scans against the index (node tests/perf-vm.js)

8 AI players on land, seed 33, 600 warm-up ticks and 1200 timed ticks in the node vm harness (slower than the browser).
```
followed by the four table lines printed in Step 2.

- [ ] **Step 6: Every suite**

Run: `npm run test:syntax`, then `npm test`
Expected: `Total: 361 checks passed; 0 suites failed.`
Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser`
Expected: every test passes (47 tests observed while planning, with the new `index-render.spec.js` and the new assist test). Then run `git checkout -- assets/screenshots` if `git status --short` lists them.

- [ ] **Step 7: Commit**

```bash
git add tests/perf-vm.js docs/maps-perf-baseline.md
git commit -m "test(perf): phase 2 performance rows and the vm comparison

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After Task 9: finishing the phases

As the roadmap's "How each phase ends" requires:
- `npm test`, the full browser suite (then `git checkout -- assets/screenshots`), and `npm run test:perf`, compared with the phase 1 rows. Tasks 8 and 9 already ran all three.
- A final whole-branch review of Tasks 1–9 (superpowers:requesting-code-review). Points for the reviewer:
  - every owner change in game code goes through `idxSetOwner`;
  - every new loop over index lists keeps `W.list` order where the old loop depended on it;
  - `tests/sim-signature.test.js` passes with the hashes recorded in Task 7.
- Merge on the user's choice (superpowers:finishing-a-development-branch).

**For later phases.** Code that writes `e.owner`, or moves a building or a resource, must call `idxSetOwner` or `idxMoved`. A test that writes `owner` directly sees stale owner lists until the next tick (Task 6, Step 11). Phase 3 (pathfinding) and phase 7 (content) change match outcomes. Each re-records `tests/fixtures/sim-signatures.json` with `AOR_RECORD=1 node tests/sim-signature.test.js` and says why in its commit.
