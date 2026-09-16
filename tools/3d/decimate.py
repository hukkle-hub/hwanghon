# Hi3D 고폴리 GLB → 게임용 저폴리 (UV·텍스처 보존), Y-up, 높이 H m, 발 원점, 정면 +Z 가 되도록 필요 시 회전
import bpy, sys, math, os
from mathutils import Vector
src, dst, H, target = sys.argv[-4], sys.argv[-3], float(sys.argv[-2]), int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
if len(meshes)>1: bpy.ops.object.join()
m=bpy.context.view_layer.objects.active; m.name='Mesh'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type=='EMPTY': bpy.data.objects.remove(o)
tris=len(m.data.polygons); print('tris in', tris)
mod=m.modifiers.new('dec','DECIMATE'); mod.ratio=min(1.0, target/max(1,tris)); mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier='dec'); print('tris out', len(m.data.polygons))
bpy.ops.object.shade_smooth()
# 정규화: Blender Z-up 기준 (glTF Y-up 은 export 시 변환)
vs=[m.matrix_world@v.co for v in m.data.vertices]
mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
h=mx.z-mn.z; s=H/h
if os.environ.get('MODE')=='weapon':
    low=[v for v in vs if v.z < mn.z+h*0.6]; cx=sum(v.x for v in low)/len(low); cy=sum(v.y for v in low)/len(low)
    m.scale=(s,s,s); m.location=(-cx*s, -cy*s, -mn.z*s)
else:
    m.scale=(s,s,s); m.location=(-(mn.x+mx.x)/2*s, -(mn.y+mx.y)/2*s, -mn.z*s)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print('bounds', [round(v,3) for v in (min(v.x for v in vs)*s, max(v.x for v in vs)*s)], 'depth', round((mx.y-mn.y)*s,3), 'height', round(h*s,3))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True, export_animations=False, export_yup=True, export_image_format='AUTO', export_jpeg_quality=85)
print('exported', dst)
