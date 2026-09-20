# 속옷 차림 «맨몸» — 옷을 갈아입으려면 먼저 몸이 있어야 한다.
#
# 지금 캐릭터 GLB 는 옷이 메시에 통째로 구워져 있다 (메시 하나, 재질 하나).
# 그래서 «벗은 상태» 가 없고, 새 옷은 항상 기존 옷 «위에» 얹힌다 — #97 방어구가
# 간판처럼 보인 진짜 이유다. 이 스크립트는 그 바탕이 될 몸을 굽는다.
#
# 절차 생성으로 사람 몸을 빚는 것은 #97 에서 이미 실패했다. 그래서 여기서는
# 빚지 않는다. CC0 로 풀린 MakeHuman hm08 기본 메시를 가져와, «캐릭터 골격의
# 비율로 옮기기만» 한다. 비율은 추정하지 않는다 — 골격이 이미 알고 있다.
#
# 사용: python3 tools/3d/build_body.py [ain|kain|ryu|sera ...]
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'art/3d/base/mh_base.obj')
MH2M = 0.1          # MakeHuman 단위는 데시미터

# ── 기본 메시 관절 → 믹사모 뼈. 정규화 높이로 맞춰 본 결과 (docs/design/38 §2)
MAP = {
    'Hips':        ('pelvis',     'spine-3'),
    'Spine':       ('spine-3',    'spine-2'),
    'Spine1':      ('spine-2',    'spine-1'),
    'Spine2':      ('spine-1',    'neck'),
    'Neck':        ('neck',       'head'),
    'Head':        ('head',       'head-2'),
    '@Shoulder':   ('@-clavicle', '@-shoulder'),
    '@Arm':        ('@-shoulder', '@-elbow'),
    '@ForeArm':    ('@-elbow',    '@-hand'),
    '@Hand':       ('@-hand',     '@-hand-3'),
    '@UpLeg':      ('@-upper-leg','@-knee'),
    '@Leg':        ('@-knee',     '@-ankle'),
    '@Foot':       ('@-ankle',    '@-foot-1'),
    '@ToeBase':    ('@-foot-1',   '@-foot-2'),
}
SIDES = {'Left': 'l', 'Right': 'r'}

# ── 캐릭터마다 다른 «체격». 골격이 주지 않는 것은 살집뿐이라 여기만 손으로 잡는다.
#    girth: 몸통·팔다리 둘레 배수 · bust: 가슴 부피(m) · waist: 허리 조임
BUILD = {
    'ain':  dict(sex='f', girth=1.02, arm=1.04, leg=1.02, bust=0.048, waist=0.92),
    'kain': dict(sex='m', girth=1.18, arm=1.38, leg=1.16, bust=0.0,   waist=1.02),
    'ryu':  dict(sex='m', girth=1.06, arm=1.16, leg=1.06, bust=0.0,   waist=0.96),
    'sera': dict(sex='f', girth=1.00, arm=1.00, leg=1.00, bust=0.052, waist=0.90),
}

# ══ 기본 메시 읽기 ═══════════════════════════════════════════════════════════
def read_base():
    """body 그룹의 정점·면과, joint-* 헬퍼 상자의 중심을 돌려준다 (Blender Z-up, m)."""
    V, groups, cur = [], {}, None
    faces = {}
    for ln in open(BASE):
        if ln.startswith('v '):
            p = ln.split()
            # obj 는 Y-up·+Z 앞 → Blender 는 Z-up·−Y 앞
            V.append(Vector((float(p[1]), -float(p[3]), float(p[2]))) * MH2M)
        elif ln.startswith('g '):
            cur = ln[2:].strip(); groups.setdefault(cur, set()); faces.setdefault(cur, [])
        elif ln.startswith('f '):
            f = [int(t.split('/')[0]) - 1 for t in ln.split()[1:]]
            faces[cur].append(f)
            groups[cur].update(f)
    J = {}
    for g, idx in groups.items():
        if not g.startswith('joint-') or not idx: continue
        c = Vector((0, 0, 0))
        for i in idx: c += V[i]
        J[g[6:]] = c / len(idx)
    # body 만 남기고 정점 재색인
    used = sorted(groups['body'])
    remap = {v: i for i, v in enumerate(used)}
    bv = [V[i] for i in used]
    bf = [[remap[i] for i in f] for f in faces['body']]
    return bv, bf, J

