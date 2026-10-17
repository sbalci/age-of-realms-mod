# Turks Building Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Turks their own sprite for every building type and every age: 79 new sprites, Seljuk (ages 0–1), Ottoman (2–3), Tanzimat (4) and Republican (5). Load civ sprites only when a civ is in play, and extract shared Blender kit code for later civs.

**Architecture:**
- `tools/art/blender/kitlib.py` holds the reusable Blender helpers. `islamic_kit.py` grows from 19 to 49 pieces.
- The Islamic recipes split into three ES modules:
  - `islamic-kit.mjs`: palettes, slots, helpers
  - `turks-recipes.mjs`: one builder per era and building type, so a recipe bakes exactly the ages whose era has a builder
  - `saracens-recipes.mjs`
- In game:
  - `art_kenney.js` loads shared sprites at startup and a civ's set on first draw.
  - `civ_art.js` prefers a civ's own castle and skips painted era add-ons on sprites baked for that age.

**Tech Stack:**
- Blender 5.2.2 (bpy/bmesh, glTF export) run headless, plus the Blender MCP for visual checks
- the three.js 0.186 baker in Playwright Chromium
- plain browser JS (game)
- Node 22 test scripts (`tests/*.test.js`) and Playwright (`tests/browser/*.spec.js`)

**Spec:** [docs/superpowers/specs/2026-10-17-turks-building-set-design.md](../specs/2026-10-17-turks-building-set-design.md)

**Validated while planning** (in a scratch worktree):
- **Ran:**
  - both byte-identical refactor proofs
  - the recipe structure of every phase
  - a bake of all 89 Turks sprites
  - `node tests/islamic-art.test.js` (13/13)
  - `npm run test:syntax`
  - the art, islamic-art and actors browser specs, including every new browser test here
- **Not run:** `npm run test:quick` and the full browser suite. They first run during execution: test:quick in most tasks, the full browser suite in Task 13.
- The looks are first drafts. The three review points exist to change them.

## Global Constraints

**Tools**
- Free and open source only. Do not call the Blender MCP `generate_3d`, `search_assets` or `import_asset` tools, and use no AI image generation. Every mesh comes from `islamic_kit.py` or the existing Kenney CC0 kits.
- Blender: `D:\Blender\blender.exe` (5.2.2). The `BLENDER` environment variable overrides it.
- Playwright Chromium: prefix `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright` on every command that bakes or runs browser tests. Never set it user-wide (`setx`).

**Baking**
- Bake only with `npm run art:bake -- --recipes <names>`. Never run a plain `npm run art:bake`.
- After every bake, run the bake check (section "How to check a bake").

**Browser suite**
- Never run the whole browser suite (`npm run test:browser`) except in Task 13. It rewrites tracked files under `assets/screenshots/`. Restore them afterwards with `git checkout -- assets/screenshots`.

**Git**
- Branch `feat/turks-building-set`.
- Every commit message ends with the `Co-Authored-By:` line from the committing agent's own attribution instructions.

**Sprites**
- Keys are `<type>_turks_<age>`.
- Ages per type, final:

  | Type | Ages |
  |---|---|
  | `house`, `tc`, `mill`, `lumbercamp`, `miningcamp`, `dock`, `barracks` | 0–5 |
  | `monastery`, `university`, `siege` | 2–5 |
  | `market`, `blacksmith`, `range`, `stable`, `tower` | 1–5 |
  | `well` | 0, 2, 4, 5 |
  | `castle` | 2, 4, 5 |
  | `outpost` | 0, 4, 5 |

- 89 Turks keys in total, plus the 10 existing Saracens keys.
- Footprints and stature match the shared recipes: the `FORM` table in `turks-recipes.mjs`.

**Kit conventions**
- 1×1 cell pieces centred on the origin; one storey = 1 unit.
- Wall pieces sit on the +x edge, facing +x; glTF is Y-up.
- Materials are named only after the slots: `wall stone trim roof dome accent band gold dark wood metal brick`. All metallic 0, roughness 1.
- The camera sees each piece's +x and −y sides.

**Colours**
- Turks palettes equal `CIV_ARCH.turks.ages[0..5]` in `game/js/civ_art.js`. Age 5 is changed in Task 9 to Republican:

  ```js
  { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', base: '#9a8a78', beams: null, stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' }
  ```

- `FIXED` ends up as `gold #e8c040`, `dark #2a2420`, `wood #6b4a2b`, `metal #4a4640`, `brick #9a4a32`.
- `SHADE` stays `0.92`.

**Review gates**
- Tasks 5, 8 and 10 end with a user approval. Do not start the next task until the user approves.

**Main-session steps** (they need the user or the live Blender MCP; the coordinating session runs them itself even under subagent-driven execution):
- Task 4 Step 6
- Task 5 Steps 4–6
- Task 8 (all)
- Task 9 Step 7
- Task 10 Steps 4–6
- Task 13 Step 3

The self-check previews in Tasks 7 and 12 stay with the implementer, who opens `tools/art/preview.png` with the Read tool. The coordinator also looks at those previews when reviewing the task.

## How to check a bake

Run after every `npm run art:bake -- --recipes …`:

```bash
git diff --stat -- game/art/kenney ':!game/art/kenney/manifest.js'
git status --short game/art/kenney
git diff --stat -- game/art/kenney/manifest.js
```

**Expected:**
- The first command prints **nothing**: no existing PNG changed.
- The second lists only `?? game/art/kenney/<new>_turks_<n>.png` lines, and ` M game/art/kenney/manifest.js`.
  - `manifest.js` can show as `M` from line endings alone. The third command shows the real content change: insertions only.
- The bake's last line reports the stated sprite count, and `manifest has <N>`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `tools/art/blender/kitlib.py` | create | Kit-independent Blender helpers: materials, `Piece` builder, outlines, export/preview/main |
| `tools/art/blender/islamic_kit.py` | modify | Islamic constants, wall helpers and the 49 piece builders |
| `assets/original/islamic/*.glb` | create (generated) | 30 new pieces (19 existing stay byte-identical) |
| `tools/art/islamic-kit.mjs` | create | Palettes, `FIXED`, `SHADE`, `TOP`, `islamicSlots`, placement helpers |
| `tools/art/turks-recipes.mjs` | create | `ERA`, `AGES`, `FORM`, era builders, `TURKS_RECIPES` |
| `tools/art/saracens-recipes.mjs` | create | `SARACENS_RECIPES` (moved verbatim) |
| `tools/art/islamic-recipes.js` | delete | Replaced by the three modules |
| `tools/art/kenney-recipes.js` | modify | Imports both civ modules |
| `tools/art/kenney-bake.html` | modify | Imports `islamicSlots` from `islamic-kit.mjs` |
| `tools/art/bake-kenney.mjs` | modify | Serves `.mjs` as JavaScript |
| `game/js/art_kenney.js` | modify | `kartCiv`, on-demand `KART.loadCiv`, coalesced refresh |
| `game/js/civ_art.js` | modify | Triggers civ loads; civ castle first; era add-on skip; Turks age-5 palette |
| `game/art/kenney/*_turks_*.png`, `manifest.js` | create/modify (generated) | 79 new sprites |
| `tests/islamic-art.test.js` | rewrite/modify | Imports the modules; pieces, palettes, exact keys, duplicate names |
| `tests/browser/art.spec.js`, `islamic-art.spec.js`, `actors.spec.js` | modify | On-demand loading, castle, era add-ons, Turks town |
| `assets/original/islamic/README.md`, `docs/ASSET_PLAN.md`, `README.md` | modify | Docs |

---

### Task 1: Shared Blender kit library (neutral refactor)

**Files:**
- Create: `tools/art/blender/kitlib.py`
- Modify (rewrite): `tools/art/blender/islamic_kit.py`

**Interfaces:**
- Produces:
  - `kitlib.Piece` with `box`, `slab_yz`, `lathe`, `prism`
  - `kitlib.pointed_arch`, `opening`, `horseshoe`, `crescent`, `pointed_dome`, `round_dome`
  - `kitlib.build_object(piece)`, `kitlib.export(piece, out_dir)`, `kitlib.preview(pieces, names, spacing=1.6)`, `kitlib.main(pieces, default_out)`
  - `kitlib.SLOTS` (preview colours)
  - `islamic_kit.PIECES` and `islamic_kit.preview(names, spacing=1.6)`

- [ ] **Step 1: Record the baseline**

  Run `npm run test:quick`.

  Expected: every suite passes. Write down the total.

- [ ] **Step 2: Write** `tools/art/blender/kitlib.py`

```python
"""Shared building blocks for the original Blender-scripted parts kits (tools/art/blender/*_kit.py).

A kit script defines its pieces with these helpers and hands them to main():
  blender -b --factory-startup --python tools/art/blender/<kit>_kit.py -- <out_dir> [piece,piece,...]
In a live Blender (Blender MCP), exec the kit script with __name__ != '__main__' and call its preview([...]).

Conventions shared by every kit (they match the Kenney kits used by tools/art/kenney-recipes.js):
  * one piece per 1x1 tile cell, centred on the origin; one storey = 1 unit high
  * wall-type pieces sit on the cell's +x edge and face +x
  * Blender is Z-up; the glTF exporter writes Y-up, which is what the baker expects
  * materials are named after colour slots; the baker recolours every slot per civ and age
"""
import bmesh
import bpy
import math
import os
import sys

SLOTS = {   # preview colours only (sRGB); the recipe modules supply the baked colours
    'wall': '#ded4c2', 'stone': '#ccc2b0', 'trim': '#288290', 'roof': '#526270', 'dome': '#586878',
    'accent': '#c83028', 'band': '#288290', 'gold': '#e8c040', 'dark': '#2a2420',
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(slot):
    m = bpy.data.materials.get(slot)
    if m:
        return m
    m = bpy.data.materials.new(slot)
    try:
        m.use_nodes = True
    except (AttributeError, TypeError):
        pass
    h = SLOTS[slot]
    rgb = [srgb_to_linear(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 1.0
    m.diffuse_color = (*rgb, 1.0)
    return m


class Piece:
    """Accumulates one piece's geometry in a bmesh; every part names its colour slot."""

    def __init__(self, name):
        self.name, self.bm, self.slots = name, bmesh.new(), []

    def _mat(self, slot):
        if slot not in self.slots:
            self.slots.append(slot)
        return self.slots.index(slot)

    def box(self, slot, x0, y0, z0, x1, y1, z1):
        i = self._mat(slot)
        v = [self.bm.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
        for f in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
            self.bm.faces.new([v[k] for k in f]).material_index = i

    def slab_yz(self, slot, pts, x0, x1):
        """Extrude a closed (y, z) outline along x from x0 to x1."""
        i, n = self._mat(slot), len(pts)
        a = [self.bm.verts.new((x0, y, z)) for y, z in pts]
        b = [self.bm.verts.new((x1, y, z)) for y, z in pts]
        self.bm.faces.new(a).material_index = i
        self.bm.faces.new(b[::-1]).material_index = i
        for k in range(n):
            self.bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])).material_index = i

    def lathe(self, slot, prof, n, cx=0.0, cy=0.0, z0=0.0, rot=0.0):
        """Revolve a (radius, z) profile, bottom to top, with n sides; radius 0 makes an apex."""
        i, rings = self._mat(slot), []
        for r, z in prof:
            if r <= 1e-6:
                rings.append([self.bm.verts.new((cx, cy, z0 + z))])
            else:
                rings.append([self.bm.verts.new((cx + r * math.cos(rot + 2 * math.pi * k / n),
                                                 cy + r * math.sin(rot + 2 * math.pi * k / n), z0 + z)) for k in range(n)])
        for lo, hi in zip(rings, rings[1:]):
            for k in range(n):
                if len(lo) == 1:
                    f = (lo[0], hi[(k + 1) % n], hi[k])
                elif len(hi) == 1:
                    f = (lo[k], lo[(k + 1) % n], hi[0])
                else:
                    f = (lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k])
                self.bm.faces.new(f).material_index = i
        if len(rings[0]) > 1:
            self.bm.faces.new(rings[0][::-1]).material_index = i
        if len(rings[-1]) > 1:
            self.bm.faces.new(rings[-1]).material_index = i

    def prism(self, slot, r, n, z0, z1, cx=0.0, cy=0.0, rot=0.0):
        self.lathe(slot, [(r, 0.0), (r, z1 - z0)], n, cx, cy, z0, rot)


# ---- 2D outlines in the (y, z) wall plane ----
def pointed_arch(a, zs, k=1.6, steps=6):
    """Pointed arch of half-width a springing at zs: right springing point, apex, left springing point."""
    R = k * a
    tmax = math.acos((R - a) / R)
    right = [(a - R + R * math.cos(t), zs + R * math.sin(t)) for t in (tmax * s / steps for s in range(steps + 1))]
    return right + [(-y, z) for y, z in reversed(right[:-1])]


def opening(a, z0, zs, k=1.6):
    return [(a, z0)] + pointed_arch(a, zs, k) + [(-a, z0)]


def horseshoe(r, zs, beta=math.radians(20), steps=12):
    """Horseshoe arch of radius r whose feet stand on zs, from the right foot over the top to the left foot."""
    zc = zs + r * math.sin(beta)
    return [(r * math.cos(t), zc + r * math.sin(t)) for t in (-beta + (math.pi + 2 * beta) * s / steps for s in range(steps + 1))]


def crescent(R, r, off, steps=10):
    """Crescent with horns up: outer circle at the origin minus an inner circle raised by off."""
    yi = (R * R - r * r + off * off) / (2 * off)
    xi = math.sqrt(max(R * R - yi * yi, 1e-9))
    a0, b1, b0 = math.atan2(yi, xi), math.atan2(yi - off, -xi), math.atan2(yi - off, xi)
    a1 = -math.pi - a0
    if b0 < b1:
        b0 += 2 * math.pi
    outer = [(R * math.cos(a0 + (a1 - a0) * s / steps), R * math.sin(a0 + (a1 - a0) * s / steps)) for s in range(steps + 1)]
    inner = [(r * math.cos(b1 + (b0 - b1) * s / steps), off + r * math.sin(b1 + (b0 - b1) * s / steps)) for s in range(1, steps)]
    return outer + inner


def pointed_dome(r, k=1.7, steps=6):
    """(radius, z) profile of a pointed dome of base radius r."""
    Rc = k * r
    tmax = math.acos((Rc - r) / Rc)
    prof = [(r - Rc + Rc * math.cos(t), Rc * math.sin(t)) for t in (tmax * s / steps for s in range(steps + 1))]
    prof[-1] = (0.0, prof[-1][1])
    return prof


def round_dome(r, hz, steps=6):
    prof = [(r * math.cos(math.pi / 2 * s / steps), hz * math.sin(math.pi / 2 * s / steps)) for s in range(steps + 1)]
    prof[-1] = (0.0, hz)
    return prof


# ---- building, exporting and previewing ----
def build_object(p):
    bmesh.ops.recalc_face_normals(p.bm, faces=p.bm.faces)
    mesh = bpy.data.meshes.new(p.name)
    p.bm.to_mesh(mesh)
    p.bm.free()
    for s in p.slots:
        mesh.materials.append(material(s))
    return bpy.data.objects.new(p.name, mesh)


def export(p, out_dir):
    obj = build_object(p)
    bpy.context.scene.collection.objects.link(obj)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, p.name + '.glb'), export_format='GLB',
                              use_selection=True, export_yup=True)
    mesh = obj.data
    bpy.data.objects.remove(obj)
    bpy.data.meshes.remove(mesh)


def preview(pieces, names, spacing=1.6):
    """Build pieces side by side in a 'kit-preview' collection of the open scene, without exporting."""
    col = bpy.data.collections.get('kit-preview') or bpy.data.collections.new('kit-preview')
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o)
    for i, n in enumerate(names):
        obj = build_object(pieces[n]())
        obj.location.x = i * spacing
        col.objects.link(obj)
    return col


def main(pieces, default_out):
    """Headless entry point: export every piece (or the comma-separated list after the output dir)."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else default_out
    names = argv[1].split(',') if len(argv) > 1 else list(pieces)
    unknown = [n for n in names if n not in pieces]
    if unknown:
        raise SystemExit('unknown pieces: ' + ', '.join(unknown))
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for n in names:
        export(pieces[n](), out_dir)
        print('wrote ' + n)
```

- [ ] **Step 3: Rewrite** `tools/art/blender/islamic_kit.py`

  The constants, wall helpers and piece builders are unchanged; only the shared half moved to `kitlib.py`.

```python
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


PIECES = {
    'wall': piece_wall, 'wall-window': piece_wall_window, 'wall-door': piece_wall_door,
    'wall-arcade': piece_wall_arcade, 'wall-timber': piece_wall_timber,
    'roof-flat': piece_roof_flat, 'roof-hip': piece_roof_hip,
    'merlon-pointed': piece_merlon_pointed, 'merlon-stepped': piece_merlon_stepped,
    'dome-lead': piece_dome_lead, 'dome-ribbed': piece_dome_ribbed, 'kumbet': piece_kumbet,
    'minaret-pencil': piece_minaret_pencil, 'minaret-square': piece_minaret_square,
    'portal': piece_portal, 'bay-cumba': piece_bay_cumba, 'alem': piece_alem,
    'malqaf': piece_malqaf, 'mashrabiya': piece_mashrabiya,
}


def preview(names, spacing=1.6):
    """Build pieces side by side in a 'kit-preview' collection of the open scene, without exporting."""
    return kitlib.preview(PIECES, names, spacing)


if __name__ == '__main__':
    kitlib.main(PIECES, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'assets', 'original', 'islamic'))
```

- [ ] **Step 4: Prove the refactor is neutral**

  ```bash
  npm run art:kit
  git diff --stat -- assets/original/islamic
  ```

  Expected: 19 `wrote` lines, and the diff prints **nothing**, meaning all 19 GLBs are byte-identical.

