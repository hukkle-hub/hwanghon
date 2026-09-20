"""Non-destructive source inspection. blender -b -t 4 --python THIS -- input.glb output_dir"""
import bpy, sys, os, json
from mathutils import Vector

src, out = sys.argv[sys.argv.index('--')+1:]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo+hi)/2
size = max(hi-lo)
report = {'source': os.path.abspath(src), 'bounds_blender': [list(lo), list(hi)],
          'meshes': [], 'images': [], 'materials': []}
for o in meshes:
    o.data.calc_loop_triangles()
    report['meshes'].append({'name':o.name, 'triangles':len(o.data.loop_triangles),
                            'vertices':len(o.data.vertices), 'uv_layers':len(o.data.uv_layers)})
for m in bpy.data.materials:
    report['materials'].append({'name':m.name, 'nodes':[{'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None} for n in m.node_tree.nodes] if m.use_nodes else []})
for im in bpy.data.images:
    report['images'].append({'name':im.name,'size':list(im.size),'colorspace':im.colorspace_settings.name})
with open(os.path.join(out,'source_inspection.json'),'w',encoding='utf8') as f:
    json.dump(report,f,ensure_ascii=False,indent=2)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('inspection_studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.36,.42,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for offset,power in [((1,-2,2),500),((-2,1,1),650),((2,2,0),400)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*size)
    o=bpy.context.object;o.data.energy=power*size*size;o.data.size=size*1.5
    o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=size*1.18
for name,offset in [('front',(0,-3,0)),('rear',(0,3,0)),('side',(3,0,0)),('oblique',(1.5,-3,.5))]:
    cam.location=center+Vector(offset)*size
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(out,name+'.png');bpy.ops.render.render(write_still=True)
print('SOURCE_INSPECTION_COMPLETE',json.dumps(report['meshes']))
