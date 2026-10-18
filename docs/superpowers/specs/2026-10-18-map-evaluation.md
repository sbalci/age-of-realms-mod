# Map evaluation: scale, generation, performance and UX at larger sizes

- Repository state evaluated: `main` at `38ad66fe`, clean tree. Nothing in the repository was changed. Every measurement script lives in the session scratchpad (`…/scratchpad/maps-eval/`).
- Machine: Windows 11 Pro for Workstations, 20 logical CPUs, NVIDIA RTX A4000, Node 22.17.1, Playwright 1.64.1 (Chromium build 1248). Browser runs use a 1440×1000 viewport, the size in `playwright.config.js`. That leaves a 1440×776 game canvas under the HUD.
- Sizes 320 and 400 cannot be played today (see finding 2). To measure them, the scripts swapped in a copy of `validateMapSpec` inside the test page or vm, with the 256 cap raised to 1024. This was a runtime-only patch. Nothing else was altered.
- This is an evaluation, not a plan. Section 7 lists the code that a plan would have to touch.

---

## 1. Executive summary (ranked by impact on the user's complaint and on feasibility)

1. **The map is the only part of the game that is not at Age of Empires II scale.**
   - The game already copies AoE2 for footprints, combat ranges and line of sight (data.js:177-197):
     - footprints: Town Center 4×4, castle 4×4, wonder 5×5, houses 2×2, military and economy buildings 3×3
     - ranges: Town Center 6, castle 8, trebuchet 16
     - line of sight: Town Center 8, villager 4
     - speeds are AoE2-like
   - The map sizes are not. The default match is *small* (80×80) with 3 players (ui.js:86). That gives **2,133 tiles per player, against 7,200** for both reference points (AoE2 tiny is 120² for 2 players, AoE2 giant is 240² for 8 players). That is 0.30× the area and 0.54× the linear size.
   - At the minimum zoom of 0.55 (ui.js:683), one screen shows **41 % of the default map**, and the black edge of the map is visible from the home Town Center.
   - Even *gigantic* (200²) is smaller than AoE2 giant (240²). The largest preset gives 5,000 tiles per player with 8 players.
   - Nothing ties the map size to the player count. Up to 8 players can be put on *tiny* 64², where nearest neighbours start 16 tiles apart.
2. **Maps larger than 256 tiles are hard-blocked.** `validateMapSpec` rejects any `n > 256` (map.js:25). The callers are:
   - `createWorld` (world.js:59)
   - `MatchSave.parse` (session.js:92)
   - the editor's load, store, `loadSpec` and import (editor.js:15, 16, 40, 140)

   The real-world coastline masks are 256×256 (geography-data.js, built by tools/build-geography.mjs:6), so larger geographic maps would be upsampled.
3. **The simulation slows with map area, not with army size.** Every tree is an entity:
   - 993 trees at 80, 6,547 at 200 and 28,722 at 400.
   - Trees alone are 73 % of `W.list` at 80 and 93 % at 400.

   Many systems scan the whole `W.list`:
   - the AI's `mine()` (ai.js:40), `tc()` and `home()` (ai.js:41-42)
   - `findNearestRes` (world.js:375), `nearestDrop` (world.js:364) and `builtCount` (world.js:629)
   - `hitTest` (ui.js:596), `renderWorld` (render.js:1273) and the minimap (render.js:1369)

   All AIs also run their once-per-second update on the same tick (ai.js:43-46).
   - In the browser with 8 AI players, the mean tick is **1.3 ms at 80, 4.6 ms at 200, 7.1 ms at 256, 12.0 ms at 320 and 17.4 ms at 400**.
   - The once-a-second spikes (p99) are **18 ms, 80 ms, 126 ms, 225 ms and 322 ms** at the same sizes. With 3 players on coastal the mean tick is 0.5, 1.8, 2.7, 4.1 and 6.9 ms, with p99 of 6, 30, 46, 69 and 116 ms.
   - In the vm profile at 320, `AIPlayer.mine()` alone is 76 % of the AI's time.
4. **Pathfinding does not scale.** It is a separate grid A* per unit (map.js:150), with no hierarchy and no route sharing in group orders (world.js:259).
   - Its node budget is fixed at 36,000 once n ≥ 206 (map.js:152).
   - String-pull smoothing is 25–40 % of each route (map.js:189-196).
   - **One right-click that sends 40 knights across the map freezes the game**, measured in the browser: 27–31 ms at 80, 67–196 ms at 200, 334–414 ms at 256, 219–577 ms at 320 and 333–639 ms at 400.
   - At 400 the route from a Town Center to the farthest Town Center **fails** (`ok:false`) on coastal with 3 players and on land with 2 players. On coastal the unit stops 124 tiles short, and 0 of 40 group routes succeed. On land with 8 players the route succeeded (12.7 ms). The 2-player land route succeeded in the vm but failed in the browser from a slightly different villager tile, so at 400 these routes sit at the edge of the node budget.
5. **Saves break before performance does.**
   - Chromium's `localStorage` quota measured **5,242,308 characters per origin**. The manual save, the autosave and the editor maps all share it.
   - Save sizes: 0.6 M characters at 80, 3.2 M at 200, then 5.4 M at 256, where autosave fails with `QuotaExceededError`.
   - At 400 with 8 players a save is **17.7 M characters**. That is above the 16e6 parse cap (session.js:86), so it can be written but never loaded again.
   - At 200 the manual and auto slots already cannot both exist, because 2 × 3.2 M is more than 5.24 M.
   - The synchronous autosave every 60 game seconds (session.js:4 and 192-199) stalls the page for 11 ms at 80 and 165 ms at 400.
6. **Render memory and per-frame fog work grow with n.**
   - The 2D terrain cache holds 780×528 canvases (1.6 MB each) for each 8×8-tile chunk (render.js:72-83), up to 680 of them (render.js:227).
     - After a full pan it measured **157 MB at 80 and 982 MB at 200**, and stayed near **1 GB from 256 up**.
     - At most 61 chunks are built per frame (render.js:224). Jumping the camera gives 130–770 ms frames.
   - The HD terrain texture is `n × hdtPerTile(n)` pixels on a side (terrain.js:56).
     - It grows to 4000² (61 MB) at 400 and takes 770 ms to build on the first frame.
     - Its detail halves: from 20 texels per tile at 80 to 10 at n ≥ 180.
   - Fog with clouds recomputes all n² tiles and calls `putImageData` on every frame (fx.js:470-505). This takes 0.17 ms at 80 and 3.4 ms at 400.
   - The 2.5D view:
     - It draws the whole map as one mesh (335k triangles at 400).
     - It rewrites n²×18 vertex colours every 6 ticks.
     - It rebuilds the whole mesh on any `map.version` change.
     - Result: **34 fps at 400 on an RTX A4000** (60 fps up to 200).
7. **Generated content is tuned for at most 200 tiles.**
   - Hard caps: relics ≤ 10, rivers ≤ 4, tributaries ≤ 2, 3 coal seams per player, 26 fish shoals per lake.
   - Fixed absolute radii: start resources sit 4–20 tiles out, the start flattens 8 tiles, the TC reserve is 5 tiles and the forest clearing is 11 tiles.
   - Step changes at size thresholds: n > 80, 100, 120, 140 and 180.
   - Connectivity is repaired with dead-straight 3-wide corridors from player 1 to everyone else.
   - The real-world presets misbehave:
     - *Anatolia* puts 2 players 17 tiles apart at 80.
     - *Islands* with 8 players merges into one landmass.
     - *World* spreads 8 players over 3–4 landmasses.

   Generation time itself is **not** a problem in the browser: 0.55 s or less at 400 with 8 players. The node vm harness inflates it about 11×.
8. **The UX does not scale.**
   - The zoom minimum of 0.55 shows 2.2 % of a 400 map.
   - The minimap is a fixed 332×166 px, which is 0.83 px per tile at 400. Its camera rectangle is stroked 0.8 *tile units* wide (render.js:1398), so it becomes invisible on large maps.
   - Scrolling is 900 screen px/s (ui.js:877), so crossing a 400 map at minimum zoom takes 15.6 s.
   - The setup preview generates a different size from the one selected (ui.js:194-198).
   - The editor only offers the presets, and its undo stores 60 full JSON snapshots (1.7 M characters each at 400).

**Largest size that ran acceptably** (criteria and verdicts are in §3.0): **200**.
- At 200 with 3 players (measured on coastal) the game runs smoothly: 60 fps, ticks averaging 1.8 ms with p99 30 ms, and saves of 3.2 M characters. One limit applies: a manual save and an autosave cannot coexist in `localStorage`.
- 256 with 3 players still runs smoothly (p99 46 ms), but its 5.3 M-character saves no longer fit in `localStorage`.
- 8 players are only stutter-free (p99 ≤ 50 ms) up to 120 (p99 31 ms; 160 was not measured). At 200 they hitch about 80 ms once a second.
- Above 256, the cap, the saves and the pathfinding all fail outright.

---

## 2. Scale today against the Age of Empires II reference

AoE2 reference points, as given for this task:
- tiny is 120×120 for 2 players, which is 7,200 tiles per player
- giant is 240×240 for 8 players, which is also 7,200 tiles per player
- a Town Center is 4×4 in both games

