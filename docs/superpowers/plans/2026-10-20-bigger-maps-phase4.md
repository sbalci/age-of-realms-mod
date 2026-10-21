# Bigger Maps — Phase 4 Implementation Plan (saves v2, IndexedDB and editor storage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First close the two phase 3 carry-overs the user decided on: no group order may cost more than 16 ms in one frame, and no unit may walk on the spot for good. Then make large matches saveable and loadable: an IndexedDB store with five manual slots and an autosave, a compact save format 2 that still reads format 1, an autosave that never holds the simulation, gzip export and import, editor maps in IndexedDB with tile-diff undo and custom sizes, and a one-time move of the old `localStorage` saves and maps.
**Architecture:** Seven tasks, in this order:
- **C1. Lazy per-member group joins (hpa.js, world.js, polish.js).** Nothing is searched in the click. The group's one route search runs alone in the next tick. The members then join it over the following ticks, each charged to `PATHB`, at most 24 a tick. Graph repair (dirty clusters and intra-edge rows) moves out of the searches into a bounded `hpaUpkeep` after each tick, so an order given mid-game costs the same as one at the start. On a click on an obstacle, the members set off along the shared route at once and then take the paths of their own searches, run on their own ticks, so they come at it from their own sides, as per-unit searches do.
- **C2. The movement livelock (movement.js).** After a tick without progress, a unit must beat its best distance to the waypoint before it counts as moving again. Otherwise a drift and a step back cancel out for ever. It sits behind `MOVE.mark`, so the signature test's off mode still replays the matches from before phase 3.
- **Task 1. `game/js/store.js`.** The IndexedDB database `aor` with the stores `saves`, `maps` and `meta`. It is promise based and falls back to `localStorage`.
- **Task 2. Save format 2 (`game/js/codec.js`, session.js).**
  - Typed arrays are stored as PackBits run-length bytes in base64.
  - Every object is a node made of a shape (its keys, listed once) and its values.
  - A generated map's spec is saved as the options that regenerate it.
  - The limits scale with n, under a 256 MB sanity cap.
  - Format 1 still loads, and gets the AI stagger once on the way in.
  - Stale occupancy ids are cleared at load, and building the pathfinding graph no longer writes the map.
- **Task 3. Slots, the pause-free autosave and gzip.**
  - Five manual slots and the autosave live in the store.
  - The autosave copies the match in one snapshot between two ticks, then walks, packs and writes that copy in idle slices of at most 8 ms while the match plays on.
  - Every failure shows a message.
  - Export and import use gzip.
- **Task 4. The editor.**
  - Maps live in IndexedDB, with an in-memory mirror.
  - Undo keeps only the changed tiles and objects.
  - Custom sizes go up to what `validateMapSpec` allows: 480 once phase 8 lifts the cap.
  - Imports are limited by the sanity cap instead of 8 MB.
- **Task 5. Migration.** On the first start, the old saves and maps are copied into IndexedDB. Each original stays until its copy reads back.

**Tech Stack:** plain browser JS (`game/js/*.js`, loaded in order by `game/index.html`), Node 22 vm tests (`tests/*.test.js`, `tests/engine-harness.js`, collected by `tests/run-all.js`), Playwright 1.64.1 with Chromium 1248 (`tests/browser/*.spec.js`).

**Spec:** [docs/superpowers/specs/2026-10-18-bigger-maps-design.md](../specs/2026-10-18-bigger-maps-design.md) §4 "Saves and editor" and §5. **Roadmap:** [2026-10-18-bigger-maps-roadmap.md](2026-10-18-bigger-maps-roadmap.md), Phase 4. **Evidence:** [docs/superpowers/specs/2026-10-18-map-evaluation.md](../specs/2026-10-18-map-evaluation.md) E§1.5, E§5.11 (saves) and E§5.12 (editor). **Carry-overs:** `.superpowers/sdd/progress-maps-phase3.md` (final lines and Minor lines) and `progress-maps-phase1-2.md` ("Final review").

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
| `game/js/hpa.js` | C1, 2 | Modify | `hpaRoute`, `hpaJoinDue`, `o.join` for group members; `stats.waits`; a blocked click's members set off along the shared route and take their own searches' paths later (`hpaOwnDue`), those searches charged to `PATHB` by their size (C1). `hpaPassFn` never writes the map; `hpaPending` (2) |
| `game/js/world.js` | C1, 4 | Modify | `setOrder` leaves a joining member's path for its tick; the `move` and `attackmove` cases wait on `hpaJoinDue` and call `hpaOwnDue` (C1). Editor worlds get no civ start villagers (4) |
| `game/js/polish.js` | C1 | Modify | `pathBudgetTick()`; every request is charged, members' joins included |
| `tests/hpa-group.test.js` | C1 | Modify | Members join on their own ticks (`settle`); per-tick join counts; the mine click over 20 order times against 9/10 of the per-unit count, every member moving within 3 ticks |
| `tests/sim-signature.test.js`, `tests/fixtures/sim-signatures.json` | C1, C2 | Modify, record | Both modes in every run, the off mode under `key@hpa-off` (C1); off also turns `MOVE.mark` off, and the switch-on coastal hash is re-recorded (C2) |
| `tests/browser/maps-perf.spec.js` | C1, 3 | Modify | The 40-knight column is the worst frame of the order's own work, median of 5 fresh pages (C1). Five autosaves in a live 8-player match: snapshot, slices, ticks (3) |
| `game/js/movement.js` | C2 | Modify | `MOVE.mark`: progress after a stuck tick must beat the best distance to the waypoint |
| `tests/movement-livelock.test.js` | C2 | Create | The cliff-corner leg, the 10-spearman group with `joinReach` 24–44, 240 single-unit moves |
| `game/js/store.js` | 1 | Create | IndexedDB `aor` (`saves`, `maps`, `meta`), `localStorage` fallback, promise API |
| `tests/fake-idb.js` | 1 | Create | In-memory IndexedDB and `localStorage` for node tests |
| `tests/store.test.js` | 1 | Create | Round trips, persistence, quota errors, fallback, no storage |
| `tests/browser/saves.spec.js` | 1, 3, 4, 5 | Create, extend | Store across a reload (1); gzip export and import, the live autosave at 256, a 480 save through IndexedDB (3); the editor's maps, custom size, a 9 MB import (4); the move of old saves (5) |
| `game/index.html` | 1, 2 | Modify | Loads `store.js` (1) and `codec.js` (2) after `glyphs.js` |
| `tests/make-save-fixture.js`, `tests/save-compat.test.js` | 2 | Modify | A fixture records how its build plays on after loading it (`replay`); the compat test checks it |
| `tests/fixtures/saves/2026-10-20-phase3-final-v1.json.gz` | 2 | Create | A format 1 save from the build just before format 2 |
| `game/js/codec.js` | 2, 3 | Create, extend | PackBits run-length bytes, base64, `packArray` / `unpackArray`, `CODEC.cap` (2); gzip (3) |
| `game/js/map.js` | C1, 2 | Modify | `PF.expanded`, the tiles every `pfGrid` search expands (C1). `SPEC_LAYERS` (2) |
| `game/js/session.js` | 2, 3, 4, 5 | Modify | Format 2 encode and decode, both formats in `parse`, the limits, the spec stub, the stagger, stale ids (2); slots, the autosave's snapshot and slices, failure messages, gzip export and import, the slot UI (3); the editor's maps at boot (4); the migration (5) |
| `game/js/ui.js` | 2 | Modify | `restartGame` regenerates a stub spec |
| `tests/reliability.test.js` | 2, 3 | Modify | Malicious format 2 payloads and the engine-method check on format 2 (2); the old autosave-once test moves to `autosave.test.js` (3) |
| `tests/save-v2.test.js` | 2 | Create | Codecs, the round trip, the regenerated spec, 480 ≤ 6 MB, the limits, format 1 and the stagger, stale ids |
| `tests/resume.test.js` | 2 | Create | A save resumed in a fresh page equals the match never saved; group state not saved |
| `tests/autosave.test.js` | 3 | Create | The autosave writes the one-shot save of its snapshot's moment while the match changes in every way; slots, a message for every failure, gzip |
| `tests/browser/game.spec.js` | 3 | Modify | The save-and-load test uses the slot picker |
| `game/js/editor.js` | 4 | Modify | Maps in the store with a mirror, tile-diff undo, custom sizes, imports up to the cap |
| `tests/editor.test.js` | 4 | Create | Exact undo and redo of 16 kinds of change, 60 strokes at 480, custom sizes, storage, a 9 MB and a gzip import |
| `tests/migrate.test.js` | 5 | Create | The move of old saves and maps, the stagger on the way, failure and a retry |
| `docs/maps-perf-baseline.md` | C1, 5 | Append | Phase 4 rows beside a same-session control of 91c0970 |

**Validated while planning.**
- Every task was applied in order to a fresh `git clone --shared` of this repository, checked out at 91c0970. The machine: Windows 11, Node 22.17.1, Playwright 1.64.1, RTX A4000.
- `git worktree add` does not work on this drive (FAT32, `.git/worktrees` stuck), so use a clone for the control run too.
- The code blocks below were turned into replace operations by a script. Each was checked to occur exactly once in the file at that step and to quote whole lines.
- A second clone rebuilt from those blocks matched the validated clone exactly. Only the new fixture's own timestamps differed.
- Browser runs used a temporary Playwright config whose `webServer` served the clone, with `@playwright/test` found through `NODE_PATH` pointing at this checkout's `node_modules`.
- Outputs quoted as "observed while planning" come from those runs.

**Test runs.**
- `npm test` (`tests/run-all.js`) runs every `tests/*.test.js`. The new suites join it; none joins `--quick`.
- `tests/fake-idb.js` is a helper, not a test.
- A full `npm test` took about 12 minutes on the planning machine after Task 5. `tests/perf.test.js` is a timing test: if its battle check fails while other programs load the CPU, run it alone.

**Commits.** The commit messages below end with the trailer of the model that wrote this plan. An implementer running on another model puts its own `Co-Authored-By:` line there instead.

**Determinism and the signatures.**
- At 91c0970, `AOR_HPA=off node tests/sim-signature.test.js` already replays the hashes from before phase 3, `f620967b…` and `f3599320…`. It still reports `0 passed, 2 failed`, because the fixture holds only the switch-on hashes `9fda2e5c…` and `824240c4…`.
- **C1** makes the test play both modes in every run and record the off mode under `<scenario>@hpa-off`. C1 changes no recorded hash:
  - the 10-minute AI matches never send a shared group far enough for lazy joins to matter (the AI's own attack-moves are per unit);
  - so the switch-on hashes stay `9fda2e5c…` and `824240c4…`;
  - with the switch off, `hpaGroupOrder` makes the old `setOrder` calls, so the off mode replays `f620967b…` and `f3599320…`.
- **C2** changes the movement layer, which both modes share. Units livelocked in the recorded coastal match (with the fix alone, the off hashes became `216d7582…` and `26324511…`).
  - So the fix sits behind `MOVE.mark` (default on), and the test's off mode turns it off together with `HPA.enabled`. The off mode still replays `f620967b…` and `f3599320…`, and still proves that the two switches are the only differences.
  - C2 re-records once, deliberately and in the switch-on mode only: `small-coastal-3p-castle` becomes `ed4b527667fe3f8f01660cf4a7aa419a774cf396`, and `tiny-land-2p-feudal` stays `9fda2e5c…`.
- C1's blocked-click rule changes no hash either (the AI never sends a shared group onto an obstacle in those matches), and C1's `hpaUpkeep` changes none: it only moves graph repairs earlier, and the graph is a pure function of the map. The format 1 fixture's replay hash (Task 2) stays the same with or without it.
- Tasks 1–5 change no hash. Saving is not part of the simulation, and with no stale ids in play, `hpaPassFn` putting a stale id back changes no route.

**Findings while planning** (the evidence behind the design):
- **C1, the click frame at 91c0970.** The 40-knight perf order, profiled with timing wrappers (the wrappers add 1–5 ms):

  | | browser 200 3p | browser 200 8p | browser 256 3p | browser 256 8p | vm 200 3p | vm 256 8p |
  |---|---|---|---|---|---|---|
  | whole click | 19.9 | 15.3 | 19.9 | 17.7 | 86.5 | 83.3 |
  | the group's one route search | 8.1 | 5.6 | 13.5 | 12.6 | 37.2 | 68.0 |
  | 40 member joins (`hpaJoin`) | 9.8 | 8.5 | 3.8 | 2.8 | 44.2 | 12.5 |
  | of which 600-node join searches | 8.6 (22) | 7.4 (36) | 2.7 (10) | 1.7 (22) | 40.5 (22) | 8.7 (22) |
  | formation (`cmdFormation`) | 1.1 | 1.2 | 1.3 | 1.4 | 3.1 | 2.0 |

  - Browser figures are medians of 5 fresh pages, in ms (searches in brackets).
  - The route search is mostly the corridor refinement: `pfGrid` took 4–9 ms for 6,600–10,900 nodes, `hpaSearch` 0.4–3 ms and smoothing under 1 ms. The first long search of a page is slower (a cold JIT); a repeat took 2–6 ms.
  - So the click was the route plus the joins. Deferring the joins alone would still leave up to 13.5 ms of route search in the click at 256, plus the formation.
  - So the route also moves out of the click, into a tick of its own.
- **C1, the same order mid-game.** The perf spec ordered the knights at the start of the match, right after `hpaWarm` had built the whole graph. Ordered after 30 game seconds of AI play, the click at 91c0970 cost 15.3 / 7.7 / 22.9 / 23.1 ms (200 3p / 200 8p / 256 3p / 256 8p, medians of 5 pages).
  - The route search refilled the intra-edge rows that graph repairs had cleared: 263 rows (9 ms) with 3 players, and 661 rows (24 ms) with 8, at 256.
  - Lazy joins alone left that cost in the route's tick, up to 29 ms.
  - C1 therefore also repairs the graph between searches (`hpaUpkeep`), and the perf spec now measures both moments.
- **C2, the livelock.** Units walk on the spot for good: the stuck time goes +dt, −dt, +dt and never reaches `MOVE.repathAfter`, so no repath happens and the rescue never fires (`mvFails` stays 0). Task C2 has the reproducer and the mechanism. Per-unit paths hit it too: 14 of 720 random moves on 160 maps with the hierarchy off, and 15 with it on.
- **Stale occupancy ids never occur in play.** No AI match tested left one: 80 coastal 3p, 64 land 2p, 100 land 4p, 100 alpine 4p and 120 rivers 8p, up to 12 game minutes. Nor does any committed save fixture hold one.
  - At 91c0970, a match resumed in a fresh page already plays on exactly like the uninterrupted one in those five scenarios. The resume test (Task 2) found no divergence to fix.
  - The hazard the phase 3 review named is still real for an id that does go stale: an older save, or a future code path that removes an entity without clearing its tile.
  - Task 2 closes it twice: building the graph no longer writes `blk`, so a graph built at load equals one built lazily, and loading clears stale ids before anything reads them.
- **Save sizes**, after 3 game minutes of AI play, vm, in characters:
  - 200 × 200 coastal, 3 players: format 1 3,171,770; format 2 631,898.
  - 480 × 480 land, 8 players: format 1 24,684,061, which the old 16e6 cap could never load; format 2 4,107,807, of which 0.90 M are layers and 3.11 M objects. After 10 game minutes, format 2 is 4,282,515 (49,112 entities, 772 units).
  - Serialising took 162 → 89 ms at 200 and 412 ms at 480; parsing 567 → 231 ms at 200 and 1,187 ms at 480 (vm).
- **The mine click: a wolf, not the paths.** Over 20 order times (0 to 19 ticks into the match), the formation test's 20 spearmen ended at their slot round a gold mine 244 of 400 times with per-unit searches, 115 with phase 3's shared route and 104 with lazy joins along it.
  - Every unit's order ended on its own slot, in every mode. Two wolves stand by the mine; the first units to arrive attack them, and the fight pulls units off their slots. With the wild animals removed, all 400 end at their slot in every mode.
  - Along the shared route all 20 came round the same side of the mine, 3 tiles from a wolf. With their own searches, 6 of 20 came other ways, and fewer joined the fight.
  - Tried first, and not enough: leaving the route 12–32 tiles before the order point and searching on from there (85–108 of 400: one point to start from funnels the members as the route does).
  - Each member searching on its own from where it stands: 239 of 400 (242 with group orders switched off altogether). Run before the members set off, those searches made them wait: 24 in one tick took 50–114 ms (40 knights onto a gold mine across 256), and charged to the path budget by their size they left the last knight standing 41 ticks (2 s).
  - So C1 sends the members along the shared route at once, and gives each the path of its own search once that has run, from where it then stands, if it is no longer than the rest of the shared path plus 2 tiles: 232 of 400, every unit moving within 2 ticks. With no length limit, 232 too; with no slack, 227.
  - Ticks until each of 40 knights first moves, ordered onto the gold mine nearest the far Town Center (vm; ticks are deterministic). At 256 with 3 players, own searches first: median 21, last 41 (one knight a tick from tick 15); the hybrid: 4 at tick 1, 20 at tick 2, 16 at tick 3. At 256 with 8 players: 21 and 41, against 2 and 3; at 200: 8 and 37 (3 players), 7 and 17 (8 players), against at most 3. In the browser, medians of 5 fresh pages, the order's worst frame, own searches included: 10.4 / 8.6 / 14.7 / 14.2 ms (200 3p / 200 8p / 256 3p / 256 8p), against 8.5 / 8.1 / 11.8 / 10.5 along the shared route alone and 22.2 / 14.6 / 17.7 / 15.6 in the click at 91c0970.
  - The C1 test therefore sums 20 order times and asks for 9/10 of the per-unit count, with every route reaching its goal and every unit moving within 3 ticks.
- **The editor's undo could never be exact.** `loadSpec` → `createWorld` gave Chinese and Spanish players their extra start villagers on every reload. So every undo added units, and they appeared at x = −3 for players with no start. Task 4 skips those villagers in editor worlds. A match from an editor map still gets them.
- **The autosave's snapshot**, measured in the browser after 600 ticks of an 8-player land match (ms):

  | | 200 | 256 | 480 |
  |---|---|---|---|
  | entities (flat records) | 8,013 (7,686) | 13,851 (13,477) | 48,852 (48,271) |
  | walking the live world (the first design held the simulation for this), paused page | 12.1 | 17.2 | 63.5 |
  | `structuredClone` of the save's value, paused page | 17.1 | 26.5 | 91.8 |
  | **the snapshot**, 5 live autosaves (median) | 5.8 / 5.4 / 4.9 / 3.4 / 3.4 (**4.9**) | 7 / 6.1 / 4.6 / 6.9 / 6.8 (**6.8**) | 16 / 16.8 / 11.6 / 9.3 / 9.1 (**11.6**) |
  | the longest slice of those autosaves | 6.8 | 6.2 | 7.9 |
  | the longest tick while they ran | 3.7 | 4.4 | 12.1 |
  | the whole autosave, snapshot to text (median) | 76 | 92 | 430 |
  | the text equals `serialize()` at the snapshot | yes | yes | yes |

  - Holding the simulation while the world was walked (the first design) held it 18–34 ms at 200–256 in the perf runs and about 200 ms at 256 in the browser suite; the walk alone is 63.5 ms at 480.
  - Copying the 48,800 entities at 480 as objects took 11 ms even in a paused page: the copies outlive the young generation. Reading the flat records' 580,000 values through computed names took 27 ms; readers compiled per shape, arrays reused from the last snapshot and the pass in a function of its own brought the snapshot to about 9 ms in a paused page. A live match costs more and varies more (above), and the first snapshot of a page still costs the most (16 ms at 480 in the final run; 18–26 ms before the rehearsal).
  - Where the time goes, from a CPU profile of six live snapshots at 480 (10–18 ms each): per snapshot, 6.5 ms in the pass over the flat records and 2.4 ms in their readers, 3.6 ms in `freeze` itself (the list copy, the fills, and filling in the copies' object values), and 2.5 ms copying the other 2,500 objects. No garbage collection ran inside any snapshot.
  - **So the 8 ms at 480 is not met; the user accepted the measured value for phase 4.** A snapshot of this kind has to touch all 48,800 entities and check each one's keys, since any of them may have changed since the last tick. Reaching 8 ms would need the simulation to say which resources changed: a dirty mark at the dozen or so places that write a resource (gathering and felling in world.js, water.js, terra.js, terrain.js), so that a snapshot copies only the resources written since the last one. That touches simulation code and binds every future writer, so it is a task for a later phase ("After Task 5").
  - The snapshot keeps the save exact: the text equals a one-shot `serialize()` at the snapshot's moment while the match plays on (autosave.test.js changes flat records, entities, resources, arrays and layers between the slices; the browser test compares a live autosave).

**Design decisions.**
- **The group's route runs in a tick of its own.**
  - The first member to tick runs the one search and fills that tick's path budget; from the next tick on, members join while `PATHB.used < PATHB.perTick` (24).
  - At least one member of each group joins every tick, so an AI that spends the budget can never starve an order.
  - 40 knights: one route tick, then 24 and 16 joins.
  - `PATHB` now charges every request, a member's join included. Before, it charged the group's search once and its members not at all.
- **Waiting is marked in the order.** A `move` order carries `join: 1` until its member joins, so the mark survives a save. Group state does not (`HPA_GROUP`, a `WeakMap`), so after loading, a waiting member just makes its own search, and a blocked click's member still waiting for its own search keeps its shared path. Attack-move already waits for its first tick, so only its budget check is new.
- **The off mode keeps proving the switches.** `MOVE.mark` exists only so the signature test's off mode can replay the matches from before phase 3. The game has no URL for it.
- **Format 2 keeps format 1's graph model**, so shared objects and cycles survive, with these changes:
  - compact nodes;
  - typed arrays as base64 run-length bytes;
  - objects as a shape plus their values;
  - `W.spec` as a stub for generated maps.

  The stub keeps the name, the starts and the regeneration options, including the river rule the map was made with. Restart regenerates the spec.
  - `deco` stays in the save. It is random bytes, 0.3 M of 4.1 M characters at 480, so regenerating it would save 7 % and add a way to diverge.
- **The autosave: one snapshot, then slices.**
  - A rehearsal on every 8th entity runs first, so that the snapshot's code is compiled; then, on the next idle period, the snapshot (`freeze`) in one go, between two ticks. Nothing holds the simulation.
  - The snapshot copies typed arrays into the last snapshot's copies, other objects with their prototype, key order and shared references, and keeps `W.list`'s flat records (the resources) as values in one array, read by compiled per-shape readers.
  - Walk, pack and write run on the snapshot in idle slices while the match plays. The text equals `serialize()`'s at the snapshot's moment, so no save is dropped or retried.
  - The walk (every 128 nodes, or 4096 items of a list), the packing and the JSON each end a slice before a step as long as their last one would overrun it. Slices aim at 6 ms so that none passes 8 ms.
  - A layer is run-length coded in 192 KB chunks in both paths. Runs split at a chunk edge decode back to back.
- **A click on an obstacle** (`route.blocked`: any tile the leader cannot stand on, water included): the members set off along the shared route at once; each one's own search runs later on its own tick, after the group's joins, charged to `PATHB` by the tiles it expands, and the member takes its path when it is no longer than the rest of the shared one (+2 tiles). A route that stops short keeps its shared pocket search, and an order on open ground keeps the shared route alone.
- **Slots.** Manual slots `1`–`5` and `auto` are kept in the `saves` store. Their summaries are in `meta`, under `save:<slot>`, so the menus list slots without reading saves.
  - **Save Match** opens a picker of five slots in the existing modal and button style.
  - **Load Match** lists the five slots and the autosave, with empty ones disabled.
  - Saving and loading are async; the old `localStorage` keys are read only by the migration.
- **Editor maps** are stored as `{ format: 'aor-map', version: 2, spec }` with packed layers. `Editor.maps` mirrors them in memory, so the setup screen's custom-map list and `launchFromSetup` stay synchronous.
  - Boot loads the mirror; the **Single Player** button waits for it.
  - Undo entries:
    - hold the changed tile indexes with their values before and after, plus the objects removed and added;
    - a change that replaced the world (a new player reloads it) keeps a packed spec instead;
    - the stacks keep at most 60 entries and `Editor.undoLimit` (32 MB).
- **Migration** converts a format 1 save through `parse` → `convert`, without loading it, so the AI stagger applies once.
  - Each copy is read back and parsed before its original is removed.
  - The run is marked done (`meta` `migrated`) only when nothing was left behind.
  - A map name already in IndexedDB with different content keeps the old map as `<name> (old storage)`.

---

### Task C1: Lazy per-member group joins

The 40-knight cross-map order is the roadmap's group-order budget: ≤ 16 ms, and every route reaching its goal. The phase 3 final rows measured its click at medians of 20 ms (200) and 17 ms (256) with 3 players, and 10 ms and 11 ms with 8.

The click runs two kinds of work (see "Findings while planning"):
- the group's one route search: up to 13.5 ms at 256 in the browser;
- the 40 member joins: up to 9.8 ms at 200, most of it in 600-node searches onto the route.

So both leave the click:
- **The click** gives every unit its order, as before: queues, stances, formation slots and `o.user` are unchanged.
  - A member of a shared group (not a straggler, not a near "solo" order) gets a `move` order marked `join: 1`.
  - `setOrder` leaves such an order's path for later.
- **The member's tick.** `updateUnit`'s `move` case, and the `attackmove` case before its first path request, ask `hpaJoinDue(u, o)`:
  - The first member of a group to tick runs the group's route search (`hpaRoute`). It is charged to `PATHB` and fills the rest of that tick's budget. That member waits.
  - On the next ticks, members join while `PATHB.used < PATHB.perTick`, and at least one member of each group joins every tick. Each join is the old `hpaShared` → `hpaJoin` path, now charged to `PATHB` like any request.
  - A waiting member stands still (`anim` `idle`), and `separate` keeps it apart from the others.
- **Anything without a shared group** answers at once: an order loaded from a save, a straggler, a solo group, or an attack-move unit ordered alone. Its own search runs as before.
- **With the hierarchy off**, `hpaGroupOrder` makes the old `setOrder` calls and nothing is marked, so the old code path is unchanged.
- **A click on an obstacle** (a mine, a tree, a building, or any other tile the leader cannot stand on, water included: `hpaSnap` moved the order point) whose route reaches it (`route.blocked`):
  - Along the shared route alone, the members all came round the same side of the obstacle, past whatever stood there. Round a gold mine in the formation test, a wolf attacked the column and the fight pulled the units off their slots: over 20 order times, 104 of 400 ended at their slot (phase 3's shared route: 115), against 244 with per-unit searches. With the wild animals removed, all 400 reach their slot in every mode.
  - So the members set off along the shared route as for any order, all moving within 3 ticks of the click, and each one's own search runs later, on its own tick (`hpaOwnDue`): once no member of the group has joined for a tick, at least one per group a tick, more while the tick's budget can take searches the size of the group's route.
  - Each own search is charged to `PATHB` 1 more for every `HPA.ownUnit` (400) tiles it expands (`pfGrid` now counts them, `PF.expanded`). It counts tiles, not time, so the simulation stays deterministic.
  - The member takes its own path, from where it stands, only when it is at most `HPA.ownSlack` (2) tiles longer than what is left of the shared one. So a unit turns round only onto a way that is no longer from where it stands.
  - Round the mine: 232 of 400 at their slot (0.95 of the per-unit count), every route reaching its goal (400 of 400), every unit moving within 2 ticks.
  - A route that stops short (a click inside a forest, on an island) keeps its shared pocket search, and an order on open ground (the knights) is unchanged.
  - Measured in the browser, medians of 5 fresh pages, a 40-knight order onto the gold mine nearest the far Town Center (122–189 tiles): the worst frame of the order's own work, its own searches included, is 10.4 / 8.6 / 14.7 / 14.2 ms (200 3p / 200 8p / 256 3p / 256 8p), against 8.5 / 8.1 / 11.8 / 10.5 along the shared route alone and 22.2 / 14.6 / 17.7 / 15.6 in the click at 91c0970. Every knight moves within 3 ticks of the click; the own searches then run over about 40 ticks (2 s) at 256 while the knights walk.

40 knights across 256: the click searches nothing, the next tick runs the route alone, then 24 and 16 members join. The members leave 2–3 ticks (0.1–0.15 s) after the click.

**Graph repair moves out of the searches.**
- The perf spec orders the knights at the start of a match, right after `hpaWarm` has built the whole graph. Ordered after 30 game seconds of AI play, the same order cost more:
  - at 91c0970, 15.3 / 7.7 / 22.9 / 23.1 ms in the click (200 3p / 200 8p / 256 3p / 256 8p, medians of 5 pages, the final perf session);
  - with lazy joins alone, up to 29 ms in the route's tick (4–29 ms).
- Every felled tree and every new building dirties clusters. `hpaRebuild` repairs them on the next query (1–1.6 ms), and clears the intra-edge rows of the clusters it touches. The route search then recomputed those rows as it met them: 263 rows (9 ms) with 3 players and 661 rows (24 ms) with 8, inside one order at 256.
- So C1 adds `hpaUpkeep`, after every tick. It rebuilds dirty clusters every `HPA.upkeepEvery` (20) ticks and refills at most `HPA.upkeepRows` (48) missing rows a tick.
- The graph is a pure function of the map, so every route and every signature stays the same; only the moment of the work moves.
- Profiled with timing wrappers after 30 s at 256: the route's whole tick took 15.5 ms (3p) and 14.2 ms (8p) with upkeep, against 19.7 and 36.2 ms without it.

**Files:**
- Modify:
  - `game/js/hpa.js`: `HPA.stats`, the group-orders comment, `hpaGroupOrder`'s loop, the new `hpaRoute` (with `route.blocked` and `size`) and `hpaJoinDue`, `hpaShared` (it marks a blocked click's member for its own search), the new `hpaOwnDue`, `hpaShares`' comment, a comment in `hpaJoin`, and `HPA.ownUnit` / `ownSlack`; `HPA.upkeepEvery` / `upkeepRows`, `hpaRebuild` marks `rowsDue`, and the new `hpaUpkeep` before `hpaWarm`.
  - `game/js/world.js`: `setOrder`, and the `move` and `attackmove` cases of `updateUnit` (their joins, and `hpaOwnDue`).
  - `game/js/polish.js`: `PATHB` and its `pathTo` wrapper.
  - `game/js/map.js`: `PF.expanded`, counted by `pfGrid`.
  - `tests/hpa-group.test.js`: `settle`, parts 1, 2, 4, 5, 6, 7 and 8.
  - `tests/sim-signature.test.js`: both modes.
  - `tests/browser/maps-perf.spec.js`: `measureKnights`.
- Record: `tests/fixtures/sim-signatures.json` (the `@hpa-off` keys).
- Append: `docs/maps-perf-baseline.md`.

**Interfaces:**
- Consumes:
  - `hpaGroupOrder`, `hpaShared`, `hpaJoin`, `hpaSnap`, `HPA_GROUP` (hpa.js, phase 3);
  - `findPath(..., cls)`, `setOrder`, `moveToPoint`, `updateUnit`;
  - `PATHB` (polish.js).
- Produces:
  - `hpaRoute(g, u)`: the group's one search into `g.route` `{ pts, ok, sx, sy, blocked, size }`, charged 1 to `PATHB`; `blocked` when the click was on a tile the leader cannot stand on, `size` the tiles its search expanded.
  - `hpaOwnDue(u)`: on a blocked click's member's tick, its own search when the budget allows, and its own path when that is not longer than the rest of the shared one.
  - `HPA.ownUnit` (400), `HPA.ownSlack` (2), `HPA.stats.own` / `ownTaken`, and `PF.expanded` (map.js: every `pfGrid` search's expanded tiles, summed).
  - `hpaJoinDue(u, o) → boolean`: may `u` make its first path request now? It clears `o.join` when the answer is yes.
  - `o.join` (1) on a waiting member's `move` order.
  - `pathBudgetTick()` (polish.js).
  - `HPA.stats.waits`;
  - `hpaUpkeep()` (an `afterTick` hook), `HPA.upkeepEvery`, `HPA.upkeepRows`, and `G.rowsDue` / `G.upk` on each class graph.
  - The test's `settle(us)`.
  - Perf spec: `measureKnights` / `measureKnightRuns` and `AOR_PERF_KNIGHTS`.
  - Signature test: `AOR_HPA=on|off` and the `<key>@hpa-off` fixture keys.
  - Task 2 reads `hpaShares`; Task 2's resume test reads the waiting members through `hpaPending`.

- [ ] **Step 1: Profile the click (not committed)**

Create `tests/tmp-click-profile.js`:
```js
// One-off profile of the 40-knight click (not committed): where orderMove spends its time, in the vm.
//   node tests/tmp-click-profile.js
const harness = require('./engine-harness');
for (const [n, np, type] of [[200, 3, 'coastal'], [200, 8, 'land'], [256, 3, 'coastal'], [256, 8, 'land']]) {
  const { run } = harness();
  console.log(run(`(() => {
    MAP_SIZES['x${n}'] = ${n};
    const spec = generateMapSpec({ size: 'x${n}', seed: 33, mapType: '${type}', numPlayers: ${np} }), civs = Object.keys(CIVS);
    createWorld(spec, { players: Array.from({ length: ${np} }, (_, i) => ({ name: 'P' + i, civ: i ? civs[(i * 5) % civs.length] : 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
    for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard'); W.spectate = true;
    // inclusive time per function, counted once per outermost call
    const T = {}, C = {}, stack = [], undo = [];
    const wrap = (name, key) => { const f = globalThis[name]; globalThis[name] = function () { const k = key.apply(null, arguments), t0 = performance.now(); stack.push(k); try { return f.apply(this, arguments); } finally { stack.pop(); if (!stack.includes(k)) T[k] = (T[k] || 0) + performance.now() - t0; C[k] = (C[k] || 0) + 1; } }; undo.push(() => { globalThis[name] = f; }); };
    wrap('findPath', (m, sx, sy, g, p, mx, cls) => cls ? 'route search' : mx === HPA.joinNodes ? 'join search (600 nodes)' : 'other search');
    wrap('lineClear', () => 'sight lines'); wrap('hpaJoin', () => 'member joins'); wrap('cmdFormation', () => 'formation');
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
    let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
    const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); }
    const t0 = performance.now(); orderMove(us, far.x + 2, far.y + 6); const click = performance.now() - t0;
    for (const f of undo) f();
    const parts = {}; for (const k of Object.keys(T)) parts[k] = +T[k].toFixed(1) + ' ms / ' + C[k];
    return JSON.stringify({ n: ${n}, players: ${np}, click: +click.toFixed(1), parts });
  })()`));
}
```

Run: `node tests/tmp-click-profile.js`
Expected (about 60 s; observed while planning on 91c0970: vm times vary with machine load, and the shares are what matter):
```
{"n":200,"players":3,"click":87.3,"parts":{"formation":"3.2 ms / 2","route search":"37.3 ms / 1","sight lines":"15.2 ms / 1863","join search (600 nodes)":"41.2 ms / 22","member joins":"44.9 ms / 40"}}
{"n":200,"players":8,"click":100.6,"parts":{"formation":"3.4 ms / 2","route search":"27.2 ms / 1","sight lines":"26.1 ms / 1761","member joins":"68.8 ms / 40","join search (600 nodes)":"63.4 ms / 36"}}
{"n":256,"players":3,"click":135.6,"parts":{"formation":"5.2 ms / 2","route search":"94.5 ms / 1","sight lines":"12.3 ms / 873","join search (600 nodes)":"28.9 ms / 10","member joins":"34.8 ms / 40"}}
{"n":256,"players":8,"click":105.3,"parts":{"formation":"3.2 ms / 2","route search":"87.2 ms / 1","sight lines":"4.5 ms / 540","join search (600 nodes)":"10 ms / 22","member joins":"13.9 ms / 40"}}
```
- The click is the group's route search plus the 40 joins, with the joins' 600-node searches the bigger part at 200.
- The same wrappers in the browser (medians of 5 fresh pages, under "Findings while planning") give the same split: up to 13.5 ms of route search and 9.8 ms of joins.

Then delete it: `rm tests/tmp-click-profile.js`, and `git status --short` must be empty.

- [ ] **Step 2: Write the failing group test**

The members now join on their own ticks, so every check that read the paths right after `orderMove` first plays the ticks until no member waits (`settle`).
- Part 1 checks that the click searches nothing, that the route runs alone in the next tick, and the members joined per tick.
- Part 6 counts the budget charged by the knights' own requests.
- Part 4 sums the mine click over 20 order times and asks for 9/10 of the per-unit count at slot, with every route still reaching its goal (see "Findings while planning").

In `tests/hpa-group.test.js`, replace:
```js
// Group orders (game/js/hpa.js with HPA.enabled): one route for the group, counted once against the path budget,
// every unit arriving at its formation slot; attack-move groups share one breach search.   node tests/hpa-group.test.js
```
with:
```js
// Group orders (game/js/hpa.js with HPA.enabled): one route for the group, nothing searched in the click (members make
// their requests on their own first ticks, spread by the path budget), every unit arriving at its formation slot;
// attack-move groups share one breach search.   node tests/hpa-group.test.js
```

In `tests/hpa-group.test.js`, replace:
```js
// 40 knights beside player 1's Town Center, the way the perf spec places them
function knights(a) { const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); } return us; }
`);
```
with:
```js
// 40 knights beside player 1's Town Center, the way the perf spec places them
function knights(a) { const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); } return us; }
// A group member makes its first path request on its own tick (hpaJoinDue): one still waiting has a 'move' order marked
// join, or an attack-move without a path. settle plays ticks until no unit of us waits; it returns the ticks played.
function waiting(u) { return !u.dead && !!u.order && (!!u.order.join || (u.order.t === 'attackmove' && !u.path)); }
function settle(us, max = 40) { let k = 0; while (k < max && us.some(waiting)) { worldTick(0.05); k++; } return k; }
`);
```

In `tests/hpa-group.test.js`, replace:
```js
  const us = knights(a), out = { straight: +fd.toFixed(0) };
  const s0 = Object.assign({}, HPA.stats); PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0;
  const fp0 = findPath, lc0 = lineClear; let joins = 0, sights = 0; findPath = function (m, sx, sy, g, p, mx) { if (mx === HPA.joinNodes) joins++; return fp0.apply(this, arguments); }; lineClear = function () { sights++; return lc0.apply(this, arguments); };
  let t0 = performance.now(); try { orderMove(us, far.x + 2, far.y + 6); } finally { findPath = fp0; lineClear = lc0; } out.groupMs = +(performance.now() - t0).toFixed(1); out.joinSearches = joins; out.sightLines = sights;
  out.searches = HPA.stats.queries - s0.queries; out.shared = HPA.stats.shared - s0.shared; out.groups = HPA.stats.groups - s0.groups; out.budget = PATHB.used;
  out.pathOk = us.filter(u => u.pathOk).length;
```
with:
```js
  const us = knights(a), out = { straight: +fd.toFixed(0) }, set = new Set(us);
  const s0 = Object.assign({}, HPA.stats);
  const fp0 = findPath, lc0 = lineClear, hr0 = hpaRoute, pt0 = pathTo, jd0 = hpaJoinDue;
  let joins = 0, sights = 0, routes = 0, work = 0, depth = 0;
  findPath = function (m, sx, sy, g, p, mx) { if (mx === HPA.joinNodes) joins++; return fp0.apply(this, arguments); };
  lineClear = function () { sights++; return lc0.apply(this, arguments); };
  hpaRoute = function () { routes++; return hr0.apply(this, arguments); };
  // the knights' own path work in the ticks after the click (the group route runs inside hpaJoinDue)
  const timed = f => function (u) { if (!set.has(u) || depth) return f.apply(this, arguments); depth++; const t = performance.now(); try { return f.apply(this, arguments); } finally { work += performance.now() - t; depth--; } };
  pathTo = timed(pt0); hpaJoinDue = timed(jd0);
  const perTick = [];
  let t0 = performance.now();
  try {
    orderMove(us, far.x + 2, far.y + 6); out.clickMs = +(performance.now() - t0).toFixed(1);
    out.clickSearches = HPA.stats.queries - s0.queries; out.clickPaths = us.filter(u => u.path).length;
    for (let k = 0; k < 40 && us.some(waiting); k++) { const had = us.filter(u => u.path).length; worldTick(0.05); perTick.push(us.filter(u => u.path).length - had); }
  } finally { findPath = fp0; lineClear = lc0; hpaRoute = hr0; pathTo = pt0; hpaJoinDue = jd0; }
  out.groupMs = +(out.clickMs + work).toFixed(1); out.joinSearches = joins; out.sightLines = sights; out.routes = routes; out.perTick = perTick;
  out.shared = HPA.stats.shared - s0.shared; out.groups = HPA.stats.groups - s0.groups;
  out.pathOk = us.filter(u => u.pathOk).length;
```

In `tests/hpa-group.test.js`, replace:
```js
ok('a 40-knight order across a 256 map runs one hierarchical search and charges the path budget once', K.searches === 1 && K.groups === 1 && K.shared === 40 && K.budget === 1 && K.pathOk === 40, K);
```
with:
```js
ok(`a 40-knight order across a 256 map searches nothing in the click; the next tick runs the group's one route search alone, and the 40 members join it over the ticks after, at most PATHB.perTick a tick (${K.perTick.join(' / ')})`,
  K.clickSearches === 0 && K.clickPaths === 0 && K.routes === 1 && K.groups === 1 && K.shared === 40 && K.perTick[0] === 0 && K.perTick.slice(1).every(c => c > 0 && c <= 24) && K.perTick.reduce((s, c) => s + c, 0) === 40 && K.pathOk === 40, K);
```

In `tests/hpa-group.test.js`, replace:
```js
// 6ef62aa: 49 ms against about 3200 ms (1.5%); a join that searched for nearly every member cost 175 ms (5.5%)
ok(`the order takes a small fraction of the old per-unit searches in the vm (${K.groupMs} ms against ${K.oldMs} ms: under 1/40), with at most 10 member join searches (${K.joinSearches}) and 1000 sight lines (${K.sightLines})`, K.groupMs * 40 < K.oldMs && K.joinSearches <= 10 && K.sightLines <= 1000, K);
```
with:
```js
// 6ef62aa: 49 ms against about 3200 ms (1.5%); a join that searched for nearly every member cost 175 ms (5.5%)
ok(`the order (click ${K.clickMs} ms, then the knights' own work in the next ticks) takes a small fraction of the old per-unit searches in the vm (${K.groupMs} ms against ${K.oldMs} ms: under 1/40), with at most 10 member join searches (${K.joinSearches}) and 1000 sight lines (${K.sightLines})`, K.groupMs * 40 < K.oldMs && K.clickMs * 4 < K.groupMs && K.joinSearches <= 10 && K.sightLines <= 1000, K);
```

In `tests/hpa-group.test.js`, replace:
```js
  const s0 = Object.assign({}, HPA.stats);
  orderMove(us, b.x + 2, b.y + 7);
  const out = { shared: HPA.stats.shared - s0.shared, searches: HPA.stats.queries - s0.queries, alone: !HPA_GROUP.get(straggler), again: us.filter(u => hpaShares(u)).length };
```
with:
```js
  const s0 = Object.assign({}, HPA.stats), hr0 = hpaRoute; let routes = 0; hpaRoute = function () { routes++; return hr0.apply(this, arguments); };
  orderMove(us, b.x + 2, b.y + 7);
  const strPath = !!straggler.path;   // the straggler is no member: its own search runs in the click
  try { settle(us); } finally { hpaRoute = hr0; }
  const out = { shared: HPA.stats.shared - s0.shared, routes, strPath, alone: !HPA_GROUP.get(straggler), again: us.filter(u => hpaShares(u)).length };
```

In `tests/hpa-group.test.js`, replace:
```js
ok('10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive', B.shared === 10 && B.searches === 2 && B.alone && B.again === 0 && B.repath && B.done === B.total, B);
```
with:
```js
ok('10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive', B.shared === 10 && B.routes === 1 && B.strPath && B.alone && B.again === 0 && B.repath && B.done === B.total, B);
```

In `tests/hpa-group.test.js`, replace:
```js
  if (!tgt) return { none: true };
  orderMove(us, tgt.x, tgt.y);
  const ends = new Set(us.map(u => u.path && u.path.length ? (u.path[u.path.length - 1].x | 0) + ',' + (u.path[u.path.length - 1].y | 0) : 'none'));
```
with:
```js
  if (!tgt) return { none: true };
  orderMove(us, tgt.x, tgt.y);
  const slots = new Set(us.map(u => u.order ? (u.order.x | 0) + ',' + (u.order.y | 0) : 'none'));
  settle(us);
  const ends = new Set(us.map(u => u.path && u.path.length ? (u.path[u.path.length - 1].x | 0) + ',' + (u.path[u.path.length - 1].y | 0) : 'none'));
```

In `tests/hpa-group.test.js`, replace:
```js
  const slots = new Set(us.map(u => u.order ? (u.order.x | 0) + ',' + (u.order.y | 0) : 'none'));
  return { on, pathOk: us.filter(u => u.pathOk).length, distinctEnds: ends.size, distinctSlots: slots.size };
```
with:
```js
  return { on, pathOk: us.filter(u => u.pathOk).length, distinctEnds: ends.size, distinctSlots: slots.size };
```

In `tests/hpa-group.test.js`, replace:
```js
  PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0;
  const fp = findPath; let full = 0, pocket = 0; findPath = function (m, sx, sy, g, p, mx, cls) { if (cls) full++; else if (mx === HPA.pocketNodes) pocket++; return fp.apply(this, arguments); };
  const s0 = HPA.stats.shared, t0 = performance.now();
  try { orderMove(us, best.x + 0.5, best.y + 0.5); } finally { findPath = fp; }
  const ms = performance.now() - t0; let h = 0; const str = JSON.stringify(us.map(u => u.path));
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return { on, dense: bn, ms: +ms.toFixed(1), full, pocket, budget: PATHB.used, shared: HPA.stats.shared - s0, pathOk: us.filter(u => u.pathOk).length, hash: h };
}`);
```
with:
```js
  // what the knights charge to the path budget: polish.js charges each pathTo request, hpaRoute the group's search
  // and hpaJoin each pocket search it runs
  // (only the knights' own requests and their group's route count: other units search in these ticks too)
  const set = new Set(us), fp = findPath, pt = pathTo, hr = hpaRoute; let full = 0, pocket = 0, budget = 0, routes = 0, inside = 0, routing = 0;
  findPath = function (m, sx, sy, g, p, mx, cls) { if (inside || routing) { if (cls) full++; else if (mx === HPA.pocketNodes) pocket++; } return fp.apply(this, arguments); };
  pathTo = function (u) { if (!set.has(u)) return pt.apply(this, arguments); pathBudgetTick(); const b = PATHB.used; inside++; try { return pt.apply(this, arguments); } finally { inside--; budget += PATHB.used - b; } };
  hpaRoute = function () { routes++; const b = PATHB.used; routing++; try { return hr.apply(this, arguments); } finally { routing--; if (!inside) budget += PATHB.used - b; } };
  const s0 = HPA.stats.shared, t0 = performance.now();
  try { orderMove(us, best.x + 0.5, best.y + 0.5); settle(us); } finally { findPath = fp; pathTo = pt; hpaRoute = hr; }
  const ms = performance.now() - t0; let h = 0; const str = JSON.stringify(us.map(u => u.path));
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return { on, dense: bn, ms: +ms.toFixed(1), full, pocket, routes, budget, shared: HPA.stats.shared - s0, pathOk: us.filter(u => u.pathOk).length, hash: h };
}`);
```

In `tests/hpa-group.test.js`, replace:
```js
const FO = JSON.parse(run(`JSON.stringify(forestTrial(false))`)), F1 = JSON.parse(run(`JSON.stringify(forestTrial(true))`)), F2 = JSON.parse(run(`JSON.stringify(forestTrial(true))`));
ok(`40 knights ordered into a forest: as many reach their slot as before (${F1.pathOk} against ${FO.pathOk}), at most 2 full searches (${F1.full}), the budget charged once per search actually run, full or pocket (${F1.budget} = ${F1.full} + ${F1.pocket}), under a tenth of the old time (${F1.ms} ms against ${FO.ms} ms), and the same paths on a repeat`,
  F1.dense >= 40 && F1.pathOk >= FO.pathOk && F1.full <= 2 && F1.budget === F1.full + F1.pocket && F1.ms * 10 < FO.ms && F1.hash === F2.hash, { FO, F1, F2 });
