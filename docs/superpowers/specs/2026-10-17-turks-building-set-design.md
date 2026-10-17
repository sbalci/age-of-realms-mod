# Turks building set — design

Date: 2026-10-17 · Status: approved in brainstorming, awaiting spec review

## Goal and roadmap

Every civilization gets its own fully separate building style: its own layouts and recipes, not shared buildings recoloured. This spec is project 1 of that roadmap. It gives the Turks their own sprite for every building type and every age, 0 to 5, and pulls out the shared Blender kit code the later civs will build on.

For the Turks the eras are:

| Ages | Era |
|---|---|
| 0–1 | Seljuk |
| 2–3 | Ottoman |
| 4 (Modern) | Tanzimat |
| 5 | Republican, which replaces the sci-fi Future look for Turkish buildings |

**Roadmap** (one civ per project, each with its own spec, plan and user review points):

| Project | Scope | Kit |
|---|---|---|
| 1 | **Turks** (this spec) | Islamic kit, extended |
| 2 | Saracens | Islamic kit |
| 3 | Franks | new European kit |
| 4–6 | Teutons, Spanish, Italians | European kit |
| 7 | Vikings | new Nordic kit |
| 8 | Byzantines | new Byzantine kit |
| 9–10 | Chinese, Japanese | new East Asian kit |
| 11 | Walls, siege engines and props | — |

The Kenney building sprites stay as the fallback until every civ has its own set.

**Builds on:** [2026-10-16-islamic-building-kit-design.md](2026-10-16-islamic-building-kit-design.md). That project added `house_turks_0..3`, `tc_turks_0..3` and `monastery_turks_2..3`, plus the civ-sprite lookup in `civ_art.js`.

## Scope

79 new sprites, keyed `<type>_turks_<age>`. Ages 0–3 are baked only where the building can exist (`BUILDINGS[type].age`). Every type gets ages 4 and 5.

**Ages 0–3 (43 sprites)**

| Ages | Types | Sprites |
|---|---|---|
| 0–3 | `mill`, `lumbercamp`, `miningcamp`, `dock`, `barracks` | 20 |
| 1–3 | `market`, `blacksmith`, `range`, `stable` | 12 |
| 2–3 | `university`, `siege` | 4 |
| 1–3 | `tower` (watch, guard, keep) | 3 |
| 0, 2 | `well` | 2 |
| 2 | `castle` | 1 |
| 0 | `outpost` | 1 |

**Ages 4–5 (36 sprites):** ages 4 and 5 for all 18 types. That is the 15 above plus the existing `house`, `tc` and `monastery`, whose recipes gain styles 4 and 5.