The side needed for 7,200 tiles per player is √(7200·p): 120 for 2 players, 147 for 3, 170 for 4, 190 for 5, 208 for 6, 224 for 7 and 240 for 8. Any other AoE2 figure below comes from recall and is marked *unverified*.

### 2.1 Presets

Presets are defined in `MAP_SIZES` (map.js:214). The default is `small` with 2 AIs (ui.js:86). The setup offers every size with 1 to 7 AIs (ui.js:119 and 142), and nothing derives the size from the player count.

| Preset | Side | Tiles | Tiles per player, 2 / 3 (default) / 8 players | vs 7,200 per player (2p / 3p / 8p) | TC footprint, % of map | TC side, % of map side |
|---|---|---|---|---|---|---|
| tiny | 64 | 4,096 | 2,048 / 1,365 / 512 | 0.28 / 0.19 / 0.07 | 0.39 % | 6.3 % |
| **small (default)** | 80 | 6,400 | 3,200 / **2,133** / 800 | 0.44 / **0.30** / 0.11 | 0.25 % | 5.0 % |
| medium | 100 | 10,000 | 5,000 / 3,333 / 1,250 | 0.69 / 0.46 / 0.17 | 0.16 % | 4.0 % |
| large | 120 | 14,400 | 7,200 / 4,800 / 1,800 | 1.00 / 0.67 / 0.25 | 0.11 % | 3.3 % |
| huge | 160 | 25,600 | 12,800 / 8,533 / 3,200 | 1.78 / 1.19 / 0.44 | 0.06 % | 2.5 % |
| gigantic | 200 | 40,000 | 20,000 / 13,333 / 5,000 | 2.78 / 1.85 / 0.69 | 0.04 % | 2.0 % |
| *AoE2 tiny* | 120 | 14,400 | 7,200 (2p) | 1.00 | 0.11 % | 3.3 % |
| *AoE2 giant* | 240 | 57,600 | 7,200 (8p) | 1.00 | 0.03 % | 1.7 % |

In open land (land tiles that are not peaks, shallows or occupied by objects), the land type gives:

| Size | 2 players | 8 players |
|---|---|---|
| 80 | 2,118 per player | 578 per player |
| 120 | 4,663 | 1,209 |
| 200 | 12,916 | 3,226 |

Coastal maps are about 15 % lower (T8).

### 2.2 Footprints and on-screen size

| Item | Value | Source |
|---|---|---|
| Tile size at zoom 1 | 64×32 px; an elevation step is 14 px | data.js:3 |
| Zoom range | 0.55–1.8 in game, 0.4–1.8 in the editor | ui.js:683, editor.js:149, session.js:150 |
| Tile width on screen | 35 px at zoom 0.55, 115 px at 1.8. AoE1 art was also 64×32; AoE2 terrain art is about 97×49 (unverified) | — |
| TC (Town Center) | 4×4 tiles, 256 px wide footprint plus 126 px of art height at zoom 1 | data.js:177, render.js:552 |
| Castle | 4×4 tiles, 138 px of art height | data.js:193, render.js:552 |
| Wonder | 5×5 tiles | victory.js:37 |
| Farm | 3×3 | — |
| House | 2×2 | — |
| Barracks, range, stable and similar | 3×3 | — |
| Tower, walls | 1×1 | — |
| Unit radius | 0.25 tiles for infantry, 0.35 mounted, 0.45 siege, 0.65–0.8 ships | world.js:17 |
| Unit height | about 27 px (28 × `US` 0.95); mounted 34 px | render.js:1180-1181 |
| Visible map at zoom 1 / 0.55 (measured, 1440×776 canvas) | 15.2 % / **41.1 %** of 80²; 2.8 % / 8.6 % of 200²; 0.7 % / 2.2 % of 400² | T1 |

### 2.3 Movement and distance

Unit speeds in tiles per second are in data.js:124-171:
- villager 0.95 (AoE2 0.8, unverified)
- scout and knight 1.35
- archer 0.96
- militia 0.9
- ram and trebuchet 0.5
- trade cart 1.0
- transport 1.4

There are 20 simulation ticks of 50 ms per game second (main.js:3), and Normal speed is 1×.

| n | Villager crosses one side | Knight crosses one side | Ram crosses one side | Nearest-start spacing, land 2p / 8p (tiles) | Knight from TC to the nearest enemy TC, 2p |
|---|---|---|---|---|---|
| 64 | 67 s | 47 s | 128 s | 44 / 16 | 33 s |
| **80** | **84 s** | 59 s | 160 s | **55 / 20** | **41 s** |
| 120 | 126 s | 89 s | 240 s | 82 / 31 | 61 s |
| 200 | 211 s | 148 s | 400 s | 144 / 55 | 107 s |
| 256 | 269 s | 190 s | 512 s | 184 / 70 | 136 s |
| 320 | 337 s | 237 s | 640 s | 231 / 88 | 171 s |
| 400 | 421 s | 296 s | 800 s | 289 / 110 | 214 s |

Notes on the table:
- **Start radius** is 0.34·n, or 0.36·n when n ≥ 140 (map.js:394). It scales linearly, so spacing is 0.68–0.72·n with 2 players and 0.26–0.28·n with 8.
- **Real paths** are longer than these straight lines.
- **AI attack timer** (ai.js:4-7) is fixed at 390–900 s. At 400 a ram needs 578 s just to walk from TC to TC.
- **Camera scrolling** is 900 screen px/s at any zoom (ui.js:877, extras.js:380). Crossing the map's isometric width takes 64·n·zoom/900 s:
  - 3.1 s at 80, 7.8 s at 200 and 15.6 s at 400 at zoom 0.55
  - twice as long at zoom 1

### 2.4 Constants that tie gameplay to map size (all in map.js unless stated)

**Resources around each start, all at fixed radii (map.js:544-567):**
- 3 villagers and a scout
- 4 sheep at 4–6 tiles, plus 2 pairs at 12–16
- berries at 6–8, with a cluster of 6
- gold at 7–10 (7 tiles) and 13–17 (5 tiles)
- stone at 8–12 (5 tiles)
- 2 boar at 13–18
- 4 deer at 14–20
- 2 home forests at 9–13
- 3 straggler trees at 5–7
- up to 4 shore fish at 8–22

**Reserved areas around each start:**
- elevation is flattened within 8 tiles (map.js:466-469)
- no water within 9 tiles (map.js:423)
- a 5-tile TC reserve (map.js:505)
- no global forest within 11 tiles (map.js:530)
- no mountains within 15–17 tiles (map.js:244)

**Global counts (map.js:578-588).** `areaMul = (n/80)²`.

| Item | Rule | Effect |
|---|---|---|
| Wolves | (n/30)·√areaMul + 1 | Scales with area |
| Relics | 5, or min(10, 5·√areaMul) when n > 120 | **Capped at 10** |
| Extra mines | (np + 2), multiplied by areaMul only when n > 120 | Step change at 120 |
| Deer herds | np·2, multiplied by √areaMul only when n > 120 | Step change at 120 |
| Deep fish | at most n/5 | Linear, not area |
| Shrubs | n·3 tries | Linear |
| Try budgets | 900 / 1200 / 1400 / 1200 | Fixed |

The thresholds create a visible step: from 120 to 160, relics double and gold tiles go from 34 to 64 with 2 players (T8).

**Other fixed counts:**
- **Coal and mineral seams** are 3 coal per player within 17 tiles, plus players × 3 deep seams (geology.js:66-82). They do not scale with area.
- **Victory timers** are fixed: wonder 300 s and all-relics 300 s (victory.js:8-9).
- **The AI's own fixed distances:**
  - scouting rings at 9, 14 and 19 tiles, stopping after 360 s (ai.js:383-394)
  - lumber-camp tree search in a 29-tile box (ai.js:169)
  - water searches of ±25 and ±26 tiles (ai.js:352-368)
  - home defence radii of 14, 16, 20 and 25 (ai.js:400-402, 497-500, 599)
  - ferry landing search ±20 (ai.js:556-566)
  - attack staging (tactics.js:150-160)

  The AI is otherwise omniscient (`targetPlayer` reads `W.list`, ai.js:502-509), so small scouting rings do not hurt its targeting.
- **Trade gold per trip** is d²/70 + 0.3·d (world.js:1379), so income per second grows linearly with distance. A cart between the farthest markets at 400 earns about 1,200 gold per trip. This is a balance risk.

---

## 3. Measurements

### 3.0 Method and acceptance criteria