```
with:
```js
const FO = JSON.parse(run(`JSON.stringify(forestTrial(false))`)), F1 = JSON.parse(run(`JSON.stringify(forestTrial(true))`)), F2 = JSON.parse(run(`JSON.stringify(forestTrial(true))`));
ok(`40 knights ordered into a forest: as many reach their slot as before (${F1.pathOk} against ${FO.pathOk}), at most 2 full searches (${F1.full}), the budget charged for every member request, the group's route and every pocket search actually run (${F1.budget} = 40 + ${F1.routes} + ${F1.pocket}), under a tenth of the old time (${F1.ms} ms against ${FO.ms} ms), and the same paths on a repeat`,
  F1.dense >= 40 && F1.pathOk >= FO.pathOk && F1.full <= 2 && F1.routes === 1 && F1.budget === 40 + F1.routes + F1.pocket && F1.ms * 10 < FO.ms && F1.hash === F2.hash, { FO, F1, F2 });
```

In `tests/hpa-group.test.js`, replace:
```js
    const pos = us.map(u => ({ x: u.x, y: u.y }));
    orderMove(us, a.x + 1.5 + dist, a.y + 1.5 - dist * 0.4);
    let len = 0, back = 0;
```
with:
```js
    const pos = us.map(u => ({ x: u.x, y: u.y }));
    orderMove(us, a.x + 1.5 + dist, a.y + 1.5 - dist * 0.4);
    settle(us);   // a member stands still until it joins, so its path starts where it stood at the click
    let len = 0, back = 0;
```

In `tests/hpa-group.test.js`, replace:
```js
  try { hpaGroupOrder(us, () => ({ x: tgt.x, y: tgt.y }), tgt.x, tgt.y, "attackmove"); worldTick(0.05); } finally { findPath = fp; }
```
with:
```js
  try { hpaGroupOrder(us, () => ({ x: tgt.x, y: tgt.y }), tgt.x, tgt.y, "attackmove"); settle(us); } finally { findPath = fp; }
```

In `tests/hpa-group.test.js`, replace:
```js
// ---------- 4. a group order onto a tree, a mine or a building: the formation holds, as the old code did ----------
run(`
function blockedTrial(on, kind) {
  HPA.enabled = on; world(160, 7, 'land', 2);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const far = e => { const d = Math.hypot(e.x - a.x, e.y - a.y); return d > 30 && d < 70; };
  const r = kind === 'mine' ? W.list.find(e => e.kind === 'res' && (e.type === 'gold' || e.type === 'stone') && far(e))
    : kind === 'tree' ? W.list.find(e => e.kind === 'res' && (e.type === 'tree' || e.type === 'wood' || e.type === 'forest' || e.res === 'wood') && far(e))
    : (() => { const p = nearestLandTile((a.x + 30) | 0, (a.y + 8) | 0, true); return spawnBuilding('barracks', 1, p.x, p.y, true); })();   // our own, so nothing shoots at the group
  const tgt = { x: r.x + 0.5, y: r.y + 0.5 }, pass = passLand(1);
  orderMove(us, tgt.x, tgt.y);
  const slots = us.map(u => u.order ? { x: u.order.x, y: u.order.y } : null), pathOk = us.filter(u => u.pathOk).length;
  let t = 0; while (t < 200 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  const off = us.map((u, i) => slots[i] ? Math.hypot(u.x - slots[i].x, u.y - slots[i].y) : 99);
  return { kind, on, clickPassable: pass(W.map.idx(tgt.x | 0, tgt.y | 0)), pathOk, atSlot: off.filter(d => d < 1.5).length, worst: +Math.max(...off).toFixed(1) };
}`);
for (const kind of ['tree', 'mine', 'building']) {
  const o = JSON.parse(run(`JSON.stringify(blockedTrial(false, '${kind}'))`)), n = JSON.parse(run(`JSON.stringify(blockedTrial(true, '${kind}'))`));
  ok(`a group order clicked on a ${kind} keeps the formation (old ${o.pathOk} pathOk, ${o.atSlot} at slot; new ${n.pathOk}, ${n.atSlot})`, !n.clickPassable && n.pathOk >= Math.min(19, o.pathOk - 1) && n.atSlot >= Math.min(19, o.atSlot - 1) && n.atSlot >= o.atSlot - 1 && n.pathOk >= o.pathOk - 1, { o, n });
}
```
with:
```js
// ---------- 4. a group order onto a tree, a mine or a building: the formation holds, as the old code did ----------
// Two wolves stand by the mine, attack the arrivals, and the fight pulls units off their slots: where 20 units end up
// depends on the way each one came. Along the shared route alone all 20 came round the same side, past one wolf, and over
// 20 order times (0-19 ticks into the match) 104 of 400 ended at their slot; the per-unit searches with the hierarchy off,
// 244. With the wild animals removed, all 400 reach their slot either way. So the mine is summed over 20 order times, and
// the group must keep 9/10 of the per-unit count; its members also set off along the shared route within 3 ticks of the
// click, and take their own paths when their own searches have run (hpa.js hpaOwnDue).
run(`
function blockedTrial(on, kind, delay) {
  HPA.enabled = on; world(160, 7, 'land', 2);
  const a = W.list.filter(e => e.type === 'tc').find(t => t.owner === 1);
  const us = []; for (let k = 0; k < 20; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const far = e => { const d = Math.hypot(e.x - a.x, e.y - a.y); return d > 30 && d < 70; };
  const r = kind === 'mine' ? W.list.find(e => e.kind === 'res' && (e.type === 'gold' || e.type === 'stone') && far(e))
    : kind === 'tree' ? W.list.find(e => e.kind === 'res' && (e.type === 'tree' || e.type === 'wood' || e.type === 'forest' || e.res === 'wood') && far(e))
    : (() => { const p = nearestLandTile((a.x + 30) | 0, (a.y + 8) | 0, true); return spawnBuilding('barracks', 1, p.x, p.y, true); })();   // our own, so nothing shoots at the group
  for (let q = 0; q < delay; q++) worldTick(0.05);
  const tgt = { x: r.x + 0.5, y: r.y + 0.5 }, pass = passLand(1);
  orderMove(us, tgt.x, tgt.y);
  const slots = us.map(u => u.order ? { x: u.order.x, y: u.order.y } : null);
  const p0 = us.map(u => [u.x, u.y]), first = us.map(() => -1);   // the tick each unit first moves
  for (let k = 1; k <= 60 && first.some(f => f < 0); k++) { worldTick(0.05); us.forEach((u, i) => { if (first[i] < 0 && (u.x !== p0[i][0] || u.y !== p0[i][1])) first[i] = k; }); }
  settle(us); const pathOk = us.filter(u => u.pathOk).length;
  let t = 0; while (t < 200 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  const off = us.map((u, i) => slots[i] ? Math.hypot(u.x - slots[i].x, u.y - slots[i].y) : 99);
  return { kind, on, clickPassable: pass(W.map.idx(tgt.x | 0, tgt.y | 0)), pathOk, atSlot: off.filter(d => d < 1.5).length, worst: +Math.max(...off).toFixed(1), start: Math.max(...first) };
}`);
for (const [kind, times] of [['tree', 1], ['mine', 20], ['building', 1]]) {
  const sum = on => { const s = { pathOk: 0, atSlot: 0, start: 0, clickPassable: false, each: [] }; for (let d = 0; d < times; d++) { const r = JSON.parse(run(`JSON.stringify(blockedTrial(${on}, '${kind}', ${d}))`)); s.pathOk += r.pathOk; s.atSlot += r.atSlot; s.start = Math.max(s.start, r.start); s.each.push(r.atSlot); s.clickPassable = s.clickPassable || r.clickPassable; } return s; };
  const o = sum(false), n = sum(true), N = 20 * times;
  const atSlotOk = kind === 'mine' ? n.atSlot * 10 >= o.atSlot * 9 : n.atSlot >= Math.min(N - 1, o.atSlot - 1);
  ok(`a group order clicked on a ${kind} keeps the formation (${times} order time${times > 1 ? 's' : ''}: old ${o.pathOk} pathOk, ${o.atSlot} at slot; new ${n.pathOk}, ${n.atSlot}), and every unit moves within 3 ticks (${n.start})`, !n.clickPassable && n.pathOk >= Math.min(N - 1, o.pathOk - 1) && atSlotOk && n.start <= 3, { o, n });
}
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node tests/hpa-group.test.js`
Expected: exit status 1, before any summary:
```
ReferenceError: hpaRoute is not defined
```

- [ ] **Step 4: hpa.js: the route in a tick of its own, the joins on the members' ticks, a blocked click's members onto their own paths later**

In `game/js/hpa.js`, replace:
```js
  groupR: 12,             // units farther than this from their group's leader route on their own
  stats: { queries: 0, near: 0, routed: 0, unreachable: 0, fallback: 0, rebuilt: 0, groups: 0, shared: 0 },
```
with:
```js
  groupR: 12,             // units farther than this from their group's leader route on their own
  stats: { queries: 0, near: 0, routed: 0, unreachable: 0, fallback: 0, rebuilt: 0, groups: 0, shared: 0, waits: 0, own: 0, ownTaken: 0 },
```

In `game/js/hpa.js`, replace:
```js
// ---------- group orders ----------
// A group order computes one route. orderMove and the attack-move command hand their units to hpaGroupOrder: per
// movement class, the unit nearest the group's middle leads, and every unit of the leader's owner within HPA.groupR
// of it is a member. A member's first path request for the order (setOrder's moveToPoint, or attack-move's first
// tick) takes the group route, which the first such request computes once from the leader to the order point:
// a short leg onto the route, the shared waypoints, then the member's own slot. Every later request, including
// followPath's repath when the member is blocked, searches on its own. The one search counts against PATHB.
// cmdFindBreach keeps one breach answer per group and target (hpaGroupOf).
const HPA_GROUP = new WeakMap();   // unit -> { g, o, used }: its group and the order object it was given
```
with:
```js
// ---------- group orders ----------
// A group order computes one route. orderMove and the attack-move command hand their units to hpaGroupOrder: per
// movement class, the unit nearest the group's middle leads, and every unit of the leader's owner within HPA.groupR
// of it is a member. Nothing is searched in the click: a member makes its first path request on its own first tick
// (a 'move' order carries join: 1 until then; attack-move already waits for its first tick), and hpaJoinDue spreads
// those requests over the ticks through the path budget (polish.js PATHB). The first member to tick runs the
// group's one route search, from the leader to the order point, alone in that tick; from the next tick on the
// members join it, each charged to PATHB: a short leg onto the route, the shared waypoints, then the member's own
// slot. Every later request, including followPath's repath when the member is blocked, searches on its own.
// cmdFindBreach keeps one breach answer per group and target (hpaGroupOf). Group state is never saved: a member still
// waiting when the match is saved makes its own search after loading.
const HPA_GROUP = new WeakMap();   // unit -> { g, o, used }: its group and the order object it was given
```

In `game/js/hpa.js`, replace:
```js
  for (const u of units) {
    const o = orderFor(u), g = groupOf.get(u);
    if (g) HPA_GROUP.set(u, { g, o, used: false }); else HPA_GROUP.delete(u);
    setOrder(u, o);
  }
  HPA.stats.groups += new Set(groupOf.values()).size;
}
```
with:
```js
  for (const u of units) {
    const o = orderFor(u), g = groupOf.get(u);
    if (g) HPA_GROUP.set(u, { g, o, used: false }); else HPA_GROUP.delete(u);
    if (g && !g.solo && t === 'move') o.join = 1;   // its path is made on its first tick (hpaJoinDue), not in the click
    setOrder(u, o);
  }
  HPA.stats.groups += new Set(groupOf.values()).size;
}
// The group's one route, from the leader (or u, when the leader is gone) to the order point, charged to the path budget.
function hpaRoute(g, u) {
  const L = g.leader.dead || g.leader.dying || g.leader.inside ? u : g.leader;
  if (typeof PATHB === 'object') PATHB.used++;
  // aim at a passable tile: the click may be on a tree, a mine or a building, which the search cannot end on
  const lp = unitPass(L), tg = hpaSnap(W.map, g.x | 0, g.y | 0, lp);
  const e0 = PF.expanded, res = findPath(W.map, L.x | 0, L.y | 0, { x0: tg.x, y0: tg.y, x1: tg.x, y1: tg.y, r: 0 }, lp, undefined, g.cls);
  // blocked: the click was on a tile the leader cannot stand on (a mine, a tree, a building, water), so the route ends
  // beside it; size: the tiles the search expanded
  g.route = { pts: res.pts, ok: res.ok, sx: L.x | 0, sy: L.y | 0, blocked: tg.x !== (g.x | 0) || tg.y !== (g.y | 0), size: PF.expanded - e0 };
}
// Called on a unit's tick before its first path request for a 'move' (o.join) or 'attackmove' order: may it make the
// request now? A member still waiting for its group's route waits for the path budget. The first member to tick runs
// the group's route search and fills the rest of that tick's budget; after that, members join while the tick's
// budget lasts, and at least one member of each group joins every tick. Anything else (no group, a group without a
// shared route, an order loaded from a save) makes its request at once. Clears o.join when the answer is yes.
function hpaJoinDue(u, o) {
  const rec = HPA_GROUP.get(u);
  if (rec && !rec.used && !rec.g.solo && u.order === rec.o && typeof PATHB === 'object' && W) {
    const g = rec.g;
    pathBudgetTick();
    if (!g.route) { hpaRoute(g, u); PATHB.used = Math.max(PATHB.used, PATHB.perTick); g.joinTick = W.tick; HPA.stats.waits++; return false; }
    if (PATHB.used >= PATHB.perTick && g.joinTick === W.tick) { HPA.stats.waits++; return false; }
    g.joinTick = W.tick;
  }
  if (o.join) delete o.join;
  return true;
}
```

In `game/js/hpa.js`, replace:
```js
  rec.used = true;
  const g = rec.g;
  if (!g.route) {
    const L = g.leader.dead || g.leader.dying || g.leader.inside ? u : g.leader;
    if (typeof PATHB === 'object') PATHB.used++;   // the group's one search, charged to the per-tick path budget
    // aim at a passable tile: the click may be on a tree, a mine or a building, which the search cannot end on
    const lp = unitPass(L), tg = hpaSnap(W.map, g.x | 0, g.y | 0, lp);
    const res = findPath(W.map, L.x | 0, L.y | 0, { x0: tg.x, y0: tg.y, x1: tg.x, y1: tg.y, r: 0 }, lp, undefined, g.cls);
    g.route = { pts: res.pts, ok: res.ok, sx: L.x | 0, sy: L.y | 0 };
  }
  // a request that falls through to the member's own full search is charged to the path budget like any other
  const out = g.route.pts.length ? hpaJoin(u, g.route, rect) : null;
  if (out) HPA.stats.shared++; else if (typeof PATHB === 'object') PATHB.used++;
  return out;
}
```
with:
```js
  rec.used = true;
  const g = rec.g;
  if (!g.route) hpaRoute(g, u);   // a request that did not wait for hpaJoinDue (a rescue's moveToPoint, say)
  // the member's request itself is charged to the path budget by polish.js, whether it joins or searches on its own
  const out = g.route.pts.length ? hpaJoin(u, g.route, rect) : null;
  if (out) HPA.stats.shared++;
  if (out && g.route.blocked && g.route.ok) rec.own = true;   // and later its own search (hpaOwnDue)
  return out;
}
// A click on an obstacle (a mine, a tree, a building, water) that the route reaches. Along the shared route all the members
// came round one side of it, past whatever stood there (tests/hpa-group.test.js: the wolves by the mine), where per-unit
// searches came at it from their own sides. So the members set off along the shared route at once, and each one's own
// search, from where it then stands to its slot, runs later on its own tick, once no member of its group has joined for a
// tick: at least one per group a tick, more while the tick's budget can take searches the size of the group's route. Each is charged
// to PATHB 1 more for every HPA.ownUnit tiles it expands (tiles, not time: the simulation stays deterministic). The member
// takes the new path only when it is not longer than what is left of the shared one, plus HPA.ownSlack tiles, so a unit
// turns round only onto a way that is no longer from where it stands. Called on every tick of a 'move' or 'attackmove'.
function hpaOwnDue(u) {
  const rec = HPA_GROUP.get(u);
  if (!rec || !rec.own || u.order !== rec.o || !u.path || !u.goalRect || typeof PATHB !== 'object') return;
  const g = rec.g;
  pathBudgetTick();
  if (W.tick - g.joinTick < 2) return;   // members still join (one at least every tick while any waits): they go first
  if (g.ownTick === W.tick && PATHB.used + Math.floor(g.route.size / HPA.ownUnit) >= PATHB.perTick) return;
  g.ownTick = W.tick; rec.own = false;
  const r = u.goalRect, e0 = PF.expanded;
  const res = findPath(W.map, u.x | 0, u.y | 0, { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, r: u.goalR }, unitPass(u), undefined, hpaClassOf(u));
  PATHB.used += 1 + Math.floor((PF.expanded - e0) / HPA.ownUnit);
  HPA.stats.own++;
  if (!res.ok || !res.pts.length) return;
  const len = (pts, i) => { let l = 0, x = u.x, y = u.y; for (; i < pts.length; i++) { l += Math.hypot(pts[i].x - x, pts[i].y - y); x = pts[i].x; y = pts[i].y; } return l; };
  const end = u.path[u.path.length - 1], pts = res.pts.slice();
  pts[pts.length - 1] = { x: end.x, y: end.y };   // the exact slot point the shared path ended at (moveToPoint)
  if (len(pts, 0) > len(u.path, u.pi) + HPA.ownSlack) return;
  u.path = pts; u.pi = 0; HPA.stats.ownTaken++;
}
```

In `game/js/hpa.js`, replace:
```js
// Will u's next path request take its group's route? (polish.js does not charge such a request to PATHB.)
```
with:
```js
// Will u's next path request take its group's route?
```

In `game/js/hpa.js`, replace:
```js
  joinNodes: 600,         // a group member's own search onto the shared route
```
with:
```js
  joinNodes: 600,         // a group member's own search onto the shared route
  ownUnit: 400,           // a blocked click's member is charged 1 more to PATHB for every this many tiles its own search expands
  ownSlack: 2,             // ...and takes that search's path only when it is at most this many tiles longer than what is left of its own
```

In `game/js/hpa.js`, replace:
```js
    // the slot is out of sight of the route's last leg (the click was on an obstacle, say): a short search from the waypoint before
    // the order point to the slot, so the members spread to their own slots instead of all converging on the order point
```
with:
```js
    // the slot is out of sight of the route's last leg (the click was on an obstacle, say): a short search from the waypoint before
    // the order point to the slot, so the members spread to their own slots instead of all converging on the order point
    // (a blocked click's members also make their own searches later: hpaOwnDue)
```

map.js counts the tiles every search expands, for the blocked click's charge:
In `game/js/map.js`, replace:
```js
  return { chain, ok: found >= 0, budget, expanded };
}
```
with:
```js
  PF.expanded += expanded;   // every search's expanded tiles, counted (hpa.js charges a blocked click's own searches by them)
  return { chain, ok: found >= 0, budget, expanded };
}
```

In `game/js/map.js`, replace:
```js
const PF = { g: null, par: null, stamp: null, closed: null, cur: 1, n: 0, hf: new Float64Array(4096), hi: new Int32Array(4096) };
```
with:
```js
const PF = { g: null, par: null, stamp: null, closed: null, cur: 1, n: 0, hf: new Float64Array(4096), hi: new Int32Array(4096), expanded: 0 };
```

- [ ] **Step 5: hpa.js: graph repair between searches**

In `game/js/hpa.js`, replace:
```js
  G.dirty.fill(0); G.any = false;
```
with:
```js
  G.dirty.fill(0); G.any = false; G.rowsDue = true;   // hpaNodes cleared the rows of the touched clusters (hpaUpkeep refills them)
```

In `game/js/hpa.js`, replace:
```js
// A new or loaded match: build the land and naval graphs (and the mounted one on a map with trenches) and every intra edge now, so the first long order of the
// match does not pay for them. (Rebuilds after changes stay lazy. The editor's worlds never route, so they are skipped.)
```
with:
```js
// ---------- upkeep between searches ----------
// A search repairs what it meets: the dirty clusters (hpaRebuild) and every intra-edge row a rebuild cleared (hpaRow).
// After 30 s of AI play at 256 x 256 that was up to 660 rows, 24 ms in the browser, inside one group order's route
// search. So after every tick hpaUpkeep repairs a little: it rebuilds the dirty clusters every HPA.upkeepEvery ticks
// and refills at most HPA.upkeepRows missing rows. The graph is a pure function of the map, so every route stays
// exactly the same; only the moment the work is done moves.
function hpaUpkeep() {
  if (!HPA.enabled || !W || !W.map || HPA.map !== W.map || (W.settings && W.settings.editor)) return;
  let left = HPA.upkeepRows;
  for (const cls in HPA.g) {
    const G = HPA.g[cls];
    if (G.any) { if (W.tick % HPA.upkeepEvery) continue; hpaRebuild(G); }
    if (!G.rowsDue) continue;
    const cc = G.cl.length; let k = G.upk || 0, seen = 0;
    for (; seen < cc; seen++, k = (k + 1) % cc) {
      const c = G.cl[k];
      for (let a = 0; a < c.nodes.length && left > 0; a++) if (!c.row[a]) { hpaRow(G, k, a); left--; }
      if (!left) break;   // the budget ran out in cluster k: the next tick starts there
    }
    G.upk = k; if (seen >= cc) G.rowsDue = false;   // a whole pass found nothing left to fill
    if (!left) break;
  }
}
GameHooks.on('afterTick', hpaUpkeep);
// A new or loaded match: build the land and naval graphs (and the mounted one on a map with trenches) and every intra edge now, so the first long order of the
// match does not pay for them. (Later repairs are spread over the ticks by hpaUpkeep; the editor's worlds never route, so they are skipped.)
```

In `game/js/hpa.js`, replace:
```js
  groupR: 12,             // units farther than this from their group's leader route on their own
```
with:
```js
  groupR: 12,             // units farther than this from their group's leader route on their own
  upkeepEvery: 20,        // hpaUpkeep rebuilds dirty clusters every this many ticks...
  upkeepRows: 48,         // ...and refills at most this many intra-edge rows a tick
