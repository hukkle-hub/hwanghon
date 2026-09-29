# 새 보스 몸(Hi3D GLB) → 허수아비 보스 뼈대·클립 18개를 그대로 입힌다 (docs/design/151). Blender 5.x 배경 실행.
#   blender -b -P tools/3d/rig_boss_template.py -- <새 메시.glb> <키 m> <출력.glb> [--static]
# - 템플릿: art/3d/boss_anim.glb (mixamorig 23뼈, UE 의 DA_Boss_Training 이 이 이름으로 클립을 튼다)
# - 맞춤: 새 몸을 키(원문 수치 또는 설계값)에 맞추고 발바닥 = 0, 가로 가운데. 뼈대는 같은 배율로 균일 확대,
#   클립의 위치 키(골반 이동)도 같은 배율.
# - 무게: 뼈 선분까지 거리로 가장 가까운 두 뼈에 나눈다(1/d^4). 표면 모양과 무관해 Hi3D 의 뚫린 메시에서도 된다.
# - --static: 뼈 없이 크기·자리만 맞춘 정적 GLB (거미·뱀·탑처럼 사람 뼈대가 안 맞는 몸)
import bpy, sys, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
STATIC = '--static' in argv
# --hold=<bone>: big separate pieces (>= 5% of the vertices, not the body) ride that bone rigidly -
# the Clave's shutter in its left hand (EP02 L1774-L1796)
HOLD = next((a.split('=', 1)[1] for a in argv if a.startswith('--hold=')), None)
HOLD_BOX = '--hold-box' in argv   # the held piece is welded to the body: find it in space
argv = [a for a in argv if not a.startswith('--')]
SRC, HEIGHT, OUT = argv[0], float(argv[1]), argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEMPLATE = os.path.join(ROOT, 'art', '3d', 'boss_anim.glb')
MAX_TRIS = int(os.environ.get('MAX_TRIS', '60000'))

bpy.ops.wm.read_factory_settings(use_empty=True)


def meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def select(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


# ---- 1. new body: one mesh, height HEIGHT, feet on the ground, centred
bpy.ops.import_scene.gltf(filepath=SRC)
body = meshes()
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        o.select_set(False)
select(body)
if len(body) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'Boss_Mesh'
body.parent = None
select([body])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o)
mn, mx = bounds([body])
s = HEIGHT / (mx.z - mn.z)
body.scale = (s, s, s)
body.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
select([body])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > MAX_TRIS:
    m = body.modifiers.new('dec', 'DECIMATE')
    m.ratio = MAX_TRIS / tris
    bpy.ops.object.modifier_apply(modifier='dec')
print(f'[rig] body {SRC}: {tris} tris -> {sum(len(p.vertices) - 2 for p in body.data.polygons)}, height {HEIGHT} m')

# Hi3D v3 ships two 8192^2 maps per body - far past a phone's budget; the game gets MAX_TEX (2048)
MAX_TEX = int(os.environ.get('MAX_TEX', '2048'))
# textures ship as JPEG q90: a body GLB 11 MB -> 2.4 MB (two 2048^2 PNG maps were 9 of the 11)
JPEG = dict(export_image_format='JPEG', export_jpeg_quality=90)
for img in bpy.data.images:
    if img.size[0] > MAX_TEX or img.size[1] > MAX_TEX:
        img.scale(MAX_TEX, MAX_TEX)
        img.pack()
print(f'[rig] textures <= {MAX_TEX}: {[(i.name, tuple(i.size)) for i in bpy.data.images]}')

if STATIC:
    select([body])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, **JPEG)
    print('[rig] static ->', OUT)
    sys.exit(0)

# ---- 2. template skeleton + clips, scaled uniformly to the new height
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=TEMPLATE)
new = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in new if o.type == 'ARMATURE')
for o in new:
    if o.type == 'MESH':
        bpy.data.objects.remove(o)   # the scarecrow's own body (and its helper sphere)
t_mn, t_mx = Vector((0, 0, 0)), Vector((0, 0, 2.72))   # template body height (art/3d/boss_anim.glb)
k = HEIGHT / (t_mx.z - t_mn.z)
select([arm])
arm.scale = (arm.scale.x * k, arm.scale.y * k, arm.scale.z * k)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for act in bpy.data.actions:
    for fc in getattr(act, 'fcurves', []):
        if fc.data_path.endswith('location'):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k
    # Blender 5 layered actions
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                for fc in bag.fcurves:
                    if fc.data_path.endswith('location'):
                        for kp in fc.keyframe_points:
                            kp.co.y *= k
                            kp.handle_left.y *= k
                            kp.handle_right.y *= k

