# 지피티가 Hi3D 로 뽑은 아인 몸체를 게임에 들일 수 있는 무게로 줄인다.
#
# 원본(`art/3d/base/ain_modular_rig_candidate.glb`)은 그대로 둔다 — 그쪽 작업 파일이다.
# 여기서는 «받아서 줄인» 결과만 art/3d/ain_body.glb 로 굽는다.
#
# 왜 줄여야 하나: 후보는 7.0 MB 이고 그중 4.4 MB 가 2048² 텍스처 두 장이다.
# 옷 입은 아인(ain_anim.glb)은 3.7 MB 에 텍스처 0.5 MB 다. 서비스 워커가 미리 받는
# 파일이 이미 73 MB 라, 네 명을 다 이 무게로 바꾸면 92 MB 가 된다.
#
# 사용: python3 tools/3d/adopt_ain_body.py [--tex 1024]
import bpy, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art/3d/base/ain_modular_rig_candidate.glb')
OUT = os.path.join(ROOT, 'art/3d/ain_body.glb')


def main(tex=1024):
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


if __name__ == '__main__':
    a = sys.argv
    t = int(a[a.index('--tex') + 1]) if '--tex' in a else 1024
    main(t)
