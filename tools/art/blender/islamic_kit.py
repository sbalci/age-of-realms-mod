"""Original Islamic architecture parts kit for the Age of Realms sprite baker.

Headless (tools/art/blender/run-kit.mjs calls this):
  blender -b --factory-startup --python tools/art/blender/islamic_kit.py -- <out_dir> [piece,piece,...]
Live Blender (Blender MCP): exec this file with __name__ != '__main__', then call preview([...]).
Shared helpers and conventions live in kitlib.py.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kitlib  # noqa: E402
from kitlib import Piece, opening, horseshoe, crescent, pointed_dome, round_dome  # noqa: E402

T = 0.12      # wall thickness
FACE = 0.5    # outer wall face: the cell's +x edge

# ---- shared wall parts ----
def wall_body(p, slot='wall'):
    p.box(slot, FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('stone', FACE - T - 0.01, -0.5, 0.0, FACE + 0.02, 0.5, 0.12)   # plinth
    p.box('band', FACE, -0.5, 0.30, FACE + 0.015, 0.5, 0.34)               # lower course (ablaq stripe)
    p.box('band', FACE, -0.5, 0.90, FACE + 0.015, 0.5, 0.95)               # string course


def arched_hole(p, a, z0, zs):
    p.slab_yz('trim', opening(a + 0.035, max(0.0, z0 - 0.03), zs), FACE, FACE + 0.02)
    p.slab_yz('dark', opening(a, z0, zs), FACE, FACE + 0.03)


# ---- pieces ----
def piece_wall():
    p = Piece('wall')
    wall_body(p)
    return p


def piece_wall_window():
    p = Piece('wall-window')
    wall_body(p)
    arched_hole(p, 0.13, 0.36, 0.62)
    return p


def piece_wall_door():
    p = Piece('wall-door')
    wall_body(p)
    arched_hole(p, 0.17, 0.0, 0.48)
    return p


def piece_wall_arcade():
    p = Piece('wall-arcade')
    zs, arch = 0.46, horseshoe(0.32, 0.46)
    foot = arch[0][0]
    p.slab_yz('wall', [(0.5, 1.0), (0.5, zs)] + arch + [(-0.5, zs), (-0.5, 1.0)], FACE - T, FACE)
    for y0, y1 in ((-0.5, -foot), (foot, 0.5)):
        p.box('wall', FACE - T, y0, 0.0, FACE, y1, zs)
        p.box('stone', FACE - T - 0.01, y0, 0.0, FACE + 0.02, y1, 0.12)
        p.box('trim', FACE - T - 0.01, y0, zs - 0.04, FACE + 0.02, y1, zs)
    p.box('band', FACE, -0.5, 0.90, FACE + 0.015, 0.5, 0.95)
    return p


def piece_wall_timber():
    p = Piece('wall-timber')
    p.box('wall', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    for y0, y1 in ((-0.5, -0.44), (0.44, 0.5)):
        p.box('trim', FACE, y0, 0.0, FACE + 0.015, y1, 1.0)
    p.box('trim', FACE, -0.5, 0.0, FACE + 0.015, 0.5, 0.06)
    p.box('trim', FACE, -0.5, 0.94, FACE + 0.015, 0.5, 1.0)
    p.slab_yz('trim', [(-0.44, 0.06), (-0.37, 0.06), (-0.16, 0.5), (-0.23, 0.5)], FACE, FACE + 0.015)
    p.slab_yz('trim', [(0.44, 0.06), (0.37, 0.06), (0.16, 0.5), (0.23, 0.5)], FACE, FACE + 0.015)
    p.box('trim', FACE, -0.16, 0.32, FACE + 0.02, 0.16, 0.75)
    p.box('dark', FACE, -0.13, 0.35, FACE + 0.03, 0.13, 0.72)
    return p


def piece_roof_flat():
    p = Piece('roof-flat')
    p.box('stone', -0.5, -0.5, 0.0, 0.5, 0.5, 0.06)
    return p


def piece_roof_hip():
    p = Piece('roof-hip')
    r = 0.62 * math.sqrt(2)
    p.lathe('roof', [(r, 0.0), (r, 0.04), (0.0, 0.45)], 4, rot=math.pi / 4)
    return p


def parapet(p):
    p.box('wall', FACE - 0.08, -0.5, 0.0, FACE, 0.5, 0.10)


def piece_merlon_pointed():
    p = Piece('merlon-pointed')
    parapet(p)
    for y in (-0.375, -0.125, 0.125, 0.375):
        p.lathe('wall', [(0.06 * math.sqrt(2), 0.0), (0.0, 0.13)], 4, cx=FACE - 0.04, cy=y, z0=0.10, rot=math.pi / 4)
    return p


def piece_merlon_stepped():
    p = Piece('merlon-stepped')
    parapet(p)
    for y in (-0.375, -0.125, 0.125, 0.375):
        for w, z0, z1 in ((0.07, 0.10, 0.16), (0.045, 0.16, 0.21), (0.02, 0.21, 0.25)):
            p.box('wall', FACE - 0.08, y - w, z0, FACE, y + w, z1)
    return p


def piece_dome_lead():
    p = Piece('dome-lead')
    p.prism('stone', 0.42, 8, 0.0, 0.20, rot=math.pi / 8)
    p.prism('trim', 0.44, 8, 0.20, 0.23, rot=math.pi / 8)
    p.lathe('dome', round_dome(0.40, 0.34), 16, z0=0.23)
    p.prism('gold', 0.035, 6, 0.57, 0.62)
    return p


def piece_dome_ribbed():
    p = Piece('dome-ribbed')
    p.prism('stone', 0.40, 8, 0.0, 0.28, rot=math.pi / 8)
    p.prism('trim', 0.42, 8, 0.28, 0.31, rot=math.pi / 8)
    prof = pointed_dome(0.38)
    p.lathe('dome', prof, 12, z0=0.31)
    top = 0.31 + prof[-1][1]
    p.prism('gold', 0.03, 6, top, top + 0.06)
    return p


def piece_kumbet():
    p = Piece('kumbet')
    p.prism('stone', 0.40, 8, 0.0, 0.15, rot=math.pi / 8)
    p.prism('wall', 0.36, 8, 0.15, 1.30, rot=math.pi / 8)
    p.prism('accent', 0.365, 8, 1.12, 1.20, rot=math.pi / 8)
    p.prism('trim', 0.39, 8, 1.30, 1.36, rot=math.pi / 8)
    p.lathe('dome', [(0.39, 0.0), (0.0, 0.62)], 8, z0=1.36, rot=math.pi / 8)
    face = 0.36 * math.cos(math.pi / 8)
    p.slab_yz('dark', opening(0.07, 0.45, 0.68), face, face + 0.012)
    return p


def piece_minaret_pencil():
    p = Piece('minaret-pencil')
    p.box('stone', -0.17, -0.17, 0.0, 0.17, 0.17, 0.35)
    p.prism('wall', 0.11, 12, 0.35, 2.0)
    p.lathe('trim', [(0.11, 0.0), (0.17, 0.08)], 12, z0=1.92)
    p.prism('trim', 0.17, 12, 2.0, 2.07)
    p.prism('wall', 0.09, 12, 2.07, 2.55)
    p.lathe('dome', [(0.11, 0.0), (0.0, 0.60)], 12, z0=2.55)
    p.prism('gold', 0.02, 6, 3.15, 3.27)
    return p


def piece_minaret_square():
    p = Piece('minaret-square')
    p.box('stone', -0.18, -0.18, 0.0, 0.18, 0.18, 0.20)
    p.box('wall', -0.15, -0.15, 0.20, 0.15, 0.15, 1.50)
    p.box('band', -0.152, -0.152, 0.75, 0.152, 0.152, 0.80)
    p.box('trim', -0.20, -0.20, 1.50, 0.20, 0.20, 1.56)
    p.prism('wall', 0.13, 8, 1.56, 2.30, rot=math.pi / 8)
    p.prism('trim', 0.17, 8, 2.30, 2.35, rot=math.pi / 8)
    p.prism('stone', 0.09, 12, 2.35, 2.75)
    prof = pointed_dome(0.10)
    p.lathe('dome', prof, 12, z0=2.75)
    top = 2.75 + prof[-1][1]
    p.prism('gold', 0.02, 6, top, top + 0.09)
    return p


def piece_portal():
    p = Piece('portal')
    p.box('stone', 0.30, -0.5, 0.0, 0.62, 0.5, 1.70)
    p.slab_yz('accent', [(0.40, 0.10), (0.40, 1.55), (-0.40, 1.55), (-0.40, 0.10)], 0.62, 0.635)
    p.slab_yz('trim', opening(0.30, 0.10, 0.85), 0.62, 0.645)
    p.slab_yz('dark', opening(0.25, 0.10, 0.85), 0.62, 0.655)
    p.box('trim', 0.28, -0.52, 1.70, 0.64, 0.52, 1.76)
    return p


def piece_bay_cumba():
    p = Piece('bay-cumba')
    for y in (-0.25, 0.0, 0.25):
        p.box('trim', FACE, y - 0.025, -0.12, 0.74, y + 0.025, 0.05)
    p.box('wall', FACE, -0.32, 0.05, 0.78, 0.32, 0.85)
    for y in (-0.32, 0.32):
        p.box('trim', 0.76, y - 0.02, 0.05, 0.79, y + 0.02, 0.85)
    for y0, y1 in ((-0.20, -0.04), (0.04, 0.20)):
        p.box('dark', 0.78, y0, 0.35, 0.79, y1, 0.70)
    p.box('roof', 0.48, -0.38, 0.85, 0.84, 0.38, 0.90)
    return p


def piece_alem():
    p = Piece('alem')
    p.prism('gold', 0.018, 6, 0.0, 0.16)
    p.prism('gold', 0.04, 8, 0.06, 0.10)
    p.slab_yz('gold', [(y, z + 0.235) for y, z in crescent(0.07, 0.06, 0.03)], -0.008, 0.008)
    return p


def piece_malqaf():
    p = Piece('malqaf')
    p.box('wall', -0.12, -0.18, 0.0, 0.12, 0.18, 0.55)
    p.box('trim', -0.14, -0.20, 0.55, 0.14, 0.20, 0.60)
    p.box('dark', 0.12, -0.10, 0.30, 0.13, 0.10, 0.50)
    return p


def piece_mashrabiya():
    p = Piece('mashrabiya')
    p.box('trim', FACE, -0.20, 0.12, 0.60, 0.20, 0.20)
    p.box('trim', FACE, -0.25, 0.20, 0.68, 0.25, 0.80)
    for row in range(4):
        for col in range(3):
            y, z = -0.15 + col * 0.15, 0.29 + row * 0.14
            p.box('dark', 0.68, y - 0.035, z - 0.035, 0.69, y + 0.035, z + 0.035)
    p.box('trim', 0.48, -0.28, 0.80, 0.72, 0.28, 0.84)
    return p


# ---- Turks pieces, ages 0-3 (Seljuk and Ottoman) ----
# The camera sees each piece's +x and -y sides (game +x and +y), so two-sided details go there.
def piece_tower_round():
    p = Piece('tower-round')
    n, rot = 16, -math.pi / 16
    p.prism('stone', 0.44, n, 0.0, 0.12, rot=rot)
    p.prism('wall', 0.42, n, 0.12, 1.5, rot=rot)
    p.prism('band', 0.425, n, 1.2, 1.26, rot=rot)
    p.prism('trim', 0.45, n, 1.5, 1.57, rot=rot)
    p.lathe('dome', [(0.47, 0.0), (0.0, 0.74)], n, z0=1.57, rot=rot)
    face = 0.42 * math.cos(math.pi / 16)
    for z0, z1 in ((0.45, 0.7), (0.95, 1.15)):
        p.box('dark', face - 0.01, -0.025, z0, face + 0.012, 0.025, z1)
    return p


def piece_asbad():
    p = Piece('asbad')
    p.box('stone', -0.4, -0.4, 0.0, 0.4, 0.4, 0.12)
    p.box('wall', -0.38, -0.38, 0.12, 0.38, 0.38, 1.6)
    p.box('band', -0.385, -0.385, 1.08, 0.385, 0.385, 1.12)
    for s in (-0.24, -0.08, 0.08, 0.24):
        p.box('dark', 0.38, s - 0.03, 1.18, 0.39, s + 0.03, 1.52)      # wind slots, +x face
        p.box('dark', s - 0.03, -0.39, 1.18, s + 0.03, -0.38, 1.52)    # wind slots, camera-side -y face
    p.slab_yz('dark', opening(0.11, 0.12, 0.5), 0.38, 0.395)
    p.box('trim', -0.43, -0.43, 1.6, 0.43, 0.43, 1.67)
    return p


def piece_kiosk():
    p = Piece('kiosk')
    p.prism('stone', 0.38, 8, 0.0, 0.18, rot=math.pi / 8)
    p.prism('accent', 0.24, 8, 0.18, 0.26, rot=math.pi / 8)          # tiled basin
    for k in range(8):
        a = math.pi / 8 + 2 * math.pi * k / 8
        p.prism('stone', 0.03, 6, 0.18, 0.7, cx=0.31 * math.cos(a), cy=0.31 * math.sin(a))
    p.prism('roof', 0.45, 8, 0.7, 0.76, rot=math.pi / 8)              # broad eave
    p.lathe('dome', round_dome(0.3, 0.26), 12, z0=0.76)
    p.prism('gold', 0.025, 6, 1.02, 1.1)
    return p


def piece_lookout():
    p = Piece('lookout')
    for x in (-0.3, 0.3):
        for y in (-0.3, 0.3):
            p.box('wood', x - 0.035, y - 0.035, 0.0, x + 0.035, y + 0.035, 1.82)
    p.slab_xz('wood', [(-0.3, 0.2), (-0.24, 0.2), (0.3, 0.9), (0.24, 0.9)], -0.33, -0.29)
    p.box('wood', -0.38, -0.38, 1.5, 0.38, 0.38, 1.56)
    for x0, y0, x1, y1 in ((0.35, -0.38, 0.38, 0.38), (-0.38, -0.38, -0.35, 0.38), (-0.38, -0.38, 0.38, -0.35), (-0.38, 0.35, 0.38, 0.38)):
        p.box('wood', x0, y0, 1.68, x1, y1, 1.72)
    p.lathe('roof', [(0.56, 0.0), (0.0, 0.34)], 4, z0=1.82, rot=math.pi / 4)
    return p


def piece_jetty():
    p = Piece('jetty')
    for y0, y1 in ((-0.5, -0.18), (-0.16, 0.16), (0.18, 0.5)):
        p.box('wood', -0.5, y0, 0.06, 0.5, y1, 0.12)
    for x in (-0.38, 0.38):
        for y in (-0.42, 0.42):
            p.prism('wood', 0.04, 6, -0.18, 0.16, cx=x, cy=y)
    return p


def piece_crane():
    p = Piece('crane')
    p.box('stone', -0.16, -0.16, 0.0, 0.16, 0.16, 0.1)
    p.box('wood', -0.04, -0.04, 0.1, 0.04, 0.04, 1.42)
    p.box('wood', -0.12, -0.03, 1.32, 0.72, 0.03, 1.38)
    p.slab_xz('wood', [(0.0, 0.95), (0.06, 0.95), (0.5, 1.32), (0.42, 1.32)], -0.02, 0.02)
    p.box('dark', 0.66, -0.006, 0.72, 0.672, 0.006, 1.32)
    p.box('metal', 0.62, -0.05, 0.62, 0.72, 0.05, 0.72)
    return p


def piece_cannon():
    p = Piece('cannon')
    p.box('wood', -0.26, -0.1, 0.1, 0.12, 0.1, 0.22)
    for y0, y1 in ((-0.17, -0.11), (0.11, 0.17)):
        p.cyl_y('wood', 0.13, 10, y0, y1, cx=-0.06, cz=0.13)
    p.cyl_x('metal', 0.075, 0.055, 12, -0.32, 0.46, cz=0.3)
    return p


def piece_rack_shields():
    p = Piece('rack-shields')
    for y in (-0.36, 0.36):
        p.box('wood', 0.36, y - 0.025, 0.0, 0.41, y + 0.025, 0.62)
    p.box('wood', 0.36, -0.4, 0.56, 0.41, 0.4, 0.61)
    for y in (-0.2, 0.0, 0.2):
        p.cyl_x('accent', 0.095, 0.095, 12, 0.41, 0.43, cy=y, cz=0.36)
        p.cyl_x('metal', 0.025, 0.02, 6, 0.43, 0.45, cy=y, cz=0.36)
    for y in (-0.1, 0.1):
        p.box('metal', 0.415, y - 0.006, 0.08, 0.425, y + 0.006, 0.52)
    return p


def piece_target():
    p = Piece('target')
    for y in (-0.16, 0.16):
        p.slab_xz('wood', [(-0.2, 0.0), (-0.14, 0.0), (0.02, 0.5), (-0.04, 0.5)], y - 0.02, y + 0.02)
    p.cyl_x('wall', 0.22, 0.22, 16, 0.0, 0.05, cz=0.5)
    p.cyl_x('accent', 0.14, 0.14, 16, 0.05, 0.06, cz=0.5)
    p.cyl_x('dark', 0.05, 0.05, 10, 0.06, 0.07, cz=0.5)
    return p


def piece_forge():
    p = Piece('forge')
    p.box('stone', -0.32, -0.26, 0.0, 0.18, 0.26, 0.36)
    p.box('gold', 0.14, -0.14, 0.2, 0.19, 0.14, 0.3)          # glowing coals in the hearth mouth
    p.box('stone', -0.26, -0.18, 0.36, 0.08, 0.18, 0.62)
    p.box('stone', -0.2, -0.12, 0.62, 0.02, 0.12, 0.95)       # flue
    p.box('metal', 0.32, -0.06, 0.0, 0.42, 0.06, 0.12)         # anvil
    p.box('metal', 0.29, -0.1, 0.12, 0.47, 0.1, 0.18)
    return p


def piece_sextant():
    p = Piece('sextant')
    p.box('stone', -0.45, -0.12, 0.0, 0.45, 0.12, 0.08)
    outer = [(-0.4 + 0.85 * math.cos(t), 0.08 + 0.85 * math.sin(t)) for t in (math.pi / 2 * s / 10 for s in range(11))]
    inner = [(-0.4 + 0.72 * math.cos(t), 0.08 + 0.72 * math.sin(t)) for t in (math.pi / 2 * s / 10 for s in range(10, -1, -1))]
    p.slab_xz('stone', outer + inner, -0.07, 0.07)
    p.box('gold', -0.42, -0.075, 0.08, -0.38, 0.075, 0.95)    # gnomon edge
    return p


def piece_tug():
    p = Piece('tug')
    p.prism('wood', 0.016, 6, 0.0, 1.02)
    p.lathe('dark', [(0.075, 0.0), (0.05, 0.18), (0.02, 0.3)], 8, z0=0.66)   # horse-tail plume
    p.lathe('gold', round_dome(0.035, 0.035), 8, z0=1.02)
    p.slab_yz('gold', [(y, z + 1.14) for y, z in crescent(0.055, 0.046, 0.022)], -0.006, 0.006)
    return p


def piece_awning():
    p = Piece('awning')
    p.box('wood', 0.18, -0.42, 0.0, 0.44, 0.42, 0.3)                   # counter
    p.box('trim', 0.2, -0.38, 0.3, 0.42, -0.06, 0.38)                  # goods
    p.box('gold', 0.2, 0.06, 0.3, 0.42, 0.38, 0.36)
    for y in (-0.45, 0.45):
        p.box('wood', 0.44, y - 0.02, 0.0, 0.48, y + 0.02, 0.62)
    p.slab_xz('accent', [(-0.1, 0.82), (-0.1, 0.86), (0.56, 0.64), (0.56, 0.6)], -0.5, 0.5)
    return p


def piece_chimney():
    p = Piece('chimney')
    p.box('stone', -0.08, -0.08, 0.0, 0.08, 0.08, 0.5)
    p.box('trim', -0.1, -0.1, 0.5, 0.1, 0.1, 0.55)
    return p


PIECES = {
    'wall': piece_wall, 'wall-window': piece_wall_window, 'wall-door': piece_wall_door,
    'wall-arcade': piece_wall_arcade, 'wall-timber': piece_wall_timber,
    'roof-flat': piece_roof_flat, 'roof-hip': piece_roof_hip,
    'merlon-pointed': piece_merlon_pointed, 'merlon-stepped': piece_merlon_stepped,
    'dome-lead': piece_dome_lead, 'dome-ribbed': piece_dome_ribbed, 'kumbet': piece_kumbet,
    'minaret-pencil': piece_minaret_pencil, 'minaret-square': piece_minaret_square,
    'portal': piece_portal, 'bay-cumba': piece_bay_cumba, 'alem': piece_alem,
    'malqaf': piece_malqaf, 'mashrabiya': piece_mashrabiya,
    'tower-round': piece_tower_round,
    'asbad': piece_asbad,
    'kiosk': piece_kiosk,
    'lookout': piece_lookout,
    'jetty': piece_jetty,
    'crane': piece_crane,
    'cannon': piece_cannon,
    'rack-shields': piece_rack_shields,
    'target': piece_target,
    'forge': piece_forge,
    'sextant': piece_sextant,
    'tug': piece_tug,
    'awning': piece_awning,
    'chimney': piece_chimney,
}


def preview(names, spacing=1.6):
    """Build pieces side by side in a 'kit-preview' collection of the open scene, without exporting."""
    return kitlib.preview(PIECES, names, spacing)


if __name__ == '__main__':
    kitlib.main(PIECES, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'assets', 'original', 'islamic'))
