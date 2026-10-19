# Bigger maps — design

## Goal

The user's request: "the maps are too small compared to buildings and units. make maps much more bigger. prepare a comprehensive plan to improve maps."

Buildings, unit sizes, ranges, line of sight and speeds already match Age of Empires II. Only the maps don't. The default match (80×80, 3 players) gives each player 2,133 tiles. AoE2 gives 7,200 (tiny 120² for 2 players, giant 240² for 8). That is 0.30× the area. At the widest zoom one screen shows 41 % of the default map. The evidence is in [the map evaluation](2026-10-18-map-evaluation.md), cited as **E§n** in this document.

The user chose to go well beyond AoE2 parity:
- **Much bigger everywhere.** The default becomes **200×200 for 3 players**, and the largest size is **480×480**. At the largest sizes that is 2–3× AoE2's land per player.
- **Same home, rich land between.** Each player's starting base stays as balanced as today. The extra land is filled with area-scaled content.
- **Pacing scaled to distance.** Matches run longer. The AI, the victory timers and trade income scale with real travel distance, so nothing arrives absurdly late or becomes unbalanced.
- **Navigation:**
  - a wider zoom-out, with icons when far out;
  - a fixed and larger minimap;
  - a full-screen strategic map;
  - scaled and drag scrolling.
- **Performance approach "A, then B if needed".** Indexes, staggered AI, hierarchical pathfinding, chunked rendering and IndexedDB saves come first. Then re-measure at 480. The forest layer is added only if the budgets are still missed.

## What breaks today at bigger sizes (from the evaluation)

| Area | Today | Evidence |
|---|---|---|
| Hard cap | `validateMapSpec` rejects n > 256 (game start, save load, editor) | E§1.2, map.js:25 |
| Saves | 5.24 M-character `localStorage` quota shared by every slot. Saves are 3.2 M at 200; the autosave fails at 256; at 400 with 8 players a save is 17.7 M, which can't be loaded (16 M cap) | E§1.5, session.js |
| Simulation | Trees are 73–93 % of `W.list`, and AI, resource search, hit-test, rendering and the minimap all scan it. With 8 AIs the mean tick is 4.6 ms at 200 and 17.4 ms at 400 | E§1.3, E§5.1 |
| AI phase | Every AI updates on the same tick. The p99 hitch is 80 ms at 200 and 322 ms at 400 | E§5.2 |
| Pathfinding | Plain A* per unit with a 36k-node budget. A 40-unit order freezes the game 67–196 ms at 200 and 333–639 ms at 400, and routes fail at 400 | E§5.3–4 |
| 2D rendering | The chunk cache grows to about 1 GB. Fog redraws n² every frame. The HD texture is one canvas of (n·P)² pixels | E§5.7–9 |
| 2.5D | One n² mesh, rebuilt on every terrain change: 34 fps at 400 | E§5.10 |
| Content | Relics are capped at 10, rivers at 4. Thresholds at 80/100/120/140/180. Connectivity is fixed with straight corridors. Islands merge with 8 players. Anatolia puts 2 players 17 tiles apart | E§4 |
| UX | Minimum zoom 0.55. The minimap view box is drawn 0.8 tile-units wide and vanishes. The setup preview generates the wrong size. Scrolling is fixed at 900 px/s | E§6 |

Map generation itself is **not** a problem: under 0.55 s at 400 in the browser (E§3 T5).

## 1. Sizes, pacing and navigation

**Presets** (`MAP_SIZES`, map.js:214):

| Preset | Side |
|---|---|
| Small | 144 |
| Medium | 176 |
| **Normal (default)** | **200** |
| Large | 256 |
| Huge | 320 |
| Giant | 400 |
| Ludicrous | 480 |

- `validateMapSpec` allows n ≤ 512, and its object cap scales with it.
- The setup suggests a size from the player count, side ≈ √(13,000·players): 160 for 2, 200 for 3, 230 for 4, 320 for 8. The player can override it.
- Old `aoe_setup` names (tiny…gigantic) map to the nearest new preset. Saves store `n`, so they are unaffected.

