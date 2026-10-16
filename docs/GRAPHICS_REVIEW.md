# Graphics review — 15 October 2026

Follow-up: animated units, Seljuk/Ottoman equipment, wildlife, three more tree variants and playable
Modern/Future ages are documented in [Unit assets and extended eras](ACTOR_ASSETS.md). The findings
and 83-sprite validation below describe the initial scenery pass; the scenery set now contains 86 sprites.

The maintained browser game is in `game/`; `legacy/` contains archived builds, and `aoe2de/`
is a separate data mod and random map script for Age of Empires II. This graphics pass targets
the browser game. The AoE2 mod uses the installed game's own graphics.

[Classic town](../assets/screenshots/art-classic.jpg) · [Kenney town](../assets/screenshots/art-kenney.jpg).
These are staged views of the same tutorial seed, paused in the Castle Age. Recreate them with
`node tools/art/capture-town.mjs` (the same Chromium requirements as the baker).

## Findings and changes

| Finding | Change |
| --- | --- |
| Three CC0 medieval kits and 74 baked sprites were already bundled, but new players saw procedural art. | Kenney art is now the default; the remembered Classic choice and explicit URL overrides still work. Invalid URL values do not overwrite a saved preference. |
| Farms, bushes and harvested trees did not match the imported scenery. | Nine additional sprites: three wheat harvest stages, two berry bushes, two shrubs and two stump/log variations. Foliage and crop colors match the existing landscape. Fruit disappears as berries are gathered. |
| The mill wrapper temporarily changed the simulation's building type and omitted the caller's alpha argument. | A sprite property suppresses duplicate sails. The ordinary building renderer preserves transparency, construction, damage effects and building identity. |
| Loaded images could leave procedural building icons and 2.5D resource textures cached. | Image arrivals invalidate icons and command buttons; a visual revision in resource texture keys refreshes the 2.5D cache. |
| The mine replacement bypassed the resource-effects wrapper. | A renderer hook preserves surrounding hit-flash effects for imported resources. |
| Loading images before the window load event could delay startup. | Images now start loading after boot. Missing or delayed images use the procedural fallback. |
| Asynchronous model assembly and material sorting could change overlapping pixels between bakes. | The baker assembles models in recipe order and assigns explicit mesh render order. |

## Asset provenance

All imported artwork is by **Kenney**, under **Creative Commons Zero (CC0)**:

- [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit), source license: `assets/thirdparty/kenney/fantasy-town-kit/License.txt`.
- [Castle Kit](https://kenney.nl/assets/castle-kit), source license: `assets/thirdparty/kenney/castle-kit/License.txt`.
- [Nature Kit](https://kenney.nl/assets/nature-kit), source license: `assets/thirdparty/kenney/nature-kit/License.txt`.

The source models were already present in this repository. This pass reuses them and adds generated
sprite derivatives; it introduces no new art downloads or runtime network requests. Original license
files are retained and the menu credits Kenney. Geometry, color adjustments and sprite recipes can
be inspected and rebuilt with `npm run art:bake`.

## Renderer scope

Canvas 2D remains the primary renderer. It receives the building, scenery and farm improvements.
The optional 2.5D prototype receives the resource sprites and cache fix; its buildings and farms
remain procedural meshes. Units retain their animated, team-colored HD art. Connected walls,
opening gates, water, terrain blending and construction scaffolds retain their existing renderers.

## Validation

`tests/browser/art.spec.js` covers default art, harvest stages, unchanged match state, mill
transparency, persistent preferences, invalid URL values, missing sprites, offline asset requests,
and delayed resource textures in 2.5D. Existing browser tests exercise gameplay and both renderers.
The headless suites cover simulation, saves, movement, terrain, effects and performance.

Final results: **263 headless checks**, **17 browser tests** and **61 script syntax checks** passed.
The art tools also passed syntax checks. Two consecutive bakes produced byte-identical output
for all 83 PNGs and the manifest on this machine. Both town screenshots were inspected after
the final bake. Cross-platform GPU output may still differ slightly.