**Browser (primary).**
- The game is served by the repo's own `tests/serve.js` on port 8765.
- Playwright from the repo's `node_modules` drives Chromium in *new headless* mode (`channel: 'chromium'`). That mode uses the real GPU (`ANGLE … NVIDIA RTX A4000 … D3D11`, `MAX_TEXTURE_SIZE` 16384).
- Every command was prefixed `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright`.
- Matches start through the real setup path, `__game.launchFromSetup(cfg)`, with an extra runtime `MAP_SIZES` key. Render matches use coastal, 3 players, seed 7, the default type and player count. The game is paused for the synchronous timings.
- **Steady frame** is the mean of 30 synchronous `renderWorld` and `drawOverlays` calls, camera on the human TC. On a GPU canvas this is main-thread cost; raster happens in the GPU process. The **live fps** windows measure the whole pipeline: rAF counts over 5 s while the match runs.
- **Cold fill** comes after `invalidateTerrain()`: frames are drawn until the chunk count stops growing.
- **Full pan** visits an 11×11 grid of camera positions over the whole map at zoom 0.55.
- **Memory**: `performance.memory.usedJSHeapSize` after a CDP `HeapProfiler.collectGarbage`. Canvas memory is computed from the canvas sizes, as width × height × 4.
- **Saves** are `MatchSave.serialize()` and `parse()`, plus a real `localStorage.setItem`. The quota was found by binary search: 5,242,308 characters.
- **Editor**: `Editor.loadSpec(spec)`, `snapshot()` and one 1-tile `apply()`, then `hdtSync` and one frame.
- **2.5D**: `?renderer=three`. Timings take `T25D.render()` plus `gl.finish()`. `buildTerrain()`, `updateFog()` and a `computeVH()` version bump are timed separately.
- **Simulation in the browser** (T4):
  - `launchFromSetup` with start age Feudal, high resources and seed 33.
  - All players are given `AIPlayer`, and `W.spectate = true`, as in tests/perf.test.js.
  - 600 warm-up ticks, then 3,600 timed `worldTick(0.05)` calls inside one `page.evaluate`, so no frames interleave.
  - Pathfinding is timed before play, from a player-1 villager to the farthest TC, and to a deep-water tile. The group move is 40 knights spawned by the player-1 TC and sent with `orderMove()` to the farthest TC.

**Node vm.**
- This is `tests/engine-harness.js`, required from the scratchpad. It is used only for breakdowns, counts and the generation matrix.
- Its absolute times are inflated against the browser: 1.4–2.4× for the simulation tick, about 6–12× for single routes, and a median 11.6× (range 6.5–16×) for generation. T6 and T7 are therefore relative.
- Phase timings wrap the global functions `carveMountainsAndObstacles`, `ensureConnectivity`, `wmCarveRivers`, `wmStockFresh`, `bfsDist`, `smoothElev`, `geographyTerrain` and `geographySupplies`.

**Acceptance criteria, fixed before reading the results:**
- mean simulation tick ≤ 8 ms (the target in tests/perf.test.js), and p99 ≤ 50 ms, so there is no regular visible hitch
- Start-to-first-frame ≤ 3 s
- steady 2D frame ≤ 16.7 ms at zoom 0.55, with live 60 fps
- the save fits under the 16e6 parse cap and the `localStorage` quota
- Town-Center-to-Town-Center routes succeed

| Size | Verdict (players / type) | Failing criteria |
|---|---|---|
| 80 / 120 | Passes, all player counts | — |
| 200 | Passes at 3 players coastal; 8 players fails p99 (80 ms) | Two save slots no longer fit together |
| 256 | Fails saves (`localStorage` quota) | 8 players: p99 126 ms |
| 320 | Fails saves | 3 players: p99 69 ms; 8 players: mean 12 ms, p99 225 ms; 2.5D down to 53 fps |
| 400 | Fails saves (the 8-player save exceeds the parse cap) | Long routes fail (coastal 3p, land 2p); 3 players p99 116 ms; 8 players mean 17.4 ms; 2.5D 34 fps |

### T1. Browser, real GPU: start-up, memory, 2D rendering (coastal, 3 players, seed 7)
| n | entities at start (trees) | launch ms (gen ms) | HD texture px / build ms | JS heap MB (perf.memory) | steady frame ms z1 / z0.55 (p90) | fog draw ms | minimap cold / steady ms | live fps z1 / z0.55 (worst frame ms) | visible tiles z1 / z0.55 (% of map) | chunks / chunk MB after full pan | cold fill worst frame ms z0.55 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 1367 (993) | 53 (35) | 1600² / 125 | 9.2 | 1.85 / 2.98 (12.3) | 0.17 | 4.1 / 0.36 | 60 / 59.8 (32 / 59) | 970 / 2632 (15.2% / 41.1%) | 100 / 157 | 130 |
| 120 | 3050 (2578) | 93 (69) | 1920² / 189 | 9.6 | 1.55 / 2.39 (6.8) | 0.37 | 5.1 / 0.61 | 60.2 / 60 (26 / 27) | 1078 / 2988 (7.5% / 20.8%) | 225 / 353 | 120 |
| 200 | 7449 (6547) | 189 (155) | 2000² / 218 | 13 | 2.61 / 3.71 (11.1) | 0.85 | 8 / 0.83 | 60.1 / 60.1 (33 / 35) | 1103 / 3443 (2.8% / 8.6%) | 625 / 982 | 138 |
| 256 | 13142 (11919) | 278 (225) | 2560² / 356 | 17.7 | 3.79 / 3.91 (9.7) | 1.39 | 11.7 / 1.43 | 60 / 59.8 (43 / 50) | 1102 / 3592 (1.7% / 5.5%) | 661 / 1038 | 136 |
| 320 | 19876 (18235) | 401 (332) | 3200² / 520 | 22 | 4.87 / 4.62 (8.3) | 2.08 | 16.3 / 2.36 | 59 / 57.9 (60 / 73) | 1103 / 3564 (1.1% / 3.5%) | 632 / 993 | 772 |
| 400 | 30987 (28722) | 652 (554) | 4000² / 771 | 30.4 | 7.95 / 6.47 (11.3) | 3.37 | 21.6 / 2.65 | 57.7 / 58 (77 / 75) | 1103 / 3564 (0.7% / 2.2%) | 564 / 886 | 647 |

### T2. Browser: save, editor and minimap geometry (same matches)
| n | save chars | serialize ms | parse ms | fits localStorage (5.24 M chars) | editor: undo snapshot ms / chars | editor: 1-tile stroke ms + HD resync ms | minimap css px | minimap px per tile (width) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 597,847 | 11 | 30 | yes | 1 / 71,809 | 1.9 + 8 | 332×166 | 4.15 |
| 120 | 1,270,699 | 20 | 42 | yes | 2 / 160,255 | 2.8 + 8 | 332×166 | 2.77 |
| 200 | 3,164,813 | 49 | 95 | yes | 5 / 413,884 | 6 + 17 | 332×166 | 1.66 |
| 256 | 5,418,960 | 68 | 137 | NO (QuotaExceededError) | 7 / 711,195 | 9.2 + 26 | 332×166 | 1.3 |
| 320 | 8,274,628 | 117 | 182 | NO (QuotaExceededError) | 10 / 1,091,994 | 11.2 + 27 | 332×166 | 1.04 |
| 400 | 12,897,309 | 165 | 287 | NO (QuotaExceededError) | 15 / 1,707,692 | 15.2 + 39 | 332×166 | 0.83 |

