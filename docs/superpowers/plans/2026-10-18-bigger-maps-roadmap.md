# Bigger Maps Roadmap (all phases)

> **For agentic workers:** this is the phase roadmap. Each phase is executed from its own detailed plan, with REQUIRED SUB-SKILL superpowers:subagent-driven-development (recommended) or superpowers:executing-plans:
> - Phases 1–2 already have one: [2026-10-18-bigger-maps-phase1-2.md](2026-10-18-bigger-maps-phase1-2.md).
> - Each later phase gets its detailed plan (superpowers:writing-plans) when it starts, written against the code as it is then.
> - Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make maps much bigger: default 200×200 for 3 players, presets up to 480. Every system must scale to 480, so the game stays smooth, saveable, navigable and well paced.

**Architecture:**
- **Phases 1–5:** remove the scaling bottlenecks the evaluation measured: whole-list scans, AI phase alignment, per-unit A*, unbounded render caches, n² fog, single-mesh 2.5D, `localStorage` saves.
- **Phases 6–7:** add navigation for huge maps and content that fills them.
- **Phase 8:** switch on the new presets and defaults, then re-measure against the budgets.
- **Phase 9:** the forest layer, only if phase 8 misses a budget.

**Tech Stack:** plain browser JS (`game/js/*.js`, loaded in order by `game/index.html`), three.js for 2.5D, node vm test harness (`tests/*.test.js`, `tests/engine-harness.js`), and Playwright Chromium (`tests/browser/*.spec.js`).

**Spec:** [docs/superpowers/specs/2026-10-18-bigger-maps-design.md](../specs/2026-10-18-bigger-maps-design.md). **Evidence:** [docs/superpowers/specs/2026-10-18-map-evaluation.md](../specs/2026-10-18-map-evaluation.md), cited as E§n.

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

## How each phase ends

Every phase finishes with these steps:
- `npm test`, the full browser suite (then restore the screenshots), and `npm run test:perf` from phase 1 on, compared with the previous phase's baseline;
- a final whole-branch review;
- merge on the user's choice.

**Phase 1 records the baseline numbers** in `docs/maps-perf-baseline.md`. Every later phase appends its own row, so progress against the budgets stays visible.

---

## Phase 1: Test hygiene and the performance baseline

*Detailed plan: [2026-10-18-bigger-maps-phase1-2.md](2026-10-18-bigger-maps-phase1-2.md), Tasks 1–3.*

- **Task 1. Fix `tests/command.test.js`.**
  - The 44×44 arena (line 19) runs out of flat land before `open(16,6)` at line 164, which crashes the file and hides 10 checks. Set `A = 48`.
  - Acceptance: `node tests/command.test.js` reports 24 passed, 0 failed, and `npm test` has no failing suite.
- **Task 2. Stabilise the flaky "shared control supports mouse selection…" test in `tests/browser/assist.spec.js`.**
  - It intermittently times out clicking `#b-assist-return`; 4 of 6 runs failed. The root cause is not the command panel: assist.js:196-214 deletes and rebuilds `#assist-control` and its button on every `renderSelInfo`, which main.js runs every 0.25 s even while paused. Playwright's click therefore hits a detached node. The fix reuses the row while its text is unchanged.
  - Acceptance: 5 consecutive passes.
