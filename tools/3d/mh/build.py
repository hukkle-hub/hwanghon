# 캐릭터 한 명 굽기: python3 tools/3d/mh/build.py tools/3d/mh tools/3d/mh/specs/<c>.json <출력.glb>  (먼저 setup.sh) · docs/design/81
import sys, json; sys.path.insert(0, sys.argv[-3]); import mhlib, bpy
b=mhlib.make(json.load(open(sys.argv[-2]))); mhlib.bake(b)
print('BODY', len(b.data.vertices), [o.name for o in bpy.context.scene.objects])
mhlib.export(sys.argv[-1]); print('WROTE')
