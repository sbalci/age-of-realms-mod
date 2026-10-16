# Islamic building kit — design

Date: 2026-10-16 · Status: approved in brainstorming, awaiting spec review

## Goal

Give the Turks and Saracens their own buildings instead of the shared Kenney town houses with a painted dome on top. The pieces are original 3D models scripted in Blender and rendered by the existing sprite baker, so they match the camera, lighting and shadows of every other building.

This is the pilot for the per-civilization building sets in [ASSET_PLAN.md](../../ASSET_PLAN.md) §3 and §5, and for the P3 item "Per-civilization building sets beyond colour" in [IMPROVEMENT_PLAN.md](../../IMPROVEMENT_PLAN.md).

## Scope

20 new sprites:

| Building | Ages | Turks | Saracens |
|---|---|---|---|
| `house` (2×2) | 0–3 | Ages 0–1: Seljuk stone dwelling, flat roof. Ages 2–3: Ottoman timber-and-plaster *konak* with a projecting upper-floor bay (*cumba*). | Sandstone courtyard house, flat parapet roof, *mashrabiya* lattice bay window, *malqaf* windcatcher. |
| `tc` (4×4) | 0–3 | Ages 0–1: Seljuk caravanserai, grand arched portal and a cone-roofed *kümbet* tower. Ages 2–3: Ottoman *Divan* hall with stepped lead-grey domes and a crescent *alem* finial. | *Dar al-Imara* palace court: horseshoe-arch arcades, ribbed dome, palms. Striped (*ablaq*) stone courses from age 2. |
| `monastery` (3×3) | 2–3 | Age 2: Seljuk tiled mosque-school (*Gök Medrese*). Age 3: Ottoman mosque with stepped domes and a pencil minaret. | Courtyard mosque with a pointed turquoise/gold dome and a square tiered minaret. |

- The monastery starts at age 2 because it is not buildable before then (`BUILDINGS.monastery.age = 2`).
- Sprite keys are `<type>_<civ>_<age>`, for example `house_turks_0`, `tc_saracens_2` and `monastery_turks_3`.

The sprites appear in the default Canvas 2D view.

**Not in scope**
- Ages 4–5 sprites. A civ sprite is used only when it is at least as recent as the shared sprite the game would otherwise pick:
  - Houses and monasteries in ages 4–5 show the civ's age-3 sprite plus the existing modern/future overlay, which is what every building does today.
  - The Town Center keeps the dedicated shared Modern and Future sprites (`tc_4`, `tc_5`).
- Other buildings and other civs.
- Units.
- The 2.5D renderer. It is an opt-in prototype (`?renderer=three` or `localStorage.aor_renderer`) that builds its own procedural meshes, and it stays unchanged.
- `?art=classic`.

## Art direction

- **Match Kenney's construction style:**
  - flat shading, no textures, flat colours
  - low polygon counts (domes about 16 segments)
  - chunky trim
  - one storey = 1 unit; doorways sized for 24 px humans (ASSET_PLAN §4)
- **Silhouette first.** Every building must be identifiable at 1× game scale (64×32 px tile) by its crown:
  - Turks age 0–1: kümbet cone
  - Turks age 2+: lead dome plus pencil minaret
  - Saracens: pointed ribbed dome plus square minaret
- **Colours come from the per-age palettes in [civ_art.js](../../../game/js/civ_art.js)** (`CIV_ARCH.turks.ages`, `CIV_ARCH.saracens.ages`, indices 0–3). The kit's material slots map to these palette fields:

  | Slot | Palette field |
  |---|---|
  | `wall` | `wall` |
  | `stone` | `stone` |
  | `trim` | `trim` |
  | `roof` | `roof` |
  | `dome` | `dome` |
  | `accent` | `accent` |
  | `band` | `trim`, used for the striped stone courses |

  `gold` (`#e8c040`) and `dark` (window and door openings) are fixed colours.
- **Size tiers stay as they are**, using the current recipes' `scale`/`sq`:

  | Building | `scale` | `sq` |
  |---|---|---|
  | house | 0.72 | 0.80 |
  | tc | 1.06 | 1.02 |
  | monastery | 1.02 | 1.02 |

