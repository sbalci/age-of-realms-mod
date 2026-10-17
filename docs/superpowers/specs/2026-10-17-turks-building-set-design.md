# Turks building set — design

Date: 2026-10-17 · Status: approved in brainstorming, awaiting spec review

## Goal and roadmap

Every civilization gets its own fully separate building style: its own layouts and recipes, not shared buildings recoloured. This spec is project 1 of that roadmap: give the Turks their own sprite for every remaining building type, and pull out the shared Blender kit code the later civs will build on.

**Roadmap** (one civ per project, each with its own spec, plan and two user review points):

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

**Builds on:** [2026-10-16-islamic-building-kit-design.md](2026-10-16-islamic-building-kit-design.md). That project added `house_turks`, `tc_turks` and `monastery_turks`, plus the civ-sprite lookup in `civ_art.js`.

## Scope

43 new sprites, keyed `<type>_turks_<age>`. Only ages in which the building can exist (`BUILDINGS[type].age`) are baked:

| Ages | Types | Sprites |
|---|---|---|
| 0–3 | `mill`, `lumbercamp`, `miningcamp`, `dock`, `barracks` | 20 |
| 1–3 | `market`, `blacksmith`, `range`, `stable` | 12 |
| 2–3 | `university`, `siege` | 4 |
| 1–3 | `tower` (watch, guard, keep) | 3 |
| 0, 2 | `well` | 2 |
| 2 | `castle` | 1 |
| 0 | `outpost` | 1 |

Ages 0–1 are **Seljuk**: warm sandstone, turquoise tile, *kümbet* cones, carved portals. Ages 2–3 are **Ottoman**: pale limestone, cascading lead domes, pencil minarets, Iznik tile bands.

| Building | Seljuk (ages 0–1) | Ottoman (ages 2–3) |
|---|---|---|
| mill | stone wind-tower mill (*asbad*) | larger, with a domed granary |
| lumbercamp | canvas-and-stone timber yard | stone yard with a timber crane |
| miningcamp | open quarry pithead | stone assay house with a domed smelter |
| dock | timber jetty | arched stone *tersane* gallery with a domed beacon |
| barracks | walled yard | Janissary barracks court with arcades and banners |
| market | covered bazaar | *bedesten* covered bazaar under rows of small lead domes |
| blacksmith | smithy | forge with a rack of scimitars and round shields |
| range | archery lodge | *Meydan-ı Ok* archery lodge with composite-bow racks and targets |
| stable | timber stable | *Has Ahır* imperial stables with a lead cupola and a *tuğ* (horse-tail) standard |
| university | — | madrasa and observatory: *iwan* portal, dome, sextant |
| siege | — | cannon foundry with gun barrels in the yard |
| tower | watch tower (age 1) | domed guard turret (age 2); keep with a cannon gallery (age 3) |
| well | stone well (age 0) | domed marble *şadırvan* fountain kiosk (age 2) |
| castle | — | *Rumeli Hisarı*-style fortress: round cannon towers with cone lead roofs, curtain walls with pointed merlons, crescent finials |
| outpost | timber lookout | — |

**Ages 4–5** keep the existing rule: the civ's age-3 sprite plus the painted modern/future add-ons, with the overlay crown skipped.

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

**The dock** keeps the shared dock's water placement. It has no ground shadow quad (`bldSprite` already skips it), and its pier sits at water level.

**Not in scope:**
- other civs, including the Saracens' remaining types (project 2)
- units
- `?art=classic`
- the 2.5D renderer

## Game change: the castle

- Today `civ_art.js` (wrapped `bldSprite`, section D) picks a family castle first: `castle_med` for Islamic and Byzantine civs, a generated image with no recorded source. Only after that does it try a civ sprite, so a civ castle could never win.
- **Change:** for `type === 'castle'`, try `civKartKey('castle', civ, st)` first. If found, use it with the crown skipped. Otherwise fall back to the family key, then `kartKey`.
- Saracens and Byzantines keep `castle_med`; Franks, Teutons, Spanish and Italians keep `castle`.
- The Turks castle recipe is `castle_turks` with `styles: [2]`, so its key is `castle_turks_2`. Age 3 resolves to it through the existing nearest-lower rule.

## Kit additions (Islamic kit)

About 15 new pieces in `tools/art/blender/islamic_kit.py`, same conventions as the existing 19 (1×1 cells, walls on the +x edge, glTF Y-up, matte, slot-named materials):

| Group | Pieces |
|---|---|
| Fortification | round cannon tower with a cone lead roof (`tower-round`) |
| Structures | vertical wind-tower mill (`asbad`); domed fountain kiosk on columns (`kiosk`); timber lookout (`lookout`) |
| Waterfront | jetty, planks on piles (`jetty`); timber crane (`crane`) |
| Yard props | `cannon` on its carriage; `rack-shields` (round shields and scimitars); archery `target`; `forge` hearth with anvil; observatory `sextant` arc; `tug` standard; bazaar `awning`; stone `chimney` |

- **New fixed slots:** `wood` (`#6b4a2b`) and `metal` (`#4a4640`). `cloth` is not a new slot: awnings and banners use the civ's `accent`.
- `tests/islamic-art.test.js`'s slot list and `FIXED` in the kit module gain both.
- `TOP` gains an entry for every new piece a finial or another piece sits on: `tower-round`, `kiosk`, `asbad` and `lookout`.
- **Kenney props remain allowed:** trees, rocks, log piles, carts, barrels, and the hide-coloured tent.

## Code structure