# --arms=<0..1> / --legs=<0..1>: the template clips are a brawler's (guard up at idle, hooks, kicks) - a Hi3D body's arms
# hang welded to its coat and its legs stand inside a coat skirt; raising them drags coat and torso along (idle x19 edge
# stretch on the Clave). Those rotations are pulled toward the rest pose: 1 = the clip as is, 0 = where the body was modelled.
def _f(name):
    return next((float(a.split('=', 1)[1]) for a in sys.argv if a.startswith(f'--{name}=')), 1.0)
DAMP = [(('Shoulder', 'Arm', 'ForeArm', 'Hand'), _f('arms')), (('UpLeg', 'Leg', 'Foot', 'ToeBase'), _f('legs')),
        (('Spine', 'Spine1', 'Spine2'), _f('spine'))]
if min(f for _, f in DAMP) < 1.0:
    def bags(act):
        for layer in getattr(act, 'layers', []):
            for strip in layer.strips:
                yield from getattr(strip, 'channelbags', [])
    for act in bpy.data.actions:
        for bag in bags(act):
            quat = {}
            for fc in bag.fcurves:
                if fc.data_path.endswith('rotation_quaternion'):
                    bone = fc.data_path.split('"')[1]
                    part = bone.split(':')[-1].replace('Left', '').replace('Right', '')
                    f = next((f for names, f in DAMP if part in names), 1.0)
                    if f < 1.0:
                        quat.setdefault(bone, [f, {}])[1][fc.array_index] = fc
            for bone, (f, ch) in quat.items():
                if len(ch) != 4 or len({len(c.keyframe_points) for c in ch.values()}) != 1:
                    continue
                for i in range(len(ch[0].keyframe_points)):
                    q = np.array([ch[c].keyframe_points[i].co.y for c in range(4)])
                    if q[0] < 0:
                        q = -q
                    q = (1 - f) * np.array([1.0, 0, 0, 0]) + f * q
                    q /= np.linalg.norm(q)
                    for c in range(4):
                        kp = ch[c].keyframe_points[i]
                        kp.co.y = kp.handle_left.y = kp.handle_right.y = float(q[c])
    print(f'[rig] rotations toward rest: {[(n[0], f) for n, f in DAMP]}')

# ---- 3. weights
# proxy (default): a watertight voxel copy takes Blender's bone-heat weights, then they are carried to the real surface
# (nearest face, interpolated). Hi3D meshes are open and layered, where bone heat fails and where nearest-bone weights
# tear (robe between the legs split between two thighs: x24 edge stretch, doc 151 §2.1).
WEIGHTS = os.environ.get('WEIGHTS', 'distance')   # measured: distance+smooth12 beats proxy (doc 151 §2.1)


def proxy_weights():
    select([body])
    bpy.ops.object.duplicate()
    proxy = bpy.context.view_layer.objects.active
    proxy.name = 'WeightProxy'
    rm = proxy.modifiers.new('vox', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = HEIGHT / float(os.environ.get('PROXY_RES', '90'))
    bpy.ops.object.modifier_apply(modifier='vox')
    select([proxy, arm], arm)
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    empty = sum(1 for v in proxy.data.vertices if not v.groups)
    print(f'[rig] proxy {len(proxy.data.vertices)} verts, {empty} without weight')
    for g in proxy.vertex_groups:
        if g.name not in body.vertex_groups:
            body.vertex_groups.new(name=g.name)
    dt = body.modifiers.new('wt', 'DATA_TRANSFER')
    dt.object = proxy
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    select([body])
    bpy.ops.object.modifier_apply(modifier='wt')
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    unweighted = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups) < 1e-4]
    print(f'[rig] transfer: {len(unweighted)} of {len(body.data.vertices)} vertices without weight, groups {len(body.vertex_groups)}')
    # a vertex the transfer missed takes the weights of the nearest vertex that has them
    if unweighted:
        from mathutils.kdtree import KDTree
        vs = body.data.vertices
        missing = set(unweighted)
        kd = KDTree(len(vs) - len(missing))
        for v in vs:
            if v.index not in missing:
                kd.insert(v.co, v.index)
        kd.balance()
        for i in unweighted:
            _, j, _ = kd.find(vs[i].co)
            for g in vs[j].groups:
                body.vertex_groups[g.group].add([i], g.weight, 'REPLACE')
    smooth_weights(int(os.environ.get('SMOOTH', '6')))
    bpy.data.objects.remove(proxy)


