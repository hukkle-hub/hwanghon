"""Keep only the head skin of a wrapped template (wrap_template.py output) for UE ImportFromTemplate (docs/design/177).

blender -b -P tools/metahuman/split_template.py -- wrapped.fbx head_only.fbx
"""
import os
import sys

import bpy

a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.abspath(a[0]))
o = next(x for x in bpy.context.scene.objects if x.type == "MESH")
bpy.context.view_layer.objects.active = o
o.select_set(True)
keep = {i for i, m in enumerate(o.data.materials) if m and m.name.startswith("M_GrayTexture_Head")}
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for p in o.data.polygons:
    p.select = p.material_index not in keep
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="FACE")
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.export_scene.fbx(filepath=os.path.abspath(a[1]), use_selection=True, object_types={"MESH"}, apply_unit_scale=True,
                         axis_forward="-Y", axis_up="Z", mesh_smooth_type="FACE")
print("SPLIT verts", len(o.data.vertices), "polys", len(o.data.polygons))
