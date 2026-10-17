# European building kit — design

Date: 2026-10-17 · Status: approved in brainstorming, awaiting spec review

## Goal

Replace the Kenney-built shared building sprites with original, Blender-scripted European medieval architecture. Each building takes a new form in every age. The existing sprite names are overwritten, so the game picks the new art up with no code change.

This is project 1 of 4 in the "Blender asset" roadmap:
1. Shared building set (this spec)
2. Finish the Turks and Saracens sets
3. Further civ families (East Asian, Nordic, Byzantine)
4. Walls, siege engines and props

It builds on the merged Islamic kit; see [2026-10-16-islamic-building-kit-design.md](2026-10-16-islamic-building-kit-design.md).

## Scope

63 sprites, overwriting `game/art/kenney/<key>.png` under the same names:

| Keys | Count |
|---|---|
| `house`, `tc`, `mill`, `lumbercamp`, `miningcamp`, `dock`, `market`, `blacksmith`, `university`, `monastery`, `barracks`, `range`, `stable`, `siege`, each `_0`–`_3` | 56 |
| `tower_0`, `tower_2`, and the new `tower_3` (Imperial keep) | 3 |
| `well_0`, `well_2` | 2 |
| `castle`, `outpost` | 2 |

Age forms follow [ASSET_PLAN.md](../../ASSET_PLAN.md) §5:

| Age | Materials |
|---|---|
| 0 Dark | wattle and daub, log walls, thatch |
| 1 Feudal | half-timbered plaster, shingle/tile roofs |
| 2 Castle | rubble stone, slate, crenellations |
| 3 Imperial | dressed stone, Gothic windows, spires, buttresses |

Every building keeps a role cue that reads at game scale:
- house: chimney
- tc: tower and bell
- mill: windmill sails at every age. `civ_art.js` marks the mill sprite as carrying static sails.
- lumber camp: log pile and saw shed
- mining camp: ore pile and hoist
- dock: pier on piles and crane
- market: awnings and stalls
- blacksmith: forge, chimney and anvil. The runtime forge glow is still drawn.
- university: dome or observatory from age 2
- monastery: bell tower or spire
- barracks: drill yard and weapon rack
- range: targets
- stable: open stalls and a paddock fence
- siege workshop: crane and timber bay
- tower: watch, then guard, then keep
- well: winch, then a roofed wellhouse
- castle: a Western concentric fortress, used by all four `west`-family civs (Franks, Teutons, Spanish, Italians)
- outpost: lookout scaffold

**Unchanged:**
- Turks and Saracens keep their `house`/`tc`/`monastery` civ sprites. Their other buildings show the new shared set plus the painted dome until project 2.
- The painted civ overlays in `civ_art.js` still draw on the shared sprites for the other civs.
- `tc_4`, `tc_5`, the Wonders, `castle_east`/`castle_med`/`castle_nordic`, the ships (generated images), farms, siege engines (`unit_*`), trees and resources.
- Classic art (`?art=classic`) and the 2.5D renderer.

**Game code** is unchanged, with one approved exception.
- `drawCivBuildingOverlay` paints civ crowns on shared sprites at heights derived from `BLD_H[type] × 0.58`. Those heights were tuned to the Kenney silhouettes:
  - East Asian eaves and the shachihoko
  - Norse dragon finials and shields
  - Byzantine domes
  - Turk and Saracen domes and minarets on the university, market, castle and fallback monastery
- If the in-game check shows crowns floating or sunk on the new silhouettes, the Kenney-mode (`isKenney`) overlay anchor may be retuned per building type. Preferably derive it from the sprite's manifest height above its anchor.
- `BLD_H` itself is not changed, because classic art and other systems use it.

## Shared Blender code

- `tools/art/blender/kitlib.py` takes the kit-independent half of `islamic_kit.py`:
  - slot preview colours and `material()`
  - the `Piece` builder (`box`, `slab_yz`, `lathe`, `prism`)
  - outline and profile helpers (`pointed_arch`, `opening`, `horseshoe`, `crescent`, `pointed_dome`, `round_dome`)
  - `build_object`, `export`, `preview`, and `main(pieces, kit_dir)`
- `islamic_kit.py` keeps its own `FACE`/`T` constants, wall helpers and the 19 piece builders. It imports `kitlib`.
- **Acceptance: the refactor is neutral.** After it, `npm run art:kit -- islamic` re-exports the 19 Islamic GLBs byte-identical (`git status` shows no change under `assets/original/islamic/`).
- `tools/art/blender/run-kit.mjs` takes the kit name first:
  - `npm run art:kit -- <islamic|european> [piece,piece]`
  - It runs `<kit>_kit.py` into `assets/original/<kit>/`.
  - An unknown kit name exits 1.

## European kit

- **Source:** `tools/art/blender/european_kit.py` writes about 40 pieces to `assets/original/european/`, with a README recording CC0 provenance.
- **Conventions,** the same as the Islamic kit:
  - 1×1 cell pieces centred on the origin; one storey = 1 unit
  - wall pieces on the +x edge facing +x
  - glTF Y-up
  - every material metallic 0 and roughness 1
  - material names are exactly the slot names below

