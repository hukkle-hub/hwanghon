# 속옷 차림 기본 체형 v2 — 손으로 빚지 않고 «에셋을 가져와 적용»한다.
#
# v1 (build_body.py) 은 MakeHuman hm08 을 썼다. 해부는 맞지만 민머리에 얼굴이 없어
# «가봉 인형» 이상이 되지 못했다. 디렉터: 「늘씬하고 이쁜 에셋을 가져오자」.
#
# 그래서 VRoid Studio 기본 모델(CC0)을 쓴다. 이 에셋이 좋은 이유는 예뻐서만이 아니다:
#   · 재질 이름이 쓰임을 밝힌다 — _SKIN / _FACE / _EYE / _HAIR / _CLOTH
#     → 옷을 «지우는» 게 아니라 «안 가져오면» 된다. 우리 캐릭터에 없는 바로 그것.
#   · 뼈 이름이 믹사모와 1:1 (J_Bip_C_Hips → Hips)
#     → 관절 헬퍼를 뒤질 필요 없이 골격끼리 바로 짝지어진다.
#
# 비율은 v1 과 같다: 키·어깨 나비·팔다리 길이는 «캐릭터 골격» 에서 나온다.
# 가져온 것은 «생김새» 이지 «체격» 이 아니다.
#
# 사용: python3 tools/3d/build_body_vroid.py [ain|kain|ryu|sera ...]
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_body import (frame, seg_dist, warp, char_bones, adjacency, skin_tone,
                        skin_weights, apply_weights, mk_mesh, fix_orphans)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# VRoid 는 +y 를 보고 선다. 우리 캐릭터는 −y — 그래서 VRoid 의 «왼쪽» 은 우리 기준 오른쪽이다.
# 돌려 두지 않으면 왼팔이 오른쪽으로 가 몸통이 꼬인다 (첫 판에서 허리가 한 점으로 오므라들었다).
# 개체 회전으로 돌리면 메시가 뼈대 부모를 타고 두 번 돌아간다. 좌표를 직접 돌린다.
YAW = Matrix.Rotation(math.pi, 4, 'Z')

# ── VRoid 뼈 → 믹사모 뼈. 꼬리는 «자식의 머리» 로 잡는다 (자동 꼬리는 방향이 제멋대로다)
VB = 'J_Bip_'
CHAIN = [
    ('Hips',     VB + 'C_Hips',      VB + 'C_Spine'),
    ('Spine',    VB + 'C_Spine',     VB + 'C_Chest'),
    ('Spine1',   VB + 'C_Chest',     VB + 'C_UpperChest'),
    ('Spine2',   VB + 'C_UpperChest', VB + 'C_Neck'),
    ('Neck',     VB + 'C_Neck',      VB + 'C_Head'),
    ('Head',     VB + 'C_Head',      None),            # 두개골 꼭대기로 따로 잡는다
]
for L, s in (('Left', 'L'), ('Right', 'R')):
    CHAIN += [
        (L + 'Shoulder', VB + s + '_Shoulder', VB + s + '_UpperArm'),
        (L + 'Arm',      VB + s + '_UpperArm', VB + s + '_LowerArm'),
        (L + 'ForeArm',  VB + s + '_LowerArm', VB + s + '_Hand'),
        (L + 'Hand',     VB + s + '_Hand',     VB + s + '_Middle1'),
        (L + 'UpLeg',    VB + s + '_UpperLeg', VB + s + '_LowerLeg'),
        (L + 'Leg',      VB + s + '_LowerLeg', VB + s + '_Foot'),
        (L + 'Foot',     VB + s + '_Foot',     VB + s + '_ToeBase'),
        (L + 'ToeBase',  VB + s + '_ToeBase',  VB + s + '_ToeBase_end'),
    ]

# ── 남자 몸 / 여자 몸, 그리고 캐릭터마다 다른 살집
BASE = {'ain': 'female', 'sera': 'female', 'kain': 'male', 'ryu': 'male'}
BUILD = {
    'ain':  dict(girth=1.06, arm=1.15, leg=1.04, waist=0.96),
    'kain': dict(girth=1.26, arm=1.55, leg=1.22, waist=1.04),
    'ryu':  dict(girth=1.12, arm=1.32, leg=1.10, waist=0.98),
    'sera': dict(girth=1.05, arm=1.12, leg=1.05, waist=0.94),
}
# 옷은 «가져오지 않는다». 살·얼굴·눈·머리카락만.
KEEP = ('_SKIN', '_FACE', '_EYE', '_HAIR')


