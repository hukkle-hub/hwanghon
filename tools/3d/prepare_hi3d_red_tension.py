"""Prepare the approved one-shot Hi3D source; never overwrites the source GLB.
blender -b -t 4 --python THIS -- source.glb candidate_directory
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector

src,out=sys.argv[sys.argv.index('--')+1:]
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
high=bpy.context.object;high.name='source_high'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
arr=np.empty(len(high.data.vertices)*3,dtype=np.float32);high.data.vertices.foreach_get('co',arr);arr=arr.reshape((-1,3))
# Fit the handle rather than the whole model (the curved blade biases PCA).
bands=[]
for z in np.linspace(-.37,.0,20):
    p=arr[np.abs(arr[:,2]-z)<.004]
    if len(p)>20:bands.append([*(.5*(p.min(axis=0)+p.max(axis=0)))])
bands=np.array(bands)
sx,ix=np.polyfit(bands[:,2],bands[:,0],1);sy,iy=np.polyfit(bands[:,2],bands[:,1],1)
axis=Vector((float(sx),float(sy),1)).normalized()
rot=axis.rotation_difference(Vector((0,0,1))).to_matrix()
arr=arr@np.array(rot).T
# Center the handle on the vertical axis, then set floor origin and real height.
anchor=np.array(rot)@np.array([ix,iy,0]);arr[:,:2]-=anchor[:2]
arr[:,2]-=arr[:,2].min();scale=1.905/arr[:,2].max();arr*=scale
# Runtime aimScytheBlade authors the cutting blade along -X, not +X.
arr[:,:2]*=-1
# Clear the palm envelopes at both existing IK grip heights (.75 and .43m).
# Smooth transitions preserve the surrounding ornamental collars.
weight=np.zeros(len(arr))
for grip_z in [.43,.75]:
    d=np.abs(arr[:,2]-grip_z)
    w=np.clip((.095-d)/.035,0,1);w=w*w*(3-2*w)
    weight=np.maximum(weight,w)
radius=np.linalg.norm(arr[:,:2],axis=1)
factor=1-weight*(1-np.minimum(1,.022/np.maximum(radius,1e-8)))
arr[:,:2]*=factor[:,None]
high.data.vertices.foreach_set('co',arr.astype(np.float32).ravel());high.data.update()
low=high.copy();low.data=high.data.copy();bpy.context.collection.objects.link(low);low.name='red_tension_scythe'
bpy.context.view_layer.objects.active=low
dec=low.modifiers.new('mobile_geometry_budget','DECIMATE');dec.ratio=14000/len(high.data.polygons)
bpy.ops.object.modifier_apply(modifier=dec.name)
low.data.calc_loop_triangles();tri=len(low.data.loop_triangles)
if tri>15000:raise RuntimeError('Triangle budget exceeded: '+str(tri))
mat=low.data.materials[0].copy();low.data.materials.clear();low.data.materials.append(mat);mat.name='red_tension_pbr'
nt=mat.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
normal=bpy.data.images.new('red_tension_normal',width=2048,height=2048,alpha=False);normal.colorspace_settings.name='Non-Color'
target=nt.nodes.new('ShaderNodeTexImage');target.image=normal;nt.nodes.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8
bpy.ops.object.select_all(action='DESELECT');high.select_set(True);low.select_set(True);bpy.context.view_layer.objects.active=low
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.006;scene.render.bake.max_ray_distance=.02
bpy.ops.object.bake(type='NORMAL',margin=8)
nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(target.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],p.inputs['Normal'])
for im in bpy.data.images:
    if im.size[0]>2048:im.scale(2048,2048)
    if im.size[0]:
        im.filepath_raw=os.path.join(out,im.name+'.png');im.file_format='PNG';im.save();im.pack()
high.hide_render=True;high.hide_set(True)
bpy.ops.object.select_all(action='DESELECT');low.select_set(True)
# Read true blade extrema from the delivered mesh, not a hard-coded old weapon.
v=np.array([tuple(v.co) for v in low.data.vertices]);blade=v[(v[:,2]>1.2)&(v[:,0]<-.12)]
tip=blade[np.argmin(blade[:,0])]
root=np.array([-.08,0,float(np.percentile(blade[:,2],90))-.10])
for name,pos in [('AinBladeRoot',root),('AinBladeTip',tip)]:
    marker=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(marker);marker.location=pos;marker.select_set(True)
dest=os.path.join(out,'w_red_tension.glb')
bpy.ops.export_scene.gltf(filepath=dest,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
grip=v[(v[:,2]>.68)&(v[:,2]<.92)]
report={'status':'candidate_pending_visual_and_in_game_review','source':os.path.abspath(src),'triangles':tri,'bytes':os.path.getsize(dest),'materialCount':1,'textureSize':2048,'height_m':1.905,'grip_m':.75,'grip_radius_max':float(np.linalg.norm(grip[:,:2],axis=1).max()),'shaft_fit_source':[float(sx),float(sy)],'blade_tip_blender':tip.tolist(),'blade_root_blender':root.tolist(),'credits_spent':65,'notes':['No rigs or animations','Original source preserved','Geometry-normal transfer baked from high to low','Cosmetic only']}
with open(os.path.join(out,'manifest.json'),'w',encoding='utf8')as f:json.dump(report,f,indent=2)
print('HI3D_CANDIDATE',json.dumps(report))
