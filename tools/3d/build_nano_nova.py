# 나노-노바 코어 (EP27, docs/design/156): Hi3D 부품 여섯 -> 뼈대 하나, 스토리 전투 클립 전부. Blender 5.x 배경 실행.
#   blender -b -P tools/3d/build_nano_nova.py -- <부품 폴더> <out.glb> [--preview=<png>]
# 부품 폴더: body.glb(결정의 산 + 캡슐 잔해), pilot.glb(차한별), shutter/fold/silence/circle.glb(팔 넷) - Hi3D 원본 그대로.
#
# 원문 (EP27 L14532-L14869):
# - «지하 공간의 절반을 채운 결정의 산. 노바 1호의 귀환 캡슐 잔해가 그 산의 골격» - 몸 = 산 + 잔해
# - «산의 중심, 캡슐 잔해의 조종석이 있던 자리에, 사람의 형태가 박혀» - 차한별은 앞 가운데 조종석 구멍에 선다
# - «산의 사면에서 팔들이 자라났다» 셔터 / 공간 주름 / 소리 지우기 - 사면의 팔 셋
# - «산의 중심이 열리며 … 원을 그리는 팔» - 원의 팔은 꼭대기(중심)에서, 팔꿈치 관절(류가 꿰는 곳)이 있다
# - «팔들이 무너져 도로 산의 사면이 되었고» - death 는 팔이 사면으로 쓰러져 가라앉는다
# 크기(산 폭 18 m, 차한별 1.8 m, 팔 10-15 m)는 원문 수치가 없어 설계값이다(TBD_CANON).
#
# 클립 이름은 사람 뼈대 보스와 같다(ue_boss_training_setup.build 가 그대로 패턴 표를 만든다). 접점은 그 표의 값에 맞춘다:
#   atk_charge 0.22 셔터 팔 밀치기 · atk_spin 0.29-0.535 원의 팔 휩쓸기 · atk_hammer 0.48 접힘·무음 팔 내려찍기(코어 사출)
#   atk_slam 0.31 모든 팔 회수 낙하(L14829) · hookR/hookL/kick/scythe/bolt (온라인 아이콘용)
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
opts = {a.split('=', 1)[0][2:]: a.split('=', 1)[1] for a in argv if a.startswith('--') and '=' in a}
pos = [a for a in argv if not a.startswith('--')]
SRC, OUT = pos[0], pos[1]
FPS = 30

BODY_W = 18.0          # 산의 가장 긴 가로 (m)
PILOT_H = 1.8
# 팔: 길이(m), 사면의 붙는 곳(몸 상자 비율 x, y, z), 뻗는 방향(월드, 앞 = -Y), 면 수, 텍스처.
# 기본 자세는 옆·뒤로 벌린다 - 앞쪽(«원의 안쪽», L14791 품 안)은 비워 두고, 공격할 때만 앞으로 온다(첫 판은 셔터 팔이 일행 머리 위를 덮었다)
ARMS = {
    'shutter': dict(length=11.0, at=(-0.30, -0.20, 0.45), dir=(-0.80, -0.25, 0.55), tris=8000, tex=1024),
    'fold':    dict(length=10.0, at=(0.30, -0.20, 0.45), dir=(0.80, -0.25, 0.55), tris=8000, tex=1024),
    'silence': dict(length=10.0, at=(-0.18, 0.15, 0.80), dir=(-0.35, 0.45, 0.80), tris=8000, tex=1024),
    'circle':  dict(length=15.0, at=(0.0, 0.0, 1.0), dir=(0.10, 0.30, 0.95), tris=10000, tex=2048),
}
JOINTS = (0.0, 0.36, 0.70, 1.0)     # 어깨 / 팔꿈치 / 손목 / 끝 (원의 팔은 0.36 이 그림의 팔꿈치 공)
SINK = 0.9                           # 팔뿌리가 사면 속으로 묻히는 길이 (m)


def log(*a):
    print('[nano]', *a)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS


