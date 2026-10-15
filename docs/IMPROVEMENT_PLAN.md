# Age of Realms — Improvement Plan

As of 15 October 2026 · living version: [Claude doc](https://claude.ai/code/artifact/e469a912-456e-41fc-88e3-673cffef88d7) (this file is a snapshot; status notes are added below each section as work lands)

The biggest gain now is stronger computer opponents: in 35–40 minute AI-vs-AI test games most AIs never leave the Feudal Age. Interface, graphics and content follow in four phases.

## At a glance

| | Low effort | High effort |
| --- | --- | --- |
| **High player impact** | **Do first:** AI replaces ageing villagers · Balance harness and reports · Fixed command grid · Larger minimap · Performance budget in CI · Save compatibility tests | **Major projects:** AI economy planner and build orders · AI attack planner with retreats · Renderer decision and 2.5D parity · Scenario triggers and a campaign · Eight-direction units · Move mods from wrappers to hooks |
| **Lower player impact** | **Quick polish:** Contextual cursors · Accessibility options · Extra game modes · Mod API guide · New map types | **Later:** Simulation in a Web Worker · New civilizations · Recorded voice pack · Localization · Replays |

Placement is a judgement from the tests and play sessions so far.

## Where the game stands

The systems are broad and well tested; the opponent is the weak link. The build has 10 civilizations, 52 units, 23 buildings, 63 technologies, about 12,000 lines of plain JavaScript in 26 modules, and 218 headless checks in 16 suites plus Playwright browser tests.

| Area | State | Evidence |
| --- | --- | --- |
| Simulation and mod systems | Strong | Mortality, water, wells, terraforming, bridges and tunnels, Wonders and relics all covered by tests; deterministic RNG and saves |
| Computer opponents | Weak | 35–40 min AI-vs-AI games: 20–35 villagers, 10–17k resources gathered; most never reach the Castle Age; constant early fighting |
| Movement and pathing | Good | Stuck units cut from ~50 to ~3 per 8 min; route calculations in a 120-vs-120 battle cut from 9,937 to 3,387 per 20 s |
| Interface | Good, uneven | Recent fixes (stale command card, grid overflow, portraits, spectator HUD); command buttons still shift position between selections; minimap small |
| Graphics | Good in 2D, prototype in 2.5D | HD terrain, textured buildings, cached unit sprites; Three.js renderer keeps sprite units and some effects only in 2D |
| Audio | Basic | Procedural music and speech; positional panning; no ambience layers per biome or battle intensity |
| Content | Thin for long play | Random maps only (land, coastal, islands) and an editor; no scenarios, campaign, or map scripts |

## Status

15 October 2026, phase 1 (foundations):

- **Done:** ageing-aware AI (villager replacement, Herbal Medicine, Sanitation), terrain and battle tactics, balance harness (`tests/balance-report.js`, reports in [`docs/balance/`](balance/)), performance budget test in CI (`tests/perf.test.js`), save compatibility tests with fixtures from two releases (`tests/save-compat.test.js`), fixed command grid and larger minimap with filters (`game/js/hud.js`).
- **Found by the new performance test and fixed:** builders boxed in near a site, farmers aiming at a taken centre tile and lumberjacks standing diagonally to a tree all searched for a route every tick (a 35-minute AI game spent 70% of its time there; lumberjacks in that spot never chopped at all). A mid-game tick went from 20.5 ms to about 8 ms, and route searches from 17 to 4 per tick. The AI's lumber-camp site search (up to 1.4 s in one tick) and scout routes into forest were also fixed.
- **First balance report** ([docs/balance/latest.md](balance/latest.md), 10 seeds, Franks v Turks, 35 minutes): phase-1 gate **7 of 20** AI players in the Castle Age by minute 22 (target 9 of 10); 65% reach the Castle Age at all, none the Imperial Age; median Feudal Age 9.9 min; 9 of 10 games end with a winner (median 31 min); peak villagers 33. One game still had an 834 ms tick, to be traced.
- **Next:** release tags and changelog, then phase 2 (economy planner, build orders) measured against the balance report.

## Computer opponents and balance

A stronger AI economy is the single highest-value change: a match only feels like Age of Empires when the rival reaches the Castle and Imperial Ages with a real army. Target: a standard AI reaches the Castle Age by minute 22 and the Imperial Age by minute 40 in 9 of 10 seeded games.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Economy planner: target villager count per age, continuous villager production, farm re-seeding, drop-site placement by distance | Workforce stalls at 20–35 villagers; food and wood are the bottlenecks | L | P1 |
| Age-aware mortality for the AI: replace villagers before they die of old age, factor monk vows into the target | Lifespans shrink the AI workforce exactly when it needs to save for an age | S | P1 |
| Build orders by civilization and map (scripted openings, then the planner takes over) | Openings decide the first 15 minutes; today every civ opens alike | M | P1 |
| Attack planner: wave timing from army value, retreat below 30%, regroup, target choice (villagers, siege at walls, wonders) | Constant small skirmishes drain both economies; no retreat | M | P2 |
| Naval and island play: transports with escorts, dock control, fishing protection | Islands maps rarely produce contact | M | P2 |
| Difficulty that changes decisions, not only gather speed | Easy and hard differ mostly by gather multiplier | M | P2 |
| Balance harness: nightly tournament across civs, maps and seeds with win rates, age times and economy curves in one report | Tournament runner exists; results are not tracked over time | S | P1 |
| Use of mod systems by the AI: wells timing, canals, trenches, sapper tunnels, bridges | Engineering AI exists but is conservative | M | P3 |

## Gameplay depth

The mod systems are interesting on their own but rarely interact in a match; the next layer should make water, terrain, age and engineering matter to strategy.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Seasons and weather with effects: winter slows farms, rain fills wells, drought lowers rivers and opens fords | Water and terrain systems exist but never change during a match | M | P2 |
| Disease and sanitation: crowded towns without clean water risk outbreaks; monks and wells contain them | Gives wells and monks a strategic role beyond capacity | M | P2 |
| Families and inheritance: veterans train recruits faster; elders pass skills to villagers before they die | Turns mortality into a choice rather than a pure cost | M | P2 |
| Siege engineering: mining under walls by sappers, moats from canals, bridges that can be burned | Builds on tunnels, canals and bridges already in the game | M | P3 |
| Trade routes over rivers and roads; caravans that use bridges | Market and trade exist; geography does not matter to them yet | M | P3 |
| Formations and stance presets per control group, patrol and guard orders | Common RTS orders that players look for | S | P2 |
| Diplomacy depth: tribute demands, timed truces, AI alliances that can break | Diplomacy is a single dialog today | M | P3 |
| Game modes: regicide, king of the hill, treaty (no attacks for N minutes), nomad start | Cheap variety on top of existing victory code | S–M | P3 |

## Interface and controls

The interface works; what remains is consistency and information density, the things an AoE2 player notices in the first minute.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Fixed command grid: Stop, Delete, stances and pages always in the same slot | Buttons shift with each selection, so muscle memory never forms | S | P1 |
| Larger, scalable minimap with filters (military, economy, terrain) and right-click orders shown | Minimap is a ~150 px diamond at every resolution | S | P1 |
| Production overview panel: all queues, research and idle buildings in one strip | Today each building must be selected | M | P2 |
| Tech tree screen per civilization | 63 technologies and 10 civs with no overview | M | P2 |
| Contextual cursors (gather, attack, build, garrison, convert) | Right-click intent is guessed | S | P2 |
| Touch and small-screen layout; UI scale setting | Desktop only; 1100 px and 720 px heights were cramped | M | P3 |
| Localization (Turkish first) with all strings in one table | Speech already uses civ languages; UI text is English only | M | P3 |
| Accessibility: colour-blind player palettes, keyboard-only play, larger text option | No options today | S | P2 |

## Graphics and audio

Decide one renderer to lead: either make the 2.5D renderer complete (units, effects, selection) or keep Canvas 2D as the main look and treat 2.5D as an experiment. Maintaining two full renderers doubles every visual change.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Renderer decision and parity checklist (what 2.5D still lacks: unit models or billboards, fire, decals, fog fade, construction stages) | 2.5D keeps sprite units and loses several 2D effects | S | P2 |
| Eight-direction units (or four plus mirrored) for all humans and horses | Units show only left/right and a back view | L | P2 |
| Per-civilization building sets beyond colour and age materials (east, west, Mediterranean silhouettes for every building) | Civs look alike apart from a few landmarks | L | P3 |
| Death, conversion and promotion animations; veteran insignia on portraits | Ranks and conversions are hard to see | S | P2 |
| Day–night cycle and seasonal palettes tied to the weather system | Atmosphere; pairs with seasons in gameplay | M | P3 |
| Audio: biome ambience, battle-intensity music layers, distinct building and age-up stingers | Music is procedural but does not react to the match | M | P2 |
| Recorded or higher-quality voice lines as an optional pack (speech synthesis stays the fallback) | Speech voices vary a lot across systems | M | P3 |

## Performance and reliability

Set a budget and measure it on every change: large map, 8 players, 200+ units, 60 fps on a mid-range laptop and under 8 ms simulation per tick. Today a 120-vs-120 battle peaks above 100 ms per tick headless.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Performance budget test in CI (simulation ms per tick, render ms per frame, on fixed seeds) | Regressions are found by accident | S | P1 |
| Spatial index for targeting and separation; flow fields or shared paths for groups moving together | Per-unit A* and neighbour scans dominate large battles | M | P2 |
| Simulation in a Web Worker, rendering on the main thread | Long ticks freeze input | L | P2 |
| Save compatibility tests: load saves from the previous release on every change | Saves now carry many module states (wonders, jobs, fog memory) | S | P1 |
| Replays from recorded orders (the simulation is deterministic with seeded RNG) | Cheap once determinism holds; helps debugging and sharing | M | P3 |
| Crash and error reporting to a local log the player can export | AI errors are only console warnings | S | P2 |

## Content and modding

Content gives players reasons to come back once the systems are solid; the editor and the hook API already make most of it cheap.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| More map types: river valley, mountain pass, archipelago, desert oasis (water scarcity), arena | Three random map types; the water and terrain systems deserve maps built around them | M | P2 |
| Scenario triggers in the editor (conditions, objectives, messages, spawns) | Enables tutorials, challenges and a campaign without code | L | P2 |
| A short campaign, for example the Turks from Malazgirt to Constantinople, using the scenario system | A narrative showcase for the Turks civilization | L | P3 |
| More civilizations with distinct mechanics (Mongols, Persians, Byzantine Greek fire, Seljuks) | 10 civs; bonuses are mostly percentages | M each | P3 |
| Mod API documentation for GameHooks and data tables, with one example mod | Hooks exist; no guide for contributors | S | P2 |
| Map and mod sharing as files (import/export already exists for maps) | Lets players exchange content | S | P3 |

## Engineering

The wrapper-on-wrapper mod pattern made fast progress possible but is now the main source of subtle bugs (two modules patching the same function with different assumptions). Move shared behaviour onto GameHooks and explicit extension points before the codebase grows further.

| Improvement | Why | Effort | Priority |
| --- | --- | --- | --- |
| Migrate wrapped functions to GameHooks events (targeting, damage, orders, drawing, command card) and list the remaining wrappers in one place | Same functions are wrapped by up to six modules; order of script tags decides behaviour | M | P1 |
| ES modules or a single bundle step, keeping a no-build play path | Global namespace collisions (one test broke on a local `T`) | M | P2 |
| Type checks with JSDoc and `tsc --checkJs` in CI | Catches wrong field names across modules | S | P2 |
| Release tags with a changelog and a hosted demo build (GitHub Pages with an explicit opt-in) | No versions to refer to; players must run a local server | S | P1 |
| Contributor guide: module map, hook list, how to add a civ, unit or map | Lowers the cost of every later item | S | P3 |

## Roadmap

| Phase | Suggested weeks | Work | Gate to the next phase |
| --- | --- | --- | --- |
| 1 Foundations | 1–3 | Ageing-aware AI · balance harness · perf budget in CI · save compatibility tests · fixed command grid · larger minimap | AI in the Castle Age by minute 22 in 9 of 10 seeded games |
| 2 Opponents | 4–9 | Economy planner · civ build orders · attack planner · naval and islands · real difficulty levels | Hard AI beats standard AI in 7 of 10 games |
| 3 Depth and look | 10–16 | Renderer decision · seasons and weather · disease and wells · siege engineering · tech tree screen · mods move to hooks | Renderer parity checklist done |
| 4 Content | 17 on | Scenario triggers · Turks campaign · new map types · new civilizations · v1.0 and hosted demo | v1.0 tagged |

The week counts are a suggestion for one part-time developer working with Claude; each phase ends only when its gate is met in the tournament or checklist, not on a date.

## Risks and open questions

- **Two renderers.** Keeping Canvas 2D and Three.js both at full parity doubles visual work; a decision is needed before phase 3.
- **AI tuning against the mod systems.** Mortality, thirst and engineering all change the economy; a balance harness has to run before and after each AI change, or fixes in one place break another.
- **Wrapper conflicts.** Every new module that wraps an engine function raises the chance of ordering bugs; phase 1 should stop adding new wrappers.
- **Save format churn.** Each new system adds state to saves; without compatibility tests old saves will break silently.
- **Open question:** single-player only, or local multiplayer and online play later? Multiplayer would change priorities (lockstep networking on the deterministic simulation).
- **Open question:** who is the main audience: AoE2 veterans (depth, hotkeys, balance) or newcomers (lessons, presets, clarity)?
