# Bigger Maps — Phase 3 Implementation Plan (hierarchical pathfinding and group routes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the phase 2 index follow-ups, then make long routes and big group orders cheap and reliable on any map size: a 16 × 16-cluster graph per movement class, `findPath` answering long routes through it, one shared route per group order, every Town Center reaching every other at 480 × 480, and new performance rows. Match outcomes change exactly once, on purpose, in Task 7.
**Architecture:** Tasks 1–3 move the last whole-`W.list` scans named by the phase 2 review (four in ai.js, `recalcPop`, `wlCapacity`) onto the entity index and add a lint that keeps owner writes and `W.list` changes inside index.js, `addEnt` and `removeEnt`. Tasks 4–6 add `game/js/hpa.js` behind one switch, `HPA.enabled`, off while they land:
- **Task 4: the cluster graph.** It follows findPath's own step rule and is rebuilt cluster by cluster wherever passability changes.
- **Task 5: routing behind `findPath`.**
  - A goal within 24 tiles first tries the old grid search with a 2,000-node budget.
  - An unreachable goal is rejected through the graph's components and answered with the nearest reachable tile.
  - Any other route is found on the graph, then refined by the grid A* inside the clusters of that route.
  - The open lists are typed-array heaps. Smoothing looks at most 64 points ahead. The 4,000-point cap is gone.
- **Task 6: group orders.** A group order shares one route, and `cmdFindBreach` reuses a group's answer.

Task 7 switches the hierarchy on and re-records the golden simulation signatures, the only point where they change. Task 8 checks every Town Center pair at 480 and records the phase 3 performance rows beside a same-session control run of the phase 2 commit.
**Tech Stack:** plain browser JS (`game/js/*.js`, loaded in order by `game/index.html`), Node 22 vm tests (`tests/*.test.js`, `tests/engine-harness.js`, collected by `tests/run-all.js`), Playwright 1.64.1 with Chromium 1248 (`tests/browser/*.spec.js`).

**Spec:** [docs/superpowers/specs/2026-10-18-bigger-maps-design.md](../specs/2026-10-18-bigger-maps-design.md) §3 "Pathfinding" and §5. **Roadmap:** [2026-10-18-bigger-maps-roadmap.md](2026-10-18-bigger-maps-roadmap.md), Phase 3. **Evidence:** [docs/superpowers/specs/2026-10-18-map-evaluation.md](../specs/2026-10-18-map-evaluation.md) E§5.3–5.4 and T4.

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
| `game/js/ai.js` | 1 | Modify | `fishIn`, `partnerMarket`; `navalTarget` and `strength` through the index |
| `tests/index-ai.test.js` | 1 | Modify | The four old scans as `OLD`, compared against the new queries; two allied teams with markets so the comparison sees real answers |
| `game/js/world.js` | 2, 4, 5, 6 | Modify | `recalcPop` per owner (2); `hpaDirty` in `spawnRes`, `spawnBuilding`, `removeEnt`, `completeBuilding` (4); `pathTo` passes the movement class (5) and takes a group route (6); `orderMove` hands its slots to `hpaGroupOrder` (6) |
| `game/js/wells.js` | 2 | Modify | `wlCapacity` over the owner's buildings |
| `tests/index-pop.test.js` | 2 | Create | `recalcPop` and `wlCapacity` against the old scans, and their cost |
| `tests/lint-index.test.js` | 3 | Create | Fails on entity owner writes outside index.js and on `W.list` changes outside `addEnt`, `removeEnt` and the fog ghosts; exact allow-list |
| `game/js/hpa.js` | 4, 5, 6, 7 | Create, extend | Cluster graph and its upkeep (4); hierarchical `findPath` answer and the match warm-up (5); group orders (6); switched on (7) |
| `game/index.html` | 4 | Modify | Loads `hpa.js` right after `index.js` |
| `game/js/terra.js` | 4 | Modify | `terraTouch` dirties the hierarchy; `terraFlush` keeps `computeRegions` from rebuilding it all |
| `game/js/editor.js` | 4, 5 | Modify | Dragged entities and strokes dirty the hierarchy (4); editor worlds are marked so the warm-up skips them (5) |
| `tests/bridges-tunnels.test.js`, `tests/command.test.js`, `tests/extras.test.js`, `tests/fx.test.js`, `tests/mortality.test.js`, `tests/movement.test.js`, `tests/terraform.test.js`, `tests/terrain.test.js`, `tests/units_hd.test.js`, `tests/victory.test.js`, `tests/water.test.js`, `tests/wells.test.js` | 4, 7 | Modify | Their hand-written script lists load `hpa.js` after `index.js` (4); movement, command and bridges-tunnels assert that their routes went through the hierarchy (7) |
| `tests/hpa-graph.test.js` | 4 | Create | Components equal an exact flood fill on 60 maps; the kept graph equals a fresh build after every kind of passability change |
| `game/js/map.js` | 5 | Modify | `pfGrid` (typed-array heap, optional cluster corridor and step masks, no point cap), `pfSmooth` (bounded), `findPath` dispatch on a class |
| `tests/hpa-route.test.js` | 5 | Create | Route quality on 500 pairs, leg validity, identical near routes, best effort for unreachable goals, gates, trenches, bridges, ships, tunnels, warm-up |
| `game/js/command.js` | 6 | Modify | The formation `orderMove` hands its slots to `hpaGroupOrder`; `cmdFindBreach` keeps one answer per group and starts at the failed route's end |
| `game/js/polish.js` | 6 | Modify | A request that takes its group's route is not charged to `PATHB` |
| `game/js/ui.js` | 6 | Modify | The attack-move command is a group order |
| `tests/hpa-group.test.js` | 6 | Create | 40 knights across 256: one search, one budget charge, all arrive; group membership and repaths; one breach search per group |
| `tests/sim-signature.test.js`, `tests/fixtures/sim-signatures.json` | 7 | Modify, re-record | `AOR_HPA=off` replays the old routes; the hashes re-recorded once for the new routes |
| `tests/hpa-stress.js` | 8 | Create | On-demand: every Town Center pair at 480 on land, coastal and islands (with transport) |
| `docs/maps-perf-baseline.md` | 8 | Append | Phase 2 control rows and phase 3 rows from one session; the 480 route table |

**Validated while planning.** Every task below was applied in order to a fresh copy of `feat/maps-phase3-pathfinding` at ed46ba5 (Windows 11, Node 22.17.1, Playwright 1.64.1, RTX A4000), and the outputs quoted as "observed while planning" come from that replay. `git worktree add` failed on the planning machine (`fatal: could not create leading directories of '.git/worktrees/...': Permission denied`, an ACL on `.git/worktrees` that refuses even an unsandboxed process), so the copy was a scratch `git clone --shared` checked out at ed46ba5. Browser runs used a temporary Playwright config whose `webServer` served that copy, with `@playwright/test` required from the main checkout's `node_modules`. The browser suite (47 tests) ran with the switch on. The perf runs ran back to back in one session: the phase 2 control was made with the procedure of Task 8 Step 3 (switch the same copy to ed46ba5, keep the rows, switch back). Each "replace" block was checked to occur exactly once in the file as it is at that step, and every code block in this plan is the text that ran.

**Test runs.** `npm test` (`tests/run-all.js`) runs every `tests/*.test.js`. The new suites run there; none joins the `--quick` set. `tests/hpa-stress.js` is not a `.test.js` file and runs only by hand. A full `npm test` took about 8 minutes on the planning machine after Task 7. `tests/perf.test.js` is a timing test; if its battle check fails while other programs load the CPU, run it alone (`node tests/perf.test.js`).

**Commits.** The commit messages below end with the trailer of the model that wrote this plan. An implementer running on another model puts its own `Co-Authored-By:` line there instead.

**Determinism, and the one re-record.** `tests/sim-signature.test.js` holds two golden hashes of fixed-seed AI matches (`f620967b…`, `f3599320…`, recorded in phase 2). Tasks 1–6 keep them unchanged:
- Tasks 1–2 keep every loop in `W.list` order (index lists are in id order).
- Task 3 is a test only.
- Task 4 only adds the graph and its `hpaDirty` calls, which change no game state.
- The rest of Tasks 5–6 sits behind `HPA.enabled = false`:
  - `findPath` with the switch off is the old algorithm. Its new typed-array heap pops equal keys in exactly the old order (Task 5 Step 4 proves it on the signatures).
  - `orderMove` and the attack-move command with the switch off make the old `setOrder` calls in the old order.

Task 7 switches the hierarchy on. That changes unit routes, and tactics.js:157 and :193 send AI armies with `orderMove`. Before re-recording, Task 7 replays the old hashes with the switch off (`AOR_HPA=off`) to prove that the switch is the only change. It then re-records once and says why in its commit. Tasks 5 and 6 each end with a check that is never committed: flip the switch on, run the movement, command, tactics, engineering, actors, bridges-tunnels and polish suites, then revert. A routing problem therefore shows up in the task that caused it.

**Design decisions that refine the roadmap's wording, with the evidence found while planning:**
- **Region reject uses the graph's components, not `landReg`.**
  - computeRegions joins land 4-way (map.js:117-139). findPath (map.js:173-183) and movement (movement.js:15-25) also allow a diagonal step whenever both side tiles are passable, without `canStep` on those side tiles.
  - Such a step can pass a cliff corner between two `landReg` regions. On the generated maps there are many:
    - 80 such steps on 60 medium maps (20 seeds × land, coastal, islands);
    - up to 38 on one 200 map (land, seed 2);
    - more on alpine and river maps.
  - Rejecting by `landReg` would therefore refuse reachable goals. The graph uses findPath's exact step rule, including diagonal-only crossings at cluster borders and corners, so its components are the true connected areas.
  - Task 4 checks them against an exact flood fill. It also checks them against `landReg` in a world without blockers, with exactly the regions such diagonal steps join merged.
- **Optimistic graph, and the old search as the fallback.**
  - The land graph treats built gates as open. Who may pass a gate depends on the owner and the stances (world.js:190-199), and the grid refinement applies the unit's own rule.
  - When refinement fails, `findPath` runs the old grid search with the old budget. The worst case is today's cost and answer. This happens only at a gate the unit may not use, which Task 5 tests.
  - So owner and stance changes need no rebuild.
  - Trenches, which terra.js closes to mounted, siege and trade units, get their own class, `'mounted'`, built only on maps with trenches.
- **Refinement is the grid A* restricted to the abstract route's clusters plus a ring of one cluster**, rather than one search per cluster pair.
  - The route found inside that corridor is optimal within it.
  - On 500 random pairs on 200 maps of five types, the worst length ratio to the unlimited grid A* was 1.028 (mean 0.9995). Without the ring it was 1.087.
  - The corridor search reads the graph's step masks and calls the unit's `passFn` only on gate tiles, the only tiles where the two rules can differ.
- **A goal within 24 tiles first runs the old grid search with a 2,000-node budget.**
  - When that search finishes, either finding the goal or running out of tiles, its answer is exactly the old `findPath`'s (Task 5 checks this).
  - Short routes are most routes, and they stay unchanged. In the 120 v 120 battle of tests/perf.test.js, 5,244 of 5,751 route requests took this path.
- **The best effort for an unreachable goal is the reachable tile nearest the goal.** It is found exactly, through the graph's components and per-cluster areas, with ok false. The old search could only find that tile or a farther one. Callers (gather, build, attack, trade, terra, `moveToPoint`) keep their `!pathOk && path.length === 0` give-up logic unchanged.
- **The graph is built at match start** (`worldCreated` and `worldRestored`) with every intra-cluster edge cost.
  - Built lazily instead, the first cross-map route at 256 measured 13–33 ms in the browser, against 2–4 ms warm.
  - Editor worlds are skipped.
  - Later rebuilds stay lazy, one dirty cluster at a time.
- **Group orders.** One route per group: the unit nearest the group's middle leads, and members of its owner within 12 tiles share it. A member walks a leg onto the route, the shared waypoints, then its own formation slot (command.js `cmdFormation`). Its later path requests, including followPath's repath when it is blocked, are its own.
  - *As built* (final review): an order point within `HPA.near` (24) of the group's middle is not shared at all (the group is kept for the shared breach answer only). A member joining a route that reaches the order point goes straight to its slot when `lineClear` sees it; else joins at whichever of the first 12 waypoints minimises the straight distance to it plus the route length after it (reached by `lineClear` or the 600-node search, falling back to the first waypoint or the leader's start tile), and leaves the route at the first waypoint from which the slot is in sight. Joining at the first waypoint and walking all of them had made spread groups plan 14% more path with 15 of 16 members first walking away from their slot.
  - The attack-move command (ui.js:794) becomes a group order. Without that change, `cmdFindBreach` would have no group to share its answer with.
  - The AI's own attack-moves (ai.js:557) stay per unit.

---

### Task 1: The last whole-list AI scans through the index

The phase 2 review left four `W.list` scans in ai.js: the dock's fish count (:238), the allied market for trade carts (:256), `navalTarget` (:594-614) and `strength` (:631-634). The first two become named queries so the test can compare them with the old scans, as in phase 2. All four keep `W.list` order:
- `idxAll` lists are insertion-ordered.
- `navalTarget` merges the enemies' owner lists back into id order, because its strict `<` keeps the first of equal distances.
- `strength` sums over `idxOwned(pid, 'all')`, which is in id order, so the floating-point sum is the old one.

**Files:**
- Modify: `game/js/ai.js:60` (two new queries after `deerNear`), `:238`, `:256`, `:596-599` (`navalTarget`), `:632` (`strength`)
- Modify: `tests/index-ai.test.js` (the four old scans in `OLD`, a `placeNear` helper, two allied teams with a market each, the new checks; 29 query kinds instead of 25)

**Interfaces:**
- Consumes: `idxAll(cat)`, `idxOwned(owner, kind)` (index.js).
- Produces: `AIPlayer#fishIn(reg) → number` (fish with food left in water region `reg`), `AIPlayer#partnerMarket() → bld|undefined` (the first finished allied market in `W.list` order). `navalTarget(from)` and `strength(pid)` keep their signatures. Nothing later depends on them.

- [ ] **Step 1: Add the old scans and the new checks to the test**

In `tests/index-ai.test.js`, replace:
```js
  unitOnTile(x, y) { return W.list.some(u => u.kind === 'unit' && Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); },
};
```
with:
```js
  unitOnTile(x, y) { return W.list.some(u => u.kind === 'unit' && Math.abs(u.x - x - 0.5) < 1 && Math.abs(u.y - y - 0.5) < 1); },
  fishIn(reg) { return W.list.filter(e => e.kind === 'res' && e.type === 'fish' && e.amount > 0 && W.map.waterReg[W.map.idx(e.x, e.y)] === reg).length; },
  partner(ai) { return W.list.find(e => e.kind === 'bld' && e.type === 'market' && e.built && e.owner !== ai.id && isFriend(e.owner, ai.id)); },
  naval(ai, from) {
    let best = null, bd = 1e9;
    const reg = W.map.waterReg[W.map.idx(from.x | 0, from.y | 0)];
    for (const e of W.list) {
      if (!isEnemy(ai.id, e.owner)) continue;
      let pos = null;
      if (e.kind === 'unit' && UNITS[e.type].naval && !e.inside) pos = { x: e.x, y: e.y };
      else if (e.kind === 'bld') { // coastal buildings: nearest water tile within 5
        const c = center(e); const r = e.type === 'dock' ? 0 : 4;
        for (let y = (c.y | 0) - 5; y <= (c.y | 0) + 5 && !pos; y++) for (let x = (c.x | 0) - 5; x <= (c.x | 0) + 5; x++) if (W.map.isWater(x, y) && !W.map.blk[W.map.idx(x, y)] && W.map.waterReg[W.map.idx(x, y)] === reg) { pos = { x: x + 0.5, y: y + 0.5 }; break; }
        if (!pos) continue;
        void r;
      }
      if (!pos) continue;
      if (W.map.waterReg[W.map.idx(Math.max(0, pos.x | 0), Math.max(0, pos.y | 0))] !== reg && !(e.kind === 'bld')) continue;
      const d = Math.hypot(pos.x - from.x, pos.y - from.y) + (e.kind === 'bld' ? 10 : 0);
      if (d < bd) { bd = d; best = pos; }
    }
    return best;
  },
  strength(pid) { let s = 0; for (const e of W.list) if (e.owner === pid && !e.dying) { if (e.kind === 'unit') s += e.type === 'villager' ? 0.3 : UNITS[e.type].animal ? 0 : 1 + (e.maxhp / 100); else if (e.kind === 'bld') s += e.type === 'castle' ? 8 : e.type === 'tc' ? 5 : 0.3; } return s + W.players[pid].age * 6; },
};
// a finished building of the given type on the first free spot in rings round the player's start
function placeNear(p, type) { for (let r = 6; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = (p.startX | 0) + dx, y = (p.startY | 0) + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) === r && W.map.inb(x, y) && !canPlace(p, type, x, y)) return spawnBuilding(type, p.id, x, y, true); } return null; }
```

In `tests/index-ai.test.js`, replace:
```js
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(5), counts = {}, wrong = {};
```
with:
```js
  for (const [a, b] of [[1, 2], [3, 4]]) W.players[a].stance[b] = W.players[b].stance[a] = 'ally';   // two teams...
  for (const p of [W.players[2], W.players[4]]) placeNear(p, 'market');   // ...and an allied market for each team
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const rnd = mulberry32(5), counts = {}, wrong = {}, found = {};
  const water = () => { for (let k = 0; k < 400; k++) { const x = (rnd() * W.n) | 0, y = (rnd() * W.n) | 0; if (W.map.isWater(x, y)) return { x: x + 0.5, y: y + 0.5 }; } return { x: 0.5, y: 0.5 }; };
```

In `tests/index-ai.test.js`, replace:
```js
      for (let q = 1; q < W.players.length; q++) for (let k = 0; k < 3; k++) { const cx = rnd() * W.n, cy = rnd() * W.n; check('attackTargets', ai.attackTargets(q, cx, cy), OLD.attack(q, cx, cy)); }
```
with:
```js
      for (let q = 1; q < W.players.length; q++) for (let k = 0; k < 3; k++) { const cx = rnd() * W.n, cy = rnd() * W.n; check('attackTargets', ai.attackTargets(q, cx, cy), OLD.attack(q, cx, cy)); }
      for (let k = 0; k < 3; k++) { const w = water(), reg = W.map.waterReg[W.map.idx(w.x | 0, w.y | 0)], f = ai.fishIn(reg); check('fishIn', f, OLD.fishIn(reg)); if (f) found.fishIn = (found.fishIn || 0) + 1;
        const nt = ai.navalTarget(w); check('navalTarget', JSON.stringify(nt), JSON.stringify(OLD.naval(ai, w))); if (nt) found.navalTarget = (found.navalTarget || 0) + 1; }
      const pm = ai.partnerMarket(); check('partnerMarket', pm, OLD.partner(ai)); if (pm) found.partnerMarket = (found.partnerMarket || 0) + 1;
      for (let q = 1; q < W.players.length; q++) check('strength', ai.strength(q), OLD.strength(q));
```

In `tests/index-ai.test.js`, replace:
```js
  return JSON.stringify({ t: W.t, total, wrong, counts });
})()`));
ok(`every AI, geology and water query equals its old W.list scan (${D.total} comparisons in 8 game minutes)`, D.total > 5000 && Object.keys(D.wrong).length === 0 && Object.keys(D.counts).length === 25, D);
```
with:
```js
  return JSON.stringify({ t: W.t, total, wrong, counts, found });
})()`));
ok(`every AI, geology and water query equals its old W.list scan (${D.total} comparisons in 8 game minutes)`, D.total > 5000 && Object.keys(D.wrong).length === 0 && Object.keys(D.counts).length === 29, D);
ok('the fish count, naval target and allied-market queries were compared on real answers, not only on empty ones', D.found.fishIn > 0 && D.found.navalTarget > 0 && D.found.partnerMarket > 0, D.found);
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node tests/index-ai.test.js`
Expected: FAIL, exit status 1, before any summary:
```
TypeError: ai.fishIn is not a function
```

- [ ] **Step 3: The four queries through the index**

In `game/js/ai.js`, replace:
```js
  deerNear(home) { return idxOwned(0, 'unit').find(a => a.type === 'deer' && Math.hypot(a.x - home.x, a.y - home.y) < 20); }
```
with:
```js
  deerNear(home) { return idxOwned(0, 'unit').find(a => a.type === 'deer' && Math.hypot(a.x - home.x, a.y - home.y) < 20); }
  fishIn(reg) { let c = 0; for (const e of idxAll('res:fish')) if (e.amount > 0 && W.map.waterReg[W.map.idx(e.x, e.y)] === reg) c++; return c; }
  partnerMarket() { for (const e of idxAll('bld')) if (e.type === 'market' && e.built && e.owner !== this.id && isFriend(e.owner, this.id)) return e; return undefined; }
```

In `game/js/ai.js`, replace:
```js
      const fish = W.list.filter(e => e.kind === 'res' && e.type === 'fish' && e.amount > 0 && W.map.waterReg[W.map.idx(e.x, e.y)] === W.map.waterReg[W.map.idx(docks[0].x + 1, docks[0].y + 1)]).length;
```
with:
```js
      const fish = this.fishIn(W.map.waterReg[W.map.idx(docks[0].x + 1, docks[0].y + 1)]);
```

In `game/js/ai.js`, replace:
```js
      const partner = W.list.find(e => e.kind === 'bld' && e.type === 'market' && e.built && e.owner !== this.id && isFriend(e.owner, this.id));
```
with:
```js
      const partner = this.partnerMarket();
```

In `game/js/ai.js`, replace:
```js
    const reg = W.map.waterReg[W.map.idx(from.x | 0, from.y | 0)];
    for (const e of W.list) {
      if (!isEnemy(this.id, e.owner)) continue;
      let pos = null;
```
with:
```js
    const reg = W.map.waterReg[W.map.idx(from.x | 0, from.y | 0)];
    // the enemies' units and buildings, merged into W.list order: the strict < below keeps the first of equal distances
    const foes = [];
    for (let i = 1; i < W.players.length; i++) if (isEnemy(this.id, i)) for (const e of idxOwned(i, 'all')) foes.push(e);
    foes.sort((a, b) => a.id - b.id);
    for (const e of foes) {
      let pos = null;
```

In `game/js/ai.js`, replace:
```js
    let s = 0; for (const e of W.list) if (e.owner === pid && !e.dying) { if (e.kind === 'unit') s += e.type === 'villager' ? 0.3 : UNITS[e.type].animal ? 0 : 1 + (e.maxhp / 100); else if (e.kind === 'bld') s += e.type === 'castle' ? 8 : e.type === 'tc' ? 5 : 0.3; }
```
with:
```js
    let s = 0; for (const e of idxOwned(pid, 'all')) if (!e.dying) { if (e.kind === 'unit') s += e.type === 'villager' ? 0.3 : UNITS[e.type].animal ? 0 : 1 + (e.maxhp / 100); else if (e.kind === 'bld') s += e.type === 'castle' ? 8 : e.type === 'tc' ? 5 : 0.3; }   // id order, so the float sum is the old one
```