def load_base(kind):
    """VRM 을 읽어 옷을 뺀 한 덩어리와 뼈 위치를 돌려준다."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src = os.path.join(ROOT, 'art/3d/base/vroid_%s.vrm' % kind)
    tmp = '/tmp/claude-0/_vroid_%s.glb' % kind
    if not os.path.exists(tmp):
        os.makedirs('/tmp/claude-0', exist_ok=True)
        open(tmp, 'wb').write(open(src, 'rb').read())      # .vrm 은 glb 다
    bpy.ops.import_scene.gltf(filepath=tmp)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    B = {}
    for b in arm.data.bones:
        B[b.name] = YAW @ (arm.matrix_world @ b.head_local)
    bones = {}
    for name, h, t in CHAIN:
        if h not in B: continue
        if t is None: continue
        if t not in B: continue
        bones[name] = (B[h].copy(), B[t].copy())
    return arm, bones, B


def strip_clothes(objs):
    """옷은 «지우는» 게 아니라 안 가져오는 것 — 재질 이름이 쓰임을 밝혀 준다."""
    kept, dropped = [], []
    for ob in objs:
        keep_slots = set()
        for i, m in enumerate(ob.data.materials):
            nm = (m.name if m else '')
            (keep_slots.add(i) if any(nm.endswith(k) or k + '.' in nm for k in KEEP)
             else dropped.append(nm))
        bm = bmesh.new(); bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if f.material_index not in keep_slots]
        if kill: bmesh.ops.delete(bm, geom=kill, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(ob.data); bm.free(); ob.data.update()
        if ob.data.polygons: kept.append(ob)
        else: bpy.data.objects.remove(ob, do_unlink=True)
    return kept, dropped


def img_stats(px):
    """밝고 살빛다운 화소의 중앙값 — 그 그림의 «살색»"""
    got = [(px[i], px[i + 1], px[i + 2]) for i in range(0, len(px), 4)
           if px[i + 3] > 0.5 and max(px[i], px[i + 1], px[i + 2]) > 0.30
           and px[i] >= px[i + 1] >= px[i + 2]]
    if not got: return (0.8, 0.7, 0.65)
    got.sort(key=sum)
    return got[len(got) // 2]


def leg_mask(ob, img, kneez, lo=None, grow=6):
    """무릎 아래 면이 쓰는 텍스처 «면» 을 칠한다.

    그냥 어두운 화소를 다 지우면 남자 기본 속옷(진회색 반바지)까지 표백된다.
    꼭짓점 둘레만 찍으면 삼각형 속이 남아 줄무늬가 된다 — 둘 다 겪었다.
    그래서 삼각형을 제대로 채운다."""
    W, H = img.size
    me = ob.data
    uv = me.uv_layers.active.data
    mask = bytearray(W * H)

    def tri(p0, p1, p2):
        xs = [p[0] for p in (p0, p1, p2)]; ys = [p[1] for p in (p0, p1, p2)]
        x0, x1 = max(0, int(min(xs)) - 1), min(W - 1, int(max(xs)) + 1)
        y0, y1 = max(0, int(min(ys)) - 1), min(H - 1, int(max(ys)) + 1)
        if (x1 - x0) > W // 2 or (y1 - y0) > H // 2: return      # UV 이음새를 넘는 삼각형은 건너뛴다
        d = ((p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]))
        if abs(d) < 1e-9: return
        for y in range(y0, y1 + 1):
            row = y * W
            for x in range(x0, x1 + 1):
                a = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / d
                b = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / d
                if a >= -0.02 and b >= -0.02 and a + b <= 1.02: mask[row + x] = 1

    for poly in me.polygons:
        zs = [me.vertices[i].co.z for i in poly.vertices]
        if max(zs) > kneez: continue
        if lo is not None and min(zs) < lo: continue
        pts = []
        for li in poly.loop_indices:
            u, v = uv[li].uv
            pts.append(((u % 1.0) * (W - 1), (v % 1.0) * (H - 1)))
        for k in range(1, len(pts) - 1): tri(pts[0], pts[k], pts[k + 1])
    for _ in range(grow):                                        # 가장자리 한 겹씩 넓혀 이음매를 덮는다
        nm = bytearray(mask)
        for y in range(1, H - 1):
            r = y * W
            for x in range(1, W - 1):
                if mask[r + x]: continue
                if mask[r + x - 1] or mask[r + x + 1] or mask[r - W + x] or mask[r + W + x]:
                    nm[r + x] = 1
        mask = nm
    return mask


def undress_socks(img, mask, thigh):
    """VRoid 기본 몸 텍스처에는 «무릎양말과 구두» 가 그려져 있다. 속옷 차림에 어울리지 않는다.

    어두운 화소만 골라 덮으면 양말의 «윤곽선» 이 실낱처럼 남는다 — 두 번 겪었다.
    무릎 아래 자리를 통째로 허벅지 살색으로 칠하되, 그 자리의 밝기 결은 남긴다.
    """
    px = list(img.pixels)
    lit = [0.2126 * px[t * 4] + 0.7152 * px[t * 4 + 1] + 0.0722 * px[t * 4 + 2]
           for t in range(len(mask)) if mask[t] and px[t * 4 + 3] > 0.5]
    if not lit: return 0
    lit.sort()
    ref = lit[int(len(lit) * 0.80)] or 1.0          # 그 자리에서 «맨살» 쪽 밝기
    n = 0
    for t in range(len(mask)):
        if not mask[t]: continue
        i = t * 4
        if px[i + 3] <= 0.01: continue
        L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        # 밝기 결을 너무 살리면 양말이 «그림자» 로 남는다 — 거의 평평하게 덮는다
        f = max(0.94, min(1.06, L / ref))
        for k in range(3): px[i + k] = min(1.0, thigh[k] * f)
        n += 1
    img.pixels = px
    return n


def recolour(img, target):
    """머리카락을 캐릭터 색으로. 밝기(가닥 결)는 두고 색만 갈아 끼운다."""
    px = list(img.pixels)
    for i in range(0, len(px), 4):
        L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        for k in range(3): px[i + k] = L * target[k] * 1.25
    img.pixels = px


def hair_tone(mesh):
    """캐릭터 정수리 화소에서 머리색을 읽는다."""
    from build_body import base_image
    img = base_image(mesh)
    if img is None: return (0.06, 0.05, 0.05)
    me = mesh.data; uv = me.uv_layers.active.data
    hi = max(v.co.z for v in me.vertices)
    px = list(img.pixels); W, H = img.size
    got = []
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index]
            if v.co.z < hi - 0.05 or v.normal.z < 0.35: continue    # 위를 보는 정수리
            u, w = uv[li].uv
            o = (int((w % 1.0) * (H - 1)) * W + int((u % 1.0) * (W - 1))) * 4
            got.append((px[o], px[o + 1], px[o + 2]))
    if len(got) < 20: return (0.06, 0.05, 0.05)
    got.sort(key=sum)
    return got[int(len(got) * 0.30)]      # 머리카락은 하이라이트가 세다 — 어두운 쪽을 본다


def build_one(char, keep_hair=True, tex=512):
    kind = BASE[char]; cfg = BUILD[char]
    arm0, B0, ALL = load_base(kind)

    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    for ob in objs:
        if ob.data.shape_keys: ob.shape_key_clear()     # 표정 모프가 있으면 정점을 못 옮긴다
    global KEEP
    if not keep_hair: KEEP = tuple(k for k in KEEP if k != '_HAIR')
    kept, dropped = strip_clothes(objs)
    bpy.ops.object.select_all(action='DESELECT')
    for o in kept: o.select_set(True)
    bpy.context.view_layer.objects.active = kept[0]
    if len(kept) > 1: bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.parent = None
    body.modifiers.clear()
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True); bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in body.data.vertices: v.co = YAW @ v.co     # 뼈와 같은 방향으로
    body.data.update()

    # 머리뼈 꼬리는 두개골 꼭대기로 — 믹사모 Head 뼈 길이(8 cm)로 누르면 머리가 납작해진다
    top = max(v.co.z for v in body.data.vertices)
    hh = ALL[VB + 'C_Head']
    B0['Head'] = (hh.copy(), Vector((hh.x, hh.y, top)))

    # ── 캐릭터 골격 불러오기 (뼈와 클립을 쓰고, 메시는 색을 읽는 데만 쓴다)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'art/3d/%s_anim.glb' % char))
    arm1 = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o is not arm0][0]
    src = max((o for o in bpy.data.objects if o.type == 'MESH' and o is not body
               and o.vertex_groups), key=lambda o: len(o.data.vertices))
    B1 = char_bones(arm1)
    hh1, ht1 = B1['Head']
    scale = B1['Neck'][0].z / B0['Neck'][0].z
    B1['Head'] = (hh1, hh1 + (ht1 - hh1).normalized()
                  * (B0['Head'][1] - B0['Head'][0]).length * scale)

    def girth(n):
        g = scale * cfg['girth']
        if 'Arm' in n or 'Hand' in n or 'Shoulder' in n: g = scale * cfg['arm']
        elif 'Leg' in n or 'Foot' in n or 'Toe' in n:    g = scale * cfg['leg']
        if n == 'Spine':  g *= cfg['waist']
        if n == 'Spine1': g *= (cfg['waist'] + 1) * 0.5
        return g

    names = [n for n in B0 if n in B1]
    me = body.data
    bv = [v.co.copy() for v in me.vertices]
    faces = [list(p.vertices) for p in me.polygons]
    out = warp(bv, B0, B1, girth)
    for i, v in enumerate(me.vertices): v.co = out[i]
    me.update()

    # ── 살을 뼈에 맨다. 가져온 가중치가 아니라 «기본 자세에서 뼈까지의 거리» 로 다시 만든다:
    #    VRoid 뼈는 손가락까지 있고 우리 리그에는 없어, 그대로 쓰면 손이 통째로 떨어진다.
    body.vertex_groups.clear()
    apply_weights(body, skin_weights(bv, faces, B0, names))
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True); arm1.select_set(True)
    bpy.context.view_layer.objects.active = arm1
    bpy.ops.object.parent_set(type='ARMATURE_NAME')
    orphan = fix_orphans(body)
    bpy.data.objects.remove(arm0, do_unlink=True)

    for img in bpy.data.images:
        if img.size[0] > tex: img.scale(tex, tex)

    # ── 이 몸이 «그 사람» 으로 보이게: 머리색·살색을 캐릭터 텍스처에서 읽어 옮긴다
    hair = hair_tone(src)
    skin = skin_tone(src)
    # 양말은 무릎을 «덮고» 올라온다. 무릎뼈에 맞춰 자르면 접힌 자락이 남는다.
    kneez = B1['LeftLeg'][0].z + 0.07
    socks = 0
    for img in bpy.data.images:
        nm = img.name
        if nm.endswith('_nml') or 'Matcap' in nm: continue
        if '_Body_' in nm:
            below = leg_mask(body, img, kneez)
            above = leg_mask(body, img, kneez + 0.18, lo=kneez + 0.04, grow=0)
            px = list(img.pixels)
            got = [(px[t * 4], px[t * 4 + 1], px[t * 4 + 2]) for t in range(len(above))
                   if above[t] and px[t * 4 + 3] > 0.5]
            got.sort(key=sum)
            thigh = got[int(len(got) * 0.55)] if len(got) > 100 else img_stats(px)
            socks = undress_socks(img, below, thigh)
        elif 'Hair' in nm and keep_hair: recolour(img, hair)
    for m in bpy.data.materials:
        if m.name.endswith('_HAIR'):
            # VRM 의 머리색은 재질 노드에 청록(0,0.40,0.60)으로 박혀 있어, 텍스처만 물들이면
            # 도로 청록으로 곱해진다. 노드를 버리고 «텍스처 + 프린시플드» 로 다시 짠다.
            img = next((n.image for n in m.node_tree.nodes
                        if n.type == 'TEX_IMAGE' and n.image and 'Hair' in n.image.name
                        and not n.image.name.endswith('_nml') and 'Matcap' not in n.image.name), None)
            nt = m.node_tree; nt.nodes.clear()
            out = nt.nodes.new('ShaderNodeOutputMaterial')
            bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
            bs.inputs['Roughness'].default_value = 0.65
            nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
            if img:
                tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
                nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
                nt.links.new(tx.outputs['Alpha'], bs.inputs['Alpha'])
            else:
                bs.inputs['Base Color'].default_value = (*hair, 1)
            continue
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not b: continue
        c = b.inputs['Base Color'].default_value
        if m.name.endswith('_SKIN') or m.name.endswith('_FACE'):
            for k in range(3): c[k] = min(1.0, skin[k] / 0.62)      # VRoid 기본 살빛 대비

    body.name = body.data.name = char + '_body'
    bpy.data.objects.remove(src, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type == 'MESH' and o is not body]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='SELECT')
    outp = os.path.join(ROOT, 'art/3d/%s_body.glb' % char)
    bpy.ops.export_scene.gltf(filepath=outp, export_format='GLB', use_selection=True,
                              export_animations=True, export_apply=False,
                              export_yup=True, export_materials='EXPORT')
    kb = os.path.getsize(outp) / 1024
    print('BODY %-5s %s  정점 %d  머리색 %.2f/%.2f/%.2f  살색 %.2f/%.2f/%.2f  뺀 옷 %s  외톨이 %d  %.0f KB'
          % (char, kind, len(me.vertices), *hair, *skin,
             ('CLOTH+양말%d' % socks) if socks else '-', orphan, kb),
          file=sys.stderr)


if __name__ == '__main__':
    args = sys.argv[1:]
    hair = '--no-hair' not in args
    for c in ([a for a in args if not a.startswith('-')] or ['ain', 'kain', 'ryu', 'sera']):
        build_one(c, keep_hair=hair)
