#!/usr/bin/env python3
"""Build the Age of Realms data mod for Age of Empires II: Definitive Edition.

Reads the game's original empires2_x2_p1.dat (never modified) and writes a patched copy
into a local-mod folder. Rerun after every game patch.

    pip install genieutils-py
    python build_realms_dat.py <original .dat> <mod folder>

What it adds (ported from game/js/wells.js and game/js/mod.js):
  * Well   - 1x1 Dark Age economic building, 40 wood + 10 stone, 400 HP, +5 population.
             AoE2 has no thirst, so the water-capacity idea maps onto population space.
  * Ageing - every trainable land unit loses HP slowly (negative regeneration), so it dies of
             old age after roughly the Age of Realms lifespan: villager 25 min, infantry and
             archers 20 min, cavalry 23 min, monks 30 min, trade carts 25 min (at base HP;
             Loom and HP upgrades lengthen life, healing resets it).
"""
import json
import sys
from copy import deepcopy
from pathlib import Path

from genieutils.datfile import DatFile

# ---- tunables (mirror game/js) ----
WELL = dict(wood=40, stone=10, hp=400, pop=5, build_time=20, los=3, pierce=4)
LIFESPAN_S = {           # class id -> seconds of life at base HP (MOD.life in game/js/mod.js)
    4: 1500,             # villager
    18: 1800,            # monk
    6: 1200,             # infantry
    0: 1200, 44: 1200,   # archers, hand cannoneers / janissaries
    12: 1400, 23: 1400, 36: 1400, 47: 1400,  # cavalry, conquistadors, cavalry archers, scouts
    19: 1500,            # trade carts
}

HOUSE, VILLAGER_BUILDER, WELL_GRAPHIC = 70, 118, 4511
WELL_BUTTON = 14         # free slot on the villager's economic build page
STR = dict(name=920001, creation=920002, help=920003, hotkey=920004)  # modded string ids
FOOD, WOOD, STONE, POP_HEADROOM = 0, 1, 2, 4
VILLAGER_CLASS, VILLAGER_HP = 4, 25

STRINGS = {
    'en': {
        STR['name']: 'Well',
        STR['creation']: 'Build <b>Well<b> (<cost>)',
        STR['help']: 'Build <b>Well<b> (<cost>)\\nClean water lets more people live in your settlement. Provides 5 population. Small (1x1) and sturdier than a House. <i> Age of Realms mod.</i>\\n<hp> <attack> <armor> <piercearmor> <range>',
        STR['hotkey']: 'Well',
    },
    'tr': {
        STR['name']: 'Kuyu',
        STR['creation']: '<b>Kuyu<b> inşa et (<cost>)',
        STR['help']: '<b>Kuyu<b> inşa et (<cost>)\\nTemiz su, yerleşiminde daha fazla insanın yaşamasını sağlar. 5 nüfus sağlar. Küçük (1x1) ve evden dayanıklı. <i> Age of Realms modu.</i>\\n<hp> <attack> <armor> <piercearmor> <range>',
        STR['hotkey']: 'Kuyu',
    },
}


def make_well(house):
    w = deepcopy(house)
    w.name = 'REALMS_WELL'
    w.language_dll_name, w.language_dll_creation = STR['name'], STR['creation']
    w.language_dll_help, w.language_dll_hotkey_text = STR['help'], STR['hotkey']
    w.hot_key = -1
    w.hit_points = WELL['hp']
    w.line_of_sight = WELL['los']
    w.standing_graphic = (WELL_GRAPHIC, -1)
    w.damage_graphics = []
    w.collision_size_x = w.collision_size_y = 0.5
    w.outline_size_x = w.outline_size_y = 0.5
    w.clearance_size = (0.5, 0.5)
    w.resource_storages = (
        type(house.resource_storages[0])(type=POP_HEADROOM, amount=float(WELL['pop']), flag=4),
        house.resource_storages[1], house.resource_storages[2])
    cr = w.creatable
    RC = type(cr.resource_costs[0])
    cr.resource_costs = (RC(type=WOOD, amount=WELL['wood'], flag=1),
                         RC(type=STONE, amount=WELL['stone'], flag=1),
                         RC(type=-1, amount=0, flag=0))
    TL = type(cr.train_locations[0])
    cr.train_locations = [TL(train_time=WELL['build_time'], unit_id=VILLAGER_BUILDER,
                             button_id=WELL_BUTTON, hot_key_id=-1)]
    cr.displayed_pierce_armour = WELL['pierce']
    return w