- [ ] **Step 4: Run the test again**

Run: `node tests/index-ai.test.js`
Expected (about 45 s; observed while planning):
```
PASS every AI, geology and water query equals its old W.list scan (9067 comparisons in 8 game minutes)  {...,"wrong":{},...}
PASS the fish count, naval target and allied-market queries were compared on real answers, not only on empty ones  {"fishIn":288,"navalTarget":277,"partnerMarket":48}
PASS 200 map, 8 AI players, 90 game seconds: the indexed match ends in exactly the brute-force state  {...}
PASS AI time per tick drops 5.9× with the index (at least 3×)  {...}
4 passed, 0 failed
```

- [ ] **Step 5: The match outcome is unchanged**

Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, with `"got":"f620967b4318fae0eb0477b6cfc44259a3e3ec66"` and `"got":"f3599320291fc01383e6d58f4c82a3230c7b398b"`.

- [ ] **Step 6: Commit**

```bash
git add game/js/ai.js tests/index-ai.test.js
git commit -m "perf(ai): the last whole-list AI scans use the entity index

The dock's fish count, the allied market for trade carts, navalTarget and
strength no longer scan W.list. Each keeps W.list order, so every answer
and the match signatures are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Population and water capacity per owner

`recalcPop` (world.js:1492-1500) runs every 20 ticks and on every birth, death and finished building, and wells.js wraps it with `wlCapacity` (wells.js:63-70) for every player. Both scan all of `W.list`, trees included. Each player's own units and buildings come from `idxOwned`. The sums are integer, or in id order, so every figure is the old one.

**Files:**
- Create: `tests/index-pop.test.js`
- Modify: `game/js/world.js:1492-1498` (`recalcPop`), `game/js/wells.js:63-66` (`wlCapacity`)

**Interfaces:**
- Consumes: `idxOwned(owner, 'unit' | 'bld')` (index.js).
- Produces: `recalcPop()` and `wlCapacity(p)` with unchanged signatures and results.

- [ ] **Step 1: Write the failing test**

Create `tests/index-pop.test.js`:
```js
// Population and water capacity through the entity index: recalcPop (world.js) and wlCapacity (wells.js) give exactly
// the answers of the W.list scans they replaced (kept below verbatim as OLD), sampled through a 4-player AI match, and
// their cost no longer grows with the trees on the map.   node tests/index-pop.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
var OLD = {
  recalcPop() {
    for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.pop = 0; p.popCap = 0; }
    for (const e of W.list) {
      const p = W.players[e.owner]; if (!p) continue;
      if (e.kind === 'unit' && !UNITS[e.type].animal && e.type !== 'cobra' && !e.dying) p.pop++;
      if (e.kind === 'bld' && e.built && BUILDINGS[e.type].pop) p.popCap += e.type === 'tc' && p.tcPop ? p.tcPop : BUILDINGS[e.type].pop;
    }
    for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.popCap = Math.min(200, p.popCap); }
  },
  wlCapacity(p) {
    let cap = WELLM.base;
    for (const e of W.list) {
      if (e.owner !== p.id || e.kind !== 'bld' || !e.built || e.dying) continue;
      if (e.type === 'tc') cap += wlTcSupply(e); else if (e.type === 'well') cap += wlWellSupply(e);
    }
    return cap;
  },
  // recalcPop as the game runs it: wells.js wraps it and fills in the water figures
  all() { OLD.recalcPop(); for (const p of W.players.slice(1)) { p.waterCap = OLD.wlCapacity(p); p.waterDef = WELLM.enabled && p.pop > p.waterCap ? (p.pop - p.waterCap) / p.pop : 0; } },
};
`);

// ---------- 1. the same answers through a 4-player match ----------
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'small', seed: 13, mapType: 'land', numPlayers: 4 });
  createWorld(spec, { players: Array.from({ length: 4 }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i * 3 + 2], color: PLAYER_COLORS[i], human: i === 0 })), seed: 13, fog: 'normal', startRes: 'high', startAge: 1, difficulty: 'standard' });
  for (const p of W.players.slice(1)) p.ai = new AIPlayer(p, 'standard');
  W.spectate = true;
  const state = () => JSON.stringify(W.players.slice(1).map(p => [p.pop, p.popCap, p.waterCap, p.waterDef]));
  let samples = 0, wrong = 0, wells = 0, maxPop = 0;
  for (let s = 0; s < 30; s++) {
    for (let i = 0; i < 400; i++) worldTick(0.05);   // 20 game seconds between samples, 10 game minutes in all
    OLD.all(); const a = state();
    recalcPop(); const b = state();
    samples++; if (a !== b) wrong++;
    for (const p of W.players.slice(1)) { if (wlCapacity(p) !== OLD.wlCapacity(p)) wrong++; maxPop = Math.max(maxPop, p.pop); }
    wells = Math.max(wells, W.list.filter(e => e.type === 'well').length);
  }
  return JSON.stringify({ samples, wrong, wells, maxPop, t: W.t });
})()`));
ok(`recalcPop and wlCapacity equal their old W.list scans (${D.samples} samples, 4 AI players, 10 game minutes)`, D.samples === 30 && D.wrong === 0 && D.maxPop > 30 && D.wells > 0, D);

// ---------- 2. the cost: owners' lists instead of every tree on a 200 map ----------
const S = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'gigantic', seed: 33, mapType: 'land', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 33, fog: 'normal', startRes: 'high', startAge: 1 });
  const time = f => { f(); const t0 = performance.now(); for (let i = 0; i < 300; i++) f(); return (performance.now() - t0) / 300; };
  const oldMs = time(OLD.all), newMs = time(recalcPop);
  return JSON.stringify({ entities: W.list.length, oldMs: +oldMs.toFixed(3), newMs: +newMs.toFixed(3), ratio: +(oldMs / newMs).toFixed(1) });
})()`));
ok(`on a 200 map with ${S.entities} entities, recalcPop costs a fraction of the old scan (${S.ratio}× less, at least 3×)`, S.ratio >= 3, S);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch the cost check fail**

Run: `node tests/index-pop.test.js`
Expected: FAIL (the answers already agree, since the code still is the old scan; the cost does not):
```
PASS recalcPop and wlCapacity equal their old W.list scans (30 samples, 4 AI players, 10 game minutes)  {"samples":30,"wrong":0,"wells":6,"maxPop":36,"t":600.000000000002}
FAIL on a 200 map with 7722 entities, recalcPop costs a fraction of the old scan (1× less, at least 3×)  {...}
1 passed, 1 failed
```

- [ ] **Step 3: Count each owner's own lists**

In `game/js/world.js`, replace:
```js
function recalcPop() {
  for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.pop = 0; p.popCap = 0; }
  for (const e of W.list) {
    const p = W.players[e.owner]; if (!p) continue;
    if (e.kind === 'unit' && !UNITS[e.type].animal && e.type !== 'cobra' && !e.dying) p.pop++;
    if (e.kind === 'bld' && e.built && BUILDINGS[e.type].pop) p.popCap += e.type === 'tc' && p.tcPop ? p.tcPop : BUILDINGS[e.type].pop;
  }
```
with:
```js
function recalcPop() {
  for (let i = 1; i < W.players.length; i++) { const p = W.players[i]; p.pop = 0; p.popCap = 0; }
  for (let i = 1; i < W.players.length; i++) {   // each player's own units and buildings (index.js), not the whole of W.list
    const p = W.players[i];
    for (const e of idxOwned(i, 'unit')) if (!UNITS[e.type].animal && e.type !== 'cobra' && !e.dying) p.pop++;
    for (const e of idxOwned(i, 'bld')) if (e.built && BUILDINGS[e.type].pop) p.popCap += e.type === 'tc' && p.tcPop ? p.tcPop : BUILDINGS[e.type].pop;
  }
```

In `game/js/wells.js`, replace:
```js
function wlCapacity(p) {
  let cap = WELLM.base;
  for (const e of W.list) {
    if (e.owner !== p.id || e.kind !== 'bld' || !e.built || e.dying) continue;
```
with:
```js
function wlCapacity(p) {
  let cap = WELLM.base;
  for (const e of idxOwned(p.id, 'bld')) {   // the player's buildings (index.js), in W.list order
    if (!e.built || e.dying) continue;
```

- [ ] **Step 4: Run the test again**

Run: `node tests/index-pop.test.js`
Expected (observed while planning; the ratio varies from run to run):
```
PASS recalcPop and wlCapacity equal their old W.list scans (30 samples, 4 AI players, 10 game minutes)  {"samples":30,"wrong":0,"wells":6,"maxPop":36,"t":600.000000000002}
PASS on a 200 map with 7722 entities, recalcPop costs a fraction of the old scan (35× less, at least 3×)  {...}
2 passed, 0 failed
```

- [ ] **Step 5: The wells suite and the match outcome**

Run: `node tests/wells.test.js`
Expected: `8 passed, 0 failed`.
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, with the same two hashes as in Task 1 Step 5.

- [ ] **Step 6: Commit**

```bash
git add game/js/world.js game/js/wells.js tests/index-pop.test.js
git commit -m "perf: population and water capacity count each owner through the index

recalcPop and wlCapacity read the owner lists instead of all of W.list
(trees included). The figures are the same; the signatures are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lint owner writes and `W.list` changes

The index stays in step with the world only if owners change through `idxSetOwner` and `W.list` changes only in `addEnt` and `removeEnt`. The phase 2 notes ask for a test that enforces this.

The allow-list comes from searching game/js at ed46ba5 for every `.owner` assignment and every `W.list` mutation (`=`, `.length =`, `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`), and for `W.list` held under another name. The only legitimate matches are:

| Rule | File | Count | Lines at ed46ba5 | Why |
|---|---|---|---|---|
| owner writes | index.js | 3 | :94 `r.owner = owner`, :95 `e.owner = owner`, :114 `r.owner = e.owner` | `idxSetOwner` and `idxSync` |
| owner writes | editor.js | 2 | :176 and :180 `this.owner = …` | the editor brush's chosen player, not an entity |
| `W.list` changes | world.js | 2 | :135 `W.list.push(e)` (`addEnt`), :181 `W.list.splice(i, 1)` (`removeEnt`) | the two upkeep points |
| `W.list` changes | victory.js | 3 | :554 `push`, :557 `W.list.length = n0`, :558 `splice` | `vicWithGhosts`: fog-memory ghosts for one frame |
| `W.list` aliases | index.js | 1 | :38 `IDX.list = W.list` | the index remembers which list it describes |

Counts are exact per file, so a new write in an allowed file fails the lint too.

**Files:**
- Create: `tests/lint-index.test.js`

**Interfaces:**
- Consumes: the source text of `game/js/*.js`.
- Produces: an `npm test` suite that later tasks keep green. hpa.js (Tasks 4–6) writes no owner and does not change `W.list`.

- [ ] **Step 1: Write the lint**

Create `tests/lint-index.test.js`:
```js
// The entity index (game/js/index.js) stays in step with W.list only if owners change through idxSetOwner and
// W.list changes only in addEnt and removeEnt. This lint fails on any other entity owner write or W.list mutation in
// game/js. The allow-list is exact: each listed file must contain exactly that many matches, so a new write in an
// allowed file fails too, and so does an entry that no longer matches.   node tests/lint-index.test.js
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'game', 'js');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const RULES = [
  {
    name: 'entity owner writes go through idxSetOwner (index.js)',
    re: /\.owner\s*(?:[-+*|&]|\?\?|\|\||&&)?=(?!=)/g,
    allow: {
      'index.js': { count: 3, why: 'idxSetOwner and idxSync: the index record (r.owner) and the entity (e.owner)' },
      'editor.js': { count: 2, why: 'this.owner: the editor brush\'s chosen player, not an entity' },
    },
  },
  {
    name: 'W.list changes only in addEnt and removeEnt (world.js)',
    re: /\bW\.list\s*(?:=(?!=)|\.length\s*=(?!=)|\.(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\()/g,
    allow: {
      'world.js': { count: 2, why: 'addEnt pushes, removeEnt splices' },
      'victory.js': { count: 3, why: 'vicWithGhosts appends fog-memory ghosts for one frame and takes them off again (push, length =, splice)' },
    },
  },
  {
    name: 'W.list is not kept under another name (an alias could be mutated unseen)',
    re: /(?:\b(?:const|let|var)\s+[\w$]+|[\w$.\]]+)\s*=\s*W\.list\s*[;,)]/g,
    allow: {
      'index.js': { count: 1, why: 'IDX.list = W.list: the index remembers which list it describes' },
    },
  },
];
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
for (const rule of RULES) {
  const found = {}, bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    src.split(/\r?\n/).forEach((line, i) => { const m = line.match(rule.re); if (m) { found[f] = (found[f] || 0) + m.length; if (!rule.allow[f]) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`); } });
  }
  const counts = Object.entries(rule.allow).filter(([f, a]) => (found[f] || 0) !== a.count).map(([f, a]) => `${f}: ${found[f] || 0} found, ${a.count} allowed`);
  ok(rule.name, !bad.length && !counts.length, bad.length || counts.length ? { outside: bad, counts } : found);
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `node tests/lint-index.test.js`
Expected:
```
PASS entity owner writes go through idxSetOwner (index.js)  {"editor.js":2,"index.js":3}
PASS W.list changes only in addEnt and removeEnt (world.js)  {"victory.js":3,"world.js":2}
PASS W.list is not kept under another name (an alias could be mutated unseen)  {"index.js":1}
3 passed, 0 failed
```

- [ ] **Step 3: Check that it catches a violation**

Append this line to the end of `game/js/render.js` (a temporary probe):
```js
function lintProbe() { W.list.sort(idxById); }
```
Run: `node tests/lint-index.test.js`
Expected: FAIL, naming the probe (render.js:1544 is the line the probe landed on while planning; yours is the line you added):
```
PASS entity owner writes go through idxSetOwner (index.js)  {"editor.js":2,"index.js":3}
FAIL W.list changes only in addEnt and removeEnt (world.js)  {"outside":["render.js:1544: function lintProbe() { W.list.sort(idxById); }"],"counts":[]}
PASS W.list is not kept under another name (an alias could be mutated unseen)  {"index.js":1}
2 passed, 1 failed
```
Then remove the probe: `git checkout -- game/js/render.js`, and check that `git status --short` lists only `?? tests/lint-index.test.js`.

- [ ] **Step 4: Commit**

```bash
git add tests/lint-index.test.js
git commit -m "test: lint owner writes and W.list changes outside the index

Fails on any entity owner write outside index.js and on any W.list change
outside addEnt, removeEnt and the fog-memory ghosts, with an exact
per-file allow-list.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Cluster graph module `game/js/hpa.js`

This task adds the hierarchy's graph and keeps it up to date. Nothing routes through it yet: `HPA.enabled` stays `false` until Task 7, and `findPath` does not consult it before Task 5.

**Design (each point is checked by `tests/hpa-graph.test.js`):**
- **Clusters.** 16 × 16 tiles (`HPA.C`). The map is ⌈n / 16⌉ clusters on a side; the last row and column may be narrower.
- **Steps.** The same rule as findPath (map.js:173-183): a step needs its target passable and `map.canStep`, and a diagonal step needs both side tiles passable. Each tile keeps an 8-bit step mask (`G.mv`), built from the class's passability (`G.P`). `canStep` is the live method, so terra.js's bridge and tunnel override applies.
- **Classes.**
  - `'land'`: `passLand(0)` with built gates open, so terra.js's bridges are included.
  - `'mounted'`: land without trench tiles. `hpaClassOf` gives it to mounted, siege and trade units on maps that have trenches (terra.js:273-281).
  - `'naval'`: `passNaval()`.
  - A graph is built on its class's first query.
- **Entrance spans.** Along each border between two clusters, a run of open crossings whose tiles also join along both sides is one span.
  - A span shorter than 6 gets one transition in its middle; a longer span gets one at each end.
  - A diagonal crossing that no orthogonal crossing beside it already connects gets its own transition. These occur at cluster corners where four clusters meet, and past a cliff corner.
  - The end tiles of the transitions are the nodes.
- **Edges.**
  - Inter edges join the two ends of a transition. They cost the step: 1 or 1.414, plus 0.3 per level climbed.
  - Intra edges join the nodes of one cluster. They cost the best route inside the cluster, from a Dijkstra (`hpaLocal`) with findPath's step costs. Each row is worked out on first use (`hpaRow`), or for every node when a match starts (Task 5).
- **Components.** Union-find joins the ends of every transition and the nodes that share a connected area (`G.lab`) inside their cluster. Task 5 rejects unreachable goals with these components.
- **Upkeep.**
  - `hpaDirty(x0, y0, x1, y1)` marks every cluster within one tile of the rectangle. That is enough, because a tile's step mask reads only its eight neighbours.
  - The next query rebuilds the marked clusters: their passability, masks and areas, the transitions on their borders and corners, and the node lists and edge rows of every cluster those transitions touch. The components are then recounted.
  - A new map (new world, loaded save, editor reload) is rebuilt whole on its first query.
  - On the live map, any `computeRegions` call except `terraFlush`'s also rebuilds everything. That is how tests and tools end a hand edit of `ter`, `elev` or `blk`; twelve test files do so.

**Passability-change sites wired to `hpaDirty`**, found by searching game/js for every write to `blk`, `ter`, `elev`, `bridge`, `tun` and `trench`, and every `computeRegions` call:

| Site | What changes | Wiring |
|---|---|---|
| `spawnRes` (world.js:141) | a blocking resource appears: map trees, planted saplings, fish (they block ships), mines, the editor's object brush | `hpaDirty` of the tile |
| `spawnBuilding` (world.js:170) | a foundation, wall, gate or dock blocks its footprint (farms never block) | `hpaDirty` of the footprint |
| `removeEnt` (world.js:184-185) | a building is destroyed or a tree, mine or fish is used up. A felled tree blocks until its wood runs out and `removeEnt` clears it | `hpaDirty` of the footprint or tile |
| `completeBuilding` (world.js:1187) | a gate finishes and opens (an unfinished gate blocks everyone) | `hpaDirty` of the gate |
| `terraTouch` (terra.js:122) | every terraform tile: canal (the tile becomes water and its neighbours drop to elevation ≤ 1), trench, raise, lower, dig, bridge, unbridge, tunnel, plant | `hpaDirty` two tiles round it |
| `terraFlush` (terra.js:126) | its own `computeRegions` | `HPA.quiet`, so the rectangle `terraTouch` marked stays the only rebuild |
| editor `moveEnt` (editor.js:211-230) | a dragged building or resource moves its block | `hpaDirty` of the old and new footprint |
| editor `terrainChanged` (editor.js:319-323) | terrain, raise, lower, flatten, bridge, tunnel, trench and erase strokes (they also call `computeRegions`) | `hpaDirty` of the stroke ± 1 |
| `createWorld`, `MatchSave.restore`, editor `loadSpec` | a new `GameMap` | rebuilt whole on its first query (`HPA.map !== W.map`) |
| any other `computeRegions` on the live map | hand edits (tests) | everything rebuilt |

Not wired, on purpose:
- Owner and stance changes: the graph treats built gates as open for everyone.
- Unit movement: units never block a tile.
- Farms and shrubs: they never block.
- Buried deposits (`depth > 0`): they never block.
- The lazy stale-`blk` clears in passLand, passNaval, terraCheck and canPlace: a stale id already counted as passable.

The editor's `terrainChanged` hook is redundant today: every stroke that changes passability also calls `computeRegions`, which rebuilds everything. So `tests/hpa-graph.test.js` cannot catch its absence (checked while planning). The hook keeps a stroke correct if that call is ever dropped.

**Files:**
- Create: `game/js/hpa.js`, `tests/hpa-graph.test.js`
- Modify: `game/index.html:40` (script tag), `game/js/world.js:141` (`spawnRes`), `:170` (`spawnBuilding`), `:184-185` (`removeEnt`), `:1189` (`completeBuilding`), `game/js/terra.js:122-130` (`terraTouch`, `terraFlush`), `game/js/editor.js:218`, `:221`, `:227` (`moveEnt`), `:322` (`terrainChanged`)
- Modify (test loaders): `tests/bridges-tunnels.test.js:8`, `tests/command.test.js:9`, `tests/extras.test.js:10`, `tests/fx.test.js:17`, `tests/mortality.test.js:10`, `tests/movement.test.js:9`, `tests/terraform.test.js:8`, `tests/terrain.test.js:9` and `:93`, `tests/units_hd.test.js:14`, `tests/victory.test.js:10`, `tests/water.test.js:8`, `tests/wells.test.js:8`

**Interfaces:**
- Consumes:
  - `PF_DX`, `PF_DY`, `GameMap` (map.js); `W`, `passLand`, `passNaval`, `UNITS`, `GameHooks` (world.js). terra.js wraps `passLand`, `canStep` and `computeRegions`; all three are looked up when a graph is built.
- Produces (globals):
  - `HPA`, the module's settings object, read by Tasks 5–7:
    - the switch: `enabled` (false);
    - `C` (16), `near` (24), `nearNodes` (2000), `smooth` (64), `weight` (1.001), `joinNodes` (600), `groupR` (12);
    - `map`, `g` (class → graph), `quiet`;
    - `stats` (`queries`, `near`, `routed`, `unreachable`, `fallback`, `rebuilt`, `groups`, `shared`).
  - `hpaClassOf(u) → 'land' | 'mounted' | 'naval'`, used by `pathTo` in Task 5.
  - `hpaPassFn(cls) → (i) => boolean`.
  - `hpaGraph(cls) → G`: the current graph with its dirty clusters rebuilt, or null without a world.
  - `hpaDirty(x0, y0, x1, y1)` and `hpaDirtyAll()`.
  - `hpaCluster(G, t) → cluster index`.
  - `hpaLocal(G, k, srcs, rev)` with `hpaD(t) → cost`: Dijkstra inside cluster k.
  - `hpaRow(G, k, a)`: intra-edge costs from node a, worked out once.

- [ ] **Step 1: Write the failing graph test**

Create `tests/hpa-graph.test.js`:
```js
// Hierarchical pathfinding graph (game/js/hpa.js): its components are the map's true connected areas, and a graph
// kept up to date through hpaDirty equals one built from scratch after every kind of passability change.
// node tests/hpa-graph.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
// Labels of an 8-way flood fill under findPath's own step rule, on the class's passability: the reference the
// graph's components must equal.
function floodLabels(cls) {
  const m = W.map, n = m.n, pass = hpaPassFn(cls), P = new Uint8Array(n * n), lab = new Int32Array(n * n).fill(-1);
  for (let i = 0; i < n * n; i++) P[i] = pass(i) ? 1 : 0;
  let next = 0; const st = [];
  for (let i = 0; i < n * n; i++) {
    if (!P[i] || lab[i] >= 0) continue;
    lab[i] = next; st.push(i);
    while (st.length) {
      const c = st.pop(), cx = c % n, cy = (c / n) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + PF_DX[d], ny = cy + PF_DY[d]; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx; if (lab[j] >= 0 || !P[j] || !m.canStep(cx, cy, nx, ny)) continue;
        if (d >= 4 && (!P[cy * n + nx] || !P[ny * n + cx])) continue;
        lab[j] = next; st.push(j);
      }
    }
    next++;
  }
  return lab;
}
// Do two labellings split the graph's node tiles into the same groups? Returns the number of node tiles that disagree.
function samePartition(G, labOf) {
  const a = new Map(), b = new Map(); let bad = 0;
  for (const c of G.cl) for (const t of c.nodes) {
    const x = G.comp[t], y = labOf(t);
    if (!a.has(x)) a.set(x, y); else if (a.get(x) !== y) bad++;
    if (!b.has(y)) b.set(y, x); else if (b.get(y) !== x) bad++;
  }
  return bad;
}
// landReg / waterReg with the regions that a diagonal step past a cliff corner joins merged (computeRegions is 4-way).
function regionsJoined(cls) {
  const m = W.map, n = m.n, reg = cls === 'naval' ? m.waterReg : m.landReg, pass = hpaPassFn(cls), up = new Map();
  const find = r => { while (up.has(r) && up.get(r) !== r) r = up.get(r); return r; };
  let squeezes = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (let d = 4; d < 8; d++) {
    const nx = x + PF_DX[d], ny = y + PF_DY[d]; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
    const i = y * n + x, j = ny * n + nx;
    if (!pass(i) || !pass(j) || !pass(y * n + nx) || !pass(ny * n + x) || !m.canStep(x, y, nx, ny)) continue;
    const a = find(reg[i]), b = find(reg[j]); if (a === b) continue;
    squeezes++; if (a < b) up.set(b, a); else up.set(a, b);
  }
  return { label: t => find(reg[t]), squeezes };
}
// Everything a graph holds, in a comparable form (cost rows are all worked out first).
function graphShape(G) {
  for (let k = 0; k < G.cl.length; k++) for (let a = 0; a < G.cl[k].nodes.length; a++) hpaRow(G, k, a);
  const root = new Map(); for (const c of G.cl) for (const t of c.nodes) { const r = G.comp[t]; if (!root.has(r) || root.get(r) > t) root.set(r, t); }
  return JSON.stringify({ P: Array.from(G.P), mv: Array.from(G.mv), lab: Array.from(G.lab),
    cl: G.cl.map(c => ({ nodes: c.nodes, inter: c.inter, cost: Array.from(c.cost).map(v => v === Infinity ? -1 : +v.toFixed(6)), comp: c.nodes.map(t => root.get(G.comp[t])) })) });
}
function freshShape(cls) { const keep = HPA.g[cls]; delete HPA.g[cls]; const s = graphShape(hpaGraph(cls)); HPA.g[cls] = keep; return s; }
`);

// ---------- 1. components = true connected areas, on 20 seeds × 3 map types ----------
const C = JSON.parse(run(`(() => {
  const out = { maps: 0, nodes: 0, floodBad: 0, regionBad: 0, squeezes: 0, worst: [] };
  for (const type of ['land', 'coastal', 'islands']) for (let seed = 1; seed <= 20; seed++) {
    const spec = generateMapSpec({ size: 'medium', seed, mapType: type, numPlayers: 2 });
    createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed, fog: 'none', startRes: 'standard', startAge: 0 });
    out.maps++;
    for (const cls of ['land', 'naval']) {
      const G = hpaGraph(cls), ff = floodLabels(cls), bad = samePartition(G, t => ff[t]);
      out.floodBad += bad; for (const c of G.cl) out.nodes += c.nodes.length;
      if (bad) out.worst.push(type + ' ' + seed + ' ' + cls + ' flood ' + bad);
    }
    // with every building, tree and mine gone, the components are landReg / waterReg (regions joined at cliff corners)
    for (const e of W.list.slice()) removeEnt(e);
    for (const cls of ['land', 'naval']) {
      const G = hpaGraph(cls), R = regionsJoined(cls), bad = samePartition(G, R.label);
      out.regionBad += bad; out.squeezes += R.squeezes;
      if (bad) out.worst.push(type + ' ' + seed + ' ' + cls + ' regions ' + bad);
    }
  }
  out.worst = out.worst.slice(0, 5);
  return JSON.stringify(out);
})()`));
ok(`graph components equal an 8-way flood fill under findPath's step rule (${C.maps} maps, land and naval)`, C.maps === 60 && C.nodes > 10000 && C.floodBad === 0, C);
ok(`with no buildings or resources they equal landReg / waterReg, joined where a diagonal step passes a cliff corner (${C.squeezes} such steps)`, C.regionBad === 0, C);