def taubin(verts, faces, lam=0.58, mu=-0.62, iters=14):
    """hm08 은 «세분 곡면의 제어 격자» 다 — 격자 자체는 1 mm 쯤 톱니처럼 일렁인다.
    그대로 구우면 몸 전체에 비늘 같은 무늬가 뜬다. 라플라스 평활만 반복하면 몸이 줄어들므로,
    줄이는 걸음(lam)과 되돌리는 걸음(mu)을 번갈아 밟아 형태는 두고 잔물결만 깎는다."""
    adj = [set() for _ in verts]
    for f in faces:
        n = len(f)
        for i in range(n):
            a, b = f[i], f[(i + 1) % n]
            adj[a].add(b); adj[b].add(a)
    adj = [tuple(a) for a in adj]
    for it in range(iters):
        k = lam if it % 2 == 0 else mu
        nv = []
        for i, p in enumerate(verts):
            ns = adj[i]
            if not ns: nv.append(p); continue
            c = Vector((0, 0, 0))
            for j in ns: c += verts[j]
            nv.append(p + (c / len(ns) - p) * k)
        verts = nv
    return verts


def roughness(verts, faces):
    """잔물결 크기 = 이웃 평균에서 얼마나 벗어나는가 (m)"""
    adj = [set() for _ in verts]
    for f in faces:
        n = len(f)
        for i in range(n):
            a, b = f[i], f[(i + 1) % n]
            adj[a].add(b); adj[b].add(a)
    d = []
    for i, p in enumerate(verts):
        ns = tuple(adj[i])
        if not ns: continue
        c = Vector((0, 0, 0))
        for j in ns: c += verts[j]
        d.append((p - c / len(ns)).length)
    d.sort()
    return d[len(d) // 2], d[int(len(d) * 0.9)]


# ══ 뼈대 짝짓기 ══════════════════════════════════════════════════════════════
def base_bones(J):
    out = {}
    for name, (h, t) in MAP.items():
        if name.startswith('@'):
            for side, s in SIDES.items():
                hn, tn = h.replace('@', s), t.replace('@', s)
                if hn in J and tn in J:
                    out[side + name[1:]] = (J[hn].copy(), J[tn].copy())
        elif h in J and t in J:
            out[name] = (J[h].copy(), J[t].copy())
    return out

def char_bones(arm):
    out = {}
    for b in arm.data.bones:
        n = b.name.replace('mixamorig:', '')
        out[n] = (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local)
    return out

def frame(h, t):
    """뼈 한 개의 좌표계. 두 뼈대에 «같은 규칙» 을 쓰므로 비틀림이 생기지 않는다."""
    y = (t - h)
    L = y.length
    y = y / L if L > 1e-9 else Vector((0, 1, 0))
    ref = Vector((0, 0, 1)) if abs(y.z) < 0.85 else Vector((0, -1, 0))
    x = ref.cross(y)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)).cross(y)
    x.normalize()
    z = y.cross(x).normalized()
    M = Matrix((( x.x, y.x, z.x, h.x),
                ( x.y, y.y, z.y, h.y),
                ( x.z, y.z, z.z, h.z),
                ( 0,   0,   0,   1 )))
    return M, L

# ══ 살 옮기기 — 선형 혼합 스키닝, 가중치는 뼈까지의 거리 ══════════════════════
def seg_dist(p, h, t):
    d = t - h; L2 = d.dot(d)
    u = 0.0 if L2 < 1e-12 else max(0.0, min(1.0, (p - h).dot(d) / L2))
    return (p - (h + d * u)).length

def warp(verts, B0, B1, girth):
    names = [n for n in B0 if n in B1]
    F0 = {n: frame(*B0[n]) for n in names}
    F1 = {n: frame(*B1[n]) for n in names}
    # 뼈마다 «축 방향은 길이비, 옆면은 둘레비» 로 늘린다
    X = {}
    for n in names:
        (M0, L0), (M1, L1) = F0[n], F1[n]
        g = girth(n)
        S = Matrix.Diagonal((g, L1 / L0 if L0 > 1e-9 else 1.0, g, 1.0))
        X[n] = M1 @ S @ M0.inverted()
    # 가까운 뼈 «네 개만» 고르면 이웃한 정점끼리 고른 뼈가 달라지는 순간 표면이 튄다 —
    # 잔물결처럼 보였다. 모든 뼈를 쓰되 거리로 급히 떨어뜨리면 연속이라 매끈하다.
    out = []
    for p in verts:
        ws = [(1.0 / (seg_dist(p, *B0[n]) ** 4 + 1e-7), n) for n in names]
        s = sum(w for w, _ in ws)
        q = Vector((0, 0, 0))
        for w, n in ws:
            q += (X[n] @ p) * (w / s)
        out.append(q)
    return out

