"""Higgsfield(Tripo H3.1) 고폴리 GLB → 보관용 원본 (docs/design/82).

왜: Tripo «detailed» 결과는 한 개에 190 만 삼각형·65 MB 다. 저장소에 그대로 둘 수 없고, 게임 규약(무기 자루 원점·
방어구 뼈 오프셋·보스 리그)은 아직 정하지 않았다. 모양·UV·텍스처만 지키며 줄여 art/3d/src/hf/ 에 둔다.
게임에 넣을 때는 여기서 tools/3d/gear_post.py(장비)·rig 도구(보스)로 다시 깎는다.

  python3 tools/3d/hf_reduce.py <입력 glb> <출력 glb> [--faces 30000] [--tex 1024]
"""
import sys, os, argparse, subprocess
import bpy

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--faces', type=int, default=30000); ap.add_argument('--tex', type=int, default=1024)
a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a.src)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
m = bpy.context.object; n0 = len(m.data.polygons)
mod = m.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, a.faces / max(1, n0)); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec'); bpy.ops.object.shade_smooth()
tmp = a.dst + '.tmp.glb'
bpy.ops.export_scene.gltf(filepath=tmp, export_format='GLB', use_selection=False, export_apply=True, export_image_format='AUTO')
subprocess.run([sys.executable if 'python' in os.path.basename(sys.executable) else 'python3',
                os.path.join(os.path.dirname(os.path.abspath(__file__)), 'glb_tex_resize.py'), tmp, a.dst, str(a.tex)], check=True)
os.remove(tmp)
print(f'{os.path.basename(a.src)}: 삼각형 {n0} → {len(m.data.polygons)} · {os.path.getsize(a.dst) / 1e6:.1f} MB')
os._exit(0)