| Building | Seljuk (0–1) | Ottoman (2–3) | Tanzimat (4) | Republican (5) |
|---|---|---|---|---|
| house | (existing) | (existing) | Istanbul mansion: pilasters, bay windows, hipped roof | Ankara cubic house: flat roof, horizontal windows |
| tc | (existing) | (existing) | Dolmabahçe-style palace: pedimented central pavilion, colonnade, clock tower | First-Parliament style: dressed stone, broad eaves, pointed-arch windows with tile panels, flagpole |
| monastery | — | (existing) | baroque mosque (Ortaköy/Nusretiye style): tall arched windows, single dome, slender minarets | Republican mosque: classical revival, one dome, two minarets, plain stone |
| mill | stone wind-tower mill (*asbad*) | larger, with a domed granary | brick steam flour mill with a chimney | concrete grain silos |
| lumbercamp | canvas-and-stone timber yard | stone yard with a timber crane | steam sawmill: brick shed, chimney | sawmill under a sawtooth roof |
| miningcamp | open quarry pithead | stone assay house with a domed smelter | Zonguldak-style coal winding tower (timber headframe) | steel headframe and ore bins |
| dock | timber jetty | arched stone *tersane* gallery with a domed beacon | steam-era arsenal with a clock tower and iron crane | concrete quay with a gantry crane |
| barracks | walled yard | Janissary barracks court with arcades and banners | Selimiye-style courtyard block with corner towers | 1930s military academy block: colonnade, flat roof |
| market | covered bazaar (age 1) | *bedesten* under rows of small lead domes | arcaded commercial hall with pilasters | First National style bank/market: broad eaves, tile panels |
| blacksmith | smithy (age 1) | forge with a rack of scimitars and round shields | brick ironworks with a chimney | steelworks: tall stacks, sawtooth roof |
| range | archery lodge (age 1) | *Meydan-ı Ok* lodge with composite-bow racks and targets | neoclassical shooting lodge | rifle range with a concrete berm |
| stable | timber stable (age 1) | *Has Ahır* imperial stables with a lead cupola and *tuğ* | neoclassical imperial stables | Republican stud farm: long low modern stables |
| university | — | madrasa and observatory: *iwan* portal, dome, sextant | Darülfünun-style columned facade | monumental 1930s faculty: colonnade, flat roof |
| siege | — | cannon foundry with gun barrels | Tophane-style domed cannon foundry | arms factory under a sawtooth roof |
| tower | watch tower (age 1) | domed guard turret (2); keep with a cannon gallery (3) | coastal artillery tower | concrete gun battery tower |
| well | stone well (age 0) | domed marble *şadırvan* fountain kiosk (2) | baroque fountain (Tophane style) | plain stone Republican fountain |
| castle | — | *Rumeli Hisarı*-style fortress: round cannon towers with cone lead roofs, pointed merlons, crescent finials (2) | Tanzimat gun bastion (Mecidiye *tabya*) | concrete coastal fortress with gun turrets |
| outpost | timber lookout (0) | — | telegraph signal tower | fire-watch and radio tower |

**Footprints and stature** match the shared recipes:

| Recipe | size | scale | sq |
|---|---|---|---|
| mill | 2 | 0.82 | 0.94 |
| lumbercamp | 2 | 0.70 | 0.76 |
| miningcamp | 2 | 0.70 | 0.76 |
| dock | 3 | 0.92 | 0.86 |
| market | 3 | 0.88 | 0.84 |
| blacksmith | 3 | 0.84 | 0.84 |
| university | 3 | 1.02 | 0.98 |
| barracks | 3 | 0.98 | 0.94 |
| range | 3 | 0.88 | 0.84 |
| stable | 3 | 0.90 | 0.84 |
| siege | 3 | 0.98 | 0.94 |
| tower | 1 | 0.84 | 0.96 |
| well | 1 | 0.70 | 0.78 |
| castle | 4 | 1.12 | 1.06 |
| outpost | 1 | 0.72 | 0.84 |

The existing house, tc and monastery recipes keep theirs.

**The dock** keeps the shared dock's water placement. It has no ground shadow quad (`bldSprite` already skips it), and its pier sits at water level.

**Not in scope:**
- other civs, including the Saracens' remaining types and ages (project 2)
- units: Turks units keep their existing age-5 future look, and only buildings become Republican
- the Wonders
- `?art=classic` shapes
- the 2.5D renderer

## Game changes

All in `game/js/civ_art.js`.

1. **Castle priority.**
   - Today the wrapped `bldSprite` (section D) picks a family castle first: `castle_med` for Islamic and Byzantine civs, a generated image with no recorded source. Only then does it try a civ sprite.
   - For `type === 'castle'`, try `civKartKey('castle', civ, st)` first; if found, use it with the crown skipped. Otherwise fall back to the family key, then `kartKey`.
   - The Turks castle recipe is `castle_turks` with `styles: [2, 4, 5]`.
   - Saracens and Byzantines keep `castle_med`; the Franks, Teutons, Spanish and Italians keep `castle`.
2. **No painted era add-ons on era-native sprites.**
   - `drawCivBuildingOverlay` section 4 paints the Modern (age 4) and Future (age 5) add-ons: antennas, floodlights, cyan strips.
   - When the chosen civ sprite was baked for the current age (its age suffix equals `st`, with `st >= 4`), pass an option that skips section 4.
   - When an older civ sprite stands in for age 4 or 5 (e.g. a Saracen `house_saracens_3`), section 4 still draws as today.