```

- [ ] **Step 6: world.js: a joining member's path waits for its tick**

In `game/js/world.js`, replace:
```js
  u.order = o; u.path = null; u.convT = 0; u.phase = 0;
  if (!o) { u.anim = 'idle'; return; }
  if (o.t === 'move') moveToPoint(u, o.x, o.y);
}
```
with:
```js
  u.order = o; u.path = null; u.convT = 0; u.phase = 0;
  if (!o) { u.anim = 'idle'; return; }
  if (o.t === 'move' && !o.join) moveToPoint(u, o.x, o.y);   // a group member's path waits for its first tick (hpa.js hpaJoinDue)
}
```

In `game/js/world.js`, replace:
```js
    case 'move': {
      if (followPath(u, dt)) setOrder(u, o.then || null);
      break;
    }
    case 'attackmove': {
      u.scanT = (u.scanT || 0) - dt;
      if (u.scanT <= 0) { u.scanT = 0.5; const t = findTargetFor(u, d.los + 1); if (t) { u.order = { t: 'attack', id: t.id, then: { t: 'attackmove', x: o.x, y: o.y } }; u.path = null; break; } }
      if (!u.path) moveToPoint(u, o.x, o.y);
```
with:
```js
    case 'move': {
      if (o.join) { if (!hpaJoinDue(u, o)) { u.anim = 'idle'; break; } if (!u.path) moveToPoint(u, o.x, o.y); }
      hpaOwnDue(u);   // a blocked click's member: its own path, once its search has run (hpa.js)
      if (followPath(u, dt)) setOrder(u, o.then || null);
      break;
    }
    case 'attackmove': {
      u.scanT = (u.scanT || 0) - dt;
      if (u.scanT <= 0) { u.scanT = 0.5; const t = findTargetFor(u, d.los + 1); if (t) { u.order = { t: 'attack', id: t.id, then: { t: 'attackmove', x: o.x, y: o.y } }; u.path = null; break; } }
      if (!u.path) { if (!hpaJoinDue(u, o)) { u.anim = 'idle'; break; } moveToPoint(u, o.x, o.y); }
      hpaOwnDue(u);
```

- [ ] **Step 7: polish.js: every request is charged, a member's join included**

In `game/js/polish.js`, replace:
```js
const PATHB = { perTick: 24, tick: -1, used: 0, deferred: 0, world: null };
function pathBudgetSameGoal(a, b) {
  return !!a && ['x0', 'y0', 'x1', 'y1'].every(k => a[k] === b[k]);
}
if (typeof pathTo === 'function') {
  const _pt = pathTo;
  pathTo = function (u, rect, r) {
    if (W && (W !== PATHB.world || W.tick !== PATHB.tick)) { PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0; }
    // a group member taking its group's route (hpa.js) is not charged: the group's one search is, when it runs
    const shared = typeof hpaShares === 'function' && hpaShares(u);
    if (!shared && PATHB.used >= PATHB.perTick && u.path && u.pi < u.path.length && u.goalRect &&
        pathBudgetSameGoal(u.goalRect, rect) && u.goalR === r &&
        u._pathMapVersion === W.map.version) {
      PATHB.deferred++;
      u.repathT = 0.1 + simRandomSafe() * 0.3;
      return u.pathOk;
    }
    if (!shared) PATHB.used++;
```
with:
```js
// Group orders (hpa.js) charge their route search and every member's join here too, and hpaJoinDue holds members back
// while the tick's budget is spent.
const PATHB = { perTick: 24, tick: -1, used: 0, deferred: 0, world: null };
function pathBudgetSameGoal(a, b) {
  return !!a && ['x0', 'y0', 'x1', 'y1'].every(k => a[k] === b[k]);
}
// Starts a new count when the world or the tick changed.
function pathBudgetTick() { if (W && (W !== PATHB.world || W.tick !== PATHB.tick)) { PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0; } }
if (typeof pathTo === 'function') {
  const _pt = pathTo;
  pathTo = function (u, rect, r) {
    pathBudgetTick();
    if (PATHB.used >= PATHB.perTick && u.path && u.pi < u.path.length && u.goalRect &&
        pathBudgetSameGoal(u.goalRect, rect) && u.goalR === r &&
        u._pathMapVersion === W.map.version) {
      PATHB.deferred++;
      u.repathT = 0.1 + simRandomSafe() * 0.3;
      return u.pathOk;
    }
    PATHB.used++;
```

- [ ] **Step 8: Run the group test**

Run: `node tests/hpa-group.test.js`
Expected (about 2.5 minutes; observed while planning, the long JSON cut):
```
PASS a 40-knight order across a 256 map searches nothing in the click; the next tick runs the group's one route search alone, and the 40 members join it over the ticks after, at most PATHB.perTick a tick (0 / 24 / 16)  {"straight":160,"clickMs":4.6,"clickSearches":0,"clickPaths":0,"groupMs":57.1,"joinSearches":6,"sightLines":572,"routes":1,"perTick":[0,24,16],"shared":40,"groups":1,"pathOk":40,"seconds":107,"done":40,"atSlot":29,"worstSlot":3.3,"within":40,"oldMs":5334}
PASS every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (107 game seconds for 160 tiles)  {...}
PASS the order (click 4.6 ms, then the knights' own work in the next ticks) takes a small fraction of the old per-unit searches in the vm (57.1 ms against 5334 ms: under 1/40), with at most 10 member join searches (6) and 1000 sight lines (572)  {...}
PASS 10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive  {"shared":10,"routes":1,"strPath":true,"alone":true,"again":0,"repath":true,"done":11,"total":11}
PASS a grouped attack-move blocked by walls makes one breach search for the group, breaches and takes the camp  {"breached":8,"firstBreachSearches":1,"opened":true,"campDown":true,"t":41}
PASS a group order clicked on a tree keeps the formation (1 order time: old 20 pathOk, 19 at slot; new 20, 20), and every unit moves within 3 ticks (2)  {...}
PASS a group order clicked on a mine keeps the formation (20 order times: old 400 pathOk, 244 at slot; new 400, 232), and every unit moves within 3 ticks (2)  {"o":{"pathOk":400,"atSlot":244,"start":1,"clickPassable":false,"each":[10,12,13,13,16,11,12,12,12,11,10,11,12,11,14,13,15,12,12,12]},"n":{"pathOk":400,"atSlot":232,"start":2,"clickPassable":false,"each":[13,12,10,12,11,13,11,12,12,12,11,12,11,11,13,14,10,12,9,11]}}
PASS a group order clicked on a building keeps the formation (1 order time: old 20 pathOk, 20 at slot; new 20, 20), and every unit moves within 3 ticks (1)  {...}
PASS a group order onto an unreachable island gives up as before: nobody pathOk, as many distinct path ends as the old code (old 1, new 1)  {...}
PASS 40 knights ordered into a forest: as many reach their slot as before (32 against 32), at most 2 full searches (1), the budget charged for every member request, the group's route and every pocket search actually run (56 = 40 + 1 + 15), under a tenth of the old time (66.7 ms against 2324.1 ms), and the same paths on a repeat  {...}
PASS spread groups (6 orders of 14-40 tiles, 16 spearmen): the shared route plans at most 1.05x the per-unit paths (2790 against 2749), nobody's first leg walks away from the slot (0, per-unit 0), and the last arrival is within 1.05x (110.2 s against 110.3 s)  {...}
PASS block groups (6 orders of 14-40 tiles, 16 spearmen): the shared route plans at most 1.05x the per-unit paths (2098 against 2082), nobody's first leg walks away from the slot (0, per-unit 0), and the last arrival is within 1.05x (76.9 s against 77 s)  {...}
PASS 20 units attack-moving onto unreachable land run 1 pocket search (1), not 20; all of them walk (the charge to the path budget is checked by the forest order above)  {"pocket":1,"groups":1,"gotPath":20}
13 passed, 0 failed
```
PASS a 40-knight order across a 256 map searches nothing in the click; the next tick runs the group's one route search alone, and the 40 members join it over the ticks after, at most PATHB.perTick a tick (0 / 24 / 16)  {"straight":160,"clickMs":4.1,"clickSearches":0,"clickPaths":0,"groupMs":55.7,"joinSearches":6,"sightLines":572,"routes":1,"perTick":[0,24,16],"shared":40,"groups":1,"pathOk":40,"seconds":107,"done":40,"atSlot":29,"worstSlot":3.3,"within":40,"oldMs":3227.5}
PASS every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (107 game seconds for 160 tiles)  {...}
PASS the order (click 4.1 ms, then the knights' own work in the next ticks) takes a small fraction of the old per-unit searches in the vm (55.7 ms against 3227.5 ms: under 1/40), with at most 10 member join searches (6) and 1000 sight lines (572)  {...}
PASS 10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive  {"shared":10,"routes":1,"strPath":true,"alone":true,"again":0,"repath":true,"done":11,"total":11}
PASS a grouped attack-move blocked by walls makes one breach search for the group, breaches and takes the camp  {"breached":8,"firstBreachSearches":1,"opened":true,"campDown":true,"t":41}
PASS a group order clicked on a tree keeps the formation (1 order time: old 20 pathOk, 19 at slot; new 20, 20)  {...}
PASS a group order clicked on a mine keeps the formation (6 order times: old 120 pathOk, 75 at slot; new 120, 28)  {"o":{"pathOk":120,"atSlot":75,"clickPassable":false,"each":[10,12,13,13,16,11]},"n":{"pathOk":120,"atSlot":28,"clickPassable":false,"each":[4,5,6,2,3,8]}}
PASS a group order clicked on a building keeps the formation (1 order time: old 20 pathOk, 20 at slot; new 20, 20)  {...}
PASS a group order onto an unreachable island gives up as before: nobody pathOk, as many distinct path ends as the old code (old 1, new 1)  {...}
PASS 40 knights ordered into a forest: as many reach their slot as before (32 against 32), at most 2 full searches (1), the budget charged for every member request, the group's route and every pocket search actually run (56 = 40 + 1 + 15), under a tenth of the old time (62.5 ms against 2303.4 ms), and the same paths on a repeat  {...}
PASS spread groups (6 orders of 14-40 tiles, 16 spearmen): the shared route plans at most 1.05x the per-unit paths (2790 against 2749), nobody's first leg walks away from the slot (0, per-unit 0), and the last arrival is within 1.05x (113.1 s against 110.3 s)  {...}
PASS block groups (6 orders of 14-40 tiles, 16 spearmen): the shared route plans at most 1.05x the per-unit paths (2098 against 2082), nobody's first leg walks away from the slot (0, per-unit 0), and the last arrival is within 1.05x (77.6 s against 77 s)  {...}
PASS 20 units attack-moving onto unreachable land run 1 pocket search (1), not 20; all of them walk (the charge to the path budget is checked by the forest order above)  {"pocket":1,"groups":1,"gotPath":20}
13 passed, 0 failed
```
- The spread and block arms (phase 3's path-quality regression check) plan the same paths as at 91c0970, 2790 / 0 and 2098 / 0: a member joins from where it stood at the click, and the planned length is counted at the join. Two of their six orders are on trees, where the members later take their own paths, so the last arrivals come at 110.2 s and 76.9 s (at 91c0970: 113.1 and 77.6; per-unit: 110.3 and 77).
- The mine: 232 of 400 at slot against 244 per unit, every unit moving within 2 ticks; see "Findings while planning".

- [ ] **Step 9: The signature test plays both modes**

In `tests/sim-signature.test.js`, replace:
```js
// Golden simulation signatures: fixed-seed AI-vs-AI matches must replay to exactly the same state.
// The entity index (game/js/index.js) may make queries faster but must not change any outcome, so these hashes were
// first recorded on the code before the index existed and held unchanged through the index tasks; commit f012cc0
// re-recorded them for the deliberate AI stagger, and phase 3 for hierarchical routes and group orders (AOR_HPA=off
// plays with the hierarchy switched off: the routes before phase 3, whose hashes are in git at ed46ba5). A change that
// is meant to alter the simulation re-records them deliberately, and its commit says why:
//   AOR_RECORD=1 node tests/sim-signature.test.js
```
with:
```js
// Golden simulation signatures: fixed-seed AI-vs-AI matches must replay to exactly the same state.
// The entity index (game/js/index.js) may make queries faster but must not change any outcome, so these hashes were
// first recorded on the code before the index existed and held unchanged through the index tasks; commit f012cc0
// re-recorded them for the deliberate AI stagger, and phase 3 for hierarchical routes and group orders.
// Every scenario plays twice: with the hierarchy on (the game's default; key = the scenario) and with it switched off
// (key + '@hpa-off': the routes before phase 3). AOR_HPA=on or AOR_HPA=off plays only that mode. A change that is
// meant to alter the simulation re-records them deliberately, and its commit says why:
//   AOR_RECORD=1 node tests/sim-signature.test.js
```

In `tests/sim-signature.test.js`, replace:
```js
function play(s) {
  const { run, warnings } = harness();
  if (process.env.AOR_HPA === 'off') run('HPA.enabled = false');
```
with:
```js
const MODES = process.env.AOR_HPA === 'off' ? ['off'] : process.env.AOR_HPA === 'on' ? ['on'] : ['on', 'off'];
function play(s, mode) {
  const { run, warnings } = harness();
  if (mode === 'off') run('HPA.enabled = false');
```

In `tests/sim-signature.test.js`, replace:
```js
const record = process.env.AOR_RECORD === '1';
const golden = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : {};
const fresh = {};
for (const s of SCENARIOS) {
  const r = play(s); fresh[s.key] = r.hash;
  if (record) { console.log(`recorded ${s.key} ${r.hash}`, JSON.stringify(r)); continue; }
  ok(`${s.key}: ${s.minutes} game minutes replay to the recorded state`, golden[s.key] === r.hash && r.aiErrors === 0, { expected: golden[s.key], got: r.hash, t: r.t, entities: r.entities, aiErrors: r.aiErrors });
}
if (record) { fs.mkdirSync(path.dirname(FIXTURE), { recursive: true }); fs.writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n'); ok('signatures recorded', true, fresh); }
```
with:
```js
const record = process.env.AOR_RECORD === '1';
const golden = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : {};
const fresh = Object.assign({}, golden);   // recording one mode keeps the other mode's hashes
for (const mode of MODES) for (const s of SCENARIOS) {
  const key = mode === 'on' ? s.key : s.key + '@hpa-off', r = play(s, mode); fresh[key] = r.hash;
  if (record) { console.log(`recorded ${key} ${r.hash}`, JSON.stringify(r)); continue; }
  ok(`${key}: ${s.minutes} game minutes replay to the recorded state`, golden[key] === r.hash && r.aiErrors === 0, { expected: golden[key], got: r.hash, t: r.t, entities: r.entities, aiErrors: r.aiErrors });
}
if (record) { fs.mkdirSync(path.dirname(FIXTURE), { recursive: true }); fs.writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n'); ok('signatures recorded', true, fresh); }
```

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 2 failed`.
- The switch-on hashes are unchanged: `9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b` and `824240c4ef2a39a77bd37ef06047d74fb74c7cd2`.
- The two `@hpa-off` keys fail only because they are not recorded yet: `"got":"f620967b4318fae0eb0477b6cfc44259a3e3ec66"` and `"got":"f3599320291fc01383e6d58f4c82a3230c7b398b"`.

Run: `AOR_RECORD=1 AOR_HPA=off node tests/sim-signature.test.js`
Expected: `recorded tiny-land-2p-feudal@hpa-off f620967b4318fae0eb0477b6cfc44259a3e3ec66`, `recorded small-coastal-3p-castle@hpa-off f3599320291fc01383e6d58f4c82a3230c7b398b`, then `1 passed, 0 failed`. The two switch-on keys stay as they were.
Run: `node tests/sim-signature.test.js`
Expected: `4 passed, 0 failed` (about 60 s).

- [ ] **Step 10: The neighbouring suites**

Run each of `node tests/movement.test.js`, `command`, `tactics`, `engineering`, `actors`, `bridges-tunnels`, `polish`, `hpa-route` and `hpa-graph`.
Expected (observed while planning): `9 passed`, `25 passed`, `17 passed`, `5 passed`, `5 passed`, `11 passed`, `6 passed`, `11 passed` and `4 passed`, each with `0 failed`.
Run: `npm run test:syntax`
Expected: `96 scripts passed syntax checks.`

- [ ] **Step 11: The perf spec measures the order's own work per frame, at the start and after 30 s**

The old column timed the click alone, which would now be about 1 ms. The new measurement times the click, then each tick's path work of the 40 knights until every knight has a path, and reports the worst of those frames.
- It orders at the start of the match and again after 600 ticks (30 game seconds) of AI play, in 5 fresh pages each per size and player count.
- The row shows the medians, start first.
- The JSON also keeps each page's whole-tick times (`full`), which include the AI players' own work in those ticks.

In `tests/browser/maps-perf.spec.js`, replace:
```js
//   AOR_PERF_TICKS  timed simulation ticks per match, default 3600 (3 game minutes, as in the evaluation)
```
with:
```js
//   AOR_PERF_TICKS  timed simulation ticks per match, default 3600 (3 game minutes, as in the evaluation)
//   AOR_PERF_KNIGHTS  fresh pages per size, player count and moment for the 40-knight order, default 5 (the row shows
//                   the median)
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
const TICKS = +(process.env.AOR_PERF_TICKS || 3600);
```
with:
```js
const TICKS = +(process.env.AOR_PERF_TICKS || 3600);
const KNIGHTS = +(process.env.AOR_PERF_KNIGHTS || 5);
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
- **40 knights**: one \`orderMove\` of 40 knights from player 1's Town Center to the farthest Town Center, made
  before the timed ticks of the 3- and the 8-player match, in ms, with the routes that reached their goal.
```
with:
```js
- **40 knights**: one \`orderMove\` of 40 knights from player 1's Town Center to the farthest Town Center in the 3- and
  the 8-player match, in ms: the worst frame of the order's own work (the click, then each following tick's path work
  of the knights until every knight has a path), the median of AOR_PERF_KNIGHTS fresh pages (default 5). Ordered at
  the start of the match, then after 30 game seconds of AI play; with the fewest routes that reached their goal.
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
    const res = { entities0: W.list.length };
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
    let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
    const us = [];
    for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); }
    let b = performance.now(); orderMove(us, far.x + 2, far.y + 6);
    res.group40 = { ms: +(performance.now() - b).toFixed(0), ok: us.filter(u => u.pathOk).length, straight: +fd.toFixed(0) };
    for (const u of us) removeEnt(u);
    for (let i = 0; i < 600; i++) worldTick(0.05);
```
with:
```js
    const res = { entities0: W.list.length };
    for (let i = 0; i < 600; i++) worldTick(0.05);
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
    const vv = W.list.find(e => e.type === 'villager' && !e.dying);
    b = performance.now(); for (let i = 0; i < 100; i++) findNearestRes(vv, ['tree'], vv.x, vv.y, 30);
```
with:
```js
    const vv = W.list.find(e => e.type === 'villager' && !e.dying);
    let b = performance.now(); for (let i = 0; i < 100; i++) findNearestRes(vv, ['tree'], vv.x, vv.y, 30);
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
// 2D rendering (evaluation T1): steady frame cost, live fps, then a full pan and the terrain-cache size.
```
with:
```js
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
// 2D rendering (evaluation T1): steady frame cost, live fps, then a full pan and the terrain-cache size.
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
    await openGame(page); await prepareSize(page, n);
    rec.sim8 = await measureSim(page, n, 8, 'land');
```
with:
```js
    await openGame(page); await prepareSize(page, n);
    rec.sim8 = await measureSim(page, n, 8, 'land');
    rec.knights3 = await measureKnightRuns(page, n, 3, 'coastal');
    rec.knights8 = await measureKnightRuns(page, n, 8, 'land');
    rec.knights3w = await measureKnightRuns(page, n, 3, 'coastal', 600);
    rec.knights8w = await measureKnightRuns(page, n, 8, 'land', 600);
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.sim3.group40.ms} / ${r.sim8.group40.ms} (${r.sim3.group40.ok}/40, ${r.sim8.group40.ok}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}) | ${r.render2d.pan.cacheMB} |`);
```
with:
```js
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.knights3.ms} / ${r.knights8.ms}; ${r.knights3w.ms} / ${r.knights8w.ms} (${Math.min(r.knights3.ok, r.knights3w.ok)}/40, ${Math.min(r.knights8.ok, r.knights8w.ok)}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}) | ${r.render2d.pan.cacheMB} |`);
```

- [ ] **Step 12: The C1 perf rows and a same-session control of 91c0970**

Close other heavy programs first. The control runs the new spec on the phase 3 code, from a clone next to the repository. From the repository root:
```bash
git clone --shared G:/GitHub/age-of-realms-mod ../aor-control && git -C ../aor-control checkout --detach 91c0970
cp tests/browser/maps-perf.spec.js ../aor-control/tests/browser/maps-perf.spec.js
```
The control clone has no `node_modules`. Run its spec with a temporary config next to it, `../aor-control/perf.local.config.js`:
```js
const { defineConfig } = require('G:/GitHub/age-of-realms-mod/node_modules/@playwright/test');
module.exports = defineConfig({
  testDir: __dirname + '/tests/browser', testMatch: 'maps-perf.spec.js', timeout: 30 * 60 * 1000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8765', viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', launchOptions: { args: ['--enable-precise-memory-info'] } },
  projects: [{ name: 'gpu', use: { channel: 'chromium' } }],
  webServer: { command: `node "${__dirname}/tests/serve.js"`, url: 'http://127.0.0.1:8765', reuseExistingServer: false, timeout: 10000 },
});
```
```bash
cd ../aor-control && AOR_PERF_SIZES=200,256 AOR_PERF_LABEL="phase 3 control (91c0970)" NODE_PATH=G:/GitHub/age-of-realms-mod/node_modules PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright node G:/GitHub/age-of-realms-mod/node_modules/@playwright/test/cli.js test --config perf.local.config.js --project=gpu; cd -
AOR_PERF_SIZES=200,256 AOR_PERF_LABEL="phase 4 C1 lazy joins" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf
```
Expected: `2 passed` for each. Then:
- copy the two rows the control appended to `../aor-control/docs/maps-perf-baseline.md`;
- move them and the two new rows to just after the last "phase 3 final (median of 5)" row in `docs/maps-perf-baseline.md`, before `### Reading these rows`;
- delete the control clone.

Observed while planning, in one session. The figures are medians of 5 pages, 3 players / 8 players, in ms, and every page had 40/40 routes. The full rows also carry the other columns.

| n | when ordered | control 91c0970 (the click) | C1: worst frame of the order's own work | C1: the whole route tick (JSON `full`) |
|---|---|---|---|---|
| 200 | match start | 12.8 / 9.7 | 5.5 / 5.8 | 8.5 / 12.5 |
| 200 | after 30 s | 15.3 / 7.7 | 5.4 / 2.3 | 6.1 / 3.4 |
| 256 | match start | 11.5 / 11.2 | 8.3 / 8.5 | 13.2 / 16.2 |
| 256 | after 30 s | 22.9 / 23.1 | 9.8 / 8.2 | 10.9 / 9.6 |

- **Acceptance:** every median of the order's own work ≤ 16 ms, at 200 and 256, with 3 and 8 players, at both moments; and 40/40 routes in every page.
- **The whole route tick at the start of a match** also holds the AI players' own first ticks: they cost 3–8 ms more and have nothing to do with the order. The control's click frame holds that tick too, on top of its 10–13 ms click.
- **After 30 s**, with `hpaUpkeep`, the whole tick stays ≤ 16 ms. Without upkeep, the route alone took up to 34 ms at 256 with 8 players.
- Add this bullet at the end of `### Reading these rows`:
```markdown
- From phase 4 on, the 40-knight column is the worst frame of the order's own work: the click, then each following tick's path work of the knights until every knight has a path (members join their group's route on their own ticks since phase 4 C1). The cell is `start; after 30 s`: the order is given at the start of the match and again after 600 ticks of AI play, each the median of 5 fresh pages (`AOR_PERF_KNIGHTS`), with the fewest routes that reached their goal in those pages. `test-results/maps-perf.json` also keeps each page's whole-tick times (`full`), which include the AI players' own start-of-match work. The "phase 3 control (91c0970)" rows run this measurement on the phase 3 code, whose click does all the work.
```

- [ ] **Step 13: Commit**

```bash
git add game/js/hpa.js game/js/map.js game/js/world.js game/js/polish.js tests/hpa-group.test.js tests/sim-signature.test.js tests/fixtures/sim-signatures.json tests/browser/maps-perf.spec.js docs/maps-perf-baseline.md
git commit -m "perf(path): group members join on their own ticks; graph repair leaves the searches

A 40-knight order spent 8-23 ms in the click: the group's one route
search plus 40 member joins, and after a while of play the search also
refilled hundreds of intra-edge rows that graph repairs had cleared. Now
the click only gives the orders: the first member to tick runs the route
search alone in that tick, and the members join it over the next ticks,
each charged to PATHB (24 a tick, at least one per group). hpaUpkeep
repairs the graph between searches (dirty clusters every 20 ticks, 48
rows a tick); routes are unchanged. The worst frame of the order's own
work is now at most 9.8 ms (medians of 5 pages, 200 and 256, 3 and 8
players, at the start and after 30 s), against up to 23.1 ms. The perf
spec measures that worst frame at both moments.
On a click on an obstacle (a mine, a tree, a building) that the route
reaches, the members set off along the shared route at once, and each
one's own search runs later on its own tick, charged to PATHB by the
tiles it expands; a member takes its own path when it is no longer than
the rest of the shared one. Along the shared route alone they all came
round one side together, and round a gold mine with wolves 104 of 400
ended at their slot against 244 with per-unit searches; now 232. The sim
signatures are
unchanged (the recorded matches send no far shared group); the test now
also plays and records the hierarchy-off mode, which replays f620967b
and f3599320.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task C2: The crowd-movement livelock

The phase 3 reviewer found that with `HPA.joinReach` between 24 and 44, two spearmen of the 10-spearman group test jittered for ever. 48 masked it. It reproduces exactly:

**The reproducer.**
- **Setup:** seed 7, a 160 × 160 land map, 2 players, `fog: 'none'`, `startRes: 'high'`, `startAge: 2`.
- **Units:** 10 spearmen on the tiles `nearestLandTile(tc.x + 5 + k % 5, tc.y + 6 + (k / 5 | 0))` of player 1's Town Center, and a straggler at `(tc.x − 30, tc.y + 20)`.
- **Order:** `orderMove` to player 2's Town Center + (2, 7), with `HPA.joinReach = 28`. Members of that order are left on the map after 300 game seconds: 1, 5, 1, 1, 1 and 0 with `joinReach` 24, 28, 32, 36, 40 and 44.
- **What they do:** with 28, five spearmen stand on one spot, `(116.5, 62.86)`, for good. Each tick they alternate between `y = 62.863` and `y = 62.943`, with `stuck` alternating 0.30 / 0.25, `mvFails` 0 and no repath. The rescue in movement.js never fires, because it is counted in `mvFails`, which only a repath raises.

**The root cause is in followPath (movement.js), not in the path.**
- The shared route holds a leg from (117.5, 61.5) to (116.5, 64.5). Its straight line passes exactly through the corner of tile (116, 62) at elevation 1, (116, 63) at 3 (a cliff) and (117, 63) at 2.
- `lineClear` samples that line at rounded tiles and goes (117, 62) → (117, 63) → (116, 63), all allowed. The continuous move cuts the corner.
- The unit is refused the cliff step, slides along x into (116, 62), and from there the straight line to the waypoint runs into the cliff. Each tick it does two things in turn:
  - the direct step and the slide are refused, so it drifts back toward its tile's centre: no progress, `stuck += dt`;
  - the next direct step, still inside the tile, gets nearer the waypoint than the drifted position: "progress", `stuck -= dt`.
- So `stuck` never reaches `MOVE.repathAfter` (0.5 s): no repath, and the rescue, counted in repaths, never comes.
- The minimal case is one spearman with that single leg, from (117.5, 61.5) or (116.5, 62.5): it never arrives, with 0 repaths.
- **Per-unit paths hit it too.** 720 random moves of 8–38 tiles on twelve 160 maps (land and alpine, seeds 1–6) left 14 units walking on the spot for good with the hierarchy off, and 15 with it on. Each stayed within 0.3 tiles for 5 s with no new path.

**The fix.**
- After a tick without progress, the next ticks count as progress only once the unit is nearer the waypoint than its best distance before that tick: `u.mvBest`, kept for the waypoint `u.mvAt`. A drift-and-return cycle then adds up as stuck time, the unit repaths after 0.5 s from the tile it really stands on, and it walks round the corner.
- With the fix, the reproducer arrives for every `joinReach`, the minimal case arrives in 2.4–3 s with one repath, and the 720 moves leave none walking on the spot (`under`: units still under way after 60 s, which are slowed, not stuck).
- **Signatures.** The fix changes the recorded small coastal match (units livelocked in it). It sits behind `MOVE.mark` (default true), and the signature test's off mode turns it off with `HPA.enabled`, so the off hashes stay `f620967b…` and `f3599320…`.
  - The switch-on `small-coastal-3p-castle` is re-recorded once, here: `ed4b527667fe3f8f01660cf4a7aa419a774cf396`.
  - `tiny-land-2p-feudal` stays `9fda2e5c…`.
- `u.mvAt` refers to a waypoint object of `u.path`. A save keeps the reference, so a resumed match counts the same (the resume test of Task 2 checks this).

**Files:**
- Create: `tests/movement-livelock.test.js`
- Modify: `game/js/movement.js` (`MOVE`, and the progress check in `followPath`), `tests/sim-signature.test.js` (the off mode also sets `MOVE.mark = false`)
- Re-record: `tests/fixtures/sim-signatures.json` (switch-on keys only)

**Interfaces:**
- Consumes: `followPath` (movement.js), `pathTo`, `HPA.joinReach`, `orderMove`.
- Produces:
  - `MOVE.mark` (boolean, default true);
  - the unit fields `mvBest` and `mvAt`;
  - the off mode of the signature test is now "hierarchy and movement mark off".

- [ ] **Step 1: Write the failing test**

Create `tests/movement-livelock.test.js`:
```js
// The movement livelock (game/js/movement.js): a unit whose straight leg to its next waypoint crosses a cliff corner
// is refused the step, drifts back to its tile centre, steps forward again, and so on. The forward tick counted as
// progress, so the stuck time went +dt, -dt, +dt and never reached MOVE.repathAfter: no repath, no rescue, the unit
// walked on the spot for good. Seen first as 2 spearmen jittering in the 10-spearman group order with HPA.joinReach
// 24-44 (tests/hpa-group.test.js part 2), but it is not a group-route problem: single units with their own paths, the
// hierarchy on or off, hit it on about 2% of moves on cliffy maps.   node tests/movement-livelock.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type, np) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: 'x' + size, seed, mapType: type, numPlayers: np });
  createWorld(spec, { players: Array.from({ length: np }, (_, i) => ({ name: 'P' + i, civ: ['franks', 'turks', 'britons'][i % 3], color: PLAYER_COLORS[i], human: i === 0 })), seed, fog: 'none', startRes: 'high', startAge: 2 });
}`);

// ---------- 1. the smallest case: one spearman, one straight leg past a cliff corner ----------
// Seed 7 at 160 x 160: tile (116, 62) is at elevation 1 and (116, 63) at 3, a cliff; the leg from (117.5, 61.5) to
// (116.5, 64.5) runs exactly through the corner of those tiles. lineClear's sampled line goes round the corner, so a
// path may hold this leg (a shared route did); the unit itself slides into (116, 62) and faces the cliff.
const M = JSON.parse(run(`(() => {
  world(160, 7, 'land', 2);
  const res = [];
  for (const [sx, sy] of [[117.5, 61.5], [116.5, 62.5], [117.5, 62.5]]) {
    const u = spawnUnit('spearman', 1, sx, sy);
    u.order = { t: 'move', x: 116.5, y: 64.5 }; u.path = [{ x: 116.5, y: 64.5 }]; u.pi = 0; u.pathOk = true;
    u.goalRect = { x0: 116, y0: 64, x1: 116, y1: 64 }; u.goalR = 0; u.dest = { x: 116.5, y: 64.5 };
    let t = 0, repaths = 0; const pt = pathTo; pathTo = function (v) { if (v === u) repaths++; return pt.apply(this, arguments); };
    try { while (t < 30 && u.order) { worldTick(0.05); t += 0.05; } } finally { pathTo = pt; }
    res.push({ from: [sx, sy], arrived: !u.order, t: +t.toFixed(2), at: [+u.x.toFixed(3), +u.y.toFixed(3)], repaths });
    removeEnt(u);
  }
  return JSON.stringify({ elev: [W.map.elev[W.map.idx(116, 62)], W.map.elev[W.map.idx(116, 63)], W.map.elev[W.map.idx(117, 63)]], res });
})()`));
ok(`a spearman whose leg passes a cliff corner repaths and arrives within 5 game seconds, from all three starts (elevations ${M.elev.join(' / ')})`,
  M.elev[1] - M.elev[0] >= 2 && M.res.every(r => r.arrived && r.t < 5) && M.res[0].repaths >= 1 && M.res[1].repaths >= 1, M);

// ---------- 2. the group order that found it: 10 spearmen and a straggler, HPA.joinReach 24-44 ----------
const G = JSON.parse(run(`(() => {
  const out = [], reach0 = HPA.joinReach;
  for (const R of [24, 28, 32, 36, 40, 44]) {
    HPA.joinReach = R; world(160, 7, 'land', 2);
    const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
    const us = []; for (let k = 0; k < 10; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
    const p = nearestLandTile((a.x - 30) | 0, (a.y + 20) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5));
    orderMove(us, b.x + 2, b.y + 7);
    let t = 0; while (t < 300 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
    out.push({ R, left: us.filter(u => u.order).length, t: +t.toFixed(0) });
  }
  HPA.joinReach = reach0;
  return JSON.stringify(out);
})()`));
ok(`with HPA.joinReach 24, 28, 32, 36, 40 and 44, all 11 spearmen of the group order arrive within 300 game seconds (left over: ${G.map(g => g.left).join(', ')})`, G.every(g => g.left === 0), G);

// ---------- 3. single units with their own paths, the hierarchy on and off: none walks on the spot ----------
// 60 random moves of 8-38 tiles on two cliffy 160 maps where 91c0970 left 2 units each walking on the spot for good.
const S = JSON.parse(run(`(() => {
  const out = [];
  for (const [type, seed] of [['land', 3], ['alpine', 2]]) for (const on of [true, false]) {
    HPA.enabled = on; world(160, seed, type, 2);
    for (const p of W.players.slice(1)) p.stance = p.stance.map(() => 'ally');
    const m = W.map, n = m.n, rnd = mulberry32(seed * 77), pass = passLand(1), us = [];
    for (let tries = 0; us.length < 60 && tries < 5000; tries++) {
      const x = 4 + ((rnd() * (n - 8)) | 0), y = 4 + ((rnd() * (n - 8)) | 0); if (!pass(m.idx(x, y))) continue;
      const ang = rnd() * 6.283, d = 8 + rnd() * 30, tx = Math.round(x + Math.cos(ang) * d), ty = Math.round(y + Math.sin(ang) * d);
      if (!m.inb(tx, ty) || !pass(m.idx(tx, ty)) || !findPath(m, x, y, { x0: tx, y0: ty, x1: tx, y1: ty, r: 0 }, pass).ok) continue;
      const u = spawnUnit(rnd() < 0.5 ? 'spearman' : 'knight', 1, x + 0.5, y + 0.5); setOrder(u, { t: 'move', x: tx + 0.5, y: ty + 0.5 }); us.push(u);
    }
    const reps = new Map(), pt = pathTo; pathTo = function (v) { reps.set(v, (reps.get(v) || 0) + 1); return pt.apply(this, arguments); };
    let left, locked;
    try {
      let t = 0; while (t < 60 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
      // a unit still under way that stays within 0.3 tiles and asks for no new path over the next 5 game seconds is stuck for good
      left = us.filter(u => u.order); const at = new Map(left.map(u => [u, { x: u.x, y: u.y, r: reps.get(u) || 0, span: 0 }]));
      for (let k = 0; k < 100; k++) { worldTick(0.05); for (const u of left) { const a = at.get(u); a.span = Math.max(a.span, Math.hypot(u.x - a.x, u.y - a.y)); } }
      locked = left.filter(u => u.order && at.get(u).span < 0.3 && (reps.get(u) || 0) === at.get(u).r).length;
    } finally { pathTo = pt; }
    out.push({ type, seed, hpa: on, moves: us.length, under: left.length, locked });
  }
  HPA.enabled = true;
  return JSON.stringify(out);
})()`));
ok(`240 single-unit moves on two cliffy maps, the hierarchy on and off: no unit walks on the spot without asking for a new path (stuck: ${S.map(s => s.locked).join(', ')})`, S.every(s => s.moves === 60 && s.locked === 0), S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/movement-livelock.test.js`
Expected (about 40 s; observed while planning):
```
FAIL a spearman whose leg passes a cliff corner repaths and arrives within 5 game seconds, from all three starts (elevations 1 / 3 / 2)  {"elev":[1,3,2],"res":[{"from":[117.5,61.5],"arrived":false,"t":30,"at":[116.5,62.863],"repaths":0},{"from":[116.5,62.5],"arrived":false,"t":30,"at":[116.5,62.98],"repaths":0},{"from":[117.5,62.5],"arrived":true,"t":1.4,"at":[116.5,64.5],"repaths":0}]}
FAIL with HPA.joinReach 24, 28, 32, 36, 40 and 44, all 11 spearmen of the group order arrive within 300 game seconds (left over: 1, 5, 1, 1, 1, 0)  [...]
FAIL 240 single-unit moves on two cliffy maps, the hierarchy on and off: no unit walks on the spot without asking for a new path (stuck: 3, 3, 6, 6)  [...]
0 passed, 3 failed
```

- [ ] **Step 3: The fix**

In `game/js/movement.js`, replace:
```js
const MOVE = { enabled: true, repathAfter: 0.5, rescueAfter: 3, sidestep: true };
```
with:
```js
// mark: after a tick without progress, progress must beat the unit's best distance to its waypoint (see followPath);
// false gives the movement before phase 4 (tests/sim-signature.test.js replays the old matches with it off)
const MOVE = { enabled: true, repathAfter: 0.5, rescueAfter: 3, sidestep: true, mark: true };
```

In `game/js/movement.js`, replace:
```js
    // progress is measured toward the waypoint, so sliding back and forth on the spot still counts as stuck
    const nd = Math.hypot(p.x - u.x, p.y - u.y);
    if (moved && nd < dist - step * 0.25) { u.stuck = Math.max(0, (u.stuck || 0) - dt); u.mvRescues = 0; return false; }
    u.stuck = (u.stuck || 0) + dt;
```
with:
```js
    // Progress is measured toward the waypoint, so sliding back and forth on the spot still counts as stuck. After a tick
    // without progress the unit must also get nearer the waypoint than it was before that tick (u.mvBest, kept for this
    // waypoint, u.mvAt): otherwise a drift to the tile centre and the step back cancel out every two ticks, the stuck
    // time never reaches MOVE.repathAfter, and the unit walks on the spot for good.
    const nd = Math.hypot(p.x - u.x, p.y - u.y), best = MOVE.mark && u.mvAt === p ? u.mvBest : Infinity;
    if (moved && nd < Math.min(dist, best) - step * 0.25) { u.stuck = Math.max(0, (u.stuck || 0) - dt); u.mvRescues = 0; if (u.mvAt) u.mvAt = null; return false; }
    if (MOVE.mark && (u.mvAt !== p || dist < u.mvBest)) { u.mvBest = Math.min(dist, best); u.mvAt = p; }
    u.stuck = (u.stuck || 0) + dt;
```

- [ ] **Step 4: Run the test again**

Run: `node tests/movement-livelock.test.js`
Expected (about 25 s; observed while planning):
```
PASS a spearman whose leg passes a cliff corner repaths and arrives within 5 game seconds, from all three starts (elevations 1 / 3 / 2)  {"elev":[1,3,2],"res":[{"from":[117.5,61.5],"arrived":true,"t":3.05,"at":[116.5,64.5],"repaths":1},{"from":[116.5,62.5],"arrived":true,"t":2.4,"at":[116.5,64.5],"repaths":1},{"from":[117.5,62.5],"arrived":true,"t":1.4,"at":[116.5,64.5],"repaths":0}]}
PASS with HPA.joinReach 24, 28, 32, 36, 40 and 44, all 11 spearmen of the group order arrive within 300 game seconds (left over: 0, 0, 0, 0, 0, 0)  [{"R":24,"left":0,"t":90},{"R":28,"left":0,"t":86},{"R":32,"left":0,"t":88},{"R":36,"left":0,"t":88},{"R":40,"left":0,"t":88},{"R":44,"left":0,"t":88}]
PASS 240 single-unit moves on two cliffy maps, the hierarchy on and off: no unit walks on the spot without asking for a new path (stuck: 0, 0, 0, 0)  [...]
3 passed, 0 failed
```

- [ ] **Step 5: The off mode turns the mark off too; re-record the switch-on mode**

In `tests/sim-signature.test.js`, replace:
```js
// re-recorded them for the deliberate AI stagger, and phase 3 for hierarchical routes and group orders.
// Every scenario plays twice: with the hierarchy on (the game's default; key = the scenario) and with it switched off
// (key + '@hpa-off': the routes before phase 3). AOR_HPA=on or AOR_HPA=off plays only that mode. A change that is
// meant to alter the simulation re-records them deliberately, and its commit says why:
```
with:
```js
// re-recorded them for the deliberate AI stagger, phase 3 for hierarchical routes and group orders, and phase 4 for
// the movement fix (MOVE.mark: units no longer walk on the spot for good).
// Every scenario plays twice: with the game's defaults (key = the scenario) and with the hierarchy and phase 4's
// movement mark switched off (key + '@hpa-off': the routes and movement before phase 3, hashes f620967b and f3599320).
// AOR_HPA=on or AOR_HPA=off plays only that mode. A change that is meant to alter the simulation re-records them
// deliberately, and its commit says why:
```

In `tests/sim-signature.test.js`, replace:
```js
  if (mode === 'off') run('HPA.enabled = false');
```
with:
```js
  if (mode === 'off') run('HPA.enabled = false; MOVE.mark = false');
```

Run: `node tests/sim-signature.test.js`
Expected: `3 passed, 1 failed`, observed while planning:
- `small-coastal-3p-castle` fails with `"expected":"824240c4ef2a39a77bd37ef06047d74fb74c7cd2","got":"ed4b527667fe3f8f01660cf4a7aa419a774cf396"`;
- `tiny-land-2p-feudal` passes with `9fda2e5c…`;
- both `@hpa-off` keys pass with `f620967b…` and `f3599320…`.

Run: `AOR_RECORD=1 AOR_HPA=on node tests/sim-signature.test.js`
Expected: `recorded tiny-land-2p-feudal 9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b` and `recorded small-coastal-3p-castle ed4b527667fe3f8f01660cf4a7aa419a774cf396`, then `1 passed, 0 failed`.
Run: `node tests/sim-signature.test.js`
Expected: `4 passed, 0 failed`. `tests/fixtures/sim-signatures.json` now reads:
```json
{
  "tiny-land-2p-feudal": "9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b",
  "small-coastal-3p-castle": "ed4b527667fe3f8f01660cf4a7aa419a774cf396",
  "tiny-land-2p-feudal@hpa-off": "f620967b4318fae0eb0477b6cfc44259a3e3ec66",
  "small-coastal-3p-castle@hpa-off": "f3599320291fc01383e6d58f4c82a3230c7b398b"
}
```
If your hashes differ (another Node version), keep yours. What matters is that the off keys did not change and that the next run replays all four.

- [ ] **Step 6: The neighbouring suites**

Run `node tests/<name>.test.js` for movement, command, tactics, engineering, actors, bridges-tunnels, polish, hpa-group and hpa-route.
Expected (observed while planning): `9`, `25`, `17`, `5`, `5`, `11`, `6`, `13` and `11` passed, each with `0 failed`.

- [ ] **Step 7: Commit, saying why the signature changes**

```bash
git add game/js/movement.js tests/movement-livelock.test.js tests/sim-signature.test.js tests/fixtures/sim-signatures.json
git commit -m "fix(move): units no longer walk on the spot for good; re-record one sim signature

A leg whose straight line cuts a cliff corner (lineClear's sampled line goes
round it) left the unit drifting to its tile centre and stepping back every
other tick: the stuck time went +dt, -dt and never reached repathAfter, so
it never repathed and the rescue never came. 2% of single-unit moves on
cliffy maps did it, with or without the hierarchy, and the phase 3 group
test showed it with joinReach 24-44. After a tick without progress, a unit
now has to beat its best distance to the waypoint (MOVE.mark).

The recorded small coastal match had such units, so its switch-on hash is
re-recorded deliberately: 824240c4 -> ed4b5276 (tiny land unchanged). The
off mode turns MOVE.mark off with the hierarchy and still replays the
matches from before phase 3, f620967b and f3599320.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Storage module `game/js/store.js`

`localStorage` holds about 5.24 M characters per origin (E§1.5). A 200 × 200 save filled most of it, and a 256 save no longer fitted. IndexedDB holds hundreds of megabytes.

The module has no game state. It opens the database `aor` at version 1 with the stores `saves`, `maps` and `meta`, and answers `get`, `put`, `del` and `keys` with promises. Each request runs in its own transaction and resolves once that transaction has completed.
- Where IndexedDB is missing or fails to open, the same calls use `localStorage` keys `aor:<store>:<key>` with JSON values.
- Where neither exists, every call rejects with "Storage is unavailable in this browser."

**Files:**
- Create: `game/js/store.js`, `tests/fake-idb.js`, `tests/store.test.js`, `tests/browser/saves.spec.js`
- Modify: `game/index.html` (load `store.js` after `glyphs.js`)

**Interfaces:**
- Consumes: `indexedDB`, `localStorage` (browser); `tests/engine-harness.js`.
- Produces:
  - `Store.open() → Promise<'idb' | 'local' | 'none'>`;
  - `Store.get(store, key)`, `Store.put(store, key, value)`, `Store.del(store, key)` and `Store.keys(store) → Promise<string[]>` (sorted);
  - `Store.mode`;
  - `fakeIndexedDB({ quota, failOpen })` and `fakeLocalStorage(quota)` for node tests (tests/fake-idb.js).
  - Tasks 3–5 use them all.

- [ ] **Step 1: The in-memory shims and the failing test**

Create `tests/fake-idb.js`:
```js
// A small in-memory IndexedDB and localStorage for node tests of game/js/store.js (tests/store.test.js and the save
// and editor suites). Only what store.js uses: indexedDB.open with onupgradeneeded, db.objectStoreNames.contains,
// createObjectStore, single-store transactions with get, put, delete and getAllKeys, and the request and transaction
// events, each fired on a later turn of the event loop as a browser does. Values are kept as structured clones.
//   const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
//   c.indexedDB = fakeIndexedDB({ quota });   // c: the vm context of tests/engine-harness.js
// Options: quota (bytes per stored value, roughly: strings count 2 per character; a bigger put fails with a
// QuotaExceededError), failOpen (open fails, so store.js falls back to localStorage).
'use strict';
const later = fn => setImmediate(fn);
const sizeOf = v => typeof v === 'string' ? v.length * 2 : JSON.stringify(v === undefined ? null : v).length * 2;
function quotaError() { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; }
function fakeIndexedDB(opts = {}) {
  const dbs = new Map();   // name -> { version, stores: Map(store -> Map(key -> value)) }
  const stats = { puts: 0, gets: 0, opens: 0 };
  function db(rec) {
    return {
      objectStoreNames: { contains: n => rec.stores.has(n) },
      createObjectStore(n) { rec.stores.set(n, new Map()); return {}; },
      close() { },
      onversionchange: null,
      transaction(names, mode) {
        for (const n of [].concat(names)) if (!rec.stores.has(n)) { const e = new Error('No object store ' + n); e.name = 'NotFoundError'; throw e; }
        const t = { oncomplete: null, onerror: null, onabort: null, error: null, open: 0, over: false };
        const settle = () => { if (!t.open && !t.over) { t.over = true; later(() => t.oncomplete && t.oncomplete()); } };
        t.objectStore = n => {
          const m = rec.stores.get(n);
          const op = f => {
            const r = { result: undefined, error: null, onsuccess: null, onerror: null }; t.open++;
            later(() => {
              try { r.result = f(); } catch (e) { r.error = t.error = e; t.over = true; if (r.onerror) r.onerror(); if (t.onerror) t.onerror(); return; }
              if (r.onsuccess) r.onsuccess(); t.open--; settle();
            });
            return r;
          };
          return {
            get: k => op(() => { stats.gets++; return m.has(k) ? structuredClone(m.get(k)) : undefined; }),
            put: (v, k) => op(() => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); if (opts.quota && sizeOf(v) > opts.quota) throw quotaError(); stats.puts++; m.set(k, structuredClone(v)); return k; }),
            delete: k => op(() => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); m.delete(k); }),
            getAllKeys: () => op(() => [...m.keys()].sort()),
          };
        };
        later(settle);   // a transaction that makes no request completes too
        return t;
      },
    };
  }
  return {
    stats, dbs,
    open(name, version) {
      const r = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        stats.opens++;
        if (opts.failOpen) { r.error = new Error('open failed'); if (r.onerror) r.onerror(); return; }
        let rec = dbs.get(name); if (!rec) dbs.set(name, rec = { version: 0, stores: new Map() });
        r.result = db(rec);
        if (version > rec.version) { const old = rec.version; rec.version = version; if (r.onupgradeneeded) r.onupgradeneeded({ oldVersion: old, newVersion: version }); }
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    },
  };
}
// localStorage with a quota in characters (keys and values), like Chromium's 5,242,880
function fakeLocalStorage(quota = 5242880) {
  const m = new Map(), used = () => { let s = 0; for (const [k, v] of m) s += k.length + v.length; return s; };
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { v = String(v); const old = m.has(k) ? k.length + m.get(k).length : 0; if (used() - old + k.length + v.length > quota) throw quotaError(); m.set(k, v); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}
module.exports = { fakeIndexedDB, fakeLocalStorage };
```

Create `tests/store.test.js`:
```js
// Storage module (game/js/store.js): IndexedDB 'aor' with the stores saves, maps and meta, and the localStorage
// fallback, against the in-memory shims of tests/fake-idb.js.   node tests/store.test.js
const harness = require('./engine-harness');
const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const err = p => p.then(() => 'resolved', e => (e && e.name ? e.name + ': ' : '') + (e && e.message));
(async () => {
  // ---------- 1. IndexedDB: the three stores, round trips, keys, delete, and a second page that sees the data ----------
  const idb = fakeIndexedDB();
  const A = harness(); A.c.indexedDB = idb; A.c.localStorage = fakeLocalStorage();
  const mode = await A.run('Store.open()');
  const big = 'x'.repeat(6 * 1024 * 1024);   // a 6 M-character save: more than the whole localStorage quota
  A.c.__big = big;
  await A.run(`Promise.all([Store.put('saves', '1', __big), Store.put('saves', 'auto', 'second'), Store.put('maps', 'My Map', { n: 16, ter: [1, 2, 3] }), Store.put('meta', 'save:1', { chars: __big.length })])`);
  const got = await A.run(`Promise.all([Store.get('saves', '1'), Store.get('maps', 'My Map'), Store.get('saves', 'nothing'), Store.keys('saves'), Store.keys('maps')]).then(r => JSON.stringify([r[0].length, r[1], r[2] === undefined, r[3], r[4]]))`);
  const stores = [...idb.dbs.get('aor').stores.keys()].sort();
  ok('IndexedDB: database aor at version 1 with the stores maps, meta and saves', mode === 'idb' && idb.dbs.get('aor').version === 1 && JSON.stringify(stores) === '["maps","meta","saves"]', { mode, stores });
  ok('a 6 M-character save, a map object and a missing key round trip; keys come sorted', got === JSON.stringify([big.length, { n: 16, ter: [1, 2, 3] }, true, ['1', 'auto'], ['My Map']]), got);
  await A.run(`Store.del('saves', 'auto')`);
  const B = harness(); B.c.indexedDB = idb;   // another page load: the data is still there
  const later = await B.run(`Promise.all([Store.keys('saves'), Store.get('saves', '1')]).then(r => JSON.stringify([r[0], r[1].length, Store.mode]))`);
  ok('after a delete, a new page opens the same database and reads what the first one wrote', later === JSON.stringify([['1'], big.length, 'idb']), later);
  ok('nothing was written to localStorage while IndexedDB works', A.c.localStorage.length === 0, A.c.localStorage.length);

  // ---------- 2. a failing put rejects with the browser's error, and nothing half-written is kept ----------
  const Q = harness(); Q.c.indexedDB = fakeIndexedDB({ quota: 1024 * 1024 }); Q.c.__big = big;
  const qe = await err(Q.run(`Store.put('saves', '2', __big)`));
  const qk = await Q.run(`Store.keys('saves').then(k => JSON.stringify(k))`);
  ok('a put past the quota rejects with QuotaExceededError and leaves no key behind', qe.startsWith('QuotaExceededError') && qk === '[]', { qe, qk });

  // ---------- 3. no IndexedDB: localStorage keys aor:<store>:<key> ----------
  const L = harness(); L.c.localStorage = fakeLocalStorage(); L.c.indexedDB = fakeIndexedDB({ failOpen: true });
  const lm = await L.run('Store.open()');
  await L.run(`Promise.all([Store.put('saves', '3', 'third'), Store.put('maps', 'm', { a: 1 }), Store.put('meta', 'save:3', { chars: 5 })])`);
  const lr = await L.run(`Promise.all([Store.get('saves', '3'), Store.get('maps', 'm'), Store.keys('saves'), Store.keys('meta')]).then(r => JSON.stringify(r))`);
  const raw = L.c.localStorage.getItem('aor:saves:3');
  ok('IndexedDB failing to open falls back to localStorage, with JSON values under aor:<store>:<key>', lm === 'local' && lr === JSON.stringify(['third', { a: 1 }, ['3'], ['save:3']]) && raw === '"third"', { lm, lr, raw });
  const L2 = harness(); L2.c.localStorage = fakeLocalStorage(1000);
  const le = await err(L2.run(`Store.put('saves', '1', 'y'.repeat(2000))`));
  ok('without IndexedDB at all, a save past the localStorage quota rejects with QuotaExceededError', le.startsWith('QuotaExceededError'), le);

  // ---------- 4. no storage at all, and bad arguments ----------
  const N = harness();
  const nm = await N.run('Store.open()'), ne = await err(N.run(`Store.get('saves', '1')`));
  ok('with neither IndexedDB nor localStorage every call rejects with a clear message', nm === 'none' && ne.includes('Storage is unavailable'), { nm, ne });
  const be = await err(A.run(`Store.put('nope', 'k', 1)`)), ke = await err(A.run(`Store.get('saves', '')`));
  ok('an unknown store or an empty key is refused', be.includes('Unknown store') && ke.includes('Invalid storage key'), { be, ke });
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/store.test.js`
Expected: exit status 1. The output starts `FAIL evalmachine.<anonymous>:1` and names `ReferenceError: Store is not defined`.

- [ ] **Step 3: The module**

Create `game/js/store.js`:
```js
// ===== Storage: the IndexedDB database 'aor', with localStorage when IndexedDB is unavailable =====
// Loaded before map.js. Stores: 'saves' (match saves: manual slots '1'-'5' and 'auto'), 'maps' (editor maps by name)
// and 'meta' (small records: a summary per save slot, the migration flag). Keys are strings. Every call returns a
// promise. Store.mode says which backend answered: 'idb', 'local' (localStorage keys 'aor:<store>:<key>', values as
// JSON) or 'none' (no storage at all: every call rejects). localStorage keeps only settings once phase 4's migration
// has moved the old saves and maps (session.js).
'use strict';
const Store = {
  name: 'aor', version: 1, stores: ['saves', 'maps', 'meta'],
  mode: null, db: null, opening: null,
  // opens the database once; resolves with the mode
  open() {
    if (this.opening) return this.opening;
    const fallback = () => (this.mode = this.localOk() ? 'local' : 'none');
    this.opening = new Promise(resolve => {
      let idb = null; try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) { resolve(fallback()); return; }
      let req; try { req = idb.open(this.name, this.version); } catch (e) { resolve(fallback()); return; }
      req.onupgradeneeded = () => { const db = req.result; for (const s of this.stores) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
      req.onsuccess = () => {
        this.db = req.result; this.mode = 'idb';
        this.db.onversionchange = () => { this.db.close(); this.db = null; this.opening = null; };   // another tab upgrades: reopen on the next call
        resolve('idb');
      };
      req.onerror = () => resolve(fallback());
      req.onblocked = () => resolve(fallback());
    });
    return this.opening;
  },
  localOk() { try { localStorage.setItem('aor:probe', '1'); localStorage.removeItem('aor:probe'); return true; } catch (e) { return false; } },
  check(store, key) {
    if (!this.stores.includes(store)) throw new Error('Unknown store ' + store + '.');
    if (key !== undefined && (typeof key !== 'string' || !key.length || key.length > 200)) throw new Error('Invalid storage key.');
  },
  // one request in its own transaction: resolves with the request's result once the transaction has completed
  async tx(store, mode, fn) {
    if (!this.db) { this.opening = null; if ((await this.open()) !== 'idb') throw new Error('Storage is unavailable in this browser.'); }
    return new Promise((resolve, reject) => {
      let t, r;
      try { t = this.db.transaction(store, mode); r = fn(t.objectStore(store)); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error || r.error || new Error('Storage failed.'));
      t.onabort = () => reject(t.error || new Error('Storage failed.'));
    });
  },
  async get(store, key) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') return this.tx(store, 'readonly', s => s.get(key));
    if (mode === 'local') { const v = localStorage.getItem('aor:' + store + ':' + key); return v === null ? undefined : JSON.parse(v); }
    throw new Error('Storage is unavailable in this browser.');
  },
  async put(store, key, value) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') { await this.tx(store, 'readwrite', s => s.put(value, key)); return; }
    if (mode === 'local') { localStorage.setItem('aor:' + store + ':' + key, JSON.stringify(value)); return; }
    throw new Error('Storage is unavailable in this browser.');
  },
  async del(store, key) {
    this.check(store, key); const mode = await this.open();
    if (mode === 'idb') { await this.tx(store, 'readwrite', s => s.delete(key)); return; }
    if (mode === 'local') { localStorage.removeItem('aor:' + store + ':' + key); return; }
    throw new Error('Storage is unavailable in this browser.');
  },
  // the keys of a store, sorted
  async keys(store) {
    this.check(store); const mode = await this.open();
    if (mode === 'idb') return (await this.tx(store, 'readonly', s => s.getAllKeys())).map(String).sort();
    if (mode === 'local') { const p = 'aor:' + store + ':', out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(p)) out.push(k.slice(p.length)); } return out.sort(); }
    throw new Error('Storage is unavailable in this browser.');
  },
};
```

In `game/index.html`, replace:
```html
<script src="js/glyphs.js"></script>
<script src="js/map.js"></script>
```
with:
```html
<script src="js/glyphs.js"></script>
<script src="js/store.js"></script>
<script src="js/map.js"></script>
```

- [ ] **Step 4: Run the test**

Run: `node tests/store.test.js`
Expected (observed while planning):
```
PASS IndexedDB: database aor at version 1 with the stores maps, meta and saves  {"mode":"idb","stores":["maps","meta","saves"]}
PASS a 6 M-character save, a map object and a missing key round trip; keys come sorted  "[6291456,{\"n\":16,\"ter\":[1,2,3]},true,[\"1\",\"auto\"],[\"My Map\"]]"
PASS after a delete, a new page opens the same database and reads what the first one wrote  "[[\"1\"],6291456,\"idb\"]"
PASS nothing was written to localStorage while IndexedDB works  0
PASS a put past the quota rejects with QuotaExceededError and leaves no key behind  {"qe":"QuotaExceededError: The quota has been exceeded.","qk":"[]"}
PASS IndexedDB failing to open falls back to localStorage, with JSON values under aor:<store>:<key>  {"lm":"local","lr":"[\"third\",{\"a\":1},[\"3\"],[\"save:3\"]]","raw":"\"third\""}
PASS without IndexedDB at all, a save past the localStorage quota rejects with QuotaExceededError  "QuotaExceededError: The quota has been exceeded."
PASS with neither IndexedDB nor localStorage every call rejects with a clear message  {"nm":"none","ne":"Error: Storage is unavailable in this browser."}
PASS an unknown store or an empty key is refused  {"be":"Error: Unknown store nope.","ke":"Error: Invalid storage key."}
9 passed, 0 failed
```

- [ ] **Step 5: The browser round trip**

Create `tests/browser/saves.spec.js`:
```js
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
```

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test saves.spec.js`
Expected: `1 passed`.

- [ ] **Step 6: Syntax and commit**

Run: `npm run test:syntax`
Expected: `101 scripts passed syntax checks.` (97 after C2, plus the four new files)
```bash
git add game/js/store.js game/index.html tests/fake-idb.js tests/store.test.js tests/browser/saves.spec.js
git commit -m "feat(saves): IndexedDB storage module with a localStorage fallback

game/js/store.js opens the database aor (stores saves, maps and meta)
and answers get, put, del and keys with promises, each request in its
own transaction. Without IndexedDB it uses localStorage keys
aor:<store>:<key>; with neither, every call rejects with a clear
message. Node tests run against an in-memory IndexedDB shim.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Save format 2

Format 1 (session.js:5-27) writes every object as a node of `[key, value]` pairs, and every typed array as a JSON list of numbers. It also writes `W.spec`, the whole spec the match was generated from: a second copy of `ter` and `elev`, and every spawn object (E§5.11).

Format 2 keeps the graph model, so shared objects and cycles survive, and makes every part compact:
- **Typed arrays:** `[type, length, base64 of PackBits run-length bytes]`. Map layers, fog and occupancy are long runs. `deco` is random bytes and costs its base64 size.
- **Objects:** `[shape, value…]`, with `shapes[shape] = [prototype, key…]` listed once. A tree is about 45 characters instead of about 200.
- **Values:** a reference is `[node]` and `undefined` is `[]`.
- **`W.spec` of a generated map:** a stub, `{ regen: { size, seed, mapType, numPlayers, rivers }, name, players }`. Restart regenerates it (`MatchSave.specOf`). An editor map keeps its layers, packed like the live ones.
- **The file head** gains `n`, so the limits are known before the graph is read.
- **Limits:**
  - **Nodes, values and entities:** `MatchSave.caps(n)`. They are never below format 1's fixed limits and grow with n²; a 480 match allows 1.84 M nodes and 921,600 entities.
  - **The text:** the old 16e6 limit becomes the sanity cap `CODEC.cap`, 256 MB.

`MatchSave.parse` reads both formats. On the way in:
- **The AI stagger, once (`MatchSave.staggerAI`).** A format 1 save from before phase 2 has every AI on one tick (equal `acc`), and gets the stagger. A save from phase 2 or later is already staggered and is left alone, so it loads exactly as before. That is checked by a fixture made from the build just before this task.
- **Stale occupancy ids.** A `blk` id whose entity is gone is cleared, before anything reads the layer. The pathfinding graph's pass function puts back any id that `passLand` or `passNaval` clears, so building the graph at load (`hpaWarm`) no longer changes the map.

**Never saved, by design** (written at the top of session.js):
- **The pathfinding graph and the entity index.** Both are rebuilt on load.
- **`HPA.enabled`.** It follows the URL.
- **Group-order state (`HPA_GROUP`).** A member still waiting for its join when the match is saved makes its own search after loading. So a resumed match equals the uninterrupted one only from a tick when `hpaPending()` is 0. The resume test saves at such a tick, and also checks a save made mid-join.

**Files:**
- Create:
  - `game/js/codec.js`;
  - `tests/save-v2.test.js`, `tests/resume.test.js`;
  - `tests/fixtures/saves/2026-10-20-phase3-final-v1.json.gz` (by the script).
- Modify:
  - `game/js/session.js`: lines 1–131, from the header through `parse`;
  - `game/js/map.js`: `SPEC_LAYERS`;
  - `game/js/hpa.js`: `hpaPassFn` and `hpaPending`;
  - `game/js/ui.js`: `restartGame`;
  - `game/index.html`: `codec.js`;
  - `tests/make-save-fixture.js`, `tests/save-compat.test.js`: `replay`;
  - `tests/reliability.test.js`: the format 2 payloads.

**Interfaces:**
- Consumes: `Store` (Task 1, not yet used here); `GameMap`, `Player`, `AIPlayer`, `validateMapSpec`, `generateMapSpec`, `WMOD.rivers`, `MAP_TYPE_NAMES`, `REAL_MAPS`.
- Produces:
  - **codec.js:** `CODEC.cap`, `CODEC_TYPES`, `rleEncode`, `rleDecode`, `b64Encode`, `b64Decode`, `packArray(a) → { t, n, d }` and `unpackArray(p, maxLen)`.
  - **session.js:**
    - `MatchSave.caps(n)`, `MatchSave.decode` (format 1), `v1Size`;
    - the generators `walk(value, out, slice)` and `pack(out, slice)`, and `decode2`;
    - `specStub(w)`, `specOf(s)`, `staggerAI(w) → boolean`;
    - `parts(w = W, from = null) → { head, value }`, used by Tasks 3 and 5;
    - `snapshot()`, which also sets `MatchSave.lastHead`.
  - `SPEC_LAYERS` (map.js), `hpaPending()` (hpa.js).
  - `MatchSave.version` is 2.

- [ ] **Step 1: A format 1 fixture from today's build, and the replay check**

Do this before any format change. A fixture records what its build does after loading it, and later builds must do the same.

In `tests/make-save-fixture.js`, replace:
```js
// Makes a match-save fixture for tests/save-compat.test.js from the code in this checkout.
//   node tests/make-save-fixture.js <label> [--minutes=6]
// Run it once per release (git checkout <tag> first, or use a worktree) and commit the file it writes to
// tests/fixtures/saves/<label>.json.gz. Fixtures are never regenerated: they stand for saves players already have.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
```
with:
```js
// Makes a match-save fixture for tests/save-compat.test.js from the code in this checkout.
//   node tests/make-save-fixture.js <label> [--minutes=6]
// Run it once per release (git checkout <tag> first, or use a worktree) and commit the file it writes to
// tests/fixtures/saves/<label>.json.gz. Fixtures are never regenerated: they stand for saves players already have.
// The fixture also records `replay`: the sha1 of signature() after this build loads the save, gives every slot to the
// computer and plays 30 seconds. A later build that loads the save the same way must reach the same hash.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
```

In `tests/make-save-fixture.js`, replace:
```js
if (warnings.length) console.warn(warnings.join('\n'));
let commit = '';
```
with:
```js
if (warnings.length) console.warn(warnings.join('\n'));
const replayRun = require('./engine-harness')().run;
replayRun(`var __save = ${JSON.stringify(text)};`);
const replay = crypto.createHash('sha1').update(replayRun(`(() => { MatchSave.restore(__save); for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard'); for (let i = 0; i < 600; i++) worldTick(0.05); return signature(); })()`)).digest('hex');
let commit = '';
```

In `tests/make-save-fixture.js`, replace:
```js
const wrapped = JSON.stringify({ label, commit, made: new Date().toISOString().slice(0, 10), minutes, save: JSON.parse(text) });
```
with:
```js
const wrapped = JSON.stringify({ label, commit, made: new Date().toISOString().slice(0, 10), minutes, replay, save: JSON.parse(text) });
```

In `tests/make-save-fixture.js`, replace:
```js
console.log(`${path.relative(process.cwd(), file)}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB (${(text.length / 1024).toFixed(0)} KB uncompressed), commit ${commit}`);
```
with:
```js
console.log(`${path.relative(process.cwd(), file)}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB (${(text.length / 1024).toFixed(0)} KB uncompressed), commit ${commit}, replay ${replay}`);
```

In `tests/save-compat.test.js`, replace:
```js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
```
with:
```js
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
```

In `tests/save-compat.test.js`, replace:
```js
  const D = run(`(() => { const sig = () => { MatchSave.restore(__save); for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard'); for (let i = 0; i < 600; i++) worldTick(0.05); return signature(); };
    return sig() === sig(); })()`);
  ok(`${name}: deterministic after loading`, D === true);
```
with:
```js
  const D = JSON.parse(run(`(() => { const sig = () => { MatchSave.restore(__save); for (const p of W.players.slice(1)) if (!p.ai) p.ai = new AIPlayer(p, 'standard'); for (let i = 0; i < 600; i++) worldTick(0.05); return signature(); };
    const a = sig(); return JSON.stringify({ same: a === sig(), sig: a }); })()`));
  ok(`${name}: deterministic after loading`, D.same === true);
  // a fixture made since phase 4 records how the build that made it played on after loading it
  if (fx.replay) { const got = crypto.createHash('sha1').update(D.sig).digest('hex'); ok(`${name}: loads and plays on exactly as the build that made it (${fx.commit})`, got === fx.replay, { expected: fx.replay, got }); }
```

Run: `node tests/make-save-fixture.js 2026-10-20-phase3-final-v1`
Expected (about 10 s; observed while planning; the commit is yours):
```
tests\fixtures\saves\2026-10-20-phase3-final-v1.json.gz: 54 KB (571 KB uncompressed), commit 87d993f, replay 019441f08d950b5966f8a491b875a9124c5b01ea
```
The replay hash depends only on the code, so with Tasks C1, C2 and 1 as written it should be `019441f08d950b5966f8a491b875a9124c5b01ea`.
Run: `node tests/save-compat.test.js`
Expected: `17 passed, 0 failed`. Its last line is `PASS 2026-10-20-phase3-final-v1: loads and plays on exactly as the build that made it (<commit>)  {"expected":"019441f0…","got":"019441f0…"}`.
```bash
git add tests/make-save-fixture.js tests/save-compat.test.js tests/fixtures/saves/2026-10-20-phase3-final-v1.json.gz
git commit -m "test(saves): a format 1 fixture from the build before format 2, with its replay

make-save-fixture.js now records how the build that made a fixture plays
on 30 seconds after loading it (the sha1 of signature()), and
save-compat.test.js checks that later builds load it the same way. The
new fixture is made before the save format changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing tests**

Create `tests/save-v2.test.js`:
```js
// Save format 2 (game/js/session.js, game/js/codec.js): run-length base64 layers, compact object nodes, the generated
// map's spec as its options, limits that grow with the map, format 1 still loading (with the AI stagger once), and
// stale occupancy ids cleared on the way in.   node tests/save-v2.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const harness = require('./engine-harness');
const { run } = harness();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function match(size, seed, type, np, minutes, age = 1) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: 'x' + size, seed, mapType: type, numPlayers: np }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: np }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 5) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed, size: 'x' + size, mapType: type, fog: 'normal', startRes: 'high', startAge: age, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  for (let i = 0; i < minutes * 1200; i++) worldTick(0.05);
  W.spectate = false;
}`);