def load(name, size, axis, tris, tex):
    """One Hi3D part as one mesh, sized, floor = 0, centred on x/y."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, f'{name}.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.parent = None
    for o in new:
        if o is not ob and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    v = np.array([ob.matrix_world @ x.co for x in ob.data.vertices])
    if axis == 'x':
        # an arm: Hi3D does not always lay it along X (fold and silence came out along Y) - turn its long horizontal
        # axis (principal component of the plan) onto X, keeping up up
        c = v[:, :2] - v[:, :2].mean(0)
        w, vec = np.linalg.eigh(c.T @ c)
        px, py_ = vec[:, np.argmax(w)]
        ob.rotation_euler = (0, 0, -math.atan2(py_, px))
        bpy.ops.object.transform_apply(rotation=True)
        v = np.array([x.co for x in ob.data.vertices])
    mn, mx = v.min(0), v.max(0)
    ext = mx - mn
    k = size / (ext[2] if axis == 'z' else (ext[0] if axis == 'x' else max(ext[0], ext[1])))
    ob.scale = (k, k, k)
    bpy.ops.object.transform_apply(scale=True)
    v = np.array([x.co for x in ob.data.vertices])
    mn, mx = v.min(0), v.max(0)
    ob.location = (-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2])
    bpy.ops.object.transform_apply(location=True)
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if n > tris:
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = tris / n
        bpy.ops.object.modifier_apply(modifier='dec')
    for mat in ob.data.materials:
        glow(mat, tex)
    ob.name = name
    v = np.array([x.co for x in ob.data.vertices])
    log(f'{name}: {n} -> {sum(len(p.vertices) - 2 for p in ob.data.polygons)} tris, '
        f'{100 * (v[:, 0].max() - v[:, 0].min()):.0f} x {100 * (v[:, 1].max() - v[:, 1].min()):.0f} x {100 * v[:, 2].max():.0f} cm')
    return ob


def glow(mat, tex):
    """Shrink the textures; the amber cores in the base colour become an emissive map («층층이 맥동하고 있었다»)."""
    if not mat or not mat.use_nodes:
        return
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE' and n.image and (n.image.size[0] > tex or n.image.size[1] > tex):
            n.image.scale(tex, tex)
    if not bsdf or not bsdf.inputs['Base Color'].is_linked:
        return
    src = bsdf.inputs['Base Color'].links[0].from_node
    if src.type != 'TEX_IMAGE' or not src.image:
        return
    img = src.image
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    # amber/orange and bright: red high, green about half, blue low (the grey crystal, white suit and rust fall out)
    m = (r > 0.45) & (g > 0.12) & (g < r * 0.85) & (b < g * 0.7)
    m = m.astype(np.float32) * np.clip((r - 0.45) * 3.0, 0, 1)
    em = np.zeros_like(px)
    em[:, 0], em[:, 1], em[:, 2], em[:, 3] = r * m, g * m, b * m, 1.0
    e = bpy.data.images.new(f'{mat.name}_emissive', w, h)
    e.pixels.foreach_set(em.ravel())
    e.pack()
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = e
    nt.links.new(node.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 4.0
    log(f'  {mat.name}: glow {100 * float((m > 0.1).mean()):.1f}% of texels')


def ray(ob, origin, direction):
    """Hit point on ob (world), None if missed."""
    inv = ob.matrix_world.inverted()
    ok, loc, nrm, idx = ob.ray_cast(inv @ Vector(origin), (inv.to_3x3() @ Vector(direction)).normalized())
    return (ob.matrix_world @ loc) if ok else None


# ---- 1. parts
body = load('body', BODY_W, 'max', 30000, 2048)
bv = np.array([x.co for x in body.data.vertices])
BMN, BMX = bv.min(0), bv.max(0)
BW, BD, BH = BMX - BMN
pilot = load('pilot', PILOT_H, 'z', 12000, 2048)
# the cockpit niche: from the front (-Y) at chest height, the first crystal the ray meets is the niche's back wall
back = ray(body, (0.0, BMN[1] - 5, 1.2), (0, 1, 0))
py = (back.y if back else BMN[1] + BD * 0.25) - 0.45
log(f'pilot in the niche at y {py:.2f} (front {BMN[1]:.2f}), back wall {back.y if back else None}')
# The fight measures reach to the boss actor's origin (band 200-300 cm, the final blow «여덟 걸음의 마지막 두 걸음»
# L14829-L14857 lands on 차한별's chest) - the origin is the pilot, the mountain sits behind him.
body.location = (0.0, -py, 0.0)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True)
pilot.location = (0.0, 0.0, 0.0)
bv = np.array([x.co for x in body.data.vertices])
BMN, BMX = bv.min(0), bv.max(0)
py = 0.0

arms = {}
for name, a in ARMS.items():
    ob = load(name, a['length'], 'x', a['tris'], a['tex'])
    # the images lie horizontally, the broken-off root on the left and the working end (shutter, fan, hood, blade) on the
    # right - but Hi3D may face the model either way: the root is the end with the smaller cross-section. Put it at -X.
    co = np.array([x.co for x in ob.data.vertices])
    x0, x1 = co[:, 0].min(), co[:, 0].max()
    ends = [co[co[:, 0] < x0 + 0.15 * (x1 - x0)], co[co[:, 0] > x1 - 0.15 * (x1 - x0)]]
    size = [float(np.ptp(e[:, 1]) * np.ptp(e[:, 2])) for e in ends]
    if size[0] > size[1]:
        ob.rotation_euler = (0, 0, math.pi)
        bpy.ops.object.transform_apply(rotation=True)
    log(f'  {name}: end sections {size[0]:.2f} / {size[1]:.2f} m2 -> {"turned" if size[0] > size[1] else "as is"}')
    d = Vector(a['dir']).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, -1, 0))   # local +Z (the image's up) toward world up/front
    zc = (ref - d * ref.dot(d)).normalized()
    yc = zc.cross(d)
    R = Matrix((d, yc, zc)).transposed().to_4x4()
    # the socket on the slope: aim from outside the body at the box point, take the surface
    tx, ty, tz = a['at']
    target = Vector((tx * BW + (BMN[0] + BMX[0]) / 2, ty * BD + (BMN[1] + BMX[1]) / 2, tz * BH))
    hit = ray(body, target + d * 20, -d)
    sock = hit if hit else target
    root = sock - d * SINK
    xs = np.array([x.co.x for x in ob.data.vertices])
    ob.matrix_world = Matrix.Translation(root) @ R @ Matrix.Translation(Vector((-xs.min(), 0, 0 - np.array([x.co.z for x in ob.data.vertices]).mean())))
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    arms[name] = dict(ob=ob, root=root, d=d, L=a['length'])
    log(f'{name}: socket {tuple(round(c, 2) for c in sock)} ({"surface" if hit else "box"}), dir {tuple(round(c, 2) for c in d)}')

# ---- 2. skeleton
arm_ob = bpy.data.objects.new('NanoNova_Rig', bpy.data.armatures.new('NanoNova_Rig'))
bpy.context.scene.collection.objects.link(arm_ob)
bpy.context.view_layer.objects.active = arm_ob
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_ob.data.edit_bones
root_b = eb.new('Root'); root_b.head, root_b.tail = (0, 0, 0), (0, 0, 1.0)
mtn = eb.new('Mountain'); mtn.head, mtn.tail = (0, 0, 0.05), (0, 0, BH * 0.5); mtn.parent = root_b
heart = eb.new('Heart'); heart.head, heart.tail = (0, py, 1.3), (0, py - 0.3, 1.3); heart.parent = mtn
# the combat code measures the clips' ground from the brawler's toes - still feet on the floor keep that at 0
for side, x in (('Left', 0.4), ('Right', -0.4)):
    f = eb.new(f'mixamorig:{side}Foot'); f.head, f.tail = (x, 0, 0.1), (x, -0.1, 0.02); f.parent = root_b
    t = eb.new(f'mixamorig:{side}ToeBase'); t.head, t.tail = (x, -0.1, 0.02), (x, -0.2, 0.0); t.parent = f
for name, A in arms.items():
    prev = mtn
    for i in range(3):
        b = eb.new(f'{name}_{i + 1}')
        b.head = A['root'] + A['d'] * A['L'] * JOINTS[i]
        b.tail = A['root'] + A['d'] * A['L'] * JOINTS[i + 1]
        b.parent = prev
        b.use_connect = i > 0
        prev = b
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 3. weights: the mountain and the pilot on Mountain, each arm along its three bones (soft at the joints)
def smooth(t, e0, e1):
    x = np.clip((t - e0) / (e1 - e0), 0, 1)
    return x * x * (3 - 2 * x)


for ob in (body, pilot):
    g = ob.vertex_groups.new(name='Mountain')
    g.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
for name, A in arms.items():
    ob = A['ob']
    co = np.array([x.co for x in ob.data.vertices])
    t = (co - np.array(A['root'])) @ np.array(A['d']) / A['L']
    s1, s2 = smooth(t, JOINTS[1] - 0.05, JOINTS[1] + 0.05), smooth(t, JOINTS[2] - 0.05, JOINTS[2] + 0.05)
    w = [1 - s1, s1 * (1 - s2), s2]
    for i in range(3):
        g = ob.vertex_groups.new(name=f'{name}_{i + 1}')
        for k in np.nonzero(w[i] > 1e-3)[0]:
            g.add([int(k)], float(w[i][k]), 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
parts = [body, pilot] + [A['ob'] for A in arms.values()]
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = 'NanoNova_Mesh'
mesh.parent = arm_ob
mod = mesh.modifiers.new('Armature', 'ARMATURE')
mod.object = arm_ob
log(f'mesh {sum(len(p.vertices) - 2 for p in mesh.data.polygons)} tris, {len(mesh.data.materials)} materials')

# ---- 4. clips
pb = arm_ob.pose.bones
for p in pb:
    p.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.to_3x3() for b in arm_ob.data.bones}
Z = Vector((0, 0, 1))


def local(bone, qw):
    """A rotation given in the rest armature axes -> the bone's local rotation."""
    Rr = REST[bone]
    return (Rr.inverted() @ qw.to_matrix() @ Rr).to_quaternion()