// ---------- 2. incremental upkeep = a fresh build, after each kind of passability change ----------
const D = JSON.parse(run(`(() => {
  const spec = generateMapSpec({ size: 'medium', seed: 9, mapType: 'coastal', numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed: 9, fog: 'none', startRes: 'high', startAge: 2 });
  const m = W.map, n = m.n, P1 = W.players[1], rnd = mulberry32(3);
  P1.res.wood = P1.res.stone = 1e6;
  const land = () => { for (let k = 0; k < 500; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (!isWaterT(m.ter[i]) && !m.blk[i]) return { x, y }; } return null; };
  const shore = () => { for (let k = 0; k < 4000; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (isWaterT(m.ter[i]) || m.blk[i]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isWaterT(m.ter[m.idx(x + dx, y + dy)])) return { x, y, wx: x + dx, wy: y + dy }; } return null; };
  const water = () => { for (let k = 0; k < 4000; k++) { const x = 2 + ((rnd() * (n - 4)) | 0), y = 2 + ((rnd() * (n - 4)) | 0), i = m.idx(x, y); if (isWaterT(m.ter[i]) && !m.blk[i]) return { x, y }; } return null; };
  const ops = {
    house() { const p = land(); if (p && !canPlace(P1, 'house', p.x, p.y)) spawnBuilding('house', 1, p.x, p.y, true); },
    wallLine() { const p = land(); if (p) for (let k = 0; k < 6; k++) if (!canPlace(P1, 'wall', p.x + k, p.y)) spawnBuilding('wall', 1, p.x + k, p.y, true); },
    gate() { const p = land(); if (p && !canPlace(P1, 'gate', p.x, p.y)) { const g = spawnBuilding('gate', 1, p.x, p.y, false); hpaGraph('land'); completeBuilding(g); } },
    removeBuilding() { const b = W.list.filter(e => e.kind === 'bld'); if (b.length) removeEnt(b[(rnd() * b.length) | 0]); },
    fellTree() { const t = W.list.filter(e => e.kind === 'res' && e.type === 'tree'); if (t.length) removeEnt(t[(rnd() * t.length) | 0]); },
    plantTree() { const p = land(); if (p) spawnRes('tree', p.x, p.y); },
    fish() { const p = water(); if (p) spawnRes('fish', p.x, p.y); },
    removeFish() { const f = W.list.filter(e => e.type === 'fish'); if (f.length) removeEnt(f[(rnd() * f.length) | 0]); },
    dock() { const s = shore(); if (s && !canPlace(P1, 'dock', s.wx, s.wy)) spawnBuilding('dock', 1, s.wx, s.wy, true); },
    canal() { const s = shore(); if (s) terraApply('canal', s.x, s.y, P1); },
    raise() { const p = land(); if (p) for (let k = 0; k < 3; k++) terraApply('raise', p.x, p.y, P1); },
    lower() { const p = land(); if (p) terraApply('lower', p.x, p.y, P1); },
    trench() { const p = land(); if (p) for (let k = 0; k < 4; k++) terraApply('trench', p.x + k, p.y, P1); },
    tunnel() { const p = land(); if (p) for (let k = 0; k < 3; k++) terraApply('tunnel', p.x, p.y + k, P1); },
    bridge() { const s = shore(); if (!s) return; const dx = s.wx - s.x, dy = s.wy - s.y; for (let k = 1; k <= 4; k++) terraApply('bridge', s.x + dx * k, s.y + dy * k, P1, new Set()); },
    unbridge() { if (!m.bridge) return; for (let i = 0; i < n * n; i++) if (m.bridge[i]) { terraApply('unbridge', i % n, (i / n) | 0, P1); break; } },
    editorStroke() { const p = land(); if (!p) return; Editor.tool = 'raise'; Editor.brush = 2; Editor.lastApplied = null; Editor.apply({ x: p.x + 0.5, y: p.y + 0.5 }); },
    editorDrag() { const b = W.list.filter(e => e.kind === 'bld' && e.type === 'house'), p = land(); if (b.length && p) Editor.moveEnt(b[0], { x: p.x + 0.5, y: p.y + 0.5 }); },
    byHand() { const p = land(); if (p) { m.elev[m.idx(p.x, p.y)] = 4; m.computeVH(); m.computeRegions(); } },
  };
  for (const cls of ['land', 'naval']) hpaGraph(cls);
  const names = Object.keys(ops), bad = [];
  let checks = 0;
  for (let round = 0; round < 3; round++) for (const name of names) {
    ops[name](); if (typeof terraFlush === 'function') terraFlush();
    if (m.trench) hpaGraph('mounted');
    for (const cls of Object.keys(HPA.g)) { checks++; if (graphShape(hpaGraph(cls)) !== freshShape(cls)) bad.push(round + ':' + name + ':' + cls); }
  }
  return JSON.stringify({ checks, bad, rebuilt: HPA.stats.rebuilt, classes: Object.keys(HPA.g) });
})()`));
ok(`after buildings, gates, walls, docks, trees, fish, terraforming, bridges, tunnels, trenches and editor strokes, the kept graph equals a fresh build (${D.checks} comparisons)`, D.checks >= 100 && D.bad.length === 0 && D.classes.includes('mounted'), D);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/hpa-graph.test.js`
Expected: FAIL, exit status 1:
```
ReferenceError: hpaGraph is not defined
```

- [ ] **Step 3: Create the module**

Create `game/js/hpa.js`:
```js
// ===== Hierarchical pathfinding (HPA*): a cluster graph per movement class =====
// Loaded right after index.js. The map is cut into 16 × 16-tile clusters. Where two clusters touch, each run of open
// crossings (an entrance span) gets one transition, or two at its ends when it is 6 tiles or longer, and a crossing
// that only a diagonal step makes (at a cluster corner, or past a cliff corner) gets its own. The end tiles of the
// transitions are the graph's nodes. They are joined across the border (inter edges) and inside their cluster (intra
// edges: the cost of the best route that stays in the cluster, worked out the first time a search needs it).
// Moves follow findPath exactly: a step needs its target passable and canStep, and a diagonal step needs both side
// tiles passable. So the graph's components are the true connected areas. landReg is not: computeRegions joins tiles
// 4-way and misses the diagonal steps past cliff corners that findPath and movement allow, and it ignores buildings,
// trees and walls.
// Classes: 'land' (built gates count as open, since who may pass depends on the owner; the grid search applies the
// real rule), 'mounted' (land without trench tiles, for the mounted, siege and trade units terra.js keeps out of
// trenches; built only on maps that have trenches) and 'naval'.
// Upkeep: everything that changes passability calls hpaDirty(x0, y0, x1, y1); the clusters within a tile of the
// rectangle are rebuilt on the next query. A new map is built whole on its first query (a new or loaded match builds
// it at once: hpaWarm), and so is the live map after any computeRegions call except terraFlush's (tests and tools
// that edit the map by hand end with computeRegions).
// Switch: HPA.enabled (URL ?hpa=off / ?hpa=on). Off, findPath and orderMove behave exactly as they did before.
'use strict';
const HPA = {
  enabled: false,         // the switch: off, findPath and orderMove are the old ones (URL ?hpa=on / ?hpa=off)
  C: 16,                  // cluster side in tiles (pfGrid's corridor test and hpaCluster shift by 4)
  near: 24,               // a goal this close tries a bounded plain grid search first...
  nearNodes: 2000,        // ...of this many nodes; when that search finishes, its answer is exactly the old findPath's
  smooth: 64,             // smoothing looks at most this many chain points ahead
  weight: 1.001,          // corridor search: heuristic weight, so ties go to the tile nearer the goal
  map: null, g: {},       // the GameMap the graphs describe; class -> graph
  quiet: false,           // set by terraFlush around its computeRegions (terraTouch has dirtied the exact rectangle)
  joinNodes: 600,         // a group member's own search onto the shared route
  groupR: 12,             // units farther than this from their group's leader route on their own
  stats: { queries: 0, near: 0, routed: 0, unreachable: 0, fallback: 0, rebuilt: 0, groups: 0, shared: 0 },
};
if (typeof location !== 'undefined' && location.search) { const q = new URLSearchParams(location.search).get('hpa'); if (q === 'off') HPA.enabled = false; else if (q === 'on') HPA.enabled = true; }

// ---------- classes and passability ----------
function hpaClassOf(u) {
  const d = UNITS[u.type];
  if (d.naval) return 'naval';
  return W.map.trench && (d.tags.includes('mounted') || d.tags.includes('siege') || d.tags.includes('trade')) ? 'mounted' : 'land';
}
// The passability a class's graph is built on: the game's own passLand / passNaval (with terra.js's bridges), with
// built gates open and, for 'mounted', trench tiles closed.
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

// ---------- the graph ----------
const hpaCluster = (G, t) => (((t / G.n) | 0) >> 4) * G.cw + ((t % G.n) >> 4);
// The graph of a class for the current map, with its dirty clusters rebuilt. null without a world.
function hpaGraph(cls) {
  if (!W || !W.map) return null;
  if (HPA.map !== W.map) { HPA.map = W.map; HPA.g = {}; }
  let G = HPA.g[cls];
  if (!G) {
    const n = W.map.n, cw = Math.ceil(n / HPA.C), cc = cw * cw;
    G = HPA.g[cls] = {
      cls, map: W.map, n, cw,
      P: new Uint8Array(n * n),            // passable for the class
      gt: new Uint8Array(n * n),           // built gate tiles: the only tiles where a unit's own rule can differ from P
      mv: new Uint8Array(n * n),           // bit d: the step (PF_DX[d], PF_DY[d]) from this tile is allowed
      lab: new Int16Array(n * n),          // connected area inside the tile's cluster (-1: not passable)
      ni: new Int16Array(n * n).fill(-1),  // index of a node tile in its cluster's node list
      comp: new Int32Array(n * n),         // component of a node tile (only node tiles are set)
      cl: Array.from({ length: cc }, () => ({ nodes: [], inter: [], cost: new Float64Array(0), row: new Uint8Array(0) })),
      vb: new Array(cc).fill(null), hb: new Array(cc).fill(null),   // transitions east and south of each cluster: [a, b, cost a→b, cost b→a, ...]
      cb: new Array(cc).fill(null), ca: new Array(cc).fill(null),   // diagonal transitions at the corner south-east of each cluster
      dirty: new Uint8Array(cc).fill(1), any: true,
      cm: new Uint32Array(cc), cstamp: 0,  // corridor marks for pfGrid
    };
  }
  if (G.any) hpaRebuild(G);
  return G;
}
// Something changed passability in the rectangle: rebuild the clusters within a tile of it on the next query.
function hpaDirty(x0, y0, x1, y1) {
  if (!W || HPA.map !== W.map) return;   // graphs of another map are rebuilt whole on their first query
  const C = HPA.C;
  for (const cls in HPA.g) {
    const G = HPA.g[cls], m = G.cw - 1;
    const cx0 = Math.max(0, Math.floor((x0 - 1) / C)), cx1 = Math.min(m, Math.floor((x1 + 1) / C));
    const cy0 = Math.max(0, Math.floor((y0 - 1) / C)), cy1 = Math.min(m, Math.floor((y1 + 1) / C));
    if (cx0 > cx1 || cy0 > cy1) continue;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) G.dirty[cy * G.cw + cx] = 1;
    G.any = true;
  }
}
function hpaDirtyAll() {
  if (!W || HPA.map !== W.map) return;
  for (const cls in HPA.g) { HPA.g[cls].dirty.fill(1); HPA.g[cls].any = true; }
}
function hpaMask(map, P, n, x, y) {
  let m = 0;
  for (let d = 0; d < 8; d++) {
    const nx = x + PF_DX[d], ny = y + PF_DY[d];
    if (nx < 0 || ny < 0 || nx >= n || ny >= n || !P[ny * n + nx] || !map.canStep(x, y, nx, ny)) continue;
    if (d >= 4 && (!P[y * n + nx] || !P[ny * n + x])) continue;
    m |= 1 << d;
  }
  return m;
}
function hpaRebuild(G) {
  const { map, n, cw, P, mv } = G, C = HPA.C, pass = hpaPassFn(G.cls), dirty = [];
  for (let k = 0; k < cw * cw; k++) if (G.dirty[k]) dirty.push(k);
  // Passability first, then the move masks: a mask reads the neighbours' passability, and a change dirties every
  // cluster within a tile of it, so every mask that can change lies in a dirty cluster.
  for (const k of dirty) {
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C), y1 = Math.min(n, y0 + C);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * n + x, b = map.blk[i], e = b ? W.ents.get(b) : null;
      P[i] = pass(i) ? 1 : 0; G.gt[i] = P[i] && e && e.type === 'gate' ? 1 : 0;
    }
  }
  for (const k of dirty) { const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C), y1 = Math.min(n, y0 + C); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mv[y * n + x] = hpaMask(map, P, n, x, y); hpaLabel(G, k); }
  // the borders and corners of every dirty cluster, then the node lists of every cluster they touch
  const vb = new Set(), hb = new Set(), cr = new Set(), touched = new Set(dirty);
  for (const k of dirty) {
    const cx = k % cw, cy = (k / cw) | 0;
    if (cx + 1 < cw) vb.add(k); if (cx > 0) vb.add(k - 1);
    if (cy + 1 < cw) hb.add(k); if (cy > 0) hb.add(k - cw);
    for (const [qx, qy] of [[cx, cy], [cx - 1, cy], [cx, cy - 1], [cx - 1, cy - 1]]) if (qx >= 0 && qy >= 0 && qx + 1 < cw && qy + 1 < cw) cr.add(qy * cw + qx);
  }
  for (const k of vb) { G.vb[k] = hpaBorder(G, k, true); touched.add(k + 1); }
  for (const k of hb) { G.hb[k] = hpaBorder(G, k, false); touched.add(k + cw); }
  for (const k of cr) { hpaCorner(G, k); touched.add(k + 1); touched.add(k + cw); touched.add(k + cw + 1); }
  for (const k of [...touched].sort((a, b) => a - b)) hpaNodes(G, k);
  hpaComponents(G);
  G.dirty.fill(0); G.any = false;
  HPA.stats.rebuilt += dirty.length;
}
// Connected areas inside cluster k (the same moves, kept inside the cluster).
function hpaLabel(G, k) {
  const { n, cw, mv, P, lab } = G, C = HPA.C, x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C) - 1, y1 = Math.min(n, y0 + C) - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) lab[y * n + x] = -1;
  let next = 0; const st = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * n + x; if (!P[i] || lab[i] >= 0) continue;
    lab[i] = next; st.push(i);
    while (st.length) {
      const c = st.pop(), cx = c % n, cy = (c / n) | 0, m = mv[c];
      for (let d = 0; d < 8; d++) {
        if (!((m >> d) & 1)) continue;
        const nx = cx + PF_DX[d], ny = cy + PF_DY[d];
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const j = ny * n + nx; if (lab[j] < 0) { lab[j] = next; st.push(j); }
      }
    }
    next++;
  }
}
function hpaTrans(G, out, a, b, step) {
  const e = G.map.elev;
  out.push(a, b, step + Math.max(0, e[b] - e[a]) * 0.3, step + Math.max(0, e[a] - e[b]) * 0.3);
}
// Transitions across the border east (vert) or south of cluster k. a(t) is the tile on k's side, b(t) its neighbour.
function hpaBorder(G, k, vert) {
  const { n, cw, mv, P } = G, C = HPA.C, cx = k % cw, cy = (k / cw) | 0, out = [];
  const has = (i, d) => P[i] && ((mv[i] >> d) & 1);
  let len, a, b, across, along, back, diagF, diagB;
  if (vert) { const bx = (cx + 1) * C, y0 = cy * C; len = Math.min(n, y0 + C) - y0; a = t => (y0 + t) * n + bx - 1; b = t => (y0 + t) * n + bx; across = 0; along = 2; back = 3; diagF = 4; diagB = 5; }
  else { const by = (cy + 1) * C, x0 = cx * C; len = Math.min(n, x0 + C) - x0; a = t => (by - 1) * n + x0 + t; b = t => by * n + x0 + t; across = 2; along = 0; back = 1; diagF = 4; diagB = 6; }
  const open = t => has(a(t), across);
  // entrance spans: runs of open crossings whose tiles also join each other along both sides
  for (let t = 0; t < len;) {
    if (!open(t)) { t++; continue; }
    let e = t;
    while (e + 1 < len && open(e + 1) && has(a(e), along) && has(b(e), along)) e++;
    const L = e - t + 1;
    if (L < 6) hpaTrans(G, out, a(t + ((L - 1) >> 1)), b(t + ((L - 1) >> 1)), 1);
    else { hpaTrans(G, out, a(t), b(t), 1); hpaTrans(G, out, a(e), b(e), 1); }
    t = e + 1;
  }
  // a diagonal crossing that no orthogonal crossing beside it already connects
  for (let t = 0; t + 1 < len; t++) {
    if (has(a(t), diagF) && !((open(t) && has(b(t), along)) || (has(a(t), along) && open(t + 1)))) hpaTrans(G, out, a(t), b(t + 1), 1.414);
    if (has(a(t + 1), diagB) && !((open(t + 1) && has(b(t + 1), back)) || (has(a(t + 1), back) && open(t)))) hpaTrans(G, out, a(t + 1), b(t), 1.414);
  }
  return out;
}
// Diagonal transitions at the corner south-east of cluster k, where four clusters meet.
function hpaCorner(G, k) {
  const { n, cw, mv, P } = G, C = HPA.C, bx = (k % cw + 1) * C, by = (((k / cw) | 0) + 1) * C;
  const TL = (by - 1) * n + bx - 1, TR = (by - 1) * n + bx, BL = by * n + bx - 1, BR = by * n + bx;
  const has = (i, d) => P[i] && ((mv[i] >> d) & 1), cb = [], ca = [];
  if (has(TL, 4) && !((has(TL, 0) && has(TR, 2)) || (has(TL, 2) && has(BL, 0)))) hpaTrans(G, cb, TL, BR, 1.414);
  if (has(TR, 6) && !((has(TR, 1) && has(TL, 2)) || (has(TR, 2) && has(BR, 1)))) hpaTrans(G, ca, TR, BL, 1.414);
  G.cb[k] = cb; G.ca[k] = ca;
}
// The node list of cluster k: the end tiles on its side of the transitions on its four borders and four corners.
function hpaNodes(G, k) {
  const c = G.cl[k], cw = G.cw, cx = k % cw, cy = (k / cw) | 0, ni = G.ni;
  for (const t of c.nodes) ni[t] = -1;
  const nodes = [], inter = [];
  const add = (t, o, cost) => { let j = ni[t]; if (j < 0) { j = ni[t] = nodes.length; nodes.push(t); inter.push([]); } inter[j].push(o, cost); };
  const scan = (L, side) => { if (L) for (let i = 0; i < L.length; i += 4) { if (side) add(L[i + 1], L[i], L[i + 3]); else add(L[i], L[i + 1], L[i + 2]); } };
  scan(G.vb[k], 0); if (cx > 0) scan(G.vb[k - 1], 1);
  scan(G.hb[k], 0); if (cy > 0) scan(G.hb[k - cw], 1);
  scan(G.cb[k], 0); if (cx > 0 && cy > 0) scan(G.cb[k - cw - 1], 1);
  if (cx > 0) scan(G.ca[k - 1], 0); if (cy > 0) scan(G.ca[k - cw], 1);
  c.nodes = nodes; c.inter = inter; c.cost = new Float64Array(nodes.length * nodes.length); c.row = new Uint8Array(nodes.length);
}
// Components over every node: transitions join their ends, and nodes in one connected area of a cluster are joined.
function hpaComponents(G) {
  const comp = G.comp, lab = G.lab;
  const find = t => { while (comp[t] !== t) { comp[t] = comp[comp[t]]; t = comp[t]; } return t; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) comp[b] = a; else comp[a] = b; } };
  for (const c of G.cl) for (const t of c.nodes) comp[t] = t;
  for (const c of G.cl) {
    const first = new Map();
    for (let i = 0; i < c.nodes.length; i++) {
      const t = c.nodes[i], l = lab[t];
      if (first.has(l)) union(t, first.get(l)); else first.set(l, t);
      const e = c.inter[i]; for (let q = 0; q < e.length; q += 2) union(t, e[q]);
    }
  }
  for (const c of G.cl) for (const t of c.nodes) comp[t] = find(t);
}