def add_well(dat):
    new_id = len(dat.civs[0].units)
    for civ in dat.civs:
        assert len(civ.units) == new_id, 'civs disagree on unit count'
        house = civ.units[HOUSE]
        w = make_well(house)
        w.id = w.copy_id = w.base_id = new_id
        w.enabled = house.enabled
        civ.units.append(w)
        civ.unit_pointers.append(1)
    return new_id


def mortal_units(dat):
    """Trainable land units plus everything they upgrade into, limited to LIFESPAN_S classes."""
    units = dat.civs[1].units
    ids = {i for i, u in enumerate(units)
           if u and u.type == 70 and u.creatable
           and any(t.unit_id != -1 for t in u.creatable.train_locations)}
    upgrades = {}
    for e in dat.effects:
        for c in e.effect_commands:
            if c.type == 3:
                upgrades.setdefault(c.a, set()).add(c.b)
    frontier = list(ids)
    while frontier:
        for b in upgrades.get(frontier.pop(), ()):
            if b not in ids and 0 <= b < len(units) and units[b]:
                ids.add(b)
                frontier.append(b)
    return sorted(i for i in ids if units[i].type == 70 and units[i].class_ in LIFESPAN_S
                  and units[i].class_ != VILLAGER_CLASS and units[i].hit_points > 1
                  and units[i].creatable.hero_mode == 0)


def add_ageing(dat):
    units = dat.civs[1].units
    EC = type(dat.effects[0].effect_commands[0]) if dat.effects[0].effect_commands else None
    if EC is None:
        EC = next(type(c) for e in dat.effects for c in e.effect_commands)
    # villagers by class: covers both genders and every task variant (all 25 HP)
    cmds = [EC(type=4, a=-1, b=VILLAGER_CLASS, c=109,
               d=round(-VILLAGER_HP * 60.0 / LIFESPAN_S[VILLAGER_CLASS], 3))]
    for i in mortal_units(dat):
        u = units[i]
        per_min = -u.hit_points * 60.0 / LIFESPAN_S[u.class_]
        cmds.append(EC(type=4, a=i, b=-1, c=109, d=round(per_min, 3)))
    # applied at game start through every non-Gaia civ's tech-tree effect
    seen = set()
    for civ in dat.civs[1:]:
        eid = civ.tech_tree_id
        if eid < 0 or eid in seen:
            continue
        seen.add(eid)
        dat.effects[eid].effect_commands.extend(deepcopy(cmds))
    return len(cmds), len(seen)


def write_strings(mod):
    for lang, table in STRINGS.items():
        p = mod / 'resources' / lang / 'strings' / 'key-value' / 'key-value-modded-strings-utf8.txt'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(''.join(f'{k} "{v}"\n' for k, v in table.items()), encoding='utf-8')


def main(src, mod):
    mod = Path(mod)
    dat = DatFile.parse(src)
    well_id = add_well(dat)
    n_units, n_trees = add_ageing(dat)
    out = mod / 'resources' / '_common' / 'dat' / 'empires2_x2_p1.dat'
    out.parent.mkdir(parents=True, exist_ok=True)
    dat.save(str(out))
    write_strings(mod)
    (mod / 'info.json').write_text(json.dumps({
        'Author': 'Age of Realms',
        'CacheStatus': 0,
        'Description': 'Age of Realms features for AoE2 DE: Wells (+5 population) and ageing units that die of old age.',
        'Title': 'Age of Realms',
    }, indent=2), encoding='utf-8')
    print(f'Well = unit {well_id}; ageing on {n_units} units via {n_trees} tech-tree effects; wrote {out}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