**Pacing scaled to distance.** At world creation, measure the real path distance between starting bases. Derive from it:
- the AI's first-attack and wave timers (ai.js:4-7) and its staging distances (tactics.js:136-160);
- the AI's scouting, lumber-search, water, ferry and defence radii (E§2.4);
- the relic count: at least 5, growing with area;
- the relic and wonder victory timers (victory.js:8-9): modestly longer on huge maps;
- trade income (world.js:1379): unchanged up to today's distances, with diminishing returns beyond about 150 tiles.

Unit speeds do not change.

**Navigation:**
- **Zoom:** the in-game minimum drops from 0.55 to about 0.3 (ui.js:683, session.js:150). Below about 0.45, units and buildings draw as clear team-coloured icons (level of detail). The unit sprite-cache buckets and ambient-sound radius follow.
- **Minimap:**
  - It gets larger, within the HUD.
  - The view box and alert rings are drawn in screen pixels (render.js:1395-1398). Units draw as at least 2-pixel dots.
  - Trees, resources and terrain are baked into a cached base image. Only units, buildings and fog are redrawn.
- **Strategic map:** a full-screen overlay toggled by one key. It shows terrain, territories, building icons, army clusters and attack alerts. A click jumps the camera there, the wheel zooms and dragging pans.
- **Scrolling:** speed scales with zoom and map size (ui.js:876-885, extras.js:370-383). Drag-panning works in game. `clampCam` (render.js:55-58) stops large black void past the edges.
- **Setup preview:** generates the size actually selected (ui.js:191-208) and marks the starting positions.

## 2. Content on bigger maps

**Home bases stay as today:**
- the same resource rings at the same radii (map.js:544-567)
- the same flattening, TC reserve and forest clearing (map.js:466-536)

That keeps the early game and balance unchanged.

**Between players, content is scaled by area:**
- **Expansion sites.** Clusters of gold, stone, a forest edge and berries on flat open ground.
  - Placed by Poisson-disc sampling between starts and mirrored for fairness: each player has the same number at similar distances.
  - About 2–3 per player at 200, more at 480.
- **Forests:** large woods and forest belts scaled with area, not only more scattered patches.
- **Wildlife and relics** scale with area, with at least 5 relics. The mine and deer step changes at n > 120 (map.js:578-588) become continuous.
- **Rivers and lakes:**
  - River count, width and fords scale with n (water.js:128-292). Huge maps get great rivers 4–8 tiles wide.
  - The lake noise frequency scales (map.js:404), so large maps have real lakes.
  - `wmStockFresh` becomes O(n²) once instead of O(bodies·n²) (water.js:294-317).
- **Mountains:** range and pass widths scale about with √n. Crag and mesa counts grow with area under a density cap (map.js:222-381).
- **Connectivity:** the straight 3-tile corridors from player 1 (map.js:625-667) become passes routed through the lowest terrain, joining every player into one network (a minimum spanning tree of start regions).
- **Map types keep their meaning:**
  - islands are sized by area per player, so 8 players never merge;
  - the coastal sea and inlet scale;
  - coal, mineral seams and fish scale with area (geology.js:61-83).
- **Real-world maps:**
  - masks are rebuilt at 512 (tools/build-geography.mjs) and sampled bilinearly (geography.js:22);
  - start spacing scales with n and the player count (geography.js:30).
- **Generation cost:** `dStart` becomes a precomputed distance field (map.js:402). Generation stays well under 1 s at 480. A "Generating map…" overlay covers the wait.
- **Terrain detail:** HD terrain keeps at least 12 px per tile at every size (terrain.js:56), through per-chunk HD textures (section 3).

## 3. Engine performance (approach A)

**Indexes:**
- A spatial grid of 8-tile cells holds entities by kind (units, buildings, resources by type, relics). There are also per-owner lists and per-owner building counts.
- All of these are kept up to date on spawn, removal, owner change and movement, in world.js (alongside the existing spatial key at :400).
- Replace the full-list scans:
  - AI `mine`, `tc`, `home`, `army` and `needNaval` (ai.js:40-42, 83, 114, 169, 265-282, 411, 457, 506)
  - `findNearestRes`, `nearestDrop`, `nearestOwn`, `builtCount` and `hasBuilt` (world.js:359-387, 629-630)
  - `hitTest` (ui.js:596-628)
  - `renderWorld` culling (render.js:1273)
  - the minimap (render.js:1369)
  - `vicWithGhosts` (victory.js:538-562)
  - `wmFishTick` (water.js:339-376)
  - wells (wells.js:110-116)
  - `canPlace` scans (geology.js:92-106)