3. **Turks age-5 colours.**
   - `CIV_ARCH.turks.ages[5]` is the sci-fi palette today. It becomes Republican:

     ```js
     { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', base: '#9a8a78', beams: null, stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' }
     ```

     That is cream plaster, red tile, dark brick-red trim, warm pinkish Ankara stone, lead-grey domes, and Turkish red.
   - `CIV_ARCH.turks.ages[4]` keeps its colours (pale stone, lead roofs, red accent), which suit Tanzimat.
   - Classic art and overlays for the Turks at age 5 pick up the new colours too, so every art path agrees.

**The Town Center needs no new rule.** `tc_turks_4` and `tc_turks_5` tie on age with the shared generated `tc_4` / `tc_5`, and the civ sprite wins ties. For other civs `tc_4`/`tc_5` keep outranking their age-3 civ sprites.

## Loading civ sprites on demand

Added 2026-10-17 at the user's request.

**Why.** Today `art_kenney.js` downloads every key in `KENNEY_ART` at startup, and each finished image clears `R.spriteCache`, the UHD caches, `ICONS` and the panel keys. That is about 130 images now, about 210 after this project, and about 700 on the full roadmap.

**Change, in `game/js/art_kenney.js`:**
- `kartCiv(key)` returns the civ of a civ-specific key (`<type>_<civ>_<age>` where `<civ>` is a key of `CIVS` from `data.js`), else `null`. `tree_anatolian_0` stays shared because `anatolian` is not a civ.
- At startup only shared keys (`kartCiv(k) === null`) are requested.
- `KART.loadCiv(civ)` requests that civ's keys once and returns a Promise that settles when all of them have loaded or failed. Repeat calls return the same Promise.
- `KART.requested` (a Set) holds every key asked for so far.
- Cache clearing after loads is coalesced: at most one clear per animation frame, instead of one per image. `KART.revision` still increments per image.

**Change, in `game/js/civ_art.js`:** the wrapped `bldSprite` calls `KART.loadCiv(civ)` the first time it sees a civ. Until that civ's images arrive the existing fallback applies (shared sprite plus painted overlay), as it already does during progressive loading. The sprite name is recomputed each draw, so the civ sprite appears once loaded.

**Tests.**
- The browser "wait for art" helpers (`tests/browser/art.spec.js`, `islamic-art.spec.js`, `actors.spec.js`) wait for `KART.requested` to settle (loaded + failed = requested) instead of all of `KENNEY_ART`.
- Tests that need civ sprites first `await KART.loadCiv('<civ>')`.
- The missing-sprite count test counts only shared `tc_`/`farm_` keys.
- A new browser test checks that:
  - no `_turks_` key is requested at startup;
  - `KART.loadCiv('turks')` loads exactly the Turks keys;
  - a second call returns the same Promise;
  - loading N images clears `R.spriteCache` fewer than N times.

## Kit additions (Islamic kit)

New pieces in `tools/art/blender/islamic_kit.py`, same conventions as the existing 19: 1×1 cells, walls on the +x edge, glTF Y-up, matte, slot-named materials.

**For ages 0–3 (about 15 pieces)**

| Group | Pieces |
|---|---|
| Fortification | `tower-round` (round cannon tower, cone lead roof) |
| Structures | `asbad` (wind-tower mill); `kiosk` (domed fountain kiosk on columns); `lookout` (timber lookout) |
| Waterfront | `jetty` (planks on piles); `crane` (timber crane) |
| Yard props | `cannon` on its carriage; `rack-shields` (round shields and scimitars); archery `target`; `forge` (hearth and anvil); observatory `sextant` arc; `tug` standard; bazaar `awning`; stone `chimney` |

**For ages 4–5 (about 15 pieces)**

| Group | Pieces |
|---|---|
| Tanzimat | `column` (classical column with base and capital); `pediment`; `balustrade` parapet; `wall-pilaster` (tall arched window between pilasters); `clock-tower` |
| Republican | `eave-broad` (wide flat overhanging roof); `wall-tile-arch` (pointed-arch window with tile panel); `wall-modern` (flat stucco wall with a horizontal window band); `roof-sawtooth`; `silo` (concrete cylinder with cone); `headframe` (steel); `stack` (brick or steel chimney); `gantry` crane; `gun-turret`; `flagpole` |