def lift_axis(name):
    d = arms[name]['d']
    a = d.cross(Z)
    return a.normalized() if a.length > 1e-3 else Vector((1, 0, 0))


def aim(name, to, bend=0.0, curl=0.0):
    """Arm pose: the shoulder turns the arm toward `to` (a world direction), elbow and wrist bend by bend/curl rad
    (+ = up, about the arm's own lift axis)."""
    d = arms[name]['d']
    q1 = d.rotation_difference(Vector(to).normalized())
    ax = lift_axis(name)
    return {f'{name}_1': q1, f'{name}_2': Quaternion(ax, bend), f'{name}_3': Quaternion(ax, curl)}


def rest(name, sway=0.0, lift=0.0):
    ax = lift_axis(name)
    return {f'{name}_1': Quaternion(Z, sway) @ Quaternion(ax, lift), f'{name}_2': Quaternion(ax, lift * 0.6),
            f'{name}_3': Quaternion(ax, lift * 0.4)}


def az(deg, z):
    r = math.radians(deg)
    return Vector((math.cos(r), math.sin(r), z))


FRONT = -90.0   # azimuth of the front (-Y)
clips = {}


def clip(name, length, keys, pulse=None, sink=None):
    """keys: [(0..1, {arm: pose dict})]; arms missing from a key sit at rest. pulse: [(0..1, scale)] for the heart
    and a hair of the mountain; sink: [(0..1, metres)] the arms drop into the slopes."""
    act = bpy.data.actions.new(name)
    arm_ob.animation_data_create()
    arm_ob.animation_data.action = act
    n = max(2, round(length * FPS))
    for t, pose in keys:
        f = 1 + t * (n - 1)
        full = {}
        for a in arms:
            full.update(pose.get(a, rest(a)))
        for bone, q in full.items():
            pb[bone].rotation_quaternion = local(bone, q)
            pb[bone].keyframe_insert('rotation_quaternion', frame=f)
    for t, s in (pulse or [(0, 1.0), (1, 1.0)]):
        f = 1 + t * (n - 1)
        pb['Heart'].scale = (s, s, s)
        pb['Heart'].keyframe_insert('scale', frame=f)
        m = 1.0 + (s - 1.0) * 0.12
        pb['Mountain'].scale = (m, m, m)
        pb['Mountain'].keyframe_insert('scale', frame=f)
    if sink:
        for t, dz in sink:
            f = 1 + t * (n - 1)
            for a in arms:
                b = pb[f'{a}_1']
                # bone local Y runs along the arm: sinking = backing the arm into its socket plus down
                b.location = (REST[b.name].inverted() @ (arms[a]['d'] * -dz * 0.5 + Vector((0, 0, -dz))))
                b.keyframe_insert('location', frame=f)
    act.use_fake_user = True
    clips[name] = (act, n)
    arm_ob.animation_data.action = None
    for p in pb:
        p.rotation_quaternion = (1, 0, 0, 0)
        p.location = (0, 0, 0)
        p.scale = (1, 1, 1)


