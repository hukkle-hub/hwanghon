"""Bake local, licensed Mixamo hero takes against their real XBot bind pose.

Animation-only FBX imports do NOT contain a reliable rest pose. Copy evaluated
world matrices to the supplied skinned XBot before exporting; never reinterpret
the FBX's local rotations as bind-space deltas. Originals are read-only.
blender -b -P tools/3d/export-hero-motion-sources.py -- <output-directory>
"""
import bpy
import json
import os
import sys
from mathutils import Matrix

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sources = os.path.join(root, 'art/anim/mixamo_heroes')
out = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
os.makedirs(out, exist_ok=True)
catalog = json.load(open(os.path.join(sources, 'clips.json'), encoding='utf8'))
for char, clips in catalog.items():
    if char.startswith('_'):
        continue
    for key, label in clips.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        sc.render.fps = 30
        bpy.ops.import_scene.fbx(filepath=os.path.join(root, 'art/anim/mixamo_scarecrow/_XBot_TPose_skin.fbx'), ignore_leaf_bones=True)
        rig = next(o for o in sc.objects if o.type == 'ARMATURE')
        keep = set(sc.objects)
        rig.animation_data_clear()
        bpy.ops.import_scene.fbx(filepath=os.path.join(sources, f'hw_{char}_{key}.fbx'), ignore_leaf_bones=True)
        src = next(o for o in sc.objects if o.type == 'ARMATURE' and o not in keep)
        f0, f1 = src.animation_data.action.frame_range
        order = sorted((b.name for b in rig.data.bones if b.name in src.pose.bones), key=lambda n: len(rig.data.bones[n].parent_recursive))
        action = bpy.data.actions.new(label)
        rig.animation_data_create().action = action
        inv = rig.matrix_world.inverted()
        for index, frame in enumerate(range(round(f0), round(f1) + 1), 1):
            sc.frame_set(frame)
            for name in order:
                pb = rig.pose.bones[name]
                pb.matrix = inv @ src.matrix_world @ src.pose.bones[name].matrix
                bpy.context.view_layer.update()
                pb.rotation_mode = 'QUATERNION'
                pb.keyframe_insert('rotation_quaternion', frame=index)
                pb.keyframe_insert('location', frame=index)
        for obj in list(sc.objects):
            if obj not in keep:
                bpy.data.objects.remove(obj, do_unlink=True)
        for bone in rig.data.bones:
            bone.name = bone.name.replace('mixamorig_', 'mixamorig')
        sc.frame_start, sc.frame_end = 1, round(f1) - round(f0) + 1
        sc.frame_set(1)
        path = os.path.join(out, f'{char}_{key}.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_force_sampling=True, export_cameras=False, export_lights=False)
        print('MOTION_SOURCE', char, key, label, sc.frame_end, path, flush=True)
