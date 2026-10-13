# Age of Realms

A browser medieval real-time strategy game in plain HTML, CSS and JavaScript. You grow a settlement, advance through four ages, build an economy and an army, and defeat computer rivals. It has no build step, no dependencies and no network calls.

It starts from the Special Build of Barty-Bart's [Opus 5.5 effort-comparison experiment](https://github.com/Barty-Bart/opus-55-effort-comparison) and adds systems for mortality, water, terraforming and engineering. The six original builds are archived unchanged in [`legacy/`](legacy/).

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
- 9 civilizations with unique units.
- Four ages and a full economy.
- Navy and transports, monks and relics, trade and the market.
- Diplomacy and tribute.
- Elevation and cliffs.
- Garrisoning and the town bell.
- Wildlife and weather.
- Procedural music and unit speech.
- Four AI difficulty levels.
- A map editor, save and load of maps, and cheats (Enter).

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

The in-game **Help** describes every system.

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
  js/main.js      boot and game loop
tests/            headless tests (Node, no dependencies)
legacy/           the six original experiment builds, prompts and metrics (archived, not maintained)
```

## Development

- All scripts are classic scripts that share globals. They load in the order given in `game/index.html`.
- The mod files come after the engine and extend it by wrapping its global functions, for example `const _f = f; f = function (...) { ... _f(...) ... }`. New systems should follow the same pattern, in a new file loaded before `main.js`.
- Run the tests with `node tests/run-all.js`, or run one suite, e.g. `node tests/terraform.test.js`. Each suite loads the engine in a Node `vm` context and simulates games headlessly.
- There is a single branch: `main`.

## Credits

The base game is the Special Build from [Barty-Bart/opus-55-effort-comparison](https://github.com/Barty-Bart/opus-55-effort-comparison), generated by Claude Opus 5.5. This is an independent project and is not affiliated with the makers of Age of Empires II.