// ---------- searches inside one cluster ----------
const HL = { d: new Float64Array(256), st: new Uint32Array(256), cl: new Uint32Array(256), cur: 0, hf: new Float64Array(4096), hi: new Int32Array(4096), n: 0, x0: 0, y0: 0 };
// Dijkstra inside cluster k from the tiles srcs (cost 0) with findPath's step costs. rev: the cost of moving toward
// the sources (the goal side). Afterwards hpaD(t) is the cost of tile t of the cluster, Infinity if not reached.
function hpaLocal(G, k, srcs, rev) {
  const n = G.n, cw = G.cw, mv = G.mv, el = G.map.elev, C = HPA.C, DX = PF_DX, DY = PF_DY;
  const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, x1 = Math.min(n, x0 + C) - 1, y1 = Math.min(n, y0 + C) - 1;
  const d = HL.d, st = HL.st, cl = HL.cl, hf = HL.hf, hi = HL.hi, stamp = ++HL.cur;
  HL.n = n; HL.x0 = x0; HL.y0 = y0;
  let hn = 0;
  const push = (f, i) => { let q = hn++; hf[q] = f; hi[q] = i; while (q > 0) { const p = (q - 1) >> 1; if (hf[p] <= hf[q]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[q]; hi[p] = hi[q]; hf[q] = tf; hi[q] = ti; q = p; } };
  const pop = () => { const top = hi[0], len = --hn; if (len > 0) { hf[0] = hf[len]; hi[0] = hi[len]; let q = 0; for (; ;) { const l = 2 * q + 1, r = l + 1; let m = q; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === q) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[q]; hi[m] = hi[q]; hf[q] = tf; hi[q] = ti; q = m; } } return top; };
  for (const s of srcs) { const l = (((s / n) | 0) - y0) * C + s % n - x0; if (st[l] === stamp) continue; st[l] = stamp; d[l] = 0; push(0, s); }
  while (hn) {
    const c = pop(), cx = c % n, cy = (c / n) | 0, lc = (cy - y0) * C + cx - x0;
    if (cl[lc] === stamp) continue; cl[lc] = stamp;
    const m = mv[c], gc = d[lc], ec = el[c];
    for (let dd = 0; dd < 8; dd++) {
      if (!((m >> dd) & 1)) continue;
      const nx = cx + DX[dd], ny = cy + DY[dd];
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const j = ny * n + nx, lj = (ny - y0) * C + nx - x0, climb = rev ? ec - el[j] : el[j] - ec;
      const ng = gc + (dd >= 4 ? 1.414 : 1) + (climb > 0 ? climb * 0.3 : 0);
      if (st[lj] !== stamp || ng < d[lj]) { st[lj] = stamp; d[lj] = ng; push(ng, j); }
    }
  }
}
function hpaD(t) { const n = HL.n, l = (((t / n) | 0) - HL.y0) * HPA.C + t % n - HL.x0; return HL.st[l] === HL.cur ? HL.d[l] : Infinity; }
// Intra-edge costs from node a of cluster k to the cluster's other nodes, worked out on first use.
function hpaRow(G, k, a) {
  const c = G.cl[k], m = c.nodes.length;
  if (c.row[a]) return;
  c.row[a] = 1; hpaLocal(G, k, [c.nodes[a]], false);
  for (let b = 0; b < m; b++) c.cost[a * m + b] = hpaD(c.nodes[b]);
}

// The live map changed by hand (tests and tools end such edits with computeRegions): rebuild everything. terraFlush
// sets HPA.quiet, since terraTouch has already dirtied what it changed.
if (typeof GameMap === 'function') {
  const _hpaRegions = GameMap.prototype.computeRegions;
  GameMap.prototype.computeRegions = function () {
    const r = _hpaRegions.apply(this, arguments);
    if (this === HPA.map && !HPA.quiet) hpaDirtyAll();
    return r;
  };
}
```

- [ ] **Step 4: Load it right after index.js**

In `game/index.html`, replace:
```html
<script src="js/index.js"></script>
```
with:
```html
<script src="js/index.js"></script>
<script src="js/hpa.js"></script>
```

- [ ] **Step 5: Dirty the clusters where the world changes passability**

In `game/js/world.js`, replace:
```js
  if (k !== 'shrub' && !depth) map.blk[map.idx(x, y)] = e.id;
  return e;
```
with:
```js
  if (k !== 'shrub' && !depth) { map.blk[map.idx(x, y)] = e.id; hpaDirty(x, y, x, y); }
  return e;
```

In `game/js/world.js`, replace:
```js
  if (!d.farm) for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (map.inb(xx, yy)) map.blk[map.idx(xx, yy)] = b.id;
```
with:
```js
  if (!d.farm) { for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (map.inb(xx, yy)) map.blk[map.idx(xx, yy)] = b.id; hpaDirty(x, y, x + s - 1, y + s - 1); }
```

In `game/js/world.js`, replace:
```js
  if (e.kind === 'bld' && !BUILDINGS[e.type].farm) { const s = bsize(e); for (let y = e.y; y < e.y + s; y++) for (let x = e.x; x < e.x + s; x++) if (map.inb(x, y) && map.blk[map.idx(x, y)] === e.id) map.blk[map.idx(x, y)] = 0; }
  if (e.kind === 'res' && map.blk[map.idx(e.x, e.y)] === e.id) map.blk[map.idx(e.x, e.y)] = 0;
```
with:
```js
  if (e.kind === 'bld' && !BUILDINGS[e.type].farm) { const s = bsize(e); for (let y = e.y; y < e.y + s; y++) for (let x = e.x; x < e.x + s; x++) if (map.inb(x, y) && map.blk[map.idx(x, y)] === e.id) map.blk[map.idx(x, y)] = 0; hpaDirty(e.x, e.y, e.x + s - 1, e.y + s - 1); }
  if (e.kind === 'res' && map.blk[map.idx(e.x, e.y)] === e.id) { map.blk[map.idx(e.x, e.y)] = 0; hpaDirty(e.x, e.y, e.x, e.y); }
```

In `game/js/world.js`, replace:
```js
  b.built = true; b.progress = 1; b.hp = b.maxhp;
  const p = W.players[b.owner];
```
with:
```js
  b.built = true; b.progress = 1; b.hp = b.maxhp;
  if (BUILDINGS[b.type].gate) hpaDirty(b.x, b.y, b.x + bsize(b) - 1, b.y + bsize(b) - 1);   // a finished gate opens for its owner's side
  const p = W.players[b.owner];
```

- [ ] **Step 6: Terraforming**

In `game/js/terra.js`, replace:
```js
  d.x0 = Math.min(d.x0, x); d.y0 = Math.min(d.y0, y); d.x1 = Math.max(d.x1, x); d.y1 = Math.max(d.y1, y);
}
```
with:
```js
  d.x0 = Math.min(d.x0, x); d.y0 = Math.min(d.y0, y); d.x1 = Math.max(d.x1, x); d.y1 = Math.max(d.y1, y);
  hpaDirty(x - 2, y - 2, x + 2, y + 2);   // a canal also lowers and sands its neighbours
}
```

In `game/js/terra.js`, replace:
```js
  m.computeVH(); m.computeRegions();
  if (typeof R !== 'undefined') { R.mapVersion = m.version;
```
with:
```js
  HPA.quiet = true;   // terraTouch has already dirtied the hierarchy's clusters
  try { m.computeVH(); m.computeRegions(); } finally { HPA.quiet = false; }
  if (typeof R !== 'undefined') { R.mapVersion = m.version;
```

- [ ] **Step 7: The editor**

In `game/js/editor.js`, replace:
```js
      // temporarily unblock
      for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) if (W.map.blk[W.map.idx(xx, yy)] === e.id) W.map.blk[W.map.idx(xx, yy)] = 0;
```
with:
```js
      // temporarily unblock
      for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) if (W.map.blk[W.map.idx(xx, yy)] === e.id) W.map.blk[W.map.idx(xx, yy)] = 0;
      hpaDirty(e.x, e.y, e.x + s - 1, e.y + s - 1);
```

In `game/js/editor.js`, replace:
```js
      if (!BUILDINGS[e.type].farm) for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) W.map.blk[W.map.idx(xx, yy)] = e.id;
      return;
```
with:
```js
      if (!BUILDINGS[e.type].farm) for (let yy = e.y; yy < e.y + s; yy++) for (let xx = e.x; xx < e.x + s; xx++) W.map.blk[W.map.idx(xx, yy)] = e.id;
      hpaDirty(e.x, e.y, e.x + s - 1, e.y + s - 1);
      return;
```

In `game/js/editor.js`, replace:
```js
      if (e.kind === 'res' && e.type !== 'shrub') { W.map.blk[W.map.idx(e.x, e.y)] = 0; W.map.blk[W.map.idx(x, y)] = e.id; }
```
with:
```js
      if (e.kind === 'res' && e.type !== 'shrub') { W.map.blk[W.map.idx(e.x, e.y)] = 0; W.map.blk[W.map.idx(x, y)] = e.id; hpaDirty(e.x, e.y, e.x, e.y); hpaDirty(x, y, x, y); }
```

In `game/js/editor.js`, replace:
```js
    invalidateTiles(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  },
