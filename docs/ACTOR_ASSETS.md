# Unit assets and extended eras

The browser game now has six playable ages: **Dark → Feudal → Castle → Imperial → Modern → Future**.
The actor library contains **53 animated atlases**, each with a color sheet and a separate player-color
mask. Four directions and four frame samples cover the idle, walk, attack and work banks. Unsupported
animal actions reuse their idle pose. The sprites are rendered at twice their in-game resolution.

Open [the interactive actor library](../tools/art/actor-gallery.html) through the local game server,
or inspect [the full preview](../assets/screenshots/unit-library.jpg). The library lets you change the
action, direction and player color without starting a match.

In-game staged views: [Ottoman army](../assets/screenshots/game-ottoman.jpg) ·
[Modern and future units](../assets/screenshots/game-future.jpg).

## Artwork and sources

| Assets | Source and license | What this project adds |
| --- | --- | --- |
| Male and female base rigs and animations | [Kenney Mini Characters](https://kenney.nl/assets/mini-characters), **CC0**; original `License.txt` and the two used GLBs/textures are retained in `assets/thirdparty/kenney/mini-characters/`. | Original rig-attached clothing, helmets, armor, weapons and player-color surfaces. |
| Sheep, cow, horse, pig | [Quaternius Farm Animal Pack](https://opengameart.org/content/lowpoly-animated-farm-animal-pack), **CC0**, downloaded from the author's OpenGameArt upload. Source FBX files and the original license are in `assets/thirdparty/quaternius/animals/`. | Authored walking motion where the older pack provides idle/jump only; dark boar coloring, tusks and bristles. |
| Wolf | [Quaternius Animal Pack Vol. 2](https://opengameart.org/content/animated-animales-low-poly), **CC0**. Source `Wolf.fbx` is retained. | A gray coat and normalized sprite scale. |
| Trees | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit), **CC0**; existing source models and license retained. | Three additional Anatolian-inspired variations: narrow cypress-like, olive-toned broadleaf and tall pine silhouettes. These are stylized models, not botanical identifications. |
| Seljuk and Ottoman equipment | No coherent compatible openly licensed set was found in the sources checked; **original model recipes created for this project**. | Seljuk pointed felt/metal caps, fur bands, lamellar panels and round shields; Ottoman turbans, kaftan panels, Janissary börk caps, curved swords, composite bows and matchlocks. |
| Modern/future equipment, tank, walker, deer | **Original model recipes created for this project**. | Hard hats, field helmets, scoped rifles, powered helmets, luminous weapon coils, tracked armor, a walking siege machine and an antlered deer rig. |

The original equipment and model recipes are provided under **CC0** in
[`tools/art/ACTOR_LICENSE.txt`](../tools/art/ACTOR_LICENSE.txt). The pack-specific third-party notices
remain with their source files. The four GLB files beside the animal FBXs are generated reference
derivatives; `Deer.glb` comes from the original project deer recipe rather than Quaternius.

These are game-scale historical interpretations. The compatibility skins let any existing unit be
shown in any theme; a Seljuk-styled gunner is a compatibility option, not a claim that Seljuks used
Ottoman matchlocks. The default Turkish progression selects Seljuk dress before Castle Age and
Ottoman dress afterwards.

## Selecting artwork

Use **Unit artwork** in the main menu. The choice is remembered in the browser.

- **Follow civilization & age**: early Turks use Seljuk dress, Castle/Imperial Turks use Ottoman dress,
  and other medieval armies use the medieval set. Workers change clothing in Modern/Future Age.
  Existing medieval soldiers keep their historical equipment; newly trained advanced units use their actual era.
- **Seljuk / Ottoman / Medieval / Modern / Futuristic**: choose a visual theme for existing units.
- **Classic drawn units**: restore the original animated drawings.

URL overrides: `?units=auto`, `?units=seljuk`, `?units=ottoman`, `?units=medieval`, `?units=modern`,
`?units=future`, `?units=classic`. The overrides persist just like the menu choice. These art controls
do not grant ages, technologies or unit statistics. New advanced military units retain their era-specific
equipment in themed views. Naval units and medieval siege engines keep their existing art.

Assets load locally when needed. Missing images keep the original drawing active; loaded assets
invalidate unit poses, portraits and the 2.5D sprite cache. Player-color masks keep both armies readable.
Villager tools and carried baskets remain visible. Both Canvas 2D and the optional 2.5D view use the
new actor sprites. Building architecture retains the existing art sets.

## Playable progression

**Modern Age** is researched at the Town Center after Imperial Age for 2,000 food, 1,000 wood and
1,200 gold and 300 coal. It requires two of University, Siege Workshop and Castle.

**Future Age** is researched at the Town Center after Modern Age for 3,000 food, 1,500 wood and
2,200 gold. Research **Industrialization** and **Electronics** at the University first; also retain
two of University, Siege Workshop and Market. Starting directly in either new age is supported in Game Setup.

| Age | Unit | Train at | Role |
| --- | --- | --- | --- |
| Modern | Rifleman | Barracks, R | General ranged infantry |
| Modern | Marksman | Archery Range, R | Long-range precision rifle |
| Modern | Battle Tank | Siege Workshop, T | Armored explosive siege |
| Future | Plasma Guard | Barracks, T | Powered ranged infantry |
| Future | Railgunner | Archery Range, T | Long-range anti-vehicle specialist |
| Future | Fusion Walker | Siege Workshop, G | Heavy ground siege machine |

Seven supporting technologies add industrial gathering, electronics, precision rifling, composite
armor, fusion power, energy focusing and nanorepair. Armored vehicles are machines and do not age.
Nanorepair heals only the researching player's vehicles, up to their maximum HP. Shells, lasers and
plasma bolts use the existing projectile and damage simulation, including its friendly-fire protection.
Computer players can research the new ages and choose advanced units when they reach them. Saves
retain the new ages, research, production queues and units; old saves remain supported.

The stats and costs are an initial playable balance pass. Long tournament balancing of the two new
ages has not been performed. Air units, modern navies and replacement building sets are outside this pass.

## Rebuilding

Install the pinned development dependencies and local Playwright Chromium, then run:

```sh
npm run art:actors
npm run art:bake
```

`CHROMIUM_PATH` can point at an existing Chromium executable. Edit `tools/art/actor-models.js` for
equipment, body attachments, original geometry and animations. `tools/art/actors-bake.html` contains
the camera, lighting, atlas layout and color-mask renderer. To rebuild selected assets:

```sh
node tools/art/bake-actors.mjs --only ottoman-gunner,seljuk-cavalry,animals-boar
```

The source downloads are preserved on disk. The Mini Characters folder's `.gitignore` excludes
unused formats and previews from distribution; it includes the two used rigs, texture and license.

## Checks

`tests/actors.test.js` verifies style selection, atlas dimensions, GLB signatures and licenses.
`tests/eras.test.js` verifies age requirements, production, combat research, projectile damage,
nanorepair, AI choices and future-era save/load. The HUD suite checks fixed hotkey positions in all
six ages. Browser tests exercise the full library, player colors, tasks, missing assets, progression
commands, saves and 2.5D vehicles.

Validation on 15 October 2026: **277 simulation checks** (271 functional checks plus all six performance
checks), **22 browser tests** and **66 script syntax checks** passed. The five actor browser tests were
also rerun after the final bake to refresh and inspect the gallery and in-game screenshots. Art model
and bake scripts passed their own syntax checks.

The first performance run, concurrent with browser testing and model baking, exceeded the battle mean
budget. With those jobs finished, the isolated rerun passed: battle mean **7.36 ms**, or **1.99 CPU units**
against the **2.4** budget. Run performance checks separately from browser rendering and baking when
comparing timings. No performance budget was relaxed.

Coal costs and age-specific Wonders are described in [Maps and Mines](MAPS_AND_MINES.md).
