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
    'wood': '#6b4a2b', 'metal': '#4a4640', 'brick': '#9a4a32',
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