```
with:
```js
    invalidateTiles(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    hpaDirty(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  },
```

- [ ] **Step 8: The hand-written test loaders**

world.js now calls `hpaDirty` unguarded, so every test that loads world.js by hand also loads hpa.js. In each of these twelve files, in the script list on the line given (thirteen lists; tests/terrain.test.js has two), replace `'world.js', 'index.js'` with `'world.js', 'index.js', 'hpa.js'`:
- `tests/bridges-tunnels.test.js:8`, `tests/command.test.js:9`, `tests/extras.test.js:10`, `tests/mortality.test.js:10`, `tests/movement.test.js:9`, `tests/terraform.test.js:8`, `tests/victory.test.js:10`, `tests/water.test.js:8`, `tests/wells.test.js:8`. Each reads:
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js']) load(f);
  ```
  and becomes:
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js']) load(f);
  ```
- `tests/fx.test.js:17`, `tests/terrain.test.js:9` and `tests/units_hd.test.js:14`. Each reads (with its own indentation):
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js']) load(f);
  ```
  and becomes:
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js', 'render.js']) load(f);
  ```
- `tests/terrain.test.js:93`:
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'render.js', 'terrain.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx2, { filename: f });
  ```
  becomes:
  ```js
  for (const f of ['data.js', 'map.js', 'world.js', 'index.js', 'hpa.js', 'render.js', 'terrain.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx2, { filename: f });
  ```
Check: `grep -c "'index.js', 'hpa.js'" tests/*.test.js | grep -v ':0'` lists those twelve files, tests/terrain.test.js with 2. The vm harness (tests/engine-harness.js) loads every script tag of game/index.html, so it needs nothing.

- [ ] **Step 9: Run the graph test**

Run: `node tests/hpa-graph.test.js`
Expected (about 20 s; observed while planning):
```
PASS graph components equal an 8-way flood fill under findPath's step rule (60 maps, land and naval)  {"maps":60,"nodes":23625,"floodBad":0,"regionBad":0,"squeezes":80,"worst":[]}
PASS with no buildings or resources they equal landReg / waterReg, joined where a diagonal step passes a cliff corner (80 such steps)  {...}
PASS after buildings, gates, walls, docks, trees, fish, terraforming, bridges, tunnels, trenches and editor strokes, the kept graph equals a fresh build (159 comparisons)  {"checks":159,"bad":[],"rebuilt":20229,"classes":["land","naval","mounted"]}
3 passed, 0 failed
```

- [ ] **Step 10: (check) a missing hook is caught**

In `game/js/world.js`, temporarily change `if (BUILDINGS[b.type].gate) hpaDirty(` to `if (false) hpaDirty(`, and run `node tests/hpa-graph.test.js`. Expected: the third check FAILs. Its `"bad"` list starts `"0:gate:land"` (observed while planning). Change it back to `if (BUILDINGS[b.type].gate) hpaDirty(` (`git diff game/js/world.js` must show only Step 5's changes), then run the test again: `3 passed, 0 failed`.

- [ ] **Step 11: Nothing else moves**

Run: `npm run test:syntax`
Expected: `93 scripts passed syntax checks.`
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, the same two hashes.
Run each of: `node tests/movement.test.js`, `node tests/command.test.js`, `node tests/tactics.test.js`, `node tests/engineering.test.js`, `node tests/actors.test.js`, `node tests/bridges-tunnels.test.js`, `node tests/polish.test.js`
Expected, in that order: `8 passed`, `24 passed`, `17 passed`, `5 passed`, `5 passed`, `10 passed`, `6 passed`, each with `0 failed`.

- [ ] **Step 12: Commit**

```bash
git add game/js/hpa.js game/index.html game/js/world.js game/js/terra.js game/js/editor.js tests/hpa-graph.test.js tests/bridges-tunnels.test.js tests/command.test.js tests/extras.test.js tests/fx.test.js tests/mortality.test.js tests/movement.test.js tests/terraform.test.js tests/terrain.test.js tests/units_hd.test.js tests/victory.test.js tests/water.test.js tests/wells.test.js
git commit -m "feat(path): hierarchical cluster graph (hpa.js), rebuilt where passability changes

16 x 16 clusters with entrance spans, diagonal crossings and intra-cluster
costs, one graph per movement class (land, mounted where trenches exist,
naval), using findPath's own step rule. hpaDirty marks the clusters round
every passability change: spawnRes, spawnBuilding, removeEnt, gate
completion, terraTouch and the editor's drags and strokes. Nothing routes
through the graph yet (HPA.enabled is false).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Abstract search and local refinement behind `findPath`

`findPath` (map.js:150-198) keeps its signature. Its new optional seventh argument, the movement class, comes only from `pathTo`, which passes `hpaClassOf(u)`. With a class and the switch on, `hpaFindPath` answers in this order:
1. **A near goal** (octile distance ≤ 24): the old grid search with a 2,000-node budget. If it finishes, either finding the goal or running out of reachable tiles, that is the answer, exactly the old one.
2. **The start**: a Dijkstra inside its cluster gives its costs to the cluster's nodes and to any goal tile in that cluster.
3. **The goal**: in each cluster the goal rectangle (grown by r) touches, a reverse Dijkstra from its passable tiles gives each node's cost to the goal.
4. **Region reject**: if no component the start reaches is one the goal is reached from, the goal is unreachable. Go to 6.
5. **Abstract A\*** over the nodes, then **refinement**: the grid A* runs again, kept inside the clusters of the start and of every node on the abstract route, each widened by a ring of one cluster. It reads the graph's step masks, and asks the unit's `passFn` only on gate tiles. The result is smoothed with a lookahead of 64 points.
   - If refinement fails, the unit's own rule is stricter than the graph's: a gate it may not use. `findPath` then runs the old search with the old budget.
6. **Unreachable**: route to the reachable tile nearest the goal, with ok false.
   - That tile is found exactly. Clusters are scanned nearest first, and a cluster's tiles count when they share a connected area with one of its nodes in the start's components.
   - If the start itself is nearest, the route is empty, as before.

Also in this task:
- `pfGrid`'s open list becomes a typed-array heap with the old comparisons, and the 4,000-point cap goes.
- `findPath` without a class (`cmdFindBreach`, engineering.js:57 with its 2,000-node probe, the group joins of Task 6), or with the switch off, is the plain search. Its smoothing is unbounded while the switch is off, as today.
- A new or loaded match builds the land and naval graphs and every intra edge at once (`hpaWarm`), except in the editor.

**Files:**
- Create: `tests/hpa-route.test.js`
- Modify: `game/js/map.js:142-198` (the pathfinding block: `PF`, `pfGrid`, `pfSmooth`, `findPath`), `game/js/hpa.js` (insert before the `computeRegions` section), `game/js/world.js:209` (`pathTo`), `game/js/editor.js:46` (`loadSpec`)

**Interfaces:**
- Consumes (from Task 4):
  - `HPA`, `hpaGraph`, `hpaClassOf`, `hpaCluster`, `hpaLocal`, `hpaD`, `hpaRow`;
  - per graph `G`: `P`, `gt`, `mv`, `lab`, `comp`, `cl`, `cm`, `cstamp`.
- Produces:
  - `pfGrid(map, sx, sy, goal, passFn, maxNodes, lim) → { chain, ok, budget, expanded }`. `lim = { cm, stamp, cw, w, mv, gt }` is a corridor.
  - `pfSmooth(map, chain, passFn, K, clear) → [{x, y}]`.
  - `findPath(map, sx, sy, goal, passFn, maxNodes = 9000, cls) → { pts, ok }`. This is the old contract: `pts` leaves out the start tile, and ok false means a best effort.
  - `hpaFindPath(map, sx, sy, goal, passFn, cls) → { pts, ok } | null`. null means "let the plain search answer".
  - `hpaSearch`, `hpaCorridor(G, ks, route, ring)`, `hpaClear(G, passFn)`, `hpaWarm()`.
  - The world setting `editor: true` on editor worlds.
  - Task 6 builds its group route with `findPath(..., cls)`.

- [ ] **Step 1: Write the failing routing test**

Create `tests/hpa-route.test.js`:
```js
// Hierarchical routes behind findPath (game/js/hpa.js, HPA.enabled): as short as the optimal grid A*, valid step by
// step, the old answer for near goals, a best effort at least as close as the old one for unreachable goals, and the
// unit's own rule on gates, trenches, water, bridges and tunnels.   node tests/hpa-route.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type) {
  const spec = generateMapSpec({ size, seed, mapType: type, numPlayers: 2 });
  createWorld(spec, { players: [{ name: 'A', civ: 'franks', color: PLAYER_COLORS[0], human: true }, { name: 'B', civ: 'turks', color: PLAYER_COLORS[1] }], seed, fog: 'none', startRes: 'high', startAge: 2 });
}
const pathLen = (sx, sy, pts) => { let L = 0, px = sx + 0.5, py = sy + 0.5; for (const p of pts) { L += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; } return L; };
// findPath's guarantee for its waypoints, leg by leg from the start tile: a leg is one step by the grid search's own
// rule (target passable and climbable, and on a diagonal both side tiles passable) or a straight line that passes
// lineClear (smoothing's test). Either way no step squeezes between two blocked corners.
function stepOk(a, b, pass) { const n = W.n, ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0; return pass(b) && W.map.canStep(ax, ay, bx, by) && (ax === bx || ay === by || (pass(ay * n + bx) && pass(by * n + ax))); }
function legsClear(sx, sy, pts, pass) {
  const n = W.n; let a = sy * n + sx;
  for (const p of pts) { const b = (p.y | 0) * n + (p.x | 0), one = Math.max(Math.abs(b % n - a % n), Math.abs(((b / n) | 0) - ((a / n) | 0))) === 1; if (!(one && stepOk(a, b, pass)) && !lineClear(W.map, a, b, pass)) return false; a = b; }
  return true;
}
// Stricter than the game asks: walk each leg in 0.05-tile steps and count points on tiles the unit may not stand on.
function strictBad(sx, sy, pts, pass) { let bad = 0, px = sx + 0.5, py = sy + 0.5; for (const p of pts) { const k = Math.ceil(Math.hypot(p.x - px, p.y - py) / 0.05); for (let s = 1; s <= k; s++) { const x = px + (p.x - px) * s / k, y = py + (p.y - py) * s / k; if (!pass(W.map.idx(x | 0, y | 0))) bad++; } px = p.x; py = p.y; } return bad; }
const hGoal = (g, x, y) => { const dx = Math.max(g.x0 - x, 0, x - g.x1), dy = Math.max(g.y0 - y, 0, y - g.y1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
`);

// ---------- 1. 500 random pairs: at most 1.1× the optimal grid A*, every leg valid ----------
const Q = JSON.parse(run(`(() => {
  const out = { pairs: 0, worst: 0, sum: 0, invalid: 0, refInvalid: 0, notOk: 0, strictNew: 0, strictOld: 0, msOld: 0, msNew: 0, routed0: HPA.stats.routed };
  for (const type of ['land', 'coastal', 'islands', 'rivers', 'alpine']) {
    HPA.enabled = true; world('gigantic', 11, type);
    const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(7);
    const tile = () => { for (;;) { const x = (rnd() * n) | 0, y = (rnd() * n) | 0; if (pass(m.idx(x, y))) return { x, y }; } };
    let got = 0;
    while (got < 100) {
      const a = tile(), b = tile(), goal = { x0: b.x, y0: b.y, x1: b.x, y1: b.y, r: 0 };
      HPA.enabled = false; let t0 = performance.now(); const ref = findPath(m, a.x, a.y, goal, pass, n * n); out.msOld += performance.now() - t0;   // the optimal grid A*: no node budget
      if (!ref.ok) continue;
      HPA.enabled = true; t0 = performance.now(); const r = findPath(m, a.x, a.y, goal, pass, undefined, 'land'); out.msNew += performance.now() - t0;
      got++; out.pairs++;
      if (!r.ok) { out.notOk++; continue; }
      const q = pathLen(a.x, a.y, r.pts) / Math.max(1e-9, pathLen(a.x, a.y, ref.pts)); out.worst = Math.max(out.worst, q); out.sum += q;
      const last = r.pts[r.pts.length - 1];
      if (!legsClear(a.x, a.y, r.pts, pass) || (r.pts.length && ((last.x | 0) !== b.x || (last.y | 0) !== b.y))) out.invalid++;
      if (!legsClear(a.x, a.y, ref.pts, pass)) out.refInvalid++;
      out.strictNew += strictBad(a.x, a.y, r.pts, pass); out.strictOld += strictBad(a.x, a.y, ref.pts, pass);
    }
  }
  out.mean = +(out.sum / (out.pairs - out.notOk)).toFixed(4); out.worst = +out.worst.toFixed(3); out.routed = HPA.stats.routed - out.routed0;
  out.msOld = +(out.msOld / out.pairs).toFixed(1); out.msNew = +(out.msNew / out.pairs).toFixed(1); delete out.sum; delete out.routed0;
  return JSON.stringify(out);
})()`));
ok(`500 random pairs on 200 maps of 5 types: every route found, at most 1.1× the optimal grid A* (worst ${Q.worst}, mean ${Q.mean})`, Q.pairs === 500 && Q.notOk === 0 && Q.worst <= 1.1 && Q.routed > 300, Q);
ok('every leg is one valid grid step or passes lineClear (passable, climbable, no corner squeeze), and every route ends on its goal, as the old routes do', Q.invalid === 0 && Q.refInvalid === 0, Q);

// ---------- 2. near goals: exactly the old answer ----------
const N = JSON.parse(run(`(() => {
  HPA.enabled = true; world('gigantic', 5, 'land');
  const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(3); let near = 0, same = 0, total = 0;
  for (let k = 0; k < 300; k++) {
    const x = (rnd() * n) | 0, y = (rnd() * n) | 0; if (!pass(m.idx(x, y))) continue;
    const gx = Math.max(0, Math.min(n - 1, x + ((rnd() * 41) | 0) - 20)), gy = Math.max(0, Math.min(n - 1, y + ((rnd() * 41) | 0) - 20)), goal = { x0: gx, y0: gy, x1: gx, y1: gy, r: (rnd() * 3) | 0 };
    HPA.enabled = false; const a = findPath(m, x, y, goal, pass);
    HPA.enabled = true; const n0 = HPA.stats.near, b = findPath(m, x, y, goal, pass, undefined, 'land');
    total++; if (HPA.stats.near > n0) { near++; if (JSON.stringify(a) === JSON.stringify(b)) same++; }
  }
  return JSON.stringify({ total, near, same });
})()`));
ok('goals within 24 tiles: whenever the bounded plain search finishes (most of them), its answer is exactly the old findPath answer', N.total > 180 && N.near >= N.total * 0.7 && N.same === N.near, N);

// ---------- 3. unreachable goals: a best effort at least as close, at a fraction of the cost ----------
const U = JSON.parse(run(`(() => {
  const out = { cases: 0, perType: {}, closer: 0, farther: 0, emptyBoth: 0, emptyLost: 0, deadEnd: 0, msOld: 0, msNew: 0, unreachable0: HPA.stats.unreachable };
  for (const [type, seed] of [['islands', 4], ['coastal', 6], ['rivers', 8]]) {
    HPA.enabled = true; world('gigantic', seed, type);
    const m = W.map, n = m.n, pass = passLand(1), rnd = mulberry32(seed), c0 = out.cases;
    for (let k = 0; out.cases - c0 < 40 && k < 5000; k++) {
      const x = (rnd() * n) | 0, y = (rnd() * n) | 0, gx = (rnd() * n) | 0, gy = (rnd() * n) | 0;
      if (!pass(m.idx(x, y)) || !isWaterT(m.ter[m.idx(gx, gy)])) continue;   // a land unit sent onto the water
      const goal = { x0: gx, y0: gy, x1: gx, y1: gy, r: 0 };
      HPA.enabled = false; let t0 = performance.now(); const a = findPath(m, x, y, goal, pass); out.msOld += performance.now() - t0;
      HPA.enabled = true; t0 = performance.now(); const b = findPath(m, x, y, goal, pass, undefined, 'land'); out.msNew += performance.now() - t0;
      if (a.ok || b.ok) continue;
      out.cases++;
      const end = (r) => r.pts.length ? r.pts[r.pts.length - 1] : { x: x + 0.5, y: y + 0.5 };
      const ha = hGoal(goal, end(a).x | 0, end(a).y | 0), hb = hGoal(goal, end(b).x | 0, end(b).y | 0);
      if (hb <= ha + 1e-9) out.closer++; else out.farther++;
      if (!a.pts.length && !b.pts.length) out.emptyBoth++; else if (!b.pts.length) out.emptyLost++;
      // the end is a dead end: sent again from there, the old search and the new one both stay put (empty route, ok
      // false), the case gather, build, attack and trade count as a give-up
      const ex = end(b).x | 0, ey = end(b).y | 0;
      HPA.enabled = false; const a2 = findPath(m, ex, ey, goal, pass);
      HPA.enabled = true; const b2 = findPath(m, ex, ey, goal, pass, undefined, 'land');
      if (!a2.ok && !b2.ok && !a2.pts.length && !b2.pts.length) out.deadEnd++;
    }
    out.perType[type] = out.cases - c0;
  }
  out.msOld = +(out.msOld / out.cases).toFixed(1); out.msNew = +(out.msNew / out.cases).toFixed(1); out.unreachable = HPA.stats.unreachable - out.unreachable0; delete out.unreachable0;
  return JSON.stringify(out);
})()`));
ok('unreachable goals: ok stays false, the route ends at least as close to the goal as the old best effort and never comes back empty where the old one moved, and from its end both searches return an empty route (the give-up callers see)', U.cases === 120 && U.farther === 0 && U.emptyLost === 0 && U.deadEnd === U.cases && U.unreachable >= U.cases * 0.9, U);
ok(`unreachable goals are answered without the old full-budget search (${U.msNew} ms against ${U.msOld} ms in the vm)`, U.msNew * 3 < U.msOld, U);

// ---------- 4. the unit's own rule: gates, trenches, water, bridges, tunnels ----------
const R = JSON.parse(run(`(() => {
  HPA.enabled = true; world('huge', 3, 'land');
  const m = W.map, n = m.n, P1 = W.players[1], P2 = W.players[2]; P1.res.wood = P1.res.stone = 1e6;
  // a flat grass strip 60 × 20, far from both bases
  let best = null; for (let y = 4; y + 20 < n - 4 && !best; y += 4) for (let x = 4; x + 60 < n - 4; x += 4) { const tcs = W.list.filter(e => e.type === 'tc'); if (tcs.every(t => Math.hypot(t.x - x - 30, t.y - y - 10) > 40)) { best = { x, y }; break; } }
  for (const e of W.list.slice()) if (e.kind !== 'unit' && e.x >= best.x - 2 && e.x < best.x + 62 && e.y >= best.y - 2 && e.y < best.y + 22) removeEnt(e);
  for (let y = best.y; y < best.y + 20; y++) for (let x = best.x; x < best.x + 60; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  m.computeVH(); m.computeRegions();
  const X = best.x, Y = best.y, out = {};
  const route = (u, gx, gy) => { u.path = null; pathTo(u, { x0: gx, y0: gy, x1: gx, y1: gy }, 0); return { ok: u.pathOk, pts: u.path }; };
  // a closed wall ring of player 1 round (X + 50, Y + 10), with one gate on its west side
  const ring = [];
  for (let y = Y + 6; y <= Y + 14; y++) for (let x = X + 46; x <= X + 54; x++) if (Math.max(Math.abs(x - X - 50), Math.abs(y - Y - 10)) === 4) ring.push(spawnBuilding(x === X + 46 && y === Y + 10 ? 'gate' : 'wall', 1, x, y, true));
  const v1 = spawnUnit('villager', 1, X + 5.5, Y + 10.5), v2 = spawnUnit('villager', 2, X + 5.5, Y + 12.5);
  let s0 = Object.assign({}, HPA.stats); const own = route(v1, X + 50, Y + 10);
  out.ownGate = own.ok && HPA.stats.routed === s0.routed + 1;
  s0 = Object.assign({}, HPA.stats); const foe = route(v2, X + 50, Y + 10);
  HPA.enabled = false; const old = route(v2, X + 50, Y + 10); HPA.enabled = true;
  out.foeGate = !foe.ok && JSON.stringify(foe.pts) === JSON.stringify(old.pts) && HPA.stats.fallback === s0.fallback + 1;
  for (const b of ring) removeEnt(b);
  // a trench across the strip with a 3-tile gap: a knight goes round through the gap, a villager walks straight
  for (let y = Y; y < Y + 20; y++) if (y < Y + 15 || y > Y + 17) terraApply('trench', X + 40, y, P1);
  terraFlush();
  const kn = spawnUnit('knight', 1, X + 35.5, Y + 2.5), vi = spawnUnit('villager', 1, X + 35.5, Y + 2.5);
  const kr = route(kn, X + 50, Y + 2), vr = route(vi, X + 50, Y + 2);
  out.trench = kr.ok && legsClear(X + 35, Y + 2, kr.pts, unitPass(kn)) && kr.pts.some(p => p.y > Y + 14) && vr.ok && vr.pts.every(p => p.y < Y + 8) && hpaClassOf(kn) === 'mounted' && hpaClassOf(vi) === 'land';
  // a 3-wide river across the strip: no way over, then a bridge, then the bridge removed
  for (let y = Y - 3; y < Y + 23; y++) for (let x = X + 48; x < X + 51; x++) { const i = m.idx(x, y); m.ter[i] = T.WATER; m.elev[i] = 0; }
  for (let y = 0; y < n; y++) for (let x = X + 48; x < X + 51; x++) { const i = m.idx(x, y); if (!m.blk[i]) { m.ter[i] = T.WATER; m.elev[i] = 0; } }
  m.computeVH(); m.computeRegions();
  const vb = spawnUnit('villager', 1, X + 44.5, Y + 5.5);
  out.noBridge = !route(vb, X + 56, Y + 5).ok;
  for (let x = X + 48; x < X + 51; x++) terraApply('bridge', x, Y + 5, P1, new Set([m.idx(X + 48, Y + 5), m.idx(X + 49, Y + 5), m.idx(X + 50, Y + 5)]));
  terraFlush();
  const br = route(vb, X + 56, Y + 5); out.bridge = br.ok && legsClear(X + 44, Y + 5, br.pts, unitPass(vb));
  // a ship sails under the bridge, along the river
  const ship = spawnUnit('galley', 1, X + 49.5, Y + 1.5), sr = route(ship, X + 49, Y + 15);
  out.ship = sr.ok && legsClear(X + 49, Y + 1, sr.pts, unitPass(ship)) && hpaClassOf(ship) === 'naval';
  // a tunnel through a 3-level ridge
  for (let y = Y; y < Y + 20; y++) for (let x = X + 10; x < X + 13; x++) m.elev[m.idx(x, y)] = 3;
  for (let y = Y - 4; y < Y + 24; y++) for (let x = X + 10; x < X + 13; x++) if (m.inb(x, y)) m.elev[m.idx(x, y)] = 3;
  m.computeVH(); m.computeRegions();
  const vt = spawnUnit('villager', 1, X + 7.5, Y + 8.5), ridge = route(vt, X + 16, Y + 8);
  for (let x = X + 10; x < X + 13; x++) terraApply('tunnel', x, Y + 8, P1);
  terraFlush();
  const tun = route(vt, X + 16, Y + 8);
  out.tunnel = tun.ok && legsClear(X + 7, Y + 8, tun.pts, unitPass(vt)) && pathLen(X + 7, Y + 8, tun.pts) < 10 && (!ridge.ok || pathLen(X + 7, Y + 8, ridge.pts) > 12);
  out.stats = HPA.stats;
  return JSON.stringify(out);
})()`));
ok('own gate: routed through by the hierarchy; enemy at the same gate: the old search answers (fallback)', R.ownGate && R.foeGate, R);
ok('trench: a knight (mounted class) goes round through the gap, a villager walks straight over', R.trench, R);
ok('a river blocks the route until a bridge is built; a ship sails along the river under it', R.noBridge && R.bridge && R.ship, R);
ok('a tunnel through a ridge gives the short route', R.tunnel, R);

// ---------- 5. a new match builds the graphs and their edges up front ----------
const M = JSON.parse(run(`(() => {
  HPA.enabled = true; world('gigantic', 21, 'coastal');
  let cold = 0; const row = hpaRow; hpaRow = function (G, k, a) { if (!G.cl[k].row[a]) cold++; return row(G, k, a); };
  const m = W.map, tcs = W.list.filter(e => e.type === 'tc'), v = W.list.find(e => e.type === 'villager' && e.owner === 1), far = tcs.find(t => t.owner === 2);
  const r = findPath(m, v.x | 0, v.y | 0, { x0: far.x, y0: far.y, x1: far.x + 3, y1: far.y + 3, r: 1 }, unitPass(v), undefined, 'land');
  hpaRow = row;
  W.settings.editor = true; HPA.map = null; HPA.g = {}; hpaWarm(); const editorBuilt = !!HPA.g.land;
  return JSON.stringify({ ok: r.ok, cold, editorBuilt });
})()`));
ok('createWorld builds the land and naval graphs with every intra edge, so the first cross-map route computes none (editor worlds are skipped)', M.ok && M.cold === 0 && !M.editorBuilt, M);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/hpa-route.test.js`
Expected: FAIL, exit status 1. Every route is still the plain search, so the hierarchy counters stay 0. Observed while planning:
```
FAIL 500 random pairs on 200 maps of 5 types: every route found, at most 1.1× the optimal grid A* (worst 1, mean 1)  {...,"routed":0}
PASS every leg is one valid grid step or passes lineClear (passable, climbable, no corner squeeze), and every route ends on its goal, as the old routes do  {...}
FAIL goals within 24 tiles: whenever the bounded plain search finishes (most of them), its answer is exactly the old findPath answer  {"total":198,"near":0,"same":0}
FAIL unreachable goals: ok stays false, the route ends at least as close to the goal as the old best effort and never comes back empty where the old one moved, and from its end both searches return an empty route (the give-up callers see)  {...}
FAIL unreachable goals are answered without the old full-budget search (59.3 ms against 59.1 ms in the vm)  {...}
FAIL own gate: routed through by the hierarchy; enemy at the same gate: the old search answers (fallback)  {...}
PASS trench: a knight (mounted class) goes round through the gap, a villager walks straight over  {...}
PASS a river blocks the route until a bridge is built; a ship sails along the river under it  {...}
PASS a tunnel through a ridge gives the short route  {...}
ReferenceError: hpaWarm is not defined
```

- [ ] **Step 3: The grid search: typed-array heap, corridors, no point cap, bounded smoothing, class dispatch**

In `game/js/map.js`, replace:
```js
// ---------- Pathfinding (A*, 8-directional) ----------
const PF = { g: null, par: null, stamp: null, closed: null, cur: 1, heap: [], n: 0 };
const PF_DX = [1, -1, 0, 0, 1, 1, -1, -1], PF_DY = [0, 0, 1, -1, 1, -1, 1, -1]; // neighbour offsets (were rebuilt for every neighbour)
function pfInit(n) {
  if (PF.n === n) return;
  PF.n = n; PF.g = new Float32Array(n * n); PF.par = new Int32Array(n * n); PF.stamp = new Uint32Array(n * n); PF.closed = new Uint32Array(n * n);
}
// passFn(i, x, y) -> bool. goal: {x0,y0,x1,y1,r}
function findPath(map, sx, sy, goal, passFn, maxNodes = 9000) {
  const n = map.n; pfInit(n);
  if (maxNodes === 9000 && n > 110) maxNodes = Math.min(36000, Math.round(n * n * 0.85));
  sx = Math.max(0, Math.min(n - 1, sx | 0)); sy = Math.max(0, Math.min(n - 1, sy | 0));
  const stamp = ++PF.cur;
  const g = PF.g, par = PF.par, st = PF.stamp, cl = PF.closed;
  const heap = []; // [f, idx]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; } } return top; };
  // distance to the goal rectangle, without allocating (this runs for every node the search touches)
  const gx0 = goal.x0, gy0 = goal.y0, gx1 = goal.x1, gy1 = goal.y1, gr = goal.r;
  const hfun = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const done = (x, y) => Math.max(gx0 - x, 0, x - gx1) <= gr && Math.max(gy0 - y, 0, y - gy1) <= gr;
  const s = sy * n + sx;
  g[s] = 0; par[s] = -1; st[s] = stamp; push(hfun(sx, sy), s);
  let best = s, bestH = hfun(sx, sy), expanded = 0, found = -1;
  while (heap.length) {
    const [, c] = pop();
    if (cl[c] === stamp) continue; cl[c] = stamp;
    const cx = c % n, cy = (c / n) | 0;
    if (done(cx, cy)) { found = c; break; }
    const hh = hfun(cx, cy); if (hh < bestH) { bestH = hh; best = c; }
    if (++expanded > maxNodes) break;
    for (let d = 0; d < 8; d++) {
      const dx = PF_DX[d], dy = PF_DY[d];
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (cl[j] === stamp) continue;
      if (!passFn(j, nx, ny) || !map.canStep(cx, cy, nx, ny)) continue;
      if (d >= 4 && (!passFn(cy * n + nx, nx, cy) || !passFn(ny * n + cx, cx, ny))) continue;
      const ng = g[c] + (d >= 4 ? 1.414 : 1) + Math.max(0, map.elev[j] - map.elev[c]) * 0.3;
      if (st[j] !== stamp || ng < g[j]) { st[j] = stamp; g[j] = ng; par[j] = c; push(ng + hfun(nx, ny), j); }
    }
  }
  const end = found >= 0 ? found : best;
  const pts = [];
  for (let c = end; c !== -1 && pts.length < 4000; c = par[c]) pts.push(c);
  pts.reverse();
  // string-pull smoothing
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) if (lineClear(map, pts[i], pts[j], passFn)) break;
    out.push(pts[j]); i = j;
  }
  return { pts: out.map(c => ({ x: c % n + 0.5, y: ((c / n) | 0) + 0.5 })), ok: found >= 0 };
}
```
with:
```js
// ---------- Pathfinding (A*, 8-directional) ----------
// The open list is a binary heap in typed arrays: keys in a Float64Array and tile indices in an Int32Array, sifted with
// exactly the comparisons of the old array-of-pairs heap (<= up, strict < down), so equal keys pop in the same order.
const PF = { g: null, par: null, stamp: null, closed: null, cur: 1, n: 0, hf: new Float64Array(4096), hi: new Int32Array(4096) };
const PF_DX = [1, -1, 0, 0, 1, 1, -1, -1], PF_DY = [0, 0, 1, -1, 1, -1, 1, -1]; // neighbour offsets (were rebuilt for every neighbour)
function pfInit(n) {
  if (PF.n === n) return;
  PF.n = n; PF.g = new Float32Array(n * n); PF.par = new Int32Array(n * n); PF.stamp = new Uint32Array(n * n); PF.closed = new Uint32Array(n * n);
}
// Grid A* from (sx, sy) to the goal {x0, y0, x1, y1, r}; passFn(i, x, y) -> bool. Returns the tile chain from the start
// to the goal (ok) or to the expanded tile nearest the goal (not ok), and whether it stopped at maxNodes (budget).
// lim (optional, from hpa.js) keeps the search inside the clusters whose lim.cm entry equals lim.stamp, takes the
// steps from the class graph's masks lim.mv (asking passFn only on the gate tiles lim.gt) and weighs the heuristic
// by lim.w (slightly above 1, so ties go to the tile nearer the goal).
function pfGrid(map, sx, sy, goal, passFn, maxNodes, lim) {
  const n = map.n; pfInit(n);
  const stamp = ++PF.cur;
  const g = PF.g, par = PF.par, st = PF.stamp, cl = PF.closed, DX = PF_DX, DY = PF_DY;
  let hf = PF.hf, hi = PF.hi, hn = 0;
  const push = (f, i) => {
    if (hn === hf.length) { const f2 = new Float64Array(hn * 2), i2 = new Int32Array(hn * 2); f2.set(hf); i2.set(hi); PF.hf = hf = f2; PF.hi = hi = i2; }
    let k = hn++; hf[k] = f; hi[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[k]; hi[p] = hi[k]; hf[k] = tf; hi[k] = ti; k = p; }
  };
  const pop = () => {
    const top = hi[0], len = --hn;
    if (len > 0) {
      hf[0] = hf[len]; hi[0] = hi[len];
      let k = 0;
      for (; ;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === k) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[k]; hi[m] = hi[k]; hf[k] = tf; hi[k] = ti; k = m; }
    }
    return top;
  };
  // distance to the goal rectangle, without allocating (this runs for every node the search touches)
  const gx0 = goal.x0, gy0 = goal.y0, gx1 = goal.x1, gy1 = goal.y1, gr = goal.r;
  const hfun = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const done = (x, y) => Math.max(gx0 - x, 0, x - gx1) <= gr && Math.max(gy0 - y, 0, y - gy1) <= gr;
  const cm = lim ? lim.cm : null, cs = lim ? lim.stamp : 0, cw = lim ? lim.cw : 0, w = lim ? lim.w : 1, mv = lim ? lim.mv : null, gt = lim ? lim.gt : null;
  const s = sy * n + sx;
  g[s] = 0; par[s] = -1; st[s] = stamp; push(hfun(sx, sy) * w, s);
  let best = s, bestH = hfun(sx, sy), expanded = 0, found = -1, budget = false;
  while (hn) {
    const c = pop();
    if (cl[c] === stamp) continue; cl[c] = stamp;
    const cx = c % n, cy = (c / n) | 0;
    if (done(cx, cy)) { found = c; break; }
    const hh = hfun(cx, cy); if (hh < bestH) { bestH = hh; best = c; }
    if (++expanded > maxNodes) { budget = true; break; }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      if (cm && cm[(ny >> 4) * cw + (nx >> 4)] !== cs) continue;
      const j = ny * n + nx;
      if (cl[j] === stamp) continue;
      if (mv) {   // the class graph's step rule; the unit's own rule differs from it only on gate tiles
        if (!((mv[c] >> d) & 1)) continue;
        if ((gt[j] || (d >= 4 && (gt[cy * n + nx] || gt[ny * n + cx]))) && (!passFn(j, nx, ny) || (d >= 4 && (!passFn(cy * n + nx, nx, cy) || !passFn(ny * n + cx, cx, ny))))) continue;
      } else {
        if (!passFn(j, nx, ny) || !map.canStep(cx, cy, nx, ny)) continue;
        if (d >= 4 && (!passFn(cy * n + nx, nx, cy) || !passFn(ny * n + cx, cx, ny))) continue;
      }
      const ng = g[c] + (d >= 4 ? 1.414 : 1) + Math.max(0, map.elev[j] - map.elev[c]) * 0.3;
      if (st[j] !== stamp || ng < g[j]) { st[j] = stamp; g[j] = ng; par[j] = c; push(ng + hfun(nx, ny) * w, j); }
    }
  }
  const end = found >= 0 ? found : best, chain = [];
  for (let c = end; c !== -1 && chain.length <= n * n; c = par[c]) chain.push(c);   // no 4,000-point cap: a chain is at most every tile once
  chain.reverse();
  return { chain, ok: found >= 0, budget, expanded };
}
// String-pull smoothing of a tile chain into waypoints (tile centres), leaving out the start tile. Each step looks at
// most K points ahead (K = 0: to the end of the chain, the old unbounded smoothing). clear(a, b) is the straight-line
// test, lineClear by default.
function pfSmooth(map, chain, passFn, K, clear) {
  const n = map.n, out = [];
  let i = 0;
  while (i < chain.length - 1) {
    let j = K > 0 ? Math.min(chain.length - 1, i + K) : chain.length - 1;
    for (; j > i + 1; j--) if (clear ? clear(chain[i], chain[j]) : lineClear(map, chain[i], chain[j], passFn)) break;
    out.push(chain[j]); i = j;
  }
  return out.map(c => ({ x: c % n + 0.5, y: ((c / n) | 0) + 0.5 }));
}
// passFn(i, x, y) -> bool. goal: {x0,y0,x1,y1,r}. cls ('land', 'mounted' or 'naval', given by pathTo) lets the
// hierarchical search of hpa.js answer when it is switched on; without cls, or with it off, this is the plain grid A*.
function findPath(map, sx, sy, goal, passFn, maxNodes = 9000, cls) {
  const n = map.n; pfInit(n);
  if (maxNodes === 9000 && n > 110) maxNodes = Math.min(36000, Math.round(n * n * 0.85));
  sx = Math.max(0, Math.min(n - 1, sx | 0)); sy = Math.max(0, Math.min(n - 1, sy | 0));
  const hpaOn = typeof HPA === 'object' && HPA.enabled;
  if (cls && hpaOn) { const r = hpaFindPath(map, sx, sy, goal, passFn, cls); if (r) return r; }
  const res = pfGrid(map, sx, sy, goal, passFn, maxNodes, null);
  return { pts: pfSmooth(map, res.chain, passFn, hpaOn ? HPA.smooth : 0), ok: res.ok };
}
```

- [ ] **Step 4: The heap swap changes no route**

Before anything else uses the new code, check that the typed-array heap pops equal keys in the old order:
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, the same two hashes.

- [ ] **Step 5: The hierarchical answer**

In `game/js/hpa.js`, insert this block right before the line `// The live map changed by hand (tests and tools end such edits with computeRegions): rebuild everything. terraFlush`:
```js
// ---------- the abstract search ----------
const HS = { n: 0, g: null, st: null, par: null, cl: null, cur: 0, hf: new Float64Array(4096), hi: new Int32Array(4096) };
// A* over the nodes, from the start (its costs to the start cluster's nodes, sCost, and to the goal inside that
// cluster, sDone) to the goal (goalNodes: node tile -> cost from it to the goal). h(t) is the heuristic of a node
// tile. Returns the node tiles of the route in order (empty when the goal is reached inside the start cluster), or null.
function hpaSearch(G, ks, sCost, sDone, goalNodes, h) {
  const n = G.n, N = n * n, GOAL = N;
  if (HS.n !== n) { HS.n = n; HS.g = new Float64Array(N + 1); HS.st = new Uint32Array(N + 1); HS.par = new Int32Array(N + 1); HS.cl = new Uint32Array(N + 1); }
  const stamp = ++HS.cur, g = HS.g, st = HS.st, par = HS.par, cl = HS.cl, ni = G.ni, cls = G.cl;
  let hf = HS.hf, hi = HS.hi, hn = 0;
  const push = (f, i) => {
    if (hn === hf.length) { const f2 = new Float64Array(hn * 2), i2 = new Int32Array(hn * 2); f2.set(hf); i2.set(hi); HS.hf = hf = f2; HS.hi = hi = i2; }
    let q = hn++; hf[q] = f; hi[q] = i;
    while (q > 0) { const p = (q - 1) >> 1; if (hf[p] <= hf[q]) break; const tf = hf[p], ti = hi[p]; hf[p] = hf[q]; hi[p] = hi[q]; hf[q] = tf; hi[q] = ti; q = p; }
  };
  const pop = () => { const top = hi[0], len = --hn; if (len > 0) { hf[0] = hf[len]; hi[0] = hi[len]; let q = 0; for (; ;) { const l = 2 * q + 1, r = l + 1; let m = q; if (l < len && hf[l] < hf[m]) m = l; if (r < len && hf[r] < hf[m]) m = r; if (m === q) break; const tf = hf[m], ti = hi[m]; hf[m] = hf[q]; hi[m] = hi[q]; hf[q] = tf; hi[q] = ti; q = m; } } return top; };
  const relax = (t, ng, from) => { if (st[t] !== stamp || ng < g[t]) { st[t] = stamp; g[t] = ng; par[t] = from; push(ng + (t === GOAL ? 0 : h(t)), t); } };
  const sc = cls[ks];
  for (let i = 0; i < sc.nodes.length; i++) if (sCost[i] < Infinity) relax(sc.nodes[i], sCost[i], -1);
  if (sDone < Infinity) relax(GOAL, sDone, -1);
  while (hn) {
    const t = pop();
    if (cl[t] === stamp) continue; cl[t] = stamp;
    if (t === GOAL) { const out = []; for (let q = par[GOAL]; q !== -1; q = par[q]) out.push(q); return out.reverse(); }
    const k = hpaCluster(G, t), c = cls[k], a = ni[t], m = c.nodes.length, gt = g[t];
    if (!c.row[a]) hpaRow(G, k, a);
    const cost = c.cost, nodes = c.nodes, base = a * m;
    for (let b = 0; b < m; b++) { const w = cost[base + b]; if (b !== a && w < Infinity) relax(nodes[b], gt + w, t); }
    const e = c.inter[a]; for (let q = 0; q < e.length; q += 2) relax(e[q], gt + e[q + 1], t);
    const gc = goalNodes.get(t); if (gc !== undefined) relax(GOAL, gt + gc, t);
  }
  return null;
}
// Corridor for pfGrid: the clusters of the start and of every node on the abstract route, each widened by ring
// clusters. The abstract route can be walked inside its own clusters, so a corridor of ring 0 always holds a path.
// pfGrid then reads the graph's step masks (mv) and asks the unit's own rule only on gate tiles (gt).
function hpaCorridor(G, ks, route, ring) {
  const cw = G.cw, cm = G.cm, stamp = ++G.cstamp;
  const mark = k => { const cx = k % cw, cy = (k / cw) | 0; for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < cw && y < cw) cm[y * cw + x] = stamp; } };
  mark(ks); for (const t of route) mark(hpaCluster(G, t));
  return { cm, stamp, cw, w: HPA.weight, mv: G.mv, gt: G.gt };
}
// lineClear(map, a, b, passFn) on the graph's step masks: the same answer, asking passFn only on gate tiles.
function hpaClear(G, passFn) {
  const n = G.n, mv = G.mv, gt = G.gt;
  return (a, b) => {
    const x0 = a % n, y0 = (a / n) | 0, x1 = b % n, y1 = (b / n) | 0;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    let px = x0, py = y0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      if (x === px && y === py) continue;
      const dx = x - px, dy = y - py, d = HPA_DIR[(dy + 1) * 3 + dx + 1];
      if (!((mv[py * n + px] >> d) & 1)) return false;
      if ((gt[y * n + x] || (dx && dy && (gt[py * n + x] || gt[y * n + px]))) && (!passFn(y * n + x, x, y) || (dx && dy && (!passFn(py * n + x, x, py) || !passFn(y * n + px, px, y))))) return false;
      px = x; py = y;
    }
    return true;
  };
}
const HPA_DIR = [7, 3, 5, 1, -1, 0, 6, 2, 4];   // (dx, dy) -> bit index of PF_DX / PF_DY

// ---------- findPath's hierarchical answer ----------
// Same contract as findPath: { pts, ok }. null tells findPath to run its plain grid search (the old answer).
function hpaFindPath(map, sx, sy, goal, passFn, cls) {
  if (!W || map !== W.map) return null;
  HPA.stats.queries++;
  const n = map.n, C = HPA.C;
  const gx0 = goal.x0, gy0 = goal.y0, gx1 = goal.x1, gy1 = goal.y1, gr = goal.r;
  const hxy = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const h = t => hxy(t % n, (t / n) | 0);
  // 1. A near goal: the plain search with a small budget. When it finishes (found, or no tile left), it is the old answer.
  if (hxy(sx, sy) <= HPA.near) {
    const r = pfGrid(map, sx, sy, goal, passFn, HPA.nearNodes, null);
    if (!r.budget) { HPA.stats.near++; return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth), ok: r.ok }; }
  }
  const G = hpaGraph(cls), cw = G.cw, s = sy * n + sx, ks = (sy >> 4) * cw + (sx >> 4), sc = G.cl[ks];
  // 2. The start: its costs to its cluster's nodes, and to the goal tiles inside its cluster.
  const dx0 = Math.max(0, Math.ceil(gx0 - gr)), dx1 = Math.min(n - 1, Math.floor(gx1 + gr)), dy0 = Math.max(0, Math.ceil(gy0 - gr)), dy1 = Math.min(n - 1, Math.floor(gy1 + gr));
  hpaLocal(G, ks, [s], false);
  const sCost = new Float64Array(sc.nodes.length);
  for (let i = 0; i < sc.nodes.length; i++) sCost[i] = hpaD(sc.nodes[i]);
  let sDone = Infinity;
  const kx0 = (sx >> 4) * C, ky0 = (sy >> 4) * C;
  for (let y = Math.max(dy0, ky0); y <= Math.min(dy1, ky0 + C - 1); y++) for (let x = Math.max(dx0, kx0); x <= Math.min(dx1, kx0 + C - 1); x++) sDone = Math.min(sDone, hpaD(y * n + x));
  // 3. The goal: in each cluster the goal tiles fall in, the cost from every node to the nearest goal tile.
  const goalNodes = new Map();
  if (dx0 <= dx1 && dy0 <= dy1) for (let cy = dy0 >> 4; cy <= dy1 >> 4; cy++) for (let cx = dx0 >> 4; cx <= dx1 >> 4; cx++) {
    const k = cy * cw + cx, srcs = [];
    for (let y = Math.max(dy0, cy * C); y <= Math.min(dy1, cy * C + C - 1); y++) for (let x = Math.max(dx0, cx * C); x <= Math.min(dx1, cx * C + C - 1); x++) if (G.P[y * n + x]) srcs.push(y * n + x);
    if (!srcs.length) continue;
    hpaLocal(G, k, srcs, true);
    for (const t of G.cl[k].nodes) { const c = hpaD(t); if (c < Infinity) goalNodes.set(t, c); }
  }
  // 4. Region reject: the components the start reaches against those the goal is reached from.
  const comps = new Set();
  for (let i = 0; i < sc.nodes.length; i++) if (sCost[i] < Infinity) comps.add(G.comp[sc.nodes[i]]);
  let reach = sDone < Infinity;
  if (!reach) for (const t of goalNodes.keys()) if (comps.has(G.comp[t])) { reach = true; break; }
  if (reach) {
    const route = hpaSearch(G, ks, sCost, sDone, goalNodes, h);
    if (route) {
      const r = pfGrid(map, sx, sy, goal, passFn, n * n, hpaCorridor(G, ks, route, 1));
      if (r.ok) { HPA.stats.routed++; return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth, hpaClear(G, passFn)), ok: true }; }
    }
    HPA.stats.fallback++;   // the unit's own rule is stricter than the graph's (a gate it may not use): the old search decides
    return null;
  }
  // 5. Unreachable: a route to the reachable tile nearest the goal, ok false (findPath's best effort; the old search
  // could only find that tile or a farther one). A cluster's tiles are reachable when they share a connected area
  // with one of its nodes in the start's components; clusters are scanned nearest first.
  HPA.stats.unreachable++;
  let best = s, bh = h(s);
  hpaLocal(G, ks, [s], false);   // the start cluster's own reachable tiles count too
  for (let y = ky0; y < Math.min(n, ky0 + C); y++) for (let x = kx0; x < Math.min(n, kx0 + C); x++) { const t = y * n + x; if (hpaD(t) < Infinity) { const ht = hxy(x, y); if (ht < bh) { bh = ht; best = t; } } }
  const cand = [];
  for (let k = 0; k < G.cl.length; k++) {
    const labs = new Set(); for (const t of G.cl[k].nodes) if (comps.has(G.comp[t])) labs.add(G.lab[t]);
    if (!labs.size) continue;
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C, ex = Math.max(gx0 - (x0 + C - 1), 0, x0 - gx1), ey = Math.max(gy0 - (y0 + C - 1), 0, y0 - gy1);
    cand.push({ k, labs, lb: ex > ey ? ex + 0.414 * ey : ey + 0.414 * ex });
  }
  cand.sort((a, b) => a.lb - b.lb || a.k - b.k);
  for (const { k, labs, lb } of cand) {
    if (lb >= bh) break;
    const x0 = (k % cw) * C, y0 = ((k / cw) | 0) * C;
    for (let y = y0; y < Math.min(n, y0 + C); y++) for (let x = x0; x < Math.min(n, x0 + C); x++) { const t = y * n + x; if (G.P[t] && labs.has(G.lab[t])) { const ht = hxy(x, y); if (ht < bh) { bh = ht; best = t; } } }
  }
  if (best === s) return { pts: [], ok: false };
  const bx = best % n, by = (best / n) | 0, toB = { x0: bx, y0: by, x1: bx, y1: by, r: 0 }, kb = hpaCluster(G, best);
  const hB = t => { const ax = Math.abs(t % n - bx), ay = Math.abs(((t / n) | 0) - by); return ax > ay ? ax + 0.414 * ay : ay + 0.414 * ax; };
  hpaLocal(G, kb, [best], true);
  const toBest = new Map(); for (const t of G.cl[kb].nodes) { const c = hpaD(t); if (c < Infinity) toBest.set(t, c); }
  let sB = Infinity; if (kb === ks) { hpaLocal(G, ks, [s], false); sB = hpaD(best); }
  const route = hpaSearch(G, ks, sCost, sB, toBest, hB);
  const r = route && pfGrid(map, sx, sy, toB, passFn, n * n, hpaCorridor(G, ks, route, 1));
  if (!r || !r.ok) { HPA.stats.fallback++; return null; }
  return { pts: pfSmooth(map, r.chain, passFn, HPA.smooth, hpaClear(G, passFn)), ok: false };
}
// A new or loaded match: build the land and naval graphs and every intra edge now, so the first long order of the
// match does not pay for them. (Rebuilds after changes stay lazy. The editor's worlds never route, so they are skipped.)
function hpaWarm() {
  if (!HPA.enabled || !W || !W.map || (W.settings && W.settings.editor)) return;
  for (const cls of ['land', 'naval']) { const G = hpaGraph(cls); for (let k = 0; k < G.cl.length; k++) for (let a = 0; a < G.cl[k].nodes.length; a++) hpaRow(G, k, a); }
}
GameHooks.on('worldCreated', hpaWarm);
GameHooks.on('worldRestored', hpaWarm);
```

- [ ] **Step 6: `pathTo` passes the unit's movement class**

In `game/js/world.js`, replace:
```js
function pathTo(u, rect, r) {
  const res = findPath(W.map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u));
```
with:
```js
function pathTo(u, rect, r) {
  const res = findPath(W.map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u), undefined, hpaClassOf(u));
```

- [ ] **Step 7: Mark editor worlds so the warm-up skips them**

In `game/js/editor.js`, replace:
```js
    createWorld(s2, { players, seed: 1, fog: 'none', startRes: 'standard', startAge: 0 });
```
with:
```js
    createWorld(s2, { players, seed: 1, fog: 'none', startRes: 'standard', startAge: 0, editor: true });
```

- [ ] **Step 8: Run the routing test**

Run: `node tests/hpa-route.test.js`
Expected (about 40 s; observed while planning):
```
PASS 500 random pairs on 200 maps of 5 types: every route found, at most 1.1× the optimal grid A* (worst 1.028, mean 0.9995)  {"pairs":500,"worst":1.028,"invalid":0,"refInvalid":0,"notOk":0,"strictNew":0,"strictOld":0,"msOld":25.8,"msNew":9.2,"mean":0.9995,"routed":460}
PASS every leg is one valid grid step or passes lineClear (passable, climbable, no corner squeeze), and every route ends on its goal, as the old routes do  {...}
PASS goals within 24 tiles: whenever the bounded plain search finishes (most of them), its answer is exactly the old findPath answer  {"total":198,"near":154,"same":154}
PASS unreachable goals: ok stays false, the route ends at least as close to the goal as the old best effort and never comes back empty where the old one moved, and from its end both searches return an empty route (the give-up callers see)  {"cases":120,"perType":{"islands":40,"coastal":40,"rivers":40},"closer":120,"farther":0,"emptyBoth":0,"emptyLost":0,"deadEnd":120,"msOld":57.1,"msNew":9.7,"unreachable":240}
PASS unreachable goals are answered without the old full-budget search (9.7 ms against 57.1 ms in the vm)  {...}
PASS own gate: routed through by the hierarchy; enemy at the same gate: the old search answers (fallback)  {"ownGate":true,"foeGate":true,"trench":true,"noBridge":true,"bridge":true,"ship":true,"tunnel":true,...}
PASS trench: a knight (mounted class) goes round through the gap, a villager walks straight over  {...}
PASS a river blocks the route until a bridge is built; a ship sails along the river under it  {...}
PASS a tunnel through a ridge gives the short route  {...}
PASS createWorld builds the land and naval graphs with every intra edge, so the first cross-map route computes none (editor worlds are skipped)  {"ok":true,"cold":0,"editorBuilt":false}
10 passed, 0 failed
```
In the vm, a long route costs about a third of the old search's time. In the browser on the reference machine, a warm cross-map route at 256 measured 2–4 ms, against 6–9 ms for the old search.

- [ ] **Step 9: The graph test, syntax and the match outcome**

Run: `node tests/hpa-graph.test.js`
Expected: `3 passed, 0 failed`.
Run: `npm run test:syntax`
Expected: `94 scripts passed syntax checks.`
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, the same two hashes (the switch is still off).

- [ ] **Step 10: Commit**

```bash
git add game/js/map.js game/js/hpa.js game/js/world.js game/js/editor.js tests/hpa-route.test.js
git commit -m "feat(path): findPath answers long routes through the cluster graph (switched off)

A near goal keeps the old bounded search and its answer. Otherwise
region reject through the graph's components, abstract A*, and a grid
A* kept to the route's clusters plus one ring. An unreachable goal gets
the nearest reachable tile. The heaps are typed arrays (same pop order),
smoothing looks 64 points ahead, and the 4,000-point cap is gone. A new
match builds the graphs at once. HPA.enabled stays false, so the
signatures are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: (check, not committed) the game's suites with the switch on**

In `game/js/hpa.js`, temporarily change `  enabled: false,` to `  enabled: true,`. Then run each of: `node tests/movement.test.js`, `node tests/command.test.js`, `node tests/tactics.test.js`, `node tests/engineering.test.js`, `node tests/actors.test.js`, `node tests/bridges-tunnels.test.js`, `node tests/polish.test.js`
Expected (observed while planning): `8 passed`, `24 passed`, `17 passed`, `5 passed`, `5 passed`, `10 passed`, `6 passed`, each with `0 failed`: the same counts as with the switch off.
Then undo the switch: `git checkout -- game/js/hpa.js`. `git status --short` must be empty.

---
### Task 6: Group orders

Today `orderMove` gives every unit its own `setOrder`, and so its own full search, synchronously in the click handler. That is the E§5.4 freeze: 93–424 ms for 40 knights at 200 and 256 in the phase 2 rows.

Two `orderMove`s are live:
- the formation wrapper in command.js:184-195, which is the live one, since `CMD.formation` defaults to true;
- world.js:260-269, used when formations are off and for single units.

Both now hand their slots to `hpaGroupOrder`, and so does the attack-move command (ui.js:794).

**Design:**
- **Groups.** Units are grouped per movement class.
  - The leader is the unit nearest the group's middle (the first in the list on ties).
  - Members are the leader's owner's units within 12 tiles of it. Stragglers order alone.
- **The order.** Each unit still gets its order through `setOrder`, in the old order of calls. That keeps the queue capture, stances, `o.user` and the formation slots of command.js. The order object is remembered with the unit, in a `WeakMap`, never in the save or the signature.
- **The shared route.**
  - A member's first path request for that order object takes the group route: setOrder's `moveToPoint`, or attack-move's first tick.
  - That request arrives through `pathTo` like any other, so movement's `goalRect`, `goalR` and `dest`, the `_pf` rescue counters and `_pathMapVersion` all stay right.
  - The first such request computes the route once, from the leader to the order point. It is one hierarchical search, charged once to `PATHB`, and the members' own requests are not charged.
- **The member's path.** A leg from where it stands onto the route's first waypoint: a straight line if `lineClear`, else through the leader's tile, else a search of at most 600 nodes. Then the shared waypoints, then its own slot (the order point's tile is left out when the slot is in plain sight).
- **Later requests.** Every later request is the member's own search: followPath's repath when it is blocked, a new order, or an attack-move resumed after a fight. A queued (shift) order is a copy of the object, so it never shares.
- **Breaching.** `cmdFindBreach` keeps one answer per group and target for 5 s. With the switch on, the walls-open search starts where the unit's failed route ends, at the walls, so on a 480 map it is a short search instead of an exhausted cross-map one.
- **Switch off.** `hpaGroupOrder` just calls `setOrder` for each unit, `hpaShared` and `hpaGroupOf` return null, and `cmdFindBreach` searches from the unit as before.

**Files:**
- Create: `tests/hpa-group.test.js`
- Modify:
  - `game/js/hpa.js`: insert before the warm-up section;
  - `game/js/world.js:209` (`pathTo`) and `:263-270` (`orderMove`);
  - `game/js/command.js:191-192` (the formation `orderMove`) and `:305-322` (`cmdFindBreach`);
  - `game/js/polish.js:15-23` (`PATHB`);
  - `game/js/ui.js:794` (attack-move).

**Interfaces:**
- Consumes:
  - `findPath(..., cls)`, `hpaClassOf` (Tasks 4–5);
  - `setOrder`, `moveToPoint`, `lineClear`, `unitPass` (world.js, map.js);
  - `cmdFormation` slots (command.js); `PATHB` (polish.js).
- Produces:
  - `hpaGroupOrder(units, slotOf, x, y, t)`, where `t` is `'move'` or `'attackmove'`;
  - `hpaShares(u) → boolean`, used by polish.js;
  - `hpaGroupOf(u) → group | null`, used by `cmdFindBreach`;
  - `hpaShared(u, rect, r) → { pts, ok } | null`, used by `pathTo`;
  - `hpaJoin(u, route, rect)`;
  - `HPA_GROUP`;
  - the counters `HPA.stats.groups` and `HPA.stats.shared`.

- [ ] **Step 1: Write the failing group test**

Create `tests/hpa-group.test.js`:
```js
// Group orders (game/js/hpa.js with HPA.enabled): one route for the group, counted once against the path budget,
// every unit arriving at its formation slot; attack-move groups share one breach search.   node tests/hpa-group.test.js
const { run } = require('./engine-harness')();
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
run(`
function world(size, seed, type, np) {
  MAP_SIZES['x' + size] = size;
  const spec = generateMapSpec({ size: typeof size === 'number' ? 'x' + size : size, seed, mapType: type, numPlayers: np || 2 });
  createWorld(spec, { players: Array.from({ length: np || 2 }, (_, i) => ({ name: 'P' + i, civ: ['franks', 'turks', 'britons'][i % 3], color: PLAYER_COLORS[i], human: i === 0 })), seed, fog: 'none', startRes: 'high', startAge: 2 });
}
// 40 knights beside player 1's Town Center, the way the perf spec places them
function knights(a) { const us = []; for (let k = 0; k < 40; k++) { const p = nearestLandTile((a.x + 5 + (k % 8)) | 0, (a.y + 6 + ((k / 8) | 0)) | 0, true); us.push(spawnUnit('knight', 1, p ? p.x + 0.5 : a.x + 2, p ? p.y + 0.5 : a.y + 6)); } return us; }
`);

// ---------- 1. 40 knights across a 256 map: one search, budget charged once, everyone arrives ----------
const K = JSON.parse(run(`(() => {
  HPA.enabled = true; world(256, 33, 'land', 3);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1);
  let far = null, fd = -1; for (const t of tcs) { const d = Math.hypot(t.x - a.x, t.y - a.y); if (d > fd) { fd = d; far = t; } }
  const us = knights(a), out = { straight: +fd.toFixed(0) };
  const s0 = Object.assign({}, HPA.stats); PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0;
  let t0 = performance.now(); orderMove(us, far.x + 2, far.y + 6); out.groupMs = +(performance.now() - t0).toFixed(1);
  out.searches = HPA.stats.queries - s0.queries; out.shared = HPA.stats.shared - s0.shared; out.groups = HPA.stats.groups - s0.groups; out.budget = PATHB.used;
  out.pathOk = us.filter(u => u.pathOk).length;
  const slots = us.map(u => ({ x: u.order.x, y: u.order.y }));
  let t = 0; while (t < 400 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  out.seconds = +t.toFixed(0);
  const off = us.map((u, i) => Math.hypot(u.x - slots[i].x, u.y - slots[i].y));
  out.done = us.filter(u => !u.order && !u.dead).length;
  out.atSlot = off.filter(d => d < 1.5).length; out.worstSlot = +Math.max(...off).toFixed(1);   // crowding keeps some a little off their slot, as before
  out.within = us.filter(u => Math.hypot(u.x - far.x - 2, u.y - far.y - 6) < 8).length;
  // the same order with the hierarchy off: one full search per knight
  for (const u of us) removeEnt(u);
  HPA.enabled = false; const us2 = knights(a); t0 = performance.now(); orderMove(us2, far.x + 2, far.y + 6); out.oldMs = +(performance.now() - t0).toFixed(1);
  for (const u of us2) removeEnt(u);
  HPA.enabled = true; return JSON.stringify(out);
})()`));
ok('a 40-knight order across a 256 map runs one hierarchical search and charges the path budget once', K.searches === 1 && K.groups === 1 && K.shared === 40 && K.budget === 1 && K.pathOk === 40, K);
ok(`every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (${K.seconds} game seconds for ${K.straight} tiles)`, K.done === 40 && K.within === 40 && K.worstSlot <= 4 && K.atSlot >= 25, K);
ok(`the order takes a fraction of the old per-unit searches in the vm (${K.groupMs} ms against ${K.oldMs} ms)`, K.groupMs * 4 < K.oldMs, K);

// ---------- 2. members repath on their own only when blocked; a far straggler routes alone ----------
const B = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 7, 'land', 2);
  const tcs = W.list.filter(e => e.type === 'tc'), a = tcs.find(t => t.owner === 1), b = tcs.find(t => t.owner === 2);
  const us = []; for (let k = 0; k < 10; k++) { const p = nearestLandTile((a.x + 5 + (k % 5)) | 0, (a.y + 6 + ((k / 5) | 0)) | 0, true); us.push(spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5)); }
  const p = nearestLandTile((a.x - 30) | 0, (a.y + 20) | 0, true); const straggler = spawnUnit('spearman', 1, p.x + 0.5, p.y + 0.5); us.push(straggler);
  const s0 = Object.assign({}, HPA.stats);
  orderMove(us, b.x + 2, b.y + 7);
  const out = { shared: HPA.stats.shared - s0.shared, searches: HPA.stats.queries - s0.queries, alone: !HPA_GROUP.get(straggler), again: us.filter(u => hpaShares(u)).length };
  // a blocked member: followPath's repath (pathTo with the unit's own goal) is its own search, toward its own slot
  const m = us[3], slot = { x: m.order.x, y: m.order.y };
  let t = 0; while (t < 2) { worldTick(0.05); t += 0.05; }
  const q0 = HPA.stats.queries, sh0 = HPA.stats.shared; pathTo(m, m.goalRect, m.goalR);
  out.repath = HPA.stats.queries === q0 + 1 && HPA.stats.shared === sh0 && m.pathOk && m.goalRect.x0 === (slot.x | 0) && m.goalRect.y0 === (slot.y | 0);
  while (t < 300 && us.some(u => u.order)) { worldTick(0.05); t += 0.05; }
  out.done = us.filter(u => !u.order).length; out.total = us.length;
  return JSON.stringify(out);
})()`));
ok('10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive', B.shared === 10 && B.searches === 2 && B.alone && B.again === 0 && B.repath && B.done === B.total, B);

// ---------- 3. attack-move into a walled camp: one breach search for the group ----------
const W2 = JSON.parse(run(`(() => {
  HPA.enabled = true; world(160, 3, 'land', 2);
  const m = W.map, n = m.n, tcs = W.list.filter(e => e.type === 'tc');
  let s = null; for (let y = 10; y < n - 30 && !s; y += 3) for (let x = 10; x < n - 40; x += 3) { if (tcs.some(t => Math.hypot(t.x - x - 15, t.y - y - 8) < 30)) continue; s = { x, y }; break; }
  for (const e of W.list.slice()) if (e.kind !== 'unit' && e.x >= s.x - 2 && e.x < s.x + 34 && e.y >= s.y - 2 && e.y < s.y + 18) removeEnt(e);
  for (let y = s.y; y < s.y + 16; y++) for (let x = s.x; x < s.x + 32; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; }
  m.computeVH(); m.computeRegions();
  const cx = s.x + 24, cy = s.y + 8, camp = spawnBuilding('barracks', 2, cx - 1, cy - 1, true), walls = [];
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) === 4) walls.push(spawnBuilding('palisade', 2, x, y, true));
  const ks = []; for (let i = 0; i < 8; i++) ks.push(spawnUnit('longsword', 1, s.x + 1.5 + (i % 4), s.y + 6.5 + ((i / 4) | 0)));
  let inBreach = false, breachSearches = 0; const cfb = cmdFindBreach, fb = findPath;
  cmdFindBreach = function () { inBreach = true; try { return cfb.apply(this, arguments); } finally { inBreach = false; } };
  findPath = function () { if (inBreach) breachSearches++; return fb.apply(this, arguments); };
  hpaGroupOrder(ks, () => ({ x: cx + 0.5, y: cy + 0.5 }), cx + 0.5, cy + 0.5, 'attackmove');
  let t = 0; while (t < 10 && !ks.some(k => k.breaches)) { worldTick(0.05); t += 0.05; }
  const breached = ks.filter(k => k.breaches).length, firstBreachSearches = breachSearches;
  while (t < 300 && !camp.dead) { worldTick(0.05); t += 0.05; }
  findPath = fb; cmdFindBreach = cfb;
  return JSON.stringify({ breached, firstBreachSearches, opened: walls.some(w => w.dead), campDown: !!camp.dead, t: +t.toFixed(0) });
})()`));
ok('a grouped attack-move blocked by walls makes one breach search for the group, breaches and takes the camp', W2.breached >= 4 && W2.firstBreachSearches === 1 && W2.opened && W2.campDown, W2);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node tests/hpa-group.test.js`
Expected: FAIL, exit status 1:
```
FAIL a 40-knight order across a 256 map runs one hierarchical search and charges the path budget once  {"straight":160,"groupMs":1122.4,"searches":40,"shared":0,"groups":0,"budget":40,"pathOk":40,...}
PASS every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (107 game seconds for 160 tiles)  {...}
FAIL the order takes a fraction of the old per-unit searches in the vm (1122.4 ms against 3165 ms)  {...}
ReferenceError: HPA_GROUP is not defined
```

