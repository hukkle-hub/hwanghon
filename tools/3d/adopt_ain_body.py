# 지피티가 Hi3D 로 뽑은 아인 몸체를 게임에 들일 수 있는 무게로 줄인다.
#
# 원본(`art/3d/base/ain_modular_rig_candidate.glb`)은 그대로 둔다 — 그쪽 작업 파일이다.
# 여기서는 «받아서 줄인» 결과만 art/3d/ain_body.glb 로 굽는다.
#
# 왜 줄여야 하나: 후보는 7.0 MB 이고 그중 4.4 MB 가 2048² 텍스처 두 장이다.
# 옷 입은 아인(ain_anim.glb)은 3.7 MB 에 텍스처 0.5 MB 다. 서비스 워커가 미리 받는
# 파일이 이미 73 MB 라, 네 명을 다 이 무게로 바꾸면 92 MB 가 된다.
#
# 가슴은 디렉터 지시로 여기서 조금 키운다 (--bust, 기본 22 mm). 지피티가 새 후보를
# 올릴 때마다 이 도구를 다시 돌리므로, 손으로 고친 메시를 들고 있지 않아도 된다.
#
# 원본이 «두 갈래» 다.
#   · ain_22mm_reweighted_v3.glb 가 있으면 그걸 쓴다 — 지피티가 +22 mm 결과를 받아
#     스키닝을 다시 물린 것이다. attack1 에서 오른 어깨가 찢어지던 게 여기서 고쳐졌다.
#     가슴은 이미 들어가 있으므로 «다듬기» 만 한다.
#   · 없으면 후보에서 처음부터 — 가슴을 키우고 다듬는다.
#
# 사용: python3 tools/3d/adopt_ain_body.py [--tex 1024] [--bust 0.022] [--polish 1]
import bpy, sys, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAND = os.path.join(ROOT, 'art/3d/base/ain_modular_rig_candidate.glb')
REWEIGHT = os.path.join(ROOT, 'art/3d/base/ain_22mm_reweighted_v3.glb')
OUT = os.path.join(ROOT, 'art/3d/ain_body.glb')


# ── 가슴 ────────────────────────────────────────────────────────────────────
# 변위는 «위치만»으로 정해야 한다. 정점 법선을 방향으로 쓰면 UV 이음매에서 같은
# 자리에 겹쳐 있는 정점들이 서로 다른 법선을 갖고 있어 갈라진다 — 처음에 그렇게
# 짰다가 가슴에 검은 금이 그어졌다. 같은 좌표면 같은 변위여야 꿰맨 자리가 안 벌어진다.
FWD = Vector((0, -1, 0))                 # 아인은 −y 를 본다
BUST_C = (0.058, -0.105, 1.245)          # 좌우 봉우리 중심 (x, y, z)
BUST_R = (0.070, 0.078, 0.082)           # 반지름 — x 를 좁게 잡아야 가운데가 갈라진다


def reshape_bust(mesh, amp):
    if amp <= 0:
        return 0, 0.0
    cx, cy, cz = BUST_C
    rx, ry, rz = BUST_R
    cen = [Vector((cx, cy, cz)), Vector((-cx, cy, cz))]
    moved, peak = 0, 0.0
    for v in mesh.data.vertices:
        d = Vector((0, 0, 0))
        for c in cen:
            q = ((v.co.x - c.x) / rx) ** 2 + ((v.co.y - c.y) / ry) ** 2 + ((v.co.z - c.z) / rz) ** 2
            if q >= 1.0:
                continue
            r = v.co - c
            u = FWD * 0.62 + (r.normalized() * 0.38 if r.length > 1e-6 else Vector((0, 0, 0)))
            if u.length > 1e-9:
                d += u.normalized() * (1.0 - q) ** 2
        if d.length <= 1e-5:
            continue
        d = d.normalized() * min(d.length, 1.0) * amp
        v.co += d
        moved += 1
        peak = max(peak, d.length)
    mesh.data.update()
    # 모양을 바꿨으니 glTF 가 심어 준 커스텀 분할 법선은 낡았다 — 지우고 다시 계산하게 둔다.
    bpy.context.view_layer.objects.active = mesh
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e:                                   # noqa: BLE001
        print('분할 법선 초기화 실패:', e, file=sys.stderr)
    return moved, peak


# ── 다듬기 ──────────────────────────────────────────────────────────────────
# 22 mm 를 4 cm 안에 세우니 테두리에서 기울기가 확 꺾여 두 군데가 상했다.
# 무광 재질로 렌더해 보고서야 «텍스처 얼룩» 이 아니라 진짜 기하 결함인 걸 알았다.
#
#   · 밑가슴 밴드가 접혀 능선이 생긴다        → 전환 구간에 얇은 «치마» 를 덧댄다
#   · 한가운데가 움푹 팬다                     → 가운데를 살짝 채운다
#
# 라플라스 평활화로 펴 보려다 실패했다 — 봉우리까지 깎여 가운데 파임이
# 1.8 → 0.3 cm 로 사라졌다. 평활화는 부피를 먹는다. 그래서 «빼지 않고 더한다».
SKIRT_K = 1.75          # 치마 방울 = 본 방울의 몇 배
MID_C = (0.0, -0.100, 1.270)
MID_R = (0.045, 0.070, 0.072)


