"""Put separately fitted equipment parts (fit_part.py) into the outfit FBX (fit_outfit.py) so UE imports one skeletal
mesh (doc 182 §5). A separate part import turned Sera's silver hair yellow seen from behind - whatever the part did
(hidden, no shadow, saved hair material: still yellow); one mesh does not.

blender -b -P tools/metahuman/merge_parts.py -- outfit.fbx out.fbx part1.fbx [part2.fbx ...]
"""
import os
import sys

import bpy

a = sys.argv[sys.argv.index("--") + 1:]
OUTFIT, OUT, PARTS = a[0], a[1], a[2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.fbx(filepath=os.path.abspath(OUTFIT))
arm = next(o for o in sc.objects if o.type == "ARMATURE")
AW = arm.matrix_world.copy()
for p in PARTS:
    before = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(p))
    new = [o for o in sc.objects if o not in before]
    for o in new:
        if o.type == "MESH":
            M = o.matrix_world.copy()
            o.parent = arm
            o.matrix_world = M
            for m in o.modifiers:
                if m.type == "ARMATURE":
                    m.object = arm
            print("MERGE part", o.name, len(o.data.vertices))
    for o in new:
        if o.type == "ARMATURE":
            bpy.data.objects.remove(o, do_unlink=True)
arm.matrix_world = AW
bpy.ops.object.select_all(action="DESELECT")
for o in sc.objects:
    o.select_set(True)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"ARMATURE", "MESH"},
                         add_leaf_bones=False, mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)
print("MERGE out", OUT, [o.name for o in sc.objects if o.type == "MESH"])