- [ ] **Step 3: The group orders**

In `game/js/hpa.js`, insert this block right before the line `// A new or loaded match: build the land and naval graphs and every intra edge now, so the first long order of the`:
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
// units: the ordered units; slotOf(u) -> {x, y} its destination; (x, y) the order point; t 'move' or 'attackmove'.
function hpaGroupOrder(units, slotOf, x, y, t) {
  const orderFor = u => { const s = slotOf(u); return { t, x: s.x, y: s.y }; };
  if (!HPA.enabled || units.length < 2 || !W || !W.map) { for (const u of units) setOrder(u, orderFor(u)); return; }
  const byClass = new Map(), groupOf = new Map();
  for (const u of units) { const c = hpaClassOf(u); if (!byClass.has(c)) byClass.set(c, []); byClass.get(c).push(u); }
  for (const [cls, grp] of byClass) {
    if (grp.length < 2) continue;
    let cx = 0, cy = 0; for (const u of grp) { cx += u.x; cy += u.y; } cx /= grp.length; cy /= grp.length;
    let L = grp[0], ld = Infinity; for (const u of grp) { const d = Math.hypot(u.x - cx, u.y - cy); if (d < ld) { ld = d; L = u; } }
    const g = { cls, leader: L, owner: L.owner, x: Math.max(0.3, Math.min(W.n - 0.3, x)), y: Math.max(0.3, Math.min(W.n - 0.3, y)), route: null, breach: null };
    for (const u of grp) if (u.owner === g.owner && Math.hypot(u.x - L.x, u.y - L.y) <= HPA.groupR) groupOf.set(u, g);
  }
  for (const u of units) {
    const o = orderFor(u), g = groupOf.get(u);
    if (g) HPA_GROUP.set(u, { g, o, used: false }); else HPA_GROUP.delete(u);
    setOrder(u, o);
  }
  HPA.stats.groups += new Set(groupOf.values()).size;
}
// Will u's next path request take its group's route? (polish.js does not charge such a request to PATHB.)
function hpaShares(u) { const r = HPA_GROUP.get(u); return !!(r && !r.used && u.order === r.o); }
// The group of u's current order, if it has one.
function hpaGroupOf(u) { const r = HPA_GROUP.get(u); return r && u.order === r.o ? r.g : null; }
// pathTo's first call for a member: its route from the group's, or null to search on its own.
function hpaShared(u, rect, r) {
  const rec = HPA_GROUP.get(u);
  if (!rec || rec.used || u.order !== rec.o) return null;
  rec.used = true;
  const g = rec.g;
  if (!g.route) {
    const L = g.leader.dead || g.leader.dying || g.leader.inside ? u : g.leader;
    if (typeof PATHB === 'object') PATHB.used++;   // the group's one search, charged to the per-tick path budget
    const res = findPath(W.map, L.x | 0, L.y | 0, { x0: g.x | 0, y0: g.y | 0, x1: g.x | 0, y1: g.y | 0, r: 0 }, unitPass(L), undefined, g.cls);
    g.route = { pts: res.pts, ok: res.ok, sx: L.x | 0, sy: L.y | 0 };
  }
  if (!g.route.pts.length) return null;
  const out = hpaJoin(u, g.route, rect);
  if (out) HPA.stats.shared++;
  return out;
}
// A member's own copy of the group route: a leg from where it stands onto the route's first waypoint, the waypoints,
// and its slot (rect) at the end.
function hpaJoin(u, route, rect) {
  const map = W.map, n = map.n, pass = unitPass(u), pts = route.pts;
  const T = p => Math.max(0, Math.min(n - 1, p.y | 0)) * n + Math.max(0, Math.min(n - 1, p.x | 0));
  const ux = Math.max(0, Math.min(n - 1, u.x | 0)), uy = Math.max(0, Math.min(n - 1, u.y | 0)), ui = uy * n + ux, first = T(pts[0]);
  let head;
  if (lineClear(map, ui, first, pass)) head = [];
  else if (lineClear(map, ui, route.sy * n + route.sx, pass)) head = [{ x: route.sx + 0.5, y: route.sy + 0.5 }];
  else {
    const j = findPath(map, ux, uy, { x0: first % n, y0: (first / n) | 0, x1: first % n, y1: (first / n) | 0, r: 0 }, pass, HPA.joinNodes);
    if (!j.ok) return null;
    head = j.pts.slice(0, -1);
  }
  if (!route.ok) return { pts: head.concat(pts), ok: false };
  const slot = { x: rect.x0 + 0.5, y: rect.y0 + 0.5 }, st = rect.y0 * n + rect.x0, body = pts.slice(0, -1);
  const prev = body.length ? T(body[body.length - 1]) : head.length ? T(head[head.length - 1]) : ui;
  // leave the route before the order point when the slot is in plain sight; otherwise go through the order point (a
  // slot that cannot be walked to from there gets the member's own repath when it is blocked)
  if (st === T(pts[pts.length - 1]) || lineClear(map, prev, st, pass)) return { pts: head.concat(body, [slot]), ok: true };
  return { pts: head.concat(pts, [slot]), ok: true };
}
```

- [ ] **Step 4: `pathTo` takes a member's group route; world.js `orderMove` hands over its slots**

In `game/js/world.js`, replace:
```js
function pathTo(u, rect, r) {
  const res = findPath(W.map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u), undefined, hpaClassOf(u));