// ---------- 1. the codecs ----------
const C = JSON.parse(run(`(() => {
  const out = { rle: true, b64: true, vectors: true, bad: 0 }, rnd = mulberry32(9);
  const cases = [0, 1, 2, 3, 4, 127, 128, 129, 130, 131, 258, 1000, 100000].flatMap(n => {
    const runs = new Uint8Array(n), noise = new Uint8Array(n), mixed = new Uint8Array(n);
    for (let i = 0; i < n; i++) { runs[i] = (i / 37) & 3; noise[i] = (rnd() * 256) | 0; mixed[i] = (i % 300) < 150 ? 0 : (rnd() * 4) | 0; }
    return [runs, noise, mixed];
  });
  for (const a of cases) {
    const r = rleEncode(a), back = rleDecode(r, a.length);
    if (back.length !== a.length || back.some((v, i) => v !== a[i]) || r.length > a.length + Math.ceil(a.length / 128) + 1) out.rle = false;
    const s = b64Encode(a), d = b64Decode(s);
    if (d.length !== a.length || d.some((v, i) => v !== a[i]) || s.length !== Math.ceil(a.length / 3) * 4) out.b64 = false;
  }
  const enc = t => b64Encode(Uint8Array.from(t, c => c.charCodeAt(0)));
  out.vectors = ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].map(enc).join(',') === ',Zg==,Zm8=,Zm9v,Zm9vYg==,Zm9vYmE=,Zm9vYmFy';
  const a = new Int32Array([0, 0, 0, 0, 70000, -5, 0, 0]), p = packArray(a), q = unpackArray(p, 100);
  out.typed = q instanceof Int32Array && q.length === 8 && q[4] === 70000 && q[5] === -5 && p.t === 'Int32Array';
  for (const f of [() => rleDecode(Uint8Array.of(5, 1), 6), () => rleDecode(Uint8Array.of(200), 75), () => rleDecode(Uint8Array.of(0, 1), 5), () => b64Decode('abc'), () => b64Decode('ab=c'), () => b64Decode('a$cd'),
    () => unpackArray({ t: 'Function', n: 1, d: 'AAAA' }, 10), () => unpackArray({ t: 'Uint8Array', n: 20, d: p.d }, 10), () => unpackArray({ t: 'Float32Array', n: 1, d: packArray(new Float32Array([NaN])).d }, 10)])
    try { f(); } catch (e) { out.bad++; }
  return JSON.stringify(out);
})()`));
ok('run-length bytes and base64 round trip on runs, noise and mixed arrays of every boundary length, and match the RFC 4648 vectors', C.rle && C.b64 && C.vectors && C.typed, C);
ok('malformed run-length data, base64, array types, lengths over the limit and non-finite floats are refused', C.bad === 9, C);

// ---------- 2. a match round trips to its own signature, and saving again gives the same graph ----------
const R = JSON.parse(run(`(() => {
  match(200, 33, 'coastal', 3, 3);
  const sig0 = signature(), t0 = performance.now(), text = MatchSave.serialize(), ms = performance.now() - t0;
  const g0 = JSON.stringify(JSON.parse(text).graph);
  MatchSave.restore(text); W.spectate = false;
  const sig1 = signature(), g1 = JSON.stringify(MatchSave.snapshot().graph);
  const file = JSON.parse(text), types = {};
  for (const nd of file.graph.nodes) { const k = typeof nd[0] === 'number' ? 'object' : nd[0]; types[k] = (types[k] || 0) + 1; }
  return JSON.stringify({ same: sig0 === sig1, graphSame: g0 === g1, chars: text.length, ms: +ms.toFixed(0), version: file.version, n: file.n, nodes: file.graph.nodes.length, shapes: file.graph.shapes.length, types, entities: W.list.length, specKeys: Object.keys(W.spec).sort().join(',') });
})()`));
ok(`a 200 x 200 3-player match after 3 game minutes saves in format 2 (${R.chars.toLocaleString('en-US')} characters, format 1 needed about 3,170,000) and loads to exactly its own signature`, R.same && R.version === 2 && R.n === 200 && R.chars < 1000000, R);
ok('saving the loaded match again gives the same graph, node for node', R.graphSame, { nodes: R.nodes, shapes: R.shapes, types: R.types });
ok('the generated map is saved as the options that regenerate it, with its name and starts', R.specKeys === 'name,players,regen', R.specKeys);

// ---------- 3. the regenerated spec is the original one, for every map type, rivers on and off ----------
const G = JSON.parse(run(`(() => {
  const bad = [], rivers0 = WMOD.rivers; let n = 0;
  for (const type of [...Object.keys(MAP_TYPE_NAMES), ...Object.keys(REAL_MAPS)]) for (const rv of [true, false]) {
    WMOD.rivers = rv; MAP_SIZES.x96 = 96;
    const spec = generateMapSpec({ size: 'x96', seed: 41, mapType: type, numPlayers: 3 }), want = JSON.stringify(spec);
    createWorld(spec, { players: [0, 1, 2].map(i => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 41, size: 'x96', mapType: type, fog: 'none', startRes: 'standard', startAge: 0, rules: currentRules() });
    WMOD.rivers = !rv;   // the rule at Restart time may differ: the stub regenerates with the one the map was made with
    const stub = MatchSave.specStub(W), back = JSON.stringify(MatchSave.specOf(JSON.parse(JSON.stringify(stub))));
    n++; if (back !== want || !stub.regen) bad.push(type + (rv ? '+rivers' : ''));
  }
  WMOD.rivers = rivers0;
  // an editor map keeps its layers and objects
  const blank = blankMapSpec(48); blank.players = [{ start: { x: 10, y: 10 }, civ: 'franks' }, { start: { x: 36, y: 36 }, civ: 'turks' }]; blank.ter[5] = T.WATER;
  createWorld(blank, { players: [0, 1].map(i => ({ name: 'P' + i, civ: 'franks', color: PLAYER_COLORS[i], human: i === 0 })), seed: 3, mapType: 'custom', fog: 'none', startRes: 'standard', startAge: 0, rules: currentRules() });
  const st = MatchSave.specStub(W), custom = ArrayBuffer.isView(st.ter) && !st.regen && JSON.stringify(MatchSave.specOf(st)) === JSON.stringify(blank);
  return JSON.stringify({ n, bad, custom });
})()`));
ok(`a generated map's spec regenerates exactly from its options (${G.n} map types and river rules); an editor map keeps its own layers`, G.bad.length === 0 && G.custom && G.n >= 16, G);

// ---------- 4. a 480 x 480 match with 8 players fits in 6 MB ----------
const H = JSON.parse(run(`(() => {
  const v0 = validateMapSpec;   // the perf spec's cap patch: sides above 256 stay blocked until phase 8
  validateMapSpec = eval('(' + v0.toString().replace('n > 256', 'n > 1024') + ')');
  try {
    match(480, 33, 'land', 8, 1);
    const sig0 = signature(), t0 = performance.now(), text = MatchSave.serialize(), ms = performance.now() - t0;
    MatchSave.restore(text);
    return JSON.stringify({ chars: text.length, ms: +ms.toFixed(0), entities: W.list.length, same: signature() === sig0 });
  } finally { validateMapSpec = v0; }
})()`));
ok(`a 480 x 480 match with 8 players saves in ${(H.chars / 1048576).toFixed(2)} M characters (at most 6 M) and loads to its own signature`, H.chars <= 6 * 1048576 && H.same, H);

// ---------- 5. limits: a 256 MB sanity cap on the text; node, value and entity limits that grow with the map ----------
const L = JSON.parse(run(`(() => {
  const out = {}, cap = CODEC.cap;
  CODEC.cap = 1000; try { MatchSave.parse(' '.repeat(1001)); out.cap = 'accepted'; } catch (e) { out.cap = e.message; } finally { CODEC.cap = cap; }
  out.capMB = CODEC.cap / 1048576;
  out.c256 = MatchSave.caps(256); out.c480 = MatchSave.caps(480);
  // 120,000 shrubs on a 200 map: more entities than format 1's fixed limit of 100,000 allowed
  match(200, 7, 'land', 2, 0);
  for (let i = 0; i < 120000; i++) spawnRes('shrub', 2 + (i % 196), 2 + ((i / 196) | 0) % 196);
  const text = MatchSave.serialize(); let parsed;
  try { parsed = MatchSave.parse(text).world.list.length; } catch (e) { parsed = e.message; }
  out.many = { entities: W.list.length, parsed };
  return JSON.stringify(out);
})()`));
ok('a save text over the sanity cap (CODEC.cap, 256 MB) is refused before it is parsed', L.cap === 'Save file is too large.' && L.capMB === 256, L);
ok(`the limits grow with the map: ${L.many.entities.toLocaleString('en-US')} entities on a 200 map load (format 1 stopped at 100,000), and a 480 map allows ${L.c480.entities.toLocaleString('en-US')}`, L.many.parsed === L.many.entities && L.c480.entities >= 4 * 480 * 480 && L.c480.nodes >= 8 * 480 * 480 && L.c256.entities >= 100000, L);

// ---------- 6. format 1: today's fixture loads unchanged, older ones get the AI stagger once ----------
const dir = path.join(__dirname, 'fixtures/saves'), load = f => JSON.stringify(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()).save);
const S = (() => {
  const h = harness(); h.c.__old = load('2026-10-15-a2e8c0f-before-tactics.json.gz'); h.c.__new = load('2026-10-20-phase3-final-v1.json.gz');
  return JSON.parse(h.run(`(() => {
    const accOf = text => { const f = JSON.parse(text), d = MatchSave.decode(f.graph, MatchSave.caps(256)); return d.world.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null); };
    const out = { oldFile: accOf(__old), newFile: accOf(__new) };
    MatchSave.restore(__old); out.oldLoaded = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    const v2 = MatchSave.serialize(); MatchSave.restore(v2); out.oldAgain = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    MatchSave.restore(__new); out.newLoaded = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    return JSON.stringify(out);
  })()`));
})();
ok(`a format 1 save from before the AI stagger (AI acc ${S.oldFile.slice(1).join(', ')}) loads staggered (${S.oldLoaded.slice(1).join(', ')}), and its format 2 save loads without a second stagger`, S.oldFile[1] === S.oldFile[2] && S.oldLoaded[1] !== S.oldLoaded[2] && JSON.stringify(S.oldAgain) === JSON.stringify(S.oldLoaded), S);
ok(`a format 1 save from today's build keeps its AI phases (${S.newFile.slice(1).join(', ')})`, JSON.stringify(S.newLoaded) === JSON.stringify(S.newFile), S);

// ---------- 7. a stale occupancy id: cleared on loading, never written by the pathfinding graph ----------
const B = JSON.parse(run(`(() => {
  match(96, 5, 'land', 2, 0);
  // an entity gone from the lists without its tile cleared, as an older build could leave it
  const tree = W.list.find(e => e.type === 'tree'), i = W.map.idx(tree.x, tree.y), id = tree.id;
  W.list.splice(W.list.indexOf(tree), 1); W.ents.delete(id); idxRebuild();
  const before = W.map.blk[i];
  hpaDirtyAll(); hpaGraph('land'); hpaGraph('naval');   // a whole rebuild visits every tile
  const afterGraph = W.map.blk[i], open = hpaGraph('land').P[i];
  MatchSave.restore(MatchSave.serialize());
  return JSON.stringify({ before: before === id, afterGraph: afterGraph === id, graphOpen: open === 1, loaded: W.map.blk[i] });
})()`));
ok('building the pathfinding graph leaves a stale occupancy id in place (counting the tile open), and loading a save clears it', B.before && B.afterGraph && B.graphOpen && B.loaded === 0, B);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

Create `tests/resume.test.js`:
```js
// Resume equals continue: a match saved at tick T and resumed in a fresh page plays on exactly as the match that was
// never saved (signature() every game second for N seconds). Group-order state is not saved (session.js), so a save
// is compared from a moment when no group member is still waiting for its join (hpaPending() is 0); a save made while
// members wait resumes with them routing on their own, and everyone still arrives.   node tests/resume.test.js
const crypto = require('crypto'), harness = require('./engine-harness');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const start = s => `(() => {
  MAP_SIZES['x' + ${s.n}] = ${s.n};
  const spec = generateMapSpec({ size: 'x${s.n}', seed: ${s.seed}, mapType: '${s.type}', numPlayers: ${s.np} }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: ${s.np} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 3) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: ${s.seed}, size: 'x${s.n}', mapType: '${s.type}', fog: 'normal', startRes: 'high', startAge: ${s.age}, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
})()`;
const play = (run, sec) => run(`for (let i = 0; i < ${Math.round(sec * 20)} && !W.over; i++) worldTick(0.05)`);
const sigs = (run, sec) => { const out = []; for (let s = 0; s < sec; s++) { play(run, 1); out.push(crypto.createHash('sha1').update(run('signature()')).digest('hex').slice(0, 12)); } return out; };
const stale = run => +run(`(() => { let s = 0; const b = W.map.blk; for (let i = 0; i < b.length; i++) if (b[i] && !W.ents.get(b[i])) s++; return s; })()`);
// play to T (then on to the first tick no group member waits), save; A plays N more, B loads the save in a fresh page and plays N
function trial(s, T, N) {
  const A = harness(); A.run(start(s)); play(A.run, T);
  let waited = 0; while (+A.run('hpaPending()') > 0 && waited < 40) { play(A.run, 0.05); waited++; }
  const text = A.run('W.spectate = false; const __t = MatchSave.serialize(); W.spectate = true; __t');
  const staleT = stale(A.run), sa = sigs(A.run, N), staleN = stale(A.run);
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save); W.spectate = true;');
  const sb = sigs(B.run, N), first = sa.findIndex((h, i) => h !== sb[i]);
  return { T, N, waited, chars: text.length, firstDifferentSecond: first, staleT, staleN, a: sa.slice(-2), b: sb.slice(-2) };
}
const S1 = trial({ n: 80, seed: 7, type: 'coastal', np: 3, age: 2 }, 150, 60);
ok(`80 x 80 coastal, 3 AI players: saved at ${S1.T} s and resumed, the match plays ${S1.N} s exactly as the one never saved`, S1.firstDifferentSecond === -1 && S1.staleT === 0 && S1.staleN === 0, S1);
const S2 = trial({ n: 100, seed: 11, type: 'land', np: 4, age: 1 }, 240, 60);
ok(`100 x 100 land, 4 AI players: saved at ${S2.T} s and resumed, the match plays ${S2.N} s exactly as the one never saved`, S2.firstDifferentSecond === -1 && S2.staleT === 0 && S2.staleN === 0, S2);
ok('no entity removal in these matches left a stale occupancy id (the case loading clears)', S1.staleT + S1.staleN + S2.staleT + S2.staleN === 0, { S1: [S1.staleT, S1.staleN], S2: [S2.staleT, S2.staleN] });

// ---------- a 40-knight order saved while its members wait for their join, and once they have joined ----------
const knightScene = `(() => {
  MAP_SIZES.x160 = 160;
  const spec = generateMapSpec({ size: 'x160', seed: 33, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [0, 1].map(i => ({ name: 'P' + i, civ: ['franks', 'turks'][i], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, size: 'x160', mapType: 'land', fog: 'none', startRes: 'high', startAge: 2, rules: currentRules() });
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
  const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p.x + 0.5, p.y + 0.5)); }
  globalThis.__ids = us.map(u => u.id);
  orderMove(us, b.x + 2, b.y + 8);
})()`;
const doneIn = (run, max) => +run(`(() => { let t = 0; const us = __ids.map(id => ent(id)); while (t < ${max} && us.some(u => u && u.order)) { worldTick(0.05); t += 0.05; } return us.every(u => u && !u.order) ? +t.toFixed(1) : -1; })()`);
const K = (() => {
  const A = harness(); A.run(knightScene);
  const pending = +A.run('hpaPending()'), text = A.run('MatchSave.serialize()');
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save); globalThis.__ids = W.list.filter(e => e.type === "knight").map(e => e.id);');
  const own = B.run(`(() => { worldTick(0.05); return HPA.stats.shared === 0 && __ids.every(id => ent(id).path && ent(id).path.length); })()`);
  const sa = sigs(A.run, 3), sb = sigs(B.run, 3);
  return { pending, own, differs: sa.join() !== sb.join(), a: doneIn(A.run, 200), b: doneIn(B.run, 200) };
})();
ok(`a save made while the 40 members wait for their join (${K.pending} waiting) resumes with every knight routing on its own, and all 40 still arrive (${K.a} s uninterrupted, ${K.b} s resumed)`, K.pending === 40 && K.own && K.a > 0 && K.b > 0, K);
const J = (() => {
  const A = harness(); A.run(knightScene);
  let ticks = 0; while (+A.run('hpaPending()') > 0 && ticks < 40) { play(A.run, 0.05); ticks++; }
  const text = A.run('MatchSave.serialize()'), sa = sigs(A.run, 30);
  const B = harness(); B.c.__save = text; B.run('MatchSave.restore(__save)');
  const sb = sigs(B.run, 30);
  return { ticks, firstDifferentSecond: sa.findIndex((h, i) => h !== sb[i]) };
})();
ok(`saved once every member has joined (${J.ticks} ticks after the click), the knights' march resumes exactly as the uninterrupted one for 30 s`, J.ticks > 0 && J.firstDifferentSecond === -1, J);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