def _blob(p, cen, r, k):
    t = 0.0
    for c in cen:
        q = ((p.x - c.x) / (r[0] * k)) ** 2 + ((p.y - c.y) / (r[1] * k)) ** 2 \
            + ((p.z - c.z) / (r[2] * k)) ** 2
        if q < 1.0:
            t += (1.0 - q) ** 2
    return min(1.0, t)


def polish_bust(mesh, skirt=0.008, mid=0.007):
    """테두리 단차와 가운데 함몰만 메운다. 봉우리 높이는 안 건드린다."""
    if skirt <= 0 and mid <= 0:
        return 0, 0.0
    cx, cy, cz = BUST_C
    cen = [Vector((cx, cy, cz)), Vector((-cx, cy, cz))]
    mc = Vector(MID_C)
    moved, peak = 0, 0.0
    for v in mesh.data.vertices:
        p = v.co
        d = Vector((0, 0, 0))
        # 치마: 넓은 방울 − 좁은 방울 = 테두리에서만 1 인 고리.
        # 봉우리(둘 다 1)와 바깥(둘 다 0)에서는 0 이라 크기가 안 변한다.
        ring = max(0.0, _blob(p, cen, BUST_R, SKIRT_K) - _blob(p, cen, BUST_R, 1.0))
        if skirt > 0 and ring > 1e-4:
            a = Vector((0, 0, 0))
            for c in cen:
                q = ((p.x - c.x) / (BUST_R[0] * SKIRT_K)) ** 2 \
                    + ((p.y - c.y) / (BUST_R[1] * SKIRT_K)) ** 2 \
                    + ((p.z - c.z) / (BUST_R[2] * SKIRT_K)) ** 2
                if q >= 1.0:
                    continue
                r = p - c
                u = FWD * 0.62 + (r.normalized() * 0.38 if r.length > 1e-6 else Vector((0, 0, 0)))
                if u.length > 1e-9:
                    a += u.normalized() * (1.0 - q) ** 2
            if a.length > 1e-9:
                d += a.normalized() * ring * skirt
        if mid > 0:
            q = ((p.x - mc.x) / MID_R[0]) ** 2 + ((p.y - mc.y) / MID_R[1]) ** 2 \
                + ((p.z - mc.z) / MID_R[2]) ** 2
            if q < 1.0:
                d += FWD * ((1.0 - q) ** 2 * mid)
        if d.length <= 1e-5:
            continue
        v.co += d
        moved += 1
        peak = max(peak, d.length)
    mesh.data.update()
    return moved, peak


def bust_apex(mesh):
    """가슴 정점이 척추(y −0.022) 보다 얼마나 앞으로 나와 있나, cm."""
    co = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    band = [c for c in co if abs(c.z - BUST_C[2]) < 0.008 and abs(c.x) < 0.12]
    return (-min(c.y for c in band) - 0.022) * 100 if band else 0.0


def main(tex=1024, bust=0.022, polish=1.0):
    src = REWEIGHT if os.path.exists(REWEIGHT) else CAND
    baked = src is REWEIGHT            # 가슴이 이미 들어 있는 원본인가
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    before = os.path.getsize(src) / 1024
    sized = []
    for img in bpy.data.images:
        if img.size[0] > tex:
            sized.append('%s %d→%d' % (img.name, img.size[0], tex))
            img.scale(tex, tex)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    mesh = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    clips = len(bpy.data.actions)
    apex0 = bust_apex(mesh)
    moved, peak = (0, 0.0) if baked else reshape_bust(mesh, bust)
    pmoved, ppeak = polish_bust(mesh, 0.008 * polish, 0.007 * polish)
    if moved or pmoved:
        # 모양을 바꿨으니 glTF 가 심어 준 커스텀 분할 법선은 낡았다.
        bpy.context.view_layer.objects.active = mesh
        try:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except Exception as e:                                   # noqa: BLE001
            print('분할 법선 초기화 실패:', e, file=sys.stderr)
    apex1 = bust_apex(mesh)
    bpy.ops.object.select_all(action='SELECT')
    # 후보는 PNG 로 나왔는데, 게임에 들어가 있는 아인은 JPEG 다 (326+243 KB).
    # 이 재질에는 알파가 없으므로 같은 방식으로 맞춘다.
    kw = dict(filepath=OUT, export_format='GLB', use_selection=True,
              export_animations=True, export_apply=False,
              export_yup=True, export_materials='EXPORT', export_image_format='JPEG')
    try:
        bpy.ops.export_scene.gltf(export_jpeg_quality=88, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    after = os.path.getsize(OUT) / 1024
    print('ADOPT ain  정점 %d  뼈 %d  클립 %d  텍스처 %s  %.0f → %.0f KB'
          % (len(mesh.data.vertices), len(arm.data.bones), clips,
             ' · '.join(sized) or '그대로', before, after), file=sys.stderr)
    print('  원본  %s' % os.path.basename(src), file=sys.stderr)
    print('  가슴  키움 %d 정점 (%.1f mm) · 다듬기 %d 정점 (%.1f mm) · 앞으로 %.1f → %.1f cm'
          % (moved, peak * 1000, pmoved, ppeak * 1000, apex0, apex1), file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv
    t = int(a[a.index('--tex') + 1]) if '--tex' in a else 1024
    b = float(a[a.index('--bust') + 1]) if '--bust' in a else 0.022
    pl = float(a[a.index('--polish') + 1]) if '--polish' in a else 1.0
    main(t, b, pl)
