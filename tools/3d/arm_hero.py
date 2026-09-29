# 영웅 몸에 무기를 쥐어 준다 (docs/design/160). Blender 5.x 배경 실행.
#   blender -b -P tools/3d/arm_hero.py -- <hero.glb> <weapon.glb|rod> <grip_m> <up|down> <out.glb> [--dual] [--scale=1] [--pose=idle@0.3]
# - 무기 GLB 규약은 웹판과 같다(js/looks.js): 원점 = 자루 끝, +Y(glTF) = 자루 방향, 오른손은 자루 끝에서 grip_m.
# - 쥐는 자리: idle 한 순간의 손바닥 가운데(손목에서 손가락 쪽 45 %). 자루는 그 순간에 연직.
#   up = 날이 위(아인 낫, 세라 봉), down = 날이 아래(카인 대검 - 칼끝이 땅을 향해 무게가 먼저 보인다, 류 단검).
# - 무기 정점은 손뼈 가중치 1.0 으로 몸 메시에 합친다: UE 에 한 스켈레탈 메시로 들어가고 모든 클립에서 손을 따라간다.
# - rod: 원문 세라의 «금속 봉»(EP?? L10384) - 여기서 만든다. 1.1 m 강철 봉 + 손목의 청색 회로와 같은 청색 선 두 줄.
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
opts = {a.split('=', 1)[0][2:]: (a.split('=', 1)[1] if '=' in a else True) for a in argv if a.startswith('--')}
pos = [a for a in argv if not a.startswith('--')]
SRC, WEAPON, GRIP, DIR, OUT = pos[0], pos[1], float(pos[2]), pos[3], pos[4]
DUAL = bool(opts.get('dual'))
WSCALE = float(opts.get('scale', 1.0))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH')


def make_rod():
    """세라의 금속 봉: 1.1 m, 반지름 1.4 cm, 양 끝 마개, 청색 발광 선 두 줄 (원점 = 아래 끝, +Z 위)."""
    me = bpy.data.meshes.new('rod')
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.014, radius2=0.014, depth=1.1)
    bmesh.ops.translate(bm, vec=(0, 0, 0.55), verts=bm.verts)
    for z in (0.02, 1.08):
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.019, radius2=0.019, depth=0.04)
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=r['verts'])
    bm.to_mesh(me)
    ob = bpy.data.objects.new('Rod', me)
    bpy.context.scene.collection.objects.link(ob)
    steel = bpy.data.materials.new('Rod_Steel')
    steel.use_nodes = True
    b = steel.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.32, 0.33, 0.35, 1)
    b.inputs['Metallic'].default_value = 0.9
    b.inputs['Roughness'].default_value = 0.35
    me.materials.append(steel)
    glow = bpy.data.materials.new('Rod_Circuit')
    glow.use_nodes = True
    g = glow.node_tree.nodes['Principled BSDF']
    g.inputs['Base Color'].default_value = (0.1, 0.35, 0.9, 1)
    g.inputs['Emission Color'].default_value = (0.25, 0.55, 1.0, 1)
    g.inputs['Emission Strength'].default_value = 6.0
    # two thin circuit lines along the shaft
    me2 = bpy.data.meshes.new('rod_lines')
    bm2 = bmesh.new()
    for ang in (0.0, math.pi):
        r = bmesh.ops.create_cube(bm2, size=1.0)
        bmesh.ops.scale(bm2, vec=(0.004, 0.004, 0.8), verts=r['verts'])
        bmesh.ops.translate(bm2, vec=(0.0145 * math.cos(ang), 0.0145 * math.sin(ang), 0.55), verts=r['verts'])
    bm2.to_mesh(me2)
    lines = bpy.data.objects.new('RodLines', me2)
    bpy.context.scene.collection.objects.link(lines)
    me2.materials.append(glow)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    lines.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    return ob


def load_weapon():
    if WEAPON == 'rod':
        return make_rod()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=WEAPON)
    new = [o for o in bpy.data.objects if o not in before]
    ms = [o for o in new if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms:
        o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if len(ms) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in new:
        if o is not ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob   # glTF +Y (handle) came in as Blender +Z, origin at the handle end


# The weapon is set upright in the IDLE pose (the clip the stand shows most), not the bind pose: an upright weapon in the
# bind pose lay flat in idle because the idle turns the wrist ~90 deg (first render). Placed in the posed hand, then
# carried back to the bind pose through the hand's pose -> rest transform, so skinning (weight 1 to the hand) puts it
# back exactly there in idle and moves it with the hand in every other clip.
POSE_CLIP, POSE_T = opts.get('pose', 'idle@0.3').split('@')
act = bpy.data.actions.get(POSE_CLIP)
if act:
    arm.animation_data_create()
    arm.animation_data.action = act
    f0, f1 = act.frame_range
    bpy.context.scene.frame_set(int(round(f0 + float(POSE_T) * (f1 - f0))))
bpy.context.view_layer.update()


def hand_mats(side):
    pb = arm.pose.bones[f'mixamorig:{side}Hand']
    posed = arm.matrix_world @ pb.matrix
    rest = arm.matrix_world @ pb.bone.matrix_local
    return pb, posed, rest


def palm(side):
    pb, posed, _ = hand_mats(side)
    head = arm.matrix_world @ pb.head
    tail = arm.matrix_world @ pb.tail
    return head + (tail - head) * 0.45


def place(w, side):
    """Grip point in that (posed) hand, handle vertical (up or down); then back to the bind pose; weight 1 to the hand."""
    s = WSCALE
    rot = Matrix.Identity(4) if DIR == 'up' else Matrix.Rotation(math.pi, 4, 'X')
    grip_local = Vector((0, 0, GRIP * s))
    at = palm(side)
    _, posed, rest = hand_mats(side)
    w.matrix_world = rest @ posed.inverted() @ Matrix.Translation(at) @ rot @ Matrix.Translation(-grip_local) @ Matrix.Scale(s, 4)
    bpy.ops.object.select_all(action='DESELECT')
    w.select_set(True)
    bpy.context.view_layer.objects.active = w
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    g = w.vertex_groups.new(name=f'mixamorig:{side}Hand')
    g.add(list(range(len(w.data.vertices))), 1.0, 'REPLACE')
    return w


w = place(load_weapon(), 'Right')
pieces = [w]
if DUAL:
    w2 = place(load_weapon(), 'Left')
    pieces.append(w2)
n_w = sum(len(p.data.polygons) for p in pieces)
# join into the body (keeps the body's armature modifier and parent)
bpy.ops.object.select_all(action='DESELECT')
for p in pieces:
    p.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
print(f'[arm] {os.path.basename(SRC)} + {os.path.basename(WEAPON)} x{len(pieces)} ({n_w} faces), grip {GRIP} m, {DIR}')
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_image_format='JPEG',
                          export_jpeg_quality=90, export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
print('[arm] ->', OUT)