Run: `node tests/save-v2.test.js`
Expected: exit status 1, with `ReferenceError: rleEncode is not defined`.
Run: `node tests/resume.test.js`
Expected: exit status 1, with `ReferenceError: hpaPending is not defined`.

- [ ] **Step 3: The codecs**

Create `game/js/codec.js`:
```js
// ===== Codecs for saves and maps: typed arrays as run-length bytes in base64 =====
// Loaded before map.js. Plain functions with no game state, so tests and tools can use them on their own.
// - rleEncode / rleDecode: PackBits run-length bytes. A control byte c below 128 is followed by c + 1 literal bytes;
//   c of 128 or more repeats the next byte c - 125 times (3 to 130). Map layers, fog and occupancy are long runs.
// - b64Encode / b64Decode: standard base64 with padding, in plain JS (the node test harness has no btoa).
// - packArray / unpackArray: a typed array as { t, n, d }: its type name, length and base64 run-length bytes
//   (little-endian, as every browser and node store them).
'use strict';
const CODEC = { cap: 256 * 1024 * 1024 };   // sanity cap on any save or map text, file or inflated file: 256 MB
const CODEC_TYPES = { Uint8Array, Int16Array, Int32Array, Uint32Array, Float32Array };   // the typed arrays a save may hold (as in v1)
function rleEncode(src) {
  const n = src.length, out = new Uint8Array(n + Math.ceil(n / 128) + 2);
  let o = 0, i = 0;
  while (i < n) {
    let r = 1; const v = src[i];
    while (i + r < n && r < 130 && src[i + r] === v) r++;
    if (r >= 3) { out[o++] = r + 125; out[o++] = v; i += r; continue; }
    let j = i;   // a literal run: up to 128 bytes, ending where a run of 3 equal bytes starts
    while (j < n && j - i < 128 && !(j + 2 < n && src[j] === src[j + 1] && src[j] === src[j + 2])) j++;
    out[o++] = j - i - 1; out.set(src.subarray(i, j), o); o += j - i; i = j;
  }
  return out.slice(0, o);
}
function rleDecode(src, len) {
  const out = new Uint8Array(len);
  let o = 0, i = 0;
  while (i < src.length) {
    const c = src[i++];
    if (c < 128) {
      const L = c + 1; if (i + L > src.length || o + L > len) throw new Error('Invalid run-length data.');
      out.set(src.subarray(i, i + L), o); i += L; o += L;
    } else {
      const L = c - 125; if (i >= src.length || o + L > len) throw new Error('Invalid run-length data.');
      out.fill(src[i++], o, o + L); o += L;
    }
  }
  if (o !== len) throw new Error('Invalid run-length data.');
  return out;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_CODE = Uint8Array.from(B64, c => c.charCodeAt(0));
const B64_REV = (() => { const r = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) r[B64.charCodeAt(i)] = i; return r; })();
function b64Encode(b) {
  const n = b.length, CH = 3 * 4096, codes = new Uint16Array(4 * 4096), out = [];
  for (let s = 0; s < n; s += CH) {
    const e = Math.min(n, s + CH); let k = 0, i = s;
    for (; i + 2 < e; i += 3) { const v = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]; codes[k++] = B64_CODE[v >> 18]; codes[k++] = B64_CODE[(v >> 12) & 63]; codes[k++] = B64_CODE[(v >> 6) & 63]; codes[k++] = B64_CODE[v & 63]; }
    if (i < e) {   // the last 1 or 2 bytes (only in the last chunk: CH is a multiple of 3)
      const two = i + 1 < e, v = (b[i] << 16) | (two ? b[i + 1] << 8 : 0);
      codes[k++] = B64_CODE[v >> 18]; codes[k++] = B64_CODE[(v >> 12) & 63]; codes[k++] = two ? B64_CODE[(v >> 6) & 63] : 61; codes[k++] = 61;
    }
    out.push(String.fromCharCode.apply(null, codes.subarray(0, k)));
  }
  return out.join('');
}
function b64Decode(s) {
  if (typeof s !== 'string' || s.length % 4) throw new Error('Invalid base64 data.');
  const L = s.length, pad = L && s.charCodeAt(L - 1) === 61 ? (s.charCodeAt(L - 2) === 61 ? 2 : 1) : 0, n = L / 4 * 3 - pad, out = new Uint8Array(n);
  const at = i => { const c = s.charCodeAt(i), v = c < 128 ? B64_REV[c] : -1; if (v < 0) throw new Error('Invalid base64 data.'); return v; };
  let o = 0;
  for (let i = 0; i < L; i += 4) {
    const last = i + 4 === L, c3 = last && pad === 2 ? 0 : at(i + 2), c4 = last && pad ? 0 : at(i + 3);
    const v = (at(i) << 18) | (at(i + 1) << 12) | (c3 << 6) | c4;
    out[o++] = v >> 16; if (o < n) out[o++] = (v >> 8) & 255; if (o < n) out[o++] = v & 255;
  }
  return out;
}
function packArray(a) {
  const t = a.constructor.name;
  if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, t)) throw new Error('Cannot save a ' + t + '.');
  return { t, n: a.length, d: b64Encode(rleEncode(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))) };
}
function unpackArray(p, maxLen) {
  if (!p || typeof p !== 'object' || !Object.prototype.hasOwnProperty.call(CODEC_TYPES, p.t) || !Number.isInteger(p.n) || p.n < 0 || p.n > maxLen || typeof p.d !== 'string') throw new Error('Invalid numeric layer.');
  const Type = CODEC_TYPES[p.t], a = new Type(rleDecode(b64Decode(p.d), p.n * Type.BYTES_PER_ELEMENT).buffer);
  if (Type === Float32Array) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('Invalid numeric layer.');
  return a;
}
```

In `game/index.html`, replace:
```html
<script src="js/store.js"></script>
```
with:
```html
<script src="js/codec.js"></script>
<script src="js/store.js"></script>
```

In `game/js/map.js`, replace:
```js
function mapLayers(map) {
  const out = {};
  for (const k of ['ter', 'elev', 'bridge', 'tun', 'trench', 'excavated']) if (map[k]) out[k] = Array.from(map[k]);
  return out;
}
```
with:
```js
const SPEC_LAYERS = ['ter', 'elev', 'bridge', 'tun', 'trench', 'excavated'];   // the per-tile layers a map spec may hold
function mapLayers(map) {
  const out = {};
  for (const k of SPEC_LAYERS) if (map[k]) out[k] = Array.from(map[k]);
  return out;
}
```

- [ ] **Step 4: Format 2 in session.js**

Replace the first 131 lines of `game/js/session.js` with the code below. The range runs from its first line, `// Versioned match persistence. References preserve shared jobs, entity links and AI/player cycles.`, through the `  },` that closes `parse(text) {`, which is the line just before `  restore(text) {`. Everything from `  restore(text) {` on stays.
```js
// Versioned match persistence. References preserve shared jobs, entity links and AI/player cycles.
// Format 2 (phase 4) writes every object once as a compact node: typed arrays (map layers, fog, occupancy) as base64
// run-length bytes (codec.js), objects as a shape (their prototype and keys, listed once) plus their values, and the
// generated map's spec as the options that regenerate it. Format 1 saves and exports still load, and are staggered
// once on the way in (MatchSave.staggerAI).
// Never saved, by design: the pathfinding graph and the entity index (rebuilt on load), HPA.enabled (follows the URL),
// and group-order state (hpa.js HPA_GROUP: a member still waiting for its join when the match is saved routes on its own
// after loading, so a resumed match equals an uninterrupted one only from a moment when no member is waiting).
'use strict';
const MAP_DERIVED = ['vh', 'landReg', 'waterReg', '_wb'];   // GameMap fields rebuilt on load (computeVH, computeRegions)
const MatchSave = {
  version: 2, key: 'aor_match_v1', autoKey: 'aor_autosave_v1', interval: 60,
  // Limits for a save of a map of side n: graph nodes, values in one node, entities and typed-array length. They are
  // never below format 1's fixed limits (200,000 nodes, 1,000,000 values, 100,000 entities) and grow with the map.
  caps(n) { const a = n * n; return { nodes: Math.max(200000, 8 * a), values: Math.max(1000000, 4 * a), entities: Math.max(100000, 4 * a), layer: Math.max(65536, a) }; },
  // ---------- format 1 (read only) ----------
  decode(graph, caps = this.caps(256)) {
    if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > caps.nodes) throw new Error('Invalid save graph.');
    const types = { Uint8Array, Int16Array, Int32Array, Uint32Array, Float32Array };
    const prototypes = { Object: Object.prototype, GameMap: GameMap.prototype, Player: Player.prototype, AIPlayer: AIPlayer.prototype };
    const objects = graph.nodes.map(n => {
      if (!n || !Array.isArray(n.data) || n.data.length > caps.values) throw new Error('Invalid save node.');
      if (Object.prototype.hasOwnProperty.call(types, n.type)) {
        if (n.data.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new Error('Invalid numeric layer.');
        return new types[n.type](n.data);
      }
      if (n.type === 'Map') return new Map(); if (n.type === 'Set') return new Set(); if (n.type === 'Array') return [];
      if (!Object.prototype.hasOwnProperty.call(prototypes, n.type)) throw new Error('Unknown save type.');
      return Object.create(prototypes[n.type]);
    });
    const read = v => {
      if (!v || typeof v !== 'object') return v;
      if (v.undef === true) return undefined;
      if (!Number.isInteger(v.ref) || v.ref < 0 || v.ref >= objects.length) throw new Error('Invalid save reference.');
      return objects[v.ref];
    };
    graph.nodes.forEach((node, i) => {
      const o = objects[i]; if (Object.prototype.hasOwnProperty.call(types, node.type)) return;
      if (node.type === 'Array') { for (const v of node.data) o.push(read(v)); }
      else if (node.type === 'Set') { for (const v of node.data) o.add(read(v)); }
      else {
        for (const pair of node.data) {
          if (!Array.isArray(pair) || pair.length !== 2) throw new Error('Invalid save entry.');
          if (node.type === 'Map') o.set(read(pair[0]), read(pair[1]));
          else {
            const [k, v] = pair;
            if (typeof k !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(k) || typeof prototypes[node.type][k] === 'function') throw new Error('Invalid save property.');
            Object.defineProperty(o, k, { value: read(v), enumerable: true, writable: true, configurable: true });
          }
        }
      }
    });
    return read(graph.root);
  },
  // the map side a format 1 graph holds (root -> world -> n), for its limits; 256 when it cannot be read
  v1Size(graph) {
    try { const root = graph.nodes[graph.root.ref], w = graph.nodes[root.data.find(p => p[0] === 'world')[1].ref]; return w.data.find(p => p[0] === 'n')[1]; } catch (e) { return 256; }
  },
  // ---------- format 2 ----------
  // The graph is { root, shapes, nodes }. Every object is a node, so shared objects and cycles survive:
  //   a typed array -> [type name, length, base64 run-length bytes]
  //   an Array -> ['A', v...], a Set -> ['S', v...], a Map -> ['M', key, value, key, value...]
  //   any other object -> [shape, v...], where shapes[shape] = [prototype name, key...] ('Object', 'GameMap', 'Player', 'AIPlayer')
  // and a value is a number, string, boolean or null as itself, [i] for node i, or [] for undefined.
  // walk(value, out, slice) visits the objects breadth first and fills out.root, out.shapes and out.nodes; a typed array's
  // node holds a copy of it, which pack() turns into text. Both are generators: given slice (ms) they yield when a slice
  // is used up (the sliced autosave); with slice 0 they run to the end in one go.
  *walk(value, out, slice = 0) {
    const nodes = [], seen = new Map(), shapes = [], shapeOf = new Map(), queue = [];
    const val = v => {
      if (v === undefined) return [];
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('Cannot save non-finite state.'); return v; }
      if (typeof v !== 'object') throw new Error('Cannot save a pending function.');
      let id = seen.get(v); if (id === undefined) { id = nodes.length; seen.set(v, id); nodes.push(null); queue.push(v); }
      return [id];
    };
    out.root = val(value);
    let t0 = performance.now();
    for (let q = 0; q < queue.length; q++) {
      const v = queue[q]; let node;
      if (ArrayBuffer.isView(v)) {
        if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, v.constructor.name)) throw new Error('Cannot save a ' + v.constructor.name + '.');
        node = [v.constructor.name, v.length, v.slice()];
      } else if (v instanceof Map) { node = ['M']; for (const [k, x] of v) node.push(val(k), val(x)); }
      else if (v instanceof Set) { node = ['S']; for (const x of v) node.push(val(x)); }
      else if (Array.isArray(v)) {   // W.list holds every entity: a long array may span slices
        node = ['A'];
        for (let i = 0; i < v.length; i++) { node.push(val(v[i])); if (slice && (i & 4095) === 4095 && performance.now() - t0 > slice) { yield; t0 = performance.now(); } }
      }
      else {
        const type = v instanceof GameMap ? 'GameMap' : v instanceof Player ? 'Player' : typeof AIPlayer !== 'undefined' && v instanceof AIPlayer ? 'AIPlayer' : 'Object';
        const keys = type === 'GameMap' ? Object.keys(v).filter(k => !MAP_DERIVED.includes(k)) : Object.keys(v), sk = type + '\u0000' + keys.join('\u0000');
        let s = shapeOf.get(sk); if (s === undefined) { s = shapes.length; shapeOf.set(sk, s); shapes.push([type, ...keys]); }
        node = [s]; for (const k of keys) node.push(val(v[k]));
      }
      nodes[q] = node;
      if (slice && (q & 127) === 127 && performance.now() - t0 > slice) { yield; t0 = performance.now(); }
    }
    out.nodes = nodes; out.shapes = shapes;
  },
  // Typed-array copies -> base64 run-length text. A layer is run-length coded in chunks of 192 KB (runs split at a chunk
  // edge decode back to back) and turned into base64 in pieces of a multiple of 3 bytes, so it may span slices; the
  // one-shot save codes it the same way.
  *pack(out, slice = 0) {
    const CH = 196608;
    let t0 = performance.now();
    const due = () => slice && performance.now() - t0 > slice;
    for (const node of out.nodes) {
      if (typeof node[0] !== 'string' || !ArrayBuffer.isView(node[2])) continue;
      const a = node[2], bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), runs = [];
      let len = 0;
      for (let i = 0; i < bytes.length || !runs.length; i += CH) { const r = rleEncode(bytes.subarray(i, i + CH)); runs.push(r); len += r.length; if (due()) { yield; t0 = performance.now(); } }
      const all = runs.length === 1 ? runs[0] : new Uint8Array(len), text = [];
      if (runs.length > 1) { let o = 0; for (const r of runs) { all.set(r, o); o += r.length; } }
      for (let i = 0; i < all.length || !text.length; i += CH) { text.push(b64Encode(all.subarray(i, i + CH))); if (due()) { yield; t0 = performance.now(); } }
      node[2] = text.join('');
    }
  },
  decode2(graph, caps) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.shapes) || graph.nodes.length > caps.nodes || graph.shapes.length > caps.nodes) throw new Error('Invalid save graph.');
    const prototypes = { Object: Object.prototype, GameMap: GameMap.prototype, Player: Player.prototype, AIPlayer: AIPlayer.prototype };
    for (const s of graph.shapes) {
      if (!Array.isArray(s) || s.length > caps.values || !Object.prototype.hasOwnProperty.call(prototypes, s[0])) throw new Error('Unknown save type.');
      for (let i = 1; i < s.length; i++) { const k = s[i]; if (typeof k !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(k) || typeof prototypes[s[0]][k] === 'function') throw new Error('Invalid save property.'); }
    }
    const objects = graph.nodes.map(n => {
      if (!Array.isArray(n) || !n.length || n.length > caps.values + 1) throw new Error('Invalid save node.');
      const h = n[0];
      if (typeof h === 'number') { const s = graph.shapes[h]; if (!s || n.length !== s.length) throw new Error('Invalid save node.'); return Object.create(prototypes[s[0]]); }
      if (h === 'A') return []; if (h === 'S') return new Set(); if (h === 'M') { if (n.length % 2 !== 1) throw new Error('Invalid save node.'); return new Map(); }
      if (Object.prototype.hasOwnProperty.call(CODEC_TYPES, h)) { if (n.length !== 3) throw new Error('Invalid numeric layer.'); return unpackArray({ t: h, n: n[1], d: n[2] }, caps.layer); }
      throw new Error('Unknown save type.');
    });
    const read = v => {
      if (v === null || typeof v !== 'object') return v;
      if (!Array.isArray(v) || v.length > 1) throw new Error('Invalid save reference.');
      if (!v.length) return undefined;
      if (!Number.isInteger(v[0]) || v[0] < 0 || v[0] >= objects.length) throw new Error('Invalid save reference.');
      return objects[v[0]];
    };
    graph.nodes.forEach((n, i) => {
      const o = objects[i], h = n[0];
      if (typeof h === 'number') { const keys = graph.shapes[h]; for (let k = 1; k < n.length; k++) Object.defineProperty(o, keys[k], { value: read(n[k]), enumerable: true, writable: true, configurable: true }); }
      else if (h === 'A') { for (let k = 1; k < n.length; k++) o.push(read(n[k])); }
      else if (h === 'S') { for (let k = 1; k < n.length; k++) o.add(read(n[k])); }
      else if (h === 'M') { for (let k = 1; k < n.length; k += 2) o.set(read(n[k]), read(n[k + 1])); }
    });
    return read(graph.root);
  },
  // A generated map is saved as the options that regenerate its spec (only Restart reads it), with its name and player
  // starts; an editor map keeps its layers (as typed arrays, packed like the live ones) and objects.
  specStub(w) {
    const s = w.spec, st = w.settings || {};
    if (!s) return s;
    const generated = st.mapType !== 'custom' && (MAP_TYPE_NAMES[st.mapType] || (typeof REAL_MAPS !== 'undefined' && REAL_MAPS[st.mapType])) && Number.isFinite(st.seed) && st.rules;
    if (generated) return { regen: { size: w.n, seed: st.seed, mapType: st.mapType, numPlayers: w.players.length - 1, rivers: !!st.rules.rivers }, name: s.name, players: s.players };
    const out = Object.assign({}, s); for (const k of SPEC_LAYERS) if (Array.isArray(s[k])) out[k] = Uint8Array.from(s[k]);
    return out;
  },
  // the full spec of a stub (Restart): regenerated with the river rule it was made with, or the layers as plain arrays
  specOf(s) {
    if (!s) return s;
    if (s.regen) {
      const r = WMOD.rivers; WMOD.rivers = s.regen.rivers;
      try { return generateMapSpec({ size: s.regen.size, seed: s.regen.seed, mapType: s.regen.mapType, numPlayers: s.regen.numPlayers }); } finally { WMOD.rivers = r; }
    }
    const out = Object.assign({}, s); for (const k of SPEC_LAYERS) if (ArrayBuffer.isView(s[k])) out[k] = Array.from(s[k]);
    return out;
  },
  // Phase 2 starts each AI player's once-a-second update on its own tick. A format 1 save from before that has every
  // AI on the same tick (equal acc): stagger them once, on the way into format 2. Staggered saves are left alone.
  staggerAI(w) {
    const ais = w.players.slice(1).map(p => p.ai).filter(Boolean);
    if (ais.length < 2 || new Set(ais.map(a => a.acc)).size === ais.length) return false;
    const slots = Math.max(1, w.players.length - 1);
    for (const a of ais) a.acc = ((a.p.id - 1) % slots) / slots;
    return true;
  },
  // The save's root value and its file head (walk and pack turn the value into the graph): of the running match, or,
  // given from (what parse() returned for an older save), of that save, without loading it.
  parts(w = W, from = null) {
    if (!from) {
      if (!W || W.menu || W.editor || W.over) throw new Error('Start an active match before saving.');
      if (typeof terraFlush === 'function') terraFlush();
    }
    const omit = new Set(['rng', 'instantFor', 'grid', 'ents', 'fx', 'decals', 'missFx', 'msgs']);
    const world = Object.fromEntries(Object.entries(w).filter(([k]) => !omit.has(k)));
    world.spec = this.specStub(w);
    const view = from ? from.view : typeof R !== 'undefined' ? { ...R.cam } : null;
    const ui = from ? from.ui : typeof UI !== 'undefined' ? { groups: Object.fromEntries(Object.entries(UI.groups || {}).map(([k, es]) => [k, es.map(e => e.id)])), selection: (UI.selection || []).map(e => e.id), fromEditor: !!UI.fromEditor, fromEditorName: UI.fromEditorName } : {};
    const p = w.players[w.humanId];
    const meta = {
      civ: p && typeof CIVS === 'object' && CIVS[p.civ] ? CIVS[p.civ].name : (p ? p.civ : ''),
      age: p && typeof AGES !== 'undefined' ? AGES[p.age] : '',
      mapLabel: (w.spec && w.spec.name) || (w.settings && w.settings.mapType) || 'Map',
      time: w.t | 0,
      players: w.players.length - 1,
    };
    return { head: { format: 'age-of-realms-match', version: this.version, savedAt: new Date().toISOString(), n: w.n, meta }, value: { world, rngState: from ? from.rngState : w.rng.state(), rules: from ? from.rules : currentRules(), view, ui } };
  },
  snapshot() {
    const { head, value } = this.parts(), out = {};
    for (const _ of this.walk(value, out)); for (const _ of this.pack(out));
    this.lastHead = head;
    return { ...head, graph: { root: out.root, shapes: out.shapes, nodes: out.nodes } };
  },
  serialize() { return JSON.stringify(this.snapshot()); },
  parse(text) {
    if (typeof text !== 'string' || text.length > CODEC.cap) throw new Error('Save file is too large.');
    const file = JSON.parse(text);
    if (!file || file.format !== 'age-of-realms-match' || (file.version !== 1 && file.version !== 2)) throw new Error('Unsupported match save.');
    const n0 = file.version === 2 ? file.n : this.v1Size(file.graph);
    if (!Number.isInteger(n0) || n0 < 16 || n0 > 1024) throw new Error('Invalid match map or settings.');
    const caps = this.caps(n0);
    const data = file.version === 2 ? this.decode2(file.graph, caps) : this.decode(file.graph, caps), w = data && data.world;
    if (!w || !(w.map instanceof GameMap) || w.n !== n0 || !Array.isArray(w.players) || w.players.length < 3 || w.players.length > 9 || !Array.isArray(w.list) || w.list.length > caps.entities || !Number.isFinite(w.t) || w.t < 0 || !Number.isInteger(w.tick) || w.tick < 0 || !Number.isInteger(data.rngState) || w.menu || w.editor || w.over) throw new Error('Invalid match state.');
    const spec = { n: w.n, ...mapLayers(w.map), players: w.players.slice(1).map(p => ({ civ: p.civ })), objects: [] };
    const errors = validateMapSpec(spec); if (errors.length || w.map.n !== w.n || !w.settings || !Number.isInteger(w.humanId) || !w.players[w.humanId]) throw new Error('Invalid match map or settings.');
    if (!w.settings.players || w.settings.players.length !== w.players.length - 1 || !w.map.blk || w.map.blk.length !== w.n * w.n) throw new Error('Invalid match players or occupancy.');
    if (!(w.map.ter instanceof Uint8Array) || !(w.map.elev instanceof Uint8Array) || !(w.map.blk instanceof Int32Array) || !(w.map.deco instanceof Uint8Array) || w.map.deco.length !== w.n * w.n) throw new Error('Invalid saved map layers.');
    if (!data.ui || !Array.isArray(data.ui.selection) || !data.ui.groups || Object.values(data.ui.groups).some(ids => !Array.isArray(ids) || ids.some(id => !Number.isInteger(id)))) throw new Error('Invalid saved selection or groups.');
    for (const [i, p] of w.players.slice(1).entries()) {
      if (p.res && p.res.coal === undefined) p.res.coal = 0;
      if (p.gather && p.gather.coal === undefined) p.gather.coal = 1;
      if (p.id !== i + 1 || typeof p.name !== 'string' || p.name.length > 120 || !p.color || ['c', 'd', 'l'].some(k => !/^#[\da-f]{3,8}$/i.test(p.color[k]))) throw new Error('Invalid saved player identity.');
      if (!(p instanceof Player) || !(p.techs instanceof Set) || !(p.researching instanceof Set) || !p.explored || p.explored.length !== w.n * w.n || !p.visible || p.visible.length !== w.n * w.n || !p.res || RES.some(k => !Number.isFinite(p.res[k]) || p.res[k] < 0) || !p.color || !/^#[\da-f]{3,8}$/i.test(p.color.c)) throw new Error('Invalid player state.');
      if (p.ai && (!(p.ai instanceof AIPlayer) || p.ai.p !== p)) throw new Error('Invalid AI state.');
    }
    const ids = new Set();
    for (const e of w.list) {
      if (!e || !Number.isInteger(e.id) || e.id < 1 || ids.has(e.id) || !Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isInteger(e.owner) || e.owner < 0 || e.owner >= w.players.length) throw new Error('Invalid entity state.');
      ids.add(e.id);
      const defs = e.kind === 'unit' ? UNITS : e.kind === 'bld' ? BUILDINGS : null;
      if (defs ? !Object.prototype.hasOwnProperty.call(defs, e.type) : !['res', 'relic'].includes(e.kind)) throw new Error('Unknown saved entity.');
      if (defs && (!Number.isFinite(e.hp) || !Number.isFinite(e.maxhp))) throw new Error('Invalid entity health.');
      if (e.depth !== undefined && (!Number.isInteger(e.depth) || e.depth < 0 || e.depth > 4 || (e.depth && !(e.kind === 'res' && ['coal', 'gold', 'stone'].includes(e.type))))) throw new Error('Invalid saved mine depth.');
      if (e.kind === 'unit' && (!Array.isArray(e.cargo) || (e.queue !== undefined && !Array.isArray(e.queue)) || (e.order && !['move', 'attack', 'attackmove', 'gather', 'farm', 'hunt', 'build', 'repair', 'garrison', 'board', 'heal', 'convert', 'relic', 'deposit', 'trade', 'unload', 'moveto', 'follow', 'dropoff', 'guard', 'terra'].includes(e.order.t)))) throw new Error('Invalid unit orders.');
      if (e.kind === 'bld' && (!Array.isArray(e.queue) || !Array.isArray(e.garrison) || !Array.isArray(e.relics))) throw new Error('Invalid building state.');
      if (e.kind === 'bld' && e.queue.some(q => !q || !['unit', 'tech'].includes(q.kind) || !Object.prototype.hasOwnProperty.call(q.kind === 'unit' ? UNITS : TECHS, q.id) || !Number.isFinite(q.t) || q.t < 0)) throw new Error('Invalid production queue.');
    }
    let maxId = 0; for (const id of ids) maxId = Math.max(maxId, id);
    if (!Number.isInteger(w.nextId) || w.nextId <= maxId) throw new Error('Invalid next entity ID.');
    if (w.timers && (!Array.isArray(w.timers) || w.timers.some(t => !Number.isFinite(t.at) || !t.action || t.action.type !== 'buildingArrow'))) throw new Error('Invalid pending action.');
    if (!Array.isArray(w.projs) || w.projs.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Invalid projectiles.');
    if (!data.rules || ['aging', 'veterans', 'thirst', 'terra', 'rivers', 'fishregen'].some(k => typeof data.rules[k] !== 'boolean') || !Number.isFinite(data.rules.lifeScale) || data.rules.lifeScale <= 0 || data.rules.lifeScale > 100) throw new Error('Invalid saved rules.');
    if (typeof data.rules.movement !== 'boolean' || !data.rules.commands || !data.rules.victory || COMMAND_RULE_KEYS.some(k => typeof data.rules.commands[k] !== 'boolean') || VICTORY_RULE_KEYS.some(k => typeof data.rules.victory[k] !== 'boolean') || ['wonderTime', 'relicTime'].some(k => !Number.isFinite(data.rules.victory[k]) || data.rules.victory[k] <= 0)) throw new Error('Invalid saved combat or victory rules.');
    // An occupancy id whose entity is gone (older builds could leave one): clear it before anything reads the layer, so
    // code that reads blk directly (freeTileNear, terra.js) and the pathfinding graph built at load agree.
    const blk = w.map.blk; for (let i = 0; i < blk.length; i++) if (blk[i] && !ids.has(blk[i])) blk[i] = 0;
    if (file.version === 1) this.staggerAI(w);
    w.rng = mulberry32(1); w.rng.restore(data.rngState);
    w.instantFor = p => !!(w.instant && p && p.id === w.humanId);
    w.ents = new Map(w.list.map(e => [e.id, e])); w.grid = new Map(); w.fx = []; w.decals = []; w.missFx = []; w.msgs = [];
    w.map.vh = new Float32Array((w.n + 1) ** 2); w.map.landReg = new Int32Array(w.n ** 2); w.map.waterReg = new Int32Array(w.n ** 2);
    delete w.map._wb;
    const mapVersion=w.map.version;
    w.map.computeVH(); w.map.computeRegions();
    // Reconstructing derived height data is not a terrain edit; cached routes keep their revision.
    if(Number.isSafeInteger(mapVersion)&&mapVersion>=0)w.map.version=mapVersion;
    return data;
  },
```

In `game/js/ui.js`, replace:
```js
function restartGame() { const s = UI.lastSettings, spec = JSON.parse(JSON.stringify(UI.lastSpec)); closeModal(); startGame(spec, s, UI.fromEditor); }
```
with:
```js
function restartGame() { const s = UI.lastSettings, spec = JSON.parse(JSON.stringify(MatchSave.specOf(UI.lastSpec))); closeModal(); startGame(spec, s, UI.fromEditor); }   // a resumed save may hold only the options that regenerate its map (session.js specStub)
```

- [ ] **Step 5: The graph never writes the map; who still waits to join**

In `game/js/hpa.js`, replace:
```js
function hpaPassFn(cls) {
  const map = W.map;
  if (cls === 'naval') return passNaval();
  const base = passLand(0), tr = cls === 'mounted' ? map.trench : null;
  return i => {
    if (tr && tr[i]) return false;
    if (base(i)) return true;
    const b = map.blk[i], e = b ? W.ents.get(b) : null;
    return !!(e && e.type === 'gate' && e.built);
  };
}
```
with:
```js
// Building the graph never writes the map: passLand and passNaval clear an occupancy id whose entity is gone when
// they meet one, and a graph built at load (hpaWarm) visits every tile, so a resumed match would lose such ids that an
// uninterrupted one keeps. The id is put back; the graph counts the tile as open, as passLand does.
function hpaPassFn(cls) {
  const map = W.map, blk = map.blk;
  const keep = f => i => { const b = blk[i], r = f(i); if (blk[i] !== b) blk[i] = b; return r; };
  if (cls === 'naval') return keep(passNaval());
  const base = keep(passLand(0)), tr = cls === 'mounted' ? map.trench : null;
  return i => {
    if (tr && tr[i]) return false;
    if (base(i)) return true;
    const b = blk[i], e = b ? W.ents.get(b) : null;
    return !!(e && e.type === 'gate' && e.built);
  };
}
```

In `game/js/hpa.js`, replace:
```js
// Will u's next path request take its group's route?
function hpaShares(u) { const r = HPA_GROUP.get(u); return !!(r && !r.used && !r.g.solo && u.order === r.o); }
```
with:
```js
// Will u's next path request take its group's route?
function hpaShares(u) { const r = HPA_GROUP.get(u); return !!(r && !r.used && !r.g.solo && u.order === r.o); }
// The units still waiting to join their group's route. Group state is not saved: a save made while this is above 0
// resumes with those members routing on their own (session.js).
function hpaPending() { let c = 0; for (const u of idxAll('unit')) if (hpaShares(u)) c++; return c; }
```

- [ ] **Step 6: The reliability checks against format 2**

Two checks build hostile payloads, and both now cover format 2. One gains two hostile format 2 payloads: a shape key `__proto__`, and a corrupt run-length layer. The other, the "engine methods" check, is rewritten for format 2's shapes.

In `tests/reliability.test.js`, replace:
```js
  assert.equal(run(`(() => { const old=W; const good=MatchSave.snapshot(); let rejected=0; const payloads=[JSON.stringify({...good,version:9}),'{',JSON.stringify({format:'age-of-realms-match',version:1,graph:{nodes:[{type:'Object',data:[['__proto__',{ref:0}]]}],root:{ref:0}}})]; for(const text of payloads)try{MatchSave.restore(text)}catch(e){rejected++} return rejected===3&&W===old&&({}).polluted===undefined; })()`), true);
```
with:
```js
  assert.equal(run(`(() => { const old=W; const good=MatchSave.snapshot(); let rejected=0; const payloads=[JSON.stringify({...good,version:9}),'{',JSON.stringify({format:'age-of-realms-match',version:1,graph:{nodes:[{type:'Object',data:[['__proto__',{ref:0}]]}],root:{ref:0}}}),JSON.stringify({format:'age-of-realms-match',version:2,n:64,graph:{shapes:[['Object','__proto__']],nodes:[[0,[0]]],root:[0]}}),JSON.stringify({format:'age-of-realms-match',version:2,n:64,graph:{shapes:[],nodes:[['Uint8Array',4,'AAAA']],root:[0]}})]; for(const text of payloads)try{MatchSave.restore(text)}catch(e){rejected++} return rejected===5&&W===old&&({}).polluted===undefined; })()`), true);
```

In `tests/reliability.test.js`, replace:
```js
  assert.equal(run(`(() => { const old=W, s=MatchSave.snapshot(); const node=s.graph.nodes.find(n=>n.type==='GameMap');node.data.push(['computeRegions','broken']);try{MatchSave.restore(JSON.stringify(s));return false}catch(e){return W===old} })()`), true);
```
with:
```js
  assert.equal(run(`(() => { const old=W, s=MatchSave.snapshot(); const gi=s.graph.shapes.findIndex(sh=>sh[0]==='GameMap'); s.graph.shapes[gi].push('computeRegions'); s.graph.nodes.find(n=>n[0]===gi).push('broken'); try{MatchSave.restore(JSON.stringify(s));return false}catch(e){return W===old} })()`), true);
```

- [ ] **Step 7: Run the save suites**

Run: `node tests/save-v2.test.js`
Expected (about 40 s; observed while planning):
```
PASS run-length bytes and base64 round trip on runs, noise and mixed arrays of every boundary length, and match the RFC 4648 vectors  {"rle":true,"b64":true,"vectors":true,"bad":9,"typed":true}
PASS malformed run-length data, base64, array types, lengths over the limit and non-finite floats are refused  {...}
PASS a 200 x 200 3-player match after 3 game minutes saves in format 2 (631,906 characters, format 1 needed about 3,170,000) and loads to exactly its own signature  {...}
PASS saving the loaded match again gives the same graph, node for node  {...}
PASS the generated map is saved as the options that regenerate it, with its name and starts  "name,players,regen"
PASS a generated map's spec regenerates exactly from its options (16 map types and river rules); an editor map keeps its own layers  {"n":16,"bad":[],"custom":true}
PASS a 480 x 480 match with 8 players saves in 3.86 M characters (at most 6 M) and loads to its own signature  {...}
PASS a save text over the sanity cap (CODEC.cap, 256 MB) is refused before it is parsed  {...}
PASS the limits grow with the map: 128,037 entities on a 200 map load (format 1 stopped at 100,000), and a 480 map allows 921,600  {...}
PASS a format 1 save from before the AI stagger (AI acc 0, 0) loads staggered (0.3333, 0.6667), and its format 2 save loads without a second stagger  {...}
PASS a format 1 save from today's build keeps its AI phases (0.3, 0.65)  {...}
PASS building the pathfinding graph leaves a stale occupancy id in place (counting the tile open), and loading a save clears it  {"before":true,"afterGraph":true,"graphOpen":true,"loaded":0}
12 passed, 0 failed
```
Run: `node tests/resume.test.js`
Expected (about 35 s; observed while planning):
```
PASS 80 x 80 coastal, 3 AI players: saved at 150 s and resumed, the match plays 60 s exactly as the one never saved  {"T":150,"N":60,"waited":0,...,"firstDifferentSecond":-1,"staleT":0,"staleN":0,...}
PASS 100 x 100 land, 4 AI players: saved at 240 s and resumed, the match plays 60 s exactly as the one never saved  {...,"firstDifferentSecond":-1,...}
PASS no entity removal in these matches left a stale occupancy id (the case loading clears)  {"S1":[0,0],"S2":[0,0]}
PASS a save made while the 40 members wait for their join (40 waiting) resumes with every knight routing on its own, and all 40 still arrive (55.3 s uninterrupted, 55.5 s resumed)  {"pending":40,"own":true,"differs":true,"a":55.3,"b":55.5}
PASS saved once every member has joined (3 ticks after the click), the knights' march resumes exactly as the uninterrupted one for 30 s  {"ticks":3,"firstDifferentSecond":-1}
5 passed, 0 failed
```
- **"Resume equals continue".** It held before this task too: at 91c0970, on these scenarios and three more (64 land 2p, 100 alpine 4p, 120 rivers 8p). No stale id ever occurred to make it diverge.
- **Stale ids.** The test above is the guard. The `blk` handling is the hardening for an id that does go stale.
- **The mid-join save** (`differs: true`) is the one difference by design.

Run `node tests/<name>.test.js` for save-compat, reliability, sim-signature, store, index, assist, eras and geography-geology.
Expected (observed while planning): `17`, `19`, `4`, `9`, `24`, `5`, `9` and `20` passed, each with `0 failed`. The signatures are unchanged.
Run: `npm run test:syntax`
Expected: `104 scripts passed syntax checks.`

- [ ] **Step 8: The browser specs that compare snapshots**

graphics, actors, art and geography compare `JSON.stringify(MatchSave.snapshot().graph)` before and after drawing, and assist and actors resume a `serialize()`d match. All of them work unchanged on format 2.
Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test graphics.spec.js actors.spec.js art.spec.js geography.spec.js assist.spec.js saves.spec.js`
Expected: every test passes. Then `git checkout -- assets/screenshots` if `git status --short` lists them.

- [ ] **Step 9: Commit**

```bash
git add game/js/codec.js game/js/session.js game/js/map.js game/js/hpa.js game/js/ui.js game/index.html tests/save-v2.test.js tests/resume.test.js tests/reliability.test.js
git commit -m "feat(saves): save format 2, compact and still reading format 1