## Parts kit (Blender)

- **Source:** `tools/art/blender/islamic_kit.py`, run headless by `npm run art:kit`.
  - It runs `blender -b --factory-startup --python tools/art/blender/islamic_kit.py`.
  - Blender is found through the `BLENDER` environment variable, falling back to `D:\Blender\blender.exe`.
- **Geometry:** built entirely from bpy/bmesh primitives. No imported meshes and no AI generation.
- **Output:** one `.glb` per piece in `assets/original/islamic/`, committed so that `npm run art:bake` never needs Blender.
- **Provenance:** `assets/original/islamic/README.md` records that the pieces are original work under CC0, made with Blender 5.2.2 by the script above.

**Conventions**, the same as the Kenney kits, so `walls()` and the other recipe helpers work unchanged:
- Each piece is centred on a 1×1 cell at the origin.
- Wall panels sit on the cell's +x edge, facing +x.
- glTF is Y-up.
- Material names are exactly the slot names listed above.
- Every material is exported with metallic 0 and roughness 1.0. That matches the Kenney town and castle kits, which set metallic 0 and leave roughness at the glTF default of 1.0, so the new pieces don't catch sun highlights the Kenney pieces lack.

**Pieces (about 14):**

| Group | Pieces |
|---|---|
| Walls | `wall`, `wall-window` (pointed arch), `wall-door` (pointed arch), `wall-arcade` (horseshoe-arch bay, open) |
| Roofs | `roof-flat`, `merlon-stepped` (Saracens), `merlon-pointed` (Turks) |
| Crowns | `dome-lead` (shallow, on an octagonal drum), `dome-ribbed` (pointed Mamluk), `kumbet` (octagonal tower with a cone roof) |
| Towers | `minaret-pencil` (with balcony and cone cap), `minaret-square` (tiered) |
| Details | `portal` (grand pointed iwan arch block), `bay-cumba` (overhanging upper-floor bay), `alem` (crescent finial) |

Props reused from the Kenney kits:
- `nature`: `tree_palm`, `tree_palmBend`, `tent_detailedOpen`
- `town`: `fountain-round`, `banner-*`

**Authoring.** Each piece is designed in the live Blender session over the Blender MCP and checked with `look` from the bake angle (45° azimuth, 30° elevation). The script is the only thing kept; the scenes are disposable.

## Baker changes

- **[kenney-bake.html](../../../tools/art/kenney-bake.html):**
  - Add `islamic: '/assets/original/islamic/'` to `KITS`.
  - In `k.add`, for meshes from the `islamic` kit, replace each material's colour using the slot→palette map for the recipe's civ and the current style.
  - Kenney pieces placed in the same recipe keep their own colours.
  - The same branch forces roughness 1 and metalness 0. It also multiplies colours by a single `SHADE` factor (default 1.0) in `islamic-recipes.js`. The civ_art palettes were tuned for 2D drawn art, so light walls such as `#f2deb8` may wash out under the bake lights; `SHADE` is tuned once at review point 1. The palette table itself keeps the source values.
- **New merge mode in `bake-kenney.mjs`: `--only <recipe,…>`.**
  - It bakes only the named recipes and writes only their PNGs.
  - It merges their entries into the existing `manifest.js` instead of replacing the file.
  - Today every bake rewrites all 109 PNGs and the whole manifest. All work in this spec uses `--only`, so existing sprites stay byte-identical. `git diff --stat` after each bake must list only new or changed `*_turks_*` and `*_saracens_*` files plus `manifest.js`.
  - A plain full bake (no `--only`) keeps its current behaviour.
- **New `tools/art/islamic-recipes.js`:**
  - `PALETTES = { turks: [4 ages], saracens: [4 ages] }`, copied from civ_art.js.
  - Six recipes: `house_turks`, `tc_turks`, `monastery_turks`, `house_saracens`, `tc_saracens`, `monastery_saracens`.
  - Each recipe carries `civ`; `styles` is `[0, 1, 2, 3]` (house, tc) or `[2, 3]` (monastery).