- [ ] **Step 5: Run the tests and commit**

  Run `node tests/islamic-art.test.js`. Expected: `12 passed, 0 failed`.

  ```bash
  git add tools/art/blender/kitlib.py tools/art/blender/islamic_kit.py
  git commit -m "refactor(art): move shared Blender kit helpers into kitlib.py"
  ```

---

### Task 2: Islamic recipes as ES modules (neutral refactor)

**Files:**
- Create: `tools/art/islamic-kit.mjs`, `tools/art/turks-recipes.mjs`, `tools/art/saracens-recipes.mjs`
- Delete: `tools/art/islamic-recipes.js`
- Modify: `tools/art/kenney-recipes.js:1` and its last two lines; `tools/art/kenney-bake.html:21`; `tools/art/bake-kenney.mjs:20`
- Rewrite: `tests/islamic-art.test.js`
- Modify: `assets/original/islamic/README.md` (last line), `docs/ASSET_PLAN.md:30`

**Interfaces:**
- Produces:
  - `islamic-kit.mjs` exports `PALETTES`, `FIXED`, `SHADE`, `TOP`, `islamicSlots(civ, age)`, `I`, `ROT`, `CYPRESS`, `HIDE`, `ring`, `roof`, `crown`, `portico`
  - `turks-recipes.mjs` exports `ERA` and `TURKS_RECIPES`. It has era objects `SELJUK`, `OTTOMAN`, `TANZIMAT`, `REPUBLICAN` keyed by building type, and the marker line `// ---- recipes (keep last) ----` before which later tasks insert builders.
  - `saracens-recipes.mjs` exports `SARACENS_RECIPES`
  - The test constants `PIECES`, `SLOTS` and `TURKS_BAKED`, which later tasks edit

- [ ] **Step 1: Rewrite the test** `tests/islamic-art.test.js`

  It now imports the modules instead of vm-loading `islamic-recipes.js`.

```js
// Original Islamic building kit: GLB pieces, recipes and civ palettes stay consistent with each other and the game.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), { pathToFileURL } = require('url');
const root = path.join(__dirname, '..');
const KIT = path.join(root, 'assets/original/islamic');
const KENNEY = { town: 'assets/thirdparty/kenney/fantasy-town-kit', castle: 'assets/thirdparty/kenney/castle-kit', nature: 'assets/thirdparty/kenney/nature-kit' };
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark'];
const PIECES = ['wall', 'wall-window', 'wall-door', 'wall-arcade', 'wall-timber', 'roof-flat', 'roof-hip', 'merlon-pointed', 'merlon-stepped',
  'dome-lead', 'dome-ribbed', 'kumbet', 'minaret-pencil', 'minaret-square', 'portal', 'bay-cumba', 'alem', 'malqaf', 'mashrabiya'];
// Sprites baked so far, by building type and age. The recipes must bake exactly these, and manifest.js may hold no others.
const TURKS_BAKED = { house: [0, 1, 2, 3], tc: [0, 1, 2, 3], monastery: [2, 3] };
const SARACENS_BAKED = { house: [0, 1, 2, 3], tc: [0, 1, 2, 3], monastery: [2, 3] };
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } };

function glb(name) {
  const b = fs.readFileSync(path.join(KIT, name + '.glb'));
  assert.equal(b.toString('ascii', 0, 4), 'glTF', name);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}
function bounds(j) {   // over every POSITION accessor, in glTF axes (y is up)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const m of j.meshes) for (const p of m.primitives) {
    const a = j.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i]); max[i] = Math.max(max[i], a.max[i]); }
  }
  return { min, max };
}
const keysOf = (baked, civ) => Object.entries(baked).flatMap(([type, ages]) => ages.map(a => `${type}_${civ}_${a}`));
const manifest = () => vm.runInNewContext(fs.readFileSync(path.join(root, 'game/art/kenney/manifest.js'), 'utf8') + ';KENNEY_ART');

(async () => {
  const mod = f => import(pathToFileURL(path.join(root, 'tools/art', f)).href);
  const kit = await mod('islamic-kit.mjs'), T = await mod('turks-recipes.mjs'), S = await mod('saracens-recipes.mjs');
  const RECIPES = { ...T.TURKS_RECIPES, ...S.SARACENS_RECIPES };
  const EXPECTED = [...keysOf(TURKS_BAKED, 'turks'), ...keysOf(SARACENS_BAKED, 'saracens')];
  function placements() {   // every k.add(kit, name) made by every recipe at every style it bakes
    const out = [];
    for (const [recipe, r] of Object.entries(RECIPES)) for (const style of r.styles) {
      r.build({ style, add: (kitName, name) => out.push({ recipe, style, kit: kitName, name }) });
    }
    return out;
  }

  test('the kit holds every piece', () => {
    for (const n of PIECES) assert.ok(fs.existsSync(path.join(KIT, n + '.glb')), n + '.glb missing');
  });
  test('kit pieces use only the named colour slots and are matte', () => {
    for (const n of PIECES) for (const m of glb(n).materials) {
      assert.ok(SLOTS.includes(m.name), n + ': unexpected material ' + m.name);
      assert.equal(m.pbrMetallicRoughness.metallicFactor ?? 1, 0, n + ' ' + m.name + ' metallic');
      assert.equal(m.pbrMetallicRoughness.roughnessFactor ?? 1, 1, n + ' ' + m.name + ' roughness');
    }
  });
  test('wall pieces follow the Kenney cell convention: +x edge, one storey, one cell wide', () => {
    for (const n of PIECES.filter(n => n.startsWith('wall'))) {
      const { min, max } = bounds(glb(n));
      assert.ok(min[0] >= 0.3 && max[0] <= 0.56, n + ' x ' + min[0] + '..' + max[0]);
      assert.ok(Math.abs(min[1]) < 1e-3 && Math.abs(max[1] - 1) < 1e-3, n + ' height');
      assert.ok(min[2] >= -0.501 && max[2] <= 0.501, n + ' width');
    }
  });
  test('every Islamic piece a recipe uses is in the kit', () => {
    for (const p of placements().filter(p => p.kit === 'islamic')) assert.ok(PIECES.includes(p.name), `${p.recipe}_${p.style}: unknown piece ${p.name}`);
  });
  test('every Kenney prop a recipe uses exists in its kit', () => {
    for (const p of placements().filter(p => p.kit !== 'islamic')) assert.ok(fs.existsSync(path.join(root, KENNEY[p.kit], p.name + '.glb')), `${p.recipe}_${p.style}: ${p.kit}/${p.name}`);
  });
  test('TOP heights match the crowning pieces', () => {
    for (const [n, h] of Object.entries(kit.TOP)) {
      const top = bounds(glb(n)).max[1];
      assert.ok(Math.abs(top - h) < 0.005, n + ' top ' + top + ' vs TOP ' + h);
    }
  });
  test('palettes match CIV_ARCH in game/js/civ_art.js for every age they cover', () => {
    const src = fs.readFileSync(path.join(root, 'game/js/civ_art.js'), 'utf8');
    const CIV_ARCH = vm.runInNewContext(src.slice(src.indexOf('const CIV_ARCH'), src.indexOf('const CIV_WONDER_NAMES')) + ';CIV_ARCH');
    for (const civ of ['turks', 'saracens']) kit.PALETTES[civ].forEach((row, age) => {
      for (const f of ['wall', 'stone', 'trim', 'roof', 'dome', 'accent']) assert.equal(row[f], CIV_ARCH[civ].ages[age][f], `${civ} age ${age} ${f}`);
    });
  });
  test('islamicSlots colours every slot, with ablaq bands only for Saracens from age 2', () => {
    for (const civ of ['turks', 'saracens']) for (let age = 0; age < 6; age++) {
      const s = kit.islamicSlots(civ, age);
      for (const k of SLOTS) assert.match(s[k], /^#[0-9a-f]{6}$/, `${civ} ${age} ${k}`);
    }
    assert.equal(kit.islamicSlots('saracens', 2).band, kit.islamicSlots('saracens', 2).trim);
    assert.equal(kit.islamicSlots('saracens', 1).band, kit.islamicSlots('saracens', 1).wall);
    assert.equal(kit.islamicSlots('turks', 3).band, kit.islamicSlots('turks', 3).wall);
  });
  test('islamicSlots names the valid civs when the recipe has none', () => {
    assert.throws(() => kit.islamicSlots(undefined, 0), /one of turks, saracens .*\(got undefined\)/);
  });
  test('every recipe style is baked into the manifest with its PNG', () => {
    const art = manifest();
    for (const [name, r] of Object.entries(RECIPES)) for (const s of r.styles) {
      const key = name + '_' + s;
      assert.ok(art[key], key + ' missing from manifest.js');
      assert.ok(fs.existsSync(path.join(root, 'game/art/kenney', key + '.png')), key + '.png missing');
    }
  });
  test('the recipes bake exactly the expected sprites', () => {
    const keys = Object.entries(RECIPES).flatMap(([name, r]) => r.styles.map(s => name + '_' + s)).sort();
    assert.deepEqual(keys, EXPECTED.slice().sort());
  });
  test('manifest.js holds no turks/saracens sprite outside the expected set', () => {
    const stale = Object.keys(manifest()).filter(k => /_(turks|saracens)_\d+$/.test(k) && !EXPECTED.includes(k));
    assert.deepEqual(stale, []);
  });
  test('no recipe name is defined in more than one recipe module', () => {
    const src = fs.readFileSync(path.join(root, 'tools/art/kenney-recipes.js'), 'utf8');
    const start = src.indexOf('export const RECIPES = {');
    const kenney = [...src.slice(start, src.indexOf('\n};', start)).matchAll(/^  ([a-z_0-9]+): \{/gm)].map(m => m[1]);
    assert.ok(kenney.length > 20, 'read the Kenney recipe names (' + kenney.length + ')');
    const owner = new Map();
    for (const [module, names] of [['kenney-recipes.js', kenney], ['turks-recipes.mjs', Object.keys(T.TURKS_RECIPES)], ['saracens-recipes.mjs', Object.keys(S.SARACENS_RECIPES)]]) {
      for (const n of names) { assert.ok(!owner.has(n), `${n} is defined in ${owner.get(n)} and ${module}`); owner.set(n, module); }
    }
  });

  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `node tests/islamic-art.test.js`

  Expected: the process exits with `ERR_MODULE_NOT_FOUND` for `tools/art/islamic-kit.mjs`.

- [ ] **Step 3: Write** `tools/art/islamic-kit.mjs`

```js
// Shared parts of the Islamic kit recipes (Turks and Saracens): civ palettes, slot colours and placement helpers.
// The pieces are GLBs in assets/original/islamic/, built by tools/art/blender/islamic_kit.py. Coordinates follow
// kenney-recipes.js: game tiles x, y and height z in storeys; the camera sees the east (+x) and south (+y) faces.

// Per-age colours copied from CIV_ARCH in game/js/civ_art.js. tests/islamic-art.test.js keeps them in sync.
export const PALETTES = {
  turks: [
    { wall: '#a88254', roof: '#3a7880', trim: '#684828', stone: '#b09878', accent: '#289098', dome: '#3a7880' },
    { wall: '#d6be98', roof: '#2e7c88', trim: '#6e5030', stone: '#c2ac8c', accent: '#2494a0', dome: '#2e8490' },
    { wall: '#ded4c2', roof: '#526270', trim: '#288290', stone: '#ccc2b0', accent: '#c83028', dome: '#586878' },
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
  ],
  saracens: [
    { wall: '#b88c58', roof: '#d4b068', trim: '#78522c', stone: '#bca07c', accent: '#1e824c', dome: '#c8a058' },
    { wall: '#dfc496', roof: '#c89e54', trim: '#7c5630', stone: '#ceb28a', accent: '#1e824c', dome: '#2e8b78' },
    { wall: '#e8d0a6', roof: '#28887a', trim: '#8c6438', stone: '#dcc29a', accent: '#d8a830', dome: '#289484' },
    { wall: '#f2deb8', roof: '#1e7c72', trim: '#c89830', stone: '#e8d0aa', accent: '#e8b838', dome: '#d8a830' },
  ],
};
export const FIXED = { gold: '#e8c040', dark: '#2a2420' };
// One multiplier on every slot colour. The civ palettes were tuned for flat 2D art; tuned at the pilot's review point 1.
export const SHADE = 0.92;
// Height of each crowning piece at scale 1, so a finial or another piece can sit on top. tests/islamic-art.test.js
// checks these against the GLBs.
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76 };

const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)).toString(16).padStart(2, '0')).join('');

// Colour of every kit material slot for one civ at one age (ages past the civ's palette use its last row).
// The band slot draws the striped (ablaq) courses: trim-coloured for Saracens from age 2, wall-coloured otherwise.
export function islamicSlots(civ, age) {
  if (!PALETTES[civ]) throw new Error('islamic kit pieces need recipe.civ to be one of ' + Object.keys(PALETTES).join(', ') + ' (got ' + civ + ')');
  const P = PALETTES[civ][Math.min(PALETTES[civ].length - 1, Math.max(0, age))];
  const band = civ === 'saracens' && age >= 2 ? P.trim : P.wall;
  const out = { wall: P.wall, stone: P.stone, trim: P.trim, roof: P.roof, dome: P.dome, accent: P.accent, band, ...FIXED };
  for (const k of Object.keys(out)) out[k] = shade(out[k], SHADE);
  return out;
}

export const I = 'islamic';
export const ROT = { e: 0, s: -90, w: 180, n: 90 };
export const CYPRESS = { color: '#2f5a3a' };
export const HIDE = { color: '#b49a72' };   // the Kenney tent's own fabric renders pink; hide-coloured canvas suits a camp

// ring of wall pieces around a w x d block of cells from tile (x0, y0); feats: { s0: 'wall-door', e1: 'wall-window' }
export function ring(k, x0, y0, w, d, z = 0, feats = {}, base = 'wall') {
  const pick = (side, i) => feats[side + i] || base;
  for (let i = 0; i < w; i++) { k.add(I, pick('n', i), x0 + i + 0.5, y0 + 0.5, z, ROT.n); k.add(I, pick('s', i), x0 + i + 0.5, y0 + d - 0.5, z, ROT.s); }
  for (let j = 0; j < d; j++) { k.add(I, pick('w', j), x0 + 0.5, y0 + j + 0.5, z, ROT.w); k.add(I, pick('e', j), x0 + w - 0.5, y0 + j + 0.5, z, ROT.e); }
}
// flat roof over the block, optionally edged with a parapet piece along every outer cell edge
export function roof(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
// a crowning piece standing at (x, y, z), optionally topped by the crescent finial
export function crown(k, piece, x, y, z, s = 1, alem = false) {
  k.add(I, piece, x, y, z, 0, s);
  if (alem) k.add(I, 'alem', x, y, z + TOP[piece] * s, 0, Math.max(1, s * 0.8));
}
// arcaded portico along the south side of a 1-cell-deep row, roofed at storey 1
export function portico(k, x0, y0, w, domes, edge = null) {
  for (let i = 0; i < w; i++) k.add(I, 'wall-arcade', x0 + i + 0.5, y0 + 0.5, 0, ROT.s);
  k.add(I, 'wall-arcade', x0 + w - 0.5, y0 + 0.5, 0, ROT.e);
  k.add(I, 'wall-arcade', x0 + 0.5, y0 + 0.5, 0, ROT.w);
  roof(k, x0, y0, w, 1, 1, edge);
  if (domes) for (let i = 0; i < w; i++) crown(k, domes, x0 + i + 0.5, y0 + 0.5, 1.06, 0.55);
}
```

- [ ] **Step 4: Write** `tools/art/turks-recipes.mjs`

  The 3 existing Turks recipes, rewritten as era builders that make exactly the same placements.

```js
// Turks building recipes: one builder per architectural era and building type, assembled from the Islamic kit
// (see islamic-kit.mjs) plus a few Kenney props. kenney-recipes.js merges TURKS_RECIPES into RECIPES.
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico } from './islamic-kit.mjs';

// The architectural era of each Turkish age.
export const ERA = ['seljuk', 'seljuk', 'ottoman', 'ottoman', 'tanzimat', 'republican'];
// Ages each building is baked for: only ages it can exist in (BUILDINGS[type].age), with fixed sets for tower,
// well, castle and outpost (see docs/superpowers/specs/2026-10-17-turks-building-set-design.md).
// A recipe bakes those of its ages whose era has a builder below.
const AGES = {
  house: [0, 1, 2, 3, 4, 5], tc: [0, 1, 2, 3, 4, 5], monastery: [2, 3, 4, 5],
  mill: [0, 1, 2, 3, 4, 5], lumbercamp: [0, 1, 2, 3, 4, 5], miningcamp: [0, 1, 2, 3, 4, 5], dock: [0, 1, 2, 3, 4, 5],
  barracks: [0, 1, 2, 3, 4, 5], market: [1, 2, 3, 4, 5], blacksmith: [1, 2, 3, 4, 5], range: [1, 2, 3, 4, 5],
  stable: [1, 2, 3, 4, 5], university: [2, 3, 4, 5], siege: [2, 3, 4, 5], tower: [1, 2, 3, 4, 5],
  well: [0, 2, 4, 5], castle: [2, 4, 5], outpost: [0, 4, 5],
};
// Footprint and stature as in the shared Kenney recipes: [size, scale, sq]
const FORM = {
  house: [2, 0.72, 0.80], tc: [4, 1.06, 1.02], monastery: [3, 1.02, 1.02],
  mill: [2, 0.82, 0.94], lumbercamp: [2, 0.70, 0.76], miningcamp: [2, 0.70, 0.76], dock: [3, 0.92, 0.86],
  barracks: [3, 0.98, 0.94], market: [3, 0.88, 0.84], blacksmith: [3, 0.84, 0.84], range: [3, 0.88, 0.84],
  stable: [3, 0.90, 0.84], university: [3, 1.02, 0.98], siege: [3, 0.98, 0.94], tower: [1, 0.84, 0.96],
  well: [1, 0.70, 0.78], castle: [4, 1.12, 1.06], outpost: [1, 0.72, 0.84],
};

