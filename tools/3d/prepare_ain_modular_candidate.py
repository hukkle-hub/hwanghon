"""Static inspection candidate only. Does not establish animation-ready topology."""
import bpy, bmesh, sys, os, json
from mathutils import Vector
src, out = [os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:]]
os.makedirs(out, exist_ok=True)
dest = os.path.join(out, 'ain_base_candidate.glb')
if os.path.exists(dest):
    raise RuntimeError('Preserve existing candidate; choose a new output directory')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
obj = bpy.context.object
obj.name = 'ain_base_candidate'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
lo = Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)])
hi = Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)])
scale = 1.68 / (hi.z-lo.z)
center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
for v in obj.data.vertices: v.co = (v.co-center)*scale
obj.data.calc_loop_triangles()
# Weld source UV-split duplicates BEFORE decimation, not after edge collapse.
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
bm.to_mesh(obj.data)
bm.free()
obj.data.update()
obj.data.calc_loop_triangles()
dec = obj.modifiers.new('static_preview_budget', 'DECIMATE')
dec.ratio = 59000/len(obj.data.loop_triangles)
bpy.ops.object.modifier_apply(modifier=dec.name)
obj.data.calc_loop_triangles()
triangles = len(obj.data.loop_triangles)
assert triangles <= 60000, triangles
for i, im in enumerate(bpy.data.images):
    if not im.size[0]: continue
    im.scale(2048,2048)
    im.filepath_raw = os.path.join(out, 'ain_texture_'+str(i)+'.png')
    im.file_format = 'PNG'
    im.save()
    im.pack()
bpy.ops.export_scene.gltf(filepath=dest, export_format='GLB', use_selection=True,
    export_yup=True, export_animations=False, export_cameras=False, export_lights=False,
    export_image_format='AUTO')
report = dict(status='STATIC_CANDIDATE_NOT_GAME_APPROVED', source=src,
    triangles=triangles, height_m=1.68, rigged=False, clothing_separated=False,
    known_limitations=['Automatic decimation is not deformation retopology',
    'Base underwear, hair and body remain one mesh; interchangeable garments not yet made',
    'No baked normal map; two PNG textures only',
    'Hand anatomy, rig compatibility and clipping not approved',
    'Existing game files preserved'])
with open(os.path.join(out, 'candidate_report.json'), 'w', encoding='utf8') as f:
    json.dump(report, f, indent=2)
print(json.dumps(report))
