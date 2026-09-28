# 리깅한 보스 GLB 를 클립 몇 개의 한가운데 프레임으로 찍는다 (워크벤치, 텍스처 색). 뒤틀림·찢어짐 확인용.
#   blender -b -P tools/3d/render_boss_poses.py -- <rigged.glb> <out.png> [clip ...]
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
CLIPS = argv[2:] or ['idle', 'walk', 'atk_slam', 'atk_spin', 'hit', 'death']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in body for c in o.bound_box]
H = max(p.z for p in pts)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x, sc.render.resolution_y = 420, 520
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w') if not sc.world else sc.world
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 50
cam = bpy.data.objects.new('cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
d = H * 2.3
cam.location = (d * 0.55, -d * 0.85, H * 0.6)
direction = Vector((0, 0, H * 0.5)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
paths = []
for clip in CLIPS:
    act = bpy.data.actions.get(clip)
    if not act:
        continue
    arm.animation_data_create(); arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    sc.frame_set(int((f0 + f1) / 2))
    p = OUT.replace('.png', f'_{clip}.png'); sc.render.filepath = p
    bpy.ops.render.render(write_still=True); paths.append(p)
print('[poses]', ' '.join(paths))