**Slots**
- New fixed slots: `wood` (`#6b4a2b`), `metal` (`#4a4640`) and `brick` (`#9a4a32`).
- Awnings, banners and tile panels use the civ's `accent`.
- `tests/islamic-art.test.js`'s slot list and `FIXED` gain the three.

**`TOP`** gains an entry for every new piece that a finial or another piece sits on, including `tower-round`, `kiosk`, `asbad`, `lookout`, `clock-tower`, `silo` and `headframe`.

**Kenney props remain allowed:** trees, rocks, log piles, carts, barrels, and the hide-coloured tent.

## Code structure

**Blender**
- `tools/art/blender/kitlib.py` takes the kit-independent half of `islamic_kit.py`:
  - slot preview colours, `material()`
  - `Piece` (`box`, `slab_yz`, `lathe`, `prism`)
  - outline and profile helpers
  - `build_object`, `export`, `preview`, `main(pieces, kit_dir)`
- `islamic_kit.py` keeps its constants, wall helpers and piece builders, and imports `kitlib`.
- The runner stays `npm run art:kit`.
- **Neutral-refactor proof:** before any new piece, `npm run art:kit` re-exports the 19 existing GLBs byte-identical.

**Recipes**
- `tools/art/islamic-recipes.js` splits into three ES modules:
  - `tools/art/islamic-kit.mjs`: `PALETTES` (Turks ages 0–5, Saracens ages 0–3), `FIXED`, `SHADE`, `TOP`, `islamicSlots`, and the helpers `ring`, `roof`, `crown`, `portico` (plus any new Islamic helpers). `islamicSlots` clamps the age to the civ's palette length.
  - `tools/art/turks-recipes.mjs`: `TURKS_RECIPES`, all 18 Turks recipes.
  - `tools/art/saracens-recipes.mjs`: `SARACENS_RECIPES`, the 3 existing Saracen recipes.
- `tools/art/kenney-recipes.js` imports both civ modules and merges them into `RECIPES`.
- `tools/art/kenney-bake.html` imports `islamicSlots` from `islamic-kit.mjs`.
- `tools/art/bake-kenney.mjs`'s static server maps `.mjs` to `text/javascript`.
- **Neutral-refactor proof:** after the split, `npm run art:bake -- --recipes house_turks,tc_turks,monastery_turks,house_saracens,tc_saracens,monastery_saracens` leaves all 20 existing PNGs and `manifest.js` byte-identical.

## Process and review points

**Phase A: refactor and loading**
1. `kitlib.py`, the `.mjs` split, and both neutral proofs.
1b. On-demand civ sprite loading (see "Loading civ sprites on demand").

**Phase B: ages 0–3**
2. Add the ages 0–3 pieces. Check them in the live Blender over MCP from the bake angle (45° azimuth, 30° elevation), then remove the preview.
3. **Review point 1, new silhouettes.**
   - Recipes and a preview for `castle_turks` (age 2), `market_turks`, `dock_turks` and `university_turks` at their ages 0–3, next to the approved `house_turks` and `tc_turks`.
   - Use the create-game-assets QA.
   - **The user approves**, then bake ages 0–3 of those four.
4. **The remaining 11 types:** ages 0–3 recipes, self-check preview, bake with `--recipes`.
5. **Review point 2:** a contact sheet of all Turks sprites for ages 0–3 (53). **The user approves**, then re-bake anything polished.

**Phase C: ages 4–5**
6. Apply the `CIV_ARCH.turks.ages[5]` palette change and the section-4 skip.
7. Add the ages 4–5 pieces and preview them in Blender.
8. **Review point 3, Tanzimat and Republican style board.**
   - Ages 4 and 5 of `tc_turks`, `house_turks`, `monastery_turks` and `barracks_turks`.
   - **The user approves**, then bake those.
9. **The remaining 14 types:** ages 4–5 recipes, self-check preview, bake.

