# Project status, 2026-10-22: what is done and what is left

Development is paused here. This page records where everything stands so work can resume later.

## Where the code is

- **`main`** holds phases 1–3 of the bigger maps work, plus phase 4 Tasks C1, C2 and 1–4. It merged `feat/maps-phase4-saves` at 1d03597, then the Task 4 fix round at dccda02.
- **`feat/maps-phase4-saves`** is the phase 4 branch, at 87e9759 and fully merged. New phase 4 work continues on it, or on a fresh branch from `main`.
- **`wip/phase4-task4-fix`** (0de3e98) holds the Task 4 fix round: the editor undo fixes. It is finished, tested and merged, but **not yet re-reviewed**.
- **Process notes:** `.superpowers/sdd/progress.md` (git-ignored) is the phase 4 ledger, with every task's review results and the deferred minor findings. Its key content is copied below so it survives a clean checkout.

## Known effect of merging before Task 5

The Load menu on `main` lists only the new save slots and the autosave. **Saves made before phase 4 (`aor_match_v1`, `aor_autosave_v1`) and the editor's old `aoe_maps` maps are still in the browser's storage, but the menus cannot reach them** until Task 5's migration copies them into IndexedDB. Nothing is deleted.

## Bigger maps: done

The design is `specs/2026-10-18-bigger-maps-design.md`, and the plan for all 9 phases is `plans/2026-10-18-bigger-maps-roadmap.md`.

**Phases 1–2: test hygiene, perf baseline, indexes, staggered AI**
- Added the entity index (`game/js/index.js`) and staggered AI.
- At 200 tiles with 8 AIs, the tick p99 fell from 92 ms to 5 ms.

**Phase 3: hierarchical pathfinding (`game/js/hpa.js`)**
- A 40-knight order fell from 205–419 ms to 10–20 ms.
- Every Town Center route at 480 succeeds.

**Phase 4 (plan: `plans/2026-10-20-bigger-maps-phase4.md`)**
- **C1, lazy group joins:**
  - The 40-unit click frame is now ≤ 9 ms. This fixes the budget miss carried over from phase 3.
  - The hybrid departure means the group leaves at once on the shared route, then each unit switches to its own route.
- **C2:** fixed the crowd-movement livelock (two spearmen jittering forever).
- **Task 1, `game/js/store.js`:** IndexedDB storage with a localStorage fallback. It has open timeouts and recovers from blocked, versionchange, close and full-storage cases.
- **Task 2, save format 2 (`game/js/codec.js` and session.js):**
  - A 480 save with 8 players went from 24.7 M to 4.05 M characters.
  - v1 saves keep loading; there is a fixture test for this.
- **Task 3, saves:**
  - five save slots and an autosave;
  - a pause-free autosave: one short snapshot, then work in idle slices;
  - gzip export and import.

  Snapshot medians with 8 players: 4.4 ms at 200, 5.2 ms at 256, 10.4 ms at 480.
- **Task 4, editor:**
  - maps stored in IndexedDB;
  - undo by tile diffs (60 strokes at 480 use about 1 MB, down from about 100 MB);
  - custom sizes;
  - imports up to 256 MB, plain or gzip.

Tests at 0de3e98: `npm test` passed 489 checks, and the browser saves and game specs passed 14 tests.

## Phase 4: what is left, in order

**1. Re-review the Task 4 fix round** (0de3e98; findings in `.superpowers/sdd/task-4-review.md`). It is already merged and tested: `npm test` 489 checks, editor.test 8/8, browser saves and game specs 14/14. What it fixed:
- `Editor.open()` clears the undo history, so the old map's diffs can no longer throw on, or corrupt, the newly opened map;
- `doUndo`/`doRedo` move an entry only after the reload succeeds;
- civ, colour and team changes take a snapshot, so redo keeps them;
- the Minors: `openLoad` keeps its own modal nodes, generated custom maps need a side of 64 or more, a failed generation leaves redo alone, `remove()` rolls back, and the import picker accepts `.gz`.

**2. Task 5, migration** (brief: `.superpowers/sdd/task-5-brief.md`; plan section "Task 5"). It copies the old localStorage saves and maps into IndexedDB. It must also:
- move the `aor:*` keys that fallback sessions write;
- make the Editor button wait for `Editor.ready` (or have `loadAll` merge), because boot gets slower.

**3. Finish the phase:**
- the full `npm test` and browser suite;
- a final whole-branch review (opus), triaging the deferred minors below;
- one fix wave;
- the merge.

### Deferred minor findings from phase 4 (for the final review)

- **Autosave:**
  - The JSON pacer predicts a new kind of step from the generic maximum; make an unseen kind due once a step has run in the slice.
  - At 480, pack has a 7.8 ms margin; the RLE chunk could drop to 64 KB.
  - Split the rehearsal's dry freeze into smaller pieces.
  - The rehearsal's timeouts run back to back, and frame latency isn't measured.
  - No test checks the 8-player first snapshot.
  - `lastHead` is set before the final liveness check.
- **Saves:**
  - `saveTo` uses two transactions.
  - The compiler-blocked fallback is untested.
  - gzip `reader.cancel()` is not awaited, and its errors are raw.
  - The `maxAll < 80` assertion is vacuous.
  - No test runs a v1 plain-JSON file through `readTextFile`.
  - `Store.mode` stays `idb` during a failing reopen.
- **HPA and movement:**
  - `hpaUpkeep` refill gaps.
  - There is a load spike after a mid-join save.
  - No direct `hpaUpkeep` test exists.
  - The PATHB deferral keeps a stale movement mark.
  - Repath churn on the spot (seen with a boar) is not measured.

### User decisions in force

- The autosave is pause-free.
- The snapshot is ≤ 8 ms (median) at 200 and 256.
- 480 is accepted at its current cost. That includes the one-time first-autosave hitch of 13.8–19.1 ms, and the occasional 8.3 ms first snapshot at 256 with 8 players.
- **Dirty-marking** (copy only changed resources) is a later follow-up. It should bring 480 under 8 ms and remove the first-autosave cost.

## Bigger maps: later phases (roadmap)

- **Phase 5: rendering at scale** (chunked 2D/2.5D terrain cache, frame budgets at 480).
- **Phase 6: navigation** (zoom to about 0.3 with icons, larger minimap, full-screen strategic map, scaled and drag scrolling).
- **Phase 7: content and pacing** (area-scaled expansions, forests, rivers and mountains; AI, relic, wonder and trade timers scaled by base distance).
- **Phase 8: switch on the big presets** (Small 144 … Normal 200 default … Ludicrous 480; cap 512) and re-measure.
- **Phase 9 (only if phase 8 misses budgets): forest layer.**

Also carried over from phase 3: route cost at 480, recomputing global components on every rebuild, siege routing behind enemy gates, `hpaSnap` ignoring regions, and stale `blk` on restore.

## Other work

- **Saracens building set:** brainstorming is paused after design sections 1–2 were approved. The decisions are:
  - eras: Abbasid (ages 0–1), Mamluk (2–3), Khedival Cairo (4), contemporary Gulf (5);
  - approach A: extend the shared Islamic kit.

  The draft is in `.superpowers/notes/saracens-design-draft.md`. The next step is to present sections 3–4, then write the spec. After the Saracens come the Franks and the other civs, each with its own building style.
- **Environment:** drive G: is FAT32, which has caused partial merges and git maintenance failures. Converting it to NTFS, or moving the repo to D:, is still the user's decision.