```
with:
```js
function pathTo(u, rect, r) {
  const res = hpaShared(u, rect, r) || findPath(W.map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u), undefined, hpaClassOf(u));
```

In `game/js/world.js`, replace:
```js
  for (const grp of [land, sea]) {
    const k = Math.ceil(Math.sqrt(grp.length));
    grp.forEach((u, i) => {
      const ox = (i % k - (k - 1) / 2) * (grp.length > 1 ? 0.9 : 0), oy = (((i / k) | 0) - (k - 1) / 2) * (grp.length > 1 ? 0.9 : 0);
      if (u.type === 'transport' || u.order && u.order.t === 'unload') { }
      setOrder(u, { t: 'move', x: x + ox, y: y + oy });
    });
  }
```
with:
```js
  for (const grp of [land, sea]) {
    const k = Math.ceil(Math.sqrt(grp.length)), slots = new Map();
    grp.forEach((u, i) => {
      const ox = (i % k - (k - 1) / 2) * (grp.length > 1 ? 0.9 : 0), oy = (((i / k) | 0) - (k - 1) / 2) * (grp.length > 1 ? 0.9 : 0);
      slots.set(u, { x: x + ox, y: y + oy });
    });
    hpaGroupOrder(grp, u => slots.get(u), x, y, 'move');   // one route for the group (hpa.js); with the hierarchy off, one setOrder each as before
  }
```

- [ ] **Step 5: The formation `orderMove` and `cmdFindBreach`**

In `game/js/command.js`, replace:
```js
      const slots = cmdFormation(grp, x, y);
      for (const u of grp) { const s = slots.get(u); setOrder(u, { t: 'move', x: s.x, y: s.y }); }
```
with:
```js
      const slots = cmdFormation(grp, x, y);
      hpaGroupOrder(grp, u => slots.get(u), x, y, 'move');   // one route for the group, formation slots at its end
```

In `game/js/command.js`, replace:
```js
// path as if enemy walls were open; the first wall tile on it is what blocks us
function cmdFindBreach(u, rect, r) {
  const map = W.map, base = unitPass(u);
  const pass = i => base(i) || !!cmdBreachable(u.owner, map.blk[i]);
  const res = findPath(map, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, pass);
  if (!res.ok) return null;
  let px = u.x, py = u.y;
  for (const q of res.pts) {
    const steps = Math.max(1, Math.ceil(Math.hypot(q.x - px, q.y - py) / 0.2));
    for (let s = 1; s <= steps; s++) {
      const x = px + (q.x - px) * s / steps, y = py + (q.y - py) * s / steps;
      if (!map.inb(x | 0, y | 0)) continue;
      const w = cmdBreachable(u.owner, map.blk[map.idx(x | 0, y | 0)]); if (w) return w;
    }
    px = q.x; py = q.y;
  }
  return null;
}
```
with:
```js
// path as if enemy walls were open; the first wall tile on it is what blocks us
// With the hierarchy on (hpa.js), a group order keeps one answer per target for all its units, and the search starts
// where the unit's failed route ends (at the walls), so it stays short on any map.
function cmdFindBreach(u, rect, r) {
  const map = W.map, base = unitPass(u);
  const pass = i => base(i) || !!cmdBreachable(u.owner, map.blk[i]);
  const g = hpaGroupOf(u), key = rect.x0 + ',' + rect.y0 + ',' + rect.x1 + ',' + rect.y1 + ',' + r;
  if (g && g.breach && g.breach.key === key && W.t - g.breach.t < 5) { const w = g.breach.id ? ent(g.breach.id) : null; if (!g.breach.id || (w && !w.dead)) return w; }
  const lead = HPA.enabled && !u.pathOk && u.path && u.path.length ? u.path.slice(u.pi) : [];
  const from = lead.length ? lead[lead.length - 1] : u;
  const res = findPath(map, from.x | 0, from.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, pass);
  let wall = null;
  if (res.ok) {
    let px = u.x, py = u.y;
    scan: for (const q of lead.concat(res.pts)) {
      const steps = Math.max(1, Math.ceil(Math.hypot(q.x - px, q.y - py) / 0.2));
      for (let s = 1; s <= steps; s++) {
        const x = px + (q.x - px) * s / steps, y = py + (q.y - py) * s / steps;
        if (!map.inb(x | 0, y | 0)) continue;
        const w = cmdBreachable(u.owner, map.blk[map.idx(x | 0, y | 0)]); if (w) { wall = w; break scan; }
      }
      px = q.x; py = q.y;
    }
  }
  if (g) g.breach = { key, t: W.t, id: wall ? wall.id : 0 };
  return wall;
}
```

- [ ] **Step 6: The path budget charges the group's one search**

In `game/js/polish.js`, replace:
```js
    if (W && (W !== PATHB.world || W.tick !== PATHB.tick)) { PATHB.world = W; PATHB.tick = W.tick; PATHB.used = 0; }
    if (PATHB.used >= PATHB.perTick && u.path && u.pi < u.path.length && u.goalRect &&
        pathBudgetSameGoal(u.goalRect, rect) && u.goalR === r &&
        u._pathMapVersion === W.map.version) {
      PATHB.deferred++;
      u.repathT = 0.1 + simRandomSafe() * 0.3;
      return u.pathOk;
    }
    PATHB.used++;
```
with:
```js
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

- [ ] **Step 7: The attack-move command is a group order**

In `game/js/ui.js`, replace:
```js
  if (m.t === 'attackmove') { for (const u of sel) setOrder(u, { t: 'attackmove', x: t.x, y: t.y });
```
with:
```js
  if (m.t === 'attackmove') { hpaGroupOrder(sel, () => ({ x: t.x, y: t.y }), t.x, t.y, 'attackmove');
```

- [ ] **Step 8: Run the group test**

Run: `node tests/hpa-group.test.js`
Expected (about 15 s; observed while planning):
```
PASS a 40-knight order across a 256 map runs one hierarchical search and charges the path budget once  {"straight":160,"groupMs":48.4,"searches":1,"shared":40,"groups":1,"budget":1,"pathOk":40,"seconds":108,"done":40,"atSlot":28,"worstSlot":3,"within":40,"oldMs":3075.4}
PASS every knight arrives: its move ends within 8 tiles of the order point and 4 of its own slot (108 game seconds for 160 tiles)  {...}
PASS the order takes a fraction of the old per-unit searches in the vm (48.4 ms against 3075.4 ms)  {...}
PASS 10 grouped spearmen share one route, a straggler 40 tiles away searches alone, nobody takes the group route twice, a blocked member repaths to its own slot, and all arrive  {"shared":10,"searches":2,"alone":true,"again":0,"repath":true,"done":11,"total":11}
PASS a grouped attack-move blocked by walls makes one breach search for the group, breaches and takes the camp  {"breached":8,"firstBreachSearches":1,"opened":true,"campDown":true,"t":41}
5 passed, 0 failed
```
Two things to know when reading this output:
- `atSlot` counts knights within 1.5 tiles of their own slot. Crowding keeps some a little off it. The old per-unit routes measured the same 28 of 40, with the worst at 4.5 tiles against 3.0 here.
- The ≤ 16 ms budget is a browser figure. The vm is 6–12× slower on routes. In the browser on the reference machine, the perf spec measured this order at 6–13 ms for 120–256 (Task 8), against 94–406 ms in the same session with the phase 2 code.

- [ ] **Step 9: The other suites and the match outcome**

Run: `node tests/hpa-route.test.js`
Expected: `10 passed, 0 failed`.
Run: `npm run test:syntax`
Expected: `95 scripts passed syntax checks.`
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, the same two hashes (the switch is still off).

- [ ] **Step 10: Commit**

```bash
git add game/js/hpa.js game/js/world.js game/js/command.js game/js/polish.js game/js/ui.js tests/hpa-group.test.js
git commit -m "feat(path): group orders share one route; cmdFindBreach reuses it (switched off)

orderMove (both the formation wrapper and world.js) and the attack-move
command hand their units to hpaGroupOrder. The units of one class and
owner near the leader take one route, searched once and charged once to
PATHB: a leg onto it, its waypoints, then their own formation slots.
Later and blocked repaths are their own. cmdFindBreach keeps one answer
per group and target, and with the hierarchy on starts at the failed
route's end. HPA.enabled stays false, so the signatures are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: (check, not committed) the game's suites with the switch on**

As in Task 5 Step 11: temporarily change `  enabled: false,` to `  enabled: true,` in `game/js/hpa.js`, then run each of the movement, command, tactics, engineering, actors, bridges-tunnels and polish suites.
Expected (observed while planning): `8 passed`, `24 passed`, `17 passed`, `5 passed`, `5 passed`, `10 passed`, `6 passed`, each with `0 failed`.
Then `git checkout -- game/js/hpa.js`. `git status --short` must be empty.

---
### Task 7: Switch the hierarchy on, and re-record the signatures once

This is the one point in phase 3 where match outcomes change, and the only commit that touches `tests/fixtures/sim-signatures.json`. The switch keeps its URL override (`?hpa=off`), so the old routes stay one query string away for comparisons and bug reports.

**Files:**
- Modify: `game/js/hpa.js` (the switch), `tests/sim-signature.test.js` (header comment and the `AOR_HPA=off` knob), `tests/movement.test.js:73`, `tests/command.test.js:232`, `tests/bridges-tunnels.test.js:96` (each asserts that its routes went through the hierarchy, so a test that bypasses hpa.js cannot pass by accident)
- Re-record: `tests/fixtures/sim-signatures.json`

**Interfaces:**
- Consumes: everything from Tasks 4–6.
- Produces: `HPA.enabled === true` by default (`?hpa=off` turns it off in the browser); `AOR_HPA=off` for `tests/sim-signature.test.js`; the new golden hashes that phase 4 must keep.

- [ ] **Step 1: The switch, the signature knob and the three assertions**

In `game/js/hpa.js`, replace:
```js
  enabled: false,         // the switch: off, findPath and orderMove are the old ones (URL ?hpa=on / ?hpa=off)
