# Hi3D 생성 장비 GLB 후처리 (bpy): 잘라내기(크롭 찌꺼기 제거) → 데시메이트 → 텍스처 축소 → 규약 정렬 → art/3d/gear/<id>.glb
#   python3 tools/3d/gear_post.py <src.glb> <id> [--keep "xmin,xmax,ymin,ymax,zmin,zmax"] [--faces 20000] [--tex 1024]
#       [--axis y|-y] [--len 1.1] [--butt 0.55] [--pair]  (좌표는 glTF: +Y 위)
#   무기 규약: 원점 = 자루 끝, +Y 자루 방향(칼끝·날 쪽), 오른손 그립 0.75 m. 이미지 위쪽이 glTF +Y.
#   --axis -y : 이미지에서 칼끝이 아래(=-Y)였으면 뒤집는다. --butt : 자루 끝이 놓일 Y (검은 0.55 → 손이 0.75)
#   방어구: --len 은 높이(Y), 원점 = 바운딩 중심 (looks.js 에서 뼈 오프셋으로 맞춤). --pair 는 좌/우 두 조각을 <id>_L/_R 로 나눔(x 부호)
import bpy, sys, os, argparse
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
ap=argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('id'); ap.add_argument('--keep'); ap.add_argument('--faces',type=int,default=20000); ap.add_argument('--tex',type=int,default=1024)
ap.add_argument('--axis',default='y'); ap.add_argument('--len',type=float,default=1.0); ap.add_argument('--butt',type=float,default=0.0); ap.add_argument('--pair',action='store_true'); ap.add_argument('--armor',action='store_true'); ap.add_argument('--rotz',type=float,default=0); ap.add_argument('--blade',default='')  # 'neg' 이면 날이 -X 로 뻗도록(낫 규약: ain_scythe_tex 날 = -X)
a=ap.parse_args(argv)
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','art','3d','gear'); os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=a.src)
ms=[o for o in bpy.data.objects if o.type=='MESH']
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active=ms[0]
if len(ms)>1: bpy.ops.object.join()
o=bpy.context.object; bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Blender 좌표: glTF(x,y,z) → (x,-z,y). --keep 은 glTF 좌표로 받음
if a.keep:
    k=[float(v) for v in a.keep.split(',')]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
    for v in o.data.vertices:
        gx,gy,gz=v.co.x, v.co.z, -v.co.y
        v.select = not (k[0]<=gx<=k[1] and k[2]<=gy<=k[3] and k[4]<=gz<=k[5])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
    print('kept verts', len(o.data.vertices))
# 데시메이트
ratio=min(1.0, a.faces/max(1,len(o.data.polygons))); m=o.modifiers.new('dec','DECIMATE'); m.ratio=ratio; m.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier='dec'); print('faces', len(o.data.polygons))
# 텍스처 축소
for img in bpy.data.images:
    if img.size[0]>a.tex: img.scale(a.tex,a.tex)
# 정렬: 바운딩 계산 (Blender 좌표)
def bbox(ob):
    xs=[v.co for v in ob.data.vertices]; mn=Vector([min(p[i] for p in xs) for i in range(3)]); mx=Vector([max(p[i] for p in xs) for i in range(3)]); return mn,mx
mn,mx=bbox(o); size=mx-mn; c=(mn+mx)/2
def xf(M): o.data.transform(M); o.data.update()
s=a.len/size.z
if a.armor:
    xf(Matrix.Translation(-c)); xf(Matrix.Scale(s,4))
    if a.rotz: xf(Matrix.Rotation(a.rotz,4,'Z'))
else:
    xf(Matrix.Translation(Vector((-c.x,-c.y,-mn.z)))); xf(Matrix.Scale(s,4))
    if a.axis=='-y': xf(Matrix.Rotation(3.141592653589793,4,'X'))   # 뒤집기(칼끝이 이미지 아래였을 때)
    if a.rotz: xf(Matrix.Rotation(a.rotz,4,'Z'))
    if a.blade=='neg':
        mn,mx=bbox(o)
        if mx.x>-mn.x: xf(Matrix.Rotation(3.141592653589793,4,'Z')); print('blade flipped to -X')
    mn,mx=bbox(o); xf(Matrix.Translation(Vector((0,0,a.butt-mn.z))))   # 자루 끝 → butt
mn,mx=bbox(o); print('final bbox glTF x[%.2f,%.2f] y[%.2f,%.2f] z[%.2f,%.2f]'%(mn.x,mx.x,mn.z,mx.z,-mx.y,-mn.y))
def export(ob,name):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
    p=os.path.join(OUT,name+'.glb'); bpy.ops.export_scene.gltf(filepath=p, export_format='GLB', use_selection=True, export_yup=True, export_animations=False, export_image_format='JPEG', export_jpeg_quality=80)
    print('wrote', p, os.path.getsize(p)//1024, 'KB')
if a.pair:
    # x<0 → L, x>=0 → R (각각 원점 = 자기 바운딩 중심 하단이 아니라 중심)
    for tag,keep in (('L',lambda x:x<0),('R',lambda x:x>=0)):
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.duplicate(); d=bpy.context.object
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
        for v in d.data.vertices: v.select=not keep(v.co.x)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
        mn,mx=bbox(d); c=(mn+mx)/2; d.location=(-c.x,-c.y,-c.z); bpy.ops.object.transform_apply(location=True); export(d, a.id+'_'+tag)
else: export(o, a.id)