### T3. Browser, real GPU: 2.5D renderer (three.js), coastal 3 players
| n | first render ms | buildTerrain ms | fog colour update ms | steady render ms (median, gl.finish) | frame after a map.version bump ms | terrain vertex MB | triangles | live fps (worst frame ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 268 | 18 | 0.6 | 0.8 | 103 | 1.7 | 14,134 | 60 (21) |
| 120 | 340 | 38 | 0.9 | 1 | 100 | 3.9 | 31,138 | 60.2 (27) |
| 200 | 470 | 93 | 7.8 | 1.2 | 138 | 10.6 | 84,924 | 60 (40) |
| 256 | 641 | 104 | 9.9 | 1.4 | 196 | 17.4 | 138,190 | 57.2 (54) |
| 320 | 932 | 142 | 7.4 | 2 | 297 | 27.1 | 215,252 | 52.7 (76) |
| 400 | 1295 | 171 | 14.6 | 2.1 | 391 | 42.1 | 334,896 | 34.1 (93) |

### T4. Browser: simulation with every player AI-controlled (start Feudal, high resources, 30 s warm-up, 3 game-minutes = 3600 ticks of 50 ms)
| n | players / type | entities after 3.5 min | player units | tick mean ms | p95 | p99 | max | ticks > 50 ms | findNearestRes µs/call | W.list owner filter µs | path villager→farthest TC ms (ok) | path to unreachable water ms | 40-knight group move ms (paths ok) | save chars |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 8 land | 1668 | 124 | 1.26 | 13.4 | 17.7 | 29 | 0 | 52 | 26 | 1 (true) | – | 27 (40/40) | 1,007,066 |
| 80 | 3 coastal | 1327 | 55 | 0.46 | 3.9 | 5.5 | 12 | 0 | 80 | 21 | 3.3 (true) | 6.9 | 31 (40/40) | 632,392 |
| 120 | 8 land | 2974 | 129 | 2.02 | 23.5 | 31.4 | 39 | 0 | 115 | 44 | 1.5 (true) | 7.4 | 24 (40/40) | 1,737,249 |
| 200 | 8 land | 8102 | 145 | 4.57 | 60.3 | 79.5 | 115 | 183 | 284 | 110 | 4.2 (true) | 15.9 | 67 (40/40) | 4,385,153 |
| 200 | 3 coastal | 7327 | 57 | 1.83 | 19.4 | 30.1 | 61 | 2 | 297 | 140 | 8.3 (true) | 10.8 | 196 (40/40) | 3,174,052 |
| 256 | 8 land | 13914 | 142 | 7.07 | 97.5 | 125.6 | 152 | 183 | 513 | 198 | 11.3 (true) | 17.6 | 334 (40/40) | 7,190,887 |
| 256 | 3 coastal | 12515 | 51 | 2.73 | 32.4 | 46.4 | 79 | 14 | 424 | 169 | 13.4 (true) | 16.9 | 414 (40/40) | 5,285,091 |
| 320 | 8 land | 22430 | 140 | 12.03 | 163.3 | 224.6 | 260 | 183 | 869 | 323 | 8.4 (true) | 20.6 | 219 (40/40) | 11,296,081 |
| 320 | 3 coastal | 20034 | 56 | 4.06 | 40.7 | 69.1 | 125 | 173 | 662 | 304 | 15.4 (true) | 17.2 | 577 (40/40) | 8,366,332 |
| 400 | 8 land | 35763 | 143 | 17.39 | 239.4 | 321.6 | 373 | 183 | 1236 | 504 | 12.7 (true) | 21.9 | 333 (40/40) | 17,713,944 |
| 400 | 3 coastal | 32465 | 55 | 6.85 | 60 | 115.6 | 179 | 183 | 1069 | 454 | 18.8 (false) | 18.7 | 639 (0/40) | 13,366,179 |
| 400 | 2 land | 34091 | 34 | 5.29 | 48 | 79.5 | 173 | 178 | 1195 | 482 | 20.2 (false) | 18.7 | 637 (0/40) | 13,145,546 |

### T5. Browser generation time, ms (warm JIT, seed 1)
| n (2 players) | land | alpine | rivers | coastal | islands | anatolia | mediterranean | world |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 15 | 17 | 8 | 11 | 7 | 10 | 9 | 8 |
| 120 | 19 | 18 | 19 | 27 | 10 | 14 | 15 | 16 |
| 200 | 64 | 73 | 60 | 51 | 26 | 39 | 40 | 56 |
| 256 | 102 | 115 | 117 | 99 | 40 | 81 | 70 | 104 |
| 320 | 168 | 173 | 166 | 158 | 71 | 97 | 101 | 133 |
| 400 | 278 | 302 | 287 | 284 | 107 | 174 | 158 | 207 |

| n (8 players) | land | alpine | rivers | coastal | islands | anatolia | mediterranean | world |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 18 | 23 | 16 | 17 | 14 | 21 | 15 | 15 |
| 120 | 35 | 35 | 33 | 29 | 23 | 26 | 24 | 22 |
| 200 | 119 | 118 | 108 | 83 | 51 | 68 | 61 | 65 |
| 256 | 177 | 187 | 173 | 149 | 84 | 114 | 100 | 117 |
| 320 | 308 | 311 | 278 | 249 | 128 | 172 | 156 | 156 |
| 400 | 444 | 545 | 460 | 410 | 211 | 279 | 255 | 236 |

### T6. vm harness: per-system cost per tick, 8 AI players, land (inclusive ms per tick; vm is ~1.4–2.4× slower than the browser for the simulation tick)
| n | tick mean | AI.update | updateUnit | findPath | findNearestRes | nearestDrop | rebuildGrid | recalcPop | updateVisibility | vicMemUpdate | wmFishTick |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 2.986 | 0.957 | 1.443 | 0.109 | 0.016 | 0.022 | 0.047 | 0.017 | 0.024 | 0.01 | 0.003 |
| 120 | 4.197 | 1.701 | 1.729 | 0.26 | 0.044 | 0.039 | 0.06 | 0.03 | 0.032 | 0.013 | 0.007 |
| 200 | 7.683 | 4.156 | 2.242 | 0.952 | 0.112 | 0.07 | 0.11 | 0.063 | 0.053 | 0.019 | 0.018 |
| 256 | 11.074 | 7.087 | 2.136 | 0.563 | 0.198 | 0.124 | 0.16 | 0.112 | 0.076 | 0.027 | 0.029 |
| 320 | 16.458 | 10.785 | 3.008 | 1.137 | 0.403 | 0.213 | 0.225 | 0.174 | 0.106 | 0.037 | 0.043 |
| 400 | 25.071 | 17.756 | 3.53 | 1.402 | 0.643 | 0.331 | 0.333 | 0.279 | 0.164 | 0.057 | 0.07 |

### T7. vm harness: typed-array memory, entity counts, validation and save structure
| n | players | map typed arrays KB | explored+visible KB | A* scratch KB | entities t=0 (trees) | validateMapSpec ms (vm) | save graph nodes | save chars | parse ok |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 80 | 2 land | 119 | 25 | 100 | 1532 (1156) | 4 | 3612 | 636,335 | yes |
| 80 | 8 land | 119 | 100 | 100 | 1586 (915) | 4 | 4986 | 1,006,972 | yes |
| 80 | 3 coastal | 119 | 38 | 100 | 1286 (922) | 4 | 3313 | 623,823 | yes |
| 120 | 2 land | 268 | 56 | 225 | 2846 (2348) | 9 | 6261 | 1,176,840 | yes |
| 120 | 8 land | 268 | 225 | 225 | 2876 (2020) | 8 | 7634 | 1,744,695 | yes |
| 200 | 2 land | 744 | 156 | 625 | 7722 (6682) | 22 | 16047 | 3,101,822 | yes |
| 200 | 8 land | 744 | 625 | 625 | 7971 (6386) | 22 | 17865 | 4,354,582 | yes |
| 200 | 3 coastal | 744 | 234 | 625 | 7286 (6401) | 23 | 15313 | 3,163,644 | yes |
| 256 | 2 land | 1218 | 256 | 1024 | 13046 (11625) | 36 | 26722 | 5,155,311 | yes |
| 256 | 8 land | 1218 | 1024 | 1024 | 13809 (11705) | 37 | 29638 | 7,188,654 | yes |
| 320 | 2 land | 1903 | 400 | 1600 | 21908 (20035) | 56 | 44445 | 8,454,929 | yes |
| 320 | 8 land | 1903 | 1600 | 1600 | 22326 (19554) | 61 | 46838 | 11,303,383 | yes |
| 400 | 2 land | 2972 | 625 | 2500 | 34477 (31824) | 93 | 69568 | 13,259,096 | yes |
| 400 | 8 land | 2972 | 2500 | 2500 | 35669 (31777) | 93 | 73536 | 17,722,488 | NO: Save file is too large. |
| 400 | 3 coastal | 2972 | 938 | 2500 | 32402 (30218) | 96 | 65739 | 13,362,266 | yes |

### T8. Generated content per size (vm, mean of seeds 1–2 for n ≤ 256, seed 1 above; land, coastal, islands, anatolia)
| n | type / players | land % | open land per player (tiles) | nearest start mean (fraction of n) | relics | wolves | gold tiles | stone tiles | trees | forest % of land |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 64 | land 2 | 94 | 1378 | 44 (0.69) | 5.0 | 3 | 34 | 19 | 935 | 24 |
| 80 | land 2 | 96 | 2118 | 55 (0.68) | 5.0 | 4 | 34 | 20 | 1632 | 27 |
| 120 | land 2 | 95 | 4663 | 82 (0.68) | 5.0 | 7 | 34 | 19 | 3083 | 22 |
| 200 | land 2 | 92 | 12916 | 144 (0.72) | 10.0 | 18 | 87 | 70 | 7592 | 21 |
| 256 | land 2 | 95 | 21085 | 184 (0.72) | 10.0 | 28 | 129 | 110 | 13035 | 21 |
| 320 | land 2 | 96 | 33490 | 231 (0.72) | 10.0 | 44 | 182 | 169 | 20614 | 21 |
| 400 | land 2 | 97 | 52311 | 289 (0.72) | 10.0 | 68 | 273 | 258 | 33800 | 22 |
| 64 | land 8 | 97 | 379 | 16 (0.26) | 4.5 | 2 | 96 | 40 | 618 | 16 |
| 80 | land 8 | 98 | 578 | 20 (0.26) | 4.5 | 4 | 103 | 44 | 1281 | 20 |
| 120 | land 8 | 96 | 1209 | 31 (0.26) | 5.0 | 7 | 121 | 65 | 2763 | 20 |
| 200 | land 8 | 95 | 3226 | 55 (0.27) | 10.0 | 17 | 253 | 193 | 7596 | 20 |
| 256 | land 8 | 95 | 5226 | 70 (0.27) | 10.0 | 28 | 348 | 288 | 12751 | 21 |
| 320 | land 8 | 96 | 8364 | 88 (0.27) | 10.0 | 44 | 486 | 432 | 19963 | 20 |
| 400 | land 8 | 97 | 13016 | 110 (0.28) | 10.0 | 67 | 714 | 665 | 33360 | 22 |
| 64 | coastal 2 | 79 | 1174 | 44 (0.69) | 5.0 | 3 | 34 | 20 | 744 | 23 |
| 80 | coastal 2 | 82 | 1887 | 56 (0.70) | 5.0 | 4 | 34 | 20 | 1284 | 25 |
| 120 | coastal 2 | 82 | 4265 | 85 (0.70) | 5.0 | 7 | 34 | 20 | 2699 | 23 |
| 200 | coastal 2 | 83 | 12285 | 140 (0.70) | 9.5 | 18 | 88 | 70 | 7320 | 22 |
| 256 | coastal 2 | 84 | 20149 | 178 (0.70) | 10.0 | 27 | 126 | 106 | 12428 | 23 |
| 320 | coastal 2 | 84 | 31588 | 224 (0.70) | 10.0 | 43 | 180 | 164 | 19474 | 23 |
| 400 | coastal 2 | 84 | 49054 | 280 (0.70) | 10.0 | 67 | 270 | 260 | 30848 | 23 |
| 64 | coastal 8 | 85 | 331 | 17 (0.26) | 4.0 | 1 | 94 | 40 | 515 | 15 |
| 80 | coastal 8 | 84 | 513 | 21 (0.26) | 5.0 | 4 | 102 | 45 | 942 | 18 |
| 120 | coastal 8 | 81 | 1081 | 32 (0.27) | 5.0 | 7 | 121 | 61 | 2388 | 20 |
| 200 | coastal 8 | 83 | 3086 | 54 (0.27) | 10.0 | 18 | 251 | 191 | 6847 | 21 |
| 256 | coastal 8 | 83 | 5027 | 68 (0.27) | 9.5 | 28 | 345 | 290 | 12128 | 22 |
| 320 | coastal 8 | 83 | 7815 | 86 (0.27) | 10.0 | 43 | 490 | 422 | 19230 | 23 |
| 400 | coastal 8 | 84 | 12216 | 107 (0.27) | 10.0 | 68 | 717 | 658 | 30818 | 23 |
| 64 | islands 2 | 21 | 347 | 41 (0.63) | 0.0 | 3 | 14 | 10 | 113 | 13 |
| 80 | islands 2 | 21 | 517 | 52 (0.65) | 0.5 | 4 | 17 | 10 | 218 | 17 |
| 120 | islands 2 | 21 | 1124 | 76 (0.64) | 5.0 | 7 | 24 | 10 | 667 | 22 |
| 200 | islands 2 | 22 | 3172 | 129 (0.64) | 10.0 | 18 | 87 | 70 | 1842 | 21 |
| 256 | islands 2 | 22 | 5052 | 164 (0.64) | 10.0 | 28 | 102 | 85 | 3037 | 21 |
| 320 | islands 2 | 22 | 7479 | 205 (0.64) | 10.0 | 44 | 114 | 100 | 5692 | 26 |
| 400 | islands 2 | 22 | 12189 | 256 (0.64) | 10.0 | 68 | 154 | 140 | 8114 | 23 |
| 64 | islands 8 | 60 | 236 | 15 (0.24) | 0.0 | 1 | 94 | 40 | 279 | 11 |
| 80 | islands 8 | 61 | 375 | 19 (0.24) | 0.0 | 0 | 96 | 40 | 568 | 15 |
| 120 | islands 8 | 61 | 806 | 29 (0.24) | 5.0 | 7 | 99 | 40 | 1710 | 20 |
| 200 | islands 8 | 62 | 2218 | 49 (0.24) | 10.0 | 18 | 256 | 195 | 4952 | 20 |
| 256 | islands 8 | 61 | 3496 | 62 (0.24) | 10.0 | 28 | 351 | 295 | 8453 | 21 |
| 320 | islands 8 | 61 | 5336 | 78 (0.24) | 10.0 | 44 | 451 | 395 | 13830 | 22 |
| 400 | islands 8 | 61 | 8452 | 98 (0.24) | 10.0 | 68 | 566 | 510 | 21746 | 22 |
| 64 | anatolia 2 | 72 | 1061 | 12 (0.19) | 5.0 | 3 | 34 | 19 | 741 | 25 |
| 80 | anatolia 2 | 72 | 1620 | 17 (0.21) | 5.0 | 4 | 34 | 20 | 1256 | 27 |
| 120 | anatolia 2 | 72 | 3703 | 25 (0.21) | 5.0 | 7 | 34 | 20 | 2727 | 26 |
| 200 | anatolia 2 | 72 | 10898 | 44 (0.22) | 10.0 | 18 | 89 | 71 | 6406 | 22 |
| 256 | anatolia 2 | 72 | 17480 | 57 (0.22) | 10.0 | 28 | 129 | 110 | 11126 | 24 |
| 320 | anatolia 2 | 72 | 27490 | 73 (0.23) | 10.0 | 44 | 184 | 170 | 17219 | 23 |
| 400 | anatolia 2 | 72 | 42997 | 91 (0.23) | 10.0 | 68 | 274 | 260 | 26800 | 23 |
| 64 | anatolia 8 | 72 | 279 | 14 (0.22) | 5.0 | 3 | 99 | 39 | 414 | 14 |
| 80 | anatolia 8 | 72 | 417 | 17 (0.22) | 5.0 | 4 | 109 | 52 | 929 | 20 |
| 120 | anatolia 8 | 72 | 950 | 26 (0.22) | 5.0 | 7 | 121 | 66 | 2339 | 23 |
| 200 | anatolia 8 | 72 | 2698 | 45 (0.22) | 10.0 | 18 | 256 | 195 | 6304 | 22 |
| 256 | anatolia 8 | 72 | 4378 | 58 (0.23) | 10.0 | 28 | 351 | 297 | 10757 | 23 |
| 320 | anatolia 8 | 72 | 6863 | 74 (0.23) | 10.0 | 44 | 496 | 440 | 16809 | 23 |
| 400 | anatolia 8 | 72 | 10718 | 92 (0.23) | 10.0 | 68 | 721 | 667 | 26299 | 23 |

### T9. Software rendering proxy (default headless shell, SwiftShader, flushed with a 1-px readback)
| n | steady frame ms z1 / z0.55 | terrain ms | fog draw ms | cold fill worst ms z0.55 | live fps z1 / z0.55 |
| --- | --- | --- | --- | --- | --- |
| 80 | 33.75 / 31.55 | 17.77 | 0.14 | 558 | 28.8 / 31 |
| 200 | 39.26 / 37.98 | 18.32 | 1.03 | 594 | 23.3 / 22.1 |
| 400 | 48.39 / 45.33 | 20.29 | 3.34 | 746 | 17.9 / 17.7 |

Reading the tables:
- **Start-to-first-frame** is about launch + the `hdtFull` build + the first cold-fill frame (T1): about 0.25 s at 80, 0.5 s at 200, 0.75 s at 256, 1.0 s at 320 and 1.5 s at 400. That passes the 3 s criterion. The two-rAF probe in the script missed the HD build, which ran in a frame between two `evaluate` calls, so it is not reported.
- **2D rendering is not the bottleneck on a desktop GPU.** The live rate stays at 58–60 fps up to 400. Main-thread frame cost grows from 1.9 to 8 ms, mostly fog (5.3 ms at 400, zoom 1) and the entity scans. On a software rasteriser (T9: SwiftShader, no GPU) the same scenes are already slow at 80 (32–34 ms frames, 29–31 fps live). They fall to 18 fps at 400, mostly from terrain chunk drawing and fog. Lower-end machines will feel every added cost.
- **The cliffs are the simulation, the pathfinding and the saves.** The browser figures in T4 are the real costs.
- **Every 20th tick is the heavy one.** That is the AIs' synchronised one-second update. So "p95" and "p99" are a 1 Hz hitch, not random noise.

---

## 4. Generation behaviour at large sizes: what does not scale

Generation flows through four wrappers:
1. `generateMapSpec` from geology (geology.js:61)
2. the water wrapper (water.js:322)
3. the base `generateMapSpec` (map.js:382)
4. `geographyTerrain` (geography.js:19) for the real-world maps

All of it is synchronous on the main thread when Start is pressed (ui.js:320).

**Timing (T5).** In the browser, 80 takes 7–23 ms, 200 takes 26–119 ms, and 400 takes 107–545 ms. Alpine with 8 players is the slowest. The vm phase shares at 400 with 8 players on land are:
- `carveMountainsAndObstacles`: 44 %
- the base generator body: 37 %. That is mostly a per-tile `dStart()` call, which takes a hypot over every start (map.js:402), inside the water, forest and placement loops.
- `ensureConnectivity`: 10 %
- `wmStockFresh`: 7 %

Generation is therefore not a blocker, but it scales as n²·players.

What does not scale, or scales wrongly:

**Mountains, rivers and starts**
1. **Mountains are skipped entirely at n ≤ 80** for land and coastal maps (map.js:232). Those maps instead get 2–4 ad-hoc mesas (map.js:473-495). The global `isMountainMap` rules change at n > 80 (map.js:500), and mesa radius, range width and pass logic jump at n ≥ 140 or ≤ 80 (map.js:278, 317).
   - Range counts scale with n/80 (map.js:237-243), mesas with (n/80)^1.5 (map.js:313) and crags with (n/80)² (map.js:342). A 400 alpine map therefore gets about 225 crags and 56 mesas. That is roughly 5 s of vm time, the single largest generation cost, and visually dense.
   - Pass width (`passHalf` 2.6–2.8) and range width (3.4–5.5 tiles) are absolute, so mountain ranges at 400 look like thin scratches. The 400 minimap screenshot shows thin white streaks.
2. **Rivers are capped.**
   - At most 4 rivers once n ≥ 160–180 (water.js:133-135), and at most 2 tributaries (water.js:211).
   - River width is 1–3 tiles (water.js:190-194).
   - Fords are 2–4 per river with a fixed span (water.js:186-188).
   - Lakes come from fixed-frequency noise (`x/14`, map.js:404). Their count therefore scales with area, but each lake stays the same size.
   - On a 400 map, water is many small lakes plus at most 4 thin rivers. There are no "great rivers".
3. **Start positions.**
   - The ring radius scales (map.js:394), but everything around a start is absolute. The radii are listed in §2.4.
   - Each player's economy is therefore the same small 20-tile disc on every map size. Bigger maps add only empty space and global piles between players.
   - The geographic presets use `minDistance = max(7, n/8)` (geography.js:30) around fixed lon/lat anchors. *Anatolia* with 2 players puts the starts **17 tiles apart at 80** and 25 at 120 (0.21·n), so the bases overlap.
4. **Global resources (map.js:578-586).**
   - Relics are capped at 10. AoE2 uses 5 on most sizes (unverified), so this is a design choice, but relic victory then needs all 10 held for 300 s.
   - Mine and deer counts multiply by area only when n > 120, a discontinuity.
   - Deep fish are capped at n/5, linear.
   - The try budgets of 900–1400 random probes are fixed. With dStart > 16–20 exclusions they still succeed at 400, because open land grows faster, but they fail on small island maps: islands with 2 players get 0–2.5 relics instead of 5 at 64–100 (T8).
5. **Connectivity repair (map.js:625-667).**
   - It joins player 1 to each other player with a **straight, 3-tile-wide corridor**. The corridor flattens mountains to DIRT and fills water with shallows.
   - On big mountain maps these corridors are long straight scars, visible as lines on the minimap.
   - Inside the corridor loop it calls `spec.objects.filter()` once per blocked or water tile (map.js:660-661), which is O(corridor × objects). It takes 10 % of generation at 400.
   - The water wrapper runs it a second time after the rivers are carved (water.js:326).
6. **Map types change meaning with the player count.**
   - *Islands*: the island radius is 0.17·n around each start on a 0.32·n ring (map.js:394 and 417). With 8 players the islands merge into one landmass (generation matrix: one start region, 60 % land).
   - *World* with 8 players spreads the starts over 3–4 landmasses.
   - *Coastal* keeps a central sea of radius 0.2·n plus one 3-tile inlet (map.js:411-414). At 400 that is an inland sea 160 tiles across with a thin canal.
7. **Fresh-water fish stocking (`wmStockFresh`, water.js:294-317)** scans all n² tiles, twice, for every water body and kind. It is O(bodies × n²): 7 % of generation at 400, and quadratic again if there are more lakes. Each body is capped at 26 shoals (water.js:305).
8. **Geography masks** are 256×256 (geography-data.js; tools/build-geography.mjs:6), sampled nearest-neighbour (geography.js:22). Above 256 the coastlines become blocky, at 1.25–1.56 tiles per mask cell. The ridges use a `distance/(n/110)` falloff (geography.js:49), which scales.
9. **HD terrain texel density** falls with n: 24, 20, 18, 16, 12 and then 10 px per tile at n ≥ 180 (terrain.js:56). Terrain at 200 and above has half the detail of the default map.
10. **Hard caps that block large maps:**
    - `validateMapSpec` allows n ≤ 256 and at most n²·4 objects (map.js:25 and 40)
    - the editor's import file limit is 8 MB (editor.js:140)
    - the save file limit is 16 MB (session.js:86 and 174)
    - the save graph is limited to 200,000 nodes and 1,000,000 values per node (session.js:30 and 34)
    - the save's entity list is limited to 100,000 (session.js:90)
    - the A* route reconstruction is cut at 4,000 points (map.js:187)
    - the chunk key packs cx and cy into 10 bits each (render.js:222), so it is good to n = 8192, and the spatial grid key (world.js:400) to n = 4096. These two are fine.

**Unrelated to size, noted as asked.** tests/command.test.js:164 `open(16,6)` returns null. Its `open()` helper (command.test.js:30-36) looks for a flat, empty grass or dirt block at one elevation on a *medium* (100) land map, after carving a 44×44 arena. So it depends directly on how much flat open land generation leaves. Any generation change, such as more mountains or bogs, shifts it. Not diagnosed further.

---

## 5. Performance hotspots and bottlenecks

Ranked by measured impact at large n. Browser numbers come from T1–T4; vm shares from T6.

**1. AI full scans of `W.list`.**
- `AIPlayer.mine()` (ai.js:40) is called about 300 times per game second across 8 AIs.
- At 320 it costs 174 ms per game second in the vm. That is 76 % of AI time, and AI is 65 % of the tick.
- A single owner filter costs, in the browser, 21–26 µs at 80 and 454–504 µs at 400. At about 300 calls per game second, that is about 150 ms per game second at 400 for this pattern alone.
- `tc()` and `home()` (ai.js:41-42) scan `W.list` about 50 times per second. So do `needNaval`, `research` and `army()` (ai.js:411).
- The scans grow with trees, not with the AI's own units.

**2. AI phase alignment.**
- Every `AIPlayer` accumulates `acc` from 0 and runs its full update when `acc` reaches 1 s (ai.js:43-46).
- All AIs are created on the same tick (ui.js:340), so they all fire on the same tick.
- Result: one heavy tick per second. Browser p99 with 8 players is 18 ms at 80, 80 ms at 200, 126 ms at 256, 225 ms at 320 and 322 ms at 400.
- It shows as a visible hitch at 1 Hz. In T4 the count of ticks over 50 ms is about 180 per 3,600 (one per game second) for 8 players from 200 up, and for 3 players from 320 up.

**3. Pathfinding (map.js:150-211).**
- It is a plain 8-direction grid A*:
  - the heap is made of `[f, i]` arrays
  - `passFn` goes through closures and `W.ents.get()` for blocked tiles (world.js:189-202)
  - there is no hierarchy or region-level reject
  - there is no route cache or sharing
- The budget is 9,000 nodes, or `min(36000, 0.85·n²)` above 110 (map.js:152). It stops growing at 206.
- Measured in the browser (T4):
  - a villager route to the farthest TC takes 1–3 ms at 80, 4–8 ms at 200, 11–13 ms at 256 and 13–20 ms at 400
  - an unreachable goal uses the whole budget: 7 ms at 80, 16–22 ms from 200 up
  - the vm is about 6–12× slower on the same routes
- Smoothing (`lineClear`, map.js:189-196) is 25–40 % of each route (vm `pathprof`).
- **Correctness:** at 400, TC-to-TC routes around the central sea (coastal, 3 players) and across land (2 players) exhaust the budget. The unit gets a path to the "best" node, 124 tiles short on coastal. In the vm, the same 2-player land route succeeded from a slightly different villager tile, so at 400 success depends on where the unit starts.
- `PATHB` allows 24 routes per tick (polish.js:8-27), but units without a route are always served. So group orders are unbounded.

**4. Group orders.**
- `orderMove` (world.js:259-268) runs `setOrder` → `moveToPoint` → `pathTo` → `findPath` once per unit, synchronously in the click handler.
- 40 units cost, in the browser, 24–31 ms at 80–120, 67–196 ms at 200, 334–414 ms at 256, 219–577 ms at 320 and 333–639 ms at 400. At 400, 0 of 40 succeed on coastal and on 2-player land.
- `cmdFindBreach` (command.js:305-320) can add a second A* per unit.

**5. Resource search.**
- `findNearestRes` (world.js:375-387) scans all of `W.list` for every call. It is used for every re-task.
- Browser cost per call: 52–80 µs at 80, 0.28–0.30 ms at 200, 0.42–0.51 ms at 256, 0.66–0.87 ms at 320 and 1.07–1.24 ms at 400.
- `nearestDrop`, `nearestOwn` and `builtCount` / `hasBuilt` (world.js:359-373 and 629-630) are the same pattern.

**6. Per-frame entity scans in rendering.**
- `renderWorld` iterates all of `W.list`, culls each entity and sorts the visible set (render.js:1273-1287).
- `hitTest` also scans `W.list` every frame while the mouse is over the canvas (ui.js:596-628; main.js:34).
- `vicWithGhosts` scans and pushes fog ghosts every frame (victory.js:538-562).
- The minimap redraws every entity, including every tree, as a `fillRect` every 0.4 s (render.js:1369-1385; main.js:48). Steady cost is 0.36 ms at 80 and 2.65 ms at 400; cold cost 4 to 22 ms.
- In 2.5D, `visibleEntities` (renderer25d.js:299-315) does the same.

**7. Fog.**
- With clouds on, the default, `fxFog` (fx.js:470-505) runs an n² noise loop, an n² fade step (`fxFogStep`, fx.js:70-79) and an n×n `putImageData` **every frame**. It costs 0.17 ms at 80, 0.85 at 200, 2.1 at 320 and 3.4 at 400. Inside `renderWorld` at 400 it measured 5.3 ms at zoom 1.
- The minimap fog is another n² loop plus `putImageData` every 0.4 s (render.js:1388-1394).
- `updateVisibility` (world.js:1451-1473) runs every 6 ticks. It costs 0.1 ms at 80 and 1.25 ms at 400; it is proportional to units, plus `vicMemUpdate`.

**8. 2D terrain cache.**
- Each 8×8-tile chunk (`R.CH`, render.js:5) is a 780×528 canvas at 1.5× scale, about 1.6 MB (render.js:72-83).
- The cache holds up to 680 chunks and evicts 121 at once (render.js:227), so its ceiling is about 1.07 GB. It measured 157 MB (80), 353 MB (120), 982 MB (200) and about 1 GB (256+) after a full pan. On integrated GPUs that risks context loss or OOM.
- At most 61 chunks are built per frame (render.js:224):
  - first view: 66–130 ms per frame on the GPU
  - jumping to an unseen area at 320–400: 650–770 ms frames, possibly because a 3200–4000 px HD source texture is sampled into new canvases
- A full `invalidateTerrain()` clears everything (render.js:68). It is called on match start and resume (ui.js:347, session.js:149).

**9. HD terrain texture (terrain.js).**
- `hdtFull` builds an (n·P)² canvas on the first frame: 125 ms at 80, 216 ms at 200, 487 ms at 320 and 770 ms at 400 (T1).
- `hdtSync` runs before every frame (terrain.js:525-529). After any `map.version` change it compares all n² tiles and reruns `hdtFields`, a full BFS plus several per-vertex field passes over (n+1)². That costs 8 ms at 80 and 39 ms at 400 (T2). It happens on every terraform flush (terra.js:126-131) and every editor stroke.

**10. 2.5D (renderer25d.js).**
- `buildTerrain` (renderer25d.js:204-265) builds one non-indexed mesh of n²·6 vertices from plain JS arrays. It takes 18 ms at 80 and 171 ms at 400 (42 MB of vertex data).
- It rebuilds the whole mesh whenever `map.version` changes (renderer25d.js:405): 103 ms at 80, 391 ms at 400 for the frame after a terraform.
- `updateFog` rewrites n²·18 floats every 6 ticks and re-uploads them (renderer25d.js:288-297): 0.6 ms at 80, 14.6 ms at 400.
- The whole map is drawn every frame, with no chunking or culling: 14k triangles at 80, 335k at 400.
- Live: 60 fps up to 200, 57 at 256, 53 at 320, **34 at 400**.

**11. Saves.**
- `MatchSave.snapshot` encodes every object as a graph node (session.js:5-27).
- `W.spec` is included, so the original plain `ter` and `elev` arrays and the whole spawn object list are saved in addition to the live map layers. The per-player `explored` and `visible` arrays (world.js:71) are JSON number arrays as well.
- Browser serialisation: 11 ms at 80, 165 ms at 400 (3 players). Parse: 30 ms at 80, 287 ms at 400. The autosave runs every 60 game seconds.
- Sizes and limits are in §1 item 5.

**12. Editor.**
- Every stroke start serialises the whole map for undo (editor.js:62 and 199): 1 ms and 72k characters at 80, 15 ms and 1.7 M characters at 400. 60 snapshots are kept, about 100 M characters at 400.
- Every terrain stroke runs `computeRegions` (a full flood) and `computeVH` (editor.js:250 and 320), then `hdtSync` on the next frame.
- `clearIncompatible` scans `W.list` for every brushed tile when water flips (editor.js:310-318). Painting objects uses `W.list.some` for every tile (editor.js:300-302).

**13. Generation.** See §4; it is not a blocker in the browser.

---

## 6. UX issues

1. **Map size selection (ui.js:142).**
   - Six fixed presets, labelled with their tiles; tiny 64, small 80.
   - No guidance per player count.
   - The default is small for 3 players (ui.js:86). The saved choice comes back from `localStorage` key `aoe_setup` by *name*, so changing what a name means silently changes users' saved setups.
   - The *World* option says "large recommended", but nothing enforces it.
2. **The setup preview is wrong for most sizes.**
   - `preview()` (ui.js:191-208) generates *small* for tiny, small and medium, and *medium* for large, huge and gigantic.
   - So the map the user sees is a different layout from the one they get. Starts, coastline and mountains all differ, because they depend on n.
   - The 220×120 preview canvas also shows almost nothing at large sizes.
3. **Zoom.**
   - In-game zoom is clamped to 0.55–1.8 (ui.js:683; session.js:150 re-clamps on resume). The editor allows 0.4–1.8 (editor.js:149).
   - At 0.55 the view covers about 2,600–3,600 tiles: 41 % of 80², 2.2 % of 400².
   - For strategic play on big maps the user needs either a much lower zoom or a strategic map view.
   - The unit sprite cache's zoom buckets start at 0.5 (units_hd.js:20).
   - Ambient sound radius is 14/zoom (audio.js:53).
4. **Minimap.**
   - It is sized by CSS `clamp(280px, 27vw, 420px)` minus 56 px of padding (hud.js:126, 51-61): 332×166 px at a 1440 px window. The height is limited by the 202 px HUD (hud.js:120).
   - A tile is 4.15 px wide at 80, 1.66 at 200 and 0.83 at 400. Units are drawn as 1.4-tile squares (render.js:1382) and so become sub-pixel.
   - The camera rectangle uses `lineWidth = 0.8` in tile space (render.js:1398), so its on-screen width is 0.8·k px. That is 1.7 px at 80 and 0.33 px at 400: **the view rectangle disappears on large maps** (compare minimap-80-gpu.png with minimap-400-gpu.png).
   - Attack alert rings (render.js:1395) have the same problem. The HUD's own order lines compensate correctly with `px = 1/k` (hud.js:94).
   - There is no zoomed or panned minimap mode.
5. **Scrolling.**
   - Edge and arrow scrolling is 900 screen px/s regardless of map size (ui.js:877; extras.js:380). Crossing a 400 map at zoom 1 takes 28 s.
   - In the game there is no drag-scroll (only minimap click and drag) and no acceleration. The editor has right-drag panning.
   - `clampCam` (render.js:55-58) lets the camera centre reach the map's corner points, so a lot of black void shows near the edges. At 80 the void is already visible from the home TC (view-80-gpu.png).
6. **Saving and loading.**
   - The `localStorage`-only slots fail from 256 up (QuotaExceededError). At 200 the two slots cannot coexist.
   - When autosave fails it shows one message, then fails silently every 60 s (session.js:192-199).
   - *Export Match* still works up to the 16 MB load cap. Above that, an exported file cannot be imported (session.js:174).
   - Save compatibility: the format is version 1, with no map-size field beyond `n`. Raising the caps keeps old saves loadable. Changing the meaning of preset *names* does not affect saves, which store `n`, but does affect `aoe_setup`.
7. **Editor.**
   - *New blank* and *New generated* offer only the six presets (editor.js:35 and 95). There is no custom size.
   - Saved maps go to `localStorage` key `aoe_maps`, all in one JSON string (editor.js:16). A 400 map is 1.7 M characters, so two or three large maps fill the quota that the saves also need.
   - Import is limited to 8 MB (editor.js:140), and undo memory to 60 full snapshots.
   - After a single stroke, the next frame took up to 64 ms at 200–256 (T2).
8. **Visual scale.**
   - The unit-to-map ratio is AoE-like only at zoom ≥ 1. The TC art is 126 px tall on a 64 px-wide tile grid.
   - Clicking and selecting on big maps is fine, because the hit radii (ui.js:610-621) are in screen space.
9. **Tests that hard-code sizes or positions**, which any resize will touch:
   - Size names and values:
     - tests/geography-geology.test.js:6 loops over every `MAP_SIZES` entry × the 3 real maps × {2, 8} players, so adding sizes adds run time.
     - tests/geography-geology.test.js:68 asserts `huge === 160` and `gigantic === 200`.
     - tests/terrain.test.js:23-28 expects *large* to be n === 120, with a 1500 ms HD-texture vm budget.
     - tests/water.test.js:21 loops over tiny, small and large.
     - tests/perf.test.js:34-61 budgets on small and medium, and has hard-coded `cx = 40, cy = 40` at :61.
     - tests/browser/assist.spec.js:14 and :62 select `'tiny'`.
   - Fixed arenas and coordinates: tests/command.test.js:19-29 (a 44-tile arena on medium), tests/fx.test.js:89 (`centerCamOn(40,40)`), and the radii in tests/victory.test.js:23, tests/extras.test.js:38 and tests/tactics.test.js:101.
   - `make()` in tests/engine-harness.js:14 uses tiny.

---

## 7. Every place that would need to change to support much bigger maps

### A. Size definitions, validation and the setup

- map.js:214 `MAP_SIZES`. New values or new presets, ideally keyed to the player count (√(7200·p) gives 120–240).
- map.js:25 (cap 256) and map.js:40 (objects ≤ n²·4).
- map.js:383. Integer size parsing already works.
- ui.js:86 (default size), ui.js:142 (size select; derive from or warn about the player count), ui.js:119 (the 1–7 opponents list), ui.js:194-198 (preview size).
- ui.js:320 (generation call; consider a worker or a progress screen if generation grows).
- editor.js:35, 95, 134-135 (editor sizes and a custom size) and editor.js:15-16, 40, 140 (validation and import limit).
- main.js:54. The menu backdrop uses tiny; fine.

### B. Map generation

- map.js:222-381 `carveMountainsAndObstacles`: absolute widths at 278 and 283, `passHalf` at 277, thresholds at 232, 240-243, 278, 317 and 342, and counts at 237-243, 313, 342 and 362.
- map.js:394 (start radius), 402 (`dStart` cost; precompute a distance field), 404-424 (fixed noise frequencies and coastal and islands formulas), 427-448 (coastal water within 14 tiles), 466-469 (flatten radius 8), 473-495 (special case for n ≤ 80), 500 (`isMountainMap` threshold), 505 (TC reserve), 526-536 (forest thresholds and the radius-11 clearing).
- map.js:544-567 (per-player resource rings at absolute radii; decide whether "home" scales).
- map.js:570-588 (global counts, threshold at 120, relic cap 10, deep fish n/5, fixed try budgets, shrubs).
- map.js:625-667 `ensureConnectivity` (straight corridors from player 1 only; `objects.filter` inside the loop).
- water.js:128-292 `wmCarveRivers` (river count 133-135, width 190-194, fords 186-188, tributaries 211) and water.js:294-317 `wmStockFresh` (O(bodies·n²), 26-shoal cap at 305).
- geology.js:61-83 (fixed coal and seams per player: 66-77 and 79-82).
- geography.js:3-7 (anchors), geography.js:30 (start spacing `n/8`), geography.js:22 (nearest-neighbour mask sampling), geography.js:49 (ridge falloff); geography-data.js and tools/build-geography.mjs:6 (N = 256 masks).
- Tree representation: about 0.2 tree entities per land tile (map.js:526-536, 556; world.js:136). A forest tile layer or a resource index would decouple entity count from area.

### C. Simulation and AI

- ai.js:40-42 (`mine`, `tc`, `home`: per-owner indexes), ai.js:43-46 (stagger the AI phase), ai.js:83, 114, 169, 265-282, 457, 506 (`W.list` scans and fixed radii), ai.js:400-402, 497-500 and 599 (defence radii), ai.js:383-394 (scouting radii and the 360 s stop), ai.js:352-368 and 556-566 (water and ferry search windows), ai.js:4-7 (attack timers against travel time), tactics.js:136-160 (staging distances).
- world.js:359-387 (`nearestOwn`, `nearestDrop`, `findNearestRes`: spatial resource index), world.js:629-630 (`builtCount`, `hasBuilt`), world.js:1451-1473 (`updateVisibility`), world.js:1483-1491 (`recalcPop`), world.js:1544-1551 (`isAlive`), world.js:1379 (trade income against distance).
- geology.js:92, 98 and 106 (`W.list` scans in `canPlace` and the AI), victory.js:512-562 (fog memory scans), water.js:339-376 (`wmFishTick` scans `W.list` once a second), wells.js:110-116.
- victory.js:8-9 (wonder and relic timers against map size).

### D. Pathfinding and movement

- map.js:150-198 (A*: hierarchy or region graph, typed-array heap, budget at :152, 4,000-point cap at :187, smoothing at :189-196), map.js:199-211 `lineClear`.
- world.js:207-238 (`pathTo`, `followPath` repaths), world.js:259-268 (`orderMove`: compute the route once per group), polish.js:8-27 (`PATHB` budget: group orders bypass it), movement.js (rescue and repath loops), command.js:305-320 (`cmdFindBreach` second A*), engineering.js:57 (`findPath` with 2000 nodes).

### E. 2D rendering

- render.js:5 (`CH` = 8), render.js:72-83 (chunk canvas size and 1.5× scale), render.js:201-228 (61-builds-per-frame cap, 680-chunk cap, eviction policy), render.js:68-71 (`invalidateTerrain`, `invalidateTiles`).
- render.js:1258-1323 (`renderWorld` full `W.list` scan at 1273; needs a spatial index for culling), render.js:1325-1341 (`drawFog` n²), render.js:55-58 (`clampCam` void).
- fx.js:470-505 (`fxFog` per-frame n² clouds and fade), fx.js:436-438 (bird count n/30), fx.js:575-580.
- terrain.js:56 (`hdtPerTile` floor at 10), terrain.js:377-397 (`hdtFull` canvas (n·P)²), terrain.js:399-425 (`hdtSync` full compare and `hdtFields` on every version bump), terrain.js:525-529 (per-frame hook).
- ui.js:596-628 (`hitTest` full scan every frame).

### F. 2.5D renderer

- renderer25d.js:204-265 (`buildTerrain`: one n² mesh from JS arrays; needs chunked, indexed geometry and partial rebuilds), renderer25d.js:405 (full rebuild on any version change), renderer25d.js:288-297 (`updateFog` n²·18 rewrite; a fog texture would avoid it), renderer25d.js:299-315 (`visibleEntities` full scan), renderer25d.js:246-249 (terrain texture = HDT canvas, limited by `MAX_TEXTURE_SIZE`; 8192 in SwiftShader means n ≤ 819 at P = 10).

### G. Camera, minimap and controls

- ui.js:683 and session.js:150 (zoom limits), editor.js:149, units_hd.js:20 (zoom buckets below 0.5), audio.js:53.
- ui.js:876-885 and extras.js:370-383 (scroll speed; scale with n or zoom).
- render.js:1343-1400 (minimap: base n×n image, entity loop every 0.4 s, fog n², view rectangle width at 1398, alert width at 1395, dot sizes at 1382), hud.js:51-61 and 120-127 (minimap size and CSS), main.js:48 (0.4 s cadence).

### H. Saves and editor storage

- session.js:4 (autosave interval), session.js:5-27 (encoding typed arrays as JSON arrays; `W.spec` duplicated), session.js:30-34 (node and value caps), session.js:86 and 174 (16e6 limit), session.js:90 (100k entities), session.js:138 (`localStorage` only), session.js:192-199 (silent failure after the first message), session.js:92 (`validateMapSpec` cap).
- editor.js:14-16 (`aoe_maps` in `localStorage`), editor.js:62 and 199 (full-JSON undo snapshot on every stroke), editor.js:140 (8 MB import), editor.js:231-252 and 319-323 (`computeRegions`, `computeVH` and `hdtSync` per stroke), editor.js:300-318 (`W.list` scans per brushed tile).

### I. Tests

- tests/geography-geology.test.js:6 and 66-71, tests/terrain.test.js:23-28, tests/water.test.js:21, tests/perf.test.js:34-61 (and new budgets for big maps), tests/command.test.js:19-36, tests/fx.test.js:89, tests/victory.test.js:23, tests/extras.test.js:38, tests/tactics.test.js:101, tests/browser/assist.spec.js:14 and 62, tests/engine-harness.js:14.
- The vm harness is much slower than the browser (about 11× for generation, 6–12× for routes, 1.4–2.4× for the simulation tick). Any budget for big maps should be calibrated, or measured in the browser.

---

## 8. Open questions and risks

1. **What is the target?** There are two different fixes for "maps too small compared to buildings and units":
   - **(a) more tiles.** This needs every item in §7.
   - **(b) a wider zoom-out**, or a strategic view, on maps of AoE2 size.

   AoE2 parity per player (120–240) only needs about 1.5–3× today's presets. That fits under the current 256 cap once the saves and per-player scaling are fixed. Going to 320–400 needs the pathfinding, AI and save work as well. Which does the user want: AoE2 parity or "much bigger than AoE2"?
2. **Should bigger maps mean bigger home areas** (resource rings, flattening and reserves scaled with n), or the same home with more contested land between players? That choice drives most of §7.B and the game's balance: travel times, attack timers (ai.js:4-7), trade income (world.js:1379), relic and wonder timers (victory.js:8-9).
3. **Should trees stay entities?** They are 73–93 % of `W.list`. Without a forest tile layer or spatial indexes, every subsystem that scans `W.list` grows with map area. That is the root cause of findings 3 and 5 and part of 6.
4. **Saves.** `localStorage` has a 5 MB ceiling. Moving to IndexedDB, compressing the typed arrays (run-length or base64 instead of JSON number arrays) and dropping the duplicated `W.spec` are decisions with save-compatibility impact. The format version is 1.
5. **Low-end hardware.** All GPU numbers come from an RTX A4000 workstation. The SwiftShader run (T9) already gave 32–34 ms frames and 29–31 fps at 80, falling to 18 fps at 400. About 1 GB of chunk canvases and 61 MB HD textures could trigger WebGL or canvas context loss on integrated GPUs. renderer25d.js:60 handles that for 2.5D by falling back to 2D.
6. **Determinism and seeds.** Any change to generation, sizes or caps changes the map for a given seed. That affects the tests' fixed seeds, users' shared seeds and saved editor maps (which store explicit layers, so they are unaffected).
7. **AI behaviour on big maps** was only measured for cost, not for quality: does it still attack, ferry and win in reasonable time when TCs are 290 tiles apart? It is untested. The 3.5-minute runs here never reached the attack phase.
8. **The pathfinding fix will dominate the risk.** Changing to a hierarchical or flow-field approach touches movement.js, polish.js, command.js and engineering.js, which all wrap `pathTo` or `findPath`.
9. **Measurement caveats.**
   - The tick numbers come from the first 3.5 minutes (about 50–150 units). Late-game armies of 200 units per player were not measured at large sizes.
   - The 2D live fps was measured with the match running (after a 1.5 s settle) for 5 s at each zoom, with the camera on the home TC early in the game. Hot spots such as big battles or full-screen forests at zoom 0.55 were not specifically staged.
   - Memory is a lower bound. The GPU-process memory for canvases is computed, not read.
