# Age of Realms

A browser medieval real-time strategy game in plain HTML, CSS and JavaScript. You grow a settlement, advance through four ages, build an economy and an army, and defeat computer rivals. It has no build step, no dependencies and no network calls.

It starts from the Special Build of Barty-Bart's [Opus 5.5 effort-comparison experiment](https://github.com/Barty-Bart/opus-55-effort-comparison) and adds systems for mortality, water, terraforming and engineering. The six original builds are archived unchanged in [`legacy/`](legacy/).

![A Castle Age town in Age of Realms](assets/screenshots/town.jpg)

<p><img src="assets/screenshots/overview.jpg" width="49%" alt="AI vs AI overview"> <img src="assets/screenshots/battle.jpg" width="49%" alt="Janissaries and knights in battle"></p>

## Play

```sh
git clone https://github.com/sbalci/age-of-realms-mod
cd age-of-realms-mod
python3 -m http.server 8000 --bind 127.0.0.1     # Windows: py -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 and press **Play**, or go straight to http://127.0.0.1:8000/game/.

A local server is required. Opening `index.html` directly may not load the scripts. Use a desktop keyboard and mouse. Audio starts after the first click.

## What's in the game

**Base game (Special Build)**
- 10 civilizations with unique units, including the **Turks** (Janissary hand cannoneers; their monks are Imams).
- Four ages and a full economy.
- Navy and transports, monks and relics, trade and the market.
- Diplomacy and tribute.
- Elevation and cliffs.
- Garrisoning and the town bell.
- Wildlife and weather.
- Procedural music and unit speech.
- Four AI difficulty levels.
- A map editor, save and load of maps, and cheats (Enter; e.g. `marco`, `polo`, and `ibn battuta` to reveal the map and lift the fog at once).

**Mortality and veterans** (`game/js/mod.js`)
- People age:
  - soldiers live about 20 minutes, villagers about 25 and monks about 30, each with ±15% variation;
  - machines, ships and animals don't age;
  - deaths from old age don't count as battle losses.
- One villager in five takes monastic vows at about 15 minutes and becomes a monk.
- Soldiers who survive a battle earn experience and are promoted to Veteran, Elite and Champion. Each rank adds attack, hit points and armor, shown as chevrons above the unit.

**Waters** (`game/js/water.js`)
- Rivers with fords, plus lakes and seas, are classified per tile.
- Rivers and lakes are fresh water; the sea is salt.
- Fish regrow, but a shoal fished below 20% never recovers.

**Clean water and wells** (`game/js/wells.js`)
- Water capacity comes from Town Center cisterns and Wells (hotkey C). Both serve more people near fresh water.
- Above capacity, gathering slows and people wear down, but thirst never kills.
- The 💧 in the top bar shows capacity. The AI digs wells ahead of its needs.

**Terraforming and engineering** (`game/js/terra.js`): select villagers and press **N**.
- **Canals:** ships can sail them.
- **Trenches:** units inside move slower and take less pierce damage; cavalry, siege and carts cannot cross.
- **Raise, lower and dig mountains:** raising costs stone, lowering and digging refund it.
- **Plant trees:** saplings mature into trees.
- **Bridges** (15 wood per tile): land units cross and ships sail under. Removing a bridge refunds 8 wood.
- **Sappers** (Mining Camp, Feudal Age):
  - dig tunnels through hills and mountains, 5 stone per tile, up to 12 tiles;
  - units in a tunnel are hidden from enemies;
  - sappers dig 60% faster than villagers.

**Commands and battle** (`game/js/command.js`)
- **Orders and formations:**
  - Shift-queued orders with waypoints.
  - Formations that face the march: melee in front, ranged behind, siege and monks at the rear.
  - Combat stances: Aggressive, Defensive, Stand Ground, No Attack.
- **Combat:**
  - Ranged accuracy, so arrows can miss.
  - Soldiers blocked by walls breach the nearest wall or gate.
  - Units trapped by terrain changes are rescued.
  - Villagers and monks flee from melee attackers.
  - Scouts no longer kill sheep.
  - No friendly fire: catapult splash spares your own and allied units, and soldiers earn experience only from fighting enemies.
- **Movement** (`game/js/movement.js`): units slide around corners, respect cliff edges in crowds, sidestep oncoming units and recover when wedged. In AI test games this cut units stuck for 5 s or more from about 50 to about 3 per 8 minutes (`?move=off` restores the old movement).
- **Keys and controls:**
  - `,` cycles idle soldiers.
  - Home jumps to the last attack.
  - `+`/`−` change game speed.
  - `M` toggles music.
  - A Resign button; beaten computer players resign too.

**Victory, technology and score** (`game/js/victory.js`)
- **Wonder** (Imperial Age) and **relic victory**: hold out for 5 minutes. Announcements and a countdown banner keep everyone informed.
- **Imperial upgrades:**
  - Units: Halberdier, Paladin, Heavy Cavalry Archer, Capped Ram, Onager.
  - Technologies: Crop Rotation, Two-Man Saw, Gold and Stone Shaft Mining, and the full Blacksmith line.
- **Fog-of-war memory:** buildings you saw earlier stay on the map as you last saw them.
- **Scores:** a live score panel (F4) and a tabbed end screen with statistics and a score-over-time chart.

**Watch AI vs AI** (`game/js/extras.js`)
- Tick *Watch AI vs AI* in Game Setup.
- Every player is computer-controlled and the map is revealed.
- Keys 1–8 follow a player, `+`/`−` change speed up to 8×, and F4 shows scores.

**Look** (`game/js/terrain.js`, `game/js/fx.js`)
- **Terrain and buildings:**
  - HD blended terrain: soft transitions, sunlit hills, rocky cliffs, depth-shaded water with surf and wet sand.
  - Building materials change with the age: logs and thatch, then timber frame and clay tile, then stone and slate.
- **Walls, shadows and sky:**
  - Walls and palisades connect into continuous lines.
  - Buildings cast projected shadows.
  - Fog of war fades in and out smoothly.
  - Cloud shadows drift across the map, and the screen edges have a vignette.
- **Effects and battlefield marks:**
  - Soft smoke and glowing fire, with more fire as a building takes damage.
  - Missed arrows stay stuck in the ground, catapult stones leave craters, and corpses stay on the field for a while.
  - Birds circle overhead.
  - A dashed line leads to a waving rally flag.
  - Positional sounds are panned left and right.
- **Sharper units** (`game/js/units_hd.js`):
  - Cached 2× sprites with outlines, shading and a rim light.
  - Smooth motion between simulation ticks.
  - Back views when units walk away.
  - Team-coloured silhouettes for units hidden behind buildings and trees.
  - Drawn SVG resource icons and framed unit portraits.

**Idle buttons:** on the minimap corner, one for idle villagers and one for idle soldiers, each with a count. Click selects the next one; shift-click selects all.

The in-game **Help** (F1) describes every system.

### URL switches

Add these to the game address, e.g. `game/?aging=off&thirst=off`:

| Switch | Effect |
|---|---|
| `?aging=off` | no lifespans |
| `?veterans=off` | no ranks |
| `?life=0.5` | multiply all lifespans |
| `?rivers=off` | no generated rivers |
| `?fishregen=off` | fish do not regrow |
| `?thirst=off` | no water capacity |
| `?terra=off` | no terraforming |
| `?hd=off` | classic flat terrain and buildings |
| `?unitshd=off` | classic live-drawn units and emoji icons (finer: `unitsprites`, `unitsmooth`, `facings`, `unitsil`, `hdicons`) |
| `?fx=off` | no visual effects (or one at a time: `walls`, `shadows`, `fogfade`, `clouds`, `vignette`, `particles`, `decals`, `birds`, `rally`, `flash`, `glints`, `pan`) |
| `?queue=off` `?formation=off` `?accuracy=off` `?rescue=off` `?breach=off` `?stances=off` `?flee=off` `?hotkeys=off` `?resign=off` | command features |
| `?wonder=off` `?relicwin=off` `?imperial=off` `?fogmem=off` `?score=off` `?aiwonder=off` | victory/tech features; `?wondertime=N`, `?relictime=N` set the countdowns |

## Repository layout

```
index.html        landing page
game/             the game (all development happens here)
  index.html      loads the scripts in order
  style.css
  js/data.js      units, buildings, techs, civs, help text
  js/map.js       map, elevation, regions, pathfinding, map generation
  js/world.js     simulation: units, combat, economy, orders
  js/render.js    isometric canvas renderer (chunk-cached terrain, vector art)
  js/audio.js     procedural sound, music and speech
  js/ai.js        computer players
  js/ui.js        HUD, input, menus
  js/editor.js    map editor
  js/mod.js       mortality, monks, veterans
  js/water.js     water types, rivers, fish
  js/wells.js     wells and clean water
  js/terra.js     terraforming, bridges, sappers, tunnels
  js/command.js   queued orders, formations, stances, accuracy, breaching, hotkeys, resign
  js/victory.js   wonders, relic victory, Imperial upgrades, fog memory, score and statistics
  js/terrain.js   HD terrain texture and building materials
  js/fx.js        walls, shadows, fog fade, clouds, particles, decals, birds, rally flag
  js/extras.js    Turks, peaceful scouts, AI-vs-AI spectating, Ibn Battuta cheat, idle buttons
  js/units_hd.js  cached HD unit sprites, smooth motion, back views, silhouettes, drawn icons
  js/movement.js  corner sliding, cliff-safe separation, sidestepping, unstick
  js/main.js      boot and game loop
tests/            headless tests (Node, no dependencies)
legacy/           the six original experiment builds, prompts and metrics (archived, not maintained)
```

## Development

- All scripts are classic scripts that share globals. They load in the order given in `game/index.html`.
- The mod files come after the engine and extend it by wrapping its global functions, for example `const _f = f; f = function (...) { ... _f(...) ... }`. New systems should follow the same pattern, in a new file loaded before `main.js`.
- Run the tests with `node tests/run-all.js` (add `--full` to load every module into every suite), or run one suite, e.g. `node tests/terraform.test.js`. Each suite loads the engine in a Node `vm` context and simulates games headlessly.
- There is a single branch: `main`.

## Credits

The base game is the Special Build from [Barty-Bart/opus-55-effort-comparison](https://github.com/Barty-Bart/opus-55-effort-comparison), generated by Claude Opus 5.5. This is an independent project and is not affiliated with the makers of Age of Empires II.