**Blender**
- `tools/art/blender/kitlib.py` takes the kit-independent half of `islamic_kit.py`:
  - slot preview colours, `material()`
  - `Piece` (`box`, `slab_yz`, `lathe`, `prism`)
  - outline and profile helpers
  - `build_object`, `export`, `preview`, `main(pieces, kit_dir)`
- `islamic_kit.py` keeps its constants, wall helpers and piece builders, and imports `kitlib`.
- The runner stays `npm run art:kit` (Islamic kit only for now).
- **Neutral-refactor proof:** after the extraction and before any new piece, `npm run art:kit` re-exports the 19 existing GLBs byte-identical.

**Recipes**
- `tools/art/islamic-recipes.js` splits into three ES modules:
  - `tools/art/islamic-kit.mjs`: `PALETTES`, `FIXED`, `SHADE`, `TOP`, `islamicSlots`, and the helpers `ring`, `roof`, `crown`, `portico` (plus any new Islamic helpers).
  - `tools/art/turks-recipes.mjs`: `TURKS_RECIPES`, the 3 existing Turks recipes and the 15 new ones.
  - `tools/art/saracens-recipes.mjs`: `SARACENS_RECIPES`, the 3 existing Saracen recipes.
- `tools/art/kenney-recipes.js` imports both civ modules and merges them into `RECIPES`.
- `tools/art/kenney-bake.html` imports `islamicSlots` from `islamic-kit.mjs`.
- `tools/art/bake-kenney.mjs`'s static server maps `.mjs` to `text/javascript`.
- **Neutral-refactor proof:** after the split, `npm run art:bake -- --recipes house_turks,tc_turks,monastery_turks,house_saracens,tc_saracens,monastery_saracens` leaves all 20 existing PNGs and `manifest.js` byte-identical.

## Process and review points

1. **Refactor:** `kitlib.py`, the `.mjs` split, and both neutral proofs.
2. **New pieces:** add the ~15 pieces. Check them in the live Blender over MCP from the bake angle (45° azimuth, 30° elevation), then remove the preview.
3. **Review point 1, new silhouettes:**
   - Recipes and a preview for `castle_turks`, `market_turks`, `dock_turks` and `university_turks` at every age, next to the approved `house_turks` and `tc_turks`.
   - Use the create-game-assets QA.
   - **The user approves**, then bake those four.
4. **Remaining 11 types:** recipes, self-check preview, bake with `--recipes`.
5. **Review point 2:** a contact sheet of the full Turks set (53 sprites). **The user approves**, then re-bake anything polished.
6. **In-game check:** `tests/browser/islamic-art.spec.js` gains a Turks-town scene with every Turks building type at ages 1 and 3 on cleared ground.
   - Assert the expected `*_turks_*` keys are in `KART.cache`.
   - Save `test-results/turks-town-age1.png` and `turks-town-age3.png` for review.
7. **Docs:**
   - Islamic kit README: new pieces, the `kitlib.py` note, new file names
   - ASSET_PLAN §2: per-civ recipe modules
   - README: the per-civ recipe modules sentence

## Tests

- **`tests/islamic-art.test.js`:**
  - Imports `islamic-kit.mjs`, `turks-recipes.mjs` and `saracens-recipes.mjs` with `import()`, not vm text-stripping. The `.mjs` extension avoids Node's typeless-package warning.
  - Keeps every current check: pieces exist, matte, slots, the wall convention, `TOP` vs GLB bounds, palettes vs `CIV_ARCH`, `islamicSlots` rules, Kenney props exist, every style baked.
  - Adds the new pieces to the piece list.
  - Pins the exact key set: 53 Turks keys (10 existing + 43) and 10 Saracens keys.
  - Checks no recipe name appears in more than one of `kenney-recipes.js` and the two civ modules. The Kenney key set is read from the text of its `export const RECIPES = { … }` literal (two-space-indented `name: {` lines); the civ modules are imported.
  - Checks `manifest.js` has no stray `_turks_<n>` / `_saracens_<n>` keys outside the pinned set.
- **`tests/browser/art.spec.js`:** a castle probe, using the existing `drawProbe`.
  - Turks at age 2 → `castle_turks_2`, no painted dome.
  - Saracens and Byzantines at age 2 → `castle_med`.
  - Franks at age 2 → `castle`.
- **`tests/browser/islamic-art.spec.js`:** the Turks-town scene above.
- **Existing suites** stay green: `npm test` (except the pre-existing `tests/command.test.js` failure), `tests/art-bake-io.test.js`, and the browser art specs.

## Global constraints

- **Free and open source only.** No Blender MCP `generate_3d`, `search_assets` or `import_asset`, and no AI image generation.
- **Blender:** `D:\Blender\blender.exe` 5.2.2. **Playwright Chromium:** `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright`, set on each command, never user-wide.
- **Bake only with `npm run art:bake -- --recipes <names>`.** After every bake, `git status --short game/art/kenney` lists only that batch's `*_turks_*` PNGs and `manifest.js` (or nothing, for the neutral proof).
- **Never run the whole browser suite** without restoring `assets/screenshots/` afterwards.
- **Branch:** `feat/turks-building-set`.

## Risks

- **Scale.** 15 recipes is five times the pilot. Review point 1 locks the new silhouettes before the long tail, and pieces may be added during step 4 if a role cue needs one (each with the same conventions and tests).
- **Byte-identical proofs.** If the GLB export or the PNG render turns out non-deterministic, compare the GLB JSON plus buffers, or the decoded pixels, and record that in the task report.
- **Dock on water.** A dock sprite must read on water tiles. Review it in the in-game check, where the dock sits on the cleared ground scene, and on a real shoreline if one is visible.
