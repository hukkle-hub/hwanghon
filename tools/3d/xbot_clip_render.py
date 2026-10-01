"""Render X Bot clips as a strip of stills (Workbench, headless) - to compare motion sources (docs/design/172).

blender -b -P tools/3d/xbot_clip_render.py -- <out.png> <label=clip.fbx> [<label=clip.fbx> ...]
Each clip is one row: 6 frames evenly over its length, three-quarter view, the floor at z=0.
"""
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
CLIPS = [a.split("=", 1) for a in argv[1:]]
XBOT = os.path.join(os.path.dirname(__file__), "..", "..", "art", "anim", "mixamo_heroes", "_XBot_TPose_skin.fbx")
N = 6
W, H = 360, 360

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "SINGLE"
sc.display.shading.single_color = (0.75, 0.62, 0.45)
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.05, 0.05, 0.06)
bpy.ops.import_scene.fbx(filepath=os.path.abspath(XBOT), automatic_bone_orientation=False, ignore_leaf_bones=True)
rig = next(o for o in sc.objects if o.type == "ARMATURE")
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
cam_data.lens = 40

frames = []
for label, path in CLIPS:
    before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(path), automatic_bone_orientation=False, ignore_leaf_bones=True)
    act = next(a for a in bpy.data.actions if a not in before)
    keep = {rig, cam} | set(rig.children) | {o for o in sc.objects if o.type == "MESH" and o.name.startswith("Plane")}
    for o in list(sc.objects):
        if o not in keep:   # the clip's own armature (and its mesh, when it carries one)
            bpy.data.objects.remove(o, do_unlink=True)
    rig.animation_data_create()
    rig.animation_data.action = act
    if hasattr(rig.animation_data, "action_slot") and act.slots:
        rig.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    row = []
    for k in range(N):
        f = int(round(f0 + (f1 - f0) * k / (N - 1)))
        sc.frame_set(f)
        hips = rig.matrix_world @ rig.pose.bones["mixamorig_Hips"].head
        target = Vector((hips.x, hips.y, 0.9))
        cam.location = target + Vector((1.7, -2.1, 0.35))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        p = os.path.join(os.path.dirname(OUT), f"_r_{len(frames)}_{k}.png")
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        row.append((p, f / 30.0))
    frames.append((label, row))

# sheet (Blender's image API, no PIL in its Python)
import numpy as np  # noqa: E402
LW = 140
sheet = np.zeros((H * len(frames), LW + W * N, 4), dtype=np.float32)
sheet[..., 3] = 1
for r, (label, row) in enumerate(frames):
    for k, (p, t) in enumerate(row):
        img = bpy.data.images.load(p)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
        y0 = H * (len(frames) - 1 - r)
        sheet[y0:y0 + H, LW + k * W:LW + (k + 1) * W] = px
        bpy.data.images.remove(img)
        os.remove(p)
out = bpy.data.images.new("sheet", LW + W * N, H * len(frames))
out.pixels = sheet.ravel()
out.filepath_raw = OUT
out.file_format = "PNG"
out.save()
print("XBOT_RENDER", OUT, [(l, [round(t, 2) for _, t in row]) for l, row in frames])