Typed arrays are base64 run-length bytes, every object a shape plus its
values, and a generated map's spec the options that regenerate it. A
200 x 200 save shrinks from 3.17 M to 0.63 M characters, and a 480 x 480
8-player save is 4.1 M (format 1: 24.7 M, past its own 16e6 cap). The
limits grow with n under a 256 MB sanity cap. Format 1 loads exactly as
before (the new fixture's replay); a save from before phase 2 gets the AI
stagger once. Loading clears stale occupancy ids, and building the
pathfinding graph no longer writes the map. A resumed match plays on
exactly as the uninterrupted one; group-order state is not saved.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Save slots, the pause-free autosave, and gzip export and import

The old code had these limits:
- one manual save and one autosave, both in `localStorage` (session.js:138);
- a synchronous autosave every 60 game seconds, which stalled 165 ms at 400 (E§1.5);
- a message for the first failure only (session.js:197);
- plain-JSON export and import, refused over 16e6.

**Slots.** Manual saves go to slots `1`–`5`, and the autosave to `auto`, all in the `saves` store. A summary of each lives in `meta` as `save:<slot>`: savedAt, the head's meta, n, version and chars. The menus read only those summaries.
- **Save Match** opens a picker of the five slots in the existing modal style. Each button shows what the slot holds or "empty"; a click saves and returns to the game menu.
- **Load Match** lists the five slots and the autosave, with empty ones disabled, above the file import.

**The autosave: one snapshot, then the text in idle slices.** Nothing holds the simulation. `autosave()` runs in three steps:
1. **After the tick that started it** (a timeout), a rehearsal: `freeze()` on every 8th entity, thrown away, so that the snapshot's code is compiled when it runs (cold, it ran 2–3 times slower: 26 ms against 9 at 480). Pending terrain work (`terraFlush`) is done here too.
2. **On the next idle period, the snapshot** (`serializeSliced` → `freeze`), in one go, between two ticks:
   - typed arrays are copied, into the copies the last snapshot made where they fit (`MatchSave.spares`);
   - every object is copied with its prototype, its keys in order and its shared references; plain objects and arrays are copied whole (spread, `slice`), then their object values;
   - `W.list`'s **flat records** (plain objects holding only numbers, strings, booleans, null and undefined: the trees, mines and other resources, 98.8 % of the entities at 480) are not copied as objects. Their values go into one array, their keys into one list per shape, through a reader compiled per shape (`MatchSave.reader`), and the snapshot keeps the entity itself only as the identity that `walk()` numbers (`at()`).
3. **Then, while the match plays on**, one idle period per slice (`requestIdleCallback`, else a timeout): walk the snapshot into nodes, pack the layers, write the JSON.

- The text is `serialize()`'s at the moment of the snapshot, whatever the simulation and the player's input do meanwhile. So no save is ever dropped for a change during the slices.
- Slices aim at 6 ms (`MatchSave.sliceMs`): the walk (every 128 nodes, or 4096 items of a list), the packing and the JSON each end a slice before a step as long as their last one would take it past 6 ms.
- Every failure (quota, no storage, a value no save can hold) shows a message every time.

**Acceptance** (the roadmap, and the user's decision for this phase), measured in the browser in a live 8-player land match, 5 autosaves a size:
- the snapshot holds the game ≤ 8 ms at 200 and 256, as the median of 5 (hard): 4.9 and 6.8 ms while planning;
- at 480, the user accepted the measured value: 11.6 ms (the five: 16, 16.8, 11.6, 9.3 and 9.1 ms; three sessions of the same snapshot code gave medians of 9.7, 11.6 and 13.2 ms; see "Findings while planning"). ≤ 8 ms at 480 is a task for a later phase (dirty marks on changed resources; "After Task 5");
- no slice above 8 ms;
- the written save equals a one-shot `serialize()` at the snapshot's moment;
- no tick above 16 ms while it runs, at 256.

**gzip.**
- **Export Match** downloads `age-of-realms-match.json.gz` through `CompressionStream`, or plain JSON where that is missing.
- **Import** reads gzip or plain files through `DecompressionStream`, and refuses anything that is, or inflates past, `CODEC.cap`.

**Files:**
- Modify:
  - `game/js/codec.js`: `gzipText`, `readTextFile`;
  - `game/js/session.js`: `walk`'s snapshot mode and slicing, `pack`'s slicing, slots, `freeze`, `serializeSliced`, `autosave`, `openLoad`, `openSave`, `export`, the autosave hook and the game-menu buttons;
  - `tests/reliability.test.js`: the old autosave check leaves;
  - `tests/browser/game.spec.js`: the slot picker;
  - `tests/browser/maps-perf.spec.js`: `measureAutosave`.
- Create: `tests/autosave.test.js`.
- Extend: `tests/browser/saves.spec.js`.

**Interfaces:**
- Consumes: `Store` (Task 1); `walk`, `pack`, `parts`, `serialize` and `parse` (Task 2).
- Produces:
  - `MatchSave.slots`;
  - `saveTo(slot, text, head)`, `loadFrom(slot)` and `slotInfos() → { '1'…'5', auto: summary | null }`;
  - `slotLabel(slot, info)`, `openSave()` and `openLoad()` (both async);
  - `freeze(value, W.list, W.nextId) → snap { root, items, shape, start, shapes, vals, at(v), flat, release() }`, and `walk(value, out, slice, snap)`;
  - `reader(keys)`, `slowReader(keys)`, `flatPass(...)`, `rehearse()`, `MatchSave.spares`, `bufs` and `readers`;
  - `serializeSliced() → Promise<string>`, `autosave() → Promise<boolean>`;
  - `MatchSave.busy`, `stats` `{ tick, snapMs, flat, entities, slices, ms, chars }` and `sliceMs`;
  - `gzipText(text) → Promise<Blob>` and `readTextFile(file, cap) → Promise<string>`.
  - Task 5 uses `saveTo`, `loadFrom` and `slotInfos`.

- [ ] **Step 1: Write the failing test**

Create `tests/autosave.test.js`:
```js
// Saves in IndexedDB (store.js): five manual slots and the autosave, the autosave's snapshot and slices (session.js), a
// message for every failure, and gzip export and import (codec.js), against the shims of tests/fake-idb.js.
//   node tests/autosave.test.js
const harness = require('./engine-harness');
const { fakeIndexedDB } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
// a context with storage, timers (the slices wait for setTimeout, as without requestIdleCallback) and the stream APIs
function page(idb) {
  const h = harness();
  Object.assign(h.c, { indexedDB: idb, setTimeout, clearTimeout, Blob, Response, CompressionStream, DecompressionStream, TextDecoderStream });
  return h;
}
const scene = (n, np, minutes) => `(() => {
  MAP_SIZES['x${n}'] = ${n};
  const spec = generateMapSpec({ size: 'x${n}', seed: 33, mapType: 'coastal', numPlayers: ${np} }), civs = Object.keys(CIVS);
  createWorld(spec, { players: Array.from({ length: ${np} }, (_, i) => ({ name: 'P' + i, civ: civs[(i * 5) % civs.length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 33, size: 'x${n}', mapType: 'coastal', fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard', rules: currentRules() });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.nextAutosave = 1e9;   // the tests start each autosave themselves
  W.spectate = true; for (let i = 0; i < ${minutes} * 1200; i++) worldTick(0.05); W.spectate = false;
})()`;
// waits (on node's own timers) until the autosave has finished; with play, the match plays a tick every millisecond meanwhile
const settled = (run, play = false) => new Promise(resolve => {
  const iv = play ? setInterval(() => run('worldTick(0.05)'), 1) : null;
  const t = () => (run('MatchSave.busy') ? setTimeout(t, 5) : (iv && clearInterval(iv), resolve())); t();
});
// the one-shot save at the moment the autosave takes its snapshot (serializeSliced's first, synchronous step)
const SPY = `(() => { const sliced = MatchSave.serializeSliced;
  MatchSave.serializeSliced = function () { globalThis.__sync = MatchSave.serialize(); globalThis.__syncTick = W.tick; return sliced.apply(this, arguments); }; })()`;
(async () => {
  // ---------- 1. the autosave takes one snapshot, then writes it in slices while the match plays on ----------
  const idb = fakeIndexedDB(), A = page(idb);
  A.run(scene(256, 3, 2)); A.run(SPY);
  // a tree also held elsewhere in the save: the snapshot keeps it one node
  A.run(`(() => { const t = W.list.find(e => e.kind === 'res' && e.type === 'tree'); W.probe = { a: t, b: [t] }; })()`);
  A.run('W.nextAutosave = W.t; worldTick(0.05);');   // the hook starts it; the snapshot comes two timers later (after the rehearsal)
  const started = JSON.parse(A.run('JSON.stringify({ busy: MatchSave.busy, taken: typeof __sync === "string" })'));
  // right after the snapshot, before the slices: change what the save holds, in every way the match can
  const change = () => A.run(`(() => {
    if (typeof __sync !== 'string' || W.changed) return false;
    const p = W.players[1], tree = W.probe.a, mine = W.list.find(e => e.kind === 'res' && e.type === 'gold' && !e.gatherers), u = W.list.find(e => e.kind === 'unit' && e.owner === 1);
    tree.amount -= 7; tree.gatherers++; tree.fallDir = 1;   // a flat record: values changed, a key added
    removeEnt(mine);                                       // a flat record gone from W.list
    spawnUnit('villager', 1, p.startX, p.startY + 3);      // an entity added
    p.res.gold -= 50; u.cargo.push(1);                     // an object and an array inside an entity
    W.map.blk[5] = 99; p.explored[7] = 1;                  // typed arrays
    W.probe.b.push(u); W.changed = true;
    return true;
  })()`);
  const watch = setInterval(() => { if (change()) clearInterval(watch); }, 0);
  await settled(A.run, true); clearInterval(watch);
  const S = JSON.parse(A.run('JSON.stringify(MatchSave.stats)'));
  const auto = await A.run(`Store.get('saves', 'auto')`);
  A.c.__auto = auto;
  const cmp = JSON.parse(A.run(`(() => { const a = JSON.parse(__auto), b = JSON.parse(__sync), now = JSON.parse(MatchSave.serialize());
    return JSON.stringify({ same: JSON.stringify(a.graph) === JSON.stringify(b.graph) && a.version === 2, changed: !!W.changed && JSON.stringify(now.graph) !== JSON.stringify(b.graph), ticks: W.tick - __syncTick, snapTick: MatchSave.stats.tick === __syncTick }); })()`));
  const info = JSON.parse(await A.run(`MatchSave.slotInfos().then(i => JSON.stringify(i.auto))`));
  ok(`the autosave at 256 x 256 takes its snapshot after the tick that started it, nearly every entity as a flat record (${S.flat.toLocaleString('en-US')} of ${S.entities.toLocaleString('en-US')}; ${S.snapMs} ms in the vm)`, !started.taken && started.busy && cmp.snapTick && S.flat * 10 > S.entities * 9, { started, snapMs: S.snapMs });
  ok(`the match played ${cmp.ticks} ticks during the ${S.slices.length} slices and changed in every way, and the text is the one-shot save of the snapshot's moment: ${auto.length.toLocaleString('en-US')} characters`, cmp.same && cmp.changed && cmp.ticks >= 2 && S.slices.length >= 2 && info.chars === auto.length && info.slot === 'auto', { cmp, info, ms: S.ms });
  // the vm runs the game 2-12x slower than the browser; the browser's 8 ms is checked in tests/browser/saves.spec.js
  const maxAll = Math.max(...S.slices);
  ok(`no slice runs long: the longest took ${maxAll} ms in the vm (budget 8 ms a slice in the browser)`, maxAll < 80, S.slices);
  A.run('delete W.probe; delete W.changed');

  // ---------- 2. manual slots ----------
  const M = JSON.parse(await A.run(`(async () => {
    W.players[1].res.gold = 4321; await MatchSave.saveTo('3', MatchSave.serialize());
    W.players[1].res.gold = 1; const text = await MatchSave.loadFrom('3'); MatchSave.restore(text);
    const infos = await MatchSave.slotInfos(); let bad = '';
    try { await MatchSave.saveTo('9', 'x'); } catch (e) { bad = e.message; }
    return JSON.stringify({ gold: W.players[1].res.gold, filled: Object.keys(infos).filter(k => infos[k]), label: MatchSave.slotLabel('3', infos['3']).slice(0, 8), empty: MatchSave.slotLabel('2', infos['2']), bad });
  })()`));
  ok('a save in slot 3 loads back exactly; the slot list knows slot 3 and the autosave, and names empty slots', M.gold === 4321 && JSON.stringify(M.filled) === '["3","auto"]' && M.label === 'Slot 3 ·' && M.empty === 'Slot 2 · empty' && M.bad === 'Unknown save slot.', M);

  // ---------- 3. every failure shows a message ----------
  const F = page(fakeIndexedDB({ quota: 1000 }));
  F.run(scene(96, 2, 0));
  const msgs = [];
  for (let k = 0; k < 2; k++) { F.run('W.nextAutosave = W.t; worldTick(0.05);'); await settled(F.run); msgs.push(F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed')).length`)); }
  const text0 = F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed'))[0].text`);
  ok(`two failed autosaves (storage quota) show two messages, naming the error, and the match plays on: "${text0}"`, msgs[0] === 1 && msgs[1] === 2 && /quota/i.test(text0) && F.run('!W.over && W.autosaveError === true'), msgs);
  // a value no save can hold, in a flat record: the one-shot save refuses it, and the autosave fails with the same message
  const bad = F.run(`(() => { const t = W.list.find(e => e.kind === 'res'); t.amount = NaN; let e1 = ''; try { MatchSave.serialize(); } catch (e) { e1 = e.message; } return e1; })()`);
  F.run('W.nextAutosave = W.t; worldTick(0.05);'); await settled(F.run);
  const text1 = F.run(`W.msgs.filter(m => m.text.startsWith('Autosave failed')).pop().text`);
  ok(`a non-finite value fails the autosave as it fails the one-shot save ("${bad}")`, bad === 'Cannot save non-finite state.' && text1.includes(bad), text1);

  // ---------- 4. gzip export and import ----------
  const Z = JSON.parse(await A.run(`(async () => {
    const text = MatchSave.serialize(), blob = await gzipText(text), head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    const back = await readTextFile(blob), plain = await readTextFile(new Blob([text]));
    const cap = CODEC.cap; CODEC.cap = 100000; let bomb = '';
    try { await readTextFile(await gzipText(' '.repeat(200000))); } catch (e) { bomb = e.message; } finally { CODEC.cap = cap; }
    return JSON.stringify({ chars: text.length, gz: blob.size, magic: head[0] === 0x1f && head[1] === 0x8b, same: back === text, plain: plain === text, bomb });
  })()`));
  ok(`a gzip export (${Z.gz.toLocaleString('en-US')} bytes for ${Z.chars.toLocaleString('en-US')} characters) imports back to the same text; a plain .json still imports`, Z.magic && Z.same && Z.plain && Z.gz * 3 < Z.chars, Z);
  ok('a small gzip file that inflates past the sanity cap is refused while it is read', Z.bomb === 'File is too large.', Z.bomb);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
```

Run: `node tests/autosave.test.js`
Expected: exit status 1, with `FAIL SyntaxError: "undefined" is not valid JSON`: the code has no autosave statistics yet.

- [ ] **Step 2: gzip in codec.js**

In `game/js/codec.js`, replace:
```js
// ===== Codecs for saves and maps: typed arrays as run-length bytes in base64 =====
```
with:
```js
// ===== Codecs for saves and maps: typed arrays as run-length bytes in base64, and gzip files =====
```

In `game/js/codec.js`, replace:
```js
//   (little-endian, as every browser and node store them).
'use strict';
```
with:
```js
//   (little-endian, as every browser and node store them).
// - gzipText / readTextFile: a text as a gzip Blob, and a File or Blob (gzip or plain text) back to a string, through
//   the browser's CompressionStream and DecompressionStream, refusing anything that is or inflates past CODEC.cap.
'use strict';
```

In `game/js/codec.js`, replace:
```js
  if (Type === Float32Array) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('Invalid numeric layer.');
  return a;
}
```
with:
```js
  if (Type === Float32Array) for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new Error('Invalid numeric layer.');
  return a;
}
// gzip through the browser's streams (Chromium 80+, node 18+)
async function gzipText(text) { return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
async function readTextFile(file, cap = CODEC.cap) {
  if (file.size > cap) throw new Error('File is too large.');
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x1f || head[1] !== 0x8b) return file.text();
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader(), parts = [];
  let len = 0;
  for (; ;) {
    const { done, value } = await reader.read(); if (done) break;
    len += value.length; if (len > cap) { reader.cancel(); throw new Error('File is too large.'); }
    parts.push(value);
  }
  return parts.join('');
}
```

- [ ] **Step 3: The snapshot, slots, the autosave, the menus and gzip in session.js**

In `game/js/session.js`, replace:
```js
  // walk(value, out, slice) visits the objects breadth first and fills out.root, out.shapes and out.nodes; a typed array's
  // node holds a copy of it, which pack() turns into text. Both are generators: given slice (ms) they yield when a slice
  // is used up (the sliced autosave); with slice 0 they run to the end in one go.
  *walk(value, out, slice = 0) {
    const nodes = [], seen = new Map(), shapes = [], shapeOf = new Map(), queue = [];
```
with:
```js
  // walk(value, out, slice) visits the objects breadth first and fills out.root, out.shapes and out.nodes; a typed array's
  // node holds a copy of it, which pack() turns into text. Both are generators: given slice (ms) they yield when a slice
  // is used up (the sliced autosave); with slice 0 they run to the end in one go. Given snap (freeze()), value is the
  // snapshot's copy, whose typed arrays are copies already and whose flat records are read from the snapshot.
  *walk(value, out, slice = 0, snap = null) {
    const nodes = [], seen = new Map(), shapes = [], shapeOf = new Map(), queue = [], snapShape = [];
```

In `game/js/session.js`, replace:
```js
      const v = queue[q]; let node;
      if (ArrayBuffer.isView(v)) {
        if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, v.constructor.name)) throw new Error('Cannot save a ' + v.constructor.name + '.');
        node = [v.constructor.name, v.length, v.slice()];
      } else if (v instanceof Map) { node = ['M']; for (const [k, x] of v) node.push(val(k), val(x)); }
```
with:
```js
      const v = queue[q], r = snap ? snap.at(v) : -1; let node;
      if (r >= 0) {   // a flat record of the snapshot: the node the entity had at the moment of the snapshot
        const k = snap.shape[r], keys = snap.shapes[k], o = snap.start[r];
        let s = snapShape[k];
        if (s === undefined) { const sk = 'Object\u0000' + keys.join('\u0000'); s = shapeOf.get(sk); if (s === undefined) { s = shapes.length; shapeOf.set(sk, s); shapes.push(['Object', ...keys]); } snapShape[k] = s; }
        node = [s]; for (let j = 0; j < keys.length; j++) node.push(val(snap.vals[o + j]));
      } else if (ArrayBuffer.isView(v)) {
        if (!Object.prototype.hasOwnProperty.call(CODEC_TYPES, v.constructor.name)) throw new Error('Cannot save a ' + v.constructor.name + '.');
        node = [v.constructor.name, v.length, snap ? v : v.slice()];
      } else if (v instanceof Map) { node = ['M']; for (const [k, x] of v) node.push(val(k), val(x)); }
```

In `game/js/session.js`, replace:
```js
    out.root = val(value);
    let t0 = performance.now();
```
with:
```js
    out.root = val(value);
    // tq: when the last stretch (128 nodes, or 4096 items of a list) began; a slice ends before a stretch as long as the
    // last one would take it past slice ms
    let t0 = performance.now(), tq = t0;
    const due = () => { const now = performance.now(), over = now - t0 + (now - tq) > slice; tq = now; return over; };
```

In `game/js/session.js`, replace:
```js
        for (let i = 0; i < v.length; i++) { node.push(val(v[i])); if (slice && (i & 4095) === 4095 && performance.now() - t0 > slice) { yield; t0 = performance.now(); } }
```
with:
```js
        for (let i = 0; i < v.length; i++) { node.push(val(v[i])); if (slice && (i & 4095) === 4095 && due()) { yield; t0 = tq = performance.now(); } }
```

In `game/js/session.js`, replace:
```js
      if (slice && (q & 127) === 127 && performance.now() - t0 > slice) { yield; t0 = performance.now(); }
```
with:
```js
      if (slice && (q & 127) === 127 && due()) { yield; t0 = tq = performance.now(); }
```

In `game/js/session.js`, replace:
```js
    const CH = 196608;
    let t0 = performance.now();
    const due = () => slice && performance.now() - t0 > slice;
```
with:
```js
    const CH = 196608;
    // step is the last chunk's time: a slice ends before a chunk that would take it past slice ms, not after
    let t0 = performance.now(), step = 0;
    const due = () => slice && performance.now() - t0 + step > slice, timed = f => { const t = performance.now(), r = f(); step = performance.now() - t; return r; };
```

In `game/js/session.js`, replace:
```js
      for (let i = 0; i < bytes.length || !runs.length; i += CH) { const r = rleEncode(bytes.subarray(i, i + CH)); runs.push(r); len += r.length; if (due()) { yield; t0 = performance.now(); } }
```
with:
```js
      for (let i = 0; i < bytes.length || !runs.length; i += CH) { if (due()) { yield; t0 = performance.now(); } const r = timed(() => rleEncode(bytes.subarray(i, i + CH))); runs.push(r); len += r.length; }
```

In `game/js/session.js`, replace:
```js
      for (let i = 0; i < all.length || !text.length; i += CH) { text.push(b64Encode(all.subarray(i, i + CH))); if (due()) { yield; t0 = performance.now(); } }
```
with:
```js
      for (let i = 0; i < all.length || !text.length; i += CH) { if (due()) { yield; t0 = performance.now(); } text.push(timed(() => b64Encode(all.subarray(i, i + CH)))); }
```

In `game/js/session.js`, replace:
```js
  save(auto = false) { localStorage.setItem(auto ? this.autoKey : this.key, this.serialize()); },
```
with:
```js
  // ---------- slots in IndexedDB (store.js): manual slots '1' to '5' and 'auto'; a summary of each in the meta store ----------
  slots: ['1', '2', '3', '4', '5'],
  async saveTo(slot, text, head = this.lastHead) {
    if (![...this.slots, 'auto'].includes(slot)) throw new Error('Unknown save slot.');
    await Store.put('saves', slot, text);
    await Store.put('meta', 'save:' + slot, { slot, savedAt: head.savedAt, meta: head.meta, n: head.n, version: head.version, chars: text.length });
  },
  async loadFrom(slot) { if (![...this.slots, 'auto'].includes(slot)) throw new Error('Unknown save slot.'); return Store.get('saves', slot); },
  // slot -> its summary, or null when it is empty
  async slotInfos() { const out = {}; for (const s of [...this.slots, 'auto']) out[s] = (await Store.get('meta', 'save:' + s)) || null; return out; },
  slotLabel(slot, info) {
    const name = slot === 'auto' ? 'Autosave' : 'Slot ' + slot;
    if (!info) return name + ' · empty';
    const mt = info.meta, date = info.savedAt ? new Date(info.savedAt).toLocaleString() : '';
    const summary = mt ? [mt.civ, mt.age, mt.mapLabel, typeof fmtTime === 'function' && Number.isFinite(mt.time) ? fmtTime(mt.time) : '', mt.players ? mt.players + 'P' : ''].filter(Boolean).join(' · ') : '';
    return name + ' · ' + [summary, date].filter(Boolean).join(' — ');
  },
  // ---------- the autosave: a snapshot of one moment, then the text in idle slices ----------
  // serializeSliced() copies what the save holds in one go (freeze), between two ticks, and then builds the text from
  // that copy in slices of at most sliceMs, one per idle period (requestIdleCallback, else a timeout), while the match
  // plays on: the walk, the packing of the layers and the JSON. Nothing holds the simulation, and the text is
  // serialize()'s at the moment of the snapshot, whatever the simulation and the player's input do meanwhile.
  // Slices aim at sliceMs: the walk (every 128 nodes, or 4096 items of a list), the packing and the JSON each end a
  // slice before a step as long as their last one would take it past sliceMs, so no slice passes 8 ms.
  sliceMs: 6, busy: false, stats: null,
  later(fn, soon) { if (!soon && typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 100 }); else if (typeof setTimeout === 'function') setTimeout(fn, 0); else Promise.resolve().then(fn); },
  sliced(gen, stats) {
    return new Promise((resolve, reject) => {
      const step = () => {
        const t0 = performance.now();
        let r; try { r = gen.next(); } catch (e) { reject(e); return; }
        stats.slices.push(+(performance.now() - t0).toFixed(2));
        if (r.done) resolve(); else this.later(step);
      };
      this.later(step);
    });
  },
  // freeze(value) copies, at once, all that the save of value holds, so that walk(), pack() and the JSON can run later
  // and still write this moment. Typed arrays are copied, into the copies the previous snapshot made where it can
  // (GameMap's derived layers are not: walk() leaves them out). Every other object is copied with its prototype, its
  // keys in order and its shared references, so walking the copy gives the graph that walking the match gives now.
  // The exception is W.list's flat records, plain objects that hold only numbers, strings, booleans, null and
  // undefined: the trees, mines and other resources, nearly all of a big map's entities. Copied as objects they cost
  // 11 ms at 480 x 480 with 8 players (48,800 entities: the copies outlive the young generation). Instead their values
  // go into one array, their keys into one list per shape, and the snapshot keeps the entity itself only as the
  // identity that walk() numbers (at(): its index in items, or -1).
  spares: new WeakMap(),   // a typed array of the match -> the copy the last snapshot made of it
  bufs: null,              // the last snapshot's arrays for its flat records, once its walk is done (release())
  freeze(value, list, nextId) {   // list: W.list, nextId: W.nextId (or a sample of the list, rehearse())
    const n = list.length, top = Math.max(1, nextId | 0), grow = k => Math.ceil(k * 1.25) + 64;
    let b = this.bufs; this.bufs = null;   // taken: a snapshot made before this one is released gets arrays of its own
    if (!b || b.slot.length <= top || b.shape.length < n || b.vals.length < n * 13) b = { slot: new Int32Array(grow(top)), shape: new Int32Array(grow(n)), start: new Int32Array(grow(n)), vals: new Array(grow(n * 13)) };
    const items = list.slice(), slot = b.slot, shape = b.shape, start = b.start;
    slot.fill(0, 0, top + 1); shape.fill(-1, 0, n);
    const { shapes, flat } = this.flatPass(items, n, top, slot, shape, start, b.vals);
    let polluted = false; for (const k in Object.prototype) { polluted = true; break; }
    const at = v => { if (Object.getPrototypeOf(v) !== Object.prototype) return -1; const id = v.id; if (!(id >= 1 && id <= top)) return -1; const s = slot[id] - 1; return s >= 0 && items[s] === v ? s : -1; };
    const seen = new Map([[list, items]]), stack = [];
    const copy = v => {
      if (v === null || typeof v !== 'object') return v;
      let c = seen.get(v); if (c !== undefined) return c;
      if (at(v) >= 0) return v;
      if (ArrayBuffer.isView(v)) {
        if (typeof v.slice !== 'function') c = v;
        else { c = this.spares.get(v); if (c && c.constructor === v.constructor && c.length === v.length) c.set(v); else { c = v.slice(); this.spares.set(v, c); } }
        seen.set(v, c); return c;
      }
      // plain objects and arrays are copied whole (spread, slice: one step, not one store per key), their object values below
      const proto = Object.getPrototypeOf(v);
      c = Array.isArray(v) ? v.slice() : v instanceof Map ? new Map() : v instanceof Set ? new Set() : proto === Object.prototype && !polluted ? { ...v } : Object.create(proto);
      seen.set(v, c); stack.push(v, c); return c;
    };
    const root = copy(value);
    for (let i = 0; i < n; i++) if (shape[i] < 0) items[i] = copy(items[i]);
    while (stack.length) {
      const c = stack.pop(), v = stack.pop();
      if (Array.isArray(v)) { for (let i = 0; i < c.length; i++) { const x = c[i]; if (x !== null && typeof x === 'object') c[i] = copy(x); } }
      else if (v instanceof Map) { for (const [k, x] of v) c.set(copy(k), copy(x)); }
      else if (v instanceof Set) { for (const x of v) c.add(copy(x)); }
      else if (Object.getPrototypeOf(c) === Object.prototype && !polluted) { for (const k in c) { const x = c[k]; if (x !== null && typeof x === 'object') c[k] = copy(x); } }
      else {
        // a class's object (GameMap, Player, AIPlayer) key by key; its prototype may have accessors (AIPlayer's id): define, do not assign
        const keys = v instanceof GameMap ? Object.keys(v).filter(k => !MAP_DERIVED.includes(k)) : Object.keys(v);
        for (const k of keys) Object.defineProperty(c, k, { value: copy(v[k]), enumerable: true, writable: true, configurable: true });
      }
    }
    return { root, items, shape, start, shapes, vals: b.vals, at, flat, release: () => { this.bufs = b; } };   // release(): after the walk, the next snapshot may reuse the arrays
  },
  // freeze()'s pass over W.list: the flat records' values into vals, their shapes and starts; slot[id] = index + 1
  flatPass(items, n, top, slot, shape, start, vals) {
    const shapes = [], readers = [], uses = [], same = (a, b) => { if (a.length !== b.length) return false; for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false; return true; };
    let o = 1, flat = 0;
    vals[0] = '';   // a string first, so the array holds values of every kind from the start
    let polluted = false; for (const k in Object.prototype) { polluted = true; break; }   // for-in below lists own keys only while Object.prototype has none
    let s1 = -1, s2 = -1;   // the last two shapes seen: most records have one of them (trees, and trees by water), checked key by key
    for (let i = 0; i < n; i++) {
      const e = items[i];
      if (e === null || typeof e !== 'object' || Object.getPrototypeOf(e) !== Object.prototype) continue;
      const id = e.id; if (!Number.isInteger(id) || id < 1 || id > top || slot[id]) continue;
      let s = -1;
      if (!polluted) for (let c = 0; c < 2 && s < 0; c++) {
        const t = c ? s2 : s1; if (t < 0) continue;
        const ks = shapes[t]; let j = 0; for (const k in e) { if (k !== ks[j]) { j = -1; break; } j++; } if (j === ks.length) s = t;
      }
      if (s < 0) { const ks = Object.keys(e); s = shapes.findIndex(x => same(ks, x)); if (s < 0) { s = shapes.length; shapes.push(ks); readers.push(this.slowReader(ks)); uses.push(0); } }
      if (s !== s1) { s2 = s1; s1 = s; }
      const m = shapes[s].length; if (o + m > vals.length) vals.length = 2 * vals.length;
      if (!readers[s](e, vals, o)) continue;   // it holds an object: it is copied below
      if (++uses[s] === 32) readers[s] = this.reader(shapes[s]);   // a shape with many flat records gets the compiled reader
      slot[id] = i + 1; shape[i] = s; start[i] = o; o += m; flat++;
    }
    return { shapes, flat };
  },
  // reader(keys)(e, v, o) writes the values of e, an object of those keys, to v from index o on, or returns false at the
  // first value that is an object. The compiled reader reads each key by name, and is kept from one snapshot to the
  // next: freeze() at 480 x 480 took 27 ms reading its 580,000 values through computed names (slowReader), 9 ms by
  // name. Only a shape with 32 flat records in a snapshot is compiled; the others (units, buildings, rare resources)
  // read through computed names.
  readers: new Map(),
  reader(keys) {
    const sig = keys.join('\u0000'), had = this.readers.get(sig); if (had) return had;
    if (this.readers.size > 4096) this.readers.clear();
    let r;
    try { r = new Function('e', 'v', 'o', 'let x; ' + keys.map((k, j) => `x = e[${JSON.stringify(k)}]; if (x !== null && typeof x === 'object') return false; v[o + ${j}] = x;`).join(' ') + ' return true;'); }
    catch (err) { r = this.slowReader(keys); }   // where a content security policy forbids compiling
    this.readers.set(sig, r); return r;
  },
  slowReader(keys) { return (e, v, o) => { for (let j = 0; j < keys.length; j++) { const x = e[keys[j]]; if (x !== null && typeof x === 'object') return false; v[o + j] = x; } return true; }; },
  // the snapshot's rehearsal (autosave): freeze() on every 8th entity, thrown away
  rehearse() {
    if (typeof terraFlush === 'function') terraFlush();
    const some = W.list.filter((e, i) => (i & 7) === 0);
    this.freeze({ list: some }, some, W.nextId).release();
  },
  async serializeSliced() {
    const t0 = performance.now(), { head, value } = this.parts(), snap = this.freeze(value, W.list, W.nextId), out = {};
    const stats = this.stats = { tick: W.tick, snapMs: +(performance.now() - t0).toFixed(2), flat: snap.flat, entities: snap.items.length, slices: [], ms: 0, chars: 0 };
    await this.sliced(this.walk(snap.root, out, this.sliceMs, snap), stats);
    snap.release();
    await this.sliced(this.pack(out, this.sliceMs), stats);
    const nodes = out.nodes, chunks = [], ms = this.sliceMs;
    // the JSON, 256 nodes at a time; a slice ends before a chunk that would take it past ms (step: the last chunk's time)
    await this.sliced((function* () { let t0 = performance.now(), step = 0; for (let i = 0; i < nodes.length; i += 256) { if (performance.now() - t0 + step > ms) { yield; t0 = performance.now(); } const t = performance.now(); chunks.push(nodes.slice(i, i + 256).map(x => JSON.stringify(x)).join(',')); step = performance.now() - t; } })(), stats);
    // the same text as serialize(): the head, then the graph with its nodes last
    const pre = JSON.stringify({ ...head, graph: { root: out.root, shapes: out.shapes, nodes: [] } }), text = pre.slice(0, -3) + chunks.join(',') + ']}}';
    this.lastHead = head; stats.ms = +(performance.now() - t0).toFixed(1); stats.chars = text.length;
    return text;
  },
  // Every failure shows a message (the old autosave told only once).
  async autosave() {
    if (this.busy) return false;
    this.busy = true;
    try {
      await new Promise(r => this.later(r, true));   // after the tick that started it: the snapshot is of a moment between two ticks, as a manual save's is
      if (!W || W.menu || W.editor || W.over) return false;   // the match ended or was left meanwhile
      // A rehearsal on every 8th entity, an idle period before the snapshot: the snapshot runs once a minute, and its code ran
      // 2-3 times slower cold (26 ms against 9 at 480 x 480). It also finishes any pending terrain work (terraFlush).
      this.rehearse(); await new Promise(r => this.later(r));
      if (!W || W.menu || W.editor || W.over) return false;
      const text = await this.serializeSliced(); await this.saveTo('auto', text); if (W) W.autosaveError = false; return true;
    }
    catch (e) { if (W) W.autosaveError = true; msg('Autosave failed: ' + (e && e.message ? e.message : e) + ' Use Export Match from the game menu to keep a copy.', '#fc8'); return false; }
    finally { this.busy = false; }
  },
```

In `game/js/session.js`, replace:
```js
  openLoad() {
    const backToGame = UI.gameRunning && UI.paused;
    const m = openModal('Load Match', '<p>Resume a local save or choose an exported match file.</p><div id="match-slots"></div><label>Import match <input type="file" id="match-file" accept=".json"></label><p id="match-error" role="status"></p>', [[backToGame ? 'Back to Game Menu' : 'Close', backToGame ? () => { openGameMenu(); return false; } : null]]);
    const fail = e => { m.querySelector('#match-error').textContent = e.message; };
    for (const [key, label] of [[this.key, 'Manual save'], [this.autoKey, 'Autosave']]) {
      let text; try { text = localStorage.getItem(key); } catch (e) { fail(e); continue; }
      if (!text) continue;
      const b = document.createElement('button'); b.className = 'btn';
      let info = '';
      try {
        const parsed = JSON.parse(text), date = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : '', mt = parsed.meta;
        const summary = mt ? [mt.civ, mt.age, mt.mapLabel, typeof fmtTime === 'function' && Number.isFinite(mt.time) ? fmtTime(mt.time) : '', mt.players ? mt.players + 'P' : ''].filter(Boolean).join(' · ') : '';
        info = [summary, date].filter(Boolean).join(' — ');
      } catch (e) { }
      b.textContent = label + (info ? ' · ' + info : ''); b.onclick = () => { try { this.resume(text); } catch (e) { fail(e); } }; m.querySelector('#match-slots').appendChild(b);
    }
    m.querySelector('#match-file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { if (f.size > 16e6) throw new Error('Save file is too large.'); this.resume(await f.text()); } catch (e) { fail(e); } };
  },
  export() {
    const blob = new Blob([this.serialize()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'age-of-realms-match.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
```
with:
```js
  async openLoad() {
    const backToGame = UI.gameRunning && UI.paused;
    const m = openModal('Load Match', '<p>Resume a saved match or choose an exported match file (.json.gz or .json).</p><div id="match-slots"></div><label>Import match <input type="file" id="match-file" accept=".gz,.json,application/gzip,application/json"></label><p id="match-error" role="status"></p>', [[backToGame ? 'Back to Game Menu' : 'Close', backToGame ? () => { openGameMenu(); return false; } : null]]);
    const fail = e => { m.querySelector('#match-error').textContent = e.message; };
    m.querySelector('#match-file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { this.resume(await readTextFile(f)); } catch (err) { fail(err); } };
    let infos; try { infos = await this.slotInfos(); } catch (e) { fail(e); return; }
    const box = m.querySelector('#match-slots');
    for (const s of [...this.slots, 'auto']) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = this.slotLabel(s, infos[s]); b.disabled = !infos[s];
      b.onclick = async () => { try { const text = await this.loadFrom(s); if (!text) throw new Error('That slot is empty.'); this.resume(text); } catch (e) { fail(e); } };
      box.appendChild(b);
    }
  },
  // the game menu's Save Match: five slots, each showing what it holds; a slot that holds a save is overwritten
  async openSave() {
    const m = openModal('Save Match', '<p>Choose a slot. Saving to a slot that holds a match replaces it.</p><div id="match-slots"></div><p id="match-error" role="status"></p>', [['Back to Game Menu', () => { openGameMenu(); return false; }]]);
    const status = m.querySelector('#match-error'), box = m.querySelector('#match-slots');
    let infos; try { infos = await this.slotInfos(); } catch (e) { status.textContent = 'Save failed: ' + e.message; return; }
    for (const s of this.slots) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = this.slotLabel(s, infos[s]);
      b.onclick = async () => {
        for (const x of box.querySelectorAll('button')) x.disabled = true;
        status.textContent = 'Saving…';
        try { await this.saveTo(s, this.serialize()); msg(`Match saved to slot ${s}.`, '#9fd'); openGameMenu(); }
        catch (e) { status.textContent = 'Save failed: ' + e.message; for (const x of box.querySelectorAll('button')) x.disabled = false; }
      };
      box.appendChild(b);
    }
  },
  // a gzip file (CompressionStream); plain JSON where the browser has no CompressionStream
  async export() {
    const text = this.serialize(), gz = typeof CompressionStream === 'function', blob = gz ? await gzipText(text) : new Blob([text], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = gz ? 'age-of-realms-match.json.gz' : 'age-of-realms-match.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
```

In `game/js/session.js`, replace:
```js
GameHooks.on('afterTick', () => {
  if (!W || W.menu || W.editor || W.over || typeof localStorage === 'undefined') return;
  if (W.t < (W.nextAutosave ?? MatchSave.interval)) return;
  W.nextAutosave = W.t + MatchSave.interval;
  try { MatchSave.save(true); W.autosaveError = false; }
  catch (e) { if (!W.autosaveError) msg('Autosave failed. Use Export Match from the game menu to keep a copy.', '#fc8'); W.autosaveError = true; }
});
```
with:
```js
GameHooks.on('afterTick', () => {
  if (!W || W.menu || W.editor || W.over || MatchSave.busy || (typeof indexedDB === 'undefined' && typeof localStorage === 'undefined')) return;
  if (W.t < (W.nextAutosave ?? MatchSave.interval)) return;
  W.nextAutosave = W.t + MatchSave.interval;
  MatchSave.autosave();   // a snapshot right after this tick, then the text in idle slices while the match plays on
});
```

In `game/js/session.js`, replace:
```js
    for (const [label, action] of [['Save Match', () => { MatchSave.save(); msg('Match saved.', '#9fd'); }], ['Export Match', () => MatchSave.export()], ['Load Match', () => MatchSave.openLoad()], ['Controls', () => openControls()]]) {
```
with:
```js
    for (const [label, action] of [['Save Match', () => MatchSave.openSave()], ['Export Match', () => MatchSave.export().catch(e => msg('Export failed: ' + e.message, '#fc8'))], ['Load Match', () => MatchSave.openLoad()], ['Controls', () => openControls()]]) {
```

- [ ] **Step 4: The old autosave check moves into the new suite**

The old reliability check expected one message for two failures, which is now wrong by design. `tests/autosave.test.js` checks a message for every failure instead.
In `tests/reliability.test.js`, replace:
```js
test('autosave quota failures report once and leave the match running', () => {
  c.localStorage = { setItem() { throw new Error('quota'); } };
  assert.equal(run(`(() => { W.nextAutosave=W.t;worldTick(0.05);const n=W.msgs.filter(m=>m.text.startsWith('Autosave failed')).length;W.nextAutosave=W.t;worldTick(0.05);return !W.over&&W.autosaveError&&n===1&&W.msgs.filter(m=>m.text.startsWith('Autosave failed')).length===1; })()`), true);
  delete c.localStorage;
});
```
with:
```js
// autosave failures (now one message for every failure) are checked in tests/autosave.test.js
```

- [ ] **Step 5: Run the node suites**

Run: `node tests/autosave.test.js`
Expected (about 10 s; observed while planning):
```
PASS the autosave at 256 x 256 takes its snapshot after the tick that started it, nearly every entity as a flat record (12,336 of 12,504; 22.41 ms in the vm)  {"started":{"busy":true,"taken":false},"snapMs":22.41}
PASS the match played 24 ticks during the 18 slices and changed in every way, and the text is the one-shot save of the snapshot's moment: 1,029,191 characters  {...}
PASS no slice runs long: the longest took 6.35 ms in the vm (budget 8 ms a slice in the browser)  [5.14,5.51,6.21,5.8,5.75,5.66,5.76,5.03,5.54,5.56,4.13,6.35,5.22,2.27,5.04,2.56,5.95,4.69]
PASS a save in slot 3 loads back exactly; the slot list knows slot 3 and the autosave, and names empty slots  {"gold":4321,"filled":["3","auto"],"label":"Slot 3 ·","empty":"Slot 2 · empty","bad":"Unknown save slot."}
PASS two failed autosaves (storage quota) show two messages, naming the error, and the match plays on: "Autosave failed: The quota has been exceeded. Use Export Match from the game menu to keep a copy."  [1,2]
PASS a non-finite value fails the autosave as it fails the one-shot save ("Cannot save non-finite state.")  "Autosave failed: Cannot save non-finite state. Use Export Match from the game menu to keep a copy."
PASS a gzip export (239,885 bytes for 1,029,413 characters) imports back to the same text; a plain .json still imports  {"chars":1029413,"gz":239885,"magic":true,"same":true,"plain":true,"bomb":"File is too large."}
PASS a small gzip file that inflates past the sanity cap is refused while it is read  "File is too large."
8 passed, 0 failed
```
The vm runs the game 2–12 times slower than the browser, so its times are larger. The 8 ms is checked in the browser (Step 6).
Run `node tests/<name>.test.js` for reliability, save-v2, resume, save-compat, store and timing.
Expected: `18`, `12`, `5`, `17`, `9` and `5` passed, each with `0 failed`.

- [ ] **Step 6: The browser tests: the slot picker, gzip, the live autosave, 480 through IndexedDB**

In `tests/browser/game.spec.js`, replace:
```js
test('manual save and autosave resume the match from the menu', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await page.evaluate(() => { __game.W.nextAutosave = __game.W.t + 0.05; });
  await page.waitForFunction(() => !!localStorage.getItem('aor_autosave_v1'));
  await page.locator('#b-menu').click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 1234; });
  await page.getByRole('button', { name: 'Save Match', exact: true }).click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 1; });
  await page.getByRole('button', { name: 'Load Match', exact: true }).click();
  await page.getByRole('button', { name: /Manual save/ }).click();
  expect(await page.evaluate(() => __game.W.players[1].res.gold)).toBe(1234);
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#tutorial-panel')).toBeVisible();
});
```
with:
```js
test('manual save and autosave resume the match from the menu', async ({ page }) => {
  await page.locator('#btn-tutorial').click();
  await page.evaluate(() => { __game.W.nextAutosave = __game.W.t + 0.05; });
  await expect.poll(() => page.evaluate(() => Store.get('saves', 'auto').then(Boolean))).toBe(true);
  await page.locator('#b-menu').click();
  await page.evaluate(() => { __game.W.players[1].res.gold = 1234; });
  await page.getByRole('button', { name: 'Save Match', exact: true }).click();
  await expect(page.locator('#match-slots button')).toHaveCount(5);
  await page.getByRole('button', { name: 'Slot 1 · empty', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();   // saved: back in the game menu
  await page.evaluate(() => { __game.W.players[1].res.gold = 1; });
  await page.getByRole('button', { name: 'Load Match', exact: true }).click();
  await expect(page.locator('#match-slots button')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /^Autosave · Franks/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Slot 2 · empty', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^Slot 1 · Franks/ }).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  expect(await page.evaluate(() => __game.W.players[1].res.gold)).toBe(1234);
  await expect(page.locator('#tutorial-panel')).toBeVisible();
});
```

Append to the end of `tests/browser/saves.spec.js`:
```js

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
    const g = __game; g.launchFromSetup(cfg); const W = g.W;
    for (const p of W.players.slice(1)) p.ai = p.ai || new AIPlayer(p, 'standard');
    W.spectate = true; W.nextAutosave = 1e9; g.UI.paused = false; g.UI.focusPaused = false;
    await new Promise(r => setTimeout(r, 2000));
    const ticks = [], wt = worldTick, runs = [];
    worldTick = function () { const t = performance.now(); const r = wt.apply(this, arguments); ticks.push(performance.now() - t); return r; };
    // the last autosave is checked against the one-shot save of its snapshot's moment
    const sliced = MatchSave.serializeSliced;
    for (let k = 0; k < 5; k++) {
      if (k === 4) MatchSave.serializeSliced = function () { globalThis.__sync = MatchSave.serialize(); MatchSave.serializeSliced = sliced; return sliced.apply(this, arguments); };
      W.nextAutosave = W.t;
      await new Promise(r => { const f = () => (MatchSave.busy || W.nextAutosave === W.t ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
      const s = MatchSave.stats; runs.push({ snapMs: s.snapMs, maxSlice: Math.max(...s.slices), slices: s.slices.length, ticked: W.tick - s.tick });   // ticks played after the snapshot
      await new Promise(r => setTimeout(r, 1000));
    }
    worldTick = wt;
    const text = await Store.get('saves', 'auto'); let parsed = '';
    try { MatchSave.parse(text); parsed = 'ok'; } catch (e) { parsed = e.message; }
    const same = JSON.stringify(JSON.parse(text).graph) === JSON.stringify(JSON.parse(__sync).graph);
    return { runs, maxTick: +Math.max(...ticks).toFixed(1), parsed, same, chars: text.length };
  }, setup(256, 3, 'coastal'));
  const snap = r.runs.map(x => x.snapMs).sort((a, b) => a - b)[2], maxSlice = Math.max(...r.runs.map(x => x.maxSlice));
  console.log(JSON.stringify({ snapMs: r.runs.map(x => x.snapMs), medianSnap: snap, maxSlice, slices: r.runs.map(x => x.slices), ticked: r.runs.map(x => x.ticked), maxTick: r.maxTick, chars: r.chars }));
  expect(r.parsed).toBe('ok');
  expect(r.same).toBe(true);
  expect(Math.min(...r.runs.map(x => x.ticked))).toBeGreaterThan(0);   // the match played on while the text was built
  expect(snap).toBeLessThanOrEqual(8);
  expect(maxSlice).toBeLessThanOrEqual(8);
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
```

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test saves.spec.js game.spec.js`
Expected: `13 passed`. The autosave test prints its figures; observed while planning: `{"snapMs":[4.3,3.3,4.2,2.6,2.3],"medianSnap":3.3,"maxSlice":6.4,"slices":[8,5,4,3,3],"ticked":[24,17,17,13,13],"maxTick":11.6,"chars":1013838}`.

- [ ] **Step 7: The perf spec records the autosave**

In `tests/browser/maps-perf.spec.js`, replace:
```js
- **Save**: \`MatchSave.serialize()\` characters and ms after the timed 3-player ticks.
```
with:
```js
- **Save**: \`MatchSave.serialize()\` characters and ms after the timed 3-player ticks; from phase 4 also, after the
  semicolon, for 5 autosaves in a live 8-player match: the median of their snapshots (the only time an autosave holds
  the game), their longest slice, and the longest tick while they ran, in ms.
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
// 2D rendering (evaluation T1): steady frame cost, live fps, then a full pan and the terrain-cache size.
```
with:
```js
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
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
    rec.render2d = await measure2d(page, n);
```
with:
```js
    rec.autosave = await measureAutosave(page, n);
    await openGame(page); await prepareSize(page, n);
    rec.render2d = await measure2d(page, n);
```

In `tests/browser/maps-perf.spec.js`, replace:
```js
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.knights3.ms} / ${r.knights8.ms}; ${r.knights3w.ms} / ${r.knights8w.ms} (${Math.min(r.knights3.ok, r.knights3w.ok)}/40, ${Math.min(r.knights8.ok, r.knights8w.ok)}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}) | ${r.render2d.pan.cacheMB} |`);
```
with:
```js
  const rows = results.map(r => `| ${date} | ${LABEL} | ${commit} | ${r.renderer} | ${r.n} | ${r.gen.p3} / ${r.gen.p8} | ${r.sim3.tick.mean} / ${r.sim3.tick.p99} | ${r.sim8.tick.mean} / ${r.sim8.tick.p99} | ${r.sim3.findNearestResUs} | ${r.knights3.ms} / ${r.knights8.ms}; ${r.knights3w.ms} / ${r.knights8w.ms} (${Math.min(r.knights3.ok, r.knights3w.ok)}/40, ${Math.min(r.knights8.ok, r.knights8w.ok)}/40) | ${r.render2d.steady.z1} / ${r.render2d.steady['z0.55']} | ${r.render2d.live.z1.fps} / ${r.render2d.live['z0.55'].fps} | ${r.render25d.fps ?? 'n/a'} | ${r.sim3.save.chars.toLocaleString('en-US')} (${r.sim3.save.ms}; ${r.autosave.snapMs} / ${r.autosave.maxSlice} / ${r.autosave.maxTick}) | ${r.render2d.pan.cacheMB} |`);
```

The acceptance figures come in Task 5's perf rows (`npm run test:perf`). In the Save cell, after the semicolon: the snapshot (median of 5 autosaves) / the longest slice / the longest tick, in ms, in a live 8-player match.

- [ ] **Step 8: Syntax and commit**

Run: `npm run test:syntax`
Expected: `105 scripts passed syntax checks.`
```bash
git add game/js/codec.js game/js/session.js tests/autosave.test.js tests/reliability.test.js tests/browser/game.spec.js tests/browser/saves.spec.js tests/browser/maps-perf.spec.js
git commit -m "feat(saves): five save slots and a pause-free autosave in IndexedDB; gzip export

Save Match picks one of five slots; Load Match lists them and the
autosave. The autosave copies the match in one snapshot between two
ticks (4.9 / 6.8 / 11.6 ms at 200 / 256 / 480 with 8 players, medians of 5
in a live match), the resources as flat records, then walks, packs and
writes that copy in idle slices of at most 8 ms while the match plays
on. Its text is the one-shot save of the snapshot's moment. Every
failure shows a message.
Export and import use gzip (CompressionStream), up to the 256 MB cap.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Editor storage, undo by tile diffs, custom sizes, the import limit

The old editor had four limits:
- its maps lived in one `localStorage` key, `aoe_maps` (editor.js:13-16);
- every stroke pushed the whole map as JSON for undo (editor.js:62, 199): 1.7 M characters at 400 per stroke, about 100 M for 60 (E§5.12);
- it offered only the presets (editor.js:35, 95);
- it refused imports over 8 MB (editor.js:140).

**Maps in the store.** A map is kept in the `maps` store as `{ format: 'aor-map', version: 2, spec }`, with the spec's layers packed like a save's.
- `Editor.maps` mirrors the store in memory, so `savedList()`, `load()` and the setup screen (ui.js:107, 197, 303) stay synchronous.
- `store()` updates the mirror at once and resolves when the store has the map; `remove()` deletes it.
- Boot (session.js `initMenus`) fills the mirror (`Editor.ready`), and the Single Player button waits for it. In Task 5, boot runs the migration first.
- When the mirror has loaded, boot refreshes only the editor's map list (`refreshList`), never the whole panel. A whole refresh reset the name field after the player had typed in it, which game.spec's editor test caught once the migration made boot slower.

**Undo by diffs.**
- `snapshot()`, at the start of a change, keeps copies of the layers, the entity list (references) and the players, with no JSON.
- `commit()`, at mouse-up, or before the next change, undo or redo, compares those with the map as it is now. It pushes one entry: per layer, the changed tile indexes with their values before and after, plus the objects removed and added.
  - A change that replaced the whole world (a new player or colour reloads it) pushes the packed spec from before it instead.
  - An entity dragged during the change keeps its spec from when the change began.
- Undo and redo apply an entry to the current spec and load it, as the editor always has.
- The stacks keep at most 60 entries and `undoLimit` (32 MB).

**An editor bug fixed on the way.** `createWorld` gave Chinese and Spanish players their extra start villagers on every editor reload, so no undo was ever exact. Editor worlds now skip them (world.js); matches still get them.

**Custom sizes.**
- The size list gains `custom`, with a number field `#ed-gn`.
- `Editor.maxSize()` is 480 when `validateMapSpec` accepts it, and 256 until phase 8 lifts the cap. The field's maximum follows it, so phase 8 needs no editor change.

**Imports.** `readMapFile` reads plain or gzip JSON up to `CODEC.cap` (256 MB), then validates it as before.

**Files:**
- Modify:
  - `game/js/editor.js`: storage, `maxSize`/`customSize`, `newGenerated`/`newBlank`, `objOf`/`toSpec`, the undo machinery, `buildUI`'s size select and handlers, `readMapFile`, `mouseUp`, `moveEnt` and `play`;
  - `game/js/world.js`: no civ start villagers in editor worlds;
  - `game/js/session.js`: the boot wrapper;
  - `tests/reliability.test.js`: the map-name check.
- Create: `tests/editor.test.js`.
- Extend: `tests/browser/saves.spec.js`.

**Interfaces:**
- Consumes:
  - `Store` (Task 1); `packArray`, `unpackArray`, `readTextFile`, `CODEC.cap` (Tasks 2–3); `SPEC_LAYERS` (map.js);
  - `validateMapSpec`, `blankMapSpec`, `generateMapSpec`, `createWorld`.
- Produces:
  - `Editor.maps`, `Editor.ready`, `pack(spec)`, `unpack(rec)`, `loadAll() → Promise<number>`;
  - `store(name, spec) → Promise`, `remove(name) → Promise`;
  - `maxSize()`, `customSize()`;
  - `objOf(e)`, `snapshot()`, `commit()`, `clearUndo()`, `stackBytes(stack)`, `applyEntry(spec, entry, dir)`, `reloadFrom(spec)`, `refreshList()`;
  - `readMapFile(file) → Promise<spec>`;
  - `newBlank(size)` takes a `MAP_SIZES` name or a side in tiles.
  - Task 5 uses `pack`, `unpack` and `loadAll`.

- [ ] **Step 1: Write the failing test**

Create `tests/editor.test.js`:
```js
// Map editor (game/js/editor.js): undo and redo keep only what a change touched and restore the map exactly; maps
// live in IndexedDB (store.js) with an in-memory mirror; custom sizes; imports up to the sanity cap, plain or gzip.
//   node tests/editor.test.js
const v8 = require('v8'), vm = require('vm');
v8.setFlagsFromString('--expose-gc'); const gc = vm.runInNewContext('gc');   // for the heap measurement below
const harness = require('./engine-harness');
const { fakeIndexedDB } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const { c, run } = harness();
Object.assign(c, { indexedDB: fakeIndexedDB(), setTimeout, Blob, Response, CompressionStream, DecompressionStream, TextDecoderStream });
run(`
Editor.status = () => {}; Editor.refreshUI = () => {};   // the side panel is DOM; the vm has none
// a map's spec with its objects sorted, so two specs compare equal when they hold the same layers, objects and players
function canon(s) { const o = Object.assign({}, s); o.objects = s.objects.map(x => JSON.stringify(x)).sort(); return JSON.stringify(o); }
// one stroke as the mouse makes it: snapshot, apply along a line, commit on mouse-up
function stroke(tool, x0, y0, x1, y1, steps, opts = {}) {
  Object.assign(Editor, { tool, brush: opts.brush || 3 }, opts);
  Editor.snapshot(); Editor.painting = true; Editor.lastApplied = null; Editor.flatLevel = W.map.elevAt(x0, y0);
  for (let k = 0; k <= steps; k++) Editor.apply({ x: x0 + (x1 - x0) * k / steps + 0.5, y: y0 + (y1 - y0) * k / steps + 0.5 });
  Editor.painting = false; Editor.commit();
}`);

// ---------- 1. every kind of change undoes and redoes exactly ----------
const U = JSON.parse(run(`(() => {
  Editor.newGenerated('land', 'large', 77, 3); Editor.name = 'Test';
  const specs = [canon(Editor.toSpec())], kinds = [];
  let noops = 0, entries = 0;
  const at = (kind, f) => { const n0 = Editor.undo.length; f(); const c = canon(Editor.toSpec()); if (c === specs[specs.length - 1]) noops++; entries += Editor.undo.length - n0; specs.push(c); kinds.push(kind); };
  const spot = (() => { for (let y = 90; y < 115; y++) for (let x = 90; x < 115; x++) if (!canPlace(null, 'barracks', x, y, true)) return { x, y }; })();
  at('paint dirt', () => stroke('terrain', 10, 10, 40, 30, 12, { terrain: T.DIRT }));
  at('paint water (removes what cannot stand in it)', () => stroke('terrain', 60, 60, 70, 62, 5, { terrain: T.WATER }));
  at('bridge over it (a new layer)', () => stroke('bridge', 61, 61, 68, 61, 4, { brush: 1 }));
  at('raise', () => stroke('raise', 20, 50, 30, 55, 5));
  at('lower', () => stroke('lower', 22, 50, 28, 52, 3));
  at('flatten', () => stroke('flatten', 30, 60, 40, 66, 5));
  at('tunnel', () => stroke('tunnel', 30, 80, 36, 80, 3, { brush: 1 }));
  at('trench', () => stroke('trench', 70, 30, 75, 34, 3, { brush: 1 }));
  at('trees', () => stroke('object', 80, 70, 90, 75, 5, { obj: ED_OBJECTS[0], brush: 4 }));
  at('erase (objects and layers)', () => stroke('erase', 78, 68, 84, 72, 3, { brush: 3 }));
  at('place a building', () => { Editor.owner = 1; Editor.tool = 'object'; Editor.obj = { k: 'bld', t: 'barracks' }; Editor.snapshot(); Editor.lastApplied = null; Editor.apply({ x: spot.x + 1.5, y: spot.y + 1.5 }); Editor.commit(); });
  at('place a unit', () => { Editor.owner = 2; Editor.tool = 'object'; Editor.obj = { k: 'unit', t: 'knight' }; Editor.snapshot(); const p = nearestLandTile(85, 100, true); Editor.lastApplied = null; Editor.apply({ x: p.x + 0.5, y: p.y + 0.5 }); Editor.commit(); });
  at('drag an entity', () => { const e = W.list.find(q => q.type === 'knight'); Editor.snapshot(); Editor.moving = { ent: e }; const p = nearestLandTile((e.x | 0) + 5, (e.y | 0) + 3, true); Editor.moveEnt(e, { x: p.x + 0.5, y: p.y + 0.5 }); Editor.moving = null; Editor.commit(); });
  at('delete an entity', () => { const e = W.list.find(q => q.type === 'barracks'); Editor.snapshot(); removeEnt(e); Editor.commit(); });
  at('move a start', () => { Editor.owner = 1; Editor.tool = 'start'; Editor.snapshot(); Editor.apply({ x: 33.5, y: 44.5 }); Editor.commit(); });
  at('add a player (reloads the world)', () => { Editor.snapshot(); Editor.players.push({ start: null, civ: 'turks', color: 5, team: 0 }); Editor.loadSpec(Editor.toSpec()); Editor.commit(); });
  const undone = [], redone = [], full = Editor.undo.filter(e => e.full).length;
  for (let k = specs.length - 2; k >= 0; k--) { Editor.doUndo(); undone.push(canon(Editor.toSpec()) === specs[k] ? 1 : 0); }
  for (let k = 1; k < specs.length; k++) { Editor.doRedo(); redone.push(canon(Editor.toSpec()) === specs[k] ? 1 : 0); }
  return JSON.stringify({ kinds: kinds.length, noops, entries, full, undone: undone.join(''), redone: redone.join('') });
})()`));
ok(`${U.kinds} kinds of change (painting, water, a bridge, height, a tunnel, a trench, trees, erasing, a building, a unit, a drag, a delete, a start, a new player) each make one undo entry, and undo and redo restore exactly the map before and after each`, U.noops === 0 && U.entries === U.kinds && U.full === 1 && U.undone === '1'.repeat(U.kinds) && U.redone === '1'.repeat(U.kinds), U);

// ---------- 2. 60 strokes at 480 x 480 keep a few megabytes ----------
// (the perf spec's cap patch: sides above 256 stay blocked by validateMapSpec until phase 8)
run(`var __v0 = validateMapSpec; validateMapSpec = eval('(' + __v0.toString().replace('n > 256', 'n > 1024') + ')');
var __max = Editor.maxSize(); Editor.newBlank(480); Editor.name = 'Big'; var __marks = [];`);
gc(); const h0 = process.memoryUsage().heapUsed;
run(`for (let s = 0; s < 60; s++) {
  const x = 20 + (s * 37) % 420, y = 20 + (s * 53) % 420, tool = ['terrain', 'raise', 'object'][s % 3];
  if (s >= 56) __marks.push(hashStr(canon(Editor.toSpec())));   // the maps before strokes 57 to 60 (hashed: kept off the heap measurement)
  stroke(tool, x, y, x + 30, y + 12, 10, { brush: 8, terrain: [T.DIRT, T.SAND, T.FOREST][s % 3], obj: ED_OBJECTS[0] });
}
__marks.push(hashStr(canon(Editor.toSpec())));`);
gc(); const h1 = process.memoryUsage().heapUsed;
const M = JSON.parse(run(`(() => {
  try {
    const entries = Editor.undo.length, bytes = Editor.stackBytes(Editor.undo), trees = W.list.filter(e => e.type === 'tree').length;
    let tiles = 0, objects = 0; for (const e of Editor.undo) { for (const l of e.layers) tiles += l.idx.length; objects += e.after.length + e.before.length; }
    const back = []; for (let k = 3; k >= 0; k--) { Editor.doUndo(); back.push(hashStr(canon(Editor.toSpec())) === __marks[k] ? 1 : 0); }
    const fwd = []; for (let k = 1; k <= 4; k++) { Editor.doRedo(); fwd.push(hashStr(canon(Editor.toSpec())) === __marks[k] ? 1 : 0); }
    return JSON.stringify({ max: __max, entries, bytes, tiles, objects, trees, back: back.join(''), fwd: fwd.join('') });
  } finally { validateMapSpec = __v0; }
})()`));
const heapMB = +((h1 - h0) / 1048576).toFixed(1);
ok(`60 strokes on a 480 x 480 map (${M.tiles.toLocaleString('en-US')} tile changes, ${M.objects.toLocaleString('en-US')} objects) keep ${(M.bytes / 1048576).toFixed(2)} MB of undo entries; the heap grew ${heapMB} MB with the ${M.trees.toLocaleString('en-US')} trees they planted (at most 20 MB; the old undo kept the whole map as JSON for every stroke)`, M.entries === 60 && M.bytes <= 20 * 1048576 && heapMB <= 20, { ...M, heapMB });
ok('the last four strokes at 480 x 480 undo and redo to exactly the maps between them', M.back === '1111' && M.fwd === '1111', M);

// ---------- 3. custom sizes ----------
const Z = JSON.parse(run(`(() => {
  const plain = Editor.maxSize();
  Editor.newBlank(144); const n144 = W.n;
  return JSON.stringify({ plain, n144 });
})()`));
ok(`a custom size makes a blank map of that side (144), up to what validateMapSpec allows: ${Z.plain} today, 480 with the cap raised (${M.max})`, Z.plain === 256 && M.max === 480 && Z.n144 === 144, { Z, max: M.max });

(async () => {
  // ---------- 4. maps in IndexedDB, mirrored in memory ----------
  const S = JSON.parse(await run(`(async () => {
    Editor.newGenerated('land', 'medium', 5, 2); Editor.name = 'Stored';
    const spec = Editor.toSpec(), json = JSON.stringify(spec).length;
    await Editor.store('Stored', spec);
    const rec = await Store.get('maps', 'Stored'), loaded = Editor.load('Stored');
    Editor.maps = new Map(); const n = await Editor.loadAll();
    const again = JSON.stringify(Editor.load('Stored')) === JSON.stringify(spec);
    await Editor.remove('Stored'); const gone = !(await Store.get('maps', 'Stored')) && !Editor.savedList().includes('Stored');
    return JSON.stringify({ json, stored: JSON.stringify(rec).length, packed: rec.format === 'aor-map' && typeof rec.spec.ter.d === 'string', same: JSON.stringify(loaded) === JSON.stringify(spec), n, again, gone });
  })()`));
  ok(`a saved map goes to IndexedDB packed (${S.stored.toLocaleString('en-US')} characters for a ${S.json.toLocaleString('en-US')}-character spec), loads back the same, survives a reload of the mirror, and deletes`, S.packed && S.same && S.n === 1 && S.again && S.gone && S.stored < S.json, S);
  // a map the store cannot take (quota) is refused, and leaves the list again
  const Q = harness(); Object.assign(Q.c, { indexedDB: fakeIndexedDB({ quota: 1000 }), setTimeout });
  const QR = JSON.parse(await Q.run(`(async () => {
    Editor.newGenerated('land', 'small', 9, 2); let err = '';
    try { await Editor.store('Too big', Editor.toSpec()); } catch (e) { err = e.name; }
    return JSON.stringify({ err, listed: Editor.savedList().includes('Too big') });
  })()`));
  ok('a map the store cannot take (quota) is refused with QuotaExceededError and does not stay in the list', QR.err === 'QuotaExceededError' && !QR.listed, QR);

  // ---------- 5. imports: past the old 8 MB limit, and gzip ----------
  const I = JSON.parse(await run(`(async () => {
    Editor.newGenerated('land', 'small', 9, 2);
    const spec = Editor.toSpec(), text = JSON.stringify(spec, null, 1), pad = text + ' '.repeat(9 * 1024 * 1024 - text.length);
    const big = await Editor.readMapFile(new Blob([pad])), gz = await Editor.readMapFile(await gzipText(text));
    let bad = ''; try { await Editor.readMapFile(new Blob([JSON.stringify({ n: -1, ter: [], objects: [] })])); } catch (e) { bad = e.message; }
    return JSON.stringify({ size: pad.length, big: canon(big) === canon(spec), gz: canon(gz) === canon(spec), bad });
  })()`));
  ok(`a ${(I.size / 1048576).toFixed(0)} MB map file (over the old 8 MB limit) and a gzip one import; a malformed one is refused`, I.big && I.gz && I.bad.startsWith('Map size'), I);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
```

Run: `node tests/editor.test.js`
Expected: exit status 1, with `TypeError: Editor.commit is not a function`.

- [ ] **Step 2: Storage, undo by diffs and custom sizes in editor.js**

In `game/js/editor.js`, replace:
```js
const Editor = {
  active: false, tool: 'terrain', terrain: T.GRASS, obj: null, owner: 1, brush: 2, undo: [], redo: [], players: [], name: 'My Map', sel: null, painting: false,
  savedMaps() { const m = JSON.parse(localStorage.getItem('aoe_maps') || '{}'); if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('Map storage is invalid. Export your maps before resetting storage.'); return m; },
  savedList() { try { return Object.keys(this.savedMaps()); } catch (e) { return []; } },
  load(name) { try { const m = this.savedMaps(); if (!Object.prototype.hasOwnProperty.call(m, name) || validateMapSpec(m[name]).length) return null; return JSON.parse(JSON.stringify(m[name])); } catch (e) { return null; } },
  store(name, spec) { const errors = validateMapSpec(spec); if (errors.length) throw new Error(errors.join('\n')); const m = this.savedMaps(); Object.defineProperty(m, name, { value: spec, enumerable: true, configurable: true, writable: true }); localStorage.setItem('aoe_maps', JSON.stringify(m)); },
```
with:
```js
const Editor = {
  active: false, tool: 'terrain', terrain: T.GRASS, obj: null, owner: 1, brush: 2, undo: [], redo: [], players: [], name: 'My Map', sel: null, painting: false,
  base: null, undoLimit: 32 * 1024 * 1024,   // the change being made (see snapshot), and the memory (bytes) the undo and redo stacks may use
  // ---------- saved maps: IndexedDB store 'maps' (store.js), mirrored in memory so the setup screen can list and load them at once ----------
  // A stored map is { format: 'aor-map', version: 2, spec } with its layers packed like a save's (codec.js).
  maps: new Map(), ready: null,
  pack(spec) { const s = Object.assign({}, spec); for (const k of SPEC_LAYERS) if (spec[k]) s[k] = packArray(Uint8Array.from(spec[k])); return { format: 'aor-map', version: 2, spec: s }; },
  unpack(rec) {
    if (!rec || rec.format !== 'aor-map' || rec.version !== 2 || !rec.spec || !Number.isInteger(rec.spec.n)) return rec;   // anything else is a plain spec (older storage)
    const s = Object.assign({}, rec.spec), n = s.n;
    for (const k of SPEC_LAYERS) if (s[k]) s[k] = Array.from(unpackArray(s[k], n * n));
    return s;
  },
  // fills the mirror from storage; resolves with the number of maps (0 without storage)
  async loadAll() {
    const names = await Store.keys('maps'), maps = new Map();
    for (const name of names) { const rec = await Store.get('maps', name); if (rec) maps.set(name, rec); }
    this.maps = maps; return maps.size;
  },
  savedList() { return [...this.maps.keys()].sort(); },
  load(name) { try { if (!this.maps.has(name)) return null; const spec = this.unpack(this.maps.get(name)); if (validateMapSpec(spec).length) return null; return JSON.parse(JSON.stringify(spec)); } catch (e) { return null; } },
  // keeps the map in the mirror at once and resolves when storage has it; if storage fails, the mirror goes back
  async store(name, spec) {
    const errors = validateMapSpec(spec); if (errors.length) throw new Error(errors.join('\n'));
    const rec = this.pack(spec), had = this.maps.get(name);
    this.maps.set(name, rec);
    try { await Store.put('maps', name, rec); } catch (e) { if (had) this.maps.set(name, had); else this.maps.delete(name); throw e; }
  },
  async remove(name) { this.maps.delete(name); await Store.del('maps', name); },
  // the side of a new custom map: the editor offers up to 480, as far as validateMapSpec allows (256 until phase 8)
  maxSize() { return (validateMapSpec({ n: 480 })[0] || '').startsWith('Map size') ? 256 : 480; },
  customSize() { const v = Math.round(+$('#ed-gn').value), max = this.maxSize(); if (!(v >= 16 && v <= max)) throw new Error(`Map size must be from 16 to ${max}.`); return v; },
```

In `game/js/editor.js`, replace:
```js
  newGenerated(type, size, seed, np) {
    const spec = generateMapSpec({ size, seed, mapType: type, numPlayers: np });
    const civKeys = Object.keys(CIVS);
    spec.players = spec.players.map((p, i) => ({ start: p.start, civ: civKeys[i % civKeys.length], color: i, team: 0 }));
    this.loadSpec(spec); this.undo = []; this.redo = [];
  },
  newBlank(size) {
    const n = MAP_SIZES[size] || 80; const spec = blankMapSpec(n);
    spec.players = [{ start: null, civ: 'franks', color: 0, team: 0 }, { start: null, civ: 'teutons', color: 1, team: 0 }];
    this.loadSpec(spec); this.undo = []; this.redo = [];
  },
```
with:
```js
  // size: a MAP_SIZES name, or a side in tiles (a custom size)
  newGenerated(type, size, seed, np) {
    const spec = generateMapSpec({ size, seed, mapType: type, numPlayers: np });
    const civKeys = Object.keys(CIVS);
    spec.players = spec.players.map((p, i) => ({ start: p.start, civ: civKeys[i % civKeys.length], color: i, team: 0 }));
    this.loadSpec(spec); this.clearUndo();
  },
  newBlank(size) {
    const n = Number.isInteger(size) ? size : MAP_SIZES[size] || 80; const spec = blankMapSpec(n);
    spec.players = [{ start: null, civ: 'franks', color: 0, team: 0 }, { start: null, civ: 'teutons', color: 1, team: 0 }];
    this.loadSpec(spec); this.clearUndo();
  },
```

In `game/js/editor.js`, replace:
```js
  toSpec() {
    const map = W.map, objects = [];
    for (const e of W.list) {
      if (e.kind === 'res') { if (e.type === 'carcass') continue; objects.push({ k: e.type, x: e.x, y: e.y, v: e.v || 0, ...(e.depth ? { depth: e.depth } : {}) }); }
      else if (e.kind === 'relic') objects.push({ k: 'relic', x: e.x, y: e.y });
      else if (e.kind === 'unit') objects.push({ k: 'unit', t: e.type, x: Math.floor(e.x), y: Math.floor(e.y), o: e.owner });
      else if (e.kind === 'bld') objects.push({ k: 'bld', t: e.type, x: e.x, y: e.y, o: e.owner });
    }
    return { version: 1, name: this.name, n: W.n, ...mapLayers(map), objects, players: this.players.map(p => ({ start: p.start, civ: p.civ, color: p.color, team: p.team })) };
  },
  snapshot() { this.undo.push(JSON.stringify(this.toSpec())); if (this.undo.length > 60) this.undo.shift(); this.redo = []; },
  doUndo() { if (!this.undo.length) return; this.redo.push(JSON.stringify(this.toSpec())); const s = JSON.parse(this.undo.pop()); const cam = Object.assign({}, R.cam); this.loadSpec(s); Object.assign(R.cam, cam); this.refreshUI(); },
  doRedo() { if (!this.redo.length) return; this.undo.push(JSON.stringify(this.toSpec())); const s = JSON.parse(this.redo.pop()); const cam = Object.assign({}, R.cam); this.loadSpec(s); Object.assign(R.cam, cam); this.refreshUI(); },
```
with:
```js
  // the spec object of one entity (null for a carcass), as toSpec writes it
  objOf(e) {
    if (e.kind === 'res') return e.type === 'carcass' ? null : { k: e.type, x: e.x, y: e.y, v: e.v || 0, ...(e.depth ? { depth: e.depth } : {}) };
    if (e.kind === 'relic') return { k: 'relic', x: e.x, y: e.y };
    if (e.kind === 'unit') return { k: 'unit', t: e.type, x: Math.floor(e.x), y: Math.floor(e.y), o: e.owner };
    if (e.kind === 'bld') return { k: 'bld', t: e.type, x: e.x, y: e.y, o: e.owner };
    return null;
  },
  toSpec() {
    const objects = [];
    for (const e of W.list) { const o = this.objOf(e); if (o) objects.push(o); }
    return { version: 1, name: this.name, n: W.n, ...mapLayers(W.map), objects, players: this.players.map(p => ({ start: p.start, civ: p.civ, color: p.color, team: p.team })) };
  },
  // ---------- undo and redo: the tiles and objects a change touched, not whole maps ----------
  // snapshot() marks the start of a change (a stroke, a drag, a delete, a new player...): it keeps copies of the layers,
  // the entity list and the players, which cost no JSON. commit() (at the end of the stroke, or before the next change,
  // undo or redo) compares them with the map as it is now and pushes one entry:
  //   { layers: [{ k, idx, before, after, made, gone }], before: [objects], after: [objects], players: [before, after], bytes }
  // idx lists the tiles of layer k that changed; made / gone: the change created or deleted the layer. A change that
  // replaced the whole world (a new player or colour reloads it) pushes { full: packed spec of before, bytes } instead.
  // Undo and redo apply an entry to the current spec and load it, as the editor always has. The stacks keep at most 60
  // entries and undoLimit bytes; the oldest go first.
  snapshot() {
    this.commit();
    const map = W.map, layers = {};
    for (const k of SPEC_LAYERS) if (map[k]) layers[k] = map[k].slice();
    this.base = { world: W, list: W.list.slice(), nextId: W.nextId, layers, players: JSON.stringify(this.players), name: this.name, moved: new Map() };
    this.redo = [];
  },
  clearUndo() { this.undo = []; this.redo = []; this.base = null; },
  stackBytes(stack) { let b = 0; for (const e of stack) b += e.bytes; return b; },
  push(stack, entry) {
    stack.push(entry);
    while (stack.length > 60 || (stack.length > 1 && this.stackBytes(this.undo) + this.stackBytes(this.redo) > this.undoLimit)) stack.shift();
  },
  // the spec of the change's starting point, from the copies snapshot() kept (only for a change that replaced the world)
  baseSpec(b) {
    const objects = [];
    for (const e of b.list) { const o = b.moved.get(e) || this.objOf(e); if (o) objects.push(o); }
    const layers = {}; for (const k of SPEC_LAYERS) if (b.layers[k]) layers[k] = Array.from(b.layers[k]);
    return { version: 1, name: b.name, n: b.world.n, ...layers, objects, players: JSON.parse(b.players) };
  },
  commit() {
    const b = this.base; this.base = null;
    if (!b || !W) return;
    if (W !== b.world) { const full = this.pack(this.baseSpec(b)); this.push(this.undo, { full, bytes: JSON.stringify(full).length * 2 }); return; }
    const map = W.map, layers = [];
    for (const k of SPEC_LAYERS) {
      const was = b.layers[k], now = map[k];
      if (!was && !now) continue;
      const n2 = map.n * map.n, idx = [], before = [], after = [];
      for (let i = 0; i < n2; i++) { const p = was ? was[i] : 0, q = now ? now[i] : 0; if (p !== q) { idx.push(i); before.push(p); after.push(q); } }
      if (idx.length || !was !== !now) layers.push({ k, idx: Int32Array.from(idx), before: Uint8Array.from(before), after: Uint8Array.from(after), made: !was, gone: !now });
    }
    const before = [], after = [];
    for (const e of b.list) {
      if (e.dead) { const o = b.moved.get(e) || this.objOf(e); if (o) before.push(o); }
      else if (b.moved.has(e)) { const o0 = b.moved.get(e), o1 = this.objOf(e); if (JSON.stringify(o0) !== JSON.stringify(o1)) { before.push(o0); after.push(o1); } }
    }
    for (const e of W.list) if (e.id >= b.nextId) { const o = this.objOf(e); if (o) after.push(o); }
    const p0 = b.players, p1 = JSON.stringify(this.players), players = p0 === p1 ? null : [p0, p1];
    if (!layers.length && !before.length && !after.length && !players && b.name === this.name) return;
    let bytes = JSON.stringify(before).length * 2 + JSON.stringify(after).length * 2 + (players ? (p0.length + p1.length) * 2 : 0);
    for (const l of layers) bytes += l.idx.byteLength + l.before.byteLength + l.after.byteLength;
    this.push(this.undo, { layers, before, after, players, names: [b.name, this.name], bytes });
  },
  // spec with entry e undone (dir 'undo') or redone ('redo')
  applyEntry(spec, e, dir) {
    const undo = dir === 'undo', out = Object.assign({}, spec), n2 = spec.n * spec.n;
    for (const l of e.layers) {
      if (undo ? l.made : l.gone) { delete out[l.k]; continue; }
      const a = out[l.k] ? out[l.k].slice() : new Array(n2).fill(0), vals = undo ? l.before : l.after;
      for (let i = 0; i < l.idx.length; i++) a[l.idx[i]] = vals[i];
      out[l.k] = a;
    }
    const drop = undo ? e.after : e.before, add = undo ? e.before : e.after, count = new Map();
    for (const o of drop) { const k = JSON.stringify(o); count.set(k, (count.get(k) || 0) + 1); }
    out.objects = spec.objects.filter(o => { const k = JSON.stringify(o), c = count.get(k); if (c) { count.set(k, c - 1); return false; } return true; }).concat(add.map(o => Object.assign({}, o)));
    if (e.players) out.players = JSON.parse(e.players[undo ? 0 : 1]);
    out.name = e.names[undo ? 0 : 1];
    return out;
  },
  // loads s keeping the camera; the players list comes from s, as loadSpec reads it
  reloadFrom(s) { const cam = Object.assign({}, R.cam); this.loadSpec(s); this.name = s.name || this.name; Object.assign(R.cam, cam); this.refreshUI(); },
  doUndo() {
    this.commit(); const e = this.undo.pop(); if (!e) return;
    const cur = this.toSpec();
    if (e.full) { const now = this.pack(cur); this.push(this.redo, { full: now, bytes: JSON.stringify(now).length * 2 }); this.reloadFrom(this.unpack(e.full)); return; }
    this.push(this.redo, e); this.reloadFrom(this.applyEntry(cur, e, 'undo'));
  },
  doRedo() {
    this.commit(); const e = this.redo.pop(); if (!e) return;
    const cur = this.toSpec();
    if (e.full) { const now = this.pack(cur); this.push(this.undo, { full: now, bytes: JSON.stringify(now).length * 2 }); this.reloadFrom(this.unpack(e.full)); return; }
    this.push(this.undo, e); this.reloadFrom(this.applyEntry(cur, e, 'redo'));
  },
```

In `game/js/editor.js`, replace:
```js
        <select id="ed-gsize">${Object.keys(MAP_SIZES).map(k => `<option ${k === 'small' ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
```
with:
```js
        <select id="ed-gsize">${Object.keys(MAP_SIZES).map(k => `<option ${k === 'small' ? 'selected' : ''}>${k}</option>`).join('')}<option value="custom">custom</option></select>
        <input id="ed-gn" type="number" min="16" max="${this.maxSize()}" value="200" title="Custom size: the map side in tiles (16 to ${this.maxSize()})" style="width:4.5em"></div>
```

In `game/js/editor.js`, replace:
```js
    $('#ed-gen').onclick = () => { this.snapshot(); this.newGenerated($('#ed-gtype').value, $('#ed-gsize').value, (Math.random() * 1e6) | 0, Math.max(2, this.players.length || 3)); this.refreshUI(); };
    $('#ed-blank').onclick = () => { this.snapshot(); this.newBlank($('#ed-gsize').value); this.refreshUI(); };
    $('#ed-save').onclick = () => { try { const name = $('#ed-name').value.trim() || 'My Map'; this.store(name, { ...this.toSpec(), name }); this.name = name; this.status(`Saved "${name}".`); this.refreshUI(); } catch (e) { this.status('Save failed: ' + e.message); } };
    $('#ed-load').onclick = () => { const n = $('#ed-list').value; if (!n) return; const s = this.load(n); if (!s) { this.status('Map could not be loaded: invalid data or storage is unavailable.'); return; } this.loadSpec(s); this.name = n; this.undo = []; this.redo = []; this.refreshUI(); this.status(`Loaded "${n}".`); };
    $('#ed-del').onclick = () => { const n = $('#ed-list').value; if (!n || !confirm(`Delete saved map "${n}"?`)) return; try { const m = this.savedMaps(); delete m[n]; localStorage.setItem('aoe_maps', JSON.stringify(m)); this.refreshUI(); } catch (e) { this.status('Delete failed: ' + e.message); } };
```
with:
```js
    const size = () => $('#ed-gsize').value === 'custom' ? this.customSize() : $('#ed-gsize').value;
    $('#ed-gen').onclick = () => { try { const s = size(); this.snapshot(); this.newGenerated($('#ed-gtype').value, s, (Math.random() * 1e6) | 0, Math.max(2, this.players.length || 3)); this.refreshUI(); } catch (e) { this.status(e.message); } };
    $('#ed-blank').onclick = () => { try { const s = size(); this.snapshot(); this.newBlank(s); this.refreshUI(); } catch (e) { this.status(e.message); } };
    $('#ed-save').onclick = async () => { const name = $('#ed-name').value.trim() || 'My Map'; try { await this.store(name, { ...this.toSpec(), name }); this.name = name; this.status(`Saved "${name}".`); this.refreshUI(); } catch (e) { this.status('Save failed: ' + e.message); } };
    $('#ed-load').onclick = () => { const n = $('#ed-list').value; if (!n) return; const s = this.load(n); if (!s) { this.status('Map could not be loaded: invalid data or storage is unavailable.'); return; } this.loadSpec(s); this.name = n; this.clearUndo(); this.refreshUI(); this.status(`Loaded "${n}".`); };
    $('#ed-del').onclick = async () => { const n = $('#ed-list').value; if (!n || !confirm(`Delete saved map "${n}"?`)) return; try { await this.remove(n); this.refreshUI(); } catch (e) { this.status('Delete failed: ' + e.message); } };
```

In `game/js/editor.js`, replace:
```js
    $('#ed-import').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { if (f.size > 8e6) throw new Error('Map file is too large (maximum 8 MB).'); const s = JSON.parse(await f.text()); const errors = validateMapSpec(s); if (errors.length) throw new Error(errors.join('\n')); this.snapshot(); this.loadSpec(s); this.name = s.name || f.name.slice(0, 120); this.undo = this.undo.slice(-60); this.redo = []; this.refreshUI(); this.status('Imported ' + f.name); } catch (err) { this.status('Import failed: ' + err.message); } };
```
with:
```js
    $('#ed-import').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const s = await this.readMapFile(f); this.snapshot(); this.loadSpec(s); this.name = s.name || f.name.slice(0, 120); this.redo = []; this.refreshUI(); this.status('Imported ' + f.name); } catch (err) { this.status('Import failed: ' + err.message); } };
```

In `game/js/editor.js`, replace:
```js
  reloadKeep() { const cam = Object.assign({}, R.cam); this.loadSpec(this.toSpec()); Object.assign(R.cam, cam); this.refreshUI(); },
```
with:
```js
  reloadKeep() { const cam = Object.assign({}, R.cam); this.loadSpec(this.toSpec()); Object.assign(R.cam, cam); this.refreshUI(); },
  // an imported map file (plain or gzip JSON, up to the sanity cap CODEC.cap), checked like any map
  async readMapFile(file) { const s = JSON.parse(await readTextFile(file)); const errors = validateMapSpec(s); if (errors.length) throw new Error(errors.join('\n')); return s; },
```

In `game/js/editor.js`, replace:
```js
  mouseUp(e) { if (!this.active) return; this.painting = false; this.pan = null; this.moving = null; },
  moveEnt(e, t) {
    const x = Math.floor(t.x), y = Math.floor(t.y);
```
with:
```js
  mouseUp(e) { if (!this.active) return; if (this.painting || this.moving) this.commit(); this.painting = false; this.pan = null; this.moving = null; },
  moveEnt(e, t) {
    const x = Math.floor(t.x), y = Math.floor(t.y), b = this.base;
    if (b && b.world === W && e.id < b.nextId && !b.moved.has(e)) b.moved.set(e, this.objOf(e));   // where it was when the change began (undo)
```

In `game/js/editor.js`, replace:
```js
    try { this.store(this.name, spec); } catch (e) { this.status('Save failed: ' + e.message); return; }
```
with:
```js
    try { await this.store(this.name, spec); } catch (e) { this.status('Save failed: ' + e.message); return; }
```

In `game/js/editor.js`, replace:
```js
  play() {
```
with:
```js
  async play() {
```

In `game/js/editor.js`, replace:
```js
  refreshUI() {
    $('#ed-name').value = this.name;
    $('#ed-list').replaceChildren(...this.savedList().map(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; o.selected = n === this.name; return o; }));
```
with:
```js
  // the saved-map list alone: boot refreshes it when the mirror has loaded, without touching what the player typed
  refreshList() { $('#ed-list').replaceChildren(...this.savedList().map(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; o.selected = n === this.name; return o; })); },
  refreshUI() {
    $('#ed-name').value = this.name;
    this.refreshList();
```

- [ ] **Step 3: Editor worlds get no civ start villagers**

In `game/js/world.js`, replace:
```js
    if (p.civ === 'chinese') { p.res.food = Math.max(0, p.res.food - 150); for (let k = 0; k < 3; k++) spawnUnit('villager', i, p.startX + 3, p.startY - 1 + k); }
    if (p.civ === 'spanish') spawnUnit('villager', i, p.startX - 3, p.startY);
```
with:
```js
    // the civ's extra start villagers belong to a match: an editor world (reloaded on every undo) would gain them each time
    if (p.civ === 'chinese') { p.res.food = Math.max(0, p.res.food - 150); if (!settings.editor) for (let k = 0; k < 3; k++) spawnUnit('villager', i, p.startX + 3, p.startY - 1 + k); }
    if (p.civ === 'spanish' && !settings.editor) spawnUnit('villager', i, p.startX - 3, p.startY);
```

- [ ] **Step 4: Boot fills the editor's mirror**

In `game/js/session.js`, replace:
```js
  initMenus = function () { previous(); $('#btn-load').onclick = () => MatchSave.openLoad(); $('#btn-tutorial').onclick = startTutorial; $('#btn-controls').onclick = openControls; };
```
with:
```js
  initMenus = function () {
    previous(); $('#btn-load').onclick = () => MatchSave.openLoad(); $('#btn-tutorial').onclick = startTutorial; $('#btn-controls').onclick = openControls;
    // the editor's maps come from IndexedDB: the setup screen waits for them, so its custom-map list is complete
    Editor.ready = Editor.loadAll().then(n => { if (Editor.active && Editor.ui) Editor.refreshList(); return n; }, () => 0);
    const setup = $('#btn-sp').onclick; $('#btn-sp').onclick = e => Editor.ready.then(() => setup(e));
  };
```

- [ ] **Step 5: The reliability check of map names, on the mirror**

The old check wrote through a fake `localStorage` and expected a synchronous throw on quota. Storage is now async. The name check stays synchronous, on the mirror, and the quota case moves to `tests/editor.test.js`, which waits for promises.
In `tests/reliability.test.js`, replace:
```js
test('map storage preserves special names and handles quota errors', () => {
  c.localStorage = { value: '{}', getItem() { return this.value; }, setItem(k, v) { this.value = v; } };
  assert.equal(run(`Editor.store('__proto__', Editor.toSpec()); Editor.savedList().includes('__proto__') && !!Editor.load('__proto__')`), true);
  c.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => run(`Editor.store('other',Editor.toSpec())`), /quota/);
  delete c.localStorage;
});
```
with:
```js
// (a failing store and the IndexedDB round trip are checked in tests/editor.test.js, which can wait for promises)
test('map storage preserves special names', () => {
  assert.equal(run(`(() => { const p = Editor.store('__proto__', Editor.toSpec()); p.catch(() => {}); return Editor.maps.has('__proto__') && !!Editor.load('__proto__') && ({}).polluted === undefined; })()`), true);
});
```

- [ ] **Step 6: Run the editor test**

Run: `node tests/editor.test.js`
Expected (about 60 s; observed while planning):
```
PASS 16 kinds of change (painting, water, a bridge, height, a tunnel, a trench, trees, erasing, a building, a unit, a drag, a delete, a start, a new player) each make one undo entry, and undo and redo restore exactly the map before and after each  {"kinds":16,"noops":0,"entries":16,"full":1,"undone":"1111111111111111","redone":"1111111111111111"}
PASS 60 strokes on a 480 x 480 map (37,466 tile changes, 11,106 objects) keep 0.95 MB of undo entries; the heap grew 4 MB with the 11,106 trees they planted (at most 20 MB; the old undo kept the whole map as JSON for every stroke)  {...}
PASS the last four strokes at 480 x 480 undo and redo to exactly the maps between them  {...,"back":"1111","fwd":"1111"}
PASS a custom size makes a blank map of that side (144), up to what validateMapSpec allows: 256 today, 480 with the cap raised (480)  {"Z":{"plain":256,"n144":144},"max":480}
PASS a saved map goes to IndexedDB packed (94,298 characters for a 124,710-character spec), loads back the same, survives a reload of the mirror, and deletes  {...}
PASS a map the store cannot take (quota) is refused with QuotaExceededError and does not stay in the list  {"err":"QuotaExceededError","listed":false}
PASS a 9 MB map file (over the old 8 MB limit) and a gzip one import; a malformed one is refused  {"size":9437184,"big":true,"gz":true,"bad":"Map size must be an integer from 16 to 256."}
7 passed, 0 failed
```
The tree brush places trees at random (`Math.random`, editor.js), so the tile and object counts vary a little from run to run. The bounds do not.

- [ ] **Step 7: The browser: maps across a reload, a custom size, a 9 MB import**

Append to the end of `tests/browser/saves.spec.js`:
```js

test('the editor keeps its maps in IndexedDB across a reload, makes custom sizes and imports a 9 MB map', async ({ page }) => {
  await page.locator('#btn-editor').click();
  await page.locator('#ed-gsize').selectOption('custom');
  await page.locator('#ed-gn').fill('144');
  await page.locator('#ed-blank').click();
  expect(await page.evaluate(() => __game.W.n)).toBe(144);
  await page.locator('#ed-name').fill('Kept Map');
  await page.locator('#ed-save').click();
  await expect(page.locator('#ed-status')).toContainText('Saved "Kept Map"');
  await reload(page);
  await page.evaluate(() => Editor.ready);
  await page.locator('#btn-editor').click();
  await expect(page.locator('#ed-list option', { hasText: 'Kept Map' })).toHaveCount(1);
  await page.locator('#ed-list').selectOption('Kept Map');
  await page.locator('#ed-load').click();
  await expect(page.locator('#ed-status')).toContainText('Loaded "Kept Map"');
  expect(await page.evaluate(() => __game.W.n)).toBe(144);
  // a map file past the old 8 MB import limit
  const spec = await page.evaluate(() => Editor.toSpec()), text = JSON.stringify(spec), big = text + ' '.repeat(9 * 1024 * 1024 - text.length);
  await page.locator('#ed-import').setInputFiles({ name: 'big.aoemap.json', mimeType: 'application/json', buffer: Buffer.from(big) });
  await expect(page.locator('#ed-status')).toContainText('Imported big.aoemap.json');
});
```

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test saves.spec.js game.spec.js`
Expected: `14 passed`. That includes game.spec's two editor tests (malformed imports, names and engineering layers), unchanged.

- [ ] **Step 8: Syntax, the other suites and commit**

Run: `npm run test:syntax`
Expected: `106 scripts passed syntax checks.`
Run `node tests/<name>.test.js` for reliability, geography-geology, sim-signature and autosave.
Expected: `18`, `20`, `4` and `8` passed, each with `0 failed`.
```bash
git add game/js/editor.js game/js/world.js game/js/session.js tests/editor.test.js tests/reliability.test.js tests/browser/saves.spec.js
git commit -m "feat(editor): maps in IndexedDB, undo by tile diffs, custom sizes, imports up to 256 MB

Maps live in the maps store (packed like saves) with an in-memory mirror,
so the setup screen stays synchronous. Undo keeps the tiles and objects a
change touched instead of the whole map as JSON: 60 strokes at 480 take
under 1 MB of entries (the old undo kept the whole map's JSON per stroke:
1.7 M characters at 400).
Undo is now exact: editor worlds no longer gain the Chinese and Spanish
start villagers on every reload. A custom size goes up to what
validateMapSpec allows (480 once phase 8 lifts the cap), and imports read
plain or gzip JSON up to the sanity cap instead of 8 MB.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Migration of the old localStorage saves and maps

Players of earlier builds have up to three things in `localStorage`:
- `aor_match_v1`, the manual save;
- `aor_autosave_v1`, the autosave;
- `aoe_maps`, all editor maps in one JSON object.

On the first start of this build, `MatchSave.migrateStorage()` moves them (session.js, before the editor reads its maps):
- **The manual save** goes to the first free slot.
- **The autosave** goes to `auto`, or to a free slot if `auto` is taken.
- **Saves are converted on the way:** `parse` → `convert`, without loading the match. Format 1 gets the AI stagger once.
- **Each map** goes to the `maps` store under its name. A different map already there under that name keeps the old one as `<name> (old storage)`.
- **Originals.** Every copy is read back and checked (parsed, or compared) before its original is removed. Settings keys (`aoe_setup`, `aor_controls`, …) stay.
- **Done mark.** The run is marked done (`meta` `migrated`) only when nothing was left behind. A run that failed (quota, a broken entry) leaves the originals and runs again at the next start.
- With no storage at all it does nothing.

**Files:**
- Modify: `game/js/session.js` (`convert`, `migrateStorage`, and the boot wrapper runs it first)
- Create: `tests/migrate.test.js`
- Extend: `tests/browser/saves.spec.js`, `docs/maps-perf-baseline.md`

**Interfaces:**
- Consumes:
  - `MatchSave.parse`, `parts(w, from)`, `walk`, `pack`, `saveTo`, `loadFrom`, `slotInfos`;
  - `Editor.pack`, `Editor.unpack`, `Editor.loadAll`;
  - `Store`.
- Produces:
  - `MatchSave.convert(data, savedAt) → { head, text }`;
  - `MatchSave.migrateStorage() → Promise<{ saves, maps, kept } | { already: true } | { skipped: true }>`;
  - the `meta` record `migrated`.

- [ ] **Step 1: Write the failing test**

Create `tests/migrate.test.js`:
```js
// Moving old localStorage saves and maps into IndexedDB on the first start (session.js MatchSave.migrateStorage):
// converted to format 2 (format 1 gets the AI stagger once), read back before the originals go, marked done only
// when nothing was left behind, and run again after a failure.   node tests/migrate.test.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const harness = require('./engine-harness');
const { fakeIndexedDB, fakeLocalStorage } = require('./fake-idb');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const dir = path.join(__dirname, 'fixtures/saves'), fixture = f => JSON.stringify(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString()).save);
const oldSave = fixture('2026-10-15-a2e8c0f-before-tactics.json.gz'), todaySave = fixture('2026-10-20-phase3-final-v1.json.gz');
// a map of side n (with mixed terrain, so its packed layers do not shrink to nothing)
const mapOf = (n, mixed) => ({ n, ter: Array.from({ length: n * n }, (_, i) => (mixed ? (i * 7) % 3 : 0)), elev: new Array(n * n).fill(0), objects: [{ k: 'tree', x: 3, y: 3, v: 0 }], players: [{ start: { x: 5, y: 5 }, civ: 'franks' }, { start: { x: n - 6, y: n - 6 }, civ: 'turks' }] });
function page(idb, ls) { const h = harness(); Object.assign(h.c, { indexedDB: idb, localStorage: ls, setTimeout }); return h; }
(async () => {
  // ---------- 1. a manual save (format 1, before the AI stagger), an autosave (format 1, today) and two maps ----------
  const idb = fakeIndexedDB(), ls = fakeLocalStorage(), A = page(idb, ls);
  ls.setItem('aor_match_v1', oldSave); ls.setItem('aor_autosave_v1', todaySave);
  ls.setItem('aoe_maps', JSON.stringify({ 'Old Map': mapOf(32), 'Second': mapOf(48) })); ls.setItem('aoe_setup', '{"civ":"turks"}');
  const rep = JSON.parse(await A.run('MatchSave.migrateStorage().then(r => JSON.stringify(r))'));
  const left = ['aor_match_v1', 'aor_autosave_v1', 'aoe_maps', 'aoe_setup'].filter(k => ls.getItem(k) !== null);
  const S = JSON.parse(await A.run(`(async () => {
    const infos = await MatchSave.slotInfos(), one = await MatchSave.loadFrom('1'), auto = await MatchSave.loadFrom('auto');
    const f1 = JSON.parse(one); MatchSave.restore(one); const acc = W.players.slice(1).map(p => p.ai ? +p.ai.acc.toFixed(4) : null);
    await Editor.loadAll();
    return JSON.stringify({ slots: Object.keys(infos).filter(k => infos[k]), v1: f1.version, auto: JSON.parse(auto).version, acc, maps: Editor.savedList(), map: JSON.stringify(Editor.load('Old Map')) === JSON.stringify(${JSON.stringify(mapOf(32))}), done: !!(await Store.get('meta', 'migrated')) });
  })()`));
  ok('the old manual save goes to slot 1 and the autosave to the autosave slot, both in format 2; the two maps go to the maps store', JSON.stringify(S.slots) === '["1","auto"]' && S.v1 === 2 && S.auto === 2 && JSON.stringify(S.maps) === '["Old Map","Second"]' && S.map, { rep, S });
  ok(`the save from before the AI stagger was staggered once on the way (AI acc ${S.acc.slice(1).join(', ')})`, S.acc[1] !== S.acc[2] && S.acc[1] > 0, S.acc);
  ok('the originals are gone from localStorage once read back, the setup choice stays, and the move is marked done', JSON.stringify(left) === '["aoe_setup"]' && S.done && rep.kept.length === 0, { left, rep });
  const again = JSON.parse(await A.run('MatchSave.migrateStorage().then(r => JSON.stringify(r))'));
  ok('a second start does nothing', again.already === true, again);

  // ---------- 2. storage fails: the originals stay and the next start tries again ----------
  const bad = fakeIndexedDB({ quota: 1000 }), ls2 = fakeLocalStorage(), B = page(bad, ls2);
  ls2.setItem('aor_match_v1', todaySave); ls2.setItem('aoe_maps', JSON.stringify({ 'Big': mapOf(64, true) }));
  const r2 = JSON.parse(await B.run('MatchSave.migrateStorage().then(r => JSON.stringify(r))'));
  const kept = ['aor_match_v1', 'aoe_maps'].filter(k => ls2.getItem(k) !== null), marked = await B.run(`Store.get('meta', 'migrated').then(Boolean)`);
  ok(`with a failing store the save and the maps stay in localStorage and the move is not marked done (${r2.kept.length} kept)`, JSON.stringify(kept) === '["aor_match_v1","aoe_maps"]' && !marked && r2.kept.length === 2, r2);
  const good = fakeIndexedDB(), C = page(good, ls2);
  const r3 = JSON.parse(await C.run('MatchSave.migrateStorage().then(r => JSON.stringify(r))'));
  ok('the next start, with working storage, moves them', r3.saves.length === 1 && r3.maps.length === 1 && ls2.getItem('aor_match_v1') === null && ls2.getItem('aoe_maps') === null, r3);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
```

Run: `node tests/migrate.test.js`
Expected: exit status 1, with `TypeError: MatchSave.migrateStorage is not a function`.

- [ ] **Step 2: The migration**

In `game/js/session.js`, replace:
```js
  // Every failure shows a message (the old autosave told only once).
```
with:
```js
  // ---------- moving the old localStorage saves and maps into IndexedDB, once ----------
  // a parsed save (parse()) as format 2 text, without loading it
  convert(data, savedAt) {
    const { head, value } = this.parts(data.world, data), out = {};
    if (savedAt) head.savedAt = savedAt;
    for (const _ of this.walk(value, out)); for (const _ of this.pack(out));
    return { head, text: JSON.stringify({ ...head, graph: { root: out.root, shapes: out.shapes, nodes: out.nodes } }) };
  },
  // The manual save goes to the first free slot and the autosave to 'auto' (or a free slot if 'auto' is taken), each
  // converted to format 2 on the way (format 1 gets the AI stagger once, in parse); the editor maps go to the maps
  // store. Each copy is read back and checked before its localStorage original is removed. The run is marked done in
  // the meta store only when nothing was left behind, so a failed or interrupted run is tried again at the next start.
  async migrateStorage() {
    let ls = null; try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { ls = null; }
    if (!ls || (await Store.open()) === 'none') return { skipped: true };
    if (await Store.get('meta', 'migrated')) return { already: true };
    const report = { saves: [], maps: [], kept: [] }, infos = await this.slotInfos();
    for (const [key, auto] of [[this.key, false], [this.autoKey, true]]) {
      const text = ls.getItem(key); if (!text) continue;
      try {
        const slot = auto && !infos.auto ? 'auto' : this.slots.find(s => !infos[s]);
        if (!slot) throw new Error('every save slot is taken');
        const { head, text: v2 } = this.convert(this.parse(text), JSON.parse(text).savedAt);
        await this.saveTo(slot, v2, head);
        const back = await this.loadFrom(slot);
        if (back !== v2) throw new Error('the copy did not read back');
        this.parse(back);
        ls.removeItem(key); infos[slot] = head; report.saves.push(key + ' -> ' + slot);
      } catch (e) { report.kept.push(key + ': ' + e.message); }
    }
    let maps = null; try { maps = JSON.parse(ls.getItem('aoe_maps') || 'null'); } catch (e) { report.kept.push('aoe_maps: ' + e.message); }
    if (maps && typeof maps === 'object' && !Array.isArray(maps)) {
      let all = true;
      for (const name of Object.keys(maps)) {
        try {
          const spec = maps[name], errors = validateMapSpec(spec); if (errors.length) throw new Error(errors[0]);
          const rec = Editor.pack(spec), have = await Store.get('maps', name);
          // a map of that name already in IndexedDB (an earlier, interrupted run) stays; a different one keeps the old map under a new name
          const target = !have || JSON.stringify(Editor.unpack(have)) === JSON.stringify(Editor.unpack(rec)) ? name : name.slice(0, 100) + ' (old storage)';
          await Store.put('maps', target, rec);
          if (JSON.stringify(Editor.unpack(await Store.get('maps', target))) !== JSON.stringify(Editor.unpack(rec))) throw new Error('the copy did not read back');
          report.maps.push(target);
        } catch (e) { all = false; report.kept.push('map ' + name + ': ' + e.message); }
      }
      if (all) ls.removeItem('aoe_maps');
    }
    if (!report.kept.length) await Store.put('meta', 'migrated', { at: new Date().toISOString(), saves: report.saves, maps: report.maps.length });
    return report;
  },
  // Every failure shows a message (the old autosave told only once).
```

- [ ] **Step 3: Boot runs it before the editor reads its maps**

In `game/js/session.js`, replace:
```js
    Editor.ready = Editor.loadAll().then(n => { if (Editor.active && Editor.ui) Editor.refreshList(); return n; }, () => 0);
```
with:
```js
    // first the old localStorage saves and maps move into IndexedDB (once), then the editor reads its maps
    Editor.ready = MatchSave.migrateStorage().catch(e => console.warn('Moving old saves into IndexedDB failed; they stay in localStorage.', e))
      .then(() => Editor.loadAll()).then(n => { if (Editor.active && Editor.ui) Editor.refreshList(); return n; }, () => 0);
```

- [ ] **Step 4: Run the test**

Run: `node tests/migrate.test.js`
Expected (about 30 s; observed while planning):
```
PASS the old manual save goes to slot 1 and the autosave to the autosave slot, both in format 2; the two maps go to the maps store  {"rep":{"saves":["aor_match_v1 -> 1","aor_autosave_v1 -> auto"],"maps":["Old Map","Second"],"kept":[]},...}
PASS the save from before the AI stagger was staggered once on the way (AI acc 0.3333, 0.6667)  [null,0.3333,0.6667]
PASS the originals are gone from localStorage once read back, the setup choice stays, and the move is marked done  {"left":["aoe_setup"],...}
PASS a second start does nothing  {"already":true}
PASS with a failing store the save and the maps stay in localStorage and the move is not marked done (2 kept)  {"saves":[],"maps":[],"kept":["aor_match_v1: The quota has been exceeded.","map Big: The quota has been exceeded."]}
PASS the next start, with working storage, moves them  {"saves":["aor_match_v1 -> 1"],"maps":["Big"],"kept":[]}
6 passed, 0 failed
```

- [ ] **Step 5: The browser: an older build's localStorage, then a start of this one**

Append to the end of `tests/browser/saves.spec.js`:
```js

test('saves and maps left in localStorage by an older build move into IndexedDB at the next start', async ({ page }) => {
  const fx = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'saves', '2026-10-20-phase3-final-v1.json.gz'))).toString());
  await page.evaluate(() => Store.del('meta', 'migrated'));   // this context's first start already ran the (empty) move: run it again
  await page.evaluate(([save, map]) => {
    localStorage.setItem('aor_match_v1', save);
    localStorage.setItem('aoe_maps', JSON.stringify({ 'Old Map': map }));
  }, [JSON.stringify(fx.save), { ...(() => { const n = 32, ter = new Array(n * n).fill(0), elev = new Array(n * n).fill(0); return { n, ter, elev }; })(), objects: [], players: [{ start: { x: 5, y: 5 }, civ: 'franks' }, { start: { x: 26, y: 26 }, civ: 'turks' }] }]);
  await reload(page);
  await page.evaluate(() => Editor.ready);
  const r = await page.evaluate(async () => ({
    left: ['aor_match_v1', 'aoe_maps'].filter(k => localStorage.getItem(k) !== null),
    migrated: !!(await Store.get('meta', 'migrated')),
    slot1: (await MatchSave.slotInfos())['1'],
    maps: Editor.savedList(),
  }));
  expect(r.left).toEqual([]);
  expect(r.migrated).toBe(true);
  expect(r.slot1 && r.slot1.version).toBe(2);
  expect(r.maps).toEqual(['Old Map']);
  await page.locator('#btn-load').click();
  await page.getByRole('button', { name: /^Slot 1 · / }).click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => [__game.W.n, __game.W.players.length - 1])).toEqual([80, 3]);
});
```

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test saves.spec.js`
Expected: `6 passed`.

- [ ] **Step 6: Every node suite and the browser suite**

Run: `npm run test:syntax`
Expected: `107 scripts passed syntax checks.`
Run: `npm test`
Expected: every suite prints a summary with `0 failed`, and the last line is `Total: 457 checks passed; 0 suites failed.` (about 12 minutes). Before phase 4 it was `Total: 400 checks passed; 0 suites failed.`
New and changed suites:
- movement-livelock 3, store 9, save-v2 12, resume 5, autosave 8, editor 7, migrate 6;
- save-compat +6 (the new fixture);
- reliability −1 (the autosave check moved);
- sim-signature +2 (the off mode).
Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser`
Expected: every test passes. Observed while planning: `53 passed (4.8m)`.
Then run `git checkout -- assets/screenshots` if `git status --short` lists them.

- [ ] **Step 7: The phase 4 perf rows, beside a same-session control of 91c0970**

Use the control clone of Task C1 Step 12, the same commands with this commit's `tests/browser/maps-perf.spec.js` copied in (its autosave measure reports `n/a` on code before phase 4):
```bash
git clone --shared G:/GitHub/age-of-realms-mod ../aor-control && git -C ../aor-control checkout --detach 91c0970
cp tests/browser/maps-perf.spec.js ../aor-control/tests/browser/maps-perf.spec.js
```
Write `../aor-control/perf.local.config.js` as in Task C1 Step 12. Then:
```bash
cd ../aor-control && AOR_PERF_SIZES=200,256 AOR_PERF_LABEL="phase 3 control (91c0970)" NODE_PATH=G:/GitHub/age-of-realms-mod/node_modules PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright node G:/GitHub/age-of-realms-mod/node_modules/@playwright/test/cli.js test --config perf.local.config.js --project=gpu; cd -
AOR_PERF_SIZES=200,256 AOR_PERF_LABEL="phase 4 final (knights median of 5)" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf
```
Expected: `2 passed` each. Move the control's two rows and the two new rows to after the C1 rows, before `### Reading these rows`, and delete the control clone.
Observed while planning, in one session:

| Label | n | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | 40 knights 3p / 8p ms: start; after 30 s (routes ok) | Save chars (serialize ms; autosave snapshot / slice / tick ms) |
|---|---|---|---|---|---|
| phase 3 control (91c0970) | 200 | 0.57 / 1.7 | 0.96 / 2.6 | 12.8 / 9.7; 15.3 / 7.7 (40/40, 40/40) | 3,170,547 (35; n/a / n/a / n/a) |
| phase 3 control (91c0970) | 256 | 0.69 / 2.1 | 1.23 / 3.1 | 11.5 / 11.2; 22.9 / 23.1 (40/40, 40/40) | 5,296,348 (60; n/a / n/a / n/a) |
| phase 4 C1 lazy joins | 200 | 0.58 / 1.9 | 0.99 / 2.9 | 5.5 / 5.8; 5.4 / 2.3 (40/40, 40/40) | 3,170,552 (40) |
| phase 4 C1 lazy joins | 256 | 0.69 / 2.2 | 1.23 / 3.4 | 8.3 / 8.5; 9.8 / 8.2 (40/40, 40/40) | 5,296,350 (60) |
| phase 4 final | 200 | 0.54 / 1.8 | 0.93 / 2.7 | 5.6 / 6.2; 4.7 / 2.1 (40/40, 40/40) | 632,853 (21; 3.4 / 5.9 / 10.6) |
| phase 4 final | 256 | 0.69 / 2.1 | 1.22 / 3.6 | 8.7 / 8.3; 8.3 / 7.6 (40/40, 40/40) | 1,043,214 (31; 3.7 / 6.1 / 6.3) |

These are the columns that phase 4 moves. The other columns (generation, 2D frame and fps, 2.5D fps, cache) stayed within run-to-run noise of the control: for example, the 2D frame at zoom 1 was 3.43 → 3.36 ms at 200, the 2.5D fps 56.8 → 56.6 and the cache 982 → 982 MB. Whole-tick medians (JSON `full`) of the final run: 8.7 / 12.7 and 13.2 / 16.2 ms at the start (200 / 256), and 5.4 / 3.2 and 9.3 / 9.1 ms after 30 s.

Check against the roadmap:
- **40 knights:** every median ≤ 16 ms with 40/40 routes (the budget).
- **Save:** at 200, under a third of the control's characters (format 2).
- **Autosave:** the snapshot (median of 5) ≤ 8 ms and the longest slice ≤ 8 ms at 200 and 256, and no tick above 16 ms while it runs at 256 (the roadmap's acceptance). At 480 the snapshot is the accepted 11.6 ms (Task 3), with a follow-up below.
- **Tick, generation, frame, fps and cache:** within run-to-run noise of the control; phase 4 does not touch them.

Add this bullet at the end of `### Reading these rows`:
```markdown
- From phase 4 on, the Save cell is `characters (serialize ms; autosave snapshot / longest slice / longest tick, ms)`: 5 autosaves in a live 8-player match (session.js `autosave`), started after 2 s of play; the snapshot (the only time an autosave holds the game) is their median. The control rows show `n/a` there. The characters are format 2 from phase 4 on.
```

- [ ] **Step 8: Commit**

```bash
git add game/js/session.js tests/migrate.test.js tests/browser/saves.spec.js docs/maps-perf-baseline.md
git commit -m "feat(saves): move old localStorage saves and maps into IndexedDB on the first start

The manual save goes to the first free slot and the autosave to auto,
converted to format 2 (a format 1 save from before phase 2 gets the AI
stagger once); the editor maps go to the maps store. Each copy is read
back and checked before its original is removed, and the move is marked
done only when nothing was left behind, so a failed run is retried at the
next start. Phase 4 perf rows beside a same-session control of 91c0970.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After Task 5: finishing the phase

As the roadmap's "How each phase ends" requires:
- `npm test`, the full browser suite (then `git checkout -- assets/screenshots`), and `npm run test:perf` against a same-session control of 91c0970. Task 5 Steps 6–7 have run all three.
- A final whole-branch review of Tasks C1, C2 and 1–5 (superpowers:requesting-code-review). Points for the reviewer:
  - **Signatures.** Only C2 re-recorded them, and only the switch-on `small-coastal-3p-castle` (`824240c4` → `ed4b5276`). The `@hpa-off` keys hold `f620967b…` and `f3599320…` from C1 on, and both modes run in every `npm test`.
  - **`MOVE.mark`** exists so that the off mode can replay the matches from before phase 3. Check that with the mark off, `followPath` is the old code path: `best` is `Infinity`, and `mvAt` is never set.
  - **A blocked click's members** (`route.blocked`, C1) set off along the shared route and take their own searches' paths later (`hpaOwnDue`). Check that a member takes its own path only from where it stands and only when it is no longer than what is left of the shared one (+`HPA.ownSlack`); that own searches wait until the group's joins are done, so every member still moves within 3 ticks; that the charge (`PF.expanded`, `HPA.ownUnit`) counts tiles and never time, which would make the simulation depend on the machine; and that a route that stops short (the forest and attack-move pocket tests) still shares its pocket search. The mine test is within 9/10 of the per-unit count (232 of 400 against 244).
  - **The autosave's snapshot.** `freeze` must copy all that a save holds, at once. A record is kept as values only when its prototype is `Object.prototype`, its id is an integer, in range and not seen before, and every value is a primitive; `at()` recognises it by identity in the snapshot's `items`. Check that `walk(snap.root, out, 0, snap)` gives `serialize()`'s graph (autosave.test.js changes every kind of state between the slices), and that nothing the walk reads after the snapshot is live.
  - **Group state is not saved** (`HPA_GROUP`): a save made while members wait for their join resumes with them routing alone (`tests/resume.test.js`), and a blocked click's member still waiting for its own search keeps its shared path.
  - **Format 1 stays readable for good:** the old decoder is kept verbatim, with only its limits scaled.
- Merge on the user's choice (superpowers:finishing-a-development-branch).

**For later phases.**
- **A task for a later phase: the autosave's snapshot at 480.** Dirty-mark changed resources at their write sites (gathering and felling in world.js, water.js, terra.js, terrain.js) so the snapshot copies only what changed; target ≤ 8 ms at 480 with 8 players. Phase 4 accepts the measured 11.6 ms (Task 3).
- **Phase 5 and the editor.** The editor still runs `computeRegions` and `computeVH` over the whole map for every stroke (editor.js `apply`, `terrainChanged`). The spec's "strokes update regions, VH and HD terrain incrementally" (§4) belongs with phase 5's dirty-tile HD terrain.
- **Phase 8** lifts `validateMapSpec`'s cap. The editor's custom size (`Editor.maxSize`) and the save limits (`MatchSave.caps`) follow on their own; the perf spec and the tests that use the cap patch can drop it.
- **Phase 9** (a forest layer, if needed) adds format 3. `MatchSave.parse` reads `file.version`, so format 1 and format 2 decoding stay as they are.