def smooth_weights(rounds, keep=4):
    """Neighbour averaging over mesh edges (half own, half neighbours), then the 4 strongest bones, normalised."""
    vs = body.data.vertices
    names = [g.name for g in body.vertex_groups]
    W = np.zeros((len(vs), len(names)))
    for v in vs:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    E2 = np.array([e.vertices[:] for e in body.data.edges])
    # touching pieces (robe hem on the torso) are smoothed together too, or they crack apart in motion
    from mathutils.kdtree import KDTree
    kd = KDTree(len(vs))
    for v in vs:
        kd.insert(v.co, v.index)
    kd.balance()
    near = float(os.environ.get('NEAR', '0.03'))
    pairs = [(v.index, j) for v in vs for (_, j, _) in kd.find_range(v.co, near) if j > v.index]
    if pairs:
        E2 = np.concatenate([E2, np.array(pairs)])
    deg = np.bincount(E2.ravel(), minlength=len(vs)).astype(float)
    # UV-seam twins (same spot, no edge) keep equal weights or the seam cracks open
    co = np.array([v.co[:] for v in vs])
    _, same = np.unique(np.round(co / 1e-5).astype(np.int64), axis=0, return_inverse=True)
    same = same.ravel()
    cnt = np.bincount(same).astype(float)

    def weld(M):
        acc = np.zeros((cnt.size, M.shape[1]))
        np.add.at(acc, same, M)
        return (acc / cnt[:, None])[same]
    W = weld(W)
    for _ in range(rounds):
        acc = np.zeros_like(W)
        np.add.at(acc, E2[:, 0], W[E2[:, 1]])
        np.add.at(acc, E2[:, 1], W[E2[:, 0]])
        has = deg > 0
        W[has] = 0.5 * W[has] + 0.5 * acc[has] / deg[has, None]
        W = weld(W)
    if keep:
        cut = np.sort(W, axis=1)[:, -keep][:, None]
        W[W < cut] = 0.0
    W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
    W = weld(W)
    for j, g in enumerate(body.vertex_groups):
        g.remove(list(range(len(vs))))
        idx = np.nonzero(W[:, j] > 1e-4)[0]
        for i in idx:
            g.add([int(i)], float(W[i, j]), 'REPLACE')


# nearest two bone segments, 1/d^4 (WEIGHTS=distance; also the rigid hold below)
bones = [b for b in arm.data.bones if b.use_deform and not b.name.endswith('HandSlot')]
heads = np.array([(arm.matrix_world @ b.head_local)[:] for b in bones])
tails = np.array([(arm.matrix_world @ b.tail_local)[:] for b in bones])
V = np.array([v.co[:] for v in body.data.vertices])
held = np.zeros(len(V), dtype=bool)
hb = next((j for j, bn in enumerate(bones) if bn.name == HOLD), 0)
if HOLD:
    # loose parts by union-find over edges
    par = np.arange(len(V))
    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    for e in body.data.edges:
        a_, b_ = find(e.vertices[0]), find(e.vertices[1])
        if a_ != b_:
            par[a_] = b_
    roots = np.array([find(i) for i in range(len(V))])
    ids, counts = np.unique(roots, return_counts=True)
    order = np.argsort(-counts)
    for kk in order[1:]:
        if counts[kk] >= 0.05 * len(V):
            m_ = roots == ids[kk]
            held |= m_
    if not held.any() and HOLD_BOX:
        # one welded mesh (Hi3D): the held slab is found in space - what rises past the head off to one side
        # (the Clave's shutter stands beside it, top above the helmet, L1774-L1796), then everything inside
        # that slab's footprint at any height
        top = V[:, 2] > 0.80 * HEIGHT
        side = top & (np.abs(V[:, 0]) > 0.16 * HEIGHT)
        if side.sum() > 50:
            sx = np.sign(np.median(V[side, 0]))
            pick = side & (np.sign(V[:, 0]) == sx)
            x0, x1 = np.percentile(V[pick, 0], [1, 99])
            y0, y1 = np.percentile(V[pick, 1], [1, 99])
            pad = 0.02 * HEIGHT
            held = (V[:, 0] >= min(x0, x1) - pad) & (V[:, 0] <= max(x0, x1) + pad) & (V[:, 1] >= y0 - pad) & (V[:, 1] <= y1 + pad)
            print(f'[rig] hold box x {x0:.2f}..{x1:.2f} y {y0:.2f}..{y1:.2f}: {int(held.sum())} vertices')