def adjacency(nverts, faces):
    adj = [set() for _ in range(nverts)]
    for f in faces:
        n = len(f)
        for i in range(n):
            a, b = f[i], f[(i + 1) % n]
            adj[a].add(b); adj[b].add(a)
    return [tuple(a) for a in adj]


def skin_weights(bv, faces, B0, names, K=4, rounds=4):
    """살을 뼈에 매는 일. 옷 입은 메시에서 «가장 가까운 점» 으로 베껴 오면,
    아인의 발목까지 내려오는 외투 자락이 발보다 가까워 발이 엉덩이를 따라간다 —
    실제로 발밑에 널빤지가 생겼다. 기본 자세에서는 팔다리가 서로 떨어져 있으므로
    «기본 메시 좌표에서 뼈까지의 거리» 로 직접 매는 쪽이 틀릴 여지가 없다."""
    W = []
    for v in bv:
        ds = sorted((seg_dist(v, *B0[n]), n) for n in names)[:K]
        ws = [(1.0 / (d ** 3 + 1e-6), n) for d, n in ds]
        t = sum(w for w, _ in ws)
        W.append({n: w / t for w, n in ws})
    adj = adjacency(len(bv), faces)
    for _ in range(rounds):                      # 관절이 접힐 때 각지지 않게 풀어 준다
        NW = []
        for i, w in enumerate(W):
            acc = dict(w)
            for j in adj[i]:
                for k, v in W[j].items(): acc[k] = acc.get(k, 0.0) + v
            n = 1 + len(adj[i])
            top = sorted(((v / n, k) for k, v in acc.items()), reverse=True)[:K]
            t = sum(v for v, _ in top) or 1.0
            NW.append({k: v / t for v, k in top})
        W = NW
    return W


def apply_weights(ob, W):
    gs = {}
    for w in W:
        for n in w:
            if n not in gs: gs[n] = ob.vertex_groups.new(name='mixamorig:' + n)
    for i, w in enumerate(W):
        for n, v in w.items():
            if v > 1e-4: gs[n].add([i], v, 'REPLACE')


# ══ 살집 — 골격이 말해 주지 않는 부분 ════════════════════════════════════════
def shape(verts, near, B1, cfg):
    """가슴 부피. 골격에는 없고 체형에는 있는 것."""
    if cfg['bust'] <= 0: return
    sp2 = B1['Spine2'][0]; nk = B1['Neck'][0]
    cz = sp2.z + (nk.z - sp2.z) * 0.38
    half = abs(B1['LeftArm'][0].x) * 0.40
    R = 0.115
    for i, p in enumerate(verts):
        if near[i] not in ('Spine2', 'Spine1', 'Neck'): continue
        if p.y > sp2.y - 0.01: continue                          # 앞면만
        for sx in (-1, 1):
            c = Vector((sx * half, sp2.y, cz))
            d = (p - c).length
            if d >= R: continue
            w = math.cos(d / R * math.pi * 0.5) ** 2             # 가장자리에서 기울기 0 → 봉우리가 안 생긴다
            verts[i] = p + Vector((sx * 0.30, -1.0, -0.12)).normalized() * (cfg['bust'] * w)

ARMS = {'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'}


def bands_of(B1, cfg):
    hips = B1['Hips'][0].z; leg = B1['LeftUpLeg'][0].z
    sp2 = B1['Spine2'][0].z; nk = B1['Neck'][0].z
    out = [(leg - 0.150, hips + 0.055)]                                  # 반바지
    if cfg['sex'] == 'f':
        out.append((sp2 + (nk - sp2) * 0.10, sp2 + (nk - sp2) * 0.80))   # 가슴 띠
    return out


# ══ Blender ══════════════════════════════════════════════════════════════════
def mk_mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate(); me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

def push_out(ob, d):
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.normal_update()
    for v in bm.verts: v.co += v.normal * d
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

