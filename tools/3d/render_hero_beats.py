# 영웅 몸(art/3d/heroes/<id>.glb) 확인 시트: 정지 + 클립 몇 개의 한 순간을 앞에서 (docs/design/160).
#   blender -b -P tools/3d/render_hero_beats.py -- <hero.glb> <out.png> [clip@t,clip@t,...]   -> <out>_<clip>.png each
# t 는 0..1 (클립 길이 비율). 기본: rest, idle@0.3, idle2@0.5, guardUp@0.6, walk@0.25, cheer@0.5, skill1@0.5
import bpy, sys, math
from mathutils import Vector

argv = [a for a in sys.argv[sys.argv.index('--') + 1:] if a != '--zoom']
SRC, OUT = argv[0], argv[1]
BEATS = (argv[2] if len(argv) > 2 else 'rest,idle@0.3,idle2@0.5,guardUp@0.6,walk@0.25,cheer@0.5,skill1@0.5').split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
scn = bpy.context.scene
scn.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scn.render.resolution_x, scn.render.resolution_y = 360, 560
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.42, 0.42, 0.44, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.3
scn.world = w
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(-25)); scn.collection.objects.link(sun)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam); scn.camera = cam
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
H = max(p.z for p in pts)
ZOOM = '--zoom' in sys.argv   # head and chest: faces, hands, glasses
cam.data.lens = 50
# glTF front is -Y in Blender
cam.location = (0.0, -H * 2.6, H * 0.55) if not ZOOM else (0.0, -H * 0.62, H * 0.84)
cam.rotation_euler = (math.radians(90), 0, 0)
tiles = []
for b in BEATS:
    name, t = (b.split('@') + ['0'])[:2]
    if name == 'rest':
        arm.animation_data_clear()
        for p in arm.pose.bones:
            p.rotation_quaternion = (1, 0, 0, 0); p.location = (0, 0, 0)
        scn.frame_set(1)
    else:
        act = bpy.data.actions.get(name)
        if not act:
            print('[beats] no clip', name); continue
        arm.animation_data_create(); arm.animation_data.action = act
        f0, f1 = act.frame_range
        scn.frame_set(int(round(f0 + float(t) * (f1 - f0))))
    p = OUT.replace('.png', f'_{name}.png')
    scn.render.filepath = p
    bpy.ops.render.render(write_still=True)
    tiles.append((b, p))
print('[beats]', OUT, [p for _, p in tiles])   # one PNG per beat: <out>_<clip>.png (Blender has no PIL - join them outside)
