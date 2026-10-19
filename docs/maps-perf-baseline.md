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
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 120 | 61 / 55 | 0.32 / 1 | 0.83 / 2.7 | 9 | 88 / 41 (40/40, 40/40) | 3.66 / 3.21 | 60 / 60.1 | 60.1 | 1,252,605 (15) | 353 |
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 200 | 94 / 109 | 0.65 / 2.8 | 1.34 / 4.6 | 9 | 205 / 90 (40/40, 40/40) | 4.39 / 4.46 | 60.1 / 60 | 59.9 | 3,172,830 (38) | 982 |
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 256 | 174 / 194 | 0.95 / 3.2 | 1.72 / 7.7 | 4 | 419 / 407 (40/40, 40/40) | 5.18 / 4.82 | 59.8 / 59.6 | 56.9 | 5,291,785 (74) | 1038 |
| 2026-10-19 | phase 3 hierarchy + group routes | d653d18 | gpu | 120 | 49 / 46 | 0.33 / 1.2 | 0.81 / 2.1 | 5 | 9 / 7 (40/40, 40/40) | 4.04 / 2.88 | 60.1 / 60 | 60 | 1,252,076 (16) | 353 |
| 2026-10-19 | phase 3 hierarchy + group routes | d653d18 | gpu | 200 | 118 / 120 | 0.63 / 2.5 | 1.13 / 3.4 | 8 | 16 / 8 (40/40, 40/40) | 3.87 / 3.92 | 60.1 / 60.1 | 59.8 | 3,174,816 (41) | 982 |
| 2026-10-19 | phase 3 hierarchy + group routes | d653d18 | gpu | 256 | 170 / 192 | 0.85 / 2.7 | 1.4 / 4.1 | 5 | 13 / 14 (40/40, 40/40) | 4.94 / 4.86 | 60 / 60 | 57.3 | 5,292,814 (71) | 1038 |
| 2026-10-19 | phase 3 final (group fix) | b5af246 | gpu | 200 | 117 / 112 | 0.58 / 2 | 0.94 / 2.5 | 7 | 19 / 10 (40/40, 40/40) | 3.65 / 3.36 | 56.7 / 56.6 | 56.8 | 3,174,814 (37) | 982 |
| 2026-10-19 | phase 3 final (group fix) | b5af246 | gpu | 256 | 175 / 193 | 0.73 / 2.1 | 1.25 / 3 | 5 | 17 / 11 (40/40, 40/40) | 4.83 / 4.35 | 56.7 / 56.5 | 54 | 5,292,820 (63) | 1038 |

### Reading these rows

- Every figure is a single run on the RTX A4000 workstation. Live fps and the save, gen and knight timings vary from run to run.
- Between the phase 1 and phase 2 runs, the machine's live fps dropped from 60 to about 54. A same-session A/B on 2026-10-18 at 200 × 200 measured:

  | Code | 2D fps z1 / z0.55 | 2D frame ms z1 / z0.55 | 2.5D fps | Tick 8p mean / p99 ms |
  |---|---|---|---|---|
  | phase-1 code 50908f5 | 54.1 / 54.1 | 4.55 / 3.71 | 53.1 | 5.19 / 92.2 |
  | phase-2 code d694b97 | 54.4 / 54.2 | 4.53 / 3.62 | 53.2 | 1.33 / 5.4 |

  So the fps and frame-ms changes come from the environment, not from phase 2. The tick improvement is real.
- From phase 3 on, compare against a control run of the previous phase's commit made in the same session.
- Phase 3, 200 × 200: the 3-player 40-knight order measured 16 ms, exactly the ≤ 16 ms budget (a single, rounded run; planning measured 12 ms). Treat it as at the limit, and re-check it with a median of several runs in phase 4.
- The "phase 3 final (group fix)" rows supersede the earlier phase 3 rows for the group-order column (40 knights), which were measured before the group join and leave rule was bounded to points near the slot. Their 40-knight order measured 19 / 10 ms at 200 × 200 and 17 / 11 ms at 256 × 256 (3 / 8 players): the 3-player orders are over the 16 ms budget (single runs; the earlier rows read 16 / 8 and 13 / 14). The other columns are unchanged within run-to-run variation.

## Phase 2: vm tick, W.list scans against the index (node tests/perf-vm.js)

8 AI players on land, seed 33, 600 warm-up ticks and 1200 timed ticks in the node vm harness (slower than the browser).

| n | vm tick mean / p99 ms, W.list scans | vm tick mean / p99 ms, index | vm AI ms per tick, scans → index |
| --- | --- | --- | --- |
| 200 | 11.04 / 50.9 | 4.39 / 14.7 | 5.86 → 0.94 |
| 256 | 14.92 / 48.1 | 4.07 / 9.4 | 8.07 → 0.41 |

## Phase 3: Town Center routes at 480 (node tests/hpa-stress.js)

The size cap is lifted inside the vm, as the perf spec's cap patch does in the page. For every pair of Town Centers, a
villager's route: overland, or on islands a land leg to the shore, a transport's sea leg and a land leg to the Town
Center. "Old search" is the same request with the hierarchy switched off. Times are vm milliseconds (the vm is
6–12× slower than the browser on routes).

| map | n | players | Town Center pairs | routes ok, hierarchy | routes ok, old search | legs (land / sea) | ms per route, hierarchy / old | build + edges ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| land | 480 | 8 | 28 | 28/28 | 27/28 | 28 / 0 | 31.5 / 74.9 | 1531 |
| land | 480 | 2 | 1 | 1/1 | 1/1 | 1 / 0 | 56.5 / 134.8 | 1453 |
| coastal | 480 | 8 | 28 | 28/28 | 19/28 | 28 / 0 | 45.4 / 92.7 | 1531 |
| coastal | 480 | 3 | 3 | 3/3 | 2/3 | 3 / 0 | 69.9 / 120.5 | 1458 |
| islands | 480 | 4 | 6 | 6/6 | 6/6 | 0 / 6 | 4.4 / 17.8 | 1174 |