def mat_skin(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.80
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0.18
    return m

def mat_cloth(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.88
    return m

def cut_at(ob, z, keep_top):
    """평면으로 깔끔하게 자른다 — 정점 단위로 고르면 톱니가 된다."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                           plane_co=(0, 0, z), plane_no=(0, 0, 1),
                           clear_inner=keep_top, clear_outer=not keep_top)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()


def keep_biggest(ob):
    """이어진 덩어리 중 가장 큰 것만. 띠를 자르면 팔은 따로 떨어진 고리가 된다."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    seen, groups = set(), []
    for v in bm.verts:
        if v in seen: continue
        stack, comp = [v], []; seen.add(v)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen: seen.add(o); stack.append(o)
        groups.append(comp)
    groups.sort(key=len, reverse=True)
    drop = [v for g in groups[1:] for v in g]
    if drop: bmesh.ops.delete(bm, geom=drop, context='VERTS')
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return len(groups)


def cap_holes(ob, rounds=6):
    """잘린 자리를 메우고 둥글린다 — 재단용 인형의 목처럼."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bm.faces.ensure_lookup_table()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        grown = {v for e in edges for v in e.verts}
        for _ in range(2):
            grown |= {e.other_vert(v) for v in list(grown) for e in v.link_edges}
        for _ in range(rounds):
            bmesh.ops.smooth_vert(bm, verts=list(grown), factor=0.5,
                                  use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return len(edges)


def base_image(mesh):
    """밑색 텍스처. 바로 연결돼 있지 않은 캐릭터가 있어 그래프를 거슬러 찾는다."""
    for m in mesh.data.materials:
        if not m or not m.use_nodes: continue
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf: continue
        seen, stack = set(), [l.from_node for l in bsdf.inputs['Base Color'].links]
        while stack:
            n = stack.pop()
            if n in seen: continue
            seen.add(n)
            if n.type == 'TEX_IMAGE' and n.image: return n.image
            for i in n.inputs:
                stack += [l.from_node for l in i.links]
    for m in mesh.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: return n.image
    return None


def skin_tone(mesh):
    """캐릭터 «자기 텍스처» 에서 얼굴 살색을 읽는다 — 목 이음새가 튀지 않도록."""
    img = base_image(mesh)
    if img is None: return (0.53, 0.42, 0.40)
    me = mesh.data
    uv = me.uv_layers.active.data
    hi = max(v.co.z for v in me.vertices)
    band = (hi - 0.16, hi - 0.04)                                 # 머리 꼭대기 아래 = 얼굴
    px = list(img.pixels); W, H = img.size
    got = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            if not (band[0] <= v.co.z <= band[1]): continue
            if v.normal.y > -0.62: continue                        # 앞을 보는 면 = 얼굴
            u, w = uv[li].uv
            x = int((u % 1.0) * (W - 1)); y = int((w % 1.0) * (H - 1))
            o = (y * W + x) * 4
            got.append((px[o], px[o + 1], px[o + 2]))
    # 얼굴 화소의 대부분은 머리카락·눈·그림자다. «살색다운» 것만 남긴다: r≥g≥b, 너무 어둡지도 붉지도 않게
    # 얼굴 화소의 대부분은 머리카락·수염·그늘이다. 밝기 하한을 올리고 위쪽 값을 쓴다 —
    # 중앙값을 쓰면 카인은 수염 때문에 «검은 피부» 가 나왔다.
    skin = [c for c in got if max(c) > 0.26 and c[0] >= c[1] >= c[2] and 0.02 < c[0] - c[2] < 0.45]
    use = skin if len(skin) >= 40 else got
    if not use: return (0.53, 0.42, 0.40)
    use.sort(key=sum)
    q = use[int(len(use) * 0.70)]
    # 밝은 쪽을 고르면 하이라이트가 섞여 «회색» 이 된다. 밝기는 그대로 두고 살빛 쪽으로 당긴다.
    L = 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]
    warm = (1.00, 0.80, 0.70)
    wl = 0.2126 * warm[0] + 0.7152 * warm[1] + 0.0722 * warm[2]
    tgt = [c * L / wl for c in warm]
    return tuple(min(1.0, q[i] * 0.45 + tgt[i] * 0.55) for i in range(3))

def fix_orphans(ob):
    """가중치가 하나도 없는 정점은 글턴에서 «관절 0, 무게 0» 이 되어 원점으로 끌려간다.
    발밑에 널빤지처럼 늘어난 면이 그것이었다. 가장 가까운 «가중치 있는» 정점에서 베껴 온다."""
    me = ob.data
    have = [v for v in me.vertices if sum(g.weight for g in v.groups) > 1e-5]
    empty = [v for v in me.vertices if sum(g.weight for g in v.groups) <= 1e-5]
    if not empty or not have: return 0
    for v in empty:
        n = min(have, key=lambda u: (u.co - v.co).length_squared)
        for g in n.groups:
            ob.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
    return len(empty)


# ══ 한 캐릭터 굽기 ═══════════════════════════════════════════════════════════
def build_one(char, with_head=True):
    cfg = BUILD[char]
    bv, bf, J = read_base()
    bv = taubin(bv, bf)
    gz = J['ground'].z
    for v in bv: v.z -= gz
    for k in J: J[k] = Vector((J[k].x, J[k].y, J[k].z - gz))
    B0 = base_bones(J)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'art/3d/%s_anim.glb' % char))
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    # 카인·류·세라 GLB 에는 42 정점짜리 보조 구가 하나 더 들어 있다 — 가중치를 가진 쪽이 몸이다
    src = max((o for o in bpy.data.objects if o.type == 'MESH' and o.vertex_groups),
              key=lambda o: len(o.data.vertices))
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not src]:
        bpy.data.objects.remove(o, do_unlink=True)
    B1 = char_bones(arm)

    # 믹사모 Head 뼈는 목에서 8 cm 만 뻗는다 — 그 길이로 두개골을 눌러 담으면 머리가 납작해진다.
    hh, ht = B1['Head']
    scale = B1['Neck'][0].z / B0['Neck'][0].z
    B1['Head'] = (hh, hh + (ht - hh).normalized() * (B0['Head'][1] - B0['Head'][0]).length * scale)

    def girth(n):
        g = scale * cfg['girth']
        if 'Arm' in n or 'Hand' in n or 'Shoulder' in n: g = scale * cfg['arm']
        elif 'Leg' in n or 'Foot' in n or 'Toe' in n:    g = scale * cfg['leg']
        if n == 'Spine':  g *= cfg['waist']
        if n == 'Spine1': g *= (cfg['waist'] + 1) * 0.5
        return g

    names = [n for n in B0 if n in B1]
    verts = warp(bv, B0, B1, girth)
    near = [min(names, key=lambda n: seg_dist(p, *B0[n])) for p in bv]
    shape(verts, near, B1, cfg)

    body = mk_mesh(char + '_body', verts, bf)
    zneck = B1['Neck'][0].z + 0.060
    if not with_head:
        cut_at(body, zneck, keep_top=False)     # 얼굴은 못 가져온다 — 재단용 인형으로 마감
        cap_holes(body)
    tone = skin_tone(src)
    body.data.materials.append(mat_skin('skin_' + char, tone))

    # ── 속옷은 «몸의 껍질을 한 겹 띄운 것». 따로 빚지 않으므로 몸에 딱 맞는다.
    #    띠를 면 단위로 고르면 가장자리가 계단이 된다. 평면으로 자른다.
    torso = [f for f in bf if all(near[i] not in ARMS for i in f)]
    parts = []
    for bi, (lo, hi) in enumerate(bands_of(B1, cfg)):
        ob = mk_mesh('%s_uw%d' % (char, bi), verts, torso)
        cut_at(ob, hi, keep_top=False); cut_at(ob, lo, keep_top=True)
        keep_biggest(ob)                       # 팔은 따로 떨어진 고리 — 몸통만 남는다
        if not ob.data.polygons: bpy.data.objects.remove(ob, do_unlink=True); continue
        push_out(ob, 0.006)
        parts.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1: bpy.ops.object.join()
    uw = bpy.context.view_layer.objects.active
    uw.name = uw.data.name = char + '_underwear'   # 글턴은 «메시 데이터» 이름을 쓴다
    uw.data.materials.clear()
    uw.data.materials.append(mat_cloth('wear_' + char, (0.055, 0.052, 0.060)))

    apply_weights(body, skin_weights(bv, bf, B0, names))
    bpy.ops.object.select_all(action='DESELECT')
    uw.select_set(True); body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS', use_create=True,
                                 vert_mapping='NEAREST', layers_select_src='ALL',
                                 layers_select_dst='NAME', mix_mode='REPLACE')
    orphan = fix_orphans(body) + fix_orphans(uw)
    for ob in (body, uw):
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True); arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.shade_smooth()

    bpy.data.objects.remove(src, do_unlink=True)
    bpy.ops.object.select_all(action='SELECT')
    out = os.path.join(ROOT, 'art/3d/%s_body.glb' % char)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
                              export_animations=True, export_apply=False,
                              export_yup=True, export_materials='EXPORT')
    kb = os.path.getsize(out) / 1024
    print('BODY %-5s 살색 %.2f/%.2f/%.2f  몸 %d정점  속옷 %d정점  머리%s  외톨이%d  %.0f KB'
          % (char, *tone, len(body.data.vertices), len(uw.data.vertices),
             'O' if with_head else 'X', orphan, kb), file=sys.stderr)


if __name__ == '__main__':
    args = sys.argv[1:]
    head = '--no-head' not in args
    for c in ([a for a in args if not a.startswith('-')] or ['ain', 'kain', 'ryu', 'sera']):
        build_one(c, with_head=head)