- **`kenney-recipes.js`:** merges these into `RECIPES`.
- **Outputs:** the existing `bakeAll` naming (`name + '_' + style`) produces the 20 keys, and `manifest.js` is regenerated as it is today.

## Game changes

All in [civ_art.js](../../../game/js/civ_art.js), in the wrapped `bldSprite` (section D):

1. **Civ sprite lookup.** Before the generic `kartKey(type, st)`, try `type + '_' + civ + '_' + s` for `s = st` down to 0, taking the first one that has loaded.
   - Use it only if its age is at least the age of the sprite `kartKey(type, st)` would pick. A bare key without an age counts as −1, and on a tie the civ sprite wins.
   - This keeps the dedicated `tc_4`/`tc_5` Modern and Future Town Centers ahead of `tc_turks_3`.
2. **Overlay.** When a civ sprite is used, call `drawCivBuildingOverlay` with an option that skips its section 1 (roof and crown ornaments: the painted dome and minaret).
   - Sections 2–4 still draw: courtyard props, the civ shield, and the age 4–5 modern and future add-ons.
   - The player-colour flag and banners still draw.
3. **Fallback.** If a civ sprite is missing or fails to load, nothing changes from today: generic Kenney sprite plus overlay, then classic drawn art.

The sprite cache key already includes `civ`, so it needs no change.

## Process and review points

1. Install the `create-game-assets` skill (Apache-2.0, gamedev-skills/awesome-gamedev-agent-skills). Use its art-direction and contact-sheet QA guidance throughout.
2. **Review point 1: hero sprite.**
   - Build only the pieces `tc_turks_2` needs. At this stage the `tc_turks` recipe declares `styles: [2]`, so the bake doesn't ask for pieces that don't exist yet.
   - Run `npm run art:bake -- --preview tc_turks,tc,house,barracks`.
   - Show it beside `tc_2`, `house_2` and `barracks_2`.
   - **The user approves the look before more pieces are made.**
3. **Review point 2: full set.**
   - Build the remaining pieces and all 20 sprites.
   - Make a contact sheet of the 20 next to their Kenney neighbours at 1× scale.
   - **The user approves.**
4. **In-game check.** Run a match with Turks and Saracens players and capture a Playwright screenshot at native scale. Check:
   - footprint fit
   - shadows
   - flag and shield placement
   - no doubled painted domes
5. Update ASSET_PLAN.md §2 with a line about the Blender kit step.

## Tests

- **New `tests/islamic-art.test.js`** (Node, part of `npm test`), checking that:
  - every `k.add('islamic', name, …)` in `islamic-recipes.js` has `assets/original/islamic/<name>.glb`
  - all 20 keys are in `game/art/kenney/manifest.js`, and each PNG exists
  - `PALETTES` in `islamic-recipes.js` equals `CIV_ARCH.turks/saracens.ages[0..3]` in civ_art.js for every mapped field
- **Added to `tests/browser/art.spec.js`:**
  - a Turks house at age 2 renders from `house_turks_2`
  - a Franks house at age 2 still renders from `house_2`
  - with `house_turks_*.png` blocked, a Turks house falls back to `house_2`
- **Existing suites:** `npm test` and `npm run test:browser` stay green. `tests/browser/art.spec.js` already waits for every manifest key, so it covers the 20 new PNGs loading.

## Risks

- **Style mismatch.** Original pieces may read as "different game" next to Kenney neighbours. Mitigation: review point 1 compares against Kenney sprites before more work is done.
- **Recolour scope.** Recolouring by material name must not touch Kenney props placed in the same recipe. Mitigation: apply it only to meshes loaded from the `islamic` kit.
- **Palette drift.** The palette is duplicated between civ_art.js and the recipes. Mitigation: the equality test above.
- **Whole-manifest rewrite.** A full bake rewrites `manifest.js` and every PNG. Mitigations:
  - The new keys come from recipes, never from hand-added PNGs, so a later full bake reproduces them.
  - This work uses only `--only` merge bakes, so the existing 109 sprites aren't churned.