**Pieces:**

| Group | Pieces |
|---|---|
| Walls (each with plain, window and door variants) | wattle-and-daub (age 0), log (camps), half-timbered plaster with `beams` (age 1), rubble stone (age 2), dressed ashlar with Gothic lancet windows (age 3) |
| Open bay | post-and-beam frame for sheds, stalls and stables |
| Roofs | gable (one cell, ridge along y, scaled by recipes to the block), hip, lean-to, cone, Gothic spire, thatch gable (thicker rounded eaves) |
| Details | chimney, dormer, crenellated parapet, round tower, square tower top, buttress, bell gable, rose window |
| Role props | windmill sails, pier on piles, crane, archery target, weapon rack, forge with anvil, market awning, log pile, ore pile, hay bale, training dummy |

Kenney props may still be placed by recipes, as in the Islamic kit: trees, rocks, fences, carts and barrels.

**Colour slots:**

| Slot | Source |
|---|---|
| `wall` | `STYLE[age].wall` in `game/js/render.js` |
| `stone` | `STYLE[age].stone` |
| `base` | `STYLE[age].base` |
| `trim` | `STYLE[age].trim` |
| `beams` | `STYLE[age].beams`, or `trim` when that is null |
| `roof` | `STYLE[age].roof` |
| `wood` | fixed `#6b4a2b` |
| `cloth` | fixed `#b8433a` |
| `gold` | fixed `#e8c040` |
| `dark` | fixed `#2a2420` |

`SHADE` starts at 1.0 and is tuned at review point 1.

## Recipes and baking

**Shared recipe code**
- `tools/art/kit-recipes.mjs` holds only what is kit-neutral:
  - `kitHelpers(kit, TOP)`, which returns `{ ring, crown }` bound to that kit's name and crown heights, so recipe call sites don't change;
  - `ROT`;
  - `slotColours(palette, fixed, shade)`.
- Kit-specific helpers stay with their kit:
  - Islamic: `roof()` places `roof-flat`, `portico()` places `wall-arcade`; both stay in `islamic-recipes.mjs`.
  - European: gable, porch and yard helpers go in `european-recipes.mjs`.
- The recipe modules become `.mjs`:
  - `tools/art/islamic-recipes.js` → `islamic-recipes.mjs`
  - new `tools/art/european-recipes.mjs`
- Each recipe carries `kit` and `slots(style)`:
  - Islamic: `style => islamicSlots(civ, style)`
  - European: `style => europeanSlots(style)`
- `tools/art/kenney-recipes.js` imports both and merges them into `RECIPES`.

**Bake page**
- `kenney-bake.html` registers `european` in `KITS`.
- The Islamic-only recolour branch becomes generic: for any original kit (`islamic`, `european`), every mesh's material colour comes from `recipe.slots(styleIdx)[material.name]`, with magenta for an unknown slot, roughness 1 and metalness 0.
- `bake-kenney.mjs` serves `.mjs` as `text/javascript`.

**Retiring the Kenney building recipes**
- `european-recipes.mjs` defines `house`, `tc`, `mill`, `lumbercamp`, `miningcamp`, `dock`, `market`, `blacksmith`, `university`, `monastery`, `barracks`, `range`, `stable`, `siege`, `tower`, `well`, `castle` and `outpost`.
- Each keeps today's `size`, `scale` and `sq`:

  | Recipe | size | scale | sq |
  |---|---|---|---|
  | house | 2 | 0.72 | 0.80 |
  | tc | 4 | 1.06 | 1.02 |
  | mill | 2 | 0.82 | 0.94 |
  | lumbercamp | 2 | 0.70 | 0.76 |
  | miningcamp | 2 | 0.70 | 0.76 |
  | dock | 3 | 0.92 | 0.86 |
  | market | 3 | 0.88 | 0.84 |
  | blacksmith | 3 | 0.84 | 0.84 |
  | university | 3 | 1.02 | 0.98 |
  | monastery | 3 | 1.02 | 1.02 |
  | barracks | 3 | 0.98 | 0.94 |
  | range | 3 | 0.88 | 0.84 |
  | stable | 3 | 0.90 | 0.84 |
  | siege | 3 | 0.98 | 0.94 |
  | tower | 1 | 0.84 | 0.96 |
  | castle | 4 | 1.12 | 1.06 |
  | outpost | 1 | 0.72 | 0.84 |
  | well | 1 | 0.70 | 0.78 |

- Styles are `[0, 1, 2, 3]` for the 14 four-age types, `[0, 2, 3]` for `tower` and `[0, 2]` for `well`. `castle` and `outpost` have none.
- These recipes, and any helper only they used, are deleted from `kenney-recipes.js`. It keeps `unit_*`, `wonder`, `farm`, `tree_*`, `berry_*`, `shrub_*`, `felled_*`, `stone_*` and `gold_*`.

**Baking**
- Bake only with `npm run art:bake -- --recipes <names>`.
- After each bake, `git status --short game/art/kenney` may list only that batch's PNGs and `manifest.js`.

## Process and review points