```
with:
```js
  enabled: true,          // the switch: off, findPath and orderMove are the old ones (URL ?hpa=off / ?hpa=on)
```

In `tests/sim-signature.test.js`, replace:
```js
// re-recorded them for the deliberate AI stagger. A change that is meant to alter the simulation re-records them
// deliberately, and its commit says why:  AOR_RECORD=1 node tests/sim-signature.test.js
```
with:
```js
// re-recorded them for the deliberate AI stagger, and phase 3 for hierarchical routes and group orders (AOR_HPA=off
// plays with the hierarchy switched off: the routes before phase 3, whose hashes are in git at ed46ba5). A change that
// is meant to alter the simulation re-records them deliberately, and its commit says why:
//   AOR_RECORD=1 node tests/sim-signature.test.js
```

In `tests/sim-signature.test.js`, replace:
```js
function play(s) {
  const { run, warnings } = harness();
  run(`(() => {
```
with:
```js
function play(s) {
  const { run, warnings } = harness();
  if (process.env.AOR_HPA === 'off') run('HPA.enabled = false');
  run(`(() => {
```

In `tests/movement.test.js`, replace:
```js
ok('missing resources are named', Q === 'Need 50 more wood and 20 more gold', Q);
console.log(`\n${pass} passed, ${fail} failed`);
```
with:
```js
ok('missing resources are named', Q === 'Need 50 more wood and 20 more gold', Q);
const H = JSON.parse(run('JSON.stringify(HPA.stats)'));
ok('these routes went through the hierarchical search (hpa.js), not around it', H.queries > 0, H);
console.log(`\n${pass} passed, ${fail} failed`);
```

In `tests/command.test.js`, replace:
```js
ok('12 min AI soak with all features: no exceptions or AI errors', !SK.err && !SK.warns.length && SK.t >= 700, SK);
```
with:
```js
ok('12 min AI soak with all features: no exceptions or AI errors', !SK.err && !SK.warns.length && SK.t >= 700, SK);
const HS2 = JSON.parse(run('JSON.stringify(HPA.stats)'));
ok('these routes and group orders went through the hierarchy (hpa.js), not around it', HS2.queries > 0 && HS2.groups > 0, HS2);
```

In `tests/bridges-tunnels.test.js`, replace:
```js
ok('5 min soak with bridges/tunnels/canals, no exceptions', !S.err && S.jobs > 3 && S.same, S);
console.log(`\n${pass} passed, ${fail} failed`);
```
with:
```js
ok('5 min soak with bridges/tunnels/canals, no exceptions', !S.err && S.jobs > 3 && S.same, S);
const H = JSON.parse(run('JSON.stringify(HPA.stats)'));
ok('these routes went through the hierarchical search (hpa.js), not around it', H.queries > 0 && H.rebuilt > 0, H);
console.log(`\n${pass} passed, ${fail} failed`);
```

- [ ] **Step 2: With the switch off, the old outcome replays exactly**

This proves that the switch is the only change. Every other line of Tasks 4–6 leaves the recorded matches as they were.
Run: `AOR_HPA=off node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`, with `"got":"f620967b4318fae0eb0477b6cfc44259a3e3ec66"` and `"got":"f3599320291fc01383e6d58f4c82a3230c7b398b"`.

- [ ] **Step 3: With it on, the outcome changes**

Run: `node tests/sim-signature.test.js`
Expected: FAIL, both scenarios, with `aiErrors` 0 (observed while planning):
```
FAIL tiny-land-2p-feudal: 10 game minutes replay to the recorded state  {"expected":"f620967b4318fae0eb0477b6cfc44259a3e3ec66","got":"9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b","t":600,"entities":943,"aiErrors":0}
FAIL small-coastal-3p-castle: 10 game minutes replay to the recorded state  {"expected":"f3599320291fc01383e6d58f4c82a3230c7b398b","got":"824240c4ef2a39a77bd37ef06047d74fb74c7cd2","t":600,"entities":1456,"aiErrors":0}
0 passed, 2 failed
```

- [ ] **Step 4: Re-record**

Run: `AOR_RECORD=1 node tests/sim-signature.test.js`
Expected (about 25 s; these hashes were observed while planning on Node 22.17.1):
```
recorded tiny-land-2p-feudal 9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b {"hash":"9fda2e5ce30fcb7cc21011b3c1156542be7a5c8b","t":600,"entities":943,"aiErrors":0}
recorded small-coastal-3p-castle 824240c4ef2a39a77bd37ef06047d74fb74c7cd2 {"hash":"824240c4ef2a39a77bd37ef06047d74fb74c7cd2","t":600,"entities":1456,"aiErrors":0}
PASS signatures recorded  {...}
1 passed, 0 failed
```
If your hashes differ (another Node version), keep yours. What matters is that the next command replays them.
Run: `node tests/sim-signature.test.js`
Expected: `2 passed, 0 failed`.

- [ ] **Step 5: The three suites with their new assertion**

Run: `node tests/movement.test.js`, `node tests/command.test.js`, `node tests/bridges-tunnels.test.js`
Expected (observed while planning): `9 passed`, `25 passed` and `11 passed`, each with `0 failed`. The new last check of each reports the counters, for example in movement `{"queries":11874,"near":6352,"routed":2,"unreachable":5520,"fallback":0,"rebuilt":181,"groups":0,"shared":0}` and in command `{"queries":61923,"near":61803,"routed":108,"unreachable":12,"fallback":0,"rebuilt":300,"groups":2,"shared":21}`.

- [ ] **Step 6: Every node suite**

Run: `npm run test:syntax`
Expected: `95 scripts passed syntax checks.`
Run: `npm test`
Expected: every suite prints a summary with `0 failed`, and the last line is `Total: 390 checks passed; 0 suites failed.` (about 8 minutes). Before phase 3 it was `Total: 363 checks passed; 0 suites failed.`
New and changed suites:
- index-ai: +1 check.
- index-pop: 2.
- lint-index: 3.
- hpa-graph: 3.
- hpa-route: 10.
- hpa-group: 5.
- movement, command and bridges-tunnels: +1 each.

- [ ] **Step 7: The browser suite**

Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser`
Expected: every test passes. Observed while planning: `47 passed (4.2m)`.
Then run `git checkout -- assets/screenshots` if `git status --short` lists them.

- [ ] **Step 8: Commit, saying why the signatures change**

```bash
git add game/js/hpa.js tests/sim-signature.test.js tests/fixtures/sim-signatures.json tests/movement.test.js tests/command.test.js tests/bridges-tunnels.test.js
git commit -m "feat(path): switch on hierarchical routes and group orders; re-record the sim signatures

HPA.enabled is now true (?hpa=off turns it off). The golden signatures
are re-recorded deliberately, once:
- long routes now come from the cluster graph and its corridor search
  (near routes keep the old answer);
- an unreachable goal now walks to the nearest reachable tile;
- orderMove, which tactics.js uses for AI armies, now shares one route
  per group.
So unit paths, and with them the match states, change. With the switch
off (AOR_HPA=off) both matches still replay the old hashes exactly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Stress tests and the phase 3 performance rows

**Files:**
- Create: `tests/hpa-stress.js` (on demand; not part of `npm test`)
- Modify: `docs/maps-perf-baseline.md` (control rows of the phase 2 commit and the phase 3 rows, one session; the 480 route table)

**Interfaces:**
- Consumes:
  - `npm run test:perf` with `AOR_PERF_LABEL` (phase 1);
  - the cap patch idea of tests/browser/maps-perf.spec.js;
  - `HPA.enabled`.
- Produces: the phase 3 rows that phase 4 compares against, and the 480 route table.

- [ ] **Step 1: The 480 route check**

Create `tests/hpa-stress.js`:
```js
// Long routes on huge maps: with the size cap lifted inside the vm (the perf spec's patch: validateMapSpec with
// 'n > 256' raised to 1024), every Town Center reaches every other one on land, on coastal maps round the sea, and on
// islands with a transport: land leg to the shore, naval leg within one water body, land leg to the Town Center.
// The same routes are also asked of the old grid search (HPA.enabled = false) for comparison.
// Maps: land with 8 and 2 players and coastal with 8 and 3 (the evaluation's failed routes were coastal 3p and land
// 2p at 400), islands with 4 (with 8 players the islands generator joins every start into one landmass).
// Not part of npm test (about a minute): node tests/hpa-stress.js [size]   (default 480)
const harness = require('./engine-harness');
const n = +(process.argv[2] || 480);
let failed = 0;
console.log('| map | n | players | Town Center pairs | routes ok, hierarchy | routes ok, old search | legs (land / sea) | ms per route, hierarchy / old | build + edges ms |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const [type, np] of [['land', 8], ['land', 2], ['coastal', 8], ['coastal', 3], ['islands', 4]]) {
  const { run } = harness();
  const r = JSON.parse(run(`(() => {
    // the game's own validator source with the cap raised (no outside input reaches the eval), as in maps-perf.spec.js
    validateMapSpec = eval('(' + validateMapSpec.toString().replace('n > 256', 'n > 1024') + ')');
    MAP_SIZES.stress = ${n}; HPA.enabled = true;
    const spec = generateMapSpec({ size: 'stress', seed: 1, mapType: '${type}', numPlayers: ${np} });
    let t0 = performance.now();
    createWorld(spec, { players: Array.from({ length: ${np} }, (_, i) => ({ name: 'P' + i, civ: Object.keys(CIVS)[i % Object.keys(CIVS).length], color: PLAYER_COLORS[i], human: i === 0 })), seed: 1, fog: 'none', startRes: 'high', startAge: 2 });
    const build = performance.now() - t0;   // includes hpaWarm: both graphs and every intra edge
    const m = W.map, tcs = W.list.filter(e => e.type === 'tc').sort((a, b) => a.owner - b.owner);
    // a land tile of the Town Center's island beside open water, nearest to (tx, ty); and its water neighbour
    const shore = (tc, tx, ty) => {
      const reg = m.landReg[m.idx(tc.x + 1, tc.y + 1)]; let best = null, bd = 1e9;
      for (let y = 1; y < m.n - 1; y++) for (let x = 1; x < m.n - 1; x++) {
        const i = m.idx(x, y); if (m.landReg[i] !== reg || m.blk[i] || isWaterT(m.ter[i])) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = m.idx(x + dx, y + dy); if (isWaterT(m.ter[j]) && !m.blk[j]) { const d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = { x, y, wx: x + dx, wy: y + dy }; } break; } }
      }
      return best;
    };
    const unitAt = (type, owner, x, y) => spawnUnit(type, owner, x + 0.5, y + 0.5);
    const route = (u, rect, r, cls) => { const t = performance.now(); const res = findPath(m, u.x | 0, u.y | 0, { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: rect.y1, r }, unitPass(u), undefined, cls); return { ok: res.ok, ms: performance.now() - t }; };
    const out = { pairs: 0, ok: 0, okOld: 0, land: 0, sea: 0, ms: 0, msOld: 0, routes: 0, build: +build.toFixed(0), fails: [] };
    for (let a = 0; a < tcs.length; a++) for (let b = a + 1; b < tcs.length; b++) {
      const A = tcs[a], B = tcs[b], start = freeTileNear(A, false), v = spawnUnit('villager', A.owner, start.x, start.y);
      out.pairs++;
      let good = false, goodOld = false;
      for (const on of [true, false]) {
        HPA.enabled = on;
        const direct = route(v, rectOf(B), 1, 'land');
        on ? (out.ms += direct.ms, out.routes++) : (out.msOld += direct.ms);
        let ok = direct.ok;
        if (!ok && m.landReg[m.idx(A.x + 1, A.y + 1)] !== m.landReg[m.idx(B.x + 1, B.y + 1)]) {
          // islands: walk to the shore facing B, sail to the shore facing A, walk up to B
          const cb = center(B), ca = center(A), s1 = shore(A, cb.x, cb.y), s2 = shore(B, ca.x, ca.y);
          if (s1 && s2) {
            const leg1 = route(v, { x0: s1.x, y0: s1.y, x1: s1.x, y1: s1.y }, 0, 'land');
            const ship = unitAt('transport', A.owner, s1.wx, s1.wy), leg2 = route(ship, { x0: s2.wx, y0: s2.wy, x1: s2.wx, y1: s2.wy }, 0, 'naval');
            const lander = unitAt('villager', A.owner, s2.x, s2.y), leg3 = route(lander, rectOf(B), 1, 'land');
            removeEnt(ship); removeEnt(lander);
            ok = leg1.ok && leg2.ok && leg3.ok;
            if (on) { out.sea++; out.ms += leg1.ms + leg2.ms + leg3.ms; out.routes += 3; } else out.msOld += leg1.ms + leg2.ms + leg3.ms;
          }
        } else if (on) out.land++;
        if (on) good = ok; else goodOld = ok;
      }
      HPA.enabled = true; removeEnt(v);
      if (good) out.ok++; else out.fails.push(A.owner + '-' + B.owner);
      if (goodOld) out.okOld++;
    }
    out.ms = +(out.ms / out.routes).toFixed(1); out.msOld = +(out.msOld / out.routes).toFixed(1);
    return JSON.stringify(out);
  })()`));
  if (r.ok !== r.pairs) failed++;
  console.log(`| ${type} | ${n} | ${np} | ${r.pairs} | ${r.ok}/${r.pairs} | ${r.okOld}/${r.pairs} | ${r.land} / ${r.sea} | ${r.ms} / ${r.msOld} | ${r.build} |${r.fails.length ? ' failed: ' + r.fails.join(' ') : ''}`);
}
console.log(failed ? `FAIL: ${failed} map types have a Town Center pair without a route` : 'PASS: every Town Center pair has a route');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it**

Run: `node tests/hpa-stress.js`
Expected (about 40 s; observed while planning):
```
| map | n | players | Town Center pairs | routes ok, hierarchy | routes ok, old search | legs (land / sea) | ms per route, hierarchy / old | build + edges ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| land | 480 | 8 | 28 | 28/28 | 27/28 | 28 / 0 | 29.5 / 73 | 1351 |
| land | 480 | 2 | 1 | 1/1 | 1/1 | 1 / 0 | 66.5 / 124.5 | 1320 |
| coastal | 480 | 8 | 28 | 28/28 | 19/28 | 28 / 0 | 41.8 / 81.9 | 1368 |
| coastal | 480 | 3 | 3 | 3/3 | 2/3 | 3 / 0 | 60.3 / 113.1 | 1415 |
| islands | 480 | 4 | 6 | 6/6 | 6/6 | 0 / 6 | 3.6 / 15.8 | 1060 |
PASS: every Town Center pair has a route
```
- Every Town Center pair has a route with the hierarchy.
- The old search, with its budget of 36,000 nodes, fails 1 of 28 pairs on 8-player land, 9 of 28 on 8-player coastal and 1 of 3 on 3-player coastal. These are the failures of E§5.3.
- On islands, all 6 pairs go by land leg, sea leg and land leg. With 8 players the islands generator joins every start into one landmass (E§4), so that map type runs with 4 players.
- The times are vm figures, 6–12× the browser's.

- [ ] **Step 3: The control rows: the phase 2 commit, in this session**

docs/maps-perf-baseline.md asks every phase from 3 on to compare against a control run of the previous phase's commit, made in the same session. Use the same checkout, so `node_modules` is there, and leave no tracked change behind. Close other heavy programs first.
```bash
git status --short                      # must list only ?? tests/hpa-stress.js (untracked files survive the switch)
git switch --detach ed46ba5
AOR_PERF_LABEL="phase 2 control (ed46ba5)" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf
git diff --no-color docs/maps-perf-baseline.md | grep '^+|' | sed 's/^+//' > /tmp/p2-control-rows.md
git checkout -- docs/maps-perf-baseline.md
git switch feat/maps-phase3-pathfinding
```
Expected: `3 passed`, and `/tmp/p2-control-rows.md` holds three rows (n = 120, 200, 256) whose commit column is `ed46ba5`.

If `git switch` refuses, `git status --short` lists a tracked change: commit or stash it first. `test-results/` is git-ignored. If you prefer a second checkout, `git worktree add` may fail on this machine (`.git/worktrees` refuses writes). `git clone --shared . ../aor-p2 && git -C ../aor-p2 checkout --detach ed46ba5` works, but it has no `node_modules` of its own.

- [ ] **Step 4: The phase 3 rows**

Run: `AOR_PERF_LABEL="phase 3 hierarchy + group routes" PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:perf`
Expected: `3 passed`.

The spec appends its three rows at the very end of docs/maps-perf-baseline.md, below the phase 2 vm table. Move them, preceded by the three control rows from `/tmp/p2-control-rows.md`, to directly after the last phase 2 row of the first table, before `### Reading these rows`. Observed while planning, in one session (the commit column shows the planning copy's own commits):

| Date | Label | Commit | Renderer | n | Gen 3p / 8p ms | Tick 3p mean / p99 ms | Tick 8p mean / p99 ms | Tree search µs | 40 knights 3p / 8p ms (routes ok) | 2D frame z1 / z0.55 ms | 2D fps z1 / z0.55 | 2.5D fps | Save chars (ms) | Cache MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 120 | 50 / 46 | 0.32 / 1.1 | 0.68 / 1.9 | 6 | 94 / 27 (40/40, 40/40) | 4.07 / 2.59 | 56.5 / 56.5 | 56.4 | 1,252,594 (15) | 353 |
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 200 | 116 / 113 | 0.6 / 2.3 | 1.11 / 3.9 | 7 | 239 / 71 (40/40, 40/40) | 3.18 / 2.87 | 56.5 / 56.7 | 56.4 | 3,172,855 (37) | 982 |
| 2026-10-19 | phase 2 control (ed46ba5) | ed46ba5 | gpu | 256 | 175 / 193 | 0.84 / 2.5 | 1.45 / 5.7 | 3 | 406 / 368 (40/40, 40/40) | 4.63 / 4.23 | 56.6 / 56.6 | 54 | 5,291,783 (63) | 1038 |
| 2026-10-19 | phase 3 hierarchy + group routes | 6fdd25c | gpu | 120 | 54 / 50 | 0.34 / 1.2 | 0.69 / 1.7 | 6 | 8 / 8 (40/40, 40/40) | 4.33 / 2.85 | 56.7 / 56.7 | 56.6 | 1,252,058 (16) | 353 |
| 2026-10-19 | phase 3 hierarchy + group routes | 6fdd25c | gpu | 200 | 95 / 111 | 0.59 / 2.1 | 0.95 / 2.5 | 6 | 12 / 6 (40/40, 40/40) | 3.49 / 3.26 | 56.5 / 56.7 | 56.8 | 3,174,817 (43) | 982 |
| 2026-10-19 | phase 3 hierarchy + group routes | 6fdd25c | gpu | 256 | 183 / 193 | 0.72 / 2 | 1.23 / 3.3 | 28 | 13 / 10 (40/40, 40/40) | 3.88 / 3.99 | 56.9 / 56.8 | 54.3 | 5,292,824 (66) | 1038 |

- [ ] **Step 5: Check the numbers against the roadmap**

Compare each phase 3 row with the control row of the same n:
- **40 knights**:
  - at 256: ≤ 16 ms with 40/40 routes ok (the budget; observed 13 / 10 ms (40/40, 40/40), from 406 / 368 ms in the control);
  - at 120 and 200: ≤ 16 ms as well.
  - Every unit arriving is checked by `tests/hpa-group.test.js` (Task 6), since this spec removes the knights after the click.
- **Tick mean and p99**: about the control's, since phase 3 is not meant to move them; the AI's own attack-moves still route per unit. A difference within run-to-run noise (see "Reading these rows") is fine.
- **Tree search**: unchanged code. It times one villager's search, and that villager moves with the match, which phase 3 changes. Observed 28 µs at 256 against 3 in the control; the phase 2 target is ≤ 50 µs.
- **Gen, frame, fps, save and cache**: unchanged; phase 3 does not touch them.
If a 40-knight figure misses 16 ms, run the spec once more with nothing else running before investigating. The knights are ordered right after the launch, and `hpaWarm` builds the graphs during that launch.

- [ ] **Step 6: The 480 route table in the baseline document**

Append to `docs/maps-perf-baseline.md`, at the end:
```markdown

## Phase 3: Town Center routes at 480 (node tests/hpa-stress.js)

The size cap is lifted inside the vm, as the perf spec's cap patch does in the page. For every pair of Town Centers, a
villager's route: overland, or on islands a land leg to the shore, a transport's sea leg and a land leg to the Town
Center. "Old search" is the same request with the hierarchy switched off. Times are vm milliseconds (the vm is
6–12× slower than the browser on routes).

```
followed by the seven table lines printed in Step 2.

- [ ] **Step 7: Commit**

```bash
git add tests/hpa-stress.js docs/maps-perf-baseline.md
git commit -m "test(perf): phase 3 performance rows, a phase 2 control and the 480 route check

The 40-knight order across 256 now takes a few milliseconds instead of
hundreds, and every Town Center pair at 480 has a route on land, coastal
and islands (with transport). The old search failed up to 9 of 28 pairs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After Task 8: finishing the phase

As the roadmap's "How each phase ends" requires:
- `npm test`, the full browser suite (then `git checkout -- assets/screenshots`), and `npm run test:perf` against the same-session phase 2 control. Tasks 7 and 8 have already run all three.
- A final whole-branch review of Tasks 1–8 (superpowers:requesting-code-review). Points for the reviewer:
  - **Signatures:** the golden signatures changed only in Task 7, and `AOR_HPA=off node tests/sim-signature.test.js` fails only because the fixture now holds the new hashes. Check it against the phase 2 hashes in git if in doubt.
  - **Wiring:** every passability change in game code reaches `hpaDirty`, `hpaDirtyAll` or a new `GameMap`. The site table in Task 4 is the list; `tests/hpa-graph.test.js` Part 2 fails on a missing one.
  - **Dispatch:** `findPath` uses the hierarchy only from `pathTo`, which passes the class. `cmdFindBreach`, `cmdRegionSize`, engineering.js:57 and the group joins stay on the plain search with their own budgets.
  - **Owners and stances:** the graph never depends on them. Gates are open in the graph, and the corridor search asks the unit's own rule on gate tiles.
- Merge on the user's choice (superpowers:finishing-a-development-branch).

**For later phases.**
- Phase 4 (saves): the hierarchy is never saved; `worldRestored` rebuilds it.
- Phase 7 (content): the new generator must keep calling `computeRegions` after it builds a map. Any later code that writes `blk`, `ter`, `elev`, `bridge`, `tun` or `trench` on the live map calls `hpaDirty` for the rectangle.
- Code that sends a group somewhere calls `hpaGroupOrder`, or `orderMove`.
- Two known limits:
  - the AI's per-unit attack-moves (ai.js:557) still search one route per unit;
  - a unit that may not use a gate on the only way still pays today's full search.