- **Task 3. Performance harness `tests/browser/maps-perf.spec.js` and `npm run test:perf`.**
  - It reproduces the evaluation's measurements (E§3 T1–T5):
    - generation time
    - steady tick mean and p99 with 3 and 8 AI players
    - one 40-knight cross-map order
    - 2D fps at zoom 0.55 and 1
    - 2.5D fps
    - save size and serialise time
    - terrain-cache bytes after a scripted pan
  - It runs at 120, 200 and 256 now, and at 320 and 480 once phase 8 lifts the cap. Until then, the larger sizes can use a test-only cap override (the evaluation's runtime patch).
  - It writes the results as JSON to `test-results/maps-perf.json` and as a table row in `docs/maps-perf-baseline.md`.
  - It is excluded from the default browser run (`testIgnore`) and run with `npm run test:perf`.

## Phase 2: Indexes and staggered AI

*Detailed plan: [2026-10-18-bigger-maps-phase1-2.md](2026-10-18-bigger-maps-phase1-2.md), Tasks 4–9.*

- **Task 4. Entity index module `game/js/index.js`, loaded right after world.js.**
  - `IDX.cell = 8`.
  - Buckets per cell by category: `unit`, `bld`, `res:<type>`, `relic`. Per-owner sets: units, buildings, villagers. Per-owner building counts by type.
  - Kept up to date by hooking `addEnt` and `removeEnt` and the owner-change paths (conversion, `ownerChange`). Unit movement updates the buckets when a unit crosses a cell (alongside the existing spatial key, world.js:400).
  - API:
    - `idxNear(cat, x, y, r)` yields entities within r, cell by cell in rings.
    - `idxOwned(owner, kind)` returns a set.
    - `idxCount(owner, type)` returns an int.
    - `idxRect(cat, x0, y0, x1, y1)` returns the entities in that rectangle.
  - Rebuilt from `W.list` on `worldCreated` and `worldRestored`.
  - Acceptance: a property test asserts that after 10 random game minutes every bucket equals a brute-force scan.
- **Task 5. Resource and drop-site searches through the index.**
  - Covers `findNearestRes` (world.js:375-387), `nearestDrop` and `nearestOwn` (world.js:359-373), and `builtCount`/`hasBuilt` (world.js:629-630).
  - Acceptance: results are identical to the old scan on 500 random queries across 3 seeds (a differential test). `findNearestRes` at 200 is ≤ 0.05 ms.
- **Task 6. AI scans through the index.**
  - Covers `AIPlayer.mine()`, `tc()`, `home()`, `army()` and `needNaval` (ai.js:40-42, 83, 114, 169, 265-282, 411, 457, 506), plus the `W.list` scans in geology.js:92-106, water.js:339-376 (`wmFishTick`) and wells.js:110-116.
  - Acceptance: an AI-vs-AI fixed-seed 10-minute match gives the same outcome signature before and after (`signature()` in engine-harness.js), or every difference is explained by deterministic ordering. Vm AI time at 200 with 8 players drops at least 3×.
- **Task 7. Stagger the AI phase.**
  - Each `AIPlayer` starts with `acc = (slot / numAI)` seconds (ai.js:43-46).
  - Acceptance: with 8 AIs, no two run `update` on the same tick in a 60-second run, and browser p99 at 200 drops from 80 ms to at most 33 ms (perf spec).
- **Task 8. Render and input scans through the index.**
  - Covers `renderWorld` culling (render.js:1273-1287) with `idxRect` over the view, `hitTest` (ui.js:596-628), `vicWithGhosts` (victory.js:538-562), the minimap entity pass (render.js:1369-1385), which skips trees and draws them into the cached base image, and 2.5D `visibleEntities` (renderer25d.js:299-315).
  - Acceptance: screenshot parity on the art spec, and the visible set is identical to the old cull on 50 random camera positions.
- **Task 9. Phase 2 performance row.**
  - Acceptance: the perf spec shows the vm and browser tick drop at 200 and 256, and all suites are green.

## Phase 3: Hierarchical pathfinding and group routes

- **Task 1. Cluster graph module `game/js/hpa.js`.**
  - 16×16 clusters, with entrance spans on cluster borders and intra-cluster edge costs. There is one graph per movement class: land, and naval using the water passability.
  - It is built after `computeRegions`. `hpaDirty(x0,y0,x1,y1)` marks clusters, and they are rebuilt lazily on the next query. It is triggered by building placement and destruction, felled trees, terraform (terra.js) and editor strokes.
  - Acceptance: a node test checks that abstract connectivity matches `landReg` on 20 seeds × 3 map types.
- **Task 2. Abstract search and local refinement behind `findPath`** (map.js:150-198).
  - Unreachable goals return at once. The detailed plan uses the cluster graph's own connected components rather than `landReg`, because `computeRegions` misses diagonal steps past cliff corners (80 cases on 60 medium maps) and would refuse reachable goals.
  - The search queue is a typed-array heap.
  - Paths are refined segment by segment with the existing grid A*, bounded to a cluster pair.
  - Smoothing is bounded.
  - The 4,000-point cap (map.js:187) goes.
  - Acceptance: routes are at most 1.1× the length of the optimal grid A* on 500 random pairs. All movement, command, tactics, engineering and actors suites stay green.
- **Task 3. Group orders.**
  - `orderMove` (world.js:259-268) computes one route for the group leader, and the other units follow formation offsets (reusing `command.js` formation slots). They repath individually only when blocked.
  - Group orders count against the `PATHB` per-tick budget (polish.js:8-27).
  - `cmdFindBreach` (command.js:305-320) reuses the group route.
  - Acceptance: a 40-knight order across 256 takes ≤ 16 ms on the click frame, and every unit arrives.
- **Task 4. Stress tests.**
  - 480 with the cap override: every TC-to-TC route succeeds on land, coastal and islands with transport (the failures from E§5.3).
  - The perf row is updated.

## Phase 4: Saves v2, IndexedDB and editor storage

- **Task 1. Storage module `game/js/store.js`.**
  - IndexedDB database `aor`, with stores `saves` (manual slots 1–5 plus `auto`), `maps` (editor) and `meta`.
  - It is promise based, with a `localStorage` fallback when IndexedDB is unavailable.
  - Acceptance: node tests with a fake IndexedDB shim, plus a browser round trip.
- **Task 2. Save format v2 in session.js.**
  - Typed arrays (`ter`, `elev`, `blk`, `explored`, `visible`, …) are run-length encoded then base64. The duplicated `W.spec` layers are dropped (only the seed, settings and editor-map layers stay). Entity records are compact.
  - `MatchSave.parse` accepts v1 and v2. The 16e6 cap (session.js:86, 174) is replaced by a 256 MB sanity cap. The node and value caps (session.js:30-34) and the entity cap (:90) scale with n.
  - Acceptance:
    - a v1 fixture from today's build loads unchanged;
    - a v2 round trip equals the original signature;
    - a 480 save with 8 players is ≤ 6 MB.
- **Task 3. Autosave and export.**
  - Serialisation runs in idle-time slices (`requestIdleCallback`, with a time-slice fallback). It never stalls more than 8 ms per slice.
  - Every failure shows a message (session.js:192-199).
  - Export and import use gzip via `CompressionStream` and `DecompressionStream`.
  - Acceptance: no tick above 16 ms during an autosave at 256 (perf spec), and gzip export → import round trips.
- **Task 4. Editor storage and undo.**
  - Maps go into IndexedDB (editor.js:14-16). Undo stores the changed tiles (editor.js:62, 199).
  - Custom sizes up to 480 (editor.js:35, 95). The import limit (editor.js:140) is replaced by the sanity cap.
  - Acceptance: undo and redo restore exact layers, and memory for 60 strokes at 480 is ≤ 20 MB.
- **Task 5. Migration.** On first run, existing `localStorage` saves and maps are copied to IndexedDB, with the originals kept until a successful read-back.

## Phase 5: Rendering at scale

- **Task 1. 2D chunk cache budget** (render.js:72-83, 201-228).
  - A byte-based least-recently-used cache of about 200 MB.
  - Canvas scale by zoom: 1.5× at zoom ≥ 1, 1× at zoom ≥ 0.6, 0.75× below.
  - Chunks are prebuilt in a ring around the camera, within a 4 ms per-frame build budget.
  - Acceptance: cache bytes stay ≤ 600 MB after a full pan at 480, and no frame exceeds 50 ms when jumping the camera.
- **Task 2. Per-chunk HD terrain** (terrain.js:56, 377-425, 525-529).
  - HD terrain is built per chunk, with at least 12 px per tile at every n. `hdtSync` processes only dirty tiles.
  - Acceptance: the first-frame HD build at 480 is ≤ 150 ms, and a terraform flush is ≤ 5 ms.
- **Task 3. Fog** (fx.js:70-79, 470-505; render.js:1325-1341, 1388-1394).
  - Only dirty visibility tiles are updated. Clouds are a low-resolution noise texture drawn scaled. The minimap fog uses the same dirty set.
  - Acceptance: fog is ≤ 0.5 ms per frame at 480.
- **Task 4. 2.5D chunked terrain** (renderer25d.js:204-265, 405).
  - Indexed `BufferGeometry` in 32×32-tile chunks, with frustum culling and rebuilds only for dirty chunks.
  - Acceptance: ≥ 50 fps at 480, and the frame after a terraform at 480 is ≤ 20 ms.
- **Task 5. 2.5D fog texture** (renderer25d.js:288-297).
  - Fog is a `DataTexture` sampled in the terrain shader. The per-vertex colour rewrite goes.
  - Acceptance: `updateFog` is ≤ 0.5 ms at 480.
- **Task 6. Low-end check.**
  - Record SwiftShader fps at 200 and 480. The icon level of detail from phase 6 must keep 480 playable (≥ 25 fps) in software rendering.

## Phase 6: Navigation for huge maps

- **Task 1. Zoom range and icon level of detail.**
  - The in-game zoom range becomes 0.3–1.8 (ui.js:683, session.js:150).
  - Below 0.45, units draw as team-coloured icons and buildings as footprint-sized glyphs (render.js). The unit sprite-cache buckets get a bucket below 0.5 (units_hd.js:20), and the ambient-sound radius is clamped (audio.js:53).
  - Acceptance: a screenshot test at zoom 0.3 shows readable icons, with ≥ 50 fps at 480.
- **Task 2. Minimap** (render.js:1343-1400, hud.js:51-61, 120-127, main.js:48).
  - It gets larger within the HUD.
  - Static resources and terrain are baked into the cached base image. Only units, buildings and fog are redrawn.
  - The view box and alert rings are drawn in screen pixels, and units are at least 2 px.
  - Acceptance: the view box is visible at 480 (pixel test), and a minimap redraw is ≤ 1 ms.
- **Task 3. Strategic map overlay (new `game/js/strategic.js`).**
  - It shows terrain, territories, building icons, army clusters and alerts.
  - Click jumps the camera, the wheel zooms and dragging pans.
  - Its key goes in `CONTROL_DEFAULTS` (onboarding.js:30).
  - Acceptance: browser tests for the toggle, click-to-jump and the absence of pageerrors.
- **Task 4. Scrolling and camera.**
  - Scroll speed scales with zoom and n (ui.js:876-885, extras.js:370-383).
  - Drag-panning works in game.
  - `clampCam` limits the void past the map edge to at most ¼ screen (render.js:55-58).
  - Acceptance: crossing 480 at zoom 0.3 takes ≤ 5 s by edge scroll.
- **Task 5. Setup preview** (ui.js:191-208).
  - It generates the selected size, scaled into the preview, marks the starting positions, and generates off the click path.
  - Acceptance: the preview's n equals the selected size, and starts are drawn.

## Phase 7: Content and pacing at scale

- **Task 1. Precompute the start-distance field.** It replaces the per-tile `dStart` hypot loop (map.js:402) and is used by every placement pass.
- **Task 2. Expansion sites.**
  - Clusters of gold, stone, a forest edge and berries are placed by Poisson-disc sampling between starts on flat open land.
  - They mirror fairly: equal counts per player and equal distance quantiles.
  - Counts scale with area: about 2–3 per player at 200.
  - Acceptance: a fairness test checks that per-player distance quantiles differ by ≤ 10 % on 20 seeds × map types × player counts.
- **Task 3. Forests, wildlife and relics scale with area** (map.js:526-536, 570-588).
  - Large woods and forest belts come from area-scaled noise.
  - Wolves, deer and fish scale continuously, with no step at 120.
  - Relics: at least 5, area-scaled, with no cap of 10.
- **Task 4. Rivers and lakes** (water.js:128-292, map.js:404).
  - River count, width and fords scale with n, and great rivers are 4–8 tiles at 400 and up.
  - Lake noise frequency scales.
  - `wmStockFresh` becomes O(n²) once (water.js:294-317).
- **Task 5. Mountains** (map.js:222-381).
  - Range and pass widths scale with √n. Crag and mesa counts grow with area under a density cap.
  - The n ≤ 80 special case and the threshold steps are replaced by continuous functions.
- **Task 6. Natural passes** (map.js:625-667, water.js:326).
  - Passes are minimum-spanning-tree connections between start regions, routed by least-cost A* over elevation and terrain, and widened to 3 tiles.
  - The `objects.filter` call inside the loop is replaced by an occupancy grid.
  - Acceptance: every start pair is connected on 20 seeds, and no straight-line scars.
- **Task 7. Map types and real-world maps.**
  - Islands are sized by area per player (map.js:394, 417), and the coastal sea and inlet scale (map.js:411-414).
  - Geography masks are rebuilt at 512 (tools/build-geography.mjs:6, geography-data.js) and sampled bilinearly (geography.js:22). Start spacing scales with n and players (geography.js:30).
  - Coal, seams and fish scale with area (geology.js:61-83).
  - Acceptance: islands with 8 players keep 8 landmasses, and Anatolia with 2 players at 200 starts at least 0.5·n apart.
- **Task 8. Distance-scaled pacing.**
  - At world creation, compute the base-to-base path distance.
  - Scale from it:
    - the AI first-attack and wave timers (ai.js:4-7) and staging distances (tactics.js:136-160);
    - the scouting, lumber, water, ferry and defence radii (ai.js:169, 352-368, 383-402, 497-500, 556-566, 599);
    - the relic and wonder victory timers, modestly (victory.js:8-9).
  - Trade income gets diminishing returns beyond 150 tiles (world.js:1379).
  - The in-game help documents each rule.
  - Acceptance: an AI pacing test checks that the first attack arrives within [0.8, 1.3] × the expected time from distance at 200 and 480. The AI-vs-AI soak at 320 ends within 90 game minutes on standard difficulty.
- **Task 9. Generation overlay and determinism.**
  - A "Generating map…" overlay covers the wait.
  - Fixed-seed snapshots are regenerated deliberately and reviewed visually: a contact sheet of minimaps for each size and type.
  - The HD terrain detail floor is checked.

## Phase 8: Switch on the bigger maps

- **Task 1. Presets and the cap.**
  - `MAP_SIZES` becomes Small 144, Medium 176, Normal 200, Large 256, Huge 320, Giant 400, Ludicrous 480 (map.js:214).
  - `validateMapSpec` allows n ≤ 512, and its object cap scales (map.js:25, 40).
  - The editor size lists follow.
- **Task 2. Default and player-count suggestion.**
  - The default is Normal 200 (ui.js:86).
  - The setup suggests a size from √(13,000·players) and highlights it, while the user can still choose (ui.js:119, 142).
  - Old `aoe_setup` names map to the nearest new preset.
- **Task 3. Tests that hard-code sizes.**
  - Update geography-geology.test.js:6 and 66-71, terrain.test.js:23-28, water.test.js:21, perf.test.js:34-61, fx.test.js:89, victory.test.js:23, extras.test.js:38, tactics.test.js:101, engine-harness.js:14 and tests/browser/assist.spec.js:14 and 62.
  - Recalibrate the vm budgets, since the vm is 1.4–12× slower than the browser (E§7.I).
- **Task 4. Full re-measure.**
  - Run `npm run test:perf` at 200, 320 and 480 with 3 and 8 players, without the cap override, and append the row to `docs/maps-perf-baseline.md`.
  - **Decision point:** if any budget is missed, write the phase 9 plan. Otherwise phase 9 is closed as not needed.
- **Task 5. Docs.**
  - Update the README, `docs/ASSET_PLAN.md` where it describes sizes, and the in-game help for presets, the strategic map, zoom and pacing.

## Phase 9 (conditional): Forest layer

Only if phase 8 misses a budget.
- Trees become a map layer: wood amount and variant per tile.
- A tree turns into an entity only while it is being chopped.
- Rendering draws forests from the layer, in the chunk cache and the 2.5D chunks.
- Harvesting, AI lumber search, fog memory, the editor brush and the save format (v3, still loading v1 and v2) follow.
- The detailed plan is written only if triggered.

---

## Spec coverage

| Spec section | Phase and task |
|---|---|
| Presets, cap, default, player suggestion, setup migration | 8.1–8.2 |
| Pacing scaled to distance (AI, relics, timers, trade) | 7.3, 7.8 |
| Zoom with icons, minimap, strategic map, scrolling, preview | 6.1–6.5 |
| Balanced homes; expansion sites, forests, wildlife, relics, rivers, lakes, mountains, passes, map types, real-world masks, generation cost, HD detail | Global constraints; 7.1–7.7, 7.9; 5.2 |
| Indexes and full-scan removal | 2.4–2.6, 2.8 |
| Staggered AI | 2.7 |
| Hierarchical pathfinding, region reject, group routes, path budget | 3.1–3.4 |
| 2D cache, HD terrain, fog; 2.5D chunks and fog texture | 5.1–5.5 |
| Budgets; forest-layer decision | Global constraints; 1.3; 8.4; 9 |
| Saves v2, IndexedDB, gzip export, sliced autosave; editor | 4.1–4.5 |
| Tests: command.test fix, perf spec, determinism, save compatibility, AI pacing, hard-coded sizes | 1.1, 1.3, 7.9, 4.2, 7.8, 8.3 |
| The flaky assist test found on 2026-10-18 | 1.2 |
