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
# 사용: python3 tools/3d/adopt_ain_body.py [--tex 1024] [--bust 0.022]
import bpy, sys, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art/3d/base/ain_modular_rig_candidate.glb')
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


def bust_apex(mesh):
    """가슴 정점이 척추(y −0.022) 보다 얼마나 앞으로 나와 있나, cm."""
    co = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
    band = [c for c in co if abs(c.z - BUST_C[2]) < 0.008 and abs(c.x) < 0.12]
    return (-min(c.y for c in band) - 0.022) * 100 if band else 0.0


def main(tex=1024, bust=0.022):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    before = os.path.getsize(SRC) / 1024
    sized = []
    for img in bpy.data.images:
        if img.size[0] > tex:
            sized.append('%s %d→%d' % (img.name, img.size[0], tex))
            img.scale(tex, tex)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    mesh = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    clips = len(bpy.data.actions)
    apex0 = bust_apex(mesh)
    moved, peak = reshape_bust(mesh, bust)
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
    print('  가슴  정점 %d 개 옮김 · 최대 %.1f mm · 앞으로 %.1f → %.1f cm'
          % (moved, peak * 1000, apex0, apex1), file=sys.stderr)


if __name__ == '__main__':
    a = sys.argv
    t = int(a[a.index('--tex') + 1]) if '--tex' in a else 1024
    b = float(a[a.index('--bust') + 1]) if '--bust' in a else 0.022
    main(t, b)
