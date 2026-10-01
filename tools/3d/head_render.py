"""Front/3-4 renders of a GLB character's head (headless Blender, Eevee) - to judge a face mesh before using it
as a MetaHuman Identity source (docs/design/177). blender -b -P head_render.py -- in.glb out.png"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
src, out = args[:2]
stature = float(args[2]) if len(args) > 2 else 1.68   # the weapon is merged into the body mesh: aim by height
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys() else "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 768
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.35, 0.35, 0.37)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
meshes = [o for o in sc.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
top = max(p.z for p in pts)
lo = min(p.z for p in pts)
h = top - lo
cx = sum(p.x for p in pts) / len(pts)
cy = sum(p.y for p in pts) / len(pts)
# the head from the feet up (the merged weapon tops the bounding box); centre x/y from the lower half (no weapon tip)
low = [p for p in pts if p.z < lo + stature * 0.5]
cx = sum(p.x for p in low) / len(low)
cy = sum(p.y for p in low) / len(low)
head = Vector((cx, cy, lo + stature * 0.935))
h = stature
# a rigged GLB: aim at the head bone (the file's scale is not metres - the stature guess hit the knees)
arm = next((o for o in sc.objects if o.type == "ARMATURE"), None)
if arm:
    hb = next((b for b in arm.data.bones if b.name.lower() in ("head", "mixamorig:head", "mixamorig_head", "j_bip_c_head")), None)
    if hb:
        head = arm.matrix_world @ ((hb.head_local + hb.tail_local) / 2)
        h = (arm.matrix_world @ hb.tail_local - arm.matrix_world @ hb.head_local).length * 7.5
        print("HEADBONE", hb.name, head, h)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(20))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 85
import numpy as np  # noqa: E402
tiles = []
for i, yaw in enumerate((0, 35)):
    d = h * 0.42
    a = math.radians(yaw)
    cam.location = head + Vector((math.sin(a) * d, -math.cos(a) * d, 0))
    cam.rotation_euler = (head - cam.location).to_track_quat("-Z", "Y").to_euler()
    p = out + f".{i}.png"
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    tiles.append(p)
W = 768
sheet = np.zeros((W, W * len(tiles), 4), dtype=np.float32)
for i, p in enumerate(tiles):
    img = bpy.data.images.load(p)
    sheet[:, i * W:(i + 1) * W] = np.array(img.pixels[:], dtype=np.float32).reshape(W, W, 4)
    os.remove(p)
o = bpy.data.images.new("s", W * len(tiles), W)
o.pixels = sheet.ravel()
o.filepath_raw = out
o.file_format = "PNG"
o.save()
print("HEAD", out, "height", round(h, 3))