**AI:** each AI player's once-a-second update runs on its own offset tick (ai.js:43-46), and heavy jobs are spread across ticks.

**Pathfinding** (map.js:150-211, world.js:207-268, polish.js:8-27):
- Clusters are 16×16 tiles, with entrance points on their borders and an abstract graph per movement class (land, naval).
- Only the clusters affected by changes to `blk`, `ter` or `elev` are rebuilt.
- A route is found on the abstract graph, then refined by one grid A* confined to the corridor of clusters the route passes through, and smoothed.
- Region reject: unreachable goals are told apart at once by the graph's own connected components (not `computeRegions`); the best effort is then a route to the reachable tile nearest the goal.
- Group orders share one route (computed once, counted once against the per-tick path budget) and give each member a formation slot. A member joins the route where it helps (straight to its slot when in sight, else at the cheapest of the first 12 waypoints) and leaves it at the first waypoint its slot is in sight from; an order point within 24 tiles of the group's middle is not shared, since the members' own searches are short. A click on a tree, mine or building snaps to the nearest passable tile, and when the goal cannot be reached each member runs a bounded search to its slot from the end of the route.
- The search queue is a typed-array heap, and smoothing is bounded.
- Callers keep the `pathTo` / `findPath` API: movement.js, command.js:305-320 and engineering.js:57.

**2D rendering:**
- The terrain chunk cache (render.js:72-83, 201-228) gets a byte budget of about 200 MB, evicted least-recently-used first, and a canvas scale chosen by zoom.
- Chunks are prebuilt in a ring around the camera, within a per-frame time budget.
- HD terrain becomes per-chunk textures, and `hdtSync` updates only dirty tiles (terrain.js:377-425).
- Fog (fx.js:470-505, render.js:1325-1341) updates only tiles whose visibility changed, and its clouds are a low-resolution texture drawn scaled.

**2.5D** (renderer25d.js):
- Indexed terrain meshes in 32×32-tile chunks, with frustum culling and partial rebuilds of dirty chunks (:204-265, :405).
- Fog as a DataTexture sampled in the shader (:288-297).
- `visibleEntities` comes from the spatial index (:299-315).

**Budgets.** The reference is the RTX A4000 workstation used by the evaluation. SwiftShader is recorded as the low-end check.

| Measure | Budget |
|---|---|
| Simulation tick, 480, 8 AI players | mean ≤ 8 ms, p99 ≤ 33 ms |
| 40-unit cross-map order | ≤ 16 ms; every route reaches its goal |
| 2D frame rate at 480 | ≥ 50 fps |
| 2.5D frame rate at 480 | ≥ 50 fps |
| Terrain-cache canvas memory | ≤ 600 MB |

**Forest layer (approach B), conditional.** After phase 8, re-measure at 480. If the tick or save budgets are missed, phase 9 turns trees into a map layer (wood per tile, with entities only for trees being chopped).

## 4. Saves and editor

**Saves:**
- **Storage:** IndexedDB holds several manual slots, the autosave and editor maps (session.js:138, editor.js:14-16). `localStorage` remains only for settings.
- **Format v2:**
  - typed arrays (map layers, explored and visible) are stored run-length encoded then base64, not as JSON number lists (session.js:5-27);
  - the duplicated `W.spec` arrays are dropped;
  - entity records are compact;
  - **v1 saves and exports still load.**
- **Export and import:** gzip through `CompressionStream`. The 16 M cap goes; a sanity cap stays.
- **Autosave:** serialised in idle-time slices (session.js:192-199). Every failure shows a message.

**Editor:**
- custom sizes up to 480 (editor.js:35, 95)
- undo stores tile diffs, not full JSON snapshots (editor.js:62, 199)
- maps are kept in IndexedDB
- strokes update regions, vertical heights (VH) and HD terrain incrementally (editor.js:231-323)