BEAT = [(0, 1.0), (0.28, 1.0), (0.32, 1.35), (0.40, 1.05), (0.46, 1.25), (0.56, 1.0), (1, 1.0)]   # 박동 (두 번)
R = math.radians


def idle_keys(amp=1.0):
    ks = []
    for t in (0, 0.25, 0.5, 0.75, 1.0):
        pose = {}
        for i, a in enumerate(arms):
            ph = 2 * math.pi * (t + i * 0.23)
            pose[a] = rest(a, sway=R(4 * amp) * math.sin(ph), lift=R(3 * amp) * math.cos(ph))
        ks.append((t, pose))
    return ks


clip('idle', 2.4, idle_keys(), pulse=BEAT)
clip('walk', 2.4, idle_keys(1.5), pulse=BEAT)
# 셔터 팔: 뒤로 당겼다가(0.12) 방패째 앞으로 밀친다(0.22), 잠깐 버티고 돌아온다
clip('atk_charge', 1.8, [
    (0.0, {}), (0.12, {'shutter': aim('shutter', az(-160, 0.8), bend=R(20))}),
    (0.22, {'shutter': aim('shutter', az(FRONT - 15, -0.15), bend=R(-5))}),
    (0.45, {'shutter': aim('shutter', az(FRONT - 15, -0.15), bend=R(-5))}), (1.0, {})])
