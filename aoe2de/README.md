# Age of Realms for Age of Empires II: Definitive Edition

The same ideas as the web game, as an AoE2 DE local mod and a random map. For fun, not commercial.

## What is in it

**Data mod** (`tools/aoe2de/build_realms_dat.py` builds it from your own game files):

- **Well**: a 1×1 Dark Age economic building (40 wood, 10 stone, 400 HP, +5 population).
- **Ageing**: units slowly lose HP and die of old age (villagers about 25 min, soldiers 20 to 23, monks 30) unless healed.
- **Turks do not eat pork**: Turkish villagers cannot hunt Wild Boar or Javelina, and Turks start with 6 cows (900 food) instead. The Turks' civilization description says so in English and Turkish.

**Random map** `random-map-scripts/AoR_Rivers_and_Lakes.rms`:

- **Rivers** between the players, with shallow fords on every route. Fish: salmon.
- **Lakes** inland near every player. Fish: perch.
- **Sea** along one edge on about a third of the maps. Fish: tuna, dorado and marlin.

## Install

1. Build the mod (Python 3.10+): `pip install genieutils-py`, then
   `python tools/aoe2de/build_realms_dat.py "<AoE2DE>/resources/_common/dat/empires2_x2_p1.dat" "<profile>/mods/local/AgeOfRealms"`,
   where `<profile>` is `%USERPROFILE%\Games\Age of Empires 2 DE\<your id>`. Rerun after every game patch.
2. Copy `AoR_Rivers_and_Lakes.rms` to `<profile>\resources\_common\random-map-scripts\`.
3. In the game: **Mods → Installed Mods**, enable **Age of Realms**. In a skirmish, pick **Custom map → AoR_Rivers_and_Lakes**.

The game's own `empires2_x2_p1.dat` is never changed. Online, everyone in the lobby needs the mod.

## Not possible in AoE2

Thirst and water capacity, villagers ageing into monks, veterans, terraforming, player-built bridges and tunnels need game logic the `.dat` and map scripts cannot express.
