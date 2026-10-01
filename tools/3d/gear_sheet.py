"""Turntable-free contact sheet of gear GLBs with their size (headless Blender) - to pick and orient hero weapons
(docs/design/175). blender -b -P tools/3d/gear_sheet.py -- out.png a.glb b.glb ...
Prints each file's bounding box (m) and longest axis."""
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, FILES = os.path.abspath(argv[0]), argv[1:]
W = H = 360
import numpy as np  # noqa: E402

tiles = []
for f in FILES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "TEXTURE"
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.world = bpy.data.worlds.new("w")
    sc.world.color = (0.12, 0.12, 0.14)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(f))
    meshes = [o for o in sc.objects if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = hi - lo
    ctr = (hi + lo) / 2
    axis = "XYZ"[max(range(3), key=lambda i: size[i])]
    print(f"GEAR {os.path.basename(f)} size {size.x:.3f} {size.y:.3f} {size.z:.3f} long {axis} lo {lo.x:.2f} {lo.y:.2f} {lo.z:.2f} hi {hi.x:.2f} {hi.y:.2f} {hi.z:.2f} meshes {len(meshes)}")
    cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(size) * 1.15
    cam.location = ctr + Vector((0, -max(size) * 3, 0))
    cam.rotation_euler = (1.5708, 0, 0)   # look along +Y: X right, Z up
    p = OUT + f".{len(tiles)}.png"
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    tiles.append(p)
sheet = np.zeros((H, W * len(tiles), 4), dtype=np.float32)
for i, p in enumerate(tiles):
    img = bpy.data.images.load(p)
    sheet[:, i * W:(i + 1) * W] = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    os.remove(p)
out = bpy.data.images.new("s", W * len(tiles), H)
out.pixels = sheet.ravel()
out.filepath_raw = OUT
out.file_format = "PNG"
out.save()