# 원의 팔: 왼쪽 뒤에서 들어 올려 앞을 가로질러 오른쪽으로 (0.29-0.535 에 앞을 지난다). 반경이 산 폭의 곱절 - 품 안이 안전하다(L14791)
spin = [(0.0, {}), (0.15, {'circle': aim('circle', az(-200, 0.35), curl=R(-20))})]
for t, ang in ((0.29, -150), (0.41, -95), (0.535, -40), (0.62, -5)):
    spin.append((t, {'circle': aim('circle', az(ang, -0.30), curl=R(-10))}))
spin += [(0.8, {'circle': aim('circle', az(20, 0.2))}), (1.0, {})]
clip('atk_spin', 2.2, spin)
# 원의 팔, 한 번 내려치기
clip('atk_scythe', 1.8, [(0.0, {}), (0.3, {'circle': aim('circle', az(FRONT, 1.6), curl=R(30))}),
                          (0.5, {'circle': aim('circle', az(FRONT, -0.45), curl=R(-25))}),
                          (0.65, {'circle': aim('circle', az(FRONT, -0.45), curl=R(-25))}), (1.0, {})])
# 접힘·무음 팔이 들렸다가 앞바닥을 내려찍는다 (0.48) - 코어 사출의 몸짓, 심장이 크게 뛴다
up = {'fold': aim('fold', az(-40, 1.8), bend=R(25)), 'silence': aim('silence', az(-150, 1.8), bend=R(25))}
down = {'fold': aim('fold', az(FRONT + 25, -0.55), bend=R(-15), curl=R(-15)),
        'silence': aim('silence', az(FRONT - 25, -0.55), bend=R(-15), curl=R(-15))}
clip('atk_hammer', 2.0, [(0.0, {}), (0.3, up), (0.48, down), (0.65, down), (1.0, {})],
     pulse=[(0, 1.0), (0.44, 1.0), (0.5, 1.6), (0.7, 1.0), (1, 1.0)])
# 모든 팔이 중심을 지키러 회수되며 앞으로 일제히 떨어진다 (L14829) - 0.31
fall = {a: aim(a, (0.0, -1.0, -0.35) if a != 'circle' else az(FRONT, -0.6), bend=R(-10), curl=R(-10)) for a in arms}
lift = {a: aim(a, (arms[a]['d'] * 0.5 + Z).normalized(), bend=R(15)) for a in arms}
clip('atk_slam', 2.0, [(0.0, {}), (0.18, lift), (0.31, fall), (0.5, fall), (1.0, {})], pulse=BEAT)
# 온라인 아이콘: 한 팔씩
clip('atk_hookR', 1.6, [(0.0, {}), (0.35, {'shutter': aim('shutter', az(-200, 0.3))}),
                         (0.54, {'shutter': aim('shutter', az(FRONT + 10, 0.0))}), (1.0, {})])
clip('atk_hookL', 1.6, [(0.0, {}), (0.35, {'fold': aim('fold', az(20, 0.3))}),
                         (0.54, {'fold': aim('fold', az(FRONT - 10, 0.0))}), (1.0, {})])