## 5. Testing

- **First task:** fix tests/command.test.js. Its 44×44 arena (line 19) is used up before `open(16,6)` at line 164, so the file crashes and 10 checks never run: stances, flee, resign, building damage from diagonals, and the 12-minute AI soak. Setting `A = 48` makes all 24 pass. Root cause: commit 1f7ab9f made all land outside the arena non-flat, so `open()` has nowhere else to look. The game behaviour is right; the test setup is wrong.
- **Browser performance spec** (tests/browser/maps-perf.spec.js). It reproduces the evaluation's measurements (E§3) and enforces the section 3 budgets at 200, 320 and 480. Because it is slow, it runs on demand (`npm run test:perf`), not in the default browser run.
- **Determinism:** fixed-seed generation snapshots per size and map type. Changing a seed's map is expected in phase 7, and the snapshots are updated deliberately.
- **Saves:** v1 → v2 load, v2 round trip, and a 480 save round trip through IndexedDB.
- **AI pacing:** the first attack arrives within a window that scales with the measured base distance.
- **Updated tests that hard-code today's sizes and positions** (E§6.9): geography-geology.test.js:6 and 68, terrain.test.js:23-28, water.test.js:21, perf.test.js:34-61, fx.test.js:89, victory.test.js:23, extras.test.js:38, tactics.test.js:101, engine-harness.js:14 and tests/browser/assist.spec.js:14 and 62.

## 6. Phases

Each phase is shippable on its own and gets its own implementation plan, task reviews and a final review. The bigger presets are switched on last, so no phase ships huge maps that stutter or can't be saved.

| Phase | Content | Visible change |
|---|---|---|
| 1 | command.test.js fix; performance baseline spec and `npm run test:perf` | none: test coverage and a baseline |
| 2 | Spatial and per-owner indexes; staggered AI | smoother play on today's large maps |
| 3 | Hierarchical pathfinding; group routes; region reject; path budget | no freeze on big group orders |
| 4 | Saves v2 in IndexedDB; gzip export; sliced autosave; editor storage and undo diffs | large maps save and load |
| 5 | 2D chunk cache budget, per-chunk HD terrain, fog; 2.5D chunked meshes and fog texture | steady fps and memory at 480 |
| 6 | Zoom to 0.3 with icons; minimap; strategic map; scrolling; setup preview | navigable huge maps |
| 7 | Content at scale (section 2); distance-scaled AI, timers and trade; 512 geography masks | rich, fair big maps |
| 8 | New presets; 512 cap; default 200; size suggested by player count; full re-measure against the budgets | **maps much bigger by default** |
| 9 | *(only if phase 8 misses budgets)* forest layer | smaller saves, lower entity count |

## Global constraints

- Free and open source only. Every tool and library is free; no paid APIs.
- Prefix `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright` on every Playwright command. Never set it user-wide.
- The full browser suite rewrites `assets/screenshots/`. Restore it afterwards with `git checkout -- assets/screenshots`.
- Generation stays deterministic per seed.
- No phase may regress today's sizes: the default suites stay green at 80–200 throughout.
- v1 saves keep loading for good.

## Risks

- **Pathfinding (phase 3)** carries the most risk. movement.js, polish.js, command.js and engineering.js all wrap `pathTo` and `findPath`. Keep the API and run the movement, command and tactics suites at each step.
- **Low-end GPUs.** Budgets are measured on an RTX A4000. The SwiftShader numbers (E§3 T9) are tracked so the chunk-cache budget and the icon level of detail stay safe for integrated GPUs. The 2.5D renderer already falls back to 2D on context loss (renderer25d.js:60).
- **AI quality on huge maps.** The evaluation measured cost, not behaviour (E§8.7). The phase 7 pacing test and a long AI soak at 320/480 cover attack, ferry and win behaviour.
- **Balance.** Trade, relic and wonder timers change with distance. Each is documented in the in-game help.
- **Seeds.** Shared seeds produce different maps after phase 7. Editor maps store explicit layers and are unaffected.

## Not in scope

- New map types beyond scaling the existing ones.
- Multiplayer or networking.
- Changing unit speeds or other combat stats.
