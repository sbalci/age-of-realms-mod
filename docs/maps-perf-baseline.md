# Bigger maps: performance baseline

Rows are appended by `npm run test:perf` (tests/browser/maps-perf.spec.js). Each phase of the bigger-maps roadmap
commits the rows it was measured by, so progress against the budgets stays visible. Methods: the map evaluation, §3.0.

- **Gen**: `generateMapSpec` for land, 3 / 8 players (warm JIT).
- **Tick**: all players AI, Feudal start, high resources, seed 33, 600 warm-up ticks, then the timed ticks; 3 players
  on coastal, 8 on land. Mean and p99 in ms. **Tree search**: one `findNearestRes` for trees within 30 tiles of
  a villager after the 3-player ticks, in µs (mean of 100).
- **40 knights**: one `orderMove` of 40 knights from player 1's Town Center to the farthest Town Center, made
  before the timed ticks of the 3- and the 8-player match, in ms, with the routes that reached their goal.
- **2D frame**: mean of 30 synchronous `renderWorld` + `drawOverlays` calls at zoom 1 / 0.55 (coastal, 3 players,
  seed 7). **2D fps**: live frames over 5 s at each zoom with the match running.
- **2.5D fps**: live frames over 4 s with `?renderer=three`.
- **Save**: `MatchSave.serialize()` characters and ms after the timed 3-player ticks.
- **Cache MB**: terrain chunk canvases (width × height × 4) after an 11 × 11 pan at zoom 0.55.

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-18 | phase 1 baseline | 7c7fe9f7 | gpu | 120 | 48 / 44 | 0.79 / 10.8 | 1.95 / 30 | 100 | 89 / 27 (40/40, 40/40) | 3.12 / 2.52 | 60 / 60.1 | 60.1 | 1,262,494 (16) | 353 |
| 2026-10-18 | phase 1 baseline | 7c7fe9f7 | gpu | 200 | 91 / 111 | 1.86 / 31.2 | 4.46 / 77.7 | 272 | 213 / 71 (40/40, 40/40) | 3.87 / 3.71 | 60 / 60 | 60 | 3,174,054 (46) | 982 |
| 2026-10-18 | phase 1 baseline | 7c7fe9f7 | gpu | 256 | 175 / 187 | 2.73 / 45.1 | 7.4 / 133.7 | 444 | 426 / 380 (40/40, 40/40) | 5.23 / 4.56 | 60 / 59.9 | 57.1 | 5,285,104 (62) | 1038 |
| 2026-10-18 | phase 2 indexes + stagger | a6ee5e95e | gpu | 120 | 34 / 39 | 0.34 / 1.1 | 0.86 / 2.7 | 9 | 88 / 41 (40/40, 40/40) | 3.67 / 3.39 | 54.3 / 53.5 | 53.9 | 1,252,592 (31) | 353 |
| 2026-10-18 | phase 2 indexes + stagger | a6ee5e95e | gpu | 200 | 95 / 112 | 0.66 / 3.2 | 1.3 / 4.9 | 14 | 212 / 93 (40/40, 40/40) | 4.5 / 3.81 | 54.1 / 53.8 | 53.9 | 3,172,860 (46) | 982 |
| 2026-10-18 | phase 2 indexes + stagger | a6ee5e95e | gpu | 256 | 170 / 188 | 0.98 / 3.4 | 1.65 / 7.9 | 5 | 421 / 424 (40/40, 40/40) | 5.39 / 4.64 | 54.3 / 54 | 50.7 | 5,291,779 (67) | 1038 |

## Phase 2: vm tick, W.list scans against the index (node tests/perf-vm.js)

8 AI players on land, seed 33, 600 warm-up ticks and 1200 timed ticks in the node vm harness (slower than the browser).

| n | vm tick mean / p99 ms, W.list scans | vm tick mean / p99 ms, index | vm AI ms per tick, scans → index |
| --- | --- | --- | --- |
| 200 | 11.04 / 50.9 | 4.39 / 14.7 | 5.86 → 0.94 |
| 256 | 14.92 / 48.1 | 4.07 / 9.4 | 8.07 → 0.41 |