clip('atk_kick', 1.6, [(0.0, {}), (0.25, {'silence': aim('silence', az(-190, -0.1))}),
                        (0.41, {'silence': aim('silence', az(FRONT, -0.35))}), (1.0, {})])
clip('atk_bolt', 1.6, [(0.0, {}), (0.35, {'circle': aim('circle', az(FRONT, 0.2), curl=R(40))}), (1.0, {})],
     pulse=[(0, 1.0), (0.3, 1.0), (0.35, 1.7), (0.6, 1.0), (1, 1.0)])
jolt = {a: rest(a, sway=R(3), lift=R(8)) for a in arms}
clip('hit', 0.6, [(0.0, {}), (0.2, jolt), (1.0, {})], pulse=[(0, 1.0), (0.2, 0.85), (1, 1.0)])
recoil = {a: rest(a, sway=R(-6), lift=R(25)) for a in arms}
clip('stagger', 1.2, [(0.0, {}), (0.25, recoil), (0.6, recoil), (1.0, {})])
limp = {a: aim(a, (arms[a]['d'] * 0.4 + Vector((0, 0, -1))).normalized(), bend=R(-20), curl=R(-20)) for a in arms}
clip('down', 2.0, [(0.0, {}), (0.4, limp), (1.0, limp)])
# 꺼지는 산 (L14869): 팔이 사면으로 쓰러져 가라앉고, 심장이 잦아든다
clip('death', 3.0, [(0.0, {}), (0.35, limp), (1.0, limp)],
     pulse=[(0, 1.0), (0.2, 1.3), (0.5, 0.8), (1.0, 0.6)], sink=[(0, 0.0), (0.35, 0.0), (1.0, 3.0)])
log(f'{len(clips)} clips: {", ".join(clips)}')

# ---- 5. export: every action as a clip (the same way the brawler bodies go out, rig_boss_template.py)
bpy.ops.object.select_all(action='DESELECT')
arm_ob.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = arm_ob
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_image_format='JPEG',
                          export_jpeg_quality=90, export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
log('->', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB')

# ---- 6. preview: rest from the front-left, and a few clips at their contact
if 'preview' in opts:
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    scn.render.resolution_x, scn.render.resolution_y = 900, 600
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.02, 0.025, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    scn.world = world
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
    scn.collection.objects.link(sun)
    floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor'))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    bm.to_mesh(floor.data)
    scn.collection.objects.link(floor)
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.12, 0.12, 0.12, 1)
    floor.data.materials.append(fm)
    # a 1.8 m person for scale, 6 m in front
    man = bpy.data.objects.new('man', bpy.data.meshes.new('man'))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.5, 0.3, 1.8), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(2.0, BMN[1] - 6.0, 0.9), verts=bm.verts)
    bm.to_mesh(man.data)
    scn.collection.objects.link(man)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 24
    scn.collection.objects.link(cam)
    scn.camera = cam
    shots = []
    views = [('rest', None, 0, (-22, -30, 12)), ('idle', 'idle', 0.32, (0, -34, 9)), ('charge', 'atk_charge', 0.22, (-22, -30, 12)),
             ('spin', 'atk_spin', 0.41, (0, -40, 22)), ('hammer', 'atk_hammer', 0.48, (22, -30, 12)),
             ('slam', 'atk_slam', 0.31, (-22, -30, 12)), ('death', 'death', 1.0, (-22, -30, 12)), ('pilot', None, 0, (1.5, BMN[1] - 3.5, 1.7)),
             ('top', None, 0, (0, -0.01, 48)), ('front', None, 0, (0, -26, 5))]
    for tag, cname, t, loc in views:
        arm_ob.animation_data.action = clips[cname][0] if cname else None
        if cname:
            scn.frame_set(int(round(1 + t * (clips[cname][1] - 1))))
        else:
            for p in pb:
                p.rotation_quaternion, p.location, p.scale = (1, 0, 0, 0), (0, 0, 0), (1, 1, 1)
            scn.frame_set(1)
        cam.location = Vector(loc)
        look = Vector((0, py, 1.3)) if tag == 'pilot' else Vector((0, 0, BH * 0.55))
        cam.rotation_euler = (look - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = 50 if tag == 'pilot' else 24
        p = opts['preview'].replace('.png', f'_{tag}.png')
        scn.render.filepath = p
        bpy.ops.render.render(write_still=True)
        shots.append(p)
    log('preview', shots)
