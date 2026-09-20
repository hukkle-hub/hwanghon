"""FAILED-QA exploratory segmentation, NOT production extraction.
Texture thresholds leave cloth islands; spatial fills capture skin.
Does NOT invent hidden anatomy under clothes. Never install outputs as game assets.
"""
import bpy,bmesh,sys,os,json,numpy as np
from mathutils import Vector
src,out=[os.path.abspath(p) for p in sys.argv[sys.argv.index('--')+1:]]
os.makedirs(out,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
body=next(o for o in bpy.data.objects if o.type=='MESH')
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
arm.animation_data.action=None
for t in arm.animation_data.nla_tracks:t.mute=True
for b in arm.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update()
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(body.data);bm.free()
me=body.data;me.update();uv=me.uv_layers.active.data
mat=me.materials[0];bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
tex=bs.inputs['Base Color'].links[0].from_node.image
pixels=np.array(tex.pixels[:]).reshape(tex.size[1],tex.size[0],4)
labels=[];brightness=[]
for p in me.polygons:
 coords=[uv[i].uv for i in p.loop_indices]
 u=sum(v.x for v in coords)/len(coords);v=sum(v.y for v in coords)/len(coords)
 rgb=pixels[min(tex.size[1]-1,int(v*tex.size[1]))%tex.size[1],min(tex.size[0]-1,int(u*tex.size[0]))%tex.size[0],:3]
 lum=float(rgb.mean());brightness.append(lum)
 center=sum((me.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
 z=center.z
 label=0
 neutral=float(rgb.max()-rgb.min())/max(lum,.001)<.12
 if z>1.43 and lum<.28:label=3
 elif lum<.6 and neutral:
  if 1.10<z<1.44 and abs(center.x)<.215:label=1
  elif .69<z<1.10 and abs(center.x)<.22:label=2
 # Rest-pose garment interior fills: shadows and highlights are not seams.
 if .735<z<1.005 and abs(center.x)<.22:label=2
 if 1.18<z<1.32 and abs(center.x)<.18:label=1
 if z>1.62 or (z>1.49 and abs(center.x)>.095) or (z>1.46 and center.y>.025):label=3
 labels.append(label)
# Shared-edge components let eyes/brows stay with the face instead of hair.
edge_faces={}
for p in me.polygons:
 for e in p.edge_keys:edge_faces.setdefault(tuple(sorted(e)),[]).append(p.index)
adj=[set() for _ in me.polygons]
for group in edge_faces.values():
 for i in group:adj[i].update(j for j in group if i!=j)
for lab in (1,2,3):
 unseen={i for i,v in enumerate(labels) if v==lab};comps=[]
 while unseen:
  todo=[unseen.pop()];comp=set(todo)
  while todo:
   i=todo.pop()
   for j in adj[i]:
    if j in unseen:unseen.remove(j);comp.add(j);todo.append(j)
  comps.append(comp)
 # Hair may have independent tufts, but tiny eye/brow islands are skin details.
 threshold=10 if lab==3 else 15
 for comp in comps:
  if len(comp)<threshold:
   for i in comp:labels[i]=0
# Fill enclosed tiny classification islands, not the true garment openings.
for _ in range(3):
 next_labels=labels.copy()
 for i,lab in enumerate(labels):
  if not adj[i]:continue
  votes=[labels[j] for j in adj[i]]
  best=max(set(votes),key=votes.count)
  if best!=lab and votes.count(best)==len(votes):next_labels[i]=best
 labels=next_labels
names=['body_surface','underwear_upper','underwear_lower','hair']
parts=[];counts={}
for lab,name in enumerate(names):
 ob=body.copy();ob.data=me.copy();bpy.context.collection.objects.link(ob);ob.name=ob.data.name=name
 bm=bmesh.new();bm.from_mesh(ob.data);bm.faces.ensure_lookup_table()
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if labels[f.index]!=lab],context='FACES')
 bm.to_mesh(ob.data);bm.free();ob.data.update();counts[name]=len(ob.data.polygons);parts.append(ob)
bpy.data.objects.remove(body,do_unlink=True)
for t in arm.animation_data.nla_tracks:t.mute=False
for ob in parts:
 bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);ob.select_set(True)
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,'ain_'+ob.name+'.glb'),export_format='GLB',use_selection=True,export_animations=True)
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
for ob in parts:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'ain_separated_candidate.glb'),export_format='GLB',use_selection=True,export_animations=True)
with open(os.path.join(out,'separation_report.json'),'w') as f:json.dump(dict(status='FAILED_VISUAL_QA_DO_NOT_SHIP',parts=counts,complete_hidden_body=False,shared_skeleton=True,limitations=['Texture boundaries leave cloth islands; spatial rules capture skin','Body under garments is missing in the source, NOT reconstructed','Scalp beneath hair is not reconstructed','Not approved for runtime replacement']),f,indent=2)
# Exploded rest-pose evidence, cameras/lights not exported.
for t in arm.animation_data.nla_tracks:t.mute=True
arm.animation_data.action=None
for b in arm.pose.bones:b.matrix_basis.identity()
for ob,dx in zip(parts,[0,.65,.65,-.55]):ob.location.x+=dx
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=20
sc.render.resolution_x=1400;sc.render.resolution_y=1200;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new('studio');sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.21,.26,1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power in [((2,-3,3),500),((-2,-1,2),500),((0,3,3),600)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=3
 o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.2,-4,1));cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.25
cam.rotation_euler=(Vector((.1,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=os.path.join(out,'separated.png');bpy.ops.render.render(write_still=True)
