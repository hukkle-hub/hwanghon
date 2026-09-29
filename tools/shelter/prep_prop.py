# 쉘터 소품: Hi3D 결과 GLB -> 게임용 GLB (docs/design/155 §2.2). Blender 5.x 배경 실행.
#   blender -b -P tools/shelter/prep_prop.py -- <hi3d.glb> <out.glb> <size_cm> [--axis=z|max] [--tris=12000] [--tex=1024] [--preview=<png>]
# - 크기: --axis=z 면 높이, max 면 가장 긴 변을 size_cm 에 맞춘다 (의자 높이 115, 금고문 지름 480 ...)
# - 바닥 = 0, 가로 가운데 (피벗 = 바닥 중앙), 한 메시로 합침
# - 면: 모바일 지시서 P8 - 중형 소품 5k-15k, 영웅 구조물 20k-40k
# - 텍스처: tex 로 줄이고 JPEG q90 (Hi3D 는 8192² 두 장)
# - --preview: 정면(-Y)/옆(+X)/위 세 장 - Hi3D 가 어느 쪽을 앞으로 만들었는지 확인하려고
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
opts = {a.split('=', 1)[0][2:]: a.split('=', 1)[1] for a in argv if a.startswith('--') and '=' in a}
pos = [a for a in argv if not a.startswith('--')]
SRC, OUT, SIZE = pos[0], pos[1], float(pos[2]) / 100.0
AXIS = opts.get('axis', 'z')
TRIS = int(opts.get('tris', '12000'))
TEX = int(opts.get('tex', '1024'))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.parent = None
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def bounds():
    pts = [body.matrix_world @ Vector(c) for c in body.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


mn, mx = bounds()
ext = mx - mn
k = SIZE / (ext.z if AXIS == 'z' else max(ext))
body.scale = (k, k, k)
bpy.ops.object.transform_apply(scale=True)
mn, mx = bounds()
body.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)
bpy.ops.object.transform_apply(location=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > TRIS:
    m = body.modifiers.new('dec', 'DECIMATE')
    m.ratio = TRIS / tris
    bpy.ops.object.modifier_apply(modifier='dec')
for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        img.scale(TEX, TEX)
        img.pack()
mn, mx = bounds()
print(f'[prop] {os.path.basename(SRC)}: {tris} tris -> {sum(len(p.vertices) - 2 for p in body.data.polygons)}, '
      f'size {100 * (mx.x - mn.x):.0f} x {100 * (mx.y - mn.y):.0f} x {100 * (mx.z - mn.z):.0f} cm, textures {[tuple(i.size) for i in bpy.data.images]}')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_image_format='JPEG', export_jpeg_quality=90)
print('[prop] ->', OUT)

if 'preview' in opts:
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    scn.render.resolution_x = scn.render.resolution_y = 400
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.5
    scn.world = world
    d = max(mx - mn) * 2.2
    c = (mn + mx) / 2
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scn.collection.objects.link(cam)
    scn.camera = cam
    shots = []
    for name, loc in (('front', (0, -d, 0)), ('side', (d, 0, 0)), ('top', (0, 0.001, d))):
        cam.location = c + Vector(loc)
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        p = opts['preview'].replace('.png', f'_{name}.png')
        scn.render.filepath = p
        bpy.ops.render.render(write_still=True)
        shots.append(p)
    print('[prop] preview', shots)