1. **Refactor.** Move the shared code into `kitlib.py`, `kit-recipes.mjs` and the `.mjs` recipe modules, and make recolouring generic.
   - Prove it neutral:
     - the Islamic GLBs re-export byte-identical;
     - `npm run art:bake -- --recipes house_turks,tc_turks,monastery_turks,house_saracens,tc_saracens,monastery_saracens` leaves every PNG byte-identical.
2. **Kit, style-board pieces only.**
   - Write `european_kit.py` with just what the House and Town Center need:
     - the five wall families
     - the open bay
     - the roofs
     - chimney, dormer, crenellated parapet, round tower, square tower top, bell gable
   - Check them in the live Blender over MCP from the bake angle, then remove the preview.
   - Role props (windmill sails, pier, crane, targets, forge, awning, piles, weapon rack, dummy) and the remaining details (buttress, rose window, spire) are added in the batch that first needs them. A style change at review point 1 then never means reworking props.
3. **Review point 1, style board.**
   - Preview `house` and `tc`, all four ages.
   - Use the create-game-assets QA. Tune `SHADE`.
   - **The user approves** the age progression and the look. Then bake `house` and `tc`.
4. **Batches,** each with a self-check preview, then a bake:
   - **A, civic:** mill, market, monastery, university, well
   - **B, economy:** lumbercamp, miningcamp, dock, blacksmith
   - **C, military:** barracks, range, stable, siege, tower, outpost, castle
5. **Review point 2.**
   - Contact sheet of all 63 sprites.
   - **The user approves.** Re-bake any polished recipes.
6. **In-game check.** `tests/browser/european-art.spec.js` builds two scenes on cleared ground.
   - **Frankish town:** one of each European building type at ages 0 and 3. Assert every expected shared key is in `KART.cache`. Save `test-results/european-age0.png` and `test-results/european-age3.png`.
   - **Overlay check:** at ages 2 and 3, a row of the overlay-heavy building types (`tc`, `university`, `market`, `barracks`, `castle`, `monastery`) for each of Japanese, Vikings, Byzantines and Turks. Save `test-results/european-overlays-age<N>.png`.
   - Review the screenshots for floating or sunk crowns. If needed, retune the Kenney-mode overlay anchors (see Scope), re-run, and review again.
7. **Docs.**
   - `assets/original/european/README.md` (CC0)
   - an ASSET_PLAN §2 line on the European kit
   - README: the kit sentence and `npm run art:kit -- <kit>`
   - Update the Islamic kit README's file references.

## Tests

- **Shared helper:** `tests/kit-glb.js` exports `glb(dir, name)` and `bounds(json)`. `tests/islamic-art.test.js` uses it.
- **`tests/islamic-art.test.js`** imports `islamic-recipes.mjs` with `import()` instead of vm text-stripping. All its current checks stay.
- **New `tests/european-art.test.js`:**
  - every piece exists, uses only the named slots, and is matte;
  - wall pieces follow the +x-edge, one-storey, one-cell convention;
  - `TOP` heights match the GLB bounds;
  - the European palette equals `STYLE` (ages 0–3) for `wall`/`stone`/`base`/`trim`/`roof`, and `beams` falls back to `trim` when `STYLE.beams` is null;
  - every Kenney prop a recipe uses exists;
  - every recipe style is baked into `manifest.js` with its PNG;
  - the exact 63-key set;
  - no recipe name is defined in more than one of `kenney-recipes.js`, `islamic-recipes.mjs` and `european-recipes.mjs`.
    - Duplicates are invisible after `Object.assign`.
    - `kenney-recipes.js` can't be imported from Node without a `MODULE_TYPELESS_PACKAGE_JSON` warning.
    - So: read the Kenney key set from the text of its `export const RECIPES = { … }` literal (two-space-indented `name: {` lines), import the two `.mjs` modules directly, and compare the three key sets pairwise.
- **Existing tests** stay green:
  - `npm test` (apart from the pre-existing `tests/command.test.js` failure)
  - `tests/browser/art.spec.js` (including the mill `staticSails` check)
  - `tests/browser/islamic-art.spec.js`
  - the new `tests/browser/european-art.spec.js`

## Global constraints

- **Free and open source only.** No Blender MCP `generate_3d`, `search_assets` or `import_asset`, and no AI image generation.
- **Blender:** `D:\Blender\blender.exe` (5.2.2). Playwright Chromium: `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright`, set on each command, never user-wide.
- **Never run a plain full bake.** Never run the whole browser suite without restoring `assets/screenshots/`, which it rewrites.
- **Branch:** `feat/european-building-kit`.

## Risks

- **Scale of the kit.** About 40 pieces plus 18 recipes is three times the Islamic pilot. The batches and the style board catch a drifting look early, and pieces can be added during batches if a role cue needs one.
- **Runtime overlays assume Kenney layouts.** Flags, banners, the forge glow and the painted civ crowns are drawn at fixed positions. Review point 2 and the in-game check look for collisions, and recipes leave the usual flag corner (front-left) clear.
- **Byte-identical refactor proof.** If Blender's exporter or the renderer turns out non-deterministic across runs, compare the GLB JSON and the PNG pixels instead of bytes, and say so in the report.