**Phase D: in-game check and docs**
10. **In-game check.** Extend `tests/browser/islamic-art.spec.js`:
    - A Turks-town scene with every Turks building type at ages 1, 3, 4 and 5, on cleared ground. Assert the expected `*_turks_*` keys are in `KART.cache`.
    - Save `test-results/turks-town-age<N>.png`.
    - Show the ages 4–5 contact sheet and these screenshots to the user.
11. **Docs:**
    - Islamic kit README: new pieces, `kitlib.py`, file names
    - ASSET_PLAN §2: per-civ recipe modules
    - ASSET_PLAN §3: Turks row with the Tanzimat/Republican eras
    - README: the per-civ modules and the Turks eras

## Tests

**`tests/islamic-art.test.js`**
- Imports `islamic-kit.mjs`, `turks-recipes.mjs` and `saracens-recipes.mjs` with `import()`, not vm text-stripping.
- Keeps every current check: pieces exist, matte, slots, the wall convention, `TOP` vs GLB bounds, palettes vs `CIV_ARCH` (now Turks ages 0–5, Saracens 0–3), `islamicSlots` rules, Kenney props exist, every style baked.
- Adds all new pieces to the piece list.
- Pins the exact key set: 89 Turks keys (10 existing + 79 new) and 10 Saracens keys.
- No recipe name appears in more than one of `kenney-recipes.js` and the two civ modules. The Kenney key set is read from the text of its `export const RECIPES = { … }` literal (two-space-indented `name: {` lines); the civ modules are imported.
- `manifest.js` has no stray `_turks_<n>` / `_saracens_<n>` keys outside the pinned set.

**`tests/browser/art.spec.js`**
- **Update** the age-5 probe:
  - Turks `tc` at age 5 → `tc_turks_5`.
  - The shared-Future-TC rule is checked with the Saracens: `tc` at age 5 → `tc_5`.
- **Castle probe:**
  - Turks at ages 2 and 3 → `castle_turks_2`, no painted dome.
  - Turks at age 4 → `castle_turks_4`.
  - Saracens and Byzantines at age 2 → `castle_med`.
  - Franks at age 2 → `castle`.
- **Era add-ons probe:**
  - Turks `house` at age 4 draws `house_turks_4` with section 4 skipped. Spy on a section-4 drawing call (e.g. count canvas strokes in a known colour, or wrap a helper section 4 uses).
  - Saracens `house` at age 4 draws `house_saracens_3` with section 4 drawn.

**`tests/browser/islamic-art.spec.js`**
- **Update** the age-5 expectations: Turks → `tc_turks_5`, `house_turks_5`, `monastery_turks_5`; Saracens → `tc_5`, `house_saracens_3`, `monastery_saracens_3`.
- Add the Turks-town scene.

**Existing suites** stay green: `npm test` (except the pre-existing `tests/command.test.js` failure) and `tests/art-bake-io.test.js`.

## Global constraints

- **Free and open source only.** No Blender MCP `generate_3d`, `search_assets` or `import_asset`, and no AI image generation.
- **Blender:** `D:\Blender\blender.exe` 5.2.2. **Playwright Chromium:** `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright`, set on each command, never user-wide.
- **Bake only with `npm run art:bake -- --recipes <names>`.** After every bake, `git status --short game/art/kenney` lists only that batch's `*_turks_*` PNGs and `manifest.js` (or nothing, for the neutral proof).
- **Never run the whole browser suite** without restoring `assets/screenshots/` afterwards.
- **Branch:** `feat/turks-building-set`.

## Risks

- **Scale.** 18 recipes across six ages, about 30 new pieces, 79 sprites. Three review points lock each new look before its long tail. Pieces may be added during the batches if a role cue needs one, with the same conventions and tests.
- **Era mismatch with units.** In age 5 the Turks' buildings are Republican, while their units stay futuristic. This is accepted for now, and the units can follow in a later project.
- **Byte-identical proofs.** If the GLB export or the PNG render turns out non-deterministic, compare the GLB JSON plus buffers, or the decoded pixels, and record that in the task report.
- **Dock on water.** Review the dock in the in-game check on cleared ground, and on a real shoreline if one is visible.