const SELJUK = {}, OTTOMAN = {}, TANZIMAT = {}, REPUBLICAN = {};

// ---- house: Seljuk stone dwelling (ages 0-1), Ottoman konak (ages 2-3) ----
SELJUK.house = k => {
  ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  // flat roof; a roof room from age 1
  roof(k, 0.1, 0.1, 2, 2, 1);
  if (k.style === 1) { ring(k, 0.1, 0.1, 1, 1, 1.06, { s0: 'wall-window', e0: 'wall-window' }); roof(k, 0.1, 0.1, 1, 1, 2.06); }
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};
OTTOMAN.house = k => {
  ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  // timber-framed upper floor, projecting cumba bay, wide hipped roof
  ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-timber');
  k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
  if (k.style === 3) k.add(I, 'bay-cumba', 1.6, 1.1, 1, ROT.e);
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 1, 2]);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};

// ---- tc: Seljuk caravanserai (ages 0-1), Ottoman Divan (ages 2-3) ----
SELJUK.tc = k => {
  // walled stone court behind a tall tiled portal, with a kümbet tower
  ring(k, 0.5, 0.5, 3, 3, 0, { e0: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
  roof(k, 0.5, 0.5, 3, 3, 1, 'merlon-pointed');
  k.add(I, 'portal', 2, 3, 0, ROT.s);
  crown(k, 'kumbet', 1, 1, 1.06, 0.9);
  if (k.style === 1) crown(k, 'dome-lead', 2.4, 1.6, 1.06, 1.1);
  k.add('nature', 'tent_detailedOpen', 3.7, 3.7, 0, -30, 0.5, HIDE);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};
OTTOMAN.tc = k => {
  // two-storey hall behind a domed portico, stepped domes up to a central dome with an alem
  ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
  ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
  roof(k, 0.5, 0.5, 3, 2, 2);
  crown(k, 'dome-lead', 2, 1.5, 2.06, k.style === 3 ? 2.3 : 2.1, true);
  for (const x of [0.95, 3.05]) crown(k, 'dome-lead', x, 1.5, 2.06, 0.8);
  portico(k, 0.5, 2.5, 3, 'dome-lead');
  k.add('town', 'fountain-round', 0.3, 3.75, 0, 0, 0.3);
  if (k.style === 3) k.add('nature', 'tree_cone', 3.75, 3.75, 0, 0, 0.9, CYPRESS);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};

// ---- monastery: Seljuk Gök Medrese (age 2), Ottoman mosque (age 3) ----
OTTOMAN.monastery = k => {
  if (k.style === 2) {
    // stone court, tiled portal flanked by twin minarets, domed hall
    ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
    roof(k, 0, 0, 3, 3, 1, 'merlon-pointed');
    k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
    for (const x of [1.1, 1.9]) crown(k, 'minaret-pencil', x, 2.97, TOP.portal, 0.55);
    crown(k, 'dome-lead', 1.5, 1.1, 1.06, 1.3, true);
  } else {
    // prayer hall under a great dome with corner domes, domed portico, pencil minaret
    ring(k, 0.5, 0, 2, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
    ring(k, 0.5, 0, 2, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-window' });
    roof(k, 0.5, 0, 2, 2, 2);
    crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
    for (const [x, y] of [[0.95, 0.45], [2.05, 0.45], [0.95, 1.55], [2.05, 1.55]]) crown(k, 'dome-lead', x, y, 2.06, 0.6);
    portico(k, 0.5, 2, 2, 'dome-lead');
    crown(k, 'minaret-pencil', 2.75, 0.25, 0, 1.15);
  }
};

// ---- recipes (keep last) ----
const BUILDERS = { seljuk: SELJUK, ottoman: OTTOMAN, tanzimat: TANZIMAT, republican: REPUBLICAN };
export const TURKS_RECIPES = {};
for (const [type, [size, scale, sq]] of Object.entries(FORM)) {
  const styles = AGES[type].filter(a => BUILDERS[ERA[a]][type]);
  if (styles.length) TURKS_RECIPES[type + '_turks'] = { civ: 'turks', size, styles, scale, sq, build(k) { BUILDERS[ERA[k.style]][type](k); } };
}
```

- [ ] **Step 5: Write** `tools/art/saracens-recipes.mjs`

  The 3 Saracen recipes, moved verbatim.

```js
// Saracens building recipes, assembled from the Islamic kit (see islamic-kit.mjs) plus a few Kenney props.
// kenney-recipes.js merges SARACENS_RECIPES into RECIPES.
import { I, ROT, HIDE, ring, roof, crown, portico } from './islamic-kit.mjs';

export const SARACENS_RECIPES = {
  house_saracens: { civ: 'saracens', size: 2, styles: [0, 1, 2, 3], scale: 0.72, sq: 0.80, build(k) {
    // sandstone courtyard house behind stepped merlons; windcatcher from age 1, upper floor with mashrabiya from age 2
    ring(k, 0.1, 0.1, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
    if (k.style <= 1) {
      roof(k, 0.1, 0.1, 2, 2, 1, 'merlon-stepped');
      if (k.style === 1) k.add(I, 'malqaf', 0.6, 0.6, 1.06);
    } else {
      ring(k, 0.1, 0.1, 2, 2, 1, { s0: 'wall-window', e1: 'wall-window' });
      k.add(I, 'mashrabiya', 1.6, 1.6, 1, ROT.s);
      if (k.style === 3) k.add(I, 'mashrabiya', 1.6, 0.6, 1, ROT.e);
      roof(k, 0.1, 0.1, 2, 2, 2, 'merlon-stepped');
      k.add(I, 'malqaf', 0.6, 0.6, 2.06);
    }
    k.add('nature', 'tree_palm', 2.3, 0.4, 0, 20, 0.55);
  } },
  tc_saracens: { civ: 'saracens', size: 4, styles: [0, 1, 2, 3], scale: 1.06, sq: 1.02, build(k) {
    const tall = k.style >= 2, top = tall ? 2 : 1;
    ring(k, 0.5, 0.5, 3, 2, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window', e1: 'wall-door' });
    if (tall) ring(k, 0.5, 0.5, 3, 2, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
    roof(k, 0.5, 0.5, 3, 2, top, 'merlon-stepped');
    if (k.style === 0) {
      // mud-brick compound: walled hall, shade tent and palms
      k.add('nature', 'tent_detailedOpen', 1.6, 3.3, 0, 0, 0.7, HIDE);
    } else {
      // Dar al-Imara: horseshoe-arcaded portico before a hall under a pointed ribbed dome
      crown(k, 'dome-ribbed', 2, 1.5, top + 0.06, tall ? 1.7 : 1.3);
      portico(k, 0.5, 2.5, 3, null, 'merlon-stepped');
      if (k.style === 3) crown(k, 'minaret-square', 0.8, 0.8, top + 0.06, 0.6);
    }
    k.add('nature', 'tree_palm', 3.75, 0.4, 0, 0, 0.8);
    k.add('nature', 'tree_palmBend', 3.8, 2.2, 0, 20, 0.75);
  } },
  monastery_saracens: { civ: 'saracens', size: 3, styles: [2, 3], scale: 1.02, sq: 1.02, build(k) {
    // courtyard mosque: arcaded front, prayer hall under a pointed ribbed dome, square tiered minaret
    ring(k, 0, 0, 3, 2, 0, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s1: 'wall-door', s2: 'wall-window' });
    ring(k, 0, 0, 3, 2, 1, { e0: 'wall-window', e1: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
    roof(k, 0, 0, 3, 2, 2, 'merlon-stepped');
    crown(k, 'dome-ribbed', 1.5, 0.95, 2.06, k.style === 3 ? 1.6 : 1.3);
    if (k.style === 3) for (const x of [0.55, 2.45]) crown(k, 'dome-ribbed', x, 0.95, 2.06, 0.6);
    portico(k, 0, 2, 2, null, 'merlon-stepped');
    crown(k, 'minaret-square', 2.5, 2.5, 0, 1.15);
  } },
};
```

- [ ] **Step 6: Wire the modules in and delete the old file**

  `git rm tools/art/islamic-recipes.js`

  In `tools/art/kenney-recipes.js`, replace line 1:

```js
import { ISLAMIC_RECIPES } from './islamic-recipes.js';
```

  with:

```js
import { TURKS_RECIPES } from './turks-recipes.mjs';
import { SARACENS_RECIPES } from './saracens-recipes.mjs';
```

  and replace the last line, `Object.assign(RECIPES, ISLAMIC_RECIPES);`, with:

```js
Object.assign(RECIPES, TURKS_RECIPES, SARACENS_RECIPES);
```

  In `tools/art/kenney-bake.html`, replace:

```js
import { islamicSlots } from './islamic-recipes.js';
```

  with:

```js
import { islamicSlots } from './islamic-kit.mjs';
```

  In `tools/art/bake-kenney.mjs` line 20 (`const mime = {`), replace `'.js': 'text/javascript',` with:

```js
'.js': 'text/javascript', '.mjs': 'text/javascript',
```

- [ ] **Step 7: Update the two docs that name the deleted file**

  - In `assets/original/islamic/README.md`, replace `from \`tools/art/islamic-recipes.js\`.` with `from \`tools/art/islamic-kit.mjs\`, for the recipes in \`tools/art/turks-recipes.mjs\` and \`tools/art/saracens-recipes.mjs\`.`
  - In `docs/ASSET_PLAN.md` line 30, replace `` `tools/art/islamic-recipes.js` assembles `` with `` `tools/art/turks-recipes.mjs` and `tools/art/saracens-recipes.mjs` (shared parts in `tools/art/islamic-kit.mjs`) assemble ``.

- [ ] **Step 8: Run the test to verify it passes**

  Run: `node tests/islamic-art.test.js`

  Expected: `13 passed, 0 failed`.

- [ ] **Step 9: Prove the split is neutral by re-baking all 20 Islamic sprites**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --recipes house_turks,tc_turks,monastery_turks,house_saracens,tc_saracens,monastery_saracens
  git diff --stat -- game/art/kenney
  ```

  Expected: `baked 20 sprites ... (merged: manifest has 129)`, and the diff prints **nothing**: the PNGs and the manifest content are byte-identical.

- [ ] **Step 10: Run the suites and commit**

  ```bash
  npm run test:syntax && npm run test:quick
  git add -A tools/art tests/islamic-art.test.js assets/original/islamic/README.md docs/ASSET_PLAN.md
  git commit -m "refactor(art): split Islamic recipes into islamic-kit, turks and saracens modules"
  ```

---

### Task 3: Load civ sprites on demand

**Files:**
- Modify: `game/js/art_kenney.js:1-33` (the loader block)
- Modify: `game/js/civ_art.js` (section D, start of the `KART.on` branch)
- Modify: `tests/browser/art.spec.js`, `tests/browser/islamic-art.spec.js`, `tests/browser/actors.spec.js`

**Interfaces:**
- Produces, used by every later browser test:
  - `kartCiv(key) → string | null`
  - `KART.loadCiv(civ) → Promise<void>` (one per civ, cached)
  - `KART.requested` (Set of keys asked for)
  - `KART.civs` (Map civ → Promise)
  - `KART.booted` (true once the shared sprites have been requested)

- [ ] **Step 1: Write the failing test**

  Append to `tests/browser/art.spec.js`:

```js
test('civilization building sprites load on demand and refresh caches at most once per frame', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  const r = await page.evaluate(async () => {
    const turks = Object.keys(KENNEY_ART).filter(k => kartCiv(k) === 'turks');
    const before = turks.filter(k => KART.requested.has(k)).length;
    const clear = R.spriteCache.clear.bind(R.spriteCache);
    let clears = 0;
    R.spriteCache.clear = () => { clears++; return clear(); };
    try {
      const first = KART.loadCiv('turks'), again = KART.loadCiv('turks');
      await first;
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      return {
        total: turks.length, before, same: first === again, loaded: turks.filter(k => KART.img[k]).length, clears,
        shared: kartCiv('tree_anatolian_0'), civ: kartCiv('castle_turks_2'),
      };
    } finally { delete R.spriteCache.clear; }
  });
  expect(r.total).toBeGreaterThan(0);
  expect(r.before).toBe(0);              // nothing of the Turks set is fetched at startup
  expect(r.same).toBe(true);
  expect(r.loaded).toBe(r.total);
  expect(r.clears).toBeGreaterThan(0);
  expect(r.clears).toBeLessThan(r.total); // one cache refresh per frame, not per image
  expect(r.shared).toBeNull();
  expect(r.civ).toBe('turks');
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js -g "load on demand" --reporter=line`

  Expected: FAIL with `kartCiv is not defined`.

- [ ] **Step 3: Replace the loader**

  In `game/js/art_kenney.js`, replace everything from the first line through the first `})();` (the loader IIFE, lines 1–33) with:

```js
// ===== Default art style: Kenney CC0 kits, pre-rendered by tools/art/bake-kenney.mjs =====
// ?art=classic restores drawn art; valid choices are remembered in this browser.
// Local sprites load progressively, with drawn art as the fallback for missing assets. Shared sprites load at
// startup; a civilization's own building set (house_turks_2 ...) loads the first time that civ is drawn.
'use strict';
const KART = { on: false, img: {}, cache: new Map(), base: 'art/kenney/', revision: 0, failed: [], requested: new Set(), civs: new Map(), booted: false };
// the civilization a sprite key belongs to (house_turks_2 -> 'turks'), or null for shared sprites (tree_anatolian_0)
function kartCiv(k) {
  const m = /^.+_([a-z]+)_\d+$/.exec(k);
  return m && typeof CIVS === 'object' && Object.prototype.hasOwnProperty.call(CIVS, m[1]) ? m[1] : null;
}
(function () {
  let v = null;
  const valid = value => value === 'kenney' || value === 'classic';
  try { v = new URLSearchParams(location.search).get('art'); } catch (e) { /* headless */ }
  try { if (valid(v)) localStorage.setItem('aor.art', v); else v = localStorage.getItem('aor.art'); } catch (e) { /* storage blocked */ }
  KART.on = v !== 'classic' && typeof KENNEY_ART === 'object' && typeof Image === 'function';
  if (!KART.on) return;
  // Portraits, cached building canvases and HD unit sprites may have used the drawn fallback while sprites load.
  // Refresh them at most once per frame, however many images finish in it.
  let refreshQueued = false;
  const refresh = () => {
    refreshQueued = false;
    if (typeof R !== 'undefined' && R.spriteCache) R.spriteCache.clear();
    if (typeof UHD !== 'undefined' && UHD.cache) { UHD.cache.clear(); UHD.sets.clear(); UHD.bytes = 0; }
    if (typeof ICONS !== 'undefined') ICONS.clear();
    if (typeof UI !== 'undefined') UI.panelKey = '';
    const box = document.getElementById('selinfo');
    if (box) box.dataset.multiKey = '';
  };
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(refresh);
  };
  // fetch each sprite once; resolves when every one of these keys has loaded or failed
  const request = keys => Promise.all(keys.filter(k => !KART.requested.has(k)).map(k => new Promise(done => {
    KART.requested.add(k);
    const im = new Image();
    im.onload = () => { KART.img[k] = im; KART.revision++; queueRefresh(); done(); };
    im.onerror = () => { KART.failed.push(k); done(); };
    im.src = KART.base + k + '.png';
  })));
  let boot;
  const booted = new Promise(resolve => { boot = resolve; });
  // a civilization's own building set: requested once, after startup; repeat calls return the same promise
  KART.loadCiv = civ => {
    if (!KART.civs.has(civ)) KART.civs.set(civ, booted.then(() => request(Object.keys(KENNEY_ART).filter(k => kartCiv(k) === civ))).then(() => undefined));
    return KART.civs.get(civ);
  };
  const load = () => {
    request(Object.keys(KENNEY_ART).filter(k => kartCiv(k) === null));
    KART.booted = true;
    boot();
  };
  // Start after the page has booted so a slow image cannot hold up the main loop's load handler.
  if (typeof window !== 'undefined' && document.readyState !== 'complete') window.addEventListener('load', load, { once: true });
  else load();
})();
```

- [ ] **Step 4: Load a civ's set the first time it is drawn**

  In `game/js/civ_art.js` section D, replace:

```js
      if (typeof KART !== 'undefined' && KART.on) {
        // Cultural hero sprite selection
```

  with:

```js
      if (typeof KART !== 'undefined' && KART.on) {
        // a civilization's own building set is fetched the first time that civ is drawn
        if (!KART.civs.has(civ)) KART.loadCiv(civ);
        // Cultural hero sprite selection
```

- [ ] **Step 5: Make the other browser tests wait for what was requested**

  In `tests/browser/art.spec.js`, replace:

```js
const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && Object.keys(KART.img).length + KART.failed.length === Object.keys(KENNEY_ART).length);
```

  with:

```js
const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && KART.booted && Object.keys(KART.img).length + KART.failed.length === KART.requested.size);
```

  In `tests/browser/islamic-art.spec.js`, replace:

```js
const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && Object.keys(KART.img).length + KART.failed.length === Object.keys(KENNEY_ART).length);
```

  with:

```js
const waitForArt = page => page.waitForFunction(() => typeof KART !== 'undefined' && KART.on && KART.booted && Object.keys(KART.img).length + KART.failed.length === KART.requested.size);
```

  In `tests/browser/art.spec.js`, replace:

```js
  expect(await page.evaluate(() => KART.failed.length)).toBe(await page.evaluate(() => Object.keys(KENNEY_ART).filter(k => /^(tc|farm)_/.test(k)).length));
```

  with:

```js
  expect(await page.evaluate(() => KART.failed.filter(k => kartCiv(k) === null).length)).toBe(await page.evaluate(() => Object.keys(KENNEY_ART).filter(k => /^(tc|farm)_/.test(k) && kartCiv(k) === null).length));
```

  In `tests/browser/art.spec.js`, replace:

```js
    await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 && Object.keys(KART.img).length === Object.keys(KENNEY_ART).length - 1);
```

  with:

```js
    await page.waitForFunction(() => window.__game?.T25D.stats.frames > 1 && KART.booted && Object.keys(KART.img).length === KART.requested.size - 1);
```

  In `tests/browser/art.spec.js`, replace (both occurrences):

```js
  await page.evaluate(drawProbe);
```

  with:

```js
  await page.evaluate(() => KART.loadCiv('turks'));
  await page.evaluate(drawProbe);
```

  In `tests/browser/islamic-art.spec.js`, replace:

```js
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(age => {
```

  with:

```js
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  await page.evaluate(age => {
```

  In `tests/browser/actors.spec.js`, replace:

```js
Object.keys(KART.img).length===Object.keys(KENNEY_ART).length
```

  with:

```js
KART.booted&&Object.keys(KART.img).length+KART.failed.length===KART.requested.size
```


- [ ] **Step 6: Run the browser specs to verify everything passes**

  ```bash
  npm run test:syntax
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js tests/browser/islamic-art.spec.js tests/browser/actors.spec.js --reporter=line
  git checkout -- assets/screenshots
  ```

  Expected: all of these specs pass, 15 tests. `git checkout` restores any showcase screenshots the actors spec rewrote.

- [ ] **Step 7: Run the quick suite and commit**

  ```bash
  npm run test:quick
  git add game/js/art_kenney.js game/js/civ_art.js tests/browser
  git commit -m "perf(game): load civilization building sprites on demand, refresh caches once per frame"
  ```

---

### Task 4: Kit pieces for ages 0–3

**Files:**
- Modify: `tools/art/blender/kitlib.py` (`SLOTS`; three `Piece` methods after `prism`)
- Modify: `tools/art/blender/islamic_kit.py` (14 builders before `PIECES = {`; 14 entries in `PIECES`)
- Create (generated): 14 GLBs in `assets/original/islamic/`
- Modify: `tools/art/islamic-kit.mjs` (`FIXED`, `TOP`)
- Modify: `tests/islamic-art.test.js` (`SLOTS`, `PIECES`)

**Interfaces:**
- Produces:
  - `Piece.slab_xz(slot, pts_xz, y0, y1)`, `Piece.cyl_x(slot, r0, r1, n, x0, x1, cy=0, cz=0)`, `Piece.cyl_y(slot, r, n, y0, y1, cx=0, cz=0)`
  - Pieces: `tower-round`, `asbad`, `kiosk`, `lookout`, `jetty`, `crane`, `cannon`, `rack-shields`, `target`, `forge`, `sextant`, `tug`, `awning`, `chimney`
  - `TOP` heights: `tower-round` 2.31, `asbad` 1.67, `kiosk` 1.1, `lookout` 2.16
  - `FIXED.wood` and `FIXED.metal`

- [ ] **Step 1: Extend the test**

  In `tests/islamic-art.test.js`, replace the `SLOTS` line:

```js
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark'];
```

  with:

```js
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark', 'wood', 'metal'];
```

  Replace the last line of `PIECES`:

```js
  'dome-lead', 'dome-ribbed', 'kumbet', 'minaret-pencil', 'minaret-square', 'portal', 'bay-cumba', 'alem', 'malqaf', 'mashrabiya'];
```

  with:

```js
  'dome-lead', 'dome-ribbed', 'kumbet', 'minaret-pencil', 'minaret-square', 'portal', 'bay-cumba', 'alem', 'malqaf', 'mashrabiya',
  'tower-round', 'asbad', 'kiosk', 'lookout', 'jetty', 'crane', 'cannon', 'rack-shields', 'target', 'forge', 'sextant', 'tug', 'awning', 'chimney'];
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `node tests/islamic-art.test.js`

  Expected: `FAIL the kit holds every piece` with `tower-round.glb missing`.

- [ ] **Step 3: Extend `kitlib.py`**

  Replace the `SLOTS` closing lines:

```python
    'accent': '#c83028', 'band': '#288290', 'gold': '#e8c040', 'dark': '#2a2420',
}
```

  with (preview colours for the new fixed slots):

```python
    'accent': '#c83028', 'band': '#288290', 'gold': '#e8c040', 'dark': '#2a2420',
    'wood': '#6b4a2b', 'metal': '#4a4640', 'brick': '#9a4a32',
}
```

  Directly after the `prism` method of `Piece`, add:

```python
    def slab_xz(self, slot, pts, y0, y1):
        """Extrude a closed (x, z) outline along y from y0 to y1."""
        i, n = self._mat(slot), len(pts)
        a = [self.bm.verts.new((x, y0, z)) for x, z in pts]
        b = [self.bm.verts.new((x, y1, z)) for x, z in pts]
        self.bm.faces.new(a).material_index = i
        self.bm.faces.new(b[::-1]).material_index = i
        for k in range(n):
            self.bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])).material_index = i

    def _tube(self, slot, ring_a, ring_b):
        i, n = self._mat(slot), len(ring_a)
        self.bm.faces.new(ring_a[::-1]).material_index = i
        self.bm.faces.new(ring_b).material_index = i
        for k in range(n):
            self.bm.faces.new((ring_a[k], ring_a[(k + 1) % n], ring_b[(k + 1) % n], ring_b[k])).material_index = i

    def cyl_x(self, slot, r0, r1, n, x0, x1, cy=0.0, cz=0.0):
        """Cylinder (or tapered barrel) lying along x, radius r0 at x0 and r1 at x1."""
        ring = lambda x, r: [self.bm.verts.new((x, cy + r * math.cos(2 * math.pi * k / n), cz + r * math.sin(2 * math.pi * k / n))) for k in range(n)]
        self._tube(slot, ring(x0, r0), ring(x1, r1))

    def cyl_y(self, slot, r, n, y0, y1, cx=0.0, cz=0.0):
        """Cylinder lying along y (wheels, discs facing the camera's -y side) from y0 to y1."""
        ring = lambda y: [self.bm.verts.new((cx + r * math.cos(2 * math.pi * k / n), y, cz + r * math.sin(2 * math.pi * k / n))) for k in range(n)]
        self._tube(slot, ring(y0), ring(y1))
```

- [ ] **Step 4: Add the 14 pieces to `islamic_kit.py`**

  Insert this block directly before the line `PIECES = {` (after `piece_mashrabiya`):

```python
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
```

  In `PIECES`, replace:

```python
    'malqaf': piece_malqaf, 'mashrabiya': piece_mashrabiya,
}
```

  with:

```python
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
```

- [ ] **Step 5: Teach the recipe module the new slots and heights**

  In `tools/art/islamic-kit.mjs`, replace:

```js
export const FIXED = { gold: '#e8c040', dark: '#2a2420' };
```

  with:

```js
export const FIXED = { gold: '#e8c040', dark: '#2a2420', wood: '#6b4a2b', metal: '#4a4640' };
```

  Replace:

```js
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76 };
```

  with:

```js
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76,
  'tower-round': 2.31, 'asbad': 1.67, 'kiosk': 1.1, 'lookout': 2.16 };
```

- [ ] **Step 6: Export, test, and look at the pieces (main session)**

  Run `npm run art:kit`, then `node tests/islamic-art.test.js`.

  Expected:
  - 33 `wrote` lines
  - `git diff --stat -- assets/original/islamic` prints nothing, since the 19 old pieces are unchanged
  - `13 passed, 0 failed`

  Then, in the live Blender (MCP add-on running), use `mcp__blender__execute_blender_code`:

```python
import runpy
ns = runpy.run_path(r"G:\GitHub\age-of-realms-mod\tools\art\blender\islamic_kit.py", run_name="kit")
col = ns['preview'](['tower-round', 'asbad', 'kiosk', 'lookout', 'jetty', 'crane', 'cannon', 'rack-shields', 'target', 'forge', 'sextant', 'tug', 'awning', 'chimney'], spacing=1.5)
```

  Then call `mcp__blender__look` with `mode: "angles"`, `views: [[0.61, -0.61, 0.5]]`, `shading: "material"` and `target` set to the 14 names. Check that each piece is intact and reads as named.

  Remove the preview:

```python
import bpy
col = bpy.data.collections.get('kit-preview')
if col:
    meshes = [o.data for o in col.objects]
    for o in list(col.objects): bpy.data.objects.remove(o)
    bpy.data.collections.remove(col)
    for m in meshes:
        if m.users == 0: bpy.data.meshes.remove(m)
```

- [ ] **Step 7: Commit**

  ```bash
  npm run test:quick
  git add tools/art/blender assets/original/islamic tools/art/islamic-kit.mjs tests/islamic-art.test.js
  git commit -m "feat(art): Islamic kit pieces for Turkish ages 0-3 (round tower, asbad, kiosk, jetty, props)"
  ```

---

### Task 5: Review point 1 — castle, market, dock, university (user gate)

**Files:**
- Modify: `tools/art/islamic-kit.mjs` (append `lowWall`, `courtyard`)
- Modify: `tools/art/turks-recipes.mjs` (import line; 4 builder groups before the recipes marker)
- Create (generated): 10 PNGs; Modify: `game/art/kenney/manifest.js`
- Modify: `tests/islamic-art.test.js` (`TURKS_BAKED`)

**Interfaces:**
- Consumes: Task 4's pieces.
- Produces:
  - `lowWall(k, x0, y0, w, d, h = 0.45, base = 'wall')`
  - `courtyard(k, x0, y0, w, d, z, edge = null)`
  - Sprites: `castle_turks_2`, `market_turks_1..3`, `dock_turks_0..3`, `university_turks_2..3`

- [ ] **Step 1: Pin the new keys in the test**

  In `tests/islamic-art.test.js`, replace the `TURKS_BAKED` declaration with:

```js
const TURKS_BAKED = {
  house: [0, 1, 2, 3], tc: [0, 1, 2, 3], monastery: [2, 3], castle: [2], market: [1, 2, 3],
  dock: [0, 1, 2, 3], university: [2, 3],
};
```

  Then run `node tests/islamic-art.test.js`. Expected: `FAIL the recipes bake exactly the expected sprites`.

- [ ] **Step 2: Add the helpers**

  Append to `tools/art/islamic-kit.mjs`:

```js
// low walls (courtyards, yards, paddocks) around a w x d block: wall pieces scaled to height h
export function lowWall(k, x0, y0, w, d, h = 0.45, base = 'wall') {
  const s = [1, h, 1];
  for (let i = 0; i < w; i++) { k.add(I, base, x0 + i + 0.5, y0 + 0.5, 0, ROT.n, s); k.add(I, base, x0 + i + 0.5, y0 + d - 0.5, 0, ROT.s, s); }
  for (let j = 0; j < d; j++) { k.add(I, base, x0 + 0.5, y0 + j + 0.5, 0, ROT.w, s); k.add(I, base, x0 + w - 0.5, y0 + j + 0.5, 0, ROT.e, s); }
}
// flat roof over the outer ring of cells of a block, leaving its courtyard open; optional parapet as in roof()
export function courtyard(k, x0, y0, w, d, z, edge = null) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (i === 0 || j === 0 || i === w - 1 || j === d - 1) k.add(I, 'roof-flat', x0 + i + 0.5, y0 + j + 0.5, z);
  if (edge) ring(k, x0, y0, w, d, z + 0.06, {}, edge);
}
```

- [ ] **Step 3: Add the builders**

  In `tools/art/turks-recipes.mjs`, replace the import line:

```js
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico } from './islamic-kit.mjs';
```

  with:

```js
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico, lowWall, courtyard } from './islamic-kit.mjs';
```

  Insert this block directly before `// ---- recipes (keep last) ----`:

```js
// ---- castle: Rumeli Hisarı-style fortress (age 2) ----
OTTOMAN.castle = k => {
  // two-storey curtain walls with pointed merlons, a gate portal, round cannon towers with lead cones and alems
  ring(k, 0, 0, 4, 4, 0);
  ring(k, 0, 0, 4, 4, 1);
  ring(k, 0, 0, 4, 4, 2, {}, 'merlon-pointed');
  k.add(I, 'portal', 1.5, 3.5, 0, ROT.s);
  for (const [x, y, s] of [[0.5, 0.5, 1.25], [3.5, 0.5, 1.25], [0.5, 3.5, 1.1], [3.5, 3.5, 1.4]]) crown(k, 'tower-round', x, y, 0, s, true);
};

// ---- market: covered bazaar (age 1), bedesten under rows of small lead domes (ages 2-3) ----
SELJUK.market = k => {
  // open arcaded hall behind a row of stalls
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-arcade');
  roof(k, 0, 0, 3, 2, 1, 'merlon-pointed');
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};
OTTOMAN.market = k => {
  ring(k, 0, 0, 3, 2, 0, { s0: 'wall-door', s1: 'wall-window', s2: 'wall-door', e0: 'wall-window', e1: 'wall-door' });
  roof(k, 0, 0, 3, 2, 1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) crown(k, 'dome-lead', i + 0.5, j + 0.5, 1.06, 0.6, k.style === 3 && i === 1 && j === 0);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};

// ---- dock: timber jetty (ages 0-1), arched stone tersane with a domed beacon (ages 2-3) ----
SELJUK.dock = k => {
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 1.5, 0);
  k.add(I, 'jetty', 2.5, 2.5, 0);
  ring(k, 0, 0, 1, 1, 0, { s0: 'wall-door' });
  roof(k, 0, 0, 1, 1, 1);
  if (k.style === 1) k.add(I, 'crane', 2.5, 0.6, 0, 0, 0.8);
};
OTTOMAN.dock = k => {
  // vaulted shipyard galleries open to the water, harbour beacon tower, crane and jetty
  ring(k, 0, 0, 2, 1, 0, { s0: 'wall-arcade', s1: 'wall-arcade', e0: 'wall-arcade' });
  roof(k, 0, 0, 2, 1, 1);
  for (const x of [0.5, 1.5]) crown(k, 'dome-lead', x, 0.5, 1.06, 0.6);
  crown(k, 'tower-round', 2.5, 0.5, 0, 0.6, true);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 2.2, 0);
  k.add(I, 'crane', 1.5, 1.4, 0, 0, 0.8);
  if (k.style === 3) k.add(I, 'cannon', 2.6, 1.5, 0, 0, 0.8);
};

// ---- university: madrasa and observatory (ages 2-3) ----
OTTOMAN.university = k => {
  // courtyard madrasa behind a grand iwan portal, domed lecture hall at the back, sextant in the court
  ring(k, 0, 0, 3, 3, 0, { e0: 'wall-window', e1: 'wall-window', e2: 'wall-window', s0: 'wall-window', s2: 'wall-window' });
  courtyard(k, 0, 0, 3, 3, 1, 'merlon-pointed');
  k.add(I, 'portal', 1.5, 2.5, 0, ROT.s);
  crown(k, 'dome-lead', 1.5, 0.5, 1.06, 1.0, true);
  k.add(I, 'sextant', 1.5, 1.5, 0, 0, 0.8);
  if (k.style === 3) crown(k, 'minaret-pencil', 2.75, 0.25, 0, 0.9);
};
```

  Then run `node tests/islamic-art.test.js`. Expected: only `every recipe style is baked into the manifest with its PNG` fails (`castle_turks_2 missing from manifest.js`).

- [ ] **Step 4: Preview and QA (main session)**

  Load the `create-game-assets` skill and apply its contact-sheet QA: silhouette at game scale, values against neighbours, palette, edges.

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview castle_turks,market_turks,dock_turks,university_turks,house_turks,tc_turks
  ```

  Open `tools/art/preview.png`. Fix clear defects in these four builders, such as floating or overlapping pieces, or props outside the footprint, and re-render.

- [ ] **Step 5: STOP — ask the user to approve (main session)**

  Show the user `tools/art/preview.png`. Describe each of the four new buildings per age, beside the approved Turks house and Town Center. Ask them to approve, or to say what to change. Iterate until they approve.

- [ ] **Step 6: Bake and check (main session)**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --recipes castle_turks,market_turks,dock_turks,university_turks
  ```

  Run the bake check. Expected: `baked 10 sprites ... (merged: manifest has 139)` and 10 new `*_turks_*` PNGs.

- [ ] **Step 7: Run the tests and commit**

  Run `node tests/islamic-art.test.js`. Expected: `13 passed, 0 failed`.

  ```bash
  npm run test:quick
  git add tools/art/islamic-kit.mjs tools/art/turks-recipes.mjs tests/islamic-art.test.js game/art/kenney
  git commit -m "feat(art): Turks castle, bazaar, shipyard and madrasa (approved at review point 1)"
  ```

---

### Task 6: A civilization's own castle comes before its family castle

**Files:**
- Modify: `game/js/civ_art.js` (section D sprite choice)
- Modify: `tests/browser/art.spec.js`

**Interfaces:**
- Consumes: `castle_turks_2` (Task 5), `KART.loadCiv` (Task 3), and the existing `drawProbe` helper in `art.spec.js`.
- Produces: the castle rule. Civ castle, else family castle (`castle_east`/`castle_med`/`castle_nordic`/`castle`), else the shared key.

- [ ] **Step 1: Write the failing test**

  Append to `tests/browser/art.spec.js`:

```js
test('a civilization with its own castle draws it before its family castle', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all(['turks', 'saracens', 'byzantines', 'franks'].map(civ => KART.loadCiv(civ))));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('castle', 2, 'turks'), turks3: drawProbe('castle', 3, 'turks'),
    saracens2: drawProbe('castle', 2, 'saracens'), byzantines2: drawProbe('castle', 2, 'byzantines'), franks2: drawProbe('castle', 2, 'franks'),
  }));
  expect(r.turks2).toEqual({ names: ['castle_turks_2'], domes: 0 });
  expect(r.turks3.names).toEqual(['castle_turks_2']);
  expect(r.saracens2.names).toEqual(['castle_med']);
  expect(r.byzantines2.names).toEqual(['castle_med']);
  expect(r.franks2.names).toEqual(['castle']);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js -g "own castle" --reporter=line`

  Expected: FAIL. `turks2.names` is `['castle_med']`.

- [ ] **Step 3: Implement**

  In `game/js/civ_art.js`, replace:

```js
        // Cultural hero sprite selection (e.g., castle_east, castle_med, castle_nordic)
        let name = null;
        if (type === 'castle') {
          const famKey = spec.family === 'east' ? 'castle_east' : (spec.family === 'islamic' || spec.family === 'byzantine') ? 'castle_med' : spec.family === 'nordic' ? 'castle_nordic' : 'castle';
          if (KART.img[famKey]) name = famKey;
        }
        // per-civilization building sets (e.g. house_turks_2) replace the shared sprite unless the shared one is
        // newer, so the dedicated Modern/Future Town Centers (tc_4, tc_5) still win over tc_turks_3
        const shared = kartKey(type, st), own = !name && civKartKey(type, civ, st);
        const civSet = own && (!shared || ageOf(own) >= ageOf(shared)) ? own : null;
        if (civSet) name = civSet;
        if (!name) name = shared;
```

  with:

```js
        // per-civilization building sets (e.g. house_turks_2, castle_turks_2) replace the shared sprite unless the
        // shared one is newer, so the dedicated Modern/Future Town Centers (tc_4, tc_5) still win over tc_saracens_3
        const shared = kartKey(type, st), own = civKartKey(type, civ, st);
        const civSet = own && (!shared || ageOf(own) >= ageOf(shared)) ? own : null;
        let name = civSet;
        // cultural hero castles (castle_east, castle_med, castle_nordic) for civs without a castle of their own
        if (!name && type === 'castle') {
          const famKey = spec.family === 'east' ? 'castle_east' : (spec.family === 'islamic' || spec.family === 'byzantine') ? 'castle_med' : spec.family === 'nordic' ? 'castle_nordic' : 'castle';
          if (KART.img[famKey]) name = famKey;
        }
        if (!name) name = shared;
```

- [ ] **Step 4: Run the art spec and commit**

  ```bash
  npm run test:syntax
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line
  git add game/js/civ_art.js tests/browser/art.spec.js
  git commit -m "feat(game): a civilization's own castle sprite wins over its family castle"
  ```

  Expected: all art.spec tests pass.

---

### Task 7: The other 11 types, ages 0–3

**Files:**
- Modify: `tools/art/turks-recipes.mjs` (builders before the recipes marker)
- Create (generated): 33 PNGs; Modify: `manifest.js`
- Modify: `tests/islamic-art.test.js` (`TURKS_BAKED`)

**Interfaces:**
- Consumes: `lowWall`, `courtyard` (Task 5), and the Task 4 pieces.
- Produces: `*_turks_*` sprites for mill, lumbercamp, miningcamp, barracks, blacksmith, range, stable, siege, tower, well, outpost (ages 0–3).

- [ ] **Step 1: Pin the keys**

  Replace the `TURKS_BAKED` declaration in `tests/islamic-art.test.js` with:

```js
const TURKS_BAKED = {
  house: [0, 1, 2, 3], tc: [0, 1, 2, 3], monastery: [2, 3], mill: [0, 1, 2, 3], lumbercamp: [0, 1, 2, 3],
  miningcamp: [0, 1, 2, 3], dock: [0, 1, 2, 3], barracks: [0, 1, 2, 3], market: [1, 2, 3],
  blacksmith: [1, 2, 3], range: [1, 2, 3], stable: [1, 2, 3], university: [2, 3], siege: [2, 3],
  tower: [1, 2, 3], well: [0, 2], castle: [2], outpost: [0],
};
```

  Run `node tests/islamic-art.test.js`. Expected: `FAIL the recipes bake exactly the expected sprites`.

- [ ] **Step 2: Add the builders**

  Insert directly before `// ---- recipes (keep last) ----` in `tools/art/turks-recipes.mjs`:

```js
// ---- mill: wind-tower mill (ages 0-1), with a domed granary (ages 2-3) ----
SELJUK.mill = k => {
  crown(k, 'asbad', 0.6, 0.6, 0, 1.05);
  ring(k, 1, 1, 1, 1, 0, { s0: 'wall-door' });
  roof(k, 1, 1, 1, 1, 1, 'merlon-pointed');
  if (k.style === 1) k.add('town', 'cart', 0.5, 1.75, 0, 90, 0.55);
};
OTTOMAN.mill = k => {
  crown(k, 'asbad', 0.6, 0.6, 0, 1.25);
  ring(k, 1, 1, 1, 1, 0, { s0: 'wall-door', e0: 'wall-window' });
  roof(k, 1, 1, 1, 1, 1);
  crown(k, 'dome-lead', 1.5, 1.5, 1.06, 0.75, k.style === 3);
  k.add('town', 'cart', 0.5, 1.75, 0, 90, 0.55);
};

// ---- lumbercamp: canvas-and-stone timber yard (ages 0-1), stone yard with a timber crane (ages 2-3) ----
SELJUK.lumbercamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.35);
  k.add('nature', 'tent_detailedOpen', 0.6, 0.6, 0, 0, 0.55, HIDE);
  k.add('nature', 'log_large', 1.35, 1.2, 0, 60, 0.9);
  k.add('nature', 'log', 1.1, 1.6, 0, 20, 1.1);
  if (k.style === 1) k.add('nature', 'stump_roundDetailed', 0.5, 1.5, 0, 0, 1.0);
};
OTTOMAN.lumbercamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.45);
  ring(k, 0.1, 0.1, 1, 1, 0, { s0: 'wall-arcade', e0: 'wall-arcade' });
  roof(k, 0.1, 0.1, 1, 1, 1);
  k.add(I, 'crane', 1.45, 0.55, 0, 0, 0.75);
  k.add('nature', 'log_large', 1.3, 1.35, 0, 60, 0.9);
  k.add('nature', 'log', 0.6, 1.55, 0, 10, 1.1);
};

// ---- miningcamp: quarry pithead with a hoist (ages 0-1), stone assay house with a domed smelter (ages 2-3) ----
SELJUK.miningcamp = k => {
  lowWall(k, 0, 0, 2, 2, 0.3);
  k.add(I, 'crane', 0.7, 0.7, 0, 0, 0.7);
  k.add('nature', 'stone_largeA', 1.3, 1.25, 0, 0, 0.8, { tint: '#a8a196' });
  k.add('nature', 'stone_smallB', 1.6, 0.6, 0, 30, 0.9, { tint: '#a8a196' });
  if (k.style === 1) k.add('town', 'cart', 0.6, 1.6, 0, 90, 0.55);
};
OTTOMAN.miningcamp = k => {
  ring(k, 0.1, 0.1, 1, 1, 0, { s0: 'wall-door', e0: 'wall-window' });
  roof(k, 0.1, 0.1, 1, 1, 1);
  crown(k, 'dome-lead', 0.6, 0.6, 1.06, 0.55);
  k.add(I, 'chimney', 0.9, 0.3, 1.06);
  k.add(I, 'crane', 1.5, 0.6, 0, 0, 0.75);
  k.add('nature', 'stone_largeA', 1.4, 1.4, 0, 0, 0.8, { tint: '#a8a196' });
  k.add('town', 'cart', 0.6, 1.65, 0, 90, 0.55);
};

// ---- barracks: walled drill yard (ages 0-1), Janissary barracks court (ages 2-3) ----
SELJUK.barracks = k => {
  lowWall(k, 0, 0, 3, 3, 0.45);
  ring(k, 0.2, 0.2, 2, 1, 0, { s0: 'wall-door', s1: 'wall-window', e0: 'wall-window' });
  roof(k, 0.2, 0.2, 2, 1, 1, 'merlon-pointed');
  k.add(I, 'rack-shields', 2.3, 1.2, 0, ROT.e);
  k.add(I, 'tug', 2.5, 2.4, 0);
  if (k.style === 1) k.add('nature', 'tent_detailedOpen', 0.9, 2.1, 0, 20, 0.5, HIDE);
};
OTTOMAN.barracks = k => {
  // two-storey barracks range behind a domed arcade, standards and a weapon rack in the yard
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-window', s1: 'wall-door', s2: 'wall-window', e0: 'wall-window' });
  ring(k, 0, 0, 3, 1, 1, { s0: 'wall-window', s1: 'wall-window', s2: 'wall-window', e0: 'wall-window' });
  roof(k, 0, 0, 3, 1, 2, 'merlon-pointed');
  portico(k, 0, 1, 3, 'dome-lead');
  for (const x of [0.4, 2.6]) k.add(I, 'tug', x, 2.6, 0);
  k.add(I, 'rack-shields', 1.6, 2.3, 0, ROT.s);
  if (k.style === 3) crown(k, 'dome-lead', 1.5, 0.5, 2.06, 0.8, true);
};

// ---- blacksmith: smithy (age 1), stone forge hall with racks of scimitars and shields (ages 2-3) ----
SELJUK.blacksmith = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e1: 'wall-window' });
  roof(k, 0, 0, 2, 2, 1, 'merlon-pointed');
  k.add(I, 'chimney', 0.5, 0.5, 1.06);
  k.add(I, 'forge', 2.4, 1.0, 0);
  k.add(I, 'rack-shields', 1.6, 2.35, 0, ROT.s);
};
OTTOMAN.blacksmith = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-window', e0: 'wall-window', e1: 'wall-window' });
  roof(k, 0, 0, 2, 2, 1);
  crown(k, 'dome-lead', 1.0, 1.0, 1.06, 1.1, k.style === 3);
  k.add(I, 'chimney', 0.35, 0.35, 1.06, 0, 1.3);
  k.add(I, 'forge', 2.45, 1.0, 0);
  k.add(I, 'rack-shields', 1.0, 2.35, 0, ROT.s);
  k.add(I, 'rack-shields', 2.35, 2.2, 0, ROT.e);
};

// ---- range: archery lodge (age 1), Meydan-ı Ok lodge with bow racks and targets (ages 2-3) ----
SELJUK.range = k => {
  ring(k, 0, 0, 1, 2, 0, { e0: 'wall-window', e1: 'wall-door' });
  roof(k, 0, 0, 1, 2, 1, 'merlon-pointed');
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.6, y, 0);
  lowWall(k, 0, 2, 1, 1, 0.35);
};
OTTOMAN.range = k => {
  ring(k, 0, 0, 2, 1, 0, { s0: 'wall-window', s1: 'wall-door', e0: 'wall-window' });
  roof(k, 0, 0, 2, 1, 1);
  crown(k, 'dome-lead', 1.0, 0.5, 1.06, 0.7, k.style === 3);
  portico(k, 0, 1, 2, null, 'merlon-pointed');
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
  k.add(I, 'rack-shields', 1.2, 2.4, 0, ROT.s);
  k.add(I, 'tug', 0.4, 2.6, 0);
};

// ---- stable: timber stable (age 1), Has Ahır imperial stables with a lead cupola and tuğ (ages 2-3) ----
SELJUK.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s1: 'wall-arcade', s2: 'wall-arcade' });
  k.add(I, 'roof-hip', 1.5, 0.5, 1, 0, [3, 0.8, 1]);
  lowWall(k, 0, 1.15, 3, 2, 0.3);
};
OTTOMAN.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s1: 'wall-door', s2: 'wall-arcade', e0: 'wall-window' });
  roof(k, 0, 0, 3, 1, 1);
  crown(k, 'kiosk', 1.5, 0.5, 1.06, 0.7);
  lowWall(k, 0, 1.15, 3, 2, 0.35);
  k.add(I, 'tug', 2.6, 2.6, 0);
  if (k.style === 3) k.add(I, 'tug', 0.4, 2.6, 0);
};

// ---- siege: cannon foundry with gun barrels in the yard (ages 2-3) ----
OTTOMAN.siege = k => {
  ring(k, 0, 0, 2, 2, 0, { s0: 'wall-door', s1: 'wall-arcade', e0: 'wall-window', e1: 'wall-arcade' });
  roof(k, 0, 0, 2, 2, 1);
  for (const [x, y] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) crown(k, 'dome-lead', x, y, 1.06, 0.6);
  k.add(I, 'chimney', 1.9, 0.2, 1.06, 0, 1.4);
  for (const y of [0.7, 1.7]) k.add(I, 'cannon', 2.5, y, 0, 0, 1.1);
  if (k.style === 3) k.add(I, 'cannon', 1.4, 2.55, 0, ROT.s, 1.1);
};

// ---- tower: watch tower (age 1), domed guard turret (age 2), keep with a cannon on the roof (age 3) ----
SELJUK.tower = k => { crown(k, 'kumbet', 0.5, 0.5, 0, 0.75); };
OTTOMAN.tower = k => {
  if (k.style === 2) { crown(k, 'tower-round', 0.5, 0.5, 0, 0.9, true); return; }
  ring(k, 0, 0, 1, 1, 0, { s0: 'wall-door' });
  ring(k, 0, 0, 1, 1, 1, { s0: 'wall-window', e0: 'wall-window' });
  ring(k, 0, 0, 1, 1, 2, { s0: 'wall-window', e0: 'wall-window' });
  roof(k, 0, 0, 1, 1, 3, 'merlon-pointed');
  k.add(I, 'cannon', 0.5, 0.5, 3.06, 45, 0.6);
};

// ---- well: stone well with a winch (age 0), şadırvan fountain kiosk (age 2) ----
SELJUK.well = k => {
  lowWall(k, 0, 0, 1, 1, 0.35);
  k.add(I, 'crane', 0.35, 0.5, 0, 0, 0.55);
};
OTTOMAN.well = k => { crown(k, 'kiosk', 0.5, 0.5, 0, 1.15, true); };

// ---- outpost: timber lookout (age 0) ----
SELJUK.outpost = k => { k.add(I, 'lookout', 0.5, 0.5, 0); };
```

  Run `node tests/islamic-art.test.js`. Expected: only the manifest test fails (`mill_turks_0 missing from manifest.js`).

- [ ] **Step 3: Self-check the look**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview mill_turks,lumbercamp_turks,miningcamp_turks,barracks_turks,blacksmith_turks,range_turks,stable_turks,siege_turks,tower_turks,well_turks,outpost_turks
  ```

  Open `tools/art/preview.png`. Fix clear defects in these builders only:
  - floating or overlapping pieces
  - props outside the footprint
  - a leaning or clipped minaret or tower

  Re-render after each fix. Note every change in the report.

- [ ] **Step 4: Bake and check**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --recipes mill_turks,lumbercamp_turks,miningcamp_turks,barracks_turks,blacksmith_turks,range_turks,stable_turks,siege_turks,tower_turks,well_turks,outpost_turks
  ```

  Run the bake check. Expected: `baked 33 sprites ... (merged: manifest has 172)`.

- [ ] **Step 5: Run the tests and commit**

  Run `node tests/islamic-art.test.js`. Expected: `13 passed, 0 failed`.

  ```bash
  npm run test:quick
  git add tools/art/turks-recipes.mjs tests/islamic-art.test.js game/art/kenney
  git commit -m "feat(art): Turks economy, military and defence buildings, Seljuk and Ottoman ages"
  ```

---

### Task 8: Review point 2 — the Turks set, ages 0–3 (user gate, main session)

**Files:**
- Possibly modify (polish): `tools/art/turks-recipes.mjs`; re-baked PNGs

- [ ] **Step 1: Render the contact sheet**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview house_turks,tc_turks,monastery_turks,castle_turks,market_turks,dock_turks,university_turks,mill_turks,lumbercamp_turks,miningcamp_turks,barracks_turks,blacksmith_turks,range_turks,stable_turks,siege_turks,tower_turks,well_turks,outpost_turks
  ```

  Open `tools/art/preview.png`. Apply the create-game-assets QA across all 53 Turks sprites (ages 0–3). Fix obvious defects and re-render.

- [ ] **Step 2: STOP — ask the user to approve the ages 0–3 set**

  Show `tools/art/preview.png`, with a short description per building type (Seljuk → Ottoman). Iterate until they approve.

- [ ] **Step 3: Re-bake anything polished, then commit**

  Re-bake only the polished recipes with `--recipes`, then run the bake check. Existing `*_turks_*` PNGs may now change, but only those recipes'.

  Run `node tests/islamic-art.test.js`. Expected: `13 passed, 0 failed`.

  ```bash
  git add tools/art/turks-recipes.mjs game/art/kenney
  git commit -m "art: polish Turks ages 0-3 (approved at review point 2)"
  ```

  If nothing changed, skip the commit.

---

### Task 9: Kit pieces for ages 4–5 and the Republican palette

**Files:**
- Modify: `tools/art/blender/kitlib.py` (`round_opening`)
- Modify: `tools/art/blender/islamic_kit.py` (import line; 16 builders; 16 `PIECES` entries)
- Create (generated): 16 GLBs
- Modify: `tools/art/islamic-kit.mjs` (`FIXED`, `TOP`, Turks palette rows 4–5)
- Modify: `game/js/civ_art.js` (`CIV_ARCH.turks.ages[5]`)
- Modify: `tests/islamic-art.test.js` (`SLOTS`, `PIECES`)

**Interfaces:**
- Produces:
  - `kitlib.round_opening(a, z0, zs, steps=8)`
  - Pieces: `column`, `pediment`, `balustrade`, `wall-pilaster`, `clock-tower`, `eave-broad`, `wall-tile-arch`, `wall-modern`, `wall-brick`, `roof-sawtooth`, `silo`, `headframe`, `stack`, `gantry`, `gun-turret`, `flagpole`
  - `TOP` heights: `clock-tower` 2.52, `silo` 2.4, `headframe` 2.02
  - `FIXED.brick`, and `PALETTES.turks[4]` and `[5]`

- [ ] **Step 1: Extend the test**

  In `tests/islamic-art.test.js`, replace the `SLOTS` line:

```js
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark', 'wood', 'metal'];
```

  with:

```js
const SLOTS = ['wall', 'stone', 'trim', 'roof', 'dome', 'accent', 'band', 'gold', 'dark', 'wood', 'metal', 'brick'];
```

  Replace the last line of `PIECES`:

```js
  'tower-round', 'asbad', 'kiosk', 'lookout', 'jetty', 'crane', 'cannon', 'rack-shields', 'target', 'forge', 'sextant', 'tug', 'awning', 'chimney'];
```

  with:

```js
  'tower-round', 'asbad', 'kiosk', 'lookout', 'jetty', 'crane', 'cannon', 'rack-shields', 'target', 'forge', 'sextant', 'tug', 'awning', 'chimney',
  'column', 'pediment', 'balustrade', 'wall-pilaster', 'clock-tower', 'eave-broad', 'wall-tile-arch', 'wall-modern', 'wall-brick', 'roof-sawtooth',
  'silo', 'headframe', 'stack', 'gantry', 'gun-turret', 'flagpole'];
```

  Run `node tests/islamic-art.test.js`. Expected: `FAIL the kit holds every piece` (`column.glb missing`).

- [ ] **Step 2: Add `round_opening` to `kitlib.py`**

  Insert directly before `def horseshoe(`:

```python
def round_opening(a, z0, zs, steps=8):
    """Round-arched opening of half-width a: sill at z0, semicircular head springing at zs."""
    return [(a, z0)] + [(a * math.cos(t), zs + a * math.sin(t)) for t in (math.pi * s / steps for s in range(steps + 1))] + [(-a, z0)]
```

- [ ] **Step 3: Add the 16 pieces to `islamic_kit.py`**

  Replace the import line:

```python
from kitlib import Piece, opening, horseshoe, crescent, pointed_dome, round_dome
```

  with:

```python
from kitlib import Piece, opening, round_opening, horseshoe, crescent, pointed_dome, round_dome
```

  Insert this block directly before `PIECES = {` (after `piece_chimney`):

```python
# ---- Turks pieces, ages 4-5 (Tanzimat and Republican) ----
def piece_column():
    p = Piece('column')
    p.box('stone', -0.08, -0.08, 0.0, 0.08, 0.08, 0.07)
    p.prism('wall', 0.055, 12, 0.07, 0.9)
    p.box('stone', -0.085, -0.085, 0.9, 0.085, 0.085, 1.0)
    return p


def piece_pediment():
    p = Piece('pediment')
    p.box('trim', FACE - 0.1, -0.52, 0.0, FACE + 0.04, 0.52, 0.08)          # entablature
    p.slab_yz('wall', [(-0.5, 0.08), (0.5, 0.08), (0.0, 0.36)], FACE - 0.08, FACE + 0.02)
    p.slab_yz('trim', [(-0.54, 0.07), (-0.46, 0.07), (0.0, 0.33), (0.46, 0.07), (0.54, 0.07), (0.0, 0.4)], FACE + 0.02, FACE + 0.04)
    return p


def piece_balustrade():
    p = Piece('balustrade')
    p.box('stone', FACE - 0.08, -0.5, 0.0, FACE, 0.5, 0.04)
    for k in range(9):
        p.prism('stone', 0.018, 6, 0.04, 0.16, cx=FACE - 0.04, cy=-0.4 + k * 0.1)
    p.box('stone', FACE - 0.09, -0.5, 0.16, FACE + 0.01, 0.5, 0.2)
    return p


def piece_wall_pilaster():
    p = Piece('wall-pilaster')
    p.box('wall', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('stone', FACE - T - 0.01, -0.5, 0.0, FACE + 0.02, 0.5, 0.12)
    for y in (-0.44, 0.44):
        p.box('stone', FACE, y - 0.05, 0.12, FACE + 0.03, y + 0.05, 0.9)
    p.slab_yz('trim', round_opening(0.17, 0.2, 0.62), FACE, FACE + 0.02)
    p.slab_yz('dark', round_opening(0.14, 0.23, 0.62), FACE, FACE + 0.03)
    p.box('trim', FACE - 0.01, -0.5, 0.9, FACE + 0.04, 0.5, 1.0)          # cornice
    return p


def piece_clock_tower():
    p = Piece('clock-tower')
    p.box('stone', -0.3, -0.3, 0.0, 0.3, 0.3, 0.8)
    p.box('wall', -0.26, -0.26, 0.8, 0.26, 0.26, 1.8)
    for x in (-0.24, 0.24):
        for y in (-0.24, 0.24):
            p.box('stone', x - 0.035, y - 0.035, 0.8, x + 0.035, y + 0.035, 1.8)
    p.box('trim', -0.3, -0.3, 1.8, 0.3, 0.3, 1.86)
    p.cyl_x('gold', 0.15, 0.15, 16, 0.26, 0.275, cz=1.5)                   # clock face, +x side
    p.cyl_x('wall', 0.12, 0.12, 16, 0.275, 0.285, cz=1.5)
    p.box('dark', 0.285, -0.006, 1.5, 0.29, 0.006, 1.6)
    p.box('dark', 0.285, 0.0, 1.494, 0.29, 0.07, 1.506)
    p.cyl_y('gold', 0.15, 16, -0.275, -0.26, cz=1.5)                       # clock face, camera-side -y
    p.cyl_y('wall', 0.12, 16, -0.285, -0.275, cz=1.5)
    p.box('wall', -0.2, -0.2, 1.86, 0.2, 0.2, 2.22)
    p.slab_yz('dark', round_opening(0.07, 1.92, 2.08), 0.2, 0.21)
    p.lathe('dome', round_dome(0.2, 0.18), 12, z0=2.22)
    p.prism('gold', 0.02, 6, 2.4, 2.52)
    return p


def piece_eave_broad():
    p = Piece('eave-broad')
    r = 0.72 * math.sqrt(2)
    p.lathe('roof', [(r, 0.0), (r, 0.05), (0.0, 0.3)], 4, rot=math.pi / 4)
    p.lathe('trim', [(0.5 * math.sqrt(2), -0.06), (0.5 * math.sqrt(2), 0.0)], 4, rot=math.pi / 4)   # frieze under the eave
    return p


def piece_wall_tile_arch():
    p = Piece('wall-tile-arch')
    p.box('stone', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('trim', FACE - T - 0.01, -0.5, 0.0, FACE + 0.02, 0.5, 0.1)
    p.box('accent', FACE, -0.2, 0.3, FACE + 0.012, 0.2, 0.86)               # tile panel
    p.slab_yz('trim', opening(0.16, 0.3, 0.6), FACE + 0.012, FACE + 0.025)
    p.slab_yz('dark', opening(0.13, 0.32, 0.6), FACE + 0.012, FACE + 0.035)
    p.box('trim', FACE, -0.5, 0.92, FACE + 0.02, 0.5, 0.97)
    return p


def piece_wall_modern():
    p = Piece('wall-modern')
    p.box('wall', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('stone', FACE - T - 0.01, -0.5, 0.0, FACE + 0.015, 0.5, 0.08)
    p.box('trim', FACE, -0.44, 0.4, FACE + 0.02, 0.44, 0.43)               # sill
    p.box('dark', FACE, -0.42, 0.43, FACE + 0.015, 0.42, 0.7)              # ribbon window
    p.box('wall', FACE, -0.5, 0.94, FACE + 0.03, 0.5, 1.0)                 # flat-roof lip
    return p


def piece_wall_brick():
    p = Piece('wall-brick')
    p.box('brick', FACE - T, -0.5, 0.0, FACE, 0.5, 1.0)
    p.box('stone', FACE - T - 0.01, -0.5, 0.0, FACE + 0.02, 0.5, 0.1)
    for y in (-0.46, 0.46):
        p.box('brick', FACE, y - 0.04, 0.1, FACE + 0.025, y + 0.04, 0.96)
    p.slab_yz('stone', round_opening(0.16, 0.3, 0.62), FACE, FACE + 0.015)
    p.slab_yz('dark', round_opening(0.13, 0.32, 0.62), FACE, FACE + 0.03)
    p.box('stone', FACE, -0.5, 0.94, FACE + 0.02, 0.5, 1.0)
    return p


def piece_roof_sawtooth():
    p = Piece('roof-sawtooth')
    p.slab_xz('roof', [(-0.5, 0.0), (0.5, 0.0), (0.5, 0.06), (-0.5, 0.06)], -0.5, 0.5)
    p.slab_xz('roof', [(-0.5, 0.06), (0.44, 0.06), (0.44, 0.4)], -0.5, 0.5)
    p.box('dark', 0.44, -0.48, 0.08, 0.46, 0.48, 0.36)                     # north-light glazing
    return p


def piece_silo():
    p = Piece('silo')
    p.prism('wall', 0.3, 16, 0.0, 2.2)
    for z in (0.7, 1.45):
        p.prism('trim', 0.305, 16, z, z + 0.04)
    p.lathe('roof', [(0.31, 0.0), (0.0, 0.2)], 16, z0=2.2)
    return p


def piece_headframe():
    p = Piece('headframe')
    for x in (-0.2, 0.2):
        for y in (-0.2, 0.2):
            p.box('metal', x - 0.03, y - 0.03, 0.0, x + 0.03, y + 0.03, 1.6)
    for z in (0.5, 1.05, 1.58):
        p.box('metal', -0.23, -0.23, z, 0.23, 0.23, z + 0.04)
    p.slab_xz('metal', [(-0.62, 0.0), (-0.54, 0.0), (-0.16, 1.5), (-0.24, 1.5)], -0.03, 0.03)   # back leg
    p.cyl_y('metal', 0.2, 16, -0.03, 0.03, cz=1.82)                        # sheave wheel
    p.cyl_y('dark', 0.12, 12, -0.035, 0.035, cz=1.82)
    return p


def piece_stack():
    p = Piece('stack')
    p.lathe('brick', [(0.13, 0.0), (0.08, 2.0)], 12)
    p.prism('dark', 0.095, 12, 2.0, 2.06)
    return p


def piece_gantry():
    p = Piece('gantry')
    for x in (-0.35, 0.25):
        for y in (-0.3, 0.3):
            p.box('metal', x - 0.035, y - 0.035, 0.0, x + 0.035, y + 0.035, 1.3)
    p.box('metal', -0.45, -0.07, 1.3, 0.95, 0.07, 1.42)                    # boom, overhanging the water (+x)
    p.box('metal', -0.4, -0.34, 1.28, -0.3, 0.34, 1.34)
    p.box('metal', 0.2, -0.34, 1.28, 0.3, 0.34, 1.34)
    p.box('accent', 0.6, -0.09, 1.22, 0.76, 0.09, 1.32)                    # trolley
    p.box('dark', 0.675, -0.006, 0.7, 0.685, 0.006, 1.22)
    return p


def piece_gun_turret():
    p = Piece('gun-turret')
    p.prism('wall', 0.42, 16, 0.0, 0.3)
    p.lathe('metal', [(0.28, 0.0), (0.28, 0.12), (0.18, 0.22), (0.0, 0.24)], 16, z0=0.3)
    p.cyl_x('metal', 0.035, 0.03, 8, 0.15, 0.78, cz=0.42)
    return p


def piece_flagpole():
    p = Piece('flagpole')
    p.prism('metal', 0.016, 6, 0.0, 1.62)
    p.box('accent', -0.006, -0.46, 1.22, 0.006, -0.02, 1.52)               # flag flies to the camera side (-y)
    # crescent turned to open toward the fly, and a small star beyond it
    p.slab_yz('wall', [(-z - 0.17, y + 1.37) for y, z in crescent(0.07, 0.058, 0.028)], 0.006, 0.012)
    p.box('wall', 0.006, -0.3, 1.35, 0.012, -0.26, 1.39)
    return p
```

  In `PIECES`, replace the line `    'chimney': piece_chimney,` with:

```python
    'chimney': piece_chimney,
    'column': piece_column,
    'pediment': piece_pediment,
    'balustrade': piece_balustrade,
    'wall-pilaster': piece_wall_pilaster,
    'clock-tower': piece_clock_tower,
    'eave-broad': piece_eave_broad,
    'wall-tile-arch': piece_wall_tile_arch,
    'wall-modern': piece_wall_modern,
    'wall-brick': piece_wall_brick,
    'roof-sawtooth': piece_roof_sawtooth,
    'silo': piece_silo,
    'headframe': piece_headframe,
    'stack': piece_stack,
    'gantry': piece_gantry,
    'gun-turret': piece_gun_turret,
    'flagpole': piece_flagpole,
```

- [ ] **Step 4: Republican colours for Turks age 5 (game)**

  In `game/js/civ_art.js` (`CIV_ARCH.turks.ages`), replace:

```js
      { wall: '#dee6ec', roof: '#284458', trim: '#2898b0', base: '#647480', beams: null, stone: '#c8d4de', accent: '#48e8ff', dome: '#38b8d8' },
```

  with:

```js
      { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', base: '#9a8a78', beams: null, stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' },
```

- [ ] **Step 5: Teach the recipe module ages 4–5**

  In `tools/art/islamic-kit.mjs`, replace:
  - `FIXED`: `export const FIXED = { gold: '#e8c040', dark: '#2a2420', wood: '#6b4a2b', metal: '#4a4640' };` → `export const FIXED = { gold: '#e8c040', dark: '#2a2420', wood: '#6b4a2b', metal: '#4a4640', brick: '#9a4a32' };`
  - `TOP`:

```js
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76,
  'tower-round': 2.31, 'asbad': 1.67, 'kiosk': 1.1, 'lookout': 2.16 };
```

    with:

```js
export const TOP = { 'dome-lead': 0.62, 'dome-ribbed': 0.959, 'kumbet': 1.98, 'minaret-pencil': 3.27, 'minaret-square': 2.995, 'portal': 1.76,
  'tower-round': 2.31, 'asbad': 1.67, 'kiosk': 1.1, 'lookout': 2.16, 'clock-tower': 2.52, 'silo': 2.4, 'headframe': 2.02 };
```

  - the last Turks palette row and the array close:

```js
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
  ],
```

    with:

```js
    { wall: '#eae2d2', roof: '#465666', trim: '#228898', stone: '#dad2c0', accent: '#e2b038', dome: '#4a5c6e' },
    { wall: '#ccc6bc', roof: '#3c4854', trim: '#485460', stone: '#bab4aa', accent: '#c83028', dome: '#4c5c6c' },
    { wall: '#e6dccb', roof: '#b0503a', trim: '#8c3a2c', stone: '#c9a98e', accent: '#c8102e', dome: '#7d858c' },
  ],
```

- [ ] **Step 6: Export and test**

  Run `npm run art:kit`, then `node tests/islamic-art.test.js`.

  Expected:
  - 49 `wrote` lines
  - `git diff --stat -- assets/original/islamic` prints nothing
  - `13 passed, 0 failed`. The palette test now checks Turks ages 0–5 against `CIV_ARCH`.

- [ ] **Step 7: Look at the pieces (main session)**

  Same procedure as Task 4 Step 6, with these names:

  `['column', 'pediment', 'balustrade', 'wall-pilaster', 'clock-tower', 'eave-broad', 'wall-tile-arch', 'wall-modern', 'wall-brick', 'roof-sawtooth', 'silo', 'headframe', 'stack', 'gantry', 'gun-turret', 'flagpole']`

  Remove the preview afterwards.

- [ ] **Step 8: Run the tests and commit**

  ```bash
  npm run test:syntax && npm run test:quick
  git add tools/art/blender assets/original/islamic tools/art/islamic-kit.mjs game/js/civ_art.js tests/islamic-art.test.js
  git commit -m "feat(art): Tanzimat and Republican kit pieces; Republican colours for Turks age 5"
  ```

---

### Task 10: Review point 3 — Tanzimat and Republican style board (user gate)

**Files:**
- Modify: `tools/art/islamic-kit.mjs` (append `porch`, `sawtooth`)
- Modify: `tools/art/turks-recipes.mjs` (import line; Tanzimat and Republican builders for tc, house, monastery, barracks)
- Create (generated): 8 PNGs; Modify: `manifest.js`
- Modify: `tests/islamic-art.test.js` (`TURKS_BAKED`), `tests/browser/art.spec.js`, `tests/browser/islamic-art.spec.js`

**Interfaces:**
- Produces:
  - `porch(k, x0, y0, w, pediment = false)`
  - `sawtooth(k, x0, y0, w, d, z)`
  - Sprites: `tc_turks_4/5`, `house_turks_4/5`, `monastery_turks_4/5`, `barracks_turks_4/5`

- [ ] **Step 1: Pin the keys**

  Replace the `TURKS_BAKED` declaration with:

```js
const TURKS_BAKED = {
  house: [0, 1, 2, 3, 4, 5], tc: [0, 1, 2, 3, 4, 5], monastery: [2, 3, 4, 5], mill: [0, 1, 2, 3],
  lumbercamp: [0, 1, 2, 3], miningcamp: [0, 1, 2, 3], dock: [0, 1, 2, 3], barracks: [0, 1, 2, 3, 4, 5],
  market: [1, 2, 3], blacksmith: [1, 2, 3], range: [1, 2, 3], stable: [1, 2, 3], university: [2, 3],
  siege: [2, 3], tower: [1, 2, 3], well: [0, 2], castle: [2], outpost: [0],
};
```

  Run `node tests/islamic-art.test.js`. Expected: `FAIL the recipes bake exactly the expected sprites`.

- [ ] **Step 2: Add the helpers and builders**

  Append to `tools/art/islamic-kit.mjs`:

```js
// columned porch along the south side of a 1-cell-deep row, roofed at storey 1, with an optional pediment
export function porch(k, x0, y0, w, pediment = false) {
  const n = w + 1;
  for (let i = 0; i < n; i++) k.add(I, 'column', x0 + 0.12 + i * (w - 0.24) / (n - 1), y0 + 0.88, 0);
  roof(k, x0, y0, w, 1, 1);
  if (pediment) k.add(I, 'pediment', x0 + w / 2, y0 + 0.5, 1.06, ROT.s, [1, 1, w]);
}
// factory roof: one sawtooth piece per cell, north-light glazing facing +x
export function sawtooth(k, x0, y0, w, d, z) {
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) k.add(I, 'roof-sawtooth', x0 + i + 0.5, y0 + j + 0.5, z);
}
```

  In `tools/art/turks-recipes.mjs`, replace the import line `import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico, lowWall, courtyard } from './islamic-kit.mjs';` with:

```js
import { I, ROT, CYPRESS, HIDE, TOP, ring, roof, crown, portico, lowWall, courtyard, porch, sawtooth } from './islamic-kit.mjs';
```

  Insert directly before `// ---- recipes (keep last) ----`:

```js
// ---- tc: Dolmabahçe-style palace (age 4), First National style hall (age 5) ----
TANZIMAT.tc = k => {
  // two-storey pilastered block under a low hipped roof, pedimented porch, clock tower
  ring(k, 0.5, 0.5, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.5, 0.5, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 2, 1.5, 2, 0, [3, 0.7, 2]);
  porch(k, 1.5, 2.5, 1, true);
  crown(k, 'clock-tower', 3.55, 3.35, 0, 0.85);
  k.add('town', 'fountain-round', 0.6, 3.5, 0, 0, 0.3);
  k.add('nature', 'tree_cone', 0.3, 0.35, 0, 0, 0.9, CYPRESS);
};
REPUBLICAN.tc = k => {
  // dressed stone with tile-panelled pointed windows under broad eaves, columned entrance, flag
  ring(k, 0.5, 0.5, 3, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0.5, 0.5, 3, 2, 1, {}, 'wall-tile-arch');
  k.add(I, 'eave-broad', 2, 1.5, 2, 0, [3, 1, 2]);
  porch(k, 1.5, 2.5, 1);
  k.add(I, 'flagpole', 2.0, 3.65, 0, 0, 1.3);
  k.add('nature', 'tree_cone', 3.75, 0.35, 0, 0, 0.9, CYPRESS);
};

// ---- house: Tanzimat Istanbul mansion (age 4), Ankara cubic house (age 5) ----
TANZIMAT.house = k => {
  // pilastered storeys, projecting bay, hipped roof
  ring(k, 0.1, 0.1, 2, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.1, 0.1, 2, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'bay-cumba', 1.1, 1.6, 1, ROT.s);
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 0.8, 2]);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};
REPUBLICAN.house = k => {
  // flat roofs and ribbon windows, an upper storey over half the plan
  ring(k, 0.1, 0.1, 2, 2, 0, {}, 'wall-modern');
  roof(k, 0.1, 0.1, 2, 2, 1);
  ring(k, 0.1, 0.1, 1, 2, 1.06, {}, 'wall-modern');
  roof(k, 0.1, 0.1, 1, 2, 2.06);
  k.add('nature', 'tree_cone', 2.3, 0.35, 0, 0, 0.8, CYPRESS);
};

// ---- monastery: baroque mosque (age 4), Republican-era mosque (age 5) ----
TANZIMAT.monastery = k => {
  // tall pilastered prayer hall under one dome, balustraded roof, columned porch, two slender minarets
  ring(k, 0.5, 0, 2, 2, 0, {}, 'wall-pilaster');
  ring(k, 0.5, 0, 2, 2, 1, {}, 'wall-pilaster');
  roof(k, 0.5, 0, 2, 2, 2, 'balustrade');
  crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
  porch(k, 0.5, 2, 2);
  for (const x of [0.25, 2.75]) crown(k, 'minaret-pencil', x, 2.3, 0, 1.05);
};
REPUBLICAN.monastery = k => {
  // classical revival in plain dressed stone: one dome, domed portico, two minarets
  ring(k, 0.5, 0, 2, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0.5, 0, 2, 2, 1, {}, 'wall-tile-arch');
  roof(k, 0.5, 0, 2, 2, 2);
  crown(k, 'dome-lead', 1.5, 1, 2.06, 1.9, true);
  portico(k, 0.5, 2, 2, 'dome-lead');
  for (const x of [0.25, 2.75]) crown(k, 'minaret-pencil', x, 0.25, 0, 1.1);
};

// ---- barracks: Selimiye-style courtyard block (age 4), 1930s military academy (age 5) ----
TANZIMAT.barracks = k => {
  // pilastered courtyard block with a balustrade and round corner towers
  ring(k, 0, 0, 3, 3, 0, {}, 'wall-pilaster');
  courtyard(k, 0, 0, 3, 3, 1, 'balustrade');
  for (const [x, y] of [[0.3, 0.3], [2.7, 0.3], [0.3, 2.7], [2.7, 2.7]]) crown(k, 'tower-round', x, y, 0, 0.6);
};
REPUBLICAN.barracks = k => {
  // long flat-roofed block, columned entrance, flag
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-modern');
  roof(k, 0, 0, 3, 2, 2);
  porch(k, 1, 2, 1);
  k.add(I, 'flagpole', 2.6, 2.6, 0);
};
```

- [ ] **Step 3: Update the browser expectations that `tc_turks_5` changes**

  The Turks now have their own Republican Town Center, so `tc_5` stays the expectation only for the Saracens.

  In `tests/browser/art.spec.js`, replace:

```js
  await page.evaluate(() => KART.loadCiv('turks'));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('tc', 2, 'turks'),
    turks5: drawProbe('tc', 5, 'turks'),
```

  with:

```js
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  await page.evaluate(drawProbe);
  const r = await page.evaluate(() => ({
    turks2: drawProbe('tc', 2, 'turks'),
    turks5: drawProbe('tc', 5, 'turks'),
    saracens5: drawProbe('tc', 5, 'saracens'),
```

  In `tests/browser/art.spec.js`, replace:

```js
  expect(r.turks5.names).toEqual(['tc_5']);   // the dedicated Future Town Center outranks the medieval civ sprite
```

  with:

```js
  expect(r.turks5.names).toEqual(['tc_turks_5']);    // the Turks' own Republican Town Center
  expect(r.saracens5.names).toEqual(['tc_5']);        // the shared Future Town Center outranks a medieval civ sprite
```

  In `tests/browser/islamic-art.spec.js`, replace:

```js
  // the shared Future Town Center (tc_5) outranks the medieval civ sprite; the other civ sprites still apply
  5: ['tc_5', 'house_turks_3', 'monastery_turks_3', 'house_saracens_3', 'monastery_saracens_3'],
```

  with:

```js
  // the Turks have Republican sprites of their own; for the Saracens the shared Future Town Center (tc_5)
  // outranks their medieval one while their age-3 house and mosque still apply
  5: ['tc_turks_5', 'house_turks_5', 'monastery_turks_5', 'tc_5', 'house_saracens_3', 'monastery_saracens_3'],
```


- [ ] **Step 4: Preview and QA (main session)**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview tc_turks,house_turks,monastery_turks,barracks_turks
  ```

  The sheet shows every age of the four. Ages 4 (Tanzimat) and 5 (Republican) are new.

  Apply the create-game-assets QA. Known point to raise with the user: `CIV_ARCH.turks.ages[4]` (kept by the spec) makes Tanzimat grey and slate. If the user wants whiter Tanzimat marble, change that palette row in **both** `civ_art.js` and `islamic-kit.mjs`; the palette test keeps them equal.

- [ ] **Step 5: STOP — ask the user to approve the Tanzimat and Republican look**

  Show `tools/art/preview.png`. Iterate until approved.

- [ ] **Step 6: Bake and check (main session)**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --recipes tc_turks,house_turks,monastery_turks,barracks_turks
  ```

  Run the bake check. Expected: `baked 22 sprites ... (merged: manifest has 180)` with 8 new PNGs. The 14 re-baked ages 0–3 sprites are byte-identical, so they don't show in the first check command.

- [ ] **Step 7: Run the tests and commit**

  ```bash
  node tests/islamic-art.test.js
  npm run test:quick
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js tests/browser/islamic-art.spec.js --reporter=line
  git add tools/art/islamic-kit.mjs tools/art/turks-recipes.mjs tests game/art/kenney
  git commit -m "feat(art): Tanzimat and Republican Town Center, house, mosque and barracks (approved at review point 3)"
  ```

  Expected: `13 passed, 0 failed`, and all browser tests pass.

---

### Task 11: Era-native civ sprites skip the painted Modern/Future add-ons

**Files:**
- Modify: `game/js/civ_art.js` (`drawCivBuildingOverlay` section 4 guards; the section D overlay call)
- Modify: `tests/browser/art.spec.js`

**Interfaces:**
- Consumes: `house_turks_4`, `tc_turks_5` (Task 10).
- Produces: `drawCivBuildingOverlay(..., opts)`, where `opts.era === false` skips section 4. Section D passes `era: false` exactly when `st >= 4` and the civ sprite's age equals `st`.

- [ ] **Step 1: Write the failing test**

  Append to `tests/browser/art.spec.js`:

```js
test('civ sprites baked for the Modern or Future age skip the painted era add-ons', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => Promise.all([KART.loadCiv('turks'), KART.loadCiv('saracens')]));
  const r = await page.evaluate(() => {
    const real = drawCivBuildingOverlay, seen = [];
    drawCivBuildingOverlay = (...a) => { seen.push(a[6]); return real(...a); };
    const probe = (type, st, civ) => {
      KART.cache.clear(); seen.length = 0;
      bldSprite(type, st, W.players[1].color, civ);
      return { names: [...KART.cache.keys()].map(k => k.split('|')[0]), opts: seen[0] };
    };
    // the era option really removes section 4: the same overlay call draws fewer rectangles with era: false
    const rects = opts => {
      const g = document.createElement('canvas').getContext('2d'), fill = g.fillRect.bind(g);
      let n = 0;
      g.fillRect = (...a) => { n++; return fill(...a); };
      real(g, 'house', 4, W.players[1].color, 'turks', true, opts);
      return n;
    };
    try {
      return {
        turks4: probe('house', 4, 'turks'), turks5: probe('tc', 5, 'turks'), saracens4: probe('house', 4, 'saracens'),
        withEra: rects({ crown: false }), withoutEra: rects({ crown: false, era: false }),
      };
    } finally { drawCivBuildingOverlay = real; KART.cache.clear(); }
  });
  expect(r.turks4).toEqual({ names: ['house_turks_4'], opts: { crown: false, era: false } });
  expect(r.turks5).toEqual({ names: ['tc_turks_5'], opts: { crown: false, era: false } });
  expect(r.saracens4).toEqual({ names: ['house_saracens_3'], opts: { crown: false, era: true } });
  expect(r.withoutEra).toBeLessThan(r.withEra);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js -g "era add-ons" --reporter=line`

  Expected: FAIL. `turks4.opts` is `{ crown: false }`.

- [ ] **Step 3: Implement**

  In `game/js/civ_art.js`, replace:

```js
  // 4. Era 4 (Modern Age) & Era 5 (Future Age) Architectural Retrofits for ALL buildings
  if (st === 4 && type !== 'palisade') {
```

  with:

```js
  // 4. Era 4 (Modern Age) & Era 5 (Future Age) Architectural Retrofits for ALL buildings, except civ sprites
  //    already baked for that age (opts.era === false)
  if (opts.era !== false && st === 4 && type !== 'palisade') {
```

  In `game/js/civ_art.js`, replace:

```js
  } else if (st >= 5 && type !== 'palisade') {
```

  with:

```js
  } else if (opts.era !== false && st >= 5 && type !== 'palisade') {
```

  In `game/js/civ_art.js`, replace:

```js
              drawCivBuildingOverlay(g, type, st, pc, civ, true, civSet ? { crown: false } : undefined);
```

  with:

```js
              drawCivBuildingOverlay(g, type, st, pc, civ, true, civSet ? { crown: false, era: !(st >= 4 && ageOf(civSet) === st) } : undefined);
```


- [ ] **Step 4: Run the art spec and commit**

  ```bash
  npm run test:syntax
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line
  git add game/js/civ_art.js tests/browser/art.spec.js
  git commit -m "feat(game): skip painted modern/future add-ons on civ sprites baked for that age"
  ```

---

### Task 12: The other 14 types, ages 4–5

**Files:**
- Modify: `tools/art/turks-recipes.mjs` (builders before the recipes marker)
- Create (generated): 28 PNGs; Modify: `manifest.js`
- Modify: `tests/islamic-art.test.js` (`TURKS_BAKED`), `tests/browser/art.spec.js` (castle probe)

**Interfaces:**
- Consumes: `porch`, `sawtooth` (Task 10), and the Task 9 pieces.
- Produces: the final 89 Turks keys.

- [ ] **Step 1: Pin the final keys**

  Replace the `TURKS_BAKED` declaration with:

```js
const TURKS_BAKED = {
  house: [0, 1, 2, 3, 4, 5], tc: [0, 1, 2, 3, 4, 5], monastery: [2, 3, 4, 5], mill: [0, 1, 2, 3, 4, 5],
  lumbercamp: [0, 1, 2, 3, 4, 5], miningcamp: [0, 1, 2, 3, 4, 5], dock: [0, 1, 2, 3, 4, 5],
  barracks: [0, 1, 2, 3, 4, 5], market: [1, 2, 3, 4, 5], blacksmith: [1, 2, 3, 4, 5],
  range: [1, 2, 3, 4, 5], stable: [1, 2, 3, 4, 5], university: [2, 3, 4, 5], siege: [2, 3, 4, 5],
  tower: [1, 2, 3, 4, 5], well: [0, 2, 4, 5], castle: [2, 4, 5], outpost: [0, 4, 5],
};
```

  Run `node tests/islamic-art.test.js`. Expected: `FAIL the recipes bake exactly the expected sprites`.

- [ ] **Step 2: Add the builders**

  Insert directly before `// ---- recipes (keep last) ----`:

```js
// ---- mill: brick steam mill (age 4), concrete grain silos (age 5) ----
TANZIMAT.mill = k => {
  ring(k, 0.1, 0.6, 2, 1, 0, {}, 'wall-brick');
  ring(k, 0.1, 0.6, 2, 1, 1, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.1, 1.1, 2, 0, [2, 0.6, 1]);
  k.add(I, 'stack', 0.4, 0.3, 0, 0, 0.85);
  k.add('town', 'cart', 0.6, 1.85, 0, 90, 0.55);
};
REPUBLICAN.mill = k => {
  // two silos beside a three-storey elevator tower, warehouse in front
  for (const x of [0.32, 0.8]) crown(k, 'silo', x, 0.4, 0, 0.8);
  for (const z of [0, 1, 2]) ring(k, 1.1, 0, 1, 1, z, {}, 'wall-modern');
  roof(k, 1.1, 0, 1, 1, 3);
  ring(k, 0.1, 1.0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0.1, 1.0, 2, 1, 1);
};

// ---- lumbercamp: steam sawmill (age 4), sawtooth-roofed sawmill (age 5) ----
TANZIMAT.lumbercamp = k => {
  ring(k, 0.1, 0.1, 2, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.1, 0.6, 1, 0, [2, 0.6, 1]);
  k.add(I, 'stack', 1.85, 0.3, 0, 0, 0.7);
  k.add('nature', 'log_large', 1.3, 1.5, 0, 60, 0.9);
  k.add('nature', 'log', 0.6, 1.6, 0, 10, 1.1);
};
REPUBLICAN.lumbercamp = k => {
  ring(k, 0.1, 0.1, 2, 1, 0, {}, 'wall-modern');
  sawtooth(k, 0.1, 0.1, 2, 1, 1);
  k.add('nature', 'log_large', 1.3, 1.5, 0, 60, 0.9);
  k.add('town', 'cart', 0.6, 1.65, 0, 90, 0.55);
};

// ---- miningcamp: coal winding tower and engine house (age 4), steel headframe (age 5) ----
TANZIMAT.miningcamp = k => {
  k.add(I, 'lookout', 0.6, 0.6, 0, 0, 1.05);
  ring(k, 1.0, 1.0, 1, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.5, 1.5, 1, 0, [1, 0.6, 1]);
  k.add(I, 'stack', 1.85, 1.15, 0, 0, 0.6);
  k.add('nature', 'stone_largeA', 0.5, 1.5, 0, 0, 0.7, { tint: '#3a3a3a' });   // coal heap
};
REPUBLICAN.miningcamp = k => {
  k.add(I, 'headframe', 0.75, 0.6, 0, 0, 0.95);
  ring(k, 1.0, 1.0, 1, 1, 0, {}, 'wall-modern');
  roof(k, 1.0, 1.0, 1, 1, 1);
  k.add('nature', 'stone_largeA', 0.5, 1.5, 0, 0, 0.7, { tint: '#3a3a3a' });
};

// ---- dock: arsenal with a clock tower (age 4), concrete quay with a gantry crane (age 5) ----
TANZIMAT.dock = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1, 0.5, 1, 0, [2, 0.6, 1]);
  crown(k, 'clock-tower', 2.5, 0.5, 0, 0.6);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'jetty', x, 2.2, 0);
  k.add(I, 'crane', 1.5, 1.4, 0, 0, 0.85);
};
REPUBLICAN.dock = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 2, 1, 1);
  for (const x of [0.5, 1.5, 2.5]) for (const y of [1.5, 2.5]) k.add(I, 'roof-flat', x, y, 0.05);   // concrete quay
  k.add(I, 'gantry', 1.6, 1.9, 0.11, 0, 0.9);
};

// ---- market: arcaded commercial hall (age 4), First National style market hall (age 5) ----
TANZIMAT.market = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 1, 2, 0, [3, 0.6, 2]);
  porch(k, 1, 2, 1, true);
  for (const x of [0.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};
REPUBLICAN.market = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-tile-arch');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-tile-arch');
  k.add(I, 'eave-broad', 1.5, 1, 2, 0, [3, 1, 2]);
  for (const x of [0.5, 1.5, 2.5]) k.add(I, 'awning', x, 2.5, 0, ROT.s);
};

// ---- blacksmith: brick ironworks (age 4), steelworks (age 5) ----
TANZIMAT.blacksmith = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 1.5, 1, 1, 0, [3, 0.6, 2]);
  k.add(I, 'stack', 2.6, 0.4, 0, 0, 0.9);
  k.add(I, 'forge', 1.5, 2.5, 0, ROT.s);
};
REPUBLICAN.blacksmith = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  sawtooth(k, 0, 0, 3, 2, 1);
  for (const x of [0.5, 1.3]) k.add(I, 'stack', x, 0.35, 0, 0, 1.15);
};

// ---- range: neoclassical shooting lodge (age 4), rifle range shelter (age 5) ----
TANZIMAT.range = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1, 0.5, 1, 0, [2, 0.6, 1]);
  porch(k, 0, 1, 2);
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
};
REPUBLICAN.range = k => {
  ring(k, 0, 0, 2, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 2, 1, 1);
  for (const y of [0.5, 1.5, 2.5]) k.add(I, 'target', 2.65, y, 0);
  k.add(I, 'flagpole', 0.3, 2.6, 0);
};

// ---- stable: neoclassical imperial stables (age 4), Republican stud farm (age 5) ----
TANZIMAT.stable = k => {
  ring(k, 0, 0, 3, 1, 0, { s0: 'wall-arcade', s2: 'wall-arcade' }, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 0.5, 1, 0, [3, 0.6, 1]);
  k.add(I, 'pediment', 1.5, 0.5, 1, ROT.s);
  lowWall(k, 0, 1.15, 3, 2, 0.3);
};
REPUBLICAN.stable = k => {
  ring(k, 0, 0, 3, 1, 0, {}, 'wall-modern');
  roof(k, 0, 0, 3, 1, 1);
  lowWall(k, 0, 1.15, 3, 2, 0.3, 'wall-modern');
};

// ---- university: Darülfünun-style faculty (age 4), monumental 1930s faculty (age 5) ----
TANZIMAT.university = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-pilaster');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-pilaster');
  k.add(I, 'roof-hip', 1.5, 1, 2, 0, [3, 0.6, 2]);
  porch(k, 0.5, 2, 2, true);
};
REPUBLICAN.university = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  ring(k, 0, 0, 3, 2, 1, {}, 'wall-modern');
  roof(k, 0, 0, 3, 2, 2);
  porch(k, 0, 2, 3);
  k.add(I, 'flagpole', 1.5, 1.0, 2.06, 0, 0.8);
};

// ---- siege: Tophane-style domed cannon foundry (age 4), arms factory (age 5) ----
TANZIMAT.siege = k => {
  ring(k, 0, 0, 2, 2, 0, {}, 'wall-brick');
  roof(k, 0, 0, 2, 2, 1);
  for (const [x, y] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) crown(k, 'dome-lead', x, y, 1.06, 0.6);
  k.add(I, 'stack', 1.95, 0.15, 0, 0, 0.8);
  for (const y of [0.7, 1.7]) k.add(I, 'cannon', 2.5, y, 0, 0, 1.1);
};
REPUBLICAN.siege = k => {
  ring(k, 0, 0, 3, 2, 0, {}, 'wall-modern');
  sawtooth(k, 0, 0, 3, 2, 1);
  k.add(I, 'stack', 2.7, 0.3, 0, 0, 1.0);
  for (const x of [0.8, 2.2]) k.add(I, 'cannon', x, 2.5, 0, ROT.s, 1.1);
};

// ---- tower: coastal artillery tower (age 4), concrete gun battery tower (age 5) ----
TANZIMAT.tower = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-brick');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-brick');
  roof(k, 0, 0, 1, 1, 2, 'balustrade');
  k.add(I, 'cannon', 0.5, 0.5, 2.06, 45, 0.6);
};
REPUBLICAN.tower = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-modern');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-modern');
  roof(k, 0, 0, 1, 1, 2);
  k.add(I, 'gun-turret', 0.5, 0.5, 2.06, 45, 0.7);
};

// ---- well: baroque fountain (age 4), plain Republican fountain (age 5) ----
TANZIMAT.well = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-pilaster');
  k.add(I, 'eave-broad', 0.5, 0.5, 1, 0, [1, 0.8, 1]);
  crown(k, 'dome-lead', 0.5, 0.5, 1.1, 0.45, true);
};
REPUBLICAN.well = k => {
  lowWall(k, 0, 0, 1, 1, 0.35, 'wall-modern');
  k.add('town', 'fountain-round', 0.5, 0.5, 0, 0, 0.5);
};

// ---- castle: Tanzimat gun bastion (age 4), concrete coastal fortress (age 5) ----
TANZIMAT.castle = k => {
  // low thick ramparts with a balustrade and guns, brick barracks inside, flag
  lowWall(k, 0, 0, 4, 4, 0.7);
  ring(k, 0, 0, 4, 4, 0.7, {}, 'balustrade');
  ring(k, 1, 1, 2, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 2, 1.5, 1, 0, [2, 0.6, 1]);
  for (const [x, y, rot] of [[3.6, 0.6, 0], [3.6, 3.4, 0], [0.6, 3.6, -90], [2.0, 3.65, -90]]) k.add(I, 'cannon', x, y, 0.7, rot, 1.0);
  k.add(I, 'flagpole', 0.6, 0.6, 0.7, 0, 1.3);
};
REPUBLICAN.castle = k => {
  // casemate walls with gun turrets on the corners, flag
  ring(k, 0, 0, 4, 4, 0, {}, 'wall-modern');
  ring(k, 0, 0, 4, 4, 1, {}, 'wall-modern');
  courtyard(k, 0, 0, 4, 4, 2);
  for (const [x, y] of [[0.5, 0.5], [3.5, 0.5], [0.5, 3.5], [3.5, 3.5]]) k.add(I, 'gun-turret', x, y, 2.06, 45, 0.9);
  k.add(I, 'flagpole', 2, 2, 0, 0, 1.6);
};

// ---- outpost: telegraph signal station (age 4), fire-watch tower (age 5) ----
TANZIMAT.outpost = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-brick');
  k.add(I, 'roof-hip', 0.5, 0.5, 1, 0, [1, 0.6, 1]);
  k.add(I, 'flagpole', 0.5, 0.5, 1.2, 0, 0.8);
};
REPUBLICAN.outpost = k => {
  ring(k, 0, 0, 1, 1, 0, {}, 'wall-modern');
  ring(k, 0, 0, 1, 1, 1, {}, 'wall-modern');
  roof(k, 0, 0, 1, 1, 2);
  k.add(I, 'flagpole', 0.5, 0.5, 2.06, 0, 0.8);
};
```

- [ ] **Step 3: Extend the castle probe to age 4**

  In `tests/browser/art.spec.js`, replace:

```js
    turks2: drawProbe('castle', 2, 'turks'), turks3: drawProbe('castle', 3, 'turks'),
```

  with:

```js
    turks2: drawProbe('castle', 2, 'turks'), turks3: drawProbe('castle', 3, 'turks'), turks4: drawProbe('castle', 4, 'turks'),
```

  In `tests/browser/art.spec.js`, replace:

```js
  expect(r.turks3.names).toEqual(['castle_turks_2']);
```

  with:

```js
  expect(r.turks3.names).toEqual(['castle_turks_2']);
  expect(r.turks4.names).toEqual(['castle_turks_4']);
```


- [ ] **Step 4: Self-check the look**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --preview mill_turks,lumbercamp_turks,miningcamp_turks,dock_turks,market_turks,blacksmith_turks,range_turks,stable_turks,university_turks,siege_turks,tower_turks,well_turks,castle_turks,outpost_turks
  ```

  Check the ages 4–5 sprites: Tanzimat should read as 19th-century stone and brick, Republican as 1930s concrete and broad-eaved stone. Fix clear defects in these builders and re-render. Note each change.

- [ ] **Step 5: Bake and check**

  ```bash
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run art:bake -- --recipes mill_turks,lumbercamp_turks,miningcamp_turks,dock_turks,market_turks,blacksmith_turks,range_turks,stable_turks,university_turks,siege_turks,tower_turks,well_turks,castle_turks,outpost_turks
  ```

  Run the bake check. Expected: `baked 67 sprites ... (merged: manifest has 208)`. 28 PNGs are new; the 39 re-baked ages 0–3 sprites are byte-identical.

- [ ] **Step 6: Run the tests and commit**

  ```bash
  node tests/islamic-art.test.js
  npm run test:quick
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/art.spec.js --reporter=line
  git add tools/art/turks-recipes.mjs tests game/art/kenney
  git commit -m "feat(art): Tanzimat and Republican Turks economy, military and defence buildings"
  ```

  Expected: `13 passed, 0 failed`, and all art.spec tests pass.

---

### Task 13: In-game Turks town, docs, full verification

**Files:**
- Modify: `tests/browser/islamic-art.spec.js`
- Modify: `assets/original/islamic/README.md`, `docs/ASSET_PLAN.md`, `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `test-results/turks-town-age1/3/4/5.png` (git-ignored).

- [ ] **Step 1: Write the in-game test**

  Append to `tests/browser/islamic-art.spec.js`:

```js
// Every Turks building type on cleared ground, drawn by the live game, zoomed out to fit one screenshot.
// Saves test-results/turks-town-age<N>.png for the review of the full Turks set in game.
const TURKS_TYPES = ['tc', 'castle', 'monastery', 'university', 'barracks', 'market', 'dock', 'siege', 'stable',
  'range', 'blacksmith', 'mill', 'lumbercamp', 'miningcamp', 'house', 'tower', 'well', 'outpost'];
const TURKS_TOWN = {
  // before their Turks sprites exist, the mosque, university and siege workshop show the shared age-1 sprite
  // and the castle the family castle_med
  1: ['tc_turks_1', 'house_turks_1', 'mill_turks_1', 'lumbercamp_turks_1', 'miningcamp_turks_1', 'dock_turks_1',
    'barracks_turks_1', 'market_turks_1', 'blacksmith_turks_1', 'range_turks_1', 'stable_turks_1', 'tower_turks_1',
    'well_turks_0', 'outpost_turks_0', 'monastery_1', 'university_1', 'siege_1', 'castle_med'],
  3: ['tc_turks_3', 'house_turks_3', 'monastery_turks_3', 'university_turks_3', 'barracks_turks_3', 'market_turks_3',
    'dock_turks_3', 'siege_turks_3', 'stable_turks_3', 'range_turks_3', 'blacksmith_turks_3', 'mill_turks_3',
    'lumbercamp_turks_3', 'miningcamp_turks_3', 'tower_turks_3', 'well_turks_2', 'castle_turks_2', 'outpost_turks_0'],
  4: TURKS_TYPES.map(t => t + '_turks_4'),
  5: TURKS_TYPES.map(t => t + '_turks_5'),
};

for (const age of [1, 3, 4, 5]) test(`every Turks building type uses its own sprite in game (age ${age})`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/game/'); await waitForArt(page);
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => KART.loadCiv('turks'));
  await page.evaluate(({ age, types }) => {
    const g = __game, w = g.W, m = w.map;
    g.UI.paused = true; w.noFog = true; w.players[1].age = age;
    const x0 = (w.n >> 1) - 15, y0 = (w.n >> 1) - 8;
    for (const e of w.list.slice()) if (e.x >= x0 - 1 && e.x < x0 + 31 && e.y >= y0 - 1 && e.y < y0 + 16) removeEnt(e);
    for (let y = y0 - 1; y < y0 + 16; y++) for (let x = x0 - 1; x < x0 + 31; x++) { const i = m.idx(x, y); m.ter[i] = T.GRASS; m.elev[i] = 0; m.blk[i] = 0; }
    m.computeVH(); m.computeRegions(); invalidateTerrain(); MM.baseVer = -1;
    types.forEach((type, i) => { spawnBuilding(type, 1, x0 + (i % 6) * 5, y0 + Math.floor(i / 6) * 5, true).civ = 'turks'; });
    KART.cache.clear(); R.spriteCache.clear();
    R.cam.zoom = 0.6;
    g.centerCamOn(x0 + 15, y0 + 7);
  }, { age, types: TURKS_TYPES });
  await page.waitForFunction(names => names.every(n => [...KART.cache.keys()].some(k => k.startsWith(n + '|'))), TURKS_TOWN[age]);
  await page.screenshot({ path: `test-results/turks-town-age${age}.png` });
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run it**

  Run: `PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npx playwright test tests/browser/islamic-art.spec.js --reporter=line`

  Expected: 7 passed (3 existing, 4 new).

- [ ] **Step 3: Review the screenshots with the user (main session)**

  Open `test-results/turks-town-age1.png`, `-age3`, `-age4` and `-age5`. Check:
  - every building sits on its footprint
  - shadows agree
  - flag and civ shield are visible
  - no painted dome or minaret doubles a modelled one
  - no antenna or cyan add-on appears on ages 4–5 Turks sprites

  Show them to the user with one line each.

- [ ] **Step 4: Update the docs**

  Replace `assets/original/islamic/README.md` with:

```markdown
# Original Islamic building kit

Modular architecture pieces for the Turks and Saracens buildings:
- **Walls:** pointed and horseshoe arches and timber framing; Tanzimat pilastered walls, Republican tile-arched and ribbon-window walls, industrial brick
- **Roofs:** flat, hipped, broad-eaved and sawtooth roofs; pointed and stepped merlons; balustrades
- **Crowns:** Ottoman lead domes and Mamluk ribbed domes, a Seljuk kümbet, pencil and square minarets, a crescent finial (alem)
- **Towers and structures:** round cannon tower, wind-tower mill (asbad), fountain kiosk (şadırvan), timber lookout, clock tower, grain silo, steel headframe, chimney stack
- **Details:** tiled portal, cumba and mashrabiya bays, windcatcher (malqaf), columns and pediments, a flagpole with the Turkish flag
- **Yard and waterfront props:** jetty, timber crane, gantry crane, cannon, gun turret, shield rack, archery target, forge, sextant, tuğ standard, bazaar awning

**Source:** every piece is generated by `tools/art/blender/islamic_kit.py`, with shared helpers in `tools/art/blender/kitlib.py`. There are no imported meshes and no AI generation. Rebuild with `npm run art:kit` (Blender 5.2.2). Set `BLENDER` if Blender is not at `D:\Blender\blender.exe`.

**Licence:** original work for this project, dedicated to the public domain under Creative Commons Zero 1.0 Universal (CC0-1.0), like the project's other original recipes (`tools/art/ACTOR_LICENSE.txt`). https://creativecommons.org/publicdomain/zero/1.0/

**Conventions:**
- Pieces are 1×1 tile cells centred on the origin; one storey = 1 unit.
- Wall pieces sit on the cell's +x edge and face +x.
- glTF is Y-up.
- Materials are named after colour slots: `wall`, `stone`, `trim`, `roof`, `dome`, `accent`, `band`, `gold`, `dark`, `wood`, `metal`, `brick`. They are metallic 0 and roughness 1 to match the Kenney kits.
- `tools/art/kenney-bake.html` recolours every slot per civilization and age from `tools/art/islamic-kit.mjs`, for the recipes in `tools/art/turks-recipes.mjs` and `tools/art/saracens-recipes.mjs`.
```

  In `docs/ASSET_PLAN.md`, replace:

```markdown
| `turks` | **Turks** | Seljuk $\rightarrow$ Ottoman (`ottoman`) | Seljuk sandstone with turquoise glaze (Ages 0–1) $\rightarrow$ cut limestone & Iznik tiles (Ages 2–5) |
```

  with:

```markdown
| `turks` | **Turks** | Seljuk $\rightarrow$ Ottoman $\rightarrow$ Tanzimat $\rightarrow$ Republican (`ottoman`) | Seljuk sandstone with turquoise glaze (Ages 0–1) $\rightarrow$ cut limestone & Iznik tiles (Ages 2–3) $\rightarrow$ Tanzimat pilastered stone & brick (Age 4) $\rightarrow$ Republican Ankara stone, cream plaster & red tile (Age 5) |
```

  In `README.md`, replace:

```markdown
Turks and Saracens buildings come from an original CC0 parts kit scripted in Blender (`tools/art/blender/islamic_kit.py`, `npm run art:kit`); its GLBs are committed, so baking does not need Blender.
```

  with:

```markdown
Turks and Saracens buildings come from an original CC0 parts kit scripted in Blender (`tools/art/blender/islamic_kit.py`, shared helpers in `kitlib.py`, `npm run art:kit`) and assembled per civilization in `tools/art/turks-recipes.mjs` and `saracens-recipes.mjs`; its GLBs are committed, so baking does not need Blender. The Turks have their own sprite for every building type and age: Seljuk (ages 0–1), Ottoman (2–3), Tanzimat (4) and Republican (5). A civilization's own sprites load the first time it is drawn.
```


- [ ] **Step 5: Full verification**

  ```bash
  npm test
  PLAYWRIGHT_BROWSERS_PATH=D:/ms-playwright npm run test:browser
  git checkout -- assets/screenshots
  git status --short
  ```

  Expected:
  - `npm test`: the only failing suite is `tests/command.test.js`, a pre-existing `TypeError` that also fails on `main`.
  - Browser suite: all pass.
  - `git status`: only this task's files.

- [ ] **Step 6: Commit**

  ```bash
  git add tests/browser/islamic-art.spec.js assets/original/islamic/README.md docs/ASSET_PLAN.md README.md
  git commit -m "test(art): in-game Turks town at ages 1, 3, 4 and 5; document the Turks eras"
  ```

- [ ] **Step 7: Finish the branch**

  Use superpowers:finishing-a-development-branch.