# the held slab is welded to the hand and coat: cut it loose (faces mostly inside -> slab), or the strip joining it to the
# body stretches with every step (398 bridge edges on the Clave, all x2+ in a kick)
if held.any() and not held.all():
    import bmesh
    bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
    lay = bm.faces.layers.int.new('held')
    for fa in bm.faces:
        fa[lay] = int(sum(held[v.index] for v in fa.verts) * 2 > len(fa.verts))
    cut = [e for e in bm.edges if len({fa[lay] for fa in e.link_faces}) == 2]
    bmesh.ops.split_edges(bm, edges=cut)
    bm.verts.index_update()
    n0 = len(held)
    held = np.array([all(fa[lay] for fa in v.link_faces) if v.link_faces else (v.index < n0 and bool(held[v.index])) for v in bm.verts])
    bm.faces.layers.int.remove(lay)
    bm.to_mesh(body.data); bm.free()
    V = np.array([v.co[:] for v in body.data.vertices])
    print(f'[rig] held slab cut loose along {len(cut)} edges: {int(held.sum())} vertices')
# centre the body (not the bounding box) on the skeleton: a held slab or a wing beside the body pulls the box
# centre off the spine - the Clave's shutter put the spine 30 cm off the torso and every joint in the wrong place
band = (V[:, 2] > 0.35 * HEIGHT) & (V[:, 2] < 0.80 * HEIGHT) & ~held
if band.sum() > 100:
    lo_, hi_ = np.percentile(V[band, :2], 2, axis=0), np.percentile(V[band, :2], 98, axis=0)
    c = np.array([(lo_[0] + hi_[0]) / 2, (lo_[1] + hi_[1]) / 2, 0.0])
    if np.linalg.norm(c) > 0.01 * HEIGHT:
        for v in body.data.vertices:
            v.co.x -= c[0]; v.co.y -= c[1]
        V = V - c
        print(f'[rig] body recentred by ({c[0]:+.2f}, {c[1]:+.2f}) m onto the torso')
seg = tails - heads
L2 = np.maximum((seg ** 2).sum(1), 1e-8)
D = np.empty((len(V), len(bones)))
for j in range(len(bones)):
    t = np.clip(((V - heads[j]) @ seg[j]) / L2[j], 0, 1)
    P = heads[j] + t[:, None] * seg[j]
    D[:, j] = np.sqrt(((V - P) ** 2).sum(1))
near = np.argsort(D, axis=1)[:, :2]
d = np.take_along_axis(D, near, axis=1) + 1e-3
w = 1.0 / d ** 4
w /= w.sum(1, keepdims=True)
if HOLD:
    near[held] = hb
    w[held] = [1.0, 0.0]
    print(f'[rig] {int(held.sum())} vertices of {len(ids)} parts ride {HOLD}')
if WEIGHTS == 'proxy':
    proxy_weights()
    if held.any():
        for g in body.vertex_groups:
            g.remove([int(i) for i in np.nonzero(held)[0]])
        g = body.vertex_groups[bones[hb].name] if bones[hb].name in body.vertex_groups else body.vertex_groups.new(name=bones[hb].name)
        g.add([int(i) for i in np.nonzero(held)[0]], 1.0, 'REPLACE')
else:
    for b in bones:
        body.vertex_groups.new(name=b.name)
    for j, b in enumerate(bones):
        g = body.vertex_groups[b.name]
        for col in range(2):
            idx = np.nonzero(near[:, col] == j)[0]
            for i in idx:
                g.add([int(i)], float(w[i, col]), 'ADD')
    if int(os.environ.get('SMOOTH', '12')) > 0:
        smooth_weights(int(os.environ.get('SMOOTH', '12')))
        if held.any():   # the held piece stays rigid
            for g in body.vertex_groups:
                g.remove([int(i) for i in np.nonzero(held)[0]])
            body.vertex_groups[bones[hb].name].add([int(i) for i in np.nonzero(held)[0]], 1.0, 'REPLACE')
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
print(f'[rig] {len(bones)} bones weighted, {len(bpy.data.actions)} clips, skeleton x{k:.3f}')

# ---- 4. export: mesh + skeleton + every clip
select([arm, body], arm)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, **JPEG, export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True)
print('[rig] ->', OUT)
