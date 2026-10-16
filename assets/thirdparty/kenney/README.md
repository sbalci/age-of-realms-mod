# Kenney 3D kits (CC0)

Source models for the default **Kenney art style** (`/game/?art=kenney`; `?art=classic` restores drawn art). The game never loads these
files directly: `tools/art/bake-kenney.mjs` renders scenery under `game/art/kenney/`, and
`tools/art/bake-actors.mjs` renders animated actors under `game/art/actors/`.

| Folder | Pack | Version | Source |
|---|---|---|---|
| `fantasy-town-kit/` | Fantasy Town Kit | 2.0 | https://kenney.nl/assets/fantasy-town-kit |
| `castle-kit/` | Castle Kit | 2.0 | https://kenney.nl/assets/castle-kit |
| `nature-kit/` | Nature Kit | 2.1 | https://kenney.nl/assets/nature-kit |
| `mini-characters/` | Mini Characters | 1.0 | https://kenney.nl/assets/mini-characters |

All are by Kenney (www.kenney.nl) and released under
[Creative Commons Zero (CC0)](https://creativecommons.org/publicdomain/zero/1.0/): public domain, free for any use,
credit appreciated but not required. Each folder keeps the pack's original `License.txt`.
Only the GLB/GLTF models and their texture are kept; previews and other formats were left out.

The 86 baked scenery sprites cover buildings in age-specific materials, seven base tree variations plus three Anatolian variants, mines,
three wheat-field harvest stages, berry bushes, shrubs and felled timber. Custom crop and foliage
colors are set in `tools/art/kenney-recipes.js`; berry fruit and player flags are added at runtime.
Rebuild with `npm run art:bake`. All art is served locally with no runtime dependency on Kenney's site.

`mini-characters/` contains the two CC0 base rigs and texture used for animated actors; unused original
download contents stay on disk and are ignored by Git. Equipment is authored in `tools/art/actor-models.js`.
See `docs/ACTOR_ASSETS.md` for the actor pipeline, Quaternius animal sources and all attribution.
